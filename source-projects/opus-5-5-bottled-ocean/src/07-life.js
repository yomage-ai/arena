// ============================================================================
//  07-life: particles, gulls, whale, fish, crabs, dinghy, buoy, clouds,
//           sun & moon, lighthouse beams, rain, lightning, smoke, bubbles
// ============================================================================
const P_SPRAY = 0, P_BUBBLE = 1, P_SMOKE = 2, P_SPARK = 3, P_DROP = 4;
class Particles {
  constructor(max) {
    this.max = max; this.n = 0;
    this.p = new Float32Array(max * 3); this.v = new Float32Array(max * 3); this.col = new Float32Array(max * 3);
    this.life = new Float32Array(max); this.maxLife = new Float32Array(max); this.size = new Float32Array(max);
    this.emit = new Float32Array(max); this.seed = new Float32Array(max); this.kind = new Uint8Array(max);
    const geo = new THREE.BoxGeometry(1, 1, 1);
    this.mesh = new THREE.InstancedMesh(geo, MAT.vox, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aEmit = new THREE.InstancedBufferAttribute(new Float32Array(max), 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aEmit', this.aEmit);
    geo.setAttribute('aWind', new THREE.InstancedBufferAttribute(new Float32Array(max), 1));
    this.mesh.count = 0; this.mesh.frustumCulled = false;
    interior.add(this.mesh);
  }
  spawn(x, y, z, vx, vy, vz, life, size, hex, emit, kind) {
    if (this.n >= this.max) return;
    const i = this.n++, i3 = i * 3;
    this.p[i3] = x; this.p[i3 + 1] = y; this.p[i3 + 2] = z;
    this.v[i3] = vx; this.v[i3 + 1] = vy; this.v[i3 + 2] = vz;
    _c.setHex(hex); this.col[i3] = _c.r; this.col[i3 + 1] = _c.g; this.col[i3 + 2] = _c.b;
    this.life[i] = this.maxLife[i] = life; this.size[i] = size; this.emit[i] = emit; this.kind[i] = kind; this.seed[i] = Math.random();
  }
  kill(i) {
    const j = --this.n; if (i === j) return;
    for (let a = 0; a < 3; a++) { this.p[i * 3 + a] = this.p[j * 3 + a]; this.v[i * 3 + a] = this.v[j * 3 + a]; this.col[i * 3 + a] = this.col[j * 3 + a]; }
    this.life[i] = this.life[j]; this.maxLife[i] = this.maxLife[j]; this.size[i] = this.size[j];
    this.emit[i] = this.emit[j]; this.kind[i] = this.kind[j]; this.seed[i] = this.seed[j];
  }
  update(dt, now) {
    const p = this.p, v = this.v, st = U.uStorm.value;
    let i = 0;
    while (i < this.n) {
      this.life[i] -= dt;
      const i3 = i * 3, k = this.kind[i];
      let dead = this.life[i] <= 0;
      if (!dead) {
        if (k === P_SPRAY || k === P_DROP) {
          v[i3 + 1] -= 7.5 * dt;
          const dr = Math.pow(0.35, dt); v[i3] *= dr; v[i3 + 2] *= dr;
          v[i3] += st * 1.5 * dt;
          p[i3] += v[i3] * dt; p[i3 + 1] += v[i3 + 1] * dt; p[i3 + 2] += v[i3 + 2] * dt;
          if (v[i3 + 1] < 0 && p[i3 + 1] < seaY(p[i3], p[i3 + 2])) dead = true;
        } else if (k === P_BUBBLE) {
          v[i3 + 1] = Math.min(v[i3 + 1] + 1.6 * dt, 1.3);
          const w = Math.sin(now * 6 + this.seed[i] * 40) * 0.35;
          p[i3] += (v[i3] + w) * dt; p[i3 + 1] += v[i3 + 1] * dt; p[i3 + 2] += (v[i3 + 2] + w * 0.6) * dt;
          if (p[i3 + 1] > seaY(p[i3], p[i3 + 2]) - 0.04) {
            dead = true;
            for (let q = 0; q < 2; q++) this.spawn(p[i3], p[i3 + 1] + 0.05, p[i3 + 2], (Math.random() - 0.5) * 0.8, 0.8 + Math.random() * 0.6, (Math.random() - 0.5) * 0.8, 0.3, 0.035, 0xeaf6ff, 0.1, P_SPRAY);
          }
        } else if (k === P_SMOKE) {
          v[i3 + 1] *= Math.pow(0.8, dt);
          p[i3] += (v[i3] + 0.18 + st * 1.2) * dt; p[i3 + 1] += v[i3 + 1] * dt; p[i3 + 2] += v[i3 + 2] * dt;
        } else {
          p[i3] += v[i3] * dt; p[i3 + 1] += v[i3 + 1] * dt; p[i3 + 2] += v[i3 + 2] * dt;
        }
      }
      if (dead) { this.kill(i); continue; }
      i++;
    }
    const m = this.mesh, cArr = m.instanceColor.array, eArr = this.aEmit.array;
    for (i = 0; i < this.n; i++) {
      const i3 = i * 3, k = this.kind[i], t = this.life[i] / this.maxLife[i], sd = this.seed[i];
      let s = this.size[i];
      if (k === P_SMOKE) s *= (1 + (1 - t) * 2.4) * Math.min(1, t * 3) * Math.min(1, (1 - t) * 8 + 0.2);
      else if (k === P_SPARK) s *= Math.sin(t * Math.PI);
      else s *= 0.35 + 0.65 * Math.min(1, t * 2.5);
      _e.set(sd * 6 + (1 - t) * 4 * (k === P_SPRAY ? 1 : 0), sd * 9, sd * 3);
      _m4.compose(_v3.set(p[i3], p[i3 + 1], p[i3 + 2]), _q.setFromEuler(_e), _s3.set(s, s, s));
      m.setMatrixAt(i, _m4);
      cArr[i3] = this.col[i3]; cArr[i3 + 1] = this.col[i3 + 1]; cArr[i3 + 2] = this.col[i3 + 2];
      eArr[i] = this.emit[i];
    }
    m.count = this.n;
    m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; this.aEmit.needsUpdate = true;
  }
}
const particles = new Particles(1400);

// --------------------------------------------------------------------- gulls
const gulls = (() => {
  const S = 0.06;
  const body = new Vox(S), wing = new Vox(S), wingL = new Vox(S);
  for (let i = -7; i <= 6; i++) for (let j = -2; j <= 2; j++) for (let k = -2; k <= 2; k++) {
    const rx = i >= 0 ? 6 : 7, ry = i > 3 ? 1.6 : 2.1, rz = i > 3 ? 1.6 : 1.9;
    if ((i / rx) ** 2 + (j / ry) ** 2 + (k / rz) ** 2 > 1.05) continue;
    body.set(i, j, k, j >= 1 && i < 3 ? 0xc3c9d0 : 0xf5f5f1);
  }
  voxSphere(body, 6, 1, 0, 1.7, 0xf8f8f6);
  body.set(8, 1, 0, 0xf2b61f); body.set(9, 1, 0, 0xf2b61f); body.set(9, 0, 0, 0xd23a2a);
  body.set(7, 2, 1, 0x111111); body.set(7, 2, -1, 0x111111);
  for (let i = -10; i <= -7; i++) for (let k = -1; k <= 1; k++) body.set(i, 0, k, i === -10 ? 0x2a2a2a : 0xe8eaec);
  for (let k = 1; k <= 13; k++) {
    const chord = k < 5 ? 4 : k < 9 ? 3 : 2, sh = -Math.floor(k * 0.28);
    for (let i = -chord; i <= chord - 1; i++) {
      const c = k >= 10 ? (k === 13 && i === -chord ? 0xf0f0f0 : 0x1c1c1c) : i === -chord ? 0xf0f0f0 : 0xb9c0c8;
      wing.set(i + sh, 0, k, c); wingL.set(i + sh, 0, -k, c);
    }
  }
  const n = 6;
  const mk = (v) => { const m = new THREE.InstancedMesh(meshVox(v, 0.03), MAT.voxV, n); m.frustumCulled = false; m.castShadow = true; m.customDepthMaterial = MAT.depthWind; interior.add(m); return m; };
  const mBody = mk(body), mW = mk(wing), mWL = mk(wingL);
  const birds = [];
  const r = mulberry32(61);
  for (let i = 0; i < n; i++) birds.push({ follow: i < 3 ? 0 : 1, r: lerp(2.4, 4.4, r()), y: lerp(4.7, 6.0, r()), w: (r() < 0.5 ? -1 : 1) * lerp(0.38, 0.62, r()), ph: r() * TAU, fp: r() * TAU, cx: ISLAND.x, cz: ISLAND.z });
  const shoulderR = new THREE.Vector3(0, 0.06, 0.08), shoulderL = new THREE.Vector3(0, 0.06, -0.08);
  const mB = new THREE.Matrix4(), mT = new THREE.Matrix4(), mR = new THREE.Matrix4(), e = new THREE.Euler();
  return function update(dt, now) {
    const st = U.uStorm.value;
    birds.forEach((b, idx) => {
      const tx = b.follow ? clamp(ship.x, -12.5, 4.5) : ISLAND.x + 0.4, tz = b.follow ? clamp(ship.z, -2.2, 2.2) : ISLAND.z - 0.1;
      b.cx = lerp(b.cx, tx, dt * 0.35); b.cz = lerp(b.cz, tz, dt * 0.35);
      const w = b.w * (1 + st * 0.6), phi = b.ph + w * now;
      const rad = b.r * (1 + Math.sin(now * 0.3 + idx) * 0.12 + st * 0.08 * Math.sin(now * 2.1 + idx));
      const x = b.cx + rad * Math.cos(phi), z = b.cz + rad * Math.sin(phi) * 0.82, y = b.y + Math.sin(phi * 2 + idx) * 0.3 + st * 0.2 * Math.sin(now * 3 + idx);
      const vx = -rad * Math.sin(phi) * w, vz = rad * Math.cos(phi) * 0.82 * w, vy = Math.cos(phi * 2 + idx) * 0.6 * w;
      const yaw = Math.atan2(-vz, vx), pitch = Math.atan2(vy, Math.hypot(vx, vz)) * 0.6;
      const bank = -Math.sign(w) * (0.32 + st * 0.2) + Math.sin(now * 1.7 + idx) * 0.06;
      const flapOn = smooth(-0.35, 0.15, Math.sin(now * 0.45 + b.fp)) * (1 - st * 0.3) + st * 0.3;
      const flap = lerp(0.14 + Math.sin(now * 2 + idx) * 0.04, Math.sin(now * (10 + st * 4) + b.fp) * 0.8 + 0.12, flapOn);
      e.set(bank, yaw, pitch, 'YZX');
      mB.compose(_v3.set(x, y, z), _q.setFromEuler(e), _s3.set(1, 1, 1));
      mBody.setMatrixAt(idx, mB);
      mT.makeTranslation(shoulderR.x, shoulderR.y, shoulderR.z); mR.makeRotationX(-flap);
      mW.setMatrixAt(idx, _m4.copy(mB).multiply(mT).multiply(mR));
      mT.makeTranslation(shoulderL.x, shoulderL.y, shoulderL.z); mR.makeRotationX(flap);
      mWL.setMatrixAt(idx, _m4.copy(mB).multiply(mT).multiply(mR));
    });
    mBody.instanceMatrix.needsUpdate = mW.instanceMatrix.needsUpdate = mWL.instanceMatrix.needsUpdate = true;
  };
})();

// --------------------------------------------------------------------- whale
const whale = (() => {
  const S = 0.18;
  const body = new Vox(S), tail = new Vox(S, 5.5 * S, 0, 0);   // tail voxels are placed relative to the joint
  const rAt = (i) => (i >= 6 ? 4.2 * Math.sqrt(Math.max(0, 1 - ((i - 6) / 7.2) ** 2)) : i >= -3 ? 4.2 : Math.max(0.9, 4.2 - (-3 - i) * 0.33));
  const r0 = mulberry32(90);
  for (let i = -13; i <= 12; i++) {
    const r = rAt(i), R = Math.ceil(r);
    const V = i >= -5 ? body : tail;
    for (let j = -R; j <= R; j++) for (let k = -R; k <= R; k++) {
      if ((k / r) ** 2 + (j / (r * 0.85)) ** 2 > 1) continue;
      let c = r0() < 0.12 ? 0x3c5068 : 0x2e3f54;
      if (j < -0.25 * r) c = (i > -2 && ((k % 2) + 2) % 2 === 0) ? 0xa7b2bd : 0xd6dde3;
      if (i > 5 && j > 0.55 * r && r0() < 0.3) c = 0x1e2a38;
      if (i >= 4 && i <= 12 && j === -1 && Math.abs(k) >= r - 1.2) c = 0x1a2330;
      V.set(i, j, k, c);
    }
  }
  const eyeK = Math.round(rAt(7) * 0.92);
  for (const s of [-1, 1]) { body.set(7, 0, s * eyeK, 0x0a0a0a); body.set(8, 0, s * eyeK, 0xe8eef2); }
  for (const s of [-1, 1]) for (let n = 0; n <= 11; n++) {                 // long pectoral flippers
    const k = s * Math.round(3.6 + n * 0.85), j = Math.round(-2 - n * 0.38), i = Math.round(4 - n * 0.45);
    body.set(i, j, k, n > 9 ? 0x2e3f54 : 0xe4eaee); body.set(i + 1, j, k, n > 9 ? 0x2e3f54 : 0xdfe6ec);
    if (n < 6) body.set(i - 1, j, k, 0xe4eaee);
  }
  body.set(-4, 4, 0, 0x2e3f54); body.set(-5, 4, 0, 0x2e3f54);
  for (let k = -8; k <= 8; k++) {                                          // flukes
    const a = Math.abs(k);
    const iF = Math.round(-13 - a * 0.35), iB = Math.round(-15.6 - a * 0.1 + (a < 1.5 ? 1.2 : 0));
    for (let i = iB; i <= iF; i++) tail.set(i, 0, k, i === iB ? 0xc8d0d8 : 0x2e3f54);
  }
  const group = new THREE.Group(), tailPivot = new THREE.Group();
  const mb = makeInstanced(body.toList([], { jitter: 0.05 }), MAT.vox, { name: 'whale' });
  // tail voxels were indexed from world-ish i; shift so the pivot sits at the joint
  tail.o[0] = 5.5 * S;
  const mt = makeInstanced(tail.toList([], { jitter: 0.05 }), MAT.vox, { name: 'whaleTail' });
  mb.frustumCulled = mt.frustumCulled = false;
  tailPivot.position.set(-5.5 * S, 0, 0);
  tailPivot.add(mt);
  group.add(mb, tailPivot);
  interior.add(group);

  const W = { th: 3.6, state: 0, tau: 0, next: 16, y: -6.2, pitch: 0, roll: 0, spdH: 1.05, x: 0, z: 0, exitDone: false, entryDone: false, y0: -6.2 };
  const A = 8.4, B = 4.2, DEEP = -6.2, SURF = WATER_Y - 0.25, G = 5.2, VY = 5.4, TA = 3.2, TB = 2 * 5.4 / 5.2, TC = 3.0;
  const herm = (p0, m0, p1, m1, s) => { const s2 = s * s, s3 = s2 * s; return (2 * s3 - 3 * s2 + 1) * p0 + (s3 - 2 * s2 + s) * m0 + (-2 * s3 + 3 * s2) * p1 + (s3 - s2) * m1; };
  const splashAt = (x, z, n, str) => {
    for (let q = 0; q < n; q++) {
      const a = Math.random() * TAU, sp = 0.6 + Math.random() * 2.4 * str;
      particles.spawn(x + Math.cos(a) * 0.6, seaY(x, z) + 0.05, z + Math.sin(a) * 0.4, Math.cos(a) * sp, 2.5 + Math.random() * 4.5 * str, Math.sin(a) * sp, 1.3, 0.06 + Math.random() * 0.09, 0xf2f8fb, 0.05, P_DROP);
    }
  };
  function update(dt, now) {
    const th0 = W.th;
    W.spdH = lerp(W.spdH, W.state === 1 && W.tau > TA - 0.5 && W.tau < TA + TB ? 2.1 : 1.05, dt * 2);
    const dxp = -A * Math.sin(W.th), dzp = B * Math.cos(W.th), dl = Math.hypot(dxp, dzp);
    W.th += W.spdH * dt / dl;
    const x = ISLAND.x + A * Math.cos(W.th), z = ISLAND.z + B * Math.sin(W.th);
    const fx = dxp / dl, fz = dzp / dl;
    let y = DEEP + Math.sin(now * 0.3) * 0.35, vy = 0;
    if (W.state === 0) {
      W.next -= dt;
      const shipAng = Math.atan2((ship.z - ISLAND.z) / B, (ship.x - ISLAND.x) / A);
      let diff = Math.abs(((W.th - shipAng) % TAU + TAU) % TAU); diff = Math.min(diff, TAU - diff);
      // breach where it is clear of the dock (east end) and of the ship
      const thAir = W.th + 0.85;
      let dShip = Math.abs(((thAir - shipAng) % TAU + TAU) % TAU); dShip = Math.min(dShip, TAU - dShip);
      if (W.next <= 0 && diff > 1.5 && dShip > 1.4 && Math.cos(thAir) < 0.3) { W.state = 1; W.tau = 0; W.y0 = y; W.exitDone = W.entryDone = false; }
    }
    if (W.state === 1) {
      W.tau += dt;
      const t = W.tau;
      if (t < TA) { const s = t / TA; y = herm(W.y0, 0, SURF, VY * TA, s); vy = (herm(W.y0, 0, SURF, VY * TA, Math.min(1, s + 0.01)) - y) / (0.01 * TA); }
      else if (t < TA + TB) {
        const u = t - TA; y = SURF + VY * u - 0.5 * G * u * u; vy = VY - G * u;
        if (!W.exitDone) { W.exitDone = true; splashAt(x, z, 70, 0.8); U.uSplash.value.set(x, z, now, 0.5); }
      } else if (t < TA + TB + TC) {
        const s = (t - TA - TB) / TC; y = herm(SURF, -VY * TC, DEEP, 0, s); vy = (herm(SURF, -VY * TC, DEEP, 0, Math.min(1, s + 0.01)) - y) / (0.01 * TC);
        if (!W.entryDone) {
          W.entryDone = true; splashAt(x, z, 160, 1.3); U.uSplash.value.set(x, z, now, 1.0);
          for (let q = 0; q < 26; q++) particles.spawn(x + (Math.random() - 0.5) * 1.5, y - 0.5 - Math.random(), z + (Math.random() - 0.5) * 1.2, 0, 0.3, 0, 4, 0.05 + Math.random() * 0.07, 0xdff4ff, 0.5, P_BUBBLE);
        }
      } else { W.state = 0; W.next = 20 + Math.random() * 14; }
    }
    const hs = W.spdH;
    const tp = W.state === 1 ? Math.atan2(vy, hs) : Math.sin(now * 0.5) * 0.06;
    W.pitch = lerp(W.pitch, tp, Math.min(1, dt * 6));
    const inAir = W.state === 1 && W.tau > TA && W.tau < TA + TB;
    const troll = inAir ? Math.sin(Math.PI * (W.tau - TA) / TB) * 1.45 : 0;
    W.roll = lerp(W.roll, troll, Math.min(1, dt * 3));
    group.position.set(x, y, z);
    group.rotation.set(W.roll, Math.atan2(-fz, fx), W.pitch, 'YZX');
    tailPivot.rotation.z = Math.sin(now * (inAir ? 1.2 : 2.3)) * (inAir ? 0.12 : 0.26);
    W.x = x; W.z = z;
    if (Math.random() < dt * 0.6 && W.state === 0) particles.spawn(x + fx * 2, y + 0.6, z + fz * 2, 0, 0.4, 0, 5, 0.06, 0xdff4ff, 0.5, P_BUBBLE);
  }
  return { update, breach: () => { W.next = 0; }, W };
})();

// ------------------------------------------------------------------ fish
const fish = (() => {
  const species = [
    { n: 11, S: 0.06, body: 0x2c6fd6, belly: 0x5a9aee, fin: 0xf4d23a, stripe: 0x14306a, path: { cx: ISLAND.x, cy: -3.3, cz: ISLAND.z, A: 7.2, B: 4.2, w: 0.17, dy: 0.5 }, spread: 0.7 },
    { n: 8, S: 0.055, body: 0xf47a1f, belly: 0xff9a3f, fin: 0xf47a1f, stripe: 0xffffff, path: { cx: 5.8, cy: -8.1, cz: 0.7, A: 2.2, B: 1.4, w: 0.45, dy: 0.3 }, spread: 0.45 },
    { n: 18, S: 0.045, body: 0x4d6b8a, belly: 0xc9d6e2, fin: 0x8aa0b4, stripe: 0x2a3c50, path: { cx: ISLAND.x - 1.2, cy: -5.0, cz: ISLAND.z + 0.2, A: 10.2, B: 4.9, w: -0.13, dy: 0.8 }, spread: 0.8 },
  ];
  const schools = species.map((sp, si) => {
    const V = new Vox(sp.S);
    for (let i = -4; i <= 4; i++) for (let j = -2; j <= 2; j++) for (let k = -1; k <= 1; k++) {
      const ry = i > 2 ? 1.2 : i < -2 ? 1 : 2;
      if (Math.abs(j) > ry || (Math.abs(k) === 1 && Math.abs(j) === 2)) continue;
      let c = j < 0 ? sp.belly : sp.body;
      if ((i === 1 || i === -2) && si !== 2) c = sp.stripe;
      if (si === 2 && j === 0) c = 0xe8eef4;
      V.set(i, j, k, c);
    }
    for (let j = -2; j <= 2; j++) V.set(-5, j, 0, sp.fin);
    for (let j = -3; j <= 3; j += 6) V.set(-6, j > 0 ? 2 : -2, 0, sp.fin);
    V.set(-6, 2, 0, sp.fin); V.set(-6, -2, 0, sp.fin); V.set(-6, 3, 0, sp.fin); V.set(-6, -3, 0, sp.fin);
    V.set(0, 3, 0, sp.fin); V.set(-1, 3, 0, sp.fin);
    V.set(3, 1, 1, 0x0a0a0a); V.set(3, 1, -1, 0x0a0a0a);
    const m = new THREE.InstancedMesh(meshVox(V, 0.04), MAT.fish, sp.n);
    m.frustumCulled = false;
    interior.add(m);
    const r = mulberry32(200 + si);
    const members = Array.from({ length: sp.n }, () => ({ lag: r() * 2.2, ox: (r() - 0.5) * sp.spread, oy: (r() - 0.5) * sp.spread * 0.6, oz: (r() - 0.5) * sp.spread, ph: r() * TAU }));
    return { sp, m, members };
  });
  const pathAt = (P, t, out) => out.set(P.cx + P.A * Math.cos(t * P.w), P.cy + Math.sin(t * P.w * 2.3) * P.dy, P.cz + P.B * Math.sin(t * P.w));
  const a = new THREE.Vector3(), b = new THREE.Vector3(), e = new THREE.Euler();
  return function update(dt, now) {
    for (const sc of schools) {
      sc.members.forEach((f, idx) => {
        const t = now - f.lag;
        pathAt(sc.sp.path, t, a); pathAt(sc.sp.path, t + 0.05, b);
        const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
        const yaw = Math.atan2(-dz, dx);
        const wob = Math.sin(now * 1.3 + f.ph) * 0.12;
        const sx = -Math.sin(yaw), sz = -Math.cos(yaw);
        a.x += f.ox * sx * 1.4 + wob * sx; a.z += f.ox * sz * 1.4 + wob * sz; a.y += f.oy + Math.sin(now * 0.9 + f.ph) * 0.06;
        a.x += dx / 0.05 * f.oz * 0.25; a.z += dz / 0.05 * f.oz * 0.25;
        e.set(0, yaw + Math.sin(now * 3 + f.ph) * 0.08, Math.atan2(dy, Math.hypot(dx, dz)), 'YZX');
        _m4.compose(a, _q.setFromEuler(e), _s3.set(1, 1, 1));
        sc.m.setMatrixAt(idx, _m4);
      });
      sc.m.instanceMatrix.needsUpdate = true;
    }
  };
})();

// ----------------------------------------------------------------- crabs
const crabs = (() => {
  const S = 0.05, V = new Vox(S);
  for (let i = -3; i <= 3; i++) for (let k = -2; k <= 2; k++) for (let j = 0; j <= 1; j++) {
    if (Math.abs(i) === 3 && Math.abs(k) === 2) continue;
    V.set(i, j, k, j === 1 ? (hash3(i, j, k) < 0.3 ? 0xb8341c : 0xd9482b) : 0xe88a5a);
  }
  for (const s of [-1, 1]) {
    for (const i of [-2, 0, 2]) { V.set(i, 0, s * 3, 0xb83a22); V.set(i, 0, s * 4, 0xb83a22); V.set(i, -1, s * 5, 0xb83a22); V.set(i, -2, s * 5, 0xa8321c); }
    V.set(4, 1, s * 2, 0xe8643a); V.set(5, 1, s * 2, 0xe8643a); V.set(5, 1, s * 3, 0xe8643a); V.set(6, 2, s * 3, 0xf07a4a); V.set(6, 1, s * 3, 0xe8643a); V.set(6, 1, s * 2, 0xf07a4a);
    V.set(2, 2, s, 0xb83a22); V.set(2, 3, s, 0x111111);
  }
  const n = 4;
  const m = new THREE.InstancedMesh(meshVox(V, 0.05), MAT.voxV, n);
  m.castShadow = true; m.frustumCulled = false;
  interior.add(m);
  const beach = [];
  for (let a = 0; a < 180; a++) {
    const ang = a / 180 * TAU;
    let lo = 0, hi = 8;
    for (let q = 0; q < 24; q++) { const mid = (lo + hi) / 2; if (islandE(ISLAND.x + Math.cos(ang) * mid, ISLAND.z + Math.sin(ang) * mid) < 0.8) lo = mid; else hi = mid; }
    beach.push([ISLAND.x + Math.cos(ang) * lo, ISLAND.z + Math.sin(ang) * lo]);
  }
  const at = (u) => { const f = ((u % 1) + 1) % 1 * 180, i0 = Math.floor(f) % 180, i1 = (i0 + 1) % 180, t = f - Math.floor(f); return [lerp(beach[i0][0], beach[i1][0], t), lerp(beach[i0][1], beach[i1][1], t)]; };
  const cs = [0.1, 0.36, 0.55, 0.8].map((u, i) => ({ u, dir: i % 2 ? 1 : -1, walk: 0, timer: Math.random() * 3 }));
  const e = new THREE.Euler();
  return function update(dt, now) {
    cs.forEach((c, idx) => {
      c.timer -= dt;
      if (c.timer <= 0) { c.walk = c.walk ? 0 : 1; c.timer = c.walk ? 1 + Math.random() * 2.5 : 0.6 + Math.random() * 2; if (Math.random() < 0.35) c.dir *= -1; }
      c.u += c.dir * c.walk * dt * 0.012 * (1 + U.uStorm.value);
      const [x, z] = at(c.u), [x2, z2] = at(c.u + 0.004);
      const top = topAt(x, z) ?? WATER_Y + 0.1;
      const tx = x2 - x, tz = z2 - z;
      const yaw = Math.atan2(-tz, tx) + Math.PI / 2;              // face the sea, walk sideways
      e.set(0, yaw, 0, 'YZX');
      const bob = c.walk ? Math.abs(Math.sin(now * 16 + idx)) * 0.03 : 0;
      _m4.compose(_v3.set(x, top + 0.1 + bob, z), _q.setFromEuler(e), _s3.set(1, 1, 1));
      m.setMatrixAt(idx, _m4);
    });
    m.instanceMatrix.needsUpdate = true;
  };
})();

// ------------------------------------------------------ dinghy & buoy (floaters)
function floater(vox, x, z, opts = {}) {
  const mesh = makeInstanced(vox.toList([], { jitter: 0.06 }), MAT.vox, { name: opts.name || 'floater' });
  mesh.frustumCulled = false;
  const g = new THREE.Group(); g.add(mesh); interior.add(g);
  return { g, x, z, y: WATER_Y, vy: 0, p: 0, r: 0, yaw: opts.yaw || 0, L: opts.L || 0.7, B: opts.B || 0.35, sink: opts.sink || 0 };
}
function updateFloater(f, dt, now, yawWobble = 0) {
  const c = Math.cos(f.yaw), s = Math.sin(f.yaw);
  const hb = waveH(f.x + c * f.L, f.z - s * f.L), hs = waveH(f.x - c * f.L, f.z + s * f.L);
  const hp = waveH(f.x + s * f.B, f.z + c * f.B), hq = waveH(f.x - s * f.B, f.z - c * f.B);
  const ty = WATER_Y + (hb + hs + hp + hq) / 4 - f.sink;
  f.vy += ((ty - f.y) * 22 - f.vy * 5) * dt; f.y += f.vy * dt;
  f.p = lerp(f.p, Math.atan2(hb - hs, 2 * f.L), Math.min(1, dt * 6));
  f.r = lerp(f.r, -Math.atan2(hp - hq, 2 * f.B), Math.min(1, dt * 6));
  f.g.position.set(f.x, f.y, f.z);
  f.g.rotation.set(f.r, f.yaw + Math.sin(now * 0.4) * yawWobble, f.p, 'YZX');
}
const dinghy = (() => {
  const S = 0.11, V = new Vox(S);
  for (let i = -7; i <= 7; i++) {
    const w = i > 0 ? 3.2 * Math.sqrt(Math.max(0, 1 - (i / 7.6) ** 2)) : 3.2 - Math.max(0, -i - 4) * 0.25;
    const K = Math.round(w);
    for (let j = -2; j <= 1; j++) for (let k = -K; k <= K; k++) {
      const inner = Math.abs(k) < K && Math.abs(i) < 7 && j > -2;
      if (inner && j >= -1) { if (j === -1) V.set(i, j, k, 0x7a5838); continue; }
      V.set(i, j, k, j === 0 ? 0x2c5f9e : j === 1 ? 0x8a6a45 : 0xf2efe6);
    }
  }
  for (const i of [0, -4]) for (let k = -2; k <= 2; k++) V.set(i, 0, k, 0x9a7048);
  for (let t = -5; t <= 5; t++) { V.set(t, 0, 1, 0xc49a62); } V.set(5, 0, 0, 0xc49a62); V.set(6, 0, 0, 0xc49a62);
  const f = floater(V, DOCK.x1 - 1.0, DOCK.z + 0.95, { name: 'dinghy', L: 0.7, B: 0.3, sink: 0.08, yaw: 0.05 });
  const rope = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), MAT.lines);
  rope.frustumCulled = false; interior.add(rope);
  return { f, rope };
})();
const buoy = (() => {
  const S = 0.1, V = new Vox(S);
  for (let j = -4; j <= 4; j++) for (let i = -3; i <= 3; i++) for (let k = -3; k <= 3; k++) {
    const r = j < -2 ? 2.2 : 3.1;
    if (i * i + k * k > r * r) continue;
    V.set(i, j, k, j < -1 ? 0x2a2a2a : ((j + 10) >> 1) % 2 ? 0xf2f0ea : 0xc8262b);
  }
  for (const [i, k] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) for (let j = 5; j <= 8; j++) V.set(i, j, k, 0x2a2c30);
  for (let i = -2; i <= 2; i++) for (let k = -2; k <= 2; k++) if (Math.abs(i) === 2 || Math.abs(k) === 2) V.set(i, 9, k, 0x2a2c30);
  V.set(0, 9, 0, 0xff4030, 1.5); V.set(0, 10, 0, 0x2a2c30);
  const f = floater(V, -10.6, -1.2, { name: 'buoy', L: 0.3, B: 0.3, sink: 0.05 });
  const glow = makeGlow(0xff4a30, 1.6, 0.8, 1.0); interior.add(glow);
  return { f, glow };
})();

