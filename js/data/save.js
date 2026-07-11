import { BALANCE } from '../config.js';
import { CLASS_KEYS, CLASSES } from './classes.js';
import { randomBlessing } from './blessings.js';

export const SAVE = {
  round: 1,
  soldierPoints: BALANCE.startingSoldierPoints,
  playerRoster: [],
  relics: [],
  nextRecruitId: 1
};

export function randomClass(){ return Phaser.Utils.Array.GetRandom(CLASS_KEYS); }

export function createRecruit(type = randomClass()){
  const pool = CLASSES[type]?.startingAbilityPool ?? CLASSES[type]?.abilityPool ?? [];
  const initial = pool.length ? [Phaser.Utils.Array.GetRandom(pool)] : [];
  return {
    id: SAVE.nextRecruitId++,
    type,
    level: 1,
    xp: 0,
    blessing: randomBlessing(CLASSES[type].defaultBlessing),
    learnedAbilities: initial
  };
}

export function randomTeam(){ return [createRecruit(), createRecruit(), createRecruit()]; }

export function resetRun(){
  SAVE.round = 1;
  SAVE.soldierPoints = BALANCE.startingSoldierPoints;
  SAVE.nextRecruitId = 1;
  SAVE.relics = [];
  SAVE.playerRoster = randomTeam();
}
