import { createTheme } from "@mui/material/styles";

/**
 * Material Design 3 theme tuned to feel like a Google product
 * (Meet / Assistant / accessibility tools): Google Blue primary, soft surfaces,
 * Roboto typography, generous touch targets.
 */
export const senseBridgeTheme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#1a73e8",
      dark: "#174ea6",
      light: "#8ab4f8",
      contrastText: "#ffffff",
    },
    secondary: {
      main: "#188038",
      dark: "#0d652d",
      light: "#81c995",
    },
    error: {
      main: "#d93025",
    },
    warning: {
      main: "#f9ab00",
    },
    info: {
      main: "#1a73e8",
    },
    success: {
      main: "#188038",
    },
    background: {
      default: "#f8f9fa",
      paper: "#ffffff",
    },
    text: {
      primary: "#202124",
      secondary: "#5f6368",
    },
    divider: "#dadce0",
  },
  typography: {
    fontFamily: '"Google Sans", "Roboto", "Helvetica Neue", Arial, sans-serif',
    h1: { fontWeight: 500, letterSpacing: "-0.02em" },
    h2: { fontWeight: 500 },
    h3: { fontWeight: 500 },
    h4: { fontWeight: 500 },
    h5: { fontWeight: 500 },
    h6: { fontWeight: 500 },
    button: { textTransform: "none", fontWeight: 500 },
  },
  shape: {
    borderRadius: 16,
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: 24,
          paddingInline: 20,
          minHeight: 44,
        },
        sizeLarge: {
          minHeight: 52,
          fontSize: "1.05rem",
        },
      },
    },
    MuiFab: {
      styleOverrides: {
        root: {
          boxShadow:
            "0 1px 2px rgba(60,64,67,.3), 0 1px 3px 1px rgba(60,64,67,.15)",
        },
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          backgroundImage: "none",
          border: "1px solid #dadce0",
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 500 },
      },
    },
    MuiTextField: {
      defaultProps: { variant: "outlined" },
    },
  },
});
