// 关卡配置：冒险模式三大场景各 10 关，外加小游戏与生存模式。
// waves：波数；zombies：可出现的僵尸；intro：本关新登场的僵尸；ramp：每波点数增长；reward：通关奖励。
const DAY = 'day', NIGHT = 'night', POOL = 'pool', FOG = 'fog';

export const ADVENTURE = [
  // ---------------- 白天 ----------------
  { id: '1-1', env: DAY, rows: [2], sod: [2], waves: 4, zombies: ['normal'], ramp: 0, plants: ['peashooter'], reward: { type: 'plant', id: 'sunflower' }, tutorial: 'basic', sun: 150, firstDelay: 22 },
  { id: '1-2', env: DAY, rows: [1, 2, 3], sod: [1, 2, 3], newSod: [1, 3], waves: 6, zombies: ['normal'], ramp: 0.2, reward: { type: 'plant', id: 'cherrybomb' }, tutorial: 'sunflower' },
  { id: '1-3', env: DAY, sod: [0, 1, 2, 3, 4], newSod: [0, 4], waves: 8, zombies: ['normal', 'cone'], intro: 'cone', ramp: 0.3, reward: { type: 'plant', id: 'wallnut' }, tutorial: 'cherry' },
  { id: '1-4', env: DAY, waves: 10, zombies: ['normal', 'cone'], ramp: 0.38, reward: { type: 'plant', id: 'potatomine' }, tutorial: 'shovel' },
  { id: '1-5', env: DAY, mode: 'bowling', waves: 10, zombies: ['normal', 'cone', 'bucket'], intro: 'bucket', ramp: 0.55, reward: { type: 'plant', id: 'snowpea' }, title: '坚果保龄球' },
  { id: '1-6', env: DAY, waves: 10, zombies: ['normal', 'cone', 'pole'], intro: 'pole', ramp: 0.42, reward: { type: 'plant', id: 'chomper' } },
  { id: '1-7', env: DAY, waves: 15, zombies: ['normal', 'cone', 'pole', 'bucket'], ramp: 0.4, reward: { type: 'plant', id: 'repeater' } },
  { id: '1-8', env: DAY, waves: 15, zombies: ['normal', 'cone', 'pole', 'bucket'], ramp: 0.45, reward: { type: 'plant', id: 'squash' } },
  { id: '1-9', env: DAY, waves: 20, zombies: ['normal', 'cone', 'pole', 'bucket'], ramp: 0.42, reward: { type: 'plant', id: 'puffshroom' } },
  {
    id: '1-10', env: DAY, mode: 'conveyor', waves: 20, zombies: ['normal', 'cone', 'pole', 'bucket'], ramp: 0.48, reward: { type: 'plant', id: 'sunshroom' }, title: '传送带关卡',
    conveyor: [['peashooter', 10], ['repeater', 12], ['snowpea', 8], ['wallnut', 10], ['cherrybomb', 5], ['potatomine', 7], ['chomper', 6], ['squash', 6]],
  },
  // ---------------- 黑夜 ----------------
  { id: '2-1', env: NIGHT, graves: 3, waves: 10, zombies: ['normal', 'cone', 'newspaper'], intro: 'newspaper', ramp: 0.4, reward: { type: 'plant', id: 'fumeshroom' }, tutorial: 'night' },
  { id: '2-2', env: NIGHT, graves: 5, waves: 10, zombies: ['normal', 'cone', 'newspaper', 'pole'], ramp: 0.44, reward: { type: 'plant', id: 'gravebuster' } },
  { id: '2-3', env: NIGHT, graves: 5, waves: 15, zombies: ['normal', 'cone', 'newspaper', 'screendoor'], intro: 'screendoor', ramp: 0.42, reward: { type: 'plant', id: 'hypnoshroom' } },
  { id: '2-4', env: NIGHT, graves: 6, waves: 15, zombies: ['normal', 'cone', 'newspaper', 'screendoor', 'bucket'], ramp: 0.4, reward: { type: 'plant', id: 'scaredyshroom' } },
  { id: '2-5', env: NIGHT, mode: 'whack', graves: 9, waves: 12, zombies: ['normal', 'cone', 'bucket'], ramp: 0.6, reward: { type: 'plant', id: 'iceshroom' }, title: '锤僵尸' },
  { id: '2-6', env: NIGHT, graves: 6, waves: 15, zombies: ['normal', 'cone', 'newspaper', 'football', 'screendoor'], intro: 'football', ramp: 0.4, reward: { type: 'plant', id: 'doomshroom' } },
  { id: '2-7', env: NIGHT, graves: 6, waves: 20, zombies: ['normal', 'cone', 'newspaper', 'dancer', 'bucket'], intro: 'dancer', ramp: 0.42, reward: { type: 'plant', id: 'spikeweed' } },
  { id: '2-8', env: NIGHT, graves: 7, waves: 20, zombies: ['normal', 'cone', 'newspaper', 'screendoor', 'football', 'pole'], ramp: 0.42, reward: { type: 'plant', id: 'jalapeno' } },
  { id: '2-9', env: NIGHT, graves: 8, waves: 20, zombies: ['normal', 'cone', 'newspaper', 'screendoor', 'football', 'dancer', 'bucket'], ramp: 0.42, reward: { type: 'plant', id: 'torchwood' } },
  {
    id: '2-10', env: NIGHT, mode: 'conveyor', graves: 5, waves: 20, zombies: ['normal', 'cone', 'newspaper', 'screendoor', 'football', 'dancer', 'bucket'], ramp: 0.5, reward: { type: 'plant', id: 'lilypad' }, title: '传送带关卡',
    conveyor: [['puffshroom', 10], ['fumeshroom', 12], ['hypnoshroom', 6], ['scaredyshroom', 8], ['iceshroom', 4], ['doomshroom', 3], ['gravebuster', 5], ['wallnut', 8], ['spikeweed', 6], ['jalapeno', 4]],
  },
  // ---------------- 泳池 ----------------
  { id: '3-1', env: POOL, waves: 10, zombies: ['normal', 'cone', 'pole', 'bucket'], ramp: 0.44, reward: { type: 'plant', id: 'tanglekelp' }, tutorial: 'pool', intro: 'ducky' },
  { id: '3-2', env: POOL, waves: 15, zombies: ['normal', 'cone', 'pole', 'snorkel', 'bucket'], intro: 'snorkel', ramp: 0.45, reward: { type: 'plant', id: 'threepeater' } },
  { id: '3-3', env: POOL, waves: 15, zombies: ['normal', 'cone', 'snorkel', 'zomboni', 'newspaper'], intro: 'zomboni', ramp: 0.4, reward: { type: 'plant', id: 'tallnut' } },
  { id: '3-4', env: POOL, waves: 20, zombies: ['normal', 'cone', 'bucket', 'dolphin', 'screendoor', 'pole'], intro: 'dolphin', ramp: 0.45, reward: { type: 'plant', id: 'magnetshroom' } },
  { id: '3-5', env: POOL, mode: 'bowling', waves: 12, zombies: ['normal', 'cone', 'bucket', 'football', 'newspaper'], ramp: 0.7, reward: { type: 'plant', id: 'coffeebean' }, title: '坚果保龄球 2', giant: true },
  { id: '3-6', env: POOL, waves: 20, zombies: ['normal', 'cone', 'bucket', 'snorkel', 'dolphin', 'football', 'zomboni'], ramp: 0.48, reward: { type: 'plant', id: 'seashroom' } },
  { id: '3-7', env: POOL, waves: 20, zombies: ['normal', 'cone', 'bucket', 'dancer', 'snorkel', 'screendoor', 'pole'], ramp: 0.44, reward: { type: 'plant', id: 'plantern' } },
  { id: '3-8', env: POOL, waves: 20, zombies: ['normal', 'cone', 'bucket', 'gargantuar', 'dolphin', 'snorkel'], intro: 'gargantuar', ramp: 0.42, reward: { type: 'plant', id: 'cactus' } },
  { id: '3-9', env: POOL, waves: 25, zombies: ['normal', 'cone', 'bucket', 'football', 'zomboni', 'dolphin', 'gargantuar', 'newspaper'], ramp: 0.44, reward: { type: 'plant', id: 'blover' } },
  {
    id: '3-10', env: POOL, mode: 'conveyor', waves: 30, zombies: ['normal', 'cone', 'bucket', 'football', 'zomboni', 'dolphin', 'snorkel', 'gargantuar', 'dancer'], ramp: 0.48, reward: { type: 'plant', id: 'splitpea' }, title: '泳池决战',
    conveyor: [['lilypad', 16], ['threepeater', 8], ['repeater', 8], ['torchwood', 5], ['tallnut', 6], ['squash', 6], ['tanglekelp', 5], ['jalapeno', 4], ['cherrybomb', 4], ['spikeweed', 5], ['snowpea', 6], ['wallnut', 5]],
  },
  // ---------------- 浓雾 ----------------
  { id: '4-1', env: FOG, sun: 150, firstDelay: 25, fog: 4, waves: 10, zombies: ['normal', 'cone', 'bucket', 'snorkel', 'balloon'], intro: 'balloon', ramp: 0.42, reward: { type: 'plant', id: 'starfruit' }, tutorial: 'fog' },
  { id: '4-2', env: FOG, sun: 150, firstDelay: 25, fog: 4, waves: 15, zombies: ['normal', 'cone', 'bucket', 'balloon', 'digger', 'dolphin'], intro: 'digger', ramp: 0.42, reward: { type: 'plant', id: 'pumpkin' } },
  { id: '4-3', env: FOG, sun: 150, firstDelay: 25, fog: 4, waves: 15, zombies: ['normal', 'cone', 'pogo', 'balloon', 'snorkel', 'screendoor'], intro: 'pogo', ramp: 0.42, reward: { type: 'plant', id: 'garlic' } },
  { id: '4-4', env: FOG, sun: 150, firstDelay: 25, fog: 5, waves: 20, zombies: ['normal', 'cone', 'bucket', 'jackbox', 'digger', 'dolphin'], intro: 'jackbox', ramp: 0.42, reward: { type: 'note', text: '雾越来越浓了，我们越来越近了。' } },
  { id: '4-5', env: FOG, fog: 6, storm: true, waves: 12, zombies: ['normal', 'cone', 'bucket', 'football', 'dolphin', 'snorkel'], ramp: 0.5, reward: { type: 'note', text: '你在雷雨中也看得见我们吗？' }, title: '雷雨之夜', mode: 'conveyor',
    conveyor: [['lilypad', 12], ['repeater', 8], ['threepeater', 6], ['plantern', 6], ['tallnut', 5], ['squash', 5], ['tanglekelp', 4], ['jalapeno', 3], ['cherrybomb', 3], ['splitpea', 4], ['starfruit', 5]] },
  { id: '4-6', env: FOG, sun: 150, firstDelay: 25, fog: 5, waves: 20, zombies: ['normal', 'cone', 'bucket', 'balloon', 'pogo', 'football', 'snorkel'], ramp: 0.44, reward: { type: 'note', text: '我们喜欢你的蘑菇，它们尝起来像雾。' } },
  { id: '4-7', env: FOG, sun: 150, firstDelay: 25, fog: 5, waves: 20, zombies: ['normal', 'cone', 'bucket', 'digger', 'jackbox', 'dolphin', 'zomboni'], ramp: 0.44, reward: { type: 'note', text: '听说有一个扛着电线杆的大家伙正在赶来……' } },
  { id: '4-8', env: FOG, sun: 150, firstDelay: 25, fog: 5, waves: 20, zombies: ['normal', 'cone', 'bucket', 'gargantuar', 'balloon', 'snorkel', 'dolphin'], ramp: 0.42, reward: { type: 'note', text: '巨人倒下了，但它们还会回来。' } },
  { id: '4-9', env: FOG, sun: 150, firstDelay: 25, fog: 6, storm: true, waves: 25, zombies: ['normal', 'cone', 'bucket', 'football', 'pogo', 'digger', 'balloon', 'jackbox', 'dolphin'], ramp: 0.44, reward: { type: 'note', text: '最后一战即将来临。' } },
  {
    id: '4-10', env: FOG, fog: 5, mode: 'conveyor', waves: 30, zombies: ['normal', 'cone', 'bucket', 'football', 'zomboni', 'dolphin', 'snorkel', 'gargantuar', 'balloon', 'digger', 'pogo', 'jackbox'], ramp: 0.48, reward: { type: 'trophy' }, title: '最终决战',
    conveyor: [['lilypad', 14], ['threepeater', 8], ['repeater', 8], ['plantern', 5], ['cactus', 5], ['blover', 3], ['splitpea', 5], ['starfruit', 5], ['pumpkin', 5], ['tallnut', 5], ['squash', 5], ['jalapeno', 3], ['cherrybomb', 3], ['torchwood', 4]],
  },
];

