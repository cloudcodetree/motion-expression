export class Capture {
  stream!: MediaStream;
  private recorder?: MediaRecorder;
  private chunks: Blob[] = [];

  async init(video: HTMLVideoElement): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480 },
      audio: false,
    });
    video.srcObject = this.stream;
    await video.play();
  }

  startRecording(): void {
    this.chunks = [];
    this.recorder = new MediaRecorder(this.stream, { mimeType: 'video/webm' });
    this.recorder.ondataavailable = (e) => { if (e.data.size) this.chunks.push(e.data); };
    this.recorder.start();
  }

  stopRecording(): Promise<Blob> {
    return new Promise((resolve) => {
      if (!this.recorder) return resolve(new Blob());
      this.recorder.onstop = () => resolve(new Blob(this.chunks, { type: 'video/webm' }));
      this.recorder.stop();
    });
  }
}
