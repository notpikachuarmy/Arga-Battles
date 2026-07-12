import { GAME } from '../config.js';
import { CLASSES, CLASS_KEYS } from '../data/classes.js';
import { ABILITIES } from '../data/abilities.js';
import { BLESSINGS, BLESSING_KEYS } from '../data/blessings.js';
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
    this.nav.push(this.makeNav(115,105,'ESTADÍSTICAS',()=>this.showStatsHelp()));
    this.nav.push(this.makeNav(115,175,'BENDICIONES',()=>this.showBlessings()));
    this.nav.push(this.makeNav(115,235,'RELIQUIAS',()=>{this.scene.pause();this.scene.launch('Relics',{returnScene:'Encyclopedia',all:true});}));
    CLASS_KEYS.forEach((key,i)=>this.nav.push(this.makeNav(115,315+i*82,CLASSES[key].name,()=>this.showClass(key))));

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

  showBlessings(){
    this.clearContent();
    const panel=this.add.rectangle(0,0,970,590,0x120c1b,.97).setOrigin(0).setStrokeStyle(3,0x806996);
    const title=this.add.text(30,24,'BENDICIONES Y SINERGIAS',{fontSize:'27px',fontStyle:'bold',color:'#fff'});
    const intro=this.add.text(30,68,
      'Cada unidad nace con una bendición. La bonificación se vuelve más fuerte al desplegar varias unidades con la misma bendición.\nEl bonus se aplica a TODAS las unidades de ese color que estén en el equipo desplegado.',
      {fontSize:'15px',color:'#e5ddea',wordWrap:{width:900},lineSpacing:5});
    const levels=this.add.text(30,132,
      '1 unidad del mismo color: +1 a su estadística   ·   2 unidades: +2 cada una   ·   3 unidades: +3 cada una',
      {fontSize:'16px',fontStyle:'bold',color:'#ffe69a',wordWrap:{width:900}});
    const chance=this.add.text(30,171,
      'Afinidad al reclutar: 50% de recibir la bendición predominante de su clase y 50% de recibir una de las otras tres al azar.',
      {fontSize:'14px',color:'#cfc3d8',wordWrap:{width:900}});
    this.content.add([panel,title,intro,levels,chance]);

    BLESSING_KEYS.forEach((key,i)=>{
      const b=BLESSINGS[key];
      const col=i%2,row=Math.floor(i/2);
      const x=40+col*460,y=245+row*155;
      const card=this.add.rectangle(x,y,425,125,0x21172d,.94).setOrigin(0).setStrokeStyle(2,b.color);
      const icon=this.add.image(x+65,y+62,b.texture).setDisplaySize(88,88);
      const name=this.add.text(x+125,y+20,b.name,{fontSize:'21px',fontStyle:'bold',color:'#fff'});
      const boost=this.add.text(x+125,y+51,`Potencia: ${b.statLabel}`,{fontSize:'16px',fontStyle:'bold',color:'#ffe69a'});
      const desc=this.add.text(x+125,y+79,b.description,{fontSize:'13px',color:'#ddd3e4',wordWrap:{width:275}});
      this.content.add([card,icon,name,boost,desc]);
    });
  }

  showClass(type){
    this.clearContent();
    const cls=CLASSES[type],lvl1=calculateStats(type,1),lvl10=calculateStats(type,10);
    const panel=this.add.rectangle(0,0,970,590,0x120c1b,.97).setOrigin(0).setStrokeStyle(3,0x806996);
    const portrait=this.add.image(120,135,cls.portrait).setDisplaySize(180,180);
    const title=this.add.text(230,20,`${cls.name} · Rareza ${cls.rarity}`,{fontSize:'28px',fontStyle:'bold',color:'#fff'});
    const identity=this.add.text(230,55,cls.identity,{fontSize:'13px',color:'#ffe69a',wordWrap:{width:700}});
    const blessing=BLESSINGS[cls.defaultBlessing];
    const blessingIcon=this.add.image(260,110,blessing.texture).setDisplaySize(48,48);
    const blessingText=this.add.text(295,91,`Bendición predominante: ${blessing.name}\n${blessing.description}`,{fontSize:'13px',color:'#e7ddec',lineSpacing:3,wordWrap:{width:620}});
    const one=this.add.text(230,155,this.formatStats('NIVEL 1',lvl1),{fontSize:'14px',color:'#e9e1ee',lineSpacing:4});
    const ten=this.add.text(490,155,this.formatStats('NIVEL 10',lvl10),{fontSize:'14px',color:'#e9e1ee',lineSpacing:4});
    const abilitiesTitle=this.add.text(25,325,'HABILIDADES POSIBLES',{fontSize:'18px',fontStyle:'bold',color:'#ffe69a'});
    const note=this.add.text(25,351,'En nivel 1 recibe una habilidad aleatoria de esta lista. En niveles 5 y 10 aprende otra que todavía no conozca.',{fontSize:'12px',color:'#cfc3d8',wordWrap:{width:910}});
    this.content.add([panel,portrait,title,identity,blessingIcon,blessingText,one,ten,abilitiesTitle,note]);

    const pool=cls.abilityPool??[];
    const listBg=this.add.rectangle(25,385,360,180,0x1c1427,.96).setOrigin(0).setStrokeStyle(2,0x6d5982);
    const detailBg=this.add.rectangle(400,385,545,180,0x1c1427,.96).setOrigin(0).setStrokeStyle(2,0x6d5982);
    this.content.add([listBg,detailBg]);

    const detailIcon=this.add.image(445,435,'skillPlaceholder').setDisplaySize(72,72);
    const detailName=this.add.text(495,397,'Selecciona una habilidad',{fontSize:'18px',fontStyle:'bold',color:'#fff',wordWrap:{width:420}});
    const detailMeta=this.add.text(495,430,'',{fontSize:'13px',color:'#91c8ff'});
    const detailDesc=this.add.text(495,458,'Pulsa una habilidad de la lista para ver su explicación completa.',{fontSize:'13px',color:'#e5ddea',wordWrap:{width:420},lineSpacing:4});
    this.content.add([detailIcon,detailName,detailMeta,detailDesc]);

    const showAbility=(a)=>{
      detailIcon.setTexture(a.icon).setDisplaySize(72,72);
      detailName.setText(a.name);
      detailMeta.setText(`Rareza ${a.rarity} · ${a.apCost} AP · ${a.mpCost} MP`);
      detailDesc.setText(a.description);
    };

    pool.forEach((id,i)=>{
      const a=ABILITIES[id];
      const y=394+i*24;
      const hit=this.add.rectangle(35,y,340,22,0x2a1e38,.9).setOrigin(0).setStrokeStyle(1,0x5e4b70).setInteractive({useHandCursor:true});
      const icon=this.add.image(48,y+11,a.icon).setDisplaySize(18,18);
      const name=this.add.text(64,y+3,`${a.rarity} · ${a.name}`,{fontSize:'11px',fontStyle:'bold',color:'#fff',wordWrap:{width:300}});
      hit.on('pointerdown',()=>showAbility(a));
      hit.on('pointerover',()=>hit.setFillStyle(0x473158,.96));
      hit.on('pointerout',()=>hit.setFillStyle(0x2a1e38,.9));
      this.content.add([hit,icon,name]);
    });
    if(pool.length)showAbility(ABILITIES[pool[0]]);
  }
  formatStats(label,s){
    return [label,`HP: ${s.maxHp}   MP: ${s.maxMp}`,`DF: ${s.df}   FUE: ${s.str}   INT: ${s.int}`,`AGI: ${s.agi}   CON: ${s.constitution}   ENE: ${s.energy}`,`CAR: ${s.charisma}   VOL: ${s.will}`,`SIG: ${s.stealth}%   PER: ${s.perception}`].join('\n');
  }
}
