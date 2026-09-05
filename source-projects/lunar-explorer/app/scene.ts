import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export type ViewMode = 'follow' | 'free';
export type Telemetry = { distance: number; speed: number; heading: number; slope: number };
export type Explorer = {
  setPlaying: (value: boolean) => void; setSpeed: (value: number) => void;
  setMode: (value: ViewMode) => void; resetView: () => void;
  zoom: (direction: number) => void; dispose: () => void;
};
const TAU = Math.PI * 2;

function random(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function hash(x: number, y: number) { const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123; return n - Math.floor(n); }
function noise(x: number, y: number) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(ix, iy), hash(ix + 1, iy), u), THREE.MathUtils.lerp(hash(ix, iy + 1), hash(ix + 1, iy + 1), u), v);
}
function fbm(x: number, y: number, octaves = 5) {
  let n = 0, a = .5; for (let i = 0; i < octaves; i++) { n += noise(x, y) * a; x = x * 2.03 + 13.1; y = y * 2.03 + 7.7; a *= .5; } return n;
}
const craterRandom = random(1889);
const craters = Array.from({ length: 65 }, (_, i) => {
  const a = craterRandom() * TAU, distance = 11 + craterRandom() * 190;
  return { x: Math.cos(a) * distance, z: Math.sin(a) * distance, radius: i < 5 ? 5 + craterRandom() * 7 : 1.3 + craterRandom() * 5, depth: .15 + craterRandom() * .22 };
});
export function terrainHeight(x: number, z: number): number {
  const distance = Math.hypot(x, z);
  const relief = THREE.MathUtils.smoothstep(distance, 14, 90);
  let h = (fbm(x * .044 + 10, z * .044 - 8) - .48) * (1.1 + relief * 10);
  h += (fbm(x * .58, z * .58, 3) - .45) * .14;
  for (const c of craters) {
    const d = Math.hypot(x - c.x, z - c.z) / c.radius;
    if (d < 1.6) h += c.radius * (Math.exp(-Math.pow((d - 1) / .14, 2)) * .085 - Math.max(0, 1 - d * d) * c.depth);
  }
  // A low, traversable ring keeps the driving route continuous.
  const ringBlend = 1 - THREE.MathUtils.smoothstep(Math.abs(Math.hypot(x - 24, z) - 24), 2.2, 4.8);
  const road = (fbm(x * .075, z * .075, 3) - .45) * .34 + (noise(x * .8, z * .8) - .5) * .035;
  return THREE.MathUtils.lerp(h, road, ringBlend * .96);
}

function makeTextures() {
  const size = 1024, rng = random(31);
  const data = new Uint8Array(size * size * 4), normals = new Uint8Array(size * size * 4), heights = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const h = fbm(x * .085, y * .085, 4) * .67 + rng() * .33;
    heights[y * size + x] = h;
    const g = 113 + h * 100, i = (y * size + x) * 4;
    data[i] = g * 1.01; data[i + 1] = g; data[i + 2] = g * .97; data[i + 3] = 255;
  }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = heights[y * size + ((x + 1) % size)] - heights[y * size + ((x - 1 + size) % size)];
    const dy = heights[((y + 1) % size) * size + x] - heights[((y - 1 + size) % size) * size + x];
    const n = new THREE.Vector3(-dx * 3, -dy * 3, 1).normalize(), i = (y * size + x) * 4;
    normals[i] = (n.x * .5 + .5) * 255; normals[i + 1] = (n.y * .5 + .5) * 255; normals[i + 2] = (n.z * .5 + .5) * 255; normals[i + 3] = 255;
  }
  const albedo = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  const normal = new THREE.DataTexture(normals, size, size, THREE.RGBAFormat);
  albedo.colorSpace = THREE.SRGBColorSpace;
  for (const texture of [albedo, normal]) { texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter; texture.generateMipmaps = true; texture.anisotropy = 8; texture.needsUpdate = true; }
  return { albedo, normal };
}
function labelTexture(text: string, small = '', bg = '#dadbd4', ink = '#1a2023') {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 256;
  const ctx = canvas.getContext('2d')!; ctx.fillStyle = bg; ctx.fillRect(0, 0, 512, 256);
  ctx.fillStyle = ink; ctx.font = '600 78px Arial'; ctx.textAlign = 'center'; ctx.fillText(text, 256, 127);
  ctx.font = '24px monospace'; ctx.fillText(small, 256, 185);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8; return texture;
}

