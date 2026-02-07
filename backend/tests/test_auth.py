import asyncio

import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from app.core import auth


def _cred(token="tkn"):
    return HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)


def test_is_default_credentials_error_true_by_message():
    err = Exception("Default credentials were not found")
    assert auth._is_default_credentials_error(err) is True


def test_is_default_credentials_error_false():
    assert auth._is_default_credentials_error(Exception("other")) is False


def test_get_current_user_missing_credentials(monkeypatch):
    monkeypatch.setattr(auth.settings, "DEBUG", True)

    with pytest.raises(HTTPException) as exc:
        asyncio.run(auth.get_current_user(None))

    assert exc.value.status_code == 401


def test_get_current_user_invalid_token(monkeypatch):
    def _raise(_):
        raise auth.auth.InvalidIdTokenError("bad")

    monkeypatch.setattr(auth.auth, "verify_id_token", _raise)

    with pytest.raises(HTTPException) as exc:
        asyncio.run(auth.get_current_user(_cred()))

    assert exc.value.status_code == 401


def test_get_current_user_fallback_success(monkeypatch):
    def _raise(_):
        raise Exception("Default credentials were not found")

    monkeypatch.setattr(auth.auth, "verify_id_token", _raise)
    monkeypatch.setattr(auth, "_verify_id_token_with_public_keys", lambda _token: {"sub": "uid1", "email": "a@b.com"})
    monkeypatch.setattr(auth.settings, "DEBUG", True)

    user = asyncio.run(auth.get_current_user(_cred()))

    assert user.uid == "uid1"
    assert user.email == "a@b.com"


def test_get_optional_user_returns_none_on_http_exception(monkeypatch):
    async def _raise(_):
        raise HTTPException(status_code=401, detail="x")

    monkeypatch.setattr(auth, "get_current_user", _raise)

    out = asyncio.run(auth.get_optional_user(_cred()))

    assert out is None
