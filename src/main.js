import "@fontsource/urbanist/400.css";
import "@fontsource/urbanist/600.css";
import "@fontsource/urbanist/700.css";
import "@fontsource/urbanist/800.css";
import "@fontsource/urbanist/900.css";
import "@fontsource/space-mono/400.css";
import "@fontsource/space-mono/700.css";
import "lenis/dist/lenis.css";
import "./styles.css";
import Lenis from "lenis";
import { site, profile, projects } from "./data.js";
import { timeline, cardGeometry } from "./timeline.js";
import { iconSvg } from "./icons.js";
import { createAudio } from "./audio.js";
import { renderProject, findProject, projectPath } from "./project-view.js";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const audio = createAudio();
const fullName = `${profile.firstName} ${profile.lastName}`;

// Smooth, inertial scrolling (skipped for visitors who prefer reduced motion).
const lenis = reducedMotion ? null : new Lenis({ autoRaf: true, lerp: 0.1 });
function scrollToY(y, { immediate = false } = {}) {
  if (lenis) lenis.scrollTo(y, { immediate, force: true });
  else scrollTo({ top: y, behavior: "instant" });
}

const el = (tag, props = {}, children = []) => {
  const node = Object.assign(document.createElement(tag), props);
  for (const child of [].concat(children)) node.append(child);
  return node;
};

// Content -----------------------------------------------------------------------

function arrowBadge() {
  const badge = el("span", { className: "card-arrow", ariaHidden: "true" });
  badge.innerHTML = '<svg viewBox="0 0 24 24"><path d="M5 12h13m-5-6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  return badge;
}

function renderContent() {
  const fields = { ...profile, fullName: `${profile.firstName} ${profile.lastName}` };
  $$("[data-bind]").forEach((node) => (node.textContent = fields[node.dataset.bind]));
  $$("[data-year]").forEach((node) => (node.textContent = new Date().getFullYear()));
  $("[data-skills]").append(...profile.skills.map((skill) => el("li", { textContent: skill })));
  const iconLink = (label, icon, href, external) => {
    const a = el("a", { className: "icon-btn magnetic", href, ariaLabel: label, title: label }, iconSvg(icon));
    if (external) Object.assign(a, { target: "_blank", rel: "noopener noreferrer" });
    return el("li", {}, a);
  };
  const socialLinks = () => [
    iconLink(`Email ${profile.email}`, "mail", `mailto:${profile.email}`, false),
    ...profile.socials.map((s) => iconLink(s.label, s.icon, s.url, true)),
  ];
  $("[data-socials]").append(...socialLinks());
  $("[data-footer-socials]").append(...socialLinks());
  $$("[data-legal]").forEach((node) => node.append(
    ...[["Privacy", site.privacyUrl], ["Legal Notice", site.legalUrl]]
      .filter(([, url]) => url)
      .map(([label, url]) => el("a", { href: url, textContent: label })),
  ));

  const cards = projects.map((project, i) => {
    const cover = el("div", { className: "cover" });
    cover.style.setProperty("--c1", project.colors[0]);
    cover.style.setProperty("--c2", project.colors[1]);
    cover.append(project.cover
      ? el("img", { src: project.cover, alt: `${project.title} preview`, loading: "lazy", decoding: "async", width: 800, height: 500 })
      : el("span", { className: "cover-title", textContent: project.title, ariaHidden: "true" }));
    cover.append(el("span", { className: "shine", ariaHidden: "true" }), arrowBadge());
    const card = el("a", { className: "project reveal", href: projectPath(project), ariaLabel: `Open project ${project.title}` }, [
      cover,
      el("h3", { textContent: project.title }),
      el("p", { textContent: project.subtitle }),
    ]);
    card.style.setProperty("--d", `${(i % 3) * 90}ms`);
    return card;
  });
  const newCard = el("a", { className: "project project-new reveal", href: "#contact" }, [
    el("div", { className: "cover" }, el("span", { className: "cover-title" }, [
      el("span", { className: "plus", textContent: "+", ariaHidden: "true" }),
      "Let's work together!",
    ])),
    el("h3", { textContent: "Start a new project" }),
    el("p", { textContent: "Have an idea? Let's talk." }),
  ]);
  newCard.style.setProperty("--d", `${(cards.length % 3) * 90}ms`);
  $("[data-projects]").append(...cards, newCard);
}

