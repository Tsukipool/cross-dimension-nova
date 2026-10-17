# 跨次元新星 · Cross-Dimension Nova

山东省济钢高级中学（全福校区）「跨次元新星」动漫社的作品集网站。内容覆盖插画、短篇小说与概念影像，视觉上采用深色电影感、2.5D 层叠、Canvas 粒子星场与少量 3D 交互。

本文面向后续维护者，重点说明项目结构、内容工作流、动效实现、部署方式与容易踩坑的地方。

## 目录

- [快速开始](#快速开始)
- [技术栈](#技术栈)
- [项目结构](#项目结构)
- [内容维护](#内容维护)
- [社团信息与品牌](#社团信息与品牌)
- [视觉系统](#视觉系统)
- [粒子与动效架构](#粒子与动效架构)
- [页面滚动与锚点定位](#页面滚动与锚点定位)
- [SEO 与部署](#seo-与部署)
- [dist 构建产物](#dist-构建产物)
- [Git 提交规范](#git-提交规范)
- [维护检查清单](#维护检查清单)
- [常见问题](#常见问题)
- [内容与许可](#内容与许可)

## 快速开始

环境要求：**Node.js >= 22.22.0**、npm。

```bash
npm ci                 # 安装锁定版本依赖
npm run dev            # 开发服务器，默认 http://localhost:4321
npm run build          # 静态构建到 dist/
npm run preview        # 预览 dist/
npm run art            # 重新生成 public/art 下的示例插画和静态星图
```

`npm run dev` 与 `npm run preview` 当前带有 `--host`，同一局域网内可访问。

## 技术栈

- **Astro 7**：静态站点、文件路由、内容集合
- **GSAP + ScrollTrigger**：Hero 视差、滚动触发动画
- **Lenis**：平滑滚动
- **Canvas 2D**：轻量 3D 星场、浮尘、星座连线（未使用 Three.js / WebGL）
- **Astro Content Collections + Zod**：作品 frontmatter 校验
- **@astrojs/sitemap**：构建时生成 sitemap
- **Fontsource**：Inter、Cormorant Garamond 字体
- 中文使用系统字体回退：Noto Serif CJK / Noto Sans CJK / 思源 / 系统宋体

## 项目结构

```text
.
├─ src/
│  ├─ content.config.ts       # 作品集合 schema
│  ├─ content/works/          # 作品内容，每件作品一个 Markdown
│  ├─ lib/works.ts            # 作品查询、类型标签、排序与跳转地址
│  ├─ components/             # 页面区块与通用组件
│  │  ├─ Hero.astro           # 首页 Hero，3D 星场与浮动卡片
│  │  ├─ PageHero.astro       # 档案页 / 关于页的大标题 Hero
│  │  ├─ WorkCard.astro       # 作品卡片与倾斜交互
│  │  ├─ Cinema.astro         # 首页放映室
│  │  ├─ NovelFeature.astro   # 首页小说展示区
│  │  ├─ ParticleField.astro  # 粒子画布容器
│  │  └─ ...
│  ├─ layouts/BaseLayout.astro # 字体、SEO、导航、页脚、弹窗、全局脚本
│  ├─ pages/
│  │  ├─ index.astro          # 首页
│  │  ├─ works/index.astro    # 作品档案 + 类型筛选
│  │  ├─ works/[slug].astro   # 作品详情，按类型切换版式
│  │  ├─ about.astro          # 关于社团
│  │  ├─ 404.astro
│  │  └─ robots.txt.ts        # 构建时生成 robots.txt
│  ├─ scripts/main.ts         # 全局交互、菜单、筛选、灯箱、播放器、锚点
│  ├─ scripts/particles.ts    # 粒子引擎
│  └─ styles/global.css       # 设计令牌、基础样式、动效与性能降级
├─ public/
│  ├─ art/                    # 作品图、封面、OG 辅助图、星图
│  ├─ media/                  # 视频文件
│  ├─ og.jpg                  # 社交分享图 1200×630
│  └─ favicon.svg
├─ scripts/generate-art.mjs   # 生成示例 SVG 与 starfield.svg
├─ dist/                      # 构建产物（已纳入 Git）
├─ astro.config.mjs
└─ package.json
```

## 内容维护

### 作品数据模型

作品放在 `src/content/works/*.md`，文件名（不含 `.md`）就是 URL slug，例如 `stardust-tram.md` → `/works/stardust-tram/`。建议使用小写英文与连字符。

frontmatter 字段：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `title` | string | 是 | 中文标题 |
| `english` | string | 是 | 英文标题，用于排版 |
| `type` | `illustration` \| `novel` \| `video` | 是 | 决定详情页版式与筛选项 |
| `category` | string | 是 | 展示用分类，如“概念插画”“短篇小说” |
| `serial` | string | 是 | 作品编号，如 `"001"` |
| `year` | string | 是 | 年份 |
| `date` | string | 是 | 展示日期，如 `"2026.04"` |
| `cover` | string | 是 | 封面路径，必须从 `/` 开始，如 `/art/foo.svg` |
| `accent` | string | 是 | 强调色，**请使用十六进制**，如 `"#f3a5b4"`（粒子引擎会解析它） |
| `summary` | string | 是 | 一句话简介，用于卡片和详情页 |
| `tags` | string[] | 否 | 标签 |
| `gallery` | `{ src, alt, caption? }[]` | 否 | 详情页画廊 / 灯箱图片 |
| `video` | string | 视频必填 | 视频路径，如 `/media/film.mp4` |
| `duration` | string | 视频建议 | 片长，如 `"00:10"` |
| `credits` | `{ role, name }[]` | 否 | 制作人员 |
| `quote` | string | 否 | 引语，用于首页小说推荐 |
| `readingTime` | string | 小说建议 | 阅读时长，如 `"约 6 分钟"` |
| `featured` | boolean | 否 | 预留字段；**当前首页精选不读取它** |
| `order` | number | 否 | 档案排序，越小越靠前 |

> `featured` 目前仅保留在 schema 中，首页精选由 `src/pages/index.astro` 的 `selectedIds` 决定。不要误以为加上 `featured: true` 就会自动出现在首页。

### 新增一件作品

1. 在 `src/content/works/` 新建 `<slug>.md`。
2. 将图片放到 `public/art/`（或自建子目录），路径写入 frontmatter，例如 `/art/my-work.svg`。
3. 按作品类型填写视频、阅读时长等字段。
4. 正文就是用 Markdown 写的作品介绍；小说正文中的 `##` 标题会自动成为章节目录。
5. 如果希望出现在首页“精选”，把 slug 加入 `src/pages/index.astro` 的 `selectedIds` 数组，并按版式需要调整顺序。
6. 运行 `npm run build`，构建通过后再提交。

最简插画示例：

```yaml
---
title: 新作品
english: NEW WORK
type: illustration
category: 概念插画
serial: "010"
year: "2026"
date: "2026.10"
cover: /art/my-work.svg
accent: "#ff93a6"
summary: 一句话介绍。
tags: [场景, 夜色]
order: 10
gallery:
  - src: /art/my-work.svg
    alt: 画面描述
    caption: 主视觉
---
正文使用 Markdown。
```

视频作品额外需要：

```yaml
type: video
video: /media/my-film.mp4
duration: "00:32"
```

小说作品建议提供 `readingTime`，正文用 `##` 分章。当前详情页的阅读进度和章节导航会自动生成。

### 修改现有作品

- 修改 frontmatter 后开发服务器会自动刷新。
- 修改文件名会改变 URL，旧链接和外部分享链接需要同步更新。
- `serial` 不要求唯一，但 UI 会直接展示，建议保持连续。
- 封面会被卡片按固定比例裁切（`object-fit: cover`），重要主体请放在画面中部。

### 替换示例素材

仓库中的作品、作者署名与短片都是演示内容。正式发布前：

1. 替换 `src/content/works/`、`public/art/` 与 `public/media/`；
2. 更新 `public/og.jpg`（建议 1200×630）；
3. 检查社团名称、指导老师、招新信息；
4. 重新构建并提交 `dist/`。

**注意**：`npm run art` 会重新生成同名的示例 SVG，并覆盖 `public/art/` 中对应的文件。如果已经换成真实作品，不要再运行该命令，或先修改生成脚本的输出路径。

## 社团信息与品牌

学校全称：**山东省济钢高级中学（全福校区）**。修改学校名时需要同步检查：

- `src/components/Hero.astro`、`Manifesto.astro`、`Nav.astro`、`Footer.astro`
- `src/pages/about.astro`（介绍、社团信息、招募范围）
- `src/layouts/BaseLayout.astro`（默认标题、描述、JSON-LD）
- `README.md`、`package.json`
- 重新生成或修改 `public/og.jpg` 中的分享图文案

品牌英文名：**Cross-Dimension Nova**；短品牌 **NOVA**；仓库名 `cross-dimension-nova`。

社团宗旨、指导老师等资料来自《新社团成立申请表》。如学校信息变化，请以学校最新公告为准。

## 视觉系统

设计令牌集中在 `src/styles/global.css` 的 `:root`：

- 背景：`--bg`、`--bg-deep`、`--surface`
- 文本：`--ink`、`--ink-dim`、`--ink-faint`
- 强调色：`--accent`（樱粉）、`--accent-warm`（暖金）、`--accent-cool`（青）
- 字体：`--serif`、`--sans`、`--display`、`--mono`
- 导航高度：`--nav-h`（桌面 96px，移动端 76px）

页面专属样式通常写在各自 `.astro` 组件的 `<style>` 中。跨页面复用的按钮、栅格、弹窗、预加载器、粒子层样式在 `global.css`。

修改主色后，请同时检查：

- 自定义光标
- 按钮悬停底色
- 作品详情页的 `--work-accent`
- `public/favicon.svg`
- `public/og.jpg`

## 粒子与动效架构

### 粒子组件

`ParticleField.astro` 是一个绝对定位的画布容器，可在任意 `position: relative` 的父级中使用：

```astro
<ParticleField
  variant="dust"
  density={0.8}
  accent="#ff93a6"
  opacity={0.6}
/>
```

可用参数：

- `variant="starfield"`：3D 星场，用于首页 Hero / 404
- `variant="dust"`：浮尘与稀疏星座线，用于 PageHero、作品详情、招新区域
- `density`：粒子密度倍率
- `accent`：**十六进制颜色**，用于发光粒子
- `opacity`：整个画布的透明度

如果某一区域不需要粒子，直接移除对应的 `<ParticleField />` 即可，不需要改 JS。

### 性能设计

`src/scripts/particles.ts` 做了以下处理，改动时请保留这些约束：

- 单个 requestAnimationFrame 循环统一驱动所有可见粒子场
- `IntersectionObserver` 在离屏时暂停绘制
- 浏览器切换到后台时自动停止，回到前台恢复
- Canvas 渲染分辨率低于 CSS 尺寸（DPR 上限 1.5 / 1.2），粒子是柔光效果，不需要满分辨率
- 大部分星点使用 `fillRect`，只有少量亮星使用预渲染发光贴图
- 粒子绘制约 30fps；低配设备 24fps
- 根据 `hardwareConcurrency` / `deviceMemory` 自动降低数量、DPR 与动画
- 指针状态只由一个 passive 的 `pointermove` 监听器采样，计算合并到 rAF

大范围 `filter: blur()` 在部分设备上非常昂贵，目前已从大面积光晕上移除。新增背景光效时优先使用径向渐变、预渲染图片或 CSS transform；不要给整屏元素添加动画模糊。

### 卡片倾斜与鼠标流畅度

`initTilt()` 在 `main.ts` 中实现：

- `pointerenter` 时缓存卡片边界，避免在每次 `pointermove` 调用 `getBoundingClientRect()`
- 使用 `requestAnimationFrame` 合并更新
- 通过 CSS 变量 `--rx` / `--ry` / `--gx` / `--gy` 驱动变换和反光

新增可倾斜卡片时添加 `data-tilt`，并在对应组件 CSS 中消费这些变量即可。

### 减少动态效果

- 全站支持 `prefers-reduced-motion`
- 在减少动态模式下，粒子只渲染静态一帧，Lenis 不启动，卡片倾斜禁用
- 低性能设备会自动获得 `html.low-power`，关闭高成本 backdrop-filter 与部分循环动画

## 页面滚动与锚点定位

顶部锚点（`/#cinema`、`/#join`、Hero 下滑按钮、详情页章节目录）统一由 `scrollToTarget()` 处理。

**关键约定：**

- 固定导航高度只通过 `--nav-h` 调整
- 页面锚点偏移只通过 `global.css` 中的 `html { scroll-padding-top: var(--nav-h); }` 控制
- **不要给锚点目标再加 `scroll-margin-top`**，否则 Lenis 会重复扣除偏移，导致定位偏差
- 跳转使用页面绝对坐标并先调用 `lenis.resize()` 同步真实滚动位置；这样才能处理跨页面 hash 跳转
- 详情页正文使用 `data-reveal="fade"`，避免章节跳转时 transform 位移造成目标位置漂移

如果新增顶部导航锚点，在页面 section 上加 `id`，链接使用 `/#id` 或 `#id` 即可。

## SEO 与部署

### 构建前设置域名

Astro 会把 `site` 写入 canonical、OG、sitemap 与 robots。默认回退值是 `https://example.com`。

```bash
SITE_URL="https://your-domain.com" npm run build
```

PowerShell：

```powershell
$env:SITE_URL="https://your-domain.com"; npm run build
```

也可以修改 `astro.config.mjs` 中的 `site` 回退值，但推荐在部署环境注入 `SITE_URL`。

### 静态部署

`dist/` 是纯静态站点，可直接部署到 Cloudflare Pages、Netlify、Vercel、GitHub Pages 或任意静态服务器。`dist/404.html` 是自定义 404 页面，需要托管平台支持 404 fallback。

部署前检查：

- `dist/robots.txt` 中的 Sitemap 域名
- 页面源码中的 canonical / `og:image`
- `dist/sitemap-index.xml` 和 `dist/sitemap-0.xml`

### 分享图

`public/og.jpg` 需要单独维护，构建不会自动生成。替换时建议 1200×630，保留标题可读性。

## dist 构建产物

**`dist/` 已纳入 Git 版本控制**，用于直接部署或提供给不熟悉 Node 环境的使用者。

因此：

1. 修改任何源码后，先运行 `npm run build`；
2. 确认构建成功，并检查 `dist/` 中的关键页面；
3. 将源码与 `dist/` 一起提交；
4. **不要手动编辑 `dist/`**，它会在下一次构建时被覆盖。

如果之后决定不在版本库中保存构建产物，可以从 `.gitignore` 恢复 `dist/` 并在 Git 中移除缓存，但本次维护约定是保留它。

## Git 提交规范

项目使用 [Conventional Commits](https://www.conventionalcommits.org/)：

```text
<type>(<scope>): <subject>
```

常用类型：

- `feat`：新功能或新页面
- `fix`：缺陷修复
- `docs`：文档
- `perf`：性能优化
- `style`：不影响逻辑的样式调整
- `refactor`：重构
- `build`：构建系统、依赖、构建产物
- `chore`：其他维护工作
- `ci`：CI 配置

示例：

```text
feat(works): add autumn exhibition entry
fix(nav): align hash targets below fixed header
perf(particles): reduce off-screen canvas work
docs: update content maintenance guide
chore(build): refresh dist output
```

提交前建议执行：

```bash
npm run build
git status
git add -A
git commit -m "type(scope): subject"
```

## 维护检查清单

发布前建议手动检查：

- [ ] `npm run build` 无报错
- [ ] 首页 Hero、粒子、视差与卡片倾斜正常
- [ ] 顶部导航与页脚锚点准确停在导航栏下方
- [ ] 作品档案筛选、计数、URL 参数正常
- [ ] 插画灯箱可打开、切换与关闭
- [ ] 小说详情章节目录、阅读进度正常
- [ ] 视频详情页与剧场模式可播放
- [ ] 移动端菜单、布局与横向溢出正常
- [ ] `prefers-reduced-motion` 下无持续动画
- [ ] 浏览器控制台无错误
- [ ] 设置正式 `SITE_URL` 后重新构建
- [ ] `dist/` 已更新并与源码一起提交

项目目前没有自动化测试套件，以上人工检查是主要回归手段。

## 常见问题

**页面还显示旧内容？**
停止并重启开发服务器。若 Vite 依赖缓存异常，删除 `node_modules/.vite` 和 `.astro/` 后重新执行 `npm run dev`。

**canonical / sitemap 还是 example.com？**
说明构建时没有设置 `SITE_URL`。重新执行带正式域名的构建，并提交新的 `dist/`。

**顶部锚点又偏了？**
检查是否新增了 `scroll-margin-top`，或给目标元素套了带 `transform` 的 reveal 容器。保持 `scroll-padding-top` 为唯一定位偏移来源。

**新增粒子后卡顿？**
优先降低 `density`、移除不必要的大范围粒子场；避免大面积实时 `filter: blur()`；确认没有在 `pointermove` 中读取布局。

**视频无法播放？**
使用 H.264 / MP4（`video/mp4`），确认文件位于 `public/media/`，路径以 `/media/` 开头。演示视频为无声素材，替换成有声音的视频时 UI 文案中的“无声”说明也需同步修改。

**想换首页精选？**
修改 `src/pages/index.astro` 中的 `selectedIds`。作品本身是否 `featured` 不影响首页。

## 内容与许可

- 社团资料参考山东省济钢高级中学（全福校区）《新社团成立申请表》。
- 站点内示例作品、署名与短片为演示内容，版权归对应创作者/社团所有。
- Inter 与 Cormorant Garamond 通过 Fontsource 引入，遵循 SIL Open Font License。
- Astro、GSAP、Lenis、@astrojs/sitemap 遵循各自开源许可。
- 本仓库目前未附带代码开源许可证；如需公开发布代码，请先补充 `LICENSE` 并与社团确认内容授权。
