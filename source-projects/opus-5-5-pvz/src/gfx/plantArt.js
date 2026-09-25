// 植物美术：全部用 Canvas 路径程序化绘制，带待机摆动、射击、受损等动画状态。
// 约定：原点为植物所在格子的地面中心，y 轴向上为负；植物朝右。
import { TAU, clamp, lerp } from '../core/util.js';
import { E, C, fs, rg, lg, ball, oval, shadow, tube, eye, closedEye, leaf, leafPath, blob, teeth, star, line } from './paint.js';

const PEA = { light: '#c9f58a', mid: '#72cf3f', dark: '#3d8f1e', outline: '#1d4a0b', leaf: '#62c035', leafLight: '#9be35f', stem: '#5bb52f', mouth: '#1c3a0c' };
const SNOW = { light: '#f0fcff', mid: '#9cdcf7', dark: '#3f95cc', outline: '#15486e', leaf: '#6fc6b0', leafLight: '#b5ecde', stem: '#62b8a2', mouth: '#12324d' };
const REP = { light: '#b3ea6d', mid: '#58b52c', dark: '#2c7412', outline: '#143d06', leaf: '#4fa82a', leafLight: '#86d24e', stem: '#4aa326', mouth: '#11300a' };
const LEAF = '#5fbd34', LEAF_L = '#9ee463', LEAF_O = '#1f4d0f';
const SHROOM_STEM = ['#fbf2dc', '#d8c39a', '#6b5530'];

// 通用：贴地叶片（压扁透视）
function groundLeaves(ctx, t, o = {}) {
  const len = o.len || 28, wid = o.wid || 9;
  const fill = o.fill || LEAF, light = o.light || LEAF_L, stroke = o.stroke || LEAF_O;
  const sway = Math.sin(t * 1.7) * 0.04;
  ctx.save();
  ctx.scale(1, 0.48);
  const back = o.back ?? [-0.35, -2.8];
  for (const a of back) leaf(ctx, 0, -4, a + sway, len * 0.85, wid * 0.9, shadeLeaf(fill), stroke, { light: fill });
  const front = o.front ?? [0.25, 1.05, 2.1, 2.9];
  for (const a of front) leaf(ctx, 0, -4, a - sway, len, wid, fill, stroke, { light });
  ctx.restore();
}
const shadeLeaf = c => (c === LEAF ? '#3f8f22' : c);

// 两个形状的合并描边：先粗描边，再填充覆盖内部
function unionShapes(ctx, shapes, stroke, lw) {
  ctx.lineJoin = 'round';
  for (const s of shapes) { s.path(); ctx.lineWidth = lw * 2; ctx.strokeStyle = stroke; ctx.stroke(); }
  for (const s of shapes) { s.path(); ctx.fillStyle = s.fill; ctx.fill(); }
}

// ================= 豌豆射手家族 =================
function shooterHead(ctx, v, recoil, o = {}) {
  const r = o.r || 21;
  const sl = (o.snout || 21) + recoil * 5;
  const sr = (o.mouth || 10) + recoil * 3.2;
  const bodyFill = rg(ctx, -r * 0.4, -r * 0.45, r * 0.1, 0, 0, r * 1.1, [0, v.light, 0.55, v.mid, 1, v.dark]);
  const snoutFill = lg(ctx, 0, -sr, 0, sr, [0, v.light, 0.5, v.mid, 1, v.dark]);
  unionShapes(ctx, [
    { path: () => C(ctx, 0, 0, r), fill: bodyFill },
    {
      path: () => {
        ctx.beginPath();
        ctx.moveTo(r * 0.2, -r * 0.55);
        ctx.quadraticCurveTo(r * 0.6 + sl * 0.5, -sr * 0.9, r * 0.35 + sl, -sr);
        ctx.lineTo(r * 0.35 + sl, sr);
        ctx.quadraticCurveTo(r * 0.6 + sl * 0.5, sr * 0.9, r * 0.2, r * 0.55);
        ctx.closePath();
      },
      fill: snoutFill,
    },
  ], v.outline, 2.1);
  // 嘴口
  const mx = r * 0.35 + sl;
  E(ctx, mx, 0, sr * 0.45, sr);
  fs(ctx, rg(ctx, mx + 2, 0, 1, mx, 0, sr, [0, '#000', 1, v.mouth]), v.outline, 2);
  E(ctx, mx - sr * 0.12, 0, sr * 0.45 + 2.5, sr + 1.5);
  ctx.lineWidth = 2.5; ctx.strokeStyle = v.mid; ctx.globalAlpha *= 0.6; ctx.stroke(); ctx.globalAlpha /= 0.6;
  // 高光
  ctx.save();
  ctx.globalAlpha *= 0.55;
  E(ctx, -r * 0.35, -r * 0.5, r * 0.35, r * 0.2, -0.5);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.restore();
}

function peaFamily(ctx, s, v, kind) {
  const t = s.t + (s.phase || 0);
  const sway = Math.sin(t * 2.3);
  const sh = s.shoot || 0;
  const recoil = sh > 0 ? Math.sin(Math.min(1, sh) * Math.PI) : 0;
  shadow(ctx, 0, 0, 30, 9, 0.3);
  groundLeaves(ctx, t, { fill: v.leaf, light: v.leafLight, stroke: v.outline });
  const hx = sway * 2.6 - recoil * 6;
  const hy = -54 + recoil * 2;
  tube(ctx, [0, -2, 3, -20, hx - 7, hy + 22, hx - 3, hy + 8], 7.5, v.stem, v.outline, 2);
  // 茎上小叶
  leaf(ctx, 1, -18, -2.5 + sway * 0.05, 16, 5.5, v.leaf, v.outline, { light: v.leafLight });

  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(sway * 0.035 - recoil * 0.1);
  // 后脑装饰
  if (kind === 'repeater') {
    for (let i = 0; i < 4; i++) {
      const a = Math.PI + 0.9 - i * 0.45 + Math.sin(t * 3 + i) * 0.06;
      leaf(ctx, -12, -6, a, 20 - i * 1.5, 6, v.leaf, v.outline, { light: v.leafLight });
    }
  } else if (kind === 'snow') {
    for (let i = 0; i < 5; i++) {
      const a = Math.PI + 1.1 - i * 0.48;
      ctx.save();
      ctx.translate(-10, -4);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(0, -5); ctx.lineTo(22 - (i % 2) * 6, 0); ctx.lineTo(0, 5); ctx.closePath();
      fs(ctx, lg(ctx, 0, 0, 22, 0, [0, '#c6ecff', 1, '#ffffff']), '#3d86b8', 1.6);
      ctx.restore();
    }
  } else {
    leaf(ctx, -15, -8, Math.PI + 0.55 + Math.sin(t * 2.5) * 0.08, 17, 6, v.leaf, v.outline, { light: v.leafLight });
  }
  shooterHead(ctx, v, recoil);
  // 眼睛
  const blink = (Math.sin(t * 0.9) > 0.985) ? 0.15 : 1;
  ctx.save();
  ctx.translate(3, -7);
  ctx.scale(1, blink);
  eye(ctx, 0, 0, 6.5, 8, 2, 0.5, { pupil: 0.52 });
  ctx.restore();
  if (kind === 'repeater') {
    ctx.beginPath();
    ctx.moveTo(-5, -18); ctx.lineTo(10, -13);
    ctx.lineWidth = 3.4; ctx.strokeStyle = v.outline; ctx.lineCap = 'round'; ctx.stroke();
  }
  if (kind === 'snow') {
    // 冰霜点缀
    ctx.globalAlpha *= 0.8;
    star(ctx, -9, 8, 3.5, 1.2, 4, t);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.globalAlpha /= 0.8;
  }
  ctx.restore();
}

export function peashooter(ctx, s) { peaFamily(ctx, s, PEA, 'pea'); }
export function snowpea(ctx, s) { peaFamily(ctx, s, SNOW, 'snow'); }
export function repeater(ctx, s) { peaFamily(ctx, s, REP, 'repeater'); }

export function threepeater(ctx, s) {
  const t = s.t + (s.phase || 0);
  const sway = Math.sin(t * 2.1);
  const sh = s.shoot || 0;
  const recoil = sh > 0 ? Math.sin(Math.min(1, sh) * Math.PI) : 0;
  const v = PEA;
  shadow(ctx, 0, 0, 32, 10, 0.3);
  groundLeaves(ctx, t);
  const heads = [
    { x: -16 + sway * 2, y: -50, r: 15.5, ph: 0.4 },
    { x: 16 + sway * 2, y: -46, r: 15.5, ph: 0.8 },
    { x: 1 + sway * 3, y: -80, r: 16.5, ph: 0 },
  ];
  for (const h of heads) tube(ctx, [0, -2, 0, -24, h.x - 4, h.y + 16, h.x - 2, h.y + 6], 6.5, v.stem, v.outline, 2);
  leaf(ctx, 0, -20, -2.4, 15, 5, v.leaf, v.outline, { light: v.leafLight });
  leaf(ctx, 0, -24, -0.6, 14, 5, v.leaf, v.outline, { light: v.leafLight });
  for (const h of heads) {
    const rc = recoil * (0.7 + h.ph * 0.3);
    ctx.save();
    ctx.translate(h.x - rc * 4, h.y);
    ctx.rotate(Math.sin(t * 2.3 + h.ph) * 0.05);
    leaf(ctx, -h.r * 0.6, -h.r * 0.4, Math.PI + 0.6, h.r * 0.85, 5, v.leaf, v.outline, { light: v.leafLight });
    shooterHead(ctx, v, rc, { r: h.r, snout: h.r * 0.95, mouth: h.r * 0.46 });
    eye(ctx, 2, -5, 5, 6.2, 1.5, 0.5, { pupil: 0.52 });
    ctx.restore();
  }
}

