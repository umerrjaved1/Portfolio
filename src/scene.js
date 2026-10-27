import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { buildCharacter, clayMaterials, poseSitting, poseStanding, blendPose, SEAT_DROP } from "./character.js";
import { rbox, canvasTexture, shadowFloor, applyWave, toNdc, renderWhileVisible } from "./three-utils.js";
import { timeline, cardGeometry, ease, range } from "./timeline.js";

// One canvas, two acts. The room is drawn inside the cream card; as the card
// slides up (see timeline.js) the hologram stage is drawn in the area it uncovers.
// Each act has its own camera and is rendered with a scissor rectangle.

const HOLO_COLOR = new THREE.Color(0x6fd6ff);

// Monitor screens -----------------------------------------------------------

const CODE = [
  [["#c792ea", 5], ["#82aaff", 9], ["#e6e6e6", 3]],
  [["#e6e6e6", 2], ["#c792ea", 4], ["#ffcb6b", 12], ["#e6e6e6", 2]],
  [["#e6e6e6", 4], ["#82aaff", 7], ["#c3e88d", 14]],
  [["#e6e6e6", 4], ["#c792ea", 3], ["#f78c6c", 6], ["#e6e6e6", 6]],
  [["#e6e6e6", 6], ["#3ddc84", 10], ["#e6e6e6", 3]],
  [["#e6e6e6", 6], ["#82aaff", 5], ["#c3e88d", 18]],
  [["#e6e6e6", 4], ["#e6e6e6", 1]],
  [["#e6e6e6", 2], ["#c792ea", 3], ["#ffcb6b", 9], ["#e6e6e6", 4]],
  [["#e6e6e6", 4], ["#82aaff", 8], ["#e6e6e6", 2], ["#f78c6c", 5]],
  [["#e6e6e6", 4], ["#c3e88d", 16]],
  [["#e6e6e6", 2], ["#e6e6e6", 1]],
];

function drawEditor(ctx, w, h, chars) {
  ctx.fillStyle = "#1f2128";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#17181d";
  ctx.fillRect(0, 0, 70, h);
  ctx.fillStyle = "#2a2d36";
  ctx.fillRect(0, 0, w, 34);
  ["#ff5f56", "#ffbd2e", "#27c93f"].forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(20 + i * 20, 17, 6, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.fillStyle = "#3ddc84";
  ctx.fillRect(90, 10, 120, 14);
  let budget = chars;
  CODE.forEach((line, row) => {
    let x = 90 + (row % 3 === 0 ? 0 : 0);
    const y = 54 + row * 28;
    ctx.fillStyle = "#4a4d57";
    ctx.fillRect(28, y, 18, 12);
    for (const [color, len] of line) {
      const shown = Math.min(len, budget);
      if (shown <= 0) return;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, shown * 9 - 3, 12);
      x += len * 9 + 6;
      budget -= len;
    }
  });
}

function drawChat(ctx, w, h, step) {
  ctx.fillStyle = "#14161c";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#b69cff";
  ctx.beginPath();
  ctx.arc(34, 30, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e6e6e6";
  ctx.fillRect(58, 22, 130, 14);
  const bubbles = [
    { me: true, w: 220, color: "#3ddc84" },
    { me: false, w: 300, color: "#2c2f3a", lines: 2 },
    { me: false, w: 200, color: "#1f3b52", lines: 1 },
    { me: true, w: 160, color: "#3ddc84" },
    { me: false, w: 280, color: "#2c2f3a", lines: 2 },
  ];
  let y = 64;
  bubbles.slice(0, 1 + (step % bubbles.length)).forEach((b) => {
    const bh = 22 + (b.lines ?? 1) * 18;
    const x = b.me ? w - b.w - 20 : 20;
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.roundRect(x, y, b.w, bh, 14);
    ctx.fill();
    ctx.fillStyle = b.me ? "rgba(6,33,15,.55)" : "rgba(230,230,230,.6)";
    for (let i = 0; i < (b.lines ?? 1); i++) ctx.fillRect(x + 14, y + 14 + i * 18, b.w - 40 - i * 30, 9);
    y += bh + 12;
  });
}

function roundedRectShape(width, height, radius) {
  const x = -width / 2;
  const y = -height / 2;
  const shape = new THREE.Shape();
  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + height - radius);
  shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  shape.lineTo(x + radius, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);
  return shape;
}

// Room ----------------------------------------------------------------------

