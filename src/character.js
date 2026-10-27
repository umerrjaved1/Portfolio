import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

// A stylised developer built from primitives (about 2.3 units tall, head ≈ 1/3.5
// of the height). Front faces +z, feet at y = 0 when standing.
// `materials` maps part names to materials, so the same rig can be built solid
// (clay colours) or as a hologram (one shader for every part).

export const CLAY = {
  skin: 0xf3c7a2,
  hair: 0x6b4630,
  shirt: 0x3d3e45,
  jeans: 0x2c3247,
  sock: 0xf6f3ee,
  shoe: 0xf7f5f0,
  sole: 0x4a4b52,
  eye: 0x231c18,
  white: 0xffffff,
};

export function clayMaterials() {
  const m = (color, roughness = 0.75) => new THREE.MeshStandardMaterial({ color, roughness });
  return {
    skin: m(CLAY.skin, 0.62),
    hair: m(CLAY.hair, 0.85),
    shirt: m(CLAY.shirt, 0.9),
    jeans: m(CLAY.jeans, 0.9),
    sock: m(CLAY.sock),
    shoe: m(CLAY.shoe, 0.5),
    sole: m(CLAY.sole, 0.6),
    eye: m(CLAY.eye, 0.25),
    white: new THREE.MeshBasicMaterial({ color: CLAY.white }),
  };
}

const HIP_Y = 0.94;

function add(parent, geometry, material, [x, y, z] = [0, 0, 0]) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

function limb(radius, length, material) {
  const pivot = new THREE.Group();
  add(pivot, new THREE.CapsuleGeometry(radius, length, 6, 16), material, [0, -length / 2, 0]);
  const end = new THREE.Group();
  end.position.y = -length;
  pivot.add(end);
  return { pivot, end };
}

function buildHead(materials) {
  const head = new THREE.Group();
  const skull = add(head, new THREE.SphereGeometry(0.32, 40, 32), materials.skin);
  skull.scale.set(1, 1.03, 0.95);

  // Hair: one smooth shell tilted back (high hairline, covers the back of the
  // head down to the nape) plus a side-parted sweep over the forehead.
  const cap = add(head, new THREE.SphereGeometry(0.345, 48, 28, 0, Math.PI * 2, 0, Math.PI * 0.52), materials.hair, [0, 0.02, -0.01]);
  cap.rotation.x = -0.6;
  cap.scale.set(1.03, 1.04, 1.02);
  const sweep = add(head, new THREE.SphereGeometry(0.2, 28, 20), materials.hair, [0.04, 0.23, 0.16]);
  sweep.scale.set(1.6, 0.6, 0.95);
  sweep.rotation.set(-0.4, 0, -0.2);

  // Ears, eyes, brows, nose, mouth
  for (const x of [-1, 1]) {
    const ear = add(head, new THREE.SphereGeometry(0.06, 16, 12), materials.skin, [x * 0.31, -0.03, -0.01]);
    ear.scale.set(0.6, 1, 0.9);
    const eye = add(head, new THREE.SphereGeometry(0.048, 20, 16), materials.eye, [x * 0.115, -0.02, 0.285]);
    eye.scale.set(1, 1.3, 0.55);
    add(head, new THREE.SphereGeometry(0.015, 8, 8), materials.white, [x * 0.115 + 0.016, 0.012, 0.31]);
    const brow = add(head, new THREE.CapsuleGeometry(0.014, 0.07, 4, 8), materials.hair, [x * 0.12, 0.085, 0.29]);
    brow.rotation.z = Math.PI / 2 + x * 0.12;
  }
  const nose = add(head, new THREE.SphereGeometry(0.03, 12, 10), materials.skin, [0, -0.07, 0.305]);
  nose.scale.set(1, 0.8, 0.8);
  const mouth = add(head, new THREE.TorusGeometry(0.035, 0.009, 8, 16, Math.PI), materials.eye, [0.01, -0.15, 0.285]);
  mouth.rotation.z = Math.PI;
  return head;
}

