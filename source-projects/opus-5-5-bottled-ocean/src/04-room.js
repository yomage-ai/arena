// ============================================================================
//  04-room: dusk room backdrop, env map, lights, table, voxel cradle,
//           old books, brass telescope, compass, dust motes
// ============================================================================
roomScene.fog = new THREE.Fog(0x120b08, 70, 190);

// ---------------------------------------------------------- backdrop sphere
const BACKDROP_FS = /* glsl */`
${ROOM_ENV_GLSL}
uniform float uTime; uniform float uEnv;
varying vec3 vDir;
float h1(float n){ return fract(sin(n) * 43758.5453); }
void main(){
  vec3 d = normalize(vDir);
  vec3 c = roomEnv(d, uEnv);
  // soft window light spilling on the wall
  float w = max(dot(d, uWinDir), 0.0);
  c += vec3(0.9, 0.38, 0.14) * pow(w, 2.5) * 0.07;
  // curtain beside the window
  vec3 wx = normalize(cross(vec3(0.0,1.0,0.0), uWinDir));
  float cx = dot(d, wx) / max(w, 0.2);
  float curtain = smoothstep(0.52, 0.6, cx) * (1.0 - smoothstep(0.95, 1.1, cx)) * step(0.35, w);
  c = mix(c, vec3(0.16, 0.035, 0.03) * (0.6 + 0.4 * sin(cx * 60.0)), curtain * 0.85);
  // out-of-focus bokeh from the rest of the room
  if (uEnv < 0.5) {
    for (int i = 0; i < 14; i++) {
      float fi = float(i);
      float az = h1(fi * 7.1) * 6.2831, el = mix(-0.04, 0.2, h1(fi * 3.7));
      vec3 bd = normalize(vec3(cos(az) * cos(el), sin(el), sin(az) * cos(el)));
      if (dot(bd, uWinDir) > 0.6) continue;
      float rad = mix(0.008, 0.02, h1(fi * 11.3));
      float k = smoothstep(rad, rad * 0.75, acos(clamp(dot(d, bd), -1.0, 1.0)));
      vec3 bc = mix(vec3(1.0, 0.55, 0.22), vec3(1.0, 0.78, 0.45), h1(fi * 5.9));
      c += bc * k * mix(0.04, 0.12, h1(fi * 2.3));
    }
  }
  gl_FragColor = vec4(c, 1.0);
}`;
function makeBackdrop(env) {
  const m = new THREE.ShaderMaterial({
    uniforms: { uWinDir: { value: WIN_DIR }, uTime: U.uTime, uEnv: { value: env ? 1 : 0 } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: BACKDROP_FS, side: THREE.BackSide, depthWrite: false, fog: false,
  });
  const s = new THREE.Mesh(new THREE.SphereGeometry(env ? 50 : 320, 48, 24), m);
  s.renderOrder = -10; s.frustumCulled = false;
  return s;
}
roomScene.add(makeBackdrop(false));

// ----------------------------------------------------------- lights (room)
const roomLights = {};
{
  const key = new THREE.DirectionalLight(0xffa565, 2.7);
  key.position.copy(WIN_DIR).multiplyScalar(80);
  key.target.position.set(0, TABLE_Y, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  const sc = key.shadow.camera; sc.left = -46; sc.right = 46; sc.top = 46; sc.bottom = -46; sc.near = 20; sc.far = 170;
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.04; key.shadow.radius = 3;
  roomScene.add(key, key.target);
  const hemi = new THREE.HemisphereLight(0x6a5470, 0x2a160b, 0.9);
  roomScene.add(hemi);
  const rim = new THREE.DirectionalLight(0x7b8fd8, 0.55);
  rim.position.set(40, 25, 45);
  roomScene.add(rim);
  const glow = new THREE.PointLight(0xa0c8ff, 60, 60, 1.7);   // light spilling out of the bottle
  glow.position.set(-3, -2, 0);
  roomScene.add(glow);
  Object.assign(roomLights, { key, hemi, rim, glow });
}

// --------------------------------------------------------------- table
function woodTexture(seed, base, dark, light) {
  return canvasTex(1024, 256, (c, w, h) => {
    const r = mulberry32(seed);
    c.fillStyle = base; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) {
      const y0 = r() * h, amp = 2 + r() * 10, f = 0.004 + r() * 0.01, ph = r() * 10;
      c.strokeStyle = r() < 0.5 ? dark : light; c.globalAlpha = 0.12 + r() * 0.3; c.lineWidth = 0.6 + r() * 2.4;
      c.beginPath();
      for (let x = 0; x <= w; x += 8) c.lineTo(x, y0 + Math.sin(x * f + ph) * amp + Math.sin(x * f * 3.1 + ph) * amp * 0.25);
      c.stroke();
    }
    for (let i = 0; i < 3; i++) { // knots
      const kx = r() * w, ky = r() * h;
      for (let k = 7; k > 0; k--) { c.globalAlpha = 0.12; c.strokeStyle = dark; c.lineWidth = 1.5; c.beginPath(); c.ellipse(kx, ky, k * 5, k * 2.2, 0, 0, TAU); c.stroke(); }
    }
    c.globalAlpha = 1;
  });
}
{
  const tex = woodTexture(21, '#6a3f22', '#3a200f', '#8f5a32');
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  const r = mulberry32(4);
  const W = 5.4, L = 320;
  for (let i = 0; i < 31; i++) {
    const z = -84 + i * W;
    const g = new THREE.BoxGeometry(L, 1.6, W - 0.12);
    const uv = g.attributes.uv;
    const ou = r(), ov = r(), s = 3 + r();
    for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * s + ou, uv.getY(k) * 0.35 + ov);
    const shade = 0.85 + r() * 0.3;
    const m = new THREE.MeshStandardMaterial({ map: tex, color: new THREE.Color(shade, shade * 0.97, shade * 0.94), roughness: 0.62, metalness: 0, envMapIntensity: 0.35 });
    const plank = new THREE.Mesh(g, m);
    plank.position.set(r() * 6 - 3, TABLE_Y - 0.8, z);
    plank.receiveShadow = true;
    roomScene.add(plank);
  }
}

