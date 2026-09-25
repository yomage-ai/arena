import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { buildWorld } from './terrain.js';
import { Rover } from './rover.js';
import { Sky, makeEnvironment } from './sky.js';
import { Tracks, Dust } from './effects.js';

const $ = (id) => document.getElementById(id);
const tick = () => new Promise((r) => setTimeout(r, 0));
const progress = (f, msg) => {
  $('bar').style.transform = `scaleX(${Math.max(0.02, f)})`;
  if (msg) $('step').textContent = msg;
};
const deg = THREE.MathUtils.degToRad;
const E = 5.2; // solar irradiance scale shared by every lighting model in the scene

// bearing: degrees clockwise from north (-Z); elevation above horizon
function dirFrom(bearing, elev, out = new THREE.Vector3()) {
  const b = deg(bearing), e = deg(elev);
  return out.set(Math.sin(b) * Math.cos(e), Math.sin(e), -Math.cos(b) * Math.cos(e)).normalize();
}
const bearingOf = (v) => (THREE.MathUtils.radToDeg(Math.atan2(v.x, -v.z)) + 360) % 360;

const QUALITY = {
  high: { pr: Math.min(devicePixelRatio, 2), shadow: 4096, samples: 4 },
  mid: { pr: Math.min(devicePixelRatio, 1.5), shadow: 4096, samples: 4 },
  low: { pr: 1, shadow: 2048, samples: 2 },
};

