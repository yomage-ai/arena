// Lunar terrain: non-uniform heightfield grid (0.5 m near the rover, ~1° angular
// resolution out to a 10 km curved horizon), crater population, drive path, rocks.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32, makeNoise2D, makeNoise3D, fbm2, fbm3, smoothstep } from './noise.js';

export const GRID = { CORE: 140, STEP: 0.5, OUTER: 10000, OUTER_CELLS: 280 };
const MOON_R = 1737400;
const tick = () => new Promise((r) => setTimeout(r, 0));

/* ---------------------------------------------------------------- axis */
function buildAxis() {
  const { CORE, STEP, OUTER, OUTER_CELLS } = GRID;
  const coreCells = Math.round((2 * CORE) / STEP);
  let lo = 1.00001, hi = 1.3;
  for (let k = 0; k < 80; k++) {
    const m = (lo + hi) / 2;
    const s = (STEP * m * (Math.pow(m, OUTER_CELLS) - 1)) / (m - 1);
    if (s > OUTER - CORE) hi = m; else lo = m;
  }
  const r = (lo + hi) / 2;
  const N = 2 * OUTER_CELLS + coreCells;
  const xs = new Float64Array(N + 1);
  for (let k = 0; k <= coreCells; k++) xs[OUTER_CELLS + k] = -CORE + k * STEP;
  let acc = CORE;
  for (let k = 1; k <= OUTER_CELLS; k++) {
    acc += STEP * Math.pow(r, k);
    xs[OUTER_CELLS + coreCells + k] = acc;
    xs[OUTER_CELLS - k] = -acc;
  }
  return { xs, N, coreCells };
}

/* ---------------------------------------------------------------- path */
function buildPath(rnd) {
  const pts = [];
  const n = 12;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rad = 60 + (rnd() - 0.5) * 22;
    pts.push(new THREE.Vector3(Math.cos(a) * rad * 1.12, 0, Math.sin(a) * rad * 0.92));
  }
  const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal', 0.5);
  const M = 6000;
  const sp = curve.getSpacedPoints(M);
  const px = new Float32Array(M + 1), pz = new Float32Array(M + 1), cum = new Float32Array(M + 1);
  for (let i = 0; i <= M; i++) { px[i] = sp[i].x; pz[i] = sp[i].z; }
  for (let i = 1; i <= M; i++) cum[i] = cum[i - 1] + Math.hypot(px[i] - px[i - 1], pz[i] - pz[i - 1]);
  const length = cum[M];
  const head = new Float32Array(M + 1);
  for (let i = 0; i <= M; i++) {
    const a = (i + M - 1) % M, b = (i + 1) % M;
    head[i] = Math.atan2(-(pz[b] - pz[a]), px[b] - px[a]);
  }
  const kRaw = new Float32Array(M + 1);
  for (let i = 0; i < M; i++) {
    let d = head[(i + 1) % M] - head[i];
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    kRaw[i] = d / Math.max(1e-4, length / M);
  }
  const curv = new Float32Array(M + 1);
  const W = 45;
  for (let i = 0; i < M; i++) {
    let s = 0;
    for (let k = -W; k <= W; k++) s += kRaw[(i + k + M) % M];
    curv[i] = s / (2 * W + 1);
  }
  curv[M] = curv[0];

  function sample(s) {
    s = ((s % length) + length) % length;
    const f = (s / length) * M;
    const i = Math.min(M - 1, Math.floor(f)), t = f - i;
    let dh = head[i + 1] - head[i];
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    return {
      x: px[i] + (px[i + 1] - px[i]) * t,
      z: pz[i] + (pz[i + 1] - pz[i]) * t,
      heading: head[i] + dh * t,
      curvature: curv[i] + (curv[i + 1] - curv[i]) * t,
    };
  }

  // bucket grid for distance-to-path queries
  const B = 6, buckets = new Map();
  const key = (bx, bz) => (bx + 5000) * 10000 + (bz + 5000);
  for (let i = 0; i < M; i += 4) {
    const k = key(Math.floor(px[i] / B), Math.floor(pz[i] / B));
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(i);
  }
  function dist(x, z, maxR = 12) {
    const rr = Math.ceil(maxR / B);
    const bx = Math.floor(x / B), bz = Math.floor(z / B);
    let best = Infinity;
    for (let j = -rr; j <= rr; j++) for (let i = -rr; i <= rr; i++) {
      const arr = buckets.get(key(bx + i, bz + j));
      if (!arr) continue;
      for (const p of arr) {
        const d = (px[p] - x) ** 2 + (pz[p] - z) ** 2;
        if (d < best) best = d;
      }
    }
    return Math.sqrt(best);
  }
  return { length, sample, dist, px, pz, M };
}

