import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

export function rbox(w, h, d, r, color, opts = {}) {
  const mesh = new THREE.Mesh(
    new RoundedBoxGeometry(w, h, d, 4, r),
    new THREE.MeshStandardMaterial({ color, roughness: opts.roughness ?? 0.7, metalness: opts.metalness ?? 0 }),
  );
  mesh.castShadow = opts.cast ?? true;
  mesh.receiveShadow = true;
  return mesh;
}

export function canvasTexture(width, height, draw) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const redraw = (...args) => {
    draw(ctx, width, height, ...args);
    texture.needsUpdate = true;
  };
  redraw(0);
  return { texture, redraw };
}

// Invisible floor that only shows shadows. Keep `radius` to the furnished area so
// shadows don't appear floating on the empty background.
export function shadowFloor(opacity = 0.12, radius = 15) {
  const floor = new THREE.Mesh(new THREE.CircleGeometry(radius, 64), new THREE.ShadowMaterial({ opacity }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  return floor;
}

// Raises the arm and wags the forearm; `t` is 0..1 through the wave so the arm
// eases up at the start and back down at the end.
export function applyWave(arm, side, time, t) {
  const lift = Math.sin(Math.min(1, t * 4, (1 - t) * 4) * Math.PI / 2);
  arm.shoulder.rotation.x *= 1 - lift;
  arm.shoulder.rotation.y *= 1 - lift;
  arm.shoulder.rotation.z = THREE.MathUtils.lerp(arm.shoulder.rotation.z, side * 2.6, lift);
  arm.elbow.rotation.x *= 1 - lift;
  arm.elbow.rotation.y *= 1 - lift;
  arm.elbow.rotation.z = side * lift * (0.35 + Math.sin(time * 13) * 0.4);
}

// Pointer → normalized device coordinates for a canvas.
export function toNdc(e, canvas, out) {
  const rect = canvas.getBoundingClientRect();
  return out.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
}

// Starts/stops a renderer's loop depending on whether `el` is on screen. Measured
// directly rather than with IntersectionObserver, which never re-fires for pages
// opened in a background tab.
export function renderWhileVisible(renderer, el, loop) {
  let running = false;
  const check = () => {
    const r = el.getBoundingClientRect();
    const on = !document.hidden && r.bottom > 0 && r.top < innerHeight;
    if (on === running) return;
    running = on;
    renderer.setAnimationLoop(on ? loop : null);
  };
  for (const type of ["scroll", "resize"]) addEventListener(type, check, { passive: true });
  document.addEventListener("visibilitychange", check);
  check();
  return { isRunning: () => running, check };
}
