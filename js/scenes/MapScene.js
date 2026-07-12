import { GAME } from '../config.js';
import { SAVE, generateMap, saveRun, startNode, advanceAfterBoss } from '../data/save.js';
import { makeButton, flashText } from '../utils/helpers.js';

export class MapScene extends Phaser.Scene{
  constructor(){super('Map');}
  create(){
    if(!SAVE.generatedMap)SAVE.generatedMap=generateMap(SAVE.mapNumber,SAVE.seed);
    this.add.image(GAME.width/2,GAME.height/2,'menuBg').setDisplaySize(GAME.width,GAME.height);
    this.add.rectangle(GAME.width/2,GAME.height/2,GAME.width,GAME.height,0x080510,.78);
    this.add.text(40,24,`MAPA ${SAVE.mapNumber}`,{fontSize:'30px',fontStyle:'bold',color:'#fff'});
    this.add.text(1240,28,`VIDAS ${'♥'.repeat(SAVE.lives)}${'♡'.repeat(3-SAVE.lives)}  ·  ORO ${SAVE.gold}`,{fontSize:'20px',fontStyle:'bold',color:'#ffe596'}).setOrigin(1,0);
    this.add.text(640,36,'ELIGE EL SIGUIENTE NODO',{fontSize:'24px',fontStyle:'bold',color:'#fff'}).setOrigin(.5);
    this.drawMap();
    makeButton(this,1120,676,210,42,'GUARDAR Y MENÚ',()=>{saveRun();this.scene.start('Menu');});
  }
  reachableIds(){
    const map=SAVE.generatedMap;
    if(!SAVE.currentNodeId)return [map.startNodeId];
    return map.nodes.find(n=>n.id===SAVE.currentNodeId)?.links||[];
  }
  drawMap(){
    const nodes=SAVE.generatedMap.nodes,reachable=this.reachableIds();
    const pos=n=>({x:430+n.col*210,y:635-n.row*38});
    nodes.forEach(n=>n.links.forEach(id=>{const t=nodes.find(q=>q.id===id);if(t){const a=pos(n),b=pos(t);this.add.line(0,0,a.x,a.y,b.x,b.y,0x8f79a5,.65).setOrigin(0).setLineWidth(3);}}));
    nodes.forEach(n=>{
      const {x,y}=pos(n),visited=SAVE.visitedNodes.includes(n.id),can=reachable.includes(n.id);
      const color=n.type==='boss'?0xa33b49:n.type==='reward'?0xc89b35:0x466c8f;
      const circle=this.add.circle(x,y,n.type==='boss'?19:14,color,visited?.35:1).setStrokeStyle(can?4:2,can?0xffe596:0xb3a5c0,can?1:.55);
      const label=n.type==='boss'?'B':n.type==='reward'?'R':'⚔';
      this.add.text(x,y,label,{fontSize:n.type==='boss'?'14px':'11px',fontStyle:'bold',color:'#fff'}).setOrigin(.5);
      if(can)circle.setInteractive({useHandCursor:true}).on('pointerdown',()=>this.selectNode(n));
    });
  }
  selectNode(node){
    startNode(node);
    if(node.type==='reward'){this.scene.start('Reward',{fromMap:true,nodeId:node.id});return;}
    this.scene.start('Placement',{nodeType:node.type});
  }
}
