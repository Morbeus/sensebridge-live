export type Role = "blind" | "deaf" | "mute";

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

export interface Peer {
  id: string;
  role: Role;
  name: string;
}

/** What produced a transcript entry — captions vs the various text messages. */
export type EntryKind =
  | "caption"
  | "reply"
  | "quick"
  | "clarify"
  | "summary"
  | "scene";

export interface Entry {
  id: string;
  /** Display name shown in the transcript, e.g. "Alex (Blind User)". */
  speaker: string;
  role: Role | "system";
  text: string;
  kind: EntryKind;
  timestamp: number;
  clarified?: boolean;
  /** True if this entry originated from the local participant. */
  self?: boolean;
}

export interface LiveCaption {
  speaker: string;
  role: Role | "system";
  text: string;
}

export const ROLE_LABEL: Record<Role, string> = {
  blind: "Blind User",
  deaf: "Deaf User",
  mute: "Speech-impaired User",
};
