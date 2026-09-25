// 界面与道具美术：阳光、豌豆、割草机、墓碑、弹坑、种子卡片、铲子、按钮、面板、标题 Logo 等。
import { TAU, clamp, lerp, shade, Ease } from '../core/util.js';
import { display } from '../core/display.js';
import { E, C, fs, rg, lg, rr, text, star, tube, eye, blob, FONT } from './paint.js';
import { PLANT_ART, drawFlame, bowlnut } from './plantArt.js';
import { PLANTS } from '../game/defs.js';

// ================= 阳光 =================
export function drawSun(ctx, x, y, r, t, alpha = 1) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  ctx.globalCompositeOperation = 'lighter';
  C(ctx, 0, 0, r * 2.1);
  ctx.fillStyle = rg(ctx, 0, 0, r * 0.3, 0, 0, r * 2.1, [0, 'rgba(255,240,120,0.55)', 1, 'rgba(255,200,0,0)']);
  ctx.fill();
  for (let layer = 0; layer < 2; layer++) {
    ctx.save();
    ctx.rotate((layer ? -1 : 1) * t * 0.8 + layer * 0.3);
    star(ctx, 0, 0, r * (layer ? 1.55 : 1.8), r * 0.75, layer ? 7 : 9, 0);
    ctx.fillStyle = layer ? 'rgba(255,230,90,0.45)' : 'rgba(255,250,170,0.35)';
    ctx.fill();
    ctx.restore();
  }
  ctx.globalCompositeOperation = 'source-over';
  C(ctx, 0, 0, r);
  fs(ctx, rg(ctx, -r * 0.3, -r * 0.35, r * 0.1, 0, 0, r, [0, '#fffbd0', 0.45, '#ffe34a', 1, '#ffb400']), 'rgba(230,140,0,0.8)', 1.5);
  C(ctx, -r * 0.3, -r * 0.35, r * 0.28);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fill();
  ctx.restore();
}

// ================= 子弹 =================
export function drawProjectile(ctx, p, t) {
  const { x, y } = p;
  switch (p.kind) {
    case 'pea':
      E(ctx, x, p.groundY, 8, 3); ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fill();
      C(ctx, x, y, 9.5);
      fs(ctx, rg(ctx, x - 3, y - 3, 1, x, y, 10, [0, '#d8ff9a', 0.5, '#7ad63c', 1, '#3c8a1a']), '#1f4d0b', 1.6);
      C(ctx, x - 3, y - 3.5, 2.6); ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fill();
      break;
    case 'snow': {
      E(ctx, x, p.groundY, 8, 3); ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fill();
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      C(ctx, x - 6, y, 16);
      ctx.fillStyle = rg(ctx, x - 6, y, 2, x - 6, y, 16, [0, 'rgba(160,230,255,0.6)', 1, 'rgba(80,180,255,0)']);
      ctx.fill();
      ctx.restore();
      C(ctx, x, y, 9.5);
      fs(ctx, rg(ctx, x - 3, y - 3, 1, x, y, 10, [0, '#ffffff', 0.5, '#9ee2ff', 1, '#3a9ad8']), '#15486e', 1.6);
      star(ctx, x - 1, y - 1, 5, 1.5, 4, t * 6);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fill();
      break;
    }
    case 'fire': {
      E(ctx, x, p.groundY, 9, 3); ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fill();
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 5; i++) {
        const tx = x - 8 - i * 7, ty = y + Math.sin(t * 30 + i) * 2;
        C(ctx, tx, ty, 11 - i * 1.6);
        ctx.fillStyle = rg(ctx, tx, ty, 1, tx, ty, 12 - i * 1.6, [0, 'rgba(255,200,60,0.8)', 1, 'rgba(255,60,0,0)']);
        ctx.fill();
      }
      C(ctx, x, y, 16);
      ctx.fillStyle = rg(ctx, x, y, 2, x, y, 16, [0, 'rgba(255,255,200,1)', 0.4, 'rgba(255,170,30,0.9)', 1, 'rgba(255,60,0,0)']);
      ctx.fill();
      ctx.restore();
      break;
    }
    case 'spike': {
      E(ctx, x, p.groundY, 8, 2.5); ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fill();
      ctx.save();
      ctx.translate(x, y);
      ctx.beginPath();
      ctx.moveTo(12, 0); ctx.lineTo(-10, -3); ctx.lineTo(-12, 0); ctx.lineTo(-10, 3); ctx.closePath();
      fs(ctx, lg(ctx, -12, 0, 12, 0, [0, '#4a8a2a', 1, '#e8ffd0']), '#1f4d0f', 1.2);
      ctx.restore();
      break;
    }
    case 'puff': {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      C(ctx, x, y, 11);
      ctx.fillStyle = rg(ctx, x, y, 1, x, y, 11, [0, 'rgba(240,180,255,0.9)', 1, 'rgba(160,60,220,0)']);
      ctx.fill();
      ctx.restore();
      C(ctx, x, y, 5.5);
      fs(ctx, rg(ctx, x - 2, y - 2, 1, x, y, 6, [0, '#fbe8ff', 1, '#b46ae0']), '#5a2a80', 1.2);
      break;
    }
  }
}

