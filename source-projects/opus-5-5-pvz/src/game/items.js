// 子弹、阳光、割草机、墓碑、保龄球坚果、奖励物等小型实体。
import { rand, clamp, lerp, Ease, TAU } from '../core/util.js';
import { audio } from '../core/audio.js';
import { drawProjectile, drawSun, drawMower, drawGrave, drawTrophy, drawNote, drawPacket } from '../gfx/uiArt.js';
import { bowlnut } from '../gfx/plantArt.js';
import { LAWN_X, LAWN_RIGHT, COL_W, colOf, colX } from './layout.js';

// ================= 子弹 =================
export class Projectile {
  constructor(board, kind, x, y, row, o = {}) {
    this.board = board;
    this.kind = kind;
    this.x = x;
    this.row = row;
    this.groundY = board.rowY(row) - 4;
    this.baseY = y;
    this.fromY = o.fromRow !== undefined ? board.rowY(o.fromRow) - (board.rowY(row) - y) : y;
    this.y = this.fromY;
    this.bend = o.fromRow !== undefined && o.fromRow !== row ? 0 : 1;
    this.speed = kind === 'puff' ? 380 : 440;
    this.dmg = kind === 'fire' ? 40 : 20;
    this.dir = o.dir || 1;
    this.maxX = o.maxX || 1300;
    this.minX = o.minX ?? 150;
    this.air = !!o.air; // 仙人掌的刺：可以打中空中的气球僵尸
    this.dead = false;
    this.t = 0;
    this.torched = false;
    // 扫掠判定起点：从植物本体开始，站在射手身上的僵尸也能被打中
    this.prevX = o.originX ?? x - 44 * this.dir;
  }

  update(dt) {
    const b = this.board;
    this.t += dt;
    this.x += this.speed * this.dir * dt;
    if (this.bend < 1) {
      this.bend = Math.min(1, this.bend + dt * 4.5);
      this.y = lerp(this.fromY, this.baseY, Ease.outQuad(this.bend));
    } else this.y = this.baseY;
    // 火炬树桩
    if (this.kind === 'pea' || this.kind === 'snow') {
      const c = colOf(this.x);
      const cell = b.cellOf(c, this.row);
      const tw = cell && cell.main && cell.main.type === 'torchwood' && !cell.main.dead ? cell.main : null;
      if (tw && Math.abs(this.x - tw.x) < 14 && this.lastTorch !== tw) {
        this.lastTorch = tw;
        if (this.kind === 'snow') { this.kind = 'pea'; this.dmg = 20; }
        else { this.kind = 'fire'; this.dmg = 40; }
        audio.play('firepea');
      }
    }
    // 命中检测（扫掠区间 [prevX, x]）
    let hit = null;
    const x0 = this.bend >= 1 ? this.prevX : this.x;
    const lo = Math.min(x0, this.x), hi = Math.max(x0, this.x);
    for (const z of b.zombies) {
      if (z.row !== this.row || !z.isEnemy) continue;
      if (!z.hittable && !(this.air && z.balloonUp && z.alive)) continue;
      const hw = z.halfWidth;
      if (hi + 8 >= z.x - hw && lo - 8 <= z.x + hw + 6) {
        if (!hit || (this.dir > 0 ? z.x < hit.x : z.x > hit.x)) hit = z;
      }
    }
    this.prevX = this.x;
    if (hit) return this.hit(hit);
    if (this.x < this.minX) this.dead = true;
    if (this.x > this.maxX) {
      this.dead = true;
      if (this.kind === 'puff') b.fx.add({ type: 'glow', x: this.x, y: this.y, size: 10, color: 'rgba(220,160,255,0.6)', life: 0.25, grow: 1 });
    }
  }

