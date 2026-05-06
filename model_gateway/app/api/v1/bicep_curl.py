import asyncio
from typing import Any

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect, status
from pydantic import BaseModel, Field, ValidationError

from app.services.bicep_curl_service import get_bicep_curl_service

router = APIRouter(prefix="/bicep-curl", tags=["bicep-curl"])


class SessionResponse(BaseModel):
    session_id: str
    message: str


class FrameRequest(BaseModel):
    landmarks: list[Any] = Field(
        ...,
        description=(
            "Eight selected pose landmarks in infer.py order. Accepts nested "
            "[[x,y,z,visibility], ...] or one flat 32-number frame."
        ),
    )
    timestamp_ms: int | None = None


class ImageFrameRequest(BaseModel):
    image_base64: str = Field(
        ...,
        description="JPEG/PNG image as raw base64 or a data:image/...;base64 URI.",
    )
    timestamp_ms: int | None = None


class RepPredictionRequest(BaseModel):
    frames: list[Any] = Field(
        ...,
        min_length=1,
        description="Completed rep frames, each nested 8x4 landmarks or flat 32 values.",
    )


class BicepCurlWebSocketMessage(BaseModel):
    type: str = Field(..., description="Message type: image_frame, landmarks_frame, reset, or ping.")
    image_base64: str | None = None
    landmarks: list[Any] | None = None
    timestamp_ms: int | None = None


@router.get("/health")
def bicep_curl_health() -> dict[str, Any]:
    return get_bicep_curl_service().health()


@router.post("/load")
def load_bicep_curl_model() -> dict[str, Any]:
    try:
        get_bicep_curl_service().load()
        return {
            "message": "Bicep curl model loaded.",
            "health": get_bicep_curl_service().health(),
        }
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc


@router.post("/session/start", response_model=SessionResponse)
def start_session() -> SessionResponse:
    session_id = get_bicep_curl_service().create_session()
    return SessionResponse(
        session_id=session_id,
        message="Bicep curl inference session started.",
    )


@router.websocket("/ws")
async def bicep_curl_websocket(websocket: WebSocket) -> None:
    await websocket.accept()
    service = get_bicep_curl_service()
    session_id = service.create_session()
    await websocket.send_json(
        {
            "type": "session_started",
            "session_id": session_id,
            "message": "Bicep curl inference WebSocket started.",
        }
    )

    try:
        while True:
            raw_message = await websocket.receive_json()
            try:
                message = BicepCurlWebSocketMessage.model_validate(raw_message)

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
                elif message.type == "landmarks_frame":
                    if message.landmarks is None:
                        raise ValueError("landmarks_frame requires landmarks")
                    result = await asyncio.to_thread(
                        service.process_frame,
                        session_id,
                        message.landmarks,
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
                            "message": "Bicep curl session reset.",
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


@router.post("/session/{session_id}/frame")
def process_frame(session_id: str, payload: FrameRequest) -> dict[str, Any]:
    try:
        return get_bicep_curl_service().process_frame(session_id, payload.landmarks)
    except KeyError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc


@router.post("/session/{session_id}/frame-image")
def process_image_frame(session_id: str, payload: ImageFrameRequest) -> dict[str, Any]:
    try:
        return get_bicep_curl_service().process_image_frame(session_id, payload.image_base64)
    except KeyError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc


@router.post("/session/{session_id}/reset")
def reset_session(session_id: str) -> dict[str, Any]:
    get_bicep_curl_service().reset_session(session_id)
    return {"session_id": session_id, "message": "Bicep curl session reset."}


@router.delete("/session/{session_id}")
def delete_session(session_id: str) -> dict[str, Any]:
    deleted = get_bicep_curl_service().delete_session(session_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Unknown bicep curl session_id: {session_id}",
        )
    return {"session_id": session_id, "message": "Bicep curl session deleted."}


@router.post("/predict-rep")
def predict_rep(payload: RepPredictionRequest) -> dict[str, Any]:
    try:
        prediction = get_bicep_curl_service().predict_rep(payload.frames)
        return {
            "label": prediction.label,
            "probability": round(prediction.probability, 4),
            "confidence": round(prediction.confidence, 4),
        }
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
