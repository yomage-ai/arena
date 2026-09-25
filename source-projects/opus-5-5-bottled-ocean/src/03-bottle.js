// ============================================================================
//  03-bottle: scenes, bottle rig, glass shader, deep-water volume, in-bottle
//             sky + stars, cork / wax seal / rope / hanging tag
// ============================================================================
const roomScene = new THREE.Scene();        // table, props, room lights
const glassBackScene = new THREE.Scene();   // far wall of the glass (drawn before the inner world)
const interior = new THREE.Scene();         // the world inside the bottle (its own sun & moon)
const glassFrontScene = new THREE.Scene();  // near wall of the glass (drawn last)

// The bottle rig: every bottle-attached group follows the same transform.
const rig = {
  pos: new THREE.Vector3(), quat: new THREE.Quaternion(), matrix: new THREE.Matrix4(),
  groups: [], prevPos: new THREE.Vector3(), vel: new THREE.Vector3(), acc: new THREE.Vector3(),
};
function rigGroup(scene) { const g = new THREE.Group(); scene.add(g); rig.groups.push(g); return g; }
const rigBack = rigGroup(glassBackScene), rigFront = rigGroup(glassFrontScene);
const rigRoom = rigGroup(roomScene), rigIn = rigGroup(interior);
function applyRig() {
  rig.matrix.compose(rig.pos, rig.quat, _s3.set(1, 1, 1));
  for (const g of rig.groups) { g.position.copy(rig.pos); g.quaternion.copy(rig.quat); g.updateMatrixWorld(true); }
  U.uBottleInv.value.copy(rig.matrix).invert();
}

// ------------------------------------------------------------ bottle profile
const V2 = (r, x) => new THREE.Vector2(Math.max(0.001, r), x);
function glassOuterPoints() {
  const P = GLASS_OUT, pts = [V2(0, P.xb), V2((P.R - P.rc) * 0.55, P.xb)];
  for (let a = 0; a <= 14; a++) { const f = -Math.PI / 2 + (a / 14) * Math.PI / 2; pts.push(V2(P.R - P.rc + P.rc * Math.cos(f), P.xb + P.rc + P.rc * Math.sin(f))); }
  for (let x = P.xb + P.rc + 1.6; x < P.xs - 0.2; x += 1.6) pts.push(V2(P.R, x));
  for (let a = 0; a <= 32; a++) { const x = P.xs + (P.xe - P.xs) * a / 32; pts.push(V2(profR(P, x), x)); }
  for (let x = P.xe + 0.7; x < LIP_X - 1.35; x += 0.7) pts.push(V2(P.rn, x));
  for (let a = 0; a <= 10; a++) { const t = a / 10; pts.push(V2(P.rn + 0.46 * smooth(0, 0.45, t) - 0.05 * smooth(0.8, 1, t), LIP_X - 1.3 + 1.3 * t)); }
  pts.push(V2(P.rn + 0.3, LIP_X + 0.06), V2(GLASS_IN.rn + 0.05, LIP_X + 0.06), V2(GLASS_IN.rn, LIP_X - 0.2), V2(GLASS_IN.rn, LIP_X - 3.0));
  return pts;
}
function cavityPoints(off) {
  const P = GLASS_IN, pts = [V2(0, P.xb + off), V2((P.R - P.rc) * 0.55, P.xb + off)];
  const rc = P.rc - off;
  for (let a = 0; a <= 14; a++) { const f = -Math.PI / 2 + (a / 14) * Math.PI / 2; pts.push(V2(P.R - P.rc + rc * Math.cos(f), P.xb + P.rc + rc * Math.sin(f))); }
  for (let x = P.xb + P.rc + 1.6; x < P.xs - 0.2; x += 1.6) pts.push(V2(P.R - off, x));
  for (let a = 0; a <= 32; a++) { const x = P.xs + (P.xe - P.xs) * a / 32; pts.push(V2(profR(P, x) - off, x)); }
  for (let x = P.xe + 0.7; x < CORK_X - off; x += 0.7) pts.push(V2(P.rn - off, x));
  pts.push(V2(P.rn - off, CORK_X - off), V2(0, CORK_X - off));
  return pts;
}
function latheX(pts, seg) { const g = new THREE.LatheGeometry(pts, seg); g.rotateZ(-Math.PI / 2); return g; }
const glassGeo = latheX(glassOuterPoints(), 96);
const cavityGeo = latheX(cavityPoints(0.05), 72);

