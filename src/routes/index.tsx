import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
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
  semantic_relevance?: number; // For semantic search results
};

function Index() {
  const [q, setQ] = useState("");
  const [minScore, setMinScore] = useState(false);
  const [source, setSource] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Article[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchType, setSearchType] = useState<"keyword" | "semantic">("keyword");

  // Keyboard shortcut for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        const input = document.querySelector('input[type="text"]') as HTMLInputElement;
        input?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  async function search(e?: React.FormEvent) {
    e?.preventDefault();
    if (!q.trim()) return;
    
    setLoading(true);
    setError(null);
    setResults(null);
    
    // Build URL based on search type
    let url = `${API_BASE}/${searchType === "semantic" ? "semantic-search" : "search"}?q=${encodeURIComponent(q)}&limit=50`;
    
    if (minScore) url += "&min_score=0.5";
    if (source) url += `&source=${source}`;
    
    try {
      const resp = await fetch(url);
      
      if (!resp.ok) {
        if (resp.status === 429) {
          setError("Rate limit exceeded. Please wait a moment.");
        } else if (resp.status === 500) {
          setError("Server error. Please try again later.");
        } else {
          setError(`Error ${resp.status}: Failed to fetch results`);
        }
        return;
      }
      
      const data = await resp.json();
      setResults(data.articles || []);
    } catch (err) {
      console.error("Search error:", err);
      setError("Network error. Is the API running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-6">
      {/* Hero section */}
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
        </div>
      </section>

      {/* Search */}
      <section className="py-10 rule-bottom">
        <form onSubmit={search} className="space-y-6">
          {/* Search Type Toggle */}
          <div className="flex gap-6 items-center justify-end">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input 
                type="radio" 
                name="searchType"
                value="keyword" 
                checked={searchType === "keyword"}
                onChange={() => setSearchType("keyword")}
                className="cursor-pointer"
              />
              <span className={searchType === "keyword" ? "text-accent font-medium" : "text-muted-foreground"}>
                Keyword Search
              </span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input 
                type="radio" 
                name="searchType"
                value="semantic" 
                checked={searchType === "semantic"}
                onChange={() => setSearchType("semantic")}
                className="cursor-pointer"
              />
              <span className={searchType === "semantic" ? "text-accent font-medium" : "text-muted-foreground"}>
                Semantic Search
              </span>
            </label>
          </div>

          <div className="grid md:grid-cols-12 gap-4 items-end">
            <div className="md:col-span-7">
              <label className="block text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">
                Search the archive <kbd className="ml-2 px-1.5 py-0.5 text-xs bg-muted rounded">⌘K</kbd>
              </label>
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
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={minScore} 
                  onChange={(e) => setMinScore(e.target.checked)} 
                  className="cursor-pointer"
                />
                <span>Score ≥ 0.5</span>
              </label>
              <button 
                type="submit" 
                disabled={loading || !q.trim()}
                className="bg-primary text-primary-foreground px-4 py-2 text-sm uppercase tracking-wider hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Searching…" : "Search"}
              </button>
            </div>
          </div>
        </form>
      </section>

      {/* Results */}
      <section className="py-12">
        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-destructive text-sm">
            {error}
          </div>
        )}
        
        {loading && (
          <div className="text-center py-16">
            <div className="text-muted-foreground italic font-serif text-xl animate-pulse">
              {searchType === "semantic" ? "Understanding your query..." : "Setting type…"}
            </div>
          </div>
        )}
        
        {results && results.length === 0 && !loading && (
          <div className="text-center py-16">
            <div className="text-muted-foreground italic font-serif text-xl mb-4">
              Nothing in the archive for "{q}".
            </div>
            <div className="text-sm text-muted-foreground">
              Try: distributed systems, kubernetes, postgres, rust, databases, performance
            </div>
          </div>
        )}
        
        {results && results.length > 0 && (
          <>
            <div className="flex items-baseline justify-between mb-8 rule-bottom pb-3">
              <div>
                <h2 className="font-serif text-3xl">Dispatches</h2>
                {searchType === "semantic" && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Results ranked by semantic relevance to your query
                  </p>
                )}
              </div>
              <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                {results.length} article{results.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="grid md:grid-cols-2 gap-x-10 gap-y-10">
              {results.map((a, i) => (
                <article key={a.url} className="group">
                  <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">
                    №{String(i + 1).padStart(2, "0")} · {a.source === "rss" ? "Curated" : "Reddit"}
                    {a.semantic_relevance && (
                      <span className="ml-2 text-accent">
                        relevance: {Math.round(a.semantic_relevance * 100)}%
                      </span>
                    )}
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
                    <div className="mt-2 text-xs text-muted-foreground/80 font-mono">
                      {a.keywords}
                    </div>
                  )}
                </article>
              ))}
            </div>
          </>
        )}
        
        {!results && !loading && (
          <div className="text-center py-16 text-muted-foreground font-serif italic text-xl">
            Type a topic above and hit search. <span className="text-sm align-middle">⌘K</span>
          </div>
        )}
      </section>
    </div>
  );
}