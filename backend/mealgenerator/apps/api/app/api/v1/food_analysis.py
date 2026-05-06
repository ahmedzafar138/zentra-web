from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from pydantic import BaseModel
from typing import Dict, Any, Optional
from PIL import Image
import io

from app.core.food_analysis import get_food_analysis_service, FoodAnalysisService

router = APIRouter()

class FoodAnalysisResponse(BaseModel):
    success: bool
    analysis: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

@router.post("/analyze-image", response_model=FoodAnalysisResponse)
async def analyze_food_image(
    file: UploadFile = File(...),
    service: FoodAnalysisService = Depends(get_food_analysis_service)
):
    """
    Analyze a food image and return nutritional information.
    
    Upload an image file and get detailed nutritional analysis including:
    - Food identification
    - Calories per 100g
    - Macronutrients (carbs, protein, fat, fiber)
    - Micronutrients (vitamins and minerals)
    """
    try:
        # Validate file type
        if not file.content_type or not file.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="File must be an image")
        
        # Read the image file
        image_data = await file.read()
        
        # Open image with PIL
        image = Image.open(io.BytesIO(image_data))
        
        # Analyze the food image
        raw_analysis = service.analyze_food_image_enhanced(image)
        
        if 'error' in raw_analysis:
            return FoodAnalysisResponse(
                success=False,
                error=raw_analysis['error']
            )
        
        # Format the analysis for better API response
        formatted_analysis = service.format_nutrition_output(raw_analysis)
        
        return FoodAnalysisResponse(
            success=True,
            analysis=formatted_analysis
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Analysis failed: {str(e)}"
        )
