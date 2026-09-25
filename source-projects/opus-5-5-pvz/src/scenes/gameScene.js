// 游戏场景：开场镜头 → 选卡 → 准备/就绪/种植 → 战斗 → 胜利掉落奖励 / 僵尸吃掉你的脑子。
// 同时负责 HUD（种子槽、阳光、铲子、进度条、菜单）、传送带、锤子、砸罐子、种子雨等特殊玩法。
import { W, H, display } from '../core/display.js';
import { audio } from '../core/audio.js';
import { music } from '../core/music.js';
import { save } from '../core/save.js';
import { rand, clamp, lerp, Ease, choose, weightedChoice, TAU, shuffle } from '../core/util.js';
import { Board } from '../game/board.js';
import { PLANTS, PLANT_ORDER, ZOMBIES } from '../game/defs.js';
import { ADVENTURE, slotsFor, levelIndex } from '../game/levels.js';
import { LAWN_X, LAWN_TOP, COL_W, COLS, LAWN_RIGHT, colX, envInfo } from '../game/layout.js';
import { PLANT_ART, bowlnut } from '../gfx/plantArt.js';
import { drawPacket, drawSeedBank, drawShovelBox, drawShovel, drawSun, drawPanel, PACKET_W, PACKET_H, drawTrophy, drawNote } from '../gfx/uiArt.js';
import { text, rr, fs, lg, rg, C, E, wrapText, FONT, star } from '../gfx/paint.js';
import { Button, UIGroup, Slider, Toggle } from './ui.js';
import { director } from './director.js';
import { Zombie } from '../game/zombie.js';
import { Reward } from '../game/items.js';

const BANK_X = 8, BANK_Y = 4;
const PGAP = 6;
const slotX = i => BANK_X + 96 + i * (PACKET_W + PGAP);
const SLOT_Y = BANK_Y + 6;

let Scenes = {}; // 由 main 注入，避免循环依赖
export function registerScenes(s) { Scenes = s; }

export class GameScene {
  constructor(level, o = {}) {
    this.level = level;
    this.o = o;
    this.board = new Board(this, level);
    this.mode = this.board.mode;
    this.t = 0;
    this.camX = 0;
    this.camTween = null;
    this.phase = 'intro';
    this.phaseT = 0;
    this.maxSlots = slotsFor(level);
    this.slots = [];
    this.held = null;
    this.mx = -100;
    this.my = -100;
    this.paused = false;
    this.messages = [];
    this.hudSlide = 0;
    this.sunFlash = 0;
    this.sunPulseT = 0;
    this.speed = save.settings.speed || 1;
    this.ui = new UIGroup();
    this.pauseUI = new UIGroup();
    this.endUI = new UIGroup();
    this.looseSeeds = [];
    this.malletT = 1;
    this.belt = null;
    this.hint = null;
    this.tutorialStep = 0;
    this.selectAnims = [];
    this.flagsSurvived = 0;
    this.chosen = [];
    this.menuBtn = new Button({ x: 1132, y: 6, w: 140, h: 46, label: '菜单', style: 'green', onClick: () => this.pause() });
    this.speedBtn = new Button({ x: 1060, y: 6, w: 64, h: 46, label: this.speed === 2 ? '×2' : '×1', style: 'wood', fontSize: 20, onClick: () => this.toggleSpeed() });
    this.ui.add(this.menuBtn);
    this.ui.add(this.speedBtn);

    this.useBelt = ['conveyor', 'bowling'].includes(this.mode) && !level.rain;
    this.rain = !!level.rain;
    this.fixedSeeds = this.computeFixedSeeds();
    if (this.fixedSeeds) this.maxSlots = Math.max(1, this.fixedSeeds.length);
    else this.maxSlots = Math.min(this.maxSlots, Math.max(1, PLANT_ORDER.filter(t => save.hasPlant(t)).length));
    this.needSelect = !this.fixedSeeds && !this.useBelt && !this.rain && this.mode !== 'vase';
    if (!this.needSelect && this.fixedSeeds) this.setSlots(this.fixedSeeds);
    if (this.useBelt || this.rain) this.initBelt();
    if (this.mode === 'vase') this.initVases();
    if (this.mode === 'whack') { this.board.sun = 150; }
  }

  computeFixedSeeds() {
    const L = this.level;
    if (L.plants) return L.plants;
    if (this.mode === 'whack') {
      const want = ['cherrybomb', 'gravebuster', 'iceshroom', 'wallnut'];
      return want.filter(t => save.hasPlant(t)).slice(0, 3);
    }
    if (this.useBelt || this.rain || this.mode === 'vase') return null;
    const avail = PLANT_ORDER.filter(t => save.hasPlant(t));
    if (avail.length <= this.maxSlots) return avail;
    return null;
  }

  setSlots(types) {
    this.slots = types.map(type => {
      const def = PLANTS[type];
      const startCool = def.recharge >= 30 ? def.recharge * 0.55 : 0;
      return { type, cool: startCool, coolMax: def.recharge };
    });
  }

  // ---------------- 生命周期 ----------------
  enter() {
    // 预览僵尸（站在街上）
    const b = this.board;
    if (this.mode !== 'vase' && this.mode !== 'whack') {
      const types = [];
      const pool = this.level.zombies.filter(t => ZOMBIES[t]?.weight > 0);
      if (this.level.intro && ZOMBIES[this.level.intro]?.weight > 0) types.push(this.level.intro);
      const n = Math.min(11, 5 + Math.floor((this.level.waves || 10) / 4));
      while (types.length < n) types.push(weightedChoice(pool, t => ZOMBIES[t].weight + 500));
      const spots = [];
      for (let i = 0; i < types.length; i++) {
        let x, y, tries = 0;
        do {
          x = rand(1300, 1690);
          y = rand(LAWN_TOP + 60, H - 30);
          tries++;
        } while (tries < 30 && spots.some(s => Math.abs(s.x - x) < 70 && Math.abs(s.y - y) < 60));
        spots.push({ x, y });
        const row = Math.max(0, Math.min(b.rows - 1, Math.floor((y - LAWN_TOP) / b.rowH)));
        const z = new ZombieProxy(b, types[i], row, x, y);
        b.previewZombies.push(z);
      }
    }
    music.play(this.needSelect ? 'select' : this.envMusic());
  }

  envMusic() {
    if (['bowling', 'whack', 'vase'].includes(this.mode) || this.level.rain) return 'minigame';
    return { night: 'night', pool: 'pool', fog: 'fog' }[this.level.env] || 'day';
  }

  exit() {
    music.setLayer('intense', 0);
  }

  // ---------------- 镜头 ----------------
  panTo(x, dur, cb) {
    this.camTween = { from: this.camX, to: x, t: 0, dur, cb };
  }

  sunCounterWorld() { return { x: BANK_X + 48 + this.camX, y: BANK_Y + 34 }; }
  sunPulse() { this.sunPulseT = 0.25; }

  // ---------------- 更新 ----------------
  update(dt) {
    this.t += dt;
    if (this.sunFlash > 0) this.sunFlash -= dt;
    if (this.sunPulseT > 0) this.sunPulseT -= dt;
    if (this.malletT < 1) this.malletT = Math.min(1, this.malletT + dt * 5);
    for (const m of this.messages) m.t += dt;
    this.messages = this.messages.filter(m => m.t < m.life);
    for (const a of this.selectAnims) a.t += dt / 0.22;
    this.selectAnims = this.selectAnims.filter(a => a.t < 1);

    if (this.paused) return;
    if (this.camTween) {
      const tw = this.camTween;
      tw.t += dt / tw.dur;
      this.camX = lerp(tw.from, tw.to, Ease.inOutSine(clamp(tw.t, 0, 1)));
      if (tw.t >= 1) { this.camTween = null; tw.cb?.(); }
    }

    const steps = this.phase === 'play' ? this.speed : 1;
    for (let i = 0; i < steps; i++) this.step(dt);
  }

