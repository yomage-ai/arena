// 着色绘制：把实体先画到离屏画布，再用 source-atop 叠色（受击闪白、冰冻蓝、催眠紫、焦黑）。
import { display } from '../core/display.js';

let scratch = null;
let sctx = null;
let sw = 0, sh = 0;

function ensure(w, h) {
  if (!scratch) {
    scratch = document.createElement('canvas');
    sctx = scratch.getContext('2d');
  }
  if (w > sw || h > sh) {
    sw = Math.max(sw, Math.ceil(w));
    sh = Math.max(sh, Math.ceil(h));
    scratch.width = sw;
    scratch.height = sh;
  }
}

/**
 * @param ctx      目标上下文（已带相机/缩放变换）
 * @param x,y      实体原点（脚底中心）在 ctx 坐标系中的位置
 * @param bw,bh    包围盒（逻辑像素），原点位于包围盒底部中央上方 pad 处
 * @param scale    ctx 当前额外缩放（用于离屏分辨率）
 * @param draw     (c) => void 在原点处绘制实体
 * @param tints    [{color, alpha, op}]
 */
export function drawTinted(ctx, x, y, bw, bh, scale, draw, tints, alpha = 1) {
  const k = display.k * scale;
  const pad = 20;
  const pw = Math.ceil(bw * k), ph = Math.ceil(bh * k);
  ensure(pw, ph);
  sctx.setTransform(1, 0, 0, 1, 0, 0);
  sctx.globalAlpha = 1;
  sctx.globalCompositeOperation = 'source-over';
  sctx.clearRect(0, 0, pw, ph);
  sctx.setTransform(k, 0, 0, k, (bw / 2) * k, (bh - pad) * k);
  draw(sctx);
  sctx.setTransform(1, 0, 0, 1, 0, 0);
  for (const t of tints) {
    sctx.globalCompositeOperation = t.op || 'source-atop';
    sctx.globalAlpha = t.alpha;
    sctx.fillStyle = t.color;
    sctx.fillRect(0, 0, pw, ph);
  }
  sctx.globalCompositeOperation = 'source-over';
  sctx.globalAlpha = 1;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.drawImage(scratch, 0, 0, pw, ph, x - bw / 2, y - (bh - pad), bw, bh);
  ctx.restore();
}
