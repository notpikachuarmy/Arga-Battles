import { GAME } from '../config.js';
import { CLASSES } from '../data/classes.js';
import { CLASS_ABILITY_POOLS } from '../data/abilities.js';
import { SAVE } from '../data/save.js';

export function xpNeeded(level){ return 50 + (level - 1) * 35; }
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
    df:grow('df'),
    str:grow('str'),
    int:grow('int'),
    agi:grow('agi'),
    constitution,
    energy,
    charisma:grow('charisma'),
    will:grow('will'),
    stealth:Math.min(50,grow('stealth')),
    perception:grow('perception')
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
