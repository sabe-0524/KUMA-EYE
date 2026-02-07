from PIL import Image

from app.services.detection import BearDetectionService


def _service(monkeypatch):
    monkeypatch.setattr(BearDetectionService, "_load_model", lambda self: setattr(self, "model", None))
    return BearDetectionService(model_path="/tmp/no-model.pt")


def test_detect_returns_empty_when_model_not_loaded(monkeypatch):
    service = _service(monkeypatch)
    out = service.detect(Image.new("RGB", (10, 10)))
    assert out == []


def test_calculate_alert_level_boundaries(monkeypatch):
    service = _service(monkeypatch)
    assert service.calculate_alert_level([]) is None
    assert service.calculate_alert_level([{"confidence": 0.95}]) == "critical"
    assert service.calculate_alert_level([{"confidence": 0.8}]) == "warning"
    assert service.calculate_alert_level([{"confidence": 0.5}]) == "caution"
    assert service.calculate_alert_level([{"confidence": 0.1}]) == "low"


def test_create_alert_message_with_camera(monkeypatch):
    service = _service(monkeypatch)
    msg = service.create_alert_message(
        [{"confidence": 0.82}],
        "warning",
        camera_name="Cam-A",
    )
    assert "Cam-A" in msg
    assert "信頼度" in msg


def test_draw_detections_outputs_annotated_image(monkeypatch, tmp_path):
    service = _service(monkeypatch)
    image = Image.new("RGB", (100, 100), color="black")
    detections = [{"confidence": 0.8, "bbox": {"x": 10, "y": 10, "width": 20, "height": 20}}]

    out_path = tmp_path / "annotated.jpg"
    annotated = service.draw_detections(image, detections, output_path=str(out_path))

    assert annotated.size == (100, 100)
    assert out_path.exists()
