import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const viewport = document.getElementById('scene');
const loading = document.getElementById('loading');
const fallback = document.getElementById('fallback');
let renderer;

try {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', alpha: false });
} catch (error) {
  loading.hidden = true;
  fallback.hidden = false;
  throw error;
}

renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
renderer.setSize(viewport.clientWidth, viewport.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.38;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
viewport.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x080b10);
scene.fog = new THREE.FogExp2(0x0a0d12, 0.0085);

const camera = new THREE.PerspectiveCamera(47, viewport.clientWidth / viewport.clientHeight, 0.1, 340);
const mobile = window.matchMedia('(max-width: 760px)').matches;
const startingCamera = mobile ? new THREE.Vector3(8.9, 6.4, 12.8) : new THREE.Vector3(5.1, 3.7, 7.2);
camera.position.copy(startingCamera);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.2, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.065;
controls.rotateSpeed = 0.52;
controls.zoomSpeed = 0.8;
controls.panSpeed = 0.75;
controls.minDistance = 4.2;
controls.maxDistance = 32;
controls.minPolarAngle = 0.12;
controls.maxPolarAngle = Math.PI * 0.49;
controls.screenSpacePanning = true;
controls.update();

const ambient = new THREE.AmbientLight(0x8d9bb3, 0.83);
scene.add(ambient);
const sun = new THREE.DirectionalLight(0xffecd3, 3.3);
sun.position.set(-14, 19, 9);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -17;
sun.shadow.camera.right = 17;
sun.shadow.camera.top = 17;
sun.shadow.camera.bottom = -17;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 75;
sun.shadow.bias = -0.00025;
sun.shadow.normalBias = 0.04;
sun.shadow.radius = 2;
scene.add(sun, sun.target);
const coolFill = new THREE.DirectionalLight(0xacc9e0, 1.13);
coolFill.position.set(7, 8, 10);
scene.add(coolFill);

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (1664525 * value + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

const random = seededRandom(713094);
const fade = t => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;
function hash2(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}
function noise2(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = fade(x - ix), fy = fade(y - iy);
  return lerp(lerp(hash2(ix, iy), hash2(ix + 1, iy), fx), lerp(hash2(ix, iy + 1), hash2(ix + 1, iy + 1), fx), fy);
}
function fbm(x, y) {
  let value = 0, weight = 0.5;
  for (let i = 0; i < 4; i++) {
    value += (noise2(x, y) - 0.5) * weight;
    x *= 2.03; y *= 2.03; weight *= 0.49;
  }
  return value;
}

const craters = [
  { x: 3.3, z: -5.1, r: 2.45, depth: 0.46 }, { x: -5.1, z: 4.7, r: 2.15, depth: 0.31 },
  { x: 8.4, z: 3.7, r: 3.1, depth: 0.38 },
  { x: -8, z: -10, r: 4.6, depth: 0.76 }, { x: 12, z: -8, r: 3.5, depth: 0.49 },
  { x: -17, z: 10, r: 3.8, depth: 0.45 }, { x: 18, z: 12, r: 5.2, depth: 0.68 },
  { x: 3, z: -19, r: 5.8, depth: 0.8 }, { x: -26, z: -16, r: 7.8, depth: 0.9 },
  { x: 29, z: -23, r: 8.2, depth: 1.1 }, { x: 35, z: 19, r: 6.5, depth: 0.8 },
  { x: -35, z: 27, r: 7.1, depth: 0.7 }, { x: 48, z: -2, r: 6.2, depth: 0.6 },
  { x: -6, z: 25, r: 5.9, depth: 0.5 }, { x: 60, z: 35, r: 11, depth: 1.2 }
];

function terrainHeight(x, z) {
  const safePath = THREE.MathUtils.smoothstep(Math.abs(z), 1.65, 5.5);
  let height = 0.026 * fbm(x * 1.5, z * 1.5) + 0.06 * fbm(x * 0.34, z * 0.34);
  height += safePath * (0.27 * fbm(x * 0.085, z * 0.085) + 0.13 * fbm(x * 0.26, z * 0.26));
  for (const c of craters) {
    const radius = Math.hypot(x - c.x, z - c.z);
    const q = radius / c.r;
    height -= c.depth * Math.exp(-Math.pow(q / 0.69, 4));
    height += c.depth * 0.31 * Math.exp(-Math.pow((q - 1.02) / 0.17, 2));
  }
  return height;
}

function createRegolithTextures() {
  const canvas = document.createElement('canvas');
  const colorCanvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  colorCanvas.width = colorCanvas.height = 512;
  const ctx = canvas.getContext('2d');
  const colorCtx = colorCanvas.getContext('2d');
  const data = ctx.createImageData(512, 512);
  const colorData = colorCtx.createImageData(512, 512);
  const rand = seededRandom(932018);
  for (let y = 0; y < 512; y++) {
    for (let x = 0; x < 512; x++) {
      const grain = rand() - 0.5;
      const broad = fbm(x * 0.022, y * 0.022);
      const fine = fbm(x * 0.17, y * 0.17);
      const value = Math.max(0, Math.min(255, 128 + 100 * broad + 40 * fine + 44 * grain));
      const tint = Math.max(0, Math.min(255, 222 + 52 * broad + 16 * fine + 15 * grain));
      const i = (y * 512 + x) * 4;
      data.data[i] = data.data[i + 1] = data.data[i + 2] = value;
      data.data[i + 3] = 255;
      colorData.data[i] = tint;
      colorData.data[i + 1] = tint * 0.966;
      colorData.data[i + 2] = tint * 0.91;
      colorData.data[i + 3] = 255;
    }
  }
  ctx.putImageData(data, 0, 0);
  colorCtx.putImageData(colorData, 0, 0);
  const bump = new THREE.CanvasTexture(canvas);
  const color = new THREE.CanvasTexture(colorCanvas);
  for (const texture of [bump, color]) {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(42, 42);
    texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  }
  color.colorSpace = THREE.SRGBColorSpace;
  return { bump, color };
}

const regolith = createRegolithTextures();
const terrainGeometry = new THREE.PlaneGeometry(220, 220, 360, 360);
terrainGeometry.rotateX(-Math.PI / 2);
const positions = terrainGeometry.attributes.position;
const terrainColors = new Float32Array(positions.count * 3);
const groundColor = new THREE.Color();
for (let i = 0; i < positions.count; i++) {
  const x = positions.getX(i), z = positions.getZ(i);
  const h = terrainHeight(x, z);
  positions.setY(i, h);
  const grain = fbm(x * 0.9, z * 0.9) * 0.36 + fbm(x * 0.18, z * 0.18) * 0.19;
  let craterTint = 1;
  for (const crater of craters) {
    const q = Math.hypot(x - crater.x, z - crater.z) / crater.r;
    craterTint -= 0.12 * Math.exp(-Math.pow(q / 0.68, 6));
    craterTint += 0.07 * Math.exp(-Math.pow((q - 1.01) / 0.19, 2));
  }
  const tint = THREE.MathUtils.clamp((0.84 + grain + Math.max(0, h) * 0.075) * craterTint, 0.55, 0.98);
  groundColor.setRGB(tint, tint * 0.935, tint * 0.84);
  terrainColors[i * 3] = groundColor.r;
  terrainColors[i * 3 + 1] = groundColor.g;
  terrainColors[i * 3 + 2] = groundColor.b;
}
terrainGeometry.setAttribute('color', new THREE.BufferAttribute(terrainColors, 3));
terrainGeometry.computeVertexNormals();
const terrainMaterial = new THREE.MeshStandardMaterial({
  vertexColors: true,
  color: 0xf8f6f0,
  map: regolith.color,
  roughness: 1,
  metalness: 0,
  bumpMap: regolith.bump,
  bumpScale: 0.14
});
const terrain = new THREE.Mesh(terrainGeometry, terrainMaterial);
terrain.receiveShadow = true;
scene.add(terrain);

const loader = new THREE.TextureLoader();
function loadSurfaceMap(filename, srgb = false) {
  return new Promise((resolve, reject) => loader.load(`./assets/${filename}`, texture => {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(68.75, 68.75);
    texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
    if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
    resolve(texture);
  }, undefined, reject));
}
const surfaceReady = Promise.all([
  loadSurfaceMap('moon_04_diff_2k.jpg', true),
  loadSurfaceMap('moon_04_nor_gl_2k.jpg'),
  loadSurfaceMap('moon_04_rough_2k.jpg')
]).then(([diffuse, normal, roughness]) => {
  terrainMaterial.map = diffuse;
  terrainMaterial.normalMap = normal;
  terrainMaterial.normalScale.set(1.05, 1.05);
  terrainMaterial.roughnessMap = roughness;
  terrainMaterial.bumpMap = null;
  terrainMaterial.needsUpdate = true;
}).catch(error => {
  console.warn('Detailed lunar texture unavailable; using procedural surface.', error);
});

function addRocks(count, minSize, maxSize, large = false) {
  const geometry = new THREE.IcosahedronGeometry(1, large ? 1 : 0);
  const material = new THREE.MeshStandardMaterial({ color: 0xb4ab9d, roughness: 1, flatShading: true });
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const position = new THREE.Vector3();
  const color = new THREE.Color();
  for (let i = 0; i < count; i++) {
    let x = (random() - 0.5) * 145;
    let z = (random() - 0.5) * 145;
    if (Math.abs(x) < 5 && Math.abs(z) < 2.2) z += z >= 0 ? 3 : -3;
    const size = minSize + Math.pow(random(), 2.8) * (maxSize - minSize);
    position.set(x, terrainHeight(x, z) + size * 0.25, z);
    scale.set(size * (0.8 + random() * 0.9), size * (0.25 + random() * 0.55), size * (0.65 + random() * 0.9));
    quaternion.setFromEuler(new THREE.Euler((random() - 0.5) * 0.35, random() * Math.PI * 2, (random() - 0.5) * 0.35));
    matrix.compose(position, quaternion, scale);
    mesh.setMatrixAt(i, matrix);
    const shade = 0.72 + random() * 0.43;
    color.setRGB(shade, shade * 0.94, shade * 0.85);
    mesh.setColorAt(i, color);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = large;
  mesh.receiveShadow = true;
  scene.add(mesh);
}
addRocks(1100, 0.015, 0.11);
addRocks(115, 0.16, 0.67, true);

function addForegroundDebris() {
  const geometry = new THREE.IcosahedronGeometry(1, 1);
  const material = new THREE.MeshStandardMaterial({ color: 0xc9c0af, roughness: 1, flatShading: true });
  const mesh = new THREE.InstancedMesh(geometry, material, 550);
  const matrix = new THREE.Matrix4();
  const color = new THREE.Color();
  const q = new THREE.Quaternion();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  for (let i = 0; i < 550; i++) {
    let x = (random() - 0.5) * 34;
    let z = (random() - 0.5) * 29;
    if (Math.abs(x) < 4.4 && Math.abs(z) < 2.35) z += z >= 0 ? 2.5 : -2.5;
    const r = 0.018 + Math.pow(random(), 4) * 0.27;
    position.set(x, terrainHeight(x, z) + r * 0.3, z);
    scale.set(r * (1.2 + random()), r * (0.3 + random() * 0.6), r * (0.8 + random()));
    q.setFromEuler(new THREE.Euler(0, random() * Math.PI * 2, 0));
    matrix.compose(position, q, scale);
    mesh.setMatrixAt(i, matrix);
    const v = 0.74 + random() * 0.35;
    color.setRGB(v, v * 0.94, v * 0.86);
    mesh.setColorAt(i, color);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
}
addForegroundDebris();

function addStars() {
  const points = [];
  const rand = seededRandom(588814);
  for (let i = 0; i < 2200; i++) {
    const angle = rand() * Math.PI * 2;
    const elevation = 0.006 + Math.pow(rand(), 1.5) * 1.3;
    const radius = 135 + rand() * 125;
    points.push(Math.cos(angle) * Math.cos(elevation) * radius,
      Math.sin(elevation) * radius + 7,
      Math.sin(angle) * Math.cos(elevation) * radius);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  const stars = new THREE.Points(geometry, new THREE.PointsMaterial({
    color: 0xbfc9d3, size: 1.15, sizeAttenuation: false, transparent: true, opacity: 0.82,
    depthWrite: false, fog: false
  }));
  scene.add(stars);
}
addStars();

function addEarth() {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(512, 256);
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 512; x++) {
      const lat = (y / 256 - 0.5) * Math.PI;
      const continent = fbm(x * 0.014, y * 0.025) + 0.18 * Math.sin(x * 0.034 + y * 0.018);
      const cloud = fbm(x * 0.051 + 10, y * 0.038 + 10);
      const ice = Math.abs(lat) > 1.24;
      const land = continent > 0.042;
      const i = (y * 512 + x) * 4;
      let r = land ? 102 : 37, g = land ? 113 : 83, b = land ? 105 : 126;
      if (ice || cloud > 0.115) { r = 194; g = 204; b = 205; }
      img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const planet = new THREE.Mesh(new THREE.SphereGeometry(1.15, 48, 32), new THREE.MeshStandardMaterial({
    map: texture, roughness: 1, emissive: 0x294761, emissiveIntensity: 0.36, fog: false
  }));
  planet.position.set(-9, 3.6, -58);
  planet.rotation.z = 0.32;
  scene.add(planet);
  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = glowCanvas.height = 128;
  const gc = glowCanvas.getContext('2d');
  const gradient = gc.createRadialGradient(64, 64, 19, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(137,186,227,0.28)');
  gradient.addColorStop(0.45, 'rgba(100,151,208,0.12)');
  gradient.addColorStop(1, 'rgba(100,151,208,0)');
  gc.fillStyle = gradient; gc.fillRect(0, 0, 128, 128);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(glowCanvas), transparent: true, depthWrite: false, fog: false }));
  glow.position.copy(planet.position);
  glow.scale.set(6, 6, 1);
  scene.add(glow);
  return planet;
}
const earth = addEarth();

const mat = {
  ceramic: new THREE.MeshStandardMaterial({ color: 0xe1ded2, metalness: 0.18, roughness: 0.59 }),
  white: new THREE.MeshStandardMaterial({ color: 0xf2eee1, metalness: 0.15, roughness: 0.48 }),
  panel: new THREE.MeshStandardMaterial({ color: 0xcac7bd, metalness: 0.32, roughness: 0.57 }),
  metal: new THREE.MeshStandardMaterial({ color: 0x90999e, metalness: 0.85, roughness: 0.34 }),
  brightMetal: new THREE.MeshStandardMaterial({ color: 0xc6c8c2, metalness: 0.83, roughness: 0.26 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x242a2c, metalness: 0.51, roughness: 0.55 }),
  graphite: new THREE.MeshStandardMaterial({ color: 0x32383a, metalness: 0.69, roughness: 0.38 }),
  rubber: new THREE.MeshStandardMaterial({ color: 0x303234, metalness: 0.28, roughness: 0.88 }),
  gold: new THREE.MeshStandardMaterial({ color: 0xc9a05e, metalness: 0.81, roughness: 0.33 }),
  orange: new THREE.MeshStandardMaterial({ color: 0xc58b54, metalness: 0.33, roughness: 0.57 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x142532, metalness: 0.72, roughness: 0.11, emissive: 0x081521, emissiveIntensity: 0.26 }),
  solar: new THREE.MeshStandardMaterial({ color: 0x102634, metalness: 0.54, roughness: 0.2 }),
  solarCell: new THREE.MeshStandardMaterial({ color: 0x254e64, metalness: 0.55, roughness: 0.22, emissive: 0x0c2835, emissiveIntensity: 0.17 }),
  light: new THREE.MeshStandardMaterial({ color: 0xfff6de, emissive: 0xffe0ad, emissiveIntensity: 2.1, roughness: 0.2 })
};

function materialBump(seed, scale, repeat) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(256, 256);
  const rand = seededRandom(seed);
  for (let i = 0; i < image.data.length; i += 4) {
    const n = 126 + (rand() - 0.5) * scale;
    image.data[i] = image.data[i + 1] = image.data[i + 2] = n;
    image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  return texture;
}
mat.ceramic.bumpMap = materialBump(3817, 28, 3);
mat.ceramic.bumpScale = 0.012;
mat.gold.bumpMap = materialBump(7091, 96, 3);
mat.gold.bumpScale = 0.045;

function box(parent, size, position, material, cast = true, radius = 0) {
  const geometry = radius ? new RoundedBoxGeometry(...size, 3, radius) : new THREE.BoxGeometry(...size);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.castShadow = cast;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function cylinder(parent, radiusTop, radiusBottom, height, position, material, segments = 16) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments), material);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function rod(parent, a, b, radius, material, segments = 9) {
  const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
  const direction = new THREE.Vector3().subVectors(end, start);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, direction.length(), segments), material);
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

