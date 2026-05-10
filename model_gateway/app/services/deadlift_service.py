from __future__ import annotations

import base64
from dataclasses import dataclass, field
from io import BytesIO
import logging
from threading import Lock
from typing import Any
from uuid import uuid4

import numpy as np

from app.core.config import Settings, get_settings

logger = logging.getLogger(__name__)

DEADLIFT_SELECTED_LANDMARKS = (
    "left_shoulder",
    "left_elbow",
    "left_wrist",
    "left_hip",
    "left_knee",
    "left_ankle",
    "left_heel",
    "left_foot",
    "right_shoulder",
    "right_elbow",
    "right_wrist",
    "right_hip",
    "right_knee",
    "right_ankle",
    "right_heel",
    "right_foot",
)
MAX_POSE_IMAGE_DIMENSION = 640


@dataclass
class DeadliftSessionState:
    phase: str = "WAIT_FOR_HINGE"
    hinge_count: int = 0
    top_count: int = 0
    bottom_seen: bool = False
    frame_buffer: list[dict[str, Any]] = field(default_factory=list)
    rep_count: int = 0
    correct_reps: int = 0
    incorrect_reps: int = 0
    last_feedback: str = "Use a side view and keep your full body visible."

    @property
    def stage(self) -> str:
        return "HINGE DOWN" if self.phase == "WAIT_FOR_HINGE" else "STAND TALL"


