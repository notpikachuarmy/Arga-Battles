import { rollDie } from '../utils/dice.js';
import { flashText } from '../utils/helpers.js';

function targetAt(scene, targetCell){
  return targetCell ? scene.unitAt(targetCell.col,targetCell.row) : null;
}

function scaleValue(unit, scaling={}){
  return Object.entries(scaling).reduce((total,[stat,divisor])=>total+Math.floor((unit[stat]||0)/divisor),0);
}

function rollFormula(unit, data={}){
  const die=data.die?rollDie(data.die):0;
  return (data.base||0)+die+scaleValue(unit,data.scaling);
}

const handlers={
  projectileDamage(scene,u,targetCell,a,data){
    const target=targetAt(scene,targetCell);
    if(!target||target.team===u.team)return false;
    scene.breakStealth(u);
    const raw=rollFormula(u,data)-Math.floor((target.df||0)/(data.defenseDivisor||999));
    const relicBonus=data.relicBonus&&scene.teamHasRelic(u.team,data.relicBonus.id)?data.relicBonus.amount:0;
    const damage=Math.max(data.minimumDamage??1,raw)+scene.bonusDamage(u)+relicBonus;
    scene.dealDamage(u,target,damage,data.fx||'magic',()=>{
      if(data.status&&Math.random()<(data.status.chance??1))scene.addNegativeStatus(target,data.status.id,data.status.duration);
      scene.payAbility(u,a,data.apRefund||0);
    });
    return true;
  },

  applyStatusProjectile(scene,u,targetCell,a,data){
    const target=targetAt(scene,targetCell);
    if(!target||target.team===u.team)return false;
    scene.breakStealth(u);
    scene.addNegativeStatus(target,data.status.id,data.status.duration);
    flashText(scene,data.message||'¡Estado aplicado!',target.sprite.x,target.sprite.y-78,data.color??0xffffff);
    scene.payAbility(u,a,data.apRefund||0);
    return true;
  },

  areaDamage(scene,u,targetCell,a,data){
    const targets=scene.skillCells(u,a).map(p=>scene.unitAt(p.col,p.row)).filter(t=>t&&t.team!==u.team);
    if(!targets.length)return false;
    scene.breakStealth(u);
    for(const target of targets){
      const damage=Math.max(data.minimumDamage??1,rollFormula(u,data)-Math.floor((target.df||0)/(data.defenseDivisor||999)))+scene.bonusDamage(u);
      scene.applyInstantDamage(u,target,damage,data.fx||'magic');
    }
    scene.payAbility(u,a,data.apRefund||0);
    return true;
  },

  addBuff(scene,u,targetCell,a,data){
    const buffId=data.buff.id;
    if(data.unique&&u.buffs.some(b=>b.id===buffId)){
      scene.payAbility(u,a,data.apRefund||0);
      return true;
    }
    scene.addBuff(u,{...data.buff});
    if(data.spriteScale)u.sprite.setScale(data.spriteScale);
    if(data.fx)scene.spawnFx(u,data.fx);
    scene.payAbility(u,a,data.apRefund||0);
    return true;
  },

  addPersistentBuff(scene,u,targetCell,a,data){
    if(!u.buffs.some(b=>b.id===data.buff.id))u.buffs.push({...data.buff,justApplied:true});
    scene.payAbility(u,a,data.apRefund||0);
    return true;
  },

  summon(scene,u,targetCell,a,data){
    if(targetAt(scene,targetCell))return false;
    const summon=scene.spawnUnit(data.summonId,u.team,targetCell.col,targetCell.row,1,null,null,[],null,{
      isSummon:true,isObstacle:!!data.isObstacle,name:data.name,ownerId:u.id,persistentSummon:!!data.persistentSummon
    });
    if(data.hp){summon.maxHp=summon.hp=data.hp;}
    if(data.df!==undefined)summon.df=data.df;
    scene.drawUnit(summon);
    if(!data.isObstacle)scene.buildTurnQueue();
    scene.payAbility(u,a,data.apRefund||0);
    return true;
  },

  heal(scene,u,targetCell,a,data){
    const target=targetAt(scene,targetCell);
    if(!target||target.team!==u.team)return false;
    scene.heal(target,rollFormula(u,data));
    scene.payAbility(u,a,data.apRefund||0);
    return true;
  },

  resurrect(scene,u,targetCell,a,data){
    const dead=scene.units.find(t=>!t.alive&&t.team===u.team&&!t.isSummon&&t.col===targetCell.col&&t.row===targetCell.row);
    if(!dead||u[data.onceFlag])return false;
    u[data.onceFlag]=true;
    dead.alive=true;
    dead.hp=Math.max(1,Math.ceil(dead.maxHp*data.hpRatio));
    const occupant=scene.unitAt(dead.col,dead.row);
    if(occupant&&occupant!==dead){
      const free=scene.cells.find(c=>(u.team==='player'?c.c<3:c.c>=3)&&!scene.unitAt(c.c,c.r));
      if(free){dead.col=free.c;dead.row=free.r;}
    }
    const pos=scene.cellCenter(dead.col,dead.row);
    [dead.sprite,dead.hpBack,dead.hpBar,dead.arrow].forEach(x=>x.setVisible(true).setAlpha(1));
    dead.sprite.setPosition(pos.x,pos.y);dead.hpBack.setPosition(pos.x,pos.y-48);dead.hpBar.setPosition(pos.x-37,pos.y-48);dead.arrow.setPosition(pos.x,pos.y+48);
    scene.updateUnitHp(dead);scene.buildTurnQueue();scene.payAbility(u,a,data.apRefund||0);
    return true;
  },

  randomCellDamage(scene,u,targetCell,a,data){
    const center=targetCell;
    const near=scene.cells.filter(c=>Math.abs(c.c-center.col)+Math.abs(c.r-center.row)<=data.radius&&!(c.c===center.col&&c.r===center.row));
    Phaser.Utils.Array.Shuffle(near);
    const hits=[center,...near.slice(0,Math.max(0,data.cells-1))];
    for(const p of hits){
      scene.highlightCell(p.col,p.row,data.highlightColor);
      const target=scene.unitAt(p.col,p.row);
      if(target)scene.applyInstantDamage(u,target,data.damage,data.fx||'magic');
    }
    scene.payAbility(u,a,data.apRefund||0);
    return true;
  },

  perfectTransformation(scene,u,targetCell,a,data){
    const target=targetAt(scene,targetCell);
    if(!target||target===u)return false;
    const copiedStats=data.stats;
    const original={type:u.type,name:u.name,learnedAbilities:[...u.learnedAbilities]};
    for(const key of copiedStats)original[key]=u[key];
    u.type=target.type;u.name=target.name;
    for(const key of copiedStats)u[key]=target[key];
    u.learnedAbilities=[...target.learnedAbilities];u.sprite.setTexture(target.type);
    u.buffs.push({id:data.buffId,remaining:data.duration,original,justApplied:true});
    scene.payAbility(u,a,data.apRefund||0);
    return true;
  },

  copyLastEnemyAbility(scene,u,targetCell,a,data){
    const enemy=u.team==='player'?'enemy':'player';
    const copy=scene.lastAbilityByTeam[enemy];
    if(!copy){flashText(scene,data.noAbilityMessage,640,120,0xffbd69);return false;}
    u.copiedAbility=copy;u.buffs.push({id:data.buffId,remaining:data.duration,justApplied:true});
    scene.payAbility(u,a,data.apRefund||0);
    return true;
  },

  healthForResources(scene,u,targetCell,a,data){
    if(u.hp<=data.hpCost){flashText(scene,data.insufficientMessage,640,120,0xff7777);return false;}
    u.hp-=data.hpCost;u.ap+=data.apGain;
    scene.addBuff(u,{id:data.buff.id,remaining:data.buff.remaining,...data.buff});
    scene.updateUnitHp(u);scene.payAbility(u,a,data.apRefund||0);
    return true;
  },

  sacrificePercentBuff(scene,u,targetCell,a,data){
    const cost=Math.max(1,Math.floor(u.hp*data.hpRatio));
    u.hp=Math.max(1,u.hp-cost);scene.updateUnitHp(u);
    scene.addBuff(u,{...data.buff});scene.payAbility(u,a,data.apRefund||0);
    return true;
  },

  adjacentSacrificeDamage(scene,u,targetCell,a,data){
    const cost=Math.max(1,Math.floor(u.hp*data.hpRatio));
    u.hp=Math.max(1,u.hp-cost);scene.updateUnitHp(u);
    let kills=0;
    for(const target of scene.units.filter(t=>t.alive&&t.team!==u.team&&Math.abs(t.col-u.col)+Math.abs(t.row-u.row)===1)){
      const wasAlive=target.alive;
      scene.applyInstantDamage(u,target,data.baseDamage+scaleValue(u,data.scaling),data.fx||'magic');
      if(wasAlive&&!target.alive)kills++;
    }
    if(kills)scene.heal(u,kills*data.healPerKill);
    scene.payAbility(u,a,data.apRefund||0);
    return true;
  }
};

export const ABILITY_EFFECT_HANDLERS=Object.freeze(Object.keys(handlers));

export function executeAbilityEffect(scene,u,targetCell,a){
  const handler=handlers[a.effectHandler];
  if(!handler)throw new Error(`Manejador de habilidad desconocido: ${a.effectHandler} (${a.id})`);
  return handler(scene,u,targetCell,a,a.effectData||{});
}
