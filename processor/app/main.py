from typing import Literal

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(title="DocIntel Processor")

# Stored files are always "<uuid>.<extension>" (no folders), so path tricks are rejected early.
STORED_PATH_PATTERN = (
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
    r"\.(pdf|jpg|png|tiff|xlsx|xls|csv)$"
)


class ProcessRequest(BaseModel):
    document_id: str = Field(
        pattern=r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
    )
    stored_path: str = Field(pattern=STORED_PATH_PATTERN)
    file_type: Literal["pdf", "jpg", "png", "tiff", "xlsx", "xls", "csv"]


@app.get("/health")
def health():
    return {"status": "ok", "service": "processor"}


@app.post("/process")
def process(request: ProcessRequest):
    # Real processing arrives in Step 7 (PDF), Step 8 (images) and Step 9 (spreadsheets).
    raise HTTPException(status_code=501, detail="Processing is not implemented yet")