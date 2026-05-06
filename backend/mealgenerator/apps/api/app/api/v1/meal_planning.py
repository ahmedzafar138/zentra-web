from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Dict, Any, Optional
import logging

from app.core.meal_agent import get_meal_agent, MealPlanningAgent

router = APIRouter()

# Setup logging
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

class MealPlanRequest(BaseModel):
    user_profile: str
    dietary_preferences: Optional[str] = None
    additional_requirements: Optional[str] = None

class MealPlanResponse(BaseModel):
    success: bool
    meal_plan: Optional[str] = None
    message: str

@router.post("/generate", response_model=MealPlanResponse)
async def generate_meal_plan(
    request: MealPlanRequest,
    agent: MealPlanningAgent = Depends(get_meal_agent)
):
    """
    Generate a personalized meal plan based on user profile and preferences using agentic workflow.
    
    - **user_profile**: User's physical stats and goals (height, weight, dietary type, goals, etc.)
    - **dietary_preferences**: Optional additional dietary preferences
    - **additional_requirements**: Any additional requirements or constraints
    """
    try:
        logger.info("=" * 70)
        logger.info("🍽️  MEAL PLAN GENERATION STARTED")
        logger.info(f"📝 User Profile: {request.user_profile}")
        logger.info(f"🥗 Dietary Preferences: {request.dietary_preferences}")
        logger.info(f"➕ Additional Requirements: {request.additional_requirements}")
        
        # Construct the full user input
        user_input = request.user_profile
        if request.dietary_preferences:
            user_input += f" {request.dietary_preferences}"
        if request.additional_requirements:
            user_input += f" {request.additional_requirements}"
            
        # Add the standard request format
        user_input += " Suggest me breakfast, lunch, dinner and snacks now. For each meal: list items, portion guidance, and macro breakdown (calories, protein g, carbs g, fat g; include sugar and fiber when available), don't reason way too much."
        
        logger.info(f"📨 Full input to AI: {user_input[:200]}...")
        logger.info("🤖 Calling AI agent...")
        
        result = agent.generate_meal_plan(user_input)
        
        logger.info(f"✅ AI Response received - Success: {result['success']}")
        logger.info(f"📄 Meal Plan Length: {len(result.get('meal_plan', '') or '')}")
        logger.info(f"💬 Message: {result['message']}")
        if result.get('meal_plan'):
            logger.info(f"🍽️  First 300 chars of meal plan: {result['meal_plan'][:300]}...")
        logger.info("=" * 70)
        
        response = MealPlanResponse(
            success=result["success"],
            meal_plan=result["meal_plan"],
            message=result["message"]
        )
        
        logger.info(f"📤 Sending response to frontend: success={response.success}")
        return response
        
    except Exception as e:
        logger.error(f"❌ Error in meal plan generation: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )

@router.post("/generate-daily", response_model=MealPlanResponse)
async def generate_daily_meal_plan(
    request: MealPlanRequest,
    agent: MealPlanningAgent = Depends(get_meal_agent)
):
    """
    Generate a daily meal plan (alias for /generate endpoint).
    Frontend compatibility endpoint.
    """
    return await generate_meal_plan(request, agent)

@router.post("/generate-weekly", response_model=MealPlanResponse)
async def generate_weekly_meal_plan(
    request: MealPlanRequest,
    agent: MealPlanningAgent = Depends(get_meal_agent)
):
    """
    Generate a 7-day meal plan for frontend/mobile clients.
    """
    try:
        user_input = request.user_profile
        if request.dietary_preferences:
            user_input += f" {request.dietary_preferences}"
        if request.additional_requirements:
            user_input += f" {request.additional_requirements}"

        user_input += (
            " Generate a complete 7-day weekly meal plan. "
            "Return exactly day1, day2, day3, day4, day5, day6, and day7. "
            "Every day must include breakfast, lunch, dinner, and snacks. "
            "Every meal must include food, portion, and macros with protein_g, fat_g, "
            "carbohydrates_g, and energy_kcal. Use practical meals and avoid duplicate days."
        )

        result = agent.generate_meal_plan(user_input, days=7)

        if not result.get("success") or not result.get("meal_plan"):
            return MealPlanResponse(
                success=False,
                meal_plan=None,
                message=result.get("message") or "Weekly meal plan generation failed."
            )

        return MealPlanResponse(
            success=result["success"],
            meal_plan=result["meal_plan"],
            message=result["message"]
        )
    except Exception as e:
        logger.error(f"âŒ Error in weekly meal plan generation: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )
