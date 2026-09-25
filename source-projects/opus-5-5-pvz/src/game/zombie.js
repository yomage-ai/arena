// 僵尸实体：移动、啃食、受伤分层（手持护盾 → 头部护具 → 本体）、断臂掉头、各类特殊行为
// （撑杆跳、读报暴怒、舞王召唤、潜水、冰车、海豚、巨人砸地与投掷小鬼、被魅惑）。
import { rand, clamp, lerp, Ease, TAU, choose } from '../core/util.js';
import { audio } from '../core/audio.js';
import { ZOMBIES } from './defs.js';
import { LAWN_X, POOL_X1, COL_W, colOf } from './layout.js';
import { drawZombieArt, drawSeveredHead, drawSeveredArm, drawArmorHat, LOOKS } from '../gfx/zombieArt.js';
import { drawTinted } from '../gfx/tint.js';
import { shadow, E, rg } from '../gfx/paint.js';

const VISIBLE_RIGHT = 1262;
const colX0 = () => LAWN_X + 50;
const SWIMMERS = ['normal', 'cone', 'bucket', 'flag'];

export class Zombie {
  constructor(board, type, row, x, o = {}) {
    this.board = board;
    this.type = type;
    this.def = ZOMBIES[type];
    this.row = row;
    this.x = x;
    this.hp = this.maxHp = Math.round(this.def.hp * (o.hpMul || 1));
    this.armor = this.def.armor ? { ...this.def.armor, max: this.def.armor.hp } : null;
    this.shield = this.def.shield ? { ...this.def.shield, max: this.def.shield.hp } : null;
    this.baseSpeed = this.def.speed * rand(0.9, 1.1) * (o.speedMul || 1);
    this.speed = this.baseSpeed;
    this.t = rand(0, 10);
    this.walkPh = rand(0, TAU);
    this.eatPh = 0;
    this.seed = rand(0, 10);
    this.state = o.state || 'walk';
    this.anim = 'walk';
    this.slowT = 0;
    this.freezeT = 0;
    this.flash = 0;
    this.hasArm = true;
    this.hasHead = true;
    this.hypno = false;
    this.dir = -1;
    this.held = LOOKS[type]?.held || null;
    this.jumped = false;
    this.alpha = 1;
    this.dead = false;
    this.removed = false;
    this.yOff = 0;
    this.scale = this.def.scale || 1;
    this.waveId = o.waveId ?? -1;
    this.preview = !!o.preview;
    this.inWater = false;
    this.ducky = board.isWater(row) && SWIMMERS.includes(type);
    if (this.ducky && type === 'normal') this.lookType = 'ducky';
    this.riseT = o.state === 'rise' ? 0 : 1;
    this.riseDur = o.riseDur || 1.2;
    if (type === 'pole') this.anim = 'run';
    if (type === 'dolphin') { this.riding = true; }
    if (type === 'gargantuar') { this.hasImp = true; this.smashT = 0; }
    if (type === 'zomboni') { this.vehicleStage = 0; }
    if (type === 'dancer') { this.summonT = 0; this.summoned = false; this.backups = []; }
    if (type === 'imp' && o.thrown) { this.state = 'flying'; this.fly = o.thrown; }
    if (type === 'balloon') { this.balloonUp = true; this.floatH = 70; }
    if (type === 'digger') { this.underground = o.state !== 'rise'; this.metalItem = 'pickaxe'; }
    if (type === 'pogo') { this.pogo = true; this.bouncePh = rand(0, TAU); this.metalItem = 'pogo'; }
    if (type === 'jackbox') { this.jackT = rand(5, 15); this.metalItem = 'jackbox'; this.musicT = 0; }
    this.floatH = this.floatH || 0;
    this.laneOff = 0;
    if (o.leader) this.leader = o.leader;
    if (o.y !== undefined) this.yOverride = o.y;
    this.groanT = rand(3, 14);
  }

  // ---------- 状态查询 ----------
  get alive() { return !this.dead && !['dying', 'fall', 'charred', 'dragged', 'shred', 'eaten', 'vehicleDie', 'blown'].includes(this.state); }
  get isEnemy() { return !this.hypno && !this.preview; }
  get airborne() { return this.state === 'jump' || this.state === 'flying' || this.balloonUp || this.state === 'drop' || this.state === 'blown'; }
  get onGround() { return !this.airborne && this.state !== 'rise'; }
  get submerged() { return this.type === 'snorkel' && this.inWater && this.state === 'walk'; }
  get hittable() {
    if (!this.alive) return false;
    if (this.submerged) return false;
    if (this.state === 'rise' && this.riseT < 0.5) return false;
    if (this.state === 'flying' || this.balloonUp || this.underground || this.state === 'drop') return false;
    return this.x < VISIBLE_RIGHT + 10;
  }
  get front() { return this.x + this.dir * (this.type === 'zomboni' ? 70 : this.type === 'gargantuar' ? 40 : 22); }
  get y() { return this.yOverride ?? this.board.rowY(this.row); }
  get halfWidth() { return this.type === 'zomboni' ? 70 : this.type === 'gargantuar' ? 40 : 24; }
  get armorKind() { return this.armor ? this.armor.kind : null; }
  get armorStage() { return this.armor ? (this.armor.hp < this.armor.max / 3 ? 2 : this.armor.hp < (this.armor.max * 2) / 3 ? 1 : 0) : 0; }
  get shieldStage() { return this.shield ? (this.shield.hp < this.shield.max / 3 ? 2 : this.shield.hp < (this.shield.max * 2) / 3 ? 1 : 0) : 0; }
  get angry() { return this.angryMode; }
  get totalHp() { return Math.max(0, this.hp) + (this.armor ? this.armor.hp : 0) + (this.shield ? this.shield.hp : 0); }

