// 音乐音序器：用简易文本谱写的原创曲目，WebAudio 实时演奏（提前调度，保证节拍精准）。
// 记谱：每个空格分隔的记号 = 1 个十六分音符格；'.' 延长上一个音，'-' 休止，'|' 仅作小节线。
// 和弦用 '+' 连接，如 A3+C4+E4。鼓轨每个字符一格：k 底鼓 s 军鼓 h 闭镲 o 开镲 t 通鼓 c 拍手 x 底鼓+镲。
import { audio } from './audio.js';

const NOTE_INDEX = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function noteFreq(name) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) return 0;
  let n = NOTE_INDEX[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  const oct = parseInt(m[3], 10);
  const midi = (oct + 1) * 12 + n;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function parseMelody(str) {
  const toks = str.split(/\s+/).filter(t => t && t !== '|');
  const events = [];
  let cur = null;
  toks.forEach((tok, i) => {
    if (tok === '.') { if (cur) cur.len++; return; }
    if (tok === '-') { cur = null; return; }
    let vel = 1;
    if (tok.endsWith('!')) { vel = 1.35; tok = tok.slice(0, -1); }
    if (tok.endsWith('?')) { vel = 0.6; tok = tok.slice(0, -1); }
    cur = { step: i, len: 1, freqs: tok.split('+').map(noteFreq).filter(Boolean), vel };
    events.push(cur);
  });
  return { events, length: toks.length };
}

function parseDrums(str) {
  const chars = str.replace(/[\s|]/g, '').split('');
  const events = [];
  chars.forEach((ch, i) => { if (ch !== '-' && ch !== '.') events.push({ step: i, hit: ch }); });
  return { events, length: chars.length };
}

// ---------- 乐器 ----------
const INSTR = {
  pluck(t, f, d, v, out) {
    const c = audio.ctx;
    const g = c.createGain();
    const fl = c.createBiquadFilter();
    fl.type = 'lowpass';
    fl.Q.value = 2;
    fl.frequency.setValueAtTime(Math.min(8000, f * 7), t);
    fl.frequency.exponentialRampToValueAtTime(Math.max(300, f * 1.4), t + 0.18);
    const len = Math.min(d, 0.5) + 0.12;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16 * v, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    for (const [type, det] of [['sawtooth', -6], ['square', 6]]) {
      const o = c.createOscillator();
      o.type = type; o.frequency.value = f; o.detune.value = det;
      o.connect(fl); o.start(t); o.stop(t + len + 0.05);
    }
    fl.connect(g); g.connect(out);
  },
  pizz(t, f, d, v, out) {
    const c = audio.ctx;
    const o = c.createOscillator();
    o.type = 'sawtooth'; o.frequency.value = f;
    const fl = c.createBiquadFilter();
    fl.type = 'lowpass'; fl.frequency.setValueAtTime(f * 5, t); fl.frequency.exponentialRampToValueAtTime(f * 1.2, t + 0.12);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.32 * v, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    o.connect(fl).connect(g).connect(out);
    o.start(t); o.stop(t + 0.32);
  },
  marimba(t, f, d, v, out) {
    const c = audio.ctx;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.3 * v, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45 + Math.min(d, 0.3));
    const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f;
    const o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 4;
    const g2 = c.createGain(); g2.gain.setValueAtTime(0.12 * v, t); g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    o.connect(g); o2.connect(g2).connect(out); g.connect(out);
    o.start(t); o2.start(t); o.stop(t + 1); o2.stop(t + 0.1);
  },
  bell(t, f, d, v, out) {
    const c = audio.ctx;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.14 * v, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
    [[1, 1], [2.76, 0.35], [5.4, 0.12]].forEach(([m, a]) => {
      const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f * m;
      const og = c.createGain(); og.gain.value = a;
      o.connect(og).connect(g); o.start(t); o.stop(t + 1.7);
    });
    g.connect(out);
    const s = c.createGain(); s.gain.value = 0.5; g.connect(s); s.connect(audio.reverbSend);
  },
  lead(t, f, d, v, out) {
    const c = audio.ctx;
    const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
    const lfo = c.createOscillator(); lfo.frequency.value = 5.5;
    const lg = c.createGain(); lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.012, t + 0.25);
    lfo.connect(lg).connect(o.frequency);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.2 * v, t + 0.02);
    g.gain.setValueAtTime(0.2 * v, t + Math.max(0.03, d - 0.05));
    g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.12);
    o.connect(g).connect(out);
    o.start(t); lfo.start(t); o.stop(t + d + 0.2); lfo.stop(t + d + 0.2);
    const s = c.createGain(); s.gain.value = 0.3; g.connect(s); s.connect(audio.reverbSend);
  },
  bass(t, f, d, v, out) {
    const c = audio.ctx;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.38 * v, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.18 * v, t + 0.1);
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.15, d) + 0.05);
    const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
    const o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.value = f / 2;
    const g2 = c.createGain(); g2.gain.value = 0.5;
    o.connect(g); o2.connect(g2).connect(g); g.connect(out);
    o.start(t); o2.start(t); o.stop(t + d + 0.2); o2.stop(t + d + 0.2);
  },
  pad(t, f, d, v, out) {
    const c = audio.ctx;
    const g = c.createGain();
    const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 1100; fl.Q.value = 0.5;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05 * v, t + 0.25);
    g.gain.setValueAtTime(0.05 * v, t + Math.max(0.3, d - 0.1));
    g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.5);
    [-8, 8].forEach(det => {
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det;
      o.connect(fl); o.start(t); o.stop(t + d + 0.6);
    });
    fl.connect(g); g.connect(out);
    const s = c.createGain(); s.gain.value = 0.6; g.connect(s); s.connect(audio.reverbSend);
  },
  organ(t, f, d, v, out) {
    const c = audio.ctx;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.07 * v, t + 0.01);
    g.gain.setValueAtTime(0.07 * v, t + Math.max(0.02, d - 0.03));
    g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.08);
    [[1, 'sine', 1], [2, 'sine', 0.5], [3, 'triangle', 0.25]].forEach(([m, ty, a]) => {
      const o = c.createOscillator(); o.type = ty; o.frequency.value = f * m;
      const og = c.createGain(); og.gain.value = a;
      o.connect(og).connect(g); o.start(t); o.stop(t + d + 0.1);
    });
    g.connect(out);
  },
};

