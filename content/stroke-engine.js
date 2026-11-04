(() => {
  const WebWriteStroke = {
    midpoint(a, b) {
      return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    },

    distance(a, b) {
      return Math.hypot(b.x - a.x, b.y - a.y);
    },

    resolveWidth(options, pressure, velocity) {
      let w = options.baseWidth;
      if (options.tool === "highlighter") w = Math.max(w, 12);
      if (options.tool === "eraser") {
        const ew = options.eraserWidth ?? options.baseWidth;
        return Math.max(4, ew);
      }
      if (options.tool === "brush") {
        const p = pressure > 0 ? pressure : 0.5;
        w *= 0.2 + 0.8 * Math.min(1, p);
        if (velocity > 0) {
          const taper = Math.max(0.4, 1 - velocity / 6000);
          w *= taper;
        }
      }
      return Math.max(0.8, w);
    },

    applyPaintStyle(ctx, options) {
      if (options.tool === "eraser") {
        ctx.globalCompositeOperation = "destination-out";
        ctx.globalAlpha = 1;
        return "rgba(0,0,0,1)";
      }
      if (options.tool === "highlighter") {
        ctx.globalCompositeOperation = "multiply";
        ctx.globalAlpha = Math.min(1, options.opacity * 0.5);
        return options.color;
      }
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = options.opacity;
      return options.color;
    },

    drawDot(ctx, x, y, width, options) {
      const fill = this.applyPaintStyle(ctx, options);
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(x, y, width / 2, 0, Math.PI * 2);
      ctx.fill();
    },

    drawSegment(ctx, from, to, options) {
      const fill = this.applyPaintStyle(ctx, options);
      const w0 = this.resolveWidth(options, from.pressure, from.velocity);
      const w1 = this.resolveWidth(options, to.pressure, to.velocity);
      const dist = this.distance(from, to);
      const step = Math.max(1, Math.min(w0, w1) * 0.35);
      const steps = Math.max(1, Math.ceil(dist / step));

      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = from.x + (to.x - from.x) * t;
        const y = from.y + (to.y - from.y) * t;
        const w = w0 + (w1 - w0) * t;
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.arc(x, y, w / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    },

    drawQuadraticTail(ctx, from, control, to, options) {
      const fill = this.applyPaintStyle(ctx, options);
      const wStart = this.resolveWidth(options, from.pressure, from.velocity);
      const wEnd = this.resolveWidth(options, to.pressure, to.velocity);
      const approxLen =
        this.distance(from, control) + this.distance(control, to);
      const steps = Math.max(2, Math.ceil(approxLen / Math.max(2, wStart * 0.35)));

      let prev = null;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const mt = 1 - t;
        const x = mt * mt * from.x + 2 * mt * t * control.x + t * t * to.x;
        const y = mt * mt * from.y + 2 * mt * t * control.y + t * t * to.y;
        const w = wStart + (wEnd - wStart) * t;
        const point = { x, y, pressure: to.pressure, velocity: to.velocity };
        if (prev) this.drawSegment(ctx, prev, point, options);
        else this.drawDot(ctx, x, y, w, options);
        prev = point;
      }
    },

    drawLine(ctx, x0, y0, x1, y1, options) {
      const fill = this.applyPaintStyle(ctx, options);
      const w = this.resolveWidth(options, 0.5, 0);
      ctx.strokeStyle = fill;
      ctx.lineWidth = w;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    },

    drawArrow(ctx, x0, y0, x1, y1, options) {
      this.drawLine(ctx, x0, y0, x1, y1, options);
      const fill = this.applyPaintStyle(ctx, options);
      const w = this.resolveWidth(options, 0.5, 0);
      const angle = Math.atan2(y1 - y0, x1 - x0);
      const head = Math.max(10, w * 3.5);
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(
        x1 - head * Math.cos(angle - Math.PI / 7),
        y1 - head * Math.sin(angle - Math.PI / 7),
      );
      ctx.lineTo(
        x1 - head * Math.cos(angle + Math.PI / 7),
        y1 - head * Math.sin(angle + Math.PI / 7),
      );
      ctx.closePath();
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    },
  };

  class InkSession {
    constructor(ctx, options) {
      this.ctx = ctx;
      this.options = options;
      this.points = [];
      this.lastDrawn = null;
    }

    start(x, y, pressure, time) {
      this.points = [{ x, y, pressure, time, velocity: 0 }];
      this.lastDrawn = { x, y };
      WebWriteStroke.drawDot(
        this.ctx,
        x,
        y,
        WebWriteStroke.resolveWidth(this.options, pressure, 0),
        this.options,
      );
    }

    add(x, y, pressure, time) {
      const prev = this.points[this.points.length - 1];
      const dt = Math.max(1, time - prev.time);
      const velocity = (WebWriteStroke.distance(prev, { x, y }) / dt) * 1000;
      const point = { x, y, pressure, time, velocity };

      if (this.points.length === 1 && prev.x <= 0.5 && prev.y <= 0.5) {
        const jump = WebWriteStroke.distance(prev, point);
        if (jump > 6) {
          const w0 = WebWriteStroke.resolveWidth(this.options, prev.pressure, 0);
          this.ctx.save();
          this.ctx.globalCompositeOperation = "destination-out";
          this.ctx.beginPath();
          this.ctx.arc(prev.x, prev.y, w0 + 1, 0, Math.PI * 2);
          this.ctx.fill();
          this.ctx.restore();
          this.points[0] = { ...point, velocity: 0 };
          this.lastDrawn = { x, y };
          WebWriteStroke.drawDot(
            this.ctx,
            x,
            y,
            WebWriteStroke.resolveWidth(this.options, pressure, 0),
            this.options,
          );
          return;
        }
      }

      this.points.push(point);

      if (this.points.length === 2) {
        WebWriteStroke.drawSegment(this.ctx, prev, point, this.options);
        this.lastDrawn = WebWriteStroke.midpoint(prev, point);
        return;
      }

      const p0 = this.points[this.points.length - 3];
      const p1 = this.points[this.points.length - 2];
      const mid = WebWriteStroke.midpoint(p1, point);
      WebWriteStroke.drawQuadraticTail(this.ctx, this.lastDrawn, p1, mid, this.options);
      this.lastDrawn = mid;
    }

    finish() {
      if (this.points.length < 2) return;
      const last = this.points[this.points.length - 1];
      WebWriteStroke.drawSegment(this.ctx, this.lastDrawn, last, this.options);
      this.ctx.globalCompositeOperation = "source-over";
      this.ctx.globalAlpha = 1;
    }
  }

  window.WebWriteStroke = WebWriteStroke;
  window.WebWriteInkSession = InkSession;
})();