  step(dt) {
    this.phaseT += dt;
    const b = this.board;
    switch (this.phase) {
      case 'intro':
        if (this.phaseT > 0.9 && !this.camTween && !this.introPanned) {
          this.introPanned = true;
          if (this.mode === 'vase' || this.mode === 'whack') { this.startPanBack(true); break; }
          this.panTo(480, 1.6, () => {
            if (this.needSelect) this.setPhase('select');
            else this.setPhase('preview');
          });
        }
        break;
      case 'select':
        this.hudSlide = Math.min(1, this.hudSlide + dt * 3);
        break;
      case 'preview':
        this.hudSlide = Math.min(1, this.hudSlide + dt * 3);
        if (this.phaseT > 1.6) this.startPanBack();
        break;
      case 'panback':
        this.hudSlide = Math.min(1, this.hudSlide + dt * 3);
        if (!this.camTween && this.phaseT > 0.2) {
          if (b.sodT < 1 && b.sodRolling) break;
          if (!this.panDone) { this.panDone = true; this.panDoneT = this.phaseT; }
          if (this.phaseT - this.panDoneT > 0.5) this.setPhase('ready');
        }
        break;
      case 'ready':
        if (this.phaseT >= 0 && !this.rs0) { this.rs0 = true; audio.play('ready'); }
        if (this.phaseT >= 0.65 && !this.rs1) { this.rs1 = true; audio.play('set'); }
        if (this.phaseT >= 1.3 && !this.rs2) { this.rs2 = true; audio.play('go'); }
        if (this.phaseT >= 2.1) this.startPlay();
        break;
      case 'play':
        this.updatePlay(dt);
        break;
      case 'won':
        this.updatePlay(dt, true);
        break;
      case 'award':
        this.awardT += dt;
        break;
      case 'lost':
        this.hudSlide = Math.max(0, this.hudSlide - dt * 2.5);
        this.updateLost(dt);
        break;
    }
    b.update(dt);
    if (this.phase === 'play' || this.phase === 'won') this.updateBelt(dt);
    for (const s of this.looseSeeds) this.updateLoose(s, dt);
    this.looseSeeds = this.looseSeeds.filter(s => !s.dead);
  }

  setPhase(p) { this.phase = p; this.phaseT = 0; }

  startPanBack(immediate = false) {
    this.setPhase('panback');
    this.panDone = false;
    const done = () => {
      this.board.previewZombies = [];
      this.board.moversArrive = true;
      if (this.board.newSod.length) { this.board.sodRolling = true; audio.play('sodroll'); }
    };
    if (immediate) { this.camX = 0; done(); return; }
    this.panTo(0, 1.3, done);
  }

  startPlay() {
    this.setPhase('play');
    const b = this.board;
    b.running = true;
    music.play(this.envMusic());
    if (this.level.tutorial) this.startTutorial(this.level.tutorial);
    if (this.level.tutorial === 'basic') b.skyTimer = 2.5;
    if (this.mode === 'vase') { b.noWaves = true; b.noWinCheck = true; }
  }

  updatePlay(dt, won = false) {
    for (const s of this.slots) if (s.cool > 0) s.cool = Math.max(0, s.cool - dt);
    this.progSmooth = lerp(this.progSmooth || 0, this.board.waves.progress, Math.min(1, dt * 2.5));
    if (this.mode === 'vase' && !won) this.checkVaseWin();
    if (!won) this.updateTutorial(dt);
  }

  // ---------------- 传送带 / 种子雨 ----------------
  initBelt() {
    const L = this.level;
    let items;
    if (this.mode === 'bowling') {
      items = [['bowl-normal', 70], ['bowl-explode', 12]];
      if (L.giant) items.push(['bowl-giant', 7]);
    } else items = L.conveyor || [['peashooter', 1]];
    this.belt = { items: [], pool: items, spawnT: 0.6, scroll: 0, max: this.mode === 'bowling' ? 8 : 10, count: 0 };
  }

  beltPick() {
    const pool = this.belt.pool;
    // 泳池关卡保证睡莲数量
    const choice = weightedChoice(pool, ([t, w]) => {
      let ww = w;
      if (this.belt.items.filter(i => i.type === t).length >= 3) ww *= 0.2;
      return ww;
    });
    return choice[0];
  }

  updateBelt(dt) {
    const bt = this.belt;
    if (!bt) return;
    const running = this.phase === 'play';
    if (this.rain) {
      if (!running) return;
      bt.spawnT -= dt;
      if (bt.spawnT <= 0) {
        bt.spawnT = rand(2.6, 4.2);
        const type = this.beltPick();
        const r = choose(this.board.activeRows);
        this.looseSeeds.push({ type, x: rand(LAWN_X + 60, LAWN_RIGHT - 60), y: -60, ty: this.board.rowY(r) - 30, life: 11, t: 0, rain: true });
      }
      return;
    }
    bt.scroll += dt * 40;
    if (!running) return;
    bt.spawnT -= dt;
    if (bt.spawnT <= 0 && bt.items.length < bt.max) {
      bt.count++;
      bt.spawnT = this.mode === 'bowling' ? rand(2.2, 3.4) : rand(3.4, 5.8) * (bt.count < 4 ? 0.6 : 1);
      bt.items.push({ type: this.beltPick(), x: this.beltRight() });
      audio.play('conveyor');
    }
    const x0 = BANK_X + 14;
    bt.items.forEach((it, i) => {
      const minX = i === 0 ? x0 : bt.items[i - 1].x + PACKET_W + 4;
      if (it.x > minX) it.x = Math.max(minX, it.x - 70 * dt);
    });
  }

  beltRight() { return BANK_X + 14 + 10 * (PACKET_W + 4); }

  updateLoose(s, dt) {
    s.t += dt;
    if (s.rain) {
      if (s.y < s.ty) s.y = Math.min(s.ty, s.y + 90 * dt);
      else s.life -= dt;
      if (s.life <= 0) s.dead = true;
    } else if (s.vy !== undefined) {
      s.vy += 800 * dt;
      s.y += s.vy * dt;
      if (s.y >= s.ty) { s.y = s.ty; s.vy = undefined; }
    }
  }

  // ---------------- 砸罐子 ----------------
  initVases() {
    const b = this.board;
    const cells = [];
    for (const r of b.activeRows) for (let c = 4; c < COLS; c++) cells.push([c, r]);
    shuffle(cells);
    const plantPool = ['peashooter', 'repeater', 'snowpea', 'squash', 'cherrybomb', 'wallnut', 'potatomine', 'chomper', 'threepeater', 'jalapeno', 'puffshroom', 'fumeshroom'];
    const nPlants = 13;
    cells.forEach(([c, r], i) => {
      const plant = i < nPlants;
      const content = plant ? { type: 'plant', id: choose(plantPool) } : { type: 'zombie', id: choose(this.level.zombies) };
      const v = {
        col: c, row: r, x: colX(c), y: b.rowY(r), content, green: plant && Math.random() < 0.45, t: rand(0, 5),
        draw: ctx => drawVase(ctx, v.x, v.y, v.green, v.t, v.shake || 0),
      };
      b.cellOf(c, r).vase = v;
      b.vases.push(v);
    });
    b.skySun = false;
  }

  breakVase(v) {
    const b = this.board;
    b.cellOf(v.col, v.row).vase = null;
    b.vases = b.vases.filter(x => x !== v);
    audio.play('vase');
    for (let i = 0; i < 16; i++) {
      b.fx.add({ type: 'shard', x: v.x + rand(-20, 20), y: v.y - rand(20, 70), vx: rand(-160, 160), vy: rand(-300, -80), g: 900, size: rand(5, 10), color: v.green ? '#7ac050' : '#c89a64', stroke: '#4a3018', rot: rand(TAU), vr: rand(-10, 10), life: 0.9, ground: v.y + rand(-4, 6), bounces: 1 });
    }
    if (v.content.type === 'plant') {
      this.looseSeeds.push({ type: v.content.id, x: v.x, y: v.y - 50, vy: -300, ty: v.y - 30, t: 0 });
    } else {
      const z = b.spawnZombie(v.content.id, v.row, v.x + 10);
      z.walkPh = 0;
    }
  }

