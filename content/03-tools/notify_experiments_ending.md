---
title: 如何知道实验什么时候结束
description:
tags:
  - 文具袋/文具推荐
  - OS/Linux
date: 2025-10-20
lastmod: 2025-10-20
draft: false
location:
cover:
---

> [!attention] 免责声明
>
> 脚本几乎都是 AI 实现的，请注意甄别

# 前言

在跑实验的时候经常会遇到以下情况

按照 [[windows-with-wsl2#怎么跑实验]] 中提到的，我们会通过 `cat run.sh | xargs` 来并行实验，然而每个例子跑的时间是不确定的，有时候设置时限为 `3600 s` 我们也不会一直盯着看什么时候结束，但我们也不想时不时登上去看，只想挂着就不管事了（

所以期望实验跑完之后能够快速通知本人

> [!failure] 失败尝试
>
> 一开始想用短信验证码，甚至都付钱买了 2000 条短信的额度，但是设置的时候才发现不太对劲，流程有点复杂，还不能个人使用（例如需要公众号等），遂放弃

# 邮件通知

我们可以使用邮件来通知本人（最好选择手机上能收到信息的邮箱），如果不会配置客户端的话，可以直接考虑 QQ 邮箱

这里要求有两个邮箱，一个发件一个收件，我使用学校发的邮箱来发件，QQ 邮箱收件

> [!tip]
>
> 注意，发件邮箱需要申请客户端授权码，具体操作自行 `Google`（不同邮箱申请方式不一样），例如 [NENU 邮箱设置](https://www.innenu.com/guide/account/mail/)

首先我们安装两个包（假定系统为 `Ubuntu`）：

```bash
sudo apt install mutt msmtp
```

脚本如下所示：

```bash
EXIT_CODE=0

# 发件邮箱
FROM_EMAIL="your_email@example.com"
# 发件人名称
FROM_NAME="Virgil-s-Bot"
# 发件邮箱中申请的客户端授权码
SMTP_PASSWORD=""

TO_EMAIL="your_recv@example.com"

MACHINE=$(hostname -I | awk '{print $1}')

# SMTP服务器配置
SMTP_HOST="host.com"
SMTP_PORT="465"

# 获取实验信息
EXPERIMENT_DIR=$(basename "$(pwd)")
EXPERIMENT_NAME="${EXPERIMENT_DIR}"


if [ $EXIT_CODE -eq 0 ]; then
    STATUS="成功 ✅"
    STATUS_COLOR="#27ae60"
    STATUS_EMOJI="🎉"
else
    STATUS="失败 ❌"
    STATUS_COLOR="#e74c3c"
    STATUS_EMOJI="😞"
fi

SUBJECT="${MACHINE} 实验完成: $EXPERIMENT_NAME"

HTML_BODY=$(cat << EOF
<html>
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.4; color: #333; max-width: 500px; margin: 0 auto;">
    <div style="text-align: center; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 24px;">${STATUS_EMOJI} 实验运行完成</h1>
    </div>

    <div style="padding: 20px; background: #f8f9fa; border-radius: 0 0 8px 8px;">
        <div style="background: white; padding: 15px; border-radius: 5px; margin-bottom: 15px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h3 style="margin-top: 0; color: #2c3e50;">📋 实验信息</h3>
            <p><strong>实验名称:</strong> $EXPERIMENT_NAME</p>
            <p><strong>状态:</strong> <span style="color: $STATUS_COLOR; font-weight: bold;">$STATUS</span></p>
            <p><strong>完成时间:</strong> $(date "+%Y-%m-%d %H:%M:%S")</p>
            <p><strong>退出代码:</strong> $EXIT_CODE</p>
        </div>

        <div style="background: white; padding: 15px; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h3 style="margin-top: 0; color: #2c3e50;">🖥️ 系统状态</h3>
            <p><strong>运行目录:</strong> $(pwd)</p>
            <p><strong>主机名:</strong> $(hostname)</p>
            <p><strong>用户:</strong> $(whoami)</p>
            <p><strong>IP地址:</strong> $(hostname -I | awk '{print $1}')</p>
        </div>
    </div>
</body>
</html>
EOF
)

# 创建完整的邮件内容（使用正确的编码格式）
MAIL_CONTENT=$(cat << EOF
From: $FROM_NAME <$FROM_EMAIL>
To: $TO_EMAIL
Subject: $SUBJECT
Content-Type: text/html; charset="UTF-8"
MIME-Version: 1.0

$HTML_BODY
EOF
)

MAIL_FILE=$(mktemp)
echo "$MAIL_CONTENT" > "$MAIL_FILE"

echo "发送实验完成通知..."
if echo | mutt \
    -e "set content_type=text/html" \
    -e "set from='$FROM_EMAIL'" \
    -e "set realname='$FROM_NAME'" \
    -e "set smtp_url='smtps://$FROM_EMAIL:$SMTP_PASSWORD@$SMTP_HOST:$SMTP_PORT/'" \
    -e "set ssl_force_tls=yes" \
    -s "$SUBJECT" \
    -- "$TO_EMAIL" < "$BODY_FILE"; then
    echo "通知发送成功!"
else
    echo "通知发送失败!"
fi

rm -f "$MAIL_FILE"
```

注意，这是一段 `Snippet` ，我们需要把这段代码放在运行的脚本后面，然后修改 `EXIT_CODE` 的值，

例如 `start.sh`：

```bash
#!/bin/bash

HAS_FAILURE=0

cat run.sh | xargs -P60 -d'\n' -n1 bash -c '
  task="$@"
  eval "$task"
  if [ $? -ne 0 ];
  then
    exit 1
  fi
' _ || HAS_FAILURE=1

EXIT_CODE=$HAS_FAILURE

# 发件邮箱
FROM_EMAIL="your_email@example.com"
# 发件人名称
FROM_NAME="Virgil-s-Bot"
# 发件邮箱中申请的客户端授权码
SMTP_PASSWORD=""

TO_EMAIL="your_recv@example.com"

MACHINE=$(hostname -I | awk '{print $1}')

# SMTP服务器配置
SMTP_HOST="host.com"
SMTP_PORT="465"

# 获取实验信息
EXPERIMENT_DIR=$(basename "$(pwd)")
EXPERIMENT_NAME="${EXPERIMENT_DIR}"

if [ $EXIT_CODE -eq 0 ]; then
    STATUS="成功 ✅"
    STATUS_COLOR="#27ae60"
    STATUS_EMOJI="🎉"
else
    STATUS="失败 ❌"
    STATUS_COLOR="#e74c3c"
    STATUS_EMOJI="😞"
fi

SUBJECT="${MACHINE} 实验完成: $EXPERIMENT_NAME"

HTML_BODY=$(cat << EOF
<html>
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.4; color: #333; max-width: 500px; margin: 0 auto;">
    <div style="text-align: center; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 24px;">${STATUS_EMOJI} 实验运行完成</h1>
    </div>

    <div style="padding: 20px; background: #f8f9fa; border-radius: 0 0 8px 8px;">
        <div style="background: white; padding: 15px; border-radius: 5px; margin-bottom: 15px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h3 style="margin-top: 0; color: #2c3e50;">📋 实验信息</h3>
            <p><strong>实验名称:</strong> $EXPERIMENT_NAME</p>
            <p><strong>状态:</strong> <span style="color: $STATUS_COLOR; font-weight: bold;">$STATUS</span></p>
            <p><strong>完成时间:</strong> $(date "+%Y-%m-%d %H:%M:%S")</p>
            <p><strong>退出代码:</strong> $EXIT_CODE</p>
        </div>

        <div style="background: white; padding: 15px; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h3 style="margin-top: 0; color: #2c3e50;">🖥️ 系统状态</h3>
            <p><strong>运行目录:</strong> $(pwd)</p>
            <p><strong>主机名:</strong> $(hostname)</p>
            <p><strong>用户:</strong> $(whoami)</p>
            <p><strong>IP地址:</strong> $(hostname -I | awk '{print $1}')</p>
        </div>
    </div>
</body>
</html>
EOF
)

# 生成临时文件用于存储邮件正文
BODY_FILE=$(mktemp)
echo "$HTML_BODY" > "$BODY_FILE"

echo "发送实验完成通知..."

if echo | mutt \
    -e "set content_type=text/html" \
    -e "set from='$FROM_EMAIL'" \
    -e "set realname='$FROM_NAME'" \
    -e "set smtp_url='smtps://$FROM_EMAIL:$SMTP_PASSWORD@$SMTP_HOST:$SMTP_PORT/'" \
    -e "set ssl_force_tls=yes" \
    -s "$SUBJECT" \
    -- "$TO_EMAIL" < "$BODY_FILE"; then
    echo "通知发送成功!"
else
    echo "通知发送失败!"
fi

rm -f "$BODY_FILE"
```

测试的结果如下：

![image|400](https://virgil-civil-1311056353.cos.ap-shanghai.myqcloud.com/img/20251020190920421.png)

# 增强

邮件还可以发送附件，我们可以使用以下脚本，在 `ATTACHMENT_FILES` 中添加要发送的附件（最好是只发送一个 `.csv` 文件或者 `.xlsx` ），不过一般感觉也不一定能用上

> [!tip]
>
> 如果还有自动化脚本的话，甚至可以把 [[windows-with-wsl2#怎么统计数据|数据全部统计出来]]，然后统一发送，这里只需要在跑完后，检查文件合法性之前，运行一下统计数据的 `Python` 脚本即可

```bash
#!/bin/bash

HAS_FAILURE=0

cat run.sh | xargs -P60 -d'\n' -n1 bash -c '
  task="$@"
  eval "$task"
  if [ $? -ne 0 ];
  then
    exit 1
  fi
' _ || HAS_FAILURE=1

EXIT_CODE=$HAS_FAILURE

# 发件邮箱
FROM_EMAIL="your_email@example.com"
# 发件人名称
FROM_NAME="Virgil-s-Bot"
# 发件邮箱中申请的客户端授权码
SMTP_PASSWORD=""

TO_EMAIL="your_recv@example.com"

MACHINE=$(hostname -I | awk '{print $1}')

# SMTP服务器配置
SMTP_HOST="host.com"
SMTP_PORT="465"

# 获取实验信息
EXPERIMENT_DIR=$(basename "$(pwd)")
EXPERIMENT_NAME="${EXPERIMENT_DIR}"

# 附件配置 - 在这里指定要发送的附件文件
ATTACHMENT_FILES=(
    "/path/to/your/file1.log"    # 实验日志文件
    "/path/to/your/file2.pdf"    # 实验结果PDF
    "/path/to/your/results.csv"  # 数据文件
    # 可以继续添加更多附件
)

if [ $EXIT_CODE -eq 0 ]; then
    STATUS="成功 ✅"
    STATUS_COLOR="#27ae60"
    STATUS_EMOJI="🎉"
else
    STATUS="失败 ❌"
    STATUS_COLOR="#e74c3c"
    STATUS_EMOJI="😞"
fi

SUBJECT="${MACHINE} 实验完成: $EXPERIMENT_NAME"

HTML_BODY=$(cat << EOF
<html>
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.4; color: #333; max-width: 500px; margin: 0 auto;">
    <div style="text-align: center; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 24px;">${STATUS_EMOJI} 实验运行完成</h1>
    </div>

    <div style="padding: 20px; background: #f8f9fa; border-radius: 0 0 8px 8px;">
        <div style="background: white; padding: 15px; border-radius: 5px; margin-bottom: 15px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h3 style="margin-top: 0; color: #2c3e50;">📋 实验信息</h3>
            <p><strong>实验名称:</strong> $EXPERIMENT_NAME</p>
            <p><strong>状态:</strong> <span style="color: $STATUS_COLOR; font-weight: bold;">$STATUS</span></p>
            <p><strong>完成时间:</strong> $(date "+%Y-%m-%d %H:%M:%S")</p>
            <p><strong>退出代码:</strong> $EXIT_CODE</p>
        </div>

        <div style="background: white; padding: 15px; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h3 style="margin-top: 0; color: #2c3e50;">🖥️ 系统状态</h3>
            <p><strong>运行目录:</strong> $(pwd)</p>
            <p><strong>主机名:</strong> $(hostname)</p>
            <p><strong>用户:</strong> $(whoami)</p>
            <p><strong>IP地址:</strong> $(hostname -I | awk '{print $1}')</p>
        </div>
    </div>
</body>
</html>
EOF
)

# 生成临时文件用于存储邮件正文
BODY_FILE=$(mktemp)
echo "$HTML_BODY" > "$BODY_FILE"

# 构建附件参数
attachment_args=()
valid_attachments=()

# 检查每个附件文件是否存在
for file in "${ATTACHMENT_FILES[@]}"; do
    if [[ -n "$file" && -f "$file" ]]; then
        attachment_args+=("-a" "$file")
        valid_attachments+=("$file")
        echo "找到附件: $(basename "$file")"
    elif [[ -n "$file" ]]; then
        echo "警告: 附件文件 $file 不存在，已跳过"
    fi
done

echo "发送实验完成通知..."

if [[ ${#valid_attachments[@]} -gt 0 ]]; then
    echo "正在发送 ${#valid_attachments[@]} 个附件..."
fi

if echo | mutt \
    -e "set content_type=text/html" \
    -e "set from='$FROM_EMAIL'" \
    -e "set realname='$FROM_NAME'" \
    -e "set smtp_url='smtps://$FROM_EMAIL:$SMTP_PASSWORD@$SMTP_HOST:$SMTP_PORT/'" \
    -e "set ssl_force_tls=yes" \
    -s "$SUBJECT" \
    "${attachment_args[@]}" \
    -- "$TO_EMAIL" < "$BODY_FILE"; then
    echo "通知发送成功!"
    if [[ ${#valid_attachments[@]} -gt 0 ]]; then
        echo "已发送附件:"
        for attachment in "${valid_attachments[@]}"; do
            echo "   - $(basename "$attachment")"
        done
    fi
else
    echo "通知发送失败!"
fi

# 清理临时文件
rm -f "$BODY_FILE"
```
