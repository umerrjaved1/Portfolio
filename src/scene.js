import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { buildCharacter, clayMaterials, poseSitting, poseStanding, blendPose, SEAT_DROP } from "./character.js";
import { rbox, canvasTexture, shadowFloor, applyWave, toNdc, renderWhileVisible } from "./three-utils.js";
import { timeline, cardGeometry, ease } from "./timeline.js";

// One canvas, two acts. The room is drawn inside the cream card; as the card
// slides up (see timeline.js) the hologram stage is drawn in the area it uncovers.
// Each act has its own camera and is rendered with a scissor rectangle.

const HOLO_COLOR = new THREE.Color(0x6fd6ff);

// Monitor screens -----------------------------------------------------------
// Left monitor: Dark IDE sidebar with app/status icons & project tree
// Right monitor: Colorful syntax-highlighted code lines typed live

const CODE = [
  [["#e5c07b", 6], ["#c678dd", 8]],
  [["#98c379", 5], ["#e6e6e6", 9]],
  [["#d19a66", 7]],
  [["#e6e6e6", 11], ["#c678dd", 6]],
  [["#c678dd", 14]],
  [["#e5c07b", 8], ["#e6e6e6", 10]],
  [["#e6e6e6", 15]],
  [["#c678dd", 12], ["#e5c07b", 5]],
  [],
  [["#d19a66", 7], ["#98c379", 8]],
  [["#98c379", 11]],
  [["#e5c07b", 13]],
  [["#e6e6e6", 9]],
];

