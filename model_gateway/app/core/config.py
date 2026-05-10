from functools import lru_cache
from pathlib import Path
import os

from pydantic import BaseModel, Field


class Settings(BaseModel):
    """Runtime settings for the model gateway."""

    app_name: str = "Zentra Model Gateway"
    api_prefix: str = "/api/v1"
    cors_origins: list[str] = Field(default_factory=lambda: ["*"])
    bicep_curl_model_path: Path
    bicep_curl_reps_path: Path
    pushup_model_path: Path
    pushup_scaler_path: Path
    pushup_info_path: Path
    dumbbell_fly_model_path: Path
    dumbbell_fly_close_threshold: float = 0.6
    dumbbell_fly_open_threshold: float = 1.4
    dumbbell_fly_min_frames: int = 3
    dumbbell_fly_min_rep_frames: int = 10
    dumbbell_fly_max_sequence_length: int = 297
    dumbbell_fly_prediction_threshold: float = 0.5
    bicep_curl_up_threshold: float = 80.0
    bicep_curl_down_threshold: float = 130.0
    bicep_curl_min_frames: int = 3
    bicep_curl_min_rep_frames: int = 4
    squat_model_path: Path
    squat_model_threshold: float = 0.75
    squat_down_threshold: float = 115.0
    squat_end_up_threshold: float = 145.0
    squat_min_frames: int = 3
    squat_min_rep_frames: int = 8
    squat_rule_min_depth_angle: float = 120.0
    squat_rule_min_knee_range: float = 35.0
    squat_rule_return_standing_angle: float = 140.0
    squat_rule_max_torso_lean: float = 60.0
    squat_rule_max_knee_imbalance: float = 35.0
    squat_rule_min_visibility: float = 0.55
    deadlift_visibility_threshold: float = 0.55
    deadlift_smoothing_window: int = 8
    deadlift_correct_ratio_required: float = 0.65
    deadlift_start_hip_angle: float = 145.0
    deadlift_bottom_hip_angle: float = 120.0
    deadlift_top_hip_angle: float = 160.0
    deadlift_min_frames: int = 3
    deadlift_min_rep_frames: int = 8
    deadlift_back_min_angle: float = 145.0
    deadlift_hip_min_angle: float = 45.0
    deadlift_hip_max_angle: float = 175.0
    deadlift_knee_min_angle: float = 70.0
    deadlift_knee_max_angle: float = 175.0
    deadlift_shoulder_hip_x_tolerance: float = 0.18
    deadlift_knee_foot_x_tolerance: float = 0.22
    plank_visibility_threshold: float = 0.55
    plank_body_alignment_min: float = 160.0
    plank_body_alignment_max: float = 180.0
    plank_torso_alignment_min: float = 160.0
    plank_leg_alignment_min: float = 160.0
    plank_elbow_min: float = 75.0
    plank_elbow_max: float = 120.0
    plank_head_alignment_min: float = 145.0
    plank_shoulder_elbow_x_tolerance: float = 0.13
    plank_hip_line_offset_tolerance: float = 0.08
    plank_smoothing_window: int = 10
    plank_correct_ratio_required: float = 0.65
    load_models_on_startup: bool = True


def _gateway_root() -> Path:
    return Path(__file__).resolve().parents[2]


