import cv2
import numpy as np
from collections import deque

from mediapipe.python.solutions import pose as mp_pose
from mediapipe.python.solutions import drawing_utils as mp_drawing


# ============================================================
# Configuration
# ============================================================

CAMERA_INDEX = 0
VISIBILITY_THRESHOLD = 0.55

SMOOTHING_WINDOW = 8
CORRECT_RATIO_REQUIRED = 0.65

BACK_MIN_ANGLE = 145
HIP_MIN_ANGLE = 45
HIP_MAX_ANGLE = 175
KNEE_MIN_ANGLE = 70
KNEE_MAX_ANGLE = 175

SHOULDER_HIP_X_TOLERANCE = 0.18
KNEE_FOOT_X_TOLERANCE = 0.22


# ============================================================
# MediaPipe Setup
# ============================================================

pose = mp_pose.Pose(
    static_image_mode=False,
    model_complexity=1,
    enable_segmentation=False,
    min_detection_confidence=0.6,
    min_tracking_confidence=0.6
)


# ============================================================
# Utility Functions
# ============================================================

def calculate_angle(a, b, c):
    a = np.array(a, dtype=np.float32)
    b = np.array(b, dtype=np.float32)
    c = np.array(c, dtype=np.float32)

    ba = a - b
    bc = c - b

    cosine_angle = np.dot(ba, bc) / (
        np.linalg.norm(ba) * np.linalg.norm(bc) + 1e-8
    )

    cosine_angle = np.clip(cosine_angle, -1.0, 1.0)
    return float(np.degrees(np.arccos(cosine_angle)))


def get_landmark(landmarks, landmark_enum):
    lm = landmarks[landmark_enum.value]

    return {
        "x": float(lm.x),
        "y": float(lm.y),
        "visibility": float(lm.visibility)
    }


def is_visible(point):
    return point["visibility"] >= VISIBILITY_THRESHOLD


def point_xy(point):
    return [point["x"], point["y"]]


def average_visibility(points):
    return sum(p["visibility"] for p in points) / len(points)


def choose_best_side(landmarks):
    L = mp_pose.PoseLandmark

    left_points = [
        get_landmark(landmarks, L.LEFT_SHOULDER),
        get_landmark(landmarks, L.LEFT_HIP),
        get_landmark(landmarks, L.LEFT_KNEE),
        get_landmark(landmarks, L.LEFT_ANKLE),
        get_landmark(landmarks, L.LEFT_HEEL),
        get_landmark(landmarks, L.LEFT_FOOT_INDEX),
    ]

    right_points = [
        get_landmark(landmarks, L.RIGHT_SHOULDER),
        get_landmark(landmarks, L.RIGHT_HIP),
        get_landmark(landmarks, L.RIGHT_KNEE),
        get_landmark(landmarks, L.RIGHT_ANKLE),
        get_landmark(landmarks, L.RIGHT_HEEL),
        get_landmark(landmarks, L.RIGHT_FOOT_INDEX),
    ]

    left_visibility = average_visibility(left_points)
    right_visibility = average_visibility(right_points)

    return "left" if left_visibility >= right_visibility else "right"


def get_side_landmarks(landmarks, side):
    L = mp_pose.PoseLandmark

    if side == "left":
        return {
            "shoulder": get_landmark(landmarks, L.LEFT_SHOULDER),
            "hip": get_landmark(landmarks, L.LEFT_HIP),
            "knee": get_landmark(landmarks, L.LEFT_KNEE),
            "ankle": get_landmark(landmarks, L.LEFT_ANKLE),
            "heel": get_landmark(landmarks, L.LEFT_HEEL),
            "foot": get_landmark(landmarks, L.LEFT_FOOT_INDEX),
        }

    return {
        "shoulder": get_landmark(landmarks, L.RIGHT_SHOULDER),
        "hip": get_landmark(landmarks, L.RIGHT_HIP),
        "knee": get_landmark(landmarks, L.RIGHT_KNEE),
        "ankle": get_landmark(landmarks, L.RIGHT_ANKLE),
        "heel": get_landmark(landmarks, L.RIGHT_HEEL),
        "foot": get_landmark(landmarks, L.RIGHT_FOOT_INDEX),
    }


def calculate_back_angle(shoulder, hip):
    dx = shoulder["x"] - hip["x"]
    dy = shoulder["y"] - hip["y"]

    angle_from_vertical = abs(np.degrees(np.arctan2(dx, dy)))
    back_angle = 180 - angle_from_vertical

    return float(back_angle)


def put_text(frame, text, position, color, scale=0.65, thickness=2):
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


# ============================================================
# Deadlift Analysis Logic
# ============================================================

