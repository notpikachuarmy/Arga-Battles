import { DATA } from './registry.js';
export const BLESSINGS=DATA.blessings;
export const BLESSING_KEYS=Object.keys(BLESSINGS);
export function randomBlessing(defaultBlessing){if(Math.random()<.5)return defaultBlessing;return Phaser.Utils.Array.GetRandom(BLESSING_KEYS.filter(name=>name!==defaultBlessing));}
export function blessingBonusForCount(count){if(count>=3)return 3;if(count>=2)return 2;return 1;}
