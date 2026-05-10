import cv2
import math
import numpy as np
import mediapipe as mp
from collections import deque


# ============================================================
# Configuration
# ============================================================

CAMERA_INDEX = 0

VISIBILITY_THRESHOLD = 0.55

# Angle thresholds
BODY_ALIGNMENT_MIN = 160
BODY_ALIGNMENT_MAX = 180

TORSO_ALIGNMENT_MIN = 160
LEG_ALIGNMENT_MIN = 160

ELBOW_MIN = 75
ELBOW_MAX = 120

HEAD_ALIGNMENT_MIN = 145

# Shoulder should be roughly above elbow in forearm plank
SHOULDER_ELBOW_X_TOLERANCE = 0.13

# Hip should stay close to the straight line from shoulder to ankle
HIP_LINE_OFFSET_TOLERANCE = 0.08

# Smoothing to avoid flickering result
SMOOTHING_WINDOW = 10
CORRECT_RATIO_REQUIRED = 0.65


# ============================================================
# MediaPipe Setup
# ============================================================

mp_pose = mp.solutions.pose
mp_drawing = mp.solutions.drawing_utils

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
    """
    Calculates angle ABC.
    Point b is the middle joint.
    Returns angle in degrees between 0 and 180.
    """

    a = np.array([a[0], a[1]], dtype=np.float32)
    b = np.array([b[0], b[1]], dtype=np.float32)
    c = np.array([c[0], c[1]], dtype=np.float32)

    ba = a - b
    bc = c - b

    cosine_angle = np.dot(ba, bc) / (
        np.linalg.norm(ba) * np.linalg.norm(bc) + 1e-8
    )

    cosine_angle = np.clip(cosine_angle, -1.0, 1.0)

    angle = np.degrees(np.arccos(cosine_angle))

    return float(angle)


def get_landmark(landmarks, landmark_enum):
    """
    Returns x, y, visibility for a MediaPipe landmark.
    Coordinates are normalized between 0 and 1.
    """

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
    """
    Chooses left or right body side based on landmark visibility.
    This is important because plank should be captured from side view.
    """

    L = mp_pose.PoseLandmark

    left_points = [
        get_landmark(landmarks, L.LEFT_SHOULDER),
        get_landmark(landmarks, L.LEFT_ELBOW),
        get_landmark(landmarks, L.LEFT_WRIST),
        get_landmark(landmarks, L.LEFT_HIP),
        get_landmark(landmarks, L.LEFT_KNEE),
        get_landmark(landmarks, L.LEFT_ANKLE),
        get_landmark(landmarks, L.LEFT_EAR),
    ]

    right_points = [
        get_landmark(landmarks, L.RIGHT_SHOULDER),
        get_landmark(landmarks, L.RIGHT_ELBOW),
        get_landmark(landmarks, L.RIGHT_WRIST),
        get_landmark(landmarks, L.RIGHT_HIP),
        get_landmark(landmarks, L.RIGHT_KNEE),
        get_landmark(landmarks, L.RIGHT_ANKLE),
        get_landmark(landmarks, L.RIGHT_EAR),
    ]

    left_visibility = average_visibility(left_points)
    right_visibility = average_visibility(right_points)

    if left_visibility >= right_visibility:
        return "left"
    return "right"


def get_side_landmarks(landmarks, side):
    """
    Returns key landmarks for selected side.
    """

    L = mp_pose.PoseLandmark

    if side == "left":
        return {
            "ear": get_landmark(landmarks, L.LEFT_EAR),
            "shoulder": get_landmark(landmarks, L.LEFT_SHOULDER),
            "elbow": get_landmark(landmarks, L.LEFT_ELBOW),
            "wrist": get_landmark(landmarks, L.LEFT_WRIST),
            "hip": get_landmark(landmarks, L.LEFT_HIP),
            "knee": get_landmark(landmarks, L.LEFT_KNEE),
            "ankle": get_landmark(landmarks, L.LEFT_ANKLE),
        }

    return {
        "ear": get_landmark(landmarks, L.RIGHT_EAR),
        "shoulder": get_landmark(landmarks, L.RIGHT_SHOULDER),
        "elbow": get_landmark(landmarks, L.RIGHT_ELBOW),
        "wrist": get_landmark(landmarks, L.RIGHT_WRIST),
        "hip": get_landmark(landmarks, L.RIGHT_HIP),
        "knee": get_landmark(landmarks, L.RIGHT_KNEE),
        "ankle": get_landmark(landmarks, L.RIGHT_ANKLE),
    }


