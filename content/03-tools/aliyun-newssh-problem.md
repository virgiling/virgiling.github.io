---
title: 阿里云新建用户无法 SSH
description: 
tags:
  - 文具袋/Issues
date: 2025-04-21
lastmod: 2025-04-21
draft: false
cover:
---

# 起因

购买了一个阿里云的服务器，选择的是通过 Ubuntu-24.04 镜像生成的

买完之后没给我密码，只有这样一个界面

![image.png|350](https://virgil-civil-1311056353.cos.ap-shanghai.myqcloud.com/img/20250421192015925.png)

没有账号和密码，只能通过这里的远程连接，用浏览器暂时配置一下

打开后，我们进入 `admin` 这个账户，其 `sudo` 不需要输入密码，可以直接 `sudo su` 切换到 `root`

第一步，我们先创建账号：

```bash
sudo su
adduser virgil
adduser virgil sudo
```

其中，第二步我们还需要输入密码和一些配置，配置可以一直回车，让其保持缺省

然后，我们把自己加入到 `sudo` 组中

此时，如果我们在本地用 ssh 访问，会得到如下结果：

![image.png](https://virgil-civil-1311056353.cos.ap-shanghai.myqcloud.com/img/20250421192422427.png)

这里我们使用了 [[VSCode-and-Cursor-Usage#远程 ssh 的一些 Trick|远程 ssh 的一些 Trick]] 来重命名我们的服务器

# 解决

打开配置文件：

```bash
vim /etc/ssh/sshd_config
```

我们可以发现

![image.png|239](https://virgil-civil-1311056353.cos.ap-shanghai.myqcloud.com/img/20250421192832490.png)

这里，我们将 `PasswordAuthentication` 改为 `yes` ，然后重启 `sshd` 即可：

```bash
systemctl restart sshd
```

然后我们就可以连接上了

> [!attention] ssh-copy-id
>
> 可以发现，即使我们能够通过 `ssh` 连接，但是 `ssh-copy-id` 依然还会报错，这里我们需要将这里去除注释：
>
> ![image.png](https://virgil-civil-1311056353.cos.ap-shanghai.myqcloud.com/img/20250421193504175.png)
>
> 然后重启 `sshd`，即可免密登录
