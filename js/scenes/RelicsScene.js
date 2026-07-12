import { GAME } from '../config.js';
import { SAVE } from '../data/save.js';
import { RELICS, RELIC_KEYS } from '../data/relics.js';
import { makeButton } from '../utils/helpers.js';

export class RelicsScene extends Phaser.Scene{
  constructor(){super('Relics');}
  init(data){this.returnScene=data?.returnScene||'Menu';this.all=!!data?.all;}
  create(){
    this.add.rectangle(640,360,1280,720,0x07040b,.9);
    this.add.rectangle(640,360,1080,620,0x15101e,.99).setStrokeStyle(4,0xb896d1);
    this.add.text(640,72,this.all?'ENCICLOPEDIA DE RELIQUIAS':'RELIQUIAS DE LA RUN',{fontSize:'31px',fontStyle:'bold',color:'#fff'}).setOrigin(.5);
    const ids=this.all?RELIC_KEYS:SAVE.relics;
    if(!ids.length)this.add.text(640,330,'Todavía no tienes reliquias en esta run.',{fontSize:'21px',color:'#cfc3d8'}).setOrigin(.5);
    ids.forEach((id,i)=>{
      const r=RELICS[id],col=i%2,row=Math.floor(i/2),x=145+col*530,y=125+row*100;
      this.add.rectangle(x,y,500,88,0x21172d,.96).setOrigin(0).setStrokeStyle(2,0x806996);
      this.add.image(x+48,y+44,r.icon).setDisplaySize(68,68);
      this.add.text(x+92,y+10,`${r.name} · ${r.rarity}`,{fontSize:'16px',fontStyle:'bold',color:'#ffe69a'});
      this.add.text(x+92,y+35,r.description,{fontSize:'11.5px',color:'#eee6f4',wordWrap:{width:390},maxLines:2});
      this.add.text(x+92,y+66,`“${r.flavor}”`,{fontSize:'10px',fontStyle:'italic',color:'#a99bb3',wordWrap:{width:390},maxLines:1});
    });
    makeButton(this,640,675,240,46,'CERRAR',()=>{this.scene.stop();if(this.scene.isPaused(this.returnScene))this.scene.resume(this.returnScene);else this.scene.start(this.returnScene);});
  }
}