// ------------------------------------------------------------------ glass
const glassU = {
  uWinDir: { value: WIN_DIR.clone() },
  uKeyCol: { value: new THREE.Color(1.0, 0.72, 0.45) },
  uInnerCol: { value: new THREE.Color(0.6, 0.7, 0.9) },
  uInnerI: { value: 0.5 },
  uBeamHit0: { value: new THREE.Vector3(0, 100, 0) },
  uBeamHit1: { value: new THREE.Vector3(0, 100, 0) },
  uBeamI: { value: 0 },
  uFlashG: { value: 0 },
};
const GLASS_VS = /* glsl */`
varying vec3 vWPos; varying vec3 vWN; varying vec3 vLP;
void main(){
  vLP = position;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWPos = wp.xyz;
  vWN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const ROOM_ENV_GLSL = /* glsl */`
uniform vec3 uWinDir;
vec3 roomEnv(vec3 r, float sharp){
  float up = r.y;
  vec3 c = mix(vec3(0.030,0.021,0.018), vec3(0.085,0.058,0.048), smoothstep(-0.1, 0.7, up));
  c = mix(c, vec3(0.19,0.10,0.045), smoothstep(0.02, -0.35, up));
  float w = max(dot(r, uWinDir), 0.0);
  c += vec3(1.0,0.46,0.18) * pow(w, 5.0) * mix(0.14, 0.3, sharp);
  vec3 wx = normalize(cross(vec3(0.0,1.0,0.0), uWinDir));
  vec3 wy = cross(uWinDir, wx);
  if (w > 0.25) {
    vec2 q = vec2(dot(r, wx), dot(r, wy)) / w;
    float e = mix(0.06, 0.015, sharp);
    float hx = mix(0.26, 0.40, sharp), hy = mix(0.36, 0.58, sharp);
    float win = (1.0 - smoothstep(hx, hx + e, abs(q.x))) * (1.0 - smoothstep(hy, hy + e, abs(q.y - 0.02)));
    float mull = smoothstep(0.008, 0.008 + e * 0.6, abs(q.x)) * smoothstep(0.008, 0.008 + e * 0.6, abs(q.y - 0.1));
    vec3 sky = mix(vec3(1.7,0.62,0.24), vec3(1.05,0.46,0.62), smoothstep(-0.55, 0.6, q.y));
    sky = mix(sky, vec3(0.35,0.16,0.14), smoothstep(-0.3, -0.62, q.y) * 0.8); // distant hills
    c = mix(c, sky * mix(0.55, 1.25, sharp), win * mull);
  }
  c += vec3(0.22,0.28,0.45) * pow(max(dot(r, normalize(vec3(0.65, 0.5, 0.58))), 0.0), 14.0) * 0.35;
  return c;
}`;
const GLASS_FS = /* glsl */`
${ROOM_ENV_GLSL}
uniform vec3 uKeyCol; uniform vec3 uInnerCol; uniform float uInnerI;
uniform vec3 uBeamHit0; uniform vec3 uBeamHit1; uniform float uBeamI; uniform float uBack; uniform float uFlashG;
varying vec3 vWPos; varying vec3 vWN; varying vec3 vLP;
void main(){
  vec3 N = normalize(vWN);
  if (!gl_FrontFacing) N = -N;
  N = normalize(N + 0.022 * vec3(sin(vLP.x*1.3 + vLP.y*0.4), sin(vLP.x*0.7 + vLP.z*1.1), sin(vLP.y*1.7 - vLP.x*0.5)));
  vec3 V = normalize(cameraPosition - vWPos);
  float nv = clamp(abs(dot(N, V)), 0.0, 1.0);
  float fres = 0.04 + 0.96 * pow(1.0 - nv, 5.0);
  vec3 R = reflect(-V, N);
  vec3 env = roomEnv(R, 1.0);
  vec3 H = normalize(uWinDir + V);
  float nh = max(dot(N, H), 0.0);
  float spec = pow(nh, 900.0) * 16.0 + pow(nh, 80.0) * 0.3;
  float edge = 1.0 - smoothstep(0.0, 0.3, nv);
  vec3 col = env * (0.05 + fres * 1.25) + uKeyCol * spec
           + vec3(0.30, 0.55, 0.46) * edge * 0.10
           + uInnerCol * uInnerI * (0.02 + edge * 0.10)
           + vec3(0.7,0.8,1.0) * uFlashG * (0.02 + edge * 0.22);
  float a = 0.035 + edge * 0.30 + fres * 0.2;
  vec3 b0 = vWPos - uBeamHit0, b1 = vWPos - uBeamHit1;
  float bh = (exp(-dot(b0,b0)*0.8) + exp(-dot(b1,b1)*0.8)) * uBeamI;
  col += vec3(1.0, 0.82, 0.5) * bh * 1.4;
  col *= mix(1.0, 0.45, uBack);
  a *= mix(1.0, 0.6, uBack);
  gl_FragColor = vec4(col, clamp(a, 0.0, 0.9));
}`;
function glassMaterial(back) {
  return new THREE.ShaderMaterial({
    uniforms: { ...glassU, uBack: { value: back ? 1 : 0 } },
    vertexShader: GLASS_VS, fragmentShader: GLASS_FS,
    side: back ? THREE.BackSide : THREE.FrontSide,
    transparent: true, depthWrite: false,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  });
}
rigBack.add(new THREE.Mesh(glassGeo, glassMaterial(true)));
const glassFront = new THREE.Mesh(glassGeo, glassMaterial(false));
rigFront.add(glassFront);

// dithered shadow proxy so the glass casts a faint, watery shadow on the table
{
  const proxy = new THREE.Mesh(glassGeo, new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
  proxy.castShadow = true;
  proxy.customDepthMaterial = patch(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), { clip: false, depth: true, dither: true });
  rigRoom.add(proxy);
}

// ------------------------------------------------ deep water volume & sky
const CAV_VS = /* glsl */`
varying vec3 vWPos; varying vec3 vWN;
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWPos = wp.xyz; vWN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const WATER_BACK_FS = /* glsl */`
${GLSL_COMMON}
varying vec3 vWPos; varying vec3 vWN;
void main(){
  float wy = uWaterY + waveH(vWPos.xz);
  if (vWPos.y > wy) discard;
  float under = wy - vWPos.y;
  float dz = clamp(under / 8.8, 0.0, 1.0);
  vec3 col = mix(uWaterShallow, uWaterDeep, pow(dz, 0.7));
  col += uWaterShallow * exp(-under * 1.6) * 0.55;
  float shafts = pow(max(0.0, sin(vWPos.x*0.8 + sin(uTime*0.25 + vWPos.z*0.2)*1.2 + vWPos.y*0.25)), 10.0);
  col += uWaterShallow * shafts * (1.0 - dz) * uSunUp * 0.45;
  col += uCausticCol * caustic(vWPos.xz * 0.8 + vWPos.y * 0.35, uTime * 0.8) * (1.0 - dz) * uSunUp * 0.12;
  col += vec3(0.6,0.75,1.0) * uFlash * 0.12 * (1.0 - dz);
  gl_FragColor = vec4(col, mix(0.84, 0.97, dz));
}`;
const WATER_FRONT_FS = /* glsl */`
${GLSL_COMMON}
varying vec3 vWPos; varying vec3 vWN;
void main(){
  float wy = uWaterY + waveH(vWPos.xz);
  if (vWPos.y > wy) discard;
  float under = wy - vWPos.y;
  float dz = clamp(under / 8.8, 0.0, 1.0);
  vec3 V = normalize(cameraPosition - vWPos);
  float nv = abs(dot(normalize(vWN), V));
  vec3 col = mix(uWaterShallow, uWaterDeep, pow(dz, 0.8));
  float a = mix(0.1, 0.34, pow(dz, 0.9)) + (1.0 - min(nv, 1.0)) * 0.18;
  float men = exp(-under * 12.0);
  col = mix(col, uWaterShallow * 2.0 + vec3(0.08), men * 0.8);
  col += vec3(0.6,0.75,1.0) * uFlash * 0.06;
  a = max(a, men * 0.7);
  gl_FragColor = vec4(col, clamp(a, 0.0, 0.88));
}`;
function cavMat(fs, side, order, extra = {}) {
  const m = new THREE.ShaderMaterial({ uniforms: { ...U, ...extra }, vertexShader: CAV_VS, fragmentShader: fs, side, transparent: true, depthWrite: false });
  const mesh = new THREE.Mesh(cavityGeo, m);
  mesh.renderOrder = order;
  mesh.frustumCulled = false;
  rigIn.add(mesh);
  return mesh;
}
cavMat(WATER_BACK_FS, THREE.BackSide, 1);

