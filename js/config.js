/* ============================================================
 * config.js — 全局配置与可调参数（手感调参中心）
 * 所有物理参数集中在这里，方便快速调整游戏手感
 * ============================================================ */
window.BT = window.BT || {};

BT.CFG = {
  /* 渲染视图：固定内部分辨率，配合 zoom 得到实际视野 */
  view: { width: 1920, height: 1080, zoom: 1.45 },

  /* 地图格子尺寸（像素） */
  tile: 64,

  /* 物理步长（固定时间步，保证手感一致） */
  fixedStep: 1 / 120,

  /* -------- 核心物理参数（可在调试面板实时修改） -------- */
  physics: {
    moveAcceleration: 2000,     // 地面水平加速度 px/s²
    maxMoveSpeed: 520,          // 输入驱动的最大水平速度 px/s
    groundFriction: 1600,       // 地面无输入时的减速 px/s²
    airDrag: 150,               // 空中无输入时的水平阻力 px/s²
    airControl: 0.6,            // 空中控制系数（0~1）
    gravity: 2600,              // 重力加速度 px/s²
    maxFallSpeed: 1500,         // 最大下落速度
    jumpForce: 1150,            // 起跳初速度 px/s
    jumpCutFactor: 0.45,        // 提前松开跳跃键时的速度削减
    coyoteTime: 0.1,            // 土狼时间（离地后仍可跳的宽限）
    jumpBufferTime: 0.12,       // 跳跃预输入缓冲
    landBounceThreshold: 820,   // 落地反弹所需的最小下落速度
    landBounceRestitution: 0.34,// 落地反弹系数
    wallBounceRestitution: 0.38,// 撞墙反弹系数
    wallBounceMinSpeed: 320,    // 触发撞墙变形反弹的最小速度
    bouncePadForce: 1850,       // 弹跳平台向上速度
    softSpeedCap: 990,          // 任何来源的速度硬上限
    excessBleed: 900,           // 超过 maxMoveSpeed 部分的衰减（俯冲动能流失）

    /* 水中物理 */
    waterGravityScale: 0.34,    // 水中重力倍率
    waterBuoyancy: 1150,        // 非"小球"状态的浮力加速度（净向上）
    waterDrag: 2.4,             // 水阻（指数衰减系数 /s）
    waterMoveControl: 0.55,     // 水中操控系数
    waterMaxSink: 230,          // 水中最大下沉速度（小球）
    waterMaxRise: 340,          // 水中最大上浮速度
    waterSwimImpulse: 400,      // 水中按跳跃键的划水冲量
    waterExitBoost: 1.6,        // 冲出水面时的速度增益
  },

  /* -------- 玩家参数 -------- */
  player: {
    radiusNormal: 26,           // 普通球半径
    radiusSmall: 15,            // 小球半径（可进窄缝、下沉）
    smallSpeedMult: 1.22,       // 小球速度倍率
    smallJumpMult: 1.1,         // 小球跳跃倍率
    pushAccel: 1400,            // 推箱子的加速度
    pushMaxSpeed: 170,          // 箱子被推动的最大速度
    breakSpeed: 480,            // 击碎可破坏方块所需撞击速度
  },

  /* -------- 摄像机 -------- */
  camera: {
    smoothness: 7.0,            // 平滑跟随系数
    lookAhead: 0.3,             // 水平前瞻系数（×水平速度）
    lookAheadMax: 240,          // 前瞻最大偏移 px
    fallLook: 0.16,             // 高速下落时向下偏移系数（×垂直速度）
    fallLookMax: 150,           // 下落偏移上限 px
    shakeDecay: 6.0,            // 震屏衰减
  },

  /* -------- 主题调色板（Hollow Knight 式：压抑、低饱和、冷光） -------- */
  themes: {
    forest: {   // «Зелёная тропа» — контрастный мшистый лес
      skyTop: '#101a1c', skyBottom: '#22342c',
      farLayer: '#182622', midLayer: '#111c18', nearLayer: '#080d0b',
      ground: '#2e3d36', groundDark: '#161f1b', groundEdge: '#0a0f0d',
      cap: '#4e7a62', capLight: '#7aa88c', capDark: '#2c4a3a',
      stone: '#3c4844', stoneDark: '#2a3330',
      wood: '#463f35', woodDark: '#2f2a23',
      accent: '#b8e6d2',
      parallaxSeed: 1337,
    },
    cave: {     // «Эхо-пещеры» — глубокий контрастный фиолетовый мрак
      skyTop: '#090713', skyBottom: '#151126',
      farLayer: '#1e1934', midLayer: '#141022', nearLayer: '#0a0813',
      ground: '#2e2a48', groundDark: '#181428', groundEdge: '#0c0a16',
      cap: '#5a5490', capLight: '#7d75b5', capDark: '#312c56',
      stone: '#3a3654', stoneDark: '#272345',
      wood: '#3b374a', woodDark: '#282536',
      accent: '#9fd8e8',
      parallaxSeed: 4242,
    },
    ruins: {    // «Затонувшие руины» — дождливый контрастный город
      skyTop: '#141d26', skyBottom: '#2b3c4b',
      farLayer: '#1e2b37', midLayer: '#15202a', nearLayer: '#0b1218',
      ground: '#37424c', groundDark: '#1f272e', groundEdge: '#11171d',
      cap: '#64747f', capLight: '#8fa2ad', capDark: '#3c4a54',
      stone: '#454f59', stoneDark: '#333c44',
      wood: '#3a3f47', woodDark: '#282c32',
      accent: '#a8c8e8',
      parallaxSeed: 9091,
    },
  },

  /* 关卡地图字符图例（作者用）
   * . 空      # 实心地形    = 单向木平台   / 上坡(\反向)   ' 低矮顶板(形成小球窄缝)
   * ^ 尖刺    o 能量球      C 检查点       E 关卡出口      B 弹跳平台
   * b 可破坏块  W 水        S 开关         D 门块          P 出生点
   * s 缩小装置  i 恢复装置   X 可推箱子     M 移动平台标记
   * m 移动尖刺球标记         r 落石标记     L 激光标记
   * h 隐藏通道块（看起来是地面，实际可穿过）
   */
};
