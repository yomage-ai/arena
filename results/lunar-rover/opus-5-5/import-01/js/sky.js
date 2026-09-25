// Space backdrop: star field, Milky Way, Sun, procedural Earth, and the
// reflection environment (black sky over sunlit regolith) used by the rover.
import * as THREE from 'three';
import { mulberry32 } from './noise.js';

const NOISE_GLSL = /* glsl */ `
float h31(vec3 p){ p = fract(p * 0.3183099 + vec3(.11,.17,.13)); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vn3(vec3 x){ vec3 i = floor(x); vec3 f = fract(x); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(h31(i),h31(i+vec3(1,0,0)),f.x), mix(h31(i+vec3(0,1,0)),h31(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(h31(i+vec3(0,0,1)),h31(i+vec3(1,0,1)),f.x), mix(h31(i+vec3(0,1,1)),h31(i+vec3(1,1,1)),f.x),f.y), f.z); }
float fbm3(vec3 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 6; i++){ s += a * vn3(p); p = p * 2.03 + 11.7; a *= 0.5; } return s; }
`;

const GAL_N = new THREE.Vector3(0.35, 0.62, -0.7).normalize(); // galactic pole
const GAL_C = new THREE.Vector3(0.8, -0.1, 0.3).projectOnPlane(GAL_N).normalize(); // galactic centre

export class Sky {
  constructor() {
    this.group = new THREE.Group();
    this.group.renderOrder = -10;
    this.sunDir = new THREE.Vector3(0, 1, 0);
    this.earthDir = new THREE.Vector3(0, 1, 0);
    this._buildStars();
    this._buildMilkyWay();
    this._buildSun();
    this._buildEarth();
  }