function drawLeftScreen(ctx, w, h, step) {
  // Deep charcoal IDE background matching reference
  ctx.fillStyle = "#2b2c34";
  ctx.fillRect(0, 0, w, h);

  // Far-left activity bar with rounded icon badges
  ctx.fillStyle = "#22232a";
  ctx.fillRect(0, 0, 58, h);

  const badges = [
    { color: "#528bff", active: true },
    { color: "#383a46", active: false },
    { color: "#383a46", active: false },
    { color: "#383a46", active: false, dot: "#e05260" },
  ];
  badges.forEach((b, i) => {
    const y = 22 + i * 44;
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.roundRect(13, y, 32, 32, 9);
    ctx.fill();
    if (b.dot) {
      ctx.fillStyle = b.dot;
      ctx.beginPath();
      ctx.arc(29, y + 16, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // File tree lines in the secondary sidebar
  ctx.fillStyle = "rgba(230, 232, 240, 0.45)";
  const treeLengths = [42, 68, 54, 48, 64, 38, 58, 32];
  treeLengths.forEach((len, i) => {
    const y = 26 + i * 18;
    const indent = i === 0 || i === 5 ? 0 : 12;
    ctx.beginPath();
    ctx.roundRect(76 + indent, y, len, 6, 3);
    ctx.fill();
  });

  // Subtle vertical divider
  ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
  ctx.fillRect(172, 0, 2, h);

  // Right pane of left monitor: subtle live Android / AI status cards
  const active = step % 3;
  for (let i = 0; i < 3; i++) {
    const cy = 28 + i * 82;
    ctx.fillStyle = i === active ? "rgba(82, 139, 255, 0.14)" : "rgba(255, 255, 255, 0.04)";
    ctx.beginPath();
    ctx.roundRect(194, cy, w - 218, 66, 10);
    ctx.fill();

    ctx.fillStyle = i === 0 ? "#3ddc84" : i === 1 ? "#7f52ff" : "#528bff";
    ctx.beginPath();
    ctx.roundRect(208, cy + 16, 48, 8, 4);
    ctx.fill();

    ctx.fillStyle = "rgba(230, 232, 240, 0.35)";
    ctx.beginPath();
    ctx.roundRect(208, cy + 34, 160 - i * 20, 6, 3);
    ctx.fill();
  }
}

function drawRightScreen(ctx, w, h, chars) {
  // Deep charcoal code editor screen matching reference
  ctx.fillStyle = "#2b2c34";
  ctx.fillRect(0, 0, w, h);

  let budget = chars;
  CODE.forEach((line, row) => {
    let x = 88;
    const y = 22 + row * 20;
    for (const [color, len] of line) {
      const shown = Math.min(len, budget);
      if (shown <= 0) return;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(x, y, shown * 11, 7, 3.5);
      ctx.fill();
      x += len * 11 + 8;
      budget -= len;
    }
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

  room.add(shadowFloor(0.1, 4.2));

  const mat = (color, roughness = 0.82, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const mesh = (geometry, material, [x, y, z] = [0, 0, 0], parent = room) => {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };

  // Rug: concentric rounded rectangular bands aligned with the desk,
  // with rich orange (#e88a25) and golden yellow (#f4cb52) matching reference.
  const rug = new THREE.Group();
  rug.position.set(-0.55, 0, 0.45);
  [
    [4.3, 3.3, 0xe88a25],
    [3.65, 2.65, 0xf4cb52],
    [3.0, 2.0, 0xe88a25],
    [2.35, 1.35, 0xf4cb52],
  ].forEach(([rw, rd, color], i) => {
    const slab = new THREE.Mesh(
      new THREE.ExtrudeGeometry(roundedRectShape(rw, rd, Math.min(rw, rd) * 0.12), {
        depth: 0.02,
        bevelEnabled: false,
        curveSegments: 12,
      }),
      mat(color, 0.92),
    );
    slab.rotation.x = -Math.PI / 2;
    slab.position.y = 0.004 + i * 0.008;
    slab.receiveShadow = true;
    rug.add(slab);
  });
  room.add(rug);

  // Desk: crisp white rounded top on 4 warm wooden legs
  const legWood = 0xcfa372;
  const desk = new THREE.Group();
  desk.position.set(0, 0, -0.95);
  const top = rbox(3.6, 0.13, 1.3, 0.06, 0xfaf8f5, { roughness: 0.55 });
  top.position.y = 0.95;
  desk.add(top);
  for (const [x, z] of [[-1.58, -0.46], [1.58, -0.46], [-1.58, 0.46], [1.58, 0.46]]) {
    mesh(new THREE.CylinderGeometry(0.068, 0.052, 0.9, 16), mat(legWood, 0.72), [x, 0.45, z], desk);
  }
  room.add(desk);

  // Monitors with chunky dark slate-purple rounded bezels
  const screens = [];
  [
    { x: -0.64, z: -1.18, ry: 0.22, tex: canvasTexture(512, 320, drawLeftScreen) },
    { x: 0.66, z: -1.22, ry: -0.12, tex: canvasTexture(512, 320, drawRightScreen) },
  ].forEach(({ x, z, ry, tex }) => {
    const mon = new THREE.Group();
    mon.position.set(x, 1.01, z);
    mon.rotation.y = ry;
    const frame = rbox(1.22, 0.78, 0.1, 0.08, 0x484454, { roughness: 0.65 });
    frame.position.y = 0.66;
    mon.add(frame);
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(1.08, 0.64),
      new THREE.MeshBasicMaterial({ map: tex.texture, toneMapped: false })
    );
    screen.position.set(0, 0.66, 0.052);
    mon.add(screen);
    const neck = rbox(0.11, 0.32, 0.06, 0.03, 0x3b3846, { roughness: 0.7 });
    neck.position.set(0, 0.17, -0.05);
    mon.add(neck);
    const base = rbox(0.42, 0.035, 0.26, 0.017, 0x484454, { roughness: 0.65 });
    base.position.y = 0.018;
    mon.add(base);
    room.add(mon);
    screens.push(tex);
  });

  // Desk items: tactile mechanical keyboard with keycaps & mouse that glides with character's hand
  const keyboard = new THREE.Group();
  keyboard.position.set(-0.45, 1.015, -0.52);
  const kbBase = rbox(0.84, 0.032, 0.26, 0.015, 0xe8ebf0, { roughness: 0.55 });
  kbBase.position.y = 0.016;
  keyboard.add(kbBase);
  const keycapMat = mat(0xd4d9e2, 0.6);
  const accentKeyMat = mat(0xff8400, 0.55);
  for (let row = 0; row < 4; row++) {
    const z = -0.082 + row * 0.054;
    const cols = row === 3 ? 5 : 11;
    for (let col = 0; col < cols; col++) {
      const isSpace = row === 3 && col === 2;
      const kw = isSpace ? 0.28 : 0.054;
      const kx = row === 3
        ? [-0.32, -0.22, -0.02, 0.19, 0.30][col]
        : -0.34 + col * 0.068;
      const isEsc = row === 0 && col === 0;
      const cap = rbox(kw, 0.018, 0.042, 0.006, 0xd4d9e2, { roughness: 0.6 });
      cap.material = isEsc ? accentKeyMat : keycapMat;
      cap.position.set(kx, 0.036, z);
      keyboard.add(cap);
    }
  }
  room.add(keyboard);

  // Dark mousepad under the mouse so the mouse stands out clearly on the white desk
  const mousepad = rbox(0.42, 0.008, 0.34, 0.004, 0x383a46, { roughness: 0.85 });
  mousepad.position.set(0.42, 1.016, -0.50);
  room.add(mousepad);

  const mouse = new THREE.Group();
  const mouseBody = rbox(0.15, 0.055, 0.22, 0.032, 0xf2f4f8, { roughness: 0.5 });
  mouseBody.position.y = 0.028;
  mouse.add(mouseBody);
  const scrollWheel = rbox(0.024, 0.02, 0.05, 0.008, 0xff8400, { roughness: 0.5 });
  scrollWheel.position.set(0, 0.054, -0.04);
  mouse.add(scrollWheel);
  mouse.position.set(0.42, 1.02, -0.50);
  room.add(mouse);

  // Warm beige pencil cup with chunky sky-blue and coral-pink pencils
  const cup = mesh(new THREE.CylinderGeometry(0.105, 0.095, 0.21, 24), mat(0xd6c3ae, 0.78), [-1.24, 1.12, -0.74]);
  cup.castShadow = true;
  [
    [0x88bde6, -0.035, 0.12],
    [0xe36d7d, 0.04, -0.15],
  ].forEach(([color, dx, tilt]) => {
    const pencil = new THREE.Group();
    pencil.position.set(-1.24 + dx, 1.18, -0.74);
    pencil.rotation.z = tilt;
    mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.28, 12), mat(color, 0.65), [0, 0.11, 0], pencil);
    mesh(new THREE.ConeGeometry(0.026, 0.065, 12), mat(0xf3d8b0, 0.7), [0, 0.28, 0], pencil);
    mesh(new THREE.ConeGeometry(0.01, 0.025, 10), mat(color, 0.6), [0, 0.30, 0], pencil);
    room.add(pencil);
  });

  // Cute penguin figurine on the front-left corner of the desk
  const tux = new THREE.Group();
  const black = mat(0x23242a, 0.65);
  const white = mat(0xf7f6f2, 0.65);
  const beakMat = mat(0xf29f24, 0.6);
  const body = mesh(new THREE.SphereGeometry(0.125, 24, 18), black, [0, 0.125, 0], tux);
  body.scale.set(1, 1.12, 0.95);
  const belly = mesh(new THREE.SphereGeometry(0.102, 20, 16), white, [0, 0.11, 0.045], tux);
  belly.scale.set(0.92, 1.0, 0.72);
  // Eyes
  for (const s of [-1, 1]) {
    mesh(new THREE.SphereGeometry(0.026, 12, 10), white, [s * 0.038, 0.175, 0.095], tux);
    mesh(new THREE.SphereGeometry(0.013, 10, 8), new THREE.MeshBasicMaterial({ color: 0x15161a }), [s * 0.038, 0.175, 0.115], tux);
  }
  // Beak
  const beak = mesh(new THREE.ConeGeometry(0.024, 0.05, 12), beakMat, [0, 0.15, 0.125], tux);
  beak.rotation.x = Math.PI / 2;
  // Wings
  for (const s of [-1, 1]) {
    const wing = mesh(new THREE.SphereGeometry(0.045, 14, 10), black, [s * 0.115, 0.12, 0], tux);
    wing.scale.set(0.42, 1.05, 0.68);
    wing.rotation.z = s * 0.22;
  }
  tux.position.set(-1.45, 1.01, -0.56);
  tux.rotation.y = 0.35;
  room.add(tux);

  // 3D 3x3x3 Rubik's Cube with dark core and colorful face sticker tiles
  const rubik = new THREE.Group();
  const coreMat = mat(0x1f2128, 0.55);
  const cubieGeo = new THREE.BoxGeometry(0.06, 0.06, 0.06);
  const stickerGeo = new THREE.PlaneGeometry(0.05, 0.05);
  const faceColors = {
    px: mat(0xff5238, 0.45), // Right: Red-Orange
    nx: mat(0xff8c1a, 0.45), // Left: Orange
    py: mat(0xffffff, 0.45), // Top: White
    ny: mat(0xffd633, 0.45), // Bottom: Yellow
    pz: mat(0x2e86de, 0.45), // Front: Blue
    nz: mat(0x2ecc71, 0.45), // Back: Green
  };
  const step = 0.064;
  for (let ix = -1; ix <= 1; ix++) {
    for (let iy = -1; iy <= 1; iy++) {
      for (let iz = -1; iz <= 1; iz++) {
        const cubie = mesh(cubieGeo, coreMat, [ix * step, iy * step, iz * step], rubik);
        if (ix === 1) {
          const s = new THREE.Mesh(stickerGeo, faceColors.px);
          s.position.x = 0.0306;
          s.rotation.y = Math.PI / 2;
          cubie.add(s);
        }
        if (ix === -1) {
          const s = new THREE.Mesh(stickerGeo, faceColors.nx);
          s.position.x = -0.0306;
          s.rotation.y = -Math.PI / 2;
          cubie.add(s);
        }
        if (iy === 1) {
          const s = new THREE.Mesh(stickerGeo, faceColors.py);
          s.position.y = 0.0306;
          s.rotation.x = -Math.PI / 2;
          cubie.add(s);
        }
        if (iy === -1) {
          const s = new THREE.Mesh(stickerGeo, faceColors.ny);
          s.position.y = -0.0306;
          s.rotation.x = Math.PI / 2;
          cubie.add(s);
        }
        if (iz === 1) {
          const s = new THREE.Mesh(stickerGeo, faceColors.pz);
          s.position.z = 0.0306;
          cubie.add(s);
        }
        if (iz === -1) {
          const s = new THREE.Mesh(stickerGeo, faceColors.nz);
          s.position.z = -0.0306;
          s.rotation.y = Math.PI;
          cubie.add(s);
        }
      }
    }
  }
  rubik.position.set(1.18, 1.11, -0.58);
  rubik.rotation.y = 0.55;
  room.add(rubik);

  // Speaker with golden-orange body, recessed white baffle, dark dome woofer, and animated notes
  const speaker = new THREE.Group();
  const spkBody = new THREE.Group();
  speaker.add(spkBody);
  const box = rbox(0.28, 0.33, 0.22, 0.032, 0xeea028, { roughness: 0.62 });
  box.position.y = 0.165;
  spkBody.add(box);
  const baffle = rbox(0.225, 0.275, 0.02, 0.018, 0xe6ebf0, { roughness: 0.65 });
  baffle.position.set(0, 0.165, 0.104);
  spkBody.add(baffle);
  const woofer = mesh(
    new THREE.SphereGeometry(0.08, 28, 20),
    mat(0x484654, 0.55),
    [0, 0.185, 0.112],
    spkBody
  );
  woofer.scale.set(1, 1, 0.52);

  // Floating musical notes matching reference (orange ♪ bottom, blue ♪ middle, pink ♫ top)
  function makeNoteTexture(type, color) {
    return canvasTexture(128, 128, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      if (type === "double") {
        ctx.beginPath();
        ctx.ellipse(34, 92, 18, 13, -0.25, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(86, 86, 18, 13, -0.25, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.moveTo(47, 90);
        ctx.lineTo(54, 28);
        ctx.lineTo(106, 22);
        ctx.lineTo(99, 84);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.ellipse(48, 92, 20, 14, -0.25, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.moveTo(63, 90);
        ctx.lineTo(72, 24);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(72, 24);
        ctx.quadraticCurveTo(104, 30, 98, 54);
        ctx.stroke();
      }
    }).texture;
  }

  const noteSpecs = [
    { type: "single", color: "#f5a251", phase: 0.0, size: 0.22, drift: -0.05 },
    { type: "single", color: "#79c8ec", phase: 0.33, size: 0.21, drift: 0.04 },
    { type: "double", color: "#de7482", phase: 0.66, size: 0.23, drift: 0.11 },
  ];
  const musicNotes = noteSpecs.map((spec) => {
    const matNote = new THREE.SpriteMaterial({
      map: makeNoteTexture(spec.type, spec.color),
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(matNote);
    sprite.scale.setScalar(spec.size);
    sprite.position.set(0, 0.44, 0);
    speaker.add(sprite);
    return { sprite, mat: matNote, ...spec };
  });

  speaker.position.set(1.52, 1.01, -0.78);
  speaker.rotation.y = -0.32;
  room.add(speaker);

  // Modern ergonomic swivel office chair with sculpted white/taupe seat & backrest,
  // dark spine support, curved armrests, gas-lift column, and 5-star wheeled caster base
  const chair = new THREE.Group();
  chair.position.set(0, 0, 0.24);
  const frameDark = mat(0x363842, 0.45, 0.25);
  const chrome = mat(0x8c929e, 0.35, 0.45);

  // 5-star base with dual caster wheels — long arms so the star reads clearly from behind
  const baseHub = mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.08, 20), frameDark, [0, 0.09, 0], chair);
  for (let i = 0; i < 5; i++) {
    const angle = (i * Math.PI * 2) / 5 + 0.22;
    const legGrp = new THREE.Group();
    legGrp.rotation.y = angle;
    const armBar = rbox(0.048, 0.03, 0.40, 0.012, 0x363842, { roughness: 0.45, metalness: 0.25 });
    armBar.position.set(0, 0.075, 0.20);
    armBar.rotation.x = 0.06;
    legGrp.add(armBar);
    const wheel = mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.042, 16), frameDark, [0, 0.04, 0.38], legGrp);
    wheel.rotation.z = Math.PI / 2;
    const tire = mesh(new THREE.TorusGeometry(0.04, 0.012, 8, 16), mat(0x1f2128, 0.7), [0, 0.04, 0.38], legGrp);
    tire.rotation.y = Math.PI / 2;
    chair.add(legGrp);
  }
  // Gas-lift telescopic cylinder + under-seat mechanism.
  // Seat top sits at y ≈ 0.675 so the seated character's hips (SEAT_DROP) rest on the cushion.
  const SEAT_Y = 0.625;
  mesh(new THREE.CylinderGeometry(0.036, 0.042, SEAT_Y - 0.12, 20), chrome, [0, (SEAT_Y - 0.12) / 2 + 0.12, 0], chair);
  const mech = rbox(0.24, 0.05, 0.24, 0.015, 0x363842, { roughness: 0.5 });
  mech.position.set(0, SEAT_Y - 0.04, 0);
  chair.add(mech);

  // Sculpted seat shell + plush top cushion — wide enough to read past the seated figure
  const seat = rbox(0.76, 0.07, 0.60, 0.034, 0xf7f5f0, { roughness: 0.52 });
  seat.position.set(0, SEAT_Y, -0.02);
  chair.add(seat);
  const seatPad = rbox(0.66, 0.034, 0.50, 0.016, 0xe3d8c4, { roughness: 0.75 });
  seatPad.position.set(0, SEAT_Y + 0.038, -0.03);
  chair.add(seatPad);

  // Curved L-spine connecting under the seat up to the backrest
  const spineVert = rbox(0.14, 0.50, 0.04, 0.014, 0x363842, { roughness: 0.45, metalness: 0.2 });
  spineVert.position.set(0, SEAT_Y + 0.24, 0.30);
  spineVert.rotation.x = -0.10;
  chair.add(spineVert);

  // Ergonomic curved backrest: wider lumbar, narrower shoulders, visible from behind
  const lumbar = rbox(0.70, 0.22, 0.08, 0.04, 0xf7f5f0, { roughness: 0.52 });
  lumbar.position.set(0, SEAT_Y + 0.20, 0.26);
  lumbar.rotation.x = -0.12;
  chair.add(lumbar);
  const back = rbox(0.62, 0.42, 0.07, 0.036, 0xf7f5f0, { roughness: 0.52 });
  back.position.set(0, SEAT_Y + 0.46, 0.23);
  back.rotation.x = -0.08;
  chair.add(back);
  const backPad = rbox(0.50, 0.34, 0.028, 0.014, 0xe3d8c4, { roughness: 0.75 });
  backPad.position.set(0, SEAT_Y + 0.46, 0.192);
  backPad.rotation.x = -0.08;
  chair.add(backPad);

  // Sleek L-shaped armrests on both sides
  for (const s of [-1, 1]) {
    const post = rbox(0.035, 0.20, 0.035, 0.01, 0x8c929e, { roughness: 0.35, metalness: 0.4 });
    post.position.set(s * 0.34, SEAT_Y + 0.10, 0.04);
    chair.add(post);
    const pad = rbox(0.065, 0.03, 0.24, 0.014, 0xf7f5f0, { roughness: 0.52 });
    pad.position.set(s * 0.34, SEAT_Y + 0.20, -0.01);
    chair.add(pad);
  }
  room.add(chair);

  // Floating shelf (top-left): 2 blue-grey books, 2 golden-orange books, and plump white pot with lime cactus
  const shelf = new THREE.Group();
  shelf.position.set(-1.32, 2.26, -1.7);
  shelf.add(rbox(1.16, 0.09, 0.38, 0.035, 0xe2cfb2, { roughness: 0.78 }));

  function addShelfBook(w, h, d, color, x) {
    const bGroup = new THREE.Group();
    bGroup.position.set(x, h / 2 + 0.045, 0);
    const cover = rbox(w, h, d, 0.018, color, { roughness: 0.72 });
    bGroup.add(cover);
    const pages = rbox(w * 0.72, h * 0.96, d * 0.92, 0.008, 0xf7f4ec, { roughness: 0.85 });
    pages.position.set(0.006, 0.004, 0.01);
    bGroup.add(pages);
    shelf.add(bGroup);
  }
  addShelfBook(0.115, 0.44, 0.30, 0x9aa6b8, -0.42);
  addShelfBook(0.11, 0.41, 0.29, 0xb2bdcc, -0.305);
  addShelfBook(0.12, 0.45, 0.31, 0xeb9830, -0.18);
  addShelfBook(0.115, 0.43, 0.30, 0xf3b14b, -0.06);

  // Plump bulbous white ceramic pot + bright lime-green cactus on right side of shelf
  const cactusPot = mesh(new THREE.SphereGeometry(0.145, 24, 18), mat(0xf5f4f0, 0.65), [0.30, 0.145, 0.02], shelf);
  cactusPot.scale.set(1, 0.82, 1);
  const cactusMat = mat(0x7ed321, 0.62);
  mesh(new THREE.CapsuleGeometry(0.068, 0.15, 8, 16), cactusMat, [0.30, 0.32, 0.02], shelf);
  const cactusArm = mesh(new THREE.CapsuleGeometry(0.036, 0.065, 8, 12), cactusMat, [0.37, 0.32, 0.02], shelf);
  cactusArm.rotation.z = -0.85;
  room.add(shelf);

  // Corkboard (notes holder) matching reference: warm taupe surface, overlapping blue+white note on left,
  // angled white note on bottom-right, and chunky coral-red 3D cylindrical pushpins
  const board = new THREE.Group();
  board.position.set(0.55, 2.38, -1.9);
  board.rotation.z = -0.025;
  board.add(rbox(1.88, 1.24, 0.08, 0.065, 0xe2cfb2, { roughness: 0.78 }));
  const cork = new THREE.Mesh(new THREE.PlaneGeometry(1.68, 1.04), mat(0x967d69, 0.95));
  cork.position.z = 0.042;
  board.add(cork);

  const makeNoteTex = (bg, lineCol) =>
    canvasTexture(128, 148, (ctx, w, h) => {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = lineCol;
      const widths = [78, 52, 84, 64];
      widths.forEach((lw, i) => {
        ctx.beginPath();
        ctx.roundRect(18, 56 + i * 20, lw, 7, 3.5);
        ctx.fill();
      });
    }).texture;

  // Underlay white sheet behind top-left blue note
  const underSheet = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.54, 0.008),
    new THREE.MeshStandardMaterial({ map: makeNoteTex("#f4f3ef", "rgba(90,100,115,0.28)"), roughness: 0.88 })
  );
  underSheet.position.set(-0.46, 0.08, 0.048);
  underSheet.rotation.z = 0.09;
  board.add(underSheet);

  // Top-left sky-blue note + bottom-right white note with chunky coral push-pins
  [
    [-0.41, 0.10, "#8cb4de", "rgba(55, 75, 105, 0.32)", 0.03],
    [0.44, -0.22, "#f4f3ef", "rgba(90, 100, 115, 0.28)", -0.12],
  ].forEach(([nx, ny, bg, lineCol, rz]) => {
    const noteGroup = new THREE.Group();
    noteGroup.position.set(nx, ny, 0.056);
    noteGroup.rotation.z = rz;
    const sheet = new THREE.Mesh(
      new THREE.BoxGeometry(0.48, 0.56, 0.01),
      new THREE.MeshStandardMaterial({ map: makeNoteTex(bg, lineCol), roughness: 0.88 })
    );
    sheet.castShadow = true;
    sheet.receiveShadow = true;
    noteGroup.add(sheet);

    // Chunky coral-red 3D push-pin matching reference close-up
    const pinStemMat = mat(0xd14b58, 0.55);
    const pinCapMat = mat(0xe35d6a, 0.48);
    const stem = mesh(new THREE.CylinderGeometry(0.052, 0.058, 0.055, 20), pinStemMat, [-0.05, 0.16, 0.032], noteGroup);
    stem.rotation.x = Math.PI / 2;
    const cap = mesh(new THREE.CylinderGeometry(0.082, 0.082, 0.032, 24), pinCapMat, [-0.05, 0.16, 0.068], noteGroup);
    cap.rotation.x = Math.PI / 2;
    board.add(noteGroup);
  });
  room.add(board);

  // Framed 3D mountain picture on the right wall: cornflower-blue recessed box frame
  // with real 3D white mountain peaks and sun disc
  const picture = new THREE.Group();
  picture.position.set(2.38, 1.88, -1.38);
  picture.rotation.y = -0.42;
  picture.rotation.z = -0.04;

  // Outer blue frame rails + recessed sky-blue backing
  picture.add(rbox(1.06, 0.80, 0.08, 0.06, 0x82a7d8, { roughness: 0.72 }));
  const backing = new THREE.Mesh(new THREE.PlaneGeometry(0.88, 0.62), mat(0x98bce8, 0.85));
  backing.position.z = 0.042;
  backing.receiveShadow = true;
  picture.add(backing);

  // 3D white mountains & sun inside the frame
  const artWhite = mat(0xf6f7f9, 0.7);
  const peakShape = (w, h) => {
    const s = new THREE.Shape();
    s.moveTo(-w / 2, 0);
    s.lineTo(0, h);
    s.lineTo(w / 2, 0);
    s.closePath();
    return new THREE.ExtrudeGeometry(s, { depth: 0.018, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 3 });
  };
  const bigPeak = mesh(peakShape(0.52, 0.36), artWhite, [-0.14, -0.29, 0.044], picture);
  bigPeak.castShadow = true;
  const smallPeak = mesh(peakShape(0.38, 0.24), artWhite, [0.18, -0.29, 0.05], picture);
  smallPeak.castShadow = true;
  const sunDisc = mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.02, 24), artWhite, [0.16, 0.10, 0.046], picture);
  sunDisc.rotation.x = Math.PI / 2;
  room.add(picture);

  // Big potted plant on the floor (right of desk): white rim, taupe body, white base,
  // and 4 broad vibrant lime-green pointed leaves
  const plant = new THREE.Group();
  plant.position.set(2.15, 0, 0.32);
  // White bottom base
  mesh(new THREE.CylinderGeometry(0.25, 0.22, 0.12, 32), mat(0xf4f2ec, 0.7), [0, 0.06, 0], plant);
  // Taupe-brown middle body
  mesh(new THREE.CylinderGeometry(0.32, 0.25, 0.34, 32), mat(0xb39c88, 0.78), [0, 0.28, 0], plant);
  // Thick white top rim collar
  const potRim = rbox(0.70, 0.13, 0.70, 0.06, 0xf5f4f0, { roughness: 0.65 });
  potRim.visible = false; // use smooth cylinder+torus collar for round rim
  mesh(new THREE.CylinderGeometry(0.355, 0.335, 0.13, 32), mat(0xf5f4f0, 0.65), [0, 0.50, 0], plant);
  mesh(new THREE.CylinderGeometry(0.30, 0.30, 0.03, 32), mat(0x5a4638, 0.92), [0, 0.555, 0], plant);

  const leafMat = mat(0x7ed321, 0.58);
  [
    [-0.15, 0.38, 0.95],
    [0.95, 0.26, 1.15],
    [2.35, 0.34, 1.0],
    [4.1, 0.36, 0.92],
  ].forEach(([yaw, lean, scale], i) => {
    const leaf = new THREE.Group();
    leaf.position.y = 0.54;
    leaf.rotation.set(0, yaw, lean);
    const blade = mesh(new THREE.ConeGeometry(0.21 * scale, 0.95 * scale, 16), leafMat, [0, 0.45 * scale, 0], leaf);
    blade.scale.set(0.85, 1.0, 0.24);
    const baseSphere = mesh(new THREE.SphereGeometry(0.18 * scale, 16, 12), leafMat, [0, 0.12 * scale, 0], leaf);
    baseSphere.scale.set(0.85, 1.2, 0.24);
    plant.add(leaf);
  });
  room.add(plant);

  // The developer, seated and typing
  const rig = buildCharacter(clayMaterials());
  poseSitting(rig);
  rig.root.position.set(0, SEAT_DROP, 0.12);
  rig.root.rotation.y = Math.PI;
  room.add(rig.root);

  return { room, rig, screens, chair, mouse, speaker, spkBody, woofer, musicNotes };
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

  function update(time, look, wave, drop) {
    uniforms.uTime.value = time;
    const pos = sparkGeo.attributes.position;
    for (let i = 0; i < sparkCount; i++) pos.setY(i, (pos.getY(i) + sparkSeed[i] * 0.01) % 2.8);
    pos.needsUpdate = true;

    const fall = 1 - ease(drop);
    const land = drop > 0.85 ? Math.sin(((drop - 0.85) / 0.15) * Math.PI) : 0;
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
  }

  return { stage, setScan, update, rig: solid, counterAnchor, setVisible: (v) => (stage.visible = v) };
}