  checkVaseWin() {
    const b = this.board;
    if (b.won || b.lost) return;
    if (b.vases.length === 0 && !b.zombies.some(z => z.isEnemy && z.alive)) {
      b.won = true;
      this.onWin(b.lastKill || { x: 800, y: b.rowY(2) });
    }
  }

  // ---------------- 教程 ----------------
  startTutorial(kind) {
    this.tutorial = kind;
    this.tutorialStep = 0;
    this.tutorialT = 0;
    const hints = {
      sunflower: '向日葵能源源不断地生产阳光，尽早多种几株吧！',
      cherry: '樱桃炸弹威力巨大，留着对付成群的僵尸！',
      shovel: '种错了？点击种子槽右边的铲子，就能挖掉不需要的植物。',
      night: '夜晚没有阳光从天而降，蘑菇们却精神抖擞！试试阳光菇和小喷菇。',
      pool: '水面上要先种睡莲，才能种下其他植物。水里的僵尸会套着救生圈游过来！',
      fog: '浓雾遮住了右侧的草坪！用路灯花照亮雾区，或种下三叶草吹散浓雾。气球僵尸只能用仙人掌或三叶草对付。',
    };
    if (kind !== 'basic') this.showHint(hints[kind], 8);
  }

  updateTutorial(dt) {
    if (this.tutorial !== 'basic') return;
    this.tutorialT += dt;
    const b = this.board;
    const hasPea = b.plants.some(p => p.type === 'peashooter');
    if (hasPea && this.tutorialStep < 2) { this.tutorialStep = 2; this.tutorialT = 0; }
    if (this.tutorialStep === 0) {
      this.hint = { text: '点击左上角的豌豆射手卡片，把它拿起来。', arrow: { x: slotX(0) + PACKET_W / 2, y: SLOT_Y + PACKET_H + 12, dir: 'up' } };
      if (this.held) this.tutorialStep = 1;
    } else if (this.tutorialStep === 1) {
      this.hint = { text: '点击草坪，把豌豆射手种在上面！', arrow: { x: colX(1) - this.camX, y: b.rowY(2) - 70, dir: 'down' } };
      if (!this.held && !hasPea) this.tutorialStep = 0;
      if (hasPea) { this.tutorialStep = 2; this.tutorialT = 0; }
    } else if (this.tutorialStep === 2) {
      const s = b.suns[0];
      this.hint = { text: '点击掉落的阳光来收集它！阳光是种植植物的货币。', arrow: s && s.state !== 'collect' ? { x: s.x - this.camX, y: s.y - 40, dir: 'down' } : null };
      if (b.sun >= 100 && this.tutorialT > 2) { this.tutorialStep = 3; this.tutorialT = 0; }
    } else if (this.tutorialStep === 3) {
      this.hint = { text: '太棒了！继续种植豌豆射手，别让僵尸靠近你的房子！', arrow: null };
      if (this.tutorialT > 7) { this.tutorialStep = 4; this.hint = null; }
    }
  }

  showHint(str, dur = 5) {
    this.hint = { text: str, arrow: null, until: this.t + dur };
  }

  // ---------------- 消息 ----------------
  showMessage(kind) {
    this.messages.push({ kind, t: 0, life: kind === 'huge' ? 4.5 : kind === 'final' ? 3 : 3 });
  }

  onSurvivalFlag(n) {
    this.flagsSurvived = n;
    this.board.fx.floatText(640 + this.camX, 300, `已坚持 ${n} 旗！`, { size: 40, color: '#ffe23a', stroke: '#5a2a00', life: 2.2 });
    const best = save.data.survival[this.level.id] || 0;
    if (n > best) { save.data.survival[this.level.id] = n; save.write(); }
  }

  // ---------------- 胜负 ----------------
  rewardFor() {
    const L = this.level;
    if (this.o.source === 'adventure' && L.reward) {
      if (L.reward.type === 'plant' && save.hasPlant(L.reward.id)) return { type: 'trophy', replay: true };
      return L.reward;
    }
    return { type: 'trophy' };
  }

  onWin(pos) {
    if (this.phase === 'lost') return;
    this.setPhase('won');
    this.held = null;
    const reward = this.rewardFor();
    const r = new Reward(this.board, pos.x, pos.y, reward);
    this.board.rewards.push(r);
    music.stop(2.5);
    audio.play('flag');
    setTimeout(() => { if (this.phase === 'won') this.showHint('点击奖励，领取战利品！', 99); }, 2500);
  }

  collectReward(r) {
    this.setPhase('award');
    this.awardT = 0;
    this.awardReward = r;
    this.awardFrom = { x: r.x - this.camX, y: r.y };
    this.board.rewards = [];
    this.hint = null;
    audio.play('award');
    this.saveProgress(r.reward);
    setTimeout(() => {
      director.go(new Scenes.AwardScene(this.level, r.reward, this.o), { color: '#fff', speed: 1.4 });
    }, 1700);
  }

  saveProgress(reward) {
    const d = save.data;
    const L = this.level;
    d.completed[L.id] = true;
    if (this.o.source === 'adventure') {
      const idx = levelIndex(L.id);
      if (idx >= 0 && d.adventure <= idx) d.adventure = idx + 1;
      if (reward.type === 'plant') save.unlockPlant(reward.id);
    } else if (this.o.source === 'minigame') {
      d.minigames[L.id] = { won: true };
    }
    save.write();
  }

  onLose(z) {
    if (this.phase === 'lost') return;
    this.setPhase('lost');
    this.loseZ = z;
    this.held = null;
    this.hint = null;
    this.board.running = false;
    music.stop(0.3);
    audio.play('lose');
    this.panTo(-230, 2.2);
    if (this.mode === 'survival') {
      const best = save.data.survival[this.level.id] || 0;
      if (this.flagsSurvived > best) { save.data.survival[this.level.id] = this.flagsSurvived; save.write(); }
    }
  }

  updateLost(dt) {
    const z = this.loseZ;
    if (z && !z.dead) {
      z.t += dt;
      if (z.x > 10) {
        z.x -= 26 * dt;
        z.walkPh += dt * 4.4;
        z.anim = 'walk';
        z.state = 'walk';
      } else {
        z.alpha = Math.max(0, z.alpha - dt * 1.5);
      }
    }
    if (this.phaseT > 4.2 && !this.endShown) {
      this.endShown = true;
      this.endUI.clear();
      this.endUI.add(new Button({ x: 440, y: 520, w: 190, h: 60, label: '再试一次', style: 'green', onClick: () => this.restart() }));
      this.endUI.add(new Button({ x: 650, y: 520, w: 190, h: 60, label: '返回', style: 'stone', onClick: () => this.quit() }));
    }
  }

  restart() {
    director.go(new GameScene(this.level, this.o));
  }

  quit() {
    music.stop(0.5);
    const S = Scenes;
    if (this.o.source === 'adventure') director.go(new S.LevelSelectScene());
    else if (this.o.source === 'minigame') director.go(new S.MinigameScene());
    else if (this.o.source === 'survival') director.go(new S.MinigameScene('survival'));
    else director.go(new S.MenuScene());
  }

  // ---------------- 暂停 ----------------
  pause() {
    if (this.paused || this.phase === 'lost' || this.phase === 'award') return;
    this.paused = true;
    audio.play('pause');
    const s = save.settings;
    const ui = this.pauseUI;
    ui.clear();
    const cx = 640;
    ui.add(new Slider({ x: cx - 60, y: 240, w: 220, label: '音乐', value: s.music, onChange: v => { s.music = v; audio.applyVolumes(); save.write(); } }));
    ui.add(new Slider({ x: cx - 60, y: 290, w: 220, label: '音效', value: s.sfx, onChange: v => { s.sfx = v; audio.applyVolumes(); save.write(); } }));
    ui.add(new Toggle({ x: cx - 60, y: 345, label: '自动收集阳光', value: s.autoCollect, onChange: v => { s.autoCollect = v; this.board.autoCollect = v; save.write(); } }));
    ui.add(new Toggle({ x: cx + 170, y: 345, label: '血量条', value: s.healthBars, onChange: v => { s.healthBars = v; this.board.showHealth = v; save.write(); } }));
    ui.add(new Button({ x: cx - 150, y: 400, w: 300, h: 56, label: '继续游戏', style: 'green', onClick: () => this.resume() }));
    ui.add(new Button({ x: cx - 150, y: 466, w: 145, h: 50, label: '重新开始', style: 'wood', fontSize: 21, onClick: () => this.restart() }));
    ui.add(new Button({ x: cx + 5, y: 466, w: 145, h: 50, label: '主菜单', style: 'stone', fontSize: 21, onClick: () => this.quit() }));
  }