function buildRover() {
  const root = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0xaaaeb0, metalness: .87, roughness: .29 });
  const lightMetal = new THREE.MeshStandardMaterial({ color: 0xe1e0d8, metalness: .56, roughness: .43 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x24282b, metalness: .8, roughness: .57 });
  const black = new THREE.MeshStandardMaterial({ color: 0x11181d, metalness: .48, roughness: .56 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x383a39, metalness: .7, roughness: .71 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xcc8e27, metalness: .91, roughness: .34 });
  const foilSilver = new THREE.MeshStandardMaterial({ color: 0xc3b8a1, metalness: .88, roughness: .39 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x132b38, metalness: .8, roughness: .09, clearcoat: 1 });
  const solar = new THREE.MeshPhysicalMaterial({ color: 0x172633, metalness: .66, roughness: .25, clearcoat: .72, clearcoatRoughness: .23 });
  const solarLine = new THREE.MeshStandardMaterial({ color: 0x68757b, metalness: .9, roughness: .35 });
  const copper = new THREE.MeshStandardMaterial({ color: 0xb28d52, metalness: .75, roughness: .39 });
  const white = new THREE.MeshStandardMaterial({ color: 0xc3c1b5, metalness: .2, roughness: .88 });
  function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, position: number[], parent: THREE.Object3D = root) {
    const item = new THREE.Mesh(geometry, material); item.position.set(position[0], position[1], position[2]); item.castShadow = true; item.receiveShadow = true; parent.add(item); return item;
  }
  function box(w: number, h: number, d: number, x: number, y: number, z: number, material: THREE.Material = metal, parent: THREE.Object3D = root) { return mesh(new THREE.BoxGeometry(w, h, d), material, [x, y, z], parent); }
  function cylinder(r: number, length: number, position: number[], material: THREE.Material = metal, parent: THREE.Object3D = root, r2 = r) { return mesh(new THREE.CylinderGeometry(r, r2, length, 24), material, position, parent); }
  function rod(a: number[], b: number[], radius: number, material: THREE.Material = metal, parent: THREE.Object3D = root) {
    const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b), direction = vb.clone().sub(va);
    const item = cylinder(radius, direction.length(), va.add(vb).multiplyScalar(.5).toArray(), material, parent);
    item.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()); return item;
  }
  function wire(points: number[][], material: THREE.Material = black, radius = .019, parent: THREE.Object3D = root) { return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), 22, radius, 7, false), material, [0, 0, 0], parent); }
  function bolt(x: number, y: number, z: number, parent: THREE.Object3D = root) { return mesh(new THREE.CylinderGeometry(.022, .022, .013, 6), metal, [x, y, z], parent); }
  function foil(w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material) {
    const geometry = new THREE.BoxGeometry(w, h, d, 32, 16, 32), position = geometry.attributes.position, normal = geometry.attributes.normal;
    for (let i = 0; i < position.count; i++) {
      const px = position.getX(i), py = position.getY(i), pz = position.getZ(i);
      const fold = Math.sin(px * 44 + py * 30 + pz * 35) * Math.cos(py * 67 - pz * 12) * .012 + (noise(px * 42 + pz * 29, py * 38) - .5) * .024;
      position.setXYZ(i, px + normal.getX(i) * fold, py + normal.getY(i) * fold, pz + normal.getZ(i) * fold);
    }
    geometry.computeVertexNormals(); return mesh(geometry, mat, [x, y, z]);
  }
  // Structural chassis, insulated electronics bay, and layered instrument deck.
  box(1.62, .18, 2.12, 0, 1.06, 0, dark);
  foil(1.58, .63, 1.92, 0, 1.44, -.02, gold);
  box(1.81, .11, 2.15, 0, 1.8, 0, lightMetal);
  box(1.85, .035, 2.19, 0, 1.864, 0, dark);
  box(1.77, .045, 2.1, 0, 1.903, 0, lightMetal);
  for (const side of [-1, 1]) {
    box(.043, .67, 1.96, side * .799, 1.45, -.02, metal);
    for (let j = 0; j < 4; j++) box(.01, .041, 1.94, side * .825, 1.15 + j * .19, 0, copper);
    for (let j = 0; j < 7; j++) bolt(side * .87, 1.939, -.96 + j * .31);
    box(.3, .31, .75, side * .91, 1.46, -.12, dark);
    for (let j = 0; j < 15; j++) box(.325, .013, .68, side * .91, 1.32 + j * .02, -.12, metal);
    box(.08, .53, .09, side * .83, 1.43, -.84, lightMetal);
    box(.08, .53, .09, side * .83, 1.43, .83, lightMetal);
    wire([[side * .56, 1.97, -.92], [side * .8, 1.91, -.95], [side * .9, 1.42, -.99], [side * .52, 1.06, -.84]], black, .026);
    wire([[side * .7, 1.9, .6], [side * .96, 1.75, .84], [side * .91, 1.12, .72], [side * 1.02, .79, .46]], copper, .015);
  }
  // Nameplates are physically attached to the vehicle and remain legible when orbiting.
  const plateMat = new THREE.MeshStandardMaterial({ map: labelTexture('SELENE', 'LUNAR EXPLORATION / 01'), metalness: .25, roughness: .6 });
  mesh(new THREE.PlaneGeometry(.81, .405), plateMat, [0, 1.46, .969]);
  for (const side of [-1, 1]) { const plate = mesh(new THREE.PlaneGeometry(.61, .305), plateMat, [side * .856, 1.5, .46]); plate.rotation.y = side * Math.PI / 2; }
  for (const x of [-.68, -.43, .43, .68]) { const port = cylinder(.055, .045, [x, 1.65, 1], dark); port.rotation.x = Math.PI / 2; }

  // Six articulated metal wheels, with hubs, spokes, wire rings and raised grousers.
  const wheels: { anchor: THREE.Group; spin: THREE.Group; x: number; z: number }[] = [];
  for (const side of [-1, 1]) {
    const pivot = cylinder(.145, .17, [side * .93, 1.13, .05], metal); pivot.rotation.z = Math.PI / 2;
    rod([side * .91, 1.13, .05], [side * 1.17, .7, 1.21], .065, lightMetal);
    rod([side * .91, 1.13, .05], [side * 1.14, .76, -.74], .067, lightMetal);
    rod([side * 1.14, .76, -.74], [side * 1.19, .5, -1.26], .055, metal);
    rod([side * 1.14, .76, -.74], [side * 1.19, .5, 0], .055, metal);
    rod([side * .93, 1.14, -.69], [side * 1.17, .56, -1.2], .027, dark);
    for (const z of [-1.27, 0, 1.27]) {
      const x = side * 1.22, anchor = new THREE.Group(), spin = new THREE.Group(); anchor.position.set(x, .49, z); anchor.add(spin); root.add(anchor); wheels.push({ anchor, spin, x, z });
      const tire = cylinder(.463, .32, [0, 0, 0], rubber, spin); tire.rotation.z = Math.PI / 2;
      for (let i = 0; i < 11; i++) { const ring = mesh(new THREE.TorusGeometry(.468, .007, 5, 64), metal, [-.16 + i * .032, 0, 0], spin); ring.rotation.y = Math.PI / 2; }
      for (let i = 0; i < 40; i++) {
        const a = i / 40 * TAU;
        const tread = box(.355, .039, .036, 0, Math.cos(a) * .476, Math.sin(a) * .476, lightMetal, spin); tread.rotation.x = a;
        for (const s of [-1, 1]) {
          const small = box(.155, .025, .028, s * .082, Math.cos(a + .032) * .473, Math.sin(a + .032) * .473, metal, spin); small.rotation.x = a; small.rotation.y = s * .16;
        }
      }
      for (const face of [-1, 1]) {
        const ring = mesh(new THREE.TorusGeometry(.401, .025, 8, 64), metal, [face * .175, 0, 0], spin); ring.rotation.y = Math.PI / 2;
        const rim = cylinder(.363, .018, [face * .164, 0, 0], dark, spin); rim.rotation.z = Math.PI / 2;
        for (let i = 0; i < 12; i++) {
          const a = i / 12 * TAU;
          rod([face * .179, Math.cos(a) * .14, Math.sin(a) * .14], [face * .179, Math.cos(a + .15) * .38, Math.sin(a + .15) * .38], .022, metal, spin);
          const screw = mesh(new THREE.CylinderGeometry(.023, .023, .019, 6), lightMetal, [face * .2, Math.cos(a) * .278, Math.sin(a) * .278], spin); screw.rotation.z = Math.PI / 2;
        }
        const hub = cylinder(.145, .064, [face * .197, 0, 0], lightMetal, spin); hub.rotation.z = Math.PI / 2;
        const cap = cylinder(.092, .072, [face * .227, 0, 0], dark, spin); cap.rotation.z = Math.PI / 2;
        const axle = cylinder(.046, .079, [face * .245, 0, 0], copper, spin); axle.rotation.z = Math.PI / 2;
      }
      rod([side * .79, 1.1, z * .82], [x - side * .12, .51, z], .044, lightMetal);
      wire([[side * .85, 1.08, z * .86], [side * 1.08, .94, z + .1], [side * 1.1, .53, z + .02]], black, .016);
    }
  }
  // Twin photovoltaic wings with individual cells, busbars and rear support spars.
  for (const side of [-1, 1]) {
    const panel = new THREE.Group(); panel.position.set(side * 1.42, 2.06, -.13); panel.rotation.z = side * .075; root.add(panel);
    box(1.12, .055, 2.25, 0, 0, 0, metal, panel); box(1.055, .016, 2.18, 0, .038, 0, black, panel);
    for (let row = 0; row < 11; row++) for (let col = 0; col < 5; col++) {
      const x = -.419 + col * .209, z = -.985 + row * .197;
      box(.197, .009, .181, x, .052, z, solar, panel);
      for (let bus = 0; bus < 3; bus++) box(.0018, .002, .177, x + (bus - 1) * .057, .058, z, solarLine, panel);
      box(.19, .0015, .002, x, .059, z, solarLine, panel);
    }
    for (const z of [-1.11, 1.11]) box(1.13, .047, .025, 0, .035, z, lightMetal, panel);
    for (const x of [-.55, .55]) box(.022, .047, 2.24, x, .035, 0, lightMetal, panel);
    for (const z of [-.78, .65]) {
      rod([side * .73, 1.77, z], [side * 1.82, 1.99, z], .032, metal);
      const hinge = cylinder(.049, .13, [side * .88, 2.017, z], dark); hinge.rotation.x = Math.PI / 2;
    }
  }
  // Insulated payload modules and thermal radiators.
  foil(.61, .43, .66, -.27, 2.16, -.55, foilSilver);
  box(.65, .025, .7, -.27, 2.39, -.55, lightMetal);
  for (let i = 0; i < 11; i++) box(.55, .014, .029, -.27, 2.411, -.84 + i * .055, white);
  box(.38, .24, .43, .36, 2.075, -.76, dark);
  for (let i = 0; i < 8; i++) box(.41, .017, .39, .36, 1.98 + i * .025, -.76, lightMetal);
  box(.25, .18, .35, -.38, 2.018, .43, lightMetal);
  for (const z of [-.87, .8]) for (const x of [-.65, .65]) bolt(x, 1.948, z);
  wire([[-.57, 2.38, -.65], [-.69, 2.32, -.5], [-.63, 1.99, -.1], [-.12, 1.99, .4]], black, .024);
  wire([[.43, 2.2, -.8], [.55, 2.27, -.61], [.6, 1.98, -.36], [.17, 1.99, .31]], copper, .014);

  // Panoramic mast with stereo optics, laser aperture and flexible cable loom.
  cylinder(.16, .14, [0, 2, .54], dark);
  cylinder(.106, .2, [0, 2.12, .54], metal);
  cylinder(.073, .91, [0, 2.66, .54], lightMetal);
  for (const y of [2.26, 2.72, 3.06]) cylinder(.089, .042, [0, y, .54], dark);
  wire([[.11, 2.09, .57], [.13, 2.44, .57], [.12, 2.78, .6], [.08, 3.12, .61]], black, .023);
  const head = new THREE.Group(); head.position.set(0, 3.17, .54); root.add(head);
  box(.74, .3, .31, 0, 0, 0, lightMetal, head);
  box(.77, .025, .35, 0, .157, .008, metal, head);
  box(.66, .23, .025, 0, -.005, .167, dark, head);
  for (const x of [-.235, .235]) {
    const barrel = cylinder(.105, .11, [x, 0, .21], metal, head); barrel.rotation.x = Math.PI / 2;
    const lensRim = cylinder(.081, .025, [x, 0, .269], black, head); lensRim.rotation.x = Math.PI / 2;
    const lens = cylinder(.065, .027, [x, 0, .286], glass, head); lens.rotation.x = Math.PI / 2;
    mesh(new THREE.SphereGeometry(.018, 12, 8), new THREE.MeshStandardMaterial({ color: 0x8cabb2, metalness: .5, roughness: .1 }), [x - .017, .025, .3], head);
  }
  box(.055, .066, .04, 0, 0, .19, black, head);
  for (const x of [-.333, .333]) for (const y of [-.107, .107]) { const screw = bolt(x, y, .182, head); screw.rotation.x = Math.PI / 2; }
  // High-gain dish antenna: curved reflector, feed horn and tripod stays.
  rod([.39, 1.97, -.28], [.43, 2.59, -.31], .038, metal);
  const dish = new THREE.Group(); dish.position.set(.43, 2.64, -.33); dish.rotation.x = -.42; dish.rotation.z = -.23; root.add(dish);
  const dishPoints: THREE.Vector2[] = [];
  for (let i = 0; i <= 24; i++) { const r = i / 24 * .39; dishPoints.push(new THREE.Vector2(r, r * r * .65)); }
  const dishMaterial = new THREE.MeshStandardMaterial({ color: 0xd5d4c7, metalness: .63, roughness: .46, side: THREE.DoubleSide });
  mesh(new THREE.LatheGeometry(dishPoints, 64), dishMaterial, [0, 0, 0], dish);
  const lip = mesh(new THREE.TorusGeometry(.39, .008, 7, 64), metal, [0, .099, 0], dish); lip.rotation.x = Math.PI / 2;
  for (let i = 0; i < 3; i++) { const a = i / 3 * TAU; rod([Math.cos(a) * .32, .069, Math.sin(a) * .32], [0, .42, 0], .008, dark, dish); }
  cylinder(.03, .074, [0, .42, 0], gold, dish);
  rod([-.62, 1.96, -.85], [-.65, 3.22, -.87], .009, dark);
  cylinder(.04, .15, [-.65, 2.08, -.87], lightMetal);
  mesh(new THREE.SphereGeometry(.018, 8, 8), black, [-.65, 3.24, -.87]);

  // Folded sampling arm with distinct joints, actuators and science head.
  const armBase = cylinder(.13, .13, [.49, 1.11, 1.06], dark); armBase.rotation.x = Math.PI / 2;
  rod([.49, 1.1, 1.09], [-.42, .88, 1.24], .064, lightMetal);
  rod([-.42, .88, 1.24], [-.67, .64, 1.49], .055, lightMetal);
  for (const [x, y, z] of [[-.42, .88, 1.24], [-.67, .64, 1.49]]) { const joint = cylinder(.09, .13, [x, y, z], dark); joint.rotation.x = Math.PI / 2; }
  rod([.48, 1.14, 1.17], [-.31, 1, 1.28], .026, metal);
  wire([[.46, 1.17, 1.13], [.01, 1.13, 1.31], [-.43, .98, 1.34], [-.7, .7, 1.56]], black, .019);
  const sampler = cylinder(.115, .21, [-.67, .51, 1.49], lightMetal); sampler.rotation.z = -.22;
  for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; box(.029, .084, .025, -.67 + Math.cos(a) * .089, .387, 1.49 + Math.sin(a) * .089, dark); }
  for (const x of [-.62, .62]) {
    box(.19, .12, .1, x, 1.79, 1.11, dark);
    const lens = cylinder(.044, .03, [x, 1.79, 1.178], glass); lens.rotation.x = Math.PI / 2;
  }

  // Batch static details by material; preserve independently animated wheel and head parts.
  const dynamic = new Set<THREE.Object3D>([head, ...wheels.map(w => w.anchor)]);
  root.updateMatrixWorld(true);
  const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const oldMeshes: THREE.Mesh[] = [];
  function gather(obj: THREE.Object3D) {
    if (dynamic.has(obj)) return;
    if (obj instanceof THREE.Mesh && !Array.isArray(obj.material)) {
      const geo = obj.geometry.clone(); geo.applyMatrix4(obj.matrixWorld);
      const list = batches.get(obj.material) || []; list.push(geo); batches.set(obj.material, list); oldMeshes.push(obj);
    }
    for (const child of obj.children) gather(child);
  }
  for (const child of root.children) gather(child);
  for (const old of oldMeshes) { old.removeFromParent(); old.geometry.dispose(); }
  for (const [material, geos] of batches) {
    const merged = mergeGeometries(geos); if (merged) mesh(merged, material, [0, 0, 0]);
    geos.forEach(g => g.dispose());
  }
  // Each wheel is also merged, retaining one rotation node per wheel.
  for (const { spin } of wheels) {
    const groups = new Map<THREE.Material, THREE.BufferGeometry[]>();
    spin.updateMatrix();
    for (const obj of [...spin.children]) if (obj instanceof THREE.Mesh) {
      obj.updateMatrix(); const g = obj.geometry.clone().applyMatrix4(obj.matrix);
      const list = groups.get(obj.material) || []; list.push(g); groups.set(obj.material, list); obj.geometry.dispose(); spin.remove(obj);
    }
    for (const [mat, geos] of groups) { const merged = mergeGeometries(geos); if (merged) mesh(merged, mat, [0, 0, 0], spin); geos.forEach(g => g.dispose()); }
  }
  return { root, wheels, head };
}