// ================= 割草机 / 泳池清洁车 =================
export function drawMower(ctx, x, y, t, running, pool = false) {
  const shake = running ? Math.sin(t * 60) * 1.2 : 0;
  ctx.save();
  ctx.translate(x, y + shake * 0.5);
  E(ctx, 0, 2, 34, 8); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill();
  if (pool) {
    // 泳池清洁车
    ctx.beginPath();
    ctx.moveTo(-30, -2); ctx.lineTo(-26, -26); ctx.quadraticCurveTo(0, -36, 24, -26); ctx.lineTo(34, -2); ctx.closePath();
    fs(ctx, lg(ctx, 0, -34, 0, 0, [0, '#f4f8fc', 1, '#9ab8d0']), '#1a3a5a', 2);
    ctx.fillStyle = '#2a7ad8';
    ctx.fillRect(-26, -16, 56, 6);
    tube(ctx, [-24, -24, -44, -46, -40, -60], 5, '#d8dce0', '#333', 1.3);
    C(ctx, 26, -12, 6); fs(ctx, '#333', '#111', 1.2);
    ctx.restore();
    return;
  }
  // 把手
  tube(ctx, [-18, -20, -40, -44, -46, -56], 4, '#9a9a9a', '#2a2a2a', 1.3);
  tube(ctx, [-46, -56, -54, -54], 5, '#222', '#000', 1);
  // 车身
  ctx.beginPath();
  ctx.moveTo(-28, -6);
  ctx.lineTo(-24, -26);
  ctx.quadraticCurveTo(0, -34, 26, -24);
  ctx.lineTo(32, -6);
  ctx.closePath();
  fs(ctx, lg(ctx, 0, -32, 0, -6, [0, '#ff6a5a', 0.5, '#d8201a', 1, '#8a0a08']), '#3a0402', 2);
  // 引擎
  rr(ctx, -10, -40, 22, 16, 4);
  fs(ctx, lg(ctx, 0, -40, 0, -24, [0, '#d8d8d8', 1, '#7a7a7a']), '#222', 1.6);
  ctx.fillStyle = '#333';
  for (let i = 0; i < 3; i++) ctx.fillRect(-7 + i * 6, -37, 3, 10);
  // 排气
  if (running) {
    ctx.globalAlpha = 0.5;
    C(ctx, -14 - (t * 60) % 20, -44 - (t * 40) % 16, 5);
    ctx.fillStyle = '#888';
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  // 轮子
  for (const wx of [-18, 20]) {
    C(ctx, wx, -4, 9);
    fs(ctx, '#222', '#000', 1.5);
    C(ctx, wx, -4, 3.5);
    fs(ctx, '#bbb', '#444', 1);
    if (running) {
      ctx.strokeStyle = '#666';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const a = t * 30;
      ctx.moveTo(wx + Math.cos(a) * 3.5, -4 + Math.sin(a) * 3.5);
      ctx.lineTo(wx + Math.cos(a) * 8, -4 + Math.sin(a) * 8);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// ================= 墓碑 =================
export function drawGrave(ctx, x, y, variant, t, o = {}) {
  const sink = o.sink || 0; // 被吞噬时下沉
  const rise = o.rise ?? 1;
  ctx.save();
  ctx.translate(x, y);
  // 土堆
  E(ctx, 0, -4, 38, 12);
  fs(ctx, rg(ctx, -8, -10, 2, 0, -4, 38, [0, '#6a5a4a', 1, '#3a2e24']), '#1e1812', 1.5);
  ctx.beginPath();
  ctx.rect(-60, -140, 120, 136);
  ctx.clip();
  ctx.translate(0, sink * 70 + (1 - rise) * 80);
  const stoneL = '#b8b8c4', stoneD = '#6a6a7a', stroke = '#2a2a36';
  ctx.beginPath();
  if (variant === 0) {
    ctx.moveTo(-24, -4); ctx.lineTo(-24, -50); ctx.bezierCurveTo(-24, -76, 24, -76, 24, -50); ctx.lineTo(24, -4);
  } else if (variant === 1) {
    ctx.moveTo(-8, -4); ctx.lineTo(-8, -42); ctx.lineTo(-24, -42); ctx.lineTo(-24, -56); ctx.lineTo(-8, -56); ctx.lineTo(-8, -76);
    ctx.lineTo(8, -76); ctx.lineTo(8, -56); ctx.lineTo(24, -56); ctx.lineTo(24, -42); ctx.lineTo(8, -42); ctx.lineTo(8, -4);
  } else if (variant === 2) {
    ctx.moveTo(-22, -4); ctx.lineTo(-26, -54); ctx.lineTo(0, -74); ctx.lineTo(26, -54); ctx.lineTo(22, -4);
  } else {
    ctx.moveTo(-28, -4); ctx.lineTo(-26, -44); ctx.quadraticCurveTo(-20, -58, 0, -60); ctx.quadraticCurveTo(20, -58, 26, -44); ctx.lineTo(28, -4);
  }
  ctx.closePath();
  fs(ctx, lg(ctx, -24, -70, 24, 0, [0, stoneL, 1, stoneD]), stroke, 2);
  // 刻字 / 裂纹 / 苔藓
  ctx.strokeStyle = 'rgba(30,30,40,0.55)';
  ctx.lineWidth = 1.6;
  if (variant !== 1) {
    ctx.beginPath();
    ctx.moveTo(-10, -42); ctx.lineTo(10, -42);
    ctx.moveTo(-12, -34); ctx.lineTo(12, -34);
    ctx.moveTo(-8, -26); ctx.lineTo(8, -26);
    ctx.stroke();
    ctx.font = '900 11px ' + FONT;
    ctx.fillStyle = 'rgba(30,30,40,0.6)';
    ctx.textAlign = 'center';
    ctx.fillText('R.I.P', 0, -48);
  }
  ctx.beginPath();
  ctx.moveTo(14, -58); ctx.lineTo(8, -48); ctx.lineTo(12, -40);
  ctx.stroke();
  ctx.fillStyle = 'rgba(80,140,70,0.55)';
  E(ctx, -14, -8, 10, 5); ctx.fill();
  E(ctx, 18, -6, 7, 4); ctx.fill();
  ctx.restore();
}

export function drawCrater(ctx, x, y, t, k) {
  ctx.save();
  ctx.translate(x, y - 30);
  ctx.globalAlpha *= clamp(k * 3, 0, 1);
  E(ctx, 0, 0, 46, 22);
  fs(ctx, rg(ctx, 0, 4, 4, 0, 0, 46, [0, '#140c08', 0.6, '#2a1c14', 1, '#4a3424']), '#1a120c', 2);
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 44, Math.sin(a) * 20);
    ctx.lineTo(Math.cos(a) * 56, Math.sin(a) * 26);
    ctx.stroke();
  }
  if (k > 0.8) {
    ctx.globalAlpha *= 0.4;
    const p = (t * 0.6) % 1;
    C(ctx, Math.sin(t) * 10, -p * 40, 10 + p * 10);
    ctx.fillStyle = '#555';
    ctx.fill();
  }
  ctx.restore();
}

// ================= 植物图标缓存（用于卡片、图鉴） =================
const iconCache = new Map();
export function plantIcon(type, size = 64) {
  const scale = display.cacheScale;
  const key = type + '@' + size + '@' + scale;
  let c = iconCache.get(key);
  if (c) return c;
  const buf = display.makeCanvas(size, size, scale);
  const ctx = buf.ctx;
  const art = PLANT_ART[type];
  // 估算植物尺寸以适配
  const tall = { tallnut: 1.35, chomper: 1.25, threepeater: 1.15, hypnoshroom: 1.1, torchwood: 1.2, jalapeno: 1.15, gravebuster: 1.05, magnetshroom: 1.05 }[type] || 1;
  const s = (size / 100) * (1.05 / tall);
  ctx.translate(size / 2, size * 0.9);
  ctx.scale(s, s);
  if (type === 'gravebuster') ctx.translate(0, 20);
  if (art) art(ctx, { t: 0.5, phase: 0, icon: true, armed: true, rise: 1 });
  iconCache.set(key, buf);
  return buf;
}

export function bowlIcon(kind) {
  const scale = display.cacheScale;
  const key = 'bowl-' + kind + '@' + scale;
  let c = iconCache.get(key);
  if (c) return c;
  const buf = display.makeCanvas(64, 64, scale);
  buf.ctx.translate(32, 56);
  buf.ctx.scale(kind === 'giant' ? 0.5 : 0.78, kind === 'giant' ? 0.5 : 0.78);
  bowlnut(buf.ctx, { roll: 0 }, kind);
  if (kind === 'giant') { buf.ctx.setTransform(scale, 0, 0, scale, 0, 0); text(buf.ctx, '巨型', 32, 12, { size: 13, color: '#fff', stroke: '#5a2a00', lw: 3 }); }
  iconCache.set(key, buf);
  return buf;
}

// ================= 种子卡片 =================
export const PACKET_W = 62;
export const PACKET_H = 86;

export function drawPacket(ctx, x, y, type, o = {}) {
  const w = o.w || PACKET_W, h = o.h || PACKET_H;
  const def = PLANTS[type];
  ctx.save();
  ctx.translate(x, y);
  if (o.scale) ctx.scale(o.scale, o.scale);
  if (o.shadow !== false) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    rr(ctx, 3, 4, w, h, 6);
    ctx.fill();
  }
  // 卡纸
  rr(ctx, 0, 0, w, h, 6);
  fs(ctx, lg(ctx, 0, 0, 0, h, [0, '#fbf1c8', 1, '#e2cf92']), '#6a5220', 2);
  // 图片区
  const bgCols = def?.night ? ['#d8c8ec', '#a890c8'] : def?.aquatic ? ['#c8ecf4', '#88c4d8'] : ['#d8f0b4', '#9ccc6a'];
  rr(ctx, 5, 5, w - 10, h - 30, 4);
  fs(ctx, lg(ctx, 0, 5, 0, h - 25, [0, bgCols[0], 1, bgCols[1]]), 'rgba(80,60,20,0.5)', 1.2);
  const icon = type.startsWith('bowl-') ? bowlIcon(type.slice(5)) : plantIcon(type, 64);
  const iw = w - 8;
  ctx.drawImage(icon.canvas, 4, 3, iw, iw * (icon.h / icon.w));
  // 价格
  if (!o.noCost) {
    rr(ctx, 7, h - 23, w - 14, 18, 4);
    fs(ctx, '#fffbe6', 'rgba(90,70,30,0.6)', 1);
    text(ctx, String(o.cost ?? def?.cost ?? 0), w / 2, h - 13.5, { size: 15, color: '#1a1206', weight: 900 });
  }
  // 冷却遮罩
  if (o.recharge > 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    rr(ctx, 0, 0, w, h * o.recharge, 6);
    ctx.fill();
  }
  if (o.disabled) {
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    rr(ctx, 0, 0, w, h, 6);
    ctx.fill();
  }
  if (o.selected) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    rr(ctx, 0, 0, w, h, 6);
    ctx.fill();
  }
  if (o.hover && !o.disabled) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(255,255,200,0.18)';
    rr(ctx, 0, 0, w, h, 6);
    ctx.fill();
    ctx.restore();
  }
  if (o.glow) {
    ctx.save();
    ctx.globalAlpha *= o.glow;
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#fff6a0';
    rr(ctx, -2, -2, w + 4, h + 4, 8);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

// ================= 种子槽背板 =================
export function drawSeedBank(ctx, x, y, slots, o = {}) {
  const w = 96 + slots * (PACKET_W + 6) + 6;
  const h = 98;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  rr(ctx, x + 3, y + 4, w, h, 10);
  ctx.fill();
  rr(ctx, x, y, w, h, 10);
  fs(ctx, lg(ctx, 0, y, 0, y + h, [0, '#9a6a3c', 0.5, '#7a4e26', 1, '#5a3614']), '#2e1a08', 2.5);
  // 木纹
  ctx.save();
  rr(ctx, x, y, w, h, 10);
  ctx.clip();
  ctx.strokeStyle = 'rgba(40,20,5,0.25)';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 7; i++) {
    ctx.beginPath();
    ctx.moveTo(x, y + 8 + i * 13);
    ctx.bezierCurveTo(x + w * 0.3, y + 4 + i * 13, x + w * 0.6, y + 14 + i * 13, x + w, y + 8 + i * 13);
    ctx.stroke();
  }
  ctx.restore();
  // 阳光计数区
  if (!o.noSun) {
    rr(ctx, x + 8, y + 6, 80, 86, 8);
    fs(ctx, 'rgba(40,20,5,0.35)');
    rr(ctx, x + 14, y + 64, 68, 24, 6);
    fs(ctx, lg(ctx, 0, y + 64, 0, y + 88, [0, '#fffbe6', 1, '#e8dcb0']), '#5a4010', 1.5);
  }
  // 卡槽
  for (let i = 0; i < slots; i++) {
    const sx = x + 96 + i * (PACKET_W + 6);
    rr(ctx, sx, y + 6, PACKET_W, PACKET_H, 6);
    fs(ctx, 'rgba(30,15,3,0.45)', 'rgba(0,0,0,0.3)', 1);
  }
  ctx.restore();
  return w;
}

