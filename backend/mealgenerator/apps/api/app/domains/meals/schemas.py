from pydantic import BaseModel, EmailStr, Field
from typing import List, Literal, Dict, Optional

# Meal schema
class Meal(BaseModel):
    title: Optional[str] = None
    recipe: Optional[str] = None          
    ingredients: Optional[List[str]] = None  

class DayMeals(BaseModel):
    Breakfast: Meal
    Lunch: Meal
    Dinner: Meal
    Snacks: Meal

class WeeklyMeals(BaseModel):
    days: Dict[str, DayMeals] = Field(
        ..., description="Keys like 'Day 1'...'Day 7'"
    )

class ShoppingListResponse(BaseModel):
    data: Dict[str, List[str]]  