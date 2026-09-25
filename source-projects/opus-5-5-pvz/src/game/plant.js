// 植物实体：各类植物的行为（射击、产阳光、爆炸、地雷、大嘴花、窝瓜、喷菇、磁力菇……）。
import { rand, clamp, lerp, Ease, choose } from '../core/util.js';
import { audio } from '../core/audio.js';
import { PLANTS } from './defs.js';
import { colX, COL_W, LAWN_X, LAWN_RIGHT } from './layout.js';
import { PLANT_ART } from '../gfx/plantArt.js';
import { drawTinted } from '../gfx/tint.js';
import { shadow } from '../gfx/paint.js';
import { drawArmorHat } from '../gfx/zombieArt.js';

const VISIBLE_RIGHT = 1262;
const FUSE = { cherrybomb: 1.0, jalapeno: 1.0, iceshroom: 1.0, doomshroom: 1.25 };

export class Plant {
  constructor(board, type, col, row, o = {}) {
    this.board = board;
    this.isPlant = true;
    this.type = type;
    this.def = PLANTS[type];
    this.kind = this.def.kind;
    this.col = col;
    this.row = row;
    this.x = colX(col);
    this.baseY = board.rowY(row);
    this.onPad = !!o.onPad;
    this.slot = o.slot || 'main';
    this.hp = this.maxHp = this.def.hp;
    this.t = 0;
    this.phase = rand(0, 10);
    this.s = { t: 0, phase: this.phase };
    this.sleep = !!this.def.night && !board.isNight && !o.awake;
    this.dead = false;
    this.flash = 0;
    this.pop = o.noPop ? 1 : 0;
    this.alpha = 1;
    this.init();
  }

  get y() { return this.baseY - (this.onPad ? 10 : 0) + (this.yOff || 0); }

  // 是否挡住僵尸（会被啃）
  // 正在引爆的一次性植物：不会被啃、不会被压扁
  get fusing() { return this.kind === 'instant' && !this.sleep; }

  get blocking() {
    if (this.dead) return false;
    if (this.fusing) return false;
    if (this.kind === 'spike') return false;
    if (this.kind === 'squash' && this.state !== 'idle' && this.state !== 'look') return false;
    if (this.kind === 'mine' && this.armed) return false;
    if (this.kind === 'kelp') return false;
    if (this.slot === 'overlay') return false;
    return true;
  }

  init() {
    switch (this.kind) {
      case 'shooter':
        this.cool = rand(0.3, 1.1);
        this.shootT = -1;
        this.pending = [];
        break;
      case 'producer':
        this.prodT = rand(3, 12.5);
        if (this.type === 'sunshroom') { this.growT = 120; this.grown = false; this.s.grow = 0; }
        break;
      case 'instant':
        this.fuseT = 0;
        break;
      case 'mine':
        this.armT = this.board.cheatFastMine ? 1 : this.def.armTime;
        this.armed = false;
        this.s.rise = 0;
        break;
      case 'melee':
        this.state = 'idle';
        break;
      case 'squash':
        this.state = 'idle';
        break;
      case 'fume':
        this.cool = rand(0.3, 1);
        this.shootT = -1;
        break;
      case 'grave':
        this.progress = 0;
        break;
      case 'spike':
        this.tick = 0.5;
        break;
      case 'kelp':
        this.state = 'idle';
        break;
      case 'magnet':
        this.cooldown = 0;
        break;
      case 'coffee':
        this.wakeT = 0;
        break;
      case 'star':
        this.cool = rand(0.3, 1);
        this.shootT = -1;
        break;
      case 'blover':
        this.spinT = 0;
        break;
    }
  }

  hurt(amount, killer) {
    if (this.dead || this.fusing) return;
    this.hp -= amount;
    this.flash = 0.12;
    if (this.hp <= 0) this.die(killer);
  }

  die(killer, how = 'eaten') {
    if (this.dead) return;
    this.dead = true;
    this.board.removePlant(this);
    if (how === 'eaten') {
      audio.play('gulp');
      this.board.fx.dirt(this.x, this.y, 6, 20, ['#4f9a2a', '#3a7a1e', '#7ac04a']);
    }
    if (this.type === 'hypnoshroom' && killer && how === 'eaten' && !this.sleep) killer.hypnotize?.();
  }

