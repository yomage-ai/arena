// 音频引擎：全部音效由 WebAudio 实时合成（无任何音频文件）。
import { save } from './save.js';
import { rand } from './util.js';

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.last = Object.create(null);
    this.voices = 0;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = (this.ctx = new AC());
    this.master = c.createGain();
    this.master.gain.value = 0.9;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 18;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
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

    // 共享噪声缓冲
    const len = c.sampleRate * 2;
    this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // 棕噪声（更低沉，用于爆炸隆隆声）
    this.brownBuf = c.createBuffer(1, len, c.sampleRate);
    const b = this.brownBuf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; b[i] = last * 3.5; }

    this.distCurve = this.makeDistortion(30);
    this.applyVolumes();
    this.ready = true;
    if (c.state === 'suspended') c.resume();
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
      const x = (i * 2) / n - 1;
      curve[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  applyVolumes() {
    if (!this.ctx) return;
    const s = save.settings;
    this.sfxBus.gain.setTargetAtTime(s.sfx, this.ctx.currentTime, 0.02);
    this.musicBus.gain.setTargetAtTime(s.music * 0.55, this.ctx.currentTime, 0.02);
  }

  get t() { return this.ctx.currentTime; }

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
      const lg = c.createGain();
      lg.gain.value = o.vib;
      lfo.connect(lg).connect(osc.frequency);
      lfo.start(t);
      lfo.stop(t + dur + 0.1);
    }
    const g = c.createGain();
    const peak = o.gain ?? 0.3;
    const a = o.attack ?? 0.004;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    if (o.hold) g.gain.setValueAtTime(peak, t + a + o.hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = osc;
    if (o.filter) {
      const fl = c.createBiquadFilter();
      fl.type = o.filter;
      fl.frequency.setValueAtTime(o.ff || 1000, t);
      if (o.ffEnd) fl.frequency.exponentialRampToValueAtTime(o.ffEnd, t + dur);
      fl.Q.value = o.q ?? 1;
      node.connect(fl);
      node = fl;
    }
    node.connect(g);
    g.connect(o.dest || this.curDest || this.sfxBus);
    if (o.verb) { const s = c.createGain(); s.gain.value = o.verb; g.connect(s); s.connect(this.reverbSend); }
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
    fl.type = o.type || 'bandpass';
    fl.frequency.setValueAtTime(o.f || 1000, t);
    if (o.end) fl.frequency.exponentialRampToValueAtTime(o.end, t + (o.slide || dur));
    fl.Q.value = o.q ?? 1;
    const g = c.createGain();
    const peak = o.gain ?? 0.3;
    const a = o.attack ?? 0.003;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    if (o.hold) g.gain.setValueAtTime(peak, t + a + o.hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(fl).connect(g);
    let out = g;
    if (o.dist) {
      const ws = c.createWaveShaper();
      ws.curve = this.distCurve;
      g.connect(ws);
      out = ws;
    }
    out.connect(o.dest || this.curDest || this.sfxBus);
    if (o.verb) { const s = c.createGain(); s.gain.value = o.verb; out.connect(s); s.connect(this.reverbSend); }
    src.start(t, rand(0, 1));
    src.stop(t + dur + 0.05);
  }

  // 元音共振峰（僵尸呻吟 / 尖叫）
  voice(t, dur, o) {
    const c = this.ctx;
    const src = c.createOscillator();
    src.type = 'sawtooth';
    src.frequency.setValueAtTime(o.f, t);
    if (o.contour) {
      const n = o.contour.length;
      o.contour.forEach((m, i) => src.frequency.linearRampToValueAtTime(o.f * m, t + (dur * (i + 1)) / n));
    }
    const lfo = c.createOscillator();
    lfo.frequency.value = o.vibRate || 5;
    const lg = c.createGain();
    lg.gain.value = o.vib ?? 3;
    lfo.connect(lg).connect(src.frequency);
    const out = c.createGain();
    const peak = o.gain ?? 0.25;
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(peak, t + (o.attack ?? 0.12));
    out.gain.setValueAtTime(peak, t + dur * 0.7);
    out.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const formants = o.formants || [[500, 700], [1000, 1200], [2400, 2500]];
    formants.forEach(([a, b], i) => {
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = o.q ?? 7;
      bp.frequency.setValueAtTime(a, t);
      bp.frequency.linearRampToValueAtTime(b, t + dur);
      const fg = c.createGain();
      fg.gain.value = [1, 0.6, 0.25][i] ?? 0.2;
      src.connect(bp).connect(fg).connect(out);
    });
    // 气声
    if (o.breath) this.noise(t, dur, { type: 'bandpass', f: formants[0][0] * 1.5, q: 2, gain: o.breath, attack: 0.1, dest: o.dest });
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
    try { fn(this, now + (o.delay || 0), o); } catch (e) { console.warn('[sfx]', name, e.message); }
    this.curDest = null;
  }
}

