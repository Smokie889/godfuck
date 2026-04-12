const { randomSpawn } = require("./spawn");
const { DEFAULT_WEAPON_ID } = require("../systems/weapon-system");
const MAX_LIVES = 3;

function createPlayer(id, userId = id, displayName = id) {
  const spawn = randomSpawn();

  return {
    id,
    userId,
    displayName,
    x: spawn.x,
    y: spawn.y,
    lastProcessedInput: 0,
    inputState: {
      up: false,
      down: false,
      left: false,
      right: false,
    },
    moveFacing: {
      x: 0,
      y: -1,
    },
    aimFacing: {
      x: 0,
      y: -1,
    },
    appearance: {
      chatBubbleStyle: Math.random() > 0.5 ? "default" : "gold",
    },
    hp: 100,
    maxHp: 100,
    livesRemaining: MAX_LIVES,
    maxLives: MAX_LIVES,
    isEliminated: false,
    currentWeaponId: DEFAULT_WEAPON_ID,
    lastShotTime: 0,
    hitFlashUntil: 0,
    dashTimeRemaining: 0,
    dashCooldownRemaining: 0,
    dashFacing: {
      x: 0,
      y: -1,
    },
  };
}

module.exports = {
  createPlayer,
  MAX_LIVES,
};
