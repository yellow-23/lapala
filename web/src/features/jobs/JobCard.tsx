import type { Job } from "../../lib/supabase";

const SOURCE_LABEL: Record<string, string> = {
  getonbrd: "Get on Board",
  chiletrabajos: "ChileTrabajos",
};

export function JobCard({ job }: { job: Job }) {
  return (
    <li className="bg-white border border-neutral-200 rounded-xl p-5 hover:border-neutral-400 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-neutral-900 hover:underline line-clamp-1"
          >
            {job.title}
          </a>
          <p className="text-sm text-neutral-500 mt-0.5">
            {job.company}
            {job.location ? ` · ${job.location}` : ""}
          </p>
        </div>

        <div className="flex flex-col items-end gap-1 shrink-0">
          {job.remote && (
            <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-2 py-0.5">
              Remoto
            </span>
          )}
          <span className="text-xs text-neutral-400">
            {SOURCE_LABEL[job.source] ?? job.source}
          </span>
        </div>
      </div>

      {job.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {job.tags.slice(0, 6).map((t) => (
            <span
              key={t}
              className="text-xs bg-neutral-100 text-neutral-600 rounded-full px-2 py-0.5"
            >
              {t}
            </span>
          ))}
        </div>
      )}

      {job.salary && (
        <p className="text-xs text-neutral-500 mt-2">💰 {job.salary}</p>
      )}
    </li>
  );
}