// ================= 铲子 =================
export function drawShovel(ctx, x, y, s = 1, rot = -0.75) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.rotate(rot);
  tube(ctx, [0, -34, 0, 10], 6, '#b07a3a', '#3a2008', 1.5);
  rr(ctx, -9, -44, 18, 10, 4);
  fs(ctx, '#8a5a24', '#3a2008', 1.5);
  ctx.beginPath();
  ctx.moveTo(-12, 8); ctx.lineTo(12, 8); ctx.lineTo(12, 26); ctx.quadraticCurveTo(0, 42, -12, 26); ctx.closePath();
  fs(ctx, lg(ctx, -12, 0, 12, 0, [0, '#9aa4ac', 0.4, '#f0f4f8', 1, '#7a848c']), '#2a3036', 1.8);
  ctx.restore();
}

export function drawShovelBox(ctx, x, y, hover, active) {
  rr(ctx, x + 3, y + 4, 78, 78, 10);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fill();
  rr(ctx, x, y, 78, 78, 10);
  fs(ctx, lg(ctx, 0, y, 0, y + 78, [0, '#9a6a3c', 1, '#5a3614']), '#2e1a08', 2.5);
  rr(ctx, x + 7, y + 7, 64, 64, 8);
  fs(ctx, 'rgba(30,15,3,0.5)', hover ? '#ffe68a' : 'rgba(0,0,0,0.3)', hover ? 2.5 : 1);
  if (!active) drawShovel(ctx, x + 39, y + 40, 1.05);
}

