/* ============================================================
 * audio.js — 音频管理（WebAudio 全程序化合成，无外部素材）
 * · 音效：跳跃/落地/收集/检查点/机关/死亡/通关 等
 * · 音乐：轻量步进音序器，按主题切换调式
 * 所有音量可在 Settings 中调整
 * ============================================================ */
window.BT = window.BT || {};

BT.AudioManager = class {
  constructor() {
    this.ctx = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.unlocked = false;
    this.seq = null;                // 音乐音序器状态
    this._timer = null;
  }

  /* 首次用户交互后解锁 AudioContext（浏览器自动播放策略） */
  unlock() {
    if (this.unlocked) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.musicGain.connect(this.ctx.destination);
      this.sfxGain.connect(this.ctx.destination);
      this.setMusicVolume(BT.save.settings.music);
      this.setSfxVolume(BT.save.settings.sfx);
      this.unlocked = true;
    } catch (e) { console.warn('Audio unavailable', e); }
  }

  setMusicVolume(v) { if (this.musicGain) this.musicGain.gain.value = v * 0.5; }
  setSfxVolume(v) { if (this.sfxGain) this.sfxGain.gain.value = v; }

  midi(n) { return 440 * Math.pow(2, (n - 69) / 12); }

  /* ============ 基础合成器 ============ */
  tone({ freq = 440, freqEnd = null, dur = 0.15, type = 'sine', vol = 0.5, attack = 0.005, delay = 0 }) {
    if (!this.unlocked) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd != null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g); g.connect(this.sfxGain);
    osc.start(t0); osc.stop(t0 + dur + 0.05);
  }

  noise({ dur = 0.2, vol = 0.4, filter = 1200, filterEnd = null, delay = 0, type = 'lowpass' }) {
    if (!this.unlocked) return;
    const t0 = this.ctx.currentTime + delay;
    const len = Math.max(1, (dur * this.ctx.sampleRate) | 0);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(filter, t0);
    if (filterEnd != null) f.frequency.exponentialRampToValueAtTime(Math.max(20, filterEnd), t0 + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(this.sfxGain);
    src.start(t0);
  }

  /* ============ 具名音效 ============ */
  sfx(name) {
    if (!this.unlocked) return;
    switch (name) {
      case 'jump':      this.tone({ freq: 300, freqEnd: 640, dur: 0.16, type: 'square', vol: 0.16 }); break;
      case 'land':      this.noise({ dur: 0.1, vol: 0.22, filter: 500, filterEnd: 120 }); break;
      case 'bounce':    this.tone({ freq: 200, freqEnd: 900, dur: 0.28, type: 'triangle', vol: 0.34 }); break;
      case 'orb':       this.tone({ freq: 880, freqEnd: 1320, dur: 0.14, type: 'sine', vol: 0.3 });
                        this.tone({ freq: 1320, freqEnd: 1760, dur: 0.16, type: 'sine', vol: 0.2, delay: 0.06 }); break;
      case 'checkpoint':this.tone({ freq: 660, dur: 0.12, type: 'sine', vol: 0.25 });
                        this.tone({ freq: 880, dur: 0.14, type: 'sine', vol: 0.25, delay: 0.1 });
                        this.tone({ freq: 1320, dur: 0.22, type: 'sine', vol: 0.25, delay: 0.2 }); break;
      case 'death':     this.tone({ freq: 440, freqEnd: 60, dur: 0.5, type: 'sawtooth', vol: 0.3 });
                        this.noise({ dur: 0.3, vol: 0.25, filter: 900, filterEnd: 100 }); break;
      case 'break':     this.noise({ dur: 0.25, vol: 0.4, filter: 1600, filterEnd: 200 }); break;
      case 'switch':    this.tone({ freq: 520, freqEnd: 260, dur: 0.12, type: 'square', vol: 0.2 });
                        this.tone({ freq: 1040, dur: 0.1, type: 'sine', vol: 0.22, delay: 0.1 }); break;
      case 'door':      this.noise({ dur: 0.7, vol: 0.25, filter: 300, filterEnd: 80 });
                        this.tone({ freq: 90, freqEnd: 60, dur: 0.7, type: 'sawtooth', vol: 0.14 }); break;
      case 'splash':    this.noise({ dur: 0.35, vol: 0.3, filter: 1500, filterEnd: 300 }); break;
      case 'shrink':    this.tone({ freq: 900, freqEnd: 320, dur: 0.3, type: 'sine', vol: 0.3 }); break;
      case 'inflate':   this.tone({ freq: 320, freqEnd: 900, dur: 0.3, type: 'sine', vol: 0.3 }); break;
      case 'push':      this.noise({ dur: 0.12, vol: 0.14, filter: 350 }); break;
      case 'rock':      this.noise({ dur: 0.4, vol: 0.35, filter: 700, filterEnd: 90 }); break;
      case 'laser':     this.tone({ freq: 1200, freqEnd: 1400, dur: 0.1, type: 'sawtooth', vol: 0.05 }); break;
      case 'win':       [523, 659, 784, 1047].forEach((f, i) =>
                          this.tone({ freq: f, dur: 0.24, type: 'triangle', vol: 0.3, delay: i * 0.13 })); break;
      case 'click':     this.tone({ freq: 700, freqEnd: 500, dur: 0.06, type: 'square', vol: 0.12 }); break;
      case 'crumble':   this.noise({ dur: 0.3, vol: 0.2, filter: 500, filterEnd: 120 }); break;
    }
  }

  /* ============ 背景音乐（轻量音序器） ============ */
  /* theme: 'forest' | 'cave' | 'ruins' | null(停止) */
  startMusic(theme) {
    this.stopMusic();
    if (!this.unlocked || !theme) return;

    const conf = {
      forest: { bpm: 104, root: 57, scale: [0, 2, 4, 7, 9],   // 大调五声
        melody: [0,-1,2,-1, 4,-1,7,-1, 9,-1,7,4, 2,-1,4,-1, 0,-1,2,4, 7,-1,9,-1, 7,-1,4,2, 4,-1,2,-1],
        bass:   [0,-9,-9,-9, 4,-9,-9,-9, -3,-9,-9,-9, 4,-9,-9,-9] },
      cave:   { bpm: 88, root: 55, scale: [0, 3, 5, 7, 10],   // 小调五声
        melody: [0,-1,-1,3, -1,-1,5,-1, 7,-1,5,3, 5,-1,3,-1, 0,-1,-1,3, 5,-1,7,10, 7,-1,5,3, 3,-1,-1,-1],
        bass:   [0,-12,-12,-12, -5,-12,-12,-12, -7,-12,-12,-12, -5,-12,-12,-12] },
      ruins:  { bpm: 96, root: 60, scale: [0, 2, 4, 7, 9],
        melody: [4,-1,7,-1, 9,-1,7,-1, 4,-1,2,-1, 4,-1,-1,-1, 7,-1,9,-1, 11,-1,9,-1, 7,-1,4,-1, 2,-1,-1,-1],
        bass:   [0,-12,-12,-12, 7,-12,-12,-12, 5,-12,-12,-12, 7,-12,-12,-12] },
    }[theme];
    if (!conf) return;

    this.seq = { ...conf, step: 0, nextTime: this.ctx.currentTime + 0.1, theme };
    this._timer = setInterval(() => this._pump(), 60);
    this._pump();
  }

  stopMusic() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    this.seq = null;
  }

  _pump() {
    const s = this.seq;
    if (!s || !this.ctx) return;
    const stepDur = 60 / s.bpm / 4;   // 十六分音符
    while (s.nextTime < this.ctx.currentTime + 0.25) {
      this._scheduleStep(s, s.step, s.nextTime, stepDur);
      s.nextTime += stepDur;
      s.step++;
    }
  }

  _scheduleStep(s, step, t, stepDur) {
    const idx = step % s.melody.length;
    const deg = s.melody[idx];
    const ctx = this.ctx;
    const out = this.musicGain;

    /* 主旋律：柔和三角波拨音 */
    if (deg >= 0) {
      const notes = s.scale;
      const oct = deg >= notes.length ? 12 : 0;
      const n = s.root + 12 + notes[deg % notes.length] + oct;
      this._pluck(this.midi(n), t, stepDur * 2.2, 0.10, out, 'triangle');
    }
    /* 贝斯：每 4 步 */
    if (step % 4 === 0) {
      const bdeg = s.bass[(step / 4) % s.bass.length | 0];
      if (bdeg !== -9) {
        const n = s.root + bdeg + (bdeg >= 0 ? s.scale[bdeg % s.scale.length] : 0);
        this._pluck(this.midi(n), t, stepDur * 3.4, 0.14, out, 'sine');
      }
    }
    /* 轻微沙锤点缀 */
    if (step % 4 === 2 && s.theme !== 'cave') {
      const len = (0.03 * ctx.sampleRate) | 0;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource(); src.buffer = buf;
      const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6000;
      const g = ctx.createGain(); g.gain.value = 0.045;
      src.connect(f); f.connect(g); g.connect(out);
      src.start(t);
    }
  }

  _pluck(freq, t, dur, vol, out, type) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq * (1 + (Math.random() - 0.5) * 0.004);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g); g.connect(out);
    osc.start(t); osc.stop(t + dur + 0.05);
  }
};

BT.audio = new BT.AudioManager();
