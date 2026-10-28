# QA Report: Portfolio (2026-10-28)

**Final status: PASS WITH ISSUES.** The site works end to end and I found no code defects that block a release. Before you publish, though, you need to supply your own data: the share image and the project/Play links are still placeholders (see section F).

## A. Executive summary
- **Stack:** Vite 8, vanilla JS, Three.js (WebGL stage and contact scene), GSAP with ScrollTrigger, and Lenis. The site is a single-page app with client-side routes `/` and `/project/<slug>`. There is no contact form (contact is by email link only) and no backend.
- **Fixed:** 10 confirmed defects. The biggest was on phones: the hologram About panels overlapped and ran off the screen at every phone size. Others were dead footer controls, a music credit that didn't apply to this site, wrong canonical URLs on project pages, and a 3-second loader on direct project URLs.
- **Open:** the social-share image says "Your Name". All five project buttons and the Google Play social link point to generic placeholder pages. Some content claims can't be verified by QA (8+ yrs, 1M+ installs, 72%).

## B. Coverage (what was actually tested)
- **Browser:** the Claude in-app Chromium pane only. I did not test Firefox or Safari, and I did not test on a real device (touch is emulated).
- **Builds:** the production build through `vite preview`, with the `_headers` CSP applied, and the dev server.
- **Viewports measured:** 320×568, 375×667, 390×844, 430×932, 768×1024, 1024×768, 1280×720 and 1200×630. I did not render 1440×900 or 1920×1080 because the pane is smaller than those.
- **Routes:** `/`, all 5 project pages loaded directly, next-project chaining, the back-to-home arrow, browser back/forward, and unknown paths (`/project/does-not-exist`, `/random/path`).
- **Checks:** every link's href, target and rel; heading outline; accessibility tree; keyboard skip link; horizontal overflow; console and network; `npm audit`; bundle sizes; meta, OG, sitemap and robots.

## C. Defect report

| ID | Sev | Area | Issue | Root cause | Fix | Verified |
|---|---|---|---|---|---|---|
| QA-01 | P2 | About hologram (phones) | The Skills panel was 700–800 px tall, overlapped the bio at 320/375/390/430 widths, and went off-screen at 320 and 375 (words clipped, e.g. "Architectur…") | Panels were absolutely positioned side by side at half width | Below 680 px the panels now stack in a flex column (name, skills, bio at the bottom) with compact type | ✅ Measured: no overlap or overflow at 320×568 and 390×844 (screenshots) |
| QA-02 | P2 | Footer | "Privacy" and "Legal Notice" linked to `#top` while their URLs were empty (the README says they stay hidden) | `href: url \|\| "#top"` fallback | The links render only when a URL is set | ✅ The footer contains no dead links |
| QA-03 | P2 | Footer | The "DE/EN" button only swapped its own label; the site has no translations | Copied from the reference site | Removed the button and its CSS | ✅ |
| QA-04 | P2 | Footer | "Music produced by HM Surf" credited a third party's music, but the site plays only synthesized audio (`audio.js`) | Copied from the reference site | Removed the credit (both footers) | ✅ |
| QA-05 | P2 | SEO | Project pages kept `canonical` and `og:url` pointing at `/`, which contradicts `sitemap.xml`; the description was also never updated | Meta was static | `setPageMeta()` updates canonical, og:url, title and description on every route | ✅ e.g. `/project/support-crew` now has a matching canonical |
| QA-06 | P3 | Routing | Unknown paths showed the home page under the bad URL | No fallback | `history.replaceState` to `/` (the hash is kept) | ✅ `/nope/123#contact` becomes `/#contact` |
| QA-07 | P3 | Performance | Loading a project URL directly waited for the 3 s loader timeout, even though the page needs no WebGL | The loader was waiting for the 3D stage's ready signal | The loader finishes right away on project routes | ✅ Loader cleared at about 0.5 s (was 3.0 s) |
| QA-08 | P2 | Accessibility | The hero h1's accessible name was "UmerJaved", built from `aria-label` on generic spans (not allowed there); the contact h2 read as "Let's worktogether!" | Letter splitting, and a `<br>` with no space | Added an `.sr-only` full name and set the visual letters to `aria-hidden`; added a space before `<br>` | ✅ The a11y tree shows "Umer Javed" and "Let's work together!" |
| QA-09 | P3 | Accessibility | The skip link scrolled the page but left focus at the top, so Tab returned to the header | Hash links were only scrolled | `focusSection()` moves focus to the target | ✅ Skip link, then Tab, lands on the first project card |
| QA-10 | P3 | Project gallery | Caption text overlapped the window "traffic-light" dots in the generated artwork | Text drawn at x+30 | Moved the text to x+92 | ✅ by code (screenshot blocked, see section F) |
| QA-11 | P3 | PWA | The manifest name was "Portfolio" | Generic value | Changed to "Umer Javed — Portfolio" | ✅ |

## D. Changes made
- `src/styles.css`: mobile hologram column layout, `.sr-only` utility, focus rule for sections focused by in-page links, and removal of the dead `.lang-btn` and `.footer-credit` styles.
- `src/main.js`: conditional legal links, removal of the lang button, `setPageMeta()`, unknown-route redirect, client-side routing limited to `/` and project paths (a future `/privacy` page will load normally), `focusSection()`, and an instant loader on project routes.
- `index.html`: sr-only h1 name, `role="region"` for `#about`, the h2 spacing fix, and removal of the HM Surf credit.
- `src/project-view.js`: caption position.
- `public/site.webmanifest`: name.
- `scripts/check-dist.mjs` and `npm run check`: a dependency-free check of the build. It looks for leftover `%TOKENS%`, a wrong canonical, dead footer controls, sitemap and project drift, missing static files, and placeholder links.
- No dependencies were added or changed.

## E. Performance and accessibility results
- **Lighthouse:** not available in this environment, so there are no scores.
- **Core Web Vitals:** not reliably measurable. The pane throttles `requestAnimationFrame` when the app window isn't in front, and LCP/long-task entries were not reported. I am not claiming any numbers.
- **Bundle:** app JS is 165 kB (62 kB gzip). Three.js is a separate chunk of 588 kB (148 kB gzip) and loads only after the shell. Fonts are self-hosted woff2. `npm audit` reports 0 vulnerabilities.
- **Production CSP:** active in preview, with no violations and no console errors along the whole tested journey. The only console output is ANGLE shader-precision warnings from the GPU driver, not from the app.

## F. Remaining issues (need your input or a different environment)
1. **P1: the share image shows "Your Name / Android Developer"** (`public/og-image.jpg`). Every LinkedIn or X preview will show it. I couldn't capture a clean replacement here because the pane screenshot is throttled and downscaled. Take a 1200×630 screenshot of the hero and save it over that file.
2. **P1: placeholder links in `src/data.js`.** All 5 project buttons go to `https://github.com/` or `https://play.google.com/store`, and the Google Play social link goes to `/store/apps`. `npm run check` lists them and will fail until they're real.
3. **Unverified content.** Please confirm the GitHub, LinkedIn and X handles (`umerjaved`) are yours, and that the claims (8+ years, 1M+ installs and 4.6★, "72%" in Support Crew, "100% on-time") are accurate. QA can't verify them.
4. **Not tested:** other browsers, real touch devices, `prefers-reduced-motion` rendering (reviewed in code only), WebGL-unavailable fallback (reviewed in code only), and 1440 and 1920 widths.
5. **Optional:** `initGsapMagnetic` is never used (no `.magnetic` elements). Static hosts return 200, not 404, for unknown paths because of the SPA fallback.