// ================= 按钮 / 面板 =================
export function drawButton(ctx, b) {
  const { x, y, w, h } = b;
  const press = b.pressed ? 2 : 0;
  const hov = b.hover && !b.disabled;
  const style = b.style || 'green';
  ctx.save();
  if (b.alpha !== undefined) ctx.globalAlpha *= b.alpha;
  ctx.translate(0, press);
  const cols = {
    green: ['#9ee05a', '#4f9a22', '#1f4a0a', '#fff'],
    stone: ['#b8bcc4', '#6a6e7a', '#26282e', '#f4f4f0'],
    wood: ['#d8a060', '#8a5a2a', '#3a2008', '#fff4d8'],
    red: ['#ff8a6a', '#c02a1a', '#4a0802', '#fff'],
    purple: ['#c89aea', '#6a3a9a', '#2a0a4a', '#fff'],
    gold: ['#ffe07a', '#d89a1a', '#5a3a00', '#3a2000'],
  }[style];
  const r = b.radius ?? Math.min(14, h / 2);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  rr(ctx, x + 2, y + 5 - press, w, h, r);
  ctx.fill();
  rr(ctx, x, y, w, h, r);
  fs(ctx, lg(ctx, 0, y, 0, y + h, [0, hov ? shade(cols[0], 0.15) : cols[0], 1, hov ? shade(cols[1], 0.1) : cols[1]]), cols[2], 2.5);
  // 顶部高光
  ctx.save();
  rr(ctx, x + 4, y + 3, w - 8, h * 0.42, r * 0.8);
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.fill();
  ctx.restore();
  if (style === 'stone') {
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.2, y + h * 0.8); ctx.lineTo(x + w * 0.26, y + h * 0.6); ctx.lineTo(x + w * 0.22, y + h * 0.45);
    ctx.stroke();
  }
  const fsz = b.fontSize || Math.min(26, h * 0.46);
  text(ctx, b.label, x + w / 2 + (b.icon ? 12 : 0), y + h / 2 + 1, { size: fsz, color: b.disabled ? '#aaa' : cols[3], stroke: cols[2], lw: fsz * 0.22 });
  if (b.disabled) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    rr(ctx, x, y, w, h, r);
    ctx.fill();
  }
  ctx.restore();
}

