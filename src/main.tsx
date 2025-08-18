import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import React, { Suspense } from "react";
const Pong = React.lazy(() => import("./games/pong/Pong"));
const Breakout = React.lazy(() => import("./games/breakout/Breakout"));
const Tetris = React.lazy(() => import("./games/tetris/Tetris"));

// MUI theme setup
import { ThemeProvider, createTheme, CssBaseline } from "@mui/material";

// Router
import { BrowserRouter, Routes, Route } from "react-router-dom";

const theme = createTheme({
  typography: {
    fontFamily: 'Roboto, system-ui, -apple-system, "Segoe UI", sans-serif',
  },
  palette: {
    mode: "dark",
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter basename={import.meta.env.BASE_URL || "/"}>
        <Suspense fallback={<div style={{ padding: 20 }}>Loading...</div>}>
          <Routes>
            <Route path="/" element={<App />} />
            <Route path="/pong" element={<Pong />} />
            <Route path="/breakout" element={<Breakout />} />
            <Route path="/tetris" element={<Tetris />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>
);
