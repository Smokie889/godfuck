export function createHudUi(state, elements) {
  function render() {
    const currentPlayer = state.myId ? state.players[state.myId] : null;
    const hp = currentPlayer ? `${currentPlayer.hp} / ${currentPlayer.maxHp}` : "0 / 0";
    const pingText =
      state.network.pingMs > 0 ? `${Math.round(state.network.pingMs)} ms` : "-- ms";

    elements.hudHealth.textContent = hp;
    elements.hudStamina.textContent = `${state.hud.stamina} / ${state.hud.maxStamina}`;
    elements.hudPing.textContent = pingText;
  }

  return { render };
}
