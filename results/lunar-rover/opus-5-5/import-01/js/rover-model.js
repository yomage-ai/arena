// Six-wheel rocker-bogie lunar rover, built from primitives and procedural maps.
// Frame: +X forward, +Y up, +Z right. Origin = midpoint of the rocker pivot axis.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as TX from './textures.js';

export const K = {
  r: 0.155, width: 0.14, pivotH: 0.52,
  zRock: 0.48, zBogie: 0.535, zWheel: 0.62,
  front: { x: 0.6, mountY: -0.15 },
  bogie: { x: -0.32, y: -0.2 },
  mid: { x: 0.3, mountY: 0.05 },
  rear: { x: -0.3, mountY: 0.05 },
  fork: 0.215,
  diff: { y: 0.375, half: 0.46, crank: 0.2 },
};

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);

/* ---------------------------------------------------------------- materials */
function makeMaterials() {
  const crinkle = TX.makeCrinkleMaps();
  const solar = TX.makeSolarMaps();
  const osr = TX.makeOSRMaps();
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const M = {
    gold: std({ color: '#d7a444', metalness: 1, roughness: 0.78, normalMap: crinkle.normal, normalScale: new THREE.Vector2(0.9, 0.9), roughnessMap: crinkle.rough }),
    goldDeep: std({ color: '#b9812c', metalness: 1, roughness: 0.7, normalMap: crinkle.normal, normalScale: new THREE.Vector2(0.7, 0.7), roughnessMap: crinkle.rough }),
    silverFoil: std({ color: '#d4d6da', metalness: 1, roughness: 0.62, normalMap: crinkle.normal, normalScale: new THREE.Vector2(0.8, 0.8), roughnessMap: crinkle.rough }),
    blackKapton: std({ color: '#161618', metalness: 0.35, roughness: 0.5, normalMap: crinkle.normal, normalScale: new THREE.Vector2(0.5, 0.5) }),
    tape: std({ color: '#c9ccd1', metalness: 1, roughness: 0.3 }),
    white: std({ color: '#e7e5df', metalness: 0, roughness: 0.55 }),
    alu: std({ color: '#c5c8cc', metalness: 1, roughness: 0.34 }),
    aluDark: std({ color: '#7a7e84', metalness: 1, roughness: 0.42 }),
    titan: std({ color: '#a19c94', metalness: 1, roughness: 0.3 }),
    black: std({ color: '#121315', metalness: 0.25, roughness: 0.55 }),
    blackMatte: std({ color: '#0b0b0c', metalness: 0, roughness: 0.9 }),
    connector: std({ color: '#e2b65a', metalness: 1, roughness: 0.22 }),
    cable: std({ color: '#26241f', metalness: 0, roughness: 0.6 }),
    cableW: std({ color: '#dcd6c6', metalness: 0, roughness: 0.5 }),
    orange: std({ color: '#c8562a', metalness: 0, roughness: 0.5 }),
    solar: new THREE.MeshPhysicalMaterial({
      map: solar.map, roughnessMap: solar.rm, metalnessMap: solar.rm, roughness: 1, metalness: 1,
      clearcoat: 1, clearcoatRoughness: 0.05,
    }),
    carbon: std({ map: TX.makeCarbon(), metalness: 0.55, roughness: 0.48 }),
    osr: std({ map: osr.map, roughnessMap: osr.rm, metalnessMap: osr.rm, roughness: 1, metalness: 1 }),
    glass: new THREE.MeshPhysicalMaterial({
      color: '#07070c', metalness: 0, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02,
      iridescence: 1, iridescenceIOR: 1.8, iridescenceThicknessRange: [250, 520], envMapIntensity: 2.2,
    }),
    wheel: std({ color: '#b8bbc0', metalness: 1, roughness: 0.4, alphaMap: TX.makeWheelAlpha(), alphaTest: 0.5, side: THREE.DoubleSide }),
    label: std({ map: TX.makeLabel(['月面巡视器', 'LUNAR ROVER · LR-01 · 140 kg']), roughness: 0.55 }),
    cal: std({ map: TX.makeCalTarget(), roughness: 0.85 }),
    dish: std({ color: '#ecebe7', metalness: 0, roughness: 0.45, side: THREE.DoubleSide }),
  };
  M.osr.map.repeat.set(1, 1);
  // foil textures are applied with box-projected UVs (texels per metre)
  M.gold.userData.boxUV = 2.2;
  M.goldDeep.userData.boxUV = 3.2;
  M.silverFoil.userData.boxUV = 2.6;
  M.blackKapton.userData.boxUV = 2.4;
  M.osr.userData.boxUV = 2.2;
  M.carbon.userData.boxUV = 3.0;
  return M;
}

