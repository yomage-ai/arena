// 草坪几何布局（世界坐标）。游戏中相机 x=0 时世界坐标 = 屏幕坐标。
export const LAWN_X = 250; // 第 0 列左边界
export const COL_W = 100;
export const COLS = 9;
export const LAWN_TOP = 140;
export const LAWN_RIGHT = LAWN_X + COLS * COL_W; // 1150
export const WORLD_MIN_X = -240;
export const WORLD_MAX_X = 1760;
export const WORLD_W = WORLD_MAX_X - WORLD_MIN_X;
export const SPAWN_X = 1290; // 僵尸出生点（屏幕外右侧）

export const ENV = {
  day: { rows: 5, rowH: 112, water: [], night: false, name: '白天' },
  night: { rows: 5, rowH: 112, water: [], night: true, name: '黑夜' },
  pool: { rows: 6, rowH: 94, water: [2, 3], night: false, name: '泳池' },
  fog: { rows: 6, rowH: 94, water: [2, 3], night: true, fog: true, name: '浓雾' },
};

export const POOL_X0 = LAWN_X - 6;
export const POOL_X1 = LAWN_RIGHT + 44;

export function envInfo(env) {
  return ENV[env] || ENV.day;
}

export function rowTop(env, r) { return LAWN_TOP + r * envInfo(env).rowH; }
export function rowY(env, r) { const e = envInfo(env); return LAWN_TOP + r * e.rowH + e.rowH * 0.8; }
export function colX(c) { return LAWN_X + c * COL_W + COL_W / 2; }
export function colOf(x) { return Math.floor((x - LAWN_X) / COL_W); }
