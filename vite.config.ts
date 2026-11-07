// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

/**
 * Prevents Vite dev server from attaching a ~4.7 MB inline base64 sourcemap to
 * `src/services/ml/model_export.json?import` (which otherwise inflates the 770 KB
 * Random Forest artifact to 5.44 MB and exceeds Cloud Run's 4 MB HTTP/1.1 proxy limit,
 * causing `Failed to fetch dynamically imported module` on client route transitions).
 */
function compactMlJsonDevPlugin(): Plugin {
  let cachedModuleCode: string | null = null;
  let cachedMtimeMs = -1;

  return {
    name: "agrismart:compact-ml-json-dev",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const rawUrl = req.url ?? "";
        const [pathname, query = ""] = rawUrl.split("?");
        if (
          pathname === "/src/services/ml/model_export.json" &&
          (query === "import" || query.startsWith("import&") || query.includes("&import"))
        ) {
          try {
            const filePath = path.resolve(server.config.root, "src/services/ml/model_export.json");
            const stat = fs.statSync(filePath);
            if (!cachedModuleCode || stat.mtimeMs !== cachedMtimeMs) {
              const minified = JSON.stringify(JSON.parse(fs.readFileSync(filePath, "utf8")));
              cachedModuleCode = `export default JSON.parse(${JSON.stringify(minified)});\n`;
              cachedMtimeMs = stat.mtimeMs;
            }
            res.statusCode = 200;
            res.setHeader("Content-Type", "text/javascript; charset=utf-8");
            res.setHeader("Cache-Control", "no-cache");
            res.end(cachedModuleCode);
            return;
          } catch (err) {
            next(err);
            return;
          }
        }
        next();
      });
    },
  };
}

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
    client: { entry: "client" },
  },
  plugins: [compactMlJsonDevPlugin()],
  vite: {
    json: {
      stringify: true,
    },
    optimizeDeps: {
      include: [
        "@radix-ui/react-alert-dialog",
        "@radix-ui/react-dialog",
        "@radix-ui/react-dropdown-menu",
        "@radix-ui/react-label",
        "@radix-ui/react-popover",
        "@radix-ui/react-select",
        "@radix-ui/react-slot",
        "@tanstack/react-query",
        "@tanstack/react-router",
        "class-variance-authority",
        "clsx",
        "lucide-react",
        "recharts",
        "sonner",
        "tailwind-merge",
        "zod",
      ],
    },
    server: {
      allowedHosts: true,
    },
  },
});
