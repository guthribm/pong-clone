import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import IconButton from "@mui/material/IconButton";
import ArrowBack from "@mui/icons-material/ArrowBack";
import Button from "@mui/material/Button";
import Select from "@mui/material/Select";
import type { SelectChangeEvent } from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Container from "@mui/material/Container";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import PlayArrow from "@mui/icons-material/PlayArrow";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme as useMuiTheme } from "@mui/material/styles";
import { useNavigate } from "react-router-dom";

type Cell = number; // 0 = empty, >0 color index
type Grid = Cell[][];

const COLS = 10;
const ROWS = 20;

const tetrominoes: { [k: string]: number[][][] } = {
  I: [
    [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 0, 1, 0],
      [0, 0, 1, 0],
      [0, 0, 1, 0],
      [0, 0, 1, 0],
    ],
  ],
  O: [
    [
      [2, 2],
      [2, 2],
    ],
  ],
  T: [
    [
      [0, 3, 0],
      [3, 3, 3],
      [0, 0, 0],
    ],
    [
      [0, 3, 0],
      [0, 3, 3],
      [0, 3, 0],
    ],
    [
      [0, 0, 0],
      [3, 3, 3],
      [0, 3, 0],
    ],
    [
      [0, 3, 0],
      [3, 3, 0],
      [0, 3, 0],
    ],
  ],
  L: [
    [
      [0, 0, 4],
      [4, 4, 4],
      [0, 0, 0],
    ],
    [
      [0, 4, 0],
      [0, 4, 0],
      [0, 4, 4],
    ],
    [
      [0, 0, 0],
      [4, 4, 4],
      [4, 0, 0],
    ],
    [
      [4, 4, 0],
      [0, 4, 0],
      [0, 4, 0],
    ],
  ],
  J: [
    [
      [5, 0, 0],
      [5, 5, 5],
      [0, 0, 0],
    ],
    [
      [0, 5, 5],
      [0, 5, 0],
      [0, 5, 0],
    ],
    [
      [0, 0, 0],
      [5, 5, 5],
      [0, 0, 5],
    ],
    [
      [0, 5, 0],
      [0, 5, 0],
      [5, 5, 0],
    ],
  ],
  S: [
    [
      [0, 6, 6],
      [6, 6, 0],
      [0, 0, 0],
    ],
    [
      [0, 6, 0],
      [0, 6, 6],
      [0, 0, 6],
    ],
  ],
  Z: [
    [
      [7, 7, 0],
      [0, 7, 7],
      [0, 0, 0],
    ],
    [
      [0, 0, 7],
      [0, 7, 7],
      [0, 7, 0],
    ],
  ],
};

const COLORS = [
  "#000000", // Empty
  "#00ffff", // Cyan (I-piece) - Classic Tetris cyan
  "#0000ff", // Blue (J-piece) - Classic blue
  "#ff8000", // Orange (L-piece) - Classic orange
  "#ffff00", // Yellow (O-piece) - Classic yellow
  "#00ff00", // Green (S-piece) - Classic green
  "#ff0000", // Red (Z-piece) - Classic red
  "#8000ff", // Purple (T-piece) - Classic purple
];

function createGrid(): Grid {
  return Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => 0)
  );
}

function rotateMatrix(matrix: number[][]): number[][] {
  const N = matrix.length;
  const res = Array.from({ length: N }, () =>
    Array.from({ length: N }, () => 0)
  );
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) res[c][N - 1 - r] = matrix[r][c];
  return res;
}

function randomBag(): string[] {
  const pieces = Object.keys(tetrominoes);
  for (let i = pieces.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
  }
  return pieces;
}

