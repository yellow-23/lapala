"""AI endpoints — CV generation, analysis, and job matching."""

import base64
import json
import logging
import os

from fastapi import APIRouter, HTTPException, Request, UploadFile, File
import anthropic
from slowapi import Limiter
from slowapi.util import get_remote_address

logger = logging.getLogger(__name__)

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)

SYSTEM_GENERATE_CV = """Eres un experto en CVs para el mercado laboral chileno, para todo tipo de rubros: salud, comercio, construcción, gastronomía, administración, transporte, tecnología, educación, servicios y más.
Genera un CV en formato YAML válido para rendercv (schema: https://docs.rendercv.com).
El CV debe estar en español chileno, ser conciso y orientado a resultados.
Usa verbos de acción concretos y métricas cuando sea posible.
Adapta el tono y vocabulario al rubro de la persona — no uses jerga tech si no corresponde.
Devuelve SOLO el YAML, sin explicaciones ni markdown."""

SYSTEM_ANALYZE_CV = """Eres un experto en reclutamiento chileno para todo tipo de rubros: salud, comercio, construcción, gastronomía, administración, transporte, tecnología, educación, servicios y más.
Analiza el CV y responde SOLO con JSON válido:
{
  "name": "nombre completo",
  "title": "cargo o perfil principal",
  "summary": "resumen de 1-2 oraciones",
  "skills": ["skill1", "skill2"],
  "keywords": ["keyword1", "keyword2"],
  "experience_years": 3
}
- "keywords": 6-10 términos para buscar pegas compatibles. Usa el vocabulario del rubro real (ej: "enfermera", "cajero", "operador de grúa", "cocinero", "vendedor retail") — no traduzcas a inglés ni uses jerga tech si no corresponde.
- "skills": habilidades principales de la persona según su rubro.
- Responde SOLO el JSON, sin texto adicional."""

SYSTEM_MATCH = """Eres un experto en reclutamiento chileno para todo tipo de rubros y niveles: desde operarios y técnicos hasta profesionales y ejecutivos.
Analiza el CV y la oferta de trabajo y responde en JSON con:
{"score": 1-10, "reasoning": "max 15 palabras", "missing_keywords": ["kw1","kw2","kw3"], "tailoring_tips": ["tip en max 10 palabras","tip2","tip3"]}
Máximo 4 missing_keywords y 3 tailoring_tips. Sé directo y usa lenguaje simple."""


def get_client() -> anthropic.Anthropic:
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        raise HTTPException(status_code=503, detail="Servicio de IA no configurado")
    return anthropic.Anthropic(api_key=key)


def _extract_docx_text(data: bytes) -> str:
    import io
    from docx import Document
    doc = Document(io.BytesIO(data))
    return "\n".join(p.text for p in doc.paragraphs if p.text.strip())


@router.post("/analyze-cv")
@limiter.limit("3/day")
async def analyze_cv(request: Request, file: UploadFile = File(...)):
    content_type = file.content_type or ""
    filename = file.filename or ""

    if not (
        content_type == "application/pdf"
        or filename.endswith(".pdf")
        or "word" in content_type
        or filename.endswith(".docx")
    ):
        raise HTTPException(status_code=400, detail="Solo se aceptan PDF o DOCX")

    data = await file.read()
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Archivo demasiado grande (max 10MB)")

    client = get_client()

    if filename.endswith(".pdf") or content_type == "application/pdf":
        pdf_b64 = base64.standard_b64encode(data).decode("utf-8")
        user_content = [
            {
                "type": "document",
                "source": {"type": "base64", "media_type": "application/pdf", "data": pdf_b64},
            },
            {"type": "text", "text": "Analiza este CV y devuelve el JSON solicitado."},
        ]
    else:
        text = _extract_docx_text(data)
        if not text.strip():
            raise HTTPException(status_code=400, detail="No se pudo extraer texto del DOCX")
        user_content = f"Analiza este CV y devuelve el JSON solicitado:\n\n{text[:6000]}"

    msg = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        system=SYSTEM_ANALYZE_CV,
        messages=[{"role": "user", "content": user_content}],
    )

    raw = msg.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

    try:
        return json.loads(raw)
    except Exception:
        logger.error("analyze-cv: json invalido de Claude:\n%s", raw)
        raise HTTPException(status_code=500, detail="Error procesando respuesta de IA")


@router.post("/generate-cv")
@limiter.limit("3/day")
async def generate_cv(request: Request, data: dict):
    context = data.get("context", "")
    if not context.strip():
        raise HTTPException(status_code=400, detail="context requerido")

    client = get_client()
    msg = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4096,
        system=SYSTEM_GENERATE_CV,
        messages=[{"role": "user", "content": f"Genera un CV para esta persona:\n\n{context}"}],
    )
    yaml = msg.content[0].text.strip()
    if yaml.startswith("```"):
        yaml = yaml.split("\n", 1)[-1]
        yaml = yaml.rsplit("```", 1)[0].strip()
    return {"yaml": yaml}


@router.post("/rank-jobs")
@limiter.limit("3/day")
async def rank_jobs(request: Request, data: dict):
    profile = data.get("profile", {})
    jobs = data.get("jobs", [])
    if not profile or not jobs:
        raise HTTPException(status_code=400, detail="profile y jobs requeridos")

    client = get_client()

    jobs_text = "\n\n".join(
        f"ID:{j['id']}\nCargo: {j.get('title','')}\nEmpresa: {j.get('company','')}\n"
        f"Descripcion: {(j.get('description') or '')[:400]}\nTags: {', '.join(j.get('tags', []))}"
        for j in jobs[:15]
    )

    prompt = f"""Perfil del candidato:
Nombre: {profile.get('name')}
Cargo: {profile.get('title')}
Resumen: {profile.get('summary')}
Skills: {', '.join(profile.get('skills', []))}
Keywords: {', '.join(profile.get('keywords', []))}
Anos de experiencia: {profile.get('experience_years')}

Ofertas de trabajo:
{jobs_text}

Devuelve SOLO un JSON array con este formato, ordenado de mayor a menor score:
[{{"id": "job-id", "score": 8, "reason": "max 10 palabras"}}]
Sé honesto. Considera rubro, experiencia y habilidades reales. Score 1-10."""

    msg = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = msg.content[0].text.strip()
    logger.info("rank-jobs raw response:\n%s", raw)
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

    try:
        return {"rankings": json.loads(raw)}
    except Exception as e:
        logger.error("rank-jobs: json invalido de Claude (%s):\n%s", e, raw)
        raise HTTPException(status_code=500, detail=f"JSON invalido de Claude: {raw[:200]}")


@router.post("/match")
@limiter.limit("3/day")
async def match_cv(request: Request, data: dict):
    cv_yaml = data.get("cv_yaml", "")
    job = data.get("job", {})
    if not cv_yaml.strip():
        raise HTTPException(status_code=400, detail="cv_yaml requerido")

    client = get_client()
    prompt = f"""CV:
{cv_yaml[:3000]}

Oferta: {job.get("title")} en {job.get("company")}
{job.get("description", "")[:1500]}"""

    msg = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        system=SYSTEM_MATCH,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = msg.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
    try:
        return json.loads(raw)
    except Exception:
        logger.error("match: json invalido de Claude:\n%s", raw)
        raise HTTPException(status_code=500, detail="JSON invalido de Claude")
