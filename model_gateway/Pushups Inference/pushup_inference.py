"""
Push-up Correct/Incorrect Inference
-----------------------------------
Runs push-up rep-based inference using:
1. Trained .keras model
2. Saved scaler.pkl
3. pushup_training_info.json

Prediction happens after a complete rep:
TOP -> BOTTOM -> TOP

Important:
- The trained model is still used for prediction.
- After model prediction, rule overrides are applied for:
  1. Unsupported camera angle
  2. Not deep enough
  3. Too small elbow range of motion
"""

# ======================
# Matplotlib stub fix
# ======================

import sys
import types

matplotlib_stub = types.ModuleType("matplotlib")
matplotlib_stub.__path__ = []

pyplot_stub = types.ModuleType("matplotlib.pyplot")

def _noop(*args, **kwargs):
    return None

pyplot_stub.figure = _noop
pyplot_stub.imshow = _noop
pyplot_stub.show = _noop
pyplot_stub.title = _noop
pyplot_stub.axis = _noop
pyplot_stub.plot = _noop
pyplot_stub.scatter = _noop
pyplot_stub.close = _noop

matplotlib_stub.pyplot = pyplot_stub

sys.modules.setdefault("matplotlib", matplotlib_stub)
sys.modules.setdefault("matplotlib.pyplot", pyplot_stub)


# ======================
# Imports
# ======================

import argparse
import json
import pickle
from pathlib import Path
from collections import Counter

import cv2
import numpy as np
import tensorflow as tf
import mediapipe as mp
from tensorflow.keras.preprocessing.sequence import pad_sequences


# ======================
# Default paths
# ======================

DEFAULT_MODEL_PATH = "pushup_correct_incorrect_model.keras"
DEFAULT_SCALER_PATH = "pushup_scaler.pkl"
DEFAULT_INFO_PATH = "pushup_training_info.json"


# ======================
# Rep detection settings
# ======================

TOP_THRESHOLD = 155.0
BOTTOM_THRESHOLD = 150.0

MIN_FRAMES_IN_STATE = 3
MIN_REP_FRAMES = 8
MAX_REP_FRAMES = 250
MIN_ELBOW_ROM = 12.0
MIN_VISIBILITY = 0.35
MAX_MISSING_FRAMES = 15

# Model probability threshold
PREDICTION_THRESHOLD = 0.85 #0.75


# ======================
# Camera/view and rule settings
# ======================

# Keep this True for your current model.
# Your model is not reliable for front-view pushups yet.
REQUIRE_SIDE_VIEW = True

# Side view normally has smaller visible shoulder width.
# If it blocks your side videos, increase to 0.85.
# If it allows too many front videos, decrease to 0.65.
SIDE_VIEW_MAX_SHOULDER_RATIO = 0.75

# A correct push-up should go deep.
# If the minimum elbow angle stays too high, it means the person is not going deep.
MAX_CORRECT_BOTTOM_ELBOW_ANGLE = 125.0

# Correct push-up should have enough elbow movement.
MIN_CORRECT_ELBOW_ROM = 35.0


# ======================
# MediaPipe setup
# ======================

mp_pose = mp.solutions.pose
mp_drawing = mp.solutions.drawing_utils


LANDMARK_DEFS = [
    ("NOSE", mp_pose.PoseLandmark.NOSE),

    ("LEFT_SHOULDER", mp_pose.PoseLandmark.LEFT_SHOULDER),
    ("RIGHT_SHOULDER", mp_pose.PoseLandmark.RIGHT_SHOULDER),

    ("LEFT_ELBOW", mp_pose.PoseLandmark.LEFT_ELBOW),
    ("RIGHT_ELBOW", mp_pose.PoseLandmark.RIGHT_ELBOW),

    ("LEFT_WRIST", mp_pose.PoseLandmark.LEFT_WRIST),
    ("RIGHT_WRIST", mp_pose.PoseLandmark.RIGHT_WRIST),

    ("LEFT_HIP", mp_pose.PoseLandmark.LEFT_HIP),
    ("RIGHT_HIP", mp_pose.PoseLandmark.RIGHT_HIP),

    ("LEFT_KNEE", mp_pose.PoseLandmark.LEFT_KNEE),
    ("RIGHT_KNEE", mp_pose.PoseLandmark.RIGHT_KNEE),

    ("LEFT_ANKLE", mp_pose.PoseLandmark.LEFT_ANKLE),
    ("RIGHT_ANKLE", mp_pose.PoseLandmark.RIGHT_ANKLE),
]

