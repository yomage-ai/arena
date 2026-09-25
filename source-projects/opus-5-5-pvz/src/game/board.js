// 棋盘：一局游戏的全部状态（格子、植物、僵尸、子弹、阳光、割草机、墓碑、冰道、特效），
// 以及种植规则、范围伤害、胜负判定和按行排序的绘制。
import { rand, randInt, clamp, choose, lerp, Ease, TAU, shuffle } from '../core/util.js';
import { audio } from '../core/audio.js';
import { music } from '../core/music.js';
import { save } from '../core/save.js';
import { PLANTS, ZOMBIES } from './defs.js';
import { LAWN_X, LAWN_TOP, COL_W, COLS, LAWN_RIGHT, envInfo, colX, colOf, WORLD_MIN_X, SPAWN_X } from './layout.js';
import { Plant } from './plant.js';
import { Zombie } from './zombie.js';
import { Projectile, BowlNut, Sun, Mower, Grave, Reward, StarShot } from './items.js';
import { drawFog, updateFog } from '../gfx/fog.js';
import { WaveDirector } from './waves.js';
import { Particles } from '../gfx/fx.js';
import { getBackground, drawWaterOverlay, drawNightOverlay, drawCloudShadows, drawVignette } from '../gfx/bgArt.js';
import { drawCrater } from '../gfx/uiArt.js';
import { drawFlame } from '../gfx/plantArt.js';
import { E, C, rg, lg, fs, text, rr } from '../gfx/paint.js';
import { drawMetalItem } from './plant.js';

export class Board {
  constructor(scene, level) {
    this.scene = scene;
    this.level = level;
    this.mode = level.mode || 'normal';
    this.env = level.env;
    this.info = envInfo(this.env);
    this.rows = this.info.rows;
    this.rowH = this.info.rowH;
    this.isNight = this.info.night;
    this.activeRows = level.rows ? level.rows.slice() : [...Array(this.rows).keys()];
    this.sodRows = level.sod || null;
    this.newSod = level.newSod || [];
    this.sodT = this.newSod.length ? 0 : 1;
    this.cells = [];
    for (let r = 0; r < this.rows; r++) {
      this.cells.push([]);
      for (let c = 0; c < COLS; c++) this.cells[r].push({ base: null, main: null, shell: null, overlay: null, grave: null, crater: 0, vase: null });
    }
    this.plants = [];
    this.zombies = [];
    this.projectiles = [];
    this.stars = [];
    this.suns = [];
    this.mowers = [];
    this.graves = [];
    this.bowls = [];
    this.rewards = [];
    this.effects = [];
    this.vases = [];
    this.fx = new Particles();
    this.time = 0;
    this.sun = level.sun ?? 50;
    const noSkyModes = ['conveyor', 'bowling', 'vase', 'whack'];
    this.skySun = level.skySun ?? (!this.isNight && !noSkyModes.includes(this.mode));
    this.skyTimer = 5;
    this.waves = new WaveDirector(this, level);
    this.running = false;
    this.shakeAmt = 0;
    this.ice = {};
    this.showHealth = save.settings.healthBars;
    this.autoCollect = save.settings.autoCollect;
    this.drawScale = 1;
    this.entityScale = this.env === 'pool' ? 0.92 : 1;
    this.moversArrive = false;
    this.intenseT = 0;
    this.kills = 0;
    this.lastKill = null;
    this.won = false;
    this.lost = false;
    this.invisible = !!level.invisible;
    this.previewZombies = [];
    // 浓雾
    this.fogCols = level.fog || 0;
    this.fogAmt = this.fogCols ? Array.from({ length: this.rows }, () => new Array(12).fill(0)) : null;
    this.fogBlowT = 0;
    this.storm = !!level.storm;
    this.lightningT = 5;
    this.flashT = 0;
    for (const r of this.activeRows) if (this.mode !== 'vase') this.mowers.push(new Mower(this, r));
    // 夜晚墓碑
    const g = level.graves || 0;
    if (g > 0) this.placeGraves(g, this.mode === 'whack' ? 2 : 4);
  }

