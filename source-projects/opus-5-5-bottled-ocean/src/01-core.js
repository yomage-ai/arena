// ============================================================================
//  瓶中沧海 · Ship in a Bottle — voxel diorama (Three.js r160)
//  01-core: imports, world constants, shared uniforms, GLSL library, materials
// ============================================================================
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { Pass } from 'three/addons/postprocessing/Pass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// ---------------------------------------------------------------- constants
const WATER_Y = -1.0;           // resting sea level inside the bottle (world)
const TABLE_Y = -12.6;          // table top
// Bottle profile (bottle-local, axis = +x). Outer glass and inner cavity.
const GLASS_OUT = { R: 10.0, xb: -20.0, rc: 3.2, rn: 3.12, xs: 13.0, xe: 20.5 };
const GLASS_IN  = { R: 9.62, xb: -19.62, rc: 2.82, rn: 2.62, xs: 13.0, xe: 20.5 };
const LIP_X = 27.0;             // mouth of the bottle
const CORK_X = 22.7;            // cavity ends where the cork begins
const CLIP_MARGIN = 0.07;
const ISLAND = { x: -4.2, z: -0.9, ax: 4.7, az: 3.5 };
const LH = { x: -2.5, z: -2.3 };            // lighthouse
const HUT = { x: -6.9, z: -1.7 };
const DOCK = { z: -0.35, x0: 0.0, x1: 3.3 };
const WIN_DIR = new THREE.Vector3(-0.78, 0.44, -0.44).normalize(); // dusk window (room key light)
const PIVOT = new THREE.Vector3(-1.75, -10.0, 0);                   // bottle rocks around cradle contact

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const TAU = Math.PI * 2;

// deterministic RNG + hash noise
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash3(i, j, k) {
  let h = (i * 374761393 + j * 668265263 + k * 1274126177) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}