export default function Tetris() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const animRef = useRef<number | null>(null);
  const lastRef = useRef<number | null>(null);

  const muiTheme = useMuiTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down("sm"));
  const isLandscape = useMediaQuery("(orientation: landscape)");

  const [gameStarted, setGameStarted] = useState(false);
  const [running, setRunning] = useState(false);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [lines, setLines] = useState(0);
  const [difficulty, setDifficulty] = useState<"Easy" | "Normal" | "Hard">(
    "Normal"
  );

  const gridRef = useRef<Grid>(createGrid());
  const bagRef = useRef<string[]>(randomBag());
  const queueRef = useRef<string[]>([]);
  const holdRef = useRef<string | null>(null);
  const canHoldRef = useRef(true);

  const pieceRef = useRef<{
    shape: number[][];
    x: number;
    y: number;
    id: string;
  } | null>(null);

  const particlesRef = useRef<
    Array<{ x: number; y: number; life: number; vx: number; vy: number }>
  >([]);

  const navigate = useNavigate();

  function spawnPiece() {
    if (queueRef.current.length < 3) {
      while (bagRef.current.length === 0) bagRef.current = randomBag();
      queueRef.current.push(...bagRef.current.splice(0, 3));
    }
    const id = queueRef.current.shift()!;
    const variants = tetrominoes[id];
    const shape = variants[0].map((r) => r.slice());
    pieceRef.current = {
      shape,
      x: Math.floor((COLS - shape[0].length) / 2),
      y: -shape.length + 1,
      id,
    };
    canHoldRef.current = true;
  }

  function setupCanvas() {
    const canvas = canvasRef.current!;
    const container = wrapperRef.current ?? canvas.parentElement!;
    const rect = container.getBoundingClientRect();
    const dpr = Math.max(1, window.devicePixelRatio || 1);

    // Mobile responsive sizing
    let size;
    if (isMobile) {
      if (isLandscape) {
        // Landscape mobile - use height-based sizing
        size = Math.min(
          rect.width,
          rect.height * 0.8,
          window.innerHeight * 0.6
        );
      } else {
        // Portrait mobile - use width-based sizing with padding
        size = Math.min(
          rect.width * 0.9,
          rect.height * 0.7,
          window.innerWidth * 0.85
        );
      }
    } else {
      // Desktop - use available space
      size = Math.floor(Math.min(rect.width, rect.height));
    }

    canvas.style.width = `${size}px`;
    canvas.style.height = `${Math.floor(size * (ROWS / COLS))}px`;
    canvas.width = Math.max(1, Math.floor(size * dpr));
    canvas.height = Math.max(1, Math.floor(size * (ROWS / COLS) * dpr));
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  useEffect(() => {
    function onResize() {
      setupCanvas();
    }
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!running) {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      animRef.current = null;
      lastRef.current = null;
      return;
    }
    function loop(ts: number) {
      if (!lastRef.current) lastRef.current = ts;
      const dt = Math.min(0.05, (ts - lastRef.current) / 1000);
      lastRef.current = ts;
      tick(dt);
      draw();
      animRef.current = requestAnimationFrame(loop);
    }
    animRef.current = requestAnimationFrame(loop);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      animRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  // simple gravity / timer
  const gravityRef = useRef(0);
  function tick(dt: number) {
    gravityRef.current += dt;
    const fallRate = Math.max(
      0.06,
      0.5 - (level - 1) * 0.04 - (difficulty === "Hard" ? 0.12 : 0)
    );
    if (gravityRef.current > fallRate) {
      gravityRef.current = 0;
      stepDown();
    }
    // Update particles with optimized processing
    const p = particlesRef.current;
    for (let i = p.length - 1; i >= 0; i--) {
      const particle = p[i];
      particle.life -= dt * 2; // Faster decay for performance
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += 300 * dt; // Reduced gravity calculation

      if (particle.life <= 0) {
        p.splice(i, 1);
      }
    }

    // Limit total particles for performance
    if (p.length > 30) {
      p.splice(0, p.length - 30);
    }
  }

  function lockPiece() {
    const piece = pieceRef.current;
    if (!piece) return;
    const g = gridRef.current;
    for (let r = 0; r < piece.shape.length; r++) {
      for (let c = 0; c < piece.shape[r].length; c++) {
        if (piece.shape[r][c]) {
          const gx = piece.x + c;
          const gy = piece.y + r;
          if (gy >= 0 && gy < ROWS && gx >= 0 && gx < COLS)
            g[gy][gx] = piece.shape[r][c];
        }
      }
    }
    // clear lines
    let cleared = 0;
    for (let row = ROWS - 1; row >= 0; row--) {
      if (g[row].every((v) => v > 0)) {
        g.splice(row, 1);
        g.unshift(Array.from({ length: COLS }, () => 0));
        cleared++;
        row++; // re-check same index
      }
    }
    if (cleared > 0) {
      setScore((s) => s + cleared * cleared * 100);
      setLines((L) => L + cleared);

      // Optimized particle spawning
      const particleCount = Math.min(cleared * 6, 20); // Limit particles
      for (let i = 0; i < particleCount; i++) {
        particlesRef.current.push({
          x: Math.random() * COLS,
          y: (Math.random() * ROWS) / 3, // Concentrate near top
          life: 0.4 + Math.random() * 0.4, // Shorter life
          vx: (Math.random() - 0.5) * 60,
          vy: -60 + Math.random() * 30,
        });
      }

      if (lines + cleared >= level * 10) setLevel((lv) => lv + 1);
    }
    spawnPiece();
  }

  function stepDown() {
    const piece = pieceRef.current;
    if (!piece) {
      spawnPiece();
      return;
    }
    piece.y += 1;
    if (collides(piece)) {
      piece.y -= 1;
      lockPiece();
    }
  }

  function collides(piece: {
    shape: number[][];
    x: number;
    y: number;
    id: string;
  }) {
    const g = gridRef.current;
    for (let r = 0; r < piece.shape.length; r++) {
      for (let c = 0; c < piece.shape[r].length; c++) {
        if (!piece.shape[r][c]) continue;
        const gx = piece.x + c;
        const gy = piece.y + r;
        if (gx < 0 || gx >= COLS || gy >= ROWS) return true;
        if (gy >= 0 && g[gy][gx] > 0) return true;
      }
    }
    return false;
  }

  function move(dx: number) {
    const piece = pieceRef.current;
    if (!piece) return;
    piece.x += dx;
    if (collides(piece)) piece.x -= dx;
  }

  function rotate() {
    const piece = pieceRef.current;
    if (!piece) return;
    // rotate
    const next = rotateMatrix(piece.shape);
    const old = piece.shape;
    piece.shape = next;
    if (collides(piece)) piece.shape = old;
  }

  function hardDrop() {
    const piece = pieceRef.current;
    if (!piece) return;
    while (!collides(piece)) piece.y += 1;
    piece.y -= 1;
    lockPiece();
  }

  function hold() {
    if (!canHoldRef.current) return;
    const current = pieceRef.current;
    if (!current) return;
    const prev = holdRef.current;
    holdRef.current = current.id;
    if (prev) {
      // spawn prev
      pieceRef.current = {
        shape: tetrominoes[prev][0].map((r) => r.slice()),
        x: Math.floor((COLS - tetrominoes[prev][0][0].length) / 2),
        y: -tetrominoes[prev][0].length + 1,
        id: prev,
      };
    } else {
      spawnPiece();
    }
    canHoldRef.current = false;
  }

  function draw() {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const w = canvas.width / Math.max(1, window.devicePixelRatio || 1);
    const h = canvas.height / Math.max(1, window.devicePixelRatio || 1);

    // Classic black background
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, w, h);

    // Draw classic arcade border
    ctx.strokeStyle = "#00ff00";
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, w - 2, h - 2);

    // Compute cell size
    const cellW = (w - 4) / COLS; // Account for border
    const cellH = (h - 4) / ROWS;
    const offsetX = 2;
    const offsetY = 2;

    // Draw grid cells with classic Tetris colors and styling
    const g = gridRef.current;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const v = g[r][c];
        if (v) {
          const x = offsetX + c * cellW;
          const y = offsetY + r * cellH;

          // Classic solid block colors
          ctx.fillStyle = COLORS[v];
          ctx.fillRect(x + 1, y + 1, cellW - 2, cellH - 2);

          // Add classic 3D block effect
          ctx.fillStyle = "rgba(255,255,255,0.3)";
          ctx.fillRect(x + 1, y + 1, cellW - 2, 3); // Top highlight
          ctx.fillRect(x + 1, y + 1, 3, cellH - 2); // Left highlight

          ctx.fillStyle = "rgba(0,0,0,0.3)";
          ctx.fillRect(x + cellW - 4, y + 1, 3, cellH - 2); // Right shadow
          ctx.fillRect(x + 1, y + cellH - 4, cellW - 2, 3); // Bottom shadow
        }
      }
    }

    // Draw current piece with same classic styling
    const piece = pieceRef.current;
    if (piece) {
      for (let r = 0; r < piece.shape.length; r++) {
        for (let c = 0; c < piece.shape[r].length; c++) {
          if (piece.shape[r][c]) {
            const x = offsetX + (piece.x + c) * cellW;
            const y = offsetY + (piece.y + r) * cellH;
            const v = piece.shape[r][c];

            // Main block color
            ctx.fillStyle = COLORS[v];
            ctx.fillRect(x + 1, y + 1, cellW - 2, cellH - 2);

            // 3D effect for current piece
            ctx.fillStyle = "rgba(255,255,255,0.4)";
            ctx.fillRect(x + 1, y + 1, cellW - 2, 3);
            ctx.fillRect(x + 1, y + 1, 3, cellH - 2);

            ctx.fillStyle = "rgba(0,0,0,0.4)";
            ctx.fillRect(x + cellW - 4, y + 1, 3, cellH - 2);
            ctx.fillRect(x + 1, y + cellH - 4, cellW - 2, 3);
          }
        }
      }
    }

    // Draw classic arcade-style particles (simplified for performance)
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const p of particlesRef.current) {
      const cx = offsetX + p.x * cellW;
      const cy = offsetY + p.y * cellH;
      const alpha = Math.max(0, p.life);
      const size = 4 * alpha;

      ctx.fillStyle = `rgba(255,255,0,${alpha})`;
      ctx.fillRect(cx - size, cy - size, size * 2, size * 2);
    }
    ctx.restore();

    // Draw classic title and stats
    ctx.save();
    ctx.fillStyle = "#00ff00";
    ctx.font = "bold 16px 'Press Start 2P', monospace";
    ctx.textAlign = "center";
    ctx.shadowBlur = 6;
    ctx.shadowColor = "#00ff00";
    ctx.fillText("TETRIS", w / 2, 20);
    ctx.restore();

    drawPreview();
  }

  function drawPreview() {
    const pCan = previewRef.current;
    if (!pCan) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const cssSize = 96;
    pCan.style.width = `${cssSize}px`;
    pCan.style.height = `${cssSize}px`;
    pCan.width = cssSize * dpr;
    pCan.height = cssSize * dpr;
    const ctx = pCan.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Classic dark background
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, cssSize, cssSize);

    // Border
    ctx.strokeStyle = "#00ff00";
    ctx.lineWidth = 1;
    ctx.strokeRect(2, 2, cssSize - 4, cssSize - 4);

    // Determine next piece
    let nextId = queueRef.current[0];
    if (!nextId) {
      if (bagRef.current.length === 0) bagRef.current = randomBag();
      nextId = bagRef.current[0];
    }
    if (!nextId) return;

    const variants = tetrominoes[nextId];
    const shape = variants[0];
    const rows = shape.length;
    const cols = shape[0].length;
    const cell = Math.floor((cssSize - 8) / Math.max(cols, rows, 4));
    const offsetX = Math.floor((cssSize - cols * cell) / 2);
    const offsetY = Math.floor((cssSize - rows * cell) / 2);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const v = shape[r][c];
        if (!v) continue;
        const x = offsetX + c * cell;
        const y = offsetY + r * cell;

        // Classic solid block
        ctx.fillStyle = COLORS[v];
        ctx.fillRect(x, y, cell - 1, cell - 1);

        // Add mini 3D effect
        ctx.fillStyle = "rgba(255,255,255,0.3)";
        ctx.fillRect(x, y, cell - 1, 1); // Top
        ctx.fillRect(x, y, 1, cell - 1); // Left

        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.fillRect(x + cell - 2, y, 1, cell - 1); // Right
        ctx.fillRect(x, y + cell - 2, cell - 1, 1); // Bottom
      }
    }
  }

  function startGame() {
    setGameStarted(true);
    setRunning(true);
    spawnPiece();
  }

  function resetGame() {
    gridRef.current = createGrid();
    bagRef.current = randomBag();
    queueRef.current = [];
    holdRef.current = null;
    setScore(0);
    setLevel(1);
    setLines(0);
    setGameStarted(false);
    setRunning(false);
    particlesRef.current = [];
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!gameStarted) return;

      if (e.key === "ArrowLeft") move(-1);
      else if (e.key === "ArrowRight") move(1);
      else if (e.key === "ArrowUp") rotate();
      else if (e.key === " ") hardDrop();
      else if (e.key === "ArrowDown") stepDown();
      else if (e.key.toLowerCase() === "c") hold();
      else if (e.key === "p") setRunning((r) => !r);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <Box
      sx={{
        minHeight: "100vh",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <AppBar
        position="static"
        color="transparent"
        elevation={0}
        sx={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <Toolbar sx={{ minHeight: { xs: 48, sm: 64 } }}>
          <IconButton
            edge="start"
            color="inherit"
            onClick={() => navigate("/")}
          >
            <ArrowBack />
          </IconButton>
          <Typography
            variant="h6"
            sx={{ flex: 1, fontSize: { xs: 14, sm: 20 } }}
          >
            Tetris
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Select
              value={difficulty}
              size="small"
              onChange={(e: SelectChangeEvent<string>) =>
                setDifficulty(e.target.value as "Easy" | "Normal" | "Hard")
              }
              sx={{ minWidth: { xs: 80, sm: 120 } }}
            >
              <MenuItem value="Easy">Easy</MenuItem>
              <MenuItem value="Normal">Normal</MenuItem>
              <MenuItem value="Hard">Hard</MenuItem>
            </Select>
            {gameStarted && (
              <Button
                variant="outlined"
                size={isMobile ? "small" : "medium"}
                onClick={() => setRunning((r) => !r)}
              >
                {running ? "Pause" : "Play"}
              </Button>
            )}
            <Button
              variant="contained"
              size={isMobile ? "small" : "medium"}
              onClick={resetGame}
            >
              Restart
            </Button>
          </Stack>
        </Toolbar>
      </AppBar>

      <Container
        maxWidth="lg"
        sx={{
          py: { xs: 1, sm: 2 },
          px: { xs: 1, sm: 2 },
          flex: 1,
          display: "flex",
          alignItems: "stretch",
        }}
      >
        <Paper
          sx={{
            p: { xs: 1, sm: 2 },
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            boxSizing: "border-box",
            position: "relative",
          }}
        >
          {!gameStarted && (
            <Box
              onClick={startGame}
              sx={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(0, 0, 0, 0.9)",
                zIndex: 10,
                color: "#00ff00",
                textAlign: "center",
                cursor: "pointer",
              }}
            >
              <Typography
                variant="h4"
                sx={{
                  mb: 3,
                  fontSize: { xs: "1.5rem", sm: "2rem" },
                  fontFamily: "'Press Start 2P', monospace",
                  textShadow: "0 0 10px #00ff00",
                }}
              >
                TETRIS
              </Typography>
              <Typography
                variant="body1"
                sx={{
                  mb: 4,
                  fontSize: { xs: "0.6rem", sm: "0.8rem" },
                  fontFamily: "'Press Start 2P', monospace",
                  color: "#ffffff",
                  maxWidth: "80%",
                  lineHeight: 1.6,
                }}
              >
                Arrange falling blocks to clear lines!
                <br />
                Tap anywhere on the game area to start!
              </Typography>
              <Button
                variant="contained"
                size="large"
                startIcon={<PlayArrow />}
                onClick={startGame}
                sx={{
                  fontSize: { xs: "0.7rem", sm: "0.9rem" },
                  padding: { xs: "8px 16px", sm: "12px 24px" },
                  fontFamily: "'Press Start 2P', monospace",
                  background: "linear-gradient(45deg, #00ff00, #00aa00)",
                  boxShadow: "0 0 20px rgba(0, 255, 0, 0.5)",
                }}
              >
                START GAME
              </Button>
              <Typography
                variant="caption"
                sx={{
                  mt: 3,
                  fontSize: { xs: "0.4rem", sm: "0.5rem" },
                  color: "#888",
                  fontFamily: "'Press Start 2P', monospace",
                  textAlign: "center",
                }}
              >
                {isMobile
                  ? "Tap buttons below to control pieces"
                  : "Controls: ← → ↑ ↓ Arrow Keys | Space: Hard Drop | C: Hold | P: Pause"}
              </Typography>
            </Box>
          )}

          <Box
            ref={wrapperRef}
            sx={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            <canvas
              ref={canvasRef}
              onClick={() => !gameStarted && startGame()}
              style={{
                touchAction: "none",
                maxWidth: "100%",
                height: "100%",
                display: "block",
                cursor: !gameStarted ? "pointer" : "default",
              }}
            />
          </Box>

          {gameStarted && (
            <Box
              sx={{
                mt: { xs: 1, sm: 1 },
                display: "flex",
                flexDirection: { xs: "column", sm: "row" },
                gap: { xs: 1, sm: 1 },
                justifyContent: "space-between",
                alignItems: "center",
                height: { xs: "auto", sm: 110 },
                background: "rgba(0, 0, 0, 0.8)",
                p: { xs: 1, sm: 2 },
                borderRadius: 1,
                border: "1px solid #00ff00",
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  gap: { xs: 3, sm: 4 },
                  justifyContent: "space-around",
                  width: { xs: "100%", sm: "auto" },
                }}
              >
                <Box sx={{ textAlign: "center" }}>
                  <Typography
                    variant="subtitle2"
                    sx={{
                      fontSize: { xs: "0.6rem", sm: "0.875rem" },
                      color: "#00ff00",
                      fontFamily: "'Press Start 2P', monospace",
                    }}
                  >
                    Score
                  </Typography>
                  <Typography
                    variant="h6"
                    sx={{
                      fontSize: { xs: "0.7rem", sm: "1.25rem" },
                      color: "#ffffff",
                      fontFamily: "'Press Start 2P', monospace",
                    }}
                  >
                    {score}
                  </Typography>
                </Box>
                <Box sx={{ textAlign: "center" }}>
                  <Typography
                    variant="subtitle2"
                    sx={{
                      fontSize: { xs: "0.6rem", sm: "0.875rem" },
                      color: "#00ff00",
                      fontFamily: "'Press Start 2P', monospace",
                    }}
                  >
                    Level
                  </Typography>
                  <Typography
                    variant="h6"
                    sx={{
                      fontSize: { xs: "0.7rem", sm: "1.25rem" },
                      color: "#ffffff",
                      fontFamily: "'Press Start 2P', monospace",
                    }}
                  >
                    {level}
                  </Typography>
                </Box>
                <Box sx={{ textAlign: "center" }}>
                  <Typography
                    variant="subtitle2"
                    sx={{
                      fontSize: { xs: "0.6rem", sm: "0.875rem" },
                      color: "#00ff00",
                      fontFamily: "'Press Start 2P', monospace",
                    }}
                  >
                    Lines
                  </Typography>
                  <Typography
                    variant="h6"
                    sx={{
                      fontSize: { xs: "0.7rem", sm: "1.25rem" },
                      color: "#ffffff",
                      fontFamily: "'Press Start 2P', monospace",
                    }}
                  >
                    {lines}
                  </Typography>
                </Box>
              </Box>

              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: { xs: "center", sm: "flex-end" },
                  mt: { xs: 1, sm: 0 },
                }}
              >
                <Box
                  sx={{
                    mr: { xs: 0, sm: 1 },
                    width: { xs: 80, sm: 96 },
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    bgcolor: "rgba(255,255,255,0.02)",
                    borderRadius: 1,
                    p: 0.5,
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <Typography
                    variant="subtitle2"
                    sx={{
                      fontSize: { xs: 10, sm: 12 },
                      color: "#00ff00",
                      fontFamily: "'Press Start 2P', monospace",
                    }}
                  >
                    Next
                  </Typography>
                  <Box
                    sx={{
                      width: { xs: 80, sm: 96 },
                      height: { xs: 80, sm: 96 },
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <canvas
                      ref={previewRef}
                      style={{
                        width: "100%",
                        height: "100%",
                        display: "block",
                        borderRadius: 6,
                      }}
                    />
                  </Box>
                </Box>
              </Box>
            </Box>
          )}
        </Paper>
      </Container>
    </Box>
  );
}
