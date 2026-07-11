import express from "express";
import cors from "cors";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";

import { config } from "./config.js";
import { createLiveSession } from "./geminiLiveClient.js";
import {
  joinRoom,
  leaveRoom,
  peersInRoom,
  getParticipant,
  publicPeer,
  type Participant,
} from "./rooms.js";
import clarifyRoute from "./routes/clarify.js";
import summaryRoute from "./routes/summary.js";
import sceneAssistRoute from "./routes/sceneAssist.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "12mb" })); // scene-assist images can be large

// --- REST routes ------------------------------------------------------------

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    mockLive: config.useMockLive,
    hasApiKey: config.hasApiKey,
    models: {
      live: config.gemini.liveModel,
      text: config.gemini.textModel,
      vision: config.gemini.visionModel,
    },
  });
});

app.use("/api/clarify", clarifyRoute);
app.use("/api/summary", summaryRoute);
app.use("/api/scene-assist", sceneAssistRoute);

// --- HTTP + WebSocket signaling server --------------------------------------

const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

function send(ws: WebSocket, payload: unknown) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
}

function broadcast(roomCode: string, payload: unknown, exceptId?: string) {
  for (const peer of peersInRoom(roomCode, exceptId)) {
    send(peer.ws, payload);
  }
}

/**
 * Each browser connection becomes one participant in one room. The server
 * relays WebRTC signaling between peers and captions/text messages to the room.
 * A Gemini Live session is created per participant (lazily) to caption the
 * audio they stream in.
 */
wss.on("connection", (ws) => {
  const self: Participant = {
    id: randomUUID(),
    ws,
    role: "",
    name: "",
    roomCode: "",
    session: null,
  };

  async function ensureSession() {
    if (self.session?.alive) return self.session;
    if (self.session) {
      try {
        await self.session.stop();
      } catch {
        /* ignore */
      }
      self.session = null;
    }
    self.session = await createLiveSession({
      onPartialCaption: (text) =>
        broadcast(self.roomCode, {
          type: "caption.partial",
          speaker: publicPeer(self),
          text,
        }),
      onFinalCaption: (text) =>
        broadcast(self.roomCode, {
          type: "caption.final",
          speaker: publicPeer(self),
          text,
        }),
      onStatus: (status) => {
        if (status === "closed") {
          // Mark for recreate on next audio chunk.
          console.log(`[live] ${self.name || self.id} session status=closed`);
        }
      },
      onError: (message) => send(ws, { type: "error", message }),
    });
    return self.session;
  }

  /** Broadcast a caption produced on the client (Web Speech API fallback). */
  function emitClientCaption(kind: "partial" | "final", text: string) {
    const trimmed = text.trim();
    if (!trimmed || !self.roomCode) return;
    broadcast(self.roomCode, {
      type: kind === "final" ? "caption.final" : "caption.partial",
      speaker: publicPeer(self),
      text: trimmed,
      source: "browser-stt",
    });
  }

  ws.on("message", async (raw) => {
    let msg: any;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    switch (msg.type) {
      case "join": {
        self.role = String(msg.role ?? "deaf");
        self.name = String(msg.name ?? "Guest").slice(0, 40);
        self.roomCode = String(msg.roomCode ?? "lobby")
          .trim()
          .toUpperCase();

        const existing = peersInRoom(self.roomCode).map(publicPeer);
        joinRoom(self);

        // Tell the newcomer who is already here (they will initiate offers).
        send(ws, {
          type: "joined",
          selfId: self.id,
          peers: existing,
          mockLive: config.useMockLive,
        });
        // Tell everyone else a peer arrived.
        broadcast(self.roomCode, { type: "peer-joined", peer: publicPeer(self) }, self.id);
        break;
      }

      case "signal": {
        // Relay a WebRTC signaling payload to a specific peer in the room.
        const target = getParticipant(self.roomCode, String(msg.toId));
        if (target) {
          send(target.ws, {
            type: "signal",
            fromId: self.id,
            signal: msg.signal,
          });
        }
        break;
      }

      case "audio": {
        const session = await ensureSession();
        if (msg.data) {
          session.sendAudioChunk(
            msg.data,
            msg.mimeType ?? "audio/pcm;rate=16000"
          );
        }
        break;
      }

      case "client-caption": {
        // Browser SpeechRecognition (or other client STT) → room captions.
        // This is the reliable caption path when Live transcription is slow
        // or unavailable; it still labels the speaker correctly.
        const kind = msg.final ? "final" : "partial";
        emitClientCaption(kind, String(msg.text ?? ""));
        break;
      }

      case "simulate": {
        const session = await ensureSession();
        session.triggerMockUtterance();
        break;
      }

      case "message": {
        // Text from one participant -> everyone else (they read / speak it).
        broadcast(
          self.roomCode,
          {
            type: "message",
            from: publicPeer(self),
            text: String(msg.text ?? ""),
            kind: String(msg.kind ?? "reply"),
          },
          self.id
        );
        break;
      }

      case "set-role": {
        // Debug / demo: switch Blind ↔ Deaf ↔ Mute without leaving the room.
        const next = String(msg.role ?? "").toLowerCase();
        if (!["blind", "deaf", "mute"].includes(next)) break;
        self.role = next;
        if (self.name) {
          broadcast(self.roomCode, {
            type: "peer-updated",
            peer: publicPeer(self),
          });
        }
        send(ws, { type: "role-changed", role: next });
        break;
      }

      case "leave":
        cleanup();
        break;

      default:
        break;
    }
  });

  async function cleanup() {
    if (!self.roomCode) return;
    if (self.session) {
      await self.session.stop();
      self.session = null;
    }
    const roomCode = self.roomCode;
    leaveRoom(roomCode, self.id);
    broadcast(roomCode, { type: "peer-left", id: self.id });
    self.roomCode = "";
  }

  ws.on("close", () => {
    void cleanup();
  });
});

httpServer.listen(config.port, () => {
  console.log(
    `\n  SenseBridge Live backend listening on http://localhost:${config.port}`
  );
  console.log(`  WebSocket:   ws://localhost:${config.port}/ws`);
  console.log(
    `  Mock live:   ${config.useMockLive ? "ON (simulated captions)" : "OFF (real Gemini Live)"}`
  );
  console.log(
    `  API key:     ${config.hasApiKey ? "present" : "MISSING — add GEMINI_API_KEY to server/.env"}\n`
  );
});
