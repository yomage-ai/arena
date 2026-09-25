// 冒险模式选关：白天 / 黑夜 / 泳池三个区域，每区 10 关。
import { W, H, display } from '../core/display.js';
import { audio } from '../core/audio.js';
import { music } from '../core/music.js';
import { save } from '../core/save.js';
import { clamp, Ease, TAU } from '../core/util.js';
import { getBackground } from '../gfx/bgArt.js';
import { drawPanel, drawPacket, drawTrophy, drawNote } from '../gfx/uiArt.js';
import { text, rr, fs, lg, rg, C, E } from '../gfx/paint.js';
import { ADVENTURE } from '../game/levels.js';
import { PLANTS } from '../game/defs.js';
import { WORLD_MIN_X } from '../game/layout.js';
import { Button, UIGroup } from './ui.js';
import { director } from './director.js';

let Scenes = {};
export function registerLevelScenes(s) { Scenes = s; }

const ZONES = [
  { env: 'day', name: '白天', color: '#6cc93a' },
  { env: 'night', name: '黑夜', color: '#7a6ad8' },
  { env: 'pool', name: '泳池', color: '#3ab4e0' },
  { env: 'fog', name: '浓雾', color: '#6a8aa8' },
];

export class LevelSelectScene {
  constructor(zone) {
    const adv = save.data.adventure;
    this.zone = zone ?? Math.min(ZONES.length - 1, Math.floor(Math.min(adv, ADVENTURE.length - 1) / 10));
    this.t = 0;
    this.ui = new UIGroup();
    this.hover = -1;
    this.ui.add(new Button({ x: 24, y: 640, w: 160, h: 56, label: '返回', style: 'stone', onClick: () => director.go(new Scenes.MenuScene()) }));
    this.tabs = ZONES.map((z, i) => this.ui.add(new Button({
      x: 300 + i * 176, y: 22, w: 164, h: 60, label: z.name, style: i === this.zone ? 'gold' : 'wood', fontSize: 26,
      disabled: adv < i * 10, onClick: () => { this.zone = i; this.refreshTabs(); },
    })));
  }

  refreshTabs() { this.tabs.forEach((b, i) => { b.style = i === this.zone ? 'gold' : 'wood'; }); }

  enter() { music.play('menu'); }

  cardRect(i) {
    const col = i % 5, row = Math.floor(i / 5);
    return { x: 110 + col * 218, y: 150 + row * 230, w: 186, h: 200 };
  }

  update(dt) { this.t += dt; }

  levelAt(x, y) {
    for (let i = 0; i < 10; i++) {
      const r = this.cardRect(i);
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
    }
    return -1;
  }

  pointerMove(x, y) {
    display.setCursor('default');
    this.ui.move(x, y);
    const i = this.levelAt(x, y);
    const idx = this.zone * 10 + i;
    const ok = i >= 0 && idx <= save.data.adventure;
    if (ok && this.hover !== i) audio.play('hover');
    this.hover = ok ? i : -1;
    if (ok) display.setCursor('pointer');
  }

  pointerDown(x, y) {
    if (this.ui.down(x, y)) return;
    const i = this.levelAt(x, y);
    if (i < 0) return;
    const idx = this.zone * 10 + i;
    if (idx > save.data.adventure) { audio.play('buzzer'); return; }
    audio.play('button');
    director.go(new Scenes.GameScene(ADVENTURE[idx], { source: 'adventure' }));
  }

  pointerUp(x, y) { this.ui.up(x, y); }
  key(k) { if (k === 'Escape') director.go(new Scenes.MenuScene()); }

