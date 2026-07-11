import { Router } from "express";
import { summarizeConversation } from "../geminiTextClient.js";

const router = Router();

interface TranscriptEntry {
  speaker?: string;
  text?: string;
}

/**
 * POST /api/summary
 * Body: { transcript: Array<{ speaker, text }> } OR { transcript: string }
 * Returns a short natural-language recap of the conversation.
 */
router.post("/", async (req, res) => {
  const raw = req.body?.transcript;

  let transcriptText = "";
  if (Array.isArray(raw)) {
    transcriptText = (raw as TranscriptEntry[])
      .map((e) => `${e.speaker ?? "Speaker"}: ${e.text ?? ""}`)
      .join("\n");
  } else if (typeof raw === "string") {
    transcriptText = raw;
  }

  if (!transcriptText.trim()) {
    return res.status(400).json({ error: "Field 'transcript' is required." });
  }

  try {
    const { summary, usedMock } = await summarizeConversation(transcriptText);
    res.json({ summary, usedMock });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
