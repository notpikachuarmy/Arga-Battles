import { GAME } from '../config.js';
import { resetRun, hasValidRun, loadRun, loadMeta, META } from '../data/save.js';
import { makeButton } from '../utils/helpers.js';

export class MenuScene extends Phaser.Scene{
  constructor(){super('Menu');}
  create(){
    loadMeta();
    this.add.image(GAME.width/2,GAME.height/2,'menuBg').setDisplaySize(GAME.width,GAME.height);
    this.add.rectangle(GAME.width/2,GAME.height/2,GAME.width,GAME.height,0x080510,.40);
    const logo=this.add.image(GAME.width/2,155,'logo');if(logo.width>620)logo.setScale(620/logo.width);
    const valid=hasValidRun();
    makeButton(this,GAME.width/2,350,340,68,'NUEVA RUN',()=>{resetRun();this.scene.start('Map');});
    if(valid)makeButton(this,GAME.width/2,430,340,68,'CONTINUAR RUN',()=>{if(loadRun())this.scene.start('Map');else this.scene.restart();});
    makeButton(this,GAME.width/2,valid?510:440,340,58,'CODEX',()=>this.scene.start('Encyclopedia'));
    makeButton(this,GAME.width/2,valid?580:510,340,58,'TIENDA',()=>this.scene.start('Shop'));
    this.add.text(24,690,`Núcleos de Energía Arga: ${META.argaCores}`,{fontSize:'15px',color:'#d9cfdf'});
  }
}
