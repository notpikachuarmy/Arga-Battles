import { getAIProfile } from '../data/aiProfiles.js';

const distance=(a,b)=>Math.abs(a.col-b.col)+Math.abs(a.row-b.row);
const hpRatio=u=>u.maxHp>0?u.hp/u.maxHp:0;

export function visibleEnemies(scene,u,enemyTeam){
  return scene.units.filter(t=>t.alive&&t.team===enemyTeam&&!t.isObstacle&&!t.buffs.some(b=>b.id==='stealth'&&distance(u,t)>1));
}

export function scoreAbilityAction(scene,u,enemyTeam,a,cell){
  const p=getAIProfile(u.aiProfile),t=cell?scene.unitAt(cell.col,cell.row):u,data=a.effectData||{};
  if(a.targetMode==='frontEmpty'){
    if(!cell)return -Infinity;
    const isWall=!!data.isObstacle;
    const allies=scene.units.filter(x=>x.alive&&x.team===u.team&&!x.isObstacle);
    const weak=allies.some(x=>hpRatio(x)<.45);
    return (isWall?(weak?75:22):62)*p.summon;
  }
  if(a.targetMode==='ally'){
    if(!t||t.team!==u.team||t.hp>=t.maxHp)return -Infinity;
    return (75+(1-hpRatio(t))*125+(t===u?5:0))*p.heal*p.protectWeak;
  }
  if(a.targetMode==='deadAlly')return t?-Infinity:145*p.heal;
  if(a.targetMode==='self'){
    if(['bloodThirst','crimsonPact'].includes(a.id)&&u.hp<=6)return -Infinity;
    const buffId=data.buff?.id||data.buffId;
    if(buffId&&u.buffs.some(b=>b.id===buffId))return -Infinity;
    return (45+(1-hpRatio(u))*25)*p.buff;
  }
  if(a.targetMode==='cell'){
    const victims=scene.units.filter(x=>x.alive&&x.team===enemyTeam&&distance(x,cell)<=Number(data.radius||0));
    return (30+victims.length*55)*p.damage*p.aoe;
  }
  if(!t||t.team!==enemyTeam)return -Infinity;
  const expected=Number(data.base||0)+(Number(data.die||0)+1)/2;
  const kill=t.hp<=Math.max(1,expected+Math.floor((u.str+u.int)/4));
  return (80+(1-hpRatio(t))*45*p.focusWeak+(kill?115*p.finisher:0))*p.damage;
}

export function bestAbilityAction(scene,u,enemyTeam){
  const abilities=scene.abilitiesFor(u).filter(a=>u.ap>=a.apCost&&u.mp>=scene.abilityMpCost(u,a)&&scene.abilityCooldown(u,a)<=0&&!u.usedAbilitiesThisTurn?.includes(a.id)&&!a._aiBlocked);
  let best=null;
  for(const a of abilities){
    const candidates=a.targetMode==='self'?[{col:u.col,row:u.row}]:scene.skillCells(u,a);
    for(const cell of candidates){
      const score=scoreAbilityAction(scene,u,enemyTeam,a,cell);
      if(Number.isFinite(score)&&(!best||score>best.score))best={ability:a,cell,score};
    }
  }
  return best;
}

export function bestMove(scene,u,enemyTeam){
  const p=getAIProfile(u.aiProfile),targets=visibleEnemies(scene,u,enemyTeam),moves=scene.validMoves(u);
  if(!targets.length||!moves.length)return null;
  const allies=scene.units.filter(x=>x.alive&&x.team===u.team&&!x.isObstacle&&x!==u);
  const current=Math.min(...targets.map(t=>distance(u,t)));
  return moves.map(m=>{
    const nearest=Math.min(...targets.map(t=>distance(m,t)));
    const target=targets.slice().sort((a,b)=>distance(m,a)-distance(m,b)||hpRatio(a)-hpRatio(b))[0];
    const front=targets.some(t=>t.row===m.row&&t.col===m.col+(u.team==='player'?1:-1));
    const side=Math.abs(m.row-target.row)>0&&nearest<=2;
    const allyNear=allies.some(a=>distance(m,a)<=1);
    const threatened=hpRatio(u)<.35;
    let score=(current-nearest)*22*p.advance+(nearest-current)*18*p.retreat;
    score+=(front?75:0)*p.advance+(side?38:0)*p.flank+(allyNear?12:0)*p.protectWeak;
    if(threatened)score+=(nearest-current)*45*p.retreat;
    return{...m,score:score*p.move};
  }).sort((a,b)=>b.score-a.score)[0]||null;
}