// ------------------------------------------------------ voxel cradle (托架)
{
  const S = 0.4, vox = new Vox(S, 0, TABLE_Y + S / 2, 0);
  const wood = (i, j, k) => (hash3(i, j, k) < 0.5 ? 0x6b4024 : 0x5e381f);
  // plinth
  const PI0 = -34, PI1 = 26, PK = 14;
  vox.box(PI0, 0, -PK, PI1, 1, PK,
    (i, j, k) => (j === 1 && (Math.abs(k) === PK || i === PI0 || i === PI1) ? 0x4a2a15 : wood(i, j, k)));
  for (const cx of [-11.2, 7.6]) {
    const i0 = Math.round(cx / S) - 2, i1 = i0 + 3;
    for (let k = -17; k <= 17; k++) {
      const z = k * S;
      const top = -Math.sqrt(Math.max(0, 10.04 * 10.04 - (Math.abs(z) + S * 0.5) ** 2));
      for (let j = 2; ; j++) {
        const y = TABLE_Y + S / 2 + j * S;
        if (y + S / 2 > top) break;
        if (Math.abs(k) < 6 && j < 5) continue;                  // carved arch
        for (let i = i0; i <= i1; i++) vox.set(i, j, k, (i === i0 || i === i1) && j % 3 === 0 ? 0x4a2a15 : wood(i, j, k));
      }
    }
  }
  const list = vox.toList([], { jitter: 0.1 });
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.7, envMapIntensity: 0.45 });
  const mesh = makeInstanced(list, mat, { depth: null });
  roomScene.add(mesh);

  // engraved brass plaque
  const tex = canvasTex(1024, 128, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#f2d38a'); g.addColorStop(0.5, '#c99a48'); g.addColorStop(1, '#a8772f');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#6a4718'; c.lineWidth = 4; c.strokeRect(8, 8, w - 16, h - 16);
    c.fillStyle = '#4a2f0e'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `700 62px ${FONT_CN}`; c.fillText('瓶 中 沧 海', w * 0.33, h / 2 + 2);
    c.font = `italic 600 44px ${FONT_LA}`; c.fillText('Mare in Vitro', w * 0.73, h / 2 + 2);
    c.fillRect(w * 0.53, 36, 3, h - 72);
  });
  const plaque = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.62, 0.08), new THREE.MeshStandardMaterial({ map: tex, metalness: 0.9, roughness: 0.32, envMapIntensity: 1.2 }));
  plaque.position.set(-1.8, TABLE_Y + S * 1.0, 5.6 + S / 2 + 0.05);
  roomScene.add(plaque);
}

