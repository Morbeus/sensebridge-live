import { Router } from "express";
import { clarifyMessage } from "../geminiTextClient.js";

const router = Router();

/**
 * POST /api/clarify
 * Body: { message: string }
 * Returns a simpler, slower, step-by-step version of the previous instruction.
 */
router.post("/", async (req, res) => {
  const message = String(req.body?.message ?? "").trim();
  if (!message) {
    return res.status(400).json({ error: "Field 'message' is required." });
  }

  try {
    const { clarified, usedMock } = await clarifyMessage(message);
    res.json({ clarified, usedMock });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
