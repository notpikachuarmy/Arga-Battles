const W = 1280;
const H = 720;
const TILE = 96;
const COLS = 6;
const ROWS = 3;
const GRID_X = 352;
const GRID_Y = 194;

const CLASSES = {
  // En nivel 1 todas las estadísticas base están entre 1 y 3.
  // La identidad de clase viene de cómo se reparten esos pocos puntos.
  rune: { name: 'Trazador de Runas', texture: 'rune', portrait: 'runePortrait', blessing: 'Hojafail', constitution: 1, energy: 3, df: 1, str: 1, int: 3, agi: 2, charisma: 2, will: 2, stealth: 1, perception: 2 },
  formless: { name: 'Sin Forma', texture: 'formless', portrait: 'formlessPortrait', blessing: 'Fotopie', constitution: 2, energy: 2, df: 3, str: 2, int: 1, agi: 3, charisma: 2, will: 2, stealth: 3, perception: 2 },
  demon: { name: 'Sangre Demoníaca', texture: 'demon', portrait: 'demonPortrait', blessing: 'Chimech-o', constitution: 3, energy: 2, df: 2, str: 3, int: 2, agi: 1, charisma: 1, will: 3, stealth: 1, perception: 1 }
};

const SAVE = { round: 1, soldierPoints: 6, playerRoster: [], nextRecruitId: 1 };
const CLASS_KEYS = Object.keys(CLASSES);
const randomClass = () => Phaser.Utils.Array.GetRandom(CLASS_KEYS);
const createRecruit = (type=randomClass()) => ({ id: SAVE.nextRecruitId++, type, level: 1, xp: 0 });
const randomTeam = () => [createRecruit(), createRecruit(), createRecruit()];
const xpNeeded = level => 50 + (level - 1) * 35;

function calculateStats(type, level){
  const b=CLASSES[type];
  const steps=Math.floor((level-1)/2);
  const constitution=b.constitution+steps;
  const energy=b.energy+steps;
  return {
    // HP y MP dependen únicamente de su estadística asociada.
    maxHp: constitution * 5,
    maxMp: energy * 5,
    df: b.df + steps,
    str: b.str + steps,
    int: b.int + steps,
    agi: b.agi + Math.floor((level-1)/3),
    constitution,
    energy,
    charisma: b.charisma + Math.floor((level-1)/3),
    will: b.will + Math.floor((level-1)/3),
    stealth: Math.min(50, b.stealth + Math.floor((level-1)/2)),
    perception: b.perception + Math.floor((level-1)/3)
  };
}

function awardGlobalXp(amount){
  const levelUps=[];
  SAVE.playerRoster.forEach(recruit=>{
    if(recruit.level>=10)return;
    recruit.xp+=amount;
    let gained=0;
    while(recruit.level<10 && recruit.xp>=xpNeeded(recruit.level)){
      recruit.xp-=xpNeeded(recruit.level);
      recruit.level++;
      gained++;
    }
    if(recruit.level>=10)recruit.xp=0;
    if(gained)levelUps.push({name:CLASSES[recruit.type].name,levels:gained,newLevel:recruit.level});
  });
  return levelUps;
}


class BootScene extends Phaser.Scene {
  constructor(){ super('Boot'); }
  preload(){
    const A = 'assets/';
    this.load.image('menuBg', A+'backgrounds/main_menu_background.png');
    this.load.image('battleBg', A+'backgrounds/battle_background.png');
    this.load.image('logo', A+'ui/logo.png');
    this.load.image('rune', A+'units/rune_tracer/rune_tracer_idle.png');
    this.load.image('formless', A+'units/formless/formless_idle.png');
    this.load.image('demon', A+'units/demon_blood/demon_blood_idle.png');
    this.load.image('runePortrait', A+'units/rune_tracer/rune_tracer_portrait.png');
    this.load.image('formlessPortrait', A+'units/formless/formless_portrait.png');
    this.load.image('demonPortrait', A+'units/demon_blood/demon_blood_portrait.png');
    this.load.image('move', A+'abilities/basic/move.png');
    this.load.image('attack', A+'abilities/basic/basic_attack.png');
    this.load.image('end', A+'abilities/basic/end_turn.png');
    this.load.image('skill', A+'abilities/basic/skill_placeholder.png');
    this.load.image('hp', A+'ui/hp_icon.png');
    this.load.image('mp', A+'ui/mp_icon.png');
    this.load.image('ap', A+'ui/ap_icon.png');
    this.load.image('arrow', A+'ui/orientation_arrow.png');
    this.load.image('hit', A+'effects/hit_physical.png');
    this.load.image('magic', A+'effects/hit_magic.png');
    this.load.image('heal', A+'effects/healing.png');
    this.load.image('notpika', A+'blessings/blessing_notpikachu.png');
    this.load.image('hojafail', A+'blessings/blessing_hojafail.png');
    this.load.image('fotopie', A+'blessings/blessing_fotopie.png');
    this.load.image('chimecho', A+'blessings/blessing_chimecho.png');
    this.load.on('complete', () => document.getElementById('loading-message')?.remove());
  }
  create(){ this.scene.start('Menu'); }
}