// ---------------------------------------------------------------- books
{
  const pageTex = canvasTex(64, 512, (c, w, h) => {
    c.fillStyle = '#e8dcbc'; c.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 3) { c.fillStyle = `rgba(120,90,50,${0.06 + Math.random() * 0.12})`; c.fillRect(0, y, w, 1); }
  });
  const books = [
    { w: 10.5, d: 7.4, t: 1.5, col: 0x5b1a17, title: '航 海 志', sub: 'Tractatus de Navigatione', ry: 0.08 },
    { w: 9.4, d: 6.6, t: 1.25, col: 0x1f3b2c, title: '海 图 集', sub: 'Atlas Maritimus', ry: -0.14 },
    { w: 8.2, d: 5.8, t: 1.05, col: 0x1d2946, title: '星 辰 录', sub: 'De Stellis', ry: 0.2 },
  ];
  let y = TABLE_Y;
  const base = new THREE.Vector3(-31.5, 0, -4.5);
  for (const b of books) {
    const coverTex = canvasTex(512, 360, (c, w, h) => {
      const col = '#' + b.col.toString(16).padStart(6, '0');
      c.fillStyle = col; c.fillRect(0, 0, w, h);
      speckle(c, w, h, 700, ['rgba(0,0,0,.5)', 'rgba(255,255,255,.12)'], 0.5, 2.5, b.w * 10);
      c.strokeStyle = '#c9a458'; c.lineWidth = 5; c.strokeRect(24, 24, w - 48, h - 48);
      c.lineWidth = 2; c.strokeRect(36, 36, w - 72, h - 72);
      c.fillStyle = '#d8b566'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = `700 62px ${FONT_CN}`; c.fillText(b.title, w / 2, h / 2 - 22);
      c.font = `italic 500 28px ${FONT_LA}`; c.fillText(b.sub, w / 2, h / 2 + 40);
    });
    const cover = new THREE.MeshStandardMaterial({ color: b.col, roughness: 0.72, envMapIntensity: 0.4 });
    const coverTop = new THREE.MeshStandardMaterial({ map: coverTex, roughness: 0.7, envMapIntensity: 0.4 });
    const g = new THREE.Group();
    const c1 = new THREE.Mesh(new THREE.BoxGeometry(b.w, 0.14, b.d), [cover, cover, coverTop, cover, cover, cover]);
    c1.position.y = b.t - 0.07;
    const c2 = new THREE.Mesh(new THREE.BoxGeometry(b.w, 0.14, b.d), cover); c2.position.y = 0.07;
    const pages = new THREE.Mesh(new THREE.BoxGeometry(b.w - 0.35, b.t - 0.26, b.d - 0.3),
      new THREE.MeshStandardMaterial({ map: pageTex, roughness: 0.95, color: 0xf0e6cc }));
    pages.position.set(0.12, b.t / 2, 0);
    const spine = new THREE.Mesh(new THREE.BoxGeometry(0.26, b.t, b.d), cover);
    spine.position.set(-b.w / 2 + 0.1, b.t / 2, 0);
    g.add(c1, c2, pages, spine);
    for (const f of [-0.3, 0, 0.3]) { // raised gilt bands on the spine
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.3, b.t * 0.9, 0.14), new THREE.MeshStandardMaterial({ color: 0xcaa050, metalness: 0.85, roughness: 0.35 }));
      band.position.set(-b.w / 2 + 0.07, b.t / 2, f * b.d);
      g.add(band);
    }
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    g.position.set(base.x, y, base.z);
    g.rotation.y = b.ry;
    roomScene.add(g);
    y += b.t;
  }
  // a brass compass on top of the stack
  const roseTex = canvasTex(512, 512, (c, w, h) => {
    c.fillStyle = '#efe3c4'; c.fillRect(0, 0, w, h);
    c.translate(w / 2, h / 2);
    c.strokeStyle = '#3a2a1a'; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, 230, 0, TAU); c.stroke();
    c.lineWidth = 1.5; c.beginPath(); c.arc(0, 0, 205, 0, TAU); c.stroke();
    for (let i = 0; i < 64; i++) { const a = i / 64 * TAU, l = i % 8 === 0 ? 26 : 12; c.beginPath(); c.moveTo(Math.cos(a) * 230, Math.sin(a) * 230); c.lineTo(Math.cos(a) * (230 - l), Math.sin(a) * (230 - l)); c.stroke(); }
    const star = (r1, r2, n, rot, fill) => { c.fillStyle = fill; c.beginPath(); for (let i = 0; i < n * 2; i++) { const a = rot + i / (n * 2) * TAU, r = i % 2 ? r2 : r1; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.fill(); };
    star(180, 30, 4, -Math.PI / 2, '#8a1c1c'); star(120, 22, 4, -Math.PI / 4, '#2b3a55');
    c.fillStyle = '#3a2a1a'; c.font = `700 40px ${FONT_LA}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('N', 0, -200 + 26); c.fillText('S', 0, 200 - 26); c.fillText('E', 200 - 26, 0); c.fillText('W', -200 + 26, 0);
  });
  const brass = new THREE.MeshStandardMaterial({ color: 0xc9a04a, metalness: 1, roughness: 0.3 });
  const comp = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.8, 0.55, 48), brass);
  const face = new THREE.Mesh(new THREE.CircleGeometry(1.5, 48), new THREE.MeshStandardMaterial({ map: roseTex, roughness: 0.6 }));
  face.rotation.x = -Math.PI / 2; face.position.y = 0.2;
  const needle = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.04, 0.12), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.6, roughness: 0.3 }));
  needle.position.y = 0.26; needle.rotation.y = 0.5;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.62, 0.12, 10, 48), brass);
  rim.rotation.x = Math.PI / 2; rim.position.y = 0.28;
  comp.add(body, face, needle, rim);
  comp.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  comp.position.set(base.x + 0.8, y + 0.28, base.z + 0.6);
  roomScene.add(comp);
  roomLights.compassNeedle = needle;
}

// ----------------------------------------------------------- brass telescope
{
  const brass = new THREE.MeshStandardMaterial({ color: 0xcfa24c, metalness: 1, roughness: 0.26 });
  const brass2 = new THREE.MeshStandardMaterial({ color: 0xe0b863, metalness: 1, roughness: 0.18 });
  const leatherTex = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#3b2415'; c.fillRect(0, 0, w, h);
    speckle(c, w, h, 1600, ['#2a180c', '#4e3220', '#1c1008'], 0.5, 2, 8);
    c.strokeStyle = '#c8a870'; c.setLineDash([6, 6]); c.lineWidth = 2;
    c.beginPath(); c.moveTo(0, 16); c.lineTo(w, 16); c.moveTo(0, h - 16); c.lineTo(w, h - 16); c.stroke();
  });
  const leather = new THREE.MeshStandardMaterial({ map: leatherTex, roughness: 0.85 });
  const g = new THREE.Group();
  let x = 0;
  const seg = (r0, r1, len, mat) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, len, 40, 1, false), mat);
    m.rotation.z = -Math.PI / 2; m.position.x = x + len / 2; g.add(m); x += len; return m;
  };
  const ring = (r, w, mat = brass2) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 40), mat); m.rotation.z = -Math.PI / 2; m.position.x = x; g.add(m); };
  ring(1.2, 0.35); seg(1.14, 1.06, 2.2, brass); ring(1.1, 0.3);
  seg(1.02, 1.0, 1.0, brass); seg(1.05, 1.05, 3.4, leather); seg(1.0, 0.98, 1.2, brass); ring(1.04, 0.35);
  seg(0.78, 0.78, 3.1, brass2); ring(0.84, 0.3);
  seg(0.6, 0.6, 2.6, brass2); ring(0.66, 0.26);
  seg(0.5, 0.46, 1.0, brass); ring(0.52, 0.2);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(1.0, 40), new THREE.MeshStandardMaterial({ color: 0x0c1a24, metalness: 0.2, roughness: 0.05, envMapIntensity: 2.5 }));
  lens.rotation.y = -Math.PI / 2; lens.position.x = 0.05;
  g.add(lens);
  const len = x;
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const tilt = Math.asin((1.2 - 0.52) / len);
  g.rotation.set(0, -0.42, -tilt, 'YZX');
  g.position.set(11.5, TABLE_Y + 1.2, 12.5);
  roomScene.add(g);
}

// -------------------------------------------------------------- dust motes
const dust = (() => {
  const N = 520, pos = new Float32Array(N * 3), seed = new Float32Array(N);
  const r = mulberry32(77);
  for (let i = 0; i < N; i++) { pos[i * 3] = lerp(-55, 55, r()); pos[i * 3 + 1] = lerp(TABLE_Y, 26, r()); pos[i * 3 + 2] = lerp(-35, 35, r()); seed[i] = r(); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const m = new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uPR: skyU.uPR, uWinDir: { value: WIN_DIR } },
    vertexShader: /* glsl */`
      uniform float uTime; uniform float uPR; uniform vec3 uWinDir;
      attribute float aSeed; varying float vA;
      void main(){
        vec3 p = position;
        p.x = mod(p.x + uTime * (0.25 + aSeed * 0.4) + 55.0, 110.0) - 55.0;
        p.y += sin(uTime * 0.21 + aSeed * 40.0) * 1.6;
        p.z += cos(uTime * 0.17 + aSeed * 23.0) * 1.4;
        // brighter inside the slanted window beam
        vec3 axis = uWinDir; vec3 rel = p - vec3(-8.0, -4.0, -2.0);
        float along = dot(rel, axis); float dist = length(rel - axis * along);
        float beam = exp(-dist * dist / 260.0);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vA = (0.12 + 0.88 * beam) * (0.5 + 0.5 * sin(uTime * (0.6 + aSeed) + aSeed * 90.0));
        gl_PointSize = (1.4 + aSeed * 2.4) * uPR * clamp(40.0 / -mv.z, 0.5, 2.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: 'varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d) * vA * 0.55; gl_FragColor = vec4(vec3(1.0, 0.75, 0.45) * a, a); }',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const p = new THREE.Points(g, m); p.frustumCulled = false; p.renderOrder = 20;
  roomScene.add(p);
  return p;
})();
