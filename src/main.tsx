import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { CssBaseline, ThemeProvider } from "@mui/material";
import App from "./App";
import { senseBridgeTheme } from "./theme";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider theme={senseBridgeTheme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </StrictMode>
);
