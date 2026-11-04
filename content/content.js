(() => {
  if (window.__webwriteLoaded) return;
  window.__webwriteLoaded = true;

  const PRESET_COLORS = [
    "#ef4444",
    "#f97316",
    "#eab308",
    "#22c55e",
    "#3b82f6",
    "#8b5cf6",
    "#ec4899",
    "#ffffff",
    "#000000",
  ];

  const MIN_WIDTH = 1;
  const MAX_WIDTH = 48;
  const MAX_UNDO = 50;

  class WebWriteOverlay {
    constructor() {
      this.enabled = false;
      this.drawing = false;
      this.tool = "pen";
      this.color = "#ef4444";
      this.lineWidth = 4;
      this.lastX = 0;
      this.lastY = 0;
      this.undoStack = [];
      this.redoStack = [];
      this.toolButtons = [];

      this.root = document.createElement("div");
      this.root.id = "webwrite-root";
      this.root.setAttribute("data-webwrite", "root");

      this.shadow = this.root.attachShadow({ mode: "closed" });

      this.canvas = document.createElement("canvas");
      this.canvas.id = "webwrite-canvas";

      this.toolbar = document.createElement("div");
      this.toolbar.className = "ww-toolbar";

      this.styleEl = document.createElement("style");
      this.styleEl.textContent = this.getStyles();

      this.shadow.append(this.styleEl, this.canvas, this.toolbar);
      document.documentElement.appendChild(this.root);

      this.ctx = this.canvas.getContext("2d");
      this.buildToolbar();
      this.bindCanvasEvents();
      this.bindKeyboard();
      this.resize();
      this.loadStrokes();

      window.addEventListener("resize", () => this.resize(), { passive: true });
      window.addEventListener("scroll", () => this.syncCanvasSize(), { passive: true });
    }

    getStyles() {
      return `
        :host, #webwrite-root { all: initial; }
        canvas {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          z-index: 2147483646;
          pointer-events: none;
          touch-action: none;
        }
        canvas.active { pointer-events: auto; cursor: crosshair; }
        canvas.eraser { cursor: cell; }
        canvas.highlighter { cursor: crosshair; }
        .ww-toolbar {
          position: fixed;
          left: 50%;
          bottom: 20px;
          transform: translateX(-50%);
          z-index: 2147483647;
          display: none;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px;
          max-width: min(96vw, 720px);
          padding: 10px 12px;
          border-radius: 14px;
          background: rgba(20, 20, 24, 0.92);
          color: #f4f4f5;
          font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
          font-size: 12px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.35);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255,255,255,0.08);
          pointer-events: auto;
        }
        .ww-toolbar.visible { display: flex; }
        .ww-toolbar button, .ww-toolbar input[type="color"] {
          font: inherit;
          border: none;
          border-radius: 8px;
          cursor: pointer;
        }
        .ww-toolbar button {
          padding: 6px 10px;
          background: rgba(255,255,255,0.1);
          color: inherit;
        }
        .ww-toolbar button:hover { background: rgba(255,255,255,0.18); }
        .ww-toolbar button.active {
          background: #2563eb;
          color: #fff;
        }
        .ww-toolbar button.danger { background: rgba(220,38,38,0.35); }
        .ww-toolbar button.danger:hover { background: rgba(220,38,38,0.55); }
        .ww-colors { display: flex; gap: 4px; flex-wrap: wrap; }
        .ww-swatch {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          border: 2px solid transparent;
          padding: 0;
        }
        .ww-swatch.active { border-color: #fff; box-shadow: 0 0 0 1px #2563eb; }
        .ww-width {
          display: flex;
          align-items: center;
          gap: 6px;
          min-width: 120px;
        }
        .ww-width input[type="range"] { width: 80px; accent-color: #2563eb; }
        .ww-width span { min-width: 28px; text-align: right; opacity: 0.85; }
        .ww-custom-color {
          width: 28px;
          height: 28px;
          padding: 0;
          background: transparent;
        }
        .ww-badge {
          padding: 4px 8px;
          border-radius: 6px;
          background: rgba(37,99,235,0.35);
          font-weight: 600;
          white-space: nowrap;
        }
      `;
    }

    storageKey() {
      return `webwrite:strokes:${location.hostname}${location.pathname}`;
    }

    saveStrokes() {
      try {
        const data = this.canvas.toDataURL("image/png");
        sessionStorage.setItem(this.storageKey(), data);
      } catch {
        /* quota or tainted canvas */
      }
    }

    loadStrokes() {
      try {
        const data = sessionStorage.getItem(this.storageKey());
        if (!data) {
          this.pushUndoSnapshot();
          return;
        }
        const img = new Image();
        img.onload = () => {
          this.ctx.drawImage(img, 0, 0);
          this.undoStack = [];
          this.redoStack = [];
          this.pushUndoSnapshot();
        };
        img.src = data;
      } catch {
        this.pushUndoSnapshot();
      }
    }

    snapshot() {
      try {
        return this.canvas.toDataURL("image/png");
      } catch {
        return null;
      }
    }

    pushUndoSnapshot() {
      const data = this.snapshot();
      if (!data) return;
      this.undoStack.push(data);
      if (this.undoStack.length > MAX_UNDO) this.undoStack.shift();
      this.redoStack = [];
    }

    restoreFromDataUrl(dataUrl) {
      if (!dataUrl) return;
      const img = new Image();
      img.onload = () => {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);
        this.saveStrokes();
      };
      img.src = dataUrl;
    }

    undo() {
      if (this.undoStack.length <= 1) return;
      const current = this.undoStack.pop();
      this.redoStack.push(current);
      const prev = this.undoStack[this.undoStack.length - 1];
      this.restoreFromDataUrl(prev);
    }

    redo() {
      if (!this.redoStack.length) return;
      const next = this.redoStack.pop();
      this.undoStack.push(next);
      this.restoreFromDataUrl(next);
    }

    syncCanvasSize() {
      const w = document.documentElement.clientWidth;
      const h = document.documentElement.clientHeight;
      if (this.canvas.width === w && this.canvas.height === h) return;
      this.resize(true);
    }

    resize(preserve = false) {
      const w = document.documentElement.clientWidth;
      const h = document.documentElement.clientHeight;
      let snapshot = null;
      if (preserve && this.canvas.width > 0) {
        snapshot = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
      }
      const prev = preserve ? this.canvas.toDataURL("image/png") : null;

      this.canvas.width = w;
      this.canvas.height = h;
      this.ctx.lineCap = "round";
      this.ctx.lineJoin = "round";

      if (prev) {
        const img = new Image();
        img.onload = () => this.ctx.drawImage(img, 0, 0, w, h);
        img.src = prev;
      } else if (snapshot) {
        this.ctx.putImageData(snapshot, 0, 0);
      }
    }

    buildToolbar() {
      const badge = document.createElement("span");
      badge.className = "ww-badge";
      badge.textContent = "WebWrite";

      const penBtn = document.createElement("button");
      penBtn.type = "button";
      penBtn.textContent = "Pen";
      penBtn.className = "active";
      const eraserBtn = document.createElement("button");
      eraserBtn.type = "button";
      eraserBtn.textContent = "Eraser";

      const highlighterBtn = document.createElement("button");
      highlighterBtn.type = "button";
      highlighterBtn.textContent = "Highlight";

      this.toolButtons = [penBtn, highlighterBtn, eraserBtn];
      penBtn.addEventListener("click", () => this.setTool("pen"));
      highlighterBtn.addEventListener("click", () => this.setTool("highlighter"));
      eraserBtn.addEventListener("click", () => this.setTool("eraser"));

      const colorsWrap = document.createElement("div");
      colorsWrap.className = "ww-colors";
      this.swatchButtons = [];

      PRESET_COLORS.forEach((hex, i) => {
        const sw = document.createElement("button");
        sw.type = "button";
        sw.className = "ww-swatch" + (i === 0 ? " active" : "");
        sw.style.background = hex;
        sw.title = hex;
        sw.addEventListener("click", () => {
          this.color = hex;
          this.setTool("pen");
          this.swatchButtons.forEach((b) => b.classList.remove("active"));
          sw.classList.add("active");
        });
        colorsWrap.appendChild(sw);
        this.swatchButtons.push(sw);
      });

      const customColor = document.createElement("input");
      customColor.type = "color";
      customColor.className = "ww-custom-color";
      customColor.value = this.color;
      customColor.title = "Custom color";
      customColor.addEventListener("input", () => {
        this.color = customColor.value;
        this.setTool("pen");
        this.swatchButtons.forEach((b) => b.classList.remove("active"));
      });

      const widthWrap = document.createElement("div");
      widthWrap.className = "ww-width";
      const widthLabel = document.createElement("span");
      widthLabel.textContent = String(this.lineWidth);
      const widthRange = document.createElement("input");
      widthRange.type = "range";
      widthRange.min = String(MIN_WIDTH);
      widthRange.max = String(MAX_WIDTH);
      widthRange.value = String(this.lineWidth);
      widthRange.addEventListener("input", () => {
        this.lineWidth = Number(widthRange.value);
        widthLabel.textContent = widthRange.value;
      });

      widthWrap.append(widthRange, widthLabel);

      const undoBtn = document.createElement("button");
      undoBtn.type = "button";
      undoBtn.textContent = "Undo";
      undoBtn.title = "Ctrl+Z";
      undoBtn.addEventListener("click", () => this.undo());

      const redoBtn = document.createElement("button");
      redoBtn.type = "button";
      redoBtn.textContent = "Redo";
      redoBtn.title = "Ctrl+Y";
      redoBtn.addEventListener("click", () => this.redo());

      const clearBtn = document.createElement("button");
      clearBtn.type = "button";
      clearBtn.className = "danger";
      clearBtn.textContent = "Clear";
      clearBtn.addEventListener("click", () => {
        this.pushUndoSnapshot();
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.pushUndoSnapshot();
        sessionStorage.removeItem(this.storageKey());
      });

      const closeBtn = document.createElement("button");
      closeBtn.type = "button";
      closeBtn.textContent = "Exit";
      closeBtn.addEventListener("click", () => this.setEnabled(false));

      this.toolbar.append(
        badge,
        penBtn,
        highlighterBtn,
        eraserBtn,
        undoBtn,
        redoBtn,
        colorsWrap,
        customColor,
        widthWrap,
        clearBtn,
        closeBtn,
      );

      this.setTool("pen");
    }

    setTool(tool) {
      this.tool = tool;
      this.toolButtons.forEach((btn, i) => {
        const id =
          i === 0 ? "pen" : i === 1 ? "highlighter" : "eraser";
        btn.classList.toggle("active", tool === id);
      });
      this.canvas.classList.toggle("eraser", tool === "eraser");
      this.canvas.classList.toggle("highlighter", tool === "highlighter");
    }

    setEnabled(on) {
      this.enabled = on;
      this.drawing = false;
      this.canvas.classList.toggle("active", on);
      this.toolbar.classList.toggle("visible", on);
      if (!on) this.saveStrokes();
      chrome.runtime
        .sendMessage({ type: "WEBWRITE_SYNC", enabled: on })
        .catch(() => {});
    }

    posFromEvent(e) {
      const rect = this.canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (this.canvas.width / rect.width);
      const y = (e.clientY - rect.top) * (this.canvas.height / rect.height);
      return { x, y };
    }

    beginStroke(x, y) {
      this.pushUndoSnapshot();
      this.drawing = true;
      this.lastX = x;
      this.lastY = y;
      this.ctx.beginPath();
      this.ctx.moveTo(x, y);
    }

    continueStroke(x, y) {
      if (!this.drawing) return;
      this.ctx.strokeStyle = this.tool === "eraser" ? "rgba(0,0,0,1)" : this.color;
      const width =
        this.tool === "highlighter" ? Math.max(this.lineWidth, 8) : this.lineWidth;
      this.ctx.lineWidth = width;
      if (this.tool === "eraser") {
        this.ctx.globalCompositeOperation = "destination-out";
        this.ctx.globalAlpha = 1;
      } else if (this.tool === "highlighter") {
        this.ctx.globalCompositeOperation = "multiply";
        this.ctx.globalAlpha = 0.35;
      } else {
        this.ctx.globalCompositeOperation = "source-over";
        this.ctx.globalAlpha = 1;
      }
      this.ctx.lineTo(x, y);
      this.ctx.stroke();
      this.lastX = x;
      this.lastY = y;
    }

    endStroke() {
      if (!this.drawing) return;
      this.drawing = false;
      this.ctx.closePath();
      this.ctx.globalCompositeOperation = "source-over";
      this.ctx.globalAlpha = 1;
      this.saveStrokes();
    }

    bindCanvasEvents() {
      const onDown = (e) => {
        if (!this.enabled) return;
        e.preventDefault();
        e.stopPropagation();
        const { x, y } = this.posFromEvent(e);
        this.beginStroke(x, y);
      };

      const onMove = (e) => {
        if (!this.enabled || !this.drawing) return;
        e.preventDefault();
        e.stopPropagation();
        const { x, y } = this.posFromEvent(e);
        this.continueStroke(x, y);
      };

      const onUp = (e) => {
        if (!this.drawing) return;
        e.preventDefault();
        e.stopPropagation();
        this.endStroke();
      };

      this.canvas.addEventListener("pointerdown", onDown);
      this.canvas.addEventListener("pointermove", onMove);
      this.canvas.addEventListener("pointerup", onUp);
      this.canvas.addEventListener("pointercancel", onUp);
      this.canvas.addEventListener("pointerleave", onUp);
    }

    bindKeyboard() {
      document.addEventListener(
        "keydown",
        (e) => {
          if (!this.enabled) return;
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            this.setEnabled(false);
            return;
          }
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
            e.preventDefault();
            e.stopPropagation();
            this.undo();
            return;
          }
          if (
            (e.ctrlKey || e.metaKey) &&
            (e.key.toLowerCase() === "y" ||
              (e.key.toLowerCase() === "z" && e.shiftKey))
          ) {
            e.preventDefault();
            e.stopPropagation();
            this.redo();
          }
        },
        true,
      );
    }
  }

  const overlay = new WebWriteOverlay();

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "WEBWRITE_SET_ENABLED") {
      overlay.setEnabled(Boolean(message.enabled));
      sendResponse({ ok: true });
    }
    return false;
  });

  chrome.runtime.sendMessage({ type: "WEBWRITE_GET_STATE" }).then((res) => {
    if (res?.enabled) overlay.setEnabled(true);
  }).catch(() => {});
})();
