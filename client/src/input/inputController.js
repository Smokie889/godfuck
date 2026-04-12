export function createInputController(state, chatInput, actions) {
  function stopAllMovementInput() {
    state.inputState.up = false;
    state.inputState.down = false;
    state.inputState.left = false;
    state.inputState.right = false;
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

  const handleKeydown = (event) => {
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

    if (event.code === "Space") {
      event.preventDefault();
      actions.pickupWeapon();
      return;
    }

    if (event.key === "`") {
      event.preventDefault();
      actions.dropWeapon();
      return;
    }

    if (event.key === "Shift") {
      if (!state.inputState.dashHeld) {
        state.inputState.dashHeld = true;
        actions.sendDash();
      }
      return;
    }

    updateKeyState(event.key, true);
  };

  const handleKeyup = (event) => {
    if (event.key === "Shift") {
      state.inputState.dashHeld = false;
      return;
    }

    if (state.isChatting) {
      return;
    }

    updateKeyState(event.key, false);
  };

  const handleMousemove = (event) => {
    const rect = actions.canvas.getBoundingClientRect();
    state.mouse.x = event.clientX - rect.left;
    state.mouse.y = event.clientY - rect.top;
  };

  const handleMouseenter = () => {
    state.mouse.insideCanvas = true;
  };

  const handleMouseleave = () => {
    state.mouse.insideCanvas = false;
  };

  const handleMousedown = (event) => {
    if (event.button !== 0 || state.isChatting) {
      return;
    }

    event.preventDefault();
    state.mouse.leftDown = true;
    actions.handleShoot();
  };

  const handleMouseup = (event) => {
    if (event.button !== 0) {
      return;
    }

    state.mouse.leftDown = false;
  };

  const handleBlur = () => {
    stopAllMovementInput();
    state.mouse.leftDown = false;
  };

  const handleContextmenu = (event) => {
    event.preventDefault();
  };

  document.addEventListener("keydown", handleKeydown);
  document.addEventListener("keyup", handleKeyup);
  actions.canvas.addEventListener("mousemove", handleMousemove);
  actions.canvas.addEventListener("mouseenter", handleMouseenter);
  actions.canvas.addEventListener("mouseleave", handleMouseleave);
  actions.canvas.addEventListener("mousedown", handleMousedown);
  window.addEventListener("mouseup", handleMouseup);
  window.addEventListener("blur", handleBlur);
  actions.canvas.addEventListener("contextmenu", handleContextmenu);

  return {
    destroy() {
      stopAllMovementInput();
      state.mouse.leftDown = false;
      document.removeEventListener("keydown", handleKeydown);
      document.removeEventListener("keyup", handleKeyup);
      actions.canvas.removeEventListener("mousemove", handleMousemove);
      actions.canvas.removeEventListener("mouseenter", handleMouseenter);
      actions.canvas.removeEventListener("mouseleave", handleMouseleave);
      actions.canvas.removeEventListener("mousedown", handleMousedown);
      window.removeEventListener("mouseup", handleMouseup);
      window.removeEventListener("blur", handleBlur);
      actions.canvas.removeEventListener("contextmenu", handleContextmenu);
    },
  };
}