def analyze_deadlift(landmarks):
    side = choose_best_side(landmarks)
    lm = get_side_landmarks(landmarks, side)

    required_points = [
        lm["shoulder"],
        lm["hip"],
        lm["knee"],
        lm["ankle"],
        lm["foot"],
    ]

    if not all(is_visible(p) for p in required_points):
        return {
            "valid": False,
            "status": "Pose not clear",
            "reason": "Keep shoulder, hip, knee, ankle, and foot visible."
        }

    shoulder = lm["shoulder"]
    hip = lm["hip"]
    knee = lm["knee"]
    ankle = lm["ankle"]
    foot = lm["foot"]

    shoulder_xy = point_xy(shoulder)
    hip_xy = point_xy(hip)
    knee_xy = point_xy(knee)
    ankle_xy = point_xy(ankle)
    foot_xy = point_xy(foot)

    back_angle = calculate_back_angle(shoulder, hip)
    hip_angle = calculate_angle(shoulder_xy, hip_xy, knee_xy)
    knee_angle = calculate_angle(hip_xy, knee_xy, ankle_xy)

    shoulder_hip_x_diff = abs(shoulder["x"] - hip["x"])
    knee_foot_x_diff = abs(knee["x"] - foot["x"])

    back_ok = back_angle >= BACK_MIN_ANGLE
    hip_ok = HIP_MIN_ANGLE <= hip_angle <= HIP_MAX_ANGLE
    knee_ok = KNEE_MIN_ANGLE <= knee_angle <= KNEE_MAX_ANGLE
    shoulder_hip_ok = shoulder_hip_x_diff <= SHOULDER_HIP_X_TOLERANCE
    knee_foot_ok = knee_foot_x_diff <= KNEE_FOOT_X_TOLERANCE

    checks = {
        "Back neutral": back_ok,
        "Hip hinge": hip_ok,
        "Knee angle": knee_ok,
        "Shoulders controlled": shoulder_hip_ok,
        "Knees near feet": knee_foot_ok,
    }

    passed_checks = sum(1 for value in checks.values() if value)
    critical_ok = back_ok and hip_ok and knee_ok

    is_correct = critical_ok and passed_checks >= 4

    reasons = []

    if not back_ok:
        reasons.append("Keep your back neutral")

    if not hip_ok:
        if hip_angle < HIP_MIN_ANGLE:
            reasons.append("Hips too low")
        else:
            reasons.append("Use more hip hinge")

    if not knee_ok:
        if knee_angle < KNEE_MIN_ANGLE:
            reasons.append("Knees bending too much")
        else:
            reasons.append("Knees too locked")

    if not shoulder_hip_ok:
        reasons.append("Keep shoulders controlled over hips")

    if not knee_foot_ok:
        reasons.append("Keep knees aligned with feet")

    if len(reasons) == 0:
        reasons.append("Good form")

    return {
        "valid": True,
        "is_correct": is_correct,
        "status": "Correct Deadlift" if is_correct else "Incorrect Deadlift",
        "checks": checks,
        "passed_checks": passed_checks,
        "total_checks": len(checks),
        "reasons": reasons
    }


# ============================================================
# Main Webcam Loop
# ============================================================

def main():
    cap = cv2.VideoCapture(CAMERA_INDEX)

    if not cap.isOpened():
        print("Error: Could not open webcam.")
        return

    prediction_buffer = deque(maxlen=SMOOTHING_WINDOW)

    print("Starting live deadlift detector...")
    print("Press 'q' to quit.")
    print("Use side view and keep full body visible.")

    while True:
        success, frame = cap.read()

        if not success:
            print("Error: Failed to read webcam frame.")
            break

        frame = cv2.flip(frame, 1)
        h, w, _ = frame.shape

        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = pose.process(rgb_frame)

        status_text = "No pose detected"
        status_color = (0, 0, 255)
        reason_text = "Keep full body visible from side view"

        if results.pose_landmarks:
            mp_drawing.draw_landmarks(
                frame,
                results.pose_landmarks,
                mp_pose.POSE_CONNECTIONS
            )

            analysis = analyze_deadlift(results.pose_landmarks.landmark)

            if analysis["valid"]:
                prediction_buffer.append(1 if analysis["is_correct"] else 0)

                correct_ratio = sum(prediction_buffer) / len(prediction_buffer)
                smoothed_correct = correct_ratio >= CORRECT_RATIO_REQUIRED

                status_text = "Correct Deadlift" if smoothed_correct else "Incorrect Deadlift"
                status_color = (0, 180, 0) if smoothed_correct else (0, 0, 255)
                reason_text = ", ".join(analysis["reasons"][:2])

            else:
                prediction_buffer.clear()

                status_text = analysis["status"]
                reason_text = analysis["reason"]
                status_color = (0, 165, 255)

        else:
            prediction_buffer.clear()

        cv2.rectangle(frame, (10, 10), (w - 10, 105), (255, 255, 255), -1)

        put_text(frame, status_text, (20, 40), status_color, scale=0.9, thickness=3)
        put_text(frame, reason_text, (20, 65), (0, 0, 0), scale=0.55, thickness=2)

        cv2.imshow("Live Deadlift Detector", frame)

        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

    cap.release()
    cv2.destroyAllWindows()
    pose.close()


if __name__ == "__main__":
    main()