  hit(z) {
    const b = this.board;
    this.dead = true;
    if (z.balloonUp && this.air) {
      z.popBalloon();
      b.fx.sparks(this.x, this.y, 6, '#fff');
      return;
    }
    const part = z.takeDamage(this.dmg, this.kind === 'spike' ? 'pea' : this.kind);
    if (this.kind === 'spike') { b.fx.sparks(Math.max(this.x, z.x - z.halfWidth), this.y, 4, '#dfffc0'); audio.play(part === 'metal' ? 'metal' : 'splat'); return; }
    const hx = Math.max(this.x, z.x - z.halfWidth + 4);
    if (this.kind === 'fire') {
      audio.play('firepea');
      b.fx.fireBurst(hx, this.y, 10, 0.8);
      for (const o of b.zombies) {
        if (o !== z && o.row === this.row && o.isEnemy && o.hittable && Math.abs(o.x - z.x) < 70) o.takeDamage(13, 'fire');
      }
      return;
    }
    const color = this.kind === 'snow' ? '#bfeaff' : this.kind === 'puff' ? '#e0a8ff' : '#8ee04e';
    b.fx.splat(hx, this.y, color, this.kind === 'puff' ? 5 : 7);
    if (this.kind === 'snow') audio.play('freezehit');
    if (part === 'metal') { audio.play('metal'); b.fx.sparks(hx, this.y, 4, '#fff'); }
    else if (part === 'shield') audio.play('shieldhit');
    else if (part === 'cone') audio.play('plastic');
    else if (part === 'paper') audio.play('paper');
    else audio.play('splat');
  }

  draw(ctx) {
    drawProjectile(ctx, this, this.t);
  }
}

