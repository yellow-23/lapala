"""AI endpoints — CV generation and job matching. BYOK: client sends their Anthropic key."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import anthropic

router = APIRouter()

SYSTEM_GENERATE_CV = """Eres un experto en CVs para el mercado chileno de tecnología.
Genera un CV en formato YAML válido para rendercv (schema: https://docs.rendercv.com).
El CV debe estar en español chileno, ser conciso y orientado a resultados.
Usa verbos de acción, incluye métricas donde sea posible.
Devuelve SOLO el YAML, sin explicaciones ni markdown."""

SYSTEM_MATCH = """Eres un experto en reclutamiento tech chileno.
Analiza el CV y la oferta de trabajo y responde en JSON con:
{"score": 1-10, "reasoning": "string corto", "missing_keywords": ["kw1","kw2"], "tailoring_tips": ["tip1"]}
Score 8+ = muy buena coincidencia. Sé honesto y específico."""


@router.post("/generate-cv")
async def generate_cv(data: dict):
    api_key = data.get("api_key")
    context = data.get("context", "")  # free text or LinkedIn export content
    if not api_key:
        raise HTTPException(status_code=400, detail="api_key required")

    client = anthropic.Anthropic(api_key=api_key)
    msg = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4096,
        system=SYSTEM_GENERATE_CV,
        messages=[{"role": "user", "content": f"Genera un CV para esta persona:\n\n{context}"}],
    )
    return {"yaml": msg.content[0].text}


@router.post("/match")
async def match_cv(data: dict):
    api_key = data.get("api_key")
    cv_yaml = data.get("cv_yaml", "")
    job = data.get("job", {})
    if not api_key:
        raise HTTPException(status_code=400, detail="api_key required")

    client = anthropic.Anthropic(api_key=api_key)
    prompt = f"""CV:
{cv_yaml[:3000]}

Oferta: {job.get("title")} en {job.get("company")}
{job.get("description", "")[:1500]}"""

    msg = client.messages.create(
        model="claude-haiku-4-5-20251001",  # haiku for cost efficiency on matches
        max_tokens=512,
        system=SYSTEM_MATCH,
        messages=[{"role": "user", "content": prompt}],
    )
    import json
    try:
        return json.loads(msg.content[0].text)
    except Exception:
        return {"raw": msg.content[0].text}
