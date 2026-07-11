import { useEffect, useState } from "react";
import {
  Box,
  Button,
  ButtonGroup,
  Chip,
  Collapse,
  IconButton,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import type { Role } from "../types";

const STORAGE_KEY = "sensebridge-debug";

function MaterialIcon({
  name,
  fontSize = 20,
}: {
  name: string;
  fontSize?: number;
}) {
  return (
    <Box
      component="span"
      className="material-icons-outlined"
      aria-hidden
      sx={{ fontSize, lineHeight: 1, display: "inline-flex" }}
    >
      {name}
    </Box>
  );
}

export function isDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get("debug") === "1" || params.get("debug") === "true") return true;
  if (params.get("debug") === "0" || params.get("debug") === "false") return false;
  return localStorage.getItem(STORAGE_KEY) === "1";
}

export function setDebugEnabled(on: boolean) {
  localStorage.setItem(STORAGE_KEY, on ? "1" : "0");
  const url = new URL(window.location.href);
  if (on) url.searchParams.set("debug", "1");
  else url.searchParams.delete("debug");
  window.history.replaceState({}, "", url.toString());
}

interface DebugPanelProps {
  activeRole: Role | null;
  joined: boolean;
  onSwitchRole: (role: Role) => void;
  /** Quick-join a demo room as a role (when still in lobby). */
  onQuickJoin?: (role: Role) => void;
}

const ROLES: { id: Role; label: string }[] = [
  { id: "blind", label: "Blind" },
  { id: "deaf", label: "Deaf" },
  { id: "mute", label: "Mute" },
];

/**
 * Floating debug panel for single-device demos.
 * Toggle with ?debug=1 in the URL, or via the bug icon.
 */
export function DebugPanel({
  activeRole,
  joined,
  onSwitchRole,
  onQuickJoin,
}: DebugPanelProps) {
  const [open, setOpen] = useState(true);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(isDebugEnabled());
  }, []);

  const enable = () => {
    setDebugEnabled(true);
    setEnabled(true);
    setOpen(true);
  };

  const disable = () => {
    setDebugEnabled(false);
    setEnabled(false);
  };

  if (!enabled) {
    return (
      <IconButton
        aria-label="Enable debug mode"
        onClick={enable}
        sx={{
          position: "fixed",
          right: 16,
          bottom: 16,
          zIndex: 1500,
          bgcolor: "background.paper",
          border: "1px solid",
          borderColor: "divider",
          boxShadow: 2,
          "&:hover": { bgcolor: "grey.100" },
        }}
      >
        <MaterialIcon name="bug_report" />
      </IconButton>
    );
  }

  return (
    <Paper
      elevation={6}
      sx={{
        position: "fixed",
        right: 16,
        bottom: 16,
        zIndex: 1500,
        width: open ? 300 : "auto",
        borderRadius: 3,
        overflow: "hidden",
        border: "1px solid",
        borderColor: "warning.main",
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{
          px: 1.5,
          py: 1,
          bgcolor: "warning.light",
          cursor: "pointer",
        }}
        onClick={() => setOpen((v) => !v)}
      >
        <MaterialIcon name="bug_report" />
        <Typography variant="subtitle2" sx={{ flex: 1, fontWeight: 700 }}>
          Debug mode
        </Typography>
        <Chip size="small" label={joined ? "in room" : "lobby"} />
        <IconButton
          size="small"
          aria-label="Close debug panel"
          onClick={(e) => {
            e.stopPropagation();
            setOpen(false);
          }}
        >
          <MaterialIcon name="close" fontSize={18} />
        </IconButton>
      </Stack>

      <Collapse in={open}>
        <Box sx={{ p: 1.5 }}>
          <Typography
            variant="caption"
            color="text.secondary"
            display="block"
            sx={{ mb: 1 }}
          >
            {joined
              ? "Switch role instantly for the demo (same room)."
              : "Jump into room DEMO as any role."}
          </Typography>

          <ButtonGroup fullWidth orientation="vertical" variant="outlined">
            {ROLES.map((r) => (
              <Button
                key={r.id}
                variant={activeRole === r.id ? "contained" : "outlined"}
                onClick={() => {
                  if (joined) onSwitchRole(r.id);
                  else onQuickJoin?.(r.id);
                }}
              >
                {r.label}
                {activeRole === r.id ? " · current" : ""}
              </Button>
            ))}
          </ButtonGroup>

          <Button
            fullWidth
            size="small"
            color="inherit"
            sx={{ mt: 1 }}
            onClick={disable}
          >
            Turn off debug
          </Button>
        </Box>
      </Collapse>
    </Paper>
  );
}