// ---------------------------------------------------------------- clouds
const cloudU = { uCloud: { value: Array.from({ length: 16 }, () => new THREE.Vector4(0, -50, 0, 0)) }, uCloudSelf: { value: 0.2 }, uCloudTint: { value: new THREE.Color(1, 1, 1) } };
const clouds = (() => {
  const list = [], defs = [];
  const r = mulberry32(333);
  const S = 0.34;
  const make = (stormy) => {
    const id = defs.length;
    const y = stormy ? lerp(6.3, 7.1, r()) : lerp(6.9, 7.9, r());
    const zl = Math.max(0.3, Math.sqrt(Math.max(0, GLASS_IN.R ** 2 - (y + 1.3) ** 2)) - (stormy ? 2.6 : 2.1));
    defs.push({ x: lerp(-15, 8, (id % 7) / 7 + r() * 0.1), y, z: lerp(-zl, zl, r()) * 0.9, spd: lerp(0.18, 0.32, r()), stormy, s: 1 });
    const blobs = [];
    const nb = stormy ? 6 : 4 + ((r() * 3) | 0);
    for (let b = 0; b < nb; b++) blobs.push([lerp(-1, 1, r()) * (stormy ? 2.6 : 1.7), r() * (stormy ? 0.3 : 0.5), lerp(-1, 1, r()) * (stormy ? 1.0 : 0.7), lerp(0.6, 1.05, r()) * (stormy ? 1.25 : 1)]);
    const V = new Vox(S);
    for (let i = -11; i <= 11; i++) for (let j = -2; j <= 5; j++) for (let k = -6; k <= 6; k++) {
      const x = i * S, yy = j * S, z = k * S;
      if (yy < -0.4) continue;
      if (!blobs.some(([bx, by, bz, br]) => (x - bx) ** 2 + ((yy - by) * 1.25) ** 2 + (z - bz) ** 2 < br * br)) continue;
      const c = stormy ? (yy < 0 ? 0x3a4250 : yy < 0.6 ? 0x4a5260 : 0x646c78) : (yy < 0 ? 0xcfd6e0 : hash3(i, j, k) < 0.5 ? 0xffffff : 0xf2f5f9);
      V.set(i, j, k, c);
    }
    for (const it of V.toList([], { jitter: 0.03 })) { it.cloud = id; list.push(it); }
  };
  for (let n = 0; n < 7; n++) make(false);
  for (let n = 0; n < 5; n++) make(true);
  const mat = patch(new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 }), {
    cloud: true, under: false, uniforms: cloudU, key: 'cloud',
    fHead: 'uniform float uCloudSelf;\nuniform vec3 uCloudTint;\n',
    fEmit: 'diffuseColor.rgb *= 1.0 - 0.5 * uStorm;\ntotalEmissiveRadiance += diffuseColor.rgb * (uCloudTint * uCloudSelf * 1.6 + uFlash * 0.9);\n',
  });
  const mesh = makeInstanced(list, mat, { name: 'clouds', depth: patch(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), { cloud: true, clip: false, depth: true, uniforms: cloudU }) });
  const aCloud = new Float32Array(Math.max(1, list.length));
  list.forEach((it, i) => { aCloud[i] = it.cloud; });
  mesh.geometry.setAttribute('aCloud', new THREE.InstancedBufferAttribute(aCloud, 1));
  mesh.frustumCulled = false;
  interior.add(mesh);
  return {
    defs,
    update(dt) {
      const st = U.uStorm.value;
      defs.forEach((d, i) => {
        d.x += d.spd * dt * (1 + 2.5 * st);
        if (d.x > 9.5) d.x = -16.5;
        const edge = smooth(-16.5, -13, d.x) * (1 - smooth(6.5, 9.5, d.x));
        const target = d.stormy ? smooth(0.15, 0.7, st) : 1 - 0.25 * st;
        d.s = lerp(d.s, target, Math.min(1, dt * 1.5));
        cloudU.uCloud.value[i].set(d.x, d.y, d.z, edge * d.s);
      });
    },
  };
})();

