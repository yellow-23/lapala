import { useState, useRef } from "react";
import { getSupabase, type Job } from "../../lib/supabase";
import { useAiLimit } from "./useAiLimit";
import { AiLimitBar, AiLimitBlocked } from "./AiLimitBar";

const API_URL = import.meta.env.PUBLIC_API_URL ?? "https://lapala.onrender.com";

const iCls =
  "bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-700/50 w-full transition-colors";

interface CVProfile {
  name: string;
  title: string;
  summary: string;
  skills: string[];
  keywords: string[];
  experience_years: number;
}

type Tab = "upload" | "generate" | "match";

// ── Upload & Match tab ──────────────────────────────────────────────────────

interface JobWithScore extends Job {
  keywordScore: number;
  aiScore?: number;
  aiReason?: string;
}

function scoreByKeywords(job: Job, keywords: string[]): number {
  const haystack = `${job.title} ${job.description ?? ""} ${job.tags.join(" ")}`.toLowerCase();
  return keywords.filter((kw) => haystack.includes(kw.toLowerCase())).length;
}

function UploadTab({ limit }: { limit: ReturnType<typeof useAiLimit> }) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<CVProfile | null>(null);
  const [jobs, setJobs] = useState<JobWithScore[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [rankLoading, setRankLoading] = useState(false);
  const [ranked, setRanked] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["pdf", "docx"].includes(ext ?? "")) {
      setError("Solo se aceptan archivos PDF o DOCX");
      return;
    }
    if (!limit.canUse) return;
    setLoading(true);
    setError(null);
    setProfile(null);
    setJobs([]);
    setRanked(false);

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch(`${API_URL}/ai/analyze-cv`, { method: "POST", body: form });
      if (res.status === 429) { limit.markExhausted(); throw new Error("Limite de la hora alcanzado. Intenta en unos minutos."); }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? `Error ${res.status}`);
      }
      limit.decrement();
      limit.updateFromHeaders(res.headers);
      const data: CVProfile = await res.json();
      setProfile(data);
      fetchMatches(data.keywords);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  async function fetchMatches(keywords: string[]) {
    if (!keywords.length) return;
    setJobsLoading(true);
    const supabase = getSupabase();
    const seen = new Set<string>();
    const results: Job[] = [];

    await Promise.all(
      keywords.slice(0, 5).map(async (kw) => {
        const { data } = await supabase
          .from("jobs")
          .select("id,source,title,company,location,remote,url,description,tags,salary,posted_at,fetched_at")
          .or(`title.ilike.%${kw}%,description.ilike.%${kw}%`)
          .order("fetched_at", { ascending: false })
          .limit(8);
        (data ?? []).forEach((j) => {
          if (!seen.has(j.id)) { seen.add(j.id); results.push(j as Job); }
        });
      })
    );

    const scored: JobWithScore[] = results
      .map((j) => ({ ...j, keywordScore: scoreByKeywords(j, keywords) }))
      .sort((a, b) => b.keywordScore - a.keywordScore)
      .slice(0, 30);

    setJobs(scored);
    setJobsLoading(false);
  }

  async function handleAiRank(prof: CVProfile) {
    if (!limit.canUse) return;
    setRankLoading(true);
    try {
      const res = await fetch(`${API_URL}/ai/rank-jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: prof, jobs: jobs.slice(0, 15) }),
      });
      if (res.status === 429) { limit.markExhausted(); throw new Error("Limite de la hora alcanzado."); }
      if (!res.ok) throw new Error(`Error ${res.status}`);
      limit.decrement();
      limit.updateFromHeaders(res.headers);
      const data = await res.json();
      const rankMap = new Map<string, { score: number; reason: string }>(
        (data.rankings ?? []).map((r: { id: string; score: number; reason: string }) => [r.id, r])
      );
      setJobs((prev) =>
        prev
          .map((j) => {
            const r = rankMap.get(j.id);
            return r ? { ...j, aiScore: r.score, aiReason: r.reason } : j;
          })
          .sort((a, b) => (b.aiScore ?? b.keywordScore) - (a.aiScore ?? a.keywordScore))
      );
      setRanked(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error rankeando");
    } finally {
      setRankLoading(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  return (
    <div className="space-y-6">
      {/* Dropzone */}
      {!profile && !limit.canUse && <AiLimitBlocked />}
      {!profile && limit.canUse && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`relative cursor-pointer rounded-2xl border-2 border-dashed transition-all p-12 flex flex-col items-center gap-4 text-center
            ${dragging ? "border-blue-700 bg-blue-700/10" : "border-white/15 hover:border-blue-700/50 hover:bg-white/3"}`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.docx"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
          {loading ? (
            <>
              <div className="w-10 h-10 rounded-full border-2 border-blue-700 border-t-transparent animate-spin" />
              <p className="text-sm text-gray-400">Analizando con Claude...</p>
            </>
          ) : (
            <>
              <div className="w-12 h-12 rounded-2xl bg-blue-700/15 border border-blue-700/30 flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-white font-medium">Sube tu CV</p>
                <p className="text-xs text-gray-500 mt-1">PDF o DOCX · hasta 10MB</p>
              </div>
              <p className="text-xs text-gray-600">arrastra aqui o haz click para seleccionar</p>
            </>
          )}
        </div>
      )}

      {error && (
        <div className="text-xs text-red-400 bg-red-400/5 border border-red-400/20 rounded-lg px-3 py-2.5">
          {error}
        </div>
      )}

      {/* Perfil extraido */}
      {profile && (
        <div className="space-y-6">
          <div className="border border-blue-700/25 rounded-2xl p-5 bg-blue-700/5 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold text-white">{profile.name}</p>
                <p className="text-sm text-blue-400">{profile.title}</p>
                {profile.experience_years > 0 && (
                  <p className="text-xs text-gray-500 mt-0.5">{profile.experience_years} años de experiencia</p>
                )}
              </div>
              <button
                onClick={() => { setProfile(null); setJobs([]); setError(null); }}
                className="text-xs text-gray-600 hover:text-gray-400 transition-colors shrink-0"
              >
                Cambiar CV
              </button>
            </div>

            {profile.summary && (
              <p className="text-xs text-gray-400 leading-relaxed">{profile.summary}</p>
            )}

            {profile.skills.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {profile.skills.map((s) => (
                  <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-white/8 border border-white/10 text-gray-300">
                    {s}
                  </span>
                ))}
              </div>
            )}
          </div>


          {/* Matches */}
          <div>
            <div className="flex items-center justify-between mb-4 gap-3">
              <p className="text-sm font-medium text-white">
                Pegas compatibles
                {jobs.length > 0 && <span className="text-gray-600 font-normal ml-2">{jobs.length} encontradas</span>}
              </p>
              {jobs.length > 0 && !ranked && (
                <button
                  onClick={() => handleAiRank(profile)}
                  disabled={rankLoading || !limit.canUse}
                  title={!limit.canUse ? "Limite de hoy alcanzado" : undefined}
                  className="shrink-0 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-blue-800 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium transition-colors"
                >
                  {rankLoading ? (
                    <span className="w-3 h-3 rounded-full border border-white border-t-transparent animate-spin" />
                  ) : (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 1L6.2 3.8L9 4L6.8 6.1L7.4 9L5 7.6L2.6 9L3.2 6.1L1 4L3.8 3.8L5 1Z" fill="currentColor"/></svg>
                  )}
                  {rankLoading ? "Rankeando..." : "Rankear con Claude"}
                </button>
              )}
              {ranked && (
                <span className="text-xs text-blue-600 flex items-center gap-1">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 1L6.2 3.8L9 4L6.8 6.1L7.4 9L5 7.6L2.6 9L3.2 6.1L1 4L3.8 3.8L5 1Z" fill="currentColor"/></svg>
                  Rankeado por IA
                </span>
              )}
            </div>

            {jobsLoading ? (
              <ul className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <li key={i} className="h-16 bg-white/5 rounded-xl animate-pulse" />
                ))}
              </ul>
            ) : jobs.length === 0 ? (
              <p className="text-sm text-gray-600 text-center py-10">
                No encontramos pegas para tu perfil. Intenta con otro CV o mas contexto.
              </p>
            ) : (
              <ul className="space-y-2">
                {jobs.map((job) => (
                  <MatchJobCard
                    key={job.id}
                    job={job}
                    profile={profile}
                    isExpanded={expanded === job.id}
                    onToggle={() => setExpanded(expanded === job.id ? null : job.id)}
                    limit={limit}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Job card para matches ───────────────────────────────────────────────────

const AVATAR_COLORS = [
  "bg-blue-700/20 text-blue-400 border-blue-700/30",
  "bg-blue-700/20 text-blue-400 border-blue-700/30",
  "bg-blue-500/20 text-blue-300 border-blue-500/30",
  "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  "bg-orange-500/20 text-orange-300 border-orange-500/30",
];

interface DetailResult {
  score: number;
  reasoning: string;
  missing_keywords: string[];
  tailoring_tips: string[];
}

function MatchJobCard({
  job, profile, isExpanded, onToggle, limit,
}: {
  job: JobWithScore;
  profile: CVProfile;
  isExpanded: boolean;
  onToggle: () => void;
  limit: ReturnType<typeof useAiLimit>;
}) {
  const color = AVATAR_COLORS[(job.company?.charCodeAt(0) ?? 0) % AVATAR_COLORS.length];
  const scoreColor =
    job.aiScore == null ? "" :
    job.aiScore >= 8 ? "text-emerald-400" :
    job.aiScore >= 5 ? "text-yellow-400" : "text-red-400";

  const [detail, setDetail] = useState<DetailResult | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  async function fetchDetail(e: React.MouseEvent) {
    e.stopPropagation();
    if (detail) { setDetailOpen((o) => !o); return; }
    if (!limit.canUse) { setDetailOpen(true); return; }
    setDetailLoading(true);
    setDetailOpen(true);
    try {
      const cvText = `Nombre: ${profile.name}\nCargo: ${profile.title}\nResumen: ${profile.summary}\nSkills: ${profile.skills.join(", ")}\nExperiencia: ${profile.experience_years} años`;
      const res = await fetch(`${API_URL}/ai/match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cv_yaml: cvText,
          job: { title: job.title, company: job.company, description: job.description },
        }),
      });
      if (res.status === 429) { limit.markExhausted(); return; }
      if (res.ok) {
        const d = await res.json();
        if (d.score != null) {
          limit.decrement();
          limit.updateFromHeaders(res.headers);
          setDetail(d);
        }
      }
    } finally {
      setDetailLoading(false);
    }
  }

  const detailScoreColor =
    detail == null ? "" :
    detail.score >= 8 ? "text-emerald-400" :
    detail.score >= 5 ? "text-yellow-400" : "text-red-400";

  return (
    <li
      onClick={onToggle}
      className={`cursor-pointer list-none bg-[#13131a] border rounded-xl px-4 py-3.5 transition-colors select-none ${
        isExpanded ? "border-blue-700/30" : "border-white/8 hover:border-white/20"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 shrink-0 rounded-lg border flex items-center justify-center text-xs font-bold uppercase ${color}`}>
          {(job.company || job.title).charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-white text-sm leading-tight">{job.title}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-xs text-gray-600">{job.company}</span>
            {job.location && <span className="text-xs text-gray-600">{job.location}</span>}
            {job.remote && (
              <span className="text-xs text-emerald-400/90 bg-emerald-400/10 border border-emerald-400/20 rounded-full px-2 py-0.5">
                Remoto
              </span>
            )}
          </div>
          {job.aiScore != null && job.aiReason && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-1">{job.aiReason}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {job.aiScore != null && (
            <span className={`text-sm font-bold tabular-nums ${scoreColor}`}>
              {job.aiScore}<span className="text-gray-600 text-xs font-normal">/10</span>
            </span>
          )}
          <button
            onClick={fetchDetail}
            title="Ver analisis detallado"
            className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-colors ${
              detailOpen
                ? "bg-blue-800/30 text-blue-400 border border-blue-700/40"
                : "bg-white/5 text-gray-500 hover:bg-white/10 hover:text-gray-300 border border-white/8"
            }`}
          >
            ···
          </button>
          <svg
            className={`w-4 h-4 text-gray-600 transition-transform ${isExpanded ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </div>
      </div>

      {/* Panel de detalle IA */}
      {detailOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="mt-3 rounded-lg border border-blue-700/20 bg-blue-700/5 p-3 space-y-3"
        >
          {detailLoading ? (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span className="w-3 h-3 rounded-full border border-blue-600 border-t-transparent animate-spin" />
              Analizando con Claude...
            </div>
          ) : !limit.canUse && !detail ? (
            <p className="text-xs text-amber-400">Limite de analisis de hoy alcanzado. Vuelve manana.</p>
          ) : detail ? (
            <>
              <div className="flex items-baseline gap-2">
                <span className={`text-2xl font-bold tabular-nums ${detailScoreColor}`}>
                  {detail.score}<span className="text-sm text-gray-600 font-normal">/10</span>
                </span>
                <span className="text-xs text-gray-400">{detail.reasoning}</span>
              </div>
              {detail.missing_keywords?.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-wider text-gray-600">Te falta</p>
                  <div className="flex flex-wrap gap-1">
                    {detail.missing_keywords.map((kw) => (
                      <span key={kw} className="text-xs px-2 py-0.5 rounded-full bg-red-400/10 text-red-400 border border-red-400/20">{kw}</span>
                    ))}
                  </div>
                </div>
              )}
              {detail.tailoring_tips?.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-wider text-gray-600">Tips</p>
                  <ul className="space-y-1">
                    {detail.tailoring_tips.map((tip, i) => (
                      <li key={i} className="text-xs text-gray-400 flex gap-1.5">
                        <span className="text-blue-700 shrink-0">→</span>{tip}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <p className="text-xs text-red-400">No se pudo cargar el analisis.</p>
          )}
        </div>
      )}

      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-white/8 space-y-3">
          {job.description && (
            <p className="text-sm text-gray-400 leading-relaxed line-clamp-4">{job.description}</p>
          )}
          {job.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {job.tags.slice(0, 6).map((t) => (
                <span key={t} className="text-xs text-gray-600 bg-white/5 rounded-full px-2 py-0.5">{t}</span>
              ))}
            </div>
          )}
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-2 text-sm font-medium text-white bg-blue-800 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors"
          >
            Ver pega
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
            </svg>
          </a>
        </div>
      )}
    </li>
  );
}

