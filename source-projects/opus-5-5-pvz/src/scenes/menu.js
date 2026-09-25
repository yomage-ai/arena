// 主菜单：黄昏墓地场景 + 巨大墓碑菜单，附带设置与帮助弹窗。
import { W, H, display } from '../core/display.js';
import { audio } from '../core/audio.js';
import { music } from '../core/music.js';
import { save } from '../core/save.js';
import { rand, clamp, Ease, lerp, TAU, mulberry32, choose } from '../core/util.js';
import { drawLogo, drawPanel } from '../gfx/uiArt.js';
import { PLANT_ART } from '../gfx/plantArt.js';
import { drawZombieArt } from '../gfx/zombieArt.js';
import { drawTinted } from '../gfx/tint.js';
import { text, rr, fs, lg, rg, C, E, wrapText, star } from '../gfx/paint.js';
import { Button, UIGroup, Slider, Toggle } from './ui.js';
import { director } from './director.js';
import { ADVENTURE } from '../game/levels.js';
import { PLANT_ORDER } from '../game/defs.js';

let Scenes = {};
export function registerMenuScenes(s) { Scenes = s; }

let bgCache = null;
function menuBackground() {
  const k = display.cacheScale;
  if (bgCache && bgCache.scale === k) return bgCache;
  bgCache = display.makeCanvas(W, H, k);
  const ctx = bgCache.ctx;
  const rand2 = mulberry32(99);
  // 天空
  ctx.fillStyle = lg(ctx, 0, 0, 0, 520, [0, '#120c30', 0.45, '#4a2a6a', 0.8, '#b8587a', 1, '#f0a060']);
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 120; i++) {
    ctx.globalAlpha = rand2() * 0.8;
    C(ctx, rand2() * W, rand2() * 300, rand2() * 1.3 + 0.3);
    ctx.fillStyle = '#fff';
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // 月亮
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  C(ctx, 560, 170, 170);
  ctx.fillStyle = rg(ctx, 560, 170, 20, 560, 170, 170, [0, 'rgba(255,230,200,0.45)', 1, 'rgba(255,150,120,0)']);
  ctx.fill();
  ctx.restore();
  C(ctx, 560, 170, 70);
  fs(ctx, rg(ctx, 540, 150, 5, 560, 170, 72, [0, '#fffbe8', 1, '#f0d8b8']));
  ctx.globalAlpha = 0.15;
  for (const [dx, dy, r] of [[-20, -10, 14], [18, 16, 11], [8, -30, 8], [-26, 26, 9], [30, -8, 6]]) { C(ctx, 560 + dx, 170 + dy, r); ctx.fillStyle = '#8a7a6a'; ctx.fill(); }
  ctx.globalAlpha = 1;
  // 远山
  const hill = (y0, amp, col, seed) => {
    const r = mulberry32(seed);
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 40) ctx.lineTo(x, y0 + Math.sin(x * 0.006 + seed) * amp + r() * 12);
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fillStyle = col;
    ctx.fill();
  };
  hill(420, 30, '#2a1a40', 1);
  hill(470, 24, '#1c1430', 2);
  // 枯树
  ctx.strokeStyle = '#0e0a18';
  ctx.lineCap = 'round';
  const branch = (x, y, len, ang, w, d) => {
    if (d <= 0) return;
    const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
    ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
    branch(x2, y2, len * 0.72, ang - 0.45 - rand2() * 0.2, w * 0.65, d - 1);
    branch(x2, y2, len * 0.7, ang + 0.4 + rand2() * 0.25, w * 0.65, d - 1);
  };
  branch(90, 520, 90, -Math.PI / 2 - 0.1, 16, 7);
  // 墓地剪影
  for (let i = 0; i < 12; i++) {
    const x = 60 + i * 110 + rand2() * 40, y = 480 + rand2() * 30, h = 30 + rand2() * 26;
    ctx.fillStyle = '#140e22';
    ctx.beginPath();
    if (i % 3 === 0) { ctx.rect(x - 4, y - h, 8, h); ctx.rect(x - 14, y - h + 10, 28, 8); }
    else { ctx.moveTo(x - 14, y); ctx.lineTo(x - 14, y - h + 12); ctx.quadraticCurveTo(x, y - h - 6, x + 14, y - h + 12); ctx.lineTo(x + 14, y); }
    ctx.fill();
  }
  // 房子剪影（左）
  ctx.fillStyle = '#0c0816';
  ctx.beginPath();
  ctx.moveTo(-10, 560); ctx.lineTo(-10, 360); ctx.lineTo(90, 290); ctx.lineTo(200, 360); ctx.lineTo(200, 560); ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffcf6a';
  ctx.fillRect(40, 400, 36, 44);
  ctx.fillRect(120, 400, 36, 44);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const x of [58, 138]) { C(ctx, x, 422, 60); ctx.fillStyle = rg(ctx, x, 422, 5, x, 422, 60, [0, 'rgba(255,190,80,0.35)', 1, 'rgba(255,150,40,0)']); ctx.fill(); }
  ctx.restore();
  // 前景草地
  ctx.fillStyle = lg(ctx, 0, 520, 0, H, [0, '#1e3a1a', 1, '#0c1a0a']);
  ctx.beginPath();
  ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 30) ctx.lineTo(x, 540 + Math.sin(x * 0.01) * 10);
  ctx.lineTo(W, H);
  ctx.fill();
  for (let i = 0; i < 400; i++) {
    const x = rand2() * W, y = 550 + rand2() * 170;
    ctx.strokeStyle = `rgba(${60 + rand2() * 40},${110 + rand2() * 60},${50},${0.3 + rand2() * 0.3})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + rand2() * 4 - 2, y - 6 - rand2() * 8); ctx.stroke();
  }
  return bgCache;
}

function drawTombstone(ctx, x, y, w, h) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  E(ctx, x + w / 2, y + h, w * 0.62, 26);
  ctx.fill();
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x + 6, y + 150);
    ctx.bezierCurveTo(x + 10, y - 20, x + w - 10, y - 20, x + w - 6, y + 150);
    ctx.lineTo(x + w, y + h);
    ctx.closePath();
  };
  path();
  fs(ctx, lg(ctx, x, y, x + w, y + h, [0, '#a4a8b4', 0.5, '#737886', 1, '#4a4e5a']), '#15161c', 4);
  ctx.save();
  path();
  ctx.clip();
  // 石纹 / 裂缝 / 青苔
  const r = mulberry32(7);
  ctx.strokeStyle = 'rgba(20,20,30,0.3)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 7; i++) {
    let px = x + r() * w, py = y + 60 + r() * (h - 80);
    ctx.beginPath(); ctx.moveTo(px, py);
    for (let k = 0; k < 4; k++) { px += r() * 30 - 15; py += r() * 26; ctx.lineTo(px, py); }
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(70,120,60,0.45)';
  for (let i = 0; i < 14; i++) { E(ctx, x + r() * w, y + h - r() * 60, 10 + r() * 20, 5 + r() * 8); ctx.fill(); }
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(x, y, w * 0.18, h);
  ctx.restore();
  // 墓碑顶部刻字
  text(ctx, '欢迎回来', x + w / 2, y + 62, { size: 26, color: 'rgba(30,30,40,0.55)', weight: 900 });
  ctx.restore();
}

export class MenuScene {
  constructor() {
    this.t = 0;
    this.ui = new UIGroup();
    this.overlay = null;
    this.overlayUI = new UIGroup();
    this.hands = [];
    this.handT = 1;
    this.flies = Array.from({ length: 26 }, () => ({ x: rand(0, W), y: rand(300, 700), p: rand(0, TAU), s: rand(0.5, 1.4) }));
    this.walker = { x: 1400, row: 0, t: 0 };
    const adv = save.data.adventure;
    const tx = 760, tw = 400;
    const next = ADVENTURE[Math.min(adv, ADVENTURE.length - 1)];
    this.advBtn = this.ui.add(new Button({ x: tx + 30, y: 206, w: tw - 60, h: 84, label: '冒险模式', style: 'stone', fontSize: 36, onClick: () => director.go(new Scenes.LevelSelectScene()) }));
    this.advSub = adv >= ADVENTURE.length ? '已通关！' : `关卡 ${next.id}`;
    const mgLocked = adv < 5;
    const svLocked = adv < 10;
    this.ui.add(new Button({ x: tx + 40, y: 340, w: tw - 80, h: 68, label: mgLocked ? '小游戏（通关 1-5 解锁）' : '小游戏', style: 'stone', fontSize: mgLocked ? 21 : 30, disabled: mgLocked, onClick: () => director.go(new Scenes.MinigameScene('minigame')) }));
    this.ui.add(new Button({ x: tx + 40, y: 424, w: tw - 80, h: 68, label: svLocked ? '生存模式（通关 1-10 解锁）' : '生存模式', style: 'stone', fontSize: svLocked ? 21 : 30, disabled: svLocked, onClick: () => director.go(new Scenes.MinigameScene('survival')) }));
    this.ui.add(new Button({ x: tx + 40, y: 508, w: tw - 80, h: 68, label: '图鉴', style: 'stone', fontSize: 30, onClick: () => director.go(new Scenes.AlmanacScene()) }));
    this.ui.add(new Button({ x: 30, y: 640, w: 120, h: 52, label: '设置', style: 'wood', fontSize: 22, onClick: () => this.openSettings() }));
    this.ui.add(new Button({ x: 164, y: 640, w: 120, h: 52, label: '帮助', style: 'wood', fontSize: 22, onClick: () => this.openHelp() }));
    this.ui.add(new Button({ x: 298, y: 640, w: 120, h: 52, label: '全屏', style: 'wood', fontSize: 22, onClick: () => this.fullscreen() }));
  }

  enter() { music.play('menu'); }

  fullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.();
  }

  openSettings() {
    this.overlay = 'settings';
    const s = save.settings;
    const ui = this.overlayUI;
    ui.clear();
    ui.add(new Slider({ x: 580, y: 250, w: 260, label: '音乐音量', value: s.music, onChange: v => { s.music = v; audio.applyVolumes(); save.write(); } }));
    ui.add(new Slider({ x: 580, y: 305, w: 260, label: '音效音量', value: s.sfx, onChange: v => { s.sfx = v; audio.applyVolumes(); save.write(); } }));
    ui.add(new Toggle({ x: 580, y: 360, label: '自动收集阳光', value: s.autoCollect, onChange: v => { s.autoCollect = v; save.write(); } }));
    ui.add(new Toggle({ x: 800, y: 360, label: '显示血量条', value: s.healthBars, onChange: v => { s.healthBars = v; save.write(); } }));
    ui.add(new Button({ x: 400, y: 410, w: 230, h: 50, label: '解锁全部内容', style: 'purple', fontSize: 20, onClick: () => this.confirm('解锁全部关卡与植物？', () => { save.unlockAll(ADVENTURE.length, PLANT_ORDER); director.go(new MenuScene()); }) }));
    ui.add(new Button({ x: 650, y: 410, w: 230, h: 50, label: '重置存档', style: 'red', fontSize: 20, onClick: () => this.confirm('确定要清空全部进度吗？', () => { save.reset(); director.go(new MenuScene()); }) }));
    ui.add(new Button({ x: 540, y: 490, w: 200, h: 56, label: '完成', style: 'green', onClick: () => { this.overlay = null; } }));
  }

  confirm(msg, yes) {
    this.overlay = 'confirm';
    this.confirmMsg = msg;
    const ui = this.overlayUI;
    ui.clear();
    ui.add(new Button({ x: 450, y: 400, w: 170, h: 56, label: '确定', style: 'red', onClick: () => { this.overlay = null; yes(); } }));
    ui.add(new Button({ x: 660, y: 400, w: 170, h: 56, label: '取消', style: 'stone', onClick: () => this.openSettings() }));
  }

  openHelp() {
    this.overlay = 'help';
    const ui = this.overlayUI;
    ui.clear();
    ui.add(new Button({ x: 540, y: 600, w: 200, h: 56, label: '知道了', style: 'green', onClick: () => { this.overlay = null; } }));
  }

  update(dt) {
    this.t += dt;
    this.handT -= dt;
    if (this.handT <= 0) {
      this.handT = rand(1.2, 3);
      this.hands.push({ x: rand(40, 700), y: rand(580, 700), t: 0, life: rand(2.5, 4), s: rand(0.7, 1.1) });
    }
    for (const h of this.hands) h.t += dt;
    this.hands = this.hands.filter(h => h.t < h.life);
    for (const f of this.flies) { f.p += dt * f.s; f.x += Math.cos(f.p * 0.7) * 12 * dt; f.y += Math.sin(f.p) * 10 * dt; }
    this.walker.t += dt;
    this.walker.x -= 14 * dt;
    if (this.walker.x < -100) this.walker.x = 1400;
  }

  pointerMove(x, y) {
    display.setCursor('default');
    if (this.overlay) { this.overlayUI.move(x, y); return; }
    this.ui.move(x, y);
  }
  pointerDown(x, y) {
    if (this.overlay) { this.overlayUI.down(x, y); return; }
    this.ui.down(x, y);
    // 点击手 = 小彩蛋
    for (const h of this.hands) if (Math.abs(h.x - x) < 30 && Math.abs(h.y - 30 - y) < 40) { h.t = h.life; audio.play('whack'); }
  }
  pointerUp(x, y) {
    if (this.overlay) { this.overlayUI.up(x, y); return; }
    this.ui.up(x, y);
  }
  key(k) { if (k === 'Escape' && this.overlay) this.overlay = null; }

  draw(ctx) {
    const t = this.t;
    const bg = menuBackground();
    ctx.drawImage(bg.canvas, 0, 0, W, H);
    // 飘过月亮的云
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const x = ((t * 12 + i * 500) % 1700) - 250, y = 140 + i * 40;
      ctx.globalAlpha = 0.35;
      for (let k = 0; k < 5; k++) { E(ctx, x + k * 40, y + Math.sin(k) * 8, 50, 16); ctx.fillStyle = '#2a1a44'; ctx.fill(); }
    }
    ctx.restore();
    // 远处缓慢行走的僵尸
    const wk = this.walker;
    drawTinted(ctx, wk.x, 500, 130, 110, 1, c => {
      c.scale(0.5, 0.5);
      drawZombieArt(c, { type: 'normal', t: wk.t, walkPh: wk.t * 3, anim: 'walk', hasArm: true, hasHead: true });
    }, [{ color: '#170f28', alpha: 0.92 }]);
    // 地里伸出的手
    for (const h of this.hands) {
      const k = h.t / h.life;
      const up = k < 0.25 ? Ease.outBack(k / 0.25) : k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
      ctx.save();
      ctx.translate(h.x, h.y);
      ctx.scale(h.s, h.s);
      ctx.beginPath();
      ctx.rect(-40, -120, 80, 120);
      ctx.clip();
      ctx.translate(0, (1 - up) * 70);
      ctx.rotate(Math.sin(h.t * 6) * 0.15);
      drawHand(ctx);
      ctx.restore();
      E(ctx, h.x, h.y, 26 * h.s, 7 * h.s);
      ctx.fillStyle = '#2a1a0a';
      ctx.fill();
    }
    // 萤火虫
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const f of this.flies) {
      const a = 0.4 + 0.6 * Math.abs(Math.sin(f.p * 2));
      C(ctx, f.x, f.y, 7);
      ctx.fillStyle = rg(ctx, f.x, f.y, 0, f.x, f.y, 7, [0, `rgba(230,255,120,${a})`, 1, 'rgba(200,255,80,0)']);
      ctx.fill();
    }
    ctx.restore();
    // 前景植物
    const deco = [{ f: 'sunflower', x: 500, y: 668, s: 1.35 }, { f: 'peashooter', x: 632, y: 688, s: 1.3 }, { f: 'puffshroom', x: 712, y: 690, s: 1.1 }, { f: 'wallnut', x: 390, y: 690, s: 1.05 }];
    for (const d of deco) {
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.scale(d.s, d.s);
      PLANT_ART[d.f](ctx, { t, phase: d.x });
      ctx.restore();
    }
    drawLogo(ctx, 360, 150, 0.95, t);
    // 墓碑菜单
    drawTombstone(ctx, 760, 120, 400, 580);
    this.ui.draw(ctx);
    text(ctx, this.advSub, this.advBtn.x + this.advBtn.w / 2, this.advBtn.y + this.advBtn.h + 18, { size: 18, color: '#f8f0c8', stroke: '#1a1a20', lw: 5 });
    const st = save.data.stats;
    text(ctx, `已消灭僵尸 ${st.zombiesKilled}   ·   收集阳光 ${st.sunCollected}   ·   已解锁植物 ${save.data.plants.length}/${PLANT_ORDER.length}`, 640, 710, { size: 14, color: 'rgba(255,255,255,0.6)', weight: 600 });

    if (this.overlay) this.drawOverlay(ctx);
  }

  drawOverlay(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, W, H);
    if (this.overlay === 'settings') {
      drawPanel(ctx, 360, 150, 560, 430, 'stone');
      text(ctx, '设置', 640, 196, { size: 36, color: '#e8f0d8', stroke: '#1a1c20', lw: 8 });
    } else if (this.overlay === 'confirm') {
      drawPanel(ctx, 400, 240, 480, 250, 'stone');
      text(ctx, this.confirmMsg, 640, 320, { size: 26, color: '#fff', stroke: '#1a1c20', lw: 6 });
    } else if (this.overlay === 'help') {
      drawPanel(ctx, 240, 70, 800, 610, 'paper');
      text(ctx, '游戏帮助', 640, 118, { size: 36, color: '#5a3a10', weight: 900 });
      const lines = [
        '· 点击上方的种子卡片，再点击草坪即可种下植物，每种植物都需要消耗阳光。',
        '· 点击天空落下或向日葵产出的阳光来收集，阳光是种植植物的唯一货币。',
        '· 种子卡片用完后需要冷却一段时间才能再次使用。',
        '· 用铲子可以挖掉不需要的植物；右键或 Esc 可以放下手中的卡片。',
        '· 每一行最左侧都有一台割草机，僵尸靠近房子时会自动启动，但只能用一次！',
        '· 蘑菇在白天会睡觉，可以用咖啡豆唤醒它们。',
        '· 水面上需要先种睡莲，才能种下其他陆地植物。',
        '· 「一大波僵尸」来袭前会有提示，提前做好准备！',
        '',
        '快捷键：数字键 1-0 选卡 · S 铲子 · 空格/Esc 暂停 · X 切换倍速 · F 全屏',
      ];
      lines.forEach((ln, i) => text(ctx, ln, 290, 178 + i * 40, { size: 19, color: '#3a2a10', weight: 600, align: 'left' }));
    }
    this.overlayUI.draw(ctx);
  }
}

function drawHand(ctx) {
  const skin = '#8aa278', stroke = '#2a3420';
  ctx.beginPath();
  ctx.moveTo(-8, 10); ctx.lineTo(-7, -40); ctx.lineTo(7, -40); ctx.lineTo(8, 10); ctx.closePath();
  fs(ctx, '#5a4632', '#1a120a', 2);
  E(ctx, 0, -50, 14, 13);
  fs(ctx, skin, stroke, 2);
  for (const [dx, ang, len] of [[-10, -0.5, 18], [-4, -0.15, 22], [3, 0.1, 22], [9, 0.4, 18]]) {
    ctx.save();
    ctx.translate(dx, -58);
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(-3, 0); ctx.lineTo(-2.5, -len); ctx.quadraticCurveTo(0, -len - 4, 2.5, -len); ctx.lineTo(3, 0); ctx.closePath();
    fs(ctx, skin, stroke, 1.6);
    ctx.restore();
  }
}
