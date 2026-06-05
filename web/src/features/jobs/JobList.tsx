"use client";

import { useEffect, useRef, useState } from "react";
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
  "bg-blue-700/20 text-blue-400 border-blue-700/30",
  "bg-blue-700/20 text-blue-400 border-blue-700/30",
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

function interleaveBySource(jobs: Job[]): Job[] {
  const buckets = new Map<string, Job[]>();
  for (const job of jobs) {
    if (!buckets.has(job.source)) buckets.set(job.source, []);
    buckets.get(job.source)!.push(job);
  }
  const sources = [...buckets.values()];
  const result: Job[] = [];
  let i = 0;
  while (result.length < jobs.length) {
    const bucket = sources[i % sources.length];
    if (bucket.length > 0) result.push(bucket.shift()!);
    i++;
    if (sources.every((b) => b.length === 0)) break;
  }
  return result;
}

type Category = typeof CATEGORIES[0];

const X_ICON = (
  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

export default function JobList() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<Category | null>(null);
  const [city, setCity] = useState<string | null>(null);
  const [remote, setRemote] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);

  const [catDropOpen, setCatDropOpen] = useState(false);
  const [cityDropOpen, setCityDropOpen] = useState(false);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const catRef = useRef<HTMLDivElement>(null);
  const cityRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!catDropOpen && !cityDropOpen) return;
    function handleClick(e: MouseEvent) {
      if (catDropOpen && catRef.current && !catRef.current.contains(e.target as Node)) setCatDropOpen(false);
      if (cityDropOpen && cityRef.current && !cityRef.current.contains(e.target as Node)) setCityDropOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [catDropOpen, cityDropOpen]);

  const hasFilters = search.length >= 2 || !!category || !!city || remote;
  const filterCount = [!!category, !!city, remote].filter(Boolean).length;
  const clearAll = () => { setSearch(""); setCategory(null); setCity(null); setRemote(false); };

  useEffect(() => { setPage(0); setExpanded(null); }, [search, category, city, remote]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const supabase = getSupabase();
      const SOURCES = ["bne", "chiletrabajos", "computrabajo", "getonbrd"];
      const perSource = Math.ceil(PAGE_SIZE / SOURCES.length);
      const SELECT = "id,source,title,company,location,remote,url,description,tags,salary,posted_at,fetched_at";

      function applyFilters(q: ReturnType<typeof supabase.from>) {
        if (remote) q = (q as any).eq("remote", true);
        if (city) q = (q as any).ilike("location", `%${city}%`);
        if (search.length >= 2) q = (q as any).or(`title.ilike.%${search}%,description.ilike.%${search}%,company.ilike.%${search}%`);
        if (category) q = (q as any).or(`title.ilike.%${category.query}%,description.ilike.%${category.query}%`);
        return q;
      }

      if (hasFilters) {
        let q = supabase
          .from("jobs")
          .select(SELECT, { count: "exact" })
          .order("fetched_at", { ascending: false })
          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
        q = applyFilters(q) as any;
        const { data, error, count } = await q;
        if (!error && data) {
          setJobs(interleaveBySource(data as Job[]));
          if (count !== null) setTotal(count);
        }
      } else {
        const results = await Promise.all(
          SOURCES.map((src) =>
            supabase
              .from("jobs")
              .select(SELECT, { count: "exact" })
              .eq("source", src)
              .order("fetched_at", { ascending: false })
              .range(page * perSource, (page + 1) * perSource - 1)
          )
        );
        setJobs(interleaveBySource(results.flatMap((r) => (r.data ?? []) as Job[])));
        setTotal(results.reduce((sum, r) => sum + (r.count ?? 0), 0));
      }
      setLoading(false);
    }
    load();
  }, [search, category, city, remote, page]);

  const CHEVRON = (open: boolean) => (
    <motion.svg animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}
      className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </motion.svg>
  );

  const CHECK = (
    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );

  return (
    <div>
      {/* Barra principal tipo Portal Inmobiliario */}
      <div className="flex items-stretch bg-[#13131a] border border-white/10 rounded-2xl mb-3 overflow-visible">

        {/* Tipo de pega */}
        <div ref={catRef} className="relative">
          <button
            onClick={() => { setCatDropOpen(v => !v); setCityDropOpen(false); }}
            className={`flex items-center gap-2 px-4 py-3.5 text-sm transition-colors cursor-pointer w-[152px] ${
              category ? "text-white" : catDropOpen ? "text-gray-300" : "text-gray-500 hover:text-gray-300"
            }`}
          >
            <span className="flex-1 text-left truncate">{category?.label ?? "Tipo de pega"}</span>
            {CHEVRON(catDropOpen)}
          </button>
          <AnimatePresence>
            {catDropOpen && (
              <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.14 }}
                className="absolute left-0 top-full mt-2 z-30 bg-[#1a1a24] border border-white/12 rounded-2xl py-2 shadow-2xl shadow-black/60 w-52"
              >
                {category && (
                  <button onClick={() => { setCategory(null); setCatDropOpen(false); }}
                    className="w-full text-left text-xs px-4 py-2 text-gray-600 hover:text-gray-400 transition-colors cursor-pointer">
                    Cualquier tipo
                  </button>
                )}
                {CATEGORIES.map(c => (
                  <button key={c.label}
                    onClick={() => { setCategory(category?.label === c.label ? null : c); setCatDropOpen(false); }}
                    className={`w-full flex items-center justify-between text-sm px-4 py-2.5 transition-colors cursor-pointer ${
                      category?.label === c.label ? "text-white bg-white/10" : "text-gray-400 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    {c.label}
                    {category?.label === c.label && CHECK}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="w-px bg-white/8 my-3" />

        {/* Ciudad */}
        <div ref={cityRef} className="relative">
          <button
            onClick={() => { setCityDropOpen(v => !v); setCatDropOpen(false); }}
            className={`flex items-center gap-2 px-4 py-3.5 text-sm transition-colors cursor-pointer w-[148px] ${
              city ? "text-white" : cityDropOpen ? "text-gray-300" : "text-gray-500 hover:text-gray-300"
            }`}
          >
            <span className="flex-1 text-left truncate">{city ?? "Ciudad"}</span>
            {CHEVRON(cityDropOpen)}
          </button>
          <AnimatePresence>
            {cityDropOpen && (
              <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.14 }}
                className="absolute left-0 top-full mt-2 z-30 bg-[#1a1a24] border border-white/12 rounded-2xl py-2 shadow-2xl shadow-black/60 w-52"
              >
                {city && (
                  <button onClick={() => { setCity(null); setCityDropOpen(false); }}
                    className="w-full text-left text-xs px-4 py-2 text-gray-600 hover:text-gray-400 transition-colors cursor-pointer">
                    Cualquier ciudad
                  </button>
                )}
                {CITIES.map(c => (
                  <button key={c}
                    onClick={() => { setCity(city === c ? null : c); setCityDropOpen(false); }}
                    className={`w-full flex items-center justify-between text-sm px-4 py-2.5 transition-colors cursor-pointer ${
                      city === c ? "text-white bg-white/10" : "text-gray-400 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    {c}
                    {city === c && CHECK}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="w-px bg-white/8 my-3" />

        {/* Texto libre */}
        <div className="flex-1 flex items-center gap-2 px-4">
          <svg className="w-4 h-4 text-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Cargo, empresa, keyword..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent outline-none text-white placeholder-gray-600 text-sm"
          />
          {search && (
            <button onClick={() => setSearch("")} className="text-gray-600 hover:text-white transition-colors cursor-pointer">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <div className="w-px bg-white/8 my-3" />

        {/* Filtrar */}
        <button
          onClick={() => setFilterPanelOpen(true)}
          className={`flex items-center gap-2 px-4 py-3.5 text-sm transition-colors cursor-pointer rounded-r-2xl ${
            filterCount > 0 ? "text-white" : "text-gray-500 hover:text-gray-300"
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
          </svg>
          Filtrar
          {filterCount > 0 && (
            <span className="w-4 h-4 rounded-full bg-blue-800 text-white text-[10px] flex items-center justify-center font-medium">
              {filterCount}
            </span>
          )}
        </button>
      </div>

      {/* Chips activos + conteo */}
      <div className="flex items-center gap-2 mb-3 min-h-[24px] flex-wrap">
        <AnimatePresence>
          {search && (
            <motion.span key="cs" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85 }} transition={{ duration: 0.15 }}
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-white/10 border border-white/20 text-white"
            >
              "{search}"
              <button onClick={() => setSearch("")} aria-label="Quitar busqueda" className="hover:text-white transition-colors cursor-pointer">{X_ICON}</button>
            </motion.span>
          )}
          {category && (
            <motion.span key="cc" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85 }} transition={{ duration: 0.15 }}
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-white/10 border border-white/20 text-white"
            >
              {category.label}
              <button onClick={() => setCategory(null)} aria-label="Quitar categoria" className="hover:text-white transition-colors cursor-pointer">{X_ICON}</button>
            </motion.span>
          )}
          {city && (
            <motion.span key="cy" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85 }} transition={{ duration: 0.15 }}
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-white/10 border border-white/20 text-white"
            >
              {city}
              <button onClick={() => setCity(null)} aria-label="Quitar ciudad" className="hover:text-white transition-colors cursor-pointer">{X_ICON}</button>
            </motion.span>
          )}
          {remote && (
            <motion.span key="cr" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85 }} transition={{ duration: 0.15 }}
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300"
            >
              Remoto
              <button onClick={() => setRemote(false)} aria-label="Quitar remoto" className="hover:text-white transition-colors cursor-pointer">{X_ICON}</button>
            </motion.span>
          )}
        </AnimatePresence>
        {hasFilters && (
          <button onClick={clearAll} className="text-xs text-gray-700 hover:text-gray-500 transition-colors cursor-pointer">
            Limpiar todo
          </button>
        )}
        <span className="ml-auto text-xs text-gray-600 tabular-nums shrink-0">
          {loading
            ? "buscando..."
            : <><span className="text-gray-400 font-medium">{total.toLocaleString("es-CL")}</span> pegas</>
          }
        </span>
      </div>

      {/* Panel lateral de filtros */}
      <AnimatePresence>
        {filterPanelOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setFilterPanelOpen(false)}
              className="fixed inset-0 bg-black/60 z-40"
            />
            <motion.aside
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 220 }}
              className="fixed inset-y-0 right-0 w-72 bg-[#13131a] border-l border-white/10 z-50 flex flex-col"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-white text-sm">Filtros</span>
                  {filterCount > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/8 text-gray-300 border border-white/15">
                      {filterCount}
                    </span>
                  )}
                </div>
                <button onClick={() => setFilterPanelOpen(false)} className="text-gray-500 hover:text-white transition-colors cursor-pointer">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
                <div>
                  <p className="text-white font-medium text-sm mb-2.5">Tipo de pega</p>
                  <div className="space-y-0.5">
                    {CATEGORIES.map(c => (
                      <button key={c.label}
                        onClick={() => setCategory(category?.label === c.label ? null : c)}
                        className={`w-full flex items-center justify-between text-sm px-3 py-2.5 rounded-xl transition-colors cursor-pointer ${
                          category?.label === c.label ? "bg-white/8 text-white" : "text-gray-400 hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        {c.label}
                        {category?.label === c.label && CHECK}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="border-t border-white/8 pt-6">
                  <p className="text-white font-medium text-sm mb-2.5">Ciudad</p>
                  <div className="space-y-0.5">
                    {CITIES.map(c => (
                      <button key={c}
                        onClick={() => setCity(city === c ? null : c)}
                        className={`w-full flex items-center justify-between text-sm px-3 py-2.5 rounded-xl transition-colors cursor-pointer ${
                          city === c ? "bg-white/8 text-white" : "text-gray-400 hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        {c}
                        {city === c && CHECK}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="border-t border-white/8 pt-6">
                  <p className="text-white font-medium text-sm mb-2.5">Modalidad</p>
                  <button
                    onClick={() => setRemote(!remote)}
                    className={`w-full flex items-center justify-between text-sm px-3 py-2.5 rounded-xl transition-colors cursor-pointer ${
                      remote ? "bg-emerald-500/15 text-emerald-300" : "text-gray-400 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    Solo remoto
                    {remote && CHECK}
                  </button>
                </div>
              </div>

              <div className="px-5 py-4 border-t border-white/8 flex gap-2">
                <button onClick={clearAll}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-gray-400 hover:text-white hover:border-white/20 transition-colors cursor-pointer">
                  Limpiar
                </button>
                <button onClick={() => setFilterPanelOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-blue-800 hover:bg-blue-700 text-sm text-white transition-colors cursor-pointer font-medium">
                  Ver {loading ? "..." : total.toLocaleString("es-CL")} pegas
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Resultados */}
      {loading ? (
        <ul className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <li key={i} className="bg-white/5 rounded-xl px-4 py-3.5 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-white/8 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-white/8 rounded-full w-2/5" />
                  <div className="h-2.5 bg-white/5 rounded-full w-1/3" />
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : jobs.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <p className="text-gray-400 text-sm">
            {search
              ? <>No encontramos pegas para <span className="text-white">"{search}"</span>{category ? <> en <span className="text-white">{category.label}</span></> : ""}.</>
              : "Sin pegas disponibles con estos filtros."}
          </p>
          {hasFilters && (
            <button onClick={clearAll} className="text-xs text-blue-600 hover:text-blue-400 transition-colors cursor-pointer underline-offset-2 hover:underline">
              Limpiar todos los filtros
            </button>
          )}
        </div>
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
                className="text-xs text-gray-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors px-3 py-2 border border-white/8 rounded-lg hover:border-white/20 cursor-pointer"
              >
                Anterior
              </button>
              <span className="text-xs text-gray-600 tabular-nums">
                {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} de {total.toLocaleString("es-CL")}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={(page + 1) * PAGE_SIZE >= total}
                className="text-xs text-gray-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors px-3 py-2 border border-white/8 rounded-lg hover:border-white/20 cursor-pointer"
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

function relativeDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 3600) return "hace menos de 1 hora";
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`;
  const days = Math.floor(diff / 86400);
  if (days === 1) return "hace 1 día";
  if (days < 7) return `hace ${days} días`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return "hace 1 semana";
  if (weeks < 5) return `hace ${weeks} semanas`;
  return `hace ${Math.floor(days / 30)} meses`;
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
          ? "border-white/25"
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
            {job.salary && (
              <span className="text-xs text-emerald-400/70">{job.salary}</span>
            )}
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
            <div className="mt-4 pt-4 border-t border-white/8 space-y-4">
              {/* Meta: fuente + fecha */}
              <div className="flex items-center gap-3 text-xs text-gray-600">
                <span>{SOURCE_LABEL[job.source] ?? job.source}</span>
                {relativeDate(job.posted_at ?? job.fetched_at) && (
                  <>
                    <span>·</span>
                    <span>{relativeDate(job.posted_at ?? job.fetched_at)}</span>
                  </>
                )}
                {job.salary && (
                  <>
                    <span>·</span>
                    <span className="text-emerald-400/80">{job.salary}</span>
                  </>
                )}
              </div>

              {/* Descripción completa */}
              {job.description && (
                <p className="text-sm text-gray-400 leading-relaxed whitespace-pre-line">
                  {job.description}
                </p>
              )}

              {/* Todos los tags */}
              {job.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {job.tags.map((t) => (
                    <span key={t} className="text-xs text-gray-600 bg-white/5 rounded-full px-2 py-0.5">
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
                className="inline-flex items-center gap-2 text-sm font-medium text-white bg-blue-800 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors"
              >
                Postular en {SOURCE_LABEL[job.source] ?? job.source}
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                </svg>
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}
