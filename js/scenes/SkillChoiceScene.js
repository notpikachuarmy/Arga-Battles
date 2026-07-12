import { GAME } from '../config.js';
import { SAVE } from '../data/save.js';
import { CLASSES } from '../data/classes.js';
import { ABILITIES } from '../data/abilities.js';
import { makeButton } from '../utils/helpers.js';

export class SkillChoiceScene extends Phaser.Scene{
  constructor(){super('SkillChoice');}
  init(data){this.nextScene=data?.nextScene||'Placement';}
  create(){this.renderChoice();}
  renderChoice(){
    this.children.removeAll();
    this.add.image(GAME.width/2,GAME.height/2,'menuBg').setDisplaySize(GAME.width,GAME.height);
    this.add.rectangle(640,360,1280,720,0x080510,.84);
    const choice=SAVE.pendingSkillChoices[0];
    if(!choice){this.scene.start(this.nextScene);return;}
    const recruit=SAVE.playerRoster.find(r=>r.id===choice.recruitId);
    this.add.text(640,86,'NUEVA HABILIDAD',{fontSize:'38px',fontStyle:'bold',color:'#ffe69a'}).setOrigin(.5);
    this.add.text(640,132,`${recruit.customName?.trim()||CLASSES[recruit.type].name} ha alcanzado un nivel de aprendizaje.`,{fontSize:'18px',color:'#fff'}).setOrigin(.5);
    const options=choice.options.map(id=>ABILITIES[id]).filter(Boolean);
    const gap=options.length===3?350:400,start=640-gap*(options.length-1)/2;
    options.forEach((a,i)=>{
      const x=start+i*gap;
      const bg=this.add.rectangle(x,365,310,390,0x171020,.99).setStrokeStyle(3,0x806996).setInteractive({useHandCursor:true});
      this.add.image(x,235,a.icon).setDisplaySize(105,105);
      this.add.text(x,302,`${a.name}\n${a.rarity} · ${a.apCost} AP · ${a.mpCost} MP`,{fontSize:'17px',fontStyle:'bold',color:'#fff',align:'center',wordWrap:{width:270}}).setOrigin(.5);
      this.add.text(x,385,a.description,{fontSize:'13px',color:'#ddd2e4',align:'center',wordWrap:{width:270},lineSpacing:4}).setOrigin(.5);
      this.add.text(x,520,'ELEGIR',{fontSize:'18px',fontStyle:'bold',color:'#ffe69a'}).setOrigin(.5);
      bg.on('pointerdown',()=>{recruit.learnedAbilities.push(a.id);SAVE.pendingSkillChoices.shift();this.renderChoice();});
    });
  }
}