  hasMetal() {
    return (this.armor && this.armor.metal) || (this.shield && this.shield.metal) || !!this.metalItem;
  }

  stripMetal() {
    if (this.shield && this.shield.metal) { const k = this.shield.kind; this.shield = null; this.held = null; return k; }
    if (this.armor && this.armor.metal) { const k = this.armor.kind; this.armor = null; return k; }
    if (this.metalItem) {
      const k = this.metalItem;
      this.metalItem = null;
      this.held = null;
      if (k === 'pogo') { this.pogo = false; this.speed = this.def.walkSpeed; this.yOff = 0; if (this.state === 'jump') this.state = 'walk'; }
      if (k === 'pickaxe' && this.underground) {
        // 被吸走镐子：原地钻出，继续向左走
        this.underground = false;
        this.state = 'rise';
        this.riseT = 0;
        this.riseDur = 0.8;
        this.speed = this.def.walkSpeed;
        this.board.fx.dirt(this.x, this.y, 12, 25);
      }
      return k;
    }
    return null;
  }

  popBalloon() {
    if (!this.balloonUp) return;
    this.balloonUp = false;
    this.state = 'drop';
    this.dropT = 0;
    audio.play('pop');
  }

  blowAway() {
    if (!this.alive) return;
    this.board.onZombieKilled(this);
    this.state = 'blown';
    this.blownT = 0;
  }

  // 大蒜：换到相邻的行
  divert() {
    const b = this.board;
    const opts = [this.row - 1, this.row + 1].filter(r => b.activeRow(r) && b.isWater(r) === b.isWater(this.row));
    if (!opts.length) return false;
    const oldY = this.y;
    this.row = choose(opts);
    this.laneOff0 = oldY - this.y;
    this.laneOff = this.laneOff0;
    this.laneT = 0;
    this.state = 'walk';
    this.eatTarget = null;
    audio.play('groan');
    return true;
  }

  // ---------- 受伤 ----------
  takeDamage(amount, kind = 'pea', o = {}) {
    if (!this.alive || this.underground) return 'none';
    const b = this.board;
    const isArea = kind === 'explode' || kind === 'squash' || kind === 'fire-row' || kind === 'doom';
    if (this.balloonUp && !isArea) { this.popBalloon(); return 'none'; }
    this.flash = 0.1;
    let part = 'body';
    const projectile = kind === 'pea' || kind === 'snow' || kind === 'fire' || kind === 'puff';
    const area = kind === 'explode' || kind === 'squash' || kind === 'fire-row' || kind === 'doom';
    if (this.type === 'zomboni') {
      this.hp -= amount;
      this.vehicleStage = this.hp < this.maxHp / 3 ? 2 : this.hp < (this.maxHp * 2) / 3 ? 1 : 0;
      if (this.hp <= 0) this.vehicleDestroyed(area);
      return 'metal';
    }
    let dmg = amount;
    if (this.shield && (projectile || area || kind === 'bowl' || kind === 'whack')) {
      const absorb = area ? Math.min(dmg, this.shield.hp) : dmg;
      this.shield.hp -= absorb;
      part = this.shield.kind === 'door' ? 'shield' : 'paper';
      if (this.shield.hp <= 0) this.loseShield();
      if (!area) {
        if (kind === 'snow' && part === 'paper') this.slow(10);
        return part;
      }
      dmg -= absorb;
    }
    if (this.armor && dmg > 0) {
      const absorb = Math.min(dmg, this.armor.hp);
      this.armor.hp -= absorb;
      part = this.armor.kind === 'cone' ? 'cone' : 'metal';
      dmg = area ? dmg - absorb : 0;
      // 被爆炸直接炸死时，护具随僵尸一起烧焦，不再飞出
      if (this.armor.hp <= 0) {
        if (area && dmg >= this.hp) this.armor.hp = 0.001;
        else this.loseArmor();
      }
    }
    if (dmg > 0) {
      this.hp -= dmg;
      if (this.hasArm && this.hp < this.maxHp * 0.5 && this.hp > 0) this.dropArm();
      if (this.hp <= 0) {
        if (area || kind === 'fire-row') this.die('char');
        else this.die('normal');
      }
    }
    if (kind === 'snow') this.slow(10);
    if (kind === 'fire' || kind === 'fire-row') this.slowT = 0;
    return part;
  }