// ================= 向日葵 =================
export function sunflower(ctx, s) {
  const t = s.t + (s.phase || 0);
  const sway = Math.sin(t * 1.9);
  shadow(ctx, 0, 0, 30, 9, 0.3);
  groundLeaves(ctx, t, { len: 30 });
  const hx = sway * 3.5, hy = -60 + Math.cos(t * 3.8) * 1.2;
  tube(ctx, [0, -2, 4, -22, hx - 6, hy + 26, hx, hy + 10], 7, '#5cb52f', LEAF_O, 2);
  leaf(ctx, 2, -24, -0.45 + sway * 0.05, 20, 7, LEAF, LEAF_O, { light: LEAF_L });
  leaf(ctx, 1, -16, Math.PI + 0.5 - sway * 0.05, 18, 6, LEAF, LEAF_O, { light: LEAF_L });
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(sway * 0.06);
  const glow = s.glow || 0;
  if (glow > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha *= glow * 0.8;
    C(ctx, 0, 0, 46);
    ctx.fillStyle = rg(ctx, 0, 0, 5, 0, 0, 46, [0, 'rgba(255,240,120,1)', 1, 'rgba(255,200,0,0)']);
    ctx.fill();
    ctx.restore();
  }
  // 花瓣（两层）
  const wob = Math.sin(t * 1.4) * 0.05;
  for (let layer = 0; layer < 2; layer++) {
    const n = 13;
    const len = layer === 0 ? 17 : 15;
    const col = layer === 0 ? ['#ffc21a', '#e59400'] : ['#fff06a', '#ffc81e'];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + (layer ? Math.PI / n : 0) + wob;
      ctx.save();
      ctx.rotate(a);
      ctx.translate(17 + len * 0.45, 0);
      E(ctx, 0, 0, len * 0.62, 6.2);
      fs(ctx, lg(ctx, -len * 0.6, 0, len * 0.6, 0, [0, col[1], 1, col[0]]), '#b87400', 1.3);
      ctx.restore();
    }
  }
  // 花盘
  C(ctx, 0, 0, 19.5);
  fs(ctx, rg(ctx, -5, -6, 2, 0, 0, 20, [0, '#e9a043', 0.6, '#c06f1e', 1, '#8c4610']), '#5e2f08', 2);
  ctx.save();
  ctx.globalAlpha *= 0.25;
  for (let i = 0; i < 14; i++) {
    const a = i * 2.4, r = 6 + (i % 4) * 3;
    C(ctx, Math.cos(a) * r, Math.sin(a) * r, 1.1);
    ctx.fillStyle = '#4a2204';
    ctx.fill();
  }
  ctx.restore();
  // 表情
  const blink = Math.sin(t * 0.8 + 1) > 0.985 ? 0.15 : 1;
  for (const ex of [-6.5, 6.5]) {
    ctx.save();
    ctx.translate(ex, -3.5);
    ctx.scale(1, blink);
    E(ctx, 0, 0, 3.2, 4.8);
    ctx.fillStyle = '#2a1204';
    ctx.fill();
    C(ctx, -0.9, -1.8, 1.2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(0, 2, 8, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = '#3a1804';
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.globalAlpha *= 0.45;
  E(ctx, -11.5, 4.5, 3.6, 2.2); ctx.fillStyle = '#ff7a6a'; ctx.fill();
  E(ctx, 11.5, 4.5, 3.6, 2.2); ctx.fill();
  ctx.restore();
}

// ================= 坚果墙 / 高坚果 =================
function nutBody(ctx, s, o) {
  const t = s.t + (s.phase || 0);
  const { rx, ry, cy } = o;
  const dmg = s.dmg || 0;
  const squash = 1 + Math.sin(t * 1.5) * 0.012;
  ctx.save();
  ctx.translate(0, cy);
  ctx.scale(2 - squash, squash);
  const light = o.light || '#e8c07a', mid = o.mid || '#c28a45', dark = o.dark || '#8a5a24', stroke = o.stroke || '#553310';
  // 形体：略不规则的椭圆
  const pts = [];
  const n = 14;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const wob = 1 + Math.sin(i * 2.7) * 0.025 + (dmg >= 2 && i === 2 ? -0.12 : 0) + (dmg >= 2 && i === 3 ? -0.08 : 0);
    pts.push(Math.cos(a) * rx * wob, Math.sin(a) * ry * wob);
  }
  blob(ctx, pts);
  fs(ctx, rg(ctx, -rx * 0.35, -ry * 0.45, 2, 0, 0, Math.max(rx, ry) * 1.1, [0, light, 0.55, mid, 1, dark]), stroke, 2.6);
  // 纹理
  ctx.save();
  blob(ctx, pts);
  ctx.clip();
  ctx.globalAlpha *= 0.35;
  ctx.strokeStyle = '#6b4216';
  ctx.lineWidth = 1.6;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    const yy = -ry * 0.75 + i * ry * 0.38;
    ctx.moveTo(-rx * 0.95, yy + Math.sin(i) * 4);
    ctx.quadraticCurveTo(-rx * 0.6, yy - 6, -rx * 0.35, yy + 3);
    ctx.moveTo(rx * 0.95, yy + Math.cos(i) * 4);
    ctx.quadraticCurveTo(rx * 0.6, yy - 5, rx * 0.4, yy + 4);
    ctx.stroke();
  }
  for (let i = 0; i < 12; i++) {
    C(ctx, Math.sin(i * 7.3) * rx * 0.8, Math.cos(i * 3.1) * ry * 0.8, 1.2);
    ctx.fillStyle = '#5a3510';
    ctx.fill();
  }
  ctx.restore();
  // 裂纹
  if (dmg >= 1) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'miter';
    ctx.beginPath();
    ctx.moveTo(rx * 0.1, -ry * 0.98);
    ctx.lineTo(rx * 0.22, -ry * 0.7);
    ctx.lineTo(rx * 0.05, -ry * 0.55);
    ctx.lineTo(rx * 0.25, -ry * 0.35);
    ctx.moveTo(-rx * 0.9, ry * 0.2);
    ctx.lineTo(-rx * 0.65, ry * 0.25);
    ctx.lineTo(-rx * 0.55, ry * 0.45);
    ctx.stroke();
  }
  if (dmg >= 2) {
    ctx.beginPath();
    ctx.moveTo(rx * 0.7, -ry * 0.7);
    ctx.lineTo(rx * 0.45, -ry * 0.55);
    ctx.lineTo(rx * 0.55, -ry * 0.3);
    ctx.lineTo(rx * 0.35, -ry * 0.1);
    ctx.moveTo(-rx * 0.3, ry * 0.95);
    ctx.lineTo(-rx * 0.2, ry * 0.7);
    ctx.lineTo(-rx * 0.35, ry * 0.55);
    ctx.stroke();
    ctx.save();
    ctx.globalAlpha *= 0.3;
    E(ctx, rx * 0.55, -ry * 0.62, rx * 0.25, ry * 0.12, -0.7);
    ctx.fillStyle = '#3a2208';
    ctx.fill();
    ctx.restore();
  }
  // 高光
  ctx.save();
  ctx.globalAlpha *= 0.35;
  E(ctx, -rx * 0.4, -ry * 0.55, rx * 0.28, ry * 0.14, -0.6);
  ctx.fillStyle = '#fff6d8';
  ctx.fill();
  ctx.restore();
  ctx.restore();
  return { t, dmg };
}

function nutFace(ctx, t, dmg, x, y, size, look = 0) {
  const lx = Math.sin(t * 0.7) * 1.8 + look;
  const ly = Math.cos(t * 0.5) * 0.8;
  const blink = Math.sin(t * 0.6 + 2) > 0.985 ? 0.12 : 1;
  for (const ex of [-8.5 * size, 8.5 * size]) {
    ctx.save();
    ctx.translate(x + ex, y);
    ctx.scale(1, blink * (dmg >= 2 ? 0.75 : 1));
    eye(ctx, 0, 0, 7 * size, 8.5 * size, lx, ly + (dmg >= 2 ? 2 : 0), { pupil: 0.45 });
    ctx.restore();
  }
  ctx.strokeStyle = '#3e2408';
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  if (dmg >= 1) {
    // 担忧的眉毛
    ctx.beginPath();
    ctx.moveTo(x - 14 * size, y - 10 * size); ctx.lineTo(x - 4 * size, y - 13 * size);
    ctx.moveTo(x + 14 * size, y - 10 * size); ctx.lineTo(x + 4 * size, y - 13 * size);
    ctx.stroke();
  }
  ctx.beginPath();
  if (dmg >= 2) ctx.arc(x, y + 18 * size, 6 * size, 1.15 * Math.PI, 1.85 * Math.PI);
  else if (dmg === 1) { ctx.moveTo(x - 5 * size, y + 14 * size); ctx.lineTo(x + 5 * size, y + 14 * size); }
  else ctx.arc(x, y + 10 * size, 5 * size, 0.2 * Math.PI, 0.8 * Math.PI);
  ctx.stroke();
}

export function wallnut(ctx, s) {
  shadow(ctx, 0, 0, 32, 10, 0.32);
  const { t, dmg } = nutBody(ctx, s, { rx: 30, ry: 36, cy: -36 });
  nutFace(ctx, t, dmg, 2, -44, 1, s.look || 0);
}

export function tallnut(ctx, s) {
  shadow(ctx, 0, 0, 34, 10, 0.32);
  const { t, dmg } = nutBody(ctx, s, { rx: 32, ry: 58, cy: -56, light: '#e3b877', mid: '#b88040', dark: '#7c4e1c' });
  // 岩石般的疙瘩
  ctx.save();
  ctx.globalAlpha *= 0.3;
  for (let i = 0; i < 6; i++) {
    E(ctx, Math.sin(i * 2.1) * 18, -30 - i * 11, 7, 4, i);
    ctx.fillStyle = '#6b4015';
    ctx.fill();
  }
  ctx.restore();
  nutFace(ctx, t, dmg, 2, -82, 1, s.look || 0);
}

// 保龄球坚果（滚动）
export function bowlnut(ctx, s, kind = 'normal') {
  const rot = s.roll || 0;
  const big = kind === 'giant' ? 1.9 : 1;
  shadow(ctx, 0, 0, 32 * big, 9 * big, 0.3);
  ctx.save();
  ctx.translate(0, -32 * big);
  ctx.rotate(rot);
  ctx.scale(big, big);
  ctx.translate(0, 32);
  const o = kind === 'explode'
    ? { rx: 30, ry: 32, cy: -32, light: '#ff9a7a', mid: '#e04a2a', dark: '#901808', stroke: '#4a0800' }
    : { rx: 30, ry: 32, cy: -32 };
  const { t } = nutBody(ctx, { t: 0, phase: 0, dmg: 0 }, o);
  nutFace(ctx, t, 0, 2, -40, 1, 1.5);
  if (kind === 'explode') {
    ctx.strokeStyle = '#4a0800';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(-14, -52); ctx.lineTo(-3, -48);
    ctx.moveTo(16, -52); ctx.lineTo(6, -48);
    ctx.stroke();
  }
  ctx.restore();
}

