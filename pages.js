function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}

const PAGE_CSS = `
  :root { --bg:#0b1020; --line:#2a3354; --text:#eef2ff; --muted:#93a0c4; --accent:#5b8cff; --danger:#ff7b8a; --card:#141a2e; --input:#0e1426; }
  * { box-sizing: border-box; }
  html, body { margin: 0; }
  body { font-family: "Segoe UI","PingFang SC","Microsoft YaHei",sans-serif; color: var(--text); background: var(--bg); }
  h1 { margin: 0; font-size: 22px; }
  h2 { margin: 28px 0 10px; font-size: 16px; }
  .sub, .hint, .readonly { color: var(--muted); font-size: 13px; line-height: 1.55; }
  label { display: block; margin: 14px 0 8px; color: var(--muted); font-size: 13px; }
  input, select { width: 100%; height: 44px; border: 1px solid var(--line); border-radius: 12px; background: var(--input); color: var(--text); padding: 0 14px; }
  input[type="checkbox"] { width: 18px; height: 18px; }
  button { height: 46px; border: 0; border-radius: 12px; background: var(--accent); color: white; font-size: 15px; font-weight: 600; }
  .error { color: var(--danger); font-size: 13px; }
  .ok { color: #8ee0a8; font-size: 13px; }
  a { color: var(--accent); }
  details { margin-top: 18px; color: var(--muted); font-size: 13px; line-height: 1.6; }
  summary { cursor: pointer; color: var(--text); }
`;