  slow(t) {
    if (this.type === 'zomboni') return;
    this.slowT = Math.max(this.slowT, t);
  }

  freeze(t) {
    if (!this.alive) return;
    this.freezeT = Math.max(this.freezeT, t);
    this.slowT = Math.max(this.slowT, t + 10);
  }

  loseShield() {
    const b = this.board;
    const kind = this.shield.kind;
    this.shield = null;
    this.held = null;
    if (kind === 'paper') {
      audio.play('newspaper');
      this.state = 'angryStart';
      this.angryT = 0;
      for (let i = 0; i < 8; i++) {
        b.fx.add({ type: 'rect', x: this.x - 26, y: this.y - 80, vx: rand(-80, 80), vy: rand(-200, -60), g: 400, size: rand(6, 12), aspect: 1.2, color: '#eeeae0', stroke: '#888', rot: rand(TAU), vr: rand(-6, 6), life: 1.2, ground: this.y, bounces: 0 });
      }
    } else {
      audio.play('shieldhit');
      b.fx.debris(this.x - 30, this.y - 70, ctx => {
        ctx.fillStyle = 'rgba(160,170,175,0.5)';
        ctx.fillRect(-20, -50, 40, 100);
        ctx.lineWidth = 5; ctx.strokeStyle = '#3a4044'; ctx.strokeRect(-20, -50, 40, 100);
      }, { vx: rand(-60, -20), vy: -120, vr: -2, ground: this.y - 20, life: 1.6 });
    }
  }

  loseArmor() {
    const b = this.board;
    const kind = this.armor.kind;
    this.armor = null;
    b.fx.debris(this.x - 6, this.y - 140 * this.scale, ctx => drawArmorHat(ctx, kind, 2, 1, 0), { vx: rand(30, 90), vy: rand(-240, -160), ground: this.y - 10, life: 1.8 });
    if (kind !== 'cone') audio.play('metal');
  }

  dropArm() {
    if (this.type === 'zomboni' || this.type === 'gargantuar') return;
    this.hasArm = false;
    const b = this.board;
    b.fx.debris(this.x - 12, this.y - 90 * this.scale, ctx => drawSeveredArm(ctx, this), { vx: rand(-40, 20), vy: rand(-120, -60), ground: this.y - 4, life: 1.8 });
    if (this.held === 'flag') this.held = null;
  }

  die(kind = 'normal') {
    if (!this.alive) return;
    const b = this.board;
    this.slowT = 0;
    this.freezeT = 0;
    this.yOff = 0;
    this.floatH = 0;
    this.balloonUp = false;
    b.onZombieKilled(this, this.hypno);
    if (kind === 'char') {
      this.state = 'charred';
      this.charT = 0;
      return;
    }
    // 掉头
    this.state = 'dying';
    this.dyingT = 0;
    if (this.type !== 'zomboni' && this.type !== 'gargantuar') {
      this.hasHead = false;
      const self = this;
      const armorKind = this.armor?.kind;
      b.fx.debris(this.x - 8, this.y - 125 * this.scale, ctx => {
        drawSeveredHead(ctx, { ...self, t: 0, lookType: self.lookType, hypno: self.hypno });
        if (armorKind) drawArmorHat(ctx, armorKind, 2, 1, 0);
      }, { vx: this.hypno ? rand(-80, -20) : rand(20, 90), vy: rand(-220, -140), vr: rand(-4, 4), ground: this.y - 12, life: 1.8, onBounce: () => audio.play('headfall') });
      this.armor = null;
    }
    if (this.held === 'flag' || this.held === 'pole') this.held = null;
  }

  eatenByChomper() {
    this.board.onZombieKilled(this);
    this.state = 'eaten';
    this.remove();
  }

  grabbed() {
    this.board.onZombieKilled(this);
    this.state = 'dragged';
    this.dragDepth = 0;
  }

  shred() {
    if (this.state === 'shred') return;
    if (this.alive) this.board.onZombieKilled(this, this.hypno);
    if (this.type === 'zomboni') this.board.zomboniDied(this.row);
    this.state = 'shred';
    this.shredT = 0;
    audio.play('shred');
  }

  popTire() {
    audio.play('tire');
    this.vehicleDestroyed(false);
  }

  vehicleDestroyed(charred) {
    if (!this.alive) return;
    const b = this.board;
    b.onZombieKilled(this);
    this.state = 'vehicleDie';
    this.dieT = 0;
    audio.play('vehicle');
    b.fx.explosion(this.x, this.y - 40, 0.8);
    b.shake(6);
    b.zomboniDied(this.row);
  }