function cable(parent, coordinates, color = 0x5f5145, radius = 0.012) {
  const curve = new THREE.CatmullRomCurve3(coordinates.map(p => new THREE.Vector3(...p)));
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, radius, 6, false), new THREE.MeshStandardMaterial({ color, roughness: 0.7 }));
  parent.add(mesh);
}

function decalTexture(lines, width = 512, height = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#414a48';
  ctx.fillRect(18, 34, 6, height - 70);
  ctx.textBaseline = 'middle';
  lines.forEach((line, index) => {
    ctx.fillStyle = line.color || '#30383a';
    ctx.font = `${line.weight || 700} ${line.size || 42}px Arial, sans-serif`;
    ctx.fillText(line.text, 49, 70 + index * 57);
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function label(parent, lines, size, position) {
  const texture = decalTexture(lines);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(...size), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  mesh.position.set(...position);
  parent.add(mesh);
  return mesh;
}

const rover = new THREE.Group();
rover.position.x = -0.2;
scene.add(rover);

const underbody = box(rover, [2.65, 0.21, 1.48], [-0.04, 1.13, 0], mat.graphite, true, 0.035);
underbody.geometry.translate(0, 0, 0);
box(rover, [2.88, 0.075, 1.56], [-0.02, 1.27, 0], mat.metal);
for (const z of [-0.71, 0.71]) {
  box(rover, [2.96, 0.09, 0.09], [-0.01, 1.34, z], mat.brightMetal);
  for (const x of [-1.23, -0.38, 0.45, 1.25]) box(rover, [0.09, 0.16, 0.09], [x, 1.28, z], mat.dark);
}
for (const x of [-1.34, 1.31]) box(rover, [0.09, 0.12, 1.52], [x, 1.34, 0], mat.brightMetal);

const body = box(rover, [2.48, 0.56, 1.38], [-0.08, 1.61, 0], mat.ceramic, true, 0.06);
box(rover, [2.57, 0.075, 1.48], [-0.08, 1.92, 0], mat.white, true, 0.025);
box(rover, [0.045, 0.46, 1.2], [1.17, 1.61, 0], mat.panel);
box(rover, [0.045, 0.44, 1.16], [-1.33, 1.61, 0], mat.panel);
for (const z of [-0.696, 0.696]) {
  for (const x of [-1.17, -0.36, 0.48, 1.03]) box(rover, [0.018, 0.5, 0.022], [x, 1.61, z], mat.metal, false);
  box(rover, [2.35, 0.02, 0.025], [-0.07, 1.36, z], mat.metal, false);
  box(rover, [2.35, 0.02, 0.025], [-0.07, 1.85, z], mat.metal, false);
}
label(rover, [
  { text: 'SELENE   /   07', size: 48, weight: 800 },
  { text: 'LUNAR FIELD EXPLORER', size: 25, weight: 600, color: '#69716d' }
], [1.05, 0.39], [-0.52, 1.61, 0.711]);
label(rover, [
  { text: 'S / 07', size: 58, weight: 800 },
  { text: 'SURFACE MISSION', size: 26, color: '#69716d' }
], [1.0, 0.39], [-0.4, 1.61, -0.711]).rotation.y = Math.PI;

// Foil wrapped instruments and service hatches on the rear deck.
box(rover, [0.82, 0.43, 0.82], [-0.95, 2.18, -0.13], mat.gold, true, 0.035);
for (let i = 0; i < 7; i++) {
  box(rover, [0.79, 0.008, 0.018], [-0.95, 2.395, -0.49 + i * 0.12], mat.orange, false);
}
for (let i = 0; i < 5; i++) {
  box(rover, [0.018, 0.015, 0.8], [-1.27 + i * 0.16, 2.402, -0.13], mat.gold, false);
}
for (const x of [-1.22, -0.72]) {
  box(rover, [0.034, 0.45, 0.84], [x, 2.18, -0.13], mat.graphite, false);
}
box(rover, [0.66, 0.21, 0.42], [0.26, 2.07, -0.29], mat.panel);
box(rover, [0.47, 0.02, 0.32], [0.26, 2.186, -0.29], mat.dark);
for (let i = 0; i < 8; i++) box(rover, [0.025, 0.022, 0.28], [0.055 + i * 0.058, 2.203, -0.29], mat.metal, false);

// Hinged photovoltaic wings with individually separated blue cells.
function solarWing(side) {
  const pivot = new THREE.Group();
  pivot.position.set(-0.1, 1.95, side * 0.78);
  pivot.rotation.x = -side * 0.14;
  rover.add(pivot);
  box(pivot, [1.87, 0.072, 1.18], [0, 0, side * 0.64], mat.metal);
  box(pivot, [1.73, 0.013, 1.045], [0, 0.045, side * 0.64], mat.solar);
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 8; col++) {
      const cell = box(pivot, [0.195, 0.005, 0.22], [-0.747 + col * 0.213, 0.054, side * 0.64 - 0.388 + row * 0.258], mat.solarCell, false);
      cell.material = mat.solarCell;
    }
  }
  box(pivot, [0.015, 0.012, 1.08], [0, 0.059, side * 0.64], mat.gold, false);
  box(pivot, [1.77, 0.012, 0.013], [0, 0.059, side * 0.64], mat.gold, false);
  rod(rover, [-0.78, 1.78, side * 0.69], [-0.78, 1.84, side * 1.9], 0.028, mat.metal);
  rod(rover, [0.68, 1.78, side * 0.69], [0.68, 1.84, side * 1.9], 0.028, mat.metal);
}
solarWing(-1);
solarWing(1);

// Camera mast, paired optical lenses, sensors and the radio antenna.
rod(rover, [0.7, 1.96, -0.06], [0.7, 2.95, -0.06], 0.064, mat.brightMetal);
rod(rover, [0.7, 2.0, -0.06], [0.22, 2.37, -0.06], 0.027, mat.metal);
cylinder(rover, 0.115, 0.115, 0.07, [0.7, 2.68, -0.06], mat.dark);
box(rover, [0.43, 0.22, 0.51], [0.75, 3.02, -0.06], mat.white, true, 0.035);
box(rover, [0.055, 0.16, 0.43], [0.99, 3.02, -0.06], mat.dark);
for (const z of [-0.19, 0.07]) {
  const ring = cylinder(rover, 0.069, 0.069, 0.07, [1.037, 3.02, z], mat.brightMetal, 24);
  ring.rotation.z = Math.PI / 2;
  const lens = cylinder(rover, 0.049, 0.049, 0.074, [1.08, 3.02, z], mat.glass, 24);
  lens.rotation.z = Math.PI / 2;
  const glint = cylinder(rover, 0.014, 0.014, 0.077, [1.12, 3.035, z - 0.012], mat.solar, 16);
  glint.rotation.z = Math.PI / 2;
}
box(rover, [0.17, 0.055, 0.11], [0.71, 3.16, -0.06], mat.graphite);
rod(rover, [-0.78, 2.37, -0.33], [-0.84, 2.84, -0.38], 0.025, mat.metal);
const dishProfile = [new THREE.Vector2(0, 0), new THREE.Vector2(0.09, 0.009), new THREE.Vector2(0.2, 0.048), new THREE.Vector2(0.31, 0.13)];
const dish = new THREE.Mesh(new THREE.LatheGeometry(dishProfile, 32), new THREE.MeshStandardMaterial({ color: 0xd8d6c9, metalness: 0.62, roughness: 0.34, side: THREE.DoubleSide }));
dish.position.set(-0.86, 2.84, -0.38);
dish.rotation.z = -0.38;
dish.castShadow = true;
rover.add(dish);
const dishRim = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.017, 8, 32), mat.brightMetal);
dishRim.position.set(-0.91, 2.96, -0.38);
dishRim.rotation.x = Math.PI / 2;
dishRim.rotation.y = -0.38;
rover.add(dishRim);
rod(rover, [-0.86, 2.84, -0.38], [-0.87, 3.12, -0.38], 0.012, mat.metal);
cylinder(rover, 0.036, 0.036, 0.03, [-0.87, 3.12, -0.38], mat.gold);
rod(rover, [-1.1, 1.95, 0.41], [-1.15, 2.7, 0.45], 0.018, mat.metal);
const antennaTip = new THREE.Mesh(new THREE.SphereGeometry(0.034, 10, 8), mat.orange);
antennaTip.position.set(-1.15, 2.71, 0.45);
rover.add(antennaTip);

