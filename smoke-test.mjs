import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { EventEmitter } from "node:events";
import { apply, registerUploadRoute, resolveOpenFile } from "./index.js";

process.env.DSH_HOME = path.join(os.tmpdir(), "dsh-cloud-gateway-smoke");

const seen = { host: "", origin: "", site: "", upgradeConnection: "", upgradeHost: "" };
const upstream = http.createServer((req, res) => {
  if (req.url.startsWith("/api/dsh-gw-file") || req.url.startsWith("/api/dsh-mobile-files")) {
    res.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "content-disposition": "inline; filename=\"note.md\"",
    });
    res.end("<html><head></head><body># hello md</body></html>");
    return;
  }
  if (req.url.startsWith("/api/")) {
    seen.host = String(req.headers.host || "");
    seen.origin = String(req.headers.origin || "");
    seen.site = String(req.headers["sec-fetch-site"] || "");
    res.writeHead(200, { "content-type": "application/json" });
    res.end("{\"ok\":true}");
    return;
  }
  res.writeHead(200, { "content-type": "text/html" });
  res.end("<html><head></head><body>ok</body></html>");
});
upstream.on("upgrade", (req, socket) => {
  seen.upgradeConnection = String(req.headers.connection || "");
  seen.upgradeHost = String(req.headers.host || "");
  socket.write("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n");
  socket.end();
});
await new Promise((resolve) => upstream.listen(18081, "127.0.0.1", resolve));

const effects = [];
const ctx = {
  webStartup: { host: "127.0.0.1", port: 18081 },
  inject: () => {},
  effect: (fn) => {
    effects.push(fn());
  },
};

apply(ctx, {
  listenHost: "127.0.0.1",
  listenPort: 18080,
  username: "tester",
  password: "password1",
  trustProxy: false,
});
await new Promise((resolve) => setTimeout(resolve, 400));

const login = await fetch("http://127.0.0.1:18080/dsh/login");
const html = await login.text();
const head = await fetch("http://127.0.0.1:18080/dsh/login", { method: "HEAD" });
const denied = await fetch("http://127.0.0.1:18080/plugins/x.js", { redirect: "manual" });
const authed = await fetch("http://127.0.0.1:18080/dsh/login", {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: "username=tester&password=password1",
  redirect: "manual",
});
const cookie = authed.headers.get("set-cookie") || "";
const app = await fetch("http://127.0.0.1:18080/dsh/", {
  headers: { cookie },
  redirect: "manual",
});
const appHtml = await app.text();
const settingsDenied = await fetch("http://127.0.0.1:18080/dsh/settings", { redirect: "manual" });
const settings = await fetch("http://127.0.0.1:18080/dsh/settings", { headers: { cookie } });
const settingsHtml = await settings.text();
const saved = await fetch("http://127.0.0.1:18080/dsh/settings", {
  method: "POST",
  headers: { cookie, "content-type": "application/x-www-form-urlencoded" },
  body: "username=tester&password=&listenHost=127.0.0.1&listenPort=18080&basePath=/dsh&cookiePath=/",
});
const savedHtml = await saved.text();
await new Promise((resolve) => setTimeout(resolve, 300));
const wsStatus = await new Promise((resolve, reject) => {
  const socket = net.connect(18080, "127.0.0.1");
  let data = "";
  socket.on("error", reject);
  socket.on("data", (chunk) => {
    data += chunk.toString("latin1");
    if (data.includes("\r\n\r\n")) {
      socket.end();
      resolve(data.split("\r\n", 1)[0]);
    }
  });
  socket.on("connect", () => {
    socket.write([
      "GET /api/events.mux HTTP/1.1",
      "Host: example.test",
      "Upgrade: websocket",
      "Connection: Upgrade",
      "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==",
      "Sec-WebSocket-Version: 13",
      "Origin: http://example.test",
      `Cookie: ${cookie.split(";", 1)[0]}`,
      "",
      "",
    ].join("\r\n"));
  });
});
const filePage = await fetch("http://127.0.0.1:18080/api/dsh-mobile-files?token=note", {
  headers: { cookie },
});
const fileHtml = await filePage.text();
const api = await fetch("http://127.0.0.1:18080/api/settings.describe", {
  method: "POST",
  headers: {
    cookie,
    "content-type": "application/json",
    host: "example.test",
    origin: "http://example.test",
    "sec-fetch-site": "cross-site",
  },
  body: "{}",
});

