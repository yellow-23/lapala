import io
import os
import re
import subprocess
import tempfile

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)

MAX_YAML_BYTES = 50_000  # 50 KB


def _parse_rendercv_error(output: str) -> str:
    # Extract field-level errors from rendercv's table output
    rows = re.findall(r"│\s+(cv\.[\w.]+)\s+│[^│]+│\s+([^│\n]+)", output)
    if rows:
        return " · ".join(f"{loc}: {msg.strip()}" for loc, msg in rows)
    return "Error al generar el PDF — revisa los datos ingresados"


class RenderRequest(BaseModel):
    yaml_content: str


@router.post("/render")
@limiter.limit("10/day")
async def render_cv(request: Request, req: RenderRequest):
    if len(req.yaml_content.encode()) > MAX_YAML_BYTES:
        raise HTTPException(status_code=400, detail="YAML demasiado grande (max 50KB)")

    with tempfile.TemporaryDirectory() as tmpdir:
        yaml_path = os.path.join(tmpdir, "cv.yaml")
        with open(yaml_path, "w", encoding="utf-8") as f:
            f.write(req.yaml_content)

        result = subprocess.run(
            ["rendercv", "render", yaml_path, "--output-folder", tmpdir],
            capture_output=True,
            text=True,
            timeout=60,
        )

        if result.returncode != 0:
            raise HTTPException(
                status_code=422,
                detail=_parse_rendercv_error(result.stdout + result.stderr),
            )

        pdf_path = None
        for root, _, files in os.walk(tmpdir):
            for fname in files:
                if fname.endswith(".pdf"):
                    pdf_path = os.path.join(root, fname)
                    break
            if pdf_path:
                break

        if not pdf_path:
            raise HTTPException(status_code=500, detail="PDF not generated")

        content = open(pdf_path, "rb").read()

    return StreamingResponse(
        io.BytesIO(content),
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=cv.pdf"},
    )
