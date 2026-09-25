// 入口：初始化显示、存档、输入与主循环，注册场景后进入标题画面。
import { display } from './core/display.js';
import { input } from './core/input.js';
import { save } from './core/save.js';
import { loop } from './core/loop.js';
import { audio } from './core/audio.js';
import { director } from './scenes/director.js';
import { TitleScene } from './scenes/title.js';
import { MenuScene, registerMenuScenes } from './scenes/menu.js';
import { GameScene, registerScenes } from './scenes/gameScene.js';
import { LevelSelectScene, registerLevelScenes } from './scenes/levelSelect.js';
import { MinigameScene, registerMinigameScenes } from './scenes/minigames.js';
import { AlmanacScene, registerAlmanacScenes } from './scenes/almanac.js';
import { AwardScene, registerAwardScenes } from './scenes/award.js';
import { GalleryScene } from './scenes/gallery.js';
import { installDebug } from './debug.js';
import { runBot } from './bot.js';
import { findLevel, ADVENTURE } from './game/levels.js';
import { PLANT_ORDER } from './game/defs.js';

const Scenes = { MenuScene, GameScene, LevelSelectScene, MinigameScene, AlmanacScene, AwardScene, TitleScene };
registerScenes(Scenes);
registerMenuScenes(Scenes);
registerLevelScenes(Scenes);
registerMinigameScenes(Scenes);
registerAlmanacScenes(Scenes);
registerAwardScenes(Scenes);

display.init();
save.load();
input.init(director);

if (location.hash === '#gallery') director.go(new GalleryScene(), { fade: false });
else director.go(new TitleScene(() => new MenuScene()), { fade: false });

// 切到后台时自动暂停
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    const s = director.scene;
    if (s && s.pause && s.phase === 'play') s.pause();
    if (audio.ctx && audio.ctx.state === 'running') audio.ctx.suspend();
  } else if (audio.ctx && audio.ctx.state === 'suspended') audio.ctx.resume();
});

// 调试接口仅在本地开发服务器或 URL 带 ?debug 时启用
if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) || location.search.includes('debug')) installDebug({
  // 调试：直接进入某关，如 PVZ.play('2-6')
  play(id, source = 'adventure') {
    const L = findLevel(id);
    if (L) director.go(new GameScene(L, { source }), { fade: false });
    return !!L;
  },
  unlockAll() { save.unlockAll(ADVENTURE.length, PLANT_ORDER); },
  get game() { return director.scene?.board ? director.scene : null; },
  sun(n = 1000) { const g = director.scene; if (g?.board) g.board.sun += n; },
  spawn(type, row = 2, x) { const g = director.scene; return g?.board?.spawnZombie(type, row, x); },
  plant(type, col, row) { const g = director.scene; return g?.board?.placePlant(type, col, row); },
  // 机器人自动游玩，检验难度：await PVZ.bot('1-4')
  bot(id, maxSeconds) { return runBot(director, GameScene, findLevel(id), maxSeconds); },
});

loop.start(dt => director.update(dt), () => director.draw());
