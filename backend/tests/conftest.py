import sys
from datetime import datetime
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.core.auth import FirebaseUser, get_current_user, get_optional_user
from app.core.database import get_db
from app.core.config import settings


class FakeQuery:
    def __init__(self, items=None):
        self.items = list(items or [])
        self._scalars = []

    def options(self, *args, **kwargs):
        return self

    def filter(self, *args, **kwargs):
        return self

    def join(self, *args, **kwargs):
        return self

    def group_by(self, *args, **kwargs):
        return self

    def order_by(self, *args, **kwargs):
        return self

    def offset(self, *args, **kwargs):
        return self

    def limit(self, *args, **kwargs):
        return self

    def update(self, values):
        count = 0
        for item in self.items:
            for key, value in values.items():
                setattr(item, key, value)
            count += 1
        return count

    def first(self):
        return self.items[0] if self.items else None

    def all(self):
        return list(self.items)

    def count(self):
        return len(self.items)

    def scalar(self):
        return self._scalars[0] if self._scalars else None

    def with_scalar_values(self, values):
        self._scalars = list(values)
        return self


class FakeExecuteResult:
    def __init__(self, value):
        self.value = value

    def scalar_one(self):
        return self.value


class FakeDB:
    def __init__(self):
        self.data = {}
        self.added = []
        self.deleted = []
        self.commits = 0
        self.rollbacks = 0
        self.refreshed = []
        self.flushed = 0
        self.execute_value = True
        self.next_id = 1
        self.fail_commit = False

    def set_query_result(self, model_name, items):
        self.data[model_name] = list(items)

    def query(self, *models):
        model = models[0]
        model_name = getattr(model, "__name__", str(model))
        return FakeQuery(self.data.get(model_name, []))

    def add(self, obj):
        if getattr(obj, "id", None) is None:
            setattr(obj, "id", self.next_id)
            self.next_id += 1
        if hasattr(obj, "created_at") and getattr(obj, "created_at", None) is None:
            setattr(obj, "created_at", datetime.now())
        if hasattr(obj, "email_opt_in") and getattr(obj, "email_opt_in", None) is None:
            setattr(obj, "email_opt_in", True)
        self.added.append(obj)

    def delete(self, obj):
        self.deleted.append(obj)

    def commit(self):
        if self.fail_commit:
            raise RuntimeError("commit failed")
        self.commits += 1

    def rollback(self):
        self.rollbacks += 1

    def refresh(self, obj):
        self.refreshed.append(obj)

    def flush(self):
        self.flushed += 1

    def execute(self, _):
        return FakeExecuteResult(self.execute_value)


@pytest.fixture
def fake_user():
    return FirebaseUser(uid="test-uid", email="user@example.com", name="Tester")


@pytest.fixture
def fake_db():
    return FakeDB()


@pytest.fixture
def build_test_client(tmp_path):
    def _build(
        router,
        db,
        *,
        require_auth: bool = False,
        user: FirebaseUser | None = None,
        route_prefix: str | None = None,
    ):
        app = FastAPI()
        app.include_router(router, prefix=route_prefix or settings.API_V1_PREFIX)

        def override_get_db():
            yield db

        app.dependency_overrides[get_db] = override_get_db
        app.dependency_overrides[get_optional_user] = lambda: user
        if require_auth:
            app.dependency_overrides[get_current_user] = lambda: user or FirebaseUser(
                uid="auth-uid",
                email="auth@example.com",
            )

        return TestClient(app)

    return _build