/* ---------------------------------------------------------------- shader */
const terrainVS = /* glsl */ `
#include <common>
#include <shadowmap_pars_vertex>
attribute float aTone;
varying vec3 vWorld;
varying vec3 vN;
varying float vTone;
void main() {
  #include <beginnormal_vertex>
  #include <defaultnormal_vertex>
  #include <begin_vertex>
  #include <project_vertex>
  #include <worldpos_vertex>
  #include <shadowmap_vertex>
  vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  vTone = aTone;
}`;

const terrainFS = /* glsl */ `
#include <common>
#include <packing>
#include <lights_pars_begin>
#include <shadowmap_pars_fragment>
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uAmbient;
varying vec3 vWorld;
varying vec3 vN;
varying float vTone;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * .1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
// value noise + analytic derivatives
vec3 noised(vec2 x) {
  vec2 i = floor(x);
  vec2 f = fract(x);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  vec2 du = 30.0 * f * f * (f * (f - 2.0) + 1.0);
  float a = hash12(i), b = hash12(i + vec2(1, 0)), c = hash12(i + vec2(0, 1)), d = hash12(i + vec2(1, 1));
  float k1 = b - a, k2 = c - a, k4 = a - b - c + d;
  return vec3(a + k1 * u.x + k2 * u.y + k4 * u.x * u.y, du * vec2(k1 + k4 * u.y, k2 + k4 * u.x));
}

// fractal regolith relief: returns height gradient (dh/dx, dh/dz)
vec2 regolith(vec2 p, float fw, out float hs) {
  vec2 g = vec2(0.0);
  hs = 0.0;
  float amp = 0.16, freq = 0.33;
  mat2 M = mat2(1.0, 0.0, 0.0, 1.0);
  const mat2 R = mat2(0.80, -0.60, 0.60, 0.80);
  for (int i = 0; i < 9; i++) {
    float fade = 1.0 - smoothstep(0.18, 0.5, freq * fw);
    if (fade <= 0.0) break;
    vec3 n = noised((M * p) * freq + float(i) * 7.31);
    g += fade * amp * freq * (transpose(M) * n.yz);
    hs += fade * amp * (n.x - 0.5);
    freq *= 2.07; amp *= 0.54;
    M = R * M;
  }
  return g;
}

// micro craters (below mesh resolution), Voronoi-scattered
vec2 craterlets(vec2 p, float cell, float density, float fw, inout float tone) {
  vec2 g = vec2(0.0);
  float fade = 1.0 - smoothstep(cell * 0.05, cell * 0.22, fw);
  if (fade <= 0.0) return g;
  vec2 ip = floor(p / cell);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 c = ip + vec2(float(i), float(j));
    if (hash12(c + 17.3) > density) continue;
    vec2 center = (c + 0.15 + 0.7 * hash22(c)) * cell;
    float R = cell * (0.1 + 0.4 * pow(hash12(c + 5.1), 2.2));
    vec2 d = p - center;
    float r = length(d);
    float x = r / R;
    if (x > 2.2) continue;
    float fresh = hash12(c + 9.7);
    float depth = R * (0.05 + 0.15 * fresh);
    float rim = R * 0.06 * fresh;
    float dhdx = x < 1.0 ? (depth + rim) * 2.0 * x : rim * (-3.0 * pow(x, -4.0)) / (1.0 - 0.0939);
    g += fade * (dhdx / R) * (d / max(r, 1e-4));
    tone += fade * smoothstep(0.75, 1.0, fresh) * 0.35 * smoothstep(2.0, 0.9, x);
  }
  return g;
}

void main() {
  vec3 N0 = normalize(vN);
  vec2 p = vWorld.xz;
  vec2 fwv = fwidth(p);
  float fw = max(max(fwv.x, fwv.y), 1e-4);

  float hs;
  vec2 g = regolith(p, fw, hs);
  float mtone = 0.0;
  g += craterlets(p, 3.1, 0.45, fw, mtone);
  g += craterlets(p + 13.7, 0.9, 0.38, fw, mtone);
  g += craterlets(p - 5.3, 0.27, 0.34, fw, mtone);
  vec3 N = normalize(N0 + vec3(-g.x, 0.0, -g.y));

  // albedo: mare/highland mottling, crater ejecta tone, pebble speckle
  float large = noised(p * 0.0045).x * 0.55 + noised(p * 0.019 + 3.0).x * 0.3 + noised(p * 0.09).x * 0.15;
  float alb = mix(0.095, 0.165, large);
  alb *= 1.0 + clamp(vTone, -0.3, 1.2) * 0.9 + mtone;
  float speckFade = 1.0 - smoothstep(0.004, 0.02, fw);
  float sp = hash12(floor(p * 55.0));
  alb *= 1.0 + (sp - 0.5) * 0.35 * speckFade;
  alb *= 1.0 + hs * 0.6;
  vec3 albedo = alb * vec3(1.0, 0.975, 0.94);

  vec3 L = normalize(uSunDir);
  vec3 V = normalize(cameraPosition - vWorld);
  float mu0 = max(dot(N, L), 0.0);
  float mu = max(dot(N, V), 0.0);
  float ls = 2.0 * mu0 / (mu0 + mu + 0.03);
  float phase = acos(clamp(dot(L, V), -1.0, 1.0));
  float opp = 1.0 + 0.5 * exp(-phase / 0.07);
  float ph = mix(1.0, 0.55, smoothstep(0.4, 2.6, phase));
  float f = mix(mu0, ls * ph, 0.65) * opp;
  f *= smoothstep(-0.02, 0.06, dot(N0, L));

  float shadow = 1.0;
  #if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
    vec3 sc0 = vDirectionalShadowCoord[0].xyz / vDirectionalShadowCoord[0].w;
    float sNear = getShadow(directionalShadowMap[0], directionalLightShadows[0].shadowMapSize,
      directionalLightShadows[0].shadowBias, directionalLightShadows[0].shadowRadius, vDirectionalShadowCoord[0]);
    vec2 e = min(sc0.xy, 1.0 - sc0.xy);
    float wNear = smoothstep(0.0, 0.1, min(e.x, e.y));
    float sFar = 1.0;
    #if NUM_DIR_LIGHT_SHADOWS > 1
      sFar = getShadow(directionalShadowMap[1], directionalLightShadows[1].shadowMapSize,
        directionalLightShadows[1].shadowBias, directionalLightShadows[1].shadowRadius, vDirectionalShadowCoord[1]);
    #endif
    shadow = mix(sFar, sNear, wNear);
  #endif

  vec3 col = albedo * RECIPROCAL_PI * uSunColor * f * shadow;
  col += albedo * uSunColor * uAmbient * (0.6 + 0.4 * N.y);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function makeTerrainMaterial() {
  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.lights,
    {
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uSunColor: { value: new THREE.Color(1, 1, 1) },
      uAmbient: { value: 0.012 },
    },
  ]);
  return new THREE.ShaderMaterial({ uniforms, vertexShader: terrainVS, fragmentShader: terrainFS, lights: true });
}

/* ---------------------------------------------------------------- rocks */
function makeRockGeometry(rnd, noise3, detail, dark) {
  let g = new THREE.IcosahedronGeometry(1, detail);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g);
  const pos = g.attributes.position;
  const planes = [];
  const np = 4 + Math.floor(rnd() * 7);
  for (let i = 0; i < np; i++) {
    const n = new THREE.Vector3(rnd() - 0.5, (rnd() - 0.5) * 1.4, rnd() - 0.5).normalize();
    planes.push({ n, d: 0.5 + rnd() * 0.4 });
  }
  const sx = 0.8 + rnd() * 0.5, sy = 0.5 + rnd() * 0.35, sz = 0.7 + rnd() * 0.5;
  const off = rnd() * 100;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    for (const p of planes) {
      const dd = v.dot(p.n);
      if (dd > p.d) v.addScaledVector(p.n, -(dd - p.d) * 0.92);
    }
    const nn = fbm3(noise3, v.x * 1.5 + off, v.y * 1.5, v.z * 1.5, 4);
    v.multiplyScalar(1 + nn * 0.2);
    v.x *= sx; v.y *= sy; v.z *= sz;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  const nrm = g.attributes.normal;
  const col = new Float32Array(pos.count * 3);
  const base = dark ? 0.1 + rnd() * 0.04 : 0.15 + rnd() * 0.06;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const vv = base * (0.82 + 0.36 * (fbm3(noise3, v.x * 4 + off, v.y * 4, v.z * 4, 3) * 0.5 + 0.5));
    const dust = smoothstep(0.2, 0.95, nrm.getY(i)) * 0.45;
    const c = vv * (1 - dust) + 0.14 * dust;
    col[i * 3] = c * 1.0; col[i * 3 + 1] = c * 0.975; col[i * 3 + 2] = c * 0.94;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeBoundingSphere();
  return { geo: g, sy };
}

function makeRockMaterial() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRockP;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vRockP = (instanceMatrix * vec4(position, 1.0)).xyz;
        #else
          vRockP = position;
        #endif`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vRockP;
        float h31(vec3 p){ p = fract(p * 0.3183099 + .1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        float vn3(vec3 x){ vec3 i = floor(x); vec3 f = fract(x); f = f*f*(3.0-2.0*f);
          return mix(mix(mix(h31(i),h31(i+vec3(1,0,0)),f.x), mix(h31(i+vec3(0,1,0)),h31(i+vec3(1,1,0)),f.x),f.y),
                     mix(mix(h31(i+vec3(0,0,1)),h31(i+vec3(1,0,1)),f.x), mix(h31(i+vec3(0,1,1)),h31(i+vec3(1,1,1)),f.x),f.y), f.z); }
        float rockH(vec3 p){ return vn3(p*9.0)*0.6 + vn3(p*27.0)*0.3 + vn3(p*71.0)*0.1; }`)
      .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
        {
          float e = 0.004;
          float h0 = rockH(vRockP);
          vec3 gr = vec3(rockH(vRockP + vec3(e,0,0)) - h0, rockH(vRockP + vec3(0,e,0)) - h0, rockH(vRockP + vec3(0,0,e)) - h0) / e;
          vec3 gv = mat3(viewMatrix) * gr;
          normal = normalize(normal - (gv - dot(gv, normal) * normal) * 0.018);
          diffuseColor.rgb *= 0.8 + 0.4 * h0;
        }`);
  };
  return m;
}

