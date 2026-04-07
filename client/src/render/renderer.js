import { PLAYER_SIZE } from "../config.js";
import { getSpreadRadius } from "../game/shooting.js";

export function createRenderer(canvas, state, socketClient) {
  const ctx = canvas.getContext("2d");

  function drawHpBar(player, position) {
    const barWidth = 26;
    const barHeight = 4;
    const x = position.x - 3;
    const y = position.y - 12;

    ctx.fillStyle = "#333";
    ctx.fillRect(x, y, barWidth, barHeight);

    const ratio = Math.max(0, player.hp / player.maxHp);
    ctx.fillStyle = ratio > 0.5 ? "#32d74b" : ratio > 0.25 ? "#ffd60a" : "#ff453a";
    ctx.fillRect(x, y, barWidth * ratio, barHeight);
  }

  function drawFacingArrow(player, position) {
    const cx = position.x + PLAYER_SIZE / 2;
    const cy = position.y + PLAYER_SIZE / 2;
    const aimFacing = player.aimFacing || player.moveFacing || { x: 0, y: -1 };
    const fx = aimFacing.x;
    const fy = aimFacing.y;

    const arrowLen = 16;
    const tipX = cx + fx * arrowLen;
    const tipY = cy + fy * arrowLen;

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();
  }

  function drawPlayer(id, position) {
    const player = state.players[id];
    if (!player) return;

    let color = id === state.myId ? "#ff4d4f" : "#4da6ff";
    if (player.isHit) color = "#ffffff";

    ctx.fillStyle = color;
    ctx.fillRect(position.x, position.y, PLAYER_SIZE, PLAYER_SIZE);

    drawHpBar(player, position);
    drawFacingArrow(player, position);

    ctx.fillStyle = "#fff";
    ctx.font = "12px sans-serif";
    ctx.fillText(`${id} (${player.hp})`, position.x - 4, position.y - 18);
  }

  function drawChatBubbles() {
    const now = performance.now();

    for (const playerId in state.playerChatBubbles) {
      const bubbles = (state.playerChatBubbles[playerId] || []).filter(
        (bubble) => bubble.expiresAt > now
      );

      if (bubbles.length === 0) {
        delete state.playerChatBubbles[playerId];
        continue;
      }

      state.playerChatBubbles[playerId] = bubbles;

      const playerPosition = state.renderPlayers[playerId];
      if (!playerPosition) {
        continue;
      }

      for (let index = 0; index < bubbles.length; index += 1) {
        const bubble = bubbles[bubbles.length - 1 - index];
        const paddingX = 8;
        const paddingY = 6;
        const textY = playerPosition.y - 34 - index * 26;

        ctx.font = "12px sans-serif";
        const textWidth = ctx.measureText(bubble.text).width;
        const bubbleWidth = textWidth + paddingX * 2;
        const bubbleHeight = 22;
        const bubbleX = playerPosition.x + PLAYER_SIZE / 2 - bubbleWidth / 2;
        const bubbleY = textY - bubbleHeight + 4;

        ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
        ctx.fillRect(bubbleX, bubbleY, bubbleWidth, bubbleHeight);

        ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
        ctx.strokeRect(bubbleX, bubbleY, bubbleWidth, bubbleHeight);

        ctx.fillStyle = "#fff";
        ctx.fillText(bubble.text, bubbleX + paddingX, bubbleY + 15);
      }
    }
  }

  function drawBullet(bullet) {
    const halfLength = (bullet.length || 18) / 2;
    const startX = bullet.x - bullet.dirX * halfLength;
    const startY = bullet.y - bullet.dirY * halfLength;
    const endX = bullet.x + bullet.dirX * halfLength;
    const endY = bullet.y + bullet.dirY * halfLength;

    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
  }

  function drawCrosshair() {
    if (!state.mouse.insideCanvas) {
      return;
    }

    const spreadRadius = getSpreadRadius(state);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(state.mouse.x, state.mouse.y, spreadRadius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(state.mouse.x, state.mouse.y, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawHitEffects() {
    const now = performance.now();
    state.hitEvents = state.hitEvents.filter((event) => event.expiresAt > now);

    for (const event of state.hitEvents) {
      const life = (event.expiresAt - now) / 120;
      ctx.strokeStyle = `rgba(255, 255, 255, ${Math.max(0, life)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(event.x - 8, event.y - 8);
      ctx.lineTo(event.x + 8, event.y + 8);
      ctx.moveTo(event.x + 8, event.y - 8);
      ctx.lineTo(event.x - 8, event.y + 8);
      ctx.stroke();
    }
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const id in state.bullets) {
      drawBullet(state.bullets[id]);
    }

    for (const id in state.renderPlayers) {
      drawPlayer(id, state.renderPlayers[id]);
    }

    drawChatBubbles();
    drawHitEffects();
    drawCrosshair();
  }

  return { draw };
}
