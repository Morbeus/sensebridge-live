import { Router } from "express";
import { describeScene } from "../geminiTextClient.js";

const router = Router();

/**
 * POST /api/scene-assist
 * Body: { image: string (data URL or raw base64), mimeType?: string }
 * Returns a short, navigation-focused description of the camera frame.
 *
 * NOTE: Scene Assist is an accessibility aid only. It must never be presented
 * as a replacement for mobility tools or human assistance.
 */
router.post("/", async (req, res) => {
  const image = String(req.body?.image ?? "");
  if (!image) {
    return res.status(400).json({ error: "Field 'image' is required." });
  }

  // Accept both a full data URL and raw base64.
  let base64 = image;
  let mimeType = String(req.body?.mimeType ?? "image/jpeg");
  const match = image.match(/^data:(.+);base64,(.*)$/);
  if (match) {
    mimeType = match[1];
    base64 = match[2];
  }

  try {
    const { description, usedMock } = await describeScene(base64, mimeType);
    res.json({
      description,
      usedMock,
      disclaimer:
        "Scene Assist is only an accessibility aid and should not replace mobility tools or human assistance.",
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
