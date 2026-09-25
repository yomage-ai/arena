// 图鉴：植物 / 僵尸两册，左侧列表，右侧动态展示、属性与趣闻。
import { W, H, display } from '../core/display.js';
import { audio } from '../core/audio.js';
import { music } from '../core/music.js';
import { save } from '../core/save.js';
import { clamp, TAU } from '../core/util.js';
import { getBackground } from '../gfx/bgArt.js';
import { drawPanel, drawPacket, PACKET_W, PACKET_H } from '../gfx/uiArt.js';
import { PLANT_ART } from '../gfx/plantArt.js';
import { drawZombieArt } from '../gfx/zombieArt.js';
import { text, rr, fs, lg, rg, C, E, wrapText } from '../gfx/paint.js';
import { PLANTS, PLANT_ORDER, ZOMBIES, ZOMBIE_ORDER, rechargeLabel, plantHomeEnv } from '../game/defs.js';
import { WORLD_MIN_X } from '../game/layout.js';
import { Button, UIGroup } from './ui.js';
import { director } from './director.js';

let Scenes = {};
export function registerAlmanacScenes(s) { Scenes = s; }

const ZART = {
  cone: { armorKind: 'cone' }, bucket: { armorKind: 'bucket' }, football: { armorKind: 'helmet' },
  flag: { held: 'flag' }, newspaper: { held: 'paper' }, screendoor: { held: 'door' }, pole: { held: 'pole' },
  ducky: { lookType: 'ducky', ducky: true, inWater: true }, gargantuar: { hasImp: true }, dolphin: { riding: true },
  balloon: { held: 'balloon', anim: 'float' }, digger: { held: 'pickaxe' }, pogo: { held: 'pogo' }, jackbox: { held: 'jackbox' },
};

export class AlmanacScene {
  constructor(tab = 'plants') {
    this.tab = tab;
    this.t = 0;
    this.sel = { plants: 'peashooter', zombies: 'normal' };
    this.ui = new UIGroup();
    this.ui.add(new Button({ x: 24, y: 650, w: 150, h: 52, label: '返回', style: 'stone', onClick: () => director.go(new Scenes.MenuScene()) }));
    this.tabBtns = [
      this.ui.add(new Button({ x: 70, y: 26, w: 190, h: 56, label: '植物', style: 'green', onClick: () => this.setTab('plants') })),
      this.ui.add(new Button({ x: 276, y: 26, w: 190, h: 56, label: '僵尸', style: 'stone', onClick: () => this.setTab('zombies') })),
    ];
    this.setTab(tab);
    this.hover = null;
  }

  setTab(t) {
    this.tab = t;
    this.tabBtns[0].style = t === 'plants' ? 'gold' : 'green';
    this.tabBtns[1].style = t === 'zombies' ? 'gold' : 'stone';
  }

  enter() { music.play('select'); }
  update(dt) { this.t += dt; }

  plantRect(i) { return { x: 50 + (i % 7) * 62, y: 106 + Math.floor(i / 7) * 104, w: PACKET_W * 0.86, h: PACKET_H * 0.86 }; }
  zombieRect(i) { return { x: 48 + (i % 5) * 88, y: 106 + Math.floor(i / 5) * 128, w: 82, h: 116 }; }

  itemAt(x, y) {
    if (this.tab === 'plants') {
      for (let i = 0; i < PLANT_ORDER.length; i++) { const r = this.plantRect(i); if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return PLANT_ORDER[i]; }
    } else {
      for (let i = 0; i < ZOMBIE_ORDER.length; i++) { const r = this.zombieRect(i); if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return ZOMBIE_ORDER[i]; }
    }
    return null;
  }

  known(id) { return this.tab === 'plants' ? save.hasPlant(id) : save.data.seenZombies.includes(id); }

