import "./App.css";
import { useState, useEffect, useRef } from "react";
import Box from "@mui/material/Box";
import { Link as RouterLink } from "react-router-dom";

export default function App() {
  const games = [
    { title: "PONG", to: "/pong", year: "1972", ready: true },
    { title: "BREAKOUT", to: "/breakout", year: "1976", ready: true },
    { title: "TETRIS", to: "/tetris", year: "1984", ready: true },
    { title: "SNAKE", to: undefined, year: "1976", ready: false },
    { title: "SPACE INVADERS", to: undefined, year: "1978", ready: false },
    { title: "PAC-MAN", to: undefined, year: "1980", ready: false },
    { title: "ASTEROIDS", to: undefined, year: "1979", ready: false },
    { title: "FROGGER", to: undefined, year: "1981", ready: false },
  ];

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isFlashing, setIsFlashing] = useState(false);
  const flashIntervalRef = useRef<number | null>(null);

  // Auto-cycle through games for that authentic arcade attract mode
  useEffect(() => {
    const interval = setInterval(() => {
      setSelectedIndex((prev) => (prev + 1) % games.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [games.length]);

  // Flash effect for selection
  useEffect(() => {
    if (flashIntervalRef.current) clearInterval(flashIntervalRef.current);
    flashIntervalRef.current = window.setInterval(() => {
      setIsFlashing((prev) => !prev);
    }, 500);
    return () => {
      if (flashIntervalRef.current) clearInterval(flashIntervalRef.current);
    };
  }, [selectedIndex]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + games.length) % games.length);
        break;
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % games.length);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (games[selectedIndex].ready && games[selectedIndex].to) {
          window.location.href = games[selectedIndex].to!;
        }
        break;
    }
  };

  return (
    <Box
      className="arcade-screen"
      onKeyDown={handleKeyPress}
      tabIndex={0}
      sx={{
        outline: "none",
        "&:focus": { outline: "none" },
      }}
    >
      {/* CRT scanlines and effects */}
      <div className="crt-scanlines" />
      <div className="crt-flicker" />
      <div className="screen-glow" />

      {/* Header */}
      <div className="arcade-header">
        <div className="title-glow">
          <h1 className="arcade-title">ARCADE HUB</h1>
          <div className="subtitle">SELECT YOUR GAME</div>
        </div>
        <div className="credits">
          <div className="credit-text">CREDITS: 99</div>
          <div className="insert-coin">INSERT COIN</div>
        </div>
      </div>

      {/* Game List */}
      <div className="game-list">
        {games.map((game, index) => (
          <div
            key={game.title}
            className={`game-item ${
              index === selectedIndex
                ? isFlashing
                  ? "selected flashing"
                  : "selected"
                : ""
            } ${!game.ready ? "coming-soon" : ""}`}
            onClick={() => setSelectedIndex(index)}
          >
            <div className="game-number">
              {String(index + 1).padStart(2, "0")}
            </div>
            <div className="game-info">
              <div className="game-title">{game.title}</div>
              <div className="game-year">{game.year}</div>
            </div>
            <div className="game-status">
              {game.ready ? (
                <div className="ready-indicator">●</div>
              ) : (
                <div className="coming-soon-text">SOON</div>
              )}
            </div>
            {game.ready && game.to && (
              <RouterLink to={game.to} className="hidden-link" />
            )}
          </div>
        ))}
      </div>

      {/* Instructions */}
      <div className="arcade-instructions">
        <div className="instruction-line">
          <span className="key">▲▼</span>
          <span className="action">SELECT GAME</span>
        </div>
        <div className="instruction-line">
          <span className="key">ENTER</span>
          <span className="action">START GAME</span>
        </div>
        <div className="instruction-line">
          <span className="key">CLICK</span>
          <span className="action">TOUCH TO SELECT</span>
        </div>
      </div>

      {/* High Score ticker */}
      <div className="high-score-ticker">
        <div className="ticker-content">
          ★ HIGH SCORES ★ PONG: 12,450 ★ BREAKOUT: 8,760 ★ TETRIS: 156,890 ★
          COMING SOON: SNAKE, SPACE INVADERS, PAC-MAN ★ HIGH SCORES ★
        </div>
      </div>
    </Box>
  );
}
