"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Crosshair,
  Gem,
  Heart,
  Move,
  Pause,
  Play,
  RotateCcw,
  Shield,
  Sparkles,
  Volume2,
  VolumeX,
  Zap,
} from "lucide-react";

type Mode = "menu" | "playing" | "paused" | "upgrade" | "permanent";
type EnemyType = "spark" | "blaster" | "tank" | "splitter" | "boss";
type DropType = "heal" | "rapid" | "shield" | "nova";
type Vec = { x: number; y: number };
type Bullet = Vec & { vx: number; vy: number; r: number; life: number; damage: number; pierce: number; enemy: boolean; color: string };
type Enemy = Vec & { vx: number; vy: number; r: number; hp: number; maxHp: number; speed: number; type: EnemyType; shoot: number; touch: number; phase: number; flash: number };
type Particle = Vec & { vx: number; vy: number; life: number; maxLife: number; size: number; color: string };
type Drop = Vec & { type: DropType; r: number; life: number; spin: number };
type Star = Vec & { size: number; alpha: number };
type Upgrade = { id: string; name: string; description: string; icon: string; color: string };
type PermanentLevels = {
  damage: number;
  health: number;
  speed: number;
  fireRate: number;
  dash: number;
  accuracy: number;
};
type PermanentUpgrade = {
  id: keyof PermanentLevels;
  name: string;
  description: string;
  icon: string;
  color: string;
  baseCost: number;
  maxLevel: number;
};
type LastRun = { score: number; wave: number; earned: number };

type GameState = {
  width: number;
  height: number;
  time: number;
  player: Vec & {
    r: number; hp: number; maxHp: number; speed: number; angle: number;
    fireRate: number; fireTimer: number; damage: number; bulletSpeed: number;
    multishot: number; pierce: number; accuracy: number; dashTimer: number; dashCooldown: number;
    dashTime: number; invulnerable: number; shield: number; rapid: number;
  };
  bullets: Bullet[];
  enemies: Enemy[];
  particles: Particle[];
  drops: Drop[];
  stars: Star[];
  score: number;
  kills: number;
  combo: number;
  comboTimer: number;
  wave: number;
  spawned: number;
  waveTarget: number;
  spawnTimer: number;
  shake: number;
  waveStarted: boolean;
};

const UPGRADES: Upgrade[] = [
  { id: "damage", name: "Heavy Shots", description: "+30% blaster damage", icon: "◆", color: "#ff5c8a" },
  { id: "rapid", name: "Overclock", description: "+22% firing speed", icon: "⚡", color: "#ffe15c" },
  { id: "speed", name: "Turbo Boots", description: "+14% movement speed", icon: "➜", color: "#5cffa6" },
  { id: "health", name: "Heart Core", description: "+25 max health and heal", icon: "♥", color: "#ff668f" },
  { id: "multi", name: "Split Beam", description: "+1 projectile per shot", icon: "✦", color: "#cb78ff" },
  { id: "pierce", name: "Phase Rounds", description: "Shots pierce +1 enemy", icon: "◎", color: "#61e8ff" },
  { id: "dash", name: "Blink Drive", description: "Dash recharges 20% faster", icon: "◈", color: "#8ca7ff" },
  { id: "velocity", name: "Hyper Rounds", description: "+22% bullet speed and size", icon: "●", color: "#ff9b55" },
  { id: "accuracy", name: "Precision Sight", description: "25% tighter shot spread", icon: "⌖", color: "#79f7d4" },
];

const EMPTY_PERMANENT: PermanentLevels = {
  damage: 0,
  health: 0,
  speed: 0,
  fireRate: 0,
  dash: 0,
  accuracy: 0,
};

const PERMANENT_UPGRADES: PermanentUpgrade[] = [
  { id: "damage", name: "Power Core", description: "+10% starting damage", icon: "◆", color: "#ff5c8a", baseCost: 12, maxLevel: 10 },
  { id: "health", name: "Armor Core", description: "+12 starting health", icon: "♥", color: "#ff8aa8", baseCost: 10, maxLevel: 10 },
  { id: "speed", name: "Turbo Drive", description: "+6% movement speed", icon: "➜", color: "#5cffa6", baseCost: 10, maxLevel: 10 },
  { id: "fireRate", name: "Rapid Trigger", description: "+6% firing speed", icon: "⚡", color: "#ffe15c", baseCost: 14, maxLevel: 10 },
  { id: "dash", name: "Blink Engine", description: "+6% dash recharge", icon: "◈", color: "#8ca7ff", baseCost: 14, maxLevel: 10 },
  { id: "accuracy", name: "Targeting Core", description: "+12% starting accuracy", icon: "⌖", color: "#79f7d4", baseCost: 12, maxLevel: 10 },
];

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
const random = (min: number, max: number) => min + Math.random() * (max - min);
const chooseThree = () => [...UPGRADES].sort(() => Math.random() - 0.5).slice(0, 3);
const permanentCost = (upgrade: PermanentUpgrade, level: number) =>
  Math.round(upgrade.baseCost * (1 + level * 0.7));