  pointerMove(x, y) {
    display.setCursor('default');
    this.ui.move(x, y);
    const it = this.itemAt(x, y);
    this.hover = it && this.known(it) ? it : null;
    if (this.hover) display.setCursor('pointer');
  }
  pointerDown(x, y) {
    if (this.ui.down(x, y)) return;
    const it = this.itemAt(x, y);
    if (it && this.known(it)) { this.sel[this.tab] = it; audio.play('tap'); }
  }
  pointerUp(x, y) { this.ui.up(x, y); }
  key(k) { if (k === 'Escape') director.go(new Scenes.MenuScene()); }

  draw(ctx) {
    ctx.fillStyle = lg(ctx, 0, 0, 0, H, [0, '#2a3a1a', 1, '#101808']);
    ctx.fillRect(0, 0, W, H);
    drawPanel(ctx, 30, 90, 470, 546, 'paper');
    drawPanel(ctx, 520, 24, 736, 676, 'paper');
    if (this.tab === 'plants') this.drawPlants(ctx); else this.drawZombies(ctx);
    this.ui.draw(ctx);
  }

  drawPlants(ctx) {
    PLANT_ORDER.forEach((id, i) => {
      const r = this.plantRect(i);
      if (save.hasPlant(id)) {
        drawPacket(ctx, r.x, r.y, id, { hover: this.hover === id, glow: this.sel.plants === id ? 1 : 0, scale: 0.86 });
      } else {
        rr(ctx, r.x, r.y, r.w, r.h, 6);
        fs(ctx, 'rgba(90,70,30,0.25)', 'rgba(90,70,30,0.4)', 2);
        text(ctx, '?', r.x + r.w / 2, r.y + r.h / 2, { size: 30, color: 'rgba(90,70,30,0.5)' });
      }
    });
    const id = this.sel.plants;
    const d = PLANTS[id];
    this.drawPreview(ctx, plantHomeEnv(id), c => {
      c.scale(1.7, 1.7);
      const s = { t: this.t, phase: 0, armed: true, rise: 1, grow: 1, shoot: (this.t % 1.6) < 0.36 ? (this.t % 1.6) / 0.36 : 0 };
      if (id === 'chomper') s.bite = (this.t % 3) < 0.8 ? (this.t % 3) / 0.8 : 0;
      if (d.kind === 'instant') s.fuse = (Math.sin(this.t * 2) + 1) * 0.15;
      PLANT_ART[id](c, s);
    });
    this.drawInfo(ctx, d.name, d.desc, [
      ...d.stats,
      ['花费', `${d.cost} 阳光`],
      ['冷却', rechargeLabel(d.recharge)],
      ...(d.kind === 'wall' ? [['生命值', String(d.hp)]] : []),
    ], d.lore);
  }

