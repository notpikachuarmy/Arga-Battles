import { GAME } from '../config.js';
import { CLASSES } from '../data/classes.js';
import { SAVE, randomTeam } from '../data/save.js';
import { soldierCost } from '../systems/progression.js';
import { makeButton, flashText } from '../utils/helpers.js';

export class PlacementScene extends Phaser.Scene{
  constructor(){super('Placement');}
  create(){
    const {width:W,height:H,tile:T,cols,rows,gridX,gridY}=GAME;
    this.add.image(W/2,H/2,'battleBg').setDisplaySize(W,H);
    this.add.rectangle(W/2,H/2,W,H,0x090611,.22);
    this.add.text(42,28,`RONDA ${SAVE.round}`,{fontFamily:'Arial',fontSize:'34px',fontStyle:'bold',color:'#fff'});
    this.add.text(W/2,45,'COLOCA TUS UNIDADES',{fontFamily:'Arial',fontSize:'27px',fontStyle:'bold',color:'#fff',stroke:'#21182d',strokeThickness:5}).setOrigin(.5);
    this.pointsText=this.add.text(W-38,28,'',{fontSize:'20px',fontStyle:'bold',color:'#ffe596',align:'right'}).setOrigin(1,0);
    this.cells=[];
    for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
      const x=gridX+c*T+T/2,y=gridY+r*T+T/2;
      const rect=this.add.rectangle(x,y,T-4,T-4,c<3?0x377c54:0x8b3941,.33).setStrokeStyle(2,c===2?0x9bf5bc:c===3?0xffa0a8:0xd2c5e4,.72);
      this.cells.push({c,r,x,y,rect});
      if(c<3)rect.setInteractive({useHandCursor:true}).on('pointerdown',()=>this.placeAt(c,r));
    }
    if(!SAVE.playerRoster.length)SAVE.playerRoster=randomTeam();
    this.roster=SAVE.playerRoster.slice(0,3).map((recruit,i)=>({recruit,type:recruit.type,slot:i,row:null,col:null,sprite:null}));
    this.selected=0;this.cards=[];
    this.roster.forEach((u,i)=>this.createRosterCard(u,i,60,180+i*142));
    this.createEnemyPreview();this.refreshCards();this.refreshPoints();
    const btn=makeButton(this,1060,646,300,62,'INICIAR COMBATE',()=>this.startBattle());
    this.startBtn=btn.bg;this.startBtn.setAlpha(.45);
  }
  createRosterCard(unit,index,x,y){
    const cost=soldierCost(unit.recruit);
    const bg=this.add.rectangle(x+118,y,236,118,0x171122,.90).setStrokeStyle(3,0x75618c).setInteractive({useHandCursor:true});
    const portrait=this.add.image(x+52,y,CLASSES[unit.type].portrait).setDisplaySize(90,90).setInteractive({useHandCursor:true});
    this.add.text(x+108,y-38,`${CLASSES[unit.type].name}\nNv. ${unit.recruit.level} · Coste ${cost}`,{fontSize:'15px',fontStyle:'bold',color:'#fff',wordWrap:{width:124}});
    const state=this.add.text(x+108,y+30,'Sin colocar',{fontSize:'14px',color:'#d8ccdf'});
    const select=()=>{this.selected=index;this.refreshCards();};bg.on('pointerdown',select);portrait.on('pointerdown',select);
    this.cards.push({bg,state});
  }
  refreshCards(){this.cards.forEach((c,i)=>c.bg.setStrokeStyle(i===this.selected?5:3,i===this.selected?0xffd86b:0x75618c));}
  deployedCost(){return this.roster.filter(u=>u.col!==null).reduce((n,u)=>n+soldierCost(u.recruit),0);}
  refreshPoints(){this.pointsText.setText(`Puntos de Soldado: ${SAVE.soldierPoints}\nCoste desplegado: ${this.deployedCost()} / ${SAVE.soldierPoints}`);}
  placeAt(c,r){
    const occupied=this.roster.find(u=>u.col===c&&u.row===r);
    if(occupied){occupied.col=null;occupied.row=null;occupied.sprite?.destroy();occupied.sprite=null;this.cards[occupied.slot].state.setText('Sin colocar');this.refreshReady();return;}
    const u=this.roster[this.selected];
    const current=this.deployedCost()-(u.col!==null?soldierCost(u.recruit):0);
    if(current+soldierCost(u.recruit)>SAVE.soldierPoints){flashText(this,'No tienes suficientes Puntos de Soldado.',GAME.width/2,120,0xff7777);return;}
    u.sprite?.destroy();u.col=c;u.row=r;
    u.sprite=this.add.image(GAME.gridX+c*GAME.tile+GAME.tile/2,GAME.gridY+r*GAME.tile+GAME.tile/2,u.type).setDisplaySize(82,82);
    this.cards[u.slot].state.setText(`Fila ${r+1} · Columna ${c+1}`);
    const next=this.roster.findIndex(q=>q.col===null);if(next>=0)this.selected=next;
    this.refreshCards();this.refreshReady();
  }
  refreshReady(){this.refreshPoints();this.startBtn.setAlpha(this.roster.every(q=>q.col!==null)?1:.45);}
  createEnemyPreview(){
    this.enemyTeam=randomTeam();
    const slots=Phaser.Utils.Array.Shuffle(Array.from({length:9},(_,i)=>({col:3+i%3,row:Math.floor(i/3)}))).slice(0,3);
    this.enemyPositions=this.enemyTeam.map((recruit,i)=>({type:recruit.type,level:1,learnedAbilities:recruit.learnedAbilities,...slots[i]}));
    this.enemyPositions.forEach(p=>this.add.image(GAME.gridX+p.col*GAME.tile+GAME.tile/2,GAME.gridY+p.row*GAME.tile+GAME.tile/2,p.type).setDisplaySize(82,82).setFlipX(true).setTint(0xffd6d8));
  }
  startBattle(){
    if(!this.roster.every(q=>q.col!==null)){flashText(this,'Debes colocar las tres unidades.',GAME.width/2,620,0xffbd69);return;}
    this.scene.start('Battle',{positions:this.roster.map(u=>({type:u.type,recruitId:u.recruit.id,level:u.recruit.level,learnedAbilities:u.recruit.learnedAbilities,col:u.col,row:u.row})),enemyPositions:this.enemyPositions});
  }
}