function drum(hit, t, v, out) {
  const c = audio.ctx;
  const mk = (dur, peak) => {
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak * v, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(out);
    return g;
  };
  const noise = (dur, type, f, q, peak) => {
    const s = c.createBufferSource(); s.buffer = audio.noiseBuf;
    const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    s.connect(fl).connect(mk(dur, peak)); s.start(t, Math.random()); s.stop(t + dur + 0.02);
  };
  const tone = (f0, f1, dur, peak, type = 'sine') => {
    const o = c.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    o.connect(mk(dur, peak)); o.start(t); o.stop(t + dur + 0.02);
  };
  switch (hit) {
    case 'k': tone(150, 42, 0.18, 0.7); break;
    case 's': noise(0.14, 'bandpass', 1800, 0.8, 0.35); tone(200, 120, 0.06, 0.2, 'triangle'); break;
    case 'h': noise(0.035, 'highpass', 7500, 1, 0.12); break;
    case 'o': noise(0.18, 'highpass', 6500, 1, 0.1); break;
    case 't': tone(140, 80, 0.2, 0.4); break;
    case 'c': noise(0.08, 'bandpass', 1200, 1.2, 0.3); break;
    case 'x': tone(150, 42, 0.18, 0.7); noise(0.035, 'highpass', 7500, 1, 0.12); break;
    case 'r': noise(0.06, 'highpass', 4500, 1, 0.07); break; // 沙锤
  }
}