// ================= 樱桃炸弹 =================
export function cherrybomb(ctx, s) {
  const t = s.t + (s.phase || 0);
  const fuse = s.fuse || 0;
  const shake = fuse > 0 ? Math.sin(t * 50) * fuse * 2.5 : 0;
  const sc = 1 + fuse * 0.38;
  shadow(ctx, 0, 0, 34 * sc, 10, 0.3);
  ctx.save();
  ctx.translate(shake, 0);
  ctx.scale(sc, sc);
  const bob = Math.sin(t * 3) * 1.2;
  const cherries = [
    { x: -15, y: -25 + bob, r: 19, ph: 0 },
    { x: 15, y: -23 - bob * 0.7, r: 20, ph: 1 },
  ];
  // 梗
  for (const c of cherries) tube(ctx, [c.x * 0.6, c.y - c.r + 3, c.x * 0.4, c.y - 40, 2, -66, 4, -68], 3.2, '#4f8a22', '#1f3d0a', 1.5);
  leaf(ctx, 4, -68, -0.4 + Math.sin(t * 2) * 0.1, 22, 7, LEAF, LEAF_O, { light: LEAF_L });
  leaf(ctx, 3, -67, Math.PI + 0.9, 14, 5, LEAF, LEAF_O, { light: LEAF_L });
  for (const c of cherries) {
    ball(ctx, c.x, c.y, c.r, fuse > 0.5 ? '#ffb0a0' : '#ff7a66', '#b8001a', '#4a0008', 2.2);
    ctx.save();
    ctx.globalAlpha *= 0.7;
    E(ctx, c.x - c.r * 0.4, c.y - c.r * 0.45, c.r * 0.3, c.r * 0.16, -0.7);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.restore();
    // 愤怒脸
    const fx = c.x + 2, fy = c.y + 1;
    eye(ctx, fx - 6, fy - 3, 4.2, 5, 1.2, 0.8, { pupil: 0.5, stroke: '#4a0008' });
    eye(ctx, fx + 5, fy - 3, 4.2, 5, 1.2, 0.8, { pupil: 0.5, stroke: '#4a0008' });
    ctx.strokeStyle = '#3a0006';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(fx - 11, fy - 11); ctx.lineTo(fx - 3, fy - 7);
    ctx.moveTo(fx + 10, fy - 11); ctx.lineTo(fx + 2, fy - 7);
    ctx.stroke();
    // 咬牙
    ctx.beginPath();
    ctx.moveTo(fx - 6, fy + 7);
    ctx.quadraticCurveTo(fx, fy + 4 - fuse * 2, fx + 6, fy + 7);
    ctx.quadraticCurveTo(fx, fy + 11 + fuse * 3, fx - 6, fy + 7);
    fs(ctx, '#fff', '#3a0006', 1.6);
    line(ctx, fx - 2, fy + 5.5, fx - 2, fy + 9, '#3a0006', 1);
    line(ctx, fx + 2, fy + 5.5, fx + 2, fy + 9, '#3a0006', 1);
  }
  if (fuse > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha *= fuse * (0.4 + 0.3 * Math.sin(t * 30));
    E(ctx, 0, -28, 42, 32);
    ctx.fillStyle = rg(ctx, 0, -28, 5, 0, -28, 42, [0, '#ffffff', 1, 'rgba(255,60,30,0)']);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

// ================= 土豆地雷 =================
export function potatomine(ctx, s) {
  const t = s.t + (s.phase || 0);
  const rise = s.icon ? 1 : clamp(s.rise || 0, 0, 1);
  shadow(ctx, 0, 0, 30, 8, 0.25);
  // 后方土堆
  E(ctx, 0, -3, 30, 10);
  fs(ctx, rg(ctx, -6, -8, 2, 0, -3, 30, [0, '#9a6a3c', 1, '#5e3a1a']), '#3a220c', 2);
  if (rise <= 0.01) {
    // 未准备：土中露出一截
    E(ctx, 0, -8, 13, 6);
    fs(ctx, '#b88a50', '#553310', 1.6);
    tube(ctx, [0, -12, 0, -22], 2.4, '#7a7a70', '#333', 1);
    C(ctx, 0, -24, 3.2);
    fs(ctx, '#8a4040', '#333', 1.2);
    closedEye(ctx, -4, -8, 2.5, '#3a2206', 1.5);
    closedEye(ctx, 4, -8, 2.5, '#3a2206', 1.5);
  } else {
    ctx.save();
    ctx.beginPath();
    ctx.rect(-40, -90, 80, 87);
    ctx.clip();
    const y0 = (1 - Ease_outBack(rise)) * 26;
    ctx.translate(0, y0);
    const bob = Math.sin(t * 4) * 0.8;
    // 天线
    tube(ctx, [0, -32 + bob, 1, -40, 0, -48 + bob], 2.4, '#8c8c80', '#2a2a22', 1.2);
    const on = Math.sin(t * 5) > 0;
    C(ctx, 0, -51 + bob, 4.5);
    fs(ctx, on ? '#ff3a2a' : '#9a2a20', '#3a0a06', 1.5);
    if (on) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      C(ctx, 0, -51 + bob, 12);
      ctx.fillStyle = rg(ctx, 0, -51 + bob, 1, 0, -51 + bob, 12, [0, 'rgba(255,120,80,0.9)', 1, 'rgba(255,0,0,0)']);
      ctx.fill();
      ctx.restore();
    }
    // 身体
    E(ctx, 0, -18 + bob, 25, 18);
    fs(ctx, rg(ctx, -8, -28, 2, 0, -18, 28, [0, '#f0c688', 0.6, '#c8914c', 1, '#8c5a24']), '#553310', 2.2);
    ctx.save();
    ctx.globalAlpha *= 0.4;
    for (const [px, py] of [[-14, -22], [12, -12], [-5, -8], [16, -26]]) {
      E(ctx, px, py + bob, 2.2, 1.5);
      ctx.fillStyle = '#6b4216';
      ctx.fill();
    }
    ctx.restore();
    eye(ctx, -6, -22 + bob, 4.5, 5.5, 1.5, 0.5, { pupil: 0.5 });
    eye(ctx, 7, -22 + bob, 4.5, 5.5, 1.5, 0.5, { pupil: 0.5 });
    ctx.beginPath();
    ctx.arc(1, -14 + bob, 4, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#3a2206';
    ctx.stroke();
    ctx.restore();
  }
  // 前方土块
  ctx.save();
  E(ctx, 0, 0, 28, 7);
  fs(ctx, rg(ctx, 0, -4, 2, 0, 0, 28, [0, '#8a5c30', 1, '#5a3818']), '#3a220c', 1.8);
  for (const [px, py, r] of [[-18, -3, 4], [14, -2, 3.5], [-2, 2, 3], [22, 1, 2.5]]) {
    C(ctx, px, py, r);
    fs(ctx, '#7a4e26', '#3a220c', 1.2);
  }
  ctx.restore();
}
function Ease_outBack(t) { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }

// ================= 大嘴花 =================
export function chomper(ctx, s) {
  const t = s.t + (s.phase || 0);
  const sway = Math.sin(t * 1.8);
  const bite = s.bite || 0; // 0..1 撕咬动画
  const chewing = s.chew || 0;
  shadow(ctx, 0, 0, 32, 10, 0.3);
  groundLeaves(ctx, t, { len: 32, wid: 10 });
  // 茎
  let lunge = 0, open = 0.55 + Math.sin(t * 2.2) * 0.08;
  if (bite > 0) {
    lunge = bite < 0.45 ? Ease_outBack(bite / 0.45) * 24 : 24 * (1 - (bite - 0.45) / 0.55);
    open = bite < 0.3 ? 0.55 + bite * 2.2 : bite < 0.45 ? 1.2 * (1 - (bite - 0.3) / 0.15) : 0;
  }
  if (chewing) open = Math.max(0, Math.sin(t * 7) * 0.12);
  const hx = 10 + sway * 2 + lunge, hy = -70 + (chewing ? Math.sin(t * 7) * 1.5 : 0);
  tube(ctx, [-2, -2, -12, -30, hx - 30, hy + 30, hx - 16, hy + 10], 8, '#56aa2c', LEAF_O, 2);
  leaf(ctx, -6, -28, Math.PI + 0.6, 24, 8, LEAF, LEAF_O, { light: LEAF_L });
  leaf(ctx, -4, -22, -0.3, 22, 7, LEAF, LEAF_O, { light: LEAF_L });
  ctx.save();
  ctx.translate(hx, hy);
  const sc = chewing ? 1.06 + Math.sin(t * 7) * 0.03 : 1;
  ctx.scale(sc, sc);
  const hinge = -24;
  const up = { light: '#d88af0', mid: '#9a3fbf', dark: '#5e1a82', stroke: '#2e0848' };
  // 口腔
  if (open > 0.05) {
    ctx.save();
    ctx.translate(hinge, 0);
    E(ctx, 26, 2, 26, 6 + open * 16);
    ctx.fillStyle = rg(ctx, 20, 2, 2, 26, 2, 28, [0, '#2a0018', 1, '#7a1a3a']);
    ctx.fill();
    // 舌头
    E(ctx, 18, 6 + open * 6, 12, 4 + open * 3);
    fs(ctx, '#ff6a8a', '#7a1030', 1.5);
    ctx.restore();
  }
  // 下颚
  ctx.save();
  ctx.translate(hinge, 4);
  ctx.rotate(open * 0.5);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(6, 22, 44, 22, 52, 0);
  ctx.closePath();
  fs(ctx, lg(ctx, 0, 0, 0, 20, [0, up.mid, 1, up.dark]), up.stroke, 2.2);
  teeth(ctx, 14, 0, 50, 0, 5, -6, 1, '#fffbe8', '#6a5a50');
  ctx.restore();
  // 上颚
  ctx.save();
  ctx.translate(hinge, 0);
  ctx.rotate(-open * 0.55);
  ctx.beginPath();
  ctx.moveTo(-4, 4);
  ctx.bezierCurveTo(-6, -40, 50, -44, 58, 2);
  ctx.quadraticCurveTo(30, 6, -4, 4);
  ctx.closePath();
  fs(ctx, rg(ctx, 14, -20, 3, 22, -8, 42, [0, up.light, 0.6, up.mid, 1, up.dark]), up.stroke, 2.4);
  teeth(ctx, 16, 3.5, 56, 2, 6, 7, 1, '#fffbe8', '#6a5a50');
  // 斑点
  ctx.globalAlpha *= 0.55;
  for (const [px, py, r] of [[10, -18, 4], [26, -26, 3.5], [38, -16, 3], [18, -8, 2.5], [2, -8, 2.5]]) {
    C(ctx, px, py, r);
    ctx.fillStyle = '#f0c6ff';
    ctx.fill();
  }
  ctx.restore();
  // 叶状颈圈
  for (let i = 0; i < 4; i++) leaf(ctx, hinge + 2, 2, Math.PI * 0.5 + 0.5 + i * 0.35, 16, 5, LEAF, LEAF_O, { light: LEAF_L });
  ctx.restore();
}

// ================= 窝瓜 =================
export function squash(ctx, s) {
  const t = s.t + (s.phase || 0);
  const squish = s.squish || 0;
  const look = s.lookDir || 0;
  shadow(ctx, 0, 0, 32, 10, 0.3);
  if (!s.airborne) groundLeaves(ctx, t, { len: 22, wid: 8 });
  ctx.save();
  ctx.scale(1 + squish * 0.35, 1 - squish * 0.4);
  const breathe = 1 + Math.sin(t * 2) * 0.015;
  ctx.scale(breathe, 1 / breathe);
  const pts = [-30, -6, -36, -30, -30, -56, -16, -72, 0, -76, 16, -72, 30, -56, 36, -30, 30, -6, 12, 0, -12, 0];
  blob(ctx, pts);
  fs(ctx, rg(ctx, -12, -52, 4, 0, -36, 48, [0, '#c4ec7c', 0.5, '#7ec43e', 1, '#3f8a1c']), '#1f4a0a', 2.5);
  // 棱纹
  ctx.save();
  blob(ctx, pts);
  ctx.clip();
  ctx.globalAlpha *= 0.3;
  ctx.strokeStyle = '#2a5e10';
  ctx.lineWidth = 2;
  for (const x of [-18, 0, 18]) {
    ctx.beginPath();
    ctx.moveTo(x * 0.6, -74);
    ctx.quadraticCurveTo(x * 1.4, -38, x * 0.9, 0);
    ctx.stroke();
  }
  ctx.restore();
  // 瓜柄
  tube(ctx, [0, -74, -2, -84, 6, -88], 4, '#7a8a30', '#2e3a0c', 1.5);
  // 愤怒的脸
  const lx = look * 2.5;
  eye(ctx, -11, -44, 7, 7.5, lx, 1.5, { pupil: 0.55 });
  eye(ctx, 11, -44, 7, 7.5, lx, 1.5, { pupil: 0.55 });
  ctx.fillStyle = '#1f4a0a';
  ctx.beginPath();
  ctx.moveTo(-22, -56); ctx.lineTo(-3, -48); ctx.lineTo(-4, -44); ctx.lineTo(-21, -51);
  ctx.moveTo(22, -56); ctx.lineTo(3, -48); ctx.lineTo(4, -44); ctx.lineTo(21, -51);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-12, -24);
  ctx.quadraticCurveTo(0, -32, 12, -24);
  ctx.quadraticCurveTo(0, -27, -12, -24);
  fs(ctx, '#2a0a04', '#1f4a0a', 2);
  ctx.restore();
}

// ================= 蘑菇家族 =================
function shroomStem(ctx, x0, y0, w, h, o = {}) {
  const c = o.colors || SHROOM_STEM;
  ctx.beginPath();
  ctx.moveTo(x0 - w * 0.55, y0);
  ctx.quadraticCurveTo(x0 - w * 0.62, y0 - h * 0.5, x0 - w * 0.45, y0 - h);
  ctx.lineTo(x0 + w * 0.45, y0 - h);
  ctx.quadraticCurveTo(x0 + w * 0.62, y0 - h * 0.5, x0 + w * 0.55, y0);
  ctx.quadraticCurveTo(x0, y0 + 4, x0 - w * 0.55, y0);
  ctx.closePath();
  fs(ctx, lg(ctx, x0 - w / 2, 0, x0 + w / 2, 0, [0, c[0], 1, c[1]]), c[2], 2);
}

function shroomCap(ctx, x, y, rx, ry, light, dark, stroke, spots, o = {}) {
  ctx.beginPath();
  ctx.moveTo(x - rx, y);
  ctx.bezierCurveTo(x - rx * 1.02, y - ry * 1.35, x + rx * 1.02, y - ry * 1.35, x + rx, y);
  ctx.quadraticCurveTo(x + rx * 0.7, y + ry * 0.28, x, y + ry * 0.25);
  ctx.quadraticCurveTo(x - rx * 0.7, y + ry * 0.28, x - rx, y);
  ctx.closePath();
  fs(ctx, rg(ctx, x - rx * 0.3, y - ry * 0.8, 2, x, y - ry * 0.3, rx * 1.2, [0, light, 1, dark]), stroke, o.lw || 2.2);
  if (spots) {
    ctx.save();
    ctx.clip();
    for (const [sx, sy, sr] of spots) {
      E(ctx, x + sx * rx, y - ry * sy, sr * rx, sr * rx * 0.75);
      ctx.fillStyle = o.spotColor || 'rgba(255,255,255,0.55)';
      ctx.fill();
    }
    ctx.restore();
  }
  // 高光
  ctx.save();
  ctx.globalAlpha *= 0.35;
  E(ctx, x - rx * 0.35, y - ry * 0.75, rx * 0.25, ry * 0.15, -0.4);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.restore();
}

function sleepyEyes(ctx, s, xs, y, r) {
  if (s.sleep) {
    for (const x of xs) closedEye(ctx, x, y + r * 0.6, r * 0.8, '#2a1a30', 1.8);
    return true;
  }
  return false;
}

function zzz(ctx, s, x, y) {
  if (!s.sleep || s.icon) return;
  const t = s.t + (s.phase || 0);
  for (let i = 0; i < 3; i++) {
    const p = ((t * 0.5 + i / 3) % 1);
    ctx.save();
    ctx.globalAlpha *= Math.sin(p * Math.PI);
    ctx.font = `900 ${10 + p * 8}px sans-serif`;
    ctx.fillStyle = '#e8f0ff';
    ctx.strokeStyle = '#223';
    ctx.lineWidth = 2.5;
    ctx.textAlign = 'center';
    ctx.strokeText('Z', x + p * 16, y - p * 30);
    ctx.fillText('Z', x + p * 16, y - p * 30);
    ctx.restore();
  }
}

function sleepTilt(ctx, s) {
  if (s.sleep && !s.icon) {
    const t = s.t + (s.phase || 0);
    ctx.rotate(Math.sin(t * 1.2) * 0.04 - 0.08);
    ctx.scale(1, 0.96 + Math.sin(t * 1.2) * 0.02);
  }
}

export function puffshroom(ctx, s) {
  const t = s.t + (s.phase || 0);
  const sh = s.shoot ? Math.sin(Math.min(1, s.shoot) * Math.PI) : 0;
  shadow(ctx, 0, 0, 20, 6, 0.3);
  ctx.save();
  sleepTilt(ctx, s);
  ctx.scale(1 - sh * 0.1, 1 + sh * 0.12);
  shroomStem(ctx, 0, 0, 20, 22);
  // 小嘴
  ctx.save();
  ctx.translate(9, -11);
  tube(ctx, [0, 0, 8 + sh * 3, 0], 8 + sh * 2, '#e8dcc2', '#6b5530', 1.8);
  E(ctx, 9 + sh * 3, 0, 2.5, 4 + sh);
  ctx.fillStyle = '#2a1a10';
  ctx.fill();
  ctx.restore();
  if (!sleepyEyes(ctx, s, [-3, 4], -13, 3.2)) {
    eye(ctx, -3, -13, 3, 4.2, 1, 0.5, { pupil: 0.6, stroke: '#3a2a20' });
    eye(ctx, 4, -13, 3, 4.2, 1, 0.5, { pupil: 0.6, stroke: '#3a2a20' });
  }
  shroomCap(ctx, 0, -22 + Math.sin(t * 3) * 0.6, 21, 15, '#e4b4ff', '#8a3fb8', '#3e0f5a', [[-0.45, 0.6, 0.18], [0.35, 0.75, 0.14], [0.05, 1.0, 0.1], [0.65, 0.35, 0.1]]);
  ctx.restore();
  zzz(ctx, s, 12, -40);
}

export function sunshroom(ctx, s) {
  const t = s.t + (s.phase || 0);
  const g = s.icon ? 1 : 0.62 + 0.38 * clamp(s.grow || 0, 0, 1);
  shadow(ctx, 0, 0, 22 * g, 7 * g, 0.3);
  ctx.save();
  ctx.scale(g, g);
  sleepTilt(ctx, s);
  shroomStem(ctx, 0, 0, 22, 24);
  if (!sleepyEyes(ctx, s, [-4, 5], -14, 3.4)) {
    eye(ctx, -4, -14, 3.2, 4.4, 0.8, 0.5, { pupil: 0.6, stroke: '#4a3010' });
    eye(ctx, 5, -14, 3.2, 4.4, 0.8, 0.5, { pupil: 0.6, stroke: '#4a3010' });
    ctx.beginPath();
    ctx.arc(0.5, -8, 3.5, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = '#4a3010';
    ctx.stroke();
  }
  shroomCap(ctx, 0, -24 + Math.sin(t * 2.6) * 0.7, 24, 16, '#fff09a', '#e88c10', '#7a3e00', [[-0.5, 0.55, 0.16], [0.3, 0.8, 0.15], [0.7, 0.35, 0.1], [-0.1, 1.05, 0.1]], { spotColor: 'rgba(255,250,210,0.75)' });
  if (!s.sleep && !s.icon) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha *= 0.25 + Math.sin(t * 3) * 0.1 + (s.glow || 0) * 0.5;
    C(ctx, 0, -30, 30);
    ctx.fillStyle = rg(ctx, 0, -30, 2, 0, -30, 30, [0, 'rgba(255,230,120,1)', 1, 'rgba(255,200,0,0)']);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
  zzz(ctx, s, 14 * g, -44 * g);
}

export function fumeshroom(ctx, s) {
  const t = s.t + (s.phase || 0);
  const sh = s.shoot ? Math.sin(Math.min(1, s.shoot) * Math.PI) : 0;
  shadow(ctx, 0, 0, 30, 9, 0.3);
  ctx.save();
  sleepTilt(ctx, s);
  ctx.scale(1 + sh * 0.05, 1 - sh * 0.06);
  shroomStem(ctx, -2, 0, 34, 30, { colors: ['#eadcf5', '#b49ac8', '#4a3060'] });
  // 喇叭嘴
  ctx.save();
  ctx.translate(12, -18);
  const flare = 1 + sh * 0.35;
  ctx.beginPath();
  ctx.moveTo(0, -7);
  ctx.quadraticCurveTo(14, -7, 22, -12 * flare);
  ctx.lineTo(22, 12 * flare);
  ctx.quadraticCurveTo(14, 7, 0, 7);
  ctx.closePath();
  fs(ctx, lg(ctx, 0, -12, 0, 12, [0, '#e0c8f0', 1, '#9a78b8']), '#4a3060', 2);
  E(ctx, 22, 0, 4, 12 * flare);
  fs(ctx, rg(ctx, 23, 0, 1, 22, 0, 12, [0, '#1a0a20', 1, '#5a3a70']), '#4a3060', 1.8);
  ctx.restore();
  if (!sleepyEyes(ctx, s, [-9, 3], -20, 4)) {
    eye(ctx, -9, -20, 4.4, 5.4, 1.3, 0.8, { pupil: 0.55, stroke: '#3a2050' });
    eye(ctx, 3, -20, 4.4, 5.4, 1.3, 0.8, { pupil: 0.55, stroke: '#3a2050' });
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = '#3a2050';
    ctx.beginPath();
    ctx.moveTo(-15, -28); ctx.lineTo(-5, -25);
    ctx.moveTo(8, -28); ctx.lineTo(0, -25);
    ctx.stroke();
  }
  shroomCap(ctx, -2, -32 + Math.sin(t * 2.2) * 0.7, 32, 20, '#caa8ec', '#6c3f96', '#2e1248', [[-0.5, 0.5, 0.12], [-0.05, 0.9, 0.14], [0.45, 0.6, 0.11], [0.75, 0.25, 0.08]], { spotColor: 'rgba(90,40,130,0.45)' });
  ctx.restore();
  zzz(ctx, s, 16, -56);
}

export function hypnoshroom(ctx, s) {
  const t = s.t + (s.phase || 0);
  shadow(ctx, 0, 0, 24, 7, 0.3);
  ctx.save();
  sleepTilt(ctx, s);
  shroomStem(ctx, 0, 0, 22, 34, { colors: ['#fff5e8', '#e0c8b0', '#6b4a30'] });
  if (!sleepyEyes(ctx, s, [-5, 5], -22, 4)) {
    // 螺旋眼
    for (const ex of [-5, 5]) {
      C(ctx, ex, -22, 4.6);
      fs(ctx, '#fff', '#5a2a40', 1.4);
      ctx.beginPath();
      for (let i = 0; i < 20; i++) {
        const a = i * 0.6 + t * 6, r = i * 0.22;
        const px = ex + Math.cos(a) * r, py = -22 + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = '#b01a78';
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(0, -15, 3, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = '#5a2a40';
    ctx.stroke();
  }
  // 高耸的彩色菌盖
  const cx = 0, cy = -34;
  const capPath = () => {
    ctx.beginPath();
    ctx.moveTo(cx - 25, cy);
    ctx.bezierCurveTo(cx - 28, cy - 34, cx - 10, cy - 50, cx + 2, cy - 50);
    ctx.bezierCurveTo(cx + 14, cy - 50, cx + 28, cy - 32, cx + 25, cy);
    ctx.quadraticCurveTo(cx, cy + 6, cx - 25, cy);
    ctx.closePath();
  };
  ctx.save();
  capPath();
  ctx.clip();
  const cols = ['#ff4fb0', '#ffd23a', '#36d6c0', '#8a5aff', '#ff8a3a'];
  const rot = s.icon ? 0 : t * 1.4;
  for (let i = 0; i < 10; i++) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - 22);
    const a0 = rot + (i / 10) * TAU, a1 = rot + ((i + 1) / 10) * TAU;
    for (let k = 0; k <= 12; k++) {
      const a = a0 + (a1 - a0) * (k / 12);
      ctx.lineTo(cx + Math.cos(a + 0.7) * 70, cy - 22 + Math.sin(a + 0.7) * 70);
    }
    ctx.closePath();
    ctx.fillStyle = cols[i % cols.length];
    ctx.fill();
  }
  // 螺旋条纹
  ctx.beginPath();
  for (let i = 0; i < 80; i++) {
    const a = -rot * 2 + i * 0.3, r = i * 0.55;
    const px = cx + Math.cos(a) * r, py = cy - 22 + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.stroke();
  ctx.fillStyle = rg(ctx, cx - 8, cy - 34, 2, cx, cy - 20, 34, [0, 'rgba(255,255,255,0.35)', 1, 'rgba(60,0,60,0.25)']);
  ctx.fillRect(cx - 40, cy - 60, 80, 70);
  ctx.restore();
  capPath();
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = '#4a1040';
  ctx.stroke();
  ctx.restore();
  zzz(ctx, s, 14, -80);
}

export function scaredyshroom(ctx, s) {
  const t = s.t + (s.phase || 0);
  const hide = s.hide || 0;
  const sh = s.shoot ? Math.sin(Math.min(1, s.shoot) * Math.PI) : 0;
  const tremble = hide > 0.5 ? Math.sin(t * 60) * 1.2 : 0;
  shadow(ctx, 0, 0, 22, 7, 0.3);
  ctx.save();
  ctx.translate(tremble, 0);
  sleepTilt(ctx, s);
  const h = lerp(52, 14, hide);
  const sway = Math.sin(t * 1.6) * (1 - hide);
  // 细长茎
  ctx.beginPath();
  ctx.moveTo(-8, 0);
  ctx.quadraticCurveTo(-6 + sway * 2, -h * 0.5, -5 + sway * 3, -h);
  ctx.lineTo(6 + sway * 3, -h);
  ctx.quadraticCurveTo(7 + sway * 2, -h * 0.5, 8, 0);
  ctx.quadraticCurveTo(0, 4, -8, 0);
  fs(ctx, lg(ctx, -8, 0, 8, 0, [0, '#fbf2dc', 1, '#d0b890']), '#6b5530', 2);
  const hx = sway * 3, hy = -h;
  if (hide < 0.5) {
    ctx.save();
    ctx.translate(hx + 6, hy + 8);
    tube(ctx, [0, 0, 10 + sh * 3, -1], 7 + sh * 2, '#efe2c8', '#6b5530', 1.6);
    E(ctx, 10 + sh * 3, -1, 2.2, 3.6 + sh);
    ctx.fillStyle = '#2a1a10';
    ctx.fill();
    ctx.restore();
    if (!sleepyEyes(ctx, s, [hx - 3, hx + 4], hy + 6, 3.4)) {
      eye(ctx, hx - 3, hy + 6, 3.4, 4.6, 1, 0, { pupil: 0.55, stroke: '#3a2a20' });
      eye(ctx, hx + 4, hy + 6, 3.4, 4.6, 1, 0, { pupil: 0.55, stroke: '#3a2a20' });
    }
  } else {
    // 害怕：紧闭的眼睛
    ctx.strokeStyle = '#3a2a20';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(hx - 6, hy + 4); ctx.lineTo(hx - 1, hy + 6); ctx.lineTo(hx - 6, hy + 8);
    ctx.moveTo(hx + 7, hy + 4); ctx.lineTo(hx + 2, hy + 6); ctx.lineTo(hx + 7, hy + 8);
    ctx.stroke();
  }
  shroomCap(ctx, hx, hy - 2 + hide * 4, 18 + hide * 4, 13 + hide * 3, '#e0b0f6', '#8e46b8', '#3e0f5a', [[-0.4, 0.6, 0.18], [0.35, 0.8, 0.14], [0.7, 0.3, 0.1]]);
  ctx.restore();
  zzz(ctx, s, 14, -70);
}

export function iceshroom(ctx, s) {
  const t = s.t + (s.phase || 0);
  const fuse = s.fuse || 0;
  const sc = 1 + fuse * 0.3;
  shadow(ctx, 0, 0, 28, 8, 0.3);
  ctx.save();
  ctx.translate(fuse > 0 ? Math.sin(t * 50) * fuse * 2 : 0, 0);
  ctx.scale(sc, sc);
  sleepTilt(ctx, s);
  shroomStem(ctx, 0, 0, 24, 24, { colors: ['#f4fbff', '#b8d8ea', '#3a6a8a'] });
  if (!sleepyEyes(ctx, s, [-5, 5], -14, 3.6)) {
    eye(ctx, -5, -14, 3.6, 4.6, 0.5, 0.5, { pupil: 0.55, stroke: '#2a4a60', pupilColor: '#0a3a6a' });
    eye(ctx, 5, -14, 3.6, 4.6, 0.5, 0.5, { pupil: 0.55, stroke: '#2a4a60', pupilColor: '#0a3a6a' });
    E(ctx, 0, -7, 3, 1.6);
    ctx.fillStyle = '#2a4a60';
    ctx.fill();
  }
  // 冰刺
  const cy = -24;
  for (let i = 0; i < 9; i++) {
    const a = Math.PI + (i / 8) * Math.PI;
    const r = 26;
    ctx.save();
    ctx.translate(Math.cos(a) * r * 0.95, cy + Math.sin(a) * r * 0.62);
    ctx.rotate(a + Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(-5, 0); ctx.lineTo(0, -12 - (i % 2) * 5); ctx.lineTo(5, 0); ctx.closePath();
    fs(ctx, lg(ctx, 0, 0, 0, -14, [0, '#aee6ff', 1, '#ffffff']), '#2a6a9a', 1.5);
    ctx.restore();
  }
  shroomCap(ctx, 0, cy, 26, 18, '#e8faff', '#3ea0e0', '#154a78', [[-0.45, 0.55, 0.14], [0.25, 0.85, 0.12], [0.65, 0.35, 0.1]], { spotColor: 'rgba(255,255,255,0.8)' });
  if (fuse > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha *= fuse;
    C(ctx, 0, -24, 50);
    ctx.fillStyle = rg(ctx, 0, -24, 3, 0, -24, 50, [0, 'rgba(220,250,255,1)', 1, 'rgba(100,200,255,0)']);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
  zzz(ctx, s, 14, -52);
}

export function doomshroom(ctx, s) {
  const t = s.t + (s.phase || 0);
  const fuse = s.fuse || 0;
  const sc = 1 + fuse * 0.35;
  shadow(ctx, 0, 0, 30, 9, 0.35);
  ctx.save();
  ctx.translate(fuse > 0 ? Math.sin(t * 60) * fuse * 3 : 0, 0);
  ctx.scale(sc, sc);
  sleepTilt(ctx, s);
  shroomStem(ctx, 0, 0, 26, 24, { colors: ['#8a84a0', '#4a4460', '#1a1628'] });
  if (!sleepyEyes(ctx, s, [-5, 6], -14, 3.8)) {
    const red = fuse > 0 ? '#ff2a2a' : '#141414';
    eye(ctx, -5, -14, 4, 4.6, 1, 0.5, { pupil: 0.6, stroke: '#111', pupilColor: red, white: '#e8e0f0' });
    eye(ctx, 6, -14, 4, 4.6, 1, 0.5, { pupil: 0.6, stroke: '#111', pupilColor: red, white: '#e8e0f0' });
    ctx.beginPath();
    ctx.moveTo(-6, -6);
    ctx.quadraticCurveTo(1, -2, 8, -6);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#111';
    ctx.stroke();
  }
  shroomCap(ctx, 0, -26, 30, 22, '#8a6ab0', '#2a1640', '#0c0616', null);
  // 骷髅斑纹
  ctx.save();
  ctx.globalAlpha *= 0.75;
  const skull = (x, y, r) => {
    C(ctx, x, y, r); ctx.fillStyle = '#b89ee0'; ctx.fill();
    C(ctx, x - r * 0.35, y - r * 0.05, r * 0.25); C(ctx, x + r * 0.35, y - r * 0.05, r * 0.25);
    ctx.fillStyle = '#2a1640';
    C(ctx, x - r * 0.35, y - r * 0.05, r * 0.25); ctx.fill();
    C(ctx, x + r * 0.35, y - r * 0.05, r * 0.25); ctx.fill();
  };
  skull(-12, -38, 6);
  skull(10, -42, 5);
  skull(-1, -28, 4);
  skull(19, -30, 3.5);
  ctx.restore();
  if (fuse > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha *= fuse * 0.8;
    C(ctx, 0, -26, 55);
    ctx.fillStyle = rg(ctx, 0, -26, 3, 0, -26, 55, [0, 'rgba(255,120,220,1)', 1, 'rgba(120,0,200,0)']);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
  zzz(ctx, s, 16, -56);
}

export function gravebuster(ctx, s) {
  const t = s.t + (s.phase || 0);
  const p = s.progress || 0;
  const chew = Math.sin(t * 10) * 0.5 + 0.5;
  ctx.save();
  ctx.translate(Math.sin(t * 24) * 1.2 * (s.icon ? 0 : 1), 0);
  // 藤蔓环绕
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU + t * 0.3;
    tube(ctx, [Math.cos(a) * 30, -10, Math.cos(a + 1) * 34, -40, Math.cos(a + 2) * 18, -64], 5, '#4f9a2a', '#1f4d0f', 1.5);
  }
  leaf(ctx, -18, -22, Math.PI + 0.3, 20, 7, LEAF, LEAF_O, { light: LEAF_L });
  leaf(ctx, 18, -26, -0.3, 20, 7, LEAF, LEAF_O, { light: LEAF_L });
  // 头部（向下啃咬）
  ctx.save();
  ctx.translate(0, -72 + chew * 6 + p * 20);
  ctx.beginPath();
  ctx.moveTo(-26, 8);
  ctx.bezierCurveTo(-30, -26, 30, -26, 26, 8);
  ctx.closePath();
  fs(ctx, rg(ctx, -8, -12, 2, 0, -4, 30, [0, '#b0e87a', 1, '#3f8f1e']), LEAF_O, 2.2);
  teeth(ctx, -24, 8, 24, 8, 7, 8, 1, '#fffbe8', '#555');
  eye(ctx, -8, -6, 4.5, 5, 0, 1.5, { pupil: 0.55 });
  eye(ctx, 8, -6, 4.5, 5, 0, 1.5, { pupil: 0.55 });
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = LEAF_O;
  ctx.beginPath();
  ctx.moveTo(-14, -14); ctx.lineTo(-4, -11);
  ctx.moveTo(14, -14); ctx.lineTo(4, -11);
  ctx.stroke();
  ctx.restore();
  ctx.restore();
}

// ================= 泳池植物 =================
export function lilypad(ctx, s) {
  const t = s.t + (s.phase || 0);
  const bob = s.icon ? 0 : Math.sin(t * 1.6) * 1.4;
  ctx.save();
  ctx.translate(0, bob - 2);
  if (!s.icon) {
    ctx.save();
    ctx.globalAlpha *= 0.3;
    E(ctx, 0, 4, 44, 12);
    ctx.strokeStyle = '#e8fbff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }
  ctx.scale(1, 0.42);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, 42, 0.25, TAU - 0.12);
  ctx.closePath();
  fs(ctx, rg(ctx, -12, -14, 4, 0, 0, 44, [0, '#b8ee8a', 0.6, '#6cc048', 1, '#3a8a24']), '#1f5a10', 4.5);
  ctx.globalAlpha *= 0.4;
  ctx.strokeStyle = '#2a6a18';
  ctx.lineWidth = 3;
  for (let i = 0; i < 7; i++) {
    const a = 0.5 + i * 0.8;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * 36, Math.sin(a) * 36);
    ctx.stroke();
  }
  ctx.restore();
}

export function tanglekelp(ctx, s) {
  const t = s.t + (s.phase || 0);
  const grab = s.grab || 0;
  ctx.save();
  // 水下阴影
  ctx.globalAlpha *= 0.35;
  E(ctx, 0, -2, 30, 9);
  ctx.fillStyle = '#0a4a40';
  ctx.fill();
  ctx.restore();
  const strands = 7;
  for (let i = 0; i < strands; i++) {
    const x0 = (i - (strands - 1) / 2) * 7;
    const h = 30 + (i % 3) * 8 + grab * 20;
    const w = Math.sin(t * 3 + i) * 7;
    tube(ctx, [x0, 0, x0 + w, -h * 0.4, x0 - w + grab * 10, -h * 0.8, x0 + w * 0.5 + grab * 18, -h], 5, '#3a8a3a', '#0f3a14', 1.6);
  }
  // 核心
  ctx.save();
  ctx.translate(0, -12 + Math.sin(t * 2) * 1.5);
  E(ctx, 0, 0, 16, 11);
  fs(ctx, rg(ctx, -4, -4, 2, 0, 0, 16, [0, '#6ab85a', 1, '#2a6a2a']), '#0f3a14', 2);
  eye(ctx, -5, -2, 4, 4.6, 1.2, 0, { pupil: 0.55 });
  eye(ctx, 5, -2, 4, 4.6, 1.2, 0, { pupil: 0.55 });
  ctx.restore();
  // 水面遮挡
  if (!s.icon) {
    ctx.save();
    ctx.globalAlpha *= 0.55;
    E(ctx, 0, 0, 30, 6);
    ctx.fillStyle = '#4ab8d8';
    ctx.fill();
    ctx.restore();
  }
}

export function jalapeno(ctx, s) {
  const t = s.t + (s.phase || 0);
  const fuse = s.fuse || 0;
  const sc = 1 + fuse * 0.3;
  shadow(ctx, 0, 0, 20, 7, 0.3);
  ctx.save();
  ctx.translate(fuse > 0 ? Math.sin(t * 55) * fuse * 3 : 0, 0);
  ctx.scale(1 + fuse * 0.12, sc);
  const bob = Math.sin(t * 2.5) * 1.5;
  ctx.translate(0, bob);
  // 身体
  ctx.beginPath();
  ctx.moveTo(-13, -70);
  ctx.bezierCurveTo(-22, -46, -18, -20, -4, -6);
  ctx.quadraticCurveTo(4, 2, 8, -4);
  ctx.bezierCurveTo(14, -24, 22, -50, 13, -70);
  ctx.quadraticCurveTo(0, -76, -13, -70);
  ctx.closePath();
  fs(ctx, lg(ctx, -18, 0, 18, 0, [0, fuse > 0.5 ? '#ffb070' : '#ff7a5a', 0.5, '#e8241a', 1, '#9a0a06']), '#4a0402', 2.4);
  ctx.save();
  ctx.globalAlpha *= 0.5;
  E(ctx, -7, -52, 3.5, 12, 0.15);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.restore();
  // 萼片与柄
  star(ctx, 0, -72, 13, 6, 5, -Math.PI / 2);
  fs(ctx, '#58a82c', '#1f4d0f', 1.8);
  tube(ctx, [0, -76, -2, -86, 6, -92], 4, '#4a8a24', '#1f4d0f', 1.4);
  // 脸
  eye(ctx, -6, -48, 4.4, 5.4, 1, 0.5, { pupil: 0.55, stroke: '#4a0402' });
  eye(ctx, 6, -48, 4.4, 5.4, 1, 0.5, { pupil: 0.55, stroke: '#4a0402' });
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#3a0402';
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-12, -58); ctx.lineTo(-3, -54);
  ctx.moveTo(12, -58); ctx.lineTo(3, -54);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-6, -36);
  ctx.quadraticCurveTo(0, -40 + fuse * 6, 6, -36);
  ctx.stroke();
  ctx.restore();
}

export function spikeweed(ctx, s) {
  const t = s.t + (s.phase || 0);
  const atk = s.attack || 0;
  ctx.save();
  ctx.scale(1, 0.5);
  E(ctx, 0, -4, 38, 20);
  fs(ctx, rg(ctx, -8, -12, 3, 0, -4, 40, [0, '#8ed65a', 1, '#3a7a1e']), '#1f4d0f', 3.5);
  ctx.restore();
  // 尖刺
  const spikes = [[-26, -4], [-13, -10], [0, -12], [13, -10], [26, -4], [-19, 2], [-6, 0], [7, 0], [20, 2]];
  spikes.forEach(([x, y], i) => {
    const h = 12 + (i % 3) * 3 + atk * 10 + Math.sin(t * 3 + i) * 0.8;
    ctx.beginPath();
    ctx.moveTo(x - 4, y);
    ctx.lineTo(x + (i % 2 ? 1 : -1), y - h);
    ctx.lineTo(x + 4, y);
    ctx.closePath();
    fs(ctx, lg(ctx, x, y, x, y - h, [0, '#8a9a80', 1, '#f4f8f0']), '#3a4a30', 1.4);
  });
  eye(ctx, -5, -2, 2.6, 2.6, 0.5, 0.3, { pupil: 0.6 });
  eye(ctx, 5, -2, 2.6, 2.6, 0.5, 0.3, { pupil: 0.6 });
}

export function torchwood(ctx, s) {
  const t = s.t + (s.phase || 0);
  shadow(ctx, 0, 0, 30, 9, 0.35);
  // 树桩
  ctx.beginPath();
  ctx.moveTo(-26, -2);
  ctx.quadraticCurveTo(-30, 0, -34, 2);
  ctx.lineTo(-24, -6);
  ctx.lineTo(-24, -56);
  ctx.lineTo(24, -56);
  ctx.lineTo(24, -6);
  ctx.lineTo(34, 2);
  ctx.quadraticCurveTo(0, 6, -34, 2);
  ctx.closePath();
  fs(ctx, lg(ctx, -24, 0, 24, 0, [0, '#6a3e18', 0.35, '#a8703a', 0.7, '#8a5626', 1, '#4a2808']), '#2e1604', 2.4);
  ctx.save();
  ctx.globalAlpha *= 0.4;
  ctx.strokeStyle = '#2e1604';
  ctx.lineWidth = 1.6;
  for (const x of [-17, -8, 3, 12, 19]) {
    ctx.beginPath();
    ctx.moveTo(x, -54);
    ctx.bezierCurveTo(x + 3, -40, x - 3, -22, x + 1, -6);
    ctx.stroke();
  }
  ctx.restore();
  // 年轮顶面
  E(ctx, 0, -56, 24, 8);
  fs(ctx, rg(ctx, 0, -56, 1, 0, -56, 24, [0, '#f0c070', 1, '#b07a3a']), '#2e1604', 2);
  ctx.save();
  ctx.globalAlpha *= 0.4;
  for (let r = 6; r < 22; r += 5) { E(ctx, 0, -56, r, r / 3); ctx.strokeStyle = '#6a3e18'; ctx.lineWidth = 1; ctx.stroke(); }
  ctx.restore();
  // 脸
  const glow = 0.7 + Math.sin(t * 8) * 0.15;
  for (const ex of [-9, 9]) {
    E(ctx, ex, -34, 5.5, 4.2);
    ctx.fillStyle = '#2e1604';
    ctx.fill();
    E(ctx, ex, -33, 3, 2.4);
    ctx.fillStyle = `rgba(255,${Math.floor(150 + glow * 80)},40,1)`;
    ctx.fill();
  }
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#2e1604';
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-17, -44); ctx.lineTo(-4, -39);
  ctx.moveTo(17, -44); ctx.lineTo(4, -39);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-9, -20);
  ctx.quadraticCurveTo(0, -25, 9, -20);
  ctx.quadraticCurveTo(0, -16, -9, -20);
  fs(ctx, '#ff9a2a', '#2e1604', 2);
  // 火焰
  drawFlame(ctx, 0, -58, 26, 44, t, s.icon ? 0.9 : 1);
}

export function drawFlame(ctx, x, y, w, h, t, intensity = 1) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const layers = [
    { c0: 'rgba(255,70,0,0.85)', c1: 'rgba(255,40,0,0)', s: 1 },
    { c0: 'rgba(255,160,0,0.9)', c1: 'rgba(255,120,0,0)', s: 0.72 },
    { c0: 'rgba(255,245,170,1)', c1: 'rgba(255,220,100,0)', s: 0.42 },
  ];
  for (const L of layers) {
    for (let i = 0; i < 3; i++) {
      const ox = (i - 1) * w * 0.32 * L.s;
      const fh = h * L.s * (0.75 + 0.25 * Math.sin(t * 9 + i * 2.1)) * (i === 1 ? 1 : 0.75) * intensity;
      const lean = Math.sin(t * 6 + i * 1.3) * w * 0.18;
      ctx.beginPath();
      ctx.moveTo(x + ox - w * 0.38 * L.s, y + 2);
      ctx.bezierCurveTo(x + ox - w * 0.45 * L.s, y - fh * 0.5, x + ox + lean - w * 0.1, y - fh * 0.8, x + ox + lean, y - fh);
      ctx.bezierCurveTo(x + ox + lean + w * 0.1, y - fh * 0.8, x + ox + w * 0.45 * L.s, y - fh * 0.5, x + ox + w * 0.38 * L.s, y + 2);
      ctx.closePath();
      ctx.fillStyle = rg(ctx, x + ox, y, 1, x + ox, y - fh * 0.3, fh, [0, L.c0, 1, L.c1]);
      ctx.fill();
    }
  }
  ctx.restore();
}

