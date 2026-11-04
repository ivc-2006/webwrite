(() => {
  function parseRgb(color) {
    const c = document.createElement("canvas").getContext("2d");
    if (!c) return { r: 128, g: 128, b: 128 };
    c.fillStyle = "#000";
    c.fillStyle = color;
    const computed = c.fillStyle;
    if (computed.startsWith("#")) {
      const hex = computed.slice(1);
      const full =
        hex.length === 3
          ? hex
              .split("")
              .map((x) => x + x)
              .join("")
          : hex;
      return {
        r: parseInt(full.slice(0, 2), 16),
        g: parseInt(full.slice(2, 4), 16),
        b: parseInt(full.slice(4, 6), 16),
      };
    }
    const m = computed.match(/rgba?\(([^)]+)\)/);
    if (!m) return { r: 128, g: 128, b: 128 };
    const parts = m[1].split(",").map((p) => parseFloat(p.trim()));
    return { r: parts[0], g: parts[1], b: parts[2] };
  }

  function luminance(r, g, b) {
    const srgb = [r, g, b].map((v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
  }

  function samplePageBackground() {
    const body = parseRgb(getComputedStyle(document.body).backgroundColor);
    const html = parseRgb(getComputedStyle(document.documentElement).backgroundColor);
    const lb = luminance(body.r, body.g, body.b);
    const lh = luminance(html.r, html.g, html.b);
    if (lb > 0.02) return lb;
    if (lh > 0.02) return lh;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? 0.12 : 0.92;
  }

  function applyToolbarContrast(toolbar, options = {}) {
    const pageLum = samplePageBackground();
    const sheetActive = options.sheetOpacity > 0.05 && options.sheetPattern !== "none";
    let lum = pageLum;
    if (sheetActive && options.sheetFill) {
      const s = parseRgb(options.sheetFill);
      const sheetLum = luminance(s.r, s.g, s.b);
      const blend = Math.min(1, options.sheetOpacity);
      lum = pageLum * (1 - blend) + sheetLum * blend;
    }
    const contrast = lum > 0.55 ? "light" : "dark";
    toolbar.dataset.contrast = contrast;
    toolbar.style.colorScheme = contrast === "light" ? "light" : "dark";
    return contrast;
  }

  window.WebWriteTheme = { applyToolbarContrast, samplePageBackground, luminance };
})();
