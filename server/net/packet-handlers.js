const { handleShoot } = require("../systems/bullet-system");
const { createChatMessage } = require("../systems/chat-system");
const { tryStartDash } = require("../systems/movement-system");
const {
  createWeaponDrop,
  findNearbyWeaponDrop,
  resetPlayerWeapon,
  serializeWeaponDrop,
} = require("../systems/weapon-drop-system");
const { DEFAULT_WEAPON_ID } = require("../systems/weapon-system");
const { CLIENT_MESSAGE_TYPES, SERVER_MESSAGE_TYPES } = require("./protocol");

function handleInputPacket(player, data) {
  player.inputState = {
    up: !!data.up,
    down: !!data.down,
    left: !!data.left,
    right: !!data.right,
  };

  player.lastProcessedInput = data.seq || 0;
}

function handleAimPacket(player, data) {
  const x = Number(data.x);
  const y = Number(data.y);
  const length = Math.hypot(x, y);

  if (!Number.isFinite(x) || !Number.isFinite(y) || length === 0) {
    return;
  }

  player.aimFacing.x = x / length;
  player.aimFacing.y = y / length;
}

function handleChatPacket({ player, data, roomId, wss, broadcast }) {
  const chatMessage = createChatMessage(player, data.text);
  if (!chatMessage) return;

  broadcast(wss, roomId, {
    type: SERVER_MESSAGE_TYPES.CHAT,
    ...chatMessage,
  });
}

function handlePickupWeaponPacket({ player, weaponDrops, roomId, wss, broadcast }) {
  const drop = findNearbyWeaponDrop(player, weaponDrops);
  if (!drop) {
    return;
  }

  if (player.currentWeaponId === drop.weaponId) {
    return;
  }

  player.currentWeaponId = drop.weaponId;

  broadcast(wss, roomId, {
    type: SERVER_MESSAGE_TYPES.WEAPON_DROP_REMOVE,
    dropId: drop.id,
  });
  delete weaponDrops[drop.id];

  const replacementDrop = createWeaponDrop("shotgun");
  weaponDrops[replacementDrop.id] = replacementDrop;
  broadcast(wss, roomId, {
    type: SERVER_MESSAGE_TYPES.WEAPON_DROP_SPAWN,
    drop: serializeWeaponDrop(replacementDrop),
  });
}

function handleDropWeaponPacket({ player, weaponDrops, roomId, wss, broadcast }) {
  if (!player.currentWeaponId || player.currentWeaponId === DEFAULT_WEAPON_ID) {
    return;
  }

  const droppedWeaponId = player.currentWeaponId;
  resetPlayerWeapon(player);

  const droppedWeapon = createWeaponDrop(droppedWeaponId, {
    x: player.x,
    y: player.y,
  });

  weaponDrops[droppedWeapon.id] = droppedWeapon;
  broadcast(wss, roomId, {
    type: SERVER_MESSAGE_TYPES.WEAPON_DROP_SPAWN,
    drop: serializeWeaponDrop(droppedWeapon),
  });
}

function handlePacket({ message, playerId, room, ws, wss, broadcast }) {
  let data;

  try {
    data = JSON.parse(message);
  } catch {
    return;
  }

  const player = room.players[playerId];
  if (!player) return;
  if (player.isEliminated && data.type !== CLIENT_MESSAGE_TYPES.PING) return;

  switch (data.type) {
    case CLIENT_MESSAGE_TYPES.INPUT:
      handleInputPacket(player, data);
      return;

    case CLIENT_MESSAGE_TYPES.DASH:
      tryStartDash(player, player.inputState);
      return;

    case CLIENT_MESSAGE_TYPES.AIM:
      handleAimPacket(player, data);
      broadcast(wss, room.id, {
        type: SERVER_MESSAGE_TYPES.AIM,
        playerId,
        x: player.aimFacing.x,
        y: player.aimFacing.y,
      });
      return;

    case CLIENT_MESSAGE_TYPES.SHOOT:
      handleShoot({
        players: room.players,
        bullets: room.bullets,
        playerId,
        data,
        roomId: room.id,
        wss,
        broadcast,
      });
      return;

    case CLIENT_MESSAGE_TYPES.PICKUP_WEAPON:
      handlePickupWeaponPacket({
        player,
        weaponDrops: room.weaponDrops,
        wss,
        broadcast,
        roomId: room.id,
      });
      return;

    case CLIENT_MESSAGE_TYPES.DROP_WEAPON:
      handleDropWeaponPacket({
        player,
        weaponDrops: room.weaponDrops,
        wss,
        broadcast,
        roomId: room.id,
      });
      return;

    case CLIENT_MESSAGE_TYPES.CHAT:
      handleChatPacket({
        player,
        data,
        roomId: room.id,
        wss,
        broadcast,
      });
      return;

    case CLIENT_MESSAGE_TYPES.PING:
      ws.send(
        JSON.stringify({
          type: SERVER_MESSAGE_TYPES.PONG,
          id: data.id,
        })
      );
      return;

    default:
      return;
  }
}

module.exports = {
  handlePacket,
};