export const MINIGAMES = [
  { id: 'mg-bowling', env: DAY, mode: 'bowling', waves: 15, zombies: ['normal', 'cone', 'bucket', 'newspaper', 'pole'], ramp: 0.7, title: '坚果保龄球', desc: '用滚动的坚果击倒一排排僵尸，打出连击！', giant: true },
  { id: 'mg-whack', env: NIGHT, mode: 'whack', graves: 10, waves: 15, zombies: ['normal', 'cone', 'bucket'], ramp: 0.7, title: '锤僵尸', desc: '僵尸会从坟墓里钻出来，快抡起锤子砸它们！' },
  { id: 'mg-vase', env: NIGHT, mode: 'vase', title: '砸罐子', desc: '砸开罐子，看看里面是植物还是僵尸。', waves: 1, zombies: ['normal', 'cone', 'bucket', 'newspaper', 'pole', 'screendoor', 'football'] },
  { id: 'mg-conveyor', env: POOL, mode: 'conveyor', waves: 20, zombies: ['normal', 'cone', 'bucket', 'snorkel', 'dolphin', 'football', 'zomboni', 'pole'], ramp: 0.55, title: '传送带狂欢', desc: '不需要阳光！用传送带送来的植物守住泳池。',
    conveyor: [['lilypad', 16], ['peashooter', 8], ['repeater', 8], ['snowpea', 6], ['torchwood', 5], ['tallnut', 5], ['squash', 6], ['tanglekelp', 5], ['cherrybomb', 4], ['jalapeno', 4], ['threepeater', 5]] },
  { id: 'mg-invisible', env: NIGHT, waves: 15, graves: 4, zombies: ['normal', 'cone', 'bucket', 'newspaper', 'pole', 'screendoor'], ramp: 0.45, title: '隐形食脑者', desc: '僵尸全部隐形了！只有被击中时才会显形。', invisible: true },
  { id: 'mg-rain', env: DAY, mode: 'conveyor', waves: 20, zombies: ['normal', 'cone', 'bucket', 'pole', 'newspaper', 'football', 'dancer'], ramp: 0.6, title: '种子雨', desc: '植物种子从天而降，抢在它们消失前捡起来！', rain: true,
    conveyor: [['peashooter', 10], ['repeater', 10], ['snowpea', 8], ['wallnut', 8], ['cherrybomb', 4], ['squash', 6], ['chomper', 6], ['potatomine', 6], ['threepeater', 5], ['torchwood', 4], ['jalapeno', 3]] },
];