// ------------------------------------------------------------ sun & moon
const sky = (() => {
  const mkBall = (r, S, colFn, e) => { const V = new Vox(S); voxSphere(V, 0, 0, 0, r, colFn, e); const m = makeInstanced(V.toList([], { jitter: 0.04 }), MAT.vox, { cast: false, receive: false }); m.frustumCulled = false; interior.add(m); return m; };
  const sunM = mkBall(3.6, 0.14, (i, j, k) => (j > 1 ? 0xffe27a : j < -1 ? 0xff9a3a : 0xffc54a), 3.0);
  const moonM = mkBall(3.1, 0.13, (i, j, k) => (hash3(i, j, k) < 0.18 || (i - 1) ** 2 + (j - 1) ** 2 < 2 ? 0xa9b0bb : 0xe8ecf2), 1.5);
  const sunGlow = makeGlow(0xffb050, 6, 1, 0.9), moonGlow = makeGlow(0xaac4ff, 4, 0.6, 0.8);
  interior.add(sunGlow, moonGlow);
  const C = new THREE.Vector3(-3.2, WATER_Y - 0.5, -2.6);
  const posAt = (ang, out) => out.set(C.x + Math.cos(ang) * 13.8, C.y + Math.sin(ang) * 8.0, C.z - Math.sin(ang) * 1.2);
  return { sunM, moonM, sunGlow, moonGlow, posAt, sunPos: new THREE.Vector3(), moonPos: new THREE.Vector3() };
})();

