import { DATA } from './registry.js';
export const RELICS=DATA.relics;
export const RELIC_KEYS=Object.keys(RELICS);
export const hasRelic=(save,id)=>save.relics?.includes(id);