// Front lights, sample arm and cabling.
for (const z of [-0.5, 0.5]) {
  box(rover, [0.13, 0.17, 0.24], [1.27, 1.56, z], mat.dark);
  const lamp = cylinder(rover, 0.073, 0.073, 0.03, [1.356, 1.56, z], mat.light, 20);
  lamp.rotation.z = Math.PI / 2;
  box(rover, [0.16, 0.035, 0.3], [1.31, 1.7, z], mat.metal);
}
rod(rover, [1.03, 1.49, -0.14], [1.47, 1.24, -0.27], 0.055, mat.brightMetal);
rod(rover, [1.47, 1.24, -0.27], [1.91, 1.16, -0.25], 0.044, mat.metal);
const drill = cylinder(rover, 0.075, 0.042, 0.24, [2.03, 1.12, -0.25], mat.graphite, 16);
drill.rotation.z = Math.PI / 2;
cable(rover, [[0.77, 1.8, -0.68], [1.2, 1.58, -0.57], [1.52, 1.39, -0.38], [1.86, 1.25, -0.27]], 0x79654b);
cable(rover, [[-1.18, 1.74, 0.7], [-1.45, 1.62, 0.73], [-1.49, 1.43, 0.72], [-1.21, 1.2, 0.89]], 0x594e46);
for (const x of [-1.14, -0.44, 0.39, 1.07]) {
  for (const y of [1.39, 1.83]) {
    const bolt = new THREE.Mesh(new THREE.SphereGeometry(0.023, 8, 6), mat.dark);
    bolt.position.set(x, y, 0.72);
    rover.add(bolt);
  }
}

