const { randomSpawn } = require("./spawn");

function createPlayer(id) {
  const spawn = randomSpawn();

  return {
    id,
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
};
