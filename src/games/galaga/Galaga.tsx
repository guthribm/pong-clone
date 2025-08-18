import { useEffect, useRef, useState, useCallback } from "react";
import "../../App.css";
import Box from "@mui/material/Box";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import { useNavigate } from "react-router-dom";
import ArrowBack from "@mui/icons-material/ArrowBack";
import Button from "@mui/material/Button";
import PlayArrow from "@mui/icons-material/PlayArrow";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme as useMuiTheme } from "@mui/material/styles";
// SVG assets (import as URLs via Vite)
import PlayerSVG from "./assets/player.svg";
import BeeSVG from "./assets/bee.svg";
import ButterflySVG from "./assets/butterfly.svg";
import MothSVG from "./assets/moth.svg";

// Game constants
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const CANVAS_ASPECT = CANVAS_WIDTH / CANVAS_HEIGHT;

// Game entities
interface GameObject {
  x: number;
  y: number;
  width: number;
  height: number;
  active: boolean;
}

interface Player extends GameObject {
  speed: number;
  lives: number;
}

interface Bullet extends GameObject {
  speed: number;
  fromPlayer: boolean;
  color?: string;
  angle?: number;
}

interface Enemy extends GameObject {
  type: "bee" | "butterfly" | "moth";
  speed: number;
  health: number;
  points: number;
  inFormation: boolean;
  formationX: number;
  formationY: number;
  attackTime: number;
  attacking: boolean;
  attackPath?: (t: number) => { x: number; y: number };
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
}

// Enemy types with different properties
const ENEMY_TYPES = {
  bee: { width: 24, height: 24, health: 1, points: 50, color: "#ffff00" },
  butterfly: {
    width: 28,
    height: 28,
    health: 2,
    points: 160,
    color: "#ff0080",
  },
  moth: { width: 32, height: 32, health: 3, points: 400, color: "#00ff80" },
};

// Level pattern config for first 5 levels
const LEVEL_PATTERNS = [
  // Level 1
  {
    formationRows: 3,
    formationCols: 8,
    driftSpeed: 20,
    attackTypes: ["straight"],
    maxAttackers: 1,
    attackRate: 0.2,
    entryType: "straight",
    bulletRate: 0.1,
    bulletSpeed: 120,
    playerLives: 5,
    maxEnemyBullets: 1,
  },
  // Level 2
  {
    formationRows: 3,
    formationCols: 8,
    driftSpeed: 24,
    attackTypes: ["sCurve", "straight"],
    maxAttackers: 1,
    attackRate: 0.25,
    entryType: "sCurve",
    bulletRate: 0.13,
    bulletSpeed: 140,
    playerLives: 5,
    maxEnemyBullets: 1,
  },
  // Level 3
  {
    formationRows: 4,
    formationCols: 9,
    driftSpeed: 28,
    attackTypes: ["loop", "sCurve", "straight"],
    maxAttackers: 2,
    attackRate: 0.3,
    entryType: "loop",
    bulletRate: 0.16,
    bulletSpeed: 160,
    playerLives: 4,
    maxEnemyBullets: 2,
  },
  // Level 4
  {
    formationRows: 5,
    formationCols: 10,
    driftSpeed: 32,
    attackTypes: ["swoop", "loop", "sCurve"],
    maxAttackers: 3,
    attackRate: 0.35,
    entryType: "swoop",
    bulletRate: 0.19,
    bulletSpeed: 180,
    playerLives: 3,
    maxEnemyBullets: 2,
  },
  // Level 5
  {
    formationRows: 5,
    formationCols: 10,
    driftSpeed: 36,
    attackTypes: ["swoop", "loop", "sCurve", "straight"],
    maxAttackers: 3,
    attackRate: 0.4,
    entryType: "swoop",
    bulletRate: 0.22,
    bulletSpeed: 200,
    playerLives: 2,
    maxEnemyBullets: 3,
  },
];

// Fallback for difficulty selector
const DIFFICULTY_SETTINGS = {
  easy: LEVEL_PATTERNS[0],
  normal: LEVEL_PATTERNS[2],
  hard: LEVEL_PATTERNS[4],
};

// Path templates for enemy attacks
function getAttackPath(
  type: string,
  startX: number,
  startY: number,
  targetX: number,
  targetY: number
) {
  // Returns a function t∈[0,1] → {x, y}
  switch (type) {
    case "straight":
      return (t: number) => ({
        x: startX + (targetX - startX) * t,
        y: startY + (targetY - startY) * t,
      });
    case "sCurve":
      // S-curve: uses sine for x offset
      return (t: number) => ({
        x: startX + (targetX - startX) * t + 60 * Math.sin(Math.PI * t),
        y: startY + (targetY - startY) * t,
      });
    case "loop":
      // Loop: circular arc then straight down
      return (t: number) => {
        if (t < 0.5) {
          const angle = Math.PI * t * 2;
          return {
            x: startX + 80 * Math.cos(angle),
            y: startY + 80 * Math.sin(angle),
          };
        } else {
          return {
            x: startX + (targetX - startX) * (t - 0.5) * 2,
            y: startY + 80 + (targetY - (startY + 80)) * (t - 0.5) * 2,
          };
        }
      };
    case "swoop":
      // Swoop: fast downward arc then up
      return (t: number) => {
        return {
          x: startX + (targetX - startX) * t + 40 * Math.sin(2 * Math.PI * t),
          y: startY + 120 * Math.sin(Math.PI * t),
        };
      };
    default:
      // fallback to straight
      return (t: number) => ({
        x: startX + (targetX - startX) * t,
        y: startY + (targetY - startY) * t,
      });
  }
}

