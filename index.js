import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import os from "node:os";
import Schema from "@deepseek-ai/schemastery";

export const name = "dsh-cloud-gateway";
export const inject = ["webStartup"];

const COOKIE = "dsh_gw";
const MAX_AGE = 7 * 24 * 3600;
const LOGIN_BODY_LIMIT = 8 * 1024;
const HTML_INJECT_LIMIT = 2 * 1024 * 1024;
const PUBLIC_PATHS = new Set(["/favicon.svg", "/favicon.ico", "/manifest.webmanifest"]);
const STATE_FILE = "cloud-gateway-state.json";
const UUID_POLYFILL = `<script>(function(){try{var c=globalThis.crypto;if(!c||typeof c.randomUUID==="function")return;if(typeof c.getRandomValues!=="function")return;c.randomUUID=function(){var b=new Uint8Array(16);c.getRandomValues(b);b[6]=b[6]&15|64;b[8]=b[8]&63|128;var h=[];for(var j=0;j<16;j++)h.push((b[j]>>4).toString(16)+(b[j]&15).toString(16));return h[0]+h[1]+h[2]+h[3]+"-"+h[4]+h[5]+"-"+h[6]+h[7]+"-"+h[8]+h[9]+"-"+h[10]+h[11]+h[12]+h[13]+h[14]+h[15]};}catch(e){}})();</script>`;

export const Config = Schema.object({
  listenHost: Schema.string().default("0.0.0.0").description("Public bind address"),
  listenPort: Schema.number().min(1).max(65535).default(8080).description("Public port; keep this different from dsh web"),
  basePath: Schema.string().default("/dsh").description("Public path prefix"),
  username: Schema.string().default("admin").description("Login username"),
  password: Schema.string().description("Login password. Leave empty to generate and persist one"),
  secret: Schema.string().description("Session HMAC secret. Leave empty to persist a generated secret"),
  upstreamHost: Schema.string().description("Local Harness host; defaults to webStartup.host"),
  upstreamPort: Schema.number().min(1).max(65535).description("Local Harness port; defaults to webStartup.port"),
  trustProxy: Schema.boolean().default(false).description("Trust X-Forwarded-For / X-Forwarded-Proto only behind a known reverse proxy"),
  secureCookie: Schema.boolean().description("Force Secure cookies. Leave empty to enable only when the request is HTTPS"),
  cookiePath: Schema.string().default("/").description("Cookie path. Use / if /assets /plugins /api stay at the site root"),
});

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}

function normalizeBasePath(value) {
  let basePath = String(value || "/dsh").trim();
  if (!basePath.startsWith("/")) basePath = `/${basePath}`;
  basePath = basePath.replace(/\/+$/, "") || "/dsh";
  if (!/^\/[A-Za-z0-9._~-]+(?:\/[A-Za-z0-9._~-]+)*$/.test(basePath)) {
    throw new Error("basePath must be a safe URL path such as /dsh");
  }
  return basePath;
}

function dshHome() {
  return process.env.DSH_HOME || path.join(os.homedir(), ".dsh");
}

function statePath() {
  return path.join(dshHome(), STATE_FILE);
}

function readState() {
  try {
    return JSON.parse(fs.readFileSync(statePath(), "utf8"));
  } catch {
    return {};
  }
}

function writeState(state) {
  const file = statePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  try {
    fs.chmodSync(file, 0o600);
  } catch {
    // Windows may ignore mode; keep going.
  }
}

function generatePassword() {
  return crypto.randomBytes(18).toString("base64url");
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt.toString("hex")}$${hash.toString("hex")}`;
}

function verifyPassword(password, stored) {
  const [algo, n, r, p, salt, hash] = String(stored).split("$");
  if (algo !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  if (!expected.length) return false;
  const derived = crypto.scryptSync(password, Buffer.from(salt, "hex"), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });
  return derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
}

function guessPublicUrls(port, basePath) {
  const urls = [];
  for (const nets of Object.values(os.networkInterfaces())) {
    for (const net of nets || []) {
      const family = net.family === "IPv4" || net.family === 4;
      if (!family || net.internal) continue;
      urls.push(`http://${net.address}:${port}${basePath}`);
    }
  }
  return urls;
}

