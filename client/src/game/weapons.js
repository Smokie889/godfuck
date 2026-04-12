export const DEFAULT_WEAPON_ID = "pistol";

const WEAPON_DEFINITIONS = {
  pistol: {
    id: "pistol",
    label: "Pistol",
    fireIntervalMs: 150,
    bullet: {
      speed: 1120,
      length: 36,
      radius: 3,
      damage: 10,
      maxDistance: 650,
    },
    spread: {
      baseRadius: 10,
      maxMovement: 22,
      movementGrowth: 48,
      movementRecovery: 24,
      shotBloom: 8,
      shotRecovery: 20,
      maxTotal: 32,
    },
  },
  shotgun: {
    id: "shotgun",
    label: "Shotgun",
    fireIntervalMs: 520,
    pelletCount: 7,
    pelletSpreadDeg: 12,
    bullet: {
      speed: 980,
      length: 28,
      radius: 3,
      damage: 9,
      maxDistance: 380,
    },
    spread: {
      baseRadius: 18,
      maxMovement: 30,
      movementGrowth: 58,
      movementRecovery: 18,
      shotBloom: 16,
      shotRecovery: 12,
      maxTotal: 46,
    },
  },
};

export function getWeaponDefinition(weaponId = DEFAULT_WEAPON_ID) {
  return WEAPON_DEFINITIONS[weaponId] || WEAPON_DEFINITIONS[DEFAULT_WEAPON_ID];
}
