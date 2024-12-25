---
title: 博客迁移记录
description: 记录博客从 Hugo 迁移到 Quartz 的过程
tags:
  - 环境配置
  - 开发工具与工作流
date: 2024-12-20
lastmod: 2024-12-25
draft: false
---

# Quartz 的构建

> [!tldr]
>
> 关于官方的构建教程，可以参考：[quartz 官方文档](https://quartz.jzhao.xyz/)，如果看不习惯英文，也可以参考 [quartz 文档中文版](https://quartz.songxingguo.com/)，但需要注意的是中文文档有些过时了，有很多新的 Features 都没有翻译

在这里主要记录一下我的迁移与配置过程。

首先，我们需要到 [官方仓库](https://github.com/jackyzha0/quartz) 中，点击 `Use this template` 进行仓库的生成

![image.png](https://virgil-civil-1311056353.cos.ap-shanghai.myqcloud.com/img/20241223144256.png)

- 如果你没有自己的个人博客网站，那么可以新建的名称为 `github-username.github.io`，这里 `github-username` 是你的 Github 账号名称；
- 否则你可以自定义生成一个仓库，例如 `quartz` ，但请牢记仓库的名称

我在这里为了方便，直接使用了第一种方式，因为这个仓库名不需要额外配置 `github pages`

然后，我们生成了一个仓库后，将其克隆到本地，并安装本地包，尝试在本地构建 运行：

```bash warp showLineNumbers
git clone <your-repo-url> blogs
cd blogs
pnpm i
npx quartz build --serve --concurrency 4
```

随后，就能够在 localhost:8080 打开构建完成的网页了，生成的所有 `html` 文件都在 `public` 文件夹中。

# `Quartz` 基础配置

基础配置需要在 `quartz.config.ts` 中进行配置，需要注意的只有三个部分：

1. `analytics`
2. `baseUrl`
3. `defaultDateType`

## `Analytics`

网站的分析工具，这里推荐使用微软出品的 `clarity`，配置简单，而且开源免费，分析的感觉也很有意思：

![image.png](https://virgil-civil-1311056353.cos.ap-shanghai.myqcloud.com/img/20241223153952947.png)

配置只需要填写 `{provider: 'clarity', projectId: '<your-clarity-id-code' }` 即可，如下所示：

```ts showLineNumbers
analytics: {
  provider: "clarity",
  projectId: "xxxxxx"
},
```

## `baseUrl`

这里尤为重要，主要是填写博客的地址，由于我在 [[#Quartz 的构建]] 中提到，我使用的是第一种方法，所以在这里直接填写我的博客地址即可（如果是第二种方法，那么需要写成 `github-username.github.io/repo-name`）

## `defaultDateType`

这里我填写的为 `defaultDateType: "modified",`，其实就是为了在 `Meta` 数据中显示最近一次更新的时间，我会在 `frontmatter` 中的 `lastmod` 进行填写，需要注意的是，原来的创建时间 `createAt` 现在被更改为 `date` 了

## 其他设置

其余的设置暂时都与默认一致，但 `Plugin.Latex({ renderEngine: "katex" }),` 中，我发现其实数学还支持使用 `typst`

> [!note]-
>
> 在 2024-12-23 时，`typst` 暂时还无法使用，原因是[上游的包](https://www.npmjs.com/package/@myriaddreamin/rehype-typst) 还没有更新，会导致构建失败（问题在于 `locate` 这个函数在 `typst` 中已经被弃用了）

# 布局配置

布局配置较为简单，这里主要说明一下[评论的增加](https://quartz.jzhao.xyz/features/comments)

我们在这里增加评论组件：

```ts showLineNumbers {"Giscus 配置": 8-15}
// components shared across all pages
export const sharedPageComponents: SharedLayout = {
  head: Component.Head(),
  header: [],
  afterBody: [],
  footer: Component.Comments({
    provider: "giscus",

    options: {
      repo: "xxxxxxx",
      repoId: "xxxxxxx",
      category: "Announcements",
      categoryId: "xxxxxxx",
      themeUrl: "https://giscus.app/themes/",
      lightTheme: "noborder_light"
    }
  })
}
```

我们可以在 [Giscus](https://giscus.app/zh-CN) 直接填写一些信息，然后网站就会给出配置信息，我们按照名称对应一一填写即可。

> [!note]
>
> 其实官网上的配置很多，可以参考 [Features List](https://quartz.jzhao.xyz/features/)

# 样式的修改

这里样式的修改主要集中在三个部分：

1. 字体的显示
2. 主题的颜色
3. 一些自定义的设置

## 字体

对于字体而言，我使用的和 [[my-tools-1#主题与插件|Obsidian 字体]] 中所述的一致，我们需要在 `quartz/style/custom.scss` 中进行配置：

```scss showLineNumbers warp {"Bookerly in LXGW": 24-32}
@font-face {
    font-family: "LXGWWenKaiScreen";
    font-style: normal;
    font-weight: normal;
    font-display: swap;
    src: url("/static/fonts/LXGWWenKaiScreen.woff2") format("woff2");
}

@font-face {
    font-family: "Monaco";
    font-style: normal;
    font-weight: normal;
    font-display: swap;
    src: url("/static/fonts/Monaco.woff2") format("woff2");
}

@font-face {
    font-family: "Biro";
    font-style: normal;
    font-weight: normal;
    font-display: swap;
    src: url("/static/fonts/Biro_Script.woff2") format("woff2");
}

@font-face {
    font-family: "LXGWWenKaiScreen";
    font-style: normal;
    font-weight: normal;
    font-display: swap;
    src: url("/static/fonts/Bookerly.woff2") format("woff2");
    unicode-range: U+00-7F;
}
```

^2a6f32

注意高亮的行，我们通过 `unicode-range` 将两个字体何为一个，都称为 `LXGWWenKaiScreen`，这样，我们在 `quartz.config.ts` 中的写法为：

```ts showLineNumbers {"Font Config": 4-8}
theme: {
  fontOrigin: "local",
  cdnCaching: false,

  typography: {
	header: "LXGWWenKaiScreen",
	body: "LXGWWenKaiScreen",
	code: "Monaco",
  },

```

随后，我们需要将下载的字体（最好是压缩后的，`woff2` 的格式就比较小），放在 `quartz/static/fonts` 中，也就是与 [[#^2a6f32|字体配置]] 中填写的 `url` 一致，但存放静态文件的路径必须存于 `quartz/static` 目录下，否则无法被构建到最终的网页文件夹 `public` 中

## 主题颜色

暂时只适配了亮色主题，并把暗色主题的切换删除了，强制亮色显示（，颜色的配置的含义为：

light: 页面背景
lightgray: 边框
gray: 图形链接，较重的边框
darkgray: 正文
dark: 标题文本和图标
secondary: 链接颜色，当前 graph 节点
tertiary: 悬停状态和访问的 graph 节点
highlight: 内部链接背景，高亮显示的文本，高亮显示的代码行

## 自定义设置

我在 `custom.scss` 中还添加了一些行内代码的高亮，接着，让 `Meta` 数据（也就是创建，修改，阅读时间）的字体进行更改：

```scss showLineNumbers
:root {
    //加粗字体、代码块高亮色
    --custom-highlight: #8b2e2e;
}

:not(pre)>code {
    background-color: var(--lightgray);
    border-radius: var(--border-radius);
    padding: 0 .3rem;
    margin: 0 0.2em;
    border: 1px solid var(--gray);
    color: var(--custom-highlight);
    font-weight: 500;
}

.content-meta {
    font-family: 'Biro';
}
```

但这个字体只适用于英文的，于是，我们还需要修改这个组件的语言显示：

```tsx title="quartz/components/ContentMeta.tsx"
if (fileData.dates) {
	segments.push(
	  <span>✏️ <Date date={fileData.dates.created} locale='en-US' /></span>
	)
	segments.push(
	  <span>🔧 <Date date={fileData.dates.modified} locale='en-US' /></span>
	)
}
```

# 一些插件

这里使用了 [8Cats & Me](https://8cat.life/) 中开发的一些组件和样式，主要是：

1. `FloatButton`
2. `Code-Block`

## 浮动按键

这个按键只会在桌面端显示在右下角，主要是为了更好的阅读体验，包含的内容是：

1. 回到顶部
2. 回到底部
3. 全局图谱
4. 查看快捷键

但在这之后，还引入了 `kbd` （键盘按键）的样式，可以参考以下文件：

1. FloatingButtons.tsx
2. floatingButtons.inline.ts
3. floatingButtons.scss
4. custom.scss
5. keyboard.csss

## 自定义代码块

这里使用了 [expressive-code](https://expressive-code.com/) ，能够做到与 [Obsidian-shiki-plugin](https://github.com/mProjectsCode/obsidian-shiki-plugin) 一致的显示，具有更强的表达能力，这在上面的代码块中已经能够发现了，配置也十分简单

首先，我们需要引入包：

```cmd
pnpm add rehype-expressive-code @expressive-code/plugin-collapsible-sections @expressive-code/plugin-line-numbers
```

然后参照文件 `syntax.ts` 进行修改即可

> [!important]
>
> 需要注意的是，如果使用了 `expressive-code`，我们需要更改 `quartz.config.ts` 中的构建顺序如下：
>
> ```ts
>    Plugin.Latex({ renderEngine: "katex" }),
>    Plugin.SyntaxHighlighting(),
> ```
>
> 主要是需要保证语法高亮需要在解析数学公式的后面，否则，对于行间公式，就会被解析为 `math` 块，无法被 `Latex` 解析器正确处理

## 灯箱

原版的 `quartz` 对于图片较为匮乏，没办法放大查看，感觉其实不算很友好，但我在 [pr#1480](https://github.com/jackyzha0/quartz/pull/1480) 中发现了一个灯箱，然后修改了一下就拿来用了，主要代码可以参考 `quartz/plugins/transformers/lightbox.ts`，我们只需要在 `quartz.config.ts` 中的 `transform` 中最后引入这个插件即可

# 网站地图 (sitemap.xml)

`sitemap.xml` 的生成主要在 `quartz/plugins/emitters/contentIndex.ts` 中，但其实原版的生成有一个问题，这里的 `lastmod` 字段其实是错误的，代码只使用了 `date` 字段来生成 `lastmod`，可以更改如下：

```ts showLineNumbers warp {5-6}
function generateSiteMap(cfg: GlobalConfiguration, idx: ContentIndex): string {
  const base = cfg.baseUrl ?? ""
  const createURLEntry = (slug: SimpleSlug, content: ContentDetails): string => `<url>
    <loc>https://${joinSegments(base, encodeURI(slug))}</loc>
    ${(content.lastmod && `<lastmod>${content.lastmod.toISOString()}</lastmod>`) ||
    (content.date &&  `<lastmod>${content.date.toISOString()}</lastmod>`)}
  </url>`
  const urls = Array.from(idx)
    .map(([slug, content]) => createURLEntry(simplifySlug(slug), content))
    .join("")
  return `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9 http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd"> ${urls} </urlset>`
}
```

> [!question]- 
> 
> 目前不知道为什么，我新生成的网站地图是正确的，但是提交给 `bing` 解析之后，发现解析和索引的 URL 依然是我老博客的 URL（ :sad:
