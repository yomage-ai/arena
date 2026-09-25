// 粒子与特效：豌豆溅射、泥土、烟雾、火焰、冰晶、掉落的僵尸头/手臂/护具、爆炸冲击波、飘字等。
import { TAU, rand, choose, clamp, Ease } from '../core/util.js';
import { E, C, fs, rg, text, star } from './paint.js';

export class Particles {
  constructor() {
    this.list = [];
    this.top = []; // 绘制在最上层的（飘字、闪光）
  }

  add(p, layer = 'normal') {
    p.t = 0;
    p.life = p.life ?? 1;
    p.vx = p.vx ?? 0;
    p.vy = p.vy ?? 0;
    p.rot = p.rot ?? 0;
    p.vr = p.vr ?? 0;
    p.alpha = p.alpha ?? 1;
    (layer === 'top' ? this.top : this.list).push(p);
    return p;
  }

  update(dt) {
    for (const arr of [this.list, this.top]) {
      for (let i = arr.length - 1; i >= 0; i--) {
        const p = arr[i];
        p.t += dt;
        if (p.t >= p.life) { arr.splice(i, 1); continue; }
        if (p.drag) { p.vx *= Math.pow(p.drag, dt * 60); p.vy *= Math.pow(p.drag, dt * 60); }
        p.vy += (p.g || 0) * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        if (p.ground !== undefined && p.y > p.ground) {
          p.y = p.ground;
          if (Math.abs(p.vy) > 60 && (p.bounces ?? 2) > 0) {
            p.vy = -p.vy * (p.bounce ?? 0.35);
            p.vx *= 0.6;
            p.vr *= 0.5;
            p.bounces = (p.bounces ?? 2) - 1;
            p.onBounce?.(p);
          } else { p.vy = 0; p.vx *= 0.8; p.vr *= 0.8; }
        }
        p.update?.(p, dt);
      }
    }
  }

  draw(ctx, layer = 'normal') {
    const arr = layer === 'top' ? this.top : this.list;
    for (const p of arr) {
      const k = p.t / p.life;
      let a = p.alpha;
      if (p.fade !== false) a *= p.fadeIn ? Math.min(1, p.t / p.fadeIn) : 1;
      if (p.fade !== false) a *= k > (p.fadeStart ?? 0.6) ? 1 - (k - (p.fadeStart ?? 0.6)) / (1 - (p.fadeStart ?? 0.6)) : 1;
      if (a <= 0.003) continue;
      ctx.save();
      ctx.globalAlpha *= a;
      if (p.additive) ctx.globalCompositeOperation = 'lighter';
      ctx.translate(p.x, p.y);
      if (p.rot) ctx.rotate(p.rot);
      const size = p.grow ? p.size * (1 + p.grow * k) : p.shrink ? p.size * (1 - k * p.shrink) : p.size;
      switch (p.type) {
        case 'dot':
          C(ctx, 0, 0, size);
          ctx.fillStyle = p.color;
          ctx.fill();
          break;
        case 'glow':
          C(ctx, 0, 0, size);
          ctx.fillStyle = rg(ctx, 0, 0, 0, 0, 0, size, [0, p.color, 1, p.color2 || 'rgba(0,0,0,0)']);
          ctx.fill();
          break;
        case 'blob':
          E(ctx, 0, 0, size, size * (p.squash || 0.8));
          fs(ctx, p.color, p.stroke, 1.2);
          break;
        case 'rect':
          ctx.fillStyle = p.color;
          ctx.fillRect(-size / 2, -size / 2 * (p.aspect || 1), size, size * (p.aspect || 1));
          if (p.stroke) { ctx.strokeStyle = p.stroke; ctx.lineWidth = 1; ctx.strokeRect(-size / 2, -size / 2 * (p.aspect || 1), size, size * (p.aspect || 1)); }
          break;
        case 'shard':
          ctx.beginPath();
          ctx.moveTo(0, -size); ctx.lineTo(size * 0.45, 0); ctx.lineTo(0, size * 0.6); ctx.lineTo(-size * 0.4, 0); ctx.closePath();
          fs(ctx, p.color, p.stroke, 1);
          break;
        case 'ring':
          C(ctx, 0, 0, size);
          ctx.lineWidth = (p.width || 6) * (1 - k);
          ctx.strokeStyle = p.color;
          ctx.stroke();
          break;
        case 'star':
          star(ctx, 0, 0, size, size * 0.45, 4, 0);
          ctx.fillStyle = p.color;
          ctx.fill();
          break;
        case 'text': {
          const sc = p.pop ? 1 + Math.max(0, 0.6 - p.t * 4) : 1;
          ctx.scale(sc, sc);
          text(ctx, p.text, 0, 0, { size: p.size, color: p.color, stroke: p.stroke || '#000', lw: p.lw, weight: 900 });
          break;
        }
        case 'custom':
          p.draw(ctx, p, k);
          break;
      }
      ctx.restore();
    }
  }

  clear() { this.list.length = 0; this.top.length = 0; }

  // ---------- 预设 ----------
  splat(x, y, color = '#7ed84a', n = 7, o = {}) {
    for (let i = 0; i < n; i++) {
      const a = rand(-Math.PI * 0.8, Math.PI * 0.8) + (o.dir < 0 ? 0 : Math.PI);
      const sp = rand(60, 200);
      this.add({ type: 'dot', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, g: 500, size: rand(2, 4.5), color, life: rand(0.25, 0.45), shrink: 0.6 });
    }
    this.add({ type: 'blob', x, y, size: 9, squash: 0.9, color, life: 0.14, grow: 0.8, alpha: 0.9 });
  }