// --------------------------------------------------------- lighthouse beams
const beams = (() => {
  const g = new THREE.Group(); g.position.copy(LAMP); interior.add(g);
  const len = 15;
  const geo = new THREE.CylinderGeometry(1.7, 0.14, len, 32, 1, true);
  geo.translate(0, len / 2, 0); geo.rotateZ(-Math.PI / 2);
  const u = { ...U, uBeamI: { value: 0.3 }, uLen: { value: len } };
  const mat = new THREE.ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: /* glsl */`
      uniform float uLen; varying float vAlong; varying vec3 vWPos; varying vec3 vN;
      void main(){ vAlong = position.x / uLen; vec4 wp = modelMatrix * vec4(position, 1.0); vWPos = wp.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: /* glsl */`
      ${GLSL_COMMON}
      uniform float uBeamI; varying float vAlong; varying vec3 vWPos; varying vec3 vN;
      void main(){
        if (!insideBottle(vWPos)) discard;
        float nv = abs(dot(normalize(vN), normalize(cameraPosition - vWPos)));
        float a = pow(clamp(1.0 - vAlong, 0.0, 1.0), 1.4) * pow(clamp(nv, 0.0, 1.0), 1.6) * uBeamI;
        a *= step(uWaterY + waveH(vWPos.xz), vWPos.y);
        gl_FragColor = vec4(vec3(1.0, 0.86, 0.55) * a, a);
      }`,
  });
  const b1 = new THREE.Mesh(geo, mat), b2 = new THREE.Mesh(geo, mat);
  b2.rotation.y = Math.PI;
  b1.renderOrder = b2.renderOrder = 5; b1.frustumCulled = b2.frustumCulled = false;
  g.add(b1, b2);
  const lampGlow = makeGlow(0xffd27a, 2.4, 1, 1); lampGlow.position.copy(LAMP); interior.add(lampGlow);
  const hit = (dir, out) => {        // where a horizontal beam meets the glass (rest frame)
    let t = 0.5;
    for (; t < 30; t += 0.25) { const x = LAMP.x + dir.x * t, z = LAMP.z + dir.z * t; if (!insideRest(x, LAMP.y, z, 0.05)) break; }
    return out.set(LAMP.x + dir.x * t, LAMP.y, LAMP.z + dir.z * t).applyMatrix4(rig.matrix);
  };
  const d = new THREE.Vector3();
  return {
    g, u, lampGlow,
    update(dt, intensity) {
      g.rotation.y += dt * 0.85;
      u.uBeamI.value = intensity;
      d.set(Math.cos(g.rotation.y), 0, -Math.sin(g.rotation.y));
      hit(d, glassU.uBeamHit0.value);
      hit(d.negate(), glassU.uBeamHit1.value);
    },
  };
})();

// ------------------------------------------------------------------ rain
const rain = (() => {
  const N = 1100, geo = new THREE.BoxGeometry(1, 1, 1);
  const m = new THREE.ShaderMaterial({
    uniforms: { ...U },
    transparent: true, depthWrite: false,
    vertexShader: /* glsl */`
      uniform float uTime; uniform float uStorm; uniform float uWaterY;
      varying vec3 vWPos; varying float vA;
      void main(){
        vec3 base = instanceMatrix[3].xyz;
        float fall = 13.0 + fract(base.x * 7.3) * 4.0;
        float span = 10.5;
        float y = mod(base.y - uTime * fall - uWaterY, span) + uWaterY;
        vec3 c = vec3(base.x + (y - uWaterY) * 0.28 * uStorm, y, base.z);
        vec3 p = c + position * vec3(0.022, 0.42, 0.022);
        p.x += position.y * 0.12;
        vWPos = p; vA = smoothstep(0.25, 0.8, uStorm);
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */`
      ${GLSL_COMMON}
      varying vec3 vWPos; varying float vA;
      void main(){
        if (vA < 0.01 || !insideBottle(vWPos) || vWPos.y < uWaterY + waveH(vWPos.xz)) discard;
        gl_FragColor = vec4(vec3(0.75, 0.82, 0.95), 0.32 * vA);
      }`,
  });
  const mesh = new THREE.InstancedMesh(geo, m, N);
  const r = mulberry32(9);
  for (let i = 0; i < N; i++) { _m4.makeTranslation(lerp(-18.5, 13, r()), lerp(-1, 9.5, r()), lerp(-8, 8, r())); mesh.setMatrixAt(i, _m4); }
  mesh.frustumCulled = false; mesh.renderOrder = 6; mesh.visible = false;
  interior.add(mesh);
  return mesh;
})();

