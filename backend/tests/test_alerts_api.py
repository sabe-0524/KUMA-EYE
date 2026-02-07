from datetime import datetime

from app.api import alerts
from app.models.database import Alert


def _alert(aid: int = 1):
    item = Alert(
        id=aid,
        sighting_id=1,
        alert_level="warning",
        message="msg",
        acknowledged=False,
    )
    item.notified_at = datetime(2025, 1, 1)
    return item


def test_list_alerts_returns_total(build_test_client, fake_db):
    fake_db.set_query_result("Alert", [_alert(1), _alert(2)])
    client = build_test_client(alerts.router, fake_db)

    res = client.get("/api/v1/alerts")

    assert res.status_code == 200
    assert res.json()["total"] == 2


def test_get_alert_count(build_test_client, fake_db):
    fake_db.set_query_result("Alert", [_alert(1), _alert(2), _alert(3)])
    client = build_test_client(alerts.router, fake_db)

    res = client.get("/api/v1/alerts/count")

    assert res.status_code == 200
    assert "unacknowledged" in res.json()
    assert "critical" in res.json()


def test_get_alert_404(build_test_client, fake_db):
    client = build_test_client(alerts.router, fake_db)

    res = client.get("/api/v1/alerts/10")

    assert res.status_code == 404


def test_acknowledge_all_alerts(build_test_client, fake_db):
    fake_db.set_query_result("Alert", [_alert(1), _alert(2)])
    client = build_test_client(alerts.router, fake_db)

    res = client.put("/api/v1/alerts/acknowledge-all", json={"acknowledged_by": "u1"})

    assert res.status_code == 200
    assert res.json()["acknowledged_count"] == 2
