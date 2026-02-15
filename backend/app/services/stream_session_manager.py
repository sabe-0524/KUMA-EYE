"""In-memory stream session manager for webcam streaming PoC."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime
from threading import Lock
from typing import Literal
from uuid import uuid4


SessionStatus = Literal["active", "reconnecting", "stopped"]


@dataclass
class StreamSession:
    session_id: str
    upload_id: int
    frame_interval: int
    camera_id: int | None
    latitude: float | None
    longitude: float | None
    status: SessionStatus
    started_at: datetime
    last_frame_at: datetime | None
    stopped_at: datetime | None
    frames_received: int
    frames_processed: int
    detections_count: int
    reconnect_attempts: int
    notification_dispatched: bool

    def to_dict(self) -> dict:
        return asdict(self)


class StreamSessionManager:
    """Manage stream sessions in memory.

    NOTE:
        This is intentionally in-memory for the local PoC.
    """

    def __init__(self) -> None:
        self._sessions: dict[str, StreamSession] = {}
        self._lock = Lock()

    def create_session(
        self,
        *,
        upload_id: int,
        frame_interval: int,
        camera_id: int | None,
        latitude: float | None,
        longitude: float | None,
    ) -> StreamSession:
        session = StreamSession(
            session_id=uuid4().hex,
            upload_id=upload_id,
            frame_interval=frame_interval,
            camera_id=camera_id,
            latitude=latitude,
            longitude=longitude,
            status="active",
            started_at=datetime.now(),
            last_frame_at=None,
            stopped_at=None,
            frames_received=0,
            frames_processed=0,
            detections_count=0,
            reconnect_attempts=0,
            notification_dispatched=False,
        )
        with self._lock:
            self._sessions[session.session_id] = session
        return session

    def get_session(self, session_id: str) -> StreamSession | None:
        with self._lock:
            return self._sessions.get(session_id)

    def mark_frame_received(self, session_id: str, captured_at: datetime | None = None) -> StreamSession | None:
        with self._lock:
            session = self._sessions.get(session_id)
            if not session:
                return None
            session.frames_received += 1
            session.last_frame_at = captured_at or datetime.now()
            if session.status == "reconnecting":
                session.status = "active"
            return session

    def mark_frame_processed(self, session_id: str, detections_count: int) -> StreamSession | None:
        with self._lock:
            session = self._sessions.get(session_id)
            if not session:
                return None
            session.frames_processed += 1
            session.detections_count += detections_count
            return session

    def mark_reconnecting(self, session_id: str) -> StreamSession | None:
        with self._lock:
            session = self._sessions.get(session_id)
            if not session:
                return None
            if session.status != "stopped":
                session.status = "reconnecting"
                session.reconnect_attempts += 1
            return session

    def stop_session(self, session_id: str) -> StreamSession | None:
        with self._lock:
            session = self._sessions.get(session_id)
            if not session:
                return None
            session.status = "stopped"
            session.stopped_at = datetime.now()
            return session

    def mark_notification_dispatched(self, session_id: str) -> StreamSession | None:
        with self._lock:
            session = self._sessions.get(session_id)
            if not session:
                return None
            session.notification_dispatched = True
            return session

    def reset(self) -> None:
        """Test helper to clear all sessions."""
        with self._lock:
            self._sessions.clear()


stream_session_manager = StreamSessionManager()
