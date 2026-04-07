import { CHAT_BUBBLE_LIFETIME_MS, MAX_CHAT_LINES } from "../config.js";

export function createChatController(state, chatBox, chatInput) {
  function renderChatMessages() {
    chatBox.innerHTML = "";

    for (const line of state.chatMessages) {
      const div = document.createElement("div");
      div.className = "chat-line";
      div.textContent = line;
      chatBox.appendChild(div);
    }
  }

  function openChat() {
    state.isChatting = true;
    chatInput.classList.add("active");
    chatInput.value = "";
    chatInput.focus();
  }

  function closeChat() {
    state.isChatting = false;
    chatInput.classList.remove("active");
    chatInput.blur();
    chatInput.value = "";
  }

  function addChatLine(playerId, text) {
    state.chatMessages.push(`${playerId}: ${text}`);

    if (state.chatMessages.length > MAX_CHAT_LINES) {
      state.chatMessages.shift();
    }

    renderChatMessages();

    if (!state.playerChatBubbles[playerId]) {
      state.playerChatBubbles[playerId] = [];
    }

    state.playerChatBubbles[playerId].push({
      id: `${playerId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      text,
      expiresAt: performance.now() + CHAT_BUBBLE_LIFETIME_MS,
    });
  }

  return {
    addChatLine,
    closeChat,
    openChat,
    renderChatMessages,
  };
}
