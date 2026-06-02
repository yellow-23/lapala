import { createClient } from "@supabase/supabase-js";

// Lazy singleton — avoids crash during Astro static pre-render when env vars are absent
let _client: ReturnType<typeof createClient> | null = null;

export function getSupabase() {
  if (!_client) {
    _client = createClient(
      import.meta.env.PUBLIC_SUPABASE_URL as string,
      import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string,
    );
  }
  return _client;
}

export interface Job {
  id: string;
  source: string;
  title: string;
  company: string;
  location: string | null;
  remote: boolean;
  url: string;
  description: string | null;
  tags: string[];
  salary: string | null;
  posted_at: string | null;
  fetched_at: string;
}