SELECTED_LANDMARKS = [lm for _, lm in LANDMARK_DEFS]
IDX = {name: i for i, (name, _) in enumerate(LANDMARK_DEFS)}


# ======================
# Feature functions
# ======================

def calculate_angle(a, b, c):
    if a is None or b is None or c is None:
        return None

    a = np.array(a[:2], dtype=np.float32)
    b = np.array(b[:2], dtype=np.float32)
    c = np.array(c[:2], dtype=np.float32)

    ba = a - b
    bc = c - b

    denom = np.linalg.norm(ba) * np.linalg.norm(bc)

    if denom < 1e-6:
        return None

    cos_angle = np.dot(ba, bc) / denom
    angle = np.degrees(np.arccos(np.clip(cos_angle, -1.0, 1.0)))

    if not np.isfinite(angle):
        return None

    return float(angle)


def safe_angle(lms, a_name, b_name, c_name):
    return calculate_angle(
        lms[IDX[a_name]],
        lms[IDX[b_name]],
        lms[IDX[c_name]]
    )


def angle_or_zero(value):
    if value is None or not np.isfinite(value):
        return 0.0
    return float(value)


def mean_valid(values):
    valid = [v for v in values if v is not None and np.isfinite(v)]

    if not valid:
        return 0.0

    return float(np.mean(valid))


def min_valid(values):
    valid = [v for v in values if v is not None and np.isfinite(v)]

    if not valid:
        return 0.0

    return float(np.min(valid))


def distance_2d(a, b):
    a = np.array(a[:2], dtype=np.float32)
    b = np.array(b[:2], dtype=np.float32)

    return float(np.linalg.norm(a - b))


def midpoint(lms, a_name, b_name):
    a = lms[IDX[a_name]]
    b = lms[IDX[b_name]]

    point = (a + b) / 2.0
    point[3] = (a[3] + b[3]) / 2.0

    return point


def point_line_signed_distance_2d(point, line_start, line_end):
    p = np.array(point[:2], dtype=np.float32)
    a = np.array(line_start[:2], dtype=np.float32)
    b = np.array(line_end[:2], dtype=np.float32)

    ab = b - a
    ap = p - a

    denom = np.linalg.norm(ab)

    if denom < 1e-6:
        return 0.0

    cross = ab[0] * ap[1] - ab[1] * ap[0]

    return float(cross / denom)


def get_pose_scale(lms):
    left_shoulder = lms[IDX["LEFT_SHOULDER"]]
    right_shoulder = lms[IDX["RIGHT_SHOULDER"]]
    left_hip = lms[IDX["LEFT_HIP"]]
    right_hip = lms[IDX["RIGHT_HIP"]]

    mid_shoulder = midpoint(lms, "LEFT_SHOULDER", "RIGHT_SHOULDER")
    mid_hip = midpoint(lms, "LEFT_HIP", "RIGHT_HIP")

    shoulder_width = distance_2d(left_shoulder, right_shoulder)
    hip_width = distance_2d(left_hip, right_hip)
    torso_len = distance_2d(mid_shoulder, mid_hip)

    scale = max(shoulder_width, hip_width, torso_len, 1e-3)

    return float(scale)


def estimate_camera_view(lms):
    """
    Estimate whether camera view is side or front/diagonal.

    Side view:
        Left/right shoulders appear closer together.

    Front view:
        Left/right shoulders appear wider.
    """
    left_shoulder = lms[IDX["LEFT_SHOULDER"]]
    right_shoulder = lms[IDX["RIGHT_SHOULDER"]]

    mid_shoulder = midpoint(lms, "LEFT_SHOULDER", "RIGHT_SHOULDER")
    mid_hip = midpoint(lms, "LEFT_HIP", "RIGHT_HIP")

    shoulder_width = distance_2d(left_shoulder, right_shoulder)
    torso_len = distance_2d(mid_shoulder, mid_hip)

    ratio = shoulder_width / (torso_len + 1e-6)

    if ratio <= SIDE_VIEW_MAX_SHOULDER_RATIO:
        return "side", float(ratio)

    return "front_or_diagonal", float(ratio)


