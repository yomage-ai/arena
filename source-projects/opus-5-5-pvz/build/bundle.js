(() => {
  // src/core/display.js
  var W = 1280;
  var H = 720;
  var display = {
    canvas: null,
    ctx: null,
    k: 1,
    // 逻辑像素 -> 物理像素 的比例
    resizeListeners: [],
    init() {
      this.canvas = document.getElementById("game");
      this.ctx = this.canvas.getContext("2d", { alpha: false });
      window.addEventListener("resize", () => this.resize());
      window.addEventListener("orientationchange", () => setTimeout(() => this.resize(), 200));
      this.resize();
    },
    resize() {
      const vw = window.innerWidth, vh = window.innerHeight;
      const s = Math.min(vw / W, vh / H);
      const cssW = Math.max(1, Math.floor(W * s));
      const cssH = Math.max(1, Math.floor(H * s));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const c = this.canvas;
      c.style.width = cssW + "px";
      c.style.height = cssH + "px";
      c.style.left = Math.floor((vw - cssW) / 2) + "px";
      c.style.top = Math.floor((vh - cssH) / 2) + "px";
      c.width = Math.round(cssW * dpr);
      c.height = Math.round(cssH * dpr);
      this.k = c.width / W;
      this.ctx.imageSmoothingEnabled = true;
      this.ctx.imageSmoothingQuality = "high";
      for (const fn of this.resizeListeners) fn(this.k);
    },
    onResize(fn) {
      this.resizeListeners.push(fn);
    },
    // 渲染缓存使用的分辨率倍率（避免每次缩放都重建，取 0.5 的整数倍）
    get cacheScale() {
      return Math.max(1, Math.min(2, Math.ceil(this.k * 2) / 2));
    },
    begin() {
      this.ctx.setTransform(this.k, 0, 0, this.k, 0, 0);
      this.ctx.globalAlpha = 1;
      this.ctx.globalCompositeOperation = "source-over";
    },
    toLogical(clientX, clientY) {
      const r = this.canvas.getBoundingClientRect();
      return { x: (clientX - r.left) / r.width * W, y: (clientY - r.top) / r.height * H };
    },
    setCursor(c) {
      if (this.canvas.style.cursor !== c) this.canvas.style.cursor = c;
    },
    makeCanvas(w, h, scale = 1) {
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.ceil(w * scale));
      c.height = Math.max(1, Math.ceil(h * scale));
      const ctx = c.getContext("2d");
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      return { canvas: c, ctx, w, h, scale };
    }
  };

  // src/core/input.js
  var input = {
    x: -100,
    y: -100,
    down: false,
    isTouch: false,
    handler: null,
    init(handler) {
      this.handler = handler;
      const c = display.canvas;
      const pos = (e) => {
        const p = display.toLogical(e.clientX, e.clientY);
        this.x = p.x;
        this.y = p.y;
        return p;
      };
      c.addEventListener("pointerdown", (e) => {
        this.isTouch = e.pointerType === "touch";
        const p = pos(e);
        this.down = true;
        try {
          c.setPointerCapture(e.pointerId);
        } catch (_) {
        }
        c.focus({ preventScroll: true });
        this.handler.pointerDown(p.x, p.y, e.button);
        e.preventDefault();
      });
      c.addEventListener("pointermove", (e) => {
        this.isTouch = e.pointerType === "touch";
        const p = pos(e);
        this.handler.pointerMove(p.x, p.y);
      });
      const up = (e) => {
        if (!this.down) return;
        const p = pos(e);
        this.down = false;
        this.handler.pointerUp(p.x, p.y, e.button);
      };
      c.addEventListener("pointerup", up);
      c.addEventListener("pointercancel", up);
      c.addEventListener("pointerleave", () => {
        if (!this.down && !this.isTouch) {
          this.x = -100;
          this.y = -100;
        }
      });
      c.addEventListener("contextmenu", (e) => e.preventDefault());
      c.addEventListener("wheel", (e) => {
        this.handler.wheel?.(e.deltaY);
        e.preventDefault();
      }, { passive: false });
      window.addEventListener("keydown", (e) => {
        if (e.repeat) return;
        if (this.handler.key(e.key, e) !== false && [" ", "Escape", "Tab"].includes(e.key)) e.preventDefault();
      });
    }
  };

  // src/core/save.js
  var KEY = "pvz-html5-save-v1";
  var defaults = () => ({
    version: 1,
    adventure: 0,
    // 下一个要玩的冒险关卡序号
    completed: {},
    // 关卡 id -> true
    plants: ["peashooter"],
    seenZombies: ["normal"],
    minigames: {},
    // id -> {won:true, best}
    survival: {},
    // id -> 最佳旗数
    settings: {
      music: 0.55,
      sfx: 0.8,
      autoCollect: false,
      healthBars: false,
      speed: 1
    },
    stats: { zombiesKilled: 0, plantsPlanted: 0, sunCollected: 0 }
  });
  var save = {
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
          if (!this.data.plants.includes("peashooter")) this.data.plants.unshift("peashooter");
        }
      } catch (_) {
        this.data = defaults();
      }
      return this.data;
    },
    write() {
      try {
        localStorage.setItem(KEY, JSON.stringify(this.data));
      } catch (_) {
      }
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
    hasPlant(id) {
      return this.data.plants.includes(id);
    },
    unlockPlant(id) {
      if (!this.data.plants.includes(id)) {
        this.data.plants.push(id);
        this.write();
        return true;
      }
      return false;
    },
    seeZombie(id) {
      if (!this.data.seenZombies.includes(id)) {
        this.data.seenZombies.push(id);
        this.write();
      }
    },
    get settings() {
      return this.data.settings;
    }
  };

  // src/core/loop.js
  var STEP = 1 / 60;
  var loop = {
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
      const frame = (now) => {
        if (!this.running) return;
        let dt = (now - this.last) / 1e3;
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
        if (this.fpsTimer >= 1) {
          this.fps = Math.round(this.frameCount / this.fpsTimer);
          this.frameCount = 0;
          this.fpsTimer = 0;
        }
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    }
  };

  // src/core/util.js
  var TAU = Math.PI * 2;
  var clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  var lerp = (a, b, t) => a + (b - a) * t;
  var rand = (a = 1, b) => b === void 0 ? Math.random() * a : a + Math.random() * (b - a);
  var choose = (arr) => arr[Math.random() * arr.length | 0];
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.random() * (i + 1) | 0;
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function weightedChoice(list, weightOf) {
    let total = 0;
    for (const it of list) total += Math.max(0, weightOf(it));
    if (total <= 0) return null;
    let r = Math.random() * total;
    for (const it of list) {
      r -= Math.max(0, weightOf(it));
      if (r <= 0) return it;
    }
    return list[list.length - 1];
  }
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function() {
      a = a + 1831565813 >>> 0;
      let t = a;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  var Ease = {
    linear: (t) => t,
    inQuad: (t) => t * t,
    outQuad: (t) => t * (2 - t),
    inOutQuad: (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
    inCubic: (t) => t * t * t,
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    inOutCubic: (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
    inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
    outSine: (t) => Math.sin(t * Math.PI / 2),
    outBack: (t) => {
      const c1 = 1.70158, c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    },
    inBack: (t) => {
      const c1 = 1.70158, c3 = c1 + 1;
      return c3 * t * t * t - c1 * t * t;
    },
    outElastic: (t) => {
      if (t === 0 || t === 1) return t;
      return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI / 3)) + 1;
    },
    outBounce: (t) => {
      const n1 = 7.5625, d1 = 2.75;
      if (t < 1 / d1) return n1 * t * t;
      if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
      if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
      return n1 * (t -= 2.625 / d1) * t + 0.984375;
    }
  };
  var shadeCache = /* @__PURE__ */ new Map();
  function shade(hex, amt) {
    const key = hex + amt;
    let v = shadeCache.get(key);
    if (v) return v;
    let c = hex.replace("#", "");
    if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    const n = parseInt(c, 16);
    let r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255;
    if (amt >= 0) {
      r = r + (255 - r) * amt;
      g = g + (255 - g) * amt;
      b = b + (255 - b) * amt;
    } else {
      r = r * (1 + amt);
      g = g * (1 + amt);
      b = b * (1 + amt);
    }
    v = "#" + (1 << 24 | Math.round(r) << 16 | Math.round(g) << 8 | Math.round(b)).toString(16).slice(1);
    shadeCache.set(key, v);
    return v;
  }

  // src/core/audio.js
  var AudioEngine = class {
    constructor() {
      this.ctx = null;
      this.ready = false;
      this.last = /* @__PURE__ */ Object.create(null);
      this.voices = 0;
    }
    init() {
      if (this.ctx) {
        if (this.ctx.state === "suspended") this.ctx.resume();
        return;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const c = this.ctx = new AC();
      this.master = c.createGain();
      this.master.gain.value = 0.9;
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.knee.value = 18;
      comp.ratio.value = 4;
      comp.attack.value = 4e-3;
      comp.release.value = 0.18;
      this.master.connect(comp);
      comp.connect(c.destination);
      this.sfxBus = c.createGain();
      this.sfxBus.connect(this.master);
      this.musicBus = c.createGain();
      this.musicBus.connect(this.master);
      this.reverb = c.createConvolver();
      this.reverb.buffer = this.makeImpulse(1.8, 2.6);
      this.reverbSend = c.createGain();
      this.reverbSend.gain.value = 0.35;
      this.reverbSend.connect(this.reverb);
      this.reverb.connect(this.master);
      const len = c.sampleRate * 2;
      this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.brownBuf = c.createBuffer(1, len, c.sampleRate);
      const b = this.brownBuf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) {
        last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
        b[i] = last * 3.5;
      }
      this.distCurve = this.makeDistortion(30);
      this.applyVolumes();
      this.ready = true;
      if (c.state === "suspended") c.resume();
    }
    makeImpulse(seconds, decay) {
      const c = this.ctx;
      const len = Math.floor(c.sampleRate * seconds);
      const buf = c.createBuffer(2, len, c.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const data = buf.getChannelData(ch);
        for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
      return buf;
    }
    makeDistortion(k) {
      const n = 1024, curve = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const x = i * 2 / n - 1;
        curve[i] = (3 + k) * x * 20 * (Math.PI / 180) / (Math.PI + k * Math.abs(x));
      }
      return curve;
    }
    applyVolumes() {
      if (!this.ctx) return;
      const s = save.settings;
      this.sfxBus.gain.setTargetAtTime(s.sfx, this.ctx.currentTime, 0.02);
      this.musicBus.gain.setTargetAtTime(s.music * 0.55, this.ctx.currentTime, 0.02);
    }
    get t() {
      return this.ctx.currentTime;
    }
    // ---------- 合成基元 ----------
    // 振荡器音：支持频率滑动、颤音、滤波
    tone(type, f, t, dur, o = {}) {
      const c = this.ctx;
      const osc = c.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(f, t);
      if (o.end) {
        if (o.lin) osc.frequency.linearRampToValueAtTime(o.end, t + (o.slide || dur));
        else osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.end), t + (o.slide || dur));
      }
      if (o.detune) osc.detune.value = o.detune;
      let lfo;
      if (o.vib) {
        lfo = c.createOscillator();
        lfo.frequency.value = o.vibRate || 6;
        const lg2 = c.createGain();
        lg2.gain.value = o.vib;
        lfo.connect(lg2).connect(osc.frequency);
        lfo.start(t);
        lfo.stop(t + dur + 0.1);
      }
      const g = c.createGain();
      const peak = o.gain ?? 0.3;
      const a = o.attack ?? 4e-3;
      g.gain.setValueAtTime(1e-4, t);
      g.gain.exponentialRampToValueAtTime(peak, t + a);
      if (o.hold) g.gain.setValueAtTime(peak, t + a + o.hold);
      g.gain.exponentialRampToValueAtTime(1e-4, t + dur);
      let node = osc;
      if (o.filter) {
        const fl = c.createBiquadFilter();
        fl.type = o.filter;
        fl.frequency.setValueAtTime(o.ff || 1e3, t);
        if (o.ffEnd) fl.frequency.exponentialRampToValueAtTime(o.ffEnd, t + dur);
        fl.Q.value = o.q ?? 1;
        node.connect(fl);
        node = fl;
      }
      node.connect(g);
      g.connect(o.dest || this.curDest || this.sfxBus);
      if (o.verb) {
        const s = c.createGain();
        s.gain.value = o.verb;
        g.connect(s);
        s.connect(this.reverbSend);
      }
      osc.start(t);
      osc.stop(t + dur + 0.05);
      return osc;
    }
    // 滤波噪声
    noise(t, dur, o = {}) {
      const c = this.ctx;
      const src = c.createBufferSource();
      src.buffer = o.brown ? this.brownBuf : this.noiseBuf;
      src.loop = true;
      src.loopStart = rand(0, 1);
      const fl = c.createBiquadFilter();
      fl.type = o.type || "bandpass";
      fl.frequency.setValueAtTime(o.f || 1e3, t);
      if (o.end) fl.frequency.exponentialRampToValueAtTime(o.end, t + (o.slide || dur));
      fl.Q.value = o.q ?? 1;
      const g = c.createGain();
      const peak = o.gain ?? 0.3;
      const a = o.attack ?? 3e-3;
      g.gain.setValueAtTime(1e-4, t);
      g.gain.exponentialRampToValueAtTime(peak, t + a);
      if (o.hold) g.gain.setValueAtTime(peak, t + a + o.hold);
      g.gain.exponentialRampToValueAtTime(1e-4, t + dur);
      src.connect(fl).connect(g);
      let out = g;
      if (o.dist) {
        const ws = c.createWaveShaper();
        ws.curve = this.distCurve;
        g.connect(ws);
        out = ws;
      }
      out.connect(o.dest || this.curDest || this.sfxBus);
      if (o.verb) {
        const s = c.createGain();
        s.gain.value = o.verb;
        out.connect(s);
        s.connect(this.reverbSend);
      }
      src.start(t, rand(0, 1));
      src.stop(t + dur + 0.05);
    }
    // 元音共振峰（僵尸呻吟 / 尖叫）
    voice(t, dur, o) {
      const c = this.ctx;
      const src = c.createOscillator();
      src.type = "sawtooth";
      src.frequency.setValueAtTime(o.f, t);
      if (o.contour) {
        const n = o.contour.length;
        o.contour.forEach((m, i) => src.frequency.linearRampToValueAtTime(o.f * m, t + dur * (i + 1) / n));
      }
      const lfo = c.createOscillator();
      lfo.frequency.value = o.vibRate || 5;
      const lg2 = c.createGain();
      lg2.gain.value = o.vib ?? 3;
      lfo.connect(lg2).connect(src.frequency);
      const out = c.createGain();
      const peak = o.gain ?? 0.25;
      out.gain.setValueAtTime(1e-4, t);
      out.gain.exponentialRampToValueAtTime(peak, t + (o.attack ?? 0.12));
      out.gain.setValueAtTime(peak, t + dur * 0.7);
      out.gain.exponentialRampToValueAtTime(1e-4, t + dur);
      const formants = o.formants || [[500, 700], [1e3, 1200], [2400, 2500]];
      formants.forEach(([a, b], i) => {
        const bp = c.createBiquadFilter();
        bp.type = "bandpass";
        bp.Q.value = o.q ?? 7;
        bp.frequency.setValueAtTime(a, t);
        bp.frequency.linearRampToValueAtTime(b, t + dur);
        const fg = c.createGain();
        fg.gain.value = [1, 0.6, 0.25][i] ?? 0.2;
        src.connect(bp).connect(fg).connect(out);
      });
      if (o.breath) this.noise(t, dur, { type: "bandpass", f: formants[0][0] * 1.5, q: 2, gain: o.breath, attack: 0.1, dest: o.dest });
      out.connect(o.dest || this.curDest || this.sfxBus);
      const s = c.createGain();
      s.gain.value = o.verb ?? 0.3;
      out.connect(s);
      s.connect(this.reverbSend);
      src.start(t);
      lfo.start(t);
      src.stop(t + dur + 0.05);
      lfo.stop(t + dur + 0.05);
    }
    // ---------- 播放入口（带节流） ----------
    play(name, o = {}) {
      if (!this.ready || !this.ctx || save.settings.sfx <= 0) return;
      const fn = SFX[name];
      if (!fn) return;
      const now = this.ctx.currentTime;
      const gap = THROTTLE[name] ?? 0.02;
      if (this.last[name] && now - this.last[name] < gap) return;
      this.last[name] = now;
      const trim = TRIM[name];
      if (trim) {
        this.curDest = this.ctx.createGain();
        this.curDest.gain.value = trim;
        this.curDest.connect(this.sfxBus);
      }
      try {
        fn(this, now + (o.delay || 0), o);
      } catch (e) {
        console.warn("[sfx]", name, e.message);
      }
      this.curDest = null;
    }
  };
  var TRIM = {
    puff: 2,
    freezehit: 2,
    shieldhit: 2.5,
    shovel: 2.5,
    seedlift: 1.8,
    sunproduce: 3,
    wakeup: 3,
    dance: 4,
    conveyor: 4,
    groan: 2.2,
    chomp: 2,
    headfall: 1.5,
    pole: 2,
    impthrow: 2,
    zomboni: 2.5,
    shred: 2,
    ready: 2,
    set: 2,
    spike: 1.6,
    pickup: 2,
    tap: 1.5,
    button: 1.5,
    jackmusic: 2,
    combo: 2,
    plastic: 1.4,
    paper: 1.3,
    squash: 1.8,
    kelp: 1.5,
    magnet: 1.6,
    gravebuster: 1.6
  };
  var THROTTLE = {
    jackmusic: 0.8,
    thunder: 2,
    wind: 0.5,
    shoot: 0.05,
    splat: 0.04,
    chomp: 0.12,
    groan: 1.2,
    metal: 0.05,
    plastic: 0.05,
    paper: 0.06,
    sun: 0.06,
    hover: 0.05,
    spike: 0.2,
    fume: 0.15,
    firepea: 0.05,
    freezehit: 0.05,
    dirt: 0.3
  };
  var SFX = {
    // —— 植物 ——
    shoot(a, t) {
      a.tone("sine", rand(480, 560), t, 0.1, { end: 170, gain: 0.32 });
      a.noise(t, 0.05, { type: "highpass", f: 2500, gain: 0.08 });
    },
    puff(a, t) {
      a.noise(t, 0.12, { type: "bandpass", f: 1400, end: 600, gain: 0.25, q: 1.5 });
      a.tone("sine", 700, t, 0.08, { end: 300, gain: 0.12 });
    },
    splat(a, t) {
      a.noise(t, 0.14, { type: "bandpass", f: rand(900, 1300), end: 250, q: 1.3, gain: 0.45 });
      a.tone("sine", 190, t, 0.09, { end: 70, gain: 0.3 });
    },
    firepea(a, t) {
      a.noise(t, 0.3, { type: "bandpass", f: 1800, end: 400, q: 0.8, gain: 0.35 });
      a.tone("sine", 150, t, 0.12, { end: 60, gain: 0.25 });
    },
    freezehit(a, t) {
      a.tone("sine", 2600, t, 0.12, { end: 1500, gain: 0.08 });
      a.noise(t, 0.12, { type: "bandpass", f: 1100, end: 300, q: 1.3, gain: 0.35 });
    },
    metal(a, t) {
      [520, 1320, 2230, 3180].forEach((f, i) => a.tone("sine", f * rand(0.97, 1.03), t, 0.35 - i * 0.05, { gain: 0.1 - i * 0.015 }));
      a.noise(t, 0.05, { type: "highpass", f: 3e3, gain: 0.15 });
      a.tone("triangle", 260, t, 0.08, { end: 150, gain: 0.2 });
    },
    plastic(a, t) {
      a.tone("triangle", rand(330, 380), t, 0.08, { end: 200, gain: 0.3 });
      a.noise(t, 0.05, { type: "bandpass", f: 1300, q: 2, gain: 0.25 });
    },
    paper(a, t) {
      a.noise(t, 0.07, { type: "highpass", f: 2800, gain: 0.25 });
    },
    shieldhit(a, t) {
      [410, 980, 1760].forEach((f) => a.tone("square", f, t, 0.12, { gain: 0.04, filter: "lowpass", ff: 2500 }));
      a.noise(t, 0.08, { type: "bandpass", f: 2500, q: 3, gain: 0.2 });
    },
    plant(a, t) {
      a.noise(t, 0.16, { type: "lowpass", f: 700, end: 200, gain: 0.55 });
      a.tone("sine", 150, t, 0.14, { end: 55, gain: 0.45 });
      a.noise(t + 0.02, 0.08, { type: "highpass", f: 3500, gain: 0.08 });
    },
    plantwater(a, t) {
      a.noise(t, 0.35, { type: "bandpass", f: 2600, end: 700, q: 1.2, gain: 0.35 });
      for (let i = 0; i < 4; i++) a.tone("sine", rand(600, 900), t + i * 0.04, 0.08, { end: rand(1400, 2e3), gain: 0.05 });
    },
    seedlift(a, t) {
      a.tone("triangle", 1250, t, 0.04, { gain: 0.18 });
      a.tone("sine", 1900, t + 0.02, 0.05, { gain: 0.1 });
    },
    tap(a, t) {
      a.tone("sine", 720, t, 0.06, { end: 520, gain: 0.2 });
    },
    hover(a, t) {
      a.tone("sine", 1500, t, 0.025, { gain: 0.035 });
    },
    button(a, t) {
      a.noise(t, 0.09, { type: "lowpass", f: 900, gain: 0.35 });
      a.tone("sine", 320, t, 0.1, { end: 180, gain: 0.25 });
      a.tone("triangle", 900, t, 0.04, { gain: 0.08 });
    },
    buzzer(a, t) {
      a.tone("square", 110, t, 0.12, { gain: 0.12, filter: "lowpass", ff: 900 });
      a.tone("square", 104, t + 0.14, 0.14, { gain: 0.12, filter: "lowpass", ff: 900 });
    },
    sun(a, t) {
      [1046.5, 1318.5, 1568, 2093].forEach((f, i) => a.tone("sine", f, t + i * 0.035, 0.28, { gain: 0.1, verb: 0.2 }));
      a.tone("triangle", 3136, t + 0.1, 0.2, { gain: 0.03 });
    },
    sunproduce(a, t) {
      a.tone("sine", 880, t, 0.25, { end: 1760, gain: 0.05, verb: 0.2 });
    },
    shovel(a, t) {
      a.noise(t, 0.18, { type: "bandpass", f: 900, end: 400, q: 1.5, gain: 0.45 });
      a.tone("triangle", 1600, t, 0.06, { gain: 0.08 });
    },
    chomp(a, t) {
      for (let i = 0; i < 2; i++) {
        a.noise(t + i * 0.09, 0.07, { type: "bandpass", f: rand(550, 800), q: 2.5, gain: 0.45 });
        a.tone("square", 95, t + i * 0.09, 0.05, { gain: 0.06, filter: "lowpass", ff: 400 });
      }
    },
    bigchomp(a, t) {
      a.noise(t, 0.12, { type: "bandpass", f: 500, q: 1.5, gain: 0.6 });
      a.tone("sine", 220, t, 0.12, { end: 80, gain: 0.4 });
      a.noise(t + 0.15, 0.1, { type: "bandpass", f: 700, q: 2, gain: 0.4 });
    },
    gulp(a, t) {
      a.tone("sine", 320, t, 0.28, { end: 110, gain: 0.35 });
      a.tone("sine", 180, t + 0.18, 0.2, { end: 90, gain: 0.25 });
    },
    explode(a, t, o) {
      const big = o.big || 1;
      a.noise(t, 1.1 * big, { type: "lowpass", f: 3200, end: 90, gain: 0.9, dist: true, verb: 0.5 });
      a.noise(t, 1.6 * big, { brown: true, type: "lowpass", f: 400, end: 60, gain: 0.9, attack: 0.01 });
      a.tone("sine", 95, t, 0.7 * big, { end: 28, gain: 0.95 });
      a.tone("triangle", 60, t + 0.02, 0.5, { end: 30, gain: 0.5 });
    },
    doom(a, t) {
      SFX.explode(a, t, { big: 1.8 });
      a.tone("sine", 45, t + 0.1, 2.5, { end: 22, gain: 0.9, attack: 0.05 });
      a.noise(t + 0.3, 2.8, { brown: true, type: "lowpass", f: 300, end: 40, gain: 0.8, attack: 0.2, verb: 0.6 });
    },
    spudow(a, t) {
      a.noise(t, 0.6, { type: "lowpass", f: 2500, end: 120, gain: 0.8, dist: true, verb: 0.3 });
      a.tone("sine", 120, t, 0.35, { end: 40, gain: 0.8 });
      a.noise(t + 0.05, 0.5, { type: "bandpass", f: 400, q: 0.7, gain: 0.4 });
    },
    armed(a, t) {
      a.tone("sine", 380, t, 0.12, { end: 900, gain: 0.3 });
      a.noise(t, 0.1, { type: "lowpass", f: 600, gain: 0.3 });
    },
    fuse(a, t) {
      a.noise(t, 0.9, { type: "highpass", f: 3e3, gain: 0.12, attack: 0.05 });
      a.tone("sine", 300, t, 0.9, { end: 900, gain: 0.08, lin: true });
    },
    fume(a, t) {
      a.noise(t, 0.55, { type: "bandpass", f: 700, end: 2400, q: 0.8, gain: 0.3, attack: 0.05 });
    },
    jalapeno(a, t) {
      a.noise(t, 1.4, { type: "lowpass", f: 2200, end: 300, gain: 0.8, attack: 0.08, dist: true, verb: 0.4 });
      for (let i = 0; i < 10; i++) a.noise(t + rand(0, 1.1), 0.04, { type: "highpass", f: 4e3, gain: 0.15 });
      a.tone("sine", 80, t, 0.8, { end: 40, gain: 0.6 });
    },
    freeze(a, t) {
      for (let i = 0; i < 14; i++) a.tone("sine", rand(1800, 5200), t + rand(0, 0.5), rand(0.4, 1.2), { gain: 0.035, verb: 0.6 });
      a.noise(t, 1.2, { type: "highpass", f: 5e3, gain: 0.15, attack: 0.3 });
      a.noise(t + 0.4, 0.2, { type: "bandpass", f: 1800, q: 3, gain: 0.3 });
    },
    hypno(a, t) {
      a.tone("sine", 520, t, 0.9, { vib: 90, vibRate: 7, gain: 0.18, verb: 0.4 });
      a.tone("triangle", 780, t + 0.1, 0.8, { vib: 60, vibRate: 5, gain: 0.08 });
    },
    squash(a, t) {
      a.voice(t, 0.35, { f: 150, formants: [[300, 350], [800, 900]], gain: 0.25, vib: 2 });
    },
    thud(a, t) {
      a.noise(t, 0.3, { type: "lowpass", f: 500, end: 80, gain: 0.8 });
      a.tone("sine", 110, t, 0.3, { end: 35, gain: 0.8 });
    },
    splash(a, t) {
      a.noise(t, 0.5, { type: "bandpass", f: 3e3, end: 500, q: 0.9, gain: 0.45 });
      for (let i = 0; i < 6; i++) a.tone("sine", rand(500, 900), t + rand(0.05, 0.4), 0.07, { end: rand(1500, 2500), gain: 0.05 });
    },
    kelp(a, t) {
      SFX.splash(a, t);
      for (let i = 0; i < 8; i++) a.tone("sine", rand(200, 400), t + 0.3 + i * 0.08, 0.1, { end: rand(700, 1100), gain: 0.07 });
    },
    spike(a, t) {
      a.tone("triangle", 900, t, 0.05, { gain: 0.1 });
      a.noise(t, 0.05, { type: "highpass", f: 3e3, gain: 0.12 });
    },
    tire(a, t) {
      a.noise(t, 0.08, { type: "lowpass", f: 1500, gain: 0.8 });
      a.noise(t + 0.05, 0.9, { type: "highpass", f: 2500, end: 5e3, gain: 0.25, attack: 0.02 });
    },
    grave(a, t) {
      a.noise(t, 0.8, { brown: true, type: "lowpass", f: 500, gain: 0.7, attack: 0.05 });
      for (let i = 0; i < 5; i++) a.noise(t + rand(0, 0.6), 0.06, { type: "bandpass", f: rand(1500, 3e3), q: 3, gain: 0.2 });
    },
    gravebuster(a, t) {
      for (let i = 0; i < 6; i++) a.noise(t + i * 0.35, 0.12, { type: "bandpass", f: rand(500, 900), q: 2, gain: 0.3 });
    },
    magnet(a, t) {
      a.tone("sawtooth", 110, t, 0.6, { end: 440, gain: 0.08, filter: "lowpass", ff: 1200 });
      a.tone("sine", 880, t + 0.4, 0.3, { end: 1760, gain: 0.08 });
    },
    coffee(a, t) {
      a.tone("sine", 600, t, 0.15, { end: 1200, gain: 0.15 });
      a.noise(t + 0.1, 0.3, { type: "highpass", f: 4e3, gain: 0.1 });
    },
    wakeup(a, t) {
      a.tone("triangle", 500, t, 0.1, { end: 900, gain: 0.12 });
    },
    // —— 僵尸 ——
    groan(a, t) {
      const f = rand(70, 115);
      const kind = Math.random() * 3 | 0;
      if (kind === 0) {
        a.voice(t, 0.35, { f, formants: [[350, 400], [900, 1e3]], gain: 0.16, breath: 0.03 });
        a.voice(t + 0.33, 0.9, { f: f * 1.08, contour: [1.05, 1, 0.9], formants: [[750, 700], [1200, 1100], [2500, 2400]], gain: 0.2, breath: 0.04 });
        a.voice(t + 1.2, 0.35, { f: f * 0.95, formants: [[320, 300], [2100, 2300]], gain: 0.12 });
        a.noise(t + 1.45, 0.2, { type: "highpass", f: 4500, gain: 0.05, attack: 0.05 });
      } else if (kind === 1) {
        a.voice(t, rand(1, 1.5), { f, contour: [1.1, 1.2, 0.85], formants: [[450, 650], [900, 1150], [2400, 2500]], gain: 0.22, breath: 0.05 });
      } else {
        a.voice(t, 0.5, { f: f * 1.2, contour: [1.2, 0.9], formants: [[600, 500], [1100, 900]], gain: 0.2 });
        a.voice(t + 0.55, 0.7, { f, contour: [1.1, 0.8], formants: [[500, 450], [1e3, 900]], gain: 0.18 });
      }
    },
    awooga(a, t) {
      for (let i = 0; i < 2; i++) {
        const s = t + i * 0.75;
        a.tone("sawtooth", 190, s, 0.62, { end: 300, slide: 0.35, gain: 0.14, filter: "bandpass", ff: 900, q: 1.2, attack: 0.03, hold: 0.2 });
        a.tone("square", 192, s, 0.62, { end: 302, slide: 0.35, gain: 0.05, filter: "lowpass", ff: 1400, attack: 0.03, hold: 0.2 });
      }
    },
    hugewave(a, t) {
      [55, 82.4, 110].forEach((f, i) => a.tone("sawtooth", f, t, 2.6, { gain: 0.12, filter: "lowpass", ff: 150, ffEnd: 1400, attack: 0.3, hold: 1.2, verb: 0.4, detune: i * 5 }));
      for (let i = 0; i < 16; i++) a.noise(t + i * 0.1, 0.18, { brown: true, type: "lowpass", f: 300, gain: 0.25 + i * 0.03 });
      a.noise(t + 1.7, 0.8, { type: "lowpass", f: 2e3, end: 200, gain: 0.5, verb: 0.5 });
    },
    finalwave(a, t) {
      [65.4, 98, 130.8, 155.6].forEach((f) => a.tone("sawtooth", f, t, 2.2, { gain: 0.1, filter: "lowpass", ff: 2e3, ffEnd: 300, attack: 0.01, verb: 0.5 }));
      [220, 530, 870, 1340].forEach((f, i) => a.tone("sine", f, t, 2.5 - i * 0.3, { gain: 0.08 }));
      a.noise(t, 1.2, { type: "lowpass", f: 3e3, end: 200, gain: 0.5, verb: 0.6 });
    },
    dirt(a, t) {
      a.noise(t, 0.6, { brown: true, type: "lowpass", f: 600, gain: 0.6, attack: 0.05 });
      a.noise(t + 0.1, 0.4, { type: "bandpass", f: 1200, q: 1, gain: 0.15 });
    },
    headfall(a, t) {
      a.tone("sine", 200, t, 0.12, { end: 90, gain: 0.3 });
      a.noise(t, 0.08, { type: "lowpass", f: 800, gain: 0.25 });
    },
    zombiefall(a, t) {
      a.noise(t, 0.25, { type: "lowpass", f: 450, end: 100, gain: 0.5 });
      a.tone("sine", 90, t, 0.2, { end: 45, gain: 0.35 });
    },
    pole(a, t) {
      a.tone("sine", 220, t, 0.45, { end: 700, gain: 0.2, vib: 20, vibRate: 12 });
      a.noise(t, 0.4, { type: "bandpass", f: 800, end: 2400, q: 1, gain: 0.2 });
    },
    newspaper(a, t) {
      a.noise(t, 0.25, { type: "highpass", f: 2e3, gain: 0.4 });
      a.voice(t + 0.25, 0.7, { f: 160, contour: [1.4, 1.6, 1.2], formants: [[700, 800], [1200, 1300], [2600, 2600]], gain: 0.3, vib: 8 });
    },
    dance(a, t) {
      a.tone("square", 440, t, 0.4, { end: 880, gain: 0.05, filter: "lowpass", ff: 2e3 });
    },
    smash(a, t) {
      a.noise(t, 0.5, { brown: true, type: "lowpass", f: 400, gain: 0.9 });
      a.tone("sine", 70, t, 0.5, { end: 25, gain: 0.9 });
      a.noise(t, 0.15, { type: "bandpass", f: 1500, q: 1, gain: 0.3 });
    },
    impthrow(a, t) {
      a.noise(t, 0.5, { type: "bandpass", f: 600, end: 2500, q: 1, gain: 0.25 });
      a.tone("sine", 400, t, 0.6, { end: 1200, gain: 0.1, vib: 30, vibRate: 10 });
    },
    zomboni(a, t) {
      a.tone("sawtooth", 55, t, 1.2, { gain: 0.08, filter: "lowpass", ff: 300, vib: 4, vibRate: 18 });
    },
    vehicle(a, t) {
      SFX.explode(a, t, { big: 0.8 });
      [300, 720, 1200].forEach((f) => a.tone("sine", f, t, 0.5, { gain: 0.06 }));
    },
    mower(a, t) {
      a.tone("sawtooth", 62, t, 1.8, { gain: 0.16, filter: "lowpass", ff: 500, vib: 6, vibRate: 22, attack: 0.05 });
      a.tone("square", 124, t, 1.8, { gain: 0.05, filter: "lowpass", ff: 700, vib: 10, vibRate: 22, attack: 0.05 });
      a.noise(t, 1.8, { type: "bandpass", f: 350, q: 0.8, gain: 0.2, attack: 0.05 });
    },
    shred(a, t) {
      a.noise(t, 0.3, { type: "bandpass", f: 1200, q: 0.7, gain: 0.35 });
      a.tone("square", 80, t, 0.25, { gain: 0.06, filter: "lowpass", ff: 600 });
    },
    // —— 界面 / 流程 ——
    ready(a, t) {
      a.tone("triangle", 392, t, 0.35, { gain: 0.25 });
      a.tone("sine", 784, t, 0.3, { gain: 0.08 });
    },
    set(a, t) {
      a.tone("triangle", 494, t, 0.35, { gain: 0.25 });
      a.tone("sine", 988, t, 0.3, { gain: 0.08 });
    },
    go(a, t) {
      [523, 659, 784, 1047].forEach((f) => a.tone("triangle", f, t, 0.7, { gain: 0.12, verb: 0.3 }));
      a.noise(t, 0.5, { type: "highpass", f: 5e3, gain: 0.12 });
    },
    win(a, t) {
      const n = [523.3, 659.3, 784, 1046.5, 784, 1046.5, 1318.5];
      n.forEach((f, i) => a.tone("square", f, t + i * 0.11, 0.25, { gain: 0.06, filter: "lowpass", ff: 3e3 }));
      n.forEach((f, i) => a.tone("triangle", f, t + i * 0.11, 0.3, { gain: 0.12 }));
      [523.3, 659.3, 784, 1046.5].forEach((f) => a.tone("triangle", f, t + 0.8, 1.6, { gain: 0.08, verb: 0.5 }));
    },
    award(a, t) {
      const n = [392, 523, 659, 784, 1046, 1318, 1568, 2093];
      n.forEach((f, i) => a.tone("sine", f, t + i * 0.07, 0.9, { gain: 0.08, verb: 0.6 }));
      a.noise(t, 1.5, { type: "highpass", f: 6e3, gain: 0.08, attack: 0.4 });
    },
    lose(a, t) {
      a.voice(t, 1.3, { f: 420, contour: [1.6, 1.9, 1.4, 1.1], formants: [[800, 700], [1300, 1150], [2800, 2600]], gain: 0.28, vib: 25, vibRate: 7, breath: 0.08, q: 5 });
      [110, 130.8, 155.6, 185].forEach((f) => a.tone("sawtooth", f, t + 1.1, 2.5, { gain: 0.06, filter: "lowpass", ff: 1500, ffEnd: 200, verb: 0.6 }));
      a.noise(t + 1.1, 1.5, { brown: true, type: "lowpass", f: 300, gain: 0.6 });
    },
    pause(a, t) {
      a.tone("sine", 660, t, 0.08, { gain: 0.15 });
      a.tone("sine", 440, t + 0.08, 0.1, { gain: 0.15 });
    },
    unpause(a, t) {
      a.tone("sine", 440, t, 0.08, { gain: 0.15 });
      a.tone("sine", 660, t + 0.08, 0.1, { gain: 0.15 });
    },
    flag(a, t) {
      a.tone("triangle", 660, t, 0.2, { gain: 0.15 });
      a.tone("triangle", 880, t + 0.1, 0.3, { gain: 0.15 });
    },
    bowl(a, t) {
      a.noise(t, 0.35, { brown: true, type: "lowpass", f: 350, gain: 0.5 });
      a.tone("triangle", 160, t, 0.2, { end: 110, gain: 0.2 });
    },
    bowlhit(a, t) {
      a.tone("sine", 280, t, 0.18, { end: 110, gain: 0.5 });
      a.tone("triangle", 900, t, 0.05, { gain: 0.2 });
      a.noise(t, 0.08, { type: "bandpass", f: 1200, q: 2, gain: 0.3 });
    },
    combo(a, t, o) {
      const base = 523 * Math.pow(1.12, Math.min(8, o.n || 1));
      a.tone("square", base, t, 0.15, { gain: 0.06, filter: "lowpass", ff: 3e3 });
      a.tone("square", base * 1.5, t + 0.08, 0.2, { gain: 0.06, filter: "lowpass", ff: 3e3 });
    },
    whack(a, t) {
      a.noise(t, 0.12, { type: "lowpass", f: 1200, gain: 0.7 });
      a.tone("sine", 180, t, 0.15, { end: 60, gain: 0.6 });
      a.tone("triangle", 700, t, 0.04, { gain: 0.2 });
    },
    vase(a, t) {
      for (let i = 0; i < 10; i++) a.tone("sine", rand(1800, 5e3), t + rand(0, 0.12), rand(0.05, 0.2), { gain: 0.06 });
      a.noise(t, 0.3, { type: "highpass", f: 2500, end: 1200, gain: 0.45 });
      a.noise(t, 0.2, { type: "lowpass", f: 600, gain: 0.3 });
    },
    pickup(a, t) {
      a.tone("sine", 660, t, 0.1, { end: 990, gain: 0.18 });
    },
    gong(a, t) {
      [180, 432, 707, 1053, 1500].forEach((f, i) => a.tone("sine", f, t, 3 - i * 0.4, { gain: 0.09, verb: 0.6 }));
    },
    conveyor(a, t) {
      a.tone("square", 220, t, 0.03, { gain: 0.03, filter: "lowpass", ff: 800 });
    },
    sodroll(a, t) {
      a.noise(t, 1.6, { brown: true, type: "lowpass", f: 700, gain: 0.35, attack: 0.1 });
    },
    ice(a, t) {
      a.noise(t, 0.15, { type: "highpass", f: 5e3, gain: 0.2 });
      a.tone("sine", 3200, t, 0.2, { gain: 0.04 });
    },
    pop(a, t) {
      a.noise(t, 0.08, { type: "highpass", f: 1800, gain: 0.6 });
      a.tone("sine", 900, t, 0.08, { end: 300, gain: 0.25 });
    },
    wind(a, t) {
      a.noise(t, 1.6, { type: "bandpass", f: 400, end: 1600, q: 0.6, gain: 0.5, attack: 0.25, verb: 0.3 });
      a.noise(t + 0.2, 1.2, { type: "bandpass", f: 900, end: 300, q: 0.8, gain: 0.25, attack: 0.3 });
    },
    thunder(a, t) {
      a.noise(t, 0.15, { type: "highpass", f: 2e3, gain: 0.35 });
      a.noise(t, 3, { brown: true, type: "lowpass", f: 500, end: 60, gain: 0.9, attack: 0.05, verb: 0.7 });
      for (let i = 0; i < 5; i++) a.noise(t + 0.2 + i * 0.35 + rand(0, 0.2), 0.5, { brown: true, type: "lowpass", f: 300, gain: 0.5 });
    },
    jackmusic(a, t) {
      const notes = [1046.5, 1318.5, 1568, 1318.5, 1760, 1568];
      notes.forEach((f, i) => a.tone("sine", f, t + i * 0.14, 0.3, { gain: 0.05, verb: 0.3 }));
    }
  };
  var audio = new AudioEngine();

  // src/core/music.js
  var NOTE_INDEX = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function noteFreq(name) {
    const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
    if (!m) return 0;
    let n = NOTE_INDEX[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
    const oct = parseInt(m[3], 10);
    const midi = (oct + 1) * 12 + n;
    return 440 * Math.pow(2, (midi - 69) / 12);
  }
  function parseMelody(str) {
    const toks = str.split(/\s+/).filter((t) => t && t !== "|");
    const events = [];
    let cur = null;
    toks.forEach((tok, i) => {
      if (tok === ".") {
        if (cur) cur.len++;
        return;
      }
      if (tok === "-") {
        cur = null;
        return;
      }
      let vel = 1;
      if (tok.endsWith("!")) {
        vel = 1.35;
        tok = tok.slice(0, -1);
      }
      if (tok.endsWith("?")) {
        vel = 0.6;
        tok = tok.slice(0, -1);
      }
      cur = { step: i, len: 1, freqs: tok.split("+").map(noteFreq).filter(Boolean), vel };
      events.push(cur);
    });
    return { events, length: toks.length };
  }
  function parseDrums(str) {
    const chars = str.replace(/[\s|]/g, "").split("");
    const events = [];
    chars.forEach((ch, i) => {
      if (ch !== "-" && ch !== ".") events.push({ step: i, hit: ch });
    });
    return { events, length: chars.length };
  }
  var INSTR = {
    pluck(t, f, d, v, out) {
      const c = audio.ctx;
      const g = c.createGain();
      const fl = c.createBiquadFilter();
      fl.type = "lowpass";
      fl.Q.value = 2;
      fl.frequency.setValueAtTime(Math.min(8e3, f * 7), t);
      fl.frequency.exponentialRampToValueAtTime(Math.max(300, f * 1.4), t + 0.18);
      const len = Math.min(d, 0.5) + 0.12;
      g.gain.setValueAtTime(1e-4, t);
      g.gain.exponentialRampToValueAtTime(0.16 * v, t + 3e-3);
      g.gain.exponentialRampToValueAtTime(1e-4, t + len);
      for (const [type, det] of [["sawtooth", -6], ["square", 6]]) {
        const o = c.createOscillator();
        o.type = type;
        o.frequency.value = f;
        o.detune.value = det;
        o.connect(fl);
        o.start(t);
        o.stop(t + len + 0.05);
      }
      fl.connect(g);
      g.connect(out);
    },
    pizz(t, f, d, v, out) {
      const c = audio.ctx;
      const o = c.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = f;
      const fl = c.createBiquadFilter();
      fl.type = "lowpass";
      fl.frequency.setValueAtTime(f * 5, t);
      fl.frequency.exponentialRampToValueAtTime(f * 1.2, t + 0.12);
      const g = c.createGain();
      g.gain.setValueAtTime(1e-4, t);
      g.gain.exponentialRampToValueAtTime(0.32 * v, t + 4e-3);
      g.gain.exponentialRampToValueAtTime(1e-4, t + 0.28);
      o.connect(fl).connect(g).connect(out);
      o.start(t);
      o.stop(t + 0.32);
    },
    marimba(t, f, d, v, out) {
      const c = audio.ctx;
      const g = c.createGain();
      g.gain.setValueAtTime(1e-4, t);
      g.gain.exponentialRampToValueAtTime(0.3 * v, t + 2e-3);
      g.gain.exponentialRampToValueAtTime(1e-4, t + 0.45 + Math.min(d, 0.3));
      const o = c.createOscillator();
      o.type = "sine";
      o.frequency.value = f;
      const o2 = c.createOscillator();
      o2.type = "sine";
      o2.frequency.value = f * 4;
      const g2 = c.createGain();
      g2.gain.setValueAtTime(0.12 * v, t);
      g2.gain.exponentialRampToValueAtTime(1e-4, t + 0.08);
      o.connect(g);
      o2.connect(g2).connect(out);
      g.connect(out);
      o.start(t);
      o2.start(t);
      o.stop(t + 1);
      o2.stop(t + 0.1);
    },
    bell(t, f, d, v, out) {
      const c = audio.ctx;
      const g = c.createGain();
      g.gain.setValueAtTime(1e-4, t);
      g.gain.exponentialRampToValueAtTime(0.14 * v, t + 3e-3);
      g.gain.exponentialRampToValueAtTime(1e-4, t + 1.6);
      [[1, 1], [2.76, 0.35], [5.4, 0.12]].forEach(([m, a]) => {
        const o = c.createOscillator();
        o.type = "sine";
        o.frequency.value = f * m;
        const og = c.createGain();
        og.gain.value = a;
        o.connect(og).connect(g);
        o.start(t);
        o.stop(t + 1.7);
      });
      g.connect(out);
      const s = c.createGain();
      s.gain.value = 0.5;
      g.connect(s);
      s.connect(audio.reverbSend);
    },
    lead(t, f, d, v, out) {
      const c = audio.ctx;
      const o = c.createOscillator();
      o.type = "triangle";
      o.frequency.value = f;
      const lfo = c.createOscillator();
      lfo.frequency.value = 5.5;
      const lg2 = c.createGain();
      lg2.gain.setValueAtTime(0, t);
      lg2.gain.linearRampToValueAtTime(f * 0.012, t + 0.25);
      lfo.connect(lg2).connect(o.frequency);
      const g = c.createGain();
      g.gain.setValueAtTime(1e-4, t);
      g.gain.exponentialRampToValueAtTime(0.2 * v, t + 0.02);
      g.gain.setValueAtTime(0.2 * v, t + Math.max(0.03, d - 0.05));
      g.gain.exponentialRampToValueAtTime(1e-4, t + d + 0.12);
      o.connect(g).connect(out);
      o.start(t);
      lfo.start(t);
      o.stop(t + d + 0.2);
      lfo.stop(t + d + 0.2);
      const s = c.createGain();
      s.gain.value = 0.3;
      g.connect(s);
      s.connect(audio.reverbSend);
    },
    bass(t, f, d, v, out) {
      const c = audio.ctx;
      const g = c.createGain();
      g.gain.setValueAtTime(1e-4, t);
      g.gain.exponentialRampToValueAtTime(0.38 * v, t + 8e-3);
      g.gain.exponentialRampToValueAtTime(0.18 * v, t + 0.1);
      g.gain.exponentialRampToValueAtTime(1e-4, t + Math.max(0.15, d) + 0.05);
      const o = c.createOscillator();
      o.type = "triangle";
      o.frequency.value = f;
      const o2 = c.createOscillator();
      o2.type = "sine";
      o2.frequency.value = f / 2;
      const g2 = c.createGain();
      g2.gain.value = 0.5;
      o.connect(g);
      o2.connect(g2).connect(g);
      g.connect(out);
      o.start(t);
      o2.start(t);
      o.stop(t + d + 0.2);
      o2.stop(t + d + 0.2);
    },
    pad(t, f, d, v, out) {
      const c = audio.ctx;
      const g = c.createGain();
      const fl = c.createBiquadFilter();
      fl.type = "lowpass";
      fl.frequency.value = 1100;
      fl.Q.value = 0.5;
      g.gain.setValueAtTime(1e-4, t);
      g.gain.exponentialRampToValueAtTime(0.05 * v, t + 0.25);
      g.gain.setValueAtTime(0.05 * v, t + Math.max(0.3, d - 0.1));
      g.gain.exponentialRampToValueAtTime(1e-4, t + d + 0.5);
      [-8, 8].forEach((det) => {
        const o = c.createOscillator();
        o.type = "sawtooth";
        o.frequency.value = f;
        o.detune.value = det;
        o.connect(fl);
        o.start(t);
        o.stop(t + d + 0.6);
      });
      fl.connect(g);
      g.connect(out);
      const s = c.createGain();
      s.gain.value = 0.6;
      g.connect(s);
      s.connect(audio.reverbSend);
    },
    organ(t, f, d, v, out) {
      const c = audio.ctx;
      const g = c.createGain();
      g.gain.setValueAtTime(1e-4, t);
      g.gain.exponentialRampToValueAtTime(0.07 * v, t + 0.01);
      g.gain.setValueAtTime(0.07 * v, t + Math.max(0.02, d - 0.03));
      g.gain.exponentialRampToValueAtTime(1e-4, t + d + 0.08);
      [[1, "sine", 1], [2, "sine", 0.5], [3, "triangle", 0.25]].forEach(([m, ty, a]) => {
        const o = c.createOscillator();
        o.type = ty;
        o.frequency.value = f * m;
        const og = c.createGain();
        og.gain.value = a;
        o.connect(og).connect(g);
        o.start(t);
        o.stop(t + d + 0.1);
      });
      g.connect(out);
    }
  };
  function drum(hit, t, v, out) {
    const c = audio.ctx;
    const mk = (dur, peak) => {
      const g = c.createGain();
      g.gain.setValueAtTime(1e-4, t);
      g.gain.exponentialRampToValueAtTime(peak * v, t + 2e-3);
      g.gain.exponentialRampToValueAtTime(1e-4, t + dur);
      g.connect(out);
      return g;
    };
    const noise = (dur, type, f, q, peak) => {
      const s = c.createBufferSource();
      s.buffer = audio.noiseBuf;
      const fl = c.createBiquadFilter();
      fl.type = type;
      fl.frequency.value = f;
      fl.Q.value = q;
      s.connect(fl).connect(mk(dur, peak));
      s.start(t, Math.random());
      s.stop(t + dur + 0.02);
    };
    const tone = (f0, f1, dur, peak, type = "sine") => {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      o.connect(mk(dur, peak));
      o.start(t);
      o.stop(t + dur + 0.02);
    };
    switch (hit) {
      case "k":
        tone(150, 42, 0.18, 0.7);
        break;
      case "s":
        noise(0.14, "bandpass", 1800, 0.8, 0.35);
        tone(200, 120, 0.06, 0.2, "triangle");
        break;
      case "h":
        noise(0.035, "highpass", 7500, 1, 0.12);
        break;
      case "o":
        noise(0.18, "highpass", 6500, 1, 0.1);
        break;
      case "t":
        tone(140, 80, 0.2, 0.4);
        break;
      case "c":
        noise(0.08, "bandpass", 1200, 1.2, 0.3);
        break;
      case "x":
        tone(150, 42, 0.18, 0.7);
        noise(0.035, "highpass", 7500, 1, 0.12);
        break;
      case "r":
        noise(0.06, "highpass", 4500, 1, 0.07);
        break;
    }
  }
  var DAY = {
    bpm: 104,
    swing: 0.12,
    tracks: {
      lead: { inst: "marimba", gain: 0.9, notes: `
      A4 - C5 - E5 . - D5 C5 - B4 - A4 . - - | F4 - A4 - C5 . - B4 A4 - G4 - F4 . - - |
      G4 - B4 - D5 . - C5 B4 - A4 - G4 . B4 - | G#4 . - - B4 . - - E5 . - - D5 . C5 B4 |
      A4 - C5 - E5 . - D5 C5 - B4 - A4 . - E5 | F5 . - E5 D5 . C5 - A4 . - - C5 . - - |
      D5 . - F5 E5 . D5 - B4 . - - G#4 . - - | A4 . - - E4 . - - A4 . . . - - - - |
      E5 - G5 - E5 - C5 - D5 - E5 - C5 . - - | D5 - B4 - G4 - B4 - D5 . - - G5 . - - |
      C5 - E5 - A5 . - G5 E5 . - - C5 . - - | B4 - G#4 - E4 - G#4 - B4 . - - E5 . - - |
      A5 . G5 - F5 . E5 - D5 . C5 - A4 . - - | G4 - C5 - E5 . - C5 G5 . - - E5 . - - |
      F5 . - E5 D5 . - C5 D5 . - - A4 . - - | B4 . - - G#4 . - - E4 . - - - - - - |` },
      bass: { inst: "pizz", gain: 1, notes: `
      A2 - - - E3 - - - A2 - - - E3 - C3 - | F2 - - - C3 - - - F2 - - - C3 - A2 - |
      G2 - - - D3 - - - G2 - - - D3 - B2 - | E2 - - - B2 - - - E2 - - - G#2 - B2 - |
      A2 - - - E3 - - - A2 - - - E3 - C3 - | F2 - - - C3 - - - F2 - - - A2 - C3 - |
      D3 - - - A2 - - - E2 - - - B2 - - - | A2 - - - E2 - - - A2 - - - - - - - |
      C3 - - - G2 - - - C3 - - - G2 - E2 - | G2 - - - D3 - - - G2 - - - B2 - D3 - |
      A2 - - - E3 - - - A2 - - - C3 - E3 - | E2 - - - B2 - - - E2 - - - G#2 - B2 - |
      F2 - - - C3 - - - F2 - - - A2 - C3 - | C3 - - - G2 - - - C3 - - - E3 - G2 - |
      D3 - - - A2 - - - D3 - - - F2 - A2 - | E2 - - - B2 - - - E2 - - - E3 - - - |` },
      chords: { inst: "pluck", gain: 0.5, notes: `
      - - - - A3+C4+E4 - - - - - - - A3+C4+E4 - - - | - - - - A3+C4+F4 - - - - - - - A3+C4+F4 - - - |
      - - - - B3+D4+G4 - - - - - - - B3+D4+G4 - - - | - - - - G#3+B3+E4 - - - - - - - G#3+B3+E4 - - - |
      - - - - A3+C4+E4 - - - - - - - A3+C4+E4 - - - | - - - - A3+C4+F4 - - - - - - - A3+C4+F4 - - - |
      - - - - A3+D4+F4 - - - - - - - G#3+B3+E4 - - - | - - - - A3+C4+E4 - - - - - - - - - - - |
      - - - - G3+C4+E4 - - - - - - - G3+C4+E4 - - - | - - - - G3+B3+D4 - - - - - - - G3+B3+D4 - - - |
      - - - - A3+C4+E4 - - - - - - - A3+C4+E4 - - - | - - - - G#3+B3+E4 - - - - - - - G#3+B3+E4 - - - |
      - - - - A3+C4+F4 - - - - - - - A3+C4+F4 - - - | - - - - G3+C4+E4 - - - - - - - G3+C4+E4 - - - |
      - - - - A3+D4+F4 - - - - - - - A3+D4+F4 - - - | - - - - G#3+B3+E4 - - - - - - - G#3+B3+D4 - - - |` },
      drums: { drums: true, gain: 0.6, notes: "k-r-h-r-k-r-h-rr".repeat(16) },
      intense: { drums: true, gain: 0.9, layer: "intense", notes: "k-hsk-h-kks-h-sh".repeat(15) + "k-s-k-s-ssssssst" }
    }
  };
  var NIGHT = {
    bpm: 86,
    swing: 0.08,
    tracks: {
      lead: { inst: "bell", gain: 0.9, notes: `
      D5 . . . F5 . A5 . G5 . F5 . E5 . . . | D5 . . . F5 . Bb5 . A5 . G5 . F5 . . . |
      G5 . . . F5 . D5 . Bb4 . D5 . G5 . . . | E5 . . . C#5 . E5 . A5 . . . G5 . . . |
      F5 . . . E5 . D5 . A4 . D5 . F5 . . . | F5 . . . G5 . F5 . D5 . Bb4 . D5 . . . |
      E5 . . . G5 . C6 . Bb5 . G5 . E5 . . . | C#5 . . . E5 . . . A4 . . . - - - - |` },
      pad: { inst: "pad", gain: 0.9, notes: `
      D3+F3+A3 . . . . . . . . . . . . . . . | Bb2+D3+F3 . . . . . . . . . . . . . . . |
      G2+Bb2+D3 . . . . . . . . . . . . . . . | A2+C#3+E3 . . . . . . . . . . . . . . . |
      D3+F3+A3 . . . . . . . . . . . . . . . | Bb2+D3+F3 . . . . . . . . . . . . . . . |
      C3+E3+G3 . . . . . . . . . . . . . . . | A2+C#3+E3 . . . . . . . . . . . . . . . |` },
      bass: { inst: "bass", gain: 0.9, notes: `
      D2 . . . - - A2 - D2 . . . - - A2 - | Bb1 . . . - - F2 - Bb1 . . . - - F2 - |
      G1 . . . - - D2 - G1 . . . - - D2 - | A1 . . . - - E2 - A1 . . . - - C#2 - |
      D2 . . . - - A2 - D2 . . . - - A2 - | Bb1 . . . - - F2 - Bb1 . . . - - D2 - |
      C2 . . . - - G2 - C2 . . . - - E2 - | A1 . . . - - E2 - A1 . . . E2 - C#2 - |` },
      counter: { inst: "pizz", gain: 0.5, notes: `
      - - A3 - - - A3 - - - A3 - - - A3 - | - - F3 - - - F3 - - - F3 - - - F3 - |
      - - D3 - - - D3 - - - D3 - - - D3 - | - - E3 - - - E3 - - - C#3 - - - E3 - |
      - - A3 - - - A3 - - - A3 - - - A3 - | - - F3 - - - F3 - - - F3 - - - F3 - |
      - - G3 - - - G3 - - - E3 - - - G3 - | - - E3 - - - E3 - - - C#3 - - - A2 - |` },
      drums: { drums: true, gain: 0.45, notes: "k-------c-------k-----k-c-------".repeat(4) },
      intense: { drums: true, gain: 0.9, layer: "intense", notes: "k-h-s-h-k-hkt-ht".repeat(8) }
    }
  };
  var POOL = {
    bpm: 124,
    swing: 0.1,
    tracks: {
      lead: { inst: "lead", gain: 0.8, notes: `
      B4 - D5 - G5 . - D5 B4 - D5 - G5 . - - | G5 - E5 - B4 . - E5 G5 - B5 - A5 . G5 - |
      E5 - G5 - C6 . - B5 A5 - G5 - E5 . - - | F#5 . - - A5 . - - D5 . - - F#5 . A5 - |
      B5 . - A5 G5 - D5 - B4 . - D5 G5 . - - | E5 - G5 - B5 . - A5 G5 . - E5 D5 . - - |
      C5 . E5 - A5 . - G5 F#5 . - - D5 . - - | G5 . - - D5 . - - G4 . . . - - - - |` },
      bass: { inst: "bass", gain: 0.9, notes: `
      G2 - - G2 - - D3 - G2 - - G2 - - B2 - | E2 - - E2 - - B2 - E2 - - E2 - - G2 - |
      C3 - - C3 - - G2 - C3 - - C3 - - E3 - | D2 - - D2 - - A2 - D2 - - F#2 - A2 - - |
      G2 - - G2 - - D3 - G2 - - G2 - - B2 - | E2 - - E2 - - B2 - E2 - - E2 - - G2 - |
      A2 - - A2 - - E3 - D2 - - D2 - - F#2 - | G2 - - D2 - - B1 - G2 - - - - - - - |` },
      chords: { inst: "pluck", gain: 0.45, notes: `
      - - G3+B3+D4 - - - G3+B3+D4 - - - G3+B3+D4 - - - G3+B3+D4 - | - - G3+B3+E4 - - - G3+B3+E4 - - - G3+B3+E4 - - - G3+B3+E4 - |
      - - G3+C4+E4 - - - G3+C4+E4 - - - G3+C4+E4 - - - G3+C4+E4 - | - - F#3+A3+D4 - - - F#3+A3+D4 - - - F#3+A3+D4 - - - F#3+A3+D4 - |
      - - G3+B3+D4 - - - G3+B3+D4 - - - G3+B3+D4 - - - G3+B3+D4 - | - - G3+B3+E4 - - - G3+B3+E4 - - - G3+B3+E4 - - - G3+B3+E4 - |
      - - A3+C4+E4 - - - A3+C4+E4 - - - F#3+A3+D4 - - - F#3+A3+D4 - | - - G3+B3+D4 - - - G3+B3+D4 - - - - - - - - - |` },
      drums: { drums: true, gain: 0.55, notes: "k-h-s-hkk-h-s-hh".repeat(8) },
      intense: { drums: true, gain: 0.8, layer: "intense", notes: "kkhtskhtkkhtsstt".repeat(8) }
    }
  };
  var MENU = {
    bpm: 84,
    swing: 0,
    tracks: {
      lead: { inst: "bell", gain: 0.8, notes: `
      B4 . E5 . G5 . B5 . A5 . G5 . F#5 . E5 . | E5 . G5 . C6 . B5 . A5 . . . G5 . . . |
      A4 . C5 . E5 . A5 . G5 . F#5 . E5 . C5 . | D#5 . F#5 . B5 . . . A5 . . . F#5 . . . |
      B4 . E5 . G5 . B5 . D6 . C6 . B5 . G5 . | C6 . B5 . A5 . G5 . E5 . . . C5 . . . |
      A4 . B4 . C5 . E5 . D#5 . E5 . F#5 . A5 . | G5 . . . F#5 . . . E5 . . . - - - - |` },
      pad: { inst: "pad", gain: 0.8, notes: `
      E3+G3+B3 . . . . . . . . . . . . . . . | C3+E3+G3 . . . . . . . . . . . . . . . |
      A2+C3+E3 . . . . . . . . . . . . . . . | B2+D#3+F#3 . . . . . . . . . . . . . . . |
      E3+G3+B3 . . . . . . . . . . . . . . . | C3+E3+A3 . . . . . . . . . . . . . . . |
      A2+C3+E3 . . . . . . . . . . . . . . . | B2+D#3+F#3 . . . . . . . E3+G3+B3 . . . . . . . |` },
      bass: { inst: "pizz", gain: 0.6, notes: `
      E2 - - - B2 - - - E2 - - - B2 - - - | C2 - - - G2 - - - C2 - - - G2 - - - |
      A1 - - - E2 - - - A1 - - - E2 - - - | B1 - - - F#2 - - - B1 - - - F#2 - - - |
      E2 - - - B2 - - - E2 - - - B2 - - - | C2 - - - G2 - - - C2 - - - A2 - - - |
      A1 - - - E2 - - - A1 - - - C2 - - - | B1 - - - F#2 - - - E2 - - - - - - - |` }
    }
  };
  var SELECT = {
    bpm: 112,
    swing: 0.22,
    tracks: {
      bass: { inst: "pizz", gain: 1, notes: `
      C3 - - - E3 - - - G3 - - - A3 - - - | A2 - - - C3 - - - E3 - - - G3 - - - |
      D3 - - - F3 - - - A3 - - - C4 - - - | G2 - - - B2 - - - D3 - - - F3 - - - |
      C3 - - - E3 - - - G3 - - - B3 - - - | A2 - - - C3 - - - E3 - - - C#3 - - - |
      D3 - - - F3 - - - A3 - - - F3 - - - | G2 - - - D3 - - - G2 - - - B2 - - - |` },
      lead: { inst: "bell", gain: 0.55, notes: `
      E5 . . . G5 . . . B5 . A5 . G5 . . . | - - C5 - E5 - G5 - E5 . . . - - - - |
      F5 . . . A5 . . . C6 . B5 . A5 . . . | G5 . F5 . D5 . . . B4 . . . - - - - |
      E5 . . . G5 . . . B5 . . . D6 . C6 . | A5 . . . E5 . . . C#5 . . . E5 . . . |
      D5 . F5 . A5 . . . C6 . B5 . A5 . F5 . | G5 . . . . . . . - - - - - - - - |` },
      comp: { inst: "organ", gain: 0.6, notes: `
      - - - - E4+G4+B4 . - - - - - - E4+G4+B4 . - - | - - - - C4+E4+G4 . - - - - - - C4+E4+G4 . - - |
      - - - - F4+A4+C5 . - - - - - - F4+A4+C5 . - - | - - - - F4+B4+D5 . - - - - - - F4+B4+D5 . - - |
      - - - - E4+G4+B4 . - - - - - - E4+G4+B4 . - - | - - - - E4+G4+C#5 . - - - - - - E4+G4+C#5 . - - |
      - - - - F4+A4+C5 . - - - - - - F4+A4+C5 . - - | - - - - F4+B4+D5 . - - - - - - - - - - |` },
      drums: { drums: true, gain: 0.5, notes: "h--rh-r-h--rh-rr".repeat(8) }
    }
  };
  var MINIGAME = {
    bpm: 132,
    swing: 0.15,
    tracks: {
      lead: { inst: "pluck", gain: 0.75, notes: `
      C5 - E5 - G5 - E5 - C5 - E5 - G5 . - - | A5 - G5 - E5 - C5 - D5 . - - - - - - |
      F5 - A5 - C6 - A5 - F5 - A5 - C6 . - - | B5 - A5 - G5 - F5 - E5 . - - D5 . - - |
      C5 - E5 - G5 - E5 - C5 - E5 - G5 . - - | A5 - B5 - C6 - A5 - G5 . - - E5 . - - |
      F5 - E5 - D5 - C5 - B4 - D5 - G5 . - - | C5 . - - G4 . - - C5 . . . - - - - |` },
      bass: { inst: "bass", gain: 0.9, notes: `
      C3 - G2 - C3 - G2 - C3 - G2 - C3 - E3 - | A2 - E2 - A2 - E2 - G2 - D2 - G2 - B2 - |
      F2 - C3 - F2 - C3 - F2 - C3 - F2 - A2 - | G2 - D3 - G2 - D3 - C3 - G2 - B2 - G2 - |
      C3 - G2 - C3 - G2 - C3 - G2 - C3 - E3 - | F2 - C3 - F2 - A2 - C3 - G2 - C3 - E3 - |
      D3 - A2 - D3 - A2 - G2 - D3 - G2 - B2 - | C3 - G2 - E2 - G2 - C3 - - - - - - - |` },
      drums: { drums: true, gain: 0.55, notes: "k-hhs-hhk-hhs-hk".repeat(8) }
    }
  };
  var FOG = {
    bpm: 78,
    swing: 0.06,
    tracks: {
      lead: { inst: "lead", gain: 0.75, notes: `
      F#5 . . . D5 . B4 . C#5 . D5 . F#5 . . . | G5 . . . F#5 . E5 . D5 . . . B4 . . . |
      E5 . . . G5 . F#5 . E5 . D5 . C#5 . . . | C#5 . . . A#4 . C#5 . F#5 . . . - - - - |
      B5 . . . A5 . F#5 . D5 . F#5 . B5 . . . | G5 . . . B5 . A5 . G5 . F#5 . E5 . . . |
      E5 . . . C#5 . E5 . A5 . G5 . E5 . C#5 . | A#4 . . . C#5 . . . F#4 . . . - - - - |` },
      pad: { inst: "pad", gain: 1, notes: `
      B3+D4+F#4 . . . . . . . . . . . . . . . | G3+B3+D4 . . . . . . . . . . . . . . . |
      E3+G3+B3 . . . . . . . . . . . . . . . | F#3+A#3+C#4 . . . . . . . . . . . . . . . |
      B3+D4+F#4 . . . . . . . . . . . . . . . | G3+B3+D4 . . . . . . . . . . . . . . . |
      A3+C#4+E4 . . . . . . . . . . . . . . . | F#3+A#3+C#4 . . . . . . . . . . . . . . . |` },
      bass: { inst: "pizz", gain: 0.9, notes: `
      B1 - - - - - - - F#2 - - - - - D2 - | G1 - - - - - - - D2 - - - - - B1 - |
      E2 - - - - - - - B1 - - - - - G1 - | F#1 - - - - - - - C#2 - - - - - A#1 - |
      B1 - - - - - - - F#2 - - - - - D2 - | G1 - - - - - - - D2 - - - - - B1 - |
      A1 - - - - - - - E2 - - - - - C#2 - | F#1 - - - - - - - C#2 - - - F#1 - - - |` },
      bells: { inst: "bell", gain: 0.35, notes: `
      - - - - - - - - - - - - D6 . . . | - - - - - - - - - - - - B5 . . . |
      - - - - - - - - - - - - G5 . . . | - - - - - - - - - - - - A#5 . . . |
      - - - - - - - - - - - - F#6 . . . | - - - - - - - - - - - - D6 . . . |
      - - - - - - - - - - - - C#6 . . . | - - - - - - - - - - - - F#5 . . . |` },
      drums: { drums: true, gain: 0.45, notes: "k-------c---k-r-".repeat(8) },
      intense: { drums: true, gain: 0.85, layer: "intense", notes: "k-h-skh-k-hkstt-".repeat(8) }
    }
  };
  var SONGS = { day: DAY, night: NIGHT, pool: POOL, fog: FOG, menu: MENU, select: SELECT, minigame: MINIGAME };
  for (const song of Object.values(SONGS)) {
    song.len = 0;
    for (const tr of Object.values(song.tracks)) {
      tr.parsed = tr.drums ? parseDrums(tr.notes) : parseMelody(tr.notes);
      song.len = Math.max(song.len, tr.parsed.length);
    }
  }
  var MusicPlayer = class {
    constructor() {
      this.song = null;
      this.name = null;
      this.layers = { intense: 0 };
      this.timer = null;
    }
    play(name) {
      if (!audio.ready) {
        this.pending = name;
        return;
      }
      if (this.name === name && this.song) return;
      this.stop(0.6);
      const song = SONGS[name];
      if (!song) return;
      this.name = name;
      this.song = song;
      const c = audio.ctx;
      this.bus = c.createGain();
      this.bus.gain.setValueAtTime(1e-4, c.currentTime);
      this.bus.gain.exponentialRampToValueAtTime(1, c.currentTime + 0.8);
      this.bus.connect(audio.musicBus);
      this.layerGain = { intense: c.createGain() };
      this.layerGain.intense.gain.value = this.layers.intense;
      this.layerGain.intense.connect(this.bus);
      this.trackGains = {};
      for (const [key, tr] of Object.entries(song.tracks)) {
        const g = c.createGain();
        g.gain.value = tr.gain ?? 1;
        g.connect(tr.layer ? this.layerGain[tr.layer] : this.bus);
        this.trackGains[key] = g;
      }
      this.step = 0;
      this.nextTime = c.currentTime + 0.1;
      this.stepDur = 60 / song.bpm / 4;
      clearInterval(this.timer);
      this.timer = setInterval(() => this.schedule(), 25);
    }
    schedule() {
      if (!this.song) return;
      const c = audio.ctx;
      const song = this.song;
      if (this.nextTime < c.currentTime - 0.2) this.nextTime = c.currentTime + 0.05;
      while (this.nextTime < c.currentTime + 0.12) {
        const s = this.step % song.len;
        const swingOff = s % 2 === 1 ? this.stepDur * (song.swing || 0) : 0;
        const t = this.nextTime + swingOff;
        for (const [key, tr] of Object.entries(song.tracks)) {
          const p = tr.parsed;
          const local = s % p.length;
          const out = this.trackGains[key];
          if (tr.layer && this.layers[tr.layer] <= 0.01) continue;
          for (const ev of p.events) {
            if (ev.step !== local) continue;
            if (tr.drums) drum(ev.hit, t, 1, out);
            else for (const f of ev.freqs) INSTR[tr.inst](t, f, ev.len * this.stepDur, ev.vel, out);
          }
        }
        this.nextTime += this.stepDur;
        this.step++;
      }
    }
    setLayer(name, v) {
      this.layers[name] = v;
      if (this.layerGain && this.layerGain[name]) this.layerGain[name].gain.setTargetAtTime(v, audio.ctx.currentTime, 0.4);
    }
    stop(fade = 0.5) {
      clearInterval(this.timer);
      this.timer = null;
      if (this.bus && audio.ctx) {
        const b = this.bus;
        const t = audio.ctx.currentTime;
        b.gain.cancelScheduledValues(t);
        b.gain.setValueAtTime(b.gain.value, t);
        b.gain.exponentialRampToValueAtTime(1e-4, t + Math.max(0.05, fade));
        setTimeout(() => {
          try {
            b.disconnect();
          } catch (_) {
          }
        }, fade * 1e3 + 300);
      }
      this.bus = null;
      this.song = null;
      this.name = null;
    }
    resumePending() {
      if (this.pending) {
        const n = this.pending;
        this.pending = null;
        this.play(n);
      }
    }
  };
  var music = new MusicPlayer();

  // src/scenes/director.js
  var Director = class {
    constructor() {
      this.scene = null;
      this.next = null;
      this.fade = 0;
      this.fadeDir = 0;
      this.fadeSpeed = 3;
      this.fadeColor = "#000";
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
      this.fadeColor = o.color || "#000";
    }
    swap(scene) {
      this.scene?.exit?.();
      this.scene = scene;
      scene.enter?.();
      display.setCursor("default");
    }
    update(dt) {
      this.time += dt;
      if (this.fadeDir !== 0) {
        this.fade += this.fadeDir * this.fadeSpeed * dt;
        if (this.fadeDir > 0 && this.fade >= 1) {
          this.fade = 1;
          if (this.next) {
            this.swap(this.next);
            this.next = null;
          }
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
    get busy() {
      return this.fadeDir !== 0;
    }
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
    pointerMove(x, y) {
      this.scene?.pointerMove?.(x, y);
    }
    pointerUp(x, y, b) {
      if (this.fadeDir > 0) return;
      this.scene?.pointerUp?.(x, y, b);
    }
    wheel(d) {
      this.scene?.wheel?.(d);
    }
    key(k, e) {
      this.unlockAudio();
      if (k === "f" || k === "F") {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {
        });
        else document.exitFullscreen?.();
        return;
      }
      return this.scene?.key?.(k, e);
    }
  };
  var director = new Director();

  // src/gfx/paint.js
  var FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans CJK SC","Source Han Sans SC","WenQuanYi Micro Hei",sans-serif';
  function E(ctx, x, y, rx, ry, rot = 0) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(0.01, Math.abs(rx)), Math.max(0.01, Math.abs(ry)), rot, 0, TAU);
  }
  function C(ctx, x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, Math.max(0.01, Math.abs(r)), 0, TAU);
  }
  function fs(ctx, fill, stroke, lw = 2) {
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.lineWidth = lw;
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
  }
  function rg(ctx, x, y, r0, x1, y1, r1, stops) {
    const g = ctx.createRadialGradient(x, y, r0, x1, y1, r1);
    for (let i = 0; i < stops.length; i += 2) g.addColorStop(stops[i], stops[i + 1]);
    return g;
  }
  function lg(ctx, x0, y0, x1, y1, stops) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    for (let i = 0; i < stops.length; i += 2) g.addColorStop(stops[i], stops[i + 1]);
    return g;
  }
  function ball(ctx, x, y, r, light, dark, stroke, lw = 2) {
    C(ctx, x, y, r);
    fs(ctx, rg(ctx, x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r * 1.05, [0, light, 1, dark]), stroke, lw);
  }
  function shadow(ctx, x, y, rx, ry = rx * 0.32, a = 0.3) {
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.translate(x, y);
    ctx.scale(1, ry / rx);
    ctx.fillStyle = rg(ctx, 0, 0, 0, 0, 0, rx, [0, "rgba(0,0,0,0.9)", 0.55, "rgba(0,0,0,0.65)", 1, "rgba(0,0,0,0)"]);
    C(ctx, 0, 0, rx);
    ctx.fill();
    ctx.restore();
  }
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    const rad = Math.min(r, w / 2, h / 2);
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
    ctx.closePath();
  }
  function tube(ctx, pts, w, fill, stroke, lw = 2) {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(pts[0], pts[1]);
      if (pts.length === 4) ctx.lineTo(pts[2], pts[3]);
      else if (pts.length === 6) ctx.quadraticCurveTo(pts[2], pts[3], pts[4], pts[5]);
      else if (pts.length === 8) ctx.bezierCurveTo(pts[2], pts[3], pts[4], pts[5], pts[6], pts[7]);
    };
    if (stroke) {
      path();
      ctx.lineWidth = w + lw * 2;
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
    path();
    ctx.lineWidth = w;
    ctx.strokeStyle = fill;
    ctx.stroke();
  }
  function line(ctx, x0, y0, x1, y1, color, w = 2) {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.lineWidth = w;
    ctx.strokeStyle = color;
    ctx.lineCap = "round";
    ctx.stroke();
  }
  function eye(ctx, x, y, rx, ry, px = 0, py = 0, o = {}) {
    E(ctx, x, y, rx, ry, o.rot || 0);
    fs(ctx, o.white || "#fff", o.stroke === void 0 ? "rgba(0,0,0,0.75)" : o.stroke, o.lw || 1.4);
    const pr = o.pupil || 0.5;
    E(ctx, x + px, y + py, rx * pr, ry * pr * 1.08);
    ctx.fillStyle = o.pupilColor || "#141414";
    ctx.fill();
    if (o.highlight !== false) {
      C(ctx, x + px - rx * pr * 0.35, y + py - ry * pr * 0.4, Math.max(0.8, rx * pr * 0.35));
      ctx.fillStyle = "#fff";
      ctx.fill();
    }
  }
  function closedEye(ctx, x, y, r, color = "#222", lw = 2) {
    ctx.beginPath();
    ctx.arc(x, y - r * 0.3, r, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.lineWidth = lw;
    ctx.strokeStyle = color;
    ctx.lineCap = "round";
    ctx.stroke();
  }
  function leafPath(ctx, len, wid, curl = 0) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(len * 0.25, -wid * 1.1, len * 0.75, -wid * (0.9 + curl), len, curl * wid);
    ctx.bezierCurveTo(len * 0.7, wid * (0.8 - curl), len * 0.3, wid * 0.9, 0, 0);
    ctx.closePath();
  }
  function leaf(ctx, x, y, ang, len, wid, fill, stroke, o = {}) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    leafPath(ctx, len, wid, o.curl || 0);
    const g = o.flat ? fill : lg(ctx, 0, -wid, 0, wid, [0, o.light || fill, 1, fill]);
    fs(ctx, g, stroke, o.lw || 1.8);
    if (o.vein !== false) {
      ctx.beginPath();
      ctx.moveTo(len * 0.05, 0);
      ctx.quadraticCurveTo(len * 0.5, -wid * 0.15, len * 0.92, (o.curl || 0) * wid);
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = stroke;
      ctx.globalAlpha *= 0.45;
      ctx.stroke();
    }
    ctx.restore();
  }
  function text(ctx, s, x, y, o = {}) {
    const size = o.size || 24;
    ctx.font = `${o.weight || 900} ${size}px ${o.font || FONT}`;
    ctx.textAlign = o.align || "center";
    ctx.textBaseline = o.baseline || "middle";
    if (o.shadow) {
      ctx.save();
      ctx.fillStyle = o.shadow;
      const d = o.shadowOffset ?? Math.max(2, size * 0.08);
      if (o.stroke) {
        ctx.lineJoin = "round";
        ctx.lineWidth = o.lw || size * 0.2;
        ctx.strokeStyle = o.shadow;
        ctx.strokeText(s, x + d, y + d);
      }
      ctx.fillText(s, x + d, y + d);
      ctx.restore();
    }
    if (o.stroke) {
      ctx.lineJoin = "round";
      ctx.miterLimit = 2;
      ctx.lineWidth = o.lw || size * 0.2;
      ctx.strokeStyle = o.stroke;
      ctx.strokeText(s, x, y);
    }
    ctx.fillStyle = o.color || "#fff";
    ctx.fillText(s, x, y);
  }
  function wrapText(ctx, s, x, y, maxW, lineH, o = {}) {
    const size = o.size || 16;
    ctx.font = `${o.weight || 500} ${size}px ${FONT}`;
    const lines = [];
    for (const para of s.split("\n")) {
      let cur = "";
      const noStart = "\uFF0C\u3002\uFF01\uFF1F\u3001\uFF1B\uFF1A\uFF09\u300D\u300F\u201D\u2019\u300B\u2026,.!?;:)";
      for (const ch of para) {
        const test = cur + ch;
        if (ctx.measureText(test).width > maxW && cur && !noStart.includes(ch)) {
          lines.push(cur);
          cur = ch;
        } else cur = test;
      }
      lines.push(cur);
    }
    ctx.textAlign = o.align || "left";
    ctx.textBaseline = "top";
    ctx.fillStyle = o.color || "#fff";
    lines.forEach((ln, i) => ctx.fillText(ln, x, y + i * lineH));
    return lines.length * lineH;
  }
  function star(ctx, x, y, r1, r2, n, rot = 0) {
    ctx.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const r = i % 2 === 0 ? r1 : r2;
      const a = rot + i * Math.PI / n;
      const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }
  function blob(ctx, pts) {
    const n = pts.length / 2;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x0 = pts[(i - 1 + n) % n * 2], y0 = pts[(i - 1 + n) % n * 2 + 1];
      const x1 = pts[i * 2], y1 = pts[i * 2 + 1];
      const x2 = pts[(i + 1) % n * 2], y2 = pts[(i + 1) % n * 2 + 1];
      const mx0 = (x0 + x1) / 2, my0 = (y0 + y1) / 2;
      const mx1 = (x1 + x2) / 2, my1 = (y1 + y2) / 2;
      if (i === 0) ctx.moveTo(mx0, my0);
      ctx.quadraticCurveTo(x1, y1, mx1, my1);
    }
    ctx.closePath();
  }
  function teeth(ctx, x0, y0, x1, y1, n, h, dir = 1, fill = "#fffbe8", stroke = "#555") {
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a = i / n, b = (i + 1) / n, m = (a + b) / 2;
      const ax = x0 + (x1 - x0) * a, ay = y0 + (y1 - y0) * a;
      const bx = x0 + (x1 - x0) * b, by = y0 + (y1 - y0) * b;
      const mx = x0 + (x1 - x0) * m, my = y0 + (y1 - y0) * m;
      ctx.moveTo(ax, ay);
      ctx.lineTo(mx, my + h * dir);
      ctx.lineTo(bx, by);
    }
    fs(ctx, fill, stroke, 1);
  }

  // src/game/layout.js
  var LAWN_X = 250;
  var COL_W = 100;
  var COLS = 9;
  var LAWN_TOP = 140;
  var LAWN_RIGHT = LAWN_X + COLS * COL_W;
  var WORLD_MIN_X = -240;
  var WORLD_MAX_X = 1760;
  var WORLD_W = WORLD_MAX_X - WORLD_MIN_X;
  var SPAWN_X = 1290;
  var ENV = {
    day: { rows: 5, rowH: 112, water: [], night: false, name: "\u767D\u5929" },
    night: { rows: 5, rowH: 112, water: [], night: true, name: "\u9ED1\u591C" },
    pool: { rows: 6, rowH: 94, water: [2, 3], night: false, name: "\u6CF3\u6C60" },
    fog: { rows: 6, rowH: 94, water: [2, 3], night: true, fog: true, name: "\u6D53\u96FE" }
  };
  var POOL_X0 = LAWN_X - 6;
  var POOL_X1 = LAWN_RIGHT + 44;
  function envInfo(env) {
    return ENV[env] || ENV.day;
  }
  function colX(c) {
    return LAWN_X + c * COL_W + COL_W / 2;
  }
  function colOf(x) {
    return Math.floor((x - LAWN_X) / COL_W);
  }

  // src/gfx/bgArt.js
  var PAL = {
    day: {
      sky: ["#8fd0ff", "#d6f0ff"],
      tree: ["#2f6a24", "#4f9a34", "#7cc04a"],
      fence: ["#e2bf88", "#b98a52", "#6e4a22"],
      hedge: ["#3e8a2a", "#5aa83a", "#244f16"],
      grass: ["#62b236", "#72c342"],
      grassDark: "#3f8a22",
      grassLight: "#a4e06a",
      wall: ["#efe3c6", "#d2c29e"],
      wallLine: "#b8a47c",
      roof: ["#6a4f5a", "#4a3440"],
      trim: "#fbf8ef",
      deck: ["#c89664", "#9a6c40"],
      walk: ["#d0ccc0", "#b4b0a4"],
      road: ["#55555c", "#46464c"],
      line: "#f2d24a",
      dirt: ["#8c6238", "#6e4a28"],
      window: ["#bfe6ff", "#6aa8d8"],
      door: ["#8a4a2a", "#5e2e16"],
      ambient: null
    },
    night: {
      sky: ["#0a1330", "#223466"],
      tree: ["#0c1a1c", "#16302c", "#23463a"],
      fence: ["#6a6488", "#4a4668", "#232036"],
      hedge: ["#1a3a34", "#28504a", "#0c201c"],
      grass: ["#2f5e4a", "#376c55"],
      grassDark: "#1e4032",
      grassLight: "#5a9a7a",
      wall: ["#707090", "#565674"],
      wallLine: "#484866",
      roof: ["#2a2238", "#1a1426"],
      trim: "#a8a8c8",
      deck: ["#5a4a5a", "#3e3040"],
      walk: ["#6a6a7c", "#56566a"],
      road: ["#2a2a34", "#222228"],
      line: "#a89a4a",
      dirt: ["#4a3a38", "#382a28"],
      window: ["#ffe08a", "#f0a030"],
      door: ["#4a2a2a", "#2e1818"],
      ambient: "rgba(20,30,80,0.18)"
    }
  };
  var nightEnv = (env) => env === "night" || env === "fog";
  function grassPalette(env) {
    return nightEnv(env) ? PAL.night : PAL.day;
  }
  function paintWorld(ctx, env, rand2, o = {}) {
    const P = grassPalette(env);
    const info = envInfo(env);
    const H2 = 720;
    ctx.save();
    ctx.translate(-WORLD_MIN_X, 0);
    ctx.fillStyle = lg(ctx, 0, 0, 0, 120, [0, P.sky[0], 1, P.sky[1]]);
    ctx.fillRect(WORLD_MIN_X, 0, WORLD_W, 140);
    if (nightEnv(env)) {
      for (let i = 0; i < 140; i++) {
        const x = WORLD_MIN_X + rand2() * WORLD_W, y = rand2() * 90, r = rand2() * 1.4 + 0.3;
        ctx.globalAlpha = 0.4 + rand2() * 0.6;
        C(ctx, x, y, r);
        ctx.fillStyle = "#fff";
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      const mx = 1480, my = 44;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      C(ctx, mx, my, 90);
      ctx.fillStyle = rg(ctx, mx, my, 10, mx, my, 90, [0, "rgba(200,210,255,0.35)", 1, "rgba(120,140,255,0)"]);
      ctx.fill();
      ctx.restore();
      C(ctx, mx, my, 28);
      fs(ctx, rg(ctx, mx - 8, my - 8, 3, mx, my, 30, [0, "#fffef0", 1, "#d8dcc8"]));
      ctx.globalAlpha = 0.18;
      for (const [dx, dy, r] of [[-8, -4, 6], [9, 6, 5], [4, -12, 3.5], [-6, 12, 4]]) {
        C(ctx, mx + dx, my + dy, r);
        ctx.fillStyle = "#8a8c80";
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else {
      for (let i = 0; i < 6; i++) {
        const x = WORLD_MIN_X + 200 + i * 340 + rand2() * 100, y = 18 + rand2() * 20;
        ctx.globalAlpha = 0.85;
        for (let k = 0; k < 5; k++) {
          C(ctx, x + k * 22 - 44, y + Math.sin(k * 1.7) * 6, 18 + k % 2 * 6);
          ctx.fillStyle = "#ffffff";
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    }
    for (let layer = 0; layer < 2; layer++) {
      for (let x = WORLD_MIN_X + 150; x < WORLD_MIN_X + WORLD_W + 60; x += 46 + rand2() * 30) {
        const y = 62 + layer * 18 + rand2() * 18;
        const r = 34 + rand2() * 26 - layer * 6;
        C(ctx, x, y, r);
        ctx.fillStyle = rg(ctx, x - r * 0.3, y - r * 0.4, 2, x, y, r, [0, layer ? P.tree[2] : P.tree[1], 1, P.tree[0]]);
        ctx.fill();
      }
    }
    const fenceY0 = 66, fenceY1 = 132;
    ctx.fillStyle = shade(P.fence[1], -0.15);
    ctx.fillRect(LAWN_X - 10, fenceY0 + 16, LAWN_RIGHT - LAWN_X + 30, 10);
    ctx.fillRect(LAWN_X - 10, fenceY0 + 46, LAWN_RIGHT - LAWN_X + 30, 10);
    for (let x = LAWN_X - 6; x < LAWN_RIGHT + 16; x += 30) {
      const h = fenceY1 - fenceY0 + (rand2() * 4 - 2);
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
      ctx.moveTo(x + 8 + rand2() * 10, fenceY1 - h + 16);
      ctx.lineTo(x + 8 + rand2() * 10, fenceY1 - 6);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    for (let x = LAWN_X - 20; x < LAWN_RIGHT + 30; x += 22 + rand2() * 12) {
      const y = 132 + rand2() * 6, r = 14 + rand2() * 9;
      C(ctx, x, y, r);
      ctx.fillStyle = rg(ctx, x - 5, y - 6, 2, x, y, r, [0, P.hedge[1], 1, P.hedge[0]]);
      ctx.fill();
    }
    const walkX0 = LAWN_RIGHT + 16, walkX1 = LAWN_RIGHT + 150, curbX = walkX1, roadX = walkX1 + 14;
    ctx.fillStyle = lg(ctx, walkX0, 0, walkX1, 0, [0, P.walk[0], 1, P.walk[1]]);
    ctx.fillRect(walkX0, 0, walkX1 - walkX0, H2);
    ctx.strokeStyle = shade(P.walk[1], -0.2);
    ctx.lineWidth = 1.5;
    for (let y = 10; y < H2; y += 86) {
      ctx.beginPath();
      ctx.moveTo(walkX0, y);
      ctx.lineTo(walkX1, y);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo((walkX0 + walkX1) / 2, 0);
    ctx.lineTo((walkX0 + walkX1) / 2, H2);
    ctx.stroke();
    for (let i = 0; i < 500; i++) {
      ctx.fillStyle = rand2() > 0.5 ? "rgba(0,0,0,0.07)" : "rgba(255,255,255,0.1)";
      ctx.fillRect(walkX0 + rand2() * (walkX1 - walkX0), rand2() * H2, 2, 2);
    }
    ctx.fillStyle = lg(ctx, curbX, 0, curbX + 14, 0, [0, shade(P.walk[0], 0.2), 1, shade(P.walk[1], -0.1)]);
    ctx.fillRect(curbX, 0, 14, H2);
    ctx.fillStyle = lg(ctx, roadX, 0, roadX + 400, 0, [0, P.road[0], 1, P.road[1]]);
    ctx.fillRect(roadX, 0, WORLD_MIN_X + WORLD_W - roadX, H2);
    for (let i = 0; i < 2500; i++) {
      ctx.fillStyle = rand2() > 0.5 ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.06)";
      ctx.fillRect(roadX + rand2() * 460, rand2() * H2, 2, 2);
    }
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(roadX, 0, 8, H2);
    ctx.fillStyle = P.line;
    for (let y = -20; y < H2; y += 100) ctx.fillRect(roadX + 300, y, 10, 56);
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 6; i++) {
      let x = roadX + 30 + rand2() * 380, y = rand2() * H2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let k = 0; k < 5; k++) {
        x += rand2() * 16 - 8;
        y += 6 + rand2() * 10;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.fillStyle = lg(ctx, LAWN_RIGHT, 0, LAWN_RIGHT + 16, 0, [0, shade(P.dirt[1], -0.1), 1, shade(P.walk[1], -0.25)]);
    ctx.fillRect(LAWN_RIGHT, LAWN_TOP - 10, 16, H2 - LAWN_TOP + 10);
    paintLawn(ctx, env, rand2, o.dirt);
    if (info.water.length) paintPool(ctx, env, rand2);
    const lawnBottom = LAWN_TOP + info.rows * info.rowH;
    ctx.fillStyle = lg(ctx, 0, lawnBottom, 0, H2, [0, shade(P.dirt[1], -0.1), 1, shade(P.dirt[1], -0.35)]);
    ctx.fillRect(LAWN_X - 12, lawnBottom, LAWN_RIGHT - LAWN_X + 28, H2 - lawnBottom);
    for (let x = LAWN_X; x < LAWN_RIGHT; x += 16 + rand2() * 20) {
      const y = lawnBottom + 6 + rand2() * 8;
      ctx.fillStyle = [P.hedge[1], P.hedge[0]][rand2() * 2 | 0];
      C(ctx, x, y, 6 + rand2() * 5);
      ctx.fill();
      if (rand2() > 0.6) {
        C(ctx, x + 3, y - 2, 2.6);
        ctx.fillStyle = ["#ff8ab0", "#fff27a", "#ffffff", "#b58aff"][rand2() * 4 | 0];
        ctx.fill();
      }
    }
    ctx.fillStyle = lg(ctx, LAWN_X - 12, 0, LAWN_X, 0, [0, shade(P.walk[1], -0.1), 1, shade(P.walk[1], -0.3)]);
    ctx.fillRect(LAWN_X - 12, LAWN_TOP - 4, 12, lawnBottom - LAWN_TOP + 4);
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fillRect(LAWN_X, LAWN_TOP, 6, lawnBottom - LAWN_TOP);
    for (const y of [LAWN_TOP + 8, lawnBottom - 6]) {
      for (let k = 0; k < 4; k++) {
        C(ctx, LAWN_RIGHT + 4 + rand2() * 12, y + (rand2() - 0.5) * 20, 12 + rand2() * 6);
        ctx.fillStyle = rg(ctx, LAWN_RIGHT, y - 6, 2, LAWN_RIGHT + 8, y, 20, [0, P.hedge[1], 1, P.hedge[0]]);
        ctx.fill();
      }
    }
    paintHouse(ctx, env, rand2, lawnBottom);
    if (P.ambient) {
      ctx.fillStyle = P.ambient;
      ctx.fillRect(WORLD_MIN_X, 0, WORLD_W, H2);
    }
    ctx.restore();
  }
  function paintLawn(ctx, env, rand2, dirtOnly) {
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
            ctx.fillStyle = rand2() > 0.5 ? "rgba(40,20,5,0.25)" : "rgba(255,220,170,0.12)";
            const s = 1 + rand2() * 3;
            ctx.fillRect(x0 + rand2() * COL_W, y0 + rand2() * info.rowH, s, s);
          }
          continue;
        }
        const base = (r + c) % 2 ? P.grass[0] : P.grass[1];
        ctx.fillStyle = lg(ctx, x0, y0, x0, y0 + info.rowH, [0, shade(base, 0.04), 1, shade(base, -0.05)]);
        ctx.fillRect(x0, y0, COL_W, info.rowH);
        for (let i = 0; i < 130; i++) {
          const x = x0 + rand2() * COL_W, y = y0 + rand2() * info.rowH;
          const h = 3 + rand2() * 5;
          ctx.strokeStyle = rand2() > 0.55 ? `rgba(20,60,10,${0.12 + rand2() * 0.15})` : `rgba(210,255,160,${0.08 + rand2() * 0.12})`;
          ctx.lineWidth = 1.1;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + (rand2() - 0.5) * 3, y - h);
          ctx.stroke();
        }
        if (rand2() > 0.7) {
          const x = x0 + 12 + rand2() * (COL_W - 24), y = y0 + 12 + rand2() * (info.rowH - 24);
          for (let k = 0; k < 3; k++) {
            C(ctx, x + Math.cos(k * 2.1) * 3, y + Math.sin(k * 2.1) * 3, 2.8);
            ctx.fillStyle = shade(base, -0.18);
            ctx.fill();
          }
        }
        if (!nightEnv(env) && rand2() > 0.82) {
          const x = x0 + 10 + rand2() * (COL_W - 20), y = y0 + 10 + rand2() * (info.rowH - 20);
          for (let k = 0; k < 5; k++) {
            C(ctx, x + Math.cos(k * 1.256) * 2.6, y + Math.sin(k * 1.256) * 2.6, 1.8);
            ctx.fillStyle = "#ffffff";
            ctx.fill();
          }
          C(ctx, x, y, 1.4);
          ctx.fillStyle = "#ffd23a";
          ctx.fill();
        }
      }
    }
    if (!dirtOnly) {
      ctx.save();
      for (let r = 0; r < info.rows; r++) {
        if (info.water.includes(r)) continue;
        const y0 = LAWN_TOP + r * info.rowH;
        ctx.fillStyle = "rgba(0,0,0,0.05)";
        ctx.fillRect(LAWN_X, y0 + info.rowH - 3, COLS * COL_W, 3);
      }
      ctx.restore();
    }
  }
  function paintPool(ctx, env, rand2) {
    const info = envInfo(env);
    const y0 = LAWN_TOP + info.water[0] * info.rowH;
    const y1 = LAWN_TOP + (info.water[info.water.length - 1] + 1) * info.rowH;
    rr(ctx, POOL_X0 - 14, y0 - 12, POOL_X1 - POOL_X0 + 28, y1 - y0 + 24, 18);
    fs(ctx, lg(ctx, 0, y0 - 12, 0, y1 + 12, nightEnv(env) ? [0, "#9a9aa8", 1, "#7a7a88"] : [0, "#f2eee4", 1, "#cfc8b8"]), "#5a5a64", 2);
    for (let x = POOL_X0; x < POOL_X1; x += 40) {
      ctx.strokeStyle = "rgba(120,110,90,0.35)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y0 - 12);
      ctx.lineTo(x, y0);
      ctx.moveTo(x, y1);
      ctx.lineTo(x, y1 + 12);
      ctx.stroke();
    }
    rr(ctx, POOL_X0, y0, POOL_X1 - POOL_X0, y1 - y0, 10);
    const wc = nightEnv(env) ? ["#1e6a8a", "#175a7a", "#104a66"] : ["#3ab4e0", "#2a9ed0", "#1f84b8"];
    fs(ctx, lg(ctx, 0, y0, 0, y1, [0, wc[0], 0.5, wc[1], 1, wc[2]]), "#0e4a60", 2);
    ctx.save();
    rr(ctx, POOL_X0, y0, POOL_X1 - POOL_X0, y1 - y0, 10);
    ctx.clip();
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1.5;
    for (let x = POOL_X0; x < POOL_X1; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, y0);
      ctx.lineTo(x, y1);
      ctx.stroke();
    }
    for (let y = y0; y < y1; y += 32) {
      ctx.beginPath();
      ctx.moveTo(POOL_X0, y);
      ctx.lineTo(POOL_X1, y);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(20,60,120,0.35)";
    ctx.lineWidth = 6;
    const mid = (y0 + y1) / 2;
    ctx.beginPath();
    ctx.moveTo(POOL_X0 + 30, mid);
    ctx.lineTo(POOL_X1 - 30, mid);
    ctx.stroke();
    ctx.fillStyle = "rgba(0,30,60,0.18)";
    ctx.fillRect(POOL_X0, y0, POOL_X1 - POOL_X0, 10);
    ctx.restore();
    ctx.lineCap = "round";
    for (const x of [POOL_X1 - 26, POOL_X1 - 50]) {
      ctx.strokeStyle = "#6a7a84";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(x, y0 + 30);
      ctx.lineTo(x, y0 - 4);
      ctx.quadraticCurveTo(x, y0 - 18, x + 12, y0 - 18);
      ctx.stroke();
      ctx.strokeStyle = "#e8eef2";
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }
  function paintHouse(ctx, env, rand2, lawnBottom) {
    const P = nightEnv(env) ? PAL.night : PAL.day;
    const H2 = 720;
    const wx0 = WORLD_MIN_X, wx1 = 128;
    ctx.fillStyle = lg(ctx, wx0, 0, wx1, 0, [0, P.wall[0], 0.8, P.wall[0], 1, P.wall[1]]);
    ctx.fillRect(wx0, 0, wx1 - wx0, H2);
    ctx.strokeStyle = P.wallLine;
    ctx.lineWidth = 1.5;
    for (let y = 96; y < H2; y += 15) {
      ctx.beginPath();
      ctx.moveTo(wx0, y);
      ctx.lineTo(wx1, y);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    for (let y = 97; y < H2; y += 15) ctx.fillRect(wx0, y, wx1 - wx0, 2);
    ctx.beginPath();
    ctx.moveTo(wx0, 0);
    ctx.lineTo(wx1 + 70, 0);
    ctx.lineTo(wx1 + 40, 86);
    ctx.lineTo(wx0, 86);
    ctx.closePath();
    fs(ctx, lg(ctx, 0, 0, 0, 86, [0, P.roof[0], 1, P.roof[1]]));
    ctx.strokeStyle = "rgba(0,0,0,0.3)";
    ctx.lineWidth = 1.2;
    for (let y = 10; y < 86; y += 12) {
      for (let x = wx0 + y / 12 % 2 * 12; x < wx1 + 60; x += 24) {
        ctx.beginPath();
        ctx.arc(x, y, 12, 0.1 * Math.PI, 0.9 * Math.PI);
        ctx.stroke();
      }
    }
    ctx.fillStyle = P.trim;
    ctx.fillRect(wx0, 84, wx1 + 44 - wx0, 9);
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(wx0, 93, wx1 + 44 - wx0, 8);
    const win = (x, y, w, h) => {
      rr(ctx, x - 6, y - 6, w + 12, h + 12, 3);
      fs(ctx, P.trim, "rgba(0,0,0,0.3)", 1.5);
      ctx.fillStyle = lg(ctx, x, y, x + w, y + h, [0, P.window[0], 1, P.window[1]]);
      ctx.fillRect(x, y, w, h);
      if (nightEnv(env)) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = rg(ctx, x + w / 2, y + h / 2, 5, x + w / 2, y + h / 2, w * 1.4, [0, "rgba(255,200,90,0.35)", 1, "rgba(255,160,40,0)"]);
        ctx.fillRect(x - w, y - h, w * 3, h * 3);
        ctx.restore();
        ctx.fillStyle = "rgba(140,40,40,0.55)";
        ctx.fillRect(x, y, w * 0.22, h);
        ctx.fillRect(x + w * 0.78, y, w * 0.22, h);
      } else {
        ctx.fillStyle = "rgba(255,255,255,0.45)";
        ctx.beginPath();
        ctx.moveTo(x + 6, y + h - 6);
        ctx.lineTo(x + w * 0.4, y + 6);
        ctx.lineTo(x + w * 0.55, y + 6);
        ctx.lineTo(x + 18, y + h - 6);
        ctx.fill();
      }
      ctx.fillStyle = P.trim;
      ctx.fillRect(x + w / 2 - 2, y, 4, h);
      ctx.fillRect(x, y + h / 2 - 2, w, 4);
      ctx.fillStyle = shade(P.trim, -0.2);
      ctx.fillRect(x - 10, y + h + 6, w + 20, 7);
    };
    win(-170, 150, 90, 100);
    win(-170, 520, 90, 100);
    const dx = -40, dy = 300, dw = 110, dh = 190;
    rr(ctx, dx - 10, dy - 10, dw + 20, dh + 10, 4);
    fs(ctx, P.trim, "rgba(0,0,0,0.3)", 1.5);
    ctx.fillStyle = lg(ctx, dx, 0, dx + dw, 0, [0, P.door[0], 1, P.door[1]]);
    ctx.fillRect(dx, dy, dw, dh);
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 2;
    ctx.strokeRect(dx + 12, dy + 14, dw - 24, 70);
    ctx.strokeRect(dx + 12, dy + 100, dw - 24, 76);
    C(ctx, dx + dw - 16, dy + 100, 5);
    fs(ctx, "#e8c860", "#6a5010", 1.2);
    rr(ctx, dx + 5, dy + dh + 4, dw - 10, 16, 3);
    fs(ctx, "#a8503a", "#5a2a1a", 1.2);
    const px0 = wx1, px1 = LAWN_X - 12;
    ctx.fillStyle = lg(ctx, px0, 0, px1, 0, [0, P.deck[1], 0.15, P.deck[0], 1, P.deck[0]]);
    ctx.fillRect(px0, 93, px1 - px0, H2 - 93);
    ctx.strokeStyle = "rgba(0,0,0,0.28)";
    ctx.lineWidth = 1.5;
    for (let x = px0 + 20; x < px1; x += 20) {
      ctx.beginPath();
      ctx.moveTo(x, 93);
      ctx.lineTo(x, H2);
      ctx.stroke();
    }
    for (let i = 0; i < 26; i++) {
      const x = px0 + 20 * Math.floor(rand2() * 6), y = 100 + rand2() * 600;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 20, y);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillRect(px0, 93, px1 - px0, 18);
    for (const y of [120, lawnBottom - 10]) {
      ctx.fillStyle = lg(ctx, px0 + 4, 0, px0 + 26, 0, [0, P.trim, 1, shade(P.trim, -0.25)]);
      ctx.fillRect(px0 + 4, y - 30, 22, 40);
    }
  }
  var cache = /* @__PURE__ */ new Map();
  function getBackground(env, dirt = false) {
    const scale = display.cacheScale;
    const key = env + (dirt ? "-dirt" : "") + "@" + scale;
    let c = cache.get(key);
    if (c) {
      cache.delete(key);
      cache.set(key, c);
      return c;
    }
    const buf = display.makeCanvas(WORLD_W, 720, scale);
    const rand2 = mulberry32(env === "night" ? 777 : env === "pool" ? 555 : env === "fog" ? 999 : 123);
    paintWorld(buf.ctx, env, rand2, { dirt });
    cache.set(key, buf);
    for (const k of cache.keys()) if (!k.endsWith("@" + scale)) cache.delete(k);
    while (cache.size > 4) {
      const old = cache.keys().next().value;
      const cv = cache.get(old).canvas;
      cv.width = cv.height = 1;
      cache.delete(old);
    }
    return buf;
  }
  function drawWaterOverlay(ctx, env, t) {
    const info = envInfo(env);
    if (!info.water.length) return;
    const y0 = LAWN_TOP + info.water[0] * info.rowH;
    const y1 = LAWN_TOP + (info.water[info.water.length - 1] + 1) * info.rowH;
    ctx.save();
    rr(ctx, POOL_X0, y0, POOL_X1 - POOL_X0, y1 - y0, 10);
    ctx.clip();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = "rgba(200,245,255,0.22)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 14; i++) {
      const yy = y0 + 8 + i / 14 * (y1 - y0 - 16);
      ctx.beginPath();
      for (let x = POOL_X0; x <= POOL_X1; x += 20) {
        const y = yy + Math.sin(x * 0.03 + t * 1.6 + i * 1.7) * 4 + Math.sin(x * 0.011 - t + i) * 3;
        if (x === POOL_X0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.globalAlpha = 0.35 + 0.3 * Math.sin(t * 0.7 + i);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (let i = 0; i < 30; i++) {
      const x = POOL_X0 + (i * 97 + t * 14 * (i % 3 + 1)) % (POOL_X1 - POOL_X0);
      const y = y0 + i * 53 % (y1 - y0);
      const a = 0.5 + 0.5 * Math.sin(t * 3 + i);
      ctx.fillStyle = `rgba(255,255,255,${0.25 * a})`;
      E(ctx, x, y, 7, 1.6);
      ctx.fill();
    }
    ctx.restore();
  }
  function drawNightOverlay(ctx, t) {
    ctx.save();
    for (let i = 0; i < 7; i++) {
      const x = 900 + (i * 180 + t * 12) % 900;
      const y = 180 + i * 80 + Math.sin(t * 0.3 + i) * 20;
      ctx.globalAlpha = 0.07;
      E(ctx, x, y, 160, 40);
      ctx.fillStyle = "#c8d4ff";
      ctx.fill();
    }
    ctx.restore();
  }
  function drawCloudShadows(ctx, t) {
    ctx.save();
    ctx.fillStyle = "rgba(10,40,0,0.07)";
    for (let i = 0; i < 3; i++) {
      const x = (t * (9 + i * 3) + i * 700) % 2200 - 500;
      const y = 220 + i * 170 + Math.sin(t * 0.05 + i) * 30;
      for (let k = 0; k < 4; k++) {
        E(ctx, x + k * 70, y + Math.sin(k * 2.1 + i) * 20, 110 - k * 10, 50 - k * 4);
        ctx.fill();
      }
    }
    ctx.restore();
  }
  function drawVignette(ctx, camX) {
    ctx.save();
    const g = ctx.createRadialGradient(camX + 700, 400, 260, camX + 700, 400, 860);
    g.addColorStop(0, "rgba(0,0,20,0)");
    g.addColorStop(1, "rgba(0,0,20,0.45)");
    ctx.fillStyle = g;
    ctx.fillRect(camX, 0, 1280, 720);
    ctx.restore();
  }

  // src/gfx/plantArt.js
  var PEA = { light: "#c9f58a", mid: "#72cf3f", dark: "#3d8f1e", outline: "#1d4a0b", leaf: "#62c035", leafLight: "#9be35f", stem: "#5bb52f", mouth: "#1c3a0c" };
  var SNOW = { light: "#f0fcff", mid: "#9cdcf7", dark: "#3f95cc", outline: "#15486e", leaf: "#6fc6b0", leafLight: "#b5ecde", stem: "#62b8a2", mouth: "#12324d" };
  var REP = { light: "#b3ea6d", mid: "#58b52c", dark: "#2c7412", outline: "#143d06", leaf: "#4fa82a", leafLight: "#86d24e", stem: "#4aa326", mouth: "#11300a" };
  var LEAF = "#5fbd34";
  var LEAF_L = "#9ee463";
  var LEAF_O = "#1f4d0f";
  var SHROOM_STEM = ["#fbf2dc", "#d8c39a", "#6b5530"];
  function groundLeaves(ctx, t, o = {}) {
    const len = o.len || 28, wid = o.wid || 9;
    const fill = o.fill || LEAF, light = o.light || LEAF_L, stroke = o.stroke || LEAF_O;
    const sway = Math.sin(t * 1.7) * 0.04;
    ctx.save();
    ctx.scale(1, 0.48);
    const back = o.back ?? [-0.35, -2.8];
    for (const a of back) leaf(ctx, 0, -4, a + sway, len * 0.85, wid * 0.9, shadeLeaf(fill), stroke, { light: fill });
    const front = o.front ?? [0.25, 1.05, 2.1, 2.9];
    for (const a of front) leaf(ctx, 0, -4, a - sway, len, wid, fill, stroke, { light });
    ctx.restore();
  }
  var shadeLeaf = (c) => c === LEAF ? "#3f8f22" : c;
  function unionShapes(ctx, shapes, stroke, lw) {
    ctx.lineJoin = "round";
    for (const s of shapes) {
      s.path();
      ctx.lineWidth = lw * 2;
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
    for (const s of shapes) {
      s.path();
      ctx.fillStyle = s.fill;
      ctx.fill();
    }
  }
  function shooterHead(ctx, v, recoil, o = {}) {
    const r = o.r || 21;
    const sl = (o.snout || 21) + recoil * 5;
    const sr = (o.mouth || 10) + recoil * 3.2;
    const bodyFill = rg(ctx, -r * 0.4, -r * 0.45, r * 0.1, 0, 0, r * 1.1, [0, v.light, 0.55, v.mid, 1, v.dark]);
    const snoutFill = lg(ctx, 0, -sr, 0, sr, [0, v.light, 0.5, v.mid, 1, v.dark]);
    unionShapes(ctx, [
      { path: () => C(ctx, 0, 0, r), fill: bodyFill },
      {
        path: () => {
          ctx.beginPath();
          ctx.moveTo(r * 0.2, -r * 0.55);
          ctx.quadraticCurveTo(r * 0.6 + sl * 0.5, -sr * 0.9, r * 0.35 + sl, -sr);
          ctx.lineTo(r * 0.35 + sl, sr);
          ctx.quadraticCurveTo(r * 0.6 + sl * 0.5, sr * 0.9, r * 0.2, r * 0.55);
          ctx.closePath();
        },
        fill: snoutFill
      }
    ], v.outline, 2.1);
    const mx = r * 0.35 + sl;
    E(ctx, mx, 0, sr * 0.45, sr);
    fs(ctx, rg(ctx, mx + 2, 0, 1, mx, 0, sr, [0, "#000", 1, v.mouth]), v.outline, 2);
    E(ctx, mx - sr * 0.12, 0, sr * 0.45 + 2.5, sr + 1.5);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = v.mid;
    ctx.globalAlpha *= 0.6;
    ctx.stroke();
    ctx.globalAlpha /= 0.6;
    ctx.save();
    ctx.globalAlpha *= 0.55;
    E(ctx, -r * 0.35, -r * 0.5, r * 0.35, r * 0.2, -0.5);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.restore();
  }
  function peaFamily(ctx, s, v, kind) {
    const t = s.t + (s.phase || 0);
    const sway = Math.sin(t * 2.3);
    const sh2 = s.shoot || 0;
    const recoil = sh2 > 0 ? Math.sin(Math.min(1, sh2) * Math.PI) : 0;
    shadow(ctx, 0, 0, 30, 9, 0.3);
    groundLeaves(ctx, t, { fill: v.leaf, light: v.leafLight, stroke: v.outline });
    const hx = sway * 2.6 - recoil * 6;
    const hy = -54 + recoil * 2;
    tube(ctx, [0, -2, 3, -20, hx - 7, hy + 22, hx - 3, hy + 8], 7.5, v.stem, v.outline, 2);
    leaf(ctx, 1, -18, -2.5 + sway * 0.05, 16, 5.5, v.leaf, v.outline, { light: v.leafLight });
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(sway * 0.035 - recoil * 0.1);
    if (kind === "repeater") {
      for (let i = 0; i < 4; i++) {
        const a = Math.PI + 0.9 - i * 0.45 + Math.sin(t * 3 + i) * 0.06;
        leaf(ctx, -12, -6, a, 20 - i * 1.5, 6, v.leaf, v.outline, { light: v.leafLight });
      }
    } else if (kind === "snow") {
      for (let i = 0; i < 5; i++) {
        const a = Math.PI + 1.1 - i * 0.48;
        ctx.save();
        ctx.translate(-10, -4);
        ctx.rotate(a);
        ctx.beginPath();
        ctx.moveTo(0, -5);
        ctx.lineTo(22 - i % 2 * 6, 0);
        ctx.lineTo(0, 5);
        ctx.closePath();
        fs(ctx, lg(ctx, 0, 0, 22, 0, [0, "#c6ecff", 1, "#ffffff"]), "#3d86b8", 1.6);
        ctx.restore();
      }
    } else {
      leaf(ctx, -15, -8, Math.PI + 0.55 + Math.sin(t * 2.5) * 0.08, 17, 6, v.leaf, v.outline, { light: v.leafLight });
    }
    shooterHead(ctx, v, recoil);
    const blink = Math.sin(t * 0.9) > 0.985 ? 0.15 : 1;
    ctx.save();
    ctx.translate(3, -7);
    ctx.scale(1, blink);
    eye(ctx, 0, 0, 6.5, 8, 2, 0.5, { pupil: 0.52 });
    ctx.restore();
    if (kind === "repeater") {
      ctx.beginPath();
      ctx.moveTo(-5, -18);
      ctx.lineTo(10, -13);
      ctx.lineWidth = 3.4;
      ctx.strokeStyle = v.outline;
      ctx.lineCap = "round";
      ctx.stroke();
    }
    if (kind === "snow") {
      ctx.globalAlpha *= 0.8;
      star(ctx, -9, 8, 3.5, 1.2, 4, t);
      ctx.fillStyle = "#fff";
      ctx.fill();
      ctx.globalAlpha /= 0.8;
    }
    ctx.restore();
  }
  function peashooter(ctx, s) {
    peaFamily(ctx, s, PEA, "pea");
  }
  function snowpea(ctx, s) {
    peaFamily(ctx, s, SNOW, "snow");
  }
  function repeater(ctx, s) {
    peaFamily(ctx, s, REP, "repeater");
  }
  function threepeater(ctx, s) {
    const t = s.t + (s.phase || 0);
    const sway = Math.sin(t * 2.1);
    const sh2 = s.shoot || 0;
    const recoil = sh2 > 0 ? Math.sin(Math.min(1, sh2) * Math.PI) : 0;
    const v = PEA;
    shadow(ctx, 0, 0, 32, 10, 0.3);
    groundLeaves(ctx, t);
    const heads = [
      { x: -16 + sway * 2, y: -50, r: 15.5, ph: 0.4 },
      { x: 16 + sway * 2, y: -46, r: 15.5, ph: 0.8 },
      { x: 1 + sway * 3, y: -80, r: 16.5, ph: 0 }
    ];
    for (const h of heads) tube(ctx, [0, -2, 0, -24, h.x - 4, h.y + 16, h.x - 2, h.y + 6], 6.5, v.stem, v.outline, 2);
    leaf(ctx, 0, -20, -2.4, 15, 5, v.leaf, v.outline, { light: v.leafLight });
    leaf(ctx, 0, -24, -0.6, 14, 5, v.leaf, v.outline, { light: v.leafLight });
    for (const h of heads) {
      const rc = recoil * (0.7 + h.ph * 0.3);
      ctx.save();
      ctx.translate(h.x - rc * 4, h.y);
      ctx.rotate(Math.sin(t * 2.3 + h.ph) * 0.05);
      leaf(ctx, -h.r * 0.6, -h.r * 0.4, Math.PI + 0.6, h.r * 0.85, 5, v.leaf, v.outline, { light: v.leafLight });
      shooterHead(ctx, v, rc, { r: h.r, snout: h.r * 0.95, mouth: h.r * 0.46 });
      eye(ctx, 2, -5, 5, 6.2, 1.5, 0.5, { pupil: 0.52 });
      ctx.restore();
    }
  }
  function sunflower(ctx, s) {
    const t = s.t + (s.phase || 0);
    const sway = Math.sin(t * 1.9);
    shadow(ctx, 0, 0, 30, 9, 0.3);
    groundLeaves(ctx, t, { len: 30 });
    const hx = sway * 3.5, hy = -60 + Math.cos(t * 3.8) * 1.2;
    tube(ctx, [0, -2, 4, -22, hx - 6, hy + 26, hx, hy + 10], 7, "#5cb52f", LEAF_O, 2);
    leaf(ctx, 2, -24, -0.45 + sway * 0.05, 20, 7, LEAF, LEAF_O, { light: LEAF_L });
    leaf(ctx, 1, -16, Math.PI + 0.5 - sway * 0.05, 18, 6, LEAF, LEAF_O, { light: LEAF_L });
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(sway * 0.06);
    const glow = s.glow || 0;
    if (glow > 0) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha *= glow * 0.8;
      C(ctx, 0, 0, 46);
      ctx.fillStyle = rg(ctx, 0, 0, 5, 0, 0, 46, [0, "rgba(255,240,120,1)", 1, "rgba(255,200,0,0)"]);
      ctx.fill();
      ctx.restore();
    }
    const wob = Math.sin(t * 1.4) * 0.05;
    for (let layer = 0; layer < 2; layer++) {
      const n = 13;
      const len = layer === 0 ? 17 : 15;
      const col = layer === 0 ? ["#ffc21a", "#e59400"] : ["#fff06a", "#ffc81e"];
      for (let i = 0; i < n; i++) {
        const a = i / n * TAU + (layer ? Math.PI / n : 0) + wob;
        ctx.save();
        ctx.rotate(a);
        ctx.translate(17 + len * 0.45, 0);
        E(ctx, 0, 0, len * 0.62, 6.2);
        fs(ctx, lg(ctx, -len * 0.6, 0, len * 0.6, 0, [0, col[1], 1, col[0]]), "#b87400", 1.3);
        ctx.restore();
      }
    }
    C(ctx, 0, 0, 19.5);
    fs(ctx, rg(ctx, -5, -6, 2, 0, 0, 20, [0, "#e9a043", 0.6, "#c06f1e", 1, "#8c4610"]), "#5e2f08", 2);
    ctx.save();
    ctx.globalAlpha *= 0.25;
    for (let i = 0; i < 14; i++) {
      const a = i * 2.4, r = 6 + i % 4 * 3;
      C(ctx, Math.cos(a) * r, Math.sin(a) * r, 1.1);
      ctx.fillStyle = "#4a2204";
      ctx.fill();
    }
    ctx.restore();
    const blink = Math.sin(t * 0.8 + 1) > 0.985 ? 0.15 : 1;
    for (const ex of [-6.5, 6.5]) {
      ctx.save();
      ctx.translate(ex, -3.5);
      ctx.scale(1, blink);
      E(ctx, 0, 0, 3.2, 4.8);
      ctx.fillStyle = "#2a1204";
      ctx.fill();
      C(ctx, -0.9, -1.8, 1.2);
      ctx.fillStyle = "#fff";
      ctx.fill();
      ctx.restore();
    }
    ctx.beginPath();
    ctx.arc(0, 2, 8, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = "#3a1804";
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.globalAlpha *= 0.45;
    E(ctx, -11.5, 4.5, 3.6, 2.2);
    ctx.fillStyle = "#ff7a6a";
    ctx.fill();
    E(ctx, 11.5, 4.5, 3.6, 2.2);
    ctx.fill();
    ctx.restore();
  }
  function nutBody(ctx, s, o) {
    const t = s.t + (s.phase || 0);
    const { rx, ry, cy } = o;
    const dmg = s.dmg || 0;
    const squash2 = 1 + Math.sin(t * 1.5) * 0.012;
    ctx.save();
    ctx.translate(0, cy);
    ctx.scale(2 - squash2, squash2);
    const light = o.light || "#e8c07a", mid = o.mid || "#c28a45", dark = o.dark || "#8a5a24", stroke = o.stroke || "#553310";
    const pts = [];
    const n = 14;
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU;
      const wob = 1 + Math.sin(i * 2.7) * 0.025 + (dmg >= 2 && i === 2 ? -0.12 : 0) + (dmg >= 2 && i === 3 ? -0.08 : 0);
      pts.push(Math.cos(a) * rx * wob, Math.sin(a) * ry * wob);
    }
    blob(ctx, pts);
    fs(ctx, rg(ctx, -rx * 0.35, -ry * 0.45, 2, 0, 0, Math.max(rx, ry) * 1.1, [0, light, 0.55, mid, 1, dark]), stroke, 2.6);
    ctx.save();
    blob(ctx, pts);
    ctx.clip();
    ctx.globalAlpha *= 0.35;
    ctx.strokeStyle = "#6b4216";
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      const yy = -ry * 0.75 + i * ry * 0.38;
      ctx.moveTo(-rx * 0.95, yy + Math.sin(i) * 4);
      ctx.quadraticCurveTo(-rx * 0.6, yy - 6, -rx * 0.35, yy + 3);
      ctx.moveTo(rx * 0.95, yy + Math.cos(i) * 4);
      ctx.quadraticCurveTo(rx * 0.6, yy - 5, rx * 0.4, yy + 4);
      ctx.stroke();
    }
    for (let i = 0; i < 12; i++) {
      C(ctx, Math.sin(i * 7.3) * rx * 0.8, Math.cos(i * 3.1) * ry * 0.8, 1.2);
      ctx.fillStyle = "#5a3510";
      ctx.fill();
    }
    ctx.restore();
    if (dmg >= 1) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      ctx.lineJoin = "miter";
      ctx.beginPath();
      ctx.moveTo(rx * 0.1, -ry * 0.98);
      ctx.lineTo(rx * 0.22, -ry * 0.7);
      ctx.lineTo(rx * 0.05, -ry * 0.55);
      ctx.lineTo(rx * 0.25, -ry * 0.35);
      ctx.moveTo(-rx * 0.9, ry * 0.2);
      ctx.lineTo(-rx * 0.65, ry * 0.25);
      ctx.lineTo(-rx * 0.55, ry * 0.45);
      ctx.stroke();
    }
    if (dmg >= 2) {
      ctx.beginPath();
      ctx.moveTo(rx * 0.7, -ry * 0.7);
      ctx.lineTo(rx * 0.45, -ry * 0.55);
      ctx.lineTo(rx * 0.55, -ry * 0.3);
      ctx.lineTo(rx * 0.35, -ry * 0.1);
      ctx.moveTo(-rx * 0.3, ry * 0.95);
      ctx.lineTo(-rx * 0.2, ry * 0.7);
      ctx.lineTo(-rx * 0.35, ry * 0.55);
      ctx.stroke();
      ctx.save();
      ctx.globalAlpha *= 0.3;
      E(ctx, rx * 0.55, -ry * 0.62, rx * 0.25, ry * 0.12, -0.7);
      ctx.fillStyle = "#3a2208";
      ctx.fill();
      ctx.restore();
    }
    ctx.save();
    ctx.globalAlpha *= 0.35;
    E(ctx, -rx * 0.4, -ry * 0.55, rx * 0.28, ry * 0.14, -0.6);
    ctx.fillStyle = "#fff6d8";
    ctx.fill();
    ctx.restore();
    ctx.restore();
    return { t, dmg };
  }
  function nutFace(ctx, t, dmg, x, y, size, look = 0) {
    const lx = Math.sin(t * 0.7) * 1.8 + look;
    const ly = Math.cos(t * 0.5) * 0.8;
    const blink = Math.sin(t * 0.6 + 2) > 0.985 ? 0.12 : 1;
    for (const ex of [-8.5 * size, 8.5 * size]) {
      ctx.save();
      ctx.translate(x + ex, y);
      ctx.scale(1, blink * (dmg >= 2 ? 0.75 : 1));
      eye(ctx, 0, 0, 7 * size, 8.5 * size, lx, ly + (dmg >= 2 ? 2 : 0), { pupil: 0.45 });
      ctx.restore();
    }
    ctx.strokeStyle = "#3e2408";
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    if (dmg >= 1) {
      ctx.beginPath();
      ctx.moveTo(x - 14 * size, y - 10 * size);
      ctx.lineTo(x - 4 * size, y - 13 * size);
      ctx.moveTo(x + 14 * size, y - 10 * size);
      ctx.lineTo(x + 4 * size, y - 13 * size);
      ctx.stroke();
    }
    ctx.beginPath();
    if (dmg >= 2) ctx.arc(x, y + 18 * size, 6 * size, 1.15 * Math.PI, 1.85 * Math.PI);
    else if (dmg === 1) {
      ctx.moveTo(x - 5 * size, y + 14 * size);
      ctx.lineTo(x + 5 * size, y + 14 * size);
    } else ctx.arc(x, y + 10 * size, 5 * size, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.stroke();
  }
  function wallnut(ctx, s) {
    shadow(ctx, 0, 0, 32, 10, 0.32);
    const { t, dmg } = nutBody(ctx, s, { rx: 30, ry: 36, cy: -36 });
    nutFace(ctx, t, dmg, 2, -44, 1, s.look || 0);
  }
  function tallnut(ctx, s) {
    shadow(ctx, 0, 0, 34, 10, 0.32);
    const { t, dmg } = nutBody(ctx, s, { rx: 32, ry: 58, cy: -56, light: "#e3b877", mid: "#b88040", dark: "#7c4e1c" });
    ctx.save();
    ctx.globalAlpha *= 0.3;
    for (let i = 0; i < 6; i++) {
      E(ctx, Math.sin(i * 2.1) * 18, -30 - i * 11, 7, 4, i);
      ctx.fillStyle = "#6b4015";
      ctx.fill();
    }
    ctx.restore();
    nutFace(ctx, t, dmg, 2, -82, 1, s.look || 0);
  }
  function bowlnut(ctx, s, kind = "normal") {
    const rot = s.roll || 0;
    const big = kind === "giant" ? 1.9 : 1;
    shadow(ctx, 0, 0, 32 * big, 9 * big, 0.3);
    ctx.save();
    ctx.translate(0, -32 * big);
    ctx.rotate(rot);
    ctx.scale(big, big);
    ctx.translate(0, 32);
    const o = kind === "explode" ? { rx: 30, ry: 32, cy: -32, light: "#ff9a7a", mid: "#e04a2a", dark: "#901808", stroke: "#4a0800" } : { rx: 30, ry: 32, cy: -32 };
    const { t } = nutBody(ctx, { t: 0, phase: 0, dmg: 0 }, o);
    nutFace(ctx, t, 0, 2, -40, 1, 1.5);
    if (kind === "explode") {
      ctx.strokeStyle = "#4a0800";
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(-14, -52);
      ctx.lineTo(-3, -48);
      ctx.moveTo(16, -52);
      ctx.lineTo(6, -48);
      ctx.stroke();
    }
    ctx.restore();
  }
  function cherrybomb(ctx, s) {
    const t = s.t + (s.phase || 0);
    const fuse = s.fuse || 0;
    const shake = fuse > 0 ? Math.sin(t * 50) * fuse * 2.5 : 0;
    const sc = 1 + fuse * 0.38;
    shadow(ctx, 0, 0, 34 * sc, 10, 0.3);
    ctx.save();
    ctx.translate(shake, 0);
    ctx.scale(sc, sc);
    const bob = Math.sin(t * 3) * 1.2;
    const cherries = [
      { x: -15, y: -25 + bob, r: 19, ph: 0 },
      { x: 15, y: -23 - bob * 0.7, r: 20, ph: 1 }
    ];
    for (const c of cherries) tube(ctx, [c.x * 0.6, c.y - c.r + 3, c.x * 0.4, c.y - 40, 2, -66, 4, -68], 3.2, "#4f8a22", "#1f3d0a", 1.5);
    leaf(ctx, 4, -68, -0.4 + Math.sin(t * 2) * 0.1, 22, 7, LEAF, LEAF_O, { light: LEAF_L });
    leaf(ctx, 3, -67, Math.PI + 0.9, 14, 5, LEAF, LEAF_O, { light: LEAF_L });
    for (const c of cherries) {
      ball(ctx, c.x, c.y, c.r, fuse > 0.5 ? "#ffb0a0" : "#ff7a66", "#b8001a", "#4a0008", 2.2);
      ctx.save();
      ctx.globalAlpha *= 0.7;
      E(ctx, c.x - c.r * 0.4, c.y - c.r * 0.45, c.r * 0.3, c.r * 0.16, -0.7);
      ctx.fillStyle = "#fff";
      ctx.fill();
      ctx.restore();
      const fx = c.x + 2, fy = c.y + 1;
      eye(ctx, fx - 6, fy - 3, 4.2, 5, 1.2, 0.8, { pupil: 0.5, stroke: "#4a0008" });
      eye(ctx, fx + 5, fy - 3, 4.2, 5, 1.2, 0.8, { pupil: 0.5, stroke: "#4a0008" });
      ctx.strokeStyle = "#3a0006";
      ctx.lineWidth = 2.4;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(fx - 11, fy - 11);
      ctx.lineTo(fx - 3, fy - 7);
      ctx.moveTo(fx + 10, fy - 11);
      ctx.lineTo(fx + 2, fy - 7);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(fx - 6, fy + 7);
      ctx.quadraticCurveTo(fx, fy + 4 - fuse * 2, fx + 6, fy + 7);
      ctx.quadraticCurveTo(fx, fy + 11 + fuse * 3, fx - 6, fy + 7);
      fs(ctx, "#fff", "#3a0006", 1.6);
      line(ctx, fx - 2, fy + 5.5, fx - 2, fy + 9, "#3a0006", 1);
      line(ctx, fx + 2, fy + 5.5, fx + 2, fy + 9, "#3a0006", 1);
    }
    if (fuse > 0) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha *= fuse * (0.4 + 0.3 * Math.sin(t * 30));
      E(ctx, 0, -28, 42, 32);
      ctx.fillStyle = rg(ctx, 0, -28, 5, 0, -28, 42, [0, "#ffffff", 1, "rgba(255,60,30,0)"]);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }
  function potatomine(ctx, s) {
    const t = s.t + (s.phase || 0);
    const rise = s.icon ? 1 : clamp(s.rise || 0, 0, 1);
    shadow(ctx, 0, 0, 30, 8, 0.25);
    E(ctx, 0, -3, 30, 10);
    fs(ctx, rg(ctx, -6, -8, 2, 0, -3, 30, [0, "#9a6a3c", 1, "#5e3a1a"]), "#3a220c", 2);
    if (rise <= 0.01) {
      E(ctx, 0, -8, 13, 6);
      fs(ctx, "#b88a50", "#553310", 1.6);
      tube(ctx, [0, -12, 0, -22], 2.4, "#7a7a70", "#333", 1);
      C(ctx, 0, -24, 3.2);
      fs(ctx, "#8a4040", "#333", 1.2);
      closedEye(ctx, -4, -8, 2.5, "#3a2206", 1.5);
      closedEye(ctx, 4, -8, 2.5, "#3a2206", 1.5);
    } else {
      ctx.save();
      ctx.beginPath();
      ctx.rect(-40, -90, 80, 87);
      ctx.clip();
      const y0 = (1 - Ease_outBack(rise)) * 26;
      ctx.translate(0, y0);
      const bob = Math.sin(t * 4) * 0.8;
      tube(ctx, [0, -32 + bob, 1, -40, 0, -48 + bob], 2.4, "#8c8c80", "#2a2a22", 1.2);
      const on = Math.sin(t * 5) > 0;
      C(ctx, 0, -51 + bob, 4.5);
      fs(ctx, on ? "#ff3a2a" : "#9a2a20", "#3a0a06", 1.5);
      if (on) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        C(ctx, 0, -51 + bob, 12);
        ctx.fillStyle = rg(ctx, 0, -51 + bob, 1, 0, -51 + bob, 12, [0, "rgba(255,120,80,0.9)", 1, "rgba(255,0,0,0)"]);
        ctx.fill();
        ctx.restore();
      }
      E(ctx, 0, -18 + bob, 25, 18);
      fs(ctx, rg(ctx, -8, -28, 2, 0, -18, 28, [0, "#f0c688", 0.6, "#c8914c", 1, "#8c5a24"]), "#553310", 2.2);
      ctx.save();
      ctx.globalAlpha *= 0.4;
      for (const [px, py] of [[-14, -22], [12, -12], [-5, -8], [16, -26]]) {
        E(ctx, px, py + bob, 2.2, 1.5);
        ctx.fillStyle = "#6b4216";
        ctx.fill();
      }
      ctx.restore();
      eye(ctx, -6, -22 + bob, 4.5, 5.5, 1.5, 0.5, { pupil: 0.5 });
      eye(ctx, 7, -22 + bob, 4.5, 5.5, 1.5, 0.5, { pupil: 0.5 });
      ctx.beginPath();
      ctx.arc(1, -14 + bob, 4, 0.2 * Math.PI, 0.8 * Math.PI);
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#3a2206";
      ctx.stroke();
      ctx.restore();
    }
    ctx.save();
    E(ctx, 0, 0, 28, 7);
    fs(ctx, rg(ctx, 0, -4, 2, 0, 0, 28, [0, "#8a5c30", 1, "#5a3818"]), "#3a220c", 1.8);
    for (const [px, py, r] of [[-18, -3, 4], [14, -2, 3.5], [-2, 2, 3], [22, 1, 2.5]]) {
      C(ctx, px, py, r);
      fs(ctx, "#7a4e26", "#3a220c", 1.2);
    }
    ctx.restore();
  }
  function Ease_outBack(t) {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }
  function chomper(ctx, s) {
    const t = s.t + (s.phase || 0);
    const sway = Math.sin(t * 1.8);
    const bite = s.bite || 0;
    const chewing = s.chew || 0;
    shadow(ctx, 0, 0, 32, 10, 0.3);
    groundLeaves(ctx, t, { len: 32, wid: 10 });
    let lunge = 0, open = 0.55 + Math.sin(t * 2.2) * 0.08;
    if (bite > 0) {
      lunge = bite < 0.45 ? Ease_outBack(bite / 0.45) * 24 : 24 * (1 - (bite - 0.45) / 0.55);
      open = bite < 0.3 ? 0.55 + bite * 2.2 : bite < 0.45 ? 1.2 * (1 - (bite - 0.3) / 0.15) : 0;
    }
    if (chewing) open = Math.max(0, Math.sin(t * 7) * 0.12);
    const hx = 10 + sway * 2 + lunge, hy = -70 + (chewing ? Math.sin(t * 7) * 1.5 : 0);
    tube(ctx, [-2, -2, -12, -30, hx - 30, hy + 30, hx - 16, hy + 10], 8, "#56aa2c", LEAF_O, 2);
    leaf(ctx, -6, -28, Math.PI + 0.6, 24, 8, LEAF, LEAF_O, { light: LEAF_L });
    leaf(ctx, -4, -22, -0.3, 22, 7, LEAF, LEAF_O, { light: LEAF_L });
    ctx.save();
    ctx.translate(hx, hy);
    const sc = chewing ? 1.06 + Math.sin(t * 7) * 0.03 : 1;
    ctx.scale(sc, sc);
    const hinge = -24;
    const up = { light: "#d88af0", mid: "#9a3fbf", dark: "#5e1a82", stroke: "#2e0848" };
    if (open > 0.05) {
      ctx.save();
      ctx.translate(hinge, 0);
      E(ctx, 26, 2, 26, 6 + open * 16);
      ctx.fillStyle = rg(ctx, 20, 2, 2, 26, 2, 28, [0, "#2a0018", 1, "#7a1a3a"]);
      ctx.fill();
      E(ctx, 18, 6 + open * 6, 12, 4 + open * 3);
      fs(ctx, "#ff6a8a", "#7a1030", 1.5);
      ctx.restore();
    }
    ctx.save();
    ctx.translate(hinge, 4);
    ctx.rotate(open * 0.5);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(6, 22, 44, 22, 52, 0);
    ctx.closePath();
    fs(ctx, lg(ctx, 0, 0, 0, 20, [0, up.mid, 1, up.dark]), up.stroke, 2.2);
    teeth(ctx, 14, 0, 50, 0, 5, -6, 1, "#fffbe8", "#6a5a50");
    ctx.restore();
    ctx.save();
    ctx.translate(hinge, 0);
    ctx.rotate(-open * 0.55);
    ctx.beginPath();
    ctx.moveTo(-4, 4);
    ctx.bezierCurveTo(-6, -40, 50, -44, 58, 2);
    ctx.quadraticCurveTo(30, 6, -4, 4);
    ctx.closePath();
    fs(ctx, rg(ctx, 14, -20, 3, 22, -8, 42, [0, up.light, 0.6, up.mid, 1, up.dark]), up.stroke, 2.4);
    teeth(ctx, 16, 3.5, 56, 2, 6, 7, 1, "#fffbe8", "#6a5a50");
    ctx.globalAlpha *= 0.55;
    for (const [px, py, r] of [[10, -18, 4], [26, -26, 3.5], [38, -16, 3], [18, -8, 2.5], [2, -8, 2.5]]) {
      C(ctx, px, py, r);
      ctx.fillStyle = "#f0c6ff";
      ctx.fill();
    }
    ctx.restore();
    for (let i = 0; i < 4; i++) leaf(ctx, hinge + 2, 2, Math.PI * 0.5 + 0.5 + i * 0.35, 16, 5, LEAF, LEAF_O, { light: LEAF_L });
    ctx.restore();
  }
  function squash(ctx, s) {
    const t = s.t + (s.phase || 0);
    const squish = s.squish || 0;
    const look = s.lookDir || 0;
    shadow(ctx, 0, 0, 32, 10, 0.3);
    if (!s.airborne) groundLeaves(ctx, t, { len: 22, wid: 8 });
    ctx.save();
    ctx.scale(1 + squish * 0.35, 1 - squish * 0.4);
    const breathe = 1 + Math.sin(t * 2) * 0.015;
    ctx.scale(breathe, 1 / breathe);
    const pts = [-30, -6, -36, -30, -30, -56, -16, -72, 0, -76, 16, -72, 30, -56, 36, -30, 30, -6, 12, 0, -12, 0];
    blob(ctx, pts);
    fs(ctx, rg(ctx, -12, -52, 4, 0, -36, 48, [0, "#c4ec7c", 0.5, "#7ec43e", 1, "#3f8a1c"]), "#1f4a0a", 2.5);
    ctx.save();
    blob(ctx, pts);
    ctx.clip();
    ctx.globalAlpha *= 0.3;
    ctx.strokeStyle = "#2a5e10";
    ctx.lineWidth = 2;
    for (const x of [-18, 0, 18]) {
      ctx.beginPath();
      ctx.moveTo(x * 0.6, -74);
      ctx.quadraticCurveTo(x * 1.4, -38, x * 0.9, 0);
      ctx.stroke();
    }
    ctx.restore();
    tube(ctx, [0, -74, -2, -84, 6, -88], 4, "#7a8a30", "#2e3a0c", 1.5);
    const lx = look * 2.5;
    eye(ctx, -11, -44, 7, 7.5, lx, 1.5, { pupil: 0.55 });
    eye(ctx, 11, -44, 7, 7.5, lx, 1.5, { pupil: 0.55 });
    ctx.fillStyle = "#1f4a0a";
    ctx.beginPath();
    ctx.moveTo(-22, -56);
    ctx.lineTo(-3, -48);
    ctx.lineTo(-4, -44);
    ctx.lineTo(-21, -51);
    ctx.moveTo(22, -56);
    ctx.lineTo(3, -48);
    ctx.lineTo(4, -44);
    ctx.lineTo(21, -51);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-12, -24);
    ctx.quadraticCurveTo(0, -32, 12, -24);
    ctx.quadraticCurveTo(0, -27, -12, -24);
    fs(ctx, "#2a0a04", "#1f4a0a", 2);
    ctx.restore();
  }
  function shroomStem(ctx, x0, y0, w, h, o = {}) {
    const c = o.colors || SHROOM_STEM;
    ctx.beginPath();
    ctx.moveTo(x0 - w * 0.55, y0);
    ctx.quadraticCurveTo(x0 - w * 0.62, y0 - h * 0.5, x0 - w * 0.45, y0 - h);
    ctx.lineTo(x0 + w * 0.45, y0 - h);
    ctx.quadraticCurveTo(x0 + w * 0.62, y0 - h * 0.5, x0 + w * 0.55, y0);
    ctx.quadraticCurveTo(x0, y0 + 4, x0 - w * 0.55, y0);
    ctx.closePath();
    fs(ctx, lg(ctx, x0 - w / 2, 0, x0 + w / 2, 0, [0, c[0], 1, c[1]]), c[2], 2);
  }
  function shroomCap(ctx, x, y, rx, ry, light, dark, stroke, spots, o = {}) {
    ctx.beginPath();
    ctx.moveTo(x - rx, y);
    ctx.bezierCurveTo(x - rx * 1.02, y - ry * 1.35, x + rx * 1.02, y - ry * 1.35, x + rx, y);
    ctx.quadraticCurveTo(x + rx * 0.7, y + ry * 0.28, x, y + ry * 0.25);
    ctx.quadraticCurveTo(x - rx * 0.7, y + ry * 0.28, x - rx, y);
    ctx.closePath();
    fs(ctx, rg(ctx, x - rx * 0.3, y - ry * 0.8, 2, x, y - ry * 0.3, rx * 1.2, [0, light, 1, dark]), stroke, o.lw || 2.2);
    if (spots) {
      ctx.save();
      ctx.clip();
      for (const [sx, sy, sr] of spots) {
        E(ctx, x + sx * rx, y - ry * sy, sr * rx, sr * rx * 0.75);
        ctx.fillStyle = o.spotColor || "rgba(255,255,255,0.55)";
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.save();
    ctx.globalAlpha *= 0.35;
    E(ctx, x - rx * 0.35, y - ry * 0.75, rx * 0.25, ry * 0.15, -0.4);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.restore();
  }
  function sleepyEyes(ctx, s, xs, y, r) {
    if (s.sleep) {
      for (const x of xs) closedEye(ctx, x, y + r * 0.6, r * 0.8, "#2a1a30", 1.8);
      return true;
    }
    return false;
  }
  function zzz(ctx, s, x, y) {
    if (!s.sleep || s.icon) return;
    const t = s.t + (s.phase || 0);
    for (let i = 0; i < 3; i++) {
      const p = (t * 0.5 + i / 3) % 1;
      ctx.save();
      ctx.globalAlpha *= Math.sin(p * Math.PI);
      ctx.font = `900 ${10 + p * 8}px sans-serif`;
      ctx.fillStyle = "#e8f0ff";
      ctx.strokeStyle = "#223";
      ctx.lineWidth = 2.5;
      ctx.textAlign = "center";
      ctx.strokeText("Z", x + p * 16, y - p * 30);
      ctx.fillText("Z", x + p * 16, y - p * 30);
      ctx.restore();
    }
  }
  function sleepTilt(ctx, s) {
    if (s.sleep && !s.icon) {
      const t = s.t + (s.phase || 0);
      ctx.rotate(Math.sin(t * 1.2) * 0.04 - 0.08);
      ctx.scale(1, 0.96 + Math.sin(t * 1.2) * 0.02);
    }
  }
  function puffshroom(ctx, s) {
    const t = s.t + (s.phase || 0);
    const sh2 = s.shoot ? Math.sin(Math.min(1, s.shoot) * Math.PI) : 0;
    shadow(ctx, 0, 0, 20, 6, 0.3);
    ctx.save();
    sleepTilt(ctx, s);
    ctx.scale(1 - sh2 * 0.1, 1 + sh2 * 0.12);
    shroomStem(ctx, 0, 0, 20, 22);
    ctx.save();
    ctx.translate(9, -11);
    tube(ctx, [0, 0, 8 + sh2 * 3, 0], 8 + sh2 * 2, "#e8dcc2", "#6b5530", 1.8);
    E(ctx, 9 + sh2 * 3, 0, 2.5, 4 + sh2);
    ctx.fillStyle = "#2a1a10";
    ctx.fill();
    ctx.restore();
    if (!sleepyEyes(ctx, s, [-3, 4], -13, 3.2)) {
      eye(ctx, -3, -13, 3, 4.2, 1, 0.5, { pupil: 0.6, stroke: "#3a2a20" });
      eye(ctx, 4, -13, 3, 4.2, 1, 0.5, { pupil: 0.6, stroke: "#3a2a20" });
    }
    shroomCap(ctx, 0, -22 + Math.sin(t * 3) * 0.6, 21, 15, "#e4b4ff", "#8a3fb8", "#3e0f5a", [[-0.45, 0.6, 0.18], [0.35, 0.75, 0.14], [0.05, 1, 0.1], [0.65, 0.35, 0.1]]);
    ctx.restore();
    zzz(ctx, s, 12, -40);
  }
  function sunshroom(ctx, s) {
    const t = s.t + (s.phase || 0);
    const g = s.icon ? 1 : 0.62 + 0.38 * clamp(s.grow || 0, 0, 1);
    shadow(ctx, 0, 0, 22 * g, 7 * g, 0.3);
    ctx.save();
    ctx.scale(g, g);
    sleepTilt(ctx, s);
    shroomStem(ctx, 0, 0, 22, 24);
    if (!sleepyEyes(ctx, s, [-4, 5], -14, 3.4)) {
      eye(ctx, -4, -14, 3.2, 4.4, 0.8, 0.5, { pupil: 0.6, stroke: "#4a3010" });
      eye(ctx, 5, -14, 3.2, 4.4, 0.8, 0.5, { pupil: 0.6, stroke: "#4a3010" });
      ctx.beginPath();
      ctx.arc(0.5, -8, 3.5, 0.2 * Math.PI, 0.8 * Math.PI);
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = "#4a3010";
      ctx.stroke();
    }
    shroomCap(ctx, 0, -24 + Math.sin(t * 2.6) * 0.7, 24, 16, "#fff09a", "#e88c10", "#7a3e00", [[-0.5, 0.55, 0.16], [0.3, 0.8, 0.15], [0.7, 0.35, 0.1], [-0.1, 1.05, 0.1]], { spotColor: "rgba(255,250,210,0.75)" });
    if (!s.sleep && !s.icon) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha *= 0.25 + Math.sin(t * 3) * 0.1 + (s.glow || 0) * 0.5;
      C(ctx, 0, -30, 30);
      ctx.fillStyle = rg(ctx, 0, -30, 2, 0, -30, 30, [0, "rgba(255,230,120,1)", 1, "rgba(255,200,0,0)"]);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
    zzz(ctx, s, 14 * g, -44 * g);
  }
  function fumeshroom(ctx, s) {
    const t = s.t + (s.phase || 0);
    const sh2 = s.shoot ? Math.sin(Math.min(1, s.shoot) * Math.PI) : 0;
    shadow(ctx, 0, 0, 30, 9, 0.3);
    ctx.save();
    sleepTilt(ctx, s);
    ctx.scale(1 + sh2 * 0.05, 1 - sh2 * 0.06);
    shroomStem(ctx, -2, 0, 34, 30, { colors: ["#eadcf5", "#b49ac8", "#4a3060"] });
    ctx.save();
    ctx.translate(12, -18);
    const flare = 1 + sh2 * 0.35;
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.quadraticCurveTo(14, -7, 22, -12 * flare);
    ctx.lineTo(22, 12 * flare);
    ctx.quadraticCurveTo(14, 7, 0, 7);
    ctx.closePath();
    fs(ctx, lg(ctx, 0, -12, 0, 12, [0, "#e0c8f0", 1, "#9a78b8"]), "#4a3060", 2);
    E(ctx, 22, 0, 4, 12 * flare);
    fs(ctx, rg(ctx, 23, 0, 1, 22, 0, 12, [0, "#1a0a20", 1, "#5a3a70"]), "#4a3060", 1.8);
    ctx.restore();
    if (!sleepyEyes(ctx, s, [-9, 3], -20, 4)) {
      eye(ctx, -9, -20, 4.4, 5.4, 1.3, 0.8, { pupil: 0.55, stroke: "#3a2050" });
      eye(ctx, 3, -20, 4.4, 5.4, 1.3, 0.8, { pupil: 0.55, stroke: "#3a2050" });
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = "#3a2050";
      ctx.beginPath();
      ctx.moveTo(-15, -28);
      ctx.lineTo(-5, -25);
      ctx.moveTo(8, -28);
      ctx.lineTo(0, -25);
      ctx.stroke();
    }
    shroomCap(ctx, -2, -32 + Math.sin(t * 2.2) * 0.7, 32, 20, "#caa8ec", "#6c3f96", "#2e1248", [[-0.5, 0.5, 0.12], [-0.05, 0.9, 0.14], [0.45, 0.6, 0.11], [0.75, 0.25, 0.08]], { spotColor: "rgba(90,40,130,0.45)" });
    ctx.restore();
    zzz(ctx, s, 16, -56);
  }
  function hypnoshroom(ctx, s) {
    const t = s.t + (s.phase || 0);
    shadow(ctx, 0, 0, 24, 7, 0.3);
    ctx.save();
    sleepTilt(ctx, s);
    shroomStem(ctx, 0, 0, 22, 34, { colors: ["#fff5e8", "#e0c8b0", "#6b4a30"] });
    if (!sleepyEyes(ctx, s, [-5, 5], -22, 4)) {
      for (const ex of [-5, 5]) {
        C(ctx, ex, -22, 4.6);
        fs(ctx, "#fff", "#5a2a40", 1.4);
        ctx.beginPath();
        for (let i = 0; i < 20; i++) {
          const a = i * 0.6 + t * 6, r = i * 0.22;
          const px = ex + Math.cos(a) * r, py = -22 + Math.sin(a) * r;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = "#b01a78";
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(0, -15, 3, 0.2 * Math.PI, 0.8 * Math.PI);
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = "#5a2a40";
      ctx.stroke();
    }
    const cx = 0, cy = -34;
    const capPath = () => {
      ctx.beginPath();
      ctx.moveTo(cx - 25, cy);
      ctx.bezierCurveTo(cx - 28, cy - 34, cx - 10, cy - 50, cx + 2, cy - 50);
      ctx.bezierCurveTo(cx + 14, cy - 50, cx + 28, cy - 32, cx + 25, cy);
      ctx.quadraticCurveTo(cx, cy + 6, cx - 25, cy);
      ctx.closePath();
    };
    ctx.save();
    capPath();
    ctx.clip();
    const cols = ["#ff4fb0", "#ffd23a", "#36d6c0", "#8a5aff", "#ff8a3a"];
    const rot = s.icon ? 0 : t * 1.4;
    for (let i = 0; i < 10; i++) {
      ctx.beginPath();
      ctx.moveTo(cx, cy - 22);
      const a0 = rot + i / 10 * TAU, a1 = rot + (i + 1) / 10 * TAU;
      for (let k = 0; k <= 12; k++) {
        const a = a0 + (a1 - a0) * (k / 12);
        ctx.lineTo(cx + Math.cos(a + 0.7) * 70, cy - 22 + Math.sin(a + 0.7) * 70);
      }
      ctx.closePath();
      ctx.fillStyle = cols[i % cols.length];
      ctx.fill();
    }
    ctx.beginPath();
    for (let i = 0; i < 80; i++) {
      const a = -rot * 2 + i * 0.3, r = i * 0.55;
      const px = cx + Math.cos(a) * r, py = cy - 22 + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.stroke();
    ctx.fillStyle = rg(ctx, cx - 8, cy - 34, 2, cx, cy - 20, 34, [0, "rgba(255,255,255,0.35)", 1, "rgba(60,0,60,0.25)"]);
    ctx.fillRect(cx - 40, cy - 60, 80, 70);
    ctx.restore();
    capPath();
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = "#4a1040";
    ctx.stroke();
    ctx.restore();
    zzz(ctx, s, 14, -80);
  }
  function scaredyshroom(ctx, s) {
    const t = s.t + (s.phase || 0);
    const hide = s.hide || 0;
    const sh2 = s.shoot ? Math.sin(Math.min(1, s.shoot) * Math.PI) : 0;
    const tremble = hide > 0.5 ? Math.sin(t * 60) * 1.2 : 0;
    shadow(ctx, 0, 0, 22, 7, 0.3);
    ctx.save();
    ctx.translate(tremble, 0);
    sleepTilt(ctx, s);
    const h = lerp(52, 14, hide);
    const sway = Math.sin(t * 1.6) * (1 - hide);
    ctx.beginPath();
    ctx.moveTo(-8, 0);
    ctx.quadraticCurveTo(-6 + sway * 2, -h * 0.5, -5 + sway * 3, -h);
    ctx.lineTo(6 + sway * 3, -h);
    ctx.quadraticCurveTo(7 + sway * 2, -h * 0.5, 8, 0);
    ctx.quadraticCurveTo(0, 4, -8, 0);
    fs(ctx, lg(ctx, -8, 0, 8, 0, [0, "#fbf2dc", 1, "#d0b890"]), "#6b5530", 2);
    const hx = sway * 3, hy = -h;
    if (hide < 0.5) {
      ctx.save();
      ctx.translate(hx + 6, hy + 8);
      tube(ctx, [0, 0, 10 + sh2 * 3, -1], 7 + sh2 * 2, "#efe2c8", "#6b5530", 1.6);
      E(ctx, 10 + sh2 * 3, -1, 2.2, 3.6 + sh2);
      ctx.fillStyle = "#2a1a10";
      ctx.fill();
      ctx.restore();
      if (!sleepyEyes(ctx, s, [hx - 3, hx + 4], hy + 6, 3.4)) {
        eye(ctx, hx - 3, hy + 6, 3.4, 4.6, 1, 0, { pupil: 0.55, stroke: "#3a2a20" });
        eye(ctx, hx + 4, hy + 6, 3.4, 4.6, 1, 0, { pupil: 0.55, stroke: "#3a2a20" });
      }
    } else {
      ctx.strokeStyle = "#3a2a20";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(hx - 6, hy + 4);
      ctx.lineTo(hx - 1, hy + 6);
      ctx.lineTo(hx - 6, hy + 8);
      ctx.moveTo(hx + 7, hy + 4);
      ctx.lineTo(hx + 2, hy + 6);
      ctx.lineTo(hx + 7, hy + 8);
      ctx.stroke();
    }
    shroomCap(ctx, hx, hy - 2 + hide * 4, 18 + hide * 4, 13 + hide * 3, "#e0b0f6", "#8e46b8", "#3e0f5a", [[-0.4, 0.6, 0.18], [0.35, 0.8, 0.14], [0.7, 0.3, 0.1]]);
    ctx.restore();
    zzz(ctx, s, 14, -70);
  }
  function iceshroom(ctx, s) {
    const t = s.t + (s.phase || 0);
    const fuse = s.fuse || 0;
    const sc = 1 + fuse * 0.3;
    shadow(ctx, 0, 0, 28, 8, 0.3);
    ctx.save();
    ctx.translate(fuse > 0 ? Math.sin(t * 50) * fuse * 2 : 0, 0);
    ctx.scale(sc, sc);
    sleepTilt(ctx, s);
    shroomStem(ctx, 0, 0, 24, 24, { colors: ["#f4fbff", "#b8d8ea", "#3a6a8a"] });
    if (!sleepyEyes(ctx, s, [-5, 5], -14, 3.6)) {
      eye(ctx, -5, -14, 3.6, 4.6, 0.5, 0.5, { pupil: 0.55, stroke: "#2a4a60", pupilColor: "#0a3a6a" });
      eye(ctx, 5, -14, 3.6, 4.6, 0.5, 0.5, { pupil: 0.55, stroke: "#2a4a60", pupilColor: "#0a3a6a" });
      E(ctx, 0, -7, 3, 1.6);
      ctx.fillStyle = "#2a4a60";
      ctx.fill();
    }
    const cy = -24;
    for (let i = 0; i < 9; i++) {
      const a = Math.PI + i / 8 * Math.PI;
      const r = 26;
      ctx.save();
      ctx.translate(Math.cos(a) * r * 0.95, cy + Math.sin(a) * r * 0.62);
      ctx.rotate(a + Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(-5, 0);
      ctx.lineTo(0, -12 - i % 2 * 5);
      ctx.lineTo(5, 0);
      ctx.closePath();
      fs(ctx, lg(ctx, 0, 0, 0, -14, [0, "#aee6ff", 1, "#ffffff"]), "#2a6a9a", 1.5);
      ctx.restore();
    }
    shroomCap(ctx, 0, cy, 26, 18, "#e8faff", "#3ea0e0", "#154a78", [[-0.45, 0.55, 0.14], [0.25, 0.85, 0.12], [0.65, 0.35, 0.1]], { spotColor: "rgba(255,255,255,0.8)" });
    if (fuse > 0) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha *= fuse;
      C(ctx, 0, -24, 50);
      ctx.fillStyle = rg(ctx, 0, -24, 3, 0, -24, 50, [0, "rgba(220,250,255,1)", 1, "rgba(100,200,255,0)"]);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
    zzz(ctx, s, 14, -52);
  }
  function doomshroom(ctx, s) {
    const t = s.t + (s.phase || 0);
    const fuse = s.fuse || 0;
    const sc = 1 + fuse * 0.35;
    shadow(ctx, 0, 0, 30, 9, 0.35);
    ctx.save();
    ctx.translate(fuse > 0 ? Math.sin(t * 60) * fuse * 3 : 0, 0);
    ctx.scale(sc, sc);
    sleepTilt(ctx, s);
    shroomStem(ctx, 0, 0, 26, 24, { colors: ["#8a84a0", "#4a4460", "#1a1628"] });
    if (!sleepyEyes(ctx, s, [-5, 6], -14, 3.8)) {
      const red = fuse > 0 ? "#ff2a2a" : "#141414";
      eye(ctx, -5, -14, 4, 4.6, 1, 0.5, { pupil: 0.6, stroke: "#111", pupilColor: red, white: "#e8e0f0" });
      eye(ctx, 6, -14, 4, 4.6, 1, 0.5, { pupil: 0.6, stroke: "#111", pupilColor: red, white: "#e8e0f0" });
      ctx.beginPath();
      ctx.moveTo(-6, -6);
      ctx.quadraticCurveTo(1, -2, 8, -6);
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#111";
      ctx.stroke();
    }
    shroomCap(ctx, 0, -26, 30, 22, "#8a6ab0", "#2a1640", "#0c0616", null);
    ctx.save();
    ctx.globalAlpha *= 0.75;
    const skull = (x, y, r) => {
      C(ctx, x, y, r);
      ctx.fillStyle = "#b89ee0";
      ctx.fill();
      C(ctx, x - r * 0.35, y - r * 0.05, r * 0.25);
      C(ctx, x + r * 0.35, y - r * 0.05, r * 0.25);
      ctx.fillStyle = "#2a1640";
      C(ctx, x - r * 0.35, y - r * 0.05, r * 0.25);
      ctx.fill();
      C(ctx, x + r * 0.35, y - r * 0.05, r * 0.25);
      ctx.fill();
    };
    skull(-12, -38, 6);
    skull(10, -42, 5);
    skull(-1, -28, 4);
    skull(19, -30, 3.5);
    ctx.restore();
    if (fuse > 0) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha *= fuse * 0.8;
      C(ctx, 0, -26, 55);
      ctx.fillStyle = rg(ctx, 0, -26, 3, 0, -26, 55, [0, "rgba(255,120,220,1)", 1, "rgba(120,0,200,0)"]);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
    zzz(ctx, s, 16, -56);
  }
  function gravebuster(ctx, s) {
    const t = s.t + (s.phase || 0);
    const p = s.progress || 0;
    const chew = Math.sin(t * 10) * 0.5 + 0.5;
    ctx.save();
    ctx.translate(Math.sin(t * 24) * 1.2 * (s.icon ? 0 : 1), 0);
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * TAU + t * 0.3;
      tube(ctx, [Math.cos(a) * 30, -10, Math.cos(a + 1) * 34, -40, Math.cos(a + 2) * 18, -64], 5, "#4f9a2a", "#1f4d0f", 1.5);
    }
    leaf(ctx, -18, -22, Math.PI + 0.3, 20, 7, LEAF, LEAF_O, { light: LEAF_L });
    leaf(ctx, 18, -26, -0.3, 20, 7, LEAF, LEAF_O, { light: LEAF_L });
    ctx.save();
    ctx.translate(0, -72 + chew * 6 + p * 20);
    ctx.beginPath();
    ctx.moveTo(-26, 8);
    ctx.bezierCurveTo(-30, -26, 30, -26, 26, 8);
    ctx.closePath();
    fs(ctx, rg(ctx, -8, -12, 2, 0, -4, 30, [0, "#b0e87a", 1, "#3f8f1e"]), LEAF_O, 2.2);
    teeth(ctx, -24, 8, 24, 8, 7, 8, 1, "#fffbe8", "#555");
    eye(ctx, -8, -6, 4.5, 5, 0, 1.5, { pupil: 0.55 });
    eye(ctx, 8, -6, 4.5, 5, 0, 1.5, { pupil: 0.55 });
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = LEAF_O;
    ctx.beginPath();
    ctx.moveTo(-14, -14);
    ctx.lineTo(-4, -11);
    ctx.moveTo(14, -14);
    ctx.lineTo(4, -11);
    ctx.stroke();
    ctx.restore();
    ctx.restore();
  }
  function lilypad(ctx, s) {
    const t = s.t + (s.phase || 0);
    const bob = s.icon ? 0 : Math.sin(t * 1.6) * 1.4;
    ctx.save();
    ctx.translate(0, bob - 2);
    if (!s.icon) {
      ctx.save();
      ctx.globalAlpha *= 0.3;
      E(ctx, 0, 4, 44, 12);
      ctx.strokeStyle = "#e8fbff";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
    ctx.scale(1, 0.42);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 42, 0.25, TAU - 0.12);
    ctx.closePath();
    fs(ctx, rg(ctx, -12, -14, 4, 0, 0, 44, [0, "#b8ee8a", 0.6, "#6cc048", 1, "#3a8a24"]), "#1f5a10", 4.5);
    ctx.globalAlpha *= 0.4;
    ctx.strokeStyle = "#2a6a18";
    ctx.lineWidth = 3;
    for (let i = 0; i < 7; i++) {
      const a = 0.5 + i * 0.8;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * 36, Math.sin(a) * 36);
      ctx.stroke();
    }
    ctx.restore();
  }
  function tanglekelp(ctx, s) {
    const t = s.t + (s.phase || 0);
    const grab = s.grab || 0;
    ctx.save();
    ctx.globalAlpha *= 0.35;
    E(ctx, 0, -2, 30, 9);
    ctx.fillStyle = "#0a4a40";
    ctx.fill();
    ctx.restore();
    const strands = 7;
    for (let i = 0; i < strands; i++) {
      const x0 = (i - (strands - 1) / 2) * 7;
      const h = 30 + i % 3 * 8 + grab * 20;
      const w = Math.sin(t * 3 + i) * 7;
      tube(ctx, [x0, 0, x0 + w, -h * 0.4, x0 - w + grab * 10, -h * 0.8, x0 + w * 0.5 + grab * 18, -h], 5, "#3a8a3a", "#0f3a14", 1.6);
    }
    ctx.save();
    ctx.translate(0, -12 + Math.sin(t * 2) * 1.5);
    E(ctx, 0, 0, 16, 11);
    fs(ctx, rg(ctx, -4, -4, 2, 0, 0, 16, [0, "#6ab85a", 1, "#2a6a2a"]), "#0f3a14", 2);
    eye(ctx, -5, -2, 4, 4.6, 1.2, 0, { pupil: 0.55 });
    eye(ctx, 5, -2, 4, 4.6, 1.2, 0, { pupil: 0.55 });
    ctx.restore();
    if (!s.icon) {
      ctx.save();
      ctx.globalAlpha *= 0.55;
      E(ctx, 0, 0, 30, 6);
      ctx.fillStyle = "#4ab8d8";
      ctx.fill();
      ctx.restore();
    }
  }
  function jalapeno(ctx, s) {
    const t = s.t + (s.phase || 0);
    const fuse = s.fuse || 0;
    const sc = 1 + fuse * 0.3;
    shadow(ctx, 0, 0, 20, 7, 0.3);
    ctx.save();
    ctx.translate(fuse > 0 ? Math.sin(t * 55) * fuse * 3 : 0, 0);
    ctx.scale(1 + fuse * 0.12, sc);
    const bob = Math.sin(t * 2.5) * 1.5;
    ctx.translate(0, bob);
    ctx.beginPath();
    ctx.moveTo(-13, -70);
    ctx.bezierCurveTo(-22, -46, -18, -20, -4, -6);
    ctx.quadraticCurveTo(4, 2, 8, -4);
    ctx.bezierCurveTo(14, -24, 22, -50, 13, -70);
    ctx.quadraticCurveTo(0, -76, -13, -70);
    ctx.closePath();
    fs(ctx, lg(ctx, -18, 0, 18, 0, [0, fuse > 0.5 ? "#ffb070" : "#ff7a5a", 0.5, "#e8241a", 1, "#9a0a06"]), "#4a0402", 2.4);
    ctx.save();
    ctx.globalAlpha *= 0.5;
    E(ctx, -7, -52, 3.5, 12, 0.15);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.restore();
    star(ctx, 0, -72, 13, 6, 5, -Math.PI / 2);
    fs(ctx, "#58a82c", "#1f4d0f", 1.8);
    tube(ctx, [0, -76, -2, -86, 6, -92], 4, "#4a8a24", "#1f4d0f", 1.4);
    eye(ctx, -6, -48, 4.4, 5.4, 1, 0.5, { pupil: 0.55, stroke: "#4a0402" });
    eye(ctx, 6, -48, 4.4, 5.4, 1, 0.5, { pupil: 0.55, stroke: "#4a0402" });
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "#3a0402";
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-12, -58);
    ctx.lineTo(-3, -54);
    ctx.moveTo(12, -58);
    ctx.lineTo(3, -54);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-6, -36);
    ctx.quadraticCurveTo(0, -40 + fuse * 6, 6, -36);
    ctx.stroke();
    ctx.restore();
  }
  function spikeweed(ctx, s) {
    const t = s.t + (s.phase || 0);
    const atk = s.attack || 0;
    ctx.save();
    ctx.scale(1, 0.5);
    E(ctx, 0, -4, 38, 20);
    fs(ctx, rg(ctx, -8, -12, 3, 0, -4, 40, [0, "#8ed65a", 1, "#3a7a1e"]), "#1f4d0f", 3.5);
    ctx.restore();
    const spikes = [[-26, -4], [-13, -10], [0, -12], [13, -10], [26, -4], [-19, 2], [-6, 0], [7, 0], [20, 2]];
    spikes.forEach(([x, y], i) => {
      const h = 12 + i % 3 * 3 + atk * 10 + Math.sin(t * 3 + i) * 0.8;
      ctx.beginPath();
      ctx.moveTo(x - 4, y);
      ctx.lineTo(x + (i % 2 ? 1 : -1), y - h);
      ctx.lineTo(x + 4, y);
      ctx.closePath();
      fs(ctx, lg(ctx, x, y, x, y - h, [0, "#8a9a80", 1, "#f4f8f0"]), "#3a4a30", 1.4);
    });
    eye(ctx, -5, -2, 2.6, 2.6, 0.5, 0.3, { pupil: 0.6 });
    eye(ctx, 5, -2, 2.6, 2.6, 0.5, 0.3, { pupil: 0.6 });
  }
  function torchwood(ctx, s) {
    const t = s.t + (s.phase || 0);
    shadow(ctx, 0, 0, 30, 9, 0.35);
    ctx.beginPath();
    ctx.moveTo(-26, -2);
    ctx.quadraticCurveTo(-30, 0, -34, 2);
    ctx.lineTo(-24, -6);
    ctx.lineTo(-24, -56);
    ctx.lineTo(24, -56);
    ctx.lineTo(24, -6);
    ctx.lineTo(34, 2);
    ctx.quadraticCurveTo(0, 6, -34, 2);
    ctx.closePath();
    fs(ctx, lg(ctx, -24, 0, 24, 0, [0, "#6a3e18", 0.35, "#a8703a", 0.7, "#8a5626", 1, "#4a2808"]), "#2e1604", 2.4);
    ctx.save();
    ctx.globalAlpha *= 0.4;
    ctx.strokeStyle = "#2e1604";
    ctx.lineWidth = 1.6;
    for (const x of [-17, -8, 3, 12, 19]) {
      ctx.beginPath();
      ctx.moveTo(x, -54);
      ctx.bezierCurveTo(x + 3, -40, x - 3, -22, x + 1, -6);
      ctx.stroke();
    }
    ctx.restore();
    E(ctx, 0, -56, 24, 8);
    fs(ctx, rg(ctx, 0, -56, 1, 0, -56, 24, [0, "#f0c070", 1, "#b07a3a"]), "#2e1604", 2);
    ctx.save();
    ctx.globalAlpha *= 0.4;
    for (let r = 6; r < 22; r += 5) {
      E(ctx, 0, -56, r, r / 3);
      ctx.strokeStyle = "#6a3e18";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();
    const glow = 0.7 + Math.sin(t * 8) * 0.15;
    for (const ex of [-9, 9]) {
      E(ctx, ex, -34, 5.5, 4.2);
      ctx.fillStyle = "#2e1604";
      ctx.fill();
      E(ctx, ex, -33, 3, 2.4);
      ctx.fillStyle = `rgba(255,${Math.floor(150 + glow * 80)},40,1)`;
      ctx.fill();
    }
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#2e1604";
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-17, -44);
    ctx.lineTo(-4, -39);
    ctx.moveTo(17, -44);
    ctx.lineTo(4, -39);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-9, -20);
    ctx.quadraticCurveTo(0, -25, 9, -20);
    ctx.quadraticCurveTo(0, -16, -9, -20);
    fs(ctx, "#ff9a2a", "#2e1604", 2);
    drawFlame(ctx, 0, -58, 26, 44, t, s.icon ? 0.9 : 1);
  }
  function drawFlame(ctx, x, y, w, h, t, intensity = 1) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const layers = [
      { c0: "rgba(255,70,0,0.85)", c1: "rgba(255,40,0,0)", s: 1 },
      { c0: "rgba(255,160,0,0.9)", c1: "rgba(255,120,0,0)", s: 0.72 },
      { c0: "rgba(255,245,170,1)", c1: "rgba(255,220,100,0)", s: 0.42 }
    ];
    for (const L of layers) {
      for (let i = 0; i < 3; i++) {
        const ox = (i - 1) * w * 0.32 * L.s;
        const fh = h * L.s * (0.75 + 0.25 * Math.sin(t * 9 + i * 2.1)) * (i === 1 ? 1 : 0.75) * intensity;
        const lean = Math.sin(t * 6 + i * 1.3) * w * 0.18;
        ctx.beginPath();
        ctx.moveTo(x + ox - w * 0.38 * L.s, y + 2);
        ctx.bezierCurveTo(x + ox - w * 0.45 * L.s, y - fh * 0.5, x + ox + lean - w * 0.1, y - fh * 0.8, x + ox + lean, y - fh);
        ctx.bezierCurveTo(x + ox + lean + w * 0.1, y - fh * 0.8, x + ox + w * 0.45 * L.s, y - fh * 0.5, x + ox + w * 0.38 * L.s, y + 2);
        ctx.closePath();
        ctx.fillStyle = rg(ctx, x + ox, y, 1, x + ox, y - fh * 0.3, fh, [0, L.c0, 1, L.c1]);
        ctx.fill();
      }
    }
    ctx.restore();
  }
  function magnetshroom(ctx, s) {
    const t = s.t + (s.phase || 0);
    const cool = s.cooldown || 0;
    shadow(ctx, 0, 0, 26, 8, 0.3);
    ctx.save();
    sleepTilt(ctx, s);
    shroomStem(ctx, 0, 0, 24, 26, { colors: ["#f4e8ff", "#c0a8d8", "#4a3060"] });
    if (!sleepyEyes(ctx, s, [-5, 5], -15, 3.6)) {
      eye(ctx, -5, -15, 3.6, 4.4, 0.6, 0.4, { pupil: 0.55 });
      eye(ctx, 5, -15, 3.6, 4.4, 0.6, 0.4, { pupil: 0.55 });
    }
    shroomCap(ctx, 0, -26, 25, 15, "#d8b0f0", "#7a40a8", "#3a0f58", [[-0.5, 0.5, 0.12], [0.5, 0.6, 0.1]]);
    ctx.save();
    ctx.translate(0, -52 + Math.sin(t * 2) * 1.5);
    ctx.rotate(Math.PI);
    ctx.lineCap = "butt";
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, Math.PI);
    ctx.lineWidth = 12;
    ctx.strokeStyle = "#2a0a0a";
    ctx.stroke();
    ctx.lineWidth = 8.5;
    ctx.strokeStyle = cool > 0 ? "#9a3a3a" : "#e8301e";
    ctx.stroke();
    for (const sx of [-13, 13]) {
      ctx.fillStyle = "#2a0a0a";
      ctx.fillRect(sx - 6, -9, 12, 10);
      ctx.fillStyle = "#d8e0e8";
      ctx.fillRect(sx - 4.2, -7.5, 8.4, 7.5);
    }
    ctx.restore();
    if (!cool && !s.sleep && !s.icon) {
      ctx.save();
      ctx.globalAlpha *= 0.5 + Math.sin(t * 10) * 0.3;
      ctx.strokeStyle = "#ffe860";
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(0, -46, 20 + i * 7 + t * 20 % 7, -2.4, -0.7);
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();
    zzz(ctx, s, 14, -60);
  }
  function coffeebean(ctx, s) {
    const t = s.t + (s.phase || 0);
    const bounce = Math.abs(Math.sin(t * 5)) * 4;
    ctx.save();
    ctx.translate(0, -bounce);
    shadow(ctx, 0, bounce, 12, 4, 0.3);
    leaf(ctx, 0, -28, -2.2, 12, 4.5, LEAF, LEAF_O, { light: LEAF_L });
    leaf(ctx, 0, -28, -0.9, 12, 4.5, LEAF, LEAF_O, { light: LEAF_L });
    E(ctx, 0, -15, 11, 14, 0.15);
    fs(ctx, rg(ctx, -4, -20, 1, 0, -15, 15, [0, "#b07a4a", 1, "#5a3014"]), "#2a1404", 2);
    ctx.beginPath();
    ctx.moveTo(2, -28);
    ctx.bezierCurveTo(-4, -20, 6, -10, 0, -2);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#2a1404";
    ctx.stroke();
    eye(ctx, -4, -17, 2.6, 3, 0.4, 0.4, { pupil: 0.6 });
    eye(ctx, 4.5, -17, 2.6, 3, 0.4, 0.4, { pupil: 0.6 });
    ctx.restore();
  }
  function seashroom(ctx, s) {
    const t = s.t + (s.phase || 0);
    const sh2 = s.shoot ? Math.sin(Math.min(1, s.shoot) * Math.PI) : 0;
    const bob = s.icon ? 0 : Math.sin(t * 1.8) * 1.5;
    ctx.save();
    ctx.translate(0, bob - 4);
    sleepTilt(ctx, s);
    ctx.scale(1 - sh2 * 0.1, 1 + sh2 * 0.12);
    shroomStem(ctx, 0, 0, 20, 22, { colors: ["#e8fff8", "#a8d8c8", "#2a5a50"] });
    ctx.save();
    ctx.translate(9, -11);
    tube(ctx, [0, 0, 8 + sh2 * 3, 0], 8 + sh2 * 2, "#d8f4ec", "#2a5a50", 1.8);
    E(ctx, 9 + sh2 * 3, 0, 2.5, 4 + sh2);
    ctx.fillStyle = "#10302a";
    ctx.fill();
    ctx.restore();
    if (!sleepyEyes(ctx, s, [-3, 4], -13, 3.2)) {
      eye(ctx, -3, -13, 3, 4.2, 1, 0.5, { pupil: 0.6, stroke: "#1a3a30" });
      eye(ctx, 4, -13, 3, 4.2, 1, 0.5, { pupil: 0.6, stroke: "#1a3a30" });
    }
    shroomCap(ctx, 0, -22 + Math.sin(t * 3) * 0.6, 21, 15, "#a8f8e0", "#1a9a80", "#0a4a3e", [[-0.45, 0.6, 0.18], [0.35, 0.75, 0.14], [0.05, 1, 0.1]]);
    ctx.restore();
    if (!s.icon) {
      ctx.save();
      ctx.globalAlpha *= 0.55;
      E(ctx, 0, -2, 26, 6);
      ctx.strokeStyle = "#e8fbff";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
    zzz(ctx, s, 12, -40);
  }
  function plantern(ctx, s) {
    const t = s.t + (s.phase || 0);
    const sway = Math.sin(t * 1.5);
    shadow(ctx, 0, 0, 26, 8, 0.3);
    groundLeaves(ctx, t, { len: 24, wid: 8 });
    tube(ctx, [0, -2, -8, -40, 2, -84, 20 + sway * 2, -80], 6, "#4f9a2a", LEAF_O, 2);
    leaf(ctx, -5, -30, Math.PI + 0.5, 18, 6, LEAF, LEAF_O, { light: LEAF_L });
    leaf(ctx, -3, -46, -0.4, 16, 5, LEAF, LEAF_O, { light: LEAF_L });
    const lx = 22 + sway * 3, ly = -58;
    if (!s.icon) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const a = 0.45 + Math.sin(t * 3) * 0.08;
      C(ctx, lx, ly, 90);
      ctx.fillStyle = rg(ctx, lx, ly, 6, lx, ly, 90, [0, `rgba(255,250,170,${a})`, 0.4, `rgba(255,230,100,${a * 0.4})`, 1, "rgba(255,200,0,0)"]);
      ctx.fill();
      ctx.restore();
    }
    tube(ctx, [20 + sway * 2, -80, lx, ly - 18], 2.5, "#3a7a1e", LEAF_O, 1.2);
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(sway * 0.05);
    E(ctx, 0, 0, 17, 19);
    fs(ctx, rg(ctx, -4, -6, 2, 0, 0, 20, [0, "#ffffe0", 0.4, "#fff27a", 1, "#d8c020"]), "#6a5a00", 2);
    ctx.strokeStyle = "rgba(150,120,0,0.45)";
    ctx.lineWidth = 1.5;
    for (const x of [-8, 0, 8]) {
      ctx.beginPath();
      ctx.ellipse(0, 0, Math.abs(x) + 2, 18, 0, -1.4, 1.4);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(-14, -12);
    ctx.quadraticCurveTo(0, -30, 14, -12);
    ctx.quadraticCurveTo(0, -18, -14, -12);
    fs(ctx, LEAF, LEAF_O, 1.6);
    eye(ctx, -5, 0, 3, 3.6, 0.8, 0.4, { pupil: 0.6, stroke: "#6a5a00" });
    eye(ctx, 5, 0, 3, 3.6, 0.8, 0.4, { pupil: 0.6, stroke: "#6a5a00" });
    ctx.beginPath();
    ctx.arc(0, 5, 3.5, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = "#6a5a00";
    ctx.stroke();
    ctx.restore();
  }
  function cactus(ctx, s) {
    const t = s.t + (s.phase || 0);
    const st = s.stretch || 0;
    const sh2 = s.shoot ? Math.sin(Math.min(1, s.shoot) * Math.PI) : 0;
    shadow(ctx, 0, 0, 26, 8, 0.3);
    const h = 66 + st * 60;
    const sway = Math.sin(t * 1.6) * (1 - st);
    ctx.save();
    ctx.translate(sway, 0);
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(side * 16, -28);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(side * 14, -2, side * 14, -18);
      ctx.lineWidth = 12;
      ctx.lineCap = "round";
      ctx.strokeStyle = "#1f4d0f";
      ctx.stroke();
      ctx.lineWidth = 8;
      ctx.strokeStyle = "#6cc040";
      ctx.stroke();
      ctx.restore();
    }
    ctx.beginPath();
    ctx.moveTo(-18, 0);
    ctx.lineTo(-18, -h + 16);
    ctx.quadraticCurveTo(-18, -h, 0, -h);
    ctx.quadraticCurveTo(18, -h, 18, -h + 16);
    ctx.lineTo(18, 0);
    ctx.quadraticCurveTo(0, 4, -18, 0);
    ctx.closePath();
    fs(ctx, lg(ctx, -18, 0, 18, 0, [0, "#4a9a2a", 0.45, "#8ee05a", 1, "#3a8a1e"]), "#1f4d0f", 2.2);
    ctx.strokeStyle = "rgba(30,80,10,0.4)";
    ctx.lineWidth = 1.5;
    for (const x of [-9, 0, 9]) {
      ctx.beginPath();
      ctx.moveTo(x, -h + 8);
      ctx.lineTo(x, -4);
      ctx.stroke();
    }
    ctx.strokeStyle = "#f8f8e8";
    ctx.lineWidth = 1.4;
    for (let y = -h + 14; y < -6; y += 12) {
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(side * 18, y);
        ctx.lineTo(side * 24, y - 3);
        ctx.stroke();
      }
    }
    ctx.save();
    ctx.translate(0, -h - 2);
    for (let i = 0; i < 5; i++) {
      ctx.rotate(TAU / 5);
      E(ctx, 0, -6, 4, 7);
      fs(ctx, "#ff7ab8", "#9a2a5a", 1.2);
    }
    C(ctx, 0, 0, 3.5);
    fs(ctx, "#ffe04a", "#9a6a00", 1);
    ctx.restore();
    const fy = -h + 26;
    eye(ctx, -6, fy, 4, 5, 1.2, 0.5, { pupil: 0.55 });
    eye(ctx, 6, fy, 4, 5, 1.2, 0.5, { pupil: 0.55 });
    ctx.beginPath();
    ctx.ellipse(6, fy + 11, 4 + sh2 * 2, 3 + sh2 * 2, 0, 0, TAU);
    fs(ctx, "#2a4a10", "#1f4d0f", 1.2);
    ctx.restore();
  }
  function blover(ctx, s) {
    const t = s.t + (s.phase || 0);
    const spin = s.spin || 0;
    shadow(ctx, 0, 0, 22, 7, 0.3);
    groundLeaves(ctx, t, { len: 20, wid: 7 });
    tube(ctx, [0, -2, 2, -24, 0, -46], 5, "#58b52e", LEAF_O, 1.8);
    ctx.save();
    ctx.translate(0, -52);
    ctx.rotate(t * (0.6 + spin * 25));
    for (let i = 0; i < 4; i++) {
      ctx.save();
      ctx.rotate(i / 4 * TAU);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(-18, -6, -20, -26, -6, -28);
      ctx.quadraticCurveTo(0, -24, 0, -20);
      ctx.quadraticCurveTo(0, -24, 6, -28);
      ctx.bezierCurveTo(20, -26, 18, -6, 0, 0);
      fs(ctx, lg(ctx, 0, -28, 0, 0, [0, "#b0f070", 1, "#4aa02a"]), LEAF_O, 1.8);
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -3);
      ctx.lineTo(0, -18);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
    C(ctx, 0, -52, 9);
    fs(ctx, rg(ctx, -2, -55, 1, 0, -52, 10, [0, "#c8f890", 1, "#5ab030"]), LEAF_O, 1.6);
    eye(ctx, -3, -53, 2.2, 2.8, 0.4, 0.3, { pupil: 0.6 });
    eye(ctx, 3, -53, 2.2, 2.8, 0.4, 0.3, { pupil: 0.6 });
  }
  function splitpea(ctx, s) {
    const t = s.t + (s.phase || 0);
    const sway = Math.sin(t * 2.3);
    const rf = s.shoot ? Math.sin(Math.min(1, s.shoot) * Math.PI) : 0;
    const rb = s.shoot2 ? Math.sin(Math.min(1, s.shoot2) * Math.PI) : 0;
    const v = PEA;
    shadow(ctx, 0, 0, 30, 9, 0.3);
    groundLeaves(ctx, t, { fill: v.leaf, light: v.leafLight, stroke: v.outline });
    const hx = sway * 2 - rf * 4 + rb * 4, hy = -54;
    tube(ctx, [0, -2, 2, -20, hx - 4, hy + 22, hx, hy + 8], 7.5, v.stem, v.outline, 2);
    ctx.save();
    ctx.translate(hx, hy);
    ctx.save();
    ctx.translate(-20, -2);
    ctx.scale(-0.82, 0.82);
    ctx.rotate(-rb * 0.1);
    shooterHead(ctx, v, rb, { r: 18, snout: 17, mouth: 9 });
    eye(ctx, 3, -6, 5.5, 7, 1.8, 0.5, { pupil: 0.52 });
    ctx.restore();
    ctx.rotate(sway * 0.03 - rf * 0.1);
    shooterHead(ctx, v, rf);
    eye(ctx, 3, -7, 6.5, 8, 2, 0.5, { pupil: 0.52 });
    ctx.restore();
  }
  function starfruit(ctx, s) {
    const t = s.t + (s.phase || 0);
    const sh2 = s.shoot ? Math.sin(Math.min(1, s.shoot) * Math.PI) : 0;
    shadow(ctx, 0, 0, 26, 8, 0.3);
    groundLeaves(ctx, t, { len: 22, wid: 8 });
    ctx.save();
    ctx.translate(0, -36);
    ctx.rotate(Math.sin(t * 1.2) * 0.08);
    ctx.scale(1 + sh2 * 0.12, 1 - sh2 * 0.08);
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5;
      const r = i % 2 === 0 ? 32 : 15;
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.lineJoin = "round";
    ctx.lineWidth = 7;
    ctx.strokeStyle = "#7a4a00";
    ctx.stroke();
    fs(ctx, rg(ctx, -6, -8, 2, 0, 0, 32, [0, "#fff6a0", 0.5, "#ffd83a", 1, "#f0a010"]), "#f0b020", 3);
    eye(ctx, -6, -2, 4, 5, 0.6, 0.4, { pupil: 0.55, stroke: "#7a4a00" });
    eye(ctx, 6, -2, 4, 5, 0.6, 0.4, { pupil: 0.55, stroke: "#7a4a00" });
    ctx.beginPath();
    ctx.arc(0, 5, 4, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = "#7a4a00";
    ctx.stroke();
    ctx.globalAlpha *= 0.45;
    E(ctx, -10, -12, 6, 3, -0.6);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.restore();
  }
  function pumpkin(ctx, s) {
    const t = s.t + (s.phase || 0);
    const part = s.part;
    const dmg = s.dmg || 0;
    const icon = !part;
    const dark = ["#e87a1a", "#a04a08", "#5a2a00"];
    if (icon) {
      shadow(ctx, 0, 0, 38, 9, 0.3);
      ctx.save();
      ctx.translate(0, -34);
      for (const [x, rx] of [[-22, 20], [22, 20], [-10, 22], [10, 22], [0, 22]]) {
        E(ctx, x, 0, rx, 32);
        fs(ctx, rg(ctx, x - 6, -12, 3, x, 0, 34, [0, "#ffb04a", 0.6, dark[0], 1, dark[1]]), dark[2], 2);
      }
      tube(ctx, [0, -30, -2, -40, 6, -44], 5, "#5a8a24", "#1f4d0f", 1.4);
      ctx.fillStyle = "#3a1400";
      ctx.beginPath();
      ctx.moveTo(-20, -6);
      ctx.lineTo(-8, -6);
      ctx.lineTo(-14, -16);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(8, -6);
      ctx.lineTo(20, -6);
      ctx.lineTo(14, -16);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-22, 6);
      ctx.quadraticCurveTo(0, 26, 22, 6);
      ctx.quadraticCurveTo(0, 14, -22, 6);
      ctx.fill();
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = "rgba(255,200,60,0.35)";
      ctx.beginPath();
      ctx.moveTo(-18, 8);
      ctx.quadraticCurveTo(0, 20, 18, 8);
      ctx.quadraticCurveTo(0, 13, -18, 8);
      ctx.fill();
      ctx.restore();
      ctx.restore();
      return;
    }
    if (icon || part === "back") {
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(0, -30, 40, 34, 0, Math.PI, TAU);
      ctx.lineTo(40, -22);
      ctx.lineTo(-40, -22);
      ctx.closePath();
      fs(ctx, lg(ctx, 0, -64, 0, -22, [0, "#c85a0a", 1, "#8a3a04"]), dark[2], 2.2);
      ctx.restore();
    }
    if (icon || part === "front") {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(-42, -30);
      ctx.bezierCurveTo(-44, 0, -20, 6, 0, 6);
      ctx.bezierCurveTo(20, 6, 44, 0, 42, -30);
      ctx.quadraticCurveTo(0, -18 + (icon ? -30 : 0), -42, -30);
      ctx.closePath();
      fs(ctx, rg(ctx, -10, -30, 4, 0, -14, 50, [0, "#ffb04a", 0.6, dark[0], 1, dark[1]]), dark[2], 2.5);
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = "rgba(90,40,0,0.35)";
      ctx.lineWidth = 2;
      for (const x of [-24, -8, 8, 24]) {
        ctx.beginPath();
        ctx.moveTo(x, -30);
        ctx.quadraticCurveTo(x * 1.2, -12, x * 0.9, 6);
        ctx.stroke();
      }
      if (dmg >= 1) {
        ctx.strokeStyle = dark[2];
        ctx.beginPath();
        ctx.moveTo(-30, -20);
        ctx.lineTo(-22, -12);
        ctx.lineTo(-26, -4);
        ctx.stroke();
      }
      if (dmg >= 2) {
        ctx.fillStyle = "rgba(60,20,0,0.5)";
        E(ctx, 20, -10, 8, 5);
        ctx.fill();
      }
      ctx.restore();
      if (icon) {
        ctx.fillStyle = "#3a1400";
        ctx.beginPath();
        ctx.moveTo(-18, -26);
        ctx.lineTo(-8, -26);
        ctx.lineTo(-13, -34);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(8, -26);
        ctx.lineTo(18, -26);
        ctx.lineTo(13, -34);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-20, -14);
        ctx.quadraticCurveTo(0, 0, 20, -14);
        ctx.quadraticCurveTo(0, -6, -20, -14);
        ctx.fill();
        tube(ctx, [0, -60, -2, -70, 6, -74], 5, "#5a8a24", "#1f4d0f", 1.4);
      }
      ctx.restore();
    }
  }
  function garlic(ctx, s) {
    const t = s.t + (s.phase || 0);
    const dmg = s.dmg || 0;
    shadow(ctx, 0, 0, 26, 8, 0.3);
    ctx.save();
    const b = 1 + Math.sin(t * 1.8) * 0.015;
    ctx.scale(2 - b, b);
    ctx.beginPath();
    ctx.moveTo(0, -70);
    ctx.bezierCurveTo(8, -56, 30, -48, 28, -22);
    ctx.bezierCurveTo(26, -2, 10, 2, 0, 2);
    ctx.bezierCurveTo(-10, 2, -26, -2, -28, -22);
    ctx.bezierCurveTo(-30, -48, -8, -56, 0, -70);
    ctx.closePath();
    fs(ctx, rg(ctx, -8, -36, 3, 0, -28, 40, [0, "#ffffff", 0.6, "#f0e8f4", 1, "#c8b0d0"]), "#5a4a60", 2.4);
    ctx.strokeStyle = "rgba(150,90,170,0.45)";
    ctx.lineWidth = 2;
    for (const x of [-14, 0, 14]) {
      ctx.beginPath();
      ctx.moveTo(x * 0.3, -62);
      ctx.quadraticCurveTo(x * 1.3, -30, x, 0);
      ctx.stroke();
    }
    if (dmg >= 1) {
      ctx.fillStyle = "rgba(90,60,90,0.35)";
      E(ctx, 16, -40, 7, 4, 0.4);
      ctx.fill();
    }
    if (dmg >= 2) {
      ctx.fillStyle = "rgba(90,60,90,0.45)";
      E(ctx, -14, -18, 8, 5, -0.4);
      ctx.fill();
    }
    const sad = dmg >= 1;
    eye(ctx, -8, -30, 4.5, 5.5, 1, sad ? 1.5 : 0.5, { pupil: 0.5, stroke: "#5a4a60" });
    eye(ctx, 8, -30, 4.5, 5.5, 1, sad ? 1.5 : 0.5, { pupil: 0.5, stroke: "#5a4a60" });
    ctx.beginPath();
    if (sad) ctx.arc(0, -12, 5, 1.15 * Math.PI, 1.85 * Math.PI);
    else ctx.arc(0, -20, 5, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#5a4a60";
    ctx.stroke();
    ctx.restore();
  }
  var PLANT_ART = {
    peashooter,
    sunflower,
    cherrybomb,
    wallnut,
    potatomine,
    snowpea,
    chomper,
    repeater,
    puffshroom,
    sunshroom,
    fumeshroom,
    gravebuster,
    hypnoshroom,
    scaredyshroom,
    iceshroom,
    doomshroom,
    lilypad,
    squash,
    threepeater,
    tanglekelp,
    jalapeno,
    spikeweed,
    torchwood,
    tallnut,
    magnetshroom,
    coffeebean,
    seashroom,
    plantern,
    cactus,
    blover,
    splitpea,
    starfruit,
    pumpkin,
    garlic
  };

  // src/game/defs.js
  var PLANTS = {
    peashooter: {
      name: "\u8C4C\u8C46\u5C04\u624B",
      cost: 100,
      recharge: 7.5,
      hp: 300,
      kind: "shooter",
      desc: "\u6700\u57FA\u7840\u7684\u653B\u51FB\u690D\u7269\uFF0C\u671D\u540C\u4E00\u884C\u7684\u50F5\u5C38\u8FDE\u7EED\u53D1\u5C04\u8C4C\u8C46\u3002",
      stats: [["\u4F24\u5BB3", "\u666E\u901A"], ["\u5C04\u901F", "\u666E\u901A"]],
      lore: "\u8C4C\u8C46\u5C04\u624B\u6BCF\u5929\u65E9\u4E0A\u90FD\u4F1A\u505A\u4E94\u5341\u4E2A\u4FEF\u5367\u6491\u6765\u953B\u70BC\u9888\u90E8\u2014\u2014\u6BD5\u7ADF\uFF0C\u6240\u6709\u7684\u540E\u5750\u529B\u90FD\u5F97\u9760\u8116\u5B50\u625B\u3002"
    },
    sunflower: {
      name: "\u5411\u65E5\u8475",
      cost: 50,
      recharge: 7.5,
      hp: 300,
      kind: "producer",
      desc: "\u4F1A\u5B9A\u671F\u4EA7\u51FA\u9633\u5149\u7684\u7ECF\u6D4E\u690D\u7269\uFF0C\u5F00\u5C40\u591A\u79CD\u51E0\u682A\u51C6\u6CA1\u9519\u3002",
      stats: [["\u9633\u5149\u4EA7\u91CF", "\u666E\u901A"]],
      lore: "\u5411\u65E5\u8475\u575A\u4FE1\u5FAE\u7B11\u53EF\u4EE5\u4F20\u67D3\u3002\u5B83\u5BF9\u7740\u50F5\u5C38\u7B11\u4E86\u6574\u6574\u4E00\u4E2A\u4E0B\u5348\uFF0C\u7ED3\u679C\u53EA\u6536\u83B7\u4E86\u4E00\u53E5\u201C\u8111\u5B50\u2026\u2026\u201D\u3002"
    },
    cherrybomb: {
      name: "\u6A31\u6843\u70B8\u5F39",
      cost: 150,
      recharge: 50,
      hp: 300,
      kind: "instant",
      desc: "\u79CD\u4E0B\u540E\u7247\u523B\u5373\u7206\u70B8\uFF0C\u6D88\u706D\u5468\u56F4 3\xD73 \u8303\u56F4\u5185\u7684\u6240\u6709\u50F5\u5C38\u3002",
      stats: [["\u4F24\u5BB3", "\u6781\u9AD8"], ["\u8303\u56F4", "3\xD73 \u533A\u57DF"], ["\u7528\u6CD5", "\u5355\u72EC\u4F7F\u7528\uFF0C\u7ACB\u5373\u751F\u6548"]],
      lore: "\u8FD9\u5BF9\u53CC\u80DE\u80CE\u4ECE\u5C0F\u5C31\u5F62\u5F71\u4E0D\u79BB\uFF0C\u8FDE\u53D1\u813E\u6C14\u90FD\u8981\u540C\u6B65\u3002\u5B83\u4EEC\u552F\u4E00\u7684\u5206\u6B67\u662F\uFF1A\u8C01\u5148\u558A\u51FA\u201C\u8F70\u201D\u3002"
    },
    wallnut: {
      name: "\u575A\u679C\u5899",
      cost: 50,
      recharge: 30,
      hp: 4e3,
      kind: "wall",
      desc: "\u575A\u786C\u7684\u5916\u58F3\u80FD\u957F\u65F6\u95F4\u6321\u4F4F\u50F5\u5C38\uFF0C\u4E3A\u8EAB\u540E\u7684\u690D\u7269\u4E89\u53D6\u65F6\u95F4\u3002",
      stats: [["\u97E7\u6027", "\u9AD8"]],
      lore: "\u575A\u679C\u5899\u7684\u5EA7\u53F3\u94ED\u662F\u201C\u7AD9\u7740\u522B\u52A8\u201D\u3002\u5B83\u5728\u8FD9\u65B9\u9762\u5929\u8D4B\u5F02\u7980\uFF0C\u81F3\u4ECA\u4FDD\u6301\u7740\u82B1\u56ED\u201C\u6700\u4E45\u4E0D\u52A8\u201D\u7684\u7EAA\u5F55\u3002"
    },
    potatomine: {
      name: "\u571F\u8C46\u5730\u96F7",
      cost: 25,
      recharge: 30,
      hp: 300,
      kind: "mine",
      armTime: 15,
      desc: "\u9700\u8981\u4E00\u6BB5\u65F6\u95F4\u7834\u571F\u51C6\u5907\uFF0C\u5C31\u7EEA\u540E\u4E00\u78B0\u5373\u70B8\uFF0C\u70B8\u98DE\u6240\u5728\u683C\u5B50\u7684\u50F5\u5C38\u3002",
      stats: [["\u4F24\u5BB3", "\u6781\u9AD8"], ["\u8303\u56F4", "\u4E00\u4E2A\u683C\u5B50\u5185\u7684\u5168\u90E8\u50F5\u5C38"], ["\u7528\u6CD5", "\u5355\u72EC\u4F7F\u7528\uFF0C\u9700\u8981\u4E00\u70B9\u51C6\u5907\u65F6\u95F4"]],
      lore: "\u571F\u8C46\u5730\u96F7\u8BA4\u4E3A\u51C6\u5907\u5DE5\u4F5C\u51B3\u5B9A\u4E00\u5207\u3002\u5B83\u82B1\u5341\u4E94\u79D2\u94BB\u51FA\u6CE5\u571F\uFF0C\u5176\u4E2D\u5341\u56DB\u79D2\u7528\u6765\u6574\u7406\u53D1\u578B\u3002"
    },
    snowpea: {
      name: "\u5BD2\u51B0\u5C04\u624B",
      cost: 175,
      recharge: 7.5,
      hp: 300,
      kind: "shooter",
      desc: "\u53D1\u5C04\u5BD2\u51B0\u8C4C\u8C46\uFF0C\u9020\u6210\u4F24\u5BB3\u7684\u540C\u65F6\u8BA9\u50F5\u5C38\u51CF\u901F\u3002",
      stats: [["\u4F24\u5BB3", "\u666E\u901A\uFF0C\u5E76\u51CF\u901F"]],
      lore: "\u5BD2\u51B0\u5C04\u624B\u7684\u51B0\u7BB1\u91CC\u4EC0\u4E48\u90FD\u6CA1\u6709\u2014\u2014\u5B83\u53EA\u662F\u559C\u6B22\u5F85\u5728\u91CC\u9762\u601D\u8003\u4EBA\u751F\u3002"
    },
    chomper: {
      name: "\u5927\u5634\u82B1",
      cost: 150,
      recharge: 7.5,
      hp: 300,
      kind: "melee",
      chewTime: 42,
      desc: "\u80FD\u4E00\u53E3\u541E\u4E0B\u9762\u524D\u7684\u6574\u53EA\u50F5\u5C38\uFF0C\u4F46\u5480\u56BC\u671F\u95F4\u6BEB\u65E0\u9632\u5907\u3002",
      stats: [["\u4F24\u5BB3", "\u5DE8\u5927"], ["\u8303\u56F4", "\u975E\u5E38\u77ED"], ["\u7279\u70B9", "\u5480\u56BC\u65F6\u95F4\u5F88\u957F"]],
      lore: "\u5927\u5634\u82B1\u6B63\u5728\u8282\u98DF\uFF0C\u6BCF\u5929\u53EA\u5403\u4E00\u53EA\u50F5\u5C38\u3002\u95EE\u9898\u5728\u4E8E\uFF0C\u5B83\u56BC\u4E00\u53EA\u50F5\u5C38\u9700\u8981\u5927\u534A\u5206\u949F\u3002"
    },
    repeater: {
      name: "\u53CC\u53D1\u5C04\u624B",
      cost: 200,
      recharge: 7.5,
      hp: 300,
      kind: "shooter",
      desc: "\u4E00\u6B21\u53D1\u5C04\u4E24\u9897\u8C4C\u8C46\uFF0C\u706B\u529B\u662F\u8C4C\u8C46\u5C04\u624B\u7684\u4E24\u500D\u3002",
      stats: [["\u4F24\u5BB3", "\u666E\u901A\uFF08\u6BCF\u9897\uFF09"], ["\u5C04\u901F", "\u4E24\u500D"]],
      lore: "\u53CC\u53D1\u5C04\u624B\u575A\u6301\u201C\u91CD\u8981\u7684\u4E8B\u60C5\u8BF4\u4E24\u904D\u201D\uFF0C\u8FDE\u6253\u62DB\u547C\u90FD\u8981\u8BF4\u201C\u4F60\u597D\u4F60\u597D\u201D\u3002"
    },
    puffshroom: {
      name: "\u5C0F\u55B7\u83C7",
      cost: 0,
      recharge: 7.5,
      hp: 300,
      kind: "shooter",
      night: true,
      range: 3.2,
      desc: "\u514D\u8D39\u7684\u77ED\u7A0B\u5C04\u624B\uFF0C\u9002\u5408\u5728\u591C\u665A\u5FEB\u901F\u94FA\u5F00\u9632\u7EBF\u3002",
      stats: [["\u4F24\u5BB3", "\u666E\u901A"], ["\u8303\u56F4", "\u8FD1"], ["\u7279\u70B9", "\u767D\u5929\u8981\u7761\u89C9"]],
      lore: "\u5C0F\u55B7\u83C7\u4E2A\u5B50\u4E0D\u9AD8\uFF0C\u55D3\u95E8\u5374\u4E0D\u5C0F\u3002\u5B83\u6700\u559C\u6B22\u7684\u8FD0\u52A8\u662F\u5BF9\u7740\u4E09\u683C\u4EE5\u5916\u7684\u50F5\u5C38\u5927\u558A\u201C\u6709\u79CD\u8FC7\u6765\u201D\u3002"
    },
    sunshroom: {
      name: "\u9633\u5149\u83C7",
      cost: 25,
      recharge: 7.5,
      hp: 300,
      kind: "producer",
      night: true,
      desc: "\u591C\u665A\u7684\u9633\u5149\u6765\u6E90\uFF1A\u8D77\u521D\u4EA7\u51FA\u5C11\u91CF\u9633\u5149\uFF0C\u957F\u5927\u540E\u4EA7\u91CF\u63D0\u5347\u3002",
      stats: [["\u9633\u5149\u4EA7\u91CF", "\u4F4E\uFF0C\u4E4B\u540E\u6B63\u5E38"], ["\u7279\u70B9", "\u767D\u5929\u8981\u7761\u89C9"]],
      lore: "\u9633\u5149\u83C7\u665A\u4E0A\u53D1\u5149\u3001\u767D\u5929\u7761\u89C9\uFF0C\u88AB\u95EE\u5230\u539F\u56E0\u65F6\u5B83\u603B\u662F\u6253\u7740\u54C8\u6B20\u8BF4\uFF1A\u201C\u65F6\u5DEE\u3002\u201D"
    },
    fumeshroom: {
      name: "\u5927\u55B7\u83C7",
      cost: 75,
      recharge: 7.5,
      hp: 300,
      kind: "fume",
      night: true,
      range: 4.2,
      desc: "\u55B7\u51FA\u4E00\u80A1\u6BD2\u6C14\uFF0C\u4F24\u5BB3\u524D\u65B9\u4E00\u6BB5\u8DDD\u79BB\u5185\u7684\u6240\u6709\u50F5\u5C38\uFF0C\u53EF\u4EE5\u7A7F\u900F\u94C1\u6805\u95E8\u3002",
      stats: [["\u4F24\u5BB3", "\u666E\u901A\uFF0C\u53EF\u7A7F\u900F\u94C1\u4E1D\u7F51\u95E8"], ["\u8303\u56F4", "\u81ED\u6C14\u4E2D\u7684\u6240\u6709\u50F5\u5C38"], ["\u7279\u70B9", "\u767D\u5929\u8981\u7761\u89C9"]],
      lore: "\u5927\u55B7\u83C7\u6BCF\u6B21\u5F00\u53E3\u524D\u90FD\u4F1A\u5148\u6DF1\u5438\u4E00\u53E3\u6C14\uFF0C\u8FD9\u8BA9\u5B83\u5728\u82B1\u56ED\u5408\u5531\u56E2\u91CC\u7684\u8868\u73B0\u76F8\u5F53\u60CA\u4EBA\u3002"
    },
    gravebuster: {
      name: "\u5893\u7891\u541E\u566C\u8005",
      cost: 75,
      recharge: 7.5,
      hp: 300,
      kind: "grave",
      night: false,
      desc: "\u79CD\u5728\u5893\u7891\u4E0A\uFF0C\u628A\u6574\u5757\u5893\u7891\u6162\u6162\u5543\u6389\u3002",
      stats: [["\u7528\u6CD5", "\u5355\u72EC\u4F7F\u7528\uFF0C\u53EA\u80FD\u79CD\u5728\u5893\u7891\u4E0A"], ["\u7279\u70B9", "\u53EF\u4EE5\u79FB\u9664\u5893\u7891"]],
      lore: "\u5893\u7891\u541E\u566C\u8005\u5BF9\u77F3\u5934\u7684\u53E3\u611F\u9887\u6709\u7814\u7A76\uFF0C\u5B83\u8BA4\u4E3A\u5927\u7406\u77F3\u201C\u7565\u663E\u6CB9\u817B\u201D\uFF0C\u82B1\u5C97\u5CA9\u201C\u56BC\u52B2\u5341\u8DB3\u201D\u3002"
    },
    hypnoshroom: {
      name: "\u9B45\u60D1\u83C7",
      cost: 75,
      recharge: 30,
      hp: 300,
      kind: "hypno",
      night: true,
      desc: "\u88AB\u50F5\u5C38\u5403\u6389\u540E\uFF0C\u4F1A\u8BA9\u8FD9\u53EA\u50F5\u5C38\u6389\u5934\u4E3A\u4F60\u800C\u6218\u3002",
      stats: [["\u7528\u6CD5", "\u5355\u72EC\u4F7F\u7528\uFF0C\u63A5\u89E6\u751F\u6548"], ["\u7279\u70B9", "\u8BA9\u4E00\u53EA\u50F5\u5C38\u4E3A\u4F60\u4F5C\u6218"], ["\u7279\u70B9", "\u767D\u5929\u8981\u7761\u89C9"]],
      lore: "\u9B45\u60D1\u83C7\u7684\u773C\u775B\u4F1A\u8F6C\u5708\u5708\u3002\u5B83\u8BF4\u81EA\u5DF1\u5E76\u6CA1\u6709\u50AC\u7720\u8C01\uFF0C\u53EA\u662F\u5927\u5BB6\u90FD\u83AB\u540D\u5176\u5999\u5730\u540C\u610F\u4E86\u5B83\u7684\u89C2\u70B9\u3002"
    },
    scaredyshroom: {
      name: "\u80C6\u5C0F\u83C7",
      cost: 25,
      recharge: 7.5,
      hp: 300,
      kind: "shooter",
      night: true,
      scared: true,
      desc: "\u5C04\u7A0B\u5F88\u8FDC\u7684\u5C04\u624B\uFF0C\u4F46\u50F5\u5C38\u9760\u8FD1\u65F6\u4F1A\u5BB3\u6015\u5F97\u7F29\u6210\u4E00\u56E2\u3002",
      stats: [["\u4F24\u5BB3", "\u666E\u901A"], ["\u7279\u70B9", "\u654C\u4EBA\u63A5\u8FD1\u65F6\u505C\u6B62\u653B\u51FB"], ["\u7279\u70B9", "\u767D\u5929\u8981\u7761\u89C9"]],
      lore: "\u80C6\u5C0F\u83C7\u8FDE\u81EA\u5DF1\u7684\u5F71\u5B50\u90FD\u6015\u3002\u597D\u6D88\u606F\u662F\uFF1A\u5728\u591C\u665A\uFF0C\u5B83\u51E0\u4E4E\u770B\u4E0D\u89C1\u81EA\u5DF1\u7684\u5F71\u5B50\u3002"
    },
    iceshroom: {
      name: "\u5BD2\u51B0\u83C7",
      cost: 75,
      recharge: 50,
      hp: 300,
      kind: "instant",
      night: true,
      desc: "\u77AC\u95F4\u51BB\u7ED3\u5168\u573A\u6240\u6709\u50F5\u5C38\uFF0C\u5E76\u8BA9\u5B83\u4EEC\u5728\u4E00\u6BB5\u65F6\u95F4\u5185\u51CF\u901F\u3002",
      stats: [["\u4F24\u5BB3", "\u975E\u5E38\u4F4E\uFF0C\u51BB\u7ED3\u5168\u5C4F\u50F5\u5C38"], ["\u8303\u56F4", "\u5168\u5C4F"], ["\u7528\u6CD5", "\u5355\u72EC\u4F7F\u7528\uFF0C\u7ACB\u5373\u751F\u6548"], ["\u7279\u70B9", "\u767D\u5929\u8981\u7761\u89C9"]],
      lore: "\u5BD2\u51B0\u83C7\u4ECE\u4E0D\u53C2\u52A0\u6D3E\u5BF9\uFF0C\u56E0\u4E3A\u6BCF\u6B21\u5B83\u4E00\u8FDB\u95E8\uFF0C\u6C14\u6C1B\u5C31\u4F1A\u7ACB\u523B\u51B7\u4E0B\u6765\u3002"
    },
    doomshroom: {
      name: "\u6BC1\u706D\u83C7",
      cost: 125,
      recharge: 50,
      hp: 300,
      kind: "instant",
      night: true,
      desc: "\u5F15\u53D1\u4E00\u573A\u5DE8\u5927\u7684\u7206\u70B8\uFF0C\u6D88\u706D\u5927\u8303\u56F4\u5185\u7684\u50F5\u5C38\uFF0C\u5E76\u7559\u4E0B\u4E00\u4E2A\u6682\u65F6\u65E0\u6CD5\u79CD\u690D\u7684\u5F39\u5751\u3002",
      stats: [["\u4F24\u5BB3", "\u6781\u9AD8"], ["\u8303\u56F4", "\u5927\u8303\u56F4\u5185\u7684\u6240\u6709\u50F5\u5C38"], ["\u7528\u6CD5", "\u5355\u72EC\u4F7F\u7528\uFF0C\u7ACB\u5373\u751F\u6548"], ["\u7279\u70B9", "\u7559\u4E0B\u5F39\u5751\uFF0C\u767D\u5929\u8981\u7761\u89C9"]],
      lore: "\u6BC1\u706D\u83C7\u5E73\u65F6\u5B89\u9759\u5185\u655B\uFF0C\u559C\u6B22\u56ED\u827A\u548C\u63D2\u82B1\u3002\u53EA\u662F\u5B83\u7684\u6BCF\u4E00\u6B21\u201C\u63D2\u82B1\u201D\uFF0C\u90FD\u4F1A\u8BA9\u65B9\u5706\u51E0\u683C\u5BF8\u8349\u4E0D\u751F\u3002"
    },
    lilypad: {
      name: "\u7761\u83B2",
      cost: 25,
      recharge: 7.5,
      hp: 300,
      kind: "base",
      aquatic: true,
      desc: "\u6D6E\u5728\u6C34\u9762\u4E0A\uFF0C\u8BA9\u9646\u5730\u690D\u7269\u4E5F\u80FD\u79CD\u5728\u6CF3\u6C60\u91CC\u3002",
      stats: [["\u7279\u70B9", "\u975E\u6C34\u751F\u690D\u7269\u53EF\u4EE5\u79CD\u5728\u4E0A\u9762"], ["\u7528\u6CD5", "\u5FC5\u987B\u79CD\u5728\u6C34\u9762\u4E0A"]],
      lore: "\u7761\u83B2\u662F\u6CF3\u6C60\u91CC\u6700\u597D\u7684\u503E\u542C\u8005\u3002\u65E0\u8BBA\u8C01\u7AD9\u5728\u5B83\u8EAB\u4E0A\u62B1\u6028\uFF0C\u5B83\u90FD\u53EA\u662F\u8F7B\u8F7B\u5730\u6643\u4E00\u6643\u3002"
    },
    squash: {
      name: "\u7A9D\u74DC",
      cost: 50,
      recharge: 30,
      hp: 300,
      kind: "squash",
      desc: "\u53D1\u73B0\u8EAB\u65C1\u7684\u50F5\u5C38\u540E\u4F1A\u9AD8\u9AD8\u8DC3\u8D77\uFF0C\u628A\u5B83\u72E0\u72E0\u538B\u6241\u3002",
      stats: [["\u4F24\u5BB3", "\u6781\u9AD8"], ["\u8303\u56F4", "\u77ED\uFF0C\u8986\u76D6\u6240\u6709\u5B83\u538B\u5230\u7684\u50F5\u5C38"], ["\u7528\u6CD5", "\u5355\u72EC\u4F7F\u7528"]],
      lore: "\u7A9D\u74DC\u7684\u4EBA\u751F\u4FE1\u6761\u53EA\u6709\u4E00\u4E2A\u5B57\uFF1A\u538B\u3002\u5B83\u66FE\u8BD5\u56FE\u538B\u6241\u4E00\u53EA\u82CD\u8747\uFF0C\u7ED3\u679C\u5728\u5730\u4E0A\u8EBA\u4E86\u4E00\u6574\u5929\u3002"
    },
    threepeater: {
      name: "\u4E09\u7EBF\u5C04\u624B",
      cost: 325,
      recharge: 7.5,
      hp: 300,
      kind: "shooter",
      desc: "\u540C\u65F6\u5411\u81EA\u5DF1\u548C\u4E0A\u4E0B\u76F8\u90BB\u7684\u4E09\u884C\u53D1\u5C04\u8C4C\u8C46\u3002",
      stats: [["\u4F24\u5BB3", "\u666E\u901A\uFF08\u6BCF\u9897\uFF09"], ["\u8303\u56F4", "\u4E09\u6761\u7EBF"]],
      lore: "\u4E09\u7EBF\u5C04\u624B\u7684\u4E09\u4E2A\u8111\u888B\u7ECF\u5E38\u4E3A\u5403\u4EC0\u4E48\u5435\u67B6\uFF0C\u4F46\u53EA\u8981\u50F5\u5C38\u51FA\u73B0\uFF0C\u5B83\u4EEC\u603B\u80FD\u77AC\u95F4\u8FBE\u6210\u4E00\u81F4\u3002"
    },
    tanglekelp: {
      name: "\u7F20\u7ED5\u6D77\u8349",
      cost: 25,
      recharge: 30,
      hp: 300,
      kind: "kelp",
      aquatic: true,
      desc: "\u6F5C\u4F0F\u5728\u6C34\u4E2D\uFF0C\u628A\u7B2C\u4E00\u4E2A\u9760\u8FD1\u7684\u50F5\u5C38\u62D6\u5165\u6C34\u5E95\u3002",
      stats: [["\u4F24\u5BB3", "\u6781\u9AD8"], ["\u7528\u6CD5", "\u5355\u72EC\u4F7F\u7528\uFF0C\u63A5\u89E6\u751F\u6548"], ["\u7279\u70B9", "\u5FC5\u987B\u79CD\u5728\u6C34\u4E2D"]],
      lore: "\u7F20\u7ED5\u6D77\u8349\u81EA\u79F0\u662F\u6CF3\u6C60\u91CC\u7684\u201C\u9690\u5F62\u523A\u5BA2\u201D\uFF0C\u5C3D\u7BA1\u5B83\u90A3\u53CC\u5927\u773C\u775B\u5728\u6C34\u9762\u4E0A\u4E00\u89C8\u65E0\u4F59\u3002"
    },
    jalapeno: {
      name: "\u706B\u7206\u8FA3\u6912",
      cost: 125,
      recharge: 50,
      hp: 300,
      kind: "instant",
      desc: "\u7247\u523B\u540E\u7206\u53D1\u51FA\u4E00\u9053\u70C8\u7130\uFF0C\u70E7\u5149\u6574\u884C\u7684\u50F5\u5C38\u3002",
      stats: [["\u4F24\u5BB3", "\u6781\u9AD8"], ["\u8303\u56F4", "\u6574\u6761\u7EBF"], ["\u7528\u6CD5", "\u5355\u72EC\u4F7F\u7528\uFF0C\u7ACB\u5373\u751F\u6548"]],
      lore: "\u706B\u7206\u8FA3\u6912\u7684\u813E\u6C14\u6BD4\u5B83\u7684\u8FA3\u5EA6\u8FD8\u8981\u706B\u7206\u3002\u636E\u8BF4\u5B83\u751F\u6C14\u65F6\uFF0C\u8FDE\u592A\u9633\u90FD\u8981\u5F80\u540E\u9000\u4E00\u6B65\u3002"
    },
    spikeweed: {
      name: "\u5730\u523A",
      cost: 100,
      recharge: 7.5,
      hp: 300,
      kind: "spike",
      desc: "\u8DB4\u5728\u5730\u4E0A\u624E\u4F24\u7ECF\u8FC7\u7684\u50F5\u5C38\uFF0C\u8FD8\u80FD\u624E\u7206\u8F66\u8F86\u8F6E\u80CE\uFF1B\u50F5\u5C38\u4E0D\u4F1A\u5543\u98DF\u5B83\u3002",
      stats: [["\u4F24\u5BB3", "\u666E\u901A"], ["\u8303\u56F4", "\u6240\u6709\u8E29\u5230\u5B83\u7684\u50F5\u5C38"], ["\u7279\u70B9", "\u4E0D\u4F1A\u88AB\u50F5\u5C38\u5403\u6389"]],
      lore: "\u5730\u523A\u5E76\u4E0D\u4ECB\u610F\u88AB\u4EBA\u8E29\u2014\u2014\u4E8B\u5B9E\u4E0A\uFF0C\u5B83\u5C31\u76FC\u7740\u8FD9\u4E00\u523B\u3002"
    },
    torchwood: {
      name: "\u706B\u70AC\u6811\u6869",
      cost: 175,
      recharge: 7.5,
      hp: 300,
      kind: "torch",
      desc: "\u8BA9\u7A7F\u8FC7\u5B83\u7684\u8C4C\u8C46\u53D8\u6210\u706B\u7403\uFF0C\u4F24\u5BB3\u7FFB\u500D\u5E76\u6E85\u5C04\u5468\u56F4\u50F5\u5C38\u3002",
      stats: [["\u7279\u70B9", "\u8C4C\u8C46\u7A7F\u8FC7\u540E\u53D8\u6210\u706B\u7403\uFF0C\u4F24\u5BB3\u52A0\u500D"], ["\u7279\u70B9", "\u706B\u7403\u4F1A\u6E85\u5C04\u9644\u8FD1\u7684\u50F5\u5C38"]],
      lore: "\u706B\u70AC\u6811\u6869\u662F\u82B1\u56ED\u91CC\u6700\u53D7\u6B22\u8FCE\u7684\u90BB\u5C45\uFF1A\u51AC\u5929\u80FD\u53D6\u6696\uFF0C\u590F\u5929\u80FD\u70E7\u70E4\uFF0C\u8FD8\u4ECE\u4E0D\u6536\u7535\u8D39\u3002"
    },
    tallnut: {
      name: "\u9AD8\u575A\u679C",
      cost: 125,
      recharge: 30,
      hp: 8e3,
      kind: "wall",
      tall: true,
      desc: "\u6BD4\u575A\u679C\u5899\u66F4\u9AD8\u66F4\u786C\u7684\u58C1\u5792\uFF0C\u6491\u6746\u548C\u6D77\u8C5A\u90FD\u65E0\u6CD5\u8DC3\u8FC7\u5B83\u3002",
      stats: [["\u97E7\u6027", "\u975E\u5E38\u9AD8"], ["\u7279\u70B9", "\u4E0D\u4F1A\u88AB\u6491\u6746\u6216\u6D77\u8C5A\u8DF3\u8FC7"]],
      lore: "\u9AD8\u575A\u679C\u8EAB\u9AD8\u662F\u5B83\u6700\u9A84\u50B2\u7684\u8D44\u672C\uFF0C\u5B83\u6BCF\u5929\u90FD\u8981\u91CF\u4E00\u6B21\u8EAB\u9AD8\uFF0C\u786E\u8BA4\u81EA\u5DF1\u6CA1\u6709\u88AB\u5543\u77EE\u3002"
    },
    magnetshroom: {
      name: "\u78C1\u529B\u83C7",
      cost: 100,
      recharge: 7.5,
      hp: 300,
      kind: "magnet",
      night: true,
      desc: "\u5438\u8D70\u9644\u8FD1\u50F5\u5C38\u8EAB\u4E0A\u7684\u94C1\u6876\u3001\u5934\u76D4\u3001\u94C1\u6805\u95E8\u7B49\u91D1\u5C5E\u88C5\u5907\u3002",
      stats: [["\u8303\u56F4", "\u9644\u8FD1\u7684\u50F5\u5C38"], ["\u7279\u70B9", "\u79FB\u9664\u91D1\u5C5E\u7269\u54C1"], ["\u7279\u70B9", "\u767D\u5929\u8981\u7761\u89C9"]],
      lore: "\u78C1\u529B\u83C7\u6536\u85CF\u4E86\u6EE1\u6EE1\u4E00\u5C4B\u5B50\u7684\u94C1\u6876\u548C\u5934\u76D4\uFF0C\u5B83\u6B63\u5728\u8003\u8651\u5F00\u4E00\u5BB6\u4E8C\u624B\u4E94\u91D1\u5E97\u3002"
    },
    coffeebean: {
      name: "\u5496\u5561\u8C46",
      cost: 75,
      recharge: 7.5,
      hp: 300,
      kind: "coffee",
      overlay: true,
      desc: "\u79CD\u5728\u767D\u5929\u7761\u89C9\u7684\u8611\u83C7\u4E0A\uFF0C\u628A\u5B83\u5524\u9192\u6295\u5165\u6218\u6597\u3002",
      stats: [["\u7528\u6CD5", "\u79CD\u5728\u8611\u83C7\u4E0A\uFF0C\u7ACB\u5373\u751F\u6548"], ["\u7279\u70B9", "\u5524\u9192\u8611\u83C7"]],
      lore: "\u5496\u5561\u8C46\u7CBE\u529B\u8FC7\u5269\uFF0C\u8BF4\u8BDD\u8BED\u901F\u662F\u6B63\u5E38\u690D\u7269\u7684\u4E09\u500D\u3002\u8611\u83C7\u4EEC\u4E00\u542C\u5B83\u5F00\u53E3\uFF0C\u5C31\u518D\u4E5F\u7761\u4E0D\u7740\u4E86\u3002"
    },
    seashroom: {
      name: "\u6D77\u8611\u83C7",
      cost: 0,
      recharge: 30,
      hp: 300,
      kind: "shooter",
      night: true,
      aquatic: true,
      range: 3.2,
      desc: "\u53EA\u80FD\u79CD\u5728\u6C34\u9762\u4E0A\u7684\u77ED\u7A0B\u5C04\u624B\uFF0C\u514D\u8D39\u4F46\u51B7\u5374\u8F83\u6162\u3002",
      stats: [["\u4F24\u5BB3", "\u666E\u901A"], ["\u8303\u56F4", "\u8FD1"], ["\u7279\u70B9", "\u53EA\u80FD\u79CD\u5728\u6C34\u9762\u4E0A\uFF0C\u767D\u5929\u8981\u7761\u89C9"]],
      lore: "\u6D77\u8611\u83C7\u4ECE\u6CA1\u89C1\u8FC7\u5927\u6D77\uFF0C\u4F46\u5B83\u575A\u4FE1\u6CF3\u6C60\u5C31\u662F\u5927\u6D77\u7684\u7F29\u5C0F\u7248\uFF0C\u53EA\u662F\u54B8\u5473\u6DE1\u4E86\u4E00\u70B9\u3002"
    },
    plantern: {
      name: "\u8DEF\u706F\u82B1",
      cost: 25,
      recharge: 30,
      hp: 300,
      kind: "lantern",
      desc: "\u7167\u4EAE\u5468\u56F4\u7684\u6D53\u96FE\uFF0C\u8BA9\u4F60\u770B\u6E05\u96FE\u91CC\u85CF\u7740\u7684\u50F5\u5C38\u3002",
      stats: [["\u8303\u56F4", "\u5468\u56F4\u4E00\u7247\u533A\u57DF"], ["\u7279\u70B9", "\u9A71\u6563\u6D53\u96FE"]],
      lore: "\u8DEF\u706F\u82B1\u6700\u6015\u505C\u7535\u3002\u5B83\u603B\u662F\u968F\u8EAB\u5E26\u7740\u5907\u7528\u706F\u6CE1\uFF0C\u4EE5\u9632\u4E07\u4E00\u3002"
    },
    cactus: {
      name: "\u4ED9\u4EBA\u638C",
      cost: 125,
      recharge: 7.5,
      hp: 300,
      kind: "shooter",
      antiAir: true,
      desc: "\u53D1\u5C04\u5C16\u523A\uFF0C\u8FD8\u80FD\u4F38\u957F\u8EAB\u4F53\u6233\u7834\u6C14\u7403\u50F5\u5C38\u7684\u6C14\u7403\u3002",
      stats: [["\u4F24\u5BB3", "\u666E\u901A"], ["\u7279\u70B9", "\u53EF\u4EE5\u653B\u51FB\u7A7A\u4E2D\u7684\u6C14\u7403\u50F5\u5C38"]],
      lore: "\u4ED9\u4EBA\u638C\u770B\u8D77\u6765\u6D51\u8EAB\u662F\u523A\uFF0C\u5176\u5B9E\u5185\u5FC3\u975E\u5E38\u67D4\u8F6F\u3002\u5B83\u7684\u68A6\u60F3\u662F\u5F00\u4E00\u5BB6\u6C14\u7403\u5E97\u2014\u2014\u5F53\u7136\uFF0C\u662F\u5356\u7ED9\u522B\u4EBA\u624E\u7684\u3002"
    },
    blover: {
      name: "\u4E09\u53F6\u8349",
      cost: 100,
      recharge: 7.5,
      hp: 300,
      kind: "blover",
      desc: "\u79CD\u4E0B\u540E\u7ACB\u5373\u522E\u8D77\u5927\u98CE\uFF0C\u5439\u8D70\u6240\u6709\u6C14\u7403\u50F5\u5C38\uFF0C\u5E76\u6682\u65F6\u5439\u6563\u6D53\u96FE\u3002",
      stats: [["\u7528\u6CD5", "\u5355\u72EC\u4F7F\u7528\uFF0C\u7ACB\u5373\u751F\u6548"], ["\u7279\u70B9", "\u5439\u8D70\u6C14\u7403\u50F5\u5C38\uFF0C\u5439\u6563\u6D53\u96FE"]],
      lore: "\u4E09\u53F6\u8349\u603B\u8BF4\u81EA\u5DF1\u662F\u56DB\u53F6\u8349\uFF0C\u53EA\u662F\u6709\u4E00\u7247\u53F6\u5B50\u51FA\u95E8\u65C5\u6E38\u53BB\u4E86\u3002"
    },
    splitpea: {
      name: "\u88C2\u835A\u5C04\u624B",
      cost: 125,
      recharge: 7.5,
      hp: 300,
      kind: "shooter",
      split: true,
      desc: "\u540C\u65F6\u5411\u524D\u65B9\u548C\u540E\u65B9\u53D1\u5C04\u8C4C\u8C46\uFF0C\u540E\u65B9\u4E00\u6B21\u4E24\u9897\u3002",
      stats: [["\u4F24\u5BB3", "\u666E\u901A"], ["\u5C04\u5411", "\u524D\u65B9\u4E00\u9897\uFF0C\u540E\u65B9\u4E24\u9897"]],
      lore: "\u88C2\u835A\u5C04\u624B\u7684\u4E24\u4E2A\u8111\u888B\u4E00\u4E2A\u4E50\u89C2\u4E00\u4E2A\u60B2\u89C2\uFF0C\u5B83\u4EEC\u4ECE\u6765\u6CA1\u6709\u9762\u5BF9\u9762\u804A\u8FC7\u5929\u3002"
    },
    starfruit: {
      name: "\u6768\u6843",
      cost: 125,
      recharge: 7.5,
      hp: 300,
      kind: "star",
      desc: "\u540C\u65F6\u671D\u4E94\u4E2A\u65B9\u5411\u53D1\u5C04\u661F\u661F\uFF0C\u6253\u51FB\u4E0A\u4E0B\u5DE6\u53F3\u4E0E\u659C\u524D\u65B9\u7684\u50F5\u5C38\u3002",
      stats: [["\u4F24\u5BB3", "\u666E\u901A"], ["\u5C04\u5411", "\u4E94\u4E2A\u65B9\u5411"]],
      lore: "\u6768\u6843\u7684\u68A6\u60F3\u662F\u6210\u4E3A\u591C\u7A7A\u4E2D\u6700\u4EAE\u7684\u661F\u3002\u5B83\u6BCF\u5929\u90FD\u5728\u7EC3\u4E60\u53D1\u5149\uFF0C\u867D\u7136\u76EE\u524D\u53EA\u80FD\u53D1\u5C04\u661F\u661F\u3002"
    },
    pumpkin: {
      name: "\u5357\u74DC\u5934",
      cost: 125,
      recharge: 30,
      hp: 4e3,
      kind: "pumpkin",
      shell: true,
      desc: "\u53EF\u4EE5\u5957\u5728\u5176\u4ED6\u690D\u7269\u5916\u9762\uFF0C\u66FF\u5B83\u4EEC\u6321\u4F4F\u50F5\u5C38\u7684\u5543\u54AC\u3002",
      stats: [["\u97E7\u6027", "\u9AD8"], ["\u7528\u6CD5", "\u53EF\u4EE5\u5957\u5728\u5176\u4ED6\u690D\u7269\u4E0A"]],
      lore: "\u5357\u74DC\u5934\u603B\u662F\u628A\u6700\u597D\u7684\u4F4D\u7F6E\u8BA9\u7ED9\u522B\u4EBA\uFF0C\u81EA\u5DF1\u6321\u5728\u5916\u9762\u3002\u90BB\u5C45\u4EEC\u90FD\u8BF4\uFF0C\u5B83\u662F\u82B1\u56ED\u91CC\u6700\u6709\u62C5\u5F53\u7684\u852C\u83DC\u3002"
    },
    garlic: {
      name: "\u5927\u849C",
      cost: 50,
      recharge: 7.5,
      hp: 400,
      kind: "garlic",
      desc: "\u50F5\u5C38\u54AC\u4E00\u53E3\u5927\u849C\u5C31\u4F1A\u96BE\u53D7\u5730\u6362\u5230\u76F8\u90BB\u7684\u884C\u53BB\u3002",
      stats: [["\u97E7\u6027", "\u4E2D"], ["\u7279\u70B9", "\u8BA9\u5543\u54AC\u5B83\u7684\u50F5\u5C38\u6362\u884C"]],
      lore: "\u5927\u849C\u4ECE\u4E0D\u7528\u9999\u6C34\u3002\u5B83\u8BF4\uFF1A\u201C\u771F\u6B63\u7684\u9B45\u529B\uFF0C\u662F\u8BA9\u4EBA\u95FB\u4E00\u4E0B\u5C31\u60F3\u8F6C\u8EAB\u79BB\u5F00\u3002\u201D"
    }
  };
  var PLANT_ORDER = [
    "peashooter",
    "sunflower",
    "cherrybomb",
    "wallnut",
    "potatomine",
    "snowpea",
    "chomper",
    "repeater",
    "puffshroom",
    "sunshroom",
    "fumeshroom",
    "gravebuster",
    "hypnoshroom",
    "scaredyshroom",
    "iceshroom",
    "doomshroom",
    "lilypad",
    "squash",
    "threepeater",
    "tanglekelp",
    "jalapeno",
    "spikeweed",
    "torchwood",
    "tallnut",
    "magnetshroom",
    "coffeebean",
    "seashroom",
    "plantern",
    "cactus",
    "blover",
    "splitpea",
    "starfruit",
    "pumpkin",
    "garlic"
  ];
  var ZOMBIES = {
    normal: {
      name: "\u666E\u901A\u50F5\u5C38",
      hp: 200,
      speed: 19,
      pts: 1,
      weight: 4e3,
      desc: "\u6700\u5E38\u89C1\u7684\u50F5\u5C38\uFF0C\u6162\u541E\u541E\u5730\u8D70\u5411\u4F60\u7684\u623F\u5B50\u3002",
      stats: [["\u97E7\u6027", "\u4F4E"]],
      lore: "\u666E\u901A\u50F5\u5C38\u5E76\u4E0D\u666E\u901A\u2014\u2014\u5B83\u662F\u5168\u961F\u552F\u4E00\u4E00\u4E2A\u8BB0\u5F97\u6253\u9886\u5E26\u7684\u3002"
    },
    flag: {
      name: "\u65D7\u5E1C\u50F5\u5C38",
      hp: 200,
      speed: 24,
      pts: 1,
      weight: 0,
      flag: true,
      desc: "\u4E3E\u7740\u65D7\u5E1C\u7684\u50F5\u5C38\uFF0C\u5B83\u7684\u51FA\u73B0\u610F\u5473\u7740\u4E00\u5927\u6CE2\u50F5\u5C38\u6B63\u5728\u903C\u8FD1\u3002",
      stats: [["\u97E7\u6027", "\u4F4E"]],
      lore: "\u65D7\u5E1C\u50F5\u5C38\u628A\u65D7\u5B50\u6D17\u5F97\u5E72\u5E72\u51C0\u51C0\uFF0C\u65D7\u9762\u4E0A\u7684\u8111\u5B50\u56FE\u6848\u662F\u5B83\u4EB2\u624B\u7F1D\u4E0A\u53BB\u7684\u3002"
    },
    cone: {
      name: "\u8DEF\u969C\u50F5\u5C38",
      hp: 200,
      speed: 19,
      pts: 2,
      weight: 4e3,
      armor: { kind: "cone", hp: 370, metal: false },
      desc: "\u5934\u9876\u8DEF\u969C\u7684\u50F5\u5C38\uFF0C\u6BD4\u666E\u901A\u50F5\u5C38\u8010\u6253\u5F97\u591A\u3002",
      stats: [["\u97E7\u6027", "\u4E2D"]],
      lore: "\u8DEF\u969C\u50F5\u5C38\u5728\u9A6C\u8DEF\u8FB9\u6361\u5230\u4E86\u8FD9\u9876\u201C\u5E3D\u5B50\u201D\uFF0C\u4ECE\u6B64\u81EA\u8BA4\u4E3A\u662F\u6574\u6761\u8857\u6700\u65F6\u9AE6\u7684\u50F5\u5C38\u3002"
    },
    pole: {
      name: "\u6491\u6746\u50F5\u5C38",
      hp: 340,
      speed: 42,
      walkSpeed: 19,
      pts: 2,
      weight: 2e3,
      firstWave: 5,
      land: true,
      desc: "\u624B\u6301\u6491\u6746\u5FEB\u901F\u5954\u8DD1\uFF0C\u4F1A\u8DF3\u8FC7\u9047\u5230\u7684\u7B2C\u4E00\u682A\u690D\u7269\u3002",
      stats: [["\u97E7\u6027", "\u4E2D"], ["\u901F\u5EA6", "\u5FEB\uFF0C\u8DF3\u8DC3\u540E\u53D8\u6162"], ["\u7279\u70B9", "\u8DF3\u8FC7\u9047\u5230\u7684\u7B2C\u4E00\u682A\u690D\u7269"]],
      lore: "\u6491\u6746\u50F5\u5C38\u751F\u524D\u662F\u4E00\u540D\u7530\u5F84\u8FD0\u52A8\u5458\uFF0C\u5B83\u81F3\u4ECA\u4ECD\u5728\u4E3A\u6253\u7834\u201C\u540E\u9662\u8DF3\u9AD8\u7EAA\u5F55\u201D\u800C\u52AA\u529B\u3002"
    },
    bucket: {
      name: "\u94C1\u6876\u50F5\u5C38",
      hp: 200,
      speed: 19,
      pts: 4,
      weight: 3e3,
      firstWave: 8,
      armor: { kind: "bucket", hp: 1100, metal: true },
      desc: "\u5934\u6234\u94C1\u6876\u7684\u50F5\u5C38\uFF0C\u9632\u5FA1\u529B\u975E\u5E38\u9AD8\u3002",
      stats: [["\u97E7\u6027", "\u9AD8"], ["\u5F31\u70B9", "\u78C1\u529B\u83C7"]],
      lore: "\u94C1\u6876\u50F5\u5C38\u5DF2\u7ECF\u5F88\u4E45\u6CA1\u770B\u6E05\u8DEF\u4E86\uFF0C\u4F46\u5B83\u76F8\u4FE1\u53EA\u8981\u4E00\u76F4\u5F80\u5DE6\u8D70\uFF0C\u603B\u80FD\u627E\u5230\u8111\u5B50\u3002"
    },
    newspaper: {
      name: "\u8BFB\u62A5\u50F5\u5C38",
      hp: 200,
      speed: 19,
      angrySpeed: 45,
      pts: 2,
      weight: 1e3,
      firstWave: 3,
      land: true,
      shield: { kind: "paper", hp: 150, metal: false, blocksPeas: false },
      desc: "\u7528\u62A5\u7EB8\u6321\u4F4F\u4F24\u5BB3\uFF0C\u62A5\u7EB8\u88AB\u6253\u70C2\u540E\u4F1A\u66B4\u6012\u5E76\u52A0\u901F\u3002",
      stats: [["\u97E7\u6027", "\u4F4E"], ["\u62A5\u7EB8\u97E7\u6027", "\u4F4E"], ["\u901F\u5EA6", "\u666E\u901A\uFF0C\u5931\u53BB\u62A5\u7EB8\u540E\u52A0\u5FEB"]],
      lore: "\u8BFB\u62A5\u50F5\u5C38\u6BCF\u5929\u90FD\u5728\u8FFD\u4E00\u7BC7\u8FDE\u8F7D\u5C0F\u8BF4\u3002\u8981\u662F\u6709\u4EBA\u6253\u65AD\u5B83\u7684\u9605\u8BFB\uFF0C\u540E\u679C\u81EA\u8D1F\u3002"
    },
    screendoor: {
      name: "\u94C1\u6805\u95E8\u50F5\u5C38",
      hp: 200,
      speed: 19,
      pts: 4,
      weight: 3500,
      firstWave: 5,
      land: true,
      shield: { kind: "door", hp: 1100, metal: true, blocksPeas: true },
      desc: "\u4E3E\u7740\u94C1\u6805\u95E8\u5F53\u76FE\u724C\uFF0C\u80FD\u6321\u4F4F\u6B63\u9762\u5C04\u6765\u7684\u8C4C\u8C46\u3002",
      stats: [["\u97E7\u6027", "\u4F4E"], ["\u94C1\u6805\u95E8\u97E7\u6027", "\u9AD8"], ["\u5F31\u70B9", "\u5927\u55B7\u83C7\u548C\u78C1\u529B\u83C7"]],
      lore: "\u8FD9\u6247\u94C1\u6805\u95E8\u662F\u5B83\u4ECE\u90BB\u5C45\u5BB6\u201C\u501F\u201D\u6765\u7684\uFF0C\u5B83\u6253\u7B97\u7528\u5B8C\u518D\u8FD8\u2014\u2014\u5927\u6982\u5427\u3002"
    },
    football: {
      name: "\u6A44\u6984\u7403\u50F5\u5C38",
      hp: 200,
      speed: 36,
      pts: 7,
      weight: 2e3,
      firstWave: 8,
      land: true,
      scale: 1.06,
      armor: { kind: "helmet", hp: 1400, metal: true },
      desc: "\u8EAB\u7A7F\u5168\u5957\u62A4\u5177\uFF0C\u901F\u5EA6\u5FEB\u3001\u6781\u5176\u8010\u6253\u3002",
      stats: [["\u97E7\u6027", "\u6781\u9AD8"], ["\u901F\u5EA6", "\u5FEB"], ["\u5F31\u70B9", "\u78C1\u529B\u83C7"]],
      lore: "\u6A44\u6984\u7403\u50F5\u5C38\u4ECE\u4E0D\u4F20\u7403\uFF0C\u5B83\u552F\u4E00\u7684\u6218\u672F\u5C31\u662F\u51B2\u3001\u51B2\u3001\u51B2\u3002"
    },
    dancer: {
      name: "\u821E\u738B\u50F5\u5C38",
      hp: 500,
      speed: 22,
      pts: 5,
      weight: 1e3,
      firstWave: 10,
      land: true,
      desc: "\u4F1A\u53EC\u5524\u56DB\u540D\u4F34\u821E\u50F5\u5C38\uFF0C\u548C\u5B83\u4EEC\u4E00\u8D77\u821E\u52A8\u524D\u8FDB\u3002",
      stats: [["\u97E7\u6027", "\u4E2D"], ["\u7279\u70B9", "\u53EC\u5524\u4F34\u821E\u50F5\u5C38"]],
      lore: "\u821E\u738B\u50F5\u5C38\u7684\u978B\u5E95\u6C38\u8FDC\u64E6\u5F97\u9503\u4EAE\u3002\u5B83\u8BF4\uFF1A\u201C\u821E\u53F0\u5728\u54EA\u91CC\uFF0C\u6211\u5C31\u5728\u54EA\u91CC\u3002\u201D"
    },
    backup: {
      name: "\u4F34\u821E\u50F5\u5C38",
      hp: 200,
      speed: 22,
      pts: 1,
      weight: 0,
      land: true,
      desc: "\u7531\u821E\u738B\u50F5\u5C38\u53EC\u5524\u7684\u4F34\u821E\u8005\u3002",
      stats: [["\u97E7\u6027", "\u4F4E"]],
      lore: "\u4F34\u821E\u50F5\u5C38\u7684\u68A6\u60F3\u662F\u6709\u4E00\u5929\u4E5F\u80FD\u7AD9\u5728C\u4F4D\uFF0C\u4E0D\u8FC7\u76EE\u524D\u5B83\u8FDE\u821E\u6B65\u90FD\u8FD8\u6CA1\u8BB0\u5168\u3002"
    },
    ducky: {
      name: "\u9E2D\u5B50\u6551\u751F\u5708\u50F5\u5C38",
      hp: 200,
      speed: 19,
      pts: 1,
      weight: 0,
      swim: true,
      desc: "\u5957\u7740\u9E2D\u5B50\u6551\u751F\u5708\uFF0C\u53EF\u4EE5\u5728\u6CF3\u6C60\u4E2D\u6F02\u6D6E\u524D\u8FDB\u3002",
      stats: [["\u97E7\u6027", "\u4F4E"], ["\u7279\u70B9", "\u53EA\u5728\u6C34\u4E2D\u51FA\u73B0"]],
      lore: "\u8FD9\u53EA\u9E2D\u5B50\u6551\u751F\u5708\u662F\u5B83\u5C0F\u65F6\u5019\u7684\u73A9\u5177\uFF0C\u5B83\u4E00\u76F4\u820D\u4E0D\u5F97\u6254\u3002"
    },
    snorkel: {
      name: "\u6F5C\u6C34\u50F5\u5C38",
      hp: 200,
      speed: 19,
      pts: 3,
      weight: 2e3,
      firstWave: 5,
      water: true,
      desc: "\u6F5C\u5165\u6C34\u4E0B\u524D\u8FDB\uFF0C\u6F5C\u6CF3\u65F6\u8C4C\u8C46\u6253\u4E0D\u5230\u5B83\u3002",
      stats: [["\u97E7\u6027", "\u4F4E"], ["\u7279\u70B9", "\u6F5C\u6CF3\u65F6\u53EF\u4EE5\u8EB2\u907F\u653B\u51FB"], ["\u7279\u70B9", "\u53EA\u5728\u6C34\u4E2D\u51FA\u73B0"]],
      lore: "\u6F5C\u6C34\u50F5\u5C38\u5E76\u4E0D\u9700\u8981\u547C\u5438\u7BA1\uFF0C\u5B83\u53EA\u662F\u89C9\u5F97\u8FD9\u6837\u770B\u8D77\u6765\u66F4\u4E13\u4E1A\u3002"
    },
    zomboni: {
      name: "\u51B0\u8F66\u50F5\u5C38",
      hp: 1350,
      speed: 16,
      pts: 7,
      weight: 2e3,
      firstWave: 10,
      land: true,
      vehicle: true,
      desc: "\u9A7E\u9A76\u51B0\u8F66\u78BE\u538B\u690D\u7269\uFF0C\u5E76\u5728\u8EAB\u540E\u7559\u4E0B\u65E0\u6CD5\u79CD\u690D\u7684\u51B0\u9053\uFF1B\u6015\u5730\u523A\u3002",
      stats: [["\u97E7\u6027", "\u9AD8"], ["\u7279\u70B9", "\u78BE\u538B\u690D\u7269\uFF0C\u7559\u4E0B\u51B0\u9053"], ["\u5F31\u70B9", "\u5730\u523A"]],
      lore: "\u51B0\u8F66\u50F5\u5C38\u8003\u4E86\u4E09\u6B21\u9A7E\u7167\u624D\u901A\u8FC7\uFF0C\u8003\u5B98\u81F3\u4ECA\u4ECD\u5FC3\u6709\u4F59\u60B8\u3002"
    },
    dolphin: {
      name: "\u6D77\u8C5A\u9A91\u58EB\u50F5\u5C38",
      hp: 340,
      speed: 44,
      walkSpeed: 19,
      pts: 3,
      weight: 1500,
      firstWave: 10,
      water: true,
      desc: "\u9A91\u7740\u6D77\u8C5A\u5728\u6C34\u4E2D\u98DE\u9A70\uFF0C\u4F1A\u8DF3\u8FC7\u9047\u5230\u7684\u7B2C\u4E00\u682A\u690D\u7269\u3002",
      stats: [["\u97E7\u6027", "\u4E2D"], ["\u901F\u5EA6", "\u5FEB\uFF0C\u8DF3\u8DC3\u540E\u53D8\u6162"], ["\u7279\u70B9", "\u8DF3\u8FC7\u9047\u5230\u7684\u7B2C\u4E00\u682A\u690D\u7269"], ["\u7279\u70B9", "\u53EA\u5728\u6C34\u4E2D\u51FA\u73B0"]],
      lore: "\u6D77\u8C5A\u548C\u9A91\u624B\u914D\u5408\u9ED8\u5951\uFF0C\u636E\u8BF4\u5B83\u4EEC\u66FE\u4E00\u8D77\u83B7\u5F97\u8FC7\u201C\u6C34\u4E0A\u8868\u6F14\u201D\u94DC\u724C\u3002"
    },
    gargantuar: {
      name: "\u5DE8\u4EBA\u50F5\u5C38",
      hp: 3e3,
      speed: 14,
      pts: 10,
      weight: 1500,
      firstWave: 15,
      land: true,
      scale: 1,
      desc: "\u4F53\u578B\u5DE8\u5927\u7684\u50F5\u5C38\uFF0C\u4E00\u68D2\u7838\u6241\u690D\u7269\uFF0C\u53D7\u4F24\u540E\u8FD8\u4F1A\u6254\u51FA\u5C0F\u9B3C\u50F5\u5C38\u3002",
      stats: [["\u97E7\u6027", "\u6781\u9AD8"], ["\u7279\u70B9", "\u7838\u6241\u690D\u7269"], ["\u7279\u70B9", "\u8840\u91CF\u8FC7\u534A\u65F6\u6254\u51FA\u5C0F\u9B3C\u50F5\u5C38"]],
      lore: "\u5DE8\u4EBA\u50F5\u5C38\u7684\u7535\u7EBF\u6746\u662F\u5B83\u6700\u5FC3\u7231\u7684\u73A9\u5177\uFF0C\u5B83\u751A\u81F3\u7ED9\u5B83\u8D77\u4E86\u540D\u5B57\u3002"
    },
    imp: {
      name: "\u5C0F\u9B3C\u50F5\u5C38",
      hp: 200,
      speed: 26,
      pts: 2,
      weight: 0,
      land: true,
      desc: "\u88AB\u5DE8\u4EBA\u50F5\u5C38\u6254\u8FDB\u9632\u7EBF\u7684\u5C0F\u4E2A\u5B50\u50F5\u5C38\u3002",
      stats: [["\u97E7\u6027", "\u4F4E"], ["\u901F\u5EA6", "\u5FEB"]],
      lore: "\u5C0F\u9B3C\u50F5\u5C38\u6700\u559C\u6B22\u88AB\u6254\u51FA\u53BB\u7684\u90A3\u4E00\u77AC\u95F4\uFF0C\u6BCF\u6B21\u843D\u5730\u5B83\u90FD\u60F3\u8BF4\u201C\u518D\u6765\u4E00\u6B21\u201D\u3002"
    },
    balloon: {
      name: "\u6C14\u7403\u50F5\u5C38",
      hp: 200,
      speed: 26,
      pts: 2,
      weight: 1500,
      firstWave: 8,
      land: true,
      desc: "\u4E58\u7740\u6C14\u7403\u98D8\u8FC7\u4F60\u7684\u9632\u7EBF\uFF0C\u53EA\u6709\u4ED9\u4EBA\u638C\u548C\u4E09\u53F6\u8349\u80FD\u5BF9\u4ED8\u5B83\u3002",
      stats: [["\u97E7\u6027", "\u4F4E"], ["\u7279\u70B9", "\u98DE\u884C\uFF0C\u8D8A\u8FC7\u690D\u7269"], ["\u5F31\u70B9", "\u4ED9\u4EBA\u638C\u3001\u4E09\u53F6\u8349"]],
      lore: "\u6C14\u7403\u50F5\u5C38\u5C0F\u65F6\u5019\u5C31\u60F3\u98DE\u3002\u5B83\u552F\u4E00\u6CA1\u60F3\u660E\u767D\u7684\u662F\uFF0C\u4E0B\u6765\u4E4B\u540E\u8BE5\u600E\u4E48\u529E\u3002"
    },
    digger: {
      name: "\u77FF\u5DE5\u50F5\u5C38",
      hp: 300,
      speed: 40,
      walkSpeed: 19,
      pts: 4,
      weight: 1200,
      firstWave: 8,
      land: true,
      desc: "\u5728\u5730\u5E95\u6316\u96A7\u9053\uFF0C\u4ECE\u4F60\u7684\u623F\u5B50\u90A3\u4E00\u5934\u94BB\u51FA\u6765\uFF0C\u518D\u4ECE\u80CC\u540E\u53D1\u52A8\u88AD\u51FB\u3002",
      stats: [["\u97E7\u6027", "\u4E2D"], ["\u7279\u70B9", "\u5730\u4E0B\u6F5C\u884C\uFF0C\u4ECE\u540E\u65B9\u8FDB\u653B"], ["\u5F31\u70B9", "\u88C2\u835A\u5C04\u624B\u3001\u6768\u6843\u3001\u78C1\u529B\u83C7"]],
      lore: "\u77FF\u5DE5\u50F5\u5C38\u6316\u4E86\u4E00\u8F88\u5B50\u96A7\u9053\uFF0C\u81F3\u4ECA\u6CA1\u6316\u5230\u8FC7\u4E00\u7C92\u91D1\u5B50\uFF0C\u4F46\u5B83\u6316\u5230\u8FC7\u4E09\u53EA\u9F39\u9F20\u548C\u4E00\u53EA\u975E\u5E38\u751F\u6C14\u7684\u737E\u3002"
    },
    pogo: {
      name: "\u8DF3\u8DF3\u50F5\u5C38",
      hp: 500,
      speed: 30,
      walkSpeed: 19,
      pts: 4,
      weight: 1200,
      firstWave: 8,
      land: true,
      desc: "\u8E29\u7740\u5F39\u7C27\u9AD8\u8DF7\u8DF3\u8FC7\u4E00\u682A\u53C8\u4E00\u682A\u690D\u7269\u3002",
      stats: [["\u97E7\u6027", "\u4E2D"], ["\u7279\u70B9", "\u8DF3\u8FC7\u6240\u6709\u690D\u7269"], ["\u5F31\u70B9", "\u9AD8\u575A\u679C\u3001\u78C1\u529B\u83C7"]],
      lore: "\u8DF3\u8DF3\u50F5\u5C38\u505C\u4E0D\u4E0B\u6765\uFF0C\u56E0\u4E3A\u5B83\u5FD8\u4E86\u600E\u4E48\u4E0B\u6765\u3002"
    },
    jackbox: {
      name: "\u5C0F\u4E11\u50F5\u5C38",
      hp: 500,
      speed: 30,
      pts: 3,
      weight: 1e3,
      firstWave: 8,
      land: true,
      desc: "\u5B83\u7684\u73A9\u5177\u76D2\u968F\u65F6\u53EF\u80FD\u7206\u70B8\uFF0C\u70B8\u6BC1\u9644\u8FD1\u7684\u690D\u7269\u3002",
      stats: [["\u97E7\u6027", "\u4E2D"], ["\u901F\u5EA6", "\u5FEB"], ["\u7279\u70B9", "\u4F1A\u7A81\u7136\u81EA\u7206"], ["\u5F31\u70B9", "\u78C1\u529B\u83C7"]],
      lore: "\u5C0F\u4E11\u50F5\u5C38\u7684\u97F3\u4E50\u76D2\u53EA\u4F1A\u5F39\u4E00\u9996\u6B4C\uFF0C\u5B83\u5DF2\u7ECF\u5FAA\u73AF\u64AD\u653E\u4E86\u56DB\u5341\u5E74\u3002"
    }
  };
  var ZOMBIE_ORDER = ["normal", "flag", "cone", "pole", "bucket", "newspaper", "screendoor", "football", "dancer", "backup", "ducky", "snorkel", "zomboni", "dolphin", "balloon", "digger", "pogo", "jackbox", "gargantuar", "imp"];
  var FOG_PLANTS = ["seashroom", "plantern", "cactus", "blover", "splitpea", "starfruit", "pumpkin", "garlic"];
  function plantHomeEnv(id) {
    const d = PLANTS[id];
    if (FOG_PLANTS.includes(id)) return d.aquatic ? "fog" : "night";
    if (d.aquatic) return "pool";
    if (d.night) return "night";
    return "day";
  }
  function rechargeLabel(t) {
    if (t <= 8) return "\u5FEB";
    if (t <= 30) return "\u6162";
    return "\u5F88\u6162";
  }

  // src/gfx/uiArt.js
  function drawSun(ctx, x, y, r, t, alpha = 1) {
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.translate(x, y);
    ctx.globalCompositeOperation = "lighter";
    C(ctx, 0, 0, r * 2.1);
    ctx.fillStyle = rg(ctx, 0, 0, r * 0.3, 0, 0, r * 2.1, [0, "rgba(255,240,120,0.55)", 1, "rgba(255,200,0,0)"]);
    ctx.fill();
    for (let layer = 0; layer < 2; layer++) {
      ctx.save();
      ctx.rotate((layer ? -1 : 1) * t * 0.8 + layer * 0.3);
      star(ctx, 0, 0, r * (layer ? 1.55 : 1.8), r * 0.75, layer ? 7 : 9, 0);
      ctx.fillStyle = layer ? "rgba(255,230,90,0.45)" : "rgba(255,250,170,0.35)";
      ctx.fill();
      ctx.restore();
    }
    ctx.globalCompositeOperation = "source-over";
    C(ctx, 0, 0, r);
    fs(ctx, rg(ctx, -r * 0.3, -r * 0.35, r * 0.1, 0, 0, r, [0, "#fffbd0", 0.45, "#ffe34a", 1, "#ffb400"]), "rgba(230,140,0,0.8)", 1.5);
    C(ctx, -r * 0.3, -r * 0.35, r * 0.28);
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fill();
    ctx.restore();
  }
  function drawProjectile(ctx, p, t) {
    const { x, y } = p;
    switch (p.kind) {
      case "pea":
        E(ctx, x, p.groundY, 8, 3);
        ctx.fillStyle = "rgba(0,0,0,0.18)";
        ctx.fill();
        C(ctx, x, y, 9.5);
        fs(ctx, rg(ctx, x - 3, y - 3, 1, x, y, 10, [0, "#d8ff9a", 0.5, "#7ad63c", 1, "#3c8a1a"]), "#1f4d0b", 1.6);
        C(ctx, x - 3, y - 3.5, 2.6);
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        ctx.fill();
        break;
      case "snow": {
        E(ctx, x, p.groundY, 8, 3);
        ctx.fillStyle = "rgba(0,0,0,0.18)";
        ctx.fill();
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        C(ctx, x - 6, y, 16);
        ctx.fillStyle = rg(ctx, x - 6, y, 2, x - 6, y, 16, [0, "rgba(160,230,255,0.6)", 1, "rgba(80,180,255,0)"]);
        ctx.fill();
        ctx.restore();
        C(ctx, x, y, 9.5);
        fs(ctx, rg(ctx, x - 3, y - 3, 1, x, y, 10, [0, "#ffffff", 0.5, "#9ee2ff", 1, "#3a9ad8"]), "#15486e", 1.6);
        star(ctx, x - 1, y - 1, 5, 1.5, 4, t * 6);
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.fill();
        break;
      }
      case "fire": {
        E(ctx, x, p.groundY, 9, 3);
        ctx.fillStyle = "rgba(0,0,0,0.2)";
        ctx.fill();
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        for (let i = 0; i < 5; i++) {
          const tx = x - 8 - i * 7, ty = y + Math.sin(t * 30 + i) * 2;
          C(ctx, tx, ty, 11 - i * 1.6);
          ctx.fillStyle = rg(ctx, tx, ty, 1, tx, ty, 12 - i * 1.6, [0, "rgba(255,200,60,0.8)", 1, "rgba(255,60,0,0)"]);
          ctx.fill();
        }
        C(ctx, x, y, 16);
        ctx.fillStyle = rg(ctx, x, y, 2, x, y, 16, [0, "rgba(255,255,200,1)", 0.4, "rgba(255,170,30,0.9)", 1, "rgba(255,60,0,0)"]);
        ctx.fill();
        ctx.restore();
        break;
      }
      case "spike": {
        E(ctx, x, p.groundY, 8, 2.5);
        ctx.fillStyle = "rgba(0,0,0,0.15)";
        ctx.fill();
        ctx.save();
        ctx.translate(x, y);
        ctx.beginPath();
        ctx.moveTo(12, 0);
        ctx.lineTo(-10, -3);
        ctx.lineTo(-12, 0);
        ctx.lineTo(-10, 3);
        ctx.closePath();
        fs(ctx, lg(ctx, -12, 0, 12, 0, [0, "#4a8a2a", 1, "#e8ffd0"]), "#1f4d0f", 1.2);
        ctx.restore();
        break;
      }
      case "puff": {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        C(ctx, x, y, 11);
        ctx.fillStyle = rg(ctx, x, y, 1, x, y, 11, [0, "rgba(240,180,255,0.9)", 1, "rgba(160,60,220,0)"]);
        ctx.fill();
        ctx.restore();
        C(ctx, x, y, 5.5);
        fs(ctx, rg(ctx, x - 2, y - 2, 1, x, y, 6, [0, "#fbe8ff", 1, "#b46ae0"]), "#5a2a80", 1.2);
        break;
      }
    }
  }
  function drawMower(ctx, x, y, t, running, pool = false) {
    const shake = running ? Math.sin(t * 60) * 1.2 : 0;
    ctx.save();
    ctx.translate(x, y + shake * 0.5);
    E(ctx, 0, 2, 34, 8);
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fill();
    if (pool) {
      ctx.beginPath();
      ctx.moveTo(-30, -2);
      ctx.lineTo(-26, -26);
      ctx.quadraticCurveTo(0, -36, 24, -26);
      ctx.lineTo(34, -2);
      ctx.closePath();
      fs(ctx, lg(ctx, 0, -34, 0, 0, [0, "#f4f8fc", 1, "#9ab8d0"]), "#1a3a5a", 2);
      ctx.fillStyle = "#2a7ad8";
      ctx.fillRect(-26, -16, 56, 6);
      tube(ctx, [-24, -24, -44, -46, -40, -60], 5, "#d8dce0", "#333", 1.3);
      C(ctx, 26, -12, 6);
      fs(ctx, "#333", "#111", 1.2);
      ctx.restore();
      return;
    }
    tube(ctx, [-18, -20, -40, -44, -46, -56], 4, "#9a9a9a", "#2a2a2a", 1.3);
    tube(ctx, [-46, -56, -54, -54], 5, "#222", "#000", 1);
    ctx.beginPath();
    ctx.moveTo(-28, -6);
    ctx.lineTo(-24, -26);
    ctx.quadraticCurveTo(0, -34, 26, -24);
    ctx.lineTo(32, -6);
    ctx.closePath();
    fs(ctx, lg(ctx, 0, -32, 0, -6, [0, "#ff6a5a", 0.5, "#d8201a", 1, "#8a0a08"]), "#3a0402", 2);
    rr(ctx, -10, -40, 22, 16, 4);
    fs(ctx, lg(ctx, 0, -40, 0, -24, [0, "#d8d8d8", 1, "#7a7a7a"]), "#222", 1.6);
    ctx.fillStyle = "#333";
    for (let i = 0; i < 3; i++) ctx.fillRect(-7 + i * 6, -37, 3, 10);
    if (running) {
      ctx.globalAlpha = 0.5;
      C(ctx, -14 - t * 60 % 20, -44 - t * 40 % 16, 5);
      ctx.fillStyle = "#888";
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    for (const wx of [-18, 20]) {
      C(ctx, wx, -4, 9);
      fs(ctx, "#222", "#000", 1.5);
      C(ctx, wx, -4, 3.5);
      fs(ctx, "#bbb", "#444", 1);
      if (running) {
        ctx.strokeStyle = "#666";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        const a = t * 30;
        ctx.moveTo(wx + Math.cos(a) * 3.5, -4 + Math.sin(a) * 3.5);
        ctx.lineTo(wx + Math.cos(a) * 8, -4 + Math.sin(a) * 8);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
  function drawGrave(ctx, x, y, variant, t, o = {}) {
    const sink = o.sink || 0;
    const rise = o.rise ?? 1;
    ctx.save();
    ctx.translate(x, y);
    E(ctx, 0, -4, 38, 12);
    fs(ctx, rg(ctx, -8, -10, 2, 0, -4, 38, [0, "#6a5a4a", 1, "#3a2e24"]), "#1e1812", 1.5);
    ctx.beginPath();
    ctx.rect(-60, -140, 120, 136);
    ctx.clip();
    ctx.translate(0, sink * 70 + (1 - rise) * 80);
    const stoneL = "#b8b8c4", stoneD = "#6a6a7a", stroke = "#2a2a36";
    ctx.beginPath();
    if (variant === 0) {
      ctx.moveTo(-24, -4);
      ctx.lineTo(-24, -50);
      ctx.bezierCurveTo(-24, -76, 24, -76, 24, -50);
      ctx.lineTo(24, -4);
    } else if (variant === 1) {
      ctx.moveTo(-8, -4);
      ctx.lineTo(-8, -42);
      ctx.lineTo(-24, -42);
      ctx.lineTo(-24, -56);
      ctx.lineTo(-8, -56);
      ctx.lineTo(-8, -76);
      ctx.lineTo(8, -76);
      ctx.lineTo(8, -56);
      ctx.lineTo(24, -56);
      ctx.lineTo(24, -42);
      ctx.lineTo(8, -42);
      ctx.lineTo(8, -4);
    } else if (variant === 2) {
      ctx.moveTo(-22, -4);
      ctx.lineTo(-26, -54);
      ctx.lineTo(0, -74);
      ctx.lineTo(26, -54);
      ctx.lineTo(22, -4);
    } else {
      ctx.moveTo(-28, -4);
      ctx.lineTo(-26, -44);
      ctx.quadraticCurveTo(-20, -58, 0, -60);
      ctx.quadraticCurveTo(20, -58, 26, -44);
      ctx.lineTo(28, -4);
    }
    ctx.closePath();
    fs(ctx, lg(ctx, -24, -70, 24, 0, [0, stoneL, 1, stoneD]), stroke, 2);
    ctx.strokeStyle = "rgba(30,30,40,0.55)";
    ctx.lineWidth = 1.6;
    if (variant !== 1) {
      ctx.beginPath();
      ctx.moveTo(-10, -42);
      ctx.lineTo(10, -42);
      ctx.moveTo(-12, -34);
      ctx.lineTo(12, -34);
      ctx.moveTo(-8, -26);
      ctx.lineTo(8, -26);
      ctx.stroke();
      ctx.font = "900 11px " + FONT;
      ctx.fillStyle = "rgba(30,30,40,0.6)";
      ctx.textAlign = "center";
      ctx.fillText("R.I.P", 0, -48);
    }
    ctx.beginPath();
    ctx.moveTo(14, -58);
    ctx.lineTo(8, -48);
    ctx.lineTo(12, -40);
    ctx.stroke();
    ctx.fillStyle = "rgba(80,140,70,0.55)";
    E(ctx, -14, -8, 10, 5);
    ctx.fill();
    E(ctx, 18, -6, 7, 4);
    ctx.fill();
    ctx.restore();
  }
  function drawCrater(ctx, x, y, t, k) {
    ctx.save();
    ctx.translate(x, y - 30);
    ctx.globalAlpha *= clamp(k * 3, 0, 1);
    E(ctx, 0, 0, 46, 22);
    fs(ctx, rg(ctx, 0, 4, 4, 0, 0, 46, [0, "#140c08", 0.6, "#2a1c14", 1, "#4a3424"]), "#1a120c", 2);
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * TAU;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 44, Math.sin(a) * 20);
      ctx.lineTo(Math.cos(a) * 56, Math.sin(a) * 26);
      ctx.stroke();
    }
    if (k > 0.8) {
      ctx.globalAlpha *= 0.4;
      const p = t * 0.6 % 1;
      C(ctx, Math.sin(t) * 10, -p * 40, 10 + p * 10);
      ctx.fillStyle = "#555";
      ctx.fill();
    }
    ctx.restore();
  }
  var iconCache = /* @__PURE__ */ new Map();
  function plantIcon(type, size = 64) {
    const scale = display.cacheScale;
    const key = type + "@" + size + "@" + scale;
    let c = iconCache.get(key);
    if (c) return c;
    const buf = display.makeCanvas(size, size, scale);
    const ctx = buf.ctx;
    const art = PLANT_ART[type];
    const tall = { tallnut: 1.35, chomper: 1.25, threepeater: 1.15, hypnoshroom: 1.1, torchwood: 1.2, jalapeno: 1.15, gravebuster: 1.05, magnetshroom: 1.05 }[type] || 1;
    const s = size / 100 * (1.05 / tall);
    ctx.translate(size / 2, size * 0.9);
    ctx.scale(s, s);
    if (type === "gravebuster") ctx.translate(0, 20);
    if (art) art(ctx, { t: 0.5, phase: 0, icon: true, armed: true, rise: 1 });
    iconCache.set(key, buf);
    return buf;
  }
  function bowlIcon(kind) {
    const scale = display.cacheScale;
    const key = "bowl-" + kind + "@" + scale;
    let c = iconCache.get(key);
    if (c) return c;
    const buf = display.makeCanvas(64, 64, scale);
    buf.ctx.translate(32, 56);
    buf.ctx.scale(kind === "giant" ? 0.5 : 0.78, kind === "giant" ? 0.5 : 0.78);
    bowlnut(buf.ctx, { roll: 0 }, kind);
    if (kind === "giant") {
      buf.ctx.setTransform(scale, 0, 0, scale, 0, 0);
      text(buf.ctx, "\u5DE8\u578B", 32, 12, { size: 13, color: "#fff", stroke: "#5a2a00", lw: 3 });
    }
    iconCache.set(key, buf);
    return buf;
  }
  var PACKET_W = 62;
  var PACKET_H = 86;
  function drawPacket(ctx, x, y, type, o = {}) {
    const w = o.w || PACKET_W, h = o.h || PACKET_H;
    const def = PLANTS[type];
    ctx.save();
    ctx.translate(x, y);
    if (o.scale) ctx.scale(o.scale, o.scale);
    if (o.shadow !== false) {
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      rr(ctx, 3, 4, w, h, 6);
      ctx.fill();
    }
    rr(ctx, 0, 0, w, h, 6);
    fs(ctx, lg(ctx, 0, 0, 0, h, [0, "#fbf1c8", 1, "#e2cf92"]), "#6a5220", 2);
    const bgCols = def?.night ? ["#d8c8ec", "#a890c8"] : def?.aquatic ? ["#c8ecf4", "#88c4d8"] : ["#d8f0b4", "#9ccc6a"];
    rr(ctx, 5, 5, w - 10, h - 30, 4);
    fs(ctx, lg(ctx, 0, 5, 0, h - 25, [0, bgCols[0], 1, bgCols[1]]), "rgba(80,60,20,0.5)", 1.2);
    const icon = type.startsWith("bowl-") ? bowlIcon(type.slice(5)) : plantIcon(type, 64);
    const iw = w - 8;
    ctx.drawImage(icon.canvas, 4, 3, iw, iw * (icon.h / icon.w));
    if (!o.noCost) {
      rr(ctx, 7, h - 23, w - 14, 18, 4);
      fs(ctx, "#fffbe6", "rgba(90,70,30,0.6)", 1);
      text(ctx, String(o.cost ?? def?.cost ?? 0), w / 2, h - 13.5, { size: 15, color: "#1a1206", weight: 900 });
    }
    if (o.recharge > 0) {
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      rr(ctx, 0, 0, w, h * o.recharge, 6);
      ctx.fill();
    }
    if (o.disabled) {
      ctx.fillStyle = "rgba(0,0,0,0.42)";
      rr(ctx, 0, 0, w, h, 6);
      ctx.fill();
    }
    if (o.selected) {
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      rr(ctx, 0, 0, w, h, 6);
      ctx.fill();
    }
    if (o.hover && !o.disabled) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = "rgba(255,255,200,0.18)";
      rr(ctx, 0, 0, w, h, 6);
      ctx.fill();
      ctx.restore();
    }
    if (o.glow) {
      ctx.save();
      ctx.globalAlpha *= o.glow;
      ctx.lineWidth = 4;
      ctx.strokeStyle = "#fff6a0";
      rr(ctx, -2, -2, w + 4, h + 4, 8);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }
  function drawSeedBank(ctx, x, y, slots, o = {}) {
    const w = 96 + slots * (PACKET_W + 6) + 6;
    const h = 98;
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    rr(ctx, x + 3, y + 4, w, h, 10);
    ctx.fill();
    rr(ctx, x, y, w, h, 10);
    fs(ctx, lg(ctx, 0, y, 0, y + h, [0, "#9a6a3c", 0.5, "#7a4e26", 1, "#5a3614"]), "#2e1a08", 2.5);
    ctx.save();
    rr(ctx, x, y, w, h, 10);
    ctx.clip();
    ctx.strokeStyle = "rgba(40,20,5,0.25)";
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 7; i++) {
      ctx.beginPath();
      ctx.moveTo(x, y + 8 + i * 13);
      ctx.bezierCurveTo(x + w * 0.3, y + 4 + i * 13, x + w * 0.6, y + 14 + i * 13, x + w, y + 8 + i * 13);
      ctx.stroke();
    }
    ctx.restore();
    if (!o.noSun) {
      rr(ctx, x + 8, y + 6, 80, 86, 8);
      fs(ctx, "rgba(40,20,5,0.35)");
      rr(ctx, x + 14, y + 64, 68, 24, 6);
      fs(ctx, lg(ctx, 0, y + 64, 0, y + 88, [0, "#fffbe6", 1, "#e8dcb0"]), "#5a4010", 1.5);
    }
    for (let i = 0; i < slots; i++) {
      const sx = x + 96 + i * (PACKET_W + 6);
      rr(ctx, sx, y + 6, PACKET_W, PACKET_H, 6);
      fs(ctx, "rgba(30,15,3,0.45)", "rgba(0,0,0,0.3)", 1);
    }
    ctx.restore();
    return w;
  }
  function drawShovel(ctx, x, y, s = 1, rot = -0.75) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.rotate(rot);
    tube(ctx, [0, -34, 0, 10], 6, "#b07a3a", "#3a2008", 1.5);
    rr(ctx, -9, -44, 18, 10, 4);
    fs(ctx, "#8a5a24", "#3a2008", 1.5);
    ctx.beginPath();
    ctx.moveTo(-12, 8);
    ctx.lineTo(12, 8);
    ctx.lineTo(12, 26);
    ctx.quadraticCurveTo(0, 42, -12, 26);
    ctx.closePath();
    fs(ctx, lg(ctx, -12, 0, 12, 0, [0, "#9aa4ac", 0.4, "#f0f4f8", 1, "#7a848c"]), "#2a3036", 1.8);
    ctx.restore();
  }
  function drawShovelBox(ctx, x, y, hover, active) {
    rr(ctx, x + 3, y + 4, 78, 78, 10);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fill();
    rr(ctx, x, y, 78, 78, 10);
    fs(ctx, lg(ctx, 0, y, 0, y + 78, [0, "#9a6a3c", 1, "#5a3614"]), "#2e1a08", 2.5);
    rr(ctx, x + 7, y + 7, 64, 64, 8);
    fs(ctx, "rgba(30,15,3,0.5)", hover ? "#ffe68a" : "rgba(0,0,0,0.3)", hover ? 2.5 : 1);
    if (!active) drawShovel(ctx, x + 39, y + 40, 1.05);
  }
  function drawButton(ctx, b) {
    const { x, y, w, h } = b;
    const press = b.pressed ? 2 : 0;
    const hov = b.hover && !b.disabled;
    const style = b.style || "green";
    ctx.save();
    if (b.alpha !== void 0) ctx.globalAlpha *= b.alpha;
    ctx.translate(0, press);
    const cols = {
      green: ["#9ee05a", "#4f9a22", "#1f4a0a", "#fff"],
      stone: ["#b8bcc4", "#6a6e7a", "#26282e", "#f4f4f0"],
      wood: ["#d8a060", "#8a5a2a", "#3a2008", "#fff4d8"],
      red: ["#ff8a6a", "#c02a1a", "#4a0802", "#fff"],
      purple: ["#c89aea", "#6a3a9a", "#2a0a4a", "#fff"],
      gold: ["#ffe07a", "#d89a1a", "#5a3a00", "#3a2000"]
    }[style];
    const r = b.radius ?? Math.min(14, h / 2);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    rr(ctx, x + 2, y + 5 - press, w, h, r);
    ctx.fill();
    rr(ctx, x, y, w, h, r);
    fs(ctx, lg(ctx, 0, y, 0, y + h, [0, hov ? shade(cols[0], 0.15) : cols[0], 1, hov ? shade(cols[1], 0.1) : cols[1]]), cols[2], 2.5);
    ctx.save();
    rr(ctx, x + 4, y + 3, w - 8, h * 0.42, r * 0.8);
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.fill();
    ctx.restore();
    if (style === "stone") {
      ctx.strokeStyle = "rgba(0,0,0,0.2)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + w * 0.2, y + h * 0.8);
      ctx.lineTo(x + w * 0.26, y + h * 0.6);
      ctx.lineTo(x + w * 0.22, y + h * 0.45);
      ctx.stroke();
    }
    const fsz = b.fontSize || Math.min(26, h * 0.46);
    text(ctx, b.label, x + w / 2 + (b.icon ? 12 : 0), y + h / 2 + 1, { size: fsz, color: b.disabled ? "#aaa" : cols[3], stroke: cols[2], lw: fsz * 0.22 });
    if (b.disabled) {
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      rr(ctx, x, y, w, h, r);
      ctx.fill();
    }
    ctx.restore();
  }
  function drawPanel(ctx, x, y, w, h, style = "stone") {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    rr(ctx, x + 6, y + 8, w, h, 22);
    ctx.fill();
    if (style === "stone") {
      rr(ctx, x, y, w, h, 22);
      fs(ctx, lg(ctx, x, y, x + w * 0.3, y + h, [0, "#9aa0ac", 0.5, "#6e7482", 1, "#4a4e5a"]), "#1e2026", 3);
      rr(ctx, x + 10, y + 10, w - 20, h - 20, 16);
      fs(ctx, lg(ctx, 0, y, 0, y + h, [0, "#5a5e6a", 1, "#3a3e48"]), "rgba(255,255,255,0.12)", 2);
      ctx.save();
      rr(ctx, x, y, w, h, 22);
      ctx.clip();
      ctx.strokeStyle = "rgba(0,0,0,0.18)";
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        const sx = x + i * 173 % w, sy = y + i * 97 % h;
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + 14, sy + 10);
        ctx.lineTo(sx + 10, sy + 24);
        ctx.stroke();
      }
      ctx.restore();
    } else if (style === "paper") {
      rr(ctx, x, y, w, h, 16);
      fs(ctx, lg(ctx, 0, y, 0, y + h, [0, "#f8eecc", 1, "#e0cc98"]), "#5a4418", 3);
    } else if (style === "wood") {
      rr(ctx, x, y, w, h, 18);
      fs(ctx, lg(ctx, 0, y, 0, y + h, [0, "#a8743e", 1, "#6a4418"]), "#2e1a08", 3);
      ctx.save();
      rr(ctx, x, y, w, h, 18);
      ctx.clip();
      ctx.strokeStyle = "rgba(40,20,5,0.25)";
      for (let i = 0; i < h / 14; i++) {
        ctx.beginPath();
        ctx.moveTo(x, y + i * 14 + 6);
        ctx.bezierCurveTo(x + w * 0.3, y + i * 14, x + w * 0.7, y + i * 14 + 12, x + w, y + i * 14 + 6);
        ctx.stroke();
      }
      ctx.restore();
    } else if (style === "dark") {
      rr(ctx, x, y, w, h, 18);
      fs(ctx, "rgba(12,16,10,0.88)", "rgba(200,255,150,0.25)", 2);
    }
    ctx.restore();
  }
  function drawTrophy(ctx, x, y, s = 1, t = 0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.rotate(t * 0.5);
    star(ctx, 0, -30, 70, 30, 12);
    ctx.fillStyle = "rgba(255,230,120,0.25)";
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    ctx.moveTo(-26, -58);
    ctx.lineTo(26, -58);
    ctx.quadraticCurveTo(26, -18, 0, -14);
    ctx.quadraticCurveTo(-26, -18, -26, -58);
    fs(ctx, lg(ctx, -26, 0, 26, 0, [0, "#c88a10", 0.4, "#ffe680", 1, "#b07808"]), "#5a3a00", 2.5);
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(sx * 30, -46, 10, sx > 0 ? -1.6 : 1.6 + 0, sx > 0 ? 1.6 : 4.7);
      ctx.lineWidth = 5;
      ctx.strokeStyle = "#d8a020";
      ctx.stroke();
    }
    ctx.fillStyle = "#d8a020";
    ctx.fillRect(-5, -16, 10, 12);
    rr(ctx, -18, -6, 36, 10, 3);
    fs(ctx, lg(ctx, 0, -6, 0, 4, [0, "#8a5a2a", 1, "#5a3614"]), "#2a1a08", 1.5);
    ctx.restore();
  }
  function drawNote(ctx, x, y, s = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.rotate(-0.1);
    rr(ctx, -24, -60, 48, 56, 3);
    fs(ctx, lg(ctx, 0, -60, 0, -4, [0, "#fffef0", 1, "#e8e0c0"]), "#6a5a30", 2);
    ctx.strokeStyle = "rgba(60,80,160,0.5)";
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(-18, -48 + i * 9);
      ctx.lineTo(18, -48 + i * 9);
      ctx.stroke();
    }
    ctx.restore();
  }
  function drawLogo(ctx, x, y, s = 1, t = 0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.rotate(-0.03);
    const bounce = Math.sin(t * 2) * 2;
    const leafText = (str, cx, cy, size, rot) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.font = `900 ${size}px ${FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineJoin = "round";
      ctx.lineWidth = size * 0.34;
      ctx.strokeStyle = "#123a06";
      ctx.strokeText(str, 0, 4);
      ctx.lineWidth = size * 0.22;
      ctx.strokeStyle = "#2e7a12";
      ctx.strokeText(str, 0, 0);
      ctx.fillStyle = lg(ctx, 0, -size / 2, 0, size / 2, [0, "#e4ff9a", 0.5, "#8ee03a", 1, "#3e9a16"]);
      ctx.fillText(str, 0, 0);
      ctx.restore();
    };
    const zText = (str, cx, cy, size, rot) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.font = `900 ${size}px ${FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineJoin = "round";
      ctx.lineWidth = size * 0.34;
      ctx.strokeStyle = "#1a1a14";
      ctx.strokeText(str, 0, 4);
      ctx.lineWidth = size * 0.2;
      ctx.strokeStyle = "#4a4a3a";
      ctx.strokeText(str, 0, 0);
      ctx.fillStyle = lg(ctx, 0, -size / 2, 0, size / 2, [0, "#e8ecd8", 0.55, "#a8b48c", 1, "#6a7a5a"]);
      ctx.fillText(str, 0, 0);
      ctx.fillStyle = "#8a9a70";
      for (const [dx, len] of [[-size * 0.55, 18], [-size * 0.1, 26], [size * 0.42, 14], [size * 0.8, 20]]) {
        ctx.beginPath();
        ctx.moveTo(dx - 4, size * 0.34);
        ctx.lineTo(dx + 4, size * 0.34);
        ctx.lineTo(dx + 2, size * 0.34 + len + Math.sin(t * 2 + dx) * 3);
        ctx.arc(dx, size * 0.34 + len + Math.sin(t * 2 + dx) * 3, 3.5, 0, Math.PI);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    };
    leafText("\u690D\u7269", -150, -8 + bounce, 104, -0.06);
    ctx.save();
    ctx.translate(-250, -60 + bounce);
    ctx.rotate(-0.6);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(20, -24, 48, -4);
    ctx.quadraticCurveTo(22, 14, 0, 0);
    fs(ctx, "#7ad63c", "#1f4d0f", 3);
    ctx.restore();
    ctx.save();
    ctx.translate(12, 8);
    C(ctx, 0, 0, 44);
    fs(ctx, rg(ctx, -10, -12, 4, 0, 0, 44, [0, "#ffeb6a", 1, "#e07a0a"]), "#5a2a00", 4);
    text(ctx, "\u5927\u6218", 0, 2, { size: 30, color: "#fff", stroke: "#6a2a00", lw: 7 });
    ctx.restore();
    zText("\u50F5\u5C38", 170, 6 - bounce, 104, 0.05);
    ctx.restore();
  }

  // src/gfx/zombieArt.js
  var SKIN = { light: "#bfcda5", mid: "#9aae86", dark: "#6f8260", stroke: "#2f3a26" };
  var LOOKS = {
    normal: { coat: "#6e5641", coatDark: "#48362a", pants: "#5a4a3b", shirt: "#eee7d6", tie: "#c1232c" },
    flag: { coat: "#6e5641", coatDark: "#48362a", pants: "#5a4a3b", shirt: "#eee7d6", tie: "#c1232c", held: "flag" },
    cone: { coat: "#6e5641", coatDark: "#48362a", pants: "#5a4a3b", shirt: "#eee7d6", tie: "#c1232c" },
    bucket: { coat: "#6e5641", coatDark: "#48362a", pants: "#5a4a3b", shirt: "#eee7d6", tie: "#c1232c" },
    screendoor: { coat: "#5e5a4a", coatDark: "#3e3a2e", pants: "#4a4a5a", shirt: "#eee7d6", tie: "#2a6ac1", held: "door" },
    newspaper: { coat: "#8b8274", coatDark: "#5e5649", pants: "#6a5d86", shirt: "#f2efe6", tie: "#6a3a8a", held: "paper", glasses: true, hair: "#e8e8e8" },
    pole: { coat: "#f2f0ea", coatDark: "#b8b4a8", pants: "#2f4fb8", shirt: "#f2f0ea", tie: null, stripe: "#d8322a", held: "pole", band: "#d8322a", sleeveless: true },
    football: { coat: "#c8202a", coatDark: "#8a1018", pants: "#e8e6de", shirt: "#c8202a", tie: null, pads: true, number: "9" },
    dancer: { coat: "#6a3aa8", coatDark: "#43207a", pants: "#f0ece0", shirt: "#f4d23a", tie: null, afro: "#2a1a10", chain: true },
    backup: { coat: "#2f9ad2", coatDark: "#1a6a98", pants: "#f0ece0", shirt: "#f4f4f4", tie: null, afro: "#3a2414", band: "#f4d23a" },
    ducky: { coat: "#6e5641", coatDark: "#48362a", pants: "#5a4a3b", shirt: "#eee7d6", tie: "#c1232c", tube: true },
    snorkel: { coat: "#8a9a7a", coatDark: "#5a6a4a", pants: "#1a2a3a", shirt: "#8a9a7a", tie: null, bare: true, mask: true },
    dolphin: { coat: "#26323e", coatDark: "#141c24", pants: "#26323e", shirt: "#26323e", tie: null, goggles: true },
    imp: { coat: "#b08a60", coatDark: "#7a5a38", pants: "#7a5a38", shirt: "#b08a60", tie: null, small: true },
    balloon: { coat: "#6a5a8a", coatDark: "#443a60", pants: "#4a4a5a", shirt: "#eee7d6", tie: "#e8b020", held: "balloon" },
    digger: { coat: "#9a7440", coatDark: "#6a4e28", pants: "#5a4a3a", shirt: "#d8b070", tie: null, hardhat: true, held: "pickaxe" },
    pogo: { coat: "#3a6ac8", coatDark: "#24448a", pants: "#2a3060", shirt: "#f4f4f4", tie: null, held: "pogo", band: "#f0c020" },
    jackbox: { coat: "#c83a3a", coatDark: "#8a2020", pants: "#3a3a8a", shirt: "#f4e04a", tie: null, held: "jackbox", clown: true }
  };
  function pose(z) {
    const t = z.t || 0;
    const ph = z.walkPh || 0;
    const p = {
      legF: 0,
      legB: 0,
      kneeF: 0,
      kneeB: 0,
      lean: -0.05,
      armUF: 0.3,
      armLF: 0.45,
      armUB: 0.2,
      armLB: 0.4,
      headRot: -0.03,
      headX: 0,
      headY: 0,
      jaw: 0.25,
      bob: 0
    };
    const st = z.anim || "walk";
    if (st === "walk" || st === "run") {
      const amp = st === "run" ? 0.62 : 0.42;
      p.legF = Math.sin(ph) * amp;
      p.legB = -Math.sin(ph) * amp;
      p.kneeF = Math.max(0, -Math.cos(ph)) * (st === "run" ? 1 : 0.55);
      p.kneeB = Math.max(0, Math.cos(ph)) * (st === "run" ? 1 : 0.55);
      p.lean = (st === "run" ? -0.2 : -0.07) + Math.sin(ph * 2) * 0.02;
      p.armUF = 0.3 - Math.sin(ph) * 0.22;
      p.armLF = 0.5;
      p.armUB = 0.22 + Math.sin(ph) * 0.22;
      p.armLB = 0.45;
      p.headRot = -0.04 + Math.sin(ph) * 0.06;
      p.jaw = 0.22 + Math.sin(t * 3.1) * 0.12;
      if (st === "run") {
        p.armUF = 0.6 - Math.sin(ph) * 0.5;
        p.armUB = 0.6 + Math.sin(ph) * 0.5;
        p.armLF = p.armLB = 1.2;
      }
    } else if (st === "eat") {
      const e = z.eatPh || 0;
      p.legF = 0.2;
      p.legB = -0.22;
      p.kneeF = 0.1;
      p.kneeB = 0.15;
      p.lean = -0.16 + Math.sin(e) * 0.05;
      p.armUF = 1.3 + Math.sin(e) * 0.25;
      p.armLF = 0.35 + Math.sin(e + 0.5) * 0.25;
      p.armUB = 1.15 + Math.sin(e + 1.2) * 0.22;
      p.armLB = 0.4;
      p.headRot = -0.18 + Math.sin(e) * 0.12;
      p.headX = -2 + Math.sin(e) * 3;
      p.jaw = 0.25 + Math.max(0, Math.sin(e * 2)) * 0.7;
    } else if (st === "idle") {
      const s = Math.sin(t * 1.6 + (z.seed || 0));
      p.legF = 0.08;
      p.legB = -0.08;
      p.lean = -0.05 + s * 0.03;
      p.armUF = 0.2 + s * 0.08;
      p.armUB = 0.15 - s * 0.06;
      p.headRot = -0.05 + Math.sin(t * 1.1 + (z.seed || 0)) * 0.07;
      p.jaw = 0.2 + Math.sin(t * 2.3) * 0.12;
    } else if (st === "dance") {
      const d = t * 6;
      p.legF = Math.sin(d) * 0.3;
      p.legB = -Math.sin(d) * 0.3;
      p.kneeF = 0.3;
      p.kneeB = 0.3;
      p.lean = Math.sin(d * 0.5) * 0.12;
      p.armUF = 2.6 + Math.sin(d) * 0.3;
      p.armLF = 0.2;
      p.armUB = 0.9 + Math.cos(d) * 0.4;
      p.armLB = 0.8;
      p.headRot = Math.sin(d * 0.5) * 0.15;
      p.jaw = 0.4;
    } else if (st === "point") {
      p.armUF = 2.4;
      p.armLF = 0.1;
      p.armUB = 0.3;
      p.lean = 0.04;
      p.headRot = 0.1;
      p.jaw = 0.6;
    } else if (st === "jump") {
      const j = z.jumpT || 0;
      p.legF = 0.8;
      p.legB = -0.5;
      p.kneeF = 1.2;
      p.kneeB = 1;
      p.lean = -0.5 + j * 0.6;
      p.armUF = 2.2;
      p.armLF = 0.2;
      p.armUB = 2;
      p.armLB = 0.2;
      p.jaw = 0.8;
    } else if (st === "swim") {
      p.armUF = 0.9 + Math.sin(t * 4) * 0.4;
      p.armLF = 0.6;
      p.armUB = 0.9 - Math.sin(t * 4) * 0.4;
      p.armLB = 0.6;
      p.lean = -0.08;
      p.jaw = 0.3 + Math.sin(t * 3) * 0.1;
      p.legF = Math.sin(t * 5) * 0.3;
      p.legB = -Math.sin(t * 5) * 0.3;
    } else if (st === "die") {
      p.legF = 0.05;
      p.legB = -0.1;
      p.armUF = 0.1;
      p.armUB = 0.05;
      p.armLF = 0.2;
      p.lean = 0.1;
    } else if (st === "angry") {
      p.armUF = 2.2 + Math.sin(t * 20) * 0.3;
      p.armLF = 0.6;
      p.armUB = 2 + Math.cos(t * 20) * 0.3;
      p.armLB = 0.6;
      p.jaw = 0.9;
      p.lean = 0.1;
    }
    if (st === "float") {
      p.legF = 0.25 + Math.sin(t * 2.2) * 0.2;
      p.legB = -0.1 + Math.sin(t * 2.2 + 1) * 0.2;
      p.kneeF = 0.3;
      p.kneeB = 0.4;
      p.armUF = 2.9;
      p.armLF = 0.2;
      p.armUB = 2.6;
      p.armLB = 0.3;
      p.headRot = Math.sin(t * 1.3) * 0.08;
      p.lean = Math.sin(t * 1.1) * 0.05;
    } else if (st === "pogo") {
      p.legF = 0.35;
      p.legB = 0.2;
      p.kneeF = 0.9;
      p.kneeB = 1;
      p.armUF = 1;
      p.armLF = 0.4;
      p.armUB = 0.9;
      p.armLB = 0.5;
      p.lean = -0.05;
    } else if (st === "dig") {
      const d = t * 5;
      p.armUF = 2.2 + Math.sin(d) * 0.6;
      p.armLF = 0.4;
      p.armUB = 1.8 + Math.sin(d) * 0.5;
      p.armLB = 0.5;
      p.lean = -0.2;
    }
    const held = z.held;
    if (held === "paper" && st !== "eat") {
      p.armUF = 0.95;
      p.armLF = 0.9;
      p.armUB = 0.85;
      p.armLB = 1;
    }
    if (held === "door" && st !== "die") {
      p.armUF = 0.75;
      p.armLF = 0.5;
    }
    if (held === "pole" && st !== "jump") {
      p.armUF = 0.75;
      p.armLF = 0.9;
      p.armUB = 0.65;
      p.armLB = 0.9;
    }
    if (held === "flag") {
      p.armLF = 1.3;
      p.armUF = 0.55;
    }
    if (held === "jackbox" && st !== "eat") {
      p.armUF = 0.9;
      p.armLF = 0.8;
      p.armUB = 0.8;
      p.armLB = 0.9;
    }
    if (held === "pickaxe" && st === "walk") {
      p.armUF = 2.4;
      p.armLF = 0.3;
    }
    return p;
  }
  function legPoints(hx, hy, a, knee, L1 = 25, L2 = 24) {
    const kx = hx - Math.sin(a) * L1, ky = hy + Math.cos(a) * L1;
    const b = a - knee;
    const fx = kx - Math.sin(b) * L2, fy = ky + Math.cos(b) * L2;
    return { kx, ky, fx, fy, b };
  }
  function drawLeg(ctx, hip, lp, L, dark, sc) {
    const pants = dark ? L.pantsDark || shadeHex(L.pants, -0.25) : L.pants;
    const stroke = "#1e1812";
    tube(ctx, [hip.x, hip.y, lp.kx, lp.ky], 11 * sc, pants, stroke, 1.6);
    tube(ctx, [lp.kx, lp.ky, lp.fx, lp.fy], 10 * sc, pants, stroke, 1.6);
    if (L.bare) {
      tube(ctx, [lp.kx, lp.ky, lp.fx, lp.fy - 2], 7.5 * sc, dark ? SKIN.dark : SKIN.mid, SKIN.stroke, 1.4);
    }
    ctx.save();
    ctx.translate(lp.fx, lp.fy);
    ctx.rotate(-lp.b * 0.6);
    E(ctx, -5 * sc, -2, 10.5 * sc, 5 * sc);
    const shoe = L.shoe || (dark ? "#231a12" : "#3a2c1e");
    fs(ctx, shoe, "#0e0a06", 1.5);
    ctx.restore();
  }
  function drawArm(ctx, sx, sy, au, al, L, far, sc, o = {}) {
    const L1 = 21 * sc, L2 = 19 * sc;
    const ex = sx - Math.sin(au) * L1, ey = sy + Math.cos(au) * L1;
    const b = au + al;
    const hx = ex - Math.sin(b) * L2, hy = ey + Math.cos(b) * L2;
    const sleeve = far ? L.coatDark : L.coat;
    const stroke = "#1e1812";
    if (o.stump) {
      const mx = sx - Math.sin(au) * L1 * 0.5, my = sy + Math.cos(au) * L1 * 0.5;
      tube(ctx, [sx, sy, mx, my], 10 * sc, sleeve, stroke, 1.6);
      C(ctx, mx, my, 4 * sc);
      fs(ctx, "#7a2a2a", stroke, 1.2);
      return { hx: mx, hy: my };
    }
    if (L.sleeveless || L.bare) {
      tube(ctx, [sx, sy, ex, ey], 8.5 * sc, far ? SKIN.dark : SKIN.mid, SKIN.stroke, 1.5);
      tube(ctx, [ex, ey, hx, hy], 7.5 * sc, far ? SKIN.dark : SKIN.mid, SKIN.stroke, 1.5);
      if (L.sleeveless && !L.bare) {
        C(ctx, sx, sy + 2, 6 * sc);
        fs(ctx, sleeve, stroke, 1.3);
      }
    } else {
      tube(ctx, [sx, sy, ex, ey], 10 * sc, sleeve, stroke, 1.6);
      tube(ctx, [ex, ey, hx + Math.sin(b) * 5, hy - Math.cos(b) * 5], 9 * sc, sleeve, stroke, 1.6);
      if (L.pads && !far) {
        E(ctx, sx + 2, sy - 1, 13 * sc, 10 * sc);
        fs(ctx, rg(ctx, sx - 3, sy - 5, 1, sx, sy, 13, [0, "#ff5a5a", 1, L.coatDark]), stroke, 1.6);
      }
    }
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(b);
    const skin = far ? SKIN.dark : SKIN.mid;
    ctx.strokeStyle = SKIN.stroke;
    ctx.lineWidth = 1.3;
    for (let i = -1; i <= 1; i++) tube(ctx, [i * 2.5 * sc, 2 * sc, i * 3.4 * sc, 8 * sc], 2.6 * sc, skin, SKIN.stroke, 1.1);
    E(ctx, 0, 1.5 * sc, 5 * sc, 4.5 * sc);
    fs(ctx, skin, SKIN.stroke, 1.3);
    ctx.restore();
    return { hx, hy, ex, ey };
  }
  function shadeHex(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255;
    const f = (v) => Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt));
    return "#" + (1 << 24 | f(r) << 16 | f(g) << 8 | f(b)).toString(16).slice(1);
  }
  function drawTorso(ctx, L, sc, z) {
    const stroke = "#1e1812";
    ctx.beginPath();
    ctx.moveTo(-13 * sc, 3);
    ctx.lineTo(-17 * sc, -28 * sc);
    ctx.quadraticCurveTo(-19 * sc, -46 * sc, -11 * sc, -51 * sc);
    ctx.lineTo(7 * sc, -52 * sc);
    ctx.quadraticCurveTo(17 * sc, -49 * sc, 15 * sc, -28 * sc);
    ctx.lineTo(13 * sc, 3);
    ctx.quadraticCurveTo(0, 7, -13 * sc, 3);
    ctx.closePath();
    const coat = L.bare ? SKIN.mid : L.coat;
    fs(ctx, lg(ctx, -18 * sc, 0, 16 * sc, 0, [0, shadeHex(coat, 0.12), 0.5, coat, 1, L.bare ? SKIN.dark : L.coatDark]), stroke, 1.8);
    if (L.bare) {
      ctx.strokeStyle = SKIN.stroke;
      ctx.lineWidth = 1;
      ctx.globalAlpha *= 0.5;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(-4 * sc, (-40 + i * 7) * sc, 7 * sc, 0.3, 1.9);
        ctx.stroke();
      }
      ctx.globalAlpha /= 0.5;
      ctx.beginPath();
      ctx.moveTo(-14 * sc, -4 * sc);
      ctx.lineTo(14 * sc, -4 * sc);
      ctx.lineTo(13 * sc, 4);
      ctx.quadraticCurveTo(0, 8, -13 * sc, 4);
      ctx.closePath();
      fs(ctx, L.pants, stroke, 1.5);
      return;
    }
    if (L.shirt && L.shirt !== L.coat) {
      ctx.beginPath();
      ctx.moveTo(-14 * sc, -50 * sc);
      ctx.lineTo(-3 * sc, -51 * sc);
      ctx.lineTo(-9 * sc, -20 * sc);
      ctx.closePath();
      fs(ctx, L.shirt, stroke, 1.3);
    }
    if (L.tie) {
      ctx.beginPath();
      ctx.moveTo(-10 * sc, -49 * sc);
      ctx.lineTo(-6 * sc, -49 * sc);
      ctx.lineTo(-7 * sc, -45 * sc);
      ctx.lineTo(-5.5 * sc, -26 * sc);
      ctx.lineTo(-9 * sc, -22 * sc);
      ctx.lineTo(-11 * sc, -26 * sc);
      ctx.lineTo(-9 * sc, -45 * sc);
      ctx.closePath();
      fs(ctx, L.tie, "#3a0a0a", 1.2);
    }
    if (L.stripe) {
      ctx.beginPath();
      ctx.moveTo(-16 * sc, -36 * sc);
      ctx.lineTo(15 * sc, -38 * sc);
      ctx.lineTo(15 * sc, -32 * sc);
      ctx.lineTo(-16.5 * sc, -30 * sc);
      ctx.closePath();
      ctx.fillStyle = L.stripe;
      ctx.fill();
    }
    if (L.number) {
      text(ctx, L.number, 0, -26 * sc, { size: 18 * sc, color: "#fff", stroke: "#6a0a10", lw: 3 });
    }
    if (L.chain) {
      ctx.beginPath();
      ctx.arc(-6 * sc, -46 * sc, 9 * sc, 0.3, 2.6);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = "#ffd23a";
      ctx.stroke();
    }
    if (!L.sleeveless && !L.pads) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-15 * sc, -48 * sc);
      ctx.lineTo(-11 * sc, -34 * sc);
      ctx.lineTo(-10 * sc, -18 * sc);
      ctx.stroke();
      ctx.save();
      ctx.globalAlpha *= 0.35;
      E(ctx, 6 * sc, -18 * sc, 4 * sc, 3 * sc, 0.4);
      ctx.fillStyle = "#1e1812";
      ctx.fill();
      ctx.restore();
    }
  }
  function drawHead(ctx, z, L, p, sc) {
    const stroke = SKIN.stroke;
    const s = sc;
    E(ctx, 13 * s, 2 * s, 4.5 * s, 6 * s);
    fs(ctx, SKIN.dark, stroke, 1.4);
    ctx.beginPath();
    ctx.moveTo(-20 * s, 4 * s);
    ctx.bezierCurveTo(-26 * s, -18 * s, -8 * s, -27 * s, 4 * s, -24 * s);
    ctx.bezierCurveTo(18 * s, -21 * s, 22 * s, -4 * s, 18 * s, 10 * s);
    ctx.bezierCurveTo(15 * s, 20 * s, 2 * s, 23 * s, -8 * s, 21 * s);
    ctx.bezierCurveTo(-16 * s, 19 * s, -19 * s, 13 * s, -20 * s, 4 * s);
    ctx.closePath();
    const angry = z.angry;
    const skinL = angry ? "#e0a090" : SKIN.light, skinM = angry ? "#c47868" : SKIN.mid, skinD = angry ? "#8a4a40" : SKIN.dark;
    fs(ctx, rg(ctx, -8 * s, -10 * s, 2, 0, 0, 26 * s, [0, skinL, 0.6, skinM, 1, skinD]), stroke, 1.8);
    ctx.save();
    ctx.globalAlpha *= 0.25;
    for (const [x, y, r] of [[6, -14, 3], [12, 4, 2.5], [-2, 12, 2]]) {
      C(ctx, x * s, y * s, r * s);
      ctx.fillStyle = "#3a4a2a";
      ctx.fill();
    }
    ctx.restore();
    if (L.afro) {
      ctx.save();
      const pts = [];
      for (let i = 0; i < 12; i++) {
        const a = Math.PI + i / 11 * Math.PI * 1.15 - 0.1;
        const r = (26 + i % 2 * 4) * s;
        pts.push(2 * s + Math.cos(a) * r * 1.05, -10 * s + Math.sin(a) * r * 0.95);
      }
      pts.push(20 * s, 8 * s, -12 * s, -2 * s);
      blob(ctx, pts);
      fs(ctx, rg(ctx, -6 * s, -30 * s, 2, 0, -14 * s, 34 * s, [0, shadeHex(L.afro, 0.25), 1, L.afro]), "#0a0604", 1.8);
      ctx.restore();
    } else if (!z.noHair) {
      ctx.strokeStyle = L.hair || "#3a3024";
      ctx.lineWidth = 1.8 * s;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(2 * s, -24 * s);
      ctx.quadraticCurveTo(0, -34 * s, -8 * s, -33 * s);
      ctx.moveTo(6 * s, -23 * s);
      ctx.quadraticCurveTo(8 * s, -33 * s, 2 * s, -36 * s);
      ctx.moveTo(10 * s, -21 * s);
      ctx.quadraticCurveTo(16 * s, -28 * s, 14 * s, -32 * s);
      ctx.stroke();
    }
    if (L.clown) {
      for (const [x, y, r] of [[16, -8, 10], [20, 6, 9], [-2, -20, 8], [10, -20, 9]]) {
        C(ctx, x * s, y * s, r * s);
        fs(ctx, "#e83a2a", "#6a1010", 1.4);
      }
      C(ctx, -21 * s, 4 * s, 5 * s);
      fs(ctx, "#ff3a3a", "#6a1010", 1.4);
    }
    if (L.hardhat) {
      ctx.beginPath();
      ctx.moveTo(-24 * s, -8 * s);
      ctx.bezierCurveTo(-26 * s, -34 * s, 22 * s, -36 * s, 22 * s, -8 * s);
      ctx.lineTo(26 * s, -6 * s);
      ctx.lineTo(-28 * s, -6 * s);
      ctx.closePath();
      fs(ctx, lg(ctx, 0, -32 * s, 0, -6 * s, [0, "#ffe25a", 1, "#d09a10"]), "#5a3a00", 1.8);
      rr(ctx, -18 * s, -26 * s, 10 * s, 9 * s, 2);
      fs(ctx, "#e8e8d8", "#3a3a30", 1.2);
      C(ctx, -13 * s, -21.5 * s, 3 * s);
      fs(ctx, "#fff8b0", "#8a7a20", 1);
    }
    if (L.band) {
      ctx.beginPath();
      ctx.moveTo(-21 * s, -8 * s);
      ctx.quadraticCurveTo(0, -16 * s, 19 * s, -10 * s);
      ctx.lineTo(19 * s, -4 * s);
      ctx.quadraticCurveTo(0, -10 * s, -21 * s, -2 * s);
      ctx.closePath();
      fs(ctx, L.band, "#3a0a0a", 1.2);
    }
    const lookX = z.hypno ? 1.5 : -1.5;
    const eyeY = -5 * s;
    if (z.hypno) {
      for (const [x, r] of [[-12, 7.2], [-1, 6]]) {
        C(ctx, x * s, eyeY, r * s);
        fs(ctx, "#ffe8ff", stroke, 1.3);
        ctx.beginPath();
        for (let i = 0; i < 16; i++) {
          const a = i * 0.7 + z.t * 8, rr2 = i * 0.35 * s;
          const px = x * s + Math.cos(a) * rr2, py = eyeY + Math.sin(a) * rr2;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.strokeStyle = "#c01a90";
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    } else {
      eye(ctx, -12 * s, eyeY, 7.4 * s, 7.6 * s, lookX * s, 0.5 * s, { pupil: 0.28, white: angry ? "#ffe0d0" : "#fbf7e6", stroke, highlight: false });
      eye(ctx, -1 * s, eyeY - 1 * s, 6 * s, 6.4 * s, lookX * s, 0.5 * s, { pupil: 0.3, white: angry ? "#ffe0d0" : "#fbf7e6", stroke, highlight: false });
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(-12 * s, eyeY - 4.5 * s, 8 * s, 4 * s, 0.1, Math.PI, TAU);
      ctx.ellipse(-1 * s, eyeY - 5.5 * s, 6.6 * s, 3.4 * s, 0.1, Math.PI, TAU);
      ctx.fillStyle = skinM;
      ctx.fill();
      ctx.restore();
      if (angry) {
        ctx.lineWidth = 2.4 * s;
        ctx.strokeStyle = "#3a1010";
        ctx.beginPath();
        ctx.moveTo(-20 * s, -14 * s);
        ctx.lineTo(-7 * s, -9 * s);
        ctx.moveTo(6 * s, -14 * s);
        ctx.lineTo(-2 * s, -10 * s);
        ctx.stroke();
      }
    }
    if (L.glasses) {
      ctx.strokeStyle = "#2a2a2a";
      ctx.lineWidth = 1.6;
      C(ctx, -12 * s, eyeY, 8.5 * s);
      ctx.stroke();
      C(ctx, -1 * s, eyeY - 1 * s, 7 * s);
      ctx.stroke();
      line(ctx, -3.5 * s, eyeY - 1, -6 * s, eyeY - 1, "#2a2a2a", 1.4);
      line(ctx, 6 * s, eyeY - 2, 14 * s, eyeY - 3, "#2a2a2a", 1.4);
    }
    if (L.goggles || L.mask) {
      rr(ctx, -23 * s, -13 * s, 29 * s, 15 * s, 6 * s);
      fs(ctx, "rgba(160,220,255,0.45)", "#1a1a1a", 2.2);
      ctx.beginPath();
      ctx.moveTo(6 * s, -8 * s);
      ctx.lineTo(19 * s, -9 * s);
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#1a1a1a";
      ctx.stroke();
    }
    const j = p.jaw;
    ctx.beginPath();
    ctx.moveTo(-20 * s, 8 * s);
    ctx.quadraticCurveTo(-12 * s, 7 * s, -4 * s, 9 * s);
    ctx.lineTo(-6 * s, (11 + j * 9) * s);
    ctx.quadraticCurveTo(-13 * s, (13 + j * 9) * s, -19 * s, (11 + j * 6) * s);
    ctx.closePath();
    fs(ctx, "#3a1a14", stroke, 1.4);
    ctx.fillStyle = "#f2ecd0";
    ctx.fillRect(-16 * s, 8 * s, 3 * s, 3.2 * s);
    ctx.fillRect(-10 * s, 8.4 * s, 3 * s, 3 * s);
    if (L.mask) {
      tube(ctx, [-18 * s, 10 * s, -24 * s, 8 * s, -24 * s, -30 * s], 4 * s, "#f0d020", "#3a3000", 1.3);
      C(ctx, -24 * s, -31 * s, 3 * s);
      fs(ctx, "#e02020", "#3a0000", 1.2);
    }
  }
  function drawArmorHat(ctx, kind, stage, s, t) {
    if (kind === "cone") {
      ctx.save();
      ctx.translate(2 * s, -18 * s);
      ctx.rotate(-0.12);
      const h = stage >= 2 ? 36 : 44;
      ctx.beginPath();
      ctx.moveTo(-21 * s, 2 * s);
      ctx.lineTo(-3 * s, -h * s);
      if (stage >= 2) {
        ctx.lineTo(1 * s, -h * s + 2);
        ctx.lineTo(4 * s, -(h - 6) * s);
      } else ctx.lineTo(3 * s, -h * s);
      ctx.lineTo(21 * s, 2 * s);
      ctx.closePath();
      fs(ctx, lg(ctx, -20 * s, 0, 20 * s, 0, [0, "#ffb36a", 0.4, "#ff8a2a", 1, "#c4500a"]), "#5a2000", 2);
      ctx.save();
      ctx.clip();
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fillRect(-30 * s, -20 * s, 60 * s, 6 * s);
      ctx.fillRect(-30 * s, -34 * s, 60 * s, 4 * s);
      if (stage >= 1) {
        ctx.strokeStyle = "#6a2a00";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(-10 * s, -6 * s);
        ctx.lineTo(-4 * s, -12 * s);
        ctx.lineTo(-8 * s, -18 * s);
        ctx.moveTo(8 * s, -24 * s);
        ctx.lineTo(4 * s, -28 * s);
        ctx.stroke();
      }
      if (stage >= 2) {
        ctx.fillStyle = "rgba(90,30,0,0.5)";
        E(ctx, 10 * s, -8 * s, 5 * s, 3 * s);
        ctx.fill();
      }
      ctx.restore();
      E(ctx, 0, 2 * s, 24 * s, 5 * s);
      fs(ctx, "#e0701a", "#5a2000", 1.8);
      ctx.restore();
    } else if (kind === "bucket") {
      ctx.save();
      ctx.translate(0, -8 * s);
      ctx.rotate(-0.08 + (stage >= 2 ? 0.1 : 0));
      ctx.beginPath();
      ctx.moveTo(-24 * s, 8 * s);
      ctx.lineTo(-20 * s, -24 * s);
      ctx.lineTo(18 * s, -24 * s);
      ctx.lineTo(22 * s, 8 * s);
      ctx.closePath();
      fs(ctx, lg(ctx, -24 * s, 0, 22 * s, 0, [0, "#7a8288", 0.25, "#e8eef2", 0.45, "#b8c2c8", 1, "#5a6268"]), "#1e2428", 2);
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = "rgba(30,36,40,0.5)";
      ctx.lineWidth = 2;
      for (const y of [-18, 2]) {
        ctx.beginPath();
        ctx.moveTo(-26 * s, y * s);
        ctx.lineTo(26 * s, y * s);
        ctx.stroke();
      }
      if (stage >= 1) {
        ctx.fillStyle = "rgba(40,40,40,0.4)";
        E(ctx, -8 * s, -8 * s, 6 * s, 4 * s, 0.3);
        ctx.fill();
        E(ctx, 10 * s, -2 * s, 4 * s, 3 * s);
        ctx.fill();
      }
      if (stage >= 2) {
        ctx.fillStyle = "rgba(120,70,30,0.45)";
        E(ctx, 4 * s, -14 * s, 7 * s, 5 * s);
        ctx.fill();
        E(ctx, -14 * s, 2 * s, 5 * s, 3 * s);
        ctx.fill();
        ctx.fillStyle = "#1e2428";
        C(ctx, 8 * s, -12 * s, 2.2 * s);
        ctx.fill();
      }
      ctx.restore();
      E(ctx, -1 * s, -24 * s, 19 * s, 3.5 * s);
      fs(ctx, "#9aa4aa", "#1e2428", 1.6);
      ctx.beginPath();
      ctx.arc(21 * s, -6 * s, 6 * s, -1.4, 1.4);
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = "#3a4248";
      ctx.stroke();
      ctx.restore();
    } else if (kind === "helmet") {
      ctx.save();
      ctx.translate(2 * s, -6 * s);
      ctx.beginPath();
      ctx.moveTo(-22 * s, 6 * s);
      ctx.bezierCurveTo(-28 * s, -30 * s, 26 * s, -34 * s, 24 * s, 10 * s);
      ctx.lineTo(16 * s, 14 * s);
      ctx.lineTo(10 * s, 4 * s);
      ctx.lineTo(-14 * s, 2 * s);
      ctx.closePath();
      fs(ctx, rg(ctx, -6 * s, -18 * s, 2, 0, -6 * s, 30 * s, [0, "#ff6a6a", 0.5, "#d01a24", 1, "#7a0610"]), "#2a0206", 2);
      ctx.save();
      ctx.clip();
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.beginPath();
      ctx.moveTo(-4 * s, -30 * s);
      ctx.quadraticCurveTo(0, -10, -2 * s, 6 * s);
      ctx.lineTo(3 * s, 6 * s);
      ctx.quadraticCurveTo(5 * s, -10, 2 * s, -30 * s);
      ctx.fill();
      if (stage >= 1) {
        ctx.strokeStyle = "#2a0206";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(-14 * s, -16 * s);
        ctx.lineTo(-8 * s, -10 * s);
        ctx.lineTo(-12 * s, -4 * s);
        ctx.moveTo(12 * s, -18 * s);
        ctx.lineTo(8 * s, -12 * s);
        ctx.stroke();
      }
      if (stage >= 2) {
        ctx.fillStyle = "rgba(30,0,0,0.45)";
        E(ctx, 14 * s, -8 * s, 6 * s, 5 * s);
        ctx.fill();
      }
      ctx.restore();
      ctx.strokeStyle = "#c8ccd0";
      ctx.lineWidth = 2.6;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-18 * s, 0);
      ctx.quadraticCurveTo(-28 * s, 10 * s, -24 * s, 24 * s);
      ctx.moveTo(-18 * s, 12 * s);
      ctx.lineTo(-10 * s, 12 * s);
      ctx.moveTo(-24 * s, 20 * s);
      ctx.lineTo(-10 * s, 22 * s);
      ctx.stroke();
      ctx.restore();
    }
  }
  function drawFlag(ctx, hx, hy, t, s) {
    tube(ctx, [hx, hy + 8 * s, hx + 2, hy - 86 * s], 3.2 * s, "#8a6a3a", "#2a1a08", 1.2);
    const fx = hx + 2, fy = hy - 84 * s;
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    const w = 46 * s, h = 30 * s;
    for (let i = 0; i <= 8; i++) {
      const x = fx + w * i / 8;
      ctx.lineTo(x, fy + Math.sin(t * 6 + i * 0.6) * 3 * (i / 8));
    }
    for (let i = 8; i >= 0; i--) {
      const x = fx + w * i / 8;
      ctx.lineTo(x, fy + h + Math.sin(t * 6 + i * 0.6) * 3 * (i / 8));
    }
    ctx.closePath();
    fs(ctx, lg(ctx, fx, fy, fx + w, fy + h, [0, "#b01418", 1, "#7a0a0e"]), "#3a0406", 1.6);
    const bx = fx + w * 0.52, by = fy + h * 0.5 + Math.sin(t * 6 + 4) * 1.5;
    E(ctx, bx, by, 11 * s, 8 * s);
    fs(ctx, "#ffb0c0", "#8a3a4a", 1.2);
    ctx.strokeStyle = "#c05a6a";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bx, by - 7 * s);
    ctx.lineTo(bx, by + 7 * s);
    ctx.moveTo(bx - 7 * s, by - 3 * s);
    ctx.quadraticCurveTo(bx - 3 * s, by, bx - 7 * s, by + 3 * s);
    ctx.moveTo(bx + 7 * s, by - 3 * s);
    ctx.quadraticCurveTo(bx + 3 * s, by, bx + 7 * s, by + 3 * s);
    ctx.stroke();
  }
  function drawPaper(ctx, x, y, stage, s, shake) {
    ctx.save();
    ctx.translate(x + shake, y);
    ctx.rotate(-0.08);
    const w = 40 * s, h = 50 * s;
    ctx.beginPath();
    ctx.moveTo(-w / 2, -h / 2);
    ctx.lineTo(w / 2, -h / 2);
    if (stage >= 1) {
      ctx.lineTo(w / 2, 0);
      ctx.lineTo(w / 2 - 8, 6);
      ctx.lineTo(w / 2 - 2, 12);
    }
    ctx.lineTo(w / 2, h / 2);
    if (stage >= 2) {
      ctx.lineTo(4, h / 2 - 8);
      ctx.lineTo(-4, h / 2);
    }
    ctx.lineTo(-w / 2, h / 2);
    ctx.closePath();
    fs(ctx, lg(ctx, -w / 2, 0, w / 2, 0, [0, "#dcd8cc", 0.5, "#f4f2ea", 1, "#cfcabc"]), "#3a3830", 1.5);
    ctx.fillStyle = "#2a2a2a";
    ctx.font = `900 ${9 * s}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("\u50F5\u5C38\u65E5\u62A5", 0, -h / 2 + 10 * s);
    ctx.fillStyle = "rgba(40,40,40,0.55)";
    for (let i = 0; i < 6; i++) ctx.fillRect(-w / 2 + 5, -h / 2 + 16 * s + i * 5 * s, i === 2 ? w * 0.5 : w - 10, 2);
    ctx.fillStyle = "rgba(60,60,60,0.35)";
    ctx.fillRect(w * 0.05, -h / 2 + 28 * s, w * 0.35, 14 * s);
    ctx.restore();
  }
  function drawDoor(ctx, x, y, stage, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.04 + (stage >= 2 ? -0.06 : 0));
    const w = 42 * s, h = 104 * s;
    rr(ctx, -w / 2, -h / 2, w, h, 3);
    ctx.fillStyle = "rgba(160,170,175,0.35)";
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = "rgba(40,46,50,0.45)";
    ctx.lineWidth = 0.8;
    for (let i = -w / 2; i < w / 2; i += 4) {
      ctx.beginPath();
      ctx.moveTo(i, -h / 2);
      ctx.lineTo(i, h / 2);
      ctx.stroke();
    }
    for (let i = -h / 2; i < h / 2; i += 4) {
      ctx.beginPath();
      ctx.moveTo(-w / 2, i);
      ctx.lineTo(w / 2, i);
      ctx.stroke();
    }
    if (stage >= 1) {
      ctx.fillStyle = "rgba(20,20,20,0.5)";
      E(ctx, -6, -20, 7, 9);
      ctx.fill();
    }
    if (stage >= 2) {
      ctx.fillStyle = "rgba(20,20,20,0.5)";
      E(ctx, 8, 20, 9, 12);
      ctx.fill();
      E(ctx, -10, 30, 5, 6);
      ctx.fill();
    }
    ctx.restore();
    rr(ctx, -w / 2, -h / 2, w, h, 3);
    ctx.lineWidth = 5;
    ctx.strokeStyle = "#2a3034";
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#7a868c";
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-w / 2, 0);
    ctx.lineTo(w / 2, 0);
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#5a666c";
    ctx.stroke();
    C(ctx, -w / 2 + 6, 6, 3);
    fs(ctx, "#d8c070", "#3a3010", 1);
    ctx.restore();
  }
  function drawPole(ctx, x0, y0, x1, y1) {
    tube(ctx, [x0, y0, x1, y1], 4, "#d8b070", "#4a3010", 1.3);
  }
  function drawDuckTube(ctx, s, t, front) {
    ctx.save();
    ctx.translate(0, -34 * s);
    if (!front) {
      E(ctx, 0, 0, 30 * s, 10 * s);
      fs(ctx, "#e8b818", "#6a4a00", 2);
    } else {
      ctx.beginPath();
      ctx.ellipse(0, 0, 30 * s, 10 * s, 0, 0, Math.PI);
      ctx.ellipse(0, 0, 18 * s, 4 * s, 0, Math.PI, 0, true);
      ctx.closePath();
      fs(ctx, lg(ctx, 0, -10, 0, 12, [0, "#fff06a", 1, "#e0a810"]), "#6a4a00", 2);
      ctx.save();
      ctx.translate(-30 * s, -6 * s);
      C(ctx, 0, -10 * s, 9 * s);
      fs(ctx, "#ffe040", "#6a4a00", 1.8);
      ctx.beginPath();
      ctx.moveTo(-6 * s, -9 * s);
      ctx.lineTo(-17 * s, -7 * s);
      ctx.lineTo(-6 * s, -4 * s);
      ctx.closePath();
      fs(ctx, "#ff8a1a", "#6a3000", 1.4);
      C(ctx, -2 * s, -13 * s, 1.8 * s);
      ctx.fillStyle = "#111";
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }
  function drawBalloon(ctx, hx, hy, t, pop) {
    if (pop >= 1) return;
    const bx = hx + 8 + Math.sin(t * 1.4) * 4, by = hy - 70 + Math.cos(t * 1.1) * 3;
    ctx.save();
    ctx.strokeStyle = "rgba(40,40,40,0.8)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.quadraticCurveTo(hx + 10, hy - 30, bx, by + 30);
    ctx.stroke();
    const sc = 1 + pop * 0.5;
    ctx.translate(bx, by);
    ctx.scale(sc, sc);
    ctx.globalAlpha *= 1 - pop;
    E(ctx, 0, 0, 22, 27);
    fs(ctx, rg(ctx, -7, -9, 2, 0, 0, 28, [0, "#ff8a8a", 0.5, "#e82a2a", 1, "#8a0a10"]), "#4a0006", 1.8);
    ctx.beginPath();
    ctx.moveTo(-4, 27);
    ctx.lineTo(4, 27);
    ctx.lineTo(0, 33);
    ctx.closePath();
    fs(ctx, "#c01a1a", "#4a0006", 1.2);
    ctx.globalAlpha *= 0.6;
    E(ctx, -8, -10, 5, 9, 0.4);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.restore();
  }
  function drawPickaxe(ctx, hx, hy, ang, s) {
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(ang + Math.PI);
    tube(ctx, [0, 8 * s, 0, -44 * s], 4 * s, "#a8763a", "#3a2008", 1.2);
    ctx.beginPath();
    ctx.moveTo(-22 * s, -40 * s);
    ctx.quadraticCurveTo(0, -52 * s, 22 * s, -40 * s);
    ctx.quadraticCurveTo(0, -46 * s, -22 * s, -40 * s);
    fs(ctx, lg(ctx, 0, -50 * s, 0, -40 * s, [0, "#e0e4e8", 1, "#7a8288"]), "#2a3036", 1.6);
    ctx.restore();
  }
  function drawPogo(ctx, x, groundY, squash2, s) {
    const top = -38 * s, peg = 46 * s;
    const len = Math.max(8, (groundY - peg - 6) * (1 - squash2 * 0.45));
    ctx.save();
    tube(ctx, [x, top, x, peg], 4.5 * s, "#d8dce0", "#2a2e32", 1.3);
    tube(ctx, [x - 13 * s, top, x + 11 * s, top], 5 * s, "#2a2a2a", "#000", 1);
    tube(ctx, [x - 14 * s, peg, x + 14 * s, peg], 4.5 * s, "#e03a2a", "#3a0000", 1.1);
    ctx.strokeStyle = "#9aa0a6";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, peg + 2);
    for (let i = 1; i <= 9; i++) ctx.lineTo(x + (i % 2 ? 7 : -7) * s, peg + 2 + len * i / 9);
    ctx.stroke();
    C(ctx, x, peg + 4 + len, 5 * s);
    fs(ctx, "#2a2a2a", "#000", 1);
    ctx.restore();
  }
  function drawJackBox(ctx, x, y, t, pop, s) {
    ctx.save();
    ctx.translate(x, y);
    if (pop > 0) {
      const h = Math.min(1, pop * 1.6) * 44;
      ctx.strokeStyle = "#8a9096";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let i = 0; i <= 8; i++) ctx.lineTo((i % 2 ? 6 : -6) * s, -12 * s - h * i / 8);
      ctx.stroke();
      C(ctx, 0, -18 * s - h, 11 * s);
      fs(ctx, "#fff4e0", "#3a2a20", 1.5);
      C(ctx, 0, -16 * s - h, 3 * s);
      fs(ctx, "#ff2a2a");
      ctx.beginPath();
      ctx.moveTo(-10 * s, -26 * s - h);
      ctx.lineTo(0, -44 * s - h);
      ctx.lineTo(10 * s, -26 * s - h);
      ctx.closePath();
      fs(ctx, "#7a3ad8", "#2a0a4a", 1.2);
    }
    rr(ctx, -15 * s, -14 * s, 30 * s, 28 * s, 3);
    fs(ctx, lg(ctx, -15 * s, 0, 15 * s, 0, [0, "#9a4ae0", 1, "#5a1a9a"]), "#2a0a4a", 1.8);
    ctx.fillStyle = "#ffd23a";
    star(ctx, 0, 0, 7 * s, 3 * s, 5, -Math.PI / 2);
    ctx.fill();
    ctx.save();
    ctx.translate(15 * s, 0);
    ctx.rotate(t * 5);
    tube(ctx, [0, 0, 0, -9 * s, 5 * s, -9 * s], 2.2 * s, "#c8c8c0", "#333", 1);
    ctx.restore();
    ctx.restore();
  }
  function drawDiggerMound(ctx, t) {
    const bob = Math.sin(t * 10) * 2;
    E(ctx, 0, -6, 34, 12 + bob * 0.5);
    fs(ctx, rg(ctx, -8, -12, 2, 0, -6, 34, [0, "#8a6038", 1, "#4a3018"]), "#2a1a08", 2);
    for (let i = 0; i < 5; i++) {
      C(ctx, -24 + i * 12, -8 - Math.abs(Math.sin(t * 8 + i)) * 6, 4);
      fs(ctx, "#6a4828", "#2a1a08", 1);
    }
    ctx.save();
    ctx.translate(-26, -16 + bob);
    ctx.rotate(-0.8 + Math.sin(t * 10) * 0.3);
    ctx.beginPath();
    ctx.moveTo(-12, 0);
    ctx.quadraticCurveTo(0, -8, 12, 0);
    ctx.quadraticCurveTo(0, -4, -12, 0);
    fs(ctx, "#c8ccd0", "#2a3036", 1.4);
    ctx.restore();
  }
  function drawHumanoid(ctx, z) {
    const L = LOOKS[z.lookType || z.type] || LOOKS.normal;
    const s = L.small ? 0.78 : 1;
    const p = pose(z);
    const t = z.t || 0;
    const held = z.held;
    const hipY0 = 0;
    const lf = legPoints(-4 * s, hipY0, p.legF, p.kneeF, 25 * s, 24 * s);
    const lb = legPoints(5 * s, hipY0, p.legB, p.kneeB, 25 * s, 24 * s);
    let hipY = -Math.max(lf.fy, lb.fy);
    if (z.anim === "jump" || z.airborne) hipY = -48 * s;
    if (held === "pogo") hipY -= 34 * s;
    const lf2 = legPoints(-4 * s, hipY, p.legF, p.kneeF, 25 * s, 24 * s);
    const lb2 = legPoints(5 * s, hipY, p.legB, p.kneeB, 25 * s, 24 * s);
    const hasArm = z.hasArm !== false;
    const hasHead = z.hasHead !== false;
    if ((L.tube || z.ducky) && z.inWater) drawDuckTube(ctx, s, t, false);
    ctx.save();
    ctx.translate(0, hipY);
    ctx.rotate(p.lean);
    const shB = { x: 8 * s, y: -47 * s };
    let farHand = drawArm(ctx, shB.x, shB.y, p.armUB, p.armLB, L, true, s);
    ctx.restore();
    drawLeg(ctx, { x: 5 * s, y: hipY }, lb2, L, true, s);
    drawLeg(ctx, { x: -4 * s, y: hipY }, lf2, L, false, s);
    ctx.save();
    ctx.translate(0, hipY);
    ctx.rotate(p.lean);
    drawTorso(ctx, L, s, z);
    if (held === "pogo") drawPogo(ctx, -6 * s, -hipY, z.pogoSquash || 0, s);
    if (held === "pole") {
      const fh = { x: farHand.hx, y: farHand.hy };
      drawPole(ctx, fh.x - 70 * s, fh.y + 2, fh.x + 40 * s, fh.y - 6);
    }
    const neck = { x: -4 * s, y: -52 * s };
    ctx.save();
    ctx.translate(neck.x + p.headX, neck.y + p.headY);
    ctx.rotate(p.headRot);
    if (hasHead) {
      tube(ctx, [0, 2, -1 * s, -8 * s], 8 * s, SKIN.mid, SKIN.stroke, 1.4);
      ctx.translate(-5 * s, -26 * s);
      drawHead(ctx, z, L, p, s);
      if (z.armorKind) drawArmorHat(ctx, z.armorKind, z.armorStage || 0, s, t);
    } else {
      E(ctx, 0, -2, 6 * s, 3.5 * s);
      fs(ctx, "#7a2a2a", SKIN.stroke, 1.2);
    }
    ctx.restore();
    const shF = { x: -11 * s, y: -46 * s };
    if (held === "paper") drawPaper(ctx, -26 * s, -40 * s, z.shieldStage || 0, s, 0);
    if (held === "jackbox") drawJackBox(ctx, -26 * s, -34 * s, t, z.jackPop || 0, s);
    const hand = drawArm(ctx, shF.x, shF.y, p.armUF, p.armLF, L, false, s, { stump: !hasArm });
    if (held === "flag" && hasArm) drawFlag(ctx, hand.hx, hand.hy, t, s);
    if (held === "door") drawDoor(ctx, -30 * s, -30 * s, z.shieldStage || 0, s);
    if (held === "pickaxe" && hasArm) drawPickaxe(ctx, hand.hx, hand.hy, p.armUF + p.armLF, s);
    if (held === "balloon") drawBalloon(ctx, hand.hx, hand.hy, t, z.popT || 0);
    ctx.restore();
    if ((L.tube || z.ducky) && z.inWater) drawDuckTube(ctx, s, t, true);
  }
  function easeIO(k) {
    return -(Math.cos(Math.PI * k) - 1) / 2;
  }
  function drawGargantuar(ctx, z) {
    const t = z.t || 0;
    const ph = z.walkPh || 0;
    const walking = z.anim === "walk";
    const sm = z.smashT || 0;
    const bob = walking ? -Math.abs(Math.cos(ph)) * 4 : 0;
    const stroke = "#1e1812";
    let armA, poleR, lean;
    if (sm > 0) {
      if (sm < 0.55) {
        const k = easeIO(sm / 0.55);
        armA = lerp(0.55, -2.7, k);
        poleR = lerp(-0.22, 1.2, k);
        lean = lerp(-0.08, 0.14, k);
      } else if (sm < 0.7) {
        const k = (sm - 0.55) / 0.15;
        armA = lerp(-2.7, 1.3, k * k);
        poleR = lerp(1.2, -1.72, k * k);
        lean = lerp(0.14, -0.28, k);
      } else {
        const k = easeIO((sm - 0.7) / 0.3);
        armA = lerp(1.3, 0.55, k);
        poleR = lerp(-1.72, -0.22, k);
        lean = lerp(-0.28, -0.08, k);
      }
    } else {
      armA = 0.55 + Math.sin(ph) * 0.1;
      poleR = -0.22 + Math.sin(ph) * 0.05;
      lean = -0.08 + Math.sin(ph * 2) * 0.02;
    }
    const legA = walking ? Math.sin(ph) * 0.26 : 0;
    const hipY = -74 + bob;
    for (const [dx, a, far] of [[16, -legA, true], [-12, legA, false]]) {
      const hx2 = dx, hy2 = hipY;
      const kx = hx2 - Math.sin(a) * 36, ky = hy2 + Math.cos(a) * 36;
      const fx = kx - Math.sin(a * 0.3) * 34, fy = -6;
      tube(ctx, [kx, ky, fx, fy], 22, far ? SKIN.dark : SKIN.mid, SKIN.stroke, 2);
      tube(ctx, [hx2, hy2, kx, ky], 30, far ? "#4a3a2a" : "#6a5238", stroke, 2);
      ctx.beginPath();
      ctx.moveTo(kx - 16, ky - 4);
      ctx.lineTo(kx - 10, ky + 6);
      ctx.lineTo(kx - 3, ky);
      ctx.lineTo(kx + 4, ky + 7);
      ctx.lineTo(kx + 15, ky - 3);
      ctx.lineTo(kx + 14, ky - 12);
      ctx.lineTo(kx - 15, ky - 12);
      ctx.closePath();
      fs(ctx, far ? "#4a3a2a" : "#6a5238", stroke, 1.6);
      E(ctx, fx - 9, -6, 21, 9);
      fs(ctx, rg(ctx, fx - 14, -10, 2, fx - 9, -6, 22, [0, far ? SKIN.mid : SKIN.light, 1, SKIN.dark]), SKIN.stroke, 2);
    }
    ctx.save();
    ctx.translate(0, hipY);
    ctx.rotate(lean);
    tube(ctx, [20, -92, 34, -50, 22, -8], 24, SKIN.dark, SKIN.stroke, 2);
    C(ctx, 22, -4, 15);
    fs(ctx, rg(ctx, 18, -8, 2, 22, -4, 16, [0, SKIN.mid, 1, SKIN.dark]), SKIN.stroke, 2);
    const bodyPath = () => {
      ctx.beginPath();
      ctx.moveTo(-34, 4);
      ctx.bezierCurveTo(-46, -24, -46, -62, -36, -90);
      ctx.bezierCurveTo(-26, -114, 14, -122, 32, -104);
      ctx.bezierCurveTo(48, -86, 44, -40, 36, 4);
      ctx.quadraticCurveTo(0, 12, -34, 4);
      ctx.closePath();
    };
    bodyPath();
    fs(ctx, rg(ctx, -14, -74, 6, 0, -50, 76, [0, SKIN.light, 0.55, SKIN.mid, 1, SKIN.dark]), SKIN.stroke, 2.4);
    ctx.save();
    bodyPath();
    ctx.clip();
    ctx.beginPath();
    ctx.moveTo(-50, -40);
    ctx.quadraticCurveTo(0, -30, 50, -44);
    ctx.lineTo(50, 20);
    ctx.lineTo(-50, 20);
    ctx.closePath();
    fs(ctx, lg(ctx, 0, -44, 0, 10, [0, "#7a6044", 1, "#4a3a28"]), stroke, 2);
    ctx.fillStyle = "#4a3a28";
    ctx.fillRect(-30, -104, 10, 70);
    ctx.fillRect(20, -108, 10, 70);
    ctx.fillStyle = "#d8c070";
    C(ctx, -25, -42, 3.5);
    ctx.fill();
    C(ctx, 25, -46, 3.5);
    ctx.fill();
    ctx.strokeStyle = "#4a2a2a";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-8, -84);
    ctx.lineTo(8, -64);
    for (let i = 0; i < 4; i++) {
      const u = i / 3;
      const x = lerp(-8, 8, u), y = lerp(-84, -64, u);
      ctx.moveTo(x - 4, y + 3);
      ctx.lineTo(x + 4, y - 3);
    }
    ctx.stroke();
    ctx.restore();
    if (z.hasImp) {
      ctx.save();
      ctx.translate(36, -112);
      ctx.rotate(0.2 + Math.sin(t * 3) * 0.05);
      tube(ctx, [-8, 10, -18, 0], 6, SKIN.mid, SKIN.stroke, 1.3);
      drawImpHead(ctx, t);
      ctx.restore();
    }
    ctx.save();
    ctx.translate(-30, -110);
    ctx.rotate(-0.1 + Math.sin(ph) * 0.03);
    E(ctx, 0, 0, 17, 18);
    fs(ctx, rg(ctx, -5, -6, 2, 0, 0, 22, [0, SKIN.light, 1, SKIN.dark]), SKIN.stroke, 2);
    eye(ctx, -8, -3, 5.2, 5.5, -1.5, 0.5, { pupil: 0.3, highlight: false, stroke: SKIN.stroke, white: "#fff3d0" });
    eye(ctx, 4, -4, 4.4, 4.8, -1.5, 0.5, { pupil: 0.3, highlight: false, stroke: SKIN.stroke, white: "#fff3d0" });
    ctx.lineWidth = 3.2;
    ctx.strokeStyle = SKIN.stroke;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-15, -12);
    ctx.lineTo(-2, -7);
    ctx.moveTo(9, -11);
    ctx.lineTo(1, -8);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-15, 8);
    ctx.lineTo(2, 7);
    ctx.lineTo(0, 14);
    ctx.lineTo(-13, 15);
    ctx.closePath();
    fs(ctx, "#3a1a14", SKIN.stroke, 1.4);
    teeth(ctx, -14, 15, 0, 14, 3, -4, 1, "#f2ecd0", "#555");
    ctx.strokeStyle = "#2a2018";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(2, -17);
    ctx.quadraticCurveTo(0, -26, -6, -24);
    ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.translate(-26, -92);
    const ex = -Math.sin(armA) * 34, ey = Math.cos(armA) * 34;
    const fa = armA + 0.25;
    const hx = ex - Math.sin(fa) * 32, hy = ey + Math.cos(fa) * 32;
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(poleR);
    ctx.beginPath();
    ctx.rect(-8, -128, 16, 158);
    fs(ctx, lg(ctx, -8, 0, 8, 0, [0, "#b08a54", 0.5, "#8a6a3a", 1, "#5a4020"]), "#2a1a08", 2);
    ctx.strokeStyle = "rgba(40,24,8,0.4)";
    ctx.lineWidth = 1.2;
    for (const yy of [-100, -60, -20]) {
      ctx.beginPath();
      ctx.moveTo(-8, yy);
      ctx.lineTo(8, yy + 4);
      ctx.stroke();
    }
    ctx.fillStyle = "#4a3418";
    ctx.fillRect(-26, -114, 52, 8);
    ctx.fillStyle = "#e0e0d0";
    for (const xx of [-22, 22]) {
      C(ctx, xx, -118, 4);
      ctx.fill();
    }
    ctx.restore();
    tube(ctx, [0, 0, ex, ey], 26, SKIN.mid, SKIN.stroke, 2);
    tube(ctx, [ex, ey, hx, hy], 23, SKIN.mid, SKIN.stroke, 2);
    C(ctx, hx, hy, 14);
    fs(ctx, rg(ctx, hx - 4, hy - 4, 2, hx, hy, 15, [0, SKIN.light, 1, SKIN.mid]), SKIN.stroke, 2);
    ctx.restore();
    ctx.restore();
  }
  function drawImpHead(ctx, t) {
    E(ctx, 0, 0, 13, 14);
    fs(ctx, rg(ctx, -3, -5, 1, 0, 0, 16, [0, SKIN.light, 1, SKIN.dark]), SKIN.stroke, 1.6);
    eye(ctx, -6, -3, 4.5, 5, -0.8, 0, { pupil: 0.35, highlight: false, stroke: SKIN.stroke });
    eye(ctx, 3, -3, 3.8, 4.2, -0.8, 0, { pupil: 0.35, highlight: false, stroke: SKIN.stroke });
    ctx.beginPath();
    ctx.arc(-3, 6, 4, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = SKIN.stroke;
    ctx.stroke();
  }
  function drawZomboni(ctx, z) {
    const t = z.t || 0;
    const s = 1;
    const dmg = z.vehicleStage || 0;
    const bob = Math.sin(t * 8) * 1;
    const stroke = "#1a1a1a";
    ctx.save();
    ctx.translate(0, bob);
    C(ctx, 50, -26, 26);
    fs(ctx, rg(ctx, 44, -32, 2, 50, -26, 26, [0, "#5a5a5a", 1, "#1a1a1a"]), stroke, 2);
    C(ctx, 50, -26, 10);
    fs(ctx, "#9a9a9a", stroke, 1.5);
    ctx.beginPath();
    ctx.moveTo(-70, -16);
    ctx.lineTo(-74, -58);
    ctx.quadraticCurveTo(-70, -74, -50, -76);
    ctx.lineTo(20, -80);
    ctx.lineTo(62, -64);
    ctx.lineTo(74, -40);
    ctx.lineTo(72, -16);
    ctx.closePath();
    fs(ctx, lg(ctx, 0, -80, 0, -16, [0, "#f2f2ee", 0.5, "#d4d4cc", 1, "#9a9a90"]), stroke, 2.2);
    ctx.save();
    ctx.clip();
    ctx.fillStyle = "#2a6ac8";
    ctx.fillRect(-80, -44, 160, 12);
    ctx.fillStyle = "#c82a2a";
    ctx.fillRect(-80, -30, 160, 5);
    if (dmg >= 1) {
      ctx.fillStyle = "rgba(30,30,30,0.35)";
      E(ctx, -30, -60, 14, 9);
      ctx.fill();
      E(ctx, 30, -24, 10, 6);
      ctx.fill();
    }
    if (dmg >= 2) {
      ctx.fillStyle = "rgba(30,30,30,0.5)";
      E(ctx, 10, -66, 16, 8);
      ctx.fill();
    }
    ctx.restore();
    text(ctx, "ZOMBONI", -8, -54, { size: 13, color: "#2a4a8a", weight: 900 });
    ctx.beginPath();
    ctx.moveTo(-82, -2);
    ctx.lineTo(-72, -20);
    ctx.lineTo(-40, -20);
    ctx.lineTo(-40, -2);
    ctx.closePath();
    fs(ctx, "#7a8288", stroke, 1.8);
    C(ctx, -52, -12, 12);
    fs(ctx, "#2a2a2a", stroke, 1.8);
    C(ctx, -52, -12, 4.5);
    fs(ctx, "#aaa", stroke, 1);
    ctx.save();
    ctx.translate(10, -78);
    tube(ctx, [0, 0, -2, -24], 22, "#6e5641", "#1e1812", 1.8);
    tube(ctx, [-8, -16, -26, -8, -30, 0], 8, "#6e5641", "#1e1812", 1.6);
    E(ctx, -32, 0, 5, 4.5);
    fs(ctx, SKIN.mid, SKIN.stroke, 1.3);
    ctx.translate(-4, -46);
    drawHead(ctx, z, LOOKS.normal, { jaw: 0.3 + Math.sin(t * 3) * 0.1 }, 0.95);
    ctx.restore();
    line(ctx, -22, -76, -36, -96, "#333", 3);
    E(ctx, -36, -98, 10, 3.5, -0.3);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#222";
    ctx.stroke();
    tube(ctx, [58, -66, 60, -90], 6, "#555", stroke, 1.4);
    ctx.restore();
  }
  function drawDolphin(ctx, t, s = 1, jump = 0) {
    ctx.save();
    ctx.scale(s, s);
    ctx.beginPath();
    ctx.moveTo(-58, -6);
    ctx.bezierCurveTo(-40, -28, 20, -30, 44, -12);
    ctx.quadraticCurveTo(56, -4, 62, -18);
    ctx.lineTo(66, 4);
    ctx.quadraticCurveTo(50, 2, 40, 4);
    ctx.bezierCurveTo(10, 14, -30, 10, -58, -6);
    ctx.closePath();
    fs(ctx, lg(ctx, 0, -28, 0, 12, [0, "#7a8ab0", 0.6, "#4a5a80", 1, "#c8d0e0"]), "#1a2030", 2);
    ctx.beginPath();
    ctx.moveTo(-2, -24);
    ctx.lineTo(8, -40);
    ctx.lineTo(16, -22);
    ctx.closePath();
    fs(ctx, "#4a5a80", "#1a2030", 1.8);
    ctx.beginPath();
    ctx.moveTo(-58, -6);
    ctx.lineTo(-70, -4);
    ctx.lineTo(-56, 0);
    ctx.closePath();
    fs(ctx, "#5a6a90", "#1a2030", 1.5);
    eye(ctx, -40, -12, 3, 3, -0.8, 0, { pupil: 0.6 });
    ctx.restore();
  }
  function drawZombieArt(ctx, z) {
    switch (z.type) {
      case "gargantuar":
        drawGargantuar(ctx, z);
        break;
      case "zomboni":
        drawZomboni(ctx, z);
        break;
      case "imp":
        drawHumanoid(ctx, z);
        break;
      case "dolphin": {
        if (z.riding) {
          drawDolphin(ctx, z.t, 0.9);
          ctx.save();
          ctx.translate(4, -18);
          drawHumanoid(ctx, { ...z, anim: "idle" });
          ctx.restore();
        } else drawHumanoid(ctx, z);
        break;
      }
      case "digger":
        if (z.underground) drawDiggerMound(ctx, z.t || 0);
        else drawHumanoid(ctx, z);
        break;
      default:
        drawHumanoid(ctx, z);
    }
  }
  function drawSeveredHead(ctx, z) {
    const L = LOOKS[z.lookType || z.type] || LOOKS.normal;
    const s = L.small ? 0.78 : 1;
    drawHead(ctx, { ...z, angry: false, hypno: z.hypno }, L, { jaw: 0.5 }, s);
  }
  function drawSeveredArm(ctx, z) {
    const L = LOOKS[z.lookType || z.type] || LOOKS.normal;
    drawArm(ctx, 0, 0, 0.3, 0.4, L, false, L.small ? 0.78 : 1);
  }

  // src/scenes/title.js
  var TitleScene = class {
    constructor(next) {
      this.next = next;
      this.t = 0;
      this.tasks = [
        () => getBackground("night"),
        () => getBackground("day"),
        ...PLANT_ORDER.map((p) => () => plantIcon(p, 64))
      ];
      this.total = this.tasks.length;
      this.done = 0;
      this.progress = 0;
      this.ready = false;
      this.hover = false;
    }
    enter() {
      music.play("menu");
    }
    update(dt) {
      this.t += dt;
      const start = performance.now();
      while (this.tasks.length && performance.now() - start < 12) {
        this.tasks.shift()();
        this.done++;
      }
      const target = this.done / this.total;
      this.progress = Math.min(target, this.progress + dt * 0.9);
      if (this.progress >= 1 && !this.ready) {
        this.ready = true;
        this.readyT = 0;
      }
      if (this.ready) this.readyT += dt;
    }
    pointerMove(x, y) {
      this.hover = this.ready && y > 560 && y < 660 && x > 340 && x < 940;
    }
    pointerDown() {
      if (!this.ready) return;
      audio.init();
      audio.play("button");
      music.resumePending();
      music.play("menu");
      director.go(this.next(), { speed: 2.2 });
    }
    key(k) {
      if (k === "Enter" || k === " ") this.pointerDown();
    }
    draw(ctx) {
      const t = this.t;
      const bg = getBackground("day");
      const cam = 120 + Math.sin(t * 0.15) * 80;
      ctx.drawImage(bg.canvas, (cam - WORLD_MIN_X) * bg.scale, 0, 1280 * bg.scale, 720 * bg.scale, 0, 0, W, H);
      ctx.fillStyle = lg(ctx, 0, 0, 0, H, [0, "rgba(10,30,5,0.55)", 0.5, "rgba(10,30,5,0.25)", 1, "rgba(0,0,0,0.65)"]);
      ctx.fillRect(0, 0, W, H);
      const deco = [
        { f: "sunflower", x: 170, y: 540, s: 1.6 },
        { f: "peashooter", x: 190, y: 700, s: 1.4 },
        { f: "wallnut", x: 60, y: 690, s: 1.1 }
      ];
      for (const d of deco) {
        ctx.save();
        ctx.translate(d.x, d.y);
        ctx.scale(d.s, d.s);
        PLANT_ART[d.f](ctx, { t, phase: d.x, shoot: d.f === "peashooter" ? t % 2 < 0.36 ? t % 2 / 0.36 : 0 : 0 });
        ctx.restore();
      }
      ctx.save();
      ctx.translate(1080, 640);
      ctx.scale(1.5, 1.5);
      drawZombieArt(ctx, { type: "cone", t, walkPh: t * 3, anim: "idle", seed: 1, armorKind: "cone", armorStage: 0, hasArm: true, hasHead: true });
      ctx.restore();
      ctx.save();
      ctx.translate(1200, 600);
      ctx.scale(1.25, 1.25);
      drawZombieArt(ctx, { type: "normal", t: t + 3, walkPh: t * 3, anim: "idle", seed: 4, hasArm: true, hasHead: true });
      ctx.restore();
      const drop = Ease.outBack(clamp(t / 0.9, 0, 1));
      drawLogo(ctx, 640, lerp(-120, 220, drop), 1.25, t);
      text(ctx, "HTML5 \u540C\u4EBA\u590D\u523B\u7248", 640, 330, { size: 26, color: "#fff7c8", stroke: "#3a2a08", lw: 6, weight: 800 });
      const bx = 360, by = 590, bw = 560, bh = 40;
      rr(ctx, bx - 6, by - 6, bw + 12, bh + 12, 14);
      fs(ctx, lg(ctx, 0, by, 0, by + bh, [0, "#7a5230", 1, "#4a3018"]), "#2a1a08", 3);
      const pw = bw * this.progress;
      ctx.save();
      rr(ctx, bx, by, bw, bh, 10);
      ctx.clip();
      ctx.fillStyle = lg(ctx, 0, by, 0, by + bh, [0, "#8ee04e", 1, "#3f8a1c"]);
      ctx.fillRect(bx, by, pw, bh);
      ctx.strokeStyle = "rgba(20,60,10,0.35)";
      ctx.lineWidth = 1.5;
      for (let x = bx + 4; x < bx + pw; x += 7) {
        ctx.beginPath();
        ctx.moveTo(x, by + bh);
        ctx.lineTo(x + 2, by + bh - 8 - x % 5);
        ctx.stroke();
      }
      ctx.restore();
      if (!this.ready) {
        const rx = bx + pw;
        ctx.save();
        ctx.translate(rx, by + bh / 2);
        ctx.rotate(this.progress * 30);
        C(ctx, 0, 0, 24 - this.progress * 8);
        fs(ctx, rg(ctx, -4, -4, 2, 0, 0, 26, [0, "#8a5a2a", 0.5, "#6aa83a", 1, "#2f6a18"]), "#1f4d0f", 2.5);
        ctx.strokeStyle = "rgba(40,20,5,0.6)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < 30; i++) {
          const a = i * 0.5, r = i * 0.6;
          const px = Math.cos(a) * r, py = Math.sin(a) * r;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.restore();
        text(ctx, `\u6B63\u5728\u52A0\u8F7D\u2026\u2026 ${Math.floor(this.progress * 100)}%`, 640, by + bh / 2, { size: 20, color: "#fff", stroke: "#1a2a08", lw: 5 });
      } else {
        const pulse = 1 + Math.sin(this.readyT * 5) * 0.05 + (this.hover ? 0.06 : 0);
        ctx.save();
        ctx.translate(640, by + bh / 2);
        ctx.scale(pulse, pulse);
        text(ctx, "\u70B9\u51FB\u8FD9\u91CC\u5F00\u59CB\u6E38\u620F\uFF01", 0, 0, { size: 26, color: "#fff8c0", stroke: "#2a4a08", lw: 6 });
        ctx.restore();
      }
      text(ctx, "\u975E\u5B98\u65B9\u540C\u4EBA\u590D\u523B \xB7 \u5168\u90E8\u7F8E\u672F\u3001\u97F3\u4E50\u4E0E\u97F3\u6548\u5747\u7531\u4EE3\u7801\u5B9E\u65F6\u751F\u6210", 640, 700, { size: 14, color: "rgba(255,255,255,0.7)", weight: 500 });
    }
  };

  // src/gfx/tint.js
  var scratch = null;
  var sctx = null;
  var sw = 0;
  var sh = 0;
  function ensure(w, h) {
    if (!scratch) {
      scratch = document.createElement("canvas");
      sctx = scratch.getContext("2d");
    }
    if (w > sw || h > sh) {
      sw = Math.max(sw, Math.ceil(w));
      sh = Math.max(sh, Math.ceil(h));
      scratch.width = sw;
      scratch.height = sh;
    }
  }
  function drawTinted(ctx, x, y, bw, bh, scale, draw, tints, alpha = 1) {
    const k = display.k * scale;
    const pad = 20;
    const pw = Math.ceil(bw * k), ph = Math.ceil(bh * k);
    ensure(pw, ph);
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.globalAlpha = 1;
    sctx.globalCompositeOperation = "source-over";
    sctx.clearRect(0, 0, pw, ph);
    sctx.setTransform(k, 0, 0, k, bw / 2 * k, (bh - pad) * k);
    draw(sctx);
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    for (const t of tints) {
      sctx.globalCompositeOperation = t.op || "source-atop";
      sctx.globalAlpha = t.alpha;
      sctx.fillStyle = t.color;
      sctx.fillRect(0, 0, pw, ph);
    }
    sctx.globalCompositeOperation = "source-over";
    sctx.globalAlpha = 1;
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.drawImage(scratch, 0, 0, pw, ph, x - bw / 2, y - (bh - pad), bw, bh);
    ctx.restore();
  }

  // src/scenes/ui.js
  var Button = class {
    constructor(o) {
      Object.assign(this, { style: "green", disabled: false, visible: true, hover: false, pressed: false }, o);
    }
    hit(x, y) {
      return this.visible && x >= this.x && x <= this.x + this.w && y >= this.y && y <= this.y + this.h;
    }
    draw(ctx) {
      if (this.visible) drawButton(ctx, this);
    }
  };
  var Slider = class {
    constructor(o) {
      Object.assign(this, { value: 0.5, visible: true }, o);
    }
    hit(x, y) {
      return this.visible && x >= this.x - 10 && x <= this.x + this.w + 10 && y >= this.y - 16 && y <= this.y + 16;
    }
    setFrom(x) {
      this.value = clamp((x - this.x) / this.w, 0, 1);
      this.onChange?.(this.value);
    }
    draw(ctx) {
      if (!this.visible) return;
      const { x, y, w } = this;
      text(ctx, this.label, x - 16, y, { size: 20, color: "#f4f0d8", stroke: "#1a1a14", align: "right", lw: 4 });
      rr(ctx, x, y - 6, w, 12, 6);
      fs(ctx, "rgba(0,0,0,0.45)", "rgba(255,255,255,0.2)", 1.5);
      rr(ctx, x, y - 6, w * this.value, 12, 6);
      fs(ctx, lg(ctx, 0, y - 6, 0, y + 6, [0, "#b8f070", 1, "#4f9a22"]));
      C(ctx, x + w * this.value, y, 13);
      fs(ctx, rg(ctx, x + w * this.value - 4, y - 4, 1, x + w * this.value, y, 14, [0, "#fff", 1, "#c8c8b8"]), "#3a3a30", 2);
    }
  };
  var Toggle = class {
    constructor(o) {
      Object.assign(this, { value: false, visible: true }, o);
    }
    hit(x, y) {
      return this.visible && x >= this.x - 10 && x <= this.x + 60 && y >= this.y - 18 && y <= this.y + 18;
    }
    draw(ctx) {
      if (!this.visible) return;
      const { x, y } = this;
      text(ctx, this.label, x - 16, y, { size: 20, color: "#f4f0d8", stroke: "#1a1a14", align: "right", lw: 4 });
      rr(ctx, x, y - 14, 54, 28, 14);
      fs(ctx, this.value ? lg(ctx, 0, y - 14, 0, y + 14, [0, "#9ee05a", 1, "#4f9a22"]) : "rgba(0,0,0,0.45)", "rgba(255,255,255,0.3)", 1.5);
      C(ctx, x + (this.value ? 40 : 14), y, 11);
      fs(ctx, "#f8f6ec", "#3a3a30", 1.5);
    }
  };
  var UIGroup = class {
    constructor() {
      this.items = [];
      this.drag = null;
    }
    add(it) {
      this.items.push(it);
      return it;
    }
    clear() {
      this.items = [];
    }
    move(x, y) {
      let any = false;
      for (const it of this.items) {
        if (it instanceof Button) {
          const h = it.hit(x, y) && !it.disabled;
          if (h && !it.hover) audio.play("hover");
          it.hover = h;
          if (h) any = true;
        }
      }
      if (this.drag) this.drag.setFrom(x);
      if (any || this.drag) display.setCursor("pointer");
      return any;
    }
    down(x, y) {
      for (const it of this.items) {
        if (!it.visible) continue;
        if (it instanceof Button && it.hit(x, y) && !it.disabled) {
          it.pressed = true;
          return true;
        }
        if (it instanceof Slider && it.hit(x, y)) {
          this.drag = it;
          it.setFrom(x);
          return true;
        }
        if (it instanceof Toggle && it.hit(x, y)) {
          it.value = !it.value;
          audio.play("tap");
          it.onChange?.(it.value);
          return true;
        }
      }
      return false;
    }
    up(x, y) {
      if (this.drag) {
        this.drag = null;
        audio.play("tap");
        return true;
      }
      let handled = false;
      for (const it of this.items) {
        if (it instanceof Button && it.pressed) {
          it.pressed = false;
          if (it.hit(x, y) && !it.disabled) {
            audio.play("button");
            it.onClick?.();
            handled = true;
          }
        }
      }
      return handled;
    }
    draw(ctx) {
      for (const it of this.items) it.draw(ctx);
    }
  };

  // src/game/levels.js
  var DAY2 = "day";
  var NIGHT2 = "night";
  var POOL2 = "pool";
  var FOG2 = "fog";
  var ADVENTURE = [
    // ---------------- 白天 ----------------
    { id: "1-1", env: DAY2, rows: [2], sod: [2], waves: 4, zombies: ["normal"], ramp: 0, plants: ["peashooter"], reward: { type: "plant", id: "sunflower" }, tutorial: "basic", sun: 150, firstDelay: 22 },
    { id: "1-2", env: DAY2, rows: [1, 2, 3], sod: [1, 2, 3], newSod: [1, 3], waves: 6, zombies: ["normal"], ramp: 0.2, reward: { type: "plant", id: "cherrybomb" }, tutorial: "sunflower" },
    { id: "1-3", env: DAY2, sod: [0, 1, 2, 3, 4], newSod: [0, 4], waves: 8, zombies: ["normal", "cone"], intro: "cone", ramp: 0.3, reward: { type: "plant", id: "wallnut" }, tutorial: "cherry" },
    { id: "1-4", env: DAY2, waves: 10, zombies: ["normal", "cone"], ramp: 0.38, reward: { type: "plant", id: "potatomine" }, tutorial: "shovel" },
    { id: "1-5", env: DAY2, mode: "bowling", waves: 10, zombies: ["normal", "cone", "bucket"], intro: "bucket", ramp: 0.55, reward: { type: "plant", id: "snowpea" }, title: "\u575A\u679C\u4FDD\u9F84\u7403" },
    { id: "1-6", env: DAY2, waves: 10, zombies: ["normal", "cone", "pole"], intro: "pole", ramp: 0.42, reward: { type: "plant", id: "chomper" } },
    { id: "1-7", env: DAY2, waves: 15, zombies: ["normal", "cone", "pole", "bucket"], ramp: 0.4, reward: { type: "plant", id: "repeater" } },
    { id: "1-8", env: DAY2, waves: 15, zombies: ["normal", "cone", "pole", "bucket"], ramp: 0.45, reward: { type: "plant", id: "squash" } },
    { id: "1-9", env: DAY2, waves: 20, zombies: ["normal", "cone", "pole", "bucket"], ramp: 0.42, reward: { type: "plant", id: "puffshroom" } },
    {
      id: "1-10",
      env: DAY2,
      mode: "conveyor",
      waves: 20,
      zombies: ["normal", "cone", "pole", "bucket"],
      ramp: 0.48,
      reward: { type: "plant", id: "sunshroom" },
      title: "\u4F20\u9001\u5E26\u5173\u5361",
      conveyor: [["peashooter", 10], ["repeater", 12], ["snowpea", 8], ["wallnut", 10], ["cherrybomb", 5], ["potatomine", 7], ["chomper", 6], ["squash", 6]]
    },
    // ---------------- 黑夜 ----------------
    { id: "2-1", env: NIGHT2, graves: 3, waves: 10, zombies: ["normal", "cone", "newspaper"], intro: "newspaper", ramp: 0.4, reward: { type: "plant", id: "fumeshroom" }, tutorial: "night" },
    { id: "2-2", env: NIGHT2, graves: 5, waves: 10, zombies: ["normal", "cone", "newspaper", "pole"], ramp: 0.44, reward: { type: "plant", id: "gravebuster" } },
    { id: "2-3", env: NIGHT2, graves: 5, waves: 15, zombies: ["normal", "cone", "newspaper", "screendoor"], intro: "screendoor", ramp: 0.42, reward: { type: "plant", id: "hypnoshroom" } },
    { id: "2-4", env: NIGHT2, graves: 6, waves: 15, zombies: ["normal", "cone", "newspaper", "screendoor", "bucket"], ramp: 0.4, reward: { type: "plant", id: "scaredyshroom" } },
    { id: "2-5", env: NIGHT2, mode: "whack", graves: 9, waves: 12, zombies: ["normal", "cone", "bucket"], ramp: 0.6, reward: { type: "plant", id: "iceshroom" }, title: "\u9524\u50F5\u5C38" },
    { id: "2-6", env: NIGHT2, graves: 6, waves: 15, zombies: ["normal", "cone", "newspaper", "football", "screendoor"], intro: "football", ramp: 0.4, reward: { type: "plant", id: "doomshroom" } },
    { id: "2-7", env: NIGHT2, graves: 6, waves: 20, zombies: ["normal", "cone", "newspaper", "dancer", "bucket"], intro: "dancer", ramp: 0.42, reward: { type: "plant", id: "spikeweed" } },
    { id: "2-8", env: NIGHT2, graves: 7, waves: 20, zombies: ["normal", "cone", "newspaper", "screendoor", "football", "pole"], ramp: 0.42, reward: { type: "plant", id: "jalapeno" } },
    { id: "2-9", env: NIGHT2, graves: 8, waves: 20, zombies: ["normal", "cone", "newspaper", "screendoor", "football", "dancer", "bucket"], ramp: 0.42, reward: { type: "plant", id: "torchwood" } },
    {
      id: "2-10",
      env: NIGHT2,
      mode: "conveyor",
      graves: 5,
      waves: 20,
      zombies: ["normal", "cone", "newspaper", "screendoor", "football", "dancer", "bucket"],
      ramp: 0.5,
      reward: { type: "plant", id: "lilypad" },
      title: "\u4F20\u9001\u5E26\u5173\u5361",
      conveyor: [["puffshroom", 10], ["fumeshroom", 12], ["hypnoshroom", 6], ["scaredyshroom", 8], ["iceshroom", 4], ["doomshroom", 3], ["gravebuster", 5], ["wallnut", 8], ["spikeweed", 6], ["jalapeno", 4]]
    },
    // ---------------- 泳池 ----------------
    { id: "3-1", env: POOL2, waves: 10, zombies: ["normal", "cone", "pole", "bucket"], ramp: 0.44, reward: { type: "plant", id: "tanglekelp" }, tutorial: "pool", intro: "ducky" },
    { id: "3-2", env: POOL2, waves: 15, zombies: ["normal", "cone", "pole", "snorkel", "bucket"], intro: "snorkel", ramp: 0.45, reward: { type: "plant", id: "threepeater" } },
    { id: "3-3", env: POOL2, waves: 15, zombies: ["normal", "cone", "snorkel", "zomboni", "newspaper"], intro: "zomboni", ramp: 0.4, reward: { type: "plant", id: "tallnut" } },
    { id: "3-4", env: POOL2, waves: 20, zombies: ["normal", "cone", "bucket", "dolphin", "screendoor", "pole"], intro: "dolphin", ramp: 0.45, reward: { type: "plant", id: "magnetshroom" } },
    { id: "3-5", env: POOL2, mode: "bowling", waves: 12, zombies: ["normal", "cone", "bucket", "football", "newspaper"], ramp: 0.7, reward: { type: "plant", id: "coffeebean" }, title: "\u575A\u679C\u4FDD\u9F84\u7403 2", giant: true },
    { id: "3-6", env: POOL2, waves: 20, zombies: ["normal", "cone", "bucket", "snorkel", "dolphin", "football", "zomboni"], ramp: 0.48, reward: { type: "plant", id: "seashroom" } },
    { id: "3-7", env: POOL2, waves: 20, zombies: ["normal", "cone", "bucket", "dancer", "snorkel", "screendoor", "pole"], ramp: 0.44, reward: { type: "plant", id: "plantern" } },
    { id: "3-8", env: POOL2, waves: 20, zombies: ["normal", "cone", "bucket", "gargantuar", "dolphin", "snorkel"], intro: "gargantuar", ramp: 0.42, reward: { type: "plant", id: "cactus" } },
    { id: "3-9", env: POOL2, waves: 25, zombies: ["normal", "cone", "bucket", "football", "zomboni", "dolphin", "gargantuar", "newspaper"], ramp: 0.44, reward: { type: "plant", id: "blover" } },
    {
      id: "3-10",
      env: POOL2,
      mode: "conveyor",
      waves: 30,
      zombies: ["normal", "cone", "bucket", "football", "zomboni", "dolphin", "snorkel", "gargantuar", "dancer"],
      ramp: 0.48,
      reward: { type: "plant", id: "splitpea" },
      title: "\u6CF3\u6C60\u51B3\u6218",
      conveyor: [["lilypad", 16], ["threepeater", 8], ["repeater", 8], ["torchwood", 5], ["tallnut", 6], ["squash", 6], ["tanglekelp", 5], ["jalapeno", 4], ["cherrybomb", 4], ["spikeweed", 5], ["snowpea", 6], ["wallnut", 5]]
    },
    // ---------------- 浓雾 ----------------
    { id: "4-1", env: FOG2, sun: 150, firstDelay: 25, fog: 4, waves: 10, zombies: ["normal", "cone", "bucket", "snorkel", "balloon"], intro: "balloon", ramp: 0.42, reward: { type: "plant", id: "starfruit" }, tutorial: "fog" },
    { id: "4-2", env: FOG2, sun: 150, firstDelay: 25, fog: 4, waves: 15, zombies: ["normal", "cone", "bucket", "balloon", "digger", "dolphin"], intro: "digger", ramp: 0.42, reward: { type: "plant", id: "pumpkin" } },
    { id: "4-3", env: FOG2, sun: 150, firstDelay: 25, fog: 4, waves: 15, zombies: ["normal", "cone", "pogo", "balloon", "snorkel", "screendoor"], intro: "pogo", ramp: 0.42, reward: { type: "plant", id: "garlic" } },
    { id: "4-4", env: FOG2, sun: 150, firstDelay: 25, fog: 5, waves: 20, zombies: ["normal", "cone", "bucket", "jackbox", "digger", "dolphin"], intro: "jackbox", ramp: 0.42, reward: { type: "note", text: "\u96FE\u8D8A\u6765\u8D8A\u6D53\u4E86\uFF0C\u6211\u4EEC\u8D8A\u6765\u8D8A\u8FD1\u4E86\u3002" } },
    {
      id: "4-5",
      env: FOG2,
      fog: 6,
      storm: true,
      waves: 12,
      zombies: ["normal", "cone", "bucket", "football", "dolphin", "snorkel"],
      ramp: 0.5,
      reward: { type: "note", text: "\u4F60\u5728\u96F7\u96E8\u4E2D\u4E5F\u770B\u5F97\u89C1\u6211\u4EEC\u5417\uFF1F" },
      title: "\u96F7\u96E8\u4E4B\u591C",
      mode: "conveyor",
      conveyor: [["lilypad", 12], ["repeater", 8], ["threepeater", 6], ["plantern", 6], ["tallnut", 5], ["squash", 5], ["tanglekelp", 4], ["jalapeno", 3], ["cherrybomb", 3], ["splitpea", 4], ["starfruit", 5]]
    },
    { id: "4-6", env: FOG2, sun: 150, firstDelay: 25, fog: 5, waves: 20, zombies: ["normal", "cone", "bucket", "balloon", "pogo", "football", "snorkel"], ramp: 0.44, reward: { type: "note", text: "\u6211\u4EEC\u559C\u6B22\u4F60\u7684\u8611\u83C7\uFF0C\u5B83\u4EEC\u5C1D\u8D77\u6765\u50CF\u96FE\u3002" } },
    { id: "4-7", env: FOG2, sun: 150, firstDelay: 25, fog: 5, waves: 20, zombies: ["normal", "cone", "bucket", "digger", "jackbox", "dolphin", "zomboni"], ramp: 0.44, reward: { type: "note", text: "\u542C\u8BF4\u6709\u4E00\u4E2A\u625B\u7740\u7535\u7EBF\u6746\u7684\u5927\u5BB6\u4F19\u6B63\u5728\u8D76\u6765\u2026\u2026" } },
    { id: "4-8", env: FOG2, sun: 150, firstDelay: 25, fog: 5, waves: 20, zombies: ["normal", "cone", "bucket", "gargantuar", "balloon", "snorkel", "dolphin"], ramp: 0.42, reward: { type: "note", text: "\u5DE8\u4EBA\u5012\u4E0B\u4E86\uFF0C\u4F46\u5B83\u4EEC\u8FD8\u4F1A\u56DE\u6765\u3002" } },
    { id: "4-9", env: FOG2, sun: 150, firstDelay: 25, fog: 6, storm: true, waves: 25, zombies: ["normal", "cone", "bucket", "football", "pogo", "digger", "balloon", "jackbox", "dolphin"], ramp: 0.44, reward: { type: "note", text: "\u6700\u540E\u4E00\u6218\u5373\u5C06\u6765\u4E34\u3002" } },
    {
      id: "4-10",
      env: FOG2,
      fog: 5,
      mode: "conveyor",
      waves: 30,
      zombies: ["normal", "cone", "bucket", "football", "zomboni", "dolphin", "snorkel", "gargantuar", "balloon", "digger", "pogo", "jackbox"],
      ramp: 0.48,
      reward: { type: "trophy" },
      title: "\u6700\u7EC8\u51B3\u6218",
      conveyor: [["lilypad", 14], ["threepeater", 8], ["repeater", 8], ["plantern", 5], ["cactus", 5], ["blover", 3], ["splitpea", 5], ["starfruit", 5], ["pumpkin", 5], ["tallnut", 5], ["squash", 5], ["jalapeno", 3], ["cherrybomb", 3], ["torchwood", 4]]
    }
  ];
  var MINIGAMES = [
    { id: "mg-bowling", env: DAY2, mode: "bowling", waves: 15, zombies: ["normal", "cone", "bucket", "newspaper", "pole"], ramp: 0.7, title: "\u575A\u679C\u4FDD\u9F84\u7403", desc: "\u7528\u6EDA\u52A8\u7684\u575A\u679C\u51FB\u5012\u4E00\u6392\u6392\u50F5\u5C38\uFF0C\u6253\u51FA\u8FDE\u51FB\uFF01", giant: true },
    { id: "mg-whack", env: NIGHT2, mode: "whack", graves: 10, waves: 15, zombies: ["normal", "cone", "bucket"], ramp: 0.7, title: "\u9524\u50F5\u5C38", desc: "\u50F5\u5C38\u4F1A\u4ECE\u575F\u5893\u91CC\u94BB\u51FA\u6765\uFF0C\u5FEB\u62A1\u8D77\u9524\u5B50\u7838\u5B83\u4EEC\uFF01" },
    { id: "mg-vase", env: NIGHT2, mode: "vase", title: "\u7838\u7F50\u5B50", desc: "\u7838\u5F00\u7F50\u5B50\uFF0C\u770B\u770B\u91CC\u9762\u662F\u690D\u7269\u8FD8\u662F\u50F5\u5C38\u3002", waves: 1, zombies: ["normal", "cone", "bucket", "newspaper", "pole", "screendoor", "football"] },
    {
      id: "mg-conveyor",
      env: POOL2,
      mode: "conveyor",
      waves: 20,
      zombies: ["normal", "cone", "bucket", "snorkel", "dolphin", "football", "zomboni", "pole"],
      ramp: 0.55,
      title: "\u4F20\u9001\u5E26\u72C2\u6B22",
      desc: "\u4E0D\u9700\u8981\u9633\u5149\uFF01\u7528\u4F20\u9001\u5E26\u9001\u6765\u7684\u690D\u7269\u5B88\u4F4F\u6CF3\u6C60\u3002",
      conveyor: [["lilypad", 16], ["peashooter", 8], ["repeater", 8], ["snowpea", 6], ["torchwood", 5], ["tallnut", 5], ["squash", 6], ["tanglekelp", 5], ["cherrybomb", 4], ["jalapeno", 4], ["threepeater", 5]]
    },
    { id: "mg-invisible", env: NIGHT2, waves: 15, graves: 4, zombies: ["normal", "cone", "bucket", "newspaper", "pole", "screendoor"], ramp: 0.45, title: "\u9690\u5F62\u98DF\u8111\u8005", desc: "\u50F5\u5C38\u5168\u90E8\u9690\u5F62\u4E86\uFF01\u53EA\u6709\u88AB\u51FB\u4E2D\u65F6\u624D\u4F1A\u663E\u5F62\u3002", invisible: true },
    {
      id: "mg-rain",
      env: DAY2,
      mode: "conveyor",
      waves: 20,
      zombies: ["normal", "cone", "bucket", "pole", "newspaper", "football", "dancer"],
      ramp: 0.6,
      title: "\u79CD\u5B50\u96E8",
      desc: "\u690D\u7269\u79CD\u5B50\u4ECE\u5929\u800C\u964D\uFF0C\u62A2\u5728\u5B83\u4EEC\u6D88\u5931\u524D\u6361\u8D77\u6765\uFF01",
      rain: true,
      conveyor: [["peashooter", 10], ["repeater", 10], ["snowpea", 8], ["wallnut", 8], ["cherrybomb", 4], ["squash", 6], ["chomper", 6], ["potatomine", 6], ["threepeater", 5], ["torchwood", 4], ["jalapeno", 3]]
    }
  ];
  var SURVIVAL = [
    { id: "sv-day", env: DAY2, mode: "survival", title: "\u751F\u5B58\u6A21\u5F0F\uFF1A\u767D\u5929", desc: "\u65E0\u5C3D\u7684\u50F5\u5C38\u6F6E\uFF0C\u4F60\u80FD\u575A\u6301\u591A\u5C11\u65D7\uFF1F", zombies: ["normal", "cone", "pole", "bucket", "newspaper", "screendoor", "football", "dancer"], ramp: 0.5, waves: 9999 },
    { id: "sv-night", env: NIGHT2, mode: "survival", graves: 5, title: "\u751F\u5B58\u6A21\u5F0F\uFF1A\u9ED1\u591C", desc: "\u6CA1\u6709\u9633\u5149\u4ECE\u5929\u800C\u964D\u7684\u6F2B\u6F2B\u957F\u591C\u3002", zombies: ["normal", "cone", "pole", "bucket", "newspaper", "screendoor", "football", "dancer"], ramp: 0.5, waves: 9999 },
    { id: "sv-fog", env: FOG2, sun: 150, mode: "survival", fog: 4, title: "\u751F\u5B58\u6A21\u5F0F\uFF1A\u6D53\u96FE", desc: "\u96FE\u4E2D\u7684\u65E0\u5C3D\u50F5\u5C38\u6F6E\uFF0C\u7741\u5927\u773C\u775B\uFF01", zombies: ["normal", "cone", "bucket", "balloon", "digger", "pogo", "jackbox", "snorkel", "dolphin", "football"], ramp: 0.5, waves: 9999 },
    { id: "sv-pool", env: POOL2, mode: "survival", title: "\u751F\u5B58\u6A21\u5F0F\uFF1A\u6CF3\u6C60", desc: "\u6C34\u9646\u4E24\u6816\u7684\u65E0\u5C3D\u6311\u6218\u3002", zombies: ["normal", "cone", "pole", "bucket", "newspaper", "screendoor", "football", "snorkel", "dolphin", "zomboni", "gargantuar"], ramp: 0.55, waves: 9999 }
  ];
  function levelIndex(id) {
    return ADVENTURE.findIndex((l) => l.id === id);
  }
  function findLevel(id) {
    return ADVENTURE.find((l) => l.id === id) || MINIGAMES.find((l) => l.id === id) || SURVIVAL.find((l) => l.id === id);
  }
  function slotsFor(level) {
    if (level.slots) return level.slots;
    if (level.mode === "survival") return 10;
    if (level.env === "fog") return 9;
    if (level.env === "pool") return 8;
    if (level.env === "night") return 7;
    return 6;
  }

  // src/scenes/menu.js
  var Scenes = {};
  function registerMenuScenes(s) {
    Scenes = s;
  }
  var bgCache = null;
  function menuBackground() {
    const k = display.cacheScale;
    if (bgCache && bgCache.scale === k) return bgCache;
    bgCache = display.makeCanvas(W, H, k);
    const ctx = bgCache.ctx;
    const rand2 = mulberry32(99);
    ctx.fillStyle = lg(ctx, 0, 0, 0, 520, [0, "#120c30", 0.45, "#4a2a6a", 0.8, "#b8587a", 1, "#f0a060"]);
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 120; i++) {
      ctx.globalAlpha = rand2() * 0.8;
      C(ctx, rand2() * W, rand2() * 300, rand2() * 1.3 + 0.3);
      ctx.fillStyle = "#fff";
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    C(ctx, 560, 170, 170);
    ctx.fillStyle = rg(ctx, 560, 170, 20, 560, 170, 170, [0, "rgba(255,230,200,0.45)", 1, "rgba(255,150,120,0)"]);
    ctx.fill();
    ctx.restore();
    C(ctx, 560, 170, 70);
    fs(ctx, rg(ctx, 540, 150, 5, 560, 170, 72, [0, "#fffbe8", 1, "#f0d8b8"]));
    ctx.globalAlpha = 0.15;
    for (const [dx, dy, r] of [[-20, -10, 14], [18, 16, 11], [8, -30, 8], [-26, 26, 9], [30, -8, 6]]) {
      C(ctx, 560 + dx, 170 + dy, r);
      ctx.fillStyle = "#8a7a6a";
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    const hill = (y0, amp, col, seed) => {
      const r = mulberry32(seed);
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let x = 0; x <= W; x += 40) ctx.lineTo(x, y0 + Math.sin(x * 6e-3 + seed) * amp + r() * 12);
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fillStyle = col;
      ctx.fill();
    };
    hill(420, 30, "#2a1a40", 1);
    hill(470, 24, "#1c1430", 2);
    ctx.strokeStyle = "#0e0a18";
    ctx.lineCap = "round";
    const branch = (x, y, len, ang, w, d) => {
      if (d <= 0) return;
      const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      branch(x2, y2, len * 0.72, ang - 0.45 - rand2() * 0.2, w * 0.65, d - 1);
      branch(x2, y2, len * 0.7, ang + 0.4 + rand2() * 0.25, w * 0.65, d - 1);
    };
    branch(90, 520, 90, -Math.PI / 2 - 0.1, 16, 7);
    for (let i = 0; i < 12; i++) {
      const x = 60 + i * 110 + rand2() * 40, y = 480 + rand2() * 30, h = 30 + rand2() * 26;
      ctx.fillStyle = "#140e22";
      ctx.beginPath();
      if (i % 3 === 0) {
        ctx.rect(x - 4, y - h, 8, h);
        ctx.rect(x - 14, y - h + 10, 28, 8);
      } else {
        ctx.moveTo(x - 14, y);
        ctx.lineTo(x - 14, y - h + 12);
        ctx.quadraticCurveTo(x, y - h - 6, x + 14, y - h + 12);
        ctx.lineTo(x + 14, y);
      }
      ctx.fill();
    }
    ctx.fillStyle = "#0c0816";
    ctx.beginPath();
    ctx.moveTo(-10, 560);
    ctx.lineTo(-10, 360);
    ctx.lineTo(90, 290);
    ctx.lineTo(200, 360);
    ctx.lineTo(200, 560);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ffcf6a";
    ctx.fillRect(40, 400, 36, 44);
    ctx.fillRect(120, 400, 36, 44);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const x of [58, 138]) {
      C(ctx, x, 422, 60);
      ctx.fillStyle = rg(ctx, x, 422, 5, x, 422, 60, [0, "rgba(255,190,80,0.35)", 1, "rgba(255,150,40,0)"]);
      ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = lg(ctx, 0, 520, 0, H, [0, "#1e3a1a", 1, "#0c1a0a"]);
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 30) ctx.lineTo(x, 540 + Math.sin(x * 0.01) * 10);
    ctx.lineTo(W, H);
    ctx.fill();
    for (let i = 0; i < 400; i++) {
      const x = rand2() * W, y = 550 + rand2() * 170;
      ctx.strokeStyle = `rgba(${60 + rand2() * 40},${110 + rand2() * 60},${50},${0.3 + rand2() * 0.3})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + rand2() * 4 - 2, y - 6 - rand2() * 8);
      ctx.stroke();
    }
    return bgCache;
  }
  function drawTombstone(ctx, x, y, w, h) {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.beginPath();
    E(ctx, x + w / 2, y + h, w * 0.62, 26);
    ctx.fill();
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(x, y + h);
      ctx.lineTo(x + 6, y + 150);
      ctx.bezierCurveTo(x + 10, y - 20, x + w - 10, y - 20, x + w - 6, y + 150);
      ctx.lineTo(x + w, y + h);
      ctx.closePath();
    };
    path();
    fs(ctx, lg(ctx, x, y, x + w, y + h, [0, "#a4a8b4", 0.5, "#737886", 1, "#4a4e5a"]), "#15161c", 4);
    ctx.save();
    path();
    ctx.clip();
    const r = mulberry32(7);
    ctx.strokeStyle = "rgba(20,20,30,0.3)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 7; i++) {
      let px = x + r() * w, py = y + 60 + r() * (h - 80);
      ctx.beginPath();
      ctx.moveTo(px, py);
      for (let k = 0; k < 4; k++) {
        px += r() * 30 - 15;
        py += r() * 26;
        ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(70,120,60,0.45)";
    for (let i = 0; i < 14; i++) {
      E(ctx, x + r() * w, y + h - r() * 60, 10 + r() * 20, 5 + r() * 8);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(x, y, w * 0.18, h);
    ctx.restore();
    text(ctx, "\u6B22\u8FCE\u56DE\u6765", x + w / 2, y + 62, { size: 26, color: "rgba(30,30,40,0.55)", weight: 900 });
    ctx.restore();
  }
  var MenuScene = class _MenuScene {
    constructor() {
      this.t = 0;
      this.ui = new UIGroup();
      this.overlay = null;
      this.overlayUI = new UIGroup();
      this.hands = [];
      this.handT = 1;
      this.flies = Array.from({ length: 26 }, () => ({ x: rand(0, W), y: rand(300, 700), p: rand(0, TAU), s: rand(0.5, 1.4) }));
      this.walker = { x: 1400, row: 0, t: 0 };
      const adv = save.data.adventure;
      const tx = 760, tw = 400;
      const next = ADVENTURE[Math.min(adv, ADVENTURE.length - 1)];
      this.advBtn = this.ui.add(new Button({ x: tx + 30, y: 206, w: tw - 60, h: 84, label: "\u5192\u9669\u6A21\u5F0F", style: "stone", fontSize: 36, onClick: () => director.go(new Scenes.LevelSelectScene()) }));
      this.advSub = adv >= ADVENTURE.length ? "\u5DF2\u901A\u5173\uFF01" : `\u5173\u5361 ${next.id}`;
      const mgLocked = adv < 5;
      const svLocked = adv < 10;
      this.ui.add(new Button({ x: tx + 40, y: 340, w: tw - 80, h: 68, label: mgLocked ? "\u5C0F\u6E38\u620F\uFF08\u901A\u5173 1-5 \u89E3\u9501\uFF09" : "\u5C0F\u6E38\u620F", style: "stone", fontSize: mgLocked ? 21 : 30, disabled: mgLocked, onClick: () => director.go(new Scenes.MinigameScene("minigame")) }));
      this.ui.add(new Button({ x: tx + 40, y: 424, w: tw - 80, h: 68, label: svLocked ? "\u751F\u5B58\u6A21\u5F0F\uFF08\u901A\u5173 1-10 \u89E3\u9501\uFF09" : "\u751F\u5B58\u6A21\u5F0F", style: "stone", fontSize: svLocked ? 21 : 30, disabled: svLocked, onClick: () => director.go(new Scenes.MinigameScene("survival")) }));
      this.ui.add(new Button({ x: tx + 40, y: 508, w: tw - 80, h: 68, label: "\u56FE\u9274", style: "stone", fontSize: 30, onClick: () => director.go(new Scenes.AlmanacScene()) }));
      this.ui.add(new Button({ x: 30, y: 640, w: 120, h: 52, label: "\u8BBE\u7F6E", style: "wood", fontSize: 22, onClick: () => this.openSettings() }));
      this.ui.add(new Button({ x: 164, y: 640, w: 120, h: 52, label: "\u5E2E\u52A9", style: "wood", fontSize: 22, onClick: () => this.openHelp() }));
      this.ui.add(new Button({ x: 298, y: 640, w: 120, h: 52, label: "\u5168\u5C4F", style: "wood", fontSize: 22, onClick: () => this.fullscreen() }));
    }
    enter() {
      music.play("menu");
    }
    fullscreen() {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {
      });
      else document.exitFullscreen?.();
    }
    openSettings() {
      this.overlay = "settings";
      const s = save.settings;
      const ui = this.overlayUI;
      ui.clear();
      ui.add(new Slider({ x: 580, y: 250, w: 260, label: "\u97F3\u4E50\u97F3\u91CF", value: s.music, onChange: (v) => {
        s.music = v;
        audio.applyVolumes();
        save.write();
      } }));
      ui.add(new Slider({ x: 580, y: 305, w: 260, label: "\u97F3\u6548\u97F3\u91CF", value: s.sfx, onChange: (v) => {
        s.sfx = v;
        audio.applyVolumes();
        save.write();
      } }));
      ui.add(new Toggle({ x: 580, y: 360, label: "\u81EA\u52A8\u6536\u96C6\u9633\u5149", value: s.autoCollect, onChange: (v) => {
        s.autoCollect = v;
        save.write();
      } }));
      ui.add(new Toggle({ x: 800, y: 360, label: "\u663E\u793A\u8840\u91CF\u6761", value: s.healthBars, onChange: (v) => {
        s.healthBars = v;
        save.write();
      } }));
      ui.add(new Button({ x: 400, y: 410, w: 230, h: 50, label: "\u89E3\u9501\u5168\u90E8\u5185\u5BB9", style: "purple", fontSize: 20, onClick: () => this.confirm("\u89E3\u9501\u5168\u90E8\u5173\u5361\u4E0E\u690D\u7269\uFF1F", () => {
        save.unlockAll(ADVENTURE.length, PLANT_ORDER);
        director.go(new _MenuScene());
      }) }));
      ui.add(new Button({ x: 650, y: 410, w: 230, h: 50, label: "\u91CD\u7F6E\u5B58\u6863", style: "red", fontSize: 20, onClick: () => this.confirm("\u786E\u5B9A\u8981\u6E05\u7A7A\u5168\u90E8\u8FDB\u5EA6\u5417\uFF1F", () => {
        save.reset();
        director.go(new _MenuScene());
      }) }));
      ui.add(new Button({ x: 540, y: 490, w: 200, h: 56, label: "\u5B8C\u6210", style: "green", onClick: () => {
        this.overlay = null;
      } }));
    }
    confirm(msg, yes) {
      this.overlay = "confirm";
      this.confirmMsg = msg;
      const ui = this.overlayUI;
      ui.clear();
      ui.add(new Button({ x: 450, y: 400, w: 170, h: 56, label: "\u786E\u5B9A", style: "red", onClick: () => {
        this.overlay = null;
        yes();
      } }));
      ui.add(new Button({ x: 660, y: 400, w: 170, h: 56, label: "\u53D6\u6D88", style: "stone", onClick: () => this.openSettings() }));
    }
    openHelp() {
      this.overlay = "help";
      const ui = this.overlayUI;
      ui.clear();
      ui.add(new Button({ x: 540, y: 600, w: 200, h: 56, label: "\u77E5\u9053\u4E86", style: "green", onClick: () => {
        this.overlay = null;
      } }));
    }
    update(dt) {
      this.t += dt;
      this.handT -= dt;
      if (this.handT <= 0) {
        this.handT = rand(1.2, 3);
        this.hands.push({ x: rand(40, 700), y: rand(580, 700), t: 0, life: rand(2.5, 4), s: rand(0.7, 1.1) });
      }
      for (const h of this.hands) h.t += dt;
      this.hands = this.hands.filter((h) => h.t < h.life);
      for (const f of this.flies) {
        f.p += dt * f.s;
        f.x += Math.cos(f.p * 0.7) * 12 * dt;
        f.y += Math.sin(f.p) * 10 * dt;
      }
      this.walker.t += dt;
      this.walker.x -= 14 * dt;
      if (this.walker.x < -100) this.walker.x = 1400;
    }
    pointerMove(x, y) {
      display.setCursor("default");
      if (this.overlay) {
        this.overlayUI.move(x, y);
        return;
      }
      this.ui.move(x, y);
    }
    pointerDown(x, y) {
      if (this.overlay) {
        this.overlayUI.down(x, y);
        return;
      }
      this.ui.down(x, y);
      for (const h of this.hands) if (Math.abs(h.x - x) < 30 && Math.abs(h.y - 30 - y) < 40) {
        h.t = h.life;
        audio.play("whack");
      }
    }
    pointerUp(x, y) {
      if (this.overlay) {
        this.overlayUI.up(x, y);
        return;
      }
      this.ui.up(x, y);
    }
    key(k) {
      if (k === "Escape" && this.overlay) this.overlay = null;
    }
    draw(ctx) {
      const t = this.t;
      const bg = menuBackground();
      ctx.drawImage(bg.canvas, 0, 0, W, H);
      ctx.save();
      for (let i = 0; i < 3; i++) {
        const x = (t * 12 + i * 500) % 1700 - 250, y = 140 + i * 40;
        ctx.globalAlpha = 0.35;
        for (let k = 0; k < 5; k++) {
          E(ctx, x + k * 40, y + Math.sin(k) * 8, 50, 16);
          ctx.fillStyle = "#2a1a44";
          ctx.fill();
        }
      }
      ctx.restore();
      const wk = this.walker;
      drawTinted(ctx, wk.x, 500, 130, 110, 1, (c) => {
        c.scale(0.5, 0.5);
        drawZombieArt(c, { type: "normal", t: wk.t, walkPh: wk.t * 3, anim: "walk", hasArm: true, hasHead: true });
      }, [{ color: "#170f28", alpha: 0.92 }]);
      for (const h of this.hands) {
        const k = h.t / h.life;
        const up = k < 0.25 ? Ease.outBack(k / 0.25) : k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
        ctx.save();
        ctx.translate(h.x, h.y);
        ctx.scale(h.s, h.s);
        ctx.beginPath();
        ctx.rect(-40, -120, 80, 120);
        ctx.clip();
        ctx.translate(0, (1 - up) * 70);
        ctx.rotate(Math.sin(h.t * 6) * 0.15);
        drawHand(ctx);
        ctx.restore();
        E(ctx, h.x, h.y, 26 * h.s, 7 * h.s);
        ctx.fillStyle = "#2a1a0a";
        ctx.fill();
      }
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (const f of this.flies) {
        const a = 0.4 + 0.6 * Math.abs(Math.sin(f.p * 2));
        C(ctx, f.x, f.y, 7);
        ctx.fillStyle = rg(ctx, f.x, f.y, 0, f.x, f.y, 7, [0, `rgba(230,255,120,${a})`, 1, "rgba(200,255,80,0)"]);
        ctx.fill();
      }
      ctx.restore();
      const deco = [{ f: "sunflower", x: 500, y: 668, s: 1.35 }, { f: "peashooter", x: 632, y: 688, s: 1.3 }, { f: "puffshroom", x: 712, y: 690, s: 1.1 }, { f: "wallnut", x: 390, y: 690, s: 1.05 }];
      for (const d of deco) {
        ctx.save();
        ctx.translate(d.x, d.y);
        ctx.scale(d.s, d.s);
        PLANT_ART[d.f](ctx, { t, phase: d.x });
        ctx.restore();
      }
      drawLogo(ctx, 360, 150, 0.95, t);
      drawTombstone(ctx, 760, 120, 400, 580);
      this.ui.draw(ctx);
      text(ctx, this.advSub, this.advBtn.x + this.advBtn.w / 2, this.advBtn.y + this.advBtn.h + 18, { size: 18, color: "#f8f0c8", stroke: "#1a1a20", lw: 5 });
      const st = save.data.stats;
      text(ctx, `\u5DF2\u6D88\u706D\u50F5\u5C38 ${st.zombiesKilled}   \xB7   \u6536\u96C6\u9633\u5149 ${st.sunCollected}   \xB7   \u5DF2\u89E3\u9501\u690D\u7269 ${save.data.plants.length}/${PLANT_ORDER.length}`, 640, 710, { size: 14, color: "rgba(255,255,255,0.6)", weight: 600 });
      if (this.overlay) this.drawOverlay(ctx);
    }
    drawOverlay(ctx) {
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(0, 0, W, H);
      if (this.overlay === "settings") {
        drawPanel(ctx, 360, 150, 560, 430, "stone");
        text(ctx, "\u8BBE\u7F6E", 640, 196, { size: 36, color: "#e8f0d8", stroke: "#1a1c20", lw: 8 });
      } else if (this.overlay === "confirm") {
        drawPanel(ctx, 400, 240, 480, 250, "stone");
        text(ctx, this.confirmMsg, 640, 320, { size: 26, color: "#fff", stroke: "#1a1c20", lw: 6 });
      } else if (this.overlay === "help") {
        drawPanel(ctx, 240, 70, 800, 610, "paper");
        text(ctx, "\u6E38\u620F\u5E2E\u52A9", 640, 118, { size: 36, color: "#5a3a10", weight: 900 });
        const lines = [
          "\xB7 \u70B9\u51FB\u4E0A\u65B9\u7684\u79CD\u5B50\u5361\u7247\uFF0C\u518D\u70B9\u51FB\u8349\u576A\u5373\u53EF\u79CD\u4E0B\u690D\u7269\uFF0C\u6BCF\u79CD\u690D\u7269\u90FD\u9700\u8981\u6D88\u8017\u9633\u5149\u3002",
          "\xB7 \u70B9\u51FB\u5929\u7A7A\u843D\u4E0B\u6216\u5411\u65E5\u8475\u4EA7\u51FA\u7684\u9633\u5149\u6765\u6536\u96C6\uFF0C\u9633\u5149\u662F\u79CD\u690D\u690D\u7269\u7684\u552F\u4E00\u8D27\u5E01\u3002",
          "\xB7 \u79CD\u5B50\u5361\u7247\u7528\u5B8C\u540E\u9700\u8981\u51B7\u5374\u4E00\u6BB5\u65F6\u95F4\u624D\u80FD\u518D\u6B21\u4F7F\u7528\u3002",
          "\xB7 \u7528\u94F2\u5B50\u53EF\u4EE5\u6316\u6389\u4E0D\u9700\u8981\u7684\u690D\u7269\uFF1B\u53F3\u952E\u6216 Esc \u53EF\u4EE5\u653E\u4E0B\u624B\u4E2D\u7684\u5361\u7247\u3002",
          "\xB7 \u6BCF\u4E00\u884C\u6700\u5DE6\u4FA7\u90FD\u6709\u4E00\u53F0\u5272\u8349\u673A\uFF0C\u50F5\u5C38\u9760\u8FD1\u623F\u5B50\u65F6\u4F1A\u81EA\u52A8\u542F\u52A8\uFF0C\u4F46\u53EA\u80FD\u7528\u4E00\u6B21\uFF01",
          "\xB7 \u8611\u83C7\u5728\u767D\u5929\u4F1A\u7761\u89C9\uFF0C\u53EF\u4EE5\u7528\u5496\u5561\u8C46\u5524\u9192\u5B83\u4EEC\u3002",
          "\xB7 \u6C34\u9762\u4E0A\u9700\u8981\u5148\u79CD\u7761\u83B2\uFF0C\u624D\u80FD\u79CD\u4E0B\u5176\u4ED6\u9646\u5730\u690D\u7269\u3002",
          "\xB7 \u300C\u4E00\u5927\u6CE2\u50F5\u5C38\u300D\u6765\u88AD\u524D\u4F1A\u6709\u63D0\u793A\uFF0C\u63D0\u524D\u505A\u597D\u51C6\u5907\uFF01",
          "",
          "\u5FEB\u6377\u952E\uFF1A\u6570\u5B57\u952E 1-0 \u9009\u5361 \xB7 S \u94F2\u5B50 \xB7 \u7A7A\u683C/Esc \u6682\u505C \xB7 X \u5207\u6362\u500D\u901F \xB7 F \u5168\u5C4F"
        ];
        lines.forEach((ln, i) => text(ctx, ln, 290, 178 + i * 40, { size: 19, color: "#3a2a10", weight: 600, align: "left" }));
      }
      this.overlayUI.draw(ctx);
    }
  };
  function drawHand(ctx) {
    const skin = "#8aa278", stroke = "#2a3420";
    ctx.beginPath();
    ctx.moveTo(-8, 10);
    ctx.lineTo(-7, -40);
    ctx.lineTo(7, -40);
    ctx.lineTo(8, 10);
    ctx.closePath();
    fs(ctx, "#5a4632", "#1a120a", 2);
    E(ctx, 0, -50, 14, 13);
    fs(ctx, skin, stroke, 2);
    for (const [dx, ang, len] of [[-10, -0.5, 18], [-4, -0.15, 22], [3, 0.1, 22], [9, 0.4, 18]]) {
      ctx.save();
      ctx.translate(dx, -58);
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.moveTo(-3, 0);
      ctx.lineTo(-2.5, -len);
      ctx.quadraticCurveTo(0, -len - 4, 2.5, -len);
      ctx.lineTo(3, 0);
      ctx.closePath();
      fs(ctx, skin, stroke, 1.6);
      ctx.restore();
    }
  }

  // src/game/plant.js
  var VISIBLE_RIGHT = 1262;
  var FUSE = { cherrybomb: 1, jalapeno: 1, iceshroom: 1, doomshroom: 1.25 };
  var Plant = class {
    constructor(board, type, col, row, o = {}) {
      this.board = board;
      this.isPlant = true;
      this.type = type;
      this.def = PLANTS[type];
      this.kind = this.def.kind;
      this.col = col;
      this.row = row;
      this.x = colX(col);
      this.baseY = board.rowY(row);
      this.onPad = !!o.onPad;
      this.slot = o.slot || "main";
      this.hp = this.maxHp = this.def.hp;
      this.t = 0;
      this.phase = rand(0, 10);
      this.s = { t: 0, phase: this.phase };
      this.sleep = !!this.def.night && !board.isNight && !o.awake;
      this.dead = false;
      this.flash = 0;
      this.pop = o.noPop ? 1 : 0;
      this.alpha = 1;
      this.init();
    }
    get y() {
      return this.baseY - (this.onPad ? 10 : 0) + (this.yOff || 0);
    }
    // 是否挡住僵尸（会被啃）
    // 正在引爆的一次性植物：不会被啃、不会被压扁
    get fusing() {
      return this.kind === "instant" && !this.sleep;
    }
    get blocking() {
      if (this.dead) return false;
      if (this.fusing) return false;
      if (this.kind === "spike") return false;
      if (this.kind === "squash" && this.state !== "idle" && this.state !== "look") return false;
      if (this.kind === "mine" && this.armed) return false;
      if (this.kind === "kelp") return false;
      if (this.slot === "overlay") return false;
      return true;
    }
    init() {
      switch (this.kind) {
        case "shooter":
          this.cool = rand(0.3, 1.1);
          this.shootT = -1;
          this.pending = [];
          break;
        case "producer":
          this.prodT = rand(3, 12.5);
          if (this.type === "sunshroom") {
            this.growT = 120;
            this.grown = false;
            this.s.grow = 0;
          }
          break;
        case "instant":
          this.fuseT = 0;
          break;
        case "mine":
          this.armT = this.board.cheatFastMine ? 1 : this.def.armTime;
          this.armed = false;
          this.s.rise = 0;
          break;
        case "melee":
          this.state = "idle";
          break;
        case "squash":
          this.state = "idle";
          break;
        case "fume":
          this.cool = rand(0.3, 1);
          this.shootT = -1;
          break;
        case "grave":
          this.progress = 0;
          break;
        case "spike":
          this.tick = 0.5;
          break;
        case "kelp":
          this.state = "idle";
          break;
        case "magnet":
          this.cooldown = 0;
          break;
        case "coffee":
          this.wakeT = 0;
          break;
        case "star":
          this.cool = rand(0.3, 1);
          this.shootT = -1;
          break;
        case "blover":
          this.spinT = 0;
          break;
      }
    }
    hurt(amount, killer) {
      if (this.dead || this.fusing) return;
      this.hp -= amount;
      this.flash = 0.12;
      if (this.hp <= 0) this.die(killer);
    }
    die(killer, how = "eaten") {
      if (this.dead) return;
      this.dead = true;
      this.board.removePlant(this);
      if (how === "eaten") {
        audio.play("gulp");
        this.board.fx.dirt(this.x, this.y, 6, 20, ["#4f9a2a", "#3a7a1e", "#7ac04a"]);
      }
      if (this.type === "hypnoshroom" && killer && how === "eaten" && !this.sleep) killer.hypnotize?.();
    }
    // 被冰车 / 巨人压扁
    crush() {
      if (this.dead || this.fusing) return;
      const b = this.board;
      b.fx.add({
        type: "custom",
        x: this.x,
        y: this.y,
        life: 0.8,
        fadeStart: 0.4,
        draw: (ctx, p, k) => {
          ctx.scale(1 + k * 0.3, Math.max(0.08, 0.3 - k * 0.2));
          PLANT_ART[this.type]?.(ctx, this.s);
        }
      });
      this.die(null, "crushed");
    }
    update(dt) {
      this.t += dt;
      this.s.t = this.t;
      if (this.pop < 1) this.pop = Math.min(1, this.pop + dt * 4);
      if (this.flash > 0) this.flash -= dt;
      this.s.sleep = this.sleep;
      if (this.kind === "wall" || this.kind === "pumpkin" || this.kind === "garlic") this.s.dmg = this.hp < this.maxHp / 3 ? 2 : this.hp < this.maxHp * 2 / 3 ? 1 : 0;
      if (this.sleep) return;
      const fn = this["u_" + this.kind];
      if (fn) fn.call(this, dt);
    }
    // ---------------- 射手 ----------------
    u_shooter(dt) {
      const b = this.board;
      this.cool -= dt;
      if (this.def.scared) {
        const near = b.zombies.some((z) => z.isEnemy && z.alive && Math.abs(z.row - this.row) <= 1 && z.x - this.x > -80 && z.x - this.x < 190);
        this.s.hide = clamp((this.s.hide || 0) + (near ? dt * 5 : -dt * 3), 0, 1);
        if (this.s.hide > 0.2) {
          this.shootT = -1;
          this.s.shoot = 0;
          return;
        }
      }
      if (this.shootT >= 0) {
        const prev = this.shootT;
        this.shootT += dt;
        if (prev < 0.15 && this.shootT >= 0.15) this.fire();
        if (this.shootT >= 0.36) this.shootT = -1;
      }
      for (let i = this.pending.length - 1; i >= 0; i--) {
        this.pending[i] -= dt;
        if (this.pending[i] <= 0) {
          this.pending.splice(i, 1);
          this.shootT = 1e-4;
        }
      }
      this.s.shoot = this.shootT >= 0 ? this.shootT / 0.36 : 0;
      if (this.def.split) {
        if (this.backT >= 0) {
          const prev = this.backT;
          this.backT += dt;
          if (prev < 0.15 && this.backT >= 0.15) this.fireBack();
          if (this.backT >= 0.36) {
            this.backT = -1;
            if (this.backLeft > 0) {
              this.backLeft--;
              this.backT = 1e-4;
            }
          }
        }
        this.s.shoot2 = this.backT >= 0 ? this.backT / 0.36 : 0;
      }
      if (this.def.antiAir) {
        const air = this.airTarget();
        this.s.stretch = clamp((this.s.stretch || 0) + (air ? dt * 3 : -dt * 3), 0, 1);
      }
      if (this.cool <= 0 && this.shootT < 0) {
        const front = this.hasTarget();
        const back = this.def.split && this.hasBackTarget();
        if (front || back) {
          this.cool = 1.42 + rand(-0.06, 0.06);
          if (front || this.def.split) this.shootT = 1e-4;
          if (this.type === "repeater") this.pending.push(0.22);
          if (this.def.split && (this.backT === void 0 || this.backT < 0)) {
            this.backT = 1e-4;
            this.backLeft = 1;
          }
        } else this.cool = 0.1;
      }
    }
    airTarget() {
      const b = this.board;
      return b.zombies.some((z) => z.isEnemy && z.balloonUp && z.alive && z.row === this.row && z.x > this.x - 20 && z.x < VISIBLE_RIGHT);
    }
    hasBackTarget() {
      const b = this.board;
      return b.zombies.some((z) => z.isEnemy && z.hittable && z.row === this.row && z.x < this.x + 10 && z.x > LAWN_X - 60);
    }
    fireBack() {
      this.board.addProjectile("pea", this.x - 40, this.y - 58, this.row, { dir: -1 });
      audio.play("shoot");
    }
    hasTarget() {
      const b = this.board;
      const range = this.def.range ? this.def.range * COL_W : 2e3;
      const xMax = Math.min(VISIBLE_RIGHT, this.x + range);
      if (this.def.antiAir && this.airTarget()) return true;
      if (this.type === "threepeater") {
        for (const r of [this.row - 1, this.row, this.row + 1]) if (b.activeRow(r) && b.enemyInRow(r, this.x - 20, xMax)) return true;
        return false;
      }
      return b.enemyInRow(this.row, this.x - 20, xMax);
    }
    fire() {
      const b = this.board;
      switch (this.type) {
        case "peashooter":
        case "repeater":
          b.addProjectile("pea", this.x + 44, this.y - 56, this.row);
          audio.play("shoot");
          break;
        case "snowpea":
          b.addProjectile("snow", this.x + 44, this.y - 56, this.row);
          audio.play("shoot");
          break;
        case "threepeater":
          for (const [dr, hy] of [[-1, -80], [0, -46], [1, -50]]) {
            const r = this.row + dr;
            if (!b.activeRow(r)) continue;
            b.addProjectile("pea", this.x + 36, this.y + hy + (b.rowY(r) - b.rowY(this.row)), r, { fromRow: this.row });
          }
          audio.play("shoot");
          break;
        case "puffshroom":
          b.addProjectile("puff", this.x + 26, this.y - 12, this.row, { maxX: this.x + this.def.range * COL_W + 30 });
          audio.play("puff");
          break;
        case "scaredyshroom":
          b.addProjectile("puff", this.x + 26, this.y - 44, this.row);
          audio.play("puff");
          break;
        case "seashroom":
          b.addProjectile("puff", this.x + 26, this.y - 16, this.row, { maxX: this.x + this.def.range * COL_W + 30 });
          audio.play("puff");
          break;
        case "cactus": {
          const st = this.s.stretch || 0;
          b.addProjectile("spike", this.x + 22, this.y - 30 - st * 58, this.row, { air: st > 0.5 });
          audio.play("shoot");
          break;
        }
        case "splitpea":
          b.addProjectile("pea", this.x + 44, this.y - 56, this.row);
          audio.play("shoot");
          break;
      }
    }
    // ---------------- 杨桃 ----------------
    u_star(dt) {
      const b = this.board;
      this.cool -= dt;
      if (this.shootT >= 0) {
        const prev = this.shootT;
        this.shootT += dt;
        if (prev < 0.15 && this.shootT >= 0.15) {
          const x = this.x, y = this.y - 36, v = 360;
          for (const [dx, dy] of [[-1, 0], [0, -1], [0, 1], [0.866, -0.5], [0.866, 0.5]]) b.addStar(x + dx * 20, y + dy * 20, dx * v, dy * v);
          audio.play("shoot");
        }
        if (this.shootT >= 0.4) this.shootT = -1;
      }
      this.s.shoot = this.shootT >= 0 ? this.shootT / 0.4 : 0;
      if (this.cool <= 0 && this.shootT < 0) {
        if (this.starTarget()) {
          this.shootT = 1e-4;
          this.cool = 1.42;
        } else this.cool = 0.1;
      }
    }
    starTarget() {
      const b = this.board;
      const py = this.y;
      for (const z of b.zombies) {
        if (!z.isEnemy || !z.hittable || z.x > VISIBLE_RIGHT) continue;
        const dy = Math.abs(z.y - py);
        if (z.row === this.row && z.x < this.x) return true;
        if (Math.abs(z.x - this.x) < 60) return true;
        if (z.x > this.x && Math.abs(z.x - this.x - dy * 1.732) < 70) return true;
      }
      return false;
    }
    // ---------------- 三叶草 ----------------
    u_blover(dt) {
      const b = this.board;
      const prev = this.spinT;
      this.spinT += dt;
      this.s.spin = clamp(this.spinT / 0.4, 0, 1);
      if (prev < 0.35 && this.spinT >= 0.35) b.blowAway(this.x, this.y);
      if (this.spinT >= 1.4) {
        this.dead = true;
        b.removePlant(this);
      }
    }
    // ---------------- 阳光生产 ----------------
    u_producer(dt) {
      this.prodT -= dt;
      this.s.glow = this.prodT < 1 ? clamp(1 - this.prodT, 0, 1) : Math.max(0, (this.s.glow || 0) - dt * 2);
      if (this.type === "sunshroom" && !this.grown) {
        this.growT -= dt;
        if (this.growT <= 0) {
          this.grown = true;
          audio.play("wakeup");
        }
      }
      if (this.type === "sunshroom") this.s.grow = this.grown ? Math.min(1, (this.s.grow || 0) + dt * 2) : 0;
      if (this.prodT <= 0) {
        this.prodT = 23.5 + rand(0, 1);
        const value = this.type === "sunshroom" ? this.grown ? 25 : 15 : 25;
        this.board.produceSun(this.x, this.y - (this.type === "sunshroom" ? 30 : 56), value);
        audio.play("sunproduce");
      }
    }
    // ---------------- 一次性爆炸类 ----------------
    u_instant(dt) {
      const dur = FUSE[this.type] || 1;
      if (this.fuseT === 0) audio.play(this.type === "doomshroom" ? "fuse" : "fuse");
      this.fuseT += dt;
      this.s.fuse = clamp(this.fuseT / dur, 0, 1);
      if (this.fuseT >= dur) {
        const b = this.board;
        this.dead = true;
        b.removePlant(this);
        switch (this.type) {
          case "cherrybomb":
            b.explodeArea(this.x, this.y, this.row, 1, 1, "cherry");
            break;
          case "jalapeno":
            b.burnRow(this.row);
            break;
          case "iceshroom":
            b.freezeAll(this.x, this.y);
            break;
          case "doomshroom":
            b.doom(this.col, this.row, this.x, this.y);
            break;
        }
      }
    }
    // ---------------- 土豆地雷 ----------------
    u_mine(dt) {
      const b = this.board;
      if (!this.armed) {
        this.armT -= dt;
        if (this.armT <= 0) {
          this.armed = true;
          audio.play("armed");
          b.fx.dirt(this.x, this.y, 10, 20);
        }
        return;
      }
      this.s.rise = Math.min(1, (this.s.rise || 0) + dt * 2.5);
      if (this.s.rise < 1) return;
      const hit = b.zombies.find((z) => z.isEnemy && z.alive && z.row === this.row && z.onGround && z.x - z.halfWidth < this.x + 40 && z.x + z.halfWidth > this.x - 40);
      if (hit) {
        this.dead = true;
        b.removePlant(this);
        for (const z of b.zombies) {
          if (z.isEnemy && z.alive && z.row === this.row && z.x > this.x - 70 && z.x < this.x + 85 && z.onGround) z.takeDamage(1800, "explode");
        }
        audio.play("spudow");
        b.shake(6);
        b.fx.explosion(this.x, this.y - 20, 0.7, { text: "\u571F\u8C46\u96F7\uFF01", textColor: "#fff3a0" });
        b.fx.dirt(this.x, this.y, 22, 40);
      }
    }
    // ---------------- 大嘴花 ----------------
    u_melee(dt) {
      const b = this.board;
      if (this.state === "idle") {
        this.s.bite = 0;
        this.s.chew = 0;
        const z = b.zombies.find((z2) => z2.isEnemy && z2.alive && z2.hittable && z2.onGround && z2.row === this.row && z2.x > this.x - 20 && z2.x - 24 < this.x + 112);
        if (z) {
          this.state = "bite";
          this.biteT = 0;
          this.target = z;
          this.bit = false;
        }
      } else if (this.state === "bite") {
        this.biteT += dt;
        this.s.bite = clamp(this.biteT / 0.8, 0, 1);
        if (!this.bit && this.biteT >= 0.36) {
          this.bit = true;
          const z = this.target;
          this.ate = false;
          if (z && z.alive && z.row === this.row && z.x - 24 < this.x + 130 && z.x > this.x - 40) {
            if (z.type === "gargantuar" || z.type === "zomboni") {
              z.takeDamage(40, "chomp");
              audio.play("bigchomp");
            } else {
              z.eatenByChomper();
              this.ate = true;
              audio.play("bigchomp");
            }
          }
        }
        if (this.biteT >= 0.8) {
          if (this.ate) {
            this.state = "chew";
            this.chewT = 0;
          } else this.state = "idle";
        }
      } else if (this.state === "chew") {
        this.s.bite = 0;
        this.s.chew = 1;
        this.chewT += dt;
        if (this.chewT >= (b.cheatFastChew ? 3 : this.def.chewTime)) {
          this.state = "idle";
          audio.play("gulp");
        }
      }
    }
    // ---------------- 窝瓜 ----------------
    u_squash(dt) {
      const b = this.board;
      this.airborneTop = this.state === "jump" || this.state === "land";
      if (this.state === "idle") {
        const z = b.zombies.find((z2) => z2.isEnemy && z2.alive && z2.hittable && z2.onGround && z2.row === this.row && z2.x > this.x - 80 && z2.x - 20 < this.x + 130);
        if (z) {
          this.state = "look";
          this.lookT = 0;
          this.target = z;
          audio.play("squash");
        }
      } else if (this.state === "look") {
        this.lookT += dt;
        this.s.lookDir = Math.sign((this.target?.x ?? this.x) - this.x);
        if (this.lookT >= 0.45) {
          this.state = "jump";
          this.jumpT = 0;
          this.fromX = this.x;
          const tz = this.target && this.target.alive ? this.target : null;
          this.toX = tz ? clamp(tz.x - 12, this.x - 110, this.x + 150) : this.x;
          b.clearCellSlot(this);
        }
      } else if (this.state === "jump") {
        this.jumpT += dt;
        const up = 0.42, down = 0.16;
        if (this.jumpT < up) {
          const k = Ease.outCubic(this.jumpT / up);
          this.x = lerp(this.fromX, this.toX, k);
          this.yOff = -130 * k;
          this.s.airborne = true;
        } else if (this.jumpT < up + 0.12) {
          this.yOff = -130;
        } else if (this.jumpT < up + 0.12 + down) {
          const k = Ease.inQuad((this.jumpT - up - 0.12) / down);
          this.yOff = -130 * (1 - k);
        } else {
          this.yOff = 0;
          this.state = "land";
          this.landT = 0;
          this.s.squish = 1;
          for (const z of b.zombies) {
            if (z.isEnemy && z.alive && z.row === this.row && Math.abs(z.x - this.x) < 62 && z.onGround) z.takeDamage(1800, "squash");
          }
          audio.play("thud");
          b.shake(7);
          b.fx.dirt(this.x, this.y, 16, 40);
          b.fx.smoke(this.x, this.y - 10, 5, { scale: 0.8, color: "rgba(140,120,90,0.5)" });
        }
      } else if (this.state === "land") {
        this.landT += dt;
        this.s.squish = Math.max(0, 1 - this.landT * 1.5) * 0.9;
        if (this.landT > 0.7) this.alpha = Math.max(0, 1 - (this.landT - 0.7) * 3);
        if (this.landT > 1.05) {
          this.dead = true;
          b.removeFree(this);
        }
      }
    }
    // ---------------- 大喷菇 ----------------
    u_fume(dt) {
      const b = this.board;
      this.cool -= dt;
      if (this.shootT >= 0) {
        const prev = this.shootT;
        this.shootT += dt;
        if (prev < 0.2 && this.shootT >= 0.2) {
          const x1 = Math.min(VISIBLE_RIGHT, this.x + this.def.range * COL_W + 20);
          for (const z of b.zombies) if (z.isEnemy && z.alive && z.hittable && z.row === this.row && z.x > this.x - 10 && z.x - 25 < x1) z.takeDamage(20, "fume");
          b.fumeCloud(this.x + 30, this.y - 18, x1);
          audio.play("fume");
        }
        if (this.shootT >= 0.5) this.shootT = -1;
      }
      this.s.shoot = this.shootT >= 0 ? this.shootT / 0.5 : 0;
      if (this.cool <= 0 && this.shootT < 0) {
        const x1 = Math.min(VISIBLE_RIGHT, this.x + this.def.range * COL_W + 20);
        if (b.enemyInRow(this.row, this.x - 10, x1)) {
          this.shootT = 1e-4;
          this.cool = 1.45;
        } else this.cool = 0.1;
      }
    }
    // ---------------- 墓碑吞噬者 ----------------
    u_grave(dt) {
      const b = this.board;
      this.progress += dt / 4.2;
      this.s.progress = clamp(this.progress, 0, 1);
      const g = b.graveAt(this.col, this.row);
      if (g) g.sink = this.s.progress;
      if (Math.random() < dt * 6) b.fx.dirt(this.x + rand(-20, 20), this.y - 10, 1, 10, ["#8a8a96", "#6a6a78", "#5a4a3a"]);
      if (this.progress >= 1) {
        if (g) b.removeGrave(g);
        audio.play("pickup");
        b.fx.dirt(this.x, this.y, 16, 30, ["#8a8a96", "#6a6a78", "#5a4a3a"]);
        this.dead = true;
        b.removePlant(this);
      }
    }
    // ---------------- 地刺 ----------------
    u_spike(dt) {
      const b = this.board;
      this.tick -= dt;
      this.s.attack = Math.max(0, (this.s.attack || 0) - dt * 4);
      if (this.tick <= 0) {
        this.tick = 1;
        let hit = false;
        for (const z of b.zombies) {
          if (!z.isEnemy || !z.alive || z.row !== this.row || !z.onGround) continue;
          const w = z.type === "zomboni" ? 70 : 30;
          if (Math.abs(z.x - this.x) < 30 + w) {
            if (z.type === "zomboni") {
              z.popTire();
              this.die(null, "crushed");
              return;
            }
            z.takeDamage(20, "spike");
            hit = true;
          }
        }
        if (hit) {
          this.s.attack = 1;
          audio.play("spike");
        }
      }
    }
    // ---------------- 缠绕海草 ----------------
    u_kelp(dt) {
      const b = this.board;
      if (this.state === "idle") {
        const z = b.zombies.find((z2) => z2.isEnemy && z2.alive && z2.row === this.row && z2.inWater && !z2.airborne && Math.abs(z2.x - 20 - this.x) < 45);
        if (z) {
          this.state = "grab";
          this.grabT = 0;
          this.target = z;
          z.grabbed();
          audio.play("kelp");
          b.clearCellSlot(this);
        }
      } else {
        this.grabT += dt;
        this.s.grab = clamp(this.grabT * 2, 0, 1);
        if (this.target) this.target.dragDepth = clamp(this.grabT / 1.1, 0, 1);
        if (this.grabT > 1.2) {
          this.target?.remove();
          b.fx.add({ type: "ring", x: this.x, y: this.y, size: 10, grow: 5, color: "rgba(220,250,255,0.8)", width: 4, life: 0.8 });
          this.dead = true;
          b.removeFree(this);
        }
      }
    }
    // ---------------- 磁力菇 ----------------
    u_magnet(dt) {
      const b = this.board;
      if (this.cooldown > 0) {
        this.cooldown -= dt;
        this.s.cooldown = this.cooldown > 0 ? 1 : 0;
        return;
      }
      let best = null, bd = 1e9;
      for (const z of b.zombies) {
        if (!z.isEnemy || !z.alive || z.x > VISIBLE_RIGHT) continue;
        if (Math.abs(z.row - this.row) > 2) continue;
        const d = Math.hypot(z.x - this.x, (z.row - this.row) * 100);
        if (d > 300) continue;
        if (!z.hasMetal()) continue;
        if (d < bd) {
          bd = d;
          best = z;
        }
      }
      if (best) {
        const item = best.stripMetal();
        if (item) {
          this.cooldown = 15;
          this.s.cooldown = 1;
          this.held = item;
          audio.play("magnet");
          b.flyingItem(item, best.x, best.y - 120, this);
        }
      }
    }
    // ---------------- 咖啡豆 ----------------
    u_coffee(dt) {
      this.wakeT += dt;
      if (this.wakeT >= 1) {
        const host = this.board.cellOf(this.col, this.row).main;
        if (host) {
          host.sleep = false;
          audio.play("wakeup");
          this.board.fx.sparks(host.x, host.y - 40, 12, "#fff2a0");
        }
        this.dead = true;
        this.board.removePlant(this);
      }
    }
    // ---------------- 绘制 ----------------
    draw(ctx, part) {
      const art = PLANT_ART[this.type];
      if (!art) return;
      if (this.kind === "pumpkin") this.s.part = part || "front";
      const sc = this.pop < 1 ? Ease.outBack(this.pop) : 1;
      const tints = [];
      if (this.flash > 0) tints.push({ color: "#fff", alpha: 0.35 });
      if (this.sleep) tints.push({ color: "#203050", alpha: 0.28 });
      const y = this.y;
      ctx.save();
      const shake = this.flash > 0 ? Math.sin(this.t * 90) * 1.6 : 0;
      ctx.translate(this.x + shake, y);
      ctx.scale(sc, sc);
      if (this.alpha < 1) ctx.globalAlpha *= this.alpha;
      if (this.kind === "coffee") ctx.translate(0, -70);
      if (tints.length) {
        drawTinted(ctx, 0, 0, 180, 220, this.board.drawScale, (c) => art(c, this.s), tints);
      } else {
        art(ctx, this.s);
      }
      if (this.kind === "magnet" && this.cooldown > 0 && this.held) {
        const k = this.cooldown / 15;
        ctx.save();
        ctx.translate(0, -72);
        ctx.scale(0.3 + k * 0.4, 0.3 + k * 0.4);
        ctx.globalAlpha *= Math.min(1, k * 3);
        drawMetalItem(ctx, this.held);
        ctx.restore();
      }
      ctx.restore();
      if (this.board.showHealth && this.hp < this.maxHp && this.kind !== "instant") {
        const w = 40, k = this.hp / this.maxHp;
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(this.x - w / 2, y + 4, w, 5);
        ctx.fillStyle = k > 0.5 ? "#6ad83a" : k > 0.25 ? "#f0c030" : "#e04020";
        ctx.fillRect(this.x - w / 2 + 1, y + 5, (w - 2) * k, 3);
      }
    }
  };
  function drawMetalItem(ctx, item) {
    if (item === "pogo" || item === "pickaxe" || item === "jackbox") {
      ctx.save();
      ctx.lineCap = "round";
      if (item === "pogo") {
        ctx.lineWidth = 6;
        ctx.strokeStyle = "#2a2e32";
        ctx.beginPath();
        ctx.moveTo(0, -40);
        ctx.lineTo(0, 30);
        ctx.moveTo(-14, -40);
        ctx.lineTo(12, -40);
        ctx.stroke();
        ctx.lineWidth = 4;
        ctx.strokeStyle = "#d8dce0";
        ctx.beginPath();
        ctx.moveTo(0, -40);
        ctx.lineTo(0, 30);
        ctx.stroke();
      } else if (item === "pickaxe") {
        ctx.lineWidth = 6;
        ctx.strokeStyle = "#6a4418";
        ctx.beginPath();
        ctx.moveTo(0, 30);
        ctx.lineTo(0, -30);
        ctx.stroke();
        ctx.lineWidth = 7;
        ctx.strokeStyle = "#8a9096";
        ctx.beginPath();
        ctx.moveTo(-24, -26);
        ctx.quadraticCurveTo(0, -40, 24, -26);
        ctx.stroke();
      } else {
        ctx.fillStyle = "#7a3ad8";
        ctx.strokeStyle = "#2a0a4a";
        ctx.lineWidth = 2.5;
        ctx.fillRect(-18, -18, 36, 34);
        ctx.strokeRect(-18, -18, 36, 34);
        ctx.fillStyle = "#ffd23a";
        ctx.beginPath();
        ctx.arc(0, 0, 7, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      return;
    }
    if (item === "door") {
      ctx.save();
      ctx.scale(0.7, 0.7);
      ctx.fillStyle = "rgba(160,170,175,0.5)";
      ctx.fillRect(-20, -50, 40, 100);
      ctx.lineWidth = 5;
      ctx.strokeStyle = "#4a5054";
      ctx.strokeRect(-20, -50, 40, 100);
      ctx.restore();
    } else {
      drawArmorHat(ctx, item, 0, 1, 0);
    }
  }

  // src/game/zombie.js
  var VISIBLE_RIGHT2 = 1262;
  var colX0 = () => LAWN_X + 50;
  var SWIMMERS = ["normal", "cone", "bucket", "flag"];
  var Zombie = class {
    constructor(board, type, row, x, o = {}) {
      this.board = board;
      this.type = type;
      this.def = ZOMBIES[type];
      this.row = row;
      this.x = x;
      this.hp = this.maxHp = Math.round(this.def.hp * (o.hpMul || 1));
      this.armor = this.def.armor ? { ...this.def.armor, max: this.def.armor.hp } : null;
      this.shield = this.def.shield ? { ...this.def.shield, max: this.def.shield.hp } : null;
      this.baseSpeed = this.def.speed * rand(0.9, 1.1) * (o.speedMul || 1);
      this.speed = this.baseSpeed;
      this.t = rand(0, 10);
      this.walkPh = rand(0, TAU);
      this.eatPh = 0;
      this.seed = rand(0, 10);
      this.state = o.state || "walk";
      this.anim = "walk";
      this.slowT = 0;
      this.freezeT = 0;
      this.flash = 0;
      this.hasArm = true;
      this.hasHead = true;
      this.hypno = false;
      this.dir = -1;
      this.held = LOOKS[type]?.held || null;
      this.jumped = false;
      this.alpha = 1;
      this.dead = false;
      this.removed = false;
      this.yOff = 0;
      this.scale = this.def.scale || 1;
      this.waveId = o.waveId ?? -1;
      this.preview = !!o.preview;
      this.inWater = false;
      this.ducky = board.isWater(row) && SWIMMERS.includes(type);
      if (this.ducky && type === "normal") this.lookType = "ducky";
      this.riseT = o.state === "rise" ? 0 : 1;
      this.riseDur = o.riseDur || 1.2;
      if (type === "pole") this.anim = "run";
      if (type === "dolphin") {
        this.riding = true;
      }
      if (type === "gargantuar") {
        this.hasImp = true;
        this.smashT = 0;
      }
      if (type === "zomboni") {
        this.vehicleStage = 0;
      }
      if (type === "dancer") {
        this.summonT = 0;
        this.summoned = false;
        this.backups = [];
      }
      if (type === "imp" && o.thrown) {
        this.state = "flying";
        this.fly = o.thrown;
      }
      if (type === "balloon") {
        this.balloonUp = true;
        this.floatH = 70;
      }
      if (type === "digger") {
        this.underground = o.state !== "rise";
        this.metalItem = "pickaxe";
      }
      if (type === "pogo") {
        this.pogo = true;
        this.bouncePh = rand(0, TAU);
        this.metalItem = "pogo";
      }
      if (type === "jackbox") {
        this.jackT = rand(5, 15);
        this.metalItem = "jackbox";
        this.musicT = 0;
      }
      this.floatH = this.floatH || 0;
      this.laneOff = 0;
      if (o.leader) this.leader = o.leader;
      if (o.y !== void 0) this.yOverride = o.y;
      this.groanT = rand(3, 14);
    }
    // ---------- 状态查询 ----------
    get alive() {
      return !this.dead && !["dying", "fall", "charred", "dragged", "shred", "eaten", "vehicleDie", "blown"].includes(this.state);
    }
    get isEnemy() {
      return !this.hypno && !this.preview;
    }
    get airborne() {
      return this.state === "jump" || this.state === "flying" || this.balloonUp || this.state === "drop" || this.state === "blown";
    }
    get onGround() {
      return !this.airborne && this.state !== "rise";
    }
    get submerged() {
      return this.type === "snorkel" && this.inWater && this.state === "walk";
    }
    get hittable() {
      if (!this.alive) return false;
      if (this.submerged) return false;
      if (this.state === "rise" && this.riseT < 0.5) return false;
      if (this.state === "flying" || this.balloonUp || this.underground || this.state === "drop") return false;
      return this.x < VISIBLE_RIGHT2 + 10;
    }
    get front() {
      return this.x + this.dir * (this.type === "zomboni" ? 70 : this.type === "gargantuar" ? 40 : 22);
    }
    get y() {
      return this.yOverride ?? this.board.rowY(this.row);
    }
    get halfWidth() {
      return this.type === "zomboni" ? 70 : this.type === "gargantuar" ? 40 : 24;
    }
    get armorKind() {
      return this.armor ? this.armor.kind : null;
    }
    get armorStage() {
      return this.armor ? this.armor.hp < this.armor.max / 3 ? 2 : this.armor.hp < this.armor.max * 2 / 3 ? 1 : 0 : 0;
    }
    get shieldStage() {
      return this.shield ? this.shield.hp < this.shield.max / 3 ? 2 : this.shield.hp < this.shield.max * 2 / 3 ? 1 : 0 : 0;
    }
    get angry() {
      return this.angryMode;
    }
    get totalHp() {
      return Math.max(0, this.hp) + (this.armor ? this.armor.hp : 0) + (this.shield ? this.shield.hp : 0);
    }
    hasMetal() {
      return this.armor && this.armor.metal || this.shield && this.shield.metal || !!this.metalItem;
    }
    stripMetal() {
      if (this.shield && this.shield.metal) {
        const k = this.shield.kind;
        this.shield = null;
        this.held = null;
        return k;
      }
      if (this.armor && this.armor.metal) {
        const k = this.armor.kind;
        this.armor = null;
        return k;
      }
      if (this.metalItem) {
        const k = this.metalItem;
        this.metalItem = null;
        this.held = null;
        if (k === "pogo") {
          this.pogo = false;
          this.speed = this.def.walkSpeed;
          this.yOff = 0;
          if (this.state === "jump") this.state = "walk";
        }
        if (k === "pickaxe" && this.underground) {
          this.underground = false;
          this.state = "rise";
          this.riseT = 0;
          this.riseDur = 0.8;
          this.speed = this.def.walkSpeed;
          this.board.fx.dirt(this.x, this.y, 12, 25);
        }
        return k;
      }
      return null;
    }
    popBalloon() {
      if (!this.balloonUp) return;
      this.balloonUp = false;
      this.state = "drop";
      this.dropT = 0;
      audio.play("pop");
    }
    blowAway() {
      if (!this.alive) return;
      this.board.onZombieKilled(this);
      this.state = "blown";
      this.blownT = 0;
    }
    // 大蒜：换到相邻的行
    divert() {
      const b = this.board;
      const opts = [this.row - 1, this.row + 1].filter((r) => b.activeRow(r) && b.isWater(r) === b.isWater(this.row));
      if (!opts.length) return false;
      const oldY = this.y;
      this.row = choose(opts);
      this.laneOff0 = oldY - this.y;
      this.laneOff = this.laneOff0;
      this.laneT = 0;
      this.state = "walk";
      this.eatTarget = null;
      audio.play("groan");
      return true;
    }
    // ---------- 受伤 ----------
    takeDamage(amount, kind = "pea", o = {}) {
      if (!this.alive || this.underground) return "none";
      const b = this.board;
      const isArea = kind === "explode" || kind === "squash" || kind === "fire-row" || kind === "doom";
      if (this.balloonUp && !isArea) {
        this.popBalloon();
        return "none";
      }
      this.flash = 0.1;
      let part = "body";
      const projectile = kind === "pea" || kind === "snow" || kind === "fire" || kind === "puff";
      const area = kind === "explode" || kind === "squash" || kind === "fire-row" || kind === "doom";
      if (this.type === "zomboni") {
        this.hp -= amount;
        this.vehicleStage = this.hp < this.maxHp / 3 ? 2 : this.hp < this.maxHp * 2 / 3 ? 1 : 0;
        if (this.hp <= 0) this.vehicleDestroyed(area);
        return "metal";
      }
      let dmg = amount;
      if (this.shield && (projectile || area || kind === "bowl" || kind === "whack")) {
        const absorb = area ? Math.min(dmg, this.shield.hp) : dmg;
        this.shield.hp -= absorb;
        part = this.shield.kind === "door" ? "shield" : "paper";
        if (this.shield.hp <= 0) this.loseShield();
        if (!area) {
          if (kind === "snow" && part === "paper") this.slow(10);
          return part;
        }
        dmg -= absorb;
      }
      if (this.armor && dmg > 0) {
        const absorb = Math.min(dmg, this.armor.hp);
        this.armor.hp -= absorb;
        part = this.armor.kind === "cone" ? "cone" : "metal";
        dmg = area ? dmg - absorb : 0;
        if (this.armor.hp <= 0) {
          if (area && dmg >= this.hp) this.armor.hp = 1e-3;
          else this.loseArmor();
        }
      }
      if (dmg > 0) {
        this.hp -= dmg;
        if (this.hasArm && this.hp < this.maxHp * 0.5 && this.hp > 0) this.dropArm();
        if (this.hp <= 0) {
          if (area || kind === "fire-row") this.die("char");
          else this.die("normal");
        }
      }
      if (kind === "snow") this.slow(10);
      if (kind === "fire" || kind === "fire-row") this.slowT = 0;
      return part;
    }
    slow(t) {
      if (this.type === "zomboni") return;
      this.slowT = Math.max(this.slowT, t);
    }
    freeze(t) {
      if (!this.alive) return;
      this.freezeT = Math.max(this.freezeT, t);
      this.slowT = Math.max(this.slowT, t + 10);
    }
    loseShield() {
      const b = this.board;
      const kind = this.shield.kind;
      this.shield = null;
      this.held = null;
      if (kind === "paper") {
        audio.play("newspaper");
        this.state = "angryStart";
        this.angryT = 0;
        for (let i = 0; i < 8; i++) {
          b.fx.add({ type: "rect", x: this.x - 26, y: this.y - 80, vx: rand(-80, 80), vy: rand(-200, -60), g: 400, size: rand(6, 12), aspect: 1.2, color: "#eeeae0", stroke: "#888", rot: rand(TAU), vr: rand(-6, 6), life: 1.2, ground: this.y, bounces: 0 });
        }
      } else {
        audio.play("shieldhit");
        b.fx.debris(this.x - 30, this.y - 70, (ctx) => {
          ctx.fillStyle = "rgba(160,170,175,0.5)";
          ctx.fillRect(-20, -50, 40, 100);
          ctx.lineWidth = 5;
          ctx.strokeStyle = "#3a4044";
          ctx.strokeRect(-20, -50, 40, 100);
        }, { vx: rand(-60, -20), vy: -120, vr: -2, ground: this.y - 20, life: 1.6 });
      }
    }
    loseArmor() {
      const b = this.board;
      const kind = this.armor.kind;
      this.armor = null;
      b.fx.debris(this.x - 6, this.y - 140 * this.scale, (ctx) => drawArmorHat(ctx, kind, 2, 1, 0), { vx: rand(30, 90), vy: rand(-240, -160), ground: this.y - 10, life: 1.8 });
      if (kind !== "cone") audio.play("metal");
    }
    dropArm() {
      if (this.type === "zomboni" || this.type === "gargantuar") return;
      this.hasArm = false;
      const b = this.board;
      b.fx.debris(this.x - 12, this.y - 90 * this.scale, (ctx) => drawSeveredArm(ctx, this), { vx: rand(-40, 20), vy: rand(-120, -60), ground: this.y - 4, life: 1.8 });
      if (this.held === "flag") this.held = null;
    }
    die(kind = "normal") {
      if (!this.alive) return;
      const b = this.board;
      this.slowT = 0;
      this.freezeT = 0;
      this.yOff = 0;
      this.floatH = 0;
      this.balloonUp = false;
      b.onZombieKilled(this, this.hypno);
      if (kind === "char") {
        this.state = "charred";
        this.charT = 0;
        return;
      }
      this.state = "dying";
      this.dyingT = 0;
      if (this.type !== "zomboni" && this.type !== "gargantuar") {
        this.hasHead = false;
        const self = this;
        const armorKind = this.armor?.kind;
        b.fx.debris(this.x - 8, this.y - 125 * this.scale, (ctx) => {
          drawSeveredHead(ctx, { ...self, t: 0, lookType: self.lookType, hypno: self.hypno });
          if (armorKind) drawArmorHat(ctx, armorKind, 2, 1, 0);
        }, { vx: this.hypno ? rand(-80, -20) : rand(20, 90), vy: rand(-220, -140), vr: rand(-4, 4), ground: this.y - 12, life: 1.8, onBounce: () => audio.play("headfall") });
        this.armor = null;
      }
      if (this.held === "flag" || this.held === "pole") this.held = null;
    }
    eatenByChomper() {
      this.board.onZombieKilled(this);
      this.state = "eaten";
      this.remove();
    }
    grabbed() {
      this.board.onZombieKilled(this);
      this.state = "dragged";
      this.dragDepth = 0;
    }
    shred() {
      if (this.state === "shred") return;
      if (this.alive) this.board.onZombieKilled(this, this.hypno);
      if (this.type === "zomboni") this.board.zomboniDied(this.row);
      this.state = "shred";
      this.shredT = 0;
      audio.play("shred");
    }
    popTire() {
      audio.play("tire");
      this.vehicleDestroyed(false);
    }
    vehicleDestroyed(charred) {
      if (!this.alive) return;
      const b = this.board;
      b.onZombieKilled(this);
      this.state = "vehicleDie";
      this.dieT = 0;
      audio.play("vehicle");
      b.fx.explosion(this.x, this.y - 40, 0.8);
      b.shake(6);
      b.zomboniDied(this.row);
    }
    hypnotize() {
      if (!this.alive || this.type === "gargantuar" || this.type === "zomboni") return;
      this.hypno = true;
      this.dir = 1;
      this.state = "walk";
      this.eatTarget = null;
      this.slowT = 0;
      audio.play("hypno");
      this.board.onZombieKilled(this, true);
      this.board.fx.sparks(this.x, this.y - 100, 14, "#ff8af0");
    }
    remove() {
      this.dead = true;
    }
    // ---------- 更新 ----------
    update(dt) {
      const b = this.board;
      this.t += dt;
      if (this.flash > 0) this.flash -= dt;
      if (this.slowT > 0) this.slowT -= dt;
      if (this.preview) {
        this.anim = "idle";
        return;
      }
      switch (this.state) {
        case "dying":
          return this.u_dying(dt);
        case "charred":
          return this.u_charred(dt);
        case "dragged":
          this.inWater = true;
          return;
        case "shred":
          this.shredT += dt;
          if (this.shredT > 0.35) this.remove();
          return;
        case "vehicleDie":
          this.dieT += dt;
          this.alpha = 1 - this.dieT / 0.6;
          if (this.dieT > 0.6) this.remove();
          return;
        case "eaten":
          return;
        case "blown":
          this.blownT += dt;
          this.x += 650 * dt;
          this.floatH += 160 * dt;
          this.t += dt * 3;
          if (this.blownT > 1.4) this.remove();
          return;
      }
      if (this.laneOff) {
        this.laneT += dt;
        const k = Math.min(1, this.laneT / 0.9);
        this.laneOff = this.laneOff0 * (1 - -(Math.cos(Math.PI * k) - 1) / 2);
        if (k >= 1) this.laneOff = 0;
      }
      if (this.freezeT > 0) {
        this.freezeT -= dt;
        return;
      }
      const slowMul = this.slowT > 0 ? 0.5 : 1;
      const adt = dt * slowMul;
      this.groanT -= dt;
      if (this.groanT <= 0) {
        this.groanT = rand(8, 22);
        if (this.x < VISIBLE_RIGHT2 && !this.hypno && b.zombies.length < 30) audio.play("groan");
      }
      if (b.isWater(this.row) && !this.airborne && !this.underground) {
        const wasIn = this.inWater;
        this.inWater = this.x < POOL_X1 - 6 && this.x > LAWN_X - 60;
        if (this.inWater && !wasIn && this.state !== "rise") {
          audio.play("splash");
          b.splash(this.x, this.y);
        }
      }
      switch (this.state) {
        case "rise":
          return this.u_rise(dt);
        case "flying":
          return this.u_flying(dt);
        case "jump":
          return this.u_jump(adt);
        case "angryStart":
          this.anim = "angry";
          this.angryT += dt;
          if (this.angryT > 1.2) {
            this.state = "walk";
            this.angryMode = true;
            this.speed = this.def.angrySpeed;
          }
          return;
        case "smash":
          return this.u_smash(adt);
        case "throw":
          return this.u_throw(adt);
        case "summon":
          return this.u_summon(dt);
        case "drop":
          return this.u_drop(dt);
        case "popping":
          return this.u_popping(dt);
        case "eat":
          return this.u_eat(adt);
        default:
          return this.u_walk(adt, slowMul);
      }
    }
    u_rise(dt) {
      this.riseT += dt / this.riseDur;
      this.anim = "idle";
      if (Math.random() < dt * 10) this.board.fx.dirt(this.x, this.y, 1, 20);
      if (this.riseT >= 1) {
        this.riseT = 1;
        this.state = "walk";
      }
    }
    u_flying(dt) {
      const f = this.fly;
      f.t += dt / f.dur;
      const k = clamp(f.t, 0, 1);
      this.x = lerp(f.x0, f.x1, k);
      this.yOff = -Math.sin(k * Math.PI) * f.h - (1 - k) * f.y0;
      this.anim = "jump";
      this.jumpT = k;
      if (f.t >= 1) {
        this.yOff = 0;
        this.state = "walk";
        this.anim = "walk";
        this.board.fx.dirt(this.x, this.y, 8, 20);
        audio.play("thud");
      }
    }
    u_drop(dt) {
      this.dropT += dt;
      const k = Math.min(1, this.dropT / 0.45);
      this.floatH = 70 * (1 - k * k);
      this.popT = Math.min(1, this.dropT * 5);
      this.anim = "float";
      if (k >= 1) {
        this.floatH = 0;
        this.held = null;
        this.state = "walk";
        this.speed = 19 * rand(0.9, 1.1);
        audio.play("thud");
        this.board.fx.dirt(this.x, this.y, 8, 20);
      }
    }
    u_popping(dt) {
      this.anim = "idle";
      this.popT2 = (this.popT2 || 0) + dt / 0.9;
      this.jackPop = Math.min(1, this.popT2);
      if (this.popT2 >= 1) {
        const b = this.board;
        b.explodePlants(this.x - 10, this.row);
        audio.play("explode");
        b.shake(10);
        b.fx.explosion(this.x - 10, this.y - 60, 1.1, { text: "\u7830\uFF01", textColor: "#ff8af0" });
        this.metalItem = null;
        this.held = null;
        this.die("char");
      }
    }
    u_walk(adt, slowMul) {
      const b = this.board;
      if (this.balloonUp) {
        this.anim = "float";
        this.x += this.dir * this.speed * adt;
        this.walkPh += adt * 2;
        if (this.dir < 0 && !this.hypno) {
          if (this.x < LAWN_X - 20 && b.mowers.some((m) => m.row === this.row && (m.state === "idle" || m.state === "arrive"))) {
            this.popBalloon();
            this.state = "walk";
            this.floatH = 0;
            this.held = null;
            b.triggerMower(this.row, this);
          } else if (this.x < LAWN_X - 130) b.zombieReachedHouse(this);
        }
        return;
      }
      if (this.underground) {
        this.x -= this.speed * adt;
        if (Math.random() < adt * 8) b.fx.dirt(this.x + 10, this.y, 1, 16);
        if (Math.random() < adt * 0.8) audio.play("dirt");
        if (this.x <= colX0() - 10) {
          this.underground = false;
          this.dir = 1;
          this.speed = this.def.walkSpeed;
          this.state = "rise";
          this.riseT = 0;
          this.riseDur = 0.9;
          b.fx.dirt(this.x, this.y, 16, 30);
          audio.play("grave");
        }
        return;
      }
      if (this.pogo) {
        this.anim = "pogo";
        this.bouncePh += adt * 7;
        const sn = Math.abs(Math.sin(this.bouncePh));
        this.yOff = -sn * 42;
        this.pogoSquash = Math.max(0, 1 - sn * 5);
        this.x += this.dir * this.speed * adt;
        if (!this.hypno) {
          const p = b.plantAhead(this, 30);
          if (p) {
            if (p.def.tall) {
              this.stripMetal();
              this.bonk();
            } else {
              this.state = "jump";
              this.jumpT = 0;
              this.jumpFrom = this.x;
              this.jumpTo = p.x - 60;
              audio.play("pole");
              return;
            }
          }
          if (this.x < LAWN_X - 10) b.triggerMower(this.row, this);
          if (this.x < LAWN_X - 130) b.zombieReachedHouse(this);
        }
        return;
      }
      if (this.metalItem === "jackbox" && !this.hypno && this.x < VISIBLE_RIGHT2 - 40) {
        this.jackT -= adt;
        this.musicT -= adt;
        if (this.musicT <= 0) {
          this.musicT = 1.6;
          audio.play("jackmusic");
        }
        if (this.jackT <= 0) {
          this.state = "popping";
          this.popT2 = 0;
          return;
        }
      }
      this.anim = this.type === "pole" && !this.jumped ? "run" : this.inWater && this.type !== "snorkel" && !this.ducky ? "swim" : "walk";
      if (this.type === "dolphin" && this.riding) this.anim = "idle";
      if (this.leader || this.type === "dancer") this.danceStep();
      if (!this.jumped && !this.hypno && (this.type === "pole" || this.type === "dolphin" && this.riding && this.inWater)) {
        const p = b.plantAhead(this, 70);
        if (p) {
          if (p.def.tall) {
            this.jumped = true;
            this.bonk();
          } else {
            this.state = "jump";
            this.jumpT = 0;
            this.jumpFrom = this.x;
            this.jumpTo = p.x - 70;
            audio.play(this.type === "pole" ? "pole" : "splash");
            return;
          }
        }
      }
      if (this.type === "dancer" && !this.hypno) {
        this.summonT += adt;
        const need = !this.summoned ? this.x < 1030 : this.backups.filter((z) => z.alive && !z.hypno).length < 4 && this.summonT > 12;
        if (need && this.x < VISIBLE_RIGHT2 - 20) {
          this.state = "summon";
          this.summonAnimT = 0;
          return;
        }
      }
      if (this.type === "gargantuar" && this.hasImp && this.hp < this.maxHp / 2 && this.x > LAWN_X + 380 && !this.hypno) {
        this.state = "throw";
        this.throwT = 0;
        return;
      }
      if (this.type === "zomboni") {
        b.leaveIce(this.row, this.x + 40);
        const p = b.plantUnder(this.row, this.x - 55, 40, true);
        if (p && !(p.kind === "mine" && p.armed) && !p.fusing) {
          if (p.kind === "spike") {
            p.die(null, "crushed");
            this.popTire();
            return;
          }
          p.crush();
          audio.play("thud");
        }
      } else {
        let target = this.findEatTarget();
        if (!target && this.type === "gargantuar" && !this.hypno) {
          const sp = b.plantUnder(this.row, this.front - 10, 34);
          if (sp && sp.kind === "spike") target = sp;
        }
        if (target) {
          if (this.type === "gargantuar" && target.isPlant) {
            this.state = "smash";
            this.smashT = 0;
            this.smashTarget = target;
            this.smashed = false;
            return;
          }
          this.state = "eat";
          this.eatTarget = target;
          return;
        }
      }
      let spd = this.speed;
      if (this.type === "dancer" || this.leader) spd = this.dancePause ? 0 : spd;
      this.x += this.dir * spd * adt;
      const animRate = this.type === "zomboni" ? 1 : spd / 19;
      this.walkPh += adt * 4.4 * Math.max(0.6, animRate);
      if (spd === 0) this.anim = "dance";
      if (!this.hypno && this.dir < 0) {
        if (this.x < LAWN_X - 10) b.triggerMower(this.row, this);
        if (this.x < LAWN_X - 130) b.zombieReachedHouse(this);
      } else if (this.x > 1350) {
        this.remove();
      }
    }
    danceStep() {
      const b = this.board;
      const lead = this.leader || this;
      if (!lead.summoned) {
        this.dancePause = false;
        return;
      }
      const ph = (b.time + (lead.seed || 0)) % 3.4;
      this.dancePause = ph > 2.2;
      this.anim = this.dancePause ? "dance" : "walk";
    }
    bonk() {
      const b = this.board;
      audio.play("thud");
      b.fx.sparks(this.x - 30, this.y - 90, 8, "#fff");
      if (this.type === "pole") {
        this.held = null;
        this.speed = this.def.walkSpeed;
        b.fx.debris(this.x - 20, this.y - 70, (ctx) => {
          ctx.lineCap = "round";
          ctx.lineWidth = 6;
          ctx.strokeStyle = "#4a3010";
          ctx.beginPath();
          ctx.moveTo(-50, 0);
          ctx.lineTo(50, 0);
          ctx.stroke();
          ctx.lineWidth = 3.5;
          ctx.strokeStyle = "#d8b070";
          ctx.stroke();
        }, { vx: 40, vy: -100, vr: 3, ground: this.y - 6, life: 1.5 });
      } else {
        this.riding = false;
        this.speed = this.def.walkSpeed;
      }
    }
    u_jump(adt) {
      this.jumpT += adt / 0.95;
      const k = clamp(this.jumpT, 0, 1);
      this.x = lerp(this.jumpFrom, this.jumpTo, Ease.inOutSine(k));
      this.yOff = -Math.sin(k * Math.PI) * (this.type === "pole" ? 95 : this.pogo ? 115 : 70);
      if (this.pogo) this.anim = "pogo";
      this.anim = "jump";
      if (this.jumpT >= 1 && this.pogo) {
        this.yOff = 0;
        this.state = "walk";
        return;
      }
      if (this.jumpT >= 1) {
        this.yOff = 0;
        this.jumped = true;
        this.state = "walk";
        this.speed = this.def.walkSpeed;
        if (this.type === "pole") {
          this.held = null;
          this.board.fx.debris(this.x + 40, this.y - 60, (ctx) => {
            ctx.lineCap = "round";
            ctx.lineWidth = 6;
            ctx.strokeStyle = "#4a3010";
            ctx.beginPath();
            ctx.moveTo(-50, 0);
            ctx.lineTo(50, 0);
            ctx.stroke();
            ctx.lineWidth = 3.5;
            ctx.strokeStyle = "#d8b070";
            ctx.stroke();
          }, { vx: 30, vy: -80, vr: 2, ground: this.y - 6, life: 1.5 });
          audio.play("thud");
        } else {
          this.riding = false;
          audio.play("splash");
          this.board.splash(this.x, this.y);
        }
      }
    }
    findEatTarget() {
      const b = this.board;
      const f = this.front;
      for (const z of b.zombies) {
        if (z === this || !z.alive || z.row !== this.row || z.hypno === this.hypno || z.preview) continue;
        if (z.airborne || z.state === "rise") continue;
        if (this.dir < 0 ? f <= z.x + 20 && f >= z.x - 30 : f >= z.x - 20 && f <= z.x + 30) return z;
      }
      if (this.hypno) return null;
      const p = b.plantAt(this.row, f);
      return p;
    }
    u_eat(adt) {
      const b = this.board;
      const tg = this.eatTarget;
      const valid = tg && (tg.isPlant ? !tg.dead && (tg.blocking || this.type === "gargantuar") : tg.alive && tg.row === this.row);
      if (!valid) {
        this.state = "walk";
        this.eatTarget = null;
        return;
      }
      this.anim = "eat";
      this.eatPh += adt * 8.5;
      const dps = 100;
      if (tg.isPlant && tg.type === "garlic") {
        this.garlicT = (this.garlicT || 0) + adt;
        if (this.garlicT > 0.6) {
          this.garlicT = 0;
          tg.hurt(20, this);
          if (this.divert()) return;
        }
      }
      if (tg.isPlant) {
        tg.hurt(dps * adt, this);
        if (!tg.dead && Math.sin(this.eatPh * 0.5) > 0.95) audio.play("chomp");
      } else {
        tg.takeDamage(dps * adt, "bite");
        if (Math.sin(this.eatPh * 0.5) > 0.95) audio.play("chomp");
      }
      if (!this.hypno && this.x < LAWN_X - 10) b.triggerMower(this.row, this);
    }
    u_smash(adt) {
      const b = this.board;
      this.anim = "smash";
      this.smashT += adt / 1.8;
      if (!this.smashed && this.smashT >= 0.62) {
        this.smashed = true;
        const p = this.smashTarget;
        if (p && !p.dead) p.crush();
        audio.play("smash");
        b.shake(8);
        b.fx.dirt(this.x - 110, this.y, 14, 30);
      }
      if (this.smashT >= 1) {
        this.smashT = 0;
        this.state = "walk";
      }
    }
    u_throw(adt) {
      const b = this.board;
      this.throwT += adt / 1.2;
      this.anim = "idle";
      if (this.hasImp && this.throwT >= 0.5) {
        this.hasImp = false;
        audio.play("impthrow");
        const x1 = Math.max(LAWN_X + 60, this.x - rand(320, 460));
        b.spawnZombie("imp", this.row, this.x + 30, { thrown: { x0: this.x + 30, x1, y0: 150, h: 120, t: 0, dur: 1.3 } });
      }
      if (this.throwT >= 1) this.state = "walk";
    }
    u_summon(dt) {
      const b = this.board;
      this.anim = "point";
      this.summonAnimT += dt;
      if (this.summonAnimT >= 0.5 && this.summonAnimT - dt < 0.5) {
        audio.play("dance");
        const spots = [[this.row, this.x - 100], [this.row, this.x + 100], [this.row - 1, this.x], [this.row + 1, this.x]];
        this.backups = this.backups.filter((z) => z.alive);
        const alive = this.backups.filter((z) => !z.hypno);
        for (const [r, x] of spots) {
          if (!b.activeRow(r) || b.isWater(r)) continue;
          if (alive.some((z2) => z2.row === r && Math.abs(z2.x - x) < 40)) continue;
          if (alive.length >= 4) break;
          const z = b.spawnZombie("backup", r, x, { state: "rise", riseDur: 1, leader: this });
          this.backups.push(z);
          alive.push(z);
          b.fx.dirt(x, b.rowY(r), 10, 25);
        }
      }
      if (this.summonAnimT >= 1.3) {
        this.state = "walk";
        this.summoned = true;
        this.summonT = 0;
      }
    }
    u_dying(dt) {
      this.dyingT += dt;
      this.anim = "die";
      if (this.dyingT < 0.7 && this.type !== "gargantuar") {
        this.x += this.dir * this.speed * 0.4 * dt;
        this.walkPh += dt * 3;
        this.anim = "walk";
      }
      if (this.dyingT >= 0.7 && !this.fell) {
        this.fell = true;
        this.fallT = 0;
      }
      if (this.fell) {
        this.fallT += dt;
        if (this.fallT >= 0.45 && !this.thudded) {
          this.thudded = true;
          audio.play(this.type === "gargantuar" ? "smash" : "zombiefall");
          if (this.type === "gargantuar") this.board.shake(6);
        }
      }
      if (this.dyingT > 2.2) this.alpha = Math.max(0, 1 - (this.dyingT - 2.2) / 0.5);
      if (this.dyingT > 2.7) this.remove();
    }
    u_charred(dt) {
      this.charT += dt;
      if (this.charT > 0.7 && !this.crumbled) {
        this.crumbled = true;
        const b = this.board;
        for (let i = 0; i < 26; i++) {
          b.fx.add({
            type: "rect",
            x: this.x + rand(-20, 20),
            y: this.y - rand(10, 140) * this.scale,
            vx: rand(-40, 40),
            vy: rand(-60, 20),
            g: 600,
            size: rand(3, 7),
            color: i % 3 ? "#1a1612" : "#3a3430",
            rot: rand(TAU),
            vr: rand(-5, 5),
            life: rand(0.8, 1.5),
            ground: this.y + rand(-4, 4),
            bounces: 0
          });
        }
        b.fx.smoke(this.x, this.y - 60, 4, { color: "rgba(40,40,40,0.5)" });
      }
      if (this.charT > 0.7) this.alpha = Math.max(0, 1 - (this.charT - 0.7) / 0.4);
      if (this.charT > 1.1) this.remove();
    }
    // ---------- 绘制 ----------
    artState() {
      return this;
    }
    draw(ctx) {
      const b = this.board;
      const x = this.x, y = this.y + this.laneOff;
      const sc = this.scale * b.entityScale;
      const inWater = this.inWater && this.state !== "rise";
      if (!inWater && this.state !== "rise" && this.state !== "dragged") {
        const sw2 = this.type === "zomboni" ? 70 : this.type === "gargantuar" ? 50 : 30;
        if (!this.underground) shadow(ctx, x + 2, y, sw2 * sc * (this.airborne ? 0.7 : 1), 9 * sc, 0.32 * this.alpha);
      }
      const tints = [];
      if (this.state === "charred") tints.push({ color: "#0c0a08", alpha: 0.94 });
      else {
        if (this.hypno) tints.push({ color: "#d04ad8", alpha: 0.28 });
        if (this.freezeT > 0) tints.push({ color: "#7ad0ff", alpha: 0.55 });
        else if (this.slowT > 0) tints.push({ color: "#5ab8ff", alpha: 0.32 });
        if (this.flash > 0) tints.push({ color: "#ffffff", alpha: 0.3 });
      }
      const sink = inWater ? this.submerged ? 118 : this.ducky ? 40 : this.type === "dolphin" && this.riding ? 10 : 44 : 0;
      const dragged = this.state === "dragged" ? (this.dragDepth || 0) * 150 : 0;
      const rise = this.state === "rise" ? (1 - Ease.outCubic(clamp(this.riseT, 0, 1))) * 150 : 0;
      const fall = this.fell ? Ease.inQuad(clamp(this.fallT / 0.45, 0, 1)) : 0;
      const shredK = this.state === "shred" ? clamp(this.shredT / 0.35, 0, 1) : 0;
      const flip = this.dir > 0;
      const lift = this.floatH ? this.floatH + Math.sin(this.t * 2) * 4 : 0;
      const drawFn = (c) => {
        c.save();
        if (sink || dragged || rise) {
          c.beginPath();
          c.rect(-300, -600, 600, 598);
          c.clip();
          c.translate(0, sink + dragged + rise);
        }
        c.translate(0, this.yOff - lift);
        if (flip) c.scale(-1, 1);
        if (fall) {
          if (inWater) c.translate(0, fall * 70);
          else c.rotate(fall * 1.45);
        }
        if (shredK) c.scale(1 + shredK * 0.4, 1 - shredK * 0.85);
        c.scale(sc, sc);
        if (this.type === "dolphin" && this.riding && inWater) {
          c.save();
          c.translate(0, -30);
          drawZombieArt(c, this);
          c.restore();
        } else drawZombieArt(c, this);
        c.restore();
      };
      const bw = this.type === "zomboni" ? 300 : this.type === "gargantuar" ? 420 : 260;
      const bh = this.type === "gargantuar" ? 380 : this.type === "zomboni" ? 260 : 280;
      ctx.save();
      ctx.globalAlpha *= this.alpha;
      if (tints.length) drawTinted(ctx, x, y, bw * sc + 60, bh * sc + 80, b.drawScale, drawFn, tints);
      else {
        ctx.translate(x, y);
        drawFn(ctx);
      }
      ctx.restore();
      if (inWater) {
        ctx.save();
        ctx.globalAlpha *= 0.55 * this.alpha;
        E(ctx, x - 2, y - 2, 34 * sc, 8);
        ctx.strokeStyle = "#e8fbff";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      }
      if (this.freezeT > 0 && this.alive) {
        ctx.save();
        ctx.globalAlpha *= 0.45;
        ctx.fillStyle = rg(ctx, x - 10, y - 100, 5, x, y - 70, 80, [0, "rgba(230,250,255,0.9)", 1, "rgba(120,200,255,0.5)"]);
        ctx.beginPath();
        ctx.moveTo(x - 38, y + 2);
        ctx.lineTo(x - 42, y - 120);
        ctx.lineTo(x - 10, y - 150);
        ctx.lineTo(x + 34, y - 130);
        ctx.lineTo(x + 36, y + 2);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.8)";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      }
      if (b.showHealth && this.alive && !this.preview) {
        const w = 46, k = clamp(this.totalHp / this.maxTotal(), 0, 1);
        const hy = y - (this.type === "gargantuar" ? 250 : 170) * this.scale;
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(x - w / 2, hy, w, 6);
        ctx.fillStyle = k > 0.5 ? "#e04020" : "#a01010";
        ctx.fillRect(x - w / 2 + 1, hy + 1, (w - 2) * k, 4);
      }
    }
    maxTotal() {
      return this.maxHp + (this.def.armor ? this.def.armor.hp : 0) + (this.def.shield ? this.def.shield.hp : 0);
    }
  };

  // src/game/items.js
  var Projectile = class {
    constructor(board, kind, x, y, row, o = {}) {
      this.board = board;
      this.kind = kind;
      this.x = x;
      this.row = row;
      this.groundY = board.rowY(row) - 4;
      this.baseY = y;
      this.fromY = o.fromRow !== void 0 ? board.rowY(o.fromRow) - (board.rowY(row) - y) : y;
      this.y = this.fromY;
      this.bend = o.fromRow !== void 0 && o.fromRow !== row ? 0 : 1;
      this.speed = kind === "puff" ? 380 : 440;
      this.dmg = kind === "fire" ? 40 : 20;
      this.dir = o.dir || 1;
      this.maxX = o.maxX || 1300;
      this.minX = o.minX ?? 150;
      this.air = !!o.air;
      this.dead = false;
      this.t = 0;
      this.torched = false;
      this.prevX = o.originX ?? x - 44 * this.dir;
    }
    update(dt) {
      const b = this.board;
      this.t += dt;
      this.x += this.speed * this.dir * dt;
      if (this.bend < 1) {
        this.bend = Math.min(1, this.bend + dt * 4.5);
        this.y = lerp(this.fromY, this.baseY, Ease.outQuad(this.bend));
      } else this.y = this.baseY;
      if (this.kind === "pea" || this.kind === "snow") {
        const c = colOf(this.x);
        const cell = b.cellOf(c, this.row);
        const tw = cell && cell.main && cell.main.type === "torchwood" && !cell.main.dead ? cell.main : null;
        if (tw && Math.abs(this.x - tw.x) < 14 && this.lastTorch !== tw) {
          this.lastTorch = tw;
          if (this.kind === "snow") {
            this.kind = "pea";
            this.dmg = 20;
          } else {
            this.kind = "fire";
            this.dmg = 40;
          }
          audio.play("firepea");
        }
      }
      let hit = null;
      const x0 = this.bend >= 1 ? this.prevX : this.x;
      const lo = Math.min(x0, this.x), hi = Math.max(x0, this.x);
      for (const z of b.zombies) {
        if (z.row !== this.row || !z.isEnemy) continue;
        if (!z.hittable && !(this.air && z.balloonUp && z.alive)) continue;
        const hw = z.halfWidth;
        if (hi + 8 >= z.x - hw && lo - 8 <= z.x + hw + 6) {
          if (!hit || (this.dir > 0 ? z.x < hit.x : z.x > hit.x)) hit = z;
        }
      }
      this.prevX = this.x;
      if (hit) return this.hit(hit);
      if (this.x < this.minX) this.dead = true;
      if (this.x > this.maxX) {
        this.dead = true;
        if (this.kind === "puff") b.fx.add({ type: "glow", x: this.x, y: this.y, size: 10, color: "rgba(220,160,255,0.6)", life: 0.25, grow: 1 });
      }
    }
    hit(z) {
      const b = this.board;
      this.dead = true;
      if (z.balloonUp && this.air) {
        z.popBalloon();
        b.fx.sparks(this.x, this.y, 6, "#fff");
        return;
      }
      const part = z.takeDamage(this.dmg, this.kind === "spike" ? "pea" : this.kind);
      if (this.kind === "spike") {
        b.fx.sparks(Math.max(this.x, z.x - z.halfWidth), this.y, 4, "#dfffc0");
        audio.play(part === "metal" ? "metal" : "splat");
        return;
      }
      const hx = Math.max(this.x, z.x - z.halfWidth + 4);
      if (this.kind === "fire") {
        audio.play("firepea");
        b.fx.fireBurst(hx, this.y, 10, 0.8);
        for (const o of b.zombies) {
          if (o !== z && o.row === this.row && o.isEnemy && o.hittable && Math.abs(o.x - z.x) < 70) o.takeDamage(13, "fire");
        }
        return;
      }
      const color = this.kind === "snow" ? "#bfeaff" : this.kind === "puff" ? "#e0a8ff" : "#8ee04e";
      b.fx.splat(hx, this.y, color, this.kind === "puff" ? 5 : 7);
      if (this.kind === "snow") audio.play("freezehit");
      if (part === "metal") {
        audio.play("metal");
        b.fx.sparks(hx, this.y, 4, "#fff");
      } else if (part === "shield") audio.play("shieldhit");
      else if (part === "cone") audio.play("plastic");
      else if (part === "paper") audio.play("paper");
      else audio.play("splat");
    }
    draw(ctx) {
      drawProjectile(ctx, this, this.t);
    }
  };
  var StarShot = class {
    constructor(board, x, y, vx, vy) {
      this.board = board;
      this.x = x;
      this.y = y;
      this.vx = vx;
      this.vy = vy;
      this.t = 0;
      this.dead = false;
      this.row = -1;
    }
    update(dt) {
      const b = this.board;
      this.t += dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      for (const z of b.zombies) {
        if (!z.isEnemy || !z.hittable) continue;
        const zy = z.y;
        const top = zy - 150 * z.scale;
        if (this.x > z.x - z.halfWidth - 6 && this.x < z.x + z.halfWidth + 6 && this.y > top && this.y < zy + 4) {
          this.dead = true;
          const part = z.takeDamage(20, "pea");
          b.fx.sparks(this.x, this.y, 6, "#ffe45a");
          audio.play(part === "metal" ? "metal" : "splat");
          return;
        }
      }
      if (this.x < 140 || this.x > 1300 || this.y < 60 || this.y > 740) this.dead = true;
    }
    draw(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = "rgba(255,230,90,0.35)";
      ctx.beginPath();
      ctx.arc(0, 0, 15, 0, TAU);
      ctx.fill();
      ctx.restore();
      ctx.rotate(this.t * 10);
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 === 0 ? 11 : 5;
        if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fillStyle = "#ffe04a";
      ctx.strokeStyle = "#9a6a00";
      ctx.lineWidth = 1.6;
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  };
  var BowlNut = class {
    constructor(board, kind, row, x) {
      this.board = board;
      this.kind = kind;
      this.row = row;
      this.x = x;
      this.y = board.rowY(row);
      this.vy = 0;
      this.targetRow = row;
      this.roll = 0;
      this.speed = kind === "giant" ? 150 : 200;
      this.dead = false;
      this.combo = 0;
      this.hitSet = /* @__PURE__ */ new Set();
      this.t = 0;
      audio.play("bowl");
    }
    update(dt) {
      const b = this.board;
      this.t += dt;
      this.x += this.speed * dt;
      this.roll += this.speed * dt / (this.kind === "giant" ? 60 : 32);
      if (this.dirY) {
        this.y += this.dirY * 190 * dt;
        const ty = b.rowY(this.targetRow);
        if (this.dirY > 0 && this.y >= ty || this.dirY < 0 && this.y <= ty) {
          this.y = ty;
          this.row = this.targetRow;
          const next = this.targetRow + this.dirY;
          if (!b.activeRow(next)) this.dirY = -this.dirY;
          this.targetRow = this.row + this.dirY;
          if (!b.activeRow(this.targetRow)) {
            this.dirY = 0;
          }
        }
      }
      const curRow = this.dirY ? Math.round(this.nearestRow()) : this.row;
      for (const z of b.zombies) {
        if (!z.isEnemy || !z.alive || z.row !== curRow || this.hitSet.has(z)) continue;
        if (Math.abs(z.x - this.x) < (this.kind === "giant" ? 70 : 42)) {
          this.hitSet.add(z);
          this.hitZombie(z);
          if (this.dead) return;
          if (this.kind === "normal") break;
        }
      }
      if (this.x > 1320) this.dead = true;
    }
    nearestRow() {
      const b = this.board;
      let best = this.row, bd = 1e9;
      for (let r = 0; r < b.rows; r++) {
        const d = Math.abs(b.rowY(r) - this.y);
        if (d < bd) {
          bd = d;
          best = r;
        }
      }
      return best;
    }
    hitZombie(z) {
      const b = this.board;
      if (this.kind === "explode") {
        this.dead = true;
        b.explodeArea(this.x, this.y, z.row, 1, 1, "nut");
        return;
      }
      if (this.kind === "giant") {
        z.takeDamage(99999, "squash");
        audio.play("bowlhit");
        b.shake(3);
        return;
      }
      audio.play("bowlhit");
      if (z.shield || z.armor) {
        if (z.shield) z.takeDamage(z.shield.hp + 1, "bowl");
        else z.takeDamage(z.armor.hp, "bowl");
      } else z.takeDamage(z.hp + 5, "bowl");
      this.combo++;
      if (this.combo >= 2) {
        b.fx.floatText(this.x, this.y - 90, `${this.combo} \u8FDE\u51FB\uFF01`, { size: 28, color: "#ffe23a", stroke: "#6a2a00" });
        audio.play("combo", { n: this.combo });
      }
      b.fx.sparks(this.x + 20, this.y - 40, 8, "#fff");
      const up = this.row - 1, down = this.row + 1;
      let dir;
      if (!b.activeRow(up)) dir = 1;
      else if (!b.activeRow(down)) dir = -1;
      else dir = this.dirY ? -this.dirY : Math.random() < 0.5 ? -1 : 1;
      if (!b.activeRow(this.row + dir)) dir = -dir;
      if (b.activeRow(this.row + dir)) {
        this.dirY = dir;
        this.targetRow = this.row + dir;
      }
    }
    draw(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);
      bowlnut(ctx, { roll: this.roll }, this.kind);
      ctx.restore();
    }
  };
  var Sun = class {
    constructor(board, x, y, value, o = {}) {
      this.board = board;
      this.x = x;
      this.y = y;
      this.value = value;
      this.r = value >= 50 ? 30 : value >= 25 ? 23 : 17;
      this.t = rand(0, 5);
      this.state = o.fall ? "fall" : "pop";
      this.targetY = o.targetY ?? y + 40;
      this.vx = o.vx ?? rand(-50, 50);
      this.vy = o.vy ?? -220;
      this.groundY = o.groundY ?? y + rand(24, 40);
      this.life = o.fall ? 10 : 9;
      this.alpha = 1;
      this.dead = false;
      this.restT = 0;
    }
    update(dt) {
      this.t += dt;
      if (this.state === "fall") {
        this.y += 62 * dt;
        if (this.y >= this.targetY) {
          this.y = this.targetY;
          this.state = "rest";
        }
      } else if (this.state === "pop") {
        this.vy += 700 * dt;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        if (this.vy > 0 && this.y >= this.groundY) {
          this.y = this.groundY;
          this.state = "rest";
        }
      } else if (this.state === "rest") {
        this.restT += dt;
        this.life -= dt;
        if (this.life < 2) this.alpha = 0.35 + 0.65 * Math.abs(Math.sin(this.t * 8));
        if (this.life <= 0) this.dead = true;
        if (this.board.autoCollect && this.restT > 0.6) this.collect();
      } else if (this.state === "collect") {
        this.ct += dt / 0.55;
        const k = Ease.inOutQuad(clamp(this.ct, 0, 1));
        const tgt = this.board.sunTarget();
        this.x = lerp(this.cx0, tgt.x, k);
        this.y = lerp(this.cy0, tgt.y, k) - Math.sin(k * Math.PI) * 30;
        this.alpha = 1 - k * 0.3;
        this.scaleK = 1 - k * 0.35;
        if (this.ct >= 1) {
          this.dead = true;
          this.board.onSunArrived(this.value);
        }
      }
    }
    hitTest(x, y) {
      return this.state !== "collect" && Math.hypot(x - this.x, y - this.y) < this.r + 16;
    }
    collect() {
      if (this.state === "collect") return;
      this.state = "collect";
      this.ct = 0;
      this.cx0 = this.x;
      this.cy0 = this.y;
      this.alpha = 1;
      this.board.collectSun(this);
      audio.play("sun");
    }
    draw(ctx) {
      drawSun(ctx, this.x, this.y, this.r * (this.scaleK || 1), this.t, this.alpha);
    }
  };
  var Mower = class {
    constructor(board, row) {
      this.board = board;
      this.row = row;
      this.homeX = LAWN_X - 52;
      this.x = this.homeX - 160;
      this.y = board.rowY(row);
      this.state = "arrive";
      this.delay = row * 0.12;
      this.t = 0;
      this.pool = board.isWater(row);
      this.dead = false;
    }
    update(dt) {
      const b = this.board;
      this.t += dt;
      if (this.state === "arrive") {
        if (!b.moversArrive) return;
        this.delay -= dt;
        if (this.delay <= 0) this.x = Math.min(this.homeX, this.x + 520 * dt);
        if (this.x >= this.homeX) this.state = "idle";
      } else if (this.state === "run") {
        this.x += 380 * dt;
        if (Math.random() < dt * 30 && !this.pool) b.fx.add({ type: "rect", x: this.x - 20, y: this.y - 8, vx: rand(-160, -60), vy: rand(-160, -60), g: 500, size: rand(3, 6), aspect: 0.4, color: "#5aa83a", rot: rand(TAU), vr: 8, life: 0.6 });
        if (this.pool && Math.random() < dt * 20) b.splash(this.x - 20, this.y, 0.4);
        for (const z of b.zombies) {
          if (z.row === this.row && !z.dead && !z.preview && z.state !== "shred" && z.x - 30 < this.x + 34 && z.x + 30 > this.x - 34 && z.state !== "flying" && !z.balloonUp && !z.underground && z.state !== "blown" && (z.state !== "drop" || z.floatH < 40)) z.shred();
        }
        if (this.x > 1340) this.dead = true;
      }
    }
    trigger() {
      if (this.state !== "idle" && this.state !== "arrive") return false;
      this.state = "run";
      audio.play("mower");
      return true;
    }
    draw(ctx) {
      drawMower(ctx, this.x, this.y - (this.pool ? 6 : 0), this.t, this.state === "run", this.pool);
    }
  };
  var Grave = class {
    constructor(board, col, row, o = {}) {
      this.board = board;
      this.col = col;
      this.row = row;
      this.x = colX(col);
      this.y = board.rowY(row);
      this.variant = o.variant ?? Math.random() * 4 | 0;
      this.rise = o.instant ? 1 : 0;
      this.sink = 0;
      this.t = 0;
      this.dead = false;
    }
    update(dt) {
      this.t += dt;
      if (this.rise < 1) this.rise = Math.min(1, this.rise + dt * 1.5);
    }
    draw(ctx) {
      drawGrave(ctx, this.x, this.y + 2, this.variant, this.t, { sink: this.sink, rise: Ease.outBack(this.rise) });
    }
  };
  var Reward = class {
    constructor(board, x, y, reward) {
      this.board = board;
      this.reward = reward;
      this.x = x;
      this.y = y - 60;
      this.vx = rand(-60, -20);
      this.vy = -320;
      this.groundY = y - 30;
      this.state = "drop";
      this.t = 0;
      this.dead = false;
    }
    update(dt) {
      this.t += dt;
      if (this.state === "drop") {
        this.vy += 900 * dt;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        if (this.y >= this.groundY && this.vy > 0) {
          if (this.vy > 200) {
            this.vy = -this.vy * 0.35;
            this.vx *= 0.5;
          } else {
            this.y = this.groundY;
            this.state = "rest";
          }
        }
      }
    }
    hitTest(x, y) {
      return Math.abs(x - this.x) < 48 && Math.abs(y - this.y) < 60;
    }
    draw(ctx, t) {
      const glow = 0.5 + 0.5 * Math.sin(this.t * 4);
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.rotate(this.t * 0.8);
      for (let i = 0; i < 12; i++) {
        ctx.rotate(TAU / 12);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-10, -90);
        ctx.lineTo(10, -90);
        ctx.closePath();
        ctx.fillStyle = `rgba(255,240,150,${0.12 + glow * 0.08})`;
        ctx.fill();
      }
      ctx.restore();
      const bob = Math.sin(this.t * 3) * 4;
      if (this.reward.type === "plant") drawPacket(ctx, -31, -43 + bob, this.reward.id, { glow });
      else if (this.reward.type === "trophy") drawTrophy(ctx, 0, 30 + bob, 1, this.t);
      else drawNote(ctx, 0, 30 + bob, 1);
      ctx.restore();
    }
  };

  // src/gfx/fog.js
  var sprite = null;
  function puffSprite() {
    if (sprite) return sprite;
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d");
    const r = mulberry32(42);
    for (let i = 0; i < 16; i++) {
      const x = 128 + (r() - 0.5) * 120, y = 128 + (r() - 0.5) * 80, rad = 38 + r() * 46;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, "rgba(196,202,224,0.5)");
      gr.addColorStop(0.6, "rgba(180,188,214,0.25)");
      gr.addColorStop(1, "rgba(170,178,206,0)");
      g.fillStyle = gr;
      g.beginPath();
      g.arc(x, y, rad, 0, TAU);
      g.fill();
    }
    sprite = c;
    return c;
  }
  function updateFog(b, dt) {
    const fc = b.fogCols;
    if (b.fogBlowT > 0) b.fogBlowT -= dt;
    if (b.storm && b.running) {
      b.lightningT -= dt;
      if (b.lightningT <= 0) {
        b.lightningT = rand(5, 10);
        b.flashT = 1;
        audio.play("thunder", { delay: 0.2 });
      }
    }
    if (b.flashT > 0) b.flashT = Math.max(0, b.flashT - dt);
    const on = b.running || b.won || b.lost;
    const lights = b.plants.filter((p) => p.type === "plantern" && !p.dead);
    for (let r = 0; r < b.rows; r++) {
      const row = b.fogAmt[r];
      for (let c = 0; c < 12; c++) {
        let target = on && c >= 9 - fc ? 1 : 0;
        if (target && b.fogBlowT > 0) target = 0;
        if (target) {
          for (const L of lights) if (Math.abs(L.col - c) + Math.abs(L.row - r) <= 2) {
            target = 0;
            break;
          }
        }
        const a = row[c];
        const rate = target < a ? 2 : 0.35;
        row[c] = a + clamp(target - a, -rate * dt, rate * dt);
      }
    }
  }
  function drawFog(ctx, b, camX) {
    const spr = puffSprite();
    const t = b.time;
    const reveal = b.flashT > 0 ? clamp(b.flashT / 0.35, 0, 1) * 0.9 : 0;
    ctx.save();
    for (let r = 0; r < b.rows; r++) {
      const y0 = b.rowTop(r), yc = y0 + b.rowH / 2;
      for (let c = 0; c < 12; c++) {
        const a = b.fogAmt[r][c] * (1 - reveal);
        if (a < 0.02) continue;
        const x0 = LAWN_X + c * COL_W;
        ctx.globalAlpha = a * 0.62;
        ctx.fillStyle = "#9aa2bc";
        ctx.fillRect(x0 - 1, y0 - 1, COL_W + 2, b.rowH + 2);
        for (let k = 0; k < 2; k++) {
          const wob = Math.sin(t * 0.35 + r * 1.7 + c * 2.3 + k * 2) * 18;
          const wob2 = Math.cos(t * 0.27 + r * 2.1 + c * 1.3 + k) * 10;
          ctx.globalAlpha = a * 0.9;
          ctx.drawImage(spr, x0 + 50 - 115 + wob + k * 30 - 15, yc - 90 + wob2 - k * 16, 230, 180);
        }
      }
    }
    ctx.restore();
    if (b.flashT > 0.8) {
      ctx.save();
      ctx.globalAlpha = (b.flashT - 0.8) / 0.2 * 0.55;
      ctx.fillStyle = "#eef4ff";
      ctx.fillRect(camX, 0, 1280, 720);
      ctx.restore();
    }
  }

  // src/game/waves.js
  var WaveDirector = class {
    constructor(board, level) {
      this.board = board;
      this.level = level;
      this.total = level.waves || 10;
      this.endless = level.mode === "survival";
      this.flagEvery = level.flagEvery || 10;
      this.wave = 0;
      this.timer = level.firstDelay ?? (level.mode === "whack" ? 6 : 18);
      this.state = "wait";
      this.pending = [];
      this.waveZombies = [];
      this.waveHp0 = 1;
      this.sinceSpawn = 0;
      this.done = false;
      this.rowUse = /* @__PURE__ */ new Map();
      this.progressShown = 0;
      this.flagsPassed = 0;
    }
    isFlagWave(i) {
      if (this.endless) return (i + 1) % this.flagEvery === 0;
      return (i + 1) % this.flagEvery === 0 || i === this.total - 1;
    }
    get flagCount() {
      if (this.endless) return 0;
      let n = 0;
      for (let i = 0; i < this.total; i++) if (this.isFlagWave(i)) n++;
      return n;
    }
    get progress() {
      if (this.endless) return 0;
      return clamp(this.wave / this.total, 0, 1);
    }
    update(dt) {
      const b = this.board;
      for (let i2 = this.pending.length - 1; i2 >= 0; i2--) {
        const p = this.pending[i2];
        p.delay -= dt;
        if (p.delay <= 0) {
          this.pending.splice(i2, 1);
          const z = p.whack ? b.spawnZombie(p.type, p.row, p.x, { waveId: p.waveId, state: "rise", riseDur: 0.6, speedMul: 1.35 }) : b.spawnZombie(p.type, p.row, p.x, { waveId: p.waveId, hpMul: p.hpMul });
          if (p.whack) b.fx.dirt(p.x, b.rowY(p.row), 8, 20);
          this.waveZombies.push(z);
        }
      }
      if (this.done) return;
      this.sinceSpawn += dt;
      this.timer -= dt;
      if (this.wave > 0 && this.pending.length === 0 && this.state === "wait") {
        const alive = this.waveZombies.filter((z) => z.alive && z.isEnemy);
        const hp = alive.reduce((s, z) => s + z.totalHp, 0);
        if (this.sinceSpawn > 5 && hp < this.waveHp0 * 0.5) this.timer = Math.min(this.timer, 2.5);
        if (this.sinceSpawn > 3 && alive.length === 0) this.timer = Math.min(this.timer, 1);
      }
      if (this.timer > 0) return;
      const i = this.wave;
      if (this.isFlagWave(i) && this.state !== "announced") {
        this.state = "announced";
        this.timer = 6.5;
        b.message("huge");
        audio.play("hugewave");
        music.setLayer("intense", 1);
        return;
      }
      this.spawnWave(i);
      this.state = "wait";
      this.wave++;
      this.sinceSpawn = 0;
      this.timer = this.level.mode === "whack" ? rand(9, 13) : rand(24, 30);
      if (i === 0) audio.play("awooga");
      if (this.isFlagWave(i)) {
        this.flagsPassed++;
        b.intenseT = 14;
        const final = !this.endless && i === this.total - 1;
        if (final) {
          b.message("final");
          audio.play("finalwave");
          b.onFinalWave();
        } else if (this.endless) {
          b.onSurvivalFlag(this.flagsPassed);
        }
      }
      if (!this.endless && this.wave >= this.total) this.done = true;
    }
    budget(i) {
      const L = this.level;
      const diff = L.diff || 1;
      let pts = (1 + i * (L.ramp ?? 0.4)) * diff;
      if (this.endless) pts = (2 + i * 0.55 + Math.pow(i, 1.25) * 0.08) * diff;
      if (i === 0) pts = 1;
      if (this.isFlagWave(i)) pts *= 2.5;
      return Math.max(1, Math.floor(pts));
    }
    pickRow(type) {
      const b = this.board;
      const def = ZOMBIES[type];
      let rows = b.activeRows.slice();
      if (def.water) rows = rows.filter((r2) => b.isWater(r2));
      else if (def.land || !["normal", "cone", "bucket", "flag"].includes(type)) rows = rows.filter((r2) => !b.isWater(r2));
      if (!rows.length) rows = b.activeRows.slice();
      const r = weightedChoice(rows, (r2) => 1 / (1 + (this.rowUse.get(r2) || 0)));
      this.rowUse.set(r, (this.rowUse.get(r) || 0) + 1);
      for (const [k, v] of this.rowUse) this.rowUse.set(k, v * 0.8);
      return r;
    }
    composeWave(i) {
      const L = this.level;
      const b = this.board;
      let pts = this.budget(i);
      const list = [];
      const flag = this.isFlagWave(i);
      if (flag) list.push("flag");
      const pool = L.zombies.filter((t) => ZOMBIES[t] && ZOMBIES[t].weight > 0);
      const hasWater = b.activeRows.some((r) => b.isWater(r));
      const hasLand = b.activeRows.some((r) => !b.isWater(r));
      const usable = pool.filter((t) => (ZOMBIES[t].water ? hasWater : true) && (ZOMBIES[t].land ? hasLand : true));
      const introWave = this.endless ? 1 : Math.max(1, Math.floor(this.total * 0.2));
      if (L.intro && ZOMBIES[L.intro]?.weight > 0 && i >= introWave && (i - introWave) % 4 === 0 && usable.includes(L.intro)) {
        list.push(L.intro);
        pts -= ZOMBIES[L.intro].pts;
      }
      const lvlScale = this.endless ? 1 : Math.min(1, this.total / 20);
      let guard = 0;
      while (pts > 0 && guard++ < 200) {
        const cands = usable.filter((t2) => {
          const d = ZOMBIES[t2];
          const minWave = this.endless ? Math.floor((d.firstWave || 0) * 0.6) : Math.floor((d.firstWave || 0) * lvlScale);
          return d.pts <= pts && i >= minWave;
        });
        const t = cands.length ? weightedChoice(cands, (t2) => ZOMBIES[t2].weight) : "normal";
        list.push(t);
        pts -= ZOMBIES[t].pts;
      }
      return list;
    }
    spawnWave(i) {
      const b = this.board;
      const list = this.composeWave(i);
      this.waveZombies = [];
      let hp0 = 0;
      const hpMul = this.endless ? 1 + Math.floor(i / 20) * 0.15 : 1;
      if (this.level.mode === "whack") return this.spawnWhackWave(i, list);
      list.forEach((type, k) => {
        const row = this.pickRow(type);
        const d = ZOMBIES[type];
        hp0 += (d.hp + (d.armor?.hp || 0) + (d.shield?.hp || 0)) * hpMul;
        this.pending.push({
          type,
          row,
          x: SPAWN_X + rand(0, 50) + (type === "flag" ? -10 : 0),
          waveId: i,
          hpMul,
          delay: type === "flag" ? 0 : rand(0, Math.min(3.5, 0.4 + list.length * 0.25))
        });
      });
      this.waveHp0 = Math.max(1, hp0);
      if (this.isFlagWave(i) && b.graves.length) {
        for (const g of b.graves) {
          const t = choose(this.level.zombies.filter((t2) => ["normal", "cone", "bucket"].includes(t2)).concat(["normal"]));
          const z = b.spawnZombie(t, g.row, g.x + 10, { state: "rise", waveId: i });
          this.waveZombies.push(z);
          b.fx.dirt(g.x, g.y, 12, 25);
        }
        audio.play("grave");
      }
    }
    // 锤僵尸：僵尸全部从墓碑中钻出，并且会不断冒出新墓碑
    spawnWhackWave(i, list) {
      const b = this.board;
      if (b.graves.length < 12) {
        for (let k = 0; k < 2; k++) {
          const r = choose(b.activeRows), c = 3 + Math.floor(Math.random() * 6);
          if (b.addGrave(c, r)) audio.play("grave");
        }
      }
      this.waveZombies = [];
      let hp0 = 0;
      list.forEach((type) => {
        const t = type === "flag" ? "normal" : type;
        const g = choose(b.graves);
        if (!g) return;
        const d = ZOMBIES[t];
        hp0 += d.hp + (d.armor?.hp || 0);
        this.pending.push({ type: t, row: g.row, x: g.x + 8, waveId: i, whack: true, delay: rand(0, 3) });
      });
      this.waveHp0 = Math.max(1, hp0);
    }
    get allSpawned() {
      return this.done && this.pending.length === 0;
    }
  };

  // src/gfx/fx.js
  var Particles = class {
    constructor() {
      this.list = [];
      this.top = [];
    }
    add(p, layer = "normal") {
      p.t = 0;
      p.life = p.life ?? 1;
      p.vx = p.vx ?? 0;
      p.vy = p.vy ?? 0;
      p.rot = p.rot ?? 0;
      p.vr = p.vr ?? 0;
      p.alpha = p.alpha ?? 1;
      (layer === "top" ? this.top : this.list).push(p);
      return p;
    }
    update(dt) {
      for (const arr of [this.list, this.top]) {
        for (let i = arr.length - 1; i >= 0; i--) {
          const p = arr[i];
          p.t += dt;
          if (p.t >= p.life) {
            arr.splice(i, 1);
            continue;
          }
          if (p.drag) {
            p.vx *= Math.pow(p.drag, dt * 60);
            p.vy *= Math.pow(p.drag, dt * 60);
          }
          p.vy += (p.g || 0) * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.rot += p.vr * dt;
          if (p.ground !== void 0 && p.y > p.ground) {
            p.y = p.ground;
            if (Math.abs(p.vy) > 60 && (p.bounces ?? 2) > 0) {
              p.vy = -p.vy * (p.bounce ?? 0.35);
              p.vx *= 0.6;
              p.vr *= 0.5;
              p.bounces = (p.bounces ?? 2) - 1;
              p.onBounce?.(p);
            } else {
              p.vy = 0;
              p.vx *= 0.8;
              p.vr *= 0.8;
            }
          }
          p.update?.(p, dt);
        }
      }
    }
    draw(ctx, layer = "normal") {
      const arr = layer === "top" ? this.top : this.list;
      for (const p of arr) {
        const k = p.t / p.life;
        let a = p.alpha;
        if (p.fade !== false) a *= p.fadeIn ? Math.min(1, p.t / p.fadeIn) : 1;
        if (p.fade !== false) a *= k > (p.fadeStart ?? 0.6) ? 1 - (k - (p.fadeStart ?? 0.6)) / (1 - (p.fadeStart ?? 0.6)) : 1;
        if (a <= 3e-3) continue;
        ctx.save();
        ctx.globalAlpha *= a;
        if (p.additive) ctx.globalCompositeOperation = "lighter";
        ctx.translate(p.x, p.y);
        if (p.rot) ctx.rotate(p.rot);
        const size = p.grow ? p.size * (1 + p.grow * k) : p.shrink ? p.size * (1 - k * p.shrink) : p.size;
        switch (p.type) {
          case "dot":
            C(ctx, 0, 0, size);
            ctx.fillStyle = p.color;
            ctx.fill();
            break;
          case "glow":
            C(ctx, 0, 0, size);
            ctx.fillStyle = rg(ctx, 0, 0, 0, 0, 0, size, [0, p.color, 1, p.color2 || "rgba(0,0,0,0)"]);
            ctx.fill();
            break;
          case "blob":
            E(ctx, 0, 0, size, size * (p.squash || 0.8));
            fs(ctx, p.color, p.stroke, 1.2);
            break;
          case "rect":
            ctx.fillStyle = p.color;
            ctx.fillRect(-size / 2, -size / 2 * (p.aspect || 1), size, size * (p.aspect || 1));
            if (p.stroke) {
              ctx.strokeStyle = p.stroke;
              ctx.lineWidth = 1;
              ctx.strokeRect(-size / 2, -size / 2 * (p.aspect || 1), size, size * (p.aspect || 1));
            }
            break;
          case "shard":
            ctx.beginPath();
            ctx.moveTo(0, -size);
            ctx.lineTo(size * 0.45, 0);
            ctx.lineTo(0, size * 0.6);
            ctx.lineTo(-size * 0.4, 0);
            ctx.closePath();
            fs(ctx, p.color, p.stroke, 1);
            break;
          case "ring":
            C(ctx, 0, 0, size);
            ctx.lineWidth = (p.width || 6) * (1 - k);
            ctx.strokeStyle = p.color;
            ctx.stroke();
            break;
          case "star":
            star(ctx, 0, 0, size, size * 0.45, 4, 0);
            ctx.fillStyle = p.color;
            ctx.fill();
            break;
          case "text": {
            const sc = p.pop ? 1 + Math.max(0, 0.6 - p.t * 4) : 1;
            ctx.scale(sc, sc);
            text(ctx, p.text, 0, 0, { size: p.size, color: p.color, stroke: p.stroke || "#000", lw: p.lw, weight: 900 });
            break;
          }
          case "custom":
            p.draw(ctx, p, k);
            break;
        }
        ctx.restore();
      }
    }
    clear() {
      this.list.length = 0;
      this.top.length = 0;
    }
    // ---------- 预设 ----------
    splat(x, y, color = "#7ed84a", n = 7, o = {}) {
      for (let i = 0; i < n; i++) {
        const a = rand(-Math.PI * 0.8, Math.PI * 0.8) + (o.dir < 0 ? 0 : Math.PI);
        const sp = rand(60, 200);
        this.add({ type: "dot", x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, g: 500, size: rand(2, 4.5), color, life: rand(0.25, 0.45), shrink: 0.6 });
      }
      this.add({ type: "blob", x, y, size: 9, squash: 0.9, color, life: 0.14, grow: 0.8, alpha: 0.9 });
    }
    dirt(x, y, n = 10, spread = 30, color = ["#7a5230", "#5e3c20", "#9a6a3c"]) {
      for (let i = 0; i < n; i++) {
        this.add({
          type: "rect",
          x: x + rand(-spread, spread),
          y: y + rand(-6, 2),
          vx: rand(-90, 90),
          vy: rand(-280, -80),
          g: 900,
          size: rand(3, 7),
          aspect: rand(0.6, 1.2),
          color: choose(color),
          rot: rand(TAU),
          vr: rand(-10, 10),
          life: rand(0.5, 0.9),
          ground: y + rand(0, 10),
          bounces: 1
        });
      }
    }
    smoke(x, y, n = 6, o = {}) {
      for (let i = 0; i < n; i++) {
        this.add({
          type: "glow",
          x: x + rand(-20, 20) * (o.spread || 1),
          y: y + rand(-10, 10),
          vx: rand(-30, 30),
          vy: rand(-60, -20),
          size: rand(14, 26) * (o.scale || 1),
          grow: 1.4,
          color: o.color || "rgba(90,90,90,0.55)",
          life: rand(0.8, 1.4),
          drag: 0.97
        });
      }
    }
    sparks(x, y, n = 8, color = "#ffe07a") {
      for (let i = 0; i < n; i++) {
        const a = rand(TAU), sp = rand(80, 260);
        this.add({ type: "dot", x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 300, size: rand(1.5, 3), color, additive: true, life: rand(0.25, 0.5), shrink: 1 });
      }
    }
    fireBurst(x, y, n = 10, scale = 1) {
      for (let i = 0; i < n; i++) {
        const a = rand(TAU), sp = rand(40, 200) * scale;
        this.add({
          type: "glow",
          x,
          y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp - 40,
          drag: 0.93,
          size: rand(10, 22) * scale,
          shrink: 0.6,
          color: choose(["rgba(255,200,60,0.95)", "rgba(255,120,20,0.9)", "rgba(255,240,160,0.9)"]),
          additive: true,
          life: rand(0.3, 0.6)
        });
      }
    }
    iceShards(x, y, n = 8) {
      for (let i = 0; i < n; i++) {
        const a = rand(TAU), sp = rand(60, 200);
        this.add({ type: "shard", x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, g: 500, size: rand(3, 7), color: "#dff6ff", stroke: "#5ab0e0", rot: rand(TAU), vr: rand(-8, 8), life: rand(0.4, 0.7) });
      }
    }
    floatText(x, y, str, o = {}) {
      return this.add({ type: "text", x, y, vy: o.vy ?? -40, text: str, size: o.size || 22, color: o.color || "#fff", stroke: o.stroke || "#000", life: o.life || 1.2, pop: o.pop !== false, fadeStart: 0.6 }, "top");
    }
    shockwave(x, y, r = 80, color = "rgba(255,240,200,0.8)", life = 0.45) {
      this.add({ type: "ring", x, y, size: r * 0.2, grow: 4, color, width: 10, life, fade: true }, "top");
    }
    // 大爆炸：火球 + 冲击波 + 烟雾 + 碎片
    explosion(x, y, scale = 1, o = {}) {
      this.add({ type: "glow", x, y, size: 90 * scale, color: "rgba(255,255,230,1)", color2: "rgba(255,160,40,0)", additive: true, life: 0.3, grow: 0.6 }, "top");
      this.shockwave(x, y, 120 * scale);
      this.fireBurst(x, y, 26, 1.6 * scale);
      for (let i = 0; i < 14; i++) {
        const a = rand(TAU), sp = rand(40, 180) * scale;
        this.add({
          type: "glow",
          x: x + rand(-30, 30) * scale,
          y: y + rand(-30, 20) * scale,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp * 0.6 - 60,
          drag: 0.94,
          size: rand(22, 40) * scale,
          grow: 1.2,
          color: choose(["rgba(70,60,55,0.7)", "rgba(110,100,90,0.6)", "rgba(40,36,34,0.7)"]),
          life: rand(1, 1.8)
        });
      }
      for (let i = 0; i < 16; i++) {
        this.add({
          type: "rect",
          x,
          y,
          vx: rand(-260, 260) * scale,
          vy: rand(-420, -120) * scale,
          g: 900,
          size: rand(3, 8),
          color: choose(["#3a2a1a", "#5a4030", "#222"]),
          rot: rand(TAU),
          vr: rand(-14, 14),
          life: rand(0.7, 1.2),
          ground: y + rand(10, 40),
          bounces: 1
        });
      }
      if (o.text) {
        this.add({
          type: "custom",
          x,
          y: y - 20 * scale,
          life: 0.9,
          fadeStart: 0.5,
          draw: (ctx, p, k) => {
            const s = Ease.outBack(Math.min(1, k * 4)) * scale;
            ctx.scale(s, s);
            ctx.rotate(-0.08);
            text(ctx, o.text, 0, 0, { size: 44, color: o.textColor || "#ffe23a", stroke: "#6a1000", lw: 9, weight: 900 });
          }
        }, "top");
      }
    }
    // 掉落物（僵尸头、手臂、护具）：带重力、旋转、弹跳，落地后停留片刻再淡出
    debris(x, y, drawFn, o = {}) {
      return this.add({
        type: "custom",
        x,
        y,
        vx: o.vx ?? rand(20, 80),
        vy: o.vy ?? rand(-260, -160),
        g: 900,
        rot: o.rot ?? 0,
        vr: o.vr ?? rand(-6, 6),
        ground: o.ground ?? y + 60,
        bounce: 0.35,
        bounces: 2,
        life: o.life ?? 2.2,
        fadeStart: 0.75,
        draw: (ctx) => drawFn(ctx),
        onBounce: o.onBounce
      });
    }
  };

  // src/game/board.js
  var Board = class {
    constructor(scene, level) {
      this.scene = scene;
      this.level = level;
      this.mode = level.mode || "normal";
      this.env = level.env;
      this.info = envInfo(this.env);
      this.rows = this.info.rows;
      this.rowH = this.info.rowH;
      this.isNight = this.info.night;
      this.activeRows = level.rows ? level.rows.slice() : [...Array(this.rows).keys()];
      this.sodRows = level.sod || null;
      this.newSod = level.newSod || [];
      this.sodT = this.newSod.length ? 0 : 1;
      this.cells = [];
      for (let r = 0; r < this.rows; r++) {
        this.cells.push([]);
        for (let c = 0; c < COLS; c++) this.cells[r].push({ base: null, main: null, shell: null, overlay: null, grave: null, crater: 0, vase: null });
      }
      this.plants = [];
      this.zombies = [];
      this.projectiles = [];
      this.stars = [];
      this.suns = [];
      this.mowers = [];
      this.graves = [];
      this.bowls = [];
      this.rewards = [];
      this.effects = [];
      this.vases = [];
      this.fx = new Particles();
      this.time = 0;
      this.sun = level.sun ?? 50;
      const noSkyModes = ["conveyor", "bowling", "vase", "whack"];
      this.skySun = level.skySun ?? (!this.isNight && !noSkyModes.includes(this.mode));
      this.skyTimer = 5;
      this.waves = new WaveDirector(this, level);
      this.running = false;
      this.shakeAmt = 0;
      this.ice = {};
      this.showHealth = save.settings.healthBars;
      this.autoCollect = save.settings.autoCollect;
      this.drawScale = 1;
      this.entityScale = this.env === "pool" ? 0.92 : 1;
      this.moversArrive = false;
      this.intenseT = 0;
      this.kills = 0;
      this.lastKill = null;
      this.won = false;
      this.lost = false;
      this.invisible = !!level.invisible;
      this.previewZombies = [];
      this.fogCols = level.fog || 0;
      this.fogAmt = this.fogCols ? Array.from({ length: this.rows }, () => new Array(12).fill(0)) : null;
      this.fogBlowT = 0;
      this.storm = !!level.storm;
      this.lightningT = 5;
      this.flashT = 0;
      for (const r of this.activeRows) if (this.mode !== "vase") this.mowers.push(new Mower(this, r));
      const g = level.graves || 0;
      if (g > 0) this.placeGraves(g, this.mode === "whack" ? 2 : 4);
    }
    // ---------- 几何 ----------
    rowY(r) {
      return LAWN_TOP + r * this.rowH + this.rowH * 0.8;
    }
    rowTop(r) {
      return LAWN_TOP + r * this.rowH;
    }
    isWater(r) {
      return this.info.water.includes(r);
    }
    activeRow(r) {
      return this.activeRows.includes(r);
    }
    cellOf(c, r) {
      return this.cells[r]?.[c];
    }
    cellAt(x, y) {
      if (x < LAWN_X || x >= LAWN_RIGHT || y < LAWN_TOP) return null;
      const c = colOf(x);
      const r = Math.floor((y - LAWN_TOP) / this.rowH);
      if (r < 0 || r >= this.rows || c < 0 || c >= COLS) return null;
      return { col: c, row: r };
    }
    placeGraves(n, minCol) {
      const spots = [];
      for (const r of this.activeRows) for (let c = minCol; c < COLS; c++) if (!this.isWater(r)) spots.push([c, r]);
      shuffle(spots);
      const perRow = {};
      let placed = 0;
      for (const [c, r] of spots) {
        if (placed >= n) break;
        if ((perRow[r] || 0) >= Math.ceil(n / this.activeRows.length) + 1) continue;
        this.addGrave(c, r, true);
        perRow[r] = (perRow[r] || 0) + 1;
        placed++;
      }
    }
    addGrave(c, r, instant = false) {
      const cell = this.cellOf(c, r);
      if (!cell || cell.grave || cell.main || cell.base) return null;
      const g = new Grave(this, c, r, { instant });
      cell.grave = g;
      this.graves.push(g);
      return g;
    }
    graveAt(c, r) {
      return this.cellOf(c, r)?.grave || null;
    }
    removeGrave(g) {
      const cell = this.cellOf(g.col, g.row);
      if (cell && cell.grave === g) cell.grave = null;
      this.graves = this.graves.filter((x) => x !== g);
    }
    // ---------- 种植规则 ----------
    canPlant(type, c, r) {
      if (!this.activeRow(r)) return { ok: false };
      const cell = this.cellOf(c, r);
      if (!cell) return { ok: false };
      const def = PLANTS[type];
      if (!def) return { ok: false };
      if (cell.crater > 0) return { ok: false, reason: "\u5F39\u5751\u91CC\u4E0D\u80FD\u79CD\u690D\u7269" };
      if (this.iceAt(c, r)) return { ok: false, reason: "\u51B0\u9053\u4E0A\u4E0D\u80FD\u79CD\u690D\u7269" };
      if (cell.vase) return { ok: false };
      if (this.mode === "bowling") {
        if (c > 2) return { ok: false, reason: "\u53EA\u80FD\u79CD\u5728\u7EA2\u7EBF\u5DE6\u4FA7" };
        return { ok: true };
      }
      if (type === "gravebuster") return cell.grave && !cell.main ? { ok: true } : { ok: false, reason: "\u5893\u7891\u541E\u566C\u8005\u53EA\u80FD\u79CD\u5728\u5893\u7891\u4E0A" };
      if (cell.grave) return { ok: false, reason: "\u4E0D\u80FD\u79CD\u5728\u5893\u7891\u4E0A" };
      if (type === "coffeebean") {
        if (cell.main && cell.main.sleep && !cell.overlay) return { ok: true };
        return { ok: false, reason: "\u5496\u5561\u8C46\u53EA\u80FD\u79CD\u5728\u7761\u89C9\u7684\u8611\u83C7\u4E0A" };
      }
      const water = this.isWater(r);
      if (def.shell) {
        if (cell.shell) return { ok: false };
        if (water && !cell.base) return { ok: false, reason: "\u9700\u8981\u5148\u79CD\u4E00\u7247\u7761\u83B2" };
        if (cell.main && (cell.main.kind === "spike" || cell.main.def.tall)) return { ok: false };
        return { ok: true };
      }
      if (def.aquatic) {
        if (!water) return { ok: false, reason: "\u53EA\u80FD\u79CD\u5728\u6C34\u91CC" };
        if (cell.base || cell.main || cell.shell) return { ok: false };
        return { ok: true };
      }
      if (water && type === "spikeweed") return { ok: false, reason: "\u5730\u523A\u4E0D\u80FD\u79CD\u5728\u6C34\u9762\u4E0A" };
      if (water && !cell.base) return { ok: false, reason: "\u9700\u8981\u5148\u79CD\u4E00\u7247\u7761\u83B2" };
      if (cell.main) return { ok: false };
      if (this.sodRows && !this.sodRows.includes(r)) return { ok: false };
      return { ok: true };
    }
    plantAt(r, frontX) {
      let best = null;
      for (const p of this.plants) {
        if (p.row !== r || !p.blocking) continue;
        if (frontX <= p.x + 32 && frontX >= p.x - 40) {
          const pri = { shell: 3, main: 2, base: 1 };
          if (!best || (pri[p.slot] || 0) > (pri[best.slot] || 0)) best = p;
        }
      }
      return best;
    }
    plantAhead(z, dist) {
      let best = null;
      for (const p of this.plants) {
        if (p.row !== z.row || p.dead || p.slot === "overlay" || p.kind === "spike") continue;
        if (p.slot === "base" && this.cellOf(p.col, p.row).main) continue;
        const d = z.front - (p.x + 30);
        if (d >= -10 && d <= dist && p.x < z.x) {
          if (!best || p.x > best.x) best = p;
        }
      }
      return best;
    }
    plantUnder(r, x, w) {
      for (const p of this.plants) {
        if (p.row !== r || p.dead || p.slot === "overlay") continue;
        if (p.kind === "squash" && p.state !== "idle") continue;
        if (Math.abs(p.x - x) < w) return p;
      }
      return null;
    }
    placePlant(type, c, r, o = {}) {
      const cell = this.cellOf(c, r);
      const def = PLANTS[type];
      let slot = "main";
      if (def.kind === "base") slot = "base";
      if (def.shell) slot = "shell";
      if (type === "coffeebean") slot = "overlay";
      const p = new Plant(this, type, c, r, { onPad: (slot === "main" || slot === "shell") && !!cell.base, slot, awake: o.awake });
      cell[slot] = p;
      this.plants.push(p);
      save.data.stats.plantsPlanted++;
      const water = this.isWater(r) && !cell.base;
      if (water || def.aquatic) {
        audio.play("plantwater");
        this.splash(p.x, p.y, 0.8);
      } else {
        audio.play("plant");
        this.fx.dirt(p.x, p.y, 8, 26);
      }
      return p;
    }
    removePlant(p) {
      const cell = this.cellOf(p.col, p.row);
      if (cell) {
        for (const k of ["base", "main", "shell", "overlay"]) if (cell[k] === p) cell[k] = null;
      }
      p.dead = true;
      if (p.slot === "base" && cell) {
        for (const k of ["main", "shell"]) {
          if (!cell[k]) continue;
          const m = cell[k];
          this.removePlant(m);
          this.splash(m.x, m.y);
        }
      }
    }
    clearCellSlot(p) {
      const cell = this.cellOf(p.col, p.row);
      if (cell) {
        for (const k of ["base", "main", "shell", "overlay"]) if (cell[k] === p) cell[k] = null;
      }
      p.detached = true;
    }
    removeFree(p) {
      p.dead = true;
    }
    shovel(c, r) {
      const cell = this.cellOf(c, r);
      if (!cell) return false;
      const p = cell.overlay || cell.main || cell.shell || cell.base;
      if (!p) return false;
      this.removePlant(p);
      audio.play("shovel");
      this.fx.dirt(p.x, p.y, 10, 22, ["#4f9a2a", "#7a5230", "#3a7a1e"]);
      return p;
    }
    // ---------- 查询 ----------
    enemyInRow(r, x0, x1) {
      for (const z of this.zombies) {
        if (z.row === r && z.isEnemy && z.hittable && z.x + z.halfWidth >= x0 && z.x - z.halfWidth <= x1) return true;
      }
      return false;
    }
    // ---------- 生成 ----------
    addProjectile(kind, x, y, row, o) {
      const p = new Projectile(this, kind, x, y, row, o);
      this.projectiles.push(p);
      return p;
    }
    spawnZombie(type, row, x, o = {}) {
      const z = new Zombie(this, type, row, x ?? SPAWN_X, o);
      this.zombies.push(z);
      if (!o.preview) save.seeZombie(type === "normal" && z.ducky ? "ducky" : type);
      return z;
    }
    produceSun(x, y, value) {
      this.suns.push(new Sun(this, x, y, value, { vx: rand(-45, 45), vy: -230, groundY: y + rand(40, 60) }));
    }
    spawnSkySun() {
      const r = choose(this.activeRows);
      const x = rand(LAWN_X + 50, LAWN_RIGHT - 50);
      this.suns.push(new Sun(this, x, -30, 25, { fall: true, targetY: this.rowY(r) - 40 }));
    }
    collectSun(s) {
      this.sun += s.value;
      save.data.stats.sunCollected += s.value;
    }
    onSunArrived() {
      this.scene.sunPulse?.();
    }
    sunTarget() {
      return this.scene.sunCounterWorld();
    }
    // ---------- 事件 ----------
    onZombieKilled(z, hypno = false) {
      if (z.preview) return;
      if (!hypno) {
        this.kills++;
        save.data.stats.zombiesKilled++;
      }
      this.lastKill = { x: clamp(z.x, LAWN_X + 60, LAWN_RIGHT - 40), y: this.rowY(z.row) };
    }
    triggerMower(r, z) {
      const m = this.mowers.find((m2) => m2.row === r && (m2.state === "idle" || m2.state === "arrive") && m2.x > z.x - 40);
      if (m) m.trigger();
    }
    zombieReachedHouse(z) {
      if (this.lost || this.won) return;
      const running = this.mowers.some((m) => m.row === z.row && m.state === "run" && m.x < z.x + 60);
      if (running) return;
      this.lost = true;
      this.scene.onLose?.(z);
    }
    message(kind) {
      this.scene.showMessage?.(kind);
    }
    onFinalWave() {
      this.finalWave = true;
    }
    onSurvivalFlag(n) {
      this.scene.onSurvivalFlag?.(n);
    }
    shake(a) {
      this.shakeAmt = Math.max(this.shakeAmt, a);
    }
    splash(x, y, s = 1) {
      for (let i = 0; i < 10 * s; i++) {
        this.fx.add({ type: "dot", x: x + rand(-20, 20), y: y - 4, vx: rand(-90, 90), vy: rand(-260, -80), g: 800, size: rand(2, 4.5), color: "rgba(220,245,255,0.9)", life: rand(0.4, 0.7) });
      }
      this.fx.add({ type: "ring", x, y, size: 8, grow: 4, color: "rgba(230,250,255,0.8)", width: 3, life: 0.6 });
    }
    // ---------- 范围效果 ----------
    explodeArea(x, y, row, dc, dr, kind) {
      for (const z of this.zombies) {
        if (!z.isEnemy || !z.alive) continue;
        if (Math.abs(z.row - row) > dr) continue;
        if (Math.abs(z.x - x) > (dc + 0.5) * COL_W + 25) continue;
        z.takeDamage(1800, "explode");
      }
      audio.play("explode");
      this.shake(12);
      this.fx.explosion(x, y - 40, 1.25, kind === "cherry" ? { text: "\u8F70\uFF01", textColor: "#ffe23a" } : {});
    }
    burnRow(r) {
      for (const z of this.zombies) {
        if (z.isEnemy && z.alive && z.row === r && z.x < 1290) z.takeDamage(1800, "fire-row");
      }
      delete this.ice[r];
      audio.play("jalapeno");
      this.shake(10);
      this.effects.push({ type: "rowfire", row: r, t: 0, life: 1.3 });
    }
    freezeAll(x, y) {
      for (const z of this.zombies) {
        if (z.isEnemy && z.alive && z.x < 1270) {
          z.freeze(rand(4.5, 6));
          z.takeDamage(20, "freeze");
        }
      }
      audio.play("freeze");
      this.effects.push({ type: "iceflash", t: 0, life: 1.4, x, y });
      this.fx.iceShards(x, y - 30, 20);
    }
    doom(c, r, x, y) {
      for (const z of this.zombies) {
        if (!z.isEnemy || !z.alive) continue;
        const d = Math.hypot(z.x - x, (z.row - r) * 100);
        if (d <= 300) z.takeDamage(1800, "doom");
      }
      const cell = this.cellOf(c, r);
      if (cell) {
        for (const k of ["base", "main", "shell", "overlay"]) if (cell[k]) this.removePlant(cell[k]);
        cell.crater = 180;
      }
      audio.play("doom");
      this.shake(22);
      this.effects.push({ type: "doomcloud", t: 0, life: 2.6, x, y });
      this.fx.explosion(x, y - 40, 2.2);
    }
    fumeCloud(x0, y, x1) {
      for (let x = x0; x < x1; x += 26) {
        this.fx.add({
          type: "glow",
          x: x + rand(-8, 8),
          y: y + rand(-10, 10),
          vx: rand(10, 40),
          vy: rand(-12, 12),
          size: rand(14, 22),
          grow: 0.8,
          color: "rgba(200,140,240,0.6)",
          life: 0.35 + (x - x0) / (x1 - x0 + 1) * 0.3,
          fadeIn: 0.05
        });
      }
    }
    flyingItem(item, x, y, magnet) {
      this.effects.push({ type: "flyitem", item, x0: x, y0: y, t: 0, life: 0.5, magnet });
    }
    leaveIce(r, x) {
      const cur = this.ice[r];
      if (!cur) this.ice[r] = { x, melt: -1 };
      else {
        cur.x = Math.min(cur.x, x);
        cur.melt = -1;
      }
    }
    zomboniDied(r) {
      if (this.ice[r]) this.ice[r].melt = 25;
    }
    iceAt(c, r) {
      const i = this.ice[r];
      return i && colX(c) + 30 > i.x;
    }
    addStar(x, y, vx, vy) {
      this.stars.push(new StarShot(this, x, y, vx, vy));
    }
    // 三叶草：吹走气球僵尸与浓雾
    blowAway(x, y) {
      for (const z of this.zombies) if (z.isEnemy && z.balloonUp && z.alive) z.blowAway();
      if (this.fogCols) this.fogBlowT = 16;
      audio.play("wind");
      for (let i = 0; i < 40; i++) {
        this.fx.add({
          type: "rect",
          x: rand(-60, 700),
          y: rand(150, 700),
          vx: rand(700, 1100),
          vy: rand(-60, 60),
          size: rand(5, 10),
          aspect: 0.5,
          color: choose(["#7ac04a", "#a8e06a", "#5a9a3a", "rgba(255,255,255,0.6)"]),
          rot: rand(TAU),
          vr: rand(-10, 10),
          life: rand(0.8, 1.4)
        }, "top");
      }
    }
    // 小丑僵尸爆炸：摧毁附近 3×3 的植物
    explodePlants(x, row) {
      for (const p of this.plants.slice()) {
        if (p.dead || Math.abs(p.row - row) > 1 || Math.abs(p.x - x) > 150) continue;
        this.removePlant(p);
        this.fx.dirt(p.x, p.y, 6, 20, ["#4f9a2a", "#3a2a1a", "#7ac04a"]);
      }
    }
    // ---------- 保龄球 ----------
    launchBowl(kind, c, r) {
      const b = new BowlNut(this, kind, r, colX(c));
      this.bowls.push(b);
      return b;
    }
    // ---------- 锤子 ----------
    whackAt(x, y) {
      let best = null;
      for (const z of this.zombies) {
        if (!z.isEnemy || !z.alive || z.state === "rise" && z.riseT < 0.3) continue;
        const zy = this.rowY(z.row);
        if (x > z.x - 34 && x < z.x + 34 && y > zy - 160 && y < zy + 10) {
          if (!best || zy > this.rowY(best.row)) best = z;
        }
      }
      if (best) {
        const dmg = best.armor ? best.armor.hp : best.hp + 5;
        best.takeDamage(dmg, "whack");
        this.fx.add({ type: "ring", x, y, size: 10, grow: 3, color: "rgba(255,255,255,0.9)", width: 5, life: 0.3 }, "top");
        this.fx.sparks(x, y, 10, "#fff");
        if (!best.alive && Math.random() < 0.55) this.produceSun(best.x, best.y - 60, 25);
        this.shake(3);
      }
      return best;
    }
    // ---------- 主更新 ----------
    update(dt) {
      this.time += dt;
      if (this.shakeAmt > 0) this.shakeAmt = Math.max(0, this.shakeAmt - dt * 40);
      if (this.sodT < 1 && this.sodRolling) this.sodT = Math.min(1, this.sodT + dt * 0.7);
      for (const z of this.previewZombies) z.update(dt);
      for (const m of this.mowers) m.update(dt);
      for (const g of this.graves) g.update(dt);
      if (this.running) {
        if (this.skySun) {
          this.skyTimer -= dt;
          if (this.skyTimer <= 0) {
            this.spawnSkySun();
            this.skyTimer = rand(7, 11);
          }
        }
        if (!this.won && !this.noWaves) this.waves.update(dt);
        for (const p of this.plants) if (!p.dead) p.update(dt);
        for (const z of this.zombies) if (!z.dead) z.update(dt);
        for (const p of this.projectiles) p.update(dt);
        for (const s of this.stars) s.update(dt);
        for (const b of this.bowls) b.update(dt);
      }
      for (const s of this.suns) s.update(dt);
      for (const r of this.rewards) r.update(dt);
      for (const k of Object.keys(this.ice)) {
        const i = this.ice[k];
        if (i.melt > 0) {
          i.melt -= dt;
          if (i.melt <= 0) delete this.ice[k];
        }
      }
      for (const row of this.cells) for (const cell of row) if (cell.crater > 0) cell.crater = Math.max(0, cell.crater - dt);
      for (const e of this.effects) e.t += dt;
      this.effects = this.effects.filter((e) => e.t < e.life);
      this.fx.update(dt);
      this.plants = this.plants.filter((p) => !p.dead);
      this.zombies = this.zombies.filter((z) => !z.dead);
      this.projectiles = this.projectiles.filter((p) => !p.dead);
      this.stars = this.stars.filter((p) => !p.dead);
      if (this.fogAmt) updateFog(this, dt);
      this.bowls = this.bowls.filter((b) => !b.dead);
      this.suns = this.suns.filter((s) => !s.dead);
      this.mowers = this.mowers.filter((m) => !m.dead);
      if (this.intenseT > 0) {
        this.intenseT -= dt;
        if (this.intenseT <= 0) music.setLayer("intense", 0);
      }
      if (this.running && !this.won && !this.lost && this.waves.allSpawned && !this.noWinCheck) {
        const left = this.zombies.some((z) => z.isEnemy && (z.alive || z.state === "flying"));
        if (!left) {
          this.won = true;
          this.scene.onWin?.(this.lastKill || { x: 700, y: this.rowY(this.activeRows[0]) });
        }
      }
    }
    // ---------- 绘制（世界坐标） ----------
    drawBackground(ctx, camX) {
      const bg = getBackground(this.env);
      const s = bg.scale;
      if (!this.sodRows) {
        ctx.drawImage(bg.canvas, (camX - WORLD_MIN_X) * s, 0, 1280 * s, 720 * s, camX, 0, 1280, 720);
        return;
      }
      const dirt = getBackground(this.env, true);
      ctx.drawImage(dirt.canvas, (camX - WORLD_MIN_X) * s, 0, 1280 * s, 720 * s, camX, 0, 1280, 720);
      for (const r of this.sodRows) {
        const isNew = this.newSod.includes(r);
        const k = isNew ? Ease.inOutSine(this.sodT) : 1;
        if (k <= 0) continue;
        const y0 = this.rowTop(r) - 2, h = this.rowH + 4;
        const w = (LAWN_RIGHT - LAWN_X + 4) * k;
        ctx.drawImage(bg.canvas, (LAWN_X - 2 - WORLD_MIN_X) * s, y0 * s, w * s, h * s, LAWN_X - 2, y0, w, h);
        if (isNew && k < 1) {
          const d = 46 * (1 - k * 0.45);
          const x0 = LAWN_X + w - 6;
          ctx.save();
          ctx.fillStyle = "rgba(0,0,0,0.25)";
          ctx.fillRect(x0 + 6, y0 + 8, d, h - 6);
          rr(ctx, x0, y0 + 2, d, h - 6, d * 0.35);
          fs(ctx, lg(ctx, x0, 0, x0 + d, 0, [0, "#2f6a18", 0.4, "#9ee85a", 0.6, "#7ac840", 1, "#2a5a12"]), "#1a3a0a", 2);
          ctx.strokeStyle = "rgba(20,50,8,0.35)";
          ctx.lineWidth = 1.2;
          for (let yy = y0 + 10; yy < y0 + h - 10; yy += 9) {
            ctx.beginPath();
            ctx.moveTo(x0 + 4, yy);
            ctx.lineTo(x0 + d - 4, yy + 3);
            ctx.stroke();
          }
          E(ctx, x0 + d / 2, y0 + h - 6, d / 2, d / 4.2);
          fs(ctx, "#7a5230", "#3a2410", 1.5);
          ctx.beginPath();
          for (let i = 0; i < 26; i++) {
            const a = i * 0.55 + (1 - k) * 20, rrr = i / 26 * (d / 2 - 2);
            const px = x0 + d / 2 + Math.cos(a) * rrr, py = y0 + h - 6 + Math.sin(a) * rrr * 0.45;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.strokeStyle = "#4a8a24";
          ctx.lineWidth = 1.6;
          ctx.stroke();
          ctx.restore();
        }
      }
    }
    draw(ctx, camX) {
      this.drawBackground(ctx, camX);
      if (this.info.water.length) drawWaterOverlay(ctx, this.env, this.time);
      if (!this.isNight) drawCloudShadows(ctx, this.time);
      for (const k of Object.keys(this.ice)) {
        const r = +k, i = this.ice[k];
        const y = this.rowY(r);
        ctx.save();
        ctx.globalAlpha = i.melt > 0 ? Math.min(1, i.melt / 3) : 1;
        ctx.fillStyle = lg(ctx, 0, y - 30, 0, y + 6, [0, "rgba(230,248,255,0.9)", 1, "rgba(160,210,240,0.85)"]);
        ctx.fillRect(i.x, y - 26, 1300 - i.x, 30);
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        for (let x = i.x + 10; x < 1300; x += 60) ctx.fillRect(x, y - 20, 30, 3);
        ctx.restore();
      }
      for (let r = 0; r < this.rows; r++) for (let c = 0; c < COLS; c++) {
        const cell = this.cells[r][c];
        if (cell.crater > 0) drawCrater(ctx, colX(c), this.rowY(r), this.time, cell.crater / 180);
      }
      if (this.mode === "bowling") {
        ctx.save();
        const x = LAWN_X + 3 * COL_W;
        ctx.strokeStyle = "rgba(220,30,20,0.85)";
        ctx.lineWidth = 5;
        ctx.setLineDash([16, 10]);
        ctx.beginPath();
        ctx.moveTo(x, LAWN_TOP + 4);
        ctx.lineTo(x, LAWN_TOP + this.rows * this.rowH - 4);
        ctx.stroke();
        ctx.restore();
      }
      this.scene.drawCellHighlight?.(ctx);
      const zombiesByRow = [];
      for (let r = 0; r < this.rows; r++) zombiesByRow.push([]);
      for (const z of this.zombies) zombiesByRow[z.row]?.push(z);
      for (const z of this.previewZombies) zombiesByRow[z.row]?.push(z);
      for (let r = 0; r < this.rows; r++) {
        for (const g of this.graves) if (g.row === r) g.draw(ctx);
        for (const v of this.vases) if (v.row === r) v.draw(ctx);
        for (const m of this.mowers) if (m.row === r) m.draw(ctx);
        for (const p of this.plants) if (p.row === r && p.slot === "base") p.draw(ctx);
        for (const p of this.plants) if (p.row === r && p.slot === "shell") p.draw(ctx, "back");
        for (const p of this.plants) if (p.row === r && p.slot === "main" && !p.airborneTop) p.draw(ctx);
        for (const p of this.plants) if (p.row === r && p.slot === "shell") p.draw(ctx, "front");
        for (const p of this.plants) if (p.row === r && p.slot === "overlay") p.draw(ctx);
        const zs = zombiesByRow[r].sort((a, b) => b.x - a.x);
        for (const z of zs) {
          if (this.invisible && z.isEnemy && z.flash <= 0 && z.alive && z.freezeT <= 0) {
            E(ctx, z.x, z.y, 26, 7);
            ctx.fillStyle = "rgba(0,0,0,0.25)";
            ctx.fill();
            continue;
          }
          z.draw(ctx);
        }
        for (const p of this.plants) if (p.row === r && p.airborneTop) p.draw(ctx);
        for (const b of this.bowls) if (b.row === r || b.dirY && Math.abs(this.rowY(r) - b.y) < this.rowH / 2) b.draw(ctx);
        for (const p of this.projectiles) if (p.row === r) p.draw(ctx);
      }
      for (const s of this.stars) s.draw(ctx);
      for (const e of this.effects) this.drawEffect(ctx, e);
      this.fx.draw(ctx);
      if (this.fogAmt) drawFog(ctx, this, camX);
      if (this.isNight && this.env === "night") drawNightOverlay(ctx, this.time);
      if (this.isNight) drawVignette(ctx, camX);
    }
    drawTop(ctx) {
      for (const s of this.suns) s.draw(ctx);
      for (const r of this.rewards) r.draw(ctx, this.time);
      this.fx.draw(ctx, "top");
    }
    drawEffect(ctx, e) {
      const k = e.t / e.life;
      if (e.type === "rowfire") {
        const y = this.rowY(e.row);
        const a = k < 0.15 ? k / 0.15 : k > 0.7 ? (1 - k) / 0.3 : 1;
        ctx.save();
        ctx.globalAlpha = a;
        for (let x = LAWN_X - 20; x < 1290; x += 46) {
          drawFlame(ctx, x + Math.sin(x) * 8, y + 4, 60, 110 * (0.8 + 0.3 * Math.sin(x * 0.1 + e.t * 10)), e.t + x * 0.01, 1);
        }
        ctx.restore();
      } else if (e.type === "iceflash") {
        ctx.save();
        ctx.globalAlpha = (1 - k) * 0.75;
        ctx.fillStyle = "#e0f6ff";
        ctx.fillRect(-300, 0, 1900, 720);
        ctx.restore();
      } else if (e.type === "doomcloud") {
        ctx.save();
        const a = k < 0.1 ? k / 0.1 : 1 - Math.max(0, (k - 0.5) / 0.5);
        ctx.globalAlpha = a;
        if (k < 0.15) {
          ctx.fillStyle = `rgba(255,240,255,${(1 - k / 0.15) * 0.8})`;
          ctx.fillRect(-300, 0, 1900, 720);
        }
        const rise = Ease.outCubic(Math.min(1, k * 2));
        const cx = e.x, cy = e.y - 20 - rise * 150;
        ctx.fillStyle = lg(ctx, cx, e.y, cx, cy, [0, "rgba(60,40,70,0.9)", 1, "rgba(160,90,160,0.85)"]);
        ctx.beginPath();
        ctx.moveTo(cx - 40, e.y);
        ctx.quadraticCurveTo(cx - 18, (e.y + cy) / 2, cx - 26, cy);
        ctx.lineTo(cx + 26, cy);
        ctx.quadraticCurveTo(cx + 18, (e.y + cy) / 2, cx + 40, e.y);
        ctx.fill();
        for (let i = 0; i < 9; i++) {
          const a2 = i / 9 * TAU + e.t;
          const rx = cx + Math.cos(a2) * 70 * rise, ry = cy + Math.sin(a2) * 26 * rise;
          C(ctx, rx, ry, 44 * rise);
          ctx.fillStyle = rg(ctx, rx - 10, ry - 10, 4, rx, ry, 44 * rise + 1, [0, "rgba(255,180,220,0.9)", 0.6, "rgba(160,80,160,0.9)", 1, "rgba(60,30,70,0.8)"]);
          ctx.fill();
        }
        ctx.globalCompositeOperation = "lighter";
        C(ctx, cx, cy, 80 * rise);
        ctx.fillStyle = rg(ctx, cx, cy, 5, cx, cy, 80 * rise + 1, [0, "rgba(255,200,120,0.5)", 1, "rgba(255,60,0,0)"]);
        ctx.fill();
        ctx.restore();
      } else if (e.type === "flyitem") {
        const m = e.magnet;
        const kk = Ease.inOutQuad(k);
        const x = lerp(e.x0, m.x, kk), y = lerp(e.y0, m.y - 72, kk) - Math.sin(kk * Math.PI) * 40;
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(1 - kk * 0.5, 1 - kk * 0.5);
        drawMetalItem(ctx, e.item);
        ctx.restore();
      }
    }
  };

  // src/scenes/gameScene.js
  var BANK_X = 8;
  var BANK_Y = 4;
  var PGAP = 6;
  var slotX = (i) => BANK_X + 96 + i * (PACKET_W + PGAP);
  var SLOT_Y = BANK_Y + 6;
  var Scenes2 = {};
  function registerScenes(s) {
    Scenes2 = s;
  }
  var GameScene = class _GameScene {
    constructor(level, o = {}) {
      this.level = level;
      this.o = o;
      this.board = new Board(this, level);
      this.mode = this.board.mode;
      this.t = 0;
      this.camX = 0;
      this.camTween = null;
      this.phase = "intro";
      this.phaseT = 0;
      this.maxSlots = slotsFor(level);
      this.slots = [];
      this.held = null;
      this.mx = -100;
      this.my = -100;
      this.paused = false;
      this.messages = [];
      this.hudSlide = 0;
      this.sunFlash = 0;
      this.sunPulseT = 0;
      this.speed = save.settings.speed || 1;
      this.ui = new UIGroup();
      this.pauseUI = new UIGroup();
      this.endUI = new UIGroup();
      this.looseSeeds = [];
      this.malletT = 1;
      this.belt = null;
      this.hint = null;
      this.tutorialStep = 0;
      this.selectAnims = [];
      this.flagsSurvived = 0;
      this.chosen = [];
      this.menuBtn = new Button({ x: 1132, y: 6, w: 140, h: 46, label: "\u83DC\u5355", style: "green", onClick: () => this.pause() });
      this.speedBtn = new Button({ x: 1060, y: 6, w: 64, h: 46, label: this.speed === 2 ? "\xD72" : "\xD71", style: "wood", fontSize: 20, onClick: () => this.toggleSpeed() });
      this.ui.add(this.menuBtn);
      this.ui.add(this.speedBtn);
      this.useBelt = ["conveyor", "bowling"].includes(this.mode) && !level.rain;
      this.rain = !!level.rain;
      this.fixedSeeds = this.computeFixedSeeds();
      if (this.fixedSeeds) this.maxSlots = Math.max(1, this.fixedSeeds.length);
      else this.maxSlots = Math.min(this.maxSlots, Math.max(1, PLANT_ORDER.filter((t) => save.hasPlant(t)).length));
      this.needSelect = !this.fixedSeeds && !this.useBelt && !this.rain && this.mode !== "vase";
      if (!this.needSelect && this.fixedSeeds) this.setSlots(this.fixedSeeds);
      if (this.useBelt || this.rain) this.initBelt();
      if (this.mode === "vase") this.initVases();
      if (this.mode === "whack") {
        this.board.sun = 150;
      }
    }
    computeFixedSeeds() {
      const L = this.level;
      if (L.plants) return L.plants;
      if (this.mode === "whack") {
        const want = ["cherrybomb", "gravebuster", "iceshroom", "wallnut"];
        return want.filter((t) => save.hasPlant(t)).slice(0, 3);
      }
      if (this.useBelt || this.rain || this.mode === "vase") return null;
      const avail = PLANT_ORDER.filter((t) => save.hasPlant(t));
      if (avail.length <= this.maxSlots) return avail;
      return null;
    }
    setSlots(types) {
      this.slots = types.map((type) => {
        const def = PLANTS[type];
        const startCool = def.recharge >= 30 ? def.recharge * 0.55 : 0;
        return { type, cool: startCool, coolMax: def.recharge };
      });
    }
    // ---------------- 生命周期 ----------------
    enter() {
      const b = this.board;
      if (this.mode !== "vase" && this.mode !== "whack") {
        const types = [];
        const pool = this.level.zombies.filter((t) => ZOMBIES[t]?.weight > 0);
        if (this.level.intro && ZOMBIES[this.level.intro]?.weight > 0) types.push(this.level.intro);
        const n = Math.min(11, 5 + Math.floor((this.level.waves || 10) / 4));
        while (types.length < n) types.push(weightedChoice(pool, (t) => ZOMBIES[t].weight + 500));
        const spots = [];
        for (let i = 0; i < types.length; i++) {
          let x, y, tries = 0;
          do {
            x = rand(1300, 1690);
            y = rand(LAWN_TOP + 60, H - 30);
            tries++;
          } while (tries < 30 && spots.some((s) => Math.abs(s.x - x) < 70 && Math.abs(s.y - y) < 60));
          spots.push({ x, y });
          const row = Math.max(0, Math.min(b.rows - 1, Math.floor((y - LAWN_TOP) / b.rowH)));
          const z = new ZombieProxy(b, types[i], row, x, y);
          b.previewZombies.push(z);
        }
      }
      music.play(this.needSelect ? "select" : this.envMusic());
    }
    envMusic() {
      if (["bowling", "whack", "vase"].includes(this.mode) || this.level.rain) return "minigame";
      return { night: "night", pool: "pool", fog: "fog" }[this.level.env] || "day";
    }
    exit() {
      music.setLayer("intense", 0);
    }
    // ---------------- 镜头 ----------------
    panTo(x, dur, cb) {
      this.camTween = { from: this.camX, to: x, t: 0, dur, cb };
    }
    sunCounterWorld() {
      return { x: BANK_X + 48 + this.camX, y: BANK_Y + 34 };
    }
    sunPulse() {
      this.sunPulseT = 0.25;
    }
    // ---------------- 更新 ----------------
    update(dt) {
      this.t += dt;
      if (this.sunFlash > 0) this.sunFlash -= dt;
      if (this.sunPulseT > 0) this.sunPulseT -= dt;
      if (this.malletT < 1) this.malletT = Math.min(1, this.malletT + dt * 5);
      for (const m of this.messages) m.t += dt;
      this.messages = this.messages.filter((m) => m.t < m.life);
      for (const a of this.selectAnims) a.t += dt / 0.22;
      this.selectAnims = this.selectAnims.filter((a) => a.t < 1);
      if (this.paused) return;
      if (this.camTween) {
        const tw = this.camTween;
        tw.t += dt / tw.dur;
        this.camX = lerp(tw.from, tw.to, Ease.inOutSine(clamp(tw.t, 0, 1)));
        if (tw.t >= 1) {
          this.camTween = null;
          tw.cb?.();
        }
      }
      const steps = this.phase === "play" ? this.speed : 1;
      for (let i = 0; i < steps; i++) this.step(dt);
    }
    step(dt) {
      this.phaseT += dt;
      const b = this.board;
      switch (this.phase) {
        case "intro":
          if (this.phaseT > 0.9 && !this.camTween && !this.introPanned) {
            this.introPanned = true;
            if (this.mode === "vase" || this.mode === "whack") {
              this.startPanBack(true);
              break;
            }
            this.panTo(480, 1.6, () => {
              if (this.needSelect) this.setPhase("select");
              else this.setPhase("preview");
            });
          }
          break;
        case "select":
          this.hudSlide = Math.min(1, this.hudSlide + dt * 3);
          break;
        case "preview":
          this.hudSlide = Math.min(1, this.hudSlide + dt * 3);
          if (this.phaseT > 1.6) this.startPanBack();
          break;
        case "panback":
          this.hudSlide = Math.min(1, this.hudSlide + dt * 3);
          if (!this.camTween && this.phaseT > 0.2) {
            if (b.sodT < 1 && b.sodRolling) break;
            if (!this.panDone) {
              this.panDone = true;
              this.panDoneT = this.phaseT;
            }
            if (this.phaseT - this.panDoneT > 0.5) this.setPhase("ready");
          }
          break;
        case "ready":
          if (this.phaseT >= 0 && !this.rs0) {
            this.rs0 = true;
            audio.play("ready");
          }
          if (this.phaseT >= 0.65 && !this.rs1) {
            this.rs1 = true;
            audio.play("set");
          }
          if (this.phaseT >= 1.3 && !this.rs2) {
            this.rs2 = true;
            audio.play("go");
          }
          if (this.phaseT >= 2.1) this.startPlay();
          break;
        case "play":
          this.updatePlay(dt);
          break;
        case "won":
          this.updatePlay(dt, true);
          break;
        case "award":
          this.awardT += dt;
          break;
        case "lost":
          this.hudSlide = Math.max(0, this.hudSlide - dt * 2.5);
          this.updateLost(dt);
          break;
      }
      b.update(dt);
      if (this.phase === "play" || this.phase === "won") this.updateBelt(dt);
      for (const s of this.looseSeeds) this.updateLoose(s, dt);
      this.looseSeeds = this.looseSeeds.filter((s) => !s.dead);
    }
    setPhase(p) {
      this.phase = p;
      this.phaseT = 0;
    }
    startPanBack(immediate = false) {
      this.setPhase("panback");
      this.panDone = false;
      const done = () => {
        this.board.previewZombies = [];
        this.board.moversArrive = true;
        if (this.board.newSod.length) {
          this.board.sodRolling = true;
          audio.play("sodroll");
        }
      };
      if (immediate) {
        this.camX = 0;
        done();
        return;
      }
      this.panTo(0, 1.3, done);
    }
    startPlay() {
      this.setPhase("play");
      const b = this.board;
      b.running = true;
      music.play(this.envMusic());
      if (this.level.tutorial) this.startTutorial(this.level.tutorial);
      if (this.level.tutorial === "basic") b.skyTimer = 2.5;
      if (this.mode === "vase") {
        b.noWaves = true;
        b.noWinCheck = true;
      }
    }
    updatePlay(dt, won = false) {
      for (const s of this.slots) if (s.cool > 0) s.cool = Math.max(0, s.cool - dt);
      this.progSmooth = lerp(this.progSmooth || 0, this.board.waves.progress, Math.min(1, dt * 2.5));
      if (this.mode === "vase" && !won) this.checkVaseWin();
      if (!won) this.updateTutorial(dt);
    }
    // ---------------- 传送带 / 种子雨 ----------------
    initBelt() {
      const L = this.level;
      let items;
      if (this.mode === "bowling") {
        items = [["bowl-normal", 70], ["bowl-explode", 12]];
        if (L.giant) items.push(["bowl-giant", 7]);
      } else items = L.conveyor || [["peashooter", 1]];
      this.belt = { items: [], pool: items, spawnT: 0.6, scroll: 0, max: this.mode === "bowling" ? 8 : 10, count: 0 };
    }
    beltPick() {
      const pool = this.belt.pool;
      const choice = weightedChoice(pool, ([t, w]) => {
        let ww = w;
        if (this.belt.items.filter((i) => i.type === t).length >= 3) ww *= 0.2;
        return ww;
      });
      return choice[0];
    }
    updateBelt(dt) {
      const bt = this.belt;
      if (!bt) return;
      const running = this.phase === "play";
      if (this.rain) {
        if (!running) return;
        bt.spawnT -= dt;
        if (bt.spawnT <= 0) {
          bt.spawnT = rand(2.6, 4.2);
          const type = this.beltPick();
          const r = choose(this.board.activeRows);
          this.looseSeeds.push({ type, x: rand(LAWN_X + 60, LAWN_RIGHT - 60), y: -60, ty: this.board.rowY(r) - 30, life: 11, t: 0, rain: true });
        }
        return;
      }
      bt.scroll += dt * 40;
      if (!running) return;
      bt.spawnT -= dt;
      if (bt.spawnT <= 0 && bt.items.length < bt.max) {
        bt.count++;
        bt.spawnT = this.mode === "bowling" ? rand(2.2, 3.4) : rand(3.4, 5.8) * (bt.count < 4 ? 0.6 : 1);
        bt.items.push({ type: this.beltPick(), x: this.beltRight() });
        audio.play("conveyor");
      }
      const x0 = BANK_X + 14;
      bt.items.forEach((it, i) => {
        const minX = i === 0 ? x0 : bt.items[i - 1].x + PACKET_W + 4;
        if (it.x > minX) it.x = Math.max(minX, it.x - 70 * dt);
      });
    }
    beltRight() {
      return BANK_X + 14 + 10 * (PACKET_W + 4);
    }
    updateLoose(s, dt) {
      s.t += dt;
      if (s.rain) {
        if (s.y < s.ty) s.y = Math.min(s.ty, s.y + 90 * dt);
        else s.life -= dt;
        if (s.life <= 0) s.dead = true;
      } else if (s.vy !== void 0) {
        s.vy += 800 * dt;
        s.y += s.vy * dt;
        if (s.y >= s.ty) {
          s.y = s.ty;
          s.vy = void 0;
        }
      }
    }
    // ---------------- 砸罐子 ----------------
    initVases() {
      const b = this.board;
      const cells = [];
      for (const r of b.activeRows) for (let c = 4; c < COLS; c++) cells.push([c, r]);
      shuffle(cells);
      const plantPool = ["peashooter", "repeater", "snowpea", "squash", "cherrybomb", "wallnut", "potatomine", "chomper", "threepeater", "jalapeno", "puffshroom", "fumeshroom"];
      const nPlants = 13;
      cells.forEach(([c, r], i) => {
        const plant = i < nPlants;
        const content = plant ? { type: "plant", id: choose(plantPool) } : { type: "zombie", id: choose(this.level.zombies) };
        const v = {
          col: c,
          row: r,
          x: colX(c),
          y: b.rowY(r),
          content,
          green: plant && Math.random() < 0.45,
          t: rand(0, 5),
          draw: (ctx) => drawVase(ctx, v.x, v.y, v.green, v.t, v.shake || 0)
        };
        b.cellOf(c, r).vase = v;
        b.vases.push(v);
      });
      b.skySun = false;
    }
    breakVase(v) {
      const b = this.board;
      b.cellOf(v.col, v.row).vase = null;
      b.vases = b.vases.filter((x) => x !== v);
      audio.play("vase");
      for (let i = 0; i < 16; i++) {
        b.fx.add({ type: "shard", x: v.x + rand(-20, 20), y: v.y - rand(20, 70), vx: rand(-160, 160), vy: rand(-300, -80), g: 900, size: rand(5, 10), color: v.green ? "#7ac050" : "#c89a64", stroke: "#4a3018", rot: rand(TAU), vr: rand(-10, 10), life: 0.9, ground: v.y + rand(-4, 6), bounces: 1 });
      }
      if (v.content.type === "plant") {
        this.looseSeeds.push({ type: v.content.id, x: v.x, y: v.y - 50, vy: -300, ty: v.y - 30, t: 0 });
      } else {
        const z = b.spawnZombie(v.content.id, v.row, v.x + 10);
        z.walkPh = 0;
      }
    }
    checkVaseWin() {
      const b = this.board;
      if (b.won || b.lost) return;
      if (b.vases.length === 0 && !b.zombies.some((z) => z.isEnemy && z.alive)) {
        b.won = true;
        this.onWin(b.lastKill || { x: 800, y: b.rowY(2) });
      }
    }
    // ---------------- 教程 ----------------
    startTutorial(kind) {
      this.tutorial = kind;
      this.tutorialStep = 0;
      this.tutorialT = 0;
      const hints = {
        sunflower: "\u5411\u65E5\u8475\u80FD\u6E90\u6E90\u4E0D\u65AD\u5730\u751F\u4EA7\u9633\u5149\uFF0C\u5C3D\u65E9\u591A\u79CD\u51E0\u682A\u5427\uFF01",
        cherry: "\u6A31\u6843\u70B8\u5F39\u5A01\u529B\u5DE8\u5927\uFF0C\u7559\u7740\u5BF9\u4ED8\u6210\u7FA4\u7684\u50F5\u5C38\uFF01",
        shovel: "\u79CD\u9519\u4E86\uFF1F\u70B9\u51FB\u79CD\u5B50\u69FD\u53F3\u8FB9\u7684\u94F2\u5B50\uFF0C\u5C31\u80FD\u6316\u6389\u4E0D\u9700\u8981\u7684\u690D\u7269\u3002",
        night: "\u591C\u665A\u6CA1\u6709\u9633\u5149\u4ECE\u5929\u800C\u964D\uFF0C\u8611\u83C7\u4EEC\u5374\u7CBE\u795E\u6296\u64DE\uFF01\u8BD5\u8BD5\u9633\u5149\u83C7\u548C\u5C0F\u55B7\u83C7\u3002",
        pool: "\u6C34\u9762\u4E0A\u8981\u5148\u79CD\u7761\u83B2\uFF0C\u624D\u80FD\u79CD\u4E0B\u5176\u4ED6\u690D\u7269\u3002\u6C34\u91CC\u7684\u50F5\u5C38\u4F1A\u5957\u7740\u6551\u751F\u5708\u6E38\u8FC7\u6765\uFF01",
        fog: "\u6D53\u96FE\u906E\u4F4F\u4E86\u53F3\u4FA7\u7684\u8349\u576A\uFF01\u7528\u8DEF\u706F\u82B1\u7167\u4EAE\u96FE\u533A\uFF0C\u6216\u79CD\u4E0B\u4E09\u53F6\u8349\u5439\u6563\u6D53\u96FE\u3002\u6C14\u7403\u50F5\u5C38\u53EA\u80FD\u7528\u4ED9\u4EBA\u638C\u6216\u4E09\u53F6\u8349\u5BF9\u4ED8\u3002"
      };
      if (kind !== "basic") this.showHint(hints[kind], 8);
    }
    updateTutorial(dt) {
      if (this.tutorial !== "basic") return;
      this.tutorialT += dt;
      const b = this.board;
      const hasPea = b.plants.some((p) => p.type === "peashooter");
      if (hasPea && this.tutorialStep < 2) {
        this.tutorialStep = 2;
        this.tutorialT = 0;
      }
      if (this.tutorialStep === 0) {
        this.hint = { text: "\u70B9\u51FB\u5DE6\u4E0A\u89D2\u7684\u8C4C\u8C46\u5C04\u624B\u5361\u7247\uFF0C\u628A\u5B83\u62FF\u8D77\u6765\u3002", arrow: { x: slotX(0) + PACKET_W / 2, y: SLOT_Y + PACKET_H + 12, dir: "up" } };
        if (this.held) this.tutorialStep = 1;
      } else if (this.tutorialStep === 1) {
        this.hint = { text: "\u70B9\u51FB\u8349\u576A\uFF0C\u628A\u8C4C\u8C46\u5C04\u624B\u79CD\u5728\u4E0A\u9762\uFF01", arrow: { x: colX(1) - this.camX, y: b.rowY(2) - 70, dir: "down" } };
        if (!this.held && !hasPea) this.tutorialStep = 0;
        if (hasPea) {
          this.tutorialStep = 2;
          this.tutorialT = 0;
        }
      } else if (this.tutorialStep === 2) {
        const s = b.suns[0];
        this.hint = { text: "\u70B9\u51FB\u6389\u843D\u7684\u9633\u5149\u6765\u6536\u96C6\u5B83\uFF01\u9633\u5149\u662F\u79CD\u690D\u690D\u7269\u7684\u8D27\u5E01\u3002", arrow: s && s.state !== "collect" ? { x: s.x - this.camX, y: s.y - 40, dir: "down" } : null };
        if (b.sun >= 100 && this.tutorialT > 2) {
          this.tutorialStep = 3;
          this.tutorialT = 0;
        }
      } else if (this.tutorialStep === 3) {
        this.hint = { text: "\u592A\u68D2\u4E86\uFF01\u7EE7\u7EED\u79CD\u690D\u8C4C\u8C46\u5C04\u624B\uFF0C\u522B\u8BA9\u50F5\u5C38\u9760\u8FD1\u4F60\u7684\u623F\u5B50\uFF01", arrow: null };
        if (this.tutorialT > 7) {
          this.tutorialStep = 4;
          this.hint = null;
        }
      }
    }
    showHint(str, dur = 5) {
      this.hint = { text: str, arrow: null, until: this.t + dur };
    }
    // ---------------- 消息 ----------------
    showMessage(kind) {
      this.messages.push({ kind, t: 0, life: kind === "huge" ? 4.5 : kind === "final" ? 3 : 3 });
    }
    onSurvivalFlag(n) {
      this.flagsSurvived = n;
      this.board.fx.floatText(640 + this.camX, 300, `\u5DF2\u575A\u6301 ${n} \u65D7\uFF01`, { size: 40, color: "#ffe23a", stroke: "#5a2a00", life: 2.2 });
      const best = save.data.survival[this.level.id] || 0;
      if (n > best) {
        save.data.survival[this.level.id] = n;
        save.write();
      }
    }
    // ---------------- 胜负 ----------------
    rewardFor() {
      const L = this.level;
      if (this.o.source === "adventure" && L.reward) {
        if (L.reward.type === "plant" && save.hasPlant(L.reward.id)) return { type: "trophy", replay: true };
        return L.reward;
      }
      return { type: "trophy" };
    }
    onWin(pos) {
      if (this.phase === "lost") return;
      this.setPhase("won");
      this.held = null;
      const reward = this.rewardFor();
      const r = new Reward(this.board, pos.x, pos.y, reward);
      this.board.rewards.push(r);
      music.stop(2.5);
      audio.play("flag");
      setTimeout(() => {
        if (this.phase === "won") this.showHint("\u70B9\u51FB\u5956\u52B1\uFF0C\u9886\u53D6\u6218\u5229\u54C1\uFF01", 99);
      }, 2500);
    }
    collectReward(r) {
      this.setPhase("award");
      this.awardT = 0;
      this.awardReward = r;
      this.awardFrom = { x: r.x - this.camX, y: r.y };
      this.board.rewards = [];
      this.hint = null;
      audio.play("award");
      this.saveProgress(r.reward);
      setTimeout(() => {
        director.go(new Scenes2.AwardScene(this.level, r.reward, this.o), { color: "#fff", speed: 1.4 });
      }, 1700);
    }
    saveProgress(reward) {
      const d = save.data;
      const L = this.level;
      d.completed[L.id] = true;
      if (this.o.source === "adventure") {
        const idx = levelIndex(L.id);
        if (idx >= 0 && d.adventure <= idx) d.adventure = idx + 1;
        if (reward.type === "plant") save.unlockPlant(reward.id);
      } else if (this.o.source === "minigame") {
        d.minigames[L.id] = { won: true };
      }
      save.write();
    }
    onLose(z) {
      if (this.phase === "lost") return;
      this.setPhase("lost");
      this.loseZ = z;
      this.held = null;
      this.hint = null;
      this.board.running = false;
      music.stop(0.3);
      audio.play("lose");
      this.panTo(-230, 2.2);
      if (this.mode === "survival") {
        const best = save.data.survival[this.level.id] || 0;
        if (this.flagsSurvived > best) {
          save.data.survival[this.level.id] = this.flagsSurvived;
          save.write();
        }
      }
    }
    updateLost(dt) {
      const z = this.loseZ;
      if (z && !z.dead) {
        z.t += dt;
        if (z.x > 10) {
          z.x -= 26 * dt;
          z.walkPh += dt * 4.4;
          z.anim = "walk";
          z.state = "walk";
        } else {
          z.alpha = Math.max(0, z.alpha - dt * 1.5);
        }
      }
      if (this.phaseT > 4.2 && !this.endShown) {
        this.endShown = true;
        this.endUI.clear();
        this.endUI.add(new Button({ x: 440, y: 520, w: 190, h: 60, label: "\u518D\u8BD5\u4E00\u6B21", style: "green", onClick: () => this.restart() }));
        this.endUI.add(new Button({ x: 650, y: 520, w: 190, h: 60, label: "\u8FD4\u56DE", style: "stone", onClick: () => this.quit() }));
      }
    }
    restart() {
      director.go(new _GameScene(this.level, this.o));
    }
    quit() {
      music.stop(0.5);
      const S = Scenes2;
      if (this.o.source === "adventure") director.go(new S.LevelSelectScene());
      else if (this.o.source === "minigame") director.go(new S.MinigameScene());
      else if (this.o.source === "survival") director.go(new S.MinigameScene("survival"));
      else director.go(new S.MenuScene());
    }
    // ---------------- 暂停 ----------------
    pause() {
      if (this.paused || this.phase === "lost" || this.phase === "award") return;
      this.paused = true;
      audio.play("pause");
      const s = save.settings;
      const ui = this.pauseUI;
      ui.clear();
      const cx = 640;
      ui.add(new Slider({ x: cx - 60, y: 240, w: 220, label: "\u97F3\u4E50", value: s.music, onChange: (v) => {
        s.music = v;
        audio.applyVolumes();
        save.write();
      } }));
      ui.add(new Slider({ x: cx - 60, y: 290, w: 220, label: "\u97F3\u6548", value: s.sfx, onChange: (v) => {
        s.sfx = v;
        audio.applyVolumes();
        save.write();
      } }));
      ui.add(new Toggle({ x: cx - 60, y: 345, label: "\u81EA\u52A8\u6536\u96C6\u9633\u5149", value: s.autoCollect, onChange: (v) => {
        s.autoCollect = v;
        this.board.autoCollect = v;
        save.write();
      } }));
      ui.add(new Toggle({ x: cx + 170, y: 345, label: "\u8840\u91CF\u6761", value: s.healthBars, onChange: (v) => {
        s.healthBars = v;
        this.board.showHealth = v;
        save.write();
      } }));
      ui.add(new Button({ x: cx - 150, y: 400, w: 300, h: 56, label: "\u7EE7\u7EED\u6E38\u620F", style: "green", onClick: () => this.resume() }));
      ui.add(new Button({ x: cx - 150, y: 466, w: 145, h: 50, label: "\u91CD\u65B0\u5F00\u59CB", style: "wood", fontSize: 21, onClick: () => this.restart() }));
      ui.add(new Button({ x: cx + 5, y: 466, w: 145, h: 50, label: "\u4E3B\u83DC\u5355", style: "stone", fontSize: 21, onClick: () => this.quit() }));
    }
    resume() {
      this.paused = false;
      audio.play("unpause");
    }
    toggleSpeed() {
      this.speed = this.speed === 1 ? 2 : 1;
      save.settings.speed = this.speed;
      save.write();
      this.speedBtn.label = this.speed === 2 ? "\xD72" : "\xD71";
    }
    // ---------------- 输入 ----------------
    get worldX() {
      return this.mx + this.camX;
    }
    slotAt(x, y) {
      if (this.useBelt) {
        const bt = this.belt;
        for (let i = 0; i < bt.items.length; i++) {
          const it = bt.items[i];
          if (x >= it.x && x <= it.x + PACKET_W && y >= SLOT_Y && y <= SLOT_Y + PACKET_H) return i;
        }
        return -1;
      }
      for (let i = 0; i < this.slots.length; i++) {
        const sx = slotX(i);
        if (x >= sx && x <= sx + PACKET_W && y >= SLOT_Y && y <= SLOT_Y + PACKET_H) return i;
      }
      return -1;
    }
    get shovelX() {
      return this.useBelt ? this.beltRight() + 24 : this.mode === "vase" || this.rain ? 10 : slotX(this.maxSlots) + 12;
    }
    get hasShovel() {
      return this.mode !== "bowling" && this.mode !== "whack";
    }
    shovelHit(x, y) {
      return this.hasShovel && x >= this.shovelX && x <= this.shovelX + 78 && y >= 8 && y <= 86;
    }
    pointerMove(x, y) {
      this.mx = x;
      this.my = y;
      let cursor = "default";
      if (this.paused) {
        this.pauseUI.move(x, y);
        return;
      }
      if (this.phase === "lost") {
        this.endUI.move(x, y);
        return;
      }
      if (this.phase === "select") this.selectMove(x, y);
      if (this.ui.move(x, y)) cursor = "pointer";
      if (this.phase === "play" || this.phase === "won") {
        if (this.slotAt(x, y) >= 0 || this.shovelHit(x, y)) cursor = "pointer";
        const wx = x + this.camX;
        if (this.board.suns.some((s) => s.hitTest(wx, y)) || this.board.rewards.some((r) => r.hitTest(wx, y))) cursor = "pointer";
        if (this.board.vases.some((v) => Math.abs(v.x - wx) < 38 && y > v.y - 90 && y < v.y + 5)) cursor = "pointer";
        if (this.looseSeeds.some((s) => Math.abs(s.x - wx) < 34 && Math.abs(s.y - y) < 44)) cursor = "pointer";
        if (this.held) cursor = "none";
        if (this.mode === "whack" && !this.held && y > 100) cursor = "none";
      }
      display.setCursor(cursor);
    }
    pointerDown(x, y, btn) {
      this.mx = x;
      this.my = y;
      if (this.paused) {
        this.pauseUI.down(x, y);
        return;
      }
      if (this.phase === "lost") {
        this.endUI.down(x, y);
        return;
      }
      if ((this.phase === "play" || this.phase === "won") && this.ui.down(x, y)) return;
      if (this.phase === "select") return this.selectDown(x, y);
      if (this.phase !== "play" && this.phase !== "won") return;
      if (btn === 2) {
        this.cancelHeld();
        return;
      }
      const b = this.board;
      const wx = x + this.camX;
      for (const r of b.rewards) if (r.hitTest(wx, y)) {
        this.collectReward(r);
        return;
      }
      for (let i = b.suns.length - 1; i >= 0; i--) if (b.suns[i].hitTest(wx, y)) {
        b.suns[i].collect();
        return;
      }
      const si = this.slotAt(x, y);
      if (si >= 0) return this.clickSlot(si);
      if (this.shovelHit(x, y)) {
        if (this.held?.kind === "shovel") this.held = null;
        else {
          this.cancelHeld();
          this.held = { kind: "shovel" };
          audio.play("seedlift");
        }
        return;
      }
      if (!this.held) {
        for (const s of this.looseSeeds) {
          if (Math.abs(s.x - wx) < 34 && Math.abs(s.y - y) < 44) {
            this.held = { kind: "loose", seed: s, type: s.type };
            s.picked = true;
            audio.play("seedlift");
            return;
          }
        }
        for (const v of b.vases) {
          if (Math.abs(v.x - wx) < 38 && y > v.y - 90 && y < v.y + 5) {
            this.breakVase(v);
            return;
          }
        }
      }
      if (this.phase !== "play") return;
      if (this.held) return this.useHeld(wx, y);
      if (this.mode === "whack" && y > 100) {
        this.malletT = 0;
        audio.play("whack");
        b.whackAt(wx, y);
      }
    }
    pointerUp(x, y) {
      if (this.paused) {
        this.pauseUI.up(x, y);
        return;
      }
      if (this.phase === "lost") {
        this.endUI.up(x, y);
        return;
      }
      if (this.phase === "play" || this.phase === "won") this.ui.up(x, y);
      if (this.phase === "select") this.selectUp(x, y);
    }
    key(k) {
      if (k === "Escape" || k === " " || k === "p" || k === "P") {
        if (this.held && k === "Escape") {
          this.cancelHeld();
          return;
        }
        if (this.paused) this.resume();
        else if (this.phase === "play") this.pause();
        return;
      }
      if (this.phase !== "play") return;
      if (k >= "1" && k <= "9" || k === "0") {
        const i = k === "0" ? 9 : +k - 1;
        if (this.useBelt ? i < this.belt.items.length : i < this.slots.length) this.clickSlot(i);
      }
      if ((k === "s" || k === "S") && this.hasShovel) {
        if (this.held?.kind === "shovel") this.held = null;
        else {
          this.cancelHeld();
          this.held = { kind: "shovel" };
        }
      }
      if (k === "x" || k === "X") this.toggleSpeed();
    }
    cancelHeld() {
      if (!this.held) return;
      if (this.held.kind === "loose") this.held.seed.picked = false;
      this.held = null;
      audio.play("tap");
    }
    clickSlot(i) {
      const b = this.board;
      if (this.phase !== "play") return;
      if (this.held?.kind === "loose") this.cancelHeld();
      if (this.useBelt) {
        const it = this.belt.items[i];
        if (this.held?.kind === "belt" && this.held.item === it) {
          this.held = null;
          return;
        }
        this.held = { kind: "belt", item: it, type: it.type };
        audio.play("seedlift");
        return;
      }
      const s = this.slots[i];
      if (this.held?.kind === "seed" && this.held.slot === s) {
        this.held = null;
        audio.play("tap");
        return;
      }
      const cost = PLANTS[s.type].cost;
      if (s.cool > 0) {
        audio.play("buzzer");
        return;
      }
      if (b.sun < cost) {
        audio.play("buzzer");
        this.sunFlash = 0.6;
        return;
      }
      this.held = { kind: "seed", slot: s, type: s.type };
      audio.play("seedlift");
    }
    useHeld(wx, y) {
      const b = this.board;
      const h = this.held;
      const cell = b.cellAt(wx, y);
      if (h.kind === "shovel") {
        if (cell && b.shovel(cell.col, cell.row)) this.held = null;
        else this.held = null;
        return;
      }
      if (!cell) {
        this.cancelHeld();
        return;
      }
      const type = h.type;
      if (type.startsWith("bowl-")) {
        const chk2 = b.canPlant("wallnut", cell.col, cell.row);
        if (!chk2.ok) {
          audio.play("buzzer");
          if (chk2.reason) this.flashReason(chk2.reason);
          return;
        }
        b.launchBowl(type.slice(5), cell.col, cell.row);
        this.belt.items = this.belt.items.filter((i) => i !== h.item);
        this.held = null;
        return;
      }
      const chk = b.canPlant(type, cell.col, cell.row);
      if (!chk.ok) {
        audio.play("buzzer");
        if (chk.reason) this.flashReason(chk.reason);
        return;
      }
      if (h.kind === "seed") {
        const cost = PLANTS[type].cost;
        if (b.sun < cost) {
          audio.play("buzzer");
          this.held = null;
          return;
        }
        b.sun -= cost;
        h.slot.cool = h.slot.coolMax;
      } else if (h.kind === "belt") {
        this.belt.items = this.belt.items.filter((i) => i !== h.item);
      } else if (h.kind === "loose") {
        h.seed.dead = true;
      }
      b.placePlant(type, cell.col, cell.row);
      this.held = null;
    }
    flashReason(r) {
      this.reasonMsg = { text: r, t: this.t };
    }
    // ---------------- 选卡 ----------------
    get selectPanel() {
      return { x: 14, y: 110, w: 624, h: 596 };
    }
    availablePlants() {
      return PLANT_ORDER.filter((t) => save.hasPlant(t));
    }
    get gridLayout() {
      const n = this.availablePlants().length;
      return n > 32 ? { cols: 9, sx: 64, sy: 80, sc: 0.86 } : { cols: 8, sx: 72, sy: 92, sc: 1 };
    }
    gridPos(i) {
      const p = this.selectPanel;
      const L = this.gridLayout;
      return { x: p.x + (L.cols === 9 ? 26 : 28) + i % L.cols * L.sx, y: p.y + 56 + Math.floor(i / L.cols) * L.sy, s: L.sc };
    }
    get rockBtn() {
      if (!this._rock) {
        const p = this.selectPanel;
        this._rock = new Button({ x: p.x + p.w / 2 - 130, y: p.y + p.h - 72, w: 260, h: 58, label: "\u4E00\u8D77\u6447\u6EDA\u5427\uFF01", style: "red", onClick: () => this.confirmSelect() });
      }
      const need = Math.min(this.maxSlots, this.availablePlants().length);
      this._rock.disabled = this.chosen.length < need;
      return this._rock;
    }
    selectMove(x, y) {
      const rb = this.rockBtn;
      const h = rb.hit(x, y) && !rb.disabled;
      if (h && !rb.hover) audio.play("hover");
      rb.hover = h;
      this.selHover = null;
      this.availablePlants().forEach((t, i) => {
        const g = this.gridPos(i);
        if (x >= g.x && x <= g.x + PACKET_W * g.s && y >= g.y && y <= g.y + PACKET_H * g.s) this.selHover = t;
      });
      if (h || this.selHover) display.setCursor("pointer");
    }
    selectDown(x, y) {
      const rb = this.rockBtn;
      if (rb.hit(x, y) && !rb.disabled) {
        rb.pressed = true;
        return;
      }
      for (let i = 0; i < this.chosen.length; i++) {
        const sx = slotX(i);
        if (x >= sx && x <= sx + PACKET_W && y >= SLOT_Y && y <= SLOT_Y + PACKET_H) {
          const t = this.chosen[i];
          this.chosen.splice(i, 1);
          const gi = this.availablePlants().indexOf(t);
          const g = this.gridPos(gi);
          this.selectAnims.push({ type: t, x0: sx, y0: SLOT_Y, x1: g.x, y1: g.y, t: 0 });
          audio.play("tap");
          return;
        }
      }
      const av = this.availablePlants();
      for (let i = 0; i < av.length; i++) {
        const g = this.gridPos(i);
        if (x >= g.x && x <= g.x + PACKET_W * g.s && y >= g.y && y <= g.y + PACKET_H * g.s) {
          const t = av[i];
          if (this.chosen.includes(t)) return;
          if (this.chosen.length >= this.maxSlots) {
            audio.play("buzzer");
            return;
          }
          const si = this.chosen.length;
          this.chosen.push(t);
          this.selectAnims.push({ type: t, x0: g.x, y0: g.y, x1: slotX(si), y1: SLOT_Y, t: 0, toBank: true });
          audio.play("seedlift");
          return;
        }
      }
    }
    selectUp(x, y) {
      const rb = this.rockBtn;
      if (rb.pressed) {
        rb.pressed = false;
        if (rb.hit(x, y) && !rb.disabled) {
          audio.play("button");
          rb.onClick();
        }
      }
    }
    confirmSelect() {
      this.setSlots(this.chosen.slice());
      music.play(this.envMusic());
      this.startPanBack();
    }
    // ---------------- 绘制 ----------------
    draw(ctx) {
      const b = this.board;
      ctx.save();
      const sh2 = b.shakeAmt;
      if (sh2 > 0) ctx.translate(rand(-sh2, sh2) * 0.6, rand(-sh2, sh2) * 0.6);
      ctx.translate(-this.camX, 0);
      b.draw(ctx, this.camX);
      this.drawHeldGhost(ctx);
      for (const s of this.looseSeeds) this.drawLoose(ctx, s);
      b.drawTop(ctx);
      ctx.restore();
      this.drawHUD(ctx);
      this.drawMessages(ctx);
      if (this.phase === "select" || this.phase === "panback" && this.phaseT < 0.5 && this.needSelect) this.drawSelect(ctx);
      if (this.phase === "ready") this.drawReady(ctx);
      if (this.phase === "intro" || this.phase === "preview") this.drawBanner(ctx);
      if (this.phase === "award") this.drawAward(ctx);
      if (this.phase === "lost") this.drawLost(ctx);
      this.drawHint(ctx);
      this.drawHeldCursor(ctx);
      if (this.paused) this.drawPause(ctx);
    }
    drawCellHighlight(ctx) {
      if (!this.held || this.phase !== "play") return;
      const b = this.board;
      const cell = b.cellAt(this.worldX, this.my);
      if (!cell || !b.activeRow(cell.row)) return;
      ctx.save();
      ctx.fillStyle = "rgba(255,255,255,0.1)";
      ctx.fillRect(LAWN_X, b.rowTop(cell.row), COLS * COL_W, b.rowH);
      const r0 = Math.min(...b.activeRows), r1 = Math.max(...b.activeRows);
      ctx.fillRect(LAWN_X + cell.col * COL_W, b.rowTop(r0), COL_W, (r1 - r0 + 1) * b.rowH);
      ctx.restore();
    }
    drawHeldGhost(ctx) {
      const h = this.held;
      if (!h || this.phase !== "play" || h.kind === "shovel") {
        if (h?.kind === "shovel") {
          const b2 = this.board;
          const cell2 = b2.cellAt(this.worldX, this.my);
          if (cell2) {
            const c = b2.cellOf(cell2.col, cell2.row);
            const p = c.overlay || c.main || c.base;
            if (p) {
              ctx.save();
              ctx.globalCompositeOperation = "lighter";
              ctx.globalAlpha = 0.25 + 0.1 * Math.sin(this.t * 10);
              E(ctx, p.x, p.y - 30, 44, 50);
              ctx.fillStyle = "#fff";
              ctx.fill();
              ctx.restore();
            }
          }
        }
        return;
      }
      const b = this.board;
      const cell = b.cellAt(this.worldX, this.my);
      if (!cell) return;
      const type = h.type;
      const chk = type.startsWith("bowl-") ? b.canPlant("wallnut", cell.col, cell.row) : b.canPlant(type, cell.col, cell.row);
      if (!chk.ok) return;
      const x = colX(cell.col), y = b.rowY(cell.row) - (b.cellOf(cell.col, cell.row).base && type !== "lilypad" ? 10 : 0);
      ctx.save();
      ctx.globalAlpha = 0.45;
      ctx.translate(x, y);
      if (type === "coffeebean") ctx.translate(0, -70);
      if (type.startsWith("bowl-")) bowlnut(ctx, { roll: 0 }, type.slice(5));
      else PLANT_ART[type]?.(ctx, { t: this.t, phase: 0, icon: true, armed: true, rise: 1 });
      ctx.restore();
    }
    drawHeldCursor(ctx) {
      const h = this.held;
      if (this.mode === "whack" && !h && (this.phase === "play" || this.phase === "won") && this.my > 100) {
        drawMallet(ctx, this.mx, this.my, this.malletT);
      }
      if (!h || this.phase !== "play" && this.phase !== "won") return;
      ctx.save();
      ctx.translate(this.mx, this.my);
      if (h.kind === "shovel") {
        drawShovel(ctx, 14, -18, 1.1, -0.6);
      } else {
        ctx.translate(0, 34);
        ctx.scale(0.85, 0.85);
        if (h.type === "coffeebean") ctx.translate(0, -20);
        if (h.type.startsWith("bowl-")) bowlnut(ctx, { roll: 0 }, h.type.slice(5));
        else PLANT_ART[h.type]?.(ctx, { t: this.t, phase: 0, icon: true, armed: true, rise: 1 });
      }
      ctx.restore();
    }
    drawLoose(ctx, s) {
      if (s.picked || s.dead) return;
      const blink = s.rain && s.life < 3 ? Math.sin(s.t * 14) > 0 ? 1 : 0.35 : 1;
      ctx.save();
      ctx.globalAlpha = blink;
      ctx.translate(s.x, s.y + Math.sin(s.t * 3) * 3);
      ctx.rotate(Math.sin(s.t * 2) * 0.06);
      drawPacket(ctx, -27, -38, s.type, { scale: 0.88, noCost: true });
      ctx.restore();
    }
    drawHUD(ctx) {
      const b = this.board;
      const slide = Ease.outCubic(this.hudSlide);
      const oy = -120 * (1 - slide);
      const showBank = this.phase !== "intro" || this.hudSlide > 0;
      ctx.save();
      ctx.translate(0, oy);
      if (showBank && this.mode !== "vase" && !this.rain) {
        if (this.useBelt) this.drawBelt(ctx);
        else {
          drawSeedBank(ctx, BANK_X, BANK_Y, this.maxSlots);
          const pulse = this.sunPulseT > 0 ? 1 + this.sunPulseT * 0.6 : 1;
          drawSun(ctx, BANK_X + 48, BANK_Y + 34, 21 * pulse, this.t);
          const red = this.sunFlash > 0 && Math.sin(this.sunFlash * 30) > 0;
          text(ctx, String(b.sun), BANK_X + 48, BANK_Y + 77, { size: 20, color: red ? "#e02010" : "#1a1206", weight: 900 });
          const list = this.phase === "select" || this.phase === "panback" && !this.slots.length ? this.chosen.map((t) => ({ type: t, cool: 0, coolMax: 1, sel: true })) : this.slots;
          list.forEach((s, i) => {
            if (this.selectAnims.some((a) => a.toBank && a.type === s.type)) return;
            const cost = PLANTS[s.type].cost;
            const hover = this.slotAt(this.mx, this.my) === i && this.phase === "play";
            const disabled = !s.sel && this.phase === "play" && (b.sun < cost || s.cool > 0);
            drawPacket(ctx, slotX(i), SLOT_Y, s.type, {
              recharge: s.cool > 0 ? s.cool / s.coolMax : 0,
              disabled,
              hover,
              selected: this.held?.kind === "seed" && this.held.slot === s
            });
            if (s.sel && this.phase === "select" && this.mx >= slotX(i) && this.mx <= slotX(i) + PACKET_W && this.my <= SLOT_Y + PACKET_H) {
              ctx.save();
              ctx.globalCompositeOperation = "lighter";
              rr(ctx, slotX(i), SLOT_Y, PACKET_W, PACKET_H, 6);
              ctx.fillStyle = "rgba(255,255,200,0.2)";
              ctx.fill();
              ctx.restore();
            }
          });
        }
      }
      if (showBank && this.hasShovel && this.phase !== "select") drawShovelBox(ctx, this.shovelX, 8, this.shovelHit(this.mx, this.my), this.held?.kind === "shovel");
      ctx.restore();
      for (const a of this.selectAnims) {
        const k = Ease.outQuad(clamp(a.t, 0, 1));
        drawPacket(ctx, lerp(a.x0, a.x1, k), lerp(a.y0, a.y1, k) - Math.sin(k * Math.PI) * 30, a.type, {});
      }
      if (this.phase === "play" || this.phase === "won") {
        this.ui.draw(ctx);
        this.drawProgress(ctx);
        this.drawPacketTip(ctx);
      }
      if (this.reasonMsg && this.t - this.reasonMsg.t < 1.6) {
        const a = clamp(1.6 - (this.t - this.reasonMsg.t), 0, 1);
        ctx.save();
        ctx.globalAlpha = a;
        text(ctx, this.reasonMsg.text, this.mx, this.my - 60, { size: 20, color: "#fff", stroke: "#5a0000", lw: 5 });
        ctx.restore();
      }
    }
    drawPacketTip(ctx) {
      if (this.held || this.useBelt) return;
      const i = this.slotAt(this.mx, this.my);
      if (i < 0) return;
      const sl = this.slots[i];
      const d = PLANTS[sl.type];
      let status = "";
      if (sl.cool > 0) status = "\u51B7\u5374\u4E2D\u2026\u2026";
      else if (this.board.sun < d.cost) status = "\u9633\u5149\u4E0D\u8DB3";
      else if (d.night && !this.board.isNight) status = "\u767D\u5929\u4F1A\u7761\u89C9";
      const x = slotX(i) + PACKET_W / 2, y = SLOT_Y + PACKET_H + 8;
      ctx.save();
      ctx.font = `800 17px ${FONT}`;
      const w = Math.max(ctx.measureText(d.name).width, status ? ctx.measureText(status).width * 0.85 : 0) + 26;
      const h = status ? 50 : 32;
      const bx = Math.max(6, x - w / 2);
      rr(ctx, bx, y, w, h, 8);
      fs(ctx, "rgba(255,250,225,0.96)", "#5a4418", 2);
      text(ctx, d.name, bx + w / 2, y + 16, { size: 17, color: "#3a2408", weight: 800 });
      if (status) text(ctx, status, bx + w / 2, y + 36, { size: 14, color: "#b02a10", weight: 800 });
      ctx.restore();
    }
    drawBelt(ctx) {
      const bt = this.belt;
      const x = BANK_X, y = BANK_Y, w = this.beltRight() - BANK_X + 10, h = 98;
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      rr(ctx, x + 3, y + 4, w, h, 10);
      ctx.fill();
      rr(ctx, x, y, w, h, 10);
      fs(ctx, lg(ctx, 0, y, 0, y + h, [0, "#7a7e86", 1, "#3a3e46"]), "#1a1c20", 2.5);
      rr(ctx, x + 8, y + 8, w - 16, h - 16, 6);
      fs(ctx, "#2a2c30", "#111", 1.5);
      ctx.save();
      rr(ctx, x + 8, y + 8, w - 16, h - 16, 6);
      ctx.clip();
      ctx.fillStyle = "rgba(255,255,255,0.07)";
      const off = bt.scroll % 24;
      for (let sx = x + 8 - off; sx < x + w; sx += 24) ctx.fillRect(sx, y + 8, 10, h - 16);
      ctx.restore();
      for (const cx of [x + 8, x + w - 8]) {
        C(ctx, cx, y + h / 2, 9);
        fs(ctx, "#8a8e96", "#222", 1.5);
      }
      ctx.restore();
      bt.items.forEach((it, i) => {
        const sel = this.held?.kind === "belt" && this.held.item === it;
        drawPacket(ctx, it.x, SLOT_Y, it.type, { noCost: true, selected: sel, hover: this.slotAt(this.mx, this.my) === i });
      });
    }
    drawProgress(ctx) {
      const b = this.board;
      const L = this.level;
      const x = 1010, y = 686, w = 250, h = 22;
      if (this.mode === "vase") {
        text(ctx, `\u5269\u4F59\u7F50\u5B50\uFF1A${b.vases.length}`, 1130, 698, { size: 20, color: "#fff", stroke: "#000", lw: 4 });
        return;
      }
      if (this.mode === "survival") {
        text(ctx, `${L.title}  \u5DF2\u575A\u6301 ${this.flagsSurvived} \u65D7`, 1240, 698, { size: 18, color: "#fff", stroke: "#000", lw: 4, align: "right" });
        return;
      }
      const wv = b.waves;
      const name = L.title ? L.title : `\u5173\u5361 ${L.id}`;
      text(ctx, name, x - 12, y + h / 2, { size: 18, color: "#fff", stroke: "#1a1a1a", lw: 4, align: "right" });
      rr(ctx, x, y, w, h, 11);
      fs(ctx, "rgba(20,20,20,0.75)", "#e8e0c0", 2);
      const p = clamp(wv.progress, 0, 1);
      if (this.progSmooth === void 0) this.progSmooth = p;
      const pw = (w - 6) * this.progSmooth;
      rr(ctx, x + 3 + (w - 6) - pw, y + 3, pw, h - 6, 8);
      fs(ctx, lg(ctx, 0, y, 0, y + h, [0, "#b8f070", 1, "#4f9a22"]));
      for (let i = 0; i < wv.total; i++) {
        if (!wv.isFlagWave(i)) continue;
        const fx = x + w - 3 - (i + 1) / wv.total * (w - 6) + 4;
        const raised = wv.wave > i;
        ctx.save();
        ctx.translate(fx, y + 4 - (raised ? 6 : 0));
        ctx.fillStyle = "#6a4a2a";
        ctx.fillRect(-1, -14, 3, 22);
        ctx.fillStyle = raised ? "#e02020" : "#9a2020";
        ctx.beginPath();
        ctx.moveTo(2, -14);
        ctx.lineTo(16, -9);
        ctx.lineTo(2, -4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      const hx = x + w - 3 - pw;
      ctx.save();
      ctx.translate(hx, y + h / 2);
      C(ctx, 0, 0, 12);
      fs(ctx, rg(ctx, -3, -4, 1, 0, 0, 13, [0, "#c8d6b0", 1, "#7a8e6a"]), "#2f3a26", 1.8);
      C(ctx, -4, -2, 3.2);
      fs(ctx, "#fff", "#2f3a26", 1);
      C(ctx, 3, -2, 2.6);
      fs(ctx, "#fff", "#2f3a26", 1);
      ctx.fillStyle = "#3a1a14";
      ctx.fillRect(-5, 4, 7, 3);
      ctx.restore();
    }
    drawMessages(ctx) {
      for (const m of this.messages) {
        const k = m.t / m.life;
        const a = k < 0.1 ? k / 0.1 : k > 0.85 ? (1 - k) / 0.15 : 1;
        ctx.save();
        ctx.globalAlpha = a;
        if (m.kind === "huge") {
          const sh2 = 2.5;
          text(ctx, "\u4E00\u5927\u6CE2\u50F5\u5C38\u6B63\u5728\u63A5\u8FD1\uFF01", 640 + rand(-sh2, sh2), 400 + rand(-sh2, sh2), { size: 52, color: "#e8201a", stroke: "#1a0000", lw: 10, shadow: "rgba(0,0,0,0.5)" });
        } else if (m.kind === "final") {
          const s = 1 + Math.max(0, 0.6 - m.t * 2.5) * 1.5;
          ctx.translate(640, 380);
          ctx.scale(s, s);
          text(ctx, "\u6700\u540E\u4E00\u6CE2\uFF01", 0, 0, { size: 76, color: "#ff2a1a", stroke: "#1a0000", lw: 13, shadow: "rgba(0,0,0,0.5)" });
        }
        ctx.restore();
      }
    }
    drawBanner(ctx) {
      const L = this.level;
      const t = this.phase === "intro" ? this.phaseT : this.phaseT + 2.5;
      const a = clamp(t / 0.4, 0, 1) * clamp((4.2 - t) / 0.5, 0, 1);
      if (a <= 0) return;
      const env = envInfo(L.env).name;
      const title = this.o.source === "adventure" ? `\u5173\u5361 ${L.id}` : L.title;
      const introName = L.intro && ZOMBIES[L.intro] ? `\u65B0\u50F5\u5C38\u767B\u573A\uFF1A${ZOMBIES[L.intro].name}` : "";
      const sub = this.o.source === "adventure" ? [env, L.title, introName].filter(Boolean).join(" \xB7 ") : L.desc || "";
      ctx.save();
      ctx.globalAlpha = a;
      const y = 620 + (1 - Ease.outCubic(clamp(t / 0.5, 0, 1))) * 40;
      ctx.fillStyle = lg(ctx, 0, y - 40, 0, y + 40, [0, "rgba(0,0,0,0)", 0.3, "rgba(0,0,0,0.55)", 0.7, "rgba(0,0,0,0.55)", 1, "rgba(0,0,0,0)"]);
      ctx.fillRect(0, y - 44, W, 88);
      text(ctx, title, 640, y - 10, { size: 38, color: "#fff3c8", stroke: "#2a1a08", lw: 8 });
      text(ctx, sub, 640, y + 26, { size: 18, color: "#e8f0c8", stroke: "#1a1a08", lw: 4, weight: 700 });
      ctx.restore();
    }
    drawReady(ctx) {
      const t = this.phaseT;
      let str = null, k = 0;
      if (t < 0.65) {
        str = "\u51C6\u5907\u2026\u2026";
        k = t / 0.65;
      } else if (t < 1.3) {
        str = "\u5C31\u7EEA\u2026\u2026";
        k = (t - 0.65) / 0.65;
      } else if (t < 2.1) {
        str = "\u79CD\u690D\uFF01";
        k = (t - 1.3) / 0.8;
      }
      if (!str) return;
      ctx.save();
      ctx.translate(640, 360);
      const s = str === "\u79CD\u690D\uFF01" ? 1.2 + Ease.outBack(Math.min(1, k * 3)) * 0.4 : 0.8 + Ease.outBack(Math.min(1, k * 3)) * 0.3;
      ctx.scale(s, s);
      ctx.globalAlpha = k > 0.85 ? (1 - k) / 0.15 : 1;
      text(ctx, str, 0, 0, { size: 68, color: "#e8201a", stroke: "#200000", lw: 12, shadow: "rgba(0,0,0,0.4)" });
      ctx.restore();
    }
    drawAward(ctx) {
      const t = this.awardT;
      const r = this.awardReward;
      const k = Ease.inOutCubic(clamp(t / 1.2, 0, 1));
      const x = lerp(this.awardFrom.x, 640, k), y = lerp(this.awardFrom.y, 360, k);
      ctx.save();
      ctx.fillStyle = `rgba(255,255,255,${clamp((t - 0.6) / 1.1, 0, 1)})`;
      ctx.fillRect(0, 0, W, H);
      ctx.translate(x, y);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.rotate(t);
      for (let i = 0; i < 16; i++) {
        ctx.rotate(TAU / 16);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-18, -300 * k);
        ctx.lineTo(18, -300 * k);
        ctx.closePath();
        ctx.fillStyle = "rgba(255,240,160,0.25)";
        ctx.fill();
      }
      ctx.restore();
      const s = 1 + k * 1.6;
      ctx.scale(s, s);
      if (r.reward.type === "plant") drawPacket(ctx, -31, -43, r.reward.id, { glow: 1 });
      else if (r.reward.type === "trophy") drawTrophy(ctx, 0, 30, 1, t);
      else drawNote(ctx, 0, 30, 1);
      ctx.restore();
    }
    drawLost(ctx) {
      const t = this.phaseT;
      if (t > 2.4) {
        const a = clamp((t - 2.4) / 0.4, 0, 1);
        ctx.save();
        ctx.fillStyle = `rgba(0,0,0,${a * 0.45})`;
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = a;
        ctx.translate(640 + Math.sin(t * 30) * 2 * (1 - a), 330);
        const s = 0.6 + Ease.outBack(a) * 0.4;
        ctx.scale(s, s);
        ctx.rotate(-0.04);
        text(ctx, "\u50F5\u5C38\u5403\u6389\u4E86", 0, -60, { size: 70, color: "#a8e060", stroke: "#1a2a00", lw: 12, shadow: "rgba(0,0,0,0.6)" });
        text(ctx, "\u4F60\u7684\u8111\u5B50\uFF01", 0, 40, { size: 92, color: "#a8e060", stroke: "#1a2a00", lw: 14, shadow: "rgba(0,0,0,0.6)" });
        ctx.restore();
        if (this.mode === "survival") text(ctx, `\u672C\u6B21\u575A\u6301\u4E86 ${this.flagsSurvived} \u65D7\uFF08\u6700\u4F73 ${save.data.survival[this.level.id] || 0} \u65D7\uFF09`, 640, 470, { size: 24, color: "#fff", stroke: "#000", lw: 5 });
      }
      if (this.endShown) this.endUI.draw(ctx);
    }
    drawHint(ctx) {
      const h = this.hint;
      if (!h || h.until && this.t > h.until) return;
      if (this.phase !== "play" && this.phase !== "won") return;
      if (h.text) {
        ctx.save();
        ctx.font = `700 22px ${FONT}`;
        const w = Math.min(1100, ctx.measureText(h.text).width + 60);
        rr(ctx, 640 - w / 2, 620, w, 54, 14);
        fs(ctx, "rgba(10,14,8,0.78)", "rgba(220,255,160,0.5)", 2);
        text(ctx, h.text, 640, 647, { size: 22, color: "#f8f4d8", weight: 700 });
        ctx.restore();
      }
      if (h.arrow) {
        const a = h.arrow;
        const bob = Math.sin(this.t * 8) * 8;
        ctx.save();
        ctx.translate(a.x, a.y + (a.dir === "down" ? bob : -bob));
        if (a.dir === "up") ctx.rotate(Math.PI);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-20, -26);
        ctx.lineTo(-8, -26);
        ctx.lineTo(-8, -52);
        ctx.lineTo(8, -52);
        ctx.lineTo(8, -26);
        ctx.lineTo(20, -26);
        ctx.closePath();
        fs(ctx, lg(ctx, 0, -52, 0, 0, [0, "#fff27a", 1, "#ff9a1a"]), "#5a2a00", 3);
        ctx.restore();
      }
    }
    drawSelect(ctx) {
      const p = this.selectPanel;
      const slide = this.phase === "select" ? Ease.outCubic(clamp(this.phaseT * 3, 0, 1)) : 1 - clamp(this.phaseT * 3, 0, 1);
      ctx.save();
      ctx.translate(0, (1 - slide) * 700);
      drawPanel(ctx, p.x, p.y, p.w, p.h, "wood");
      text(ctx, "\u9009\u62E9\u4F60\u7684\u690D\u7269", p.x + p.w / 2, p.y + 32, { size: 30, color: "#fff3c8", stroke: "#3a2008", lw: 7 });
      const av = this.availablePlants();
      av.forEach((t, i) => {
        const g = this.gridPos(i);
        const chosen = this.chosen.includes(t);
        const flying = this.selectAnims.some((a) => !a.toBank && a.type === t);
        rr(ctx, g.x, g.y, PACKET_W * g.s, PACKET_H * g.s, 6);
        fs(ctx, "rgba(30,15,3,0.45)");
        if (!flying) drawPacket(ctx, g.x, g.y, t, { selected: chosen, hover: this.selHover === t && !chosen, scale: g.s, shadow: false });
        if (PLANTS[t].night && !this.board.isNight && !chosen) {
          text(ctx, "Zz", g.x + PACKET_W * g.s - 10, g.y + 12, { size: 13, color: "#dfe8ff", stroke: "#223", lw: 3 });
        }
      });
      const ht = this.selHover;
      const infoY = p.y + p.h - 156;
      rr(ctx, p.x + 20, infoY, p.w - 40, 76, 10);
      fs(ctx, "rgba(20,10,2,0.45)", "rgba(255,230,160,0.25)", 1.5);
      if (ht) {
        const d = PLANTS[ht];
        text(ctx, d.name, p.x + 40, infoY + 22, { size: 22, color: "#ffe8a0", stroke: "#2a1404", lw: 5, align: "left" });
        text(ctx, `\u82B1\u8D39 ${d.cost}   \u51B7\u5374 ${d.recharge <= 8 ? "\u5FEB" : d.recharge <= 30 ? "\u6162" : "\u5F88\u6162"}${d.night && !this.board.isNight ? "   \uFF08\u767D\u5929\u4F1A\u7761\u89C9\uFF09" : ""}`, p.x + p.w - 40, infoY + 22, { size: 16, color: "#f0e0c0", align: "right", weight: 700 });
        wrapText(ctx, d.desc, p.x + 40, infoY + 38, p.w - 80, 20, { size: 16, color: "#f8f0dc", weight: 500 });
      } else {
        text(ctx, `\u6311\u9009 ${Math.min(this.maxSlots, av.length)} \u682A\u690D\u7269\u653E\u8FDB\u79CD\u5B50\u69FD\uFF0C\u7136\u540E\u5F00\u59CB\u6218\u6597\uFF01`, p.x + p.w / 2, infoY + 41, { size: 18, color: "#f0e0c0", weight: 700 });
      }
      this.rockBtn.draw(ctx);
      ctx.restore();
      if (this.phase === "select") {
        const types = [...new Set(this.board.previewZombies.map((z) => z.type))];
        text(ctx, "\u672C\u5173\u51FA\u73B0\u7684\u50F5\u5C38", 960, 34, { size: 22, color: "#fff", stroke: "#000", lw: 5 });
        text(ctx, types.map((t) => ZOMBIES[t].name).join("\u3001"), 960, 64, { size: 16, color: "#ffe8a0", stroke: "#000", lw: 4, weight: 700 });
      }
    }
    drawPause(ctx) {
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(0, 0, W, H);
      drawPanel(ctx, 390, 140, 500, 410, "stone");
      text(ctx, "\u6E38\u620F\u6682\u505C", 640, 188, { size: 36, color: "#e8f0d8", stroke: "#1a1c20", lw: 8 });
      this.pauseUI.draw(ctx);
      text(ctx, "\u5FEB\u6377\u952E\uFF1A\u7A7A\u683C\u6682\u505C \xB7 1-0 \u9009\u5361 \xB7 S \u94F2\u5B50 \xB7 X \u500D\u901F \xB7 F \u5168\u5C4F", 640, 580, { size: 15, color: "#d8d8c8", weight: 600 });
      ctx.restore();
    }
  };
  var ZombieProxy = class extends Zombie {
    constructor(board, type, row, x, y) {
      super(board, type, row, x, { preview: true, y });
      this.anim = "idle";
      this.ducky = false;
      this.lookType = null;
    }
  };
  function drawVase(ctx, x, y, green, t, shake) {
    ctx.save();
    ctx.translate(x + Math.sin(t * 40) * shake, y);
    E(ctx, 0, 0, 30, 8);
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fill();
    const body = green ? ["#b8e090", "#5a9a3a", "#2a4a18"] : ["#f0d8b0", "#b88a54", "#4a3018"];
    ctx.beginPath();
    ctx.moveTo(-14, -84);
    ctx.lineTo(14, -84);
    ctx.quadraticCurveTo(12, -74, 22, -64);
    ctx.bezierCurveTo(44, -44, 36, -8, 18, -2);
    ctx.lineTo(-18, -2);
    ctx.bezierCurveTo(-36, -8, -44, -44, -22, -64);
    ctx.quadraticCurveTo(-12, -74, -14, -84);
    ctx.closePath();
    fs(ctx, rg(ctx, -10, -50, 4, 0, -40, 50, [0, body[0], 1, body[1]]), body[2], 2.5);
    E(ctx, 0, -84, 16, 5);
    fs(ctx, body[1], body[2], 2);
    E(ctx, 0, -84, 11, 3);
    ctx.fillStyle = "#1a1008";
    ctx.fill();
    ctx.strokeStyle = green ? "rgba(20,60,10,0.5)" : "rgba(90,50,20,0.5)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-30, -40);
    ctx.quadraticCurveTo(0, -30, 30, -40);
    ctx.moveTo(-26, -24);
    ctx.quadraticCurveTo(0, -16, 26, -24);
    ctx.stroke();
    if (green) {
      ctx.save();
      ctx.translate(0, -48);
      ctx.beginPath();
      ctx.moveTo(-10, 6);
      ctx.quadraticCurveTo(-8, -10, 10, -10);
      ctx.quadraticCurveTo(8, 6, -10, 6);
      fs(ctx, "#e8ffb0", "#2a4a18", 1.5);
      ctx.restore();
    } else {
      text(ctx, "?", 0, -46, { size: 22, color: "rgba(90,50,20,0.55)" });
    }
    ctx.save();
    ctx.globalAlpha *= 0.4;
    E(ctx, -14, -54, 5, 12, 0.3);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.restore();
    ctx.restore();
  }
  function drawMallet(ctx, x, y, k) {
    ctx.save();
    ctx.translate(x + 20, y - 10);
    const swing = k < 1 ? Math.sin(k * Math.PI) : 0;
    ctx.rotate(-0.6 + swing * 1.1);
    ctx.fillStyle = lg(ctx, -5, 0, 5, 0, [0, "#d8a060", 1, "#8a5a2a"]);
    ctx.strokeStyle = "#3a2008";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(-5, -10, 10, 70);
    ctx.fill();
    ctx.stroke();
    rr(ctx, -34, -40, 68, 36, 8);
    fs(ctx, lg(ctx, 0, -40, 0, -4, [0, "#c8c8c0", 1, "#6a6a64"]), "#222", 2.5);
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.fillRect(-30, -36, 60, 8);
    ctx.restore();
  }

  // src/scenes/levelSelect.js
  var Scenes3 = {};
  function registerLevelScenes(s) {
    Scenes3 = s;
  }
  var ZONES = [
    { env: "day", name: "\u767D\u5929", color: "#6cc93a" },
    { env: "night", name: "\u9ED1\u591C", color: "#7a6ad8" },
    { env: "pool", name: "\u6CF3\u6C60", color: "#3ab4e0" },
    { env: "fog", name: "\u6D53\u96FE", color: "#6a8aa8" }
  ];
  var LevelSelectScene = class {
    constructor(zone) {
      const adv = save.data.adventure;
      this.zone = zone ?? Math.min(ZONES.length - 1, Math.floor(Math.min(adv, ADVENTURE.length - 1) / 10));
      this.t = 0;
      this.ui = new UIGroup();
      this.hover = -1;
      this.ui.add(new Button({ x: 24, y: 640, w: 160, h: 56, label: "\u8FD4\u56DE", style: "stone", onClick: () => director.go(new Scenes3.MenuScene()) }));
      this.tabs = ZONES.map((z, i) => this.ui.add(new Button({
        x: 300 + i * 176,
        y: 22,
        w: 164,
        h: 60,
        label: z.name,
        style: i === this.zone ? "gold" : "wood",
        fontSize: 26,
        disabled: adv < i * 10,
        onClick: () => {
          this.zone = i;
          this.refreshTabs();
        }
      })));
    }
    refreshTabs() {
      this.tabs.forEach((b, i) => {
        b.style = i === this.zone ? "gold" : "wood";
      });
    }
    enter() {
      music.play("menu");
    }
    cardRect(i) {
      const col = i % 5, row = Math.floor(i / 5);
      return { x: 110 + col * 218, y: 150 + row * 230, w: 186, h: 200 };
    }
    update(dt) {
      this.t += dt;
    }
    levelAt(x, y) {
      for (let i = 0; i < 10; i++) {
        const r = this.cardRect(i);
        if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
      }
      return -1;
    }
    pointerMove(x, y) {
      display.setCursor("default");
      this.ui.move(x, y);
      const i = this.levelAt(x, y);
      const idx = this.zone * 10 + i;
      const ok = i >= 0 && idx <= save.data.adventure;
      if (ok && this.hover !== i) audio.play("hover");
      this.hover = ok ? i : -1;
      if (ok) display.setCursor("pointer");
    }
    pointerDown(x, y) {
      if (this.ui.down(x, y)) return;
      const i = this.levelAt(x, y);
      if (i < 0) return;
      const idx = this.zone * 10 + i;
      if (idx > save.data.adventure) {
        audio.play("buzzer");
        return;
      }
      audio.play("button");
      director.go(new Scenes3.GameScene(ADVENTURE[idx], { source: "adventure" }));
    }
    pointerUp(x, y) {
      this.ui.up(x, y);
    }
    key(k) {
      if (k === "Escape") director.go(new Scenes3.MenuScene());
    }
    draw(ctx) {
      const z = ZONES[this.zone];
      const bg = getBackground(z.env);
      ctx.drawImage(bg.canvas, (200 - WORLD_MIN_X) * bg.scale, 0, 1280 * bg.scale, 720 * bg.scale, 0, 0, W, H);
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(0, 0, W, H);
      text(ctx, "\u5192\u9669\u6A21\u5F0F", 150, 52, { size: 34, color: "#fff3c8", stroke: "#2a1a08", lw: 7 });
      const adv = save.data.adventure;
      for (let i = 0; i < 10; i++) {
        const idx = this.zone * 10 + i;
        const L = ADVENTURE[idx];
        const r = this.cardRect(i);
        const locked = idx > adv;
        const done = !!save.data.completed[L.id];
        const current = idx === adv;
        const hov = this.hover === i;
        const lift = hov ? -6 : current ? Math.sin(this.t * 4) * 3 : 0;
        ctx.save();
        ctx.translate(0, lift);
        ctx.fillStyle = "rgba(0,0,0,0.4)";
        rr(ctx, r.x + 4, r.y + 8 - lift, r.w, r.h, 18);
        ctx.fill();
        rr(ctx, r.x, r.y, r.w, r.h, 18);
        const cols = locked ? ["#5a5e66", "#3a3e44"] : [z.color, "#2a3a1a"];
        fs(ctx, lg(ctx, 0, r.y, 0, r.y + r.h, [0, locked ? cols[0] : shadeMix(z.color), 1, locked ? cols[1] : darkMix(z.color)]), current ? "#fff27a" : "#141410", current ? 4 : 3);
        rr(ctx, r.x + 10, r.y + 10, r.w - 20, r.h - 64, 12);
        fs(ctx, "rgba(0,0,0,0.25)");
        text(ctx, L.id, r.x + r.w / 2, r.y + r.h - 30, { size: 30, color: locked ? "#9a9a9a" : "#fff", stroke: "#1a1a1a", lw: 6 });
        if (L.title) text(ctx, L.title, r.x + r.w / 2, r.y + r.h - 58, { size: 14, color: "#ffe8a0", stroke: "#1a1a1a", lw: 4 });
        const cx = r.x + r.w / 2, cy = r.y + 72;
        if (locked) {
          drawLock(ctx, cx, cy);
        } else if (L.reward?.type === "plant") {
          const own = save.hasPlant(L.reward.id);
          ctx.save();
          ctx.globalAlpha = own && done ? 0.55 : 1;
          drawPacket(ctx, cx - 27, cy - 44, L.reward.id, { scale: 0.88, noCost: true });
          ctx.restore();
        } else if (L.reward?.type === "trophy") drawTrophy(ctx, cx, cy + 34, 0.8, this.t);
        else drawNote(ctx, cx, cy + 34, 0.9);
        if (done) {
          C(ctx, r.x + r.w - 22, r.y + 22, 16);
          fs(ctx, lg(ctx, 0, r.y + 6, 0, r.y + 38, [0, "#9ef05a", 1, "#3a8a1a"]), "#143a06", 2.5);
          ctx.beginPath();
          ctx.moveTo(r.x + r.w - 30, r.y + 22);
          ctx.lineTo(r.x + r.w - 24, r.y + 29);
          ctx.lineTo(r.x + r.w - 13, r.y + 15);
          ctx.lineWidth = 3.5;
          ctx.strokeStyle = "#fff";
          ctx.lineCap = "round";
          ctx.stroke();
        }
        ctx.restore();
      }
      const nextIdx = Math.min(adv, ADVENTURE.length - 1);
      text(ctx, adv >= ADVENTURE.length ? "\u606D\u559C\uFF01\u5192\u9669\u6A21\u5F0F\u5DF2\u5168\u90E8\u901A\u5173\uFF0C\u53EF\u4EE5\u968F\u65F6\u91CD\u73A9\u4EFB\u610F\u5173\u5361\u3002" : `\u4E0B\u4E00\u5173\uFF1A${ADVENTURE[nextIdx].id}${ADVENTURE[nextIdx].reward?.type === "plant" ? "\uFF0C\u5956\u52B1\u300C" + PLANTS[ADVENTURE[nextIdx].reward.id].name + "\u300D" : ""}`, 740, 668, { size: 20, color: "#fff", stroke: "#000", lw: 5 });
      this.ui.draw(ctx);
    }
  };
  function shadeMix(c) {
    return c;
  }
  function darkMix(c) {
    return "#1e2a14";
  }
  function drawLock(ctx, x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.arc(0, -8, 16, Math.PI, 0);
    ctx.lineWidth = 7;
    ctx.strokeStyle = "#8a8e96";
    ctx.stroke();
    rr(ctx, -24, -8, 48, 40, 7);
    fs(ctx, lg(ctx, 0, -8, 0, 32, [0, "#e0b040", 1, "#9a6a10"]), "#3a2400", 2.5);
    C(ctx, 0, 8, 5);
    ctx.fillStyle = "#3a2400";
    ctx.fill();
    ctx.fillRect(-2, 8, 4, 12);
    ctx.restore();
  }

  // src/scenes/minigames.js
  var Scenes4 = {};
  function registerMinigameScenes(s) {
    Scenes4 = s;
  }
  var ICON = {
    "mg-bowling": (ctx) => bowlnut(ctx, { roll: 0.3 }, "normal"),
    "mg-whack": (ctx) => {
      ctx.translate(0, 28);
      ctx.scale(0.62, 0.62);
      drawZombieArt(ctx, { type: "cone", t: 0, anim: "idle", armorKind: "cone", hasArm: true, hasHead: true });
    },
    "mg-vase": (ctx) => drawVaseIcon(ctx),
    "mg-conveyor": (ctx) => PLANT_ART.lilypad(ctx, { t: 0, icon: true }),
    "mg-invisible": (ctx) => {
      ctx.globalAlpha = 0.35;
      ctx.translate(0, 20);
      ctx.scale(0.7, 0.7);
      drawZombieArt(ctx, { type: "normal", t: 0, anim: "idle", hasArm: true, hasHead: true });
    },
    "mg-rain": (ctx) => PLANT_ART.repeater(ctx, { t: 0, icon: true }),
    "sv-day": (ctx) => PLANT_ART.sunflower(ctx, { t: 0, icon: true }),
    "sv-night": (ctx) => PLANT_ART.puffshroom(ctx, { t: 0, icon: true }),
    "sv-pool": (ctx) => PLANT_ART.tanglekelp(ctx, { t: 0, icon: true }),
    "sv-fog": (ctx) => PLANT_ART.plantern(ctx, { t: 0, icon: true })
  };
  var MinigameScene = class {
    constructor(kind = "minigame") {
      this.kind = kind;
      this.list = kind === "survival" ? SURVIVAL : MINIGAMES;
      this.t = 0;
      this.hover = -1;
      this.ui = new UIGroup();
      this.ui.add(new Button({ x: 24, y: 640, w: 160, h: 56, label: "\u8FD4\u56DE", style: "stone", onClick: () => director.go(new Scenes4.MenuScene()) }));
    }
    enter() {
      music.play("menu");
    }
    update(dt) {
      this.t += dt;
    }
    rect(i) {
      const n = this.list.length;
      const cols = 3;
      const col = i % cols, row = Math.floor(i / cols);
      const rows = Math.ceil(n / cols);
      const y0 = rows === 1 ? 230 : 140;
      return { x: 110 + col * 360, y: y0 + row * 230, w: 330, h: 200 };
    }
    at(x, y) {
      for (let i = 0; i < this.list.length; i++) {
        const r = this.rect(i);
        if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
      }
      return -1;
    }
    pointerMove(x, y) {
      display.setCursor("default");
      this.ui.move(x, y);
      const i = this.at(x, y);
      if (i >= 0 && i !== this.hover) audio.play("hover");
      this.hover = i;
      if (i >= 0) display.setCursor("pointer");
    }
    pointerDown(x, y) {
      if (this.ui.down(x, y)) return;
      const i = this.at(x, y);
      if (i < 0) return;
      audio.play("button");
      director.go(new Scenes4.GameScene(this.list[i], { source: this.kind }));
    }
    pointerUp(x, y) {
      this.ui.up(x, y);
    }
    key(k) {
      if (k === "Escape") director.go(new Scenes4.MenuScene());
    }
    draw(ctx) {
      const bg = getBackground(this.kind === "survival" ? "night" : "day");
      ctx.drawImage(bg.canvas, (300 - WORLD_MIN_X) * bg.scale, 0, 1280 * bg.scale, 720 * bg.scale, 0, 0, W, H);
      ctx.fillStyle = "rgba(10,6,20,0.55)";
      ctx.fillRect(0, 0, W, H);
      text(ctx, this.kind === "survival" ? "\u751F\u5B58\u6A21\u5F0F" : "\u5C0F\u6E38\u620F", 640, 64, { size: 44, color: "#fff3c8", stroke: "#2a1a08", lw: 9 });
      this.list.forEach((L, i) => {
        const r = this.rect(i);
        const hov = this.hover === i;
        ctx.save();
        ctx.translate(0, hov ? -6 : 0);
        drawPanel(ctx, r.x, r.y, r.w, r.h, "paper");
        const px = r.x + 16, py = r.y + 16, pw = 110, ph = 120;
        const eb = getBackground(L.env);
        ctx.save();
        rr(ctx, px, py, pw, ph, 12);
        ctx.clip();
        ctx.drawImage(eb.canvas, (560 - WORLD_MIN_X) * eb.scale, 250 * eb.scale, pw * 2 * eb.scale, ph * 2 * eb.scale, px, py, pw, ph);
        ctx.translate(px + pw / 2, py + ph - 14);
        ICON[L.id]?.(ctx);
        ctx.restore();
        rr(ctx, px, py, pw, ph, 12);
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#5a4418";
        ctx.stroke();
        text(ctx, L.title.replace("\u751F\u5B58\u6A21\u5F0F\uFF1A", ""), r.x + 145, r.y + 38, { size: 24, color: "#4a2a08", align: "left", weight: 900 });
        wrapText(ctx, L.desc, r.x + 145, r.y + 62, r.w - 160, 22, { size: 16, color: "#5a4020", weight: 600 });
        ctx.strokeStyle = "rgba(90,60,20,0.25)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(r.x + 16, r.y + r.h - 50);
        ctx.lineTo(r.x + r.w - 16, r.y + r.h - 50);
        ctx.stroke();
        if (this.kind === "survival") {
          const best = save.data.survival[L.id] || 0;
          text(ctx, `\u6700\u4F73\u6210\u7EE9\uFF1A${best} \u65D7`, r.x + 24, r.y + r.h - 26, { size: 19, color: "#2a6a10", weight: 900, align: "left" });
        } else if (save.data.minigames[L.id]?.won) {
          drawTrophy(ctx, r.x + 40, r.y + r.h - 8, 0.36, this.t);
          text(ctx, "\u5DF2\u5B8C\u6210", r.x + 66, r.y + r.h - 26, { size: 18, color: "#2a6a10", weight: 900, align: "left" });
        } else {
          text(ctx, "\u5C1A\u672A\u5B8C\u6210", r.x + 24, r.y + r.h - 26, { size: 17, color: "#8a6a40", weight: 700, align: "left" });
        }
        text(ctx, hov ? "\u5F00\u59CB\u6311\u6218 \u25B6" : "\u70B9\u51FB\u5F00\u59CB", r.x + r.w - 24, r.y + r.h - 26, { size: 18, color: hov ? "#c04a10" : "#6a4a20", weight: 900, align: "right" });
        ctx.restore();
      });
      this.ui.draw(ctx);
    }
  };
  function drawVaseIcon(ctx) {
    ctx.beginPath();
    ctx.moveTo(-12, -74);
    ctx.lineTo(12, -74);
    ctx.quadraticCurveTo(10, -64, 20, -56);
    ctx.bezierCurveTo(38, -38, 32, -6, 16, 0);
    ctx.lineTo(-16, 0);
    ctx.bezierCurveTo(-32, -6, -38, -38, -20, -56);
    ctx.quadraticCurveTo(-10, -64, -12, -74);
    ctx.closePath();
    fs(ctx, lg(ctx, -30, 0, 30, 0, [0, "#f0d8b0", 1, "#a87a44"]), "#4a3018", 2.5);
    text(ctx, "?", 0, -36, { size: 26, color: "rgba(90,50,20,0.6)" });
  }

  // src/scenes/almanac.js
  var Scenes5 = {};
  function registerAlmanacScenes(s) {
    Scenes5 = s;
  }
  var ZART = {
    cone: { armorKind: "cone" },
    bucket: { armorKind: "bucket" },
    football: { armorKind: "helmet" },
    flag: { held: "flag" },
    newspaper: { held: "paper" },
    screendoor: { held: "door" },
    pole: { held: "pole" },
    ducky: { lookType: "ducky", ducky: true, inWater: true },
    gargantuar: { hasImp: true },
    dolphin: { riding: true },
    balloon: { held: "balloon", anim: "float" },
    digger: { held: "pickaxe" },
    pogo: { held: "pogo" },
    jackbox: { held: "jackbox" }
  };
  var AlmanacScene = class {
    constructor(tab = "plants") {
      this.tab = tab;
      this.t = 0;
      this.sel = { plants: "peashooter", zombies: "normal" };
      this.ui = new UIGroup();
      this.ui.add(new Button({ x: 24, y: 650, w: 150, h: 52, label: "\u8FD4\u56DE", style: "stone", onClick: () => director.go(new Scenes5.MenuScene()) }));
      this.tabBtns = [
        this.ui.add(new Button({ x: 70, y: 26, w: 190, h: 56, label: "\u690D\u7269", style: "green", onClick: () => this.setTab("plants") })),
        this.ui.add(new Button({ x: 276, y: 26, w: 190, h: 56, label: "\u50F5\u5C38", style: "stone", onClick: () => this.setTab("zombies") }))
      ];
      this.setTab(tab);
      this.hover = null;
    }
    setTab(t) {
      this.tab = t;
      this.tabBtns[0].style = t === "plants" ? "gold" : "green";
      this.tabBtns[1].style = t === "zombies" ? "gold" : "stone";
    }
    enter() {
      music.play("select");
    }
    update(dt) {
      this.t += dt;
    }
    plantRect(i) {
      return { x: 50 + i % 7 * 62, y: 106 + Math.floor(i / 7) * 104, w: PACKET_W * 0.86, h: PACKET_H * 0.86 };
    }
    zombieRect(i) {
      return { x: 48 + i % 5 * 88, y: 106 + Math.floor(i / 5) * 128, w: 82, h: 116 };
    }
    itemAt(x, y) {
      if (this.tab === "plants") {
        for (let i = 0; i < PLANT_ORDER.length; i++) {
          const r = this.plantRect(i);
          if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return PLANT_ORDER[i];
        }
      } else {
        for (let i = 0; i < ZOMBIE_ORDER.length; i++) {
          const r = this.zombieRect(i);
          if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return ZOMBIE_ORDER[i];
        }
      }
      return null;
    }
    known(id) {
      return this.tab === "plants" ? save.hasPlant(id) : save.data.seenZombies.includes(id);
    }
    pointerMove(x, y) {
      display.setCursor("default");
      this.ui.move(x, y);
      const it = this.itemAt(x, y);
      this.hover = it && this.known(it) ? it : null;
      if (this.hover) display.setCursor("pointer");
    }
    pointerDown(x, y) {
      if (this.ui.down(x, y)) return;
      const it = this.itemAt(x, y);
      if (it && this.known(it)) {
        this.sel[this.tab] = it;
        audio.play("tap");
      }
    }
    pointerUp(x, y) {
      this.ui.up(x, y);
    }
    key(k) {
      if (k === "Escape") director.go(new Scenes5.MenuScene());
    }
    draw(ctx) {
      ctx.fillStyle = lg(ctx, 0, 0, 0, H, [0, "#2a3a1a", 1, "#101808"]);
      ctx.fillRect(0, 0, W, H);
      drawPanel(ctx, 30, 90, 470, 546, "paper");
      drawPanel(ctx, 520, 24, 736, 676, "paper");
      if (this.tab === "plants") this.drawPlants(ctx);
      else this.drawZombies(ctx);
      this.ui.draw(ctx);
    }
    drawPlants(ctx) {
      PLANT_ORDER.forEach((id2, i) => {
        const r = this.plantRect(i);
        if (save.hasPlant(id2)) {
          drawPacket(ctx, r.x, r.y, id2, { hover: this.hover === id2, glow: this.sel.plants === id2 ? 1 : 0, scale: 0.86 });
        } else {
          rr(ctx, r.x, r.y, r.w, r.h, 6);
          fs(ctx, "rgba(90,70,30,0.25)", "rgba(90,70,30,0.4)", 2);
          text(ctx, "?", r.x + r.w / 2, r.y + r.h / 2, { size: 30, color: "rgba(90,70,30,0.5)" });
        }
      });
      const id = this.sel.plants;
      const d = PLANTS[id];
      this.drawPreview(ctx, plantHomeEnv(id), (c) => {
        c.scale(1.7, 1.7);
        const s = { t: this.t, phase: 0, armed: true, rise: 1, grow: 1, shoot: this.t % 1.6 < 0.36 ? this.t % 1.6 / 0.36 : 0 };
        if (id === "chomper") s.bite = this.t % 3 < 0.8 ? this.t % 3 / 0.8 : 0;
        if (d.kind === "instant") s.fuse = (Math.sin(this.t * 2) + 1) * 0.15;
        PLANT_ART[id](c, s);
      });
      this.drawInfo(ctx, d.name, d.desc, [
        ...d.stats,
        ["\u82B1\u8D39", `${d.cost} \u9633\u5149`],
        ["\u51B7\u5374", rechargeLabel(d.recharge)],
        ...d.kind === "wall" ? [["\u751F\u547D\u503C", String(d.hp)]] : []
      ], d.lore);
    }
    drawZombies(ctx) {
      ZOMBIE_ORDER.forEach((id2, i) => {
        const r = this.zombieRect(i);
        const known = save.data.seenZombies.includes(id2);
        rr(ctx, r.x, r.y, r.w, r.h, 10);
        fs(ctx, known ? lg(ctx, 0, r.y, 0, r.y + r.h, [0, "#c8d8b0", 1, "#7a9060"]) : "rgba(90,70,30,0.25)", this.sel.zombies === id2 ? "#ff8a1a" : "rgba(90,70,30,0.6)", this.sel.zombies === id2 ? 4 : 2);
        if (known) {
          ctx.save();
          rr(ctx, r.x, r.y, r.w, r.h, 10);
          ctx.clip();
          const big = id2 === "gargantuar" ? 0.46 : id2 === "zomboni" ? 0.5 : id2 === "imp" ? 1.05 : 0.86;
          const dy = id2 === "gargantuar" ? 70 : id2 === "zomboni" ? 26 : id2 === "imp" ? 58 : 72;
          ctx.translate(r.x + r.w / 2 + 6, r.y + r.h + dy);
          ctx.scale(big, big);
          drawZombieArt(ctx, { type: id2 === "ducky" ? "normal" : id2, t: 0, anim: "idle", hasArm: true, hasHead: true, ...ZART[id2] || {} });
          ctx.restore();
          if (this.hover === id2) {
            ctx.save();
            ctx.globalCompositeOperation = "lighter";
            rr(ctx, r.x, r.y, r.w, r.h, 10);
            ctx.fillStyle = "rgba(255,255,200,0.15)";
            ctx.fill();
            ctx.restore();
          }
        } else {
          text(ctx, "?", r.x + r.w / 2, r.y + r.h / 2, { size: 40, color: "rgba(90,70,30,0.5)" });
        }
      });
      const id = this.sel.zombies;
      const d = ZOMBIES[id];
      const env = d.water || id === "ducky" ? "pool" : "night";
      this.drawPreview(ctx, env, (c) => {
        const phase = Math.floor(this.t / 3) % 2;
        const sc = id === "gargantuar" ? 0.8 : id === "zomboni" ? 0.95 : 1.15;
        c.scale(sc, sc);
        c.translate(0, id === "gargantuar" ? 20 : 0);
        const extra = ZART[id] || {};
        const bounce = id === "pogo" ? -Math.abs(Math.sin(this.t * 6)) * 40 : id === "balloon" ? -8 + Math.sin(this.t * 2) * 5 : 0;
        if (id === "balloon") c.scale(0.82, 0.82);
        c.translate(0, bounce);
        drawZombieArt(c, {
          type: id === "ducky" ? "normal" : id,
          t: this.t,
          walkPh: this.t * 4,
          eatPh: this.t * 8,
          anim: phase ? "eat" : "walk",
          seed: 1,
          hasArm: true,
          hasHead: true,
          ...extra,
          anim: extra.anim || (id === "pogo" ? "pogo" : phase ? "eat" : "walk"),
          pogoSquash: id === "pogo" ? Math.max(0, 1 - Math.abs(Math.sin(this.t * 6)) * 5) : 0,
          jackPop: id === "jackbox" ? Math.max(0, this.t % 5 - 4) : 0,
          smashT: id === "gargantuar" ? this.t % 3 / 3 : 0
        });
      });
      const total = d.hp + (d.armor?.hp || 0) + (d.shield?.hp || 0);
      const tough = total < 300 ? "\u4F4E" : total < 700 ? "\u4E2D" : total < 1500 ? "\u9AD8" : "\u6781\u9AD8";
      this.drawInfo(ctx, d.name, d.desc, [["\u97E7\u6027", tough], ...d.stats.filter((s) => s[0] !== "\u97E7\u6027")], d.lore);
    }
    drawPreview(ctx, env, fn) {
      const x = 560, y = 60, w = 660, h = 270;
      const bg = getBackground(env);
      ctx.save();
      rr(ctx, x, y, w, h, 14);
      ctx.clip();
      ctx.drawImage(bg.canvas, (420 - WORLD_MIN_X) * bg.scale, (env === "pool" ? 250 : 260) * bg.scale, w * bg.scale, h * bg.scale, x, y, w, h);
      ctx.fillStyle = "rgba(0,0,0,0.1)";
      ctx.fillRect(x, y, w, h);
      ctx.translate(x + w / 2, y + h - 40);
      fn(ctx);
      ctx.restore();
      rr(ctx, x, y, w, h, 14);
      ctx.lineWidth = 4;
      ctx.strokeStyle = "#5a4418";
      ctx.stroke();
    }
    drawInfo(ctx, name, desc, stats, lore) {
      const x = 570;
      text(ctx, name, 888, 362, { size: 34, color: "#4a2a08", weight: 900 });
      let y = 396;
      y += wrapText(ctx, desc, x, y, 640, 26, { size: 19, color: "#3a2810", weight: 700 }) + 8;
      for (const [k, v] of stats) {
        text(ctx, k + "\uFF1A", x, y + 12, { size: 18, color: "#8a3a10", align: "left", weight: 900 });
        ctx.font = `900 18px sans-serif`;
        text(ctx, v, x + 20 + k.length * 19, y + 12, { size: 18, color: "#3a2810", align: "left", weight: 700 });
        y += 28;
      }
      y += 8;
      ctx.save();
      ctx.globalAlpha = 0.85;
      wrapText(ctx, lore, x, y, 640, 24, { size: 17, color: "#6a5030", weight: 500 });
      ctx.restore();
    }
  };

  // src/scenes/award.js
  var Scenes6 = {};
  function registerAwardScenes(s) {
    Scenes6 = s;
  }
  var AwardScene = class {
    constructor(level, reward, o = {}) {
      this.level = level;
      this.reward = reward;
      this.o = o;
      this.t = 0;
      this.ui = new UIGroup();
      this.final = level.id === ADVENTURE[ADVENTURE.length - 1].id && o.source === "adventure";
      this.confetti = [];
      const idx = levelIndex(level.id);
      const next = o.source === "adventure" && idx >= 0 ? ADVENTURE[idx + 1] : null;
      if (next) {
        this.ui.add(new Button({ x: 470, y: 600, w: 340, h: 66, label: `\u7EE7\u7EED\uFF1A\u5173\u5361 ${next.id}`, style: "green", fontSize: 28, onClick: () => director.go(new Scenes6.GameScene(next, { source: "adventure" })) }));
        this.ui.add(new Button({ x: 40, y: 640, w: 180, h: 54, label: "\u8FD4\u56DE\u5730\u56FE", style: "stone", fontSize: 22, onClick: () => director.go(new Scenes6.LevelSelectScene()) }));
      } else {
        const back = () => {
          if (o.source === "minigame") director.go(new Scenes6.MinigameScene("minigame"));
          else if (o.source === "survival") director.go(new Scenes6.MinigameScene("survival"));
          else if (o.source === "adventure") director.go(new Scenes6.LevelSelectScene());
          else director.go(new Scenes6.MenuScene());
        };
        this.ui.add(new Button({ x: 490, y: 600, w: 300, h: 66, label: "\u7EE7\u7EED", style: "green", fontSize: 30, onClick: back }));
      }
    }
    enter() {
      audio.play("win");
      music.stop(0.2);
      setTimeout(() => music.play("menu"), 2600);
    }
    update(dt) {
      this.t += dt;
      if (this.final || this.reward.type === "trophy") {
        if (this.confetti.length < 120 && Math.random() < 0.6) {
          this.confetti.push({ x: rand(0, W), y: -20, vx: rand(-30, 30), vy: rand(80, 180), r: rand(0, TAU), vr: rand(-6, 6), c: ["#ff5a5a", "#ffd23a", "#5ad8ff", "#8aff6a", "#ff8af0"][Math.random() * 5 | 0] });
        }
        for (const p of this.confetti) {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.r += p.vr * dt;
        }
        this.confetti = this.confetti.filter((p) => p.y < H + 20);
      }
    }
    pointerMove(x, y) {
      display.setCursor("default");
      this.ui.move(x, y);
    }
    pointerDown(x, y) {
      this.ui.down(x, y);
    }
    pointerUp(x, y) {
      this.ui.up(x, y);
    }
    key(k) {
      if (k === "Enter" || k === " ") this.ui.items[0]?.onClick();
    }
    draw(ctx) {
      const t = this.t;
      ctx.fillStyle = lg(ctx, 0, 0, 0, H, [0, "#fffdf0", 1, "#f0e2b8"]);
      ctx.fillRect(0, 0, W, H);
      ctx.save();
      ctx.translate(640, 300);
      ctx.rotate(t * 0.15);
      for (let i = 0; i < 18; i++) {
        ctx.rotate(TAU / 18);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-40, -900);
        ctx.lineTo(40, -900);
        ctx.closePath();
        ctx.fillStyle = "rgba(255,220,120,0.14)";
        ctx.fill();
      }
      ctx.restore();
      const r = this.reward;
      const pop = Ease.outBack(clamp(t / 0.6, 0, 1));
      if (this.final) this.drawFinal(ctx, pop);
      else if (r.type === "plant") this.drawPlant(ctx, pop);
      else if (r.type === "note") this.drawNoteReward(ctx, pop);
      else this.drawTrophyReward(ctx, pop);
      for (const p of this.confetti) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.fillStyle = p.c;
        ctx.fillRect(-5, -3, 10, 6);
        ctx.restore();
      }
      this.ui.draw(ctx);
    }
    drawPlant(ctx, pop) {
      const id = this.reward.id;
      const d = PLANTS[id];
      text(ctx, "\u4F60\u5F97\u5230\u4E86\u4E00\u682A\u65B0\u690D\u7269\uFF01", 640, 64, { size: 44, color: "#e8a010", stroke: "#5a2a00", lw: 9, shadow: "rgba(0,0,0,0.2)" });
      ctx.save();
      ctx.translate(640, 250);
      ctx.scale(pop, pop);
      drawPanel(ctx, -170, -130, 340, 260, "wood");
      const env = plantHomeEnv(id);
      const bg = getBackground(env);
      ctx.save();
      rr(ctx, -150, -110, 300, 220, 14);
      ctx.clip();
      ctx.drawImage(bg.canvas, (520 - WORLD_MIN_X) * bg.scale, 250 * bg.scale, 300 * bg.scale, 220 * bg.scale, -150, -110, 300, 220);
      ctx.translate(0, 80);
      ctx.scale(1.9, 1.9);
      PLANT_ART[id](ctx, { t: this.t, phase: 0, armed: true, rise: 1, grow: 1, shoot: this.t % 1.5 < 0.36 ? this.t % 1.5 / 0.36 : 0 });
      ctx.restore();
      ctx.restore();
      text(ctx, d.name, 640, 420, { size: 40, color: "#4a2a08", weight: 900 });
      ctx.save();
      ctx.globalAlpha = clamp((this.t - 0.4) * 2, 0, 1);
      wrapText(ctx, d.desc, 380, 456, 520, 28, { size: 21, color: "#5a3a10", weight: 700, align: "left" });
      text(ctx, `\u82B1\u8D39 ${d.cost} \u9633\u5149`, 640, 560, { size: 20, color: "#8a4a10", weight: 900 });
      ctx.restore();
    }
    drawTrophyReward(ctx, pop) {
      text(ctx, this.reward.replay ? "\u5173\u5361\u5B8C\u6210\uFF01" : "\u80DC\u5229\uFF01", 640, 90, { size: 56, color: "#e8a010", stroke: "#5a2a00", lw: 10 });
      ctx.save();
      ctx.translate(640, 380);
      ctx.scale(pop * 2.2, pop * 2.2);
      drawTrophy(ctx, 0, 0, 1, this.t);
      ctx.restore();
      text(ctx, this.level.title || `\u5173\u5361 ${this.level.id}`, 640, 470, { size: 30, color: "#4a2a08", weight: 900 });
    }
    drawNoteReward(ctx, pop) {
      text(ctx, "\u4F60\u53D1\u73B0\u4E86\u4E00\u5F20\u7EB8\u6761\uFF01", 640, 70, { size: 46, color: "#e8a010", stroke: "#5a2a00", lw: 9 });
      ctx.save();
      ctx.translate(640, 320);
      ctx.scale(pop, pop);
      ctx.rotate(-0.03);
      rr(ctx, -300, -180, 600, 360, 6);
      fs(ctx, lg(ctx, 0, -180, 0, 180, [0, "#fffef4", 1, "#ece2c0"]), "#8a7a50", 2);
      ctx.strokeStyle = "rgba(80,110,200,0.35)";
      ctx.lineWidth = 1.5;
      for (let y = -130; y < 170; y += 36) {
        ctx.beginPath();
        ctx.moveTo(-270, y);
        ctx.lineTo(270, y);
        ctx.stroke();
      }
      ctx.strokeStyle = "rgba(220,80,80,0.4)";
      ctx.beginPath();
      ctx.moveTo(-230, -180);
      ctx.lineTo(-230, 180);
      ctx.stroke();
      wrapText(ctx, "\u4EB2\u7231\u7684\u90BB\u5C45\uFF1A\n\n" + this.reward.text + "\n\n\u2014\u2014\u50F5\u5C38\u4EEC", -210, -150, 460, 36, { size: 24, color: "#3a3050", weight: 600 });
      ctx.restore();
    }
    drawFinal(ctx, pop) {
      text(ctx, "\u606D\u559C\u4F60\u4FDD\u536B\u4E86\u5BB6\u56ED\uFF01", 640, 80, { size: 54, color: "#e8a010", stroke: "#5a2a00", lw: 10 });
      ctx.save();
      ctx.translate(640, 330);
      ctx.scale(pop * 2, pop * 2);
      drawTrophy(ctx, 0, 0, 1, this.t);
      ctx.restore();
      const st = save.data.stats;
      const lines = [
        `\u4F60\u5DF2\u5B8C\u6210\u5168\u90E8 ${ADVENTURE.length} \u4E2A\u5192\u9669\u5173\u5361\uFF01`,
        `\u7D2F\u8BA1\u6D88\u706D\u50F5\u5C38 ${st.zombiesKilled} \u53EA \xB7 \u79CD\u4E0B\u690D\u7269 ${st.plantsPlanted} \u682A \xB7 \u6536\u96C6\u9633\u5149 ${st.sunCollected}`,
        "\u5C0F\u6E38\u620F\u4E0E\u751F\u5B58\u6A21\u5F0F\u5DF2\u5168\u90E8\u5F00\u653E\uFF0C\u7EE7\u7EED\u6311\u6218\u5427\uFF01"
      ];
      lines.forEach((l, i) => text(ctx, l, 640, 430 + i * 38, { size: i === 0 ? 26 : 20, color: "#4a2a08", weight: 800 }));
    }
  };

  // src/scenes/gallery.js
  var GalleryScene = class {
    constructor() {
      this.t = 0;
      this.page = 0;
    }
    update(dt) {
      this.t += dt;
    }
    pointerDown() {
      this.page = (this.page + 1) % 6;
    }
    draw(ctx) {
      if (this.page >= 3) {
        const env = ["day", "night", "pool"][this.page - 3];
        const bg = getBackground(env);
        const camX = this.camX || 0;
        ctx.drawImage(bg.canvas, (camX - WORLD_MIN_X) * bg.scale, 0, 1280 * bg.scale, 720 * bg.scale, 0, 0, 1280, 720);
        ctx.save();
        ctx.translate(-camX, 0);
        drawWaterOverlay(ctx, env, this.t);
        ctx.restore();
        text(ctx, env, 640, 24, { size: 20, color: "#ff0", stroke: "#000" });
        return;
      }
      ctx.fillStyle = "#5a9a3a";
      ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 13; i++) for (let j = 0; j < 7; j++) {
        ctx.fillStyle = (i + j) % 2 ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.04)";
        ctx.fillRect(i * 100, j * 110, 100, 110);
      }
      const t = this.t;
      if (this.page === 0) {
        const keys = Object.keys(PLANT_ART);
        keys.forEach((k, i) => {
          const x = 60 + i % 10 * 122, y = 150 + Math.floor(i / 10) * 175;
          ctx.save();
          ctx.translate(x, y);
          const s = { t, phase: i, shoot: (t * 0.8 + i * 0.1) % 1.6 < 0.4 ? (t * 0.8 + i * 0.1) % 1.6 / 0.4 : 0, dmg: Math.floor(t / 2) % 3, grow: t % 4 / 4, rise: Math.min(1, t % 4), armed: true, hide: Math.floor(t / 2) % 2 };
          PLANT_ART[k](ctx, s);
          ctx.restore();
          text(ctx, k, x, y + 26, { size: 13, color: "#fff", stroke: "#000", lw: 3 });
        });
      } else if (this.page === 1) {
        const types = ["normal", "flag", "cone", "bucket", "pole", "newspaper", "screendoor", "football", "dancer", "backup", "ducky", "snorkel", "dolphin", "imp", "balloon", "digger", "pogo", "jackbox"];
        types.forEach((type, i) => {
          const x = 60 + i % 9 * 138, y = 260 + Math.floor(i / 9) * 330;
          const anims = ["walk", "eat", "idle"];
          const anim = anims[Math.floor(t / 3) % 3];
          const z = {
            type,
            t,
            walkPh: t * 4,
            eatPh: t * 8,
            anim,
            seed: i,
            armorKind: { cone: "cone", bucket: "bucket", football: "helmet" }[type],
            armorStage: Math.floor(t / 2) % 3,
            shieldStage: Math.floor(t / 2) % 3,
            held: { flag: "flag", newspaper: "paper", screendoor: "door", pole: "pole" }[type],
            hasArm: Math.floor(t / 5) % 2 === 0,
            hasHead: true,
            inWater: type === "ducky",
            ...type === "balloon" ? { anim: "float", held: "balloon" } : {},
            ...type === "pogo" ? { anim: "pogo", held: "pogo", pogoSquash: Math.max(0, Math.sin(t * 6)) } : {},
            ...type === "jackbox" ? { held: "jackbox", jackPop: t % 4 > 3 ? t % 4 - 3 : 0 } : {},
            ...type === "digger" ? { held: "pickaxe" } : {}
          };
          ctx.save();
          ctx.translate(x, y + (type === "balloon" ? -40 : type === "pogo" ? -Math.abs(Math.sin(t * 3)) * 40 : 0));
          drawZombieArt(ctx, z);
          ctx.restore();
          text(ctx, type + " " + anim, x, y + 20, { size: 13, color: "#fff", stroke: "#000", lw: 3 });
        });
      } else {
        const list = [
          { type: "gargantuar", x: 250, y: 600, hasImp: true },
          { type: "zomboni", x: 700, y: 600 },
          { type: "dolphin", x: 1050, y: 600, riding: true }
        ];
        for (const d of list) {
          ctx.save();
          ctx.translate(d.x, d.y);
          drawZombieArt(ctx, { ...d, t, walkPh: t * 3, anim: "walk", smashT: t % 3 / 3 });
          ctx.restore();
        }
      }
      text(ctx, "\u70B9\u51FB\u7FFB\u9875 " + (this.page + 1) + "/6", W / 2, 24, { size: 20, color: "#ff0", stroke: "#000" });
    }
  };

  // src/debug.js
  function installDebug(extra = {}) {
    window.PVZ = {
      director,
      display,
      // 以指定倍率离屏渲染当前画面并上传到开发服务器，返回保存路径
      async snap(name = "shot", scale = 2, region = null) {
        const saved = { canvas: display.canvas, ctx: display.ctx, k: display.k };
        const c = document.createElement("canvas");
        c.width = 1280 * scale;
        c.height = 720 * scale;
        display.canvas = c;
        display.ctx = c.getContext("2d");
        display.k = scale;
        try {
          director.draw();
        } finally {
          Object.assign(display, saved);
        }
        let out = c;
        if (region) {
          const [x, y, w, h] = region;
          out = document.createElement("canvas");
          out.width = w * scale;
          out.height = h * scale;
          out.getContext("2d").drawImage(c, x * scale, y * scale, w * scale, h * scale, 0, 0, w * scale, h * scale);
        }
        const r = await fetch("/__shot?name=" + name, { method: "POST", body: out.toDataURL("image/png") });
        return r.text();
      },
      // 手动推进模拟（页面在后台、rAF 暂停时用于自动化测试）
      step(seconds = 1) {
        const n = Math.round(seconds * 60);
        for (let i = 0; i < n; i++) director.update(1 / 60);
        return director.scene?.phase;
      },
      ...extra
    };
  }

  // src/bot.js
  var PRIORITY = ["sunflower", "sunshroom", "lilypad", "cactus", "blover", "plantern", "repeater", "threepeater", "splitpea", "peashooter", "snowpea", "fumeshroom", "puffshroom", "wallnut", "tallnut", "cherrybomb", "squash", "jalapeno", "gravebuster", "torchwood", "potatomine", "chomper", "iceshroom", "doomshroom", "spikeweed", "tanglekelp", "scaredyshroom", "magnetshroom", "hypnoshroom", "coffeebean", "seashroom", "starfruit", "pumpkin", "garlic"];
  function pickSeeds(scene) {
    const av = scene.availablePlants();
    const night = scene.board.isNight;
    const pool = scene.board.info.water.length > 0;
    const fog = !!scene.board.fogCols;
    const zs = scene.level.zombies || [];
    const ranked = PRIORITY.filter((p) => av.includes(p) && (!PLANTS[p].night || night) && (p !== "lilypad" || pool) && (p !== "tanglekelp" || pool) && (p !== "gravebuster" || scene.board.graves.length) && (p !== "plantern" || fog) && (p !== "cactus" && p !== "blover" || zs.includes("balloon")) && (p !== "splitpea" || zs.includes("digger")));
    return ranked.slice(0, scene.maxSlots);
  }
  function botStep(scene) {
    const b = scene.board;
    if (scene.phase !== "play") return;
    for (const s of b.suns) if (s.state === "rest" || s.state === "fall") s.collect();
    const ready = (t) => scene.slots.find((s) => s.type === t && s.cool <= 0 && b.sun >= PLANTS[t].cost);
    const raw = (t, c, r) => {
      const s = ready(t);
      if (!s || !b.canPlant(t, c, r).ok) return false;
      b.sun -= PLANTS[t].cost;
      s.cool = s.coolMax;
      b.placePlant(t, c, r);
      return true;
    };
    const place = (t, c, r) => {
      const cell = b.cellOf(c, r);
      if (!cell || cell.main || cell.grave) return false;
      if (b.isWater(r) && !PLANTS[t].aquatic && !cell.base) {
        if (!ready(t) || !ready("lilypad") || b.sun < PLANTS[t].cost + 25) return false;
        raw("lilypad", c, r);
      }
      return raw(t, c, r);
    };
    const rows = b.activeRows;
    const threat = (r) => b.zombies.filter((z) => z.isEnemy && z.alive && z.row === r && z.x < 1250);
    const shootersIn = (r) => b.plants.filter((p) => p.row === r && (p.kind === "shooter" || p.kind === "fume")).length;
    const shooterTypes = ["threepeater", "repeater", "splitpea", "fumeshroom", "snowpea", "peashooter", "seashroom", "puffshroom"];
    const bestShooter = () => shooterTypes.find((t) => ready(t) && (t !== "threepeater" || b.sun >= 325));
    const addShooter = (r) => {
      const t = bestShooter();
      if (!t) return false;
      const cols = t === "puffshroom" ? [4, 5, 3, 6] : t === "fumeshroom" ? [3, 2, 4] : [2, 3, 4, 5];
      for (const c of cols) if (place(t, c, r)) return true;
      return false;
    };
    for (const r of rows) {
      const near = threat(r).filter((z) => z.x < 250 + 4 * 100);
      if (near.length) {
        const z = near.sort((a, b2) => a.x - b2.x)[0];
        const c = Math.max(0, Math.min(COLS - 1, Math.floor((z.x - 250) / 100)));
        if (raw("squash", Math.max(0, c - 1), r) || raw("cherrybomb", c, r) || raw("jalapeno", 0, r) || raw("iceshroom", 0, r) || raw("chomper", Math.max(0, c - 1), r)) return;
      }
    }
    const balloons = b.zombies.filter((z) => z.isEnemy && z.balloonUp && z.x < 1250);
    if (balloons.length) {
      if (balloons.some((z) => z.x < 250 + 300) && raw("blover", 0, rows[0])) return;
      for (const z of balloons) {
        const hasCactus = b.plants.some((p) => p.type === "cactus" && p.row === z.row);
        if (!hasCactus) {
          for (const c of [2, 3, 1, 4]) if (place("cactus", c, z.row)) return;
        }
      }
    }
    for (const g of b.graves) if (raw("gravebuster", g.col, g.row)) return;
    const producer = (b.isNight ? ["sunshroom", "sunflower"] : ["sunflower", "sunshroom"]).find((t) => scene.slots.some((s) => s.type === t));
    const prodIn = (r) => b.plants.filter((p) => p.row === r && p.kind === "producer").length;
    const order = rows.slice().sort((a, b2) => threat(b2).length - threat(a).length || shootersIn(a) - shootersIn(b2));
    for (const r of order) if (threat(r).length && shootersIn(r) === 0 && addShooter(r)) return;
    if (producer) {
      for (const r of rows) if (prodIn(r) < 1 && (place(producer, 0, r) || place(producer, 1, r))) return;
    }
    if (b.fogCols && b.plants.filter((p) => p.type === "plantern").length < 2) {
      for (const r of [1, 4]) if (b.activeRow(r) && !b.plants.some((p) => p.type === "plantern" && p.row === r)) {
        if (place("plantern", 9 - b.fogCols - 1, r)) return;
      }
    }
    for (const r of order) if (shootersIn(r) < 1 && addShooter(r)) return;
    if (producer && b.time < 200) {
      for (const r of rows) if (prodIn(r) < 2 && (place(producer, 1, r) || place(producer, 0, r))) return;
    }
    for (let k = 2; k <= 4; k++) for (const r of order) if (shootersIn(r) < k && addShooter(r)) return;
    for (const r of order) if (threat(r).length) {
      if (place("tallnut", 6, r) || place("wallnut", 6, r)) return;
    }
    if (raw("tanglekelp", 6, rows.find((r) => b.isWater(r) && threat(r).length) ?? -1)) return;
  }
  async function runBot(director2, GameScene2, level, maxSeconds = 600) {
    const scene = new GameScene2(level, { source: "bot" });
    director2.swap(scene);
    let t = 0;
    while (t < maxSeconds) {
      if (scene.phase === "select") {
        scene.chosen = pickSeeds(scene);
        scene.confirmSelect();
      }
      for (let i = 0; i < 30; i++) director2.update(1 / 60);
      t += 0.5;
      botStep(scene);
      if (scene.phase === "won" || scene.phase === "lost" || scene.phase === "award") break;
    }
    const b = scene.board;
    return { level: level.id, result: scene.phase, time: Math.round(t), wave: b.waves.wave + "/" + b.waves.total, mowersLeft: b.mowers.filter((m) => m.state === "idle").length, kills: b.kills };
  }

  // src/main.js
  var Scenes7 = { MenuScene, GameScene, LevelSelectScene, MinigameScene, AlmanacScene, AwardScene, TitleScene };
  registerScenes(Scenes7);
  registerMenuScenes(Scenes7);
  registerLevelScenes(Scenes7);
  registerMinigameScenes(Scenes7);
  registerAlmanacScenes(Scenes7);
  registerAwardScenes(Scenes7);
  display.init();
  save.load();
  input.init(director);
  if (location.hash === "#gallery") director.go(new GalleryScene(), { fade: false });
  else director.go(new TitleScene(() => new MenuScene()), { fade: false });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      const s = director.scene;
      if (s && s.pause && s.phase === "play") s.pause();
      if (audio.ctx && audio.ctx.state === "running") audio.ctx.suspend();
    } else if (audio.ctx && audio.ctx.state === "suspended") audio.ctx.resume();
  });
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) || location.search.includes("debug")) installDebug({
    // 调试：直接进入某关，如 PVZ.play('2-6')
    play(id, source = "adventure") {
      const L = findLevel(id);
      if (L) director.go(new GameScene(L, { source }), { fade: false });
      return !!L;
    },
    unlockAll() {
      save.unlockAll(ADVENTURE.length, PLANT_ORDER);
    },
    get game() {
      return director.scene?.board ? director.scene : null;
    },
    sun(n = 1e3) {
      const g = director.scene;
      if (g?.board) g.board.sun += n;
    },
    spawn(type, row = 2, x) {
      const g = director.scene;
      return g?.board?.spawnZombie(type, row, x);
    },
    plant(type, col, row) {
      const g = director.scene;
      return g?.board?.placePlant(type, col, row);
    },
    // 机器人自动游玩，检验难度：await PVZ.bot('1-4')
    bot(id, maxSeconds) {
      return runBot(director, GameScene, findLevel(id), maxSeconds);
    }
  });
  loop.start((dt) => director.update(dt), () => director.draw());
})();
//# sourceMappingURL=bundle.js.map