export function magnetshroom(ctx, s) {
  const t = s.t + (s.phase || 0);
  const cool = s.cooldown || 0;
  shadow(ctx, 0, 0, 26, 8, 0.3);
  ctx.save();
  sleepTilt(ctx, s);
  shroomStem(ctx, 0, 0, 24, 26, { colors: ['#f4e8ff', '#c0a8d8', '#4a3060'] });
  if (!sleepyEyes(ctx, s, [-5, 5], -15, 3.6)) {
    eye(ctx, -5, -15, 3.6, 4.4, 0.6, 0.4, { pupil: 0.55 });
    eye(ctx, 5, -15, 3.6, 4.4, 0.6, 0.4, { pupil: 0.55 });
  }
  shroomCap(ctx, 0, -26, 25, 15, '#d8b0f0', '#7a40a8', '#3a0f58', [[-0.5, 0.5, 0.12], [0.5, 0.6, 0.1]]);
  // 马蹄磁铁
  ctx.save();
  ctx.translate(0, -52 + Math.sin(t * 2) * 1.5);
  ctx.rotate(Math.PI);
  ctx.lineCap = 'butt';
  ctx.beginPath();
  ctx.arc(0, 0, 13, 0, Math.PI);
  ctx.lineWidth = 12;
  ctx.strokeStyle = '#2a0a0a';
  ctx.stroke();
  ctx.lineWidth = 8.5;
  ctx.strokeStyle = cool > 0 ? '#9a3a3a' : '#e8301e';
  ctx.stroke();
  for (const sx of [-13, 13]) {
    ctx.fillStyle = '#2a0a0a';
    ctx.fillRect(sx - 6, -9, 12, 10);
    ctx.fillStyle = '#d8e0e8';
    ctx.fillRect(sx - 4.2, -7.5, 8.4, 7.5);
  }
  ctx.restore();
  if (!cool && !s.sleep && !s.icon) {
    ctx.save();
    ctx.globalAlpha *= 0.5 + Math.sin(t * 10) * 0.3;
    ctx.strokeStyle = '#ffe860';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(0, -46, 20 + i * 7 + (t * 20) % 7, -2.4, -0.7);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
  zzz(ctx, s, 14, -60);
}

export function coffeebean(ctx, s) {
  const t = s.t + (s.phase || 0);
  const bounce = Math.abs(Math.sin(t * 5)) * 4;
  ctx.save();
  ctx.translate(0, -bounce);
  shadow(ctx, 0, bounce, 12, 4, 0.3);
  leaf(ctx, 0, -28, -2.2, 12, 4.5, LEAF, LEAF_O, { light: LEAF_L });
  leaf(ctx, 0, -28, -0.9, 12, 4.5, LEAF, LEAF_O, { light: LEAF_L });
  E(ctx, 0, -15, 11, 14, 0.15);
  fs(ctx, rg(ctx, -4, -20, 1, 0, -15, 15, [0, '#b07a4a', 1, '#5a3014']), '#2a1404', 2);
  ctx.beginPath();
  ctx.moveTo(2, -28);
  ctx.bezierCurveTo(-4, -20, 6, -10, 0, -2);
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#2a1404';
  ctx.stroke();
  eye(ctx, -4, -17, 2.6, 3, 0.4, 0.4, { pupil: 0.6 });
  eye(ctx, 4.5, -17, 2.6, 3, 0.4, 0.4, { pupil: 0.6 });
  ctx.restore();
}

// ================= 浓雾关植物 =================
export function seashroom(ctx, s) {
  const t = s.t + (s.phase || 0);
  const sh = s.shoot ? Math.sin(Math.min(1, s.shoot) * Math.PI) : 0;
  const bob = s.icon ? 0 : Math.sin(t * 1.8) * 1.5;
  ctx.save();
  ctx.translate(0, bob - 4);
  sleepTilt(ctx, s);
  ctx.scale(1 - sh * 0.1, 1 + sh * 0.12);
  shroomStem(ctx, 0, 0, 20, 22, { colors: ['#e8fff8', '#a8d8c8', '#2a5a50'] });
  ctx.save();
  ctx.translate(9, -11);
  tube(ctx, [0, 0, 8 + sh * 3, 0], 8 + sh * 2, '#d8f4ec', '#2a5a50', 1.8);
  E(ctx, 9 + sh * 3, 0, 2.5, 4 + sh);
  ctx.fillStyle = '#10302a';
  ctx.fill();
  ctx.restore();
  if (!sleepyEyes(ctx, s, [-3, 4], -13, 3.2)) {
    eye(ctx, -3, -13, 3, 4.2, 1, 0.5, { pupil: 0.6, stroke: '#1a3a30' });
    eye(ctx, 4, -13, 3, 4.2, 1, 0.5, { pupil: 0.6, stroke: '#1a3a30' });
  }
  shroomCap(ctx, 0, -22 + Math.sin(t * 3) * 0.6, 21, 15, '#a8f8e0', '#1a9a80', '#0a4a3e', [[-0.45, 0.6, 0.18], [0.35, 0.75, 0.14], [0.05, 1.0, 0.1]]);
  ctx.restore();
  if (!s.icon) {
    ctx.save();
    ctx.globalAlpha *= 0.55;
    E(ctx, 0, -2, 26, 6);
    ctx.strokeStyle = '#e8fbff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }
  zzz(ctx, s, 12, -40);
}

export function plantern(ctx, s) {
  const t = s.t + (s.phase || 0);
  const sway = Math.sin(t * 1.5);
  shadow(ctx, 0, 0, 26, 8, 0.3);
  groundLeaves(ctx, t, { len: 24, wid: 8 });
  // 灯柱般的弯茎
  tube(ctx, [0, -2, -8, -40, 2, -84, 20 + sway * 2, -80], 6, '#4f9a2a', LEAF_O, 2);
  leaf(ctx, -5, -30, Math.PI + 0.5, 18, 6, LEAF, LEAF_O, { light: LEAF_L });
  leaf(ctx, -3, -46, -0.4, 16, 5, LEAF, LEAF_O, { light: LEAF_L });
  const lx = 22 + sway * 3, ly = -58;
  // 光晕
  if (!s.icon) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const a = 0.45 + Math.sin(t * 3) * 0.08;
    C(ctx, lx, ly, 90);
    ctx.fillStyle = rg(ctx, lx, ly, 6, lx, ly, 90, [0, `rgba(255,250,170,${a})`, 0.4, `rgba(255,230,100,${a * 0.4})`, 1, 'rgba(255,200,0,0)']);
    ctx.fill();
    ctx.restore();
  }
  tube(ctx, [20 + sway * 2, -80, lx, ly - 18], 2.5, '#3a7a1e', LEAF_O, 1.2);
  // 灯泡
  ctx.save();
  ctx.translate(lx, ly);
  ctx.rotate(sway * 0.05);
  E(ctx, 0, 0, 17, 19);
  fs(ctx, rg(ctx, -4, -6, 2, 0, 0, 20, [0, '#ffffe0', 0.4, '#fff27a', 1, '#d8c020']), '#6a5a00', 2);
  ctx.strokeStyle = 'rgba(150,120,0,0.45)';
  ctx.lineWidth = 1.5;
  for (const x of [-8, 0, 8]) { ctx.beginPath(); ctx.ellipse(0, 0, Math.abs(x) + 2, 18, 0, -1.4, 1.4); ctx.stroke(); }
  // 叶片灯罩
  ctx.beginPath();
  ctx.moveTo(-14, -12); ctx.quadraticCurveTo(0, -30, 14, -12); ctx.quadraticCurveTo(0, -18, -14, -12);
  fs(ctx, LEAF, LEAF_O, 1.6);
  eye(ctx, -5, 0, 3, 3.6, 0.8, 0.4, { pupil: 0.6, stroke: '#6a5a00' });
  eye(ctx, 5, 0, 3, 3.6, 0.8, 0.4, { pupil: 0.6, stroke: '#6a5a00' });
  ctx.beginPath();
  ctx.arc(0, 5, 3.5, 0.2 * Math.PI, 0.8 * Math.PI);
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = '#6a5a00';
  ctx.stroke();
  ctx.restore();
}

export function cactus(ctx, s) {
  const t = s.t + (s.phase || 0);
  const st = s.stretch || 0;
  const sh = s.shoot ? Math.sin(Math.min(1, s.shoot) * Math.PI) : 0;
  shadow(ctx, 0, 0, 26, 8, 0.3);
  const h = 66 + st * 60;
  const sway = Math.sin(t * 1.6) * (1 - st);
  ctx.save();
  ctx.translate(sway, 0);
  // 手臂
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * 16, -28);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(side * 14, -2, side * 14, -18);
    ctx.lineWidth = 12; ctx.lineCap = 'round'; ctx.strokeStyle = '#1f4d0f'; ctx.stroke();
    ctx.lineWidth = 8; ctx.strokeStyle = '#6cc040'; ctx.stroke();
    ctx.restore();
  }
  // 主体
  ctx.beginPath();
  ctx.moveTo(-18, 0);
  ctx.lineTo(-18, -h + 16);
  ctx.quadraticCurveTo(-18, -h, 0, -h);
  ctx.quadraticCurveTo(18, -h, 18, -h + 16);
  ctx.lineTo(18, 0);
  ctx.quadraticCurveTo(0, 4, -18, 0);
  ctx.closePath();
  fs(ctx, lg(ctx, -18, 0, 18, 0, [0, '#4a9a2a', 0.45, '#8ee05a', 1, '#3a8a1e']), '#1f4d0f', 2.2);
  ctx.strokeStyle = 'rgba(30,80,10,0.4)';
  ctx.lineWidth = 1.5;
  for (const x of [-9, 0, 9]) { ctx.beginPath(); ctx.moveTo(x, -h + 8); ctx.lineTo(x, -4); ctx.stroke(); }
  // 小刺
  ctx.strokeStyle = '#f8f8e8';
  ctx.lineWidth = 1.4;
  for (let y = -h + 14; y < -6; y += 12) {
    for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(side * 18, y); ctx.lineTo(side * 24, y - 3); ctx.stroke(); }
  }
  // 花
  ctx.save();
  ctx.translate(0, -h - 2);
  for (let i = 0; i < 5; i++) {
    ctx.rotate(TAU / 5);
    E(ctx, 0, -6, 4, 7);
    fs(ctx, '#ff7ab8', '#9a2a5a', 1.2);
  }
  C(ctx, 0, 0, 3.5);
  fs(ctx, '#ffe04a', '#9a6a00', 1);
  ctx.restore();
  // 脸 + 嘴刺
  const fy = -h + 26;
  eye(ctx, -6, fy, 4, 5, 1.2, 0.5, { pupil: 0.55 });
  eye(ctx, 6, fy, 4, 5, 1.2, 0.5, { pupil: 0.55 });
  ctx.beginPath();
  ctx.ellipse(6, fy + 11, 4 + sh * 2, 3 + sh * 2, 0, 0, TAU);
  fs(ctx, '#2a4a10', '#1f4d0f', 1.2);
  ctx.restore();
}

