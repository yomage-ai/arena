// 绘图基元：卡通风格的描边填充、渐变、眼睛、叶片、描边文字等。
import { TAU } from '../core/util.js';

export const FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans CJK SC","Source Han Sans SC","WenQuanYi Micro Hei",sans-serif';

export function E(ctx, x, y, rx, ry, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.01, Math.abs(rx)), Math.max(0.01, Math.abs(ry)), rot, 0, TAU);
}

export function C(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.01, Math.abs(r)), 0, TAU);
}

export function fs(ctx, fill, stroke, lw = 2) {
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.stroke(); }
}

export function rg(ctx, x, y, r0, x1, y1, r1, stops) {
  const g = ctx.createRadialGradient(x, y, r0, x1, y1, r1);
  for (let i = 0; i < stops.length; i += 2) g.addColorStop(stops[i], stops[i + 1]);
  return g;
}

export function lg(ctx, x0, y0, x1, y1, stops) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (let i = 0; i < stops.length; i += 2) g.addColorStop(stops[i], stops[i + 1]);
  return g;
}

// 3D 感球体填充：左上高光
export function ball(ctx, x, y, r, light, dark, stroke, lw = 2) {
  C(ctx, x, y, r);
  fs(ctx, rg(ctx, x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r * 1.05, [0, light, 1, dark]), stroke, lw);
}

export function oval(ctx, x, y, rx, ry, light, dark, stroke, lw = 2, rot = 0) {
  E(ctx, x, y, rx, ry, rot);
  const r = Math.max(rx, ry);
  fs(ctx, rg(ctx, x - rx * 0.35, y - ry * 0.4, r * 0.1, x, y, r * 1.05, [0, light, 1, dark]), stroke, lw);
}

export function shadow(ctx, x, y, rx, ry = rx * 0.32, a = 0.3) {
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  ctx.fillStyle = rg(ctx, 0, 0, 0, 0, 0, rx, [0, 'rgba(0,0,0,0.9)', 0.55, 'rgba(0,0,0,0.65)', 1, 'rgba(0,0,0,0)']);
  C(ctx, 0, 0, rx);
  ctx.fill();
  ctx.restore();
}

export function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  const rad = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

// 粗描边线条（茎、四肢）：先画深色宽线，再画浅色细线
export function tube(ctx, pts, w, fill, stroke, lw = 2) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    if (pts.length === 4) ctx.lineTo(pts[2], pts[3]);
    else if (pts.length === 6) ctx.quadraticCurveTo(pts[2], pts[3], pts[4], pts[5]);
    else if (pts.length === 8) ctx.bezierCurveTo(pts[2], pts[3], pts[4], pts[5], pts[6], pts[7]);
  };
  if (stroke) { path(); ctx.lineWidth = w + lw * 2; ctx.strokeStyle = stroke; ctx.stroke(); }
  path(); ctx.lineWidth = w; ctx.strokeStyle = fill; ctx.stroke();
}

export function line(ctx, x0, y0, x1, y1, color, w = 2) {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.lineWidth = w;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.stroke();
}

// 卡通眼睛：眼白 + 瞳孔 + 高光
export function eye(ctx, x, y, rx, ry, px = 0, py = 0, o = {}) {
  E(ctx, x, y, rx, ry, o.rot || 0);
  fs(ctx, o.white || '#fff', o.stroke === undefined ? 'rgba(0,0,0,0.75)' : o.stroke, o.lw || 1.4);
  const pr = o.pupil || 0.5;
  E(ctx, x + px, y + py, rx * pr, ry * pr * 1.08);
  ctx.fillStyle = o.pupilColor || '#141414';
  ctx.fill();
  if (o.highlight !== false) {
    C(ctx, x + px - rx * pr * 0.35, y + py - ry * pr * 0.4, Math.max(0.8, rx * pr * 0.35));
    ctx.fillStyle = '#fff';
    ctx.fill();
  }
}

