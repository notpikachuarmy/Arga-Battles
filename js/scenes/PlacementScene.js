import { GAME, BALANCE } from '../config.js';
import { CLASSES } from '../data/classes.js';
import { ABILITIES } from '../data/abilities.js';
import { BLESSINGS } from '../data/blessings.js';
import { SAVE, randomTeam } from '../data/save.js';
import { RELIC_KEYS, hasRelic } from '../data/relics.js';
import { calculateStats, soldierCost, xpNeeded } from '../systems/progression.js';
import { makeButton, flashText } from '../utils/helpers.js';

export class PlacementScene extends Phaser.Scene{
  constructor(){super('Placement');}

  create(){
    const {width:W,height:H,tile:T,cols,rows,gridX,gridY}=GAME;
    this.add.image(W/2,H/2,'battleBg').setDisplaySize(W,H);
    this.add.rectangle(W/2,H/2,W,H,0x090611,.22);
    this.add.text(42,24,`RONDA ${SAVE.round}`,{fontSize:'34px',fontStyle:'bold',color:'#fff'});
    this.add.text(W/2,42,`ELIGE Y COLOCA ${hasRelic(SAVE,'artOfWar')?4:3} UNIDADES`,{fontSize:'27px',fontStyle:'bold',color:'#fff',stroke:'#21182d',strokeThickness:5}).setOrigin(.5);

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
    this.compareId=null;
    this.selectedAbilityId=null;
    this.page=0;this.perPage=5;this.cardObjects=[];this.detailObjects=[];

    this.createRosterPanel();
    this.createDetailsPanel();
    this.createEnemyPreview();
    this.refreshRosterPanel();
    this.refreshDetailsPanel();

    this.startBtnData=makeButton(this,650,682,250,48,'INICIAR COMBATE',()=>this.startBattle()).setDepth(12);
    this.relicsBtnData=makeButton(this,850,682,125,42,'RELIQUIAS',()=>{this.scene.pause();this.scene.launch('Relics',{returnScene:'Placement'});}).setDepth(12);
    this.startBtnData.text.setFontSize(17);
    this.relicsBtnData.text.setFontSize(15);
    this.startBtn=this.startBtnData.bg;this.startBtn.setAlpha(.45);
  }

  createRosterPanel(){
    this.add.rectangle(170,374,300,590,0x100b18,.94).setStrokeStyle(3,0x75618c);
    this.add.text(170,91,'CUARTEL',{fontSize:'21px',fontStyle:'bold',color:'#fff'}).setOrigin(.5);
    this.pageText=this.add.text(170,630,'',{fontSize:'14px',color:'#d8ccdf'}).setOrigin(.5);
    makeButton(this,92,664,120,42,'◀',()=>{if(this.page>0){this.page--;this.refreshRosterPanel();}});
    makeButton(this,248,664,120,42,'▶',()=>{if((this.page+1)*this.perPage<this.roster.length){this.page++;this.refreshRosterPanel();}});
  }

  createDetailsPanel(){
    this.detailsRoot=this.add.container(958,86);
    const panel=this.add.rectangle(0,0,306,570,0x100b18,.97).setOrigin(0).setStrokeStyle(3,0x75618c);
    this.detailsRoot.add(panel);
  }

