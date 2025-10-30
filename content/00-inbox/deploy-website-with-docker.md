---
title: docker compose 部署 web 项目
description:
tags:
  - 文具袋/文具推荐
  - Status/Doing
date: 2025-05-27
lastmod: 2025-10-30
draft: true
cover:
location: 43.8259282,125.4254779
---

# 前期提要

> [!failure] 动机
>
> 由于一直以来部署项目都十分麻烦，一下子有测试服务器一下子有正式服务器，正式生产环境的服务器还没办法使用 ip 访问，域名合法前也没办法访问网站。
>
> 在服务器上 debug 也十分难受，最重要的是没办法同步到 Github 上，于是我借这次修改的机会，好好研究一下怎么一键部署项目

在以往的做法中，我们部署项目都遵循以下几步：

1. 前端通过打包工具（例如 `webpack`, `rspack`, `vite`），生成 `dist`/ `output` 等打包后的产物，压缩后传给后端
2. 后端对代码进行打包/编译（注意需要指定服务器环境，添加各类参数），得到一个可执行文件（一般用 `java`/`go`）
3. 后端将前后端的打包文件都传上服务器，开始配置运行所需要的环境，包括数据库，`redis`，还有一系列后端服务可能需要用的第三方包（例如你可能会需要使用命令行工具来进行一些操作）
4. 开始配置 `nginx`（虽然是写最简单的配置，但也要花很久的时间）
5. 登陆网站进行检查

然而，一到版本更新时，我们就需要不断的进行前两步操作，甚至于后面几步，对于工作的愉快指数会造成指数级暴击（

