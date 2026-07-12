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
    this.title('RECLUTAMIENTO','Elige una unidad para añadir a la expedición.');
    const count=hasRelic(SAVE,'recruiterManual')?2:1,recruits=Array.from({length:count},()=>createRecruit());
    recruits.forEach((r,i)=>{const c=CLASSES[r.type],b=BLESSINGS[r.blessing],x=count===2?480+i*320:640;
      const card=this.add.rectangle(x,380,280,350,0x21172d,.98).setStrokeStyle(3,0x806996).setInteractive({useHandCursor:true});
      this.add.image(x,310,c.portrait).setDisplaySize(150,150);this.add.image(x+82,370,b.texture).setDisplaySize(48,48);
      this.add.text(x,435,`${c.name}\nNivel 1 · ${r.blessing}`,{fontSize:'18px',fontStyle:'bold',color:'#fff',align:'center'}).setOrigin(.5);
      this.add.text(x,505,'RECLUTAR',{fontSize:'18px',fontStyle:'bold',color:'#ffe59b'}).setOrigin(.5);
      card.on('pointerdown',()=>{SAVE.playerRoster.push(r);this.finish();});
    });
  }
  relic(){
    this.title('RELIQUIA','Una pieza de poder se une a la expedición.');
    const available=RELIC_KEYS.filter(id=>!SAVE.relics.includes(id));
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
