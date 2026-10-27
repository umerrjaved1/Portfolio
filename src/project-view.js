import { projects } from "./data.js";

// Full-page project view at /project/<slug>: title, tags, description and live
// link, a rounded panel of captioned screenshots, then a "Next project" card.

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

function shot(project, item, index) {
  const figure = el("figure", { className: "pv-shot" });
  if (item.image) {
    figure.append(el("img", { src: item.image, alt: `${project.title}: ${item.caption}`, loading: index ? "lazy" : "eager", decoding: "async" }));
  } else {
    // Placeholder until a real screenshot is added in data.js
    const ph = el("div", { className: "pv-placeholder" }, [
      el("span", { className: "pv-ph-title", textContent: project.title }),
      el("span", { className: "pv-ph-caption", textContent: item.caption }),
    ]);
    ph.style.setProperty("--c1", project.colors[0]);
    ph.style.setProperty("--c2", project.colors[1]);
    figure.append(ph);
  }
  figure.append(el("figcaption", { textContent: item.caption }));
  return figure;
}

export function renderProject(root, project) {
  const next = projects[(projects.indexOf(project) + 1) % projects.length];
  root.style.setProperty("--pv-bg", project.theme);

  const tags = el("ul", { className: "pv-tags" }, project.tags.map((tag) => {
    const li = el("li", { textContent: tag.label });
    li.style.background = tag.color;
    if (tag.ink) li.style.color = tag.ink;
    return li;
  }));
  const intro = el("div", { className: "pv-intro" }, [el("h1", { className: "pv-title", textContent: project.title }), tags]);
  if (project.liveUrl) {
    intro.append(el("a", { className: "pv-live", href: project.liveUrl, target: "_blank", rel: "noopener noreferrer", textContent: "Live view" }));
  }
  const head = el("header", { className: "pv-head container" }, [
    intro,
    el("div", { className: "pv-desc" }, project.description.map((text) => el("p", { textContent: text }))),
  ]);

  const gallery = el("section", { className: "pv-gallery", ariaLabel: "Screenshots" },
    el("div", { className: "pv-gallery-inner" }, project.gallery.map((item, i) => shot(project, item, i))));

  const thumb = el("span", { className: "pv-next-thumb" });
  thumb.style.setProperty("--c1", next.colors[0]);
  thumb.style.setProperty("--c2", next.colors[1]);
  if (next.cover) thumb.append(el("img", { src: next.cover, alt: "" }));
  else thumb.textContent = next.title.split(" ").map((w) => w[0]).join("").slice(0, 2);
  const nextLink = el("a", { className: "pv-next", href: projectPath(next) }, [
    thumb,
    el("span", { className: "pv-next-text" }, [el("small", { textContent: "Next Project:" }), el("strong", { textContent: next.title })]),
    el("span", { className: "pv-next-arrow", ariaHidden: "true", textContent: "›" }),
  ]);

  root.querySelector(".pv-body").replaceChildren(head, gallery, el("div", { className: "container" }, nextLink));
}
