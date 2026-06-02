"""CV render endpoint — rendercv YAML -> PDF -> Supabase Storage -> URL."""

import os
import subprocess
import tempfile
import uuid

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


class RenderRequest(BaseModel):
    yaml_content: str


class RenderResponse(BaseModel):
    pdf_url: str


@router.post("/render", response_model=RenderResponse)
async def render_cv(req: RenderRequest):
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
            raise HTTPException(status_code=422, detail=result.stderr[:500])

        # Find the generated PDF
        pdf_path = next(
            (os.path.join(tmpdir, f) for f in os.listdir(tmpdir) if f.endswith(".pdf")),
            None,
        )
        if not pdf_path:
            raise HTTPException(status_code=500, detail="PDF not generated")

        # Upload to Supabase Storage
        from supabase import create_client
        client = create_client(
            os.environ["SUPABASE_URL"],
            os.environ["SUPABASE_SERVICE_KEY"],
        )
        key = f"cvs/{uuid.uuid4()}.pdf"
        with open(pdf_path, "rb") as f:
            client.storage.from_("cvs").upload(key, f, {"content-type": "application/pdf"})

        public_url = client.storage.from_("cvs").get_public_url(key)
        return RenderResponse(pdf_url=public_url)
