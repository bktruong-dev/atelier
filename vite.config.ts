import { defineConfig, type Plugin } from "vite";

/**
 * The same Content-Security-Policy the live site sends (see vercel.json), applied
 * to the dev server too, so pattern code is locked down locally as well.
 *
 * - The page may run only its own scripts, never compiled strings.
 * - The pattern worker may compile pattern code ('unsafe-eval') but load
 *   nothing from anywhere else and open no connections: no fetch, no import()
 *   of outside scripts.
 *
 * Dev differs from production only where Vite needs it: inline <style> tags for
 * hot-reloaded CSS, and a websocket back to the dev server.
 */
const PAGE_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "worker-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "connect-src 'self' ws://localhost:* ws://127.0.0.1:*",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join("; ");

const WORKER_CSP = "default-src 'none'; script-src 'self' 'unsafe-eval'";

function devSecurityHeaders(): Plugin {
  return {
    name: "atelier-dev-csp",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? "";
        // the worker entry and the modules it imports run in the worker's realm
        const inWorker = url.includes("sandbox/worker") || url.includes("worker_file");
        res.setHeader("Content-Security-Policy", inWorker ? WORKER_CSP : PAGE_CSP);
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("Referrer-Policy", "no-referrer");
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [devSecurityHeaders()],
});