// 闭眼（睡觉）
export function closedEye(ctx, x, y, r, color = '#222', lw = 2) {
  ctx.beginPath();
  ctx.arc(x, y - r * 0.3, r, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.lineWidth = lw;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.stroke();
}

export function leafPath(ctx, len, wid, curl = 0) {
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(len * 0.25, -wid * 1.1, len * 0.75, -wid * (0.9 + curl), len, curl * wid);
  ctx.bezierCurveTo(len * 0.7, wid * (0.8 - curl), len * 0.3, wid * 0.9, 0, 0);
  ctx.closePath();
}

export function leaf(ctx, x, y, ang, len, wid, fill, stroke, o = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  leafPath(ctx, len, wid, o.curl || 0);
  const g = o.flat ? fill : lg(ctx, 0, -wid, 0, wid, [0, o.light || fill, 1, fill]);
  fs(ctx, g, stroke, o.lw || 1.8);
  if (o.vein !== false) {
    ctx.beginPath();
    ctx.moveTo(len * 0.05, 0);
    ctx.quadraticCurveTo(len * 0.5, -wid * 0.15, len * 0.92, (o.curl || 0) * wid);
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = stroke;
    ctx.globalAlpha *= 0.45;
    ctx.stroke();
  }
  ctx.restore();
}

// 描边文字
export function text(ctx, s, x, y, o = {}) {
  const size = o.size || 24;
  ctx.font = `${o.weight || 900} ${size}px ${o.font || FONT}`;
  ctx.textAlign = o.align || 'center';
  ctx.textBaseline = o.baseline || 'middle';
  if (o.shadow) {
    ctx.save();
    ctx.fillStyle = o.shadow;
    const d = o.shadowOffset ?? Math.max(2, size * 0.08);
    if (o.stroke) {
      ctx.lineJoin = 'round';
      ctx.lineWidth = o.lw || size * 0.2;
      ctx.strokeStyle = o.shadow;
      ctx.strokeText(s, x + d, y + d);
    }
    ctx.fillText(s, x + d, y + d);
    ctx.restore();
  }
  if (o.stroke) {
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    ctx.lineWidth = o.lw || size * 0.2;
    ctx.strokeStyle = o.stroke;
    ctx.strokeText(s, x, y);
  }
  ctx.fillStyle = o.color || '#fff';
  ctx.fillText(s, x, y);
}

export function textWidth(ctx, s, size, weight = 900) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  return ctx.measureText(s).width;
}

// 自动换行文本
export function wrapText(ctx, s, x, y, maxW, lineH, o = {}) {
  const size = o.size || 16;
  ctx.font = `${o.weight || 500} ${size}px ${FONT}`;
  const lines = [];
  for (const para of s.split('\n')) {
    let cur = '';
    const noStart = '，。！？、；：）」』”’》…,.!?;:)';
    for (const ch of para) {
      const test = cur + ch;
      // 避头标点：标点不放在行首
      if (ctx.measureText(test).width > maxW && cur && !noStart.includes(ch)) { lines.push(cur); cur = ch; }
      else cur = test;
    }
    lines.push(cur);
  }
  ctx.textAlign = o.align || 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = o.color || '#fff';
  lines.forEach((ln, i) => ctx.fillText(ln, x, y + i * lineH));
  return lines.length * lineH;
}

// 星形 / 光芒
export function star(ctx, x, y, r1, r2, n, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? r1 : r2;
    const a = rot + (i * Math.PI) / n;
    const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

// 平滑闭合曲线（通过点集）
export function blob(ctx, pts) {
  const n = pts.length / 2;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const x0 = pts[((i - 1 + n) % n) * 2], y0 = pts[((i - 1 + n) % n) * 2 + 1];
    const x1 = pts[i * 2], y1 = pts[i * 2 + 1];
    const x2 = pts[((i + 1) % n) * 2], y2 = pts[((i + 1) % n) * 2 + 1];
    const mx0 = (x0 + x1) / 2, my0 = (y0 + y1) / 2;
    const mx1 = (x1 + x2) / 2, my1 = (y1 + y2) / 2;
    if (i === 0) ctx.moveTo(mx0, my0);
    ctx.quadraticCurveTo(x1, y1, mx1, my1);
  }
  ctx.closePath();
}

// 牙齿
export function teeth(ctx, x0, y0, x1, y1, n, h, dir = 1, fill = '#fffbe8', stroke = '#555') {
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = i / n, b = (i + 1) / n, m = (a + b) / 2;
    const ax = x0 + (x1 - x0) * a, ay = y0 + (y1 - y0) * a;
    const bx = x0 + (x1 - x0) * b, by = y0 + (y1 - y0) * b;
    const mx = x0 + (x1 - x0) * m, my = y0 + (y1 - y0) * m;
    ctx.moveTo(ax, ay);
    ctx.lineTo(mx, my + h * dir);
    ctx.lineTo(bx, by);
  }
  fs(ctx, fill, stroke, 1);
}
