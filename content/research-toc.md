---
title: 📚研究笔记
description: 研究论文阅读与笔记整理
tags:
  - MOC
date: 2024-03-26
lastmod: 2025-04-14
draft: false
cover: 
---
# 📑 论文阅读

```dataview
TABLE WITHOUT ID
    link(file.link, title) as "📄 论文",
    choice(link, "[查看论文](" + link + ")", "暂无链接") as "🔗 链接",
    choice(draft, "✏️ 草稿", "✅ 完成") as "状态",
    date as "📅 阅读日期"
FROM "02-research/12-papers"
WHERE contains(tags, "SAT") or contains(tags, "PB") or contains(tags, "PBO") or contains(tags, "SMT")
SORT date DESC
LIMIT 5
```

# 📝 正在阅读

```dataview
TABLE WITHOUT ID
    link(file.link, title) as "📝 标题",
    date as "📅 更新日期"
FROM "02-research/12-papers"
WHERE (contains(tags, "SAT") or contains(tags, "PB") or contains(tags, "PBO") or contains(tags, "SMT"))
AND contains(tags, "Status/Following")
SORT date DESC
```
