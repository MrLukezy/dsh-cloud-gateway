function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}

function safeUrl(value) {
  const url = String(value || "").trim();
  if (!url || /^(javascript|vbscript|data):/i.test(url)) return "#";
  return escapeHtml(url);
}

function inline(text) {
  const chunks = [];
  const src = String(text || "");
  const re = /`([^`]+)`/g;
  let last = 0;
  let match;
  while ((match = re.exec(src))) {
    chunks.push({ type: "text", value: src.slice(last, match.index) });
    chunks.push({ type: "code", value: match[1] });
    last = match.index + match[0].length;
  }
  chunks.push({ type: "text", value: src.slice(last) });
  return chunks.map((chunk) => {
    if (chunk.type === "code") return `<code>${escapeHtml(chunk.value)}</code>`;
    return styleInline(escapeHtml(chunk.value));
  }).join("");
}

function styleInline(escaped) {
  return escaped
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, href) => `<img alt="${alt}" src="${safeUrl(href)}">`)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => `<a href="${safeUrl(href)}" rel="noopener noreferrer">${label}</a>`)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/~~([^~]+)~~/g, "<del>$1</del>")
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
}

function isFence(line) {
  const match = String(line).match(/^(`{3,}|~{3,})(.*)$/);
  if (!match) return null;
  return { mark: match[1][0], len: match[1].length, info: match[2].trim() };
}

function isHr(line) {
  return /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line);
}

