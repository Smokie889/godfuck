// HUD 只負責把目前 state 映射到畫面文字，不混入遊戲邏輯。
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
