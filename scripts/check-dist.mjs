// Sanity checks on the production build: run `npm run build && npm run check`.
// Guards against regressions found in QA (unfilled template tokens, dead footer
// links, sitemap drift, missing static assets).
import { readFileSync, existsSync } from "node:fs";
import { site, profile, projects } from "../src/data.js";

const dist = new URL("../dist/", import.meta.url);
const read = (file) => readFileSync(new URL(file, dist), "utf8");
const failures = [];
const check = (ok, message) => ok || failures.push(message);

const html = read("index.html");
check(!/%[A-Z_]+%/.test(html), "index.html still contains %TOKEN% placeholders");
check(html.includes(`<link rel="canonical" href="${site.url}/"`), "canonical URL doesn't match site.url");
check(!html.includes('href="#top">Privacy') && !html.includes("lang-btn"), "dead footer controls are back");
check(!/soundcloud\.com/.test(html), "third-party music credit is back, but the site has no licensed track");

for (const file of ["robots.txt", "sitemap.xml", "_redirects", "_headers", "og-image.jpg", "favicon.svg", "apple-touch-icon.png", "site.webmanifest"]) {
  check(existsSync(new URL(file, dist)), `dist/${file} is missing`);
}

const sitemap = read("sitemap.xml");
for (const path of ["/", ...projects.map((p) => `/project/${p.slug}`)]) {
  check(sitemap.includes(`<loc>${site.url}${path}</loc>`), `sitemap.xml is missing ${path}`);
}

const slugs = projects.map((p) => p.slug);
check(new Set(slugs).size === slugs.length, "project slugs must be unique");
// Placeholder links: a bare domain, or a Play Store URL without an app/developer id.
const placeholder = (url) => !/^https:\/\/[^/]+\/.+/.test(url) || (url.includes("play.google.com") && !url.includes("id="));
for (const p of projects) {
  check(!p.liveUrl || !placeholder(p.liveUrl), `project "${p.slug}" liveUrl looks like a placeholder (${p.liveUrl})`);
}
for (const s of profile.socials) {
  check(!placeholder(s.url), `social link "${s.label}" looks like a placeholder (${s.url})`);
}

if (failures.length) {
  console.error(`check-dist: ${failures.length} problem(s)\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log("check-dist: all checks passed");
