---
title: 在 VSCode 中使用 AI
description: 
tags:
  - 文具袋/文具推荐
date: 2025-04-15
lastmod: 2025-04-15
draft: false
cover:
---

在这里推荐一些 AI 插件，用于增强 VSCode 的代码体验

> [!attention] Out-of-Date
>
> 由于本人已经很久没有用 VSC 了，插件的认知停留在 2025-01 左右的时间

# Github Copilot

如果你已经申请了 `Github` 的黄书包（也就是教育版本），那么你可以免费使用 `Copilot` ，这是一个 LLM 代码补全工具，补全程度甚至可以自己写代码，有了这个，程序员只需要当无情的 `Tab` 键入机器就行。

但这个有一个缺点：补全的有点太多了，有时候我们并不需要把一整个函数都补全，但是 `Copilot` 就会自己做这个事情

但如果你没有黄书包，但是你也想使用 `LLM` 补全的话，可以考虑这几个软件（都在 `VS Code` 中有插件）

# Codeium

https://codeium.com/

这是一个免费的 AI 补全工具，效果不错，但能力当然不如 `Copilot`，并且也存在一次补全太多的缺点

但瑕不掩瑜，免费就是它最大的卖点，而且比 `TabNine` 要智能很多，也对内存更加友好（`TabNine` 会偏本地化一些，会记录你的代码习惯和风格到本地）

但对于 `VS Code` 而言，这个插件还有一个缺点：如果你在服务器上写代码，那么需要重新安装这个插件，并配置你的 API 密钥，较为麻烦（因为每到一个新机器就需要重新配置一遍）

# Tabnine

https://www.tabnine.com/

免费，但占用内存大，比较能吃硬盘空间，而且补全似乎不够智能（在 2023 年是这样的）

# Continue

https://www.continue.dev/

目前我正在使用的 AI 补全插件，好处是你可以自主选择 AI 模型，可以接入不同的 API，例如 GPT4，Claude，国内的大模型，甚至自己本地训练的大模型，并且支持项目内搜索与问题，最重要的是，一次补全不会补出来一篇文章，基本都是一行一行补全，只是速度不是特别快。

最好的一点是，他对于 `VS Code` 而言是基于工作区的，也就是只需要在本地有这个插件即可，不需要在每一台机器上都要下一遍

然而缺点是配置较为麻烦，在这里可以贴一下我的配置：

我是用的是 DeepSeek 的模型，因为他的 Token 收费便宜，进入官网后申请 API 密钥，然后我们开始配置 `VS Code` 中的 `Continue`:

![image.png|250](https://virgil-civil-1311056353.cos.ap-shanghai.myqcloud.com/img/20241120171508.png)

打开这个设置后，会出现一个 `config.json` 的文件，复制粘贴以下内容即可：

````json title="如何在 continues 中配置 deepseek"
{
  "models": [
    {
      "title": "DeepSeek",
      "provider": "openai",
      "model": "deepseek-coder",
      "apiBase": "https://api.deepseek.com",
      "apiType": "openai",
      "apiKey": "",
      "useLegacyCompletionsEndpoint": false,
      "contextLength": 8192
    }
  ],
  "tabAutocompleteOptions": {
    "template": "Please teach me what I should write in the `hole` tag, but without any further explanation and code backticks, i.e., as if you are directly outputting to a code editor. It can be codes or comments or strings. Don't provide existing & repetitive codes. If the provided prefix and suffix contain incomplete code and statement, your response should be able to be directly concatenated to the provided prefix and suffix. Also note that I may tell you what I'd like to write inside comments. \n{{{prefix}}}<hole></hole>{{{suffix}}}\n\nPlease be aware of the environment the hole is placed, e.g., inside strings or comments or code blocks, and please don't wrap your response in ```. You should always provide non-empty output.\n",
    "useCache": true,
    "maxPromptTokens": 2048
  },
  "tabAutocompleteModel": {
    "title": "DeepSeek-V2",
    "model": "deepseek-coder",
    "apiKey": "",
    "contextLength": 8192,
    "apiBase": "https://api.deepseek.com",
    "completionOptions": {
      "maxTokens": 4096,
      "temperature": 0,
      "topP": 1,
      "presencePenalty": 0,
      "frequencyPenalty": 0
    },
    "provider": "openai",
    "useLegacyCompletionsEndpoint": false
  },
  "docs": []
}
````

在留白的 `apiKey` 中填上自己申请的 `APIKey` 即可。

如果需要使用其他的模型，可以自行查阅官网文档进行配置。

# Cline

但这个插件我只是听说过，效果似乎比 [[#Continue]] 要好，听评价是低配版的 Cursor