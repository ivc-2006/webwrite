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
  const MAX_WIDTH = 64;
  const MAX_UNDO = 50;
  const MIN_ERASER = 4;
  const MAX_ERASER = 120;
  const TEXT_TOOL = "text";
  const CONVERT_TOOL = "convert";
  const INK_TOOLS = new Set(["pen", "brush", "highlighter", "eraser"]);
  const SHAPE_TOOLS = new Set(["line", "arrow"]);
  const BOX_TOOLS = new Set([...SHAPE_TOOLS, CONVERT_TOOL]);

  class WebWriteOverlay {
    constructor() {
      this.enabled = false;
      this.drawing = false;
      this.tool = "pen";
      this.color = "#ef4444";
      this.lineWidth = 4;
      this.eraserWidth = 24;
      this.opacity = 1;
      this.textFontKey = "hand";
      this.textFontSize = 28;
      this.textEditBounds = null;
      this.toolbarMinimized = false;
      this.recording = false;
      this.fabPos = { bottom: 96, right: 24 };
      this.recordMode = "av";
      this.inkSession = null;
      this.shapeStart = null;
      this.activeShape = null;
      this.activePointerId = null;
      this.shiftLine = false;
      this.inkPointerDown = null;
      this.bgPreset = "none";
      this.bgPattern = "none";
      this.bgFill = "#ffffff";
      this.bgLine = "#94a3b8";
      this.bgOpacity = 0;
      this.bgSpacing = 28;
      this.undoStack = [];
      this.redoStack = [];
      this.toolButtons = new Map();

      this.root = document.createElement("div");
      this.root.id = "webwrite-root";
      this.shadow = this.root.attachShadow({ mode: "closed" });

      this.canvas = document.createElement("canvas");
      this.canvas.className = "ww-ink";
      this.bgCanvas = document.createElement("canvas");
      this.bgCanvas.className = "ww-bg";
      this.previewCanvas = document.createElement("canvas");
      this.previewCanvas.className = "ww-preview";
      this.toolbar = document.createElement("div");
      this.toolbar.className = "ww-toolbar";
      this.toastEl = document.createElement("div");
      this.toastEl.className = "ww-toast";

      this.styleEl = document.createElement("style");
      this.styleEl.textContent = this.getStyles();
      this.katexStyleEl = document.createElement("style");
      this.katexStyleEl.textContent = "/* KaTeX loading */";
      this.measureHost = document.createElement("div");
      this.measureHost.className = "ww-measure-host";
      this.textPanel = null;
      this.inlineEditor = document.createElement("div");
      this.inlineEditor.className = "ww-inline-text";
      this.inlineHint = document.createElement("div");
      this.inlineHint.className = "ww-inline-hint";
      this.fab = document.createElement("button");
      this.fab.type = "button";
      this.fab.className = "ww-fab";
      this.fab.title = "WebWrite — expand toolbar (drag to move)";
      this.fab.textContent = "✎";
      this.fab.hidden = true;
      this.sheetMenu = document.createElement("div");
      this.sheetMenu.className = "ww-sheet-menu";
      this.sheetMenu.hidden = true;

      this.docLayer = document.createElement("div");
      this.docLayer.className = "ww-doc-layer";
      this.docInner = document.createElement("div");
      this.docInner.className = "ww-doc-inner";
      this.docInner.append(this.bgCanvas, this.canvas, this.previewCanvas);
      this.docLayer.appendChild(this.docInner);

      this.root.style.position = "fixed";
      this.root.style.inset = "0";
      this.root.style.width = "100%";
      this.root.style.height = "100%";
      this.root.style.zIndex = "2147483640";
      this.root.style.pointerEvents = "none";

      this.shadow.append(
        this.styleEl,
        this.katexStyleEl,
        this.measureHost,
        this.docLayer,
        this.toolbar,
        this.sheetMenu,
        this.inlineHint,
        this.inlineEditor,
        this.fab,
        this.toastEl,
      );
      document.body.appendChild(this.root);
      window.__webwriteMeasureHost = this.measureHost;
      this.katexStylesLoaded = false;
      this.katexStylesLoading = null;

      this.ctx = this.canvas.getContext("2d", { desynchronized: true });
      this.bgCtx = this.bgCanvas.getContext("2d", { desynchronized: true });
      this.previewCtx = this.previewCanvas.getContext("2d", { desynchronized: true });

      this.recorder = new window.WebWriteRecorder();
      this.buildToolbar();
      this.buildInlineEditor();
      this.buildFab();
      this.bindCanvasEvents();
      this.bindKeyboard();
      this.loadPreferences();
      this.resizeDocument();
      this.loadStrokes();

      window.addEventListener("resize", () => this.onWindowResize(), { passive: true });
    }

    viewportSize() {
      return {
        w: document.documentElement.clientWidth,
        h: window.innerHeight,
      };
    }

    onWindowResize() {
      const { w } = this.viewportSize();
      if (this.canvas.width !== w) this.resizeDocument(true);
    }

    updateInkPointerEvents() {
      const allowInk = this.enabled;
      this.canvas.style.pointerEvents = allowInk ? "auto" : "none";
      this.canvas.classList.toggle("active", allowInk);
    }

    getStyles() {
      return `
        @import url("https://fonts.googleapis.com/css2?family=Caveat:wght@500;600&family=Inter:wght@400;600&family=JetBrains+Mono&display=swap");
        canvas.ww-bg {
          z-index: 1;
        }
        canvas.ww-ink {
          z-index: 2;
        }
        canvas.ww-preview {
          z-index: 3;
          pointer-events: none !important;
        }
        .ww-doc-layer {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
        }
        .ww-doc-inner {
          position: relative;
          width: 100%;
          height: 100%;
        }
        canvas.ww-bg, canvas.ww-ink, canvas.ww-preview {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          display: block;
        }
        canvas {
          pointer-events: none;
          touch-action: pan-y pinch-zoom;
        }
        canvas.active {
          pointer-events: auto;
          cursor: crosshair;
        }
        canvas.ww-ink.eraser { cursor: cell; }
        canvas.ww-ink.text-tool { cursor: text; }
        .ww-toolbar {
          position: fixed;
          left: 50%;
          bottom: 16px;
          transform: translateX(-50%);
          z-index: 2147483647;
          display: none;
          flex-direction: column;
          gap: 8px;
          max-width: min(98vw, 880px);
          padding: 10px 12px;
          border-radius: 14px;
          background: rgba(16, 16, 20, 0.94);
          color: #f4f4f5;
          font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
          font-size: 12px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.4);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255,255,255,0.08);
          pointer-events: auto;
        }
        .ww-toolbar.visible { display: flex; }
        .ww-row { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
        .ww-toolbar button, .ww-toolbar input[type="color"], .ww-toolbar select {
          font: inherit;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          color: inherit;
        }
        .ww-toolbar button {
          padding: 6px 9px;
          background: rgba(255,255,255,0.1);
        }
        .ww-toolbar button:hover { background: rgba(255,255,255,0.18); }
        .ww-toolbar button.active { background: #2563eb; color: #fff; }
        .ww-toolbar button.danger { background: rgba(220,38,38,0.35); }
        .ww-toolbar button.danger:hover { background: rgba(220,38,38,0.55); }
        .ww-toolbar select {
          padding: 5px 8px;
          background: rgba(255,255,255,0.12);
        }
        .ww-sep { width: 1px; height: 22px; background: rgba(255,255,255,0.15); margin: 0 2px; }
        .ww-colors { display: flex; gap: 4px; flex-wrap: wrap; }
        .ww-swatch {
          width: 22px; height: 22px; border-radius: 50%;
          border: 2px solid transparent; padding: 0;
        }
        .ww-swatch.active { border-color: #fff; box-shadow: 0 0 0 1px #2563eb; }
        .ww-slider { display: flex; align-items: center; gap: 6px; }
        .ww-slider input[type="range"] { width: 72px; accent-color: #2563eb; }
        .ww-slider span { min-width: 26px; text-align: right; opacity: 0.85; }
        .ww-custom-color { width: 28px; height: 28px; padding: 0; background: transparent; }
        .ww-badge {
          padding: 4px 8px; border-radius: 6px;
          background: rgba(37,99,235,0.35); font-weight: 600;
        }
        .ww-hint { opacity: 0.65; font-size: 11px; }
        .ww-export select { max-width: 220px; }
        .ww-export button { white-space: nowrap; }
        .ww-toast {
          position: fixed;
          bottom: 120px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 2147483647;
          padding: 8px 14px;
          border-radius: 8px;
          background: rgba(0,0,0,0.85);
          color: #fff;
          font-size: 12px;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.2s;
        }
        .ww-toast.show { opacity: 1; }
        .ww-bg-controls { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
        .ww-bg-controls label { font-size: 11px; opacity: 0.75; }
        .ww-bg-controls input[type="color"] {
          width: 26px; height: 26px; padding: 0; border: none; background: transparent;
        }
        .ww-toolbar[data-contrast="light"] {
          background: rgba(255, 255, 255, 0.96);
          color: #0f172a;
          border-color: rgba(15, 23, 42, 0.12);
        }
        .ww-toolbar[data-contrast="light"] button { background: rgba(15, 23, 42, 0.08); }
        .ww-toolbar[data-contrast="light"] select,
        .ww-toolbar[data-contrast="light"] .ww-sheet-trigger {
          background: rgba(15, 23, 42, 0.06);
          color: #0f172a;
        }
        .ww-toolbar[data-contrast="dark"] {
          background: rgba(16, 16, 22, 0.94);
          color: #f8fafc;
        }
        .ww-sheet-wrap { position: relative; }
        .ww-sheet-trigger {
          padding: 6px 10px;
          border-radius: 8px;
          background: rgba(255,255,255,0.12);
          cursor: pointer;
          max-width: 180px;
          text-align: left;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .ww-sheet-menu {
          position: fixed;
          z-index: 2147483648;
          min-width: 220px;
          max-width: min(92vw, 320px);
          max-height: min(50vh, 320px);
          overflow-y: auto;
          padding: 6px;
          border-radius: 12px;
          box-shadow: 0 12px 40px rgba(0,0,0,0.45);
          border: 1px solid rgba(255,255,255,0.15);
        }
        .ww-sheet-menu[data-contrast="light"] {
          background: #ffffff;
          color: #0f172a;
          border-color: #cbd5e1;
        }
        .ww-sheet-menu[data-contrast="dark"] {
          background: #1e293b;
          color: #f8fafc;
          border-color: #475569;
        }
        .ww-sheet-menu button {
          display: block;
          width: 100%;
          text-align: left;
          padding: 8px 10px;
          margin: 2px 0;
          border-radius: 8px;
          background: transparent;
          color: inherit;
          border: none;
          cursor: pointer;
        }
        .ww-sheet-menu button:hover { background: rgba(37, 99, 235, 0.2); }
        .ww-sheet-menu button.active { background: rgba(37, 99, 235, 0.35); font-weight: 600; }
        .ww-text-panel .ww-text-actions { display: flex; gap: 6px; flex-wrap: wrap; }
        .ww-inline-text {
          position: fixed;
          z-index: 2147483648;
          display: none;
          padding: 6px 8px;
          border-radius: 6px;
          outline: 2px solid #2563eb;
          background: rgba(255,255,255,0.92);
          color: #0f172a;
          box-shadow: 0 4px 20px rgba(0,0,0,0.25);
          pointer-events: auto;
          overflow: auto;
          white-space: pre-wrap;
          word-break: break-word;
          min-width: 80px;
          min-height: 32px;
          max-width: min(92vw, 640px);
        }
        .ww-inline-text.open { display: block; }
        .ww-inline-text[data-contrast="dark"] {
          background: rgba(15, 23, 42, 0.94);
          color: #f8fafc;
        }
        .ww-inline-hint {
          position: fixed;
          z-index: 2147483648;
          display: none;
          padding: 4px 8px;
          border-radius: 6px;
          font-size: 11px;
          background: rgba(0,0,0,0.75);
          color: #fff;
          pointer-events: none;
        }
        .ww-inline-hint.open { display: block; }
        .ww-toolbar.minimized { display: none !important; }
        .ww-fab {
          position: fixed;
          z-index: 2147483647;
          width: 54px;
          height: 54px;
          border-radius: 50%;
          border: none;
          cursor: grab;
          font-size: 22px;
          background: linear-gradient(145deg, #2563eb, #1d4ed8);
          color: #fff;
          box-shadow: 0 6px 24px rgba(37,99,235,0.55);
          pointer-events: auto;
          touch-action: none;
        }
        .ww-fab:active { cursor: grabbing; }
        .ww-fab.recording { animation: ww-pulse 1.2s infinite; background: linear-gradient(145deg,#dc2626,#b91c1c); }
        @keyframes ww-pulse { 50% { transform: scale(1.06); opacity: 0.92; } }
        canvas.text-tool { cursor: text; }
        .ww-measure-host {
          position: fixed;
          left: -9999px;
          top: 0;
          pointer-events: none;
          visibility: hidden;
        }
      `;
    }

    ensureKatexStyles() {
      if (this.katexStylesLoaded) return Promise.resolve();
      if (this.katexStylesLoading) return this.katexStylesLoading;
      const cssUrl = chrome.runtime.getURL("lib/katex.min.css");
      this.katexStylesLoading = fetch(cssUrl)
        .then((r) => r.text())
        .then((css) => {
          const libBase = chrome.runtime.getURL("lib/");
          const fixed = css.replace(/url\(fonts\//g, `url(${libBase}fonts/`);
          this.katexStyleEl.textContent = fixed;
          this.katexStylesLoaded = true;
        })
        .catch(() => {
          this.katexStyleEl.textContent = "";
        })
        .finally(() => {
          this.katexStylesLoading = null;
        });
      return this.katexStylesLoading;
    }

    strokeOptions() {
      return {
        tool: this.tool,
        color: this.color,
        baseWidth: this.lineWidth,
        eraserWidth: this.eraserWidth,
        opacity: this.opacity,
      };
    }

    updateToolbarTheme() {
      const contrast = window.WebWriteTheme.applyToolbarContrast(this.toolbar, {
        sheetOpacity: this.bgOpacity,
        sheetPattern: this.bgPattern,
        sheetFill: this.bgFill,
      });
      if (this.sheetMenu) this.sheetMenu.dataset.contrast = contrast;
      if (this.inlineEditor) this.inlineEditor.dataset.contrast = contrast;
    }

    storageKey() {
      return `webwrite:v5:strokes:${location.hostname}${location.pathname}`;
    }

    prefsKey() {
      return "webwrite:prefs";
    }

    saveStrokes() {
      try {
        sessionStorage.setItem(this.storageKey(), this.canvas.toDataURL("image/png"));
      } catch {
        /* ignore */
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

    loadPreferences() {
      chrome.storage.local.get(this.prefsKey(), (data) => {
        const prefs = data[this.prefsKey()];
        if (!prefs) return;
        if (prefs.color) this.color = prefs.color;
        if (prefs.lineWidth) this.lineWidth = prefs.lineWidth;
        if (prefs.eraserWidth) this.eraserWidth = prefs.eraserWidth;
        if (prefs.textFontKey) this.textFontKey = prefs.textFontKey;
        if (prefs.textFontSize) this.textFontSize = prefs.textFontSize;
        if (prefs.toolbarMinimized != null) this.toolbarMinimized = prefs.toolbarMinimized;
        if (prefs.fabPos) this.fabPos = prefs.fabPos;
        if (prefs.recordMode) this.recordMode = prefs.recordMode;
        if (prefs.opacity != null) this.opacity = prefs.opacity;
        if (prefs.tool && prefs.tool !== "scroll") this.setTool(prefs.tool);
        if (prefs.bgPreset) this.applyBgPreset(prefs.bgPreset, false);
        else if (prefs.bgPattern) {
          this.bgPattern = prefs.bgPattern;
          this.bgFill = prefs.bgFill || this.bgFill;
          this.bgLine = prefs.bgLine || this.bgLine;
          this.bgOpacity = prefs.bgOpacity ?? this.bgOpacity;
          this.bgSpacing = prefs.bgSpacing ?? this.bgSpacing;
          this.repaintBackground();
        }
        this.syncToolbarControls();
        if (prefs.toolbarMinimized) this.setToolbarMinimized(true);
        else this.applyFabPosition();
      });
    }

    savePreferences() {
      chrome.storage.local.set({
        [this.prefsKey()]: {
          color: this.color,
          lineWidth: this.lineWidth,
          eraserWidth: this.eraserWidth,
          textFontKey: this.textFontKey,
          textFontSize: this.textFontSize,
          toolbarMinimized: this.toolbarMinimized,
          fabPos: this.fabPos,
          recordMode: this.recordMode,
          opacity: this.opacity,
          tool: this.tool,
          bgPreset: this.bgPreset,
          bgPattern: this.bgPattern,
          bgFill: this.bgFill,
          bgLine: this.bgLine,
          bgOpacity: this.bgOpacity,
          bgSpacing: this.bgSpacing,
        },
      });
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
      this.restoreFromDataUrl(this.undoStack[this.undoStack.length - 1]);
    }

    redo() {
      if (!this.redoStack.length) return;
      const next = this.redoStack.pop();
      this.undoStack.push(next);
      this.restoreFromDataUrl(next);
    }

    fileBaseName() {
      const host = location.hostname.replace(/[^a-z0-9.-]/gi, "_") || "page";
      return `webwrite-${host}-${Date.now()}`;
    }

    showToast(message, isError = false) {
      this.toastEl.textContent = message;
      this.toastEl.style.background = isError ? "rgba(185,28,28,0.92)" : "rgba(0,0,0,0.85)";
      this.toastEl.classList.add("show");
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => this.toastEl.classList.remove("show"), 3200);
    }

    waitFrames(count = 2) {
      let chain = Promise.resolve();
      for (let i = 0; i < count; i++) {
        chain = chain.then(() => new Promise((r) => requestAnimationFrame(r)));
      }
      return chain;
    }

    hideToolbarForCapture() {
      const prev = this.toolbar.style.visibility;
      this.toolbar.style.visibility = "hidden";
      return () => {
        this.toolbar.style.visibility = prev;
      };
    }

    getInkOnlyPng() {
      if (this.bgPattern === "none" || this.bgOpacity <= 0) {
        return this.snapshot();
      }
      const c = document.createElement("canvas");
      c.width = this.canvas.width;
      c.height = this.canvas.height;
      const ctx = c.getContext("2d");
      ctx.drawImage(this.bgCanvas, 0, 0);
      ctx.drawImage(this.canvas, 0, 0);
      return c.toDataURL("image/png");
    }

    bgSettings() {
      return {
        pattern: this.bgPattern,
        fill: this.bgFill,
        line: this.bgLine,
        opacity: this.bgOpacity,
        spacing: this.bgSpacing,
      };
    }

    repaintBackground() {
      if (!this.bgCtx) return;
      window.WebWriteBackground.paint(
        this.bgCtx,
        this.bgCanvas.width,
        this.bgCanvas.height,
        this.bgSettings(),
      );
      this.bgCanvas.style.display =
        this.enabled && this.bgPattern !== "none" && this.bgOpacity > 0 ? "block" : "none";
      this.updateToolbarTheme();
    }

    applyBgPreset(presetId, save = true) {
      this.bgPreset = presetId;
      const preset = window.WebWriteBackground.PRESETS[presetId];
      if (preset) {
        this.bgPattern = preset.pattern;
        this.bgFill = preset.fill;
        this.bgLine = preset.line;
        this.bgOpacity = preset.opacity;
        this.bgSpacing = preset.spacing;
      } else if (presetId === "custom") {
        /* keep current manual colors */
      } else {
        this.bgPattern = "none";
        this.bgOpacity = 0;
      }
      if (this.sheetTrigger) this.updateSheetTriggerLabel();
      this.syncToolbarControls();
      this.repaintBackground();
      if (save) this.savePreferences();
    }

    async capturePageWithInk() {
      const restore = this.hideToolbarForCapture();
      try {
        this.clearPreview();
        await this.waitFrames(2);
        const res = await chrome.runtime.sendMessage({ type: "WEBWRITE_CAPTURE_VISIBLE" });
        if (!res?.ok || !res.dataUrl) {
          throw new Error(res?.error || "Screenshot failed");
        }
        return res.dataUrl;
      } finally {
        restore();
      }
    }

    async runExport(mode) {
      const base = this.fileBaseName();
      try {
        this.showToast("Exporting…");

        if (mode === "png-ink") {
          const dataUrl = this.getInkOnlyPng();
          window.WebWriteExport.downloadDataUrl(dataUrl, `${base}-drawings-only.png`);
          this.showToast("PNG saved (drawings only)");
          return;
        }

        if (mode === "pdf-ink") {
          const dataUrl = this.getInkOnlyPng();
          await window.WebWriteExport.savePdfFromImage(dataUrl, `${base}-drawings-only.pdf`);
          this.showToast("PDF saved (drawings only)");
          return;
        }

        const dataUrl = await this.capturePageWithInk();

        if (mode === "png-full") {
          window.WebWriteExport.downloadDataUrl(dataUrl, `${base}-page-and-drawings.png`);
          this.showToast("PNG saved (page + drawings)");
          return;
        }

        if (mode === "pdf-full") {
          await window.WebWriteExport.savePdfFromImage(dataUrl, `${base}-page-and-drawings.pdf`);
          this.showToast("PDF saved (page + drawings)");
          return;
        }
      } catch (err) {
        this.showToast(err?.message || "Export failed", true);
      }
    }

    resizeDocument(preserve = false) {
      const { w, h } = this.viewportSize();
      const prev = preserve ? this.snapshot() : null;
      const oldW = this.canvas.width;
      const oldH = this.canvas.height;

      for (const c of [this.canvas, this.bgCanvas, this.previewCanvas]) {
        c.width = w;
        c.height = h;
      }
      this.ctx.lineCap = "round";
      this.ctx.lineJoin = "round";

      if (prev && oldW > 0 && oldH > 0) {
        const img = new Image();
        img.onload = () => {
          this.ctx.clearRect(0, 0, w, h);
          this.bgCtx.clearRect(0, 0, w, h);
          this.ctx.drawImage(img, 0, 0, oldW, oldH, 0, 0, w, h);
          this.repaintBackground();
          this.saveStrokes();
        };
        img.src = prev;
        return;
      }
      if (prev) this.restoreFromDataUrl(prev);
      else this.repaintBackground();
    }

    clearPreview() {
      this.previewCtx.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);
    }

    addToolButton(row, id, label) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = label;
      btn.addEventListener("click", () => this.setTool(id));
      this.toolButtons.set(id, btn);
      row.appendChild(btn);
      return btn;
    }

    buildToolbar() {
      const row1 = document.createElement("div");
      row1.className = "ww-row";
      const row2 = document.createElement("div");
      row2.className = "ww-row";

      const badge = document.createElement("span");
      badge.className = "ww-badge";
      badge.textContent = "WebWrite";

      row1.append(badge);
      ["pen", "brush", "highlighter", "eraser", "text", "convert", "line", "arrow"].forEach((id) => {
        const labels = {
          pen: "Pen",
          brush: "Brush",
          highlighter: "Highlight",
          eraser: "Eraser",
          text: "Text",
          convert: "Ink→Text",
          line: "Line",
          arrow: "Arrow",
        };
        this.addToolButton(row1, id, labels[id]);
      });

      const sep1 = document.createElement("span");
      sep1.className = "ww-sep";
      row1.appendChild(sep1);

      const undoBtn = document.createElement("button");
      undoBtn.type = "button";
      undoBtn.textContent = "Undo";
      undoBtn.title = "Ctrl+Z";
      undoBtn.addEventListener("click", () => this.undo());

      const redoBtn = document.createElement("button");
      redoBtn.type = "button";
      redoBtn.textContent = "Redo";
      redoBtn.title = "Ctrl+Shift+Z";
      redoBtn.addEventListener("click", () => this.redo());

      const exportWrap = document.createElement("div");
      exportWrap.className = "ww-export ww-row";
      const exportSelect = document.createElement("select");
      exportSelect.title = "Export format";
      [
        ["png-full", "PNG — page + drawings"],
        ["png-ink", "PNG — drawings only"],
        ["pdf-full", "PDF — page + drawings"],
        ["pdf-ink", "PDF — drawings only"],
      ].forEach(([value, label]) => {
        const opt = document.createElement("option");
        opt.value = value;
        opt.textContent = label;
        exportSelect.appendChild(opt);
      });
      const exportBtn = document.createElement("button");
      exportBtn.type = "button";
      exportBtn.textContent = "Export";
      exportBtn.addEventListener("click", () => this.runExport(exportSelect.value));

      exportWrap.append(exportSelect, exportBtn);

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

      const minimizeBtn = document.createElement("button");
      minimizeBtn.type = "button";
      minimizeBtn.textContent = "Minimize";
      minimizeBtn.title = "Collapse to floating pen button (drag the button to move it)";
      minimizeBtn.addEventListener("click", () => this.setToolbarMinimized(true));

      this.recordBtn = document.createElement("button");
      this.recordBtn.type = "button";
      this.recordBtn.textContent = "Rec";
      this.recordBtn.title = "Start/stop recording — file downloads when you stop";
      this.recordBtn.addEventListener("click", () => this.toggleRecording());

      this.recordModeSelect = document.createElement("select");
      this.recordModeSelect.title = "Recording type";
      [
        ["av", "Video + audio"],
        ["video", "Video only"],
        ["audio", "Audio only"],
      ].forEach(([value, label]) => {
        const opt = document.createElement("option");
        opt.value = value;
        opt.textContent = label;
        this.recordModeSelect.appendChild(opt);
      });
      this.recordModeSelect.value = this.recordMode;
      this.recordModeSelect.addEventListener("change", () => {
        this.recordMode = this.recordModeSelect.value;
        this.savePreferences();
      });

      this.saveRecBtn = document.createElement("button");
      this.saveRecBtn.type = "button";
      this.saveRecBtn.textContent = "Save rec";
      this.saveRecBtn.title = "Download the last recording again";
      this.saveRecBtn.addEventListener("click", () => {
        if (this.recorder.downloadLast()) this.showToast("Recording downloaded");
        else this.showToast("No recording saved yet", true);
      });

      row1.append(
        undoBtn,
        redoBtn,
        exportWrap,
        this.recordModeSelect,
        this.recordBtn,
        this.saveRecBtn,
        minimizeBtn,
        clearBtn,
        closeBtn,
      );

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
          if (INK_TOOLS.has(this.tool) || SHAPE_TOOLS.has(this.tool)) this.setTool(this.tool);
          else this.setTool("pen");
          this.swatchButtons.forEach((b) => b.classList.remove("active"));
          sw.classList.add("active");
          this.savePreferences();
        });
        colorsWrap.appendChild(sw);
        this.swatchButtons.push(sw);
      });

      this.customColor = document.createElement("input");
      this.customColor.type = "color";
      this.customColor.className = "ww-custom-color";
      this.customColor.value = this.color;
      this.customColor.addEventListener("input", () => {
        this.color = this.customColor.value;
        this.swatchButtons.forEach((b) => b.classList.remove("active"));
        this.savePreferences();
      });

      this.widthLabel = document.createElement("span");
      this.widthLabel.textContent = String(this.lineWidth);
      this.widthRange = document.createElement("input");
      this.widthRange.type = "range";
      this.widthRange.min = String(MIN_WIDTH);
      this.widthRange.max = String(MAX_WIDTH);
      this.widthRange.value = String(this.lineWidth);
      this.widthRange.addEventListener("input", () => {
        this.lineWidth = Number(this.widthRange.value);
        this.widthLabel.textContent = this.widthRange.value;
        this.savePreferences();
      });

      const widthWrap = document.createElement("div");
      widthWrap.className = "ww-slider";
      const penSizeLabel = document.createElement("span");
      penSizeLabel.className = "ww-hint";
      penSizeLabel.textContent = "Pen";
      widthWrap.append(penSizeLabel, this.widthRange, this.widthLabel);

      this.eraserWidthLabel = document.createElement("span");
      this.eraserWidthLabel.textContent = String(this.eraserWidth);
      this.eraserWidthRange = document.createElement("input");
      this.eraserWidthRange.type = "range";
      this.eraserWidthRange.min = String(MIN_ERASER);
      this.eraserWidthRange.max = String(MAX_ERASER);
      this.eraserWidthRange.value = String(this.eraserWidth);
      this.eraserWidthRange.title = "Eraser size";
      this.eraserWidthRange.addEventListener("input", () => {
        this.eraserWidth = Number(this.eraserWidthRange.value);
        this.eraserWidthLabel.textContent = this.eraserWidthRange.value;
        this.savePreferences();
      });
      const eraserWrap = document.createElement("div");
      eraserWrap.className = "ww-slider";
      const eraserTitle = document.createElement("span");
      eraserTitle.className = "ww-hint";
      eraserTitle.textContent = "Eraser";
      eraserWrap.append(eraserTitle, this.eraserWidthRange, this.eraserWidthLabel);

      this.textFontSelect = document.createElement("select");
      this.textFontSelect.title = "Text font style";
      Object.entries(window.WebWriteText.TEXT_FONTS).forEach(([key, meta]) => {
        const opt = document.createElement("option");
        opt.value = key;
        opt.textContent = meta.label;
        this.textFontSelect.appendChild(opt);
      });
      this.textFontSelect.value = this.textFontKey;
      this.textFontSelect.addEventListener("change", () => {
        this.textFontKey = this.textFontSelect.value;
        this.savePreferences();
      });

      this.textSizeLabel = document.createElement("span");
      this.textSizeLabel.textContent = String(this.textFontSize);
      this.textSizeRange = document.createElement("input");
      this.textSizeRange.type = "range";
      this.textSizeRange.min = "14";
      this.textSizeRange.max = "72";
      this.textSizeRange.value = String(this.textFontSize);
      this.textSizeRange.addEventListener("input", () => {
        this.textFontSize = Number(this.textSizeRange.value);
        this.textSizeLabel.textContent = this.textSizeRange.value;
        this.savePreferences();
      });
      const textSizeWrap = document.createElement("div");
      textSizeWrap.className = "ww-slider";
      const textSizeTitle = document.createElement("span");
      textSizeTitle.className = "ww-hint";
      textSizeTitle.textContent = "Text size";
      textSizeWrap.append(textSizeTitle, this.textSizeRange, this.textSizeLabel);

      this.opacityLabel = document.createElement("span");
      this.opacityLabel.textContent = `${Math.round(this.opacity * 100)}%`;
      this.opacityRange = document.createElement("input");
      this.opacityRange.type = "range";
      this.opacityRange.min = "10";
      this.opacityRange.max = "100";
      this.opacityRange.value = String(Math.round(this.opacity * 100));
      this.opacityRange.title = "Ink opacity";
      this.opacityRange.addEventListener("input", () => {
        this.opacity = Number(this.opacityRange.value) / 100;
        this.opacityLabel.textContent = `${this.opacityRange.value}%`;
        this.savePreferences();
      });

      const opacityWrap = document.createElement("div");
      opacityWrap.className = "ww-slider";
      const opacityTitle = document.createElement("span");
      opacityTitle.textContent = "Opacity";
      opacityTitle.className = "ww-hint";
      opacityWrap.append(opacityTitle, this.opacityRange, this.opacityLabel);

      const hint = document.createElement("span");
      hint.className = "ww-hint";
      hint.textContent = "Ink→Text: drag box · Enter saves inline text · $math$";

      row2.append(
        colorsWrap,
        this.customColor,
        widthWrap,
        eraserWrap,
        this.textFontSelect,
        textSizeWrap,
        opacityWrap,
        hint,
      );

      const row3 = document.createElement("div");
      row3.className = "ww-row ww-bg-controls";

      const bgTitle = document.createElement("span");
      bgTitle.className = "ww-hint";
      bgTitle.textContent = "Sheet";

      this.sheetWrap = document.createElement("div");
      this.sheetWrap.className = "ww-sheet-wrap";
      this.sheetTrigger = document.createElement("button");
      this.sheetTrigger.type = "button";
      this.sheetTrigger.className = "ww-sheet-trigger";
      this.sheetTrigger.textContent = "None — show website";
      this.sheetTrigger.addEventListener("click", (e) => {
        e.stopPropagation();
        this.toggleSheetMenu(this.sheetTrigger);
      });
      this.sheetWrap.append(this.sheetTrigger);

      this.populateSheetMenu();

      this.bgPatternSelect = document.createElement("select");
      this.bgPatternSelect.title = "Pattern";
      [
        ["grid", "Grid"],
        ["dots", "Dots"],
        ["ruled", "Ruled"],
        ["diagonal", "Diagonal"],
        ["solid", "Solid fill"],
      ].forEach(([value, label]) => {
        const opt = document.createElement("option");
        opt.value = value;
        opt.textContent = label;
        this.bgPatternSelect.appendChild(opt);
      });
      this.bgPatternSelect.addEventListener("change", () => {
        this.bgPreset = "custom";
        this.bgPattern = this.bgPatternSelect.value;
        if (this.bgOpacity <= 0) this.bgOpacity = 0.85;
        this.updateSheetTriggerLabel();
        this.repaintBackground();
        this.savePreferences();
      });

      this.bgFillInput = document.createElement("input");
      this.bgFillInput.type = "color";
      this.bgFillInput.value = this.bgFill;
      this.bgFillInput.title = "Sheet fill color";
      this.bgFillInput.addEventListener("input", () => {
        this.bgFill = this.bgFillInput.value;
        this.bgPreset = "custom";
        if (this.bgOpacity <= 0) this.bgOpacity = 0.85;
        this.updateSheetTriggerLabel();
        this.repaintBackground();
        this.savePreferences();
      });

      this.bgLineInput = document.createElement("input");
      this.bgLineInput.type = "color";
      this.bgLineInput.value = this.bgLine;
      this.bgLineInput.title = "Grid / line color";
      this.bgLineInput.addEventListener("input", () => {
        this.bgLine = this.bgLineInput.value;
        this.bgPreset = "custom";
        this.updateSheetTriggerLabel();
        this.repaintBackground();
        this.savePreferences();
      });

      this.bgOpacityLabel = document.createElement("span");
      this.bgOpacityLabel.textContent = `${Math.round(this.bgOpacity * 100)}%`;
      this.bgOpacityRange = document.createElement("input");
      this.bgOpacityRange.type = "range";
      this.bgOpacityRange.min = "0";
      this.bgOpacityRange.max = "100";
      this.bgOpacityRange.value = String(Math.round(this.bgOpacity * 100));
      this.bgOpacityRange.title = "Sheet opacity";
      this.bgOpacityRange.addEventListener("input", () => {
        this.bgOpacity = Number(this.bgOpacityRange.value) / 100;
        this.bgOpacityLabel.textContent = `${this.bgOpacityRange.value}%`;
        if (this.bgOpacity > 0 && this.bgPattern === "none") this.bgPattern = "grid";
        this.bgPreset = "custom";
        this.updateSheetTriggerLabel();
        this.repaintBackground();
        this.savePreferences();
      });

      this.bgSpacingLabel = document.createElement("span");
      this.bgSpacingLabel.textContent = String(this.bgSpacing);
      this.bgSpacingRange = document.createElement("input");
      this.bgSpacingRange.type = "range";
      this.bgSpacingRange.min = "12";
      this.bgSpacingRange.max = "72";
      this.bgSpacingRange.value = String(this.bgSpacing);
      this.bgSpacingRange.title = "Grid spacing";
      this.bgSpacingRange.addEventListener("input", () => {
        this.bgSpacing = Number(this.bgSpacingRange.value);
        this.bgSpacingLabel.textContent = this.bgSpacingRange.value;
        this.bgPreset = "custom";
        this.updateSheetTriggerLabel();
        this.repaintBackground();
        this.savePreferences();
      });

      const bgOpacityWrap = document.createElement("div");
      bgOpacityWrap.className = "ww-slider";
      const bgOpLabel = document.createElement("label");
      bgOpLabel.textContent = "Cover";
      bgOpacityWrap.append(bgOpLabel, this.bgOpacityRange, this.bgOpacityLabel);

      const bgSpaceWrap = document.createElement("div");
      bgSpaceWrap.className = "ww-slider";
      const bgSpLabel = document.createElement("label");
      bgSpLabel.textContent = "Gap";
      bgSpaceWrap.append(bgSpLabel, this.bgSpacingRange, this.bgSpacingLabel);

      const fillLabel = document.createElement("label");
      fillLabel.textContent = "Fill";
      const lineLabel = document.createElement("label");
      lineLabel.textContent = "Lines";

      row3.append(
        bgTitle,
        this.sheetWrap,
        this.bgPatternSelect,
        fillLabel,
        this.bgFillInput,
        lineLabel,
        this.bgLineInput,
        bgOpacityWrap,
        bgSpaceWrap,
      );

      this.toolbar.append(row1, row2, row3);
      this.setTool("pen");
      this.applyBgPreset(this.bgPreset, false);
      if (this.toolbarMinimized) this.setToolbarMinimized(true);
      else this.applyFabPosition();
    }

    syncToolbarControls() {
      if (this.widthRange) {
        this.widthRange.value = String(this.lineWidth);
        this.widthLabel.textContent = String(this.lineWidth);
      }
      if (this.opacityRange) {
        this.opacityRange.value = String(Math.round(this.opacity * 100));
        this.opacityLabel.textContent = `${this.opacityRange.value}%`;
      }
      if (this.eraserWidthRange) {
        this.eraserWidthRange.value = String(this.eraserWidth);
        this.eraserWidthLabel.textContent = String(this.eraserWidth);
      }
      if (this.textFontSelect) this.textFontSelect.value = this.textFontKey;
      if (this.textSizeRange) {
        this.textSizeRange.value = String(this.textFontSize);
        this.textSizeLabel.textContent = String(this.textFontSize);
      }
      if (this.recordModeSelect) this.recordModeSelect.value = this.recordMode;
      if (this.customColor) this.customColor.value = this.color;
      this.updateSheetTriggerLabel();
      if (this.bgPatternSelect) this.bgPatternSelect.value = this.bgPattern;
      if (this.bgFillInput) this.bgFillInput.value = this.bgFill;
      if (this.bgLineInput) this.bgLineInput.value = this.bgLine;
      if (this.bgOpacityRange) {
        this.bgOpacityRange.value = String(Math.round(this.bgOpacity * 100));
        this.bgOpacityLabel.textContent = `${this.bgOpacityRange.value}%`;
      }
      if (this.bgSpacingRange) {
        this.bgSpacingRange.value = String(this.bgSpacing);
        this.bgSpacingLabel.textContent = String(this.bgSpacing);
      }
    }

    setTool(tool) {
      if (tool === "scroll") tool = "pen";
      this.tool = tool;
      this.toolButtons.forEach((btn, id) => {
        btn.classList.toggle("active", id === tool);
      });
      this.canvas.classList.toggle("eraser", tool === "eraser");
      this.canvas.classList.toggle("text-tool", tool === TEXT_TOOL);
      this.updateInkPointerEvents();
      this.savePreferences();
    }

    sheetPresetLabels() {
      return {
        none: "None — show website",
        whiteGrid: "White grid",
        graphBlue: "Blue graph paper",
        creamRuled: "Cream ruled lines",
        dotsGray: "Dot grid",
        darkGrid: "Dark grid",
        chalkGreen: "Green chalkboard",
        pinkNotes: "Pink notes grid",
        diagonal: "Diagonal lines",
        solidTint: "Solid tint",
        custom: "Custom sheet",
      };
    }

    updateSheetTriggerLabel() {
      if (!this.sheetTrigger) return;
      const labels = this.sheetPresetLabels();
      this.sheetTrigger.textContent = labels[this.bgPreset] || labels.custom;
    }

    populateSheetMenu() {
      this.sheetMenu.innerHTML = "";
      const entries = Object.entries(this.sheetPresetLabels());
      entries.forEach(([id, label]) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = label;
        btn.dataset.preset = id;
        btn.addEventListener("click", () => {
          if (id === "custom") {
            this.bgPreset = "custom";
            if (this.bgPattern === "none") {
              this.bgPattern = "grid";
              this.bgOpacity = 0.85;
            }
            this.updateSheetTriggerLabel();
            this.repaintBackground();
            this.savePreferences();
          } else {
            this.applyBgPreset(id);
          }
          this.closeSheetMenu();
        });
        this.sheetMenu.appendChild(btn);
      });
      document.addEventListener(
        "click",
        () => this.closeSheetMenu(),
        true,
      );
    }

    toggleSheetMenu(anchor) {
      if (!this.sheetMenu.hidden) {
        this.closeSheetMenu();
        return;
      }
      this.updateToolbarTheme();
      const rect = anchor.getBoundingClientRect();
      this.sheetMenu.style.left = `${Math.max(8, rect.left)}px`;
      this.sheetMenu.style.bottom = `${window.innerHeight - rect.top + 8}px`;
      this.sheetMenu.hidden = false;
      this.sheetMenu.querySelectorAll("button").forEach((b) => {
        b.classList.toggle("active", b.dataset.preset === this.bgPreset);
      });
    }

    closeSheetMenu() {
      if (this.sheetMenu) this.sheetMenu.hidden = true;
    }

    buildInlineEditor() {
      this.inlineEditor.setAttribute("role", "textbox");
      this.inlineEditor.setAttribute("spellcheck", "true");
      this.inlineEditor.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          this.closeInlineEditor(true);
        }
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          this.commitInlineEditor();
        }
      });
    }

    buildFab() {
      this.applyFabPosition();
      this.fab.addEventListener("click", (e) => {
        if (this._fabDragged) {
          this._fabDragged = false;
          return;
        }
        this.setToolbarMinimized(false);
      });
      let drag = null;
      this.fab.addEventListener("pointerdown", (e) => {
        drag = {
          id: e.pointerId,
          startX: e.clientX,
          startY: e.clientY,
          origRight: this.fabPos.right,
          origBottom: this.fabPos.bottom,
          moved: false,
        };
        this.fab.setPointerCapture(e.pointerId);
      });
      this.fab.addEventListener("pointermove", (e) => {
        if (!drag || e.pointerId !== drag.id) return;
        const dx = e.clientX - drag.startX;
        const dy = e.clientY - drag.startY;
        if (Math.hypot(dx, dy) > 4) drag.moved = true;
        this.fabPos.right = Math.max(8, drag.origRight - dx);
        this.fabPos.bottom = Math.max(8, drag.origBottom - dy);
        this.applyFabPosition();
      });
      const endDrag = (e) => {
        if (!drag || e.pointerId !== drag.id) return;
        if (drag.moved) {
          this._fabDragged = true;
          this.savePreferences();
        }
        drag = null;
      };
      this.fab.addEventListener("pointerup", endDrag);
      this.fab.addEventListener("pointercancel", endDrag);
    }

    applyFabPosition() {
      this.fab.style.right = `${this.fabPos.right}px`;
      this.fab.style.bottom = `${this.fabPos.bottom}px`;
      this.fab.style.left = "auto";
      this.fab.style.top = "auto";
    }

    setToolbarMinimized(minimized) {
      this.toolbarMinimized = minimized;
      this.toolbar.classList.toggle("minimized", minimized);
      this.fab.hidden = !minimized || !this.enabled;
      if (minimized) this.closeSheetMenu();
      this.savePreferences();
    }

    async toggleRecording() {
      if (this.recording) {
        this.showToast("Finishing & downloading…");
        const blob = await this.recorder.stop();
        this.recording = false;
        this.recordBtn.textContent = "Rec";
        this.fab.classList.remove("recording");
        if (blob) {
          this.recorder.saveBlob(blob, this.recordMode);
          this.showToast("Recording downloaded to your Downloads folder");
        } else {
          this.showToast("Recording empty or cancelled", true);
        }
        return;
      }
      try {
        await this.recorder.start(this.recordMode);
        this.recording = true;
        this.recordBtn.textContent = "Stop";
        this.fab.classList.add("recording");
        const hint =
          this.recordMode === "audio"
            ? 'Share tab & enable "Also share tab audio"'
            : "Pick tab/screen · enable audio if needed";
        this.showToast(`Recording… ${hint}`);
      } catch (err) {
        this.showToast(err?.message || "Could not start recording", true);
      }
    }

    canvasBoundsToScreen(bounds) {
      const rect = this.canvas.getBoundingClientRect();
      return {
        left: rect.left + (bounds.x / this.canvas.width) * rect.width,
        top: rect.top + (bounds.y / this.canvas.height) * rect.height,
        width: (bounds.w / this.canvas.width) * rect.width,
        height: (bounds.h / this.canvas.height) * rect.height,
      };
    }

    applyInlineEditorStyle() {
      const font = window.WebWriteText.TEXT_FONTS[this.textFontKey] || window.WebWriteText.TEXT_FONTS.normal;
      this.inlineEditor.style.fontFamily = font.family;
      this.inlineEditor.style.fontSize = `${this.textFontSize * font.scale}px`;
      this.inlineEditor.style.color =
        this.color === "#ffffff" && this.bgOpacity > 0.5 ? "#111827" : this.color;
    }

    openInlineEditor(bounds, { initialText = "" } = {}) {
      this.ensureKatexStyles();
      this.textEditBounds = bounds;
      this.updateToolbarTheme();
      this.applyInlineEditorStyle();
      const screen = this.canvasBoundsToScreen(bounds);
      this.inlineEditor.style.left = `${screen.left}px`;
      this.inlineEditor.style.top = `${screen.top}px`;
      this.inlineEditor.style.width = `${Math.max(100, screen.width)}px`;
      this.inlineEditor.style.minHeight = `${Math.max(36, screen.height)}px`;
      this.inlineEditor.textContent = initialText;
      this.inlineEditor.classList.add("open");
      this.inlineHint.textContent = "Enter ↵ save · Esc cancel · $x^2$ math";
      this.inlineHint.style.left = `${screen.left}px`;
      this.inlineHint.style.top = `${Math.max(8, screen.top - 28)}px`;
      this.inlineHint.classList.add("open");
      this.inlineEditor.focus();
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(this.inlineEditor);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
    }

    closeInlineEditor(restoreHintOnly = false) {
      this.inlineEditor.classList.remove("open");
      this.inlineHint.classList.remove("open");
      if (!restoreHintOnly) this.textEditBounds = null;
    }

    async commitInlineEditor() {
      const text = (this.inlineEditor.textContent || "").trim();
      const bounds = this.textEditBounds;
      this.closeInlineEditor();
      if (!text || !bounds) return;
      this.pushUndoSnapshot();
      const inkColor = this.color === "#ffffff" && this.bgOpacity > 0.5 ? "#111827" : this.color;
      await window.WebWriteText.drawTextBlock(this.ctx, text, bounds.x, bounds.y, {
        fontKey: this.textFontKey,
        fontSize: this.textFontSize,
        color: inkColor,
      });
      this.saveStrokes();
      this.showToast("Text placed on canvas");
    }

    async convertInkRegion(bounds) {
      this.showToast("Reading ink…");
      const recognized = await window.WebWriteInkOcr.recognizeInkRegion(this.canvas, bounds);
      this.pushUndoSnapshot();
      this.ctx.clearRect(bounds.x, bounds.y, bounds.w, bounds.h);
      if (recognized.length >= 2) {
        const inkColor = this.color === "#ffffff" && this.bgOpacity > 0.5 ? "#111827" : this.color;
        await window.WebWriteText.drawTextBlock(this.ctx, recognized, bounds.x, bounds.y, {
          fontKey: this.textFontKey,
          fontSize: this.textFontSize,
          color: inkColor,
        });
        this.saveStrokes();
        this.showToast("Ink converted to text");
        return;
      }
      this.openInlineEditor(bounds, { initialText: recognized });
      this.showToast("Edit on canvas · Enter to save");
    }

    setEnabled(on) {
      this.enabled = on;
      this.drawing = false;
      if (on) {
        this.resizeDocument(false);
      }
      this.updateInkPointerEvents();
      this.toolbar.classList.toggle("visible", on);
      this.fab.hidden = !on || !this.toolbarMinimized;
      if (on && this.toolbarMinimized) {
        this.toolbar.classList.add("minimized");
      } else if (on) {
        this.toolbar.classList.remove("minimized");
      }
      if (!on) {
        this.clearPreview();
        this.canvas.style.pointerEvents = "none";
        this.closeInlineEditor();
        this.closeSheetMenu();
        if (this.recording) this.toggleRecording();
        this.saveStrokes();
      }
      this.repaintBackground();
      chrome.runtime.sendMessage({ type: "WEBWRITE_SYNC", enabled: on }).catch(() => {});
    }

    posFromEvent(e) {
      const pressure = typeof e.pressure === "number" ? e.pressure : 0.5;
      if (this.canvas.width < 1 || this.canvas.height < 1) return null;

      const ow = this.canvas.offsetWidth;
      const oh = this.canvas.offsetHeight;
      if (
        e.target === this.canvas &&
        ow >= 1 &&
        oh >= 1 &&
        Number.isFinite(e.offsetX) &&
        Number.isFinite(e.offsetY)
      ) {
        const x = (e.offsetX / ow) * this.canvas.width;
        const y = (e.offsetY / oh) * this.canvas.height;
        if (Number.isFinite(x) && Number.isFinite(y)) {
          return { x, y, pressure };
        }
      }

      const rect = this.canvas.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return null;
      const x = ((e.clientX - rect.left) / rect.width) * this.canvas.width;
      const y = ((e.clientY - rect.top) / rect.height) * this.canvas.height;
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      return { x, y, pressure };
    }

    startInkFromPointerDown(pos, time) {
      if (!this.inkPointerDown || this.inkSession) return;
      let sx = this.inkPointerDown.x;
      let sy = this.inkPointerDown.y;
      let sp = this.inkPointerDown.pressure;
      const st = this.inkPointerDown.time;
      const { x, y, pressure } = pos;
      if (sx * sx + sy * sy < 4 && x * x + y * y >= 4) {
        sx = x;
        sy = y;
        sp = pressure;
      }
      this.inkSession = new window.WebWriteInkSession(this.ctx, this.strokeOptions());
      this.inkSession.start(sx, sy, sp, st);
      this.inkPointerDown = null;
      if ((x - sx) * (x - sx) + (y - sy) * (y - sy) > 0.25) {
        this.inkSession.add(x, y, pressure, time);
      }
    }

    effectiveTool() {
      if (this.shiftLine && INK_TOOLS.has(this.tool)) return "line";
      return this.tool;
    }

    beginStroke(x, y, pressure, time) {
      if (this.tool === CONVERT_TOOL) {
        this.shapeStart = { x, y };
        this.activeShape = "convert";
        this.clearPreview();
        return;
      }

      const tool = this.effectiveTool();

      if (SHAPE_TOOLS.has(tool) || (this.shiftLine && INK_TOOLS.has(this.tool))) {
        this.shapeStart = { x, y };
        this.activeShape = tool === "arrow" ? "arrow" : "line";
        this.clearPreview();
        return;
      }

      if (INK_TOOLS.has(tool)) {
        this.inkPointerDown = { x, y, pressure, time };
      }
    }

    drawShapePreview(x, y) {
      if (!this.shapeStart || !this.activeShape) return;
      this.clearPreview();
      if (this.activeShape === "convert") {
        const x0 = Math.min(this.shapeStart.x, x);
        const y0 = Math.min(this.shapeStart.y, y);
        const w = Math.abs(x - this.shapeStart.x);
        const h = Math.abs(y - this.shapeStart.y);
        this.previewCtx.strokeStyle = "#2563eb";
        this.previewCtx.lineWidth = 2;
        this.previewCtx.setLineDash([6, 4]);
        this.previewCtx.strokeRect(x0, y0, w, h);
        this.previewCtx.setLineDash([]);
        return;
      }
      const opts = { ...this.strokeOptions(), tool: this.activeShape };
      if (this.activeShape === "arrow") {
        window.WebWriteStroke.drawArrow(
          this.previewCtx,
          this.shapeStart.x,
          this.shapeStart.y,
          x,
          y,
          opts,
        );
      } else {
        window.WebWriteStroke.drawLine(
          this.previewCtx,
          this.shapeStart.x,
          this.shapeStart.y,
          x,
          y,
          opts,
        );
      }
    }

    commitShape(x, y) {
      if (!this.shapeStart || x == null || y == null || !this.activeShape) return;

      if (this.activeShape === "convert") {
        const x0 = Math.min(this.shapeStart.x, x);
        const y0 = Math.min(this.shapeStart.y, y);
        const w = Math.abs(x - this.shapeStart.x);
        const h = Math.abs(y - this.shapeStart.y);
        this.shapeStart = null;
        this.activeShape = null;
        this.clearPreview();
        if (w > 6 && h > 6) {
          const bounds = { x: x0, y: y0, w, h };
          this.convertInkRegion(bounds);
        }
        return;
      }

      const opts = { ...this.strokeOptions(), tool: this.activeShape };
      if (this.activeShape === "arrow") {
        window.WebWriteStroke.drawArrow(
          this.ctx,
          this.shapeStart.x,
          this.shapeStart.y,
          x,
          y,
          opts,
        );
      } else {
        window.WebWriteStroke.drawLine(
          this.ctx,
          this.shapeStart.x,
          this.shapeStart.y,
          x,
          y,
          opts,
        );
      }
      this.shapeStart = null;
      this.activeShape = null;
      this.clearPreview();
    }

    continueStroke(x, y, pressure, time) {
      if (!this.drawing) return;

      if (this.shapeStart) {
        this.drawShapePreview(x, y);
        return;
      }

      if (this.inkPointerDown) {
        this.startInkFromPointerDown({ x, y, pressure }, time);
      }
      if (this.inkSession) {
        this.inkSession.add(x, y, pressure, time);
      }
    }

    endStroke(x, y, pressure, time) {
      if (!this.drawing) return;
      this.drawing = false;

      if (this.shapeStart) {
        if (x != null && y != null) this.commitShape(x, y);
        else {
          this.shapeStart = null;
          this.activeShape = null;
          this.clearPreview();
        }
      } else {
        if (this.inkPointerDown && !this.inkSession && x != null && y != null) {
          this.inkSession = new window.WebWriteInkSession(this.ctx, this.strokeOptions());
          this.inkSession.start(x, y, pressure, time);
        } else if (this.inkSession && x != null && y != null) {
          const last = this.inkSession.points[this.inkSession.points.length - 1];
          const dx = x - last.x;
          const dy = y - last.y;
          if (dx * dx + dy * dy > 0.25) {
            this.inkSession.add(x, y, pressure, time);
          }
        }
        if (this.inkSession) {
          this.inkSession.finish();
          this.inkSession = null;
        }
        this.inkPointerDown = null;
      }

      this.ctx.globalCompositeOperation = "source-over";
      this.ctx.globalAlpha = 1;
      this.saveStrokes();
    }

    processPointerEvent(e, phase) {
      const events =
        phase === "move" && typeof e.getCoalescedEvents === "function"
          ? e.getCoalescedEvents()
          : [e];

      for (const ev of events) {
        const pos = this.posFromEvent(ev);
        if (!pos) continue;
        const { x, y, pressure } = pos;
        const time = ev.timeStamp;
        if (phase === "down") {
          this.pushUndoSnapshot();
          this.drawing = true;
          this.inkSession = null;
          this.inkPointerDown = null;
          this.beginStroke(x, y, pressure, time);
        } else if (phase === "move") {
          this.continueStroke(x, y, pressure, time);
        }
      }

      if (phase === "up" || phase === "cancel") {
        const pos = this.posFromEvent(e);
        if (pos) this.endStroke(pos.x, pos.y, pos.pressure, e.timeStamp);
        else this.endStroke(null, null, 0.5, e.timeStamp);
      }
    }

    bindCanvasEvents() {
      this.canvas.addEventListener(
        "wheel",
        (e) => {
          if (!this.enabled || this.drawing) return;
          window.scrollBy({ top: e.deltaY, left: e.deltaX, behavior: "auto" });
        },
        { passive: true },
      );

      const onDown = (e) => {
        if (!this.enabled || e.button !== 0) return;

        e.preventDefault();
        e.stopPropagation();
        if (this.tool === TEXT_TOOL) {
          const pos = this.posFromEvent(e);
          if (!pos) return;
          const { x, y } = pos;
          const bounds = {
            x,
            y,
            w: Math.max(160, this.textFontSize * 8),
            h: Math.max(40, this.textFontSize * 1.5),
          };
          this.openInlineEditor(bounds);
          return;
        }

        this.shiftLine = e.shiftKey;
        this.activePointerId = e.pointerId;
        this.processPointerEvent(e, "down");
        try {
          this.canvas.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      };

      const onMove = (e) => {
        if (!this.enabled || !this.drawing || e.pointerId !== this.activePointerId) return;
        e.preventDefault();
        e.stopPropagation();
        this.shiftLine = e.shiftKey;
        this.processPointerEvent(e, "move");
      };

      const onUp = (e) => {
        if (e.pointerId !== this.activePointerId) return;
        e.preventDefault();
        e.stopPropagation();
        this.processPointerEvent(e, "up");
        this.activePointerId = null;
        try {
          this.canvas.releasePointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      };

      this.canvas.addEventListener("pointerdown", onDown);
      this.canvas.addEventListener("pointermove", onMove);
      this.canvas.addEventListener("pointerup", onUp);
      this.canvas.addEventListener("pointercancel", onUp);
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
            this.undo();
            return;
          }
          if (
            (e.ctrlKey || e.metaKey) &&
            (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))
          ) {
            e.preventDefault();
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
