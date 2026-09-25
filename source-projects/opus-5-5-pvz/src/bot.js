// 自动测试机器人（开发调试用）：用朴素策略游玩关卡，检验关卡可通关性与难度曲线。
import { PLANTS } from './game/defs.js';
import { colX, COLS } from './game/layout.js';

const PRIORITY = ['sunflower', 'sunshroom', 'lilypad', 'cactus', 'blover', 'plantern', 'repeater', 'threepeater', 'splitpea', 'peashooter', 'snowpea', 'fumeshroom', 'puffshroom', 'wallnut', 'tallnut', 'cherrybomb', 'squash', 'jalapeno', 'gravebuster', 'torchwood', 'potatomine', 'chomper', 'iceshroom', 'doomshroom', 'spikeweed', 'tanglekelp', 'scaredyshroom', 'magnetshroom', 'hypnoshroom', 'coffeebean', 'seashroom', 'starfruit', 'pumpkin', 'garlic'];

export function pickSeeds(scene) {
  const av = scene.availablePlants();
  const night = scene.board.isNight;
  const pool = scene.board.info.water.length > 0;
  const fog = !!scene.board.fogCols;
  const zs = scene.level.zombies || [];
  const ranked = PRIORITY.filter(p => av.includes(p) && (!PLANTS[p].night || night) && (p !== 'lilypad' || pool) && (p !== 'tanglekelp' || pool) && (p !== 'gravebuster' || scene.board.graves.length)
    && (p !== 'plantern' || fog) && ((p !== 'cactus' && p !== 'blover') || zs.includes('balloon')) && (p !== 'splitpea' || zs.includes('digger')));
  return ranked.slice(0, scene.maxSlots);
}

export function botStep(scene) {
  const b = scene.board;
  if (scene.phase !== 'play') return;
  for (const s of b.suns) if (s.state === 'rest' || s.state === 'fall') s.collect();
  const ready = t => scene.slots.find(s => s.type === t && s.cool <= 0 && b.sun >= PLANTS[t].cost);
  const raw = (t, c, r) => {
    const s = ready(t);
    if (!s || !b.canPlant(t, c, r).ok) return false;
    b.sun -= PLANTS[t].cost;
    s.cool = s.coolMax;
    b.placePlant(t, c, r);
    return true;
  };
  // 水面需要先铺睡莲
  const place = (t, c, r) => {
    const cell = b.cellOf(c, r);
    if (!cell || cell.main || cell.grave) return false;
    if (b.isWater(r) && !PLANTS[t].aquatic && !cell.base) {
      if (!ready(t) || !ready('lilypad') || b.sun < PLANTS[t].cost + 25) return false;
      raw('lilypad', c, r);
    }
    return raw(t, c, r);
  };
  const rows = b.activeRows;
  const threat = r => b.zombies.filter(z => z.isEnemy && z.alive && z.row === r && z.x < 1250);
  const shootersIn = r => b.plants.filter(p => p.row === r && (p.kind === 'shooter' || p.kind === 'fume')).length;
  const shooterTypes = ['threepeater', 'repeater', 'splitpea', 'fumeshroom', 'snowpea', 'peashooter', 'seashroom', 'puffshroom'];
  const bestShooter = () => shooterTypes.find(t => ready(t) && (t !== 'threepeater' || b.sun >= 325));
  const addShooter = r => {
    const t = bestShooter();
    if (!t) return false;
    const cols = t === 'puffshroom' ? [4, 5, 3, 6] : t === 'fumeshroom' ? [3, 2, 4] : [2, 3, 4, 5];
    for (const c of cols) if (place(t, c, r)) return true;
    return false;
  };
  // 1) 紧急情况
  for (const r of rows) {
    const near = threat(r).filter(z => z.x < 250 + 4 * 100);
    if (near.length) {
      const z = near.sort((a, b2) => a.x - b2.x)[0];
      const c = Math.max(0, Math.min(COLS - 1, Math.floor((z.x - 250) / 100)));
      if (raw('squash', Math.max(0, c - 1), r) || raw('cherrybomb', c, r) || raw('jalapeno', 0, r) || raw('iceshroom', 0, r) || raw('chomper', Math.max(0, c - 1), r)) return;
    }
  }
  // 1.5) 气球僵尸：三叶草吹走 / 仙人掌防空
  const balloons = b.zombies.filter(z => z.isEnemy && z.balloonUp && z.x < 1250);
  if (balloons.length) {
    if (balloons.some(z => z.x < 250 + 300) && raw('blover', 0, rows[0])) return;
    for (const z of balloons) {
      const hasCactus = b.plants.some(p => p.type === 'cactus' && p.row === z.row);
      if (!hasCactus) for (const c of [2, 3, 1, 4]) if (place('cactus', c, z.row)) return;
    }
  }
  // 2) 墓碑
  for (const g of b.graves) if (raw('gravebuster', g.col, g.row)) return;
  const producer = (b.isNight ? ['sunshroom', 'sunflower'] : ['sunflower', 'sunshroom']).find(t => scene.slots.some(s => s.type === t));
  const prodIn = r => b.plants.filter(p => p.row === r && p.kind === 'producer').length;
  const order = rows.slice().sort((a, b2) => threat(b2).length - threat(a).length || shootersIn(a) - shootersIn(b2));
  // 3) 受威胁且没有火力的行优先补射手
  for (const r of order) if (threat(r).length && shootersIn(r) === 0 && addShooter(r)) return;
  // 4) 每行 1 株阳光植物
  if (producer) for (const r of rows) if (prodIn(r) < 1 && (place(producer, 0, r) || place(producer, 1, r))) return;
  // 4.5) 浓雾：路灯花
  if (b.fogCols && b.plants.filter(p => p.type === 'plantern').length < 2) {
    for (const r of [1, 4]) if (b.activeRow(r) && !b.plants.some(p => p.type === 'plantern' && p.row === r)) if (place('plantern', 9 - b.fogCols - 1, r)) return;
  }
  // 5) 每行至少 1 个射手
  for (const r of order) if (shootersIn(r) < 1 && addShooter(r)) return;
  // 6) 第 2 株阳光植物
  if (producer && b.time < 200) for (const r of rows) if (prodIn(r) < 2 && (place(producer, 1, r) || place(producer, 0, r))) return;
  // 7) 火力加强
  for (let k = 2; k <= 4; k++) for (const r of order) if (shootersIn(r) < k && addShooter(r)) return;
  // 8) 坚果
  for (const r of order) if (threat(r).length) { if (place('tallnut', 6, r) || place('wallnut', 6, r)) return; }
  if (raw('tanglekelp', 6, rows.find(r => b.isWater(r) && threat(r).length) ?? -1)) return;
}

export async function runBot(director, GameScene, level, maxSeconds = 600) {
  const scene = new GameScene(level, { source: 'bot' });
  director.swap(scene);
  let t = 0;
  while (t < maxSeconds) {
    if (scene.phase === 'select') {
      scene.chosen = pickSeeds(scene);
      scene.confirmSelect();
    }
    for (let i = 0; i < 30; i++) director.update(1 / 60);
    t += 0.5;
    botStep(scene);
    if (scene.phase === 'won' || scene.phase === 'lost' || scene.phase === 'award') break;
  }
  const b = scene.board;
  return { level: level.id, result: scene.phase, time: Math.round(t), wave: b.waves.wave + '/' + b.waves.total, mowersLeft: b.mowers.filter(m => m.state === 'idle').length, kills: b.kills };
}