  _buildStars() {
    const n = 9000, R = 9000;
    const rnd = mulberry32(42);
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n);
    const v = new THREE.Vector3();
    const u = new THREE.Vector3().crossVectors(GAL_N, new THREE.Vector3(0, 1, 0)).normalize();
    const w = new THREE.Vector3().crossVectors(GAL_N, u);
    const temps = [[0.66, 0.78, 1.0], [0.85, 0.9, 1.0], [1.0, 1.0, 1.0], [1.0, 0.93, 0.8], [1.0, 0.8, 0.6], [1.0, 0.66, 0.46]];
    for (let i = 0; i < n; i++) {
      if (rnd() < 0.45) {
        const a = rnd() * Math.PI * 2;
        const b = (rnd() + rnd() + rnd() - 1.5) * 0.22;
        v.copy(u).multiplyScalar(Math.cos(a) * Math.cos(b)).addScaledVector(w, Math.sin(a) * Math.cos(b)).addScaledVector(GAL_N, Math.sin(b));
      } else {
        const z = rnd() * 2 - 1, a = rnd() * Math.PI * 2, rr = Math.sqrt(1 - z * z);
        v.set(rr * Math.cos(a), z, rr * Math.sin(a));
      }
      v.normalize().multiplyScalar(R);
      pos.set([v.x, v.y, v.z], i * 3);
      const m = Math.pow(rnd(), 7);
      const b = 0.25 + m * 26;
      const t = temps[Math.min(temps.length - 1, Math.floor(Math.pow(rnd(), 0.8) * temps.length))];
      col.set([t[0] * b, t[1] * b, t[2] * b], i * 3);
      size[i] = 1.1 + m * 3.2 + rnd() * 0.5;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    this.starMat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 1 }, uFade: { value: 1 } },
      vertexShader: /* glsl */ `
        attribute vec3 aColor; attribute float aSize; uniform float uScale;
        varying vec3 vC;
        void main(){ vC = aColor; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv; gl_PointSize = aSize * uScale; }`,
      fragmentShader: /* glsl */ `
        varying vec3 vC; uniform float uFade;
        void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d) * 2.0;
          float a = exp(-r * r * 4.5); if (a < 0.01) discard;
          gl_FragColor = vec4(vC * a * uFade, 1.0);
          #include <colorspace_fragment>
        }`,
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
    });
    this.stars = new THREE.Points(g, this.starMat);
    this.stars.frustumCulled = false;
    this.stars.renderOrder = -10;
    this.group.add(this.stars);
  }

  _buildMilkyWay() {
    this.mwMat = new THREE.ShaderMaterial({
      uniforms: { uN: { value: GAL_N }, uC: { value: GAL_C }, uFade: { value: 1 } },
      vertexShader: /* glsl */ `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: NOISE_GLSL + /* glsl */ `
        uniform vec3 uN; uniform vec3 uC; uniform float uFade; varying vec3 vD;
        void main(){
          vec3 d = normalize(vD);
          float lat = asin(clamp(dot(d, uN), -1.0, 1.0));
          float core = pow(max(dot(normalize(d - uN * dot(d, uN)), uC), 0.0), 3.0);
          float width = 0.16 + core * 0.18;
          float band = exp(-pow(lat / width, 2.0));
          float cl = fbm3(d * 5.0);
          float lanes = smoothstep(0.42, 0.7, fbm3(d * 11.0 + 3.0)) * exp(-pow(lat / 0.05, 2.0));
          float I = band * (0.35 + cl * 0.9) * (0.5 + core * 1.6) * (1.0 - lanes * 0.85);
          vec3 c = mix(vec3(0.55, 0.62, 0.8), vec3(1.0, 0.86, 0.68), core) * I * 0.03;
          gl_FragColor = vec4(c * uFade, 1.0);
          #include <colorspace_fragment>
        }`,
      side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending, transparent: true,
    });
    const m = new THREE.Mesh(new THREE.SphereGeometry(9500, 64, 32), this.mwMat);
    m.frustumCulled = false;
    m.renderOrder = -11;
    this.group.add(m);
  }

  _buildSun() {
    const mat = new THREE.ShaderMaterial({
      uniforms: { uI: { value: 60 } },
      vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: /* glsl */ `
        varying vec2 vUv; uniform float uI;
        void main(){
          float r = length(vUv - 0.5) * 2.0;
          float rd = 0.062;
          float x = clamp(r / rd, 0.0, 1.0);
          float limb = 1.0 - 0.55 * (1.0 - sqrt(max(0.0, 1.0 - x * x)));
          float disk = smoothstep(rd, rd * 0.94, r) * limb;
          float corona = exp(-(r - rd) * 26.0) * 0.12 * step(rd * 0.9, r) + exp(-r * 7.0) * 0.015;
          vec3 c = vec3(1.0, 0.97, 0.92) * (disk * uI + corona * uI * 0.25);
          if (max(c.r, max(c.g, c.b)) < 0.0005) discard;
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
    });
    this.sun = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), mat);
    this.sun.renderOrder = -9;
    this.sun.frustumCulled = false;
    this.group.add(this.sun);
  }

  _buildEarth() {
    const R = 8000 * Math.tan(THREE.MathUtils.degToRad(0.95));
    this.earthMat = new THREE.ShaderMaterial({
      uniforms: { uSun: { value: this.sunDir }, uT: { value: 0 }, uE: { value: 6 } },
      vertexShader: /* glsl */ `
        varying vec3 vN; varying vec3 vW;
        void main(){ vN = normalize(mat3(modelMatrix) * normal); vW = (modelMatrix * vec4(position,1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vW,1.0); }`,
      fragmentShader: NOISE_GLSL + /* glsl */ `
        uniform vec3 uSun; uniform float uT; uniform float uE;
        varying vec3 vN; varying vec3 vW;
        void main(){
          vec3 N = normalize(vN);
          vec3 V = normalize(cameraPosition - vW);
          vec3 L = normalize(uSun);
          float ca = cos(uT), sa = sin(uT);
          vec3 p = vec3(ca * N.x - sa * N.z, N.y, sa * N.x + ca * N.z);
          float lat = abs(p.y);
          float land = fbm3(p * 2.1 + 4.0) + 0.12 * fbm3(p * 9.0);
          float isLand = smoothstep(0.54, 0.56, land);
          float dry = fbm3(p * 3.3 + 9.0);
          vec3 landC = mix(vec3(0.05, 0.11, 0.035), vec3(0.34, 0.26, 0.15), smoothstep(0.35, 0.65, dry + (0.3 - abs(lat - 0.35)) * 0.4));
          landC = mix(landC, vec3(0.52, 0.42, 0.28), smoothstep(0.6, 0.75, dry) * (1.0 - smoothstep(0.35, 0.6, lat)));
          vec3 ocean = mix(vec3(0.004, 0.02, 0.07), vec3(0.01, 0.05, 0.12), smoothstep(0.4, 0.55, land));
          vec3 alb = mix(ocean, landC, isLand);
          float ice = smoothstep(0.8, 0.86, lat + (land - 0.5) * 0.15);
          alb = mix(alb, vec3(0.8), ice);
          vec3 q = p * 3.0 + vec3(uT * 0.7, 0.0, 0.0);
          q.xz += 0.35 * vec2(sin(q.y * 3.0 + uT), cos(q.y * 2.5));
          float cl = smoothstep(0.48, 0.72, fbm3(q) + 0.15 * fbm3(p * 14.0));
          cl *= 0.85 + 0.25 * smoothstep(0.1, 0.4, lat);
          alb = mix(alb, vec3(0.85), cl);
          float mu0 = dot(N, L);
          float diff = max(mu0, 0.0);
          vec3 col = alb * diff * uE / 3.14159;
          vec3 Hh = normalize(L + V);
          float spec = pow(max(dot(N, Hh), 0.0), 90.0) * (1.0 - isLand) * (1.0 - cl) * (1.0 - ice);
          col += vec3(1.0, 0.95, 0.85) * spec * 0.35 * uE * step(0.0, mu0);
          float fr = pow(1.0 - max(dot(N, V), 0.0), 2.5);
          col += vec3(0.25, 0.5, 1.0) * fr * smoothstep(-0.15, 0.35, mu0) * 0.5 * uE / 3.14159;
          col *= smoothstep(-0.05, 0.08, mu0) * 0.97 + 0.03 * step(0.0, mu0);
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      depthWrite: false,
    });
    this.earth = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 64), this.earthMat);
    this.earth.renderOrder = -8;
    this.earth.frustumCulled = false;
    const haloMat = new THREE.ShaderMaterial({
      uniforms: { uSun: { value: this.sunDir }, uE: { value: 6 } },
      vertexShader: /* glsl */ `varying vec3 vN; varying vec3 vW;
        void main(){ vN = normalize(mat3(modelMatrix) * normal); vW = (modelMatrix * vec4(position,1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vW,1.0); }`,
      fragmentShader: /* glsl */ `uniform vec3 uSun; uniform float uE; varying vec3 vN; varying vec3 vW;
        void main(){ vec3 N = normalize(vN); vec3 V = normalize(cameraPosition - vW);
          float rim = pow(1.0 - abs(dot(N, V)), 6.0);
          float lit = smoothstep(-0.25, 0.4, dot(N, normalize(uSun)));
          gl_FragColor = vec4(vec3(0.3, 0.55, 1.0) * rim * lit * uE * 0.06, 1.0);
          #include <colorspace_fragment>
        }`,
      side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
    });
    this.halo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.035, 64, 32), haloMat);
    this.halo.renderOrder = -8;
    this.halo.frustumCulled = false;
    this.haloMat = haloMat;
    this.group.add(this.earth, this.halo);
  }

  setSun(dir, intensity) {
    this.sunDir.copy(dir).normalize();
    this.sun.position.copy(this.sunDir).multiplyScalar(8000);
    this.earthMat.uniforms.uE.value = intensity;
    this.haloMat.uniforms.uE.value = intensity;
  }

  setEarth(dir) {
    this.earthDir.copy(dir).normalize();
    this.earth.position.copy(this.earthDir).multiplyScalar(8000);
    this.halo.position.copy(this.earth.position);
  }

  update(camera, t, pixelRatio) {
    this.group.position.copy(camera.position);
    this.sun.quaternion.copy(camera.quaternion);
    this.earthMat.uniforms.uT.value = t * 0.004;
    this.starMat.uniforms.uScale.value = pixelRatio;
  }

  setStars(on) {
    this.stars.visible = on;
    this.mwMat.uniforms.uFade.value = on ? 1 : 0;
  }
}

// PMREM environment: black sky above a sunlit regolith plain (no sun disc —
// the directional light already supplies the specular highlight).
export function makeEnvironment(renderer, sunDir, E) {
  const scene = new THREE.Scene();
  const mat = new THREE.ShaderMaterial({
    uniforms: { uL: { value: sunDir.clone().normalize() }, uE: { value: E } },
    vertexShader: /* glsl */ `varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `uniform vec3 uL; uniform float uE; varying vec3 vD;
      void main(){
        vec3 d = normalize(vD);
        vec3 c = vec3(0.0);
        if (d.y < 0.0) {
          float mu0 = max(uL.y, 0.0);
          float mu = max(-d.y, 0.02);
          float ls = 2.0 * mu0 / (mu0 + mu);
          float g = acos(clamp(dot(uL, -d), -1.0, 1.0));
          float opp = 1.0 + 0.5 * exp(-g / 0.07);
          float ph = mix(1.0, 0.55, smoothstep(0.4, 2.6, g));
          float f = mix(mu0, ls * ph, 0.65) * opp;
          c = vec3(1.0, 0.975, 0.94) * 0.13 / 3.14159 * uE * f;
          c *= smoothstep(0.0, -0.03, d.y);
        }
        gl_FragColor = vec4(c, 1.0);
      }`,
    side: THREE.BackSide,
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(50, 64, 32), mat));
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(scene, 0, 0.1, 200);
  pmrem.dispose();
  mat.dispose();
  return rt;
}
