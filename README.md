# Portfolio

Single-page portfolio with an interactive Three.js scene, built with Vite.

## Edit content

Everything you'd change lives in [`src/data.js`](src/data.js): name, roles, bio, skills,
email, social links, projects, and the `site` block (domain, page title, description,
privacy/legal links — those two links stay hidden until you fill them in).

Each project gets a card on the home page and its own page at `/project/<slug>`
(title, tags, description, "Live view" link, screenshot gallery, next-project link).
Images go in `public/images/` and are referenced as `/images/your-file.webp`:
`cover` for the card (16:10, ~1600×1000) and `gallery[].image` for the screenshots
(16:9 works well). Until you add them, generated placeholders are shown.

Replace `public/og-image.jpg` (1200×630) with a fresh screenshot of the hero once your
name is in — it's the preview shown when the link is shared.

## Commands

```bash
npm install       # once
npm run dev       # local dev server on http://localhost:5173
npm run build     # production build into dist/
npm run preview   # serve dist/ with the production security headers
```

## Deploy

Upload the `dist/` folder to any static host. Netlify and Cloudflare Pages pick up
`public/_headers` (security headers + long-term caching for `/assets/*`) and the
generated `_redirects` (serves `index.html` for `/project/*` URLs) automatically. On
other hosts (Vercel, nginx, GitHub Pages) add the same headers and a rewrite of
`/project/*` to `/index.html` in the host's config.
Set `site.url` in `src/data.js` to your real domain before building — it's used for the
canonical URL, social previews, `sitemap.xml` and `robots.txt`.
