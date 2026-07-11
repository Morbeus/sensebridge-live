import { useCallback, useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  Container,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";
import ReplayIcon from "@mui/icons-material/Replay";
import SummarizeIcon from "@mui/icons-material/Summarize";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import { RemoteAudio } from "../components/RemoteAudio";
import { ViewHeader } from "../components/ViewHeader";
import { speak } from "../utils/speech";
import type { Entry } from "../types";
import type { RoomApi } from "../hooks/useRoom";

interface BlindViewProps {
  room: RoomApi;
  roomCode: string;
  onLeave: () => void;
  notify: (message: string) => void;
}

/**
 * Blind / low-vision view — sparse, push-to-talk, voice-first.
 */
export function BlindView({ room, roomCode, onLeave, notify }: BlindViewProps) {
  const {
    entries,
    talking,
    pressTalk,
    releaseTalk,
    micLevel,
    mockLive,
    simulate,
  } = room;
  const [lastHeard, setLastHeard] = useState("");
  const [recapBusy, setRecapBusy] = useState(false);
  const holdingRef = useRef(false);

  const spokenCountRef = useRef(0);
  useEffect(() => {
    if (spokenCountRef.current === 0) {
      spokenCountRef.current = entries.length;
      return;
    }
    for (let i = spokenCountRef.current; i < entries.length; i++) {
      const e = entries[i];
      if (e.self || e.kind === "caption") continue;

      if (e.kind === "scene") {
        const spoken = `Camera from ${e.speaker}. ${e.text}`;
        setLastHeard(spoken);
        speak(spoken, { rate: 0.9 });
        continue;
      }

      setLastHeard(e.text);
      speak(e.text, {
        rate: e.kind === "clarify" || e.kind === "summary" ? 0.78 : 1,
      });
    }
    spokenCountRef.current = entries.length;
  }, [entries]);

  const beginHold = useCallback(() => {
    if (holdingRef.current) return;
    holdingRef.current = true;
    pressTalk();
  }, [pressTalk]);

  const endHold = useCallback(() => {
    if (!holdingRef.current) return;
    holdingRef.current = false;
    releaseTalk();
  }, [releaseTalk]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "BUTTON") return;
      e.preventDefault();
      beginHold();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "Escape") {
        e.preventDefault();
        endHold();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", endHold);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", endHold);
    };
  }, [beginHold, endHold]);

  const repeatLast = useCallback(() => {
    const last = [...entries]
      .reverse()
      .find((e: Entry) => !e.self && e.kind !== "caption");
    if (!last) {
      notify("Nothing has been said to you yet.");
      return;
    }
    const text =
      last.kind === "scene"
        ? `Camera from ${last.speaker}. ${last.text}`
        : last.text;
    setLastHeard(text);
    speak(text);
  }, [entries, notify]);

  const hearRecap = useCallback(async () => {
    if (entries.length === 0) {
      notify("No conversation yet.");
      return;
    }
    setRecapBusy(true);
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
      setLastHeard(data.summary ?? "");
      speak(data.summary ?? "", { rate: 0.85 });
    } catch {
      notify("Recap failed — is the backend running?");
    } finally {
      setRecapBusy(false);
    }
  }, [entries, notify]);

  const partnerCount = room.peers.length;
  const statusText =
    partnerCount === 0
      ? "Waiting for someone to join."
      : talking
        ? "Recording — release when done."
        : "Hold to talk · Space works too";

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <RemoteAudio streams={room.remoteStreams} />
      <ViewHeader
        roomCode={roomCode}
        roleLabel="Blind / Low-vision"
        mockLive={mockLive}
        talking={talking}
        onLeave={onLeave}
        peers={room.peers}
        selfName={room.selfName}
        selfRole={room.role}
      />

      <Container maxWidth="sm" sx={{ py: { xs: 3, md: 5 } }}>
        <Stack spacing={2.5} alignItems="center">
          <Typography
            variant="body1"
            component="p"
            aria-live="polite"
            color="text.secondary"
            textAlign="center"
            sx={{ m: 0 }}
          >
            {statusText}
          </Typography>

          {/* Mic circle — icon only, label sits below for clean centering */}
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 1.5,
              width: "100%",
            }}
          >
            <Box
              component="button"
              type="button"
              aria-label={
                talking
                  ? "Release to stop talking"
                  : "Hold to talk. You can also hold the Space key."
              }
              aria-pressed={talking}
              onPointerDown={(e) => {
                e.preventDefault();
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                beginHold();
              }}
              onPointerUp={endHold}
              onPointerCancel={endHold}
              onLostPointerCapture={endHold}
              onContextMenu={(e) => e.preventDefault()}
              sx={{
                width: 200,
                height: 200,
                borderRadius: "50%",
                border: "none",
                p: 0,
                m: 0,
                cursor: "pointer",
                display: "grid",
                placeItems: "center",
                bgcolor: talking ? "error.main" : "primary.main",
                color: "#fff",
                touchAction: "none",
                userSelect: "none",
                WebkitUserSelect: "none",
                WebkitTouchCallout: "none",
                boxShadow: talking
                  ? "0 0 0 10px rgba(217,48,37,0.18)"
                  : "0 2px 6px rgba(60,64,67,.25)",
                transition: "background-color 120ms, box-shadow 120ms",
                "&:focus-visible": {
                  outline: "3px solid",
                  outlineColor: "primary.dark",
                  outlineOffset: 4,
                },
                "& .material-icons-outlined": {
                  fontSize: 72,
                  lineHeight: 1,
                },
              }}
            >
              <Box
                component="span"
                className="material-icons-outlined"
                aria-hidden
              >
                mic
              </Box>
            </Box>

            <Typography
              variant="h6"
              fontWeight={600}
              textAlign="center"
              sx={{ m: 0 }}
            >
              {talking ? "Release to stop" : "Hold to talk"}
            </Typography>

            <Box sx={{ width: 200 }}>
              <LinearProgress
                variant="determinate"
                value={Math.round(micLevel * 100)}
                aria-hidden
                sx={{
                  height: 6,
                  borderRadius: 3,
                  bgcolor: "grey.200",
                  "& .MuiLinearProgress-bar": {
                    bgcolor: talking ? "error.main" : "primary.main",
                  },
                }}
              />
            </Box>
          </Box>

          <Box
            sx={{
              width: "100%",
              p: 2,
              borderRadius: 3,
              border: "1px solid",
              borderColor: "divider",
              bgcolor: "background.paper",
              textAlign: "left",
            }}
            aria-label="Last message heard"
          >
            <Typography
              variant="caption"
              color="text.secondary"
              fontWeight={600}
              display="block"
              sx={{ mb: 0.5 }}
            >
              Last heard
            </Typography>
            <Typography
              variant="body1"
              component="p"
              aria-live="polite"
              sx={{ m: 0, fontSize: "1.15rem", fontWeight: 500 }}
            >
              {lastHeard || "Replies will be read aloud here."}
            </Typography>
          </Box>

          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            sx={{ width: "100%" }}
          >
            <Button
              variant="outlined"
              size="large"
              fullWidth
              startIcon={<ReplayIcon />}
              onClick={repeatLast}
            >
              Repeat
            </Button>
            <Button
              variant="outlined"
              size="large"
              fullWidth
              startIcon={<SummarizeIcon />}
              onClick={hearRecap}
              disabled={recapBusy}
            >
              {recapBusy ? "…" : "Recap"}
            </Button>
            {mockLive && (
              <Button
                variant="text"
                size="large"
                fullWidth
                startIcon={<PlayArrowIcon />}
                onClick={simulate}
              >
                Simulate
              </Button>
            )}
          </Stack>

          <Typography
            variant="caption"
            color="text.secondary"
            textAlign="center"
            sx={{ maxWidth: 420 }}
          >
            Accessibility prototype — not a replacement for mobility aids or
            emergency guidance.
          </Typography>
        </Stack>
      </Container>
    </Box>
  );
}
