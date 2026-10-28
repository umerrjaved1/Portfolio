import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { buildCharacter, clayMaterials, poseArmsCrossed, poseCarry, poseRest } from "./character.js";
import { rbox, shadowFloor, applyWave, toNdc, renderWhileVisible } from "./three-utils.js";

// Closing scene: the developer waits among a small moving crew, boxes, and mail.

const WAVE_TIME = 2.2;

function box(w, h, d) {
  const group = new THREE.Group();
  const body = rbox(w, h, d, 0.035, 0xe2c49a, { roughness: 0.9 });
  body.position.y = h / 2;
  const tape = rbox(w * 0.2, 0.014, d + 0.006, 0.004, 0xf0d7b0, { roughness: 0.55 });
  tape.position.y = h + 0.003;
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(w * 0.32, h * 0.24),
    new THREE.MeshStandardMaterial({ color: 0xf7f1e6, roughness: 0.92 }),
  );
  label.position.set(w * 0.18, h * 0.62, d / 2 + 0.003);
  group.add(body, tape, label);
  return group;
}

function envelope(color = 0xf7f6f2, w = 0.48, d = 0.32) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.94, metalness: 0 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, 0.02, d), mat);
  body.castShadow = body.receiveShadow = true;
  const flap = new THREE.Mesh(new THREE.BoxGeometry(w * 0.62, 0.014, w * 0.62), mat);
  flap.rotation.y = Math.PI / 4;
  flap.position.set(0, 0.012, -d * 0.06);
  flap.scale.z = 0.42;
  flap.castShadow = true;
  group.add(body, flap);
  return group;
}

function paper(color = 0xf7f6f2, w = 0.3, d = 0.4) {
  const sheet = new THREE.Mesh(
    new THREE.BoxGeometry(w, 0.006, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.95 }),
  );
  sheet.receiveShadow = sheet.castShadow = true;
  return sheet;
}

