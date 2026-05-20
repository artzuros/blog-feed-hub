import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { API_BASE } from "@/lib/api";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Blog Feed" },
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
  llm_score?: number;
  combined_score?: number;
  reviewed?: string;
  accepted?: boolean;
  reddit_score?: number;
  subreddit?: string;
};

type Article = {
  id: number;
  title: string;
  url: string;
  domain: string;
  published_at?: string;
  llm_review_status?: string;
  llm_score?: number;
};

function AdminPage() {
  const [apiKey, setApiKey] = useState("");
  const [authed, setAuthed] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [pending, setPending] = useState<Suggestion[]>([]);
  const [recentArticles, setRecentArticles] = useState<Article[]>([]);
  const [status, setStatus] = useState<{ msg: string; ok: boolean } | null>(null);
  const [name, setName] = useState(""); 
  const [url, setUrl] = useState(""); 
  const [rss, setRss] = useState("");
  const [processingQueue, setProcessingQueue] = useState(false);
  const [processingArticleId, setProcessingArticleId] = useState<number | null>(null);
  const [acceptingUrl, setAcceptingUrl] = useState<string | null>(null);
  const [llmReviewingUrl, setLlmReviewingUrl] = useState<string | null>(null);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? sessionStorage.getItem("adminApiKey") || "" : "";
    if (stored) { 
      setApiKey(stored); 
      validateKey(stored);
    }
  }, []);

  useEffect(() => { 
    if (authed) {
      loadPending();
      loadRecentArticles();
    }
  }, [authed]);

  async function validateKey(key: string) {
    setIsValidating(true);
    try {
      const resp = await fetch(`${API_BASE}/admin/verify`, {
        headers: { "X-API-Key": key }
      });
      if (resp.ok) {
        setAuthed(true);
        sessionStorage.setItem("adminApiKey", key);
        flash("Authenticated", true);
      } else {
        setAuthed(false);
        sessionStorage.removeItem("adminApiKey");
        flash("Invalid API key", false);
      }
    } catch {
      setAuthed(false);
      flash("Connection error", false);
    } finally {
      setIsValidating(false);
    }
  }

  function headers() {
    return { "Content-Type": "application/json", "X-API-Key": apiKey };
  }

  function flash(msg: string, ok: boolean) {
    setStatus({ msg, ok });
    setTimeout(() => setStatus(null), 5000);
  }

  async function loadPending() {
    try {
      const resp = await fetch(`${API_BASE}/suggestions?limit=100`, { 
        headers: headers() 
      });
      const data = await resp.json();
      // Show all non-accepted suggestions
      const pendingSuggestions = Array.isArray(data) ? data.filter(
        (s: Suggestion) => !s.accepted
      ) : [];
      setPending(pendingSuggestions);
    } catch { 
      flash("Error loading suggestions", false); 
    }
  }

  async function loadRecentArticles() {
    try {
      const resp = await fetch(`${API_BASE}/articles?limit=50`, { 
        headers: headers() 
      });
      const data = await resp.json();
      const articles = data.articles || (Array.isArray(data) ? data : []);
      setRecentArticles(articles);
    } catch { 
      flash("Error loading articles", false); 
    }
  }

  async function triggerSuggestionLLM(sugUrl: string) {
    if (llmReviewingUrl === sugUrl) return;
    setLlmReviewingUrl(sugUrl);
    flash("⏳ Running LLM review on article... (may take 30-60 seconds)", true);
    
    try {
      const encodedUrl = btoa(sugUrl);
      const resp = await fetch(`${API_BASE}/suggestions/${encodedUrl}/llm-review`, {
        method: "POST",
        headers: headers(),
      });
      const data = await resp.json();
      flash(resp.ok ? `✅ ${data.message}` : `❌ ${data.detail || "Error"}`, resp.ok);
      if (resp.ok) {
        // Wait 5 seconds then refresh to show LLM results
        setTimeout(() => {
          loadPending();
          flash("LLM review complete! You can now accept the article.", true);
        }, 5000);
      }
    } catch {
      flash("Network error", false);
    } finally {
      setLlmReviewingUrl(null);
    }
  }

  async function accept(sugUrl: string) {
    if (acceptingUrl === sugUrl) return;
    setAcceptingUrl(sugUrl);
    
    try {
      const encodedUrl = btoa(sugUrl);
      const resp = await fetch(`${API_BASE}/suggestions/accept?suggestion_url=${encodedUrl}`, {
        method: "POST", 
        headers: headers(),
      });
      const data = await resp.json();
      flash(resp.ok ? `✅ ${data.message}` : `❌ ${data.detail || "Error"}`, resp.ok);
      if (resp.ok) {
        setTimeout(() => {
          loadPending();
          loadRecentArticles();
        }, 1000);
      }
    } catch { 
      flash("Network error", false); 
    } finally {
      setAcceptingUrl(null);
    }
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
        setTimeout(loadRecentArticles, 1000);
      } else flash(`❌ ${data.detail || "Error"}`, false);
    } catch { flash("Network error", false); }
  }

  async function triggerScan() {
    flash("⏳ Running scan (may take minutes)…", true);
    try {
      const resp = await fetch(`${API_BASE}/blogs/refresh`, { method: "POST", headers: headers() });
      const data = await resp.json();
      flash(`✅ ${data.message || "Done"}`, true);
      setTimeout(() => {
        loadRecentArticles();
        loadPending();
      }, 2000);
    } catch { flash("Scan failed", false); }
  }

  async function triggerLLMQueue() {
    if (processingQueue) return;
    setProcessingQueue(true);
    flash("⏳ Queueing articles for LLM review…", true);
    try {
      const resp = await fetch(`${API_BASE}/admin/llm/review-queue`, { 
        method: "POST", 
        headers: headers() 
      });
      const data = await resp.json();
      flash(`✅ ${data.message || "Queue processed"}`, true);
      setTimeout(() => {
        loadRecentArticles();
        loadPending();
      }, 2000);
    } catch { flash("Queue review failed", false); }
    finally { setProcessingQueue(false); }
  }

  async function triggerSingleArticleLLM(articleId: number) {
    setProcessingArticleId(articleId);
    flash(`⏳ Triggering LLM review for article ${articleId}…`, true);
    try {
      const resp = await fetch(`${API_BASE}/admin/llm/review-article/${articleId}`, { 
        method: "POST", 
        headers: headers() 
      });
      const data = await resp.json();
      flash(`✅ ${data.message || "Review completed"}`, true);
      setTimeout(() => {
        loadRecentArticles();
        loadPending();
      }, 1000);
    } catch { flash("Article review failed", false); }
    finally { setProcessingArticleId(null); }
  }

  function getStatusBadge(status?: string) {
    const styles: Record<string, string> = {
      pending: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400",
      processing: "bg-blue-500/20 text-blue-700 dark:text-blue-400",
      completed: "bg-green-500/20 text-green-700 dark:text-green-400",
      failed: "bg-red-500/20 text-red-700 dark:text-red-400",
    };
    const defaultStyle = "bg-gray-500/20 text-gray-700 dark:text-gray-400";
    const style = status ? (styles[status] || defaultStyle) : defaultStyle;
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full ${style}`}>
        {status || "pending"}
      </span>
    );
  }

  // Not authenticated — show only the key entry form
  if (!authed) {
    return (
      <div className="mx-auto max-w-md px-6 py-20">
        <div className="rule-bottom pb-6 mb-10 text-center">
          <div className="text-xs uppercase tracking-[0.3em] text-accent mb-2">Restricted Access</div>
          <h1 className="font-serif text-4xl">Admin verification</h1>
          <p className="mt-3 text-muted-foreground text-sm">Enter your API key to access editorial controls.</p>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && validateKey(apiKey)}
              placeholder="Enter your admin API key"
              className="w-full bg-card border border-border rounded px-4 py-3 text-sm"
              autoFocus
            />
          </div>
          
          <button 
            onClick={() => validateKey(apiKey)} 
            disabled={isValidating}
            className="w-full bg-primary text-primary-foreground px-4 py-3 text-sm uppercase tracking-wider rounded disabled:opacity-50"
          >
            {isValidating ? "Verifying..." : "Verify Access"}
          </button>

          {status && !status.ok && (
            <div className="text-destructive text-sm text-center mt-4">
              {status.msg}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Authenticated — show full admin interface
  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <div className="rule-bottom pb-6 mb-10">
        <div className="flex justify-between items-end">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-accent mb-2">Newsroom</div>
            <h1 className="font-serif text-5xl">Editorial controls.</h1>
            <p className="mt-3 text-muted-foreground">Review Reddit suggestions, manage LLM reviews, and curate articles.</p>
          </div>
          <div className="flex gap-4 items-center">
            <Link 
              to="/blogs"
              className="text-sm underline underline-offset-4 hover:text-accent transition-colors"
            >
              Manage Blogs
            </Link>
            <button 
              onClick={() => {
                sessionStorage.removeItem("adminApiKey");
                setAuthed(false);
                setApiKey("");
                flash("Logged out", true);
              }}
              className="text-xs text-muted-foreground hover:text-destructive transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
      
      {/* Reddit Suggestions Section */}
      <div className="mb-12">
        <h2 className="font-serif text-3xl mb-4">Reddit Suggestions</h2>
        <p className="text-muted-foreground text-sm mb-4">
          Discovered from Reddit. Run LLM review to get AI scoring, then accept high-quality articles.
        </p>
        
        {pending.length === 0 ? (
          <div className="text-muted-foreground italic">No pending suggestions. Run Reddit discovery to find articles.</div>
        ) : (
          <div className="grid gap-4">
            {pending.map((s) => (
              <div key={s.url} className="border border-border rounded-lg p-4 bg-card">
                <a href={s.url} target="_blank" rel="noreferrer" className="font-serif text-lg hover:text-accent">
                  {s.title}
                </a>
                <div className="text-xs text-muted-foreground mt-1">
                  {s.domain} · r/{s.subreddit} · 👍 {s.reddit_score}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Heuristic score: {s.heuristic_score.toFixed(2)}
                  {s.llm_score && ` · LLM score: ${s.llm_score.toFixed(2)}`}
                  {s.combined_score && ` · Combined: ${s.combined_score.toFixed(2)}`}
                </div>
                <div className="mt-3 flex gap-2">
                  {!s.llm_score && s.reviewed !== 'processing' && (
                    <button
                      onClick={() => triggerSuggestionLLM(s.url)}
                      disabled={llmReviewingUrl === s.url}
                      className="text-xs px-3 py-1 rounded border border-foreground/30 hover:border-accent hover:text-accent transition-colors disabled:opacity-50"
                    >
                      {llmReviewingUrl === s.url ? "Reviewing..." : "🤖 LLM Review"}
                    </button>
                  )}
                  {s.llm_score && (
                    <button
                      onClick={() => accept(s.url)}
                      disabled={acceptingUrl === s.url}
                      className="text-xs px-3 py-1 rounded bg-green-600/20 text-green-700 hover:bg-green-600/30 transition-colors disabled:opacity-50"
                    >
                      {acceptingUrl === s.url ? "Accepting..." : "✅ Accept Article"}
                    </button>
                  )}
                  {s.reviewed === 'failed' && (
                    <span className="text-xs text-red-500">LLM review failed - {s.llm_error}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* LLM Review Section - Shows articles that need review */}
      <div className="mb-12 rule-bottom pb-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="font-serif text-3xl">LLM Review Queue</h2>
            <p className="text-muted-foreground text-sm mt-1">
              Articles from curated blogs without LLM scores
            </p>
          </div>
          <button 
            onClick={triggerLLMQueue}
            disabled={processingQueue}
            className="bg-accent text-accent-foreground px-5 py-2 text-sm uppercase tracking-wider rounded disabled:opacity-50 flex items-center gap-2"
          >
            {processingQueue ? (
              <>
                <span className="animate-spin">⏳</span>
                Processing...
              </>
            ) : (
              "Review All Pending"
            )}
          </button>
        </div>

        {/* Recent Articles Table */}
        <div>
          <h3 className="font-serif text-xl mb-4">Recent Articles (Curated Blogs)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border">
                <tr className="text-left text-muted-foreground">
                  <th className="pb-2 font-normal">Title</th>
                  <th className="pb-2 font-normal">Domain</th>
                  <th className="pb-2 font-normal">LLM Status</th>
                  <th className="pb-2 font-normal">Score</th>
                  <th className="pb-2 font-normal">Action</th>
                </tr>
              </thead>
              <tbody>
                {recentArticles && recentArticles.length > 0 ? (
                  recentArticles.slice(0, 20).map((article) => (
                    <tr key={article.id} className="border-b border-border/50">
                      <td className="py-3 pr-4">
                        <a 
                          href={article.url} 
                          target="_blank" 
                          rel="noreferrer"
                          className="hover:text-accent transition-colors line-clamp-1"
                        >
                          {article.title}
                        </a>
                       </td>
                      <td className="py-3 pr-4 text-muted-foreground text-xs">
                        {article.domain}
                       </td>
                      <td className="py-3 pr-4">
                        {getStatusBadge(article.llm_review_status)}
                       </td>
                      <td className="py-3 pr-4 font-mono text-xs">
                        {article.llm_score ? article.llm_score.toFixed(2) : "-"}
                       </td>
                      <td className="py-3">
                        <button
                          onClick={() => triggerSingleArticleLLM(article.id)}
                          disabled={processingArticleId === article.id || article.llm_score !== undefined}
                          className="text-xs px-3 py-1 rounded border border-foreground/30 hover:border-accent hover:text-accent transition-colors disabled:opacity-50"
                          title={article.llm_score !== undefined ? "Already reviewed" : "Trigger LLM review"}
                        >
                          {processingArticleId === article.id ? (
                            <span className="animate-spin inline-block">⏳</span>
                          ) : (
                            article.llm_score !== undefined ? "Reviewed" : "Review"
                          )}
                        </button>
                       </td>
                     </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="text-center text-muted-foreground py-8">
                      No articles found. Run a scan to populate articles.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-10">
        <section>
          <h2 className="font-serif text-3xl rule-bottom pb-2 mb-4">Add a Curated Blog</h2>
          <div className="space-y-3">
            <input 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              placeholder="Name" 
              className="w-full bg-card border border-border rounded px-3 py-2 text-sm" 
            />
            <input 
              value={url} 
              onChange={(e) => setUrl(e.target.value)} 
              placeholder="URL (https://...)" 
              className="w-full bg-card border border-border rounded px-3 py-2 text-sm" 
            />
            <input 
              value={rss} 
              onChange={(e) => setRss(e.target.value)} 
              placeholder="RSS URL (optional)" 
              className="w-full bg-card border border-border rounded px-3 py-2 text-sm" 
            />
            <button 
              onClick={addBlog} 
              className="bg-primary text-primary-foreground px-4 py-2 text-sm uppercase tracking-wider rounded"
            >
              Add Blog
            </button>
          </div>

          <div className="mt-8 rule-top pt-6">
            <button 
              onClick={triggerScan} 
              className="w-full bg-secondary text-secondary-foreground px-5 py-2 text-sm uppercase tracking-wider rounded"
            >
              Trigger Manual Feed Scan
            </button>
          </div>
        </section>
      </div>

      {status && (
        <div className={`mt-8 p-3 rounded text-sm text-center ${
          status.ok ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-destructive/10 text-destructive"
        }`}>
          {status.msg}
        </div>
      )}
    </div>
  );
}