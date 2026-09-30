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
    <p class="sub">云端入口。登录后可在「设置 → 网关」里改账号或退出。</p>
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

export function settingsHookHtml(settingsPath, logoutPath) {
  const settings = JSON.stringify(settingsPath);
  const logout = JSON.stringify(logoutPath);
  return `<style id="dsh-gw-hook-css">
[data-dsh-gw-hide]{display:none!important}
#dsh-gw-panel{display:flex;flex-direction:column;gap:10px;padding-top:4px}
#dsh-gw-panel h2{margin:0;font-size:16px;font-weight:650;color:var(--dsw-alias-label-primary,inherit)}
#dsh-gw-panel .dsh-gw-lead{margin:0 0 6px;font-size:13px;line-height:1.5;color:var(--dsw-alias-label-secondary,#6b7280)}
#dsh-gw-panel a{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.22));border-radius:12px;text-decoration:none;color:inherit;background:var(--dsw-alias-bg-primary,transparent)}
#dsh-gw-panel a:hover{background:var(--dsw-specific-sidebar-nav-item-hover,rgba(127,127,127,.08))}
#dsh-gw-panel strong{display:block;font-size:14px;font-weight:600}
#dsh-gw-panel span{display:block;margin-top:2px;font-size:12px;line-height:1.45;color:var(--dsw-alias-label-secondary,#6b7280)}
#dsh-gw-panel i{font-style:normal;color:var(--dsw-alias-label-secondary,#6b7280)}
html[data-dsh-gw-light="1"]{color-scheme:light!important}
html[data-dsh-gw-theme="cyberpunk"],html[data-dsh-gw-theme="dark"]{color-scheme:dark!important}
#dsh-gw-wallpaper{position:fixed;inset:0;z-index:0;pointer-events:none;background:#111 center/cover no-repeat}
#dsh-gw-wallpaper:after{content:"";position:absolute;inset:0;background:rgba(8,10,16,.4)}
html[data-dsh-gw-light="1"] #dsh-gw-wallpaper{background-color:#eef1f5}
html[data-dsh-gw-light="1"] #dsh-gw-wallpaper:after{background:rgba(255,255,255,.42)}
html[data-dsh-gw-bg="1"] body{background-color:transparent!important}
.dshqb_popover,.dshqb_pricing_popover{max-width:min(92vw,calc(100vw - 16px))!important;box-sizing:border-box!important}
.dshqb_card_pricing_hint{overflow:visible!important;white-space:normal!important}
.dshqb_trigger.dsh-gw-balance-open .dshqb_popover,.dshqb_pricing_wrap.dsh-gw-balance-open .dshqb_pricing_popover{opacity:1!important;pointer-events:auto!important}
#dsh-gw-theme{margin-top:8px;padding-top:14px;border-top:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.22))}
#dsh-gw-theme h3{margin:0 0 6px;font-size:14px;font-weight:650}
#dsh-gw-theme .dsh-gw-lead{margin:0 0 8px}
.dsh-gw-chips{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 14px}
.dsh-gw-chips button{height:34px;padding:0 12px;border-radius:999px;border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.28));background:transparent;color:inherit;font-size:13px;cursor:pointer}
.dsh-gw-chips button[aria-pressed="true"]{background:rgba(91,140,255,.18);border-color:rgba(91,140,255,.45)}
#dsh-gw-bg-actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
#dsh-gw-bg-actions button,#dsh-gw-bg-actions label{height:34px;padding:0 12px;border-radius:10px;border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.28));background:transparent;color:inherit;font-size:13px;display:inline-flex;align-items:center;cursor:pointer}
#dsh-gw-cyber-cube[data-dsh-gw-on="1"]{outline:2px solid #FCE300;outline-offset:2px}
@media (max-width:720px){
html:not([data-dsh-gw-adapt="web"]) .SKV_cards,html:not([data-dsh-gw-adapt="web"]) .MCP_cards{grid-template-columns:1fr!important}
html:not([data-dsh-gw-adapt="web"]) .SKV_section,html:not([data-dsh-gw-adapt="web"]) .MCP_section{max-width:100%!important}
html:not([data-dsh-gw-adapt="web"]) .SKV_cardTitle,html:not([data-dsh-gw-adapt="web"]) .MCP_name{white-space:normal!important;overflow:visible!important;text-overflow:unset!important;word-break:break-word;font-size:15px!important;line-height:22px!important}
html:not([data-dsh-gw-adapt="web"]) .SKV_meta,html:not([data-dsh-gw-adapt="web"]) .MCP_meta{display:block!important;white-space:normal!important;overflow:visible!important;word-break:break-word;font-size:14px!important;line-height:22px!important}
html:not([data-dsh-gw-adapt="web"]) .SKV_cardContent,html:not([data-dsh-gw-adapt="web"]) .MCP_cardTop{align-items:flex-start!important;flex-wrap:wrap}
html:not([data-dsh-gw-adapt="web"]) .SKV_cardTrailing,html:not([data-dsh-gw-adapt="web"]) .psw-trailing{flex-wrap:wrap}
html:not([data-dsh-gw-adapt="web"]) .SKV_contentBox{max-height:none!important}
html:not([data-dsh-gw-adapt="web"]) .SKV_content{font-size:13px!important;line-height:20px!important}
html:not([data-dsh-gw-adapt="web"]) .MCP_form,html:not([data-dsh-gw-adapt="web"]) .psw-grid,html:not([data-dsh-gw-adapt="web"]) .psw-cards{grid-template-columns:1fr!important}
html:not([data-dsh-gw-adapt="web"]) .SKV_addTarget{max-width:none!important;white-space:normal!important}
html:not([data-dsh-gw-adapt="web"]) .psw-section{max-width:100%!important}
html:not([data-dsh-gw-adapt="web"]) .psw-title{white-space:normal!important;overflow:visible!important;text-overflow:unset!important;word-break:break-word;font-size:15px!important;line-height:22px!important}
html:not([data-dsh-gw-adapt="web"]) .psw-searchRow,html:not([data-dsh-gw-adapt="web"]) .psw-cardHead{flex-wrap:wrap}
html:not([data-dsh-gw-adapt="web"]) .psw-cardHead{align-items:flex-start!important}
html:not([data-dsh-gw-adapt="web"]) .psw-grid dt,html:not([data-dsh-gw-adapt="web"]) .psw-grid dd{font-size:13px!important;line-height:20px!important}
html:not([data-dsh-gw-adapt="web"]) [data-dsh-gw-free-vision]{max-width:100%!important;box-sizing:border-box!important}
html:not([data-dsh-gw-adapt="web"]) [data-dsh-gw-free-vision] [style*="grid-template-columns"]{grid-template-columns:1fr 1fr!important}
html:not([data-dsh-gw-adapt="web"]) [data-dsh-gw-free-vision] [style*="display: flex"]{flex-wrap:wrap!important}
html:not([data-dsh-gw-adapt="web"]) [data-dsh-gw-free-vision] label{white-space:normal!important}
html:not([data-dsh-gw-adapt="web"]) [data-dsh-gw-free-vision] input,html:not([data-dsh-gw-adapt="web"]) [data-dsh-gw-free-vision] textarea{min-width:0!important;max-width:100%!important;box-sizing:border-box!important}
html:not([data-dsh-gw-adapt="web"]) [class*="themeCube"]{flex:1 1 calc(33.33% - 8px)!important;min-width:96px!important;padding:12px 10px!important}
html:not([data-dsh-gw-adapt="web"]) [class*="cubeRow"]{gap:8px!important}
html:not([data-dsh-gw-adapt="web"]) .dshqb_popover,html:not([data-dsh-gw-adapt="web"]) .dshqb_pricing_popover,html:not([data-dsh-gw-adapt="web"]) .dshqb_trigger:hover .dshqb_popover,html:not([data-dsh-gw-adapt="web"]) .dshqb_pricing_wrap:hover .dshqb_pricing_popover,html:not([data-dsh-gw-adapt="web"]) .dshqb_popover:hover,html:not([data-dsh-gw-adapt="web"]) .dshqb_pricing_popover:hover{position:fixed!important;left:8px!important;right:8px!important;bottom:72px!important;width:auto!important;min-width:0!important;max-height:min(70vh,560px)!important;overflow:auto!important;transform:none!important;flex-direction:column!important;opacity:0!important;pointer-events:none!important}
html:not([data-dsh-gw-adapt="web"]) .dshqb_trigger.dshqb_open>.dshqb_popover,html:not([data-dsh-gw-adapt="web"]) .dshqb_trigger.dsh-gw-balance-open>.dshqb_popover,html:not([data-dsh-gw-adapt="web"]) .dshqb_pricing_wrap.dsh-gw-balance-open>.dshqb_pricing_popover,html:not([data-dsh-gw-adapt="web"]) .dshqb_trigger.dsh-gw-balance-open>.dshqb_popover:hover,html:not([data-dsh-gw-adapt="web"]) .dshqb_pricing_wrap.dsh-gw-balance-open>.dshqb_pricing_popover:hover{opacity:1!important;pointer-events:auto!important;transform:none!important;z-index:2147483000!important}
html:not([data-dsh-gw-adapt="web"]) .dshqb_vsep{display:none!important;width:0!important;height:0!important}
html:not([data-dsh-gw-adapt="web"]) .dshqb_col{flex:none!important;width:100%!important;min-width:0!important}
html:not([data-dsh-gw-adapt="web"]) .dshqb_card_pricing_hint{font-size:12px!important;line-height:1.45!important}
}
html[data-dsh-gw-adapt="mobile"] .SKV_cards,html[data-dsh-gw-adapt="mobile"] .MCP_cards{grid-template-columns:1fr!important}
html[data-dsh-gw-adapt="mobile"] .SKV_section,html[data-dsh-gw-adapt="mobile"] .MCP_section,html[data-dsh-gw-adapt="mobile"] .psw-section{max-width:100%!important}
html[data-dsh-gw-adapt="mobile"] .SKV_cardTitle,html[data-dsh-gw-adapt="mobile"] .MCP_name,html[data-dsh-gw-adapt="mobile"] .psw-title{white-space:normal!important;overflow:visible!important;text-overflow:unset!important;word-break:break-word;font-size:15px!important;line-height:22px!important}
html[data-dsh-gw-adapt="mobile"] .MCP_form,html[data-dsh-gw-adapt="mobile"] .psw-cards,html[data-dsh-gw-adapt="mobile"] .psw-grid{grid-template-columns:1fr!important}
html[data-dsh-gw-adapt="mobile"] [class*="themeCube"]{flex:1 1 calc(33.33% - 8px)!important;min-width:96px!important;padding:12px 10px!important}
html[data-dsh-gw-adapt="mobile"] .dshqb_popover,html[data-dsh-gw-adapt="mobile"] .dshqb_pricing_popover,html[data-dsh-gw-adapt="mobile"] .dshqb_trigger:hover .dshqb_popover,html[data-dsh-gw-adapt="mobile"] .dshqb_pricing_wrap:hover .dshqb_pricing_popover{position:fixed!important;left:8px!important;right:8px!important;bottom:72px!important;width:auto!important;min-width:0!important;max-height:min(70vh,560px)!important;overflow:auto!important;transform:none!important;flex-direction:column!important;opacity:0!important;pointer-events:none!important}
html[data-dsh-gw-adapt="mobile"] .dshqb_trigger.dshqb_open>.dshqb_popover,html[data-dsh-gw-adapt="mobile"] .dshqb_trigger.dsh-gw-balance-open>.dshqb_popover,html[data-dsh-gw-adapt="mobile"] .dshqb_pricing_wrap.dsh-gw-balance-open>.dshqb_pricing_popover{opacity:1!important;pointer-events:auto!important;transform:none!important;z-index:2147483000!important}
html[data-dsh-gw-adapt="mobile"] .dshqb_vsep{display:none!important}
html[data-dsh-gw-adapt="mobile"] .dshqb_col{flex:none!important;width:100%!important;min-width:0!important}
html[data-dsh-gw-adapt="mobile"] .dshqb_card_pricing_hint{font-size:12px!important;line-height:1.45!important}
@media (max-width:520px){
html:not([data-dsh-gw-adapt="web"]) [class*="cubeRow"]{flex-direction:column!important}
html:not([data-dsh-gw-adapt="web"]) [class*="themeCube"]{flex:1 1 auto!important;width:100%!important}
html:not([data-dsh-gw-adapt="web"]) [data-dsh-gw-free-vision] [style*="grid-template-columns"]{grid-template-columns:1fr!important}
html:not([data-dsh-gw-adapt="web"]) [data-dsh-gw-free-vision] [style*="display: flex"]{flex-direction:column!important;align-items:stretch!important}
html:not([data-dsh-gw-adapt="web"]) [data-dsh-gw-free-vision] input,html:not([data-dsh-gw-adapt="web"]) [data-dsh-gw-free-vision] textarea{font-size:16px!important}
}
html[data-dsh-gw-adapt="mobile"] [class*="cubeRow"]{flex-direction:column!important}
html[data-dsh-gw-adapt="mobile"] [class*="themeCube"]{flex:1 1 auto!important;width:100%!important}
#dsh-gw-session-delete{color:#e5484d!important}
#dsh-gw-session-dialog{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;padding:24px;background:rgba(8,10,18,.55)}
#dsh-gw-session-dialog .dsh-gw-session-box{width:min(420px,100%);padding:22px 20px 16px;border-radius:16px;background:var(--dsw-alias-bg-primary,#141a2e);color:var(--dsw-alias-label-primary,#eef2ff);border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.28));box-shadow:0 18px 48px rgba(0,0,0,.28)}
#dsh-gw-session-dialog h3{margin:0 0 10px;font-size:17px}
#dsh-gw-session-dialog p{margin:0 0 16px;font-size:14px;line-height:1.55;color:var(--dsw-alias-label-secondary,#93a0c4)}
#dsh-gw-session-dialog .dsh-gw-session-actions{display:flex;justify-content:flex-end;gap:10px}
#dsh-gw-session-dialog button{height:40px;padding:0 16px;border:0;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer}
#dsh-gw-session-cancel{background:var(--dsw-alias-bg-secondary,rgba(127,127,127,.16));color:inherit}
#dsh-gw-session-confirm{background:#e5484d;color:#fff}
#dsh-gw-session-error{margin:12px 0 0;color:#e5484d;font-size:13px}
#dsh-gw-approval-backdrop{position:fixed;inset:0;z-index:2147483600;background:rgba(8,10,16,.52)}
html:not([data-dsh-gw-adapt="web"]) [data-approval-key]{position:fixed!important;left:12px!important;right:12px!important;bottom:max(16px,env(safe-area-inset-bottom))!important;z-index:2147483601!important;max-height:min(72vh,560px)!important;width:auto!important;margin:0!important;overflow:hidden!important}
html:not([data-dsh-gw-adapt="web"]) [data-approval-key] [data-approval-scroll]{max-height:42vh!important;overflow:auto!important;-webkit-overflow-scrolling:touch}
html[data-dsh-gw-adapt="mobile"] [data-approval-key]{position:fixed!important;left:12px!important;right:12px!important;bottom:max(16px,env(safe-area-inset-bottom))!important;z-index:2147483601!important;max-height:min(72vh,560px)!important;width:auto!important;margin:0!important}
</style>
<script id="dsh-gw-hook">
(function () {
  var SETTINGS = ${settings};
  var LOGOUT = ${logout};
  var NAV_ID = "dsh-gw-nav";
  var PANEL_ID = "dsh-gw-panel";

  function endsClass(el, suffix) {
    var list = String(el && el.className || "").split(/\\s+/);
    for (var i = 0; i < list.length; i++) {
      if (list[i].slice(-suffix.length) === suffix) return list[i];
    }
    return "";
  }

  function findSettings() {
    var dialogs = document.querySelectorAll('[aria-modal="true"]');
    for (var i = 0; i < dialogs.length; i++) {
      var nav = dialogs[i].querySelector('[class$="_navList"]');
      if (!nav) continue;
      return {
        dialog: dialogs[i],
        nav: nav,
        options: dialogs[i].querySelector('[class$="_options"]')
      };
    }
    return null;
  }

  function activeClass(nav) {
    var cells = nav.querySelectorAll('[class$="_navCell"]');
    for (var i = 0; i < cells.length; i++) {
      var cls = endsClass(cells[i], "_active");
      if (cls) return cls;
    }
    var sample = nav.querySelector('[class$="_navCell"]');
    var base = sample && endsClass(sample, "_navCell");
    return base ? base.replace(/_navCell$/, "_active") : "";
  }

  function makeNav(nav) {
    if (document.getElementById(NAV_ID)) return;
    var sample = nav.querySelector('[class$="_navCell"]');
    if (!sample) return;
    var cell = sample.cloneNode(true);
    cell.id = NAV_ID;
    cell.removeAttribute("aria-current");
    var act = endsClass(cell, "_active");
    if (act) cell.classList.remove(act);
    var label = cell.querySelector('[class$="_navLabel"]');
    if (label) label.textContent = "网关";
    else cell.textContent = "网关";
    var icon = cell.querySelector("svg");
    if (icon) {
      icon.setAttribute("viewBox", "0 0 16 16");
      icon.setAttribute("width", "16");
      icon.setAttribute("height", "16");
      icon.innerHTML = '<path fill="currentColor" d="M8 1.5A2.5 2.5 0 0 0 5.5 4v1.5H5A1.5 1.5 0 0 0 3.5 7v5A1.5 1.5 0 0 0 5 13.5h6A1.5 1.5 0 0 0 12.5 12V7A1.5 1.5 0 0 0 11 5.5h-.5V4A2.5 2.5 0 0 0 8 1.5Zm-1 4V4a1 1 0 1 1 2 0v1.5h-2Z"/>';
    }
    cell.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      showPanel();
    });
    nav.appendChild(cell);
  }

  function showPanel() {
    var found = findSettings();
    if (!found || !found.options) return;
    var navBtn = document.getElementById(NAV_ID);
    var act = activeClass(found.nav);
    var cells = found.nav.querySelectorAll('[class$="_navCell"]');
    for (var i = 0; i < cells.length; i++) {
      if (act) cells[i].classList.remove(act);
      cells[i].removeAttribute("aria-current");
    }
    if (navBtn) {
      if (act) navBtn.classList.add(act);
      navBtn.setAttribute("aria-current", "true");
      navBtn.setAttribute("data-dsh-gw-active", "1");
    }
    var kids = found.options.children;
    for (var j = 0; j < kids.length; j++) {
      if (kids[j].id !== PANEL_ID) kids[j].setAttribute("data-dsh-gw-hide", "1");
    }
    var panel = document.getElementById(PANEL_ID);
    if (!panel) {
      panel = document.createElement("div");
      panel.id = PANEL_ID;
      panel.innerHTML = '<h2>云端网关</h2><p class="dsh-gw-lead">账号、主题、适配和退出登录。</p><a id="dsh-gw-settings"><div><strong>网关设置</strong><span>改账号、密码、端口和反代</span></div><i>›</i></a><a id="dsh-gw-logout"><div><strong>退出登录</strong><span>清除当前浏览器的登录状态</span></div><i>›</i></a>';
      panel.querySelector("#dsh-gw-settings").href = SETTINGS;
      panel.querySelector("#dsh-gw-logout").href = LOGOUT;
      found.options.appendChild(panel);
    }
  }

  function hidePanel() {
    var navBtn = document.getElementById(NAV_ID);
    if (navBtn) {
      navBtn.removeAttribute("data-dsh-gw-active");
      navBtn.removeAttribute("aria-current");
      var act = endsClass(navBtn, "_active");
      if (act) navBtn.classList.remove(act);
    }
    var panel = document.getElementById(PANEL_ID);
    if (panel) panel.remove();
    var hidden = document.querySelectorAll("[data-dsh-gw-hide]");
    for (var i = 0; i < hidden.length; i++) hidden[i].removeAttribute("data-dsh-gw-hide");
  }

  function onDocClick(event) {
    var target = event.target;
    if (!target || !target.closest) return;
    if (target.closest("#" + NAV_ID)) return;
    if (target.closest('[class$="_navCell"]')) hidePanel();
  }

  var ROOT_APIS = ["/dsh-free-vision", "/plugin-switch", "/dsh-market"];
  function rewriteRootApi(url) {
    if (typeof url !== "string") return url;
    for (var i = 0; i < ROOT_APIS.length; i++) {
      var root = ROOT_APIS[i];
      if (url === root || url.indexOf(root + "/") === 0) return "/dsh" + url;
    }
    return url;
  }

  var rawFetch = window.fetch;
  if (typeof rawFetch === "function" && !window.__dshGwRootApiFetch) {
    window.__dshGwRootApiFetch = true;
    window.fetch = function (input, init) {
      if (typeof input === "string") input = rewriteRootApi(input);
      return rawFetch.call(this, input, init);
    };
  }

  function markFreeVision() {
    var nodes = document.querySelectorAll("h3");
    for (var i = 0; i < nodes.length; i++) {
      var text = String(nodes[i].textContent || "");
      if (text.indexOf("Free Vision") === -1 && text.indexOf("免费视觉") === -1) continue;
      if (nodes[i].parentElement) nodes[i].parentElement.setAttribute("data-dsh-gw-free-vision", "1");
    }
  }

  var themeState = { theme: "system", adapt: "auto", background: "" };
  try {
    themeState.theme = localStorage.getItem("dsh-gw-theme") || "system";
    themeState.adapt = localStorage.getItem("dsh-gw-adapt") || "auto";
  } catch (e) {}

  function isCyberpunkStyle(node) {
    if (!node) return false;
    if (node.getAttribute && node.getAttribute("data-cyberpunk-theme")) return true;
    var css = node.textContent || "";
    if (css.indexOf("color-scheme: dark !important") === -1) return false;
    return css.indexOf("#05070d") !== -1 || css.indexOf("#FCE300") !== -1 || css.indexOf("cp2077") !== -1;
  }

  function rememberTheme(next) {
    themeState.theme = next.theme || themeState.theme;
    themeState.adapt = next.adapt || themeState.adapt;
    if (typeof next.background === "string") themeState.background = next.background;
    try {
      localStorage.setItem("dsh-gw-theme", themeState.theme);
      localStorage.setItem("dsh-gw-adapt", themeState.adapt);
    } catch (e) {}
  }

  function applyWallpaper() {
    var layer = document.getElementById("dsh-gw-wallpaper");
    if (!themeState.background) {
      document.documentElement.removeAttribute("data-dsh-gw-bg");
      if (layer) layer.remove();
      return;
    }
    if (!layer) {
      layer = document.createElement("div");
      layer.id = "dsh-gw-wallpaper";
      document.body.prepend(layer);
    }
    layer.style.backgroundImage = "url(" + JSON.stringify(themeState.background) + ")";
    document.documentElement.setAttribute("data-dsh-gw-bg", "1");
  }

  function applyThemeSkin() {
    var theme = themeState.theme || "system";
    var adapt = themeState.adapt || "auto";
    var light = theme === "light" || (theme === "system" && window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches);
    if (theme === "cyberpunk") light = false;
    document.documentElement.setAttribute("data-dsh-gw-theme", theme);
    document.documentElement.setAttribute("data-dsh-gw-adapt", adapt);
    document.documentElement.setAttribute("data-dsh-gw-light", light ? "1" : "0");
    var enableCyber = theme === "cyberpunk";
    var styles = document.querySelectorAll("style");
    for (var i = 0; i < styles.length; i++) {
      if (isCyberpunkStyle(styles[i])) styles[i].disabled = !enableCyber;
    }
    var extras = document.querySelectorAll("[id^='cp2077-']");
    for (var j = 0; j < extras.length; j++) extras[j].style.display = enableCyber ? "" : "none";
    if (enableCyber) {
      document.documentElement.style.colorScheme = "dark";
      if (document.body) document.body.setAttribute("data-ds-dark-theme", "");
    } else {
      document.documentElement.style.colorScheme = light ? "light" : "dark";
      if (document.body) {
        if (light) document.body.removeAttribute("data-ds-dark-theme");
        else document.body.setAttribute("data-ds-dark-theme", "");
      }
    }
    applyWallpaper();
    syncThemeChips();
    var cube = document.getElementById("dsh-gw-cyber-cube");
    if (cube) cube.setAttribute("data-dsh-gw-on", enableCyber ? "1" : "0");
    try { window.dispatchEvent(new CustomEvent("dsh-gw-theme", { detail: { theme: theme, light: light } })); } catch (e) {}
  }

  function clickOfficialTheme(theme) {
    if (theme === "cyberpunk") return;
    var cubes = document.querySelectorAll("[class*='themeCube']");
    for (var i = 0; i < cubes.length; i++) {
      if (cubes[i].id === "dsh-gw-cyber-cube") continue;
      var text = String(cubes[i].textContent || "");
      var hit = (theme === "light" && (text.indexOf("浅色") !== -1 || /Light/i.test(text)))
        || (theme === "dark" && (text.indexOf("深色") !== -1 || /Dark/i.test(text)))
        || (theme === "system" && (text.indexOf("跟随") !== -1 || /System/i.test(text)));
      if (hit) {
        window.__dshGwThemeApplying = true;
        cubes[i].click();
        window.__dshGwThemeApplying = false;
        return;
      }
    }
  }

  function saveTheme(patch, reloadAdapt) {
    var prevAdapt = themeState.adapt;
    rememberTheme(patch);
    applyThemeSkin();
    if (patch.theme && patch.theme !== "cyberpunk") clickOfficialTheme(patch.theme);
    fetch("/api/dsh-gw-theme", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ theme: themeState.theme, adapt: themeState.adapt })
    }).catch(function () {}).finally(function () {
      if (reloadAdapt && patch.adapt && patch.adapt !== prevAdapt) location.reload();
    });
  }

  function loadTheme() {
    fetch("/api/dsh-gw-theme", { credentials: "same-origin" }).then(function (res) {
      return res.ok ? res.json() : null;
    }).then(function (data) {
      if (!data) return;
      rememberTheme({
        theme: data.theme,
        background: data.background,
        adapt: themeState.adapt || data.adapt
      });
      applyThemeSkin();
    }).catch(function () {});
  }

  function syncThemeChips() {
    var root = document.getElementById("dsh-gw-theme");
    if (!root) return;
    var buttons = root.querySelectorAll("[data-dsh-gw-theme],[data-dsh-gw-adapt]");
    for (var i = 0; i < buttons.length; i++) {
      var theme = buttons[i].getAttribute("data-dsh-gw-theme");
      var adapt = buttons[i].getAttribute("data-dsh-gw-adapt");
      var on = theme ? theme === themeState.theme : adapt === themeState.adapt;
      buttons[i].setAttribute("aria-pressed", on ? "true" : "false");
    }
  }

  function chipRow(id, pairs, attr) {
    var wrap = document.createElement("div");
    wrap.className = "dsh-gw-chips";
    wrap.id = id;
    for (var i = 0; i < pairs.length; i++) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.setAttribute(attr, pairs[i][0]);
      btn.textContent = pairs[i][1];
      wrap.appendChild(btn);
    }
    return wrap;
  }

  var themeBox = null;
  function enhanceGatewayPanel() {
    var page = document.querySelector("[data-dsh-theme-page]");
    if (!page) {
      if (themeBox && themeBox.parentNode) themeBox.parentNode.removeChild(themeBox);
      return;
    }
    if (themeBox && themeBox.nextElementSibling === page) return;
    if (!themeBox) {
    var box = document.createElement("div");
    box.id = "dsh-gw-theme";
    box.innerHTML = "<h3>主题管理</h3><p class=\\"dsh-gw-lead\\">浅色、深色和原来的夜之城互不覆盖，只启用当前这一套。</p>";
    box.appendChild(chipRow("dsh-gw-theme-chips", [["light", "浅色"], ["dark", "深色"], ["system", "跟随系统"], ["cyberpunk", "夜之城"]], "data-dsh-gw-theme"));
    var adaptTitle = document.createElement("h3");
    adaptTitle.textContent = "界面适配";
    var adaptLead = document.createElement("p");
    adaptLead.className = "dsh-gw-lead";
    adaptLead.textContent = "手机端强制竖屏适配，网页端保持电脑布局。改适配会刷新一次。";
    box.appendChild(adaptTitle);
    box.appendChild(adaptLead);
    box.appendChild(chipRow("dsh-gw-adapt-chips", [["auto", "自动"], ["mobile", "手机端"], ["web", "网页端"]], "data-dsh-gw-adapt"));
    var bgTitle = document.createElement("h3");
    bgTitle.textContent = "背景图";
    var bgLead = document.createElement("p");
    bgLead.className = "dsh-gw-lead";
    bgLead.textContent = "按手机全屏铺满。可和当前主题叠在一起。";
    var actions = document.createElement("div");
    actions.id = "dsh-gw-bg-actions";
    var pick = document.createElement("label");
    pick.textContent = "上传图片";
    var file = document.createElement("input");
    file.type = "file";
    file.accept = "image/png,image/jpeg,image/webp,image/gif";
    file.style.display = "none";
    pick.appendChild(file);
    var clear = document.createElement("button");
    clear.type = "button";
    clear.textContent = "清除背景";
    actions.appendChild(pick);
    actions.appendChild(clear);
    box.appendChild(bgTitle);
    box.appendChild(bgLead);
    box.appendChild(actions);
    box.addEventListener("click", function (event) {
      var btn = event.target.closest("button");
      if (!btn || !box.contains(btn)) return;
      if (btn.getAttribute("data-dsh-gw-theme")) saveTheme({ theme: btn.getAttribute("data-dsh-gw-theme") }, false);
      if (btn.getAttribute("data-dsh-gw-adapt")) saveTheme({ adapt: btn.getAttribute("data-dsh-gw-adapt") }, true);
    });
    file.addEventListener("change", function () {
      var item = file.files && file.files[0];
      if (!item) return;
      var reader = new FileReader();
      reader.onload = function () {
        var raw = String(reader.result || "");
        var comma = raw.indexOf(",");
        fetch("/api/dsh-gw-theme-bg", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ name: item.name, base64: comma >= 0 ? raw.slice(comma + 1) : raw })
        }).then(function (res) { return res.json(); }).then(function (data) {
          if (data && data.background) {
            rememberTheme(data);
            applyThemeSkin();
          }
        }).catch(function () {});
        file.value = "";
      };
      reader.readAsDataURL(item);
    });
    clear.addEventListener("click", function () {
      fetch("/api/dsh-gw-theme-bg", { method: "DELETE", credentials: "same-origin" }).then(function (res) {
        return res.json();
      }).then(function (data) {
        rememberTheme({ background: "" });
        if (data) rememberTheme(data);
        applyThemeSkin();
      }).catch(function () {
        rememberTheme({ background: "" });
        applyThemeSkin();
      });
    });
    syncThemeChips();
      themeBox = box;
    }
    if (themeBox.parentNode !== page.parentNode || themeBox.nextElementSibling !== page) {
      page.parentNode.insertBefore(themeBox, page);
    }
  }

  function enhanceAppearanceCubes() {
    return;
    var row = document.querySelector("[class*='cubeRow']");
    if (!row || document.getElementById("dsh-gw-cyber-cube")) return;
    var sample = row.querySelector("[class*='themeCube']");
    if (!sample) return;
    var cube = sample.cloneNode(true);
    cube.id = "dsh-gw-cyber-cube";
    cube.className = String(sample.className || "").replace(/selected/g, "").trim();
    cube.textContent = "夜之城";
    cube.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      saveTheme({ theme: "cyberpunk" }, false);
    }, true);
    row.appendChild(cube);
    if (themeState.theme && themeState.theme !== "cyberpunk") clickOfficialTheme(themeState.theme);
    row.addEventListener("click", function (event) {
      if (window.__dshGwThemeApplying) return;
      var target = event.target.closest("[class*='themeCube']");
      if (!target || target.id === "dsh-gw-cyber-cube") return;
      var text = String(target.textContent || "");
      if (text.indexOf("浅色") !== -1 || /Light/i.test(text)) saveTheme({ theme: "light" }, false);
      else if (text.indexOf("深色") !== -1 || /Dark/i.test(text)) saveTheme({ theme: "dark" }, false);
      else if (text.indexOf("跟随") !== -1 || /System/i.test(text)) saveTheme({ theme: "system" }, false);
    }, true);
  }

  function wantsMobileChrome() {
    var adapt = document.documentElement.getAttribute("data-dsh-gw-adapt") || "auto";
    if (adapt === "web") return false;
    if (adapt === "mobile") return true;
    return window.matchMedia && window.matchMedia("(max-width: 720px)").matches;
  }

  function enhanceApproval() {
    var panel = document.querySelector("[data-approval-key]");
    var backdrop = document.getElementById("dsh-gw-approval-backdrop");
    if (!panel || !wantsMobileChrome()) {
      if (backdrop) backdrop.remove();
      return;
    }
    if (!backdrop) {
      backdrop = document.createElement("div");
      backdrop.id = "dsh-gw-approval-backdrop";
      document.body.appendChild(backdrop);
    }
  }

  function ownBalancePopover(host) {
    if (!host) return null;
    if (host.classList.contains("dshqb_pricing_wrap")) return host.querySelector(":scope > .dshqb_pricing_popover");
    return host.querySelector(":scope > .dshqb_popover");
  }

  function placeBalancePopover(host, on) {
    var pop = ownBalancePopover(host);
    if (!pop) return;
    if (!on) {
      pop.style.position = "";
      pop.style.left = "";
      pop.style.right = "";
      pop.style.top = "";
      pop.style.bottom = "";
      pop.style.width = "";
      pop.style.transform = "";
      pop.style.opacity = "";
      pop.style.pointerEvents = "";
      pop.style.zIndex = "";
      return;
    }
    pop.style.position = "fixed";
    pop.style.transform = "none";
    pop.style.opacity = "1";
    pop.style.pointerEvents = "auto";
    pop.style.zIndex = "2147483000";
    pop.style.left = "8px";
    pop.style.right = "8px";
    pop.style.bottom = "72px";
    pop.style.top = "auto";
    pop.style.width = "auto";
  }

  function enhanceBalancePopover() {
    var nodes = document.querySelectorAll(".dshqb_trigger, .dshqb_pricing_wrap");
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].getAttribute("data-dsh-gw-balance") === "1") continue;
      nodes[i].setAttribute("data-dsh-gw-balance", "1");
      nodes[i].addEventListener("click", function (event) {
        var host = event.currentTarget;
        if (!wantsMobileChrome()) return;
        if (event.target.closest(".dshqb_dot_btn, a, button.dshqb_btn, .dshqb_card_settings_link")) return;
        if (host.classList.contains("dshqb_trigger") && event.target.closest(".dshqb_pricing_wrap")) return;
        event.stopPropagation();
        var open = host.classList.contains("dsh-gw-balance-open");
        var all = document.querySelectorAll(".dsh-gw-balance-open");
        for (var j = 0; j < all.length; j++) {
          all[j].classList.remove("dsh-gw-balance-open");
          placeBalancePopover(all[j], false);
        }
        if (!open) {
          host.classList.add("dsh-gw-balance-open");
          placeBalancePopover(host, true);
        }
      });
    }
  }

  function isSessionId(id) {
    return typeof id === "string" && /^session-[A-Za-z0-9._-]+$/.test(id);
  }

  function sessionIdFromRow(row) {
    if (!row) return "";
    var cur = row;
    for (var depth = 0; cur && depth < 8; cur = cur.parentElement, depth++) {
      var keys = Object.keys(cur);
      for (var i = 0; i < keys.length; i++) {
        if (keys[i].indexOf("__reactFiber") !== 0 && keys[i].indexOf("__reactInternalInstance") !== 0) continue;
        var fiber = cur[keys[i]];
        for (var hop = 0; fiber && hop < 50; fiber = fiber.return, hop++) {
          var props = fiber.memoizedProps || fiber.pendingProps || {};
          if (isSessionId(props && props.node && props.node.id)) return props.node.id;
          if (isSessionId(props.sessionId)) return props.sessionId;
          if (props.drag && isSessionId(props.drag.sessionId)) return props.drag.sessionId;
        }
      }
    }
    return "";
  }

  function openSessionRow() {
    var rows = document.querySelectorAll('[role="treeitem"]');
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i].className || "").indexOf("menuOpen") !== -1) return rows[i];
    }
    return null;
  }

  function rowTitle(row) {
    if (!row) return "";
    var title = row.querySelector('[class*="title"]');
    return String(title && title.textContent || row.textContent || "").replace(/\\s+/g, " ").trim();
  }

  function menuItemByLabel(label) {
    var groups = [document.querySelectorAll('[role="menuitem"]'), document.querySelectorAll("button")];
    for (var g = 0; g < groups.length; g++) {
      for (var i = 0; i < groups[g].length; i++) {
        var text = String(groups[g][i].textContent || "").replace(/\\s+/g, " ").trim();
        if (text === label) return groups[g][i];
      }
    }
    var nodes = document.querySelectorAll("span,div,li");
    for (var j = 0; j < nodes.length; j++) {
      if (nodes[j].childElementCount > 2) continue;
      if (String(nodes[j].textContent || "").replace(/\\s+/g, " ").trim() !== label) continue;
      return nodes[j].closest('[role="menuitem"]') || nodes[j].closest("button") || nodes[j];
    }
    return null;
  }

  function setMenuLabel(el, fromLabels, toLabel) {
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    var node;
    var changed = false;
    while ((node = walker.nextNode())) {
      var value = String(node.nodeValue || "").trim();
      for (var i = 0; i < fromLabels.length; i++) {
        if (value === fromLabels[i]) {
          node.nodeValue = toLabel;
          changed = true;
        }
      }
    }
    if (!changed) el.appendChild(document.createTextNode(toLabel));
  }

  function closeDeleteDialog() {
    var dialog = document.getElementById("dsh-gw-session-dialog");
    if (dialog) dialog.remove();
    document.removeEventListener("keydown", onDeleteDialogKey, true);
  }

  function onDeleteDialogKey(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeDeleteDialog();
    }
  }

  function openDeleteDialog(sessionId, title) {
    closeDeleteDialog();
    var overlay = document.createElement("div");
    overlay.id = "dsh-gw-session-dialog";
    var box = document.createElement("div");
    box.className = "dsh-gw-session-box";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    var heading = document.createElement("h3");
    heading.textContent = "删除会话";
    var msg = document.createElement("p");
    msg.textContent = "确定删除「" + (title || "这个会话") + "」吗？删除后无法恢复。";
    var actions = document.createElement("div");
    actions.className = "dsh-gw-session-actions";
    var cancel = document.createElement("button");
    cancel.type = "button";
    cancel.id = "dsh-gw-session-cancel";
    cancel.textContent = "取消";
    var confirm = document.createElement("button");
    confirm.type = "button";
    confirm.id = "dsh-gw-session-confirm";
    confirm.textContent = "删除";
    var error = document.createElement("p");
    error.id = "dsh-gw-session-error";
    actions.appendChild(cancel);
    actions.appendChild(confirm);
    box.appendChild(heading);
    box.appendChild(msg);
    box.appendChild(actions);
    box.appendChild(error);
    overlay.appendChild(box);
    overlay.addEventListener("click", function (event) {
      if (event.target === overlay) closeDeleteDialog();
    });
    cancel.addEventListener("click", closeDeleteDialog);
    confirm.addEventListener("click", function () {
      if (!sessionId) {
        error.textContent = "找不到这个会话，请关掉菜单再试一次。";
        return;
      }
      cancel.disabled = true;
      confirm.disabled = true;
      confirm.textContent = "正在删除…";
      error.textContent = "";
      var archive = window.__dshGwArchiveSession;
      var afterArchive = function () {
        fetch("/api/dsh-gw-session-delete", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ sessionId: sessionId })
        }).then(function (res) {
          return res.json().then(function (data) {
            return { res: res, data: data };
          }).catch(function () {
            return { res: res, data: {} };
          });
        }).then(function (result) {
          if (!result.res.ok || !result.data.ok) {
            cancel.disabled = false;
            confirm.disabled = false;
            confirm.textContent = "删除";
            error.textContent = result.data.reason === "not_found" ? "会话已经不在了。" : "删除失败，请稍后重试。";
            return;
          }
          closeDeleteDialog();
          hideSessionRow(sessionId, title);
        }).catch(function () {
          cancel.disabled = false;
          confirm.disabled = false;
          confirm.textContent = "删除";
          error.textContent = "删除失败，请稍后重试。";
        });
      };
      if (typeof archive === "function") {
        Promise.resolve(archive(sessionId)).catch(function () {}).then(afterArchive);
      } else {
        afterArchive();
      }
    });
    document.body.appendChild(overlay);
    document.addEventListener("keydown", onDeleteDialogKey, true);
    cancel.focus();
  }

  function hideSessionRow(sessionId, title) {
    var rows = document.querySelectorAll('[role="treeitem"]');
    var i;
    for (i = 0; i < rows.length; i++) {
      if (sessionId && sessionIdFromRow(rows[i]) === sessionId) {
        rows[i].remove();
        return;
      }
    }
    if (!title) return;
    for (i = 0; i < rows.length; i++) {
      if (rowTitle(rows[i]) === title) {
        rows[i].remove();
        return;
      }
    }
  }

  function enhanceSessionMenu() {
    if (document.getElementById("dsh-gw-session-delete")) return;
    var archive = menuItemByLabel("归档会话") || menuItemByLabel("Archive session");
    if (!archive) return;
    var item = archive.closest('[role="menuitem"]') || archive;
    var menu = item.parentElement;
    if (!menu) return;
    var row = openSessionRow();
    var btn = item.cloneNode(true);
    btn.id = "dsh-gw-session-delete";
    btn.removeAttribute("aria-checked");
    setMenuLabel(btn, ["归档会话", "Archive session"], "删除会话");
    btn.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
      openDeleteDialog(sessionIdFromRow(row) || sessionIdFromRow(openSessionRow()), rowTitle(row));
    }, true);
    menu.appendChild(btn);
  }

  function tick() {
    var found = findSettings();
    if (found) {
      makeNav(found.nav);
      var navBtn = document.getElementById(NAV_ID);
      if (navBtn && navBtn.getAttribute("data-dsh-gw-active") === "1" && !document.getElementById(PANEL_ID)) {
        showPanel();
      }
    }
    markFreeVision();
    enhanceGatewayPanel();
    enhanceAppearanceCubes();
    enhanceBalancePopover();
    enhanceApproval();
    applyThemeSkin();
    enhanceSessionMenu();
  }

  document.addEventListener("click", onDocClick, true);
  document.addEventListener("click", function (event) {
    if (!event.target.closest || event.target.closest(".dshqb_trigger, .dshqb_pricing_wrap, .dshqb_popover, .dshqb_pricing_popover")) return;
    var open = document.querySelectorAll(".dsh-gw-balance-open");
    for (var i = 0; i < open.length; i++) {
      open[i].classList.remove("dsh-gw-balance-open");
      placeBalancePopover(open[i], false);
    }
  });
  new MutationObserver(tick).observe(document.documentElement, { childList: true, subtree: true });
  loadTheme();
  applyThemeSkin();
  tick();
})();
</script>`;
}
