import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { PostHogProvider } from "@posthog/react";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-serif text-foreground">404</h1>
        <p className="mt-2 text-sm text-muted-foreground">This page wandered off the press.</p>
        <Link to="/" className="mt-6 inline-block underline underline-offset-4">
          Back to the front page
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-serif">Something went sideways</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="mt-6 rounded bg-primary px-4 py-2 text-sm text-primary-foreground"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Blog Feed — High-signal engineering reading" },
      {
        name: "description",
        content:
          "A curated dispatch of software engineering writing — searched, scored, and surfaced.",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Work+Sans:wght@400;500;600&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <PostHogProvider
          apiKey={import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN!}
          options={{
            api_host: "/ingest",
            ui_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST || "https://us.posthog.com",
            defaults: "2025-05-24",
            capture_exceptions: true,
            debug: import.meta.env.DEV,
          }}
        >
          {children}
        </PostHogProvider>
        <Scripts />
      </body>
    </html>
  );
}

function Masthead() {
  const linkCls = "text-sm tracking-wide uppercase hover:text-accent transition-colors";
  return (
    <header className="rule-bottom bg-background/80 backdrop-blur sticky top-0 z-40">
      <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between gap-6">
        <Link to="/" className="flex items-baseline gap-3">
          <span className="font-serif text-3xl leading-none">Blog Feed</span>
          <span className="hidden md:inline text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Vol. I · Engineering Dispatch
          </span>
        </Link>
        <nav className="flex items-center gap-6">
          <Link
            to="/"
            className={linkCls}
            activeOptions={{ exact: true }}
            activeProps={{ className: linkCls + " text-accent" }}
          >
            Search
          </Link>
          <Link
            to="/suggestions"
            className={linkCls}
            activeProps={{ className: linkCls + " text-accent" }}
          >
            Suggestions
          </Link>
          {/* <Link to="/admin" className={linkCls} activeProps={{ className: linkCls + " text-accent" }}>Admin</Link> */}
        </nav>
      </div>
    </header>
  );
}

function Colophon() {
  return (
    <footer className="rule-top mt-24">
      <div className="mx-auto max-w-6xl px-6 py-10 flex flex-col md:flex-row justify-between gap-4 text-sm text-muted-foreground">
        <div>
          <div className="font-serif text-xl text-foreground">Blog Feed</div>
          <div>A small index for engineering writing.</div>
        </div>

        <div className="space-y-1">
          <div className="font-medium text-foreground">Contact</div>
          <div>
            <a
              href="mailto:admin@pranav-bansal.com"
              className="hover:text-accent transition-colors"
            >
              admin@pranav-bansal.com
            </a>
          </div>
          <div>
            <a
              href="https://github.com/artzuros"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-accent transition-colors inline-flex items-center gap-1"
            >
              GitHub
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </a>
          </div>
        </div>
        <div className="md:text-right space-y-1">
          <div>
            <a
              href="https://github.com/artzuros/blog-feed"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-accent transition-colors inline-flex items-center gap-1"
            >
              Contribute on GitHub
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </a>
          </div>
          <div className="opacity-70">
            © {new Date().getFullYear()} — All articles © their respective authors.
          </div>
          <div className="opacity-70">Listed on the web.</div>
        </div>
      </div>
    </footer>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen flex flex-col">
        <Masthead />
        <main className="flex-1">
          <Outlet />
        </main>
        <Colophon />
      </div>
    </QueryClientProvider>
  );
}
