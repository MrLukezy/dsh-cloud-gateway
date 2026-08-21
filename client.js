window.__ModuleLoader__.load({
  id: "dsh-cloud-gateway",
  factory: (require) => {
    const module = { exports: {} };
    const exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    const react = require("react");

    function isOfficialImage(file) {
      return /^(image\/png|image\/jpeg|image\/webp|image\/gif)$/i.test(file.type || "");
    }

    function filesOf(event) {
      return Array.from((event.dataTransfer && event.dataTransfer.files) || []);
    }

    function hasDocumentFiles(event) {
      const files = filesOf(event);
      return files.length > 0 && files.some((file) => !isOfficialImage(file));
    }

    function clearOfficialDropOverlay() {
      window.dispatchEvent(new Event("dragend"));
    }

    function fileToBase64(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = String(reader.result || "");
          const comma = result.indexOf(",");
          resolve(comma >= 0 ? result.slice(comma + 1) : result);
        };
        reader.onerror = () => reject(reader.error || new Error("read failed"));
        reader.readAsDataURL(file);
      });
    }

    async function uploadFile(file) {
      const res = await fetch("/api/dsh-gw-upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: file.name || "file",
          base64: await fileToBase64(file),
        }),
      });
      const result = await res.json();
      if (!res.ok || !result || !result.path || !result.token) {
        throw new Error((result && result.error) || `HTTP ${res.status}`);
      }
      return result;
    }

    function mentionBlock(files) {
      const tokens = files.map((file) => `@${file.token}`).join(" ");
      return `请阅读 ${tokens}`;
    }

    function openFileInBrowser(filePath, token) {
      const path = String(filePath || "").trim();
      if (token) {
        windowOpen(`/api/dsh-gw-file?token=${encodeURIComponent(token)}`);
        return true;
      }
      if (!path || path === ".") return false;
      windowOpen(`/api/dsh-gw-file?path=${encodeURIComponent(path)}`);
      return true;
    }

    function windowOpen(url) {
      const link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      link.remove();
    }

    function looksLikeFsPath(value) {
      const text = String(value || "").trim();
      if (!text || text === ".") return false;
      return /^[A-Za-z]:[\\/]/.test(text) || text.startsWith("/");
    }

    function conversationLabel(session) {
      const title = session && (session.title || session.displayTitle || session.name);
      if (title && String(title).trim()) return String(title).trim().slice(0, 80);
      const crumb = document.querySelector("[class*='titleCluster'], [class*='_crumb']");
      const text = crumb && crumb.textContent ? crumb.textContent.trim() : "";
      return (text || "对话").slice(0, 80);
    }

    function isDomRunning() {
      if (document.querySelector('[data-state="running"]')) return true;
      return Boolean(document.querySelector('[aria-label="停止生成"], [aria-label="Stop generating"]'));
    }

    function notifyConversationDone(title) {
      const text = String(title || "对话").slice(0, 80);
      if (window.DshApp && typeof window.DshApp.conversationDone === "function") {
        window.DshApp.conversationDone(text);
        return;
      }
      if (document.hidden && window.Notification && Notification.permission === "granted") {
        new Notification("对话已完成", { body: text, silent: false });
      }
    }

    function requestNativeNotifyPermission() {
      if (window.DshApp && typeof window.DshApp.requestNotifyPermission === "function") {
        window.DshApp.requestNotifyPermission();
      }
    }

    function olderHistoryButton() {
      const labeled = document.querySelector("[class$='_older'] button");
      if (labeled && !labeled.disabled) return labeled;
      const buttons = document.querySelectorAll("button");
      for (const button of buttons) {
        const text = String(button.textContent || "").trim();
        if ((text === "加载更早" || text === "Load earlier") && !button.disabled) return button;
      }
      return null;
    }

    function conversationScroller() {
      return document.querySelector("[data-conversation-scroll]")
        || document.querySelector("[class$='_scrollBody']")
        || document.querySelector("[class$='_scroll']");
    }

    function setupAutoLoadOlder() {
      let lastClick = 0;
      let userMoved = false;
      let touchY = 0;

      function maybeLoad() {
        const button = olderHistoryButton();
        if (!button) return;
        const now = Date.now();
        if (now - lastClick < 700) return;
        lastClick = now;
        button.click();
      }

      function onScroll(event) {
        const target = event.target;
        if (!(target instanceof Element)) return;
        if (target.scrollHeight <= target.clientHeight + 8) return;
        userMoved = true;
        if (target.scrollTop <= 64) maybeLoad();
      }

      function onTouchStart(event) {
        const touch = event.touches && event.touches[0];
        if (touch) touchY = touch.clientY;
      }

      function onTouchMove(event) {
        const touch = event.touches && event.touches[0];
        if (!touch) return;
        const pulled = touch.clientY - touchY;
        if (pulled < 28) return;
        const scroller = conversationScroller();
        if (scroller && scroller.scrollTop <= 8) {
          userMoved = true;
          maybeLoad();
        }
      }

      const seen = new WeakSet();
      const io = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && userMoved) maybeLoad();
        }
      }, { rootMargin: "48px 0px 0px 0px", threshold: 0.01 });

      function watchButton() {
        const button = olderHistoryButton() || document.querySelector("[class$='_older'] button");
        if (!button || seen.has(button)) return;
        seen.add(button);
        io.observe(button);
      }

      const mo = new MutationObserver(watchButton);
      mo.observe(document.documentElement, { childList: true, subtree: true });
      watchButton();
      document.addEventListener("scroll", onScroll, true);
      document.addEventListener("touchstart", onTouchStart, { passive: true, capture: true });
      document.addEventListener("touchmove", onTouchMove, { passive: true, capture: true });
      return () => {
        mo.disconnect();
        io.disconnect();
        document.removeEventListener("scroll", onScroll, true);
        document.removeEventListener("touchstart", onTouchStart, true);
        document.removeEventListener("touchmove", onTouchMove, true);
      };
    }

    function openWorkspaceBrowser(dir) {
      const path = String(dir || "").trim();
      const url = path
        ? `/api/dsh-gw-browse?path=${encodeURIComponent(path)}`
        : "/api/dsh-gw-browse";
      windowOpen(url);
      return true;
    }

    function createRunWatcher() {
      let lastId = "";
      let lastRunning = false;
      let armed = false;
      let timer = 0;
      return function watch(session, fallbackRunning) {
        const id = String((session && (session.sessionId || session.id)) || "current");
        const running = session && typeof session.running === "boolean"
          ? Boolean(session.running)
          : Boolean(fallbackRunning);
        if (id !== lastId) {
          lastId = id;
          lastRunning = running;
          armed = running;
          if (timer) window.clearTimeout(timer);
          timer = 0;
          return;
        }
        if (running) {
          if (!armed) requestNativeNotifyPermission();
          armed = true;
          lastRunning = true;
          if (timer) window.clearTimeout(timer);
          timer = 0;
          return;
        }
        if (!armed || !lastRunning) {
          lastRunning = false;
          return;
        }
        lastRunning = false;
        if (timer) window.clearTimeout(timer);
        const label = conversationLabel(session);
        timer = window.setTimeout(() => {
          timer = 0;
          armed = false;
          notifyConversationDone(label);
        }, 800);
      };
    }

    const plugin = {
      name: "dsh-cloud-gateway-client",
      inject: ["slots"],
      apply(ctx) {
        const slots = ctx.slots || (ctx.get && ctx.get("slots"));
        if (slots === undefined) return;
        let latestActions = null;
        let latestDraft = "";
        let latestCwd = "";
        const watchRun = createRunWatcher();

        ctx.effect(() => {
          const onDragOver = (event) => {
            if (!hasDocumentFiles(event)) return;
            event.preventDefault();
            if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
          };
          const onDrop = (event) => {
            if (!hasDocumentFiles(event)) return;
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            const docs = filesOf(event).filter((file) => !isOfficialImage(file));
            const actions = latestActions;
            const draft = latestDraft;
            clearOfficialDropOverlay();
            Promise.all(docs.map((file) => uploadFile(file))).then((files) => {
              if (!actions || !files.length) return;
              const prefix = draft && String(draft).trim() ? `${draft}\n` : "";
              actions.setDraft(`${prefix}${mentionBlock(files)}`);
              window.dispatchEvent(new CustomEvent("dsh-uploads-changed"));
            }).catch((error) => {
              console.error("[dsh-cloud-gateway] document drop failed", error);
            });
          };
          const onEscape = (event) => {
            if (event.key === "Escape") clearOfficialDropOverlay();
          };
          const onFileClick = (event) => {
            const nav = event.target.closest?.("[data-mobile-nav=\"files\"], [data-mobile-nav=\"explorer\"]");
            if (nav) {
              event.preventDefault();
              event.stopPropagation();
              openWorkspaceBrowser(latestCwd);
              return;
            }
            const el = event.target.closest?.("button, [data-ref-chip], [data-produced-files-row] button");
            if (!el || el.closest?.("[data-mobile-nav]")) return;
            const title = el.getAttribute("title") || "";
            if (!looksLikeFsPath(title)) return;
            event.preventDefault();
            event.stopPropagation();
            openFileInBrowser(title);
          };
          document.addEventListener("dragover", onDragOver, true);
          document.addEventListener("drop", onDrop, true);
          document.addEventListener("click", onFileClick, true);
          window.addEventListener("keydown", onEscape, true);
          const stopAutoOlder = setupAutoLoadOlder();
          return () => {
            stopAutoOlder();
            document.removeEventListener("dragover", onDragOver, true);
            document.removeEventListener("drop", onDrop, true);
            document.removeEventListener("click", onFileClick, true);
            window.removeEventListener("keydown", onEscape, true);
          };
        });

        function Capture(props) {
          latestActions = props.inputActions;
          const input = props.input;
          latestDraft = (input && (input.text ?? input.draft ?? input.value)) || "";
          const cwd = props.session && (props.session.cwd || (props.session.header && props.session.header.cwd));
          if (cwd) latestCwd = cwd;
          watchRun(props.session, isDomRunning());
          return null;
        }

        slots.inject("conversation.input.left", () => slots.register(
          { name: "conversation.input.left", id: "dsh-gw-doc-drop", order: 80 },
          (props) => react.createElement(Capture, props),
        ));
      },
    };

    exports.default = plugin;
    return exports;
  },
});
