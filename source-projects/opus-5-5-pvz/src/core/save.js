// 存档：进度、解锁植物、图鉴、设置，存储在 localStorage（读写全部容错）。
const KEY = 'pvz-html5-save-v1';

const defaults = () => ({
  version: 1,
  adventure: 0, // 下一个要玩的冒险关卡序号
  completed: {}, // 关卡 id -> true
  plants: ['peashooter'],
  seenZombies: ['normal'],
  minigames: {}, // id -> {won:true, best}
  survival: {}, // id -> 最佳旗数
  settings: {
    music: 0.55,
    sfx: 0.8,
    autoCollect: false,
    healthBars: false,
    speed: 1,
  },
  stats: { zombiesKilled: 0, plantsPlanted: 0, sunCollected: 0 },
});

export const save = {
  data: defaults(),

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw);
        const def = defaults();
        this.data = Object.assign(def, d);
        this.data.settings = Object.assign(def.settings, d.settings || {});
        this.data.stats = Object.assign(def.stats, d.stats || {});
        if (!this.data.plants.includes('peashooter')) this.data.plants.unshift('peashooter');
      }
    } catch (_) {
      this.data = defaults();
    }
    return this.data;
  },

  write() {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (_) { /* 隐私模式下忽略 */ }
  },

  reset() {
    const settings = this.data.settings;
    this.data = defaults();
    this.data.settings = settings;
    this.write();
  },

  unlockAll(levelCount, allPlants) {
    this.data.adventure = levelCount;
    this.data.plants = [...allPlants];
    this.write();
  },

  hasPlant(id) { return this.data.plants.includes(id); },
  unlockPlant(id) {
    if (!this.data.plants.includes(id)) { this.data.plants.push(id); this.write(); return true; }
    return false;
  },
  seeZombie(id) {
    if (!this.data.seenZombies.includes(id)) { this.data.seenZombies.push(id); this.write(); }
  },
  get settings() { return this.data.settings; },
};