export function drawPanel(ctx, x, y, w, h, style = 'stone') {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  rr(ctx, x + 6, y + 8, w, h, 22);
  ctx.fill();
  if (style === 'stone') {
    rr(ctx, x, y, w, h, 22);
    fs(ctx, lg(ctx, x, y, x + w * 0.3, y + h, [0, '#9aa0ac', 0.5, '#6e7482', 1, '#4a4e5a']), '#1e2026', 3);
    rr(ctx, x + 10, y + 10, w - 20, h - 20, 16);
    fs(ctx, lg(ctx, 0, y, 0, y + h, [0, '#5a5e6a', 1, '#3a3e48']), 'rgba(255,255,255,0.12)', 2);
    // 石纹
    ctx.save();
    rr(ctx, x, y, w, h, 22);
    ctx.clip();
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      const sx = x + ((i * 173) % w), sy = y + ((i * 97) % h);
      ctx.moveTo(sx, sy); ctx.lineTo(sx + 14, sy + 10); ctx.lineTo(sx + 10, sy + 24);
      ctx.stroke();
    }
    ctx.restore();
  } else if (style === 'paper') {
    rr(ctx, x, y, w, h, 16);
    fs(ctx, lg(ctx, 0, y, 0, y + h, [0, '#f8eecc', 1, '#e0cc98']), '#5a4418', 3);
  } else if (style === 'wood') {
    rr(ctx, x, y, w, h, 18);
    fs(ctx, lg(ctx, 0, y, 0, y + h, [0, '#a8743e', 1, '#6a4418']), '#2e1a08', 3);
    ctx.save();
    rr(ctx, x, y, w, h, 18);
    ctx.clip();
    ctx.strokeStyle = 'rgba(40,20,5,0.25)';
    for (let i = 0; i < h / 14; i++) {
      ctx.beginPath();
      ctx.moveTo(x, y + i * 14 + 6);
      ctx.bezierCurveTo(x + w * 0.3, y + i * 14, x + w * 0.7, y + i * 14 + 12, x + w, y + i * 14 + 6);
      ctx.stroke();
    }
    ctx.restore();
  } else if (style === 'dark') {
    rr(ctx, x, y, w, h, 18);
    fs(ctx, 'rgba(12,16,10,0.88)', 'rgba(200,255,150,0.25)', 2);
  }
  ctx.restore();
}

