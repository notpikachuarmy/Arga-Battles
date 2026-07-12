import { BALANCE } from '../config.js';
import { CLASS_KEYS, CLASSES } from './classes.js';
import { randomBlessing } from './blessings.js';

export const SAVE_VERSION = 1;
export const RUN_SAVE_KEY = 'argaBattles.run.v1';
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
  const data=safeParse(localStorage.getItem(RUN_SAVE_KEY));
  return !!(data&&data.version===SAVE_VERSION&&data.active&&data.seed&&Array.isArray(data.playerRoster));
}
export function saveRun(){
  if(!SAVE.active)return;
  SAVE.updatedAt=now();
  localStorage.setItem(RUN_SAVE_KEY,JSON.stringify(SAVE));
}
export function loadRun(){
  const data=safeParse(localStorage.getItem(RUN_SAVE_KEY));
  if(!data||data.version!==SAVE_VERSION||!data.active)return false;
  replaceObject(SAVE,{...freshRunState(),...data});
  return true;
}
export function deleteRunSave(){ localStorage.removeItem(RUN_SAVE_KEY);replaceObject(SAVE,freshRunState()); }

export function randomClass(){ return Phaser.Utils.Array.GetRandom(CLASS_KEYS); }
export function createRecruit(type = randomClass()){
  const pool = CLASSES[type]?.startingAbilityPool ?? CLASSES[type]?.abilityPool ?? [];
  const initial = pool.length ? [Phaser.Utils.Array.GetRandom(pool)] : [];
  return {id:SAVE.nextRecruitId++,type,level:1,xp:0,blessing:randomBlessing(CLASSES[type].defaultBlessing),learnedAbilities:initial,customName:null};
}
export function randomTeam(){ return [createRecruit(),createRecruit(),createRecruit()]; }

function seeded(seed){
  let s=seed>>>0;
  return ()=>{s=(s+0x6D2B79F5)|0;let t=Math.imul(s^(s>>>15),1|s);t=(t+Math.imul(t^(t>>>7),61|t))^t;return ((t^(t>>>14))>>>0)/4294967296;};
}
export function generateMap(mapNumber=1,seed=SAVE.seed){
  const rand=seeded((seed+mapNumber*2654435761)>>>0),nodes=[];
  let previous=['m'+mapNumber+'-0-1'];
  nodes.push({id:previous[0],row:0,col:1,type:'combat',links:[]});
  for(let row=1;row<14;row++){
    const count=rand()<.32?2:rand()<.08?3:1;
    const cols=[0,1,2].sort(()=>rand()-.5).slice(0,count).sort();
    const current=cols.map(col=>`m${mapNumber}-${row}-${col}`);
    current.forEach((id,i)=>nodes.push({id,row,col:cols[i],type:row%5===0?'reward':'combat',links:[]}));
    previous.forEach((pid,pi)=>{
      const p=nodes.find(n=>n.id===pid); const ordered=[...current].sort((a,b)=>Math.abs(nodes.find(n=>n.id===a).col-(p?.col??1))-Math.abs(nodes.find(n=>n.id===b).col-(p?.col??1)));
      p.links=ordered.slice(0,Math.min(2,ordered.length));
    });
    current.forEach(cid=>{if(!previous.some(pid=>nodes.find(n=>n.id===pid)?.links.includes(cid))){const p=nodes.find(n=>n.id===previous[Math.floor(rand()*previous.length)]);p.links.push(cid);}});
    previous=current;
  }
  const bossId=`m${mapNumber}-14-1`;nodes.push({id:bossId,row:14,col:1,type:'boss',links:[]});
  previous.forEach(pid=>nodes.find(n=>n.id===pid).links=[bossId]);
  return {mapNumber,seed,nodes,startNodeId:nodes[0].id,bossNodeId:bossId};
}

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
