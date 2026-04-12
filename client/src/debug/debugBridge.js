// 主遊戲頁與獨立 debug 頁之間共用的頻道名稱。
const DEBUG_CHANNEL_NAME = "godfuck-debug";

export function createDebugBridge() {
  if (!("BroadcastChannel" in window)) {
    return {
      publish() {},
    };
  }

  const channel = new BroadcastChannel(DEBUG_CHANNEL_NAME);

  return {
    // 遊戲頁每一幀都會把最新 snapshot 廣播給 debug.html。
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
    // debug.html 只負責被動接收，不直接碰遊戲邏輯。
    onMessage(event.data);
  };

  return () => {
    channel.close();
  };
}
