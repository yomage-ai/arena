// 主循环：固定步长 60Hz 逻辑更新 + 每帧渲染，防止螺旋卡死。
export const STEP = 1 / 60;

export const loop = {
  acc: 0,
  last: 0,
  running: false,
  fps: 60,
  frameCount: 0,
  fpsTimer: 0,

  start(update, render) {
    this.update = update;
    this.render = render;
    this.running = true;
    this.last = performance.now();
    const frame = now => {
      if (!this.running) return;
      let dt = (now - this.last) / 1000;
      this.last = now;
      if (dt > 0.25) dt = 0.25;
      this.acc += dt;
      let steps = 0;
      while (this.acc >= STEP && steps < 6) {
        this.update(STEP);
        this.acc -= STEP;
        steps++;
      }
      if (steps >= 6) this.acc = 0;
      this.render();
      this.frameCount++;
      this.fpsTimer += dt;
      if (this.fpsTimer >= 1) { this.fps = Math.round(this.frameCount / this.fpsTimer); this.frameCount = 0; this.fpsTimer = 0; }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  },
};
