// 场景背景：预渲染到离屏画布（房屋、门廊、草坪、栅栏、树篱、人行道、马路、泳池、夜景）。
import { mulberry32, TAU, shade, mixColor } from '../core/util.js';
import { display } from '../core/display.js';
import { E, C, fs, rg, lg, rr, blob } from './paint.js';
import { LAWN_X, COL_W, COLS, LAWN_TOP, LAWN_RIGHT, WORLD_MIN_X, WORLD_W, envInfo, POOL_X0, POOL_X1 } from '../game/layout.js';

const PAL = {
  day: {
    sky: ['#8fd0ff', '#d6f0ff'], tree: ['#2f6a24', '#4f9a34', '#7cc04a'], fence: ['#e2bf88', '#b98a52', '#6e4a22'],
    hedge: ['#3e8a2a', '#5aa83a', '#244f16'], grass: ['#62b236', '#72c342'], grassDark: '#3f8a22', grassLight: '#a4e06a',
    wall: ['#efe3c6', '#d2c29e'], wallLine: '#b8a47c', roof: ['#6a4f5a', '#4a3440'], trim: '#fbf8ef', deck: ['#c89664', '#9a6c40'],
    walk: ['#d0ccc0', '#b4b0a4'], road: ['#55555c', '#46464c'], line: '#f2d24a', dirt: ['#8c6238', '#6e4a28'],
    window: ['#bfe6ff', '#6aa8d8'], door: ['#8a4a2a', '#5e2e16'], ambient: null,
  },
  night: {
    sky: ['#0a1330', '#223466'], tree: ['#0c1a1c', '#16302c', '#23463a'], fence: ['#6a6488', '#4a4668', '#232036'],
    hedge: ['#1a3a34', '#28504a', '#0c201c'], grass: ['#2f5e4a', '#376c55'], grassDark: '#1e4032', grassLight: '#5a9a7a',
    wall: ['#707090', '#565674'], wallLine: '#484866', roof: ['#2a2238', '#1a1426'], trim: '#a8a8c8', deck: ['#5a4a5a', '#3e3040'],
    walk: ['#6a6a7c', '#56566a'], road: ['#2a2a34', '#222228'], line: '#a89a4a', dirt: ['#4a3a38', '#382a28'],
    window: ['#ffe08a', '#f0a030'], door: ['#4a2a2a', '#2e1818'], ambient: 'rgba(20,30,80,0.18)',
  },
};

const nightEnv = env => env === 'night' || env === 'fog';
function grassPalette(env) { return nightEnv(env) ? PAL.night : PAL.day; }

