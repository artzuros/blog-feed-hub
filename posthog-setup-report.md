# PostHog post-wizard report

The wizard has completed a deep integration of Blog Feed Hub with PostHog analytics. Changes span six files: `vite.config.ts` now proxies PostHog ingest traffic through the dev server; `src/routes/__root.tsx` wraps the app in `PostHogProvider`; and the four route files each import `usePostHog` and capture events at the relevant user interaction points. The `@posthog/react` and `posthog-node` packages were installed, and PostHog credentials were written to `.env`. Automatic pageview, session, and exception tracking are enabled via `PostHogProvider`.

| Event | Description | File |
|---|---|---|
| `article_searched` | User submitted a search query. Captures query, result count, source filter, min relevance, and keyword/semantic result counts. | `src/routes/index.tsx` |
| `article_clicked` | User clicked an article from search results. Captures title, URL, blog name, score, source, position, and query. | `src/routes/index.tsx` |
| `search_no_results` | A search returned zero results. Captures query and relevance threshold. | `src/routes/index.tsx` |
| `relevance_threshold_changed` | User reset the semantic relevance slider. Captures old/new value. | `src/routes/index.tsx` |
| `suggestion_voted` | User cast an upvote or downvote on a suggestion. Captures vote type, domain, subreddit, and Reddit score. | `src/routes/suggestions.tsx` |
| `suggestions_sorted` | User changed the sort order of suggestions. Captures new and previous sort values. | `src/routes/suggestions.tsx` |
| `admin_authenticated` | Admin successfully authenticated with an API key. | `src/routes/admin.tsx` |
| `blog_added` | Admin added a new curated blog. Captures name, URL, and whether RSS was provided. | `src/routes/admin.tsx` |
| `llm_review_queued` | Admin triggered the LLM review queue for all pending articles. | `src/routes/admin.tsx` |
| `reddit_discovery_started` | Admin triggered Reddit discovery to find new article candidates. | `src/routes/blogs.tsx` |
| `suggestion_llm_reviewed` | Admin triggered LLM review for a specific Reddit suggestion. Captures domain, title, and scores. | `src/routes/blogs.tsx` |
| `suggestion_accepted` | Admin accepted a Reddit suggestion into the archive. Captures all scoring signals. | `src/routes/blogs.tsx` |
| `suggestion_rejected` | Admin rejected a Reddit suggestion. Captures domain, title, and scores. | `src/routes/blogs.tsx` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- [Analytics basics (wizard) — Dashboard](https://us.posthog.com/project/461955/dashboard/1690831)
- [Search activity over time](https://us.posthog.com/project/461955/insights/q8ySlG2x) — Daily search volume trend
- [Search to article click rate](https://us.posthog.com/project/461955/insights/d05Ki76F) — % of searchers who click an article (CTR formula)
- [Search to article click funnel](https://us.posthog.com/project/461955/insights/vqEQRbUX) — Conversion funnel from search to article click
- [Suggestion votes by type](https://us.posthog.com/project/461955/insights/JHI4HPtD) — Upvote vs. downvote volume over time
- [Content curation pipeline](https://us.posthog.com/project/461955/insights/2J0B8KmX) — Funnel: Reddit discovery → LLM review → accepted to archive

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.