const skyU = {
  uSkyTop: { value: new THREE.Color() }, uSkyHor: { value: new THREE.Color() },
  uSunCol: { value: new THREE.Color() }, uMoonCol: { value: new THREE.Color(0.6, 0.7, 1.0) },
  uSunPos: { value: new THREE.Vector3() }, uMoonPos: { value: new THREE.Vector3() },
  uSkyA: { value: 0.7 }, uStarA: { value: 0 }, uPR: { value: 1 },
};
const SKY_FS = /* glsl */`
${GLSL_COMMON}
uniform vec3 uSkyTop, uSkyHor, uSunCol, uMoonCol, uSunPos, uMoonPos;
uniform float uSkyA;
varying vec3 vWPos; varying vec3 vWN;
void main(){
  float wy = uWaterY + waveH(vWPos.xz);
  if (vWPos.y < wy - 0.02) discard;
  float t = clamp((vWPos.y - uWaterY) / 10.5, 0.0, 1.0);
  vec3 col = mix(uSkyHor, uSkyTop, smoothstep(0.0, 0.8, t));
  vec3 V = normalize(vWPos - cameraPosition);
  float sd = max(dot(V, normalize(uSunPos - cameraPosition)), 0.0);
  float md = max(dot(V, normalize(uMoonPos - cameraPosition)), 0.0);
  float clear = 1.0 - uStorm * 0.85;
  col += uSunCol * (pow(sd, 90.0) * 0.8 + pow(sd, 10.0) * 0.16) * clear;
  col += uMoonCol * (pow(md, 140.0) * 0.4 + pow(md, 20.0) * 0.05) * clear;
  float sunLow = 1.0 - smoothstep(0.5, 5.0, abs(uSunPos.y - uWaterY));
  col += uSunCol * exp(-abs(vWPos.x - uSunPos.x) * 0.12) * (1.0 - smoothstep(0.0, 0.4, t)) * sunLow * 0.5 * clear;
  col += vec3(0.62, 0.7, 1.0) * uFlash * 0.32;
  gl_FragColor = vec4(col, uSkyA);
}`;
cavMat(SKY_FS, THREE.BackSide, 2, skyU);
cavMat(WATER_FRONT_FS, THREE.FrontSide, 9);

