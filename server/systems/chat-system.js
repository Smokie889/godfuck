const MAX_CHAT_LENGTH = 120;

function normalizeChatText(text) {
  if (typeof text !== "string") {
    return null;
  }

  const normalized = text.trim();

  if (!normalized) {
    return null;
  }

  return normalized.slice(0, MAX_CHAT_LENGTH);
}

function createChatMessage(player, text) {
  const normalizedText = normalizeChatText(text);

  if (!normalizedText) {
    return null;
  }

  return {
    playerId: player.id,
    text: normalizedText,
    time: Date.now(),
  };
}

module.exports = {
  createChatMessage,
};