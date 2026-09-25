// Rover kinematics: rocker-bogie suspension solved against the terrain each frame,
// Ackermann corner steering, wheel spin, differential linkage, mast/HGA/solar wing pointing.
import * as THREE from 'three';
import { buildRover, K } from './rover-model.js';

const ease = (dt, tau) => 1 - Math.exp(-dt / Math.max(1e-4, tau));
const Y = new THREE.Vector3(0, 1, 0);

export class Rover {
  constructor() {
    this.J = buildRover();
    this.root = this.J.root;
    this.s = { pitch: 0, roll: 0, y: 0, dx: 0, rel: [0, 0], bog: [0, 0], steerF: 0, steerR: 0, pan: 0, tilt: -0.2, az: 0, el: 0.4, wing: [0, 0], init: false };
    this.wheelSpin = 0;
    this.contacts = this.J.wheels.map(() => new THREE.Vector3());
    this.pitchDeg = 0;
    this.rollDeg = 0;
    this._q = new THREE.Quaternion();
    this._v = new THREE.Vector3();
    this._a = new THREE.Vector3();
    this._b = new THREE.Vector3();
  }

  // ps: path sample {x, z, heading, curvature}; ds: metres travelled this frame
  update(dt, ps, ds, heightAt, sunDir, earthDir, t, imaging) {
    const J = this.J, s = this.s;
    const ch = Math.cos(ps.heading), sh = Math.sin(ps.heading);
    const ground = (lx, lz) => heightAt(ps.x + lx * ch + lz * sh, ps.z - lx * sh + lz * ch);
    const foot = (lx, lz) => Math.max(ground(lx - 0.07, lz), ground(lx, lz), ground(lx + 0.07, lz), ground(lx, lz - 0.05), ground(lx, lz + 0.05));
    const r = K.r - 0.012; // wheels sink slightly into the regolith

    const FWl = { x: K.front.x, y: K.front.mountY - K.fork };
    const BPl = { x: K.bogie.x, y: K.bogie.y };
    const bogH = -(K.mid.mountY - K.fork); // pivot height above its wheel centres
    const a0 = Math.atan2(FWl.y - BPl.y, FWl.x - BPl.x);
    const xM = K.bogie.x + K.mid.x, xR = K.bogie.x + K.rear.x;

    const side = [];
    for (let si = 0; si < 2; si++) {
      const zw = (si === 0 ? -1 : 1) * K.zWheel;
      const F = { x: FWl.x, y: foot(FWl.x, zw) + r };
      const Mw = { x: xM, y: foot(xM, zw) + r };
      const R = { x: xR, y: foot(xR, zw) + r };
      const tb = Math.atan2(Mw.y - R.y, Mw.x - R.x);
      const BP = { x: (Mw.x + R.x) / 2 - bogH * Math.sin(tb), y: (Mw.y + R.y) / 2 + bogH * Math.cos(tb) };
      const tr = Math.atan2(F.y - BP.y, F.x - BP.x) - a0;
      const c = Math.cos(tr), sn = Math.sin(tr);
      const P = { x: BP.x - (BPl.x * c - BPl.y * sn), y: BP.y - (BPl.x * sn + BPl.y * c) };
      side.push({ tb, tr, P });
    }
    const pitch = (side[0].tr + side[1].tr) / 2;
    const roll = Math.atan2(side[0].P.y - side[1].P.y, 2 * K.zRock);
    const y0 = (side[0].P.y + side[1].P.y) / 2;
    const dx = (side[0].P.x + side[1].P.x) / 2;

    const k = s.init ? ease(dt, 0.09) : 1;
    s.pitch += (pitch - s.pitch) * k;
    s.roll += (roll - s.roll) * k;
    s.y += (y0 - s.y) * k;
    s.dx += (dx - s.dx) * k;
    for (let si = 0; si < 2; si++) {
      s.rel[si] += (side[si].tr - pitch - s.rel[si]) * k;
      s.bog[si] += (side[si].tb - side[si].tr - s.bog[si]) * k;
    }

    const root = this.root;
    root.position.set(ps.x + s.dx * ch, s.y, ps.z - s.dx * sh);
    root.rotation.set(s.roll, ps.heading, s.pitch, 'YZX');
    this.pitchDeg = THREE.MathUtils.radToDeg(s.pitch);
    this.rollDeg = THREE.MathUtils.radToDeg(s.roll);

    for (let si = 0; si < 2; si++) {
      J.rockers[si].rotation.z = s.rel[si];
      J.bogies[si].rotation.z = s.bog[si];
    }

    // differential bar + links (rockers counter-rotate relative to the body)
    const phi = Math.asin(THREE.MathUtils.clamp((K.diff.crank * Math.sin(s.rel[0])) / K.diff.half, -1, 1));
    J.diff.rotation.y = phi;
    for (let si = 0; si < 2; si++) {
      const zs = si === 0 ? -1 : 1;
      const zb = zs * K.diff.half;
      const bottom = this._a.set(-K.diff.crank * Math.sin(s.rel[si]), K.diff.crank * Math.cos(s.rel[si]), zb);
      const top = this._b.set(zb * Math.sin(phi), K.diff.y, zb * Math.cos(phi));
      const d = this._v.copy(top).sub(bottom);
      const len = d.length();
      const link = J.links[si];
      link.position.copy(bottom);
      link.quaternion.setFromUnitVectors(Y, d.normalize());
      link.scale.set(1, len, 1);
    }

    // Ackermann steering of the four corner wheels
    if (s.kap === undefined) s.kap = ps.curvature;
    s.kap += (ps.curvature - s.kap) * ease(dt, 0.4);
    const kap = s.kap;
    for (const tag of ['L', 'R']) {
      const z = (tag === 'L' ? -1 : 1) * K.zWheel;
      J.steer['F' + tag].rotation.y = Math.atan((K.front.x * kap) / (1 + z * kap));
      J.steer['R' + tag].rotation.y = Math.atan((xR * kap) / (1 + z * kap));
    }

    // wheel spin: each wheel rolls its own arc length
    const rEff = K.r + 0.006;
    J.wheels.forEach((w) => {
      const f = Math.hypot(w.x * kap, 1 + w.z * kap);
      w.obj.rotation.z -= (ds * f) / rEff;
    });

    // pointing: HGA tracks Earth, wings track the Sun, mast surveys
    root.updateMatrixWorld(true);
    this._q.copy(root.quaternion).invert();
    const e = this._v.copy(earthDir).applyQuaternion(this._q);
    const az = Math.atan2(-e.z, e.x), el = Math.atan2(e.y, Math.hypot(e.x, e.z));
    const kg = ease(dt, 1.2);
    let dAz = az - s.az;
    while (dAz > Math.PI) dAz -= Math.PI * 2;
    while (dAz < -Math.PI) dAz += Math.PI * 2;
    s.az += dAz * kg;
    s.el += (el - s.el) * kg;
    J.hgaAz.rotation.y = s.az;
    J.hgaEl.rotation.z = s.el;

    const sl = this._a.copy(sunDir).applyQuaternion(this._q);
    const kw = ease(dt, 2.5);
    const wl = THREE.MathUtils.clamp(Math.atan2(sl.z, sl.y), -0.08, 0.95);
    const wr = THREE.MathUtils.clamp(Math.atan2(-sl.z, sl.y), -0.08, 0.95);
    s.wing[0] += (wl - s.wing[0]) * kw;
    s.wing[1] += (wr - s.wing[1]) * kw;
    J.wings[0].rotation.x = s.wing[0];
    J.wings[1].rotation.x = -s.wing[1];

    const pan = imaging ? Math.sin(t * 0.22) * 1.5 : Math.sin(t * 0.11) * 0.35 + Math.sin(t * 0.29) * 0.12;
    const tilt = imaging ? -0.18 + Math.sin(t * 0.37) * 0.12 : -0.28 + Math.sin(t * 0.17) * 0.06;
    const km = ease(dt, imaging ? 0.8 : 1.5);
    s.pan += (pan - s.pan) * km;
    s.tilt += (tilt - s.tilt) * km;
    J.mastPan.rotation.y = s.pan;
    J.mastTilt.rotation.z = s.tilt;

    s.init = true;

    // wheel contact points (world) for tracks & dust
    J.wheels.forEach((w, i) => {
      w.obj.getWorldPosition(this.contacts[i]);
      this.contacts[i].y -= K.r - 0.01;
    });
  }
}
