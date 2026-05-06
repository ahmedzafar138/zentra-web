from app.db.base import Base, engine
import app.domains.users.models  # Import all models so SQLAlchemy knows about them

print("Creating tables...")
Base.metadata.create_all(bind=engine)
print("Done.")
