"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { getSupabase, type Job } from "../../lib/supabase";

const CITIES = [
  "Santiago", "Antofagasta", "Valparaíso", "Concepción",
  "Iquique", "Calama", "Puerto montt", "La serena", "Temuco", "Rancagua",
];

const CATEGORIES = [
  { label: "Tech", query: "desarrollador" },
  { label: "Ventas", query: "vendedor" },
  { label: "Salud", query: "enfermero" },
  { label: "Construccion", query: "construcción" },
  { label: "Gastronomia", query: "gastronomía" },
  { label: "Admin", query: "administrativo" },
  { label: "Transporte", query: "conductor" },
  { label: "Servicios", query: "limpieza" },
];

const SOURCE_LABEL: Record<string, string> = {
  getonbrd: "Get on Board",
  chiletrabajos: "ChileTrabajos",
  computrabajo: "Computrabajo",
};

const AVATAR_COLORS = [
  "bg-violet-500/20 text-violet-300 border-violet-500/30",
  "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
  "bg-blue-500/20 text-blue-300 border-blue-500/30",
  "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  "bg-orange-500/20 text-orange-300 border-orange-500/30",
  "bg-rose-500/20 text-rose-300 border-rose-500/30",
  "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
];

function avatarColor(name: string) {
  return AVATAR_COLORS[(name.charCodeAt(0) || 0) % AVATAR_COLORS.length];
}

const PAGE_SIZE = 30;

