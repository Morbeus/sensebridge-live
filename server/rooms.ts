import type { WebSocket } from "ws";
import type { LiveSession } from "./geminiLiveClient.js";

/**
 * In-memory room registry for the SenseBridge Live meeting room.
 *
 * A "room" is a set of participants sharing a room code. The backend only
 * relays WebRTC signaling, captions, and text messages between them — the
 * actual audio flows peer-to-peer over WebRTC. State is intentionally
 * in-memory (hackathon MVP): everything resets when the server restarts.
 */

export interface Participant {
  id: string;
  ws: WebSocket;
  role: string; // "blind" | "deaf"
  name: string;
  roomCode: string;
  /** Lazily created Gemini Live session used to caption this participant. */
  session: LiveSession | null;
}

const rooms = new Map<string, Map<string, Participant>>();

export function joinRoom(participant: Participant): void {
  let room = rooms.get(participant.roomCode);
  if (!room) {
    room = new Map();
    rooms.set(participant.roomCode, room);
  }
  room.set(participant.id, participant);
}

export function leaveRoom(
  roomCode: string,
  id: string
): Participant | undefined {
  const room = rooms.get(roomCode);
  if (!room) return undefined;
  const participant = room.get(id);
  room.delete(id);
  if (room.size === 0) rooms.delete(roomCode);
  return participant;
}

export function getParticipant(
  roomCode: string,
  id: string
): Participant | undefined {
  return rooms.get(roomCode)?.get(id);
}

/** All participants in a room, optionally excluding one id. */
export function peersInRoom(roomCode: string, exceptId?: string): Participant[] {
  const room = rooms.get(roomCode);
  if (!room) return [];
  return [...room.values()].filter((p) => p.id !== exceptId);
}

export function publicPeer(p: Participant) {
  return { id: p.id, role: p.role, name: p.name };
}