  // ---------- 几何 ----------
  rowY(r) { return LAWN_TOP + r * this.rowH + this.rowH * 0.8; }
  rowTop(r) { return LAWN_TOP + r * this.rowH; }
  isWater(r) { return this.info.water.includes(r); }
  activeRow(r) { return this.activeRows.includes(r); }
  cellOf(c, r) { return this.cells[r]?.[c]; }
  cellAt(x, y) {
    if (x < LAWN_X || x >= LAWN_RIGHT || y < LAWN_TOP) return null;
    const c = colOf(x);
    const r = Math.floor((y - LAWN_TOP) / this.rowH);
    if (r < 0 || r >= this.rows || c < 0 || c >= COLS) return null;
    return { col: c, row: r };
  }

  placeGraves(n, minCol) {
    const spots = [];
    for (const r of this.activeRows) for (let c = minCol; c < COLS; c++) if (!this.isWater(r)) spots.push([c, r]);
    shuffle(spots);
    const perRow = {};
    let placed = 0;
    for (const [c, r] of spots) {
      if (placed >= n) break;
      if ((perRow[r] || 0) >= Math.ceil(n / this.activeRows.length) + 1) continue;
      this.addGrave(c, r, true);
      perRow[r] = (perRow[r] || 0) + 1;
      placed++;
    }
  }

  addGrave(c, r, instant = false) {
    const cell = this.cellOf(c, r);
    if (!cell || cell.grave || cell.main || cell.base) return null;
    const g = new Grave(this, c, r, { instant });
    cell.grave = g;
    this.graves.push(g);
    return g;
  }

  graveAt(c, r) { return this.cellOf(c, r)?.grave || null; }
  removeGrave(g) {
    const cell = this.cellOf(g.col, g.row);
    if (cell && cell.grave === g) cell.grave = null;
    this.graves = this.graves.filter(x => x !== g);
  }

  // ---------- 种植规则 ----------
  canPlant(type, c, r) {
    if (!this.activeRow(r)) return { ok: false };
    const cell = this.cellOf(c, r);
    if (!cell) return { ok: false };
    const def = PLANTS[type];
    if (!def) return { ok: false };
    if (cell.crater > 0) return { ok: false, reason: '弹坑里不能种植物' };
    if (this.iceAt(c, r)) return { ok: false, reason: '冰道上不能种植物' };
    if (cell.vase) return { ok: false };
    if (this.mode === 'bowling') {
      if (c > 2) return { ok: false, reason: '只能种在红线左侧' };
      return { ok: true };
    }
    if (type === 'gravebuster') return cell.grave && !cell.main ? { ok: true } : { ok: false, reason: '墓碑吞噬者只能种在墓碑上' };
    if (cell.grave) return { ok: false, reason: '不能种在墓碑上' };
    if (type === 'coffeebean') {
      if (cell.main && cell.main.sleep && !cell.overlay) return { ok: true };
      return { ok: false, reason: '咖啡豆只能种在睡觉的蘑菇上' };
    }
    const water = this.isWater(r);
    if (def.shell) {
      if (cell.shell) return { ok: false };
      if (water && !cell.base) return { ok: false, reason: '需要先种一片睡莲' };
      if (cell.main && (cell.main.kind === 'spike' || cell.main.def.tall)) return { ok: false };
      return { ok: true };
    }
    if (def.aquatic) {
      if (!water) return { ok: false, reason: '只能种在水里' };
      if (cell.base || cell.main || cell.shell) return { ok: false };
      return { ok: true };
    }
    if (water && type === 'spikeweed') return { ok: false, reason: '地刺不能种在水面上' };
    if (water && !cell.base) return { ok: false, reason: '需要先种一片睡莲' };
    if (cell.main) return { ok: false };
    if (this.sodRows && !this.sodRows.includes(r)) return { ok: false };
    return { ok: true };
  }

  plantAt(r, frontX) {
    let best = null;
    for (const p of this.plants) {
      if (p.row !== r || !p.blocking) continue;
      if (frontX <= p.x + 32 && frontX >= p.x - 40) {
        const pri = { shell: 3, main: 2, base: 1 };
        if (!best || (pri[p.slot] || 0) > (pri[best.slot] || 0)) best = p;
      }
    }
    return best;
  }

