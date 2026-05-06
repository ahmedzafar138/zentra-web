import openai
import json
from typing import Dict, Any
from app.core.config import settings

from app.core.recipe_utils import (
    create_recipe_prompt,
    parse_recipe_response,
    create_error_response,
)

# Initialize OpenAI client
client = openai.OpenAI(api_key=settings.OPENAI_API_KEY)


def generate_recipe(meal_name: str, model: str = "gpt-4o") -> Dict[str, Any]:
    """
    Generate recipe data for a given meal name.

    Args:
        meal_name (str): Name of the meal to generate recipe for
        model (str): OpenAI model to use

    Returns:
        Dict containing ingredients list and instructions with headings
    """
    try:
        # Create a structured prompt for consistent output
        prompt = create_recipe_prompt(meal_name)

        # Call OpenAI API
        response = client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "system",
                    "content": "You are a professional chef assistant. Provide accurate, detailed recipes in the requested format.",
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,
            max_tokens=1000,
        )

        # Parse the response
        recipe_text = response.choices[0].message.content
        parsed_recipe = parse_recipe_response(recipe_text, meal_name)

        return parsed_recipe

    except Exception as e:
        return create_error_response(str(e), meal_name)


def generate_daily_recipes(meal_names: Dict[str, str], model: str = "gpt-4o-mini") -> Dict[str, Any]:
    """
    Generate recipes for breakfast, lunch, dinner, and snacks in one model call.
    """
    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a concise chef assistant. Generate practical recipes. "
                        "Return strict JSON only."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        "Generate recipes for these meals: "
                        f"{json.dumps(meal_names)}. "
                        "For each key, return meal_name, ingredients with heading and items array, "
                        "and instructions with heading and steps array. Keep each recipe concise."
                    ),
                },
            ],
            temperature=0.2,
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "name": "daily_recipes",
                    "strict": True,
                    "schema": {
                        "type": "object",
                        "properties": {
                            meal_key: {
                                "type": "object",
                                "properties": {
                                    "meal_name": {"type": "string"},
                                    "ingredients": {
                                        "type": "object",
                                        "properties": {
                                            "heading": {"type": "string"},
                                            "items": {
                                                "type": "array",
                                                "items": {"type": "string"},
                                            },
                                        },
                                        "required": ["heading", "items"],
                                        "additionalProperties": False,
                                    },
                                    "instructions": {
                                        "type": "object",
                                        "properties": {
                                            "heading": {"type": "string"},
                                            "steps": {
                                                "type": "array",
                                                "items": {"type": "string"},
                                            },
                                        },
                                        "required": ["heading", "steps"],
                                        "additionalProperties": False,
                                    },
                                },
                                "required": ["meal_name", "ingredients", "instructions"],
                                "additionalProperties": False,
                            }
                            for meal_key in meal_names.keys()
                        },
                        "required": list(meal_names.keys()),
                        "additionalProperties": False,
                    },
                },
            },
        )

        content = response.choices[0].message.content
        return json.loads(content)

    except Exception as e:
        return {
            meal_key: create_error_response(str(e), meal_name)
            for meal_key, meal_name in meal_names.items()
        }
