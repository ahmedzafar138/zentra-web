from pydantic import BaseModel, EmailStr, Field
from typing import List, Literal, Dict, Optional

class UserBase(BaseModel):
    email: EmailStr
    first_name: str
    last_name: str
    sex: Optional[Literal["male", "female", "other"]] = None
    activity_level: Optional[Literal["sedentary", "light", "moderate", "active", "very active"]] = None
    goals: Optional[Literal["loss", "gain", "maintenance"]] = None
    dietary_preference: Optional[Literal["vegan", "keto", "halal", "none"]] = None
    disliked_ingredients: Optional[List[str]] = []
    allergies: Optional[List[str]] = []
    is_active: bool = True
    is_superuser: bool = False

class UserCreate(UserBase):
    password: str

class UserRead(UserBase):
    id: int

    class Config:
        from_attributes = True  # ORM mode

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class TokenPayload(BaseModel):
    sub: str | None = None
    exp: int | None = None