/* ---------------------------------------------------------------- world */
export async function buildWorld(onProgress = () => {}) {
  const rnd = mulberry32(20260923);
  const { xs, N, coreCells } = buildAxis();
  const S = N + 1;
  const { CORE, STEP, OUTER_CELLS } = GRID;
  const H = new Float32Array(S * S);
  const T = new Float32Array(S * S);

  const cellIndex = (v) => {
    if (v >= -CORE && v < CORE) return OUTER_CELLS + Math.floor((v + CORE) / STEP);
    if (v <= xs[0]) return 0;
    if (v >= xs[N]) return N - 1;
    let lo = 0, hi = N - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (xs[mid] <= v) lo = mid; else hi = mid - 1;
    }
    return lo;
  };

  const path = buildPath(rnd);
  onProgress(0.05, '规划巡视路线');
  await tick();

  // base relief, LOD-aware (fine octaves skipped where grid spacing hides them)
  const n1 = makeNoise2D(101), n2 = makeNoise2D(202), n3 = makeNoise2D(303), n4 = makeNoise2D(404);
  const spacing = new Float32Array(S);
  for (let i = 0; i < S; i++) spacing[i] = xs[Math.min(N, i + 1)] - xs[Math.max(0, i - 1)];
  for (let j = 0; j < S; j++) {
    const z = xs[j];
    for (let i = 0; i < S; i++) {
      const x = xs[i];
      const sp = Math.max(spacing[i], spacing[j]);
      const r = Math.hypot(x, z);
      let h = 3.4 * fbm2(n1, x / 280, z / 280, 4);
      if (sp < 40) h += 0.9 * fbm2(n2, x / 55, z / 55, 3);
      if (sp < 8) h += 0.22 * fbm2(n3, x / 13, z / 13, 3);
      if (sp < 2) h += 0.05 * n4(x / 3.1, z / 3.1);
      const far = smoothstep(450, 2800, r);
      if (far > 0) {
        const ridge = 1 - Math.abs(fbm2(n2, x / 2300 + 3.1, z / 2300 - 1.7, 6));
        h += far * (Math.pow(ridge, 2.4) * 420 + fbm2(n3, x / 850, z / 850, 4) * 70);
      }
      h -= (r * r) / (2 * MOON_R);
      H[j * S + i] = h;
    }
    if (j % 90 === 0) { onProgress(0.05 + 0.3 * (j / S), '生成月壤地形'); await tick(); }
  }

  // craters
  const craters = [];
  const addCrater = (x, z, D, fresh, opts = {}) => {
    const R = D / 2;
    const f = fresh;
    craters.push({
      x, z, R, fresh: f,
      depth: D * (0.04 + 0.17 * f) * (opts.shallow || 1),
      rim: D * 0.045 * f * (opts.shallow || 1),
      pw: 1 + (1 - f) * 1.6,
      a1: 0.03 + rnd() * 0.05, a2: rnd() * 0.035, a3: rnd() * 0.02,
      p1: rnd() * 6.28, p2: rnd() * 6.28, p3: rnd() * 6.28,
      rays: opts.rays || false, rayN: 7 + Math.floor(rnd() * 9),
    });
  };
  const pathOK = (x, z, R, D) => {
    const need = R * 1.2 + 1.3;
    const d = path.dist(x, z, need + 6);
    return d > need;
  };
  // hero craters near the start of the drive
  {
    const s0 = path.sample(8);
    const nx = Math.sin(s0.heading), nz = Math.cos(s0.heading); // right-hand normal
    addCrater(s0.x + nx * 17, s0.z + nz * 17, 19, 0.97, { rays: true });
    addCrater(s0.x - nx * 11 + 14, s0.z - nz * 11, 7.5, 0.9);
    addCrater(0, 0, 58, 0.55);
    addCrater(-150, 190, 140, 0.7);
    addCrater(260, -90, 90, 0.95, { rays: true });
  }
  // large, far
  for (let k = 0; k < 280; k++) {
    const D = Math.min(900, 70 * Math.pow(1 - rnd(), -1 / 1.8));
    const x = (rnd() - 0.5) * 11000, z = (rnd() - 0.5) * 11000;
    if (Math.hypot(x, z) < 260 + D) continue;
    addCrater(x, z, D, 0.25 + 0.75 * Math.pow(rnd(), 2), { rays: rnd() < 0.05 });
  }
  // medium
  for (let k = 0; k < 110; k++) {
    const D = Math.min(70, 8 * Math.pow(1 - rnd(), -1 / 1.9));
    const x = (rnd() - 0.5) * 820, z = (rnd() - 0.5) * 820;
    if (!pathOK(x, z, D / 2, D)) continue;
    addCrater(x, z, D, 0.2 + 0.8 * Math.pow(rnd(), 2.2), { rays: D > 12 && rnd() < 0.2 });
  }
  // small, dense near the drive region
  for (let k = 0; k < 7800; k++) {
    const D = Math.min(8, 0.55 * Math.pow(1 - rnd(), -1 / 2.1));
    let x, z;
    if (rnd() < 0.45) {
      const s = path.sample(rnd() * path.length);
      const o = (rnd() - 0.5) * 50;
      x = s.x + Math.sin(s.heading) * o; z = s.z + Math.cos(s.heading) * o;
    } else { x = (rnd() - 0.5) * 290; z = (rnd() - 0.5) * 290; }
    const fresh = 0.2 + 0.8 * Math.pow(rnd(), 2.6);
    const d = path.dist(x, z, D + 3);
    if (d < D * 0.6 + 1.3) {
      if (D > 1.6) continue;
      addCrater(x, z, D, fresh, { shallow: 0.35 });
    } else addCrater(x, z, D, fresh);
  }
  onProgress(0.4, '撞击坑成形');
  await tick();

  const kk = Math.pow(2.6, -3);
  for (let ci = 0; ci < craters.length; ci++) {
    const c = craters[ci];
    const infl = c.R * (c.rays ? 6 : 2.6);
    const i0 = cellIndex(c.x - infl), i1 = Math.min(N, cellIndex(c.x + infl) + 1);
    const j0 = cellIndex(c.z - infl), j1 = Math.min(N, cellIndex(c.z + infl) + 1);
    const tf = c.fresh > 0.72 ? (c.fresh - 0.72) / 0.28 : 0;
    for (let j = j0; j <= j1; j++) {
      const dz = xs[j] - c.z;
      for (let i = i0; i <= i1; i++) {
        const dx = xs[i] - c.x;
        const r = Math.sqrt(dx * dx + dz * dz);
        if (r > infl) continue;
        const th = Math.atan2(dz, dx);
        const Rm = c.R * (1 + c.a1 * Math.sin(3 * th + c.p1) + c.a2 * Math.sin(5 * th + c.p2) + c.a3 * Math.sin(9 * th + c.p3));
        const x = r / Rm;
        let h = 0;
        if (x < 1) h = c.rim - (c.depth + c.rim) * Math.pow(1 - x * x, c.pw);
        else if (x < 2.6) h = c.rim * Math.max(0, (Math.pow(x, -3) - kk) / (1 - kk));
        const idx = j * S + i;
        H[idx] += h;
        if (tf > 0) {
          let t = x < 1 ? 0.25 * tf * (0.4 + 0.6 * x * x) : 0.32 * tf * Math.exp(-(x - 1) * 1.5);
          if (c.rays && x > 1) {
            const ray = Math.max(0, Math.sin(th * c.rayN + c.p1 * 3) * Math.sin(th * c.rayN * 0.41 + 1.3));
            t += 0.4 * tf * Math.pow(ray, 3) * Math.exp(-(x - 1) * 0.5);
          }
          T[idx] += t;
        }
      }
    }
    if (ci % 1500 === 0) { onProgress(0.4 + 0.2 * (ci / craters.length), '撞击坑成形'); await tick(); }
  }

  // normals
  const NRM = new Float32Array(S * S * 3);
  for (let j = 0; j < S; j++) {
    const ja = Math.max(0, j - 1), jb = Math.min(N, j + 1);
    for (let i = 0; i < S; i++) {
      const ia = Math.max(0, i - 1), ib = Math.min(N, i + 1);
      const hx = (H[j * S + ib] - H[j * S + ia]) / (xs[ib] - xs[ia]);
      const hz = (H[jb * S + i] - H[ja * S + i]) / (xs[jb] - xs[ja]);
      const l = Math.sqrt(hx * hx + 1 + hz * hz);
      const o = (j * S + i) * 3;
      NRM[o] = -hx / l; NRM[o + 1] = 1 / l; NRM[o + 2] = -hz / l;
    }
  }
  onProgress(0.65, '构建地表网格');
  await tick();

  // height sampling that matches the rendered triangles exactly
  function cellAt(x, z) {
    const i = Math.min(N - 1, cellIndex(x)), j = Math.min(N - 1, cellIndex(z));
    const fx = (x - xs[i]) / (xs[i + 1] - xs[i]), fz = (z - xs[j]) / (xs[j + 1] - xs[j]);
    return { i, j, fx, fz };
  }
  function heightAt(x, z) {
    const { i, j, fx, fz } = cellAt(x, z);
    const h00 = H[j * S + i], h10 = H[j * S + i + 1], h01 = H[(j + 1) * S + i], h11 = H[(j + 1) * S + i + 1];
    if (fx + fz <= 1) return h00 + fx * (h10 - h00) + fz * (h01 - h00);
    return h11 + (1 - fx) * (h01 - h11) + (1 - fz) * (h10 - h11);
  }
  function normalAt(x, z, out = new THREE.Vector3()) {
    const { i, j, fx, fz } = cellAt(x, z);
    const dx = xs[i + 1] - xs[i], dz = xs[j + 1] - xs[j];
    const h00 = H[j * S + i], h10 = H[j * S + i + 1], h01 = H[(j + 1) * S + i], h11 = H[(j + 1) * S + i + 1];
    let hx, hz;
    if (fx + fz <= 1) { hx = (h10 - h00) / dx; hz = (h01 - h00) / dz; }
    else { hx = (h11 - h01) / dx; hz = (h11 - h10) / dz; }
    return out.set(-hx, 1, -hz).normalize();
  }

  // chunked meshes (frustum culling for the camera and the rover's shadow pass)
  const material = makeTerrainMaterial();
  const group = new THREE.Group();
  const CH = 8;
  const per = Math.ceil(N / CH);
  for (let cj = 0; cj < CH; cj++) {
    for (let ci = 0; ci < CH; ci++) {
      const i0 = ci * per, i1 = Math.min(N, (ci + 1) * per);
      const j0 = cj * per, j1 = Math.min(N, (cj + 1) * per);
      const w = i1 - i0 + 1, h = j1 - j0 + 1;
      const pos = new Float32Array(w * h * 3), nor = new Float32Array(w * h * 3), tone = new Float32Array(w * h);
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        const gi = i0 + i, gj = j0 + j, g = gj * S + gi, o = (j * w + i) * 3;
        pos[o] = xs[gi]; pos[o + 1] = H[g]; pos[o + 2] = xs[gj];
        nor[o] = NRM[g * 3]; nor[o + 1] = NRM[g * 3 + 1]; nor[o + 2] = NRM[g * 3 + 2];
        tone[j * w + i] = T[g];
      }
      const idx = new Uint32Array((w - 1) * (h - 1) * 6);
      let k = 0;
      for (let j = 0; j < h - 1; j++) for (let i = 0; i < w - 1; i++) {
        const a = j * w + i, b = a + 1, c = a + w, d = c + 1;
        idx[k++] = a; idx[k++] = c; idx[k++] = b;
        idx[k++] = b; idx[k++] = c; idx[k++] = d;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      geo.setAttribute('aTone', new THREE.BufferAttribute(tone, 1));
      geo.setIndex(new THREE.BufferAttribute(idx, 1));
      geo.computeBoundingSphere();
      geo.computeBoundingBox();
      const mesh = new THREE.Mesh(geo, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      group.add(mesh);
    }
  }
  onProgress(0.75, '散布岩块');
  await tick();

  const rocks = buildRocks({ rnd, path, heightAt, normalAt, craters });
  onProgress(0.85, '岩块就位');
  await tick();

  return { group, material, heightAt, normalAt, path, craters, rocks, xs };
}

