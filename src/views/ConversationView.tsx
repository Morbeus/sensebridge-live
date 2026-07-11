import { useCallback, useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  Container,
  LinearProgress,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import RecordVoiceOverIcon from "@mui/icons-material/RecordVoiceOver";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import SlowMotionVideoIcon from "@mui/icons-material/SlowMotionVideo";
import SummarizeIcon from "@mui/icons-material/Summarize";
import VideocamIcon from "@mui/icons-material/Videocam";
import { CaptionPanel } from "../components/CaptionPanel";
import { Transcript } from "../components/Transcript";
import { QuickReplies } from "../components/QuickReplies";
import { SummaryPanel } from "../components/SummaryPanel";
import { RemoteAudio } from "../components/RemoteAudio";
import { ViewHeader } from "../components/ViewHeader";
import { speak } from "../utils/speech";
import type { Entry } from "../types";
import type { RoomApi } from "../hooks/useRoom";

interface ConversationViewProps {
  room: RoomApi;
  roomCode: string;
  onLeave: () => void;
  notify: (message: string) => void;
  variant: "deaf" | "mute";
}

const CLARIFY_TRIGGERS = [
  "repeat that",
  "repeat",
  "slower",
  "did not understand",
  "didn't understand",
  "don't understand",
  "explain again",
  "explain",
];

export function ConversationView({
  room,
  roomCode,
  onLeave,
  notify,
  variant,
}: ConversationViewProps) {
  const [text, setText] = useState("");
  const [summary, setSummary] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [clarifyBusy, setClarifyBusy] = useState(false);
  const [cameraBusy, setCameraBusy] = useState(false);

  const { entries, liveCaption, sendMessage } = room;

  const isMute = variant === "mute";
  const roleLabel = isMute ? "Speech difficulty" : "Deaf / Hard-of-hearing";

  const lastCaption =
    [...entries].reverse().find((e) => e.kind === "caption")?.text ?? "";

  const voiceOut = useCallback(
    (value: string) => {
      if (isMute) speak(value);
    },
    [isMute]
  );

  const lastInstruction = useCallback((): Entry | undefined => {
    for (let i = entries.length - 1; i >= 0; i--) {
      const e = entries[i];
      if (e.self && ["reply", "quick", "clarify"].includes(e.kind)) return e;
    }
    return undefined;
  }, [entries]);

  const clarify = useCallback(
    async (source: string) => {
      setClarifyBusy(true);
      try {
        const res = await fetch("/api/clarify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: source }),
        });
        const data = await res.json();
        const clarified = data.clarified ?? source;
        sendMessage(clarified, "clarify");
        voiceOut(clarified);
      } catch {
        notify("Clarify failed — is the backend running?");
      } finally {
        setClarifyBusy(false);
      }
    },
    [sendMessage, voiceOut, notify]
  );

  const processedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const e of entries) {
      if (e.kind !== "caption" || e.role !== "blind") continue;
      if (processedRef.current.has(e.id)) continue;
      processedRef.current.add(e.id);
      const lower = e.text.toLowerCase();
      if (CLARIFY_TRIGGERS.some((t) => lower.includes(t))) {
        const prev = lastInstruction();
        if (prev) void clarify(prev.text);
      }
    }
  }, [entries, clarify, lastInstruction]);

  const handleSpeak = () => {
    const value = text.trim();
    if (!value) return;
    sendMessage(value, "reply");
    voiceOut(value);
    setText("");
  };

  const handleQuickReply = (label: string) => {
    sendMessage(label, "quick");
    voiceOut(label);
  };

  const handleClarifyLast = () => {
    const prev = lastInstruction();
    if (!prev) {
      notify("Send a reply first, then Clarify will simplify it.");
      return;
    }
    void clarify(prev.text);
  };

  const handleRecap = async () => {
    if (entries.length === 0) {
      notify("No conversation to summarize yet.");
      return;
    }
    setSummaryLoading(true);
    try {
      const res = await fetch("/api/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: entries.map((e) => ({
            speaker: e.speaker,
            text: e.text,
          })),
        }),
      });
      const data = await res.json();
      setSummary(data.summary ?? "");
      sendMessage(data.summary ?? "", "summary");
    } catch {
      notify("Recap failed — is the backend running?");
    } finally {
      setSummaryLoading(false);
    }
  };

  const captureFrame = async (): Promise<string> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      const video = document.createElement("video");
      video.srcObject = stream;
      await video.play();
      await new Promise((r) => setTimeout(r, 400));
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      canvas
        .getContext("2d")
        ?.drawImage(video, 0, 0, canvas.width, canvas.height);
      const url = canvas.toDataURL("image/jpeg", 0.7);
      stream.getTracks().forEach((t) => t.stop());
      return url;
    } catch {
      return "";
    }
  };

  /**
   * Capture a camera frame, ask Gemini to describe navigation-relevant details,
   * and broadcast to the room so blind participants hear it automatically.
   */
  const handleShowCamera = async () => {
    setCameraBusy(true);
    try {
      const image = await captureFrame();
      const res = await fetch("/api/scene-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image, mimeType: "image/jpeg" }),
      });
      const data = await res.json();
      sendMessage(
        data.description ??
          "I can see a sign that says Registration slightly to your left.",
        "scene"
      );
    } catch {
      notify("Show your camera failed — is the backend running?");
    } finally {
      setCameraBusy(false);
    }
  };

  const partnerCount = room.peers.length;
  const waitingLabel =
    partnerCount === 0
      ? "Waiting for the other person to join…"
      : isMute
        ? "Others' speech is transcribed here."
        : "Waiting for speech…";

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default", pb: 4 }}>
      <RemoteAudio streams={room.remoteStreams} />
      <ViewHeader
        roomCode={roomCode}
        roleLabel={roleLabel}
        mockLive={room.mockLive}
        talking={variant === "deaf" ? room.talking : undefined}
        onLeave={onLeave}
        peers={room.peers}
        selfName={room.selfName}
        selfRole={room.role}
      />

      <Container maxWidth="lg" sx={{ pt: 3 }}>
        <Box
          sx={{
            display: "grid",
            gap: 2.5,
            gridTemplateColumns: { xs: "1fr", md: "1.4fr 1fr" },
            alignItems: "start",
          }}
        >
          <Stack spacing={2}>
            <CaptionPanel
              liveCaption={liveCaption}
              lastFinal={lastCaption}
              waitingLabel={waitingLabel}
            />
            <Transcript entries={entries} onClear={room.clearTranscript} />
            {(summary || summaryLoading) && (
              <SummaryPanel summary={summary} loading={summaryLoading} />
            )}
          </Stack>

          <Stack spacing={2}>
            <Box
              component="section"
              aria-label="Type a reply"
              sx={{
                p: 2,
                bgcolor: "background.paper",
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 3,
              }}
            >
              <Typography
                variant="subtitle2"
                color="text.secondary"
                fontWeight={600}
                sx={{ mb: 1 }}
              >
                {isMute ? "Type to speak" : "Your reply"}
              </Typography>
              <TextField
                multiline
                minRows={2}
                fullWidth
                placeholder="Type a message…"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSpeak();
                  }
                }}
                sx={{ mb: 1.25 }}
              />
              <Stack direction="row" spacing={1}>
                <Button
                  variant="contained"
                  size="large"
                  fullWidth
                  startIcon={<RecordVoiceOverIcon />}
                  onClick={handleSpeak}
                  disabled={!text.trim()}
                >
                  Speak
                </Button>
                {variant === "deaf" && (
                  <Button
                    variant={room.talking ? "contained" : "outlined"}
                    color={room.talking ? "error" : "primary"}
                    size="large"
                    onClick={room.toggleTalk}
                    aria-pressed={room.talking}
                    aria-label={
                      room.talking ? "Stop using my voice" : "Use my voice"
                    }
                    sx={{ minWidth: 56, px: 1.5 }}
                  >
                    {room.talking ? <MicOffIcon /> : <MicIcon />}
                  </Button>
                )}
              </Stack>
              {variant === "deaf" && room.talking && (
                <LinearProgress
                  variant="determinate"
                  value={Math.round(room.micLevel * 100)}
                  aria-hidden
                  sx={{ mt: 1, borderRadius: 1 }}
                />
              )}
            </Box>

            <QuickReplies onReply={handleQuickReply} />

            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              <Button
                variant="outlined"
                startIcon={<SlowMotionVideoIcon />}
                onClick={handleClarifyLast}
                disabled={clarifyBusy}
              >
                {clarifyBusy ? "…" : "Clarify"}
              </Button>
              <Button
                variant="outlined"
                startIcon={<SummarizeIcon />}
                onClick={handleRecap}
                disabled={summaryLoading}
              >
                {summaryLoading ? "…" : "Recap"}
              </Button>
              <Button
                variant="contained"
                color="secondary"
                startIcon={<VideocamIcon />}
                onClick={handleShowCamera}
                disabled={cameraBusy}
              >
                {cameraBusy ? "…" : "Show your camera"}
              </Button>
            </Stack>
            <Typography variant="caption" color="text.secondary">
              Camera descriptions help blind participants. Accessibility aid
              only — not a replacement for mobility tools.
            </Typography>
          </Stack>
        </Box>
      </Container>
    </Box>
  );
}
