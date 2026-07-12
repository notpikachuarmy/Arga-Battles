import { DATA } from './registry.js';
export const AI_PROFILES=DATA.aiProfiles;
export const getAIProfile=id=>AI_PROFILES[id]||AI_PROFILES.balanced;
