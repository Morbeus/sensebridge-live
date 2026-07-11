import { GoogleGenAI, Modality } from "@google/genai";
import { config } from "./config.js";

/**
 * geminiLiveClient
 * ----------------
 * Streams mic audio to Gemini Live and emits input-audio transcriptions as
 * captions for the room.
 *
 * RCA note (Jul 2026): gemini-3.1-flash-live-preview only supports AUDIO
 * response modality. Using TEXT caused the session to close immediately with:
 *   "The requested combination of response modalities (TEXT) is not supported"
 * That left WebRTC working (users could hear each other) but produced zero
 * captions / speech transcripts.
 */

export interface LiveSessionCallbacks {
  onPartialCaption: (text: string) => void;
  onFinalCaption: (text: string) => void;
  onStatus: (status: "connecting" | "listening" | "closed") => void;
  onError: (message: string) => void;
}

const MOCK_PHRASES = [
  "Hi, I cannot see clearly. Can you help me find the registration desk?",
  "Can you repeat that more slowly?",
  "Thank you, I think I can find it now.",
];

export interface LiveSession {
  /** False after the underlying Live WebSocket closes unexpectedly. */
  readonly alive: boolean;
  sendAudioChunk(base64Pcm: string, mimeType: string): void;
  triggerMockUtterance(): void;
  stop(): Promise<void>;
}

export async function createLiveSession(
  callbacks: LiveSessionCallbacks
): Promise<LiveSession> {
  if (config.useMockLive) {
    return createMockSession(callbacks);
  }
  try {
    return await createRealSession(callbacks);
  } catch (err) {
    callbacks.onError(
      `Falling back to mock live captions (${(err as Error).message}).`
    );
    return createMockSession(callbacks);
  }
}

async function createRealSession(
  callbacks: LiveSessionCallbacks
): Promise<LiveSession> {
  callbacks.onStatus("connecting");
  const ai = new GoogleGenAI({ apiKey: config.gemini.apiKey });

  // Accumulate transcription pieces for one spoken turn.
  let buffer = "";
  let alive = true;
  let lastPartial = "";

  const session = await ai.live.connect({
    model: config.gemini.liveModel,
    config: {
      // Native audio Live models only support AUDIO (not TEXT).
      responseModalities: [Modality.AUDIO],
      inputAudioTranscription: {},
      // Keep the model quiet — we only want input transcriptions as captions.
      systemInstruction:
        "You are a silent accessibility captioning assistant. " +
        "Do not speak or reply unless the user clearly asks a question. " +
        "Your job is only to listen.",
    },
    callbacks: {
      onopen: () => {
        alive = true;
        callbacks.onStatus("listening");
        console.log("[live] session open");
      },
      onmessage: (message: any) => {
        const sc = message?.serverContent;
        if (!sc) return;

        // SDK may expose camelCase; be defensive about snake_case too.
        const inputTx =
          sc.inputTranscription?.text ??
          sc.input_transcription?.text ??
          "";

        if (inputTx) {
          // Some payloads are cumulative; others are deltas.
          if (inputTx.startsWith(buffer) || buffer.startsWith(inputTx)) {
            buffer = inputTx.length >= buffer.length ? inputTx : buffer;
          } else if (!buffer.includes(inputTx)) {
            buffer = `${buffer} ${inputTx}`.trim();
          }
          const partial = buffer.trim();
          if (partial && partial !== lastPartial) {
            lastPartial = partial;
            callbacks.onPartialCaption(partial);
          }
        }

        if (sc.turnComplete || sc.generationComplete) {
          const finalText = buffer.trim();
          buffer = "";
          lastPartial = "";
          if (finalText) {
            console.log("[live] caption.final:", finalText.slice(0, 120));
            callbacks.onFinalCaption(finalText);
          }
        }
      },
      onerror: (e: any) => {
        console.error("[live] error:", e?.message ?? e);
        callbacks.onError(e?.message ?? "Live API error");
      },
      onclose: (e: any) => {
        alive = false;
        console.warn("[live] session closed:", e?.reason || e?.code || "");
        callbacks.onStatus("closed");
      },
    },
  });

  return {
    get alive() {
      return alive;
    },
    sendAudioChunk(base64Pcm: string, mimeType: string) {
      if (!alive) return;
      try {
        session.sendRealtimeInput({
          audio: { data: base64Pcm, mimeType },
        });
      } catch (e) {
        alive = false;
        callbacks.onError((e as Error).message);
      }
    },
    triggerMockUtterance() {
      /* no-op in real mode */
    },
    async stop() {
      alive = false;
      try {
        session.close();
      } catch {
        /* ignore */
      }
      callbacks.onStatus("closed");
    },
  };
}

function createMockSession(callbacks: LiveSessionCallbacks): LiveSession {
  let phraseIndex = 0;
  let streaming = false;
  let timers: ReturnType<typeof setTimeout>[] = [];
  let lastAudioAt = 0;
  let idleTimer: ReturnType<typeof setInterval> | null = null;
  let alive = true;

  callbacks.onStatus("listening");

  function clearTimers() {
    timers.forEach(clearTimeout);
    timers = [];
  }

  function streamNextPhrase() {
    if (streaming || !alive) return;
    const phrase = MOCK_PHRASES[phraseIndex % MOCK_PHRASES.length];
    phraseIndex += 1;
    streaming = true;

    const words = phrase.split(" ");
    let partial = "";
    words.forEach((word, i) => {
      const t = setTimeout(() => {
        partial = partial ? `${partial} ${word}` : word;
        callbacks.onPartialCaption(partial);
        if (i === words.length - 1) {
          const finalTimer = setTimeout(() => {
            callbacks.onFinalCaption(phrase);
            streaming = false;
          }, 350);
          timers.push(finalTimer);
        }
      }, 140 * (i + 1));
      timers.push(t);
    });
  }

  idleTimer = setInterval(() => {
    if (!streaming && lastAudioAt && Date.now() - lastAudioAt < 1500) {
      streamNextPhrase();
    }
  }, 800);

  return {
    get alive() {
      return alive;
    },
    sendAudioChunk() {
      lastAudioAt = Date.now();
    },
    triggerMockUtterance() {
      streamNextPhrase();
    },
    async stop() {
      alive = false;
      clearTimers();
      if (idleTimer) clearInterval(idleTimer);
      idleTimer = null;
      callbacks.onStatus("closed");
    },
  };
}