// 各音效的响度微调（根据离线渲染测得的峰值校准）
const TRIM = {
  puff: 2, freezehit: 2, shieldhit: 2.5, shovel: 2.5, seedlift: 1.8, sunproduce: 3, wakeup: 3, dance: 4, conveyor: 4,
  groan: 2.2, chomp: 2, headfall: 1.5, pole: 2, impthrow: 2, zomboni: 2.5, shred: 2, ready: 2, set: 2, spike: 1.6,
  pickup: 2, tap: 1.5, button: 1.5, jackmusic: 2, combo: 2, plastic: 1.4, paper: 1.3, squash: 1.8, kelp: 1.5, magnet: 1.6, gravebuster: 1.6,
};

const THROTTLE = {
  jackmusic: 0.8, thunder: 2, wind: 0.5,
  shoot: 0.05, splat: 0.04, chomp: 0.12, groan: 1.2, metal: 0.05, plastic: 0.05, paper: 0.06,
  sun: 0.06, hover: 0.05, spike: 0.2, fume: 0.15, firepea: 0.05, freezehit: 0.05, dirt: 0.3,
};

const SFX = {
  // —— 植物 ——
  shoot(a, t) {
    a.tone('sine', rand(480, 560), t, 0.1, { end: 170, gain: 0.32 });
    a.noise(t, 0.05, { type: 'highpass', f: 2500, gain: 0.08 });
  },
  puff(a, t) {
    a.noise(t, 0.12, { type: 'bandpass', f: 1400, end: 600, gain: 0.25, q: 1.5 });
    a.tone('sine', 700, t, 0.08, { end: 300, gain: 0.12 });
  },
  splat(a, t) {
    a.noise(t, 0.14, { type: 'bandpass', f: rand(900, 1300), end: 250, q: 1.3, gain: 0.45 });
    a.tone('sine', 190, t, 0.09, { end: 70, gain: 0.3 });
  },
  firepea(a, t) {
    a.noise(t, 0.3, { type: 'bandpass', f: 1800, end: 400, q: 0.8, gain: 0.35 });
    a.tone('sine', 150, t, 0.12, { end: 60, gain: 0.25 });
  },
  freezehit(a, t) {
    a.tone('sine', 2600, t, 0.12, { end: 1500, gain: 0.08 });
    a.noise(t, 0.12, { type: 'bandpass', f: 1100, end: 300, q: 1.3, gain: 0.35 });
  },
  metal(a, t) {
    [520, 1320, 2230, 3180].forEach((f, i) => a.tone('sine', f * rand(0.97, 1.03), t, 0.35 - i * 0.05, { gain: 0.1 - i * 0.015 }));
    a.noise(t, 0.05, { type: 'highpass', f: 3000, gain: 0.15 });
    a.tone('triangle', 260, t, 0.08, { end: 150, gain: 0.2 });
  },
  plastic(a, t) {
    a.tone('triangle', rand(330, 380), t, 0.08, { end: 200, gain: 0.3 });
    a.noise(t, 0.05, { type: 'bandpass', f: 1300, q: 2, gain: 0.25 });
  },
  paper(a, t) {
    a.noise(t, 0.07, { type: 'highpass', f: 2800, gain: 0.25 });
  },
  shieldhit(a, t) {
    [410, 980, 1760].forEach(f => a.tone('square', f, t, 0.12, { gain: 0.04, filter: 'lowpass', ff: 2500 }));
    a.noise(t, 0.08, { type: 'bandpass', f: 2500, q: 3, gain: 0.2 });
  },
  plant(a, t) {
    a.noise(t, 0.16, { type: 'lowpass', f: 700, end: 200, gain: 0.55 });
    a.tone('sine', 150, t, 0.14, { end: 55, gain: 0.45 });
    a.noise(t + 0.02, 0.08, { type: 'highpass', f: 3500, gain: 0.08 });
  },
  plantwater(a, t) {
    a.noise(t, 0.35, { type: 'bandpass', f: 2600, end: 700, q: 1.2, gain: 0.35 });
    for (let i = 0; i < 4; i++) a.tone('sine', rand(600, 900), t + i * 0.04, 0.08, { end: rand(1400, 2000), gain: 0.05 });
  },
  seedlift(a, t) {
    a.tone('triangle', 1250, t, 0.04, { gain: 0.18 });
    a.tone('sine', 1900, t + 0.02, 0.05, { gain: 0.1 });
  },
  tap(a, t) {
    a.tone('sine', 720, t, 0.06, { end: 520, gain: 0.2 });
  },
  hover(a, t) {
    a.tone('sine', 1500, t, 0.025, { gain: 0.035 });
  },
  button(a, t) {
    a.noise(t, 0.09, { type: 'lowpass', f: 900, gain: 0.35 });
    a.tone('sine', 320, t, 0.1, { end: 180, gain: 0.25 });
    a.tone('triangle', 900, t, 0.04, { gain: 0.08 });
  },
  buzzer(a, t) {
    a.tone('square', 110, t, 0.12, { gain: 0.12, filter: 'lowpass', ff: 900 });
    a.tone('square', 104, t + 0.14, 0.14, { gain: 0.12, filter: 'lowpass', ff: 900 });
  },
  sun(a, t) {
    [1046.5, 1318.5, 1568, 2093].forEach((f, i) => a.tone('sine', f, t + i * 0.035, 0.28, { gain: 0.1, verb: 0.2 }));
    a.tone('triangle', 3136, t + 0.1, 0.2, { gain: 0.03 });
  },
  sunproduce(a, t) {
    a.tone('sine', 880, t, 0.25, { end: 1760, gain: 0.05, verb: 0.2 });
  },
  shovel(a, t) {
    a.noise(t, 0.18, { type: 'bandpass', f: 900, end: 400, q: 1.5, gain: 0.45 });
    a.tone('triangle', 1600, t, 0.06, { gain: 0.08 });
  },
  chomp(a, t) {
    for (let i = 0; i < 2; i++) {
      a.noise(t + i * 0.09, 0.07, { type: 'bandpass', f: rand(550, 800), q: 2.5, gain: 0.45 });
      a.tone('square', 95, t + i * 0.09, 0.05, { gain: 0.06, filter: 'lowpass', ff: 400 });
    }
  },
  bigchomp(a, t) {
    a.noise(t, 0.12, { type: 'bandpass', f: 500, q: 1.5, gain: 0.6 });
    a.tone('sine', 220, t, 0.12, { end: 80, gain: 0.4 });
    a.noise(t + 0.15, 0.1, { type: 'bandpass', f: 700, q: 2, gain: 0.4 });
  },
  gulp(a, t) {
    a.tone('sine', 320, t, 0.28, { end: 110, gain: 0.35 });
    a.tone('sine', 180, t + 0.18, 0.2, { end: 90, gain: 0.25 });
  },
  explode(a, t, o) {
    const big = o.big || 1;
    a.noise(t, 1.1 * big, { type: 'lowpass', f: 3200, end: 90, gain: 0.9, dist: true, verb: 0.5 });
    a.noise(t, 1.6 * big, { brown: true, type: 'lowpass', f: 400, end: 60, gain: 0.9, attack: 0.01 });
    a.tone('sine', 95, t, 0.7 * big, { end: 28, gain: 0.95 });
    a.tone('triangle', 60, t + 0.02, 0.5, { end: 30, gain: 0.5 });
  },
  doom(a, t) {
    SFX.explode(a, t, { big: 1.8 });
    a.tone('sine', 45, t + 0.1, 2.5, { end: 22, gain: 0.9, attack: 0.05 });
    a.noise(t + 0.3, 2.8, { brown: true, type: 'lowpass', f: 300, end: 40, gain: 0.8, attack: 0.2, verb: 0.6 });
  },
  spudow(a, t) {
    a.noise(t, 0.6, { type: 'lowpass', f: 2500, end: 120, gain: 0.8, dist: true, verb: 0.3 });
    a.tone('sine', 120, t, 0.35, { end: 40, gain: 0.8 });
    a.noise(t + 0.05, 0.5, { type: 'bandpass', f: 400, q: 0.7, gain: 0.4 });
  },
  armed(a, t) {
    a.tone('sine', 380, t, 0.12, { end: 900, gain: 0.3 });
    a.noise(t, 0.1, { type: 'lowpass', f: 600, gain: 0.3 });
  },
  fuse(a, t) {
    a.noise(t, 0.9, { type: 'highpass', f: 3000, gain: 0.12, attack: 0.05 });
    a.tone('sine', 300, t, 0.9, { end: 900, gain: 0.08, lin: true });
  },
  fume(a, t) {
    a.noise(t, 0.55, { type: 'bandpass', f: 700, end: 2400, q: 0.8, gain: 0.3, attack: 0.05 });
  },
  jalapeno(a, t) {
    a.noise(t, 1.4, { type: 'lowpass', f: 2200, end: 300, gain: 0.8, attack: 0.08, dist: true, verb: 0.4 });
    for (let i = 0; i < 10; i++) a.noise(t + rand(0, 1.1), 0.04, { type: 'highpass', f: 4000, gain: 0.15 });
    a.tone('sine', 80, t, 0.8, { end: 40, gain: 0.6 });
  },
  freeze(a, t) {
    for (let i = 0; i < 14; i++) a.tone('sine', rand(1800, 5200), t + rand(0, 0.5), rand(0.4, 1.2), { gain: 0.035, verb: 0.6 });
    a.noise(t, 1.2, { type: 'highpass', f: 5000, gain: 0.15, attack: 0.3 });
    a.noise(t + 0.4, 0.2, { type: 'bandpass', f: 1800, q: 3, gain: 0.3 });
  },
  hypno(a, t) {
    a.tone('sine', 520, t, 0.9, { vib: 90, vibRate: 7, gain: 0.18, verb: 0.4 });
    a.tone('triangle', 780, t + 0.1, 0.8, { vib: 60, vibRate: 5, gain: 0.08 });
  },
  squash(a, t) {
    a.voice(t, 0.35, { f: 150, formants: [[300, 350], [800, 900]], gain: 0.25, vib: 2 });
  },
  thud(a, t) {
    a.noise(t, 0.3, { type: 'lowpass', f: 500, end: 80, gain: 0.8 });
    a.tone('sine', 110, t, 0.3, { end: 35, gain: 0.8 });
  },
  splash(a, t) {
    a.noise(t, 0.5, { type: 'bandpass', f: 3000, end: 500, q: 0.9, gain: 0.45 });
    for (let i = 0; i < 6; i++) a.tone('sine', rand(500, 900), t + rand(0.05, 0.4), 0.07, { end: rand(1500, 2500), gain: 0.05 });
  },
  kelp(a, t) {
    SFX.splash(a, t);
    for (let i = 0; i < 8; i++) a.tone('sine', rand(200, 400), t + 0.3 + i * 0.08, 0.1, { end: rand(700, 1100), gain: 0.07 });
  },
  spike(a, t) {
    a.tone('triangle', 900, t, 0.05, { gain: 0.1 });
    a.noise(t, 0.05, { type: 'highpass', f: 3000, gain: 0.12 });
  },
  tire(a, t) {
    a.noise(t, 0.08, { type: 'lowpass', f: 1500, gain: 0.8 });
    a.noise(t + 0.05, 0.9, { type: 'highpass', f: 2500, end: 5000, gain: 0.25, attack: 0.02 });
  },
  grave(a, t) {
    a.noise(t, 0.8, { brown: true, type: 'lowpass', f: 500, gain: 0.7, attack: 0.05 });
    for (let i = 0; i < 5; i++) a.noise(t + rand(0, 0.6), 0.06, { type: 'bandpass', f: rand(1500, 3000), q: 3, gain: 0.2 });
  },
  gravebuster(a, t) {
    for (let i = 0; i < 6; i++) a.noise(t + i * 0.35, 0.12, { type: 'bandpass', f: rand(500, 900), q: 2, gain: 0.3 });
  },
  magnet(a, t) {
    a.tone('sawtooth', 110, t, 0.6, { end: 440, gain: 0.08, filter: 'lowpass', ff: 1200 });
    a.tone('sine', 880, t + 0.4, 0.3, { end: 1760, gain: 0.08 });
  },
  coffee(a, t) {
    a.tone('sine', 600, t, 0.15, { end: 1200, gain: 0.15 });
    a.noise(t + 0.1, 0.3, { type: 'highpass', f: 4000, gain: 0.1 });
  },
  wakeup(a, t) {
    a.tone('triangle', 500, t, 0.1, { end: 900, gain: 0.12 });
  },
  // —— 僵尸 ——
  groan(a, t) {
    const f = rand(70, 115);
    const kind = (Math.random() * 3) | 0;
    if (kind === 0) {
      // “脑……子……”
      a.voice(t, 0.35, { f, formants: [[350, 400], [900, 1000]], gain: 0.16, breath: 0.03 });
      a.voice(t + 0.33, 0.9, { f: f * 1.08, contour: [1.05, 1, 0.9], formants: [[750, 700], [1200, 1100], [2500, 2400]], gain: 0.2, breath: 0.04 });
      a.voice(t + 1.2, 0.35, { f: f * 0.95, formants: [[320, 300], [2100, 2300]], gain: 0.12 });
      a.noise(t + 1.45, 0.2, { type: 'highpass', f: 4500, gain: 0.05, attack: 0.05 });
    } else if (kind === 1) {
      a.voice(t, rand(1, 1.5), { f, contour: [1.1, 1.2, 0.85], formants: [[450, 650], [900, 1150], [2400, 2500]], gain: 0.22, breath: 0.05 });
    } else {
      a.voice(t, 0.5, { f: f * 1.2, contour: [1.2, 0.9], formants: [[600, 500], [1100, 900]], gain: 0.2 });
      a.voice(t + 0.55, 0.7, { f, contour: [1.1, 0.8], formants: [[500, 450], [1000, 900]], gain: 0.18 });
    }
  },
  awooga(a, t) {
    for (let i = 0; i < 2; i++) {
      const s = t + i * 0.75;
      a.tone('sawtooth', 190, s, 0.62, { end: 300, slide: 0.35, gain: 0.14, filter: 'bandpass', ff: 900, q: 1.2, attack: 0.03, hold: 0.2 });
      a.tone('square', 192, s, 0.62, { end: 302, slide: 0.35, gain: 0.05, filter: 'lowpass', ff: 1400, attack: 0.03, hold: 0.2 });
    }
  },
  hugewave(a, t) {
    [55, 82.4, 110].forEach((f, i) => a.tone('sawtooth', f, t, 2.6, { gain: 0.12, filter: 'lowpass', ff: 150, ffEnd: 1400, attack: 0.3, hold: 1.2, verb: 0.4, detune: i * 5 }));
    for (let i = 0; i < 16; i++) a.noise(t + i * 0.1, 0.18, { brown: true, type: 'lowpass', f: 300, gain: 0.25 + i * 0.03 });
    a.noise(t + 1.7, 0.8, { type: 'lowpass', f: 2000, end: 200, gain: 0.5, verb: 0.5 });
  },
  finalwave(a, t) {
    [65.4, 98, 130.8, 155.6].forEach(f => a.tone('sawtooth', f, t, 2.2, { gain: 0.1, filter: 'lowpass', ff: 2000, ffEnd: 300, attack: 0.01, verb: 0.5 }));
    [220, 530, 870, 1340].forEach((f, i) => a.tone('sine', f, t, 2.5 - i * 0.3, { gain: 0.08 }));
    a.noise(t, 1.2, { type: 'lowpass', f: 3000, end: 200, gain: 0.5, verb: 0.6 });
  },
  dirt(a, t) {
    a.noise(t, 0.6, { brown: true, type: 'lowpass', f: 600, gain: 0.6, attack: 0.05 });
    a.noise(t + 0.1, 0.4, { type: 'bandpass', f: 1200, q: 1, gain: 0.15 });
  },
  headfall(a, t) {
    a.tone('sine', 200, t, 0.12, { end: 90, gain: 0.3 });
    a.noise(t, 0.08, { type: 'lowpass', f: 800, gain: 0.25 });
  },
  zombiefall(a, t) {
    a.noise(t, 0.25, { type: 'lowpass', f: 450, end: 100, gain: 0.5 });
    a.tone('sine', 90, t, 0.2, { end: 45, gain: 0.35 });
  },
  pole(a, t) {
    a.tone('sine', 220, t, 0.45, { end: 700, gain: 0.2, vib: 20, vibRate: 12 });
    a.noise(t, 0.4, { type: 'bandpass', f: 800, end: 2400, q: 1, gain: 0.2 });
  },
  newspaper(a, t) {
    a.noise(t, 0.25, { type: 'highpass', f: 2000, gain: 0.4 });
    a.voice(t + 0.25, 0.7, { f: 160, contour: [1.4, 1.6, 1.2], formants: [[700, 800], [1200, 1300], [2600, 2600]], gain: 0.3, vib: 8 });
  },
  dance(a, t) {
    a.tone('square', 440, t, 0.4, { end: 880, gain: 0.05, filter: 'lowpass', ff: 2000 });
  },
  smash(a, t) {
    a.noise(t, 0.5, { brown: true, type: 'lowpass', f: 400, gain: 0.9 });
    a.tone('sine', 70, t, 0.5, { end: 25, gain: 0.9 });
    a.noise(t, 0.15, { type: 'bandpass', f: 1500, q: 1, gain: 0.3 });
  },
  impthrow(a, t) {
    a.noise(t, 0.5, { type: 'bandpass', f: 600, end: 2500, q: 1, gain: 0.25 });
    a.tone('sine', 400, t, 0.6, { end: 1200, gain: 0.1, vib: 30, vibRate: 10 });
  },
  zomboni(a, t) {
    a.tone('sawtooth', 55, t, 1.2, { gain: 0.08, filter: 'lowpass', ff: 300, vib: 4, vibRate: 18 });
  },
  vehicle(a, t) {
    SFX.explode(a, t, { big: 0.8 });
    [300, 720, 1200].forEach(f => a.tone('sine', f, t, 0.5, { gain: 0.06 }));
  },
  mower(a, t) {
    a.tone('sawtooth', 62, t, 1.8, { gain: 0.16, filter: 'lowpass', ff: 500, vib: 6, vibRate: 22, attack: 0.05 });
    a.tone('square', 124, t, 1.8, { gain: 0.05, filter: 'lowpass', ff: 700, vib: 10, vibRate: 22, attack: 0.05 });
    a.noise(t, 1.8, { type: 'bandpass', f: 350, q: 0.8, gain: 0.2, attack: 0.05 });
  },
  shred(a, t) {
    a.noise(t, 0.3, { type: 'bandpass', f: 1200, q: 0.7, gain: 0.35 });
    a.tone('square', 80, t, 0.25, { gain: 0.06, filter: 'lowpass', ff: 600 });
  },
  // —— 界面 / 流程 ——
  ready(a, t) { a.tone('triangle', 392, t, 0.35, { gain: 0.25 }); a.tone('sine', 784, t, 0.3, { gain: 0.08 }); },
  set(a, t) { a.tone('triangle', 494, t, 0.35, { gain: 0.25 }); a.tone('sine', 988, t, 0.3, { gain: 0.08 }); },
  go(a, t) {
    [523, 659, 784, 1047].forEach(f => a.tone('triangle', f, t, 0.7, { gain: 0.12, verb: 0.3 }));
    a.noise(t, 0.5, { type: 'highpass', f: 5000, gain: 0.12 });
  },
  win(a, t) {
    const n = [523.3, 659.3, 784, 1046.5, 784, 1046.5, 1318.5];
    n.forEach((f, i) => a.tone('square', f, t + i * 0.11, 0.25, { gain: 0.06, filter: 'lowpass', ff: 3000 }));
    n.forEach((f, i) => a.tone('triangle', f, t + i * 0.11, 0.3, { gain: 0.12 }));
    [523.3, 659.3, 784, 1046.5].forEach(f => a.tone('triangle', f, t + 0.8, 1.6, { gain: 0.08, verb: 0.5 }));
  },
  award(a, t) {
    const n = [392, 523, 659, 784, 1046, 1318, 1568, 2093];
    n.forEach((f, i) => a.tone('sine', f, t + i * 0.07, 0.9, { gain: 0.08, verb: 0.6 }));
    a.noise(t, 1.5, { type: 'highpass', f: 6000, gain: 0.08, attack: 0.4 });
  },
  lose(a, t) {
    a.voice(t, 1.3, { f: 420, contour: [1.6, 1.9, 1.4, 1.1], formants: [[800, 700], [1300, 1150], [2800, 2600]], gain: 0.28, vib: 25, vibRate: 7, breath: 0.08, q: 5 });
    [110, 130.8, 155.6, 185].forEach(f => a.tone('sawtooth', f, t + 1.1, 2.5, { gain: 0.06, filter: 'lowpass', ff: 1500, ffEnd: 200, verb: 0.6 }));
    a.noise(t + 1.1, 1.5, { brown: true, type: 'lowpass', f: 300, gain: 0.6 });
  },
  pause(a, t) { a.tone('sine', 660, t, 0.08, { gain: 0.15 }); a.tone('sine', 440, t + 0.08, 0.1, { gain: 0.15 }); },
  unpause(a, t) { a.tone('sine', 440, t, 0.08, { gain: 0.15 }); a.tone('sine', 660, t + 0.08, 0.1, { gain: 0.15 }); },
  flag(a, t) { a.tone('triangle', 660, t, 0.2, { gain: 0.15 }); a.tone('triangle', 880, t + 0.1, 0.3, { gain: 0.15 }); },
  bowl(a, t) {
    a.noise(t, 0.35, { brown: true, type: 'lowpass', f: 350, gain: 0.5 });
    a.tone('triangle', 160, t, 0.2, { end: 110, gain: 0.2 });
  },
  bowlhit(a, t) {
    a.tone('sine', 280, t, 0.18, { end: 110, gain: 0.5 });
    a.tone('triangle', 900, t, 0.05, { gain: 0.2 });
    a.noise(t, 0.08, { type: 'bandpass', f: 1200, q: 2, gain: 0.3 });
  },
  combo(a, t, o) {
    const base = 523 * Math.pow(1.12, Math.min(8, o.n || 1));
    a.tone('square', base, t, 0.15, { gain: 0.06, filter: 'lowpass', ff: 3000 });
    a.tone('square', base * 1.5, t + 0.08, 0.2, { gain: 0.06, filter: 'lowpass', ff: 3000 });
  },
  whack(a, t) {
    a.noise(t, 0.12, { type: 'lowpass', f: 1200, gain: 0.7 });
    a.tone('sine', 180, t, 0.15, { end: 60, gain: 0.6 });
    a.tone('triangle', 700, t, 0.04, { gain: 0.2 });
  },
  vase(a, t) {
    for (let i = 0; i < 10; i++) a.tone('sine', rand(1800, 5000), t + rand(0, 0.12), rand(0.05, 0.2), { gain: 0.06 });
    a.noise(t, 0.3, { type: 'highpass', f: 2500, end: 1200, gain: 0.45 });
    a.noise(t, 0.2, { type: 'lowpass', f: 600, gain: 0.3 });
  },
  pickup(a, t) {
    a.tone('sine', 660, t, 0.1, { end: 990, gain: 0.18 });
  },
  gong(a, t) {
    [180, 432, 707, 1053, 1500].forEach((f, i) => a.tone('sine', f, t, 3 - i * 0.4, { gain: 0.09, verb: 0.6 }));
  },
  conveyor(a, t) { a.tone('square', 220, t, 0.03, { gain: 0.03, filter: 'lowpass', ff: 800 }); },
  sodroll(a, t) { a.noise(t, 1.6, { brown: true, type: 'lowpass', f: 700, gain: 0.35, attack: 0.1 }); },
  ice(a, t) { a.noise(t, 0.15, { type: 'highpass', f: 5000, gain: 0.2 }); a.tone('sine', 3200, t, 0.2, { gain: 0.04 }); },
  pop(a, t) {
    a.noise(t, 0.08, { type: 'highpass', f: 1800, gain: 0.6 });
    a.tone('sine', 900, t, 0.08, { end: 300, gain: 0.25 });
  },
  wind(a, t) {
    a.noise(t, 1.6, { type: 'bandpass', f: 400, end: 1600, q: 0.6, gain: 0.5, attack: 0.25, verb: 0.3 });
    a.noise(t + 0.2, 1.2, { type: 'bandpass', f: 900, end: 300, q: 0.8, gain: 0.25, attack: 0.3 });
  },
  thunder(a, t) {
    a.noise(t, 0.15, { type: 'highpass', f: 2000, gain: 0.35 });
    a.noise(t, 3, { brown: true, type: 'lowpass', f: 500, end: 60, gain: 0.9, attack: 0.05, verb: 0.7 });
    for (let i = 0; i < 5; i++) a.noise(t + 0.2 + i * 0.35 + rand(0, 0.2), 0.5, { brown: true, type: 'lowpass', f: 300, gain: 0.5 });
  },
  jackmusic(a, t) {
    const notes = [1046.5, 1318.5, 1568, 1318.5, 1760, 1568];
    notes.forEach((f, i) => a.tone('sine', f, t + i * 0.14, 0.3, { gain: 0.05, verb: 0.3 }));
  },
};

export const audio = new AudioEngine();