  resume() {
    this.paused = false;
    audio.play('unpause');
  }

  toggleSpeed() {
    this.speed = this.speed === 1 ? 2 : 1;
    save.settings.speed = this.speed;
    save.write();
    this.speedBtn.label = this.speed === 2 ? '×2' : '×1';
  }

  // ---------------- 输入 ----------------
  get worldX() { return this.mx + this.camX; }

  slotAt(x, y) {
    if (this.useBelt) {
      const bt = this.belt;
      for (let i = 0; i < bt.items.length; i++) {
        const it = bt.items[i];
        if (x >= it.x && x <= it.x + PACKET_W && y >= SLOT_Y && y <= SLOT_Y + PACKET_H) return i;
      }
      return -1;
    }
    for (let i = 0; i < this.slots.length; i++) {
      const sx = slotX(i);
      if (x >= sx && x <= sx + PACKET_W && y >= SLOT_Y && y <= SLOT_Y + PACKET_H) return i;
    }
    return -1;
  }

  get shovelX() { return this.useBelt ? this.beltRight() + 24 : (this.mode === 'vase' || this.rain) ? 10 : slotX(this.maxSlots) + 12; }
  get hasShovel() { return this.mode !== 'bowling' && this.mode !== 'whack'; }
  shovelHit(x, y) { return this.hasShovel && x >= this.shovelX && x <= this.shovelX + 78 && y >= 8 && y <= 86; }

  pointerMove(x, y) {
    this.mx = x;
    this.my = y;
    let cursor = 'default';
    if (this.paused) { this.pauseUI.move(x, y); return; }
    if (this.phase === 'lost') { this.endUI.move(x, y); return; }
    if (this.phase === 'select') this.selectMove(x, y);
    if (this.ui.move(x, y)) cursor = 'pointer';
    if (this.phase === 'play' || this.phase === 'won') {
      if (this.slotAt(x, y) >= 0 || this.shovelHit(x, y)) cursor = 'pointer';
      const wx = x + this.camX;
      if (this.board.suns.some(s => s.hitTest(wx, y)) || this.board.rewards.some(r => r.hitTest(wx, y))) cursor = 'pointer';
      if (this.board.vases.some(v => Math.abs(v.x - wx) < 38 && y > v.y - 90 && y < v.y + 5)) cursor = 'pointer';
      if (this.looseSeeds.some(s => Math.abs(s.x - wx) < 34 && Math.abs(s.y - y) < 44)) cursor = 'pointer';
      if (this.held) cursor = 'none';
      if (this.mode === 'whack' && !this.held && y > 100) cursor = 'none';
    }
    display.setCursor(cursor);
  }

  pointerDown(x, y, btn) {
    this.mx = x;
    this.my = y;
    if (this.paused) { this.pauseUI.down(x, y); return; }
    if (this.phase === 'lost') { this.endUI.down(x, y); return; }
    if ((this.phase === 'play' || this.phase === 'won') && this.ui.down(x, y)) return;
    if (this.phase === 'select') return this.selectDown(x, y);
    if (this.phase !== 'play' && this.phase !== 'won') return;
    if (btn === 2) { this.cancelHeld(); return; }
    const b = this.board;
    const wx = x + this.camX;
    // 1) 奖励
    for (const r of b.rewards) if (r.hitTest(wx, y)) { this.collectReward(r); return; }
    // 2) 阳光
    for (let i = b.suns.length - 1; i >= 0; i--) if (b.suns[i].hitTest(wx, y)) { b.suns[i].collect(); return; }
    // 3) 种子卡 / 传送带
    const si = this.slotAt(x, y);
    if (si >= 0) return this.clickSlot(si);
    if (this.shovelHit(x, y)) {
      if (this.held?.kind === 'shovel') this.held = null;
      else { this.cancelHeld(); this.held = { kind: 'shovel' }; audio.play('seedlift'); }
      return;
    }
    // 4) 散落的种子（砸罐子 / 种子雨）
    if (!this.held) {
      for (const s of this.looseSeeds) {
        if (Math.abs(s.x - wx) < 34 && Math.abs(s.y - y) < 44) {
          this.held = { kind: 'loose', seed: s, type: s.type };
          s.picked = true;
          audio.play('seedlift');
          return;
        }
      }
      // 5) 罐子
      for (const v of b.vases) {
        if (Math.abs(v.x - wx) < 38 && y > v.y - 90 && y < v.y + 5) { this.breakVase(v); return; }
      }
    }
    // 6) 在草坪上操作
    if (this.phase !== 'play') return;
    if (this.held) return this.useHeld(wx, y);
    if (this.mode === 'whack' && y > 100) {
      this.malletT = 0;
      audio.play('whack');
      b.whackAt(wx, y);
    }
  }

  pointerUp(x, y) {
    if (this.paused) { this.pauseUI.up(x, y); return; }
    if (this.phase === 'lost') { this.endUI.up(x, y); return; }
    if (this.phase === 'play' || this.phase === 'won') this.ui.up(x, y);
    if (this.phase === 'select') this.selectUp(x, y);
  }

  key(k) {
    if (k === 'Escape' || k === ' ' || k === 'p' || k === 'P') {
      if (this.held && k === 'Escape') { this.cancelHeld(); return; }
      if (this.paused) this.resume(); else if (this.phase === 'play') this.pause();
      return;
    }
    if (this.phase !== 'play') return;
    if (k >= '1' && k <= '9' || k === '0') {
      const i = k === '0' ? 9 : +k - 1;
      if (this.useBelt ? i < this.belt.items.length : i < this.slots.length) this.clickSlot(i);
    }
    if ((k === 's' || k === 'S') && this.hasShovel) {
      if (this.held?.kind === 'shovel') this.held = null;
      else { this.cancelHeld(); this.held = { kind: 'shovel' }; }
    }
    if (k === 'x' || k === 'X') this.toggleSpeed();
  }

  cancelHeld() {
    if (!this.held) return;
    if (this.held.kind === 'loose') this.held.seed.picked = false;
    this.held = null;
    audio.play('tap');
  }

  clickSlot(i) {
    const b = this.board;
    if (this.phase !== 'play') return;
    if (this.held?.kind === 'loose') this.cancelHeld();
    if (this.useBelt) {
      const it = this.belt.items[i];
      if (this.held?.kind === 'belt' && this.held.item === it) { this.held = null; return; }
      this.held = { kind: 'belt', item: it, type: it.type };
      audio.play('seedlift');
      return;
    }
    const s = this.slots[i];
    if (this.held?.kind === 'seed' && this.held.slot === s) { this.held = null; audio.play('tap'); return; }
    const cost = PLANTS[s.type].cost;
    if (s.cool > 0) { audio.play('buzzer'); return; }
    if (b.sun < cost) { audio.play('buzzer'); this.sunFlash = 0.6; return; }
    this.held = { kind: 'seed', slot: s, type: s.type };
    audio.play('seedlift');
  }