// ---------- 曲目（全部原创） ----------
// 白天：A 小调，俏皮的拨奏 + 马林巴
const DAY = {
  bpm: 104, swing: 0.12,
  tracks: {
    lead: { inst: 'marimba', gain: 0.9, notes: `
      A4 - C5 - E5 . - D5 C5 - B4 - A4 . - - | F4 - A4 - C5 . - B4 A4 - G4 - F4 . - - |
      G4 - B4 - D5 . - C5 B4 - A4 - G4 . B4 - | G#4 . - - B4 . - - E5 . - - D5 . C5 B4 |
      A4 - C5 - E5 . - D5 C5 - B4 - A4 . - E5 | F5 . - E5 D5 . C5 - A4 . - - C5 . - - |
      D5 . - F5 E5 . D5 - B4 . - - G#4 . - - | A4 . - - E4 . - - A4 . . . - - - - |
      E5 - G5 - E5 - C5 - D5 - E5 - C5 . - - | D5 - B4 - G4 - B4 - D5 . - - G5 . - - |
      C5 - E5 - A5 . - G5 E5 . - - C5 . - - | B4 - G#4 - E4 - G#4 - B4 . - - E5 . - - |
      A5 . G5 - F5 . E5 - D5 . C5 - A4 . - - | G4 - C5 - E5 . - C5 G5 . - - E5 . - - |
      F5 . - E5 D5 . - C5 D5 . - - A4 . - - | B4 . - - G#4 . - - E4 . - - - - - - |` },
    bass: { inst: 'pizz', gain: 1, notes: `
      A2 - - - E3 - - - A2 - - - E3 - C3 - | F2 - - - C3 - - - F2 - - - C3 - A2 - |
      G2 - - - D3 - - - G2 - - - D3 - B2 - | E2 - - - B2 - - - E2 - - - G#2 - B2 - |
      A2 - - - E3 - - - A2 - - - E3 - C3 - | F2 - - - C3 - - - F2 - - - A2 - C3 - |
      D3 - - - A2 - - - E2 - - - B2 - - - | A2 - - - E2 - - - A2 - - - - - - - |
      C3 - - - G2 - - - C3 - - - G2 - E2 - | G2 - - - D3 - - - G2 - - - B2 - D3 - |
      A2 - - - E3 - - - A2 - - - C3 - E3 - | E2 - - - B2 - - - E2 - - - G#2 - B2 - |
      F2 - - - C3 - - - F2 - - - A2 - C3 - | C3 - - - G2 - - - C3 - - - E3 - G2 - |
      D3 - - - A2 - - - D3 - - - F2 - A2 - | E2 - - - B2 - - - E2 - - - E3 - - - |` },
    chords: { inst: 'pluck', gain: 0.5, notes: `
      - - - - A3+C4+E4 - - - - - - - A3+C4+E4 - - - | - - - - A3+C4+F4 - - - - - - - A3+C4+F4 - - - |
      - - - - B3+D4+G4 - - - - - - - B3+D4+G4 - - - | - - - - G#3+B3+E4 - - - - - - - G#3+B3+E4 - - - |
      - - - - A3+C4+E4 - - - - - - - A3+C4+E4 - - - | - - - - A3+C4+F4 - - - - - - - A3+C4+F4 - - - |
      - - - - A3+D4+F4 - - - - - - - G#3+B3+E4 - - - | - - - - A3+C4+E4 - - - - - - - - - - - |
      - - - - G3+C4+E4 - - - - - - - G3+C4+E4 - - - | - - - - G3+B3+D4 - - - - - - - G3+B3+D4 - - - |
      - - - - A3+C4+E4 - - - - - - - A3+C4+E4 - - - | - - - - G#3+B3+E4 - - - - - - - G#3+B3+E4 - - - |
      - - - - A3+C4+F4 - - - - - - - A3+C4+F4 - - - | - - - - G3+C4+E4 - - - - - - - G3+C4+E4 - - - |
      - - - - A3+D4+F4 - - - - - - - A3+D4+F4 - - - | - - - - G#3+B3+E4 - - - - - - - G#3+B3+D4 - - - |` },
    drums: { drums: true, gain: 0.6, notes: 'k-r-h-r-k-r-h-rr'.repeat(16) },
    intense: { drums: true, gain: 0.9, layer: 'intense', notes: 'k-hsk-h-kks-h-sh'.repeat(15) + 'k-s-k-s-ssssssst' },
  },
};

