import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [
    // tsConfigPaths must come before the React plugin so the `@` alias resolves.
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tailwindcss(),
    // cloudflare is build-only: it generates dist/server/wrangler.json from wrangler.jsonc.
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tanstackStart({
      // Redirect TanStack Start's bundled server entry to src/server.ts (the SSR error
      // wrapper). This is what wrangler.jsonc `main` alone does not accomplish.
      server: { entry: "server" },
    }),
    viteReact(),
  ],
  resolve: {
    dedupe: ["react", "react-dom"],
  },
  server: {
    proxy: {
      "/ingest/static": {
        target: "https://us-assets.i.posthog.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ingest/, ""),
        secure: false,
      },
      "/ingest/array": {
        target: "https://us-assets.i.posthog.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ingest/, ""),
        secure: false,
      },
      "/ingest": {
        target: "https://us.i.posthog.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ingest/, ""),
        secure: false,
      },
    },
  },
});
