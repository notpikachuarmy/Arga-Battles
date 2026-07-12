export const MAP_ROWS = 15;
export const MAP_COLS = 5;
export const NODE_TYPES = Object.freeze({
  COMBAT:'combat', RECRUIT:'recruit', RELIC:'relic', MERCHANT:'merchant', EVENT:'event', BOSS:'boss'
});

function seeded(seed){
  let s=seed>>>0;
  return ()=>{s=(s+0x6D2B79F5)|0;let t=Math.imul(s^(s>>>15),1|s);t=(t+Math.imul(t^(t>>>7),61|t))^t;return ((t^(t>>>14))>>>0)/4294967296;};
}
function pick(rand,list){return list[Math.floor(rand()*list.length)];}
function shuffle(rand,list){const out=[...list];for(let i=out.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;}

const TYPE_LIMITS={recruit:2,relic:2,merchant:2,event:4};
const MIN_COMBATS=7;

function chooseType(rand,row,counts,previousTypes){
  const weights=[['combat',58],['event',16],['recruit',9],['relic',9],['merchant',8]]
    .filter(([type])=>type==='combat'||counts[type]<(TYPE_LIMITS[type]??99))
    .map(([type,weight])=>[type,previousTypes.every(t=>t===type)?Math.max(1,weight*.12):weight]);
  const total=weights.reduce((a,[,w])=>a+w,0);let roll=rand()*total;
  for(const [type,w] of weights){roll-=w;if(roll<=0)return type;}
  return 'combat';
}

export function generateExpeditionMap(mapNumber=1,seed=1){
  const rand=seeded((seed+(mapNumber*2654435761))>>>0),nodes=[],byRow=[];
  const counts={combat:0,recruit:0,relic:0,merchant:0,event:0,boss:0};
  for(let row=0;row<MAP_ROWS;row++){
    let cols;
    if(row===0||row===MAP_ROWS-1)cols=[2];
    else{
      const nodeCount=rand()<.18?3:rand()<.66?2:1;
      cols=shuffle(rand,[0,1,2,3,4]).slice(0,nodeCount).sort((a,b)=>a-b);
    }
    byRow[row]=cols.map(col=>{
      const id=`m${mapNumber}-r${row}-c${col}`;
      const previousTypes=nodes.filter(n=>n.row>=Math.max(0,row-2)&&n.row<row).map(n=>n.type);
      const type=row===MAP_ROWS-1?'boss':chooseType(rand,row,counts,previousTypes);
      counts[type]++;
      const node={id,row,col,type,links:[]};nodes.push(node);return node;
    });
  }

  for(let row=0;row<MAP_ROWS-1;row++){
    const current=byRow[row],next=byRow[row+1];
    current.forEach(node=>{
      const ordered=[...next].sort((a,b)=>Math.abs(a.col-node.col)-Math.abs(b.col-node.col));
      node.links=[ordered[0].id];
      if(next.length>1&&rand()<.42)node.links.push(ordered[1].id);
    });
    next.forEach(target=>{
      if(!current.some(source=>source.links.includes(target.id))){
        const nearest=[...current].sort((a,b)=>Math.abs(a.col-target.col)-Math.abs(b.col-target.col))[0];
        nearest.links.push(target.id);
      }
    });
  }

  // Garantiza suficientes combates sin tocar inicio ni boss.
  if(counts.combat<MIN_COMBATS){
    const candidates=shuffle(rand,nodes.filter(n=>n.row>0&&n.row<MAP_ROWS-1&&n.type!=='combat'));
    while(counts.combat<MIN_COMBATS&&candidates.length){const n=candidates.pop();counts[n.type]--;n.type='combat';counts.combat++;}
  }

  return {version:2,mapNumber,seed,rows:MAP_ROWS,cols:MAP_COLS,nodes,startNodeId:byRow[0][0].id,bossNodeId:byRow[MAP_ROWS-1][0].id};
}

export function validateExpeditionMap(map){
  const errors=[],ids=new Set(map?.nodes?.map(n=>n.id)||[]);
  if(!map||map.rows!==MAP_ROWS)errors.push('El mapa no tiene 15 niveles.');
  map?.nodes?.forEach(n=>n.links.forEach(id=>{if(!ids.has(id))errors.push(`Enlace inválido ${n.id} -> ${id}`);}));
  const incoming=new Map(map?.nodes?.map(n=>[n.id,0])||[]);
  map?.nodes?.forEach(n=>n.links.forEach(id=>incoming.set(id,(incoming.get(id)||0)+1)));
  map?.nodes?.filter(n=>n.id!==map.startNodeId).forEach(n=>{if(!incoming.get(n.id))errors.push(`Nodo aislado: ${n.id}`);});
  return {valid:errors.length===0,errors};
}