export function blover(ctx, s) {
  const t = s.t + (s.phase || 0);
  const spin = s.spin || 0;
  shadow(ctx, 0, 0, 22, 7, 0.3);
  groundLeaves(ctx, t, { len: 20, wid: 7 });
  tube(ctx, [0, -2, 2, -24, 0, -46], 5, '#58b52e', LEAF_O, 1.8);
  ctx.save();
  ctx.translate(0, -52);
  ctx.rotate(t * (0.6 + spin * 25));
  for (let i = 0; i < 4; i++) {
    ctx.save();
    ctx.rotate((i / 4) * TAU);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-18, -6, -20, -26, -6, -28);
    ctx.quadraticCurveTo(0, -24, 0, -20);
    ctx.quadraticCurveTo(0, -24, 6, -28);
    ctx.bezierCurveTo(20, -26, 18, -6, 0, 0);
    fs(ctx, lg(ctx, 0, -28, 0, 0, [0, '#b0f070', 1, '#4aa02a']), LEAF_O, 1.8);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, -3); ctx.lineTo(0, -18); ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
  C(ctx, 0, -52, 9);
  fs(ctx, rg(ctx, -2, -55, 1, 0, -52, 10, [0, '#c8f890', 1, '#5ab030']), LEAF_O, 1.6);
  eye(ctx, -3, -53, 2.2, 2.8, 0.4, 0.3, { pupil: 0.6 });
  eye(ctx, 3, -53, 2.2, 2.8, 0.4, 0.3, { pupil: 0.6 });
}

