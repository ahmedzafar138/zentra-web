from fastapi import APIRouter
from app.api.v1 import auth
from app.api.v1 import shopping
from app.api.v1 import meal_planning
from app.api.v1 import recipe

api_router = APIRouter()

# Auth routes
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])

#Shopping List routes
api_router.include_router(shopping.router, prefix="/shopping_list", tags=["shopping_list"])

# Meal planning routes
api_router.include_router(
    meal_planning.router, 
    prefix="/meal-planning", 
    tags=["meal-planning"]
)

# Recipe routes
api_router.include_router(
    recipe.router,
    prefix="/recipe",
    tags=["recipe"]
)

# Food analysis depends on local Torch/vision DLLs. Keep it optional so meal
# generation can still run on machines where those native deps are unavailable.
try:
    from app.api.v1 import food_analysis

    api_router.include_router(
        food_analysis.router,
        prefix="/food-analysis",
        tags=["food-analysis"]
    )
except Exception as exc:
    print(f"Food analysis routes disabled: {exc}")