// 在 ctx 上绘制整个世界背景（世界坐标，偏移 WORLD_MIN_X）
function paintWorld(ctx, env, rand, o = {}) {
  const P = grassPalette(env);
  const info = envInfo(env);
  const H = 720;
  ctx.save();
  ctx.translate(-WORLD_MIN_X, 0);

  // ---- 天空 ----
  ctx.fillStyle = lg(ctx, 0, 0, 0, 120, [0, P.sky[0], 1, P.sky[1]]);
  ctx.fillRect(WORLD_MIN_X, 0, WORLD_W, 140);
  if (nightEnv(env)) {
    for (let i = 0; i < 140; i++) {
      const x = WORLD_MIN_X + rand() * WORLD_W, y = rand() * 90, r = rand() * 1.4 + 0.3;
      ctx.globalAlpha = 0.4 + rand() * 0.6;
      C(ctx, x, y, r);
      ctx.fillStyle = '#fff';
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // 月亮
    const mx = 1480, my = 44;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    C(ctx, mx, my, 90);
    ctx.fillStyle = rg(ctx, mx, my, 10, mx, my, 90, [0, 'rgba(200,210,255,0.35)', 1, 'rgba(120,140,255,0)']);
    ctx.fill();
    ctx.restore();
    C(ctx, mx, my, 28);
    fs(ctx, rg(ctx, mx - 8, my - 8, 3, mx, my, 30, [0, '#fffef0', 1, '#d8dcc8']));
    ctx.globalAlpha = 0.18;
    for (const [dx, dy, r] of [[-8, -4, 6], [9, 6, 5], [4, -12, 3.5], [-6, 12, 4]]) { C(ctx, mx + dx, my + dy, r); ctx.fillStyle = '#8a8c80'; ctx.fill(); }
    ctx.globalAlpha = 1;
  } else {
    for (let i = 0; i < 6; i++) {
      const x = WORLD_MIN_X + 200 + i * 340 + rand() * 100, y = 18 + rand() * 20;
      ctx.globalAlpha = 0.85;
      for (let k = 0; k < 5; k++) { C(ctx, x + k * 22 - 44, y + Math.sin(k * 1.7) * 6, 18 + (k % 2) * 6); ctx.fillStyle = '#ffffff'; ctx.fill(); }
      ctx.globalAlpha = 1;
    }
  }

  // ---- 远景树冠 ----
  for (let layer = 0; layer < 2; layer++) {
    for (let x = WORLD_MIN_X + 150; x < WORLD_MIN_X + WORLD_W + 60; x += 46 + rand() * 30) {
      const y = 62 + layer * 18 + rand() * 18;
      const r = 34 + rand() * 26 - layer * 6;
      C(ctx, x, y, r);
      ctx.fillStyle = rg(ctx, x - r * 0.3, y - r * 0.4, 2, x, y, r, [0, layer ? P.tree[2] : P.tree[1], 1, P.tree[0]]);
      ctx.fill();
    }
  }

  // ---- 栅栏 ----
  const fenceY0 = 66, fenceY1 = 132;
  ctx.fillStyle = shade(P.fence[1], -0.15);
  ctx.fillRect(LAWN_X - 10, fenceY0 + 16, LAWN_RIGHT - LAWN_X + 30, 10);
  ctx.fillRect(LAWN_X - 10, fenceY0 + 46, LAWN_RIGHT - LAWN_X + 30, 10);
  for (let x = LAWN_X - 6; x < LAWN_RIGHT + 16; x += 30) {
    const h = fenceY1 - fenceY0 + (rand() * 4 - 2);
    ctx.beginPath();
    ctx.moveTo(x, fenceY1);
    ctx.lineTo(x, fenceY1 - h + 10);
    ctx.lineTo(x + 13, fenceY1 - h);
    ctx.lineTo(x + 26, fenceY1 - h + 10);
    ctx.lineTo(x + 26, fenceY1);
    ctx.closePath();
    fs(ctx, lg(ctx, x, 0, x + 26, 0, [0, P.fence[0], 1, P.fence[1]]), P.fence[2], 1.5);
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = P.fence[2];
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 8 + rand() * 10, fenceY1 - h + 16);
    ctx.lineTo(x + 8 + rand() * 10, fenceY1 - 6);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // ---- 树篱（栅栏下方） ----
  for (let x = LAWN_X - 20; x < LAWN_RIGHT + 30; x += 22 + rand() * 12) {
    const y = 132 + rand() * 6, r = 14 + rand() * 9;
    C(ctx, x, y, r);
    ctx.fillStyle = rg(ctx, x - 5, y - 6, 2, x, y, r, [0, P.hedge[1], 1, P.hedge[0]]);
    ctx.fill();
  }

  // ---- 右侧：人行道 + 马路 ----
  const walkX0 = LAWN_RIGHT + 16, walkX1 = LAWN_RIGHT + 150, curbX = walkX1, roadX = walkX1 + 14;
  ctx.fillStyle = lg(ctx, walkX0, 0, walkX1, 0, [0, P.walk[0], 1, P.walk[1]]);
  ctx.fillRect(walkX0, 0, walkX1 - walkX0, H);
  ctx.strokeStyle = shade(P.walk[1], -0.2);
  ctx.lineWidth = 1.5;
  for (let y = 10; y < H; y += 86) { ctx.beginPath(); ctx.moveTo(walkX0, y); ctx.lineTo(walkX1, y); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo((walkX0 + walkX1) / 2, 0); ctx.lineTo((walkX0 + walkX1) / 2, H); ctx.stroke();
  for (let i = 0; i < 500; i++) {
    ctx.fillStyle = rand() > 0.5 ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.1)';
    ctx.fillRect(walkX0 + rand() * (walkX1 - walkX0), rand() * H, 2, 2);
  }
  ctx.fillStyle = lg(ctx, curbX, 0, curbX + 14, 0, [0, shade(P.walk[0], 0.2), 1, shade(P.walk[1], -0.1)]);
  ctx.fillRect(curbX, 0, 14, H);
  ctx.fillStyle = lg(ctx, roadX, 0, roadX + 400, 0, [0, P.road[0], 1, P.road[1]]);
  ctx.fillRect(roadX, 0, WORLD_MIN_X + WORLD_W - roadX, H);
  for (let i = 0; i < 2500; i++) {
    ctx.fillStyle = rand() > 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.06)';
    ctx.fillRect(roadX + rand() * 460, rand() * H, 2, 2);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(roadX, 0, 8, H);
  ctx.fillStyle = P.line;
  for (let y = -20; y < H; y += 100) ctx.fillRect(roadX + 300, y, 10, 56);
  // 路面裂缝
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 6; i++) {
    let x = roadX + 30 + rand() * 380, y = rand() * H;
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let k = 0; k < 5; k++) { x += rand() * 16 - 8; y += 6 + rand() * 10; ctx.lineTo(x, y); }
    ctx.stroke();
  }

  // 草坪与人行道之间的土边
  ctx.fillStyle = lg(ctx, LAWN_RIGHT, 0, LAWN_RIGHT + 16, 0, [0, shade(P.dirt[1], -0.1), 1, shade(P.walk[1], -0.25)]);
  ctx.fillRect(LAWN_RIGHT, LAWN_TOP - 10, 16, H - LAWN_TOP + 10);

  // ---- 草坪 ----
  paintLawn(ctx, env, rand, o.dirt);

  // ---- 泳池 ----
  if (info.water.length) paintPool(ctx, env, rand);

  // ---- 草坪底部边界 ----
  const lawnBottom = LAWN_TOP + info.rows * info.rowH;
  ctx.fillStyle = lg(ctx, 0, lawnBottom, 0, H, [0, shade(P.dirt[1], -0.1), 1, shade(P.dirt[1], -0.35)]);
  ctx.fillRect(LAWN_X - 12, lawnBottom, LAWN_RIGHT - LAWN_X + 28, H - lawnBottom);
  for (let x = LAWN_X; x < LAWN_RIGHT; x += 16 + rand() * 20) {
    const y = lawnBottom + 6 + rand() * 8;
    ctx.fillStyle = [P.hedge[1], P.hedge[0]][(rand() * 2) | 0];
    C(ctx, x, y, 6 + rand() * 5);
    ctx.fill();
    if (rand() > 0.6) {
      C(ctx, x + 3, y - 2, 2.6);
      ctx.fillStyle = ['#ff8ab0', '#fff27a', '#ffffff', '#b58aff'][(rand() * 4) | 0];
      ctx.fill();
    }
  }
  // 草坪左右边沿石
  ctx.fillStyle = lg(ctx, LAWN_X - 12, 0, LAWN_X, 0, [0, shade(P.walk[1], -0.1), 1, shade(P.walk[1], -0.3)]);
  ctx.fillRect(LAWN_X - 12, LAWN_TOP - 4, 12, lawnBottom - LAWN_TOP + 4);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(LAWN_X, LAWN_TOP, 6, lawnBottom - LAWN_TOP);
  // 右侧小灌木
  for (const y of [LAWN_TOP + 8, lawnBottom - 6]) {
    for (let k = 0; k < 4; k++) {
      C(ctx, LAWN_RIGHT + 4 + rand() * 12, y + (rand() - 0.5) * 20, 12 + rand() * 6);
      ctx.fillStyle = rg(ctx, LAWN_RIGHT, y - 6, 2, LAWN_RIGHT + 8, y, 20, [0, P.hedge[1], 1, P.hedge[0]]);
      ctx.fill();
    }
  }

  // ---- 房屋 ----
  paintHouse(ctx, env, rand, lawnBottom);

  if (P.ambient) {
    ctx.fillStyle = P.ambient;
    ctx.fillRect(WORLD_MIN_X, 0, WORLD_W, H);
  }
  ctx.restore();
}

