---
title: OrbStack 占用过多磁盘空间
description: 
tags:
  - 文具袋/文具推荐
  - 文具袋/Issues
date: 2025-04-07
lastmod: 2025-06-01
draft: false
cover:
---
> [!attention]  免责声明
> 
> 本文的内容非原创，只是转载与记录，防止自己老是忘记命令还得去查
# 前期提要

这篇文章主要记录使用 `OrbStack` 后，[[deploy-website-with-docker|日常构建容器测试 web 项目]] 时导致的磁盘空间消耗过多的解决方法

> [!hint] 
> 
> 说是解决方法，其实只是一次搬运而已

这个问题在 [Github](https://github.com/orbstack/orbstack/issues/1331) 上有人提到，并且在评论的最下方给了一个暂时的[解决方法](https://micro.webology.dev/2024/04/08/docker-and-orbstack.html)

# 解决方法

容器、镜像与卷的清理，都可以通过 `OrbStack` 的图形化界面来进行删除，但构建时的缓存只能通过命令来删除：

```shell
docker builder prune
```

即可进行删除

> [!tip] 构建
> 
> 这里的构建是指运行 `docker build` 或者 `docker-compose build` 时导致的缓存，由于很多时候可能改动一行就会导致不同的缓存，因此会有很多重复的缓存浪费磁盘空间

最后，我们可以写一个脚本来清理这些：

```bash
docker system prune && docker image prune -a && docker builder prune && docker volume prune
```

基本上把能清理的全清理了，如果对镜像和卷有留恋的话，建议选择 GUI 来进行清理