// ============================================================================
//  05-sea: interior lights, GPU voxel sea, coral island (lighthouse, hut,
//          palms, dock, treasure), coral pillar, sunken relics on the glass
// ============================================================================

// ------------------------------------------------------- interior lighting
const inL = {};
{
  const tgt = new THREE.Object3D(); tgt.position.set(-2.5, -1, 0); interior.add(tgt);
  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.target = tgt; sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera; sc.left = -23; sc.right = 23; sc.top = 23; sc.bottom = -23; sc.near = 1; sc.far = 90;
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.025; sun.shadow.radius = 2;
  const moon = new THREE.DirectionalLight(0x9fb4ff, 0.3); moon.target = tgt;
  const hemi = new THREE.HemisphereLight(0xbfd8ff, 0x0c2a3a, 1.0);
  const flash = new THREE.DirectionalLight(0xdfe8ff, 0); flash.target = tgt; flash.position.set(-3, 40, 6);
  interior.add(sun, moon, hemi, flash);
  const pl = (c, d) => { const l = new THREE.PointLight(c, 0, d, 1.6); interior.add(l); return l; };
  Object.assign(inL, { tgt, sun, moon, hemi, flash, lamp: pl(0xffc070, 16), hut: pl(0xff9a40, 7), dock: pl(0xffb050, 6), chest: pl(0xffc040, 6) });
}