function newGame(width: number, height: number, permanent: PermanentLevels = EMPTY_PERMANENT): GameState {
  const maxHp = 100 + permanent.health * 12;
  return {
    width,
    height,
    time: 0,
    player: {
      x: width / 2, y: height / 2, r: 15, hp: maxHp, maxHp, speed: 260 * (1 + permanent.speed * 0.06),
      angle: -Math.PI / 2, fireRate: 0.19 * Math.pow(0.94, permanent.fireRate), fireTimer: 0, damage: 24 * (1 + permanent.damage * 0.1),
      bulletSpeed: 720, multishot: 1, pierce: 0, accuracy: Math.pow(0.88, permanent.accuracy), dashTimer: 0,
      dashCooldown: 1.8 * Math.pow(0.94, permanent.dash), dashTime: 0, invulnerable: 0, shield: 0, rapid: 0,
    },
    bullets: [],
    enemies: [],
    particles: [],
    drops: [],
    stars: Array.from({ length: 90 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: random(0.5, 2.2),
      alpha: random(0.2, 0.85),
    })),
    score: 0, kills: 0, combo: 1, comboTimer: 0, wave: 1,
    spawned: 0, waveTarget: 9, spawnTimer: 0.5, shake: 0, waveStarted: true,
  };
}

export default function RiftRush() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<GameState>(newGame(900, 600));
  const modeRef = useRef<Mode>("menu");
  const keysRef = useRef<Record<string, boolean>>({});
  const pointerRef = useRef({ x: 650, y: 300, firing: false });
  const moveStickRef = useRef<Vec>({ x: 0, y: 0 });
  const aimStickRef = useRef<Vec>({ x: 0, y: 0 });
  const audioRef = useRef<AudioContext | null>(null);
  const mutedRef = useRef(false);
  const shardsRef = useRef(0);
  const permanentRef = useRef<PermanentLevels>({ ...EMPTY_PERMANENT });
  const lastHudRef = useRef(0);
  const lastFrameRef = useRef(0);
  const rafRef = useRef(0);

  const [mode, setModeState] = useState<Mode>("menu");
  const [muted, setMuted] = useState(false);
  const [highScore, setHighScore] = useState(0);
  const [shards, setShards] = useState(0);
  const [permanent, setPermanent] = useState<PermanentLevels>({ ...EMPTY_PERMANENT });
  const [lastRun, setLastRun] = useState<LastRun | null>(null);
  const [choices, setChoices] = useState<Upgrade[]>([]);
  const [moveKnob, setMoveKnob] = useState<Vec>({ x: 0, y: 0 });
  const [aimKnob, setAimKnob] = useState<Vec>({ x: 0, y: 0 });
  const [hud, setHud] = useState({ hp: 100, maxHp: 100, score: 0, wave: 1, combo: 1, dash: 1, shield: 0 });

  const setMode = useCallback((next: Mode) => {
    modeRef.current = next;
    setModeState(next);
  }, []);

  const sfx = useCallback((kind: "shoot" | "hit" | "dash" | "hurt" | "pickup" | "boss" | "over") => {
    if (mutedRef.current) return;
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;
    const ctx = audioRef.current ?? new AudioCtor();
    audioRef.current = ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    const setting = {
      shoot: [340, 0.035, "square"],
      hit: [115, 0.045, "sawtooth"],
      dash: [160, 0.12, "sine"],
      hurt: [82, 0.16, "sawtooth"],
      pickup: [620, 0.16, "sine"],
      boss: [68, 0.45, "square"],
      over: [130, 0.5, "triangle"],
    }[kind] as [number, number, OscillatorType];
    osc.type = setting[2];
    osc.frequency.setValueAtTime(setting[0], now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, setting[0] * (kind === "pickup" ? 1.8 : 0.55)), now + setting[1]);
    gain.gain.setValueAtTime(kind === "shoot" ? 0.025 : 0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + setting[1]);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + setting[1]);
  }, []);

  const burst = useCallback((x: number, y: number, color: string, count: number, speed = 170) => {
    const g = gameRef.current;
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const velocity = random(speed * 0.25, speed);
      const life = random(0.25, 0.65);
      g.particles.push({
        x, y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        life, maxLife: life, size: random(2, 6), color,
      });
    }
  }, []);

  const spawnEnemy = useCallback(() => {
    const g = gameRef.current;
    const bossWave = g.wave % 5 === 0;
    let type: EnemyType = "spark";
    if (bossWave) type = "boss";
    else {
      const roll = Math.random();
      if (g.wave >= 4 && roll < 0.16) type = "tank";
      else if (g.wave >= 3 && roll < 0.34) type = "blaster";
      else if (g.wave >= 2 && roll < 0.49) type = "splitter";
    }
    const edge = Math.floor(Math.random() * 4);
    const pad = type === "boss" ? 70 : 35;
    let x = random(40, g.width - 40);
    let y = random(40, g.height - 40);
    if (edge === 0) y = -pad;
    if (edge === 1) x = g.width + pad;
    if (edge === 2) y = g.height + pad;
    if (edge === 3) x = -pad;
    const scale = 1 + (g.wave - 1) * 0.09;
    const stats = {
      spark: { r: 14, hp: 35 * scale, speed: 92 + g.wave * 3 },
      blaster: { r: 17, hp: 50 * scale, speed: 62 + g.wave * 2 },
      tank: { r: 24, hp: 115 * scale, speed: 42 + g.wave },
      splitter: { r: 18, hp: 62 * scale, speed: 76 + g.wave * 2 },
      boss: { r: 48, hp: 650 + g.wave * 105, speed: 44 + g.wave },
    }[type];
    g.enemies.push({
      x, y, vx: 0, vy: 0, r: stats.r, hp: stats.hp, maxHp: stats.hp,
      speed: stats.speed, type, shoot: type === "boss" ? 1.2 : random(1.1, 2.2),
      touch: 0, phase: Math.random() * 10, flash: 0,
    });
    if (type === "boss") sfx("boss");
  }, [sfx]);

  const firePlayer = useCallback(() => {
    const g = gameRef.current;
    const p = g.player;
    if (p.fireTimer > 0) return;
    p.fireTimer = p.fireRate * (p.rapid > 0 ? 0.5 : 1);
    const spread = p.multishot === 1 ? 0 : Math.min(0.3, 0.09 + p.multishot * 0.025);
    for (let i = 0; i < p.multishot; i += 1) {
      const offset = p.multishot === 1 ? 0 : ((i / (p.multishot - 1)) - 0.5) * spread * 2;
      const naturalSpread = random(-0.028, 0.028) * p.accuracy;
      const angle = p.angle + offset * p.accuracy + naturalSpread;
      g.bullets.push({
        x: p.x + Math.cos(angle) * 21,
        y: p.y + Math.sin(angle) * 21,
        vx: Math.cos(angle) * p.bulletSpeed,
        vy: Math.sin(angle) * p.bulletSpeed,
        r: 4 + Math.min(2, (p.bulletSpeed / 720 - 1) * 3),
        life: 1.3, damage: p.damage, pierce: p.pierce, enemy: false,
        color: p.rapid > 0 ? "#ffe15c" : "#63f3ff",
      });
    }
    sfx("shoot");
  }, [sfx]);

  const dash = useCallback(() => {
    if (modeRef.current !== "playing") return;
    const p = gameRef.current.player;
    if (p.dashTimer > 0 || p.dashTime > 0) return;
    p.dashTimer = p.dashCooldown;
    p.dashTime = 0.18;
    p.invulnerable = Math.max(p.invulnerable, 0.25);
    gameRef.current.shake = 5;
    burst(p.x, p.y, "#8c7bff", 15, 240);
    sfx("dash");
  }, [burst, sfx]);

  const startGame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    gameRef.current = newGame(rect.width, rect.height, permanentRef.current);
    const player = gameRef.current.player;
    pointerRef.current = { x: rect.width * 0.7, y: rect.height * 0.5, firing: false };
    setHud({ hp: player.hp, maxHp: player.maxHp, score: 0, wave: 1, combo: 1, dash: 1, shield: 0 });
    setMode("playing");
    audioRef.current?.resume();
  }, [setMode]);

  const chooseUpgrade = useCallback((upgrade: Upgrade) => {
    const g = gameRef.current;
    const p = g.player;
    if (upgrade.id === "damage") p.damage *= 1.3;
    if (upgrade.id === "rapid") p.fireRate *= 0.78;
    if (upgrade.id === "speed") p.speed *= 1.14;
    if (upgrade.id === "health") { p.maxHp += 25; p.hp = Math.min(p.maxHp, p.hp + 35); }
    if (upgrade.id === "multi") p.multishot = Math.min(6, p.multishot + 1);
    if (upgrade.id === "pierce") p.pierce += 1;
    if (upgrade.id === "dash") p.dashCooldown *= 0.8;
    if (upgrade.id === "velocity") p.bulletSpeed *= 1.22;
    if (upgrade.id === "accuracy") p.accuracy *= 0.75;
    g.wave += 1;
    g.spawned = 0;
    g.waveTarget = g.wave % 5 === 0 ? 1 : 7 + g.wave * 2;
    g.spawnTimer = 0.8;
    g.waveStarted = true;
    p.hp = Math.min(p.maxHp, p.hp + 10);
    sfx("pickup");
    setMode("playing");
  }, [setMode, sfx]);

  const endGame = useCallback(() => {
    const g = gameRef.current;
    const saved = Number(localStorage.getItem("rift-rush-high-score") || 0);
    if (g.score > saved) {
      localStorage.setItem("rift-rush-high-score", String(g.score));
      setHighScore(g.score);
    }
    const earned = Math.max(2, Math.floor(g.score / 650) + g.wave);
    const nextShards = shardsRef.current + earned;
    shardsRef.current = nextShards;
    setShards(nextShards);
    localStorage.setItem("rift-rush-shards", String(nextShards));
    setLastRun({ score: g.score, wave: g.wave, earned });
    sfx("over");
    setMode("menu");
  }, [setMode, sfx]);

  useEffect(() => {
    setHighScore(Number(localStorage.getItem("rift-rush-high-score") || 0));
    const savedShards = Math.max(0, Number(localStorage.getItem("rift-rush-shards") || 0));
    shardsRef.current = Number.isFinite(savedShards) ? savedShards : 0;
    setShards(shardsRef.current);
    try {
      const savedPermanent = JSON.parse(localStorage.getItem("rift-rush-permanent") || "{}") as Partial<PermanentLevels>;
      const loaded = { ...EMPTY_PERMANENT };
      for (const key of Object.keys(loaded) as Array<keyof PermanentLevels>) {
        const value = Number(savedPermanent[key] ?? 0);
        loaded[key] = clamp(Number.isFinite(value) ? Math.floor(value) : 0, 0, 10);
      }
      permanentRef.current = loaded;
      setPermanent(loaded);
    } catch {
      permanentRef.current = { ...EMPTY_PERMANENT };
    }
  }, []);

  const buyPermanentUpgrade = useCallback((upgrade: PermanentUpgrade) => {
    const currentLevel = permanentRef.current[upgrade.id];
    if (currentLevel >= upgrade.maxLevel) return;
    const cost = permanentCost(upgrade, currentLevel);
    if (shardsRef.current < cost) return;
    const nextShards = shardsRef.current - cost;
    const nextPermanent = {
      ...permanentRef.current,
      [upgrade.id]: currentLevel + 1,
    };
    shardsRef.current = nextShards;
    permanentRef.current = nextPermanent;
    setShards(nextShards);
    setPermanent(nextPermanent);
    localStorage.setItem("rift-rush-shards", String(nextShards));
    localStorage.setItem("rift-rush-permanent", JSON.stringify(nextPermanent));
    sfx("pickup");
  }, [sfx]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      keysRef.current[event.key.toLowerCase()] = true;
      if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(event.key.toLowerCase())) event.preventDefault();
      if ((event.key === "Shift" || event.key.toLowerCase() === "e") && !event.repeat) dash();
      if (event.key.toLowerCase() === "p" || event.key === "Escape") {
        if (modeRef.current === "playing") setMode("paused");
        else if (modeRef.current === "paused") setMode("playing");
      }
      if (event.key === " " && modeRef.current === "menu") startGame();
    };
    const onKeyUp = (event: KeyboardEvent) => { keysRef.current[event.key.toLowerCase()] = false; };
    window.addEventListener("keydown", onKeyDown, { passive: false });
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [dash, setMode, startGame]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const shell = shellRef.current;
    if (!canvas || !shell) return;
    const resize = () => {
      const rect = shell.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      const g = gameRef.current;
      g.width = rect.width;
      g.height = rect.height;
      g.player.x = clamp(g.player.x, 24, rect.width - 24);
      g.player.y = clamp(g.player.y, 24, rect.height - 24);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(shell);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const updatePointer = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointerRef.current.x = event.clientX - rect.left;
      pointerRef.current.y = event.clientY - rect.top;
    };
    const down = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      updatePointer(event);
      pointerRef.current.firing = true;
    };
    const up = () => { pointerRef.current.firing = false; };
    canvas.addEventListener("pointermove", updatePointer);
    canvas.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", up);
    return () => {
      canvas.removeEventListener("pointermove", updatePointer);
      canvas.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", up);
    };
  }, []);

  useEffect(() => {
    const drawPolygon = (ctx: CanvasRenderingContext2D, sides: number, radius: number) => {
      ctx.beginPath();
      for (let i = 0; i < sides; i += 1) {
        const angle = i * Math.PI * 2 / sides;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
    };

    const draw = (ctx: CanvasRenderingContext2D, g: GameState) => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, g.width, g.height);
      const bg = ctx.createRadialGradient(g.player.x, g.player.y, 20, g.width / 2, g.height / 2, Math.max(g.width, g.height));
      bg.addColorStop(0, "#10173a");
      bg.addColorStop(0.55, "#070b21");
      bg.addColorStop(1, "#03040d");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, g.width, g.height);

      ctx.save();
      if (g.shake > 0) ctx.translate(random(-g.shake, g.shake), random(-g.shake, g.shake));
      for (const star of g.stars) {
        ctx.globalAlpha = star.alpha * (0.7 + Math.sin(g.time * 2 + star.x) * 0.3);
        ctx.fillStyle = "#b9d8ff";
        ctx.fillRect(star.x % g.width, star.y % g.height, star.size, star.size);
      }
      ctx.globalAlpha = 1;

      const grid = 64;
      ctx.strokeStyle = "rgba(100, 119, 255, 0.075)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      const ox = (g.time * -8) % grid;
      const oy = (g.time * 5) % grid;
      for (let x = ox; x < g.width; x += grid) { ctx.moveTo(x, 0); ctx.lineTo(x, g.height); }
      for (let y = oy; y < g.height; y += grid) { ctx.moveTo(0, y); ctx.lineTo(g.width, y); }
      ctx.stroke();

      for (const drop of g.drops) {
        const color = { heal: "#ff5c8a", rapid: "#ffe15c", shield: "#61e8ff", nova: "#c376ff" }[drop.type];
        ctx.save();
        ctx.translate(drop.x, drop.y);
        ctx.rotate(drop.spin);
        ctx.shadowBlur = 20;
        ctx.shadowColor = color;
        ctx.strokeStyle = color;
        ctx.fillStyle = `${color}22`;
        ctx.lineWidth = 3;
        drawPolygon(ctx, 6, drop.r);
        ctx.fill();
        ctx.stroke();
        ctx.rotate(-drop.spin);
        ctx.fillStyle = color;
        ctx.font = "bold 15px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText({ heal: "+", rapid: "⚡", shield: "◇", nova: "✦" }[drop.type], 0, 1);
        ctx.restore();
      }

      for (const bullet of g.bullets) {
        ctx.save();
        ctx.shadowBlur = bullet.enemy ? 12 : 17;
        ctx.shadowColor = bullet.color;
        ctx.fillStyle = bullet.color;
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, bullet.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.28;
        ctx.lineWidth = bullet.r * 1.3;
        ctx.strokeStyle = bullet.color;
        ctx.beginPath();
        ctx.moveTo(bullet.x, bullet.y);
        ctx.lineTo(bullet.x - bullet.vx * 0.025, bullet.y - bullet.vy * 0.025);
        ctx.stroke();
        ctx.restore();
      }

      for (const enemy of g.enemies) {
        const color = { spark: "#ff4f81", blaster: "#ff9a52", tank: "#ad6cff", splitter: "#50e6a2", boss: "#ff3df2" }[enemy.type];
        ctx.save();
        ctx.translate(enemy.x, enemy.y);
        ctx.rotate(g.time * (enemy.type === "boss" ? 0.45 : 0.9) + enemy.phase);
        ctx.shadowBlur = enemy.type === "boss" ? 30 : 16;
        ctx.shadowColor = color;
        ctx.fillStyle = enemy.flash > 0 ? "#ffffff" : `${color}35`;
        ctx.strokeStyle = color;
        ctx.lineWidth = enemy.type === "boss" ? 4 : 2.5;
        drawPolygon(ctx, enemy.type === "tank" ? 4 : enemy.type === "boss" ? 8 : enemy.type === "splitter" ? 3 : 6, enemy.r);
        ctx.fill();
        ctx.stroke();
        ctx.rotate(-g.time * 1.8 - enemy.phase);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(0, 0, enemy.r * 0.28, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        if (enemy.hp < enemy.maxHp || enemy.type === "boss") {
          const width = enemy.r * 2;
          ctx.fillStyle = "rgba(0,0,0,.55)";
          ctx.fillRect(enemy.x - width / 2, enemy.y - enemy.r - 11, width, 5);
          ctx.fillStyle = color;
          ctx.fillRect(enemy.x - width / 2, enemy.y - enemy.r - 11, width * Math.max(0, enemy.hp / enemy.maxHp), 5);
        }
      }

      for (const particle of g.particles) {
        ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
        ctx.fillStyle = particle.color;
        ctx.shadowBlur = 8;
        ctx.shadowColor = particle.color;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size * (particle.life / particle.maxLife), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;

      const p = g.player;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      if (p.shield > 0) {
        ctx.strokeStyle = `rgba(97,232,255,${0.5 + Math.sin(g.time * 7) * 0.25})`;
        ctx.lineWidth = 3;
        ctx.shadowBlur = 18;
        ctx.shadowColor = "#61e8ff";
        ctx.beginPath();
        ctx.arc(0, 0, p.r + 10, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.shadowBlur = 22;
      ctx.shadowColor = p.invulnerable > 0 ? "#ffffff" : "#6e8cff";
      ctx.fillStyle = p.invulnerable > 0 && Math.floor(g.time * 20) % 2 ? "#ffffff" : "#718cff";
      ctx.beginPath();
      ctx.moveTo(23, 0);
      ctx.lineTo(-12, -13);
      ctx.lineTo(-7, 0);
      ctx.lineTo(-12, 13);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = p.rapid > 0 ? "#ffe15c" : "#61e8ff";
      ctx.beginPath();
      ctx.moveTo(-9, -7);
      ctx.lineTo(-22 - Math.random() * 8, 0);
      ctx.lineTo(-9, 7);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.restore();
    };

    const update = (dt: number) => {
      const g = gameRef.current;
      const p = g.player;
      g.time += dt;
      g.shake = Math.max(0, g.shake - dt * 26);
      p.fireTimer = Math.max(0, p.fireTimer - dt);
      p.dashTimer = Math.max(0, p.dashTimer - dt);
      p.dashTime = Math.max(0, p.dashTime - dt);
      p.invulnerable = Math.max(0, p.invulnerable - dt);
      p.shield = Math.max(0, p.shield - dt);
      p.rapid = Math.max(0, p.rapid - dt);
      g.comboTimer = Math.max(0, g.comboTimer - dt);
      if (g.comboTimer <= 0) g.combo = 1;

      let mx = 0;
      let my = 0;
      if (keysRef.current.w || keysRef.current.arrowup) my -= 1;
      if (keysRef.current.s || keysRef.current.arrowdown) my += 1;
      if (keysRef.current.a || keysRef.current.arrowleft) mx -= 1;
      if (keysRef.current.d || keysRef.current.arrowright) mx += 1;
      if (Math.abs(moveStickRef.current.x) + Math.abs(moveStickRef.current.y) > 0.08) {
        mx = moveStickRef.current.x;
        my = moveStickRef.current.y;
      }
      const moveLength = Math.hypot(mx, my);
      if (moveLength > 0) { mx /= moveLength; my /= moveLength; }
      const dashBoost = p.dashTime > 0 ? 3.25 : 1;
      p.x = clamp(p.x + mx * p.speed * dashBoost * dt, p.r + 5, g.width - p.r - 5);
      p.y = clamp(p.y + my * p.speed * dashBoost * dt, p.r + 5, g.height - p.r - 5);
      if (p.dashTime > 0 && Math.random() < 0.7) {
        g.particles.push({ x: p.x, y: p.y, vx: random(-30, 30), vy: random(-30, 30), life: 0.25, maxLife: 0.25, size: 6, color: "#718cff" });
      }

      const mobileAim = Math.hypot(aimStickRef.current.x, aimStickRef.current.y) > 0.18;
      if (mobileAim) p.angle = Math.atan2(aimStickRef.current.y, aimStickRef.current.x);
      else p.angle = Math.atan2(pointerRef.current.y - p.y, pointerRef.current.x - p.x);
      if (pointerRef.current.firing || keysRef.current[" "] || mobileAim) firePlayer();

      if (g.spawned < g.waveTarget) {
        g.spawnTimer -= dt;
        if (g.spawnTimer <= 0) {
          spawnEnemy();
          g.spawned += 1;
          g.spawnTimer = g.wave % 5 === 0 ? 99 : Math.max(0.22, 0.85 - g.wave * 0.035);
        }
      } else if (g.enemies.length === 0 && g.waveStarted) {
        g.waveStarted = false;
        setChoices(chooseThree());
        setMode("upgrade");
        sfx("pickup");
        return;
      }

      for (let i = g.bullets.length - 1; i >= 0; i -= 1) {
        const bullet = g.bullets[i];
        bullet.x += bullet.vx * dt;
        bullet.y += bullet.vy * dt;
        bullet.life -= dt;
        if (bullet.life <= 0 || bullet.x < -40 || bullet.x > g.width + 40 || bullet.y < -40 || bullet.y > g.height + 40) {
          g.bullets.splice(i, 1);
        }
      }

      for (let i = g.enemies.length - 1; i >= 0; i -= 1) {
        const enemy = g.enemies[i];
        enemy.shoot -= dt;
        enemy.touch = Math.max(0, enemy.touch - dt);
        enemy.flash = Math.max(0, enemy.flash - dt);
        const dx = p.x - enemy.x;
        const dy = p.y - enemy.y;
        const length = Math.hypot(dx, dy) || 1;
        const wanted = enemy.type === "blaster" ? 250 : enemy.type === "boss" ? 190 : 0;
        const direction = wanted && length < wanted ? -0.55 : 1;
        enemy.vx += (dx / length * enemy.speed * direction - enemy.vx) * Math.min(1, dt * 3.5);
        enemy.vy += (dy / length * enemy.speed * direction - enemy.vy) * Math.min(1, dt * 3.5);
        if (enemy.type === "splitter") {
          enemy.vx += Math.cos(g.time * 5 + enemy.phase) * 35 * dt;
          enemy.vy += Math.sin(g.time * 5 + enemy.phase) * 35 * dt;
        }
        enemy.x += enemy.vx * dt;
        enemy.y += enemy.vy * dt;

        if ((enemy.type === "blaster" || enemy.type === "boss") && enemy.shoot <= 0 && length < 650) {
          const shots = enemy.type === "boss" ? 10 : 1;
          for (let shot = 0; shot < shots; shot += 1) {
            const angle = enemy.type === "boss" ? (shot / shots) * Math.PI * 2 + g.time * 0.4 : Math.atan2(dy, dx);
            const speed = enemy.type === "boss" ? 175 : 235;
            g.bullets.push({
              x: enemy.x + Math.cos(angle) * enemy.r,
              y: enemy.y + Math.sin(angle) * enemy.r,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              r: enemy.type === "boss" ? 6 : 5,
              life: 4,
              damage: enemy.type === "boss" ? 15 : 11,
              pierce: 0,
              enemy: true,
              color: enemy.type === "boss" ? "#ff3df2" : "#ff9a52",
            });
          }
          enemy.shoot = enemy.type === "boss" ? Math.max(0.7, 1.55 - g.wave * 0.025) : random(1.5, 2.35);
        }

        if (length < p.r + enemy.r && enemy.touch <= 0 && p.invulnerable <= 0) {
          const damage = enemy.type === "boss" ? 26 : enemy.type === "tank" ? 20 : 13;
          if (p.shield > 0) p.shield = 0; else p.hp -= damage;
          p.invulnerable = 0.75;
          enemy.touch = 0.8;
          enemy.vx -= dx / length * 180;
          enemy.vy -= dy / length * 180;
          g.shake = 11;
          burst(p.x, p.y, "#ff5c8a", 18, 250);
          sfx("hurt");
          if (p.hp <= 0) { p.hp = 0; endGame(); return; }
        }

        for (let j = g.bullets.length - 1; j >= 0; j -= 1) {
          const bullet = g.bullets[j];
          if (bullet.enemy || dist(bullet, enemy) >= bullet.r + enemy.r) continue;
          enemy.hp -= bullet.damage;
          enemy.flash = 0.07;
          burst(bullet.x, bullet.y, bullet.color, 4, 90);
          if (bullet.pierce > 0) bullet.pierce -= 1; else g.bullets.splice(j, 1);
          if (enemy.hp <= 0) {
            const color = { spark: "#ff4f81", blaster: "#ff9a52", tank: "#ad6cff", splitter: "#50e6a2", boss: "#ff3df2" }[enemy.type];
            burst(enemy.x, enemy.y, color, enemy.type === "boss" ? 55 : 18, enemy.type === "boss" ? 360 : 230);
            g.shake = enemy.type === "boss" ? 18 : 6;
            g.kills += 1;
            g.combo = Math.min(9, g.comboTimer > 0 ? g.combo + 1 : 1);
            g.comboTimer = 2.2;
            g.score += Math.round((enemy.type === "boss" ? 2500 : enemy.type === "tank" ? 260 : 100) * g.combo);
            if (enemy.type === "splitter") {
              for (let child = 0; child < 2; child += 1) {
                const angle = child * Math.PI + Math.random();
                g.enemies.push({
                  x: enemy.x + Math.cos(angle) * 12, y: enemy.y + Math.sin(angle) * 12,
                  vx: Math.cos(angle) * 130, vy: Math.sin(angle) * 130, r: 10,
                  hp: 18 + g.wave * 2, maxHp: 18 + g.wave * 2, speed: 125,
                  type: "spark", shoot: 9, touch: 0, phase: Math.random() * 5, flash: 0,
                });
              }
            }
            if (Math.random() < (enemy.type === "boss" ? 1 : 0.1)) {
              const types: DropType[] = ["heal", "rapid", "shield", "nova"];
              g.drops.push({
                x: enemy.x, y: enemy.y, r: 14,
                type: enemy.type === "boss" ? "nova" : types[Math.floor(Math.random() * types.length)],
                life: 10, spin: 0,
              });
            }
            g.enemies.splice(i, 1);
            sfx("hit");
            break;
          }
        }
      }

      for (let i = g.bullets.length - 1; i >= 0; i -= 1) {
        const bullet = g.bullets[i];
        if (!bullet.enemy || dist(bullet, p) >= bullet.r + p.r || p.invulnerable > 0) continue;
        if (p.shield > 0) p.shield = 0; else p.hp -= bullet.damage;
        p.invulnerable = 0.65;
        g.bullets.splice(i, 1);
        g.shake = 9;
        burst(p.x, p.y, "#ff5c8a", 14, 220);
        sfx("hurt");
        if (p.hp <= 0) { p.hp = 0; endGame(); return; }
      }

      for (let i = g.drops.length - 1; i >= 0; i -= 1) {
        const drop = g.drops[i];
        drop.life -= dt;
        drop.spin += dt * 2.2;
        if (dist(drop, p) < drop.r + p.r + 6) {
          if (drop.type === "heal") p.hp = Math.min(p.maxHp, p.hp + 35);
          if (drop.type === "rapid") p.rapid = 8;
          if (drop.type === "shield") p.shield = 10;
          if (drop.type === "nova") {
            for (const enemy of g.enemies) enemy.hp -= 100;
            burst(p.x, p.y, "#c376ff", 36, 430);
          }
          g.score += 150;
          g.drops.splice(i, 1);
          sfx("pickup");
        } else if (drop.life <= 0) g.drops.splice(i, 1);
      }

      for (let i = g.particles.length - 1; i >= 0; i -= 1) {
        const particle = g.particles[i];
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.vx *= 0.96;
        particle.vy *= 0.96;
        particle.life -= dt;
        if (particle.life <= 0) g.particles.splice(i, 1);
      }
    };

    const frame = (time: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const dt = Math.min(0.033, Math.max(0.001, (time - lastFrameRef.current) / 1000 || 0.016));
      lastFrameRef.current = time;
      if (modeRef.current === "playing") update(dt); else gameRef.current.time += dt * 0.35;
      draw(ctx, gameRef.current);
      if (time - lastHudRef.current > 90) {
        const g = gameRef.current;
        setHud({
          hp: g.player.hp, maxHp: g.player.maxHp, score: g.score, wave: g.wave,
          combo: g.combo, dash: 1 - g.player.dashTimer / g.player.dashCooldown,
          shield: g.player.shield,
        });
        lastHudRef.current = time;
      }
      rafRef.current = requestAnimationFrame(frame);
    };
    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, [burst, endGame, firePlayer, setMode, sfx, spawnEnemy]);

  const stickStart = (kind: "move" | "aim") => (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = event.currentTarget.getBoundingClientRect();
    let x = (event.clientX - (rect.left + rect.width / 2)) / (rect.width * 0.34);
    let y = (event.clientY - (rect.top + rect.height / 2)) / (rect.height * 0.34);
    const length = Math.hypot(x, y);
    if (length > 1) { x /= length; y /= length; }
    if (kind === "move") { moveStickRef.current = { x, y }; setMoveKnob({ x, y }); }
    else { aimStickRef.current = { x, y }; setAimKnob({ x, y }); }
  };

  const stickMove = (kind: "move" | "aim") => (event: React.PointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const rect = event.currentTarget.getBoundingClientRect();
    let x = (event.clientX - (rect.left + rect.width / 2)) / (rect.width * 0.34);
    let y = (event.clientY - (rect.top + rect.height / 2)) / (rect.height * 0.34);
    const length = Math.hypot(x, y);
    if (length > 1) { x /= length; y /= length; }
    if (kind === "move") { moveStickRef.current = { x, y }; setMoveKnob({ x, y }); }
    else { aimStickRef.current = { x, y }; setAimKnob({ x, y }); }
  };

  const stickEnd = (kind: "move" | "aim") => (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (kind === "move") { moveStickRef.current = { x: 0, y: 0 }; setMoveKnob({ x: 0, y: 0 }); }
    else { aimStickRef.current = { x: 0, y: 0 }; setAimKnob({ x: 0, y: 0 }); }
  };

  const toggleMute = () => {
    mutedRef.current = !mutedRef.current;
    setMuted(mutedRef.current);
  };

  return (
    <main className="game-page">
      <div className="game-shell" ref={shellRef}>
        <canvas ref={canvasRef} aria-label="Rift Rush game arena" />

        {(mode === "playing" || mode === "paused" || mode === "upgrade") && (
          <div className="hud" aria-live="polite">
            <div className="hud-left">
              <div className="wave-chip"><Sparkles size={16} /> Wave <strong>{hud.wave}</strong></div>
              <div className="health-wrap">
                <div className="health-label"><Heart size={14} fill="currentColor" /> {Math.ceil(hud.hp)} / {hud.maxHp}</div>
                <div className="health-track"><div className="health-fill" style={{ width: `${clamp(hud.hp / hud.maxHp * 100, 0, 100)}%` }} /></div>
              </div>
            </div>
            <div className="score-box">
              <span>Score</span>
              <strong>{hud.score.toLocaleString()}</strong>
              {hud.combo > 1 && <em>×{hud.combo} COMBO</em>}
            </div>
            <div className="hud-actions">
              {hud.shield > 0 && <div className="power-chip shield-chip"><Shield size={15} /> Shield</div>}
              <button className="icon-button" onClick={toggleMute} aria-label={muted ? "Turn sound on" : "Mute sound"}>{muted ? <VolumeX /> : <Volume2 />}</button>
              <button className="icon-button" onClick={() => setMode(modeRef.current === "paused" ? "playing" : "paused")} aria-label="Pause game"><Pause /></button>
            </div>
          </div>
        )}

        {mode === "playing" && (
          <div className="mobile-controls" aria-label="Touch controls">
            <div className="stick move-stick" onPointerDown={stickStart("move")} onPointerMove={stickMove("move")} onPointerUp={stickEnd("move")} onPointerCancel={stickEnd("move")}>
              <div className="stick-label">MOVE</div>
              <div className="stick-knob" style={{ transform: `translate(${moveKnob.x * 34}px, ${moveKnob.y * 34}px)` }}><Move size={22} /></div>
            </div>
            <button className="dash-button" onPointerDown={(event) => { event.preventDefault(); dash(); }} style={{ "--dash-fill": `${clamp(hud.dash, 0, 1) * 100}%` } as React.CSSProperties}><Zap size={22} /><span>DASH</span></button>
            <div className="stick aim-stick" onPointerDown={stickStart("aim")} onPointerMove={stickMove("aim")} onPointerUp={stickEnd("aim")} onPointerCancel={stickEnd("aim")}>
              <div className="stick-label">AIM + FIRE</div>
              <div className="stick-knob aim-knob" style={{ transform: `translate(${aimKnob.x * 34}px, ${aimKnob.y * 34}px)` }}><Crosshair size={22} /></div>
            </div>
          </div>
        )}

        {mode === "menu" && (
          <section className="overlay menu-overlay">
            <div className="brand-mark"><span>R</span></div>
            <p className="eyebrow">NEON SURVIVAL ARENA</p>
            <h1>RIFT <span>RUSH</span></h1>
            {lastRun ? (
              <div className="last-run-card">
                <span>RUN COMPLETE</span>
                <strong>{lastRun.score.toLocaleString()} points</strong>
                <small>Wave {lastRun.wave} • <b>+{lastRun.earned} Rift Shards</b></small>
              </div>
            ) : (
              <p className="tagline">Blast the swarm. Build wild upgrades. Survive the rift.</p>
            )}
            <div className="shard-balance"><Gem size={17} fill="currentColor" /> {shards.toLocaleString()} RIFT SHARDS</div>
            <div className="menu-actions">
              <button className="primary-button" onClick={startGame}>
                {lastRun ? <RotateCcw size={21} /> : <Play size={22} fill="currentColor" />}
                {lastRun ? "RESTART" : "PLAY NOW"}
              </button>
              <button className="secondary-button upgrades-button" onClick={() => setMode("permanent")}>
                <Gem size={19} /> PERMANENT UPGRADES
              </button>
            </div>
            <div className="controls-card">
              <div><Move size={19} /><span><b>Move</b> WASD / arrows</span></div>
              <div><Crosshair size={19} /><span><b>Shoot</b> aim + hold click</span></div>
              <div><Zap size={19} /><span><b>Dash</b> Shift or E</span></div>
            </div>
            <p className="touch-note">Phone controls appear when the game starts</p>
            {highScore > 0 && <p className="best-score">BEST SCORE&nbsp; {highScore.toLocaleString()}</p>}
          </section>
        )}

        {mode === "permanent" && (
          <section className="overlay permanent-overlay">
            <button className="back-button" onClick={() => setMode("menu")}><ArrowLeft size={19} /> MAIN MENU</button>
            <div className="shard-bank"><Gem size={20} fill="currentColor" /><span>RIFT SHARDS</span><strong>{shards.toLocaleString()}</strong></div>
            <p className="eyebrow">YOUR POWER STAYS FOREVER</p>
            <h2>PERMANENT UPGRADES</h2>
            <p>Every upgrade applies at the start of all future runs.</p>
            <div className="permanent-grid">
              {PERMANENT_UPGRADES.map((upgrade) => {
                const level = permanent[upgrade.id];
                const maxed = level >= upgrade.maxLevel;
                const cost = permanentCost(upgrade, level);
                const affordable = shards >= cost;
                return (
                  <button
                    className="permanent-card"
                    key={upgrade.id}
                    onClick={() => buyPermanentUpgrade(upgrade)}
                    disabled={maxed || !affordable}
                    style={{ "--upgrade": upgrade.color } as React.CSSProperties}
                  >
                    <span className="permanent-icon">{upgrade.icon}</span>
                    <span className="permanent-copy">
                      <strong>{upgrade.name}</strong>
                      <small>{upgrade.description}</small>
                      <span className="level-pips" aria-label={`Level ${level} of ${upgrade.maxLevel}`}>
                        {Array.from({ length: upgrade.maxLevel }, (_, index) => <i className={index < level ? "filled" : ""} key={index} />)}
                      </span>
                    </span>
                    <span className={`buy-cost ${maxed ? "maxed" : ""}`}>
                      {maxed ? "MAX" : <><Gem size={14} fill="currentColor" /> {cost}</>}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {mode === "paused" && (
          <section className="overlay compact-overlay">
            <p className="eyebrow">BREATHER TIME</p>
            <h2>PAUSED</h2>
            <button className="primary-button" onClick={() => setMode("playing")}><Play size={20} fill="currentColor" /> RESUME</button>
            <button className="secondary-button" onClick={startGame}><RotateCcw size={18} /> RESTART RUN</button>
          </section>
        )}

        {mode === "upgrade" && (
          <section className="overlay upgrade-overlay">
            <div className="cleared-badge">WAVE {hud.wave} CLEARED</div>
            <h2>CHOOSE AN UPGRADE</h2>
            <p>Pick one boost for the rest of this run.</p>
            <div className="upgrade-grid">
              {choices.map((upgrade, index) => (
                <button className="upgrade-card" key={upgrade.id} onClick={() => chooseUpgrade(upgrade)} style={{ "--upgrade": upgrade.color } as React.CSSProperties}>
                  <span className="key-hint">{index + 1}</span>
                  <span className="upgrade-icon">{upgrade.icon}</span>
                  <strong>{upgrade.name}</strong>
                  <small>{upgrade.description}</small>
                </button>
              ))}
            </div>
            <p className="next-boss">{(hud.wave + 1) % 5 === 0 ? "⚠ BOSS INCOMING NEXT WAVE" : `Boss arrives on wave ${Math.ceil((hud.wave + 1) / 5) * 5}`}</p>
          </section>
        )}

      </div>
      <footer>Rift Rush • Survive as long as you can</footer>
    </main>
  );
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
