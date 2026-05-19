// API base — keep all endpoints relative as in the original frontend.
// Override with VITE_API_BASE (e.g. https://api.example.com) when the React
// app is served from a different origin than the FastAPI backend.
export const API_BASE = import.meta.env.VITE_API_BASE || "/api";

export function scoreClass(score: number) {
  if (score >= 0.7) return "text-emerald-700 dark:text-emerald-400";
  if (score >= 0.4) return "text-amber-700 dark:text-amber-400";
  return "text-red-700 dark:text-red-400";
}