def hip_offset_from_body_line(shoulder, hip, ankle):
    """
    Checks how far the hip is from the straight line between shoulder and ankle.

    Negative offset = hip is above the line
    Positive offset = hip is below the line
    """

    sx, sy = shoulder["x"], shoulder["y"]
    hx, hy = hip["x"], hip["y"]
    ax, ay = ankle["x"], ankle["y"]

    if abs(ax - sx) < 1e-6:
        return 0.0

    line_y_at_hip = sy + ((ay - sy) * (hx - sx) / (ax - sx))
    offset = hy - line_y_at_hip

    return float(offset)


def put_text(frame, text, position, color, scale=0.6, thickness=2):
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


def draw_metric(frame, label, value, y_position, ok=True):
    color = (0, 180, 0) if ok else (0, 0, 255)
    text = f"{label}: {value}"
    put_text(frame, text, (20, y_position), color, 0.55, 2)


# ============================================================
# Plank Analysis Logic
# ============================================================

def analyze_plank(landmarks):
    """
    Calculates plank angles and returns classification result.
    """

    side = choose_best_side(landmarks)
    lm = get_side_landmarks(landmarks, side)

    required_points = [
        lm["shoulder"],
        lm["elbow"],
        lm["wrist"],
        lm["hip"],
        lm["knee"],
        lm["ankle"]
    ]

    if not all(is_visible(p) for p in required_points):
        return {
            "valid": False,
            "status": "Pose not clear",
            "side": side,
            "reason": "Make sure shoulder, elbow, wrist, hip, knee, and ankle are visible."
        }

    shoulder = lm["shoulder"]
    elbow = lm["elbow"]
    wrist = lm["wrist"]
    hip = lm["hip"]
    knee = lm["knee"]
    ankle = lm["ankle"]
    ear = lm["ear"]

    shoulder_xy = point_xy(shoulder)
    elbow_xy = point_xy(elbow)
    wrist_xy = point_xy(wrist)
    hip_xy = point_xy(hip)
    knee_xy = point_xy(knee)
    ankle_xy = point_xy(ankle)

    body_angle = calculate_angle(shoulder_xy, hip_xy, ankle_xy)
    torso_angle = calculate_angle(shoulder_xy, hip_xy, knee_xy)
    leg_angle = calculate_angle(hip_xy, knee_xy, ankle_xy)
    elbow_angle = calculate_angle(shoulder_xy, elbow_xy, wrist_xy)

    shoulder_elbow_x_diff = abs(shoulder["x"] - elbow["x"])
    hip_line_offset = hip_offset_from_body_line(shoulder, hip, ankle)

    if is_visible(ear):
        head_angle = calculate_angle(point_xy(ear), shoulder_xy, hip_xy)
    else:
        head_angle = None

    body_ok = BODY_ALIGNMENT_MIN <= body_angle <= BODY_ALIGNMENT_MAX
    torso_ok = torso_angle >= TORSO_ALIGNMENT_MIN
    leg_ok = leg_angle >= LEG_ALIGNMENT_MIN
    elbow_ok = ELBOW_MIN <= elbow_angle <= ELBOW_MAX
    shoulder_elbow_ok = shoulder_elbow_x_diff <= SHOULDER_ELBOW_X_TOLERANCE
    hip_line_ok = abs(hip_line_offset) <= HIP_LINE_OFFSET_TOLERANCE

    if head_angle is not None:
        head_ok = head_angle >= HEAD_ALIGNMENT_MIN
    else:
        head_ok = True

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
    total_checks = len(checks)

    critical_ok = body_ok and torso_ok and leg_ok and hip_line_ok

    is_correct = critical_ok and passed_checks >= 5

    reasons = []

    if not body_ok or not hip_line_ok:
        if hip_line_offset < -HIP_LINE_OFFSET_TOLERANCE:
            reasons.append("Hips too high")
        elif hip_line_offset > HIP_LINE_OFFSET_TOLERANCE:
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

    if len(reasons) == 0:
        reasons.append("Good form")

    return {
        "valid": True,
        "side": side,
        "is_correct": is_correct,
        "status": "Correct Plank" if is_correct else "Incorrect Plank",
        "body_angle": body_angle,
        "torso_angle": torso_angle,
        "leg_angle": leg_angle,
        "elbow_angle": elbow_angle,
        "head_angle": head_angle,
        "shoulder_elbow_x_diff": shoulder_elbow_x_diff,
        "hip_line_offset": hip_line_offset,
        "checks": checks,
        "passed_checks": passed_checks,
        "total_checks": total_checks,
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

    print("Starting live plank angle detector...")
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

            analysis = analyze_plank(results.pose_landmarks.landmark)

            if analysis["valid"]:
                prediction_buffer.append(1 if analysis["is_correct"] else 0)

                correct_ratio = sum(prediction_buffer) / len(prediction_buffer)

                smoothed_correct = correct_ratio >= CORRECT_RATIO_REQUIRED

                status_text = "Correct Plank" if smoothed_correct else "Incorrect Plank"
                status_color = (0, 180, 0) if smoothed_correct else (0, 0, 255)

                reason_text = ", ".join(analysis["reasons"][:2])

                draw_metric(
                    frame,
                    "Body angle",
                    f"{analysis['body_angle']:.1f}",
                    95,
                    analysis["checks"]["Body straight"]
                )

                draw_metric(
                    frame,
                    "Torso angle",
                    f"{analysis['torso_angle']:.1f}",
                    120,
                    analysis["checks"]["Torso aligned"]
                )

                draw_metric(
                    frame,
                    "Leg angle",
                    f"{analysis['leg_angle']:.1f}",
                    145,
                    analysis["checks"]["Legs straight"]
                )

                draw_metric(
                    frame,
                    "Elbow angle",
                    f"{analysis['elbow_angle']:.1f}",
                    170,
                    analysis["checks"]["Elbow angle"]
                )

                if analysis["head_angle"] is not None:
                    draw_metric(
                        frame,
                        "Head angle",
                        f"{analysis['head_angle']:.1f}",
                        195,
                        analysis["checks"]["Head neutral"]
                    )

                draw_metric(
                    frame,
                    "Hip offset",
                    f"{analysis['hip_line_offset']:.3f}",
                    220,
                    analysis["checks"]["Hip on body line"]
                )

                draw_metric(
                    frame,
                    "Checks passed",
                    f"{analysis['passed_checks']}/{analysis['total_checks']}",
                    245,
                    smoothed_correct
                )

            else:
                prediction_buffer.clear()
                status_text = analysis["status"]
                reason_text = analysis["reason"]
                status_color = (0, 165, 255)

        # Status box
        cv2.rectangle(frame, (10, 10), (w - 10, 75), (255, 255, 255), -1)

        put_text(
            frame,
            status_text,
            (20, 40),
            status_color,
            scale=0.9,
            thickness=3
        )

        put_text(
            frame,
            reason_text,
            (20, 65),
            (0, 0, 0),
            scale=0.55,
            thickness=2
        )

        cv2.imshow("Live Plank Angle Detector", frame)

        key = cv2.waitKey(1) & 0xFF

        if key == ord("q"):
            break

    cap.release()
    cv2.destroyAllWindows()
    pose.close()


if __name__ == "__main__":
    main()