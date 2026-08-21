import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import os from "node:os";
import Schema from "@deepseek-ai/schemastery";
import { loginPage, settingsPage, settingsHookHtml } from "./pages.js";
import { markdownPreviewPage, fileBrowserPage } from "./markdown.js";

export const name = "dsh-cloud-gateway";
export const inject = ["webStartup"];

const COOKIE = "dsh_gw";
const MAX_AGE = 7 * 24 * 3600;
const LOGIN_BODY_LIMIT = 8 * 1024;
const HTML_INJECT_LIMIT = 2 * 1024 * 1024;
const MARKDOWN_PREVIEW_LIMIT = 2 * 1024 * 1024;
const PUBLIC_PATHS = new Set(["/favicon.svg", "/favicon.ico", "/manifest.webmanifest"]);
const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
]);
const STATE_FILE = "cloud-gateway-state.json";
const UUID_POLYFILL = `<script>(function(){try{var c=globalThis.crypto;if(!c||typeof c.randomUUID==="function")return;if(typeof c.getRandomValues!=="function")return;c.randomUUID=function(){var b=new Uint8Array(16);c.getRandomValues(b);b[6]=b[6]&15|64;b[8]=b[8]&63|128;var h=[];for(var j=0;j<16;j++)h.push((b[j]>>4).toString(16)+(b[j]&15).toString(16));return h[0]+h[1]+h[2]+h[3]+"-"+h[4]+h[5]+"-"+h[6]+h[7]+"-"+h[8]+h[9]+"-"+h[10]+h[11]+h[12]+h[13]+h[14]+h[15]};}catch(e){}})();</script>`;

export const Config = Schema.object({
  listenHost: Schema.string().default("0.0.0.0").description("公网监听地址。云服务器用 0.0.0.0，本机调试可用 127.0.0.1"),
  listenPort: Schema.number().min(1).max(65535).default(8080).description("公网端口，必须和 dsh web 不同。默认 8080，避免和官方 3080 冲突"),
  basePath: Schema.string().default("/dsh").description("浏览器访问前缀，例如 /dsh"),
  username: Schema.string().default("admin").description("登录账号。也可用环境变量 DSH_CLOUD_USERNAME"),
  password: Schema.string().role("secret").description("登录密码。留空则首次启动生成并写入本机 state 文件；也可用 DSH_CLOUD_PASSWORD"),
  secret: Schema.string().role("secret").description("会话 HMAC 密钥。留空则持久化生成"),
  upstreamHost: Schema.string().description("本机 Harness 地址，默认 webStartup.host"),
  upstreamPort: Schema.number().min(1).max(65535).description("本机 Harness 端口，默认 webStartup.port"),
  trustProxy: Schema.boolean().default(false).description("仅在前面有 Nginx/Caddy 时打开，才会信任 X-Forwarded-*"),
  secureCookie: Schema.boolean().description("强制 Secure Cookie。留空则仅 HTTPS 请求带 Secure"),
  cookiePath: Schema.string().default("/").description("Cookie 路径。站点根路径还有 /assets /plugins /api 时保持 /"),
});

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

const UPLOAD_BODY_LIMIT = 20 * 1024 * 1024;

function uploadDir() {
  return path.join(dshHome(), "uploads");
}

