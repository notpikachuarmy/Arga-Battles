import { GAME, BALANCE } from '../config.js';
import { CLASSES } from '../data/classes.js';
import { ABILITIES } from '../data/abilities.js';
import { BLESSINGS, blessingBonusForCount } from '../data/blessings.js';
import { SAVE } from '../data/save.js';
import { calculateStats, earlyEnemyScaling, awardGlobalXp } from '../systems/progression.js';
import { rollDie } from '../utils/dice.js';
import { makeButton, flashText, floatNumber } from '../utils/helpers.js';

export class BattleScene extends Phaser.Scene{
  constructor(){super('Battle');}
  init(data){this.startPositions=data.positions;this.enemyPositions=data.enemyPositions||[];}
  create(){
    const {width:W,height:H,tile:T,cols,rows,gridX,gridY}=GAME;
    this.add.image(W/2,H/2,'battleBg').setDisplaySize(W,H);this.add.rectangle(W/2,H/2,W,H,0x08050d,.17);
    this.add.text(26,18,`RONDA ${SAVE.round}`,{fontSize:'27px',fontStyle:'bold',color:'#fff'});
    this.infoText=this.add.text(W/2,24,'',{fontSize:'19px',fontStyle:'bold',color:'#fff',stroke:'#130d1b',strokeThickness:4}).setOrigin(.5);
    this.cells=[];
    for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
      const x=gridX+c*T+T/2,y=gridY+r*T+T/2;
      const rect=this.add.rectangle(x,y,T-4,T-4,c<3?0x286946:0x7b303a,.30).setStrokeStyle(2,c===2||c===3?0xd6bbef:0xbdaecd,.67).setInteractive({useHandCursor:true}).on('pointerdown',()=>this.onCell(c,r));
      this.cells.push({c,r,x,y,rect});
    }
    this.units=[];this.nextId=1;
    this.startPositions.forEach(p=>this.spawnUnit(p.type,'player',p.col,p.row,p.level||1,p.recruitId,null,p.learnedAbilities,p.blessing));
    const difficulty=Math.min(5,Math.floor((SAVE.round-1)/2));const scale=earlyEnemyScaling(SAVE.round);
    this.enemyPositions.forEach(p=>this.spawnUnit(p.type,'enemy',p.col,p.row,Math.min(10,(p.level||1)+difficulty),null,scale,p.learnedAbilities,p.blessing));
    this.applyBlessings();
    this.units.forEach(u=>this.drawUnit(u));
    this.action='none';this.active=null;this.turnQueue=[];this.queueIndex=0;this.battleOver=false;this.autoBattle=false;
    this.createHud();this.buildTurnQueue();this.beginTurn();
  }
  spawnUnit(type,team,col,row,level=1,recruitId=null,scale=null,learnedAbilities=[],blessing=null){
    const stats=calculateStats(type,level);
    if(team==='enemy'&&scale){stats.maxHp=Math.max(5,Math.round(stats.maxHp*scale.hp));for(const key of ['df','str','int','agi','charisma','will','perception'])stats[key]=Math.max(1,Math.round(stats[key]*scale.combat));}
    const u={id:this.nextId++,recruitId,type,team,col,row,level,name:CLASSES[type].name,blessing:blessing||CLASSES[type].defaultBlessing,...stats,hp:stats.maxHp,mp:stats.maxMp,ap:GAME.apPerTurn,maxAp:GAME.apPerTurn,alive:true,learnedAbilities:[...(learnedAbilities||[])],buffs:[],paralyzedTurns:0,turnsTaken:0,blessingBonus:0};
    this.units.push(u);return u;
  }
  applyBlessings(){
    for(const team of ['player','enemy']){
      const teamUnits=this.units.filter(u=>u.team===team);
      const counts={};
      teamUnits.forEach(u=>counts[u.blessing]=(counts[u.blessing]||0)+1);
      teamUnits.forEach(u=>{
        const blessing=BLESSINGS[u.blessing];
        if(!blessing)return;
        const bonus=blessingBonusForCount(counts[u.blessing]||1);
        u[blessing.stat]+=bonus;
        u.blessingBonus=bonus;
      });
    }
  }
  drawUnit(u){
    const{x,y}=this.cellCenter(u.col,u.row);u.sprite=this.add.image(x,y,u.type).setDisplaySize(82,82).setFlipX(u.team==='enemy').setInteractive({useHandCursor:true});if(u.team==='enemy')u.sprite.setTint(0xffdddd);
    u.sprite.on('pointerdown',()=>{if(this.action==='attack'&&this.active?.team==='player')this.tryAttackTarget(u);else if(this.action==='skill'&&this.active?.team==='player')this.trySkillTarget(u);else this.showStats(u);});
    u.hpBack=this.add.rectangle(x,y-48,76,8,0x190d14,.95).setStrokeStyle(1,0xffffff,.35);u.hpBar=this.add.rectangle(x-37,y-48,74,6,0x42d36e,1).setOrigin(0,.5);u.arrow=this.add.image(x,y+48,'arrow').setDisplaySize(25,25).setFlipX(u.team==='enemy').setAlpha(.72);
  }
  createHud(){
    const W=GAME.width;this.add.rectangle(W/2,622,1160,174,0x120d1b,.96).setStrokeStyle(3,0x786589);
    this.portrait=this.add.image(158,620,'runePortrait').setDisplaySize(124,124);this.nameText=this.add.text(235,550,'',{fontSize:'21px',fontStyle:'bold',color:'#fff',wordWrap:{width:390}});this.resourceText=this.add.text(235,586,'',{fontSize:'17px',color:'#eee6f4'});this.actionInfo=this.add.text(235,644,'Selecciona una acción.',{fontSize:'14px',color:'#cfc4d8',wordWrap:{width:390},lineSpacing:3});
    this.buttons={move:this.actionButton(665,610,'move','MOVER','1 AP',()=>this.selectAction('move')),attack:this.actionButton(785,610,'attack','ATACAR','2 AP',()=>this.selectAction('attack')),skill:this.actionButton(905,610,'skill','HABILIDAD','',()=>this.selectAction('skill')),end:this.actionButton(1025,610,'end','TERMINAR','Turno',()=>{if(!this.autoBattle)this.endTurn();})};
    this.turnPanel=this.add.container(12,68);this.statsContainer=null;
    this.autoButton=this.add.rectangle(1168,42,184,48,0x241a31,.96).setStrokeStyle(2,0xb896d1).setInteractive({useHandCursor:true});this.autoLabel=this.add.text(1168,42,'AUTO-BATTLE: NO',{fontSize:'15px',fontStyle:'bold',color:'#fff'}).setOrigin(.5);this.autoButton.on('pointerdown',()=>this.toggleAutoBattle());
  }
  actionButton(x,y,tex,label,cost,cb){const bg=this.add.rectangle(x,y,98,118,0x261b33,.97).setStrokeStyle(2,0x917aa9).setInteractive({useHandCursor:true}).on('pointerdown',cb);const icon=this.add.image(x,y-18,tex).setDisplaySize(58,58);const txt=this.add.text(x,y+25,label,{fontSize:'12px',fontStyle:'bold',color:'#fff'}).setOrigin(.5);const ct=this.add.text(x,y+45,cost,{fontSize:'11px',color:'#d1c5dd'}).setOrigin(.5);return{bg,icon,txt,ct};}
  buildTurnQueue(){this.turnQueue=this.units.filter(u=>u.alive).sort((a,b)=>b.agi-a.agi||(a.team==='player'?-1:1));this.queueIndex=0;this.refreshTurnOrder();}
  refreshTurnOrder(){this.turnPanel.removeAll(true);const alive=this.turnQueue.filter(u=>u.alive);alive.forEach((u,i)=>{const y=i*68,active=u===this.active;const aura=this.add.circle(50,y+35,active?31:27,u.team==='player'?0x32d46f:0xe34754,active?1:.65);const img=this.add.image(50,y+35,u.type).setDisplaySize(active?55:48,active?55:48).setFlipX(u.team==='enemy');const hp=this.add.text(83,y+26,`${Math.max(0,u.hp)}/${u.maxHp}`,{fontSize:'12px',color:'#fff'});this.turnPanel.add([aura,img,hp]);});}
  beginTurn(){
    if(this.battleOver)return;this.clearHighlights();this.action='none';while(this.queueIndex<this.turnQueue.length&&!this.turnQueue[this.queueIndex].alive)this.queueIndex++;if(this.queueIndex>=this.turnQueue.length)this.buildTurnQueue();this.active=this.turnQueue[this.queueIndex];if(!this.active)return;
    this.active.ap=this.active.maxAp;
    this.active.turnsTaken++;
    if(this.active.turnsTaken%BALANCE.mpRegenEveryTurns===0&&this.active.mp<this.active.maxMp){
      const restored=Math.max(1,Math.ceil(this.active.maxMp*BALANCE.mpRegenPercent));
      const actual=Math.min(restored,this.active.maxMp-this.active.mp);
      this.active.mp+=actual;
      flashText(this,`+${actual} MP`,this.active.sprite.x,this.active.sprite.y-78,0x71bfff);
    }
    this.updateHud();this.refreshTurnOrder();
    if(this.active.paralyzedTurns>0){this.active.paralyzedTurns--;flashText(this,`${this.active.name} está paralizado.`,GAME.width/2,110,0x91c9ff);this.time.delayedCall(700,()=>this.endTurn());return;}
    if(this.active.team==='enemy'||this.autoBattle){this.infoText.setText(`${this.active.team==='enemy'?'Turno enemigo':'Auto-battle'}: ${this.active.name}`);this.time.delayedCall(450,()=>this.runAIControlled(this.active));}else{this.infoText.setText(`Tu turno: ${this.active.name}`);this.updateButtons();}
  }
  selectedAbility(){const id=this.active?.learnedAbilities?.[0];return id?ABILITIES[id]:null;}
  selectAction(action){
    if(this.battleOver||!this.active||this.active.team!=='player'||this.autoBattle)return;this.clearHighlights();
    if(action==='move'){if(this.active.ap<1)return flashText(this,'No tienes AP suficiente.',640,120,0xff7777);this.action='move';this.actionInfo.setText('Movimiento · 1 AP · Elige una casilla adyacente libre.');this.validMoves(this.active).forEach(p=>this.highlightCell(p.col,p.row,0x50dc84));return;}
    if(action==='attack'){if(this.active.ap<2)return flashText(this,'No tienes AP suficiente.',640,120,0xff7777);this.action='attack';this.actionInfo.setText('Ataque básico · 2 AP · 1d3 + 1/2 FUE. Pulsa al enemigo frontal.');const t=this.frontTarget(this.active);if(t)this.highlightCell(t.col,t.row,0xff525f);else flashText(this,'No hay enemigo delante.',640,120,0xffbd69);return;}
    const a=this.selectedAbility();if(!a)return flashText(this,'Esta unidad no conoce ninguna habilidad.',640,120,0xffbd69);if(this.active.ap<a.apCost||this.active.mp<a.mpCost)return flashText(this,'No tienes AP o MP suficiente.',640,120,0xff7777);
    this.action='skill';this.actionInfo.setText(`${a.name} · ${a.apCost} AP · ${a.mpCost} MP · ${a.description}`);
    if(a.targetMode==='self'){this.executeAbility(this.active,null);return;}
    this.skillCells(this.active,a).forEach(p=>this.highlightCell(p.col,p.row,0x5ba9ff));
  }
  onCell(col,row){if(this.battleOver||!this.active||this.active.team!=='player'||this.autoBattle)return;if(this.action==='move'&&this.validMoves(this.active).some(p=>p.col===col&&p.row===row))this.moveUnit(this.active,col,row,()=>{this.active.ap--;this.afterAction();});else if(this.action==='attack'){const t=this.unitAt(col,row);if(t)this.tryAttackTarget(t);}else if(this.action==='skill')this.trySkillCell(col,row);}
  tryAttackTarget(target){if(target!==this.frontTarget(this.active)||target.team===this.active.team)return flashText(this,'Solo puedes atacar al enemigo frontal.',640,120,0xffbd69);this.basicAttack(this.active,target,()=>{this.active.ap-=BALANCE.basicAttackCost;this.afterAction();this.checkEnd();});}
  basicAttack(attacker,target,done){const damage=Math.max(1,rollDie(BALANCE.basicAttackDie)+Math.floor(attacker.str/BALANCE.basicAttackStrengthDivisor)-Math.floor(target.df/3));this.playHit(attacker,target,damage,'hit',done);}
  skillCells(u,a){
    const dir=u.team==='player'?1:-1;if(a.targetMode==='line'){const out=[];for(let i=1;i<=a.range;i++){const col=u.col+dir*i;if(col<0||col>=GAME.cols)break;out.push({col,row:u.row});if(this.unitAt(col,u.row))break;}return out;}
    if(a.targetMode==='frontArea'){const col=u.col+dir;return[-1,0,1].map(d=>({col,row:u.row+d})).filter(p=>p.col>=0&&p.col<GAME.cols&&p.row>=0&&p.row<GAME.rows);}
    return[];
  }
  trySkillTarget(target){this.trySkillCell(target.col,target.row);}
  trySkillCell(col,row){const a=this.selectedAbility();if(!a)return;const valid=this.skillCells(this.active,a).some(p=>p.col===col&&p.row===row);if(!valid)return flashText(this,'Objetivo no válido.',640,120,0xffbd69);this.executeAbility(this.active,{col,row});}
  executeAbility(u,targetCell){
    const a=this.selectedAbility();if(!a)return;
    if(a.id==='runeLightningSpear'){
      const target=this.unitAt(targetCell.col,targetCell.row);if(!target||target.team===u.team)return flashText(this,'Debes elegir un enemigo en la línea.',640,120,0xffbd69);
      const damage=Math.max(1,rollDie(5)+Math.floor(u.int/3)-Math.floor(target.df/4));this.playHit(u,target,damage,'lightningFx',()=>{if(Math.random()<.05){target.paralyzedTurns=1;flashText(this,'¡Parálisis!',target.sprite.x,target.sprite.y-80,0x91c9ff);}this.payAbility(u,a);});return;
    }
    if(a.id==='liquidArm'){
      const targets=this.skillCells(u,a).map(p=>this.unitAt(p.col,p.row)).filter(t=>t&&t.team!==u.team);if(!targets.length)return flashText(this,'No hay enemigos en el área.',640,120,0xffbd69);
      targets.forEach(t=>{const damage=Math.max(1,rollDie(3)+Math.floor(u.str/4)-Math.floor(t.df/4));t.hp-=damage;this.spawnFx(t,'liquidFx');floatNumber(this,`-${damage}`,t.sprite.x,t.sprite.y-62,0xff626f);this.updateUnitHp(t);if(t.hp<=0)this.killUnit(t);});this.payAbility(u,a);this.checkEnd();return;
    }
    if(a.id==='devilBloodThorns'){
      u.str+=2;u.df+=2;u.buffs.push({id:'bloodThorns',remaining:2,str:2,df:2});this.spawnFx(u,'bloodFx');flashText(this,'+2 FUE · +2 DF · Recupera 1 AP',u.sprite.x,u.sprite.y-80,0xff8a9a);this.payAbility(u,a,1);return;
    }
  }
  payAbility(u,a,apRefund=0){u.ap=Math.min(u.maxAp,u.ap-a.apCost+apRefund);u.mp-=a.mpCost;this.afterAction();this.checkEnd();}
  afterAction(){this.action='none';this.clearHighlights();this.updateHud();this.updateButtons();}
  playHit(attacker,target,damage,fxKey,done){const dir=attacker.team==='player'?1:-1,ox=attacker.sprite.x;this.tweens.add({targets:attacker.sprite,x:ox+dir*22,duration:90,yoyo:true,onComplete:()=>{target.hp-=damage;this.spawnFx(target,fxKey);floatNumber(this,`-${damage}`,target.sprite.x,target.sprite.y-62,0xff626f);this.updateUnitHp(target);if(target.hp<=0)this.killUnit(target);done?.();}});}
  spawnFx(target,key){const fx=this.add.image(target.sprite.x,target.sprite.y,key).setDisplaySize(110,110).setAlpha(.95);this.tweens.add({targets:fx,alpha:0,scale:1.4,duration:300,onComplete:()=>fx.destroy()});}
  validMoves(u){return[[u.col+1,u.row],[u.col-1,u.row],[u.col,u.row+1],[u.col,u.row-1]].filter(([c,r])=>c>=0&&c<GAME.cols&&r>=0&&r<GAME.rows&&!this.unitAt(c,r)).map(([col,row])=>({col,row}));}
  frontTarget(u){return this.unitAt(u.col+(u.team==='player'?1:-1),u.row);}
  moveUnit(u,col,row,done){u.col=col;u.row=row;const{x,y}=this.cellCenter(col,row);this.tweens.add({targets:[u.sprite,u.hpBack,u.hpBar,u.arrow],x:{value:x},duration:260,onUpdate:()=>{u.hpBack.x=u.sprite.x;u.hpBar.x=u.sprite.x-37;u.arrow.x=u.sprite.x;},onComplete:()=>{u.sprite.y=y;u.hpBack.y=y-48;u.hpBar.y=y-48;u.arrow.y=y+48;done?.();}});}
  endTurn(){if(this.battleOver||!this.active)return;this.tickBuffs(this.active);this.action='none';this.clearHighlights();this.queueIndex++;this.time.delayedCall(220,()=>this.beginTurn());}
  tickBuffs(u){u.buffs.forEach(b=>b.remaining--);const expired=u.buffs.filter(b=>b.remaining<=0);expired.forEach(b=>{u.str-=b.str||0;u.df-=b.df||0;});u.buffs=u.buffs.filter(b=>b.remaining>0);}
  toggleAutoBattle(){if(this.battleOver)return;this.autoBattle=!this.autoBattle;this.autoLabel.setText(`AUTO-BATTLE: ${this.autoBattle?'SÍ':'NO'}`);this.autoButton.setFillStyle(this.autoBattle?0x285f3c:0x241a31,.96);if(this.autoBattle&&this.active?.team==='player')this.time.delayedCall(200,()=>this.runAIControlled(this.active));}
  runAIControlled(u){
    if(!u?.alive||this.battleOver||u!==this.active)return;const enemyTeam=u.team==='player'?'enemy':'player';const loop=()=>{if(this.battleOver||u!==this.active||!u.alive)return;if(u.ap<=0)return this.endTurn();const a=this.selectedAbilityFor(u);
      if(a&&u.ap>=a.apCost&&u.mp>=a.mpCost&&this.aiUseAbility(u,a,enemyTeam,loop))return;
      const front=this.frontTarget(u);if(front&&front.team===enemyTeam&&u.ap>=2)return this.basicAttack(u,front,()=>{u.ap-=2;this.updateHud();if(!this.checkEnd())this.time.delayedCall(250,loop);});
      const moves=this.validMoves(u),targets=this.units.filter(q=>q.alive&&q.team===enemyTeam);if(u.ap>=1&&moves.length&&targets.length){const best=moves.map(m=>({m,score:Math.min(...targets.map(t=>Math.abs(t.col-m.col)+Math.abs(t.row-m.row)))})).sort((a,b)=>a.score-b.score)[0].m;return this.moveUnit(u,best.col,best.row,()=>{u.ap--;this.updateHud();this.time.delayedCall(220,loop);});}this.endTurn();};loop();
  }
  selectedAbilityFor(u){const id=u.learnedAbilities?.[0];return id?ABILITIES[id]:null;}
  aiUseAbility(u,a,enemyTeam,loop){
    const old=this.active;this.active=u;
    if(a.id==='devilBloodThorns'&&!u.buffs.some(b=>b.id==='bloodThorns')){this.executeAbility(u,null);this.time.delayedCall(250,loop);return true;}
    if(a.id==='runeLightningSpear'){const t=this.skillCells(u,a).map(p=>this.unitAt(p.col,p.row)).find(t=>t&&t.team===enemyTeam);if(t){this.executeAbility(u,{col:t.col,row:t.row});this.time.delayedCall(250,loop);return true;}}
    if(a.id==='liquidArm'){const has=this.skillCells(u,a).some(p=>{const t=this.unitAt(p.col,p.row);return t&&t.team===enemyTeam;});if(has){this.executeAbility(u,this.skillCells(u,a)[0]);this.time.delayedCall(250,loop);return true;}}
    this.active=old;return false;
  }
  updateHud(){if(!this.active)return;this.portrait.setTexture(CLASSES[this.active.type].portrait);this.nameText.setText(`${this.active.name} · Nv. ${this.active.level}`);this.resourceText.setText(`HP ${Math.max(0,this.active.hp)}/${this.active.maxHp}     MP ${this.active.mp}/${this.active.maxMp}     AP ${this.active.ap}/${this.active.maxAp}`);const a=this.selectedAbility();if(a){this.buttons.skill.icon.setTexture(a.icon);this.buttons.skill.ct.setText(`${a.apCost} AP · ${a.mpCost} MP`);}else{this.buttons.skill.icon.setTexture('skill');this.buttons.skill.ct.setText('Bloqueada');}}
  updateButtons(){const can=this.active?.team==='player'&&!this.autoBattle;Object.values(this.buttons).forEach(b=>{b.bg.setAlpha(can?1:.35);b.icon.setAlpha(can?1:.35);b.icon.clearTint();});if(!can)return;const a=this.selectedAbility();if(this.active.ap<1)this.buttons.move.icon.setTint(0xff5555);if(this.active.ap<2)this.buttons.attack.icon.setTint(0xff5555);if(!a)this.buttons.skill.icon.setTint(0x222222);else if(this.active.ap<a.apCost||this.active.mp<a.mpCost)this.buttons.skill.icon.setTint(0xff5555);}
  showStats(u){
    this.statsContainer?.destroy(true);const b=CLASSES[u.type],c=this.add.container(815,35).setDepth(40);this.statsContainer=c;const panel=this.add.rectangle(0,0,430,650,0x100b18,.98).setOrigin(0).setStrokeStyle(3,u.team==='player'?0x48d47a:0xe7505d);const title=this.add.text(20,17,u.name,{fontSize:'22px',fontStyle:'bold',color:'#fff'});const subtitle=this.add.text(20,54,`Nivel ${u.level} · ${u.team==='player'?'Aliado':'Enemigo'}`,{fontSize:'16px',color:'#d8ccdf'});const close=this.add.text(383,12,'✕',{fontSize:'30px',color:'#fff'}).setInteractive({useHandCursor:true}).on('pointerdown',()=>{c.destroy(true);this.statsContainer=null;});const portrait=this.add.image(91,159,b.portrait).setDisplaySize(120,120);const combat=this.add.text(172,101,[`HP ${Math.max(0,u.hp)}/${u.maxHp}`,`MP ${u.mp}/${u.maxMp}`,`AP ${u.ap}/${u.maxAp}`,`DF ${u.df}`,`FUE ${u.str}`,`INT ${u.int}`,`AGI ${u.agi}`].join('\n'),{fontSize:'16px',color:'#eee6f4',lineSpacing:5});const blessingData=BLESSINGS[u.blessing];const blessing=this.add.image(80,340,blessingData.texture).setDisplaySize(90,90);const blessingName=this.add.text(145,312,`${u.blessing}\n+${u.blessingBonus} ${blessingData.statLabel}`,{fontSize:'18px',fontStyle:'bold',color:'#fff',lineSpacing:5});const stats=this.add.text(20,430,[`Constitución: ${u.constitution}     Energía: ${u.energy}`,`Carisma: ${u.charisma}             Voluntad: ${u.will}`,`Sigilo: ${u.stealth}%              Percepción: ${u.perception}`].join('\n'),{fontSize:'15px',color:'#d1c5dc',lineSpacing:18});c.add([panel,title,subtitle,close,portrait,combat,blessing,blessingName,stats]);
  }
  updateUnitHp(u){const ratio=Phaser.Math.Clamp(u.hp/u.maxHp,0,1);u.hpBar.width=74*ratio;u.hpBar.fillColor=ratio>.5?0x42d36e:ratio>.25?0xf3bf4d:0xe54452;}
  killUnit(u){u.alive=false;this.tweens.add({targets:[u.sprite,u.hpBack,u.hpBar,u.arrow],alpha:0,y:u.sprite.y+25,duration:350,onComplete:()=>{[u.sprite,u.hpBack,u.hpBar,u.arrow].forEach(x=>x.setVisible(false));this.refreshTurnOrder();}});}
  clearHighlights(){this.cells.forEach(c=>c.rect.setFillStyle(c.c<3?0x286946:0x7b303a,.30));}
  highlightCell(col,row,color){this.cells.find(c=>c.c===col&&c.r===row)?.rect.setFillStyle(color,.68);}
  cellCenter(col,row){return{x:GAME.gridX+col*GAME.tile+GAME.tile/2,y:GAME.gridY+row*GAME.tile+GAME.tile/2};}
  unitAt(col,row){return this.units.find(u=>u.alive&&u.col===col&&u.row===row);}
  checkEnd(){const players=this.units.some(u=>u.alive&&u.team==='player'),enemies=this.units.some(u=>u.alive&&u.team==='enemy');if(players&&enemies)return false;this.battleOver=true;this.clearHighlights();this.time.delayedCall(500,()=>players?this.showVictory():this.showDefeat());return true;}
  showVictory(){
    this.add.rectangle(640,360,1280,720,0x07040b,.84).setDepth(50);this.add.rectangle(640,360,680,430,0x171020,.99).setStrokeStyle(4,0x66e38e).setDepth(51);
    this.add.text(640,205,'¡VICTORIA!',{fontSize:'46px',fontStyle:'bold',color:'#79ee9c'}).setOrigin(.5).setDepth(52);
    const xp=BALANCE.xpBase+SAVE.round*BALANCE.xpPerRound,ups=awardGlobalXp(xp);SAVE.soldierPoints+=BALANCE.victorySoldierPoints;
    this.add.text(640,270,`Ronda ${SAVE.round} superada`,{fontSize:'23px',fontStyle:'bold',color:'#fff'}).setOrigin(.5).setDepth(52);
    this.add.text(640,330,`+${BALANCE.victorySoldierPoints} Punto de Soldado     +${xp} XP global`,{fontSize:'20px',color:'#ffe596'}).setOrigin(.5).setDepth(52);
    const lines=ups.length?ups.map(x=>`${x.name}: nivel ${x.newLevel}`).join('\n'):'Ninguna unidad ha subido de nivel.';
    this.add.text(640,390,lines,{fontSize:'17px',color:'#ddd4e5',align:'center',lineSpacing:8,wordWrap:{width:560}}).setOrigin(.5).setDepth(52);
    makeButton(this,640,505,320,66,'SIGUIENTE RONDA',()=>{SAVE.round++;this.scene.start('Placement');}).setDepth(52);
  }
  showDefeat(){this.add.rectangle(640,360,1280,720,0x07040b,.84).setDepth(50);this.add.rectangle(640,360,600,350,0x171020,.98).setStrokeStyle(4,0xe2505d).setDepth(51);this.add.text(640,250,'DERROTA',{fontSize:'48px',fontStyle:'bold',color:'#ff6571'}).setOrigin(.5).setDepth(52);this.add.text(640,335,`Has alcanzado la ronda ${SAVE.round}.\nLa run ha terminado.`,{fontSize:'21px',color:'#eee5f2',align:'center'}).setOrigin(.5).setDepth(52);makeButton(this,640,454,300,64,'VOLVER AL MENÚ',()=>this.scene.start('Menu')).setDepth(52);}
}
