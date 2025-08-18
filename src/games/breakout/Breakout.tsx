import React, { useEffect, useRef, useState } from "react";
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
    const width = Math.floor(rect.width);
    const height = Math.floor(rect.width / CANVAS_ASPECT);
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
    const p = particlesRef.current;
    for (let i = 0; i < count; i++) {
      p.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 240,
        vy: (Math.random() - 0.5) * 240 - 60,
        life: 0.6 + Math.random() * 0.8,
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
    for (let i = p.length - 1; i >= 0; i--) {
      p[i].life -= dt;
      p[i].x += p[i].vx * dt;
      p[i].y += p[i].vy * dt;
      p[i].vy += 600 * dt;
      if (p[i].life <= 0) p.splice(i, 1);
    }
  }

  function updateTrail(dt: number) {
    const t = trailRef.current;
    // add a trace entry per ball (limit total length)
    for (const b of ballsRef.current) {
      t.unshift({ x: b.x, y: b.y, life: 0.45 });
    }
    for (let i = t.length - 1; i >= 0; i--) {
      t[i].life -= dt;
      if (t[i].life <= 0) t.splice(i, 1);
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

    // background
    ctx.fillStyle = "#08121a";
    ctx.fillRect(0, 0, w, h);

    // draw bricks
    for (const b of bricksRef.current) {
      if (!b.alive) continue;
      // color by type/hits
      if (b.type === "unbreakable") {
        ctx.fillStyle = "#6b7280";
      } else if (b.type === "strong") {
        ctx.fillStyle = b.hits === 2 ? "#f59e0b" : "#fb923c";
      } else {
        ctx.fillStyle = `hsl(${(b.x % 360) + (b.y % 60)},70%,60%)`;
      }
      roundRect(ctx, b.x, b.y, b.w, b.h, 4);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.18)";
      ctx.stroke();
    }

    // draw paddle
    const p = paddleRef.current;
    ctx.fillStyle = "#5eead4";
    roundRect(ctx, p.x, p.y, p.w, p.h, 6);
    ctx.fill();

    // draw balls
    for (const ball of ballsRef.current) {
      ctx.beginPath();
      ctx.fillStyle = "#60a5fa";
      ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // draw trail
    const trail = trailRef.current;
    for (let i = 0; i < trail.length; i++) {
      const t = trail[i];
      const a = Math.max(0, t.life / 0.45);
      const s = (1 - a) * ballRef.current.r * 1.6 + 1;
      ctx.beginPath();
      const g = ctx.createRadialGradient(t.x, t.y, 0, t.x, t.y, s * 2);
      g.addColorStop(0, `rgba(96,165,250,${0.5 * a})`);
      g.addColorStop(1, `rgba(96,165,250,0)`);
      ctx.fillStyle = g;
      ctx.fillRect(t.x - s, t.y - s, s * 2, s * 2);
    }

    // draw particles with radial gradient + blur
    for (const pp of particlesRef.current) {
      const a = Math.max(0, pp.life / 1.2);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const rad = Math.max(1, 6 * a);
      const g = ctx.createRadialGradient(pp.x, pp.y, 0, pp.x, pp.y, rad * 3);
      g.addColorStop(0, `rgba(255,220,120,${a})`);
      g.addColorStop(0.6, `rgba(255,120,60,${a * 0.6})`);
      g.addColorStop(1, `rgba(255,120,60,0)`);
      ctx.fillStyle = g;
      ctx.fillRect(pp.x - rad * 3, pp.y - rad * 3, rad * 6, rad * 6);
      ctx.restore();
    }

    // draw power-ups
    for (const pu of powerUpsRef.current) {
      if (!pu.alive) continue;
      ctx.save();
      ctx.fillStyle =
        pu.type === "expand"
          ? "#34d399"
          : pu.type === "life"
          ? "#60a5fa"
          : "#f472b6";
      roundRect(ctx, pu.x, pu.y, pu.w, pu.h, 4);
      ctx.fill();
      ctx.fillStyle = "#000000";
      ctx.font = "12px sans-serif";
      ctx.fillText(
        pu.type === "expand" ? "E" : pu.type === "life" ? "+1" : "S",
        pu.x + 6,
        pu.y + pu.h - 4
      );
      ctx.restore();
    }

    // UI overlay
    ctx.fillStyle = "#ffffff";
    ctx.font = "14px sans-serif";
    ctx.fillText(`Score: ${score}`, 12, h - 12);
    ctx.fillText(`Lives: ${lives}`, w - 84, h - 12);
    ctx.fillText(`Level: ${level}`, w / 2 - 24, h - 12);
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

  // input handling
  useEffect(() => {
    const canvas = canvasRef.current!;
    function onPointerMove(e: PointerEvent) {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      paddleRef.current.x = clamp(
        x - paddleRef.current.w / 2,
        0,
        rect.width - paddleRef.current.w
      );
    }
    function onPointerDown(e: PointerEvent) {
      onPointerMove(e);
      if (!running) setRunning(true);
    }
    function onPointerUp() {
      // no-op
    }
    function onKey(e: KeyboardEvent) {
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
  }, [running]);

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
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
            <ArrowBack />
          </IconButton>
          <Typography variant="h6" sx={{ flex: 1 }}>
            Breakout
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Select
              value={difficulty}
              size="small"
              onChange={(e: SelectChangeEvent<string>) =>
                setDifficulty(e.target.value as Diff)
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

      <Container maxWidth="lg" sx={{ py: 3, flex: 1 }}>
        <Paper sx={{ p: 2 }}>
          <Box
            sx={{ width: "100%", display: "flex", justifyContent: "center" }}
          >
            <canvas
              ref={canvasRef}
              style={{ touchAction: "none", maxWidth: "100%" }}
            />
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}