export function createExplorer(container: HTMLDivElement, onTelemetry: (data: Telemetry) => void): Explorer {
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x030507);
  const camera = new THREE.PerspectiveCamera(39, container.clientWidth / container.clientHeight, .08, 1800);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75)); renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .98;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement); renderer.domElement.tabIndex = 0; renderer.domElement.setAttribute('aria-label', '月面三维场景；拖动旋转，滚轮缩放，右键平移');
  const pmrem = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, .055); scene.environment = environment.texture; scene.environmentIntensity = .43; room.dispose(); pmrem.dispose();
  const hemi = new THREE.HemisphereLight(0xbfcada, 0x8b8477, .26); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff7e8, 4.5); sun.position.set(-16, 14, 11); sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096); sun.shadow.camera.left = -15; sun.shadow.camera.right = 15; sun.shadow.camera.top = 15; sun.shadow.camera.bottom = -15; sun.shadow.camera.near = .5; sun.shadow.camera.far = 75; sun.shadow.normalBias = .018; sun.shadow.bias = -.00008; sun.shadow.radius = 1.3; scene.add(sun, sun.target);
  const textures = makeTextures();
  const terrainMat = new THREE.MeshStandardMaterial({ map: textures.albedo, normalMap: textures.normal, normalScale: new THREE.Vector2(.62, .62), roughness: .99, metalness: 0, vertexColors: true, color: 0xa39f98 });
  // Non-uniform grid concentrates geometry beneath the rover and stretches toward the horizon.
  const segments = 380, extent = 480, ground = new THREE.PlaneGeometry(extent, extent, segments, segments); ground.rotateX(-Math.PI / 2);
  const pos = ground.attributes.position, uv = ground.attributes.uv, colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x0 = pos.getX(i) / (extent / 2), z0 = pos.getZ(i) / (extent / 2);
    const x = Math.sign(x0) * Math.pow(Math.abs(x0), 1.75) * extent / 2, z = Math.sign(z0) * Math.pow(Math.abs(z0), 1.75) * extent / 2;
    const y = terrainHeight(x, z); pos.setXYZ(i, x, y, z); uv.setXY(i, x / 7, z / 7);
    const shade = .66 + fbm(x * .24, z * .24, 3) * .42; colors[i * 3] = shade; colors[i * 3 + 1] = shade; colors[i * 3 + 2] = shade;
  }
  ground.setAttribute('color', new THREE.BufferAttribute(colors, 3)); ground.computeVertexNormals();
  const terrain = new THREE.Mesh(ground, terrainMat); terrain.receiveShadow = true; scene.add(terrain);
  // Distant relief stays fully volumetric: the horizon changes while the camera moves.
  const mountainRng = random(84), distantMat = new THREE.MeshStandardMaterial({ color: 0x797771, roughness: 1, flatShading: false });
  const mountainGeo = new THREE.PlaneGeometry(1500, 1500, 170, 170); mountainGeo.rotateX(-Math.PI / 2);
  const mp = mountainGeo.attributes.position;
  for (let i = 0; i < mp.count; i++) {
    const x = mp.getX(i), z = mp.getZ(i), d = Math.max(Math.abs(x), Math.abs(z));
    const edge = THREE.MathUtils.smoothstep(d, 195, 300);
    const h = terrainHeight(x, z) + edge * (fbm(x * .012, z * .012) * 44 - 9);
    mp.setY(i, d < 225 ? -12 : h - 2);
  }
  mountainGeo.computeVertexNormals(); scene.add(new THREE.Mesh(mountainGeo, distantMat));
  // Thousands of individually oriented, irregular regolith fragments.
  const rockGeo = new THREE.IcosahedronGeometry(1, 1), rockPositions = rockGeo.attributes.position;
  for (let i = 0; i < rockPositions.count; i++) {
    const x = rockPositions.getX(i), y = rockPositions.getY(i), z = rockPositions.getZ(i), scale = .78 + noise(x * 4 + z * 2, y * 4) * .43;
    rockPositions.setXYZ(i, x * scale, y * scale * .77, z * scale);
  }
  rockGeo.computeVertexNormals();
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x87857e, roughness: 1, flatShading: true, map: textures.albedo, normalMap: textures.normal, normalScale: new THREE.Vector2(.35, .35) });
  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, 4200); rocks.castShadow = true; rocks.receiveShadow = true;
  const dummy = new THREE.Object3D(), color = new THREE.Color();
  for (let i = 0; i < 4200; i++) {
    const angle = mountainRng() * TAU, radius = 3.1 + Math.pow(mountainRng(), 1.4) * 180;
    const x = Math.sin(angle) * radius, z = Math.cos(angle) * radius;
    let s = .024 + Math.pow(mountainRng(), 4) * .6;
    if (i % 37 === 0 && radius > 9) s *= 3;
    if (Math.abs(Math.hypot(x - 24, z) - 24) < 1.85) s *= .2;
    dummy.position.set(x, terrainHeight(x, z) + s * .27, z); dummy.scale.set(s * (1 + mountainRng() * .7), s * (.7 + mountainRng() * .4), s); dummy.rotation.set(mountainRng() * 1.5, mountainRng() * TAU, mountainRng() * .8); dummy.updateMatrix(); rocks.setMatrixAt(i, dummy.matrix);
    color.setScalar(.57 + mountainRng() * .5); rocks.setColorAt(i, color);
  }
  rocks.instanceMatrix.needsUpdate = true; scene.add(rocks);
  // A sparse star field; stars occupy three-dimensional space rather than a backdrop image.
  const starCount = 1700, starPositions = new Float32Array(starCount * 3), starColors = new Float32Array(starCount * 3), starRng = random(929);
  for (let i = 0; i < starCount; i++) {
    const a = starRng() * TAU, h = starRng() * .97 + .02, r = 950 + starRng() * 300, radial = Math.sqrt(1 - h * h);
    starPositions.set([Math.cos(a) * radial * r, h * r, Math.sin(a) * radial * r], i * 3);
    const b = .15 + Math.pow(starRng(), 3) * .6; starColors.set([b * .88, b * .93, b], i * 3);
  }
  const starGeo = new THREE.BufferGeometry(); starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3)); starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ size: 1.05, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: .72, depthWrite: false })); scene.add(stars);
  const rover = buildRover(); scene.add(rover.root);
  // Tracks are individual imprints on the actual terrain; new marks follow wheel contact.
  const trackMat = new THREE.MeshStandardMaterial({ color: 0x4c4a43, roughness: 1, transparent: true, opacity: .55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const trackGeo = new THREE.PlaneGeometry(.34, .066); trackGeo.rotateX(-Math.PI / 2);
  const trackCount = 4200, tracks = new THREE.InstancedMesh(trackGeo, trackMat, trackCount); tracks.receiveShadow = true; tracks.frustumCulled = false;
  let trackIndex = 0, filledTracks = 0, lastStamp = 0;
  const trackMatrix = new THREE.Object3D();
  tracks.count = 0; scene.add(tracks);
  const tempPos = new THREE.Vector3(), moveDelta = new THREE.Vector3();
  function stamp(x: number, z: number, heading: number) {
    const h = terrainHeight(x, z), dx = (terrainHeight(x + .08, z) - terrainHeight(x - .08, z)) / .16, dz = (terrainHeight(x, z + .08) - terrainHeight(x, z - .08)) / .16;
    trackMatrix.position.set(x, h + .009, z); trackMatrix.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(-dx, 1, -dz).normalize()); trackMatrix.rotateY(heading); trackMatrix.updateMatrix(); tracks.setMatrixAt(trackIndex, trackMatrix.matrix); trackIndex = (trackIndex + 1) % trackCount; filledTracks = Math.min(filledTracks + 1, trackCount); tracks.count = filledTracks;
  }
  function pathAt(distance: number) { const a = distance / 24; return { x: 24 - Math.cos(a) * 24, z: Math.sin(a) * 24, heading: a }; }
  for (let d = -13; d < -1.4; d += .17) { const p = pathAt(d); for (const side of [-1, 1]) stamp(p.x + Math.cos(p.heading) * side * 1.22, p.z - Math.sin(p.heading) * side * 1.22, p.heading); }
  tracks.instanceMatrix.needsUpdate = true;
  // A subtle contact shadow preserves local grounding under the chassis.
  const contactCanvas = document.createElement('canvas'); contactCanvas.width = contactCanvas.height = 128;
  const cc = contactCanvas.getContext('2d')!, gradient = cc.createRadialGradient(64, 64, 8, 64, 64, 64); gradient.addColorStop(0, 'rgba(0,0,0,.48)'); gradient.addColorStop(1, 'rgba(0,0,0,0)'); cc.fillStyle = gradient; cc.fillRect(0, 0, 128, 128);
  const contactTexture = new THREE.CanvasTexture(contactCanvas), contact = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.8), new THREE.MeshBasicMaterial({ map: contactTexture, transparent: true, depthWrite: false })); contact.rotation.x = -Math.PI / 2; scene.add(contact);

  const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.dampingFactor = .065; controls.rotateSpeed = .52; controls.zoomSpeed = .85; controls.panSpeed = .65; controls.minDistance = 2.2; controls.maxDistance = 100; controls.maxPolarAngle = Math.PI * .485; controls.minPolarAngle = .09; controls.screenSpacePanning = true;
  let playing = true, speed = 1, mode: ViewMode = 'follow', distance = 0, elapsed = 0, telemetryTime = 0, disposed = false;
  let frame = 0, previous = performance.now(); const keys = new Set<string>();
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  function setView() {
    const mobile = container.clientWidth < 700;
    camera.position.set(rover.root.position.x + (mobile ? 9.4 : 7.6), rover.root.position.y + (mobile ? 4.7 : 3.6), rover.root.position.z + (mobile ? 12.8 : 10.2));
    controls.target.copy(rover.root.position).add(new THREE.Vector3(0, mobile ? 1.7 : 1.65, 0)); controls.update();
  }
  setView();
  function onKeyDown(e: KeyboardEvent) { if ((e.target as HTMLElement).closest('button, input, [role="dialog"]')) return; if (mode === 'free' && ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) { e.preventDefault(); keys.add(e.code); } }
  function onKeyUp(e: KeyboardEvent) { keys.delete(e.code); }
  function clearKeys() { keys.clear(); }
  window.addEventListener('keydown', onKeyDown); window.addEventListener('keyup', onKeyUp); window.addEventListener('blur', clearKeys);
  const resize = new ResizeObserver(() => { if (disposed) return; const w = container.clientWidth, h = container.clientHeight; camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h); }); resize.observe(container);
  function render(time: number) {
    if (disposed) return;
    frame = requestAnimationFrame(render);
    const dt = Math.min((time - previous) / 1000, .05); previous = time;
    if (document.hidden) return;
    if (playing) { distance += dt * .12 * speed; elapsed += dt * speed; }
    const p = pathAt(distance), oldPosition = rover.root.position.clone();
    const front = terrainHeight(p.x + Math.sin(p.heading) * 1.27, p.z + Math.cos(p.heading) * 1.27), rear = terrainHeight(p.x - Math.sin(p.heading) * 1.27, p.z - Math.cos(p.heading) * 1.27);
    const left = terrainHeight(p.x - Math.cos(p.heading) * 1.22, p.z + Math.sin(p.heading) * 1.22), right = terrainHeight(p.x + Math.cos(p.heading) * 1.22, p.z - Math.sin(p.heading) * 1.22);
    const pitch = Math.atan2(front - rear, 2.54), roll = Math.atan2(right - left, 2.44);
    const height = (front + rear + left + right) * .25;
    rover.root.position.set(p.x, height + .016, p.z); rover.root.rotation.order = 'YXZ'; rover.root.rotation.set(-pitch, p.heading, roll);
    rover.root.updateMatrixWorld(true);
    for (const w of rover.wheels) {
      tempPos.set(w.x, 0, w.z).applyAxisAngle(new THREE.Vector3(0, 1, 0), p.heading).add(rover.root.position);
      const wheelGround = terrainHeight(tempPos.x, tempPos.z);
      w.anchor.position.y = .49 + THREE.MathUtils.clamp(wheelGround - height - Math.sin(pitch) * w.z - Math.sin(roll) * w.x, -.19, .19);
      w.spin.rotation.x = distance / .485;
    }
    if (!motionPreference.matches) rover.head.rotation.y = Math.sin(elapsed * .065) * .15;
    contact.position.set(p.x, height + .019, p.z); contact.rotation.set(-Math.PI / 2, 0, -p.heading);
    if (distance - lastStamp > .17) {
      const rearPoint = pathAt(distance - 1.27); for (const side of [-1, 1]) stamp(rearPoint.x + Math.cos(rearPoint.heading) * side * 1.22, rearPoint.z - Math.sin(rearPoint.heading) * side * 1.22, rearPoint.heading);
      lastStamp = distance; tracks.instanceMatrix.needsUpdate = true;
    }
    if (mode === 'follow') { moveDelta.copy(rover.root.position).sub(oldPosition); camera.position.add(moveDelta); controls.target.add(moveDelta); }
    if (mode === 'free' && keys.size) {
      const forward = new THREE.Vector3(); camera.getWorldDirection(forward); forward.y = 0; forward.normalize();
      const rightVector = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
      const move = new THREE.Vector3();
      if (keys.has('KeyW') || keys.has('ArrowUp')) move.add(forward); if (keys.has('KeyS') || keys.has('ArrowDown')) move.sub(forward);
      if (keys.has('KeyD') || keys.has('ArrowRight')) move.add(rightVector); if (keys.has('KeyA') || keys.has('ArrowLeft')) move.sub(rightVector);
      if (keys.has('KeyE')) move.y += 1; if (keys.has('KeyQ')) move.y -= 1;
      move.normalize().multiplyScalar(dt * 4.5); camera.position.add(move); controls.target.add(move);
    }
    controls.update();
    camera.position.y = Math.max(camera.position.y, terrainHeight(camera.position.x, camera.position.z) + .4);
    sun.position.set(p.x - 16, height + 14, p.z + 11); sun.target.position.copy(rover.root.position);
    if (time - telemetryTime > 250) { onTelemetry({ distance, speed: playing ? .12 * speed : 0, heading: (THREE.MathUtils.radToDeg(p.heading) % 360 + 360) % 360, slope: THREE.MathUtils.radToDeg(Math.hypot(pitch, roll)) }); telemetryTime = time; }
    renderer.render(scene, camera);
  }
  frame = requestAnimationFrame(render);
  return {
    setPlaying(value) { playing = value; }, setSpeed(value) { speed = value; },
    setMode(value) { mode = value; keys.clear(); if (value === 'follow') { const delta = rover.root.position.clone().add(new THREE.Vector3(0, 1.65, 0)).sub(controls.target); controls.target.add(delta); camera.position.add(delta); } },
    resetView() { mode = 'follow'; keys.clear(); setView(); },
    zoom(direction) { const delta = camera.position.clone().sub(controls.target); const length = THREE.MathUtils.clamp(delta.length() * (direction > 0 ? 1.2 : 1 / 1.2), controls.minDistance, controls.maxDistance); camera.position.copy(controls.target).add(delta.setLength(length)); controls.update(); },
    dispose() {
      disposed = true; cancelAnimationFrame(frame); resize.disconnect(); controls.dispose(); window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); window.removeEventListener('blur', clearKeys);
      const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textureSet = new Set<THREE.Texture>();
      scene.traverse(obj => { if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) { geometries.add(obj.geometry); for (const mat of Array.isArray(obj.material) ? obj.material : [obj.material]) materials.add(mat); } });
      materials.forEach(mat => { for (const value of Object.values(mat)) if (value instanceof THREE.Texture) textureSet.add(value); mat.dispose(); }); geometries.forEach(g => g.dispose()); textureSet.forEach(t => t.dispose()); environment.dispose(); sun.shadow.dispose(); renderer.dispose(); renderer.domElement.remove();
    },
  };
}