class MenuScene extends Phaser.Scene {
  constructor(){ super('Menu'); }
  create(){
    this.add.image(W/2,H/2,'menuBg').setDisplaySize(W,H);
    this.add.rectangle(W/2,H/2,W,H,0x080510,.40);
    const logo=this.add.image(W/2,175,'logo');
    const maxW=620; if(logo.width>maxW) logo.setScale(maxW/logo.width);
    makeButton(this,W/2,420,330,72,'COMENZAR RUN',()=>{
      SAVE.round=1;
      SAVE.soldierPoints=6;
      SAVE.nextRecruitId=1;
      SAVE.playerRoster=randomTeam();
      this.scene.start('Placement');
    });
  }
}

class PlacementScene extends Phaser.Scene {
  constructor(){ super('Placement'); }
  create(){
    this.add.image(W/2,H/2,'battleBg').setDisplaySize(W,H);
    this.add.rectangle(W/2,H/2,W,H,0x090611,.22);
    this.add.text(42,28,`RONDA ${SAVE.round}`,{fontFamily:'Arial',fontSize:'34px',fontStyle:'bold',color:'#fff'});
    this.add.text(W/2,49,'COLOCA TUS UNIDADES',{fontFamily:'Arial',fontSize:'27px',fontStyle:'bold',color:'#fff',stroke:'#21182d',strokeThickness:5}).setOrigin(.5);
    this.add.text(W/2,82,'Selecciona una unidad y pulsa una casilla de tu lado.',{fontFamily:'Arial',fontSize:'18px',color:'#ddd5e9'}).setOrigin(.5);

    this.cells=[];
    for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
      const x=GRID_X+c*TILE+TILE/2, y=GRID_Y+r*TILE+TILE/2;
      const color=c<3?0x377c54:0x8b3941;
      const rect=this.add.rectangle(x,y,TILE-4,TILE-4,color,.33).setStrokeStyle(2,c===2?0x9bf5bc:c===3?0xffa0a8:0xd2c5e4,.72);
      this.cells.push({c,r,x,y,rect});
      if(c<3) rect.setInteractive({useHandCursor:true}).on('pointerdown',()=>this.placeAt(c,r));
    }
    this.add.text(GRID_X+TILE*1.5,GRID_Y-25,'TU CAMPO',{fontSize:'17px',color:'#8ff0ae'}).setOrigin(.5);
    this.add.text(GRID_X+TILE*4.5,GRID_Y-25,'ENEMIGO',{fontSize:'17px',color:'#ff9ba5'}).setOrigin(.5);