  plantAhead(z, dist) {
    let best = null;
    for (const p of this.plants) {
      if (p.row !== z.row || p.dead || p.slot === 'overlay' || p.kind === 'spike') continue;
      if (p.slot === 'base' && this.cellOf(p.col, p.row).main) continue;
      const d = z.front - (p.x + 30);
      if (d >= -10 && d <= dist && p.x < z.x) if (!best || p.x > best.x) best = p;
    }
    return best;
  }

  plantUnder(r, x, w) {
    for (const p of this.plants) {
      if (p.row !== r || p.dead || p.slot === 'overlay') continue;
      if (p.kind === 'squash' && p.state !== 'idle') continue;
      if (Math.abs(p.x - x) < w) return p;
    }
    return null;
  }

  placePlant(type, c, r, o = {}) {
    const cell = this.cellOf(c, r);
    const def = PLANTS[type];
    let slot = 'main';
    if (def.kind === 'base') slot = 'base';
    if (def.shell) slot = 'shell';
    if (type === 'coffeebean') slot = 'overlay';
    const p = new Plant(this, type, c, r, { onPad: (slot === 'main' || slot === 'shell') && !!cell.base, slot, awake: o.awake });
    cell[slot] = p;
    this.plants.push(p);
    save.data.stats.plantsPlanted++;
    const water = this.isWater(r) && !cell.base;
    if (water || (def.aquatic)) { audio.play('plantwater'); this.splash(p.x, p.y, 0.8); }
    else { audio.play('plant'); this.fx.dirt(p.x, p.y, 8, 26); }
    return p;
  }

  removePlant(p) {
    const cell = this.cellOf(p.col, p.row);
    if (cell) for (const k of ['base', 'main', 'shell', 'overlay']) if (cell[k] === p) cell[k] = null;
    p.dead = true;
    // 睡莲被吃掉时，上面的植物落水
    if (p.slot === 'base' && cell) {
      for (const k of ['main', 'shell']) {
        if (!cell[k]) continue;
        const m = cell[k];
        this.removePlant(m);
        this.splash(m.x, m.y);
      }
    }
  }

  clearCellSlot(p) {
    const cell = this.cellOf(p.col, p.row);
    if (cell) for (const k of ['base', 'main', 'shell', 'overlay']) if (cell[k] === p) cell[k] = null;
    p.detached = true;
  }

  removeFree(p) { p.dead = true; }

  shovel(c, r) {
    const cell = this.cellOf(c, r);
    if (!cell) return false;
    const p = cell.overlay || cell.main || cell.shell || cell.base;
    if (!p) return false;
    this.removePlant(p);
    audio.play('shovel');
    this.fx.dirt(p.x, p.y, 10, 22, ['#4f9a2a', '#7a5230', '#3a7a1e']);
    return p;
  }

  // ---------- 查询 ----------
  enemyInRow(r, x0, x1) {
    for (const z of this.zombies) {
      if (z.row === r && z.isEnemy && z.hittable && z.x + z.halfWidth >= x0 && z.x - z.halfWidth <= x1) return true;
    }
    return false;
  }

  // ---------- 生成 ----------
  addProjectile(kind, x, y, row, o) {
    const p = new Projectile(this, kind, x, y, row, o);
    this.projectiles.push(p);
    return p;
  }

  spawnZombie(type, row, x, o = {}) {
    const z = new Zombie(this, type, row, x ?? SPAWN_X, o);
    this.zombies.push(z);
    if (!o.preview) save.seeZombie(type === 'normal' && z.ducky ? 'ducky' : type);
    return z;
  }

  produceSun(x, y, value) {
    this.suns.push(new Sun(this, x, y, value, { vx: rand(-45, 45), vy: -230, groundY: y + rand(40, 60) }));
  }

  spawnSkySun() {
    const r = choose(this.activeRows);
    const x = rand(LAWN_X + 50, LAWN_RIGHT - 50);
    this.suns.push(new Sun(this, x, -30, 25, { fall: true, targetY: this.rowY(r) - 40 }));
  }