  hypnotize() {
    if (!this.alive || this.type === 'gargantuar' || this.type === 'zomboni') return;
    this.hypno = true;
    this.dir = 1;
    this.state = 'walk';
    this.eatTarget = null;
    this.slowT = 0;
    audio.play('hypno');
    this.board.onZombieKilled(this, true);
    this.board.fx.sparks(this.x, this.y - 100, 14, '#ff8af0');
  }

  remove() {
    this.dead = true;
  }

  // ---------- 更新 ----------
  update(dt) {
    const b = this.board;
    this.t += dt;
    if (this.flash > 0) this.flash -= dt;
    if (this.slowT > 0) this.slowT -= dt;
    if (this.preview) { this.anim = 'idle'; return; }

    // 死亡相关状态
    switch (this.state) {
      case 'dying': return this.u_dying(dt);
      case 'charred': return this.u_charred(dt);
      case 'dragged':
        this.inWater = true;
        return;
      case 'shred':
        this.shredT += dt;
        if (this.shredT > 0.35) this.remove();
        return;
      case 'vehicleDie':
        this.dieT += dt;
        this.alpha = 1 - this.dieT / 0.6;
        if (this.dieT > 0.6) this.remove();
        return;
      case 'eaten': return;
      case 'blown':
        this.blownT += dt;
        this.x += 650 * dt;
        this.floatH += 160 * dt;
        this.t += dt * 3;
        if (this.blownT > 1.4) this.remove();
        return;
    }
    if (this.laneOff) {
      this.laneT += dt;
      const k = Math.min(1, this.laneT / 0.9);
      this.laneOff = this.laneOff0 * (1 - (-(Math.cos(Math.PI * k) - 1) / 2));
      if (k >= 1) this.laneOff = 0;
    }

    if (this.freezeT > 0) {
      this.freezeT -= dt;
      return;
    }
    const slowMul = this.slowT > 0 ? 0.5 : 1;
    const adt = dt * slowMul;

    // 呻吟
    this.groanT -= dt;
    if (this.groanT <= 0) {
      this.groanT = rand(8, 22);
      if (this.x < VISIBLE_RIGHT && !this.hypno && b.zombies.length < 30) audio.play('groan');
    }

    // 入水判定
    if (b.isWater(this.row) && !this.airborne && !this.underground) {
      const wasIn = this.inWater;
      this.inWater = this.x < POOL_X1 - 6 && this.x > LAWN_X - 60;
      if (this.inWater && !wasIn && this.state !== 'rise') {
        audio.play('splash');
        b.splash(this.x, this.y);
      }
    }

    switch (this.state) {
      case 'rise': return this.u_rise(dt);
      case 'flying': return this.u_flying(dt);
      case 'jump': return this.u_jump(adt);
      case 'angryStart':
        this.anim = 'angry';
        this.angryT += dt;
        if (this.angryT > 1.2) { this.state = 'walk'; this.angryMode = true; this.speed = this.def.angrySpeed; }
        return;
      case 'smash': return this.u_smash(adt);
      case 'throw': return this.u_throw(adt);
      case 'summon': return this.u_summon(dt);
      case 'drop': return this.u_drop(dt);
      case 'popping': return this.u_popping(dt);
      case 'eat': return this.u_eat(adt);
      default: return this.u_walk(adt, slowMul);
    }
  }

  u_rise(dt) {
    this.riseT += dt / this.riseDur;
    this.anim = 'idle';
    if (Math.random() < dt * 10) this.board.fx.dirt(this.x, this.y, 1, 20);
    if (this.riseT >= 1) { this.riseT = 1; this.state = 'walk'; }
  }

  u_flying(dt) {
    const f = this.fly;
    f.t += dt / f.dur;
    const k = clamp(f.t, 0, 1);
    this.x = lerp(f.x0, f.x1, k);
    this.yOff = -Math.sin(k * Math.PI) * f.h - (1 - k) * f.y0;
    this.anim = 'jump';
    this.jumpT = k;
    if (f.t >= 1) {
      this.yOff = 0;
      this.state = 'walk';
      this.anim = 'walk';
      this.board.fx.dirt(this.x, this.y, 8, 20);
      audio.play('thud');
    }
  }

  u_drop(dt) {
    this.dropT += dt;
    const k = Math.min(1, this.dropT / 0.45);
    this.floatH = 70 * (1 - k * k);
    this.popT = Math.min(1, this.dropT * 5);
    this.anim = 'float';
    if (k >= 1) {
      this.floatH = 0;
      this.held = null;
      this.state = 'walk';
      this.speed = 19 * rand(0.9, 1.1);
      audio.play('thud');
      this.board.fx.dirt(this.x, this.y, 8, 20);
    }
  }

  u_popping(dt) {
    this.anim = 'idle';
    this.popT2 = (this.popT2 || 0) + dt / 0.9;
    this.jackPop = Math.min(1, this.popT2);
    if (this.popT2 >= 1) {
      const b = this.board;
      b.explodePlants(this.x - 10, this.row);
      audio.play('explode');
      b.shake(10);
      b.fx.explosion(this.x - 10, this.y - 60, 1.1, { text: '砰！', textColor: '#ff8af0' });
      this.metalItem = null;
      this.held = null;
      this.die('char');
    }
  }

