import { GAME, BALANCE } from '../config.js';
import { SAVE, createRecruit, completeCurrentNode } from '../data/save.js';
import { CLASSES } from '../data/classes.js';
import { BLESSINGS } from '../data/blessings.js';
import { RELICS, RELIC_KEYS, hasRelic } from '../data/relics.js';
import { makeButton } from '../utils/helpers.js';

export class NodeEventScene extends Phaser.Scene{
  constructor(){super('NodeEvent');}
  init(data){this.nodeType=data.nodeType;this.difficulty=data.difficulty||{score:1};}
  create(){
    this.add.image(GAME.width/2,GAME.height/2,'mapBg').setDisplaySize(GAME.width,GAME.height);
    this.add.rectangle(640,360,1280,720,0x080510,.72);
    this.add.rectangle(640,360,920,560,0x15101e,.97).setStrokeStyle(4,0xb695d0);
    if(this.nodeType==='recruit')return this.recruit();
    if(this.nodeType==='relic')return this.relic();
    if(this.nodeType==='merchant')return this.merchant();
    return this.event();
  }
  title(text,sub=''){this.add.text(640,120,text,{fontSize:'38px',fontStyle:'bold',color:'#ffe59b'}).setOrigin(.5);if(sub)this.add.text(640,165,sub,{fontSize:'17px',color:'#ddd2e4'}).setOrigin(.5);}
  finish(gold=0){completeCurrentNode({won:true,gold});this.scene.start('Map');}
  recruit(){
    const manual=hasRelic(SAVE,'recruiterManual');
    const recruits=Array.from({length:manual?2:1},()=>createRecruit());
    this.title('RECLUTAMIENTO',manual?'El Manual del Reclutador permite incorporar las dos unidades.':'Una unidad se unirá a la expedición.');
    recruits.forEach((r,i)=>{const c=CLASSES[r.type],b=BLESSINGS[r.blessing],x=manual?480+i*320:640;
      this.add.rectangle(x,365,280,330,0x21172d,.98).setStrokeStyle(3,0x806996);
      this.add.image(x,295,c.portrait).setDisplaySize(145,145);this.add.image(x+82,350,b.texture).setDisplaySize(46,46);
      this.add.text(x,420,`${c.name} · ${c.rarity}
Nivel 1 · ${b.name||r.blessing}`,{fontSize:'17px',fontStyle:'bold',color:'#fff',align:'center'}).setOrigin(.5);
      const ability=r.learnedAbilities[0];
      this.add.text(x,475,ability?'Habilidad inicial generada':'Sin habilidad inicial',{fontSize:'13px',color:'#cfc2d8'}).setOrigin(.5);
    });
    makeButton(this,640,570,manual?340:300,60,manual?'RECLUTAR AMBAS':'RECLUTAR',()=>{SAVE.playerRoster.push(...recruits);this.finish();});
  }
  relic(){
    this.title('RELIQUIA','Una pieza de poder se une a la expedición.');
    const unavailable=new Set([...(SAVE.relics||[]),...(SAVE.retiredRelics||[])]);
    const available=RELIC_KEYS.filter(id=>!unavailable.has(id));
    if(!available.length){this.add.text(640,340,'Ya posees todas las reliquias disponibles.\nRecibes 20 de oro en su lugar.',{fontSize:'22px',color:'#eee5f2',align:'center'}).setOrigin(.5);return makeButton(this,640,540,300,60,'CONTINUAR',()=>this.finish(20));}
    const id=Phaser.Utils.Array.GetRandom(available),r=RELICS[id];
    this.add.image(640,315,r.icon).setDisplaySize(150,150);this.add.text(640,420,`${r.name} · ${r.rarity}`,{fontSize:'28px',fontStyle:'bold',color:'#fff'}).setOrigin(.5);
    this.add.text(640,470,r.description,{fontSize:'17px',color:'#ddd2e4',align:'center',wordWrap:{width:650}}).setOrigin(.5);
    makeButton(this,640,570,300,60,'RECOGER',()=>{SAVE.relics.push(id);this.finish();});
  }
  merchant(){
    this.title('MERCADER',`Oro disponible: ${SAVE.gold}`);
    const offers=[
      {y:285,label:`Refuerzo de expedición · 15 oro`,desc:`+${BALANCE.soldierPointsReward} puntos de soldado`,cost:15,act:()=>SAVE.soldierPoints=Math.min(BALANCE.maxSoldierPoints,SAVE.soldierPoints+BALANCE.soldierPointsReward)},
      {y:400,label:'Suministros · 10 oro',desc:'Recibe una reserva de 5 oro al completar el nodo',cost:10,bonus:5,act:()=>{}},
    ];
    offers.forEach(o=>{this.add.text(430,o.y,o.label,{fontSize:'20px',fontStyle:'bold',color:'#fff'});this.add.text(430,o.y+32,o.desc,{fontSize:'15px',color:'#cfc2d8'});makeButton(this,850,o.y+18,190,52,'COMPRAR',()=>{if(SAVE.gold<o.cost){this.add.text(640,620,'No tienes suficiente oro.',{fontSize:'17px',color:'#ff7983'}).setOrigin(.5);return;}SAVE.gold-=o.cost;o.act();this.finish(o.bonus||0);});});
    makeButton(this,640,555,300,56,'MARCHARSE',()=>this.finish());
  }
  event(){
    this.title('EVENTO','La ruta ofrece una decisión inesperada.');
    const good=()=>{const gold=8+Math.floor(this.difficulty.score*2);this.add.text(640,285,`Un alijo abandonado contiene ${gold} de oro.`,{fontSize:'22px',color:'#eee5f2'}).setOrigin(.5);makeButton(this,640,500,300,60,'RECOGER',()=>this.finish(gold));};
    const training=()=>{this.add.text(640,285,'Un campo de entrenamiento permite mejorar la logística.',{fontSize:'22px',color:'#eee5f2'}).setOrigin(.5);makeButton(this,500,500,300,60,'ENTRENAR',()=>{SAVE.soldierPoints=Math.min(BALANCE.maxSoldierPoints,SAVE.soldierPoints+1);this.finish();});makeButton(this,780,500,220,60,'IGNORAR',()=>this.finish());};
    (Math.random()<.5?good:training)();
  }
}