// Splits the hero name into letters so each can animate in and bounce on hover.
function splitHeroName() {
  let index = 0;
  $$(".hero-name > span").forEach((word) => {
    const text = word.textContent;
    word.setAttribute("aria-label", text);
    word.replaceChildren(...[...text].map((ch) => {
      const letter = el("span", { className: "letter", textContent: ch, ariaHidden: "true" });
      letter.style.setProperty("--i", index++);
      return letter;
    }));
  });
}

// Types out each role in the hero label, then deletes it and moves to the next.
function rotateRoles() {
  const node = $(".role-text");
  if (reducedMotion) {
    node.textContent = profile.roles[0];
    return;
  }
  let index = 0;
  let chars = profile.roles[0].length;
  let deleting = false;
  const tick = () => {
    const role = profile.roles[index];
    chars += deleting ? -1 : 1;
    node.textContent = role.slice(0, chars);
    let delay = deleting ? 35 : 70;
    if (!deleting && chars === role.length) {
      deleting = true;
      delay = 2400;
    } else if (deleting && chars === 0) {
      deleting = false;
      index = (index + 1) % profile.roles.length;
      delay = 300;
    }
    setTimeout(tick, delay);
  };
  deleting = true;
  setTimeout(tick, 3000);
}

// Stage scroll choreography --------------------------------------------------

// Panel text types itself in the first time each panel appears.
function setupTyping() {
  const panels = $$(".panel").map((panel) => {
    const walker = document.createTreeWalker(panel, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) if (walker.currentNode.textContent.trim()) nodes.push(walker.currentNode);
    const texts = nodes.map((n) => n.textContent);
    if (!reducedMotion) nodes.forEach((n) => (n.textContent = ""));
    return { panel, nodes, texts, typed: reducedMotion };
  });
  return (panel) => {
    const entry = panels.find((p) => p.panel === panel);
    if (!entry || entry.typed) return;
    entry.typed = true;
    let node = 0;
    let char = 0;
    const tick = () => {
      if (node >= entry.nodes.length) return;
      char += 2;
      entry.nodes[node].textContent = entry.texts[node].slice(0, char);
      if (char >= entry.texts[node].length) {
        node++;
        char = 0;
      }
      setTimeout(tick, 16);
    };
    tick();
  };
}