function heading(line) {
  const match = String(line).match(/^(#{1,6})\s+(.+)$/);
  if (!match) return null;
  return { level: match[1].length, text: match[2].replace(/\s+#+\s*$/, "") };
}

function isListItem(line) {
  return /^(\s*)(?:[-*+]|\d+[.)])\s+/.test(line);
}

function isTableSep(line) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function splitRow(line) {
  let row = String(line).trim();
  if (row.startsWith("|")) row = row.slice(1);
  if (row.endsWith("|")) row = row.slice(0, -1);
  return row.split("|").map((cell) => cell.trim());
}

function looksLikeTable(lines, index) {
  return /^\s*\|/.test(lines[index] || "") && isTableSep(lines[index + 1] || "");
}

function isBlockStart(lines, index) {
  const line = lines[index] || "";
  return Boolean(isFence(line) || isHr(line) || heading(line) || line.startsWith(">") || isListItem(line) || looksLikeTable(lines, index));
}

function parseTable(lines, start) {
  const header = splitRow(lines[start]);
  let index = start + 2;
  const rows = [];
  while (index < lines.length && /^\s*\|/.test(lines[index])) {
    rows.push(splitRow(lines[index]));
    index += 1;
  }
  const thead = `<tr>${header.map((cell) => `<th>${inline(cell)}</th>`).join("")}</tr>`;
  const tbody = rows.map((row) => `<tr>${row.map((cell) => `<td>${inline(cell)}</td>`).join("")}</tr>`).join("");
  return { html: `<div class="md-table"><table><thead>${thead}</thead><tbody>${tbody}</tbody></table></div>`, next: index };
}

function parseList(lines, start) {
  const first = lines[start];
  const unordered = /^\s*[-*+]\s+/.test(first);
  const itemRe = unordered ? /^(\s*)[-*+]\s+(.*)$/ : /^(\s*)\d+[.)]\s+(.*)$/;
  const baseIndent = (first.match(/^(\s*)/) || ["", ""])[1].length;
  const items = [];
  let index = start;
  while (index < lines.length) {
    const match = lines[index].match(itemRe);
    if (match) {
      const indent = match[1].length;
      if (indent < baseIndent) break;
      if (indent > baseIndent + 1 && items.length) {
        const nested = parseList(lines, index);
        items[items.length - 1].nested += nested.html;
        index = nested.next;
        continue;
      }
      items.push({ text: [match[2]], nested: "" });
      index += 1;
      continue;
    }
    if (!lines[index].trim()) {
      index += 1;
      if (index < lines.length && isListItem(lines[index])) continue;
      break;
    }
    if (items.length && lines[index].startsWith(" ".repeat(baseIndent + 2))) {
      items[items.length - 1].text.push(lines[index].trim());
      index += 1;
      continue;
    }
    break;
  }
  const tag = unordered ? "ul" : "ol";
  const html = `<${tag}>${items.map((item) => `<li>${inline(item.text.join(" "))}${item.nested}</li>`).join("")}</${tag}>`;
  return { html, next: index };
}

export function renderMarkdown(source) {
  const lines = String(source || "").replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    const fence = isFence(line);
    if (fence) {
      const body = [];
      index += 1;
      while (index < lines.length) {
        const close = isFence(lines[index]);
        if (close && close.mark === fence.mark && close.len >= fence.len) break;
        body.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      const lang = fence.info.split(/\s+/)[0];
      const cls = lang ? ` class="language-${escapeHtml(lang)}"` : "";
      out.push(`<pre><code${cls}>${escapeHtml(body.join("\n"))}</code></pre>`);
      continue;
    }
    if (isHr(line)) {
      out.push("<hr>");
      index += 1;
      continue;
    }
    const head = heading(line);
    if (head) {
      out.push(`<h${head.level}>${inline(head.text)}</h${head.level}>`);
      index += 1;
      continue;
    }
    if (/^>\s?/.test(line)) {
      const quoted = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        quoted.push(lines[index].replace(/^>\s?/, ""));
        index += 1;
      }
      out.push(`<blockquote>${renderMarkdown(quoted.join("\n"))}</blockquote>`);
      continue;
    }
    if (looksLikeTable(lines, index)) {
      const table = parseTable(lines, index);
      out.push(table.html);
      index = table.next;
      continue;
    }
    if (isListItem(line)) {
      const list = parseList(lines, index);
      out.push(list.html);
      index = list.next;
      continue;
    }
    if (!line.trim()) {
      index += 1;
      continue;
    }
    const para = [];
    while (index < lines.length && lines[index].trim() && !isBlockStart(lines, index)) {
      para.push(lines[index]);
      index += 1;
    }
    out.push(`<p>${inline(para.join(" "))}</p>`);
  }
  return out.join("\n");
}

export function markdownPreviewPage(name, source, rawHref) {
  const title = escapeHtml(name || "Markdown");
  const raw = rawHref ? `<a href="${escapeHtml(rawHref)}">查看原文</a>` : "";
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    :root { color-scheme: light dark; --bg:#f6f1e8; --card:#fffdf8; --text:#1c2430; --muted:#667085; --line:#d9d1c3; --accent:#8a5a12; --code:#eee6d6; --pre:#1e2430; --pre-text:#e8eef8; --quote:#fff6df; }
    @media (prefers-color-scheme: dark) {
      :root { --bg:#10141c; --card:#171d28; --text:#e8eef8; --muted:#93a0b8; --line:#2b3344; --accent:#e2b56a; --code:#243044; --pre:#0d1118; --pre-text:#dbe4f3; --quote:#241c12; }
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; }
    body { font: 16px/1.75 "Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif; color: var(--text); background: var(--bg); }
    .wrap { max-width: 880px; margin: 0 auto; padding: 20px 16px 72px; }
    .bar { display: flex; justify-content: space-between; gap: 12px; align-items: baseline; margin-bottom: 18px; color: var(--muted); font-size: 13px; }
    .bar a { color: var(--accent); }
    article { background: var(--card); border: 1px solid var(--line); border-radius: 16px; padding: 22px 20px 32px; overflow-x: auto; }
    article > :first-child { margin-top: 0; }
    h1, h2, h3, h4 { line-height: 1.35; }
    h1 { font-size: 1.7em; }
    h2 { font-size: 1.28em; margin-top: 1.6em; padding-bottom: .25em; border-bottom: 1px solid var(--line); }
    h3 { font-size: 1.1em; margin-top: 1.3em; }
    p, li { word-break: break-word; }
    blockquote { margin: 1em 0; padding: .15em 1em; border-left: 4px solid var(--accent); background: var(--quote); }
    blockquote > :first-child { margin-top: .4em; }
    hr { border: 0; border-top: 1px solid var(--line); margin: 1.6em 0; }
    ul, ol { padding-left: 1.3em; }
    .md-table { overflow-x: auto; }
    table { border-collapse: collapse; min-width: 100%; }
    th, td { border: 1px solid var(--line); padding: 8px 10px; text-align: left; vertical-align: top; }
    th { background: color-mix(in srgb, var(--line) 35%, var(--card)); }
    pre { background: var(--pre); color: var(--pre-text); padding: 14px 16px; border-radius: 12px; overflow-x: auto; }
    :not(pre) > code { background: var(--code); padding: .1em .4em; border-radius: 5px; font-size: .92em; }
    code { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
    img { max-width: 100%; }
    a { color: var(--accent); }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="bar"><span>${title}</span>${raw}</div>
    <article>${renderMarkdown(source)}</article>
  </div>
</body>
</html>`;
}

export function fileBrowserPage(current, parentHref, entries) {
  const title = escapeHtml(current || "文件浏览");
  const up = parentHref ? `<a href="${escapeHtml(parentHref)}">上级目录</a>` : "<span>已到允许的根目录</span>";
  const rows = (entries || []).map((item) => {
    const href = escapeHtml(item.href);
    const name = escapeHtml(item.name);
    const kind = item.dir ? "目录" : "文件";
    return `<a class="row" href="${href}"><span class="kind">${kind}</span><span class="name">${name}</span></a>`;
  }).join("");
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    :root { color-scheme: light dark; --bg:#f6f1e8; --card:#fffdf8; --text:#1c2430; --muted:#667085; --line:#d9d1c3; --accent:#8a5a12; }
    @media (prefers-color-scheme: dark) {
      :root { --bg:#10141c; --card:#171d28; --text:#e8eef8; --muted:#93a0b8; --line:#2b3344; --accent:#e2b56a; }
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; }
    body { font: 16px/1.55 "Segoe UI","PingFang SC","Microsoft YaHei",sans-serif; color: var(--text); background: var(--bg); }
    .wrap { max-width: 880px; margin: 0 auto; padding: 20px 16px 72px; }
    .bar { display: flex; justify-content: space-between; gap: 12px; align-items: baseline; margin-bottom: 14px; color: var(--muted); font-size: 13px; word-break: break-all; }
    .bar a { color: var(--accent); }
    .hint { color: var(--muted); font-size: 13px; margin: 0 0 14px; }
    .list { background: var(--card); border: 1px solid var(--line); border-radius: 16px; overflow: hidden; }
    .row { display: flex; gap: 12px; align-items: center; padding: 12px 14px; color: inherit; text-decoration: none; border-top: 1px solid var(--line); }
    .row:first-child { border-top: 0; }
    .kind { flex: none; color: var(--muted); font-size: 12px; width: 36px; }
    .name { min-width: 0; word-break: break-all; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="bar"><span>${title}</span>${up}</div>
    <p class="hint">这是网关提供的文件浏览。点目录进入，点文件预览。官方竖屏插件的文件夹按钮本身没有接资源管理器。</p>
    <div class="list">${rows || '<div class="row"><span class="name">这个目录是空的</span></div>'}</div>
  </div>
</body>
</html>`;
}
