import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { API_BASE, scoreClass } from "@/lib/api";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Blog Feed — Search engineering writing" },
      { name: "description", content: "Search a curated index of engineering blog posts ranked by signal." },
    ],
  }),
  component: Index,
});

type Article = {
  url: string;
  title: string;
  blog_name: string;
  fetched_at: string;
  combined_score: number;
  source: string;
  keywords?: string;
};

function Index() {
  const [q, setQ] = useState("");
  const [minScore, setMinScore] = useState(false);
  const [source, setSource] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Article[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function search(e?: React.FormEvent) {
    e?.preventDefault();
    if (!q.trim()) return;
    setLoading(true); setError(null); setResults(null);
    let url = `${API_BASE}/search?q=${encodeURIComponent(q)}&limit=50`;
    if (minScore) url += "&min_score=0.5";
    if (source) url += `&source=${source}`;
    try {
      const resp = await fetch(url);
      const data = await resp.json();
      setResults(data.results || []);
    } catch (err) {
      setError("Error fetching results. Is the API running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-6">
      {/* Hero / front-page editorial */}
      <section className="py-16 md:py-24 rule-bottom">
        <div className="grid md:grid-cols-12 gap-8 items-end">
          <div className="md:col-span-8">
            <div className="text-xs uppercase tracking-[0.3em] text-accent mb-4">Issue №{new Date().getFullYear()}</div>
            <h1 className="font-serif text-5xl md:text-7xl leading-[0.95] text-ink">
              My heuristics "based" <em className="italic">engineering</em> blogs, that are worth a reading.
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-xl">
              A small, opinionated index of posts — pulled from curated blogs and
              surfaced from the noisier corners of the internet.
            </p>
          </div>
          {/* <div className="md:col-span-4 text-sm text-muted-foreground">
            <div className="rule-top pt-4">
              <div className="font-serif text-2xl text-foreground">In this issue</div>
              <ul className="mt-3 space-y-1">
                <li>— Distributed systems, in depth</li>
                <li>— Databases & query planners</li>
                <li>— Performance, latency, internals</li>
                <li>— Developer tooling & languages</li>
              </ul>
            </div>
          </div> */}
        </div>
      </section>

      {/* Search */}
      <section className="py-10 rule-bottom">
        <form onSubmit={search} className="grid md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-7">
            <label className="block text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">Search the archive</label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="kubernetes, postgres, distributed systems…"
              className="w-full bg-transparent border-0 border-b-2 border-foreground/80 focus:border-accent outline-none py-2 text-2xl font-serif placeholder:text-muted-foreground/60"
            />
          </div>
          <div className="md:col-span-3">
            <label className="block text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">Source</label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="w-full bg-card border border-border rounded px-3 py-2 text-sm"
            >
              <option value="">All sources</option>
              <option value="rss">Curated blogs</option>
              <option value="reddit">From Reddit</option>
            </select>
          </div>
          <div className="md:col-span-2 flex flex-col gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={minScore} onChange={(e) => setMinScore(e.target.checked)} />
              Score ≥ 0.5
            </label>
            <button type="submit" className="bg-primary text-primary-foreground px-4 py-2 text-sm uppercase tracking-wider hover:bg-accent transition-colors">
              {loading ? "Searching…" : "Search"}
            </button>
          </div>
        </form>
      </section>

      {/* Results */}
      <section className="py-12">
        {error && <div className="text-destructive text-sm">{error}</div>}
        {loading && <div className="text-muted-foreground italic">Setting type…</div>}
        {results && results.length === 0 && (
          <div className="text-muted-foreground italic font-serif text-xl">Nothing in the archive for that query.</div>
        )}
        {results && results.length > 0 && (
          <>
            <div className="flex items-baseline justify-between mb-8 rule-bottom pb-3">
              <h2 className="font-serif text-3xl">Dispatches</h2>
              <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{results.length} articles</span>
            </div>
            <div className="grid md:grid-cols-2 gap-x-10 gap-y-10">
              {results.map((a, i) => (
                <article key={a.url} className="group">
                  <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">
                    №{String(i + 1).padStart(2, "0")} · {a.source === "rss" ? "Curated" : "Reddit"}
                  </div>
                  <h3 className="font-serif text-2xl md:text-3xl leading-tight">
                    <a href={a.url} target="_blank" rel="noreferrer" className="hover:text-accent transition-colors">
                      {a.title}
                    </a>
                  </h3>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span className="italic">{a.blog_name}</span>
                    <span>·</span>
                    <span>{new Date(a.fetched_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
                    <span>·</span>
                    <span className={scoreClass(a.combined_score)}>signal {a.combined_score.toFixed(2)}</span>
                  </div>
                  {a.keywords && (
                    <div className="mt-2 text-xs text-muted-foreground/80 font-mono">{a.keywords}</div>
                  )}
                </article>
              ))}
            </div>
          </>
        )}
        {!results && !loading && (
          <div className="text-center py-16 text-muted-foreground font-serif italic text-xl">
            Type a topic above and hit search.
          </div>
        )}
      </section>
    </div>
  );
}
