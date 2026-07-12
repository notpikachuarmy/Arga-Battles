export const GAME = {
  width: 1280,
  height: 720,
  tile: 50,
  cols: 10,
  rows: 10,
  gridX: 365,
  gridY: 45,
  placementGridY: 110,
  deploymentSize: 3,
  maxLevel: 10,
  apPerTurn: 3,
  abilityLevels: [1, 5, 10]
};

export const BALANCE = {
  moveCost: 0,
  basicAttackCost: 1,
  basicAttackDie: 3,
  basicAttackStrengthDivisor: 2,

  startingSoldierPoints: 6,
  maxSoldierPoints: 30,
  soldierPointsReward: 2,
  rewardEveryRounds: 2,

  xpBase: 25,
  xpPerRound: 5,
  xpNeededBase: 100,
  xpNeededPerLevel: 50,

  mpRegenEveryTurns: 3,
  mpRegenPercent: 0.20
};