export function buildCharacter(materials) {
  const root = new THREE.Group();

  // Torso, head and arms are parented to `body` so they breathe/bob together.
  const body = new THREE.Group();
  body.position.y = HIP_Y;
  root.add(body);

  add(body, new RoundedBoxGeometry(0.46, 0.2, 0.3, 4, 0.08), materials.jeans, [0, 0.04, 0]);
  add(body, new RoundedBoxGeometry(0.5, 0.58, 0.31, 5, 0.13), materials.shirt, [0, 0.36, 0]);
  add(body, new THREE.CylinderGeometry(0.07, 0.08, 0.12, 16), materials.skin, [0, 0.68, 0]);
  const collar = add(body, new THREE.TorusGeometry(0.085, 0.02, 8, 24), materials.shirt, [0, 0.645, 0.005]);
  collar.rotation.x = Math.PI / 2;

  const head = buildHead(materials);
  head.position.y = 1.03;
  body.add(head);

  const arms = [-1, 1].map((side) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.3, 0.57, 0);
    body.add(shoulder);
    add(shoulder, new THREE.SphereGeometry(0.1, 16, 12), materials.shirt);
    const upper = limb(0.07, 0.28, materials.skin);
    shoulder.add(upper.pivot);
    add(upper.pivot, new THREE.CapsuleGeometry(0.092, 0.1, 6, 16), materials.shirt, [0, -0.07, 0]); // sleeve
    const fore = limb(0.062, 0.25, materials.skin);
    fore.pivot.rotation.order = "YXZ"; // bend first, then swing (used by crossed arms)
    upper.end.add(fore.pivot);
    const hand = add(fore.end, new THREE.SphereGeometry(0.075, 16, 12), materials.skin, [0, -0.03, 0]);
    hand.scale.set(0.85, 1.05, 0.7);
    shoulder.rotation.z = side * 0.1;
    return { shoulder, elbow: fore.pivot };
  });

  const legs = [-1, 1].map((side) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.12, HIP_Y, 0);
    root.add(hip);
    const thigh = limb(0.1, 0.36, materials.jeans);
    hip.add(thigh.pivot);
    const shin = limb(0.085, 0.3, materials.jeans);
    thigh.end.add(shin.pivot);
    const cuff = add(shin.pivot, new THREE.CylinderGeometry(0.098, 0.098, 0.07, 20), materials.jeans, [0, -0.29, 0]);
    cuff.scale.z = 0.95;
    add(shin.pivot, new THREE.CylinderGeometry(0.06, 0.062, 0.14, 16), materials.sock, [0, -0.36, 0]);
    const foot = new THREE.Group();
    foot.position.y = -0.42;
    shin.pivot.add(foot);
    add(foot, new RoundedBoxGeometry(0.17, 0.11, 0.3, 4, 0.05), materials.shoe, [0, -0.02, 0.06]);
    add(foot, new RoundedBoxGeometry(0.18, 0.035, 0.31, 3, 0.015), materials.sole, [0, -0.075, 0.06]);
    return { hip, knee: shin.pivot, foot };
  });

  return { root, body, head, arms, legs };
}

const BODY_Y = HIP_Y;
export const SEAT_DROP = -0.36; // root.y offset so the seated hips rest on a ~0.48 high seat

export function poseSitting(rig) {
  rig.body.position.y = BODY_Y;
  for (const leg of rig.legs) {
    leg.hip.rotation.set(-Math.PI / 2, 0, 0);
    leg.knee.rotation.set(Math.PI / 2, 0, 0);
  }
  rig.arms.forEach((arm, i) => {
    arm.shoulder.rotation.set(-0.8, 0, (i === 0 ? -1 : 1) * 0.1);
    arm.elbow.rotation.set(-0.85, 0, 0);
  });
}

export function poseStanding(rig) {
  rig.body.position.y = BODY_Y;
  for (const leg of rig.legs) {
    leg.hip.rotation.set(0, 0, 0);
    leg.knee.rotation.set(0, 0, 0);
  }
  rig.arms.forEach((arm, i) => {
    arm.shoulder.rotation.set(0, 0, (i === 0 ? -1 : 1) * 0.12);
    arm.elbow.rotation.set(-0.12, 0, 0);
  });
}

export function poseArmsCrossed(rig) {
  poseStanding(rig);
  rig.arms.forEach((arm, i) => {
    const side = i === 0 ? -1 : 1;
    // Upper arms hang slightly forward; forearms swing inward (z) then lift level (x).
    arm.shoulder.rotation.set(-0.5, 0, side * 0.12);
    arm.elbow.rotation.set(side > 0 ? -1.0 : -1.16, 0, -side * 1.2);
  });
}

// Blends every joint between two poses (t = 0 → a, 1 → b).
export function blendPose(rig, poseA, poseB, t) {
  poseA(rig);
  const a = snapshot(rig);
  poseB(rig);
  const b = snapshot(rig);
  const joints = jointsOf(rig);
  joints.forEach((joint, i) => {
    joint.rotation.set(
      THREE.MathUtils.lerp(a[i].x, b[i].x, t),
      THREE.MathUtils.lerp(a[i].y, b[i].y, t),
      THREE.MathUtils.lerp(a[i].z, b[i].z, t),
    );
  });
}

function jointsOf(rig) {
  return [...rig.legs.flatMap((l) => [l.hip, l.knee]), ...rig.arms.flatMap((a) => [a.shoulder, a.elbow])];
}
function snapshot(rig) {
  return jointsOf(rig).map((j) => j.rotation.clone());
}
