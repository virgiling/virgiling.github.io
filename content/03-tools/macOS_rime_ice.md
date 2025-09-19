---
title: MacOS 配置 RIME + 雾凇
description:
tags:
  - 文具袋/文具推荐
date: 2025-09-17
lastmod: 2025-09-18
draft: false
cover:
---
> [!tip] 前言
> 
> 由于 MacOS 自带的输入法没找到怎么 `shift` 切换输入法，本身切换输入法的按键被我改成 `control` 了，而且之前在 [[Hyprland-Yes|Arch Linux]] 下一直在用小企鹅+雾凇，对雾凇这个词库很有好感（，所以在这里替换一下

> [!bug] 已知 BUG
> 
> 在 MacOS 下已知的 bug 有两个：
> 1. [在Mac上按cmd+tab切换应用后，输入法会自动打出‘a’](https://github.com/rime/squirrel/issues/1015)
> 2. [github issue栏中打字会出现多余字符](https://github.com/rime/squirrel/issues/1037)

# RIME

首先我们通过 `brew` 来安装鼠须管：

```bash
brew install squirrel-app
```

下载完成后，在 “系统设置”  -> “键盘” -> “输入法” 中，将简体拼音删除，将鼠须管加入到其中，这样我们就安装好了鼠须管

在 `~/Library/Rime` 中创建文件 `squirrel.custom.yaml`，填入以下内容：

```yaml
patch:
  show_notifications_via_notification_center: true
  app_options:
    com.github.GitHubClient:
      ascii_mode: true
    com.microsoft.VSCode:
      ascii_mode: true
    com.apple.dt.Xcode:
      ascii_mode: true
    com.runningwithcrayons.Alfred:
      ascii_mode: true
    com.apple.Terminal:
      ascii_mode: true
    com.googlecode.iterm2:
      ascii_mode: true
    com.apple.finder:
      ascii_mode: true
    com.sublimetext.4:
      ascii_mode: true
    com.sublimetext.3:
      ascii_mode: true
    com.apple.calculator:
      ascii_mode: true
    com.apple.launchpad.launcher:
      ascii_mode: true
    com.apple.systempreferences:
      ascii_mode: true
    com.apple.ActivityMonitor:
      ascii_mode: true
    com.apple.keychainaccess:
      ascii_mode: true
    com.apple.Spotlight:
      ascii_mode: true
    com.jetbrains.intellij:
      ascii_mode: true
    com.jetbrains.datagrip:
      ascii_mode: true
    com.jetbrains.pycharm:
      ascii_mode: true
    io.nteract.nteract:
      ascii_mode: true
    com.sequelpro.SequelPro:
      ascii_mode: true
    io.termix.client:
      ascii_mode: true
    com.agilebits.onepassword7:
      ascii_mode: true
    com.agilebits.onepassword7-helper:
      ascii_mode: true
    com.kapeli.dashdoc:
      ascii_mode: true
    com.svend.uPic:
      ascii_mode: true
    com.eusoft.eudic:
      ascii_mode: true
      
  style:
    color_scheme: mac_dark
    color_dark_scheme: mac_dark

  preset_color_schemes:
    mac:
      author: "lamb"
      name: "lamb"
      back_color: 0xffffff #设置输入条的背景色，色值是按照BGR的形式16进制填写
      corner_radius: 5 #设置输入条的圆角效果
      border_height: 4 #设置输入条上下宽度
      dborder_width: 4 #设置输入条左右宽度
      border_color: 0x9f62e8 #输入条边框颜色，似乎在横向模式下不起作用
      border_color_width: 0 #输入条边框宽度
      candidate_format: "%c %@  " #设置每个候选词之间的间隔距离，%c代表备选的数字，%@代表候选字，可以通过输入空格的形式来调整每个候选字之间的间隔距离
      candidate_text_color: 0x333333 #候选字颜色
      font_face: PingFangSC #字体
      font_point: 16 #字体大小
      text_color: 0x333333 #普通候选字的颜色，非第一候选字
      hilited_candidate_label_color: 0xffffff #第一候选字标签颜色，也就是数字1
      hilited_text_color: 0xffffff #第一候选字颜色
      hilited_candidate_back_color: 0xD05B21 #第一候选字高亮颜色（背景色）
      hilited_corner_radius: 5 #第一候选字高亮颜色的圆角，当不设置时就是一整块的颜色，设置了圆角之后就带有圆角效果了
      horizontal: true #设置水平还是竖直模式（1.0.0之前生效）
      candidate_list_layout: linear #linear-候选词水平排列/stacked-垂直排列（1.0.0之后生效）
      text_orientation: horizontal #设置每个词的文字排列方向 horizontal-水平/vertical-垂直（1.0.0之后生效）
      inline_preedit: true #设置是否双行显示
      label_color: 0x888888 #普通标签的颜色(非第一候选字)，也就是候选字数字
      label_font_point: 12 #普通标签的字体大小
    mac_dark:
      author: "lamb"
      name: "lamb"
      back_color: 0x2d2d2d # 深灰色背景
      corner_radius: 5
      border_height: 4
      dborder_width: 4
      border_color: 0x6e6e6e # 中灰色边框
      border_color_width: 0
      candidate_format: "%c %@  "
      candidate_text_color: 0xffffff # 白色候选文字
      font_face: PingFangSC
      font_point: 16
      text_color: 0xcccccc # 浅灰色普通候选字
      hilited_candidate_label_color: 0xffffff # 白色第一候选数字
      hilited_text_color: 0xffffff # 白色第一候选字
      hilited_candidate_back_color: 0xD05B21 # macOS 蓝色高亮背景
      hilited_corner_radius: 5
      candidate_list_layout: linear
      text_orientation: horizontal
      inline_preedit: true
      label_color: 0x999999 # 灰色普通标签
      label_font_point: 12
```

用来设置外观的内容，设置完成后的效果如下：

![image.png](https://virgil-civil-1311056353.cos.ap-shanghai.myqcloud.com/img/20250917201158139.png)

创建一个 `default.custom.yaml` 的文件，填入以下内容：

```yaml
patch:
  menu:
    page_size: 8 # 候选词个数
  ascii_composer:
    good_old_caps_lock: true # true | false
    switch_key:
      Caps_Lock: clear # commit_code | commit_text | clear
      Shift_L: commit_code # commit_code | commit_text | inline_ascii | clear | noop
      Shift_R: commit_code # commit_code | commit_text | inline_ascii | clear | noop
      Control_L: noop # commit_code | commit_text | inline_ascii | clear | noop
      Control_R: noop # commit_code | commit_text | inline_ascii | clear | noop
  key_binder/bindings/+:
    - { when: composing, accept: KP_Enter, send: Return }
```

这样就可以通过 `shift` 来切换中英文
# 雾凇词库

首先我们需要下载东风破：

```bash
cd
git clone https://github.com/rime/plum.git plum
cd plum/
```

> [!tip] 
> 
> 如果需要删除，那么直接 `rm -rf ~/plum` 即可

在 `plum` 目录下，执行：

```bash
bash rime-install iDvel/rime-ice:others/recipes/all_dicts
bash rime-install iDvel/rime-ice:others/recipes/full
```

即可将雾凇词库下载到本地

> [!bug] VS Code 快捷键冲突
> 
> VS Code打开终端的快捷键为 <C-\`>，而这个键也恰好是 RIME 更改输入法配置的快捷键（按 F4 也可以），所以我们直接去掉这个即可：
> 
> 打开 `~/Library/RIME/default.yaml`，找到 `switcher/hotkeys` 中的 `control + grave` 删除即可

