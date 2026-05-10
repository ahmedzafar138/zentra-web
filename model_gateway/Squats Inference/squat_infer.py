# ==========================================
# Squat Inference - Video Friendly
# Hybrid Model + Rule Check
# Counts 1 rep as: bottom position -> return to top
# ==========================================

import cv2
import numpy as np
import mediapipe as mp
import tensorflow as tf
from tensorflow.keras.preprocessing.sequence import pad_sequences

# ==========================================
# CONFIG
# ==========================================
MODEL_PATH = "Squats_model_fixed_v2.keras"

# For video file:
# VIDEO_SOURCE = "pp.mp4"

# For webcam, use:
VIDEO_SOURCE = 0

FLIP_FRAME = True      # False for recorded video, True for webcam
DRAW_LANDMARKS = True

MODEL_THRESHOLD = 0.75

# Rep detection thresholds
DOWN_THRESHOLD = 115       # bottom position detection
END_UP_THRESHOLD = 145     # return-to-top detection

MIN_FRAMES = 3
MIN_REP_FRAMES = 8

# Rule validation thresholds
RULE_MIN_DEPTH_ANGLE = 120
RULE_MIN_KNEE_RANGE = 35
RULE_RETURN_STANDING_ANGLE = 140
RULE_MAX_TORSO_LEAN = 60
RULE_MAX_KNEE_IMBALANCE = 35
RULE_MIN_VISIBILITY = 0.55

FRAME_WIDTH = 640
FRAME_HEIGHT = 480
WINDOW_NAME = "Squat Detection"

# ==========================================
# LOAD MODEL
# ==========================================
model = tf.keras.models.load_model(
    MODEL_PATH,
    compile=False,
    safe_mode=False
)

MAX_LEN = model.input_shape[1]
FEATURE_DIM = model.input_shape[2]

print("Model loaded successfully")
print("Model input shape:", model.input_shape)
print("MAX_LEN:", MAX_LEN)
print("FEATURE_DIM:", FEATURE_DIM)

dummy_input = np.zeros((1, MAX_LEN, FEATURE_DIM), dtype=np.float32)
_ = model(dummy_input, training=False)

# ==========================================
# MEDIAPIPE SETUP
# ==========================================
mp_pose = mp.solutions.pose
mp_drawing = mp.solutions.drawing_utils

SELECTED_LANDMARKS = [
    mp_pose.PoseLandmark.RIGHT_HIP,
    mp_pose.PoseLandmark.LEFT_HIP,
    mp_pose.PoseLandmark.RIGHT_KNEE,
    mp_pose.PoseLandmark.LEFT_KNEE,
    mp_pose.PoseLandmark.RIGHT_ANKLE,
    mp_pose.PoseLandmark.LEFT_ANKLE,
    mp_pose.PoseLandmark.RIGHT_SHOULDER,
    mp_pose.PoseLandmark.LEFT_SHOULDER
]


def extract_keypoints(results):
    if results.pose_landmarks:
        return [[
            results.pose_landmarks.landmark[lm].x,
            results.pose_landmarks.landmark[lm].y,
            results.pose_landmarks.landmark[lm].z,
            results.pose_landmarks.landmark[lm].visibility
        ] for lm in SELECTED_LANDMARKS]

    return [[0.0, 0.0, 0.0, 0.0] for _ in SELECTED_LANDMARKS]


def calculate_angle(a, b, c):
    a = np.array(a[:2], dtype=np.float32)
    b = np.array(b[:2], dtype=np.float32)
    c = np.array(c[:2], dtype=np.float32)

    ba = a - b
    bc = c - b

    denominator = np.linalg.norm(ba) * np.linalg.norm(bc)

    if denominator < 1e-6:
        return 0.0

    cosine_angle = np.dot(ba, bc) / denominator
    cosine_angle = np.clip(cosine_angle, -1.0, 1.0)

    return float(np.degrees(np.arccos(cosine_angle)))


def get_knee_angle(keypoints):
    r_hip, r_knee, r_ankle = keypoints[0], keypoints[2], keypoints[4]
    l_hip, l_knee, l_ankle = keypoints[1], keypoints[3], keypoints[5]

    right_angle = calculate_angle(r_hip, r_knee, r_ankle)
    left_angle = calculate_angle(l_hip, l_knee, l_ankle)

    return (right_angle + left_angle) / 2