// ── Generar CV tab ──────────────────────────────────────────────────────────

function GenerateTab({ limit }: { limit: ReturnType<typeof useAiLimit> }) {
  const [context, setContext] = useState("");
  const [generatedYaml, setGeneratedYaml] = useState("");
  const [genLoading, setGenLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    if (!context.trim() || !limit.canUse) return;
    setGenLoading(true);
    setError(null);
    setGeneratedYaml("");
    try {
      const res = await fetch(`${API_URL}/ai/generate-cv`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? `Error ${res.status}`);
      }
      if (res.status === 429) { limit.markExhausted(); throw new Error("Limite de la hora alcanzado."); }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? `Error ${res.status}`);
      }
      limit.decrement();
      limit.updateFromHeaders(res.headers);
      const data = await res.json();
      setGeneratedYaml(data.yaml ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setGenLoading(false);
    }
  }

  async function handleRenderPdf() {
    if (!generatedYaml) return;
    setPdfLoading(true);
    try {
      const res = await fetch(`${API_URL}/cv/render`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yaml_content: generatedYaml }),
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "cv.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error generando PDF");
    } finally {
      setPdfLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <p className="text-xs text-gray-500">
        Describe tu experiencia en texto libre. Claude genera el YAML y puedes descargarlo como PDF.
      </p>
      <label className="block">
        <span className="text-xs text-gray-400 mb-1.5 block">Tu experiencia / contexto</span>
        <textarea
          className={`${iCls} resize-none`}
          rows={10}
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder={`Ejemplos:
"Soy técnico en enfermería con 5 años de experiencia en urgencias, manejo de vías venosas y administración de medicamentos."
"Trabajé 3 años como vendedora en retail de ropa, con metas cumplidas y manejo de caja."
"Soy electricista con certificación SEC, experiencia en faena minera y obras civiles."
Describe tu experiencia con tus propias palabras.`}
        />
      </label>
      {error && (
        <div className="text-xs text-red-400 bg-red-400/5 border border-red-400/20 rounded-lg px-3 py-2.5">{error}</div>
      )}
      {!limit.canUse ? (
        <AiLimitBlocked />
      ) : (
        <>
          <button
            onClick={handleGenerate}
            disabled={genLoading || !context.trim()}
            className="w-full py-3 rounded-lg bg-blue-800 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium transition-colors"
          >
            {genLoading ? "Generando con Claude..." : "Generar CV con IA"}
          </button>
        </>
      )}
      {generatedYaml && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">YAML generado</span>
            <button onClick={() => navigator.clipboard.writeText(generatedYaml)} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
              Copiar
            </button>
          </div>
          <pre className="text-xs text-gray-400 bg-white/3 border border-white/8 rounded-lg p-4 overflow-auto max-h-72">{generatedYaml}</pre>
          <button
            onClick={handleRenderPdf}
            disabled={pdfLoading}
            className="w-full py-2.5 rounded-lg border border-blue-700/40 text-blue-400 hover:bg-blue-700/10 disabled:opacity-40 text-sm transition-colors"
          >
            {pdfLoading ? "Generando PDF..." : "Descargar PDF"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Match tab ───────────────────────────────────────────────────────────────

function MatchTab({ limit }: { limit: ReturnType<typeof useAiLimit> }) {
  const [cvYaml, setCvYaml] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [jobCompany, setJobCompany] = useState("");
  const [jobDesc, setJobDesc] = useState("");
  const [result, setResult] = useState<{ score: number; reasoning: string; missing_keywords: string[]; tailoring_tips: string[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleMatch() {
    if (!cvYaml.trim() || !jobDesc.trim() || !limit.canUse) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`${API_URL}/ai/match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cv_yaml: cvYaml, job: { title: jobTitle, company: jobCompany, description: jobDesc } }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? `Error ${res.status}`);
      }
      if (res.status === 429) { limit.markExhausted(); throw new Error("Limite de la hora alcanzado."); }
      limit.decrement();
      limit.updateFromHeaders(res.headers);
      setResult(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  const scoreColor = result == null ? "" : result.score >= 8 ? "text-emerald-400" : result.score >= 5 ? "text-yellow-400" : "text-red-400";

  return (
    <div className="space-y-5">
      <p className="text-xs text-gray-500">
        Pega tu CV en YAML y los datos de la oferta. Claude calcula la compatibilidad y te da tips para personalizar tu postulacion.
      </p>
      <label className="block">
        <span className="text-xs text-gray-400 mb-1.5 block">Tu CV (YAML de rendercv)</span>
        <textarea className={`${iCls} resize-none`} rows={7} value={cvYaml} onChange={(e) => setCvYaml(e.target.value)} placeholder="Pega aqui el YAML..." />
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="block">
          <span className="text-xs text-gray-400 mb-1.5 block">Cargo</span>
          <input className={iCls} value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="Desarrollador Backend" />
        </label>
        <label className="block">
          <span className="text-xs text-gray-400 mb-1.5 block">Empresa</span>
          <input className={iCls} value={jobCompany} onChange={(e) => setJobCompany(e.target.value)} placeholder="Empresa S.A." />
        </label>
      </div>
      <label className="block">
        <span className="text-xs text-gray-400 mb-1.5 block">Descripcion de la oferta</span>
        <textarea className={`${iCls} resize-none`} rows={5} value={jobDesc} onChange={(e) => setJobDesc(e.target.value)} placeholder="Pega aqui el texto de la oferta..." />
      </label>
      {error && <div className="text-xs text-red-400 bg-red-400/5 border border-red-400/20 rounded-lg px-3 py-2.5">{error}</div>}
      {!limit.canUse ? (
        <AiLimitBlocked />
      ) : (
        <>
          <button
            onClick={handleMatch}
            disabled={loading || !cvYaml.trim() || !jobDesc.trim()}
            className="w-full py-3 rounded-lg bg-blue-800 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium transition-colors"
          >
            {loading ? "Analizando con Claude..." : "Analizar compatibilidad"}
          </button>
        </>
      )}
      {result && (
        <div className="border border-white/10 rounded-xl p-5 space-y-4 bg-white/3">
          <div className="flex items-baseline gap-3">
            <span className={`text-4xl font-bold tabular-nums ${scoreColor}`}>
              {result.score}<span className="text-lg text-gray-600">/10</span>
            </span>
            <span className="text-sm text-gray-400">{result.reasoning}</span>
          </div>
          {result.missing_keywords?.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs text-gray-500">Keywords que faltan</span>
              <div className="flex flex-wrap gap-1.5">
                {result.missing_keywords.map((kw) => (
                  <span key={kw} className="text-xs px-2 py-0.5 rounded-full bg-red-400/10 text-red-400 border border-red-400/20">{kw}</span>
                ))}
              </div>
            </div>
          )}
          {result.tailoring_tips?.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs text-gray-500">Tips para tu postulacion</span>
              <ul className="space-y-1.5">
                {result.tailoring_tips.map((tip, i) => (
                  <li key={i} className="text-xs text-gray-400 flex gap-2">
                    <span className="text-blue-700 shrink-0">→</span>{tip}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Root ────────────────────────────────────────────────────────────────────

export default function AIPanel() {
  const [tab, setTab] = useState<Tab>("upload");
  const sharedLimit = useAiLimit(3);

  const tabs: { id: Tab; label: string }[] = [
    { id: "upload", label: "Analizar mi CV" },
    { id: "generate", label: "Generar CV" },
    { id: "match", label: "Match manual" },
  ];

  return (
    <div className="space-y-6">
      <AiLimitBar remaining={sharedLimit.remaining} limit={sharedLimit.limit} singular="intento de IA" plural="intentos de IA" />

      <div className="flex gap-1 border-b border-white/8">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`text-xs px-4 py-2 -mb-px border-b transition-colors ${
              tab === t.id ? "border-blue-700 text-blue-400" : "border-transparent text-gray-500 hover:text-gray-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "upload" && <UploadTab limit={sharedLimit} />}
      {tab === "generate" && <GenerateTab limit={sharedLimit} />}
      {tab === "match" && <MatchTab limit={sharedLimit} />}
    </div>
  );
}