  clearDetails(){
    this.detailObjects.forEach(o=>o?.destroy?.());
    this.detailObjects=[];
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
    const compared=recruit.id===this.compareId;
    const deployed=unit.col!==null;
    const stroke=selected?0xffd86b:compared?0x6bc7ff:deployed?0x63dc8b:0x75618c;
    const bg=this.add.rectangle(x+128,y,256,82,0x171122,.94)
      .setStrokeStyle(selected||compared?4:2,stroke)
      .setInteractive({useHandCursor:true});
    const portrait=this.add.image(x+42,y,cls.portrait).setDisplaySize(70,70).setInteractive({useHandCursor:true});
    const blessing=BLESSINGS[recruit.blessing];
    const blessingIcon=this.add.image(x+68,y+25,blessing.texture).setDisplaySize(25,25);
    const xpLine=recruit.level>=GAME.maxLevel?'Nivel máximo':`XP ${recruit.xp}/${xpNeeded(recruit.level)}`;
    const displayName=recruit.customName?.trim()||cls.name;
    const text=this.add.text(x+84,y-31,`${displayName} · ${cls.rarity}\n${cls.name} · Nv. ${recruit.level}\nCoste ${cost} · ${xpLine}`,{fontSize:'11.5px',fontStyle:'bold',color:'#fff',lineSpacing:1,wordWrap:{width:168}});
    const state=this.add.text(x+210,y+25,deployed?'EN CAMPO':'BANQUILLO',{fontSize:'10px',fontStyle:'bold',color:deployed?'#72e79a':'#c5b9ce'}).setOrigin(.5);
    const select=()=>{
      this.selectedId=recruit.id;
      this.selectedAbilityId=recruit.learnedAbilities?.[0]||null;
      this.refreshRosterPanel();
      this.refreshDetailsPanel();
    };
    bg.on('pointerdown',select);portrait.on('pointerdown',select);
    this.cardObjects.push(bg,portrait,blessingIcon,text,state);
  }

  selectedUnit(){return this.roster.find(q=>q.recruit.id===this.selectedId)||null;}
  comparisonUnit(){return this.roster.find(q=>q.recruit.id===this.compareId)||null;}

