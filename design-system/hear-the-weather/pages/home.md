# 首页（单页应用）设计覆盖规则 — 覆盖 MASTER.md

> 由 ui-ux-pro-max skill 生成的 MASTER.md 提供基础方向（Music Streaming → Dark Mode (OLED) + Aurora UI / Glassmorphism）。
> 本文件记录针对《听见天气》的项目级调整，优先级高于 MASTER.md。

## 1. 风格：Aurora Glass Night Radio
- 底色：采用 MASTER 的深靛夜色 `#0F0F23` / 卡片 `#1B1B30` 作为“夜空基底”，
  叠加随实时天气变化的天象极光层（`--sky-*`、`--sky-glow`），保持“天气驱动界面”的核心创意。
- 玻璃拟态（skill `glassmorphism` 条目）：`backdrop-filter: blur(16px)`、半透明渐变卡片、
  `1px rgba(255,255,255,0.14)` 细描边 + 顶部高光，文本对比度 ≥ 4.5:1。

## 2. 颜色
- CTA / 强调色：保留随天气切换的 `--accent`（晴=琥珀、雨=天蓝、雪=冰蓝……），
  不采用 MASTER 的固定绿色 —— 强调色本身就是“天气的颜色”。
- 语义色：成功 `#34D399`、警告 `#F59E0B`、错误 `#EF4444`（MASTER Destructive）。
- 组件内禁止硬编码新的十六进制色值，统一使用 CSS 变量。

## 3. 字体
- MASTER 推荐 Righteous / Poppins（Google Fonts）。**国内网络无法稳定访问 Google Fonts**，
  且作业要求站点在国内可访问，因此改用中文系统字体栈
  （PingFang SC / HarmonyOS Sans SC / Microsoft YaHei / Noto Sans SC）。
- 数字统一 `font-variant-numeric: tabular-nums`；超大温度采用渐变描字 + 负字距作为展示字形。
- 正文最小字号 12px（0.75rem），行高 1.5。

## 4. 动效（Motion 5/10 — Standard）
- 主面板载入时错峰淡入上浮（300–450ms，stagger 60–90ms），纯 CSS 实现，不引入 GSAP 依赖。
- 悬停 / 按压过渡 150–250ms；每屏持续动画 ≤ 2 个（黑胶旋转 + 极光漂移）。
- `prefers-reduced-motion: reduce` 时关闭全部非必要动画。

## 5. 交互与无障碍
- 全局 `:focus-visible` 焦点环（2px accent + 2px offset）。
- 所有可点击元素 `cursor: pointer`；移动端触控目标 ≥ 44px。
- 禁止横向滚动：flex 子项滚动容器必须设置 `min-width: 0`。
- 图标统一 SVG，不使用 emoji 作为图标。

## 6. 交付前检查清单
- [x] 无 emoji 图标（SVG）
- [x] cursor-pointer
- [x] 150–300ms 平滑过渡
- [x] 文本对比度 4.5:1
- [x] 键盘焦点可见
- [x] prefers-reduced-motion
- [x] 375 / 768 / 1024 / 1440 响应式，无横向滚动