function buildRoom() {
  const room = new THREE.Group();

  room.add(shadowFloor(0.12, 3.6));

  const mat = (color, roughness = 0.7, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const mesh = (geometry, material, [x, y, z] = [0, 0, 0], parent = room) => {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };

  // Rug: rounded square rings, turned 45° so it reads as a diamond from the camera.
  const rug = new THREE.Group();
  rug.position.set(0.1, 0, -0.15);
  rug.rotation.y = Math.PI / 4;
  [[5.4, 0xef8f2f], [4.5, 0xf6c95e], [3.6, 0xf0a13c], [2.7, 0xf8de8a]].forEach(([size, color], i) => {
    const slab = new THREE.Mesh(
      new THREE.ExtrudeGeometry(roundedRectShape(size, size, size * 0.09), { depth: 0.025, bevelEnabled: false, curveSegments: 10 }),
      mat(color, 0.95),
    );
    slab.rotation.x = -Math.PI / 2;
    slab.position.y = 0.005 + i * 0.012;
    slab.receiveShadow = true;
    rug.add(slab);
  });
  room.add(rug);

  // Desk
  const wood = 0xe7c48e;
  const desk = new THREE.Group();
  desk.position.set(0, 0, -0.95);
  const top = rbox(3.6, 0.13, 1.3, 0.06, 0xfbf9f4, { roughness: 0.45 });
  top.position.y = 0.95;
  desk.add(top);
  for (const [x, z] of [[-1.6, -0.48], [1.6, -0.48], [-1.6, 0.48], [1.6, 0.48]]) {
    mesh(new THREE.CylinderGeometry(0.06, 0.045, 0.9, 14), mat(wood, 0.6), [x, 0.45, z], desk);
  }
  room.add(desk);

  // Monitors with chunky rounded bezels
  const screens = [];
  [
    { x: -0.62, z: -1.2, ry: 0.22, tex: canvasTexture(512, 320, drawEditor) },
    { x: 0.66, z: -1.22, ry: -0.12, tex: canvasTexture(512, 320, drawChat) },
  ].forEach(({ x, z, ry, tex }) => {
    const mon = new THREE.Group();
    mon.position.set(x, 1.01, z);
    mon.rotation.y = ry;
    const frame = rbox(1.2, 0.78, 0.1, 0.08, 0x4a4656, { roughness: 0.45 });
    frame.position.y = 0.66;
    mon.add(frame);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.06, 0.64), new THREE.MeshBasicMaterial({ map: tex.texture, toneMapped: false }));
    screen.position.set(0, 0.67, 0.052);
    mon.add(screen);
    const neck = rbox(0.1, 0.32, 0.06, 0.03, 0x3c3946);
    neck.position.set(0, 0.17, -0.05);
    mon.add(neck);
    const base = rbox(0.42, 0.035, 0.26, 0.017, 0x3c3946);
    base.position.y = 0.018;
    mon.add(base);
    room.add(mon);
    screens.push(tex);
  });

  // Desk items
  const keyboard = rbox(0.92, 0.04, 0.28, 0.02, 0xf4f3f0, { roughness: 0.4 });
  keyboard.position.set(0, 1.03, -0.6);
  room.add(keyboard);
  const mouse = rbox(0.1, 0.045, 0.16, 0.035, 0xf4f3f0, { roughness: 0.4 });
  mouse.position.set(0.68, 1.03, -0.58);
  room.add(mouse);

  const cup = mesh(new THREE.CylinderGeometry(0.1, 0.09, 0.2, 24), mat(0xe8d8c4, 0.6), [-1.22, 1.12, -0.72]);
  [[0x7fb7e6, -0.03, 0.12], [0xe5677a, 0.04, -0.15]].forEach(([color, dx, tilt]) => {
    const pencil = new THREE.Group();
    pencil.position.set(-1.22 + dx, 1.2, -0.72);
    pencil.rotation.z = tilt;
    mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.32, 8), mat(color, 0.5), [0, 0.12, 0], pencil);
    mesh(new THREE.ConeGeometry(0.018, 0.06, 8), mat(0xf3d9b1, 0.6), [0, 0.31, 0], pencil);
    room.add(pencil);
  });
  cup.castShadow = true;

  // Little Android robot figure
  const droid = new THREE.Group();
  const green = mat(0x3ddc84, 0.45);
  mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.17, 24), green, [0, 0.085, 0], droid);
  mesh(new THREE.SphereGeometry(0.12, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), green, [0, 0.19, 0], droid);
  for (const s of [-1, 1]) {
    const ant = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.08, 6), green, [s * 0.055, 0.33, 0], droid);
    ant.rotation.z = -s * 0.4;
    mesh(new THREE.SphereGeometry(0.013, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }), [s * 0.045, 0.25, 0.1], droid);
  }
  droid.position.set(-1.55, 1.01, -1.0);
  droid.rotation.y = 0.3;
  room.add(droid);

  // Blue grid cube and an orange speaker on the right
  const gridTex = canvasTexture(64, 64, (ctx, w, h) => {
    ctx.fillStyle = "#4f8fe8";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#e9f2ff";
    ctx.lineWidth = 4;
    for (let i = 1; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo((i * w) / 3, 0);
      ctx.lineTo((i * w) / 3, h);
      ctx.moveTo(0, (i * h) / 3);
      ctx.lineTo(w, (i * h) / 3);
      ctx.stroke();
    }
  });
  const cube = mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), new THREE.MeshStandardMaterial({ map: gridTex.texture, roughness: 0.4 }), [1.18, 1.12, -0.55]);
  cube.rotation.y = 0.5;
  const speaker = new THREE.Group();
  const box = rbox(0.28, 0.32, 0.22, 0.05, 0xf29a2e, { roughness: 0.5 });
  box.position.y = 0.16;
  speaker.add(box);
  mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.02, 24), mat(0x3a3a45, 0.4), [0, 0.18, 0.11], speaker).rotation.x = Math.PI / 2;
  mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.012, 24), mat(0xf6f1e6, 0.5), [0, 0.18, 0.105], speaker).rotation.x = Math.PI / 2;
  speaker.position.set(1.55, 1.01, -0.85);
  speaker.rotation.y = -0.35;
  room.add(speaker);

  // Cantilever chair: white shell on a bent chrome tube frame
  const chair = new THREE.Group();
  chair.position.set(0, 0, 0.12);
  const shell = mat(0xfbfaf7, 0.45);
  const seat = rbox(0.72, 0.09, 0.64, 0.045, 0xfbfaf7, { roughness: 0.45 });
  seat.position.y = 0.45;
  chair.add(seat);
  const back = rbox(0.72, 0.66, 0.08, 0.06, 0xfbfaf7, { roughness: 0.45 });
  back.position.set(0, 0.86, 0.33);
  back.rotation.x = -0.14;
  back.material = shell;
  chair.add(back);
  const chrome = mat(0xc9ccd3, 0.25, 0.85);
  for (const x of [-0.3, 0.3]) {
    const path = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x, 0.03, 0.34),
      new THREE.Vector3(x, 0.03, -0.24),
      new THREE.Vector3(x, 0.1, -0.36),
      new THREE.Vector3(x, 0.36, -0.28),
      new THREE.Vector3(x, 0.41, -0.18),
      new THREE.Vector3(x, 0.41, 0.24),
      new THREE.Vector3(x, 0.6, 0.31),
      new THREE.Vector3(x, 0.85, 0.36),
    ]);
    mesh(new THREE.TubeGeometry(path, 64, 0.022, 10), chrome, [0, 0, 0], chair);
  }
  const rail = mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.6, 10), chrome, [0, 0.03, 0.34], chair);
  rail.rotation.z = Math.PI / 2;
  room.add(chair);

  // Floating shelf with books and a small cactus
  const shelf = new THREE.Group();
  shelf.position.set(-1.35, 2.42, -1.7);
  shelf.add(rbox(1.2, 0.08, 0.36, 0.03, wood));
  [[0x9aa3b5, 0.42, -0.42], [0xb7bfcc, 0.4, -0.33], [0xf09a36, 0.46, -0.2], [0xf2a94d, 0.44, -0.08]].forEach(([c, h, x]) => {
    const book = rbox(0.1, h, 0.3, 0.015, c);
    book.position.set(x, h / 2 + 0.04, 0);
    shelf.add(book);
  });
  mesh(new THREE.CylinderGeometry(0.13, 0.1, 0.2, 24), mat(0xffffff, 0.5), [0.3, 0.14, 0], shelf);
  mesh(new THREE.CapsuleGeometry(0.065, 0.16, 6, 12), mat(0x7cc142, 0.6), [0.3, 0.36, 0], shelf);
  mesh(new THREE.CapsuleGeometry(0.035, 0.06, 6, 10), mat(0x7cc142, 0.6), [0.37, 0.36, 0.02], shelf).rotation.z = -0.9;
  room.add(shelf);

  // Corkboard with notes and push pins
  const board = new THREE.Group();
  board.position.set(0.9, 2.68, -1.9);
  board.add(rbox(2.0, 1.32, 0.09, 0.07, 0xead7b0));
  const cork = new THREE.Mesh(new THREE.PlaneGeometry(1.78, 1.1), mat(0xa58466, 1));
  cork.position.z = 0.047;
  board.add(cork);
  const note = (color) =>
    canvasTexture(128, 140, (ctx, w, h) => {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "rgba(60, 70, 90, .35)";
      for (let i = 0; i < 4; i++) ctx.fillRect(18, 52 + i * 18, 70 + ((i * 23) % 30), 6);
    }).texture;
  [[-0.5, 0.12, "#bcd6f2", 0.08], [0.48, -0.2, "#f7f5ef", -0.1]].forEach(([x, y, color, rz]) => {
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.58), new THREE.MeshStandardMaterial({ map: note(color), roughness: 0.9 }));
    sheet.position.set(x, y, 0.052);
    sheet.rotation.z = rz;
    board.add(sheet);
    mesh(new THREE.SphereGeometry(0.085, 20, 16), mat(0xe25563, 0.35), [x - 0.08, y + 0.2, 0.12], board);
    mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.05, 16), mat(0xd04a58, 0.35), [x - 0.08, y + 0.2, 0.07], board).rotation.x = Math.PI / 2;
  });
  room.add(board);

  // Framed picture on the right
  const pictureTex = canvasTexture(256, 192, (ctx, w, h) => {
    ctx.fillStyle = "#cfe0f6";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(w * 0.68, h * 0.32, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(w * 0.32, h * 0.38);
    ctx.lineTo(w * 0.6, h);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(w * 0.42, h);
    ctx.lineTo(w * 0.7, h * 0.55);
    ctx.lineTo(w, h);
    ctx.fill();
  });
  const picture = new THREE.Group();
  picture.position.set(2.6, 2.2, -1.45);
  picture.rotation.y = -0.45;
  picture.add(rbox(1.05, 0.8, 0.1, 0.08, 0x8db2e4, { roughness: 0.5 }));
  const art = new THREE.Mesh(new THREE.PlaneGeometry(0.84, 0.6), new THREE.MeshStandardMaterial({ map: pictureTex.texture, roughness: 0.8 }));
  art.position.z = 0.052;
  picture.add(art);
  room.add(picture);

  // Big potted plant on the floor, to the right of the desk
  const plant = new THREE.Group();
  plant.position.set(2.35, 0, 0.35);
  mesh(new THREE.CylinderGeometry(0.34, 0.27, 0.62, 32), mat(0xf4efe6, 0.6), [0, 0.31, 0], plant);
  mesh(new THREE.CylinderGeometry(0.345, 0.32, 0.14, 32), mat(0xb59a7c, 0.7), [0, 0.3, 0], plant);
  mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.03, 32), mat(0x6e5440, 0.9), [0, 0.6, 0], plant);
  const leafMat = mat(0x86c93a, 0.55);
  [[0, 0.2], [1.2, 0.35], [2.3, 0.25], [3.4, 0.4], [4.5, 0.3], [5.5, 0.38]].forEach(([a, lean], i) => {
    const leaf = new THREE.Group();
    leaf.position.y = 0.6;
    leaf.rotation.set(0, a, lean + 0.15);
    const blade = mesh(new THREE.SphereGeometry(0.2, 20, 14), leafMat, [0, 0.55 + (i % 2) * 0.12, 0], leaf);
    blade.scale.set(0.55, 3.0, 0.16);
    plant.add(leaf);
  });
  room.add(plant);

  // The developer, seated and typing
  const rig = buildCharacter(clayMaterials());
  poseSitting(rig);
  rig.root.position.set(0, SEAT_DROP, 0.02);
  rig.root.rotation.y = Math.PI;
  room.add(rig.root);

  return { room, rig, screens, chair };
}

