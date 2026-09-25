// 画布与自适应缩放：逻辑分辨率固定 1280x720，按窗口等比缩放并适配高 DPI。
export const W = 1280;
export const H = 720;

export const display = {
  canvas: null,
  ctx: null,
  k: 1, // 逻辑像素 -> 物理像素 的比例
  resizeListeners: [],

  init() {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d', { alpha: false });
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 200));
    this.resize();
  },

  resize() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const s = Math.min(vw / W, vh / H);
    const cssW = Math.max(1, Math.floor(W * s));
    const cssH = Math.max(1, Math.floor(H * s));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const c = this.canvas;
    c.style.width = cssW + 'px';
    c.style.height = cssH + 'px';
    c.style.left = Math.floor((vw - cssW) / 2) + 'px';
    c.style.top = Math.floor((vh - cssH) / 2) + 'px';
    c.width = Math.round(cssW * dpr);
    c.height = Math.round(cssH * dpr);
    this.k = c.width / W;
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';
    for (const fn of this.resizeListeners) fn(this.k);
  },

  onResize(fn) { this.resizeListeners.push(fn); },

  // 渲染缓存使用的分辨率倍率（避免每次缩放都重建，取 0.5 的整数倍）
  get cacheScale() {
    return Math.max(1, Math.min(2, Math.ceil(this.k * 2) / 2));
  },

  begin() {
    this.ctx.setTransform(this.k, 0, 0, this.k, 0, 0);
    this.ctx.globalAlpha = 1;
    this.ctx.globalCompositeOperation = 'source-over';
  },

  toLogical(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    return { x: ((clientX - r.left) / r.width) * W, y: ((clientY - r.top) / r.height) * H };
  },

  setCursor(c) {
    if (this.canvas.style.cursor !== c) this.canvas.style.cursor = c;
  },

  makeCanvas(w, h, scale = 1) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w * scale));
    c.height = Math.max(1, Math.ceil(h * scale));
    const ctx = c.getContext('2d');
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    return { canvas: c, ctx, w, h, scale };
  },
};
