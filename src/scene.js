import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { buildCharacter, clayMaterials, poseSitting, poseStanding, blendPose, SEAT_DROP } from "./character.js";
import { rbox, canvasTexture, shadowFloor, applyWave, toNdc, renderWhileVisible } from "./three-utils.js";
import { timeline, cardGeometry, ease } from "./timeline.js";

// One canvas, two acts. The room is drawn inside the cream card; as the card
// slides up (see timeline.js) the hologram stage is drawn in the area it uncovers.
// Each act has its own camera and is rendered with a scissor rectangle.

const HOLO_COLOR = new THREE.Color(0x6fd6ff);
// Desk layout: the chair sits close enough that both hands rest on the keyboard
// with bent elbows; the mouse pad is to the right of the keyboard, fully on the desk.
const CHAIR_Z = 0.14;
const ROOT_Z = CHAIR_Z - 0.12; // the character sits a little ahead of the chair column
const KEYBOARD_POS = new THREE.Vector3(0, 1.021, -0.43);
const MOUSE_HOME = new THREE.Vector3(0.7, 1.026, -0.46);

// Monitor screen ---------------------------------------------------------------
// One ultrawide IDE: a code editor that types itself out (a Kotlin AI agent),
// a terminal with test results underneath, and an AI assistant chat on the right.
// `chars` advances with each keystroke; `ui` advances with each mouse click.

const AGENT_CODE = [
  "suspend fun runAgent(task: String): Result {",
  "    val context = rag.retrieve(task, topK = 5)",
  "    val plan = llm.plan(task, context)",
  "    for (step in plan.steps) {",
  "        val out = tools.call(step.tool, step.args)",
  "        memory.add(step, out)",
  "    }",
  "    return llm.summarize(memory)",
  "}",
];
const AGENT_CODE_TOTAL = AGENT_CODE.reduce((n, l) => n + l.length, 0);
// The first three lines always show, so the editor is never blank; typing loops over the rest.
const AGENT_CODE_PREFIX = AGENT_CODE.slice(0, 3).reduce((n, l) => n + l.length, 0);
const KEYWORDS = new Set(["suspend", "fun", "val", "for", "in", "return"]);
const CHAT = [
  ["user", "Add retries to the tool calls"],
  ["ai", "Wrapped tools.call in retry(3) with exponential backoff."],
  ["user", "Now cache the RAG lookups"],
  ["ai", "Added an LRU cache keyed by task hash. Hit rate 82%."],
  ["user", "Write tests for the planner"],
  ["ai", "Generated 12 tests. All passing."],
];

// Colour one line of Kotlin: keywords, strings, numbers, calls, punctuation.
function drawCodeLine(ctx, text, x, y, charW) {
  const tokens = text.match(/\s+|[A-Za-z_]\w*|\d+|"[^"]*"|./g) || [];
  let cx = x;
  tokens.forEach((t, i) => {
    let color = "#d7dae0";
    if (KEYWORDS.has(t)) color = "#c678dd";
    else if (/^\d/.test(t)) color = "#d19a66";
    else if (t.startsWith('"')) color = "#98c379";
    else if (/^[A-Z]/.test(t)) color = "#e5c07b";
    else if (/^[a-z_]/.test(t) && tokens[i + 1] === "(") color = "#61afef";
    else if (/[{}()=:,.]/.test(t)) color = "#8b93a1";
    ctx.fillStyle = color;
    ctx.fillText(t, cx, y);
    cx += t.length * charW;
  });
}

