// 开发调试工具（仅开发环境挂载到 window.PVZ）：高清截图、跳关、加阳光等。
import { display } from './core/display.js';
import { director } from './scenes/director.js';

export function installDebug(extra = {}) {
  window.PVZ = {
    director,
    display,
    // 以指定倍率离屏渲染当前画面并上传到开发服务器，返回保存路径
    async snap(name = 'shot', scale = 2, region = null) {
      const saved = { canvas: display.canvas, ctx: display.ctx, k: display.k };
      const c = document.createElement('canvas');
      c.width = 1280 * scale; c.height = 720 * scale;
      display.canvas = c; display.ctx = c.getContext('2d'); display.k = scale;
      try { director.draw(); } finally { Object.assign(display, saved); }
      let out = c;
      if (region) {
        const [x, y, w, h] = region;
        out = document.createElement('canvas');
        out.width = w * scale; out.height = h * scale;
        out.getContext('2d').drawImage(c, x * scale, y * scale, w * scale, h * scale, 0, 0, w * scale, h * scale);
      }
      const r = await fetch('/__shot?name=' + name, { method: 'POST', body: out.toDataURL('image/png') });
      return r.text();
    },
    // 手动推进模拟（页面在后台、rAF 暂停时用于自动化测试）
    step(seconds = 1) {
      const n = Math.round(seconds * 60);
      for (let i = 0; i < n; i++) director.update(1 / 60);
      return director.scene?.phase;
    },
    ...extra,
  };
}