// ================= 奖励物 =================
export function drawTrophy(ctx, x, y, s = 1, t = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.rotate(t * 0.5);
  star(ctx, 0, -30, 70, 30, 12);
  ctx.fillStyle = 'rgba(255,230,120,0.25)';
  ctx.fill();
  ctx.restore();
  ctx.beginPath();
  ctx.moveTo(-26, -58); ctx.lineTo(26, -58); ctx.quadraticCurveTo(26, -18, 0, -14); ctx.quadraticCurveTo(-26, -18, -26, -58);
  fs(ctx, lg(ctx, -26, 0, 26, 0, [0, '#c88a10', 0.4, '#ffe680', 1, '#b07808']), '#5a3a00', 2.5);
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(sx * 30, -46, 10, sx > 0 ? -1.6 : 1.6 + 0, sx > 0 ? 1.6 : 4.7);
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#d8a020';
    ctx.stroke();
  }
  ctx.fillStyle = '#d8a020';
  ctx.fillRect(-5, -16, 10, 12);
  rr(ctx, -18, -6, 36, 10, 3);
  fs(ctx, lg(ctx, 0, -6, 0, 4, [0, '#8a5a2a', 1, '#5a3614']), '#2a1a08', 1.5);
  ctx.restore();
}

export function drawNote(ctx, x, y, s = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.rotate(-0.1);
  rr(ctx, -24, -60, 48, 56, 3);
  fs(ctx, lg(ctx, 0, -60, 0, -4, [0, '#fffef0', 1, '#e8e0c0']), '#6a5a30', 2);
  ctx.strokeStyle = 'rgba(60,80,160,0.5)';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(-18, -48 + i * 9); ctx.lineTo(18, -48 + i * 9); ctx.stroke(); }
  ctx.restore();
}

