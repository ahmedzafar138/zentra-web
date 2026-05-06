import React, { useState, useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { CameraType, CameraView, useCameraPermissions } from 'expo-camera';
import Svg, { Circle, Line } from 'react-native-svg';
import {
  Camera,
  ChevronLeft,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Square,
} from 'lucide-react-native';
import { theme } from '@/constants/theme';
import { getModelGatewayCandidateWebSocketUrls } from '@/lib/modelGatewayApi';

const IS_WEB = Platform.OS === 'web';
const CAMERA_PREVIEW_ASPECT_RATIO = 3 / 4;
const FRAME_CAPTURE_INTERVAL_MS = IS_WEB ? 120 : 180;
const FRAME_CAPTURE_QUALITY = IS_WEB ? 0.35 : 0.18;
const MIN_INFERENCE_FRAME_AREA = IS_WEB ? 480 * 360 : 320 * 240;
const MAX_WEBSOCKET_BUFFERED_BYTES = IS_WEB ? 2_000_000 : 600_000;
const MIN_LANDMARK_VISIBILITY = 0.25;
const GATEWAY_RECONNECT_BASE_DELAY_MS = 750;
const GATEWAY_RECONNECT_MAX_DELAY_MS = 5000;
const GATEWAY_CONNECT_TIMEOUT_MS = 4000;
const BICEP_CURL_WS_PATH = '/api/v1/bicep-curl/ws';

type PoseLandmark = {
  name: string;
  x: number;
  y: number;
  z: number;
  visibility: number;
};

type BicepCurlFrameResponse = {
  type?: string;
  message?: string;
  session_id?: string;
  timestamp_ms?: number;
  status: string;
  angle: number | null;
  correct_reps: number;
  incorrect_reps: number;
  rep_count: number;
  landmarks: PoseLandmark[] | null;
};

type InferenceDiagnostics = {
  captured: number;
  sent: number;
  received: number;
  noPose: number;
  lastFrameBytes: number;
  lastLatencyMs: number | null;
  gateway: string;
};

const LANDMARK_CONNECTIONS = [
  ['right_shoulder', 'right_elbow'],
  ['right_elbow', 'right_wrist'],
  ['right_shoulder', 'right_hip'],
  ['left_shoulder', 'left_elbow'],
  ['left_elbow', 'left_wrist'],
  ['left_shoulder', 'left_hip'],
  ['right_shoulder', 'left_shoulder'],
  ['right_hip', 'left_hip'],
] as const;

export default function LiveFormViewScreen() {
  const params = useLocalSearchParams();
  const exercise = params.exercise as string;
  const [correctReps, setCorrectReps] = useState(0);
  const [incorrectReps, setIncorrectReps] = useState(0);
  const [time, setTime] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<CameraType>('front');
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [webSocketReady, setWebSocketReady] = useState(false);
  const [inferenceStatus, setInferenceStatus] = useState('Camera ready');
  const [inferenceError, setInferenceError] = useState<string | null>(null);
  const [angle, setAngle] = useState<number | null>(null);
  const [poseLandmarks, setPoseLandmarks] = useState<PoseLandmark[]>([]);
  const [pictureSize, setPictureSize] = useState<string | undefined>();
  const [diagnostics, setDiagnostics] = useState<InferenceDiagnostics>({
    captured: 0,
    sent: 0,
    received: 0,
    noPose: 0,
    lastFrameBytes: 0,
    lastLatencyMs: null,
    gateway: '',
  });
  const cameraRef = useRef<CameraView>(null);
  const webSocketRef = useRef<WebSocket | null>(null);
  const captureInFlightRef = useRef(false);
  const inferenceInFlightRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();
  const supportsInference = exercise === 'Bicep Curl';

  useEffect(() => {
    if (cameraPermission && !cameraPermission.granted && cameraPermission.canAskAgain) {
      requestCameraPermission();
    }
  }, [cameraPermission, requestCameraPermission]);

  useEffect(() => {
    if (!isPaused) {
      timerRef.current = setInterval(() => {
        setTime((prev) => prev + 1);
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isPaused]);

  useEffect(() => {
    if (!supportsInference || !cameraPermission?.granted) {
      return;
    }

    let active = true;
    let reconnectAttempt = 0;
    const gatewayUrls = getModelGatewayCandidateWebSocketUrls(BICEP_CURL_WS_PATH);

    const clearReconnectTimer = () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };

    const connect = () => {
      if (!active || !gatewayUrls.length) {
        return;
      }

      const gatewayUrl = gatewayUrls[reconnectAttempt % gatewayUrls.length];
      const socket = new WebSocket(gatewayUrl);
      let sessionStarted = false;
      let connectTimeout: ReturnType<typeof setTimeout> | null = setTimeout(() => {
        if (!sessionStarted && socket.readyState !== WebSocket.CLOSED) {
          setInferenceError('Model gateway did not respond. Trying another address...');
          socket.close();
        }
      }, GATEWAY_CONNECT_TIMEOUT_MS);

      const clearConnectTimeout = () => {
        if (connectTimeout) {
          clearTimeout(connectTimeout);
          connectTimeout = null;
        }
      };

      webSocketRef.current = socket;
      setDiagnostics((current) => ({ ...current, gateway: gatewayUrl }));
      setWebSocketReady(false);
      setInferenceStatus(
        reconnectAttempt === 0 ? 'Connecting to model gateway' : 'Reconnecting to model gateway'
      );
      setInferenceError(null);

      socket.onopen = () => {
        setInferenceStatus('Starting inference session');
      };

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as BicepCurlFrameResponse;

          if (payload.type === 'session_started') {
            sessionStarted = true;
            reconnectAttempt = 0;
            clearConnectTimeout();
            setSessionId(payload.session_id ?? null);
            setWebSocketReady(true);
            setInferenceStatus('Waiting for pose');
            return;
          }

          if (payload.type === 'error') {
            inferenceInFlightRef.current = false;
            setInferenceError(payload.message ?? 'Inference error');
            setInferenceStatus('Inference paused');
            return;
          }

          if (payload.type && payload.type !== 'frame_result') {
            return;
          }

          inferenceInFlightRef.current = false;
          setDiagnostics((current) => ({
            ...current,
            received: current.received + 1,
            noPose: payload.status === 'no_pose_detected' ? current.noPose + 1 : current.noPose,
            lastLatencyMs: payload.timestamp_ms ? Date.now() - payload.timestamp_ms : current.lastLatencyMs,
          }));
          setCorrectReps(payload.correct_reps);
          setIncorrectReps(payload.incorrect_reps);
          setAngle(payload.angle);
          setPoseLandmarks(payload.landmarks ?? []);
          setInferenceStatus(payload.status.replace(/_/g, ' '));
          setInferenceError(null);
        } catch {
          inferenceInFlightRef.current = false;
          setInferenceError('Invalid gateway message');
          setInferenceStatus('Inference paused');
        }
      };

      socket.onerror = () => {
        captureInFlightRef.current = false;
        inferenceInFlightRef.current = false;
        setWebSocketReady(false);
        setInferenceError('Model gateway connection failed. Retrying...');
        setInferenceStatus('Gateway offline');
      };

      socket.onclose = () => {
        clearConnectTimeout();

        if (webSocketRef.current === socket) {
          webSocketRef.current = null;
        }

        captureInFlightRef.current = false;
        inferenceInFlightRef.current = false;
        setWebSocketReady(false);
        setSessionId(null);

        if (!active) {
          return;
        }

        reconnectAttempt += 1;
        const delay = Math.min(
          GATEWAY_RECONNECT_BASE_DELAY_MS * 2 ** Math.min(reconnectAttempt - 1, 3),
          GATEWAY_RECONNECT_MAX_DELAY_MS
        );

        setInferenceStatus('Gateway offline');
        setInferenceError('Trying to reconnect to the model gateway...');
        clearReconnectTimer();
        reconnectTimeoutRef.current = setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      active = false;
      clearReconnectTimer();
      const socket = webSocketRef.current;
      webSocketRef.current = null;
      setWebSocketReady(false);
      setSessionId(null);
      captureInFlightRef.current = false;
      inferenceInFlightRef.current = false;
      if (socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) {
        socket.close();
      }
    };
  }, [cameraPermission?.granted, supportsInference]);

  useEffect(() => {
    if (!supportsInference || !cameraReady || isPaused || !webSocketReady) {
      return;
    }

    let active = true;

    const captureAndSendFrame = async () => {
      const socket = webSocketRef.current;
      if (
        captureInFlightRef.current ||
        inferenceInFlightRef.current ||
        !cameraRef.current ||
        !socket ||
        socket.readyState !== WebSocket.OPEN ||
        socket.bufferedAmount > MAX_WEBSOCKET_BUFFERED_BYTES
      ) {
        return;
      }

      captureInFlightRef.current = true;
      try {
        const photo = await cameraRef.current.takePictureAsync({
          base64: true,
          exif: !IS_WEB,
          quality: FRAME_CAPTURE_QUALITY,
          skipProcessing: !IS_WEB,
          shutterSound: false,
        });

        if (!active || !photo.base64) {
          captureInFlightRef.current = false;
          return;
        }

        setDiagnostics((current) => ({
          ...current,
          captured: current.captured + 1,
          lastFrameBytes: Math.round((photo.base64?.length ?? 0) * 0.75),
        }));
        captureInFlightRef.current = false;
        inferenceInFlightRef.current = true;
        setDiagnostics((current) => ({ ...current, sent: current.sent + 1 }));
        socket.send(
          JSON.stringify({
            type: 'image_frame',
            image_base64: photo.base64,
            timestamp_ms: Date.now(),
          })
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Inference request failed';
        if (active) {
          setInferenceError(message);
          setPoseLandmarks([]);
          setInferenceStatus('Inference paused');
        }
        captureInFlightRef.current = false;
        inferenceInFlightRef.current = false;
      }
    };

    captureAndSendFrame();
    const interval = setInterval(captureAndSendFrame, FRAME_CAPTURE_INTERVAL_MS);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [cameraReady, isPaused, supportsInference, webSocketReady]);

  const handleFlipCamera = () => {
    setCameraReady(false);
    setPictureSize(undefined);
    setCameraFacing((current) => (current === 'front' ? 'back' : 'front'));
  };

  const handlePausePlay = () => {
    setIsPaused(!isPaused);
  };

  const handleStop = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    router.back();
  };

  const handleChange = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    router.back();
    router.back();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const chooseFastPictureSize = (sizes: string[]) => {
    const parsedSizes = sizes
      .map((size) => {
        const [width, height] = size.split('x').map(Number);
        return { size, width, height, area: width * height };
      })
      .filter(({ width, height, area }) => width > 0 && height > 0 && area > 0);

    const landscapeFourThreeSizes = parsedSizes.filter(
      ({ width, height }) => Math.abs(width / height - 4 / 3) < 0.04
    );
    const candidates = landscapeFourThreeSizes.length ? landscapeFourThreeSizes : parsedSizes;
    candidates.sort((a, b) => a.area - b.area);
    return (
      candidates.find(({ area }) => area >= MIN_INFERENCE_FRAME_AREA)?.size ?? candidates[0]?.size
    );
  };

  const handleCameraReady = async () => {
    setCameraReady(true);
    setCameraError(null);

    if (pictureSize || !cameraRef.current) {
      return;
    }

    try {
      const sizes = await cameraRef.current.getAvailablePictureSizesAsync();
      setPictureSize(chooseFastPictureSize(sizes));
    } catch {
      setPictureSize(undefined);
    }
  };

  const renderPoseOverlay = () => {
    if (!poseLandmarks.length) {
      return null;
    }

    const visibleLandmarks = poseLandmarks.filter(
      (landmark) => landmark.visibility >= MIN_LANDMARK_VISIBILITY
    );
    const toPreviewPoint = (landmark: PoseLandmark) => ({
      ...landmark,
      x: cameraFacing === 'front' ? 1 - landmark.x : landmark.x,
    });
    const previewLandmarks = visibleLandmarks.map(toPreviewPoint);
    const landmarkByName = new Map(previewLandmarks.map((landmark) => [landmark.name, landmark]));

    return (
      <Svg style={styles.poseOverlay} viewBox="0 0 1 1" preserveAspectRatio="none">
        {LANDMARK_CONNECTIONS.map(([fromName, toName]) => {
          const from = landmarkByName.get(fromName);
          const to = landmarkByName.get(toName);
          if (!from || !to) {
            return null;
          }

          return (
            <Line
              key={`${fromName}-${toName}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke={theme.colors.primary}
              strokeWidth={0.01}
              strokeLinecap="round"
            />
          );
        })}
        {previewLandmarks.map((landmark) => (
          <Circle
            key={landmark.name}
            cx={landmark.x}
            cy={landmark.y}
            r={0.018}
            fill={theme.colors.white}
            stroke={theme.colors.primary}
            strokeWidth={0.006}
          />
        ))}
      </Svg>
    );
  };

  const renderCameraContent = () => {
    if (!cameraPermission) {
      return (
        <View style={styles.cameraState}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={styles.cameraSubtext}>Checking camera permission</Text>
        </View>
      );
    }

    if (!cameraPermission.granted) {
      return (
        <View style={styles.cameraState}>
          <Camera size={34} color={theme.colors.primary} />
          <Text style={styles.cameraText}>Camera permission needed</Text>
          <Text style={styles.cameraSubtext}>Enable camera access to start form tracking.</Text>
          {cameraPermission.canAskAgain && (
            <TouchableOpacity style={styles.permissionButton} onPress={requestCameraPermission}>
              <Text style={styles.permissionButtonText}>Allow Camera</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }

    return (
      <View style={styles.cameraFrame}>
        <CameraView
          ref={cameraRef}
          style={styles.cameraPreview}
          facing={cameraFacing}
          mode="picture"
          pictureSize={pictureSize}
          animateShutter={false}
          onCameraReady={handleCameraReady}
          onMountError={(event) => {
            setCameraReady(false);
            setCameraError(event.message);
          }}
        />
        {renderPoseOverlay()}

        {!cameraReady && !cameraError && (
          <View style={styles.cameraOverlay}>
            <ActivityIndicator color={theme.colors.primary} />
            <Text style={styles.cameraSubtext}>Starting camera</Text>
          </View>
        )}

        {cameraError && (
          <View style={styles.cameraOverlay}>
            <Text style={styles.cameraText}>Camera could not start</Text>
            <Text style={styles.cameraSubtext}>{cameraError}</Text>
          </View>
        )}

        <View style={styles.cameraTopBar}>
          <Text style={styles.cameraBadgeText}>
            {supportsInference ? inferenceStatus : 'Camera Preview'}
          </Text>
          <TouchableOpacity style={styles.flipButton} onPress={handleFlipCamera}>
            <RotateCcw size={18} color={theme.colors.white} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderInferenceDiagnostics = () => {
    if (!supportsInference) {
      return null;
    }

    return (
      <Text style={styles.diagnosticText}>
        {`Frames ${diagnostics.captured}/${diagnostics.sent}/${diagnostics.received} | no pose ${diagnostics.noPose} | ${
          diagnostics.lastLatencyMs === null ? 'latency --' : `latency ${diagnostics.lastLatencyMs}ms`
        } | ${Math.round(diagnostics.lastFrameBytes / 1024)}KB`}
      </Text>
    );
  };

  return (
    <LinearGradient colors={[theme.colors.background, '#0A0A0A']} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <ChevronLeft size={24} color={theme.colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{exercise}</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.cameraModule}>{renderCameraContent()}</View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.coachPanel}>
            <View style={{ paddingLeft: 10 }}>
              <Text style={styles.coachTitle}>Suggestions for max hypertrophy</Text>
              {renderInferenceDiagnostics()}
              <View style={styles.suggestionItem}>
                <Text style={styles.bullet}>-</Text>
                <Text style={styles.suggestionText}>
                  {supportsInference && angle !== null
                    ? `Current elbow angle: ${angle.toFixed(0)} degrees`
                    : 'Control tempo: 2 seconds down, 1 second up'}
                </Text>
              </View>
              <View style={styles.suggestionItem}>
                <Text style={styles.bullet}>-</Text>
                <Text style={styles.suggestionText}>
                  {inferenceError ?? 'Maintain full range of motion'}
                </Text>
              </View>
              <View style={styles.suggestionItem}>
                <Text style={styles.bullet}>-</Text>
                <Text style={styles.suggestionText}>Keep core engaged throughout</Text>
              </View>
            </View>
          </View>

          <View style={styles.kpiRow}>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Correct Reps</Text>
              <Text style={styles.kpiValue}>{correctReps}</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Incorrect Reps</Text>
              <Text style={[styles.kpiValue, styles.incorrectValue]}>{incorrectReps}</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Time</Text>
              <Text style={styles.kpiValue}>{formatTime(time)}</Text>
            </View>
          </View>

          <View style={styles.controlsRow}>
            <TouchableOpacity style={styles.controlButton} onPress={handlePausePlay}>
              {isPaused ? (
                <Play size={24} color={theme.colors.white} />
              ) : (
                <Pause size={24} color={theme.colors.white} />
              )}
              <Text style={styles.controlButtonText}>{isPaused ? 'Resume' : 'Pause'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.controlButton, styles.primaryControl]} onPress={handleStop}>
              <Square size={24} color={theme.colors.white} />
              <Text style={styles.controlButtonText}>Finish</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.controlButton} onPress={handleChange}>
              <RefreshCw size={24} color={theme.colors.white} />
              <Text style={styles.controlButtonText}>Change</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.white,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  cameraModule: {
    marginBottom: 15,
  },
  cameraFrame: {
    aspectRatio: CAMERA_PREVIEW_ASPECT_RATIO,
    backgroundColor: theme.colors.card,
    overflow: 'hidden',
  },
  cameraPreview: {
    flex: 1,
  },
  poseOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  cameraState: {
    aspectRatio: CAMERA_PREVIEW_ASPECT_RATIO,
    backgroundColor: theme.colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 10,
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(18, 18, 18, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 10,
  },
  cameraTopBar: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cameraBadgeText: {
    color: theme.colors.white,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    borderRadius: theme.borderRadius.sm,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: theme.fontSize.xs,
    fontWeight: '600',
  },
  flipButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraText: {
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.white,
    marginBottom: 8,
    textAlign: 'center',
  },
  cameraSubtext: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.secondary,
    textAlign: 'center',
  },
  permissionButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 18,
    paddingVertical: 12,
    marginTop: 6,
  },
  permissionButtonText: {
    color: theme.colors.white,
    fontSize: theme.fontSize.sm,
    fontWeight: '700',
  },
  coachPanel: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    padding: 8,
    marginBottom: 12,
  },
  coachTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.primary,
    marginBottom: 6,
    marginTop: 3,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  bullet: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.primary,
    marginRight: 6,
    lineHeight: theme.fontSize.sm + 4,
  },
  suggestionText: {
    flex: 1,
    fontSize: theme.fontSize.xs,
    color: theme.colors.secondary,
    lineHeight: theme.fontSize.sm + 4,
  },
  diagnosticText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.secondary,
    lineHeight: theme.fontSize.sm + 4,
    marginBottom: 6,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiLabel: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.secondary,
    marginBottom: 6,
    textAlign: 'center',
  },
  kpiValue: {
    fontSize: theme.fontSize.xl,
    fontWeight: 'bold',
    color: theme.colors.primary,
    lineHeight: theme.fontSize.xl + 4,
    textAlign: 'center',
  },
  incorrectValue: {
    color: '#FF4444',
  },
  controlsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  controlButton: {
    flex: 1,
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.md,
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  primaryControl: {
    backgroundColor: theme.colors.primary,
  },
  controlButtonText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.white,
    fontWeight: '500',
  },
});
