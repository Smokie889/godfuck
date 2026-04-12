const DEBUG_CHANNEL_NAME = "godfuck-debug";

export function createDebugBridge() {
  if (!("BroadcastChannel" in window)) {
    return {
      publish() {},
    };
  }

  const channel = new BroadcastChannel(DEBUG_CHANNEL_NAME);

  return {
    publish(snapshot) {
      channel.postMessage(snapshot);
    },
  };
}

export function subscribeDebugBridge(onMessage) {
  if (!("BroadcastChannel" in window)) {
    return () => {};
  }

  const channel = new BroadcastChannel(DEBUG_CHANNEL_NAME);
  channel.onmessage = (event) => {
    onMessage(event.data);
  };

  return () => {
    channel.close();
  };
}