  // 被冰车 / 巨人压扁
  crush() {
    if (this.dead || this.fusing) return;
    const b = this.board;
    b.fx.add({
      type: 'custom', x: this.x, y: this.y, life: 0.8, fadeStart: 0.4,
      draw: (ctx, p, k) => { ctx.scale(1 + k * 0.3, Math.max(0.08, 0.3 - k * 0.2)); PLANT_ART[this.type]?.(ctx, this.s); },
    });
    this.die(null, 'crushed');
  }

  update(dt) {
    this.t += dt;
    this.s.t = this.t;
    if (this.pop < 1) this.pop = Math.min(1, this.pop + dt * 4);
    if (this.flash > 0) this.flash -= dt;
    this.s.sleep = this.sleep;
    if (this.kind === 'wall' || this.kind === 'pumpkin' || this.kind === 'garlic') this.s.dmg = this.hp < this.maxHp / 3 ? 2 : this.hp < (this.maxHp * 2) / 3 ? 1 : 0;
    if (this.sleep) return;
    const fn = this['u_' + this.kind];
    if (fn) fn.call(this, dt);
  }

  // ---------------- 射手 ----------------
  u_shooter(dt) {
    const b = this.board;
    this.cool -= dt;
    // 胆小菇：有僵尸靠近就躲
    if (this.def.scared) {
      const near = b.zombies.some(z => z.isEnemy && z.alive && Math.abs(z.row - this.row) <= 1 && z.x - this.x > -80 && z.x - this.x < 190);
      this.s.hide = clamp((this.s.hide || 0) + (near ? dt * 5 : -dt * 3), 0, 1);
      if (this.s.hide > 0.2) { this.shootT = -1; this.s.shoot = 0; return; }
    }
    if (this.shootT >= 0) {
      const prev = this.shootT;
      this.shootT += dt;
      if (prev < 0.15 && this.shootT >= 0.15) this.fire();
      if (this.shootT >= 0.36) this.shootT = -1;
    }
    for (let i = this.pending.length - 1; i >= 0; i--) {
      this.pending[i] -= dt;
      if (this.pending[i] <= 0) { this.pending.splice(i, 1); this.shootT = 0.0001; }
    }
    this.s.shoot = this.shootT >= 0 ? this.shootT / 0.36 : 0;
    // 裂荚射手的后脑袋
    if (this.def.split) {
      if (this.backT >= 0) {
        const prev = this.backT;
        this.backT += dt;
        if (prev < 0.15 && this.backT >= 0.15) this.fireBack();
        if (this.backT >= 0.36) { this.backT = -1; if (this.backLeft > 0) { this.backLeft--; this.backT = 0.0001; } }
      }
      this.s.shoot2 = this.backT >= 0 ? this.backT / 0.36 : 0;
    }
    // 仙人掌：对空时伸长身体
    if (this.def.antiAir) {
      const air = this.airTarget();
      this.s.stretch = clamp((this.s.stretch || 0) + (air ? dt * 3 : -dt * 3), 0, 1);
    }
    if (this.cool <= 0 && this.shootT < 0) {
      const front = this.hasTarget();
      const back = this.def.split && this.hasBackTarget();
      if (front || back) {
        this.cool = 1.42 + rand(-0.06, 0.06);
        if (front || this.def.split) this.shootT = 0.0001;
        if (this.type === 'repeater') this.pending.push(0.22);
        if (this.def.split && (this.backT === undefined || this.backT < 0)) { this.backT = 0.0001; this.backLeft = 1; }
      } else this.cool = 0.1;
    }
  }

  airTarget() {
    const b = this.board;
    return b.zombies.some(z => z.isEnemy && z.balloonUp && z.alive && z.row === this.row && z.x > this.x - 20 && z.x < VISIBLE_RIGHT);
  }

  hasBackTarget() {
    const b = this.board;
    return b.zombies.some(z => z.isEnemy && z.hittable && z.row === this.row && z.x < this.x + 10 && z.x > LAWN_X - 60);
  }