def normalize_landmarks(lms):
    norm = lms.copy().astype(np.float32)

    mid_hip = midpoint(lms, "LEFT_HIP", "RIGHT_HIP")
    mid_shoulder = midpoint(lms, "LEFT_SHOULDER", "RIGHT_SHOULDER")

    if mid_hip[3] >= 0.20:
        origin = mid_hip
    else:
        origin = mid_shoulder

    scale = get_pose_scale(lms)

    norm[:, 0] = (norm[:, 0] - origin[0]) / scale
    norm[:, 1] = (norm[:, 1] - origin[1]) / scale
    norm[:, 2] = (norm[:, 2] - origin[2]) / scale

    return norm


def extract_raw_landmarks(results):
    if not results.pose_landmarks:
        return None

    landmarks = results.pose_landmarks.landmark

    extracted = []

    for lm in SELECTED_LANDMARKS:
        point = landmarks[lm]
        extracted.append([
            point.x,
            point.y,
            point.z,
            point.visibility
        ])

    return np.array(extracted, dtype=np.float32)


def side_visibility_score(lms, side):
    shoulder = lms[IDX[f"{side}_SHOULDER"]][3]
    elbow = lms[IDX[f"{side}_ELBOW"]][3]
    wrist = lms[IDX[f"{side}_WRIST"]][3]

    return float(np.mean([shoulder, elbow, wrist]))


def get_active_elbow_angle(lms):
    left_angle = safe_angle(lms, "LEFT_SHOULDER", "LEFT_ELBOW", "LEFT_WRIST")
    right_angle = safe_angle(lms, "RIGHT_SHOULDER", "RIGHT_ELBOW", "RIGHT_WRIST")

    left_vis = side_visibility_score(lms, "LEFT")
    right_vis = side_visibility_score(lms, "RIGHT")

    candidates = []

    if left_angle is not None and left_vis >= MIN_VISIBILITY:
        candidates.append((left_angle, left_vis))

    if right_angle is not None and right_vis >= MIN_VISIBILITY:
        candidates.append((right_angle, right_vis))

    if not candidates:
        fallback = []

        if left_angle is not None:
            fallback.append((left_angle, left_vis))

        if right_angle is not None:
            fallback.append((right_angle, right_vis))

        fallback = [item for item in fallback if item[1] >= 0.15]

        if not fallback:
            return None, left_angle, right_angle

        angle, _ = max(fallback, key=lambda x: x[1])

        return float(angle), left_angle, right_angle

    angles = np.array([x[0] for x in candidates], dtype=np.float32)
    weights = np.array([x[1] for x in candidates], dtype=np.float32)

    active_angle = float(np.average(angles, weights=weights))

    return active_angle, left_angle, right_angle


