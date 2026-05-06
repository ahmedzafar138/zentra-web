from typing import Dict
from fastapi import APIRouter
from app.domains.meals.schemas import WeeklyMeals, ShoppingListResponse
from app.domains.meals import schemas, service


router = APIRouter()

@router.post("/generate", response_model=schemas.ShoppingListResponse, tags=["shopping"])
def generate(payload: Dict[str, dict] | WeeklyMeals):
    """
    Accepts either:
    A) Raw dict with keys 'Day 1'...'Day 7', each containing Breakfast/Lunch/Dinner/Snacks (Meal objects)
    B) WeeklyMeals(days=...)
    """
    # weekly_days = payload.days if isinstance(payload, WeeklyMeals) else payload
    data = service.generate_shopping_list(payload)
    return {"data": data}