// -------------------------------------------------------------- lightning
const lightning = (() => {
  const MAX = 90;
  const mat = patch(new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 3.6, 6.0) }), { under: false, key: 'bolt' });
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, MAX);
  mesh.count = 0; mesh.frustumCulled = false; interior.add(mesh);
  const L = { mesh, t: 9, next: 1.2, end: new THREE.Vector3() };
  const up = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3();
  const addSeg = (a, b, w) => {
    if (mesh.count >= MAX) return;
    dir.subVectors(b, a); const len = dir.length(); dir.divideScalar(len);
    _m4.compose(_v3.addVectors(a, b).multiplyScalar(0.5), _q.setFromUnitVectors(up, dir), _s3.set(w, len + w, w));
    mesh.setMatrixAt(mesh.count++, _m4);
  };
  const bolt = (from, to, n, w, jit) => {
    const pts = [from.clone()];
    for (let i = 1; i < n; i++) {
      const t = i / n;
      pts.push(from.clone().lerp(to, t).add(new THREE.Vector3((Math.random() - 0.5) * jit, (Math.random() - 0.5) * jit * 0.3, (Math.random() - 0.5) * jit * 0.7)));
    }
    pts.push(to.clone());
    for (let i = 0; i < pts.length - 1; i++) addSeg(pts[i], pts[i + 1], w);
    return pts;
  };
  L.strike = () => {
    const storm = clouds.defs.filter((d) => d.stormy && d.s > 0.4);
    const d = storm.length ? storm[(Math.random() * storm.length) | 0] : { x: -4, y: 6.5, z: 0 };
    const from = new THREE.Vector3(clamp(d.x + (Math.random() - 0.5) * 2, -14, 8), d.y - 0.2, d.z + (Math.random() - 0.5));
    let to;
    if (Math.random() < 0.3) to = LAMP.clone().add(new THREE.Vector3(0, 1.0, 0));
    else { const x = clamp(from.x + (Math.random() - 0.5) * 5, -15, 9), z = clamp(from.z + (Math.random() - 0.5) * 3, -5, 5); to = new THREE.Vector3(x, seaY(x, z), z); }
    mesh.count = 0;
    const pts = bolt(from, to, 12, 0.07, 0.9);
    for (let b = 0; b < 3; b++) {
      const s = pts[2 + ((Math.random() * (pts.length - 5)) | 0)];
      bolt(s, s.clone().add(new THREE.Vector3((Math.random() - 0.5) * 3, -1.2 - Math.random() * 2, (Math.random() - 0.5) * 1.5)), 5, 0.035, 0.5);
    }
    mesh.instanceMatrix.needsUpdate = true;
    L.t = 0; L.end.copy(to);
    if (to.y < WATER_Y + 1.5) for (let q = 0; q < 40; q++) { const a = Math.random() * TAU; particles.spawn(to.x, to.y + 0.05, to.z, Math.cos(a) * 1.5, 2 + Math.random() * 2.5, Math.sin(a) * 1.5, 0.9, 0.06, 0xe8f2ff, 0.8, P_DROP); }
  };
  L.update = (dt) => {
    const st = U.uStorm.value;
    L.next -= dt;
    if (st > 0.4 && L.next <= 0) { L.strike(); L.next = (0.8 + Math.random() * 2.6) / Math.max(0.5, st); }
    L.t += dt;
    const t = L.t;
    let f = 0;
    if (t < 0.07) f = 1; else if (t < 0.11) f = 0.15; else if (t < 0.17) f = 0.85; else if (t < 0.21) f = 0.1; else if (t < 0.26) f = 0.6; else f = Math.max(0, 0.6 - (t - 0.26) * 3) * 0.3;
    U.uFlash.value = f;
    mesh.visible = f > 0.25;
  };
  return L;
})();

