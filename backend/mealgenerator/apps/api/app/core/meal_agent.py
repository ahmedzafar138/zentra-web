from openai import OpenAI
import requests
import json
import logging
from typing import Dict, Any, List
from app.core.config import settings

logger = logging.getLogger(__name__)

class MealPlanningAgent:
    def __init__(self, openai_api_key: str, usda_api_key: str):
        self.openai_api_key = openai_api_key
        self.usda_api_key = usda_api_key
        self.client = OpenAI(api_key=openai_api_key)
        self.conversation_history = []
    
    def search_food(self, query: str, page_size: int = 2, page_number: int = 1) -> List[Dict]:
        """Search USDA database for foods"""
        url = "https://api.nal.usda.gov/fdc/v1/foods/search"
        params = {
            "api_key": self.usda_api_key,
            "query": query,
            "pageSize": page_size,
            "pageNumber": page_number
        }
        try:
            response = requests.get(url, params=params)
            if response.status_code == 200:
                data = response.json()
                results = []
                for food in data.get("foods", []):
                    results.append({
                        "description": food['description'],
                        "fdcId": food['fdcId'],
                        "foodCategory": food.get('foodCategory')
                    })
                return results
            else:
                return []
        except Exception as e:
            return []

    def get_nutrients(self, fdc_id: int) -> Dict[str, Any]:
        """Get nutrient details for a given food using its fdcId"""
        url = f"https://api.nal.usda.gov/fdc/v1/food/{fdc_id}"
        params = {"api_key": self.usda_api_key}
        
        try:
            response = requests.get(url, params=params)
            if response.status_code == 200:
                food_details = response.json()
                nutrients_list = []
                for nutrient in food_details.get("foodNutrients", []):
                    name = nutrient.get("nutrient", {}).get("name")
                    amount = nutrient.get("amount")
                    unit = nutrient.get("nutrient", {}).get("unitName")
                    if name and amount is not None:
                        nutrients_list.append({
                            "name": name,
                            "amount": amount,
                            "unit": unit
                        })
                return {
                    "description": food_details.get("description"),
                    "nutrients": nutrients_list
                }
            else:
                return {"error": f"Failed to fetch nutrients for FDC ID: {fdc_id}"}
        except Exception as e:
            return {"error": str(e)}

    def _get_system_prompt(self) -> str:
        """Simplified and faster system prompt"""
        return """You are a meal planning assistant. Create a daily meal plan with Breakfast, Lunch, Dinner, and Snacks.

PROCESS:
1. For each meal, search 1-2 foods using search_food tool
2. Get nutrients with get_nutrients tool
3. Calculate totals and ensure it fits user's goals

RULES:
- Use tools to verify nutrients - never guess
- Match user's dietary preferences (vegan, keto, etc.)
- Aim for: Breakfast 25%, Lunch 35%, Dinner 30%, Snacks 10% of daily calories
- Keep it simple and practical

OUTPUT FORMAT (when requested):
Wrap everything in "day1". Each meal must have:
- food: string describing the food items
- portion: string with portion sizes
- macros: object with protein_g, fat_g, carbohydrates_g (NOT carbs_g!), energy_kcal (NOT calories!)

Example: {"day1": {"breakfast": {"food": "Oatmeal with Banana", "portion": "1 cup oatmeal, 1 medium banana", "macros": {"protein_g": 10, "fat_g": 5, "carbohydrates_g": 50, "energy_kcal": 300}}}}"""

    def _get_tools_definition(self):
        """Get OpenAI function calling tool definitions"""
        return [
            {
                "type": "function",
                "function": {
                    "name": "search_food",
                    "description": "Search USDA database for foods. Input is a food name (string). Output is a list of matching foods with description, fdcId, and category.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "query": {
                                "type": "string",
                                "description": "The food name to search for"
                            }
                        },
                        "required": ["query"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "get_nutrients",
                    "description": "Get nutrient details for a given food using its fdcId.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "fdc_id": {
                                "type": "integer",
                                "description": "The FDC ID of the food"
                            }
                        },
                        "required": ["fdc_id"]
                    }
                }
            }
        ]
    
    def _execute_tool(self, tool_name: str, arguments: dict) -> Any:
        """Execute a tool call"""
        if tool_name == "search_food":
            return self.search_food(arguments["query"])
        elif tool_name == "get_nutrients":
            return self.get_nutrients(arguments["fdc_id"])
        else:
            return {"error": f"Unknown tool: {tool_name}"}

    def _get_response_format(self, days: int = 1):
        """Define structured output schema for meal plan - matches frontend expectations"""
        meal_schema = {
            "type": "object",
            "properties": {
                "food": {"type": "string"},
                "portion": {"type": "string"},
                "macros": {
                    "type": "object",
                    "properties": {
                        "protein_g": {"type": "number"},
                        "fat_g": {"type": "number"},
                        "carbohydrates_g": {"type": "number"},
                        "energy_kcal": {"type": "number"}
                    },
                    "required": ["protein_g", "fat_g", "carbohydrates_g", "energy_kcal"],
                    "additionalProperties": False
                }
            },
            "required": ["food", "portion", "macros"],
            "additionalProperties": False
        }
        
        day_schema = {
            "type": "object",
            "properties": {
                "breakfast": meal_schema,
                "lunch": meal_schema,
                "dinner": meal_schema,
                "snacks": meal_schema
            },
            "required": ["breakfast", "lunch", "dinner", "snacks"],
            "additionalProperties": False
        }
        day_properties = {f"day{i}": day_schema for i in range(1, days + 1)}

        return {
            "type": "json_schema",
            "json_schema": {
                "name": "meal_plan",
                "strict": True,
                "schema": {
                    "type": "object",
                    "properties": day_properties,
                    "required": list(day_properties.keys()),
                    "additionalProperties": False
                }
            }
        }

    def generate_meal_plan(self, user_input: str, days: int = 1) -> Dict[str, Any]:
        """Generate meal plan based on user input using OpenAI function calling"""
        try:
            logger.info("🤖 Starting meal plan generation in agent")
            
            # The previous multi-step tool loop can produce invalid message
            # history for OpenAI's structured output API. Use one strict JSON
            # call so mobile receives predictable day1/day1-day7 data.
            structured_response = self.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are a practical nutrition and meal-planning assistant. "
                            "Create realistic meal plans from the user's stats, goal, "
                            "culinary preference, and dietary preference. Use realistic "
                            "portions and macro values. Keep meals simple and cookable."
                        ),
                    },
                    {
                        "role": "user",
                        "content": (
                            f"{user_input}\n\n"
                            f"Generate a complete {'7-day weekly' if days == 7 else 'daily'} meal plan. "
                            f"Return exactly {'day1 through day7' if days == 7 else 'day1'}. "
                            "Each day must include breakfast, lunch, dinner, and snacks. "
                            "Each meal must include food, portion, and macros. "
                            "Use varied, practical meals and realistic macro values."
                        ),
                    },
                ],
                temperature=0,
                response_format=self._get_response_format(days),
            )

            structured_content = structured_response.choices[0].message.content
            return {
                "success": True,
                "meal_plan": structured_content,
                "message": "Meal plan generated successfully",
            }

            # Initialize conversation with system message and user input
            messages = [
                {"role": "system", "content": self._get_system_prompt()},
                {"role": "user", "content": user_input}
            ]
            
            # Add conversation history if any
            messages.extend(self.conversation_history)
            
            max_iterations = 10  # Reduced from 20 for faster execution
            iteration = 0
            
            while iteration < max_iterations:
                logger.info(f"🔄 Iteration {iteration + 1}/{max_iterations}")
                
                # Call OpenAI with function calling
                response = self.client.chat.completions.create(
                    model="gpt-4o",
                    messages=messages,
                    tools=self._get_tools_definition(),
                    temperature=0
                )
                
                assistant_message = response.choices[0].message
                logger.info(f"💬 Got response from OpenAI - Tool calls: {bool(assistant_message.tool_calls)}")
                
                # Check if the model wants to call a function
                if assistant_message.tool_calls:
                    logger.info(f"🔧 Processing {len(assistant_message.tool_calls)} tool calls")
                    
                    # Add assistant's message to conversation
                    messages.append({
                        "role": "assistant",
                        "content": assistant_message.content,
                        "tool_calls": [
                            {
                                "id": tc.id,
                                "type": "function",
                                "function": {
                                    "name": tc.function.name,
                                    "arguments": tc.function.arguments
                                }
                            } for tc in assistant_message.tool_calls
                        ]
                    })
                    
                    # Execute each tool call
                    for tool_call in assistant_message.tool_calls:
                        function_name = tool_call.function.name
                        function_args = json.loads(tool_call.function.arguments)
                        
                        logger.info(f"🔨 Executing tool: {function_name} with args: {function_args}")
                        
                        # Execute the tool
                        tool_response = self._execute_tool(function_name, function_args)
                        
                        logger.info(f"✅ Tool response received: {str(tool_response)[:100]}...")
                        
                        # Add tool response to messages
                        messages.append({
                            "role": "tool",
                            "tool_call_id": tool_call.id,
                            "content": json.dumps(tool_response)
                        })
                    
                    iteration += 1
                else:
                    # No more tool calls - make a final call with structured output
                    logger.info("🎯 Making final call with structured output...")
                    
                    # Add assistant message and request structured output
                    if assistant_message.content:
                        messages.append({
                            "role": "assistant",
                            "content": assistant_message.content
                        })
                    
                    messages.append({
                        "role": "user",
                        "content": f"Please provide the complete {'7-day weekly' if days == 7 else 'daily'} meal plan in JSON format with breakfast, lunch, dinner, and snacks."
                    })
                    
                    final_response = self.client.chat.completions.create(
                        model="gpt-4o",
                        messages=messages,
                        temperature=0,
                        response_format=self._get_response_format(days)
                    )
                    
                    final_content = final_response.choices[0].message.content
                    
                    logger.info(f"✨ Structured output received!")
                    logger.info(f"📝 Content length: {len(final_content) if final_content else 0}")
                    logger.info(f"📄 Content preview: {(final_content[:300] if final_content else 'None')}")
                    
                    # Store conversation history (last few messages)
                    self.conversation_history = messages[-10:]  # Keep last 10 messages
                    
                    result = {
                        "success": True,
                        "meal_plan": final_content,
                        "message": "Meal plan generated successfully"
                    }
                    
                    logger.info(f"🎉 Returning result: success={result['success']}, meal_plan_length={len(result.get('meal_plan') or '')}")
                    return result
            
            logger.warning(f"⚠️  Max iterations ({max_iterations}) reached")
            return {
                "success": False,
                "meal_plan": None,
                "message": "Maximum iterations reached without completing the meal plan"
            }
            
        except Exception as e:
            logger.error(f"❌ Error in generate_meal_plan: {str(e)}", exc_info=True)
            return {
                "success": False,
                "meal_plan": None,
                "message": f"Error generating meal plan: {str(e)}"
            }

# Singleton instance 
meal_agent: MealPlanningAgent = None

def get_meal_agent() -> MealPlanningAgent:
    """Get the meal planning agent instance"""
    global meal_agent
    if meal_agent is None:
        # These should be loaded from environment variables or config
        openai_key = settings.OPENAI_API_KEY
        usda_key =  settings.USDA_API_KEY
        meal_agent = MealPlanningAgent(openai_key, usda_key)
    return meal_agent
