const subscribers = new Set();

function subscribeRoomList(res) {
  subscribers.add(res);
}

function unsubscribeRoomList(res) {
  subscribers.delete(res);
}

function broadcastRoomList(payload) {
  const message = `event: roomList\ndata: ${JSON.stringify(payload)}\n\n`;

  for (const res of subscribers) {
    try {
      res.write(message);
    } catch {
      subscribers.delete(res);
    }
  }
}

module.exports = {
  broadcastRoomList,
  subscribeRoomList,
  unsubscribeRoomList,
};