function paintLawn(ctx, env, rand, dirtOnly) {
  const P = grassPalette(env);
  const info = envInfo(env);
  for (let r = 0; r < info.rows; r++) {
    if (info.water.includes(r)) continue;
    const y0 = LAWN_TOP + r * info.rowH;
    for (let c = 0; c < COLS; c++) {
      const x0 = LAWN_X + c * COL_W;
      if (dirtOnly) {
        ctx.fillStyle = (r + c) % 2 ? P.dirt[0] : shade(P.dirt[0], -0.06);
        ctx.fillRect(x0, y0, COL_W, info.rowH);
        for (let i = 0; i < 60; i++) {
          ctx.fillStyle = rand() > 0.5 ? 'rgba(40,20,5,0.25)' : 'rgba(255,220,170,0.12)';
          const s = 1 + rand() * 3;
          ctx.fillRect(x0 + rand() * COL_W, y0 + rand() * info.rowH, s, s);
        }
        continue;
      }
      const base = (r + c) % 2 ? P.grass[0] : P.grass[1];
      ctx.fillStyle = lg(ctx, x0, y0, x0, y0 + info.rowH, [0, shade(base, 0.04), 1, shade(base, -0.05)]);
      ctx.fillRect(x0, y0, COL_W, info.rowH);
      // 草叶
      for (let i = 0; i < 130; i++) {
        const x = x0 + rand() * COL_W, y = y0 + rand() * info.rowH;
        const h = 3 + rand() * 5;
        ctx.strokeStyle = rand() > 0.55 ? `rgba(20,60,10,${0.12 + rand() * 0.15})` : `rgba(210,255,160,${0.08 + rand() * 0.12})`;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (rand() - 0.5) * 3, y - h);
        ctx.stroke();
      }
      // 小花/三叶草
      if (rand() > 0.7) {
        const x = x0 + 12 + rand() * (COL_W - 24), y = y0 + 12 + rand() * (info.rowH - 24);
        for (let k = 0; k < 3; k++) {
          C(ctx, x + Math.cos(k * 2.1) * 3, y + Math.sin(k * 2.1) * 3, 2.8);
          ctx.fillStyle = shade(base, -0.18);
          ctx.fill();
        }
      }
      if (!nightEnv(env) && rand() > 0.82) {
        const x = x0 + 10 + rand() * (COL_W - 20), y = y0 + 10 + rand() * (info.rowH - 20);
        for (let k = 0; k < 5; k++) { C(ctx, x + Math.cos(k * 1.256) * 2.6, y + Math.sin(k * 1.256) * 2.6, 1.8); ctx.fillStyle = '#ffffff'; ctx.fill(); }
        C(ctx, x, y, 1.4); ctx.fillStyle = '#ffd23a'; ctx.fill();
      }
    }
  }
  // 行间细微分界 + 光影
  if (!dirtOnly) {
    ctx.save();
    for (let r = 0; r < info.rows; r++) {
      if (info.water.includes(r)) continue;
      const y0 = LAWN_TOP + r * info.rowH;
      ctx.fillStyle = 'rgba(0,0,0,0.05)';
      ctx.fillRect(LAWN_X, y0 + info.rowH - 3, COLS * COL_W, 3);
    }
    ctx.restore();
  }
}

