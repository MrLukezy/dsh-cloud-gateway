# 配置引导

本页说明安装 `dsh-cloud-gateway` 之后怎么设账号、端口和反向代理。发布包里的 `cordis.patch.yml` 不带密码。

## 第一次打开

1. 确认已经执行：

   ```bash
   dsh plugin --profile web add github:MrLukezy/dsh-cloud-gateway
   dsh web --trusted-host YOUR_PUBLIC_IP --trusted-host your.example.com
   ```

2. 浏览器打开 `http://YOUR_PUBLIC_IP:8080/dsh`。默认端口是 **8080**，必须和本机 `dsh web` 的端口不同，否则插件会拒绝启动。

3. 如果还没自己设密码，到启动 `dsh web` 的终端或服务日志里找 `generated login`，或打开 `$DSH_HOME/cloud-gateway-state.json`（权限 `0600`）。

4. 登录后打开官方 **设置 → 网关**，再点 **网关设置**。可以改账号、密码、监听地址、端口、路径、是否信任 Nginx。设置只保存在本机 state 文件，不会写回插件包。Esc 或点击空白处关闭设置窗。同一页也可以退出登录。

5. 如果要用手机竖屏访问，再装社区插件 [dsh-web-mobile](https://github.com/mexiaosqwq/dsh-web-mobile)：

   ```bash
   dsh plugin --profile web add github:mexiaosqwq/dsh-web-mobile
   ```

   它和本插件不冲突：网关管登录，竖屏插件管窄屏布局。电脑宽屏几乎不受影响。

## 三种配法，优先级从高到低

1. 环境变量 `DSH_CLOUD_USERNAME` / `DSH_CLOUD_PASSWORD` / `DSH_CLOUD_SECRET`  
   适合 systemd。被环境变量锁住的字段，设置页里不能改。
2. 本机 profile 覆盖 `~/.dsh/profiles/web/cordis.patch.yml`
3. 登录后的「网关设置」页，或首次启动自动生成的随机密码

profile 补丁会**整段替换**该行的 `config`，不要只写一个字段：

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

不设 `secret` 时，会话密钥会持久化到 `$DSH_HOME/cloud-gateway-state.json`，重启不会全员掉线。

## 字段

| 字段 | 默认 | 含义 |
|---|---|---|
| `listenHost` | `0.0.0.0` | 公网监听地址。云服务器用 `0.0.0.0`，本机调试可用 `127.0.0.1` |
| `listenPort` | `8080` | 公网端口，必须和 `dsh web` 不同 |
| `basePath` | `/dsh` | 浏览器访问前缀 |
| `username` | `admin` | 登录账号 |
| `password` | （空则生成） | 登录密码。建议至少 8 位 |
| `secret` | （空则持久化生成） | 会话 HMAC 密钥 |
| `upstreamHost` | `webStartup.host` | 本机 Harness 地址 |
| `upstreamPort` | `webStartup.port` | 本机 Harness 端口 |
| `trustProxy` | `false` | 仅在前面有可信反代时打开，才会信 `X-Forwarded-*` |
| `secureCookie` | 自动 | `true` 强制 Secure；留空则仅 HTTPS 请求带 Secure |
| `cookiePath` | `/` | Cookie 路径。站点根路径还有 `/assets` `/plugins` `/api` 时保持 `/` |

## `--trusted-host`

启动时必须声明外网 Host，否则登录后普通模型接口和 WebSocket 会被官方围栏拦截：

```bash
dsh web --trusted-host YOUR_PUBLIC_IP --trusted-host your.example.com
```

设置页里的「模型 / 提供方目录 / Agent 预设」走官方特权接口 `settings.describe`，只认本机回环。本插件在登录后会把这类请求改成本机 Host，并去掉会触发 403 的浏览器 Fetch Metadata，所以云端也能打开设置。

## 和 Nginx 一起用

插件默认听 `0.0.0.0:8080`。要用 80/443 且不带端口号时，打开 `trustProxy: true`，并把这些路径都反代到网关：

- `/dsh`
- `/assets/`
- `/plugins/`
- `/api`
- `/dsh-image-gen`（生图插件的读图 RPC，在站点根路径，不在 `/dsh` 下）
- `/favicon.svg` `/favicon.ico` `/manifest.webmanifest`

只反代 `/dsh`、不反代站点根路径的静态资源和 API，登录后会白屏。生图预览会请求 `/dsh-image-gen/...`，漏反代时图片已生成但页面读不到。

```nginx
location /dsh { proxy_pass http://127.0.0.1:8080; }
location /assets/ { proxy_pass http://127.0.0.1:8080; }
location /plugins/ { proxy_pass http://127.0.0.1:8080; }
location /api { proxy_pass http://127.0.0.1:8080; }
location /dsh-image-gen { proxy_pass http://127.0.0.1:8080; }
```

生产环境请再套 TLS。本插件是登录壳，不是 HTTPS；HTTP 下账号密码走明文。

## 拖入文档

官方输入框只接受 png/jpeg/webp/gif。从浏览器拖入 PDF、Markdown、文本等文件时，本插件会保存到 `$DSH_HOME/uploads/`，并在对话框里插入 `@文件名` 资源引用（界面只显示文件名链接，不展示完整路径）。图片拖放仍走官方附件栏。

## 安全注意

- 不要把真实密码打进即将发布的 `cordis.patch.yml`
- 默认不信任 `X-Forwarded-For`，避免登录限流被伪造 IP 绕过
- `/assets/` 和 `/plugins/` 需要登录后才能访问
- 会话 Cookie：`HttpOnly`、`SameSite=Lax`；HTTPS 下自动加 `Secure`
- 在共享域名上，`cookiePath: /` 会把会话发给同主机其他站点。独立子域更安全
