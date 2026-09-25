// ============================================================================
//  06-ship: three-masted square-rigger — voxel hull, billowing sails (red
//           striped main course), full standing & running rigging, buoyancy
// ============================================================================
const SHIP_PATH = { cx: ISLAND.x + 0.2, cz: ISLAND.z + 0.3, a: 11.3, b: 5.7 };
const ship = {
  group: new THREE.Group(), theta: 1.9,
  y: WATER_Y, vy: 0, pitch: 0, vp: 0, roll: 0, vr: 0,
  x: 0, z: 0, fx: 1, fz: 0, spd: 1,
  wake: [], wakeT: 0, sprayAcc: 0, lanterns: [],
};
interior.add(ship.group);

(function buildShip() {
  const S = 0.16;
  const hull = new Vox(S);
  const sailList = [];
  const L = [];                     // rigging segments (ship-local)
  const P = (i, j, k) => new THREE.Vector3(i * S, j * S, k * S);
  const seg = (a, b) => L.push(a, b);
  const I0 = -20, I1 = 19, HB = 6.3;
  const deckJ = {}, hullK = {};
  const DJ = (i) => deckJ[clamp(i, I0, I1)], HK = (i) => hullK[clamp(i, I0, I1)];

  // ---------------------------------------------------------------- hull
  for (let i = I0; i <= I1; i++) {
    const u = (i - I0) / (I1 - I0) * 2 - 1;
    let dj = 3;
    if (u > 0.6) dj = 4;
    if (u > 0.86) dj = 5;
    if (u < -0.42) dj = 5;
    if (u < -0.8) dj = 6;
    const kj = -5 + Math.round(Math.pow(Math.abs(u), 5) * 3.5);
    let plan = 1;
    if (u > 0.2) plan = Math.sqrt(Math.max(0, 1 - Math.pow((u - 0.2) / 0.82, 2)));
    if (u < -0.82) plan = 0.84 + (u + 1) * 0.8;
    deckJ[i] = dj;
    for (let j = kj; j <= dj; j++) {
      const v = Math.min(1, (j - kj) / Math.max(1, 3 - kj));
      const sec = 0.22 + 0.78 * Math.sqrt(Math.max(0, v));
      const tumble = j > 2 ? 1 - (j - 2) * 0.045 : 1;
      const hw = Math.max(0.5, HB * Math.max(plan, 0.1) * sec * tumble);
      const K = Math.round(hw);
      if (j === dj) hullK[i] = K;
      for (let k = -K; k <= K; k++) {
        const side = Math.abs(k) === K;
        let c;
        if (j < 0) c = hash3(i, j, k) < 0.5 ? 0x7c3b22 : 0x70341e;
        else if (j === 0) c = 0x2b1c12;
        else if (j <= 2) c = 0xc08a2e;
        else c = hash3(i, j, k) < 0.5 ? 0x4b2d19 : 0x432815;
        if (j === dj) c = side ? 0x5c3a20 : (k % 2 === 0 ? 0xab885a : 0x9b7a50);
        if (side && (j === 1 || j === 2) && ((i % 4) + 4) % 4 === 0 && i > I0 + 3 && i < I1 - 5) c = 0x17110b;
        if (i === I0 && j >= dj - 4 && j < dj) c = 0x3c2414;     // transom
        hull.set(i, j, k, c);
      }
    }
  }
  for (let i = I0; i <= I1; i++) {                    // bulwarks / rails
    const dj = deckJ[i], K = hullK[i];
    for (const k of [-K, K]) hull.set(i, dj + 1, k, 0x5c3a20);
    if (i === I0 || i === I1) for (let k = -K; k <= K; k++) hull.set(i, dj + 1, k, 0x5c3a20);
    if (((i % 4) + 4) % 4 === 0 && i > I0 + 3 && i < I1 - 5) for (const k of [-K - 1, K + 1]) hull.set(i, 1, k, 0x121212); // cannon muzzles
  }
  // stern windows, galleries, gilt trim, lanterns
  {
    const dj = deckJ[I0], K = hullK[I0];
    for (let k = -K; k <= K; k++) hull.set(I0 - 1, dj, k, 0xd4a640);
    for (const j of [dj - 1, dj - 3]) for (const k of [-3, -1, 1, 3]) hull.set(I0 - 1, j, k, 0xffc66a, 1.3);
    for (const s of [-1, 1]) for (const i of [I0 + 1, I0 + 3]) hull.set(i, dj - 2, s * (hullK[i] + 1), 0xffc66a, 1.2);
    for (const k of [-3, 0, 3]) { hull.set(I0 - 1, dj + 1, k, 0x2a2a2a); hull.set(I0 - 1, dj + 2, k, 0xffd27a, 2.6); hull.set(I0 - 1, dj + 3, k, 0x2a2a2a); }
    ship.lanterns = [-3, 0, 3].map((k) => P(I0 - 1, dj + 2, k));
  }
  // bowsprit + figurehead
  const djB = deckJ[I1];
  const bowTip = P(I1 + 14, djB + 6, 0), bowMid = P(I1 + 7, djB + 3, 0);
  for (let t = 0; t <= 14; t++) hull.set(I1 + t, djB + Math.round(t * 0.42), 0, t > 10 ? 0x4a3020 : 0x5a3a22);
  for (let j = 1; j <= 4; j++) hull.set(I1 + 1, j, 0, 0xd9a93a, 0.15);
  // deck furniture
  for (const [i, k] of [[5, -3], [5, 3], [-6, 3]]) for (let j = 1; j <= 2; j++) hull.set(i, deckJ[i] + j, k, j === 2 ? 0x3a2414 : 0x6a4424);
  for (let i = 1; i <= 4; i++) for (let k = -1; k <= 1; k++) hull.set(i, deckJ[i] + 1, k, (i + k) % 2 ? 0x2a1a0e : 0x5a3a22);  // hatch grating
  for (let j = 1; j <= 2; j++) hull.set(-15, deckJ[-15] + j, 0, 0x6a4424);                       // wheel post
  for (const [dj2, dk] of [[3, 0], [2, -1], [2, 1], [1, 0], [3, -1], [3, 1], [1, -1], [1, 1]]) hull.set(-16, deckJ[-16] + dj2 + 1, dk, 0x7a4c28);

  // ---------------------------------------------------------------- masts
  const masts = [
    { i: 9, h: 26, tiers: [[4, 11, 7.0, 6.2, 0], [12, 19, 5.6, 4.8, 0], [20, 24, 4.2, 3.4, 0]] },
    { i: -1, h: 31, tiers: [[4, 12, 7.6, 6.8, 1], [13, 21, 6.2, 5.2, 1], [22, 28, 4.6, 3.8, 0]] },
    { i: -12, h: 22, tiers: [[9, 14, 4.8, 4.2, 0], [15, 19, 3.6, 3.0, 0]] },
  ];
  for (const m of masts) {
    const b = deckJ[m.i] + 1;
    m.b = b;
    for (let j = 0; j < m.h; j++) hull.set(m.i, b + j, 0, j % 9 === 8 ? 0x3a2414 : 0x6b4a2c);
    const topJ = b + m.tiers[0][1] + 1;                     // fighting top
    const crossJ = b + (m.tiers[1] ? m.tiers[1][1] : m.h - 3) + 1;
    m.topJ = topJ; m.crossJ = crossJ; m.headJ = b + m.h - 1;
    for (let i = -1; i <= 1; i++) for (let k = -2; k <= 2; k++) if (i || k) hull.set(m.i + i, topJ, k, 0x4a3020);
    for (const k of [-1, 1]) hull.set(m.i, crossJ, k, 0x4a3020);
    hull.set(m.i, b + m.h, 0, 0xd4a640, 0.3);                // truck
    // pennant
    for (let n = 0; n < 9; n++) {
      sailList.push({ x: (m.i - n * 1.05) * S, y: (b + m.h - 1) * S - n * 0.012, z: 0, s: S, sx: S * 1.05, sy: S * (n < 3 ? 1.6 : 1.0 - n * 0.06), sz: S * 0.4, c: 0xc0282c, w: 1.2 + n * 0.45, j: 0 });
    }
    // square sails + yards
    for (const [j0, j1, hw0, hw1, red] of m.tiers) {
      const yj = b + j1 + 1, yhw = Math.round(hw1) + 1;
      for (let k = -yhw; k <= yhw; k++) hull.set(m.i + 1, yj, k, 0x4a3020);
      seg(P(m.i + 1, yj, -yhw), P(m.i - 7, DJ(m.i - 7) + 1, -HK(m.i - 7)));   // braces
      seg(P(m.i + 1, yj, yhw), P(m.i - 7, DJ(m.i - 7) + 1, HK(m.i - 7)));
      for (let j = b + j0; j <= b + j1; j++) {
        const t = (j - b - j0) / (j1 - j0);
        const hw = lerp(hw0, hw1, t);
        const K = Math.floor(hw);
        for (let k = -K; k <= K; k++) {
          const kk = k / (hw + 0.5);
          const bil = 1.7 * (1 - kk * kk) * (0.35 + 0.65 * Math.sin(Math.PI * (1 - t) * 0.9 + 0.15));
          let c = (Math.abs(k) % 3 === 0) ? 0xe1d6bb : 0xefe6cf;
          if (red && ((k + 40) >> 1) % 2 === 0) c = 0xb3262a;
          if (j === b + j0 || j === b + j1 || Math.abs(k) === K) c = red && c === 0xb3262a ? 0x9a1f22 : 0xd6c9a6;
          sailList.push({ x: (m.i + 1.2 + bil) * S, y: j * S, z: k * S, s: S, sx: S * 0.55, c, w: 0.25 + 0.45 * (1 - kk * kk), j: 0.04 * (hash3(j, k, m.i) * 2 - 1) });
        }
      }
      if (j0 === m.tiers[0][0]) {                        // course sheets to the rail
        const bj = b + j0;
        seg(P(m.i + 1.5, bj, -Math.floor(hw0)), P(m.i - 4, DJ(m.i - 4) + 1, -HK(m.i - 4)));
        seg(P(m.i + 1.5, bj, Math.floor(hw0)), P(m.i - 4, DJ(m.i - 4) + 1, HK(m.i - 4)));
      }
    }
    // shrouds with ratlines
    for (const s of [-1, 1]) {
      const feet = [-2, 0, 2].map((di) => P(m.i + di, DJ(m.i + di) + 1, s * (HK(m.i + di) + 0.6)));
      const heads = [-1, 0, 1].map((di) => P(m.i + di * 0.5, topJ, s * 2));
      for (let n = 0; n < 3; n++) seg(heads[n], feet[n]);
      for (let r = 1; r <= 8; r++) {
        const t = r / 9;
        const a = heads[0].clone().lerp(feet[0], t), c2 = heads[2].clone().lerp(feet[2], t);
        seg(a, c2);
      }
      seg(P(m.i, crossJ, s * 1), P(m.i, topJ, s * 2.6));
      seg(P(m.i, m.headJ, s * 0.5), P(m.i, crossJ, s * 1.6));
      seg(P(m.i, m.headJ - 1, s * 0.5), P(m.i - 9, DJ(m.i - 9) + 1, s * HK(m.i - 9)));   // backstays
    }
  }
  // stays
  const [F, M, Z] = masts;
  seg(P(F.i, F.topJ, 0), bowMid); seg(P(F.i, F.headJ, 0), bowTip); seg(P(F.i, F.crossJ, 0), P(I1 + 10, djB + 4, 0));
  seg(P(M.i, M.topJ, 0), P(F.i, F.b + 2, 0)); seg(P(M.i, M.crossJ, 0), P(F.i, F.topJ, 0)); seg(P(M.i, M.headJ, 0), P(F.i, F.crossJ, 0));
  seg(P(Z.i, Z.topJ, 0), P(M.i, M.b + 3, 0)); seg(P(Z.i, Z.headJ, 0), P(M.i, M.topJ, 0));
  seg(bowTip, P(I1 + 2, 1, 0));                                   // bobstay

  // jibs (fore-and-aft, centreline)
  const tri = (A, B, C, bulge) => {
    const minI = Math.min(A[0], B[0], C[0]), maxI = Math.max(A[0], B[0], C[0]);
    const minJ = Math.min(A[1], B[1], C[1]), maxJ = Math.max(A[1], B[1], C[1]);
    const area = (B[0] - A[0]) * (C[1] - A[1]) - (C[0] - A[0]) * (B[1] - A[1]);
    for (let i = minI; i <= maxI; i++) for (let j = minJ; j <= maxJ; j++) {
      const l1 = ((B[0] - i) * (C[1] - j) - (C[0] - i) * (B[1] - j)) / area;
      const l2 = ((C[0] - i) * (A[1] - j) - (A[0] - i) * (C[1] - j)) / area;
      const l3 = 1 - l1 - l2;
      if (l1 < 0.02 || l2 < 0.02 || l3 < 0.02) continue;
      const bz = bulge * Math.min(1, Math.min(l1, l2, l3) * 4);
      sailList.push({ x: i * S, y: j * S, z: bz * S, s: S, sz: S * 0.55, c: (i % 3 === 0) ? 0xe1d6bb : 0xefe6cf, w: 0.3, j: 0.03 * (hash3(i, j, 5) * 2 - 1) });
    }
    seg(P(A[0], A[1], 0), P(B[0], B[1], 0));
  };
  tri([F.i + 1, F.b + 20], [I1 + 13, djB + 6], [I1 + 2, djB + 2], 1.4);
  tri([F.i + 1, F.b + 12], [I1 + 6, djB + 3], [F.i + 4, F.b + 1], 1.1);
  // spanker (gaff sail on the mizzen)
  for (let i = Z.i - 10; i <= Z.i - 1; i++) {
    const top = Z.b + 11 + Math.round((Z.i - i) * 0.33);
    for (let j = Z.b + 2; j <= top; j++) {
      const t = (Z.i - i) / 10, bz = 1.2 * Math.sin(Math.PI * t) * Math.sin(Math.PI * (j - Z.b - 2) / (top - Z.b - 2 + 0.01));
      sailList.push({ x: i * S, y: j * S, z: bz * S, s: S, sz: S * 0.55, c: (j === top || j === Z.b + 2) ? 0xd6c9a6 : 0xefe6cf, w: 0.3, j: 0 });
    }
  }
  for (let t = 0; t <= 10; t++) { hull.set(Z.i - t, Z.b + 1, 1, 0x4a3020); hull.set(Z.i - t, Z.b + 12 + Math.round(t * 0.33), 1, 0x4a3020); }
  seg(P(Z.i - 10, Z.b + 15, 0), P(Z.i, Z.headJ, 0));
  seg(P(Z.i - 10, Z.b + 1, 0), P(I0, deckJ[I0] + 1, 0));
  // stern ensign on a flagstaff
  const fsJ = deckJ[I0] + 1;
  for (let j = 0; j < 9; j++) hull.set(I0 - 2, fsJ + j, 0, 0x4a3020);
  for (let i = 1; i <= 7; i++) for (let j = 3; j <= 8; j++) {
    const gold = j === 5 || j === 6 || i === 3;
    sailList.push({ x: (I0 - 2 - i) * S, y: (fsJ + j) * S, z: 0, s: S, sz: S * 0.4, c: gold ? 0xe0b040 : 0xb02026, w: 0.4 + i * 0.35, j: 0 });
  }

  const hullMesh = makeInstanced(hull.toList([], { jitter: 0.06 }), MAT.vox, { name: 'hull' });
  const sailMesh = makeInstanced(sailList, MAT.vox, { name: 'sails' });
  hullMesh.frustumCulled = sailMesh.frustumCulled = false;
  const g = new THREE.BufferGeometry().setFromPoints(L);
  const rigging = new THREE.LineSegments(g, MAT.lines);
  rigging.frustumCulled = false;
  ship.group.add(hullMesh, sailMesh, rigging);
  ship.bowLocal = new THREE.Vector3((I1 + 1) * S, 0.05, 0);
  ship.sternLocal = new THREE.Vector3(I0 * S, 0, 0);
  for (const p of ship.lanterns) { const gl = makeGlow(0xffb55a, 0.9, 0.5, 0.8); gl.position.copy(p); ship.group.add(gl); }
})();

