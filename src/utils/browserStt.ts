/**
 * Browser SpeechRecognition helper — reliable captions for the hackathon demo.
 *
 * Gemini Live still receives PCM for the Track 2 Live API path, but native-audio
 * models can be flaky for pure captioning. Chromium's Web Speech API gives
 * immediate partial/final transcripts that we broadcast to the room.
 */

export interface SpeechCaptionHandlers {
  onPartial: (text: string) => void;
  onFinal: (text: string) => void;
  onError?: (message: string) => void;
}

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
};

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function isBrowserSttSupported(): boolean {
  return Boolean(getRecognitionCtor());
}

export interface BrowserSttHandle {
  stop: () => void;
}

/**
 * Start continuous speech recognition while the user is talking.
 * Auto-restarts on unexpected end (Chrome stops after silence).
 */
export function startBrowserStt(handlers: SpeechCaptionHandlers): BrowserSttHandle {
  const Ctor = getRecognitionCtor();
  if (!Ctor) {
    handlers.onError?.("Browser speech recognition is not available in this browser.");
    return { stop: () => {} };
  }

  let stopped = false;
  let recognition: SpeechRecognitionLike | null = null;

  const start = () => {
    if (stopped) return;
    recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      let interim = "";
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const piece = result?.[0]?.transcript ?? "";
        if (result.isFinal) finalText += piece;
        else interim += piece;
      }
      if (interim.trim()) handlers.onPartial(interim.trim());
      if (finalText.trim()) handlers.onFinal(finalText.trim());
    };

    recognition.onerror = (event: any) => {
      // "no-speech" / "aborted" are normal; don't toast the user.
      const code = event?.error;
      if (code && code !== "no-speech" && code !== "aborted") {
        handlers.onError?.(`Speech recognition: ${code}`);
      }
    };

    recognition.onend = () => {
      // Chrome ends recognition after pauses — restart while still talking.
      if (!stopped) {
        try {
          start();
        } catch {
          /* ignore restart races */
        }
      }
    };

    try {
      recognition.start();
    } catch {
      /* already started */
    }
  };

  start();

  return {
    stop() {
      stopped = true;
      try {
        if (recognition) {
          recognition.onend = null;
          recognition.stop();
        }
      } catch {
        /* ignore */
      }
      recognition = null;
    },
  };
}
