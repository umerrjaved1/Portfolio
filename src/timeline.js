// Scroll choreography for the pinned stage, shared by the DOM (main.js) and the
// 3D scene (scene.js) so the cream card and the 3D render always move together.
//
//   0.00 ─ hero: developer typing at the desk
//   0.05 ─ stands up, turns to the camera, camera moves in
//   0.18 ─ cream card slides up, revealing the blue hologram stage below
//   0.38 ─ scan turns the character into a hologram (counter 000 → 100)
//   1.00 ─ stage unpins and scrolls away

export const CARD_RADIUS = 48; // px, rounded bottom corners of the cream card

const clamp01 = (v) => Math.min(1, Math.max(0, v));
export const range = (v, a, b) => clamp01((v - a) / (b - a));
export const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function timeline(p) {
  return {
    stand: ease(range(p, 0.05, 0.17)),
    wipe: ease(range(p, 0.18, 0.34)),
    drop: range(p, 0.22, 0.36),
    scan: range(p, 0.38, 0.9),
  };
}

// Where the bottom edge of the cream card sits (px from the top of the viewport),
// and how far its contents have been pushed up.
export function cardGeometry(wipe, viewportHeight) {
  const height = viewportHeight + CARD_RADIUS;
  const shift = wipe * (height + 12);
  return { shift, edge: height - shift };
}
