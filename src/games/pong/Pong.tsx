import { useEffect, useRef, useState } from "react";
import "../../App.css";
import type { Ball, Paddle, Difficulty } from "../../game";
import { clamp, resetBall, bumpSpeed, updateAI } from "../../game";
import Box from "@mui/material/Box";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import { useNavigate } from "react-router-dom";
import ArrowBack from "@mui/icons-material/ArrowBack";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import MenuIcon from "@mui/icons-material/Menu";
import PlayArrow from "@mui/icons-material/PlayArrow";
import Pause from "@mui/icons-material/Pause";
import RestartAlt from "@mui/icons-material/RestartAlt";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Button from "@mui/material/Button";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme as useMuiTheme } from "@mui/material/styles";

const CANVAS_WIDTH = 900;
const CANVAS_HEIGHT = 500;

// Mobile responsive canvas sizing
function getCanvasSize(isMobile: boolean, isSmallLandscape: boolean) {
  if (isMobile) {
    if (isSmallLandscape) {
      return {
        width: Math.min(CANVAS_WIDTH, window.innerWidth * 0.85),
        height: Math.min(CANVAS_HEIGHT, window.innerHeight * 0.6),
      };
    } else {
      // Portrait mobile
      return {
        width: Math.min(CANVAS_WIDTH, window.innerWidth * 0.95),
        height: Math.min(
          CANVAS_HEIGHT,
          window.innerWidth * 0.95 * (CANVAS_HEIGHT / CANVAS_WIDTH)
        ),
      };
    }
  }
  return { width: CANVAS_WIDTH, height: CANVAS_HEIGHT };
}

