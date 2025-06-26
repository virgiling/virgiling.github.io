---
title: strcpy 中的 overlap 问题
description: 
tags:
  - 文具袋/Issues
date: 2025-04-16
lastmod: 2025-04-16
draft: false
cover:
location: 43.8259282,125.4254779
---

# 起因

我们有以下代码：

```c showLineNumbers {"Overlapping": 7-8}
void remove_leading_zeros(char *str) {
  int i = 0;
  while (str[i] == '0' && str[i + 1] != '\0') {
    i++;
  }
  if (i > 0) {

    strcpy(str, str + i);
  }
}
```

在运行这个函数时，假设我们的代码如下：

```c showLineNumbers
char* s = "0077160493132716049313271604931327160493";
remove_leading_zeros(s);
printf("%s\n", s);
```

我们将会得到 77160493==132716049==3==132716049==3==13==27160493，这里高亮的地方是错误的地方

> [!bug] 注意
>
> 这个 `BUG` 在 `glibc` 版本为 `2.35` 时会消失，但是在 `2.39` 时会触发，你可以通过 `Ubuntu-24` 来重现它

# 原因与解决

这个问题在以下文章/论坛中都有提到

1. [strcpy-on-overlapped-strings](https://demin.ws/blog/english/2011/07/14/strcpy-on-overlapped-strings/)
2. [strcpy substring](https://www.thecodingforums.com/threads/strcpy-s-s-n-versus-memmove-redux.868397/)
3. [strcpy overlapping memory](https://www.thecodingforums.com/threads/strcpy-overlapping-memory.739427/)

造成这个错误的原因就是 UB，本质上在 `manual` 中，我们可以看见这样一句话：

![image.png|675](https://virgil-civil-1311056353.cos.ap-shanghai.myqcloud.com/img/20250416170753508.png)

原因可能如下：

- `strcpy`  通常从前向后复制字符，直到遇到空字符。当  `dest > src`  且存在重叠时，已复制的数据会破坏  `src`  未复制部分，导致后续复制操作读取错误数据，这一般会出现在 `strcpy(s + 1, s)` 这样的调用中。
- C 标准明确不要求  `strcpy`  处理重叠内存，因此不同库的实现可能不一致，但均不保证正确性，这在不同平台之间尤为明显。

解决方法为使用 `memmove` ，其专为处理重叠内存设计，会检测方向并选择从后向前或从前向后复制。对于字符串操作，可结合  `strlen`  确定长度后使用  `memmove`：

```c showLineNumbers
char* s = "hello";
memmove(s + 1, s, strlen(s) + 1);
```