  fireBack() {
    this.board.addProjectile('pea', this.x - 40, this.y - 58, this.row, { dir: -1 });
    audio.play('shoot');
  }

  hasTarget() {
    const b = this.board;
    const range = this.def.range ? this.def.range * COL_W : 2000;
    const xMax = Math.min(VISIBLE_RIGHT, this.x + range);
    if (this.def.antiAir && this.airTarget()) return true;
    if (this.type === 'threepeater') {
      for (const r of [this.row - 1, this.row, this.row + 1]) if (b.activeRow(r) && b.enemyInRow(r, this.x - 20, xMax)) return true;
      return false;
    }
    return b.enemyInRow(this.row, this.x - 20, xMax);
  }

  fire() {
    const b = this.board;
    switch (this.type) {
      case 'peashooter':
      case 'repeater':
        b.addProjectile('pea', this.x + 44, this.y - 56, this.row);
        audio.play('shoot');
        break;
      case 'snowpea':
        b.addProjectile('snow', this.x + 44, this.y - 56, this.row);
        audio.play('shoot');
        break;
      case 'threepeater':
        for (const [dr, hy] of [[-1, -80], [0, -46], [1, -50]]) {
          const r = this.row + dr;
          if (!b.activeRow(r)) continue;
          b.addProjectile('pea', this.x + 36, this.y + hy + (b.rowY(r) - b.rowY(this.row)), r, { fromRow: this.row });
        }
        audio.play('shoot');
        break;
      case 'puffshroom':
        b.addProjectile('puff', this.x + 26, this.y - 12, this.row, { maxX: this.x + this.def.range * COL_W + 30 });
        audio.play('puff');
        break;
      case 'scaredyshroom':
        b.addProjectile('puff', this.x + 26, this.y - 44, this.row);
        audio.play('puff');
        break;
      case 'seashroom':
        b.addProjectile('puff', this.x + 26, this.y - 16, this.row, { maxX: this.x + this.def.range * COL_W + 30 });
        audio.play('puff');
        break;
      case 'cactus': {
        const st = this.s.stretch || 0;
        b.addProjectile('spike', this.x + 22, this.y - 30 - st * 58, this.row, { air: st > 0.5 });
        audio.play('shoot');
        break;
      }
      case 'splitpea':
        b.addProjectile('pea', this.x + 44, this.y - 56, this.row);
        audio.play('shoot');
        break;
    }
  }

  // ---------------- 杨桃 ----------------
  u_star(dt) {
    const b = this.board;
    this.cool -= dt;
    if (this.shootT >= 0) {
      const prev = this.shootT;
      this.shootT += dt;
      if (prev < 0.15 && this.shootT >= 0.15) {
        const x = this.x, y = this.y - 36, v = 360;
        for (const [dx, dy] of [[-1, 0], [0, -1], [0, 1], [0.866, -0.5], [0.866, 0.5]]) b.addStar(x + dx * 20, y + dy * 20, dx * v, dy * v);
        audio.play('shoot');
      }
      if (this.shootT >= 0.4) this.shootT = -1;
    }
    this.s.shoot = this.shootT >= 0 ? this.shootT / 0.4 : 0;
    if (this.cool <= 0 && this.shootT < 0) {
      if (this.starTarget()) { this.shootT = 0.0001; this.cool = 1.42; } else this.cool = 0.1;
    }
  }

  starTarget() {
    const b = this.board;
    const py = this.y;
    for (const z of b.zombies) {
      if (!z.isEnemy || !z.hittable || z.x > VISIBLE_RIGHT) continue;
      const dy = Math.abs(z.y - py);
      if (z.row === this.row && z.x < this.x) return true; // 后方
      if (Math.abs(z.x - this.x) < 60) return true; // 上下
      if (z.x > this.x && Math.abs(z.x - this.x - dy * 1.732) < 70) return true; // 斜前方
    }
    return false;
  }

  // ---------------- 三叶草 ----------------
  u_blover(dt) {
    const b = this.board;
    const prev = this.spinT;
    this.spinT += dt;
    this.s.spin = clamp(this.spinT / 0.4, 0, 1);
    if (prev < 0.35 && this.spinT >= 0.35) b.blowAway(this.x, this.y);
    if (this.spinT >= 1.4) { this.dead = true; b.removePlant(this); }
  }

