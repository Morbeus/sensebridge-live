import { Box, Button, Typography } from "@mui/material";

interface QuickRepliesProps {
  onReply: (text: string) => void;
  disabled?: boolean;
}

const QUICK_REPLIES = [
  "Please repeat",
  "Speak slower",
  "I understood",
  "Explain again",
  "Wait here",
  "Follow me",
  "Turn left",
  "Turn right",
];

export function QuickReplies({ onReply, disabled }: QuickRepliesProps) {
  return (
    <Box
      component="section"
      aria-label="Quick replies"
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
        Quick replies
      </Typography>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 0.75,
        }}
      >
        {QUICK_REPLIES.map((label) => (
          <Button
            key={label}
            variant="outlined"
            size="small"
            onClick={() => onReply(label)}
            disabled={disabled}
            sx={{ py: 1, textAlign: "center", lineHeight: 1.25 }}
          >
            {label}
          </Button>
        ))}
      </Box>
    </Box>
  );
}
