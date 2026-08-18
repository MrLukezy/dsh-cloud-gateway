import http from "node:http";
import os from "node:os";
import path from "node:path";
import { apply } from "./index.js";

process.env.DSH_HOME = path.join(os.tmpdir(), "dsh-cloud-gateway-smoke");

const seen = { host: "", origin: "", site: "" };
const upstream = http.createServer((req, res) => {
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
await new Promise((resolve) => upstream.listen(18081, "127.0.0.1", resolve));

const effects = [];
const ctx = {
  webStartup: { host: "127.0.0.1", port: 18081 },
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
  upstreamHost: seen.host,
  upstreamOrigin: seen.origin,
  strippedSite: seen.site === "",
});

for (const stop of effects) stop?.();
upstream.close();
