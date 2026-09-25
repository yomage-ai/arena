// ============================================================================
//  08-main: renderer & post, day–night cycle, storm, bottle rocking, tag
//           pendulum, camera, UI, loop, debug hooks
// ============================================================================
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
const MAX_PR = Math.min(window.devicePixelRatio || 1, 2);
let pr = Math.min(MAX_PR, 1.5);
renderer.setPixelRatio(pr);
renderer.setSize(innerWidth, innerHeight, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.02;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
skyU.uPR.value = pr;

const camera = new THREE.PerspectiveCamera(36, innerWidth / innerHeight, 0.5, 900);
// frame the whole bottle (≈ 64 units incl. cork) for the current aspect ratio
function fitDistance() { return clamp(33 / (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * Math.min(camera.aspect, 2.2)), 52, 160); }
camera.position.set(19, 8, 45).sub(new THREE.Vector3(2.5, -2.4, 0)).setLength(fitDistance()).add(new THREE.Vector3(2.5, -2.4, 0));

// environment map for the room (brass, wax, lens) — baked from the dusk backdrop
{
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.add(makeBackdrop(true));
  const tbl = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshBasicMaterial({ color: 0x2c170b }));
  tbl.rotation.x = -Math.PI / 2; tbl.position.y = -6;
  envScene.add(tbl);
  roomScene.environment = pmrem.fromScene(envScene, 0.02).texture;
}