  useHeld(wx, y) {
    const b = this.board;
    const h = this.held;
    const cell = b.cellAt(wx, y);
    if (h.kind === 'shovel') {
      if (cell && b.shovel(cell.col, cell.row)) this.held = null;
      else this.held = null;
      return;
    }
    if (!cell) { this.cancelHeld(); return; }
    const type = h.type;
    if (type.startsWith('bowl-')) {
      const chk = b.canPlant('wallnut', cell.col, cell.row);
      if (!chk.ok) { audio.play('buzzer'); if (chk.reason) this.flashReason(chk.reason); return; }
      b.launchBowl(type.slice(5), cell.col, cell.row);
      this.belt.items = this.belt.items.filter(i => i !== h.item);
      this.held = null;
      return;
    }
    const chk = b.canPlant(type, cell.col, cell.row);
    if (!chk.ok) {
      audio.play('buzzer');
      if (chk.reason) this.flashReason(chk.reason);
      return;
    }
    if (h.kind === 'seed') {
      const cost = PLANTS[type].cost;
      if (b.sun < cost) { audio.play('buzzer'); this.held = null; return; }
      b.sun -= cost;
      h.slot.cool = h.slot.coolMax;
    } else if (h.kind === 'belt') {
      this.belt.items = this.belt.items.filter(i => i !== h.item);
    } else if (h.kind === 'loose') {
      h.seed.dead = true;
    }
    b.placePlant(type, cell.col, cell.row);
    this.held = null;
  }

  flashReason(r) {
    this.reasonMsg = { text: r, t: this.t };
  }

  // ---------------- 选卡 ----------------
  get selectPanel() { return { x: 14, y: 110, w: 624, h: 596 }; }

  availablePlants() { return PLANT_ORDER.filter(t => save.hasPlant(t)); }

  get gridLayout() {
    const n = this.availablePlants().length;
    return n > 32 ? { cols: 9, sx: 64, sy: 80, sc: 0.86 } : { cols: 8, sx: 72, sy: 92, sc: 1 };
  }

  gridPos(i) {
    const p = this.selectPanel;
    const L = this.gridLayout;
    return { x: p.x + (L.cols === 9 ? 26 : 28) + (i % L.cols) * L.sx, y: p.y + 56 + Math.floor(i / L.cols) * L.sy, s: L.sc };
  }

  get rockBtn() {
    if (!this._rock) {
      const p = this.selectPanel;
      this._rock = new Button({ x: p.x + p.w / 2 - 130, y: p.y + p.h - 72, w: 260, h: 58, label: '一起摇滚吧！', style: 'red', onClick: () => this.confirmSelect() });
    }
    const need = Math.min(this.maxSlots, this.availablePlants().length);
    this._rock.disabled = this.chosen.length < need;
    return this._rock;
  }

  selectMove(x, y) {
    const rb = this.rockBtn;
    const h = rb.hit(x, y) && !rb.disabled;
    if (h && !rb.hover) audio.play('hover');
    rb.hover = h;
    this.selHover = null;
    this.availablePlants().forEach((t, i) => {
      const g = this.gridPos(i);
      if (x >= g.x && x <= g.x + PACKET_W * g.s && y >= g.y && y <= g.y + PACKET_H * g.s) this.selHover = t;
    });
    if (h || this.selHover) display.setCursor('pointer');
  }

  selectDown(x, y) {
    const rb = this.rockBtn;
    if (rb.hit(x, y) && !rb.disabled) { rb.pressed = true; return; }
    // 点击卡槽移除
    for (let i = 0; i < this.chosen.length; i++) {
      const sx = slotX(i);
      if (x >= sx && x <= sx + PACKET_W && y >= SLOT_Y && y <= SLOT_Y + PACKET_H) {
        const t = this.chosen[i];
        this.chosen.splice(i, 1);
        const gi = this.availablePlants().indexOf(t);
        const g = this.gridPos(gi);
        this.selectAnims.push({ type: t, x0: sx, y0: SLOT_Y, x1: g.x, y1: g.y, t: 0 });
        audio.play('tap');
        return;
      }
    }
    const av = this.availablePlants();
    for (let i = 0; i < av.length; i++) {
      const g = this.gridPos(i);
      if (x >= g.x && x <= g.x + PACKET_W * g.s && y >= g.y && y <= g.y + PACKET_H * g.s) {
        const t = av[i];
        if (this.chosen.includes(t)) return;
        if (this.chosen.length >= this.maxSlots) { audio.play('buzzer'); return; }
        const si = this.chosen.length;
        this.chosen.push(t);
        this.selectAnims.push({ type: t, x0: g.x, y0: g.y, x1: slotX(si), y1: SLOT_Y, t: 0, toBank: true });
        audio.play('seedlift');
        return;
      }
    }
  }

  selectUp(x, y) {
    const rb = this.rockBtn;
    if (rb.pressed) {
      rb.pressed = false;
      if (rb.hit(x, y) && !rb.disabled) { audio.play('button'); rb.onClick(); }
    }
  }

  confirmSelect() {
    this.setSlots(this.chosen.slice());
    music.play(this.envMusic());
    this.startPanBack();
  }

  // ---------------- 绘制 ----------------
  draw(ctx) {
    const b = this.board;
    ctx.save();
    const sh = b.shakeAmt;
    if (sh > 0) ctx.translate(rand(-sh, sh) * 0.6, rand(-sh, sh) * 0.6);
    ctx.translate(-this.camX, 0);
    b.draw(ctx, this.camX);
    this.drawHeldGhost(ctx);
    for (const s of this.looseSeeds) this.drawLoose(ctx, s);
    b.drawTop(ctx);
    ctx.restore();

    this.drawHUD(ctx);
    this.drawMessages(ctx);
    if (this.phase === 'select' || (this.phase === 'panback' && this.phaseT < 0.5 && this.needSelect)) this.drawSelect(ctx);
    if (this.phase === 'ready') this.drawReady(ctx);
    if (this.phase === 'intro' || this.phase === 'preview') this.drawBanner(ctx);
    if (this.phase === 'award') this.drawAward(ctx);
    if (this.phase === 'lost') this.drawLost(ctx);
    this.drawHint(ctx);
    this.drawHeldCursor(ctx);
    if (this.paused) this.drawPause(ctx);
  }

  drawCellHighlight(ctx) {
    if (!this.held || this.phase !== 'play') return;
    const b = this.board;
    const cell = b.cellAt(this.worldX, this.my);
    if (!cell || !b.activeRow(cell.row)) return;
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(LAWN_X, b.rowTop(cell.row), COLS * COL_W, b.rowH);
    const r0 = Math.min(...b.activeRows), r1 = Math.max(...b.activeRows);
    ctx.fillRect(LAWN_X + cell.col * COL_W, b.rowTop(r0), COL_W, (r1 - r0 + 1) * b.rowH);
    ctx.restore();
  }

