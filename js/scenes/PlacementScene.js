import { GAME, BALANCE } from '../config.js';
import { CLASSES } from '../data/classes.js';
import { BLESSINGS } from '../data/blessings.js';
import { SAVE, randomTeam } from '../data/save.js';
import { soldierCost, xpNeeded } from '../systems/progression.js';
import { makeButton, flashText } from '../utils/helpers.js';

export class PlacementScene extends Phaser.Scene{
  constructor(){super('Placement');}

  create(){
    const {width:W,height:H,tile:T,cols,rows,gridX,gridY}=GAME;
    this.add.image(W/2,H/2,'battleBg').setDisplaySize(W,H);
    this.add.rectangle(W/2,H/2,W,H,0x090611,.22);
    this.add.text(42,24,`RONDA ${SAVE.round}`,{fontSize:'34px',fontStyle:'bold',color:'#fff'});
    this.add.text(W/2,42,'ELIGE Y COLOCA 3 UNIDADES',{fontSize:'27px',fontStyle:'bold',color:'#fff',stroke:'#21182d',strokeThickness:5}).setOrigin(.5);
    this.pointsText=this.add.text(W-38,22,'',{fontSize:'19px',fontStyle:'bold',color:'#ffe596',align:'right'}).setOrigin(1,0);

    this.cells=[];
    for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
      const x=gridX+c*T+T/2,y=gridY+r*T+T/2;
      const rect=this.add.rectangle(x,y,T-4,T-4,c<3?0x377c54:0x8b3941,.33)
        .setStrokeStyle(2,c===2?0x9bf5bc:c===3?0xffa0a8:0xd2c5e4,.72);
      this.cells.push({c,r,x,y,rect});
      if(c<3)rect.setInteractive({useHandCursor:true}).on('pointerdown',()=>this.placeAt(c,r));
    }

    if(!SAVE.playerRoster.length)SAVE.playerRoster=randomTeam();
    this.roster=SAVE.playerRoster.map(recruit=>({recruit,type:recruit.type,col:null,row:null,sprite:null}));
    this.selectedId=this.roster[0]?.recruit.id??null;
    this.page=0;this.perPage=5;this.cardObjects=[];
    this.createRosterPanel();
    this.createEnemyPreview();
    this.refreshRosterPanel();
    this.refreshPoints();

