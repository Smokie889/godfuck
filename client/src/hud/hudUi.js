// HUD 只負責把目前 state 映射到畫面文字，不混入遊戲邏輯。
import { DASH_COOLDOWN_MS } from "../config.js";

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function getMeterColor(ratio) {
  const hue = 120 * clamp01(ratio);
  return `hsl(${hue}, 72%, 52%)`;
}

function setMeterVisual(element, ratio) {
  if (!element) {
    return;
  }

  element.style.setProperty("--fill", String(clamp01(ratio)));
  element.style.setProperty("--meter-color", getMeterColor(ratio));
}

function formatCooldown(seconds) {
  if (seconds <= 0) {
    return "READY";
  }

  return `${seconds.toFixed(2)}s`;
}

export function createHudUi(state, elements) {
  let displayedHp = null;
  let displayedHpRatio = 1;
  let previousDashReady = true;
  let previousHpValue = null;

  function render() {
    const currentPlayer = state.myId ? state.players[state.myId] : null;
    const hudPlayer = state.myId ? state.localPlayer : currentPlayer;
    const hpValue = currentPlayer ? currentPlayer.hp : 0;
    const hpRatio = currentPlayer ? currentPlayer.hp / currentPlayer.maxHp : 0;
    const pingText =
      state.network.pingMs > 0 ? `${Math.round(state.network.pingMs)} ms` : "-- ms";
    const dashCooldownRemaining = hudPlayer?.dashCooldownRemaining || 0;
    const dashReady = dashCooldownRemaining <= 0;
    const dashReadyRatio =
      dashCooldownRemaining > 0
        ? clamp01(1 - dashCooldownRemaining / (DASH_COOLDOWN_MS / 1000))
        : 1;

    if (displayedHp === null) {
      displayedHp = hpValue;
      displayedHpRatio = hpRatio;
    } else {
      displayedHp += (hpValue - displayedHp) * 0.18;
      displayedHpRatio += (hpRatio - displayedHpRatio) * 0.18;

      if (Math.abs(displayedHp - hpValue) < 0.05) {
        displayedHp = hpValue;
      }

      if (Math.abs(displayedHpRatio - hpRatio) < 0.002) {
        displayedHpRatio = hpRatio;
      }
    }

    if (
      previousHpValue !== null &&
      hpValue < previousHpValue &&
      elements.hudHealthRing
    ) {
      elements.hudHealthRing.classList.remove("hud-meter-hit-pulse");
      void elements.hudHealthRing.offsetWidth;
      elements.hudHealthRing.classList.add("hud-meter-hit-pulse");
    }

    setMeterVisual(elements.hudHealthRing, displayedHpRatio);
    setMeterVisual(elements.hudStaminaRing, dashReadyRatio);

    if (dashReady && !previousDashReady && elements.hudStaminaRing) {
      elements.hudStaminaRing.classList.remove("hud-meter-ready-flash");
      void elements.hudStaminaRing.offsetWidth;
      elements.hudStaminaRing.classList.add("hud-meter-ready-flash");
    }

    elements.hudHealth.textContent = currentPlayer ? `${Math.round(displayedHp)}` : "0";
    elements.hudHealthMeta.textContent = `${Math.round(displayedHpRatio * 100)}%`;
    elements.hudStamina.textContent = dashCooldownRemaining > 0 ? "CD" : "OK";
    elements.hudStaminaMeta.textContent = formatCooldown(dashCooldownRemaining);
    elements.hudPing.textContent = `PING: ${pingText}`;
    previousHpValue = hpValue;
    previousDashReady = dashReady;
  }

  return { render };
}
