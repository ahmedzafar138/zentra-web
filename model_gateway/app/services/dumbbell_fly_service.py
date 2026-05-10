from __future__ import annotations

import base64
from dataclasses import dataclass, field
from io import BytesIO
import logging
from pathlib import Path
from threading import Lock
from typing import Any
from uuid import uuid4

import numpy as np

from app.core.config import Settings, get_settings

logger = logging.getLogger(__name__)

DUMBBELL_FLY_SELECTED_LANDMARKS = (
    "right_shoulder",
    "left_shoulder",
    "right_elbow",
    "left_elbow",
    "right_wrist",
    "left_wrist",
)
MAX_POSE_IMAGE_DIMENSION = 640
WAIT_OPEN = 0
WAIT_CLOSE = 1
RECORD_RETURN_OPEN = 2


@dataclass
class DumbbellFlySessionState:
    phase: int = WAIT_OPEN
    frame_buffer: list[np.ndarray] = field(default_factory=list)
    open_count: int = 0
    close_count: int = 0
    missing_count: int = 0
    min_distance_seen: float = 999.0
    max_distance_seen: float = -999.0
    rep_count: int = 0
    correct_reps: int = 0
    incorrect_reps: int = 0
    last_prediction: dict[str, Any] | None = None
    last_feedback: str = "Start with arms open and keep shoulders, elbows, and wrists visible."

    @property
    def phase_name(self) -> str:
        if self.phase == WAIT_OPEN:
            return "WAITING FOR OPEN"
        if self.phase == WAIT_CLOSE:
            return "CLOSING"
        return "RETURNING OPEN"