/* ---------------------------------------------------------------- builders */
class B {
  constructor(group, M) { this.g = group; this.M = M; }
  at(group) { return new B(group, this.M); }
  add(geo, mat, pos, rot, order = 'XYZ') {
    const m = new THREE.Mesh(geo, typeof mat === 'string' ? this.M[mat] : mat);
    if (pos) m.position.copy(pos);
    if (rot) m.rotation.set(rot[0], rot[1], rot[2], order);
    m.castShadow = true;
    m.receiveShadow = true;
    this.g.add(m);
    return m;
  }
  box(w, h, d, mat, x, y, z, r = 0.004, rot) {
    const rr = Math.min(r, Math.min(w, h, d) / 2 - 1e-4);
    const geo = rr > 0.0005 ? new RoundedBoxGeometry(w, h, d, 2, rr) : new THREE.BoxGeometry(w, h, d);
    return this.add(geo, mat, V(x, y, z), rot);
  }
  cyl(r, h, mat, x, y, z, axis = 'y', seg = 28, rTop = r, open = false) {
    const geo = new THREE.CylinderGeometry(rTop, r, h, seg, 1, open);
    const rot = axis === 'x' ? [0, 0, -Math.PI / 2] : axis === 'z' ? [Math.PI / 2, 0, 0] : null;
    return this.add(geo, mat, V(x, y, z), rot);
  }
  rod(a, b, r, mat, seg = 14) {
    const d = b.clone().sub(a);
    const len = d.length();
    const m = this.add(new THREE.CylinderGeometry(r, r, len, seg, 1), mat, a.clone().add(b).multiplyScalar(0.5));
    m.quaternion.setFromUnitVectors(UP, d.normalize());
    return m;
  }
  tube(points, r, mat, seg = 64, radial = 8) {
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
    return this.add(new THREE.TubeGeometry(curve, seg, r, radial, false), mat);
  }
  // ring of bolt heads on a face perpendicular to axis
  bolts(cx, cy, cz, axis, radius, n, size = 0.006, mat = 'alu') {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const u = Math.cos(a) * radius, v = Math.sin(a) * radius;
      const p = axis === 'z' ? V(cx + u, cy + v, cz) : axis === 'x' ? V(cx, cy + u, cz + v) : V(cx + u, cy, cz + v);
      this.cyl(size, size * 0.8, mat, p.x, p.y, p.z, axis, 6);
    }
  }
}

function boxUV(g, s) {
  const p = g.attributes.position, n = g.attributes.normal;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u, v;
    if (ax >= ay && ax >= az) { u = p.getZ(i); v = p.getY(i); }
    else if (ay >= az) { u = p.getX(i); v = p.getZ(i); }
    else { u = p.getX(i); v = p.getY(i); }
    uv[i * 2] = u * s; uv[i * 2 + 1] = v * s;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

// Bake every direct mesh child of a rigid group into one mesh per material.
function mergeStatic(group) {
  const byMat = new Map();
  for (const child of [...group.children]) {
    if (!child.isMesh || child.userData.keep) continue;
    child.updateMatrix();
    let g = child.geometry.index ? child.geometry.toNonIndexed() : child.geometry.clone();
    g.applyMatrix4(child.matrix);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    const mat = child.material;
    if (mat.userData.boxUV) boxUV(g, mat.userData.boxUV);
    if (!byMat.has(mat)) byMat.set(mat, []);
    byMat.get(mat).push(g);
    group.remove(child);
    child.geometry.dispose();
  }
  for (const [mat, list] of byMat) {
    const m = new THREE.Mesh(mergeGeometries(list, false), mat);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  }
}

/* ---------------------------------------------------------------- wheel */
function buildWheelGeometry(M) {
  // Outer face toward +Z. Returned as a group template (merged).
  const g = new THREE.Group();
  const b = new B(g, M);
  const r = K.r, w = K.width;
  // perforated skin
  b.cyl(r - 0.004, w, 'wheel', 0, 0, 0, 'z', 72, r - 0.004, true);
  // grousers (cleats)
  const n = 20;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const m = b.box(0.007, 0.016, w - 0.004, 'alu', Math.cos(a) * (r + 0.003), Math.sin(a) * (r + 0.003), 0, 0.001);
    m.rotation.z = a - Math.PI / 2;
  }
  // edge rims
  for (const s of [-1, 1]) {
    b.add(new THREE.TorusGeometry(r - 0.004, 0.0055, 8, 72), 'aluDark', V(0, 0, s * (w / 2 - 0.002)));
  }
  // spokes on both faces, offset
  for (const s of [-1, 1]) {
    const k = 8;
    for (let i = 0; i < k; i++) {
      const a = (i / k) * Math.PI * 2 + (s > 0 ? 0 : Math.PI / k);
      const a2 = a + 0.28 * s;
      const p0 = V(Math.cos(a) * 0.045, Math.sin(a) * 0.045, s * 0.03);
      const p1 = V(Math.cos(a2) * (r - 0.01), Math.sin(a2) * (r - 0.01), s * (w / 2 - 0.006));
      b.rod(p0, p1, 0.0045, 'titan', 8);
    }
  }
  // hub
  b.cyl(0.05, 0.075, 'aluDark', 0, 0, 0.005, 'z', 32);
  b.cyl(0.036, 0.012, 'alu', 0, 0, 0.048, 'z', 32);
  b.bolts(0, 0, 0.055, 'z', 0.024, 6, 0.004, 'titan');
  b.cyl(0.011, 0.01, 'black', 0, 0, 0.058, 'z', 16);
  mergeStatic(g);
  return g;
}

