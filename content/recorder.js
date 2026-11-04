(() => {
  class ScreenRecorder {
    constructor() {
      this.stream = null;
      this.recorder = null;
      this.chunks = [];
      this.active = false;
      this.mode = "av";
      this.lastBlob = null;
      this.lastFilename = null;
    }

    pickMimeType(mode) {
      if (mode === "audio") {
        const audioTypes = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
        return audioTypes.find((t) => MediaRecorder.isTypeSupported(t)) || "";
      }
      const types = [
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm",
      ];
      return types.find((t) => MediaRecorder.isTypeSupported(t)) || "";
    }

    buildRecordStream(stream, mode) {
      const videoTracks = stream.getVideoTracks();
      const audioTracks = stream.getAudioTracks();
      if (mode === "audio") {
        if (!audioTracks.length) {
          throw new Error('No audio track. In Chrome’s share dialog, check "Also share tab audio".');
        }
        return new MediaStream(audioTracks);
      }
      if (mode === "video") {
        if (!videoTracks.length) throw new Error("No video track in capture.");
        return new MediaStream(videoTracks);
      }
      return stream;
    }

    async start(mode = "av") {
      if (this.active) return;
      this.mode = mode;
      this.stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: true,
        preferCurrentTab: true,
      });
      const recordStream = this.buildRecordStream(this.stream, mode);
      const mimeType = this.pickMimeType(mode);
      this.chunks = [];
      this.recorder = new MediaRecorder(recordStream, mimeType ? { mimeType } : undefined);
      this.recorder.ondataavailable = (e) => {
        if (e.data?.size) this.chunks.push(e.data);
      };
      this.recorder.start(1000);
      this.active = true;
      this.stream.getVideoTracks()[0]?.addEventListener("ended", () => this.stop());
      this.stream.getAudioTracks()[0]?.addEventListener("ended", () => this.stop());
    }

    async stop() {
      if (!this.active) return null;
      this.active = false;
      await new Promise((resolve) => {
        if (!this.recorder || this.recorder.state === "inactive") {
          resolve();
          return;
        }
        this.recorder.onstop = resolve;
        this.recorder.stop();
      });
      this.stream?.getTracks().forEach((t) => t.stop());
      this.stream = null;
      this.recorder = null;
      if (!this.chunks.length) return null;
      const blob = new Blob(this.chunks, { type: this.chunks[0].type || "video/webm" });
      this.chunks = [];
      return blob;
    }

    saveBlob(blob, mode) {
      if (!blob) return;
      const ext = mode === "audio" ? "webm" : "webm";
      const prefix =
        mode === "audio" ? "webwrite-audio" : mode === "video" ? "webwrite-video" : "webwrite-screen";
      const filename = `${prefix}-${Date.now()}.${ext}`;
      this.lastBlob = blob;
      this.lastFilename = filename;
      this.download(blob, filename);
    }

    downloadLast() {
      if (this.lastBlob && this.lastFilename) {
        this.download(this.lastBlob, this.lastFilename);
        return true;
      }
      return false;
    }

    download(blob, filename) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 15000);
    }
  }

  window.WebWriteRecorder = ScreenRecorder;
})();