function paintPool(ctx, env, rand) {
  const info = envInfo(env);
  const y0 = LAWN_TOP + info.water[0] * info.rowH;
  const y1 = LAWN_TOP + (info.water[info.water.length - 1] + 1) * info.rowH;
  // 池边石
  rr(ctx, POOL_X0 - 14, y0 - 12, POOL_X1 - POOL_X0 + 28, y1 - y0 + 24, 18);
  fs(ctx, lg(ctx, 0, y0 - 12, 0, y1 + 12, nightEnv(env) ? [0, '#9a9aa8', 1, '#7a7a88'] : [0, '#f2eee4', 1, '#cfc8b8']), '#5a5a64', 2);
  for (let x = POOL_X0; x < POOL_X1; x += 40) {
    ctx.strokeStyle = 'rgba(120,110,90,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, y0 - 12); ctx.lineTo(x, y0); ctx.moveTo(x, y1); ctx.lineTo(x, y1 + 12); ctx.stroke();
  }
  // 水体
  rr(ctx, POOL_X0, y0, POOL_X1 - POOL_X0, y1 - y0, 10);
  const wc = nightEnv(env) ? ['#1e6a8a', '#175a7a', '#104a66'] : ['#3ab4e0', '#2a9ed0', '#1f84b8'];
  fs(ctx, lg(ctx, 0, y0, 0, y1, [0, wc[0], 0.5, wc[1], 1, wc[2]]), '#0e4a60', 2);
  ctx.save();
  rr(ctx, POOL_X0, y0, POOL_X1 - POOL_X0, y1 - y0, 10);
  ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1.5;
  for (let x = POOL_X0; x < POOL_X1; x += 32) { ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke(); }
  for (let y = y0; y < y1; y += 32) { ctx.beginPath(); ctx.moveTo(POOL_X0, y); ctx.lineTo(POOL_X1, y); ctx.stroke(); }
  // 泳道线
  ctx.strokeStyle = 'rgba(20,60,120,0.35)';
  ctx.lineWidth = 6;
  const mid = (y0 + y1) / 2;
  ctx.beginPath(); ctx.moveTo(POOL_X0 + 30, mid); ctx.lineTo(POOL_X1 - 30, mid); ctx.stroke();
  ctx.fillStyle = 'rgba(0,30,60,0.18)';
  ctx.fillRect(POOL_X0, y0, POOL_X1 - POOL_X0, 10);
  ctx.restore();
  // 右侧梯子
  ctx.lineCap = 'round';
  for (const x of [POOL_X1 - 26, POOL_X1 - 50]) {
    ctx.strokeStyle = '#6a7a84';
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(x, y0 + 30); ctx.lineTo(x, y0 - 4); ctx.quadraticCurveTo(x, y0 - 18, x + 12, y0 - 18); ctx.stroke();
    ctx.strokeStyle = '#e8eef2';
    ctx.lineWidth = 3;
    ctx.stroke();
  }
}

