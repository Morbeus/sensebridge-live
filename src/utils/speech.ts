/**
 * Text-to-speech helpers.
 *
 * For MVP reliability we use the browser's built-in SpeechSynthesis API. This
 * works offline and needs no credentials. The `speak()` signature is kept
 * intentionally simple so it can later be swapped for Gemini audio output
 * (e.g. streaming PCM from the Live API) without touching call sites.
 *
 * TODO (post-MVP): replace `speak()` internals with Gemini-generated audio.
 */

export interface SpeakOptions {
  /** 0.1 – 10, default 1. Use ~0.75 for "slow mode". */
  rate?: number;
  /** 0 – 2, default 1. */
  pitch?: number;
  onStart?: () => void;
  onEnd?: () => void;
}

export function isSpeechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function speak(text: string, options: SpeakOptions = {}): void {
  if (!isSpeechSupported() || !text.trim()) {
    options.onEnd?.();
    return;
  }

  // Cancel anything currently being spoken so replies don't overlap.
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = options.rate ?? 1;
  utterance.pitch = options.pitch ?? 1;
  utterance.lang = "en-US";

  utterance.onstart = () => options.onStart?.();
  utterance.onend = () => options.onEnd?.();
  utterance.onerror = () => options.onEnd?.();

  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking(): void {
  if (isSpeechSupported()) {
    window.speechSynthesis.cancel();
  }
}

export function isSpeaking(): boolean {
  return isSpeechSupported() && window.speechSynthesis.speaking;
}
