from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from src.memory import get_memory
from src.query import ask_question


class AskRequest(BaseModel):
    question: str = Field(..., min_length=1)
    # Stable handle the caller controls. Passing the same id on later turns
    # threads the conversation; passing nothing or a new id starts fresh.
    conversation_id: Optional[str] = Field(None, max_length=128)


class AskResponse(BaseModel):
    answer: str
    conversation_id: Optional[str] = None


class ClearRequest(BaseModel):
    conversation_id: str = Field(..., min_length=1, max_length=128)


class ClearResponse(BaseModel):
    cleared: bool


app = FastAPI(title="Zentra RAG API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "zentra-rag",
        "conversations": get_memory().size(),
    }


@app.post("/ask", response_model=AskResponse)
def ask(request: AskRequest):
    question = request.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question is required")

    conv_id = (request.conversation_id or "").strip() or None

    try:
        answer = ask_question(question, conv_id)
        return AskResponse(answer=answer, conversation_id=conv_id)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"RAG query failed: {exc}",
        ) from exc


@app.post("/clear", response_model=ClearResponse)
def clear(request: ClearRequest):
    cleared = get_memory().clear(request.conversation_id)
    return ClearResponse(cleared=cleared)