// ------------------------------------------------------------ island shape
function islandE(x, z) {
  const dx = (x - ISLAND.x) / ISLAND.ax, dz = (z - ISLAND.z) / ISLAND.az;
  const a = Math.atan2(dz, dx);
  const wob = 1 + 0.1 * Math.sin(a * 3 + 1.1) + 0.06 * Math.sin(a * 5 + 2.3) + 0.035 * Math.sin(a * 9 + 0.3);
  return Math.hypot(dx, dz) / wob;
}
function islandH(x, z) {
  const e = islandE(x, z);
  if (e > 1) return null;
  let h = WATER_Y - 0.32 + Math.min(1, (1 - e) / 0.36) * 0.72;
  h += Math.max(0, 0.62 - e) * 0.85;
  const dl = Math.hypot(x - LH.x, z - LH.z);
  h += Math.pow(Math.max(0, 1 - dl / 2.3), 1.4) * 1.15;
  const dh = Math.hypot(x - HUT.x, z - HUT.z);
  h += (noise2(x * 0.9 + 3, z * 0.9) - 0.5) * 0.3 * smooth(0.95, 0.6, e) * smooth(0.8, 1.6, dh);
  return h;
}
const IS = 0.25;
const isleVox = new Vox(IS, ISLAND.x, WATER_Y - 1.7, ISLAND.z);
const isleTop = new Map();       // "i,k" → y of the top face
function topAt(x, z) {
  const v = isleTop.get(isleVox.ix(x) + ',' + isleVox.iz(z));
  return v === undefined ? null : v;
}
function nudgeInland(x, z, minH = WATER_Y + 0.2) {
  for (let t = 0; t < 40; t++) {
    const h = islandH(x, z);
    if (h !== null && h >= minH) return [x, z];
    x = lerp(x, ISLAND.x, 0.08); z = lerp(z, ISLAND.z, 0.08);
  }
  return [x, z];
}
const pathD = (x, z) => { // distance to the dirt paths (hut ↔ lighthouse ↔ dock)
  const seg = (ax, az, bx, bz) => { const vx = bx - ax, vz = bz - az; const t = clamp(((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz), 0, 1); return Math.hypot(x - ax - vx * t, z - az - vz * t); };
  return Math.min(seg(HUT.x + 0.2, HUT.z + 0.9, LH.x, LH.z + 0.8), seg(LH.x + 0.4, LH.z + 0.7, 0.4, DOCK.z));
};

const staticList = [];   // world-frame voxels (one InstancedMesh)
const bottomList = [];   // bottle-frame relics on the glass floor

// ---------------------------------------------------------------- island top
{
  const R = Math.ceil(ISLAND.ax * 1.25 / IS);
  for (let i = -R; i <= R; i++) for (let k = -R; k <= R; k++) {
    const x = ISLAND.x + i * IS, z = ISLAND.z + k * IS;
    const h = islandH(x, z);
    if (h === null) continue;
    const top = Math.round((h - isleVox.o[1]) / IS);
    const e = islandE(x, z);
    const dl = Math.hypot(x - LH.x, z - LH.z);
    for (let j = 0; j <= top; j++) {
      const y = isleVox.o[1] + j * IS;
      let c;
      if (j === top) {
        if (y < WATER_Y - 0.12) c = 0xc9a86a;                         // shallow sand
        else if (y < WATER_Y + 0.05) c = 0xd4b47a;                    // wet sand
        else if (y < WATER_Y + 0.3) c = hash3(i, j, k) < 0.2 ? 0xf2dfaa : 0xe9d39a;   // beach
        else if (dl < 1.9 && hash3(i, 3, k) < 0.4 + (1.9 - dl) * 0.3) c = hash3(i, 5, k) < 0.5 ? 0x8f8b84 : 0x7a766f; // rock
        else if (pathD(x, z) < 0.3) c = 0xb8956a;
        else c = hash3(i, 1, k) < 0.33 ? 0x6fbf4f : hash3(i, 2, k) < 0.5 ? 0x5aa843 : 0x4d9a3c;
      } else if (top - j === 1 && y > WATER_Y + 0.3) c = 0x7a5b3a;
      else c = y > WATER_Y - 0.3 ? 0xc4a06a : 0x8c7a62;
      isleVox.set(i, j, k, c);
    }
    isleTop.set(i + ',' + k, isleVox.o[1] + top * IS + IS / 2);
    // tufts of tall grass & flowers
    const y0 = isleVox.o[1] + top * IS;
    if (y0 > WATER_Y + 0.35 && hash3(i, 9, k) < 0.07 && dl > 1.4 && pathD(x, z) > 0.35) {
      const fl = hash3(i, 8, k);
      staticList.push({ x: x + (fl - 0.5) * 0.1, y: y0 + IS * 0.5 + 0.06, z, s: 0.12, c: fl < 0.3 ? 0xf2d64b : fl < 0.5 ? 0xf06a7a : 0x7ccf5a, w: 0.8, j: 0 });
    }
  }
  isleVox.toList(staticList, { jitter: 0.06 });
}

// -------------------------------------------------------- coral rock pillar
{
  const S = 0.45, top = WATER_Y - 2.0;
  const P = new Vox(S, ISLAND.x, top, ISLAND.z);
  const coralVox = new Vox(0.13);
  const bot = -GLASS_IN.R;
  for (let j = 0; ; j--) {
    const y = top + j * S;
    if (y < bot) break;
    const f = (top - y) / (top - bot);
    const sx = ISLAND.ax * (0.8 - 0.42 * f + 0.3 * smooth(0.82, 1, f));
    const sz = ISLAND.az * (0.8 - 0.42 * f + 0.3 * smooth(0.82, 1, f));
    const R = Math.ceil(sx * 1.3 / S);
    for (let i = -R; i <= R; i++) for (let k = -R; k <= R; k++) {
      const x = ISLAND.x + i * S, z = ISLAND.z + k * S;
      const n = (noise2(x * 0.6 + y * 0.3, z * 0.6 - y * 0.2) - 0.5) * 0.45;
      if (Math.hypot((x - ISLAND.x) / sx, (z - ISLAND.z) / sz) > 1 + n) continue;
      if (!insideRest(x, y, z, 0.2)) continue;
      const h = hash3(i, j, k);
      P.set(i, j, k, h < 0.45 ? 0x6a655f : h < 0.8 ? 0x5a5550 : h < 0.9 ? 0x7c6e62 : 0x4d5a58);
    }
  }
  // encrusting coral + growths on exposed faces
  const rnd = mulberry32(31);
  const coralCols = [0xff6f91, 0xff8c42, 0xa05ad0, 0xf4d03f, 0x3fb8a0, 0xe84a5f, 0xffa8c5];
  const exposed = [];
  for (const v of P.m.values()) if (P.exposed(v[0], v[1], v[2])) exposed.push(v);
  for (const v of exposed) {
    if (rnd() < 0.05) v[3] = coralCols[(rnd() * coralCols.length) | 0];
    else if (rnd() < 0.12) v[3] = rnd() < 0.5 ? 0x4e6a4a : 0x6a7a5a;   // algae & moss
  }
  for (let n = 0; n < 70; n++) {
    const v = exposed[(rnd() * exposed.length) | 0];
    const x = P.o[0] + v[0] * S, y = P.o[1] + v[1] * S, z = P.o[2] + v[2] * S;
    if (y > WATER_Y - 2.2) continue;
    const dx = x - ISLAND.x, dz = z - ISLAND.z, dl = Math.hypot(dx, dz) || 1;
    const ox = x + dx / dl * S * 0.6, oz = z + dz / dl * S * 0.6;
    const col = coralCols[(rnd() * coralCols.length) | 0];
    const type = rnd();
    const ci = coralVox.ix(ox), cj = coralVox.iy(y), ck = coralVox.iz(oz);
    if (type < 0.45) {          // branching coral
      const walk = (i, j, k, len, d) => {
        for (let s = 0; s < len; s++) {
          coralVox.set(i, j, k, col, 0.05);
          j++; if (rnd() < 0.4) i += Math.round(dx / dl + rnd() - 0.5); if (rnd() < 0.4) k += Math.round(dz / dl + rnd() - 0.5);
          if (d < 2 && rnd() < 0.18) walk(i, j, k, len - s - 1, d + 1);
        }
      };
      walk(ci, cj, ck, 4 + ((rnd() * 5) | 0), 0);
    } else if (type < 0.7) {    // anemone tuft
      for (let t = 0; t < 7; t++) {
        const ti = ci + Math.round((rnd() - 0.5) * 3), tk = ck + Math.round((rnd() - 0.5) * 3);
        for (let s = 0; s < 2 + ((rnd() * 3) | 0); s++) coralVox.set(ti, cj + s, tk, s === 0 ? 0xd65a86 : col, 0.12, 1.5);
      }
    } else if (type < 0.85) {   // tube sponges
      for (let t = 0; t < 3; t++) {
        const ti = ci + t - 1, tk = ck + ((t * 7) % 3) - 1, H = 3 + ((rnd() * 4) | 0);
        for (let s = 0; s < H; s++) coralVox.set(ti, cj + s, tk, s === H - 1 ? 0x5a2a12 : 0xff8a3d);
      }
    } else {                    // kelp strand
      const H = 12 + ((rnd() * 14) | 0);
      for (let s = 0; s < H; s++) coralVox.set(ci + Math.round(Math.sin(s * 0.5) * 0.6), cj + s, ck, s % 5 === 4 ? 0x6fa84a : 0x3f7f3a, 0, 0.6 + s * 0.12);
    }
  }
  P.toList(staticList, { jitter: 0.08 });
  coralVox.toList(staticList, { jitter: 0.08, cull: false });
}

// ---------------------------------------------------------------- lighthouse
const LAMP = new THREE.Vector3();
{
  const S = 0.18, base = topAt(LH.x, LH.z) ?? 0.5;
  const V = new Vox(S, LH.x, base + S / 2, LH.z);
  const H = 20;
  // stone footing
  for (let i = -6; i <= 6; i++) for (let k = -6; k <= 6; k++) {
    if (i * i + k * k > 30) continue;
    for (let j = -3; j <= 0; j++) V.set(i, j, k, hash3(i, j, k) < 0.5 ? 0x8a857d : 0x77726a);
  }
  for (let j = 1; j <= H; j++) {
    const r = 4.3 - (j / H) * 1.5;
    const R = Math.ceil(r);
    for (let i = -R; i <= R; i++) for (let k = -R; k <= R; k++) {
      if (i * i + k * k > r * r) continue;
      let c = Math.floor((j - 1) / 4) % 2 === 0 ? 0xf2efe7 : 0xc6262b;
      const edge = i * i + k * k > (r - 1.2) * (r - 1.2);
      if (edge && j <= 4 && k >= R - 1 && Math.abs(i) <= 1) c = 0x3a2616;            // door
      if (edge && (j === 9 || j === 15) && (Math.abs(i) <= 0 && Math.abs(k) >= R - 1 || Math.abs(k) <= 0 && Math.abs(i) >= R - 1)) c = 0x1a2233;
      V.set(i, j, k, c);
    }
  }
  const g = H + 1;
  for (let i = -5; i <= 5; i++) for (let k = -5; k <= 5; k++) {       // gallery + railing
    const d2 = i * i + k * k;
    if (d2 <= 20) V.set(i, g, k, 0x34373c);
    if (d2 <= 20 && d2 > 13 && (i + k) % 2 === 0) V.set(i, g + 1, k, 0x24262a);
  }
  for (let j = g + 1; j <= g + 3; j++) for (let i = -2; i <= 2; i++) for (let k = -2; k <= 2; k++) {  // lantern room
    if (i * i + k * k > 5.5) continue;
    const frame = (Math.abs(i) === 2 && Math.abs(k) === 0) || (Math.abs(k) === 2 && Math.abs(i) === 0) || j === g + 3 && (i * i + k * k > 3);
    V.set(i, j, k, frame ? 0x2a2c30 : 0xffe7a0, frame ? 0 : 2.4);
  }
  for (let j = g + 4; j <= g + 6; j++) {                                // red dome
    const r = 2.9 - (j - g - 4) * 1.0;
    for (let i = -3; i <= 3; i++) for (let k = -3; k <= 3; k++) if (i * i + k * k <= r * r) V.set(i, j, k, 0xa51f22);
  }
  V.set(0, g + 7, 0, 0x2a2c30); V.set(0, g + 8, 0, 0xd4a640, 0.4);
  V.toList(staticList, { jitter: 0.05 });
  LAMP.set(LH.x, base + S / 2 + (g + 2) * S, LH.z);
  inL.lamp.position.copy(LAMP);
}

// ----------------------------------------------------------------------- hut
const HUT_WIN = [];
const SMOKE_SRC = new THREE.Vector3();
{
  const S = 0.16;
  let base = -99;
  for (let dx = -0.9; dx <= 0.9; dx += 0.3) for (let dz = -0.7; dz <= 0.7; dz += 0.3) base = Math.max(base, topAt(HUT.x + dx, HUT.z + dz) ?? -99);
  const V = new Vox(S, HUT.x, base + S / 2, HUT.z);
  for (let i = -6; i <= 6; i++) for (let k = -5; k <= 4; k++) for (let j = -3; j <= 0; j++) V.set(i, j, k, hash3(i, j, k) < 0.5 ? 0x827c72 : 0x6f6a61);
  for (let j = 1; j <= 7; j++) for (let i = -5; i <= 5; i++) for (let k = -4; k <= 3; k++) {
    const wall = Math.abs(i) === 5 || k === -4 || k === 3;
    if (!wall) continue;
    let c = j % 2 ? 0x8a5a32 : 0x74492a;
    if ((Math.abs(i) === 5) && (k === -4 || k === 3)) c = 0x4a2e1a;
    if (k === 3 && i >= -2 && i <= -1 && j <= 5) c = j === 3 && i === -1 ? 0xd4a640 : 0x4a2e1a;     // door
    let e = 0;
    if (k === 3 && i >= 2 && i <= 3 && j >= 3 && j <= 4) { c = 0xffc46a; e = 1.6; }                // front window
    if (i === -5 && k >= -2 && k <= -1 && j >= 3 && j <= 4) { c = 0xffc46a; e = 1.6; }             // side window
    if (i === 5 && k >= -1 && k <= 0 && j >= 3 && j <= 4) { c = 0xffc46a; e = 1.6; }
    V.set(i, j, k, c, e);
  }
  for (let j = 8; j <= 13; j++) {                                        // thatched gable roof
    const kk = 5 - (j - 8);
    for (let i = -7; i <= 7; i++) for (let k = -kk - 1; k <= kk; k++) {
      if (k > -kk - 1 && k < kk && Math.abs(i) < 7 && j < 13) continue;
      V.set(i, j, k, hash3(i, j, k) < 0.4 ? 0xc9a55a : hash3(i, j + 1, k) < 0.5 ? 0xb58f45 : 0xa27c38);
    }
    if (j < 13) for (const i of [-5, 5]) for (let k = -kk; k < kk; k++) V.set(i, j, k, 0x74492a); // gable ends
  }
  for (let j = 4; j <= 15; j++) for (const [i, k] of [[3, -2], [4, -2], [3, -3], [4, -3]]) V.set(i, j, k, hash3(i, j, k) < 0.5 ? 0x8a8680 : 0x6e6a64);
  V.set(-3, 4, 4, 0x2a2a2a); V.set(-3, 5, 4, 0xffcf6a, 2.2);             // door lantern
  for (let j = 1; j <= 2; j++) for (let i = 6; i <= 7; i++) for (let k = 2; k <= 3; k++) V.set(i, j, k, j === 2 ? 0x5a3a1e : 0x7a5230); // barrel
  V.toList(staticList, { jitter: 0.07 });
  HUT_WIN.push(new THREE.Vector3(HUT.x + 2.5 * S, base + 4 * S, HUT.z + 3.6 * S));
  SMOKE_SRC.set(HUT.x + 3.5 * S, base + 16 * S, HUT.z - 2.5 * S);
  inL.hut.position.set(HUT.x + 0.3, base + 0.9, HUT.z + 1.2);
}

// ----------------------------------------------------------------------- palms
{
  const spots = [[-7.4, -0.9], [-5.3, 1.0], [-3.2, 1.35], [-0.6, 0.3], [-5.0, -3.2], [-8.3, 0.6]];
  const rnd = mulberry32(12);
  for (const s of spots) {
    const [px, pz] = nudgeInland(s[0], s[1], WATER_Y + 0.2);
    const base = topAt(px, pz); if (base === null) continue;
    const S = 0.14, V = new Vox(S);
    const H = 15 + ((rnd() * 5) | 0), lean = rnd() * TAU, L = 0.8 + rnd() * 0.7;
    let tx = 0, tz = 0;
    for (let j = 0; j < H; j++) {
      const t = j / H;
      tx = Math.cos(lean) * L * t * t; tz = Math.sin(lean) * L * t * t;
      const c = (j >> 1) % 2 ? 0x8b6b43 : 0x6e5232;
      const w = t * t * 2.0;
      V.at(px + tx, base + S / 2 + j * S, pz + tz, c, 0, w);
      if (j < 3) V.at(px + tx + S, base + S / 2 + j * S, pz + tz, c, 0, w);
    }
    const cx = px + tx, cy = base + S / 2 + H * S, cz = pz + tz;
    for (const [a, b] of [[0.1, 0.1], [-0.12, 0.05], [0.02, -0.13]]) V.at(cx + a, cy - S, cz + b, 0x5a3b1c, 0, 2);
    const F = 7;
    for (let f = 0; f < F; f++) {
      const ang = f / F * TAU + rnd() * 0.4;
      const dx = Math.cos(ang), dz = Math.sin(ang);
      for (let s = 0; s < 10; s++) {
        const r = s * S * 0.95, y = cy + s * S * 0.32 - s * s * S * 0.075;
        const c = s > 7 ? 0x7cc05a : (s + f) % 2 ? 0x3f9a3a : 0x2e7d32;
        V.at(cx + dx * r, y, cz + dz * r, c, 0, 2.0 + s * 0.12);
        if (s > 1 && s < 8) {
          V.at(cx + dx * r - dz * S, y - S * 0.5, cz + dz * r + dx * S, 0x358a34, 0, 2.0 + s * 0.12);
          V.at(cx + dx * r + dz * S, y - S * 0.5, cz + dz * r - dx * S, 0x2f7d30, 0, 2.0 + s * 0.12);
        }
      }
    }
    V.toList(staticList, { jitter: 0.08, cull: false });
  }
}

// ------------------------------------------------------------------------ dock
const DOCK_END = new THREE.Vector3();
{
  let x0 = ISLAND.x;
  while (x0 < 6 && (islandH(x0, DOCK.z) ?? -99) > WATER_Y + 0.32) x0 += 0.05;
  DOCK.x0 = x0 - 0.5; DOCK.x1 = x0 + 3.3;
  const S = 0.16, y = WATER_Y + 0.42;
  const V = new Vox(S, 0, y, DOCK.z);
  const i0 = V.ix(DOCK.x0), i1 = V.ix(DOCK.x1);
  for (let i = i0; i <= i1; i++) for (let k = -3; k <= 3; k++) V.set(i, 0, k, (i % 3 === 0) ? 0x6e5234 : (i % 2 ? 0x8b6a45 : 0x7d5e3c));
  for (let i = i0 + 3; i <= i1; i += 6) for (const k of [-3, 3]) {
    for (let j = -12; j < 0; j++) V.set(i, j, k, j < -4 ? 0x3a2a1a : 0x4d3824);
    V.set(i, 1, k, 0x5a4230);
  }
  for (const k of [-3, 3]) { V.set(i1, 1, k, 0x3d3d3d); V.set(i1, 2, k, 0x3d3d3d); }   // bollards
  for (let j = 1; j <= 7; j++) V.set(i1 - 1, j, 3, 0x4a3522);                          // lantern post
  V.set(i1 - 1, 8, 3, 0x2a2a2a); V.set(i1, 8, 3, 0x2a2a2a); V.set(i1, 7, 3, 0xffcf6a, 2.4); V.set(i1, 9, 3, 0x2a2a2a);
  V.toList(staticList, { jitter: 0.07 });
  DOCK_END.set(V.o[0] + i1 * S, y + 7 * S, DOCK.z + 3 * S);
  inL.dock.position.copy(DOCK_END).add(new THREE.Vector3(0, 0.3, 0.2));
}

// ----------------------------------------------------- beach treasure & X mark
{
  const [tx, tz] = nudgeInland(-7.2, 0.2, WATER_Y + 0.28);
  const base = topAt(tx, tz) ?? WATER_Y + 0.3;
  const S = 0.1, V = new Vox(S, tx, base + S / 2, tz);
  for (let i = -3; i <= 3; i++) for (let k = -2; k <= 2; k++) for (let j = 0; j <= 3; j++) {
    const band = Math.abs(i) === 2 || j === 0;
    V.set(i, j, k, band ? 0x3a3a3a : (j % 2 ? 0x6b4424 : 0x5c381d));
  }
  for (let i = -2; i <= 2; i++) for (let k = -1; k <= 1; k++) V.set(i, 4, k, 0xffc93c, 1.1);
  V.set(0, 5, 0, 0xffd95a, 1.3); V.set(1, 5, 0, 0xffc93c, 1.1); V.set(-1, 5, 1, 0xe03040, 1.4);
  for (let i = -3; i <= 3; i++) for (let j = 4; j <= 7; j++) V.set(i, j, -3 - (j - 4 > 1 ? 1 : 0), 0x5c381d);  // open lid
  const rnd = mulberry32(8);
  for (let n = 0; n < 14; n++) V.set(((rnd() - 0.5) * 12) | 0, 0, ((rnd() - 0.5) * 9) | 0 || 3, 0xffc93c, 0.8);
  for (let t = -4; t <= 4; t++) { V.set(7 + t, -0, 5 + t, 0xb3262a); V.set(7 + t, 0, 5 - t, 0xb3262a); }        // X marks the spot
  for (let j = 0; j <= 9; j++) V.set(-6, j, 3, j < 3 ? 0x8a8e94 : 0x7a5230);                           // shovel
  V.set(-6, 0, 2, 0x8a8e94); V.set(-6, 0, 4, 0x8a8e94); V.set(-6, 9, 2, 0x7a5230); V.set(-6, 9, 4, 0x7a5230);
  V.toList(staticList, { jitter: 0.06, cull: false });
}

// island voxels → one batch
const islandMesh = makeInstanced(staticList, MAT.vox, { name: 'island' });
interior.add(islandMesh);

// ------------------------------------------------- relics on the glass floor
const BUBBLE_SRC = [];     // bottle-frame points that emit bubbles
const CHEST_POS = new THREE.Vector3();
function placeOnFloor(V, x, z, rot, out = bottomList, opts = {}) {
  const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rot[0], rot[1], rot[2], 'YXZ'));
  let minY = Infinity;
  for (const v of V.m.values()) { _v3.set(V.o[0] + v[0] * V.s, V.o[1] + v[1] * V.s, V.o[2] + v[2] * V.s).applyMatrix4(m); minY = Math.min(minY, _v3.y); }
  m.setPosition(x, floorY(x, z) + V.s * 0.45 - minY + (opts.sink || 0), z);
  V.toList(out, { jitter: 0.07, matrix: m, cull: opts.cull !== false });
  return m;
}
{
  // sunken treasure chest, lid thrown open, spilling gold and gems
  const S = 0.13, V = new Vox(S);
  for (let i = -4; i <= 4; i++) for (let k = -3; k <= 3; k++) for (let j = 0; j <= 4; j++) {
    const band = Math.abs(i) === 3 || j === 0 || (Math.abs(i) === 4 && (Math.abs(k) === 3));
    V.set(i, j, k, band ? 0x2e2e30 : (j % 2 ? 0x5a3a22 : 0x4c311c));
  }
  for (let i = -3; i <= 3; i++) for (let k = -2; k <= 2; k++) V.set(i, 5, k, 0xffc23a, 1.4);
  for (let i = -2; i <= 2; i++) for (let k = -1; k <= 1; k++) V.set(i, 6, k, 0xffcf52, 1.5);
  V.set(0, 7, 0, 0xffe07a, 1.8); V.set(-1, 6, 1, 0xe0203a, 2.2); V.set(2, 6, 0, 0x2adf7a, 2.2); V.set(1, 7, 0, 0x4a7aff, 2.2);
  for (let i = -4; i <= 4; i++) for (let j = 5; j <= 11; j++) V.set(i, j, -4 - (j > 8 ? 1 : 0), (Math.abs(i) === 3 || j === 11) ? 0x2e2e30 : 0x4c311c); // lid
  const rnd = mulberry32(3);
  for (let n = 0; n < 22; n++) { const a = rnd() * TAU, r = 5 + rnd() * 6; V.set(Math.round(Math.cos(a) * r), 0, Math.round(Math.sin(a) * r), 0xffc23a, 0.9); }
  const m = placeOnFloor(V, 5.8, 0.7, [0.02, 0.45, 0.03]);
  CHEST_POS.setFromMatrixPosition(m).add(new THREE.Vector3(0, 0.8, 0));
  BUBBLE_SRC.push(CHEST_POS.clone());
}
{
  // anchor with a length of chain
  const S = 0.13, V = new Vox(S);
  const iron = (i, j, k) => (hash3(i, j, k) < 0.3 ? 0x6e4326 : hash3(i, j + 3, k) < 0.5 ? 0x34363b : 0x2b2d31);
  for (let j = 0; j <= 17; j++) for (const k of [0, 1]) V.set(0, j, k, iron(0, j, k));
  for (let k = -6; k <= 7; k++) for (const j of [14, 15]) V.set(0, j, k, iron(0, j, k));
  for (let a = 0; a < 16; a++) { const t = a / 16 * TAU; V.set(Math.round(Math.cos(t) * 2), 20 + Math.round(Math.sin(t) * 2), 0, iron(a, 1, 0)); }
  for (const s of [-1, 1]) {
    for (let f = 0; f <= 12; f++) { const p = f / 12 * 1.25; for (const k of [0, 1]) V.set(Math.round(s * 5 * Math.sin(p)), Math.round(5 * (1 - Math.cos(p))), k, iron(f, s, k)); }
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) for (const k of [-1, 0, 1, 2]) V.set(Math.round(s * 5 * Math.sin(1.25)) + di + s, Math.round(5 * (1 - Math.cos(1.25))) + dj, k, iron(di, dj, k));
  }
  placeOnFloor(V, -12.4, -1.3, [0.1, 0.7, -1.45]);
  const C = new Vox(0.11);
  for (let l = 0; l < 13; l++) {
    const x = -10.6 + l * 0.34, z = -0.9 + Math.sin(l * 0.6) * 0.35, y = floorY(x, z) + 0.11;
    const flat = l % 2 === 0;
    for (const [a, b] of [[-1, 0], [1, 0], [-1, 1], [1, 1], [0, -1], [0, 2]]) C.at(x + a * 0.11, y + (flat ? 0 : b * 0.11), z + (flat ? b * 0.11 : 0), 0x3a3b3f);
  }
  C.toList(bottomList, { cull: false });
  BUBBLE_SRC.push(new THREE.Vector3(-12.2, floorY(-12.2, -1.3) + 0.8, -1.3));
}
{
  // amphorae
  const amph = (S, broken) => {
    const V = new Vox(S);
    for (let j = 0; j <= (broken ? 10 : 18); j++) {
      let r = j <= 1 ? 1.3 : j <= 12 ? 1.3 + 2.6 * Math.sin(Math.PI * (j - 1) / 13) : j <= 15 ? lerp(3.1, 1.3, (j - 12) / 3) : 1.3;
      if (j === 18) r = 1.8;
      const R = Math.ceil(r);
      for (let i = -R; i <= R; i++) for (let k = -R; k <= R; k++) {
        if (i * i + k * k > r * r) continue;
        let c = hash3(i, j, k) < 0.5 ? 0xb5653b : 0xa85a33;
        if (j === 9 || j === 10) c = (j === 10 && (i + k) % 2 === 0) ? 0x2a1a12 : 0x8c4527;
        V.set(i, j, k, c);
      }
    }
    if (!broken) for (const s of [-1, 1]) for (const [k, j] of [[2, 16], [3, 16], [4, 15], [4, 14], [4, 13], [3, 12]]) V.set(0, j, s * k, 0xa85a33);
    return V;
  };
  placeOnFloor(amph(0.12, false), -1.3, 2.6, [0.0, 0.9, 1.5]);
  placeOnFloor(amph(0.1, true), 0.2, 3.5, [0.25, 0.2, 0.2]);
  BUBBLE_SRC.push(new THREE.Vector3(-0.2, floorY(-0.2, 2.9) + 0.4, 2.9));
}
{
  // coral gardens along the glass floor
  const rnd = mulberry32(44);
  const sites = [[-16.2, 1.5], [-14.5, -2.4], [-9.5, 2.2], [-7.4, -2.8], [-3.5, 3.4], [2.0, -2.6], [3.6, 2.4], [8.6, -1.4], [10.8, 1.9], [12.4, -0.6], [-11.0, 3.4], [6.8, 3.1]];
  for (const [sx, sz] of sites) {
    const C = new Vox(0.12);
    const cols = [0xff6f91, 0xa05ad0, 0xff8c42, 0xf4d03f, 0x3fb8a0, 0xe84a5f];
    const nItems = 3 + ((rnd() * 3) | 0);
    for (let it = 0; it < nItems; it++) {
      const x = sx + (rnd() - 0.5) * 1.6, z = sz + (rnd() - 0.5) * 1.2;
      const y0 = floorY(x, z) + 0.04;
      const t = rnd(), col = cols[(rnd() * cols.length) | 0];
      if (t < 0.28) {                 // brain coral dome
        const r = 3 + rnd() * 2;
        for (let i = -5; i <= 5; i++) for (let j = 0; j <= 5; j++) for (let k = -5; k <= 5; k++) {
          if (i * i + (j * 1.3) ** 2 + k * k > r * r) continue;
          C.at(x + i * 0.12, y0 + j * 0.12, z + k * 0.12, (Math.sin(i * 1.3 + k * 0.9) > 0.3) ? 0x9a8a3a : 0xc8b45a);
        }
      } else if (t < 0.55) {          // branching coral
        const walk = (px, py, pz, len, d) => {
          for (let s = 0; s < len; s++) {
            C.at(px, py, pz, col, 0.06);
            py += 0.12; px += (rnd() - 0.5) * 0.14; pz += (rnd() - 0.5) * 0.14;
            if (d < 3 && rnd() < 0.22) walk(px, py, pz, len - s, d + 1);
          }
        };
        for (let b = 0; b < 3; b++) walk(x + (rnd() - 0.5) * 0.2, y0, z + (rnd() - 0.5) * 0.2, 6 + ((rnd() * 6) | 0), 0);
      } else if (t < 0.7) {           // sea fan
        const a = rnd() * Math.PI;
        for (let i = -5; i <= 5; i++) for (let j = 0; j <= 9; j++) {
          if (i * i * 0.6 + (j - 5) ** 2 > 26 || (hash3(i, j, it) < 0.3 && j > 1)) continue;
          C.at(x + Math.cos(a) * i * 0.12, y0 + j * 0.12, z + Math.sin(a) * i * 0.12, j === 0 ? 0x7a2a2a : 0xd8363a, 0, j * 0.08);
        }
      } else if (t < 0.85) {          // kelp / sea grass
        for (let b = 0; b < 4; b++) {
          const H = 10 + ((rnd() * 18) | 0), bx = x + (rnd() - 0.5) * 0.5, bz = z + (rnd() - 0.5) * 0.5;
          for (let s = 0; s < H; s++) C.at(bx + Math.sin(s * 0.4 + b) * 0.08, y0 + s * 0.12, bz, s % 6 === 5 ? 0x7fb54f : 0x3f8a4a, 0, 0.5 + s * 0.13);
        }
      } else {                        // starfish + shells
        for (let arm = 0; arm < 5; arm++) { const a = arm / 5 * TAU; for (let s = 0; s <= 3; s++) C.at(x + Math.cos(a) * s * 0.12, y0, z + Math.sin(a) * s * 0.12, 0xff7a2a); }
        C.at(x + 0.6, y0, z + 0.2, 0xf0e0c0); C.at(x + 0.72, y0, z + 0.2, 0xe8c8a8); C.at(x + 0.66, y0 + 0.12, z + 0.2, 0xf6ead4);
      }
    }
    C.toList(bottomList, { jitter: 0.08, cull: false });
    if (rnd() < 0.5) BUBBLE_SRC.push(new THREE.Vector3(sx, floorY(sx, sz) + 0.6, sz));
  }
}
const bottomMesh = makeInstanced(bottomList, MAT.vox, { name: 'relics' });
rigIn.add(bottomMesh);
inL.chest.position.copy(CHEST_POS);
rigIn.add(inL.chest);
const chestGlow = makeGlow(0xffc040, 3.2, 0.55, 0.7, true);
chestGlow.position.copy(CHEST_POS).add(new THREE.Vector3(0, -0.3, 0));
rigIn.add(chestGlow);

