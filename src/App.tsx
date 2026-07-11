import { Box, Snackbar, Alert } from "@mui/material";
import { useCallback, useState } from "react";
import { Lobby } from "./components/Lobby";
import { DebugPanel } from "./components/DebugPanel";
import { ConversationView } from "./views/ConversationView";
import { BlindView } from "./views/BlindView";
import { useRoom } from "./hooks/useRoom";
import { stopSpeaking } from "./utils/speech";
import type { Role } from "./types";

export default function App() {
  const [toast, setToast] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState("");

  const notify = useCallback((message: string) => {
    setToast(message);
  }, []);

  const room = useRoom({ onError: notify });

  const handleJoin = useCallback(
    (code: string, role: Role, name: string) => {
      setRoomCode(code);
      void room.join(code, role, name);
    },
    [room]
  );

  const handleLeave = useCallback(() => {
    stopSpeaking();
    room.leave();
    setRoomCode("");
  }, [room]);

  const handleSwitchRole = useCallback(
    (role: Role) => {
      stopSpeaking();
      void room.switchRole(role);
      notify(`Switched to ${role} view`);
    },
    [room, notify]
  );

  const handleQuickJoin = useCallback(
    (role: Role) => {
      handleJoin("DEMO", role, "Demo");
      notify(`Joined DEMO as ${role}`);
    },
    [handleJoin, notify]
  );

  return (
    <Box sx={{ minHeight: "100vh" }}>
      {!room.joined ? (
        <Lobby onJoin={handleJoin} mockHint={room.mockLive} />
      ) : room.role === "blind" ? (
        <BlindView
          room={room}
          roomCode={roomCode}
          onLeave={handleLeave}
          notify={notify}
        />
      ) : (
        <ConversationView
          room={room}
          roomCode={roomCode}
          onLeave={handleLeave}
          notify={notify}
          variant={room.role === "mute" ? "mute" : "deaf"}
        />
      )}

      <DebugPanel
        activeRole={room.role}
        joined={room.joined}
        onSwitchRole={handleSwitchRole}
        onQuickJoin={handleQuickJoin}
      />

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={4500}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity="info"
          variant="filled"
          onClose={() => setToast(null)}
          sx={{ width: "100%" }}
        >
          {toast}
        </Alert>
      </Snackbar>
    </Box>
  );
}
