// Wheel tracks pressed into the regolith, and ballistic dust kicked up by the wheels.
import * as THREE from 'three';

const trackVS = /* glsl */ `
attribute vec3 aT;
varying vec2 vUv; varying vec3 vN; varying vec3 vT; varying vec3 vW;
void main(){
  vUv = uv; vN = normal; vT = aT;
  vW = position;
  gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
}`;

const trackFS = /* glsl */ `
uniform vec3 uSunDir; uniform float uWidth;
varying vec2 vUv; varying vec3 vN; varying vec3 vT; varying vec3 vW;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
// imprint height (metres) at across-track coordinate a (m) and along-track s (m)
float trackH(float a, float s){
  float w = uWidth;
  float per = 0.0487;
  float ph = fract(s / per + 0.08 * sin(s * 3.1));
  float cleat = -0.007 * smoothstep(0.0, 0.18, ph) * smoothstep(0.42, 0.24, ph);
  float inside = smoothstep(0.0, 0.02, a) * smoothstep(w, w - 0.02, a);
  float berm = 0.009 * (exp(-pow((a + 0.008) / 0.016, 2.0)) + exp(-pow((a - w - 0.008) / 0.016, 2.0)));
  float lump = (hash(floor(vec2(a * 60.0, s * 60.0))) - 0.5) * 0.0015;
  return -0.006 * inside + cleat * inside + berm + lump;
}
void main(){
  float a = vUv.x * (uWidth + 0.06) - 0.03;
  float s = vUv.y;
  float e = 0.002;
  float h0 = trackH(a, s);
  float da = (trackH(a + e, s) - h0) / e;
  float ds = (trackH(a, s + e) - h0) / e;
  vec3 N = normalize(vN);
  vec3 T = normalize(vT - N * dot(vT, N));
  vec3 B = normalize(cross(T, N));
  vec3 n = normalize(N - T * ds - B * da);
  vec3 L = normalize(uSunDir);
  float base = max(dot(N, L), 0.03);
  float rel = max(dot(n, L), 0.0) / base;
  float edge = smoothstep(0.0, 0.1, vUv.x) * smoothstep(1.0, 0.9, vUv.x);
  float f = mix(1.0, clamp(rel, 0.0, 2.4) * 0.88, edge);
  gl_FragColor = vec4(vec3(f), 1.0);
}`;

