from fastapi import APIRouter
from pydantic import BaseModel
from typing import Dict
from app.core.generate_recipe import generate_daily_recipes, generate_recipe

router = APIRouter()

class RecipeRequest(BaseModel):
    meal_name: str

class DailyRecipesRequest(BaseModel):
    meals: Dict[str, str]

@router.post("/generate-recipe", response_model=Dict)
def generate_recipe_endpoint(request: RecipeRequest):
    """
    Generate a recipe for the given meal name.
    """
    return generate_recipe(request.meal_name)

@router.post("/generate-daily-recipes", response_model=Dict)
def generate_daily_recipes_endpoint(request: DailyRecipesRequest):
    """
    Generate recipes for a full day in one request.
    """
    return generate_daily_recipes(request.meals)
