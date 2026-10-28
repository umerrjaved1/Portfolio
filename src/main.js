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
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { site, profile, projects } from "./data.js";
import { timeline, cardGeometry } from "./timeline.js";
import { iconSvg } from "./icons.js";
import { createAudio } from "./audio.js";
import { renderProject, findProject, projectPath, createProjectArtwork } from "./project-view.js";
import { initGsapMagnetic, playHeroEntrance, initScrollReveals } from "./animations.js";

gsap.registerPlugin(ScrollTrigger);

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const audio = createAudio();
const fullName = `${profile.firstName} ${profile.lastName}`;

// Smooth inertial scrolling with Lenis coordinated with GSAP ScrollTrigger
const lenis = reducedMotion ? null : new Lenis({ autoRaf: false, lerp: 0.1 });
if (lenis) {
  lenis.on("scroll", () => {
    ScrollTrigger.update();
  });
  gsap.ticker.add((time) => {
    lenis.raf(time * 1000);
  });
  gsap.ticker.lagSmoothing(0);
}

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

function cardOverlay() {
  const overlay = el("div", { className: "preview-card-overlay", ariaHidden: "true" });
  overlay.innerHTML = `
    <div class="preview-card-edge">
      <div class="preview-card-button">
        <svg overflow="visible" viewBox="0 0 256 256" fill="none"><use href="#arrow-path" stroke="currentColor" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </div>
    </div>
    <div class="notch preview-card-notch preview-card-notch-left"><svg viewBox="0 0 256 256" fill="none" shape-rendering="crispEdges"><use href="#notch-path" fill="currentColor"/></svg></div>
    <div class="notch preview-card-notch preview-card-notch-right"><svg viewBox="0 0 256 256" fill="none" shape-rendering="crispEdges"><use href="#notch-path" fill="currentColor"/></svg></div>
  `;
  return overlay;
}

function renderContent() {
  const fields = {
    ...profile,
    fullName: `${profile.firstName} ${profile.lastName}`,
    availability: profile.availability || "Available for Select Contracts",
    tagline: profile.tagline || profile.bio,
  };

  $$("[data-bind]").forEach((node) => {
    if (fields[node.dataset.bind]) {
      node.textContent = fields[node.dataset.bind];
    }
  });

  $$("[data-year]").forEach((node) => (node.textContent = new Date().getFullYear()));

  // Hologram skills list
  const skillsList = $("[data-skills]");
  if (skillsList) {
    skillsList.replaceChildren(...profile.skills.map((skill) => el("li", { textContent: skill })));
  }

  // Social icons
  const iconLink = (label, icon, href, external) => {
    const a = el("a", { className: "icon-btn", href, ariaLabel: label, title: label }, iconSvg(icon));
    a.setAttribute("data-cursor", "circle-white");
    if (external) Object.assign(a, { target: "_blank", rel: "noopener noreferrer" });
    return el("li", {}, a);
  };

  const socialLinks = () => [
    iconLink(`Email ${profile.email}`, "mail", `mailto:${profile.email}`, false),
    ...profile.socials.map((s) => iconLink(s.label, s.icon, s.url, true)),
  ];

  const contactSocials = $("[data-socials]");
  if (contactSocials) contactSocials.replaceChildren(...socialLinks());

  const footerSocials = $("[data-footer-socials]");
  if (footerSocials) footerSocials.replaceChildren(...socialLinks());

  // Footer legal links, shown only once their URLs are filled in data.js
  $$("[data-legal]").forEach((node) => {
    const legal = [
      ["Privacy", site.privacyUrl],
      ["Legal Notice", site.legalUrl],
    ].filter(([, href]) => href);
    node.replaceChildren(...legal.map(([textContent, href]) => {
      const link = el("a", { href, textContent });
      link.setAttribute("data-cursor", "circle-white");
      return link;
    }));
  });

  // Project cards
  const projectCards = projects.map((project, i) => {
    const cover = el("div", { className: "cover" });

    if (project.cover) {
      cover.append(el("img", { src: project.cover, alt: project.title, loading: "lazy", decoding: "async", width: 800, height: 450 }));
    } else {
      cover.append(createProjectArtwork(project, i));
    }

    cover.append(cardOverlay());

    const card = el("a", {
      className: "project reveal",
      href: projectPath(project),
      ariaLabel: `Switch to project ${project.title}`,
    }, [
      cover,
      el("div", { className: "project-content-text" }, [
        el("h3", { textContent: project.title }),
        el("p", { textContent: project.subtitle }),
      ]),
    ]);
    card.setAttribute("data-cursor", "arrow");
    return card;
  });

  const plusIcon = el("div", { className: "cover" });
  plusIcon.innerHTML = `<svg viewBox="0 0 256 256" fill="none" overflow="visible" class="plus-icon"><path d="M128 0V256" stroke="currentColor" stroke-width="18" stroke-linecap="round"/><path d="M0 128L256 128" stroke="currentColor" stroke-width="18" stroke-linecap="round"/></svg>`;

  const newCard = el("a", {
    className: "project project-new reveal",
    href: `mailto:${profile.email}`,
    ariaLabel: "Start a new project",
  }, [
    plusIcon,
    el("div", { className: "project-content-text" }, [
      el("h3", { textContent: "Start a new project" }),
    ]),
  ]);
  newCard.setAttribute("data-cursor", "arrow-external");

  const projectsContainer = $("[data-projects]");
  if (projectsContainer) {
    projectsContainer.replaceChildren(...projectCards, newCard);
  }
}