// stars on the far inner wall (hidden when they would sit in front of the scene)
{
  const N = 900, pos = [], size = [], ph = [], tint = [];
  const r0 = mulberry32(99);
  let n = 0;
  while (n < N) {
    const band = n > 560;
    const x = band ? lerp(-17, 12.5, r0()) : lerp(-17.5, 12.8, r0());
    let th = band ? 0.35 + x * 0.045 + (r0() + r0() + r0() - 1.5) * 0.28 : (r0() * 2 - 1) * Math.PI;
    const R = profR(GLASS_IN, x) - 0.12;
    const y = R * Math.cos(th), z = R * Math.sin(th);
    if (y < WATER_Y + 1.2) continue;
    pos.push(x, y, z);
    const big = r0() < 0.08;
    size.push(band ? lerp(0.9, 1.6, r0()) : big ? lerp(2.6, 3.8, r0()) : lerp(1.2, 2.4, r0()));
    ph.push(r0());
    const tt = r0(); tint.push(tt < 0.15 ? 0 : tt < 0.3 ? 1 : 0.5);
    n++;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aSize', new THREE.Float32BufferAttribute(size, 1));
  g.setAttribute('aPhase', new THREE.Float32BufferAttribute(ph, 1));
  g.setAttribute('aTint', new THREE.Float32BufferAttribute(tint, 1));
  const m = new THREE.ShaderMaterial({
    uniforms: { ...U, ...skyU },
    vertexShader: /* glsl */`
      uniform float uTime; uniform float uStarA; uniform float uPR; uniform float uWaterY;
      attribute float aSize; attribute float aPhase; attribute float aTint;
      varying float vA; varying float vTint;
      void main(){
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vec3 nrm = normalize(mat3(modelMatrix) * vec3(0.0, position.y, position.z));
        float far = smoothstep(0.05, -0.2, dot(nrm, normalize(cameraPosition - wp.xyz)));
        float tw = 0.55 + 0.45 * sin(uTime * (1.3 + aPhase * 2.5) + aPhase * 50.0);
        vA = far * tw * uStarA * step(uWaterY + 0.6, wp.y);
        vTint = aTint;
        gl_PointSize = aSize * uPR;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */`
      varying float vA; varying float vTint;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d) * vA;
        if (a < 0.01) discard;
        vec3 c = mix(vec3(1.0,0.82,0.62), vec3(0.72,0.85,1.0), vTint) * 1.8;
        gl_FragColor = vec4(c * a, a);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const stars = new THREE.Points(g, m);
  stars.renderOrder = 3; stars.frustumCulled = false;
  rigIn.add(stars);
}

// -------------------------------------------------- canvas texture helpers
function canvasTex(w, h, draw, srgb = true) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d'); draw(ctx, w, h);
  const t = new THREE.CanvasTexture(cv);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
function speckle(ctx, w, h, n, cols, rmin, rmax, seed = 1) {
  const r = mulberry32(seed);
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = cols[(r() * cols.length) | 0];
    ctx.globalAlpha = 0.25 + r() * 0.6;
    const s = rmin + r() * (rmax - rmin);
    ctx.beginPath(); ctx.arc(r() * w, r() * h, s, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
const FONT_CN = '"Noto Serif SC","Songti SC","STSong","SimSun",serif';
const FONT_LA = '"Cormorant Garamond","Iowan Old Style",Georgia,serif';

// ------------------------------------------------------------------ cork
{
  const corkTex = canvasTex(512, 256, (c, w, h) => {
    c.fillStyle = '#b98a55'; c.fillRect(0, 0, w, h);
    speckle(c, w, h, 2600, ['#8a5f34', '#6e4a28', '#d2a570', '#a3753f', '#5a3a1d'], 0.6, 3.2, 11);
  });
  corkTex.wrapS = corkTex.wrapT = THREE.RepeatWrapping; corkTex.repeat.set(3, 1);
  const pts = [V2(0, 22.75), V2(2.58, 22.75), V2(2.6, 27.0), V2(2.8, 27.05), V2(2.84, 27.9), V2(2.7, 28.2), V2(2.3, 28.28), V2(0, 28.3)];
  const cork = new THREE.Mesh(latheX(pts, 48), new THREE.MeshStandardMaterial({ map: corkTex, roughness: 0.95, bumpMap: corkTex, bumpScale: 0.03 }));
  cork.castShadow = true; cork.receiveShadow = true;
  rigRoom.add(cork);

  // red wax seal — lathe body + drips + stamped disc
  const wax = new THREE.MeshStandardMaterial({ color: 0x8e1016, roughness: 0.3, metalness: 0.0, envMapIntensity: 0.9 });
  const wp = [V2(3.13, 25.45), V2(3.22, 25.6), V2(3.32, 25.9), V2(3.58, 26.3), V2(3.64, 26.9), V2(3.5, 27.2), V2(3.02, 27.45),
    V2(2.98, 28.1), V2(2.9, 28.46), V2(2.5, 28.68), V2(1.5, 28.8), V2(0, 28.84)];
  const seal = new THREE.Mesh(latheX(wp, 64), wax);
  seal.castShadow = true; seal.receiveShadow = true;
  rigRoom.add(seal);
  const r0 = mulberry32(5);
  for (let i = 0; i < 9; i++) {
    const ang = (i / 9) * TAU + r0() * 0.5;
    const rad = lerp(0.13, 0.24, r0()), len = lerp(0.3, 1.6, r0());
    const d = new THREE.Mesh(new THREE.CapsuleGeometry(rad, len, 4, 10), wax);
    d.rotation.z = Math.PI / 2;
    const rr = GLASS_OUT.rn + rad * 0.45;
    d.position.set(25.4 - len / 2, Math.cos(ang) * rr, Math.sin(ang) * rr);
    d.castShadow = true;
    rigRoom.add(d);
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(GLASS_OUT.rn + 0.05, 0.12, 8, 64), wax);
  ring.rotation.y = Math.PI / 2; ring.position.x = 25.42;
  rigRoom.add(ring);
  const stampTex = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#808080'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#303030'; c.lineWidth = 10; c.lineCap = 'round';
    c.beginPath(); c.arc(128, 128, 104, 0, TAU); c.stroke();
    c.lineWidth = 12;
    c.beginPath(); c.moveTo(128, 58); c.lineTo(128, 196); c.stroke();          // shank
    c.beginPath(); c.moveTo(92, 82); c.lineTo(164, 82); c.stroke();           // stock
    c.beginPath(); c.arc(128, 46, 13, 0, TAU); c.stroke();                    // ring
    c.beginPath(); c.arc(128, 148, 52, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke(); // arms
  }, false);
  const stamp = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.5, 0.12, 48),
    new THREE.MeshStandardMaterial({ color: 0x7a0c12, roughness: 0.38, bumpMap: stampTex, bumpScale: 0.9 }));
  stamp.rotation.z = -Math.PI / 2; stamp.position.x = 28.84;
  rigRoom.add(stamp);
}

// -------------------------------------------------------- rope & hanging tag
const tag = { group: new THREE.Group(), ax: 0, az: 0, vx: 0, vz: 0 };
{
  const ropeTex = canvasTex(256, 32, (c, w, h) => {
    c.fillStyle = '#b89a6a'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#7d6440'; c.lineWidth = 5;
    for (let x = -40; x < w + 40; x += 14) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 18, h); c.stroke(); }
  });
  ropeTex.wrapS = ropeTex.wrapT = THREE.RepeatWrapping; ropeTex.repeat.set(30, 1);
  const ropeMat = new THREE.MeshStandardMaterial({ map: ropeTex, roughness: 0.95 });
  for (const x of [23.9, 24.28]) {
    const t = new THREE.Mesh(new THREE.TorusGeometry(GLASS_OUT.rn + 0.12, 0.14, 10, 80), ropeMat);
    t.rotation.y = Math.PI / 2; t.position.x = x; t.castShadow = true;
    rigRoom.add(t);
  }
  const th = 2.3; // knot angle (from +y toward +z)
  const kr = GLASS_OUT.rn + 0.25;
  const knotPos = new THREE.Vector3(24.1, Math.cos(th) * kr, Math.sin(th) * kr);
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12), ropeMat);
  knot.position.copy(knotPos); knot.scale.set(1.2, 0.9, 1);
  rigRoom.add(knot);

  tag.group.position.copy(knotPos);
  rigRoom.add(tag.group);
  const strand = (a, b) => {
    const curve = new THREE.CatmullRomCurve3([a, a.clone().lerp(b, 0.5).add(new THREE.Vector3(0.05, 0, 0.06)), b]);
    const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.075, 6, false), ropeMat);
    m.castShadow = true; tag.group.add(m);
  };
  const hole = new THREE.Vector3(0.0, -2.35, 0.05);
  strand(new THREE.Vector3(-0.12, 0, 0), hole.clone().add(new THREE.Vector3(-0.1, 0.05, 0)));
  strand(new THREE.Vector3(0.14, 0, 0.02), hole.clone().add(new THREE.Vector3(0.12, 0.02, 0.05)));

  const tagTex = canvasTex(768, 460, (c, w, h) => {
    const g = c.createRadialGradient(w * 0.5, h * 0.5, 40, w * 0.5, h * 0.5, w * 0.62);
    g.addColorStop(0, '#efdfb8'); g.addColorStop(0.7, '#dcc393'); g.addColorStop(1, '#8f6a3c');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    speckle(c, w, h, 900, ['#b8965e', '#a07d4a', '#f4e7c8', '#7a5a33'], 0.5, 2.2, 3);
    c.strokeStyle = 'rgba(70,40,18,.55)'; c.lineWidth = 3; c.strokeRect(26, 26, w - 52, h - 52);
    c.lineWidth = 1.2; c.strokeRect(36, 36, w - 72, h - 72);
    // hole
    c.fillStyle = '#3b2616'; c.beginPath(); c.arc(w * 0.5, 58, 17, 0, TAU); c.fill();
    c.strokeStyle = '#a7874f'; c.lineWidth = 7; c.beginPath(); c.arc(w * 0.5, 58, 24, 0, TAU); c.stroke();
    c.fillStyle = '#3a2213'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `700 104px ${FONT_CN}`; c.fillText('瓶中沧海', w / 2, 190);
    c.font = `italic 500 38px ${FONT_LA}`; c.fillStyle = '#5a3a1e'; c.fillText('Mare in Vitro', w / 2, 282);
    c.strokeStyle = 'rgba(70,40,18,.7)'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(w * 0.28, 322); c.lineTo(w * 0.72, 322); c.stroke();
    c.font = `600 30px ${FONT_LA}`; c.fillText('No. VII  ·  MDCCXXVI', w / 2, 362);
    // tiny wave ornament
    c.beginPath();
    for (let x = w * 0.36; x <= w * 0.64; x += 2) c.lineTo(x, 402 + Math.sin(x * 0.11) * 5);
    c.stroke();
  });
  const paper = new THREE.MeshStandardMaterial({ color: 0xd9c393, roughness: 0.92 });
  const tagMesh = new THREE.Mesh(new THREE.BoxGeometry(2.7, 1.62, 0.035), [paper, paper, paper, paper,
    new THREE.MeshStandardMaterial({ map: tagTex, roughness: 0.9 }), paper]);
  tagMesh.position.set(0, -2.35 - 0.62, 0.05);
  tagMesh.rotation.set(0.12, 0.35, 0);
  tagMesh.castShadow = true; tagMesh.receiveShadow = true;
  tag.group.add(tagMesh);
}