export default function JobList() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [search, setSearch] = useState("");
  const [city, setCity] = useState<string | null>(null);
  const [remote, setRemote] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => { setPage(0); setExpanded(null); }, [search, city, remote]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const supabase = getSupabase();
      let q = supabase
        .from("jobs")
        .select(
          "id,source,title,company,location,remote,url,description,tags,salary,posted_at,fetched_at",
          { count: "exact" }
        )
        .order("fetched_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (remote) q = q.eq("remote", true);
      if (city) q = q.ilike("location", `%${city}%`);
      if (search.length >= 2) q = q.ilike("title", `%${search}%`);

      const { data, error, count } = await q;
      if (!error && data) {
        setJobs(data as Job[]);
        if (count !== null) setTotal(count);
      }
      setLoading(false);
    }
    load();
  }, [search, city, remote, page]);

  return (
    <div>
      {/* Search bar */}
      <div className="flex items-center gap-3 bg-[#13131a] border border-white/10 rounded-2xl px-4 py-3.5 mb-4 focus-within:border-violet-500/40 transition-colors">
        <svg
          className="w-4 h-4 text-gray-500 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          placeholder="Cargo, empresa o tecnología..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-transparent outline-none text-white placeholder-gray-600 text-sm"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="text-gray-600 hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="space-y-3 mb-6">
        {/* Category */}
        <div>
          <p className="text-[10px] uppercase tracking-widest text-gray-600 mb-2">Categoria</p>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => (
              <button
                key={c.label}
                onClick={() => { setSearch(c.query); setExpanded(null); }}
                className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                  search === c.query
                    ? "bg-white/10 border-white/25 text-white"
                    : "border-white/8 text-gray-500 hover:border-white/15 hover:text-gray-300"
                }`}
              >
                {c.label}
              </button>
            ))}
            {search && (
              <button
                onClick={() => setSearch("")}
                className="text-xs px-3 py-1.5 rounded-full border border-white/8 text-gray-600 hover:text-gray-400 transition-all"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>

        {/* City */}
        <div>
          <p className="text-[10px] uppercase tracking-widest text-gray-600 mb-2">Ciudad</p>
          <div className="flex flex-wrap gap-1.5">
            {CITIES.map((c) => (
              <button
                key={c}
                onClick={() => setCity(city === c ? null : c)}
                className={`relative text-xs px-3 py-1.5 rounded-lg transition-colors ${
                  city === c ? "text-white" : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
                }`}
              >
                <span className="relative z-10">{c}</span>
                {city === c && (
                  <motion.span
                    layoutId="city-pill"
                    className="absolute inset-0 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-lg"
                    transition={{ type: "spring", duration: 0.4, bounce: 0.2 }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tipo + count row */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setRemote(!remote)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
              remote
                ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                : "border-white/8 text-gray-500 hover:border-white/15 hover:text-gray-300"
            }`}
          >
            Solo remoto
          </button>
          <span className="ml-auto text-xs text-gray-600">
            {loading ? "..." : `${total} pegas`}
          </span>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <ul className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <li key={i} className="h-[60px] bg-white/5 rounded-xl animate-pulse" />
          ))}
        </ul>
      ) : jobs.length === 0 ? (
        <p className="text-gray-600 text-sm text-center py-16">
          {search ? `Sin resultados para "${search}".` : "Sin pegas disponibles."}
        </p>
      ) : (
        <>
          <ul className="space-y-2">
            {jobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                isExpanded={expanded === job.id}
                onToggle={() => setExpanded(expanded === job.id ? null : job.id)}
              />
            ))}
          </ul>

          {total > PAGE_SIZE && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/8">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="text-xs text-gray-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors px-3 py-2 border border-white/8 rounded-lg hover:border-white/20"
              >
                Anterior
              </button>
              <span className="text-xs text-gray-600">
                {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} de {total}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={(page + 1) * PAGE_SIZE >= total}
                className="text-xs text-gray-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors px-3 py-2 border border-white/8 rounded-lg hover:border-white/20"
              >
                Siguiente
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function JobCard({
  job,
  isExpanded,
  onToggle,
}: {
  job: Job;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <motion.li
      layout
      onClick={onToggle}
      className={`cursor-pointer list-none bg-[#13131a] border rounded-xl px-4 py-3.5 transition-colors select-none ${
        isExpanded
          ? "border-violet-500/30"
          : "border-white/8 hover:border-white/20"
      }`}
    >
      {/* Compact row */}
      <div className="flex items-center gap-3">
        {/* Company avatar */}
        <div className={`w-9 h-9 shrink-0 rounded-lg border flex items-center justify-center text-xs font-bold uppercase ${avatarColor(job.company || job.title)}`}>
          {(job.company || job.title).charAt(0)}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-medium text-white text-sm leading-tight">{job.title}</span>
            <span className="text-xs text-gray-600 shrink-0">{job.company}</span>
          </div>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {job.location && (
              <span className="text-xs text-gray-600">{job.location}</span>
            )}
            {job.remote && (
              <span className="text-xs text-emerald-400/90 bg-emerald-400/10 border border-emerald-400/20 rounded-full px-2 py-0.5">
                Remoto
              </span>
            )}
            {job.tags.slice(0, 3).map((t) => (
              <span
                key={t}
                className="text-xs text-gray-600 bg-white/5 rounded-full px-2 py-0.5"
              >
                {t}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-gray-700 hidden sm:block">
            {SOURCE_LABEL[job.source] ?? job.source}
          </span>
          <motion.span
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="text-gray-600"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </motion.span>
        </div>
      </div>

      {/* Expanded detail */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="mt-4 pt-4 border-t border-white/8">
              {job.description && (
                <p className="text-sm text-gray-400 leading-relaxed line-clamp-4 mb-4">
                  {job.description}
                </p>
              )}

              {job.salary && (
                <p className="text-sm text-gray-400 mb-3">{job.salary}</p>
              )}

              {job.tags.length > 3 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {job.tags.slice(3).map((t) => (
                    <span
                      key={t}
                      className="text-xs text-gray-600 bg-white/5 rounded-full px-2 py-0.5"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}

              <a
                href={job.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-2 text-sm font-medium text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 px-4 py-2 rounded-lg transition-all"
              >
                Ver pega
                <svg
                  className="w-3 h-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25"
                  />
                </svg>
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}