function noise2(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash3(xi, yi, 7), b = hash3(xi + 1, yi, 7), c = hash3(xi, yi + 1, 7), d = hash3(xi + 1, yi + 1, 7);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// bottle radius profile — identical formula in GLSL (rinAt)
function profR(P, x) {
  if (x < P.xb) return -1;
  if (x < P.xb + P.rc) { const d = P.xb + P.rc - x; return P.R - P.rc + Math.sqrt(Math.max(0, P.rc * P.rc - d * d)); }
  if (x < P.xs) return P.R;
  if (x < P.xe) { const t = (x - P.xs) / (P.xe - P.xs); return P.rn + (P.R - P.rn) * 0.5 * (1 + Math.cos(Math.PI * t)); }
  return P.rn;
}
// is a (rest-frame) point inside the cavity, with margin?
function insideRest(x, y, z, m = 0) {
  if (x > CORK_X) return false;
  const r = profR(GLASS_IN, x);
  return r > 0 && Math.hypot(y, z) < r - m;
}
// y of the glass floor under (x,z) in bottle frame
function floorY(x, z) {
  const r = profR(GLASS_IN, x);
  return -Math.sqrt(Math.max(0, r * r - z * z));
}

// ------------------------------------------------------------ shared uniforms
const U = {
  uTime: { value: 0 },
  uWaveT: { value: 0 },
  uStorm: { value: 0 },
  uWaterY: { value: WATER_Y },
  uGlow: { value: 1 },
  uFlash: { value: 0 },
  uSunUp: { value: 1 },
  uBottleInv: { value: new THREE.Matrix4() },
  uBotA: { value: new THREE.Vector4(GLASS_IN.R, GLASS_IN.xb, GLASS_IN.rc, GLASS_IN.rn) },
  uBotB: { value: new THREE.Vector4(GLASS_IN.xs, GLASS_IN.xe, CORK_X, CLIP_MARGIN) },
  uIsland: { value: new THREE.Vector4(ISLAND.x, ISLAND.z, ISLAND.ax, ISLAND.az) },
  uSplash: { value: new THREE.Vector4(0, 0, -100, 0) },
  uWaterShallow: { value: new THREE.Color(0x1a8aa0) },
  uWaterDeep: { value: new THREE.Color(0x04152c) },
  uCausticCol: { value: new THREE.Color(0xbfefff) },
};

const GLSL_COMMON = /* glsl */`
uniform float uTime;
uniform float uWaveT;
uniform float uStorm;
uniform float uWaterY;
uniform float uGlow;
uniform float uFlash;
uniform float uSunUp;
uniform mat4 uBottleInv;
uniform vec4 uBotA;
uniform vec4 uBotB;
uniform vec4 uIsland;
uniform vec4 uSplash;
uniform vec3 uWaterShallow;
uniform vec3 uWaterDeep;
uniform vec3 uCausticCol;

float rinAt(float x){
  float R = uBotA.x, xb = uBotA.y, rc = uBotA.z, rn = uBotA.w;
  if (x < xb || x > uBotB.z) return -1.0;
  if (x < xb + rc) { float d = xb + rc - x; return R - rc + sqrt(max(0.0, rc*rc - d*d)); }
  if (x < uBotB.x) return R;
  if (x < uBotB.y) { float t = (x - uBotB.x) / (uBotB.y - uBotB.x); return rn + (R - rn) * 0.5 * (1.0 + cos(3.14159265 * t)); }
  return rn;
}
bool insideBottle(vec3 wp){
  vec3 p = (uBottleInv * vec4(wp, 1.0)).xyz;
  return length(p.yz) < rinAt(p.x) - uBotB.w;
}
float islandDamp(vec2 p){
  vec2 d = (p - uIsland.xy) / uIsland.zw;
  return 0.25 + 0.75 * smoothstep(0.85, 1.7, length(d));
}
float waveH(vec2 p){
  float t = uWaveT, s = uStorm;
  float h = sin(p.x*0.55 + p.y*0.32 + t*1.25) * 0.50
          + sin(-p.x*0.26 + p.y*0.66 + t*1.55 + 1.3) * 0.32
          + sin(p.x*0.87 - p.y*0.47 + t*2.10 + 2.1) * 0.20
          + sin(-p.x*1.31 - p.y*0.52 + t*2.90 + 0.7) * (0.08 + 0.22*s)
          + sin(p.x*1.90 + p.y*1.20 + t*3.70 + 4.0) * (0.03 + 0.12*s);
  h *= (0.27 + 0.72*s) * islandDamp(p);
  float st = uTime - uSplash.z;
  if (st > 0.0 && st < 7.0) {
    float d = length(p - uSplash.xy);
    float q = d - st * 2.6;
    h += uSplash.w * sin(q * 2.2) * exp(-q*q*0.35) * exp(-st*0.5) * 0.5;
  }
  return h;
}
float caustic(vec2 p, float t){
  float c = sin(p.x*1.9 + sin(p.y*1.3 + t*0.9)*1.4 + t*1.1)
          + sin(p.y*2.1 + sin(p.x*1.7 - t*0.7)*1.4 - t*0.8);
  c = 1.0 - abs(c * 0.5);
  return pow(max(c, 0.0), 6.0);
}
vec3 windOffset(vec3 p, float w){
  float s = uStorm, t = uTime;
  float a = w * (0.03 + 0.17*s);
  return a * vec3(sin(t*(2.1+2.6*s) + p.y*1.7 + p.z*1.3) + 0.5*sin(t*5.3 + p.x*2.1 + p.y),
                  0.2*sin(t*3.7 + p.x*1.9),
                  0.8*sin(t*(1.6+2.2*s) + p.x*1.2 + 0.5) + 0.3*sin(t*4.4 + p.y*2.0));
}
`;

// JS mirror of the GPU wave field (used for buoyancy, spray, bubbles…)
function islandDampJS(x, z) {
  const dx = (x - ISLAND.x) / ISLAND.ax, dz = (z - ISLAND.z) / ISLAND.az;
  return 0.25 + 0.75 * smooth(0.85, 1.7, Math.hypot(dx, dz));
}
function waveH(x, z) {
  const t = U.uWaveT.value, s = U.uStorm.value;
  let h = Math.sin(x * 0.55 + z * 0.32 + t * 1.25) * 0.50
        + Math.sin(-x * 0.26 + z * 0.66 + t * 1.55 + 1.3) * 0.32
        + Math.sin(x * 0.87 - z * 0.47 + t * 2.10 + 2.1) * 0.20
        + Math.sin(-x * 1.31 - z * 0.52 + t * 2.90 + 0.7) * (0.08 + 0.22 * s)
        + Math.sin(x * 1.90 + z * 1.20 + t * 3.70 + 4.0) * (0.03 + 0.12 * s);
  h *= (0.27 + 0.72 * s) * islandDampJS(x, z);
  const sp = U.uSplash.value, st = U.uTime.value - sp.z;
  if (st > 0 && st < 7) {
    const d = Math.hypot(x - sp.x, z - sp.y), q = d - st * 2.6;
    h += sp.w * Math.sin(q * 2.2) * Math.exp(-q * q * 0.35) * Math.exp(-st * 0.5) * 0.5;
  }
  return h;
}
const seaY = (x, z) => WATER_Y + waveH(x, z);

// underwater tint + caustics, injected before <opaque_fragment> of lit materials
const UNDERWATER_GLSL = /* glsl */`
{
  float wy = uWaterY + waveH(vWPos.xz);
  float under = wy - vWPos.y;
  if (under > 0.0) {
    float dz = clamp(under / 8.5, 0.0, 1.0);
    vec3 wc = mix(uWaterShallow, uWaterDeep, sqrt(dz));
    float cs = caustic(vWPos.xz * 1.35 + vWPos.y * 0.3, uTime);
    vec3 emi = totalEmissiveRadiance;
    vec3 lit = outgoingLight - emi;
    lit += uCausticCol * cs * (1.0 - dz) * uSunUp * 0.9 * diffuseColor.rgb;
    float f = clamp(0.1 + 0.5 * dz, 0.0, 0.62);
    outgoingLight = mix(lit, wc, f) + emi * (1.0 - 0.45 * f);
  }
}
`;

// Patch a built-in material: clip to the bottle, per-instance emissive, wind
// sway, cloud offsets, fish tail wag, underwater tint.
function patch(mat, o = {}) {
  const key = ['P', o.emit ? 'e' : '', o.wind ? 'w' : '', o.clip === false ? '' : 'c', o.under === false ? '' : 'u',
    o.cloud ? 'k' : '', o.fish ? 'f' : '', o.depth ? 'd' : '', o.dither ? 'x' : '', o.key || ''].join('');
  mat.customProgramCacheKey = () => key;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    if (o.uniforms) Object.assign(sh.uniforms, o.uniforms);
    let vs = sh.vertexShader, fs = sh.fragmentShader;
    vs = vs.replace('#include <common>', '#include <common>\n' + GLSL_COMMON + '\nvarying vec3 vWPos;\n'
      + (o.emit ? 'attribute float aEmit;\nvarying float vEmit;\n' : '')
      + (o.wind ? 'attribute float aWind;\n' : '')
      + (o.cloud ? 'attribute float aCloud;\nuniform vec4 uCloud[16];\n' : '')
      + (o.dither ? 'varying float vLocalY;\n' : ''));
    let p = 'vec4 mvPosition = vec4( transformed, 1.0 );\n';
    if (o.dither) p += 'vLocalY = transformed.y;\n';
    if (o.fish) p += '{ float tail = smoothstep(0.02, -0.26, mvPosition.x); mvPosition.z += sin(uTime*13.0 + float(gl_InstanceID)*1.93) * 0.09 * tail; }\n';
    p += '#ifdef USE_INSTANCING\n mvPosition = instanceMatrix * mvPosition;\n#endif\n';
    if (o.cloud) p += '{ vec4 cl = uCloud[int(aCloud + 0.5)]; mvPosition.xyz = mvPosition.xyz * cl.w + cl.xyz; }\n';
    if (o.wind) p += 'mvPosition.xyz += windOffset(mvPosition.xyz, aWind);\n';
    p += 'vWPos = (modelMatrix * mvPosition).xyz;\n';
    if (o.emit) p += 'vEmit = aEmit;\n';
    p += 'mvPosition = modelViewMatrix * mvPosition;\ngl_Position = projectionMatrix * mvPosition;\n';
    vs = vs.replace('#include <project_vertex>', p);

    fs = fs.replace('#include <common>', '#include <common>\n' + GLSL_COMMON + '\nvarying vec3 vWPos;\n'
      + (o.emit ? 'varying float vEmit;\n' : '') + (o.dither ? 'varying float vLocalY;\n' : '') + (o.fHead || ''));
    let head = '';
    if (o.clip !== false) head += 'if (!insideBottle(vWPos)) discard;\n';
    if (o.dither) head += `{ const float BAYER[16] = float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);
      ivec2 g = ivec2(mod(floor(gl_FragCoord.xy), 4.0));
      float b = (BAYER[g.x + g.y * 4] + 0.5) / 16.0;
      float dens = vLocalY < ${WATER_Y.toFixed(2)} ? 0.5 : 0.18;
      if (b > dens) discard; }\n`;
    fs = fs.replace('void main() {', 'void main() {\n' + head);
    if (!o.depth) {
      let emi = '';
      if (o.emit) emi += 'totalEmissiveRadiance += diffuseColor.rgb * vEmit * uGlow;\n';
      if (o.fEmit) emi += o.fEmit;
      if (emi) fs = fs.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + emi);
      if (o.under !== false) fs = fs.replace('#include <opaque_fragment>', UNDERWATER_GLSL + '\n#include <opaque_fragment>');
    }
    sh.vertexShader = vs; sh.fragmentShader = fs;
  };
  return mat;
}

