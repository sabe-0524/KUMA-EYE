"""Streaming API for local webcam PoC."""

from __future__ import annotations

from datetime import datetime
from io import BytesIO

from PIL import Image, UnidentifiedImageError
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.auth import FirebaseUser, get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.models.database import Camera, Upload
from app.models.schemas import (
    StreamFrameAck,
    StreamSessionCreateRequest,
    StreamSessionResponse,
    StreamSessionState,
    StreamSessionStatus,
    StreamSessionStopResponse,
)
from app.services.stream_session_manager import StreamSession, stream_session_manager
from app.usecases.stream_processing import process_stream_frame

router = APIRouter(prefix="/streams", tags=["streams"])


def _build_stream_status(session: StreamSession) -> StreamSessionStatus:
    return StreamSessionStatus(
        session_id=session.session_id,
        upload_id=session.upload_id,
        status=StreamSessionState(session.status),
        frame_interval=session.frame_interval,
        started_at=session.started_at,
        last_frame_at=session.last_frame_at,
        stopped_at=session.stopped_at,
        frames_received=session.frames_received,
        frames_processed=session.frames_processed,
        detections_count=session.detections_count,
        reconnect_attempts=session.reconnect_attempts,
    )


def _validate_location(camera_id: int | None, latitude: float | None, longitude: float | None) -> None:
    if camera_id:
        return

    if latitude is None or longitude is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either camera_id or both latitude and longitude must be provided",
        )


@router.post("/sessions", response_model=StreamSessionResponse, status_code=status.HTTP_201_CREATED)
def create_stream_session(
    payload: StreamSessionCreateRequest,
    db: Session = Depends(get_db),
    _current_user: FirebaseUser = Depends(get_current_user),
):
    """Create a stream session and associated upload record."""
    _validate_location(payload.camera_id, payload.latitude, payload.longitude)

    camera = None
    if payload.camera_id:
        camera = db.query(Camera).filter(Camera.id == payload.camera_id).first()
        if not camera:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Camera with id {payload.camera_id} not found",
            )

    upload = Upload(
        camera_id=payload.camera_id,
        file_path="stream://pending",
        file_type="image",
        file_size=None,
        status="processing",
        latitude=payload.latitude,
        longitude=payload.longitude,
        recorded_at=datetime.now(),
    )
    db.add(upload)
    db.commit()
    db.refresh(upload)

    session = stream_session_manager.create_session(
        upload_id=upload.id,
        frame_interval=payload.frame_interval,
        camera_id=payload.camera_id,
        latitude=float(camera.latitude) if camera else payload.latitude,
        longitude=float(camera.longitude) if camera else payload.longitude,
    )

    upload.file_path = f"stream://{session.session_id}"
    db.commit()

    return StreamSessionResponse(
        session_id=session.session_id,
        upload_id=session.upload_id,
        status=StreamSessionState.ACTIVE,
        frame_interval=session.frame_interval,
        started_at=session.started_at,
        reconnect_interval_seconds=settings.STREAM_RECONNECT_INTERVAL_SECONDS,
    )


@router.post("/sessions/{session_id}/frames", response_model=StreamFrameAck)
async def upload_stream_frame(
    session_id: str,
    frame_file: UploadFile = File(...),
    frame_number: int = Form(..., ge=0),
    captured_at: datetime | None = Form(None),
    db: Session = Depends(get_db),
    _current_user: FirebaseUser = Depends(get_current_user),
):
    """Receive a frame and process it with the existing detection pipeline."""
    session = stream_session_manager.get_session(session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Stream session {session_id} not found",
        )
    if session.status == "stopped":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Stream session already stopped",
        )

    allowed_types = {mime.strip() for mime in settings.ALLOWED_IMAGE_TYPES.split(",")}
    if frame_file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="frame_file must be image/jpeg or image/png",
        )

    frame_bytes = await frame_file.read()
    if len(frame_bytes) > settings.STREAM_FRAME_MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Frame size is too large",
        )

    try:
        with Image.open(BytesIO(frame_bytes)) as image:
            frame_image = image.convert("RGB")
    except (UnidentifiedImageError, OSError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid frame image: {exc}",
        )

    stream_session_manager.mark_frame_received(session_id, captured_at)
    result = process_stream_frame(
        db,
        session=session,
        frame_number=frame_number,
        frame_image=frame_image,
        captured_at=captured_at,
    )
    stream_session_manager.mark_frame_processed(session_id, result["detections_count"])

    return StreamFrameAck(
        session_id=session_id,
        upload_id=session.upload_id,
        frame_number=frame_number,
        detections_count=result["detections_count"],
        alert_level=result["alert_level"],
        processed_at=datetime.now(),
    )


@router.get("/sessions/{session_id}", response_model=StreamSessionStatus)
def get_stream_session(
    session_id: str,
    _current_user: FirebaseUser = Depends(get_current_user),
):
    """Get stream session status."""
    session = stream_session_manager.get_session(session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Stream session {session_id} not found",
        )
    return _build_stream_status(session)


@router.post("/sessions/{session_id}/stop", response_model=StreamSessionStopResponse)
def stop_stream_session(
    session_id: str,
    db: Session = Depends(get_db),
    _current_user: FirebaseUser = Depends(get_current_user),
):
    """Stop stream session and finalize upload record."""
    session = stream_session_manager.stop_session(session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Stream session {session_id} not found",
        )

    upload = db.query(Upload).filter(Upload.id == session.upload_id).first()
    if upload:
        if upload.status != "failed":
            upload.status = "completed"
        upload.processed_at = datetime.now()
        db.commit()

    return StreamSessionStopResponse(
        session=_build_stream_status(session),
        message="ストリームを停止しました",
    )