  refreshDetailsPanel(){
    this.clearDetails();
    const unit=this.selectedUnit();
    if(!unit)return;
    const recruit=unit.recruit,cls=CLASSES[unit.type],stats=calculateStats(unit.type,recruit.level);
    const comparison=this.comparisonUnit();
    const compareStats=comparison?calculateStats(comparison.type,comparison.recruit.level):null;
    const blessing=BLESSINGS[recruit.blessing];
    const root=this.detailsRoot;
    const add=o=>{root.add(o);this.detailObjects.push(o);return o;};
    const displayName=recruit.customName?.trim()||cls.name;

    add(this.add.text(153,18,'DETALLES',{fontSize:'20px',fontStyle:'bold',color:'#fff'}).setOrigin(.5));
    add(this.add.image(61,96,cls.portrait).setDisplaySize(94,94));
    add(this.add.text(116,52,displayName,{fontSize:'17px',fontStyle:'bold',color:'#fff',wordWrap:{width:170},maxLines:2}));
    add(this.add.text(116,97,`${cls.name} · ${cls.rarity}\nNv. ${recruit.level} · Coste ${soldierCost(recruit)}\n${recruit.level>=GAME.maxLevel?'Nivel máximo':`XP ${recruit.xp}/${xpNeeded(recruit.level)}`}`,{fontSize:'12px',color:'#d9cfdf',lineSpacing:3}));
    add(this.add.image(43,161,blessing.texture).setDisplaySize(38,38));
    add(this.add.text(70,145,`${blessing.name}\n${blessing.label||''}`,{fontSize:'12px',fontStyle:'bold',color:'#f4eaf8',lineSpacing:2}));

    const statOrder=[['HP','maxHp'],['MP','maxMp'],['DF','df'],['FUE','str'],['INT','int'],['AGI','agi'],['CON','constitution'],['ENE','energy'],['CAR','charisma'],['VOL','will'],['SIG','stealth'],['PER','perception']];
    const statLines=statOrder.map(([label,key])=>{
      const suffix=key==='stealth'?'%':'';
      let delta='';
      if(compareStats){
        const d=stats[key]-compareStats[key];
        if(d!==0)delta=` ${d>0?'+':''}${d}`;
      }
      return `${label.padEnd(3,' ')} ${String(stats[key]).padStart(2,' ')}${suffix}${delta}`;
    });
    add(this.add.text(20,194,statLines.slice(0,6).join('\n'),{fontSize:'13px',fontFamily:'monospace',color:'#eee6f4',lineSpacing:5}));
    add(this.add.text(157,194,statLines.slice(6).join('\n'),{fontSize:'13px',fontFamily:'monospace',color:'#eee6f4',lineSpacing:5}));
    if(compareStats)add(this.add.text(153,310,`Comparando con: ${comparison.recruit.customName?.trim()||CLASSES[comparison.type].name}\nLos valores + / - son diferencias.`,{fontSize:'10px',color:'#85d4ff',align:'center'}).setOrigin(.5,0));

    add(this.add.text(20,342,'HABILIDADES APRENDIDAS',{fontSize:'12px',fontStyle:'bold',color:'#fff'}));
    const learned=(recruit.learnedAbilities||[]).map(id=>ABILITIES[id]).filter(Boolean);
    if(!learned.length){
      add(this.add.text(20,370,'Ninguna habilidad aprendida.',{fontSize:'11px',color:'#bfb2c9'}));
    }else{
      learned.slice(0,3).forEach((a,i)=>{
        const y=383+i*48;
        const selected=a.id===this.selectedAbilityId;
        const bg=add(this.add.rectangle(153,y,272,42,selected?0x443052:0x21182c,.96).setStrokeStyle(selected?2:1,selected?0xe1b6ff:0x75618c).setInteractive({useHandCursor:true}));
        add(this.add.image(32,y,a.icon).setDisplaySize(34,34));
        add(this.add.text(55,y-14,`${a.name} [${a.rarity}]`,{fontSize:'10.5px',fontStyle:'bold',color:'#fff',wordWrap:{width:220},maxLines:1}));
        add(this.add.text(55,y+3,`${a.apCost} AP · ${a.mpCost} MP`,{fontSize:'10px',color:'#cfc2d8'}));
        bg.on('pointerdown',()=>{this.selectedAbilityId=a.id;this.refreshDetailsPanel();});
      });
    }

    const selectedAbility=ABILITIES[this.selectedAbilityId]||learned[0];
    if(selectedAbility){
      add(this.add.text(20,525,selectedAbility.description,{fontSize:'10px',color:'#d8ccdf',wordWrap:{width:266},lineSpacing:2,maxLines:4}));
    }

    const rename=makeButton(this,1014,634,105,38,'RENOMBRAR',()=>this.renameSelected());
    const deploy=makeButton(this,1128,634,105,38,unit.col!==null?'RETIRAR':'DESPLEGAR',()=>this.toggleSelectedDeployment());
    const compare=makeButton(this,1242,634,105,38,this.compareId===recruit.id?'QUITAR COMP.':'COMPARAR',()=>this.toggleComparison());
    [rename.bg,rename.text,deploy.bg,deploy.text,compare.bg,compare.text].forEach(o=>{o.setDepth(10);this.detailObjects.push(o);});
  }

  renameSelected(){
    const unit=this.selectedUnit();if(!unit)return;
    const current=unit.recruit.customName?.trim()||CLASSES[unit.type].name;
    const value=window.prompt('Nombre de la unidad (máximo 22 caracteres):',current);
    if(value===null)return;
    const clean=value.trim().slice(0,22);
    unit.recruit.customName=clean||null;
    this.refreshRosterPanel();this.refreshDetailsPanel();
  }

  toggleComparison(){
    if(this.compareId===this.selectedId)this.compareId=null;
    else this.compareId=this.selectedId;
    this.refreshRosterPanel();this.refreshDetailsPanel();
  }

  toggleSelectedDeployment(){
    const u=this.selectedUnit();if(!u)return;
    if(u.col!==null){
      u.col=null;u.row=null;u.sprite?.destroy();u.sprite=null;
      this.refreshReady();
      return;
    }
    flashText(this,'Selecciona una casilla verde del tablero para desplegarla.',640,118,0xffd86b);
  }