  // ---------------- 阳光生产 ----------------
  u_producer(dt) {
    this.prodT -= dt;
    this.s.glow = this.prodT < 1 ? clamp(1 - this.prodT, 0, 1) : Math.max(0, (this.s.glow || 0) - dt * 2);
    if (this.type === 'sunshroom' && !this.grown) {
      this.growT -= dt;
      if (this.growT <= 0) { this.grown = true; audio.play('wakeup'); }
    }
    if (this.type === 'sunshroom') this.s.grow = this.grown ? Math.min(1, (this.s.grow || 0) + dt * 2) : 0;
    if (this.prodT <= 0) {
      this.prodT = 23.5 + rand(0, 1);
      const value = this.type === 'sunshroom' ? (this.grown ? 25 : 15) : 25;
      this.board.produceSun(this.x, this.y - (this.type === 'sunshroom' ? 30 : 56), value);
      audio.play('sunproduce');
    }
  }

  // ---------------- 一次性爆炸类 ----------------
  u_instant(dt) {
    const dur = FUSE[this.type] || 1;
    if (this.fuseT === 0) audio.play(this.type === 'doomshroom' ? 'fuse' : 'fuse');
    this.fuseT += dt;
    this.s.fuse = clamp(this.fuseT / dur, 0, 1);
    if (this.fuseT >= dur) {
      const b = this.board;
      this.dead = true;
      b.removePlant(this);
      switch (this.type) {
        case 'cherrybomb': b.explodeArea(this.x, this.y, this.row, 1, 1, 'cherry'); break;
        case 'jalapeno': b.burnRow(this.row); break;
        case 'iceshroom': b.freezeAll(this.x, this.y); break;
        case 'doomshroom': b.doom(this.col, this.row, this.x, this.y); break;
      }
    }
  }

  // ---------------- 土豆地雷 ----------------
  u_mine(dt) {
    const b = this.board;
    if (!this.armed) {
      this.armT -= dt;
      if (this.armT <= 0) {
        this.armed = true;
        audio.play('armed');
        b.fx.dirt(this.x, this.y, 10, 20);
      }
      return;
    }
    this.s.rise = Math.min(1, (this.s.rise || 0) + dt * 2.5);
    if (this.s.rise < 1) return;
    const hit = b.zombies.find(z => z.isEnemy && z.alive && z.row === this.row && z.onGround && z.x - z.halfWidth < this.x + 40 && z.x + z.halfWidth > this.x - 40);
    if (hit) {
      this.dead = true;
      b.removePlant(this);
      for (const z of b.zombies) {
        if (z.isEnemy && z.alive && z.row === this.row && z.x > this.x - 70 && z.x < this.x + 85 && z.onGround) z.takeDamage(1800, 'explode');
      }
      audio.play('spudow');
      b.shake(6);
      b.fx.explosion(this.x, this.y - 20, 0.7, { text: '土豆雷！', textColor: '#fff3a0' });
      b.fx.dirt(this.x, this.y, 22, 40);
    }
  }

  // ---------------- 大嘴花 ----------------
  u_melee(dt) {
    const b = this.board;
    if (this.state === 'idle') {
      this.s.bite = 0;
      this.s.chew = 0;
      const z = b.zombies.find(z => z.isEnemy && z.alive && z.hittable && z.onGround && z.row === this.row && z.x > this.x - 20 && z.x - 24 < this.x + 112);
      if (z) { this.state = 'bite'; this.biteT = 0; this.target = z; this.bit = false; }
    } else if (this.state === 'bite') {
      this.biteT += dt;
      this.s.bite = clamp(this.biteT / 0.8, 0, 1);
      if (!this.bit && this.biteT >= 0.36) {
        this.bit = true;
        const z = this.target;
        this.ate = false;
        if (z && z.alive && z.row === this.row && z.x - 24 < this.x + 130 && z.x > this.x - 40) {
          if (z.type === 'gargantuar' || z.type === 'zomboni') {
            z.takeDamage(40, 'chomp');
            audio.play('bigchomp');
          } else {
            z.eatenByChomper();
            this.ate = true;
            audio.play('bigchomp');
          }
        }
      }
      if (this.biteT >= 0.8) {
        if (this.ate) { this.state = 'chew'; this.chewT = 0; } else this.state = 'idle';
      }
    } else if (this.state === 'chew') {
      this.s.bite = 0;
      this.s.chew = 1;
      this.chewT += dt;
      if (this.chewT >= (b.cheatFastChew ? 3 : this.def.chewTime)) { this.state = 'idle'; audio.play('gulp'); }
    }
  }

