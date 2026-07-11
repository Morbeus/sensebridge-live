import { useEffect, useRef } from "react";
import {
  Button,
  IconButton,
  List,
  ListItem,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import type { Entry } from "../types";
import { speak } from "../utils/speech";

interface TranscriptProps {
  entries: Entry[];
  onClear: () => void;
}

const ROLE_COLOR: Record<string, string> = {
  blind: "#1a73e8",
  deaf: "#188038",
  mute: "#a142f4",
  system: "#5f6368",
};

export function Transcript({ entries, onClear }: TranscriptProps) {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries.length]);

  return (
    <Paper
      component="section"
      aria-label="Chat window"
      sx={{ p: 2, display: "flex", flexDirection: "column", minHeight: 280 }}
    >
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ mb: 1 }}
      >
        <Typography variant="subtitle2" color="text.secondary" fontWeight={600}>
          Chat window
        </Typography>
        <Button size="small" onClick={onClear} disabled={entries.length === 0}>
          Clear
        </Button>
      </Stack>

      <List sx={{ flex: 1, maxHeight: 360, overflow: "auto", py: 0 }}>
        {entries.length === 0 && (
          <ListItem sx={{ color: "text.secondary", px: 0 }}>
            Messages will appear here.
          </ListItem>
        )}
        {entries.map((entry) => (
          <ListItem
            key={entry.id}
            alignItems="flex-start"
            sx={{
              flexDirection: "column",
              alignItems: "stretch",
              borderLeft: "3px solid",
              borderColor: ROLE_COLOR[entry.role] ?? "divider",
              bgcolor: "transparent",
              borderRadius: 0,
              mb: 1.25,
              px: 1.25,
              py: 0.5,
            }}
          >
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <Typography
                variant="caption"
                fontWeight={600}
                color="text.secondary"
                sx={{ flex: 1 }}
              >
                {entry.speaker}
                {entry.self ? " (you)" : ""}
              </Typography>
              <IconButton
                size="small"
                aria-label={`Replay message from ${entry.speaker}`}
                onClick={() => speak(entry.text)}
              >
                <VolumeUpIcon fontSize="small" />
              </IconButton>
            </Stack>
            <Typography variant="body1" sx={{ pr: 0.5 }}>
              {entry.text}
            </Typography>
          </ListItem>
        ))}
        <div ref={endRef} />
      </List>
    </Paper>
  );
}