def calculate_pushup_features(lms):
    active_elbow, left_elbow, right_elbow = get_active_elbow_angle(lms)

    left_shoulder_angle = safe_angle(
        lms,
        "LEFT_ELBOW",
        "LEFT_SHOULDER",
        "LEFT_HIP"
    )

    right_shoulder_angle = safe_angle(
        lms,
        "RIGHT_ELBOW",
        "RIGHT_SHOULDER",
        "RIGHT_HIP"
    )

    left_body_alignment = safe_angle(
        lms,
        "LEFT_SHOULDER",
        "LEFT_HIP",
        "LEFT_ANKLE"
    )

    right_body_alignment = safe_angle(
        lms,
        "RIGHT_SHOULDER",
        "RIGHT_HIP",
        "RIGHT_ANKLE"
    )

    left_hip_angle = safe_angle(
        lms,
        "LEFT_SHOULDER",
        "LEFT_HIP",
        "LEFT_KNEE"
    )

    right_hip_angle = safe_angle(
        lms,
        "RIGHT_SHOULDER",
        "RIGHT_HIP",
        "RIGHT_KNEE"
    )

    left_knee_angle = safe_angle(
        lms,
        "LEFT_HIP",
        "LEFT_KNEE",
        "LEFT_ANKLE"
    )

    right_knee_angle = safe_angle(
        lms,
        "RIGHT_HIP",
        "RIGHT_KNEE",
        "RIGHT_ANKLE"
    )

    mid_shoulder = midpoint(lms, "LEFT_SHOULDER", "RIGHT_SHOULDER")
    mid_elbow = midpoint(lms, "LEFT_ELBOW", "RIGHT_ELBOW")
    mid_wrist = midpoint(lms, "LEFT_WRIST", "RIGHT_WRIST")
    mid_hip = midpoint(lms, "LEFT_HIP", "RIGHT_HIP")
    mid_ankle = midpoint(lms, "LEFT_ANKLE", "RIGHT_ANKLE")

    scale = get_pose_scale(lms)

    shoulder_to_wrist_y_norm = float((mid_shoulder[1] - mid_wrist[1]) / scale)
    shoulder_to_elbow_y_norm = float((mid_shoulder[1] - mid_elbow[1]) / scale)

    hip_line_dist = point_line_signed_distance_2d(
        point=mid_hip,
        line_start=mid_shoulder,
        line_end=mid_ankle
    )

    hip_to_bodyline_signed_dist_norm = float(hip_line_dist / scale)

    hand_width_norm = float(
        distance_2d(lms[IDX["LEFT_WRIST"]], lms[IDX["RIGHT_WRIST"]]) / scale
    )

    shoulder_width_norm = float(
        distance_2d(lms[IDX["LEFT_SHOULDER"]], lms[IDX["RIGHT_SHOULDER"]]) / scale
    )

    features = [
        angle_or_zero(left_elbow),
        angle_or_zero(right_elbow),
        angle_or_zero(active_elbow),
        min_valid([left_elbow, right_elbow]),
        mean_valid([left_elbow, right_elbow]),

        angle_or_zero(left_shoulder_angle),
        angle_or_zero(right_shoulder_angle),
        mean_valid([left_shoulder_angle, right_shoulder_angle]),

        angle_or_zero(left_body_alignment),
        angle_or_zero(right_body_alignment),
        mean_valid([left_body_alignment, right_body_alignment]),

        angle_or_zero(left_hip_angle),
        angle_or_zero(right_hip_angle),
        mean_valid([left_hip_angle, right_hip_angle]),

        angle_or_zero(left_knee_angle),
        angle_or_zero(right_knee_angle),
        mean_valid([left_knee_angle, right_knee_angle]),

        shoulder_to_wrist_y_norm,
        shoulder_to_elbow_y_norm,
        hip_to_bodyline_signed_dist_norm,
        hand_width_norm,
        shoulder_width_norm,
    ]

    return np.array(features, dtype=np.float32)


def build_feature_vector(lms):
    normalized = normalize_landmarks(lms).flatten()
    derived = calculate_pushup_features(lms)

    return np.concatenate([normalized, derived]).astype(np.float32)


def trim_rep_frames(frame_buffer, angle_buffer):
    if len(frame_buffer) != len(angle_buffer) or len(frame_buffer) == 0:
        return frame_buffer, angle_buffer

    angles = np.array(angle_buffer, dtype=np.float32)

    max_angle = float(np.max(angles))
    movement_cutoff = min(max_angle - 5.0, TOP_THRESHOLD - 3.0)

    moving_indices = np.where(angles <= movement_cutoff)[0]

    if len(moving_indices) == 0:
        return frame_buffer, angle_buffer

    start = max(0, int(moving_indices[0]) - 3)
    end = min(len(frame_buffer), int(moving_indices[-1]) + 4)

    return frame_buffer[start:end], angle_buffer[start:end]


def get_majority_view(view_buffer, ratio_buffer):
    if not view_buffer:
        return "unknown", 0.0

    counts = Counter(view_buffer)
    view = counts.most_common(1)[0][0]

    if ratio_buffer:
        ratio = float(np.mean(ratio_buffer))
    else:
        ratio = 0.0

    return view, ratio


# ======================
# Inference helpers
# ======================

