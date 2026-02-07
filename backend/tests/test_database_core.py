from app.core import database


class DummySession:
    def __init__(self):
        self.closed = False

    def close(self):
        self.closed = True


def test_get_db_closes_session(monkeypatch):
    session = DummySession()
    monkeypatch.setattr(database, "SessionLocal", lambda: session)

    gen = database.get_db()
    got = next(gen)
    assert got is session

    try:
        next(gen)
    except StopIteration:
        pass

    assert session.closed is True