  collectSun(s) {
    this.sun += s.value;
    save.data.stats.sunCollected += s.value;
  }

  onSunArrived() { this.scene.sunPulse?.(); }
  sunTarget() { return this.scene.sunCounterWorld(); }

  // ---------- 事件 ----------
  onZombieKilled(z, hypno = false) {
    if (z.preview) return;
    if (!hypno) {
      this.kills++;
      save.data.stats.zombiesKilled++;
    }
    this.lastKill = { x: clamp(z.x, LAWN_X + 60, LAWN_RIGHT - 40), y: this.rowY(z.row) };
  }

  triggerMower(r, z) {
    const m = this.mowers.find(m => m.row === r && (m.state === 'idle' || m.state === 'arrive') && m.x > z.x - 40);
    if (m) m.trigger();
  }

  zombieReachedHouse(z) {
    if (this.lost || this.won) return;
    const running = this.mowers.some(m => m.row === z.row && m.state === 'run' && m.x < z.x + 60);
    if (running) return;
    this.lost = true;
    this.scene.onLose?.(z);
  }

  message(kind) { this.scene.showMessage?.(kind); }

  onFinalWave() { this.finalWave = true; }

  onSurvivalFlag(n) { this.scene.onSurvivalFlag?.(n); }

  shake(a) { this.shakeAmt = Math.max(this.shakeAmt, a); }

  splash(x, y, s = 1) {
    for (let i = 0; i < 10 * s; i++) {
      this.fx.add({ type: 'dot', x: x + rand(-20, 20), y: y - 4, vx: rand(-90, 90), vy: rand(-260, -80), g: 800, size: rand(2, 4.5), color: 'rgba(220,245,255,0.9)', life: rand(0.4, 0.7) });
    }
    this.fx.add({ type: 'ring', x, y, size: 8, grow: 4, color: 'rgba(230,250,255,0.8)', width: 3, life: 0.6 });
  }

  // ---------- 范围效果 ----------
  explodeArea(x, y, row, dc, dr, kind) {
    for (const z of this.zombies) {
      if (!z.isEnemy || !z.alive) continue;
      if (Math.abs(z.row - row) > dr) continue;
      if (Math.abs(z.x - x) > (dc + 0.5) * COL_W + 25) continue;
      z.takeDamage(1800, 'explode');
    }
    audio.play('explode');
    this.shake(12);
    this.fx.explosion(x, y - 40, 1.25, kind === 'cherry' ? { text: '轰！', textColor: '#ffe23a' } : {});
  }

  burnRow(r) {
    for (const z of this.zombies) {
      if (z.isEnemy && z.alive && z.row === r && z.x < 1290) z.takeDamage(1800, 'fire-row');
    }
    delete this.ice[r];
    audio.play('jalapeno');
    this.shake(10);
    this.effects.push({ type: 'rowfire', row: r, t: 0, life: 1.3 });
  }

  freezeAll(x, y) {
    for (const z of this.zombies) {
      if (z.isEnemy && z.alive && z.x < 1270) {
        z.freeze(rand(4.5, 6));
        z.takeDamage(20, 'freeze');
      }
    }
    audio.play('freeze');
    this.effects.push({ type: 'iceflash', t: 0, life: 1.4, x, y });
    this.fx.iceShards(x, y - 30, 20);
  }

  doom(c, r, x, y) {
    for (const z of this.zombies) {
      if (!z.isEnemy || !z.alive) continue;
      const d = Math.hypot(z.x - x, (z.row - r) * 100);
      if (d <= 300) z.takeDamage(1800, 'doom');
    }
    const cell = this.cellOf(c, r);
    if (cell) {
      for (const k of ['base', 'main', 'shell', 'overlay']) if (cell[k]) this.removePlant(cell[k]);
      cell.crater = 180;
    }
    audio.play('doom');
    this.shake(22);
    this.effects.push({ type: 'doomcloud', t: 0, life: 2.6, x, y });
    this.fx.explosion(x, y - 40, 2.2);
  }