function setupStage() {
  const stage = $(".stage");
  const pin = $(".stage-pin");
  const root = document.documentElement;
  const counter = $(".scan-counter");
  const typePanel = setupTyping();
  const panels = [
    [$(".panel-name"), 0.5],
    [$(".panel-bio"), 0.6],
    [$(".panel-skills"), 0.7],
  ];

  // Guarded: with a zero-height viewport (hidden or minimised window) this would be 0/0.
  const rawProgress = () => {
    const track = stage.offsetHeight - innerHeight;
    return track > 0 ? clamp01(-stage.getBoundingClientRect().top / track) : 0;
  };

  // Everything the DOM shows for a given stage progress. Called by the 3D scene
  // every frame (with its smoothed progress) so the card and the render match.
  function apply(p) {
    if (document.body.classList.contains("project-mode")) return;
    const { stand, wipe, scan } = timeline(p);
    const card = cardGeometry(wipe, innerHeight);
    root.style.setProperty("--hero-fade", Math.min(1, stand * 1.6).toFixed(3));
    root.style.setProperty("--card-shift", `${(-card.shift).toFixed(1)}px`);
    root.style.setProperty("--cue-out", Math.min(1, p * 25).toFixed(3));
    document.body.classList.toggle("holo-mode", wipe > 0.6 && stage.getBoundingClientRect().bottom > 80);
    document.body.classList.toggle("hero-gone", wipe > 0.5);
    const pct = Math.round(scan * 100);
    counter.textContent = String(pct).padStart(3, "0");
    counter.classList.toggle("done", pct === 100);
    counter.classList.toggle("show", wipe > 0.95);
    for (const [panel, at] of panels) {
      const show = p >= at;
      panel.classList.toggle("show", show);
      if (show) typePanel(panel);
    }
  }

  let stage3d = null;
  function onScroll() {
    const p = rawProgress();
    if (stage3d) stage3d.setProgress(p);
    else apply(p);
    document.body.classList.toggle("scrolled", scrollY > 40);
    // The scene stops calling apply() once it is off screen, so leave holo mode here too.
    if (stage.getBoundingClientRect().bottom <= 80) document.body.classList.remove("holo-mode");
    // Round the stage's bottom corners as it scrolls away, revealing the page below.
    const leaving = Math.max(0, innerHeight - stage.getBoundingClientRect().bottom);
    pin.style.setProperty("--pin-radius", `${Math.min(48, leaving * 0.4).toFixed(1)}px`);
  }
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll);
  onScroll();

  return {
    apply,
    attach(scene) {
      stage3d = scene;
      onScroll();
    },
    detach() {
      stage3d = null;
      onScroll();
    },
    placeCounter({ x, y }) {
      counter.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`;
    },
  };
}

// Navigation -----------------------------------------------------------------

function setupNav() {
  const nav = $(".nav");
  const links = $$(".nav a");
  const indicator = $(".nav-indicator");
  const stage = $(".stage");
  const sections = { projects: $("#projects"), contact: $("#contact") };
  let current = undefined;
  function moveIndicator(link) {
    if (!link) {
      indicator.style.opacity = "0";
      return;
    }
    indicator.style.opacity = "1";
    indicator.style.width = `${link.offsetWidth}px`;
    indicator.style.transform = `translateX(${link.offsetLeft}px)`;
  }

  const update = () => {
    const mid = innerHeight * 0.5;
    let active = null;
    const stageRect = stage.getBoundingClientRect();
    if (stageRect.top < -innerHeight * 0.6 && stageRect.bottom > mid) active = "about";
    for (const [id, node] of Object.entries(sections)) {
      const r = node.getBoundingClientRect();
      if (r.top < mid && r.bottom > mid) active = id;
    }
    if (innerHeight + scrollY >= document.documentElement.scrollHeight - 4) active = "contact";
    if (active === current) return;
    current = active;
    links.forEach((a) => {
      const on = a.dataset.section === active;
      a.classList.toggle("is-active", on);
      if (on) a.setAttribute("aria-current", "true");
      else a.removeAttribute("aria-current");
    });
    moveIndicator(links.find((a) => a.dataset.section === active));
  };

  // Hovering previews the indicator under the hovered link.
  if (finePointer) {
    links.forEach((a) => a.addEventListener("pointerenter", () => moveIndicator(a)));
    nav.addEventListener("pointerleave", () => moveIndicator(links.find((a) => a.dataset.section === current)));
  }
  addEventListener("scroll", update, { passive: true });
  addEventListener("resize", () => moveIndicator(links.find((a) => a.dataset.section === current)));
  update();
}

// Micro-interactions -------------------------------------------------------------

function setupMagnetic() {
  if (!finePointer || reducedMotion) return;
  $$(".magnetic").forEach((node) => {
    node.addEventListener("pointermove", (e) => {
      const r = node.getBoundingClientRect();
      const x = (e.clientX - r.left - r.width / 2) / r.width;
      const y = (e.clientY - r.top - r.height / 2) / r.height;
      node.style.setProperty("--mx", `${x * 10}px`);
      node.style.setProperty("--my", `${y * 8}px`);
    });
    node.addEventListener("pointerleave", () => {
      node.style.setProperty("--mx", "0px");
      node.style.setProperty("--my", "0px");
    });
  });
}

function setupCardTilt() {
  if (!finePointer || reducedMotion) return;
  $$(".project").forEach((card) => {
    const cover = $(".cover", card);
    card.addEventListener("pointermove", (e) => {
      const r = cover.getBoundingClientRect();
      const x = clamp01((e.clientX - r.left) / r.width);
      const y = clamp01((e.clientY - r.top) / r.height);
      cover.style.setProperty("--rx", `${(0.5 - y) * 8}deg`);
      cover.style.setProperty("--ry", `${(x - 0.5) * 10}deg`);
      cover.style.setProperty("--sx", `${x * 100}%`);
      cover.style.setProperty("--sy", `${y * 100}%`);
    });
    card.addEventListener("pointerleave", () => {
      cover.style.setProperty("--rx", "0deg");
      cover.style.setProperty("--ry", "0deg");
    });
  });
}

function setupReveal() {
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add("is-in");
      observer.unobserve(entry.target);
    }
  }, { rootMargin: "0px 0px -8% 0px" });
  $$(".reveal").forEach((node) => observer.observe(node));
}

let toastTimer;
function toast(message) {
  const node = $(".toast");
  node.textContent = message;
  node.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove("show"), 2200);
}

function setupCopyEmail() {
  const button = $(".copy-btn");
  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(profile.email);
      button.classList.add("copied");
      setTimeout(() => button.classList.remove("copied"), 1200);
      toast("Email copied to clipboard");
    } catch {
      toast(profile.email);
    }
  });
}

function setupSound() {
  const button = $(".sound-btn");
  const stored = (() => {
    try {
      return localStorage.getItem("sound");
    } catch {
      return null;
    }
  })();
  let wanted = stored !== "off";
  const reflect = (on) => {
    button.setAttribute("aria-pressed", String(on));
    button.setAttribute("aria-label", on ? "Turn sound off" : "Turn sound on");
  };
  reflect(wanted);

  // Browsers only allow audio after a user gesture, so start on the first one.
  const firstGesture = (e) => {
    removeEventListener("pointerdown", firstGesture, true);
    removeEventListener("keydown", firstGesture, true);
    if (wanted && !e.target.closest?.(".sound-btn")) audio.set(true);
  };
  addEventListener("pointerdown", firstGesture, true);
  addEventListener("keydown", firstGesture, true);

  button.addEventListener("click", async () => {
    wanted = !audio.on;
    await audio.set(wanted);
    reflect(wanted);
    try {
      localStorage.setItem("sound", wanted ? "on" : "off");
    } catch {}
    toast(wanted ? "Sound on" : "Sound off");
  });
  // Soft click on buttons and links while sound is on.
  document.addEventListener("click", (e) => {
    if (e.target.closest("a, button:not(.sound-btn)")) audio.play("pop");
  });
}

function setupContactScene() {
  const canvas = $(".contact-canvas");
  let started = false;
  const start = async () => {
    if (started || canvas.getBoundingClientRect().top > innerHeight * 1.5) return;
    started = true;
    removeEventListener("scroll", start);
    try {
      const { initContactScene } = await import("./contact-scene.js");
      initContactScene(canvas, { reducedMotion, onWave: () => audio.play("chirp") });
    } catch (error) {
      console.warn("Contact scene unavailable.", error);
    }
  };
  addEventListener("scroll", start, { passive: true });
  start();
}

function setupSpeech() {
  const bubble = $(".speech");
  let shown = "";
  return (speech) => {
    if (!speech) {
      bubble.classList.remove("show");
      shown = "";
      return;
    }
    if (speech.text !== shown) {
      bubble.textContent = speech.text;
      bubble.classList.toggle("sleepy", speech.text.startsWith("z"));
      shown = speech.text;
    }
    bubble.style.transform = `translate(${speech.x}px, ${speech.y}px)`;
    bubble.classList.add("show");
  };
}

// Routing ------------------------------------------------------------------------
// The home page and each project page share one document: /project/<slug> swaps
// the home content for the project view (history API, so back/forward work).

let homeScroll = 0;

function showRoute(path, { restoreTo = null } = {}) {
  const project = findProject(path);
  const body = document.body;
  const wasProject = body.classList.contains("project-mode");
  if (project) {
    if (!wasProject) homeScroll = scrollY;
    renderProject($(".project-view"), project);
    $(".home").hidden = true;
    $(".project-view").hidden = false;
    body.classList.add("project-mode");
    body.classList.remove("holo-mode");
    document.title = `${project.title} — ${fullName}`;
    lenis?.resize();
    scrollToY(0, { immediate: true });
  } else {
    $(".project-view").hidden = true;
    $(".home").hidden = false;
    body.classList.remove("project-mode");
    document.title = site.title;
    lenis?.resize();
    if (wasProject) {
      const y = restoreTo === "projects" ? $("#projects").offsetTop : homeScroll;
      scrollToY(y, { immediate: true });
    }
  }
  // Let the 3D scenes and nav re-measure after the layout change.
  requestAnimationFrame(() => {
    dispatchEvent(new Event("resize"));
    dispatchEvent(new Event("scroll"));
  });
}

function navigate(path, options) {
  if (path === location.pathname) return;
  history.pushState(null, "", path);
  showRoute(path, options);
}

// Where an in-page link (#about, #projects, …) should scroll to.
function anchorY(hash) {
  const stage = $(".stage");
  const stageAt = (f) => stage.offsetTop + (stage.offsetHeight - innerHeight) * f;
  if (hash === "#top" || hash === "#project" || hash === "") return 0;
  if (hash === "#about") return stageAt(0.92); // hologram fully revealed
  if (hash === "#scroll") return stageAt(0.5);
  const target = $(hash);
  return target ? target.getBoundingClientRect().top + scrollY : null;
}

function setupLinks() {
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a[href]");
    if (!a || a.target === "_blank" || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    const href = a.getAttribute("href");
    if (href.startsWith("/") && !href.startsWith("//")) {
      e.preventDefault();
      navigate(href, { restoreTo: "projects" });
    } else if (href.startsWith("#")) {
      e.preventDefault();
      const inProject = document.body.classList.contains("project-mode");
      if (inProject && href !== "#project") {
        navigate("/");
        requestAnimationFrame(() => requestAnimationFrame(() => {
          const y = anchorY(href);
          if (y !== null) scrollToY(y, { immediate: true });
        }));
        return;
      }
      const y = anchorY(href);
      if (y !== null) scrollToY(y);
    }
  });
  addEventListener("popstate", () => showRoute(location.pathname, { restoreTo: "saved" }));
}

// Boot -----------------------------------------------------------------------------

function finishLoading() {
  document.body.classList.remove("is-loading");
}

async function init() {
  renderContent();
  splitHeroName();
  rotateRoles();
  setupNav();
  setupMagnetic();
  setupCardTilt();
  setupReveal();
  setupCopyEmail();
  setupSound();
  setupContactScene();
  setupLinks();
  showRoute(location.pathname);

  const stage = setupStage();
  const fallback = () => {
    document.documentElement.classList.add("no-webgl");
    stage.detach();
    finishLoading();
  };
  // Never keep the loader up for long, even on a slow connection.
  setTimeout(finishLoading, 3500);

  try {
    const { initStage } = await import("./scene.js");
    stage.attach(initStage($(".stage-canvas"), {
      reducedMotion,
      observe: $(".stage"),
      onFrame: stage.apply,
      onSpeech: setupSpeech(),
      onCounter: stage.placeCounter,
      onWave: () => audio.play("chirp"),
      onReady: finishLoading,
      onLost: fallback,
    }));
  } catch (error) {
    console.warn("3D stage unavailable; showing the static version.", error);
    fallback();
  }
}

init();
