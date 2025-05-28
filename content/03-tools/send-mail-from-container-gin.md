---
title: 间接解决 Docker 中发送邮件后无法收到
description: 
tags:
  - 文具袋/Issues
  - 文具袋/环境配置
date: 2025-05-29
lastmod: 2025-05-29
draft: false
cover:
---
# 问题记录

> [!attention] 前置知识
> 
> 注意，这里我们使用的是 [Gin](https://github.com/gin-gonic/gin) 这个 web 框架开发的后端，我们使用了 `gomail.v2` 来发送文件，`template` 来渲染我们的 `html` 文件（也就是要发送的邮件内容），函数如下所示

```go title=发送邮件 showLineNumbers
// In package model
type MailInfo struct {
	Subject string
	Code    string
	ToWho   string
}

func sendEmailVerificationCode(data *model.MailInfo) (string, error) {
	code := utils.GetRandomString(6)
	var body bytes.Buffer

	t, err := template.ParseGlob("templates/*.html")

	if err != nil {
		return "", err
	}
	data.Code = code

	t.ExecuteTemplate(&body, "email-verified.html", &data)
	htmlString := body.String()
	prem, _ := premailer.NewPremailerFromString(htmlString, nil)
	htmlInline, _ := prem.Transform()
	m := gomail.NewMessage()

	m.SetHeader("From", global.Conf.MailFrom)
	m.SetHeader("To", data.ToWho)
	m.SetHeader("Subject", data.Subject)
	m.SetBody("text/html", htmlInline)
	m.AddAlternative("text/plain", html2text.HTML2Text(body.String()))

	d := gomail.NewDialer(global.Conf.MailSMTPHost, global.Conf.MailSMTPPort, global.Conf.MailSMTPUser, global.Conf.MailSMTPPwd)

	go d.DialAndSend(m)

	return code, err
}
```

起因是我通过 `Docker` 部署后端服务后，测试发现邮件其实完全没发出去，然而返回结果却是发送正常（这里容器的日志都是正常的）

# 解决过程

在网上一通搜索，甚至问了很久 `Gemini Pro`，按照他给的方法来做了一系列测试，发现都是正常合理的，包括：

1. 首先确认配置文件是否有错 (结果：✔，甚至在宿主机上还是正常的）
2. 测试容器是否能够 `ping` 通/`telnet` 上/`nc` 到邮件的 `smtp` 服务器（结果：✔，所有都能正常连上）
3. `tcpdump` 检测发送邮件的端口是否有流量（结果：❌，没有任何流量输出）
4. 容器更改为 `--network=host` 进行测试 （结果：❌，没有发送成功也没有流量输出）

经过一通测试，发现所有都很正常，但是就是无法发送邮件

这时我们换了一个思路，我们进入容器，看看是否能通过命令行发送邮件，经过一番搜索，我们可以使用 `python` 的 `smtplib` 库实现命令行发送邮件，假定容器的发行版是 `Ubuntu-24.04`，我们运行：

```bash
apt update && apt install msmtp mutt
python -c "import smtplib; \
smtp=smtplib.SMTP_SSL('smtp.example.com',465); \
smtp.login('from@ex.com','password'); \
smtp.sendmail('from@ex.com','to@ex.com','Subject: test\n\nbody'); \
smtp.quit()"
```

这里保护一下隐私就不写用户密码什么的了

我们发现这样居然可以正常收到邮件，说明容器没有任何问题，有问题的应该是我的代码（虽然在本机上可以正常使用）

于是我弃用了 `gomail` 这个包，写了一个 `Python` 脚本来代替（在 `gomail` 的 [issue](https://github.com/go-gomail/gomail/issues/57) 上其实有人遇到过这个问题，但当时被认为是网络问题）

这个脚本如下所示：

```py title=发送邮件(error版本)
import smtplib
import argparse
from email.mime.text import MIMEText
from email.utils import formataddr

def send_email(to_email, subject, body, smtp_server, port, username, password, from_email=None):
    """
    通过SMTP发送邮件
    
    参数:
    to_email: 收件人邮箱
    subject: 邮件主题
    body: 邮件正文
    smtp_server: SMTP服务器地址
    port: SMTP端口 (465/587)
    username: SMTP用户名
    password: SMTP密码/授权码
    from_email: 发件人邮箱
    """

    from_email = from_email or username
    
    msg = MIMEText(body, 'plain', 'utf-8')
    msg['Subject'] = subject
    msg['From'] = from_email
    msg['To'] = to_email
    
    try:
        # 根据端口选择加密方式
        if port == 465:
            # SSL加密连接
            with smtplib.SMTP_SSL(smtp_server, port) as server:
                server.login(username, password)
                server.sendmail(from_email, to_email, msg.as_string())
        elif port == 587:
            # STARTTLS加密连接
            with smtplib.SMTP(smtp_server, port) as server:
                server.starttls()
                server.login(username, password)
                server.sendmail(from_email, to_email, msg.as_string())
        else:
            with smtplib.SMTP(smtp_server, port) as server:
                if port == 25:
                    server.ehlo()
                server.login(username, password)
                server.sendmail(from_email, to_email, msg.as_string())
        return True
    except Exception as e:
        return False

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='通过SMTP发送邮件')
    parser.add_argument('--to', required=True, help='收件人邮箱')
    parser.add_argument('--subject', required=True, help='邮件主题')
    parser.add_argument('--body', required=True, help='邮件正文')
    parser.add_argument('--server', required=True, help='SMTP服务器地址')
    parser.add_argument('--port', type=int, required=True, help='SMTP端口 (465/587)')
    parser.add_argument('--user', required=True, help='SMTP用户名')
    parser.add_argument('--password', required=True, help='SMTP密码/授权码')
    parser.add_argument('--from_email', help='发件人邮箱 (可选)')
    
    args = parser.parse_args()
    
    send_email(
        to_email=args.to,
        subject=args.subject,
        body=args.body,
        smtp_server=args.server,
        port=args.port,
        username=args.user,
        password=args.password,
        from_email=args.from_email
    )
```

这时，我在命令行调用这个脚本，发现是可以运行的，然而当我把这个脚本放到后端中去，更改 `go` 的代码为：

```go title=发送验证码(error)
func sendEmailVerificationCode(data *model.MailInfo) (string, error) {
	pythonScript := "./utils/sendMail.py"
	code := utils.GetRandomString(6)
	var body bytes.Buffer

	t, err := template.ParseGlob("templates/*.html")

	if err != nil {
		return "", err
	}
	data.Code = code

	t.ExecuteTemplate(&body, "email-verified.html", &data)
	htmlString := body.String()
	prem, _ := premailer.NewPremailerFromString(htmlString, nil)
	htmlInline, _ := prem.Transform()
	os.Setenv("PYTHONUNBUFFERED", "1")

	cmd := exec.Command("python3", pythonScript,
		"--to", data.ToWho,
		"--subject", data.Subject,
		"--body", htmlInline,
		"--server", global.Conf.MailSMTPHost,
		"--port", fmt.Sprintf("%d", global.Conf.MailSMTPPort),
		"--user", global.Conf.MailSMTPUser,
		"--password", global.Conf.MailSMTPPwd,
	)

	output, err := cmd.CombinedOutput()
	if err != nil {
		return "", err
	}

	return code, nil
}
```

随后，我们再次部署 `Docker` 进行测试，发现邮件依然无法发送，那么只能说明是在渲染 `html` 的时候出错了（但谁也不知道为什么出错，我也没有去研究）

# 解决方案

于是我用了直接绕过这个问题的方法：**直接用 `Python` 来负责渲染 + 发送**：

```py
import smtplib
import argparse
import sys
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formataddr
from jinja2 import Environment, FileSystemLoader
from premailer import transform

def render_template(template_name, data):
    """
    渲染HTML模板
    
    参数:
    template_name: 模板文件名
    data: 模板数据
    
    返回:
    渲染后的HTML字符串
    """
    try:
        
        template_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'templates')
        
        template_path = os.path.join(template_dir, template_name)
        if not os.path.exists(template_path):
            return None
            
        
        env = Environment(
            loader=FileSystemLoader(template_dir),
            autoescape=True
        )
        
        template = env.get_template(template_name)
        return template.render(**data)
        
    except Exception as e:
        return None

def send_email(to_email, subject, template_name, data, smtp_server, port, username, password, from_email=None):
    """
    通过SMTP发送邮件
    
    参数:
    to_email: 收件人邮箱
    subject: 邮件主题
    template_name: 模板文件名
    data: 模板数据
    smtp_server: SMTP服务器地址
    port: SMTP端口 (465/587)
    username: SMTP用户名
    password: SMTP密码/授权码
    from_email: 发件人邮箱
    """
    try:
        html_content = render_template(template_name, data)
        if not html_content:
            return False
            
        html_inline = transform(html_content)
        
        from_email = from_email or username
        
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = from_email
        msg['To'] = to_email
        
        msg.attach(MIMEText(html_inline, 'html', 'utf-8'))
        
        # 根据端口选择加密方式
        if port == 465:
            # SSL加密连接
            with smtplib.SMTP_SSL(smtp_server, port) as server:
                server.login(username, password)
                server.sendmail(from_email, to_email, msg.as_string())
        elif port == 587:
            # STARTTLS加密连接
            with smtplib.SMTP(smtp_server, port) as server:
                server.starttls()
                server.login(username, password)
                server.sendmail(from_email, to_email, msg.as_string())
        else:
            with smtplib.SMTP(smtp_server, port) as server:
                if port == 25:
                    server.ehlo()
                server.login(username, password)
                server.sendmail(from_email, to_email, msg.as_string())
        
        sys.stdout.flush()
        return True
    except Exception as e:
        print(f"发送失败: {str(e)}", file=sys.stderr)
        sys.stderr.flush()
        return False

if __name__ == "__main__":
    # 命令行参数解析
    parser = argparse.ArgumentParser(description='通过SMTP发送邮件')
    parser.add_argument('--to', required=True, help='收件人邮箱')
    parser.add_argument('--subject', required=True, help='邮件主题')
    parser.add_argument('--template', required=True, help='模板文件名')
    parser.add_argument('--code', required=True, help='验证码')
    parser.add_argument('--server', required=True, help='SMTP服务器地址')
    parser.add_argument('--port', type=int, required=True, help='SMTP端口 (465/587)')
    parser.add_argument('--user', required=True, help='SMTP用户名')
    parser.add_argument('--password', required=True, help='SMTP密码/授权码')
    parser.add_argument('--from_email', help='发件人邮箱')
    
    args = parser.parse_args()
    
    # 准备模板数据
    template_data = {
        'code': args.code,
        'subject': args.subject
    }
    
    # 调用发送函数
    success = send_email(
        to_email=args.to,
        subject=args.subject,
        template_name=args.template,
        data=template_data,
        smtp_server=args.server,
        port=args.port,
        username=args.user,
        password=args.password,
        from_email=args.from_email
    )
    
    # 设置退出码
    sys.exit(0 if success else 1)
```

然后，通过 `Dockerfile` 来准备一个虚拟环境：

```Dockerfile
RUN python3 -m venv /app/venv && . /app/venv/bin/activate && pip install --no-cache-dir jinja2 premailer && deactivate
```

在 `go` 中启用即可：

```go
func sendEmailVerificationCode(data *model.MailInfo) (string, error) {
	pythonScript := "./utils/sendMail.py"
	code := utils.GetRandomString(6)

	os.Setenv("PYTHONUNBUFFERED", "1")

	pythonPath := filepath.Join("./venv/bin/python3")
	cmd := exec.Command(pythonPath, pythonScript,
		"--to", data.ToWho,
		"--subject", data.Subject,
		"--template", "email-verified.html",
		"--code", code,
		"--server", global.Conf.MailSMTPHost,
		"--port", fmt.Sprintf("%d", global.Conf.MailSMTPPort),
		"--user", global.Conf.MailSMTPUser,
		"--password", global.Conf.MailSMTPPwd,
	)

	output, err := cmd.CombinedOutput()
	if err != nil {
		return "", err
	}

	return code, nil
}
```

