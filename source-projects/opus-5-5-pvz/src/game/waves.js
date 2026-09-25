// 波次导演：按点数预算生成每一波僵尸，控制间隔、提前触发、旗帜波（一大波）与最后一波。
import { rand, weightedChoice, clamp, choose, shuffle } from '../core/util.js';
import { ZOMBIES } from './defs.js';
import { SPAWN_X } from './layout.js';
import { audio } from '../core/audio.js';
import { music } from '../core/music.js';

export class WaveDirector {
  constructor(board, level) {
    this.board = board;
    this.level = level;
    this.total = level.waves || 10;
    this.endless = level.mode === 'survival';
    this.flagEvery = level.flagEvery || 10;
    this.wave = 0; // 已出的波数
    this.timer = level.firstDelay ?? (level.mode === 'whack' ? 6 : 18);
    this.state = 'wait';
    this.pending = []; // 分批延迟出生
    this.waveZombies = [];
    this.waveHp0 = 1;
    this.sinceSpawn = 0;
    this.done = false;
    this.rowUse = new Map();
    this.progressShown = 0;
    this.flagsPassed = 0;
  }

  isFlagWave(i) {
    // i：0 基
    if (this.endless) return (i + 1) % this.flagEvery === 0;
    return (i + 1) % this.flagEvery === 0 || i === this.total - 1;
  }

  get flagCount() {
    if (this.endless) return 0;
    let n = 0;
    for (let i = 0; i < this.total; i++) if (this.isFlagWave(i)) n++;
    return n;
  }

  get progress() {
    if (this.endless) return 0;
    return clamp(this.wave / this.total, 0, 1);
  }

  update(dt) {
    const b = this.board;
    // 处理延迟出生
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const p = this.pending[i];
      p.delay -= dt;
      if (p.delay <= 0) {
        this.pending.splice(i, 1);
        const z = p.whack
          ? b.spawnZombie(p.type, p.row, p.x, { waveId: p.waveId, state: 'rise', riseDur: 0.6, speedMul: 1.35 })
          : b.spawnZombie(p.type, p.row, p.x, { waveId: p.waveId, hpMul: p.hpMul });
        if (p.whack) b.fx.dirt(p.x, b.rowY(p.row), 8, 20);
        this.waveZombies.push(z);
      }
    }
    if (this.done) return;
    this.sinceSpawn += dt;
    this.timer -= dt;
    // 当前波僵尸血量削减过半，提前召唤下一波
    if (this.wave > 0 && this.pending.length === 0 && this.state === 'wait') {
      const alive = this.waveZombies.filter(z => z.alive && z.isEnemy);
      const hp = alive.reduce((s, z) => s + z.totalHp, 0);
      if (this.sinceSpawn > 5 && hp < this.waveHp0 * 0.5) this.timer = Math.min(this.timer, 2.5);
      if (this.sinceSpawn > 3 && alive.length === 0) this.timer = Math.min(this.timer, 1);
    }
    if (this.timer > 0) return;

