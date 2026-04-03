const WebSocket = require("ws");
const { SERVER_PORT } = require("../config");

function createSocketServer() {
  const wss = new WebSocket.Server({ port: SERVER_PORT });
  return wss;
}

function broadcast(wss, data) {
  const message = JSON.stringify(data);

  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

module.exports = {
  createSocketServer,
  broadcast,
};