def get_torso_lean_angle(frame):
    r_hip = frame[0]
    l_hip = frame[1]
    r_shoulder = frame[6]
    l_shoulder = frame[7]

    mid_hip = (r_hip[:2] + l_hip[:2]) / 2
    mid_shoulder = (r_shoulder[:2] + l_shoulder[:2]) / 2

    torso_vector = mid_shoulder - mid_hip
    vertical_vector = np.array([0.0, -1.0], dtype=np.float32)

    denominator = np.linalg.norm(torso_vector) * np.linalg.norm(vertical_vector)

    if denominator < 1e-6:
        return 90.0

    cosine_angle = np.dot(torso_vector, vertical_vector) / denominator
    cosine_angle = np.clip(cosine_angle, -1.0, 1.0)

    return float(np.degrees(np.arccos(cosine_angle)))


def validate_squat_rules(frame_buffer):
    frames = np.array(frame_buffer, dtype=np.float32).reshape(-1, 8, 4)

    knee_angles = []
    torso_angles = []
    visibility_scores = []
    left_right_knee_diffs = []

    for frame in frames:
        r_hip = frame[0]
        l_hip = frame[1]
        r_knee = frame[2]
        l_knee = frame[3]
        r_ankle = frame[4]
        l_ankle = frame[5]
        r_shoulder = frame[6]
        l_shoulder = frame[7]

        right_knee_angle = calculate_angle(r_hip, r_knee, r_ankle)
        left_knee_angle = calculate_angle(l_hip, l_knee, l_ankle)

        avg_knee_angle = (right_knee_angle + left_knee_angle) / 2
        knee_angles.append(avg_knee_angle)

        left_right_knee_diffs.append(abs(right_knee_angle - left_knee_angle))
        torso_angles.append(get_torso_lean_angle(frame))

        visibility_scores.extend([
            r_hip[3],
            l_hip[3],
            r_knee[3],
            l_knee[3],
            r_ankle[3],
            l_ankle[3],
            r_shoulder[3],
            l_shoulder[3],
        ])

    min_knee_angle = min(knee_angles)
    max_knee_angle = max(knee_angles)
    knee_range = max_knee_angle - min_knee_angle

    avg_visibility = float(np.mean(visibility_scores))
    max_torso_lean = max(torso_angles)
    max_knee_imbalance = max(left_right_knee_diffs)

    if avg_visibility < RULE_MIN_VISIBILITY:
        return False, "Body not clearly visible"

    if min_knee_angle > RULE_MIN_DEPTH_ANGLE:
        return False, "Not deep enough"

    if max_knee_angle < RULE_RETURN_STANDING_ANGLE:
        return False, "Did not return to standing"

    if knee_range < RULE_MIN_KNEE_RANGE:
        return False, "Movement range too small"

    if max_torso_lean > RULE_MAX_TORSO_LEAN:
        return False, "Too much torso lean"

    if max_knee_imbalance > RULE_MAX_KNEE_IMBALANCE:
        return False, "Left/right leg imbalance"

    return True, "Good form"


def predict_rep(frame_buffer):
    sequence = pad_sequences(
        [frame_buffer],
        maxlen=MAX_LEN,
        dtype="float32",
        padding="post"
    )

    pred = float(model(sequence, training=False).numpy()[0][0])

    rules_passed, reason = validate_squat_rules(frame_buffer)

    if pred >= MODEL_THRESHOLD and rules_passed:
        label = "CORRECT"
    else:
        label = "INCORRECT"

    return label, pred, reason


def draw_text(frame, text, position, color=(0, 255, 0), scale=0.8, thickness=2):
    cv2.putText(
        frame,
        text,
        position,
        cv2.FONT_HERSHEY_SIMPLEX,
        scale,
        color,
        thickness,
        cv2.LINE_AA
    )


# ==========================================
# VIDEO CAPTURE
# ==========================================
cv2.setUseOptimized(True)

def open_capture(video_source):
    if video_source != 0:
        return cv2.VideoCapture(video_source)

    backends = [
        ("DirectShow", cv2.CAP_DSHOW),
        ("Media Foundation", cv2.CAP_MSMF),
        ("Default", cv2.CAP_ANY),
    ]

    for name, backend in backends:
        print(f"Trying camera 0 with {name} backend...")
        capture = cv2.VideoCapture(0, backend)
        if capture.isOpened():
            print(f"Camera opened with {name} backend")
            return capture
        capture.release()

    return cv2.VideoCapture(0)


cap = open_capture(VIDEO_SOURCE)

cap.set(cv2.CAP_PROP_FRAME_WIDTH, FRAME_WIDTH)
cap.set(cv2.CAP_PROP_FRAME_HEIGHT, FRAME_HEIGHT)
cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

if not cap.isOpened():
    raise RuntimeError(
        "Camera/video could not be opened. Close the browser/frontend webcam, "
        "Teams/Zoom/Camera app, or change VIDEO_SOURCE to another camera index."
    )

# ==========================================
# STATE VARIABLES
# ==========================================
phase = "WAIT_FOR_BOTTOM"

down_count = 0
up_count = 0

frame_buffer = []
rep_count = 0