const wheels = [];
const wheelRadius = 0.43;
function createWheel(x, z) {
  const assembly = new THREE.Group();
  assembly.position.set(x, 0.47, z);
  rover.add(assembly);
  const tire = cylinder(assembly, wheelRadius, wheelRadius, 0.34, [0, 0, 0], mat.rubber, 36);
  tire.rotation.x = Math.PI / 2;
  const inner = cylinder(assembly, 0.335, 0.335, 0.355, [0, 0, 0], mat.metal, 32);
  inner.rotation.x = Math.PI / 2;
  for (const side of [-1, 1]) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.034, 9, 36), mat.brightMetal);
    rim.position.z = side * 0.19;
    rim.castShadow = true;
    assembly.add(rim);
    const hub = cylinder(assembly, 0.138, 0.138, 0.04, [0, 0, side * 0.21], mat.graphite, 24);
    hub.rotation.x = Math.PI / 2;
    const cap = cylinder(assembly, 0.073, 0.073, 0.046, [0, 0, side * 0.237], mat.gold, 20);
    cap.rotation.x = Math.PI / 2;
    for (let i = 0; i < 12; i++) {
      const angle = i * Math.PI / 6;
      rod(assembly,
        [Math.sin(angle) * 0.14, Math.cos(angle) * 0.14, side * 0.209],
        [Math.sin(angle) * 0.34, Math.cos(angle) * 0.34, side * 0.197],
        0.015, mat.brightMetal, 6);
    }
  }
  const lugGeometry = new THREE.BoxGeometry(0.145, 0.065, 0.37);
  const lugs = new THREE.InstancedMesh(lugGeometry, mat.graphite, 26);
  const transform = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  for (let i = 0; i < 26; i++) {
    const angle = i / 26 * Math.PI * 2;
    p.set(Math.sin(angle) * 0.432, Math.cos(angle) * 0.432, 0);
    q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), -angle);
    transform.compose(p, q, new THREE.Vector3(1, 1, 1));
    lugs.setMatrixAt(i, transform);
  }
  lugs.castShadow = true;
  assembly.add(lugs);
  wheels.push(assembly);
}

