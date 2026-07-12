import { GAME } from '../config.js';
import { SAVE, generateMap, saveRun, startNode } from '../data/save.js';
import { calculateDifficulty } from '../systems/difficulty.js';
import { makeButton, flashText } from '../utils/helpers.js';

const LABELS={combat:'Combate',recruit:'Reclutamiento',relic:'Reliquia',merchant:'Mercader',event:'Evento',boss:'Boss'};
const TEXTURES={combat:'mapCombat',recruit:'mapRecruit',relic:'mapRelic',merchant:'mapMerchant',event:'mapEvent',boss:'mapBoss'};
const SELECTED={combat:'mapCombatSelected',recruit:'mapRecruitSelected',relic:'mapRelicSelected',merchant:'mapMerchantSelected',event:'mapEventSelected',boss:'mapBossSelected'};

export class MapScene extends Phaser.Scene{
  constructor(){super('Map');}
  create(){
    if(!SAVE.generatedMap)SAVE.generatedMap=generateMap(SAVE.mapNumber,SAVE.seed);
    this.selectedNodeId=null;
    this.add.image(GAME.width/2,GAME.height/2,'mapBg').setDisplaySize(GAME.width,GAME.height);
    this.add.rectangle(GAME.width/2,GAME.height/2,GAME.width,GAME.height,0x080510,.42);
    this.add.rectangle(640,368,930,640,0x100b18,.74).setStrokeStyle(2,0x725f82,.8);
    this.add.text(34,20,`MAPA ${SAVE.mapNumber}`,{fontSize:'30px',fontStyle:'bold',color:'#fff'});
    this.add.text(1245,24,`VIDAS ${'♥'.repeat(SAVE.lives)}${'♡'.repeat(3-SAVE.lives)}  ·  ORO ${SAVE.gold}`,{fontSize:'20px',fontStyle:'bold',color:'#ffe596'}).setOrigin(1,0);
    this.hint=this.add.text(640,24,'PULSA DOS VECES EL MISMO NODO PARA ENTRAR',{fontSize:'18px',fontStyle:'bold',color:'#f4e5ff'}).setOrigin(.5,0);
    this.info=this.add.text(1135,120,'',{fontSize:'16px',color:'#eee5f2',align:'center',lineSpacing:8,wordWrap:{width:240}}).setOrigin(.5,0);
    this.drawMap();
    makeButton(this,1135,670,230,42,'GUARDAR Y MENÚ',()=>{saveRun();this.scene.start('Menu');});
  }
  reachableIds(){
    const map=SAVE.generatedMap;
    if(!SAVE.currentNodeId)return [map.startNodeId];
    return map.nodes.find(n=>n.id===SAVE.currentNodeId)?.links||[];
  }
  position(node){return {x:245+node.col*145,y:650-node.row*41.5};}
  drawDottedPath(a,b,active){
    const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),steps=Math.max(2,Math.floor(d/17));
    for(let i=1;i<steps;i++){
      const t=i/steps;this.add.image(a.x+dx*t,a.y+dy*t,active?'mapPathActive':'mapPath').setDisplaySize(active?10:8,active?10:8).setAlpha(active?.95:.55);
    }
  }
  drawMap(){
    const nodes=SAVE.generatedMap.nodes,reachable=this.reachableIds(),visited=new Set(SAVE.visitedNodes);
    nodes.forEach(n=>n.links.forEach(id=>{const t=nodes.find(q=>q.id===id);if(t){const active=visited.has(n.id)&&visited.has(t.id);this.drawDottedPath(this.position(n),this.position(t),active);}}));
    nodes.forEach(n=>{
      const {x,y}=this.position(n),isVisited=visited.has(n.id),isCurrent=SAVE.currentNodeId===n.id,can=reachable.includes(n.id);
      const state=isCurrent?'mapStateCurrent':isVisited?'mapStateCompleted':can?'mapStateAvailable':'mapStateLocked';
      const stateImage=this.add.image(x,y,state).setDisplaySize(62,62).setAlpha(isVisited&&!isCurrent?.72:1);
      const icon=this.add.image(x,y,TEXTURES[n.type]).setDisplaySize(n.type==='boss'?48:42,n.type==='boss'?48:42).setAlpha(!can&&!isVisited?.48:1);
      this.add.text(x+31,y-27,`${n.row+1}`,{fontSize:'10px',fontStyle:'bold',color:'#d9cde1'}).setOrigin(.5);
      if(can){
        stateImage.setInteractive({useHandCursor:true});icon.setInteractive({useHandCursor:true});
        const handler=()=>this.selectNode(n,icon);stateImage.on('pointerdown',handler);icon.on('pointerdown',handler);
        icon.on('pointerover',()=>icon.setTexture(SELECTED[n.type])).on('pointerout',()=>{if(this.selectedNodeId!==n.id)icon.setTexture(TEXTURES[n.type]);});
      }
    });
  }
  selectNode(node,icon){
    const difficulty=calculateDifficulty(SAVE,node);
    this.info.setText(`${LABELS[node.type].toUpperCase()}\nNivel ${node.row+1} de 15\nDificultad estimada: ${difficulty.score}\n\n${this.selectedNodeId===node.id?'Pulsa otra vez para confirmar.':'Primera pulsación: nodo seleccionado.'}`);
    if(this.selectedNodeId!==node.id){
      this.selectedNodeId=node.id;icon.setTexture(SELECTED[node.type]);
      flashText(this,640,690,`Seleccionado: ${LABELS[node.type]}. Pulsa otra vez para entrar.`,0xffe596);return;
    }
    startNode({...node,difficulty});
    if(node.type==='combat'||node.type==='boss'){this.scene.start('Placement',{nodeType:node.type,difficulty});return;}
    this.scene.start('NodeEvent',{nodeType:node.type,nodeId:node.id,difficulty});
  }
}
