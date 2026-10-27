import { siGithub, siX, siGoogleplay } from "simple-icons";

// 24×24 icon paths for the contact buttons. Brand marks come from Simple Icons
// (CC0); LinkedIn isn't in that set, so it's drawn here as a simple "in" mark.
const LINKEDIN =
  "M4.5 3A1.5 1.5 0 0 0 3 4.5v15A1.5 1.5 0 0 0 4.5 21h15a1.5 1.5 0 0 0 1.5-1.5v-15A1.5 1.5 0 0 0 19.5 3zM7.1 6.2a1.45 1.45 0 1 1 0 2.9 1.45 1.45 0 0 1 0-2.9zM5.9 10.2h2.4V18H5.9zm4 0h2.3v1.1c.4-.7 1.3-1.3 2.6-1.3 2.5 0 3 1.6 3 3.7V18h-2.4v-3.8c0-1-.1-2.1-1.4-2.1s-1.6 1-1.6 2V18H9.9z";
const MAIL = "M3 6.5A1.5 1.5 0 0 1 4.5 5h15A1.5 1.5 0 0 1 21 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5zm2 .9v.3l7 4.6 7-4.6v-.3zm14 2.7-6.45 4.25a1 1 0 0 1-1.1 0L5 10.1V17h14z";
const LINK = "M10.6 13.4a1 1 0 0 1 0-1.4l3.4-3.4a1 1 0 1 1 1.4 1.4L12 13.4a1 1 0 0 1-1.4 0zM8.5 19.5a4 4 0 0 1-2.8-6.8l2-2a1 1 0 0 1 1.4 1.4l-2 2a2 2 0 0 0 2.8 2.8l2-2a1 1 0 1 1 1.4 1.4l-2 2a4 4 0 0 1-2.8 1.2zm7.2-5.2a1 1 0 0 1-.7-1.7l2-2a2 2 0 0 0-2.8-2.8l-2 2a1 1 0 1 1-1.4-1.4l2-2a4 4 0 1 1 5.6 5.6l-2 2a1 1 0 0 1-.7.3z";

export const ICONS = {
  github: siGithub.path,
  x: siX.path,
  playstore: siGoogleplay.path,
  linkedin: LINKEDIN,
  mail: MAIL,
  link: LINK,
};

export function iconSvg(name) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", ICONS[name] ?? ICONS.link);
  path.setAttribute("fill", "currentColor");
  svg.append(path);
  return svg;
}
