import { Button, Paper, Stack, Typography } from "@mui/material";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import { speak } from "../utils/speech";

interface SummaryPanelProps {
  summary: string;
  loading: boolean;
}

export function SummaryPanel({ summary, loading }: SummaryPanelProps) {
  return (
    <Paper component="section" aria-label="Conversation recap" sx={{ p: 2 }}>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ mb: 0.5 }}
      >
        <Typography variant="subtitle2" color="text.secondary" fontWeight={600}>
          Recap
        </Typography>
        {summary && !loading && (
          <Button
            size="small"
            startIcon={<VolumeUpIcon fontSize="small" />}
            onClick={() => speak(summary)}
          >
            Replay
          </Button>
        )}
      </Stack>
      <Typography variant="body1" aria-live="polite">
        {loading ? "Summarizing…" : summary}
      </Typography>
    </Paper>
  );
}