def load_inference_assets(model_path, scaler_path, info_path):
    model_path = Path(model_path)
    scaler_path = Path(scaler_path)
    info_path = Path(info_path)

    if not model_path.exists():
        raise FileNotFoundError(f"Model file not found: {model_path}")

    if not scaler_path.exists():
        raise FileNotFoundError(f"Scaler file not found: {scaler_path}")

    if not info_path.exists():
        raise FileNotFoundError(f"Training info file not found: {info_path}")

    model = tf.keras.models.load_model(model_path, compile=False)

    with open(scaler_path, "rb") as f:
        scaler = pickle.load(f)

    with open(info_path, "r", encoding="utf-8") as f:
        training_info = json.load(f)

    max_len = int(training_info["max_len"])
    feature_dim = int(training_info["feature_dim"])

    model_input_shape = model.input_shape

    if model_input_shape[1] is not None and int(model_input_shape[1]) != max_len:
        raise ValueError(
            f"MAX_LEN mismatch. Model expects {model_input_shape[1]}, "
            f"but training_info has {max_len}"
        )

    if int(model_input_shape[2]) != feature_dim:
        raise ValueError(
            f"Feature dimension mismatch. Model expects {model_input_shape[2]}, "
            f"but training_info has {feature_dim}"
        )

    print("Inference assets loaded successfully.")
    print(f"Model: {model_path}")
    print(f"Scaler: {scaler_path}")
    print(f"Max length: {max_len}")
    print(f"Feature dim: {feature_dim}")

    return model, scaler, training_info


def preprocess_rep_for_prediction(rep_frames, scaler, max_len, feature_dim):
    rep_frames = np.asarray(rep_frames, dtype=np.float32)

    if rep_frames.ndim != 2:
        raise ValueError(f"Rep frames should be 2D. Got shape: {rep_frames.shape}")

    if rep_frames.shape[1] != feature_dim:
        raise ValueError(
            f"Feature dimension mismatch. Expected {feature_dim}, "
            f"got {rep_frames.shape[1]}"
        )

    padded = pad_sequences(
        [rep_frames],
        maxlen=max_len,
        dtype="float32",
        padding="post",
        truncating="post",
        value=0.0
    )

    valid_mask = np.any(padded != 0.0, axis=-1)

    scaled = padded.copy()
    scaled[valid_mask] = scaler.transform(padded[valid_mask])
    scaled[~valid_mask] = 0.0

    return scaled.astype(np.float32)


def predict_rep(model, scaler, training_info, rep_frames):
    max_len = int(training_info["max_len"])
    feature_dim = int(training_info["feature_dim"])

    X = preprocess_rep_for_prediction(
        rep_frames=rep_frames,
        scaler=scaler,
        max_len=max_len,
        feature_dim=feature_dim
    )

    prob = float(model.predict(X, verbose=0)[0][0])
    pred = 1 if prob >= PREDICTION_THRESHOLD else 0

    label = "CORRECT" if pred == 1 else "INCORRECT"
    confidence = prob if pred == 1 else 1.0 - prob

    return {
        "probability_correct": prob,
        "prediction": pred,
        "label": label,
        "confidence": confidence,
        "reason": "Model prediction"
    }


def apply_rule_override(result, min_elbow_angle, elbow_rom, camera_view):
    """
    Hybrid inference:
    1. First uses trained model.
    2. Then applies form rules for known failure cases.
    """

    if REQUIRE_SIDE_VIEW and camera_view != "side":
        return {
            "probability_correct": result["probability_correct"],
            "prediction": 0,
            "label": "INCORRECT_VIEW",
            "confidence": 1.0,
            "reason": "Use side camera angle. Front/diagonal view is not reliable for this model."
        }

    if min_elbow_angle > MAX_CORRECT_BOTTOM_ELBOW_ANGLE:
        return {
            "probability_correct": result["probability_correct"],
            "prediction": 0,
            "label": "INCORRECT",
            "confidence": 1.0,
            "reason": f"Not deep enough. Min elbow angle: {min_elbow_angle:.1f}"
        }

    if elbow_rom < MIN_CORRECT_ELBOW_ROM:
        return {
            "probability_correct": result["probability_correct"],
            "prediction": 0,
            "label": "INCORRECT",
            "confidence": 1.0,
            "reason": f"Range of motion too small. ROM: {elbow_rom:.1f}"
        }

    result["reason"] = "Model prediction accepted"
    return result


