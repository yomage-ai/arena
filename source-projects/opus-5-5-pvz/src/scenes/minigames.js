// 小游戏 / 生存模式选择界面。
import { W, H, display } from '../core/display.js';
import { audio } from '../core/audio.js';
import { music } from '../core/music.js';
import { save } from '../core/save.js';
import { getBackground } from '../gfx/bgArt.js';
import { drawPanel, drawTrophy } from '../gfx/uiArt.js';
import { PLANT_ART, bowlnut } from '../gfx/plantArt.js';
import { drawZombieArt } from '../gfx/zombieArt.js';
import { text, rr, fs, lg, wrapText } from '../gfx/paint.js';
import { MINIGAMES, SURVIVAL } from '../game/levels.js';
import { WORLD_MIN_X } from '../game/layout.js';
import { Button, UIGroup } from './ui.js';
import { director } from './director.js';

let Scenes = {};
export function registerMinigameScenes(s) { Scenes = s; }

const ICON = {
  'mg-bowling': ctx => bowlnut(ctx, { roll: 0.3 }, 'normal'),
  'mg-whack': ctx => { ctx.translate(0, 28); ctx.scale(0.62, 0.62); drawZombieArt(ctx, { type: 'cone', t: 0, anim: 'idle', armorKind: 'cone', hasArm: true, hasHead: true }); },
  'mg-vase': ctx => drawVaseIcon(ctx),
  'mg-conveyor': ctx => PLANT_ART.lilypad(ctx, { t: 0, icon: true }),
  'mg-invisible': ctx => { ctx.globalAlpha = 0.35; ctx.translate(0, 20); ctx.scale(0.7, 0.7); drawZombieArt(ctx, { type: 'normal', t: 0, anim: 'idle', hasArm: true, hasHead: true }); },
  'mg-rain': ctx => PLANT_ART.repeater(ctx, { t: 0, icon: true }),
  'sv-day': ctx => PLANT_ART.sunflower(ctx, { t: 0, icon: true }),
  'sv-night': ctx => PLANT_ART.puffshroom(ctx, { t: 0, icon: true }),
  'sv-pool': ctx => PLANT_ART.tanglekelp(ctx, { t: 0, icon: true }),
  'sv-fog': ctx => PLANT_ART.plantern(ctx, { t: 0, icon: true }),
};

export class MinigameScene {
  constructor(kind = 'minigame') {
    this.kind = kind;
    this.list = kind === 'survival' ? SURVIVAL : MINIGAMES;
    this.t = 0;
    this.hover = -1;
    this.ui = new UIGroup();
    this.ui.add(new Button({ x: 24, y: 640, w: 160, h: 56, label: '返回', style: 'stone', onClick: () => director.go(new Scenes.MenuScene()) }));
  }
  enter() { music.play('menu'); }
  update(dt) { this.t += dt; }

  rect(i) {
    const n = this.list.length;
    const cols = 3;
    const col = i % cols, row = Math.floor(i / cols);
    const rows = Math.ceil(n / cols);
    const y0 = rows === 1 ? 230 : 140;
    return { x: 110 + col * 360, y: y0 + row * 230, w: 330, h: 200 };
  }

  at(x, y) {
    for (let i = 0; i < this.list.length; i++) {
      const r = this.rect(i);
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
    }
    return -1;
  }

  pointerMove(x, y) {
    display.setCursor('default');
    this.ui.move(x, y);
    const i = this.at(x, y);
    if (i >= 0 && i !== this.hover) audio.play('hover');
    this.hover = i;
    if (i >= 0) display.setCursor('pointer');
  }
  pointerDown(x, y) {
    if (this.ui.down(x, y)) return;
    const i = this.at(x, y);
    if (i < 0) return;
    audio.play('button');
    director.go(new Scenes.GameScene(this.list[i], { source: this.kind }));
  }
  pointerUp(x, y) { this.ui.up(x, y); }
  key(k) { if (k === 'Escape') director.go(new Scenes.MenuScene()); }

