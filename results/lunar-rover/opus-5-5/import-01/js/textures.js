// Procedurally generated texture maps (no external images).
import * as THREE from 'three';
import { mulberry32 } from './noise.js';

function dataTex(data, w, h, { srgb = false, repeat = true } = {}) {
  const t = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  t.wrapS = t.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

function canvasTex(canvas, { srgb = false, repeat = false } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function heightToNormal(H, size, strength) {
  const out = new Uint8Array(size * size * 4);
  const at = (x, y) => H[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1));
      const dy = (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1));
      let nx = -dx * strength, ny = -dy * strength, nz = 1;
      const l = Math.hypot(nx, ny, nz);
      const i = (y * size + x) * 4;
      out[i] = (nx / l * 0.5 + 0.5) * 255;
      out[i + 1] = (ny / l * 0.5 + 0.5) * 255;
      out[i + 2] = (nz / l * 0.5 + 0.5) * 255;
      out[i + 3] = 255;
    }
  }
  return out;
}

// Crinkled multi-layer-insulation foil: a tileable field of sharp folds.
export function makeCrinkleMaps(size = 512, seed = 11, count = 1100) {
  const rnd = mulberry32(seed);
  const H = new Float32Array(size * size);
  // broad pillowing of the blanket (tileable sines)
  for (let k = 0; k < 7; k++) {
    const fx = Math.floor(rnd() * 4) + 1, fy = Math.floor(rnd() * 4) + 1;
    const ph = rnd() * 6.283, a = 1.4 / (k + 1);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      H[y * size + x] += a * Math.sin(6.2832 * (fx * x + fy * y * (k % 2 ? 1 : -1)) / size + ph);
    }
  }
  for (let n = 0; n < count; n++) {
    const x0 = rnd() * size, y0 = rnd() * size;
    const ang = rnd() * Math.PI;
    const len = size * (0.03 + Math.pow(rnd(), 1.6) * 0.4);
    const dx = Math.cos(ang), dy = Math.sin(ang);
    const w = 1.2 + Math.pow(rnd(), 2) * 10;
    const A = (rnd() - 0.5) * 2 * (0.5 + rnd() * 1.2);
    const pw = rnd() < 0.6 ? 2.2 : 1.0;
    const x1 = x0 + dx * len, y1 = y0 + dy * len;
    const minx = Math.floor(Math.min(x0, x1) - w), maxx = Math.ceil(Math.max(x0, x1) + w);
    const miny = Math.floor(Math.min(y0, y1) - w), maxy = Math.ceil(Math.max(y0, y1) + w);
    for (let py = miny; py <= maxy; py++) {
      for (let px = minx; px <= maxx; px++) {
        const vx = px - x0, vy = py - y0;
        let t = vx * dx + vy * dy;
        t = t < 0 ? 0 : t > len ? len : t;
        const ex = vx - dx * t, ey = vy - dy * t;
        const d = Math.sqrt(ex * ex + ey * ey);
        if (d >= w) continue;
        const taper = Math.min(1, Math.min(t, len - t) / (w * 3) + 0.15);
        const f = Math.pow(1 - d / w, pw) * taper;
        const ix = ((px % size) + size) % size, iy = ((py % size) + size) % size;
        H[iy * size + ix] += A * f;
      }
    }
  }
  const normal = heightToNormal(H, size, 0.9);
  const rough = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const nz = normal[i * 4 + 2] / 255;
    const g = 0.2 + (1 - nz) * 0.9 + (rnd() - 0.5) * 0.04;
    rough[i * 4] = 255;
    rough[i * 4 + 1] = Math.max(0, Math.min(255, g * 255));
    rough[i * 4 + 2] = 255;
    rough[i * 4 + 3] = 255;
  }
  return { normal: dataTex(normal, size, size), rough: dataTex(rough, size, size) };
}

