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
  combined_score?: number;
  reviewed?: string;
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
      setRedditSuggestions(data);
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

  async function acceptRedditSuggestion(suggestion: RedditSuggestion) {
    if (!confirm(`Accept "${suggestion.domain}" as a curated blog?`)) return;
    
    try {
      const resp = await fetch(`${API_BASE}/reddit/suggestions/accept?suggestion_url=${encodeURIComponent(suggestion.url)}`, {
        method: "POST",
        headers: { "X-API-Key": apiKey },
      });
      
      if (resp.ok) {
        flash(`Accepted ${suggestion.domain}. Add to blogs.csv manually or run scan.`, true);
        await fetchRedditSuggestions(apiKey);
        await fetchBlogs(apiKey);
      } else {
        flash("Accept failed", false);
      }
    } catch (err) {
      console.error("Accept error:", err);
      flash("Network error", false);
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
          <h1 className="font-serif text-4xl mb-2">Blog Management</h1>
          <p className="text-muted-foreground">Manage curated blogs, discover new ones, and review articles</p>
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
                Discover engineering blogs from Reddit. Suggestions are scored by heuristic quality.
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
                <h3 className="font-semibold mb-3">New suggestions ({redditSuggestions.length})</h3>
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
                          {s.domain}
                        </a>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{s.title}</p>
                        <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                          <span>r/{s.subreddit}</span>
                          <span>👍 {s.reddit_score}</span>
                          <span>Score: {s.heuristic_score.toFixed(2)}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => acceptRedditSuggestion(s)}
                        className="ml-4 text-xs border px-3 py-1 rounded hover:border-accent hover:text-accent"
                      >
                        Accept
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No pending suggestions. Run discovery to find new blogs.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Blogs Table */}
      <div>
        <h2 className="font-serif text-2xl mb-4">Curated Blogs</h2>
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