from datetime import timedelta
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.core import security
from app.core.config import settings
from app.domains.users import schemas, repo

class AuthService:
    def __init__(self, db: Session):
        self.user_repo = repo.UserRepository(db)

    def register_user(self, user_in: schemas.UserCreate) -> schemas.UserRead:
        existing = self.user_repo.get_by_email(user_in.email)
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")

        hashed_password = security.get_password_hash(user_in.password)
        user_in.password = hashed_password
        user = self.user_repo.create(user_in)
        return schemas.UserRead.from_orm(user)

    def authenticate_user(self, email: str, password: str) -> schemas.UserRead | None:
        user = self.user_repo.get_by_email(email)
        if not user:
            return None
        if not security.verify_password(password, user.hashed_password):
            return None
        return schemas.UserRead.from_orm(user)

    def create_tokens(self, user_id: int) -> schemas.Token:
        access = security.create_access_token(
            subject=user_id,
            expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        )
        refresh = security.create_refresh_token(
            subject=user_id,
            expires_delta=timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        )
        return schemas.Token(access_token=access, refresh_token=refresh)

    