    if(!SAVE.playerRoster.length) SAVE.playerRoster=randomTeam();
    this.roster=SAVE.playerRoster.slice(0,3).map((recruit,i)=>({recruit,type:recruit.type,slot:i,row:null,col:null,sprite:null}));
    this.selected=0;
    this.cards=[];
    this.roster.forEach((u,i)=>this.createRosterCard(u,i,60,185+i*142));
    this.enemyPreview();
    this.refreshCards();
    makeButton(this,1060,646,300,62,'INICIAR COMBATE',()=>this.startBattle()).setAlpha(.45);
    this.startBtn=this.children.list[this.children.list.length-1];
    this.add.text(640,686,'Consejo: coloca unidades en distintas filas para tener más opciones.',{fontSize:'15px',color:'#cfc6da'}).setOrigin(.5);
  }
  createRosterCard(unit,index,x,y){
    const bg=this.add.rectangle(x+118,y,236,118,0x171122,.90).setStrokeStyle(3,0x75618c).setInteractive({useHandCursor:true});
    const portrait=this.add.image(x+52,y,CLASSES[unit.type].portrait).setDisplaySize(90,90);
    const title=this.add.text(x+108,y-36,`${CLASSES[unit.type].name} · Nv. ${unit.recruit.level}`,{fontSize:'16px',fontStyle:'bold',color:'#fff',wordWrap:{width:124}});
    const state=this.add.text(x+108,y+24,'Sin colocar',{fontSize:'15px',color:'#d8ccdf'});
    bg.on('pointerdown',()=>{this.selected=index;this.refreshCards();}); portrait.setInteractive({useHandCursor:true}).on('pointerdown',()=>{this.selected=index;this.refreshCards();});
    this.cards.push({bg,state});
  }
  refreshCards(){ this.cards.forEach((c,i)=>c.bg.setStrokeStyle(i===this.selected?5:3,i===this.selected?0xffd86b:0x75618c)); }
  placeAt(c,r){
    const occupied=this.roster.find(u=>u.col===c&&u.row===r);
    if(occupied){ occupied.col=null;occupied.row=null;occupied.sprite?.destroy();occupied.sprite=null; this.cards[occupied.slot].state.setText('Sin colocar'); return; }
    const u=this.roster[this.selected];
    u.sprite?.destroy(); u.col=c;u.row=r;
    u.sprite=this.add.image(GRID_X+c*TILE+TILE/2,GRID_Y+r*TILE+TILE/2,u.type).setDisplaySize(82,82);
    this.cards[u.slot].state.setText(`Fila ${r+1} · Columna ${c+1}`);
    const next=this.roster.findIndex(q=>q.col===null); if(next>=0)this.selected=next;
    this.refreshCards();
    const ready=this.roster.every(q=>q.col!==null);
    this.startBtn.setAlpha(ready?1:.45);
  }
  enemyPreview(){
    this.enemyTeam=randomTeam();
    const slots=Phaser.Utils.Array.Shuffle([
      {col:3,row:0},{col:3,row:1},{col:3,row:2},
      {col:4,row:0},{col:4,row:1},{col:4,row:2},
      {col:5,row:0},{col:5,row:1},{col:5,row:2}
    ]).slice(0,3);
    this.enemyPositions=this.enemyTeam.map((recruit,i)=>({type:recruit.type,level:1,...slots[i]}));
    this.enemyPositions.forEach(p=>this.add.image(GRID_X+p.col*TILE+TILE/2,GRID_Y+p.row*TILE+TILE/2,p.type).setDisplaySize(82,82).setFlipX(true).setTint(0xffd6d8));
  }
  startBattle(){
    if(!this.roster.every(q=>q.col!==null)){ flashText(this,'Debes colocar las tres unidades.',W/2,620,0xffbd69); return; }
    this.scene.start('Battle',{
      positions:this.roster.map(u=>({type:u.type,recruitId:u.recruit.id,level:u.recruit.level,col:u.col,row:u.row})),
      enemyPositions:this.enemyPositions
    });
  }
}

class BattleScene extends Phaser.Scene {
  constructor(){ super('Battle'); }
  init(data){ this.startPositions=data.positions; this.enemyPositions=data.enemyPositions || []; }
  create(){
    this.add.image(W/2,H/2,'battleBg').setDisplaySize(W,H);
    this.add.rectangle(W/2,H/2,W,H,0x08050d,.17);
    this.roundText=this.add.text(26,18,`RONDA ${SAVE.round}`,{fontSize:'27px',fontStyle:'bold',color:'#fff'});
    this.infoText=this.add.text(W/2,24,'',{fontSize:'19px',fontStyle:'bold',color:'#fff',stroke:'#130d1b',strokeThickness:4}).setOrigin(.5);
    this.cells=[];
    for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
      const x=GRID_X+c*TILE+TILE/2,y=GRID_Y+r*TILE+TILE/2;
      const rect=this.add.rectangle(x,y,TILE-4,TILE-4,c<3?0x286946:0x7b303a,.30).setStrokeStyle(2,c===2||c===3?0xd6bbef:0xbdaecd,.67);
      rect.setInteractive({useHandCursor:true}).on('pointerdown',()=>this.onCell(c,r));
      this.cells.push({c,r,x,y,rect});
    }
    this.units=[]; this.nextId=1;
    this.startPositions.forEach(p=>this.spawnUnit(p.type,'player',p.col,p.row,p.level||1,p.recruitId));
    const difficulty=Math.min(5,Math.floor((SAVE.round-1)/2));
    const enemies=this.enemyPositions.length?this.enemyPositions:randomTeam().map((recruit,i)=>({type:recruit.type,level:1,col:4,row:i}));
    enemies.forEach(p=>this.spawnUnit(p.type,'enemy',p.col,p.row,Math.min(10,(p.level||1)+difficulty)));
    this.units.forEach(u=>this.drawUnit(u));

