const { PLAYER_SIZE } = require("../config");
const { randomSpawn } = require("../world/spawn");

const MAX_HP = 100;
const ATTACK_DAMAGE = 25;
const ATTACK_RANGE = 70;
const ATTACK_HALF_ANGLE_RAD = Math.PI / 4;
const ATTACK_COOLDOWN_MS = 350;
const HIT_FLASH_MS = 150;
const ATTACK_FLASH_MS = 120;

function normalize(dx, dy) {
  const length = Math.hypot(dx, dy);
  if (length === 0) return { x: 0, y: 0 };
  return { x: dx / length, y: dy / length };
}

function dot(ax, ay, bx, by) {
  return ax * bx + ay * by;
}

function applyRespawn(player) {
  const spawn = randomSpawn();
  player.x = spawn.x;
  player.y = spawn.y;
  player.hp = player.maxHp;
  player.hitFlashUntil = 0;
}

function handleAttack(players, attackerId) {
  const attacker = players[attackerId];
  if (!attacker) return;

  const now = Date.now();

  // server 雙保險：就算 client 出問題，也不會無限連砍
  if (now - attacker.lastAttackTime < ATTACK_COOLDOWN_MS) {
    return;
  }

  attacker.lastAttackTime = now;
  attacker.attackFlashUntil = now + ATTACK_FLASH_MS;

  const attackerCenterX = attacker.x + PLAYER_SIZE / 2;
  const attackerCenterY = attacker.y + PLAYER_SIZE / 2;

  const facing = normalize(attacker.facing.x, attacker.facing.y);
  const cosThreshold = Math.cos(ATTACK_HALF_ANGLE_RAD);

  for (const id in players) {
    if (id === attackerId) continue;

    const target = players[id];
    const targetCenterX = target.x + PLAYER_SIZE / 2;
    const targetCenterY = target.y + PLAYER_SIZE / 2;

    const toTargetX = targetCenterX - attackerCenterX;
    const toTargetY = targetCenterY - attackerCenterY;

    const distance = Math.hypot(toTargetX, toTargetY);
    if (distance > ATTACK_RANGE || distance === 0) {
      continue;
    }

    const dirToTarget = normalize(toTargetX, toTargetY);
    const alignment = dot(
      facing.x,
      facing.y,
      dirToTarget.x,
      dirToTarget.y
    );

    if (alignment >= cosThreshold) {
      target.hp -= ATTACK_DAMAGE;
      target.hitFlashUntil = now + HIT_FLASH_MS;

      if (target.hp <= 0) {
        applyRespawn(target);
      }
    }
  }
}

function createCombatPlayerState() {
  return {
    hp: MAX_HP,
    maxHp: MAX_HP,
    lastAttackTime: 0,
    attackFlashUntil: 0,
    hitFlashUntil: 0,
  };
}

function serializeCombatState(player, now) {
  return {
    hp: player.hp,
    maxHp: player.maxHp,
    isAttacking: now < player.attackFlashUntil,
    isHit: now < player.hitFlashUntil,
  };
}

module.exports = {
  handleAttack,
  createCombatPlayerState,
  serializeCombatState,
};