> [!important]
>
> 由于我们的项目都比较小，为了较少的心智负担，我们将 `Nginx` 去掉，用 [`Caddy`](https://caddyserver.com/) 替换

# 单个 Web 应用

这里，我们约定项目是前后端分离的，项目文件夹架构如下所示，假定前端为 `Vue`，后端为 `Gin` ：

```bash
.
├── backend
│   ├── config
│   ├── db
│   ├── docker-compose.yml
│   ├── Dockerfile
│   ├── docs
│   ├── global
│   ├── go.mod
│   ├── go.sum
│   ├── handler
│   ├── main.go
│   ├── mapper
│   ├── middleware
│   ├── model
│   ├── README.md
│   ├── routes
│   ├── templates
│   └── utils
├── docker-compose.yml
└── frontend
    ├── auto-imports.d.ts
    ├── biome.json
    ├── Caddyfile
    ├── dist
    ├── Dockerfile
    ├── eslint.config.js
    ├── index.html
    ├── node_modules
    ├── package-lock.json
    ├── package.json
    ├── postcss.config.js
    ├── public
    ├── README.md
    ├── src
    ├── tailwind.config.js
    ├── tsconfig.app.json
    ├── tsconfig.json
    ├── tsconfig.node.json
    └── vite.config.ts
```

我们首先明确容器的数量：

1. 前端构建的产物以及 `Caddy` 所在的容器，用于部署前端应用
2. 后端打包的容器，用于部署后端应用
3. 数据库（包括 `redis`）的容器
## 整体管理

我们通过 `docker-compose.yml` 来进行整个项目的管理，注意，这里我数据库选用的 `SQLite`（有点逆天但主要是因为也没几条数据），如果要使用 `mysql`，需要在这里再添加一个 `mysql` 的 service

```yml
version: '3.8'

services:
  # Redis Service
  thesis_redis:
    image: redis:latest
    ports:
      - "6657:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes
    networks:
      - app_network

  # Gin Backend Service
  thesis_backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
      args:
        - GIN_MODE=${GIN_MODE:-release}
    ports:
      - "8081:8080"
    environment:
      - GIN_MODE=${GIN_MODE}
      - REDIS_HOST=${REDIS_HOST}
      - REDIS_PORT=${REDIS_PORT}
      - REDIS_PASSWORD=${REDIS_PASSWORD}
      - REDIS_DB=${REDIS_DB}
      - REDIS_POOL=${REDIS_POOL}
      - DB_NAME=${DB_NAME}
      - MAIL_FROM=${MAIL_FROM}
      - SMTP_HOST=${SMTP_HOST}
      - SMTP_PORT=${SMTP_PORT}
      - SMTP_USER=${SMTP_USER}
      - SMTP_PASSWORD=${SMTP_PASSWORD}
    volumes:
      - ./backend/db:/app/db
    depends_on:
      - thesis_redis
    networks:
      - app_network

  thesis_frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    environment:
      - BACKEND_SERVICE_NAME=${BACKEND_SERVICE_NAME}
      - BACKEND_PORT=${BACKEND_PORT}
    depends_on:
      - thesis_backend
    networks:
      - app_network
      - proxy_network

networks:
  app_network:
    driver: bridge
  proxy_network:
    external: true

volumes:
  redis_data:
```

我们通过这个 `yml` 文件定义了这个集群（也没到这个地步）的网络 `app_network`，在这个网络中三个容器是互通的，然后通过 `proxy_network` 把前端代理到 `host`（宿主机）的网络上，让外部应用可以访问前端这个容器（也就是 `Caddy` 所在的容器），然后通过 `Caddy` 给后端反向代理请求，从而完成一次网络请求

## 后端构建

我们通过 `backend/Dockerfile` 来构建容器：

```docker
FROM golang:1.24.3 AS builder

# Set working directory
WORKDIR /build

# Copy go mod files
COPY go.mod go.sum ./
RUN go env -w GO111MODULE=on && go env -w GOPROXY=https://mirrors.aliyun.com/goproxy/,direct && go mod download

# Copy source code and config files
COPY . .

# Set build arguments for release mode
ARG GIN_MODE=${GIN_MODE}
ENV GIN_MODE=${GIN_MODE}

# Build the application with release mode
RUN go build -ldflags="-s -w" -o main .

# Final stage
FROM ubuntu:24.04

# Prevent interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive
ENV GIN_MODE=${GIN_MODE}

RUN sed -i 's@//.*archive.ubuntu.com@//mirrors.tuna.tsinghua.edu.cn@g' /etc/apt/sources.list && sed -i 's@//.*security.ubuntu.com@//mirrors.tuna.tsinghua.edu.cn@g' /etc/apt/sources.list

# Install required packages
RUN apt-get update && apt-get install -y \
    sqlite3 \
    python3 \
    python3-venv \
    python3-pip \
    unoconv \
    msmtp \
    mutt \
    ca-certificates \
    fonts-liberation \
    fontconfig && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy the binary from builder
COPY --from=builder /usr/share/zoneinfo/Asia/Shanghai /etc/localtime
COPY --from=builder /build/main .
COPY --from=builder /build/config ./config
COPY --from=builder /build/utils ./utils
COPY --from=builder /build/templates ./templates
COPY --from=builder /build/font ./font

# Install custom fonts
RUN mkdir -p /usr/share/fonts/custom && cp /app/font/* /usr/share/fonts/custom/ && fc-cache -f -v

# Create and activate Python virtual environment
RUN python3 -m venv /app/venv && . /app/venv/bin/activate && pip install --no-cache-dir jinja2 premailer && deactivate

# Create config directory and set permissions
RUN chmod u+x /app/utils/pdfid/pdfid.py && chmod u+x /app/utils/sendMail.py && mkdir -p /app/config

# Create a script to generate config files
RUN echo '#!/bin/bash\n\
# Remove existing config files\n\
rm -f /app/config/setting.toml\n\
rm -f /app/config/setting.prod.toml\n\
\n\
# Generate production config\n\
cat > /app/config/setting.prod.toml << EOF\n\
[database]\n\
name = "${DB_NAME}"\n\
\n\
[redis]\n\
host = "${REDIS_HOST}"\n\
port = ${REDIS_PORT}\n\
password = "${REDIS_PASSWORD}"\n\
db = ${REDIS_DB}\n\
pool = ${REDIS_POOL}\n\
\n\
[system]\n\
port = 8080\n\
\n\
[mail]\n\
from = "${MAIL_FROM}"\n\
\n\
[mail.smtp]\n\
host = "${SMTP_HOST}"\n\
port = ${SMTP_PORT}\n\
user = "${SMTP_USER}"\n\
password = "${SMTP_PASSWORD}"\n\
EOF\n\
\n\
# Generate environment config\n\
cat > /app/config/setting.toml << EOF\n\
[env]\n\
mode = "prod"\n\
EOF\n\
' >/app/generate-config.sh && chmod +x /app/generate-config.sh

# Create startup script
RUN echo '#!/bin/bash\n\
/app/generate-config.sh\n\
exec /app/main\n\
' >/app/start.sh && chmod +x /app/start.sh

# Use the startup script as entrypoint
ENTRYPOINT ["/app/start.sh"]
```

这里安装运行时环境都比较简单，主要在于我们通过 `.env` 文件来自动生成 `toml` 配置文件，然后生成执行脚本

通过 `.env` 文件我们可以在服务器与本地配置不同后缀名的，例如 `.env.prod`，`.env.dev` 等