  fumeCloud(x0, y, x1) {
    for (let x = x0; x < x1; x += 26) {
      this.fx.add({
        type: 'glow', x: x + rand(-8, 8), y: y + rand(-10, 10), vx: rand(10, 40), vy: rand(-12, 12),
        size: rand(14, 22), grow: 0.8, color: 'rgba(200,140,240,0.6)', life: 0.35 + ((x - x0) / (x1 - x0 + 1)) * 0.3, fadeIn: 0.05,
      });
    }
  }

  flyingItem(item, x, y, magnet) {
    this.effects.push({ type: 'flyitem', item, x0: x, y0: y, t: 0, life: 0.5, magnet });
  }

  leaveIce(r, x) {
    const cur = this.ice[r];
    if (!cur) this.ice[r] = { x, melt: -1 };
    else { cur.x = Math.min(cur.x, x); cur.melt = -1; }
  }
  zomboniDied(r) { if (this.ice[r]) this.ice[r].melt = 25; }
  iceAt(c, r) { const i = this.ice[r]; return i && colX(c) + 30 > i.x; }

  addStar(x, y, vx, vy) { this.stars.push(new StarShot(this, x, y, vx, vy)); }

  // 三叶草：吹走气球僵尸与浓雾
  blowAway(x, y) {
    for (const z of this.zombies) if (z.isEnemy && z.balloonUp && z.alive) z.blowAway();
    if (this.fogCols) this.fogBlowT = 16;
    audio.play('wind');
    for (let i = 0; i < 40; i++) {
      this.fx.add({
        type: 'rect', x: rand(-60, 700), y: rand(150, 700), vx: rand(700, 1100), vy: rand(-60, 60), size: rand(5, 10), aspect: 0.5,
        color: choose(['#7ac04a', '#a8e06a', '#5a9a3a', 'rgba(255,255,255,0.6)']), rot: rand(TAU), vr: rand(-10, 10), life: rand(0.8, 1.4),
      }, 'top');
    }
  }

  // 小丑僵尸爆炸：摧毁附近 3×3 的植物
  explodePlants(x, row) {
    for (const p of this.plants.slice()) {
      if (p.dead || Math.abs(p.row - row) > 1 || Math.abs(p.x - x) > 150) continue;
      this.removePlant(p);
      this.fx.dirt(p.x, p.y, 6, 20, ['#4f9a2a', '#3a2a1a', '#7ac04a']);
    }
  }

  // ---------- 保龄球 ----------
  launchBowl(kind, c, r) {
    const b = new BowlNut(this, kind, r, colX(c));
    this.bowls.push(b);
    return b;
  }

  // ---------- 锤子 ----------
  whackAt(x, y) {
    let best = null;
    for (const z of this.zombies) {
      if (!z.isEnemy || !z.alive || z.state === 'rise' && z.riseT < 0.3) continue;
      const zy = this.rowY(z.row);
      if (x > z.x - 34 && x < z.x + 34 && y > zy - 160 && y < zy + 10) {
        if (!best || zy > this.rowY(best.row)) best = z;
      }
    }
    if (best) {
      const dmg = best.armor ? best.armor.hp : best.hp + 5;
      best.takeDamage(dmg, 'whack');
      this.fx.add({ type: 'ring', x, y: y, size: 10, grow: 3, color: 'rgba(255,255,255,0.9)', width: 5, life: 0.3 }, 'top');
      this.fx.sparks(x, y, 10, '#fff');
      if (!best.alive && Math.random() < 0.55) this.produceSun(best.x, best.y - 60, 25);
      this.shake(3);
    }
    return best;
  }