    this.action='none'; this.active=null; this.turnQueue=[]; this.queueIndex=0; this.battleOver=false;
    this.autoBattle=false;
    this.createHud(); this.buildTurnQueue(); this.beginTurn();
  }
  spawnUnit(type,team,col,row,level=1,recruitId=null){
    const b=CLASSES[type];
    const stats=calculateStats(type,level);
    const unit={id:this.nextId++,recruitId,type,team,col,row,level,name:b.name,...stats,hp:stats.maxHp,mp:stats.maxMp,ap:3,maxAp:3,alive:true,sprite:null,hpBar:null,status:[],acted:false};
    this.units.push(unit); return unit;
  }
  drawUnit(u){
    const {x,y}=this.cellCenter(u.col,u.row);
    u.sprite=this.add.image(x,y,u.type).setDisplaySize(82,82).setFlipX(u.team==='enemy').setInteractive({useHandCursor:true});
    if(u.team==='enemy')u.sprite.setTint(0xffdddd);
    u.sprite.on('pointerdown',()=>{
      if(this.action==='attack' && this.active?.team==='player') this.tryAttackTarget(u);
      else this.showStats(u);
    });
    u.hpBack=this.add.rectangle(x,y-48,76,8,0x190d14,.95).setStrokeStyle(1,0xffffff,.35);
    u.hpBar=this.add.rectangle(x-37,y-48,74,6,0x42d36e,1).setOrigin(0,.5);
    u.arrow=this.add.image(x,y+48,'arrow').setDisplaySize(25,25).setFlipX(u.team==='enemy').setAlpha(.72);
  }
  createHud(){
    // La barra deja un margen interior amplio para que ningún retrato sobresalga.
    this.add.rectangle(W/2,622,1160,174,0x120d1b,.96).setStrokeStyle(3,0x786589);
    this.portrait=this.add.image(158,620,'runePortrait').setDisplaySize(124,124);
    this.nameText=this.add.text(235,550,'',{fontSize:'21px',fontStyle:'bold',color:'#fff',wordWrap:{width:390}});
    this.resourceText=this.add.text(235,586,'',{fontSize:'17px',color:'#eee6f4'});
    this.actionInfo=this.add.text(235,644,'Selecciona una acción.',{fontSize:'14px',color:'#cfc4d8',wordWrap:{width:390},lineSpacing:3});
    this.buttons={};
    this.buttons.move=this.actionButton(665,610,'move','MOVER','1 AP',()=>this.selectAction('move'));
    this.buttons.attack=this.actionButton(785,610,'attack','ATACAR','2 AP',()=>this.selectAction('attack'));
    this.buttons.skill=this.actionButton(905,610,'skill','HABILIDAD','Bloqueada',()=>flashText(this,'La unidad todavía no ha aprendido una habilidad.',905,510,0x91c9ff));
    this.buttons.end=this.actionButton(1025,610,'end','TERMINAR','Turno',()=>{if(!this.autoBattle)this.endTurn();});
    this.turnPanel=this.add.container(12,68);
    this.statsContainer=null;
    this.autoButton=this.add.rectangle(1168,42,184,48,0x241a31,.96).setStrokeStyle(2,0xb896d1).setInteractive({useHandCursor:true});
    this.autoLabel=this.add.text(1168,42,'AUTO-BATTLE: NO',{fontSize:'15px',fontStyle:'bold',color:'#fff'}).setOrigin(.5);
    this.autoButton.on('pointerover',()=>this.autoButton.setFillStyle(0x39264a,1));
    this.autoButton.on('pointerout',()=>this.autoButton.setFillStyle(this.autoBattle?0x285f3c:0x241a31,.96));
    this.autoButton.on('pointerdown',()=>this.toggleAutoBattle());
  }
  actionButton(x,y,tex,label,cost,cb){
    const bg=this.add.rectangle(x,y,98,118,0x261b33,.97).setStrokeStyle(2,0x917aa9).setInteractive({useHandCursor:true}).on('pointerdown',cb);
    const icon=this.add.image(x,y-18,tex).setDisplaySize(58,58);
    const txt=this.add.text(x,y+25,label,{fontSize:'12px',fontStyle:'bold',color:'#fff'}).setOrigin(.5);
    const ct=this.add.text(x,y+45,cost,{fontSize:'11px',color:'#d1c5dd'}).setOrigin(.5);
    return {bg,icon,txt,ct};
  }
  buildTurnQueue(){
    this.turnQueue=this.units.filter(u=>u.alive).sort((a,b)=>b.agi-a.agi||(a.team==='player'?-1:1));
    this.queueIndex=0; this.refreshTurnOrder();
  }
  refreshTurnOrder(){
    this.turnPanel.removeAll(true);
    this.add.text(22,74,'ORDEN',{fontSize:'15px',fontStyle:'bold',color:'#fff'});
    const alive=this.turnQueue.filter(u=>u.alive);
    alive.forEach((u,i)=>{
      const y=i*68;
      const active=u===this.active;
      const aura=this.add.circle(50,y+35,active?31:27,u.team==='player'?0x32d46f:0xe34754,active?1:.65);
      const img=this.add.image(50,y+35,u.type).setDisplaySize(active?55:48,active?55:48).setFlipX(u.team==='enemy');
      const hp=this.add.text(83,y+26,`${Math.max(0,u.hp)}/${u.maxHp}`,{fontSize:'12px',color:'#fff'});
      const ag=this.add.text(83,y+42,`AGI ${u.agi}`,{fontSize:'11px',color:'#c9bed4'});
      this.turnPanel.add([aura,img,hp,ag]);
    });
  }
  beginTurn(){
    if(this.battleOver)return;
    this.clearHighlights(); this.action='none';
    while(this.queueIndex<this.turnQueue.length&&!this.turnQueue[this.queueIndex].alive)this.queueIndex++;
    if(this.queueIndex>=this.turnQueue.length){ this.buildTurnQueue(); }
    this.active=this.turnQueue[this.queueIndex];
    if(!this.active||!this.active.alive){ this.checkEnd(); return; }
    this.active.ap=this.active.maxAp;
    this.active.acted=false;
    this.updateHud(); this.refreshTurnOrder();
    this.highlightActive();
    if(this.active.team==='enemy'){
      this.infoText.setText(`Turno enemigo: ${this.active.name}`);
      this.time.delayedCall(650,()=>this.runAIControlled(this.active));
    } else if(this.autoBattle){
      this.infoText.setText(`Auto-battle: ${this.active.name}`);
      this.updateButtons();
      this.time.delayedCall(500,()=>this.runAIControlled(this.active));
    } else {
      this.infoText.setText(`Tu turno: ${this.active.name}`);
      this.updateButtons();
    }
  }
  highlightActive(){ if(this.active?.sprite)this.tweens.add({targets:this.active.sprite,scaleX:this.active.sprite.scaleX*1.08,scaleY:this.active.sprite.scaleY*1.08,yoyo:true,duration:250}); }
  selectAction(action){
    if(this.battleOver||!this.active||this.active.team!=='player'||this.autoBattle)return;
    if(action==='move'&&this.active.ap<1){flashText(this,'No tienes AP suficiente.',W/2,120,0xff7777);return;}
    if(action==='attack'&&this.active.ap<2){flashText(this,'No tienes AP suficiente.',W/2,120,0xff7777);return;}
    this.action=action; this.clearHighlights();
    if(action==='move'){
      this.actionInfo.setText('Movimiento · 1 AP · Elige una casilla adyacente libre.');
      this.validMoves(this.active).forEach(p=>this.highlightCell(p.col,p.row,0x50dc84));
    } else {
      this.actionInfo.setText('Ataque básico · 2 AP · Pulsa la casilla roja o directamente al enemigo situado delante.');
      const target=this.frontTarget(this.active);
      if(target)this.highlightCell(target.col,target.row,0xff525f);
      else flashText(this,'No hay ningún enemigo delante.',W/2,120,0xffbd69);
    }
  }
  onCell(col,row){
    if(this.battleOver||!this.active||this.active.team!=='player'||this.autoBattle)return;
    if(this.action==='move'){
      const valid=this.validMoves(this.active).some(p=>p.col===col&&p.row===row);
      if(valid)this.moveUnit(this.active,col,row,()=>{this.active.ap-=1;this.action='none';this.clearHighlights();this.updateHud();this.updateButtons();});
    } else if(this.action==='attack'){
      const t=this.unitAt(col,row); const front=this.frontTarget(this.active);
      if(t&&front===t)this.tryAttackTarget(t);
    }
  }
  tryAttackTarget(target){
    if(!target?.alive || target.team!=='enemy') return;
    const front=this.frontTarget(this.active);
    if(front!==target){
      flashText(this,'Solo puedes atacar al enemigo situado justo delante.',W/2,120,0xffbd69);
      return;
    }
    if(this.active.ap<2){
      flashText(this,'No tienes AP suficiente.',W/2,120,0xff7777);
      return;
    }
    this.attackUnit(this.active,target,()=>{
      this.active.ap-=2;
      this.action='none';
      this.clearHighlights();
      this.updateHud();
      this.updateButtons();
      this.checkEnd();
    });
  }
  validMoves(u){
    const candidates=[[u.col+1,u.row],[u.col-1,u.row],[u.col,u.row+1],[u.col,u.row-1]];
    return candidates.filter(([c,r])=>c>=0&&c<COLS&&r>=0&&r<ROWS&&!this.unitAt(c,r)).map(([col,row])=>({col,row}));
  }
  frontTarget(u){ return this.unitAt(u.col+(u.team==='player'?1:-1),u.row); }
  moveUnit(u,col,row,done){
    u.col=col;u.row=row;const {x,y}=this.cellCenter(col,row);
    this.tweens.add({targets:[u.sprite,u.hpBack,u.hpBar,u.arrow],x:{value:x},duration:260,ease:'Sine.easeInOut',onUpdate:()=>{u.hpBack.x=u.sprite.x;u.hpBar.x=u.sprite.x-37;u.arrow.x=u.sprite.x;},onComplete:()=>{u.sprite.y=y;u.hpBack.y=y-48;u.hpBar.y=y-48;u.arrow.y=y+48;done?.();}});
  }
  attackUnit(attacker,target,done){
    const direction=attacker.team==='player'?1:-1;
    const originalX=attacker.sprite.x;
    this.tweens.add({targets:attacker.sprite,x:originalX+direction*22,duration:90,yoyo:true,onComplete:()=>{
      const damage=Math.max(1,Math.round(attacker.str*1.55-target.df*.65+Phaser.Math.Between(-2,2)));
      target.hp-=damage;
      const fx=this.add.image(target.sprite.x,target.sprite.y,'hit').setDisplaySize(110,110).setAlpha(.95);
      this.tweens.add({targets:fx,alpha:0,scale:1.4,duration:300,onComplete:()=>fx.destroy()});
      floatNumber(this,`-${damage}`,target.sprite.x,target.sprite.y-62,0xff626f);
      this.cameras.main.shake(90,.004);
      this.updateUnitHp(target);
      if(target.hp<=0)this.killUnit(target);
      done?.();
    }});
  }
  updateUnitHp(u){ const ratio=Phaser.Math.Clamp(u.hp/u.maxHp,0,1);u.hpBar.width=74*ratio;u.hpBar.fillColor=ratio>.5?0x42d36e:ratio>.25?0xf3bf4d:0xe54452; }
  killUnit(u){
    u.alive=false;
    this.tweens.add({targets:[u.sprite,u.hpBack,u.hpBar,u.arrow],alpha:0,y:u.sprite.y+25,duration:400,onComplete:()=>{u.sprite.setVisible(false);u.hpBack.setVisible(false);u.hpBar.setVisible(false);u.arrow.setVisible(false);this.refreshTurnOrder();}});
  }
  endTurn(){
    if(this.battleOver||!this.active)return;
    this.action='none';this.clearHighlights();this.queueIndex++;
    this.time.delayedCall(240,()=>this.beginTurn());
  }
  toggleAutoBattle(){
    if(this.battleOver)return;
    this.autoBattle=!this.autoBattle;
    this.autoLabel.setText(`AUTO-BATTLE: ${this.autoBattle?'SÍ':'NO'}`);
    this.autoButton.setFillStyle(this.autoBattle?0x285f3c:0x241a31,.96);
    flashText(this,this.autoBattle?'Auto-battle activado':'Auto-battle desactivado',1160,92,this.autoBattle?0x70e596:0xffffff);
    if(this.autoBattle&&this.active?.team==='player'){
      this.clearHighlights();
      this.action='none';
      this.updateButtons();
      this.time.delayedCall(250,()=>this.runAIControlled(this.active));
    }
  }
  runAIControlled(u){
    if(!u?.alive||this.battleOver||u!==this.active)return;
    const enemyTeam=u.team==='player'?'enemy':'player';
    const loop=()=>{
      if(this.battleOver||u!==this.active||!u.alive)return;
      if(u.ap<=0){this.endTurn();return;}
      const front=this.frontTarget(u);
      if(front&&front.team===enemyTeam&&u.ap>=2){
        this.attackUnit(u,front,()=>{
          u.ap-=2;this.updateHud();
          if(this.checkEnd())return;
          this.time.delayedCall(350,loop);
        });
        return;
      }
      if(u.ap>=1){
        const moves=this.validMoves(u);
        const targets=this.units.filter(q=>q.alive&&q.team===enemyTeam);
        if(!moves.length||!targets.length){this.endTurn();return;}
        const scored=moves.map(m=>({
          m,
          score:Math.min(...targets.map(t=>Math.abs(t.col-m.col)+Math.abs(t.row-m.row)))+Phaser.Math.FloatBetween(0,.25)
        })).sort((a,b)=>a.score-b.score);
        this.moveUnit(u,scored[0].m.col,scored[0].m.row,()=>{
          u.ap--;this.updateHud();this.time.delayedCall(350,loop);
        });
        return;
      }
      this.endTurn();
    };
    loop();
  }
  updateHud(){
    if(!this.active)return;
    this.portrait.setTexture(CLASSES[this.active.type].portrait);
    this.nameText.setText(`${this.active.name} · Nv. ${this.active.level}`);
    this.resourceText.setText(`HP ${Math.max(0,this.active.hp)}/${this.active.maxHp}     MP ${this.active.mp}/${this.active.maxMp}     AP ${this.active.ap}/${this.active.maxAp}`);
  }
  updateButtons(){
    const can=this.active?.team==='player'&&!this.autoBattle;
    Object.values(this.buttons).forEach(b=>{b.bg.setAlpha(can?1:.35);b.icon.setAlpha(can?1:.35);});
    if(!can)return;
    this.buttons.move.icon.clearTint();this.buttons.attack.icon.clearTint();
    if(this.active.ap<1)this.buttons.move.icon.setTint(0xff5555);
    if(this.active.ap<2)this.buttons.attack.icon.setTint(0xff5555);
    this.buttons.skill.icon.setTint(0x222222);
  }
  showStats(u){
    this.statsContainer?.destroy(true);
    const b=CLASSES[u.type];
    const c=this.add.container(815,35).setDepth(40); this.statsContainer=c;
    const panel=this.add.rectangle(0,0,430,650,0x100b18,.98).setOrigin(0).setStrokeStyle(3,u.team==='player'?0x48d47a:0xe7505d);
    const title=this.add.text(20,17,u.name,{fontSize:'22px',fontStyle:'bold',color:'#fff',wordWrap:{width:330}});
    const subtitle=this.add.text(20,54,`Nivel ${u.level} · ${u.team==='player'?'Aliado':'Enemigo'}`,{fontSize:'16px',color:'#d8ccdf'});
    const close=this.add.text(383,12,'✕',{fontSize:'30px',color:'#fff'}).setInteractive({useHandCursor:true}).on('pointerdown',()=>{c.destroy(true);this.statsContainer=null;});

    const portrait=this.add.image(91,159,b.portrait).setDisplaySize(120,120);
    const combat=this.add.text(172,101,[
      `HP     ${Math.max(0,u.hp)} / ${u.maxHp}`,
      `MP     ${u.mp} / ${u.maxMp}`,
      `AP     ${u.ap} / ${u.maxAp}`,
      `DF     ${u.df}`,
      `FUE    ${u.str}`,
      `INT    ${u.int}`,
      `AGI    ${u.agi}`
    ].join('\n'),{fontSize:'16px',color:'#eee6f4',lineSpacing:5});

    const divider=this.add.rectangle(20,257,390,2,0x786589,.7).setOrigin(0);
    const blessingLabel=this.add.text(20,274,'Bendición',{fontSize:'16px',color:'#bfb4cb'});
    const blessingKey={NotPikachu:'notpika',Hojafail:'hojafail',Fotopie:'fotopie','Chimech-o':'chimecho'}[b.blessing];
    const blessingIcon=this.add.image(83,354,blessingKey).setDisplaySize(100,100);
    const blessingName=this.add.text(151,332,b.blessing,{fontSize:'20px',fontStyle:'bold',color:'#fff',wordWrap:{width:235}});

    const divider2=this.add.rectangle(20,421,390,2,0x786589,.7).setOrigin(0);
    const leftStats=this.add.text(20,448,[
      `Constitución: ${u.constitution}`,
      `Energía: ${u.energy}`,
      `Voluntad: ${u.will}`,
      `Percepción: ${u.perception}`
    ].join('\n'),{fontSize:'16px',color:'#d1c5dc',lineSpacing:13});
    const rightStats=this.add.text(220,448,[
      `Carisma: ${u.charisma}`,
      `Sigilo: ${u.stealth}%`,
      `Orientación:`,
      `${u.team==='player'?'Derecha':'Izquierda'}`
    ].join('\n'),{fontSize:'16px',color:'#d1c5dc',lineSpacing:13});

    c.add([panel,title,subtitle,close,portrait,combat,divider,blessingLabel,blessingIcon,blessingName,divider2,leftStats,rightStats]);
  }
  clearHighlights(){ this.cells.forEach(c=>{c.rect.setFillStyle(c.c<3?0x286946:0x7b303a,.30);}); }
  highlightCell(col,row,color){ const cell=this.cells.find(c=>c.c===col&&c.r===row);cell?.rect.setFillStyle(color,.68); }
  cellCenter(col,row){return{x:GRID_X+col*TILE+TILE/2,y:GRID_Y+row*TILE+TILE/2};}
  unitAt(col,row){return this.units.find(u=>u.alive&&u.col===col&&u.row===row);}
  checkEnd(){
    const players=this.units.some(u=>u.alive&&u.team==='player');
    const enemies=this.units.some(u=>u.alive&&u.team==='enemy');
    if(players&&enemies)return false;
    this.battleOver=true;this.clearHighlights();
    if(players)this.time.delayedCall(600,()=>this.showVictory());
    else this.time.delayedCall(600,()=>this.showDefeat());
    return true;
  }
  showVictory(){
    const overlay=this.add.rectangle(W/2,H/2,W,H,0x07040b,.78).setDepth(50);
    const panel=this.add.rectangle(W/2,H/2,600,360,0x171020,.98).setStrokeStyle(4,0x66e38e).setDepth(51);
    this.add.text(W/2,245,'¡VICTORIA!',{fontSize:'48px',fontStyle:'bold',color:'#79ee9c',stroke:'#14251a',strokeThickness:6}).setOrigin(.5).setDepth(52);
    this.add.text(W/2,323,`Ronda ${SAVE.round} superada`,{fontSize:'24px',color:'#fff'}).setOrigin(.5).setDepth(52);
    const xpReward=50+SAVE.round*10;
    const levelUps=awardGlobalXp(xpReward);
    const levelText=levelUps.length ? `\nSubidas: ${levelUps.map(x=>`${x.name} → Nv. ${x.newLevel}`).join(' · ')}` : '';
    this.add.text(W/2,365,`Recompensa: +1 Punto de Soldado y +${xpReward} XP global${levelText}\nToda la plantilla recibe XP, también las unidades del banquillo.`,{fontSize:'18px',color:'#ddd4e5',align:'center',lineSpacing:9,wordWrap:{width:530}}).setOrigin(.5).setDepth(52);
    const btn=makeButton(this,W/2,474,300,64,'SIGUIENTE RONDA',()=>{SAVE.round++;SAVE.soldierPoints++;this.scene.start('Placement');});btn.setDepth(52);
  }
  showDefeat(){
    this.add.rectangle(W/2,H/2,W,H,0x07040b,.82).setDepth(50);
    this.add.rectangle(W/2,H/2,600,350,0x171020,.98).setStrokeStyle(4,0xe2505d).setDepth(51);
    this.add.text(W/2,250,'DERROTA',{fontSize:'48px',fontStyle:'bold',color:'#ff6571',stroke:'#2b1014',strokeThickness:6}).setOrigin(.5).setDepth(52);
    this.add.text(W/2,335,`Has alcanzado la ronda ${SAVE.round}.\nEl progreso de esta run se ha perdido.`,{fontSize:'21px',color:'#eee5f2',align:'center',lineSpacing:12}).setOrigin(.5).setDepth(52);
    const btn=makeButton(this,W/2,454,300,64,'VOLVER AL MENÚ',()=>this.scene.start('Menu'));btn.setDepth(52);
  }
}

