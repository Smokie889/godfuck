const { ensureWeaponDrops } = require("../systems/weapon-drop-system");

function createRoom(id, options = {}) {
  const room = {
    id,
    label: options.label || id,
    mapId: options.mapId || "arena01",
    status: options.status || "waiting",
    hostUserId: options.hostUserId || null,
    maxPlayers: options.maxPlayers || 4,
    members: {},
    gameStartAt: null,
    players: {},
    bullets: {},
    weaponDrops: {},
    previousStateSnapshots: {},
  };

  ensureWeaponDrops(room.weaponDrops);
  return room;
}

module.exports = {
  createRoom,
};