export function loginPage(basePath, error) {
  const action = escapeHtml(`${basePath}/login`);
  const message = error ? `<p class="error">${escapeHtml(error)}</p>` : "";
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>登录 · DeepSeek Harness</title>
  <style>${PAGE_CSS}
    html, body { height: 100%; }
    body { display: grid; place-items: center; padding: 24px; }
    .shell { width: min(440px, 100%); }
    .card { background: var(--card); border: 1px solid var(--line); border-radius: 18px; padding: 28px 24px; }
    button { width: 100%; margin-top: 22px; }
  </style>
</head>
<body>
  <div class="shell">
    <h1>DeepSeek Harness</h1>
    <p class="sub">云端入口。登录后可在右下角打开「网关设置」修改账号、端口和反代选项。</p>
    <form class="card" method="post" action="${action}">
      ${message}
      <label for="username">账号</label>
      <input id="username" name="username" autocomplete="username" required autofocus>
      <label for="password">密码</label>
      <input id="password" name="password" type="password" autocomplete="current-password" required>
      <button type="submit">登录</button>
    </form>
    <details>
      <summary>安装后如何配置这些参数</summary>
      <ol>
        <li>如果还没自己设密码，到启动 <code>dsh web</code> 的终端或服务日志里找 <code>generated login</code>，或打开 <code>$DSH_HOME/cloud-gateway-state.json</code>。</li>
        <li>登录后点右下角「网关设置」，可以直接改账号、密码、端口、路径和反向代理选项。</li>
        <li>也可以用环境变量 <code>DSH_CLOUD_USERNAME</code> / <code>DSH_CLOUD_PASSWORD</code>，适合 systemd 这类部署。</li>
        <li>启动时必须加 <code>--trusted-host 你的公网IP或域名</code>，否则登录后模型接口会被官方围栏拦住。</li>
        <li>前面如果有 Nginx，请打开「信任反向代理」，并把 <code>/dsh</code>、<code>/assets/</code>、<code>/plugins/</code>、<code>/api</code> 都反代到网关。</li>
      </ol>
    </details>
  </div>
</body>
</html>`;
}

export function settingsPage(options) {
  const {
    basePath,
    values,
    upstream,
    publicUrls,
    envLocked,
    saved,
    error,
  } = options;
  const action = escapeHtml(`${basePath}/settings`);
  const appHref = escapeHtml(`${basePath}/`);
  const message = error
    ? `<p class="error">${escapeHtml(error)}</p>`
    : saved
      ? `<p class="ok">已保存。监听地址或路径若有改动，请用新地址重新打开。</p>`
      : "";
  const urls = (publicUrls || []).map((url) => `<li><code>${escapeHtml(url)}</code></li>`).join("")
    || "<li>当前没有检测到局域网 IPv4 地址</li>";
  const usernameDisabled = envLocked.username ? " disabled" : "";
  const passwordDisabled = envLocked.password ? " disabled" : "";
  const secure = values.secureCookie === true ? "true" : values.secureCookie === false ? "false" : "";

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>网关设置 · DeepSeek Harness</title>
  <style>${PAGE_CSS}
    body { padding: 32px 20px 80px; }
    .wrap { width: min(720px, 100%); margin: 0 auto; }
    .card { background: var(--card); border: 1px solid var(--line); border-radius: 18px; padding: 24px; }
    .row { display: flex; align-items: center; gap: 10px; margin-top: 16px; }
    .actions { display: flex; gap: 12px; margin-top: 24px; }
    .actions button, .actions a { display: inline-flex; align-items: center; justify-content: center; padding: 0 18px; text-decoration: none; }
    .ghost { background: transparent; border: 1px solid var(--line); color: var(--text); }
    code { color: var(--text); }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>网关设置</h1>
    <p class="sub">这些选项只保存在本机 <code>$DSH_HOME/cloud-gateway-state.json</code>，不会写回插件包。环境变量优先级更高，被环境变量锁住的字段不能在这里改。</p>
    ${message}
    <form class="card" method="post" action="${action}">
      <h2>登录</h2>
      <label for="username">账号</label>
      <input id="username" name="username" value="${escapeHtml(values.username || "")}" required${usernameDisabled}>
      ${envLocked.username ? `<p class="hint">已由环境变量 DSH_CLOUD_USERNAME 锁定</p>` : ""}
      <label for="password">新密码</label>
      <input id="password" name="password" type="password" autocomplete="new-password" placeholder="留空则不修改"${passwordDisabled}>
      ${envLocked.password ? `<p class="hint">已由环境变量 DSH_CLOUD_PASSWORD 锁定</p>` : `<p class="hint">建议至少 8 位。留空表示继续使用当前密码。</p>`}

      <h2>监听</h2>
      <label for="listenHost">监听地址</label>
      <input id="listenHost" name="listenHost" value="${escapeHtml(values.listenHost || "0.0.0.0")}" required>
      <p class="hint">云服务器公网访问用 <code>0.0.0.0</code>。只本机调试可改 <code>127.0.0.1</code>。</p>
      <label for="listenPort">公网端口</label>
      <input id="listenPort" name="listenPort" type="number" min="1" max="65535" value="${escapeHtml(values.listenPort)}" required>
      <p class="hint">必须和本机 <code>dsh web</code> 端口不同。默认 8080，避免和官方 3080 冲突。</p>
      <label for="basePath">访问路径</label>
      <input id="basePath" name="basePath" value="${escapeHtml(values.basePath || "/dsh")}" required>
      <p class="hint">浏览器里的前缀，例如 <code>/dsh</code>。只能包含字母、数字、点、下划线、短横线。</p>

      <h2>反向代理</h2>
      <div class="row">
        <input id="trustProxy" name="trustProxy" type="checkbox" value="1"${values.trustProxy ? " checked" : ""}>
        <label for="trustProxy" style="margin:0">信任反向代理（Nginx / Caddy）</label>
      </div>
      <p class="hint">只有前面有你自己的反代时才打开。打开后才会使用 <code>X-Forwarded-For</code> 做登录限流。</p>
      <label for="secureCookie">Secure Cookie</label>
      <select id="secureCookie" name="secureCookie">
        <option value=""${secure === "" ? " selected" : ""}>自动：仅 HTTPS 请求带 Secure</option>
        <option value="true"${secure === "true" ? " selected" : ""}>始终开启</option>
        <option value="false"${secure === "false" ? " selected" : ""}>始终关闭</option>
      </select>
      <label for="cookiePath">Cookie 路径</label>
      <input id="cookiePath" name="cookiePath" value="${escapeHtml(values.cookiePath || "/")}">
      <p class="hint">如果 <code>/assets</code>、<code>/plugins</code>、<code>/api</code> 在站点根路径，保持 <code>/</code>。</p>

      <div class="actions">
        <button type="submit">保存设置</button>
        <a class="ghost" href="${appHref}">返回工作台</a>
      </div>
    </form>

    <h2>当前状态</h2>
    <div class="card readonly">
      <p>上游 Harness：<code>${escapeHtml(upstream)}</code></p>
      <p>可尝试的地址：</p>
      <ul>${urls}</ul>
      <p>启动 <code>dsh web</code> 时请带上 <code>--trusted-host</code>，值改成你的公网 IP 或域名，不要照抄别人的机器信息。</p>
      <p>若要用 80/443，把 <code>/dsh</code>、<code>/assets/</code>、<code>/plugins/</code>、<code>/api</code> 都反代到上面的监听端口，并打开「信任反向代理」。</p>
    </div>
  </div>
</body>
</html>`;
}

export function toolbarHtml(settingsPath, logoutPath) {
  const settings = escapeHtml(settingsPath);
  const logout = escapeHtml(logoutPath);
  return `<style>#dsh-gw-bar{position:fixed;right:16px;bottom:24px;z-index:2147483647;display:flex;gap:8px}#dsh-gw-bar a{display:inline-flex;align-items:center;height:40px;padding:0 14px;border-radius:999px;background:#1f2937;color:#fff;font:600 14px/1 sans-serif;text-decoration:none}</style><div id="dsh-gw-bar"><a id="dsh-gw-settings" href="${settings}">网关设置</a><a id="dsh-gw-logout" href="${logout}">退出登录</a></div>`;
}