  u_walk(adt, slowMul) {
    const b = this.board;
    // 气球：飘过一切
    if (this.balloonUp) {
      this.anim = 'float';
      this.x += this.dir * this.speed * adt;
      this.walkPh += adt * 2;
      if (this.dir < 0 && !this.hypno) {
        // 飘到房前：若该行还有割草机，气球被戳破并落到割草机前
        if (this.x < LAWN_X - 20 && b.mowers.some(m => m.row === this.row && (m.state === 'idle' || m.state === 'arrive'))) {
          this.popBalloon();
          this.state = 'walk';
          this.floatH = 0;
          this.held = null;
          b.triggerMower(this.row, this);
        } else if (this.x < LAWN_X - 130) b.zombieReachedHouse(this);
      }
      return;
    }
    // 矿工：地下潜行到最左边再钻出
    if (this.underground) {
      this.x -= this.speed * adt;
      if (Math.random() < adt * 8) b.fx.dirt(this.x + 10, this.y, 1, 16);
      if (Math.random() < adt * 0.8) audio.play('dirt');
      if (this.x <= colX0() - 10) {
        this.underground = false;
        this.dir = 1;
        this.speed = this.def.walkSpeed;
        this.state = 'rise';
        this.riseT = 0;
        this.riseDur = 0.9;
        b.fx.dirt(this.x, this.y, 16, 30);
        audio.play('grave');
      }
      return;
    }
    // 跳跳：一路弹跳，遇到植物直接跳过
    if (this.pogo) {
      this.anim = 'pogo';
      this.bouncePh += adt * 7;
      const sn = Math.abs(Math.sin(this.bouncePh));
      this.yOff = -sn * 42;
      this.pogoSquash = Math.max(0, 1 - sn * 5);
      this.x += this.dir * this.speed * adt;
      if (!this.hypno) {
        const p = b.plantAhead(this, 30);
        if (p) {
          if (p.def.tall) {
            this.stripMetal();
            this.bonk();
          } else {
            this.state = 'jump';
            this.jumpT = 0;
            this.jumpFrom = this.x;
            this.jumpTo = p.x - 60;
            audio.play('pole');
            return;
          }
        }
        if (this.x < LAWN_X - 10) b.triggerMower(this.row, this);
        if (this.x < LAWN_X - 130) b.zombieReachedHouse(this);
      }
      return;
    }
    // 小丑：玩具盒随时可能爆炸
    if (this.metalItem === 'jackbox' && !this.hypno && this.x < VISIBLE_RIGHT - 40) {
      this.jackT -= adt;
      this.musicT -= adt;
      if (this.musicT <= 0) { this.musicT = 1.6; audio.play('jackmusic'); }
      if (this.jackT <= 0) { this.state = 'popping'; this.popT2 = 0; return; }
    }
    this.anim = this.type === 'pole' && !this.jumped ? 'run' : this.inWater && this.type !== 'snorkel' && !this.ducky ? 'swim' : 'walk';
    if (this.type === 'dolphin' && this.riding) this.anim = 'idle';
    if (this.leader || this.type === 'dancer') this.danceStep();

    // 撑杆 / 海豚：遇到植物起跳
    if (!this.jumped && !this.hypno && ((this.type === 'pole') || (this.type === 'dolphin' && this.riding && this.inWater))) {
      const p = b.plantAhead(this, 70);
      if (p) {
        if (p.def.tall) {
          this.jumped = true;
          this.bonk();
        } else {
          this.state = 'jump';
          this.jumpT = 0;
          this.jumpFrom = this.x;
          this.jumpTo = p.x - 70;
          audio.play(this.type === 'pole' ? 'pole' : 'splash');
          return;
        }
      }
    }

    // 舞王召唤
    if (this.type === 'dancer' && !this.hypno) {
      this.summonT += adt;
      const need = !this.summoned ? this.x < 1030 : (this.backups.filter(z => z.alive && !z.hypno).length < 4 && this.summonT > 12);
      if (need && this.x < VISIBLE_RIGHT - 20) {
        this.state = 'summon';
        this.summonAnimT = 0;
        return;
      }
    }

    // 巨人投掷小鬼
    if (this.type === 'gargantuar' && this.hasImp && this.hp < this.maxHp / 2 && this.x > LAWN_X + 380 && !this.hypno) {
      this.state = 'throw';
      this.throwT = 0;
      return;
    }

    // 冰车：碾压植物 + 留冰道
    if (this.type === 'zomboni') {
      b.leaveIce(this.row, this.x + 40);
      const p = b.plantUnder(this.row, this.x - 55, 40, true);
      if (p && !(p.kind === 'mine' && p.armed) && !p.fusing) {
        if (p.kind === 'spike') { p.die(null, 'crushed'); this.popTire(); return; }
        p.crush();
        audio.play('thud');
      }
    } else {
      // 找啃食目标（巨人连地刺也会砸）
      let target = this.findEatTarget();
      if (!target && this.type === 'gargantuar' && !this.hypno) {
        const sp = b.plantUnder(this.row, this.front - 10, 34);
        if (sp && sp.kind === 'spike') target = sp;
      }
      if (target) {
        if (this.type === 'gargantuar' && target.isPlant) {
          this.state = 'smash';
          this.smashT = 0;
          this.smashTarget = target;
          this.smashed = false;
          return;
        }
        this.state = 'eat';
        this.eatTarget = target;
        return;
      }
    }

    // 前进
    let spd = this.speed;
    if (this.type === 'dancer' || this.leader) spd = this.dancePause ? 0 : spd;
    this.x += this.dir * spd * adt;
    const animRate = this.type === 'zomboni' ? 1 : spd / 19;
    this.walkPh += adt * 4.4 * Math.max(0.6, animRate);
    if (spd === 0) this.anim = 'dance';

    // 到达房子
    if (!this.hypno && this.dir < 0) {
      if (this.x < LAWN_X - 10) b.triggerMower(this.row, this);
      if (this.x < LAWN_X - 130) b.zombieReachedHouse(this);
    } else if (this.x > 1350) {
      this.remove();
    }
  }

