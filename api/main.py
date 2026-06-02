from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import cv, ai

app = FastAPI(title="LaPala API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # restrict to your domain in production
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

app.include_router(cv.router, prefix="/cv")
app.include_router(ai.router, prefix="/ai")


@app.get("/health")
def health():
    return {"status": "ok"}
