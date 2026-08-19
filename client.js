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

    const plugin = {
      name: "dsh-cloud-gateway-client",
      inject: ["slots"],
      apply(ctx) {
        const slots = ctx.slots || (ctx.get && ctx.get("slots"));
        if (slots === undefined) return;
        let latestActions = null;
        let latestDraft = "";

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
            const el = event.target.closest?.("button, [data-ref-chip], [data-produced-files-row] button");
            if (!el) return;
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
          return () => {
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