  danceStep() {
    const b = this.board;
    const lead = this.leader || this;
    if (!lead.summoned) { this.dancePause = false; return; }
    const ph = (b.time + (lead.seed || 0)) % 3.4;
    this.dancePause = ph > 2.2;
    this.anim = this.dancePause ? 'dance' : 'walk';
  }

  bonk() {
    const b = this.board;
    audio.play('thud');
    b.fx.sparks(this.x - 30, this.y - 90, 8, '#fff');
    if (this.type === 'pole') {
      this.held = null;
      this.speed = this.def.walkSpeed;
      b.fx.debris(this.x - 20, this.y - 70, ctx => {
        ctx.lineCap = 'round'; ctx.lineWidth = 6; ctx.strokeStyle = '#4a3010';
        ctx.beginPath(); ctx.moveTo(-50, 0); ctx.lineTo(50, 0); ctx.stroke();
        ctx.lineWidth = 3.5; ctx.strokeStyle = '#d8b070'; ctx.stroke();
      }, { vx: 40, vy: -100, vr: 3, ground: this.y - 6, life: 1.5 });
    } else {
      this.riding = false;
      this.speed = this.def.walkSpeed;
    }
  }

  u_jump(adt) {
    this.jumpT += adt / 0.95;
    const k = clamp(this.jumpT, 0, 1);
    this.x = lerp(this.jumpFrom, this.jumpTo, Ease.inOutSine(k));
    this.yOff = -Math.sin(k * Math.PI) * (this.type === 'pole' ? 95 : this.pogo ? 115 : 70);
    if (this.pogo) this.anim = 'pogo';
    this.anim = 'jump';
    if (this.jumpT >= 1 && this.pogo) {
      this.yOff = 0;
      this.state = 'walk';
      return;
    }
    if (this.jumpT >= 1) {
      this.yOff = 0;
      this.jumped = true;
      this.state = 'walk';
      this.speed = this.def.walkSpeed;
      if (this.type === 'pole') {
        this.held = null;
        this.board.fx.debris(this.x + 40, this.y - 60, ctx => {
          ctx.lineCap = 'round'; ctx.lineWidth = 6; ctx.strokeStyle = '#4a3010';
          ctx.beginPath(); ctx.moveTo(-50, 0); ctx.lineTo(50, 0); ctx.stroke();
          ctx.lineWidth = 3.5; ctx.strokeStyle = '#d8b070'; ctx.stroke();
        }, { vx: 30, vy: -80, vr: 2, ground: this.y - 6, life: 1.5 });
        audio.play('thud');
      } else {
        this.riding = false;
        audio.play('splash');
        this.board.splash(this.x, this.y);
      }
    }
  }

  findEatTarget() {
    const b = this.board;
    const f = this.front;
    // 敌对僵尸之间（被魅惑的与普通的）
    for (const z of b.zombies) {
      if (z === this || !z.alive || z.row !== this.row || z.hypno === this.hypno || z.preview) continue;
      if (z.airborne || z.state === 'rise') continue;
      if (this.dir < 0 ? (f <= z.x + 20 && f >= z.x - 30) : (f >= z.x - 20 && f <= z.x + 30)) return z;
    }
    if (this.hypno) return null;
    const p = b.plantAt(this.row, f);
    return p;
  }

