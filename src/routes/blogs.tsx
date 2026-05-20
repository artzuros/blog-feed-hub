import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { API_BASE } from "@/lib/api";

export const Route = createFileRoute("/blogs")({
  component: BlogsPage,
});

type Blog = {
  name: string;
  url: string;
  rss: string | null;
  article_count: number;
  last_fetched: string | null;
};

type Article = {
  id: number;
  url: string;
  title: string;
  heuristic_score: number;
  llm_score: number | null;
  combined_score: number;
  fetched_at: string;
};

type RedditSuggestion = {
  url: string;
  domain: string;
  title: string;
  subreddit: string;
  reddit_score: number;
  heuristic_score: number;
  llm_score?: number;
  combined_score?: number;
  reviewed?: string;
  accepted?: boolean;
  llm_error?: string;
};

function BlogsPage() {
  const [apiKey, setApiKey] = useState("");
  const [authed, setAuthed] = useState(false);
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [selectedBlog, setSelectedBlog] = useState<Blog | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<{ msg: string; ok: boolean } | null>(null);
  
  // Reddit discovery state
  const [redditSuggestions, setRedditSuggestions] = useState<RedditSuggestion[]>([]);
  const [discoveryRunning, setDiscoveryRunning] = useState(false);
  const [showRedditSection, setShowRedditSection] = useState(true);
  const [llmReviewingUrl, setLlmReviewingUrl] = useState<string | null>(null);
  const [acceptingUrl, setAcceptingUrl] = useState<string | null>(null);
  const [rejectingUrl, setRejectingUrl] = useState<string | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem("adminApiKey");
    
    if (stored) {
      setApiKey(stored);
      verifyAndFetch(stored);
    } else {
      setError("Admin access required");
      setTimeout(() => {
        window.location.href = "/admin";
      }, 2000);
    }
  }, []);

  function flash(msg: string, ok: boolean) {
    setStatus({ msg, ok });
    setTimeout(() => setStatus(null), 5000);
  }

  async function verifyAndFetch(key: string) {
    try {
      const verifyResp = await fetch(`${API_BASE}/admin/verify`, {
        headers: { "X-API-Key": key },
      });
      
      if (!verifyResp.ok) {
        throw new Error("Invalid API key");
      }
      
      setAuthed(true);
      await Promise.all([
        fetchBlogs(key),
        fetchRedditSuggestions(key)
      ]);
    } catch (err) {
      console.error("Auth error:", err);
      setError("Authentication failed");
      setTimeout(() => {
        window.location.href = "/admin";
      }, 2000);
    }
  }

  async function fetchBlogs(key: string) {
    setLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/blogs`, {
        headers: { "X-API-Key": key },
      });
      
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      
      const data = await resp.json();
      setBlogs(data);
    } catch (err) {
      console.error("Error fetching blogs:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch blogs");
    } finally {
      setLoading(false);
    }
  }

  async function fetchRedditSuggestions(key: string) {
    try {
      const resp = await fetch(`${API_BASE}/reddit/suggestions`, {
        headers: { "X-API-Key": key },
      });
      
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      
      const data = await resp.json();
      // Filter out accepted suggestions
      const pending = data.filter((s: RedditSuggestion) => !s.accepted);
      setRedditSuggestions(pending);
    } catch (err) {
      console.error("Error fetching Reddit suggestions:", err);
    }
  }

  async function deleteBlog(name: string) {
    if (!confirm(`Delete blog "${name}"? This will NOT delete articles from the database.`)) return;
    
    try {
      const resp = await fetch(`${API_BASE}/blogs/${encodeURIComponent(name)}`, {
        method: "DELETE",
        headers: { "X-API-Key": apiKey },
      });
      
      if (resp.ok) {
        flash(`Deleted ${name} from blog list`, true);
        await fetchBlogs(apiKey);
      } else {
        flash("Delete failed", false);
      }
    } catch (err) {
      console.error("Delete error:", err);
      flash("Network error", false);
    }
  }

  async function refreshBlog(name: string) {
    flash(`Refreshing ${name}...`, true);
    try {
      const resp = await fetch(`${API_BASE}/blogs/${encodeURIComponent(name)}/refresh`, {
        method: "POST",
        headers: { "X-API-Key": apiKey },
      });
      
      if (resp.ok) {
        flash(`Refresh queued for ${name}. New articles will appear shortly.`, true);
        setTimeout(() => fetchBlogs(apiKey), 5000);
      } else {
        flash("Refresh failed", false);
      }
    } catch (err) {
      console.error("Refresh error:", err);
      flash("Network error", false);
    }
  }

  async function viewArticles(blog: Blog) {
    setSelectedBlog(blog);
    try {
      const resp = await fetch(`${API_BASE}/blogs/${encodeURIComponent(blog.name)}/articles?limit=50`, {
        headers: { "X-API-Key": apiKey },
      });
      
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      
      const data = await resp.json();
      setArticles(data);
    } catch (err) {
      console.error("Error fetching articles:", err);
      flash("Failed to load articles", false);
    }
  }

  async function runRedditDiscovery() {
    setDiscoveryRunning(true);
    flash("Running Reddit discovery (may take 2-3 minutes)...", true);
    try {
      const resp = await fetch(`${API_BASE}/reddit/discover`, {
        method: "POST",
        headers: { "X-API-Key": apiKey },
      });
      
      const data = await resp.json();
      flash(data.message || "Discovery completed", true);
      
      setTimeout(async () => {
        await fetchRedditSuggestions(apiKey);
      }, 2000);
    } catch (err) {
      console.error("Discovery error:", err);
      flash("Discovery failed", false);
    } finally {
      setDiscoveryRunning(false);
    }
  }

  async function triggerSuggestionLLM(suggestion: RedditSuggestion) {
    if (llmReviewingUrl === suggestion.url) return;
    setLlmReviewingUrl(suggestion.url);
    flash(`⏳ Running LLM review on "${suggestion.title.substring(0, 50)}..." (may take 30-60 seconds)`, true);
    
    try {
      const encodedUrl = btoa(suggestion.url);
      const resp = await fetch(`${API_BASE}/suggestions/${encodedUrl}/llm-review`, {
        method: "POST",
        headers: { "X-API-Key": apiKey },
      });
      const data = await resp.json();
      
      if (resp.ok) {
        flash(`✅ LLM review started for ${suggestion.domain}`, true);
        // Poll for completion
        let attempts = 0;
        const pollInterval = setInterval(async () => {
          attempts++;
          await fetchRedditSuggestions(apiKey);
          const updated = redditSuggestions.find(s => s.url === suggestion.url);
          if (updated?.llm_score || attempts > 12) {
            clearInterval(pollInterval);
            if (updated?.llm_score) {
              flash(`✅ LLM review complete! Score: ${updated.llm_score.toFixed(2)}`, true);
            } else if (attempts > 12) {
              flash(`⚠️ LLM review taking longer than expected. Refresh manually.`, false);
            }
          }
        }, 5000);
      } else {
        flash(`❌ ${data.detail || "LLM review failed"}`, false);
      }
    } catch {
      flash("Network error", false);
    } finally {
      setLlmReviewingUrl(null);
    }
  }

  async function acceptSuggestion(suggestion: RedditSuggestion) {
    if (!confirm(`Accept this article from "${suggestion.domain}"? It will be saved to your database.`)) return;
    if (acceptingUrl === suggestion.url) return;
    setAcceptingUrl(suggestion.url);
    
    try {
      const encodedUrl = btoa(suggestion.url);
      const resp = await fetch(`${API_BASE}/suggestions/accept?suggestion_url=${encodedUrl}`, {
        method: "POST", 
        headers: { "X-API-Key": apiKey },
      });
      const data = await resp.json();
      
      if (resp.ok) {
        flash(`✅ ${data.message}`, true);
        await fetchRedditSuggestions(apiKey);
      } else {
        flash(`❌ ${data.detail || "Accept failed"}`, false);
      }
    } catch { 
      flash("Network error", false); 
    } finally {
      setAcceptingUrl(null);
    }
  }

  async function rejectSuggestion(suggestion: RedditSuggestion) {
    if (!confirm(`Reject "${suggestion.domain}"? It will be removed from suggestions.`)) return;
    if (rejectingUrl === suggestion.url) return;
    setRejectingUrl(suggestion.url);
    
    try {
      // Mark as rejected/accepted to remove from list
      const resp = await fetch(`${API_BASE}/reddit/suggestions/accept?suggestion_url=${encodeURIComponent(suggestion.url)}`, {
        method: "POST",
        headers: { "X-API-Key": apiKey },
      });
      
      if (resp.ok) {
        flash(`Rejected ${suggestion.domain}`, true);
        await fetchRedditSuggestions(apiKey);
      } else {
        flash("Reject failed", false);
      }
    } catch (err) {
      console.error("Reject error:", err);
      flash("Network error", false);
    } finally {
      setRejectingUrl(null);
    }
  }

  if (error) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="text-center py-20">
          <div className="text-destructive text-lg">{error}</div>
          <Link to="/admin" className="mt-4 inline-block text-sm underline">
            Back to Admin
          </Link>
        </div>
      </div>
    );
  }

  if (!authed || loading) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="text-center py-20 text-muted-foreground">
          {loading ? "Loading..." : "Verifying access..."}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="font-serif text-4xl mb-2">Blog & Article Management</h1>
          <p className="text-muted-foreground">Manage curated blogs and review Reddit discoveries</p>
        </div>
        <Link to="/admin" className="text-sm underline hover:text-accent">
          ← Back to Admin
        </Link>
      </div>

      {/* Status messages */}
      {status && (
        <div className={`mb-6 p-3 rounded text-sm text-center ${
          status.ok ? "bg-green-500/10 text-green-700" : "bg-red-500/10 text-red-700"
        }`}>
          {status.msg}
        </div>
      )}

      {/* Reddit Discovery Section */}
      <div className="mb-12">
        <button
          onClick={() => setShowRedditSection(!showRedditSection)}
          className="flex items-center gap-2 text-left mb-4"
        >
          <h2 className="font-serif text-2xl">Reddit Discovery</h2>
          <span className="text-sm text-muted-foreground">{showRedditSection ? "▼" : "▶"}</span>
        </button>
        
        {showRedditSection && (
          <div className="p-4 border border-border rounded-lg bg-card">
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm text-muted-foreground">
                Discover individual articles from Reddit. Run LLM review to get AI scoring, then accept high-quality articles.
              </p>
              <button
                onClick={runRedditDiscovery}
                disabled={discoveryRunning}
                className="bg-accent text-accent-foreground px-4 py-2 rounded text-sm disabled:opacity-50"
              >
                {discoveryRunning ? "Running..." : "Run Discovery Now"}
              </button>
            </div>
            
            {redditSuggestions.length > 0 ? (
              <div className="mt-4">
                <h3 className="font-semibold mb-3">Pending suggestions ({redditSuggestions.length})</h3>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {redditSuggestions.map((s) => (
                    <div key={s.url} className="flex justify-between items-start p-3 border-b hover:bg-muted/50 rounded">
                      <div className="flex-1">
                        <a 
                          href={s.url} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="font-medium hover:text-accent"
                        >
                          {s.title}
                        </a>
                        <div className="text-xs text-muted-foreground mt-1">
                          {s.domain} · r/{s.subreddit} · 👍 {s.reddit_score}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Heuristic: {s.heuristic_score.toFixed(2)}
                          {s.llm_score && ` · LLM: ${s.llm_score.toFixed(2)}`}
                          {s.combined_score && ` · Combined: ${s.combined_score.toFixed(2)}`}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {!s.llm_score && s.reviewed !== 'processing' && (
                          <button
                            onClick={() => triggerSuggestionLLM(s)}
                            disabled={llmReviewingUrl === s.url}
                            className="text-xs px-3 py-1 rounded border border-foreground/30 hover:border-accent hover:text-accent transition-colors disabled:opacity-50"
                          >
                            {llmReviewingUrl === s.url ? "Reviewing..." : "🤖 LLM Review"}
                          </button>
                        )}
                        {s.llm_score && (
                          <>
                            <button
                              onClick={() => acceptSuggestion(s)}
                              disabled={acceptingUrl === s.url}
                              className="text-xs px-3 py-1 rounded bg-green-600/20 text-green-700 hover:bg-green-600/30 transition-colors disabled:opacity-50"
                            >
                              {acceptingUrl === s.url ? "Accepting..." : "✅ Accept"}
                            </button>
                            <button
                              onClick={() => rejectSuggestion(s)}
                              disabled={rejectingUrl === s.url}
                              className="text-xs px-3 py-1 rounded bg-red-600/20 text-red-700 hover:bg-red-600/30 transition-colors disabled:opacity-50"
                            >
                              {rejectingUrl === s.url ? "..." : "❌ Reject"}
                            </button>
                          </>
                        )}
                        {s.reviewed === 'failed' && (
                          <span className="text-xs text-red-500">Failed: {s.llm_error}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No pending suggestions. Run discovery to find articles.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Blogs Table */}
      <div>
        <h2 className="font-serif text-2xl mb-4">Curated Blogs (RSS Subscriptions)</h2>
        {blogs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border rounded-lg">
            No blogs found. Add blogs from the main admin page.
          </div>
        ) : (
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr className="text-left">
                  <th className="px-4 py-3 font-medium">Blog Name</th>
                  <th className="px-4 py-3 font-medium">URL</th>
                  <th className="px-4 py-3 font-medium">Articles</th>
                  <th className="px-4 py-3 font-medium">Last Scanned</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {blogs.map((blog) => (
                  <tr key={blog.name} className="border-b hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{blog.name}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground truncate max-w-xs">
                      <a href={blog.url} target="_blank" rel="noopener noreferrer" className="hover:text-accent">
                        {blog.url}
                      </a>
                    </td>
                    <td className="px-4 py-3">{blog.article_count || 0}</td>
                    <td className="px-4 py-3 text-xs">
                      {blog.last_fetched ? new Date(blog.last_fetched).toLocaleDateString() : "never"}
                    </td>
                    <td className="px-4 py-3 space-x-3">
                      <button 
                        onClick={() => viewArticles(blog)}
                        className="text-xs text-accent hover:underline"
                      >
                        articles
                      </button>
                      <button 
                        onClick={() => refreshBlog(blog.name)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        refresh
                      </button>
                      <button 
                        onClick={() => deleteBlog(blog.name)}
                        className="text-xs text-destructive hover:underline"
                      >
                        delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Articles Modal */}
      {selectedBlog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-lg max-w-5xl w-full max-h-[85vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-4 border-b">
              <div>
                <h2 className="font-serif text-2xl">{selectedBlog.name}</h2>
                <p className="text-sm text-muted-foreground">Articles from this blog</p>
              </div>
              <button 
                onClick={() => setSelectedBlog(null)} 
                className="text-muted-foreground hover:text-foreground text-2xl leading-none"
              >
                ×
              </button>
            </div>
            
            <div className="overflow-auto flex-1 p-4">
              {articles.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No articles found. Run a refresh to fetch articles.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-background border-b">
                    <tr className="text-left">
                      <th className="pb-2">Title</th>
                      <th className="pb-2 w-20">Heuristic</th>
                      <th className="pb-2 w-20">LLM</th>
                      <th className="pb-2 w-20">Combined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {articles.map((article) => (
                      <tr key={article.id} className="border-b hover:bg-muted/30">
                        <td className="py-2 pr-4">
                          <a 
                            href={article.url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="hover:text-accent line-clamp-2"
                          >
                            {article.title}
                          </a>
                          <div className="text-xs text-muted-foreground mt-1">
                            {new Date(article.fetched_at).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="py-2 text-center font-mono">
                          {article.heuristic_score.toFixed(2)}
                        </td>
                        <td className="py-2 text-center font-mono">
                          {article.llm_score ? article.llm_score.toFixed(2) : "-"}
                        </td>
                        <td className="py-2 text-center font-mono">
                          {article.combined_score.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BlogsPage;