// Space-grade solar array: cropped-corner cells, fingers, busbars, interconnects.
export function makeSolarMaps(cols = 18, rows = 12, seed = 5) {
  const W = 2048, H = 1536;
  const rnd = mulberry32(seed);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const r = document.createElement('canvas'); r.width = W; r.height = H;
  const q = r.getContext('2d');
  const border = 34, gap = 7;
  // substrate + frame
  g.fillStyle = '#d7d2c6'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#9aa0a6'; g.fillRect(0, 0, W, border); g.fillRect(0, H - border, W, border);
  g.fillRect(0, 0, border, H); g.fillRect(W - border, 0, border, H);
  q.fillStyle = 'rgb(0,150,40)'; q.fillRect(0, 0, W, H);
  q.fillStyle = 'rgb(0,90,210)'; q.fillRect(0, 0, W, border); q.fillRect(0, H - border, W, border);
  q.fillRect(0, 0, border, H); q.fillRect(W - border, 0, border, H);
  const cw = (W - border * 2 - gap * (cols - 1)) / cols;
  const ch = (H - border * 2 - gap * (rows - 1)) / rows;
  const cut = Math.min(cw, ch) * 0.13;
  const cellPath = (ctx, x, y) => {
    ctx.beginPath();
    ctx.moveTo(x + cut, y); ctx.lineTo(x + cw - cut, y); ctx.lineTo(x + cw, y + cut);
    ctx.lineTo(x + cw, y + ch - cut); ctx.lineTo(x + cw - cut, y + ch); ctx.lineTo(x + cut, y + ch);
    ctx.lineTo(x, y + ch - cut); ctx.lineTo(x, y + cut); ctx.closePath();
  };
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const x = border + i * (cw + gap), y = border + j * (ch + gap);
      const v = rnd();
      const base = [22 + v * 8, 30 + v * 10, 78 + v * 22];
      const grad = g.createLinearGradient(x, y, x + cw, y + ch);
      grad.addColorStop(0, `rgb(${base[0] + 6},${base[1] + 6},${base[2] + 14})`);
      grad.addColorStop(1, `rgb(${base[0] - 4},${base[1] - 3},${base[2] - 8})`);
      g.fillStyle = grad; cellPath(g, x, y); g.fill();
      // fine fingers
      g.strokeStyle = 'rgba(170,180,200,0.20)'; g.lineWidth = 1;
      for (let fy = y + 4; fy < y + ch - 2; fy += 5.2) {
        g.beginPath(); g.moveTo(x + 3, fy); g.lineTo(x + cw - 3, fy); g.stroke();
      }
      // busbars
      g.fillStyle = '#c9ccd0';
      g.fillRect(x + cw * 0.3 - 2, y + 2, 4, ch - 4);
      g.fillRect(x + cw * 0.7 - 2, y + 2, 4, ch - 4);
      // interconnect tabs across the gap
      g.fillStyle = '#b8bcc2';
      if (i < cols - 1) {
        g.fillRect(x + cw - 2, y + ch * 0.25, gap + 4, 5);
        g.fillRect(x + cw - 2, y + ch * 0.72, gap + 4, 5);
      }
      q.fillStyle = 'rgb(0,52,60)'; cellPath(q, x, y); q.fill();
      q.fillStyle = 'rgb(0,70,230)';
      q.fillRect(x + cw * 0.3 - 2, y + 2, 4, ch - 4);
      q.fillRect(x + cw * 0.7 - 2, y + 2, 4, ch - 4);
    }
  }
  // wiring harness runs along one frame edge
  g.fillStyle = '#e9e4d8'; g.fillRect(border * 0.25, border, border * 0.5, H - border * 2);
  return { map: canvasTex(c, { srgb: true }), rm: canvasTex(r) };
}