  // ---------------- 窝瓜 ----------------
  u_squash(dt) {
    const b = this.board;
    this.airborneTop = this.state === 'jump' || this.state === 'land';
    if (this.state === 'idle') {
      const z = b.zombies.find(z => z.isEnemy && z.alive && z.hittable && z.onGround && z.row === this.row && z.x > this.x - 80 && z.x - 20 < this.x + 130);
      if (z) { this.state = 'look'; this.lookT = 0; this.target = z; audio.play('squash'); }
    } else if (this.state === 'look') {
      this.lookT += dt;
      this.s.lookDir = Math.sign((this.target?.x ?? this.x) - this.x);
      if (this.lookT >= 0.45) {
        this.state = 'jump';
        this.jumpT = 0;
        this.fromX = this.x;
        const tz = this.target && this.target.alive ? this.target : null;
        this.toX = tz ? clamp(tz.x - 12, this.x - 110, this.x + 150) : this.x;
        b.clearCellSlot(this);
      }
    } else if (this.state === 'jump') {
      this.jumpT += dt;
      const up = 0.42, down = 0.16;
      if (this.jumpT < up) {
        const k = Ease.outCubic(this.jumpT / up);
        this.x = lerp(this.fromX, this.toX, k);
        this.yOff = -130 * k;
        this.s.airborne = true;
      } else if (this.jumpT < up + 0.12) {
        this.yOff = -130;
      } else if (this.jumpT < up + 0.12 + down) {
        const k = Ease.inQuad((this.jumpT - up - 0.12) / down);
        this.yOff = -130 * (1 - k);
      } else {
        this.yOff = 0;
        this.state = 'land';
        this.landT = 0;
        this.s.squish = 1;
        for (const z of b.zombies) {
          if (z.isEnemy && z.alive && z.row === this.row && Math.abs(z.x - this.x) < 62 && z.onGround) z.takeDamage(1800, 'squash');
        }
        audio.play('thud');
        b.shake(7);
        b.fx.dirt(this.x, this.y, 16, 40);
        b.fx.smoke(this.x, this.y - 10, 5, { scale: 0.8, color: 'rgba(140,120,90,0.5)' });
      }
    } else if (this.state === 'land') {
      this.landT += dt;
      this.s.squish = Math.max(0, 1 - this.landT * 1.5) * 0.9;
      if (this.landT > 0.7) this.alpha = Math.max(0, 1 - (this.landT - 0.7) * 3);
      if (this.landT > 1.05) { this.dead = true; b.removeFree(this); }
    }
  }

  // ---------------- 大喷菇 ----------------
  u_fume(dt) {
    const b = this.board;
    this.cool -= dt;
    if (this.shootT >= 0) {
      const prev = this.shootT;
      this.shootT += dt;
      if (prev < 0.2 && this.shootT >= 0.2) {
        const x1 = Math.min(VISIBLE_RIGHT, this.x + this.def.range * COL_W + 20);
        for (const z of b.zombies) if (z.isEnemy && z.alive && z.hittable && z.row === this.row && z.x > this.x - 10 && z.x - 25 < x1) z.takeDamage(20, 'fume');
        b.fumeCloud(this.x + 30, this.y - 18, x1);
        audio.play('fume');
      }
      if (this.shootT >= 0.5) this.shootT = -1;
    }
    this.s.shoot = this.shootT >= 0 ? this.shootT / 0.5 : 0;
    if (this.cool <= 0 && this.shootT < 0) {
      const x1 = Math.min(VISIBLE_RIGHT, this.x + this.def.range * COL_W + 20);
      if (b.enemyInRow(this.row, this.x - 10, x1)) { this.shootT = 0.0001; this.cool = 1.45; } else this.cool = 0.1;
    }
  }

