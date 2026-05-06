from sqlalchemy.orm import Session
from app.domains.users import models, schemas

class UserRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_email(self, email: str) -> models.User | None:
        return self.db.query(models.User).filter(models.User.email == email).first()

    def create(self, obj_in: schemas.UserCreate) -> models.User:
        db_obj = models.User(
            email=obj_in.email,
            hashed_password=obj_in.password,
            first_name=obj_in.first_name,
            last_name=obj_in.last_name,
            sex=obj_in.sex,
            activity_level=obj_in.activity_level,
            goals=obj_in.goals,
            dietary_preference=obj_in.dietary_preference,
            disliked_ingredients=obj_in.disliked_ingredients,
            allergies=obj_in.allergies,
        )
        self.db.add(db_obj)
        self.db.commit()
        self.db.refresh(db_obj)
        return db_obj

