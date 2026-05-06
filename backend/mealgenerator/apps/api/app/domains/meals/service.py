import json, re
from typing import Dict, List
from fastapi import HTTPException
from openai import OpenAI
from app.core.config import settings

_client = OpenAI(api_key=settings.OPENAI_API_KEY)

_SYSTEM_PROMPT = """
You are a helpful assistant that takes 7 days of meal plans (4 meals per day) and generates a shopping list.
Group ingredients into EXACTLY these categories:
- Vegetables and Herbs
- Proteins
- Fruits
- Dairy
- Dry Goods and Grains
- Snacks and Others

Rules:
- Aggregate total quantities for the whole week.
- Use realistic units (g, kg, ml, L, tsp, tbsp, cups, pieces, cans/packs).
- Keep items concise: "Item — total quantity".
- Output STRICT JSON ONLY with this schema:
{
  "Vegetables and Herbs": [],
  "Proteins": [],
  "Fruits": [],
  "Dairy": [],
  "Dry Goods and Grains": [],
  "Snacks and Others": []
}
"""

def _strip_code_fences(text: str) -> str:
    t = text.strip()
    t = re.sub(r"^```(?:json)?\s*", "", t)
    t = re.sub(r"\s*```$", "", t)
    return t

def _parse_json(text: str):
    t = _strip_code_fences(text)
    try:
        return json.loads(t)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", t, flags=re.DOTALL)
        if not m:
            raise
        return json.loads(m.group(0))



def generate_shopping_list(payload: Dict[str, dict]) -> Dict[str, List[str]]:
    try:
        user_prompt = (
            "Here are the meals for the week (7 days × 4 meals):\n\n"
            f"{payload}\n\nGenerate the aggregated shopping list as STRICT JSON."
        )

        resp = _client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.2,
        )

        content = resp.choices[0].message.content
        data = _parse_json(content)
        return data

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Shopping list generation failed: {str(e)}")