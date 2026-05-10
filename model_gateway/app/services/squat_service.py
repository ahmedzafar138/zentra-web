from __future__ import annotations

import base64
from dataclasses import dataclass, field
from io import BytesIO
import logging
from pathlib import Path
from threading import Lock
import time
from typing import Any
from uuid import uuid4

import numpy as np

from app.core.config import Settings, get_settings

logger = logging.getLogger(__name__)

SQUAT_SELECTED_LANDMARKS = (
    "right_hip",
    "left_hip",
    "right_knee",
    "left_knee",
    "right_ankle",
    "left_ankle",
    "right_shoulder",
    "left_shoulder",
)
FRAME_FEATURES = len(SQUAT_SELECTED_LANDMARKS) * 4
RIGHT_HIP_INDEX = 0
LEFT_HIP_INDEX = 1
RIGHT_KNEE_INDEX = 2
LEFT_KNEE_INDEX = 3
RIGHT_ANKLE_INDEX = 4
LEFT_ANKLE_INDEX = 5
RIGHT_SHOULDER_INDEX = 6
LEFT_SHOULDER_INDEX = 7
MAX_POSE_IMAGE_DIMENSION = 640


@dataclass
class SquatPrediction:
    label: str
    probability: float
    confidence: float
    reason: str


@dataclass
class SquatSessionState:
    phase: str = "WAIT_FOR_BOTTOM"
    down_count: int = 0
    up_count: int = 0
    frame_buffer: list[np.ndarray] = field(default_factory=list)
    rep_count: int = 0
    correct_reps: int = 0
    incorrect_reps: int = 0
    last_prediction: SquatPrediction | None = None
    last_feedback: str = "Show your full body in the webcam frame."

    @property
    def stage(self) -> str:
        return "GO DOWN" if self.phase == "WAIT_FOR_BOTTOM" else "COME UP"


