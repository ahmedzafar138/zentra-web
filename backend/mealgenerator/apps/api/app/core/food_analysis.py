import torch
from transformers import BlipProcessor, BlipForConditionalGeneration
from PIL import Image
import requests
import json
import pandas as pd
import numpy as np
import google.generativeai as genai
from typing import Dict, List, Optional
import warnings
import io
import os
from app.core.config import settings

warnings.filterwarnings('ignore')

class FoodAnalysisService:
    def __init__(self, gemini_api_key: str):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.gemini_api_key = gemini_api_key
        self.processor = None
        self.model = None
        self.gemini_model = None
        self._initialize_models()
    
    def _initialize_models(self):
        """Initialize vision model and Gemini API"""
        # Load BLIP-2 model for image understanding
        # try:
        #     self.processor = BlipProcessor.from_pretrained("Salesforce/blip-image-captioning-large")
        #     self.model = BlipForConditionalGeneration.from_pretrained("Salesforce/blip-image-captioning-large")
        #     self.model.to(self.device)
        # except Exception as e:
        #     # Fallback to smaller model
        #     self.processor = BlipProcessor.from_pretrained("Salesforce/blip-image-captioning-base")
        #     self.model = BlipForConditionalGeneration.from_pretrained("Salesforce/blip-image-captioning-base")
        #     self.model.to(self.device)
        
        # Setup Gemini API
        try:
            genai.configure(api_key=self.gemini_api_key)
            self.gemini_model = genai.GenerativeModel("gemini-2.5-flash")
            # Test the API
            test_response = self.gemini_model.generate_content("Hello")
        except Exception as e:
            self.gemini_model = None

    def preprocess_image(self, image):
        """Preprocess image for better analysis"""
        try:
            # Resize if too large
            max_size = 512
            if max(image.size) > max_size:
                image.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)

            # Convert to RGB if needed
            if image.mode != 'RGB':
                image = image.convert('RGB')

            return image
        except Exception as e:
            return image

    def detect_food_in_image(self, image):
        """Detect if image contains food and identify what food it is"""
        try:
            # Preprocess image
            processed_image = self.preprocess_image(image)

            # Generate detailed description
            inputs = self.processor(processed_image, return_tensors="pt").to(self.device)

            with torch.no_grad():
                # Generate more detailed caption
                generated_ids = self.model.generate(
                    **inputs,
                    max_new_tokens=30,
                    num_beams=5,
                    temperature=0.7
                )

            description = self.processor.decode(generated_ids[0], skip_special_tokens=True)
            return description.lower()

        except Exception as e:
            return ""

    def is_food_item_intelligent(self, description, image=None):
        """
        Intelligently determine if the description/image contains food using Gemini API
        Returns: dict with 'is_food' (bool), 'confidence' (str), and 'reasoning' (str)
        """
        if self.gemini_model is None:
            return self.is_food_item_fallback(description)

        try:
            prompt = f"""
            Analyze the following image description and determine if it contains food items that can be consumed by humans.

            Description: "{description}"

            Consider the following guidelines:
            - Food items include: fruits, vegetables, grains, proteins, dairy, beverages, prepared meals, snacks, desserts
            - Food items can be raw, cooked, processed, or prepared
            - Include items like bread, rice, pasta, meat, fish, eggs, nuts, seeds
            - Include beverages like milk, juice, coffee, tea, smoothies
            - Exclude: non-edible items, decorative food models, toys that look like food, inedible plants
            - Exclude: empty plates/bowls without food, cooking utensils, kitchen appliances

            Respond ONLY in this exact JSON format:
            {{
                "is_food": true/false,
                "confidence": "high/medium/low",
                "reasoning": "brief explanation of why this is or isn't food",
                "food_category": "category if food (e.g., fruit, vegetable, prepared_meal, beverage) or null if not food"
            }}

            Be strict but reasonable - if unsure, err on the side of caution and mark as not food.
            """

            response = self.gemini_model.generate_content(prompt)
            response_text = response.text.strip()

            # Extract JSON from response
            start = response_text.find('{')
            end = response_text.rfind('}') + 1

            if start != -1 and end != -1:
                json_text = response_text[start:end]
                result = json.loads(json_text)

                # Validate the response structure
                if 'is_food' in result and 'confidence' in result and 'reasoning' in result:
                    return result

            return self.is_food_item_fallback(description)

        except Exception as e:
            return self.is_food_item_fallback(description)

    def is_food_item_fallback(self, description):
        """
        Fallback food detection using keyword matching
        Returns same format as intelligent version
        """
        food_keywords = [
            # General food terms
            'food', 'eating', 'meal', 'dish', 'cuisine', 'snack', 'breakfast', 'lunch', 'dinner',
            # Fruits
            'apple', 'banana', 'orange', 'grape', 'strawberry', 'mango', 'pineapple', 'watermelon',
            'lemon', 'lime', 'peach', 'pear', 'cherry', 'berry', 'fruit',
            # Vegetables
            'carrot', 'broccoli', 'spinach', 'tomato', 'potato', 'onion', 'pepper', 'lettuce',
            'cucumber', 'corn', 'peas', 'beans', 'vegetable', 'salad',
            # Grains & Bread
            'bread', 'rice', 'pasta', 'noodle', 'cereal', 'oats', 'wheat', 'grain',
            # Proteins
            'chicken', 'beef', 'pork', 'fish', 'salmon', 'tuna', 'egg', 'meat', 'turkey',
            # Dairy
            'milk', 'cheese', 'yogurt', 'butter', 'cream',
            # Prepared foods
            'pizza', 'burger', 'sandwich', 'soup', 'stew', 'curry', 'pasta', 'sushi',
            'cake', 'cookie', 'chocolate', 'dessert', 'ice cream',
            # Beverages
            'coffee', 'tea', 'juice', 'smoothie', 'water', 'soda', 'wine', 'beer',
            # Nuts & Seeds
            'almond', 'walnut', 'peanut', 'cashew', 'nut', 'seed'
        ]

        # Check if any food keyword is in the description
        for keyword in food_keywords:
            if keyword in description.lower():
                return {
                    "is_food": True,
                    "confidence": "medium",
                    "reasoning": f"Found food keyword: '{keyword}'",
                    "food_category": "unknown"
                }

        return {
            "is_food": False,
            "confidence": "low",
            "reasoning": "No food keywords detected in description",
            "food_category": None
        }

    def enhanced_food_analysis_with_image(self, image):
        """
        Enhanced food detection that can also send the image directly to Gemini
        for better accuracy when description alone isn't sufficient
        """
        if self.gemini_model is None:
            return None

        try:
            prompt = """
            Look at this image and determine if it contains food items that humans can eat.

            Respond ONLY in this exact JSON format:
            {
                "is_food": true/false,
                "confidence": "high/medium/low",
                "reasoning": "brief explanation",
                "food_category": "category if food or null if not food",
                "detected_foods": ["list of specific foods seen"] or null if not food
            }

            Guidelines:
            - Consider if items are actually edible and intended for human consumption
            - Exclude decorative items, toys, or non-edible objects that might look like food
            - Include raw ingredients, prepared meals, beverages, snacks, etc.
            - Be specific about what foods you can identify
            """

            # Convert PIL image to bytes for Gemini
            img_byte_arr = io.BytesIO()
            image.save(img_byte_arr, format='JPEG')
            img_byte_arr = img_byte_arr.getvalue()

            # Send image directly to Gemini
            response = self.gemini_model.generate_content([prompt, {"mime_type": "image/jpeg", "data": img_byte_arr}])
            response_text = response.text.strip()

            # Extract JSON from response
            start = response_text.find('{')
            end = response_text.rfind('}') + 1

            if start != -1 and end != -1:
                json_text = response_text[start:end]
                result = json.loads(json_text)

                if 'is_food' in result:
                    return result

            return None

        except Exception as e:
            return None

    def get_nutrition_from_gemini(self, food_description):
        """Get nutrition information using Gemini API"""
        if self.gemini_model is None:
            return None

        try:
            prompt = f"""
            Analyze this food item and provide ONLY nutrition information in the exact JSON format below.
            Food description: "{food_description}"

            If this is not a food item, respond with: {{"error": "not_food"}}

            If this is a food item, respond in this exact JSON format:
            {{
                "food_name": "name of the food",
                "calories_per_100g": number,
                "macronutrients": {{
                    "carbohydrates_g": number,
                    "protein_g": number,
                    "fat_g": number,
                    "fiber_g": number
                }},
                "micronutrients": {{
                    "vitamin_c_mg": number,
                    "calcium_mg": number,
                    "iron_mg": number,
                    "potassium_mg": number,
                    "vitamin_a_ug": number
                }}
            }}

            Provide approximate values for a typical serving. Be precise and only return valid JSON.
            """

            response = self.gemini_model.generate_content(prompt)

            # Extract JSON from response
            response_text = response.text.strip()

            # Try to find JSON in the response
            start = response_text.find('{')
            end = response_text.rfind('}') + 1

            if start != -1 and end != -1:
                json_text = response_text[start:end]
                nutrition_data = json.loads(json_text)
                return nutrition_data

            return None

        except Exception as e:
            return None

    def get_nutrition_fallback(self, food_description):
        """Fallback nutrition database for common foods"""
        nutrition_db = {
            'apple': {
                "food_name": "Apple",
                "calories_per_100g": 52,
                "macronutrients": {
                    "carbohydrates_g": 14,
                    "protein_g": 0.3,
                    "fat_g": 0.2,
                    "fiber_g": 2.4
                },
                "micronutrients": {
                    "vitamin_c_mg": 4.6,
                    "calcium_mg": 6,
                    "iron_mg": 0.12,
                    "potassium_mg": 107,
                    "vitamin_a_ug": 3
                }
            },
            'banana': {
                "food_name": "Banana",
                "calories_per_100g": 89,
                "macronutrients": {
                    "carbohydrates_g": 23,
                    "protein_g": 1.1,
                    "fat_g": 0.3,
                    "fiber_g": 2.6
                },
                "micronutrients": {
                    "vitamin_c_mg": 8.7,
                    "calcium_mg": 5,
                    "iron_mg": 0.26,
                    "potassium_mg": 358,
                    "vitamin_a_ug": 3
                }
            },
            'orange': {
                "food_name": "Orange",
                "calories_per_100g": 47,
                "macronutrients": {
                    "carbohydrates_g": 12,
                    "protein_g": 0.9,
                    "fat_g": 0.1,
                    "fiber_g": 2.4
                },
                "micronutrients": {
                    "vitamin_c_mg": 53.2,
                    "calcium_mg": 40,
                    "iron_mg": 0.1,
                    "potassium_mg": 181,
                    "vitamin_a_ug": 11
                }
            }
        }

        # Try to match food from description
        for food_key in nutrition_db.keys():
            if food_key in food_description:
                return nutrition_db[food_key]

        # Generic food item if no match
        return {
            "food_name": "Unknown Food Item",
            "calories_per_100g": 150,
            "macronutrients": {
                "carbohydrates_g": 20,
                "protein_g": 5,
                "fat_g": 5,
                "fiber_g": 2
            },
            "micronutrients": {
                "vitamin_c_mg": 10,
                "calcium_mg": 50,
                "iron_mg": 1,
                "potassium_mg": 200,
                "vitamin_a_ug": 100
            }
        }

    def analyze_food_image_enhanced(self, image):
        """
        Enhanced main function that uses intelligent food detection
        """
        try:
            # Step 1: Try enhanced image analysis first (sends image directly to Gemini)
            image_analysis = self.enhanced_food_analysis_with_image(image)

            if image_analysis and image_analysis.get('is_food'):
                # Use detected foods for better nutrition lookup
                if image_analysis.get('detected_foods'):
                    food_description = ', '.join(image_analysis['detected_foods'])
                else:
                    # Fallback to BLIP description
                    food_description = self.detect_food_in_image(image)
            else:
                # # Step 2: Fallback to BLIP description + intelligent text analysis
                # description = self.detect_food_in_image(image)

                # if not description:
                #     return {"error": "Could not analyze the image"}

                # # Step 3: Intelligent food detection on description
                # food_check = self.is_food_item_intelligent(description)

                # if not food_check['is_food']:
                #     return {"error": f"This image does not contain food. {food_check['reasoning']}"}

                # food_description = description
                return {"error": "This image does not contain a recognizable food item."}

            # Step 4: Get nutrition information
            nutrition_data = self.get_nutrition_from_gemini(food_description)

            if nutrition_data is None:
                nutrition_data = self.get_nutrition_fallback(food_description)
            elif 'error' in nutrition_data and nutrition_data['error'] == 'not_food':
                return {"error": "This image does not contain a recognizable food item."}

            return nutrition_data

        except Exception as e:
            return {"error": f"Analysis failed: {str(e)}"}

    def format_nutrition_output(self, nutrition_data):
        """Format nutrition data for display"""
        if 'error' in nutrition_data:
            return {"error": nutrition_data['error']}

        return {
            "food_name": nutrition_data['food_name'],
            "serving_size": "100g",
            "calories_per_100g": nutrition_data['calories_per_100g'],
            "macronutrients": nutrition_data['macronutrients'],
            "micronutrients": nutrition_data['micronutrients'],
            "note": "Values are approximate and based on typical nutritional content."
        }


# Singleton instance
food_analysis_service: FoodAnalysisService = None

def get_food_analysis_service() -> FoodAnalysisService:
    """Get the food analysis service instance"""
    global food_analysis_service
    if food_analysis_service is None:
        gemini_key = settings.GEMINI_API_KEY
        food_analysis_service = FoodAnalysisService(gemini_key)
    return food_analysis_service