  maxDeploy(){return hasRelic(SAVE,'artOfWar')?4:3;}
  deployedUnits(){return this.roster.filter(u=>u.col!==null);}
  deployedCost(){return this.deployedUnits().reduce((n,u)=>n+soldierCost(u.recruit),0);}
  refreshPoints(){
    if(this.pointsText)this.pointsText.destroy();
    this.pointsText=this.add.text(640,104,`Margen ${SAVE.soldierPoints}/${BALANCE.maxSoldierPoints} · Coste ${this.deployedCost()}/${SAVE.soldierPoints} · Unidades ${this.deployedUnits().length}/${this.maxDeploy()}`,{fontSize:'16px',fontStyle:'bold',color:'#ffe596',backgroundColor:'#120d1b',padding:{x:10,y:6}}).setOrigin(.5).setDepth(6);
  }

  placeAt(c,r){
    const occupied=this.roster.find(u=>u.col===c&&u.row===r);
    if(occupied){
      occupied.col=null;occupied.row=null;occupied.sprite?.destroy();occupied.sprite=null;
      this.selectedId=occupied.recruit.id;this.refreshReady();return;
    }
    const u=this.selectedUnit();
    if(!u)return;
    if(u.col===null&&this.deployedUnits().length>=this.maxDeploy()){flashText(this,`Solo puedes desplegar ${this.maxDeploy()} unidades.`,GAME.width/2,120,0xffbd69);return;}
    const current=this.deployedCost()-(u.col!==null?soldierCost(u.recruit):0);
    if(current+soldierCost(u.recruit)>SAVE.soldierPoints){flashText(this,'No tienes suficiente margen de Puntos de Soldado.',GAME.width/2,120,0xff7777);return;}
    u.sprite?.destroy();u.col=c;u.row=r;
    u.sprite=this.add.image(GAME.gridX+c*GAME.tile+GAME.tile/2,GAME.gridY+r*GAME.tile+GAME.tile/2,u.type).setDisplaySize(82,82);
    this.refreshReady();
  }

  refreshReady(){
    this.refreshRosterPanel();this.refreshDetailsPanel();this.refreshPoints();
    this.startBtn?.setAlpha(this.deployedUnits().length===this.maxDeploy()?1:.45);
  }

  createEnemyPreview(){
    this.enemyTeam=Array.from({length:this.maxDeploy()},()=>randomTeam()[0]);
    const count=this.maxDeploy();const slots=Phaser.Utils.Array.Shuffle(Array.from({length:9},(_,i)=>({col:3+i%3,row:Math.floor(i/3)}))).slice(0,count);
    this.enemyPositions=this.enemyTeam.map((recruit,i)=>({type:recruit.type,level:1,blessing:recruit.blessing,learnedAbilities:recruit.learnedAbilities,...slots[i]}));
    this.enemyPositions.forEach(p=>this.add.image(GAME.gridX+p.col*GAME.tile+GAME.tile/2,GAME.gridY+p.row*GAME.tile+GAME.tile/2,p.type).setDisplaySize(82,82).setFlipX(true).setTint(0xffd6d8));
    this.refreshPoints();
  }

  startBattle(){
    const deployed=this.deployedUnits();
    if(deployed.length!==this.maxDeploy()){flashText(this,`Debes colocar exactamente ${this.maxDeploy()} unidades.`,GAME.width/2,620,0xffbd69);return;}
    const playerLevels=Phaser.Utils.Array.Shuffle(deployed.map(u=>u.recruit.level));
    this.enemyPositions.forEach((p,i)=>p.level=playerLevels[i%playerLevels.length]);
    const min=Math.max(0,SAVE.relics.length-2),max=Math.min(RELIC_KEYS.length,SAVE.relics.length+2);
    const enemyRelicCount=Phaser.Math.Between(min,max);
    SAVE.enemyRelics=Phaser.Utils.Array.Shuffle([...RELIC_KEYS]).slice(0,enemyRelicCount);
    this.scene.start('Battle',{positions:deployed.map(u=>({type:u.type,recruitId:u.recruit.id,name:u.recruit.customName?.trim()||CLASSES[u.type].name,level:u.recruit.level,blessing:u.recruit.blessing,learnedAbilities:u.recruit.learnedAbilities,col:u.col,row:u.row})),enemyPositions:this.enemyPositions,enemyRelics:SAVE.enemyRelics});
  }
}
