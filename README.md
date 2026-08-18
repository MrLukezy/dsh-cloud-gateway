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

## 配置引导

完整步骤、字段说明和 Nginx 示例见 [docs/setup.md](docs/setup.md)。最短路径：

1. 没自己设密码时，到 `dsh web` 日志里找 `generated login`。
2. 登录后打开 **设置 → 网关**，再点 **网关设置**，改账号、密码、端口和是否信任反代。也可以在同一页退出登录。
3. 启动命令必须带 `--trusted-host`，否则登录后接口会被官方围栏拦住。
4. 前面如果有 Nginx，打开「信任反向代理」，并把 `/dsh`、`/assets/`、`/plugins/`、`/api` 都反代到网关。

## 文档

- [配置引导](docs/setup.md)

## 开发

```bash
npm install
npm test
```

## License

MIT
