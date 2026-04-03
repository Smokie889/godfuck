const { WORLD_SIZE } = require("../config");

function randomSpawn() {
  return {
    x: 100 + Math.random() * (WORLD_SIZE - 200),
    y: 100 + Math.random() * (WORLD_SIZE - 200),
  };
}

module.exports = {
  randomSpawn,
};