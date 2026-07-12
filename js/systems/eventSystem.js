import { DATA } from '../data/registry.js';
import { SAVE, META, saveRun, saveMeta, loadMeta } from '../data/save.js';
import { RELICS, RELIC_KEYS } from '../data/relics.js';
import { CLASSES } from '../data/classes.js';
import { awardGlobalXp, xpNeeded } from './progression.js';

export const EVENTS=DATA.events;
export const JOURNAL=DATA.journal;
export const RARITY_ORDER=['N','R','SR','SSR','UR'];

export function availableRelicIds({excludeOwned=true}={}){
  const blocked=new Set([...(excludeOwned?SAVE.relics||[]:[]),...(SAVE.retiredRelics||[])]);
  return RELIC_KEYS.filter(id=>!blocked.has(id));
}
export function discoverRelic(id){
  loadMeta();
  META.discoveredRelics??=[];
  if(!META.discoveredRelics.includes(id)){META.discoveredRelics.push(id);saveMeta();}
}
export function acquireRelic(id){
  if(!id||SAVE.relics.includes(id))return false;
  SAVE.relics.push(id);discoverRelic(id);saveRun();return true;
}
export function removeOwnedRelic(id){
  const index=SAVE.relics.indexOf(id);if(index<0)return false;
  SAVE.relics.splice(index,1);return true;
}
export function accumulatedXp(recruit){
  if(Number.isFinite(recruit.totalXpEarned))return recruit.totalXpEarned;
  let total=Number(recruit.xp)||0;
  for(let level=1;level<(recruit.level||1);level++)total+=xpNeeded(level);
  return total;
}
export function unitsWithSkillSpace(){
  return SAVE.playerRoster.filter(unit=>(unit.learnedAbilities?.length||0)<3&&(CLASSES[unit.type]?.abilityPool||[]).some(id=>!unit.learnedAbilities.includes(id)));
}
export function nextAbilityFor(unit){
  const pool=(CLASSES[unit.type]?.abilityPool||[]).filter(id=>!unit.learnedAbilities.includes(id));
  return pool.length?Phaser.Utils.Array.GetRandom(pool):null;
}
export function higherRelicsFor(id){
  const rank=RARITY_ORDER.indexOf(RELICS[id]?.rarity);
  return availableRelicIds().filter(candidate=>RARITY_ORDER.indexOf(RELICS[candidate]?.rarity)>rank);
}
export function eligibleCollectorRelics(){return SAVE.relics.filter(id=>higherRelicsFor(id).length);}
export function unknownJournalIds(){
  loadMeta();META.journalEntries??=[];
  return Object.keys(JOURNAL).filter(id=>!META.journalEntries.includes(id));
}
export function unlockJournal(id){
  loadMeta();META.journalEntries??=[];
  if(!META.journalEntries.includes(id))META.journalEntries.push(id);
  if(!SAVE.journalEntries.includes(id))SAVE.journalEntries.push(id);
  saveMeta();saveRun();
}
export function eventIsAvailable(id){
  switch(id){
    case 'alchemist': return SAVE.relics.length>0&&availableRelicIds().length>0;
    case 'ancientAltar': return SAVE.lives>1&&availableRelicIds().length>0;
    case 'weaponsMaster': return unitsWithSkillSpace().length>0;
    case 'necromancer': return SAVE.playerRoster.length>1;
    case 'collector': return eligibleCollectorRelics().length>0;
    case 'journalEntry': return unknownJournalIds().length>0;
    default:return false;
  }
}
export function chooseEvent(){
  const ids=Object.keys(EVENTS).filter(eventIsAvailable).filter(id=>!EVENTS[id].uniquePerRun||!SAVE.usedUniqueEvents.includes(id));
  return ids.length?Phaser.Utils.Array.GetRandom(ids):null;
}
export function markEventSeen(id){
  loadMeta();META.seenEvents??=[];
  if(!META.seenEvents.includes(id))META.seenEvents.push(id);
  if(EVENTS[id]?.uniquePerRun&&!SAVE.usedUniqueEvents.includes(id))SAVE.usedUniqueEvents.push(id);
  saveMeta();saveRun();
}
export function sacrificeUnit(unit){
  const amount=Math.floor(accumulatedXp(unit)*.30);
  SAVE.playerRoster=SAVE.playerRoster.filter(candidate=>candidate.id!==unit.id);
  const results=amount>0?awardGlobalXp(amount):[];
  saveRun();return{amount,results};
}
