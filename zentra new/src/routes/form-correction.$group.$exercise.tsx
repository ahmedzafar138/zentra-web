import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, Camera, CheckSquare, ChevronLeft, Loader2, Pause, Play, Square, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/hooks/useAuth";
import { MODEL_GATEWAY_API_BASE_URL } from "@/lib/api";
import { formatDuration } from "@/lib/format";
import {
  getModelConfig, normalizePoseLandmarks, saveSessionSummary,
  skeletonConnections, minSkeletonVisibility,
  type PoseLandmark,
} from "@/lib/formCorrection";

export const Route = createFileRoute("/form-correction/$group/$exercise")({
  head: () => ({ meta: [{ title: "Live Correction — Zentra" }] }),
  component: () => (
    <Protected>
      <LivePage />
    </Protected>
  ),
});

function LivePage() {
  const { group, exercise } = useParams({ from: "/form-correction/$group/$exercise" });
  const { user } = useAuth();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const frameTimerRef = useRef<number | null>(null);
  const recordingTimerRef = useRef<number | null>(null);
  const liveRunRef = useRef(0);
  const sessionStartedAtRef = useRef<number | null>(null);
  const sessionSavedRef = useRef(true);
  const sessionMetaRef = useRef<{ group: string; exercise: string; userId?: string }>({ group, exercise, userId: user?.id });

  const initialStats = { correct: 0, incorrect: 0, angle: 0, feedback: "Stand fully visible in the webcam frame." };
  const statsRef = useRef(initialStats);

  const [cameraActive, setCameraActive] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [status, setStatus] = useState("Webcam idle");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [stats, setStats] = useState(initialStats);
  const [poseLandmarks, setPoseLandmarks] = useState<PoseLandmark[]>([]);
  const [error, setError] = useState("");

  const modelConfig = getModelConfig(group, exercise);
  const supportsInference = Boolean(modelConfig);

  const updateStats = (next: typeof initialStats) => {
    statsRef.current = next;
    setStats(next);
  };

  const saveCurrentSession = useCallback(() => {
    const startedAt = sessionStartedAtRef.current;
    if (!startedAt || sessionSavedRef.current) return;
    const endedAt = Date.now();
    const durationSeconds = Math.max(1, Math.round((endedAt - startedAt) / 1000));
    const currentStats = statsRef.current;
    const meta = sessionMetaRef.current;
    const totalReps = currentStats.correct + currentStats.incorrect;
    if (durationSeconds < 3 && totalReps === 0) {
      sessionSavedRef.current = true;
      return;
    }
    void saveSessionSummary(
      {
        id: `${startedAt}-${meta.exercise.replace(/\s+/g, "-").toLowerCase()}`,
        user_id: meta.userId,
        group: meta.group,
        exercise: meta.exercise,
        started_at: new Date(startedAt).toISOString(),
        ended_at: new Date(endedAt).toISOString(),
        duration_seconds: durationSeconds,
        total_reps: totalReps,
        correct_reps: currentStats.correct,
        incorrect_reps: currentStats.incorrect,
        feedback: currentStats.feedback,
      },
      user,
    );
    sessionSavedRef.current = true;
  }, [user]);

  const stopLive = useCallback(() => {
    saveCurrentSession();
    liveRunRef.current += 1;
    if (frameTimerRef.current) window.clearInterval(frameTimerRef.current);
    if (recordingTimerRef.current) window.clearInterval(recordingTimerRef.current);
    const socket = socketRef.current;
    if (socket) {
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      if (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN) {
        socket.close(1000, "Exercise changed");
      }
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    frameTimerRef.current = null;
    recordingTimerRef.current = null;
    socketRef.current = null;
    streamRef.current = null;
    setStreaming(false);
    setCameraActive(false);
    setPoseLandmarks([]);
    setStatus("Webcam stopped");
    sessionStartedAtRef.current = null;
  }, [saveCurrentSession]);

  useEffect(() => {
    sessionMetaRef.current = { group, exercise, userId: user?.id };
    return () => stopLive();
    // stop on unmount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    stopLive();
    setElapsedSeconds(0);
    updateStats(initialStats);
    setPoseLandmarks([]);
    setStatus("Webcam idle");
    sessionMetaRef.current = { group, exercise, userId: user?.id };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group, exercise]);

  const startCamera = async () => {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Webcam access needs localhost, HTTPS, or a browser that supports media devices.");
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 960 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        videoRef.current.playsInline = true;
        await videoRef.current.play().catch(() => undefined);
      }
      setCameraActive(true);
      setStatus(supportsInference ? "Webcam ready. Start recording when ready." : "Webcam ready. AI model is not wired for this exercise yet.");
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Webcam permission failed.");
      return false;
    }
  };

  const captureFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const socket = socketRef.current;
    if (!video || !canvas || socket?.readyState !== WebSocket.OPEN || video.readyState < 2) return;
    const width = video.videoWidth || 480;
    const height = video.videoHeight || 640;
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(video, 0, 0, width, height);
    const image_base64 = canvas.toDataURL("image/jpeg", 0.38);
    socket.send(JSON.stringify({ type: "image_frame", image_base64, timestamp_ms: Date.now() }));
  };

  const startInference = async () => {
    setError("");
    if (!supportsInference || !modelConfig) {
      setError("Live AI correction is only wired for Bicep Curl, Deadlift, Dumbbell Flyes, Plank, Push-ups, and Squats.");
      return;
    }
    const runId = liveRunRef.current + 1;
    liveRunRef.current = runId;
    if (!cameraActive) {
      const started = await startCamera();
      if (!started) return;
      if (liveRunRef.current !== runId) return;
    }
    try {
      setElapsedSeconds(0);
      updateStats(initialStats);
      setPoseLandmarks([]);
      setStatus(`Loading ${modelConfig.label} model...`);
      await modelConfig.load();
      if (liveRunRef.current !== runId) return;
      sessionStartedAtRef.current = Date.now();
      sessionSavedRef.current = false;
      sessionMetaRef.current = { group, exercise, userId: user?.id };
      const url = `${MODEL_GATEWAY_API_BASE_URL.replace(/^http/, "ws")}/api/v1/${modelConfig.slug}/ws`;
      const socket = new WebSocket(url);
      socketRef.current = socket;
      socket.onopen = () => {
        if (liveRunRef.current !== runId || socketRef.current !== socket) return;
        setStreaming(true);
        setStatus("AI correction streaming");
        if (recordingTimerRef.current) window.clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = window.setInterval(() => setElapsedSeconds((current) => current + 1), 1000);
        frameTimerRef.current = window.setInterval(captureFrame, 220);
      };
      socket.onmessage = (event) => {
        if (liveRunRef.current !== runId || socketRef.current !== socket) return;
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === "session_started") {
            setStatus(`${modelConfig.label} session ready`);
            return;
          }
          if (payload.type === "error") {
            setStatus("AI correction paused");
            setPoseLandmarks([]);
            updateStats({ ...statsRef.current, feedback: String(payload.message ?? "Inference error") });
            return;
          }
          if (payload.type === "frame_result") {
            setPoseLandmarks(normalizePoseLandmarks(payload.landmarks, modelConfig.slug));
            updateStats({
              correct: Number(payload.correct_reps ?? payload.correct ?? 0),
              incorrect: Number(payload.incorrect_reps ?? payload.incorrect ?? 0),
              angle: Math.round(Number(payload.angle ?? 0)),
              feedback: String(payload.feedback ?? payload.prediction?.reason ?? payload.prediction?.label ?? payload.status ?? "Keep moving."),
            });
          }
        } catch {
          // ignore malformed payloads
        }
      };
      socket.onerror = () => {
        if (liveRunRef.current !== runId || socketRef.current !== socket) return;
        setError(`Model gateway WebSocket is offline: ${url}`);
        setStatus("AI correction offline");
      };
      socket.onclose = () => {
        if (liveRunRef.current !== runId || socketRef.current !== socket) return;
        if (frameTimerRef.current) window.clearInterval(frameTimerRef.current);
        if (recordingTimerRef.current) window.clearInterval(recordingTimerRef.current);
        frameTimerRef.current = null;
        recordingTimerRef.current = null;
        socketRef.current = null;
        setStreaming(false);
      };
    } catch (err) {
      if (liveRunRef.current !== runId) return;
      setError(err instanceof Error ? err.message : "Unable to start live correction.");
      setStatus("AI correction offline");
    }
  };

  const visibleLandmarks = poseLandmarks.filter(
    (landmark) =>
      Number.isFinite(landmark.x) &&
      Number.isFinite(landmark.y) &&
      (landmark.visibility ?? 1) >= minSkeletonVisibility,
  );
  const landmarkByName = new Map(visibleLandmarks.map((landmark) => [landmark.name, landmark]));
  const hasSkeleton = visibleLandmarks.length >= 2;
  const isPlank = modelConfig?.slug === "planks";
  const plankFormStatus = stats.correct > 0 && stats.correct >= stats.incorrect ? "Correct" : stats.incorrect > 0 ? "Needs Fix" : "Waiting";
  const plankFormTone = plankFormStatus === "Correct" ? "Good" : plankFormStatus === "Needs Fix" ? "Adjust" : "Ready";

  const feedbackItems = supportsInference
    ? [
        stats.feedback,
        stats.angle ? `Current angle: ${stats.angle}°` : "Keep your full body visible in frame.",
        exercise === "Squats" ? "Drive from the bottom back to a full standing position."
          : exercise === "Deadlift" ? "Use a side view and hinge at the hips."
          : exercise === "Plank" ? "Hold a straight side-view body line."
          : exercise === "Push-ups" ? "Use a side view and complete the full push-up range."
          : exercise === "Dumbbell Flyes" ? "Open wide, close under control, then return to open."
          : "Control tempo through the full curl.",
      ]
    : ["This exercise opens webcam preview only."];

  return (
    <AppShell>
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Link to="/form-correction/$group" params={{ group }}
            className="h-10 w-10 grid place-items-center rounded-xl bg-surface border border-border hover:border-primary/40 transition shrink-0">
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">{group} form correction</p>
            <h1 className="text-xl md:text-2xl font-bold truncate">{exercise}</h1>
          </div>
          <span className={`hidden sm:inline-flex items-center gap-1.5 px-3 h-9 rounded-full text-xs font-semibold ${streaming ? "bg-destructive/20 text-destructive" : "bg-surface border border-border text-muted-foreground"}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${streaming ? "bg-destructive animate-pulse" : "bg-muted-foreground"}`} />
            {streaming ? "REC" : "READY"}
          </span>
        </div>

        {error && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</div>
        )}

        {/* Two-column on lg+: video left, stats + feedback + actions right.
            Stacks vertically on mobile. */}
        <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-4 items-start">
          {/* Left: video card */}
          <div className="card-elevated p-3">
            <div className="flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground mb-2 px-1">
              <span className={`sm:hidden px-2 py-0.5 rounded-full font-semibold text-[10px] ${streaming ? "bg-destructive/20 text-destructive" : "bg-surface-elevated"}`}>
                {streaming ? "REC" : "READY"}
              </span>
              <span>{formatDuration(elapsedSeconds)}</span>
              <span className="font-semibold text-foreground">{isPlank ? plankFormTone : `REPS ${stats.correct + stats.incorrect}`}</span>
            </div>
            <div className="relative aspect-video bg-black rounded-xl overflow-hidden">
              <video ref={videoRef} autoPlay muted playsInline className="absolute inset-0 w-full h-full object-cover scale-x-[-1]" />
              {hasSkeleton && (
                <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
                  {skeletonConnections.map(([fromName, toName]) => {
                    const from = landmarkByName.get(fromName);
                    const to = landmarkByName.get(toName);
                    if (!from || !to) return null;
                    return (
                      <line key={`${fromName}-${toName}`} x1={1 - from.x} y1={from.y} x2={1 - to.x} y2={to.y}
                        stroke="rgb(255 106 0)" strokeWidth="0.008" strokeLinecap="round" />
                    );
                  })}
                  {visibleLandmarks.map((landmark) => (
                    <circle key={landmark.name} cx={1 - landmark.x} cy={landmark.y} r="0.012"
                      fill="rgb(255 106 0)" stroke="white" strokeWidth="0.004" />
                  ))}
                </svg>
              )}
              {streaming && (
                <div className={`absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs glass ${hasSkeleton ? "text-primary" : "text-muted-foreground"}`}>
                  {hasSkeleton ? "Skeleton tracking" : "Searching for pose"}
                </div>
              )}
              {!cameraActive && (
                <div className="absolute inset-0 grid place-items-center text-muted-foreground">
                  <div className="text-center">
                    <Camera className="h-10 w-10 mx-auto" />
                    <p className="mt-2 font-medium text-sm">Webcam preview</p>
                    <p className="text-xs">{exercise} · Live correction</p>
                  </div>
                </div>
              )}
              <canvas ref={canvasRef} hidden />
            </div>
          </div>

          {/* Right: stats + feedback + actions */}
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {isPlank ? (
                <>
                  <Stat icon={CheckSquare} value={plankFormStatus} label="Form" />
                  <Stat icon={Activity} value={stats.angle ? `${stats.angle}°` : "—"} label="Angle" />
                </>
              ) : (
                <>
                  <Stat icon={CheckSquare} value={stats.correct} label="Correct" />
                  <Stat icon={Trash2} value={stats.incorrect} label="Incorrect" />
                </>
              )}
              <Stat icon={Activity} value={streaming ? "Live" : "Idle"} label="Status" />
            </div>

            <div className="card-elevated p-4">
              <strong className="block text-sm">Live feedback</strong>
              <div className="mt-2 space-y-1.5 text-sm">
                {feedbackItems.map((item, index) => (
                  <p key={`${item}-${index}`} className={index === 0 ? "text-primary" : "text-muted-foreground text-xs"}>
                    {index === 0 ? "✓" : "•"} {item}
                  </p>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2 inline-flex items-center gap-2">
                {streaming && <Loader2 className="h-3 w-3 animate-spin" />} {status}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button onClick={cameraActive ? stopLive : startCamera}
                className="h-11 rounded-xl bg-surface border border-border text-xs sm:text-sm hover:border-primary/40 transition inline-flex items-center justify-center gap-1.5">
                {cameraActive ? <Square className="h-3.5 w-3.5" /> : <Camera className="h-3.5 w-3.5" />}
                {cameraActive ? "Stop" : "Open Cam"}
              </button>
              <Link to="/form-correction/$group" params={{ group }}
                className="h-11 rounded-xl bg-surface border border-border text-xs sm:text-sm hover:border-primary/40 transition inline-flex items-center justify-center gap-1.5">
                Switch
              </Link>
              <button onClick={streaming ? stopLive : startInference}
                className="col-span-2 h-12 rounded-xl bg-gradient-primary text-white text-sm font-semibold shadow-[0_10px_30px_-10px_var(--glow)] hover:brightness-110 transition inline-flex items-center justify-center gap-2">
                {streaming ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {streaming ? "Pause Recording" : "Start Recording"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Stat({ icon: Icon, value, label }: { icon: typeof Activity; value: React.ReactNode; label: string }) {
  return (
    <div className="card-elevated p-3 text-center">
      <Icon className="h-4 w-4 mx-auto text-primary" />
      <p className="text-lg font-semibold mt-1 leading-tight">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}
