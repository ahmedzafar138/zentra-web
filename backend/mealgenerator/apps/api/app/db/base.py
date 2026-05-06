from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings

# PostgreSQL engine for Neon database
engine = create_engine(
    settings.SQLALCHEMY_DATABASE_URI,
    future=True,
    echo=False,  # set True for SQL debug logs
    pool_pre_ping=True  # Enable connection health checks for serverless databases
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, future=True)

Base = declarative_base()

# Dependency for FastAPI
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
        
        
