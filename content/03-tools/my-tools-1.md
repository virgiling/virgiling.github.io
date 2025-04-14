---
title: 差生文具店（第一集）
description: 科研&学习工具分享
tags:
  - 文具袋/文具推荐
date: 2024-10-27
lastmod: 2025-04-14
draft: false
cover:
---

# 前言

差生文具多系列，这里分享（备忘）一下我的科研+开发工作流以及工具链，主要涉及到：

1. [[search-and-read-paper|文献搜索 & 阅读]]
2. [[build-my-obsidian|搭建自己的 Obsidian]] 与 [[blog-record|使用 Quartz 搭建博客]]
3. 组会 Slides 制作
4. 科研代码
5. 日常开发与实验
6. 多端同步

这里，多端同步会掺杂在各个部分，可以选择自己需要的同步方法。

> 考虑到我已经切换回 Windows 开发，因此这里介绍的主要在 Windows 的工具链，关于纯 Linux 的分享可以参考 [[Hyprland-Yes|Hyprland美化]] 与 [[Manjaro-Linux|Manjaro配置与美化]]，虽然主要是在玩赛博暖暖（

> [!attention]
> 很多工具其实都可以关注 `github` 上使用 `awesome` 开头的仓库，例如：
>
> - [Awesome Typst 中文版](https://github.com/qjcg/awesome-typst/blob/main/README_ZH.md)
>
> - [Awesome C++](https://github.com/fffaraz/awesome-cpp)

可以在这里关注一下 `Awesome` 列表：[The awesome list](https://github.com/sindresorhus/awesome#readme)

# 组会 Slides 制作

关于 `Slides` 的制作，有三种方式：

1. 传统的 `PPT`
2. `Beamer` 风格的学术 `Slides`
3. `Reval.js` 网页 `Slides`

三种方式可以自由选择，优缺点如下：

- `PPT` 的制作稍微简单，不需要做任何动画，也不需要花里胡哨的模板（很适合赶工的时候做），但缺陷很明显，数学和代码的支持很差，有时候只能截个图放上去，很不美观（不美观的数学公式会让人难以理解……也生不出看下去的欲望）
- `Beamer` 模板写起来困难，但数学公式和代码都较为美观，并且模板问题难以解决，毕竟不是每个人都有心思去做模板的
- `Reval.js` 强依赖于其他人写好的插件拓展，而且语法会有些啰嗦，虽然可以使用 Markdown 语法的话，但想要做出动画效果也同样得使用他自己的一些语法，好在支持数学公式和代码块，并且可以把 Slides 直接挂在网上

## Typst

首先，我们回答一个问题：**为什么选择 Beamer？**

答案是：**数学公式**

众所周知的是，`PPT` 对于数学的支持一向不友好，想打出漂亮的数学公式可能比做一份完整的 `PPT` 还费时间，所以，为什么不选择数学更友好更优美的 `Latex` 呢？

但，`Latex` 的入门是一个很大的问题，花费一个月的时间在折腾自己的模板上，还没弄明白的事情也常有发生，这个时候就要开始推荐 `Typst` 了。

但是 [Typst](https://typst.app/) 的出现让学术 `Slides` 变得更简单了！关于 `Typst`，一个简单的说法就是：`Markdown` 增强版本的 `Latex`

拥有着 `Markdown` 风格的语法，可以轻松的写出文档，同时也拥有较为强大的排版能力，值得注意的是 `typst` 的数学语法比 `Latex` 看起来要舒服很多，最重要的一点是，它是增量编译（人话：即时预览）

我们并不会在这里讲述太多 `Typst` 的语法细节，也不会告诉大家如何去学一门新的（编程）语言，遇到有不会的时候，请学会 `RTFM` 和 `STFW`

## 如何制作

如果你想使用 `Typst` 来制作 Slides 的话，可以使用[Polylux](https://polylux.dev/book/polylux.html) 或更加中文化（以及更加现代的）[Touying](https://touying-typ.github.io/)

> 更加建议使用 `Touying` 社区更加活跃

随着 `Typst` 社区的发展，以及有很多包和模板可以使用了，例如：

- [pinit](https://typst.app/universe/package/pinit) 用于高亮文本块，并显示箭头
- [codly](https://typst.app/universe/package/codly) 更好看的方式显示代码块
- [cetz](https://typst.app/universe/package/cetz) 与 [fletcher](https://typst.app/universe/package/fletcher) 画图的必备利器，可以对标 `Latex` 中的 `TikZ`
- [lovelace](https://typst.app/universe/package/lovelace) 伪代码（算法流程）的制作
- [curryst](https://typst.app/universe/package/curryst) 我用来写规约/推导的数学公式的包

一个简单的例子如下，使用了 [BUAA Touying Template](https://github.com/Coekjan/touying-buaa/) 以及上面的一些包：

![image.png](https://virgil-civil-1311056353.cos.ap-shanghai.myqcloud.com/img/20241120160047.png)

# 科研代码

使用的设备均为 `Windows11` 系统：

- 本地台式：`14700KF` + `4080S` + `32G` + `2TB`
- 本地笔记本：`13th-i5` + `16G` + `512G`

一般而言都是在台式机上干重活（相当于会跑一下代码测试一下），笔记本对我来说是一个 `ssh` 工具，或者是简单写一个不吃配置的代码的工具

开发环境使用的是 `WSL2-Ubuntu-24.04 + Windows`，其中：

- `WSL2` 主要用来写科研代码，因为经常用到 `C++/C`， `Rust`， `Python` 和 `Bash` 之类的，`Linux` 对这些开发比较友好
- `Windows` 环境主要是用来开发一些需要用到字体的项目，例如 `Typst` 的模板开发，`Latex` 的书写，`Markdown` 的书写，~~Steam 的启动~~

使用的编辑器是 `VS Code` 与各类语言的 `LSP`

> 对于 `WSL` 的配置我们略过，网上的教程也很多，甚至微软官方的教程也很详细，可以参考

## VS Code

> [!important]
>
> 在有 LLM 之后，更推荐使用 [cursor](https://www.cursor.com/)，它可以兼容 `vscode` 的所有插件，且自带强大的 AI 补全

> [!note]
>
> 在刚上大学的时候其实觉得 `VS Code` 并不是很好用，主要是配置起来很麻烦，感觉不如 `CLion` 这种 `IDE`，但自从知道了 `Remote SSH` 插件之后，突然就香了

我们这里推荐的 `VS Code` 及其插件的配置如下

## 主体开发

必装插件：`Remote - SSH`, `WSL`（如果要使用本地开发），`Remote Explorer` ，`Dev Containers`(用于连接 `Docker` 容器)

### Remote-SSH 的一些 Trick

由于使用 `Remote - SSH` 其实会频繁要求认证（也就是输密码），我们可以通过两个东西来避免这一点

1. `.ssh/config`

首先，我们需要编辑这个文件，然后把常用的服务器都保存进去，写成如下形式：

```ssh-config
Host NAME
    HostName <ip>
    Port 22
    User <user>
```

这样，我们就可以在命令行/VS code 中找到名为 `NAME` 的服务器，然后 `ssh`/点击即可连接上，但这时还是会要求输入密码

2. `ssh-copy-id` 命令

如果你使用 `Windows`，是没有这个命令的，但是可以通过打开 `git bash` 来使用这个命令，具体的使用方式是，命令行中输入：

```bash
ssh-copy-id NAME
```

然后输入一次密码即可，这样，后续再进行操作都无需输入密码进行认证（服务器上输入 sudo 并不属于这种类型的认证）

### AI

AI 自动补全插件。如果你已经申请了 `Github` 的黄书包（也就是教育版本），那么你可以免费使用 `Copilot` ，这是一个 LLM 代码补全工具，补全程度甚至可以自己写代码，有了这个，程序员只需要当无情的 `Tab` 键入机器就行。

但这个有一个缺点：补全的有点太多了，有时候我们并不需要把一整个函数都补全，但是 `Copilot` 就会自己做这个事情

但如果你没有黄书包，但是你也想使用 `LLM` 补全的话，可以考虑这几个软件（都在 `VS Code` 中有插件）

#### Codeium

https://codeium.com/

这是一个免费的 AI 补全工具，效果不错，但能力当然不如 `Copilot`，并且也存在一次补全太多的缺点

但瑕不掩瑜，免费就是它最大的卖点，而且比 `TabNine` 要智能很多，也对内存更加友好（`TabNine` 会偏本地化一些，会记录你的代码习惯和风格到本地）

但对于 `VS Code` 而言，这个插件还有一个缺点：如果你在服务器上写代码，那么需要重新安装这个插件，并配置你的 API 密钥，较为麻烦（因为每到一个新机器就需要重新配置一遍）

#### Tabnine

https://www.tabnine.com/

免费，但占用内存大，比较能吃硬盘空间，而且补全似乎不够智能（在 2023 年是这样的）

#### Continue

https://www.continue.dev/

目前我正在使用的 AI 补全插件，好处是你可以自主选择 AI 模型，可以接入不同的 API，例如 GPT4，Claude，国内的大模型，甚至自己本地训练的大模型，并且支持项目内搜索与问题，最重要的是，一次补全不会补出来一篇文章，基本都是一行一行补全，只是速度不是特别快。

最好的一点是，他对于 `VS Code` 而言是基于工作区的，也就是只需要在本地有这个插件即可，不需要在每一台机器上都要下一遍

然而缺点是配置较为麻烦，在这里可以贴一下我的配置：

我是用的是 DeepSeek 的模型，因为他的 Token 收费便宜，进入官网后申请 API 密钥，然后我们开始配置 `VS Code` 中的 `Continue`:

![image.png](https://virgil-civil-1311056353.cos.ap-shanghai.myqcloud.com/img/20241120171508.png)

打开这个设置后，会出现一个 `config.json` 的文件，复制粘贴以下内容即可：

````json title="如何在 continues 中配置 deepseek"
{
  "models": [
    {
      "title": "DeepSeek",
      "provider": "openai",
      "model": "deepseek-coder",
      "apiBase": "https://api.deepseek.com",
      "apiType": "openai",
      "apiKey": "",
      "useLegacyCompletionsEndpoint": false,
      "contextLength": 8192
    }
  ],
  "tabAutocompleteOptions": {
    "template": "Please teach me what I should write in the `hole` tag, but without any further explanation and code backticks, i.e., as if you are directly outputting to a code editor. It can be codes or comments or strings. Don't provide existing & repetitive codes. If the provided prefix and suffix contain incomplete code and statement, your response should be able to be directly concatenated to the provided prefix and suffix. Also note that I may tell you what I'd like to write inside comments. \n{{{prefix}}}<hole></hole>{{{suffix}}}\n\nPlease be aware of the environment the hole is placed, e.g., inside strings or comments or code blocks, and please don't wrap your response in ```. You should always provide non-empty output.\n",
    "useCache": true,
    "maxPromptTokens": 2048
  },
  "tabAutocompleteModel": {
    "title": "DeepSeek-V2",
    "model": "deepseek-coder",
    "apiKey": "",
    "contextLength": 8192,
    "apiBase": "https://api.deepseek.com",
    "completionOptions": {
      "maxTokens": 4096,
      "temperature": 0,
      "topP": 1,
      "presencePenalty": 0,
      "frequencyPenalty": 0
    },
    "provider": "openai",
    "useLegacyCompletionsEndpoint": false
  },
  "docs": []
}
````

在留白的 `apiKey` 中填上自己申请的 `APIKey` 即可。

如果需要使用其他的模型，可以自行查阅官网文档进行配置。

### 版本管理

我的版本管理主要使用 `git`,插件选择 `Git Graph`,可以可视化 `Commit` 的历史,例如:

![image.png](https://virgil-civil-1311056353.cos.ap-shanghai.myqcloud.com/img/20241120172120.png)

> 不是很推荐使用 `Gitlens`,感觉冗余信息太多了,对写代码之类的干扰严重(

## 外观 & 显示

### 主题

`Github Theme Dark Default`，高亮如下所示：

![clipboard-image-1732091830.png](https://virgil-civil-1311056353.cos.ap-shanghai.myqcloud.com/img/clipboard-image-1732091830.png)

> 之前使用的主题是 Tokyo Night，也很好看，换这个是因为在我之前的笔记本上，感觉完全的黑色+透明度更适合那个 `Archlinux` 的桌面背景（

### 图标主题

`Material Icon Theme`，这里主要是用来更好的显示文件夹的图标，看起来花哨一些（

### 字体

中文 [霞鹜文楷](https://github.com/lxgw/LxgwWenKai)，代码 [Monaco](https://github.com/thep0y/monaco-nerd-font)，配置的方法如下：打开设置后（`Ctrl + ,`），写下如下设置（注意是在 `Windows` 环境下）

![image.png](https://virgil-civil-1311056353.cos.ap-shanghai.myqcloud.com/img/20241120164312.png)

### 其他

还有一些插件，能让写代码的时候有更好的视觉体验

1. `Better Comments`： 显示更好的注释样式，例如 `//!` 会显示成红色，颜色也可以自己修改
2. `Error Lens`：更好的显示错误与警告（不需要再把鼠标移上去，现在在行尾就能看见错误是什么了）
3. `Highlight Line`：更好的显示光标的位置
4. `Log File Highlighter`：为控制台的 `LOG` 显示高亮，主要是为了看 `ERROR` 和 `PASS` 的颜色
5. `Todo Tree`：更好的查看 TODO，FIXME，NOTE 等标签，但是需要配置颜色

## 语言插件及其环境

### C++/C

1. `clangd`：用于代码的高亮和补全，主要是解析项目结构
2. `C/C++`：微软自家的插件，写 `C/C++` 必须会安装的插件，但其补全功能与 `clangd` 冲突，需要关闭
3. `Better C++ Syntax`：更好的语法高亮
4. `clang-format`：格式化插件
5. `CodeLLDB`：调试用的插件，当然也可以直接用 `gdb`
6. `Vim`：更好的打字体验，但需要一些配置和学习

配置后的样式如下：

![clipboard-image-1732091830.png](https://virgil-civil-1311056353.cos.ap-shanghai.myqcloud.com/img/clipboard-image-1732091830.png)

当然，我的 `Vim` 也进行了一些配置，让 `VS Code` 的一些快捷键还能用（

打开 `setting.json` 后，输入以下内容：

```json title="vscode 中设置 vim 的按键映射"
    "vim.insertModeKeyBindings": [
        {
            "before": [
                "j",
                "j"
            ],
            "after": [
                "<Esc>"
            ]
        }
    ],
    "vim.handleKeys": {
        "<C-d>": true,
        "<C-s>": false,
        "<C-z>": false,
        "<C-a>": false,
        "<C-c>": false,
        "<C-x>": false,
        "<C-v>": false,
        "<C-w>": false,
        "<C-p>": false
    },
```

这里映射了 `jj` 为 `esc` 键，然后取消了 `Ctrl` 的一系列快捷键（感觉还是用 `Windows` 的顺手，尤其是复制粘贴）。

#### 构建工具与包管理

- C Compiler: gcc(version 13.2.1) clang(version 16.0.6)
- C++ Compiler: g++(version 13.2.1) clang++(version 16.0.6)
- C/C++ build tools: cmake(version 3.28.3) xmake(version 2.8.8) make(version 4.4.1)

一般我使用的工具链是 `CMake + ninja` 作为构建工具, 使用 `gcc/g++` 编译,使用 `gdb` 进行调试

> 这里,如果你的 `libc(++)` 是 `glibc(++)` 的话,我推荐使用 `gcc/g++` 进行编译,因为这俩会有优化
> 如果一定要使用 `clang/clang++`,请先把 `libc(++)` 改成对这俩编译器友好的,例如 [LLVM-libc](https://libc.llvm.org/)

##### XMake

如果你想写一个简单的小项目，但是这个项目依赖的库或者包有点多，例如你可能需要使用 `boost` 来解析参数，你可能需要 `dense_unorderedmap` 来替代 `STL` 中的 `unorderedmap`，但这个时候，`Cmake` 似乎就对你很不友好了，而如何管理这些包也成为了一个难题

这个时候，你就需要 `xmake` 来帮你完成这个需求，`xmake` 的配置文件十分简单，你也可以使用 `xmake` 来初始化一个项目，缺少的包也可以通过 `xmake` 来进行下载和导入

最重要的是，`xmake` 有[中文文档](https://xmake.io/#/zh-cn/guide/installation), 阅读这个中文文档进行安装和使用，`xmake` 对于小型项目而言十分友好，能够快速帮你构建项目，并且不需要烦恼依赖问题

### Python

- `Python`
- `Python Debugger`
  这两个算是必装插件了，没有这两个不知道怎么写 `Python`

关于 `Python` 的格式化插件，有很多选择，这里可以选择 `ruff` 这个插件

如果你更喜欢使用 `jupyter` 的话，也可以安装 `jupyter` 的插件，有一个名为 `Jupyter` 的拓展包，直接安装即可

> 但是不知道为什么，我如果使用 `jupyter` 的话运行时间长了会导致内核卡死，这个问题到目前都没有解决

#### 包管理

`Python` 的包管理器有很多,这里推荐两个现代 `Python` 常用的:

1. [poetry](https://python-poetry.org/)
2. [uv](https://docs.astral.sh/uv/)

我目前常用的管理器是 `poetry`,`uv` 虽然快,但是感觉有很多功能都没实现,比如我最想要的 `uv shell` 这种(

### Rust

安装 `rust` 这个拓展包集合,但是由于里面有一个 `crate` 的拓展以及被弃用了,这里没有更新,因此还需要下载其他的插件:

- `Dependi`:用于检测依赖包的版本,不仅适用于 `rust`,还可以检查 `nodejs`, `python`等的包版本
- `Even Better TOML`:用来高亮 `Cargo.toml` 的拓展,其他的 `.toml` 文件也可以使用(

### Typst

- Tinymist Typst

只需要这一个即可，这个插件完美到甚至不需要自己去查文档记符号，可以直接通过手写来识别，例如：

![image.png](https://virgil-civil-1311056353.cos.ap-shanghai.myqcloud.com/img/20241204155641.png)

并且，插件还支持即时预览以及导出 pdf

#### 包管理

`Typst` 没有官方的包管理器，可以使用第三方的包管理器 [utpm](https://github.com/Thumuss/utpm) ，可以参考 github 链接进行安装

> 如果你使用 `Windows`，可以考虑下载二进制文件后，增加 PATH 路径 <----- 这一点可以通过软件 `powertoys` （微软商店下载）轻松搞定

另外，如果你想写一个自己的包，utpm 也提供了脚手架来创建一个新包

### Latex

没什么好说的，Latex 直接上 `overleaf`，虽然现在不付费的话编译速度极慢，不过本地配环境，字体等等一系列问题总会有一款问题比等编译更折磨人
