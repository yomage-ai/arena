// 奖励界面：获得新植物 / 奖杯 / 纸条，以及最终通关画面。
import { W, H, display } from '../core/display.js';
import { audio } from '../core/audio.js';
import { music } from '../core/music.js';
import { save } from '../core/save.js';
import { clamp, Ease, TAU, rand } from '../core/util.js';
import { getBackground } from '../gfx/bgArt.js';
import { drawPanel, drawPacket, drawTrophy, drawNote } from '../gfx/uiArt.js';
import { PLANT_ART } from '../gfx/plantArt.js';
import { text, rr, fs, lg, rg, C, wrapText, star } from '../gfx/paint.js';
import { PLANTS, plantHomeEnv } from '../game/defs.js';
import { ADVENTURE, levelIndex } from '../game/levels.js';
import { WORLD_MIN_X } from '../game/layout.js';
import { Button, UIGroup } from './ui.js';
import { director } from './director.js';

let Scenes = {};
export function registerAwardScenes(s) { Scenes = s; }

export class AwardScene {
  constructor(level, reward, o = {}) {
    this.level = level;
    this.reward = reward;
    this.o = o;
    this.t = 0;
    this.ui = new UIGroup();
    this.final = level.id === ADVENTURE[ADVENTURE.length - 1].id && o.source === 'adventure';
    this.confetti = [];
    const idx = levelIndex(level.id);
    const next = o.source === 'adventure' && idx >= 0 ? ADVENTURE[idx + 1] : null;
    if (next) {
      this.ui.add(new Button({ x: 470, y: 600, w: 340, h: 66, label: `继续：关卡 ${next.id}`, style: 'green', fontSize: 28, onClick: () => director.go(new Scenes.GameScene(next, { source: 'adventure' })) }));
      this.ui.add(new Button({ x: 40, y: 640, w: 180, h: 54, label: '返回地图', style: 'stone', fontSize: 22, onClick: () => director.go(new Scenes.LevelSelectScene()) }));
    } else {
      const back = () => {
        if (o.source === 'minigame') director.go(new Scenes.MinigameScene('minigame'));
        else if (o.source === 'survival') director.go(new Scenes.MinigameScene('survival'));
        else if (o.source === 'adventure') director.go(new Scenes.LevelSelectScene());
        else director.go(new Scenes.MenuScene());
      };
      this.ui.add(new Button({ x: 490, y: 600, w: 300, h: 66, label: '继续', style: 'green', fontSize: 30, onClick: back }));
    }
  }

  enter() {
    audio.play('win');
    music.stop(0.2);
    setTimeout(() => music.play('menu'), 2600);
  }

  update(dt) {
    this.t += dt;
    if (this.final || this.reward.type === 'trophy') {
      if (this.confetti.length < 120 && Math.random() < 0.6) {
        this.confetti.push({ x: rand(0, W), y: -20, vx: rand(-30, 30), vy: rand(80, 180), r: rand(0, TAU), vr: rand(-6, 6), c: ['#ff5a5a', '#ffd23a', '#5ad8ff', '#8aff6a', '#ff8af0'][(Math.random() * 5) | 0] });
      }
      for (const p of this.confetti) { p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt; }
      this.confetti = this.confetti.filter(p => p.y < H + 20);
    }
  }

  pointerMove(x, y) { display.setCursor('default'); this.ui.move(x, y); }
  pointerDown(x, y) { this.ui.down(x, y); }
  pointerUp(x, y) { this.ui.up(x, y); }
  key(k) { if (k === 'Enter' || k === ' ') this.ui.items[0]?.onClick(); }