function drawUltraScreen(ctx, w, h, ui, chars) {
  const mono = (s, weight = 400) => `${weight} ${s}px "Space Mono", ui-monospace, monospace`;
  const sans = (s, weight = 600) => `${weight} ${s}px Urbanist, system-ui, sans-serif`;
  const EDITOR_X = 56;
  const PANEL_X = Math.round(w * 0.64);
  ctx.textBaseline = "middle";

  // Base, activity rail and tab bar
  ctx.fillStyle = "#1f2026";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#18191e";
  ctx.fillRect(0, 0, EDITOR_X, h);
  ["#5b5bd6", "#3b3d47", "#3b3d47", "#3b3d47"].forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.roundRect(14, 56 + i * 46, 28, 28, 8);
    ctx.fill();
  });
  ctx.fillStyle = "#18191e";
  ctx.fillRect(EDITOR_X, 0, PANEL_X - EDITOR_X, 40);
  [["AgentRunner.kt", true], ["RagPipeline.kt", false], ["build.gradle.kts", false]].forEach(([name, active], i) => {
    const x = EDITOR_X + i * 190;
    ctx.fillStyle = active ? "#1f2026" : "#18191e";
    ctx.fillRect(x, 0, 186, 40);
    if (active) {
      ctx.fillStyle = "#5b5bd6";
      ctx.fillRect(x, 37, 186, 3);
    }
    ctx.fillStyle = active ? "#e6e8ee" : "#7d8592";
    ctx.font = sans(17, 600);
    ctx.fillText(name, x + 18, 21);
  });

  // Code editor: types itself out, then shows an inline AI suggestion
  const cycle = AGENT_CODE_TOTAL - AGENT_CODE_PREFIX + 40;
  let budget = chars >= 1e6 ? AGENT_CODE_TOTAL : AGENT_CODE_PREFIX + (chars % cycle);
  const done = budget >= AGENT_CODE_TOTAL;
  ctx.font = mono(17);
  const charW = ctx.measureText("M").width;
  const lineH = 30;
  const codeX = EDITOR_X + 64;
  let caret = null;
  AGENT_CODE.forEach((line, row) => {
    const y = 66 + row * lineH;
    ctx.fillStyle = "#4b5160";
    ctx.textAlign = "right";
    ctx.fillText(String(row + 1), EDITOR_X + 40, y);
    ctx.textAlign = "left";
    if (budget <= 0) return;
    const shown = line.slice(0, Math.min(line.length, budget));
    budget -= line.length;
    drawCodeLine(ctx, shown, codeX, y, charW);
    if (shown.length < line.length || row === AGENT_CODE.length - 1) caret = [codeX + shown.length * charW, y];
  });
  if (done) {
    // Ghost-text completion offered by the assistant
    const y = 66 + AGENT_CODE.length * lineH;
    ctx.fillStyle = "#4b5160";
    ctx.textAlign = "right";
    ctx.fillText(String(AGENT_CODE.length + 1), EDITOR_X + 40, y);
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(160,168,182,0.55)";
    ctx.font = mono(17);
    ctx.fillText("// ✦ AI: add retry(3) around tools.call?", codeX, y);
    ctx.fillStyle = "rgba(91,91,214,0.18)";
    ctx.beginPath();
    ctx.roundRect(PANEL_X - 120, y - 13, 96, 26, 6);
    ctx.fill();
    ctx.fillStyle = "#a8a6f5";
    ctx.font = sans(15, 700);
    ctx.fillText("Tab ↹ accept", PANEL_X - 112, y);
  } else if (caret) {
    ctx.fillStyle = "#5b5bd6";
    ctx.fillRect(caret[0] + 1, caret[1] - 11, 3, 22);
  }

  // Terminal
  const termY = h - 116;
  ctx.fillStyle = "#18191e";
  ctx.fillRect(EDITOR_X, termY, PANEL_X - EDITOR_X, h - termY);
  ctx.fillStyle = "#7d8592";
  ctx.font = sans(14, 700);
  ctx.fillText("TERMINAL", EDITOR_X + 20, termY + 20);
  ctx.font = mono(16);
  ctx.fillStyle = "#d7dae0";
  ctx.fillText("$ ./gradlew test", EDITOR_X + 20, termY + 50);
  ctx.fillStyle = "#4ade80";
  ctx.fillText("✓ 128 tests passed · 4.2s", EDITOR_X + 20, termY + 76);
  ctx.fillStyle = "#a8a6f5";
  ctx.fillText("▸ agent eval score: 0.94", EDITOR_X + 20, termY + 100);

  // AI assistant panel
  ctx.fillStyle = "#24252c";
  ctx.fillRect(PANEL_X, 0, w - PANEL_X, h);
  ctx.fillStyle = "#5b5bd6";
  ctx.beginPath();
  ctx.roundRect(PANEL_X + 22, 12, 26, 26, 8);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = sans(17, 800);
  ctx.textAlign = "center";
  ctx.fillText("✦", PANEL_X + 35, 26);
  ctx.textAlign = "left";
  ctx.fillText("AI Assistant", PANEL_X + 58, 26);

  // Show the latest exchange; each click moves the conversation on.
  const pair = (ui % (CHAT.length / 2)) * 2;
  const pw = w - PANEL_X - 44;
  const wrap = (text, maxW) => {
    const words = text.split(" ");
    const lines = [];
    let line = "";
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line);
        line = word;
      } else line = test;
    }
    lines.push(line);
    return lines;
  };
  let y = 64;
  for (const [who, text] of [CHAT[pair], CHAT[pair + 1]]) {
    ctx.font = sans(17, 600);
    const lines = wrap(text, pw - 36);
    const bh = lines.length * 24 + 20;
    const mine = who === "user";
    const bx = mine ? PANEL_X + 22 + 40 : PANEL_X + 22;
    const bw = pw - 40;
    ctx.fillStyle = mine ? "#5b5bd6" : "#30323b";
    ctx.beginPath();
    ctx.roundRect(bx, y, bw, bh, 14);
    ctx.fill();
    ctx.fillStyle = mine ? "#ffffff" : "#e6e8ee";
    lines.forEach((l, i) => ctx.fillText(l, bx + 18, y + 22 + i * 24));
    y += bh + 14;
  }
  // Small code snippet attached to the answer
  ctx.fillStyle = "#18191e";
  ctx.beginPath();
  ctx.roundRect(PANEL_X + 22, y, pw - 40, 70, 10);
  ctx.fill();
  ctx.font = mono(15);
  drawCodeLine(ctx, "retry(times = 3) {", PANEL_X + 38, y + 22, ctx.measureText("M").width);
  drawCodeLine(ctx, "  tools.call(step.tool)", PANEL_X + 38, y + 48, ctx.measureText("M").width);

  // Prompt box
  ctx.fillStyle = "#30323b";
  ctx.beginPath();
  ctx.roundRect(PANEL_X + 22, h - 62, w - PANEL_X - 44, 42, 21);
  ctx.fill();
  ctx.fillStyle = "#7d8592";
  ctx.font = sans(16, 500);
  ctx.fillText("Ask anything…", PANEL_X + 44, h - 41);
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

  // Rug: round braided jute with a cream border, centred under the chair
  const rug = new THREE.Group();
  rug.position.set(-0.25, 0, 0.3);
  const rugBorder = new THREE.Mesh(new THREE.CylinderGeometry(1.78, 1.78, 0.016, 96), mat(0xefe6d6, 0.95));
  rugBorder.position.y = 0.008;
  rugBorder.receiveShadow = true;
  rug.add(rugBorder);
  const juteTex = canvasTexture(1024, 1024, (ctx, w, h) => {
    ctx.fillStyle = "#cdb48e";
    ctx.fillRect(0, 0, w, h);
    // Braided rings: alternating light and dark bands with a soft radial falloff
    for (let r = w / 2; r > 8; r -= 14) {
      ctx.strokeStyle = (r / 14) % 2 < 1 ? "#c2a67a" : "#d9c39d";
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    const shade = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    shade.addColorStop(0, "rgba(255,255,255,0.08)");
    shade.addColorStop(1, "rgba(120,90,50,0.12)");
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, w, h);
  });
  const jute = new THREE.Mesh(new THREE.CircleGeometry(1.56, 96), new THREE.MeshStandardMaterial({ map: juteTex.texture, roughness: 0.97 }));
  jute.rotation.x = -Math.PI / 2;
  jute.position.y = 0.0175;
  jute.receiveShadow = true;
  rug.add(jute);
  room.add(rug);

  // Desk: warm oak top on a white standing-desk frame
  const FRAME = 0xf2f0eb;
  const desk = new THREE.Group();
  desk.position.set(0, 0, -0.95);
  const top = rbox(3.6, 0.13, 1.3, 0.05, 0xc8955c, { roughness: 0.6 });
  top.position.y = 0.95;
  desk.add(top);
  for (const x of [-1.5, 1.5]) {
    const column = rbox(0.1, 0.86, 0.1, 0.02, FRAME, { roughness: 0.45 });
    column.position.set(x, 0.45, 0);
    desk.add(column);
    const deskFoot = rbox(0.1, 0.05, 1.15, 0.02, FRAME, { roughness: 0.45 });
    deskFoot.position.set(x, 0.025, 0);
    desk.add(deskFoot);
  }
  const beam = rbox(3.0, 0.07, 0.09, 0.02, FRAME, { roughness: 0.45 });
  beam.position.set(0, 0.84, -0.2);
  desk.add(beam);
  room.add(desk);

  // Oak monitor riser: lifts the display, carries the speakers
  const RISER_TOP = 1.015 + 0.12;
  const riser = new THREE.Group();
  riser.position.set(0, 0, -1.22);
  room.add(riser);
  const riserPlank = rbox(3.0, 0.04, 0.36, 0.015, 0xb98450, { roughness: 0.6 });
  riserPlank.position.y = RISER_TOP - 0.02;
  riser.add(riserPlank);
  for (const x of [-1.36, 1.36]) {
    const support = rbox(0.1, 0.08, 0.32, 0.012, 0xb98450, { roughness: 0.6 });
    support.position.set(x, 1.015 + 0.04, 0);
    riser.add(support);
  }

  // Curved ultrawide monitor on a single stand showing one IDE (see
  // drawUltraScreen): `screens[1]` advances the typed code on each keystroke,
  // `screens[0]` moves the AI assistant chat on each mouse click.
  const MON_W = 1.96;
  const MON_H = 0.7;
  const CURVE_R = 4.2; // gentle curve like a real ultrawide; its centre sits in front of the screen
  // Bend a flat, finely segmented geometry around a vertical axis at z = CURVE_R.
  const bend = (geometry) => {
    const pos = geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const r = CURVE_R - pos.getZ(i);
      const a = x / CURVE_R;
      pos.setX(i, r * Math.sin(a));
      pos.setZ(i, CURVE_R - r * Math.cos(a));
    }
    pos.needsUpdate = true;
    geometry.computeVertexNormals();
    return geometry;
  };

  const ultra = { ui: 0, chars: 0 };
  const ultraTex = canvasTexture(1280, 448, (ctx, w, h) => drawUltraScreen(ctx, w, h, ultra.ui, ultra.chars));
  document.fonts?.ready.then(() => ultraTex.redraw());
  const screens = [
    { redraw: (ui) => { ultra.ui = ui; ultraTex.redraw(); } },
    { redraw: (chars) => { ultra.chars = chars; ultraTex.redraw(); } },
  ];

  const monitor = new THREE.Group();
  monitor.position.set(0, RISER_TOP, -1.22);
  room.add(monitor);
  // Near-borderless black glass front, a thin matte back shell and a mounting hub
  const frontGlass = new THREE.Mesh(
    bend(new THREE.BoxGeometry(MON_W + 0.018, MON_H + 0.036, 0.01, 64, 1, 1).translate(0, -0.009, 0)),
    new THREE.MeshStandardMaterial({ color: 0x0d0e11, roughness: 0.15, metalness: 0.1 }),
  );
  frontGlass.position.y = 0.6;
  frontGlass.castShadow = true;
  monitor.add(frontGlass);
  const backShell = new THREE.Mesh(
    bend(new THREE.BoxGeometry(MON_W + 0.006, MON_H + 0.024, 0.024, 64, 1, 1).translate(0, -0.009, -0.016)),
    new THREE.MeshStandardMaterial({ color: 0xe9eaed, roughness: 0.45, metalness: 0.1 }),
  );
  backShell.position.y = 0.6;
  backShell.castShadow = true;
  backShell.receiveShadow = true;
  monitor.add(backShell);
  const panel = new THREE.Mesh(
    bend(new THREE.PlaneGeometry(MON_W, MON_H, 64, 1).translate(0, 0, 0.0056)),
    new THREE.MeshBasicMaterial({ map: ultraTex.texture, toneMapped: false }),
  );
  panel.position.y = 0.6;
  monitor.add(panel);
  // Faint diagonal glass reflection so the panel reads as a real display
  const sheenTex = canvasTexture(512, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, "rgba(255,255,255,0.07)");
    g.addColorStop(0.35, "rgba(255,255,255,0.025)");
    g.addColorStop(0.36, "rgba(255,255,255,0)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  const sheen = new THREE.Mesh(
    bend(new THREE.PlaneGeometry(MON_W, MON_H, 64, 1).translate(0, 0, 0.0062)),
    new THREE.MeshBasicMaterial({ map: sheenTex.texture, transparent: true, depthWrite: false, toneMapped: false }),
  );
  sheen.position.y = 0.6;
  monitor.add(sheen);
  // Small status LED centred on the chin
  mesh(new THREE.SphereGeometry(0.0035, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }), [0, 0.6 - MON_H / 2 - 0.012, 0.0062], monitor).castShadow = false;
  const hub = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.02, 32), mat(0xd4d7dc, 0.35, 0.6), [0, 0.6, -0.038], monitor);
  hub.rotation.x = Math.PI / 2;
  // Brushed-aluminium stand: a slim neck leaning back onto a thin rounded foot
  const ALU_STAND = 0xc9ccd2;
  const neck = rbox(0.1, 0.5, 0.016, 0.008, ALU_STAND, { roughness: 0.3, metalness: 0.75 });
  neck.position.set(0, 0.32, -0.085);
  neck.rotation.x = 0.16;
  monitor.add(neck);
  const foot = rbox(0.4, 0.012, 0.22, 0.012, ALU_STAND, { roughness: 0.3, metalness: 0.75 });
  foot.position.set(0, 0.006, -0.08);
  monitor.add(foot);
  // Monitor light bar clipped to the top edge, washing the riser in warm light
  const barY = 0.6 + MON_H / 2 + 0.05;
  const lightBar = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.62, 20), mat(0x2a2b31, 0.4, 0.3), [0, barY, 0.03], monitor);
  lightBar.rotation.z = Math.PI / 2;
  const barGlow = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.012), new THREE.MeshBasicMaterial({ color: 0xffe2b0, toneMapped: false }));
  barGlow.rotation.x = Math.PI / 2;
  barGlow.position.set(0, barY - 0.021, 0.045);
  monitor.add(barGlow);
  const clip = rbox(0.06, 0.06, 0.06, 0.01, 0x2a2b31, { roughness: 0.4 });
  clip.position.set(0, barY - 0.035, -0.01);
  monitor.add(clip);
  const poolTex = canvasTexture(256, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h * 0.3, 0, w / 2, h * 0.3, w / 2);
    g.addColorStop(0, "rgba(255,206,140,0.55)");
    g.addColorStop(1, "rgba(255,206,140,0)");
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  const lightPool = new THREE.Mesh(
    new THREE.PlaneGeometry(2.3, 0.34),
    new THREE.MeshBasicMaterial({ map: poolTex.texture, transparent: true, depthWrite: false, toneMapped: false }),
  );
  lightPool.rotation.x = -Math.PI / 2;
  lightPool.position.set(0, 0.002, 0.0);
  monitor.add(lightPool);

  // Desk items: tactile mechanical keyboard with keycaps & mouse that glides with character's hand
  const keyboard = new THREE.Group();
  keyboard.position.copy(KEYBOARD_POS);
  const kbBase = rbox(0.84, 0.032, 0.26, 0.015, 0xe8ebf0, { roughness: 0.55 });
  kbBase.position.y = 0.016;
  keyboard.add(kbBase);
  const keycapMat = mat(0xd4d9e2, 0.6);
  const accentKeyMat = mat(0x5b5bd6, 0.55);
  const keycaps = [];
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
      keycaps.push(cap);
    }
  }
  room.add(keyboard);

  // Light felt desk mat under the keyboard and mouse
  const deskMat = rbox(1.56, 0.006, 0.36, 0.003, 0xd9d5ce, { roughness: 0.97, cast: false });
  deskMat.position.set(0.14, 1.018, -0.475);
  room.add(deskMat);

  const mouse = new THREE.Group();
  const mouseBody = rbox(0.13, 0.05, 0.2, 0.03, 0x2b2d33, { roughness: 0.4, metalness: 0.15 });
  mouseBody.position.y = 0.028;
  mouse.add(mouseBody);
  const scrollWheel = rbox(0.022, 0.018, 0.045, 0.008, 0x5b5bd6, { roughness: 0.5 });
  scrollWheel.position.set(0, 0.05, -0.04);
  mouse.add(scrollWheel);
  mouse.position.copy(MOUSE_HOME);
  room.add(mouse);

  // Front-left of the desk: a laptop on an aluminium stand and an Android test
  // phone lying flat, wired to it, running a debug build of the app.
  const rr = (ctx, x, y, w, h, r) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  // Phone screen: the app running as a debug build, charging over USB.
  const PHONE_TEX_W = 360;
  const PHONE_TEX_H = 760;
  const drawPhoneScreen = (ctx, w, h) => {
    const sans = (s, wt = 600) => `${wt} ${s}px Urbanist, system-ui, sans-serif`;
    // Black glass outside the rounded display
    ctx.fillStyle = "#050506";
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    rr(ctx, 6, 6, w - 12, h - 12, 44);
    ctx.clip();
    ctx.fillStyle = "#f5efe6";
    ctx.fillRect(0, 0, w, h);

    // Status bar: time, punch-hole camera, signal, wifi, charging battery
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#2d2a24";
    ctx.font = sans(20, 700);
    ctx.fillText("9:41", 30, 34);
    ctx.fillStyle = "#050506";
    ctx.beginPath();
    ctx.arc(w / 2, 34, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2d2a24";
    [6, 10, 14, 18].forEach((bh, i) => ctx.fillRect(w - 118 + i * 7, 42 - bh, 5, bh));
    ctx.beginPath();
    ctx.moveTo(w - 80, 42);
    ctx.arc(w - 80, 42, 16, -Math.PI * 0.75, -Math.PI * 0.25);
    ctx.closePath();
    ctx.fill();
    rr(ctx, w - 56, 26, 34, 17, 4);
    ctx.fill();
    ctx.fillStyle = "#4ade80";
    rr(ctx, w - 54, 28, 22, 13, 3);
    ctx.fill();
    ctx.fillStyle = "#2d2a24";
    ctx.fillRect(w - 21, 31, 3, 7);
    ctx.fillStyle = "#ffffff"; // charging bolt
    ctx.beginPath();
    ctx.moveTo(w - 42, 28);
    ctx.lineTo(w - 48, 35);
    ctx.lineTo(w - 43, 35);
    ctx.lineTo(w - 45, 41);
    ctx.lineTo(w - 39, 33);
    ctx.lineTo(w - 44, 33);
    ctx.closePath();
    ctx.fill();

    // App bar
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 62, w, 74);
    ctx.fillStyle = "#5b5bd6";
    ctx.beginPath();
    ctx.arc(52, 99, 21, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = sans(18, 800);
    ctx.textAlign = "center";
    ctx.fillText("✦", 52, 100);
    ctx.textAlign = "left";
    ctx.fillStyle = "#2d2a24";
    ctx.font = sans(21, 800);
    ctx.fillText("Pocket Assistant", 86, 90);
    ctx.fillStyle = "#16a34a";
    ctx.font = sans(15, 700);
    ctx.fillText("● on-device model", 86, 114);

    // Chat
    const bubbles = [
      [false, "Summarise my notes from today"],
      [true, "3 meetings, 2 action items. Want a to-do list?"],
      [false, "Yes, and remind me at 5"],
      [true, "Done ✓ Reminder set for 5:00 PM"],
    ];
    ctx.font = sans(17, 600);
    let y = 160;
    for (const [ai, text] of bubbles) {
      const words = text.split(" ");
      const lines = [];
      let line = "";
      for (const word of words) {
        const t = line ? `${line} ${word}` : word;
        if (ctx.measureText(t).width > 196 && line) {
          lines.push(line);
          line = word;
        } else line = t;
      }
      lines.push(line);
      const bw = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 32;
      const bh = lines.length * 22 + 20;
      const x = ai ? 20 : w - 20 - bw;
      ctx.fillStyle = ai ? "#ffffff" : "#5b5bd6";
      rr(ctx, x, y, bw, bh, 18);
      ctx.fill();
      ctx.fillStyle = ai ? "#2d2a24" : "#ffffff";
      lines.forEach((l, i) => ctx.fillText(l, x + 16, y + 21 + i * 22));
      y += bh + 14;
    }

    // "Installed via USB" toast and the input bar
    ctx.fillStyle = "rgba(45,42,36,0.92)";
    rr(ctx, 40, h - 186, w - 80, 44, 22);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = sans(16, 700);
    ctx.textAlign = "center";
    ctx.fillText("✓ Debug build installed via USB", w / 2, h - 164);
    ctx.textAlign = "left";
    ctx.fillStyle = "#ffffff";
    rr(ctx, 20, h - 122, w - 40, 52, 26);
    ctx.fill();
    ctx.fillStyle = "#a9a29a";
    ctx.font = sans(17, 500);
    ctx.fillText("Message…", 44, h - 96);
    ctx.fillStyle = "#2d2a24";
    ctx.beginPath();
    ctx.arc(w - 48, h - 96, 18, 0, Math.PI * 2);
    ctx.fill();
    // Gesture bar
    ctx.fillStyle = "#2d2a24";
    rr(ctx, w / 2 - 60, h - 34, 120, 7, 3.5);
    ctx.fill();

    // DEBUG ribbon across the top-right corner
    ctx.translate(w - 46, 150);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = "#e05260";
    ctx.fillRect(-90, -14, 180, 28);
    ctx.fillStyle = "#ffffff";
    ctx.font = sans(15, 800);
    ctx.textAlign = "center";
    ctx.fillText("DEBUG", 0, 1);
    ctx.restore();
  };

  // Modern Android phone: metal frame, glass front with the display, side
  // buttons and a USB-C port. Lies along local Y, screen facing +Z.
  const PHONE_W = 0.15;
  const PHONE_H = 0.31;
  const PHONE_D = 0.016;
  function testPhone() {
    const g = new THREE.Group();
    const frame = rbox(PHONE_W, PHONE_H, PHONE_D, 0.02, 0x3a3c43, { roughness: 0.35, metalness: 0.6 });
    g.add(frame);
    const back = rbox(PHONE_W - 0.004, PHONE_H - 0.004, 0.004, 0.018, 0x24262c, { roughness: 0.3, metalness: 0.2 });
    back.position.z = -PHONE_D / 2 + 0.0015;
    g.add(back);
    const glass = rbox(PHONE_W - 0.004, PHONE_H - 0.004, 0.003, 0.018, 0x050506, { roughness: 0.12 });
    glass.position.z = PHONE_D / 2 - 0.001;
    g.add(glass);
    const tex = canvasTexture(PHONE_TEX_W, PHONE_TEX_H, drawPhoneScreen);
    document.fonts?.ready.then(() => tex.redraw());
    const display = new THREE.Mesh(
      new THREE.PlaneGeometry(PHONE_W - 0.006, PHONE_H - 0.006),
      new THREE.MeshBasicMaterial({ map: tex.texture, toneMapped: false }),
    );
    display.position.z = PHONE_D / 2 + 0.0012;
    g.add(display);
    // Power and volume buttons on the right edge, USB-C port at the bottom
    const btnMat = mat(0x4a4d55, 0.35, 0.6);
    for (const [y, len] of [[0.07, 0.03], [0.015, 0.05]]) {
      const b = mesh(new THREE.BoxGeometry(0.003, len, 0.006), btnMat, [PHONE_W / 2 + 0.001, y, 0], g);
      b.castShadow = false;
    }
    const port = mesh(new THREE.BoxGeometry(0.018, 0.003, 0.005), mat(0x111113, 0.6), [0, -PHONE_H / 2 - 0.0005, 0], g);
    port.castShadow = false;
    return g;
  }

  // Laptop on an angled aluminium stand
  const ALU = 0xc9ccd2;
  const laptopRig = new THREE.Group();
  laptopRig.position.set(-1.2, 1.015, -0.64); // clear of the monitor's left corner
  laptopRig.scale.setScalar(1.1);
  laptopRig.rotation.y = 0.45;
  room.add(laptopRig);
  const standFoot = rbox(0.3, 0.012, 0.26, 0.005, ALU, { roughness: 0.35, metalness: 0.7 });
  standFoot.position.y = 0.006;
  laptopRig.add(standFoot);
  const STAND_TILT = 0.26; // raises the back of the laptop
  for (const x of [-0.12, 0.12]) {
    const arm = rbox(0.02, 0.14, 0.2, 0.006, ALU, { roughness: 0.35, metalness: 0.7 });
    arm.position.set(x, 0.075, -0.03);
    arm.rotation.x = STAND_TILT;
    laptopRig.add(arm);
  }
  const deck = new THREE.Group(); // tilted top plate the laptop sits on
  deck.position.set(0, 0.14, 0);
  deck.rotation.x = STAND_TILT;
  laptopRig.add(deck);
  const plate = rbox(0.34, 0.01, 0.3, 0.005, ALU, { roughness: 0.35, metalness: 0.7 });
  deck.add(plate);
  const standLip = rbox(0.34, 0.03, 0.012, 0.004, ALU, { roughness: 0.35, metalness: 0.7 });
  standLip.position.set(0, 0.015, 0.15);
  deck.add(standLip);

  const laptop = new THREE.Group();
  laptop.position.y = 0.014;
  deck.add(laptop);
  const lapBase = rbox(0.5, 0.018, 0.34, 0.012, 0xd6d8dc, { roughness: 0.35, metalness: 0.6 });
  lapBase.position.y = 0.009;
  laptop.add(lapBase);
  // Laptop keyboard: dark recessed well with individual keycaps in a real
  // layout (short function row, wide modifiers, 5.5u spacebar, inverted-T
  // arrows). All keys are one InstancedMesh.
  const KB_W = 0.42;
  const KB_D = 0.15;
  const KB_Z = -0.045; // centre of the keyboard area (back of the deck is -Z)
  const keyWell = new THREE.Mesh(new THREE.PlaneGeometry(KB_W + 0.01, KB_D + 0.008), mat(0x0e0f12, 0.8));
  keyWell.rotation.x = -Math.PI / 2;
  keyWell.position.set(0, 0.0184, KB_Z);
  laptop.add(keyWell);
  const unit = KB_W / 15;
  const rowsSpec = [
    [0.55, Array(14).fill(15 / 14)],
    [1, [...Array(13).fill(1), 2]],
    [1, [1.5, ...Array(12).fill(1), 1.5]],
    [1, [1.75, ...Array(11).fill(1), 2.25]],
    [1, [2.25, ...Array(10).fill(1), 2.75]],
    [1, [1, 1, 1, 1.25, 5.5, 1.25, 1, "arrows"]],
  ];
  const rowUnit = KB_D / rowsSpec.reduce((n, [d]) => n + d, 0);
  const keys = []; // [centre x, centre z, width, depth]
  let rowZ = KB_Z - KB_D / 2;
  for (const [depthU, widths] of rowsSpec) {
    const d = depthU * rowUnit;
    let x = -KB_W / 2;
    for (const wU of widths) {
      if (wU === "arrows") {
        // left, up/down stacked, right: each 1u wide, half-height
        const half = d / 2;
        keys.push([x + unit / 2, rowZ + half * 1.5, unit, half]);
        keys.push([x + unit * 1.5, rowZ + half * 0.5, unit, half]);
        keys.push([x + unit * 1.5, rowZ + half * 1.5, unit, half]);
        keys.push([x + unit * 2.5, rowZ + half * 1.5, unit, half]);
        x += unit * 3;
        continue;
      }
      const w = wU * unit;
      keys.push([x + w / 2, rowZ + d / 2, w, d]);
      x += w;
    }
    rowZ += d;
  }
  const KEY_GAP = 0.0046;
  const keyCaps = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat(0x464850, 0.5), keys.length);
  const keyMatrix = new THREE.Matrix4();
  const keyQuat = new THREE.Quaternion();
  keys.forEach(([x, z, w, d], i) => {
    keyMatrix.compose(new THREE.Vector3(x, 0.0198, z), keyQuat, new THREE.Vector3(w - KEY_GAP, 0.0026, d - KEY_GAP));
    keyCaps.setMatrixAt(i, keyMatrix);
  });
  keyCaps.receiveShadow = true;
  laptop.add(keyCaps);
  const trackpad = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.08), mat(0xc4c7cc, 0.4, 0.4));
  trackpad.rotation.x = -Math.PI / 2;
  trackpad.position.set(0, 0.0185, 0.1);
  laptop.add(trackpad);
  const lid = new THREE.Group(); // hinged at the back edge
  lid.position.set(0, 0.018, -0.165);
  lid.rotation.x = -0.32;
  laptop.add(lid);
  const lidShell = rbox(0.5, 0.33, 0.012, 0.012, 0xd6d8dc, { roughness: 0.35, metalness: 0.6 });
  lidShell.position.y = 0.165;
  lid.add(lidShell);
  const laptopTex = canvasTexture(640, 400, (ctx, w, h) => {
    ctx.fillStyle = "#16171c";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#5b5bd6";
    ctx.fillRect(0, 0, w, 52);
    ctx.fillStyle = "#ffffff";
    ctx.textBaseline = "middle";
    ctx.font = "800 26px Urbanist, system-ui, sans-serif";
    ctx.fillText("✦ AI Agent", 26, 27);
    ctx.font = '400 22px "Space Mono", ui-monospace, monospace';
    const lines = [
      ["#d7dae0", '$ agent run "ship v4.2"'],
      ["#4ade80", "✓ planned 6 steps"],
      ["#4ade80", "✓ 128 tests passed"],
      ["#4ade80", "✓ built release bundle"],
      ["#4ade80", "✓ rolled out to 100%"],
      ["#a8a6f5", "▸ watching crash-free rate"],
    ];
    lines.forEach(([color, text], i) => {
      ctx.fillStyle = color;
      ctx.fillText(text, 26, 92 + i * 46);
    });
  });
  document.fonts?.ready.then(() => laptopTex.redraw());
  const lapScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.46, 0.29),
    new THREE.MeshBasicMaterial({ map: laptopTex.texture, toneMapped: false }),
  );
  lapScreen.position.set(0, 0.17, 0.0065);
  lid.add(lapScreen);

  // Test phone lying flat in front of the laptop, wired to the stand
  const flatPhone = testPhone();
  flatPhone.scale.setScalar(0.9);
  flatPhone.rotation.set(-Math.PI / 2, 0, 0.35);
  flatPhone.position.set(-0.72, 1.015 + 0.0075, -0.47); // fully on the desk (front edge is z = -0.30)
  room.add(flatPhone);
  laptopRig.updateMatrix();
  flatPhone.updateMatrix();
  const plugEnd = new THREE.Vector3(0, -PHONE_H / 2 - 0.004, 0).applyMatrix4(flatPhone.matrix);
  const standPort = new THREE.Vector3(0.15, 0.008, 0.06).applyMatrix4(laptopRig.matrix);
  const cablePath = new THREE.CatmullRomCurve3([
    plugEnd,
    plugEnd.clone().add(new THREE.Vector3(-0.02, -0.004, 0.035)),
    new THREE.Vector3(-0.8, 1.019, -0.33),
    new THREE.Vector3(-0.95, 1.019, -0.42),
    standPort.clone().add(new THREE.Vector3(0.05, -0.002, 0.03)),
    standPort,
  ]);
  mesh(new THREE.TubeGeometry(cablePath, 64, 0.0065, 8, false), mat(0xf2f0eb, 0.55));

  // Metal tower miniature: a round plinth with an enamel grass ring, a flared
  // flower-shaped base of curved petal ribs under a star platform, then a
  // tapering ribbed shaft with rings, two balconies and a small columned top.
  const tower = new THREE.Group();
  // Brushed silver body, darker gunmetal core and rings, glossy green enamel ring
  const stone = mat(0xe8ebf0, 0.26, 0.6);
  const stoneDark = mat(0xb4bac3, 0.3, 0.6);
  // The room keeps ambient reflections low for its clay look, so full metalness
  // reads as dark steel; partial metalness keeps it bright silver with highlights.
  const grass = mat(0x2f7d3a, 0.25, 0.35);
  const UP_Y = new THREE.Vector3(0, 1, 0);
  // Thin rod between two points (used for ribs and columns)
  const rod = (a, b, r0, r1 = r0, material = stone) => {
    const dir = new THREE.Vector3().subVectors(b, a);
    const m = mesh(new THREE.CylinderGeometry(r1, r0, dir.length(), 8), material, [0, 0, 0], tower);
    m.position.copy(a).addScaledVector(dir, 0.5);
    m.quaternion.setFromUnitVectors(UP_Y, dir.normalize());
    return m;
  };
  const disc = (r, h, y, material = stone, seg = 40) => mesh(new THREE.CylinderGeometry(r, r, h, seg), material, [0, y + h / 2, 0], tower);
  const ring = (r, tube, y, material = stoneDark) => {
    const t = mesh(new THREE.TorusGeometry(r, tube, 8, 32), material, [0, y, 0], tower);
    t.rotation.x = Math.PI / 2;
    return t;
  };

  // Plinth: stone base, grass ring, stepped tiers
  disc(0.16, 0.012, 0);
  disc(0.148, 0.016, 0.004, grass);
  disc(0.122, 0.02, 0.012);
  disc(0.108, 0.014, 0.032);
  disc(0.098, 0.01, 0.046);
  const BASE_TOP = 0.056;

  // Flower base: a central drum ringed by curved petal ribs that flare out
  // at the foot and sweep up under the star platform.
  const PLATFORM_Y = 0.14;
  disc(0.055, PLATFORM_Y - BASE_TOP, BASE_TOP, stoneDark);
  const PETALS = 8;
  for (let i = 0; i < PETALS; i++) {
    const a = (i / PETALS) * Math.PI * 2;
    const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    const at = (r, y) => dir.clone().multiplyScalar(r).setY(y);
    const curve = new THREE.CatmullRomCurve3([at(0.1, BASE_TOP), at(0.072, BASE_TOP + 0.022), at(0.058, BASE_TOP + 0.058), at(0.074, PLATFORM_Y - 0.004)]);
    mesh(new THREE.TubeGeometry(curve, 20, 0.017, 10, false), stone, [0, 0, 0], tower);
  }
  // Star platform: eight-pointed outline, extruded
  const star = new THREE.Shape();
  for (let i = 0; i <= 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const r = i % 2 ? 0.074 : 0.094;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (i === 0) star.moveTo(x, z);
    else star.lineTo(x, z);
  }
  const platform = mesh(new THREE.ExtrudeGeometry(star, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 2 }), stone, [0, PLATFORM_Y + 0.012, 0], tower);
  platform.rotation.x = Math.PI / 2;

  // Tapering ribbed shaft with horizontal rings
  const SHAFT_BOTTOM = PLATFORM_Y + 0.014;
  const SHAFT_TOP = 0.39;
  const radiusAt = (y) => THREE.MathUtils.lerp(0.04, 0.02, (y - SHAFT_BOTTOM) / (SHAFT_TOP - SHAFT_BOTTOM));
  mesh(new THREE.CylinderGeometry(0.016, 0.032, SHAFT_TOP - SHAFT_BOTTOM, 24), stoneDark, [0, (SHAFT_BOTTOM + SHAFT_TOP) / 2, 0], tower);
  const RIBS = 10;
  for (let i = 0; i < RIBS; i++) {
    const a = (i / RIBS) * Math.PI * 2;
    const c = Math.cos(a);
    const sn = Math.sin(a);
    // Ribs splay out a little at the foot like the real flared base
    rod(new THREE.Vector3(c * 0.052, SHAFT_BOTTOM, sn * 0.052), new THREE.Vector3(c * radiusAt(SHAFT_BOTTOM + 0.03), SHAFT_BOTTOM + 0.03, sn * radiusAt(SHAFT_BOTTOM + 0.03)), 0.005, 0.0045);
    rod(new THREE.Vector3(c * radiusAt(SHAFT_BOTTOM + 0.03), SHAFT_BOTTOM + 0.03, sn * radiusAt(SHAFT_BOTTOM + 0.03)), new THREE.Vector3(c * 0.02, SHAFT_TOP, sn * 0.02), 0.0045, 0.003);
  }
  for (const y of [0.2, 0.25, 0.3, 0.35]) ring(radiusAt(y) + 0.001, 0.0035, y);

  // Lower balcony
  disc(0.032, 0.012, SHAFT_TOP, stone);
  ring(0.032, 0.003, SHAFT_TOP + 0.014, stoneDark);

  // Upper shaft with slim columns, then the upper balcony
  const UPPER_BOTTOM = SHAFT_TOP + 0.012;
  const UPPER_TOP = UPPER_BOTTOM + 0.07;
  disc(0.015, UPPER_TOP - UPPER_BOTTOM, UPPER_BOTTOM, stoneDark, 20);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    rod(new THREE.Vector3(Math.cos(a) * 0.019, UPPER_BOTTOM, Math.sin(a) * 0.019), new THREE.Vector3(Math.cos(a) * 0.017, UPPER_TOP, Math.sin(a) * 0.017), 0.0028, 0.0025);
  }
  ring(0.019, 0.0028, UPPER_BOTTOM + 0.035);
  disc(0.025, 0.008, UPPER_TOP, stone);

  // Columned top with a flat cap and a small finial
  const TOP_BOTTOM = UPPER_TOP + 0.008;
  const TOP_TOP = TOP_BOTTOM + 0.04;
  disc(0.01, TOP_TOP - TOP_BOTTOM, TOP_BOTTOM, stoneDark, 16);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    rod(new THREE.Vector3(Math.cos(a) * 0.014, TOP_BOTTOM, Math.sin(a) * 0.014), new THREE.Vector3(Math.cos(a) * 0.014, TOP_TOP, Math.sin(a) * 0.014), 0.0022);
  }
  disc(0.018, 0.006, TOP_TOP, stone, 24);
  mesh(new THREE.SphereGeometry(0.009, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), stone, [0, TOP_TOP + 0.006, 0], tower);

  tower.position.set(1.16, 1.015, -0.6);
  tower.rotation.y = 0.3;
  tower.scale.setScalar(0.95);
  room.add(tower);

  // White studio speaker on the riser, right of the monitor. Click it to toggle
  // music; the notes rise from it.
  const speaker = new THREE.Group();
  const speakerParts = [];
  let rightSpeaker = null;
  for (const side of [1]) {
    const unit = new THREE.Group();
    // Wide enough to clear the curved monitor's wings, which bend toward the camera
    unit.position.set(side * 1.36, RISER_TOP, -1.2);
    unit.rotation.y = -side * 0.22;
    const body = new THREE.Group();
    unit.add(body);
    const cab = rbox(0.2, 0.3, 0.2, 0.025, 0xf4f2ee, { roughness: 0.5 });
    cab.position.y = 0.15;
    body.add(cab);
    const ring = mesh(new THREE.TorusGeometry(0.062, 0.012, 10, 32), mat(0xdedad3, 0.5), [0, 0.11, 0.101], body);
    ring.castShadow = false;
    const cone = mesh(new THREE.SphereGeometry(0.058, 24, 16), mat(0x2b2c32, 0.55), [0, 0.11, 0.1], body);
    cone.scale.set(1, 1, 0.52);
    mesh(new THREE.SphereGeometry(0.022, 16, 12), mat(0x2b2c32, 0.4), [0, 0.225, 0.1], body).scale.set(1, 1, 0.5);
    speaker.add(unit);
    speakerParts.push({ body, woofer: cone });
    if (side === 1) rightSpeaker = unit;
  }
  room.add(speaker);

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
    rightSpeaker.add(sprite);
    return { sprite, mat: matNote, ...spec };
  });


  // Modern ergonomic swivel office chair with sculpted white/taupe seat & backrest,
  // dark spine support, curved armrests, gas-lift column, and 5-star wheeled caster base
  const chair = new THREE.Group();
  chair.position.set(0, 0, CHAIR_Z);
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

  // Wall decor -----------------------------------------------------------------
  // A framed print, a shelf with three AI books, a mushroom lamp and a
  // trailing pothos, and a wall clock.
  // `wallAnim` collects per-frame updates; see decor.update below.
  const wallAnim = [];

  // Framed print ---------------------------------------------------------------
  // One calm, light art print in the site palette (cream, sand, orange, navy),
  // sitting low enough to leave clear space under the nav.
  const print = new THREE.Group();
  print.position.set(0.62, 2.5, -1.92);
  room.add(print);
  print.add(rbox(0.86, 0.62, 0.045, 0.02, 0xe2cfb2, { roughness: 0.7 })); // light oak frame
  const matBoard = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.54), mat(0xfbf8f2, 0.9));
  matBoard.position.z = 0.0235;
  print.add(matBoard);
  const artTex = canvasTexture(640, 440, (ctx, w, h) => {
    ctx.fillStyle = "#f3ebdf";
    ctx.fillRect(0, 0, w, h);
    // Sand hill
    ctx.fillStyle = "#e2cfb2";
    ctx.beginPath();
    ctx.ellipse(w * 0.3, h * 1.05, w * 0.55, h * 0.45, 0, Math.PI, 0);
    ctx.fill();
    // Orange sun
    ctx.fillStyle = "#5b5bd6";
    ctx.beginPath();
    ctx.arc(w * 0.66, h * 0.42, h * 0.2, 0, Math.PI * 2);
    ctx.fill();
    // Navy arch
    ctx.strokeStyle = "#2f3e66";
    ctx.lineWidth = 26;
    ctx.beginPath();
    ctx.arc(w * 0.66, h * 0.98, h * 0.42, Math.PI, 0);
    ctx.stroke();
    // Fine line accent
    ctx.strokeStyle = "#2d2a24";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(w * 0.1, h * 0.2);
    ctx.lineTo(w * 0.38, h * 0.2);
    ctx.stroke();
  });
  const art = new THREE.Mesh(new THREE.PlaneGeometry(0.64, 0.44), new THREE.MeshStandardMaterial({ map: artTex.texture, roughness: 0.85 }));
  art.position.z = 0.025;
  print.add(art);

  // Bookshelf --------------------------------------------------------------------
  const shelf = new THREE.Group();
  shelf.position.set(-1.32, 2.26, -1.7);
  shelf.add(rbox(1.16, 0.07, 0.36, 0.03, 0xd9c4a4, { roughness: 0.74 }));
  // Two little brass brackets under the plank
  for (const bx of [-0.4, 0.4]) {
    const br = rbox(0.03, 0.14, 0.2, 0.01, 0xc9a35a, { roughness: 0.35, metalness: 0.6 });
    br.position.set(bx, -0.1, -0.06);
    shelf.add(br);
  }
  // Three AI books on the shelf, spines out. Each book has two cover boards, a
  // cream page block (page lines show from above), and a designed spine with
  // the title and author. One leans against the others like on a real shelf.
  const pageEdgeTex = canvasTexture(64, 256, (ctx, w, h) => {
    ctx.fillStyle = "#f4eee2";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(150,130,100,0.25)";
    ctx.lineWidth = 1;
    for (let x = 2; x < w; x += 3) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
  }).texture;
  const pageMat = new THREE.MeshStandardMaterial({ map: pageEdgeTex, roughness: 0.9 });

  // Spine designs: [background painter, title, author, title font, title colour, author colour]
  const SPINES = {
    coIntelligence: {
      paint(ctx, w, h) {
        ctx.fillStyle = "#f1ece0";
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = "#3f5a35";
        ctx.fillRect(0, 0, w, h * 0.09);
        ctx.fillRect(0, h * 0.91, w, h * 0.09);
        ctx.fillStyle = "#6f8f4e";
        ctx.fillRect(0, h * 0.09, w, h * 0.012);
        ctx.fillRect(0, h * 0.898, w, h * 0.012);
      },
      title: "CO-INTELLIGENCE",
      author: "ETHAN MOLLICK",
      font: (s) => `700 ${s}px "Space Mono", ui-monospace, monospace`,
      ink: "#2b2a26",
      authorInk: "#3f5a35",
    },
    empire: {
      paint(ctx, w, h) {
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, "#d3bfe0");
        g.addColorStop(0.45, "#bcd5e8");
        g.addColorStop(0.75, "#ffb07a");
        g.addColorStop(1, "#ff6f2c");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      },
      title: "Empire of AI",
      author: "Karen Hao",
      font: (s) => `800 ${s}px Urbanist, system-ui, sans-serif`,
      ink: "#141414",
      authorInk: "#141414",
    },
    genesis: {
      paint(ctx, w, h) {
        ctx.fillStyle = "#fbfaf7";
        ctx.fillRect(0, 0, w, h);
        // Fine radiating hairlines near the title, in violet and grey
        ctx.lineWidth = 1;
        for (let i = 0; i < 40; i++) {
          ctx.strokeStyle = i % 3 ? "rgba(150,150,160,0.16)" : "rgba(170,90,170,0.2)";
          const y = h * 0.42 + (Math.random() - 0.5) * h * 0.3;
          ctx.beginPath();
          ctx.moveTo(w * 0.15, y);
          ctx.lineTo(w * 0.85, y + (Math.random() - 0.5) * 6);
          ctx.stroke();
        }
      },
      title: "GENESIS",
      author: "KISSINGER · MUNDIE · SCHMIDT",
      font: (s) => `600 ${s}px Urbanist, system-ui, sans-serif`,
      ink: "#2e2a3a",
      authorInk: "#4a4656",
    },
  };

  // Spine text runs top-to-bottom, as on English-language books.
  function spineTexture(spec, w, h) {
    const cw = 128;
    const ch = Math.round((cw * h) / w);
    const tex = canvasTexture(cw, ch, (ctx) => {
      spec.paint(ctx, cw, ch);
      ctx.save();
      ctx.translate(cw / 2, 0);
      ctx.rotate(Math.PI / 2);
      ctx.textBaseline = "middle";
      // Title: as large as fits in ~62% of the spine length and the spine width
      let size = 64;
      ctx.font = spec.font(size);
      size = Math.min(size, Math.floor((size * ch * 0.56) / ctx.measureText(spec.title).width), Math.floor(cw * 0.5));
      ctx.font = spec.font(size);
      ctx.fillStyle = spec.ink;
      ctx.textAlign = "left";
      ctx.fillText(spec.title, ch * 0.07, 0);
      // Author toward the foot of the spine
      let aSize = Math.round(size * 0.7);
      ctx.font = spec.font(aSize);
      aSize = Math.min(aSize, Math.floor((aSize * ch * 0.3) / ctx.measureText(spec.author).width));
      ctx.font = spec.font(aSize);
      ctx.fillStyle = spec.authorInk;
      ctx.textAlign = "right";
      ctx.fillText(spec.author, ch * 0.95, 0);
      ctx.restore();
    });
    document.fonts?.ready.then(() => tex.redraw());
    return tex.texture;
  }

  // A book whose origin is the bottom-right corner of its spine, so it can lean.
  function shelfBook(spineKey, w, h, d, boardColor) {
    const pivot = new THREE.Group();
    const book = new THREE.Group();
    book.position.x = -w / 2;
    pivot.add(book);
    const board = 0.007;
    const boardMat = mat(boardColor, 0.7);
    for (const side of [-1, 1]) {
      const cover = rbox(board, h, d, 0.003, boardColor, { roughness: 0.7 });
      cover.material = boardMat;
      cover.position.set(side * (w / 2 - board / 2), h / 2, 0);
      book.add(cover);
    }
    // Page block sits a little shorter than the boards and set back from the spine
    const pages = new THREE.Mesh(new THREE.BoxGeometry(w - board * 2, h - 0.014, d - 0.012), pageMat);
    pages.position.set(0, h / 2, -0.004);
    pages.castShadow = pages.receiveShadow = true;
    book.add(pages);
    const spineBoard = rbox(w, h, 0.008, 0.004, boardColor, { roughness: 0.7 });
    spineBoard.position.set(0, h / 2, d / 2 - 0.004);
    book.add(spineBoard);
    const spineArt = new THREE.Mesh(
      new THREE.PlaneGeometry(w - 0.002, h - 0.002),
      new THREE.MeshStandardMaterial({ map: spineTexture(SPINES[spineKey], w, h), roughness: 0.62 }),
    );
    spineArt.position.set(0, h / 2, d / 2 + 0.0005);
    book.add(spineArt);
    shelf.add(pivot);
    return pivot;
  }

  // Two upright, one leaning against them (top resting on the middle book's edge)
  const bookA = shelfBook("coIntelligence", 0.095, 0.4, 0.28, 0xf1ece0);
  const A_RIGHT = -0.38;
  bookA.position.set(A_RIGHT, 0.035, 0);
  const bookB = shelfBook("empire", 0.115, 0.44, 0.3, 0xd9c6e3);
  const B_RIGHT = A_RIGHT + 0.115 + 0.004; // small gap between spines
  bookB.position.set(B_RIGHT, 0.035, 0.01);
  const LEAN = 0.2;
  const bookC = shelfBook("genesis", 0.105, 0.45, 0.29, 0xfbfaf7);
  // Pivot so the top-left corner lands at the middle book's right edge
  bookC.position.set(B_RIGHT + 0.105 * Math.cos(LEAN) + 0.45 * Math.sin(LEAN), 0.035, 0);
  bookC.rotation.z = LEAN;

  // Mushroom lamp: oak stem with a warm glowing cap
  const lamp = new THREE.Group();
  lamp.position.set(0.12, 0.035, 0.1);
  lamp.scale.setScalar(1.25);
  mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.02, 24), mat(0xd9b48a, 0.6), [0, 0.01, 0], lamp);
  mesh(new THREE.CylinderGeometry(0.026, 0.034, 0.13, 20), mat(0xd9b48a, 0.6), [0, 0.085, 0], lamp);
  const capMat = new THREE.MeshStandardMaterial({ color: 0xf6dcb0, emissive: 0xffb35c, emissiveIntensity: 0.55, roughness: 0.7 });
  const lampCap = new THREE.Mesh(new THREE.SphereGeometry(0.095, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), capMat);
  lampCap.position.y = 0.145;
  lampCap.scale.y = 0.8;
  lampCap.castShadow = true;
  lamp.add(lampCap);
  const capUnder = new THREE.Mesh(new THREE.CircleGeometry(0.095, 32), new THREE.MeshBasicMaterial({ color: 0xffe2b0, toneMapped: false }));
  capUnder.rotation.x = Math.PI / 2;
  capUnder.position.y = 0.146;
  lamp.add(capUnder);
  const lampGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: canvasTexture(128, 128, (ctx, w, h) => {
      const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      g.addColorStop(0, "rgba(255,200,130,0.55)");
      g.addColorStop(1, "rgba(255,200,130,0)");
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }).texture,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  }));
  lampGlow.scale.setScalar(0.5);
  lampGlow.position.y = 0.14;
  lamp.add(lampGlow);
  shelf.add(lamp);

  // Trailing pothos: terracotta pot with vines spilling over the front edge
  const potX = 0.38;
  mesh(new THREE.CylinderGeometry(0.13, 0.1, 0.2, 24), mat(0xd9825b, 0.8), [potX, 0.135, 0], shelf);
  mesh(new THREE.CylinderGeometry(0.138, 0.138, 0.035, 24), mat(0xc9714c, 0.8), [potX, 0.235, 0], shelf);
  const leafGreens = [0x5fae4e, 0x79c35c, 0x4c9a45, 0x8fd06c];
  const leafGeo = new THREE.SphereGeometry(0.05, 12, 8);
  const leafMats = leafGreens.map((c) => mat(c, 0.6));
  // A crown of leaves on top of the pot
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const leaf = mesh(leafGeo, leafMats[i % 4], [potX + Math.cos(a) * 0.08, 0.29 + (i % 3) * 0.025, Math.sin(a) * 0.08], shelf);
    leaf.scale.set(1, 0.45, 1.25);
    leaf.rotation.set(0.5 * Math.sin(a), a, 0.4 * Math.cos(a));
  }
  const vineMat = mat(0x4c8a3c, 0.7);
  const vines = [];
  [
    // start offset x, end x, drop length, front reach
    [-0.06, -0.12, 0.26, 0.16],
    [0.03, 0.06, 0.34, 0.2],
    [0.09, 0.2, 0.2, 0.14],
  ].forEach(([sx, ex, drop, reach], vi) => {
    const vine = new THREE.Group();
    vine.position.set(potX + sx, 0.26, 0.08);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3((ex - sx) * 0.2, 0.02, reach * 0.8),
      new THREE.Vector3((ex - sx) * 0.5, -0.12, reach),
      new THREE.Vector3((ex - sx) * 0.8, -drop * 0.6, reach * 0.9),
      new THREE.Vector3(ex - sx, -drop, reach * 0.8),
    ]);
    mesh(new THREE.TubeGeometry(curve, 32, 0.006, 6, false), vineMat, [0, 0, 0], vine);
    const count = Math.round(drop * 16);
    for (let j = 1; j <= count; j++) {
      const t = j / (count + 1);
      const p = curve.getPoint(t);
      const side = j % 2 ? 1 : -1;
      const leaf = mesh(leafGeo, leafMats[(j + vi) % 4], [p.x + side * 0.03, p.y, p.z + 0.01], vine);
      const s = 0.65 + 0.35 * (1 - t);
      leaf.scale.set(s, s * 0.42, s * 1.2);
      leaf.rotation.set(1.1, side * 0.6, side * 0.5);
    }
    shelf.add(vine);
    vines.push({ vine, phase: vi * 1.7 });
  });
  room.add(shelf);
  wallAnim.push((time) => {
    for (const { vine, phase } of vines) vine.rotation.z = Math.sin(time * 0.7 + phase) * 0.03;
  });

  // Wall clock -------------------------------------------------------------------
  const clockGroup = new THREE.Group();
  clockGroup.position.set(1.8, 2.47, -1.72);
  clockGroup.rotation.y = -0.28;
  clockGroup.scale.setScalar(0.7);
  room.add(clockGroup);
  const rim = mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.07, 48), mat(0xe6dccd, 0.55), [0, 0, 0], clockGroup);
  rim.rotation.x = Math.PI / 2;
  const faceTex = canvasTexture(512, 512, (ctx, w) => {
    ctx.fillStyle = "#fbf7f0";
    ctx.beginPath();
    ctx.arc(w / 2, w / 2, w / 2, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2;
      const major = i % 5 === 0;
      const r1 = w / 2 - 22;
      const r2 = r1 - (i % 15 === 0 ? 44 : major ? 30 : 12);
      ctx.strokeStyle = major ? "#2d2a24" : "#c9bba6";
      ctx.lineWidth = i % 15 === 0 ? 14 : major ? 9 : 4;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(w / 2 + Math.sin(a) * r1, w / 2 - Math.cos(a) * r1);
      ctx.lineTo(w / 2 + Math.sin(a) * r2, w / 2 - Math.cos(a) * r2);
      ctx.stroke();
    }
  });
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.35, 48), new THREE.MeshStandardMaterial({ map: faceTex.texture, roughness: 0.6 }));
  face.position.z = 0.036;
  clockGroup.add(face);
  const hand = (len, width, color, z) => {
    const pivot = new THREE.Group();
    pivot.position.z = z;
    const bar = rbox(width, len, 0.008, width / 2.2, color, { roughness: 0.5 });
    bar.position.y = len / 2 - len * 0.12;
    pivot.add(bar);
    clockGroup.add(pivot);
    return pivot;
  };
  const hourHand = hand(0.19, 0.03, 0x2d2a24, 0.044);
  const minuteHand = hand(0.28, 0.022, 0x2d2a24, 0.052);
  const secondHand = hand(0.3, 0.008, 0x5b5bd6, 0.06);
  const pin = mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.02, 16), mat(0x5b5bd6, 0.4), [0, 0, 0.066], clockGroup);
  pin.rotation.x = Math.PI / 2;
  wallAnim.push(() => {
    const now = new Date();
    const s = now.getSeconds() + now.getMilliseconds() / 1000;
    const m = now.getMinutes() + s / 60;
    const h = (now.getHours() % 12) + m / 60;
    secondHand.rotation.z = -(s / 60) * Math.PI * 2;
    minuteHand.rotation.z = -(m / 60) * Math.PI * 2;
    hourHand.rotation.z = -(h / 12) * Math.PI * 2;
  });

  const decor = {
    // Clock always tracks real time; the rest animates unless motion is reduced.
    update(time, animate) {
      if (animate) for (const fn of wallAnim) fn(time);
      else wallAnim[wallAnim.length - 1](time);
    },
  };

  // Potted snake plant on the floor (right of desk): white rim, taupe body,
  // white base, and tall banded sword leaves fanning out of the soil
  const plant = new THREE.Group();
  plant.position.set(1.95, 0, 0.2);
  plant.scale.setScalar(0.68); // floor plant reads as a plant, not a tree
  // White bottom base
  mesh(new THREE.CylinderGeometry(0.25, 0.22, 0.12, 32), mat(0xf4f2ec, 0.7), [0, 0.06, 0], plant);
  // Taupe-brown middle body
  mesh(new THREE.CylinderGeometry(0.32, 0.25, 0.34, 32), mat(0xb39c88, 0.78), [0, 0.28, 0], plant);
  // Thick white top rim collar
  const potRim = rbox(0.70, 0.13, 0.70, 0.06, 0xf5f4f0, { roughness: 0.65 });
  potRim.visible = false; // use smooth cylinder+torus collar for round rim
  mesh(new THREE.CylinderGeometry(0.355, 0.335, 0.13, 32), mat(0xf5f4f0, 0.65), [0, 0.50, 0], plant);
  mesh(new THREE.CylinderGeometry(0.30, 0.30, 0.03, 32), mat(0x5a4638, 0.92), [0, 0.555, 0], plant);

  // Banded leaf texture: deep green with lighter wavy cross-bands
  const leafTex = canvasTexture(128, 512, (ctx, w, h) => {
    ctx.fillStyle = "#2f6b3a";
    ctx.fillRect(0, 0, w, h);
    for (let y = 6; y < h; y += 16) {
      ctx.strokeStyle = y % 32 < 16 ? "rgba(150,205,140,0.35)" : "rgba(20,60,30,0.35)";
      ctx.lineWidth = 5;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 8) ctx.lineTo(x, y + Math.sin(x * 0.12 + y) * 4);
      ctx.stroke();
    }
    // Pale yellow-green edges
    const edge = ctx.createLinearGradient(0, 0, w, 0);
    edge.addColorStop(0, "rgba(214,200,96,0.7)");
    edge.addColorStop(0.16, "rgba(214,200,96,0)");
    edge.addColorStop(0.84, "rgba(214,200,96,0)");
    edge.addColorStop(1, "rgba(214,200,96,0.7)");
    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, w, h);
  }).texture;
  const leafMat = new THREE.MeshStandardMaterial({ map: leafTex, roughness: 0.5 });

  // A sword leaf: narrow base, widest a third of the way up, pointed tip,
  // curving gently back toward the top.
  function swordLeaf(h, w, curl) {
    const shape = new THREE.Shape();
    shape.moveTo(-w * 0.32, 0);
    shape.quadraticCurveTo(-w, h * 0.35, -w * 0.62, h * 0.74);
    shape.quadraticCurveTo(-w * 0.18, h * 0.96, 0, h);
    shape.quadraticCurveTo(w * 0.18, h * 0.96, w * 0.62, h * 0.74);
    shape.quadraticCurveTo(w, h * 0.35, w * 0.32, 0);
    shape.closePath();
    const depth = 0.012;
    const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 1, curveSegments: 14 });
    g.translate(0, 0, -depth / 2);
    const pos = g.attributes.position;
    const uv = g.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const t = y / h;
      pos.setZ(i, pos.getZ(i) - curl * t * t * h); // lean back toward the tip
      uv.setXY(i, (x + w) / (2 * w), t);
    }
    pos.needsUpdate = true;
    uv.needsUpdate = true;
    g.computeVertexNormals();
    return g;
  }
  const LEAVES = [
    // yaw, outward tilt, height, width, curl, offset from centre
    [0.2, 0.05, 1.25, 0.11, 0.08, 0.02],
    [1.1, 0.16, 1.05, 0.1, 0.12, 0.06],
    [2.0, 0.12, 1.15, 0.11, 0.1, 0.05],
    [2.9, 0.2, 0.95, 0.1, 0.14, 0.08],
    [3.7, 0.1, 1.2, 0.11, 0.09, 0.05],
    [4.6, 0.22, 0.85, 0.09, 0.16, 0.1],
    [5.4, 0.14, 1.0, 0.1, 0.12, 0.07],
    [0.7, 0.28, 0.75, 0.09, 0.18, 0.13],
    [3.3, 0.3, 0.7, 0.085, 0.2, 0.14],
    [5.9, 0.26, 0.8, 0.09, 0.18, 0.12],
  ];
  for (const [yaw, tilt, h, w, curl, off] of LEAVES) {
    const leaf = new THREE.Mesh(swordLeaf(h, w, curl), leafMat);
    leaf.castShadow = true;
    leaf.receiveShadow = true;
    const holder = new THREE.Group();
    holder.position.set(Math.cos(yaw) * off, 0.55, Math.sin(yaw) * off);
    holder.rotation.set(0, -yaw - Math.PI / 2, 0); // local -Z faces outward from the pot centre
    leaf.rotation.x = -tilt; // lean outward, away from the centre
    holder.add(leaf);
    plant.add(holder);
  }
  room.add(plant);

  // The developer, seated and typing
  const rig = buildCharacter(clayMaterials());
  poseSitting(rig);
  rig.root.position.set(0, SEAT_DROP, ROOT_Z);
  rig.root.rotation.y = Math.PI;
  room.add(rig.root);

  return { room, rig, screens, chair, mouse, mouseBody, keyboard, keycaps, speaker, speakerParts, musicNotes, decor };
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

  const { room, rig, screens, chair, mouse, mouseBody, keyboard, keycaps, speaker, speakerParts, musicNotes, decor } = buildRoom();
  scene.add(room);
  const holo = buildHoloStage();
  scene.add(holo.stage);

  const roomCam = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  const holoCam = new THREE.PerspectiveCamera(30, 1, 0.1, 100);

  // 3/4 front-left isometric camera angle
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

  // Desk work ------------------------------------------------------------------
  // Hands are placed with two-bone IK: we pick a point (a key, the mouse) and
  // solve shoulder + elbow so the hand lands exactly there. A small scheduler
  // switches between two-handed typing, using the mouse and pausing to think.
  // arms[0] is the hand nearest the mouse; arms[1] types on the left half.
  const rand = (a, b) => a + Math.random() * (b - a);
  const smooth5 = (t) => t * t * t * (t * (t * 6 - 15) + 10); // minimum-jerk easing
  const UPPER = 0.31;
  const FORE = 0.37; // forearm + hand centre offset
  const KEY_TOP = 0.045; // keycap top above the keyboard origin
  const HOVER = 0.05; // hand centre above a key while resting
  const DIP = 0.02; // how far the hand drops to press
  const PRESS = 0.075;
  const CLICK = 0.09;
  const CAP_Y = 0.036;

  const ik = {
    target: new THREE.Vector3(),
    dir: new THREE.Vector3(),
    pole: new THREE.Vector3(),
    up: new THREE.Vector3(),
    elbow: new THREE.Vector3(),
    bend: new THREE.Vector3(),
    x: new THREE.Vector3(),
    m: new THREE.Matrix4(),
  };

  // Places arm's hand centre at `point` (room space). `side` is the arm's local
  // x side (-1 / 1) so the elbow points down, outward and a little back.
  function reach(arm, side, point) {
    ik.target.copy(point);
    room.localToWorld(ik.target);
    rig.body.worldToLocal(ik.target);
    ik.dir.subVectors(ik.target, arm.shoulder.position);
    const d = THREE.MathUtils.clamp(ik.dir.length(), Math.abs(UPPER - FORE) + 1e-3, UPPER + FORE - 1e-3);
    ik.dir.normalize();

    const cosShoulder = (UPPER * UPPER + d * d - FORE * FORE) / (2 * UPPER * d);
    const cosElbow = (UPPER * UPPER + FORE * FORE - d * d) / (2 * UPPER * FORE);
    const shoulderAngle = Math.acos(THREE.MathUtils.clamp(cosShoulder, -1, 1));
    const bend = Math.PI - Math.acos(THREE.MathUtils.clamp(cosElbow, -1, 1));

    // Upper arm: rotate the shoulder→target line toward the pole by shoulderAngle.
    ik.pole.set(side * 1.3, -1, -0.25);
    ik.pole.addScaledVector(ik.dir, -ik.pole.dot(ik.dir)).normalize();
    ik.up.copy(ik.dir).multiplyScalar(Math.cos(shoulderAngle)).addScaledVector(ik.pole, Math.sin(shoulderAngle));
    ik.elbow.copy(arm.shoulder.position).addScaledVector(ik.up, UPPER);

    // Limbs hang along local -Y and the elbow bends toward local +Z, so build the
    // upper-arm frame with +Z pointing from the elbow toward the target.
    ik.bend.subVectors(ik.target, ik.elbow);
    ik.bend.addScaledVector(ik.up, -ik.bend.dot(ik.up));
    if (ik.bend.lengthSq() < 1e-8) ik.bend.copy(ik.pole).negate();
    ik.bend.normalize();
    ik.up.negate(); // local +Y
    ik.x.crossVectors(ik.up, ik.bend);
    ik.m.makeBasis(ik.x, ik.up, ik.bend);
    arm.shoulder.quaternion.setFromRotationMatrix(ik.m);
    arm.elbow.rotation.set(-bend, 0, 0);
  }

  // Keys each hand types: left / right half of the keyboard, plus the spacebar.
  keyboard.updateMatrixWorld(true);
  const keyPoint = (cap, out) => out.set(cap.position.x, KEY_TOP, cap.position.z).applyMatrix4(keyboard.matrix);
  // The spacebar is the bottom-row key at the centre (x ≈ -0.02, z ≈ 0.08).
  const spaceBar = keycaps.reduce((a, c) =>
    Math.hypot(c.position.x + 0.02, c.position.z - 0.08) < Math.hypot(a.position.x + 0.02, a.position.z - 0.08) ? c : a);
  const letters = keycaps.filter((c) => c !== spaceBar);
  const halves = [letters.filter((c) => c.position.x >= 0), letters.filter((c) => c.position.x < 0)];
  const homeCap = [0.17, -0.17].map((x) => letters.reduce((a, c) =>
    Math.abs(c.position.x - x) + Math.abs(c.position.z + 0.028) < Math.abs(a.position.x - x) + Math.abs(a.position.z + 0.028) ? c : a));

  const makeHand = (i) => {
    const p = keyPoint(homeCap[i], new THREE.Vector3());
    p.y += HOVER;
    return { from: p.clone(), to: p.clone(), start: -1, dur: 1, arc: 0, pressAt: -9, cap: null, x: homeCap[i].position.x, pos: p.clone() };
  };
  const hands = [makeHand(0), makeHand(1)];
  const desk = {
    mode: "type",
    until: 0,
    nextKey: 0,
    lastHand: 1,
    typed: 0,
    ui: 0,
    mouseHand: "keyboard", // keyboard → toMouse → mouse → toKeyboard
    mouse: { from: MOUSE_HOME.clone(), to: MOUSE_HOME.clone(), start: -1, dur: 1 },
    nextMouse: 0,
    clicks: [],
    lastClick: -1,
    caps: [],
  };
  const tmpA = new THREE.Vector3();
  const mousePos = MOUSE_HOME.clone();

  function handNow(h, time, out) {
    const t = smooth5(THREE.MathUtils.clamp((time - h.start) / h.dur, 0, 1));
    out.lerpVectors(h.from, h.to, t);
    out.y += Math.sin(t * Math.PI) * h.arc;
    const s = time - h.pressAt;
    if (s >= 0 && s < PRESS) out.y -= Math.sin((s / PRESS) * Math.PI) * DIP;
    return out;
  }
  function moveHand(h, to, time, dur, arc) {
    handNow(h, time, h.from);
    h.to.copy(to);
    h.start = time;
    h.dur = dur;
    h.arc = arc;
  }
  const arrived = (h, time) => time >= h.start + h.dur;

  function restPoint(i, out) {
    keyPoint(homeCap[i], out);
    out.y += HOVER;
    return out;
  }
  const onMousePoint = (out) => out.set(mousePos.x, mousePos.y + 0.08, mousePos.z + 0.05);

  function pickMode(time) {
    const r = Math.random();
    const prev = desk.mode;
    desk.mode = prev === "type" ? (r < 0.45 ? "mouse" : r < 0.7 ? "think" : "type")
      : prev === "mouse" ? (r < 0.75 ? "type" : "think")
      : (r < 0.7 ? "type" : "mouse");
    desk.until = time + (desk.mode === "type" ? rand(3, 7) : desk.mode === "mouse" ? rand(1.8, 3.5) : rand(0.8, 1.8));
    desk.nextKey = time + rand(0.1, 0.25);

    // Settle both hands back over their home keys when not typing.
    if (desk.mode !== "type") {
      for (const i of [0, 1]) {
        if (i === 0 && desk.mouseHand !== "keyboard") continue;
        moveHand(hands[i], restPoint(i, tmpA), time, 0.25, 0.01);
      }
    }
    if (desk.mode === "mouse" && desk.mouseHand === "keyboard") {
      desk.mouseHand = "toMouse";
      moveHand(hands[0], onMousePoint(tmpA), time, rand(0.32, 0.42), 0.06);
      desk.nextMouse = time + 0.6;
    }
    if (desk.mode !== "mouse" && desk.mouseHand === "mouse") {
      desk.mouseHand = "toKeyboard";
      moveHand(hands[0], restPoint(0, tmpA), time, rand(0.32, 0.42), 0.06);
    }
  }

  function strike(time) {
    // Mostly alternate hands; spaces between words come from whichever hand is free.
    const space = Math.random() < 0.17;
    let i = Math.random() < 0.68 ? 1 - desk.lastHand : desk.lastHand;
    if (desk.mouseHand !== "keyboard") i = 1;
    const h = hands[i];
    let cap;
    if (space) {
      cap = spaceBar;
    } else {
      // Prefer keys near where the hand already is.
      const pool = halves[i];
      const near = pool.filter((c) => Math.abs(c.position.x - h.x) < 0.16);
      const from = near.length && Math.random() < 0.65 ? near : pool;
      cap = from[Math.floor(Math.random() * from.length)];
    }
    keyPoint(cap, tmpA);
    if (space) tmpA.x += (i === 0 ? 1 : -1) * 0.07; // thumbs land either side of centre
    tmpA.y += HOVER;
    const dur = rand(0.05, 0.085);
    moveHand(h, tmpA, time, dur, 0.012);
    h.pressAt = time + dur;
    h.cap = cap;
    h.x = space ? h.x : cap.position.x;
    desk.lastHand = i;
    // ~7 keys/s inside a burst, word gaps after a space, the odd longer pause.
    const r = Math.random();
    desk.nextKey = time + (space ? rand(0.18, 0.32) : r < 0.06 ? rand(0.45, 0.9) : rand(0.1, 0.16));
  }

  function workAtDesk(time) {
    if (time > desk.until) pickMode(time);
    rig.root.updateMatrixWorld(true);

    if (desk.mode === "type" && time >= desk.nextKey) strike(time);

    // Key presses land: count the keystroke and dip the keycap.
    for (const h of hands) {
      if (h.cap && time >= h.pressAt) {
        desk.caps.push({ cap: h.cap, at: h.pressAt });
        desk.typed += 1;
        screens[1].redraw(desk.typed);
        h.cap = null;
      }
    }

    // Mouse hand travel + mouse use ----------------------------------------
    const h0 = hands[0];
    if (desk.mouseHand === "toMouse" && arrived(h0, time)) desk.mouseHand = "mouse";
    if (desk.mouseHand === "toKeyboard" && arrived(h0, time)) desk.mouseHand = "keyboard";

    let click = 0;
    if (desk.mouseHand === "mouse") {
      const mm = desk.mouse;
      if (desk.mode === "mouse" && time >= desk.nextMouse) {
        mm.from.copy(mousePos);
        const far = Math.random() < 0.3;
        mm.to.set(
          THREE.MathUtils.clamp(mousePos.x + rand(-1, 1) * (far ? 0.1 : 0.035), MOUSE_HOME.x - 0.1, MOUSE_HOME.x + 0.02),
          MOUSE_HOME.y,
          THREE.MathUtils.clamp(mousePos.z + rand(-1, 1) * (far ? 0.07 : 0.025), MOUSE_HOME.z - 0.04, MOUSE_HOME.z + 0.06),
        );
        mm.start = time;
        mm.dur = far ? rand(0.4, 0.7) : rand(0.18, 0.35);
        const arrive = time + mm.dur;
        const c = Math.random();
        if (c < 0.45) desk.clicks.push(arrive + rand(0.06, 0.15));
        if (c < 0.1) desk.clicks.push(arrive + rand(0.24, 0.3)); // double click
        desk.nextMouse = arrive + rand(0.15, 0.6);
      }
      const mt = smooth5(THREE.MathUtils.clamp((time - mm.start) / mm.dur, 0, 1));
      const prevX = mousePos.x;
      mousePos.lerpVectors(mm.from, mm.to, mt);
      mouse.position.copy(mousePos);
      mouse.rotation.y = THREE.MathUtils.lerp(mouse.rotation.y, (mousePos.x - prevX) * -12, 0.2);

      desk.clicks = desk.clicks.filter((at) => {
        const s = time - at;
        if (s >= 0 && s < CLICK) {
          click = Math.max(click, Math.sin((s / CLICK) * Math.PI));
          if (desk.lastClick !== at) {
            desk.lastClick = at;
            screens[0].redraw(++desk.ui);
          }
        }
        return s < CLICK;
      });
      // The hand rides the mouse exactly.
      onMousePoint(h0.to);
      h0.from.copy(h0.to);
      h0.arc = 0;
      h0.to.y -= click * 0.006;
      h0.from.y = h0.to.y;
    } else {
      desk.clicks.length = 0;
    }
    mouseBody.scale.y = 1 - click * 0.08;

    // Solve both arms ---------------------------------------------------------
    for (const [i, h] of hands.entries()) {
      handNow(h, time, h.pos);
      reach(rig.arms[i], i === 0 ? -1 : 1, h.pos);
    }
  }

  // Runs every frame (not only while working) so pressed keys always pop back up.
  function releaseCap(time) {
    desk.caps = desk.caps.filter(({ cap, at }) => {
      const s = time - at;
      cap.position.y = s >= 0 && s < PRESS ? CAP_Y - 0.009 * Math.sin((s / PRESS) * Math.PI) : CAP_Y;
      return s < PRESS;
    });
  }

  // Render loop ------------------------------------------------------------------
  let target = 0;
  let progress = 0;
  const lookAt = new THREE.Vector3();
  const look = new THREE.Vector2();
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
    releaseCap(time);

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
      rig.root.position.set(stand * 0.9, THREE.MathUtils.lerp(SEAT_DROP, 0, Math.min(1, stand * 1.6)), THREE.MathUtils.lerp(ROOT_Z, 0.55, stand));
      rig.root.rotation.y = THREE.MathUtils.lerp(Math.PI, ROOM_FACE_CAMERA, stand);
      chair.position.set(-stand * 0.25, 0, CHAIR_Z + stand * 0.2);
      chair.rotation.y = stand * 0.5;
      rig.head.rotation.set(look.y * 0.3 * stand, look.x * 0.6 * stand, 0);
      if (wave >= 0) {
        applyWave(rig.arms[1], 1, time, wave);
      } else if (stand > 0.35) {
        // Automatic greeting wave as the character finishes turning around
        const autoWave = Math.min(1, (stand - 0.35) / 0.65);
        applyWave(rig.arms[1], 1, time, autoWave * 0.5);
      }
    } else {
      rig.root.position.set(0, SEAT_DROP, ROOT_Z);
      rig.root.rotation.y = Math.PI;
      chair.position.set(0, 0, CHAIR_Z);
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
          rig.root.position.set(-0.12 * Math.sin(swivel), SEAT_DROP, CHAIR_Z - 0.12 * Math.cos(swivel));
          rig.head.rotation.set(-0.05 * turnAmt, 0.15 * turnAmt, 0.04 * turnAmt);
          // Mouse hand comes off the desk and rests in the lap while the other waves
          rig.arms[0].shoulder.rotation.set(
            THREE.MathUtils.lerp(-0.368, -0.25, turnAmt), THREE.MathUtils.lerp(0.805, 0, turnAmt), THREE.MathUtils.lerp(-0.512, -0.18, turnAmt));
          rig.arms[0].elbow.rotation.set(
            THREE.MathUtils.lerp(-1.388, -0.95, turnAmt), THREE.MathUtils.lerp(0, 0.3, turnAmt), THREE.MathUtils.lerp(0, 0.08, turnAmt));
          applyWave(rig.arms[1], 1, time, wave);
        } else {
          workAtDesk(time);
        }
      }
    }

    decor.update(time, !reducedMotion);

    // Speaker & floating musical notes animation when music is active
    const musicActive = Boolean(isMusicOn?.());
    if (musicActive && !reducedMotion) {
      const beat = Math.sin(time * 9.5);
      const pulse = Math.max(0, beat);
      for (const { body, woofer } of speakerParts) {
        body.scale.set(1 + pulse * 0.035, 1 - pulse * 0.025, 1 + pulse * 0.035);
        woofer.scale.set(1 + pulse * 0.12, 1 + pulse * 0.12, 0.52 + pulse * 0.18);
      }
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
      for (const { body, woofer } of speakerParts) {
        body.scale.set(1, 1, 1);
        woofer.scale.set(1, 1, 0.52);
      }
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
  if (reducedMotion) screens[1].redraw(1e6);

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
