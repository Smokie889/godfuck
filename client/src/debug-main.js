import { createRemoteDebugUi } from "./debug/debugUi.js";
import { subscribeDebugBridge } from "./debug/debugBridge.js";

const outgoingFixedDebug = document.getElementById("outgoingFixedDebug");
const outgoingDebug = document.getElementById("outgoingDebug");
const runtimeFixedDebug = document.getElementById("runtimeFixedDebug");
const runtimeDebug = document.getElementById("runtimeDebug");
const emptyState = document.getElementById("debugEmptyState");

const debugUi = createRemoteDebugUi({
  outgoingFixedDebug,
  outgoingDebug,
  runtimeFixedDebug,
  runtimeDebug,
});

let hasSnapshot = false;

subscribeDebugBridge((snapshot) => {
  hasSnapshot = true;
  emptyState.classList.add("hidden");
  debugUi.render(snapshot);
});

window.setInterval(() => {
  if (!hasSnapshot) {
    emptyState.classList.remove("hidden");
  }
}, 500);
