import { BALANCE } from '../config.js';
import { CLASS_KEYS, CLASSES } from './classes.js';
import { randomBlessing } from './blessings.js';
import { generateExpeditionMap } from '../systems/mapGenerator.js';

export const SAVE_VERSION = 3;
export const RUN_SAVE_KEY = 'argaBattles.run.v3';
export const PREVIOUS_RUN_SAVE_KEYS = ['argaBattles.run.v2','argaBattles.run.v1'];
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
  lastGoldTransaction: null,
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
  pendingBossReward: false,
  lastCompletedNodeId: null,
  createdAt: null,
  updatedAt: null
});

export const SAVE = freshRunState();
export const META = { version: 2, argaCores: 0, completedRuns: 0, lifetimeGoldEarned: 0, lastRunSummary: null, unlockedContent: [], discoveredRelics: [], seenEvents: [], journalEntries: [] };

function replaceObject(target, source){
  Object.keys(target).forEach(k=>delete target[k]);
  Object.assign(target, source);
}
function safeParse(raw){ try{return JSON.parse(raw);}catch{return null;} }
function now(){ return new Date().toISOString(); }

export function loadMeta(){
  const data=safeParse(localStorage.getItem(META_SAVE_KEY));
  if(data){
    const migrated={...META,...data};
    migrated.version=META.version;
    migrated.argaCores=Math.max(0,Math.floor(Number(data.argaCores ?? data.permanentCurrency) || 0));
    migrated.lifetimeGoldEarned=Math.max(0,Math.floor(Number(data.lifetimeGoldEarned) || 0));
    migrated.discoveredRelics=data.discoveredRelics||[];
    migrated.seenEvents=data.seenEvents||[];
    migrated.journalEntries=data.journalEntries||[];
    delete migrated.permanentCurrency;
    replaceObject(META,migrated);
    saveMeta();
  }
  return META;
}
export function saveMeta(){ localStorage.setItem(META_SAVE_KEY,JSON.stringify(META)); }

function storedRun(){
  return safeParse(localStorage.getItem(RUN_SAVE_KEY)) || PREVIOUS_RUN_SAVE_KEYS.map(key=>safeParse(localStorage.getItem(key))).find(Boolean) || null;
}
export function hasValidRun(){
  const data=storedRun();
  return !!(data&&data.active&&data.seed&&Array.isArray(data.playerRoster));
}
export function saveRun(){
  if(!SAVE.active)return;
  SAVE.updatedAt=now();
  localStorage.setItem(RUN_SAVE_KEY,JSON.stringify(SAVE));
}
export function loadRun(){
  let data=storedRun();
  if(data?.active&&data.version!==SAVE_VERSION){
    data={...freshRunState(),...data,version:SAVE_VERSION};
    if(!data.generatedMap?.rows)data.generatedMap=generateMap(data.mapNumber||1,data.seed);
    PREVIOUS_RUN_SAVE_KEYS.forEach(key=>localStorage.removeItem(key));
  }
  if(!data||data.version!==SAVE_VERSION||!data.active)return false;
  replaceObject(SAVE,{...freshRunState(),...data});
  SAVE.playerRoster.forEach(unit=>{if(!Number.isFinite(unit.totalXpEarned)){let total=Number(unit.xp)||0;for(let level=1;level<(unit.level||1);level++)total+=BALANCE.xpNeededBase+(level-1)*BALANCE.xpNeededPerLevel;unit.totalXpEarned=total;}unit.learnedAbilities??=[];});
  if(!SAVE.generatedMap?.rows||SAVE.generatedMap.rows!==15)SAVE.generatedMap=generateMap(SAVE.mapNumber,SAVE.seed);
  saveRun();return true;
}

export function deleteRunSave(){ localStorage.removeItem(RUN_SAVE_KEY);PREVIOUS_RUN_SAVE_KEYS.forEach(key=>localStorage.removeItem(key));replaceObject(SAVE,freshRunState()); }

export function unlockedClassKeys(){
  const explicit=(SAVE.unlockedContent||[]).map(String);
  const unlocked=CLASS_KEYS.filter(id=>explicit.includes(id)||explicit.includes(`class:${id}`));
  return unlocked.length?unlocked:CLASS_KEYS;
}
export function randomClass(){ return Phaser.Utils.Array.GetRandom(unlockedClassKeys()); }
export function createRecruit(type = randomClass()){
  const pool = CLASSES[type]?.startingAbilityPool ?? CLASSES[type]?.abilityPool ?? [];
  const initial = pool.length ? [Phaser.Utils.Array.GetRandom(pool)] : [];
  return {id:SAVE.nextRecruitId++,type,level:1,xp:0,totalXpEarned:0,blessing:randomBlessing(CLASSES[type].defaultBlessing),learnedAbilities:initial,customName:null};
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
export function earnGold(amount, source='unknown'){
  const value=Math.max(0,Math.floor(Number(amount)||0));
  if(!value)return 0;
  SAVE.gold+=value;
  SAVE.totalGoldEarned+=value;
  SAVE.lastGoldTransaction={type:'earn',amount:value,source,at:now()};
  saveRun();
  return value;
}
export function canAffordGold(amount){return SAVE.gold>=Math.max(0,Math.floor(Number(amount)||0));}
export function spendGold(amount, source='unknown'){
  const value=Math.max(0,Math.floor(Number(amount)||0));
  if(!canAffordGold(value))return false;
  SAVE.gold-=value;
  SAVE.lastGoldTransaction={type:'spend',amount:value,source,at:now()};
  saveRun();
  return true;
}
export function completeCurrentNode({won=true,gold=0,goldSource='node'}={}){
  const id=SAVE.pendingNodeId;if(!id)return;
  if(won){
    if(!SAVE.visitedNodes.includes(id))SAVE.visitedNodes.push(id);
    SAVE.lastCompletedNodeId=id;SAVE.currentNodeId=id;
    earnGold(gold,goldSource);
  }
  SAVE.pendingNodeId=null;SAVE.pendingNodeType=null;SAVE.round=SAVE.visitedNodes.length+1;saveRun();
}
export function advanceAfterBoss(){SAVE.mapNumber++;SAVE.generatedMap=generateMap(SAVE.mapNumber,SAVE.seed);SAVE.currentNodeId=null;SAVE.lastCompletedNodeId=null;saveRun();}
export function loseLife(){SAVE.lives=Math.max(0,SAVE.lives-1);SAVE.pendingNodeId=null;SAVE.pendingNodeType=null;saveRun();return SAVE.lives;}
export function finishRun(){
  loadMeta();
  const totalGoldEarned=Math.max(0,Math.floor(Number(SAVE.totalGoldEarned)||0));
  const coresEarned=Math.floor(totalGoldEarned*0.10);
  const summary={coresEarned,totalGoldEarned,goldRemaining:Math.max(0,Math.floor(SAVE.gold||0)),mapNumber:SAVE.mapNumber,nodesCompleted:SAVE.visitedNodes.length,finishedAt:now()};
  META.argaCores+=coresEarned;
  META.lifetimeGoldEarned+=totalGoldEarned;
  META.completedRuns++;
  META.lastRunSummary=summary;
  saveMeta();deleteRunSave();return summary;
}
