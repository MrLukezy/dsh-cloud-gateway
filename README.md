# dsh-cloud-gateway

## 介绍

官方 `dsh web` 只监听本机 `127.0.0.1`，不能直接对公网开放。本插件在旁边开一个带账号密码的入口，登录后再反代到本地 DeepSeek Harness。

适合已经把 Harness 装到云服务器、又希望用浏览器从外网进入工作台的人。安装后默认监听 `8080`，访问路径是 `/dsh`，避免和官方 Web 的 `3080` 抢端口。

仓库 topic：`dsh-plugin`、`dsh-category-security`。发布包不含真实账号、密码、域名或公网 IP。凭据只写在你自己机器上。

English: a login wall and reverse proxy for cloud-deployed DeepSeek Harness.

## 安装

需要已安装 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)。

```bash
dsh plugin --profile web add github:MrLukezy/dsh-cloud-gateway
dsh web --trusted-host YOUR_PUBLIC_IP --trusted-host your.example.com
```

浏览器打开：

```text
http://YOUR_PUBLIC_IP:8080/dsh
```

本地目录也可以：`dsh plugin --profile web add ./dsh-cloud-gateway`。

## 手机访问

本插件只提供登录和反代，不改官方桌面布局。手机竖屏打开会挤，侧栏也不好用。

如果主要用手机进云端工作台，建议和社区竖屏插件 [dsh-web-mobile](https://github.com/mexiaosqwq/dsh-web-mobile) 一起装，两个插件可以放在同一个 `web` profile：

```bash
dsh plugin --profile web add github:MrLukezy/dsh-cloud-gateway
dsh plugin --profile web add github:mexiaosqwq/dsh-web-mobile
dsh web --trusted-host YOUR_PUBLIC_IP --trusted-host your.example.com
```

`dsh-cloud-gateway` 负责公网登录，`dsh-web-mobile`（包名 `@dsh-external/dsh-mobile-nav`）负责窄屏抽屉、会话全宽和设置页适配。电脑宽屏布局基本不变。

## 配置引导

完整步骤、字段说明和 Nginx 示例见 [docs/setup.md](docs/setup.md)。最短路径：

1. 没自己设密码时，到 `dsh web` 日志里找 `generated login`。
2. 登录后打开 **设置 → 网关**，再点 **网关设置**，改账号、密码、端口和是否信任反代。也可以在同一页退出登录。
3. 启动命令必须带 `--trusted-host`，否则登录后接口会被官方围栏拦住。
4. 前面如果有 Nginx，打开「信任反向代理」，并把 `/dsh`、`/assets/`、`/plugins/`、`/api`、`/dsh-image-gen` 都反代到网关。
5. 浏览器拖入 PDF、Markdown 等非图片文件时，网关会保存到服务器并写入输入框路径；png/jpeg/webp/gif 仍走官方图片附件栏。

## 文档

- [配置引导](docs/setup.md)

## 开发

```bash
npm install
npm test
```

## License

MIT
