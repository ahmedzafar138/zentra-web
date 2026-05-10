import asyncio
from typing import Any

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect, status
from pydantic import BaseModel, Field, ValidationError

from app.services.deadlift_service import get_deadlift_service

router = APIRouter(prefix="/deadlifts", tags=["deadlifts"])


class SessionResponse(BaseModel):
    session_id: str
    message: str


class ImageFrameRequest(BaseModel):
    image_base64: str = Field(
        ...,
        description="JPEG/PNG image as raw base64 or a data:image/...;base64 URI.",
    )
    timestamp_ms: int | None = None


class DeadliftWebSocketMessage(BaseModel):
    type: str = Field(..., description="Message type: image_frame, reset, or ping.")
    image_base64: str | None = None
    timestamp_ms: int | None = None


@router.get("/health")
def deadlift_health() -> dict[str, Any]:
    return get_deadlift_service().health()


@router.post("/load")
def load_deadlift_model() -> dict[str, Any]:
    try:
        get_deadlift_service().load()
        return {
            "message": "Deadlift analyzer loaded.",
            "health": get_deadlift_service().health(),
        }
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc


@router.post("/session/start", response_model=SessionResponse)
def start_session() -> SessionResponse:
    session_id = get_deadlift_service().create_session()
    return SessionResponse(
        session_id=session_id,
        message="Deadlift inference session started.",
    )


@router.websocket("/ws")
async def deadlift_websocket(websocket: WebSocket) -> None:
    await websocket.accept()
    service = get_deadlift_service()
    session_id = service.create_session()
    await websocket.send_json(
        {
            "type": "session_started",
            "session_id": session_id,
            "message": "Deadlift inference WebSocket started.",
        }
    )

    try:
        while True:
            raw_message = await websocket.receive_json()
            try:
                message = DeadliftWebSocketMessage.model_validate(raw_message)

                if message.type == "image_frame":
                    if not message.image_base64:
                        raise ValueError("image_frame requires image_base64")
                    result = await asyncio.to_thread(
                        service.process_image_frame,
                        session_id,
                        message.image_base64,
                    )
                    await websocket.send_json(
                        {
                            "type": "frame_result",
                            "timestamp_ms": message.timestamp_ms,
                            **result,
                        }
                    )
                elif message.type == "reset":
                    await asyncio.to_thread(service.reset_session, session_id)
                    await websocket.send_json(
                        {
                            "type": "session_reset",
                            "session_id": session_id,
                            "message": "Deadlift session reset.",
                        }
                    )
                elif message.type == "ping":
                    await websocket.send_json({"type": "pong", "session_id": session_id})
                else:
                    raise ValueError(f"Unsupported WebSocket message type: {message.type}")
            except (RuntimeError, ValueError, ValidationError) as exc:
                await websocket.send_json(
                    {
                        "type": "error",
                        "session_id": session_id,
                        "message": str(exc),
                    }
                )
    except WebSocketDisconnect:
        pass
    finally:
        service.delete_session(session_id)


@router.post("/session/{session_id}/frame-image")
def process_image_frame(session_id: str, payload: ImageFrameRequest) -> dict[str, Any]:
    try:
        return get_deadlift_service().process_image_frame(session_id, payload.image_base64)
    except KeyError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc


@router.post("/session/{session_id}/reset")
def reset_session(session_id: str) -> dict[str, Any]:
    get_deadlift_service().reset_session(session_id)
    return {"session_id": session_id, "message": "Deadlift session reset."}


@router.delete("/session/{session_id}")
def delete_session(session_id: str) -> dict[str, Any]:
    deleted = get_deadlift_service().delete_session(session_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Unknown deadlift session_id: {session_id}",
        )
    return {"session_id": session_id, "message": "Deadlift session deleted."}
