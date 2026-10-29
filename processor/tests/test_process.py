from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

VALID = {
    "document_id": "44eca8da-3af9-4251-b101-bb3e09e2b9e4",
    "stored_path": "44eca8da-3af9-4251-b101-bb3e09e2b9e4.csv",
    "file_type": "csv",
}


def test_process_is_not_implemented_yet():
    response = client.post("/process", json=VALID)
    assert response.status_code == 501


def test_process_rejects_path_tricks():
    response = client.post("/process", json={**VALID, "stored_path": "../../etc/passwd"})
    assert response.status_code == 422


def test_process_rejects_unknown_file_type():
    response = client.post("/process", json={**VALID, "file_type": "exe"})
    assert response.status_code == 422