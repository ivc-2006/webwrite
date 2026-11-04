(() => {
  function cropCanvasRegion(canvas, bounds) {
    const { x, y, w, h } = bounds;
    const off = document.createElement("canvas");
    off.width = Math.max(1, Math.floor(w));
    off.height = Math.max(1, Math.floor(h));
    const ctx = off.getContext("2d");
    ctx.drawImage(canvas, x, y, w, h, 0, 0, w, h);
    return off;
  }

  let tesseractPromise = null;

  function loadTesseractScript() {
    if (window.Tesseract) return Promise.resolve(window.Tesseract);
    if (tesseractPromise) return tesseractPromise;
    tesseractPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = chrome.runtime.getURL("lib/tesseract.min.js");
      s.onload = () => resolve(window.Tesseract);
      s.onerror = () => reject(new Error("OCR engine failed to load"));
      document.documentElement.appendChild(s);
    });
    return tesseractPromise;
  }

  async function recognizeInkRegion(canvas, bounds) {
    try {
      const Tesseract = await loadTesseractScript();
      const crop = cropCanvasRegion(canvas, bounds);
      const dataUrl = crop.toDataURL("image/png");
      const result = await Tesseract.recognize(dataUrl, "eng", {
        workerPath: chrome.runtime.getURL("lib/worker.min.js"),
        corePath: chrome.runtime.getURL("lib/tesseract-core.wasm.js"),
        logger: () => {},
      });
      return (result?.data?.text || "").trim();
    } catch {
      return "";
    }
  }

  window.WebWriteInkOcr = {
    cropCanvasRegion,
    recognizeInkRegion,
  };
})();
