---
title: 🧰 文具袋
description: 
tags:
  - MOC
date: 2024-12-29
lastmod: 2025-04-18
draft: false
cover:
---

这里记录了我的文具袋系列，会写一些遇到的各种环境问题，推荐一些工具，以及分享我使用的开发工具与工作流等

## 📝 开发环境配置

### 系统环境

```dataview
TABLE WITHOUT ID
    link(file.link, title) as "📑 文档",
    lastmod as "📅 更新日期"
FROM "03-tools"
WHERE contains(file.tags, "#文具袋/环境配置") or contains(file.tags, "#文具袋/Issues")
SORT lastmod DESC
```

## 🔧 工具推荐

### 开发/科研工具推荐

```dataview
TABLE WITHOUT ID
    link(file.link, title) as "📑 文档",
    lastmod as "📅 更新日期"
FROM "03-tools"
WHERE contains(file.tags, "#文具袋/文具推荐")
SORT lastmod DESC
```
### Obsidian 相关

```dataview
TABLE WITHOUT ID
    link(file.link, title) as "📑 文档",
    lastmod as "📅 更新日期"
FROM "03-tools"
WHERE contains(file.tags, "#文具袋/Obsidian")
SORT lastmod DESC
```

### 博客相关

```dataview
TABLE WITHOUT ID
    link(file.link, title) as "📑 文档",
    lastmod as "📅 更新日期"
FROM "03-tools"
WHERE contains(file.tags, "#文具袋/博客相关")
SORT lastmod DESC
```

## 💡 所有工具列表

```dataview
TABLE WITHOUT ID
    link(file.link, title) as "📑 文档",
    lastmod as "📅 更新日期",
    join(tags, ", ") as "🏷️ 标签"
FROM "03-tools"
WHERE file.name != "index" AND file.name != "tools-toc"
SORT lastmod DESC
```