  u_eat(adt) {
    const b = this.board;
    const tg = this.eatTarget;
    const valid = tg && (tg.isPlant ? !tg.dead && (tg.blocking || this.type === 'gargantuar') : tg.alive && tg.row === this.row);
    if (!valid) { this.state = 'walk'; this.eatTarget = null; return; }
    this.anim = 'eat';
    this.eatPh += adt * 8.5;
    const dps = 100;
    if (tg.isPlant && tg.type === 'garlic') {
      this.garlicT = (this.garlicT || 0) + adt;
      if (this.garlicT > 0.6) { this.garlicT = 0; tg.hurt(20, this); if (this.divert()) return; }
    }
    if (tg.isPlant) {
      tg.hurt(dps * adt, this);
      if (!tg.dead && Math.sin(this.eatPh * 0.5) > 0.95) audio.play('chomp');
    } else {
      tg.takeDamage(dps * adt, 'bite');
      if (Math.sin(this.eatPh * 0.5) > 0.95) audio.play('chomp');
    }
    if (!this.hypno && this.x < LAWN_X - 10) b.triggerMower(this.row, this);
  }

  u_smash(adt) {
    const b = this.board;
    this.anim = 'smash';
    this.smashT += adt / 1.8;
    if (!this.smashed && this.smashT >= 0.62) {
      this.smashed = true;
      const p = this.smashTarget;
      if (p && !p.dead) p.crush();
      audio.play('smash');
      b.shake(8);
      b.fx.dirt(this.x - 110, this.y, 14, 30);
    }
    if (this.smashT >= 1) { this.smashT = 0; this.state = 'walk'; }
  }

  u_throw(adt) {
    const b = this.board;
    this.throwT += adt / 1.2;
    this.anim = 'idle';
    if (this.hasImp && this.throwT >= 0.5) {
      this.hasImp = false;
      audio.play('impthrow');
      const x1 = Math.max(LAWN_X + 60, this.x - rand(320, 460));
      b.spawnZombie('imp', this.row, this.x + 30, { thrown: { x0: this.x + 30, x1, y0: 150, h: 120, t: 0, dur: 1.3 } });
    }
    if (this.throwT >= 1) this.state = 'walk';
  }

  u_summon(dt) {
    const b = this.board;
    this.anim = 'point';
    this.summonAnimT += dt;
    if (this.summonAnimT >= 0.5 && this.summonAnimT - dt < 0.5) {
      audio.play('dance');
      const spots = [[this.row, this.x - 100], [this.row, this.x + 100], [this.row - 1, this.x], [this.row + 1, this.x]];
      this.backups = this.backups.filter(z => z.alive);
      const alive = this.backups.filter(z => !z.hypno);
      for (const [r, x] of spots) {
        if (!b.activeRow(r) || b.isWater(r)) continue;
        if (alive.some(z => z.row === r && Math.abs(z.x - x) < 40)) continue;
        if (alive.length >= 4) break;
        const z = b.spawnZombie('backup', r, x, { state: 'rise', riseDur: 1, leader: this });
        this.backups.push(z);
        alive.push(z);
        b.fx.dirt(x, b.rowY(r), 10, 25);
      }
    }
    if (this.summonAnimT >= 1.3) {
      this.state = 'walk';
      this.summoned = true;
      this.summonT = 0;
    }
  }

  u_dying(dt) {
    this.dyingT += dt;
    this.anim = 'die';
    // 无头继续走一小段
    if (this.dyingT < 0.7 && this.type !== 'gargantuar') {
      this.x += this.dir * this.speed * 0.4 * dt;
      this.walkPh += dt * 3;
      this.anim = 'walk';
    }
    if (this.dyingT >= 0.7 && !this.fell) {
      this.fell = true;
      this.fallT = 0;
    }
    if (this.fell) {
      this.fallT += dt;
      if (this.fallT >= 0.45 && !this.thudded) {
        this.thudded = true;
        audio.play(this.type === 'gargantuar' ? 'smash' : 'zombiefall');
        if (this.type === 'gargantuar') this.board.shake(6);
      }
    }
    if (this.dyingT > 2.2) this.alpha = Math.max(0, 1 - (this.dyingT - 2.2) / 0.5);
    if (this.dyingT > 2.7) this.remove();
  }

  u_charred(dt) {
    this.charT += dt;
    if (this.charT > 0.7 && !this.crumbled) {
      this.crumbled = true;
      const b = this.board;
      for (let i = 0; i < 26; i++) {
        b.fx.add({
          type: 'rect', x: this.x + rand(-20, 20), y: this.y - rand(10, 140) * this.scale, vx: rand(-40, 40), vy: rand(-60, 20), g: 600,
          size: rand(3, 7), color: i % 3 ? '#1a1612' : '#3a3430', rot: rand(TAU), vr: rand(-5, 5), life: rand(0.8, 1.5), ground: this.y + rand(-4, 4), bounces: 0,
        });
      }
      b.fx.smoke(this.x, this.y - 60, 4, { color: 'rgba(40,40,40,0.5)' });
    }
    if (this.charT > 0.7) this.alpha = Math.max(0, 1 - (this.charT - 0.7) / 0.4);
    if (this.charT > 1.1) this.remove();
  }

