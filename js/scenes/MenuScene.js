import { GAME } from '../config.js';
import { resetRun } from '../data/save.js';
import { makeButton } from '../utils/helpers.js';

export class MenuScene extends Phaser.Scene{
  constructor(){super('Menu');}
  create(){
    this.add.image(GAME.width/2,GAME.height/2,'menuBg').setDisplaySize(GAME.width,GAME.height);
    this.add.rectangle(GAME.width/2,GAME.height/2,GAME.width,GAME.height,0x080510,.40);
    const logo=this.add.image(GAME.width/2,190,'logo');
    if(logo.width>620)logo.setScale(620/logo.width);
    makeButton(this,GAME.width/2,430,340,76,'COMENZAR RUN',()=>{resetRun();this.scene.start('Placement');});
  }
}
