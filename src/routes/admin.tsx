import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { API_BASE } from "@/lib/api";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Blog Scout" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

type Suggestion = {
  url: string;
  title: string;
  domain: string;
  heuristic_score: number;
  combined_score?: number;
};

function AdminPage() {
  const [apiKey, setApiKey] = useState("");
  const [authed, setAuthed] = useState(false);
  const [pending, setPending] = useState<Suggestion[]>([]);
  const [status, setStatus] = useState<{ msg: string; ok: boolean } | null>(null);
  const [name, setName] = useState(""); const [url, setUrl] = useState(""); const [rss, setRss] = useState("");

  useEffect(() => {
    const stored = typeof window !== "undefined" ? sessionStorage.getItem("adminApiKey") || "" : "";
    if (stored) { setApiKey(stored); setAuthed(true); }
  }, []);

  useEffect(() => { if (authed) loadPending(); /* eslint-disable-next-line */ }, [authed]);

  function headers() {
    return { "Content-Type": "application/json", "X-API-Key": apiKey };
  }

  function flash(msg: string, ok: boolean) {
    setStatus({ msg, ok });
    setTimeout(() => setStatus(null), 5000);
  }

  async function loadPending() {
    try {
      const resp = await fetch(`${API_BASE}/suggestions?accepted=false&status=llm`);
      const data = await resp.json();
      setPending(data);
    } catch { flash("Error loading suggestions", false); }
  }

  async function accept(sugUrl: string) {
    try {
      const resp = await fetch(`${API_BASE}/suggestions/accept?${new URLSearchParams({ suggestion_url: sugUrl })}`, {
        method: "POST", headers: headers(),
      });
      const data = await resp.json();
      flash(resp.ok ? `✅ ${data.message}` : `❌ ${data.detail || "Error"}`, resp.ok);
      if (resp.ok) setTimeout(loadPending, 800);
    } catch { flash("Network error", false); }
  }

  async function addBlog() {
    if (!name || !url) return flash("Name and URL required", false);
    try {
      const resp = await fetch(`${API_BASE}/blogs`, {
        method: "POST", headers: headers(),
        body: JSON.stringify({ name, url, rss: rss || null }),
      });
      const data = await resp.json();
      if (resp.ok) {
        flash(`✅ ${data.message}`, true);
        setName(""); setUrl(""); setRss("");
      } else flash(`❌ ${data.detail || "Error"}`, false);
    } catch { flash("Network error", false); }
  }

  async function triggerScan() {
    flash("⏳ Running scan (may take minutes)…", true);
    try {
      const resp = await fetch(`${API_BASE}/blogs/refresh`, { method: "POST", headers: headers() });
      const data = await resp.json();
      flash(`✅ ${data.message || "Done"}`, true);
    } catch { flash("Scan failed", false); }
  }

  function saveKey() {
    const k = apiKey.trim();
    if (!k) return alert("Enter a valid API key");
    sessionStorage.setItem("adminApiKey", k);
    setAuthed(true);
    flash("Key saved (session only)", true);
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <div className="rule-bottom pb-6 mb-10">
        <div className="text-xs uppercase tracking-[0.3em] text-accent mb-2">Newsroom</div>
        <h1 className="font-serif text-5xl">Editorial controls.</h1>
        <p className="mt-3 text-muted-foreground">Accept submissions, add curated blogs, and trigger a fresh scan.</p>
      </div>

      <div className="mb-10">
        <label className="block text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">API Key</label>
        <div className="flex gap-2 max-w-xl">
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Enter your admin API key"
            className="flex-1 bg-card border border-border rounded px-3 py-2 text-sm"
          />
          <button onClick={saveKey} className="bg-primary text-primary-foreground px-4 py-2 text-sm uppercase tracking-wider">Save</button>
        </div>
      </div>

      {authed && (
        <>
          <div className="grid md:grid-cols-2 gap-10">
            <section>
              <h2 className="font-serif text-3xl rule-bottom pb-2 mb-4">Pending acceptance</h2>
              {pending.length === 0 ? (
                <div className="text-muted-foreground italic">No LLM-reviewed suggestions pending.</div>
              ) : (
                <ul className="space-y-4">
                  {pending.map((s) => (
                    <li key={s.url} className="rule-bottom pb-3">
                      <a href={s.url} target="_blank" rel="noreferrer" className="font-serif text-lg hover:text-accent">
                        {s.title.substring(0, 100)}
                      </a>
                      <div className="text-xs text-muted-foreground mt-1">
                        {s.domain} · score {(s.combined_score ?? s.heuristic_score).toFixed(2)}
                      </div>
                      <button
                        onClick={() => accept(s.url)}
                        className="mt-2 text-xs uppercase tracking-wider border border-foreground/40 hover:border-accent hover:text-accent px-2 py-1 rounded"
                      >
                        Accept & add to blogs
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h2 className="font-serif text-3xl rule-bottom pb-2 mb-4">Add a blog</h2>
              <div className="space-y-3">
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="w-full bg-card border border-border rounded px-3 py-2 text-sm" />
                <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="URL (https://...)" className="w-full bg-card border border-border rounded px-3 py-2 text-sm" />
                <input value={rss} onChange={(e) => setRss(e.target.value)} placeholder="RSS URL (optional)" className="w-full bg-card border border-border rounded px-3 py-2 text-sm" />
                <button onClick={addBlog} className="bg-primary text-primary-foreground px-4 py-2 text-sm uppercase tracking-wider">Add blog</button>
              </div>
            </section>
          </div>

          <div className="mt-12 rule-top pt-6 flex items-center gap-4">
            <button onClick={triggerScan} className="bg-accent text-accent-foreground px-5 py-2 text-sm uppercase tracking-wider">
              Trigger manual scan
            </button>
            {status && (
              <span className={status.ok ? "text-emerald-700 dark:text-emerald-400 text-sm" : "text-destructive text-sm"}>
                {status.msg}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
