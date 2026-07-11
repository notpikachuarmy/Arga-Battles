import { GAME } from '../config.js';
import { CLASSES } from '../data/classes.js';
import { CLASS_ABILITY_POOLS } from '../data/abilities.js';
import { SAVE } from '../data/save.js';

export function xpNeeded(level){ return 50 + (level - 1) * 35; }
export function soldierCost(recruit){ return recruit.level; }

export function calculateStats(type, level){
  const b=CLASSES[type];
  const steps=Math.floor((level-1)/2);
  const constitution=b.constitution+steps;
  const energy=b.energy+steps;
  return {
    maxHp: constitution*5,
    maxMp: energy*5,
    df:b.df+steps,
    str:b.str+steps,
    int:b.int+steps,
    agi:b.agi+Math.floor((level-1)/3),
    constitution,
    energy,
    charisma:b.charisma+Math.floor((level-1)/3),
    will:b.will+Math.floor((level-1)/3),
    stealth:Math.min(50,b.stealth+Math.floor((level-1)/2)),
    perception:b.perception+Math.floor((level-1)/3)
  };
}

export function earlyEnemyScaling(round){
  if(round<=1)return{hp:.65,combat:.70,label:'Muy debilitado'};
  if(round===2)return{hp:.78,combat:.80,label:'Debilitado'};
  if(round===3)return{hp:.90,combat:.90,label:'Ligeramente debilitado'};
  return{hp:1,combat:1,label:null};
}

function learnRandomAvailable(recruit){
  const pool=CLASS_ABILITY_POOLS[recruit.type]??[];
  const available=pool.filter(id=>!recruit.learnedAbilities.includes(id));
  if(!available.length)return null;
  const id=Phaser.Utils.Array.GetRandom(available);
  recruit.learnedAbilities.push(id);
  return id;
}

export function awardGlobalXp(amount){
  const levelUps=[];
  SAVE.playerRoster.forEach(recruit=>{
    if(recruit.level>=GAME.maxLevel)return;
    recruit.xp+=amount;
    const learned=[];
    while(recruit.level<GAME.maxLevel&&recruit.xp>=xpNeeded(recruit.level)){
      recruit.xp-=xpNeeded(recruit.level);
      recruit.level++;
      if(GAME.abilityLevels.includes(recruit.level)){
        const ability=learnRandomAvailable(recruit);
        if(ability)learned.push(ability);
      }
    }
    if(recruit.level>=GAME.maxLevel)recruit.xp=0;
    if(learned.length||recruit.level>1)levelUps.push({name:CLASSES[recruit.type].name,newLevel:recruit.level,learned});
  });
  return levelUps;
}
