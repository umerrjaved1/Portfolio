import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import { site, profile, projects } from "./src/data.js";

const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// Fills %TOKENS% in index.html from data.js and emits robots.txt + sitemap.xml,
// so search engines and link previews see real content without running JS.
function siteMeta() {
  const tokens = {
    TITLE: site.title,
    DESCRIPTION: site.description,
    SITE_URL: site.url,
    NAME: `${profile.firstName} ${profile.lastName}`,
    FIRST_NAME: profile.firstName,
    LAST_NAME: profile.lastName,
    ROLE: profile.roles[0],
    BIO: profile.bio,
  };
  return {
    name: "site-meta",
    transformIndexHtml(html) {
      return html.replace(/%([A-Z_]+)%/g, (match, key) => (key in tokens ? escapeHtml(tokens[key]) : match));
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "robots.txt", source: `User-agent: *\nAllow: /\n\nSitemap: ${site.url}/sitemap.xml\n` });
      const urls = ["/", ...projects.map((p) => `/project/${p.slug}`)].map((path) => `  <url><loc>${site.url}${path}</loc></url>`);
      this.emitFile({
        type: "asset",
        fileName: "sitemap.xml",
        source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`,
      });
      // Project pages are client-side routes; serve index.html for them (Netlify, Cloudflare Pages).
      this.emitFile({ type: "asset", fileName: "_redirects", source: "/project/*  /index.html  200\n" });
    },
  };
}

// Mirror public/_headers in `vite preview`, so the production CSP is exercised locally.
function headersFromFile() {
  const headers = {};
  const text = readFileSync(new URL("./public/_headers", import.meta.url), "utf8");
  const block = text.split(/\n(?=\/)/).find((b) => b.startsWith("/*"));
  for (const line of block.split("\n").slice(1)) {
    const match = line.match(/^\s+([\w-]+):\s*(.+)$/);
    if (match && match[1] !== "Strict-Transport-Security") headers[match[1]] = match[2];
  }
  return headers;
}

export default defineConfig({
  plugins: [siteMeta()],
  preview: { headers: headersFromFile() },
  build: {
    target: "es2022",
    assetsInlineLimit: 0,
    // three.js is ~140 kB gzipped in its own chunk, which is expected for this site.
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        // Keep three.js in its own long-cacheable chunk.
        manualChunks: (id) => (id.includes("node_modules/three") ? "three" : undefined),
      },
    },
  },
});
