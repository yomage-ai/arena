// 画布 UI 组件：按钮、滑块、开关，统一处理悬停 / 按下 / 点击与绘制。
import { audio } from '../core/audio.js';
import { display } from '../core/display.js';
import { drawButton } from '../gfx/uiArt.js';
import { rr, fs, lg, rg, C, text } from '../gfx/paint.js';
import { clamp } from '../core/util.js';

export class Button {
  constructor(o) {
    Object.assign(this, { style: 'green', disabled: false, visible: true, hover: false, pressed: false }, o);
  }
  hit(x, y) { return this.visible && x >= this.x && x <= this.x + this.w && y >= this.y && y <= this.y + this.h; }
  draw(ctx) { if (this.visible) drawButton(ctx, this); }
}

export class Slider {
  constructor(o) { Object.assign(this, { value: 0.5, visible: true }, o); }
  hit(x, y) { return this.visible && x >= this.x - 10 && x <= this.x + this.w + 10 && y >= this.y - 16 && y <= this.y + 16; }
  setFrom(x) { this.value = clamp((x - this.x) / this.w, 0, 1); this.onChange?.(this.value); }
  draw(ctx) {
    if (!this.visible) return;
    const { x, y, w } = this;
    text(ctx, this.label, x - 16, y, { size: 20, color: '#f4f0d8', stroke: '#1a1a14', align: 'right', lw: 4 });
    rr(ctx, x, y - 6, w, 12, 6);
    fs(ctx, 'rgba(0,0,0,0.45)', 'rgba(255,255,255,0.2)', 1.5);
    rr(ctx, x, y - 6, w * this.value, 12, 6);
    fs(ctx, lg(ctx, 0, y - 6, 0, y + 6, [0, '#b8f070', 1, '#4f9a22']));
    C(ctx, x + w * this.value, y, 13);
    fs(ctx, rg(ctx, x + w * this.value - 4, y - 4, 1, x + w * this.value, y, 14, [0, '#fff', 1, '#c8c8b8']), '#3a3a30', 2);
  }
}

export class Toggle {
  constructor(o) { Object.assign(this, { value: false, visible: true }, o); }
  hit(x, y) { return this.visible && x >= this.x - 10 && x <= this.x + 60 && y >= this.y - 18 && y <= this.y + 18; }
  draw(ctx) {
    if (!this.visible) return;
    const { x, y } = this;
    text(ctx, this.label, x - 16, y, { size: 20, color: '#f4f0d8', stroke: '#1a1a14', align: 'right', lw: 4 });
    rr(ctx, x, y - 14, 54, 28, 14);
    fs(ctx, this.value ? lg(ctx, 0, y - 14, 0, y + 14, [0, '#9ee05a', 1, '#4f9a22']) : 'rgba(0,0,0,0.45)', 'rgba(255,255,255,0.3)', 1.5);
    C(ctx, x + (this.value ? 40 : 14), y, 11);
    fs(ctx, '#f8f6ec', '#3a3a30', 1.5);
  }
}

// 统一管理一组控件的输入
export class UIGroup {
  constructor() { this.items = []; this.drag = null; }
  add(it) { this.items.push(it); return it; }
  clear() { this.items = []; }
  move(x, y) {
    let any = false;
    for (const it of this.items) {
      if (it instanceof Button) {
        const h = it.hit(x, y) && !it.disabled;
        if (h && !it.hover) audio.play('hover');
        it.hover = h;
        if (h) any = true;
      }
    }
    if (this.drag) this.drag.setFrom(x);
    if (any || this.drag) display.setCursor('pointer');
    return any;
  }
  down(x, y) {
    for (const it of this.items) {
      if (!it.visible) continue;
      if (it instanceof Button && it.hit(x, y) && !it.disabled) { it.pressed = true; return true; }
      if (it instanceof Slider && it.hit(x, y)) { this.drag = it; it.setFrom(x); return true; }
      if (it instanceof Toggle && it.hit(x, y)) { it.value = !it.value; audio.play('tap'); it.onChange?.(it.value); return true; }
    }
    return false;
  }
  up(x, y) {
    if (this.drag) { this.drag = null; audio.play('tap'); return true; }
    let handled = false;
    for (const it of this.items) {
      if (it instanceof Button && it.pressed) {
        it.pressed = false;
        if (it.hit(x, y) && !it.disabled) { audio.play('button'); it.onClick?.(); handled = true; }
      }
    }
    return handled;
  }
  draw(ctx) { for (const it of this.items) it.draw(ctx); }
}
