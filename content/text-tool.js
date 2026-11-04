(() => {
  const TEXT_FONTS = {
    hand: {
      label: "Hand-drawn",
      family: '"Caveat", "Segoe Print", "Comic Sans MS", cursive',
      scale: 1.4,
    },
    normal: {
      label: "Normal",
      family: 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif',
      scale: 1,
    },
    code: {
      label: "Code / math",
      family: '"JetBrains Mono", "Cascadia Code", Consolas, monospace',
      scale: 1,
    },
  };

  function splitMathSegments(input) {
    const parts = [];
    const re = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g;
    let last = 0;
    let m;
    while ((m = re.exec(input)) !== null) {
      if (m.index > last) parts.push({ type: "text", value: input.slice(last, m.index) });
      const raw = m[0];
      const display = raw.startsWith("$$");
      const inner = display ? raw.slice(2, -2) : raw.slice(1, -1);
      parts.push({ type: "math", value: inner.trim(), display });
      last = m.index + raw.length;
    }
    if (last < input.length) parts.push({ type: "text", value: input.slice(last) });
    if (!parts.length) parts.push({ type: "text", value: input });
    return parts;
  }

  function renderMathToCanvas(ctx, latex, x, y, fontSize, color, displayMode) {
    if (!window.katex) return 0;
    const html = window.katex.renderToString(latex, {
      throwOnError: false,
      displayMode,
      output: "html",
    });
    const box = document.createElement("div");
    box.innerHTML = html;
    box.style.position = "fixed";
    box.style.left = "-9999px";
    box.style.top = "0";
    box.style.color = color;
    box.style.fontSize = `${fontSize}px`;
    const mount = window.__webwriteMeasureHost;
    if (!mount) return Promise.resolve(0);
    mount.appendChild(box);
    const rect = box.getBoundingClientRect();
    const w = Math.max(1, Math.ceil(rect.width));
    const h = Math.max(1, Math.ceil(rect.height));
    const off = document.createElement("canvas");
    off.width = w;
    off.height = h;
    const octx = off.getContext("2d");
    const svg = box.querySelector("svg");
    if (svg) {
      const svgData = new XMLSerializer().serializeToString(svg);
      const img = new Image();
      const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgData)}`;
      return new Promise((resolve) => {
        img.onload = () => {
          octx.drawImage(img, 0, 0);
          ctx.drawImage(off, x, y);
          mount.removeChild(box);
          resolve(w);
        };
        img.onerror = () => {
          mount.removeChild(box);
          resolve(0);
        };
        img.src = url;
      });
    }
    mount.removeChild(box);
    return Promise.resolve(0);
  }

  async function drawTextBlock(ctx, text, x, y, options) {
    const fontKey = options.fontKey || "normal";
    const font = TEXT_FONTS[fontKey] || TEXT_FONTS.normal;
    const size = (options.fontSize || 24) * font.scale;
    const color = options.color || "#111827";
    const lineHeight = size * 1.25;
    ctx.fillStyle = color;
    ctx.textBaseline = "top";

    const segments = splitMathSegments(text);
    let cursorX = x;
    let cursorY = y;

    for (const seg of segments) {
      if (seg.type === "math") {
        const advance = await renderMathToCanvas(
          ctx,
          seg.value,
          cursorX,
          cursorY,
          size,
          color,
          seg.display,
        );
        cursorX += advance || size * seg.value.length * 0.45;
        if (seg.display) {
          cursorX = x;
          cursorY += lineHeight * 1.6;
        }
        continue;
      }
      const lines = seg.value.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (i > 0) {
          cursorY += lineHeight;
          cursorX = x;
        }
        ctx.font = `${size}px ${font.family}`;
        ctx.fillText(lines[i], cursorX, cursorY);
        cursorX += ctx.measureText(lines[i]).width;
      }
    }
  }

  window.WebWriteText = {
    TEXT_FONTS,
    drawTextBlock,
    splitMathSegments,
  };
})();