async function main() {
  const canvas = $('scene');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  } catch (e) {
    throw new Error('此浏览器无法创建 WebGL2 上下文。请在桌面版 Chrome、Edge、Safari 或 Firefox 中打开。');
  }
  let quality = 'high';
  renderer.setPixelRatio(QUALITY[quality].pr);
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.04, 30000);

  progress(0.02, '初始化渲染器');
  await tick();
  const world = await buildWorld(progress);
  scene.add(world.group, world.rocks);
  const { heightAt, normalAt, path } = world;

  progress(0.88, '装配巡视器');
  try { await document.fonts.ready; } catch (e) { /* fonts are optional */ }
  await tick();
  const rover = new Rover();
  scene.add(rover.root);
  const sky = new Sky();
  scene.add(sky.group);
  const tracks = new Tracks();
  scene.add(tracks.group);
  const dust = new Dust();
  scene.add(dust.points);

  /* ---------------- lights: one sun, two shadow cascades ---------------- */
  const sunNear = new THREE.DirectionalLight(0xfff5e8, E);
  sunNear.castShadow = true;
  sunNear.shadow.mapSize.set(4096, 4096);
  Object.assign(sunNear.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 500 });
  sunNear.shadow.bias = -0.0002;
  sunNear.shadow.normalBias = 0.012;
  sunNear.shadow.radius = 1.5;
  scene.add(sunNear, sunNear.target);

  const sunFar = new THREE.DirectionalLight(0xffffff, 0);
  sunFar.castShadow = true;
  sunFar.shadow.mapSize.set(4096, 4096);
  Object.assign(sunFar.shadow.camera, { left: -2400, right: 2400, top: 2400, bottom: -2400, near: 10, far: 12000 });
  sunFar.shadow.bias = -0.0004;
  sunFar.shadow.normalBias = 1.6;
  sunFar.shadow.autoUpdate = false;
  scene.add(sunFar, sunFar.target);

  /* ---------------- initial pose, sun and earth placement ---------------- */
  let s = 4;
  const ps0 = path.sample(s);
  const fwd0 = new THREE.Vector3(Math.cos(ps0.heading), 0, -Math.sin(ps0.heading));
  const right0 = new THREE.Vector3(Math.sin(ps0.heading), 0, Math.cos(ps0.heading));
  // default camera looks at the rover from its front-left; place Earth and Sun relative to that view
  const viewDir = fwd0.clone().multiplyScalar(-2.9).addScaledVector(right0, 2.5).normalize();
  const viewBearing = bearingOf(viewDir);
  const earthDir = dirFrom(viewBearing - 12, 10.5);
  sky.setEarth(earthDir);
  const sunState = { el: 11, az: Math.round((viewBearing + 112) % 360) };
  $('sunAz').value = sunState.az;
  const sunDir = new THREE.Vector3();

  let envRT = null, envTimer = 0;
  function rebuildEnv() {
    const rt = makeEnvironment(renderer, sunDir, E);
    scene.environment = rt.texture;
    if (envRT) envRT.dispose();
    envRT = rt;
  }
  function applySun(immediateEnv = false) {
    dirFrom(sunState.az, sunState.el, sunDir);
    sky.setSun(sunDir, E);
    world.material.uniforms.uSunDir.value.copy(sunDir);
    world.material.uniforms.uSunColor.value.setRGB(1, 0.965, 0.92).multiplyScalar(E);
    tracks.material.uniforms.uSunDir.value.copy(sunDir);
    const dl = 0.14 * E / Math.PI * (0.35 + 0.65 * Math.max(0.05, sunDir.y) * 2.2);
    dust.material.uniforms.uColor.value.setRGB(dl, dl * 0.975, dl * 0.94);
    sunFar.position.copy(sunDir).multiplyScalar(5500);
    sunFar.target.position.set(0, 0, 0);
    sunFar.updateMatrixWorld();
    sunFar.target.updateMatrixWorld();
    sunFar.shadow.needsUpdate = true;
    $('sunElOut').textContent = `${sunState.el.toFixed(sunState.el % 1 ? 1 : 0)}°`;
    $('sunAzOut').textContent = `${Math.round(sunState.az)}°`;
    clearTimeout(envTimer);
    if (immediateEnv) rebuildEnv();
    else envTimer = setTimeout(rebuildEnv, 120);
  }
  applySun(true);

  /* ---------------- post-processing ---------------- */
  let composer, bloom, grade;
  function buildComposer() {
    const q = QUALITY[quality];
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: q.samples });
    if (composer) composer.dispose();
    composer = new EffectComposer(renderer, rt);
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(innerWidth, innerHeight);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.3, 0.55, 1.6);
    bloom.enabled = $('tBloom').getAttribute('aria-pressed') === 'true';
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    grade = new ShaderPass({
      uniforms: { tDiffuse: { value: null }, uTime: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime; varying vec2 vUv;
        void main(){ vec4 c = texture2D(tDiffuse, vUv);
          vec2 d = (vUv - 0.5) * vec2(1.0, 0.82);
          c.rgb *= mix(0.7, 1.0, smoothstep(0.78, 0.18, length(d)));
          float n = fract(sin(dot(vUv * 1000.0 + uTime, vec2(12.9898, 78.233))) * 43758.5453);
          c.rgb += (n - 0.5) * 0.012;
          gl_FragColor = c; }`,
    });
    composer.addPass(grade);
  }
  function setQuality(q) {
    quality = q;
    const Q = QUALITY[q];
    renderer.setPixelRatio(Q.pr);
    renderer.setSize(innerWidth, innerHeight);
    if (sunNear.shadow.mapSize.x !== Q.shadow) {
      sunNear.shadow.mapSize.set(Q.shadow, Q.shadow);
      sunNear.shadow.map?.dispose();
      sunNear.shadow.map = null;
    }
    buildComposer();
  }
  buildComposer();

  /* ---------------- camera & controls ---------------- */
  const controls = new OrbitControls(camera, canvas);
  Object.assign(controls, {
    enableDamping: true, dampingFactor: 0.07, minDistance: 0.6, maxDistance: 450,
    rotateSpeed: 0.55, zoomSpeed: 0.9, panSpeed: 0.8, screenSpacePanning: false,
    maxPolarAngle: Math.PI * 0.56,
  });
  controls.keys = {}; // WASD handled below

  const VIEWS = {
    follow: { cam: [2.9, -0.28, -2.5], look: [0, -0.05, 0] },
    chase: { cam: [-3.8, 0.75, -1.6], look: [0.6, -0.05, 0] },
    wheel: { cam: [1.3, -0.24, -1.55], look: [0.38, -0.32, -0.6] },
    side: { cam: [0.1, 0.05, 4.4], look: [0, -0.02, 0] },
    top: { cam: [-0.6, 9.5, 0.01], look: [0, -0.2, 0] },
    wide: { cam: [-24, 5, -30], look: [0, 0, 0] },
  };
  let view = 'follow';
  let follow = true;
  let transition = null;
  const lastRoverPos = new THREE.Vector3();
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();

  const roverToWorld = (arr, out) => {
    const r = rover.root;
    const h = r.rotation.y;
    const f = tmpA.set(Math.cos(h), 0, -Math.sin(h));
    const rt = tmpB.set(Math.sin(h), 0, Math.cos(h));
    return out.copy(r.position).addScaledVector(f, arr[0]).addScaledVector(rt, arr[2]).add(new THREE.Vector3(0, arr[1], 0));
  };

  // pull close-range presets back on narrow/portrait viewports so the rover stays in frame
  const fitCam = (v, name) => {
    if (name === 'top' || name === 'wide') return v.cam;
    const f = THREE.MathUtils.clamp(1.45 / camera.aspect, 1, 1.9);
    return v.cam.map((c, i) => v.look[i] + (c - v.look[i]) * f);
  };

  function setView(name, instant = false) {
    view = name;
    document.querySelectorAll('.views button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === name)));
    if (name === 'free') { follow = false; transition = null; return; }
    follow = true;
    const v = VIEWS[name];
    if (instant) {
      roverToWorld(fitCam(v, name), camera.position);
      roverToWorld(v.look, controls.target);
      transition = null;
      return;
    }
    transition = { t: 0, dur: 1.9, fromCam: camera.position.clone(), fromLook: controls.target.clone(), v: { cam: fitCam(v, name), look: v.look } };
  }
  document.querySelectorAll('.views button').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
  controls.addEventListener('start', () => { transition = null; });

  // double-click: march the view ray over the heightfield and refocus there
  canvas.addEventListener('dblclick', (ev) => {
    const ndc = new THREE.Vector2((ev.clientX / innerWidth) * 2 - 1, -(ev.clientY / innerHeight) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObject(rover.root, true);
    let point = null;
    if (hits.length) point = hits[0].point;
    else {
      const o = ray.ray.origin, d = ray.ray.direction;
      let t = 0.2;
      while (t < 4000) {
        const p = tmpA.copy(o).addScaledVector(d, t);
        if (p.y < heightAt(p.x, p.z)) { point = p.clone(); break; }
        t += Math.max(0.03, t * 0.008);
      }
    }
    if (!point) return;
    setView('free');
    const offset = camera.position.clone().sub(controls.target);
    const dist = Math.min(offset.length(), Math.max(3, point.distanceTo(camera.position) * 0.5));
    offset.setLength(dist);
    transition = { t: 0, dur: 1.4, fromCam: camera.position.clone(), fromLook: controls.target.clone(), toCam: point.clone().add(offset), toLook: point.clone() };
  });

  // keyboard roaming
  const keys = new Set();
  addEventListener('keydown', (e) => {
    if (e.target.closest('input, select')) return;
    const k = e.key.toLowerCase();
    if (k === ' ') { e.preventDefault(); togglePlay(); return; }
    if ('wasdqe'.includes(k) || e.key.startsWith('Arrow')) {
      keys.add(e.key.startsWith('Arrow') ? e.key : k);
      if (view !== 'free') setView('free');
      e.preventDefault();
    }
  });
  addEventListener('keyup', (e) => keys.delete(e.key.startsWith('Arrow') ? e.key : e.key.toLowerCase()));
  addEventListener('blur', () => keys.clear());

  /* ---------------- UI wiring ---------------- */
  let paused = false, speedMul = 1;
  function togglePlay() {
    paused = !paused;
    $('play').textContent = paused ? '继续行驶' : '暂停行驶';
    $('play').setAttribute('aria-pressed', String(paused));
  }
  $('play').addEventListener('click', togglePlay);
  $('speed').addEventListener('input', (e) => {
    speedMul = parseFloat(e.target.value);
    $('speedOut').textContent = `${speedMul}×`;
  });
  $('sunEl').addEventListener('input', (e) => { sunState.el = parseFloat(e.target.value); applySun(); });
  $('sunAz').addEventListener('input', (e) => { sunState.az = parseFloat(e.target.value); applySun(); });
  const chip = (id, fn) => $(id).addEventListener('click', () => {
    const on = $(id).getAttribute('aria-pressed') !== 'true';
    $(id).setAttribute('aria-pressed', String(on));
    fn(on);
  });
  chip('tStars', (on) => sky.setStars(on));
  chip('tDust', (on) => { dust.enabled = on; dust.points.visible = on; });
  chip('tBloom', (on) => { bloom.enabled = on; });
  chip('tTracks', (on) => { tracks.group.visible = on; });
  let autoQuality = true;
  $('quality').addEventListener('change', (e) => {
    autoQuality = e.target.value === 'auto';
    setQuality(autoQuality ? 'high' : e.target.value);
  });
  $('panelToggle').addEventListener('click', () => {
    const open = $('controls').classList.toggle('open');
    $('panelToggle').setAttribute('aria-expanded', String(open));
    $('panelToggle').textContent = open ? '收起' : '控制';
  });

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    composer.setSize(innerWidth, innerHeight);
  });

  /* ---------------- drive state ---------------- */
  const BASE_SPEED = 0.16; // m/s
  let v = 0, odo = 0, simTime = 0;
  let imaging = false, holdTimer = 0, nextStop = s + 26;
  const fwd = new THREE.Vector3();
  let dustAcc = 0;

  // first pose
  let ps = path.sample(s);
  rover.update(0.016, ps, 0, heightAt, sunDir, earthDir, 0, false);
  lastRoverPos.copy(rover.root.position);
  setView('follow', true);
  controls.update();

  // near-shadow frustum follows the focus point, snapped to shadow texels
  const lightBasis = new THREE.Matrix4(), lightInv = new THREE.Matrix4(), ORIGIN = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  function updateNearShadow(center) {
    lightBasis.lookAt(sunDir, ORIGIN, UP);
    lightInv.copy(lightBasis).transpose();
    const texel = (sunNear.shadow.camera.right - sunNear.shadow.camera.left) / sunNear.shadow.mapSize.x;
    const p = tmpA.copy(center).applyMatrix4(lightInv);
    p.x = Math.round(p.x / texel) * texel;
    p.y = Math.round(p.y / texel) * texel;
    p.applyMatrix4(lightBasis);
    sunNear.target.position.copy(p);
    sunNear.position.copy(p).addScaledVector(sunDir, 250);
  }

  progress(0.94, '编译着色器');
  await tick();
  updateNearShadow(controls.target);
  try { await renderer.compileAsync(scene, camera); } catch (e) { /* older drivers: compile lazily */ }
  progress(1, '着陆完成');
  composer.render();
  setTimeout(() => $('loader').classList.add('done'), 250);

  /* ---------------- loop ---------------- */
  const clock = new THREE.Clock();
  let hudT = 0, fpsFrames = 0, fpsT = 0, fpsChecks = 0;
  const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    const sdt = paused ? 0 : dt * speedMul;
    simTime += sdt;

    // drive with periodic stops for panoramic imaging
    let target = BASE_SPEED;
    if (imaging) {
      target = 0;
      holdTimer -= sdt;
      if (holdTimer <= 0) { imaging = false; nextStop = s + 22 + Math.random() * 26; }
    } else if (s >= nextStop) { imaging = true; holdTimer = 16; }
    const acc = 0.06 * sdt;
    v += THREE.MathUtils.clamp(target - v, -acc, acc);
    const ds = v * sdt;
    s += ds;
    odo += ds;
    ps = path.sample(s);
    rover.update(sdt, ps, ds, heightAt, sunDir, earthDir, simTime, imaging);

    // tracks & dust from the wheel contacts
    fwd.set(Math.cos(ps.heading), 0, -Math.sin(ps.heading));
    if (ds > 0) {
      tracks.push(0, rover.contacts[2], fwd, heightAt, normalAt);
      tracks.push(1, rover.contacts[5], fwd, heightAt, normalAt);
      dustAcc += ds * 55;
      const n = Math.floor(dustAcc);
      dustAcc -= n;
      for (let k = 0; k < n; k++) {
        const w = rover.contacts[Math.floor(Math.random() * 6)];
        dust.emit(w, fwd, v, 1);
      }
    }
    if (sdt > 0) dust.update(sdt, heightAt);

    // camera follow / transitions / roaming
    const delta = tmpB.copy(rover.root.position).sub(lastRoverPos);
    lastRoverPos.copy(rover.root.position);
    if (transition) {
      transition.t += dt / transition.dur;
      const k = easeIO(Math.min(1, transition.t));
      const toCam = transition.toCam || roverToWorld(transition.v.cam, new THREE.Vector3());
      const toLook = transition.toLook || roverToWorld(transition.v.look, new THREE.Vector3());
      camera.position.lerpVectors(transition.fromCam, toCam, k);
      controls.target.lerpVectors(transition.fromLook, toLook, k);
      if (transition.t >= 1) transition = null;
    } else if (follow) {
      camera.position.add(delta);
      controls.target.add(delta);
    }
    if (keys.size) {
      const dist = camera.position.distanceTo(controls.target);
      const sp = Math.max(1.2, dist * 0.9) * dt;
      const f = tmpA.subVectors(controls.target, camera.position).setY(0).normalize();
      const r = new THREE.Vector3(-f.z, 0, f.x);
      const m = new THREE.Vector3();
      if (keys.has('w') || keys.has('ArrowUp')) m.add(f);
      if (keys.has('s') || keys.has('ArrowDown')) m.sub(f);
      if (keys.has('d') || keys.has('ArrowRight')) m.add(r);
      if (keys.has('a') || keys.has('ArrowLeft')) m.sub(r);
      if (keys.has('e')) m.y += 1;
      if (keys.has('q')) m.y -= 1;
      if (m.lengthSq() > 0) {
        m.normalize().multiplyScalar(sp);
        camera.position.add(m);
        controls.target.add(m);
      }
    }
    controls.update();
    // keep the camera above the ground
    const gh = heightAt(camera.position.x, camera.position.z) + 0.12;
    if (camera.position.y < gh) camera.position.y = gh;

    updateNearShadow(controls.target);
    sky.update(camera, simTime, renderer.getPixelRatio());
    grade.uniforms.uTime.value = (grade.uniforms.uTime.value + 1.37) % 1000;
    composer.render();

    // HUD
    hudT += dt;
    if (hudT > 0.15) {
      hudT = 0;
      const st = paused ? 'pause' : imaging ? 'hold' : 'drive';
      $('status').dataset.state = st;
      $('statusText').textContent = paused ? '已暂停' : imaging ? '停车 · 全景成像' : '行驶中';
      $('vSpd').innerHTML = `${(v * 100).toFixed(1)}<small>cm/s</small>`;
      $('vOdo').innerHTML = `${odo.toFixed(1)}<small>m</small>`;
      const hdg = (90 - THREE.MathUtils.radToDeg(ps.heading) + 720) % 360;
      $('vHdg').textContent = `${String(Math.round(hdg) % 360).padStart(3, '0')}°`;
      const sg = (x) => (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(1);
      $('vAtt').textContent = `${sg(rover.pitchDeg)}° / ${sg(rover.rollDeg)}°`;
      $('vSun').textContent = `${sunState.el.toFixed(1)}°`;
      const t = Math.floor(simTime);
      $('vMet').textContent = [Math.floor(t / 3600), Math.floor(t / 60) % 60, t % 60].map((x) => String(x).padStart(2, '0')).join(':');
    }

    // adaptive quality: step down once or twice if the frame rate is low
    if (autoQuality && fpsChecks < 2) {
      fpsFrames++;
      fpsT += dt;
      if (fpsT > 4) {
        const fps = fpsFrames / fpsT;
        fpsFrames = 0; fpsT = 0; fpsChecks++;
        if (fps < 42) setQuality(quality === 'high' ? 'mid' : 'low');
      }
    }
  }
  frame();
}

main().catch((err) => {
  console.error(err);
  $('err').hidden = false;
  $('err').textContent = err.message || String(err);
  $('step').textContent = '加载失败';
});