class DumbbellFlyService:
    """Stateful Dumbbell Flyes inference based on dumbellfly/inference.py."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.model: Any | None = None
        self._pose: Any | None = None
        self.sessions: dict[str, DumbbellFlySessionState] = {}
        self._model_lock = Lock()
        self._pose_lock = Lock()
        self._session_lock = Lock()
        self._tf: Any | None = None
        self._pad_sequences: Any | None = None

    def load(self) -> None:
        if self.model is not None:
            return
        self._validate_artifact(self.settings.dumbbell_fly_model_path, "model")
        tf, _ = self._import_tf_runtime()
        logger.info("Loading dumbbell fly model from %s", self.settings.dumbbell_fly_model_path)
        self._patch_keras_quantization_config(tf)
        with self._model_lock:
            if self.model is None:
                self.model = tf.keras.models.load_model(
                    self.settings.dumbbell_fly_model_path,
                    custom_objects={"Orthogonal": tf.keras.initializers.Orthogonal},
                    compile=False,
                )
        self._get_pose()

    @property
    def is_loaded(self) -> bool:
        return self.model is not None

    def health(self) -> dict[str, Any]:
        return {
            "loaded": self.is_loaded,
            "model_path": str(self.settings.dumbbell_fly_model_path),
            "max_sequence_length": self.settings.dumbbell_fly_max_sequence_length,
            "feature_dim": len(DUMBBELL_FLY_SELECTED_LANDMARKS) * 4,
            "active_sessions": len(self.sessions),
            "landmarks": DUMBBELL_FLY_SELECTED_LANDMARKS,
            "close_threshold": self.settings.dumbbell_fly_close_threshold,
            "open_threshold": self.settings.dumbbell_fly_open_threshold,
        }

    def create_session(self) -> str:
        session_id = str(uuid4())
        with self._session_lock:
            self.sessions[session_id] = DumbbellFlySessionState()
        logger.info("Created dumbbell fly inference session %s", session_id)
        return session_id

    def reset_session(self, session_id: str) -> DumbbellFlySessionState:
        with self._session_lock:
            state = DumbbellFlySessionState()
            self.sessions[session_id] = state
        logger.info("Reset dumbbell fly inference session %s", session_id)
        return state

    def delete_session(self, session_id: str) -> bool:
        with self._session_lock:
            existed = self.sessions.pop(session_id, None) is not None
        if existed:
            logger.info("Deleted dumbbell fly inference session %s", session_id)
        return existed

    def process_image_frame(self, session_id: str, image_base64: str) -> dict[str, Any]:
        self.load()
        state = self._get_session(session_id)
        frame = self._decode_image(image_base64)
        landmarks, pose_detected = self._extract_landmarks_from_image(frame)

        if not pose_detected or landmarks is None:
            state.missing_count += 1
            if state.phase != WAIT_OPEN and state.missing_count >= self.settings.dumbbell_fly_min_frames:
                self._reset_rep_state(state)
            state.last_feedback = "Keep your upper body visible in the camera."
            return self._frame_response(session_id, state, "no_pose_detected", None, None, landmarks)

        state.missing_count = 0
        wrist_distance = self._get_normalized_wrist_distance(landmarks)
        if wrist_distance is None:
            state.last_feedback = "Keep both shoulders and wrists visible."
            return self._frame_response(session_id, state, "pose_not_clear", None, None, landmarks)

        status = "tracking"
        rep_completed = False
        feature_vector = landmarks.flatten().astype(np.float32)
        state.min_distance_seen = min(state.min_distance_seen, wrist_distance)
        state.max_distance_seen = max(state.max_distance_seen, wrist_distance)

        if state.phase == WAIT_OPEN:
            if wrist_distance > self.settings.dumbbell_fly_open_threshold:
                state.open_count += 1
                if state.open_count >= self.settings.dumbbell_fly_min_frames:
                    state.phase = WAIT_CLOSE
                    state.close_count = 0
                    status = "open_position_detected"
                    state.last_feedback = "Now bring the dumbbells together under control."
            else:
                state.open_count = 0
                state.last_feedback = "Open your arms wider to start the fly."

        elif state.phase == WAIT_CLOSE:
            if wrist_distance < self.settings.dumbbell_fly_close_threshold:
                state.close_count += 1
                if state.close_count >= self.settings.dumbbell_fly_min_frames:
                    state.phase = RECORD_RETURN_OPEN
                    state.frame_buffer = [feature_vector]
                    state.open_count = 0
                    status = "closed_position_detected"
                    state.last_feedback = "Good. Return to the open position with control."
            else:
                state.close_count = 0
                state.last_feedback = "Bring the wrists closer together before returning."

        elif state.phase == RECORD_RETURN_OPEN:
            state.frame_buffer.append(feature_vector)
            if wrist_distance > self.settings.dumbbell_fly_open_threshold:
                state.open_count += 1
                if state.open_count >= self.settings.dumbbell_fly_min_frames:
                    prediction = self._complete_rep(state)
                    rep_completed = prediction is not None
                    status = "rep_completed" if rep_completed else "rep_discarded"
            else:
                state.open_count = 0
                state.last_feedback = "Keep opening until you return to the start."

        return self._frame_response(
            session_id,
            state,
            status,
            wrist_distance,
            state.last_prediction if rep_completed else None,
            landmarks,
            rep_completed=rep_completed,
        )

    def _complete_rep(self, state: DumbbellFlySessionState) -> dict[str, Any] | None:
        if len(state.frame_buffer) <= self.settings.dumbbell_fly_min_rep_frames:
            state.last_feedback = "Rep was too short. Use a fuller open-close-open range."
            self._reset_rep_state(state)
            return None

        _, pad_sequences = self._import_tf_runtime()
        sequence = pad_sequences(
            [state.frame_buffer],
            maxlen=self.settings.dumbbell_fly_max_sequence_length,
            dtype="float32",
            padding="post",
        )
        with self._model_lock:
            prediction_value = float(self.model.predict(sequence, verbose=0)[0][0])

        is_correct = prediction_value > self.settings.dumbbell_fly_prediction_threshold
        result = {
            "label": "CORRECT" if is_correct else "INCORRECT",
            "confidence": round(prediction_value if is_correct else 1.0 - prediction_value, 4),
            "score": round(prediction_value, 4),
            "min_wrist_distance": round(float(state.min_distance_seen), 3),
            "max_wrist_distance": round(float(state.max_distance_seen), 3),
        }
        state.last_prediction = result
        state.rep_count += 1
        if is_correct:
            state.correct_reps += 1
            state.last_feedback = "Correct fly rep. Keep that same controlled path."
        else:
            state.incorrect_reps += 1
            state.last_feedback = "Incorrect fly rep. Keep the wrists controlled and complete the full range."
        self._reset_rep_state(state)
        return result

    @staticmethod
    def _reset_rep_state(state: DumbbellFlySessionState) -> None:
        state.phase = WAIT_OPEN
        state.frame_buffer = []
        state.open_count = 0
        state.close_count = 0
        state.missing_count = 0
        state.min_distance_seen = 999.0
        state.max_distance_seen = -999.0

    def _frame_response(
        self,
        session_id: str,
        state: DumbbellFlySessionState,
        status: str,
        wrist_distance: float | None,
        prediction: dict[str, Any] | None,
        landmarks: np.ndarray | None,
        rep_completed: bool = False,
    ) -> dict[str, Any]:
        active_prediction = prediction or state.last_prediction
        label = str(active_prediction.get("label", "tracking")).lower() if active_prediction else "tracking"
        return {
            "session_id": session_id,
            "status": status,
            "phase": state.phase_name,
            "stage": state.phase_name,
            "angle": None,
            "wrist_distance": round(float(wrist_distance), 3) if wrist_distance is not None else None,
            "rep_completed": rep_completed,
            "rep_count": state.rep_count,
            "correct_reps": state.correct_reps,
            "incorrect_reps": state.incorrect_reps,
            "buffered_frames": len(state.frame_buffer),
            "prediction": {
                "label": label,
                "reason": state.last_feedback,
                "details": active_prediction,
            },
            "feedback": state.last_feedback,
            "landmarks": self._landmarks_to_dict(landmarks),
        }

    def _get_session(self, session_id: str) -> DumbbellFlySessionState:
        with self._session_lock:
            state = self.sessions.get(session_id)
        if state is None:
            raise KeyError(f"Unknown dumbbell fly session_id: {session_id}")
        return state

    @staticmethod
    def _get_normalized_wrist_distance(landmarks: np.ndarray) -> float | None:
        right_shoulder = landmarks[0][:2]
        left_shoulder = landmarks[1][:2]
        right_wrist = landmarks[4][:2]
        left_wrist = landmarks[5][:2]
        shoulder_distance = float(np.linalg.norm(right_shoulder - left_shoulder))
        if shoulder_distance <= 1e-6:
            return None
        wrist_distance = float(np.linalg.norm(right_wrist - left_wrist))
        return wrist_distance / shoulder_distance

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
            for name, point in zip(DUMBBELL_FLY_SELECTED_LANDMARKS, landmarks)
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

    def _extract_landmarks_from_image(self, image_bgr: np.ndarray) -> tuple[np.ndarray | None, bool]:
        cv2, mp = self._import_vision_runtime()
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
            return None, False
        pose_landmark = mp.solutions.pose.PoseLandmark
        points = []
        for name in DUMBBELL_FLY_SELECTED_LANDMARKS:
            landmark = results.pose_landmarks.landmark[getattr(pose_landmark, name.upper()).value]
            points.append([landmark.x, landmark.y, landmark.z, landmark.visibility])
        return np.array(points, dtype=np.float32), True

    def _get_pose(self) -> Any:
        if self._pose is None:
            _, mp = self._import_vision_runtime()
            self._pose = mp.solutions.pose.Pose(
                min_detection_confidence=0.5,
                min_tracking_confidence=0.5,
            )
        return self._pose

    def _import_tf_runtime(self) -> tuple[Any, Any]:
        if self._tf is None or self._pad_sequences is None:
            try:
                import tensorflow as tf
                from tensorflow.keras.preprocessing.sequence import pad_sequences
            except ModuleNotFoundError as exc:
                raise RuntimeError(
                    "TensorFlow is required for dumbbell fly inference. Install model gateway "
                    "dependencies with: python -m pip install -r model_gateway/requirements.txt"
                ) from exc
            self._tf = tf
            self._pad_sequences = pad_sequences
        return self._tf, self._pad_sequences

    @staticmethod
    def _patch_keras_quantization_config(tf: Any) -> None:
        layer_cls = tf.keras.layers.Layer
        if getattr(layer_cls, "_zentra_dumbbell_quantization_patch", False):
            return
        original_init = layer_cls.__init__

        def patched_init(self: Any, *args: Any, **kwargs: Any) -> None:
            kwargs.pop("quantization_config", None)
            original_init(self, *args, **kwargs)

        layer_cls.__init__ = patched_init
        layer_cls._zentra_dumbbell_quantization_patch = True

    @staticmethod
    def _validate_artifact(path: Path, name: str) -> None:
        if not path.exists():
            raise FileNotFoundError(f"Dumbbell fly {name} file not found: {path}")

    @staticmethod
    def _import_vision_runtime() -> tuple[Any, Any]:
        try:
            import cv2
            import mediapipe as mp
        except ModuleNotFoundError as exc:
            raise RuntimeError(
                "OpenCV and MediaPipe are required for image-based dumbbell fly inference. "
                "Install model gateway dependencies with: python -m pip install -r "
                "model_gateway/requirements.txt"
            ) from exc
        return cv2, mp


_dumbbell_fly_service: DumbbellFlyService | None = None


def get_dumbbell_fly_service() -> DumbbellFlyService:
    global _dumbbell_fly_service
    if _dumbbell_fly_service is None:
        _dumbbell_fly_service = DumbbellFlyService(get_settings())
    return _dumbbell_fly_service
