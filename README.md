# dsh-cloud-gateway

DeepSeek Harness 云端登录网关。给只监听本机的 `dsh web` 加一层账号密码入口，再反代到本地 Harness。

A login wall and reverse proxy for cloud-deployed DeepSeek Harness. Official `dsh web` binds localhost only; this plugin exposes a separate authenticated public port.

仓库 topic：`dsh-plugin`，可选 `dsh-category-security`。

> 本仓库不含任何真实账号、密码、域名、公网 IP 或 API Key。部署凭据只应写在你自己机器的 profile 或环境变量里。

## 安装

需要已安装 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（`dsh` CLI）。

```bash
dsh plugin --profile web add github:MrLukezy/dsh-cloud-gateway
```

本地目录或 npm 包也可以：

```bash
dsh plugin --profile web add ./dsh-cloud-gateway
dsh plugin --profile web add dsh-cloud-gateway
```

## 启动

必须声明外网 Host，否则登录后模型接口和 WebSocket 会被官方围栏拦截：

```bash
dsh web --trusted-host YOUR_PUBLIC_IP --trusted-host your.example.com
```

默认入口：

```text
http://YOUR_PUBLIC_IP:8080/dsh
```

默认公网端口是 **8080**，避免和官方 `dsh web` 的 `3080` 冲突。两个端口相同会拒绝启动。

## 安装后怎么配置

官方「设置 → 插件」目前不会列出第三方插件的字段，所以本插件自己提供可视化配置页。

1. 启动后打开 `http://YOUR_PUBLIC_IP:8080/dsh`。
2. 如果还没自己设密码，到 `dsh web` 日志里找 `generated login`，或看 `$DSH_HOME/cloud-gateway-state.json`。
3. 登录后点右下角 **网关设置**，可以直接改账号、密码、端口、路径、是否信任 Nginx。
4. 登录页下方也有「安装后如何配置这些参数」说明。

环境变量 `DSH_CLOUD_USERNAME` / `DSH_CLOUD_PASSWORD` 优先级最高，适合 systemd。被环境变量锁住的字段，设置页里会显示为不可改。

## 账号密码

发布包里的 `cordis.patch.yml` **不带密码**。解析顺序：

1. 环境变量 `DSH_CLOUD_USERNAME` / `DSH_CLOUD_PASSWORD`
2. 本机 profile 覆盖里的 `username` / `password`
3. 都没有时，首次启动生成随机密码，写入 `$DSH_HOME/cloud-gateway-state.json`（权限 `0600`），并在日志里打印一次

本机覆盖示例（把真实值留在服务器上，不要提交进任何仓库）：

```yaml
# ~/.dsh/profiles/web/cordis.patch.yml
- id: cloud-gateway
  config:
    listenHost: 0.0.0.0
    listenPort: 8080
    basePath: /dsh
    username: admin
    password: change-me-to-a-long-password
    trustProxy: false
```

profile 补丁会**整段替换**该行的 `config`，不要只写一个字段。

也可用 `DSH_CLOUD_SECRET` 固定会话密钥。不设时密钥会持久化到上面的 state 文件，重启不会全员掉线。

## 配置

| 字段 | 默认 | 含义 |
|---|---|---|
| `listenHost` | `0.0.0.0` | 公网监听地址 |
| `listenPort` | `8080` | 公网端口，必须和 `dsh web` 不同 |
| `basePath` | `/dsh` | 访问路径前缀 |
| `username` | `admin` | 登录账号 |
| `password` | （空则生成） | 登录密码。建议至少 8 位；留空则生成随机密码 |
| `secret` | （空则持久化生成） | 会话 HMAC 密钥 |
| `upstreamHost` | `webStartup.host` | 本机 Harness 地址 |
| `upstreamPort` | `webStartup.port` | 本机 Harness 端口 |
| `trustProxy` | `false` | 仅在前面有可信反代时打开，才会信 `X-Forwarded-*` |
| `secureCookie` | 自动 | `true` 强制 Secure；留空则仅 HTTPS 请求带 Secure |
| `cookiePath` | `/` | Cookie 路径。站点根路径还有 `/assets` `/plugins` `/api` 时保持 `/` |

## 和 Nginx 一起用

插件默认听 `0.0.0.0:8080`。若要用 80/443 且不带端口号，把下面这些路径都反代到网关，并打开 `trustProxy: true`：

- `/dsh`
- `/assets/`
- `/plugins/`
- `/api`
- `/favicon.svg` `/favicon.ico` `/manifest.webmanifest`

只反代 `/dsh`、不反代站点根路径的静态资源和 API，登录后会白屏。

生产环境请再套 TLS。本插件是登录壳，不是 HTTPS；HTTP 下账号密码走明文。

示例（主机名请改成你自己的，不要照抄）：

```nginx
location /dsh { proxy_pass http://127.0.0.1:8080; }
location /assets/ { proxy_pass http://127.0.0.1:8080; }
location /plugins/ { proxy_pass http://127.0.0.1:8080; }
location /api { proxy_pass http://127.0.0.1:8080; }
```

## 安全

- 不要把真实密码打进即将发布的 `cordis.patch.yml`
- 默认不信任 `X-Forwarded-For`，避免登录限流被伪造 IP 绕过
- `/assets/` 和 `/plugins/` 需要登录后才能访问
- 会话 Cookie：`HttpOnly`、`SameSite=Lax`；HTTPS 下自动加 `Secure`
- 在共享域名上，`cookiePath: /` 会把会话发给同主机其他站点。独立子域更安全
- 本仓库的冒烟测试只用本地临时账号 `tester`，不会连接外部服务

## 开发

```bash
npm install
npm test
```

## License

MIT
