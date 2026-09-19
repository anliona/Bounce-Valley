/* ============================================================
 * save.js — 本地存档系统（localStorage）
 * 保存：解锁关卡、每关最高收集数、最快通关时间、游戏设置
 * ============================================================ */
window.BT = window.BT || {};

BT.SaveSystem = class {
  constructor(key) {
    this.key = key || 'bounce_valley_save_v1';
    this.memory = null;              // localStorage 不可用时的内存兜底
    this.data = this.load();
  }

  defaults() {
    return {
      unlocked: 1,                   // 当前已解锁的最高关卡编号 (1~3)
      levels: {},                    // { 1: {orbs, total, time}, ... }
      settings: { music: 0.7, sfx: 0.9, touch: 'auto' },
    };
  }

  load() {
    try {
      const raw = localStorage.getItem(this.key);
      if (raw) {
        const d = JSON.parse(raw);
        return Object.assign(this.defaults(), d);
      }
    } catch (e) { /* file:// 下某些浏览器可能禁用 localStorage */ }
    return this.defaults();
  }

  save() {
    try { localStorage.setItem(this.key, JSON.stringify(this.data)); }
    catch (e) { this.memory = this.data; }
  }

  /* -------- 关卡进度 -------- */
  isUnlocked(n) { return n <= this.data.unlocked; }

  unlock(n) {
    if (n > this.data.unlocked) { this.data.unlocked = n; this.save(); }
  }

  unlockAll() { this.data.unlocked = 99; this.save(); }

  getBest(n) { return this.data.levels[n] || null; }

  /* 记录一次通关，返回是否刷新纪录 */
  recordResult(n, orbs, total, time) {
    const prev = this.data.levels[n];
    let newRecord = false;
    if (!prev || orbs > prev.orbs || time < prev.time) newRecord = true;
    const best = prev || { orbs: 0, total, time: Infinity };
    best.orbs = Math.max(best.orbs, orbs);
    best.total = total;
    best.time = Math.min(best.time, time);
    this.data.levels[n] = best;
    this.unlock(n + 1);
    this.save();
    return newRecord;
  }

  /* -------- 设置 -------- */
  get settings() { return this.data.settings; }

  setSetting(k, v) { this.data.settings[k] = v; this.save(); }

  reset() {
    this.data = this.defaults();
    try { localStorage.removeItem(this.key); } catch (e) {}
    this.save();
  }
};

/* 全局单例 */
BT.save = new BT.SaveSystem();