// 黑夜：D 小调，神秘的钟琴 + 弦乐铺底
const NIGHT = {
  bpm: 86, swing: 0.08,
  tracks: {
    lead: { inst: 'bell', gain: 0.9, notes: `
      D5 . . . F5 . A5 . G5 . F5 . E5 . . . | D5 . . . F5 . Bb5 . A5 . G5 . F5 . . . |
      G5 . . . F5 . D5 . Bb4 . D5 . G5 . . . | E5 . . . C#5 . E5 . A5 . . . G5 . . . |
      F5 . . . E5 . D5 . A4 . D5 . F5 . . . | F5 . . . G5 . F5 . D5 . Bb4 . D5 . . . |
      E5 . . . G5 . C6 . Bb5 . G5 . E5 . . . | C#5 . . . E5 . . . A4 . . . - - - - |` },
    pad: { inst: 'pad', gain: 0.9, notes: `
      D3+F3+A3 . . . . . . . . . . . . . . . | Bb2+D3+F3 . . . . . . . . . . . . . . . |
      G2+Bb2+D3 . . . . . . . . . . . . . . . | A2+C#3+E3 . . . . . . . . . . . . . . . |
      D3+F3+A3 . . . . . . . . . . . . . . . | Bb2+D3+F3 . . . . . . . . . . . . . . . |
      C3+E3+G3 . . . . . . . . . . . . . . . | A2+C#3+E3 . . . . . . . . . . . . . . . |` },
    bass: { inst: 'bass', gain: 0.9, notes: `
      D2 . . . - - A2 - D2 . . . - - A2 - | Bb1 . . . - - F2 - Bb1 . . . - - F2 - |
      G1 . . . - - D2 - G1 . . . - - D2 - | A1 . . . - - E2 - A1 . . . - - C#2 - |
      D2 . . . - - A2 - D2 . . . - - A2 - | Bb1 . . . - - F2 - Bb1 . . . - - D2 - |
      C2 . . . - - G2 - C2 . . . - - E2 - | A1 . . . - - E2 - A1 . . . E2 - C#2 - |` },
    counter: { inst: 'pizz', gain: 0.5, notes: `
      - - A3 - - - A3 - - - A3 - - - A3 - | - - F3 - - - F3 - - - F3 - - - F3 - |
      - - D3 - - - D3 - - - D3 - - - D3 - | - - E3 - - - E3 - - - C#3 - - - E3 - |
      - - A3 - - - A3 - - - A3 - - - A3 - | - - F3 - - - F3 - - - F3 - - - F3 - |
      - - G3 - - - G3 - - - E3 - - - G3 - | - - E3 - - - E3 - - - C#3 - - - A2 - |` },
    drums: { drums: true, gain: 0.45, notes: 'k-------c-------k-----k-c-------'.repeat(4) },
    intense: { drums: true, gain: 0.9, layer: 'intense', notes: 'k-h-s-h-k-hkt-ht'.repeat(8) },
  },
};