// Parallax starfield setup
const STAR_LAYERS = [
  { count: 40, speed: 20, color: "rgba(255,255,255,0.7)" },
  { count: 30, speed: 40, color: "rgba(0,255,255,0.7)" },
  { count: 20, speed: 60, color: "rgba(255,0,255,0.7)" },
  { count: 15, speed: 80, color: "rgba(255,255,0,0.7)" },
  { count: 10, speed: 120, color: "rgba(0,255,128,0.7)" },
];

interface Star {
  x: number;
  y: number;
  color: string;
}

// Power-up types
const POWERUP_TYPES = ["double", "shield", "rainbow"] as const;
type PowerUpType = (typeof POWERUP_TYPES)[number];
interface PowerUp {
  x: number;
  y: number;
  type: PowerUpType;
  active: boolean;
  color: string;
}

export default function Galaga() {
  // Starfield ref for parallax background (must be after STAR_LAYERS definition)
  const starfieldRef = useRef<Star[][]>(
    STAR_LAYERS.map((layer) =>
      Array.from({ length: layer.count }, () => ({
        x: Math.random() * CANVAS_WIDTH,
        y: Math.random() * CANVAS_HEIGHT,
        color: layer.color,
      }))
    )
  );
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Image refs for SVG rendering on canvas
  const playerImgRef = useRef<HTMLImageElement | null>(null);
  const enemyImgRefs = useRef<{
    bee: HTMLImageElement | null;
    butterfly: HTMLImageElement | null;
    moth: HTMLImageElement | null;
  }>({ bee: null, butterfly: null, moth: null });
  const animationRef = useRef<number | undefined>(undefined);
  const theme = useMuiTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  // Game state
  const [gameStarted, setGameStarted] = useState(false);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  const [difficulty, setDifficulty] = useState<"easy" | "normal" | "hard">(
    "normal"
  );

  // State refs for draw function
  const gameStateRef = useRef({
    gameStarted: false,
    gameOver: false,
    score: 0,
    level: 1,
  });

  // Game running ref for loop control
  const runningRef = useRef(false);

  // Update state ref when state changes
  useEffect(() => {
    gameStateRef.current = { gameStarted, gameOver, score, level };
  }, [gameStarted, gameOver, score, level]);

  // Game objects refs
  const playerRef = useRef<Player>({
    x: CANVAS_WIDTH / 2 - 20,
    y: CANVAS_HEIGHT - 60,
    width: 40,
    height: 40,
    active: true,
    speed: 300,
    lives: 3,
  });

  const bulletsRef = useRef<Bullet[]>([]);
  const enemiesRef = useRef<Enemy[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const keysRef = useRef<Record<string, boolean>>({});
  const lastTimeRef = useRef<number>(0);
  const waveStartTimeRef = useRef<number>(0);
  const lastShotTimeRef = useRef<number>(0);
  const powerUpsRef = useRef<PowerUp[]>([]);
  const playerPowerRef = useRef<{
    double: boolean;
    shield: boolean;
    rainbow: boolean;
  }>({ double: false, shield: false, rainbow: false });
  // Power-up timers
  const powerUpTimersRef = useRef<{
    double: number;
    shield: number;
    rainbow: number;
  }>({ double: 0, shield: 0, rainbow: 0 });

  let powerUpTimer = 0;

  // Mobile controls
  const touchStartXRef = useRef<number>(0);
  const isTouchingRef = useRef(false);

  // Setup canvas
  const setupCanvasSize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    let canvasWidth, canvasHeight;

    if (isMobile) {
      const maxWidth = window.innerWidth * 0.95;
      const maxHeight = window.innerHeight * 0.7;

      // Calculate size maintaining aspect ratio
      const widthByHeight = maxHeight * CANVAS_ASPECT;
      const heightByWidth = maxWidth / CANVAS_ASPECT;

      if (widthByHeight <= maxWidth) {
        canvasWidth = widthByHeight;
        canvasHeight = maxHeight;
      } else {
        canvasWidth = maxWidth;
        canvasHeight = heightByWidth;
      }
    } else {
      canvasWidth = CANVAS_WIDTH * 0.8;
      canvasHeight = CANVAS_HEIGHT * 0.8;
    }

    canvas.width = canvasWidth * dpr;
    canvas.height = canvasHeight * dpr;
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${canvasHeight}px`;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      // Scale context to match DPR and then scale back to logical coordinates
      ctx.scale(dpr, dpr);
      ctx.scale(canvasWidth / CANVAS_WIDTH, canvasHeight / CANVAS_HEIGHT);
      ctx.imageSmoothingEnabled = false;
    }
  }, [isMobile]);

  // Initialize game
  const initGame = () => {
    const settings = DIFFICULTY_SETTINGS[difficulty];
    playerRef.current = {
      x: CANVAS_WIDTH / 2 - 20,
      y: CANVAS_HEIGHT - 60,
      width: 40,
      height: 40,
      active: true,
      speed: 300,
      lives: settings.playerLives,
    };
    bulletsRef.current = [];
    enemiesRef.current = [];
    particlesRef.current = [];
    powerUpsRef.current = [];
    setScore(0);
    setLevel(1);
    setGameOver(false);
    spawnWave();
  };

  // Spawn enemy wave with per-level config
  const spawnWave = () => {
    const lvl = Math.min(level - 1, LEVEL_PATTERNS.length - 1);
    const config = LEVEL_PATTERNS[lvl];
    const enemies: Enemy[] = [];
    const formationStartX = CANVAS_WIDTH / 2 - (config.formationCols * 32) / 2;
    const formationStartY = 100;
    for (let row = 0; row < config.formationRows; row++) {
      for (let col = 0; col < config.formationCols; col++) {
        // Entry: spawn above screen, slot into formation
        enemies.push({
          x: formationStartX + col * 32,
          y: -40 - row * 40,
          width: 28,
          height: 28,
          active: true,
          type: row === 0 ? "moth" : row === 1 ? "butterfly" : "bee",
          speed: config.driftSpeed,
          health: row === 0 ? 3 : row === 1 ? 2 : 1,
          points: row === 0 ? 400 : row === 1 ? 160 : 50,
          inFormation: false,
          formationX: formationStartX + col * 32,
          formationY: formationStartY + row * 40,
          attackTime: 0,
          attacking: false,
        });
      }
    }
    enemiesRef.current = enemies;
    waveStartTimeRef.current = performance.now();
  };

  // Update createBullet to support angle and color
  function createBullet(
    x: number,
    y: number,
    fromPlayer: boolean,
    angle: number = 0,
    color: string = "#ffff00"
  ) {
    const bullet: Bullet & { angle?: number; color?: string } = {
      x,
      y,
      width: 4,
      height: 12,
      active: true,
      speed: fromPlayer ? -500 : 150, // Slower enemy bullets
      fromPlayer,
      angle,
      color,
    };
    bulletsRef.current.push(bullet);
  }

  // Create explosion particles
  const createExplosion = (
    x: number,
    y: number,
    color: string,
    rainbow = false
  ) => {
    if (rainbow) {
      for (let i = 0; i < 24; i++) {
        const hue = (i * 15) % 360;
        particlesRef.current.push({
          x,
          y,
          vx: Math.cos((i / 24) * 2 * Math.PI) * 180,
          vy: Math.sin((i / 24) * 2 * Math.PI) * 180,
          life: 1.2,
          maxLife: 1.2,
          color: `hsl(${hue},100%,60%)`,
        });
      }
    } else {
      for (let i = 0; i < 8; i++) {
        particlesRef.current.push({
          x,
          y,
          vx: (Math.random() - 0.5) * 200,
          vy: (Math.random() - 0.5) * 200,
          life: 1,
          maxLife: 1,
          color,
        });
      }
    }
  };

  // Collision detection
  const checkCollision = (obj1: GameObject, obj2: GameObject): boolean => {
    return (
      obj1.x < obj2.x + obj2.width &&
      obj1.x + obj1.width > obj2.x &&
      obj1.y < obj2.y + obj2.height &&
      obj1.y + obj1.height > obj2.y
    );
  };

  // Update game state
  const update = (deltaTime: number) => {
    // Use refs for loop control, not React state
    if (!runningRef.current) return;

    const player = playerRef.current;
    const currentTime = performance.now();

    // Player movement and auto-firing
    let playerMoved = false;

    if (
      keysRef.current["ArrowLeft"] ||
      keysRef.current["a"] ||
      keysRef.current["A"]
    ) {
      player.x = Math.max(0, player.x - player.speed * deltaTime);
      playerMoved = true;
    }
    if (
      keysRef.current["ArrowRight"] ||
      keysRef.current["d"] ||
      keysRef.current["D"]
    ) {
      player.x = Math.min(
        CANVAS_WIDTH - player.width,
        player.x + player.speed * deltaTime
      );
      playerMoved = true;
    }

    // Auto-fire when moving or manual firing
    if (
      (playerMoved || keysRef.current[" "] || keysRef.current["ArrowUp"]) &&
      currentTime - lastShotTimeRef.current > 200 // Slightly faster firing rate
    ) {
      if (playerPowerRef.current.rainbow) {
        // Rainbow burst: fire a spread of rainbow bullets
        for (let i = -2; i <= 2; i++) {
          createBullet(
            player.x + player.width / 2 - 2,
            player.y,
            true,
            i * 0.15,
            `hsl(${(i + 2) * 72},100%,60%)`
          );
        }
      } else if (playerPowerRef.current.double) {
        // Double shot: fire two bullets
        createBullet(
          player.x + player.width / 2 - 8,
          player.y,
          true,
          0,
          "#00ffff"
        );
        createBullet(
          player.x + player.width / 2 + 4,
          player.y,
          true,
          0,
          "#00ffff"
        );
      } else {
        // Normal shot
        createBullet(
          player.x + player.width / 2 - 2,
          player.y,
          true,
          0,
          "#ffff00"
        );
      }
      lastShotTimeRef.current = currentTime;
    }

    // Update bullets
    bulletsRef.current = bulletsRef.current.filter((bullet) => {
      if (!bullet.active) return false;
      if (bullet.angle) bullet.x += Math.sin(bullet.angle) * 180 * deltaTime;
      bullet.y += bullet.speed * deltaTime;

      // Remove bullets that go off screen
      if (
        bullet.y < -bullet.height ||
        bullet.y > CANVAS_HEIGHT + bullet.height
      ) {
        return false;
      }

      // Check bullet-enemy collisions
      if (bullet.fromPlayer) {
        for (const enemy of enemiesRef.current) {
          if (enemy.active && checkCollision(bullet, enemy)) {
            bullet.active = false;
            enemy.health--;
            if (enemy.health <= 0) {
              enemy.active = false;
              setScore((prev) => prev + enemy.points);
              createExplosion(
                enemy.x + enemy.width / 2,
                enemy.y + enemy.height / 2,
                ENEMY_TYPES[enemy.type].color
              );
            }
            return false;
          }
        }
      } else {
        // Enemy bullet hits player (check for shield first)
        if (checkCollision(bullet, player)) {
          bullet.active = false;

          // Shield protects the player
          if (playerPowerRef.current.shield) {
            createExplosion(
              bullet.x + bullet.width / 2,
              bullet.y + bullet.height / 2,
              "#00ffff",
              true
            );
          } else {
            // Player takes damage
            player.lives--;
            createExplosion(
              player.x + player.width / 2,
              player.y + player.height / 2,
              "#ffffff"
            );
            if (player.lives <= 0) {
              player.active = false;
              runningRef.current = false;
              setGameOver(true);
            }
          }
          return false;
        }
      }

      return true;
    });

    // Update enemies with per-level logic
    const lvl = Math.min(level - 1, LEVEL_PATTERNS.length - 1);
    const config = LEVEL_PATTERNS[lvl];
    // Formation drift
    const formationOffset = Math.sin(performance.now() / 1200) * 40;
    let attackers = 0;
    let enemyBullets = bulletsRef.current.filter((b) => !b.fromPlayer).length;
    for (const enemy of enemiesRef.current) {
      if (!enemy.active) continue;
      // Entry phase: move to formation slot
      if (!enemy.inFormation && !enemy.attacking) {
        // Move toward formation slot
        const dx = enemy.formationX - enemy.x;
        const dy = enemy.formationY - enemy.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 2) {
          enemy.x = enemy.formationX + formationOffset;
          enemy.y = enemy.formationY;
          enemy.inFormation = true;
        } else {
          enemy.x += dx * 0.08;
          enemy.y += dy * 0.08;
        }
        continue;
      }
      // Formation drift
      if (enemy.inFormation && !enemy.attacking) {
        enemy.x = enemy.formationX + formationOffset;
        enemy.y = enemy.formationY;
        // Attack scheduling
        if (
          attackers < config.maxAttackers &&
          Math.random() < config.attackRate * deltaTime &&
          !gameOver &&
          gameStarted
        ) {
          // Pick attack type
          const attackType =
            config.attackTypes[
              Math.floor(Math.random() * config.attackTypes.length)
            ];
          // Target: player position
          const targetX = player.x + player.width / 2;
          const targetY = CANVAS_HEIGHT + 60;
          enemy.attacking = true;
          enemy.inFormation = false;
          enemy.attackTime = 0;
          // Attach path function
          enemy.attackPath = getAttackPath(
            attackType,
            enemy.x,
            enemy.y,
            targetX,
            targetY
          );
          attackers++;
        }
      }
      // Attacking phase
      if (enemy.attacking) {
        enemy.attackTime += deltaTime * (1 + lvl * 0.15);
        const t = Math.min(enemy.attackTime, 1);
        const pathFn = enemy.attackPath;
        if (typeof pathFn === "function") {
          const pos = pathFn(t);
          enemy.x = pos.x;
          enemy.y = pos.y;
        }
        // Fire bullets during attack
        if (
          enemyBullets < config.maxEnemyBullets &&
          Math.random() < config.bulletRate * deltaTime
        ) {
          createBullet(
            enemy.x + enemy.width / 2,
            enemy.y + enemy.height,
            false,
            0,
            "#ff2222"
          );
          enemyBullets++;
        }
        // End attack: off screen or finished path
        if (enemy.y > CANVAS_HEIGHT + 40 || t >= 1) {
          // Return to formation
          enemy.attacking = false;
          enemy.inFormation = true;
          enemy.x = enemy.formationX + formationOffset;
          enemy.y = enemy.formationY;
          enemy.attackTime = 0;
          enemy.attackPath = undefined;
        }
      }
      // Check enemy-player collision
      if (checkCollision(enemy, player)) {
        if (playerPowerRef.current.shield) {
          createExplosion(
            player.x + player.width / 2,
            player.y + player.height / 2,
            "#00ffff"
          );
        } else {
          player.lives--;
          createExplosion(
            player.x + player.width / 2,
            player.y + player.height / 2,
            "#ff2222"
          );
          if (player.lives <= 0) {
            player.active = false;
            setGameOver(true);
            runningRef.current = false;
          }
        }
        enemy.active = false;
      }
    }

    // Update particles
    particlesRef.current = particlesRef.current.filter((particle) => {
      particle.x += particle.vx * deltaTime;
      particle.y += particle.vy * deltaTime;
      particle.life -= deltaTime;
      return particle.life > 0;
    });

    // Animate parallax stars
    starfieldRef.current.forEach((stars, i) => {
      const speed = STAR_LAYERS[i].speed;
      (stars as Star[]).forEach((star: Star) => {
        star.y += speed * deltaTime;
        if (star.y > CANVAS_HEIGHT) {
          star.y = 0;
          star.x = Math.random() * CANVAS_WIDTH;
        }
      });
    });

    // Power-up spawn logic
    powerUpTimer += deltaTime;
    if (powerUpTimer > 8 + Math.random() * 6 && gameStarted && !gameOver) {
      powerUpTimer = 0;
      // Spawn a random power-up
      const px = Math.random() * (CANVAS_WIDTH - 32) + 16;
      powerUpsRef.current.push({
        x: px,
        y: -20,
        type: POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)],
        active: true,
        color: `hsl(${Math.floor(Math.random() * 360)},100%,60%)`,
      });
    }
    // Move power-ups
    powerUpsRef.current.forEach((pu) => {
      pu.y += 80 * deltaTime;
      if (pu.y > CANVAS_HEIGHT) pu.active = false;
      // Collision with player
      if (
        pu.active &&
        pu.x < playerRef.current.x + playerRef.current.width &&
        pu.x + 24 > playerRef.current.x &&
        pu.y < playerRef.current.y + playerRef.current.height &&
        pu.y + 24 > playerRef.current.y
      ) {
        pu.active = false;
        playerPowerRef.current[pu.type] = true;
        createExplosion(pu.x + 12, pu.y + 12, pu.color, true);
      }
    });

    // Power-up durations
    (
      Object.keys(playerPowerRef.current) as Array<
        "double" | "shield" | "rainbow"
      >
    ).forEach((type) => {
      if (playerPowerRef.current[type]) {
        powerUpTimersRef.current[type] += deltaTime;
        if (type === "double" && powerUpTimersRef.current[type] > 10) {
          playerPowerRef.current[type] = false;
          powerUpTimersRef.current[type] = 0;
        }
        if (type === "shield" && powerUpTimersRef.current[type] > 8) {
          playerPowerRef.current[type] = false;
          powerUpTimersRef.current[type] = 0;
        }
        if (type === "rainbow" && powerUpTimersRef.current[type] > 5) {
          playerPowerRef.current[type] = false;
          powerUpTimersRef.current[type] = 0;
        }
      }
    });

    // Check if all enemies are destroyed
    const activeEnemies = enemiesRef.current.filter((enemy) => enemy.active);
    if (activeEnemies.length === 0) {
      setLevel((prev) => prev + 1);
      spawnWave();
    }
  };

  // Render game
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const { gameStarted, gameOver, score, level } = gameStateRef.current;

    // Clear screen
    ctx.fillStyle = "#000011";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Parallax rainbow stars
    starfieldRef.current.forEach((stars, i) => {
      ctx.save();
      ctx.shadowColor = STAR_LAYERS[i].color;
      ctx.shadowBlur = 8;
      (stars as Star[]).forEach((star: Star) => {
        ctx.fillStyle = star.color;
        ctx.beginPath();
        ctx.arc(star.x, star.y, 1.5 + i * 0.5, 0, 2 * Math.PI);
        ctx.fill();
      });
      ctx.restore();
    });

    if (!gameStarted || gameOver) return;

    const player = playerRef.current;

    // Player ship (SVG if loaded, otherwise neon fallback)
    if (player.active) {
      const img = playerImgRef.current;
      if (img && img.complete && img.naturalWidth) {
        // center and scale to player.width/height
        ctx.save();
        try {
          ctx.drawImage(img, player.x, player.y, player.width, player.height);
        } catch {
          // draw fallback if drawImage fails
          ctx.shadowColor = "cyan";
          ctx.shadowBlur = 16;
          ctx.strokeStyle = "white";
          ctx.lineWidth = 2;
          ctx.fillStyle = "rgba(0,255,255,0.7)";
          ctx.beginPath();
          ctx.moveTo(player.x + player.width / 2, player.y);
          ctx.lineTo(player.x, player.y + player.height);
          ctx.lineTo(player.x + player.width, player.y + player.height);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
        ctx.restore();
      } else {
        ctx.save();
        ctx.shadowColor = "cyan";
        ctx.shadowBlur = 16;
        ctx.strokeStyle = "white";
        ctx.lineWidth = 2;
        ctx.fillStyle = "rgba(0,255,255,0.7)";
        ctx.beginPath();
        ctx.moveTo(player.x + player.width / 2, player.y);
        ctx.lineTo(player.x, player.y + player.height);
        ctx.lineTo(player.x + player.width, player.y + player.height);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Cockpit
        ctx.beginPath();
        ctx.arc(
          player.x + player.width / 2,
          player.y + player.height * 0.7,
          7,
          0,
          2 * Math.PI
        );
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        ctx.fill();
        ctx.restore();
      }
    }

    // Enemies: draw SVGs if available, otherwise neon fallback
    enemiesRef.current.forEach((enemy) => {
      if (!enemy.active) return;
      const imgs = enemyImgRefs.current;
      const img =
        enemy.type === "bee"
          ? imgs.bee
          : enemy.type === "butterfly"
          ? imgs.butterfly
          : imgs.moth;
      if (img && img.complete && img.naturalWidth) {
        ctx.save();
        try {
          ctx.drawImage(img, enemy.x, enemy.y, enemy.width, enemy.height);
        } catch {
          // fallback drawing below
        }
        ctx.restore();
        return;
      }

      // Neon fallback
      const neonColor =
        enemy.type === "bee"
          ? "yellow"
          : enemy.type === "butterfly"
          ? "magenta"
          : "lime";
      ctx.save();
      ctx.shadowColor = neonColor;
      ctx.shadowBlur = 12;
      ctx.strokeStyle = neonColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(
        enemy.x + enemy.width / 2,
        enemy.y + enemy.height / 2,
        enemy.width / 2,
        enemy.height / 2,
        0,
        0,
        2 * Math.PI
      );
      ctx.fillStyle = ENEMY_TYPES[enemy.type].color;
      ctx.fill();
      ctx.stroke();
      // Eyes
      ctx.beginPath();
      ctx.arc(
        enemy.x + enemy.width * 0.35,
        enemy.y + enemy.height * 0.4,
        2,
        0,
        2 * Math.PI
      );
      ctx.arc(
        enemy.x + enemy.width * 0.65,
        enemy.y + enemy.height * 0.4,
        2,
        0,
        2 * Math.PI
      );
      ctx.fillStyle = "#fff";
      ctx.fill();
      ctx.restore();
    });

    // Draw bullets
    bulletsRef.current.forEach((bullet) => {
      if (!bullet.active) return;
      ctx.save();
      const b = bullet as Bullet;

      if (b.fromPlayer) {
        // Player bullets - yellow rectangles
        ctx.shadowColor = b.color || "#ffff00";
        ctx.shadowBlur = 12;
        ctx.fillStyle = b.color || "#ffff00";
        ctx.fillRect(b.x, b.y, b.width, b.height);
      } else {
        // Enemy bullets - distinct red diamonds with pulsing glow
        const centerX = b.x + b.width / 2;
        const centerY = b.y + b.height / 2;
        const size = 6;
        const pulseIntensity = 0.7 + 0.3 * Math.sin(Date.now() / 100);

        ctx.shadowColor = "#ff0000";
        ctx.shadowBlur = 15 * pulseIntensity;
        ctx.fillStyle = "#ff0000";
        ctx.strokeStyle = "#ff6666";
        ctx.lineWidth = 2;

        // Draw diamond shape
        ctx.beginPath();
        ctx.moveTo(centerX, centerY - size);
        ctx.lineTo(centerX + size, centerY);
        ctx.lineTo(centerX, centerY + size);
        ctx.lineTo(centerX - size, centerY);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Add inner glow
        ctx.shadowBlur = 5;
        ctx.fillStyle = "#ffaaaa";
        ctx.beginPath();
        ctx.moveTo(centerX, centerY - size / 2);
        ctx.lineTo(centerX + size / 2, centerY);
        ctx.lineTo(centerX, centerY + size / 2);
        ctx.lineTo(centerX - size / 2, centerY);
        ctx.closePath();
        ctx.fill();
      }

      ctx.restore();
    });

    // Draw particles
    for (const particle of particlesRef.current) {
      const alpha = particle.life / particle.maxLife;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = particle.color;
      ctx.fillRect(particle.x - 2, particle.y - 2, 4, 4);
      ctx.restore();
    }

    // Draw power-ups
    powerUpsRef.current.forEach((pu) => {
      if (!pu.active) return;
      ctx.save();
      ctx.shadowColor = pu.color;
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(pu.x + 12, pu.y + 12, 12, 0, 2 * Math.PI);
      ctx.fillStyle = pu.color;
      ctx.globalAlpha = 0.85;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#fff";
      ctx.stroke();
      ctx.font = "bold 12px monospace";
      ctx.fillStyle = "#fff";
      ctx.globalAlpha = 1;
      ctx.textAlign = "center";
      ctx.fillText(pu.type.toUpperCase(), pu.x + 12, pu.y + 16);
      ctx.restore();
    });

    // Draw shield effect
    if (playerPowerRef.current.shield && player.active) {
      ctx.save();
      ctx.shadowColor = "cyan";
      ctx.shadowBlur = 24;
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(Date.now() / 200);
      ctx.beginPath();
      ctx.arc(
        player.x + player.width / 2,
        player.y + player.height / 2,
        player.width * 0.7,
        0,
        2 * Math.PI
      );
      ctx.strokeStyle = "cyan";
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.restore();
    }

    // Draw UI
    ctx.fillStyle = "#ffffff";
    ctx.font = "16px 'Press Start 2P', monospace";
    ctx.textAlign = "left";
    ctx.fillText(`Score: ${score}`, 10, 30);
    ctx.fillText(`Level: ${level}`, 10, 55);
    ctx.fillText(`Lives: ${player.lives}`, 10, 80);

    if (gameOver) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      ctx.fillStyle = "#ff0000";
      ctx.font = "32px 'Press Start 2P', monospace";
      ctx.textAlign = "center";
      ctx.fillText("GAME OVER", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
      ctx.fillStyle = "#ffffff";
      ctx.font = "16px 'Press Start 2P', monospace";
      ctx.fillText(
        `Final Score: ${score}`,
        CANVAS_WIDTH / 2,
        CANVAS_HEIGHT / 2 + 50
      );
    }
  }, []);

  // Start game
  const startGame = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    setGameStarted(true);
    setGameOver(false);
    runningRef.current = true;
    initGame();
    lastTimeRef.current = performance.now();

    function gameLoop(timestamp: number) {
      if (!runningRef.current) return;
      const deltaTime = Math.min(
        (timestamp - lastTimeRef.current) / 1000,
        0.033
      );
      lastTimeRef.current = timestamp;
      update(deltaTime);
      draw();
      // Always schedule next frame if running
      if (runningRef.current) {
        animationRef.current = requestAnimationFrame(gameLoop);
      }
    }
    animationRef.current = requestAnimationFrame(gameLoop);
  };

  // Reset game
  const resetGame = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    runningRef.current = false;
    setGameStarted(false);
    setGameOver(false);
    initGame();
  };

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.key] = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.key] = false;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // Touch controls for mobile
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isMobile) return;

    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      if (!gameStarted) return;

      const touch = e.touches[0];
      touchStartXRef.current = touch.clientX;
      isTouchingRef.current = true;
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (!gameStarted || !isTouchingRef.current) return;

      const touch = e.touches[0];
      const deltaX = touch.clientX - touchStartXRef.current;
      const player = playerRef.current;

      // Move player based on touch movement
      const moveSpeed = 2;
      const oldX = player.x;
      player.x = Math.max(
        0,
        Math.min(CANVAS_WIDTH - player.width, player.x + deltaX * moveSpeed)
      );
      touchStartXRef.current = touch.clientX;

      // Auto-fire when moving on touch
      const currentTime = performance.now();
      if (oldX !== player.x && currentTime - lastShotTimeRef.current > 200) {
        if (playerPowerRef.current.rainbow) {
          // Rainbow burst: fire a spread of rainbow bullets
          for (let i = -2; i <= 2; i++) {
            createBullet(
              player.x + player.width / 2 - 2,
              player.y,
              true,
              i * 0.15,
              `hsl(${(i + 2) * 72},100%,60%)`
            );
          }
        } else if (playerPowerRef.current.double) {
          // Double shot: fire two bullets
          createBullet(
            player.x + player.width / 2 - 8,
            player.y,
            true,
            0,
            "#00ffff"
          );
          createBullet(
            player.x + player.width / 2 + 4,
            player.y,
            true,
            0,
            "#00ffff"
          );
        } else {
          // Normal shot
          createBullet(
            player.x + player.width / 2 - 2,
            player.y,
            true,
            0,
            "#ffff00"
          );
        }
        lastShotTimeRef.current = currentTime;
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      isTouchingRef.current = false;
    };

    canvas.addEventListener("touchstart", handleTouchStart, { passive: false });
    canvas.addEventListener("touchmove", handleTouchMove, { passive: false });
    canvas.addEventListener("touchend", handleTouchEnd, { passive: false });

    return () => {
      canvas.removeEventListener("touchstart", handleTouchStart);
      canvas.removeEventListener("touchmove", handleTouchMove);
      canvas.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isMobile, gameStarted]);

  // Setup canvas and handle resize
  useEffect(() => {
    setupCanvasSize();
    // Initial draw to show stars even when not started
    requestAnimationFrame(() => {
      draw();
    });

    const handleResize = () => {
      setupCanvasSize();
      requestAnimationFrame(() => {
        draw();
      });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile, setupCanvasSize]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // Load SVG images once
  useEffect(() => {
    const p = new Image();
    p.src = PlayerSVG;
    playerImgRef.current = p;

    const b = new Image();
    b.src = BeeSVG;
    const bf = new Image();
    bf.src = ButterflySVG;
    const m = new Image();
    m.src = MothSVG;

    enemyImgRefs.current = { bee: b, butterfly: bf, moth: m };

    // No cleanup necessary for Image objects
  }, []);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #000011 0%, #001133 100%)",
        color: "#ffffff",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <AppBar position="static" sx={{ background: "rgba(0, 20, 40, 0.8)" }}>
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            onClick={() => navigate("/")}
            sx={{ mr: 2 }}
          >
            <ArrowBack />
          </IconButton>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Galaga
          </Typography>

          {/* Difficulty Selector */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography
              variant="caption"
              sx={{
                color: "#fff",
                fontFamily: "'Press Start 2P', monospace",
                fontSize: "0.6rem",
                mr: 1,
              }}
            >
              Difficulty:
            </Typography>
            <Button
              variant={difficulty === "easy" ? "contained" : "outlined"}
              size="small"
              sx={{
                color: "#00ff80",
                borderColor: "#00ff80",
                fontFamily: "'Press Start 2P', monospace",
                fontSize: "0.5rem",
                minWidth: "60px",
                px: 1,
                py: 0.5,
              }}
              onClick={() => {
                setDifficulty("easy");
                if (gameStarted) {
                  resetGame();
                  setTimeout(() => startGame(), 100);
                }
              }}
            >
              Easy
            </Button>
            <Button
              variant={difficulty === "normal" ? "contained" : "outlined"}
              size="small"
              sx={{
                color: "#ffff00",
                borderColor: "#ffff00",
                fontFamily: "'Press Start 2P', monospace",
                fontSize: "0.5rem",
                minWidth: "60px",
                px: 1,
                py: 0.5,
              }}
              onClick={() => {
                setDifficulty("normal");
                if (gameStarted) {
                  resetGame();
                  setTimeout(() => startGame(), 100);
                }
              }}
            >
              Normal
            </Button>
            <Button
              variant={difficulty === "hard" ? "contained" : "outlined"}
              size="small"
              sx={{
                color: "#ff0080",
                borderColor: "#ff0080",
                fontFamily: "'Press Start 2P', monospace",
                fontSize: "0.5rem",
                minWidth: "60px",
                px: 1,
                py: 0.5,
              }}
              onClick={() => {
                setDifficulty("hard");
                if (gameStarted) {
                  resetGame();
                  setTimeout(() => startGame(), 100);
                }
              }}
            >
              Hard
            </Button>
          </Box>
        </Toolbar>
      </AppBar>

      <Box
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          p: { xs: 1, sm: 2 },
          position: "relative",
        }}
      >
        <Box
          sx={{
            position: "relative",
            border: "2px solid #00ffff",
            borderRadius: 1,
            overflow: "hidden",
            boxShadow: "0 0 20px rgba(0, 255, 255, 0.3)",
          }}
        >
          <canvas
            ref={canvasRef}
            onClick={() => !gameStarted && startGame()}
            style={{
              display: "block",
              touchAction: "none",
              cursor: !gameStarted ? "pointer" : "default",
            }}
          />

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
                color: "#00ffff",
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
                  textShadow: "0 0 10px #00ffff",
                }}
              >
                GALAGA
              </Typography>
              <Typography
                variant="body1"
                sx={{
                  mb: 2,
                  fontSize: { xs: "0.6rem", sm: "0.8rem" },
                  fontFamily: "'Press Start 2P', monospace",
                  color: "#ffffff",
                  maxWidth: "80%",
                  lineHeight: 1.6,
                }}
              >
                Defend against waves of alien invaders!
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
                  background: "linear-gradient(45deg, #00ffff, #0088ff)",
                  boxShadow: "0 0 20px rgba(0, 255, 255, 0.5)",
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
                  ? "Touch and drag to move and auto-fire"
                  : "← → Arrow keys or A/D to move and auto-fire • Space or ↑ to manual fire"}
              </Typography>
            </Box>
          )}
        </Box>

        {gameStarted && !gameOver && (
          <Box
            sx={{
              mt: 2,
              display: "flex",
              gap: 2,
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            <Button
              variant="outlined"
              onClick={resetGame}
              sx={{
                fontFamily: "'Press Start 2P', monospace",
                fontSize: "0.6rem",
                color: "#00ffff",
                borderColor: "#00ffff",
              }}
            >
              RESTART
            </Button>
          </Box>
        )}

        {gameStarted && !gameOver && isMobile && (
          <Box
            sx={{
              mt: 2,
              display: "flex",
              justifyContent: "center",
              width: "100%",
              maxWidth: "400px",
            }}
          >
            <Typography
              variant="caption"
              sx={{
                fontSize: "0.5rem",
                color: "#888",
                fontFamily: "'Press Start 2P', monospace",
                textAlign: "center",
                lineHeight: 1.4,
              }}
            >
              Drag on game area to move and auto-fire
            </Typography>
          </Box>
        )}

        {gameOver && (
          <Box
            sx={{
              mt: 2,
              display: "flex",
              gap: 2,
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            <Button
              variant="contained"
              onClick={resetGame}
              sx={{
                fontFamily: "'Press Start 2P', monospace",
                fontSize: "0.7rem",
                background: "linear-gradient(45deg, #ff0080, #ff4000)",
              }}
            >
              PLAY AGAIN
            </Button>
          </Box>
        )}
      </Box>
    </Box>
  );
}