    const btn=makeButton(this,1060,646,300,62,'INICIAR COMBATE',()=>this.startBattle());
    this.startBtn=btn.bg;this.startBtn.setAlpha(.45);
  }

  createRosterPanel(){
    this.add.rectangle(170,374,300,590,0x100b18,.94).setStrokeStyle(3,0x75618c);
    this.add.text(170,91,'PLANTILLA',{fontSize:'21px',fontStyle:'bold',color:'#fff'}).setOrigin(.5);
    this.pageText=this.add.text(170,630,'',{fontSize:'14px',color:'#d8ccdf'}).setOrigin(.5);
    makeButton(this,92,664,120,42,'◀',()=>{if(this.page>0){this.page--;this.refreshRosterPanel();}});
    makeButton(this,248,664,120,42,'▶',()=>{if((this.page+1)*this.perPage<this.roster.length){this.page++;this.refreshRosterPanel();}});
  }

  refreshRosterPanel(){
    this.cardObjects.forEach(o=>o.destroy());this.cardObjects=[];
    const start=this.page*this.perPage;
    const shown=this.roster.slice(start,start+this.perPage);
    shown.forEach((unit,i)=>this.createRosterCard(unit,42,145+i*94));
    const pages=Math.max(1,Math.ceil(this.roster.length/this.perPage));
    this.pageText.setText(`Página ${this.page+1}/${pages} · ${this.roster.length} unidades`);
  }

  createRosterCard(unit,x,y){
    const recruit=unit.recruit,cls=CLASSES[unit.type],cost=soldierCost(recruit);
    const selected=recruit.id===this.selectedId;
    const deployed=unit.col!==null;
    const bg=this.add.rectangle(x+128,y,256,82,0x171122,.94)
      .setStrokeStyle(selected?4:2,selected?0xffd86b:deployed?0x63dc8b:0x75618c)
      .setInteractive({useHandCursor:true});
    const portrait=this.add.image(x+42,y,cls.portrait).setDisplaySize(70,70).setInteractive({useHandCursor:true});
    const blessing=BLESSINGS[recruit.blessing];
    const blessingIcon=this.add.image(x+68,y+25,blessing.texture).setDisplaySize(25,25);
    const xpLine=recruit.level>=GAME.maxLevel?'Nivel máximo':`XP ${recruit.xp}/${xpNeeded(recruit.level)}`;
    const text=this.add.text(x+84,y-31,`${cls.name} · ${cls.rarity}\nNv. ${recruit.level} · Coste ${cost}\n${xpLine}`,{fontSize:'13px',fontStyle:'bold',color:'#fff',lineSpacing:2});
    const state=this.add.text(x+210,y+23,deployed?'EN CAMPO':'BANQUILLO',{fontSize:'11px',fontStyle:'bold',color:deployed?'#72e79a':'#c5b9ce'}).setOrigin(.5);
    const select=()=>{this.selectedId=recruit.id;this.refreshRosterPanel();};
    bg.on('pointerdown',select);portrait.on('pointerdown',select);
    this.cardObjects.push(bg,portrait,blessingIcon,text,state);
  }

  deployedUnits(){return this.roster.filter(u=>u.col!==null);}
  deployedCost(){return this.deployedUnits().reduce((n,u)=>n+soldierCost(u.recruit),0);}
  refreshPoints(){
    this.pointsText.setText(`Margen de Soldado: ${SAVE.soldierPoints} / ${BALANCE.maxSoldierPoints}\nCoste desplegado: ${this.deployedCost()} / ${SAVE.soldierPoints}\nUnidades: ${this.deployedUnits().length} / 3`);
  }

  placeAt(c,r){
    const occupied=this.roster.find(u=>u.col===c&&u.row===r);
    if(occupied){
      occupied.col=null;occupied.row=null;occupied.sprite?.destroy();occupied.sprite=null;
      this.selectedId=occupied.recruit.id;this.refreshReady();return;
    }
    const u=this.roster.find(q=>q.recruit.id===this.selectedId);
    if(!u)return;
    if(u.col===null&&this.deployedUnits().length>=3){flashText(this,'Solo puedes desplegar 3 unidades.',GAME.width/2,120,0xffbd69);return;}
    const current=this.deployedCost()-(u.col!==null?soldierCost(u.recruit):0);
    if(current+soldierCost(u.recruit)>SAVE.soldierPoints){flashText(this,'No tienes suficiente margen de Puntos de Soldado.',GAME.width/2,120,0xff7777);return;}
    u.sprite?.destroy();u.col=c;u.row=r;
    u.sprite=this.add.image(GAME.gridX+c*GAME.tile+GAME.tile/2,GAME.gridY+r*GAME.tile+GAME.tile/2,u.type).setDisplaySize(82,82);
    this.refreshReady();
  }

  refreshReady(){this.refreshRosterPanel();this.refreshPoints();this.startBtn.setAlpha(this.deployedUnits().length===3?1:.45);}

  createEnemyPreview(){
    this.enemyTeam=randomTeam();
    const slots=Phaser.Utils.Array.Shuffle(Array.from({length:9},(_,i)=>({col:3+i%3,row:Math.floor(i/3)}))).slice(0,3);
    this.enemyPositions=this.enemyTeam.map((recruit,i)=>({type:recruit.type,level:1,blessing:recruit.blessing,learnedAbilities:recruit.learnedAbilities,...slots[i]}));
    this.enemyPositions.forEach(p=>this.add.image(GAME.gridX+p.col*GAME.tile+GAME.tile/2,GAME.gridY+p.row*GAME.tile+GAME.tile/2,p.type).setDisplaySize(82,82).setFlipX(true).setTint(0xffd6d8));
  }

  startBattle(){
    const deployed=this.deployedUnits();
    if(deployed.length!==3){flashText(this,'Debes colocar exactamente tres unidades.',GAME.width/2,620,0xffbd69);return;}
    this.scene.start('Battle',{positions:deployed.map(u=>({type:u.type,recruitId:u.recruit.id,level:u.recruit.level,blessing:u.recruit.blessing,learnedAbilities:u.recruit.learnedAbilities,col:u.col,row:u.row})),enemyPositions:this.enemyPositions});
  }
}