export default function Pong() {
  const navigate = useNavigate();
  const muiTheme = useMuiTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down("sm"));
  const isSmallLandscape = useMediaQuery(
    "(max-width:720px) and (orientation: landscape)"
  );

  // Canvas refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  // Play state
  const [running, setRunning] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>("Normal");
  const scoreLeftRef = useRef(0);
  const scoreRightRef = useRef(0);
  const scoreAnimLeftRef = useRef(0);
  const scoreAnimRightRef = useRef(0);
  const scoreAnimLoopRef = useRef<number | null>(null);
  const scoreAnimRunningRef = useRef(false);
  const SCORE_ANIM_DURATION = 1.0; // seconds

  function startScoreAnimLoop() {
    if (scoreAnimRunningRef.current) return;
    scoreAnimRunningRef.current = true;
    function loop() {
      draw();
      const now = performance.now() / 1000;
      const la = scoreAnimLeftRef.current
        ? now - scoreAnimLeftRef.current
        : 999;
      const ra = scoreAnimRightRef.current
        ? now - scoreAnimRightRef.current
        : 999;
      if (la < SCORE_ANIM_DURATION || ra < SCORE_ANIM_DURATION) {
        scoreAnimLoopRef.current = requestAnimationFrame(loop);
      } else {
        scoreAnimRunningRef.current = false;
        if (scoreAnimLoopRef.current)
          cancelAnimationFrame(scoreAnimLoopRef.current);
        scoreAnimLoopRef.current = null;
      }
    }
    scoreAnimLoopRef.current = requestAnimationFrame(loop);
  }

  type Particle = {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    size: number;
    color: string;
  };
  const particlesRef = useRef<Particle[]>([]);
  const trailRef = useRef<
    Array<{ x: number; y: number; t: number; speed: number }>
  >([]);

  const [theme, setTheme] = useState<"neon" | "amber" | "green">("neon");

  const ballRef = useRef<Ball>({
    x: CANVAS_WIDTH / 2,
    y: CANVAS_HEIGHT / 2,
    vx: 300,
    vy: 120,
    r: 8,
  });
  const paddleLeftRef = useRef<Paddle>({
    x: 20,
    y: CANVAS_HEIGHT / 2 - 50,
    w: 12,
    h: 100,
    speed: 420,
  });
  const paddleRightRef = useRef<Paddle>({
    x: CANVAS_WIDTH - 20 - 12,
    y: CANVAS_HEIGHT / 2 - 50,
    w: 12,
    h: 100,
    speed: 420,
  });

  // Initialize positions based on current canvas size
  useEffect(() => {
    const canvasSize = getCanvasSize(isMobile, isSmallLandscape);
    const canvasW = canvasSize.width;
    const canvasH = canvasSize.height;

    ballRef.current.x = canvasW / 2;
    ballRef.current.y = canvasH / 2;
    paddleLeftRef.current.y = canvasH / 2 - 50;
    paddleRightRef.current.y = canvasH / 2 - 50;
    paddleRightRef.current.x = canvasW - 20 - 12;
  }, [isMobile, isSmallLandscape]);

  const keysRef = useRef<Record<string, boolean>>({});
  const pointerDownRef = useRef(false);
  const runningRef = useRef(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => (keysRef.current[e.key] = true);
    const onKeyUp = (e: KeyboardEvent) => (keysRef.current[e.key] = false);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const getY = (clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      return (clientY - rect.top) * (canvas.height / (rect.height * dpr));
    };
    const onPointerDown = (e: PointerEvent) => {
      pointerDownRef.current = true;
      const y = getY(e.clientY);
      paddleLeftRef.current.y = clamp(
        y - paddleLeftRef.current.h / 2,
        0,
        CANVAS_HEIGHT - paddleLeftRef.current.h
      );
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!pointerDownRef.current) return;
      const y = getY(e.clientY);
      paddleLeftRef.current.y = clamp(
        y - paddleLeftRef.current.h / 2,
        0,
        CANVAS_HEIGHT - paddleLeftRef.current.h
      );
    };
    const onPointerUp = () => (pointerDownRef.current = false);
    canvas.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    canvas.style.touchAction = "none";
    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      canvas.style.touchAction = "";
    };
  }, []);

  useEffect(() => {
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function start() {
    if (running) return;
    setRunning(true);
    runningRef.current = true;
    lastTimeRef.current = null;
    function frame(ts: number) {
      if (!lastTimeRef.current) lastTimeRef.current = ts;
      const dt = Math.min(0.03, (ts - lastTimeRef.current) / 1000);
      lastTimeRef.current = ts;
      update(dt);
      draw();
      if (runningRef.current)
        animationRef.current = requestAnimationFrame(frame);
    }
    animationRef.current = requestAnimationFrame(frame);
  }

  function stop() {
    setRunning(false);
    runningRef.current = false;
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    animationRef.current = null;
    lastTimeRef.current = null;
  }

  function restart() {
    const canvasSize = getCanvasSize(isMobile, isSmallLandscape);
    const canvasW = canvasSize.width;
    const canvasH = canvasSize.height;

    scoreLeftRef.current = 0;
    scoreRightRef.current = 0;
    paddleLeftRef.current.y = canvasH / 2 - paddleLeftRef.current.h / 2;
    paddleRightRef.current.y = canvasH / 2 - paddleRightRef.current.h / 2;
    resetBall(ballRef.current, canvasW, canvasH, null);
    draw();
  }

  function update(dt: number) {
    const canvasSize = getCanvasSize(isMobile, isSmallLandscape);
    const canvasW = canvasSize.width;
    const canvasH = canvasSize.height;

    const b = ballRef.current;
    const pl = paddleLeftRef.current;
    const pr = paddleRightRef.current;

    let playerDir = 0;
    if (
      keysRef.current["w"] ||
      keysRef.current["W"] ||
      keysRef.current["ArrowUp"]
    )
      playerDir = -1;
    if (
      keysRef.current["s"] ||
      keysRef.current["S"] ||
      keysRef.current["ArrowDown"]
    )
      playerDir = 1;
    pl.y += playerDir * pl.speed * dt;
    pl.y = clamp(pl.y, 0, canvasH - pl.h);

    updateAI(pr, b, difficulty, dt, canvasH);

    b.x += b.vx * dt;
    b.y += b.vy * dt;

    if (b.y - b.r <= 0) {
      b.y = b.r;
      b.vy = -b.vy;
    } else if (b.y + b.r >= canvasH) {
      b.y = canvasH - b.r;
      b.vy = -b.vy;
    }

    if (b.x - b.r <= pl.x + pl.w && b.x - b.r >= pl.x) {
      if (b.y >= pl.y && b.y <= pl.y + pl.h && b.vx < 0) {
        b.x = pl.x + pl.w + b.r;
        b.vx = -b.vx;
        const rel = (b.y - (pl.y + pl.h / 2)) / (pl.h / 2);
        b.vy += rel * 200;
        bumpSpeed(b);
      }
    }

    if (b.x + b.r >= pr.x && b.x + b.r <= pr.x + pr.w) {
      if (b.y >= pr.y && b.y <= pr.y + pr.h && b.vx > 0) {
        b.x = pr.x - b.r - 1;
        b.vx = -b.vx;
        const rel = (b.y - (pr.y + pr.h / 2)) / (pr.h / 2);
        b.vy += rel * 200;
        bumpSpeed(b);
      }
    }

    if (b.x < 0) {
      scoreRightRef.current += 1;
      scoreAnimRightRef.current = performance.now() / 1000;
      startScoreAnimLoop();
      spawnScoreParticles(b.x, b.y);
      resetBall(b, canvasW, canvasH, false);
      draw();
      requestAnimationFrame(() => draw());
    } else if (b.x > canvasW) {
      scoreLeftRef.current += 1;
      scoreAnimLeftRef.current = performance.now() / 1000;
      startScoreAnimLoop();
      spawnScoreParticles(b.x, b.y);
      resetBall(b, canvasW, canvasH, true);
      draw();
      requestAnimationFrame(() => draw());
    }

    updateTrail();
    updateParticles(dt);
  }

  function draw() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    const dpr = window.devicePixelRatio || 1;
    const canvasSize = getCanvasSize(isMobile, isSmallLandscape);
    const canvasW = canvasSize.width;
    const canvasH = canvasSize.height;

    if (canvas.width !== canvasW * dpr || canvas.height !== canvasH * dpr) {
      canvas.width = canvasW * dpr;
      canvas.height = canvasH * dpr;
      canvas.style.width = `${canvasW}px`;
      canvas.style.height = `${canvasH}px`;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const themeColors = getThemeColors(theme);
    ctx.fillStyle = themeColors.bg;
    ctx.fillRect(0, 0, canvasW, canvasH);

    // Draw border like original Pong
    ctx.strokeStyle = themeColors.border;
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.strokeRect(0, 0, canvasW, canvasH);

    // Draw classic dashed center line
    ctx.strokeStyle = themeColors.net;
    ctx.lineWidth = 4;
    ctx.setLineDash([20, 15]);
    ctx.beginPath();
    ctx.moveTo(canvasW / 2, 0);
    ctx.lineTo(canvasW / 2, canvasH);
    ctx.stroke();
    ctx.setLineDash([]);

    const pl = paddleLeftRef.current;
    const pr = paddleRightRef.current;

    // Draw paddles with classic rectangular look
    ctx.save();
    ctx.shadowBlur = 15;
    ctx.shadowColor = themeColors.paddleGlowLeft;
    ctx.fillStyle = themeColors.paddleLeft;
    ctx.fillRect(pl.x, pl.y, pl.w, pl.h);
    ctx.shadowColor = themeColors.paddleGlowRight;
    ctx.fillStyle = themeColors.paddleRight;
    ctx.fillRect(pr.x, pr.y, pr.w, pr.h);
    ctx.restore();

    drawTrail(ctx);

    // Draw ball as perfect square like original Pong
    const b = ballRef.current;
    ctx.save();
    ctx.shadowBlur = 20;
    ctx.shadowColor = themeColors.ballGlow;
    ctx.fillStyle = themeColors.ball;
    ctx.fillRect(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
    ctx.restore();

    drawParticles(ctx);

    // Draw classic arcade-style scores
    ctx.fillStyle = themeColors.text;
    ctx.textAlign = "center";
    const fontSize = Math.max(24, Math.min(36, canvasW * 0.04));
    ctx.font = `bold ${fontSize}px 'Press Start 2P', monospace`;
    ctx.shadowBlur = 8;
    ctx.shadowColor = themeColors.text;

    const now = performance.now() / 1000;
    const drawAnimatedScore = (value: number, x: number, animT: number) => {
      const age = animT ? now - animT : 1000;
      let scale = 1;
      let alpha = 1;
      if (age < 0.9) {
        const t = age / 0.9;
        scale = 1 + Math.sin(Math.min(1, t) * Math.PI) * (1 - t) * 0.5;
        alpha = 0.5 + 0.5 * Math.sin(t * Math.PI * 6); // Flash effect
      }
      const dynamicFontSize = Math.round(fontSize * scale);
      ctx.font = `bold ${dynamicFontSize}px 'Press Start 2P', monospace`;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(x, 60);
      ctx.scale(1, 1);
      ctx.fillText(String(value), 0, 0);
      ctx.restore();
    };
    drawAnimatedScore(
      scoreLeftRef.current,
      canvasW * 0.25,
      scoreAnimLeftRef.current
    );
    drawAnimatedScore(
      scoreRightRef.current,
      canvasW * 0.75,
      scoreAnimRightRef.current
    );

    // Add "PONG" title at top center like arcade
    ctx.save();
    const titleFontSize = Math.max(16, Math.min(24, canvasW * 0.027));
    ctx.font = `bold ${titleFontSize}px 'Press Start 2P', monospace`;
    ctx.fillStyle = themeColors.text;
    ctx.globalAlpha = 0.6;
    ctx.textAlign = "center";
    ctx.fillText("PONG", canvasW / 2, 30);
    ctx.restore();
  }

  function getThemeColors(t: "neon" | "amber" | "green") {
    if (t === "neon")
      return {
        bg: "#000000", // Pure black like original arcade
        net: "rgba(0,255,255,0.8)", // Bright cyan net
        paddleLeft: "#ffffff", // Classic white paddles
        paddleRight: "#ffffff",
        paddleGlowLeft: "rgba(0,255,255,0.6)",
        paddleGlowRight: "rgba(255,0,255,0.6)",
        ball: "#ffffff", // White ball like original
        ballGlow: "rgba(0,255,255,0.8)",
        text: "#00ff00", // Classic green score text
        border: "#00ffff", // Cyan border
      };
    if (t === "amber")
      return {
        bg: "#1a0800",
        net: "rgba(255,200,120,0.8)",
        paddleLeft: "#ffaa00",
        paddleRight: "#ffaa00",
        paddleGlowLeft: "rgba(255,170,0,0.6)",
        paddleGlowRight: "rgba(255,200,0,0.6)",
        ball: "#ffdd00",
        ballGlow: "rgba(255,221,0,0.8)",
        text: "#ffaa00",
        border: "#ffaa00",
      };
    return {
      bg: "#001a00",
      net: "rgba(0,255,0,0.8)",
      paddleLeft: "#00ff00",
      paddleRight: "#00ff00",
      paddleGlowLeft: "rgba(0,255,0,0.6)",
      paddleGlowRight: "rgba(50,255,50,0.6)",
      ball: "#00ff88",
      ballGlow: "rgba(0,255,136,0.8)",
      text: "#00ff00",
      border: "#00ff88",
    };
  }

  function spawnScoreParticles(x: number, y: number) {
    const colors =
      theme === "neon"
        ? ["#00f7ff", "#ff4db8", "#fff25c"]
        : theme === "amber"
        ? ["#ffd86b", "#ffb86b", "#fff1c6"]
        : ["#9effa6", "#4df2a6", "#caffd4"];
    const count = 18;
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 220;
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed - 30,
        life: 0.9 + Math.random() * 0.6,
        size: 1 + Math.random() * 3,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
  }

  function updateParticles(dt: number) {
    const arr = particlesRef.current;
    for (let i = arr.length - 1; i >= 0; i--) {
      const p = arr[i];
      p.vy += 180 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) arr.splice(i, 1);
    }
  }

  function drawParticles(ctx: CanvasRenderingContext2D) {
    const arr = particlesRef.current;
    for (let i = 0; i < arr.length; i++) {
      const p = arr[i];
      const alpha = Math.max(0, Math.min(1, p.life));
      ctx.beginPath();
      ctx.fillStyle = applyAlpha(p.color, alpha);
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function applyAlpha(hex: string, a: number) {
    if (!hex.startsWith("#")) return hex;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${a})`;
  }

  function updateTrail() {
    const b = ballRef.current;
    const arr = trailRef.current;
    const now = performance.now() / 1000;
    const speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);

    // Only add trail point if ball has moved significantly
    const lastPoint = arr[arr.length - 1];
    if (
      !lastPoint ||
      Math.abs(b.x - lastPoint.x) > 5 ||
      Math.abs(b.y - lastPoint.y) > 5
    ) {
      arr.push({ x: b.x, y: b.y, t: now, speed });
    }

    // Remove old trail points more efficiently
    while (arr.length > 0 && now - arr[0].t > 0.4) arr.shift();

    // Limit trail length for performance
    if (arr.length > 15) arr.shift();
  }

  function drawTrail(ctx: CanvasRenderingContext2D) {
    const arr = trailRef.current;
    if (arr.length < 2) return;

    const now = performance.now() / 1000;
    ctx.save();
    ctx.globalCompositeOperation = "screen";

    for (let i = arr.length - 1; i >= 0; i--) {
      const p = arr[i];
      const age = now - p.t;
      const life = Math.min(1, age / 0.4);
      const alpha = (1 - life) * 0.6;
      const size = Math.max(1, (1 - life) * 6);

      ctx.beginPath();
      ctx.fillStyle = applyAlpha(
        theme === "neon"
          ? "#00ffff"
          : theme === "amber"
          ? "#ffaa00"
          : "#00ff88",
        alpha
      );
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  return (
    <Box sx={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <AppBar position="static" color="transparent" elevation={0}>
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            aria-label="back"
            sx={{ mr: 1 }}
            onClick={() => navigate("/")}
          >
            <ArrowBack />
          </IconButton>
          <IconButton
            edge="start"
            color="inherit"
            aria-label="menu"
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Pong
          </Typography>

          {!isSmallLandscape && (
            <>
              <FormControl variant="standard" sx={{ minWidth: 120, mr: 2 }}>
                <InputLabel id="difficulty-label">Difficulty</InputLabel>
                <Select
                  labelId="difficulty-label"
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                  label="Difficulty"
                >
                  <MenuItem value={"Easy"}>Easy</MenuItem>
                  <MenuItem value={"Normal"}>Normal</MenuItem>
                  <MenuItem value={"Hard"}>Hard</MenuItem>
                </Select>
              </FormControl>

              <ToggleButtonGroup
                value={theme}
                exclusive
                onChange={(_, val) => val && setTheme(val)}
                size="small"
                sx={{ mr: 2 }}
              >
                <ToggleButton value="neon">Neon</ToggleButton>
                <ToggleButton value="amber">Amber</ToggleButton>
                <ToggleButton value="green">Green</ToggleButton>
              </ToggleButtonGroup>
            </>
          )}

          <IconButton
            color="inherit"
            onClick={() => (running ? stop() : start())}
            aria-label="play-pause"
          >
            {running ? <Pause /> : <PlayArrow />}
          </IconButton>
          <IconButton
            color="inherit"
            onClick={() => {
              restart();
              if (!running) draw();
            }}
            aria-label="restart"
          >
            <RestartAlt />
          </IconButton>
        </Toolbar>
      </AppBar>

      {isMobile && !isSmallLandscape && (
        <div className="mobile-rotate-overlay" role="note">
          <div className="rotate-inner">
            Rotate your device to landscape for best play
          </div>
        </div>
      )}

      {isMobile && (
        <Box
          sx={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            height: 120,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 20px",
            background: "rgba(0, 0, 0, 0.8)",
            borderTop: "2px solid #00ffff",
            zIndex: 1000,
          }}
        >
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <Button
              variant="contained"
              size="large"
              onTouchStart={() => (keysRef.current["ArrowUp"] = true)}
              onTouchEnd={() => (keysRef.current["ArrowUp"] = false)}
              onMouseDown={() => (keysRef.current["ArrowUp"] = true)}
              onMouseUp={() => (keysRef.current["ArrowUp"] = false)}
              sx={{
                minWidth: 60,
                minHeight: 40,
                fontSize: "12px",
                background: "#003333",
                border: "1px solid #00ffff",
                color: "#00ffff",
              }}
            >
              ↑
            </Button>
            <Button
              variant="contained"
              size="large"
              onTouchStart={() => (keysRef.current["ArrowDown"] = true)}
              onTouchEnd={() => (keysRef.current["ArrowDown"] = false)}
              onMouseDown={() => (keysRef.current["ArrowDown"] = true)}
              onMouseUp={() => (keysRef.current["ArrowDown"] = false)}
              sx={{
                minWidth: 60,
                minHeight: 40,
                fontSize: "12px",
                background: "#003333",
                border: "1px solid #00ffff",
                color: "#00ffff",
              }}
            >
              ↓
            </Button>
          </Box>
          <Typography
            variant="caption"
            sx={{
              color: "#00ffff",
              fontFamily: "'Press Start 2P', monospace",
              fontSize: "8px",
              textAlign: "center",
            }}
          >
            Touch controls
          </Typography>
        </Box>
      )}

      <Box
        sx={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: 1,
        }}
      >
        {isSmallLandscape && (
          <div className="side-controls left">
            <FormControl variant="standard" sx={{ minWidth: 88 }} size="small">
              <Select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                size="small"
              >
                <MenuItem value={"Easy"}>Easy</MenuItem>
                <MenuItem value={"Normal"}>Normal</MenuItem>
                <MenuItem value={"Hard"}>Hard</MenuItem>
              </Select>
            </FormControl>
            <ToggleButtonGroup
              value={theme}
              exclusive
              onChange={(_, val) => val && setTheme(val)}
              orientation="vertical"
              size="small"
            >
              <ToggleButton value="neon">N</ToggleButton>
              <ToggleButton value="amber">A</ToggleButton>
              <ToggleButton value="green">G</ToggleButton>
            </ToggleButtonGroup>
          </div>
        )}

        <div
          className={`canvas-wrap ${
            isSmallLandscape ? "landscape-fit reduced-width" : ""
          }`}
        >
          <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} />
        </div>

        {isSmallLandscape && (
          <div className="side-controls right">
            <IconButton
              color="inherit"
              onClick={() => (running ? stop() : start())}
              aria-label="play-pause"
              sx={{ bgcolor: "rgba(255,255,255,0.04)" }}
            >
              {running ? <Pause /> : <PlayArrow />}
            </IconButton>
            <IconButton
              color="inherit"
              onClick={() => {
                restart();
                if (!running) draw();
              }}
              aria-label="restart"
              sx={{ bgcolor: "rgba(255,255,255,0.04)" }}
            >
              <RestartAlt />
            </IconButton>
          </div>
        )}
      </Box>

      {isSmallLandscape ? (
        <Box
          className="mobile-bottom-controls"
          sx={{
            position: "fixed",
            bottom: 8,
            left: 8,
            right: 8,
            display: "flex",
            justifyContent: "space-around",
            zIndex: 1400,
          }}
        >
          <FormControl variant="standard" sx={{ minWidth: 96 }} size="small">
            <Select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as Difficulty)}
              size="small"
            >
              <MenuItem value={"Easy"}>Easy</MenuItem>
              <MenuItem value={"Normal"}>Normal</MenuItem>
              <MenuItem value={"Hard"}>Hard</MenuItem>
            </Select>
          </FormControl>

          <ToggleButtonGroup
            value={theme}
            exclusive
            onChange={(_, val) => val && setTheme(val)}
            size="small"
          >
            <ToggleButton value="neon">Neon</ToggleButton>
            <ToggleButton value="amber">Amber</ToggleButton>
            <ToggleButton value="green">Green</ToggleButton>
          </ToggleButtonGroup>

          <IconButton
            color="inherit"
            onClick={() => (running ? stop() : start())}
            aria-label="play-pause"
            sx={{ bgcolor: "rgba(255,255,255,0.04)" }}
          >
            {running ? <Pause /> : <PlayArrow />}
          </IconButton>
          <IconButton
            color="inherit"
            onClick={() => {
              restart();
              if (!running) draw();
            }}
            aria-label="restart"
            sx={{ bgcolor: "rgba(255,255,255,0.04)" }}
          >
            <RestartAlt />
          </IconButton>
        </Box>
      ) : (
        <Box component="footer" sx={{ p: 1, textAlign: "center" }}>
          <Typography variant="caption">
            Controls: W / S or ArrowUp / ArrowDown — Restart to reset the match.
          </Typography>
        </Box>
      )}
    </Box>
  );
}
