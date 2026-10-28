from fastapi import FastAPI

app = FastAPI(title="DocIntel Processor")


@app.get("/health")
def health():
    return {"status": "ok", "service": "processor"}