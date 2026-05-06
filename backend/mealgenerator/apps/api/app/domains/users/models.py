from sqlalchemy import Column, Integer, String, Boolean, DateTime, func, Enum
from sqlalchemy.dialects.postgresql import ARRAY
from app.db.base import Base
import enum

class SexEnum(str, enum.Enum):
    male = "male"
    female = "female"
    other = "other"

class ActivityLevelEnum(str, enum.Enum):
    sedentary = "sedentary"
    light = "light"
    moderate = "moderate"
    active = "active"
    very_active = "very active"

class GoalsEnum(str, enum.Enum):
    loss = "loss"
    gain = "gain"
    maintenance = "maintenance"

class DietaryPreferenceEnum(str, enum.Enum):
    vegan = "vegan"
    keto = "keto"
    halal = "halal"
    none = "none"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    sex = Column(Enum(SexEnum), nullable=True)
    activity_level = Column(Enum(ActivityLevelEnum), nullable=True)
    goals = Column(Enum(GoalsEnum), nullable=True)
    dietary_preference = Column(Enum(DietaryPreferenceEnum), nullable=True)
    disliked_ingredients = Column(ARRAY(String), nullable=True, default=[])
    allergies = Column(ARRAY(String), nullable=True, default=[])
    is_active = Column(Boolean, default=True, nullable=False)
    is_superuser = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
