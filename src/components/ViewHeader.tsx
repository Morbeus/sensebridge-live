import {
  AppBar,
  Avatar,
  Box,
  Button,
  Chip,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";
import type { Peer, Role } from "../types";
import { ROLE_LABEL } from "../types";

interface ViewHeaderProps {
  roomCode: string;
  roleLabel: string;
  mockLive: boolean;
  talking?: boolean;
  onLeave: () => void;
  /** Everyone else currently in the room. */
  peers: Peer[];
  /** Local participant display name. */
  selfName: string;
  selfRole: Role | null;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

const ROLE_AVATAR_COLOR: Record<string, string> = {
  blind: "#1a73e8",
  deaf: "#188038",
  mute: "#a142f4",
};

/** Compact Google Meet–style top bar with named participants. */
export function ViewHeader({
  roomCode,
  roleLabel,
  mockLive,
  talking,
  onLeave,
  peers,
  selfName,
  selfRole,
}: ViewHeaderProps) {
  const everyone: Array<{ name: string; role: string; self?: boolean }> = [
    {
      name: selfName || "You",
      role: selfRole ?? "deaf",
      self: true,
    },
    ...peers.map((p) => ({ name: p.name, role: p.role })),
  ];

  return (
    <AppBar
      position="sticky"
      color="inherit"
      elevation={0}
      sx={{
        borderBottom: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper",
        color: "text.primary",
      }}
    >
      <Toolbar
        sx={{
          gap: 1.5,
          minHeight: { xs: 64, sm: 72 },
          flexWrap: "wrap",
          py: 1,
        }}
      >
        <Box sx={{ flex: 1, minWidth: 140 }}>
          <Typography variant="subtitle1" component="h1" noWrap fontWeight={600}>
            SenseBridge Live
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            noWrap
            display="block"
          >
            {roleLabel} · Room {roomCode}
          </Typography>
        </Box>

        <Stack
          direction="row"
          spacing={1}
          useFlexGap
          flexWrap="wrap"
          alignItems="center"
          aria-label="People in this room"
          sx={{ flex: { xs: "1 1 100%", sm: "0 1 auto" }, justifyContent: "flex-end" }}
        >
          {everyone.map((person, i) => (
            <Tooltip
              key={`${person.name}-${person.role}-${i}`}
              title={`${person.name} · ${ROLE_LABEL[person.role as Role] ?? person.role}${
                person.self ? " (you)" : ""
              }`}
            >
              <Chip
                avatar={
                  <Avatar
                    sx={{
                      bgcolor: ROLE_AVATAR_COLOR[person.role] ?? "#5f6368",
                      width: 24,
                      height: 24,
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    {initials(person.name)}
                  </Avatar>
                }
                label={person.self ? `${person.name} (you)` : person.name}
                variant={person.self ? "filled" : "outlined"}
                color={person.self ? "primary" : "default"}
                size="small"
                sx={{ maxWidth: 160 }}
              />
            </Tooltip>
          ))}
        </Stack>

        <Stack direction="row" spacing={1} alignItems="center">
          {talking && <Chip size="small" label="Talking" color="warning" />}
          {mockLive && (
            <Chip size="small" label="Mock" color="warning" variant="outlined" />
          )}
          <Button variant="outlined" color="error" size="small" onClick={onLeave}>
            Leave
          </Button>
        </Stack>
      </Toolbar>
    </AppBar>
  );
}
