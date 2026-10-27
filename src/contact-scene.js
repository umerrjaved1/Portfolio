import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { buildCharacter, clayMaterials, poseArmsCrossed } from "./character.js";
import { rbox, shadowFloor, applyWave, toNdc, renderWhileVisible } from "./three-utils.js";

// Closing scene for the contact section: the developer waits, arms crossed,
// among moving boxes and scattered papers. Head follows the pointer; click to wave.

const WAVE_TIME = 2.2;

function box(w, h, d) {
  const group = new THREE.Group();
  const body = rbox(w, h, d, 0.03, 0xd8b285, { roughness: 0.9 });
  body.position.y = h / 2;
  const tape = rbox(w * 0.22, 0.012, d + 0.004, 0.004, 0xe9cfa8, { roughness: 0.6 });
  tape.position.y = h + 0.002;
  const label = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.3, h * 0.22), new THREE.MeshStandardMaterial({ color: 0xf6f1e7, roughness: 0.9 }));
  label.position.set(w * 0.22, h * 0.68, d / 2 + 0.003);
  group.add(body, tape, label);
  return group;
}

function paper(color = 0xf7f6f2, w = 0.34, d = 0.46) {
  const sheet = new THREE.Mesh(new THREE.BoxGeometry(w, 0.006, d), new THREE.MeshStandardMaterial({ color, roughness: 0.95 }));
  sheet.receiveShadow = true;
  sheet.castShadow = true;
  return sheet;
}

export function initContactScene(canvas, { reducedMotion, onWave }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.5;
  pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xfff4e0, 0xc9a77a, 1.1));
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.2);
  sun.position.set(-3, 7, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.setScalar(1024);
  Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4 });
  sun.shadow.radius = 5;
  scene.add(sun);
  scene.add(shadowFloor(0.14));

  const rig = buildCharacter(clayMaterials());
  poseArmsCrossed(rig);
  rig.root.rotation.y = -0.25;
  scene.add(rig.root);

  // Boxes stacked to the right, papers and envelopes around the feet
  [[1.7, 0, -0.6, 0.8, 0.55, 0.6, 0.2], [2.55, 0, -0.2, 0.7, 0.7, 0.6, -0.15], [1.95, 0.55, -0.55, 0.6, 0.42, 0.5, 0.35], [3.1, 0, 1.0, 0.55, 0.45, 0.5, 0.5]].forEach(([x, y, z, w, h, d, ry]) => {
    const b = box(w, h, d);
    b.position.set(x, y, z);
    b.rotation.y = ry;
    scene.add(b);
  });
  [[-1.4, 0.6, 0.4, 0xf7f6f2], [-0.9, 1.3, -0.6, 0xdbe7f5], [1.1, 1.1, 0.9, 0xf7f6f2], [0.9, 0.25, 2.2, 0xdbe7f5], [-2.2, -0.3, 1.2, 0xf7f6f2], [1.6, 0.95, 1.2, 0xece6da]].forEach(([x, z, ry, color], i) => {
    const sheet = paper(color, i % 2 ? 0.4 : 0.34, i % 2 ? 0.28 : 0.46);
    sheet.position.set(x, 0.004 + i * 0.001, z);
    sheet.rotation.y = ry;
    scene.add(sheet);
  });

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  const target = new THREE.Vector3(0.7, 1.15, 0);
  let size = { w: 1, h: 1 };
  let narrow = false;

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    size = { w, h };
    narrow = w / h < 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  const pointer = new THREE.Vector2();
  const smooth = new THREE.Vector2();
  addEventListener("pointermove", (e) => pointer.set(e.clientX / innerWidth - 0.5, e.clientY / innerHeight - 0.5), { passive: true });

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let clock = 0;
  let waveStart = -Infinity;
  const hits = (e) => {
    raycaster.setFromCamera(toNdc(e, canvas, ndc), camera);
    return raycaster.intersectObject(rig.root, true).length > 0;
  };
  canvas.addEventListener("pointermove", (e) => {
    canvas.style.cursor = e.pointerType === "mouse" && hits(e) ? "pointer" : "";
  });
  canvas.addEventListener("click", (e) => {
    if (hits(e) && clock - waveStart > WAVE_TIME) {
      waveStart = clock;
      onWave?.();
    }
  });

  let last = 0;
  function render(time) {
    const dt = Math.min(0.1, time - last);
    last = time;
    clock = time;
    smooth.lerp(pointer, 1 - Math.exp(-dt * 3));
    const motion = reducedMotion ? 0 : 1;

    // Narrow screens: centre the character; wide: leave room for the heading on the left.
    const dist = narrow ? 11 : 8.4;
    target.x = narrow ? 0.9 : 0.7;
    camera.position.set(target.x + 0.1 + smooth.x * 0.4 * motion, 1.9 - smooth.y * 0.25 * motion, dist);
    camera.lookAt(target);
    camera.setViewOffset(size.w, size.h, narrow ? 0.0 : -size.w * 0.12, narrow ? -size.h * 0.12 : -size.h * 0.04, size.w, size.h);

    poseArmsCrossed(rig);
    rig.body.position.y += Math.sin(time * 1.6) * 0.008 * motion;
    rig.head.rotation.set(smooth.y * 0.4 * motion, 0.25 + smooth.x * 0.9 * motion, Math.sin(time * 0.6) * 0.03 * motion);
    const wave = time - waveStart < WAVE_TIME ? (time - waveStart) / WAVE_TIME : -1;
    if (wave >= 0) applyWave(rig.arms[1], 1, time, wave);

    renderer.render(scene, camera);
  }

  new ResizeObserver(resize).observe(canvas);
  resize();
  renderWhileVisible(renderer, canvas, (ms) => render(ms / 1000));
}