// ================= 杨桃的星星（二维飞行） =================
export class StarShot {
  constructor(board, x, y, vx, vy) {
    this.board = board;
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.t = 0;
    this.dead = false;
    this.row = -1;
  }
  update(dt) {
    const b = this.board;
    this.t += dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    for (const z of b.zombies) {
      if (!z.isEnemy || !z.hittable) continue;
      const zy = z.y;
      const top = zy - 150 * z.scale;
      if (this.x > z.x - z.halfWidth - 6 && this.x < z.x + z.halfWidth + 6 && this.y > top && this.y < zy + 4) {
        this.dead = true;
        const part = z.takeDamage(20, 'pea');
        b.fx.sparks(this.x, this.y, 6, '#ffe45a');
        audio.play(part === 'metal' ? 'metal' : 'splat');
        return;
      }
    }
    if (this.x < 140 || this.x > 1300 || this.y < 60 || this.y > 740) this.dead = true;
  }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(255,230,90,0.35)';
    ctx.beginPath(); ctx.arc(0, 0, 15, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.rotate(this.t * 10);
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 === 0 ? 11 : 5;
      if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fillStyle = '#ffe04a';
    ctx.strokeStyle = '#9a6a00';
    ctx.lineWidth = 1.6;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

// ================= 保龄球坚果 =================
export class BowlNut {
  constructor(board, kind, row, x) {
    this.board = board;
    this.kind = kind; // normal | explode | giant
    this.row = row;
    this.x = x;
    this.y = board.rowY(row);
    this.vy = 0; // 行切换
    this.targetRow = row;
    this.roll = 0;
    this.speed = kind === 'giant' ? 150 : 200;
    this.dead = false;
    this.combo = 0;
    this.hitSet = new Set();
    this.t = 0;
    audio.play('bowl');
  }

  update(dt) {
    const b = this.board;
    this.t += dt;
    this.x += this.speed * dt;
    this.roll += (this.speed * dt) / (this.kind === 'giant' ? 60 : 32);
    // 斜向弹跳
    if (this.dirY) {
      this.y += this.dirY * 190 * dt;
      const ty = b.rowY(this.targetRow);
      if ((this.dirY > 0 && this.y >= ty) || (this.dirY < 0 && this.y <= ty)) {
        this.y = ty;
        this.row = this.targetRow;
        // 到达后继续朝同方向弹（碰边反弹）
        const next = this.targetRow + this.dirY;
        if (!b.activeRow(next)) this.dirY = -this.dirY;
        this.targetRow = this.row + this.dirY;
        if (!b.activeRow(this.targetRow)) { this.dirY = 0; }
      }
    }
    // 命中（按当前所在行）
    const curRow = this.dirY ? Math.round(this.nearestRow()) : this.row;
    for (const z of b.zombies) {
      if (!z.isEnemy || !z.alive || z.row !== curRow || this.hitSet.has(z)) continue;
      if (Math.abs(z.x - this.x) < (this.kind === 'giant' ? 70 : 42)) {
        this.hitSet.add(z);
        this.hitZombie(z);
        if (this.dead) return;
        if (this.kind === 'normal') break;
      }
    }
    if (this.x > 1320) this.dead = true;
  }

  nearestRow() {
    const b = this.board;
    let best = this.row, bd = 1e9;
    for (let r = 0; r < b.rows; r++) { const d = Math.abs(b.rowY(r) - this.y); if (d < bd) { bd = d; best = r; } }
    return best;
  }

  hitZombie(z) {
    const b = this.board;
    if (this.kind === 'explode') {
      this.dead = true;
      b.explodeArea(this.x, this.y, z.row, 1, 1, 'nut');
      return;
    }
    if (this.kind === 'giant') {
      z.takeDamage(99999, 'squash');
      audio.play('bowlhit');
      b.shake(3);
      return;
    }
    // 普通：打掉护具，否则直接击倒
    audio.play('bowlhit');
    if (z.shield || z.armor) {
      if (z.shield) z.takeDamage(z.shield.hp + 1, 'bowl');
      else z.takeDamage(z.armor.hp, 'bowl');
    } else z.takeDamage(z.hp + 5, 'bowl');
    this.combo++;
    if (this.combo >= 2) {
      b.fx.floatText(this.x, this.y - 90, `${this.combo} 连击！`, { size: 28, color: '#ffe23a', stroke: '#6a2a00' });
      audio.play('combo', { n: this.combo });
    }
    b.fx.sparks(this.x + 20, this.y - 40, 8, '#fff');
    // 反弹到相邻行
    const up = this.row - 1, down = this.row + 1;
    let dir;
    if (!b.activeRow(up)) dir = 1;
    else if (!b.activeRow(down)) dir = -1;
    else dir = this.dirY ? -this.dirY : Math.random() < 0.5 ? -1 : 1;
    if (!b.activeRow(this.row + dir)) dir = -dir;
    if (b.activeRow(this.row + dir)) {
      this.dirY = dir;
      this.targetRow = this.row + dir;
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    bowlnut(ctx, { roll: this.roll }, this.kind);
    ctx.restore();
  }
}

// ================= 阳光 =================
export class Sun {
  constructor(board, x, y, value, o = {}) {
    this.board = board;
    this.x = x;
    this.y = y;
    this.value = value;
    this.r = value >= 50 ? 30 : value >= 25 ? 23 : 17;
    this.t = rand(0, 5);
    this.state = o.fall ? 'fall' : 'pop';
    this.targetY = o.targetY ?? y + 40;
    this.vx = o.vx ?? rand(-50, 50);
    this.vy = o.vy ?? -220;
    this.groundY = o.groundY ?? y + rand(24, 40);
    this.life = o.fall ? 10 : 9;
    this.alpha = 1;
    this.dead = false;
    this.restT = 0;
  }

  update(dt) {
    this.t += dt;
    if (this.state === 'fall') {
      this.y += 62 * dt;
      if (this.y >= this.targetY) { this.y = this.targetY; this.state = 'rest'; }
    } else if (this.state === 'pop') {
      this.vy += 700 * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      if (this.vy > 0 && this.y >= this.groundY) { this.y = this.groundY; this.state = 'rest'; }
    } else if (this.state === 'rest') {
      this.restT += dt;
      this.life -= dt;
      if (this.life < 2) this.alpha = 0.35 + 0.65 * Math.abs(Math.sin(this.t * 8));
      if (this.life <= 0) this.dead = true;
      if (this.board.autoCollect && this.restT > 0.6) this.collect();
    } else if (this.state === 'collect') {
      this.ct += dt / 0.55;
      const k = Ease.inOutQuad(clamp(this.ct, 0, 1));
      const tgt = this.board.sunTarget();
      this.x = lerp(this.cx0, tgt.x, k);
      this.y = lerp(this.cy0, tgt.y, k) - Math.sin(k * Math.PI) * 30;
      this.alpha = 1 - k * 0.3;
      this.scaleK = 1 - k * 0.35;
      if (this.ct >= 1) { this.dead = true; this.board.onSunArrived(this.value); }
    }
  }

  hitTest(x, y) {
    return this.state !== 'collect' && Math.hypot(x - this.x, y - this.y) < this.r + 16;
  }

  collect() {
    if (this.state === 'collect') return;
    this.state = 'collect';
    this.ct = 0;
    this.cx0 = this.x;
    this.cy0 = this.y;
    this.alpha = 1;
    this.board.collectSun(this);
    audio.play('sun');
  }

  draw(ctx) {
    drawSun(ctx, this.x, this.y, this.r * (this.scaleK || 1), this.t, this.alpha);
  }
}

// ================= 割草机 / 泳池清洁车 =================
export class Mower {
  constructor(board, row) {
    this.board = board;
    this.row = row;
    this.homeX = LAWN_X - 52;
    this.x = this.homeX - 160;
    this.y = board.rowY(row);
    this.state = 'arrive';
    this.delay = row * 0.12;
    this.t = 0;
    this.pool = board.isWater(row);
    this.dead = false;
  }

  update(dt) {
    const b = this.board;
    this.t += dt;
    if (this.state === 'arrive') {
      if (!b.moversArrive) return;
      this.delay -= dt;
      if (this.delay <= 0) this.x = Math.min(this.homeX, this.x + 520 * dt);
      if (this.x >= this.homeX) this.state = 'idle';
    } else if (this.state === 'run') {
      this.x += 380 * dt;
      if (Math.random() < dt * 30 && !this.pool) b.fx.add({ type: 'rect', x: this.x - 20, y: this.y - 8, vx: rand(-160, -60), vy: rand(-160, -60), g: 500, size: rand(3, 6), aspect: 0.4, color: '#5aa83a', rot: rand(TAU), vr: 8, life: 0.6 });
      if (this.pool && Math.random() < dt * 20) b.splash(this.x - 20, this.y, 0.4);
      for (const z of b.zombies) {
        if (z.row === this.row && !z.dead && !z.preview && z.state !== 'shred' && z.x - 30 < this.x + 34 && z.x + 30 > this.x - 34 && z.state !== 'flying' && !z.balloonUp && !z.underground && z.state !== 'blown' && (z.state !== 'drop' || z.floatH < 40)) z.shred();
      }
      if (this.x > 1340) this.dead = true;
    }
  }

  trigger() {
    if (this.state !== 'idle' && this.state !== 'arrive') return false;
    this.state = 'run';
    audio.play('mower');
    return true;
  }

  draw(ctx) {
    drawMower(ctx, this.x, this.y - (this.pool ? 6 : 0), this.t, this.state === 'run', this.pool);
  }
}

// ================= 墓碑 =================
export class Grave {
  constructor(board, col, row, o = {}) {
    this.board = board;
    this.col = col;
    this.row = row;
    this.x = colX(col);
    this.y = board.rowY(row);
    this.variant = o.variant ?? ((Math.random() * 4) | 0);
    this.rise = o.instant ? 1 : 0;
    this.sink = 0;
    this.t = 0;
    this.dead = false;
  }
  update(dt) {
    this.t += dt;
    if (this.rise < 1) this.rise = Math.min(1, this.rise + dt * 1.5);
  }
  draw(ctx) {
    drawGrave(ctx, this.x, this.y + 2, this.variant, this.t, { sink: this.sink, rise: Ease.outBack(this.rise) });
  }
}

// ================= 奖励掉落物 =================
export class Reward {
  constructor(board, x, y, reward) {
    this.board = board;
    this.reward = reward; // {type:'plant'|'trophy'|'note', id}
    this.x = x;
    this.y = y - 60;
    this.vx = rand(-60, -20);
    this.vy = -320;
    this.groundY = y - 30;
    this.state = 'drop';
    this.t = 0;
    this.dead = false;
  }
  update(dt) {
    this.t += dt;
    if (this.state === 'drop') {
      this.vy += 900 * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      if (this.y >= this.groundY && this.vy > 0) {
        if (this.vy > 200) { this.vy = -this.vy * 0.35; this.vx *= 0.5; }
        else { this.y = this.groundY; this.state = 'rest'; }
      }
    }
  }
  hitTest(x, y) { return Math.abs(x - this.x) < 48 && Math.abs(y - this.y) < 60; }
  draw(ctx, t) {
    const glow = 0.5 + 0.5 * Math.sin(this.t * 4);
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.rotate(this.t * 0.8);
    for (let i = 0; i < 12; i++) {
      ctx.rotate(TAU / 12);
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(-10, -90); ctx.lineTo(10, -90); ctx.closePath();
      ctx.fillStyle = `rgba(255,240,150,${0.12 + glow * 0.08})`;
      ctx.fill();
    }
    ctx.restore();
    const bob = Math.sin(this.t * 3) * 4;
    if (this.reward.type === 'plant') drawPacket(ctx, -31, -43 + bob, this.reward.id, { glow });
    else if (this.reward.type === 'trophy') drawTrophy(ctx, 0, 30 + bob, 1, this.t);
    else drawNote(ctx, 0, 30 + bob, 1);
    ctx.restore();
  }
}
