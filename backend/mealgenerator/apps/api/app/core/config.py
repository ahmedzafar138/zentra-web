from pydantic_settings import BaseSettings
from functools import lru_cache
from pathlib import Path

# Get the directory where this config.py file is located
BASE_DIR = Path(__file__).resolve().parent.parent.parent
ENV_FILE = BASE_DIR / ".env"

class Settings(BaseSettings):
    PROJECT_NAME: str = "AI Meals"
    API_V1_STR: str = "/api/v1"

    # Security
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    ALGORITHM: str = "HS256"

    # Database
    SQLALCHEMY_DATABASE_URI: str
    
    # new for ingestion & vector db
    USDA_API_KEY: str
    OPENAI_API_KEY: str

    # Agent Configuration
    AGENT_MAX_ITERATIONS: int = 20
    AGENT_TEMPERATURE: float = 0.0
    AGENT_MODEL: str = "gpt-4o"
    
    # Food Analysis Service Settings
    GEMINI_API_KEY: str = "AIzaSyAgR7H75RiWVAqoUAxsJL6j0wj8jVBZ60o"
    
    # Model Configuration
    VISION_MODEL_NAME: str = "Salesforce/blip-image-captioning-large"
    VISION_MODEL_FALLBACK: str = "Salesforce/blip-image-captioning-base"
    GEMINI_MODEL_NAME: str = "gemini-2.5-flash"

    class Config:
        env_file = str(ENV_FILE)
        env_file_encoding = "utf-8"

@lru_cache
def get_settings():
    return Settings()

settings = get_settings()