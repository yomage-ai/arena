'use strict';
const BOARD = Object.freeze({ x: 306, y: 142, cw: 116, ch: 106, cols: 9, rows: 5, width: 1600, height: 760 });
const PLANTS = Object.freeze({
 sunflower: { name: '向日葵', cost: 50, cooldown: 5, hp: 300, role: '阳光生产', desc: '把每一缕阳光变成希望。每 12 秒生产 25 阳光。', color: '#f0b72d' },
 pea: { name: '豌豆射手', cost: 100, cooldown: 5, hp: 300, rate: 1.45, damage: 25, role: '基础射手', desc: '可靠的第一道火力。向前方发射豌豆，每次造成 25 点伤害。', color: '#72b348' },
 wall: { name: '坚果墙', cost: 50, cooldown: 15, hp: 2800, role: '坚固防御', desc: '他什么也不说，只是站在那里。拥有 2800 生命值，为后排争取时间。', color: '#b68b54' },
 ice: { name: '寒冰射手', cost: 175, cooldown: 7, hp: 300, rate: 1.55, damage: 25, role: '减速控制', desc: '让不速之客冷静一下。冰豌豆使命中的僵尸减速 50%，持续 4 秒。', color: '#75cbd5' },
 cherry: { name: '樱桃炸弹', cost: 150, cooldown: 28, hp: 9999, role: '范围爆破', desc: '脾气不太好的双胞胎。种下 1 秒后爆炸，清除周围 3×3 格内的僵尸。', color: '#e76b59' },
 repeater: { name: '双发射手', cost: 200, cooldown: 7, hp: 300, rate: 1.45, damage: 25, role: '双倍火力', desc: '一颗不够？那就两颗。每轮连续发射两颗豌豆。', color: '#488e4c' },
 potato: { name: '土豆地雷', cost: 25, cooldown: 12, hp: 300, role: '埋伏陷阱', desc: '低调，但很有分量。需要 8 秒准备，触碰时对附近僵尸造成致命爆炸。', color: '#c69c72' },
 chomper: { name: '大嘴花', cost: 150, cooldown: 10, hp: 400, role: '近身吞噬', desc: '请勿投喂……僵尸除外。吞掉面前一只僵尸，然后消化 16 秒。', color: '#a66cb0' }
});
const ZOMBIES = Object.freeze({
 normal: { name: '普通僵尸', hp: 200, speed: 12, damage: 40, desc: '走得慢，胃口却很好。基础豌豆火力可以轻松对付。' },
 cone: { name: '路障僵尸', hp: 480, speed: 11, damage: 40, desc: '路障多挡几颗豌豆。集中火力，或者让大嘴花一口解决。' },
 bucket: { name: '铁桶僵尸', hp: 920, speed: 10, damage: 45, desc: '铁桶提供厚重护甲。寒冰减速配合双发射手效果出色。' },
 runner: { name: '橄榄球僵尸', hp: 720, speed: 22, damage: 60, desc: '跑得快，撞得狠。坚果墙和爆炸植物是你的好朋友。' },
 flag: { name: '旗帜僵尸', hp: 240, speed: 15, damage: 40, desc: '他带来的不是好消息。每逢大波进攻就会举旗出现。' }
});
class GardenGame {
 constructor(options = {}) { this.random = options.random || Math.random; this.onEvent = options.onEvent || (() => {}); this.nextId = 1; this.reset('adventure'); this.state = 'ready'; }
 emit(type, data = {}) { this.onEvent({ type, ...data }); }
 reset(mode = 'adventure') {
  this.mode = mode; this.state = 'playing'; this.time = 0; this.sun = 250; this.wave = 0; this.waveClock = 20;
  this.plants = []; this.zombies = []; this.shots = []; this.suns = []; this.spawnQueue = []; this.cooldowns = {};
  this.mowers = Array.from({ length: 5 }, (_, row) => ({ row, x: BOARD.x - 56, state: 'ready' }));
  this.skyClock = 2; this.kills = 0; this.planted = 0; this.collected = 0; this.breaches = 0;
  this.addPlant('sunflower', 2, 0); this.addPlant('pea', 2, 2);
 }
 position(row, col) { return { x: BOARD.x + (col + .5) * BOARD.cw, y: BOARD.y + (row + .65) * BOARD.ch }; }
 at(row, col) { return this.plants.find(p => p.row === row && p.col === col && p.hp > 0); }
 addPlant(type, row, col) { const d = PLANTS[type]; const p = { id: this.nextId++, type, row, col, ...this.position(row, col), hp: d.hp, maxHp: d.hp, age: 0, clock: type === 'sunflower' ? 4 : .4, recoil: 0, flash: 0, digest: 0, burst: 0 }; this.plants.push(p); return p; }
 canPlant(type, row, col) {
  if (this.state !== 'playing') return '先开始游戏吧';
  if (!PLANTS[type]) return '选择一张植物卡片';
  if (row < 0 || row >= 5 || col < 0 || col >= 9) return '请种在草坪上';
  if (this.at(row, col)) return '这块草坪已经有植物了';
  if (this.cooldowns[type] > 0) return '种子正在恢复，请稍等';
  if (this.sun < PLANTS[type].cost) return '阳光不足，先收集一些阳光吧';
  return '';
 }
 plant(type, row, col) {
  const error = this.canPlant(type, row, col); if (error) return { ok: false, error };
  this.sun -= PLANTS[type].cost; this.cooldowns[type] = PLANTS[type].cooldown; const p = this.addPlant(type, row, col); this.planted++;
  this.emit('plant', { plant: p }); return { ok: true, plant: p };
 }
 shovel(row, col) { if (this.state !== 'playing') return false; const p = this.at(row, col); if (!p) return false; p.hp = 0; this.emit('shovel', { plant: p }); return true; }
 addSun(x, y, targetY = y + 35) { const sun = { id: this.nextId++, x, y, targetY, age: 0, life: 14, value: 25 }; this.suns.push(sun); this.emit('sunSpawn', { sun }); return sun; }
 collect(id) {
  if (this.state !== 'playing') return false;
  const idx = this.suns.findIndex(s => s.id === id); if (idx < 0) return false;
  const [sun] = this.suns.splice(idx, 1); this.sun += sun.value; this.collected += sun.value; this.emit('collect', { sun }); return true;
 }
 spawn(type, row, x = 1460) {
  const def = ZOMBIES[type]; const z = { id: this.nextId++, type, row, x, y: this.position(row, 0).y + 5, hp: def.hp, maxHp: def.hp, speed: def.speed, age: this.random() * 4, slow: 0, flash: 0, eating: false };
  if (this.mode === 'endless' && this.wave > 6) { z.hp *= 1 + (this.wave - 6) * .12; z.maxHp = z.hp; z.speed *= 1 + Math.min(.8, (this.wave - 6) * .035); }
  this.zombies.push(z); this.emit('spawn', { zombie: z }); return z;
 }
 startWave() {
  this.wave++; const n = this.wave; const amount = [0, 4, 6, 8, 11, 14, 18][n] || 18 + (n - 6) * 3;
  this.waveClock = 35 + Math.min(n * 2, 14);
  for (let i = 0; i < amount; i++) {
   const r = this.random(); let type = 'normal';
   if (n >= 2 && r > .62) type = 'cone'; if (n >= 4 && r > .78) type = 'bucket'; if (n >= 5 && r < .17) type = 'runner';
   if (i === 0 && n % 3 === 0) type = 'flag';
   this.spawnQueue.push({ at: this.time + i * (n >= 5 ? 1.25 : 2.3), type, row: i < 5 ? (i + n) % 5 : Math.floor(this.random() * 5) });
  }
  this.emit('wave', { wave: n, huge: n % 3 === 0 });
 }
 damage(z, amount, ice = false) { if (z.hp <= 0) return; const previous = z.hp; z.hp -= amount; z.flash = .12; if (ice) z.slow = 4; if (z.type !== 'normal' && previous > 200 && z.hp <= 200) this.emit('armor', { zombie: z }); if (z.hp <= 0) { this.kills++; this.emit('kill', { zombie: { ...z } }); } }
 shoot(p) { const ice = p.type === 'ice'; this.shots.push({ x: p.x + 36, y: p.y - 47, row: p.row, damage: PLANTS[p.type].damage, ice }); p.recoil = 1; this.emit('shoot', { plant: p }); }
 explode(p, radius) {
  this.emit('explode', { x: p.x, y: p.y - 20, radius, type: p.type });
  for (const z of this.zombies) if (Math.abs(z.row - p.row) <= (p.type === 'cherry' ? 1 : 0) && Math.abs(z.x - p.x) < radius) this.damage(z, 1800);
  p.hp = 0;
 }
 update(dt) {
  if (this.state !== 'playing') return;
  this.time += dt; this.waveClock -= dt;
  for (const key of Object.keys(this.cooldowns)) this.cooldowns[key] = Math.max(0, this.cooldowns[key] - dt);
  this.skyClock -= dt; if (this.skyClock <= 0) { this.skyClock = 6.5 + this.random() * 1.5; this.addSun(BOARD.x + 50 + this.random() * 940, -35, 170 + this.random() * 430); }
  for (const s of this.suns) { s.age += dt; s.life -= dt; s.y += Math.min(s.targetY - s.y, dt * (s.y < 90 ? 110 : 55)); }
  this.suns = this.suns.filter(s => s.life > 0);
  if (this.waveClock <= 0 && (this.mode === 'endless' || this.wave < 6)) this.startWave();
  for (let i = this.spawnQueue.length - 1; i >= 0; i--) if (this.spawnQueue[i].at <= this.time) { const s = this.spawnQueue.splice(i, 1)[0]; this.spawn(s.type, s.row, 1440 + this.random() * 90); }
  for (const p of this.plants) {
   if (p.hp <= 0) continue;
   p.age += dt; p.clock -= dt; p.recoil = Math.max(0, p.recoil - dt * 5); p.flash = Math.max(0, p.flash - dt); p.digest = Math.max(0, p.digest - dt);
   if (p.type === 'sunflower' && p.clock <= 0) { this.addSun(p.x + 15, p.y - 55, p.y + 5); p.clock = 12; p.recoil = 1; }
   if (p.type === 'cherry' && p.age > 1) this.explode(p, BOARD.cw * 1.55);
   if (p.type === 'potato' && p.age >= 8 && this.zombies.some(z => z.hp > 0 && z.row === p.row && Math.abs(z.x - p.x) < 48)) this.explode(p, 95);
   if (p.type === 'chomper' && p.digest <= 0) { const z = this.zombies.find(z => z.hp > 0 && z.row === p.row && z.x > p.x - 25 && z.x < p.x + 135); if (z) { this.damage(z, z.hp); p.digest = 16; p.recoil = 1; this.emit('chomp', { plant: p }); } }
   if (PLANTS[p.type].rate) {
    if (p.burst > 0) { p.burst -= dt; if (p.burst <= 0) this.shoot(p); }
    if (p.clock <= 0 && this.zombies.some(z => z.hp > 0 && z.row === p.row && z.x > p.x - 15 && z.x < 1550)) { this.shoot(p); p.clock = PLANTS[p.type].rate; if (p.type === 'repeater') p.burst = .19; }
   }
  }
  for (const shot of this.shots) {
   const before = shot.x; shot.x += 400 * dt;
   const z = this.zombies.filter(z => z.hp > 0 && z.row === shot.row && z.x + 25 >= before && z.x - 24 <= shot.x).sort((a,b) => a.x-b.x)[0];
   if (z) { this.damage(z, shot.damage, shot.ice); shot.dead = true; this.emit('hit', { x: shot.x, y: shot.y, ice: shot.ice }); }
  }
  this.shots = this.shots.filter(p => !p.dead && p.x < 1630);
  for (const z of this.zombies) {
   if (z.hp <= 0) continue;
   z.age += dt; z.slow = Math.max(0, z.slow - dt); z.flash = Math.max(0, z.flash - dt);
   const plant = this.plants.filter(p => p.hp > 0 && p.row === z.row && z.x - p.x < 53 && z.x - p.x > -30).sort((a,b) => b.x - a.x)[0];
   z.eating = !!plant;
   if (plant) { plant.hp -= ZOMBIES[z.type].damage * dt * (z.slow > 0 ? .5 : 1); plant.flash = .15; if (plant.hp <= 0) this.emit('plantLost', { plant }); }
   else z.x -= z.speed * dt * (z.slow > 0 ? .5 : 1);
   const mower = this.mowers[z.row];
   if (z.x < BOARD.x - 29 && mower.state === 'ready') { mower.state = 'active'; this.breaches++; this.emit('mower', { mower }); }
   if (z.x < 175) { this.state = 'lost'; this.emit('end', { won: false }); return; }
  }
  for (const m of this.mowers) if (m.state === 'active') { const old = m.x; m.x += dt * 620; for (const z of this.zombies) if (z.row === m.row && z.hp > 0 && z.x > old - 65 && z.x < m.x + 55) this.damage(z, z.hp); if (m.x > 1660) m.state = 'used'; }
  this.plants = this.plants.filter(p => p.hp > 0); this.zombies = this.zombies.filter(z => z.hp > 0);
  if (this.mode === 'adventure' && this.wave === 6 && !this.spawnQueue.length && !this.zombies.length) { this.state = 'won'; this.emit('end', { won: true }); }
 }
 serialize() { const keys = ['mode','time','sun','wave','waveClock','plants','zombies','shots','suns','spawnQueue','cooldowns','mowers','skyClock','kills','planted','collected','breaches','nextId']; return Object.fromEntries(keys.map(k => [k, this[k]])); }
 restore(data) { if (!data || !Array.isArray(data.plants) || !Array.isArray(data.zombies) || !Array.isArray(data.mowers) || !Number.isFinite(data.sun) || !Number.isFinite(data.time)) return false; for (const key of Object.keys(this.serialize())) if (data[key] !== undefined) this[key] = data[key]; this.state = 'playing'; return true; }
}
if (typeof module !== 'undefined' && module.exports) module.exports = { GardenGame, PLANTS, ZOMBIES, BOARD };
