from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import logging

from app.db.base import get_db
from app.domains.users import schemas, service

router = APIRouter()

# Setup logging
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

@router.post("/register", response_model=schemas.UserRead)
def register(user_in: schemas.UserCreate, db: Session = Depends(get_db)):
    logger.info("=" * 50)
    logger.info("🔵 REGISTER ENDPOINT HIT")
    logger.info(f"📧 Email: {user_in.email}")
    logger.info(f"📝 Data received: {user_in.model_dump(exclude={'password'})}")
    logger.info("=" * 50)
    try:
        result = service.AuthService(db).register_user(user_in)
        logger.info("✅ User registered successfully")
        return result
    except Exception as e:
        logger.error(f"❌ Registration failed: {str(e)}")
        raise

@router.post("/login", response_model=schemas.Token)
def login(user_in: schemas.UserLogin, db: Session = Depends(get_db)):
    logger.info("=" * 50)
    logger.info("🔵 LOGIN ENDPOINT HIT")
    logger.info(f"📧 Email: {user_in.email}")
    logger.info("=" * 50)
    auth_service = service.AuthService(db)
    user = auth_service.authenticate_user(user_in.email, user_in.password)
    if not user:
        logger.warning("❌ Invalid credentials")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    logger.info("✅ Login successful")
    return auth_service.create_tokens(user.id)

@router.get("/me", response_model=schemas.UserRead)
def get_current_user(db: Session = Depends(get_db)):
    """Get current user information - placeholder for now"""
    logger.info("🔵 /me ENDPOINT HIT")
    # This is a placeholder - you'll need to implement proper JWT auth dependency
    # For now, return a basic response to prevent 404
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required"
    )
