// 美术画廊（调试用，URL 加 #gallery 进入）：一次性展示全部植物与僵尸的各种状态。
import { W, H } from '../core/display.js';
import { PLANT_ART } from '../gfx/plantArt.js';
import { drawZombieArt } from '../gfx/zombieArt.js';
import { text } from '../gfx/paint.js';
import { getBackground, drawWaterOverlay } from '../gfx/bgArt.js';
import { WORLD_MIN_X } from '../game/layout.js';

export class GalleryScene {
  constructor() { this.t = 0; this.page = 0; }
  update(dt) { this.t += dt; }
  pointerDown() { this.page = (this.page + 1) % 6; }
  draw(ctx) {
    if (this.page >= 3) {
      const env = ['day', 'night', 'pool'][this.page - 3];
      const bg = getBackground(env);
      const camX = this.camX || 0;
      ctx.drawImage(bg.canvas, (camX - WORLD_MIN_X) * bg.scale, 0, 1280 * bg.scale, 720 * bg.scale, 0, 0, 1280, 720);
      ctx.save(); ctx.translate(-camX, 0); drawWaterOverlay(ctx, env, this.t); ctx.restore();
      text(ctx, env, 640, 24, { size: 20, color: '#ff0', stroke: '#000' });
      return;
    }
    ctx.fillStyle = '#5a9a3a';
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 13; i++) for (let j = 0; j < 7; j++) {
      ctx.fillStyle = (i + j) % 2 ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.04)';
      ctx.fillRect(i * 100, j * 110, 100, 110);
    }
    const t = this.t;
    if (this.page === 0) {
      const keys = Object.keys(PLANT_ART);
      keys.forEach((k, i) => {
        const x = 60 + (i % 10) * 122, y = 150 + Math.floor(i / 10) * 175;
        ctx.save();
        ctx.translate(x, y);
        const s = { t, phase: i, shoot: (t * 0.8 + i * 0.1) % 1.6 < 0.4 ? ((t * 0.8 + i * 0.1) % 1.6) / 0.4 : 0, dmg: Math.floor(t / 2) % 3, grow: (t % 4) / 4, rise: Math.min(1, (t % 4)), armed: true, hide: Math.floor(t / 2) % 2 };
        PLANT_ART[k](ctx, s);
        ctx.restore();
        text(ctx, k, x, y + 26, { size: 13, color: '#fff', stroke: '#000', lw: 3 });
      });
    } else if (this.page === 1) {
      const types = ['normal', 'flag', 'cone', 'bucket', 'pole', 'newspaper', 'screendoor', 'football', 'dancer', 'backup', 'ducky', 'snorkel', 'dolphin', 'imp', 'balloon', 'digger', 'pogo', 'jackbox'];
      types.forEach((type, i) => {
        const x = 60 + (i % 9) * 138, y = 260 + Math.floor(i / 9) * 330;
        const anims = ['walk', 'eat', 'idle'];
        const anim = anims[Math.floor(t / 3) % 3];
        const z = {
          type, t, walkPh: t * 4, eatPh: t * 8, anim, seed: i,
          armorKind: { cone: 'cone', bucket: 'bucket', football: 'helmet' }[type],
          armorStage: Math.floor(t / 2) % 3, shieldStage: Math.floor(t / 2) % 3,
          held: { flag: 'flag', newspaper: 'paper', screendoor: 'door', pole: 'pole' }[type],
          hasArm: Math.floor(t / 5) % 2 === 0, hasHead: true, inWater: type === 'ducky',
          ...(type === 'balloon' ? { anim: 'float', held: 'balloon' } : {}), ...(type === 'pogo' ? { anim: 'pogo', held: 'pogo', pogoSquash: Math.max(0, Math.sin(t * 6)) } : {}),
          ...(type === 'jackbox' ? { held: 'jackbox', jackPop: (t % 4) > 3 ? (t % 4) - 3 : 0 } : {}), ...(type === 'digger' ? { held: 'pickaxe' } : {}),
        };
        ctx.save();
        ctx.translate(x, y + (type === 'balloon' ? -40 : type === 'pogo' ? -Math.abs(Math.sin(t * 3)) * 40 : 0));
        drawZombieArt(ctx, z);
        ctx.restore();
        text(ctx, type + ' ' + anim, x, y + 20, { size: 13, color: '#fff', stroke: '#000', lw: 3 });
      });
    } else {
      const list = [
        { type: 'gargantuar', x: 250, y: 600, hasImp: true },
        { type: 'zomboni', x: 700, y: 600 },
        { type: 'dolphin', x: 1050, y: 600, riding: true },
      ];
      for (const d of list) {
        ctx.save();
        ctx.translate(d.x, d.y);
        drawZombieArt(ctx, { ...d, t, walkPh: t * 3, anim: 'walk', smashT: (t % 3) / 3 });
        ctx.restore();
      }
    }
    text(ctx, '点击翻页 ' + (this.page + 1) + '/6', W / 2, 24, { size: 20, color: '#ff0', stroke: '#000' });
  }
}
