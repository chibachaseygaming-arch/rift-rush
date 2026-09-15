"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  Crosshair,
  Download,
  Gem,
  Heart,
  Move,
  Palette,
  Pause,
  Play,
  RotateCcw,
  Save,
  Shield,
  Sparkles,
  Upload,
  Volume2,
  VolumeX,
  Zap,
} from "lucide-react";

type Mode = "menu" | "playing" | "paused" | "upgrade" | "permanent" | "customize";
type ShipStyleId = string;
type EnemyType = "spark" | "blaster" | "tank" | "splitter" | "boss";
type DropType = "heal" | "rapid" | "shield" | "nova";
type Vec = { x: number; y: number };
type Bullet = Vec & { vx: number; vy: number; r: number; life: number; damage: number; pierce: number; enemy: boolean; color: string };
type Enemy = Vec & { vx: number; vy: number; r: number; hp: number; maxHp: number; speed: number; type: EnemyType; shoot: number; touch: number; phase: number; flash: number };
type Particle = Vec & { vx: number; vy: number; life: number; maxLife: number; size: number; color: string };
type Drop = Vec & { type: DropType; r: number; life: number; spin: number };
type Star = Vec & { size: number; alpha: number };
type UpgradeKind = "damage" | "rapid" | "speed" | "health" | "multi" | "pierce" | "dash" | "velocity" | "accuracy" | "shield" | "heal";
type Upgrade = { id: string; kind: UpgradeKind; power: number; name: string; description: string; icon: string; color: string };
type PermanentLevels = {
  damage: number;
  health: number;
  speed: number;
  fireRate: number;
  dash: number;
  accuracy: number;
  bulletSpeed: number;
  multishot: number;
  pierce: number;
  shield: number;
};
type PermanentUpgrade = {
  id: string;
  stat: keyof PermanentLevels;
  tier: number;
  name: string;
  description: string;
  icon: string;
  color: string;
  cost: number;
};
type LastRun = { score: number; wave: number; earned: number };
type ShipStyle = { id: ShipStyleId; shape: string; name: string; description: string; icon: string; body: string; wing: string; glass: string; engine: string };

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

const UPGRADE_FAMILIES: Array<{ id: string; name: string; kind: UpgradeKind; icon: string; color: string; base: number; step: number }> = [
  { id: "heavy", name: "Heavy Shots", kind: "damage", icon: "◆", color: "#ff5c8a", base: 0.12, step: 0.025 },
  { id: "reactor", name: "Rift Reactor", kind: "damage", icon: "◇", color: "#ff7ca4", base: 0.1, step: 0.03 },
  { id: "overclock", name: "Overclock", kind: "rapid", icon: "⚡", color: "#ffe15c", base: 0.08, step: 0.018 },
  { id: "pulse", name: "Pulse Accelerator", kind: "rapid", icon: "≋", color: "#ffc45c", base: 0.07, step: 0.02 },
  { id: "turbo", name: "Turbo Thrusters", kind: "speed", icon: "➜", color: "#5cffa6", base: 0.07, step: 0.018 },
  { id: "phase-step", name: "Phase Skates", kind: "speed", icon: "»", color: "#55ffd8", base: 0.06, step: 0.02 },
  { id: "heart", name: "Heart Core", kind: "health", icon: "♥", color: "#ff668f", base: 14, step: 5 },
  { id: "nano-hull", name: "Nano Hull", kind: "health", icon: "⬡", color: "#ff8aa8", base: 12, step: 6 },
  { id: "split", name: "Split Beam", kind: "multi", icon: "✦", color: "#cb78ff", base: 1, step: 0.45 },
  { id: "prism", name: "Prism Volley", kind: "multi", icon: "✧", color: "#e38cff", base: 1, step: 0.5 },
  { id: "phase-rounds", name: "Phase Rounds", kind: "pierce", icon: "◎", color: "#61e8ff", base: 1, step: 0.42 },
  { id: "ghost", name: "Ghost Ammunition", kind: "pierce", icon: "◉", color: "#89f4ff", base: 1, step: 0.5 },
  { id: "blink", name: "Blink Drive", kind: "dash", icon: "◈", color: "#8ca7ff", base: 0.08, step: 0.018 },
  { id: "warp", name: "Warp Capacitor", kind: "dash", icon: "⬖", color: "#a593ff", base: 0.07, step: 0.02 },
  { id: "hyper", name: "Hyper Rounds", kind: "velocity", icon: "●", color: "#ff9b55", base: 0.1, step: 0.025 },
  { id: "comet", name: "Comet Cannon", kind: "velocity", icon: "◌", color: "#ffbd70", base: 0.09, step: 0.028 },
  { id: "precision", name: "Precision Sight", kind: "accuracy", icon: "⌖", color: "#79f7d4", base: 0.1, step: 0.025 },
  { id: "oracle", name: "Oracle Targeting", kind: "accuracy", icon: "⊙", color: "#9effe8", base: 0.09, step: 0.028 },
  { id: "shield-burst", name: "Shield Burst", kind: "shield", icon: "⬢", color: "#75c8ff", base: 3, step: 1.5 },
  { id: "repair", name: "Emergency Repair", kind: "heal", icon: "+", color: "#65ff94", base: 18, step: 9 },
];

