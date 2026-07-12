import { DATA } from './registry.js';
export const ENEMIES=DATA.enemies;
export const EXCLUSIVE_ENEMIES=Object.values(ENEMIES).filter(e=>e.type==='exclusive');
