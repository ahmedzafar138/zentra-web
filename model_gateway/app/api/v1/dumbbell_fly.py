import asyncio
from typing import Any

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect, status
from pydantic import BaseModel, Field, ValidationError

from app.services.dumbbell_fly_service import get_dumbbell_fly_service

router = APIRouter(prefix="/dumbbell-fly", tags=["dumbbell-fly"])


class SessionResponse(BaseModel):
    session_id: str
    message: str


class ImageFrameRequest(BaseModel):
    image_base64: str = Field(
        ...,
        description="JPEG/PNG image as raw base64 or a data:image/...;base64 URI.",
    )
    timestamp_ms: int | None = None


class DumbbellFlyWebSocketMessage(BaseModel):
    type: str = Field(..., description="Message type: image_frame, reset, or ping.")
    image_base64: str | None = None
    timestamp_ms: int | None = None


@router.get("/health")
def dumbbell_fly_health() -> dict[str, Any]:
    return get_dumbbell_fly_service().health()


@router.post("/load")
def load_dumbbell_fly_model() -> dict[str, Any]:
    try:
        get_dumbbell_fly_service().load()
        return {
            "message": "Dumbbell fly model loaded.",
            "health": get_dumbbell_fly_service().health(),
        }
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc


@router.post("/session/start", response_model=SessionResponse)
def start_session() -> SessionResponse:
    session_id = get_dumbbell_fly_service().create_session()
    return SessionResponse(
        session_id=session_id,
        message="Dumbbell fly inference session started.",
    )


@router.websocket("/ws")
async def dumbbell_fly_websocket(websocket: WebSocket) -> None:
    await websocket.accept()
    service = get_dumbbell_fly_service()
    session_id = service.create_session()
    await websocket.send_json(
        {
            "type": "session_started",
            "session_id": session_id,
            "message": "Dumbbell fly inference WebSocket started.",
        }
    )

    try:
        while True:
            raw_message = await websocket.receive_json()
            try:
                message = DumbbellFlyWebSocketMessage.model_validate(raw_message)

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
                            "message": "Dumbbell fly session reset.",
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
        return get_dumbbell_fly_service().process_image_frame(session_id, payload.image_base64)
    except KeyError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc


@router.post("/session/{session_id}/reset")
def reset_session(session_id: str) -> dict[str, Any]:
    get_dumbbell_fly_service().reset_session(session_id)
    return {"session_id": session_id, "message": "Dumbbell fly session reset."}


@router.delete("/session/{session_id}")
def delete_session(session_id: str) -> dict[str, Any]:
    deleted = get_dumbbell_fly_service().delete_session(session_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Unknown dumbbell fly session_id: {session_id}",
        )
    return {"session_id": session_id, "message": "Dumbbell fly session deleted."}
