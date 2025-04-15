---
title: 代码编辑器推荐
description: 
tags:
  - 文具袋/文具推荐
date: 2025-04-15
lastmod: 2025-04-15
draft: false
cover:
---

# 本地环境

使用的设备均为 `Windows11` 系统：

- 本地台式：`14700KF` + `4080S` + `32G` + `2TB`
- 本地笔记本：`13th-i5` + `16G` + `1TB`

一般而言都是在台式机上干重活（相当于会跑一下代码测试一下），笔记本对我来说是一个 `ssh` 工具，或者是简单写一个不吃配置的代码的工具

开发环境使用的是 `WSL2-Ubuntu-24.04 + Windows`，其中：

- `WSL2` 主要用来写科研代码，因为经常用到 `C++/C`， `Rust`， `Python` 和 `Bash` 之类的，`Linux` 对这些开发比较友好
- `Windows` 环境主要是用来开发一些需要用到字体的项目，例如 `Typst` 的模板开发，`Latex` 的书写，`Markdown` 的书写，~~Steam 的启动~~

使用的编辑器是 `VS Code` 与各类语言的 `LSP`

> [!hint]
>
> 对于 `WSL` 的配置我们可以参考 [[how-to-use-wsl2|如何在 Windows 上使用 Linux]]，网上的教程也很多

> [!important] 更好的替代品
>
> 在有 LLM 之后，更推荐使用 [cursor](https://www.cursor.com/)，它可以兼容 `vscode` 的所有插件，且自带强大的 AI 补全，我已经被成功的割韭菜了（
>
> 但是好像最新的 VSCode 会让 cursor 用不了很多插件，不知道后面 cursor 会不会有自己的插件生态

> [!note]
>
> 在刚上大学的时候其实觉得 `VS Code` 并不是很好用，主要是配置起来很麻烦，感觉不如 `CLion` 这种 `IDE`，但自从知道了 `Remote SSH` 插件之后，突然就香了
>
> 如果你必须要使用 VSC 的话，可以参考 [[VSCode-enhanced-with-AI|在 VSCode 中使用 AI]] 中的插件，使用 AI 来帮助你提升写代码的体验。
>
> 而如果你想打扮的话，欢迎收看 [[VSCode-enhanced-theme|VSCode 的赛博暖暖]]

# Remote SSH

我们这里推荐一些插件如下

> [!important] 必装插件
>
> `Remote-SSH`, `WSL`（如果要使用本地开发），`Remote Explorer` ，`Dev Containers`(用于连接 `Docker` 容器)

## 远程 ssh 的一些 Trick

由于使用 `Remote-SSH`（命令行 `ssh` 也是同理） 其实会频繁要求认证（也就是输密码），我们可以通过两个东西来避免这一点

1. `~/.ssh/config`

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

其中 `NAME` 就是第一步中保存的名称，然后输入一次密码即可

这样，后续再进行操作都无需输入密码进行认证（**服务器上输入 sudo 并不属于这种类型的认证**）

# 版本管理

我的版本管理主要使用 `git`,插件选择 `Git Graph`,可以可视化 `Commit` 的历史,例如:

![image.png](https://virgil-civil-1311056353.cos.ap-shanghai.myqcloud.com/img/20241120172120.png)

> [!note]
>
> 不是很推荐使用 `Gitlens`，感觉冗余信息太多了，对写代码之类的干扰严重(

# 语言插件及其环境

## C++/C

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

### 构建工具与包管理

- C Compiler: gcc(version 13.2.1) clang(version 16.0.6)
- C++ Compiler: g++(version 13.2.1) clang++(version 16.0.6)
- C/C++ build tools: cmake(version 3.28.3) xmake(version 2.8.8) make(version 4.4.1)

一般我使用的工具链是 `CMake + ninja` 作为构建工具，使用 `gcc/g++` 编译，使用 `gdb` 进行调试，你可以参考 [[CppProjectStarter|C++ 项目初始化指北]] 来查看一个项目初始化的模板

> [!note]
>
> 这里，如果你的 `libc(++)` 是 `glibc(++)` 的话,我推荐使用 `gcc/g++` 进行编译,因为这俩会有优化
>
> 如果一定要使用 `clang/clang++`,请先把 `libc(++)` 改成对这俩编译器友好的,例如 [LLVM-libc](https://libc.llvm.org/)

#### XMake

如果你想写一个简单的小项目，但是这个项目依赖的库或者包有点多，例如你可能需要使用 `boost` 来解析参数，你可能需要 `dense_unorderedmap` 来替代 `STL` 中的 `unorderedmap`，但这个时候，`Cmake` 似乎就对你很不友好了，而如何管理这些包也成为了一个难题

这个时候，你就需要 `xmake` 来帮你完成这个需求，`xmake` 的配置文件十分简单，你也可以使用 `xmake` 来初始化一个项目，缺少的包也可以通过 `xmake` 来进行下载和导入

最重要的是，`xmake` 有[中文文档](https://xmake.io/#/zh-cn/guide/installation), 阅读这个中文文档进行安装和使用，`xmake` 对于小型项目而言十分友好，能够快速帮你构建项目，并且不需要烦恼依赖问题

## Python

- `Python`
- `Python Debugger`
  这两个算是必装插件了，没有这两个不知道怎么写 `Python`

关于 `Python` 的格式化插件，有很多选择，这里可以选择 `ruff` 这个插件

如果你更喜欢使用 `jupyter` 的话，也可以安装 `jupyter` 的插件，有一个名为 `Jupyter` 的拓展包，直接安装即可

> [!bug]
>
> 但是不知道为什么，我如果使用 `jupyter` 的话运行时间长了会导致内核卡死，这个问题到目前都没有解决

### 包管理

`Python` 的包管理器有很多,这里推荐两个现代 `Python` 常用的:

1. [poetry](https://python-poetry.org/)
2. [uv](https://docs.astral.sh/uv/)

我目前常用的管理器是 `poetry`，`uv` 虽然快，但是感觉有很多功能都没实现，比如我最想要的 `uv shell` 这种(

## Rust

安装 `rust` 这个拓展包集合,但是由于里面有一个 `crate` 的拓展以及被弃用了,这里没有更新,因此还需要下载其他的插件:

- `Dependi`:用于检测依赖包的版本,不仅适用于 `rust`，还可以检查 `nodejs`， `python`等的包版本
- `Even Better TOML`:用来高亮 `Cargo.toml` 的拓展，其他的 `.toml` 文件也可以使用(

## Typst

- Tinymist Typst

只需要这一个即可，这个插件完美到甚至不需要自己去查文档记符号，可以直接通过手写来识别，例如：

![image.png](https://virgil-civil-1311056353.cos.ap-shanghai.myqcloud.com/img/20241204155641.png)

并且，插件还支持即时预览以及导出 pdf

### 包管理

`Typst` 没有官方的包管理器，可以使用第三方的包管理器 [utpm](https://github.com/Thumuss/utpm) ，可以参考 github 链接进行安装

> 如果你使用 `Windows`，可以考虑下载二进制文件后，增加 PATH 路径 <----- 这一点可以通过软件 `powertoys` （微软商店下载）轻松搞定

另外，如果你想写一个自己的包，utpm 也提供了脚手架来创建一个新包

## Latex

没什么好说的，Latex 直接上 `overleaf`，虽然现在不付费的话编译速度极慢，不过本地配环境，字体等等一系列问题总会有一款问题比等编译更折磨人
