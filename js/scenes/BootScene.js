import { DATA, printValidationReport } from '../data/registry.js';

export class BootScene extends Phaser.Scene {
  constructor(){super('Boot');}
  preload(){
    const A='assets/';
    Object.entries(DATA.assets).forEach(([key,path])=>this.load.image(key,A+path));
    this.load.on('loaderror',file=>console.warn(`Recurso ausente: ${file.key} (${file.src}). Se usará placeholder cuando sea necesario.`));
    this.load.on('complete',()=>document.getElementById('loading-message')?.remove());
  }
  create(){
    if(!this.textures.exists('placeholder')){
      const g=this.make.graphics({x:0,y:0,add:false});
      g.fillStyle(0x3b3046,1).fillRect(0,0,96,96).lineStyle(4,0xff66aa,1).strokeRect(2,2,92,92);
      g.lineBetween(12,12,84,84).lineBetween(84,12,12,84);g.generateTexture('placeholder',96,96);g.destroy();
    }
    printValidationReport();
    this.scene.start('Menu');
  }
}
