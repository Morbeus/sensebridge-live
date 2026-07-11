import { useState, type ReactNode } from "react";
import {
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Container,
  Stack,
  TextField,
  Typography,
  Alert,
} from "@mui/material";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import HearingDisabledIcon from "@mui/icons-material/HearingDisabled";
import RecordVoiceOverIcon from "@mui/icons-material/RecordVoiceOver";
import type { Role } from "../types";

interface LobbyProps {
  onJoin: (roomCode: string, role: Role, name: string) => void;
  mockHint: boolean;
}

function randomCode() {
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}

const ROLES: {
  id: Role;
  title: string;
  desc: string;
  icon: ReactNode;
}[] = [
  {
    id: "blind",
    title: "Blind / Low-vision",
    desc: "Push-to-talk to be captioned. Hear replies and camera descriptions aloud.",
    icon: <VisibilityOffIcon fontSize="large" color="primary" />,
  },
  {
    id: "deaf",
    title: "Deaf / Hard-of-hearing",
    desc: "Read live captions. Type, tap replies, or use your voice. Show your camera.",
    icon: <HearingDisabledIcon fontSize="large" color="primary" />,
  },
  {
    id: "mute",
    title: "Speech difficulty / Mute",
    desc: "Hear others; type and your device speaks for you. Show your camera.",
    icon: <RecordVoiceOverIcon fontSize="large" color="primary" />,
  },
];

export function Lobby({ onJoin, mockHint }: LobbyProps) {
  const [role, setRole] = useState<Role | null>(null);
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");

  const canJoin = Boolean(role && roomCode.trim());

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "background.default",
        py: { xs: 3, md: 6 },
        px: 2,
      }}
    >
      <Container maxWidth="md">
        <Stack spacing={1} sx={{ mb: 3 }}>
          <Typography
            variant="h3"
            component="h1"
            sx={{ color: "primary.main", fontWeight: 500 }}
          >
            SenseBridge
          </Typography>
          <Typography variant="h6" color="text.secondary" fontWeight={400}>
            Real-time accessibility meeting room — powered by Gemini
          </Typography>
        </Stack>

        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
          1. I am joining as
        </Typography>
        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr 1fr" },
            mb: 3,
          }}
        >
          {ROLES.map((r) => {
            const selected = role === r.id;
            return (
              <Card
                key={r.id}
                variant="outlined"
                sx={{
                  borderWidth: 2,
                  borderColor: selected ? "primary.main" : "divider",
                  bgcolor: "background.paper",
                  boxShadow: selected
                    ? "0 0 0 1px rgba(26,115,232,0.2)"
                    : "none",
                  transition: "border-color 120ms, box-shadow 120ms",
                }}
              >
                <CardActionArea
                  onClick={() => setRole(r.id)}
                  aria-pressed={selected}
                  sx={{ height: "100%", alignItems: "stretch" }}
                >
                  <CardContent>
                    <Stack spacing={1}>
                      {r.icon}
                      <Typography variant="subtitle1" fontWeight={600}>
                        {r.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {r.desc}
                      </Typography>
                    </Stack>
                  </CardContent>
                </CardActionArea>
              </Card>
            );
          })}
        </Box>

        <Stack spacing={2} sx={{ mb: 3 }}>
          <TextField
            label="2. Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Alex"
            fullWidth
          />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <TextField
              label="3. Room code"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="e.g. AB12"
              fullWidth
              onKeyDown={(e) => {
                if (e.key === "Enter" && canJoin) {
                  onJoin(roomCode.trim(), role!, name.trim() || "Guest");
                }
              }}
              inputProps={{
                style: { letterSpacing: "0.12em", fontWeight: 600 },
                "aria-label": "Room code",
              }}
            />
            <Button
              variant="outlined"
              onClick={() => setRoomCode(randomCode())}
              sx={{ minWidth: 120, whiteSpace: "nowrap" }}
            >
              Generate
            </Button>
          </Stack>
        </Stack>

        <Button
          variant="contained"
          size="large"
          fullWidth
          disabled={!canJoin}
          onClick={() => onJoin(roomCode.trim(), role!, name.trim() || "Guest")}
        >
          Join room
        </Button>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Share the room code. Everyone opens this page, picks a role, and enters
          the same code.
        </Typography>

        {mockHint && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            Mock mode — captions are simulated. Fine for offline demos.
          </Alert>
        )}

        <Typography
          variant="caption"
          color="text.secondary"
          display="block"
          sx={{ mt: 3 }}
        >
          SenseBridge Live is an accessibility assistance prototype. It should
          not be used as the sole source of navigation, medical, legal,
          emergency, or safety-critical guidance.
        </Typography>
      </Container>
    </Box>
  );
}