  // ---------- 主更新 ----------
  update(dt) {
    this.time += dt;
    if (this.shakeAmt > 0) this.shakeAmt = Math.max(0, this.shakeAmt - dt * 40);
    if (this.sodT < 1 && this.sodRolling) this.sodT = Math.min(1, this.sodT + dt * 0.7);

    for (const z of this.previewZombies) z.update(dt);
    for (const m of this.mowers) m.update(dt);
    for (const g of this.graves) g.update(dt);

    if (this.running) {
      if (this.skySun) {
        this.skyTimer -= dt;
        if (this.skyTimer <= 0) { this.spawnSkySun(); this.skyTimer = rand(7, 11); }
      }
      if (!this.won && !this.noWaves) this.waves.update(dt);
      for (const p of this.plants) if (!p.dead) p.update(dt);
      for (const z of this.zombies) if (!z.dead) z.update(dt);
      for (const p of this.projectiles) p.update(dt);
      for (const s of this.stars) s.update(dt);
      for (const b of this.bowls) b.update(dt);
    }
    for (const s of this.suns) s.update(dt);
    for (const r of this.rewards) r.update(dt);

    // 冰道融化 / 弹坑
    for (const k of Object.keys(this.ice)) {
      const i = this.ice[k];
      if (i.melt > 0) { i.melt -= dt; if (i.melt <= 0) delete this.ice[k]; }
    }
    for (const row of this.cells) for (const cell of row) if (cell.crater > 0) cell.crater = Math.max(0, cell.crater - dt);

    for (const e of this.effects) e.t += dt;
    this.effects = this.effects.filter(e => e.t < e.life);
    this.fx.update(dt);

    this.plants = this.plants.filter(p => !p.dead);
    this.zombies = this.zombies.filter(z => !z.dead);
    this.projectiles = this.projectiles.filter(p => !p.dead);
    this.stars = this.stars.filter(p => !p.dead);
    if (this.fogAmt) updateFog(this, dt);
    this.bowls = this.bowls.filter(b => !b.dead);
    this.suns = this.suns.filter(s => !s.dead);
    this.mowers = this.mowers.filter(m => !m.dead);

    if (this.intenseT > 0) { this.intenseT -= dt; if (this.intenseT <= 0) music.setLayer('intense', 0); }

    // 胜利判定
    if (this.running && !this.won && !this.lost && this.waves.allSpawned && !this.noWinCheck) {
      const left = this.zombies.some(z => z.isEnemy && (z.alive || z.state === 'flying'));
      if (!left) {
        this.won = true;
        this.scene.onWin?.(this.lastKill || { x: 700, y: this.rowY(this.activeRows[0]) });
      }
    }
  }