class DeadliftService:
    """Rule-based real-time deadlift form analysis based on deadlift/infer.py."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.sessions: dict[str, DeadliftSessionState] = {}
        self._pose: Any | None = None
        self._pose_landmarks: tuple[Any, ...] | None = None
        self._pose_lock = Lock()
        self._session_lock = Lock()

    def load(self) -> None:
        self._get_pose()

    @property
    def is_loaded(self) -> bool:
        return self._pose is not None

    def health(self) -> dict[str, Any]:
        return {
            "loaded": self.is_loaded,
            "active_sessions": len(self.sessions),
            "landmarks": DEADLIFT_SELECTED_LANDMARKS,
            "thresholds": {
                "visibility": self.settings.deadlift_visibility_threshold,
                "correct_ratio": self.settings.deadlift_correct_ratio_required,
                "start_hip_angle": self.settings.deadlift_start_hip_angle,
                "bottom_hip_angle": self.settings.deadlift_bottom_hip_angle,
                "top_hip_angle": self.settings.deadlift_top_hip_angle,
                "min_frames": self.settings.deadlift_min_frames,
                "min_rep_frames": self.settings.deadlift_min_rep_frames,
                "back_min_angle": self.settings.deadlift_back_min_angle,
                "hip_min_angle": self.settings.deadlift_hip_min_angle,
                "hip_max_angle": self.settings.deadlift_hip_max_angle,
                "knee_min_angle": self.settings.deadlift_knee_min_angle,
                "knee_max_angle": self.settings.deadlift_knee_max_angle,
            },
        }

    def create_session(self) -> str:
        session_id = str(uuid4())
        with self._session_lock:
            self.sessions[session_id] = DeadliftSessionState()
        logger.info("Created deadlift inference session %s", session_id)
        return session_id

    def reset_session(self, session_id: str) -> DeadliftSessionState:
        with self._session_lock:
            state = DeadliftSessionState()
            self.sessions[session_id] = state
        logger.info("Reset deadlift inference session %s", session_id)
        return state

    def delete_session(self, session_id: str) -> bool:
        with self._session_lock:
            existed = self.sessions.pop(session_id, None) is not None
        if existed:
            logger.info("Deleted deadlift inference session %s", session_id)
        return existed

    def process_image_frame(self, session_id: str, image_base64: str) -> dict[str, Any]:
        self.load()
        state = self._get_session(session_id)
        frame = self._decode_image(image_base64)
        landmarks, pose_detected, raw_landmarks = self._extract_landmarks_from_image(frame)
        if not pose_detected or raw_landmarks is None:
            state.last_feedback = "Keep your full body visible from a side view."
            return self._frame_response(
                session_id=session_id,
                state=state,
                status="no_pose_detected",
                is_correct=False,
                feedback=state.last_feedback,
                landmarks=None,
                angle=None,
                details=None,
                rep_completed=False,
            )

        analysis = self.analyze_deadlift(raw_landmarks)
        if analysis["valid"]:
            return self._process_analysis(session_id, state, landmarks, analysis)

        if state.phase == "RECORD_REP":
            state.frame_buffer.append(analysis)
        state.last_feedback = str(analysis["reason"])
        return self._frame_response(
            session_id=session_id,
            state=state,
            status="pose_not_clear",
            is_correct=False,
            feedback=state.last_feedback,
            landmarks=landmarks,
            angle=None,
            details=analysis,
            rep_completed=False,
        )

    def _process_analysis(
        self,
        session_id: str,
        state: DeadliftSessionState,
        landmarks: np.ndarray,
        analysis: dict[str, Any],
    ) -> dict[str, Any]:
        hip_angle = float(analysis["hip_angle"])
        feedback = ", ".join(analysis["reasons"][:2])
        state.last_feedback = feedback
        rep_completed = False
        prediction = None
        status = "tracking"
        is_correct = False

        if state.phase == "WAIT_FOR_HINGE":
            state.frame_buffer = []
            state.bottom_seen = False
            state.top_count = 0
            if hip_angle <= self.settings.deadlift_start_hip_angle:
                state.hinge_count += 1
                if state.hinge_count >= self.settings.deadlift_min_frames:
                    state.phase = "RECORD_REP"
                    state.frame_buffer = [analysis]
                    state.bottom_seen = hip_angle <= self.settings.deadlift_bottom_hip_angle
                    state.hinge_count = 0
                    status = "hinge_detected"
            else:
                state.hinge_count = 0
                feedback = "Start from standing, then hinge at the hips."
                state.last_feedback = feedback
            return self._frame_response(
                session_id=session_id,
                state=state,
                status=status,
                is_correct=False,
                feedback=feedback,
                landmarks=landmarks,
                angle=hip_angle,
                details=analysis,
                rep_completed=False,
            )

        state.frame_buffer.append(analysis)
        if hip_angle <= self.settings.deadlift_bottom_hip_angle:
            state.bottom_seen = True

        if state.bottom_seen and hip_angle >= self.settings.deadlift_top_hip_angle:
            state.top_count += 1
            if state.top_count >= self.settings.deadlift_min_frames:
                rep_completed = True
                if len(state.frame_buffer) >= self.settings.deadlift_min_rep_frames:
                    prediction = self._score_rep(state.frame_buffer)
                    is_correct = prediction["label"] == "correct"
                    state.rep_count += 1
                    if is_correct:
                        state.correct_reps += 1
                    else:
                        state.incorrect_reps += 1
                    feedback = str(prediction["reason"])
                    status = "rep_completed"
                    logger.info(
                        "Deadlift rep completed session=%s rep=%s label=%s reason=%s",
                        session_id,
                        state.rep_count,
                        prediction["label"],
                        prediction["reason"],
                    )
                else:
                    prediction = {"label": "incorrect", "reason": "Rep too short"}
                    state.rep_count += 1
                    state.incorrect_reps += 1
                    feedback = "Rep too short"
                    status = "rep_too_short"

                state.phase = "WAIT_FOR_HINGE"
                state.frame_buffer = []
                state.bottom_seen = False
                state.top_count = 0
                state.hinge_count = 0
        else:
            state.top_count = 0
            if not state.bottom_seen:
                feedback = "Hinge lower before standing tall."

        state.last_feedback = feedback
        return self._frame_response(
            session_id=session_id,
            state=state,
            status=status,
            is_correct=is_correct,
            feedback=feedback,
            landmarks=landmarks,
            angle=hip_angle,
            details={**analysis, "rep_prediction": prediction} if prediction else analysis,
            rep_completed=rep_completed,
        )

    def _score_rep(self, frame_buffer: list[dict[str, Any]]) -> dict[str, Any]:
        valid_frames = [frame for frame in frame_buffer if frame.get("valid")]
        if len(valid_frames) < self.settings.deadlift_min_rep_frames:
            return {"label": "incorrect", "reason": "Body not clearly visible"}

        correct_ratio = sum(1 for frame in valid_frames if frame["is_correct"]) / len(valid_frames)
        back_angles = np.asarray([float(frame["back_angle"]) for frame in valid_frames], dtype=np.float32)
        min_hip_angle = min(float(frame["hip_angle"]) for frame in valid_frames)
        max_hip_angle = max(float(frame["hip_angle"]) for frame in valid_frames)
        min_knee_angle = min(float(frame["knee_angle"]) for frame in valid_frames)
        max_knee_angle = max(float(frame["knee_angle"]) for frame in valid_frames)
        weak_back_ratio = float(np.mean(back_angles < self.settings.deadlift_back_min_angle))
        low_back_angle = float(np.percentile(back_angles, 20))

        reasons: list[str] = []
        if weak_back_ratio > 0.35:
            reasons.append("Keep your back neutral")
        if min_hip_angle > self.settings.deadlift_bottom_hip_angle + 10:
            reasons.append("Hinge lower at the hips")
        if max_hip_angle < self.settings.deadlift_top_hip_angle:
            reasons.append("Stand tall at the top")
        if min_knee_angle < self.settings.deadlift_knee_min_angle:
            reasons.append("Knees bending too much")
        if correct_ratio < 0.35 and not reasons:
            common_reasons: list[str] = []
            for frame in valid_frames:
                common_reasons.extend(str(reason) for reason in frame.get("reasons", []) if reason != "Good form")
            if common_reasons:
                reasons.append(max(set(common_reasons), key=common_reasons.count))

        return {
            "label": "incorrect" if reasons else "correct",
            "reason": ", ".join(dict.fromkeys(reasons[:2])) if reasons else "Good form",
            "correct_ratio": round(correct_ratio, 3),
            "low_back_angle": round(low_back_angle, 2),
            "weak_back_ratio": round(weak_back_ratio, 3),
            "min_hip_angle": round(min_hip_angle, 2),
            "max_hip_angle": round(max_hip_angle, 2),
            "min_knee_angle": round(min_knee_angle, 2),
            "max_knee_angle": round(max_knee_angle, 2),
        }

    def analyze_deadlift(self, landmarks: Any) -> dict[str, Any]:
        side = self._choose_best_side(landmarks)
        lm = self._get_side_landmarks(landmarks, side)
        required_points = [lm["shoulder"], lm["hip"], lm["knee"], lm["ankle"], lm["foot"]]

        if not all(self._is_visible(point) for point in required_points):
            return {
                "valid": False,
                "status": "Pose not clear",
                "reason": "Keep shoulder, hip, knee, ankle, and foot visible.",
                "side": side,
            }

        shoulder = lm["shoulder"]
        hip = lm["hip"]
        knee = lm["knee"]
        ankle = lm["ankle"]
        foot = lm["foot"]
        back_angle = self._calculate_back_angle(shoulder, hip)
        hip_angle = self._calculate_angle(self._point_xy(shoulder), self._point_xy(hip), self._point_xy(knee))
        knee_angle = self._calculate_angle(self._point_xy(hip), self._point_xy(knee), self._point_xy(ankle))
        shoulder_hip_x_diff = abs(shoulder["x"] - hip["x"])
        knee_foot_x_diff = abs(knee["x"] - foot["x"])

        back_ok = back_angle >= self.settings.deadlift_back_min_angle
        hip_ok = self.settings.deadlift_hip_min_angle <= hip_angle <= 182
        knee_ok = knee_angle >= self.settings.deadlift_knee_min_angle
        shoulder_hip_ok = shoulder_hip_x_diff <= self.settings.deadlift_shoulder_hip_x_tolerance
        knee_foot_ok = knee_foot_x_diff <= self.settings.deadlift_knee_foot_x_tolerance
        checks = {
            "Back neutral": back_ok,
            "Hip hinge": hip_ok,
            "Knee angle": knee_ok,
            "Shoulders controlled": shoulder_hip_ok,
            "Knees near feet": knee_foot_ok,
        }
        passed_checks = sum(1 for value in checks.values() if value)
        is_correct = back_ok and hip_ok and knee_ok and passed_checks >= 4
        reasons: list[str] = []
        if not back_ok:
            reasons.append("Keep your back neutral")
        if not hip_ok:
            reasons.append("Hips too low" if hip_angle < self.settings.deadlift_hip_min_angle else "Use more hip hinge")
        if not knee_ok:
            reasons.append("Knees bending too much")
        if not shoulder_hip_ok:
            reasons.append("Keep shoulders controlled over hips")
        if not knee_foot_ok:
            reasons.append("Keep knees aligned with feet")
        return {
            "valid": True,
            "is_correct": is_correct,
            "status": "Correct Deadlift" if is_correct else "Incorrect Deadlift",
            "side": side,
            "checks": checks,
            "passed_checks": passed_checks,
            "total_checks": len(checks),
            "reasons": reasons or ["Good form"],
            "back_angle": round(back_angle, 2),
            "hip_angle": round(hip_angle, 2),
            "knee_angle": round(knee_angle, 2),
        }

    def _frame_response(
        self,
        session_id: str,
        state: DeadliftSessionState,
        status: str,
        is_correct: bool,
        feedback: str,
        landmarks: np.ndarray | None,
        angle: float | None,
        details: dict[str, Any] | None,
        rep_completed: bool,
    ) -> dict[str, Any]:
        return {
            "session_id": session_id,
            "status": status,
            "phase": state.phase,
            "stage": state.stage,
            "angle": round(float(angle), 2) if angle is not None else None,
            "rep_completed": rep_completed,
            "rep_count": state.rep_count,
            "correct_reps": state.correct_reps,
            "incorrect_reps": state.incorrect_reps,
            "buffered_frames": len(state.frame_buffer),
            "prediction": {
                "label": "correct" if is_correct else "incorrect",
                "reason": feedback,
                "details": details,
            },
            "feedback": feedback,
            "landmarks": self._landmarks_to_dict(landmarks),
        }

    def _get_session(self, session_id: str) -> DeadliftSessionState:
        with self._session_lock:
            state = self.sessions.get(session_id)
        if state is None:
            raise KeyError(f"Unknown deadlift session_id: {session_id}")
        return state

    @staticmethod
    def _calculate_angle(a: list[float], b: list[float], c: list[float]) -> float:
        a_array = np.array(a, dtype=np.float32)
        b_array = np.array(b, dtype=np.float32)
        c_array = np.array(c, dtype=np.float32)
        ba = a_array - b_array
        bc = c_array - b_array
        denominator = np.linalg.norm(ba) * np.linalg.norm(bc)
        if denominator < 1e-8:
            return 0.0
        cosine_angle = np.dot(ba, bc) / denominator
        return float(np.degrees(np.arccos(np.clip(cosine_angle, -1.0, 1.0))))

    @staticmethod
    def _calculate_back_angle(shoulder: dict[str, float], hip: dict[str, float]) -> float:
        dx = shoulder["x"] - hip["x"]
        dy = shoulder["y"] - hip["y"]
        angle_from_vertical = abs(np.degrees(np.arctan2(dx, dy)))
        return float(180 - angle_from_vertical)

    def _choose_best_side(self, landmarks: Any) -> str:
        _, mp = self._import_vision_runtime()
        landmark = mp.solutions.pose.PoseLandmark
        left_points = [
            self._get_landmark(landmarks, landmark.LEFT_SHOULDER),
            self._get_landmark(landmarks, landmark.LEFT_HIP),
            self._get_landmark(landmarks, landmark.LEFT_KNEE),
            self._get_landmark(landmarks, landmark.LEFT_ANKLE),
            self._get_landmark(landmarks, landmark.LEFT_HEEL),
            self._get_landmark(landmarks, landmark.LEFT_FOOT_INDEX),
        ]
        right_points = [
            self._get_landmark(landmarks, landmark.RIGHT_SHOULDER),
            self._get_landmark(landmarks, landmark.RIGHT_HIP),
            self._get_landmark(landmarks, landmark.RIGHT_KNEE),
            self._get_landmark(landmarks, landmark.RIGHT_ANKLE),
            self._get_landmark(landmarks, landmark.RIGHT_HEEL),
            self._get_landmark(landmarks, landmark.RIGHT_FOOT_INDEX),
        ]
        return "left" if self._average_visibility(left_points) >= self._average_visibility(right_points) else "right"

    def _get_side_landmarks(self, landmarks: Any, side: str) -> dict[str, dict[str, float]]:
        _, mp = self._import_vision_runtime()
        landmark = mp.solutions.pose.PoseLandmark
        if side == "left":
            return {
                "shoulder": self._get_landmark(landmarks, landmark.LEFT_SHOULDER),
                "hip": self._get_landmark(landmarks, landmark.LEFT_HIP),
                "knee": self._get_landmark(landmarks, landmark.LEFT_KNEE),
                "ankle": self._get_landmark(landmarks, landmark.LEFT_ANKLE),
                "heel": self._get_landmark(landmarks, landmark.LEFT_HEEL),
                "foot": self._get_landmark(landmarks, landmark.LEFT_FOOT_INDEX),
            }
        return {
            "shoulder": self._get_landmark(landmarks, landmark.RIGHT_SHOULDER),
            "hip": self._get_landmark(landmarks, landmark.RIGHT_HIP),
            "knee": self._get_landmark(landmarks, landmark.RIGHT_KNEE),
            "ankle": self._get_landmark(landmarks, landmark.RIGHT_ANKLE),
            "heel": self._get_landmark(landmarks, landmark.RIGHT_HEEL),
            "foot": self._get_landmark(landmarks, landmark.RIGHT_FOOT_INDEX),
        }

    @staticmethod
    def _get_landmark(landmarks: Any, landmark_enum: Any) -> dict[str, float]:
        point = landmarks[landmark_enum.value]
        return {"x": float(point.x), "y": float(point.y), "visibility": float(point.visibility)}

    def _is_visible(self, point: dict[str, float]) -> bool:
        return point["visibility"] >= self.settings.deadlift_visibility_threshold

    @staticmethod
    def _point_xy(point: dict[str, float]) -> list[float]:
        return [point["x"], point["y"]]

    @staticmethod
    def _average_visibility(points: list[dict[str, float]]) -> float:
        return sum(point["visibility"] for point in points) / len(points)

    @staticmethod
    def _landmarks_to_dict(landmarks: np.ndarray | None) -> list[dict[str, float | str]] | None:
        if landmarks is None:
            return None
        return [
            {
                "name": name,
                "x": round(float(point[0]), 5),
                "y": round(float(point[1]), 5),
                "z": round(float(point[2]), 5),
                "visibility": round(float(point[3]), 5),
            }
            for name, point in zip(DEADLIFT_SELECTED_LANDMARKS, landmarks)
        ]

    def _decode_image(self, image_base64: str) -> np.ndarray:
        try:
            encoded = image_base64.split(",", 1)[1] if "," in image_base64 else image_base64
            image_bytes = base64.b64decode(encoded, validate=True)
        except (ValueError, IndexError) as exc:
            raise ValueError("image_base64 must contain valid base64 image data") from exc

        cv2, _ = self._import_vision_runtime()
        try:
            from PIL import Image, ImageOps

            with Image.open(BytesIO(image_bytes)) as pil_image:
                pil_image = ImageOps.exif_transpose(pil_image).convert("RGB")
                image_rgb = np.asarray(pil_image)
            return cv2.cvtColor(image_rgb, cv2.COLOR_RGB2BGR)
        except Exception:
            buffer = np.frombuffer(image_bytes, dtype=np.uint8)
            image = cv2.imdecode(buffer, cv2.IMREAD_COLOR)
            if image is None:
                raise ValueError("image_base64 could not be decoded as an image")
            return image

    def _extract_landmarks_from_image(self, image_bgr: np.ndarray) -> tuple[np.ndarray, bool, Any | None]:
        cv2, _ = self._import_vision_runtime()
        pose = self._get_pose()
        height, width = image_bgr.shape[:2]
        max_dimension = max(width, height)
        if max_dimension > MAX_POSE_IMAGE_DIMENSION:
            scale = MAX_POSE_IMAGE_DIMENSION / max_dimension
            image_bgr = cv2.resize(
                image_bgr,
                (int(width * scale), int(height * scale)),
                interpolation=cv2.INTER_AREA,
            )
        image_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
        image_rgb.flags.writeable = False
        with self._pose_lock:
            results = pose.process(image_rgb)

        if not results.pose_landmarks:
            return np.zeros((len(DEADLIFT_SELECTED_LANDMARKS), 4), dtype=np.float32), False, None

        selected_landmarks = self._get_pose_landmarks()
        raw_landmarks = results.pose_landmarks.landmark
        landmarks = np.asarray(
            [
                [
                    raw_landmarks[landmark].x,
                    raw_landmarks[landmark].y,
                    raw_landmarks[landmark].z,
                    raw_landmarks[landmark].visibility,
                ]
                for landmark in selected_landmarks
            ],
            dtype=np.float32,
        )
        return landmarks, True, raw_landmarks

    def _get_pose(self) -> Any:
        if self._pose is None:
            _, mp = self._import_vision_runtime()
            self._pose = mp.solutions.pose.Pose(
                min_detection_confidence=0.6,
                min_tracking_confidence=0.6,
            )
        return self._pose

    def _get_pose_landmarks(self) -> tuple[Any, ...]:
        if self._pose_landmarks is None:
            _, mp = self._import_vision_runtime()
            landmark = mp.solutions.pose.PoseLandmark
            self._pose_landmarks = (
                landmark.LEFT_SHOULDER,
                landmark.LEFT_ELBOW,
                landmark.LEFT_WRIST,
                landmark.LEFT_HIP,
                landmark.LEFT_KNEE,
                landmark.LEFT_ANKLE,
                landmark.LEFT_HEEL,
                landmark.LEFT_FOOT_INDEX,
                landmark.RIGHT_SHOULDER,
                landmark.RIGHT_ELBOW,
                landmark.RIGHT_WRIST,
                landmark.RIGHT_HIP,
                landmark.RIGHT_KNEE,
                landmark.RIGHT_ANKLE,
                landmark.RIGHT_HEEL,
                landmark.RIGHT_FOOT_INDEX,
            )
        return self._pose_landmarks

    @staticmethod
    def _import_vision_runtime() -> tuple[Any, Any]:
        try:
            import cv2
            import mediapipe as mp
        except ModuleNotFoundError as exc:
            raise RuntimeError(
                "OpenCV and MediaPipe are required for image-based deadlift inference. "
                "Install model gateway dependencies with: python -m pip install -r "
                "model_gateway/requirements.txt"
            ) from exc
        return cv2, mp


_deadlift_service: DeadliftService | None = None


def get_deadlift_service() -> DeadliftService:
    global _deadlift_service
    if _deadlift_service is None:
        _deadlift_service = DeadliftService(get_settings())
    return _deadlift_service
