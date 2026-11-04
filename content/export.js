(() => {
  function downloadDataUrl(dataUrl, filename) {
    const link = document.createElement("a");
    link.download = filename;
    link.href = dataUrl;
    link.click();
  }

  function loadImage(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Could not load image for export"));
      img.src = dataUrl;
    });
  }

  async function savePdfFromImage(dataUrl, filename) {
    if (!window.jspdf?.jsPDF) {
      throw new Error("PDF library not loaded");
    }
    const img = await loadImage(dataUrl);
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
      orientation: w >= h ? "landscape" : "portrait",
      unit: "px",
      format: [w, h],
      compress: true,
    });
    pdf.addImage(dataUrl, "PNG", 0, 0, w, h, undefined, "FAST");
    pdf.save(filename);
  }

  window.WebWriteExport = {
    downloadDataUrl,
    savePdfFromImage,
  };
})();