function safeUploadName(name) {
  const base = String(name || "file").split(/[/\\]/).pop() || "file";
  const cleaned = base.replace(/[\u0000-\u001f<>:"|?*]/g, "_").replace(/^\.+/g, "_").slice(0, 120);
  return cleaned || "file";
}

function manifestPath(dir) {
  return path.join(dir, "manifest.json");
}

function readUploadManifest(dir) {
  try {
    const data = JSON.parse(fs.readFileSync(manifestPath(dir), "utf8"));
    return data && typeof data === "object" ? data : {};
  } catch {
    return {};
  }
}

function writeUploadManifest(dir, data) {
  fs.writeFileSync(manifestPath(dir), JSON.stringify(data, null, 2));
}

function fileToken(name) {
  const base = safeUploadName(name);
  const ascii = base.replace(/[^A-Za-z0-9_-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  if (ascii && /^[\w-]+$/.test(ascii)) return ascii.slice(0, 60);
  const hash = crypto.createHash("sha1").update(String(name || "file")).digest("hex").slice(0, 8);
  const prefix = ascii ? ascii.slice(0, 24) : "file";
  return `${prefix}-${hash}`.replace(/-+/g, "-").slice(0, 60);
}

function uniqueUploadToken(dir, name, manifest) {
  const stem = fileToken(name);
  let token = stem;
  let n = 1;
  while (manifest[token] || fs.existsSync(path.join(dir, token))) {
    n += 1;
    token = `${stem}-${n}`;
  }
  return token;
}

function saveUploadFile(dir, name, bytes) {
  fs.mkdirSync(dir, { recursive: true });
  const manifest = readUploadManifest(dir);
  const token = uniqueUploadToken(dir, name, manifest);
  const abs = path.resolve(dir, token);
  if (!abs.startsWith(`${path.resolve(dir)}${path.sep}`)) throw new Error("非法文件名");
  fs.writeFileSync(abs, bytes);
  manifest[token] = { name, path: abs, token, ts: Date.now() };
  writeUploadManifest(dir, manifest);
  return { path: abs, name, token };
}

export function registerUploadRoute(ctx) {
  const dir = uploadDir();
  ctx.webServer.register({
    kind: "exact",
    path: "/api/dsh-gw-upload",
    handler: (req, res) => {
      if (req.method !== "POST") {
        res.writeHead(405);
        res.end();
        return;
      }
      const chunks = [];
      let size = 0;
      let overflow = false;
      req.on("data", (chunk) => {
        size += chunk.length;
        if (size > UPLOAD_BODY_LIMIT) overflow = true;
        else chunks.push(chunk);
      });
      req.on("error", () => {
        if (!res.headersSent) {
          res.writeHead(400, { "content-type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ error: "读取请求体失败" }));
        }
      });
      req.on("end", () => {
        if (overflow) {
          if (!res.headersSent) {
            res.writeHead(413, { "content-type": "application/json; charset=utf-8" });
            res.end(JSON.stringify({ error: "文件过大" }));
          }
          return;
        }
        try {
          const payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          const name = safeUploadName(payload?.name);
          const base64 = String(payload?.base64 || "");
          if (!base64) throw new Error("缺少文件数据");
          const bytes = Buffer.from(base64, "base64");
          if (!bytes.length) throw new Error("文件为空");
          const saved = saveUploadFile(dir, name, bytes);
          res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
          res.end(JSON.stringify(saved));
        } catch (error) {
          res.writeHead(400, { "content-type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
        }
      });
    },
  });
  console.log(`[dsh-cloud-gateway] upload route /api/dsh-gw-upload -> ${dir}`);
}

const SECRET_BASENAMES = new Set([
  ".credentials.yaml",
  "cloud-gateway-state.json",
  ".env",
  "id_rsa",
  "id_ed25519",
]);

function contentDisposition(name, kind = "inline") {
  const raw = String(name || "file").replace(/["\\\r\n\t]/g, "_");
  const ascii = raw.replace(/[^\x20-\x7E]/g, "_").replace(/_+/g, "_") || "file";
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(raw)}`;
}

function fileContentType(name) {
  const ext = String(name).split(".").pop()?.toLowerCase();
  const map = {
    md: "text/plain; charset=utf-8",
    markdown: "text/plain; charset=utf-8",
    txt: "text/plain; charset=utf-8",
    json: "application/json; charset=utf-8",
    csv: "text/csv; charset=utf-8",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
    html: "text/html; charset=utf-8",
    pdf: "application/pdf",
  };
  return map[ext] || "text/plain; charset=utf-8";
}

let openFileHostCtx = { get() {} };

function collectAllowedRoots(hostCtx) {
  const roots = [path.resolve(uploadDir()), path.resolve(os.homedir())];
  const add = (value) => {
    if (typeof value !== "string" || !value.trim()) return;
    try {
      roots.push(fs.realpathSync(value));
    } catch {
      roots.push(path.resolve(value));
    }
  };
  try {
    for (const ws of hostCtx.get?.("workspaceRegistry")?.list?.() || []) {
      add(ws.path || ws.cwd);
    }
  } catch {
    // registry optional
  }
  try {
    const sessions = hostCtx.get?.("sessions") || hostCtx.sessions;
    for (const session of sessions?.list?.() || []) {
      add(session.cwd || session.header?.cwd);
    }
  } catch {
    // sessions optional
  }
  return [...new Set(roots)];
}

export function resolveOpenFile(hostCtx, rawPath, token) {
  const dir = uploadDir();
  if (token) {
    if (!/^[\w-]+$/.test(token)) return null;
    const item = readUploadManifest(dir)[token];
    const abs = path.resolve(dir, path.basename(item?.path || token));
    if (!fs.existsSync(abs)) return null;
    return { abs, name: item?.name || token };
  }
  const requested = String(rawPath || "").trim();
  if (!requested || requested === ".") return null;
  const abs = path.resolve(requested);
  const name = path.basename(abs);
  if (SECRET_BASENAMES.has(name) || name.endsWith(".pem")) return null;
  let real;
  try {
    real = fs.realpathSync(abs);
  } catch {
    return null;
  }
  if (!fs.statSync(real).isFile()) return null;
  const allowed = collectAllowedRoots(hostCtx).some((root) => real === root || real.startsWith(`${root}${path.sep}`));
  if (!allowed) return null;
  return { abs: real, name };
}

const BROWSE_SKIP_DIRS = new Set(["node_modules", ".git", ".cache"]);

function resolveBrowseDir(hostCtx, rawPath) {
  const requested = String(rawPath || "").trim() || os.homedir();
  const abs = path.resolve(requested);
  let real;
  try {
    real = fs.realpathSync(abs);
  } catch {
    return null;
  }
  if (!fs.statSync(real).isDirectory()) return null;
  const allowed = collectAllowedRoots(hostCtx).some((root) => real === root || real.startsWith(`${root}${path.sep}`));
  if (!allowed) return null;
  return real;
}

function serveBrowse(req, res) {
  try {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405);
      res.end();
      return;
    }
    const url = requestUrl(req);
    const dir = resolveBrowseDir(openFileHostCtx, url.searchParams.get("path"));
    if (!dir) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("目录不存在或无权浏览");
      return;
    }
    const roots = collectAllowedRoots(openFileHostCtx);
    const parent = path.dirname(dir);
    const parentAllowed = roots.some((root) => parent === root || parent.startsWith(`${root}${path.sep}`));
    const parentHref = parentAllowed && parent !== dir
      ? `/api/dsh-gw-browse?path=${encodeURIComponent(parent)}`
      : "";
    let names = [];
    try {
      names = fs.readdirSync(dir);
    } catch {
      names = [];
    }
    const entries = names
      .filter((name) => !SECRET_BASENAMES.has(name) && !name.endsWith(".pem"))
      .slice(0, 400)
      .map((name) => {
        const abs = path.join(dir, name);
        let isDir = false;
        try {
          isDir = fs.statSync(abs).isDirectory();
        } catch {
          return null;
        }
        if (isDir && BROWSE_SKIP_DIRS.has(name)) return null;
        const href = isDir
          ? `/api/dsh-gw-browse?path=${encodeURIComponent(abs)}`
          : `/api/dsh-gw-file?path=${encodeURIComponent(abs)}`;
        return { name, dir: isDir, href };
      })
      .filter(Boolean)
      .sort((a, b) => Number(b.dir) - Number(a.dir) || a.name.localeCompare(b.name, "zh"));
    const html = fileBrowserPage(dir, parentHref, entries);
    res.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "content-disposition": "inline",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    });
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    res.end(html);
  } catch {
    if (!res.headersSent) res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    if (!res.writableEnded) res.end("浏览目录失败");
  }
}

function serveOpenFile(req, res) {
  try {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405);
      res.end();
      return;
    }
    const url = requestUrl(req);
    const found = resolveOpenFile(openFileHostCtx, url.searchParams.get("path"), url.searchParams.get("token"));
    if (!found) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("文件不存在或无权打开");
      return;
    }
    const raw = url.searchParams.get("raw") === "1";
    const markdown = /\.(md|markdown)$/i.test(found.name) && !raw;
    if (markdown && fs.statSync(found.abs).size <= MARKDOWN_PREVIEW_LIMIT) {
      const rawUrl = new URL(url.href);
      rawUrl.searchParams.set("raw", "1");
      const html = markdownPreviewPage(found.name, fs.readFileSync(found.abs, "utf8"), `${rawUrl.pathname}${rawUrl.search}`);
      res.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "content-disposition": "inline",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      });
      if (req.method === "HEAD") {
        res.end();
        return;
      }
      res.end(html);
      return;
    }
    res.writeHead(200, {
      "content-type": fileContentType(found.name),
      "content-disposition": contentDisposition(found.name),
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    });
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    const stream = fs.createReadStream(found.abs);
    stream.on("error", () => {
      if (!res.headersSent) res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      res.end();
    });
    stream.pipe(res);
  } catch {
    if (!res.headersSent) res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    if (!res.writableEnded) res.end("打开文件失败");
  }
}

export function registerFileOpenRoute(webCtx, hostCtx) {
  openFileHostCtx = hostCtx || openFileHostCtx;
  console.log("[dsh-cloud-gateway] file open route /api/dsh-gw-file");
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

function outboundHeaders(headers) {
  const out = {};
  for (const [key, value] of Object.entries(headers || {})) {
    if (HOP_BY_HOP.has(key.toLowerCase())) continue;
    out[key] = value;
  }
  return out;
}

function shouldInjectHtml(pathname, contentType) {
  if (!String(contentType).includes("text/html")) return false;
  const pathOnly = String(pathname || "/").split("?")[0];
  if (pathOnly === "/api" || pathOnly.startsWith("/api/")) return false;
  if (pathOnly === "/query-balance" || pathOnly.startsWith("/query-balance/")) return false;
  if (pathOnly === "/dsh-image-gen" || pathOnly.startsWith("/dsh-image-gen/")) return false;
  return true;
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

function proxyHeaders(req, target, options = {}) {
  const headers = { ...req.headers, "accept-encoding": "identity" };
  delete headers["keep-alive"];
  delete headers["proxy-connection"];
  if (options.upgrade) {
    headers.connection = "Upgrade";
    if (req.headers.upgrade) headers.upgrade = req.headers.upgrade;
  } else {
    delete headers.connection;
    delete headers.upgrade;
  }
  // Official dsh pins settings.describe and other privileged RPCs to loopback
  // even when --trusted-host is set. After our login wall, present as the
  // local Harness so the configuration plane can load.
  headers.host = target.host;
  if (headers.origin) headers.origin = `${target.protocol}//${target.host}`;
  if (headers.referer) {
    try {
      const referer = new URL(headers.referer);
      headers.referer = `${target.protocol}//${target.host}${referer.pathname}${referer.search}`;
    } catch {
      delete headers.referer;
    }
  }
  // The fence also rejects sec-fetch-site: cross-site even on loopback.
  delete headers["sec-fetch-site"];
  delete headers["sec-fetch-mode"];
  delete headers["sec-fetch-dest"];
  delete headers["sec-fetch-user"];
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
    settingsValues,
    envLocked,
    onSaveSettings,
  } = options;
  const loginPath = `${basePath}/login`;
  const logoutPath = `${basePath}/logout`;
  const settingsPath = `${basePath}/settings`;
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
    if (!body.includes('id="dsh-gw-hook"')) {
      const hook = settingsHookHtml(settingsPath, logoutPath);
      body = body.includes("</body>") ? body.replace("</body>", `${hook}</body>`) : body + hook;
    }
    return body;
  }

  function proxyWeb(req, res) {
    rewriteUpstreamUrl(req);
    const pathname = String(req.url || "/").split("?")[0];
    const proxyReq = http.request({
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || 80,
      method: req.method,
      path: req.url,
      headers: proxyHeaders(req, target),
    }, (proxyRes) => {
      const contentType = String(proxyRes.headers["content-type"] || "");
      if (!shouldInjectHtml(pathname, contentType)) {
        res.writeHead(proxyRes.statusCode || 200, outboundHeaders(proxyRes.headers));
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
        const headers = outboundHeaders(proxyRes.headers);
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
    proxyReq.setHeader("host", target.host);
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
      headers: proxyHeaders(req, target, { upgrade: true }),
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
    proxyReq.setHeader("host", target.host);
    proxyReq.end();
  }

  function sendLogin(res, error = "") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    res.end(loginPage(basePath, error));
  }

  function sendSettings(res, extra = {}) {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    res.end(settingsPage({
      basePath,
      values: settingsValues,
      upstream,
      publicUrls: guessPublicUrls(listenPort, basePath),
      envLocked,
      saved: false,
      error: "",
      ...extra,
    }));
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

    if (pathname === settingsPath && (req.method === "GET" || req.method === "HEAD")) {
      if (!sessionUser(req)) {
        res.writeHead(302, { location: loginPath });
        res.end();
        return;
      }
      if (req.method === "HEAD") {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
        res.end();
        return;
      }
      sendSettings(res, { saved: requestUrl(req).searchParams.get("saved") === "1" });
      return;
    }

    if (pathname === settingsPath && req.method === "POST") {
      if (!sessionUser(req)) {
        res.writeHead(401, { "content-type": "text/plain; charset=utf-8" });
        res.end("未登录");
        return;
      }
      let params;
      try {
        params = new URLSearchParams(await parseBody(req));
      } catch {
        sendSettings(res, { error: "请求过大" });
        return;
      }
      let saved;
      try {
        saved = await onSaveSettings({
          username: (params.get("username") || "").trim(),
          password: params.get("password") || "",
          listenHost: (params.get("listenHost") || "").trim(),
          listenPort: Number(params.get("listenPort")),
          basePath: params.get("basePath") || "/dsh",
          trustProxy: params.get("trustProxy") === "1",
          secureCookie: params.get("secureCookie") === "true" ? true : params.get("secureCookie") === "false" ? false : undefined,
          cookiePath: params.get("cookiePath") || "/",
        });
      } catch (error) {
        sendSettings(res, { error: error.message || "保存失败" });
        return;
      }
      sendSettings(res, {
        saved: true,
        values: saved.values,
        publicUrls: guessPublicUrls(saved.values.listenPort, saved.values.basePath),
      });
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

    if (pathname === "/api/dsh-gw-file") {
      serveOpenFile(req, res);
      return;
    }

    if (pathname === "/api/dsh-gw-browse") {
      serveBrowse(req, res);
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
      console.log(`[dsh-cloud-gateway] after login, open ${basePath}/settings to configure username, password, port, and proxy options`);
      for (const url of urls) console.log(`[dsh-cloud-gateway] try ${url}`);
      resolve(server);
    });
  });
}

function mergeRuntimeConfig(config = {}) {
  const visual = readState().userSettings || {};
  return {
    ...config,
    ...visual,
    username: process.env.DSH_CLOUD_USERNAME || visual.username || config.username,
    password: process.env.DSH_CLOUD_PASSWORD || visual.password || config.password,
    secret: process.env.DSH_CLOUD_SECRET || config.secret,
  };
}

function resolveCredentials(config) {
  const username = String(config.username || "admin").trim() || "admin";
  const configured = config.password || "";
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

  const secret = config.secret || state.secret || crypto.randomBytes(32).toString("hex");
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
    console.log("[dsh-cloud-gateway] after login, open 网关设置 to change this password");
  } else if (!configured) {
    console.log(`[dsh-cloud-gateway] using generated credentials from ${statePath()}`);
  }

  return { username, password, secret };
}

function buildGatewayOptions(ctx, config, handlers) {
  const merged = mergeRuntimeConfig(config);
  const listenHost = merged.listenHost || "0.0.0.0";
  const listenPort = Number(merged.listenPort || 8080);
  const basePath = normalizeBasePath(merged.basePath || "/dsh");
  const upstreamHost = merged.upstreamHost || ctx.webStartup?.host || "127.0.0.1";
  const upstreamPort = Number(merged.upstreamPort || ctx.webStartup?.port || 3080);
  const cookiePath = merged.cookiePath || "/";
  if (listenPort === upstreamPort) {
    throw new Error(`listenPort ${listenPort} conflicts with the local dsh web port. Use 8080 for the gateway, or move dsh web to another port.`);
  }
  const { username, password, secret } = resolveCredentials(merged);
  return {
    listenHost,
    listenPort,
    basePath,
    username,
    passwordHash: hashPassword(password),
    secret,
    upstream: `http://${upstreamHost}:${upstreamPort}`,
    trustProxy: Boolean(merged.trustProxy),
    secureCookie: merged.secureCookie,
    cookiePath,
    settingsValues: {
      username,
      listenHost,
      listenPort,
      basePath,
      trustProxy: Boolean(merged.trustProxy),
      secureCookie: merged.secureCookie,
      cookiePath,
    },
    envLocked: {
      username: Boolean(process.env.DSH_CLOUD_USERNAME),
      password: Boolean(process.env.DSH_CLOUD_PASSWORD),
    },
    ...handlers,
  };
}

function persistVisualSettings(patch, upstreamPort) {
  if (!patch.username) throw new Error("账号不能为空");
  if (!patch.listenHost) throw new Error("监听地址不能为空");
  const listenPort = Number(patch.listenPort);
  if (!Number.isInteger(listenPort) || listenPort < 1 || listenPort > 65535) {
    throw new Error("公网端口无效");
  }
  if (listenPort === Number(upstreamPort)) {
    throw new Error(`公网端口不能和本机 dsh web 端口 ${upstreamPort} 相同`);
  }
  const basePath = normalizeBasePath(patch.basePath || "/dsh");
  if (patch.password && patch.password.length < 8) {
    console.warn("[dsh-cloud-gateway] configured password is shorter than 8 characters");
  }

  const state = readState();
  const userSettings = { ...(state.userSettings || {}) };
  if (!process.env.DSH_CLOUD_USERNAME) userSettings.username = patch.username;
  if (!process.env.DSH_CLOUD_PASSWORD && patch.password) {
    userSettings.password = patch.password;
    delete state.generatedPassword;
  }
  userSettings.listenHost = patch.listenHost;
  userSettings.listenPort = listenPort;
  userSettings.basePath = basePath;
  userSettings.trustProxy = Boolean(patch.trustProxy);
  userSettings.cookiePath = patch.cookiePath || "/";
  if (patch.secureCookie === true || patch.secureCookie === false) {
    userSettings.secureCookie = patch.secureCookie;
  } else {
    delete userSettings.secureCookie;
  }

  writeState({
    ...state,
    username: userSettings.username || state.username,
    userSettings,
    ...(patch.password ? { generatedPassword: undefined } : {}),
  });

  return {
    username: userSettings.username || patch.username,
    listenHost: userSettings.listenHost,
    listenPort,
    basePath,
    trustProxy: userSettings.trustProxy,
    secureCookie: userSettings.secureCookie,
    cookiePath: userSettings.cookiePath,
  };
}

export function apply(ctx, config = {}) {
  const runtime = {
    closed: false,
    server: null,
    restartTimer: null,
  };

  const restart = () => {
    if (runtime.closed) return;
    const current = runtime.server;
    runtime.server = null;
    const boot = () => {
      startGateway(buildGatewayOptions(ctx, config, {
        onSaveSettings: async (patch) => {
          const upstreamPort = Number(config.upstreamPort || ctx.webStartup?.port || 3080);
          const values = persistVisualSettings(patch, upstreamPort);
          clearTimeout(runtime.restartTimer);
          runtime.restartTimer = setTimeout(restart, 150);
          return { values };
        },
      })).then((started) => {
        if (runtime.closed) {
          started.close();
          return;
        }
        runtime.server = started;
      }).catch((error) => {
        console.error("[dsh-cloud-gateway] failed to listen", error);
      });
    };
    if (current) current.close(() => boot());
    else boot();
  };

  openFileHostCtx = ctx;
  if (typeof ctx.inject === "function") {
    ctx.inject(["webServer"], (webCtx) => {
      registerUploadRoute(webCtx);
      registerFileOpenRoute(webCtx, ctx);
    });
  }

  ctx.effect(() => {
    restart();
    return () => {
      runtime.closed = true;
      clearTimeout(runtime.restartTimer);
      runtime.server?.close();
    };
  });
}
