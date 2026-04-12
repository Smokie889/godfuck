export const PLAYER_SIZE = 20;
export const PLAYER_SPEED = 180;
export const WORLD_SIZE = 800;
export const DASH_SPEED_MULTIPLIER = 2.9;
export const DASH_DURATION_MS = 165;
export const DASH_COOLDOWN_MS = 450;

export const TICK_RATE = 20;
export const TICK_DELTA = 1 / TICK_RATE;
export const TICK_MS = 1000 / TICK_RATE;

export const LOCAL_PREDICTION_SCALE = 1;
export const LOCAL_RENDER_LERP = 0.28;
export const REMOTE_RENDER_LERP = 0.2;

export const MAX_CHAT_LINES = 8;
export const AIM_SEND_INTERVAL_MS = 50;
export const CHAT_BUBBLE_LIFETIME_MS = 5000;

const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
const wsOverride = new URLSearchParams(window.location.search).get("ws");
export const ROOM_ID = new URLSearchParams(window.location.search).get("room") || "lobby-01";

function buildDefaultWsUrl() {
  return `${wsProtocol}//${window.location.hostname}:3000`;
}

function buildWsUrl() {
  if (!wsOverride) {
    return buildDefaultWsUrl();
  }

  if (wsOverride.startsWith("ws://") || wsOverride.startsWith("wss://")) {
    return wsOverride;
  }

  return `${wsProtocol}//${wsOverride}`;
}

export const WS_URL = buildWsUrl();
export const API_URL = WS_URL.replace(/^ws/, "http");