class Ribbon {
  constructor(max, material) {
    this.max = max;
    this.n = 0;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 6);
    this.nrm = new Float32Array(max * 6);
    this.tan = new Float32Array(max * 6);
    this.uv = new Float32Array(max * 4);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('normal', new THREE.BufferAttribute(this.nrm, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aT', new THREE.BufferAttribute(this.tan, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('uv', new THREE.BufferAttribute(this.uv, 2).setUsage(THREE.DynamicDrawUsage));
    const idx = new Uint32Array((max - 1) * 6);
    for (let i = 0; i < max - 1; i++) {
      const a = i * 2;
      idx.set([a, a + 1, a + 2, a + 1, a + 3, a + 2], i * 6);
    }
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.setDrawRange(0, 0);
    this.geo = g;
    this.mesh = new THREE.Mesh(g, material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    this.last = null;
    this.dist = 0;
  }

  push(p, fwd, heightAt, normalAt, halfW) {
    if (this.last) {
      const d = Math.hypot(p.x - this.last.x, p.z - this.last.z);
      if (d < 0.035) return;
      if (d > 1.5) this.n = 0; // teleport / loop reset
      else this.dist += d;
    }
    if (this.n >= this.max) { this.n = 0; }
    const i = this.n;
    const rx = fwd.z, rz = -fwd.x; // left-pointing lateral in XZ
    const nv = normalAt(p.x, p.z);
    for (let k = 0; k < 2; k++) {
      const sgn = k === 0 ? 1 : -1;
      const x = p.x + rx * halfW * sgn, z = p.z + rz * halfW * sgn;
      const o = (i * 2 + k) * 3;
      this.pos[o] = x; this.pos[o + 1] = heightAt(x, z) + 0.008; this.pos[o + 2] = z;
      this.nrm[o] = nv.x; this.nrm[o + 1] = nv.y; this.nrm[o + 2] = nv.z;
      this.tan[o] = fwd.x; this.tan[o + 1] = 0; this.tan[o + 2] = fwd.z;
      this.uv[(i * 2 + k) * 2] = k; this.uv[(i * 2 + k) * 2 + 1] = this.dist;
    }
    this.n++;
    this.last = { x: p.x, z: p.z };
    const g = this.geo;
    for (const name of ['position', 'normal', 'aT']) {
      const at = g.attributes[name];
      at.clearUpdateRanges?.();
      at.addUpdateRange ? at.addUpdateRange(i * 6, 6) : (at.updateRange = { offset: i * 6, count: 6 });
      at.needsUpdate = true;
    }
    const uvA = g.attributes.uv;
    uvA.clearUpdateRanges?.();
    uvA.addUpdateRange ? uvA.addUpdateRange(i * 4, 4) : (uvA.updateRange = { offset: i * 4, count: 4 });
    uvA.needsUpdate = true;
    g.setDrawRange(0, Math.max(0, (this.n - 1) * 6));
  }

  clear() { this.n = 0; this.last = null; this.geo.setDrawRange(0, 0); }
}

export class Tracks {
  constructor(max = 36000) {
    this.width = 0.16;
    this.material = new THREE.ShaderMaterial({
      uniforms: { uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uWidth: { value: this.width } },
      vertexShader: trackVS,
      fragmentShader: trackFS,
      transparent: true,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.ZeroFactor,
      blendDst: THREE.SrcColorFactor,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -4,
    });
    this.ribbons = [new Ribbon(max, this.material), new Ribbon(max, this.material)];
    this.group = new THREE.Group();
    this.ribbons.forEach((r) => this.group.add(r.mesh));
  }
  push(side, p, fwd, heightAt, normalAt) {
    this.ribbons[side].push(p, fwd, heightAt, normalAt, (this.width + 0.06) / 2);
  }
  clear() { this.ribbons.forEach((r) => r.clear()); }
}

export class Dust {
  constructor(max = 2400) {
    this.max = max;
    this.p = new Float32Array(max * 3);
    this.v = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.size = new Float32Array(max);
    this.head = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.p, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aLife', new THREE.BufferAttribute(this.life, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    this.geo = g;
    this.material = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(0.2, 0.19, 0.18) }, uScale: { value: 600 } },
      vertexShader: /* glsl */ `
        attribute float aLife; attribute float aSize; uniform float uScale; varying float vA;
        void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
          vA = aLife > 0.0 ? 1.0 : 0.0;
          gl_PointSize = aLife > 0.0 ? clamp(aSize * uScale / -mv.z, 1.0, 12.0) : 0.0; }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; varying float vA;
        void main(){ if (vA <= 0.0) discard; float r = length(gl_PointCoord - 0.5) * 2.0; float a = smoothstep(1.0, 0.3, r);
          gl_FragColor = vec4(uColor, a * 0.85); }`,
      transparent: true, depthWrite: false,
    });
    this.points = new THREE.Points(g, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 3;
    this.enabled = true;
  }

  emit(pos, fwd, speed, count) {
    if (!this.enabled) return;
    for (let k = 0; k < count; k++) {
      const i = this.head;
      this.head = (this.head + 1) % this.max;
      const back = -(0.08 + Math.random() * 0.35) * (0.5 + speed * 2);
      const up = 0.15 + Math.random() * 0.55 * (0.4 + speed * 2.5);
      const lat = (Math.random() - 0.5) * 0.25;
      this.p[i * 3] = pos.x + (Math.random() - 0.5) * 0.1 - fwd.x * 0.08;
      this.p[i * 3 + 1] = pos.y + 0.01;
      this.p[i * 3 + 2] = pos.z + (Math.random() - 0.5) * 0.1 - fwd.z * 0.08;
      this.v[i * 3] = fwd.x * back + fwd.z * lat;
      this.v[i * 3 + 1] = up;
      this.v[i * 3 + 2] = fwd.z * back - fwd.x * lat;
      this.life[i] = 1;
      this.size[i] = 0.004 + Math.random() * 0.01;
    }
    this.geo.attributes.aSize.needsUpdate = true;
  }

  update(dt, heightAt) {
    const g = 1.62;
    let alive = 0;
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      alive++;
      this.v[i * 3 + 1] -= g * dt;
      this.p[i * 3] += this.v[i * 3] * dt;
      this.p[i * 3 + 1] += this.v[i * 3 + 1] * dt;
      this.p[i * 3 + 2] += this.v[i * 3 + 2] * dt;
      if (this.v[i * 3 + 1] < 0 && this.p[i * 3 + 1] < heightAt(this.p[i * 3], this.p[i * 3 + 2])) this.life[i] = 0;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aLife.needsUpdate = true;
    return alive;
  }
}