def open_video_source(source):
    if source.lower() == "webcam":
        return cv2.VideoCapture(0)

    if source.isdigit():
        return cv2.VideoCapture(int(source))

    return cv2.VideoCapture(source)


def draw_status(
    frame,
    state_name,
    elbow_angle,
    rep_count,
    correct_count,
    incorrect_count,
    incorrect_view_count,
    camera_view,
    camera_view_ratio,
    last_result
):
    h, w = frame.shape[:2]

    cv2.rectangle(frame, (0, 0), (w, 190), (0, 0, 0), -1)

    cv2.putText(
        frame,
        f"State: {state_name}",
        (20, 30),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.72,
        (255, 255, 255),
        2
    )

    angle_text = "N/A" if elbow_angle is None else f"{elbow_angle:.1f}"

    cv2.putText(
        frame,
        f"Elbow Angle: {angle_text}",
        (20, 62),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.72,
        (255, 255, 255),
        2
    )

    cv2.putText(
        frame,
        f"View: {camera_view} | Ratio: {camera_view_ratio:.2f}",
        (20, 94),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.72,
        (255, 255, 255),
        2
    )

    cv2.putText(
        frame,
        f"Reps: {rep_count} | Correct: {correct_count} | Incorrect: {incorrect_count} | View Errors: {incorrect_view_count}",
        (20, 126),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.72,
        (255, 255, 255),
        2
    )

    if last_result:
        label = last_result["label"]
        confidence = last_result["confidence"] * 100
        probability_correct = last_result["probability_correct"] * 100
        reason = last_result.get("reason", "N/A")

        if label == "CORRECT":
            color = (0, 255, 0)
        elif label == "INCORRECT_VIEW":
            color = (0, 165, 255)
        else:
            color = (0, 0, 255)

        cv2.putText(
            frame,
            f"Last Rep: {label} | Conf: {confidence:.1f}% | Correct Prob: {probability_correct:.1f}%",
            (20, 158),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.62,
            color,
            2
        )

        cv2.putText(
            frame,
            f"Reason: {reason[:95]}",
            (20, 184),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.55,
            color,
            2
        )

    cv2.putText(
        frame,
        "Press Q to quit",
        (20, h - 20),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.65,
        (255, 255, 255),
        2
    )


# ======================
# Main inference loop
# ======================