const upgradeDescription = (kind: UpgradeKind, power: number) => {
  if (["damage", "rapid", "speed", "dash", "velocity", "accuracy"].includes(kind)) return `+${Math.round(power * 100)}% ${kind === "rapid" ? "firing speed" : kind === "dash" ? "dash recharge" : kind === "velocity" ? "bullet speed" : kind === "accuracy" ? "shot accuracy" : kind}`;
  if (kind === "health") return `+${Math.round(power)} max health and heal`;
  if (kind === "multi") return `+${Math.ceil(power)} projectiles per shot`;
  if (kind === "pierce") return `Shots pierce +${Math.ceil(power)} enemies`;
  if (kind === "shield") return `${power.toFixed(1)} seconds of shield power`;
  return `Repair ${Math.round(power)} health`;
};

const UPGRADES: Upgrade[] = UPGRADE_FAMILIES.flatMap((family) =>
  Array.from({ length: 5 }, (_, index) => {
    const power = family.base + family.step * index;
    return { id: `${family.id}-${index + 1}`, kind: family.kind, power, name: `${family.name} MK ${index + 1}`, description: upgradeDescription(family.kind, power), icon: family.icon, color: family.color };
  }),
);

const EMPTY_PERMANENT: PermanentLevels = {
  damage: 0,
  health: 0,
  speed: 0,
  fireRate: 0,
  dash: 0,
  accuracy: 0,
  bulletSpeed: 0,
  multishot: 0,
  pierce: 0,
  shield: 0,
};

const PERMANENT_FAMILIES: Array<Omit<PermanentUpgrade, "id" | "tier" | "name" | "cost"> & { id: string; name: string; baseCost: number }> = [
  { id: "power-core", stat: "damage", name: "Power Core", description: "+10% starting damage", icon: "◆", color: "#ff5c8a", baseCost: 10 },
  { id: "rift-amplifier", stat: "damage", name: "Rift Amplifier", description: "+10% starting damage", icon: "◇", color: "#ff7ca4", baseCost: 16 },
  { id: "armor-core", stat: "health", name: "Armor Core", description: "+12 starting health", icon: "♥", color: "#ff8aa8", baseCost: 9 },
  { id: "nano-plating", stat: "health", name: "Nano Plating", description: "+12 starting health", icon: "⬡", color: "#ff668f", baseCost: 15 },
  { id: "turbo-drive", stat: "speed", name: "Turbo Drive", description: "+6% movement speed", icon: "➜", color: "#5cffa6", baseCost: 10 },
  { id: "phase-skates", stat: "speed", name: "Phase Skates", description: "+6% movement speed", icon: "»", color: "#55ffd8", baseCost: 16 },
  { id: "rapid-trigger", stat: "fireRate", name: "Rapid Trigger", description: "+6% firing speed", icon: "⚡", color: "#ffe15c", baseCost: 12 },
  { id: "pulse-loader", stat: "fireRate", name: "Pulse Loader", description: "+6% firing speed", icon: "≋", color: "#ffc45c", baseCost: 18 },
  { id: "blink-engine", stat: "dash", name: "Blink Engine", description: "+6% dash recharge", icon: "◈", color: "#8ca7ff", baseCost: 12 },
  { id: "warp-cell", stat: "dash", name: "Warp Cell", description: "+6% dash recharge", icon: "⬖", color: "#a593ff", baseCost: 18 },
  { id: "targeting-core", stat: "accuracy", name: "Targeting Core", description: "+12% starting accuracy", icon: "⌖", color: "#79f7d4", baseCost: 11 },
  { id: "oracle-lens", stat: "accuracy", name: "Oracle Lens", description: "+12% starting accuracy", icon: "⊙", color: "#9effe8", baseCost: 17 },
  { id: "hyper-barrel", stat: "bulletSpeed", name: "Hyper Barrel", description: "+8% bullet speed", icon: "●", color: "#ff9b55", baseCost: 11 },
  { id: "comet-chamber", stat: "bulletSpeed", name: "Comet Chamber", description: "+8% bullet speed", icon: "◌", color: "#ffbd70", baseCost: 17 },
  { id: "split-array", stat: "multishot", name: "Split Array", description: "+1 starting projectile", icon: "✦", color: "#cb78ff", baseCost: 24 },
  { id: "prism-array", stat: "multishot", name: "Prism Array", description: "+1 starting projectile", icon: "✧", color: "#e38cff", baseCost: 32 },
  { id: "phase-bore", stat: "pierce", name: "Phase Bore", description: "+1 starting pierce", icon: "◎", color: "#61e8ff", baseCost: 20 },
  { id: "ghost-bore", stat: "pierce", name: "Ghost Bore", description: "+1 starting pierce", icon: "◉", color: "#89f4ff", baseCost: 28 },
  { id: "shield-bank", stat: "shield", name: "Shield Bank", description: "+1 second starting shield", icon: "⬢", color: "#75c8ff", baseCost: 18 },
  { id: "aegis-bank", stat: "shield", name: "Aegis Bank", description: "+1 second starting shield", icon: "⬣", color: "#52a8ff", baseCost: 26 },
];

