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
import { resetBall, bumpSpeed, clamp } from "../../game";
import type { Ball } from "../../game";

type BrickType = "normal" | "strong" | "unbreakable";
type Brick = {
  x: number;
  y: number;
  w: number;
  h: number;
  hits: number; // -1 for unbreakable
  alive: boolean;
  type: BrickType;
};

const CANVAS_ASPECT = 16 / 9;

export default function Breakout() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const lastRef = useRef<number | null>(null);

  const muiTheme = useMuiTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down("sm"));
  const isLandscape = useMediaQuery("(orientation: landscape)");

  const [gameStarted, setGameStarted] = useState(false);
  const [running, setRunning] = useState(false);
  type Diff = "Easy" | "Normal" | "Hard";
  const [difficulty, setDifficulty] = useState<Diff>("Normal");
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);

  const bricksRef = useRef<Brick[]>([]);
  const ballRef = useRef({ x: 0, y: 0, vx: 0, vy: 0, r: 8 });
  const paddleRef = useRef({ x: 0, y: 0, w: 120, h: 16, speed: 800 });
  type Particle = {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
  };
  const particlesRef = useRef<Particle[]>([]);
  const trailRef = useRef<Array<{ x: number; y: number; life: number }>>([]);

  type PowerUpType = "expand" | "life" | "slow" | "multiball";
  type PowerUp = {
    x: number;
    y: number;
    w: number;
    h: number;
    vy: number;
    type: PowerUpType;
    alive: boolean;
  };
  const powerUpsRef = useRef<PowerUp[]>([]);
  const activeEffectsRef = useRef<{ [k in PowerUpType]?: number }>({});
  const [level, setLevel] = useState(1);
  const ballsRef = useRef<Ball[]>([]);

  const navigate = useNavigate();

  function setupCanvasSize() {
    const canvas = canvasRef.current!;
    const parent = canvas.parentElement!;
    const rect = parent.getBoundingClientRect();
    const dpr = Math.max(1, window.devicePixelRatio || 1);

    // Mobile responsive sizing
    let width, height;
    if (isMobile) {
      if (isLandscape) {
        // Landscape mobile - use most of screen height
        width = Math.min(
          rect.width - 20,
          window.innerHeight * 0.7 * CANVAS_ASPECT
        );
        height = Math.min(rect.height - 20, window.innerHeight * 0.7);
      } else {
        // Portrait mobile - use most of screen width
        width = Math.min(rect.width - 20, window.innerWidth * 0.95);
        height = Math.min(
          rect.height - 20,
          (window.innerWidth * 0.95) / CANVAS_ASPECT
        );
      }
    } else {
      // Desktop - maintain aspect ratio
      width = Math.floor(rect.width);
      height = Math.floor(rect.width / CANVAS_ASPECT);
    }

    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function buildLevel(canvasW: number, lvl = 1) {
    // scale rows/cols with level
    const baseCols = 10;
    const cols = baseCols;
    const rows = Math.min(8, 3 + lvl); // increase rows as level grows
    const padding = 8;
    const brickW = (canvasW - padding * (cols + 1)) / cols;
    const brickH = Math.max(18, 22 - Math.floor(lvl / 2));
    const bricks: Brick[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        // decide brick type by probability
        const roll = Math.random();
        let type: BrickType = "normal";
        let hits = 1;
        if (roll < 0.08 + lvl * 0.01) {
          type = "unbreakable";
          hits = -1;
        } else if (roll < 0.2 + lvl * 0.02) {
          type = "strong";
          hits = 2;
        }
        bricks.push({
          x: padding + c * (brickW + padding),
          y: padding + r * (brickH + padding) + 20,
          w: brickW,
          h: brickH,
          hits,
          alive: true,
          type,
        });
      }
    }
    bricksRef.current = bricks;
  }

  function resetGame(canvasW: number, canvasH: number) {
    paddleRef.current.w = Math.max(72, Math.min(220, canvasW * 0.14));
    paddleRef.current.h = Math.max(12, canvasH * 0.03);
    paddleRef.current.x = (canvasW - paddleRef.current.w) / 2;
    paddleRef.current.y = canvasH - paddleRef.current.h - 12;
    ballRef.current.r = Math.max(6, Math.min(14, canvasW * 0.008));
    resetBall(ballRef.current as Ball, canvasW, canvasH, null);
    setScore(0);
    setLives(3);
    setGameStarted(false);
    setRunning(false);
    trailRef.current = [];
    particlesRef.current = [];
    powerUpsRef.current = [];
    activeEffectsRef.current = {};
    setLevel(1);
    // primary ball
    const primary: Ball = {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      r: Math.max(6, Math.min(14, canvasW * 0.008)),
    };
    resetBall(primary, canvasW, canvasH, null);
    ballsRef.current = [primary];
    // easy difficulty starts with multiball active
    if (difficulty === "Easy") {
      // spawn two extra balls
      spawnMultiBalls(primary, 2);
    }
    buildLevel(canvasW, 1);
  }

  useEffect(() => {
    const canvas = canvasRef.current!;
    function handleResize() {
      setupCanvasSize();
      const w = canvas.width / Math.max(1, window.devicePixelRatio || 1);
      const h = canvas.height / Math.max(1, window.devicePixelRatio || 1);
      resetGame(w, h);
      draw();
    }
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!running) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
        lastRef.current = null;
      }
      return;
    }

    function loop(ts: number) {
      if (!lastRef.current) lastRef.current = ts;
      const dt = Math.min(0.05, (ts - lastRef.current) / 1000);
      lastRef.current = ts;
      update(dt);
      draw();
      animationRef.current = requestAnimationFrame(loop);
    }

    animationRef.current = requestAnimationFrame(loop);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
      lastRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, difficulty]);

  function spawnParticles(x: number, y: number, count = 12) {
    // Reduce particle count for performance
    const actualCount = Math.min(count, 8);
    const p = particlesRef.current;

    // Limit total particles
    if (p.length > 80) return;

    for (let i = 0; i < actualCount; i++) {
      p.push({
        x: x + (Math.random() - 0.5) * 8,
        y: y + (Math.random() - 0.5) * 8,
        vx: (Math.random() - 0.5) * 180,
        vy: (Math.random() - 0.5) * 180 - 40,
        life: 0.4 + Math.random() * 0.4,
      });
    }
  }

  function spawnMultiBalls(source: Ball, count = 2) {
    const balls = ballsRef.current;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI - Math.PI / 2; // up-ish
      const speed =
        Math.sqrt(source.vx * source.vx + source.vy * source.vy) || 320;
      const b: Ball = {
        x: source.x + (Math.random() - 0.5) * 12,
        y: source.y + (Math.random() - 0.5) * 12,
        vx: Math.cos(angle) * speed * (0.8 + Math.random() * 0.6),
        vy: Math.sin(angle) * speed * (0.8 + Math.random() * 0.6),
        r: source.r,
      };
      balls.push(b);
    }
  }

  function updateParticles(dt: number) {
    const p = particlesRef.current;
    // Process particles in reverse to safely remove
    for (let i = p.length - 1; i >= 0; i--) {
      const particle = p[i];
      particle.life -= dt * 1.5; // Faster decay for performance
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += 400 * dt; // Gravity

      if (particle.life <= 0) {
        p.splice(i, 1);
      }
    }
    // Limit total particles for performance
    if (p.length > 100) {
      p.splice(0, p.length - 100);
    }
  }

  function updateTrail(dt: number) {
    const t = trailRef.current;

    // Add trail points more selectively for performance
    if (ballsRef.current.length > 0 && t.length < 20) {
      for (const b of ballsRef.current) {
        t.unshift({ x: b.x, y: b.y, life: 0.3 });
      }
    }

    // Update trail life and remove old points
    for (let i = t.length - 1; i >= 0; i--) {
      t[i].life -= dt * 2; // Faster trail decay
      if (t[i].life <= 0) {
        t.splice(i, 1);
      }
    }
  }

  function update(dt: number) {
    const canvas = canvasRef.current!;
    const w = canvas.width / Math.max(1, window.devicePixelRatio || 1);
    const h = canvas.height / Math.max(1, window.devicePixelRatio || 1);
    // process balls array
    const balls = ballsRef.current;
    for (let bi = balls.length - 1; bi >= 0; bi--) {
      const ball = balls[bi];
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;
      // wall collisions
      if (ball.x - ball.r < 0) {
        ball.x = ball.r;
        ball.vx *= -1;
      }
      if (ball.x + ball.r > w) {
        ball.x = w - ball.r;
        ball.vx *= -1;
      }
      if (ball.y - ball.r < 0) {
        ball.y = ball.r;
        ball.vy *= -1;
      }
      // paddle collision
      const p = paddleRef.current;
      if (
        ball.y + ball.r >= p.y &&
        ball.y - ball.r <= p.y + p.h &&
        ball.x + ball.r >= p.x &&
        ball.x - ball.r <= p.x + p.w
      ) {
        ball.y = p.y - ball.r;
        ball.vy *= -1;
        const rel = (ball.x - (p.x + p.w / 2)) / (p.w / 2);
        ball.vx += rel * 240;
        bumpSpeed(ball as Ball);
        spawnParticles(ball.x, ball.y, 8);
      }
      // bricks collision
      const bricks = bricksRef.current;
      for (let i = 0; i < bricks.length; i++) {
        const b = bricks[i];
        if (!b.alive) continue;
        if (
          ball.x + ball.r >= b.x &&
          ball.x - ball.r <= b.x + b.w &&
          ball.y + ball.r >= b.y &&
          ball.y - ball.r <= b.y + b.h
        ) {
          const overlapLeft = ball.x + ball.r - b.x;
          const overlapRight = b.x + b.w - (ball.x - ball.r);
          const overlapTop = ball.y + ball.r - b.y;
          const overlapBottom = b.y + b.h - (ball.y - ball.r);
          const minOverlap = Math.min(
            overlapLeft,
            overlapRight,
            overlapTop,
            overlapBottom
          );
          if (minOverlap === overlapLeft || minOverlap === overlapRight) {
            ball.vx *= -1;
          } else {
            ball.vy *= -1;
          }
          // apply damage
          if (b.type === "unbreakable") {
            // only bounce
          } else if (b.type === "strong") {
            b.hits -= 1;
            if (b.hits <= 0) b.alive = false;
          } else {
            b.alive = false;
          }
          if (!b.alive) {
            setScore((s) => s + 100);
            spawnParticles(ball.x, ball.y, 18);
            if (Math.random() < 0.14) {
              const types: PowerUpType[] = [
                "expand",
                "life",
                "slow",
                "multiball",
              ];
              const pu: PowerUp = {
                x: b.x + b.w / 2 - 12,
                y: b.y + b.h / 2,
                w: 24,
                h: 14,
                vy: 80 + Math.random() * 60,
                type: types[Math.floor(Math.random() * types.length)],
                alive: true,
              };
              powerUpsRef.current.push(pu);
            }
          } else {
            setScore((s) => s + 40);
            spawnParticles(ball.x, ball.y, 8);
          }
          break;
        }
      }
      // ball fell below
      if (ball.y - ball.r > h) {
        balls.splice(bi, 1);
      }
    }
    // if all balls lost, lose a life and respawn
    if (ballsRef.current.length === 0) {
      setLives((l) => l - 1);
      if (lives - 1 <= 0) {
        setRunning(false);
        resetGame(w, h);
      } else {
        const nb: Ball = {
          x: 0,
          y: 0,
          vx: 0,
          vy: 0,
          r: Math.max(6, Math.min(14, w * 0.008)),
        };
        resetBall(nb, w, h, null);
        ballsRef.current = [nb];
      }
    }

    // lost life
    if (ballRef.current.y - ballRef.current.r > h) {
      setLives((l) => l - 1);
      if (lives - 1 <= 0) {
        setRunning(false);
        // reset game after loss
        resetGame(w, h);
      } else {
        resetBall(ballRef.current as Ball, w, h, null);
      }
    }

    // update power-ups
    const pus = powerUpsRef.current;
    for (let i = pus.length - 1; i >= 0; i--) {
      const pu = pus[i];
      if (!pu.alive) {
        pus.splice(i, 1);
        continue;
      }
      pu.y += pu.vy * dt;
      // catch by paddle
      if (
        pu.y + pu.h >= paddleRef.current.y &&
        pu.x + pu.w >= paddleRef.current.x &&
        pu.x <= paddleRef.current.x + paddleRef.current.w
      ) {
        // activate
        if (pu.type === "expand") {
          paddleRef.current.w = Math.min(paddleRef.current.w * 1.5, 500);
          activeEffectsRef.current.expand = performance.now() + 8000; // 8s
        } else if (pu.type === "life") {
          setLives((l) => l + 1);
        } else if (pu.type === "slow") {
          // slow ball temporarily
          ballRef.current.vx *= 0.7;
          ballRef.current.vy *= 0.7;
          activeEffectsRef.current.slow = performance.now() + 7000;
        } else if (pu.type === "multiball") {
          // spawn two extra balls from current balls
          const base = ballsRef.current[0] || {
            x: paddleRef.current.x + paddleRef.current.w / 2,
            y: paddleRef.current.y - 10,
            vx: -200,
            vy: -320,
            r: ballRef.current.r,
          };
          spawnMultiBalls(base, 2);
          activeEffectsRef.current.multiball = performance.now() + 12000; // duration marker (not used yet)
        }
        pu.alive = false;
        spawnParticles(pu.x + pu.w / 2, pu.y + pu.h / 2, 20);
      } else if (pu.y > h + 40) {
        pus.splice(i, 1);
      }
    }

    // effects expiration
    const now = performance.now();
    if (
      activeEffectsRef.current.expand &&
      activeEffectsRef.current.expand < now
    ) {
      // shrink back
      activeEffectsRef.current.expand = undefined;
      const canvasW = canvas.width / Math.max(1, window.devicePixelRatio || 1);
      paddleRef.current.w = Math.max(72, Math.min(220, canvasW * 0.14));
    }
    if (activeEffectsRef.current.slow && activeEffectsRef.current.slow < now) {
      activeEffectsRef.current.slow = undefined;
      // restore speed slightly
      bumpSpeed(ballRef.current as Ball);
    }

    updateParticles(dt);
    updateTrail(dt);
    // check level clear
    if (bricksRef.current.every((b) => !b.alive || b.type === "unbreakable")) {
      // next level
      const next = level + 1;
      setLevel(next);
      buildLevel(w, next);
      // reset ball to center
      resetBall(ballRef.current as Ball, w, h, null);
      spawnParticles(w / 2, h / 2, 36);
    }
  }

  function draw() {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const w = canvas.width / Math.max(1, window.devicePixelRatio || 1);
    const h = canvas.height / Math.max(1, window.devicePixelRatio || 1);

    // Pure black background like original
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, w, h);

    // Draw classic arcade border
    ctx.strokeStyle = "#00ffff";
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, w - 4, h - 4);

    // Draw bricks with classic colors matching original Breakout
    const brickColors = [
      "#ff0000", // Red (top rows)
      "#ff8000", // Orange
      "#ffff00", // Yellow
      "#00ff00", // Green
      "#0080ff", // Blue
      "#8000ff", // Purple (bottom rows)
    ];

    for (const b of bricksRef.current) {
      if (!b.alive) continue;

      // Classic Breakout color scheme based on row
      const row = Math.floor(b.y / 25);
      let color = brickColors[Math.min(row, brickColors.length - 1)];

      if (b.type === "unbreakable") {
        color = "#888888"; // Gray for unbreakable
      } else if (b.type === "strong" && b.hits === 1) {
        color = "#ffffff"; // White when damaged
      }

      ctx.save();
      ctx.fillStyle = color;
      ctx.shadowBlur = 8;
      ctx.shadowColor = color;
      ctx.fillRect(b.x, b.y, b.w, b.h);

      // Add classic brick outline
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      ctx.restore();
    }

    // Draw paddle - classic white rectangle
    const p = paddleRef.current;
    ctx.save();
    ctx.fillStyle = "#ffffff";
    ctx.shadowBlur = 10;
    ctx.shadowColor = "#00ffff";
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.restore();

    // Draw trail with classic arcade glow
    const trail = trailRef.current;
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (let i = 0; i < trail.length; i++) {
      const t = trail[i];
      const alpha = Math.max(0, t.life / 0.45);
      const size = (1 - alpha) * ballRef.current.r * 0.8;
      ctx.beginPath();
      ctx.fillStyle = `rgba(255,255,255,${alpha * 0.4})`;
      ctx.arc(t.x, t.y, size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Draw balls - classic white squares like original
    ctx.save();
    ctx.fillStyle = "#ffffff";
    ctx.shadowBlur = 12;
    ctx.shadowColor = "#ffffff";
    for (const ball of ballsRef.current) {
      ctx.fillRect(ball.x - ball.r, ball.y - ball.r, ball.r * 2, ball.r * 2);
    }
    ctx.restore();

    // Draw particles with classic explosion effect
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const pp of particlesRef.current) {
      const alpha = Math.max(0, pp.life / 1.2);
      const size = Math.max(1, 4 * alpha);
      ctx.beginPath();
      ctx.fillStyle = `rgba(255,255,0,${alpha})`;
      ctx.arc(pp.x, pp.y, size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Draw power-ups with classic styling
    for (const pu of powerUpsRef.current) {
      if (!pu.alive) continue;
      ctx.save();

      const colors = {
        expand: "#00ff00",
        life: "#ff0080",
        slow: "#00ffff",
        multiball: "#ffff00",
      };

      ctx.fillStyle = colors[pu.type];
      ctx.shadowBlur = 8;
      ctx.shadowColor = colors[pu.type];
      ctx.fillRect(pu.x, pu.y, pu.w, pu.h);

      // Add power-up symbol
      ctx.fillStyle = "#000000";
      ctx.font = "bold 12px 'Press Start 2P', monospace";
      ctx.textAlign = "center";
      const symbols = { expand: "W", life: "+", slow: "S", multiball: "M" };
      ctx.fillText(symbols[pu.type], pu.x + pu.w / 2, pu.y + pu.h / 2 + 4);
      ctx.restore();
    }

    // Draw classic arcade-style score and info
    ctx.save();
    ctx.fillStyle = "#00ff00";
    ctx.font = "bold 16px 'Press Start 2P', monospace";
    ctx.textAlign = "left";
    ctx.shadowBlur = 6;
    ctx.shadowColor = "#00ff00";

    // Score and level display
    ctx.fillText(`SCORE: ${score.toString().padStart(6, "0")}`, 10, 25);
    ctx.fillText(`LEVEL: ${level}`, 10, 45);
    ctx.fillText(`LIVES: ${lives}`, 10, 65);

    // Title at top center
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 20px 'Press Start 2P', monospace";
    ctx.fillText("BREAKOUT", w / 2, 25);
    ctx.restore();
  }

  function startGame() {
    setGameStarted(true);
    setRunning(true);
  }

  // input handling
  useEffect(() => {
    const canvas = canvasRef.current!;
    function onPointerMove(e: PointerEvent) {
      if (!gameStarted) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      paddleRef.current.x = clamp(
        x - paddleRef.current.w / 2,
        0,
        rect.width - paddleRef.current.w
      );
    }
    function onPointerDown(e: PointerEvent) {
      if (!gameStarted) {
        startGame();
        return;
      }
      onPointerMove(e);
      if (!running) setRunning(true);
    }
    function onPointerUp() {
      // no-op
    }
    function onKey(e: KeyboardEvent) {
      if (!gameStarted) {
        if (e.key === " " || e.key === "Enter") {
          startGame();
        }
        return;
      }

      const rect = canvas.getBoundingClientRect();
      if (e.key === "ArrowLeft") {
        paddleRef.current.x = clamp(
          paddleRef.current.x - paddleRef.current.speed * 0.03,
          0,
          rect.width - paddleRef.current.w
        );
      } else if (e.key === "ArrowRight") {
        paddleRef.current.x = clamp(
          paddleRef.current.x + paddleRef.current.speed * 0.03,
          0,
          rect.width - paddleRef.current.w
        );
      } else if (e.key === " ") {
        setRunning((r) => !r);
      }
    }
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("keydown", onKey);
    return () => {
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("keydown", onKey);
    };
  }, [running, gameStarted]);

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
            Breakout
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Select
              value={difficulty}
              size="small"
              onChange={(e: SelectChangeEvent<string>) =>
                setDifficulty(e.target.value as Diff)
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
              onClick={() => {
                const canvas = canvasRef.current!;
                const w =
                  canvas.width / Math.max(1, window.devicePixelRatio || 1);
                const h =
                  canvas.height / Math.max(1, window.devicePixelRatio || 1);
                resetGame(w, h);
              }}
            >
              Restart
            </Button>
          </Stack>
        </Toolbar>
      </AppBar>

      <Container
        maxWidth="lg"
        sx={{
          py: { xs: 1, sm: 3 },
          px: { xs: 1, sm: 3 },
          flex: 1,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Paper
          sx={{
            p: { xs: 1, sm: 2 },
            flex: 1,
            display: "flex",
            flexDirection: "column",
            position: "relative",
          }}
        >
          {!gameStarted && (
            <Box
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
                background: "rgba(0, 0, 0, 0.8)",
                zIndex: 10,
                color: "#00ffff",
                textAlign: "center",
              }}
            >
              <Typography
                variant="h4"
                sx={{
                  mb: 3,
                  fontSize: { xs: "1.5rem", sm: "2rem" },
                  fontFamily: "'Press Start 2P', monospace",
                  textShadow: "0 0 10px #00ffff",
                }}
              >
                BREAKOUT
              </Typography>
              <Typography
                variant="body1"
                sx={{
                  mb: 4,
                  fontSize: { xs: "0.7rem", sm: "1rem" },
                  fontFamily: "'Press Start 2P', monospace",
                  color: "#ffffff",
                  maxWidth: "80%",
                }}
              >
                Break all the bricks to advance to the next level!
                {isMobile
                  ? " Tap to move paddle and start!"
                  : " Use mouse or arrow keys to move paddle."}
              </Typography>
              <Button
                variant="contained"
                size="large"
                startIcon={<PlayArrow />}
                onClick={startGame}
                sx={{
                  fontSize: { xs: "0.8rem", sm: "1rem" },
                  padding: { xs: "8px 16px", sm: "12px 24px" },
                  fontFamily: "'Press Start 2P', monospace",
                  background: "linear-gradient(45deg, #ff8000, #ffaa00)",
                  boxShadow: "0 0 20px rgba(255, 128, 0, 0.5)",
                }}
              >
                START GAME
              </Button>
              {!isMobile && (
                <Typography
                  variant="caption"
                  sx={{
                    mt: 3,
                    fontSize: "0.6rem",
                    color: "#888",
                    fontFamily: "'Press Start 2P', monospace",
                  }}
                >
                  Press SPACE or ENTER to start
                </Typography>
              )}
            </Box>
          )}

          <Box
            sx={{
              flex: 1,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              overflow: "hidden",
            }}
          >
            <canvas
              ref={canvasRef}
              style={{
                touchAction: "none",
                maxWidth: "100%",
                maxHeight: "100%",
                display: "block",
              }}
            />
          </Box>

          {gameStarted && (
            <Box
              sx={{
                mt: { xs: 1, sm: 2 },
                display: "flex",
                flexDirection: { xs: "row", sm: "row" },
                flexWrap: "wrap",
                gap: { xs: 2, sm: 3 },
                justifyContent: "space-around",
                alignItems: "center",
                background: "rgba(0, 0, 0, 0.8)",
                p: { xs: 1, sm: 2 },
                borderRadius: 1,
                border: "1px solid #00ffff",
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
                    fontSize: { xs: "0.8rem", sm: "1.25rem" },
                    color: "#ffffff",
                    fontFamily: "'Press Start 2P', monospace",
                  }}
                >
                  {score.toString().padStart(6, "0")}
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
                    fontSize: { xs: "0.8rem", sm: "1.25rem" },
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
                  Lives
                </Typography>
                <Typography
                  variant="h6"
                  sx={{
                    fontSize: { xs: "0.8rem", sm: "1.25rem" },
                    color: "#ff0000",
                    fontFamily: "'Press Start 2P', monospace",
                  }}
                >
                  {lives}
                </Typography>
              </Box>
              {!isMobile && (
                <Box
                  sx={{
                    textAlign: "center",
                    fontSize: "0.6rem",
                    color: "#888",
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      fontFamily: "'Press Start 2P', monospace",
                      fontSize: "0.5rem",
                    }}
                  >
                    ← → Arrow Keys | Space: Pause
                  </Typography>
                </Box>
              )}
            </Box>
          )}
        </Paper>
      </Container>
    </Box>
  );
}
