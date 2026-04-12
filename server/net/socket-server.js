const WebSocket = require("ws");

function createSocketServer(server) {
  const wss = new WebSocket.Server({ server });
  return wss;
}

function broadcastToMatchingClients(wss, predicate, data) {
  const message = JSON.stringify(data);

  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN && predicate(client)) {
      client.send(message);
    }
  }
}

function broadcastToRoom(wss, roomId, data) {
  broadcastToMatchingClients(
    wss,
    (client) => client.roomId === roomId && client.channel === "game",
    data
  );
}

function broadcastToRoomLobby(wss, roomId, data) {
  broadcastToMatchingClients(
    wss,
    (client) => client.roomId === roomId && client.channel === "roomLobby",
    data
  );
}

module.exports = {
  createSocketServer,
  broadcastToRoomLobby,
  broadcastToRoom,
};
