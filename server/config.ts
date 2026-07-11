import dotenv from "dotenv";

dotenv.config();

/**
 * Centralized, typed access to environment configuration.
 *
 * TODO: Fill in GEMINI_API_KEY and the model names in `server/.env`
 * (copy from the root `.env.example`).
 */
export const config = {
  port: Number(process.env.PORT ?? 8080),

  gemini: {
    apiKey: process.env.GEMINI_API_KEY ?? "",
    // TODO: replace placeholders with model names you actually have access to.
    liveModel: process.env.GEMINI_LIVE_MODEL ?? "gemini-2.0-flash-live-001",
    textModel: process.env.GEMINI_TEXT_MODEL ?? "gemini-2.0-flash",
    visionModel:
      process.env.GEMINI_VISION_MODEL ??
      process.env.GEMINI_TEXT_MODEL ??
      "gemini-2.0-flash",
  },

  /**
   * When true (or when no API key is present) the backend streams simulated
   * captions instead of calling the real Gemini Live API. This keeps the demo
   * working with zero credentials.
   */
  get useMockLive(): boolean {
    const flag = (process.env.USE_MOCK_LIVE ?? "true").toLowerCase() === "true";
    return flag || !this.gemini.apiKey;
  },

  get hasApiKey(): boolean {
    return Boolean(this.gemini.apiKey);
  },
};
