import { Box, Chip, Paper, Stack, Typography } from "@mui/material";
import type { LiveCaption } from "../types";

interface CaptionPanelProps {
  liveCaption: LiveCaption | null;
  lastFinal?: string;
  waitingLabel?: string;
}

export function CaptionPanel({
  liveCaption,
  lastFinal,
  waitingLabel = "Waiting for speech…",
}: CaptionPanelProps) {
  const text = liveCaption?.text || lastFinal || "";
  const speaker = liveCaption?.speaker;
  const isLive = Boolean(liveCaption?.text);

  return (
    <Paper
      component="section"
      aria-label="Live captions"
      sx={{
        p: 2,
        minHeight: 140,
        bgcolor: "#f8fbff",
        borderColor: "divider",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ mb: 1 }}
      >
        <Typography variant="subtitle2" color="text.secondary" fontWeight={600}>
          {speaker ?? "Live captions"}
        </Typography>
        {isLive && (
          <Chip size="small" label="Live" color="success" sx={{ height: 24 }} />
        )}
      </Stack>

      <Box
        aria-live="assertive"
        aria-atomic="true"
        role="status"
        sx={{ flex: 1, display: "flex", alignItems: "center" }}
      >
        <Typography
          variant="h5"
          component="p"
          sx={{
            m: 0,
            fontWeight: 500,
            lineHeight: 1.4,
            color: text ? "text.primary" : "text.secondary",
          }}
        >
          {text || waitingLabel}
        </Typography>
      </Box>
    </Paper>
  );
}
