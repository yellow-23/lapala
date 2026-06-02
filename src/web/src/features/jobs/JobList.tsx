import { useEffect, useState } from "react";
import { getSupabase, type Job } from "../../lib/supabase";
import { JobCard } from "./JobCard";
import { JobFilters } from "./JobFilters";

export default function JobList() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [search, setSearch] = useState("");
  const [remote, setRemote] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const supabase = getSupabase();
      let q = supabase
        .from("jobs")
        .select("id,source,title,company,location,remote,url,tags,salary,posted_at,fetched_at")
        .order("fetched_at", { ascending: false })
        .limit(100);

      if (remote) q = q.eq("remote", true);
      if (search.length >= 2) q = q.ilike("title", `%${search}%`);

      const { data, error } = await q;
      if (!error && data) setJobs(data as Job[]);
      setLoading(false);
    }
    load();
  }, [search, remote]);

  return (
    <div>
      <JobFilters search={search} remote={remote} onSearch={setSearch} onRemote={setRemote} />

      {loading && (
        <p className="text-neutral-400 text-sm text-center py-16">Cargando pegas...</p>
      )}
      {!loading && jobs.length === 0 && (
        <p className="text-neutral-400 text-sm text-center py-16">
          Sin resultados. Agrega <code>PUBLIC_SUPABASE_URL</code> en <code>.env</code>.
        </p>
      )}

      <ul className="space-y-3">
        {jobs.map((job) => (
          <JobCard key={job.id} job={job} />
        ))}
      </ul>
    </div>
  );
}