// 泳池：G 大调，轻快的冲浪风
const POOL = {
  bpm: 124, swing: 0.1,
  tracks: {
    lead: { inst: 'lead', gain: 0.8, notes: `
      B4 - D5 - G5 . - D5 B4 - D5 - G5 . - - | G5 - E5 - B4 . - E5 G5 - B5 - A5 . G5 - |
      E5 - G5 - C6 . - B5 A5 - G5 - E5 . - - | F#5 . - - A5 . - - D5 . - - F#5 . A5 - |
      B5 . - A5 G5 - D5 - B4 . - D5 G5 . - - | E5 - G5 - B5 . - A5 G5 . - E5 D5 . - - |
      C5 . E5 - A5 . - G5 F#5 . - - D5 . - - | G5 . - - D5 . - - G4 . . . - - - - |` },
    bass: { inst: 'bass', gain: 0.9, notes: `
      G2 - - G2 - - D3 - G2 - - G2 - - B2 - | E2 - - E2 - - B2 - E2 - - E2 - - G2 - |
      C3 - - C3 - - G2 - C3 - - C3 - - E3 - | D2 - - D2 - - A2 - D2 - - F#2 - A2 - - |
      G2 - - G2 - - D3 - G2 - - G2 - - B2 - | E2 - - E2 - - B2 - E2 - - E2 - - G2 - |
      A2 - - A2 - - E3 - D2 - - D2 - - F#2 - | G2 - - D2 - - B1 - G2 - - - - - - - |` },
    chords: { inst: 'pluck', gain: 0.45, notes: `
      - - G3+B3+D4 - - - G3+B3+D4 - - - G3+B3+D4 - - - G3+B3+D4 - | - - G3+B3+E4 - - - G3+B3+E4 - - - G3+B3+E4 - - - G3+B3+E4 - |
      - - G3+C4+E4 - - - G3+C4+E4 - - - G3+C4+E4 - - - G3+C4+E4 - | - - F#3+A3+D4 - - - F#3+A3+D4 - - - F#3+A3+D4 - - - F#3+A3+D4 - |
      - - G3+B3+D4 - - - G3+B3+D4 - - - G3+B3+D4 - - - G3+B3+D4 - | - - G3+B3+E4 - - - G3+B3+E4 - - - G3+B3+E4 - - - G3+B3+E4 - |
      - - A3+C4+E4 - - - A3+C4+E4 - - - F#3+A3+D4 - - - F#3+A3+D4 - | - - G3+B3+D4 - - - G3+B3+D4 - - - - - - - - - |` },
    drums: { drums: true, gain: 0.55, notes: 'k-h-s-hkk-h-s-hh'.repeat(8) },
    intense: { drums: true, gain: 0.8, layer: 'intense', notes: 'kkhtskhtkkhtsstt'.repeat(8) },
  },
};

// 主菜单：E 小调，音乐盒般的神秘小品
const MENU = {
  bpm: 84, swing: 0,
  tracks: {
    lead: { inst: 'bell', gain: 0.8, notes: `
      B4 . E5 . G5 . B5 . A5 . G5 . F#5 . E5 . | E5 . G5 . C6 . B5 . A5 . . . G5 . . . |
      A4 . C5 . E5 . A5 . G5 . F#5 . E5 . C5 . | D#5 . F#5 . B5 . . . A5 . . . F#5 . . . |
      B4 . E5 . G5 . B5 . D6 . C6 . B5 . G5 . | C6 . B5 . A5 . G5 . E5 . . . C5 . . . |
      A4 . B4 . C5 . E5 . D#5 . E5 . F#5 . A5 . | G5 . . . F#5 . . . E5 . . . - - - - |` },
    pad: { inst: 'pad', gain: 0.8, notes: `
      E3+G3+B3 . . . . . . . . . . . . . . . | C3+E3+G3 . . . . . . . . . . . . . . . |
      A2+C3+E3 . . . . . . . . . . . . . . . | B2+D#3+F#3 . . . . . . . . . . . . . . . |
      E3+G3+B3 . . . . . . . . . . . . . . . | C3+E3+A3 . . . . . . . . . . . . . . . |
      A2+C3+E3 . . . . . . . . . . . . . . . | B2+D#3+F#3 . . . . . . . E3+G3+B3 . . . . . . . |` },
    bass: { inst: 'pizz', gain: 0.6, notes: `
      E2 - - - B2 - - - E2 - - - B2 - - - | C2 - - - G2 - - - C2 - - - G2 - - - |
      A1 - - - E2 - - - A1 - - - E2 - - - | B1 - - - F#2 - - - B1 - - - F#2 - - - |
      E2 - - - B2 - - - E2 - - - B2 - - - | C2 - - - G2 - - - C2 - - - A2 - - - |
      A1 - - - E2 - - - A1 - - - C2 - - - | B1 - - - F#2 - - - E2 - - - - - - - |` },
  },
};