// Hologram stage --------------------------------------------------------------

function hologramMaterial(uniforms, clippingPlanes) {
  return new THREE.ShaderMaterial({
    uniforms,
    clipping: true,
    clippingPlanes,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      #include <clipping_planes_pars_vertex>
      varying vec3 vNormal;
      varying vec3 vWorldPos;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
        vNormal = normalize(mat3(modelMatrix) * normal);
        vec4 mvPosition = viewMatrix * worldPos;
        #include <clipping_planes_vertex>
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      #include <clipping_planes_pars_fragment>
      uniform vec3 uColor;
      uniform float uTime;
      uniform float uOpacity;
      varying vec3 vNormal;
      varying vec3 vWorldPos;
      void main() {
        #include <clipping_planes_fragment>
        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        float fresnel = pow(1.0 - abs(dot(normalize(vNormal), viewDir)), 2.0);
        float stripes = smoothstep(0.35, 0.6, sin(vWorldPos.y * 90.0 - uTime * 5.0) * 0.5 + 0.5);
        float flicker = 0.9 + 0.1 * sin(uTime * 37.0) * sin(uTime * 13.0);
        float alpha = (0.12 + fresnel * 0.95 + stripes * 0.12) * flicker * uOpacity;
        gl_FragColor = vec4(uColor * (0.5 + fresnel * 1.6), alpha);
      }
    `,
  });
}

const STAND_Y = 0.42; // top of the platform

function buildHoloStage() {
  const stage = new THREE.Group();
  const uniforms = { uColor: { value: HOLO_COLOR }, uTime: { value: 0 }, uOpacity: { value: 1 } };

  const grid = new THREE.GridHelper(40, 48, 0x7cc7ff, 0x7cc7ff);
  grid.material.transparent = true;
  grid.material.opacity = 0.14;
  stage.add(grid);

  // Dark base with a glowing disc on top; the scan counter sits on the base's front.
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.92, 1.0, 0.3, 72),
    new THREE.MeshStandardMaterial({ color: 0x0b1f55, metalness: 0.55, roughness: 0.4 }),
  );
  base.position.y = 0.15;
  stage.add(base);
  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(0.76, 0.8, 0.12, 72),
    new THREE.MeshStandardMaterial({ color: 0x1b4fb8, metalness: 0.4, roughness: 0.3, emissive: 0x1a5fd0, emissiveIntensity: 0.7 }),
  );
  disc.position.y = 0.36;
  stage.add(disc);
  const glow = (r, tube, opacity, y) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(r, tube, 8, 96),
      new THREE.MeshBasicMaterial({ color: HOLO_COLOR, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    stage.add(ring);
    return ring;
  };
  glow(0.76, 0.022, 0.95, STAND_Y);
  glow(0.58, 0.008, 0.5, STAND_Y + 0.002);
  glow(0.95, 0.01, 0.35, 0.3);
  const counterAnchor = new THREE.Object3D();
  counterAnchor.position.set(0, 0.15, 1.0);
  stage.add(counterAnchor);

  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.7, 0.76, 2.8, 64, 1, true),
    new THREE.ShaderMaterial({
      uniforms: { uColor: { value: HOLO_COLOR } },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: "uniform vec3 uColor; varying vec2 vUv; void main(){ gl_FragColor = vec4(uColor, pow(1.0 - vUv.y, 2.5) * 0.2); }",
    }),
  );
  beam.position.y = STAND_Y + 1.4;
  stage.add(beam);

  // Rising sparks inside the beam
  const sparkCount = 110;
  const sparkPos = new Float32Array(sparkCount * 3);
  const sparkSeed = new Float32Array(sparkCount);
  for (let i = 0; i < sparkCount; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * 0.7;
    sparkPos.set([Math.cos(a) * r, Math.random() * 2.8, Math.sin(a) * r], i * 3);
    sparkSeed[i] = 0.2 + Math.random() * 0.5;
  }
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute("position", new THREE.BufferAttribute(sparkPos, 3));
  const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({
    color: HOLO_COLOR, size: 0.035, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  sparks.position.y = STAND_Y;
  stage.add(sparks);

  // Two copies of the character: solid above the scan line, hologram below it.
  const scanPlaneSolid = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const scanPlaneHolo = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
  const solidMats = clayMaterials();
  Object.values(solidMats).forEach((m) => (m.clippingPlanes = [scanPlaneSolid]));
  const solid = buildCharacter(solidMats);
  const holoMat = hologramMaterial(uniforms, [scanPlaneHolo]);
  const holo = buildCharacter(new Proxy({}, { get: () => holoMat }));
  for (const rig of [solid, holo]) {
    poseStanding(rig);
    rig.root.position.y = STAND_Y;
    stage.add(rig.root);
  }

  const scanRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.42, 0.01, 8, 96),
    new THREE.MeshBasicMaterial({ color: 0xbff0ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  scanRing.rotation.x = Math.PI / 2;
  stage.add(scanRing);

  const HEIGHT = 2.36; // character height
  function setScan(progress) {
    const y = STAND_Y - 0.08 + progress * (HEIGHT + 0.16);
    scanPlaneSolid.constant = -y;
    scanPlaneHolo.constant = y;
    scanRing.position.y = y;
    scanRing.visible = progress > 0.01 && progress < 0.99;
    scanRing.scale.setScalar(0.8 + Math.sin(clamp((y - STAND_Y) / HEIGHT) * Math.PI) * 0.45);
  }

  // `look` is the smoothed pointer (-0.5..0.5); `wave` is 0..1 progress of a wave, or -1;
  // `drop` is 0..1 as the character falls onto the platform.
  function update(time, look, wave, drop) {
    uniforms.uTime.value = time;
    const pos = sparkGeo.attributes.position;
    for (let i = 0; i < sparkCount; i++) pos.setY(i, (pos.getY(i) + sparkSeed[i] * 0.01) % 2.8);
    pos.needsUpdate = true;

    const fall = 1 - ease(drop);
    const land = drop > 0.85 ? Math.sin(((drop - 0.85) / 0.15) * Math.PI) : 0; // squash on landing
    for (const rig of [solid, holo]) {
      poseStanding(rig);
      rig.root.position.y = STAND_Y + fall * 3;
      rig.body.position.y += Math.sin(time * 1.6) * 0.01 - land * 0.06;
      rig.legs.forEach((leg) => {
        leg.hip.rotation.x = -land * 0.35;
        leg.knee.rotation.x = land * 0.7;
      });
      rig.head.rotation.set(look.y * 0.45, look.x * 0.9 + Math.sin(time * 0.5) * 0.06, Math.sin(time * 0.7) * 0.03);
      if (wave >= 0) applyWave(rig.arms[1], 1, time, wave);
    }
    // The solid copy is clipped away above the scan line, so it's what gets hovered/clicked.
  }

  return { stage, setScan, update, rig: solid, counterAnchor, setVisible: (v) => (stage.visible = v) };
}

const clamp = (v) => Math.min(1, Math.max(0, v));

// Main --------------------------------------------------------------------------

const SLEEP_AFTER = 20; // seconds without input before the developer dozes off
const WAVE_TIME = 2.2;
const ROOM_FACE_CAMERA = -0.25; // yaw that turns the standing developer toward the camera

/**
 * @param {HTMLCanvasElement} canvas
 * @param {object} options
 * @param {boolean} options.reducedMotion
 * @param {Element} options.observe   element whose visibility gates rendering
 * @param {(p: number) => void} options.onFrame   smoothed stage progress, every frame
 * @param {(speech: {text: string, x: number, y: number} | null) => void} options.onSpeech
 * @param {(pos: {x: number, y: number}) => void} options.onCounter  screen position for the scan counter
 * @param {() => void} options.onWave  called when a visitor makes the character wave
 * @param {() => void} options.onReady  called after the first frame is drawn
 * @param {() => void} options.onLost   called if the WebGL context is lost
 */
export function initStage(canvas, { reducedMotion, observe, onFrame, onSpeech, onCounter, onWave, onReady, onLost }) {
  const small = Math.min(window.innerWidth, window.innerHeight) < 700;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !small || devicePixelRatio < 2, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, small ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.localClippingEnabled = true;
  renderer.autoClear = false;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  pmrem.dispose();

  scene.add(new THREE.HemisphereLight(0xfff4e0, 0xc9a77a, 1.1));
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.4);
  sun.position.set(-2.5, 12, 6); // high sun: short shadows that stay on the rug
  sun.castShadow = true;
  sun.shadow.mapSize.setScalar(small ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5 });
  sun.shadow.bias = -0.0005;
  sun.shadow.radius = 6;
  scene.add(sun);
  const holoLight = new THREE.PointLight(0x6fd6ff, 6, 8);
  holoLight.position.set(0, 1.6, 2);
  scene.add(holoLight);

  const { room, rig, screens, chair } = buildRoom();
  scene.add(room);
  const holo = buildHoloStage();
  scene.add(holo.stage);

  const roomCam = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  const holoCam = new THREE.PerspectiveCamera(30, 1, 0.1, 100);

  // Framing. `hero` is the opening shot (close, room cropped on the right like a
  // photo), `close` is where the camera ends up as the developer stands.
  const views = {
    heroDir: new THREE.Vector3(-2.0, 4.3, 8.0).normalize(),
    heroTarget: new THREE.Vector3(0.45, 1.3, -0.45),
    heroDist: 7.3,
    closeTarget: new THREE.Vector3(0.9, 1.45, 0.55),
    closeDist: 6.9,
    holoTarget: new THREE.Vector3(0, 1.4, 0),
    holoDist: 8.2,
  };
  let shift = { x: 0.12, y: 0.06 };
  let size = { w: 1, h: 1 };

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    size = { w, h };
    renderer.setSize(w, h, false);
    const aspect = w / h;
    const halfTan = Math.tan(THREE.MathUtils.degToRad(roomCam.fov / 2));
    const fitWidth = (width) => width / (2 * halfTan * aspect);
    views.heroDist = Math.max(7.3, fitWidth(aspect < 1 ? 3.7 : 6.4));
    views.closeDist = Math.max(6.9, fitWidth(2.8));
    views.holoDist = Math.max(8.2, fitWidth(aspect < 1 ? 4.2 : 3.6));
    // Push the room right of the name; narrower screens need a bigger push.
    shift = aspect >= 1 ? { x: Math.min(0.24, Math.max(0.15, 0.32 - 0.08 * aspect)), y: -0.13 } : { x: 0, y: -0.2 };
    for (const cam of [roomCam, holoCam]) {
      cam.aspect = aspect;
      cam.updateProjectionMatrix();
    }
  }

  // Input ----------------------------------------------------------------------
  const pointer = new THREE.Vector2();
  const smoothPointer = new THREE.Vector2();
  const ndc = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();
  let clock = 0;
  let lastActivity = 0;
  let waveStart = -Infinity;
  let sleeping = false;
  let wokeAt = -Infinity;
  let edge = Infinity; // px from top where the cream card ends

  const activity = () => {
    lastActivity = clock;
    if (sleeping) {
      sleeping = false;
      wokeAt = clock;
    }
  };
  addEventListener("pointermove", (e) => {
    pointer.set(e.clientX / innerWidth - 0.5, e.clientY / innerHeight - 0.5);
    activity();
  }, { passive: true });
  for (const type of ["scroll", "keydown", "touchstart"]) addEventListener(type, activity, { passive: true });

  // Which act is under a given screen y, and its character + camera.
  function actAt(clientY) {
    const y = clientY - canvas.getBoundingClientRect().top;
    return y < edge ? { rig, cam: roomCam } : { rig: holo.rig, cam: holoCam };
  }
  function hitsCharacter(e) {
    const act = actAt(e.clientY);
    raycaster.setFromCamera(toNdc(e, canvas, ndc), act.cam);
    return raycaster.intersectObject(act.rig.root, true).length > 0;
  }
  canvas.addEventListener("pointermove", (e) => {
    canvas.style.cursor = e.pointerType === "mouse" && hitsCharacter(e) ? "pointer" : "";
  });
  canvas.addEventListener("click", (e) => {
    if (hitsCharacter(e) && clock - waveStart > WAVE_TIME) {
      waveStart = clock;
      onWave?.();
    }
  });

  // Screen projection helpers ---------------------------------------------------
  const tmp = new THREE.Vector3();
  const toScreen = (v, cam) => {
    v.project(cam);
    return { x: (v.x * 0.5 + 0.5) * size.w, y: (-v.y * 0.5 + 0.5) * size.h };
  };
  function speechFor(currentRig, cam, text) {
    currentRig.head.getWorldPosition(tmp);
    tmp.y += 0.55;
    return { text, ...toScreen(tmp, cam) };
  }

  // Render loop ------------------------------------------------------------------
  let target = 0;
  let progress = 0;
  const camPos = new THREE.Vector3();
  const lookAt = new THREE.Vector3();
  const look = new THREE.Vector2();
  let typingStep = 0;
  let lastTime = 0;
  let lastSpeech = "";
  let ready = false;

  function render(time) {
    // Frame-rate independent damping, so slow devices keep up with the scroll.
    const dt = Math.min(0.1, Math.max(0, time - lastTime));
    lastTime = time;
    clock = time;
    progress += (target - progress) * (reducedMotion ? 1 : 1 - Math.exp(-dt * 7));
    if (!Number.isFinite(progress)) progress = target;
    if (Math.abs(target - progress) > 0.25) progress = target - Math.sign(target - progress) * 0.25;
    smoothPointer.lerp(pointer, 1 - Math.exp(-dt * 3));
    onFrame?.(progress);

    const { stand, wipe, drop, scan } = timeline(progress);
    const card = cardGeometry(wipe, size.h);
    edge = card.edge;
    const wave = time - waveStart < WAVE_TIME ? (time - waveStart) / WAVE_TIME : -1;
    if (progress < 0.04 && !reducedMotion && time - lastActivity > SLEEP_AFTER) sleeping = true;
    look.set(reducedMotion ? 0 : smoothPointer.x, reducedMotion ? 0 : smoothPointer.y);
    const parallax = reducedMotion ? 0 : 1;

    // Room act: typing → stands up and turns to the camera as it moves in.
    roomCam.position.copy(views.heroDir).multiplyScalar(THREE.MathUtils.lerp(views.heroDist, views.closeDist, stand));
    lookAt.lerpVectors(views.heroTarget, views.closeTarget, stand);
    roomCam.position.add(lookAt);
    roomCam.position.x += smoothPointer.x * 0.5 * parallax;
    roomCam.position.y -= smoothPointer.y * 0.3 * parallax;
    roomCam.lookAt(lookAt);
    roomCam.setViewOffset(size.w, size.h, -shift.x * size.w, shift.y * (1 - stand) * size.h + card.shift, size.w, size.h);

    if (stand > 0) {
      blendPose(rig, poseSitting, poseStanding, stand);
      // Steps out from the desk to the right of the chair, turning to the camera.
      rig.root.position.set(stand * 0.9, THREE.MathUtils.lerp(SEAT_DROP, 0, Math.min(1, stand * 1.6)), THREE.MathUtils.lerp(0.02, 0.55, stand));
      rig.root.rotation.y = THREE.MathUtils.lerp(Math.PI, ROOM_FACE_CAMERA, stand);
      chair.position.set(-stand * 0.25, 0, 0.12 + stand * 0.2);
      chair.rotation.y = stand * 0.5;
      rig.head.rotation.set(look.y * 0.3 * stand, look.x * 0.6 * stand, 0);
      if (wave >= 0) applyWave(rig.arms[1], 1, time, wave);
    } else {
      rig.root.position.set(0, SEAT_DROP, 0.02);
      rig.root.rotation.y = Math.PI;
      chair.position.set(0, 0, 0.12);
      chair.rotation.y = 0;
      poseSitting(rig);
      if (sleeping) {
        rig.body.position.y -= 0.02 - Math.sin(time * 1.2) * 0.01;
        rig.head.rotation.set(0.4 + Math.sin(time * 1.2) * 0.03, 0, 0.12);
        rig.arms.forEach((arm) => {
          arm.shoulder.rotation.x = -0.4;
          arm.elbow.rotation.x = -1.1;
        });
      } else if (!reducedMotion) {
        const startle = Math.max(0, 1 - (time - wokeAt) / 0.5);
        rig.body.position.y += Math.sin(time * 2) * 0.006 + startle * 0.08;
        rig.head.rotation.set(Math.sin(time * 0.6) * 0.05, Math.sin(time * 0.35) * 0.12, 0);
        if (wave >= 0) {
          rig.head.rotation.y = -0.7; // glance back over the shoulder
          applyWave(rig.arms[0], -1, time, wave);
        } else {
          rig.arms.forEach((arm, i) => {
            arm.elbow.rotation.x = -0.85 + Math.max(0, Math.sin(time * 14 + i * 2.1)) * 0.12;
          });
        }
        const step = Math.floor(time * 6);
        if (step !== typingStep && wave < 0) {
          typingStep = step;
          screens[0].redraw(step % 260);
          if (step % 9 === 0) screens[1].redraw(Math.floor(step / 9));
        }
      }
    }

    // Hologram act
    holoCam.position.set(0, 0.12, 1).normalize().multiplyScalar(views.holoDist).add(views.holoTarget);
    holoCam.position.x += smoothPointer.x * 0.5 * parallax;
    holoCam.position.y -= smoothPointer.y * 0.3 * parallax;
    holoCam.lookAt(views.holoTarget);
    holo.setScan(scan);
    holo.update(time, look, wave, drop);

    // Draw: room inside the card, hologram stage below its edge.
    renderer.setScissorTest(true);
    renderer.setScissor(0, 0, size.w, size.h);
    renderer.clear();
    const roomH = Math.max(0, Math.min(size.h, edge));
    if (roomH > 0) {
      room.visible = true;
      holo.setVisible(false);
      renderer.setScissor(0, size.h - roomH, size.w, roomH);
      renderer.render(scene, roomCam);
    }
    if (roomH < size.h) {
      room.visible = false;
      holo.setVisible(true);
      renderer.setScissor(0, 0, size.w, size.h - roomH);
      renderer.render(scene, holoCam);
    }
    renderer.setScissorTest(false);

    // Speech bubble + counter position
    const inRoom = wipe < 0.05;
    let text = "";
    if (wave >= 0) text = inRoom ? "Hi there!" : "Hello! Nice to meet you.";
    else if (inRoom && stand === 0 && sleeping) text = "z z z";
    else if (inRoom && stand === 0 && time - wokeAt < 1.6) text = "Oh! Hi!";
    const showOk = inRoom || (wipe > 0.98 && drop >= 1);
    if (text && showOk) {
      onSpeech?.(speechFor(inRoom ? rig : holo.rig, inRoom ? roomCam : holoCam, text));
      lastSpeech = text;
    } else if (lastSpeech) {
      onSpeech?.(null);
      lastSpeech = "";
    }
    holo.counterAnchor.getWorldPosition(tmp);
    onCounter?.(toScreen(tmp, holoCam));

    if (!ready) {
      ready = true;
      onReady?.();
    }
  }

  new ResizeObserver(() => {
    resize();
    if (!gate.isRunning()) render(clock);
  }).observe(canvas);
  resize();
  if (reducedMotion) screens[0].redraw(999);

  const gate = renderWhileVisible(renderer, observe ?? canvas, (ms) => render(ms / 1000));

  canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    renderer.setAnimationLoop(null);
    onLost?.();
  });

  return {
    setProgress(value) {
      if (Number.isFinite(value)) target = value;
    },
  };
}
