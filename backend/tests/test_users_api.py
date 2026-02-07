from datetime import datetime

from app.api import users
from app.core.auth import FirebaseUser
from app.models.database import User


def _user(uid="u1", email="u1@example.com"):
    user = User(id=1, firebase_uid=uid, email=email, name="tester", email_opt_in=True)
    user.created_at = datetime(2025, 1, 1)
    user.updated_at = None
    user.location_updated_at = None
    return user


def test_sync_current_user_create(build_test_client, fake_db):
    client = build_test_client(
        users.router,
        fake_db,
        require_auth=True,
        user=FirebaseUser(uid="uid-1", email="u1@example.com", name="U1"),
    )

    res = client.post("/api/v1/users/sync")

    assert res.status_code == 200
    assert res.json()["created"] is True


def test_get_my_profile_existing_user(build_test_client, fake_db):
    fake_db.set_query_result("User", [_user()])
    client = build_test_client(
        users.router,
        fake_db,
        require_auth=True,
        user=FirebaseUser(uid="u1", email="u1@example.com", name="U1"),
    )

    res = client.get("/api/v1/users/me")

    assert res.status_code == 200
    assert res.json()["firebase_uid"] == "u1"


def test_update_notification_settings(build_test_client, fake_db):
    fake_db.set_query_result("User", [_user()])
    client = build_test_client(
        users.router,
        fake_db,
        require_auth=True,
        user=FirebaseUser(uid="u1", email="u1@example.com", name="U1"),
    )

    res = client.put("/api/v1/users/me/notification-settings", json={"email_opt_in": False})

    assert res.status_code == 200
    assert res.json()["email_opt_in"] is False


def test_update_my_location(build_test_client, fake_db):
    fake_db.set_query_result("User", [_user()])
    client = build_test_client(
        users.router,
        fake_db,
        require_auth=True,
        user=FirebaseUser(uid="u1", email="u1@example.com", name="U1"),
    )

    res = client.post("/api/v1/users/me/location", json={"latitude": 35.0, "longitude": 139.0})

    assert res.status_code == 200
    assert float(res.json()["latitude"]) == 35.0