// Splits the hero name into letters for entrance animation
function splitHeroName() {
  let index = 0;
  // The words are aria-hidden; screen readers read the .sr-only full name instead.
  $$(".hero-name > span[aria-hidden]").forEach((word) => {
    const text = word.textContent;
    word.replaceChildren(...[...text].map((ch) => {
      const letter = el("span", { className: "letter", textContent: ch, ariaHidden: "true" });
      letter.style.setProperty("--i", index++);
      return letter;
    }));
  });
}

// Types out the hero role inside the fixed-width appearing-text banner
function rotateRoles() {
  const node = $(".role-text");
  const clone = $(".role-clone");
  if (!node || !clone) return;
  const roles = profile.roles;
  const widest = roles.reduce((a, b) => (a.length >= b.length ? a : b));
  clone.textContent = `${widest} `;
  node.textContent = roles[0];
  if (reducedMotion || roles.length <= 1) return;

  let index = 0;
  let chars = roles[0].length;
  let deleting = true;

  const tick = () => {
    const role = roles[index];
    chars += deleting ? -1 : 1;
    node.textContent = role.slice(0, chars);
    let delay = deleting ? 32 : 65;
    if (!deleting && chars === role.length) {
      deleting = true;
      delay = 2800;
    } else if (deleting && chars === 0) {
      deleting = false;
      index = (index + 1) % roles.length;
      delay = 260;
    }
    setTimeout(tick, delay);
  };
  setTimeout(tick, 4800);
}

