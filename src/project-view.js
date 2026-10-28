import gsap from "gsap";
import { projects } from "./data.js";

// Full-page project view at /project/<slug> matching david-hckh.com layout:
// hero grid with title, tags, description, and Live View button,
// rounded media container with notched captions, then Next Project card.

const el = (tag, props = {}, children = []) => {
  const node = Object.assign(document.createElement(tag), props);
  for (const child of [].concat(children)) node.append(child);
  return node;
};

export const projectPath = (project) => `/project/${project.slug}`;
export const findProject = (path) => {
  const match = path.match(/^\/project\/([^/]+)\/?$/);
  return match ? projects.find((p) => p.slug === match[1]) : null;
};

// Draws a rich, high-DPI visual preview for project cards & gallery shots
export function createProjectArtwork(project, variant = 0, caption = "") {
  const canvas = document.createElement("canvas");
  canvas.width = 960;
  canvas.height = 540;
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;

  const [c1, c2] = project.colors || ["#364e7c", "#1c2f4f"];
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, c1);
  grad.addColorStop(1, c2);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Subtle ambient grid & depth circles
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1.5;
  const step = 48;
  for (let x = (variant * 17) % step; x < w; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = (variant * 13) % step; y < h; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // Soft glowing orbs
  const orb = ctx.createRadialGradient(w * 0.75, h * 0.28, 10, w * 0.75, h * 0.28, 260);
  orb.addColorStop(0, "rgba(255,255,255,0.28)");
  orb.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = orb;
  ctx.beginPath();
  ctx.arc(w * 0.75, h * 0.28, 260, 0, Math.PI * 2);
  ctx.fill();

  // Isometric / UI mockup window in center
  const cardW = 640;
  const cardH = 360;
  const cx = (w - cardW) / 2;
  const cy = (h - cardH) / 2 + 12;

  ctx.shadowColor = "rgba(10, 14, 28, 0.35)";
  ctx.shadowBlur = 36;
  ctx.shadowOffsetY = 18;
  ctx.fillStyle = "rgba(18, 22, 36, 0.88)";
  ctx.beginPath();
  ctx.roundRect(cx, cy, cardW, cardH, 20);
  ctx.fill();
  ctx.shadowColor = "transparent";

  // Window top bar
  ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
  ctx.beginPath();
  ctx.roundRect(cx, cy, cardW, 42, [20, 20, 0, 0]);
  ctx.fill();

  ["#ff5f56", "#ffbd2e", "#27c93f"].forEach((dot, i) => {
    ctx.fillStyle = dot;
    ctx.beginPath();
    ctx.arc(cx + 24 + i * 20, cy + 21, 6, 0, Math.PI * 2);
    ctx.fill();
  });

  // Pill badge in window header
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.beginPath();
  ctx.roundRect(cx + cardW - 150, cy + 11, 130, 20, 10);
  ctx.fill();

  // Left sidebar & main visual panels inside the mockup
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  ctx.beginPath();
  ctx.roundRect(cx + 20, cy + 60, 160, cardH - 80, 12);
  ctx.fill();

  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i === variant % 5 ? c1 : "rgba(255,255,255,0.12)";
    ctx.beginPath();
    ctx.roundRect(cx + 34, cy + 78 + i * 36, 132 - (i % 2) * 24, 18, 6);
    ctx.fill();
  }

  // Right content area cards
  const rx = cx + 198;
  const rw = cardW - 218;
  ctx.fillStyle = "rgba(255,255,255,0.07)";
  ctx.beginPath();
  ctx.roundRect(rx, cy + 60, rw, 145, 14);
  ctx.fill();

  // Accent wave / chart inside top panel
  ctx.strokeStyle = c2;
  ctx.lineWidth = 4;
  ctx.beginPath();
  for (let i = 0; i <= 24; i++) {
    const px = rx + 24 + (i / 24) * (rw - 48);
    const py = cy + 135 + Math.sin(i * 0.55 + variant * 1.4) * 32;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();

  // Bottom 2 mini cards
  for (let col = 0; col < 2; col++) {
    const bx = rx + col * (rw / 2 + 8);
    const bw = rw / 2 - 8;
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.beginPath();
    ctx.roundRect(bx, cy + 220, bw, 120, 14);
    ctx.fill();

    ctx.fillStyle = col === 0 ? c1 : c2;
    ctx.beginPath();
    ctx.arc(bx + 34, cy + 258, 16, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.beginPath();
    ctx.roundRect(bx + 62, cy + 246, bw - 82, 10, 5);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.roundRect(bx + 62, cy + 264, bw - 110, 8, 4);
    ctx.fill();
  }

  // Floating title badge overlay
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 34px Urbanist, sans-serif";
  ctx.fillText(project.title, cx + 28, cy + cardH - 28);
  if (caption) {
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.font = "700 15px 'Space Mono', monospace";
    ctx.fillText(caption.toUpperCase(), cx + 92, cy + 26); // clear of the window dots
  }
  ctx.restore();
  return canvas;
}

function notchSvg(cls) {
  const wrap = el("div", { className: `notch ${cls}`, ariaHidden: "true" });
  wrap.innerHTML = '<svg viewBox="0 0 256 256" fill="none" shape-rendering="crispEdges"><use href="#notch-path" fill="currentColor"/></svg>';
  return wrap;
}

function shot(project, item, index) {
  const media = el("div", { className: "pv-shot-media" });
  if (item.image) {
    media.append(el("img", { src: item.image, alt: `${project.title}: ${item.caption}`, loading: index ? "lazy" : "eager", decoding: "async" }));
  } else {
    media.append(createProjectArtwork(project, index + 1, item.caption));
  }

  const caption = el("figcaption", {}, [
    notchSvg("pv-caption-notch pv-caption-notch-left"),
    notchSvg("pv-caption-notch pv-caption-notch-top"),
    el("span", { textContent: item.caption }),
  ]);

  const figure = el("figure", { className: "pv-shot" }, [media, caption]);
  return el("div", { className: "pv-shot-row" }, figure);
}

export function renderProject(root, project) {
  const next = projects[(projects.indexOf(project) + 1) % projects.length];
  root.style.setProperty("--pv-bg", project.theme || "#1c2f4f");
  root.style.setProperty("--pv-card-bg", project.colors?.[0] ? "#2b3f66" : "#364e7c");

  const tags = el("ul", { className: "pv-tags", ariaLabel: "Tech Stack" }, project.tags.map((tag) => {
    const li = el("li", { textContent: tag.label });
    li.style.background = tag.color;
    if (tag.ink) li.style.color = tag.ink;
    return li;
  }));

  const intro = el("div", { className: "pv-intro" }, [
    el("h1", { className: "pv-title", textContent: project.title }),
    tags,
  ]);

  const buttons = el("div", { className: "pv-buttons" });
  if (project.liveUrl) {
    const isGithub = project.liveUrl.includes("github.com");
    const label = isGithub ? "Source Code" : "Live View";
    buttons.append(el("a", {
      className: "pv-live",
      href: project.liveUrl,
      target: "_blank",
      rel: "noopener noreferrer",
      textContent: label,
    }));
    buttons.lastChild.setAttribute("data-cursor", "arrow-external");
  }

  const head = el("header", { className: "pv-head grid" }, [
    intro,
    el("div", { className: "pv-desc" }, project.description.map((text) => el("p", { textContent: text }))),
    buttons,
  ]);

  const gallery = el("section", { className: "pv-gallery", ariaLabel: "Screenshots & Demos" },
    el("div", { className: "pv-gallery-inner" }, project.gallery.map((item, i) => shot(project, item, i))));

  const thumb = el("span", { className: "pv-next-thumb" });
  if (next.cover) thumb.append(el("img", { src: next.cover, alt: next.title }));
  else thumb.append(createProjectArtwork(next, 0));

  const arrowWrap = el("span", { className: "pv-next-arrow", ariaHidden: "true" });
  arrowWrap.innerHTML = '<svg overflow="visible" viewBox="0 0 256 256" fill="none"><path d="M87 18L197 126.41L87 237" stroke="currentColor" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  const nextLink = el("a", { className: "pv-next", href: projectPath(next) }, [
    thumb,
    el("span", { className: "pv-next-text" }, [
      el("small", { textContent: "Next Project:" }),
      el("strong", { textContent: next.title }),
    ]),
    arrowWrap,
  ]);
  nextLink.setAttribute("data-cursor", "arrow");

  const nextGrid = el("div", { className: "grid pv-next-wrap" }, nextLink);

  root.querySelector(".pv-body").replaceChildren(head, gallery, nextGrid);

  if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
    gsap.fromTo(
      [".pv-head", ".pv-gallery", ".pv-next"],
      { opacity: 0, y: 30 },
      { opacity: 1, y: 0, stagger: 0.12, duration: 0.6, ease: "power3.out" }
    );
  }
}