/* ---------------------------------------------------------------- rover */
export function buildRover() {
  const M = makeMaterials();
  const root = new THREE.Group();
  root.name = 'rover';
  const body = new THREE.Group();
  root.add(body);
  const b = new B(body, M);
  const J = { root, body, M, rockers: [], bogies: [], steer: {}, wheels: [], links: [] };

  /* ---- main body: warm electronics box wrapped in MLI ---- */
  const bx = -0.02, by = 0.08, L = 1.0, Hh = 0.44, W = 0.72;
  b.box(L, Hh, W, 'gold', bx, by, 0, 0.03);
  // blanket seams & tape
  for (const zz of [-W / 2 - 0.001, W / 2 + 0.001]) {
    for (const xx of [-0.22, 0.2]) b.box(0.03, Hh - 0.04, 0.004, 'tape', bx + xx, by, zz, 0.001);
    b.box(L - 0.06, 0.025, 0.004, 'tape', bx, by + Hh / 2 - 0.035, zz, 0.001);
  }
  // darker lower skirt of the blanket
  b.box(L + 0.004, 0.07, W + 0.004, 'goldDeep', bx, by - Hh / 2 + 0.04, 0, 0.02);
  // bottom: black kapton & ground penetrating radar antennas
  b.box(L - 0.04, 0.02, W - 0.04, 'blackKapton', bx, by - Hh / 2 - 0.005, 0, 0.005);
  for (const zz of [-0.18, 0.18]) {
    b.box(0.5, 0.018, 0.05, 'white', -0.12, by - Hh / 2 - 0.03, zz, 0.004);
    b.cyl(0.005, 0.18, 'alu', -0.36, by - Hh / 2 - 0.04, zz, 'x', 10);
    b.cyl(0.005, 0.18, 'alu', 0.12, by - Hh / 2 - 0.04, zz, 'x', 10);
  }
  b.box(0.12, 0.05, 0.3, 'aluDark', 0.28, by - Hh / 2 - 0.03, 0, 0.006);

  // name plate on both sides
  for (const s of [-1, 1]) {
    const lbl = b.add(new THREE.PlaneGeometry(0.24, 0.075), 'label', V(bx + 0.17, by + 0.07, s * (W / 2 + 0.006)), [0, s < 0 ? Math.PI : 0, 0]);
    lbl.userData.keep = true;
    b.box(0.26, 0.09, 0.006, 'alu', bx + 0.17, by + 0.07, s * (W / 2 + 0.002), 0.002);
  }

  // rear thermal louvers
  {
    const x0 = bx - L / 2 - 0.012;
    b.box(0.02, 0.26, 0.42, 'aluDark', x0, by + 0.02, 0, 0.004);
    for (let i = 0; i < 9; i++) {
      const m = b.box(0.006, 0.024, 0.39, 'alu', x0 - 0.012, by - 0.09 + i * 0.028, 0, 0.001);
      m.rotation.z = 0.5;
    }
    b.box(0.03, 0.03, 0.06, 'black', x0 - 0.01, by + 0.17, 0.17, 0.004);
    // connector panel
    for (let i = 0; i < 4; i++) b.cyl(0.013, 0.02, 'connector', x0 - 0.01, by - 0.14, -0.15 + i * 0.045, 'x', 16);
  }

  // rocker pivot bearings on body sides
  for (const s of [-1, 1]) {
    b.cyl(0.058, 0.09, 'goldDeep', 0, 0, s * (W / 2 + 0.045), 'z', 32);
    b.cyl(0.066, 0.014, 'alu', 0, 0, s * (W / 2 + 0.095), 'z', 36);
    b.bolts(0, 0, s * (W / 2 + 0.104), 'z', 0.05, 8, 0.005, 'titan');
    b.cyl(0.024, 0.01, 'aluDark', 0, 0, s * (W / 2 + 0.105), 'z', 20);
  }

  /* ---- top deck ---- */
  const deckY = by + Hh / 2 + 0.012;
  b.box(L + 0.02, 0.022, W + 0.02, 'white', bx, deckY, 0, 0.006);
  // OSR radiators flanking the centreline
  for (const s of [-1, 1]) b.box(0.4, 0.01, 0.24, 'osr', -0.26, deckY + 0.015, s * 0.2, 0.002);
  // electronics boxes / star sensor / sun sensor
  b.box(0.16, 0.07, 0.12, 'silverFoil', 0.08, deckY + 0.045, 0.24, 0.01);
  b.box(0.08, 0.05, 0.08, 'aluDark', 0.14, deckY + 0.035, -0.26, 0.006);
  b.cyl(0.018, 0.03, 'black', 0.14, deckY + 0.075, -0.26, 'y', 16);
  b.box(0.06, 0.02, 0.06, 'black', -0.08, deckY + 0.02, -0.28, 0.004);
  b.box(0.05, 0.004, 0.012, 'glass', -0.08, deckY + 0.031, -0.28, 0.001);
  // calibration target with shadow-casting gnomon
  {
    const m = b.add(new THREE.PlaneGeometry(0.09, 0.09), 'cal', V(0.36, deckY + 0.05, 0.22), [-Math.PI / 2 + 0.25, 0, 0]);
    m.userData.keep = true;
    b.box(0.1, 0.012, 0.1, 'aluDark', 0.36, deckY + 0.042, 0.22, 0.003, [0.25, 0, 0]);
    b.box(0.03, 0.035, 0.03, 'aluDark', 0.36, deckY + 0.02, 0.22, 0.003);
    b.cyl(0.003, 0.04, 'black', 0.36, deckY + 0.07, 0.22, 'y', 8);
  }
  // helical low-gain antenna + UHF whip
  {
    b.cyl(0.03, 0.02, 'aluDark', -0.42, deckY + 0.02, -0.24, 'y', 20);
    const pts = [];
    for (let i = 0; i <= 120; i++) {
      const t = i / 120, a = t * Math.PI * 2 * 7;
      pts.push(V(-0.42 + Math.cos(a) * 0.022, deckY + 0.035 + t * 0.16, -0.24 + Math.sin(a) * 0.022));
    }
    b.tube(pts, 0.0022, 'connector', 360, 5);
    b.cyl(0.005, 0.17, 'white', -0.42, deckY + 0.12, -0.24, 'y', 8);
    b.cyl(0.004, 0.36, 'alu', -0.46, deckY + 0.19, 0.28, 'y', 8);
    b.cyl(0.012, 0.03, 'black', -0.46, deckY + 0.015, 0.28, 'y', 12);
  }
  // solar wing hinge brackets
  for (const s of [-1, 1]) for (const xx of [-0.34, 0.26]) {
    b.box(0.04, 0.09, 0.03, 'alu', xx, deckY + 0.05, s * 0.37, 0.004);
  }

  /* ---- front: hazard cameras + stowed robotic arm ---- */
  {
    const fx = bx + L / 2;
    b.box(0.05, 0.07, 0.26, 'aluDark', fx + 0.02, by - 0.12, 0, 0.006);
    for (const zz of [-0.085, 0.085]) {
      b.box(0.06, 0.055, 0.06, 'white', fx + 0.05, by - 0.12, zz, 0.006, [0, 0, -0.45]);
      const lens = b.cyl(0.014, 0.03, 'black', fx + 0.085, by - 0.137, zz, 'x', 20);
      lens.rotation.set(0, 0, -Math.PI / 2 - 0.45);
      const gl = b.add(new THREE.SphereGeometry(0.012, 20, 8, 0, Math.PI * 2, 0, 1.1), 'glass', V(fx + 0.1, by - 0.144, zz));
      gl.rotation.z = -Math.PI / 2 - 0.45;
    }
    // front panel details
    b.box(0.006, 0.12, 0.5, 'silverFoil', fx + 0.002, by + 0.06, 0, 0.002);
    // arm: shoulder, upper arm, elbow, forearm, instrument head
    const sh = V(fx + 0.05, by + 0.02, 0.26);
    b.box(0.06, 0.08, 0.08, 'white', sh.x - 0.01, sh.y, sh.z, 0.008);
    b.cyl(0.032, 0.06, 'goldDeep', sh.x + 0.03, sh.y, sh.z, 'x', 24);
    const el = V(fx + 0.1, by + 0.02, -0.2);
    b.rod(V(sh.x + 0.06, sh.y, sh.z), el, 0.019, 'titan');
    b.cyl(0.03, 0.05, 'goldDeep', el.x, el.y, el.z, 'y', 24);
    const wr = V(fx + 0.1, by - 0.04, 0.12);
    b.rod(el.clone().add(V(0, -0.03, 0)), wr, 0.016, 'titan');
    b.cyl(0.024, 0.04, 'goldDeep', wr.x, wr.y, wr.z, 'z', 20);
    b.cyl(0.035, 0.07, 'alu', wr.x, wr.y - 0.05, wr.z + 0.04, 'y', 28);
    b.cyl(0.037, 0.012, 'connector', wr.x, wr.y - 0.09, wr.z + 0.04, 'y', 28);
    b.tube([V(sh.x + 0.05, sh.y + 0.03, sh.z - 0.02), V(fx + 0.1, by + 0.055, 0.0), V(el.x + 0.02, el.y + 0.035, el.z + 0.02)], 0.005, 'cable', 40, 6);
  }

  /* ---- differential bar on the deck ---- */
  const diff = new THREE.Group();
  diff.position.set(0, K.diff.y, 0);
  body.add(diff);
  {
    b.cyl(0.04, 0.05, 'goldDeep', 0, K.diff.y - 0.03, 0, 'y', 24);
    const d = new B(diff, M);
    d.box(0.05, 0.035, 0.08, 'alu', 0, 0, 0, 0.006);
    d.box(0.03, 0.022, K.diff.half * 2, 'titan', 0, 0.004, 0, 0.006);
    for (const s of [-1, 1]) d.cyl(0.016, 0.03, 'aluDark', 0, 0, s * K.diff.half, 'y', 16);
    mergeStatic(diff);
  }
  J.diff = diff;
  const linkGeo = new THREE.CylinderGeometry(0.008, 0.008, 1, 10, 1).translate(0, 0.5, 0);
  for (let s = 0; s < 2; s++) {
    const link = new THREE.Mesh(linkGeo, M.titan);
    link.castShadow = link.receiveShadow = true;
    link.userData.keep = true;
    body.add(link);
    J.links.push(link);
  }

  /* ---- mast with pan/tilt camera head ---- */
  {
    const mx = 0.3, mz = -0.02;
    b.cyl(0.05, 0.04, 'aluDark', mx, deckY + 0.03, mz, 'y', 28);
    b.cyl(0.036, 0.06, 'goldDeep', mx, deckY + 0.08, mz, 'y', 24);
    b.cyl(0.022, 0.6, 'white', mx, deckY + 0.4, mz, 'y', 20);
    b.cyl(0.03, 0.02, 'alu', mx, deckY + 0.2, mz, 'y', 20);
    const pts = [];
    for (let i = 0; i <= 160; i++) {
      const t = i / 160, a = t * Math.PI * 2 * 5;
      pts.push(V(mx + Math.cos(a) * 0.027, deckY + 0.12 + t * 0.56, mz + Math.sin(a) * 0.027));
    }
    b.tube(pts, 0.0035, 'cable', 400, 5);
    const pan = new THREE.Group();
    pan.position.set(mx, deckY + 0.7, mz);
    body.add(pan);
    const p = new B(pan, M);
    p.cyl(0.045, 0.07, 'gold', 0, 0.02, 0, 'y', 28);
    p.box(0.07, 0.07, 0.05, 'aluDark', 0, 0.08, 0, 0.006);
    const tilt = new THREE.Group();
    tilt.position.set(0, 0.1, 0);
    pan.add(tilt);
    const t = new B(tilt, M);
    t.cyl(0.02, 0.1, 'aluDark', 0, 0, 0, 'z', 20);
    t.box(0.07, 0.055, 0.42, 'white', 0.01, 0.035, 0, 0.008);
    t.box(0.072, 0.004, 0.4, 'tape', 0.01, 0.064, 0, 0.001);
    for (const s of [-1, 1]) {
      // panoramic cameras
      const cz = s * 0.155;
      t.box(0.11, 0.078, 0.078, 'white', 0.03, 0.04, cz, 0.008);
      t.box(0.112, 0.02, 0.08, 'goldDeep', 0.03, 0.005, cz, 0.004);
      t.cyl(0.026, 0.04, 'black', 0.1, 0.04, cz, 'x', 28);
      t.cyl(0.029, 0.008, 'alu', 0.117, 0.04, cz, 'x', 28);
      const g1 = t.add(new THREE.SphereGeometry(0.021, 24, 8, 0, Math.PI * 2, 0, 0.9), 'glass', V(0.114, 0.04, cz), [0, 0, -Math.PI / 2]);
      g1.scale.set(1, 0.5, 1);
      // sunshade hood
      t.box(0.05, 0.004, 0.07, 'blackMatte', 0.14, 0.074, cz, 0.001);
      for (const q of [-1, 1]) t.box(0.05, 0.068, 0.003, 'blackMatte', 0.14, 0.041, cz + q * 0.034, 0.001);
      // navigation cameras
      const nz = s * 0.06;
      t.box(0.08, 0.05, 0.05, 'aluDark', 0.02, 0.035, nz, 0.006);
      t.cyl(0.014, 0.03, 'black', 0.07, 0.035, nz, 'x', 20);
      const g2 = t.add(new THREE.SphereGeometry(0.011, 20, 8, 0, Math.PI * 2, 0, 0.9), 'glass', V(0.084, 0.035, nz), [0, 0, -Math.PI / 2]);
      g2.scale.set(1, 0.5, 1);
    }
    // small spectrometer on top
    t.box(0.07, 0.04, 0.05, 'silverFoil', 0.0, 0.085, 0, 0.006);
    t.cyl(0.012, 0.02, 'black', 0.04, 0.085, 0, 'x', 16);
    for (const gg of [tilt, pan]) mergeStatic(gg);
    J.mastPan = pan;
    J.mastTilt = tilt;
  }

  /* ---- high-gain antenna on a two-axis gimbal ---- */
  {
    const hx = -0.34, hz = 0.0;
    b.cyl(0.045, 0.03, 'aluDark', hx, deckY + 0.025, hz, 'y', 24);
    const az = new THREE.Group();
    az.position.set(hx, deckY + 0.04, hz);
    body.add(az);
    const a = new B(az, M);
    a.cyl(0.04, 0.07, 'gold', 0, 0.035, 0, 'y', 24);
    a.cyl(0.016, 0.2, 'white', 0, 0.16, 0, 'y', 16);
    a.box(0.05, 0.05, 0.06, 'aluDark', 0, 0.27, 0, 0.006);
    const elg = new THREE.Group();
    elg.position.set(0, 0.28, 0);
    az.add(elg);
    const e = new B(elg, M);
    e.cyl(0.026, 0.09, 'goldDeep', 0, 0, 0, 'z', 20);
    e.box(0.08, 0.025, 0.03, 'alu', 0.04, 0, 0, 0.004);
    // parabolic dish, boresight +X
    const prof = [];
    const f = 0.12, R = 0.18;
    for (let i = 0; i <= 24; i++) {
      const r = (i / 24) * R;
      prof.push(new THREE.Vector2(r, (r * r) / (4 * f)));
    }
    prof.push(new THREE.Vector2(R + 0.006, (R * R) / (4 * f) + 0.002));
    const dish = e.add(new THREE.LatheGeometry(prof, 64), 'dish', V(0.08, 0, 0), [0, 0, -Math.PI / 2]);
    dish.userData.keep = true;
    e.add(new THREE.TorusGeometry(R + 0.004, 0.005, 8, 64), 'alu', V(0.08 + (R * R) / (4 * f), 0, 0), [0, Math.PI / 2, 0]);
    // back ribs
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2;
      const tip = V(0.08 + (R * R) / (4 * f) - 0.004, Math.cos(ang) * R * 0.95, Math.sin(ang) * R * 0.95);
      e.rod(V(0.075, 0, 0), tip, 0.004, 'alu', 6);
    }
    // feed and struts
    const focus = V(0.08 + f, 0, 0);
    for (let i = 0; i < 3; i++) {
      const ang = (i / 3) * Math.PI * 2 + 0.5;
      const rim = V(0.08 + (R * R) / (4 * f), Math.cos(ang) * R, Math.sin(ang) * R);
      e.rod(rim, focus, 0.0035, 'white', 6);
    }
    e.cyl(0.018, 0.045, 'goldDeep', focus.x, 0, 0, 'x', 20, 0.012);
    for (const gg of [elg, az]) mergeStatic(gg);
    J.hgaAz = az;
    J.hgaEl = elg;
  }

  /* ---- solar wings ---- */
  J.wings = [];
  for (const s of [-1, 1]) {
    const wing = new THREE.Group();
    wing.position.set(-0.04, deckY + 0.11, s * 0.38);
    body.add(wing);
    const w = new B(wing, M);
    const span = 0.64, len = 0.98;
    const cz = s * (span / 2 + 0.02);
    w.box(len, 0.02, span, 'alu', 0, 0, cz, 0.004);
    const top = w.add(new THREE.PlaneGeometry(len - 0.012, span - 0.012), 'solar', V(0, 0.0105, cz), [-Math.PI / 2, 0, s > 0 ? Math.PI : 0]);
    top.userData.keep = true;
    w.add(new THREE.PlaneGeometry(len - 0.012, span - 0.012), 'carbon', V(0, -0.0105, cz), [Math.PI / 2, 0, 0]);
    // hinge knuckles & back stiffeners
    for (const xx of [-0.3, 0.3]) {
      w.cyl(0.014, 0.06, 'aluDark', xx, 0, 0, 'x', 16);
      w.box(0.02, 0.018, span - 0.04, 'aluDark', xx, -0.02, cz, 0.003);
    }
    w.cyl(0.006, len - 0.1, 'titan', 0, 0, 0, 'x', 10);
    w.tube([V(-0.44, -0.01, s * 0.02), V(-0.42, -0.02, s * 0.1), V(-0.4, -0.022, s * 0.3)], 0.005, 'cableW', 24, 6);
    mergeStatic(wing);
    J.wings.push(wing);
  }

  /* ---- suspension: rockers, bogies, steering, wheels ---- */
  const wheelTpl = buildWheelGeometry(M);
  const makeWheel = (sz) => {
    const w = wheelTpl.clone();
    w.scale.z = sz;
    return w;
  };

  const sideDefs = [-1, 1];
  sideDefs.forEach((sz, si) => {
    const rocker = new THREE.Group();
    rocker.position.set(0, 0, 0);
    body.add(rocker);
    const r = new B(rocker, M);
    const zr = sz * K.zRock, zb = sz * K.zBogie, zw = sz * K.zWheel;
    // pivot hub
    r.cyl(0.05, 0.06, 'aluDark', 0, 0, zr, 'z', 28);
    r.bolts(0, 0, zr + sz * 0.031, 'z', 0.036, 6, 0.005, 'titan');
    // front arm
    const fEnd = V(K.front.x, -0.055, zr);
    r.rod(V(0.02, -0.005, zr), fEnd, 0.022, 'titan', 18);
    r.box(0.08, 0.05, 0.05, 'aluDark', 0.05, -0.01, zr, 0.008, [0, 0, -0.1]);
    r.rod(fEnd, V(K.front.x, -0.055, zw), 0.02, 'titan', 16);
    // front steering actuator (above wheel)
    r.cyl(0.042, 0.1, 'gold', K.front.x, K.front.mountY + 0.05, zw, 'y', 28);
    r.cyl(0.046, 0.012, 'alu', K.front.x, K.front.mountY + 0.005, zw, 'y', 28);
    // rear arm to bogie pivot
    const bp = V(K.bogie.x, K.bogie.y, zr);
    r.rod(V(-0.02, -0.01, zr), bp, 0.022, 'titan', 18);
    r.cyl(0.042, 0.06, 'aluDark', bp.x, bp.y, zr, 'z', 24);
    r.cyl(0.018, K.zBogie - K.zRock + 0.04, 'titan', bp.x, bp.y, (zr + zb) / 2, 'z', 16);
    // differential crank
    r.rod(V(0, 0.02, sz * (K.diff.half)), V(0, K.diff.crank, sz * K.diff.half), 0.011, 'titan', 12);
    r.cyl(0.015, 0.03, 'aluDark', 0, K.diff.crank, sz * K.diff.half, 'z', 14);
    // harness along the arms
    r.tube([V(0.0, -0.05, sz * 0.4), V(0.2, -0.06, zr + sz * 0.02), V(0.45, -0.085, zr + sz * 0.02), V(K.front.x - 0.03, -0.09, zw - sz * 0.03)], 0.006, 'cable', 48, 6);
    r.tube([V(0.0, -0.06, sz * 0.4), V(-0.15, -0.13, zr + sz * 0.025), V(K.bogie.x + 0.03, K.bogie.y + 0.02, zr + sz * 0.03)], 0.005, 'cableW', 32, 6);

    // front steering + wheel
    const steerF = new THREE.Group();
    steerF.position.set(K.front.x, K.front.mountY, zw);
    rocker.add(steerF);
    buildFork(new B(steerF, M), sz, true);
    mergeStatic(steerF);
    const wF = makeWheel(sz);
    wF.position.set(0, -K.fork, 0);
    steerF.add(wF);

    // bogie
    const bogie = new THREE.Group();
    bogie.position.set(K.bogie.x, K.bogie.y, 0);
    rocker.add(bogie);
    const bg = new B(bogie, M);
    bg.cyl(0.044, 0.05, 'aluDark', 0, 0, zb, 'z', 24);
    const mEnd = V(K.mid.x, K.mid.mountY, zb);
    const rEnd = V(K.rear.x, K.rear.mountY + 0.1, zb);
    bg.rod(V(0.02, 0.0, zb), mEnd, 0.02, 'titan', 16);
    bg.rod(V(-0.02, 0.01, zb), rEnd, 0.02, 'titan', 16);
    bg.rod(mEnd, V(K.mid.x, K.mid.mountY, zw), 0.018, 'titan', 14);
    bg.rod(rEnd, V(K.rear.x, K.rear.mountY + 0.1, zw), 0.018, 'titan', 14);
    bg.box(0.07, 0.045, 0.045, 'aluDark', 0.0, 0.0, zb + sz * 0.035, 0.006);
    // mid (fixed) wheel mount
    const midMount = new THREE.Group();
    midMount.position.set(K.mid.x, K.mid.mountY, zw);
    bogie.add(midMount);
    buildFork(new B(midMount, M), sz, false);
    mergeStatic(midMount);
    const wM = makeWheel(sz);
    wM.position.set(0, -K.fork, 0);
    midMount.add(wM);
    // rear steering actuator + wheel
    bg.cyl(0.042, 0.1, 'gold', K.rear.x, K.rear.mountY + 0.05, zw, 'y', 28);
    bg.cyl(0.046, 0.012, 'alu', K.rear.x, K.rear.mountY + 0.005, zw, 'y', 28);
    bg.tube([V(0.0, 0.02, zb + sz * 0.02), V(-0.15, 0.08, zb + sz * 0.03), V(K.rear.x + 0.03, K.rear.mountY + 0.07, zw - sz * 0.035)], 0.005, 'cable', 32, 6);
    mergeStatic(bogie);
    const steerR = new THREE.Group();
    steerR.position.set(K.rear.x, K.rear.mountY, zw);
    bogie.add(steerR);
    buildFork(new B(steerR, M), sz, true);
    mergeStatic(steerR);
    const wR = makeWheel(sz);
    wR.position.set(0, -K.fork, 0);
    steerR.add(wR);

    mergeStatic(rocker);
    J.rockers[si] = rocker;
    J.bogies[si] = bogie;
    const tag = si === 0 ? 'L' : 'R';
    J.steer['F' + tag] = steerF;
    J.steer['R' + tag] = steerR;
    J.wheels.push(
      { obj: wF, x: K.front.x, z: zw, pos: 'F', side: si },
      { obj: wM, x: K.bogie.x + K.mid.x, z: zw, pos: 'M', side: si },
      { obj: wR, x: K.bogie.x + K.rear.x, z: zw, pos: 'R', side: si },
    );
  });

  mergeStatic(body);
  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return J;
}

// Fork from a mount point down the inboard side of the wheel to the hub motor.
function buildFork(f, sz, steered) {
  const inner = -sz * 0.095; // toward body
  const hubY = -K.fork;
  if (steered) {
    f.cyl(0.03, 0.03, 'aluDark', 0, -0.012, 0, 'y', 20);
  }
  f.box(0.05, 0.022, 0.12, 'aluDark', 0, -0.03, inner / 2, 0.006);
  f.box(0.05, Math.abs(hubY) + 0.02, 0.018, 'titan', 0, (hubY - 0.03) / 2, inner, 0.005);
  // hub drive motor (gold MLI wrapped)
  f.cyl(0.045, 0.05, 'gold', 0, hubY, inner + sz * 0.028, 'z', 28);
  f.cyl(0.048, 0.008, 'alu', 0, hubY, inner + sz * 0.005, 'z', 28);
  f.tube([V(0, -0.04, inner / 2), V(-0.02, hubY * 0.5, inner - sz * 0.012), V(-0.025, hubY + 0.04, inner - sz * 0.01)], 0.004, 'cable', 20, 5);
}
