// ============================================================================
//  02-voxel: sparse voxel grids → InstancedMesh batches / merged meshes
// ============================================================================
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v3 = new THREE.Vector3(), _s3 = new THREE.Vector3();
const _c = new THREE.Color(), _e = new THREE.Euler();

class Vox {
  constructor(s, ox = 0, oy = 0, oz = 0) { this.s = s; this.o = [ox, oy, oz]; this.m = new Map(); }
  static k(i, j, k) { return ((i + 1024) * 2048 + (j + 1024)) * 2048 + (k + 1024); }
  set(i, j, k, c, e = 0, w = 0) { this.m.set(Vox.k(i, j, k), [i, j, k, c, e, w]); return this; }
  has(i, j, k) { return this.m.has(Vox.k(i, j, k)); }
  get(i, j, k) { return this.m.get(Vox.k(i, j, k)); }
  del(i, j, k) { this.m.delete(Vox.k(i, j, k)); }
  // world → index
  ix(x) { return Math.round((x - this.o[0]) / this.s); }
  iy(y) { return Math.round((y - this.o[1]) / this.s); }
  iz(z) { return Math.round((z - this.o[2]) / this.s); }
  at(x, y, z, c, e = 0, w = 0) { return this.set(this.ix(x), this.iy(y), this.iz(z), c, e, w); }
  box(i0, j0, k0, i1, j1, k1, c, e = 0, w = 0) {
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) for (let k = k0; k <= k1; k++) this.set(i, j, k, typeof c === 'function' ? c(i, j, k) : c, e, w);
    return this;
  }
  line(a, b, c, e = 0, w = 0) { // voxel line between index points
    const n = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]), Math.abs(b[2] - a[2]), 1);
    for (let t = 0; t <= n; t++) this.set(Math.round(lerp(a[0], b[0], t / n)), Math.round(lerp(a[1], b[1], t / n)), Math.round(lerp(a[2], b[2], t / n)), c, e, w);
  }
  exposed(i, j, k) {
    return !(this.has(i + 1, j, k) && this.has(i - 1, j, k) && this.has(i, j + 1, k) && this.has(i, j - 1, k) && this.has(i, j, k + 1) && this.has(i, j, k - 1));
  }
  // append instance records, optionally transformed by a matrix
  toList(out = [], { jitter = 0.07, matrix = null, cull = true } = {}) {
    const s = this.s;
    let q = null;
    if (matrix) { q = new THREE.Quaternion(); matrix.decompose(_v3, q, _s3); }
    for (const v of this.m.values()) {
      const [i, j, k, c, e, w] = v;
      if (cull && !this.exposed(i, j, k)) continue;
      _v3.set(this.o[0] + i * s, this.o[1] + j * s, this.o[2] + k * s);
      if (matrix) _v3.applyMatrix4(matrix);
      out.push({ x: _v3.x, y: _v3.y, z: _v3.z, s, c, e, w, q, j: jitter * (hash3(i, j, k) * 2 - 1) });
    }
    return out;
  }
}

// deterministic brightness jitter so voxels read as individual blocks
function jitterColor(col, hex, j) {
  col.setHex(hex);
  const f = 1 + j;
  col.r *= f; col.g *= f; col.b *= f;
  return col;
}

// Build an InstancedMesh of unit cubes from instance records.
function makeInstanced(list, mat, { cast = true, receive = true, depth = MAT.depthWind, name = '' } = {}) {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const n = Math.max(1, list.length);
  const mesh = new THREE.InstancedMesh(geo, mat, n);
  mesh.count = list.length;
  const emit = new Float32Array(n), wind = new Float32Array(n);
  list.forEach((v, idx) => {
    _s3.set(v.sx ?? v.s, v.sy ?? v.s, v.sz ?? v.s);
    _v3.set(v.x, v.y, v.z);
    _m4.compose(_v3, v.q || _q.identity(), _s3);
    mesh.setMatrixAt(idx, _m4);
    mesh.setColorAt(idx, jitterColor(_c, v.c, v.j || 0));
    emit[idx] = v.e || 0; wind[idx] = v.w || 0;
  });
  if (!list.length) mesh.setColorAt(0, _c.setHex(0xffffff));
  geo.setAttribute('aEmit', new THREE.InstancedBufferAttribute(emit, 1));
  geo.setAttribute('aWind', new THREE.InstancedBufferAttribute(wind, 1));
  mesh.castShadow = cast; mesh.receiveShadow = receive;
  if (depth) mesh.customDepthMaterial = depth;
  mesh.name = name;
  mesh.computeBoundingSphere();
  return mesh;
}

// Greedy-free face-culled mesher: one merged BufferGeometry per voxel model.
const FACES = [
  { n: [1, 0, 0], v: [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]] },
  { n: [-1, 0, 0], v: [[-1, -1, 1], [-1, 1, 1], [-1, 1, -1], [-1, -1, -1]] },
  { n: [0, 1, 0], v: [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]] },
  { n: [0, -1, 0], v: [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]] },
  { n: [0, 0, 1], v: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]] },
  { n: [0, 0, -1], v: [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]] },
];
function meshVox(vox, jitter = 0.06) {
  const pos = [], nor = [], col = [], emi = [], wnd = [], idx = [];
  const s = vox.s, h = s / 2;
  for (const v of vox.m.values()) {
    const [i, j, k, c, e, w] = v;
    jitterColor(_c, c, jitter * (hash3(i, j, k) * 2 - 1));
    const cx = vox.o[0] + i * s, cy = vox.o[1] + j * s, cz = vox.o[2] + k * s;
    for (const F of FACES) {
      if (vox.has(i + F.n[0], j + F.n[1], k + F.n[2])) continue;
      const b = pos.length / 3;
      for (const cv of F.v) {
        pos.push(cx + cv[0] * h, cy + cv[1] * h, cz + cv[2] * h);
        nor.push(F.n[0], F.n[1], F.n[2]);
        col.push(_c.r, _c.g, _c.b);
        emi.push(e); wnd.push(w);
      }
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('aEmit', new THREE.Float32BufferAttribute(emi, 1));
  g.setAttribute('aWind', new THREE.Float32BufferAttribute(wnd, 1));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

// voxelised helpers -------------------------------------------------------
function voxSphere(vox, ci, cj, ck, r, colorFn, e = 0) {
  const R = Math.ceil(r);
  for (let i = -R; i <= R; i++) for (let j = -R; j <= R; j++) for (let k = -R; k <= R; k++) {
    if (i * i + j * j + k * k <= r * r) vox.set(ci + i, cj + j, ck + k, typeof colorFn === 'function' ? colorFn(i, j, k) : colorFn, e);
  }
}
