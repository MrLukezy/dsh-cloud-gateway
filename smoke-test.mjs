import http from "node:http";
import os from "node:os";
import path from "node:path";
import { apply } from "./index.js";

process.env.DSH_HOME = path.join(os.tmpdir(), "dsh-cloud-gateway-smoke");

const upstream = http.createServer((req, res) => {
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

console.log({
  login: login.status,
  head: head.status,
  hasForm: html.includes("name=\"username\""),
  denied: denied.status,
  authed: authed.status,
  hasCookie: cookie.includes("dsh_gw="),
  app: app.status,
  injected: appHtml.includes("dsh-gw-logout"),
});

for (const stop of effects) stop?.();
upstream.close();
