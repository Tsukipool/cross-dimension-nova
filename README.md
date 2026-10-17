# 跨次元新星 · Cross-Dimension Nova

山东省济钢高级中学（全福校区）「跨次元新星」动漫社的作品集网站。以插画、短篇小说与概念影像为内容核心，使用 Astro 构建，整体呈现深色、电影感与 2.5D 层叠视觉。

## 快速开始

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # 生成静态站点到 dist/
npm run preview    # 预览构建结果
npm run art        # 重新生成 public/art 下的矢量插画
```

需要 Node.js 22.22 及以上版本。

## 部署

站点是纯静态输出，可将 `dist/` 部署到任意静态托管（Cloudflare Pages、Netlify、Vercel、GitHub Pages 等）。

构建前设置正式域名，用于 canonical、OG 与 sitemap：

```bash
SITE_URL="https://your-domain.com" npm run build
```

也可以直接修改 `astro.config.mjs` 中的 `site` 回退值。

## 内容结构

```
src/
├─ content/works/        # 每件作品的 Markdown 与 frontmatter
├─ components/           # Hero、作品卡、放映室、小说区等
├─ layouts/BaseLayout    # 全站 head、导航、页脚、弹窗
├─ pages/
│  ├─ index.astro        # 首页
│  ├─ works/index.astro  # 作品档案
│  ├─ works/[slug].astro # 作品详情（自动按类型切换版式）
│  ├─ about.astro        # 社团介绍
│  └─ 404.astro
├─ scripts/main.ts       # 动效、筛选、灯箱、播放器、菜单
└─ styles/global.css     # 设计令牌与全站基础样式
public/
├─ art/                  # 当前作品的主视觉与画廊图（SVG）
├─ media/                # 概念短片（MP4）
├─ og.jpg                # 社交分享图
└─ favicon.svg
scripts/generate-art.mjs # 通过 npm run art 生成示例视觉
```

## 添加或修改作品

在 `src/content/works/` 新建 `<slug>.md`，slug 会成为详情页地址 `/works/<slug>/`。

```yaml
---
title: 星屑电车
english: STARDUST TRAM
type: illustration # illustration | novel | video
category: 概念插画
serial: "001"
year: "2026"
date: "2026.04"
cover: /art/stardust-tram.svg
accent: "#f3a5b4"
summary: 一句话作品简介。
tags: [场景设定, 夜色]
featured: true
order: 1
quote: 可选的作品引语。
readingTime: 约 6 分钟          # 小说使用
duration: "00:10"               # 视频使用
video: /media/first-night.mp4  # 视频使用
gallery:
  - src: /art/stardust-tram.svg
    alt: 图片替代文本
    caption: 图注
credits:
  - role: 绘制
    name: 跨次元新星 · 视觉组
---
正文使用 Markdown。小说会把 `##` 标题自动生成章节目录；插画 / 视频会把正文作为作品阐述。
```

- **首页精选**在 `src/pages/index.astro` 的 `selectedIds` 数组中配置，当前为 4 件。首件建议横图，第二件建议竖图。
- **作品数量、分类筛选计数**会自动从内容集合计算；首页精选数字也会自动更新。
- **画廊图**点击后可打开灯箱；视频会在详情页和弹窗中播放。
- **颜色**：`accent` 控制详情页的光晕、章节编号等强调色。

## 替换示例内容

仓库内的作品、作者署名与短片均为用于展示版式的示例内容。正式发布前请：

1. 用社团真实作品替换 `src/content/works/` 与对应图片；
2. 将 `public/media/` 下的演示视频替换为社团视频（保持 MP4 / H.264 编码兼容性最好）；
3. 视需要替换 `public/og.jpg`（建议 1200×630）；
4. 检查社团介绍、指导老师、招新信息与年份；
5. 设置 `SITE_URL` 后重新构建。

示例插画由 `scripts/generate-art.mjs` 通过代码绘制，全部为原创抽象场景，可自由替换；该脚本也会生成首页与分区使用的静态星图 `public/art/starfield.svg`。当前演示短片为 10 秒无声循环影像，由同组插画用 ffmpeg 合成。

## 设计说明

- 视觉基调：午夜蓝黑、月白、樱粉与暖金；衬线中文 + Cormorant Garamond 英文斜体 + Inter 微排版。
- 2.5D / 3D：Hero 浮动画框、鼠标视差、滚动层差、3D 卡片倾斜、纸书立体封面、多层轨道环与粒子星场。
- 粒子：无第三方 WebGL 依赖的 Canvas 3D 星场与浮尘/星座粒子，叠加静态星图降低每帧开销。
- 动效：GSAP + ScrollTrigger + Lenis，包含首次加载过场、文字遮罩上浮、分区滚入、筛选过渡与自定义光标。
- 性能：粒子场的 rAF 统一调度、离屏与切后台自动暂停、DPR 限制、按设备核心数降低粒子数量与帧率；卡片倾斜缓存边界并使用 rAF 节流，避免指针事件触发重复布局计算；低配设备自动关闭高成本模糊与部分持续动画。
- 可访问性：支持 `prefers-reduced-motion`，导航与弹窗具备键盘操作、焦点管理，图片带替代文本；已在主要页面通过 axe WCAG 2.1 A/AA 检查。
- 字体：Inter、Cormorant Garamond（均为 SIL Open Font License）；中文使用系统 Noto / 思源宋体回退，不额外加载大体积中文字体。

## 技术栈

Astro · GSAP · ScrollTrigger · Lenis · Astro Content Collections · @astrojs/sitemap

社团资料参考山东省济钢高级中学（全福校区）《新社团成立申请表》。站点内容版权归跨次元新星动漫社所有；第三方依赖与字体遵循各自开源许可。