let uploadRoute;
registerUploadRoute({
  webServer: {
    register: (route) => {
      uploadRoute = route;
    },
  },
});
const upload = await new Promise((resolve, reject) => {
  const req = new EventEmitter();
  req.method = "POST";
  const res = {
    statusCode: 0,
    body: "",
    writeHead(code) {
      this.statusCode = code;
    },
    end(chunk = "") {
      this.body += String(chunk);
      try {
        resolve({ status: this.statusCode, ...JSON.parse(this.body || "{}") });
      } catch (error) {
        reject(error);
      }
    },
  };
  uploadRoute.handler(req, res);
  req.emit("data", Buffer.from(JSON.stringify({
    name: "note.md",
    base64: Buffer.from("# hello\n", "utf8").toString("base64"),
  })));
  req.emit("end");
});

console.log({
  login: login.status,
  head: head.status,
  hasForm: html.includes("name=\"username\""),
  hasGuide: html.includes("设置 → 网关") && !html.includes("<details>"),
  denied: denied.status,
  authed: authed.status,
  hasCookie: cookie.includes("dsh_gw="),
  app: app.status,
  injected: appHtml.includes("dsh-gw-hook") && appHtml.includes("dsh-gw-settings") && appHtml.includes("dsh-gw-logout") && !appHtml.includes("dsh-gw-bar"),
  settingsDenied: settingsDenied.status,
  settings: settings.status,
  settingsForm: settingsHtml.includes("name=\"listenPort\""),
  settingsModal: settingsHtml.includes("dsh-gw-overlay") && settingsHtml.includes("Escape"),
  saved: saved.status,
  savedOk: savedHtml.includes("已保存"),
  api: api.status,
  filePage: filePage.status,
  filePassthrough: fileHtml.includes("# hello md") && !fileHtml.includes("dsh-gw-hook"),
  fileType: filePage.headers.get("content-type"),
  ws: wsStatus,
  wsUpgraded: wsStatus.includes("101"),
  upgradeConnection: seen.upgradeConnection,
  upgradeHost: seen.upgradeHost,
  upstreamHost: seen.host,
  upstreamOrigin: seen.origin,
  strippedSite: seen.site === "",
  uploadOk: upload.status === 200,
  uploadPath: Boolean(upload.path) && fs.existsSync(upload.path),
  openUpload: Boolean(resolveOpenFile({}, "", upload.token)),
  denySecret: resolveOpenFile({}, path.join(process.env.DSH_HOME, ".credentials.yaml"), "") === null,
  gwFile: (await fetch(`http://127.0.0.1:18080/api/dsh-gw-file?path=${encodeURIComponent(upload.path)}`, { headers: { cookie } })).status,
  gwBrowse: (await fetch(`http://127.0.0.1:18080/api/dsh-gw-browse?path=${encodeURIComponent(path.dirname(upload.path))}`, { headers: { cookie } })).status,
  ...await (async () => {
    const cnPath = path.join(path.dirname(upload.path), "设计文档_v2.md");
    fs.writeFileSync(cnPath, [
      "# 中文文档",
      "",
      "> 修订",
      "> - **重点**",
      "",
      "| 关卡 | 玩法 |",
      "|---|---|",
      "| 1 | 记忆 |",
      "",
      "- 列表项",
      "",
    ].join("\n"));
    const cnUrl = `http://127.0.0.1:18080/api/dsh-gw-file?path=${encodeURIComponent(cnPath)}`;
    const cnRes = await fetch(cnUrl, { headers: { cookie } });
    const cnHtml = await cnRes.text();
    const rawRes = await fetch(`${cnUrl}&raw=1`, { headers: { cookie } });
    return {
      gwFileCn: cnRes.status,
      gwFileCnHtml: String(cnRes.headers.get("content-type") || "").includes("text/html") && !cnHtml.includes("dsh-gw-hook"),
      gwFileCnRendered: cnHtml.includes("<h1>中文文档</h1>") && cnHtml.includes("<table") && cnHtml.includes("<strong>重点</strong>"),
      gwFileCnRaw: rawRes.status === 200 && String(rawRes.headers.get("content-type") || "").includes("text/plain") && (await rawRes.text()).includes("# 中文文档"),
    };
  })(),
});

for (const stop of effects) stop?.();
upstream.close();
