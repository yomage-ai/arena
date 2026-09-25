// 僵尸美术：骨骼式人形绑定（腿/躯干/手臂/头部分段绘制），支持行走、啃食、跳跃、倒地、
// 断臂掉头、护具多级破损、手持物（旗帜 / 报纸 / 铁门 / 撑杆）等状态。原点在脚底，朝左。
import { TAU, clamp, lerp } from '../core/util.js';
import { E, C, fs, rg, lg, tube, eye, blob, teeth, line, rr, text, star } from './paint.js';

const SKIN = { light: '#bfcda5', mid: '#9aae86', dark: '#6f8260', stroke: '#2f3a26' };

export const LOOKS = {
  normal: { coat: '#6e5641', coatDark: '#48362a', pants: '#5a4a3b', shirt: '#eee7d6', tie: '#c1232c' },
  flag: { coat: '#6e5641', coatDark: '#48362a', pants: '#5a4a3b', shirt: '#eee7d6', tie: '#c1232c', held: 'flag' },
  cone: { coat: '#6e5641', coatDark: '#48362a', pants: '#5a4a3b', shirt: '#eee7d6', tie: '#c1232c' },
  bucket: { coat: '#6e5641', coatDark: '#48362a', pants: '#5a4a3b', shirt: '#eee7d6', tie: '#c1232c' },
  screendoor: { coat: '#5e5a4a', coatDark: '#3e3a2e', pants: '#4a4a5a', shirt: '#eee7d6', tie: '#2a6ac1', held: 'door' },
  newspaper: { coat: '#8b8274', coatDark: '#5e5649', pants: '#6a5d86', shirt: '#f2efe6', tie: '#6a3a8a', held: 'paper', glasses: true, hair: '#e8e8e8' },
  pole: { coat: '#f2f0ea', coatDark: '#b8b4a8', pants: '#2f4fb8', shirt: '#f2f0ea', tie: null, stripe: '#d8322a', held: 'pole', band: '#d8322a', sleeveless: true },
  football: { coat: '#c8202a', coatDark: '#8a1018', pants: '#e8e6de', shirt: '#c8202a', tie: null, pads: true, number: '9' },
  dancer: { coat: '#6a3aa8', coatDark: '#43207a', pants: '#f0ece0', shirt: '#f4d23a', tie: null, afro: '#2a1a10', chain: true },
  backup: { coat: '#2f9ad2', coatDark: '#1a6a98', pants: '#f0ece0', shirt: '#f4f4f4', tie: null, afro: '#3a2414', band: '#f4d23a' },
  ducky: { coat: '#6e5641', coatDark: '#48362a', pants: '#5a4a3b', shirt: '#eee7d6', tie: '#c1232c', tube: true },
  snorkel: { coat: '#8a9a7a', coatDark: '#5a6a4a', pants: '#1a2a3a', shirt: '#8a9a7a', tie: null, bare: true, mask: true },
  dolphin: { coat: '#26323e', coatDark: '#141c24', pants: '#26323e', shirt: '#26323e', tie: null, goggles: true },
  imp: { coat: '#b08a60', coatDark: '#7a5a38', pants: '#7a5a38', shirt: '#b08a60', tie: null, small: true },
  balloon: { coat: '#6a5a8a', coatDark: '#443a60', pants: '#4a4a5a', shirt: '#eee7d6', tie: '#e8b020', held: 'balloon' },
  digger: { coat: '#9a7440', coatDark: '#6a4e28', pants: '#5a4a3a', shirt: '#d8b070', tie: null, hardhat: true, held: 'pickaxe' },
  pogo: { coat: '#3a6ac8', coatDark: '#24448a', pants: '#2a3060', shirt: '#f4f4f4', tie: null, held: 'pogo', band: '#f0c020' },
  jackbox: { coat: '#c83a3a', coatDark: '#8a2020', pants: '#3a3a8a', shirt: '#f4e04a', tie: null, held: 'jackbox', clown: true },
};

// ---------- 姿态计算 ----------
function pose(z) {
  const t = z.t || 0;
  const ph = z.walkPh || 0;
  const p = {
    legF: 0, legB: 0, kneeF: 0, kneeB: 0, lean: -0.05, armUF: 0.3, armLF: 0.45, armUB: 0.2, armLB: 0.4,
    headRot: -0.03, headX: 0, headY: 0, jaw: 0.25, bob: 0,
  };
  const st = z.anim || 'walk';
  if (st === 'walk' || st === 'run') {
    const amp = st === 'run' ? 0.62 : 0.42;
    p.legF = Math.sin(ph) * amp;
    p.legB = -Math.sin(ph) * amp;
    p.kneeF = Math.max(0, -Math.cos(ph)) * (st === 'run' ? 1.0 : 0.55);
    p.kneeB = Math.max(0, Math.cos(ph)) * (st === 'run' ? 1.0 : 0.55);
    p.lean = (st === 'run' ? -0.2 : -0.07) + Math.sin(ph * 2) * 0.02;
    p.armUF = 0.3 - Math.sin(ph) * 0.22;
    p.armLF = 0.5;
    p.armUB = 0.22 + Math.sin(ph) * 0.22;
    p.armLB = 0.45;
    p.headRot = -0.04 + Math.sin(ph) * 0.06;
    p.jaw = 0.22 + Math.sin(t * 3.1) * 0.12;
    if (st === 'run') { p.armUF = 0.6 - Math.sin(ph) * 0.5; p.armUB = 0.6 + Math.sin(ph) * 0.5; p.armLF = p.armLB = 1.2; }
  } else if (st === 'eat') {
    const e = z.eatPh || 0;
    p.legF = 0.2; p.legB = -0.22; p.kneeF = 0.1; p.kneeB = 0.15;
    p.lean = -0.16 + Math.sin(e) * 0.05;
    p.armUF = 1.3 + Math.sin(e) * 0.25;
    p.armLF = 0.35 + Math.sin(e + 0.5) * 0.25;
    p.armUB = 1.15 + Math.sin(e + 1.2) * 0.22;
    p.armLB = 0.4;
    p.headRot = -0.18 + Math.sin(e) * 0.12;
    p.headX = -2 + Math.sin(e) * 3;
    p.jaw = 0.25 + Math.max(0, Math.sin(e * 2)) * 0.7;
  } else if (st === 'idle') {
    const s = Math.sin(t * 1.6 + (z.seed || 0));
    p.legF = 0.08; p.legB = -0.08;
    p.lean = -0.05 + s * 0.03;
    p.armUF = 0.2 + s * 0.08; p.armUB = 0.15 - s * 0.06;
    p.headRot = -0.05 + Math.sin(t * 1.1 + (z.seed || 0)) * 0.07;
    p.jaw = 0.2 + Math.sin(t * 2.3) * 0.12;
  } else if (st === 'dance') {
    const d = t * 6;
    p.legF = Math.sin(d) * 0.3; p.legB = -Math.sin(d) * 0.3;
    p.kneeF = 0.3; p.kneeB = 0.3;
    p.lean = Math.sin(d * 0.5) * 0.12;
    p.armUF = 2.6 + Math.sin(d) * 0.3; p.armLF = 0.2;
    p.armUB = 0.9 + Math.cos(d) * 0.4; p.armLB = 0.8;
    p.headRot = Math.sin(d * 0.5) * 0.15;
    p.jaw = 0.4;
  } else if (st === 'point') {
    p.armUF = 2.4; p.armLF = 0.1; p.armUB = 0.3; p.lean = 0.04; p.headRot = 0.1; p.jaw = 0.6;
  } else if (st === 'jump') {
    const j = z.jumpT || 0;
    p.legF = 0.8; p.legB = -0.5; p.kneeF = 1.2; p.kneeB = 1.0;
    p.lean = -0.5 + j * 0.6;
    p.armUF = 2.2; p.armLF = 0.2; p.armUB = 2.0; p.armLB = 0.2;
    p.jaw = 0.8;
  } else if (st === 'swim') {
    p.armUF = 0.9 + Math.sin(t * 4) * 0.4; p.armLF = 0.6;
    p.armUB = 0.9 - Math.sin(t * 4) * 0.4; p.armLB = 0.6;
    p.lean = -0.08; p.jaw = 0.3 + Math.sin(t * 3) * 0.1;
    p.legF = Math.sin(t * 5) * 0.3; p.legB = -Math.sin(t * 5) * 0.3;
  } else if (st === 'die') {
    p.legF = 0.05; p.legB = -0.1; p.armUF = 0.1; p.armUB = 0.05; p.armLF = 0.2; p.lean = 0.1;
  } else if (st === 'angry') {
    p.armUF = 2.2 + Math.sin(t * 20) * 0.3; p.armLF = 0.6; p.armUB = 2.0 + Math.cos(t * 20) * 0.3; p.armLB = 0.6;
    p.jaw = 0.9; p.lean = 0.1;
  }
  if (st === 'float') {
    p.legF = 0.25 + Math.sin(t * 2.2) * 0.2; p.legB = -0.1 + Math.sin(t * 2.2 + 1) * 0.2;
    p.kneeF = 0.3; p.kneeB = 0.4;
    p.armUF = 2.9; p.armLF = 0.2; p.armUB = 2.6; p.armLB = 0.3;
    p.headRot = Math.sin(t * 1.3) * 0.08; p.lean = Math.sin(t * 1.1) * 0.05;
  } else if (st === 'pogo') {
    p.legF = 0.35; p.legB = 0.2; p.kneeF = 0.9; p.kneeB = 1.0;
    p.armUF = 1.0; p.armLF = 0.4; p.armUB = 0.9; p.armLB = 0.5; p.lean = -0.05;
  } else if (st === 'dig') {
    const d = t * 5;
    p.armUF = 2.2 + Math.sin(d) * 0.6; p.armLF = 0.4; p.armUB = 1.8 + Math.sin(d) * 0.5; p.armLB = 0.5; p.lean = -0.2;
  }
  // 手持物姿势覆盖
  const held = z.held;
  if (held === 'paper' && st !== 'eat') { p.armUF = 0.95; p.armLF = 0.9; p.armUB = 0.85; p.armLB = 1.0; }
  if (held === 'door' && st !== 'die') { p.armUF = 0.75; p.armLF = 0.5; }
  if (held === 'pole' && st !== 'jump') { p.armUF = 0.75; p.armLF = 0.9; p.armUB = 0.65; p.armLB = 0.9; }
  if (held === 'flag') { p.armLF = 1.3; p.armUF = 0.55; }
  if (held === 'jackbox' && st !== 'eat') { p.armUF = 0.9; p.armLF = 0.8; p.armUB = 0.8; p.armLB = 0.9; }
  if (held === 'pickaxe' && st === 'walk') { p.armUF = 2.4; p.armLF = 0.3; }
  return p;
}

