export type Difficulty = "Easy" | "Normal" | "Hard";

export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

export interface Paddle {
  x: number;
  y: number;
  w: number;
  h: number;
  speed: number;
}

export function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

/** Reset ball to center and give it a random initial velocity. */
export function resetBall(
  b: Ball,
  canvasW: number,
  canvasH: number,
  toLeft: boolean | null = null
) {
  b.x = canvasW / 2;
  b.y = canvasH / 2;
  const speed = 300;
  const angle = (Math.random() * Math.PI) / 3 - Math.PI / 6; // -30..30deg
  const dir =
    toLeft === null ? (Math.random() < 0.5 ? -1 : 1) : toLeft ? -1 : 1;
  b.vx = dir * speed * Math.cos(angle);
  b.vy = speed * Math.sin(angle);
}

/** Slightly increase ball speed after paddle hits (caps at `max`). */
export function bumpSpeed(b: Ball) {
  const max = 900;
  const speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
  const factor = 1.03;
  const newSpeed = Math.min(max, speed * factor);
  const angle = Math.atan2(b.vy, b.vx);
  b.vx = Math.cos(angle) * newSpeed;
  b.vy = Math.sin(angle) * newSpeed;
}

/** Simple AI that moves the paddle towards the predicted ball Y. */
export function updateAI(
  pr: Paddle,
  b: Ball,
  diff: Difficulty,
  dt: number,
  canvasH: number
) {
  let targetY = b.y;
  let maxSpeed = 420;
  let react = 1;

  if (diff === "Easy") {
    // make Easy significantly slower and less reactive
    maxSpeed = 180;
    react = 0.03;
  } else if (diff === "Normal") {
    // make Normal slightly easier than before
    maxSpeed = 360;
    react = 0.08;
  } else if (diff === "Hard") {
    maxSpeed = 720;
    if (b.vx > 0) {
      const dist = pr.x - b.x;
      const t = dist / b.vx;
      targetY = b.y + b.vy * t;
    }
    react = 0.9;
  }

  targetY = clamp(targetY, pr.h / 2, canvasH - pr.h / 2);
  const center = pr.y + pr.h / 2;
  const dy = targetY - center;
  const move = dy * react;
  pr.y += clamp(move, -maxSpeed * dt, maxSpeed * dt);
  pr.y = clamp(pr.y, 0, canvasH - pr.h);
}