  drawHeldGhost(ctx) {
    const h = this.held;
    if (!h || this.phase !== 'play' || h.kind === 'shovel') {
      if (h?.kind === 'shovel') {
        const b = this.board;
        const cell = b.cellAt(this.worldX, this.my);
        if (cell) {
          const c = b.cellOf(cell.col, cell.row);
          const p = c.overlay || c.main || c.base;
          if (p) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 0.25 + 0.1 * Math.sin(this.t * 10);
            E(ctx, p.x, p.y - 30, 44, 50);
            ctx.fillStyle = '#fff';
            ctx.fill();
            ctx.restore();
          }
        }
      }
      return;
    }
    const b = this.board;
    const cell = b.cellAt(this.worldX, this.my);
    if (!cell) return;
    const type = h.type;
    const chk = type.startsWith('bowl-') ? b.canPlant('wallnut', cell.col, cell.row) : b.canPlant(type, cell.col, cell.row);
    if (!chk.ok) return;
    const x = colX(cell.col), y = b.rowY(cell.row) - (b.cellOf(cell.col, cell.row).base && type !== 'lilypad' ? 10 : 0);
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.translate(x, y);
    if (type === 'coffeebean') ctx.translate(0, -70);
    if (type.startsWith('bowl-')) bowlnut(ctx, { roll: 0 }, type.slice(5));
    else PLANT_ART[type]?.(ctx, { t: this.t, phase: 0, icon: true, armed: true, rise: 1 });
    ctx.restore();
  }

  drawHeldCursor(ctx) {
    const h = this.held;
    if (this.mode === 'whack' && !h && (this.phase === 'play' || this.phase === 'won') && this.my > 100) {
      drawMallet(ctx, this.mx, this.my, this.malletT);
    }
    if (!h || (this.phase !== 'play' && this.phase !== 'won')) return;
    ctx.save();
    ctx.translate(this.mx, this.my);
    if (h.kind === 'shovel') {
      drawShovel(ctx, 14, -18, 1.1, -0.6);
    } else {
      ctx.translate(0, 34);
      ctx.scale(0.85, 0.85);
      if (h.type === 'coffeebean') ctx.translate(0, -20);
      if (h.type.startsWith('bowl-')) bowlnut(ctx, { roll: 0 }, h.type.slice(5));
      else PLANT_ART[h.type]?.(ctx, { t: this.t, phase: 0, icon: true, armed: true, rise: 1 });
    }
    ctx.restore();
  }

  drawLoose(ctx, s) {
    if (s.picked || s.dead) return;
    const blink = s.rain && s.life < 3 ? (Math.sin(s.t * 14) > 0 ? 1 : 0.35) : 1;
    ctx.save();
    ctx.globalAlpha = blink;
    ctx.translate(s.x, s.y + Math.sin(s.t * 3) * 3);
    ctx.rotate(Math.sin(s.t * 2) * 0.06);
    drawPacket(ctx, -27, -38, s.type, { scale: 0.88, noCost: true });
    ctx.restore();
  }

  drawHUD(ctx) {
    const b = this.board;
    const slide = Ease.outCubic(this.hudSlide);
    const oy = -120 * (1 - slide);
    const showBank = this.phase !== 'intro' || this.hudSlide > 0;
    ctx.save();
    ctx.translate(0, oy);
    if (showBank && this.mode !== 'vase' && !this.rain) {
      if (this.useBelt) this.drawBelt(ctx);
      else {
        drawSeedBank(ctx, BANK_X, BANK_Y, this.maxSlots);
        // 阳光
        const pulse = this.sunPulseT > 0 ? 1 + this.sunPulseT * 0.6 : 1;
        drawSun(ctx, BANK_X + 48, BANK_Y + 34, 21 * pulse, this.t);
        const red = this.sunFlash > 0 && Math.sin(this.sunFlash * 30) > 0;
        text(ctx, String(b.sun), BANK_X + 48, BANK_Y + 77, { size: 20, color: red ? '#e02010' : '#1a1206', weight: 900 });
        // 卡片
        const list = this.phase === 'select' || (this.phase === 'panback' && !this.slots.length) ? this.chosen.map(t => ({ type: t, cool: 0, coolMax: 1, sel: true })) : this.slots;
        list.forEach((s, i) => {
          if (this.selectAnims.some(a => a.toBank && a.type === s.type)) return;
          const cost = PLANTS[s.type].cost;
          const hover = this.slotAt(this.mx, this.my) === i && this.phase === 'play';
          const disabled = !s.sel && this.phase === 'play' && (b.sun < cost || s.cool > 0);
          drawPacket(ctx, slotX(i), SLOT_Y, s.type, {
            recharge: s.cool > 0 ? s.cool / s.coolMax : 0,
            disabled, hover,
            selected: this.held?.kind === 'seed' && this.held.slot === s,
          });
          if (s.sel && this.phase === 'select' && this.mx >= slotX(i) && this.mx <= slotX(i) + PACKET_W && this.my <= SLOT_Y + PACKET_H) {
            ctx.save(); ctx.globalCompositeOperation = 'lighter'; rr(ctx, slotX(i), SLOT_Y, PACKET_W, PACKET_H, 6); ctx.fillStyle = 'rgba(255,255,200,0.2)'; ctx.fill(); ctx.restore();
          }
        });
      }
    }
    if (showBank && this.hasShovel && this.phase !== 'select') drawShovelBox(ctx, this.shovelX, 8, this.shovelHit(this.mx, this.my), this.held?.kind === 'shovel');
    ctx.restore();
    // 选卡飞行动画
    for (const a of this.selectAnims) {
      const k = Ease.outQuad(clamp(a.t, 0, 1));
      drawPacket(ctx, lerp(a.x0, a.x1, k), lerp(a.y0, a.y1, k) - Math.sin(k * Math.PI) * 30, a.type, {});
    }
    if (this.phase === 'play' || this.phase === 'won') {
      this.ui.draw(ctx);
      this.drawProgress(ctx);
      this.drawPacketTip(ctx);
    }
    if (this.reasonMsg && this.t - this.reasonMsg.t < 1.6) {
      const a = clamp(1.6 - (this.t - this.reasonMsg.t), 0, 1);
      ctx.save();
      ctx.globalAlpha = a;
      text(ctx, this.reasonMsg.text, this.mx, this.my - 60, { size: 20, color: '#fff', stroke: '#5a0000', lw: 5 });
      ctx.restore();
    }
  }

  drawPacketTip(ctx) {
    if (this.held || this.useBelt) return;
    const i = this.slotAt(this.mx, this.my);
    if (i < 0) return;
    const sl = this.slots[i];
    const d = PLANTS[sl.type];
    let status = '';
    if (sl.cool > 0) status = '冷却中……';
    else if (this.board.sun < d.cost) status = '阳光不足';
    else if (d.night && !this.board.isNight) status = '白天会睡觉';
    const x = slotX(i) + PACKET_W / 2, y = SLOT_Y + PACKET_H + 8;
    ctx.save();
    ctx.font = `800 17px ${FONT}`;
    const w = Math.max(ctx.measureText(d.name).width, status ? ctx.measureText(status).width * 0.85 : 0) + 26;
    const h = status ? 50 : 32;
    const bx = Math.max(6, x - w / 2);
    rr(ctx, bx, y, w, h, 8);
    fs(ctx, 'rgba(255,250,225,0.96)', '#5a4418', 2);
    text(ctx, d.name, bx + w / 2, y + 16, { size: 17, color: '#3a2408', weight: 800 });
    if (status) text(ctx, status, bx + w / 2, y + 36, { size: 14, color: '#b02a10', weight: 800 });
    ctx.restore();
  }

  drawBelt(ctx) {
    const bt = this.belt;
    const x = BANK_X, y = BANK_Y, w = this.beltRight() - BANK_X + 10, h = 98;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    rr(ctx, x + 3, y + 4, w, h, 10);
    ctx.fill();
    rr(ctx, x, y, w, h, 10);
    fs(ctx, lg(ctx, 0, y, 0, y + h, [0, '#7a7e86', 1, '#3a3e46']), '#1a1c20', 2.5);
    rr(ctx, x + 8, y + 8, w - 16, h - 16, 6);
    fs(ctx, '#2a2c30', '#111', 1.5);
    ctx.save();
    rr(ctx, x + 8, y + 8, w - 16, h - 16, 6);
    ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    const off = bt.scroll % 24;
    for (let sx = x + 8 - off; sx < x + w; sx += 24) ctx.fillRect(sx, y + 8, 10, h - 16);
    ctx.restore();
    // 滚轮
    for (const cx of [x + 8, x + w - 8]) {
      C(ctx, cx, y + h / 2, 9);
      fs(ctx, '#8a8e96', '#222', 1.5);
    }
    ctx.restore();
    bt.items.forEach((it, i) => {
      const sel = this.held?.kind === 'belt' && this.held.item === it;
      drawPacket(ctx, it.x, SLOT_Y, it.type, { noCost: true, selected: sel, hover: this.slotAt(this.mx, this.my) === i });
    });
  }

  drawProgress(ctx) {
    const b = this.board;
    const L = this.level;
    const x = 1010, y = 686, w = 250, h = 22;
    if (this.mode === 'vase') {
      text(ctx, `剩余罐子：${b.vases.length}`, 1130, 698, { size: 20, color: '#fff', stroke: '#000', lw: 4 });
      return;
    }
    if (this.mode === 'survival') {
      text(ctx, `${L.title}  已坚持 ${this.flagsSurvived} 旗`, 1240, 698, { size: 18, color: '#fff', stroke: '#000', lw: 4, align: 'right' });
      return;
    }
    const wv = b.waves;
    const name = L.title ? L.title : `关卡 ${L.id}`;
    text(ctx, name, x - 12, y + h / 2, { size: 18, color: '#fff', stroke: '#1a1a1a', lw: 4, align: 'right' });
    rr(ctx, x, y, w, h, 11);
    fs(ctx, 'rgba(20,20,20,0.75)', '#e8e0c0', 2);
    const p = clamp(wv.progress, 0, 1);
    if (this.progSmooth === undefined) this.progSmooth = p;
    const pw = (w - 6) * this.progSmooth;
    rr(ctx, x + 3 + (w - 6) - pw, y + 3, pw, h - 6, 8);
    fs(ctx, lg(ctx, 0, y, 0, y + h, [0, '#b8f070', 1, '#4f9a22']));
    // 旗帜
    for (let i = 0; i < wv.total; i++) {
      if (!wv.isFlagWave(i)) continue;
      const fx = x + w - 3 - ((i + 1) / wv.total) * (w - 6) + 4;
      const raised = wv.wave > i;
      ctx.save();
      ctx.translate(fx, y + 4 - (raised ? 6 : 0));
      ctx.fillStyle = '#6a4a2a';
      ctx.fillRect(-1, -14, 3, 22);
      ctx.fillStyle = raised ? '#e02020' : '#9a2020';
      ctx.beginPath();
      ctx.moveTo(2, -14); ctx.lineTo(16, -9); ctx.lineTo(2, -4); ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    // 僵尸头标记
    const hx = x + w - 3 - pw;
    ctx.save();
    ctx.translate(hx, y + h / 2);
    C(ctx, 0, 0, 12);
    fs(ctx, rg(ctx, -3, -4, 1, 0, 0, 13, [0, '#c8d6b0', 1, '#7a8e6a']), '#2f3a26', 1.8);
    C(ctx, -4, -2, 3.2); fs(ctx, '#fff', '#2f3a26', 1);
    C(ctx, 3, -2, 2.6); fs(ctx, '#fff', '#2f3a26', 1);
    ctx.fillStyle = '#3a1a14';
    ctx.fillRect(-5, 4, 7, 3);
    ctx.restore();
  }

  drawMessages(ctx) {
    for (const m of this.messages) {
      const k = m.t / m.life;
      const a = k < 0.1 ? k / 0.1 : k > 0.85 ? (1 - k) / 0.15 : 1;
      ctx.save();
      ctx.globalAlpha = a;
      if (m.kind === 'huge') {
        const sh = 2.5;
        text(ctx, '一大波僵尸正在接近！', 640 + rand(-sh, sh), 400 + rand(-sh, sh), { size: 52, color: '#e8201a', stroke: '#1a0000', lw: 10, shadow: 'rgba(0,0,0,0.5)' });
      } else if (m.kind === 'final') {
        const s = 1 + Math.max(0, 0.6 - m.t * 2.5) * 1.5;
        ctx.translate(640, 380);
        ctx.scale(s, s);
        text(ctx, '最后一波！', 0, 0, { size: 76, color: '#ff2a1a', stroke: '#1a0000', lw: 13, shadow: 'rgba(0,0,0,0.5)' });
      }
      ctx.restore();
    }
  }

  drawBanner(ctx) {
    const L = this.level;
    const t = this.phase === 'intro' ? this.phaseT : this.phaseT + 2.5;
    const a = clamp(t / 0.4, 0, 1) * clamp((4.2 - t) / 0.5, 0, 1);
    if (a <= 0) return;
    const env = envInfo(L.env).name;
    const title = this.o.source === 'adventure' ? `关卡 ${L.id}` : L.title;
    const introName = L.intro && ZOMBIES[L.intro] ? `新僵尸登场：${ZOMBIES[L.intro].name}` : '';
    const sub = this.o.source === 'adventure' ? [env, L.title, introName].filter(Boolean).join(' · ') : (L.desc || '');
    ctx.save();
    ctx.globalAlpha = a;
    const y = 620 + (1 - Ease.outCubic(clamp(t / 0.5, 0, 1))) * 40;
    ctx.fillStyle = lg(ctx, 0, y - 40, 0, y + 40, [0, 'rgba(0,0,0,0)', 0.3, 'rgba(0,0,0,0.55)', 0.7, 'rgba(0,0,0,0.55)', 1, 'rgba(0,0,0,0)']);
    ctx.fillRect(0, y - 44, W, 88);
    text(ctx, title, 640, y - 10, { size: 38, color: '#fff3c8', stroke: '#2a1a08', lw: 8 });
    text(ctx, sub, 640, y + 26, { size: 18, color: '#e8f0c8', stroke: '#1a1a08', lw: 4, weight: 700 });
    ctx.restore();
  }

  drawReady(ctx) {
    const t = this.phaseT;
    let str = null, k = 0;
    if (t < 0.65) { str = '准备……'; k = t / 0.65; }
    else if (t < 1.3) { str = '就绪……'; k = (t - 0.65) / 0.65; }
    else if (t < 2.1) { str = '种植！'; k = (t - 1.3) / 0.8; }
    if (!str) return;
    ctx.save();
    ctx.translate(640, 360);
    const s = str === '种植！' ? 1.2 + Ease.outBack(Math.min(1, k * 3)) * 0.4 : 0.8 + Ease.outBack(Math.min(1, k * 3)) * 0.3;
    ctx.scale(s, s);
    ctx.globalAlpha = k > 0.85 ? (1 - k) / 0.15 : 1;
    text(ctx, str, 0, 0, { size: 68, color: '#e8201a', stroke: '#200000', lw: 12, shadow: 'rgba(0,0,0,0.4)' });
    ctx.restore();
  }

  drawAward(ctx) {
    const t = this.awardT;
    const r = this.awardReward;
    const k = Ease.inOutCubic(clamp(t / 1.2, 0, 1));
    const x = lerp(this.awardFrom.x, 640, k), y = lerp(this.awardFrom.y, 360, k);
    ctx.save();
    ctx.fillStyle = `rgba(255,255,255,${clamp((t - 0.6) / 1.1, 0, 1)})`;
    ctx.fillRect(0, 0, W, H);
    ctx.translate(x, y);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.rotate(t);
    for (let i = 0; i < 16; i++) {
      ctx.rotate(TAU / 16);
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(-18, -300 * k); ctx.lineTo(18, -300 * k); ctx.closePath();
      ctx.fillStyle = 'rgba(255,240,160,0.25)';
      ctx.fill();
    }
    ctx.restore();
    const s = 1 + k * 1.6;
    ctx.scale(s, s);
    if (r.reward.type === 'plant') drawPacket(ctx, -31, -43, r.reward.id, { glow: 1 });
    else if (r.reward.type === 'trophy') drawTrophy(ctx, 0, 30, 1, t);
    else drawNote(ctx, 0, 30, 1);
    ctx.restore();
  }

  drawLost(ctx) {
    const t = this.phaseT;
    if (t > 2.4) {
      const a = clamp((t - 2.4) / 0.4, 0, 1);
      ctx.save();
      ctx.fillStyle = `rgba(0,0,0,${a * 0.45})`;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = a;
      ctx.translate(640 + Math.sin(t * 30) * 2 * (1 - a), 330);
      const s = 0.6 + Ease.outBack(a) * 0.4;
      ctx.scale(s, s);
      ctx.rotate(-0.04);
      text(ctx, '僵尸吃掉了', 0, -60, { size: 70, color: '#a8e060', stroke: '#1a2a00', lw: 12, shadow: 'rgba(0,0,0,0.6)' });
      text(ctx, '你的脑子！', 0, 40, { size: 92, color: '#a8e060', stroke: '#1a2a00', lw: 14, shadow: 'rgba(0,0,0,0.6)' });
      ctx.restore();
      if (this.mode === 'survival') text(ctx, `本次坚持了 ${this.flagsSurvived} 旗（最佳 ${save.data.survival[this.level.id] || 0} 旗）`, 640, 470, { size: 24, color: '#fff', stroke: '#000', lw: 5 });
    }
    if (this.endShown) this.endUI.draw(ctx);
  }

  drawHint(ctx) {
    const h = this.hint;
    if (!h || (h.until && this.t > h.until)) return;
    if (this.phase !== 'play' && this.phase !== 'won') return;
    if (h.text) {
      ctx.save();
      ctx.font = `700 22px ${FONT}`;
      const w = Math.min(1100, ctx.measureText(h.text).width + 60);
      rr(ctx, 640 - w / 2, 620, w, 54, 14);
      fs(ctx, 'rgba(10,14,8,0.78)', 'rgba(220,255,160,0.5)', 2);
      text(ctx, h.text, 640, 647, { size: 22, color: '#f8f4d8', weight: 700 });
      ctx.restore();
    }
    if (h.arrow) {
      const a = h.arrow;
      const bob = Math.sin(this.t * 8) * 8;
      ctx.save();
      ctx.translate(a.x, a.y + (a.dir === 'down' ? bob : -bob));
      if (a.dir === 'up') ctx.rotate(Math.PI);
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(-20, -26); ctx.lineTo(-8, -26); ctx.lineTo(-8, -52); ctx.lineTo(8, -52); ctx.lineTo(8, -26); ctx.lineTo(20, -26); ctx.closePath();
      fs(ctx, lg(ctx, 0, -52, 0, 0, [0, '#fff27a', 1, '#ff9a1a']), '#5a2a00', 3);
      ctx.restore();
    }
  }

  drawSelect(ctx) {
    const p = this.selectPanel;
    const slide = this.phase === 'select' ? Ease.outCubic(clamp(this.phaseT * 3, 0, 1)) : 1 - clamp(this.phaseT * 3, 0, 1);
    ctx.save();
    ctx.translate(0, (1 - slide) * 700);
    drawPanel(ctx, p.x, p.y, p.w, p.h, 'wood');
    text(ctx, '选择你的植物', p.x + p.w / 2, p.y + 32, { size: 30, color: '#fff3c8', stroke: '#3a2008', lw: 7 });
    const av = this.availablePlants();
    av.forEach((t, i) => {
      const g = this.gridPos(i);
      const chosen = this.chosen.includes(t);
      const flying = this.selectAnims.some(a => !a.toBank && a.type === t);
      rr(ctx, g.x, g.y, PACKET_W * g.s, PACKET_H * g.s, 6);
      fs(ctx, 'rgba(30,15,3,0.45)');
      if (!flying) drawPacket(ctx, g.x, g.y, t, { selected: chosen, hover: this.selHover === t && !chosen, scale: g.s, shadow: false });
      if (PLANTS[t].night && !this.board.isNight && !chosen) {
        text(ctx, 'Zz', g.x + PACKET_W * g.s - 10, g.y + 12, { size: 13, color: '#dfe8ff', stroke: '#223', lw: 3 });
      }
    });
    // 提示信息
    const ht = this.selHover;
    const infoY = p.y + p.h - 156;
    rr(ctx, p.x + 20, infoY, p.w - 40, 76, 10);
    fs(ctx, 'rgba(20,10,2,0.45)', 'rgba(255,230,160,0.25)', 1.5);
    if (ht) {
      const d = PLANTS[ht];
      text(ctx, d.name, p.x + 40, infoY + 22, { size: 22, color: '#ffe8a0', stroke: '#2a1404', lw: 5, align: 'left' });
      text(ctx, `花费 ${d.cost}   冷却 ${d.recharge <= 8 ? '快' : d.recharge <= 30 ? '慢' : '很慢'}${d.night && !this.board.isNight ? '   （白天会睡觉）' : ''}`, p.x + p.w - 40, infoY + 22, { size: 16, color: '#f0e0c0', align: 'right', weight: 700 });
      wrapText(ctx, d.desc, p.x + 40, infoY + 38, p.w - 80, 20, { size: 16, color: '#f8f0dc', weight: 500 });
    } else {
      text(ctx, `挑选 ${Math.min(this.maxSlots, av.length)} 株植物放进种子槽，然后开始战斗！`, p.x + p.w / 2, infoY + 41, { size: 18, color: '#f0e0c0', weight: 700 });
    }
    this.rockBtn.draw(ctx);
    ctx.restore();
    // 右侧僵尸预览说明
    if (this.phase === 'select') {
      const types = [...new Set(this.board.previewZombies.map(z => z.type))];
      text(ctx, '本关出现的僵尸', 960, 34, { size: 22, color: '#fff', stroke: '#000', lw: 5 });
      text(ctx, types.map(t => ZOMBIES[t].name).join('、'), 960, 64, { size: 16, color: '#ffe8a0', stroke: '#000', lw: 4, weight: 700 });
    }
  }

  drawPause(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, W, H);
    drawPanel(ctx, 390, 140, 500, 410, 'stone');
    text(ctx, '游戏暂停', 640, 188, { size: 36, color: '#e8f0d8', stroke: '#1a1c20', lw: 8 });
    this.pauseUI.draw(ctx);
    text(ctx, '快捷键：空格暂停 · 1-0 选卡 · S 铲子 · X 倍速 · F 全屏', 640, 580, { size: 15, color: '#d8d8c8', weight: 600 });
    ctx.restore();
  }
}