// ---------------------------------------------------- ambient emitters
const emit = { smoke: 0, bubble: 0, spark: 0 };
const _w = new THREE.Vector3();
function updateEmitters(dt, now) {
  emit.smoke -= dt;
  if (emit.smoke <= 0) {
    emit.smoke = 0.28;
    particles.spawn(SMOKE_SRC.x + (Math.random() - 0.5) * 0.1, SMOKE_SRC.y, SMOKE_SRC.z + (Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.08, 0.55 + Math.random() * 0.2, (Math.random() - 0.5) * 0.08, 3.6, 0.09, Math.random() < 0.5 ? 0xa39e98 : 0x8d8882, 0.0, P_SMOKE);
  }
  emit.bubble -= dt;
  if (emit.bubble <= 0) {
    emit.bubble = 0.18;
    const s = BUBBLE_SRC[(Math.random() * BUBBLE_SRC.length) | 0];
    _w.copy(s).applyMatrix4(rig.matrix);
    particles.spawn(_w.x + (Math.random() - 0.5) * 0.2, _w.y, _w.z + (Math.random() - 0.5) * 0.2, 0, 0.2, 0, 8, 0.04 + Math.random() * 0.06, 0xd8f2ff, 0.45, P_BUBBLE);
  }
  emit.spark -= dt;
  if (emit.spark <= 0) {
    emit.spark = 0.35;
    _w.copy(CHEST_POS).applyMatrix4(rig.matrix);
    particles.spawn(_w.x + (Math.random() - 0.5) * 1.1, _w.y - 0.4 + Math.random() * 0.5, _w.z + (Math.random() - 0.5) * 0.9, 0, 0.15, 0, 1.4, 0.06, 0xffe07a, 3.0, P_SPARK);
  }
}