export function splitpea(ctx, s) {
  const t = s.t + (s.phase || 0);
  const sway = Math.sin(t * 2.3);
  const rf = s.shoot ? Math.sin(Math.min(1, s.shoot) * Math.PI) : 0;
  const rb = s.shoot2 ? Math.sin(Math.min(1, s.shoot2) * Math.PI) : 0;
  const v = PEA;
  shadow(ctx, 0, 0, 30, 9, 0.3);
  groundLeaves(ctx, t, { fill: v.leaf, light: v.leafLight, stroke: v.outline });
  const hx = sway * 2 - rf * 4 + rb * 4, hy = -54;
  tube(ctx, [0, -2, 2, -20, hx - 4, hy + 22, hx, hy + 8], 7.5, v.stem, v.outline, 2);
  ctx.save();
  ctx.translate(hx, hy);
  // 后脑袋（朝左）
  ctx.save();
  ctx.translate(-20, -2);
  ctx.scale(-0.82, 0.82);
  ctx.rotate(-rb * 0.1);
  shooterHead(ctx, v, rb, { r: 18, snout: 17, mouth: 9 });
  eye(ctx, 3, -6, 5.5, 7, 1.8, 0.5, { pupil: 0.52 });
  ctx.restore();
  // 前脑袋
  ctx.rotate(sway * 0.03 - rf * 0.1);
  shooterHead(ctx, v, rf);
  eye(ctx, 3, -7, 6.5, 8, 2, 0.5, { pupil: 0.52 });
  ctx.restore();
}