  draw(ctx) {
    const z = ZONES[this.zone];
    const bg = getBackground(z.env);
    ctx.drawImage(bg.canvas, (200 - WORLD_MIN_X) * bg.scale, 0, 1280 * bg.scale, 720 * bg.scale, 0, 0, W, H);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, W, H);
    text(ctx, '冒险模式', 150, 52, { size: 34, color: '#fff3c8', stroke: '#2a1a08', lw: 7 });
    const adv = save.data.adventure;
    for (let i = 0; i < 10; i++) {
      const idx = this.zone * 10 + i;
      const L = ADVENTURE[idx];
      const r = this.cardRect(i);
      const locked = idx > adv;
      const done = !!save.data.completed[L.id];
      const current = idx === adv;
      const hov = this.hover === i;
      const lift = hov ? -6 : current ? Math.sin(this.t * 4) * 3 : 0;
      ctx.save();
      ctx.translate(0, lift);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      rr(ctx, r.x + 4, r.y + 8 - lift, r.w, r.h, 18);
      ctx.fill();
      rr(ctx, r.x, r.y, r.w, r.h, 18);
      const cols = locked ? ['#5a5e66', '#3a3e44'] : [z.color, '#2a3a1a'];
      fs(ctx, lg(ctx, 0, r.y, 0, r.y + r.h, [0, locked ? cols[0] : shadeMix(z.color), 1, locked ? cols[1] : darkMix(z.color)]), current ? '#fff27a' : '#141410', current ? 4 : 3);
      rr(ctx, r.x + 10, r.y + 10, r.w - 20, r.h - 64, 12);
      fs(ctx, 'rgba(0,0,0,0.25)');
      text(ctx, L.id, r.x + r.w / 2, r.y + r.h - 30, { size: 30, color: locked ? '#9a9a9a' : '#fff', stroke: '#1a1a1a', lw: 6 });
      if (L.title) text(ctx, L.title, r.x + r.w / 2, r.y + r.h - 58, { size: 14, color: '#ffe8a0', stroke: '#1a1a1a', lw: 4 });
      const cx = r.x + r.w / 2, cy = r.y + 72;
      if (locked) {
        drawLock(ctx, cx, cy);
      } else if (L.reward?.type === 'plant') {
        const own = save.hasPlant(L.reward.id);
        ctx.save();
        ctx.globalAlpha = own && done ? 0.55 : 1;
        drawPacket(ctx, cx - 27, cy - 44, L.reward.id, { scale: 0.88, noCost: true });
        ctx.restore();
      } else if (L.reward?.type === 'trophy') drawTrophy(ctx, cx, cy + 34, 0.8, this.t);
      else drawNote(ctx, cx, cy + 34, 0.9);
      if (done) {
        C(ctx, r.x + r.w - 22, r.y + 22, 16);
        fs(ctx, lg(ctx, 0, r.y + 6, 0, r.y + 38, [0, '#9ef05a', 1, '#3a8a1a']), '#143a06', 2.5);
        ctx.beginPath();
        ctx.moveTo(r.x + r.w - 30, r.y + 22); ctx.lineTo(r.x + r.w - 24, r.y + 29); ctx.lineTo(r.x + r.w - 13, r.y + 15);
        ctx.lineWidth = 3.5; ctx.strokeStyle = '#fff'; ctx.lineCap = 'round'; ctx.stroke();
      }
      ctx.restore();
    }
    const nextIdx = Math.min(adv, ADVENTURE.length - 1);
    text(ctx, adv >= ADVENTURE.length ? '恭喜！冒险模式已全部通关，可以随时重玩任意关卡。' : `下一关：${ADVENTURE[nextIdx].id}${ADVENTURE[nextIdx].reward?.type === 'plant' ? '，奖励「' + PLANTS[ADVENTURE[nextIdx].reward.id].name + '」' : ''}`, 740, 668, { size: 20, color: '#fff', stroke: '#000', lw: 5 });
    this.ui.draw(ctx);
  }
}

function shadeMix(c) { return c; }
function darkMix(c) { return '#1e2a14'; }

function drawLock(ctx, x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.arc(0, -8, 16, Math.PI, 0);
  ctx.lineWidth = 7;
  ctx.strokeStyle = '#8a8e96';
  ctx.stroke();
  rr(ctx, -24, -8, 48, 40, 7);
  fs(ctx, lg(ctx, 0, -8, 0, 32, [0, '#e0b040', 1, '#9a6a10']), '#3a2400', 2.5);
  C(ctx, 0, 8, 5);
  ctx.fillStyle = '#3a2400';
  ctx.fill();
  ctx.fillRect(-2, 8, 4, 12);
  ctx.restore();
}
