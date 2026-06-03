from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from routers import cv, ai

ALLOWED_ORIGINS = [
    "https://lapala.pages.dev",
    "http://localhost:4321",
    "http://localhost:4322",
    "http://localhost:4323",
    "http://localhost:4324",
    "http://localhost:3000",
]

# Si hay dominio personalizado configurado, agregarlo
if custom := os.environ.get("ALLOWED_ORIGIN"):
    ALLOWED_ORIGINS.append(custom)

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="LaPala API", version="0.1.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

app.include_router(cv.router, prefix="/cv")
app.include_router(ai.router, prefix="/ai")


@app.get("/health")
def health():
    return {"status": "ok"}