export function starfruit(ctx, s) {
  const t = s.t + (s.phase || 0);
  const sh = s.shoot ? Math.sin(Math.min(1, s.shoot) * Math.PI) : 0;
  shadow(ctx, 0, 0, 26, 8, 0.3);
  groundLeaves(ctx, t, { len: 22, wid: 8 });
  ctx.save();
  ctx.translate(0, -36);
  ctx.rotate(Math.sin(t * 1.2) * 0.08);
  ctx.scale(1 + sh * 0.12, 1 - sh * 0.08);
  // 圆角五角星
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? 32 : 15;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.lineJoin = 'round';
  ctx.lineWidth = 7;
  ctx.strokeStyle = '#7a4a00';
  ctx.stroke();
  fs(ctx, rg(ctx, -6, -8, 2, 0, 0, 32, [0, '#fff6a0', 0.5, '#ffd83a', 1, '#f0a010']), '#f0b020', 3);
  eye(ctx, -6, -2, 4, 5, 0.6, 0.4, { pupil: 0.55, stroke: '#7a4a00' });
  eye(ctx, 6, -2, 4, 5, 0.6, 0.4, { pupil: 0.55, stroke: '#7a4a00' });
  ctx.beginPath();
  ctx.arc(0, 5, 4, 0.2 * Math.PI, 0.8 * Math.PI);
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = '#7a4a00';
  ctx.stroke();
  ctx.globalAlpha *= 0.45;
  E(ctx, -10, -12, 6, 3, -0.6);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.restore();
}