function legPoints(hx, hy, a, knee, L1 = 25, L2 = 24) {
  const kx = hx - Math.sin(a) * L1, ky = hy + Math.cos(a) * L1;
  const b = a - knee;
  const fx = kx - Math.sin(b) * L2, fy = ky + Math.cos(b) * L2;
  return { kx, ky, fx, fy, b };
}

function drawLeg(ctx, hip, lp, L, dark, sc) {
  const pants = dark ? L.pantsDark || shadeHex(L.pants, -0.25) : L.pants;
  const stroke = '#1e1812';
  tube(ctx, [hip.x, hip.y, lp.kx, lp.ky], 11 * sc, pants, stroke, 1.6);
  tube(ctx, [lp.kx, lp.ky, lp.fx, lp.fy], 10 * sc, pants, stroke, 1.6);
  if (L.bare) {
    tube(ctx, [lp.kx, lp.ky, lp.fx, lp.fy - 2], 7.5 * sc, dark ? SKIN.dark : SKIN.mid, SKIN.stroke, 1.4);
  }
  // 鞋
  ctx.save();
  ctx.translate(lp.fx, lp.fy);
  ctx.rotate(-lp.b * 0.6);
  E(ctx, -5 * sc, -2, 10.5 * sc, 5 * sc);
  const shoe = L.shoe || (dark ? '#231a12' : '#3a2c1e');
  fs(ctx, shoe, '#0e0a06', 1.5);
  ctx.restore();
}

function drawArm(ctx, sx, sy, au, al, L, far, sc, o = {}) {
  const L1 = 21 * sc, L2 = 19 * sc;
  const ex = sx - Math.sin(au) * L1, ey = sy + Math.cos(au) * L1;
  const b = au + al;
  const hx = ex - Math.sin(b) * L2, hy = ey + Math.cos(b) * L2;
  const sleeve = far ? L.coatDark : L.coat;
  const stroke = '#1e1812';
  if (o.stump) {
    const mx = sx - Math.sin(au) * L1 * 0.5, my = sy + Math.cos(au) * L1 * 0.5;
    tube(ctx, [sx, sy, mx, my], 10 * sc, sleeve, stroke, 1.6);
    C(ctx, mx, my, 4 * sc);
    fs(ctx, '#7a2a2a', stroke, 1.2);
    return { hx: mx, hy: my };
  }
  if (L.sleeveless || L.bare) {
    tube(ctx, [sx, sy, ex, ey], 8.5 * sc, far ? SKIN.dark : SKIN.mid, SKIN.stroke, 1.5);
    tube(ctx, [ex, ey, hx, hy], 7.5 * sc, far ? SKIN.dark : SKIN.mid, SKIN.stroke, 1.5);
    if (L.sleeveless && !L.bare) { C(ctx, sx, sy + 2, 6 * sc); fs(ctx, sleeve, stroke, 1.3); }
  } else {
    tube(ctx, [sx, sy, ex, ey], 10 * sc, sleeve, stroke, 1.6);
    tube(ctx, [ex, ey, hx + Math.sin(b) * 5, hy - Math.cos(b) * 5], 9 * sc, sleeve, stroke, 1.6);
    if (L.pads && !far) { E(ctx, sx + 2, sy - 1, 13 * sc, 10 * sc); fs(ctx, rg(ctx, sx - 3, sy - 5, 1, sx, sy, 13, [0, '#ff5a5a', 1, L.coatDark]), stroke, 1.6); }
  }
  // 手
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(b);
  const skin = far ? SKIN.dark : SKIN.mid;
  ctx.strokeStyle = SKIN.stroke;
  ctx.lineWidth = 1.3;
  for (let i = -1; i <= 1; i++) tube(ctx, [i * 2.5 * sc, 2 * sc, i * 3.4 * sc, 8 * sc], 2.6 * sc, skin, SKIN.stroke, 1.1);
  E(ctx, 0, 1.5 * sc, 5 * sc, 4.5 * sc);
  fs(ctx, skin, SKIN.stroke, 1.3);
  ctx.restore();
  return { hx, hy, ex, ey };
}

function shadeHex(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = v => Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt));
  return '#' + ((1 << 24) | (f(r) << 16) | (f(g) << 8) | f(b)).toString(16).slice(1);
}

