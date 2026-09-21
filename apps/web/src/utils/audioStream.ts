// Convierte un Float32Array (Web Audio API) a Int16Array PCM (formato Gemini)
export function float32ToInt16(buffer: Float32Array): Int16Array {
  const l = buffer.length;
  const output = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    const s = Math.max(-1, Math.min(1, buffer[i]));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return output;
}

// Convierte un ArrayBuffer a Base64 de forma eficiente
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// Reproductor continuo de chunks PCM a 24kHz
export class AudioChunkPlayer {
  private audioCtx: AudioContext;
  private nextStartTime: number = 0;

  constructor() {
    this.audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)({
      sampleRate: 24000
    });
  }

  public playChunk(base64Data: string) {
    const binary = atob(base64Data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    const int16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768.0;
    }

    const buffer = this.audioCtx.createBuffer(1, float32.length, 24000);
    buffer.copyToChannel(float32, 0);

    const source = this.audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioCtx.destination);

    const now = this.audioCtx.currentTime;
    if (this.nextStartTime < now) {
      this.nextStartTime = now;
    }

    source.start(this.nextStartTime);
    this.nextStartTime += buffer.duration;
  }

  public close() {
    this.audioCtx.close();
  }
}