// Optical solar reflector radiator: mirror tiles with dark bond lines.
export function makeOSRMaps(tiles = 8) {
  const S = 512;
  const rnd = mulberry32(3);
  const c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  const r = document.createElement('canvas'); r.width = r.height = S;
  const q = r.getContext('2d');
  g.fillStyle = '#4a4c50'; g.fillRect(0, 0, S, S);
  q.fillStyle = 'rgb(0,170,120)'; q.fillRect(0, 0, S, S);
  const t = S / tiles, gp = 3;
  for (let j = 0; j < tiles; j++) for (let i = 0; i < tiles; i++) {
    const v = 232 + rnd() * 18;
    g.fillStyle = `rgb(${v},${v + 2},${v + 5})`;
    g.fillRect(i * t + gp, j * t + gp, t - gp * 2, t - gp * 2);
    const rr = 8 + rnd() * 14;
    q.fillStyle = `rgb(0,${rr},255)`;
    q.fillRect(i * t + gp, j * t + gp, t - gp * 2, t - gp * 2);
  }
  return { map: canvasTex(c, { srgb: true, repeat: true }), rm: canvasTex(r, { repeat: true }) };
}

// Perforated wheel skin (alpha: white solid, black hole).
export function makeWheelAlpha() {
  const W = 1024, H = 128;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#000';
  const cols = 48, rows = 3;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const x = (i + (j % 2) * 0.5 + 0.25) * (W / cols);
      const y = H * 0.22 + j * (H * 0.56 / (rows - 1));
      g.beginPath(); g.ellipse(x, y, W / cols * 0.26, H * 0.085, 0, 0, Math.PI * 2); g.fill();
    }
  }
  const t = canvasTex(c, { repeat: true });
  return t;
}

export function makeLabel(lines, { w = 512, h = 160, bg = '#ecebe6', fg = '#1b1c1f' } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.strokeStyle = fg; g.lineWidth = 4; g.strokeRect(8, 8, w - 16, h - 16);
  g.fillStyle = fg;
  g.font = `600 ${Math.round(h * 0.32)}px "Noto Sans SC", "PingFang SC", sans-serif`;
  g.textBaseline = 'middle';
  g.fillText(lines[0], 26, h * 0.36);
  g.font = `500 ${Math.round(h * 0.17)}px "JetBrains Mono", Menlo, monospace`;
  g.fillText(lines[1] || '', 28, h * 0.74);
  // barcode
  let x = w - 150;
  const rnd = mulberry32(9);
  while (x < w - 26) { const bw = 1 + Math.floor(rnd() * 4); g.fillRect(x, h * 0.58, bw, h * 0.28); x += bw + 1 + Math.floor(rnd() * 3); }
  return canvasTex(c, { srgb: true });
}

// Camera calibration target: grey steps + colour chips.
export function makeCalTarget() {
  const S = 256;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#d9d8d4'; g.fillRect(0, 0, S, S);
  const chips = ['#b8322a', '#2f8a3b', '#2a4fa8', '#d9b12b', '#1a1a1a', '#5a5a5a', '#9a9a9a', '#f1f1f1'];
  chips.forEach((col, i) => {
    const x = 20 + (i % 4) * 56, y = i < 4 ? 20 : 180;
    g.fillStyle = col; g.fillRect(x, y, 48, 56);
  });
  g.fillStyle = '#111'; g.beginPath(); g.arc(S / 2, S / 2, 46, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#eee'; g.beginPath(); g.arc(S / 2, S / 2, 30, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#777'; g.beginPath(); g.arc(S / 2, S / 2, 14, 0, Math.PI * 2); g.fill();
  return canvasTex(c, { srgb: true });
}

// Aluminium honeycomb face sheet for the back of the solar wings.
export function makeCarbon() {
  const S = 256;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#a9acb1'; g.fillRect(0, 0, S, S);
  const r = 8, h = Math.sqrt(3) * r;
  g.strokeStyle = 'rgba(70,74,80,0.35)'; g.lineWidth = 1.2;
  for (let row = -1; row * h < S + h; row++) {
    for (let col = -1; col * r * 3 < S + r * 3; col++) {
      for (const off of [0, 1]) {
        const cx = col * r * 3 + off * r * 1.5, cy = row * h + off * h / 2;
        g.beginPath();
        for (let k = 0; k <= 6; k++) { const a = (k / 6) * Math.PI * 2; g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
        g.stroke();
      }
    }
  }
  g.fillStyle = 'rgba(40,42,46,0.25)'; g.fillRect(0, S / 2 - 2, S, 4);
  return canvasTex(c, { srgb: true, repeat: true });
}
