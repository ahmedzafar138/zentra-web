from app.db.base import Base, engine
import app.domains.users.models  # Import all models so SQLAlchemy knows about them

print("Dropping all tables...")
Base.metadata.drop_all(bind=engine)
print("Creating tables with new schema...")
Base.metadata.create_all(bind=engine)
print("Done! Database tables recreated successfully.")
