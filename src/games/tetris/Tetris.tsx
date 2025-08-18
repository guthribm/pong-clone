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
  "#000000",
  "#60a5fa",
  "#f472b6",
  "#a78bfa",
  "#fb923c",
  "#60a5fa",
  "#34d399",
  "#f87171",
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
    // size based on available width/height in the wrapper
    const size = Math.floor(Math.min(rect.width, rect.height));
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
    // update particles
    const p = particlesRef.current;
    for (let i = p.length - 1; i >= 0; i--) {
      p[i].life -= dt;
      p[i].x += p[i].vx * dt;
      p[i].y += p[i].vy * dt;
      p[i].vy += 420 * dt;
      if (p[i].life <= 0) p.splice(i, 1);
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
      for (let i = 0; i < cleared * 8; i++)
        particlesRef.current.push({
          x: Math.random() * COLS,
          y: (Math.random() * ROWS) / 2,
          life: 0.6 + Math.random() * 0.8,
          vx: (Math.random() - 0.5) * 80,
          vy: -100 + Math.random() * 40,
        });
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
    ctx.fillStyle = "#08121a";
    ctx.fillRect(0, 0, w, h);
    // compute cell size
    const cellW = w / COLS;
    const cellH = h / ROWS;

    // draw grid cells
    const g = gridRef.current;
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        const v = g[r][c];
        if (v) {
          const x = c * cellW;
          const y = r * cellH;
          const grad = ctx.createLinearGradient(x, y, x + cellW, y + cellH);
          grad.addColorStop(0, COLORS[v]);
          grad.addColorStop(1, "#00000000");
          ctx.fillStyle = grad;
          roundRect(ctx, x + 1, y + 1, cellW - 2, cellH - 2, 4);
          ctx.fill();
        }
      }

    // draw current piece
    const piece = pieceRef.current;
    if (piece) {
      for (let r = 0; r < piece.shape.length; r++)
        for (let c = 0; c < piece.shape[r].length; c++)
          if (piece.shape[r][c]) {
            const x = (piece.x + c) * cellW;
            const y = (piece.y + r) * cellH;
            const v = piece.shape[r][c];
            const ggrad = ctx.createRadialGradient(
              x + cellW / 2,
              y + cellH / 2,
              2,
              x + cellW / 2,
              y + cellH / 2,
              Math.max(cellW, cellH)
            );
            ggrad.addColorStop(0, COLORS[v]);
            ggrad.addColorStop(1, "rgba(0,0,0,0)");
            ctx.fillStyle = ggrad;
            roundRect(ctx, x + 1, y + 1, cellW - 2, cellH - 2, 3);
            ctx.fill();
          }
    }

    // draw particles
    for (const p of particlesRef.current) {
      const cx = p.x * cellW;
      const cy = p.y * cellH;
      const a = Math.max(0, p.life / 1);
      ctx.globalCompositeOperation = "lighter";
      const g2 = ctx.createRadialGradient(cx, cy, 0, cx, cy, 10);
      g2.addColorStop(0, `rgba(255,240,200,${a})`);
      g2.addColorStop(1, `rgba(255,140,60,0)`);
      ctx.fillStyle = g2;
      ctx.fillRect(cx - 12, cy - 12, 24, 24);
      ctx.globalCompositeOperation = "source-over";
    }

    // draw preview into the small preview canvas
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
    ctx.clearRect(0, 0, cssSize, cssSize);

    // determine next piece
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
    const cell = Math.floor(cssSize / Math.max(cols, rows));
    const offsetX = Math.floor((cssSize - cols * cell) / 2);
    const offsetY = Math.floor((cssSize - rows * cell) / 2);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const v = shape[r][c];
        if (!v) continue;
        const x = offsetX + c * cell;
        const y = offsetY + r * cell;
        const g = ctx.createLinearGradient(x, y, x + cell, y + cell);
        g.addColorStop(0, COLORS[v]);
        g.addColorStop(1, "#00000000");
        ctx.fillStyle = g;
        roundRect(ctx, x + 1, y + 1, cell - 2, cell - 2, 4);
        ctx.fill();
      }
    }
  }

  function roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            onClick={() => navigate("/")}
          >
            {" "}
            <ArrowBack />{" "}
          </IconButton>
          <Typography variant="h6" sx={{ flex: 1 }}>
            Tetris
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Select
              value={difficulty}
              size="small"
              onChange={(e: SelectChangeEvent<string>) =>
                setDifficulty(e.target.value as "Easy" | "Normal" | "Hard")
              }
            >
              <MenuItem value="Easy">Easy</MenuItem>
              <MenuItem value="Normal">Normal</MenuItem>
              <MenuItem value="Hard">Hard</MenuItem>
            </Select>
            <Button variant="outlined" onClick={() => setRunning((r) => !r)}>
              {running ? "Pause" : "Play"}
            </Button>
            <Button
              variant="contained"
              onClick={() => {
                gridRef.current = createGrid();
                bagRef.current = randomBag();
                queueRef.current = [];
                holdRef.current = null;
                setScore(0);
                setLevel(1);
                setLines(0);
                spawnPiece();
              }}
            >
              Restart
            </Button>
          </Stack>
        </Toolbar>
      </AppBar>

      <Container
        maxWidth="lg"
        sx={{ py: 2, flex: 1, display: "flex", alignItems: "stretch" }}
      >
        <Paper
          sx={{
            p: 2,
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            boxSizing: "border-box",
          }}
        >
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
              style={{ touchAction: "none", maxWidth: "100%", height: "100%" }}
            />
          </Box>
          <Box
            sx={{
              mt: 1,
              display: "flex",
              flexDirection: { xs: "column", sm: "row" },
              gap: 1,
              justifyContent: "space-between",
              alignItems: "center",
              height: { xs: "auto", sm: 110 },
            }}
          >
            <Box sx={{ textAlign: { xs: "center", sm: "left" } }}>
              <Typography variant="subtitle2">Score</Typography>
              <Typography variant="h6">{score}</Typography>
            </Box>
            <Box sx={{ textAlign: { xs: "center", sm: "left" } }}>
              <Typography variant="subtitle2">Level</Typography>
              <Typography variant="h6">{level}</Typography>
            </Box>
            <Box sx={{ textAlign: { xs: "center", sm: "left" } }}>
              <Typography variant="subtitle2">Lines</Typography>
              <Typography variant="h6">{lines}</Typography>
            </Box>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: { xs: "center", sm: "flex-end" },
              }}
            >
              <Box
                sx={{
                  mr: 1,
                  width: 96,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  bgcolor: "rgba(255,255,255,0.02)",
                  borderRadius: 1,
                  p: 0.5,
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <Typography variant="subtitle2" sx={{ fontSize: 12 }}>
                  Next
                </Typography>
                <Box
                  sx={{
                    width: 96,
                    height: 96,
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
        </Paper>
      </Container>
    </Box>
  );
}