for (const side of [-1, 1]) {
  const z = side * 1.13;
  // Rocker-bogie links, axle housings and vertical shock struts.
  rod(rover, [-0.59, 1.2, side * 0.69], [-1.24, 0.55, z], 0.052, mat.brightMetal);
  rod(rover, [-0.56, 1.18, side * 0.69], [0.03, 0.56, z], 0.046, mat.metal);
  rod(rover, [0.52, 1.22, side * 0.69], [1.22, 0.55, z], 0.056, mat.brightMetal);
  rod(rover, [0.05, 0.56, z], [1.2, 0.55, z], 0.034, mat.metal);
  rod(rover, [-1.24, 0.55, z], [0.05, 0.55, z], 0.033, mat.metal);
  for (const x of [-1.22, 0, 1.22]) {
    rod(rover, [x, 0.47, side * 0.72], [x, 0.47, z], 0.071, mat.graphite);
    const pivot = cylinder(rover, 0.08, 0.08, 0.07, [x, 0.55, side * 0.93], mat.gold, 16);
    pivot.rotation.x = Math.PI / 2;
    createWheel(x, z);
  }
  rod(rover, [-0.48, 1.22, side * 0.73], [-0.98, 0.67, side * 0.91], 0.026, mat.gold);
  rod(rover, [0.53, 1.21, side * 0.73], [1.05, 0.65, side * 0.91], 0.026, mat.gold);
}

