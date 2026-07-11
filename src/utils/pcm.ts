/**
 * Microphone → 16 kHz mono PCM16 (base64) capture, the format the Gemini Live
 * API expects. We reuse a caller-provided MediaStream (the same one used for
 * the WebRTC call) so we only ever prompt for the mic once.
 */

const TARGET_SAMPLE_RATE = 16000;

function floatTo16BitPCM(input: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(input.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

function downsample(
  buffer: Float32Array,
  inRate: number,
  outRate: number
): Float32Array {
  if (outRate >= inRate) return buffer;
  const ratio = inRate / outRate;
  const newLength = Math.round(buffer.length / ratio);
  const result = new Float32Array(newLength);
  let offsetResult = 0;
  let offsetBuffer = 0;
  while (offsetResult < newLength) {
    const nextOffset = Math.round((offsetResult + 1) * ratio);
    let accum = 0;
    let count = 0;
    for (let i = offsetBuffer; i < nextOffset && i < buffer.length; i++) {
      accum += buffer[i];
      count++;
    }
    result[offsetResult] = count > 0 ? accum / count : 0;
    offsetResult++;
    offsetBuffer = nextOffset;
  }
  return result;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export interface PcmCapture {
  stop: () => void;
}

/**
 * Start streaming PCM chunks + a rough input level from a MediaStream.
 * Returns a handle whose `stop()` tears down the audio graph (but does NOT
 * stop the underlying MediaStream tracks — the caller owns those).
 */
export function startPcmCapture(
  stream: MediaStream,
  onChunk: (base64: string, mimeType: string) => void,
  onLevel?: (level: number) => void
): PcmCapture {
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  const context = new AudioCtx();
  const source = context.createMediaStreamSource(stream);
  const processor = context.createScriptProcessor(4096, 1, 1);

  processor.onaudioprocess = (e) => {
    const input = e.inputBuffer.getChannelData(0);
    if (onLevel) {
      let sum = 0;
      for (let i = 0; i < input.length; i++) sum += input[i] * input[i];
      onLevel(Math.min(1, Math.sqrt(sum / input.length) * 4));
    }
    const down = downsample(input, context.sampleRate, TARGET_SAMPLE_RATE);
    const base64 = arrayBufferToBase64(floatTo16BitPCM(down));
    onChunk(base64, `audio/pcm;rate=${TARGET_SAMPLE_RATE}`);
  };

  source.connect(processor);
  // Keep the processor in the audio graph without playing mic through speakers
  // (which would cause echo / feedback during a WebRTC call).
  const mute = context.createGain();
  mute.gain.value = 0;
  processor.connect(mute);
  mute.connect(context.destination);

  return {
    stop() {
      processor.disconnect();
      source.disconnect();
      context.close().catch(() => {});
      onLevel?.(0);
    },
  };
}