def run_inference(source, model_path, scaler_path, info_path):
    model, scaler, training_info = load_inference_assets(
        model_path=model_path,
        scaler_path=scaler_path,
        info_path=info_path
    )

    cap = open_video_source(source)

    if not cap.isOpened():
        raise RuntimeError(f"Cannot open source: {source}")

    WAIT_TOP = 0
    WAIT_BOTTOM = 1
    WAIT_RETURN_TOP = 2

    state = WAIT_TOP

    state_names = {
        WAIT_TOP: "WAITING FOR TOP",
        WAIT_BOTTOM: "GOING DOWN",
        WAIT_RETURN_TOP: "RETURNING TOP"
    }

    frame_buffer = []
    angle_buffer = []
    view_buffer = []
    ratio_buffer = []

    top_count = 0
    bottom_count = 0
    missing_count = 0

    min_elbow_seen = 999.0
    max_elbow_seen = -999.0

    rep_count = 0
    correct_count = 0
    incorrect_count = 0
    incorrect_view_count = 0

    last_result = None

    current_camera_view = "unknown"
    current_camera_ratio = 0.0

    with mp_pose.Pose(
        static_image_mode=False,
        model_complexity=1,
        smooth_landmarks=True,
        enable_segmentation=False,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5
    ) as pose:

        while True:
            ret, frame = cap.read()

            if not ret:
                print("Video/webcam ended.")
                break

            frame = cv2.flip(frame, 1) if source.lower() == "webcam" else frame

            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = pose.process(rgb)

            lms = extract_raw_landmarks(results)

            active_elbow_angle = None

            if results.pose_landmarks:
                mp_drawing.draw_landmarks(
                    frame,
                    results.pose_landmarks,
                    mp_pose.POSE_CONNECTIONS
                )

            if lms is None:
                missing_count += 1

                if state != WAIT_TOP and missing_count >= MAX_MISSING_FRAMES:
                    state = WAIT_TOP
                    frame_buffer = []
                    angle_buffer = []
                    view_buffer = []
                    ratio_buffer = []
                    top_count = 0
                    bottom_count = 0
                    min_elbow_seen = 999.0
                    max_elbow_seen = -999.0

                draw_status(
                    frame=frame,
                    state_name=state_names[state],
                    elbow_angle=None,
                    rep_count=rep_count,
                    correct_count=correct_count,
                    incorrect_count=incorrect_count,
                    incorrect_view_count=incorrect_view_count,
                    camera_view=current_camera_view,
                    camera_view_ratio=current_camera_ratio,
                    last_result=last_result
                )

                cv2.imshow("Push-up Inference", frame)

                if cv2.waitKey(1) & 0xFF == ord("q"):
                    break

                continue

            missing_count = 0

            current_camera_view, current_camera_ratio = estimate_camera_view(lms)

            active_elbow_angle, _, _ = get_active_elbow_angle(lms)

            if active_elbow_angle is None:
                draw_status(
                    frame=frame,
                    state_name=state_names[state],
                    elbow_angle=None,
                    rep_count=rep_count,
                    correct_count=correct_count,
                    incorrect_count=incorrect_count,
                    incorrect_view_count=incorrect_view_count,
                    camera_view=current_camera_view,
                    camera_view_ratio=current_camera_ratio,
                    last_result=last_result
                )

                cv2.imshow("Push-up Inference", frame)

                if cv2.waitKey(1) & 0xFF == ord("q"):
                    break

                continue

            feature_vector = build_feature_vector(lms)

            # ======================
            # State 1: wait for top
            # ======================
            if state == WAIT_TOP:
                if active_elbow_angle >= TOP_THRESHOLD:
                    top_count += 1

                    if top_count >= MIN_FRAMES_IN_STATE:
                        state = WAIT_BOTTOM
                        frame_buffer = []
                        angle_buffer = []
                        view_buffer = []
                        ratio_buffer = []

                        min_elbow_seen = active_elbow_angle
                        max_elbow_seen = active_elbow_angle

                        bottom_count = 0

                        frame_buffer.append(feature_vector)
                        angle_buffer.append(active_elbow_angle)
                        view_buffer.append(current_camera_view)
                        ratio_buffer.append(current_camera_ratio)
                else:
                    top_count = 0

            # ======================
            # Record active rep frames
            # ======================
            elif state in [WAIT_BOTTOM, WAIT_RETURN_TOP]:
                frame_buffer.append(feature_vector)
                angle_buffer.append(active_elbow_angle)
                view_buffer.append(current_camera_view)
                ratio_buffer.append(current_camera_ratio)

                min_elbow_seen = min(min_elbow_seen, active_elbow_angle)
                max_elbow_seen = max(max_elbow_seen, active_elbow_angle)

                if len(frame_buffer) > MAX_REP_FRAMES:
                    print("Rep discarded: too long")

                    state = WAIT_TOP
                    frame_buffer = []
                    angle_buffer = []
                    view_buffer = []
                    ratio_buffer = []
                    top_count = 0
                    bottom_count = 0
                    min_elbow_seen = 999.0
                    max_elbow_seen = -999.0

            # ======================
            # State 2: wait for bottom
            # ======================
            if state == WAIT_BOTTOM:
                if active_elbow_angle <= BOTTOM_THRESHOLD:
                    bottom_count += 1

                    if bottom_count >= MIN_FRAMES_IN_STATE:
                        state = WAIT_RETURN_TOP
                        bottom_count = 0
                        top_count = 0
                else:
                    bottom_count = 0

            # ======================
            # State 3: wait for return to top
            # ======================
            elif state == WAIT_RETURN_TOP:
                if active_elbow_angle >= TOP_THRESHOLD:
                    top_count += 1

                    if top_count >= MIN_FRAMES_IN_STATE:
                        elbow_rom = max_elbow_seen - min_elbow_seen

                        trimmed_frames, trimmed_angles = trim_rep_frames(
                            frame_buffer,
                            angle_buffer
                        )

                        rep_camera_view, rep_camera_ratio = get_majority_view(
                            view_buffer,
                            ratio_buffer
                        )

                        if len(trimmed_frames) >= MIN_REP_FRAMES and elbow_rom >= MIN_ELBOW_ROM:
                            model_result = predict_rep(
                                model=model,
                                scaler=scaler,
                                training_info=training_info,
                                rep_frames=np.array(trimmed_frames, dtype=np.float32)
                            )

                            result = apply_rule_override(
                                result=model_result,
                                min_elbow_angle=min_elbow_seen,
                                elbow_rom=elbow_rom,
                                camera_view=rep_camera_view
                            )

                            last_result = result
                            rep_count += 1

                            if result["label"] == "CORRECT":
                                correct_count += 1
                            elif result["label"] == "INCORRECT_VIEW":
                                incorrect_view_count += 1
                            else:
                                incorrect_count += 1

                            print(
                                f"Rep {rep_count}: "
                                f"{result['label']} | "
                                f"Confidence: {result['confidence'] * 100:.2f}% | "
                                f"Correct Probability: {result['probability_correct'] * 100:.2f}% | "
                                f"Frames: {len(trimmed_frames)} | "
                                f"Elbow ROM: {elbow_rom:.2f} | "
                                f"Min Elbow: {min_elbow_seen:.2f} | "
                                f"View: {rep_camera_view} ({rep_camera_ratio:.2f}) | "
                                f"Reason: {result.get('reason', 'N/A')}"
                            )
                        else:
                            print(
                                f"Rep discarded: frames={len(trimmed_frames)}, "
                                f"elbow_rom={elbow_rom:.2f}, "
                                f"min_elbow={min_elbow_seen:.2f}, "
                                f"view={rep_camera_view} ({rep_camera_ratio:.2f})"
                            )

                        state = WAIT_TOP
                        frame_buffer = []
                        angle_buffer = []
                        view_buffer = []
                        ratio_buffer = []
                        top_count = 0
                        bottom_count = 0
                        min_elbow_seen = 999.0
                        max_elbow_seen = -999.0
                else:
                    top_count = 0

            draw_status(
                frame=frame,
                state_name=state_names[state],
                elbow_angle=active_elbow_angle,
                rep_count=rep_count,
                correct_count=correct_count,
                incorrect_count=incorrect_count,
                incorrect_view_count=incorrect_view_count,
                camera_view=current_camera_view,
                camera_view_ratio=current_camera_ratio,
                last_result=last_result
            )

            cv2.imshow("Push-up Inference", frame)

            if cv2.waitKey(1) & 0xFF == ord("q"):
                break

    cap.release()
    cv2.destroyAllWindows()

    print("\n======================")
    print("Inference Summary")
    print("======================")
    print(f"Total reps: {rep_count}")
    print(f"Correct reps: {correct_count}")
    print(f"Incorrect reps: {incorrect_count}")
    print(f"Incorrect view reps: {incorrect_view_count}")


# ======================
# CLI
# ======================

def parse_args():
    parser = argparse.ArgumentParser(
        description="Push-up correct/incorrect rep-based inference"
    )

    parser.add_argument(
        "--source",
        type=str,
        default="webcam",
        help="Use 'webcam', camera index like '0', or video path like 'videos/test.mp4'"
    )

    parser.add_argument(
        "--model",
        type=str,
        default=DEFAULT_MODEL_PATH,
        help="Path to trained .keras model"
    )

    parser.add_argument(
        "--scaler",
        type=str,
        default=DEFAULT_SCALER_PATH,
        help="Path to saved scaler.pkl"
    )

    parser.add_argument(
        "--info",
        type=str,
        default=DEFAULT_INFO_PATH,
        help="Path to pushup_training_info.json"
    )

    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()

    run_inference(
        source=args.source,
        model_path=args.model,
        scaler_path=args.scaler,
        info_path=args.info
    )