  draw(ctx) {
    const bg = getBackground(this.kind === 'survival' ? 'night' : 'day');
    ctx.drawImage(bg.canvas, (300 - WORLD_MIN_X) * bg.scale, 0, 1280 * bg.scale, 720 * bg.scale, 0, 0, W, H);
    ctx.fillStyle = 'rgba(10,6,20,0.55)';
    ctx.fillRect(0, 0, W, H);
    text(ctx, this.kind === 'survival' ? '生存模式' : '小游戏', 640, 64, { size: 44, color: '#fff3c8', stroke: '#2a1a08', lw: 9 });
    this.list.forEach((L, i) => {
      const r = this.rect(i);
      const hov = this.hover === i;
      ctx.save();
      ctx.translate(0, hov ? -6 : 0);
      drawPanel(ctx, r.x, r.y, r.w, r.h, 'paper');
      // 预览窗
      const px = r.x + 16, py = r.y + 16, pw = 110, ph = 120;
      const eb = getBackground(L.env);
      ctx.save();
      rr(ctx, px, py, pw, ph, 12);
      ctx.clip();
      ctx.drawImage(eb.canvas, (560 - WORLD_MIN_X) * eb.scale, 250 * eb.scale, pw * 2 * eb.scale, ph * 2 * eb.scale, px, py, pw, ph);
      ctx.translate(px + pw / 2, py + ph - 14);
      ICON[L.id]?.(ctx);
      ctx.restore();
      rr(ctx, px, py, pw, ph, 12);
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#5a4418';
      ctx.stroke();
      text(ctx, L.title.replace('生存模式：', ''), r.x + 145, r.y + 38, { size: 24, color: '#4a2a08', align: 'left', weight: 900 });
      wrapText(ctx, L.desc, r.x + 145, r.y + 62, r.w - 160, 22, { size: 16, color: '#5a4020', weight: 600 });
      ctx.strokeStyle = 'rgba(90,60,20,0.25)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(r.x + 16, r.y + r.h - 50); ctx.lineTo(r.x + r.w - 16, r.y + r.h - 50); ctx.stroke();
      if (this.kind === 'survival') {
        const best = save.data.survival[L.id] || 0;
        text(ctx, `最佳成绩：${best} 旗`, r.x + 24, r.y + r.h - 26, { size: 19, color: '#2a6a10', weight: 900, align: 'left' });
      } else if (save.data.minigames[L.id]?.won) {
        drawTrophy(ctx, r.x + 40, r.y + r.h - 8, 0.36, this.t);
        text(ctx, '已完成', r.x + 66, r.y + r.h - 26, { size: 18, color: '#2a6a10', weight: 900, align: 'left' });
      } else {
        text(ctx, '尚未完成', r.x + 24, r.y + r.h - 26, { size: 17, color: '#8a6a40', weight: 700, align: 'left' });
      }
      text(ctx, hov ? '开始挑战 ▶' : '点击开始', r.x + r.w - 24, r.y + r.h - 26, { size: 18, color: hov ? '#c04a10' : '#6a4a20', weight: 900, align: 'right' });
      ctx.restore();
    });
    this.ui.draw(ctx);
  }
}

function drawVaseIcon(ctx) {
  ctx.beginPath();
  ctx.moveTo(-12, -74); ctx.lineTo(12, -74);
  ctx.quadraticCurveTo(10, -64, 20, -56);
  ctx.bezierCurveTo(38, -38, 32, -6, 16, 0);
  ctx.lineTo(-16, 0);
  ctx.bezierCurveTo(-32, -6, -38, -38, -20, -56);
  ctx.quadraticCurveTo(-10, -64, -12, -74);
  ctx.closePath();
  fs(ctx, lg(ctx, -30, 0, 30, 0, [0, '#f0d8b0', 1, '#a87a44']), '#4a3018', 2.5);
  text(ctx, '?', 0, -36, { size: 26, color: 'rgba(90,50,20,0.6)' });
}