  drawZombies(ctx) {
    ZOMBIE_ORDER.forEach((id, i) => {
      const r = this.zombieRect(i);
      const known = save.data.seenZombies.includes(id);
      rr(ctx, r.x, r.y, r.w, r.h, 10);
      fs(ctx, known ? lg(ctx, 0, r.y, 0, r.y + r.h, [0, '#c8d8b0', 1, '#7a9060']) : 'rgba(90,70,30,0.25)', this.sel.zombies === id ? '#ff8a1a' : 'rgba(90,70,30,0.6)', this.sel.zombies === id ? 4 : 2);
      if (known) {
        ctx.save();
        rr(ctx, r.x, r.y, r.w, r.h, 10);
        ctx.clip();
        const big = id === 'gargantuar' ? 0.46 : id === 'zomboni' ? 0.5 : id === 'imp' ? 1.05 : 0.86;
        const dy = id === 'gargantuar' ? 70 : id === 'zomboni' ? 26 : id === 'imp' ? 58 : 72;
        ctx.translate(r.x + r.w / 2 + 6, r.y + r.h + dy);
        ctx.scale(big, big);
        drawZombieArt(ctx, { type: id === 'ducky' ? 'normal' : id, t: 0, anim: 'idle', hasArm: true, hasHead: true, ...(ZART[id] || {}) });
        ctx.restore();
        if (this.hover === id) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; rr(ctx, r.x, r.y, r.w, r.h, 10); ctx.fillStyle = 'rgba(255,255,200,0.15)'; ctx.fill(); ctx.restore(); }
      } else {
        text(ctx, '?', r.x + r.w / 2, r.y + r.h / 2, { size: 40, color: 'rgba(90,70,30,0.5)' });
      }
    });
    const id = this.sel.zombies;
    const d = ZOMBIES[id];
    const env = d.water || id === 'ducky' ? 'pool' : 'night';
    this.drawPreview(ctx, env, c => {
      const phase = Math.floor(this.t / 3) % 2;
      const sc = id === 'gargantuar' ? 0.8 : id === 'zomboni' ? 0.95 : 1.15;
      c.scale(sc, sc);
      c.translate(0, id === 'gargantuar' ? 20 : 0);
      const extra = ZART[id] || {};
      const bounce = id === 'pogo' ? -Math.abs(Math.sin(this.t * 6)) * 40 : id === 'balloon' ? -8 + Math.sin(this.t * 2) * 5 : 0;
      if (id === 'balloon') c.scale(0.82, 0.82);
      c.translate(0, bounce);
      drawZombieArt(c, {
        type: id === 'ducky' ? 'normal' : id, t: this.t, walkPh: this.t * 4, eatPh: this.t * 8, anim: phase ? 'eat' : 'walk', seed: 1,
        hasArm: true, hasHead: true, ...extra, anim: extra.anim || (id === 'pogo' ? 'pogo' : phase ? 'eat' : 'walk'),
        pogoSquash: id === 'pogo' ? Math.max(0, 1 - Math.abs(Math.sin(this.t * 6)) * 5) : 0,
        jackPop: id === 'jackbox' ? Math.max(0, (this.t % 5) - 4) : 0, smashT: id === 'gargantuar' ? (this.t % 3) / 3 : 0,
      });
    });
    const total = d.hp + (d.armor?.hp || 0) + (d.shield?.hp || 0);
    const tough = total < 300 ? '低' : total < 700 ? '中' : total < 1500 ? '高' : '极高';
    this.drawInfo(ctx, d.name, d.desc, [['韧性', tough], ...d.stats.filter(s => s[0] !== '韧性')], d.lore);
  }

  drawPreview(ctx, env, fn) {
    const x = 560, y = 60, w = 660, h = 270;
    const bg = getBackground(env);
    ctx.save();
    rr(ctx, x, y, w, h, 14);
    ctx.clip();
    ctx.drawImage(bg.canvas, (420 - WORLD_MIN_X) * bg.scale, (env === 'pool' ? 250 : 260) * bg.scale, w * bg.scale, h * bg.scale, x, y, w, h);
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.fillRect(x, y, w, h);
    ctx.translate(x + w / 2, y + h - 40);
    fn(ctx);
    ctx.restore();
    rr(ctx, x, y, w, h, 14);
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#5a4418';
    ctx.stroke();
  }

  drawInfo(ctx, name, desc, stats, lore) {
    const x = 570;
    text(ctx, name, 888, 362, { size: 34, color: '#4a2a08', weight: 900 });
    let y = 396;
    y += wrapText(ctx, desc, x, y, 640, 26, { size: 19, color: '#3a2810', weight: 700 }) + 8;
    for (const [k, v] of stats) {
      text(ctx, k + '：', x, y + 12, { size: 18, color: '#8a3a10', align: 'left', weight: 900 });
      ctx.font = `900 18px sans-serif`;
      text(ctx, v, x + 20 + k.length * 19, y + 12, { size: 18, color: '#3a2810', align: 'left', weight: 700 });
      y += 28;
    }
    y += 8;
    ctx.save();
    ctx.globalAlpha = 0.85;
    wrapText(ctx, lore, x, y, 640, 24, { size: 17, color: '#6a5030', weight: 500 });
    ctx.restore();
  }
}
