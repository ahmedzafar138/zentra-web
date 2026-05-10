from __future__ import annotations

import base64
from dataclasses import dataclass, field
from importlib import util
from io import BytesIO
import logging
from pathlib import Path
from threading import Lock
from types import ModuleType
from typing import Any
from uuid import uuid4

import numpy as np

from app.core.config import Settings, get_settings

logger = logging.getLogger(__name__)

PUSHUP_SELECTED_LANDMARKS = (
    "nose",
    "left_shoulder",
    "right_shoulder",
    "left_elbow",
    "right_elbow",
    "left_wrist",
    "right_wrist",
    "left_hip",
    "right_hip",
    "left_knee",
    "right_knee",
    "left_ankle",
    "right_ankle",
)
MAX_POSE_IMAGE_DIMENSION = 640
WAIT_TOP = 0
WAIT_BOTTOM = 1
WAIT_RETURN_TOP = 2


@dataclass
class PushupSessionState:
    phase: int = WAIT_TOP
    frame_buffer: list[np.ndarray] = field(default_factory=list)
    angle_buffer: list[float] = field(default_factory=list)
    view_buffer: list[str] = field(default_factory=list)
    ratio_buffer: list[float] = field(default_factory=list)
    top_count: int = 0
    bottom_count: int = 0
    missing_count: int = 0
    min_elbow_seen: float = 999.0
    max_elbow_seen: float = -999.0
    rep_count: int = 0
    correct_reps: int = 0
    incorrect_reps: int = 0
    incorrect_view_reps: int = 0
    last_prediction: dict[str, Any] | None = None
    last_feedback: str = "Use a side camera angle and keep your full body visible."

    @property
    def phase_name(self) -> str:
        if self.phase == WAIT_TOP:
            return "WAITING FOR TOP"
        if self.phase == WAIT_BOTTOM:
            return "GOING DOWN"
        return "RETURNING TOP"