function drawTorso(ctx, L, sc, z) {
  const stroke = '#1e1812';
  ctx.beginPath();
  ctx.moveTo(-13 * sc, 3);
  ctx.lineTo(-17 * sc, -28 * sc);
  ctx.quadraticCurveTo(-19 * sc, -46 * sc, -11 * sc, -51 * sc);
  ctx.lineTo(7 * sc, -52 * sc);
  ctx.quadraticCurveTo(17 * sc, -49 * sc, 15 * sc, -28 * sc);
  ctx.lineTo(13 * sc, 3);
  ctx.quadraticCurveTo(0, 7, -13 * sc, 3);
  ctx.closePath();
  const coat = L.bare ? SKIN.mid : L.coat;
  fs(ctx, lg(ctx, -18 * sc, 0, 16 * sc, 0, [0, shadeHex(coat, 0.12), 0.5, coat, 1, L.bare ? SKIN.dark : L.coatDark]), stroke, 1.8);
  if (L.bare) {
    // 肋骨 / 肚脐
    ctx.strokeStyle = SKIN.stroke;
    ctx.lineWidth = 1;
    ctx.globalAlpha *= 0.5;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(-4 * sc, (-40 + i * 7) * sc, 7 * sc, 0.3, 1.9); ctx.stroke(); }
    ctx.globalAlpha /= 0.5;
    // 泳裤
    ctx.beginPath();
    ctx.moveTo(-14 * sc, -4 * sc); ctx.lineTo(14 * sc, -4 * sc); ctx.lineTo(13 * sc, 4); ctx.quadraticCurveTo(0, 8, -13 * sc, 4); ctx.closePath();
    fs(ctx, L.pants, stroke, 1.5);
    return;
  }
  if (L.shirt && L.shirt !== L.coat) {
    ctx.beginPath();
    ctx.moveTo(-14 * sc, -50 * sc);
    ctx.lineTo(-3 * sc, -51 * sc);
    ctx.lineTo(-9 * sc, -20 * sc);
    ctx.closePath();
    fs(ctx, L.shirt, stroke, 1.3);
  }
  if (L.tie) {
    ctx.beginPath();
    ctx.moveTo(-10 * sc, -49 * sc);
    ctx.lineTo(-6 * sc, -49 * sc);
    ctx.lineTo(-7 * sc, -45 * sc);
    ctx.lineTo(-5.5 * sc, -26 * sc);
    ctx.lineTo(-9 * sc, -22 * sc);
    ctx.lineTo(-11 * sc, -26 * sc);
    ctx.lineTo(-9 * sc, -45 * sc);
    ctx.closePath();
    fs(ctx, L.tie, '#3a0a0a', 1.2);
  }
  if (L.stripe) {
    ctx.beginPath();
    ctx.moveTo(-16 * sc, -36 * sc); ctx.lineTo(15 * sc, -38 * sc); ctx.lineTo(15 * sc, -32 * sc); ctx.lineTo(-16.5 * sc, -30 * sc); ctx.closePath();
    ctx.fillStyle = L.stripe;
    ctx.fill();
  }
  if (L.number) {
    text(ctx, L.number, 0, -26 * sc, { size: 18 * sc, color: '#fff', stroke: '#6a0a10', lw: 3 });
  }
  if (L.chain) {
    ctx.beginPath();
    ctx.arc(-6 * sc, -46 * sc, 9 * sc, 0.3, 2.6);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#ffd23a';
    ctx.stroke();
  }
  // 翻领
  if (!L.sleeveless && !L.pads) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-15 * sc, -48 * sc); ctx.lineTo(-11 * sc, -34 * sc); ctx.lineTo(-10 * sc, -18 * sc);
    ctx.stroke();
    // 破洞 / 补丁
    ctx.save();
    ctx.globalAlpha *= 0.35;
    E(ctx, 6 * sc, -18 * sc, 4 * sc, 3 * sc, 0.4);
    ctx.fillStyle = '#1e1812';
    ctx.fill();
    ctx.restore();
  }
}

function drawHead(ctx, z, L, p, sc) {
  const stroke = SKIN.stroke;
  const s = sc;
  // 耳朵
  E(ctx, 13 * s, 2 * s, 4.5 * s, 6 * s);
  fs(ctx, SKIN.dark, stroke, 1.4);
  // 头型
  ctx.beginPath();
  ctx.moveTo(-20 * s, 4 * s);
  ctx.bezierCurveTo(-26 * s, -18 * s, -8 * s, -27 * s, 4 * s, -24 * s);
  ctx.bezierCurveTo(18 * s, -21 * s, 22 * s, -4 * s, 18 * s, 10 * s);
  ctx.bezierCurveTo(15 * s, 20 * s, 2 * s, 23 * s, -8 * s, 21 * s);
  ctx.bezierCurveTo(-16 * s, 19 * s, -19 * s, 13 * s, -20 * s, 4 * s);
  ctx.closePath();
  const angry = z.angry;
  const skinL = angry ? '#e0a090' : SKIN.light, skinM = angry ? '#c47868' : SKIN.mid, skinD = angry ? '#8a4a40' : SKIN.dark;
  fs(ctx, rg(ctx, -8 * s, -10 * s, 2, 0, 0, 26 * s, [0, skinL, 0.6, skinM, 1, skinD]), stroke, 1.8);
  // 斑点
  ctx.save();
  ctx.globalAlpha *= 0.25;
  for (const [x, y, r] of [[6, -14, 3], [12, 4, 2.5], [-2, 12, 2]]) { C(ctx, x * s, y * s, r * s); ctx.fillStyle = '#3a4a2a'; ctx.fill(); }
  ctx.restore();
  // 头发
  if (L.afro) {
    ctx.save();
    const pts = [];
    for (let i = 0; i < 12; i++) {
      const a = Math.PI + (i / 11) * Math.PI * 1.15 - 0.1;
      const r = (26 + (i % 2) * 4) * s;
      pts.push(2 * s + Math.cos(a) * r * 1.05, -10 * s + Math.sin(a) * r * 0.95);
    }
    pts.push(20 * s, 8 * s, -12 * s, -2 * s);
    blob(ctx, pts);
    fs(ctx, rg(ctx, -6 * s, -30 * s, 2, 0, -14 * s, 34 * s, [0, shadeHex(L.afro, 0.25), 1, L.afro]), '#0a0604', 1.8);
    ctx.restore();
  } else if (!z.noHair) {
    ctx.strokeStyle = L.hair || '#3a3024';
    ctx.lineWidth = 1.8 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(2 * s, -24 * s); ctx.quadraticCurveTo(0, -34 * s, -8 * s, -33 * s);
    ctx.moveTo(6 * s, -23 * s); ctx.quadraticCurveTo(8 * s, -33 * s, 2 * s, -36 * s);
    ctx.moveTo(10 * s, -21 * s); ctx.quadraticCurveTo(16 * s, -28 * s, 14 * s, -32 * s);
    ctx.stroke();
  }
  if (L.clown) {
    for (const [x, y, r] of [[16, -8, 10], [20, 6, 9], [-2, -20, 8], [10, -20, 9]]) { C(ctx, x * s, y * s, r * s); fs(ctx, '#e83a2a', '#6a1010', 1.4); }
    C(ctx, -21 * s, 4 * s, 5 * s); fs(ctx, '#ff3a3a', '#6a1010', 1.4);
  }
  if (L.hardhat) {
    ctx.beginPath();
    ctx.moveTo(-24 * s, -8 * s);
    ctx.bezierCurveTo(-26 * s, -34 * s, 22 * s, -36 * s, 22 * s, -8 * s);
    ctx.lineTo(26 * s, -6 * s); ctx.lineTo(-28 * s, -6 * s); ctx.closePath();
    fs(ctx, lg(ctx, 0, -32 * s, 0, -6 * s, [0, '#ffe25a', 1, '#d09a10']), '#5a3a00', 1.8);
    rr(ctx, -18 * s, -26 * s, 10 * s, 9 * s, 2);
    fs(ctx, '#e8e8d8', '#3a3a30', 1.2);
    C(ctx, -13 * s, -21.5 * s, 3 * s);
    fs(ctx, '#fff8b0', '#8a7a20', 1);
  }
  if (L.band) {
    ctx.beginPath();
    ctx.moveTo(-21 * s, -8 * s); ctx.quadraticCurveTo(0, -16 * s, 19 * s, -10 * s);
    ctx.lineTo(19 * s, -4 * s); ctx.quadraticCurveTo(0, -10 * s, -21 * s, -2 * s);
    ctx.closePath();
    fs(ctx, L.band, '#3a0a0a', 1.2);
  }
  // 眼睛
  const lookX = z.hypno ? 1.5 : -1.5;
  const eyeY = -5 * s;
  if (z.hypno) {
    for (const [x, r] of [[-12, 7.2], [-1, 6]]) {
      C(ctx, x * s, eyeY, r * s);
      fs(ctx, '#ffe8ff', stroke, 1.3);
      ctx.beginPath();
      for (let i = 0; i < 16; i++) { const a = i * 0.7 + z.t * 8, rr2 = i * 0.35 * s; const px = x * s + Math.cos(a) * rr2, py = eyeY + Math.sin(a) * rr2; if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); }
      ctx.strokeStyle = '#c01a90';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
  } else {
    eye(ctx, -12 * s, eyeY, 7.4 * s, 7.6 * s, lookX * s, 0.5 * s, { pupil: 0.28, white: angry ? '#ffe0d0' : '#fbf7e6', stroke, highlight: false });
    eye(ctx, -1 * s, eyeY - 1 * s, 6 * s, 6.4 * s, lookX * s, 0.5 * s, { pupil: 0.3, white: angry ? '#ffe0d0' : '#fbf7e6', stroke, highlight: false });
    // 下垂眼皮
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(-12 * s, eyeY - 4.5 * s, 8 * s, 4 * s, 0.1, Math.PI, TAU);
    ctx.ellipse(-1 * s, eyeY - 5.5 * s, 6.6 * s, 3.4 * s, 0.1, Math.PI, TAU);
    ctx.fillStyle = skinM;
    ctx.fill();
    ctx.restore();
    if (angry) {
      ctx.lineWidth = 2.4 * s;
      ctx.strokeStyle = '#3a1010';
      ctx.beginPath();
      ctx.moveTo(-20 * s, -14 * s); ctx.lineTo(-7 * s, -9 * s);
      ctx.moveTo(6 * s, -14 * s); ctx.lineTo(-2 * s, -10 * s);
      ctx.stroke();
    }
  }
  if (L.glasses) {
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 1.6;
    C(ctx, -12 * s, eyeY, 8.5 * s); ctx.stroke();
    C(ctx, -1 * s, eyeY - 1 * s, 7 * s); ctx.stroke();
    line(ctx, -3.5 * s, eyeY - 1, -6 * s, eyeY - 1, '#2a2a2a', 1.4);
    line(ctx, 6 * s, eyeY - 2, 14 * s, eyeY - 3, '#2a2a2a', 1.4);
  }
  if (L.goggles || L.mask) {
    rr(ctx, -23 * s, -13 * s, 29 * s, 15 * s, 6 * s);
    fs(ctx, 'rgba(160,220,255,0.45)', '#1a1a1a', 2.2);
    ctx.beginPath();
    ctx.moveTo(6 * s, -8 * s); ctx.lineTo(19 * s, -9 * s);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#1a1a1a';
    ctx.stroke();
  }
  // 嘴
  const j = p.jaw;
  ctx.beginPath();
  ctx.moveTo(-20 * s, 8 * s);
  ctx.quadraticCurveTo(-12 * s, 7 * s, -4 * s, 9 * s);
  ctx.lineTo(-6 * s, (11 + j * 9) * s);
  ctx.quadraticCurveTo(-13 * s, (13 + j * 9) * s, -19 * s, (11 + j * 6) * s);
  ctx.closePath();
  fs(ctx, '#3a1a14', stroke, 1.4);
  ctx.fillStyle = '#f2ecd0';
  ctx.fillRect(-16 * s, 8 * s, 3 * s, 3.2 * s);
  ctx.fillRect(-10 * s, 8.4 * s, 3 * s, 3 * s);
  if (L.mask) {
    // 呼吸管
    tube(ctx, [-18 * s, 10 * s, -24 * s, 8 * s, -24 * s, -30 * s], 4 * s, '#f0d020', '#3a3000', 1.3);
    C(ctx, -24 * s, -31 * s, 3 * s);
    fs(ctx, '#e02020', '#3a0000', 1.2);
  }
}

