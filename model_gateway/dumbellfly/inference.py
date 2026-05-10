# ======================
# Imports
# ======================
import cv2
import numpy as np
import tensorflow as tf
import mediapipe as mp
from tensorflow.keras.preprocessing.sequence import pad_sequences

# ======================
# Load Model
# ======================
# Patch Layer.__init__ to ignore 'quantization_config' for all layers added by newer Keras versions
original_layer_init = tf.keras.layers.Layer.__init__
def safe_layer_init(self, *args, **kwargs):
    kwargs.pop('quantization_config', None)
    return original_layer_init(self, *args, **kwargs)
tf.keras.layers.Layer.__init__ = safe_layer_init

MODEL_PATH = "DBF_model_1_acc1_.keras"
model = tf.keras.models.load_model(MODEL_PATH, custom_objects={'Orthogonal': tf.keras.initializers.Orthogonal})

MAX_LEN = 297  # ✅ your value

# ======================
# Pose Setup
# ======================
mp_pose = mp.solutions.pose
mp_drawing = mp.solutions.drawing_utils

SELECTED_LANDMARKS = [
    mp_pose.PoseLandmark.RIGHT_SHOULDER,
    mp_pose.PoseLandmark.LEFT_SHOULDER,
    mp_pose.PoseLandmark.RIGHT_ELBOW,
    mp_pose.PoseLandmark.LEFT_ELBOW,
    mp_pose.PoseLandmark.RIGHT_WRIST,
    mp_pose.PoseLandmark.LEFT_WRIST
]

def extract_keypoints(results):
    if results.pose_landmarks:
        return [[results.pose_landmarks.landmark[lm].x,
                 results.pose_landmarks.landmark[lm].y,
                 results.pose_landmarks.landmark[lm].z,
                 results.pose_landmarks.landmark[lm].visibility]
                for lm in SELECTED_LANDMARKS]
    else:
        return [[0]*4 for _ in SELECTED_LANDMARKS]

# ======================
# Distance Function
# ======================
def get_normalized_wrist_distance(keypoints):
    r_wrist = np.array(keypoints[4][:2])
    l_wrist = np.array(keypoints[5][:2])

    r_shoulder = np.array(keypoints[0][:2])
    l_shoulder = np.array(keypoints[1][:2])

    wrist_dist = np.linalg.norm(r_wrist - l_wrist)
    shoulder_dist = np.linalg.norm(r_shoulder - l_shoulder)

    return wrist_dist / (shoulder_dist + 1e-6)

# ======================
# Webcam Inference
# ======================
def run_webcam():

    cap = cv2.VideoCapture(0)

    direction = 0
    frame_buffer = []

    CLOSE_THRESHOLD = 0.6
    OPEN_THRESHOLD = 1.4
    MIN_FRAMES = 3

    correct_reps = 0
    incorrect_reps = 0
    last_label = "..."

    with mp_pose.Pose(min_detection_confidence=0.5,
                      min_tracking_confidence=0.5) as pose:

        up_count, down_count = 0, 0

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            frame = cv2.flip(frame, 1)  # mirror
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = pose.process(rgb)

            keypoints = extract_keypoints(results)
            dist = get_normalized_wrist_distance(keypoints)

            # Draw pose
            if results.pose_landmarks:
                mp_drawing.draw_landmarks(
                    frame, results.pose_landmarks, mp_pose.POSE_CONNECTIONS)

            # ======================
            # WAIT OPEN
            # ======================
            if direction == 0 and dist > OPEN_THRESHOLD:
                down_count += 1
                if down_count >= MIN_FRAMES:
                    direction = 1
                    down_count = 0
            else:
                if direction == 0:
                    down_count = 0

            # ======================
            # DETECT CLOSE
            # ======================
            if direction == 1 and dist < CLOSE_THRESHOLD:
                up_count += 1
                if up_count >= MIN_FRAMES:
                    direction = 2
                    frame_buffer = []
                    up_count = 0
            else:
                if direction == 1:
                    up_count = 0

            # ======================
            # RECORD
            # ======================
            if direction == 2:
                frame_buffer.append(np.array(keypoints).flatten())

            # ======================
            # END REP → PREDICT
            # ======================
            if direction == 2 and dist > OPEN_THRESHOLD:
                down_count += 1
                if down_count >= MIN_FRAMES:

                    if len(frame_buffer) > 10:
                        seq = pad_sequences(
                            [frame_buffer],
                            maxlen=MAX_LEN,
                            dtype='float32',
                            padding='post'
                        )

                        pred = model.predict(seq, verbose=0)[0][0]

                        if pred > 0.5:
                            last_label = "CORRECT"
                            correct_reps += 1
                        else:
                            last_label = "INCORRECT"
                            incorrect_reps += 1

                        total_reps = correct_reps + incorrect_reps
                        print(f"Rep {total_reps}: {last_label} ({pred:.2f})")

                    frame_buffer = []
                    direction = 0
                    down_count = 0
            else:
                if direction == 2:
                    down_count = 0

            # ======================
            # Display
            # ======================
            cv2.putText(frame, f"Correct: {correct_reps}", (10, 40),
                        cv2.FONT_HERSHEY_SIMPLEX, 1, (0,255,0), 2)

            cv2.putText(frame, f"Incorrect: {incorrect_reps}", (10, 80),
                        cv2.FONT_HERSHEY_SIMPLEX, 1, (0,0,255), 2)

            label_color = (0,255,0) if last_label == "CORRECT" else ((0,0,255) if last_label == "INCORRECT" else (0,255,255))
            cv2.putText(frame, f"Last: {last_label}", (10, 120),
                        cv2.FONT_HERSHEY_SIMPLEX, 1, label_color, 2)

            cv2.imshow("DBF Form Checker", frame)

            # Press Q to quit
            if cv2.waitKey(10) & 0xFF == ord('q'):
                break

    cap.release()
    cv2.destroyAllWindows()

# ======================
# RUN
# ======================
run_webcam()