// Small orange registration mark on the front housing.
box(rover, [0.013, 0.1, 0.28], [1.225, 1.81, 0.18], mat.orange, false);

// Shallow ground contact and wheel impressions remain visible behind the rover.
const trackMaterial = new THREE.MeshStandardMaterial({ color: 0x63584a, roughness: 1, transparent: true, opacity: 0.2, depthWrite: false });
const trackGeometry = new THREE.BoxGeometry(0.034, 0.008, 0.32);
const trackMeshes = [];
for (const side of [-1, 1]) {
  const mesh = new THREE.InstancedMesh(trackGeometry, trackMaterial, 360);
  const matrix = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3(1, 1, 1);
  const q = new THREE.Quaternion();
  for (let i = 0; i < 360; i++) {
    const x = -18 + i * 0.155;
    p.set(x, terrainHeight(x, side * 1.13) + 0.012, side * 1.13);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (i % 2 ? -1 : 1) * 0.08);
    matrix.compose(p, q, s);
    mesh.setMatrixAt(i, matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.count = 0;
  mesh.receiveShadow = true;
  scene.add(mesh);
  trackMeshes.push(mesh);
}

const speed = 0.09;
let elapsedSeconds = 0;
let distance = 0;
let running = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let lastTime = performance.now();
let viewTransition = null;
const cameraButtons = [...document.querySelectorAll('.camera-button')];
const playPause = document.getElementById('play-pause');
const elapsedDisplay = document.getElementById('elapsed');
const distanceDisplay = document.getElementById('distance');
const speedDisplay = document.getElementById('speed');
const batteryDisplay = document.getElementById('battery');
const progress = document.getElementById('progress');

function setRunning(next) {
  running = next;
  document.getElementById('pause-icon').hidden = !running;
  document.getElementById('play-icon').hidden = running;
  playPause.setAttribute('aria-label', running ? '暂停行驶' : '继续行驶');
  speedDisplay.innerHTML = `${running ? speed.toFixed(2) : '0.00'} <small>m/s</small>`;
}
setRunning(running);
playPause.addEventListener('click', () => setRunning(!running));

function getView(name) {
  const x = rover.position.x;
  if (name === 'detail') return { position: new THREE.Vector3(x + 4.2, 3.6, 5.3), target: new THREE.Vector3(x + 0.2, 1.5, 0) };
  if (name === 'ground') return { position: new THREE.Vector3(x + 5.4, 1.8, 6.1), target: new THREE.Vector3(x + 0.1, 0.95, 0) };
  return { position: mobile ? new THREE.Vector3(x + 8.9, 6.4, 12.8) : new THREE.Vector3(x + 5.1, 3.7, 7.2), target: new THREE.Vector3(x, 1.2, 0) };
}

function activateView(name) {
  const destination = getView(name);
  viewTransition = {
    start: performance.now(),
    fromPosition: camera.position.clone(),
    fromTarget: controls.target.clone(),
    toPosition: destination.position,
    toTarget: destination.target
  };
  for (const button of cameraButtons) {
    const active = button.dataset.view === name;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  }
}
cameraButtons.forEach(button => button.addEventListener('click', () => activateView(button.dataset.view)));
document.getElementById('reset-view').addEventListener('click', () => activateView('overview'));
controls.addEventListener('start', () => {
  viewTransition = null;
  cameraButtons.forEach(button => { button.classList.remove('active'); button.setAttribute('aria-pressed', 'false'); });
  document.getElementById('hint').classList.add('hidden');
});
renderer.domElement.addEventListener('contextmenu', event => event.preventDefault());

const fullscreenButton = document.getElementById('fullscreen');
fullscreenButton.addEventListener('click', async () => {
  if (document.fullscreenElement) await document.exitFullscreen();
  else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
});
document.addEventListener('fullscreenchange', () => {
  const active = !!document.fullscreenElement;
  fullscreenButton.setAttribute('aria-label', active ? '退出全屏' : '进入全屏');
  fullscreenButton.title = active ? '退出全屏' : '全屏浏览';
});

function resize() {
  const width = viewport.clientWidth, height = viewport.clientHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}
new ResizeObserver(resize).observe(viewport);

function updateTelemetry() {
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = Math.floor(elapsedSeconds % 60);
  elapsedDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  distanceDisplay.innerHTML = `${distance.toFixed(2)} <small>m</small>`;
  batteryDisplay.innerHTML = `${Math.max(78, Math.round(96 - distance * 0.22))} <small>%</small>`;
  progress.style.width = `${(elapsedSeconds % 180) / 180 * 100}%`;
}

let telemetryAccumulator = 0;
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - lastTime) / 1000, 2);
  lastTime = now;
  if (running) {
    const step = speed * dt;
    elapsedSeconds += dt;
    distance += step;
    rover.position.x += step;
    camera.position.x += step;
    controls.target.x += step;
    sun.position.x += step;
    sun.target.position.x += step;
    for (const wheel of wheels) wheel.rotation.z -= step / wheelRadius;
    rover.position.y = Math.sin(elapsedSeconds * 2.2) * 0.009;
    rover.rotation.z = Math.sin(elapsedSeconds * 0.65) * 0.006;
    for (const mesh of trackMeshes) mesh.count = Math.min(360, Math.max(0, Math.floor((rover.position.x + 16.8) / 0.155)));
    telemetryAccumulator += dt;
    if (telemetryAccumulator > 0.1) { updateTelemetry(); telemetryAccumulator = 0; }
  }
  if (viewTransition) {
    const t = THREE.MathUtils.clamp((now - viewTransition.start) / 900, 0, 1);
    const eased = t * t * (3 - 2 * t);
    camera.position.lerpVectors(viewTransition.fromPosition, viewTransition.toPosition, eased);
    controls.target.lerpVectors(viewTransition.fromTarget, viewTransition.toTarget, eased);
    if (t >= 1) viewTransition = null;
  }
  earth.rotation.y += dt * 0.002;
  controls.update();
  renderer.render(scene, camera);
}
requestAnimationFrame(animate);
surfaceReady.finally(() => window.setTimeout(() => loading.classList.add('ready'), 300));