function buildRocks({ rnd, path, heightAt, craters }) {
  const noise3 = makeNoise3D(77);
  const mat = makeRockMaterial();
  const group = new THREE.Group();
  const boulderVariants = [], cobbleVariants = [];
  for (let i = 0; i < 7; i++) boulderVariants.push(makeRockGeometry(rnd, noise3, 4, i % 3 === 0));
  for (let i = 0; i < 5; i++) cobbleVariants.push(makeRockGeometry(rnd, noise3, 2, i % 2 === 0));

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), p = new THREE.Vector3();
  const place = (x, z, size, variant) => {
    e.set((rnd() - 0.5) * 0.35, rnd() * Math.PI * 2, (rnd() - 0.5) * 0.35);
    q.setFromEuler(e);
    const s = size * (0.85 + rnd() * 0.3);
    sc.set(s, s, s);
    const bury = variant.sy * s * (0.25 + rnd() * 0.3);
    p.set(x, heightAt(x, z) - bury, z);
    return m4.compose(p, q, sc).clone();
  };

  // boulders: rim ejecta of fresher craters + scattered field
  const boulderBins = boulderVariants.map(() => []);
  const bigFresh = craters.filter((c) => c.R > 2 && c.fresh > 0.6 && Math.hypot(c.x, c.z) < 180);
  for (let k = 0; k < 520; k++) {
    let x, z;
    if (rnd() < 0.6 && bigFresh.length) {
      const c = bigFresh[Math.floor(rnd() * bigFresh.length)];
      const a = rnd() * Math.PI * 2, r = c.R * (0.85 + Math.pow(rnd(), 1.6) * 1.6);
      x = c.x + Math.cos(a) * r; z = c.z + Math.sin(a) * r;
    } else { x = (rnd() - 0.5) * 280; z = (rnd() - 0.5) * 280; }
    const size = Math.min(2.4, 0.22 * Math.pow(1 - rnd(), -1 / 2.2));
    if (path.dist(x, z, size + 4) < size + 1.6) continue;
    const v = Math.floor(rnd() * boulderVariants.length);
    boulderBins[v].push(place(x, z, size, boulderVariants[v]));
  }
  boulderBins.forEach((list, v) => {
    if (!list.length) return;
    const im = new THREE.InstancedMesh(boulderVariants[v].geo, mat, list.length);
    list.forEach((m, i) => im.setMatrixAt(i, m));
    im.castShadow = true; im.receiveShadow = true;
    im.computeBoundingSphere();
    group.add(im);
  });

  // cobbles: tiled so the shadow pass only draws what is near the rover
  const tile = 45;
  const bins = new Map();
  for (let k = 0; k < 11000; k++) {
    let x, z;
    if (rnd() < 0.72) {
      const s = path.sample(rnd() * path.length);
      const side = rnd() < 0.5 ? -1 : 1;
      const o = side * (0.95 + Math.pow(rnd(), 1.7) * 14);
      x = s.x + Math.sin(s.heading) * o; z = s.z + Math.cos(s.heading) * o;
    } else { x = (rnd() - 0.5) * 240; z = (rnd() - 0.5) * 240; }
    const size = Math.min(0.28, 0.035 * Math.pow(1 - rnd(), -1 / 2.4));
    if (path.dist(x, z, 3) < 0.9 + size) continue;
    const v = Math.floor(rnd() * cobbleVariants.length);
    const key = `${v}|${Math.floor(x / tile)}|${Math.floor(z / tile)}`;
    if (!bins.has(key)) bins.set(key, { v, list: [] });
    bins.get(key).list.push(place(x, z, size, cobbleVariants[v]));
  }
  for (const { v, list } of bins.values()) {
    const im = new THREE.InstancedMesh(cobbleVariants[v].geo, mat, list.length);
    list.forEach((m, i) => im.setMatrixAt(i, m));
    im.castShadow = true; im.receiveShadow = true;
    im.computeBoundingSphere();
    group.add(im);
  }
  return group;
}