last_label = "NO REP YET"
last_score = 0.0
last_reason = "Complete one squat"
stage = "GO DOWN"

# ==========================================
# MAIN LOOP
# ==========================================
try:
    with mp_pose.Pose(
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5
    ) as pose:
        cv2.namedWindow(WINDOW_NAME, cv2.WINDOW_NORMAL)
        print("Camera loop started. Press Q in the video window to quit.")
        failed_reads = 0

        while True:
            ret, frame = cap.read()

            if not ret or frame is None:
                failed_reads += 1
                print(f"Camera frame read failed ({failed_reads}/30)")
                if failed_reads >= 30:
                    print("Stopping because the camera did not return frames.")
                    break
                if cv2.waitKey(30) & 0xFF == ord("q"):
                    break
                continue

            failed_reads = 0

            if FLIP_FRAME:
                frame = cv2.flip(frame, 1)

            frame = cv2.resize(frame, (FRAME_WIDTH, FRAME_HEIGHT))

            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            rgb.flags.writeable = False
            results = pose.process(rgb)
            rgb.flags.writeable = True

            if not results.pose_landmarks:
                draw_text(frame, "No pose detected", (20, 40), (0, 0, 255), 0.9, 2)
                draw_text(frame, "Show full body in camera", (20, 80), (0, 0, 255), 0.8, 2)

                cv2.imshow(WINDOW_NAME, frame)

                if cv2.waitKey(1) & 0xFF == ord("q"):
                    break

                continue

            keypoints = extract_keypoints(results)
            knee_angle = get_knee_angle(keypoints)

            # ==========================================
            # VIDEO-FRIENDLY REP LOGIC
            # One rep = bottom detected -> return to top
            # ==========================================

            if phase == "WAIT_FOR_BOTTOM":
                stage = "GO DOWN"

                if knee_angle < DOWN_THRESHOLD:
                    down_count += 1

                    if down_count >= MIN_FRAMES:
                        phase = "RECORD_UP"
                        frame_buffer = []
                        up_count = 0
                        down_count = 0
                else:
                    down_count = 0

            elif phase == "RECORD_UP":
                stage = "COME UP"

                frame_buffer.append(
                    np.array(keypoints, dtype=np.float32).flatten()
                )

                if knee_angle > END_UP_THRESHOLD:
                    up_count += 1

                    if up_count >= MIN_FRAMES:
                        if len(frame_buffer) >= MIN_REP_FRAMES:
                            last_label, last_score, last_reason = predict_rep(frame_buffer)
                            rep_count += 1

                            print(
                                f"Rep {rep_count}: {last_label} | "
                                f"Score: {last_score:.2f} | "
                                f"Reason: {last_reason}"
                            )
                        else:
                            last_label = "INCORRECT"
                            last_score = 0.0
                            last_reason = "Rep too short"

                        phase = "WAIT_FOR_BOTTOM"
                        frame_buffer = []
                        up_count = 0
                        down_count = 0
                else:
                    up_count = 0

            # ==========================================
            # DRAW LANDMARKS
            # ==========================================
            if DRAW_LANDMARKS and results.pose_landmarks:
                mp_drawing.draw_landmarks(
                    frame,
                    results.pose_landmarks,
                    mp_pose.POSE_CONNECTIONS
                )

            # ==========================================
            # DISPLAY UI
            # ==========================================
            if last_label == "CORRECT":
                result_color = (0, 255, 0)
            elif last_label == "INCORRECT":
                result_color = (0, 0, 255)
            else:
                result_color = (255, 255, 0)

            draw_text(
                frame,
                f"Angle: {int(knee_angle)}",
                (20, 40),
                (0, 255, 0),
                0.8,
                2
            )

            draw_text(
                frame,
                f"Reps: {rep_count}",
                (20, 80),
                (0, 255, 0),
                0.8,
                2
            )

            draw_text(
                frame,
                f"Stage: {stage} | Phase: {phase}",
                (20, 120),
                (255, 255, 0),
                0.75,
                2
            )

            draw_text(
                frame,
                f"Result: {last_label}",
                (20, 175),
                result_color,
                1.0,
                3
            )

            draw_text(
                frame,
                f"Score: {last_score:.2f}",
                (20, 220),
                result_color,
                0.8,
                2
            )

            draw_text(
                frame,
                f"Reason: {last_reason}",
                (20, 260),
                result_color,
                0.7,
                2
            )

            draw_text(
                frame,
                "Press Q to quit",
                (20, FRAME_HEIGHT - 25),
                (255, 255, 255),
                0.6,
                1
            )

            cv2.imshow(WINDOW_NAME, frame)

            if cv2.waitKey(1) & 0xFF == ord("q"):
                break
finally:
    cap.release()
    cv2.destroyAllWindows()
