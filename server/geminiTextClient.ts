import { GoogleGenAI } from "@google/genai";
import { config } from "./config.js";

/**
 * Thin wrapper around the Gemini text + vision models used by the REST routes
 * (clarify, summary, scene-assist).
 *
 * If there is no API key configured, every method falls back to a deterministic
 * local mock so the hackathon demo keeps working offline.
 */

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI | null {
  if (!config.hasApiKey) return null;
  if (!client) {
    client = new GoogleGenAI({ apiKey: config.gemini.apiKey });
  }
  return client;
}

async function generateText(prompt: string, model: string): Promise<string> {
  const ai = getClient();
  if (!ai) throw new Error("NO_API_KEY");

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
  });
  return (response.text ?? "").trim();
}

/**
 * Turn a previous instruction into a simpler, slower, step-by-step version.
 */
export async function clarifyMessage(previousMessage: string): Promise<{
  clarified: string;
  usedMock: boolean;
}> {
  const prompt = [
    "You are helping a blind or low-vision person who asked you to repeat an",
    "instruction more slowly and simply.",
    "Rewrite the following instruction as short, calm, step-by-step guidance.",
    "Use very short sentences. Keep every important detail (directions,",
    "distances, landmarks, colors). Do not add new information.",
    "",
    `Original instruction: "${previousMessage}"`,
    "",
    "Rewrite:",
  ].join("\n");

  try {
    const clarified = await generateText(prompt, config.gemini.textModel);
    if (clarified) return { clarified, usedMock: false };
    return { clarified: mockClarify(previousMessage), usedMock: true };
  } catch {
    return { clarified: mockClarify(previousMessage), usedMock: true };
  }
}

/**
 * Summarize the full conversation transcript.
 */
export async function summarizeConversation(
  transcript: string
): Promise<{ summary: string; usedMock: boolean }> {
  const prompt = [
    "Summarize the following accessibility conversation between a blind/low-vision",
    "user and a deaf/hard-of-hearing user. Write 2-3 clear sentences describing",
    "what was asked and what guidance was given. Be concrete and neutral.",
    "",
    "Transcript:",
    transcript,
    "",
    "Summary:",
  ].join("\n");

  try {
    const summary = await generateText(prompt, config.gemini.textModel);
    if (summary) return { summary, usedMock: false };
    return { summary: mockSummary(), usedMock: true };
  } catch {
    return { summary: mockSummary(), usedMock: true };
  }
}

/**
 * Describe navigation-relevant details in a single camera frame.
 *
 * @param imageBase64 raw base64 (no data: prefix)
 * @param mimeType e.g. "image/jpeg"
 */
export async function describeScene(
  imageBase64: string,
  mimeType: string
): Promise<{ description: string; usedMock: boolean }> {
  const ai = getClient();
  const promptText = [
    "You are a navigation aid for a blind or low-vision person.",
    "Look at this image and describe ONLY details relevant to moving around",
    "safely: signs and their text, doorways, stairs, obstacles, and the",
    "direction of important landmarks (left / right / ahead).",
    "Answer in 1-2 short spoken sentences. If you are unsure, say so.",
  ].join(" ");

  if (!ai) {
    return { description: mockScene(), usedMock: true };
  }

  try {
    const response = await ai.models.generateContent({
      model: config.gemini.visionModel,
      contents: [
        {
          role: "user",
          parts: [
            { text: promptText },
            { inlineData: { mimeType, data: imageBase64 } },
          ],
        },
      ],
    });
    const description = (response.text ?? "").trim();
    if (description) return { description, usedMock: false };
    return { description: mockScene(), usedMock: true };
  } catch {
    return { description: mockScene(), usedMock: true };
  }
}

// --- Deterministic offline fallbacks ---------------------------------------

function mockClarify(previousMessage: string): string {
  const base = previousMessage.trim();
  if (!base) {
    return "Sure. Let me say that again slowly. Please stay where you are.";
  }
  // Naive but demo-friendly: split into short steps.
  const parts = base
    .replace(/\band\b/gi, ".")
    .split(/[.]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const steps = parts.map((p) => {
    const s = p.charAt(0).toUpperCase() + p.slice(1);
    return s.endsWith(".") ? s : `${s}.`;
  });
  return ["Sure.", ...steps].join(" ");
}

function mockSummary(): string {
  return (
    "The blind user asked for help finding the registration desk. " +
    "The deaf user instructed them to walk straight and turn left near the blue banner."
  );
}

function mockScene(): string {
  return "I can see a sign that says Registration slightly to your left.";
}
