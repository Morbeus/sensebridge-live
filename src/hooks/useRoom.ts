import { useCallback, useEffect, useRef, useState } from "react";
import {
  ROLE_LABEL,
  type ConnectionStatus,
  type Entry,
  type EntryKind,
  type LiveCaption,
  type Peer,
  type Role,
} from "../types";
import { startPcmCapture, type PcmCapture } from "../utils/pcm";
import {
  isBrowserSttSupported,
  startBrowserStt,
  type BrowserSttHandle,
} from "../utils/browserStt";

/**
 * useRoom
 * -------
 * Owns everything about being in a SenseBridge Live meeting room:
 *   - the WebSocket to the signaling/caption server
 *   - WebRTC peer connections (audio only, no video) to every other peer
 *   - streaming the local mic to the backend for live captions
 *   - the shared transcript (captions + text messages) and live caption
 *
 * The heavy real-time logic lives here so the role views stay simple.
 */

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

interface UseRoomArgs {
  onError?: (message: string) => void;
}

let entryCounter = 0;
const nextEntryId = () => `e${Date.now()}-${entryCounter++}`;

export interface RoomApi {
  status: ConnectionStatus;
  joined: boolean;
  selfId: string;
  role: Role | null;
  peers: Peer[];
  selfName: string;
  mockLive: boolean;
  liveCaption: LiveCaption | null;
  entries: Entry[];
  talking: boolean;
  micLevel: number;
  remoteStreams: MediaStream[];

  join: (roomCode: string, role: Role, name: string) => Promise<void>;
  leave: () => void;
  toggleTalk: () => void;
  /** Push-to-talk: start speaking while held. */
  pressTalk: () => void;
  /** Push-to-talk: stop speaking on release. */
  releaseTalk: () => void;
  sendMessage: (text: string, kind: EntryKind) => void;
  addLocalEntry: (text: string, kind: EntryKind) => void;
  simulate: () => void;
  clearTranscript: () => void;
  /** Debug/demo: switch Blind / Deaf / Mute without leaving the room. */
  switchRole: (role: Role) => Promise<void>;
}