    const i = this.wave;
    if (this.isFlagWave(i) && this.state !== 'announced') {
      this.state = 'announced';
      this.timer = 6.5;
      b.message('huge');
      audio.play('hugewave');
      music.setLayer('intense', 1);
      return;
    }
    this.spawnWave(i);
    this.state = 'wait';
    this.wave++;
    this.sinceSpawn = 0;
    this.timer = this.level.mode === 'whack' ? rand(9, 13) : rand(24, 30);
    if (i === 0) audio.play('awooga');
    if (this.isFlagWave(i)) {
      this.flagsPassed++;
      b.intenseT = 14;
      const final = !this.endless && i === this.total - 1;
      if (final) {
        b.message('final');
        audio.play('finalwave');
        b.onFinalWave();
      } else if (this.endless) {
        b.onSurvivalFlag(this.flagsPassed);
      }
    }
    if (!this.endless && this.wave >= this.total) this.done = true;
  }

  budget(i) {
    const L = this.level;
    const diff = L.diff || 1;
    let pts = (1 + i * (L.ramp ?? 0.4)) * diff;
    if (this.endless) pts = (2 + i * 0.55 + Math.pow(i, 1.25) * 0.08) * diff;
    if (i === 0) pts = 1;
    if (this.isFlagWave(i)) pts *= 2.5;
    return Math.max(1, Math.floor(pts));
  }

  pickRow(type) {
    const b = this.board;
    const def = ZOMBIES[type];
    let rows = b.activeRows.slice();
    if (def.water) rows = rows.filter(r => b.isWater(r));
    else if (def.land || !['normal', 'cone', 'bucket', 'flag'].includes(type)) rows = rows.filter(r => !b.isWater(r));
    if (!rows.length) rows = b.activeRows.slice();
    // 倾向于较少被使用的行
    const r = weightedChoice(rows, r => 1 / (1 + (this.rowUse.get(r) || 0)));
    this.rowUse.set(r, (this.rowUse.get(r) || 0) + 1);
    for (const [k, v] of this.rowUse) this.rowUse.set(k, v * 0.8);
    return r;
  }

  composeWave(i) {
    const L = this.level;
    const b = this.board;
    let pts = this.budget(i);
    const list = [];
    const flag = this.isFlagWave(i);
    if (flag) list.push('flag');
    const pool = L.zombies.filter(t => ZOMBIES[t] && ZOMBIES[t].weight > 0);
    const hasWater = b.activeRows.some(r => b.isWater(r));
    const hasLand = b.activeRows.some(r => !b.isWater(r));
    const usable = pool.filter(t => (ZOMBIES[t].water ? hasWater : true) && (ZOMBIES[t].land ? hasLand : true));
    // 新僵尸登场
    const introWave = this.endless ? 1 : Math.max(1, Math.floor(this.total * 0.2));
    if (L.intro && ZOMBIES[L.intro]?.weight > 0 && i >= introWave && (i - introWave) % 4 === 0 && usable.includes(L.intro)) {
      list.push(L.intro);
      pts -= ZOMBIES[L.intro].pts;
    }
    const lvlScale = this.endless ? 1 : Math.min(1, (this.total) / 20);
    let guard = 0;
    while (pts > 0 && guard++ < 200) {
      const cands = usable.filter(t => {
        const d = ZOMBIES[t];
        const minWave = this.endless ? Math.floor((d.firstWave || 0) * 0.6) : Math.floor((d.firstWave || 0) * lvlScale);
        return d.pts <= pts && i >= minWave;
      });
      const t = cands.length ? weightedChoice(cands, t => ZOMBIES[t].weight) : 'normal';
      list.push(t);
      pts -= ZOMBIES[t].pts;
    }
    return list;
  }

  spawnWave(i) {
    const b = this.board;
    const list = this.composeWave(i);
    this.waveZombies = [];
    let hp0 = 0;
    const hpMul = this.endless ? 1 + Math.floor(i / 20) * 0.15 : 1;
    if (this.level.mode === 'whack') return this.spawnWhackWave(i, list);
    list.forEach((type, k) => {
      const row = this.pickRow(type);
      const d = ZOMBIES[type];
      hp0 += (d.hp + (d.armor?.hp || 0) + (d.shield?.hp || 0)) * hpMul;
      this.pending.push({
        type, row, x: SPAWN_X + rand(0, 50) + (type === 'flag' ? -10 : 0), waveId: i, hpMul,
        delay: type === 'flag' ? 0 : rand(0, Math.min(3.5, 0.4 + list.length * 0.25)),
      });
    });
    this.waveHp0 = Math.max(1, hp0);
    // 夜晚：最后一波（或生存模式每个旗帜波）从墓碑里钻出僵尸
    if (this.isFlagWave(i) && b.graves.length) {
      for (const g of b.graves) {
        const t = choose(this.level.zombies.filter(t => ['normal', 'cone', 'bucket'].includes(t)).concat(['normal']));
        const z = b.spawnZombie(t, g.row, g.x + 10, { state: 'rise', waveId: i });
        this.waveZombies.push(z);
        b.fx.dirt(g.x, g.y, 12, 25);
      }
      audio.play('grave');
    }
  }

  // 锤僵尸：僵尸全部从墓碑中钻出，并且会不断冒出新墓碑
  spawnWhackWave(i, list) {
    const b = this.board;
    if (b.graves.length < 12) {
      for (let k = 0; k < 2; k++) {
        const r = choose(b.activeRows), c = 3 + Math.floor(Math.random() * 6);
        if (b.addGrave(c, r)) audio.play('grave');
      }
    }
    this.waveZombies = [];
    let hp0 = 0;
    list.forEach(type => {
      const t = type === 'flag' ? 'normal' : type;
      const g = choose(b.graves);
      if (!g) return;
      const d = ZOMBIES[t];
      hp0 += d.hp + (d.armor?.hp || 0);
      this.pending.push({ type: t, row: g.row, x: g.x + 8, waveId: i, whack: true, delay: rand(0, 3) });
    });
    this.waveHp0 = Math.max(1, hp0);
  }

  get allSpawned() { return this.done && this.pending.length === 0; }
}