  // ---------- 绘制 ----------
  artState() {
    return this;
  }

  draw(ctx) {
    const b = this.board;
    const x = this.x, y = this.y + this.laneOff;
    const sc = this.scale * b.entityScale;
    const inWater = this.inWater && this.state !== 'rise';
    // 阴影
    if (!inWater && this.state !== 'rise' && this.state !== 'dragged') {
      const sw = this.type === 'zomboni' ? 70 : this.type === 'gargantuar' ? 50 : 30;
      if (!this.underground) shadow(ctx, x + 2, y, sw * sc * (this.airborne ? 0.7 : 1), 9 * sc, 0.32 * this.alpha);
    }
    const tints = [];
    if (this.state === 'charred') tints.push({ color: '#0c0a08', alpha: 0.94 });
    else {
      if (this.hypno) tints.push({ color: '#d04ad8', alpha: 0.28 });
      if (this.freezeT > 0) tints.push({ color: '#7ad0ff', alpha: 0.55 });
      else if (this.slowT > 0) tints.push({ color: '#5ab8ff', alpha: 0.32 });
      if (this.flash > 0) tints.push({ color: '#ffffff', alpha: 0.3 });
    }
    // 局部绘制函数（原点 = 脚底）
    const sink = inWater ? (this.submerged ? 118 : this.ducky ? 40 : this.type === 'dolphin' && this.riding ? 10 : 44) : 0;
    const dragged = this.state === 'dragged' ? (this.dragDepth || 0) * 150 : 0;
    const rise = this.state === 'rise' ? (1 - Ease.outCubic(clamp(this.riseT, 0, 1))) * 150 : 0;
    const fall = this.fell ? Ease.inQuad(clamp(this.fallT / 0.45, 0, 1)) : 0;
    const shredK = this.state === 'shred' ? clamp(this.shredT / 0.35, 0, 1) : 0;
    const flip = this.dir > 0;
    const lift = this.floatH ? this.floatH + Math.sin(this.t * 2) * 4 : 0;
    const drawFn = c => {
      c.save();
      if (sink || dragged || rise) {
        c.beginPath();
        c.rect(-300, -600, 600, 598);
        c.clip();
        c.translate(0, sink + dragged + rise);
      }
      c.translate(0, this.yOff - lift);
      if (flip) c.scale(-1, 1);
      if (fall) {
        if (inWater) c.translate(0, fall * 70);
        else c.rotate(fall * 1.45);
      }
      if (shredK) c.scale(1 + shredK * 0.4, 1 - shredK * 0.85);
      c.scale(sc, sc);
      if (this.type === 'dolphin' && this.riding && inWater) {
        // 海豚在水面游动
        c.save();
        c.translate(0, -30);
        drawZombieArt(c, this);
        c.restore();
      } else drawZombieArt(c, this);
      c.restore();
    };
    const bw = this.type === 'zomboni' ? 300 : this.type === 'gargantuar' ? 420 : 260;
    const bh = this.type === 'gargantuar' ? 380 : this.type === 'zomboni' ? 260 : 280;
    ctx.save();
    ctx.globalAlpha *= this.alpha;
    if (tints.length) drawTinted(ctx, x, y, bw * sc + 60, bh * sc + 80, b.drawScale, drawFn, tints);
    else { ctx.translate(x, y); drawFn(ctx); }
    ctx.restore();

    // 水面涟漪
    if (inWater) {
      ctx.save();
      ctx.globalAlpha *= 0.55 * this.alpha;
      E(ctx, x - 2, y - 2, 34 * sc, 8);
      ctx.strokeStyle = '#e8fbff';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
    // 冰块
    if (this.freezeT > 0 && this.alive) {
      ctx.save();
      ctx.globalAlpha *= 0.45;
      ctx.fillStyle = rg(ctx, x - 10, y - 100, 5, x, y - 70, 80, [0, 'rgba(230,250,255,0.9)', 1, 'rgba(120,200,255,0.5)']);
      ctx.beginPath();
      ctx.moveTo(x - 38, y + 2); ctx.lineTo(x - 42, y - 120); ctx.lineTo(x - 10, y - 150); ctx.lineTo(x + 34, y - 130); ctx.lineTo(x + 36, y + 2); ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
    // 血条
    if (b.showHealth && this.alive && !this.preview) {
      const w = 46, k = clamp(this.totalHp / this.maxTotal(), 0, 1);
      const hy = y - (this.type === 'gargantuar' ? 250 : 170) * this.scale;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(x - w / 2, hy, w, 6);
      ctx.fillStyle = k > 0.5 ? '#e04020' : '#a01010';
      ctx.fillRect(x - w / 2 + 1, hy + 1, (w - 2) * k, 4);
    }
  }

  maxTotal() {
    return this.maxHp + (this.def.armor ? this.def.armor.hp : 0) + (this.def.shield ? this.def.shield.hp : 0);
  }
}
