from __future__ import annotations

import base64
from collections import deque
from dataclasses import dataclass, field
from io import BytesIO
import logging
from threading import Lock
from typing import Any
from uuid import uuid4

import numpy as np

from app.core.config import Settings, get_settings

logger = logging.getLogger(__name__)

PLANK_SELECTED_LANDMARKS = (
    "left_ear",
    "left_shoulder",
    "left_elbow",
    "left_wrist",
    "left_hip",
    "left_knee",
    "left_ankle",
    "right_ear",
    "right_shoulder",
    "right_elbow",
    "right_wrist",
    "right_hip",
    "right_knee",
    "right_ankle",
)
MAX_POSE_IMAGE_DIMENSION = 640


@dataclass
class PlankSessionState:
    prediction_buffer: deque[int] = field(default_factory=deque)
    correct_frames: int = 0
    incorrect_frames: int = 0
    last_feedback: str = "Use a side view and keep your full body visible."


class PlankService:
    """Rule-based real-time plank form analysis based on plank/infer.py."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.sessions: dict[str, PlankSessionState] = {}
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
            "landmarks": PLANK_SELECTED_LANDMARKS,
            "thresholds": {
                "visibility": self.settings.plank_visibility_threshold,
                "body_alignment_min": self.settings.plank_body_alignment_min,
                "body_alignment_max": self.settings.plank_body_alignment_max,
                "torso_alignment_min": self.settings.plank_torso_alignment_min,
                "leg_alignment_min": self.settings.plank_leg_alignment_min,
                "elbow_min": self.settings.plank_elbow_min,
                "elbow_max": self.settings.plank_elbow_max,
                "correct_ratio": self.settings.plank_correct_ratio_required,
            },
        }

    def create_session(self) -> str:
        session_id = str(uuid4())
        with self._session_lock:
            state = PlankSessionState()
            state.prediction_buffer = deque(maxlen=self.settings.plank_smoothing_window)
            self.sessions[session_id] = state
        logger.info("Created plank inference session %s", session_id)
        return session_id

    def reset_session(self, session_id: str) -> PlankSessionState:
        with self._session_lock:
            state = PlankSessionState()
            state.prediction_buffer = deque(maxlen=self.settings.plank_smoothing_window)
            self.sessions[session_id] = state
        logger.info("Reset plank inference session %s", session_id)
        return state

    def delete_session(self, session_id: str) -> bool:
        with self._session_lock:
            existed = self.sessions.pop(session_id, None) is not None
        if existed:
            logger.info("Deleted plank inference session %s", session_id)
        return existed

    def process_image_frame(self, session_id: str, image_base64: str) -> dict[str, Any]:
        self.load()
        state = self._get_session(session_id)
        frame = self._decode_image(image_base64)
        landmarks, pose_detected, raw_landmarks = self._extract_landmarks_from_image(frame)
        if not pose_detected or raw_landmarks is None:
            state.prediction_buffer.clear()
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
            )

        analysis = self.analyze_plank(raw_landmarks)
        if analysis["valid"]:
            state.prediction_buffer.append(1 if analysis["is_correct"] else 0)
            correct_ratio = sum(state.prediction_buffer) / len(state.prediction_buffer)
            smoothed_correct = correct_ratio >= self.settings.plank_correct_ratio_required
            if smoothed_correct:
                state.correct_frames += 1
            else:
                state.incorrect_frames += 1
            feedback = ", ".join(analysis["reasons"][:2])
            state.last_feedback = feedback
            return self._frame_response(
                session_id=session_id,
                state=state,
                status="tracking",
                is_correct=smoothed_correct,
                feedback=feedback,
                landmarks=landmarks,
                angle=analysis.get("body_angle"),
                details={**analysis, "correct_ratio": round(correct_ratio, 3)},
            )

        state.prediction_buffer.clear()
        state.incorrect_frames += 1
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
        )

    def analyze_plank(self, landmarks: Any) -> dict[str, Any]:
        side = self._choose_best_side(landmarks)
        lm = self._get_side_landmarks(landmarks, side)
        required_points = [lm["shoulder"], lm["elbow"], lm["wrist"], lm["hip"], lm["knee"], lm["ankle"]]

        if not all(self._is_visible(point) for point in required_points):
            return {
                "valid": False,
                "status": "Pose not clear",
                "side": side,
                "reason": "Make sure shoulder, elbow, wrist, hip, knee, and ankle are visible.",
            }

        shoulder = lm["shoulder"]
        elbow = lm["elbow"]
        wrist = lm["wrist"]
        hip = lm["hip"]
        knee = lm["knee"]
        ankle = lm["ankle"]
        ear = lm["ear"]

        body_angle = self._calculate_angle(self._point_xy(shoulder), self._point_xy(hip), self._point_xy(ankle))
        torso_angle = self._calculate_angle(self._point_xy(shoulder), self._point_xy(hip), self._point_xy(knee))
        leg_angle = self._calculate_angle(self._point_xy(hip), self._point_xy(knee), self._point_xy(ankle))
        elbow_angle = self._calculate_angle(self._point_xy(shoulder), self._point_xy(elbow), self._point_xy(wrist))
        shoulder_elbow_x_diff = abs(shoulder["x"] - elbow["x"])
        hip_line_offset = self._hip_offset_from_body_line(shoulder, hip, ankle)
        head_angle = (
            self._calculate_angle(self._point_xy(ear), self._point_xy(shoulder), self._point_xy(hip))
            if self._is_visible(ear)
            else None
        )

        body_ok = self.settings.plank_body_alignment_min <= body_angle <= self.settings.plank_body_alignment_max
        torso_ok = torso_angle >= self.settings.plank_torso_alignment_min
        leg_ok = leg_angle >= self.settings.plank_leg_alignment_min
        elbow_ok = self.settings.plank_elbow_min <= elbow_angle <= self.settings.plank_elbow_max
        shoulder_elbow_ok = shoulder_elbow_x_diff <= self.settings.plank_shoulder_elbow_x_tolerance
        hip_line_ok = abs(hip_line_offset) <= self.settings.plank_hip_line_offset_tolerance
        head_ok = True if head_angle is None else head_angle >= self.settings.plank_head_alignment_min

        checks = {
            "Body straight": body_ok,
            "Torso aligned": torso_ok,
            "Legs straight": leg_ok,
            "Elbow angle": elbow_ok,
            "Shoulder over elbow": shoulder_elbow_ok,
            "Hip on body line": hip_line_ok,
            "Head neutral": head_ok,
        }
        passed_checks = sum(1 for value in checks.values() if value)
        is_correct = body_ok and torso_ok and leg_ok and hip_line_ok and passed_checks >= 5

        reasons: list[str] = []
        if not body_ok or not hip_line_ok:
            if hip_line_offset < -self.settings.plank_hip_line_offset_tolerance:
                reasons.append("Hips too high")
            elif hip_line_offset > self.settings.plank_hip_line_offset_tolerance:
                reasons.append("Hips dropping")
            else:
                reasons.append("Body line not straight")
        if not leg_ok:
            reasons.append("Legs not straight")
        if not elbow_ok:
            reasons.append("Elbow angle not around 90 degrees")
        if not shoulder_elbow_ok:
            reasons.append("Elbow not under shoulder")
        if not head_ok:
            reasons.append("Neck/head not aligned")

        return {
            "valid": True,
            "side": side,
            "is_correct": is_correct,
            "status": "Correct Plank" if is_correct else "Incorrect Plank",
            "body_angle": round(body_angle, 2),
            "torso_angle": round(torso_angle, 2),
            "leg_angle": round(leg_angle, 2),
            "elbow_angle": round(elbow_angle, 2),
            "head_angle": round(head_angle, 2) if head_angle is not None else None,
            "shoulder_elbow_x_diff": round(shoulder_elbow_x_diff, 4),
            "hip_line_offset": round(hip_line_offset, 4),
            "checks": checks,
            "passed_checks": passed_checks,
            "total_checks": len(checks),
            "reasons": reasons or ["Good form"],
        }

    def _frame_response(
        self,
        session_id: str,
        state: PlankSessionState,
        status: str,
        is_correct: bool,
        feedback: str,
        landmarks: np.ndarray | None,
        angle: float | None,
        details: dict[str, Any] | None,
    ) -> dict[str, Any]:
        return {
            "session_id": session_id,
            "status": status,
            "phase": "tracking",
            "stage": "HOLD",
            "angle": round(float(angle), 2) if angle is not None else None,
            "rep_completed": False,
            "rep_count": 0,
            "correct_reps": state.correct_frames,
            "incorrect_reps": state.incorrect_frames,
            "prediction": {
                "label": "correct" if is_correct else "incorrect",
                "reason": feedback,
                "details": details,
            },
            "feedback": feedback,
            "landmarks": self._landmarks_to_dict(landmarks),
        }

    def _get_session(self, session_id: str) -> PlankSessionState:
        with self._session_lock:
            state = self.sessions.get(session_id)
        if state is None:
            raise KeyError(f"Unknown plank session_id: {session_id}")
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
    def _hip_offset_from_body_line(shoulder: dict[str, float], hip: dict[str, float], ankle: dict[str, float]) -> float:
        sx, sy = shoulder["x"], shoulder["y"]
        hx, hy = hip["x"], hip["y"]
        ax, ay = ankle["x"], ankle["y"]
        if abs(ax - sx) < 1e-6:
            return 0.0
        line_y_at_hip = sy + ((ay - sy) * (hx - sx) / (ax - sx))
        return float(hy - line_y_at_hip)

    def _choose_best_side(self, landmarks: Any) -> str:
        _, mp = self._import_vision_runtime()
        landmark = mp.solutions.pose.PoseLandmark
        left_points = [
            self._get_landmark(landmarks, landmark.LEFT_SHOULDER),
            self._get_landmark(landmarks, landmark.LEFT_ELBOW),
            self._get_landmark(landmarks, landmark.LEFT_WRIST),
            self._get_landmark(landmarks, landmark.LEFT_HIP),
            self._get_landmark(landmarks, landmark.LEFT_KNEE),
            self._get_landmark(landmarks, landmark.LEFT_ANKLE),
            self._get_landmark(landmarks, landmark.LEFT_EAR),
        ]
        right_points = [
            self._get_landmark(landmarks, landmark.RIGHT_SHOULDER),
            self._get_landmark(landmarks, landmark.RIGHT_ELBOW),
            self._get_landmark(landmarks, landmark.RIGHT_WRIST),
            self._get_landmark(landmarks, landmark.RIGHT_HIP),
            self._get_landmark(landmarks, landmark.RIGHT_KNEE),
            self._get_landmark(landmarks, landmark.RIGHT_ANKLE),
            self._get_landmark(landmarks, landmark.RIGHT_EAR),
        ]
        return "left" if self._average_visibility(left_points) >= self._average_visibility(right_points) else "right"

    def _get_side_landmarks(self, landmarks: Any, side: str) -> dict[str, dict[str, float]]:
        _, mp = self._import_vision_runtime()
        landmark = mp.solutions.pose.PoseLandmark
        if side == "left":
            return {
                "ear": self._get_landmark(landmarks, landmark.LEFT_EAR),
                "shoulder": self._get_landmark(landmarks, landmark.LEFT_SHOULDER),
                "elbow": self._get_landmark(landmarks, landmark.LEFT_ELBOW),
                "wrist": self._get_landmark(landmarks, landmark.LEFT_WRIST),
                "hip": self._get_landmark(landmarks, landmark.LEFT_HIP),
                "knee": self._get_landmark(landmarks, landmark.LEFT_KNEE),
                "ankle": self._get_landmark(landmarks, landmark.LEFT_ANKLE),
            }
        return {
            "ear": self._get_landmark(landmarks, landmark.RIGHT_EAR),
            "shoulder": self._get_landmark(landmarks, landmark.RIGHT_SHOULDER),
            "elbow": self._get_landmark(landmarks, landmark.RIGHT_ELBOW),
            "wrist": self._get_landmark(landmarks, landmark.RIGHT_WRIST),
            "hip": self._get_landmark(landmarks, landmark.RIGHT_HIP),
            "knee": self._get_landmark(landmarks, landmark.RIGHT_KNEE),
            "ankle": self._get_landmark(landmarks, landmark.RIGHT_ANKLE),
        }

    @staticmethod
    def _get_landmark(landmarks: Any, landmark_enum: Any) -> dict[str, float]:
        point = landmarks[landmark_enum.value]
        return {"x": float(point.x), "y": float(point.y), "visibility": float(point.visibility)}

    def _is_visible(self, point: dict[str, float]) -> bool:
        return point["visibility"] >= self.settings.plank_visibility_threshold

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
            for name, point in zip(PLANK_SELECTED_LANDMARKS, landmarks)
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
            return np.zeros((len(PLANK_SELECTED_LANDMARKS), 4), dtype=np.float32), False, None

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
                landmark.LEFT_EAR,
                landmark.LEFT_SHOULDER,
                landmark.LEFT_ELBOW,
                landmark.LEFT_WRIST,
                landmark.LEFT_HIP,
                landmark.LEFT_KNEE,
                landmark.LEFT_ANKLE,
                landmark.RIGHT_EAR,
                landmark.RIGHT_SHOULDER,
                landmark.RIGHT_ELBOW,
                landmark.RIGHT_WRIST,
                landmark.RIGHT_HIP,
                landmark.RIGHT_KNEE,
                landmark.RIGHT_ANKLE,
            )
        return self._pose_landmarks

    @staticmethod
    def _import_vision_runtime() -> tuple[Any, Any]:
        try:
            import cv2
            import mediapipe as mp
        except ModuleNotFoundError as exc:
            raise RuntimeError(
                "OpenCV and MediaPipe are required for image-based plank inference. "
                "Install model gateway dependencies with: python -m pip install -r "
                "model_gateway/requirements.txt"
            ) from exc
        return cv2, mp


_plank_service: PlankService | None = None


def get_plank_service() -> PlankService:
    global _plank_service
    if _plank_service is None:
        _plank_service = PlankService(get_settings())
    return _plank_service