const PERMANENT_UPGRADES: PermanentUpgrade[] = PERMANENT_FAMILIES.flatMap((family) =>
  Array.from({ length: 2500 }, (_, index) => ({
    id: `${family.id}-${index + 1}`,
    stat: family.stat,
    tier: index + 1,
    name: `${family.name} MK ${index + 1}`,
    description: family.description,
    icon: family.icon,
    color: family.color,
    cost: Math.round(family.baseCost * (1 + index * 0.8)),
  })),
);

const resolvePermanentPurchases = (value: unknown): Record<string, boolean> => {
  if (!value || typeof value !== "object") return {};
  const raw = value as Record<string, unknown>;
  return Object.fromEntries(PERMANENT_UPGRADES.filter((upgrade) => raw[upgrade.id] === true).map((upgrade) => [upgrade.id, true]));
};

const SHIP_CHASSIS = [
  { id: "striker", name: "Striker", description: "balanced interceptor", icon: "◆" },
  { id: "phantom", name: "Phantom", description: "slim stealth fighter", icon: "◢" },
  { id: "nova", name: "Nova", description: "long-nose racer", icon: "✦" },
  { id: "bulwark", name: "Bulwark", description: "wide armored ship", icon: "⬢" },
  { id: "comet", name: "Comet", description: "sharp speed craft", icon: "➤" },
  { id: "viper", name: "Viper", description: "fork-wing hunter", icon: "⌁" },
  { id: "atlas", name: "Atlas", description: "heavy rift cruiser", icon: "⬡" },
  { id: "sparrow", name: "Sparrow", description: "tiny agile scout", icon: "➹" },
  { id: "eclipse", name: "Eclipse", description: "crescent void craft", icon: "◐" },
  { id: "titan", name: "Titan", description: "massive battle frame", icon: "▰" },
];

const SHIP_PALETTES = [
  { id: "neon", name: "Neon Blue", body: "#718cff", wing: "#405dd9", glass: "#baf8ff", engine: "#61e8ff" },
  { id: "void", name: "Void Purple", body: "#b06cff", wing: "#5a2f94", glass: "#ffd6ff", engine: "#df7dff" },
  { id: "solar", name: "Solar Gold", body: "#ffb347", wing: "#d45137", glass: "#fff4a8", engine: "#ffe15c" },
  { id: "aegis", name: "Aegis Green", body: "#55d6a2", wing: "#187969", glass: "#d9fff5", engine: "#7dffcf" },
  { id: "crimson", name: "Crimson Flare", body: "#ff4f6f", wing: "#8f1938", glass: "#ffd7df", engine: "#ff879c" },
  { id: "arctic", name: "Arctic Ice", body: "#a9ddff", wing: "#397aa8", glass: "#ffffff", engine: "#8ff8ff" },
  { id: "toxic", name: "Toxic Lime", body: "#adff4f", wing: "#4f851c", glass: "#efffcf", engine: "#d5ff72" },
  { id: "ember", name: "Ember Orange", body: "#ff784f", wing: "#9b351e", glass: "#ffe0b5", engine: "#ffb05c" },
  { id: "royal", name: "Royal Pink", body: "#ff68cc", wing: "#8e2872", glass: "#ffe0f7", engine: "#ff9de0" },
  { id: "mono", name: "Chrome Mono", body: "#cbd3df", wing: "#596273", glass: "#eaffff", engine: "#ffffff" },
];

const SHIP_STYLES: ShipStyle[] = SHIP_CHASSIS.flatMap((chassis) => SHIP_PALETTES.map((palette) => ({
  id: `${chassis.id}-${palette.id}`,
  shape: chassis.id,
  name: `${palette.name} ${chassis.name}`,
  description: chassis.description,
  icon: chassis.icon,
  body: palette.body,
  wing: palette.wing,
  glass: palette.glass,
  engine: palette.engine,
})));

