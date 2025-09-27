---
title: 如何在 Windows 上使用 Linux
description: 
tags:
  - 文具袋/环境配置
  - 文具袋/文具推荐
date: 2025-04-15
lastmod: 2025-09-27
draft: false
cover:
location: 43.8259282,125.4254779
---

> [!tip]
>
> 考虑到代码基本都在服务器上跑，为了兼容性，在本地开发的时候最好也使用 `Linux` 或 `MacOS`环境进行开发

# 一些文档帮助

关于 `WSL` 的下载，安装和使用，在微软的 [官方文档](https://learn.microsoft.com/zh-cn/windows/wsl/install-manual) 中有详细的介绍。

考虑到目前的笔记本应该都不需要手动开启 `Hypr-V` 以及应该大多数 `Windows` 版本都是支持 `WSL2` 的，如果不支持的话请阅读上述文档，否则可以直接阅读这份[安装文档](https://learn.microsoft.com/zh-cn/windows/wsl/)。

我们在这里给出[阅读文档的顺序](https://learn.microsoft.com/zh-cn/windows/wsl/install)

> [!attention]
>
> 在[这篇文档](https://learn.microsoft.com/zh-cn/windows/wsl/install#upgrade-version-from-wsl-1-to-wsl-2)中，请格外注意 `WSL` 的版本问题，我们需要安装的版本为 `WSL2`

## 小结

1. 以管理员权限打开 `Power Shell`，输入:

```ps
wsl --install
```

2. 输入以下命令查看 `wsl` 版本

```ps
wsl -l -v
```

3. 如果版本为 `1` ，那么运行如下指令

```ps
wsl --set-version 2
```

# 选择发行版

可以在命令行选择发行版安装，但我更推荐图形化（因为简单）

我们选择和服务器一样的发行版（i.e. Ubuntu)，但版本可以自己选择，可以直接选择最新版本

在 2024/4/4 日时， Ubuntu 的最新版本为 Ubuntu 22.04.3

请打开电脑上自带的 `Microsoft Store`

注意，`Microsoft Store` 打开的时候不能开 `VPN`，否则会一直加载打不开

搜索 `ubuntu`，然后选择 `Ubuntu 22.04.3`，如下图所示：

![image.png|700](https://virgil-civil-1311056353.cos.ap-shanghai.myqcloud.com/img/20250415170140675.png)

选择安装即可

# 如何启动/进入 WSL 的终端

方法有很多，但这篇文章中我们提供两种

## 系统自带

按下 `win + S`，打开搜索，输入 `ubuntu` 后，选择 `ubuntu 22.04`，如下所示：

![IMG_0608.JPG](https://virgil-civil-1311056353.cos.ap-shanghai.myqcloud.com/img/IMG_0608.JPG)

打开此应用即可

> [!info]
>
> 第一次打开的时候会要求建立用户及其密码（不允许使用 `root`），这与 `WSL1` 有显著的区别

## Windows Terminal

在微软商店下载 “终端” 这一应用：

![image.png|525](https://virgil-civil-1311056353.cos.ap-shanghai.myqcloud.com/img/20250415170235694.png)

打开后，其初始默认启动的为 `CMD`，你可以自己设置：

![image.png|550](https://virgil-civil-1311056353.cos.ap-shanghai.myqcloud.com/img/20250415170238854.png)

选用 `Windows Terminal` 的主要原因是可以玩赛博暖暖（i.e. 换装美化）

# 文件访问

`WSL2` 的内核已经变成了真实的 `Linux` 内核，所以他的文件系统似乎与 `Windows` 并不兼容，导致 `IO` 性能很差

但是，对于复制粘贴一些小文件的活还是没问题的，我们甚至图形化的来访问 `WSL` 的文件

打开文件管理器（`win + E`），可以在左侧的侧边栏最下方找到 `Linux`

选择之前所说的发行版：`ubuntu 22.04`，在 `/home/$USER` 中就可以找到自己的文件了（ `$USER` 是自己设置的用户名）

![image.png|675](https://virgil-civil-1311056353.cos.ap-shanghai.myqcloud.com/img/20250415170307048.png)

# 代理

> [!important]
>
> 在 2025 年之后，微软直接推出了图形版设置 WSL 的方式，不需要再去自己写配置文件了，打开以下应用程序即可：
>
> ![image.png|300](https://virgil-civil-1311056353.cos.ap-shanghai.myqcloud.com/img/20250415170434334.png)
> 然后设置下面这些选项即可，都在 `Network` 的选项下会找到这些设置的名称

在使用 `WSL` 时也会遇到连不上 github 或软件源的情况，我们假设在 `Windows` 下已经有了代理，那么我们可以在 `C:\Users\<YOUR-USER-NAME>` 文件夹下新建一个文件`.wslconfig`，然后填入如下内容：

```bash
[experimental]
networkingMode=mirrored
autoProxy=true
```

这能够直接复制 windows 的网络状态，不需要再去设置环境变量