function paintHouse(ctx, env, rand, lawnBottom) {
  const P = nightEnv(env) ? PAL.night : PAL.day;
  const H = 720;
  const wx0 = WORLD_MIN_X, wx1 = 128;
  // 墙体
  ctx.fillStyle = lg(ctx, wx0, 0, wx1, 0, [0, P.wall[0], 0.8, P.wall[0], 1, P.wall[1]]);
  ctx.fillRect(wx0, 0, wx1 - wx0, H);
  ctx.strokeStyle = P.wallLine;
  ctx.lineWidth = 1.5;
  for (let y = 96; y < H; y += 15) {
    ctx.beginPath(); ctx.moveTo(wx0, y); ctx.lineTo(wx1, y); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  for (let y = 97; y < H; y += 15) ctx.fillRect(wx0, y, wx1 - wx0, 2);
  // 屋顶
  ctx.beginPath();
  ctx.moveTo(wx0, 0); ctx.lineTo(wx1 + 70, 0); ctx.lineTo(wx1 + 40, 86); ctx.lineTo(wx0, 86); ctx.closePath();
  fs(ctx, lg(ctx, 0, 0, 0, 86, [0, P.roof[0], 1, P.roof[1]]));
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1.2;
  for (let y = 10; y < 86; y += 12) {
    for (let x = wx0 + ((y / 12) % 2) * 12; x < wx1 + 60; x += 24) {
      ctx.beginPath(); ctx.arc(x, y, 12, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();
    }
  }
  ctx.fillStyle = P.trim;
  ctx.fillRect(wx0, 84, wx1 + 44 - wx0, 9);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(wx0, 93, wx1 + 44 - wx0, 8);
  // 窗户
  const win = (x, y, w, h) => {
    rr(ctx, x - 6, y - 6, w + 12, h + 12, 3);
    fs(ctx, P.trim, 'rgba(0,0,0,0.3)', 1.5);
    ctx.fillStyle = lg(ctx, x, y, x + w, y + h, [0, P.window[0], 1, P.window[1]]);
    ctx.fillRect(x, y, w, h);
    if (nightEnv(env)) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = rg(ctx, x + w / 2, y + h / 2, 5, x + w / 2, y + h / 2, w * 1.4, [0, 'rgba(255,200,90,0.35)', 1, 'rgba(255,160,40,0)']);
      ctx.fillRect(x - w, y - h, w * 3, h * 3);
      ctx.restore();
      ctx.fillStyle = 'rgba(140,40,40,0.55)';
      ctx.fillRect(x, y, w * 0.22, h);
      ctx.fillRect(x + w * 0.78, y, w * 0.22, h);
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.beginPath(); ctx.moveTo(x + 6, y + h - 6); ctx.lineTo(x + w * 0.4, y + 6); ctx.lineTo(x + w * 0.55, y + 6); ctx.lineTo(x + 18, y + h - 6); ctx.fill();
    }
    ctx.fillStyle = P.trim;
    ctx.fillRect(x + w / 2 - 2, y, 4, h);
    ctx.fillRect(x, y + h / 2 - 2, w, 4);
    ctx.fillStyle = shade(P.trim, -0.2);
    ctx.fillRect(x - 10, y + h + 6, w + 20, 7);
  };
  win(-170, 150, 90, 100);
  win(-170, 520, 90, 100);
  // 门
  const dx = -40, dy = 300, dw = 110, dh = 190;
  rr(ctx, dx - 10, dy - 10, dw + 20, dh + 10, 4);
  fs(ctx, P.trim, 'rgba(0,0,0,0.3)', 1.5);
  ctx.fillStyle = lg(ctx, dx, 0, dx + dw, 0, [0, P.door[0], 1, P.door[1]]);
  ctx.fillRect(dx, dy, dw, dh);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(dx + 12, dy + 14, dw - 24, 70);
  ctx.strokeRect(dx + 12, dy + 100, dw - 24, 76);
  C(ctx, dx + dw - 16, dy + 100, 5);
  fs(ctx, '#e8c860', '#6a5010', 1.2);
  // 门垫
  rr(ctx, dx + 5, dy + dh + 4, dw - 10, 16, 3);
  fs(ctx, '#a8503a', '#5a2a1a', 1.2);
  // 门廊地板
  const px0 = wx1, px1 = LAWN_X - 12;
  ctx.fillStyle = lg(ctx, px0, 0, px1, 0, [0, P.deck[1], 0.15, P.deck[0], 1, P.deck[0]]);
  ctx.fillRect(px0, 93, px1 - px0, H - 93);
  ctx.strokeStyle = 'rgba(0,0,0,0.28)';
  ctx.lineWidth = 1.5;
  for (let x = px0 + 20; x < px1; x += 20) { ctx.beginPath(); ctx.moveTo(x, 93); ctx.lineTo(x, H); ctx.stroke(); }
  for (let i = 0; i < 26; i++) {
    const x = px0 + 20 * Math.floor(rand() * 6), y = 100 + rand() * 600;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 20, y); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(px0, 93, px1 - px0, 18);
  // 门廊柱子
  for (const y of [120, lawnBottom - 10]) {
    ctx.fillStyle = lg(ctx, px0 + 4, 0, px0 + 26, 0, [0, P.trim, 1, shade(P.trim, -0.25)]);
    ctx.fillRect(px0 + 4, y - 30, 22, 40);
  }
}

// 缓存：按环境与分辨率
const cache = new Map();
export function getBackground(env, dirt = false) {
  const scale = display.cacheScale;
  const key = env + (dirt ? '-dirt' : '') + '@' + scale;
  let c = cache.get(key);
  if (c) {
    // LRU：移到末尾
    cache.delete(key);
    cache.set(key, c);
    return c;
  }
  const buf = display.makeCanvas(WORLD_W, 720, scale);
  const rand = mulberry32(env === 'night' ? 777 : env === 'pool' ? 555 : env === 'fog' ? 999 : 123);
  paintWorld(buf.ctx, env, rand, { dirt });
  cache.set(key, buf);
  // 清理其他分辨率缓存，并限制缓存数量（高分屏下每张背景可达数十 MB）
  for (const k of cache.keys()) if (!k.endsWith('@' + scale)) cache.delete(k);
  while (cache.size > 4) {
    const old = cache.keys().next().value;
    const cv = cache.get(old).canvas;
    cv.width = cv.height = 1;
    cache.delete(old);
  }
  return buf;
}

// 动态叠加：水面波光、夜雾
export function drawWaterOverlay(ctx, env, t) {
  const info = envInfo(env);
  if (!info.water.length) return;
  const y0 = LAWN_TOP + info.water[0] * info.rowH;
  const y1 = LAWN_TOP + (info.water[info.water.length - 1] + 1) * info.rowH;
  ctx.save();
  rr(ctx, POOL_X0, y0, POOL_X1 - POOL_X0, y1 - y0, 10);
  ctx.clip();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = 'rgba(200,245,255,0.22)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 14; i++) {
    const yy = y0 + 8 + (i / 14) * (y1 - y0 - 16);
    ctx.beginPath();
    for (let x = POOL_X0; x <= POOL_X1; x += 20) {
      const y = yy + Math.sin(x * 0.03 + t * 1.6 + i * 1.7) * 4 + Math.sin(x * 0.011 - t + i) * 3;
      if (x === POOL_X0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.globalAlpha = 0.35 + 0.3 * Math.sin(t * 0.7 + i);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (let i = 0; i < 30; i++) {
    const x = POOL_X0 + ((i * 97 + t * 14 * (i % 3 + 1)) % (POOL_X1 - POOL_X0));
    const y = y0 + ((i * 53) % (y1 - y0));
    const a = 0.5 + 0.5 * Math.sin(t * 3 + i);
    ctx.fillStyle = `rgba(255,255,255,${0.25 * a})`;
    E(ctx, x, y, 7, 1.6);
    ctx.fill();
  }
  ctx.restore();
}

export function drawNightOverlay(ctx, t) {
  ctx.save();
  // 夜雾在右侧飘动
  for (let i = 0; i < 7; i++) {
    const x = 900 + ((i * 180 + t * 12) % 900);
    const y = 180 + i * 80 + Math.sin(t * 0.3 + i) * 20;
    ctx.globalAlpha = 0.07;
    E(ctx, x, y, 160, 40);
    ctx.fillStyle = '#c8d4ff';
    ctx.fill();
  }
  ctx.restore();
}

// 白天：缓慢飘过草坪的云影
export function drawCloudShadows(ctx, t) {
  ctx.save();
  ctx.fillStyle = 'rgba(10,40,0,0.07)';
  for (let i = 0; i < 3; i++) {
    const x = ((t * (9 + i * 3) + i * 700) % 2200) - 500;
    const y = 220 + i * 170 + Math.sin(t * 0.05 + i) * 30;
    for (let k = 0; k < 4; k++) {
      E(ctx, x + k * 70, y + Math.sin(k * 2.1 + i) * 20, 110 - k * 10, 50 - k * 4);
      ctx.fill();
    }
  }
  ctx.restore();
}

// 夜晚：四周暗角
export function drawVignette(ctx, camX) {
  ctx.save();
  const g = ctx.createRadialGradient(camX + 700, 400, 260, camX + 700, 400, 860);
  g.addColorStop(0, 'rgba(0,0,20,0)');
  g.addColorStop(1, 'rgba(0,0,20,0.45)');
  ctx.fillStyle = g;
  ctx.fillRect(camX, 0, 1280, 720);
  ctx.restore();
}
