(() => {
  const PRESETS = {
    none: { pattern: "none", fill: "#ffffff", line: "#cbd5e1", opacity: 0, spacing: 24 },
    whiteGrid: { pattern: "grid", fill: "#ffffff", line: "#94a3b8", opacity: 0.92, spacing: 28 },
    creamRuled: { pattern: "ruled", fill: "#fffbeb", line: "#60a5fa", opacity: 0.9, spacing: 32 },
    graphBlue: { pattern: "grid", fill: "#eff6ff", line: "#3b82f6", opacity: 0.88, spacing: 20 },
    dotsGray: { pattern: "dots", fill: "#f8fafc", line: "#64748b", opacity: 0.85, spacing: 22 },
    darkGrid: { pattern: "grid", fill: "#0f172a", line: "#475569", opacity: 0.88, spacing: 28 },
    chalkGreen: { pattern: "ruled", fill: "#14532d", line: "#86efac", opacity: 0.9, spacing: 36 },
    pinkNotes: { pattern: "grid", fill: "#fdf2f8", line: "#f472b6", opacity: 0.9, spacing: 26 },
    diagonal: { pattern: "diagonal", fill: "#fafafa", line: "#d4d4d8", opacity: 0.85, spacing: 24 },
    solidTint: { pattern: "solid", fill: "#fef3c7", line: "#fef3c7", opacity: 0.75, spacing: 24 },
  };

  function paint(ctx, width, height, settings) {
    ctx.clearRect(0, 0, width, height);
    const pattern = settings.pattern || "none";
    if (pattern === "none" || settings.opacity <= 0) return;

    const fill = settings.fill || "#ffffff";
    const line = settings.line || "#94a3b8";
    const step = Math.max(8, settings.spacing || 24);
    const alpha = Math.min(1, Math.max(0.05, settings.opacity));

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, width, height);

    if (pattern === "solid") {
      ctx.restore();
      return;
    }

    ctx.globalAlpha = Math.min(1, alpha + 0.05);
    ctx.strokeStyle = line;
    ctx.fillStyle = line;
    ctx.lineWidth = 1;

    if (pattern === "grid") {
      for (let x = 0; x <= width; x += step) {
        ctx.beginPath();
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, height);
        ctx.stroke();
      }
      for (let y = 0; y <= height; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(width, y + 0.5);
        ctx.stroke();
      }
    } else if (pattern === "dots") {
      const r = Math.max(0.8, step * 0.06);
      for (let x = step / 2; x < width; x += step) {
        for (let y = step / 2; y < height; y += step) {
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (pattern === "ruled") {
      for (let y = step; y < height; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(width, y + 0.5);
        ctx.stroke();
      }
    } else if (pattern === "diagonal") {
      for (let i = -height; i < width + height; i += step) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i + height, height);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  window.WebWriteBackground = { paint, PRESETS };
})();