function tintedClay(hair) {
  const materials = clayMaterials();
  materials.hair = new THREE.MeshStandardMaterial({ color: hair, roughness: 0.85, metalness: 0 });
  return materials;
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
  scene.environmentIntensity = 0.55;
  pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xfff4e0, 0xc9a77a, 1.15));
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.15);
  sun.position.set(-3, 7, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.setScalar(1024);
  Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5 });
  sun.shadow.radius = 5;
  scene.add(sun);
  scene.add(shadowFloor(0.16, 12));

  const crew = [];

  const host = buildCharacter(clayMaterials());
  poseArmsCrossed(host);
  host.root.rotation.y = -0.2;
  scene.add(host.root);
  crew.push({ rig: host, pose: poseArmsCrossed, phase: 0, look: 1 });

  // Smaller movers tucked among the boxes so the crates stay readable.
  const stacker = buildCharacter(tintedClay(0x5c3d28));
  poseRest(stacker);
  stacker.root.scale.setScalar(0.5);
  stacker.root.position.set(1.22, 0, -0.58);
  stacker.root.rotation.y = 0.35;
  scene.add(stacker.root);
  crew.push({ rig: stacker, pose: poseRest, phase: 1.2, look: 0.3 });

  const carrier = buildCharacter(tintedClay(0x6b4a32));
  poseCarry(carrier);
  carrier.root.scale.setScalar(0.48);
  carrier.root.position.set(1.98, 0, 0.02);
  carrier.root.rotation.y = 0.5;
  scene.add(carrier.root);
  crew.push({ rig: carrier, pose: poseCarry, phase: 2.1, look: 0.22 });

  const sidekick = buildCharacter(tintedClay(0x4a3224));
  poseRest(sidekick);
  sidekick.root.scale.setScalar(0.46);
  sidekick.root.position.set(2.08, 0, 0.88);
  sidekick.root.rotation.y = -0.7;
  scene.add(sidekick.root);
  crew.push({ rig: sidekick, pose: poseRest, phase: 0.6, look: 0.28 });

  const boxes = [
    [1.34, 0, -0.06, 0.92, 0.56, 0.7, 0.16],
    [1.3, 0.56, -0.1, 0.78, 0.5, 0.62, 0.26],
    [2.02, 0, 0.26, 0.74, 0.52, 0.6, -0.12],
    [1.52, 0, 1.0, 0.64, 0.46, 0.54, 0.4],
  ];
  boxes.forEach(([x, y, z, w, h, d, ry]) => {
    const crate = box(w, h, d);
    crate.position.set(x, y, z);
    crate.rotation.y = ry;
    scene.add(crate);
  });

  const carried = box(0.38, 0.28, 0.34);
  carried.position.set(2.08, 0.62, 0.16);
  carried.rotation.y = 0.5;
  scene.add(carried);

  const mailOnBox = envelope(0xf7f6f2, 0.4, 0.26);
  mailOnBox.position.set(1.38, 1.08, 0.02);
  mailOnBox.rotation.set(0, 0.45, 0.05);
  scene.add(mailOnBox);

  const mailOnFront = envelope(0xf7f6f2, 0.34, 0.22);
  mailOnFront.position.set(1.52, 0.48, 1.0);
  mailOnFront.rotation.set(0, 0.2, 0.03);
  scene.add(mailOnFront);

  [
    [-1.35, 0.95, 0.35, 0xf7f6f2, 0.52, 0.34],
    [-0.7, 1.7, 0.85, 0xf4efe6, 0.42, 0.28],
    [0.68, 1.2, 1.9, 0xf7f6f2, 0.4, 0.26],
    [0.95, 0.35, 1.05, 0xe7eef6, 0.38, 0.26],
    [0.18, 2.0, 0.7, 0xf7f6f2, 0.36, 0.24],
    [1.95, 1.28, 0.55, 0xf4efe6, 0.36, 0.24],
    [-0.22, 0.5, -0.5, 0xdbe7f5, 0.34, 0.24],
  ].forEach(([x, z, ry, color, w, d], i) => {
    const mail = envelope(color, w, d);
    mail.position.set(x, 0.012 + i * 0.001, z);
    mail.rotation.y = ry;
    scene.add(mail);
  });

  [
    [-1.55, 0.2, 1.15, 0xf7f6f2],
    [0.48, 1.42, -0.65, 0xdbe7f5],
    [2.28, 0.62, 0.85, 0xf7f6f2],
  ].forEach(([x, z, ry, color], i) => {
    const sheet = paper(color, i === 1 ? 0.4 : 0.3, i === 1 ? 0.28 : 0.4);
    sheet.position.set(x, 0.006, z);
    sheet.rotation.y = ry;
    scene.add(sheet);
  });

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  const target = new THREE.Vector3(0.55, 1.08, 0.1);
  let size = { w: 1, h: 1 };
  let narrow = false;

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    size = { w, h };
    narrow = w / h < 1.05;
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
    return raycaster.intersectObject(host.root, true).length > 0;
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

    const dist = narrow ? 11.4 : 9.05;
    target.x = narrow ? 0.7 : 0.52;
    camera.position.set(target.x + 0.05 + smooth.x * 0.32 * motion, 1.78 - smooth.y * 0.2 * motion, dist);
    camera.lookAt(target);
    camera.setViewOffset(size.w, size.h, narrow ? 0 : -size.w * 0.06, narrow ? -size.h * 0.03 : -size.h * 0.015, size.w, size.h);

    for (const member of crew) {
      member.pose(member.rig);
      member.rig.body.position.y += Math.sin(time * 1.5 + member.phase) * 0.007 * motion;
      member.rig.head.rotation.set(
        smooth.y * 0.28 * motion * member.look,
        0.18 + smooth.x * 0.7 * motion * member.look,
        Math.sin(time * 0.55 + member.phase) * 0.025 * motion,
      );
    }
    const wave = time - waveStart < WAVE_TIME ? (time - waveStart) / WAVE_TIME : -1;
    if (wave >= 0) applyWave(host.arms[1], 1, time, wave);

    renderer.render(scene, camera);
  }

  new ResizeObserver(resize).observe(canvas);
  resize();
  renderWhileVisible(renderer, canvas, (ms) => render(ms / 1000));
}
