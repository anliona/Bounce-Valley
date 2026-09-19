/* ============================================================
 * tools/validate.js — 关卡数据静态校验
 * 运行：node tools/validate.js
 * 检查：chunk 行宽一致 / 标记与元数据数量匹配 / 出生点与出口 /
 *       开关目标引用 / 水体底部支撑 / 隐藏块与斜坡支撑 / 可达性粗检
 * ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

/* 最小化浏览器环境桩 */
global.window = global;
global.BT = {};

const root = path.join(__dirname, '..');
for (const f of ['js/levels/level1.js', 'js/levels/level2.js', 'js/levels/level3.js', 'js/levels/registry.js']) {
  eval(fs.readFileSync(path.join(root, f), 'utf8'));
}

const T = 64;
const CHUNK_W = 20;
let failures = 0;
const fail = (msg) => { failures++; console.log('  ✗ ' + msg); };
const ok = (msg) => console.log('  ✓ ' + msg);

for (const def of BT.LEVELS) {
  console.log(`\n=== LEVEL ${def.id} ${def.name} (${def.theme}) ===`);

  /* ---- 解析 chunks（与 level.js 相同规则） ---- */
  const rows = def.rows;
  const chunks = def.chunks.map(raw =>
    raw.split('\n').map(l => l.replace(/\r/g, '')).filter(l => l.length > 0));
  const grid = [];
  let colBase = 0;
  for (const lines of chunks) {
    if (lines.length > rows) fail(`chunk 行数 ${lines.length} 超过关卡行数 ${rows}`);
    while (lines.length < rows) lines.unshift('');
    const width = Math.max(...lines.map(l => l.length));
    if (width !== CHUNK_W) fail(`chunk 宽度 ${width} ≠ ${CHUNK_W}（不齐的行会被静默补齐，请检查）`);
    lines.forEach((line, i) => { if (line.length !== width && line.trim().length > 0) fail(`chunk 第 ${i} 行宽 ${line.length} ≠ ${width}`); });
    for (let r = 0; r < rows; r++) {
      const line = (lines[r] || '').padEnd(width, '.');
      for (let c = 0; c < width; c++) {
        while (grid.length <= r) grid.push([]);
        grid[r][colBase + c] = line[c];
      }
    }
    colBase += width;
  }
  const cols = colBase;
  const at = (c, r) => (r < 0 || r >= rows || c < 0 || c >= cols) ? '.' : grid[r][c];
  ok(`尺寸 ${cols} x ${rows} 格 = ${cols * T} x ${rows * T} px，chunks: ${def.chunks.length}`);

  /* ---- 标记统计 vs 元数据 ---- */
  const count = {};
  let spawn = 0, exit = 0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const ch = at(c, r);
    count[ch] = (count[ch] || 0) + 1;
    if (ch === 'P') spawn++;
    if (ch === 'E') exit++;
  }
  if (spawn === 1) ok('出生点 P x1'); else fail(`出生点 P 数量 = ${spawn}`);
  if (exit === 1) ok('出口 E x1'); else fail(`出口 E 数量 = ${exit}`);

  const metaMap = { M: 'platforms', m: 'spikeballs', r: 'rocks', L: 'lasers', S: 'switches' };
  for (const [ch, key] of Object.entries(metaMap)) {
    const n = count[ch] || 0;
    const m = (def[key] || []).length;
    if (n === m) ok(`标记 ${ch} x${n} = meta.${key} x${m}`);
    else fail(`标记 ${ch} x${n} ≠ meta.${key} x${m}（扫描顺序消耗，必须一致）`);
  }

  /* ---- 开关目标引用 ---- */
  const doorCells = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (at(c, r) === 'D') doorCells.push([c, r]);
  /* 门连通分组计数 */
  const visited = new Set();
  let doorGroups = 0;
  for (const [c, r] of doorCells) {
    const k = c + ',' + r;
    if (visited.has(k)) continue;
    doorGroups++;
    const stack = [[c, r]]; visited.add(k);
    while (stack.length) {
      const [cc, rr] = stack.pop();
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nk = (cc + dc) + ',' + (rr + dr);
        if (!visited.has(nk) && at(cc + dc, rr + dr) === 'D') { visited.add(nk); stack.push([cc + dc, rr + dr]); }
      }
    }
  }
  const targets = [];
  for (const sw of (def.switches || [])) targets.push(...(sw.targets || []));
  const doorRefs = targets.filter(t => t.startsWith('door'));
  const maxDoor = doorRefs.reduce((m, d) => Math.max(m, +d.replace('door', '')), -1);
  if (maxDoor < doorGroups) ok(`门组 x${doorGroups}，开关引用 door0..door${maxDoor} ✓`);
  else fail(`开关引用了不存在的门 door${maxDoor}（仅有 ${doorGroups} 组）`);
  const laserCount = count['L'] || 0;
  for (const t of targets.filter(t => t.startsWith('laser'))) {
    const i = +t.replace('laser', '');
    if (i >= laserCount) fail(`开关引用了不存在的激光 ${t}`);
  }

  /* ---- 能量球统计 ---- */
  console.log(`  · 能量球 o x${count['o'] || 0}，检查点 C x${count['C'] || 0}，尖刺 ^ x${count['^'] || 0}`);

  /* ---- 水体底部支撑 ---- */
  let waterBad = 0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (at(c, r) === 'W' && !'W#'.includes(at(c, r + 1))) waterBad++;
  }
  if (waterBad === 0) ok('所有水体底部有支撑');
  else fail(`${waterBad} 个水格悬空（下方不是水或实心）`);

  /* ---- 隐藏块支撑 ---- */
  let hiddenBad = 0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (at(c, r) === 'h' && !'#h'.includes(at(c, r + 1))) hiddenBad++;
  }
  if (hiddenBad === 0) ok('所有隐藏块下方有支撑');
  else fail(`${hiddenBad} 个隐藏块悬空`);

  /* ---- 斜坡支撑（斜坡下方或侧下应为实心/斜坡） ---- */
  let slopeBad = 0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const ch = at(c, r);
    if (ch !== '/' && ch !== '\\') continue;
    const below = at(c, r + 1);
    const side = ch === '/' ? at(c + 1, r + 1) : at(c - 1, r + 1);
    if (!'#bh'.includes(below) && !'\\/'.includes(side) && !'#'.includes(below)) slopeBad++;
  }
  if (slopeBad === 0) ok('所有斜坡下方有支撑');
  else fail(`${slopeBad} 个斜坡下方悬空`);

  /* ---- 出生点/检查点/出口下方 5 格内应有地面 ---- */
  const needGround = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if ('PCE'.includes(at(c, r))) needGround.push([c, r, at(c, r)]);
  }
  let groundBad = 0;
  for (const [c, r, ch] of needGround) {
    let solid = false;
    for (let rr = r + 1; rr <= Math.min(rows - 1, r + 5); rr++) {
      if ('#bh'.includes(at(c, rr))) { solid = true; break; }
      if ('/\\'.includes(at(c, rr))) { solid = true; break; }
    }
    if (!solid) { groundBad++; fail(`'${ch}' @ (${c},${r}) 下方 5 格内没有地面`); }
  }
  if (groundBad === 0) ok('P/C/E 下方均有地面');

  /* ---- 窄缝校验：' 顶板下方应可直接站立（有地面） ---- */
  let slabBad = 0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (at(c, r) === "'" && !'#b'.includes(at(c, r + 1)) && !'W'.includes(at(c, r + 1))) {
      /* 顶板下方 1 格应临近地面（允许是水/实心） */
      if (!'#W'.includes(at(c, r + 1))) slabBad++;
    }
  }
  if (slabBad > 0) console.log(`  · 提示：${slabBad} 个顶板 ' 下方 1 格不是地面/水（请人工确认缝高）`);
}

console.log('\n================================');
if (failures === 0) console.log('全部检查通过 ✓');
else { console.log(`${failures} 个问题需要修复 ✗`); process.exit(1); }