export const SURVIVAL = [
  { id: 'sv-day', env: DAY, mode: 'survival', title: '生存模式：白天', desc: '无尽的僵尸潮，你能坚持多少旗？', zombies: ['normal', 'cone', 'pole', 'bucket', 'newspaper', 'screendoor', 'football', 'dancer'], ramp: 0.5, waves: 9999 },
  { id: 'sv-night', env: NIGHT, mode: 'survival', graves: 5, title: '生存模式：黑夜', desc: '没有阳光从天而降的漫漫长夜。', zombies: ['normal', 'cone', 'pole', 'bucket', 'newspaper', 'screendoor', 'football', 'dancer'], ramp: 0.5, waves: 9999 },
  { id: 'sv-fog', env: FOG, sun: 150, mode: 'survival', fog: 4, title: '生存模式：浓雾', desc: '雾中的无尽僵尸潮，睁大眼睛！', zombies: ['normal', 'cone', 'bucket', 'balloon', 'digger', 'pogo', 'jackbox', 'snorkel', 'dolphin', 'football'], ramp: 0.5, waves: 9999 },
  { id: 'sv-pool', env: POOL, mode: 'survival', title: '生存模式：泳池', desc: '水陆两栖的无尽挑战。', zombies: ['normal', 'cone', 'pole', 'bucket', 'newspaper', 'screendoor', 'football', 'snorkel', 'dolphin', 'zomboni', 'gargantuar'], ramp: 0.55, waves: 9999 },
];

export function levelIndex(id) { return ADVENTURE.findIndex(l => l.id === id); }
export function findLevel(id) {
  return ADVENTURE.find(l => l.id === id) || MINIGAMES.find(l => l.id === id) || SURVIVAL.find(l => l.id === id);
}

// 每关的卡槽数
export function slotsFor(level) {
  if (level.slots) return level.slots;
  if (level.mode === 'survival') return 10;
  if (level.env === 'fog') return 9;
  if (level.env === 'pool') return 8;
  if (level.env === 'night') return 7;
  return 6;
}