// ------------------------------------------------------------- post chain
class MultiScenePass extends Pass {
  constructor(scenes, cam) { super(); this.scenes = scenes; this.cam = cam; this.needsSwap = false; }
  render(r, writeBuffer, readBuffer) {
    const auto = r.autoClear; r.autoClear = false;
    r.setRenderTarget(this.renderToScreen ? null : readBuffer);
    r.setClearColor(0x000000, 1); r.clear(true, true, true);
    for (const s of this.scenes) r.render(s, this.cam);
    r.autoClear = auto;
  }
}
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 }));
composer.setPixelRatio(pr); composer.setSize(innerWidth, innerHeight);
composer.addPass(new MultiScenePass([roomScene, glassBackScene, interior, glassFrontScene], camera));
// safety net: a single NaN/Inf pixel would otherwise smear into a black block through the bloom mips
composer.addPass(new ShaderPass({
  uniforms: { tDiffuse: { value: null } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'uniform sampler2D tDiffuse; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); bvec4 bad = bvec4(isnan(c.r) || isinf(c.r), isnan(c.g) || isinf(c.g), isnan(c.b) || isinf(c.b), false); gl_FragColor = any(bad) ? vec4(0.0, 0.0, 0.0, 1.0) : vec4(clamp(c.rgb, 0.0, 200.0), 1.0); }',
}));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.5, 0.55, 0.9);
composer.addPass(bloom);
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uFlash: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float uTime; uniform float uFlash; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 q = vUv - 0.5;
      float vig = smoothstep(0.92, 0.22, length(q * vec2(1.0, 0.82)));
      c.rgb *= mix(0.4, 1.0, vig);
      c.rgb *= vec3(1.04, 0.99, 0.93);
      c.rgb += vec3(0.55, 0.65, 1.0) * uFlash * 0.05;
      float n = fract(sin(dot(vUv * 1000.0 + uTime, vec2(12.9898, 78.233))) * 43758.5453);
      c.rgb += (n - 0.5) * 0.014 * (c.rgb + 0.04);
      gl_FragColor = c;
    }`,
});
composer.addPass(grade);
composer.addPass(new OutputPass());

// ------------------------------------------------------------ day palettes
const PAL = {
  night:    { top: 0x040817, hor: 0x0e1834, a: 0.93, hs: 0x22325e, hg: 0x050b16, hi: 0.45, sh: 0x0a2438, dp: 0x010510, lo: 0x0a2640, mid: 0x123a58, hiC: 0x285878, refl: 0x0c1a38, lag: 0x0f3a48, night: 1, star: 1, cloud: 0.02 },
  predawn:  { top: 0x10183a, hor: 0x3a2d5a, a: 0.9, hs: 0x3a3a6a, hg: 0x0a0c18, hi: 0.52, sh: 0x0f2c44, dp: 0x02071a, lo: 0x0f2c48, mid: 0x1c4262, hiC: 0x3a5a80, refl: 0x2a2a50, lag: 0x17485a, night: 0.85, star: 0.6, cloud: 0.04 },
  dawn:     { top: 0x4a5fa6, hor: 0xff9a6a, a: 0.76, hs: 0x9a8ac0, hg: 0x2a2230, hi: 0.78, sh: 0x2a7890, dp: 0x07182e, lo: 0x123e5c, mid: 0x28688a, hiC: 0x6a98b8, refl: 0xff9a6a, lag: 0x4ab8b0, night: 0.25, star: 0.05, cloud: 0.18 },
  morning:  { top: 0x3d7fd8, hor: 0xa8d8f8, a: 0.62, hs: 0xa8ccff, hg: 0x24445a, hi: 1.0, sh: 0x2aa0ba, dp: 0x05254a, lo: 0x0f5a80, mid: 0x1f8fb0, hiC: 0x6fd3e0, refl: 0x7ab8ea, lag: 0x3fd0c0, night: 0, star: 0, cloud: 0.28 },
  noon:     { top: 0x2f78e0, hor: 0xc4e8ff, a: 0.56, hs: 0xc0dcff, hg: 0x2a4a5a, hi: 1.15, sh: 0x2eb0c8, dp: 0x06305a, lo: 0x0e6088, mid: 0x2098b8, hiC: 0x7fe0ea, refl: 0x8cc4f8, lag: 0x48dccc, night: 0, star: 0, cloud: 0.32 },
  dusk:     { top: 0x2e3a80, hor: 0xff7040, a: 0.74, hs: 0xc07890, hg: 0x2a1a20, hi: 0.74, sh: 0x2a6a88, dp: 0x0a1430, lo: 0x10304e, mid: 0x224e74, hiC: 0x5a7ea4, refl: 0xff8050, lag: 0x3a9aa0, night: 0.35, star: 0.05, cloud: 0.2 },
  twilight: { top: 0x121848, hor: 0x7a3468, a: 0.87, hs: 0x4a3a78, hg: 0x0e0a18, hi: 0.52, sh: 0x12304a, dp: 0x03081a, lo: 0x0c2440, mid: 0x183858, hiC: 0x3a5478, refl: 0x5a3060, lag: 0x1a5060, night: 0.8, star: 0.5, cloud: 0.06 },
};
const KEYS = [[0, 'night'], [4.4, 'night'], [5.3, 'predawn'], [6.3, 'dawn'], [8.2, 'morning'], [12, 'noon'], [15.4, 'morning'], [17.5, 'dusk'], [18.7, 'twilight'], [20.2, 'night'], [24, 'night']];
const COLOR_KEYS = ['top', 'hor', 'hs', 'hg', 'sh', 'dp', 'lo', 'mid', 'hiC', 'refl', 'lag'];
const PALC = {};
for (const k in PAL) { PALC[k] = {}; for (const f in PAL[k]) PALC[k][f] = COLOR_KEYS.includes(f) ? new THREE.Color(PAL[k][f]) : PAL[k][f]; }
const cur = {}; for (const f of COLOR_KEYS) cur[f] = new THREE.Color();
const STORM = { top: new THREE.Color(0x2a3140), hor: new THREE.Color(0x3a4350), sh: new THREE.Color(0x2c4a52), dp: new THREE.Color(0x03080c), sea: new THREE.Color(0x3a5058), hs: new THREE.Color(0x6a7888) };
const tmpC = new THREE.Color(), sunCol = new THREE.Color();

const state = { hour: 17.0, speed: 4, storm: 0, held: false, time: 0, hudHidden: false };
const HOURS_PER_SEC = 24 / 480;             // ×1: one in-bottle day lasts 8 minutes

function samplePalette(h) {
  let i = 0;
  while (i < KEYS.length - 2 && h >= KEYS[i + 1][0]) i++;
  const [h0, a] = KEYS[i], [h1, b] = KEYS[i + 1];
  const t = smooth(0, 1, (h - h0) / (h1 - h0));
  const A = PALC[a], B = PALC[b];
  for (const f of COLOR_KEYS) cur[f].copy(A[f]).lerp(B[f], t);
  for (const f of ['a', 'hi', 'night', 'star', 'cloud']) cur[f] = lerp(A[f], B[f], t);
  return cur;
}

function applyTimeOfDay(dt) {
  const h = state.hour, s = U.uStorm.value, P = samplePalette(h);
  // sun & moon arcs (sunrise over the neck, sunset at the bottle's foot)
  const ang = (h - 6) / 24 * TAU;
  sky.posAt(ang, sky.sunPos); sky.posAt(ang + Math.PI, sky.moonPos);
  sky.sunM.position.copy(sky.sunPos); sky.sunGlow.position.copy(sky.sunPos);
  sky.moonM.position.copy(sky.moonPos); sky.moonGlow.position.copy(sky.moonPos);
  sky.moonM.rotation.y = 0.6;
  const sE = Math.sin(ang), mE = -sE;
  const clear = 1 - 0.8 * s;
  sunCol.setHex(0xff5a28).lerp(tmpC.setHex(0xfff2e2), smooth(0.02, 0.55, sE));
  inL.sun.color.copy(sunCol);
  inL.sun.intensity = 3.3 * smooth(-0.06, 0.26, sE) * clear;
  inL.sun.position.copy(sky.sunPos).sub(inL.tgt.position).normalize().multiplyScalar(40).add(inL.tgt.position);
  inL.moon.intensity = 0.55 * smooth(-0.02, 0.3, mE) * clear;
  inL.moon.position.copy(sky.moonPos).sub(inL.tgt.position).normalize().multiplyScalar(40).add(inL.tgt.position);
  sky.sunGlow.material.uniforms.uI.value = smooth(-0.12, 0.05, sE) * clear * (1.0 + 0.6 * (1 - smooth(0.1, 0.5, sE)));
  sky.sunGlow.material.uniforms.uColor.value.copy(sunCol);
  sky.moonGlow.material.uniforms.uI.value = 0.55 * smooth(-0.1, 0.1, mE) * clear;
  sky.sunM.visible = sE > -0.2; sky.moonM.visible = mE > -0.2;

  // storm grading
  const top = P.top.clone().lerp(STORM.top, 0.82 * s), hor = P.hor.clone().lerp(STORM.hor, 0.82 * s);
  skyU.uSkyTop.value.copy(top); skyU.uSkyHor.value.copy(hor);
  skyU.uSunCol.value.copy(sunCol).multiplyScalar(smooth(-0.15, 0.1, sE));
  skyU.uSunPos.value.copy(sky.sunPos); skyU.uMoonPos.value.copy(sky.moonPos);
  skyU.uSkyA.value = lerp(P.a, 0.93, s);
  skyU.uStarA.value = P.star * (1 - s);
  inL.hemi.color.copy(P.hs).lerp(STORM.hs, 0.6 * s);
  inL.hemi.groundColor.copy(P.hg);
  inL.hemi.intensity = P.hi * (1 - 0.3 * s) + U.uFlash.value * 0.9;
  inL.flash.intensity = U.uFlash.value * 4.5;
  U.uWaterShallow.value.copy(P.sh).lerp(STORM.sh, 0.6 * s);
  U.uWaterDeep.value.copy(P.dp).lerp(STORM.dp, 0.5 * s);
  U.uSunUp.value = smooth(-0.05, 0.3, sE) * clear + 0.25 * smooth(0, 0.3, mE);
  WU.uSeaLo.value.copy(P.lo).lerp(STORM.sea, 0.45 * s).multiplyScalar(1 - 0.35 * s);
  WU.uSeaMid.value.copy(P.mid).lerp(STORM.sea, 0.55 * s);
  WU.uSeaHi.value.copy(P.hiC).lerp(STORM.sea, 0.5 * s);
  WU.uSkyRefl.value.copy(P.refl).lerp(top, 0.55).multiplyScalar(0.6 * (1 - 0.6 * s));
  WU.uLagoon.value.copy(P.lag).lerp(STORM.sea, 0.5 * s);
  cloudU.uCloudSelf.value = P.cloud * (1 - 0.7 * s);
  cloudU.uCloudTint.value.copy(hor).lerp(sunCol, 0.35 * smooth(-0.1, 0.3, sE)).lerp(tmpC.setRGB(1, 1, 1), 0.35);

  // warm lights at night (and a little in the storm)
  const night = P.night, nd = Math.max(night, s * 0.6);
  U.uGlow.value = 0.5 + 2.7 * night + 0.8 * s;
  inL.lamp.intensity = 2 + 34 * nd;
  inL.hut.intensity = 0.5 + 9 * night;
  inL.dock.intensity = 0.4 + 7 * night;
  inL.chest.intensity = (3 + 5 * night) * (0.8 + 0.2 * Math.sin(state.time * 2.3));
  chestGlow.material.uniforms.uI.value = (0.35 + 0.4 * night) * (0.85 + 0.15 * Math.sin(state.time * 2.3));
  beams.lampGlow.material.uniforms.uI.value = 0.35 + 0.9 * nd;
  for (const g of ship.group.children) if (g.material && g.material.uniforms && g.material.uniforms.uI) g.material.uniforms.uI.value = 0.15 + 0.7 * night;
  buoy.glow.material.uniforms.uI.value = (Math.sin(state.time * 3.2) > 0.55 ? 1 : 0.05) * (0.35 + 0.8 * nd);
  beams.update(dt, 0.05 + 0.55 * nd + 0.1 * (1 - smooth(-0.1, 0.4, sE)));
  glassU.uBeamI.value = (0.05 + 0.6 * nd) * 0.9;

  // light spilling from the bottle onto the table; glass inner glow
  const day = smooth(-0.1, 0.4, sE) * clear;
  tmpC.copy(hor).lerp(sunCol, 0.35 * day);
  roomLights.glow.color.copy(tmpC).lerp(tmpC.setHex(0xffb060), night * 0.6);
  roomLights.glow.intensity = 25 + 70 * day + 25 * night + U.uFlash.value * 260;
  glassU.uInnerCol.value.copy(hor);
  glassU.uInnerI.value = 0.25 + 0.75 * day;
  glassU.uFlashG.value = U.uFlash.value;
  grade.uniforms.uFlash.value = U.uFlash.value;
}

// ------------------------------------------------------- bottle rocking
const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
const AX = new THREE.Vector3(1, 0, 0), AZ = new THREE.Vector3(0, 0, 1), AY = new THREE.Vector3(0, 1, 0);
const knotLocal = tag.group.position.clone();
const knotW = new THREE.Vector3(), knotPrev = new THREE.Vector3(), knotVel = new THREE.Vector3(), knotAcc = new THREE.Vector3();
let knotInit = false;
function updateRig(dt, now) {
  const a = smooth(0, 1, U.uStorm.value);
  const roll = a * (0.078 * Math.sin(now * 1.35) + 0.032 * Math.sin(now * 3.1 + 1.2) + 0.012 * Math.sin(now * 7.7));
  const pitch = a * (0.03 * Math.sin(now * 0.95 + 0.5) + 0.011 * Math.sin(now * 2.4)) + a * a * 0.0025 * Math.sin(now * 31);
  const yaw = a * 0.008 * Math.sin(now * 0.7 + 2);
  qa.setFromAxisAngle(AZ, pitch);
  rig.quat.copy(qa).multiply(qb.setFromAxisAngle(AX, roll)).multiply(_q.setFromAxisAngle(AY, yaw));
  rig.pos.copy(PIVOT).negate().applyQuaternion(qa).add(PIVOT);
  rig.pos.z += -roll * 0.9; rig.pos.y += Math.abs(roll) * 0.2;
  applyRig();

  // the paper tag swings as a damped pendulum in world space
  knotW.copy(knotLocal).applyMatrix4(rig.matrix);
  if (!knotInit) { knotPrev.copy(knotW); knotInit = true; }
  const v = _v3.copy(knotW).sub(knotPrev).divideScalar(Math.max(dt, 1e-4));
  knotAcc.copy(v).sub(knotVel).divideScalar(Math.max(dt, 1e-4)).clampLength(0, 60);
  knotVel.copy(v); knotPrev.copy(knotW);
  const k = 13, c = 1.6, Lp = 2.8;
  tag.vx += (knotAcc.z / Lp - k * tag.ax - c * tag.vx) * dt;
  tag.vz += (-knotAcc.x / Lp - k * tag.az - c * tag.vz) * dt;
  tag.ax += tag.vx * dt; tag.az += tag.vz * dt;
  tag.ax = clamp(tag.ax, -0.9, 0.9); tag.az = clamp(tag.az, -0.9, 0.9);
  _e.set(tag.ax, 0, tag.az);
  tag.group.quaternion.copy(rig.quat).invert().multiply(_q.setFromEuler(_e));
}

// ----------------------------------------------------------- controls
const controls = new OrbitControls(camera, canvas);
controls.target.set(2.5, -2.4, 0);
controls.enableDamping = true; controls.dampingFactor = 0.06;
controls.enablePan = false;
controls.minDistance = 17; controls.maxDistance = Math.max(95, fitDistance() * 1.25);
controls.minPolarAngle = 0.12; controls.maxPolarAngle = 1.62;
controls.rotateSpeed = 0.55; controls.zoomSpeed = 0.9;
controls.autoRotate = true; controls.autoRotateSpeed = 0;
let interacting = false, lastInput = -10;
controls.addEventListener('start', () => { interacting = true; });
controls.addEventListener('end', () => { interacting = false; lastInput = state.time; });
const camLocal = new THREE.Vector3(), camDir = new THREE.Vector3();
function outsideBottle(p) {
  camLocal.copy(p).applyMatrix4(U.uBottleInv.value);
  const x = camLocal.x, r = Math.hypot(camLocal.y, camLocal.z);
  if (x < GLASS_OUT.xb - 2 || x > 31.5) return true;
  const ro = x > LIP_X - 1.5 ? 5.2 : profR(GLASS_OUT, clamp(x, GLASS_OUT.xb, LIP_X)) ;
  return r > (ro < 0 ? 0 : ro) + 2.2;
}
function constrainCamera() {
  // never enter the glass; never sink below the table top
  if (!outsideBottle(camera.position)) {
    camDir.copy(camera.position).sub(controls.target).normalize();
    let d = camera.position.distanceTo(controls.target);
    for (let i = 0; i < 60 && !outsideBottle(_v3.copy(camDir).multiplyScalar(d).add(controls.target)); i++) d += 0.8;
    camera.position.copy(camDir).multiplyScalar(d).add(controls.target);
  }
  if (camera.position.y < TABLE_Y + 2.2) camera.position.y = TABLE_Y + 2.2;
}

// ---------------------------------------------------------------- UI
const $ = (id) => document.getElementById(id);
const ui = { time: $('time'), phase: $('phase'), bar: $('stormBar'), stxt: $('stormTxt'), storm: $('storm'), fps: $('fps'), hud: $('hud'), dial: $('dial') };
const dctx = ui.dial.getContext('2d');
const SPEEDS = [4, 12, 1, 0];
function setSpeed(s) {
  state.speed = s;
  document.querySelectorAll('#speed button').forEach((b) => b.classList.toggle('on', +b.dataset.s === s));
}
document.querySelectorAll('#speed button').forEach((b) => b.addEventListener('click', () => { setSpeed(+b.dataset.s); b.blur(); canvas.focus(); }));
setSpeed(4);
const holdStorm = (v) => { state.held = v; ui.storm.classList.toggle('active', v); };
addEventListener('keydown', (e) => {
  if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) holdStorm(true); }
  else if (e.code === 'KeyT') setSpeed(SPEEDS[(SPEEDS.indexOf(state.speed) + 1) % SPEEDS.length]);
  else if (e.code === 'KeyH') { state.hudHidden = !state.hudHidden; ui.hud.classList.toggle('hidden', state.hudHidden); }
  else if (e.code === 'KeyB') whale.breach();
});
addEventListener('keyup', (e) => { if (e.code === 'Space') { e.preventDefault(); holdStorm(false); } });
addEventListener('blur', () => holdStorm(false));
ui.storm.addEventListener('pointerdown', (e) => { e.preventDefault(); ui.storm.setPointerCapture(e.pointerId); holdStorm(true); });
for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) ui.storm.addEventListener(ev, () => holdStorm(false));

const PHASES = [[4.5, '子夜', 'Midnight'], [8, '黎明', 'Dawn'], [16.5, '正午', 'Noon'], [20.5, '黄昏', 'Dusk'], [24, '子夜', 'Midnight']];
let lastPhase = '';
function drawDial() {
  const W = ui.dial.width, c = dctx, R = W * 0.4, cx = W / 2, cy = W / 2;
  c.clearRect(0, 0, W, W);
  const g = c.createLinearGradient(0, 0, 0, W); g.addColorStop(0, '#f0c070'); g.addColorStop(0.5, 'rgba(232,192,122,.5)'); g.addColorStop(1, '#6a86c8');
  c.lineWidth = 3; c.strokeStyle = 'rgba(245,234,216,.14)'; c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.stroke();
  c.strokeStyle = g; c.lineWidth = 2; c.beginPath(); c.arc(cx, cy, R, Math.PI, TAU); c.stroke();
  c.strokeStyle = 'rgba(245,234,216,.3)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(cx - R - 8, cy); c.lineTo(cx + R + 8, cy); c.stroke();
  for (let i = 0; i < 24; i++) { const a = i / 24 * TAU; const l = i % 6 === 0 ? 8 : 4; c.strokeStyle = 'rgba(245,234,216,.35)'; c.beginPath(); c.moveTo(cx + Math.cos(a) * (R - l), cy + Math.sin(a) * (R - l)); c.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); c.stroke(); }
  const ang = (state.hour - 6) / 24 * TAU;          // 0 = east horizon, rising counter-clockwise on screen
  const sx = cx + Math.cos(ang) * R, sy = cy - Math.sin(ang) * R;
  const mx = cx + Math.cos(ang + Math.PI) * R, my = cy - Math.sin(ang + Math.PI) * R;
  c.fillStyle = '#cfe0ff'; c.beginPath(); c.arc(mx, my, 6, 0, TAU); c.fill();
  c.fillStyle = 'rgba(22,14,10,.9)'; c.beginPath(); c.arc(mx + 3, my - 2, 5, 0, TAU); c.fill();
  const sg = c.createRadialGradient(sx, sy, 0, sx, sy, 16); sg.addColorStop(0, 'rgba(255,214,120,1)'); sg.addColorStop(0.45, 'rgba(255,170,60,.55)'); sg.addColorStop(1, 'rgba(255,150,40,0)');
  c.fillStyle = sg; c.beginPath(); c.arc(sx, sy, 16, 0, TAU); c.fill();
  c.fillStyle = '#ffe2a0'; c.beginPath(); c.arc(sx, sy, 6, 0, TAU); c.fill();
}
function updateUI() {
  const h = state.hour, hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
  ui.time.textContent = String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
  const ph = PHASES.find((p) => h < p[0]);
  if (ph[1] + ph[2] !== lastPhase) { lastPhase = ph[1] + ph[2]; ui.phase.innerHTML = `${ph[1]}<small>${ph[2]}</small>`; }
  const s = state.storm;
  ui.bar.style.width = (s * 100).toFixed(1) + '%';
  ui.stxt.textContent = s < 0.02 ? 'calm' : s < 0.45 ? 'rising' : s < 0.9 ? 'gale' : 'tempest';
  drawDial();
}

// ----------------------------------------------------------------- loop
function resize() {
  const w = innerWidth, h = innerHeight;
  camera.aspect = w / h; camera.updateProjectionMatrix();
  renderer.setPixelRatio(pr); renderer.setSize(w, h, false);
  composer.setPixelRatio(pr); composer.setSize(w, h);
  skyU.uPR.value = pr;
  controls.maxDistance = Math.max(95, fitDistance() * 1.25);
}
addEventListener('resize', resize);

function tick(dt) {
  state.time += dt;
  const now = state.time;
  U.uTime.value = now; grade.uniforms.uTime.value = now % 100;
  state.storm = state.held ? Math.min(1, state.storm + dt * 0.55) : Math.max(0, state.storm - dt * 0.24);
  const s = state.storm;
  U.uStorm.value = s * s * (3 - 2 * s);
  U.uWaveT.value += dt * (1 + 1.25 * U.uStorm.value);
  state.hour = (state.hour + dt * state.speed * HOURS_PER_SEC) % 24;

  updateRig(dt, now);
  lightning.update(dt);
  applyTimeOfDay(dt);
  clouds.update(dt);
  updateShip(dt, now);
  gulls(dt, now);
  whale.update(dt, now);
  fish(dt, now);
  crabs(dt, now);
  updateFloater(dinghy.f, dt, now, 0.12);
  updateFloater(buoy.f, dt, now, 0);
  buoy.glow.position.set(0, 1.0, 0).applyMatrix4(buoy.f.g.matrixWorld);
  {
    const pos = dinghy.rope.geometry.attributes.position;
    _v3.set(0.75, 0.12, 0).applyMatrix4(dinghy.f.g.matrixWorld);
    pos.setXYZ(0, _v3.x, _v3.y, _v3.z); pos.setXYZ(1, DOCK_END.x - 0.2, WATER_Y + 0.55, DOCK_END.z - 0.45); pos.needsUpdate = true;
  }
  rain.visible = U.uStorm.value > 0.2;
  updateEmitters(dt, now);
  particles.update(dt, now);
  roomLights.compassNeedle.rotation.y = 0.5 + Math.sin(now * 0.8) * 0.05 + U.uStorm.value * Math.sin(now * 6) * 0.3;

  const idle = !interacting && now - lastInput > 4;
  controls.autoRotateSpeed = lerp(controls.autoRotateSpeed, idle ? 0.32 : 0, Math.min(1, dt * 1.2));
  controls.update(dt);
  constrainCamera();
  for (const g of glows) g.quaternion.copy(camera.quaternion);
}

let last = performance.now(), frames = 0, acc = 0, fpsT = 0, slow = 0, fast = 0, started = false;
function render() { renderer.info.reset(); composer.render(); }
function frame(t) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, Math.max(0.0005, (t - last) / 1000));
  last = t;
  tick(dt);
  render();
  if (!started) {
    started = true; window.__bottleStarted = true;
    setTimeout(() => $('loader').classList.add('gone'), 250);
  }
  // FPS readout + adaptive resolution
  frames++; acc += dt; fpsT += dt;
  if (fpsT > 0.5) {
    const fps = frames / acc;
    ui.fps.textContent = `${fps.toFixed(0)} fps · ${pr.toFixed(2)}x\n${renderer.info.render.calls} draws`;
    if (fps < 48) { slow++; fast = 0; } else if (fps > 58) { fast++; slow = 0; } else { slow = fast = 0; }
    if (slow >= 3 && pr > 0.75) { pr = Math.max(0.75, pr - 0.25); resize(); slow = 0; }
    if (fast >= 10 && pr < Math.min(MAX_PR, 1.5)) { pr = Math.min(Math.min(MAX_PR, 1.5), pr + 0.25); resize(); fast = 0; }
    frames = 0; acc = 0; fpsT = 0;
    updateUI();
  }
}
renderer.info.autoReset = false;
updateUI();
requestAnimationFrame(frame);

// ------------------------------------------------------------ debug hooks
window.BOTTLE = {
  step(n = 1, dt = 1 / 60) { for (let i = 0; i < n; i++) tick(dt); render(); return state.hour.toFixed(2); },
  setHour(h) { state.hour = ((h % 24) + 24) % 24; },
  setSpeed, breach: () => whale.breach(), strike: () => lightning.strike(),
  storm(v) { if (v === null || v === undefined) { state.held = false; } else { state.storm = v; state.held = v > 0; } },
  cam(p, t) { camera.position.set(...p); if (t) controls.target.set(...t); controls.update(); },
  snap(q = 0.85) { render(); return canvas.toDataURL('image/jpeg', q); },
  info() { return { pr, calls: renderer.info.render.calls, tris: renderer.info.render.triangles, particles: particles.n, island: islandMesh.count, relics: bottomMesh.count, sea: sea.count }; },
  state, U, camera, controls, ship, whale, renderer, composer, bloom, THREE,
  scenes: { roomScene, glassBackScene, interior, glassFrontScene },
};