  // ---------- 绘制（世界坐标） ----------
  drawBackground(ctx, camX) {
    const bg = getBackground(this.env);
    const s = bg.scale;
    if (!this.sodRows) {
      ctx.drawImage(bg.canvas, (camX - WORLD_MIN_X) * s, 0, 1280 * s, 720 * s, camX, 0, 1280, 720);
      return;
    }
    const dirt = getBackground(this.env, true);
    ctx.drawImage(dirt.canvas, (camX - WORLD_MIN_X) * s, 0, 1280 * s, 720 * s, camX, 0, 1280, 720);
    // 已铺草皮的行
    for (const r of this.sodRows) {
      const isNew = this.newSod.includes(r);
      const k = isNew ? Ease.inOutSine(this.sodT) : 1;
      if (k <= 0) continue;
      const y0 = this.rowTop(r) - 2, h = this.rowH + 4;
      const w = (LAWN_RIGHT - LAWN_X + 4) * k;
      ctx.drawImage(bg.canvas, (LAWN_X - 2 - WORLD_MIN_X) * s, y0 * s, w * s, h * s, LAWN_X - 2, y0, w, h);
      if (isNew && k < 1) {
        // 草皮卷：俯视的圆柱体，底端露出泥土螺旋
        const d = 46 * (1 - k * 0.45);
        const x0 = LAWN_X + w - 6;
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(x0 + 6, y0 + 8, d, h - 6);
        rr(ctx, x0, y0 + 2, d, h - 6, d * 0.35);
        fs(ctx, lg(ctx, x0, 0, x0 + d, 0, [0, '#2f6a18', 0.4, '#9ee85a', 0.6, '#7ac840', 1, '#2a5a12']), '#1a3a0a', 2);
        ctx.strokeStyle = 'rgba(20,50,8,0.35)';
        ctx.lineWidth = 1.2;
        for (let yy = y0 + 10; yy < y0 + h - 10; yy += 9) { ctx.beginPath(); ctx.moveTo(x0 + 4, yy); ctx.lineTo(x0 + d - 4, yy + 3); ctx.stroke(); }
        E(ctx, x0 + d / 2, y0 + h - 6, d / 2, d / 4.2);
        fs(ctx, '#7a5230', '#3a2410', 1.5);
        ctx.beginPath();
        for (let i = 0; i < 26; i++) {
          const a = i * 0.55 + (1 - k) * 20, rrr = (i / 26) * (d / 2 - 2);
          const px = x0 + d / 2 + Math.cos(a) * rrr, py = y0 + h - 6 + Math.sin(a) * rrr * 0.45;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.strokeStyle = '#4a8a24';
        ctx.lineWidth = 1.6;
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  draw(ctx, camX) {
    this.drawBackground(ctx, camX);
    if (this.info.water.length) drawWaterOverlay(ctx, this.env, this.time);
    if (!this.isNight) drawCloudShadows(ctx, this.time);
    // 冰道
    for (const k of Object.keys(this.ice)) {
      const r = +k, i = this.ice[k];
      const y = this.rowY(r);
      ctx.save();
      ctx.globalAlpha = i.melt > 0 ? Math.min(1, i.melt / 3) : 1;
      ctx.fillStyle = lg(ctx, 0, y - 30, 0, y + 6, [0, 'rgba(230,248,255,0.9)', 1, 'rgba(160,210,240,0.85)']);
      ctx.fillRect(i.x, y - 26, 1300 - i.x, 30);
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      for (let x = i.x + 10; x < 1300; x += 60) ctx.fillRect(x, y - 20, 30, 3);
      ctx.restore();
    }
    // 弹坑
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < COLS; c++) {
      const cell = this.cells[r][c];
      if (cell.crater > 0) drawCrater(ctx, colX(c), this.rowY(r), this.time, cell.crater / 180);
    }
    // 保龄球红线
    if (this.mode === 'bowling') {
      ctx.save();
      const x = LAWN_X + 3 * COL_W;
      ctx.strokeStyle = 'rgba(220,30,20,0.85)';
      ctx.lineWidth = 5;
      ctx.setLineDash([16, 10]);
      ctx.beginPath();
      ctx.moveTo(x, LAWN_TOP + 4);
      ctx.lineTo(x, LAWN_TOP + this.rows * this.rowH - 4);
      ctx.stroke();
      ctx.restore();
    }
    this.scene.drawCellHighlight?.(ctx);

    // 按行绘制
    const zombiesByRow = [];
    for (let r = 0; r < this.rows; r++) zombiesByRow.push([]);
    for (const z of this.zombies) zombiesByRow[z.row]?.push(z);
    for (const z of this.previewZombies) zombiesByRow[z.row]?.push(z);
    for (let r = 0; r < this.rows; r++) {
      for (const g of this.graves) if (g.row === r) g.draw(ctx);
      for (const v of this.vases) if (v.row === r) v.draw(ctx);
      for (const m of this.mowers) if (m.row === r) m.draw(ctx);
      for (const p of this.plants) if (p.row === r && p.slot === 'base') p.draw(ctx);
      for (const p of this.plants) if (p.row === r && p.slot === 'shell') p.draw(ctx, 'back');
      for (const p of this.plants) if (p.row === r && p.slot === 'main' && !p.airborneTop) p.draw(ctx);
      for (const p of this.plants) if (p.row === r && p.slot === 'shell') p.draw(ctx, 'front');
      for (const p of this.plants) if (p.row === r && p.slot === 'overlay') p.draw(ctx);
      const zs = zombiesByRow[r].sort((a, b) => b.x - a.x);
      for (const z of zs) {
        if (this.invisible && z.isEnemy && z.flash <= 0 && z.alive && z.freezeT <= 0) {
          // 隐形：只画影子
          E(ctx, z.x, z.y, 26, 7);
          ctx.fillStyle = 'rgba(0,0,0,0.25)';
          ctx.fill();
          continue;
        }
        z.draw(ctx);
      }
      for (const p of this.plants) if (p.row === r && p.airborneTop) p.draw(ctx);
      for (const b of this.bowls) if (b.row === r || (b.dirY && Math.abs(this.rowY(r) - b.y) < this.rowH / 2)) b.draw(ctx);
      for (const p of this.projectiles) if (p.row === r) p.draw(ctx);
    }
    for (const s of this.stars) s.draw(ctx);
    // 特效
    for (const e of this.effects) this.drawEffect(ctx, e);
    this.fx.draw(ctx);
    if (this.fogAmt) drawFog(ctx, this, camX);
    if (this.isNight && this.env === 'night') drawNightOverlay(ctx, this.time);
    if (this.isNight) drawVignette(ctx, camX);
  }

  drawTop(ctx) {
    for (const s of this.suns) s.draw(ctx);
    for (const r of this.rewards) r.draw(ctx, this.time);
    this.fx.draw(ctx, 'top');
  }

  drawEffect(ctx, e) {
    const k = e.t / e.life;
    if (e.type === 'rowfire') {
      const y = this.rowY(e.row);
      const a = k < 0.15 ? k / 0.15 : k > 0.7 ? (1 - k) / 0.3 : 1;
      ctx.save();
      ctx.globalAlpha = a;
      for (let x = LAWN_X - 20; x < 1290; x += 46) {
        drawFlame(ctx, x + Math.sin(x) * 8, y + 4, 60, 110 * (0.8 + 0.3 * Math.sin(x * 0.1 + e.t * 10)), e.t + x * 0.01, 1);
      }
      ctx.restore();
    } else if (e.type === 'iceflash') {
      ctx.save();
      ctx.globalAlpha = (1 - k) * 0.75;
      ctx.fillStyle = '#e0f6ff';
      ctx.fillRect(-300, 0, 1900, 720);
      ctx.restore();
    } else if (e.type === 'doomcloud') {
      ctx.save();
      const a = k < 0.1 ? k / 0.1 : 1 - Math.max(0, (k - 0.5) / 0.5);
      ctx.globalAlpha = a;
      // 白闪
      if (k < 0.15) {
        ctx.fillStyle = `rgba(255,240,255,${(1 - k / 0.15) * 0.8})`;
        ctx.fillRect(-300, 0, 1900, 720);
      }
      const rise = Ease.outCubic(Math.min(1, k * 2));
      const cx = e.x, cy = e.y - 20 - rise * 150;
      // 蘑菇云柱
      ctx.fillStyle = lg(ctx, cx, e.y, cx, cy, [0, 'rgba(60,40,70,0.9)', 1, 'rgba(160,90,160,0.85)']);
      ctx.beginPath();
      ctx.moveTo(cx - 40, e.y);
      ctx.quadraticCurveTo(cx - 18, (e.y + cy) / 2, cx - 26, cy);
      ctx.lineTo(cx + 26, cy);
      ctx.quadraticCurveTo(cx + 18, (e.y + cy) / 2, cx + 40, e.y);
      ctx.fill();
      // 云帽
      for (let i = 0; i < 9; i++) {
        const a2 = (i / 9) * TAU + e.t;
        const rx = cx + Math.cos(a2) * 70 * rise, ry = cy + Math.sin(a2) * 26 * rise;
        C(ctx, rx, ry, 44 * rise);
        ctx.fillStyle = rg(ctx, rx - 10, ry - 10, 4, rx, ry, 44 * rise + 1, [0, 'rgba(255,180,220,0.9)', 0.6, 'rgba(160,80,160,0.9)', 1, 'rgba(60,30,70,0.8)']);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'lighter';
      C(ctx, cx, cy, 80 * rise);
      ctx.fillStyle = rg(ctx, cx, cy, 5, cx, cy, 80 * rise + 1, [0, 'rgba(255,200,120,0.5)', 1, 'rgba(255,60,0,0)']);
      ctx.fill();
      ctx.restore();
    } else if (e.type === 'flyitem') {
      const m = e.magnet;
      const kk = Ease.inOutQuad(k);
      const x = lerp(e.x0, m.x, kk), y = lerp(e.y0, m.y - 72, kk) - Math.sin(kk * Math.PI) * 40;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1 - kk * 0.5, 1 - kk * 0.5);
      drawMetalItem(ctx, e.item);
      ctx.restore();
    }
  }
}