export function useRoom({ onError }: UseRoomArgs = {}): RoomApi {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [joined, setJoined] = useState(false);
  const [selfId, setSelfId] = useState("");
  const [role, setRole] = useState<Role | null>(null);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [selfName, setSelfName] = useState("");
  const [mockLive, setMockLive] = useState(false);
  const [liveCaption, setLiveCaption] = useState<LiveCaption | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [talking, setTalking] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [remoteStreams, setRemoteStreams] = useState<MediaStream[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const selfIdRef = useRef("");
  const roleRef = useRef<Role | null>(null);
  const nameRef = useRef("");
  const localStreamRef = useRef<MediaStream | null>(null);
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteMapRef = useRef<Map<string, MediaStream>>(new Map());
  const pcmRef = useRef<PcmCapture | null>(null);
  const sttRef = useRef<BrowserSttHandle | null>(null);
  const talkingRef = useRef(false);
  const lastCaptionRef = useRef<{ text: string; at: number }>({ text: "", at: 0 });

  const errRef = useRef(onError);
  useEffect(() => {
    errRef.current = onError;
  }, [onError]);

  const speakerLabel = useCallback((p: { name: string; role: string }) => {
    const roleLabel = ROLE_LABEL[p.role as Role] ?? "Participant";
    return `${p.name} · ${roleLabel}`;
  }, []);

  const addEntry = useCallback((entry: Omit<Entry, "id" | "timestamp">) => {
    setEntries((prev) => [
      ...prev,
      { ...entry, id: nextEntryId(), timestamp: Date.now() },
    ]);
  }, []);

  const wsSend = useCallback((payload: unknown) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  }, []);

  const sendSignal = useCallback(
    (toId: string, signal: unknown) => wsSend({ type: "signal", toId, signal }),
    [wsSend]
  );

  // --- WebRTC ---------------------------------------------------------------

  const updateRemoteStreams = useCallback(() => {
    setRemoteStreams([...remoteMapRef.current.values()]);
  }, []);

  const createPeerConnection = useCallback(
    (peerId: string) => {
      const pc = new RTCPeerConnection(ICE_SERVERS);

      pc.onicecandidate = (e) => {
        if (e.candidate) sendSignal(peerId, { kind: "candidate", candidate: e.candidate });
      };
      pc.ontrack = (e) => {
        remoteMapRef.current.set(peerId, e.streams[0]);
        updateRemoteStreams();
      };

      const stream = localStreamRef.current;
      if (stream) {
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      } else {
        pc.addTransceiver("audio", { direction: "recvonly" });
      }

      pcsRef.current.set(peerId, pc);
      return pc;
    },
    [sendSignal, updateRemoteStreams]
  );

  const initiateOffer = useCallback(
    async (peerId: string) => {
      const pc = createPeerConnection(peerId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendSignal(peerId, { kind: "offer", sdp: pc.localDescription });
    },
    [createPeerConnection, sendSignal]
  );

  const handleSignal = useCallback(
    async (fromId: string, signal: any) => {
      try {
        let pc = pcsRef.current.get(fromId);
        if (signal.kind === "offer") {
          if (!pc) pc = createPeerConnection(fromId);
          await pc.setRemoteDescription(signal.sdp);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sendSignal(fromId, { kind: "answer", sdp: pc.localDescription });
        } else if (signal.kind === "answer" && pc) {
          await pc.setRemoteDescription(signal.sdp);
        } else if (signal.kind === "candidate" && pc) {
          await pc.addIceCandidate(signal.candidate);
        }
      } catch (err) {
        errRef.current?.(`WebRTC error: ${(err as Error).message}`);
      }
    },
    [createPeerConnection, sendSignal]
  );

  const closePeer = useCallback(
    (peerId: string) => {
      pcsRef.current.get(peerId)?.close();
      pcsRef.current.delete(peerId);
      remoteMapRef.current.delete(peerId);
      updateRemoteStreams();
    },
    [updateRemoteStreams]
  );

  // --- Mic / captions -------------------------------------------------------

  const stopCaptions = useCallback(() => {
    pcmRef.current?.stop();
    pcmRef.current = null;
    sttRef.current?.stop();
    sttRef.current = null;
    setMicLevel(0);
  }, []);

  const startCaptions = useCallback(() => {
    const stream = localStreamRef.current;
    // 1) Stream PCM to Gemini Live (Track 2 path).
    if (stream && !pcmRef.current) {
      pcmRef.current = startPcmCapture(
        stream,
        (data, mimeType) => wsSend({ type: "audio", data, mimeType }),
        setMicLevel
      );
    }

    // 2) Browser STT → room captions (reliable for Chrome/Edge demos).
    // Gemini Live native-audio models require AUDIO modality; transcription
    // alone was failing silently when we used TEXT. Browser STT guarantees
    // the deaf user still sees captions even if Live is slow.
    if (!sttRef.current && isBrowserSttSupported()) {
      sttRef.current = startBrowserStt({
        onPartial: (text) =>
          wsSend({ type: "client-caption", text, final: false }),
        onFinal: (text) =>
          wsSend({ type: "client-caption", text, final: true }),
        onError: (message) => errRef.current?.(message),
      });
    } else if (!isBrowserSttSupported()) {
      errRef.current?.(
        "This browser has no speech recognition — captions rely on Gemini Live only. Prefer Chrome for demos."
      );
    }
  }, [wsSend]);

  const toggleTalk = useCallback(() => {
    const next = !talkingRef.current;
    talkingRef.current = next;
    setTalking(next);

    const stream = localStreamRef.current;
    stream?.getAudioTracks().forEach((t) => (t.enabled = next));

    if (next) startCaptions();
    else stopCaptions();
  }, [startCaptions, stopCaptions]);

  const pressTalk = useCallback(() => {
    if (talkingRef.current) return;
    talkingRef.current = true;
    setTalking(true);
    localStreamRef.current
      ?.getAudioTracks()
      .forEach((t) => (t.enabled = true));
    startCaptions();
  }, [startCaptions]);

  const releaseTalk = useCallback(() => {
    if (!talkingRef.current) return;
    talkingRef.current = false;
    setTalking(false);
    localStreamRef.current
      ?.getAudioTracks()
      .forEach((t) => (t.enabled = false));
    stopCaptions();
  }, [stopCaptions]);

  // --- Message handling -----------------------------------------------------

  const onServerMessage = useCallback(
    (msg: any) => {
      switch (msg.type) {
        case "joined": {
          selfIdRef.current = msg.selfId;
          setSelfId(msg.selfId);
          setMockLive(Boolean(msg.mockLive));
          setPeers(msg.peers ?? []);
          setJoined(true);
          setStatus("connected");
          // We are the newcomer -> initiate offers to everyone already here.
          (msg.peers ?? []).forEach((p: Peer) => void initiateOffer(p.id));
          break;
        }
        case "peer-joined":
          setPeers((prev) =>
            prev.some((p) => p.id === msg.peer.id) ? prev : [...prev, msg.peer]
          );
          addEntry({
            speaker: speakerLabel(msg.peer),
            role: "system",
            text: `${msg.peer.name} joined the room.`,
            kind: "reply",
          });
          break;
        case "peer-left":
          setPeers((prev) => prev.filter((p) => p.id !== msg.id));
          closePeer(msg.id);
          break;
        case "peer-updated":
          setPeers((prev) =>
            prev.map((p) => (p.id === msg.peer.id ? { ...p, ...msg.peer } : p))
          );
          break;
        case "role-changed":
          // Ack from server after debug role switch.
          break;
        case "signal":
          void handleSignal(msg.fromId, msg.signal);
          break;
        case "caption.partial":
          setLiveCaption({
            speaker: speakerLabel(msg.speaker),
            role: msg.speaker.role,
            text: msg.text,
          });
          break;
        case "caption.final":
          setLiveCaption(null);
          if (msg.text) {
            // Dedupe when both browser STT and Gemini Live emit the same line.
            const now = Date.now();
            const norm = String(msg.text).trim().toLowerCase();
            const prev = lastCaptionRef.current;
            if (prev.text === norm && now - prev.at < 2500) break;
            lastCaptionRef.current = { text: norm, at: now };
            addEntry({
              speaker: speakerLabel(msg.speaker),
              role: msg.speaker.role,
              text: msg.text,
              kind: "caption",
            });
          }
          break;
        case "message":
          addEntry({
            speaker: speakerLabel(msg.from),
            role: msg.from.role,
            text: msg.text,
            kind: msg.kind,
          });
          break;
        case "error":
          errRef.current?.(msg.message);
          break;
        default:
          break;
      }
    },
    [addEntry, closePeer, handleSignal, initiateOffer, speakerLabel]
  );

  // --- Public actions -------------------------------------------------------

  const join = useCallback(
    async (roomCode: string, joinRole: Role, name: string) => {
      roleRef.current = joinRole;
      nameRef.current = name;
      setSelfName(name);
      setRole(joinRole);
      setStatus("connecting");

      // Acquire mic up front (used for both the WebRTC call and captions).
      // Mute/speech-difficulty users never talk, so we skip the mic prompt for
      // them — their peer connection is receive-only.
      if (joinRole !== "mute") {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getAudioTracks().forEach((t) => (t.enabled = false)); // start muted
          localStreamRef.current = stream;
        } catch {
          errRef.current?.(
            "Microphone unavailable — you can still read/type and use Simulate."
          );
        }
      }

      const proto = window.location.protocol === "https:" ? "wss" : "ws";
      const ws = new WebSocket(`${proto}://${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () =>
        wsSend({ type: "join", roomCode, role: joinRole, name });
      ws.onclose = () => {
        setStatus("disconnected");
        setJoined(false);
      };
      ws.onerror = () => errRef.current?.("WebSocket connection error.");
      ws.onmessage = (event) => {
        try {
          onServerMessage(JSON.parse(event.data));
        } catch {
          /* ignore malformed frames */
        }
      };
    },
    [onServerMessage, wsSend]
  );

  const leave = useCallback(() => {
    wsSend({ type: "leave" });
    stopCaptions();
    pcsRef.current.forEach((pc) => pc.close());
    pcsRef.current.clear();
    remoteMapRef.current.clear();
    setRemoteStreams([]);
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    wsRef.current?.close();
    wsRef.current = null;
    talkingRef.current = false;
    setTalking(false);
    setJoined(false);
    setStatus("disconnected");
    setPeers([]);
    setEntries([]);
    setLiveCaption(null);
    setSelfName("");
  }, [stopCaptions, wsSend]);

  const sendMessage = useCallback(
    (text: string, kind: EntryKind) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      wsSend({ type: "message", text: trimmed, kind });
      // Echo locally so the sender sees their own message immediately.
      const label = `${nameRef.current} · ${
        ROLE_LABEL[roleRef.current ?? "deaf"]
      }`;
      addEntry({
        speaker: label,
        role: roleRef.current ?? "deaf",
        text: trimmed,
        kind,
        self: true,
        clarified: kind === "clarify",
      });
    },
    [addEntry, wsSend]
  );

  const addLocalEntry = useCallback(
    (text: string, kind: EntryKind) => {
      const label = `${nameRef.current} · ${
        ROLE_LABEL[roleRef.current ?? "deaf"]
      }`;
      addEntry({
        speaker: label,
        role: roleRef.current ?? "deaf",
        text,
        kind,
        self: true,
      });
    },
    [addEntry]
  );

  const simulate = useCallback(() => wsSend({ type: "simulate" }), [wsSend]);

  const clearTranscript = useCallback(() => {
    setEntries([]);
    setLiveCaption(null);
  }, []);

  const switchRole = useCallback(
    async (next: Role) => {
      if (roleRef.current === next) return;

      // Stop any active push-to-talk / caption stream first.
      if (talkingRef.current) {
        talkingRef.current = false;
        setTalking(false);
        localStreamRef.current
          ?.getAudioTracks()
          .forEach((t) => (t.enabled = false));
        stopCaptions();
      }

      // Mute joins without a mic — acquire one when switching to a speaking role.
      if (next !== "mute" && !localStreamRef.current) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
          });
          stream.getAudioTracks().forEach((t) => (t.enabled = false));
          localStreamRef.current = stream;
        } catch {
          errRef.current?.(
            "Microphone unavailable for this role — typing still works."
          );
        }
      }

      roleRef.current = next;
      setRole(next);
      wsSend({ type: "set-role", role: next });
    },
    [stopCaptions, wsSend]
  );

  useEffect(() => () => leave(), []); // cleanup on unmount

  return {
    status,
    joined,
    selfId,
    role,
    peers,
    selfName,
    mockLive,
    liveCaption,
    entries,
    talking,
    micLevel,
    remoteStreams,
    join,
    leave,
    toggleTalk,
    pressTalk,
    releaseTalk,
    sendMessage,
    addLocalEntry,
    simulate,
    clearTranscript,
    switchRole,
  };
}