function loginPage(basePath, error) {
  const action = escapeHtml(`${basePath}/login`);
  const message = error ? `<p class="error">${escapeHtml(error)}</p>` : "";
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>登录 · DeepSeek Harness</title>
  <style>
    :root { --bg:#0b1020; --line:#2a3354; --text:#eef2ff; --muted:#93a0c4; --accent:#5b8cff; --danger:#ff7b8a; }
    * { box-sizing: border-box; }
    html, body { height: 100%; margin: 0; }
    body { font-family: "Segoe UI","PingFang SC","Microsoft YaHei",sans-serif; color: var(--text); background: var(--bg); display: grid; place-items: center; padding: 24px; }
    .shell { width: min(420px, 100%); }
    h1 { margin: 0; font-size: 22px; }
    .sub { margin: 4px 0 18px; color: var(--muted); font-size: 13px; }
    .card { background: #141a2e; border: 1px solid var(--line); border-radius: 18px; padding: 28px 24px; }
    label { display: block; margin: 14px 0 8px; color: var(--muted); font-size: 13px; }
    input { width: 100%; height: 44px; border: 1px solid var(--line); border-radius: 12px; background: #0e1426; color: var(--text); padding: 0 14px; }
    button { width: 100%; height: 46px; margin-top: 22px; border: 0; border-radius: 12px; background: var(--accent); color: white; font-size: 15px; font-weight: 600; }
    .error { color: var(--danger); font-size: 13px; }
  </style>
</head>
<body>
  <div class="shell">
    <h1>DeepSeek Harness</h1>
    <p class="sub">云端入口，登录后进入工作台</p>
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

function clientIp(req, trustProxy) {
  if (trustProxy) {
    const forwarded = req.headers["x-forwarded-for"];
    if (forwarded) return String(forwarded).split(",")[0].trim() || "unknown";
  }
  return req.socket.remoteAddress || "unknown";
}

function isHttps(req, trustProxy) {
  if (req.socket?.encrypted) return true;
  if (!trustProxy) return false;
  return String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim() === "https";
}

function requestUrl(req) {
  try {
    return new URL(req.url || "/", "http://127.0.0.1");
  } catch {
    return new URL("/", "http://127.0.0.1");
  }
}

function parseBody(req, limit = LOGIN_BODY_LIMIT) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        req.destroy();
        reject(new Error("body too large"));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function writeProxyHead(socket, res) {
  socket.write(`HTTP/${res.httpVersion} ${res.statusCode} ${res.statusMessage}\r\n`);
  for (const [key, value] of Object.entries(res.headers)) {
    if (value == null) continue;
    if (Array.isArray(value)) {
      for (const item of value) socket.write(`${key}: ${item}\r\n`);
    } else {
      socket.write(`${key}: ${value}\r\n`);
    }
  }
  socket.write("\r\n");
}

function proxyHeaders(req) {
  const headers = { ...req.headers, "accept-encoding": "identity" };
  delete headers.connection;
  delete headers["keep-alive"];
  delete headers["proxy-connection"];
  return headers;
}

function startGateway(options) {
  const {
    listenHost,
    listenPort,
    basePath,
    username,
    passwordHash,
    secret,
    upstream,
    trustProxy,
    secureCookie,
    cookiePath,
  } = options;
  const loginPath = `${basePath}/login`;
  const logoutPath = `${basePath}/logout`;
  const appPath = `${basePath}/`;
  const loginAttempts = new Map();
  const target = new URL(upstream);

  function sign(payload) {
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
    return `${body}.${sig}`;
  }

  function verify(token) {
    if (!token) return null;
    const [body, sig] = String(token).split(".");
    if (!body || !sig) return null;
    const expected = crypto.createHmac("sha256", secret).update(body).digest("base64url");
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!payload?.u || payload.exp < Date.now()) return null;
    return payload;
  }

  function getCookie(req, name) {
    for (const part of String(req.headers.cookie || "").split(";")) {
      const [key, ...rest] = part.trim().split("=");
      if (key === name) return decodeURIComponent(rest.join("="));
    }
    return null;
  }

  function sessionUser(req) {
    try {
      return verify(getCookie(req, COOKIE))?.u || null;
    } catch {
      return null;
    }
  }

  function tooMany(ip) {
    const now = Date.now();
    if (loginAttempts.size > 2000) {
      for (const [key, rec] of loginAttempts) {
        if (now - rec.t > 10 * 60 * 1000) loginAttempts.delete(key);
      }
    }
    const rec = loginAttempts.get(ip);
    if (!rec || now - rec.t > 10 * 60 * 1000) {
      loginAttempts.set(ip, { n: 1, t: now });
      return false;
    }
    rec.n += 1;
    return rec.n > 10;
  }

  function cookieHeader(req, token, maxAge) {
    const parts = [
      `${COOKIE}=${token}`,
      `Path=${cookiePath || "/"}`,
      "HttpOnly",
      "SameSite=Lax",
      `Max-Age=${maxAge}`,
    ];
    if (secureCookie === true || (secureCookie !== false && isHttps(req, trustProxy))) {
      parts.push("Secure");
    }
    return parts.join("; ");
  }

  function stripBase(pathname) {
    if (pathname === basePath) return "/";
    if (pathname.startsWith(`${basePath}/`)) return pathname.slice(basePath.length) || "/";
    return pathname;
  }

  function rewriteUpstreamUrl(req) {
    const url = requestUrl(req);
    req.url = stripBase(url.pathname || "/") + url.search;
  }

  function injectHtml(body) {
    if (body.includes("<head>") && !body.includes("c.randomUUID=function")) {
      body = body.replace("<head>", `<head>${UUID_POLYFILL}`);
    }
    if (!body.includes('id="dsh-gw-logout"')) {
      const safeLogout = escapeHtml(logoutPath);
      const bar = `<style>#dsh-gw-logout{position:fixed;right:16px;bottom:24px;z-index:2147483647;display:inline-flex;align-items:center;height:40px;padding:0 14px;border-radius:999px;background:#1f2937;color:#fff;font:600 14px/1 sans-serif;text-decoration:none}</style><a id="dsh-gw-logout" href="${safeLogout}">退出登录</a>`;
      body = body.includes("</body>") ? body.replace("</body>", `${bar}</body>`) : body + bar;
    }
    return body;
  }

  function proxyWeb(req, res) {
    rewriteUpstreamUrl(req);
    const proxyReq = http.request({
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || 80,
      method: req.method,
      path: req.url,
      headers: proxyHeaders(req),
    }, (proxyRes) => {
      const contentType = String(proxyRes.headers["content-type"] || "");
      if (!contentType.includes("text/html")) {
        res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
        proxyRes.pipe(res);
        return;
      }
      const chunks = [];
      let size = 0;
      let overflow = false;
      proxyRes.on("data", (chunk) => {
        size += chunk.length;
        if (size > HTML_INJECT_LIMIT) overflow = true;
        if (!overflow) chunks.push(chunk);
      });
      proxyRes.on("end", () => {
        if (overflow) {
          res.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
          res.end("上游页面过大");
          return;
        }
        const headers = { ...proxyRes.headers };
        delete headers["content-length"];
        delete headers["content-encoding"];
        res.writeHead(proxyRes.statusCode || 200, headers);
        res.end(injectHtml(Buffer.concat(chunks).toString("utf8")));
      });
      proxyRes.on("error", () => {
        if (!res.headersSent) {
          res.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
        }
        res.end();
      });
    });
    proxyReq.on("error", (err) => {
      console.error("[dsh-cloud-gateway] proxy error", err.message);
      if (!res.headersSent) {
        res.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
        res.end("上游 DeepSeek Harness 暂时不可用");
      } else {
        res.destroy();
      }
    });
    req.pipe(proxyReq);
  }

  function proxyUpgrade(req, socket, head) {
    rewriteUpstreamUrl(req);
    const proxyReq = http.request({
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || 80,
      method: "GET",
      path: req.url,
      headers: req.headers,
    });
    proxyReq.on("upgrade", (proxyRes, proxySocket, proxyHead) => {
      writeProxyHead(socket, proxyRes);
      if (proxyHead?.length) proxySocket.unshift(proxyHead);
      if (head?.length) socket.unshift(head);
      proxySocket.pipe(socket);
      socket.pipe(proxySocket);
    });
    proxyReq.on("response", (proxyRes) => {
      writeProxyHead(socket, proxyRes);
      proxyRes.pipe(socket);
    });
    proxyReq.on("error", () => socket.destroy());
    socket.on("error", () => proxyReq.destroy());
    proxyReq.end();
  }

  function sendLogin(res, error = "") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    res.end(loginPage(basePath, error));
  }

  const server = http.createServer(async (req, res) => {
    const pathname = requestUrl(req).pathname || "/";

    if (pathname === "/" || pathname === "/login" || pathname === "/logout") {
      const next = pathname === "/logout" ? logoutPath : pathname === "/login" ? loginPath : basePath;
      res.writeHead(302, { location: next });
      res.end();
      return;
    }

    if (pathname === basePath) {
      res.writeHead(302, { location: appPath });
      res.end();
      return;
    }

    if (pathname === logoutPath) {
      res.writeHead(302, { location: loginPath, "set-cookie": cookieHeader(req, "", 0) });
      res.end();
      return;
    }

    if (pathname === loginPath && (req.method === "GET" || req.method === "HEAD")) {
      if (sessionUser(req)) {
        res.writeHead(302, { location: appPath });
        res.end();
        return;
      }
      if (req.method === "HEAD") {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
        res.end();
        return;
      }
      sendLogin(res);
      return;
    }

    if (pathname === loginPath && req.method === "POST") {
      const ip = clientIp(req, trustProxy);
      if (tooMany(ip)) {
        sendLogin(res, "尝试次数过多，请 10 分钟后再试");
        return;
      }
      let params;
      try {
        params = new URLSearchParams(await parseBody(req));
      } catch {
        res.writeHead(413, { "content-type": "text/plain; charset=utf-8" });
        res.end("请求过大");
        return;
      }
      const user = (params.get("username") || "").trim();
      const pass = params.get("password") || "";
      if (user !== username || !verifyPassword(pass, passwordHash)) {
        sendLogin(res, "账号或密码错误");
        return;
      }
      const token = sign({ u: user, exp: Date.now() + MAX_AGE * 1000 });
      res.writeHead(302, { location: appPath, "set-cookie": cookieHeader(req, token, MAX_AGE) });
      res.end();
      return;
    }

    if (PUBLIC_PATHS.has(pathname) && (req.method === "GET" || req.method === "HEAD")) {
      proxyWeb(req, res);
      return;
    }

    if (!sessionUser(req)) {
      if (req.method === "GET" || req.method === "HEAD") {
        res.writeHead(302, { location: loginPath });
        res.end();
        return;
      }
      res.writeHead(401, { "content-type": "text/plain; charset=utf-8" });
      res.end("未登录");
      return;
    }

    proxyWeb(req, res);
  });

  server.on("upgrade", (req, socket, head) => {
    if (!sessionUser(req)) {
      socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }
    proxyUpgrade(req, socket, head);
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(listenPort, listenHost, () => {
      const urls = guessPublicUrls(listenPort, basePath);
      console.log(`[dsh-cloud-gateway] login wall on http://${listenHost}:${listenPort}${basePath} -> ${upstream}`);
      for (const url of urls) console.log(`[dsh-cloud-gateway] try ${url}`);
      resolve(server);
    });
  });
}

function resolveCredentials(config) {
  const username = String(process.env.DSH_CLOUD_USERNAME || config.username || "admin").trim() || "admin";
  const configured = process.env.DSH_CLOUD_PASSWORD || config.password || "";
  const state = readState();
  let password = configured;
  let generated = false;

  if (!password) {
    if (state.generatedPassword) {
      password = state.generatedPassword;
    } else {
      password = generatePassword();
      generated = true;
    }
  } else if (password.length < 8) {
    console.warn("[dsh-cloud-gateway] configured password is shorter than 8 characters");
  }

  const secret = process.env.DSH_CLOUD_SECRET || config.secret || state.secret || crypto.randomBytes(32).toString("hex");
  const nextState = {
    ...state,
    secret,
    username,
  };
  if (!configured) nextState.generatedPassword = password;
  writeState(nextState);

  if (generated) {
    console.log(`[dsh-cloud-gateway] generated login ${username} / ${password}`);
    console.log(`[dsh-cloud-gateway] credentials stored in ${statePath()}`);
  } else if (!configured) {
    console.log(`[dsh-cloud-gateway] using generated credentials from ${statePath()}`);
  }

  return { username, password, secret };
}

export function apply(ctx, config = {}) {
  const listenHost = config.listenHost || "0.0.0.0";
  const listenPort = Number(config.listenPort || 8080);
  const basePath = normalizeBasePath(config.basePath || "/dsh");
  const upstreamHost = config.upstreamHost || ctx.webStartup?.host || "127.0.0.1";
  const upstreamPort = Number(config.upstreamPort || ctx.webStartup?.port || 3080);
  const trustProxy = Boolean(config.trustProxy);
  const cookiePath = config.cookiePath || "/";

  if (listenPort === upstreamPort) {
    throw new Error(`listenPort ${listenPort} conflicts with the local dsh web port. Use 8080 for the gateway, or move dsh web to another port.`);
  }

  const { username, password, secret } = resolveCredentials(config);
  const passwordHash = hashPassword(password);
  const upstream = `http://${upstreamHost}:${upstreamPort}`;

  ctx.effect(() => {
    let server;
    let closed = false;
    startGateway({
      listenHost,
      listenPort,
      basePath,
      username,
      passwordHash,
      secret,
      upstream,
      trustProxy,
      secureCookie: config.secureCookie,
      cookiePath,
    }).then((started) => {
      if (closed) {
        started.close();
        return;
      }
      server = started;
    }).catch((error) => {
      console.error("[dsh-cloud-gateway] failed to listen", error);
    });
    return () => {
      closed = true;
      server?.close();
    };
  });
}
