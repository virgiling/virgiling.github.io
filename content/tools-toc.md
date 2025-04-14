---
title: 🧰 文具袋
description: 
tags:
  - MOC
date: 2024-12-29
lastmod: 2025-04-14
draft: false
cover:
---

这里记录了我的文具袋系列，会写一些遇到的各种环境问题，推荐一些工具，以及分享我使用的开发工具与工作流等

## 📝 开发环境配置

### 系统环境

```dataview
TABLE WITHOUT ID
    link(file.link, title) as "📑 文档",
    date as "📅 更新日期"
FROM "03-tools"
WHERE contains(file.name, "wsl") or contains(file.name, "Hyprland") or contains(file.name, "docker")
SORT date DESC
```

### 编程语言环境

```dataview
TABLE WITHOUT ID
    link(file.link, title) as "📑 文档",
    date as "📅 更新日期"
FROM "03-tools"
WHERE contains(file.name, "CppProject") or contains(file.name, "my-tools")
SORT date DESC
```

## 🔧 工具推荐

### 笔记与知识管理

```dataview
TABLE WITHOUT ID
    link(file.link, title) as "📑 文档",
    date as "📅 更新日期"
FROM "03-tools"
WHERE contains(file.name, "obsidian")
SORT date DESC
```

### 研究工具

```dataview
TABLE WITHOUT ID
    link(file.link, title) as "📑 文档",
    date as "📅 更新日期"
FROM "03-tools"
WHERE contains(file.name, "paper") or contains(file.name, "gporf")
SORT date DESC
```

### 博客工具

```dataview
TABLE WITHOUT ID
    link(file.link, title) as "📑 文档",
    date as "📅 更新日期"
FROM "03-tools"
WHERE contains(file.name, "blog") or contains(file.name, "compress")
SORT date DESC
```

## 💡 所有工具列表

```dataview
TABLE WITHOUT ID
    link(file.link, title) as "📑 文档",
    date as "📅 更新日期",
    join(tags, ", ") as "🏷️ 标签"
FROM "03-tools"
WHERE file.name != "index" AND file.name != "tools-toc"
SORT date DESC
```
