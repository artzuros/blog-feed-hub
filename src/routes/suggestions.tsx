import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { API_BASE } from "@/lib/api";

export const Route = createFileRoute("/suggestions")({
  head: () => ({
    meta: [
      { title: "Suggestions — Blog Feed" },
      { name: "description", content: "Help curate the archive. Upvote promising blogs, downvote the rest." },
    ],
  }),
  component: SuggestionsPage,
});

type Suggestion = {
  url: string;
  title: string;
  domain: string;
  subreddit: string;
  reddit_score: number;
  heuristic_score: number;
  combined_score?: number;
  upvotes?: number;
  downvotes?: number;
  net_votes?: number;
};

function SuggestionsPage() {
  const [sortBy, setSortBy] = useState("discovered_at");
  const [list, setList] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [votingUrl, setVotingUrl] = useState<string | null>(null);

  async function load() {
    setLoading(true); setError(null);
    try {
      // Add sort parameter to backend call
      const resp = await fetch(`${API_BASE}/suggestions?limit=100&sort_by=${sortBy}`);
      const data = await resp.json();
      // Handle both array and object responses
      setList(Array.isArray(data) ? data : (data.suggestions || []));
    } catch {
      setError("Failed to load suggestions.");
    } finally { setLoading(false); }
  }

  async function vote(url: string, voteType: "up" | "down") {
    if (votingUrl === url) return; // Prevent double vote
    setVotingUrl(url);
    
    try {
      const encodedUrl = btoa(url);
      const resp = await fetch(`${API_BASE}/suggestions/${encodedUrl}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vote: voteType === "up" ? 1 : -1 }),
      });
      if (!resp.ok) {
        const err = await resp.json();
        alert(`Error: ${err.detail || "Vote failed"}`);
      }
      await load(); // Reload to get updated votes
    } catch {
      alert("Network error while voting");
    } finally {
      setVotingUrl(null);
    }
  }

  useEffect(() => { load(); }, [sortBy]);

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <div className="rule-bottom pb-6 mb-10">
        <div className="text-xs uppercase tracking-[0.3em] text-accent mb-2">Editor's desk</div>
        <h1 className="font-serif text-5xl md:text-6xl leading-tight">The submissions pile.</h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-2xl">
          Fresh candidates from the wild. Cast a vote — upvote a sharp engineering voice, downvote the noise.
        </p>
        <div className="mt-6 flex gap-4 items-center">
          <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Sort by</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-card border border-border rounded px-3 py-1 text-sm"
          >
            <option value="discovered_at">Newest first</option>
            <option value="net_votes">Highest net votes</option>
            <option value="reddit_score">Highest Reddit score</option>
          </select>
          <button onClick={load} className="ml-auto text-sm underline underline-offset-4 hover:text-accent">Refresh</button>
        </div>
      </div>

      {loading && <div className="text-muted-foreground italic">Loading the pile…</div>}
      {error && <div className="text-destructive">{error}</div>}
      {!loading && list.length === 0 && (
        <div className="text-muted-foreground font-serif italic text-xl">The pile is empty. Check back later.</div>
      )}

      <ol className="space-y-10">
        {list.map((s, i) => (
          <li key={s.url} className="grid grid-cols-[auto_1fr_auto] gap-6 rule-bottom pb-8">
            <div className="font-serif text-4xl text-muted-foreground/60 tabular-nums leading-none pt-1">
              {String(i + 1).padStart(2, "0")}
            </div>
            <div>
              <h2 className="font-serif text-2xl leading-tight">
                <a href={s.url} target="_blank" rel="noreferrer" className="hover:text-accent">{s.title}</a>
              </h2>
              <div className="mt-2 text-sm text-muted-foreground">
                <span className="italic">{s.domain}</span> · r/{s.subreddit} · 👍 {s.reddit_score}
              </div>
              <div className="mt-1 text-xs text-muted-foreground/80">
                heuristic {s.heuristic_score.toFixed(2)}
                {s.combined_score != null && ` · combined ${s.combined_score.toFixed(2)}`}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="flex gap-2">
                <button
                  onClick={() => vote(s.url, "up")}
                  disabled={votingUrl === s.url}
                  className="border border-border hover:border-accent hover:text-accent px-3 py-1 rounded text-sm transition-colors disabled:opacity-50"
                >
                  ▲ {s.upvotes || 0}
                </button>
                <button
                  onClick={() => vote(s.url, "down")}
                  disabled={votingUrl === s.url}
                  className="border border-border hover:border-destructive hover:text-destructive px-3 py-1 rounded text-sm transition-colors disabled:opacity-50"
                >
                  ▼ {s.downvotes || 0}
                </button>
              </div>
              <div className="text-xs text-muted-foreground tabular-nums">net {s.net_votes || 0}</div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}