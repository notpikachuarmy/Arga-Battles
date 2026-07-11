import { GAME, BALANCE } from '../config.js';
import { SAVE, createRecruit } from '../data/save.js';
import { CLASSES } from '../data/classes.js';
import { BLESSINGS } from '../data/blessings.js';
import { makeButton } from '../utils/helpers.js';

export class RewardScene extends Phaser.Scene {
  constructor(){ super('Reward'); }

  create(){
    this.add.image(GAME.width/2,GAME.height/2,'menuBg').setDisplaySize(GAME.width,GAME.height);
    this.add.rectangle(GAME.width/2,GAME.height/2,GAME.width,GAME.height,0x080510,.77);
    this.add.rectangle(640,360,760,500,0x15101e,.98).setStrokeStyle(4,0xe4c268);
    this.add.text(640,150,'RECOMPENSA DE RUN',{fontSize:'38px',fontStyle:'bold',color:'#ffe59b'}).setOrigin(.5);
    this.add.text(640,198,'Cada 2 rondas aparece una recompensa especial.',{fontSize:'17px',color:'#ddd2e4'}).setOrigin(.5);

    const reward=this.rollReward();
    if(reward.type==='recruit')this.showRecruitReward(reward.recruit);
    else this.showSoldierReward(reward.amount);

    makeButton(this,640,565,330,66,'CONTINUAR',()=>this.scene.start('Placement'));
  }

  rollReward(){
    // Las reliquias se añadirán como tercera opción cuando estén diseñadas.
    // Hasta entonces el reparto es 50% nueva unidad / 50% aumento del margen.
    if(SAVE.soldierPoints>=BALANCE.maxSoldierPoints||Math.random()<.5){
      const recruit=createRecruit();
      SAVE.playerRoster.push(recruit);
      return {type:'recruit',recruit};
    }
    const before=SAVE.soldierPoints;
    SAVE.soldierPoints=Math.min(BALANCE.maxSoldierPoints,SAVE.soldierPoints+BALANCE.soldierPointsReward);
    return {type:'soldier',amount:SAVE.soldierPoints-before};
  }

  showRecruitReward(recruit){
    const cls=CLASSES[recruit.type],blessing=BLESSINGS[recruit.blessing];
    this.add.image(640,330,cls.portrait).setDisplaySize(190,190);
    this.add.image(728,393,blessing.texture).setDisplaySize(58,58);
    this.add.text(640,445,'NUEVA UNIDAD',{fontSize:'18px',fontStyle:'bold',color:'#7ce99a'}).setOrigin(.5);
    this.add.text(640,478,`${cls.name} · ${cls.rarity} · Nivel 1`,{fontSize:'24px',fontStyle:'bold',color:'#fff'}).setOrigin(.5);
    this.add.text(640,512,`Bendición: ${recruit.blessing}`,{fontSize:'16px',color:'#ddd2e4'}).setOrigin(.5);
  }

  showSoldierReward(amount){
    this.add.text(640,312,'＋',{fontSize:'110px',fontStyle:'bold',color:'#ffe59b'}).setOrigin(.5);
    this.add.text(640,410,'MARGEN DE PUNTOS DE SOLDADO',{fontSize:'20px',fontStyle:'bold',color:'#fff'}).setOrigin(.5);
    this.add.text(640,455,`+${amount} puntos`,{fontSize:'31px',fontStyle:'bold',color:'#7ce99a'}).setOrigin(.5);
    this.add.text(640,500,`Margen actual: ${SAVE.soldierPoints} / ${BALANCE.maxSoldierPoints}`,{fontSize:'18px',color:'#ddd2e4'}).setOrigin(.5);
  }
}
