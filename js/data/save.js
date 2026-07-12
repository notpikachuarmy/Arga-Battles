import { BALANCE } from '../config.js';
import { CLASS_KEYS, CLASSES } from './classes.js';
import { randomBlessing } from './blessings.js';
import { generateExpeditionMap } from '../systems/mapGenerator.js';

export const SAVE_VERSION = 2;
export const RUN_SAVE_KEY = 'argaBattles.run.v2';
export const LEGACY_RUN_SAVE_KEY = 'argaBattles.run.v1';
export const META_SAVE_KEY = 'argaBattles.meta.v1';

const freshRunState = () => ({
  version: SAVE_VERSION,
  active: false,
  seed: 0,
  mapNumber: 1,
  generatedMap: null,
  currentNodeId: null,
  visitedNodes: [],
  lives: 3,
  gold: 0,
  totalGoldEarned: 0,
  round: 1,
  soldierPoints: BALANCE.startingSoldierPoints,
  playerRoster: [],
  relics: [],
  retiredRelics: [],
  enemyRelics: [],
  pendingSkillChoices: [],
  nextRecruitId: 1,
  unlockedContent: [],
  usedUniqueEvents: [],
  journalEntries: [],
  currentMerchant: null,
  pendingNodeId: null,
  pendingNodeType: null,
  lastCompletedNodeId: null,
  createdAt: null,
  updatedAt: null
});

export const SAVE = freshRunState();
export const META = { version: 1, permanentCurrency: 0, completedRuns: 0, unlockedContent: [] };

function replaceObject(target, source){
  Object.keys(target).forEach(k=>delete target[k]);
  Object.assign(target, source);
}
function safeParse(raw){ try{return JSON.parse(raw);}catch{return null;} }
function now(){ return new Date().toISOString(); }

export function loadMeta(){
  const data=safeParse(localStorage.getItem(META_SAVE_KEY));
  if(data&&data.version===META.version)replaceObject(META,{...META,...data});
  return META;
}
export function saveMeta(){ localStorage.setItem(META_SAVE_KEY,JSON.stringify(META)); }

export function hasValidRun(){
  const data=safeParse(localStorage.getItem(RUN_SAVE_KEY))||safeParse(localStorage.getItem(LEGACY_RUN_SAVE_KEY));
  return !!(data&&data.active&&data.seed&&Array.isArray(data.playerRoster));
}
export function saveRun(){
  if(!SAVE.active)return;
  SAVE.updatedAt=now();
  localStorage.setItem(RUN_SAVE_KEY,JSON.stringify(SAVE));
}
export function loadRun(){
  let data=safeParse(localStorage.getItem(RUN_SAVE_KEY));
  if(!data){
    const legacy=safeParse(localStorage.getItem(LEGACY_RUN_SAVE_KEY));
    if(legacy?.active){data={...legacy,version:SAVE_VERSION,generatedMap:generateMap(legacy.mapNumber||1,legacy.seed)};localStorage.removeItem(LEGACY_RUN_SAVE_KEY);}
  }
  if(!data||data.version!==SAVE_VERSION||!data.active)return false;
  replaceObject(SAVE,{...freshRunState(),...data});
  if(!SAVE.generatedMap?.rows||SAVE.generatedMap.rows!==15)SAVE.generatedMap=generateMap(SAVE.mapNumber,SAVE.seed);
  saveRun();return true;
}

export function deleteRunSave(){ localStorage.removeItem(RUN_SAVE_KEY);localStorage.removeItem(LEGACY_RUN_SAVE_KEY);replaceObject(SAVE,freshRunState()); }

export function randomClass(){ return Phaser.Utils.Array.GetRandom(CLASS_KEYS); }
export function createRecruit(type = randomClass()){
  const pool = CLASSES[type]?.startingAbilityPool ?? CLASSES[type]?.abilityPool ?? [];
  const initial = pool.length ? [Phaser.Utils.Array.GetRandom(pool)] : [];
  return {id:SAVE.nextRecruitId++,type,level:1,xp:0,blessing:randomBlessing(CLASSES[type].defaultBlessing),learnedAbilities:initial,customName:null};
}
export function randomTeam(){ return [createRecruit(),createRecruit(),createRecruit()]; }

export function generateMap(mapNumber=1,seed=SAVE.seed){ return generateExpeditionMap(mapNumber,seed); }

export function resetRun(){
  replaceObject(SAVE,freshRunState());
  SAVE.active=true;SAVE.seed=(Date.now()^(Math.random()*0xffffffff))>>>0;SAVE.createdAt=now();
  SAVE.playerRoster=randomTeam();SAVE.generatedMap=generateMap(1,SAVE.seed);SAVE.currentNodeId=null;
  saveRun();
}
export function startNode(node){SAVE.pendingNodeId=node.id;SAVE.pendingNodeType=node.type;saveRun();}
export function completeCurrentNode({won=true,gold=0}={}){
  const id=SAVE.pendingNodeId;if(!id)return;
  if(won){if(!SAVE.visitedNodes.includes(id))SAVE.visitedNodes.push(id);SAVE.lastCompletedNodeId=id;SAVE.currentNodeId=id;SAVE.gold+=gold;SAVE.totalGoldEarned+=gold;}
  SAVE.pendingNodeId=null;SAVE.pendingNodeType=null;SAVE.round=SAVE.visitedNodes.length+1;saveRun();
}
export function advanceAfterBoss(){SAVE.mapNumber++;SAVE.generatedMap=generateMap(SAVE.mapNumber,SAVE.seed);SAVE.currentNodeId=null;SAVE.lastCompletedNodeId=null;saveRun();}
export function loseLife(){SAVE.lives=Math.max(0,SAVE.lives-1);SAVE.pendingNodeId=null;SAVE.pendingNodeType=null;saveRun();return SAVE.lives;}
export function finishRun(){
  loadMeta();const earned=Math.max(0,Math.floor(SAVE.totalGoldEarned/10)+SAVE.mapNumber-1);META.permanentCurrency+=earned;META.completedRuns++;saveMeta();deleteRunSave();return earned;
}
