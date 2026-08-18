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
    <p class="sub">云端入口。登录后可在右下角打开「网关设置」。</p>
    <form class="card" method="post" action="${action}">
      ${message}
      <label for="username">账号</label>
      <input id="username" name="username" autocomplete="username" required autofocus>
      <label for="password">密码</label>
      <input id="password" name="password" type="password" autocomplete="current-password" required>
      <button type="submit">登录</button>
    </form>
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
  const appHref = `${basePath}/`;
  const appHrefAttr = escapeHtml(appHref);
  const closeTo = JSON.stringify(appHref);
  const message = error
    ? `<p class="banner error">${escapeHtml(error)}</p>`
    : saved
      ? `<p class="banner ok">已保存。如果改了端口或路径，请用新地址重新打开。</p>`
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
  <style>
    :root {
      --text: #1a1d23;
      --muted: #6b7280;
      --line: #e5e7eb;
      --bg: #f4f5f7;
      --panel: #ffffff;
      --input: #f8f9fb;
      --accent: #2563eb;
      --danger: #b42318;
      --ok: #067647;
      --overlay: rgba(15, 23, 42, 0.45);
    }
    * { box-sizing: border-box; }
    html, body { height: 100%; margin: 0; }
    body {
      font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
      color: var(--text);
      background: var(--bg);
    }
    .overlay {
      min-height: 100%;
      display: grid;
      place-items: center;
      padding: 24px 16px;
      background: var(--overlay);
    }
    .dialog {
      width: min(640px, 100%);
      max-height: calc(100vh - 48px);
      display: flex;
      flex-direction: column;
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 16px;
      overflow: hidden;
    }
    .head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 18px 20px 14px;
      border-bottom: 1px solid var(--line);
    }
    .head h1 { margin: 0; font-size: 18px; font-weight: 650; }
    .head p { margin: 4px 0 0; color: var(--muted); font-size: 12px; line-height: 1.5; }
    .x {
      width: 32px;
      height: 32px;
      border: 0;
      border-radius: 8px;
      background: transparent;
      color: var(--muted);
      font-size: 22px;
      line-height: 1;
      cursor: pointer;
    }
    .x:hover { background: var(--bg); color: var(--text); }
    form { display: flex; flex-direction: column; min-height: 0; }
    .body { padding: 8px 20px 8px; overflow: auto; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 16px; }
    @media (max-width: 640px) { .grid { grid-template-columns: 1fr; } }
    .field { min-width: 0; }
    .field.wide { grid-column: 1 / -1; }
    label { display: block; margin-bottom: 6px; color: var(--muted); font-size: 12px; }
    input, select {
      width: 100%;
      height: 38px;
      border: 1px solid var(--line);
      border-radius: 10px;
      background: var(--input);
      color: var(--text);
      padding: 0 12px;
    }
    input:focus, select:focus { outline: 2px solid #bfdbfe; border-color: var(--accent); }
    input:disabled { opacity: 0.65; }
    .hint { margin: 6px 0 0; color: var(--muted); font-size: 12px; line-height: 1.45; }
    .section { margin: 18px 0 8px; font-size: 13px; font-weight: 650; }
    .check { display: flex; align-items: center; gap: 8px; min-height: 38px; }
    .check input { width: 16px; height: 16px; }
    .check label { margin: 0; color: var(--text); font-size: 13px; }
    .banner { margin: 12px 20px 0; padding: 10px 12px; border-radius: 10px; font-size: 13px; }
    .banner.error { color: var(--danger); background: #fef3f2; }
    .banner.ok { color: var(--ok); background: #ecfdf3; }
    .status {
      margin-top: 16px;
      padding: 12px 14px;
      border: 1px solid var(--line);
      border-radius: 12px;
      background: var(--bg);
      color: var(--muted);
      font-size: 12px;
      line-height: 1.55;
    }
    .status ul { margin: 6px 0 8px; padding-left: 18px; }
    .foot {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      padding: 14px 20px 16px;
      border-top: 1px solid var(--line);
      background: var(--panel);
    }
    .foot button, .foot a {
      height: 36px;
      min-width: 84px;
      padding: 0 14px;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      text-decoration: none;
      cursor: pointer;
    }
    .foot button { border: 0; background: var(--accent); color: #fff; }
    .foot a { border: 1px solid var(--line); background: var(--panel); color: var(--text); }
    code { font-size: 12px; }
  </style>
</head>
<body>
  <div class="overlay" id="dsh-gw-overlay" data-close-to=${closeTo}>
    <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="dsh-gw-title">
      <div class="head">
        <div>
          <h1 id="dsh-gw-title">网关设置</h1>
          <p>只保存在本机，不会写进插件包。Esc 或点击空白处关闭。</p>
        </div>
        <button class="x" type="button" id="dsh-gw-close" aria-label="关闭">×</button>
      </div>
      ${message}
      <form method="post" action="${action}">
        <div class="body">
          <div class="section">登录</div>
          <div class="grid">
            <div class="field">
              <label for="username">账号</label>
              <input id="username" name="username" value="${escapeHtml(values.username || "")}" required${usernameDisabled}>
              ${envLocked.username ? `<p class="hint">已由 DSH_CLOUD_USERNAME 锁定</p>` : ""}
            </div>
            <div class="field">
              <label for="password">新密码</label>
              <input id="password" name="password" type="password" autocomplete="new-password" placeholder="留空则不修改"${passwordDisabled}>
              ${envLocked.password ? `<p class="hint">已由 DSH_CLOUD_PASSWORD 锁定</p>` : `<p class="hint">建议至少 8 位</p>`}
            </div>
          </div>

          <div class="section">监听</div>
          <div class="grid">
            <div class="field">
              <label for="listenHost">监听地址</label>
              <input id="listenHost" name="listenHost" value="${escapeHtml(values.listenHost || "0.0.0.0")}" required>
              <p class="hint">公网用 0.0.0.0，本机调试用 127.0.0.1</p>
            </div>
            <div class="field">
              <label for="listenPort">公网端口</label>
              <input id="listenPort" name="listenPort" type="number" min="1" max="65535" value="${escapeHtml(values.listenPort)}" required>
              <p class="hint">必须和 dsh web 端口不同</p>
            </div>
            <div class="field wide">
              <label for="basePath">访问路径</label>
              <input id="basePath" name="basePath" value="${escapeHtml(values.basePath || "/dsh")}" required>
            </div>
          </div>

          <div class="section">反向代理</div>
          <div class="grid">
            <div class="field">
              <div class="check">
                <input id="trustProxy" name="trustProxy" type="checkbox" value="1"${values.trustProxy ? " checked" : ""}>
                <label for="trustProxy">信任反向代理</label>
              </div>
              <p class="hint">仅在前面有 Nginx / Caddy 时打开</p>
            </div>
            <div class="field">
              <label for="secureCookie">Secure Cookie</label>
              <select id="secureCookie" name="secureCookie">
                <option value=""${secure === "" ? " selected" : ""}>自动（仅 HTTPS）</option>
                <option value="true"${secure === "true" ? " selected" : ""}>始终开启</option>
                <option value="false"${secure === "false" ? " selected" : ""}>始终关闭</option>
              </select>
            </div>
            <div class="field wide">
              <label for="cookiePath">Cookie 路径</label>
              <input id="cookiePath" name="cookiePath" value="${escapeHtml(values.cookiePath || "/")}">
            </div>
          </div>

          <div class="status">
            <div>上游：<code>${escapeHtml(upstream)}</code></div>
            <div>可尝试地址</div>
            <ul>${urls}</ul>
            <div>启动时请加 <code>--trusted-host</code>。80/443 需要把 /dsh、/assets、/plugins、/api 都反代过来。</div>
          </div>
        </div>
        <div class="foot">
          <a href="${appHrefAttr}" id="dsh-gw-cancel">取消</a>
          <button type="submit">保存</button>
        </div>
      </form>
    </div>
  </div>
  <script>
    (function () {
      var overlay = document.getElementById("dsh-gw-overlay");
      var closeTo = overlay && overlay.getAttribute("data-close-to");
      function closeSettings() {
        if (closeTo) location.href = closeTo;
      }
      if (overlay) {
        overlay.addEventListener("click", function (event) {
          if (event.target === overlay) closeSettings();
        });
      }
      var closeBtn = document.getElementById("dsh-gw-close");
      if (closeBtn) closeBtn.addEventListener("click", closeSettings);
      document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
          event.preventDefault();
          closeSettings();
        }
      });
    })();
  </script>
</body>
</html>`;
}

export function toolbarHtml(settingsPath, logoutPath) {
  const settings = escapeHtml(settingsPath);
  const logout = escapeHtml(logoutPath);
  return `<style>#dsh-gw-bar{position:fixed;right:16px;bottom:24px;z-index:2147483647;display:flex;gap:8px}#dsh-gw-bar a{display:inline-flex;align-items:center;height:40px;padding:0 14px;border-radius:999px;background:#1f2937;color:#fff;font:600 14px/1 sans-serif;text-decoration:none}</style><div id="dsh-gw-bar"><a id="dsh-gw-settings" href="${settings}">网关设置</a><a id="dsh-gw-logout" href="${logout}">退出登录</a></div>`;
}