  // ---------------- 墓碑吞噬者 ----------------
  u_grave(dt) {
    const b = this.board;
    this.progress += dt / 4.2;
    this.s.progress = clamp(this.progress, 0, 1);
    const g = b.graveAt(this.col, this.row);
    if (g) g.sink = this.s.progress;
    if (Math.random() < dt * 6) b.fx.dirt(this.x + rand(-20, 20), this.y - 10, 1, 10, ['#8a8a96', '#6a6a78', '#5a4a3a']);
    if (this.progress >= 1) {
      if (g) b.removeGrave(g);
      audio.play('pickup');
      b.fx.dirt(this.x, this.y, 16, 30, ['#8a8a96', '#6a6a78', '#5a4a3a']);
      this.dead = true;
      b.removePlant(this);
    }
  }

  // ---------------- 地刺 ----------------
  u_spike(dt) {
    const b = this.board;
    this.tick -= dt;
    this.s.attack = Math.max(0, (this.s.attack || 0) - dt * 4);
    if (this.tick <= 0) {
      this.tick = 1;
      let hit = false;
      for (const z of b.zombies) {
        if (!z.isEnemy || !z.alive || z.row !== this.row || !z.onGround) continue;
        const w = z.type === 'zomboni' ? 70 : 30;
        if (Math.abs(z.x - this.x) < 30 + w) {
          if (z.type === 'zomboni') { z.popTire(); this.die(null, 'crushed'); return; }
          z.takeDamage(20, 'spike');
          hit = true;
        }
      }
      if (hit) { this.s.attack = 1; audio.play('spike'); }
    }
  }

  // ---------------- 缠绕海草 ----------------
  u_kelp(dt) {
    const b = this.board;
    if (this.state === 'idle') {
      const z = b.zombies.find(z => z.isEnemy && z.alive && z.row === this.row && z.inWater && !z.airborne && Math.abs(z.x - 20 - this.x) < 45);
      if (z) {
        this.state = 'grab';
        this.grabT = 0;
        this.target = z;
        z.grabbed();
        audio.play('kelp');
        b.clearCellSlot(this);
      }
    } else {
      this.grabT += dt;
      this.s.grab = clamp(this.grabT * 2, 0, 1);
      if (this.target) this.target.dragDepth = clamp(this.grabT / 1.1, 0, 1);
      if (this.grabT > 1.2) {
        this.target?.remove();
        b.fx.add({ type: 'ring', x: this.x, y: this.y, size: 10, grow: 5, color: 'rgba(220,250,255,0.8)', width: 4, life: 0.8 });
        this.dead = true;
        b.removeFree(this);
      }
    }
  }

  // ---------------- 磁力菇 ----------------
  u_magnet(dt) {
    const b = this.board;
    if (this.cooldown > 0) {
      this.cooldown -= dt;
      this.s.cooldown = this.cooldown > 0 ? 1 : 0;
      return;
    }
    let best = null, bd = 1e9;
    for (const z of b.zombies) {
      if (!z.isEnemy || !z.alive || z.x > VISIBLE_RIGHT) continue;
      if (Math.abs(z.row - this.row) > 2) continue;
      const d = Math.hypot(z.x - this.x, (z.row - this.row) * 100);
      if (d > 300) continue;
      if (!z.hasMetal()) continue;
      if (d < bd) { bd = d; best = z; }
    }
    if (best) {
      const item = best.stripMetal();
      if (item) {
        this.cooldown = 15;
        this.s.cooldown = 1;
        this.held = item;
        audio.play('magnet');
        b.flyingItem(item, best.x, best.y - 120, this);
      }
    }
  }

  // ---------------- 咖啡豆 ----------------
  u_coffee(dt) {
    this.wakeT += dt;
    if (this.wakeT >= 1) {
      const host = this.board.cellOf(this.col, this.row).main;
      if (host) { host.sleep = false; audio.play('wakeup'); this.board.fx.sparks(host.x, host.y - 40, 12, '#fff2a0'); }
      this.dead = true;
      this.board.removePlant(this);
    }
  }