// ---------- 头部护具 ----------
function drawArmorHat(ctx, kind, stage, s, t) {
  if (kind === 'cone') {
    ctx.save();
    ctx.translate(2 * s, -18 * s);
    ctx.rotate(-0.12);
    const h = stage >= 2 ? 36 : 44;
    ctx.beginPath();
    ctx.moveTo(-21 * s, 2 * s);
    ctx.lineTo(-3 * s, -h * s);
    if (stage >= 2) { ctx.lineTo(1 * s, -h * s + 2); ctx.lineTo(4 * s, -(h - 6) * s); }
    else ctx.lineTo(3 * s, -h * s);
    ctx.lineTo(21 * s, 2 * s);
    ctx.closePath();
    fs(ctx, lg(ctx, -20 * s, 0, 20 * s, 0, [0, '#ffb36a', 0.4, '#ff8a2a', 1, '#c4500a']), '#5a2000', 2);
    // 白色反光条
    ctx.save();
    ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(-30 * s, -20 * s, 60 * s, 6 * s);
    ctx.fillRect(-30 * s, -34 * s, 60 * s, 4 * s);
    if (stage >= 1) {
      ctx.strokeStyle = '#6a2a00';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-10 * s, -6 * s); ctx.lineTo(-4 * s, -12 * s); ctx.lineTo(-8 * s, -18 * s);
      ctx.moveTo(8 * s, -24 * s); ctx.lineTo(4 * s, -28 * s);
      ctx.stroke();
    }
    if (stage >= 2) {
      ctx.fillStyle = 'rgba(90,30,0,0.5)';
      E(ctx, 10 * s, -8 * s, 5 * s, 3 * s);
      ctx.fill();
    }
    ctx.restore();
    // 底座
    E(ctx, 0, 2 * s, 24 * s, 5 * s);
    fs(ctx, '#e0701a', '#5a2000', 1.8);
    ctx.restore();
  } else if (kind === 'bucket') {
    ctx.save();
    ctx.translate(0, -8 * s);
    ctx.rotate(-0.08 + (stage >= 2 ? 0.1 : 0));
    ctx.beginPath();
    ctx.moveTo(-24 * s, 8 * s);
    ctx.lineTo(-20 * s, -24 * s);
    ctx.lineTo(18 * s, -24 * s);
    ctx.lineTo(22 * s, 8 * s);
    ctx.closePath();
    fs(ctx, lg(ctx, -24 * s, 0, 22 * s, 0, [0, '#7a8288', 0.25, '#e8eef2', 0.45, '#b8c2c8', 1, '#5a6268']), '#1e2428', 2);
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = 'rgba(30,36,40,0.5)';
    ctx.lineWidth = 2;
    for (const y of [-18, 2]) { ctx.beginPath(); ctx.moveTo(-26 * s, y * s); ctx.lineTo(26 * s, y * s); ctx.stroke(); }
    if (stage >= 1) {
      ctx.fillStyle = 'rgba(40,40,40,0.4)';
      E(ctx, -8 * s, -8 * s, 6 * s, 4 * s, 0.3); ctx.fill();
      E(ctx, 10 * s, -2 * s, 4 * s, 3 * s); ctx.fill();
    }
    if (stage >= 2) {
      ctx.fillStyle = 'rgba(120,70,30,0.45)';
      E(ctx, 4 * s, -14 * s, 7 * s, 5 * s); ctx.fill();
      E(ctx, -14 * s, 2 * s, 5 * s, 3 * s); ctx.fill();
      ctx.fillStyle = '#1e2428';
      C(ctx, 8 * s, -12 * s, 2.2 * s); ctx.fill();
    }
    ctx.restore();
    E(ctx, -1 * s, -24 * s, 19 * s, 3.5 * s);
    fs(ctx, '#9aa4aa', '#1e2428', 1.6);
    // 把手
    ctx.beginPath();
    ctx.arc(21 * s, -6 * s, 6 * s, -1.4, 1.4);
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = '#3a4248';
    ctx.stroke();
    ctx.restore();
  } else if (kind === 'helmet') {
    ctx.save();
    ctx.translate(2 * s, -6 * s);
    ctx.beginPath();
    ctx.moveTo(-22 * s, 6 * s);
    ctx.bezierCurveTo(-28 * s, -30 * s, 26 * s, -34 * s, 24 * s, 10 * s);
    ctx.lineTo(16 * s, 14 * s);
    ctx.lineTo(10 * s, 4 * s);
    ctx.lineTo(-14 * s, 2 * s);
    ctx.closePath();
    fs(ctx, rg(ctx, -6 * s, -18 * s, 2, 0, -6 * s, 30 * s, [0, '#ff6a6a', 0.5, '#d01a24', 1, '#7a0610']), '#2a0206', 2);
    ctx.save();
    ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.moveTo(-4 * s, -30 * s); ctx.quadraticCurveTo(0, -10, -2 * s, 6 * s); ctx.lineTo(3 * s, 6 * s); ctx.quadraticCurveTo(5 * s, -10, 2 * s, -30 * s);
    ctx.fill();
    if (stage >= 1) {
      ctx.strokeStyle = '#2a0206';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-14 * s, -16 * s); ctx.lineTo(-8 * s, -10 * s); ctx.lineTo(-12 * s, -4 * s);
      ctx.moveTo(12 * s, -18 * s); ctx.lineTo(8 * s, -12 * s);
      ctx.stroke();
    }
    if (stage >= 2) {
      ctx.fillStyle = 'rgba(30,0,0,0.45)';
      E(ctx, 14 * s, -8 * s, 6 * s, 5 * s); ctx.fill();
    }
    ctx.restore();
    // 面罩
    ctx.strokeStyle = '#c8ccd0';
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-18 * s, 0); ctx.quadraticCurveTo(-28 * s, 10 * s, -24 * s, 24 * s);
    ctx.moveTo(-18 * s, 12 * s); ctx.lineTo(-10 * s, 12 * s);
    ctx.moveTo(-24 * s, 20 * s); ctx.lineTo(-10 * s, 22 * s);
    ctx.stroke();
    ctx.restore();
  }
}