// ================= 标题 Logo =================
export function drawLogo(ctx, x, y, s = 1, t = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.rotate(-0.03);
  const bounce = Math.sin(t * 2) * 2;
  // “植物”
  const leafText = (str, cx, cy, size, rot) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.font = `900 ${size}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = size * 0.34;
    ctx.strokeStyle = '#123a06';
    ctx.strokeText(str, 0, 4);
    ctx.lineWidth = size * 0.22;
    ctx.strokeStyle = '#2e7a12';
    ctx.strokeText(str, 0, 0);
    ctx.fillStyle = lg(ctx, 0, -size / 2, 0, size / 2, [0, '#e4ff9a', 0.5, '#8ee03a', 1, '#3e9a16']);
    ctx.fillText(str, 0, 0);
    ctx.restore();
  };
  const zText = (str, cx, cy, size, rot) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.font = `900 ${size}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = size * 0.34;
    ctx.strokeStyle = '#1a1a14';
    ctx.strokeText(str, 0, 4);
    ctx.lineWidth = size * 0.2;
    ctx.strokeStyle = '#4a4a3a';
    ctx.strokeText(str, 0, 0);
    ctx.fillStyle = lg(ctx, 0, -size / 2, 0, size / 2, [0, '#e8ecd8', 0.55, '#a8b48c', 1, '#6a7a5a']);
    ctx.fillText(str, 0, 0);
    // 滴落
    ctx.fillStyle = '#8a9a70';
    for (const [dx, len] of [[-size * 0.55, 18], [-size * 0.1, 26], [size * 0.42, 14], [size * 0.8, 20]]) {
      ctx.beginPath();
      ctx.moveTo(dx - 4, size * 0.34);
      ctx.lineTo(dx + 4, size * 0.34);
      ctx.lineTo(dx + 2, size * 0.34 + len + Math.sin(t * 2 + dx) * 3);
      ctx.arc(dx, size * 0.34 + len + Math.sin(t * 2 + dx) * 3, 3.5, 0, Math.PI);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  };
  leafText('植物', -150, -8 + bounce, 104, -0.06);
  // 叶片点缀
  ctx.save();
  ctx.translate(-250, -60 + bounce);
  ctx.rotate(-0.6);
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.quadraticCurveTo(20, -24, 48, -4); ctx.quadraticCurveTo(22, 14, 0, 0);
  fs(ctx, '#7ad63c', '#1f4d0f', 3);
  ctx.restore();
  // “大战”
  ctx.save();
  ctx.translate(12, 8);
  C(ctx, 0, 0, 44);
  fs(ctx, rg(ctx, -10, -12, 4, 0, 0, 44, [0, '#ffeb6a', 1, '#e07a0a']), '#5a2a00', 4);
  text(ctx, '大战', 0, 2, { size: 30, color: '#fff', stroke: '#6a2a00', lw: 7 });
  ctx.restore();
  zText('僵尸', 170, 6 - bounce, 104, 0.05);
  ctx.restore();
}