const DEFAULT_SHIP_ID = SHIP_STYLES[0].id;
const resolveShipId = (value: unknown): ShipStyleId => {
  if (typeof value !== "string") return DEFAULT_SHIP_ID;
  if (SHIP_STYLES.some((ship) => ship.id === value)) return value;
  if (SHIP_CHASSIS.some((chassis) => chassis.id === value)) return `${value}-neon`;
  return DEFAULT_SHIP_ID;
};

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
const random = (min: number, max: number) => min + Math.random() * (max - min);
const chooseThree = () => [...UPGRADES].sort(() => Math.random() - 0.5).slice(0, 3);
function newGame(width: number, height: number, permanent: PermanentLevels = EMPTY_PERMANENT, rebirths = 0): GameState {
  const strength = 1 + rebirths * 0.5;
  const maxHp = Math.round((100 + permanent.health * 12) * strength);
  return {
    width,
    height,
    time: 0,
    player: {
      x: width / 2, y: height / 2, r: 15, hp: maxHp, maxHp, speed: 260 * (1 + permanent.speed * 0.06),
      angle: -Math.PI / 2, fireRate: 0.19 * Math.max(0.1, Math.pow(0.94, permanent.fireRate)), fireTimer: 0, damage: 24 * (1 + permanent.damage * 0.1) * strength,
      bulletSpeed: 720 * (1 + permanent.bulletSpeed * 0.08), multishot: Math.min(20, 1 + permanent.multishot),
      pierce: Math.min(30, permanent.pierce), accuracy: Math.max(0.03, Math.pow(0.88, permanent.accuracy)), dashTimer: 0,
      dashCooldown: 1.8 * Math.max(0.15, Math.pow(0.94, permanent.dash)), dashTime: 0, invulnerable: 0,
      shield: permanent.shield, rapid: 0,
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
  const rebirthRef = useRef(0);
  const [rebirths, setRebirths] = useState(0);
  const [shopCategory, setShopCategory] = useState("All");
  const [shopSearch, setShopSearch] = useState("");
  const pulseReadyRef = useRef(0);
  const [pulseSeconds, setPulseSeconds] = useState(0);
  const [shipSearch, setShipSearch] = useState("");
  const [rebirthConfirm, setRebirthConfirm] = useState(false);
  const permanentRef = useRef<PermanentLevels>({ ...EMPTY_PERMANENT });
  const permanentPurchasesRef = useRef<Record<string, boolean>>({});
  const shipStyleRef = useRef<ShipStyleId>(DEFAULT_SHIP_ID);
  const importInputRef = useRef<HTMLInputElement>(null);
  const lastHudRef = useRef(0);
  const lastFrameRef = useRef(0);
  const rafRef = useRef(0);

  const [mode, setModeState] = useState<Mode>("menu");
  const [muted, setMuted] = useState(false);
  const [highScore, setHighScore] = useState(0);
  const [shards, setShards] = useState(0);
  const [permanent, setPermanent] = useState<PermanentLevels>({ ...EMPTY_PERMANENT });
  const [permanentPurchases, setPermanentPurchases] = useState<Record<string, boolean>>({});
  const [selectedShip, setSelectedShip] = useState<ShipStyleId>(DEFAULT_SHIP_ID);
  const [saveStatus, setSaveStatus] = useState("Progress saves automatically");
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

  const pulse = useCallback(() => {
    if (modeRef.current !== "playing") return;
    const g = gameRef.current;
    if (g.time < pulseReadyRef.current) return;
    pulseReadyRef.current = g.time + 12;
    g.bullets = g.bullets.filter(b => !b.enemy || dist(b, g.player) > 240);
    for (let i = 0; i < 24; i++) {
      const angle = i / 24 * Math.PI * 2;
      g.bullets.push({x:g.player.x,y:g.player.y,vx:Math.cos(angle)*500,vy:Math.sin(angle)*500,r:7,life:0.6,damage:g.player.damage*2,pierce:3,enemy:false,color:"#ffd16a"});
    }
    g.player.invulnerable = Math.max(g.player.invulnerable, 0.5);
    burst(g.player.x, g.player.y, "#ffd16a", 30, 350);
    sfx("dash");
  }, [burst,sfx]);

  const startGame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    pulseReadyRef.current = 0;
    setPulseSeconds(0);
    gameRef.current = newGame(rect.width, rect.height, permanentRef.current, rebirthRef.current);
    const player = gameRef.current.player;
    pointerRef.current = { x: rect.width * 0.7, y: rect.height * 0.5, firing: false };
    setHud({ hp: player.hp, maxHp: player.maxHp, score: 0, wave: 1, combo: 1, dash: 1, shield: 0 });
    setMode("playing");
    audioRef.current?.resume();
  }, [setMode]);

  const chooseUpgrade = useCallback((upgrade: Upgrade) => {
    const g = gameRef.current;
    const p = g.player;
    if (upgrade.kind === "damage") p.damage *= 1 + upgrade.power;
    if (upgrade.kind === "rapid") p.fireRate = Math.max(0.045, p.fireRate * (1 - upgrade.power));
    if (upgrade.kind === "speed") p.speed *= 1 + upgrade.power;
    if (upgrade.kind === "health") {
      const health = Math.round(upgrade.power);
      p.maxHp += health;
      p.hp = Math.min(p.maxHp, p.hp + health);
    }
    if (upgrade.kind === "multi") p.multishot = Math.min(20, p.multishot + Math.ceil(upgrade.power));
    if (upgrade.kind === "pierce") p.pierce += Math.ceil(upgrade.power);
    if (upgrade.kind === "dash") p.dashCooldown = Math.max(0.35, p.dashCooldown * (1 - upgrade.power));
    if (upgrade.kind === "velocity") p.bulletSpeed *= 1 + upgrade.power;
    if (upgrade.kind === "accuracy") p.accuracy = Math.max(0.08, p.accuracy * (1 - upgrade.power));
    if (upgrade.kind === "shield") p.shield = Math.max(p.shield, upgrade.power);
    if (upgrade.kind === "heal") p.hp = Math.min(p.maxHp, p.hp + upgrade.power);
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
    const earned = Math.floor(Math.max(2, Math.floor(g.score / 650) + g.wave) * (1 + rebirthRef.current * 0.25));
    const nextShards = shardsRef.current + earned;
    shardsRef.current = nextShards;
    setShards(nextShards);
    localStorage.setItem("rift-rush-shards", String(nextShards));
    setLastRun({ score: g.score, wave: g.wave, earned });
    sfx("over");
    setMode("menu");
  }, [setMode, sfx]);

  useEffect(() => {
    rebirthRef.current = clamp(Math.floor(Number(localStorage.getItem("rift-rush-rebirths")) || 0), 0, 2500);
    setRebirths(rebirthRef.current);
    setHighScore(Number(localStorage.getItem("rift-rush-high-score") || 0));
    const savedShards = Math.max(0, Number(localStorage.getItem("rift-rush-shards") || 0));
    shardsRef.current = Number.isFinite(savedShards) ? savedShards : 0;
    setShards(shardsRef.current);
    try {
      const savedPermanent = JSON.parse(localStorage.getItem("rift-rush-permanent") || "{}") as Partial<PermanentLevels>;
      const loaded = { ...EMPTY_PERMANENT };
      for (const key of Object.keys(loaded) as Array<keyof PermanentLevels>) {
        const value = Number(savedPermanent[key] ?? 0);
        loaded[key] = clamp(Number.isFinite(value) ? Math.floor(value) : 0, 0, 10000);
      }
      permanentRef.current = loaded;
      setPermanent(loaded);
    } catch {
      permanentRef.current = { ...EMPTY_PERMANENT };
    }
    try {
      const loadedPurchases = resolvePermanentPurchases(JSON.parse(localStorage.getItem("rift-rush-permanent-purchases") || "{}"));
      permanentPurchasesRef.current = loadedPurchases;
      setPermanentPurchases(loadedPurchases);
    } catch {
      permanentPurchasesRef.current = {};
    }
    const savedShip = localStorage.getItem("rift-rush-ship");
    const nextShip = resolveShipId(savedShip);
    shipStyleRef.current = nextShip;
    setSelectedShip(nextShip);
    localStorage.setItem("rift-rush-ship", nextShip);
  }, []);

  const saveProgress = useCallback(() => {
    localStorage.setItem("rift-rush-high-score", String(highScore));
    localStorage.setItem("rift-rush-shards", String(shardsRef.current));
    localStorage.setItem("rift-rush-permanent", JSON.stringify(permanentRef.current));
    localStorage.setItem("rift-rush-permanent-purchases", JSON.stringify(permanentPurchasesRef.current));
    localStorage.setItem("rift-rush-ship", shipStyleRef.current);
    setSaveStatus("Saved on this device ✓");
  }, [highScore]);

  const chooseShip = useCallback((ship: ShipStyleId) => {
    shipStyleRef.current = ship;
    setSelectedShip(ship);
    localStorage.setItem("rift-rush-ship", ship);
    setSaveStatus("Ship selected and saved ✓");
    sfx("pickup");
  }, [sfx]);

  const exportProgress = useCallback(() => {
    const data = {
      format: "rift-rush-save",
      version: 1,
      rebirths: rebirthRef.current,
      highScore,
      shards: shardsRef.current,
      permanent: permanentRef.current,
      permanentPurchases: permanentPurchasesRef.current,
      ship: shipStyleRef.current,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "rift-rush-save.json";
    link.click();
    URL.revokeObjectURL(url);
    setSaveStatus("Save file exported ✓");
  }, [highScore]);

  const importProgress = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const raw = JSON.parse(await file.text()) as Record<string, unknown>;
      if (raw.format !== "rift-rush-save" || raw.version !== 1) throw new Error("Invalid save");
      const nextHighScore = clamp(Math.floor(Number(raw.highScore) || 0), 0, 999999999);
      const nextShards = clamp(Math.floor(Number(raw.shards) || 0), 0, 999999999);
      const rawPermanent = raw.permanent && typeof raw.permanent === "object" ? raw.permanent as Partial<PermanentLevels> : {};
      const nextPermanent = { ...EMPTY_PERMANENT };
      for (const key of Object.keys(nextPermanent) as Array<keyof PermanentLevels>) {
        nextPermanent[key] = clamp(Math.floor(Number(rawPermanent[key]) || 0), 0, 20);
      }
      const nextPurchases = resolvePermanentPurchases(raw.permanentPurchases);
      const nextRebirths = clamp(Math.floor(Number(raw.rebirths)) || 0, 0, 2500);
      rebirthRef.current = nextRebirths;
      setRebirths(nextRebirths);
      localStorage.setItem("rift-rush-rebirths", String(nextRebirths));
      const nextShip = resolveShipId(raw.ship);
      setHighScore(nextHighScore);
      shardsRef.current = nextShards;
      setShards(nextShards);
      permanentRef.current = nextPermanent;
      setPermanent(nextPermanent);
      permanentPurchasesRef.current = nextPurchases;
      setPermanentPurchases(nextPurchases);
      shipStyleRef.current = nextShip;
      setSelectedShip(nextShip);
      localStorage.setItem("rift-rush-high-score", String(nextHighScore));
      localStorage.setItem("rift-rush-shards", String(nextShards));
      localStorage.setItem("rift-rush-permanent", JSON.stringify(nextPermanent));
      localStorage.setItem("rift-rush-permanent-purchases", JSON.stringify(nextPurchases));
      localStorage.setItem("rift-rush-ship", nextShip);
      setSaveStatus("Save imported successfully ✓");
      sfx("pickup");
    } catch {
      setSaveStatus("That file is not a Rift Rush save");
    } finally {
      event.target.value = "";
    }
  }, [sfx]);

  const rebirthCost = 100 * Math.pow(5, rebirths);
  const doRebirth = () => {
    const cost = 100 * Math.pow(5, rebirthRef.current);
    if (shardsRef.current < cost || rebirthRef.current >= 2500) return;
    rebirthRef.current += 1;
    shardsRef.current = 0;
    setRebirths(rebirthRef.current);
    setShards(0);
    setRebirthConfirm(false);
    localStorage.setItem("rift-rush-rebirths", String(rebirthRef.current));
    localStorage.setItem("rift-rush-shards", "0");
    setSaveStatus("Rebirth complete! Upgrades and skins kept.");
    sfx("pickup");
  };

  const buyPermanentUpgrade = useCallback((upgrade: PermanentUpgrade) => {
    if (permanentPurchasesRef.current[upgrade.id]) return;
    if (upgrade.tier > 1 && rebirthRef.current < upgrade.tier) return;
    const previous = upgrade.id.replace(/-\d+$/, `-${upgrade.tier - 1}`);
    if (upgrade.tier > 1 && !permanentPurchasesRef.current[previous]) return;
    if (shardsRef.current < upgrade.cost) return;
    const nextShards = shardsRef.current - upgrade.cost;
    const nextPermanent = {
      ...permanentRef.current,
      [upgrade.stat]: permanentRef.current[upgrade.stat] + 1,
    };
    const nextPurchases = { ...permanentPurchasesRef.current, [upgrade.id]: true };
    shardsRef.current = nextShards;
    permanentRef.current = nextPermanent;
    permanentPurchasesRef.current = nextPurchases;
    setShards(nextShards);
    setPermanent(nextPermanent);
    setPermanentPurchases(nextPurchases);
    localStorage.setItem("rift-rush-shards", String(nextShards));
    localStorage.setItem("rift-rush-permanent", JSON.stringify(nextPermanent));
    localStorage.setItem("rift-rush-permanent-purchases", JSON.stringify(nextPurchases));
    sfx("pickup");
  }, [sfx]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      keysRef.current[event.key.toLowerCase()] = true;
      if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(event.key.toLowerCase())) event.preventDefault();
      if ((event.key === "Shift" || event.key.toLowerCase() === "e") && !event.repeat) dash();
      if (event.key.toLowerCase() === "q" && !event.repeat) pulse();
      if (event.key.toLowerCase() === "p" || event.key === "Escape") {
        if (modeRef.current === "playing") setMode("paused");
        else if (modeRef.current === "paused") setMode("playing");
      }
      if (event.key === " " && modeRef.current === "menu") startGame();
    };
    const onKeyUp = (event: KeyboardEvent) => { keysRef.current[event.key.toLowerCase()] = false; };
    window.addEventListener("keydown", onKeyDown, { passive: false });
    const releaseControls = () => { keysRef.current = {}; pointerRef.current.firing = false; moveStickRef.current = {x: 0, y: 0}; aimStickRef.current = {x: 0, y: 0}; if (modeRef.current === "playing") setMode("paused"); };
    window.addEventListener("blur", releaseControls);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", releaseControls);
    };
  }, [dash, pulse, setMode, startGame]);

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

      // Rotating orbital arena rings, kept behind gameplay.
      ctx.save();
      ctx.translate(g.width / 2, g.height / 2);
      ctx.rotate(g.time * 0.025);
      for (let ring = 0; ring < 3; ring++) {
        const radius = Math.min(g.width, g.height) * (0.22 + ring * 0.15);
        ctx.strokeStyle = ["#50d5e922", "#8b70ff22", "#50d5e914"][ring];
        ctx.lineWidth = ring === 1 ? 12 : 2;
        ctx.setLineDash(ring === 1 ? [2, 22] : [90, 35]);
        ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
      ctx.strokeStyle = "#60e8ff30"; ctx.lineWidth = 2;
      ctx.strokeRect(12, 12, g.width - 24, g.height - 24);
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
      const shipStyle = SHIP_STYLES.find((ship) => ship.id === shipStyleRef.current) ?? SHIP_STYLES[0];
      const wingSpan = shipStyle.shape === "titan" ? 29 : ["bulwark", "atlas"].includes(shipStyle.shape) ? 27 : ["phantom", "sparrow"].includes(shipStyle.shape) ? 17 : 22;
      const noseLength = ["nova", "comet"].includes(shipStyle.shape) ? 31 : ["bulwark", "atlas", "titan"].includes(shipStyle.shape) ? 23 : 27;
      ctx.shadowColor = p.invulnerable > 0 ? "#ffffff" : shipStyle.body;

      // Twin engine flames make the rear of the ship instantly readable.
      const flamePulse = 5 + Math.sin(g.time * 24) * 2;
      ctx.fillStyle = p.rapid > 0 ? "#ffe15c" : shipStyle.engine;
      for (const engineY of [-8, 8]) {
        ctx.beginPath();
        ctx.moveTo(-15, engineY - 3);
        ctx.lineTo(-27 - flamePulse, engineY);
        ctx.lineTo(-15, engineY + 3);
        ctx.closePath();
        ctx.fill();
      }

      // Wide swept wings and tail fins give the player a clear spaceship silhouette.
      ctx.fillStyle = shipStyle.wing;
      ctx.strokeStyle = "rgba(190,226,255,.9)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(8, -5);
      ctx.lineTo(-7, -wingSpan);
      ctx.lineTo(-13, -wingSpan + 1);
      ctx.lineTo(-9, -7);
      ctx.lineTo(-17, -12);
      ctx.lineTo(-17, -5);
      ctx.lineTo(-8, 0);
      ctx.lineTo(-17, 5);
      ctx.lineTo(-17, 12);
      ctx.lineTo(-9, 7);
      ctx.lineTo(-13, wingSpan - 1);
      ctx.lineTo(-7, wingSpan);
      ctx.lineTo(8, 5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Solid central fuselage with a pointed nose.
      ctx.fillStyle = p.invulnerable > 0 && Math.floor(g.time * 20) % 2 ? "#ffffff" : shipStyle.body;
      ctx.beginPath();
      ctx.moveTo(noseLength, 0);
      ctx.lineTo(8, -8);
      ctx.lineTo(-15, -6);
      ctx.lineTo(-18, 0);
      ctx.lineTo(-15, 6);
      ctx.lineTo(8, 8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Bright glass cockpit and two visible engine pods finish the ship shape.
      ctx.shadowBlur = 12;
      ctx.shadowColor = shipStyle.engine;
      ctx.fillStyle = shipStyle.glass;
      ctx.beginPath();
      ctx.ellipse(8, 0, 7, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#143d75";
      ctx.lineWidth = 1.25;
      ctx.stroke();
      ctx.shadowBlur = 6;
      for (const engineY of [-8, 8]) {
        ctx.fillStyle = "#182452";
        ctx.fillRect(-17, engineY - 3, 8, 6);
        ctx.strokeStyle = shipStyle.engine;
        ctx.strokeRect(-17, engineY - 3, 8, 6);
      }
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
            g.combo = g.comboTimer > 0 ? g.combo + 1 : 1;
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

      if (g.particles.length > 600) g.particles.splice(0, g.particles.length - 600);
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
        setPulseSeconds(Math.ceil(Math.max(0, pulseReadyRef.current - g.time)));
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
              {hud.combo > 1 && <><em>×{hud.combo} COMBO</em><div className="combo-track"><i style={{width: `${gameRef.current.comboTimer / 2.2 * 100}%`}} /></div></>}
            </div>
            <div className="hud-actions">
              {hud.shield > 0 && <div className="power-chip shield-chip"><Shield size={15} /> Shield</div>}
              <button className="icon-button" onClick={toggleMute} aria-label={muted ? "Turn sound on" : "Mute sound"}>{muted ? <VolumeX /> : <Volume2 />}</button>
              <button className="icon-button" onClick={() => setMode(modeRef.current === "paused" ? "playing" : "paused")} aria-label="Pause game"><Pause /></button>
            </div>
          </div>
        )}

        {mode === "playing" && <button className="pulse-action" onClick={pulse} disabled={pulseSeconds > 0}>{pulseSeconds > 0 ? `PULSE • ${pulseSeconds}s` : "PULSE • Q"}</button>}
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
            <p className="eyebrow">RIFT RUSH / OVERDRIVE</p>
            <h1>RIFT <span>RUSH</span></h1>
            {lastRun ? (
              <div className="last-run-card">
                <span>RUN COMPLETE</span>
                <strong>{lastRun.score.toLocaleString()} points</strong>
                <small>Wave {lastRun.wave} • <b>+{lastRun.earned} Rift Shards</b></small>
              </div>
            ) : (
              <p className="tagline">Launch. Unleash your pulse. Build your next run.</p>
            )}
            <div className="command-stats"><span>REBIRTH<strong>{rebirths}</strong></span><span>POWER<strong>×{(1 + rebirths * 0.5).toFixed(1)}</strong></span><span>UPGRADES<strong>{Object.keys(permanentPurchases).length.toLocaleString()}</strong></span></div>
            <div className="shard-balance"><Gem size={17} fill="currentColor" /> {shards.toLocaleString()} RIFT SHARDS</div>
            <div className="menu-actions">
              <button className="primary-button" onClick={startGame}>
                {lastRun ? <RotateCcw size={21} /> : <Play size={22} fill="currentColor" />}
                {lastRun ? "RESTART" : "PLAY NOW"}
              </button>
              <button className="secondary-button upgrades-button" onClick={() => setMode("permanent")}>
                <Gem size={19} /> UPGRADE SHOP
              </button>
              <button className="secondary-button customize-button" onClick={() => setMode("customize")}>
                <Palette size={19} /> SHIP HANGAR
              </button>
            </div>
            <div className="save-tools">
              <button onClick={saveProgress}><Save size={17} /> SAVE</button>
              <button onClick={exportProgress}><Download size={17} /> EXPORT</button>
              <button onClick={() => importInputRef.current?.click()}><Upload size={17} /> IMPORT</button>
              <input ref={importInputRef} type="file" accept="application/json,.json" onChange={importProgress} aria-label="Import a Rift Rush save file" />
            </div>
            <p className="save-status" aria-live="polite">{saveStatus}</p>
            <div className="controls-card">
              <div><Move size={19} /><span><b>Move</b> WASD / arrows</span></div>
              <div><Crosshair size={19} /><span><b>Shoot</b> aim + hold click</span></div>
              <div><Zap size={19} /><span><b>Dash</b> Shift / E • Pulse: Q</span></div>
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
            <h2>PERMANENT ARMORY</h2>
            <p>{Object.keys(permanentPurchases).length.toLocaleString()} / 50,000 owned • Rebirth {rebirths} • ×{(1 + rebirths * 0.5).toFixed(1)} strength • ×{(1 + rebirths * 0.25).toFixed(2)} shards</p>
            <div className="rebirth-panel">
              <p>Rebirth resets all shards. Keep upgrades, skins and best score. Each rebirth adds +0.5× damage and health, plus +25% shard earnings. The next rebirth costs 5× more.</p>
              <button className="secondary-button" disabled={shards < rebirthCost || rebirths >= 2500} onClick={() => setRebirthConfirm(true)}>REBIRTH • Need {rebirthCost.toLocaleString()} shards</button>
              {rebirthConfirm && <div role="alert"><p>Reset your {shards.toLocaleString()} shards for rebirth {rebirths + 1}?</p><button className="secondary-button" onClick={doRebirth}>CONFIRM REBIRTH</button><button className="back-button" onClick={() => setRebirthConfirm(false)}>CANCEL</button></div>}
            </div>
            <div className="shop-controls">
              <input aria-label="Search permanent upgrades" placeholder="Search upgrades…" value={shopSearch} onChange={e => setShopSearch(e.target.value)} />
              <div className="shop-tabs" aria-label="Upgrade categories">{["All", "Weapons", "Defense", "Movement"].map(category => <button key={category} aria-pressed={shopCategory === category} className={shopCategory === category ? "active" : ""} onClick={() => setShopCategory(category)}>{category}</button>)}</div>
            </div>
            <p>Each card shows your next upgrade. MK1 is available immediately; later marks need the matching rebirth.</p>
            <div className="perma-shop">
              {PERMANENT_FAMILIES.map((family, index) => {
                const category = ["health", "shield"].includes(family.stat) ? "Defense" : ["speed", "dash"].includes(family.stat) ? "Movement" : "Weapons";
                if (shopCategory !== "All" && category !== shopCategory || !family.name.toLowerCase().includes(shopSearch.toLowerCase())) return null;
                let tier = 1;
                while (tier <= 2500 && permanentPurchases[`${family.id}-${tier}`]) tier++;
                const complete = tier > 2500;
                const upgrade = PERMANENT_UPGRADES[index * 2500 + Math.min(tier, 2500) - 1];
                const locked = tier > 1 && rebirths < tier;
                return <article className="shop-item" key={family.id} style={{"--upgrade":family.color} as React.CSSProperties}>
                  <div className="shop-item-top"><span>{family.icon}</span><small>{category}</small><b>MK {Math.min(tier,2500)}</b></div>
                  <h3>{family.name}</h3><p>{family.description}</p>
                  <small>{Math.min(tier - 1,2500).toLocaleString()} / 2,500 owned</small>
                  <progress value={tier - 1} max={2500} />
                  <button disabled={complete || locked || shards < upgrade.cost} onClick={() => buyPermanentUpgrade(upgrade)}>{complete ? "COMPLETE" : locked ? `UNLOCK AT REBIRTH ${tier}` : shards < upgrade.cost ? `NEED ${upgrade.cost.toLocaleString()} SHARDS` : `BUY • ${upgrade.cost.toLocaleString()} SHARDS`}</button>
                </article>;
              })}
            </div>
          </section>
        )}

        {mode === "customize" && (
          <section className="overlay permanent-overlay customize-overlay">
            <button className="back-button" onClick={() => setMode("menu")}><ArrowLeft size={19} /> MAIN MENU</button>
            <p className="eyebrow">CHOOSE YOUR PILOT STYLE</p>
            <h2>SHIP CUSTOMIZATION</h2>
            <p>Choose from 100 ship skins. Your favorite saves automatically and appears in every run.</p>
            <input className="hangar-search" aria-label="Search ship skins" placeholder="Find a ship or color…" value={shipSearch} onChange={(event) => setShipSearch(event.target.value)} />
            <div className="ship-grid">
              {SHIP_STYLES.filter((ship) => ship.name.toLowerCase().includes(shipSearch.toLowerCase())).map((ship) => {
                const active = selectedShip === ship.id;
                return (
                  <button
                    className={`ship-card ${active ? "selected" : ""}`}
                    key={ship.id}
                    onClick={() => chooseShip(ship.id)}
                    style={{ "--ship-body": ship.body, "--ship-wing": ship.wing, "--ship-engine": ship.engine } as React.CSSProperties}
                  >
                    <span className="ship-preview" aria-hidden="true">{ship.icon}</span>
                    <span className="ship-card-copy"><strong>{ship.name}</strong><small>{ship.description}</small></span>
                    <span className="ship-selected">{active ? <><Check size={16} /> SELECTED</> : "CHOOSE"}</span>
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
            <p className="eyebrow">SYSTEM UPGRADE READY</p>
            <div className="cleared-badge">WAVE {hud.wave} CLEARED</div>
            <h2>CHOOSE AN UPGRADE</h2>
            <p>Discover 100 different boosts. Pick one for the rest of this run.</p>
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