// ---------- 手持物 ----------
function drawFlag(ctx, hx, hy, t, s) {
  tube(ctx, [hx, hy + 8 * s, hx + 2, hy - 86 * s], 3.2 * s, '#8a6a3a', '#2a1a08', 1.2);
  const fx = hx + 2, fy = hy - 84 * s;
  ctx.beginPath();
  ctx.moveTo(fx, fy);
  const w = 46 * s, h = 30 * s;
  for (let i = 0; i <= 8; i++) { const x = fx + (w * i) / 8; ctx.lineTo(x, fy + Math.sin(t * 6 + i * 0.6) * 3 * (i / 8)); }
  for (let i = 8; i >= 0; i--) { const x = fx + (w * i) / 8; ctx.lineTo(x, fy + h + Math.sin(t * 6 + i * 0.6) * 3 * (i / 8)); }
  ctx.closePath();
  fs(ctx, lg(ctx, fx, fy, fx + w, fy + h, [0, '#b01418', 1, '#7a0a0e']), '#3a0406', 1.6);
  // 脑子图案
  const bx = fx + w * 0.52, by = fy + h * 0.5 + Math.sin(t * 6 + 4) * 1.5;
  E(ctx, bx, by, 11 * s, 8 * s);
  fs(ctx, '#ffb0c0', '#8a3a4a', 1.2);
  ctx.strokeStyle = '#c05a6a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(bx, by - 7 * s); ctx.lineTo(bx, by + 7 * s);
  ctx.moveTo(bx - 7 * s, by - 3 * s); ctx.quadraticCurveTo(bx - 3 * s, by, bx - 7 * s, by + 3 * s);
  ctx.moveTo(bx + 7 * s, by - 3 * s); ctx.quadraticCurveTo(bx + 3 * s, by, bx + 7 * s, by + 3 * s);
  ctx.stroke();
}

