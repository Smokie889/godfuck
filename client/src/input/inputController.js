export function createInputController(state, chatInput, actions) {
  function stopAllMovementInput() {
    state.inputState.up = false;
    state.inputState.down = false;
    state.inputState.left = false;
    state.inputState.right = false;
    state.inputState.dash = false;
    state.inputState.dashHeld = false;
  }

  function normalizeKey(key) {
    if (key === "ArrowUp" || key === "ArrowDown" || key === "ArrowLeft" || key === "ArrowRight") {
      return key;
    }

    return key.length === 1 ? key.toLowerCase() : key;
  }

  function updateKeyState(key, isPressed) {
    const normalizedKey = normalizeKey(key);
    let changed = false;

    if (normalizedKey === "w" || normalizedKey === "ArrowUp") {
      changed = state.inputState.up !== isPressed || changed;
      state.inputState.up = isPressed;
    }

    if (normalizedKey === "s" || normalizedKey === "ArrowDown") {
      changed = state.inputState.down !== isPressed || changed;
      state.inputState.down = isPressed;
    }

    if (normalizedKey === "a" || normalizedKey === "ArrowLeft") {
      changed = state.inputState.left !== isPressed || changed;
      state.inputState.left = isPressed;
    }

    if (normalizedKey === "d" || normalizedKey === "ArrowRight") {
      changed = state.inputState.right !== isPressed || changed;
      state.inputState.right = isPressed;
    }
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();

      if (!state.isChatting) {
        actions.openChat();
        stopAllMovementInput();
        return;
      }

      const text = chatInput.value.trim();
      if (text) {
        actions.sendChat(text);
      }

      actions.closeChat();
      return;
    }

    if (event.key === "Escape" && state.isChatting) {
      event.preventDefault();
      actions.closeChat();
      return;
    }

    if (state.isChatting) {
      return;
    }

    if (event.key === "Shift") {
      if (!state.inputState.dashHeld) {
        state.inputState.dash = true;
        state.inputState.dashHeld = true;
      }
      return;
    }

    updateKeyState(event.key, true);
  });

  document.addEventListener("keyup", (event) => {
    if (event.key === "Shift") {
      state.inputState.dashHeld = false;
      return;
    }

    if (state.isChatting) {
      return;
    }

    updateKeyState(event.key, false);
  });

  actions.canvas.addEventListener("mousemove", (event) => {
    const rect = actions.canvas.getBoundingClientRect();
    state.mouse.x = event.clientX - rect.left;
    state.mouse.y = event.clientY - rect.top;
  });

  actions.canvas.addEventListener("mouseenter", () => {
    state.mouse.insideCanvas = true;
  });

  actions.canvas.addEventListener("mouseleave", () => {
    state.mouse.insideCanvas = false;
  });

  actions.canvas.addEventListener("mousedown", (event) => {
    if (event.button !== 0 || state.isChatting) {
      return;
    }

    event.preventDefault();
    state.mouse.leftDown = true;
    actions.handleShoot();
  });

  window.addEventListener("mouseup", (event) => {
    if (event.button !== 0) {
      return;
    }

    state.mouse.leftDown = false;
  });

  window.addEventListener("blur", () => {
    stopAllMovementInput();
    state.mouse.leftDown = false;
  });

  actions.canvas.addEventListener("contextmenu", (event) => {
    event.preventDefault();
  });
}