// 选卡：轻松的爵士行进低音
const SELECT = {
  bpm: 112, swing: 0.22,
  tracks: {
    bass: { inst: 'pizz', gain: 1, notes: `
      C3 - - - E3 - - - G3 - - - A3 - - - | A2 - - - C3 - - - E3 - - - G3 - - - |
      D3 - - - F3 - - - A3 - - - C4 - - - | G2 - - - B2 - - - D3 - - - F3 - - - |
      C3 - - - E3 - - - G3 - - - B3 - - - | A2 - - - C3 - - - E3 - - - C#3 - - - |
      D3 - - - F3 - - - A3 - - - F3 - - - | G2 - - - D3 - - - G2 - - - B2 - - - |` },
    lead: { inst: 'bell', gain: 0.55, notes: `
      E5 . . . G5 . . . B5 . A5 . G5 . . . | - - C5 - E5 - G5 - E5 . . . - - - - |
      F5 . . . A5 . . . C6 . B5 . A5 . . . | G5 . F5 . D5 . . . B4 . . . - - - - |
      E5 . . . G5 . . . B5 . . . D6 . C6 . | A5 . . . E5 . . . C#5 . . . E5 . . . |
      D5 . F5 . A5 . . . C6 . B5 . A5 . F5 . | G5 . . . . . . . - - - - - - - - |` },
    comp: { inst: 'organ', gain: 0.6, notes: `
      - - - - E4+G4+B4 . - - - - - - E4+G4+B4 . - - | - - - - C4+E4+G4 . - - - - - - C4+E4+G4 . - - |
      - - - - F4+A4+C5 . - - - - - - F4+A4+C5 . - - | - - - - F4+B4+D5 . - - - - - - F4+B4+D5 . - - |
      - - - - E4+G4+B4 . - - - - - - E4+G4+B4 . - - | - - - - E4+G4+C#5 . - - - - - - E4+G4+C#5 . - - |
      - - - - F4+A4+C5 . - - - - - - F4+A4+C5 . - - | - - - - F4+B4+D5 . - - - - - - - - - - |` },
    drums: { drums: true, gain: 0.5, notes: 'h--rh-r-h--rh-rr'.repeat(8) },
  },
};

// 小游戏：欢快的风琴
const MINIGAME = {
  bpm: 132, swing: 0.15,
  tracks: {
    lead: { inst: 'pluck', gain: 0.75, notes: `
      C5 - E5 - G5 - E5 - C5 - E5 - G5 . - - | A5 - G5 - E5 - C5 - D5 . - - - - - - |
      F5 - A5 - C6 - A5 - F5 - A5 - C6 . - - | B5 - A5 - G5 - F5 - E5 . - - D5 . - - |
      C5 - E5 - G5 - E5 - C5 - E5 - G5 . - - | A5 - B5 - C6 - A5 - G5 . - - E5 . - - |
      F5 - E5 - D5 - C5 - B4 - D5 - G5 . - - | C5 . - - G4 . - - C5 . . . - - - - |` },
    bass: { inst: 'bass', gain: 0.9, notes: `
      C3 - G2 - C3 - G2 - C3 - G2 - C3 - E3 - | A2 - E2 - A2 - E2 - G2 - D2 - G2 - B2 - |
      F2 - C3 - F2 - C3 - F2 - C3 - F2 - A2 - | G2 - D3 - G2 - D3 - C3 - G2 - B2 - G2 - |
      C3 - G2 - C3 - G2 - C3 - G2 - C3 - E3 - | F2 - C3 - F2 - A2 - C3 - G2 - C3 - E3 - |
      D3 - A2 - D3 - A2 - G2 - D3 - G2 - B2 - | C3 - G2 - E2 - G2 - C3 - - - - - - - |` },
    drums: { drums: true, gain: 0.55, notes: 'k-hhs-hhk-hhs-hk'.repeat(8) },
  },
};