function updateShip(dt, now) {
  const st = U.uStorm.value, P = SHIP_PATH;
  ship.spd = lerp(ship.spd, 1.05 + 0.95 * st, dt * 0.5);
  let dx = -P.a * Math.sin(ship.theta), dz = P.b * Math.cos(ship.theta);
  let dl = Math.hypot(dx, dz);
  ship.theta += ship.spd * dt / dl;
  dx = -P.a * Math.sin(ship.theta); dz = P.b * Math.cos(ship.theta); dl = Math.hypot(dx, dz);
  const x = P.cx + P.a * Math.cos(ship.theta), z = P.cz + P.b * Math.sin(ship.theta);
  const fx = dx / dl, fz = dz / dl;
  ship.x = x; ship.z = z; ship.fx = fx; ship.fz = fz;
  const yaw = Math.atan2(-fz, fx);
  // four-point buoyancy sampling: bow, stern, port, starboard
  const Lh = 2.9, B = 0.95;
  const hb = waveH(x + fx * Lh, z + fz * Lh), hs = waveH(x - fx * Lh, z - fz * Lh);
  const hp = waveH(x - fz * B, z + fx * B), hq = waveH(x + fz * B, z - fx * B);
  const ty = WATER_Y + (hb + hs + hp + hq) * 0.25 - 0.03;
  const tp = Math.atan2(hb - hs, Lh * 2);
  const tr = -Math.atan2(hp - hq, B * 2) * 0.8 + 0.045 + 0.09 * st + Math.sin(now * 0.7) * 0.01;
  ship.vy += ((ty - ship.y) * 16 - ship.vy * 4.5) * dt; ship.y += ship.vy * dt;
  ship.vp += ((tp - ship.pitch) * 13 - ship.vp * 3.8) * dt; ship.pitch += ship.vp * dt;
  ship.vr += ((tr - ship.roll) * 10 - ship.vr * 3.0) * dt; ship.roll += ship.vr * dt;
  ship.group.position.set(x, ship.y, z);
  ship.group.rotation.set(ship.roll, yaw, ship.pitch, 'YZX');
  ship.group.updateMatrixWorld(true);
  WU.uShip.value.set(x, z, fx, fz);

  // wake trail (GPU foam rings)
  ship.wakeT -= dt;
  if (ship.wakeT <= 0) {
    ship.wakeT = 0.2;
    const sp = ship.sternLocal.clone().applyMatrix4(ship.group.matrixWorld);
    ship.wake.unshift({ x: sp.x, z: sp.z, t: now });
    if (ship.wake.length > 24) ship.wake.length = 24;
  }
  const arr = WU.uWake.value;
  for (let i = 0; i < 24; i++) {
    const w = ship.wake[i];
    if (w) arr[i].set(w.x, w.z, (now - w.t) / 4.8); else arr[i].set(0, 0, -1);
  }
  // bow spray
  ship.sprayAcc += dt * (7 + 45 * st) * (0.6 + Math.max(0, -ship.vp) * 4 + Math.max(0, -ship.vy) * 2);
  const bow = ship.bowLocal.clone().applyMatrix4(ship.group.matrixWorld);
  while (ship.sprayAcc > 1) {
    ship.sprayAcc -= 1;
    const side = Math.random() < 0.5 ? -1 : 1, up = (0.8 + Math.random() * 1.6) * (0.7 + st * 0.8);
    const sx = -fz * side, sz = fx * side, out = 0.6 + Math.random() * 1.1;
    particles.spawn(bow.x + sx * 0.25, Math.max(bow.y, seaY(bow.x, bow.z)), bow.z + sz * 0.25,
      fx * ship.spd * 0.7 + sx * out, up, fz * ship.spd * 0.7 + sz * out,
      0.5 + Math.random() * 0.6, 0.05 + Math.random() * 0.06, 0xf4f9fc, 0.05, P_SPRAY);
  }
}
