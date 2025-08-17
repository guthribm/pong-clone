import { useEffect, useRef, useState } from "react";
import "./App.css";
import type { Ball, Paddle, Difficulty } from "./game";
import { clamp, resetBall, bumpSpeed, updateAI } from "./game";

const CANVAS_WIDTH = 900;
const CANVAS_HEIGHT = 500;

/** Main React component: renders UI and drives the game loop. */
export default function App() {
  // Canvas refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  // Play state
  const [running, setRunning] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>("Normal");
  const scoreLeftRef = useRef(0);
  const scoreRightRef = useRef(0);
  // particles and trail for visual effects
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

  // theme: neon | amber | green
  const [theme, setTheme] = useState<"neon" | "amber" | "green">("neon");

  // Game state (mutable refs for tight loop)
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

  const keysRef = useRef<Record<string, boolean>>({});
  const pointerDownRef = useRef(false);
  const runningRef = useRef(false);

  // ---- Input handlers ---------------------------------------------------
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

  // ---- Game lifecycle ---------------------------------------------------
  useEffect(() => {
    // initial draw
    draw();
    // draw is stable in this module
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
    // reset scores and positions
    scoreLeftRef.current = 0;
    scoreRightRef.current = 0;
    paddleLeftRef.current.y = CANVAS_HEIGHT / 2 - paddleLeftRef.current.h / 2;
    paddleRightRef.current.y = CANVAS_HEIGHT / 2 - paddleRightRef.current.h / 2;
    resetBall(ballRef.current, CANVAS_WIDTH, CANVAS_HEIGHT, null);
    draw();
  }

  // ---- Update & physics -------------------------------------------------
  function update(dt: number) {
    const b = ballRef.current;
    const pl = paddleLeftRef.current;
    const pr = paddleRightRef.current;

    // player input
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
    pl.y = clamp(pl.y, 0, CANVAS_HEIGHT - pl.h);

    // AI
    updateAI(pr, b, difficulty, dt, CANVAS_HEIGHT);

    // move ball
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    // walls
    if (b.y - b.r <= 0) {
      b.y = b.r;
      b.vy = -b.vy;
    } else if (b.y + b.r >= CANVAS_HEIGHT) {
      b.y = CANVAS_HEIGHT - b.r;
      b.vy = -b.vy;
    }

    // left paddle collision
    if (b.x - b.r <= pl.x + pl.w && b.x - b.r >= pl.x) {
      if (b.y >= pl.y && b.y <= pl.y + pl.h && b.vx < 0) {
        b.x = pl.x + pl.w + b.r;
        b.vx = -b.vx;
        const rel = (b.y - (pl.y + pl.h / 2)) / (pl.h / 2);
        b.vy += rel * 200;
        bumpSpeed(b);
      }
    }

    // right paddle collision
    if (b.x + b.r >= pr.x && b.x + b.r <= pr.x + pr.w) {
      if (b.y >= pr.y && b.y <= pr.y + pr.h && b.vx > 0) {
        b.x = pr.x - b.r - 1;
        b.vx = -b.vx;
        const rel = (b.y - (pr.y + pr.h / 2)) / (pr.h / 2);
        b.vy += rel * 200;
        bumpSpeed(b);
      }
    }

    // scoring (use refs + state so draw sees latest immediately)
    if (b.x < 0) {
      scoreRightRef.current += 1;
      // spawn particles at ball
      spawnScoreParticles(b.x, b.y);
      resetBall(b, CANVAS_WIDTH, CANVAS_HEIGHT, false);
      draw();
      requestAnimationFrame(() => draw());
    } else if (b.x > CANVAS_WIDTH) {
      scoreLeftRef.current += 1;
      spawnScoreParticles(b.x, b.y);
      resetBall(b, CANVAS_WIDTH, CANVAS_HEIGHT, true);
      draw();
      requestAnimationFrame(() => draw());
    }
    // update visuals for particles & trail
    updateTrail();
    updateParticles(dt);
  }

  // ---- Rendering -------------------------------------------------------
  function draw() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    const dpr = window.devicePixelRatio || 1;
    if (
      canvas.width !== CANVAS_WIDTH * dpr ||
      canvas.height !== CANVAS_HEIGHT * dpr
    ) {
      canvas.width = CANVAS_WIDTH * dpr;
      canvas.height = CANVAS_HEIGHT * dpr;
      canvas.style.width = `${CANVAS_WIDTH}px`;
      canvas.style.height = `${CANVAS_HEIGHT}px`;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // background using theme colors
    const themeColors = getThemeColors(theme);
    ctx.fillStyle = themeColors.bg;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // net
    ctx.fillStyle = themeColors.net;
    for (let y = 10; y < CANVAS_HEIGHT; y += 30) {
      ctx.fillRect(CANVAS_WIDTH / 2 - 2, y, 4, 20);
    }

    // paddles (theme colors)
    const pl = paddleLeftRef.current;
    const pr = paddleRightRef.current;
    ctx.save();
    ctx.shadowBlur = 20;
    ctx.shadowColor = themeColors.paddleGlowLeft;
    ctx.fillStyle = themeColors.paddleLeft;
    ctx.fillRect(pl.x, pl.y, pl.w, pl.h);
    ctx.shadowColor = themeColors.paddleGlowRight;
    ctx.fillStyle = themeColors.paddleRight;
    ctx.fillRect(pr.x, pr.y, pr.w, pr.h);
    ctx.restore();

    // trail (draw before ball so ball is on top)
    drawTrail(ctx);

    // ball (glowing)
    const b = ballRef.current;
    ctx.save();
    ctx.beginPath();
    ctx.shadowBlur = 28;
    ctx.shadowColor = themeColors.ballGlow;
    ctx.fillStyle = themeColors.ball;
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // draw particles on top
    drawParticles(ctx);

    // scores (small and subtle now)
    ctx.fillStyle = themeColors.text;
    ctx.font = "28px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(String(scoreLeftRef.current), CANVAS_WIDTH * 0.25, 46);
    ctx.fillText(String(scoreRightRef.current), CANVAS_WIDTH * 0.75, 46);
  }

  // --- Theme color mapping ------------------------------------------------
  function getThemeColors(t: "neon" | "amber" | "green") {
    if (t === "neon")
      return {
        bg: "#030014",
        net: "rgba(0,247,255,0.06)",
        paddleLeft: "#00f7ff",
        paddleRight: "#ff4db8",
        paddleGlowLeft: "rgba(0,247,255,0.45)",
        paddleGlowRight: "rgba(255,77,184,0.45)",
        ball: "#fff25c",
        ballGlow: "rgba(255,242,92,0.65)",
        text: "#e8faff",
      };
    if (t === "amber")
      return {
        bg: "#1b0f00",
        net: "rgba(255,200,120,0.08)",
        paddleLeft: "#ffd86b",
        paddleRight: "#ffb86b",
        paddleGlowLeft: "rgba(255,216,107,0.35)",
        paddleGlowRight: "rgba(255,184,107,0.35)",
        ball: "#fff1c6",
        ballGlow: "rgba(255,241,200,0.45)",
        text: "#fff7e6",
      };
    // green
    return {
      bg: "#001405",
      net: "rgba(144,255,166,0.06)",
      paddleLeft: "#9effa6",
      paddleRight: "#4df2a6",
      paddleGlowLeft: "rgba(158,255,166,0.35)",
      paddleGlowRight: "rgba(77,242,166,0.35)",
      ball: "#caffd4",
      ballGlow: "rgba(202,255,212,0.5)",
      text: "#eaffef",
    };
  }

  // --- Particles & trail utilities ---------------------------------------
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
      p.vy += 180 * dt; // gravity-ish
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
    // simple hex -> rgba helper (assumes #rrggbb)
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
    arr.push({ x: b.x, y: b.y, t: now, speed });
    // remove older than 0.6s
    while (arr.length > 0 && now - arr[0].t > 0.6) arr.shift();
  }

  function drawTrail(ctx: CanvasRenderingContext2D) {
    const arr = trailRef.current;
    if (arr.length < 2) return;
    for (let i = arr.length - 1; i >= 0; i--) {
      const p = arr[i];
      const age = performance.now() / 1000 - p.t;
      const life = Math.min(1, age / 0.6);
      const w = Math.min(14, Math.max(2, p.speed / 60));
      ctx.beginPath();
      ctx.fillStyle = applyAlpha(
        theme === "neon"
          ? "#00f7ff"
          : theme === "amber"
          ? "#ffd86b"
          : "#9effa6",
        1 - life
      );
      ctx.arc(p.x, p.y, Math.max(1, (1 - life) * w), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  return (
    <div className={`app theme-${theme}`}>
      <h1>Pong Clone</h1>
      <div className="controls">
        <div className="difficulty">
          <label>
            <input
              type="radio"
              name="diff"
              checked={difficulty === "Easy"}
              onChange={() => setDifficulty("Easy")}
            />{" "}
            Easy
          </label>
          <label>
            <input
              type="radio"
              name="diff"
              checked={difficulty === "Normal"}
              onChange={() => setDifficulty("Normal")}
            />{" "}
            Normal
          </label>
          <label>
            <input
              type="radio"
              name="diff"
              checked={difficulty === "Hard"}
              onChange={() => setDifficulty("Hard")}
            />{" "}
            Hard
          </label>
        </div>

        <div className="buttons">
          <button onClick={() => (running ? stop() : start())}>
            {running ? "Pause" : "Start"}
          </button>
          <button
            onClick={() => {
              restart();
              if (!running) draw();
            }}
          >
            Restart
          </button>
        </div>

        <div className="palette">
          <label className="palette-label">Theme</label>
          <div
            className="palette-toggle"
            role="radiogroup"
            aria-label="Color theme"
          >
            <button
              className={theme === "neon" ? "active" : ""}
              onClick={() => setTheme("neon")}
              aria-pressed={theme === "neon"}
            >
              Neon
            </button>
            <button
              className={theme === "amber" ? "active" : ""}
              onClick={() => setTheme("amber")}
              aria-pressed={theme === "amber"}
            >
              Amber
            </button>
            <button
              className={theme === "green" ? "active" : ""}
              onClick={() => setTheme("green")}
              aria-pressed={theme === "green"}
            >
              Green
            </button>
          </div>
        </div>
      </div>

      <div className="canvas-wrap">
        {/* scoreboard removed - canvas displays scores now */}
        <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} />
      </div>

      <div className="legend">
        <div>Controls: W / S or ArrowUp / ArrowDown</div>
        <div>First to any score — use Restart to reset the match.</div>
      </div>
    </div>
  );
}