// shared voxel materials
const MAT = {};
MAT.vox = patch(new THREE.MeshStandardMaterial({ roughness: 0.82, metalness: 0.0 }), { emit: true, wind: true });
MAT.voxV = patch(new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0.0, vertexColors: true }), { emit: true, wind: true, key: 'v' });
MAT.fish = patch(new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.15, vertexColors: true }), { emit: true, fish: true });
MAT.depthWind = patch(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), { wind: true, clip: false, depth: true });
MAT.lines = patch(new THREE.LineBasicMaterial({ color: 0x2a1d13 }), { under: false, key: 'l' });

// soft additive billboard glow (sun, moon, lamps, gold)
const GLOW_VS = /* glsl */`
varying vec2 vUv; varying vec3 vWPos;
void main(){
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const GLOW_FS = /* glsl */`
${GLSL_COMMON}
uniform vec3 uColor; uniform float uI; uniform float uCore; uniform float uUnder;
varying vec2 vUv; varying vec3 vWPos;
void main(){
  if (!insideBottle(vWPos)) discard;
  float below = step(vWPos.y, uWaterY + waveH(vWPos.xz));
  if (below > 0.5 && uUnder < 0.5) discard;
  float r = length(vUv - 0.5) * 2.0;
  float a = pow(max(0.0, 1.0 - r), 2.4) + uCore * pow(max(0.0, 1.0 - r * 3.2), 3.0);
  a *= uI;
  if (a < 0.002) discard;
  gl_FragColor = vec4(uColor * a, a);
}`;
const _glowGeo = new THREE.PlaneGeometry(1, 1);
const glows = [];
function makeGlow(color, size, intensity = 1, core = 0.6, under = false) {
  const m = new THREE.ShaderMaterial({
    uniforms: { ...U, uColor: { value: new THREE.Color(color) }, uI: { value: intensity }, uCore: { value: core }, uUnder: { value: under ? 1 : 0 } },
    vertexShader: GLOW_VS, fragmentShader: GLOW_FS,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const g = new THREE.Mesh(_glowGeo, m);
  g.scale.setScalar(size);
  g.renderOrder = 4;
  g.frustumCulled = false;
  glows.push(g);
  return g;
}
