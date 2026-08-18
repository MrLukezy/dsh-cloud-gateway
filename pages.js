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
      panel.innerHTML = '<h2>云端网关</h2><p class="dsh-gw-lead">账号、端口和退出登录。</p><a id="dsh-gw-settings"><div><strong>网关设置</strong><span>改账号、密码、端口和反代</span></div><i>›</i></a><a id="dsh-gw-logout"><div><strong>退出登录</strong><span>清除当前浏览器的登录状态</span></div><i>›</i></a>';
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

  function tick() {
    var found = findSettings();
    if (!found) return;
    makeNav(found.nav);
    var navBtn = document.getElementById(NAV_ID);
    if (navBtn && navBtn.getAttribute("data-dsh-gw-active") === "1" && !document.getElementById(PANEL_ID)) {
      showPanel();
    }
  }

  document.addEventListener("click", onDocClick, true);
  new MutationObserver(tick).observe(document.documentElement, { childList: true, subtree: true });
  tick();
})();
</script>`;
}
