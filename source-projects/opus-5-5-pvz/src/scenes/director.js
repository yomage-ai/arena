// 场景导演：管理当前场景、淡入淡出转场，并把输入事件分发给场景。
import { W, H, display } from '../core/display.js';
import { audio } from '../core/audio.js';
import { music } from '../core/music.js';

class Director {
  constructor() {
    this.scene = null;
    this.next = null;
    this.fade = 0; // 0 = 完全可见, 1 = 全黑
    this.fadeDir = 0;
    this.fadeSpeed = 3;
    this.fadeColor = '#000';
    this.time = 0;
  }

  go(scene, o = {}) {
    if (o.fade === false || !this.scene) {
      this.swap(scene);
      return;
    }
    this.next = scene;
    this.fadeDir = 1;
    this.fadeSpeed = o.speed || 3;
    this.fadeColor = o.color || '#000';
  }

  swap(scene) {
    this.scene?.exit?.();
    this.scene = scene;
    scene.enter?.();
    display.setCursor('default');
  }

  update(dt) {
    this.time += dt;
    if (this.fadeDir !== 0) {
      this.fade += this.fadeDir * this.fadeSpeed * dt;
      if (this.fadeDir > 0 && this.fade >= 1) {
        this.fade = 1;
        if (this.next) { this.swap(this.next); this.next = null; }
        this.fadeDir = -1;
      } else if (this.fadeDir < 0 && this.fade <= 0) {
        this.fade = 0;
        this.fadeDir = 0;
      }
    }
    this.scene?.update?.(dt);
  }

  draw() {
    const ctx = display.ctx;
    display.begin();
    this.scene?.draw?.(ctx);
    if (this.fade > 0) {
      display.begin();
      ctx.globalAlpha = Math.min(1, this.fade);
      ctx.fillStyle = this.fadeColor;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
  }

  get busy() { return this.fadeDir !== 0; }

  unlockAudio() {
    const first = !audio.ready;
    audio.init();
    if (first) music.resumePending();
  }

  pointerDown(x, y, b) {
    this.unlockAudio();
    if (this.fadeDir > 0) return;
    this.scene?.pointerDown?.(x, y, b);
  }
  pointerMove(x, y) { this.scene?.pointerMove?.(x, y); }
  pointerUp(x, y, b) { if (this.fadeDir > 0) return; this.scene?.pointerUp?.(x, y, b); }
  wheel(d) { this.scene?.wheel?.(d); }
  key(k, e) {
    this.unlockAudio();
    if (k === 'f' || k === 'F') {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
      else document.exitFullscreen?.();
      return;
    }
    return this.scene?.key?.(k, e);
  }
}

export const director = new Director();
