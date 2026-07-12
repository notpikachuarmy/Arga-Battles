import { GAME, BALANCE } from '../config.js';
import { SAVE, createRecruit, completeCurrentNode, saveRun } from '../data/save.js';
import { CLASSES } from '../data/classes.js';
import { BLESSINGS } from '../data/blessings.js';
import { RELICS, RELIC_KEYS, hasRelic } from '../data/relics.js';
import { makeButton } from '../utils/helpers.js';

export class RewardScene extends Phaser.Scene {
  constructor(){ super('Reward'); }
  init(data){this.fromMap=!!data.fromMap;}
  create(){
    this.add.image(GAME.width/2,GAME.height/2,'menuBg').setDisplaySize(GAME.width,GAME.height);
    this.add.rectangle(GAME.width/2,GAME.height/2,GAME.width,GAME.height,0x080510,.77);
    this.add.rectangle(640,360,900,540,0x15101e,.98).setStrokeStyle(4,0xe4c268);
    this.add.text(640,125,'RECOMPENSA DE RUN',{fontSize:'38px',fontStyle:'bold',color:'#ffe59b'}).setOrigin(.5);
    this.add.text(640,170,'Has encontrado un nodo de recompensa.',{fontSize:'17px',color:'#ddd2e4'}).setOrigin(.5);
    this.rollReward();
  }
  continue(){if(this.fromMap)completeCurrentNode({won:true,gold:5});else saveRun();this.scene.start(this.fromMap?'Map':'Map');}
  rollReward(){
    const availableRelics=RELIC_KEYS.filter(id=>!SAVE.relics.includes(id));
    const types=['recruit','soldier'];if(availableRelics.length)types.push('relic');
    if(SAVE.soldierPoints>=BALANCE.maxSoldierPoints)types.splice(types.indexOf('soldier'),1);
    const type=Phaser.Utils.Array.GetRandom(types);
    if(type==='recruit')return this.showRecruitChoice();
    if(type==='relic')return this.showRelic(Phaser.Utils.Array.GetRandom(availableRelics));
    return this.showSoldierReward();
  }
  showRecruitChoice(){
    const count=hasRelic(SAVE,'recruiterManual')?2:1;
    const recruits=Array.from({length:count},()=>createRecruit());
    this.add.text(640,215,count===2?'ELIGE UNA NUEVA UNIDAD':'NUEVA UNIDAD',{fontSize:'22px',fontStyle:'bold',color:'#7ce99a'}).setOrigin(.5);
    recruits.forEach((recruit,i)=>{
      const cls=CLASSES[recruit.type],blessing=BLESSINGS[recruit.blessing],x=count===2?480+i*320:640;
      const bg=this.add.rectangle(x,375,270,330,0x21172d,.98).setStrokeStyle(3,0x806996).setInteractive({useHandCursor:true});
      this.add.image(x,310,cls.portrait).setDisplaySize(145,145);
      this.add.image(x+78,367,blessing.texture).setDisplaySize(48,48);
      this.add.text(x,420,`${cls.name} · ${cls.rarity}\nNivel 1 · ${recruit.blessing}`,{fontSize:'17px',fontStyle:'bold',color:'#fff',align:'center'}).setOrigin(.5);
      this.add.text(x,483,'RECLUTAR',{fontSize:'18px',fontStyle:'bold',color:'#ffe59b'}).setOrigin(.5);
      bg.on('pointerdown',()=>{SAVE.playerRoster.push(recruit);this.continue();});
    });
  }
  showRelic(id){
    const r=RELICS[id];SAVE.relics.push(id);
    this.add.text(640,215,'NUEVA RELIQUIA',{fontSize:'22px',fontStyle:'bold',color:'#7ce99a'}).setOrigin(.5);
    this.add.image(640,325,r.icon).setDisplaySize(145,145);
    this.add.text(640,420,`${r.name} · ${r.rarity}`,{fontSize:'27px',fontStyle:'bold',color:'#fff'}).setOrigin(.5);
    this.add.text(640,468,r.description,{fontSize:'17px',color:'#ddd2e4',align:'center',wordWrap:{width:650}}).setOrigin(.5);
    this.add.text(640,516,`“${r.flavor}”`,{fontSize:'14px',fontStyle:'italic',color:'#ad9db8',align:'center'}).setOrigin(.5);
    makeButton(this,640,590,300,58,'CONTINUAR',()=>this.continue());
  }
  showSoldierReward(){
    const before=SAVE.soldierPoints;SAVE.soldierPoints=Math.min(BALANCE.maxSoldierPoints,SAVE.soldierPoints+BALANCE.soldierPointsReward);const amount=SAVE.soldierPoints-before;
    this.add.text(640,315,'＋',{fontSize:'110px',fontStyle:'bold',color:'#ffe59b'}).setOrigin(.5);
    this.add.text(640,415,'MARGEN DE PUNTOS DE SOLDADO',{fontSize:'20px',fontStyle:'bold',color:'#fff'}).setOrigin(.5);
    this.add.text(640,460,`+${amount} puntos`,{fontSize:'31px',fontStyle:'bold',color:'#7ce99a'}).setOrigin(.5);
    this.add.text(640,505,`Margen actual: ${SAVE.soldierPoints} / ${BALANCE.maxSoldierPoints}`,{fontSize:'18px',color:'#ddd2e4'}).setOrigin(.5);
    makeButton(this,640,590,300,58,'CONTINUAR',()=>this.continue());
  }
}