  // ---------------- 绘制 ----------------
  draw(ctx, part) {
    const art = PLANT_ART[this.type];
    if (!art) return;
    if (this.kind === 'pumpkin') this.s.part = part || 'front';
    const sc = this.pop < 1 ? Ease.outBack(this.pop) : 1;
    const tints = [];
    if (this.flash > 0) tints.push({ color: '#fff', alpha: 0.35 });
    if (this.sleep) tints.push({ color: '#203050', alpha: 0.28 });
    const y = this.y;
    ctx.save();
    // 被啃咬时轻微抖动
    const shake = this.flash > 0 ? Math.sin(this.t * 90) * 1.6 : 0;
    ctx.translate(this.x + shake, y);
    ctx.scale(sc, sc);
    if (this.alpha < 1) ctx.globalAlpha *= this.alpha;
    if (this.kind === 'coffee') ctx.translate(0, -70);
    if (tints.length) {
      drawTinted(ctx, 0, 0, 180, 220, this.board.drawScale, c => art(c, this.s), tints);
    } else {
      art(ctx, this.s);
    }
    // 磁力菇吸住的物品
    if (this.kind === 'magnet' && this.cooldown > 0 && this.held) {
      const k = this.cooldown / 15;
      ctx.save();
      ctx.translate(0, -72);
      ctx.scale(0.3 + k * 0.4, 0.3 + k * 0.4);
      ctx.globalAlpha *= Math.min(1, k * 3);
      drawMetalItem(ctx, this.held);
      ctx.restore();
    }
    ctx.restore();
    if (this.board.showHealth && this.hp < this.maxHp && this.kind !== 'instant') {
      const w = 40, k = this.hp / this.maxHp;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(this.x - w / 2, y + 4, w, 5);
      ctx.fillStyle = k > 0.5 ? '#6ad83a' : k > 0.25 ? '#f0c030' : '#e04020';
      ctx.fillRect(this.x - w / 2 + 1, y + 5, (w - 2) * k, 3);
    }
  }
}

export function drawMetalItem(ctx, item) {
  if (item === 'pogo' || item === 'pickaxe' || item === 'jackbox') {
    ctx.save();
    ctx.lineCap = 'round';
    if (item === 'pogo') {
      ctx.lineWidth = 6; ctx.strokeStyle = '#2a2e32';
      ctx.beginPath(); ctx.moveTo(0, -40); ctx.lineTo(0, 30); ctx.moveTo(-14, -40); ctx.lineTo(12, -40); ctx.stroke();
      ctx.lineWidth = 4; ctx.strokeStyle = '#d8dce0'; ctx.beginPath(); ctx.moveTo(0, -40); ctx.lineTo(0, 30); ctx.stroke();
    } else if (item === 'pickaxe') {
      ctx.lineWidth = 6; ctx.strokeStyle = '#6a4418'; ctx.beginPath(); ctx.moveTo(0, 30); ctx.lineTo(0, -30); ctx.stroke();
      ctx.lineWidth = 7; ctx.strokeStyle = '#8a9096'; ctx.beginPath(); ctx.moveTo(-24, -26); ctx.quadraticCurveTo(0, -40, 24, -26); ctx.stroke();
    } else {
      ctx.fillStyle = '#7a3ad8'; ctx.strokeStyle = '#2a0a4a'; ctx.lineWidth = 2.5;
      ctx.fillRect(-18, -18, 36, 34); ctx.strokeRect(-18, -18, 36, 34);
      ctx.fillStyle = '#ffd23a'; ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    return;
  }
  if (item === 'door') {
    ctx.save();
    ctx.scale(0.7, 0.7);
    ctx.fillStyle = 'rgba(160,170,175,0.5)';
    ctx.fillRect(-20, -50, 40, 100);
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#4a5054';
    ctx.strokeRect(-20, -50, 40, 100);
    ctx.restore();
  } else {
    drawArmorHat(ctx, item, 0, 1, 0);
  }
}
