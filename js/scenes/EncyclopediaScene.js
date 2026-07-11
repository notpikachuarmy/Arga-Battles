import { GAME } from '../config.js';
import { CLASSES, CLASS_KEYS } from '../data/classes.js';
import { ABILITIES, CLASS_ABILITY_POOLS } from '../data/abilities.js';
import { BLESSINGS } from '../data/blessings.js';
import { calculateStats } from '../systems/progression.js';
import { makeButton } from '../utils/helpers.js';

const STAT_HELP = [
  ['HP', 'Vida. Al llegar a 0 la unidad queda fuera del combate.'],
  ['MP', 'Recurso utilizado para lanzar habilidades. Se regenera parcialmente cada 3 turnos propios.'],
  ['DF', 'Reduce el daño físico y parte del daño de habilidades.'],
  ['Constitución', 'Determina el HP máximo: Constitución × 5.'],
  ['Fuerza', 'Aumenta el daño de ataques físicos.'],
  ['Inteligencia', 'Aumenta el daño de habilidades mágicas.'],
  ['Agilidad', 'Determina principalmente el orden de actuación.'],
  ['Energía', 'Determina el MP máximo: Energía × 5.'],
  ['Carisma', 'Mejorará buffs, invocaciones y liderazgo.'],
  ['Voluntad', 'Resistencia frente a control de masas y efectos negativos.'],
  ['Sigilo', 'Probabilidad de esquivar. Nunca podrá superar el 50%.'],
  ['Percepción', 'Reduce la eficacia del Sigilo enemigo.'],
  ['AP', 'Puntos de acción disponibles durante el turno.']
];

export class EncyclopediaScene extends Phaser.Scene {
  constructor(){ super('Encyclopedia'); }

  create(){
    this.add.image(GAME.width/2,GAME.height/2,'menuBg').setDisplaySize(GAME.width,GAME.height);
    this.add.rectangle(GAME.width/2,GAME.height/2,GAME.width,GAME.height,0x080510,.78);
    this.add.text(42,24,'ENCICLOPEDIA',{fontSize:'34px',fontStyle:'bold',color:'#fff'});
    makeButton(this,1135,44,190,48,'VOLVER',()=>this.scene.start('Menu'));

    this.nav=[];
    this.nav.push(this.makeNav(115,115,'ESTADÍSTICAS',()=>this.showStatsHelp()));
    CLASS_KEYS.forEach((key,i)=>this.nav.push(this.makeNav(115,185+i*82,CLASSES[key].name,()=>this.showClass(key))));

    this.content=this.add.container(260,90);
    this.showStatsHelp();
  }

  makeNav(x,y,label,callback){
    const bg=this.add.rectangle(x,y,205,58,0x21172d,.96).setStrokeStyle(2,0x806996).setInteractive({useHandCursor:true}).on('pointerdown',callback);
    const text=this.add.text(x,y,label,{fontSize:'14px',fontStyle:'bold',color:'#fff',align:'center',wordWrap:{width:180}}).setOrigin(.5);
    return {bg,text};
  }

  clearContent(){ this.content.removeAll(true); }

  showStatsHelp(){
    this.clearContent();
    const panel=this.add.rectangle(0,0,970,590,0x120c1b,.97).setOrigin(0).setStrokeStyle(3,0x806996);
    const title=this.add.text(30,24,'¿PARA QUÉ SIRVE CADA ESTADÍSTICA?',{fontSize:'25px',fontStyle:'bold',color:'#fff'});
    const note=this.add.text(30,62,'Las estadísticas ocultas, como la orientación, no se muestran en las fichas.',{fontSize:'14px',color:'#cfc3d8'});
    this.content.add([panel,title,note]);
    STAT_HELP.forEach((entry,i)=>{
      const col=i<7?0:1;
      const row=col===0?i:i-7;
      const x=30+col*470,y=112+row*65;
      const name=this.add.text(x,y,entry[0],{fontSize:'17px',fontStyle:'bold',color:'#ffe69a'});
      const desc=this.add.text(x,y+24,entry[1],{fontSize:'13px',color:'#e5ddea',wordWrap:{width:420}});
      this.content.add([name,desc]);
    });
  }

  showClass(type){
    this.clearContent();
    const cls=CLASSES[type],lvl1=calculateStats(type,1),lvl10=calculateStats(type,10);
    const panel=this.add.rectangle(0,0,970,590,0x120c1b,.97).setOrigin(0).setStrokeStyle(3,0x806996);
    const portrait=this.add.image(125,145,cls.portrait).setDisplaySize(190,190);
    const title=this.add.text(245,26,cls.name,{fontSize:'30px',fontStyle:'bold',color:'#fff'});
    const blessing=BLESSINGS[cls.defaultBlessing];
    const blessingIcon=this.add.image(275,88,blessing.texture).setDisplaySize(60,60);
    const blessingText=this.add.text(315,70,`Bendición predominante: ${blessing.name}\n${blessing.description}`,{fontSize:'14px',color:'#e7ddec',lineSpacing:5});
    const one=this.add.text(245,145,this.formatStats('NIVEL 1',lvl1),{fontSize:'15px',color:'#e9e1ee',lineSpacing:5});
    const ten=this.add.text(485,145,this.formatStats('NIVEL 10',lvl10),{fontSize:'15px',color:'#e9e1ee',lineSpacing:5});
    const abilitiesTitle=this.add.text(30,365,'HABILIDADES DE CLASE',{fontSize:'21px',fontStyle:'bold',color:'#ffe69a'});
    this.content.add([panel,portrait,title,blessingIcon,blessingText,one,ten,abilitiesTitle]);

    const pool=CLASS_ABILITY_POOLS[type]??[];
    pool.forEach((id,i)=>{
      const a=ABILITIES[id],y=410+i*145;
      const icon=this.add.image(80,y+50,a.icon).setDisplaySize(88,88);
      const name=this.add.text(145,y,`${a.name} · ${a.rarity}`,{fontSize:'18px',fontStyle:'bold',color:'#fff'});
      const costs=this.add.text(145,y+29,`${a.apCost} AP · ${a.mpCost} MP`,{fontSize:'14px',color:'#91c8ff'});
      const desc=this.add.text(145,y+54,a.description,{fontSize:'14px',color:'#ddd3e4',wordWrap:{width:750},lineSpacing:4});
      this.content.add([icon,name,costs,desc]);
    });
  }

  formatStats(label,s){
    return [label,`HP: ${s.maxHp}   MP: ${s.maxMp}`,`DF: ${s.df}   FUE: ${s.str}   INT: ${s.int}`,`AGI: ${s.agi}   CON: ${s.constitution}   ENE: ${s.energy}`,`CAR: ${s.charisma}   VOL: ${s.will}`,`SIG: ${s.stealth}%   PER: ${s.perception}`].join('\n');
  }
}