// 站在街上的预览僵尸
class ZombieProxy extends Zombie {
  constructor(board, type, row, x, y) {
    super(board, type, row, x, { preview: true, y });
    this.anim = 'idle';
    this.ducky = false;
    this.lookType = null;
  }
}

// 罐子
function drawVase(ctx, x, y, green, t, shake) {
  ctx.save();
  ctx.translate(x + Math.sin(t * 40) * shake, y);
  E(ctx, 0, 0, 30, 8);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fill();
  const body = green ? ['#b8e090', '#5a9a3a', '#2a4a18'] : ['#f0d8b0', '#b88a54', '#4a3018'];
  ctx.beginPath();
  ctx.moveTo(-14, -84);
  ctx.lineTo(14, -84);
  ctx.quadraticCurveTo(12, -74, 22, -64);
  ctx.bezierCurveTo(44, -44, 36, -8, 18, -2);
  ctx.lineTo(-18, -2);
  ctx.bezierCurveTo(-36, -8, -44, -44, -22, -64);
  ctx.quadraticCurveTo(-12, -74, -14, -84);
  ctx.closePath();
  fs(ctx, rg(ctx, -10, -50, 4, 0, -40, 50, [0, body[0], 1, body[1]]), body[2], 2.5);
  E(ctx, 0, -84, 16, 5);
  fs(ctx, body[1], body[2], 2);
  E(ctx, 0, -84, 11, 3);
  ctx.fillStyle = '#1a1008';
  ctx.fill();
  ctx.strokeStyle = green ? 'rgba(20,60,10,0.5)' : 'rgba(90,50,20,0.5)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-30, -40); ctx.quadraticCurveTo(0, -30, 30, -40);
  ctx.moveTo(-26, -24); ctx.quadraticCurveTo(0, -16, 26, -24);
  ctx.stroke();
  if (green) {
    ctx.save();
    ctx.translate(0, -48);
    ctx.beginPath();
    ctx.moveTo(-10, 6); ctx.quadraticCurveTo(-8, -10, 10, -10); ctx.quadraticCurveTo(8, 6, -10, 6);
    fs(ctx, '#e8ffb0', '#2a4a18', 1.5);
    ctx.restore();
  } else {
    text(ctx, '?', 0, -46, { size: 22, color: 'rgba(90,50,20,0.55)' });
  }
  ctx.save();
  ctx.globalAlpha *= 0.4;
  E(ctx, -14, -54, 5, 12, 0.3);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.restore();
  ctx.restore();
}

// 锤子光标
function drawMallet(ctx, x, y, k) {
  ctx.save();
  ctx.translate(x + 20, y - 10);
  const swing = k < 1 ? Math.sin(k * Math.PI) : 0;
  ctx.rotate(-0.6 + swing * 1.1);
  ctx.fillStyle = lg(ctx, -5, 0, 5, 0, [0, '#d8a060', 1, '#8a5a2a']);
  ctx.strokeStyle = '#3a2008';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.rect(-5, -10, 10, 70);
  ctx.fill();
  ctx.stroke();
  rr(ctx, -34, -40, 68, 36, 8);
  fs(ctx, lg(ctx, 0, -40, 0, -4, [0, '#c8c8c0', 1, '#6a6a64']), '#222', 2.5);
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fillRect(-30, -36, 60, 8);
  ctx.restore();
}
