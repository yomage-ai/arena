// 标题 / 加载画面：逐帧预渲染背景与图标缓存，草皮卷作为进度条，完成后点击开始。
import { W, H } from '../core/display.js';
import { audio } from '../core/audio.js';
import { music } from '../core/music.js';
import { clamp, Ease, lerp, TAU } from '../core/util.js';
import { getBackground } from '../gfx/bgArt.js';
import { plantIcon, drawLogo } from '../gfx/uiArt.js';
import { PLANT_ORDER } from '../game/defs.js';
import { PLANT_ART } from '../gfx/plantArt.js';
import { drawZombieArt } from '../gfx/zombieArt.js';
import { text, rr, fs, lg, rg, C, E } from '../gfx/paint.js';
import { WORLD_MIN_X } from '../game/layout.js';
import { director } from './director.js';

export class TitleScene {
  constructor(next) {
    this.next = next;
    this.t = 0;
    this.tasks = [
      () => getBackground('night'),
      () => getBackground('day'),
      ...PLANT_ORDER.map(p => () => plantIcon(p, 64)),
    ];
    this.total = this.tasks.length;
    this.done = 0;
    this.progress = 0;
    this.ready = false;
    this.hover = false;
  }

  enter() { music.play('menu'); }

  update(dt) {
    this.t += dt;
    // 每帧执行若干缓存任务
    const start = performance.now();
    while (this.tasks.length && performance.now() - start < 12) {
      this.tasks.shift()();
      this.done++;
    }
    const target = this.done / this.total;
    this.progress = Math.min(target, this.progress + dt * 0.9);
    if (this.progress >= 1 && !this.ready) { this.ready = true; this.readyT = 0; }
    if (this.ready) this.readyT += dt;
  }

  pointerMove(x, y) { this.hover = this.ready && y > 560 && y < 660 && x > 340 && x < 940; }

  pointerDown() {
    if (!this.ready) return;
    audio.init();
    audio.play('button');
    music.resumePending();
    music.play('menu');
    director.go(this.next(), { speed: 2.2 });
  }

  key(k) { if (k === 'Enter' || k === ' ') this.pointerDown(); }

  draw(ctx) {
    const t = this.t;
    const bg = getBackground('day');
    // 背景：缓慢平移的白天草坪
    const cam = 120 + Math.sin(t * 0.15) * 80;
    ctx.drawImage(bg.canvas, (cam - WORLD_MIN_X) * bg.scale, 0, 1280 * bg.scale, 720 * bg.scale, 0, 0, W, H);
    ctx.fillStyle = lg(ctx, 0, 0, 0, H, [0, 'rgba(10,30,5,0.55)', 0.5, 'rgba(10,30,5,0.25)', 1, 'rgba(0,0,0,0.65)']);
    ctx.fillRect(0, 0, W, H);

    // 装饰植物与僵尸
    const deco = [
      { f: 'sunflower', x: 170, y: 540, s: 1.6 },
      { f: 'peashooter', x: 190, y: 700, s: 1.4 },
      { f: 'wallnut', x: 60, y: 690, s: 1.1 },
    ];
    for (const d of deco) {
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.scale(d.s, d.s);
      PLANT_ART[d.f](ctx, { t, phase: d.x, shoot: d.f === 'peashooter' ? ((t % 2) < 0.36 ? (t % 2) / 0.36 : 0) : 0 });
      ctx.restore();
    }
    ctx.save();
    ctx.translate(1080, 640);
    ctx.scale(1.5, 1.5);
    drawZombieArt(ctx, { type: 'cone', t, walkPh: t * 3, anim: 'idle', seed: 1, armorKind: 'cone', armorStage: 0, hasArm: true, hasHead: true });
    ctx.restore();
    ctx.save();
    ctx.translate(1200, 600);
    ctx.scale(1.25, 1.25);
    drawZombieArt(ctx, { type: 'normal', t: t + 3, walkPh: t * 3, anim: 'idle', seed: 4, hasArm: true, hasHead: true });
    ctx.restore();

    // Logo
    const drop = Ease.outBack(clamp(t / 0.9, 0, 1));
    drawLogo(ctx, 640, lerp(-120, 220, drop), 1.25, t);
    text(ctx, 'HTML5 同人复刻版', 640, 330, { size: 26, color: '#fff7c8', stroke: '#3a2a08', lw: 6, weight: 800 });

    // 草皮进度条
    const bx = 360, by = 590, bw = 560, bh = 40;
    rr(ctx, bx - 6, by - 6, bw + 12, bh + 12, 14);
    fs(ctx, lg(ctx, 0, by, 0, by + bh, [0, '#7a5230', 1, '#4a3018']), '#2a1a08', 3);
    const pw = bw * this.progress;
    ctx.save();
    rr(ctx, bx, by, bw, bh, 10);
    ctx.clip();
    ctx.fillStyle = lg(ctx, 0, by, 0, by + bh, [0, '#8ee04e', 1, '#3f8a1c']);
    ctx.fillRect(bx, by, pw, bh);
    ctx.strokeStyle = 'rgba(20,60,10,0.35)';
    ctx.lineWidth = 1.5;
    for (let x = bx + 4; x < bx + pw; x += 7) { ctx.beginPath(); ctx.moveTo(x, by + bh); ctx.lineTo(x + 2, by + bh - 8 - (x % 5)); ctx.stroke(); }
    ctx.restore();
    if (!this.ready) {
      // 滚动中的草皮卷
      const rx = bx + pw;
      ctx.save();
      ctx.translate(rx, by + bh / 2);
      ctx.rotate(this.progress * 30);
      C(ctx, 0, 0, 24 - this.progress * 8);
      fs(ctx, rg(ctx, -4, -4, 2, 0, 0, 26, [0, '#8a5a2a', 0.5, '#6aa83a', 1, '#2f6a18']), '#1f4d0f', 2.5);
      ctx.strokeStyle = 'rgba(40,20,5,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 30; i++) { const a = i * 0.5, r = i * 0.6; const px = Math.cos(a) * r, py = Math.sin(a) * r; if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); }
      ctx.stroke();
      ctx.restore();
      text(ctx, `正在加载…… ${Math.floor(this.progress * 100)}%`, 640, by + bh / 2, { size: 20, color: '#fff', stroke: '#1a2a08', lw: 5 });
    } else {
      const pulse = 1 + Math.sin(this.readyT * 5) * 0.05 + (this.hover ? 0.06 : 0);
      ctx.save();
      ctx.translate(640, by + bh / 2);
      ctx.scale(pulse, pulse);
      text(ctx, '点击这里开始游戏！', 0, 0, { size: 26, color: '#fff8c0', stroke: '#2a4a08', lw: 6 });
      ctx.restore();
    }
    text(ctx, '非官方同人复刻 · 全部美术、音乐与音效均由代码实时生成', 640, 700, { size: 14, color: 'rgba(255,255,255,0.7)', weight: 500 });
  }
}
