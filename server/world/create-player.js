const { createCombatPlayerState } = require("../systems/combat-system");
const { randomSpawn } = require("./spawn");

function createPlayer(id) {
  const spawn = randomSpawn();
  const combatState = createCombatPlayerState();

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
    facing: {
      x: 0,
      y: -1,
    },
    appearance: {
      chatBubbleStyle: Math.random() > 0.5 ? "default" : "gold",
    },
    ...combatState,
  };
}

module.exports = {
  createPlayer,
};