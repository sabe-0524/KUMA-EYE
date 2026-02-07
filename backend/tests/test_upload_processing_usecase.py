from app.usecases.upload_processing import execute_upload_processing


class EmptyQuery:
    def filter(self, *args, **kwargs):
        return self

    def first(self):
        return None


class EmptyDB:
    def query(self, model):
        return EmptyQuery()



def test_execute_upload_processing_returns_failed_when_upload_not_found():
    result = execute_upload_processing(db=EmptyDB(), upload_id=999, frame_interval=5)

    assert result["status"] == "failed"
    assert result["upload_id"] == 999
    assert result["error"] == "Upload not found"