class SquatService:
    """Stateful real-time squat inference based on Squats Inference/squat_infer.py."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.model: Any | None = None
        self.max_len: int | None = None
        self.feature_dim: int | None = None
        self.sessions: dict[str, SquatSessionState] = {}
        self._model_lock = Lock()
        self._pose_lock = Lock()
        self._session_lock = Lock()
        self._pose: Any | None = None
        self._pose_landmarks: tuple[Any, ...] | None = None

    @property
    def is_loaded(self) -> bool:
        return self.model is not None and self.max_len is not None and self.feature_dim is not None

    def load(self) -> None:
        if self.is_loaded:
            logger.info("Squat model already loaded; skipping reload")
            return

        model_path = self.settings.squat_model_path
        self._validate_artifact(model_path, "model")
        started = time.perf_counter()
        tf = self._import_tensorflow()
        logger.info("Loading squat model from %s", model_path)
        self.model = tf.keras.models.load_model(model_path, compile=False, safe_mode=False)
        self.max_len = int(self.model.input_shape[1])
        self.feature_dim = int(self.model.input_shape[2])
        dummy_input = np.zeros((1, self.max_len, self.feature_dim), dtype=np.float32)
        with self._model_lock:
            self.model(dummy_input, training=False)
        logger.info(
            "Squat model ready input_shape=%s in %.2fs",
            self.model.input_shape,
            time.perf_counter() - started,
        )

    def health(self) -> dict[str, Any]:
        return {
            "loaded": self.is_loaded,
            "model_path": str(self.settings.squat_model_path),
            "max_sequence_length": self.max_len,
            "feature_dim": self.feature_dim,
            "active_sessions": len(self.sessions),
            "landmarks": SQUAT_SELECTED_LANDMARKS,
            "frame_features": FRAME_FEATURES,
            "thresholds": {
                "model": self.settings.squat_model_threshold,
                "down": self.settings.squat_down_threshold,
                "end_up": self.settings.squat_end_up_threshold,
                "min_frames": self.settings.squat_min_frames,
                "min_rep_frames": self.settings.squat_min_rep_frames,
            },
        }

    def create_session(self) -> str:
        session_id = str(uuid4())
        with self._session_lock:
            self.sessions[session_id] = SquatSessionState()
        logger.info("Created squat inference session %s", session_id)
        return session_id

    def reset_session(self, session_id: str) -> SquatSessionState:
        with self._session_lock:
            self.sessions[session_id] = SquatSessionState()
            state = self.sessions[session_id]
        logger.info("Reset squat inference session %s", session_id)
        return state

    def delete_session(self, session_id: str) -> bool:
        with self._session_lock:
            existed = self.sessions.pop(session_id, None) is not None
        if existed:
            logger.info("Deleted squat inference session %s", session_id)
        return existed

    def process_frame(self, session_id: str, landmarks: Any) -> dict[str, Any]:
        self._ensure_loaded()
        state = self._get_session(session_id)
        frame = self._normalize_frame(landmarks)
        points = frame.reshape(len(SQUAT_SELECTED_LANDMARKS), 4)
        knee_angle = self.get_knee_angle(points)
        rep_completed = False
        prediction: SquatPrediction | None = None
        status = "tracking"

        if state.phase == "WAIT_FOR_BOTTOM":
            if knee_angle < self.settings.squat_down_threshold:
                state.down_count += 1
                if state.down_count >= self.settings.squat_min_frames:
                    state.phase = "RECORD_UP"
                    state.frame_buffer = []
                    state.up_count = 0
                    state.down_count = 0
                    status = "bottom_position_detected"
            else:
                state.down_count = 0
        else:
            state.frame_buffer.append(frame)
            if knee_angle > self.settings.squat_end_up_threshold:
                state.up_count += 1
                if state.up_count >= self.settings.squat_min_frames:
                    rep_completed = True
                    if len(state.frame_buffer) >= self.settings.squat_min_rep_frames:
                        prediction = self.predict_rep(state.frame_buffer)
                        state.last_prediction = prediction
                        state.last_feedback = prediction.reason
                        state.rep_count += 1
                        if prediction.label == "correct":
                            state.correct_reps += 1
                        else:
                            state.incorrect_reps += 1
                        status = "rep_completed"
                        logger.info(
                            "Squat rep completed session=%s rep=%s label=%s probability=%.4f reason=%s",
                            session_id,
                            state.rep_count,
                            prediction.label,
                            prediction.probability,
                            prediction.reason,
                        )
                    else:
                        state.last_feedback = "Rep too short"
                        status = "rep_too_short"

                    state.phase = "WAIT_FOR_BOTTOM"
                    state.frame_buffer = []
                    state.up_count = 0
                    state.down_count = 0
            else:
                state.up_count = 0

        return self._frame_response(session_id, state, knee_angle, status, rep_completed, prediction, points)

    def process_image_frame(self, session_id: str, image_base64: str) -> dict[str, Any]:
        self._ensure_loaded()
        frame = self._decode_image(image_base64)
        landmarks, pose_detected = self._extract_landmarks_from_image(frame)
        response = self.process_frame(session_id, landmarks)
        if not pose_detected:
            response["status"] = "no_pose_detected"
            response["landmarks"] = None
            response["feedback"] = "Show your full body in the camera."
        return response

    def predict_rep(self, frames: list[Any]) -> SquatPrediction:
        self._ensure_loaded()
        normalized_frames = [self._normalize_frame(frame) for frame in frames]
        pad_sequences = self._import_pad_sequences()
        sequence = pad_sequences(
            [normalized_frames],
            maxlen=self.max_len,
            dtype="float32",
            padding="post",
        )
        with self._model_lock:
            probability = float(self.model(sequence, training=False).numpy()[0][0])

        rules_passed, reason = self.validate_squat_rules(normalized_frames)
        label = "correct" if probability >= self.settings.squat_model_threshold and rules_passed else "incorrect"
        confidence = probability if label == "correct" else 1.0 - probability
        return SquatPrediction(label=label, probability=probability, confidence=confidence, reason=reason)

    def validate_squat_rules(self, frames: list[np.ndarray]) -> tuple[bool, str]:
        sequence = np.asarray(frames, dtype=np.float32).reshape(-1, len(SQUAT_SELECTED_LANDMARKS), 4)
        knee_angles: list[float] = []
        torso_angles: list[float] = []
        visibility_scores: list[float] = []
        knee_diffs: list[float] = []

        for frame in sequence:
            right_knee_angle = self.calculate_angle(
                frame[RIGHT_HIP_INDEX],
                frame[RIGHT_KNEE_INDEX],
                frame[RIGHT_ANKLE_INDEX],
            )
            left_knee_angle = self.calculate_angle(
                frame[LEFT_HIP_INDEX],
                frame[LEFT_KNEE_INDEX],
                frame[LEFT_ANKLE_INDEX],
            )
            knee_angles.append((right_knee_angle + left_knee_angle) / 2)
            knee_diffs.append(abs(right_knee_angle - left_knee_angle))
            torso_angles.append(self.get_torso_lean_angle(frame))
            visibility_scores.extend(float(point[3]) for point in frame)

        min_knee_angle = min(knee_angles)
        max_knee_angle = max(knee_angles)
        knee_range = max_knee_angle - min_knee_angle
        avg_visibility = float(np.mean(visibility_scores))
        max_torso_lean = max(torso_angles)
        max_knee_imbalance = max(knee_diffs)

        if avg_visibility < self.settings.squat_rule_min_visibility:
            return False, "Body not clearly visible"
        if min_knee_angle > self.settings.squat_rule_min_depth_angle:
            return False, "Not deep enough"
        if max_knee_angle < self.settings.squat_rule_return_standing_angle:
            return False, "Did not return to standing"
        if knee_range < self.settings.squat_rule_min_knee_range:
            return False, "Movement range too small"
        if max_torso_lean > self.settings.squat_rule_max_torso_lean:
            return False, "Too much torso lean"
        if max_knee_imbalance > self.settings.squat_rule_max_knee_imbalance:
            return False, "Left/right leg imbalance"
        return True, "Good form"

    def get_knee_angle(self, keypoints: np.ndarray) -> float:
        right_angle = self.calculate_angle(
            keypoints[RIGHT_HIP_INDEX],
            keypoints[RIGHT_KNEE_INDEX],
            keypoints[RIGHT_ANKLE_INDEX],
        )
        left_angle = self.calculate_angle(
            keypoints[LEFT_HIP_INDEX],
            keypoints[LEFT_KNEE_INDEX],
            keypoints[LEFT_ANKLE_INDEX],
        )
        return (right_angle + left_angle) / 2

    def get_torso_lean_angle(self, frame: np.ndarray) -> float:
        mid_hip = (frame[RIGHT_HIP_INDEX][:2] + frame[LEFT_HIP_INDEX][:2]) / 2
        mid_shoulder = (frame[RIGHT_SHOULDER_INDEX][:2] + frame[LEFT_SHOULDER_INDEX][:2]) / 2
        torso_vector = mid_shoulder - mid_hip
        vertical_vector = np.array([0.0, -1.0], dtype=np.float32)
        denominator = np.linalg.norm(torso_vector) * np.linalg.norm(vertical_vector)
        if denominator < 1e-6:
            return 90.0
        cosine_angle = np.dot(torso_vector, vertical_vector) / denominator
        return float(np.degrees(np.arccos(np.clip(cosine_angle, -1.0, 1.0))))

    @staticmethod
    def calculate_angle(a: np.ndarray, b: np.ndarray, c: np.ndarray) -> float:
        a = np.array(a[:2], dtype=np.float32)
        b = np.array(b[:2], dtype=np.float32)
        c = np.array(c[:2], dtype=np.float32)
        ba = a - b
        bc = c - b
        denominator = np.linalg.norm(ba) * np.linalg.norm(bc)
        if denominator < 1e-6:
            return 0.0
        cosine_angle = np.dot(ba, bc) / denominator
        return float(np.degrees(np.arccos(np.clip(cosine_angle, -1.0, 1.0))))

    def _frame_response(
        self,
        session_id: str,
        state: SquatSessionState,
        angle: float | None,
        status: str,
        rep_completed: bool,
        prediction: SquatPrediction | None,
        landmarks: np.ndarray | None = None,
    ) -> dict[str, Any]:
        return {
            "session_id": session_id,
            "status": status,
            "phase": state.phase,
            "stage": state.stage,
            "angle": round(angle, 2) if angle is not None else None,
            "rep_completed": rep_completed,
            "rep_count": state.rep_count,
            "correct_reps": state.correct_reps,
            "incorrect_reps": state.incorrect_reps,
            "buffered_frames": len(state.frame_buffer),
            "prediction": self._prediction_to_dict(prediction),
            "last_prediction": self._prediction_to_dict(state.last_prediction),
            "feedback": state.last_feedback,
            "landmarks": self._landmarks_to_dict(landmarks),
        }

    def _normalize_frame(self, landmarks: Any) -> np.ndarray:
        frame = np.asarray(landmarks, dtype=np.float32)
        if frame.shape == (len(SQUAT_SELECTED_LANDMARKS), 4):
            return frame.reshape(FRAME_FEATURES)
        if frame.shape == (FRAME_FEATURES,):
            return frame
        raise ValueError(
            "Squat landmarks must be 8 landmarks shaped [x,y,z,visibility] "
            f"or a flat {FRAME_FEATURES}-value array."
        )

    def _get_session(self, session_id: str) -> SquatSessionState:
        with self._session_lock:
            state = self.sessions.get(session_id)
        if state is None:
            raise KeyError(f"Unknown squat session_id: {session_id}")
        return state

    def _ensure_loaded(self) -> None:
        if not self.is_loaded:
            raise RuntimeError("Squat model is not loaded")

    @staticmethod
    def _prediction_to_dict(prediction: SquatPrediction | None) -> dict[str, Any] | None:
        if prediction is None:
            return None
        return {
            "label": prediction.label,
            "probability": round(prediction.probability, 4),
            "confidence": round(prediction.confidence, 4),
            "reason": prediction.reason,
        }

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
            for name, point in zip(SQUAT_SELECTED_LANDMARKS, landmarks)
        ]

    @staticmethod
    def _validate_artifact(path: Path, name: str) -> None:
        if not path.exists():
            raise FileNotFoundError(f"Squat {name} file not found: {path}")

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

    def _extract_landmarks_from_image(self, image_bgr: np.ndarray) -> tuple[list[list[float]], bool]:
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
            return [[0.0] * 4 for _ in SQUAT_SELECTED_LANDMARKS], False

        selected_landmarks = self._get_pose_landmarks()
        landmarks = results.pose_landmarks.landmark
        return (
            [
                [
                    landmarks[landmark].x,
                    landmarks[landmark].y,
                    landmarks[landmark].z,
                    landmarks[landmark].visibility,
                ]
                for landmark in selected_landmarks
            ],
            True,
        )

    def _get_pose(self) -> Any:
        if self._pose is None:
            _, mp = self._import_vision_runtime()
            self._pose = mp.solutions.pose.Pose(
                min_detection_confidence=0.5,
                min_tracking_confidence=0.5,
            )
        return self._pose

    def _get_pose_landmarks(self) -> tuple[Any, ...]:
        if self._pose_landmarks is None:
            _, mp = self._import_vision_runtime()
            pose_landmark = mp.solutions.pose.PoseLandmark
            self._pose_landmarks = (
                pose_landmark.RIGHT_HIP,
                pose_landmark.LEFT_HIP,
                pose_landmark.RIGHT_KNEE,
                pose_landmark.LEFT_KNEE,
                pose_landmark.RIGHT_ANKLE,
                pose_landmark.LEFT_ANKLE,
                pose_landmark.RIGHT_SHOULDER,
                pose_landmark.LEFT_SHOULDER,
            )
        return self._pose_landmarks

    @staticmethod
    def _import_vision_runtime() -> tuple[Any, Any]:
        try:
            import cv2
            import mediapipe as mp
        except ModuleNotFoundError as exc:
            raise RuntimeError(
                "OpenCV and MediaPipe are required for image-based squat inference. "
                "Install model gateway dependencies with: python -m pip install -r "
                "model_gateway/requirements.txt"
            ) from exc
        return cv2, mp

    @staticmethod
    def _import_tensorflow() -> Any:
        try:
            import tensorflow as tf
        except ModuleNotFoundError as exc:
            raise RuntimeError(
                "TensorFlow is required for squat inference. Install model gateway "
                "dependencies with: python -m pip install -r model_gateway/requirements.txt"
            ) from exc
        except (ImportError, OSError) as exc:
            raise RuntimeError(
                "TensorFlow is installed but its native Windows runtime could not load."
            ) from exc
        return tf

    @staticmethod
    def _import_pad_sequences() -> Any:
        try:
            from tensorflow.keras.preprocessing.sequence import pad_sequences
        except ModuleNotFoundError as exc:
            raise RuntimeError("TensorFlow/Keras is required for squat sequence padding.") from exc
        return pad_sequences


_squat_service: SquatService | None = None


def get_squat_service() -> SquatService:
    global _squat_service
    if _squat_service is None:
        _squat_service = SquatService(get_settings())
    return _squat_service
