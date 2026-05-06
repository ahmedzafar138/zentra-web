import re
from typing import Dict, List, Optional


def create_recipe_prompt(meal_name: str) -> str:
    """Create a structured prompt for the OpenAI API."""
    return f"""
    Please provide a complete recipe for "{meal_name}". Format your response exactly as follows:

    INGREDIENTS:
    - [ingredient 1 with quantity]
    - [ingredient 2 with quantity]
    - [continue for all ingredients...]

    INSTRUCTIONS:
    1. [First step with clear details]
    2. [Second step with clear details]
    3. [Continue for all steps...]

    Make sure to include specific quantities for ingredients and detailed, step-by-step instructions and DONT add any bold heading, i want just the raw text.
    """


def extract_section(text: str, start_marker: str, end_marker: Optional[str]) -> str:
    """Extract a specific section from the response text."""
    start_idx = text.find(start_marker)
    if start_idx == -1:
        return ""

    start_idx += len(start_marker)

    if end_marker:
        end_idx = text.find(end_marker, start_idx)
        if end_idx == -1:
            return text[start_idx:].strip()
        return text[start_idx:end_idx].strip()
    else:
        return text[start_idx:].strip()


def parse_ingredients(ingredients_text: str) -> List[str]:
    """Parse ingredients section into a clean list."""
    if not ingredients_text:
        return ["No ingredients found"]

    lines = ingredients_text.split("\n")
    ingredients = []

    for line in lines:
        line = line.strip()
        if line and (
            line.startswith("-") or line.startswith("•") or line.startswith("")
        ):
            clean_ingredient = re.sub(r"^[-•]\s*", "", line).strip()
            if clean_ingredient:
                ingredients.append(clean_ingredient)

    return ingredients if ingredients else ["No ingredients found"]


def parse_instructions(instructions_text: str) -> List[str]:
    """Parse instructions section into a clean numbered list."""
    if not instructions_text:
        return ["No instructions found"]

    lines = instructions_text.split("\n")
    instructions = []

    for line in lines:
        line = line.strip()
        if line and (re.match(r"^\d+\.", line) or line.startswith("-") or line.startswith("•")):
            clean_instruction = re.sub(r"^\d+\.\s|^[-•]\s*", "", line).strip()
            if clean_instruction:
                instructions.append(clean_instruction)

    return instructions if instructions else ["No instructions found"]


def parse_recipe_response(response_text: str, meal_name: str) -> Dict[str, any]:
    """Parse the OpenAI response into structured frontend data."""
    try:
        ingredients_section = extract_section(response_text, "INGREDIENTS:", "INSTRUCTIONS:")
        instructions_section = extract_section(response_text, "INSTRUCTIONS:", None)

        ingredients = parse_ingredients(ingredients_section)
        instructions = parse_instructions(instructions_section)

        return {
            "success": True,
            "meal_name": meal_name.title(),
            "ingredients": {
                "heading": f"Ingredients for {meal_name.title()}",
                "items": ingredients,
            },
            "instructions": {
                "heading": f"How to Make {meal_name.title()}",
                "steps": instructions,
            },
        }

    except Exception as e:
        return create_error_response(f"Parsing error: {str(e)}", meal_name)


def create_error_response(error_msg: str, meal_name: str) -> Dict[str, any]:
    """Create a structured error response."""
    return {
        "success": False,
        "meal_name": meal_name.title(),
        "error": error_msg,
        "ingredients": {
            "heading": f"Ingredients for {meal_name.title()}",
            "items": ["Error: Could not fetch ingredients"],
        },
        "instructions": {
            "heading": f"How to Make {meal_name.title()}",
            "steps": ["Error: Could not fetch instructions"],
        },
    }