// 浓雾：B 小调，长笛般的旋律在雾中飘荡
const FOG = {
  bpm: 78, swing: 0.06,
  tracks: {
    lead: { inst: 'lead', gain: 0.75, notes: `
      F#5 . . . D5 . B4 . C#5 . D5 . F#5 . . . | G5 . . . F#5 . E5 . D5 . . . B4 . . . |
      E5 . . . G5 . F#5 . E5 . D5 . C#5 . . . | C#5 . . . A#4 . C#5 . F#5 . . . - - - - |
      B5 . . . A5 . F#5 . D5 . F#5 . B5 . . . | G5 . . . B5 . A5 . G5 . F#5 . E5 . . . |
      E5 . . . C#5 . E5 . A5 . G5 . E5 . C#5 . | A#4 . . . C#5 . . . F#4 . . . - - - - |` },
    pad: { inst: 'pad', gain: 1, notes: `
      B3+D4+F#4 . . . . . . . . . . . . . . . | G3+B3+D4 . . . . . . . . . . . . . . . |
      E3+G3+B3 . . . . . . . . . . . . . . . | F#3+A#3+C#4 . . . . . . . . . . . . . . . |
      B3+D4+F#4 . . . . . . . . . . . . . . . | G3+B3+D4 . . . . . . . . . . . . . . . |
      A3+C#4+E4 . . . . . . . . . . . . . . . | F#3+A#3+C#4 . . . . . . . . . . . . . . . |` },
    bass: { inst: 'pizz', gain: 0.9, notes: `
      B1 - - - - - - - F#2 - - - - - D2 - | G1 - - - - - - - D2 - - - - - B1 - |
      E2 - - - - - - - B1 - - - - - G1 - | F#1 - - - - - - - C#2 - - - - - A#1 - |
      B1 - - - - - - - F#2 - - - - - D2 - | G1 - - - - - - - D2 - - - - - B1 - |
      A1 - - - - - - - E2 - - - - - C#2 - | F#1 - - - - - - - C#2 - - - F#1 - - - |` },
    bells: { inst: 'bell', gain: 0.35, notes: `
      - - - - - - - - - - - - D6 . . . | - - - - - - - - - - - - B5 . . . |
      - - - - - - - - - - - - G5 . . . | - - - - - - - - - - - - A#5 . . . |
      - - - - - - - - - - - - F#6 . . . | - - - - - - - - - - - - D6 . . . |
      - - - - - - - - - - - - C#6 . . . | - - - - - - - - - - - - F#5 . . . |` },
    drums: { drums: true, gain: 0.45, notes: 'k-------c---k-r-'.repeat(8) },
    intense: { drums: true, gain: 0.85, layer: 'intense', notes: 'k-h-skh-k-hkstt-'.repeat(8) },
  },
};

export const SONGS = { day: DAY, night: NIGHT, pool: POOL, fog: FOG, menu: MENU, select: SELECT, minigame: MINIGAME };

// 预解析
for (const song of Object.values(SONGS)) {
  song.len = 0;
  for (const tr of Object.values(song.tracks)) {
    tr.parsed = tr.drums ? parseDrums(tr.notes) : parseMelody(tr.notes);
    song.len = Math.max(song.len, tr.parsed.length);
  }
}

class MusicPlayer {
  constructor() {
    this.song = null;
    this.name = null;
    this.layers = { intense: 0 };
    this.timer = null;
  }

  play(name) {
    if (!audio.ready) { this.pending = name; return; }
    if (this.name === name && this.song) return;
    this.stop(0.6);
    const song = SONGS[name];
    if (!song) return;
    this.name = name;
    this.song = song;
    const c = audio.ctx;
    this.bus = c.createGain();
    this.bus.gain.setValueAtTime(0.0001, c.currentTime);
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
    // 标签页切到后台时 currentTime 仍前进，避免补发大量音符
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
      b.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.05, fade));
      setTimeout(() => { try { b.disconnect(); } catch (_) { /* noop */ } }, fade * 1000 + 300);
    }
    this.bus = null;
    this.song = null;
    this.name = null;
  }

  resumePending() {
    if (this.pending) { const n = this.pending; this.pending = null; this.play(n); }
  }
}

export const music = new MusicPlayer();
