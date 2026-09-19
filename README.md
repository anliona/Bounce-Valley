# Bounce Valley · 弹弹谷大冒险

一款原创的 2D 横版物理平台跳跃游戏（灵感来自经典手机平台游戏的手感，全部图形 / 音效 / 音乐 / 关卡均为程序化生成的原创内容）。

你控制一颗红色弹力球，利用**惯性滚动、斜坡加速、弹跳平台与各种机关**，穿越 3 个主题关卡：

| 关卡 | 主题 | 新机制 |
|---|---|---|
| 1 | 教学森林 Grassy Trail | 移动 / 跳跃 / 惯性 / 收集物 / 检查点 / 隐藏通道 |
| 2 | 幽暗洞穴 Echo Caves | 移动平台 / 尖刺 / 弹跳板 / 狭窄通道 / 开关门 / 落石 / 激光 / 摆锤尖刺球 / 可破坏块 |
| 3 | 水域遗迹 Sunken Ruins | 水 / 浮力 / 水下区域 / 缩小·恢复装置 / 升降平台 / 推箱压开关 / 隐藏房间 |

## 运行方式

**直接双击 `index.html` 即可游玩**（纯原生 HTML5 Canvas + JavaScript，无构建、无依赖、无外部素材）。

> 如需本地服务器（可选）：`python -m http.server` 或 `npx serve`，然后访问对应地址。

推荐浏览器：Chrome / Edge / Firefox 最新版。

## 操作

| 按键 | 功能 |
|---|---|
| A / ← | 向左移动 |
| D / → | 向右移动 |
| Space / W / ↑ | 跳跃（水中为游泳） |
| R | 重新开始本关 |
| ESC | 暂停菜单 |
| ` / F3 | 调试面板 |

手机 / 触屏设备会自动显示半透明触控按钮（左下移动、右下跳跃），也可在 Settings 中强制开关。

## 调参指南（游戏手感）

所有物理参数集中在 **`js/config.js`**：

```js
physics: {
  moveAcceleration, maxMoveSpeed, groundFriction, airControl,
  gravity, jumpForce, bouncePadForce, waterDrag, ...
}
camera: { smoothness, lookAhead, ... }
```

游戏内按 **` / F3** 打开调试面板可实时修改 gravity / jumpForce / maxSpeed / friction，
并提供 Restart / Teleport to Checkpoint / Unlock All / Win Level / FPS / 坐标显示。

## 代码结构

```
index.html            入口（按依赖顺序加载各模块）
css/style.css         UI 样式
js/
  config.js           ★ 全局可调参数（物理/摄像机/主题色/地图图例）
  utils.js            数学工具
  save.js             SaveSystem（localStorage：解锁/纪录/设置）
  input.js            键盘 + 触屏输入
  audio.js            AudioManager（WebAudio 程序化音效 + 音乐音序器）
  particles.js        粒子系统
  camera.js           平滑跟随摄像机（LookAhead / 震屏）
  physics.js          圆-矩形分轴碰撞 / 斜坡高度场
  player.js           玩家：物理 + 控制 + squash&stretch 动画
  background.js       多层视差背景（按主题程序化生成）
  level.js            关卡解析 / 空间查询 / 瓦片渲染 / 水体
  entities/
    props.js          能量球/检查点/弹跳板/可破坏块/大小装置/推箱/传送门/提示牌
    mechanisms.js     移动平台 / 开关 / 门
    hazards.js        尖刺 / 摆锤尖刺球 / 激光 / 落石
  levels/
    level1.js level2.js level3.js   关卡数据（ASCII 分块地图）
    registry.js                     关卡注册表
  ui.js               UIManager（菜单/HUD/结算）
  debug.js            调试面板
  game.js             GameManager（状态机 + 主循环）
  main.js             启动入口
tools/validate.js     关卡数据静态校验（node tools/validate.js）
```

## 关卡制作说明

关卡由若干 **20 列宽的 ASCII 分块（chunk）** 横向拼接而成，每行一个字符：

```
. 空    # 实心地形   = 单向木平台   / \ 斜坡     ' 低矮顶板(小球窄缝)
^ 尖刺  o 能量球     C 检查点       E 出口       B 弹跳板
b 可破坏块  W 水      S 开关         D 门块       P 出生点
s 缩小装置  i 恢复装置 X 可推箱子     M 移动平台
m 摆锤尖刺球  r 落石   L 激光         h 隐藏通道(可穿过)
```

带参数的标记（M/m/r/L/S）按 **从上到下、从左到右** 的扫描顺序，依次消耗关卡定义里的
`platforms / spikeballs / rocks / lasers / switches` 元数据数组；开关通过
`{ targets: ['door0','laser1'] }` 关联门与激光（门按扫描顺序编号 door0、door1…）。

修改关卡后可运行 `node tools/validate.js` 做完整性检查（行宽 / 标记与元数据数量 /
出生点与出口 / 水体底支撑 / 斜坡支撑等）。

## 存档

- 解锁进度、每关最高能量球数、最快通关时间、音量与触屏设置，保存在 `localStorage`
  （键 `bounce_valley_save_v1`），重开浏览器后保留；Settings 中可一键清除。