// 南瓜头：part = 'back' 画在植物后面，'front' 画在植物前面，缺省画完整图标
export function pumpkin(ctx, s) {
  const t = s.t + (s.phase || 0);
  const part = s.part;
  const dmg = s.dmg || 0;
  const icon = !part;
  const dark = ['#e87a1a', '#a04a08', '#5a2a00'];
  if (icon) {
    shadow(ctx, 0, 0, 38, 9, 0.3);
    ctx.save();
    ctx.translate(0, -34);
    for (const [x, rx] of [[-22, 20], [22, 20], [-10, 22], [10, 22], [0, 22]]) {
      E(ctx, x, 0, rx, 32);
      fs(ctx, rg(ctx, x - 6, -12, 3, x, 0, 34, [0, '#ffb04a', 0.6, dark[0], 1, dark[1]]), dark[2], 2);
    }
    tube(ctx, [0, -30, -2, -40, 6, -44], 5, '#5a8a24', '#1f4d0f', 1.4);
    ctx.fillStyle = '#3a1400';
    ctx.beginPath(); ctx.moveTo(-20, -6); ctx.lineTo(-8, -6); ctx.lineTo(-14, -16); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(8, -6); ctx.lineTo(20, -6); ctx.lineTo(14, -16); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-22, 6); ctx.quadraticCurveTo(0, 26, 22, 6); ctx.quadraticCurveTo(0, 14, -22, 6); ctx.fill();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(255,200,60,0.35)';
    ctx.beginPath(); ctx.moveTo(-18, 8); ctx.quadraticCurveTo(0, 20, 18, 8); ctx.quadraticCurveTo(0, 13, -18, 8); ctx.fill();
    ctx.restore();
    ctx.restore();
    return;
  }
  if (icon || part === 'back') {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, -30, 40, 34, 0, Math.PI, TAU);
    ctx.lineTo(40, -22);
    ctx.lineTo(-40, -22);
    ctx.closePath();
    fs(ctx, lg(ctx, 0, -64, 0, -22, [0, '#c85a0a', 1, '#8a3a04']), dark[2], 2.2);
    ctx.restore();
  }
  if (icon || part === 'front') {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-42, -30);
    ctx.bezierCurveTo(-44, 0, -20, 6, 0, 6);
    ctx.bezierCurveTo(20, 6, 44, 0, 42, -30);
    ctx.quadraticCurveTo(0, -18 + (icon ? -30 : 0), -42, -30);
    ctx.closePath();
    fs(ctx, rg(ctx, -10, -30, 4, 0, -14, 50, [0, '#ffb04a', 0.6, dark[0], 1, dark[1]]), dark[2], 2.5);
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = 'rgba(90,40,0,0.35)';
    ctx.lineWidth = 2;
    for (const x of [-24, -8, 8, 24]) { ctx.beginPath(); ctx.moveTo(x, -30); ctx.quadraticCurveTo(x * 1.2, -12, x * 0.9, 6); ctx.stroke(); }
    if (dmg >= 1) { ctx.strokeStyle = dark[2]; ctx.beginPath(); ctx.moveTo(-30, -20); ctx.lineTo(-22, -12); ctx.lineTo(-26, -4); ctx.stroke(); }
    if (dmg >= 2) { ctx.fillStyle = 'rgba(60,20,0,0.5)'; E(ctx, 20, -10, 8, 5); ctx.fill(); }
    ctx.restore();
    if (icon) {
      // 雕刻的笑脸
      ctx.fillStyle = '#3a1400';
      ctx.beginPath(); ctx.moveTo(-18, -26); ctx.lineTo(-8, -26); ctx.lineTo(-13, -34); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(8, -26); ctx.lineTo(18, -26); ctx.lineTo(13, -34); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-20, -14); ctx.quadraticCurveTo(0, 0, 20, -14); ctx.quadraticCurveTo(0, -6, -20, -14); ctx.fill();
      tube(ctx, [0, -60, -2, -70, 6, -74], 5, '#5a8a24', '#1f4d0f', 1.4);
    }
    ctx.restore();
  }
}

export function garlic(ctx, s) {
  const t = s.t + (s.phase || 0);
  const dmg = s.dmg || 0;
  shadow(ctx, 0, 0, 26, 8, 0.3);
  ctx.save();
  const b = 1 + Math.sin(t * 1.8) * 0.015;
  ctx.scale(2 - b, b);
  ctx.beginPath();
  ctx.moveTo(0, -70);
  ctx.bezierCurveTo(8, -56, 30, -48, 28, -22);
  ctx.bezierCurveTo(26, -2, 10, 2, 0, 2);
  ctx.bezierCurveTo(-10, 2, -26, -2, -28, -22);
  ctx.bezierCurveTo(-30, -48, -8, -56, 0, -70);
  ctx.closePath();
  fs(ctx, rg(ctx, -8, -36, 3, 0, -28, 40, [0, '#ffffff', 0.6, '#f0e8f4', 1, '#c8b0d0']), '#5a4a60', 2.4);
  ctx.strokeStyle = 'rgba(150,90,170,0.45)';
  ctx.lineWidth = 2;
  for (const x of [-14, 0, 14]) { ctx.beginPath(); ctx.moveTo(x * 0.3, -62); ctx.quadraticCurveTo(x * 1.3, -30, x, 0); ctx.stroke(); }
  if (dmg >= 1) { ctx.fillStyle = 'rgba(90,60,90,0.35)'; E(ctx, 16, -40, 7, 4, 0.4); ctx.fill(); }
  if (dmg >= 2) { ctx.fillStyle = 'rgba(90,60,90,0.45)'; E(ctx, -14, -18, 8, 5, -0.4); ctx.fill(); }
  const sad = dmg >= 1;
  eye(ctx, -8, -30, 4.5, 5.5, 1, sad ? 1.5 : 0.5, { pupil: 0.5, stroke: '#5a4a60' });
  eye(ctx, 8, -30, 4.5, 5.5, 1, sad ? 1.5 : 0.5, { pupil: 0.5, stroke: '#5a4a60' });
  ctx.beginPath();
  if (sad) ctx.arc(0, -12, 5, 1.15 * Math.PI, 1.85 * Math.PI);
  else ctx.arc(0, -20, 5, 0.2 * Math.PI, 0.8 * Math.PI);
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#5a4a60';
  ctx.stroke();
  ctx.restore();
}

// ================= 注册表 =================
export const PLANT_ART = {
  peashooter, sunflower, cherrybomb, wallnut, potatomine, snowpea, chomper, repeater,
  puffshroom, sunshroom, fumeshroom, gravebuster, hypnoshroom, scaredyshroom, iceshroom, doomshroom,
  lilypad, squash, threepeater, tanglekelp, jalapeno, spikeweed, torchwood, tallnut,
  magnetshroom, coffeebean,
  seashroom, plantern, cactus, blover, splitpea, starfruit, pumpkin, garlic,
};