@lru_cache
def get_settings() -> Settings:
    root = _gateway_root()
    model_dir = root / "Bicep_Curl_Done"
    pushup_model_dir = root / "Pushups Inference"
    squat_model_dir = root / "Squats Inference"
    dumbbell_fly_model_dir = root / "dumbellfly"

    origins = os.getenv("MODEL_GATEWAY_CORS_ORIGINS", "*")
    cors_origins = [origin.strip() for origin in origins.split(",") if origin.strip()]

    return Settings(
        cors_origins=cors_origins or ["*"],
        bicep_curl_model_path=Path(
            os.getenv("BICEP_CURL_MODEL_PATH", model_dir / "Try_2.keras")
        ),
        bicep_curl_reps_path=Path(
            os.getenv("BICEP_CURL_REPS_PATH", model_dir / "reps2.pkl")
        ),
        pushup_model_path=Path(
            os.getenv("PUSHUP_MODEL_PATH", pushup_model_dir / "pushup_correct_incorrect_model.keras")
        ),
        pushup_scaler_path=Path(
            os.getenv("PUSHUP_SCALER_PATH", pushup_model_dir / "pushup_scaler.pkl")
        ),
        pushup_info_path=Path(
            os.getenv("PUSHUP_INFO_PATH", pushup_model_dir / "pushup_training_info.json")
        ),
        dumbbell_fly_model_path=Path(
            os.getenv("DUMBBELL_FLY_MODEL_PATH", dumbbell_fly_model_dir / "DBF_model_1_acc1_.keras")
        ),
        dumbbell_fly_close_threshold=float(os.getenv("DUMBBELL_FLY_CLOSE_THRESHOLD", "0.6")),
        dumbbell_fly_open_threshold=float(os.getenv("DUMBBELL_FLY_OPEN_THRESHOLD", "1.4")),
        dumbbell_fly_min_frames=int(os.getenv("DUMBBELL_FLY_MIN_FRAMES", "3")),
        dumbbell_fly_min_rep_frames=int(os.getenv("DUMBBELL_FLY_MIN_REP_FRAMES", "10")),
        dumbbell_fly_max_sequence_length=int(os.getenv("DUMBBELL_FLY_MAX_SEQUENCE_LENGTH", "297")),
        dumbbell_fly_prediction_threshold=float(os.getenv("DUMBBELL_FLY_PREDICTION_THRESHOLD", "0.5")),
        bicep_curl_up_threshold=float(os.getenv("BICEP_CURL_UP_THRESHOLD", "80")),
        bicep_curl_down_threshold=float(os.getenv("BICEP_CURL_DOWN_THRESHOLD", "130")),
        bicep_curl_min_frames=int(os.getenv("BICEP_CURL_MIN_FRAMES", "3")),
        bicep_curl_min_rep_frames=int(os.getenv("BICEP_CURL_MIN_REP_FRAMES", "4")),
        squat_model_path=Path(
            os.getenv("SQUAT_MODEL_PATH", squat_model_dir / "Squats_model_fixed_v2.keras")
        ),
        squat_model_threshold=float(os.getenv("SQUAT_MODEL_THRESHOLD", "0.75")),
        squat_down_threshold=float(os.getenv("SQUAT_DOWN_THRESHOLD", "115")),
        squat_end_up_threshold=float(os.getenv("SQUAT_END_UP_THRESHOLD", "145")),
        squat_min_frames=int(os.getenv("SQUAT_MIN_FRAMES", "3")),
        squat_min_rep_frames=int(os.getenv("SQUAT_MIN_REP_FRAMES", "8")),
        squat_rule_min_depth_angle=float(os.getenv("SQUAT_RULE_MIN_DEPTH_ANGLE", "120")),
        squat_rule_min_knee_range=float(os.getenv("SQUAT_RULE_MIN_KNEE_RANGE", "35")),
        squat_rule_return_standing_angle=float(os.getenv("SQUAT_RULE_RETURN_STANDING_ANGLE", "140")),
        squat_rule_max_torso_lean=float(os.getenv("SQUAT_RULE_MAX_TORSO_LEAN", "60")),
        squat_rule_max_knee_imbalance=float(os.getenv("SQUAT_RULE_MAX_KNEE_IMBALANCE", "35")),
        squat_rule_min_visibility=float(os.getenv("SQUAT_RULE_MIN_VISIBILITY", "0.55")),
        deadlift_visibility_threshold=float(os.getenv("DEADLIFT_VISIBILITY_THRESHOLD", "0.55")),
        deadlift_smoothing_window=int(os.getenv("DEADLIFT_SMOOTHING_WINDOW", "8")),
        deadlift_correct_ratio_required=float(os.getenv("DEADLIFT_CORRECT_RATIO_REQUIRED", "0.65")),
        deadlift_start_hip_angle=float(os.getenv("DEADLIFT_START_HIP_ANGLE", "145")),
        deadlift_bottom_hip_angle=float(os.getenv("DEADLIFT_BOTTOM_HIP_ANGLE", "120")),
        deadlift_top_hip_angle=float(os.getenv("DEADLIFT_TOP_HIP_ANGLE", "160")),
        deadlift_min_frames=int(os.getenv("DEADLIFT_MIN_FRAMES", "3")),
        deadlift_min_rep_frames=int(os.getenv("DEADLIFT_MIN_REP_FRAMES", "8")),
        deadlift_back_min_angle=float(os.getenv("DEADLIFT_BACK_MIN_ANGLE", "145")),
        deadlift_hip_min_angle=float(os.getenv("DEADLIFT_HIP_MIN_ANGLE", "45")),
        deadlift_hip_max_angle=float(os.getenv("DEADLIFT_HIP_MAX_ANGLE", "175")),
        deadlift_knee_min_angle=float(os.getenv("DEADLIFT_KNEE_MIN_ANGLE", "70")),
        deadlift_knee_max_angle=float(os.getenv("DEADLIFT_KNEE_MAX_ANGLE", "175")),
        deadlift_shoulder_hip_x_tolerance=float(os.getenv("DEADLIFT_SHOULDER_HIP_X_TOLERANCE", "0.18")),
        deadlift_knee_foot_x_tolerance=float(os.getenv("DEADLIFT_KNEE_FOOT_X_TOLERANCE", "0.22")),
        plank_visibility_threshold=float(os.getenv("PLANK_VISIBILITY_THRESHOLD", "0.55")),
        plank_body_alignment_min=float(os.getenv("PLANK_BODY_ALIGNMENT_MIN", "160")),
        plank_body_alignment_max=float(os.getenv("PLANK_BODY_ALIGNMENT_MAX", "180")),
        plank_torso_alignment_min=float(os.getenv("PLANK_TORSO_ALIGNMENT_MIN", "160")),
        plank_leg_alignment_min=float(os.getenv("PLANK_LEG_ALIGNMENT_MIN", "160")),
        plank_elbow_min=float(os.getenv("PLANK_ELBOW_MIN", "75")),
        plank_elbow_max=float(os.getenv("PLANK_ELBOW_MAX", "120")),
        plank_head_alignment_min=float(os.getenv("PLANK_HEAD_ALIGNMENT_MIN", "145")),
        plank_shoulder_elbow_x_tolerance=float(os.getenv("PLANK_SHOULDER_ELBOW_X_TOLERANCE", "0.13")),
        plank_hip_line_offset_tolerance=float(os.getenv("PLANK_HIP_LINE_OFFSET_TOLERANCE", "0.08")),
        plank_smoothing_window=int(os.getenv("PLANK_SMOOTHING_WINDOW", "10")),
        plank_correct_ratio_required=float(os.getenv("PLANK_CORRECT_RATIO_REQUIRED", "0.65")),
        load_models_on_startup=os.getenv("MODEL_GATEWAY_LOAD_MODELS_ON_STARTUP", "true").lower()
        in {"1", "true", "yes", "on"},
    )