  dirt(x, y, n = 10, spread = 30, color = ['#7a5230', '#5e3c20', '#9a6a3c']) {
    for (let i = 0; i < n; i++) {
      this.add({
        type: 'rect', x: x + rand(-spread, spread), y: y + rand(-6, 2), vx: rand(-90, 90), vy: rand(-280, -80), g: 900,
        size: rand(3, 7), aspect: rand(0.6, 1.2), color: choose(color), rot: rand(TAU), vr: rand(-10, 10), life: rand(0.5, 0.9),
        ground: y + rand(0, 10), bounces: 1,
      });
    }
  }

  smoke(x, y, n = 6, o = {}) {
    for (let i = 0; i < n; i++) {
      this.add({
        type: 'glow', x: x + rand(-20, 20) * (o.spread || 1), y: y + rand(-10, 10), vx: rand(-30, 30), vy: rand(-60, -20),
        size: rand(14, 26) * (o.scale || 1), grow: 1.4, color: o.color || 'rgba(90,90,90,0.55)', life: rand(0.8, 1.4), drag: 0.97,
      });
    }
  }

  sparks(x, y, n = 8, color = '#ffe07a') {
    for (let i = 0; i < n; i++) {
      const a = rand(TAU), sp = rand(80, 260);
      this.add({ type: 'dot', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 300, size: rand(1.5, 3), color, additive: true, life: rand(0.25, 0.5), shrink: 1 });
    }
  }

  fireBurst(x, y, n = 10, scale = 1) {
    for (let i = 0; i < n; i++) {
      const a = rand(TAU), sp = rand(40, 200) * scale;
      this.add({
        type: 'glow', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, drag: 0.93,
        size: rand(10, 22) * scale, shrink: 0.6, color: choose(['rgba(255,200,60,0.95)', 'rgba(255,120,20,0.9)', 'rgba(255,240,160,0.9)']),
        additive: true, life: rand(0.3, 0.6),
      });
    }
  }

  iceShards(x, y, n = 8) {
    for (let i = 0; i < n; i++) {
      const a = rand(TAU), sp = rand(60, 200);
      this.add({ type: 'shard', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, g: 500, size: rand(3, 7), color: '#dff6ff', stroke: '#5ab0e0', rot: rand(TAU), vr: rand(-8, 8), life: rand(0.4, 0.7) });
    }
  }

  floatText(x, y, str, o = {}) {
    return this.add({ type: 'text', x, y, vy: o.vy ?? -40, text: str, size: o.size || 22, color: o.color || '#fff', stroke: o.stroke || '#000', life: o.life || 1.2, pop: o.pop !== false, fadeStart: 0.6 }, 'top');
  }

  shockwave(x, y, r = 80, color = 'rgba(255,240,200,0.8)', life = 0.45) {
    this.add({ type: 'ring', x, y, size: r * 0.2, grow: 4, color, width: 10, life, fade: true }, 'top');
  }

  // 大爆炸：火球 + 冲击波 + 烟雾 + 碎片
  explosion(x, y, scale = 1, o = {}) {
    this.add({ type: 'glow', x, y, size: 90 * scale, color: 'rgba(255,255,230,1)', color2: 'rgba(255,160,40,0)', additive: true, life: 0.3, grow: 0.6 }, 'top');
    this.shockwave(x, y, 120 * scale);
    this.fireBurst(x, y, 26, 1.6 * scale);
    for (let i = 0; i < 14; i++) {
      const a = rand(TAU), sp = rand(40, 180) * scale;
      this.add({
        type: 'glow', x: x + rand(-30, 30) * scale, y: y + rand(-30, 20) * scale, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6 - 60, drag: 0.94,
        size: rand(22, 40) * scale, grow: 1.2, color: choose(['rgba(70,60,55,0.7)', 'rgba(110,100,90,0.6)', 'rgba(40,36,34,0.7)']), life: rand(1, 1.8),
      });
    }
    for (let i = 0; i < 16; i++) {
      this.add({
        type: 'rect', x, y, vx: rand(-260, 260) * scale, vy: rand(-420, -120) * scale, g: 900, size: rand(3, 8), color: choose(['#3a2a1a', '#5a4030', '#222']),
        rot: rand(TAU), vr: rand(-14, 14), life: rand(0.7, 1.2), ground: y + rand(10, 40), bounces: 1,
      });
    }
    if (o.text) {
      this.add({
        type: 'custom', x, y: y - 20 * scale, life: 0.9, fadeStart: 0.5, draw: (ctx, p, k) => {
          const s = Ease.outBack(Math.min(1, k * 4)) * scale;
          ctx.scale(s, s);
          ctx.rotate(-0.08);
          text(ctx, o.text, 0, 0, { size: 44, color: o.textColor || '#ffe23a', stroke: '#6a1000', lw: 9, weight: 900 });
        },
      }, 'top');
    }
  }

  // 掉落物（僵尸头、手臂、护具）：带重力、旋转、弹跳，落地后停留片刻再淡出
  debris(x, y, drawFn, o = {}) {
    return this.add({
      type: 'custom', x, y, vx: o.vx ?? rand(20, 80), vy: o.vy ?? rand(-260, -160), g: 900, rot: o.rot ?? 0, vr: o.vr ?? rand(-6, 6),
      ground: o.ground ?? y + 60, bounce: 0.35, bounces: 2, life: o.life ?? 2.2, fadeStart: 0.75, draw: (ctx) => drawFn(ctx),
      onBounce: o.onBounce,
    });
  }
}
