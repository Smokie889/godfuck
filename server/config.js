// WebSocket server 對外提供連線的埠號。
const SERVER_PORT = 3000;

// 伺服器固定 tick 頻率。所有權威更新都依這個節奏推進。
const TICK_RATE = 20;
const TICK_INTERVAL = 1000 / TICK_RATE;

// 世界與角色的基礎尺寸設定。
const WORLD_SIZE = 800;
const PLAYER_SIZE = 20;
const PLAYER_SPEED = 180;
const DASH_SPEED_MULTIPLIER = 2.9;
const DASH_DURATION_MS = 165;
const DASH_COOLDOWN_MS = 450;

// 子彈相關常數。這些值會同時影響 server 權威判定與 client 的視覺模擬。
const BULLET_SPEED = 1180;
const BULLET_LENGTH = 42;
const BULLET_RADIUS = 3;
const BULLET_DAMAGE = 10;
const BULLET_MAX_DISTANCE = 650;

// server 端的最低開火間隔，用來阻止過快射擊。
const SHOOT_INTERVAL_MS = 180;

module.exports = {
  SERVER_PORT,
  TICK_RATE,
  TICK_INTERVAL,
  WORLD_SIZE,
  PLAYER_SIZE,
  PLAYER_SPEED,
  DASH_SPEED_MULTIPLIER,
  DASH_DURATION_MS,
  DASH_COOLDOWN_MS,
  BULLET_SPEED,
  BULLET_LENGTH,
  BULLET_RADIUS,
  BULLET_DAMAGE,
  BULLET_MAX_DISTANCE,
  SHOOT_INTERVAL_MS,
};