class PushupService:
    """Stateful push-up inference based on Pushups Inference/pushup_inference.py."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.model: Any | None = None
        self.scaler: Any | None = None
        self.training_info: dict[str, Any] | None = None
        self._module: ModuleType | None = None
        self._pose: Any | None = None
        self.sessions: dict[str, PushupSessionState] = {}
        self._model_lock = Lock()
        self._pose_lock = Lock()
        self._session_lock = Lock()

    def load(self) -> None:
        if self.model is not None and self.scaler is not None and self.training_info is not None:
            return
        module = self._get_module()
        logger.info("Loading push-up model from %s", self.settings.pushup_model_path)
        self._validate_artifact(self.settings.pushup_model_path, "model")
        self._validate_artifact(self.settings.pushup_scaler_path, "scaler")
        self._validate_artifact(self.settings.pushup_info_path, "training info")
        self._patch_keras_quantization_config()
        with self._model_lock:
            if self.model is None or self.scaler is None or self.training_info is None:
                self.model, self.scaler, self.training_info = module.load_inference_assets(
                    self.settings.pushup_model_path,
                    self.settings.pushup_scaler_path,
                    self.settings.pushup_info_path,
                )
        self._get_pose()

    @property
    def is_loaded(self) -> bool:
        return self.model is not None and self.scaler is not None and self.training_info is not None

    def health(self) -> dict[str, Any]:
        return {
            "loaded": self.is_loaded,
            "model_path": str(self.settings.pushup_model_path),
            "scaler_path": str(self.settings.pushup_scaler_path),
            "info_path": str(self.settings.pushup_info_path),
            "max_sequence_length": int(self.training_info["max_len"]) if self.training_info else None,
            "feature_dim": int(self.training_info["feature_dim"]) if self.training_info else None,
            "active_sessions": len(self.sessions),
            "landmarks": PUSHUP_SELECTED_LANDMARKS,
        }

    def create_session(self) -> str:
        session_id = str(uuid4())
        with self._session_lock:
            self.sessions[session_id] = PushupSessionState()
        logger.info("Created push-up inference session %s", session_id)
        return session_id

    def reset_session(self, session_id: str) -> PushupSessionState:
        with self._session_lock:
            state = PushupSessionState()
            self.sessions[session_id] = state
        logger.info("Reset push-up inference session %s", session_id)
        return state

    def delete_session(self, session_id: str) -> bool:
        with self._session_lock:
            existed = self.sessions.pop(session_id, None) is not None
        if existed:
            logger.info("Deleted push-up inference session %s", session_id)
        return existed

    def process_image_frame(self, session_id: str, image_base64: str) -> dict[str, Any]:
        self.load()
        module = self._get_module()
        state = self._get_session(session_id)
        frame = self._decode_image(image_base64)
        landmarks, pose_detected = self._extract_landmarks_from_image(frame)

        if not pose_detected or landmarks is None:
            state.missing_count += 1
            if state.phase != WAIT_TOP and state.missing_count >= module.MAX_MISSING_FRAMES:
                self._reset_rep_state(state)
            state.last_feedback = "Keep your full body visible from a side view."
            return self._frame_response(session_id, state, "no_pose_detected", None, None, landmarks)

        state.missing_count = 0
        camera_view, camera_ratio = module.estimate_camera_view(landmarks)
        active_elbow_angle, _, _ = module.get_active_elbow_angle(landmarks)
        if active_elbow_angle is None:
            state.last_feedback = "Keep shoulders, elbows, and wrists visible."
            return self._frame_response(session_id, state, "pose_not_clear", None, None, landmarks)

        feature_vector = module.build_feature_vector(landmarks)
        status = "tracking"
        rep_completed = False

        if state.phase == WAIT_TOP:
            if active_elbow_angle >= module.TOP_THRESHOLD:
                state.top_count += 1
                if state.top_count >= module.MIN_FRAMES_IN_STATE:
                    state.phase = WAIT_BOTTOM
                    state.frame_buffer = [feature_vector]
                    state.angle_buffer = [active_elbow_angle]
                    state.view_buffer = [camera_view]
                    state.ratio_buffer = [camera_ratio]
                    state.min_elbow_seen = active_elbow_angle
                    state.max_elbow_seen = active_elbow_angle
                    state.bottom_count = 0
                    status = "top_position_detected"
            else:
                state.top_count = 0
                state.last_feedback = "Start at the top with arms extended."

        elif state.phase in {WAIT_BOTTOM, WAIT_RETURN_TOP}:
            state.frame_buffer.append(feature_vector)
            state.angle_buffer.append(active_elbow_angle)
            state.view_buffer.append(camera_view)
            state.ratio_buffer.append(camera_ratio)
            state.min_elbow_seen = min(state.min_elbow_seen, active_elbow_angle)
            state.max_elbow_seen = max(state.max_elbow_seen, active_elbow_angle)

            if len(state.frame_buffer) > module.MAX_REP_FRAMES:
                self._reset_rep_state(state)
                state.last_feedback = "Rep took too long. Reset and try again."
                return self._frame_response(session_id, state, "rep_too_long", active_elbow_angle, None, landmarks)

        if state.phase == WAIT_BOTTOM:
            if active_elbow_angle <= module.BOTTOM_THRESHOLD:
                state.bottom_count += 1
                if state.bottom_count >= module.MIN_FRAMES_IN_STATE:
                    state.phase = WAIT_RETURN_TOP
                    state.bottom_count = 0
                    state.top_count = 0
                    status = "bottom_position_detected"
            else:
                state.bottom_count = 0
                state.last_feedback = "Lower your chest toward the floor."

        elif state.phase == WAIT_RETURN_TOP:
            if active_elbow_angle >= module.TOP_THRESHOLD:
                state.top_count += 1
                if state.top_count >= module.MIN_FRAMES_IN_STATE:
                    prediction = self._complete_rep(module, state)
                    rep_completed = prediction is not None
                    status = "rep_completed" if rep_completed else "rep_discarded"
            else:
                state.top_count = 0
                state.last_feedback = "Push back to the top."

        return self._frame_response(
            session_id,
            state,
            status,
            active_elbow_angle,
            state.last_prediction if rep_completed else None,
            landmarks,
            rep_completed=rep_completed,
        )

    def _complete_rep(self, module: ModuleType, state: PushupSessionState) -> dict[str, Any] | None:
        elbow_rom = state.max_elbow_seen - state.min_elbow_seen
        trimmed_frames, _ = module.trim_rep_frames(state.frame_buffer, state.angle_buffer)
        rep_camera_view, rep_camera_ratio = module.get_majority_view(state.view_buffer, state.ratio_buffer)

        if len(trimmed_frames) < module.MIN_REP_FRAMES or elbow_rom < module.MIN_ELBOW_ROM:
            state.last_feedback = f"Rep too short or range too small. ROM: {elbow_rom:.1f}"
            self._reset_rep_state(state)
            return None

        with self._model_lock:
            result = module.predict_rep(
                model=self.model,
                scaler=self.scaler,
                training_info=self.training_info,
                rep_frames=np.array(trimmed_frames, dtype=np.float32),
            )
        result = module.apply_rule_override(
            result=result,
            min_elbow_angle=state.min_elbow_seen,
            elbow_rom=elbow_rom,
            camera_view=rep_camera_view,
        )
        result["elbow_rom"] = round(float(elbow_rom), 2)
        result["min_elbow_angle"] = round(float(state.min_elbow_seen), 2)
        result["camera_view"] = rep_camera_view
        result["camera_ratio"] = round(float(rep_camera_ratio), 3)
        state.last_prediction = result
        state.rep_count += 1
        if result["label"] == "CORRECT":
            state.correct_reps += 1
        else:
            state.incorrect_reps += 1
        state.last_feedback = str(result.get("reason", result["label"]))
        self._reset_rep_state(state)
        return result

    @staticmethod
    def _reset_rep_state(state: PushupSessionState) -> None:
        state.phase = WAIT_TOP
        state.frame_buffer = []
        state.angle_buffer = []
        state.view_buffer = []
        state.ratio_buffer = []
        state.top_count = 0
        state.bottom_count = 0
        state.missing_count = 0
        state.min_elbow_seen = 999.0
        state.max_elbow_seen = -999.0

    def _frame_response(
        self,
        session_id: str,
        state: PushupSessionState,
        status: str,
        angle: float | None,
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
            "angle": round(float(angle), 2) if angle is not None else None,
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

    def _get_session(self, session_id: str) -> PushupSessionState:
        with self._session_lock:
            state = self.sessions.get(session_id)
        if state is None:
            raise KeyError(f"Unknown push-up session_id: {session_id}")
        return state

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
            for name, point in zip(PUSHUP_SELECTED_LANDMARKS, landmarks)
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
            return None, False
        module = self._get_module()
        return module.extract_raw_landmarks(results), True

    def _get_pose(self) -> Any:
        if self._pose is None:
            _, mp = self._import_vision_runtime()
            self._pose = mp.solutions.pose.Pose(
                min_detection_confidence=0.5,
                min_tracking_confidence=0.5,
            )
        return self._pose

    def _get_module(self) -> ModuleType:
        if self._module is None:
            module_path = self.settings.pushup_model_path.parent / "pushup_inference.py"
            spec = util.spec_from_file_location("zentra_pushup_inference", module_path)
            if spec is None or spec.loader is None:
                raise RuntimeError(f"Unable to import push-up inference module: {module_path}")
            module = util.module_from_spec(spec)
            spec.loader.exec_module(module)
            self._module = module
        return self._module

    @staticmethod
    def _patch_keras_quantization_config() -> None:
        try:
            from keras.src.layers.core.dense import Dense
        except Exception:
            return

        if getattr(Dense, "_zentra_quantization_patch", False):
            return

        original_from_config = Dense.from_config

        def from_config_without_quantization(config: dict[str, Any]) -> Any:
            clean_config = dict(config)
            clean_config.pop("quantization_config", None)
            return original_from_config(clean_config)

        Dense.from_config = classmethod(lambda cls, config: from_config_without_quantization(config))
        Dense._zentra_quantization_patch = True

    @staticmethod
    def _validate_artifact(path: Path, name: str) -> None:
        if not path.exists():
            raise FileNotFoundError(f"Push-up {name} file not found: {path}")

    @staticmethod
    def _import_vision_runtime() -> tuple[Any, Any]:
        try:
            import cv2
            import mediapipe as mp
        except ModuleNotFoundError as exc:
            raise RuntimeError(
                "OpenCV and MediaPipe are required for image-based push-up inference. "
                "Install model gateway dependencies with: python -m pip install -r "
                "model_gateway/requirements.txt"
            ) from exc
        return cv2, mp


_pushup_service: PushupService | None = None


def get_pushup_service() -> PushupService:
    global _pushup_service
    if _pushup_service is None:
        _pushup_service = PushupService(get_settings())
    return _pushup_service
