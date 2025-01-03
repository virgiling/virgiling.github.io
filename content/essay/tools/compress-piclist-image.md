---
title: PicList 上传前如何压缩图像
description: 
tags:
  - 文具袋/文具推荐
  - 一些随笔/2024
date: 2024-10-27
lastmod: 2025-01-03
draft: false
cover:
---

> [!danger]
>
> 注意，以下的教程都建立在屏幕分辨率为 `4K` 的情况下，截图时会导致图像很大

# 截图工具

首先，我们切换截图工具，不再使用传统的 `alt` + `ctrl` + `a` 与 `win` + `shift` + `s`

我们在微软商店中下载 [Snipaste](https://apps.belacad.cn/app/20/snipaste?bd_vid=8096387247757416815)，如下图所示：

![image.png|350](https://virgil-civil-1311056353.cos.ap-shanghai.myqcloud.com/img/20250103200208754.png)

这个应用能够使得截图时不已分辨率为单位，而是选中的区域多大，像素长宽就是多大，此后，我们只需要按 `F1` 进行截图即可

> [!hint]
>
> 值得一提的是这个工具还有很多其他好用功能，可以自行探索

# PicList 的插件

但只有上面的截图工具还不够，我们还可以进一步压缩，我们可以使用 [压缩插件](https://github.com/supine0703/picgo-plugin-compress-next) 来进一步压缩

可以直接在 PicList 中进行安装（网络需要魔法）：

![image.png|575](https://virgil-civil-1311056353.cos.ap-shanghai.myqcloud.com/img/20250103200711649.png)

安装完成后，我们进行以下设置，需要注意的是不要设置转化为 `webp`，因为 `obsidian` 无法显示这个

![image.png|600](https://virgil-civil-1311056353.cos.ap-shanghai.myqcloud.com/img/20250103200756208.png)

注意，图床的配置名请参考 "管理" 栏目进行填写

> [!danger] 缺点
>
> 因为我的配置是本地做压缩，因此会出现一些上传速度变慢的缺点（卡在压缩这一步）
