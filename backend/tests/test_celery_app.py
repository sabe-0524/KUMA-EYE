from app.workers.celery_app import celery_app


def test_celery_app_configuration():
    assert celery_app.main == "bear_detection"
    assert celery_app.conf.task_serializer == "json"
    assert celery_app.conf.result_serializer == "json"