// ------------------------------------------------------------- the GPU sea
const WU = {
  uWake: { value: Array.from({ length: 24 }, () => new THREE.Vector3(0, 0, -1)) },
  uShip: { value: new THREE.Vector4(0, 0, 1, 0) },
  uSeaLo: { value: new THREE.Color(0x0f5a80) }, uSeaMid: { value: new THREE.Color(0x1f8fb0) },
  uSeaHi: { value: new THREE.Color(0x6fd3e0) }, uSeaFoam: { value: new THREE.Color(0xf2f7fa) },
  uLagoon: { value: new THREE.Color(0x3fd0c0) }, uSkyRefl: { value: new THREE.Color(0x335577) },
};
const SEA_V_HEAD = /* glsl */`
${GLSL_COMMON}
uniform vec3 uWake[24];
uniform vec4 uShip;
attribute float aSeed;
varying float vH; varying float vFoam; varying float vSeed; varying float vTop; varying float vShallow; varying vec3 vWPos;
`;
const SEA_V_NORMAL = /* glsl */`
vec3 icen = instanceMatrix[3].xyz;
float wh = waveH(icen.xz);
float ge = 0.35;
float gx = (waveH(icen.xz + vec2(ge, 0.0)) - wh) / ge;
float gz = (waveH(icen.xz + vec2(0.0, ge)) - wh) / ge;
vec3 objectNormal = vec3(normal);
if (normal.y > 0.5) objectNormal = normalize(vec3(-gx * 0.75, 1.0, -gz * 0.75));
#ifdef USE_TANGENT
vec3 objectTangent = vec3(tangent.xyz);
#endif
vTop = step(0.5, normal.y);
float amp = (0.27 + 0.72 * uStorm) * 1.13;
float crest = wh / amp;
float f = smoothstep(0.45 - 0.15 * uStorm, 0.85, crest) * (0.32 + 1.0 * uStorm);
f += smoothstep(0.5, 1.4, length(vec2(gx, gz))) * uStorm * 0.45;
vec2 idl = (icen.xz - uIsland.xy) / uIsland.zw;
float ie = length(idl);
vShallow = 1.0 - smoothstep(0.85, 1.45, ie);
f = max(f, (1.0 - smoothstep(0.9, 1.22, ie)) * smoothstep(0.7, 0.9, ie) * (0.55 + 0.45 * sin(uTime * 1.6 - ie * 14.0 + aSeed * 2.0)));
for (int i = 0; i < 24; i++) {
  vec3 w = uWake[i];
  if (w.z < 0.0 || w.z >= 1.0) continue;
  float d = length(icen.xz - w.xy);
  float ring = d - (0.35 + w.z * 1.9);
  float fade = 1.0 - w.z;
  f = max(f, fade * exp(-ring * ring * 22.0) * 0.9 + exp(-d * d * 9.0) * 0.65 * fade * fade * fade);
}
vec2 rel = icen.xz - uShip.xy;
float al = dot(rel, uShip.zw), ac = dot(rel, vec2(-uShip.w, uShip.z));
float he = length(vec2(al / 3.4, ac / 1.0));
f = max(f, (1.0 - smoothstep(0.82, 1.3, he)) * smoothstep(-0.7, 0.9, al / 3.4) * 0.95);
float st = uTime - uSplash.z;
if (st > 0.0 && st < 5.0) {
  float d = length(icen.xz - uSplash.xy);
  f = max(f, exp(-(d - st * 2.6) * (d - st * 2.6) * 1.6) * (1.0 - st / 5.0) * uSplash.w * 1.2);
  f = max(f, (1.0 - smoothstep(0.0, 1.2 + st, d)) * max(0.0, 1.0 - st / 2.5));
}
vFoam = smoothstep(0.42, 0.58, f + (aSeed - 0.5) * 0.35);
vH = wh; vSeed = aSeed;
`;
const seaMat = new THREE.MeshStandardMaterial({ roughness: 0.2, metalness: 0.0, side: THREE.DoubleSide });
seaMat.customProgramCacheKey = () => 'sea';
seaMat.onBeforeCompile = (sh) => {
  Object.assign(sh.uniforms, U, WU);
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\n' + SEA_V_HEAD)
    .replace('#include <beginnormal_vertex>', SEA_V_NORMAL)
    .replace('#include <begin_vertex>', 'vec3 transformed = vec3(position);\ntransformed.y = position.y > 0.0 ? wh : wh - (0.45 + 1.1 * uStorm);')
    .replace('#include <project_vertex>', '#include <project_vertex>\nvWPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;');
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', `#include <common>\n${GLSL_COMMON}
      uniform vec3 uSeaLo, uSeaMid, uSeaHi, uSeaFoam, uLagoon, uSkyRefl;
      varying float vH; varying float vFoam; varying float vSeed; varying float vTop; varying float vShallow; varying vec3 vWPos;`)
    .replace('void main() {', 'void main() {\nif (!insideBottle(vWPos)) discard;')
    .replace('#include <color_fragment>', `#include <color_fragment>
      {
        float amp = (0.27 + 0.72 * uStorm) * 1.13;
        float hn = clamp(vH / amp * 0.5 + 0.5, 0.0, 1.0);
        vec3 c = mix(uSeaLo, uSeaMid, smoothstep(0.1, 0.6, hn));
        c = mix(c, uSeaHi, smoothstep(0.62, 1.0, hn));
        c = mix(c, uLagoon, vShallow * 0.75);
        c *= 0.9 + vSeed * 0.2;
        if (vTop < 0.5) c *= 0.7;
        c = mix(c, uSeaFoam, vFoam);
        diffuseColor.rgb = c;
      }`)
    .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(0.16, 0.9, vFoam);')
    .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      {
        float fres = pow(max(0.0, 1.0 - abs(dot(normalize(vViewPosition), normal))), 4.0);
        totalEmissiveRadiance += uSkyRefl * (0.04 + 0.34 * fres) * vTop * (1.0 - vFoam * 0.6);
      }`)
    .replace('#include <opaque_fragment>', UNDERWATER_GLSL + '\n#include <opaque_fragment>');
};
const sea = (() => {
  const CELL = 0.42, cells = [];
  for (let x = GLASS_IN.xb + 0.12; x < CORK_X; x += CELL) {
    const r = profR(GLASS_IN, x); if (r <= 0) continue;
    const half = Math.sqrt(Math.max(0, r * r - WATER_Y * WATER_Y));
    for (let z = -Math.floor((half + CELL * 1.5) / CELL) * CELL; z <= half + CELL * 1.5; z += CELL) {
      const ih = islandH(x, z);
      if (ih !== null && ih > WATER_Y + 0.22) continue;
      cells.push(x, z);
    }
  }
  const n = cells.length / 2;
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mesh = new THREE.InstancedMesh(geo, seaMat, n);
  const seed = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    _m4.compose(_v3.set(cells[i * 2], WATER_Y, cells[i * 2 + 1]), _q.identity(), _s3.set(CELL, 1, CELL));
    mesh.setMatrixAt(i, _m4);
    seed[i] = hash3(i, 17, 3);
  }
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 1));
  mesh.receiveShadow = true; mesh.castShadow = false; mesh.frustumCulled = false;
  interior.add(mesh);
  return mesh;
})();
