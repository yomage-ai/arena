// 输入：统一鼠标 / 触摸（Pointer Events）与键盘，事件直接派发给场景导演。
import { display } from './display.js';

export const input = {
  x: -100,
  y: -100,
  down: false,
  isTouch: false,
  handler: null,

  init(handler) {
    this.handler = handler;
    const c = display.canvas;
    const pos = e => {
      const p = display.toLogical(e.clientX, e.clientY);
      this.x = p.x; this.y = p.y;
      return p;
    };
    c.addEventListener('pointerdown', e => {
      this.isTouch = e.pointerType === 'touch';
      const p = pos(e);
      this.down = true;
      try { c.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      c.focus({ preventScroll: true });
      this.handler.pointerDown(p.x, p.y, e.button);
      e.preventDefault();
    });
    c.addEventListener('pointermove', e => {
      this.isTouch = e.pointerType === 'touch';
      const p = pos(e);
      this.handler.pointerMove(p.x, p.y);
    });
    const up = e => {
      if (!this.down) return;
      const p = pos(e);
      this.down = false;
      this.handler.pointerUp(p.x, p.y, e.button);
    };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
    c.addEventListener('pointerleave', () => { if (!this.down && !this.isTouch) { this.x = -100; this.y = -100; } });
    c.addEventListener('contextmenu', e => e.preventDefault());
    c.addEventListener('wheel', e => { this.handler.wheel?.(e.deltaY); e.preventDefault(); }, { passive: false });
    window.addEventListener('keydown', e => {
      if (e.repeat) return;
      if (this.handler.key(e.key, e) !== false && [' ', 'Escape', 'Tab'].includes(e.key)) e.preventDefault();
    });
  },
};
