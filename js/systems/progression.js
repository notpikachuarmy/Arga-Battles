import { GAME, BALANCE } from '../config.js';
import { CLASSES } from '../data/classes.js';
import { SAVE } from '../data/save.js';
import { hasRelic } from '../data/relics.js';

export function xpNeeded(level){
  return BALANCE.xpNeededBase + (level - 1) * BALANCE.xpNeededPerLevel;
}

export function soldierCost(recruit){ return recruit.level; }

export function calculateStats(type, level){
  const b=CLASSES[type];
  const progress=Math.max(0,Math.min(1,(level-1)/(GAME.maxLevel-1)));
  const grow=(stat)=>b[stat]+Math.floor((b.growth?.[stat]??0)*progress);
  const constitution=grow('constitution');
  const energy=grow('energy');
  return {
    maxHp: constitution*5,
    maxMp: energy*5,
    df:grow('df'), str:grow('str'), int:grow('int'), agi:grow('agi'),
    constitution, energy,
    charisma:grow('charisma'), will:grow('will'),
    stealth:Math.min(50,grow('stealth')), perception:grow('perception')
  };
}

export function earlyEnemyScaling(round){
  if(round<=1)return{hp:.65,combat:.70,label:'Muy debilitado'};
  if(round===2)return{hp:.78,combat:.80,label:'Debilitado'};
  if(round===3)return{hp:.90,combat:.90,label:'Ligeramente debilitado'};
  return{hp:1,combat:1,label:null};
}

function queueSkillChoice(recruit){
  const pool=CLASSES[recruit.type]?.abilityPool??[];
  const available=Phaser.Utils.Array.Shuffle(pool.filter(id=>!recruit.learnedAbilities.includes(id)));
  if(!available.length)return [];
  const count=hasRelic(SAVE,'livingLibrary')?3:2;
  const options=available.slice(0,Math.min(count,available.length));
  SAVE.pendingSkillChoices.push({recruitId:recruit.id,options});
  return options;
}

export function awardGlobalXp(amount){
  const actualAmount=Math.round(amount*(hasRelic(SAVE,'apprenticeRelic')?1.2:1));
  const results=[];
  SAVE.playerRoster.forEach(recruit=>{
    const previousLevel=recruit.level;
    const learned=[];
    if(recruit.level<GAME.maxLevel){
      recruit.xp+=actualAmount;
      recruit.totalXpEarned=(Number(recruit.totalXpEarned)||0)+actualAmount;
      while(recruit.level<GAME.maxLevel&&recruit.xp>=xpNeeded(recruit.level)){
        recruit.xp-=xpNeeded(recruit.level);
        recruit.level++;
        if(GAME.abilityLevels.includes(recruit.level)){
          const options=queueSkillChoice(recruit);
          if(options.length)learned.push(...options);
        }
      }
      if(recruit.level>=GAME.maxLevel)recruit.xp=0;
    }
    results.push({
      recruitId:recruit.id,
      name:recruit.customName?.trim()||CLASSES[recruit.type].name,
      previousLevel,
      newLevel:recruit.level,
      leveled:recruit.level>previousLevel,
      learned,
      xp:recruit.xp,
      xpToNext:recruit.level<GAME.maxLevel?xpNeeded(recruit.level):0,
      awardedXp:actualAmount
    });
  });
  return results;
}