const clamp = (v) => Math.min(1, Math.max(0, v));

// Main --------------------------------------------------------------------------

const SLEEP_AFTER = 90;
const WAVE_TIME = 3.8;
const ROOM_FACE_CAMERA = -0.25;

export function initStage(canvas, { reducedMotion, observe, onFrame, onSpeech, onCounter, onWave, isMusicOn, onToggleMusic, onReady, onLost }) {
  const small = Math.min(window.innerWidth, window.innerHeight) < 700;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !small || devicePixelRatio < 2, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, small ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.86;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.localClippingEnabled = true;
  renderer.autoClear = false;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.24;
  pmrem.dispose();

  scene.add(new THREE.HemisphereLight(0xfff4e2, 0xd4b08c, 0.85));
  const sun = new THREE.DirectionalLight(0xfff1dc, 1.55);
  sun.position.set(-2.5, 11, 5.5);
  sun.castShadow = true;
  sun.shadow.mapSize.setScalar(small ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5 });
  sun.shadow.bias = -0.0005;
  sun.shadow.radius = 6;
  scene.add(sun);
  const holoLight = new THREE.PointLight(0x6fd6ff, 6, 8);
  holoLight.position.set(0, 1.6, 2);
  scene.add(holoLight);

  const { room, rig, screens, chair, mouse, speaker, spkBody, woofer, musicNotes } = buildRoom();
  scene.add(room);
  const holo = buildHoloStage();
  scene.add(holo.stage);

  const roomCam = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  const holoCam = new THREE.PerspectiveCamera(30, 1, 0.1, 100);

  // 3/4 front-left isometric camera angle matching david-hckh.com reference
  const views = {
    heroDir: new THREE.Vector3(-3.3, 3.55, 7.2).normalize(),
    heroTarget: new THREE.Vector3(0.32, 1.18, -0.40),
    heroDist: 7.4,
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
    const isDesktop = w >= 680;
    views.heroDist = Math.max(7.4, fitWidth(!isDesktop ? 3.7 : 5.7));
    views.closeDist = Math.max(6.9, fitWidth(2.8));
    views.holoDist = Math.max(8.2, fitWidth(!isDesktop ? 4.2 : 3.6));
    shift = isDesktop ? { x: Math.min(0.24, Math.max(0.15, 0.32 - 0.08 * aspect)), y: -0.08 } : { x: 0, y: -0.2 };
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
  let edge = Infinity;

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

  function actAt(clientY) {
    const y = clientY - canvas.getBoundingClientRect().top;
    return y < edge ? { rig, cam: roomCam } : { rig: holo.rig, cam: holoCam };
  }
  function hitsCharacter(e) {
    const act = actAt(e.clientY);
    raycaster.setFromCamera(toNdc(e, canvas, ndc), act.cam);
    return raycaster.intersectObject(act.rig.root, true).length > 0;
  }
  function hitsSpeaker(e) {
    const y = e.clientY - canvas.getBoundingClientRect().top;
    if (y >= edge) return false;
    raycaster.setFromCamera(toNdc(e, canvas, ndc), roomCam);
    return raycaster.intersectObject(speaker, true).length > 0;
  }
  canvas.addEventListener("pointermove", (e) => {
    canvas.style.cursor = e.pointerType === "mouse" && (hitsCharacter(e) || hitsSpeaker(e)) ? "pointer" : "";
  });
  canvas.addEventListener("click", (e) => {
    if (hitsSpeaker(e)) {
      onToggleMusic?.();
      return;
    }
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
  const lookAt = new THREE.Vector3();
  const look = new THREE.Vector2();
  let typingStep = 0;
  let lastTime = 0;
  let lastSpeech = "";
  let ready = false;

  function render(time) {
    const dt = Math.min(0.1, Math.max(0, time - lastTime));
    if (lastTime === 0) lastActivity = time; // the idle timer starts on the first frame, not at t = 0
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
      // Steps out from the desk to the right of the chair, turning around to face the camera and waving hello!
      rig.root.position.set(stand * 0.9, THREE.MathUtils.lerp(SEAT_DROP, 0, Math.min(1, stand * 1.6)), THREE.MathUtils.lerp(0.12, 0.55, stand));
      rig.root.rotation.y = THREE.MathUtils.lerp(Math.PI, ROOM_FACE_CAMERA, stand);
      chair.position.set(-stand * 0.25, 0, 0.24 + stand * 0.2);
      chair.rotation.y = stand * 0.5;
      rig.head.rotation.set(look.y * 0.3 * stand, look.x * 0.6 * stand, 0);
      mouse.position.set(0.42, 1.02, -0.50);
      if (wave >= 0) {
        applyWave(rig.arms[1], 1, time, wave);
      } else if (stand > 0.35) {
        // Automatic greeting wave as the character finishes turning around
        const autoWave = Math.min(1, (stand - 0.35) / 0.65);
        applyWave(rig.arms[1], 1, time, autoWave * 0.5);
      }
    } else {
      rig.root.position.set(0, SEAT_DROP, 0.12);
      rig.root.rotation.y = Math.PI;
      chair.position.set(0, 0, 0.24);
      chair.rotation.y = 0;
      poseSitting(rig);
      if (sleeping) {
        rig.body.position.y -= 0.02 - Math.sin(time * 1.2) * 0.01;
        rig.head.rotation.set(0.4 + Math.sin(time * 1.2) * 0.03, 0, 0.12);
        // Arms slump down into the lap while dozing
        rig.arms[0].shoulder.rotation.set(-0.25, 0, -0.18);
        rig.arms[0].elbow.rotation.set(-0.95, 0.3, 0.08);
        rig.arms[1].shoulder.rotation.set(-0.25, 0, 0.18);
        rig.arms[1].elbow.rotation.set(-0.95, -0.3, -0.06);
        mouse.position.set(0.42, 1.02, -0.50);
      } else if (!reducedMotion) {
        const startle = Math.max(0, 1 - (time - wokeAt) / 0.5);
        rig.body.position.y += Math.sin(time * 2) * 0.006 + startle * 0.08;
        rig.head.rotation.set(Math.sin(time * 0.6) * 0.05, Math.sin(time * 0.35) * 0.12, 0);
        if (wave >= 0) {
          // Smoothly swivel the chair & character 180° around toward the camera and wave "Hello! 👋"
          const turnAmt = Math.sin(Math.min(1, wave * 5, (1 - wave) * 4) * (Math.PI / 2));
          // Character rides the seat: same angle as the chair, pivoting around the chair's column.
          const swivel = turnAmt * (Math.PI + ROOM_FACE_CAMERA);
          chair.rotation.y = swivel;
          rig.root.rotation.y = Math.PI + swivel;
          rig.root.position.set(-0.12 * Math.sin(swivel), SEAT_DROP, 0.24 - 0.12 * Math.cos(swivel));
          rig.head.rotation.set(-0.05 * turnAmt, 0.15 * turnAmt, 0.04 * turnAmt);
          // Mouse hand comes off the desk and rests in the lap while the other waves
          rig.arms[0].shoulder.rotation.set(
            THREE.MathUtils.lerp(-1.12, -0.25, turnAmt), THREE.MathUtils.lerp(-0.35, 0, turnAmt), THREE.MathUtils.lerp(-0.22, -0.18, turnAmt));
          rig.arms[0].elbow.rotation.set(
            THREE.MathUtils.lerp(-0.42, -0.95, turnAmt), THREE.MathUtils.lerp(0.05, 0.3, turnAmt), 0.08);
          applyWave(rig.arms[1], 1, time, wave);
          mouse.position.set(0.42, 1.02, -0.50);
        } else {
          // Right hand types across the keyboard; left hand glides the mouse
          const typeKey = Math.sin(time * 15);
          const keySweep = Math.sin(time * 3.8);
          rig.arms[1].shoulder.rotation.y = 0.06 + keySweep * 0.12;
          rig.arms[1].elbow.rotation.x = -0.40 + Math.max(0, typeKey) * 0.14;
          rig.arms[1].elbow.rotation.y = -0.15 - keySweep * 0.12;

          const mx = Math.sin(time * 2.4) * 0.04 + Math.cos(time * 1.1) * 0.018;
          const mz = Math.cos(time * 1.9) * 0.028;
          const clickTap = Math.max(0, Math.sin(time * 9)) * 0.03;
          rig.arms[0].shoulder.rotation.y = -0.35 - mx * 1.1;
          rig.arms[0].shoulder.rotation.x = -1.12 + mz * 0.7;
          rig.arms[0].elbow.rotation.x = -0.42 - mz * 0.55 + clickTap;

          rig.arms[0].hand.getWorldPosition(tmp);
          room.worldToLocal(tmp);
          mouse.position.set(
            THREE.MathUtils.clamp(tmp.x, 0.30, 0.54),
            1.02,
            THREE.MathUtils.clamp(tmp.z, -0.62, -0.40)
          );
        }
        const step = Math.floor(time * 6);
        if (step !== typingStep && wave < 0) {
          typingStep = step;
          screens[1].redraw(step % 160);
          if (step % 9 === 0) screens[0].redraw(Math.floor(step / 9));
        }
      }
    }

    // Speaker & floating musical notes animation when music is active
    const musicActive = Boolean(isMusicOn?.());
    if (musicActive && !reducedMotion) {
      const beat = Math.sin(time * 9.5);
      const pulse = Math.max(0, beat);
      spkBody.scale.set(1 + pulse * 0.045, 1 - pulse * 0.035, 1 + pulse * 0.045);
      spkBody.rotation.z = Math.sin(time * 4.75) * 0.035;
      woofer.scale.set(1 + pulse * 0.12, 1 + pulse * 0.12, 0.52 + pulse * 0.18);
      musicNotes.forEach((n, idx) => {
        const cycle = (time * 0.45 + n.phase) % 1;
        const fade = Math.sin(cycle * Math.PI);
        n.mat.opacity = Math.min(1, fade * 1.3);
        n.mat.rotation = Math.sin(time * 3.0 + idx * 1.5) * 0.15;
        n.sprite.position.set(
          n.drift * cycle + Math.sin(cycle * Math.PI * 2 + idx) * 0.035,
          0.42 + cycle * 0.82,
          0.04
        );
        const s = n.size * (0.78 + 0.32 * Math.sin(cycle * Math.PI));
        n.sprite.scale.setScalar(s);
      });
    } else {
      spkBody.scale.set(1, 1, 1);
      spkBody.rotation.z = 0;
      woofer.scale.set(1, 1, 0.52);
      musicNotes.forEach((n) => {
        n.mat.opacity *= 0.85;
        if (n.mat.opacity < 0.01) n.mat.opacity = 0;
      });
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
    if (wave >= 0) text = inRoom ? "Hello! 👋" : "Hello! Nice to meet you!";
    else if (inRoom && stand > 0.45) text = "Hello! 👋";
    else if (inRoom && stand === 0 && sleeping) text = "z z z";
    else if (inRoom && stand === 0 && time - wokeAt < 1.6) text = "Oh! Hello!";
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
  if (reducedMotion) screens[1].redraw(999);

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