// Stage scroll choreography --------------------------------------------------

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
  const root = document.documentElement;
  const counter = $(".scan-counter");
  const mobileBarFill = $(".progress-count-bar-fill");
  const mobilePct = $(".progress-count-pct");
  const typePanel = setupTyping();
  const panels = [
    [$(".panel-name"), 0.48],
    [$(".panel-bio"), 0.58],
    [$(".panel-skills"), 0.68],
  ];

  const rawProgress = () => {
    const track = stage.offsetHeight - innerHeight;
    return track > 0 ? clamp01(-stage.getBoundingClientRect().top / track) : 0;
  };

  function apply(p) {
    if (document.body.classList.contains("project-mode")) return;
    const { stand, wipe, scan } = timeline(p);
    const card = cardGeometry(wipe, innerHeight);
    root.style.setProperty("--hero-fade", Math.min(1, stand * 1.6).toFixed(3));
    root.style.setProperty("--card-shift", `${(-card.shift).toFixed(1)}px`);
    root.style.setProperty("--cue-out", Math.min(1, p * 25).toFixed(3));
    document.body.classList.toggle("holo-mode", wipe > 0.6 && stage.getBoundingClientRect().bottom > innerHeight * 0.35);
    document.body.classList.toggle("hero-gone", wipe > 0.5);
    const pct = Math.round(scan * 100);
    if (counter) {
      counter.textContent = String(pct).padStart(3, "0");
      counter.classList.toggle("done", pct === 100);
      counter.classList.toggle("show", wipe > 0.95);
    }
    if (mobileBarFill) mobileBarFill.style.width = `${pct}%`;
    if (mobilePct) mobilePct.textContent = `${pct}%`;

    for (const [panel, at] of panels) {
      if (!panel) continue;
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
    if (stage.getBoundingClientRect().bottom <= innerHeight * 0.35) {
      document.body.classList.remove("holo-mode");
    }
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
      if (counter) {
        counter.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`;
      }
    },
  };
}

// Top-Centered Pill Navigation -----------------------------------------------

function setupNav() {
  const links = $$(".nav a");
  const indicator = $(".nav-indicator");
  const stage = $(".stage");
  const sections = {
    top: $("#top"),
    about: $("#about"),
    projects: $("#projects"),
    contact: $("#contact"),
  };
  let current = undefined;

  function moveIndicator(link) {
    if (!indicator) return;
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
    let active = "top";
    const stageRect = stage.getBoundingClientRect();

    if (stageRect.top < -innerHeight * 0.55 && stageRect.bottom > mid) {
      active = "about";
    }

    const projectsRect = sections.projects?.getBoundingClientRect();
    if (projectsRect && projectsRect.top < mid && projectsRect.bottom > mid) {
      active = "projects";
    }

    const contactRect = sections.contact?.getBoundingClientRect();
    if (contactRect && contactRect.top < mid) {
      active = "contact";
    }

    if (innerHeight + scrollY >= document.documentElement.scrollHeight - 60) {
      active = "contact";
    }

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

  addEventListener("scroll", update, { passive: true });
  addEventListener("resize", () => moveIndicator(links.find((a) => a.dataset.section === current)));
  update();
}

// Custom Cursor Follower matching david-hckh.com -----------------------------

function setupCursor() {
  if (!finePointer) return;
  const wrapper = $(".cursor-wrapper");
  const scaleEl = $(".cursor-scale");
  if (!wrapper || !scaleEl) return;

  const cursors = {
    "circle-black": $(".cursor-circle-black", wrapper),
    "circle-white": $(".cursor-circle-white", wrapper),
    "arrow": $(".cursor-arrow", wrapper),
    "arrow-external": $(".cursor-arrow-external", wrapper),
  };

  let activeType = null;
  const setCursorType = (type) => {
    if (type === activeType) return;
    activeType = type;
    for (const [k, node] of Object.entries(cursors)) {
      if (node) node.classList.toggle("cursor-active", k === type);
    }
  };

  addEventListener("pointermove", (e) => {
    wrapper.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
    const target = e.target?.closest?.("[data-cursor]");
    setCursorType(target ? target.getAttribute("data-cursor") : null);
  }, { passive: true });

  addEventListener("pointerdown", () => {
    scaleEl.style.transform = "scale(0.85)";
  });
  addEventListener("pointerup", () => {
    scaleEl.style.transform = "scale(1)";
  });
}

// Sound & Toast Feedback -----------------------------------------------------

let toastTimer;
function toast(message) {
  const node = $(".toast");
  if (!node) return;
  node.textContent = message;
  node.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove("show"), 2400);
}

function setupSound() {
  const button = $(".sound-btn");
  if (!button) return;
  const stored = (() => {
    try {
      return localStorage.getItem("sound");
    } catch {
      return null;
    }
  })();
  let wanted = stored === "on";
  const reflect = (on) => {
    button.setAttribute("aria-pressed", String(on));
    button.setAttribute("aria-label", on ? "Disable sounds" : "Enable sounds");
  };
  reflect(wanted);

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
    toast(wanted ? "Sounds enabled" : "Sounds muted");
  });

  document.addEventListener("click", (e) => {
    if (e.target.closest("a, button:not(.sound-btn)")) audio.play("pop");
  });
}

function setupContactScene() {
  const canvas = $(".contact-canvas");
  if (!canvas) return;
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
  if (!bubble) return () => {};
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

let homeScroll = 0;

// Keeps the canonical URL and share metadata in step with the current route, so
// project pages listed in sitemap.xml don't canonicalize to the home page.
function setPageMeta({ title, description, path }) {
  const url = `${site.url}${path}`;
  document.title = title;
  const set = (selector, attr, value) => $(selector)?.setAttribute(attr, value);
  set('link[rel="canonical"]', "href", url);
  set('meta[property="og:url"]', "content", url);
  set('meta[name="description"]', "content", description);
  set('meta[property="og:description"]', "content", description);
  set('meta[name="twitter:description"]', "content", description);
  set('meta[property="og:title"]', "content", title);
  set('meta[name="twitter:title"]', "content", title);
}

function showRoute(path, { restoreTo = null } = {}) {
  const project = findProject(path);
  const body = document.body;
  const wasProject = body.classList.contains("project-mode");
  if (project) {
    if (!wasProject) homeScroll = scrollY;
    renderProject($(".project-view"), project);
    initGsapMagnetic($(".project-view"));
    $(".home").hidden = true;
    $(".project-view").hidden = false;
    body.classList.add("project-mode");
    body.classList.remove("holo-mode");
    setPageMeta({ title: `${project.title} — ${fullName}`, description: `${project.title}: ${project.subtitle}.`, path: projectPath(project) });
    lenis?.resize();
    scrollToY(0, { immediate: true });
  } else {
    // Unknown paths show the home page, so make the address say so too.
    if (path !== "/") history.replaceState(null, "", `/${location.hash}`);
    $(".project-view").hidden = true;
    $(".home").hidden = false;
    body.classList.remove("project-mode");
    setPageMeta({ title: site.title, description: site.description, path: "/" });
    lenis?.resize();
    if (wasProject) {
      const y = restoreTo === "projects" ? $("#projects").offsetTop : homeScroll;
      scrollToY(y, { immediate: true });
    }
  }
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

function anchorY(hash) {
  const stage = $(".stage");
  const stageAt = (f) => stage.offsetTop + (stage.offsetHeight - innerHeight) * f;
  if (hash === "#top" || hash === "#project" || hash === "") return 0;
  if (hash === "#about") return stageAt(0.92);
  if (hash === "#scroll") return stageAt(0.5);
  const target = $(hash);
  return target ? target.getBoundingClientRect().top + scrollY : null;
}

// Moves keyboard focus along with the scroll, so Tab continues from the section
// a link (e.g. the skip link) jumped to rather than from the top of the page.
function focusSection(hash) {
  if (hash === "#top" || hash === "#scroll" || hash === "#project") return;
  const target = $(hash);
  if (!target) return;
  if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
  target.focus({ preventScroll: true });
}

function setupLinks() {
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a[href]");
    if (!a || a.target === "_blank" || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    const href = a.getAttribute("href");
    // Only the home page and project pages are client-side routes; other
    // same-site links (e.g. a /privacy page) load normally.
    if (href === "/" || findProject(href)) {
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
      focusSection(href);
    }
  });
  addEventListener("popstate", () => showRoute(location.pathname, { restoreTo: "saved" }));
}

// Boot -----------------------------------------------------------------------------

let loaded = false;
function finishLoading() {
  if (loaded) return;
  loaded = true;
  document.body.classList.remove("is-loading");
  playHeroEntrance();
  initScrollReveals();
}

async function init() {
  renderContent();
  splitHeroName();
  rotateRoles();
  setupNav();
  setupCursor();
  setupSound();
  setupContactScene();
  setupLinks();
  showRoute(location.pathname);

  initGsapMagnetic();

  const stage = setupStage();
  const fallback = () => {
    document.documentElement.classList.add("no-webgl");
    stage.detach();
    finishLoading();
  };

  // A project page doesn't use the 3D stage, so don't hold it behind the loader.
  if (findProject(location.pathname)) finishLoading();
  setTimeout(finishLoading, 3000);

  try {
    const { initStage } = await import("./scene.js");
    stage.attach(initStage($(".stage-canvas"), {
      reducedMotion,
      observe: $(".stage"),
      onFrame: stage.apply,
      onSpeech: setupSpeech(),
      onCounter: stage.placeCounter,
      onWave: () => audio.play("chirp"),
      isMusicOn: () => audio.on,
      onToggleMusic: () => $(".sound-btn")?.click(),
      onReady: finishLoading,
      onLost: fallback,
    }));
  } catch (error) {
    console.warn("3D stage unavailable; showing the static version.", error);
    fallback();
  }
}

init();