function makeButton(scene,x,y,w,h,label,onClick){
  const bg=scene.add.rectangle(x,y,w,h,0x5b317f,.96).setStrokeStyle(3,0xd7a9ff).setInteractive({useHandCursor:true});
  scene.add.text(x,y,label,{fontFamily:'Arial',fontSize:'20px',fontStyle:'bold',color:'#fff'}).setOrigin(.5);
  bg.on('pointerover',()=>bg.setFillStyle(0x75459a,1)).on('pointerout',()=>bg.setFillStyle(0x5b317f,.96)).on('pointerdown',onClick);
  return bg;
}
function flashText(scene,text,x,y,color=0xffffff){const t=scene.add.text(x,y,text,{fontSize:'19px',fontStyle:'bold',color:Phaser.Display.Color.IntegerToColor(color).rgba,backgroundColor:'#130d1b',padding:{x:12,y:7}}).setOrigin(.5).setDepth(100);scene.tweens.add({targets:t,y:y-25,alpha:0,duration:1100,onComplete:()=>t.destroy()});}
function floatNumber(scene,text,x,y,color){const t=scene.add.text(x,y,text,{fontSize:'25px',fontStyle:'bold',color:Phaser.Display.Color.IntegerToColor(color).rgba,stroke:'#160a0d',strokeThickness:4}).setOrigin(.5).setDepth(30);scene.tweens.add({targets:t,y:y-40,alpha:0,duration:700,onComplete:()=>t.destroy()});}

const config={type:Phaser.AUTO,width:W,height:H,parent:'game-container',backgroundColor:'#090711',pixelArt:false,antialias:true,scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},scene:[BootScene,MenuScene,PlacementScene,BattleScene]};
new Phaser.Game(config);
