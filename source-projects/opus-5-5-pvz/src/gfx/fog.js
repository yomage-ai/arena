// 浓雾：按格子计算雾浓度（路灯花照亮、三叶草吹散、闪电短暂照亮），用预渲染的雾团贴图绘制。
import { mulberry32, TAU, clamp, rand } from '../core/util.js';
import { audio } from '../core/audio.js';
import { LAWN_X, COL_W } from '../game/layout.js';

let sprite = null;
function puffSprite() {
  if (sprite) return sprite;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const r = mulberry32(42);
  for (let i = 0; i < 16; i++) {
    const x = 128 + (r() - 0.5) * 120, y = 128 + (r() - 0.5) * 80, rad = 38 + r() * 46;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, 'rgba(196,202,224,0.5)');
    gr.addColorStop(0.6, 'rgba(180,188,214,0.25)');
    gr.addColorStop(1, 'rgba(170,178,206,0)');
    g.fillStyle = gr;
    g.beginPath();
    g.arc(x, y, rad, 0, TAU);
    g.fill();
  }
  sprite = c;
  return c;
}

export function updateFog(b, dt) {
  const fc = b.fogCols;
  if (b.fogBlowT > 0) b.fogBlowT -= dt;
  if (b.storm && b.running) {
    b.lightningT -= dt;
    if (b.lightningT <= 0) {
      b.lightningT = rand(5, 10);
      b.flashT = 1;
      audio.play('thunder', { delay: 0.2 });
    }
  }
  if (b.flashT > 0) b.flashT = Math.max(0, b.flashT - dt);
  const on = b.running || b.won || b.lost;
  const lights = b.plants.filter(p => p.type === 'plantern' && !p.dead);
  for (let r = 0; r < b.rows; r++) {
    const row = b.fogAmt[r];
    for (let c = 0; c < 12; c++) {
      let target = on && c >= 9 - fc ? 1 : 0;
      if (target && b.fogBlowT > 0) target = 0;
      if (target) for (const L of lights) if (Math.abs(L.col - c) + Math.abs(L.row - r) <= 2) { target = 0; break; }
      const a = row[c];
      const rate = target < a ? 2 : 0.35;
      row[c] = a + clamp(target - a, -rate * dt, rate * dt);
    }
  }
}

export function drawFog(ctx, b, camX) {
  const spr = puffSprite();
  const t = b.time;
  // 闪电时雾被照透
  const reveal = b.flashT > 0 ? clamp(b.flashT / 0.35, 0, 1) * 0.9 : 0;
  ctx.save();
  for (let r = 0; r < b.rows; r++) {
    const y0 = b.rowTop(r), yc = y0 + b.rowH / 2;
    for (let c = 0; c < 12; c++) {
      const a = b.fogAmt[r][c] * (1 - reveal);
      if (a < 0.02) continue;
      const x0 = LAWN_X + c * COL_W;
      ctx.globalAlpha = a * 0.62;
      ctx.fillStyle = '#9aa2bc';
      ctx.fillRect(x0 - 1, y0 - 1, COL_W + 2, b.rowH + 2);
      for (let k = 0; k < 2; k++) {
        const wob = Math.sin(t * 0.35 + r * 1.7 + c * 2.3 + k * 2) * 18;
        const wob2 = Math.cos(t * 0.27 + r * 2.1 + c * 1.3 + k) * 10;
        ctx.globalAlpha = a * 0.9;
        ctx.drawImage(spr, x0 + 50 - 115 + wob + k * 30 - 15, yc - 90 + wob2 - k * 16, 230, 180);
      }
    }
  }
  ctx.restore();
  if (b.flashT > 0.8) {
    ctx.save();
    ctx.globalAlpha = (b.flashT - 0.8) / 0.2 * 0.55;
    ctx.fillStyle = '#eef4ff';
    ctx.fillRect(camX, 0, 1280, 720);
    ctx.restore();
  }
}