  draw(ctx) {
    const t = this.t;
    ctx.fillStyle = lg(ctx, 0, 0, 0, H, [0, '#fffdf0', 1, '#f0e2b8']);
    ctx.fillRect(0, 0, W, H);
    // 旋转光芒
    ctx.save();
    ctx.translate(640, 300);
    ctx.rotate(t * 0.15);
    for (let i = 0; i < 18; i++) {
      ctx.rotate(TAU / 18);
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(-40, -900); ctx.lineTo(40, -900); ctx.closePath();
      ctx.fillStyle = 'rgba(255,220,120,0.14)';
      ctx.fill();
    }
    ctx.restore();
    const r = this.reward;
    const pop = Ease.outBack(clamp(t / 0.6, 0, 1));
    if (this.final) this.drawFinal(ctx, pop);
    else if (r.type === 'plant') this.drawPlant(ctx, pop);
    else if (r.type === 'note') this.drawNoteReward(ctx, pop);
    else this.drawTrophyReward(ctx, pop);
    for (const p of this.confetti) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.fillStyle = p.c;
      ctx.fillRect(-5, -3, 10, 6);
      ctx.restore();
    }
    this.ui.draw(ctx);
  }

  drawPlant(ctx, pop) {
    const id = this.reward.id;
    const d = PLANTS[id];
    text(ctx, '你得到了一株新植物！', 640, 64, { size: 44, color: '#e8a010', stroke: '#5a2a00', lw: 9, shadow: 'rgba(0,0,0,0.2)' });
    ctx.save();
    ctx.translate(640, 250);
    ctx.scale(pop, pop);
    drawPanel(ctx, -170, -130, 340, 260, 'wood');
    const env = plantHomeEnv(id);
    const bg = getBackground(env);
    ctx.save();
    rr(ctx, -150, -110, 300, 220, 14);
    ctx.clip();
    ctx.drawImage(bg.canvas, (520 - WORLD_MIN_X) * bg.scale, 250 * bg.scale, 300 * bg.scale, 220 * bg.scale, -150, -110, 300, 220);
    ctx.translate(0, 80);
    ctx.scale(1.9, 1.9);
    PLANT_ART[id](ctx, { t: this.t, phase: 0, armed: true, rise: 1, grow: 1, shoot: (this.t % 1.5) < 0.36 ? (this.t % 1.5) / 0.36 : 0 });
    ctx.restore();
    ctx.restore();
    text(ctx, d.name, 640, 420, { size: 40, color: '#4a2a08', weight: 900 });
    ctx.save();
    ctx.globalAlpha = clamp((this.t - 0.4) * 2, 0, 1);
    wrapText(ctx, d.desc, 380, 456, 520, 28, { size: 21, color: '#5a3a10', weight: 700, align: 'left' });
    text(ctx, `花费 ${d.cost} 阳光`, 640, 560, { size: 20, color: '#8a4a10', weight: 900 });
    ctx.restore();
  }

  drawTrophyReward(ctx, pop) {
    text(ctx, this.reward.replay ? '关卡完成！' : '胜利！', 640, 90, { size: 56, color: '#e8a010', stroke: '#5a2a00', lw: 10 });
    ctx.save();
    ctx.translate(640, 380);
    ctx.scale(pop * 2.2, pop * 2.2);
    drawTrophy(ctx, 0, 0, 1, this.t);
    ctx.restore();
    text(ctx, this.level.title || `关卡 ${this.level.id}`, 640, 470, { size: 30, color: '#4a2a08', weight: 900 });
  }

  drawNoteReward(ctx, pop) {
    text(ctx, '你发现了一张纸条！', 640, 70, { size: 46, color: '#e8a010', stroke: '#5a2a00', lw: 9 });
    ctx.save();
    ctx.translate(640, 320);
    ctx.scale(pop, pop);
    ctx.rotate(-0.03);
    rr(ctx, -300, -180, 600, 360, 6);
    fs(ctx, lg(ctx, 0, -180, 0, 180, [0, '#fffef4', 1, '#ece2c0']), '#8a7a50', 2);
    ctx.strokeStyle = 'rgba(80,110,200,0.35)';
    ctx.lineWidth = 1.5;
    for (let y = -130; y < 170; y += 36) { ctx.beginPath(); ctx.moveTo(-270, y); ctx.lineTo(270, y); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(220,80,80,0.4)';
    ctx.beginPath(); ctx.moveTo(-230, -180); ctx.lineTo(-230, 180); ctx.stroke();
    wrapText(ctx, '亲爱的邻居：\n\n' + this.reward.text + '\n\n——僵尸们', -210, -150, 460, 36, { size: 24, color: '#3a3050', weight: 600 });
    ctx.restore();
  }

  drawFinal(ctx, pop) {
    text(ctx, '恭喜你保卫了家园！', 640, 80, { size: 54, color: '#e8a010', stroke: '#5a2a00', lw: 10 });
    ctx.save();
    ctx.translate(640, 330);
    ctx.scale(pop * 2, pop * 2);
    drawTrophy(ctx, 0, 0, 1, this.t);
    ctx.restore();
    const st = save.data.stats;
    const lines = [
      `你已完成全部 ${ADVENTURE.length} 个冒险关卡！`,
      `累计消灭僵尸 ${st.zombiesKilled} 只 · 种下植物 ${st.plantsPlanted} 株 · 收集阳光 ${st.sunCollected}`,
      '小游戏与生存模式已全部开放，继续挑战吧！',
    ];
    lines.forEach((l, i) => text(ctx, l, 640, 430 + i * 38, { size: i === 0 ? 26 : 20, color: '#4a2a08', weight: 800 }));
  }
}