function drawPaper(ctx, x, y, stage, s, shake) {
  ctx.save();
  ctx.translate(x + shake, y);
  ctx.rotate(-0.08);
  const w = 40 * s, h = 50 * s;
  ctx.beginPath();
  ctx.moveTo(-w / 2, -h / 2);
  ctx.lineTo(w / 2, -h / 2);
  if (stage >= 1) { ctx.lineTo(w / 2, 0); ctx.lineTo(w / 2 - 8, 6); ctx.lineTo(w / 2 - 2, 12); }
  ctx.lineTo(w / 2, h / 2);
  if (stage >= 2) { ctx.lineTo(4, h / 2 - 8); ctx.lineTo(-4, h / 2); }
  ctx.lineTo(-w / 2, h / 2);
  ctx.closePath();
  fs(ctx, lg(ctx, -w / 2, 0, w / 2, 0, [0, '#dcd8cc', 0.5, '#f4f2ea', 1, '#cfcabc']), '#3a3830', 1.5);
  ctx.fillStyle = '#2a2a2a';
  ctx.font = `900 ${9 * s}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('僵尸日报', 0, -h / 2 + 10 * s);
  ctx.fillStyle = 'rgba(40,40,40,0.55)';
  for (let i = 0; i < 6; i++) ctx.fillRect(-w / 2 + 5, -h / 2 + 16 * s + i * 5 * s, (i === 2 ? w * 0.5 : w - 10), 2);
  ctx.fillStyle = 'rgba(60,60,60,0.35)';
  ctx.fillRect(w * 0.05, -h / 2 + 28 * s, w * 0.35, 14 * s);
  ctx.restore();
}

function drawDoor(ctx, x, y, stage, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.04 + (stage >= 2 ? -0.06 : 0));
  const w = 42 * s, h = 104 * s;
  rr(ctx, -w / 2, -h / 2, w, h, 3);
  ctx.fillStyle = 'rgba(160,170,175,0.35)';
  ctx.fill();
  // 纱网
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = 'rgba(40,46,50,0.45)';
  ctx.lineWidth = 0.8;
  for (let i = -w / 2; i < w / 2; i += 4) { ctx.beginPath(); ctx.moveTo(i, -h / 2); ctx.lineTo(i, h / 2); ctx.stroke(); }
  for (let i = -h / 2; i < h / 2; i += 4) { ctx.beginPath(); ctx.moveTo(-w / 2, i); ctx.lineTo(w / 2, i); ctx.stroke(); }
  if (stage >= 1) { ctx.fillStyle = 'rgba(20,20,20,0.5)'; E(ctx, -6, -20, 7, 9); ctx.fill(); }
  if (stage >= 2) { ctx.fillStyle = 'rgba(20,20,20,0.5)'; E(ctx, 8, 20, 9, 12); ctx.fill(); E(ctx, -10, 30, 5, 6); ctx.fill(); }
  ctx.restore();
  rr(ctx, -w / 2, -h / 2, w, h, 3);
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#2a3034';
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#7a868c';
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-w / 2, 0); ctx.lineTo(w / 2, 0);
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#5a666c';
  ctx.stroke();
  C(ctx, -w / 2 + 6, 6, 3);
  fs(ctx, '#d8c070', '#3a3010', 1);
  ctx.restore();
}

function drawPole(ctx, x0, y0, x1, y1) {
  tube(ctx, [x0, y0, x1, y1], 4, '#d8b070', '#4a3010', 1.3);
}

function drawDuckTube(ctx, s, t, front) {
  ctx.save();
  ctx.translate(0, -34 * s);
  if (!front) {
    E(ctx, 0, 0, 30 * s, 10 * s);
    fs(ctx, '#e8b818', '#6a4a00', 2);
  } else {
    ctx.beginPath();
    ctx.ellipse(0, 0, 30 * s, 10 * s, 0, 0, Math.PI);
    ctx.ellipse(0, 0, 18 * s, 4 * s, 0, Math.PI, 0, true);
    ctx.closePath();
    fs(ctx, lg(ctx, 0, -10, 0, 12, [0, '#fff06a', 1, '#e0a810']), '#6a4a00', 2);
    // 鸭头
    ctx.save();
    ctx.translate(-30 * s, -6 * s);
    C(ctx, 0, -10 * s, 9 * s);
    fs(ctx, '#ffe040', '#6a4a00', 1.8);
    ctx.beginPath();
    ctx.moveTo(-6 * s, -9 * s); ctx.lineTo(-17 * s, -7 * s); ctx.lineTo(-6 * s, -4 * s); ctx.closePath();
    fs(ctx, '#ff8a1a', '#6a3000', 1.4);
    C(ctx, -2 * s, -13 * s, 1.8 * s);
    ctx.fillStyle = '#111';
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function drawBalloon(ctx, hx, hy, t, pop) {
  if (pop >= 1) return;
  const bx = hx + 8 + Math.sin(t * 1.4) * 4, by = hy - 70 + Math.cos(t * 1.1) * 3;
  ctx.save();
  ctx.strokeStyle = 'rgba(40,40,40,0.8)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(hx, hy);
  ctx.quadraticCurveTo(hx + 10, hy - 30, bx, by + 30);
  ctx.stroke();
  const sc = 1 + pop * 0.5;
  ctx.translate(bx, by);
  ctx.scale(sc, sc);
  ctx.globalAlpha *= 1 - pop;
  E(ctx, 0, 0, 22, 27);
  fs(ctx, rg(ctx, -7, -9, 2, 0, 0, 28, [0, '#ff8a8a', 0.5, '#e82a2a', 1, '#8a0a10']), '#4a0006', 1.8);
  ctx.beginPath(); ctx.moveTo(-4, 27); ctx.lineTo(4, 27); ctx.lineTo(0, 33); ctx.closePath();
  fs(ctx, '#c01a1a', '#4a0006', 1.2);
  ctx.globalAlpha *= 0.6;
  E(ctx, -8, -10, 5, 9, 0.4);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.restore();
}

function drawPickaxe(ctx, hx, hy, ang, s) {
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(ang + Math.PI);
  tube(ctx, [0, 8 * s, 0, -44 * s], 4 * s, '#a8763a', '#3a2008', 1.2);
  ctx.beginPath();
  ctx.moveTo(-22 * s, -40 * s);
  ctx.quadraticCurveTo(0, -52 * s, 22 * s, -40 * s);
  ctx.quadraticCurveTo(0, -46 * s, -22 * s, -40 * s);
  fs(ctx, lg(ctx, 0, -50 * s, 0, -40 * s, [0, '#e0e4e8', 1, '#7a8288']), '#2a3036', 1.6);
  ctx.restore();
}

function drawPogo(ctx, x, groundY, squash, s) {
  // 躯干局部坐标：髋部为原点，groundY 为地面
  const top = -38 * s, peg = 46 * s;
  const len = Math.max(8, (groundY - peg - 6) * (1 - squash * 0.45));
  ctx.save();
  tube(ctx, [x, top, x, peg], 4.5 * s, '#d8dce0', '#2a2e32', 1.3);
  tube(ctx, [x - 13 * s, top, x + 11 * s, top], 5 * s, '#2a2a2a', '#000', 1);
  tube(ctx, [x - 14 * s, peg, x + 14 * s, peg], 4.5 * s, '#e03a2a', '#3a0000', 1.1);
  ctx.strokeStyle = '#9aa0a6';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, peg + 2);
  for (let i = 1; i <= 9; i++) ctx.lineTo(x + (i % 2 ? 7 : -7) * s, peg + 2 + (len * i) / 9);
  ctx.stroke();
  C(ctx, x, peg + 4 + len, 5 * s);
  fs(ctx, '#2a2a2a', '#000', 1);
  ctx.restore();
}

function drawJackBox(ctx, x, y, t, pop, s) {
  ctx.save();
  ctx.translate(x, y);
  // 弹出的小丑
  if (pop > 0) {
    const h = Math.min(1, pop * 1.6) * 44;
    ctx.strokeStyle = '#8a9096';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i <= 8; i++) ctx.lineTo((i % 2 ? 6 : -6) * s, -12 * s - (h * i) / 8);
    ctx.stroke();
    C(ctx, 0, -18 * s - h, 11 * s);
    fs(ctx, '#fff4e0', '#3a2a20', 1.5);
    C(ctx, 0, -16 * s - h, 3 * s);
    fs(ctx, '#ff2a2a');
    ctx.beginPath(); ctx.moveTo(-10 * s, -26 * s - h); ctx.lineTo(0, -44 * s - h); ctx.lineTo(10 * s, -26 * s - h); ctx.closePath();
    fs(ctx, '#7a3ad8', '#2a0a4a', 1.2);
  }
  rr(ctx, -15 * s, -14 * s, 30 * s, 28 * s, 3);
  fs(ctx, lg(ctx, -15 * s, 0, 15 * s, 0, [0, '#9a4ae0', 1, '#5a1a9a']), '#2a0a4a', 1.8);
  ctx.fillStyle = '#ffd23a';
  star(ctx, 0, 0, 7 * s, 3 * s, 5, -Math.PI / 2);
  ctx.fill();
  // 摇柄
  ctx.save();
  ctx.translate(15 * s, 0);
  ctx.rotate(t * 5);
  tube(ctx, [0, 0, 0, -9 * s, 5 * s, -9 * s], 2.2 * s, '#c8c8c0', '#333', 1);
  ctx.restore();
  ctx.restore();
}

// 地下挖掘：只露出土堆和镐尖
export function drawDiggerMound(ctx, t) {
  const bob = Math.sin(t * 10) * 2;
  E(ctx, 0, -6, 34, 12 + bob * 0.5);
  fs(ctx, rg(ctx, -8, -12, 2, 0, -6, 34, [0, '#8a6038', 1, '#4a3018']), '#2a1a08', 2);
  for (let i = 0; i < 5; i++) {
    C(ctx, -24 + i * 12, -8 - Math.abs(Math.sin(t * 8 + i)) * 6, 4);
    fs(ctx, '#6a4828', '#2a1a08', 1);
  }
  ctx.save();
  ctx.translate(-26, -16 + bob);
  ctx.rotate(-0.8 + Math.sin(t * 10) * 0.3);
  ctx.beginPath();
  ctx.moveTo(-12, 0); ctx.quadraticCurveTo(0, -8, 12, 0); ctx.quadraticCurveTo(0, -4, -12, 0);
  fs(ctx, '#c8ccd0', '#2a3036', 1.4);
  ctx.restore();
}

// ---------- 人形僵尸主绘制 ----------
export function drawHumanoid(ctx, z) {
  const L = LOOKS[z.lookType || z.type] || LOOKS.normal;
  const s = L.small ? 0.78 : 1;
  const p = pose(z);
  const t = z.t || 0;
  const held = z.held;

  // 腿部（计算让最低的脚踩地）
  const hipY0 = 0;
  const lf = legPoints(-4 * s, hipY0, p.legF, p.kneeF, 25 * s, 24 * s);
  const lb = legPoints(5 * s, hipY0, p.legB, p.kneeB, 25 * s, 24 * s);
  let hipY = -Math.max(lf.fy, lb.fy);
  if (z.anim === 'jump' || z.airborne) hipY = -48 * s;
  if (held === 'pogo') hipY -= 34 * s;
  const lf2 = legPoints(-4 * s, hipY, p.legF, p.kneeF, 25 * s, 24 * s);
  const lb2 = legPoints(5 * s, hipY, p.legB, p.kneeB, 25 * s, 24 * s);

  const hasArm = z.hasArm !== false;
  const hasHead = z.hasHead !== false;

  // 背后的鸭子圈
  if ((L.tube || z.ducky) && z.inWater) drawDuckTube(ctx, s, t, false);

  // 远侧手臂
  ctx.save();
  ctx.translate(0, hipY);
  ctx.rotate(p.lean);
  const shB = { x: 8 * s, y: -47 * s };
  let farHand = drawArm(ctx, shB.x, shB.y, p.armUB, p.armLB, L, true, s);
  ctx.restore();

  // 腿
  drawLeg(ctx, { x: 5 * s, y: hipY }, lb2, L, true, s);
  drawLeg(ctx, { x: -4 * s, y: hipY }, lf2, L, false, s);

  // 躯干
  ctx.save();
  ctx.translate(0, hipY);
  ctx.rotate(p.lean);
  drawTorso(ctx, L, s, z);
  if (held === 'pogo') drawPogo(ctx, -6 * s, -hipY, z.pogoSquash || 0, s);

  // 撑杆（身后）
  if (held === 'pole') {
    const fh = { x: farHand.hx, y: farHand.hy };
    drawPole(ctx, fh.x - 70 * s, fh.y + 2, fh.x + 40 * s, fh.y - 6);
  }

  // 头
  const neck = { x: -4 * s, y: -52 * s };
  ctx.save();
  ctx.translate(neck.x + p.headX, neck.y + p.headY);
  ctx.rotate(p.headRot);
  if (hasHead) {
    tube(ctx, [0, 2, -1 * s, -8 * s], 8 * s, SKIN.mid, SKIN.stroke, 1.4);
    ctx.translate(-5 * s, -26 * s);
    drawHead(ctx, z, L, p, s);
    if (z.armorKind) drawArmorHat(ctx, z.armorKind, z.armorStage || 0, s, t);
  } else {
    E(ctx, 0, -2, 6 * s, 3.5 * s);
    fs(ctx, '#7a2a2a', SKIN.stroke, 1.2);
  }
  ctx.restore();

  // 报纸（在前臂之下）
  const shF = { x: -11 * s, y: -46 * s };
  if (held === 'paper') drawPaper(ctx, -26 * s, -40 * s, z.shieldStage || 0, s, 0);

  // 近侧手臂
  if (held === 'jackbox') drawJackBox(ctx, -26 * s, -34 * s, t, z.jackPop || 0, s);
  const hand = drawArm(ctx, shF.x, shF.y, p.armUF, p.armLF, L, false, s, { stump: !hasArm });
  if (held === 'flag' && hasArm) drawFlag(ctx, hand.hx, hand.hy, t, s);
  if (held === 'door') drawDoor(ctx, -30 * s, -30 * s, z.shieldStage || 0, s);
  if (held === 'pickaxe' && hasArm) drawPickaxe(ctx, hand.hx, hand.hy, p.armUF + p.armLF, s);
  if (held === 'balloon') drawBalloon(ctx, hand.hx, hand.hy, t, z.popT || 0);
  ctx.restore();

  if ((L.tube || z.ducky) && z.inWater) drawDuckTube(ctx, s, t, true);
}

// ================= 巨人僵尸 =================
function easeIO(k) { return -(Math.cos(Math.PI * k) - 1) / 2; }
export function drawGargantuar(ctx, z) {
  const t = z.t || 0;
  const ph = z.walkPh || 0;
  const walking = z.anim === 'walk';
  const sm = z.smashT || 0; // 0..1 砸击动画
  const bob = walking ? -Math.abs(Math.cos(ph)) * 4 : 0;
  const stroke = '#1e1812';
  let armA, poleR, lean;
  if (sm > 0) {
    if (sm < 0.55) { const k = easeIO(sm / 0.55); armA = lerp(0.55, -2.7, k); poleR = lerp(-0.22, 1.2, k); lean = lerp(-0.08, 0.14, k); }
    else if (sm < 0.7) { const k = (sm - 0.55) / 0.15; armA = lerp(-2.7, 1.3, k * k); poleR = lerp(1.2, -1.72, k * k); lean = lerp(0.14, -0.28, k); }
    else { const k = easeIO((sm - 0.7) / 0.3); armA = lerp(1.3, 0.55, k); poleR = lerp(-1.72, -0.22, k); lean = lerp(-0.28, -0.08, k); }
  } else {
    armA = 0.55 + Math.sin(ph) * 0.1;
    poleR = -0.22 + Math.sin(ph) * 0.05;
    lean = -0.08 + Math.sin(ph * 2) * 0.02;
  }
  const legA = walking ? Math.sin(ph) * 0.26 : 0;
  const hipY = -74 + bob;
  // 腿
  for (const [dx, a, far] of [[16, -legA, true], [-12, legA, false]]) {
    const hx = dx, hy = hipY;
    const kx = hx - Math.sin(a) * 36, ky = hy + Math.cos(a) * 36;
    const fx = kx - Math.sin(a * 0.3) * 34, fy = -6;
    tube(ctx, [kx, ky, fx, fy], 22, far ? SKIN.dark : SKIN.mid, SKIN.stroke, 2);
    tube(ctx, [hx, hy, kx, ky], 30, far ? '#4a3a2a' : '#6a5238', stroke, 2);
    // 破裤腿
    ctx.beginPath();
    ctx.moveTo(kx - 16, ky - 4); ctx.lineTo(kx - 10, ky + 6); ctx.lineTo(kx - 3, ky); ctx.lineTo(kx + 4, ky + 7); ctx.lineTo(kx + 15, ky - 3);
    ctx.lineTo(kx + 14, ky - 12); ctx.lineTo(kx - 15, ky - 12); ctx.closePath();
    fs(ctx, far ? '#4a3a2a' : '#6a5238', stroke, 1.6);
    E(ctx, fx - 9, -6, 21, 9);
    fs(ctx, rg(ctx, fx - 14, -10, 2, fx - 9, -6, 22, [0, far ? SKIN.mid : SKIN.light, 1, SKIN.dark]), SKIN.stroke, 2);
  }
  ctx.save();
  ctx.translate(0, hipY);
  ctx.rotate(lean);
  // 远侧手臂（垂下，大拳头）
  tube(ctx, [20, -92, 34, -50, 22, -8], 24, SKIN.dark, SKIN.stroke, 2);
  C(ctx, 22, -4, 15);
  fs(ctx, rg(ctx, 18, -8, 2, 22, -4, 16, [0, SKIN.mid, 1, SKIN.dark]), SKIN.stroke, 2);
  // 躯干
  const bodyPath = () => {
    ctx.beginPath();
    ctx.moveTo(-34, 4);
    ctx.bezierCurveTo(-46, -24, -46, -62, -36, -90);
    ctx.bezierCurveTo(-26, -114, 14, -122, 32, -104);
    ctx.bezierCurveTo(48, -86, 44, -40, 36, 4);
    ctx.quadraticCurveTo(0, 12, -34, 4);
    ctx.closePath();
  };
  bodyPath();
  fs(ctx, rg(ctx, -14, -74, 6, 0, -50, 76, [0, SKIN.light, 0.55, SKIN.mid, 1, SKIN.dark]), SKIN.stroke, 2.4);
  ctx.save();
  bodyPath();
  ctx.clip();
  // 背带裤
  ctx.beginPath();
  ctx.moveTo(-50, -40); ctx.quadraticCurveTo(0, -30, 50, -44); ctx.lineTo(50, 20); ctx.lineTo(-50, 20); ctx.closePath();
  fs(ctx, lg(ctx, 0, -44, 0, 10, [0, '#7a6044', 1, '#4a3a28']), stroke, 2);
  ctx.fillStyle = '#4a3a28';
  ctx.fillRect(-30, -104, 10, 70);
  ctx.fillRect(20, -108, 10, 70);
  ctx.fillStyle = '#d8c070';
  C(ctx, -25, -42, 3.5); ctx.fill();
  C(ctx, 25, -46, 3.5); ctx.fill();
  // 伤疤缝线
  ctx.strokeStyle = '#4a2a2a';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-8, -84); ctx.lineTo(8, -64);
  for (let i = 0; i < 4; i++) { const u = i / 3; const x = lerp(-8, 8, u), y = lerp(-84, -64, u); ctx.moveTo(x - 4, y + 3); ctx.lineTo(x + 4, y - 3); }
  ctx.stroke();
  ctx.restore();
  // 背上的小鬼
  if (z.hasImp) {
    ctx.save();
    ctx.translate(36, -112);
    ctx.rotate(0.2 + Math.sin(t * 3) * 0.05);
    tube(ctx, [-8, 10, -18, 0], 6, SKIN.mid, SKIN.stroke, 1.3);
    drawImpHead(ctx, t);
    ctx.restore();
  }
  // 小脑袋
  ctx.save();
  ctx.translate(-30, -110);
  ctx.rotate(-0.1 + Math.sin(ph) * 0.03);
  E(ctx, 0, 0, 17, 18);
  fs(ctx, rg(ctx, -5, -6, 2, 0, 0, 22, [0, SKIN.light, 1, SKIN.dark]), SKIN.stroke, 2);
  eye(ctx, -8, -3, 5.2, 5.5, -1.5, 0.5, { pupil: 0.3, highlight: false, stroke: SKIN.stroke, white: '#fff3d0' });
  eye(ctx, 4, -4, 4.4, 4.8, -1.5, 0.5, { pupil: 0.3, highlight: false, stroke: SKIN.stroke, white: '#fff3d0' });
  ctx.lineWidth = 3.2;
  ctx.strokeStyle = SKIN.stroke;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-15, -12); ctx.lineTo(-2, -7); ctx.moveTo(9, -11); ctx.lineTo(1, -8); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-15, 8); ctx.lineTo(2, 7); ctx.lineTo(0, 14); ctx.lineTo(-13, 15); ctx.closePath();
  fs(ctx, '#3a1a14', SKIN.stroke, 1.4);
  teeth(ctx, -14, 15, 0, 14, 3, -4, 1, '#f2ecd0', '#555');
  ctx.strokeStyle = '#2a2018';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(2, -17); ctx.quadraticCurveTo(0, -26, -6, -24); ctx.stroke();
  ctx.restore();
  // 近侧手臂与电线杆
  ctx.save();
  ctx.translate(-26, -92);
  const ex = -Math.sin(armA) * 34, ey = Math.cos(armA) * 34;
  const fa = armA + 0.25;
  const hx = ex - Math.sin(fa) * 32, hy = ey + Math.cos(fa) * 32;
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(poleR);
  ctx.beginPath();
  ctx.rect(-8, -128, 16, 158);
  fs(ctx, lg(ctx, -8, 0, 8, 0, [0, '#b08a54', 0.5, '#8a6a3a', 1, '#5a4020']), '#2a1a08', 2);
  ctx.strokeStyle = 'rgba(40,24,8,0.4)';
  ctx.lineWidth = 1.2;
  for (const yy of [-100, -60, -20]) { ctx.beginPath(); ctx.moveTo(-8, yy); ctx.lineTo(8, yy + 4); ctx.stroke(); }
  ctx.fillStyle = '#4a3418';
  ctx.fillRect(-26, -114, 52, 8);
  ctx.fillStyle = '#e0e0d0';
  for (const xx of [-22, 22]) { C(ctx, xx, -118, 4); ctx.fill(); }
  ctx.restore();
  tube(ctx, [0, 0, ex, ey], 26, SKIN.mid, SKIN.stroke, 2);
  tube(ctx, [ex, ey, hx, hy], 23, SKIN.mid, SKIN.stroke, 2);
  C(ctx, hx, hy, 14);
  fs(ctx, rg(ctx, hx - 4, hy - 4, 2, hx, hy, 15, [0, SKIN.light, 1, SKIN.mid]), SKIN.stroke, 2);
  ctx.restore();
  ctx.restore();
}

function drawImpHead(ctx, t) {
  E(ctx, 0, 0, 13, 14);
  fs(ctx, rg(ctx, -3, -5, 1, 0, 0, 16, [0, SKIN.light, 1, SKIN.dark]), SKIN.stroke, 1.6);
  eye(ctx, -6, -3, 4.5, 5, -0.8, 0, { pupil: 0.35, highlight: false, stroke: SKIN.stroke });
  eye(ctx, 3, -3, 3.8, 4.2, -0.8, 0, { pupil: 0.35, highlight: false, stroke: SKIN.stroke });
  ctx.beginPath();
  ctx.arc(-3, 6, 4, 0.1 * Math.PI, 0.9 * Math.PI);
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = SKIN.stroke;
  ctx.stroke();
}

// ================= 冰车僵尸 =================
export function drawZomboni(ctx, z) {
  const t = z.t || 0;
  const s = 1;
  const dmg = z.vehicleStage || 0;
  const bob = Math.sin(t * 8) * 1;
  const stroke = '#1a1a1a';
  ctx.save();
  ctx.translate(0, bob);
  // 后轮（大滚筒）
  C(ctx, 50, -26, 26);
  fs(ctx, rg(ctx, 44, -32, 2, 50, -26, 26, [0, '#5a5a5a', 1, '#1a1a1a']), stroke, 2);
  C(ctx, 50, -26, 10);
  fs(ctx, '#9a9a9a', stroke, 1.5);
  // 车身
  ctx.beginPath();
  ctx.moveTo(-70, -16);
  ctx.lineTo(-74, -58);
  ctx.quadraticCurveTo(-70, -74, -50, -76);
  ctx.lineTo(20, -80);
  ctx.lineTo(62, -64);
  ctx.lineTo(74, -40);
  ctx.lineTo(72, -16);
  ctx.closePath();
  fs(ctx, lg(ctx, 0, -80, 0, -16, [0, '#f2f2ee', 0.5, '#d4d4cc', 1, '#9a9a90']), stroke, 2.2);
  // 蓝色条纹
  ctx.save();
  ctx.clip();
  ctx.fillStyle = '#2a6ac8';
  ctx.fillRect(-80, -44, 160, 12);
  ctx.fillStyle = '#c82a2a';
  ctx.fillRect(-80, -30, 160, 5);
  if (dmg >= 1) { ctx.fillStyle = 'rgba(30,30,30,0.35)'; E(ctx, -30, -60, 14, 9); ctx.fill(); E(ctx, 30, -24, 10, 6); ctx.fill(); }
  if (dmg >= 2) { ctx.fillStyle = 'rgba(30,30,30,0.5)'; E(ctx, 10, -66, 16, 8); ctx.fill(); }
  ctx.restore();
  text(ctx, 'ZOMBONI', -8, -54, { size: 13, color: '#2a4a8a', weight: 900 });
  // 刮冰板
  ctx.beginPath();
  ctx.moveTo(-82, -2); ctx.lineTo(-72, -20); ctx.lineTo(-40, -20); ctx.lineTo(-40, -2); ctx.closePath();
  fs(ctx, '#7a8288', stroke, 1.8);
  // 前轮
  C(ctx, -52, -12, 12);
  fs(ctx, '#2a2a2a', stroke, 1.8);
  C(ctx, -52, -12, 4.5);
  fs(ctx, '#aaa', stroke, 1);
  // 驾驶员
  ctx.save();
  ctx.translate(10, -78);
  tube(ctx, [0, 0, -2, -24], 22, '#6e5641', '#1e1812', 1.8);
  tube(ctx, [-8, -16, -26, -8, -30, 0], 8, '#6e5641', '#1e1812', 1.6);
  E(ctx, -32, 0, 5, 4.5); fs(ctx, SKIN.mid, SKIN.stroke, 1.3);
  ctx.translate(-4, -46);
  drawHead(ctx, z, LOOKS.normal, { jaw: 0.3 + Math.sin(t * 3) * 0.1 }, 0.95);
  ctx.restore();
  // 方向盘
  line(ctx, -22, -76, -36, -96, '#333', 3);
  E(ctx, -36, -98, 10, 3.5, -0.3);
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#222';
  ctx.stroke();
  // 排气管
  tube(ctx, [58, -66, 60, -90], 6, '#555', stroke, 1.4);
  ctx.restore();
}

// ================= 海豚骑士 =================
export function drawDolphin(ctx, t, s = 1, jump = 0) {
  ctx.save();
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.moveTo(-58, -6);
  ctx.bezierCurveTo(-40, -28, 20, -30, 44, -12);
  ctx.quadraticCurveTo(56, -4, 62, -18);
  ctx.lineTo(66, 4);
  ctx.quadraticCurveTo(50, 2, 40, 4);
  ctx.bezierCurveTo(10, 14, -30, 10, -58, -6);
  ctx.closePath();
  fs(ctx, lg(ctx, 0, -28, 0, 12, [0, '#7a8ab0', 0.6, '#4a5a80', 1, '#c8d0e0']), '#1a2030', 2);
  ctx.beginPath();
  ctx.moveTo(-2, -24); ctx.lineTo(8, -40); ctx.lineTo(16, -22); ctx.closePath();
  fs(ctx, '#4a5a80', '#1a2030', 1.8);
  ctx.beginPath();
  ctx.moveTo(-58, -6); ctx.lineTo(-70, -4); ctx.lineTo(-56, 0); ctx.closePath();
  fs(ctx, '#5a6a90', '#1a2030', 1.5);
  eye(ctx, -40, -12, 3, 3, -0.8, 0, { pupil: 0.6 });
  ctx.restore();
}

// ================= 分发 =================
export function drawZombieArt(ctx, z) {
  switch (z.type) {
    case 'gargantuar': drawGargantuar(ctx, z); break;
    case 'zomboni': drawZomboni(ctx, z); break;
    case 'imp': drawHumanoid(ctx, z); break;
    case 'dolphin': {
      if (z.riding) {
        drawDolphin(ctx, z.t, 0.9);
        ctx.save();
        ctx.translate(4, -18);
        drawHumanoid(ctx, { ...z, anim: 'idle' });
        ctx.restore();
      } else drawHumanoid(ctx, z);
      break;
    }
    case 'digger':
      if (z.underground) drawDiggerMound(ctx, z.t || 0);
      else drawHumanoid(ctx, z);
      break;
    default: drawHumanoid(ctx, z);
  }
}

// 头部掉落粒子用的独立绘制
export function drawSeveredHead(ctx, z) {
  const L = LOOKS[z.lookType || z.type] || LOOKS.normal;
  const s = L.small ? 0.78 : 1;
  drawHead(ctx, { ...z, angry: false, hypno: z.hypno }, L, { jaw: 0.5 }, s);
}

export function drawSeveredArm(ctx, z) {
  const L = LOOKS[z.lookType || z.type] || LOOKS.normal;
  drawArm(ctx, 0, 0, 0.3, 0.4, L, false, L.small ? 0.78 : 1);
}

export { drawArmorHat, drawImpHead };
