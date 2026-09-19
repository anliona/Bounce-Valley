/* ============================================================
 * ui.js — UI 管理器
 * 主菜单 / 关卡选择 / 设置 / 关于 / 暂停 / 通关结算 / HUD /
 * Toast 提示 / 触屏按钮显隐
 * ============================================================ */
window.BT = window.BT || {};

BT.UIManager = class {
  constructor(game) {
    this.game = game;
    this.$ = (id) => document.getElementById(id);
    this.settingsReturn = 'main';   // 设置页返回目标
    this.screens = {
      main: 'mainMenu', select: 'levelSelect', settings: 'settingsPanel',
      about: 'aboutPanel', pause: 'pauseMenu', complete: 'levelComplete',
      exit: 'exitScreen',
    };
    this.bind();
    this.applySettings();
    this.drawTitleBall();
  }

  /* ---------------- 界面切换 ---------------- */
  showScreen(name) {
    for (const k in this.screens) {
      this.$(this.screens[k]).classList.toggle('hidden', k !== name);
    }
  }

  showHUD(on) {
    this.$('hud').classList.toggle('hidden', !on);
    this.$('toastBox').classList.toggle('hidden', !on || !this._hasToast);
    this.updateTouchVisible();
  }

  /* ---------------- HUD ---------------- */
  updateHUD() {
    const g = this.game;
    if (!g.level) return;
    this.$('orbText').textContent = `${g.orbCount} / ${g.level.totalOrbs}`;
    this.$('timeText').textContent = BT.Utils.fmtTime(g.timer);
    this.$('deathText').textContent = '💀 ' + g.deaths;
    this.$('levelName').textContent = `LEVEL ${g.levelIndex + 1} · ${g.level.name}`;
  }

  toast(text, ms = 2400) {
    const box = this.$('toastBox');
    box.classList.remove('hidden');
    this._hasToast = true;
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = text;
    box.appendChild(el);
    setTimeout(() => { el.remove(); if (!box.children.length) { box.classList.add('hidden'); this._hasToast = false; } }, ms);
  }

  /* ---------------- 通关结算 ---------------- */
  showLevelComplete({ levelId, name, time, orbs, total, deaths, newRecord, hasNext }) {
    this.$('lcTitle').textContent = `LEVEL ${levelId} COMPLETE!`;
    this.$('lcTime').textContent = BT.Utils.fmtTime(time);
    this.$('lcOrbs').textContent = `${orbs} / ${total}`;
    this.$('lcDeaths').textContent = String(deaths);
    this.$('lcNewRecord').classList.toggle('hidden', !newRecord);
    const next = this.$('btnNext');
    next.classList.toggle('hidden', !hasNext);
    this.showScreen('complete');
  }

  /* ---------------- Карта мира (Hollow Knight style) ---------------- */
  buildLevelMap() {
    const svg = this.$('mapSvg');
    const pos = [{ x: 130, y: 330 }, { x: 400, y: 230 }, { x: 660, y: 300 }];
    const future = [{ x: 840, y: 180 }, { x: 925, y: 285 }];
    const unlocked = Math.min(BT.save.data.unlocked, BT.LEVELS.length);

    /* пройденный путь + пунктир в будущее */
    let d = `M ${pos[0].x} ${pos[0].y}`;
    for (let i = 1; i < pos.length; i++) {
      const a = pos[i - 1], b = pos[i], mx = (a.x + b.x) / 2;
      d += ` C ${mx} ${a.y - 70}, ${mx} ${b.y + 70}, ${b.x} ${b.y}`;
    }
    let df = `M ${pos[pos.length - 1].x} ${pos[pos.length - 1].y}`;
    for (const f of future) {
      df += ` C ${f.x - 90} ${f.y - 60}, ${f.x - 90} ${f.y + 60}, ${f.x} ${f.y}`;
    }

    let h = `<path d="${d}" fill="none" stroke="rgba(207,216,222,0.35)" stroke-width="2.5" stroke-dasharray="1 8" stroke-linecap="round"/>`;
    h += `<path d="${df}" fill="none" stroke="rgba(207,216,222,0.14)" stroke-width="2" stroke-dasharray="1 10" stroke-linecap="round"/>`;

    BT.LEVELS.forEach((def, i) => {
      const p = pos[i];
      const best = BT.save.getBest(i + 1);
      const st = i + 1 < unlocked ? 'done' : (i + 1 === unlocked ? 'current' : 'locked');
      const playable = st !== 'locked';

      if (st === 'current') {
        h += `<circle class="node-pulse" cx="${p.x}" cy="${p.y}" r="18" fill="none" stroke="#a8d8e8" stroke-width="2"/>`;
        h += `<text class="you-label" x="${p.x}" y="${p.y - 58}" text-anchor="middle">ВЫ ЗДЕСЬ</text>`;
      }
      h += `<g class="map-node ${playable ? 'playable' : 'locked'}" data-level="${i}">`;
      h += `<circle cx="${p.x}" cy="${p.y}" r="27" fill="rgba(6,8,13,0.65)" stroke="rgba(207,216,222,0.25)"/>`;
      if (st === 'done') h += `<circle class="node-core" cx="${p.x}" cy="${p.y}" r="13" fill="#c8b78a"/>`;
      if (st === 'current') h += `<circle class="node-core" cx="${p.x}" cy="${p.y}" r="13" fill="#a8d8e8"/>`;
      if (st === 'locked') h += `<circle class="node-core" cx="${p.x}" cy="${p.y}" r="12" fill="#232a31" stroke="rgba(207,216,222,0.35)"/>`;
      h += `<text class="node-label" x="${p.x}" y="${p.y - 40}" text-anchor="middle">${def.name}</text>`;
      if (st === 'locked') h += `<text class="node-sub" x="${p.x}" y="${p.y + 48}" text-anchor="middle">замкнута</text>`;
      else if (best) h += `<text class="node-sub" x="${p.x}" y="${p.y + 48}" text-anchor="middle">${best.orbs}/${best.total} · ${BT.Utils.fmtTime(best.time)}</text>`;
      else h += `<text class="node-sub" x="${p.x}" y="${p.y + 48}" text-anchor="middle">не пройдена</text>`;
      h += `</g>`;
    });

    /* будущие уровни — силуэты "???" */
    future.forEach((p) => {
      h += `<g class="map-node locked">`;
      h += `<circle cx="${p.x}" cy="${p.y}" r="19" fill="none" stroke="rgba(207,216,222,0.2)" stroke-dasharray="3 6"/>`;
      h += `<text class="future-label" x="${p.x}" y="${p.y + 6}" text-anchor="middle">? ? ?</text>`;
      h += `<text class="node-sub" x="${p.x}" y="${p.y + 44}" text-anchor="middle">скоро…</text>`;
      h += `</g>`;
    });

    svg.innerHTML = h;
    svg.querySelectorAll('.map-node.playable').forEach((n) => {
      n.addEventListener('click', () => {
        BT.audio.sfx('click');
        this.game.startLevel(+n.dataset.level);
      });
    });
  }

  hideSplash() {
    const s = this.$('splash');
    if (!s || s.classList.contains('splash-hide')) return;
    s.classList.add('splash-hide');
    setTimeout(() => s.classList.add('hidden'), 750);
  }

  /* ---------------- 设置 ---------------- */
  applySettings() {
    const s = BT.save.settings;
    this.$('musicRange').value = Math.round(s.music * 100);
    this.$('musicVal').textContent = Math.round(s.music * 100);
    this.$('sfxRange').value = Math.round(s.sfx * 100);
    this.$('sfxVal').textContent = Math.round(s.sfx * 100);
    this.$('touchSel').value = s.touch;
    BT.audio.setMusicVolume(s.music);
    BT.audio.setSfxVolume(s.sfx);
    this.updateTouchVisible();
  }

  updateTouchVisible() {
    const mode = BT.save.settings.touch;
    const coarse = window.matchMedia('(pointer: coarse)').matches || ('ontouchstart' in window);
    const playing = this.game.state === 'playing';
    const show = playing && (mode === 'on' || (mode === 'auto' && coarse));
    this.$('touchControls').classList.toggle('hidden', !show);
  }

  /* ---------------- 标题小球（HK 苍白陶瓷风） ---------------- */
  drawTitleBall() {
    const cv = this.$('titleBall');
    const ctx = cv.getContext('2d');
    const r = 52;
    ctx.save();
    ctx.translate(75, 78);
    ctx.shadowColor = 'rgba(240, 236, 214, 0.55)';
    ctx.shadowBlur = 22;
    const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.15, 0, 0, r);
    g.addColorStop(0, '#f7f3e6');
    g.addColorStop(0.5, '#e9e4d4');
    g.addColorStop(1, '#c6bda6');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, BT.Utils.TAU); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(14, 16, 24, 0.85)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, 0, r - 2, 0, BT.Utils.TAU); ctx.stroke();
    /* 眼睛 — 暗色空洞 */
    for (const side of [-1, 1]) {
      ctx.fillStyle = '#14161d';
      ctx.beginPath(); ctx.ellipse(side * 20, -10, 13, 15, 0, 0, BT.Utils.TAU); ctx.fill();
      ctx.fillStyle = '#e9eef2';
      ctx.beginPath(); ctx.arc(side * 20 - 4.5, -15, 3.6, 0, BT.Utils.TAU); ctx.fill();
    }
    /* 嘴 */
    ctx.strokeStyle = '#14161d'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, 8, 12, 0.25 * Math.PI, 0.75 * Math.PI); ctx.stroke();
    ctx.restore();
  }

  /* ---------------- 事件绑定 ---------------- */
  bind() {
    /* 鼠标点击任意位置也解锁音频（首次交互） */
    document.addEventListener('pointerdown', () => {
      if (this.game && !this.game._audioReady) {
        BT.audio.unlock();
        this.game.onAudioUnlocked();
      }
    }, { capture: true });

    const on = (id, fn) => this.$(id).addEventListener('click', (e) => {
      BT.audio.sfx('click'); fn(e);
    });

    on('btnPlay', () => {
      /* 从最高已解锁关卡开始 */
      const idx = BT.Utils.clamp(BT.save.data.unlocked - 1, 0, BT.LEVELS.length - 1);
      this.game.startLevel(idx);
    });
    on('btnMap', () => { this.buildLevelMap(); this.showScreen('select'); });
    on('btnExit', () => {
      this.showScreen('exit');
      setTimeout(() => { try { window.close(); } catch (e) { /* 浏览器可能拦截 */ } }, 300);
    });
    on('btnExitBack', () => this.showScreen('main'));
    on('btnSettings', () => { this.settingsReturn = 'main'; this.showScreen('settings'); });
    on('btnAbout', () => this.showScreen('about'));
    on('btnBackMain', () => this.showScreen('main'));
    on('btnBackAbout', () => this.showScreen('main'));
    on('btnBackSettings', () => this.showScreen(this.settingsReturn === 'pause' ? 'pause' : 'main'));

    /* заставка: клик пропускает */
    this.$('splash').addEventListener('pointerdown', () => this.game.leaveSplash());

    /* 设置项 */
    this.$('musicRange').addEventListener('input', (e) => {
      const v = e.target.value / 100;
      BT.save.setSetting('music', v);
      BT.audio.setMusicVolume(v);
      this.$('musicVal').textContent = e.target.value;
    });
    this.$('sfxRange').addEventListener('input', (e) => {
      const v = e.target.value / 100;
      BT.save.setSetting('sfx', v);
      BT.audio.setSfxVolume(v);
      this.$('sfxVal').textContent = e.target.value;
      BT.audio.sfx('orb');
    });
    this.$('touchSel').addEventListener('change', (e) => {
      BT.save.setSetting('touch', e.target.value);
      this.updateTouchVisible();
    });
    on('btnResetSave', () => {
      if (confirm('确定清除全部存档（解锁进度与纪录）吗？')) {
        BT.save.reset();
        this.applySettings();
        this.toast('存档已清除');
      }
    });

    /* 暂停菜单 */
    on('btnResume', () => this.game.resume());
    on('btnRestartPause', () => this.game.restartLevel());
    on('btnSettingsPause', () => { this.settingsReturn = 'pause'; this.showScreen('settings'); });
    on('btnQuitToMenu', () => this.game.toMenu());

    /* 通关结算 */
    on('btnNext', () => this.game.nextLevel());
    on('btnRetry', () => this.game.restartLevel());
    on('btnMenuLC', () => this.game.toMenu());
  }
};
