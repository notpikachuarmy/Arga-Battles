import { GAME, BALANCE } from '../config.js';
import { CLASSES } from '../data/classes.js';
import { ABILITIES } from '../data/abilities.js';
import { BLESSINGS, blessingBonusForCount } from '../data/blessings.js';
import { SAVE, resetRun } from '../data/save.js';
import { calculateStats, earlyEnemyScaling, awardGlobalXp } from '../systems/progression.js';
import { rollDie } from '../utils/dice.js';
import { makeButton, flashText, floatNumber } from '../utils/helpers.js';
import { hasRelic } from '../data/relics.js';

const STATUS_TEXTURES={
  paralyzed:'paralyzed',bloodThorns:'strengthUp',fireDamage:'fireDamageUp',adaptiveResistance:'adaptiveResistanceStatus',wateryDodge:'wateryDodgeStatus',miniaturized:'miniaturized',maximized:'maximized',transformed:'transformed',stealth:'stealth',poison:'poisoned',bloodThirst:'bloodThirstStatus',crimsonPact:'crimsonPactStatus',lifesteal:'lifesteal'
};

export class BattleScene extends Phaser.Scene{
  constructor(){super('Battle');}
  init(data){this.startPositions=data.positions;this.enemyPositions=data.enemyPositions||[];this.enemyRelics=data.enemyRelics||SAVE.enemyRelics||[];}
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
    this.units=[];this.nextId=1;this.lastAbilityByTeam={player:null,enemy:null};this.damageSerial=0;this.lastTurnDamageSerial=0;this.noDamageTurns=0;this.stalemateResets=0;
    this.startPositions.forEach(p=>this.spawnUnit(p.type,'player',p.col,p.row,p.level||1,p.recruitId,null,p.learnedAbilities,p.blessing,{name:p.name}));
    const scale=earlyEnemyScaling(SAVE.round);
    this.enemyPositions.forEach(p=>this.spawnUnit(p.type,'enemy',p.col,p.row,Math.min(10,p.level||1),null,scale,p.learnedAbilities,p.blessing));
    this.applyBlessings();this.units.forEach(u=>this.drawUnit(u));
    this.action='none';this.active=null;this.selectedSkillIndex=0;this.turnQueue=[];this.queueIndex=0;this.battleOver=false;this.autoBattle=false;
    this.createHud();this.buildTurnQueue();this.beginTurn();
  }
  spawnUnit(type,team,col,row,level=1,recruitId=null,scale=null,learnedAbilities=[],blessing=null,options={}){
    let stats;
    if(type==='zombie')stats={maxHp:12,maxMp:0,df:1,str:2,int:0,agi:1,constitution:2,energy:0,charisma:0,will:1,stealth:0,perception:1};
    else stats=calculateStats(type,level);
    if(team==='enemy'&&scale&&!options.isSummon){stats.maxHp=Math.max(5,Math.round(stats.maxHp*scale.hp));for(const key of ['df','str','int','agi','charisma','will','perception'])stats[key]=Math.max(1,Math.round(stats[key]*scale.combat));}
    const cls=CLASSES[type];
    const known=[...(learnedAbilities||[])];
    if(cls&&team==='enemy'){
      const available=()=>cls.abilityPool.filter(id=>!known.includes(id));
      if(level>=5&&known.length<2&&available().length)known.push(Phaser.Utils.Array.GetRandom(available()));
      if(level>=10&&known.length<3&&available().length)known.push(Phaser.Utils.Array.GetRandom(available()));
    }
    const u={id:this.nextId++,recruitId,type,team,col,row,level,name:options.name||cls?.name||'Zombi',blessing:blessing||cls?.defaultBlessing||null,...stats,hp:stats.maxHp,mp:stats.maxMp,ap:GAME.apPerTurn,maxAp:GAME.apPerTurn,alive:true,learnedAbilities:known,buffs:[],paralyzedTurns:0,turnsTaken:0,blessingBonus:0,isSummon:!!options.isSummon,isObstacle:!!options.isObstacle,resurrectionUsed:false,copiedAbility:null,ownerId:options.ownerId??null,persistentSummon:!!options.persistentSummon,cooldowns:{},echoUsed:false,berserkerActive:false};
    this.units.push(u);return u;
  }
  applyBlessings(){for(const team of ['player','enemy']){const list=this.units.filter(u=>u.team===team&&!u.isSummon&&u.blessing),counts={};list.forEach(u=>counts[u.blessing]=(counts[u.blessing]||0)+1);const resonant=team==='player'?hasRelic(SAVE,'resonantStone'):this.enemyRelics.includes('resonantStone');list.forEach(u=>{const b=BLESSINGS[u.blessing];if(!b)return;const count=(counts[u.blessing]||1)+(resonant?1:0);const bonus=blessingBonusForCount(count);u[b.stat]+=bonus;u.blessingBonus=bonus;});}}
  createHud(){
    this.hudBg=this.add.rectangle(640,612,1235,205,0x120d1b,.97).setStrokeStyle(3,0x786589);
    this.portrait=this.add.image(105,607,'runePortrait').setDisplaySize(120,120);
    this.nameText=this.add.text(182,518,'',{fontSize:'20px',fontStyle:'bold',color:'#fff',wordWrap:{width:390}});
    this.resourceText=this.add.text(182,552,'',{fontSize:'16px',color:'#eee6f4'});
    this.actionInfo=this.add.text(182,591,'Selecciona una acción.',{fontSize:'12px',color:'#cfc4d8',wordWrap:{width:415},lineSpacing:2,maxLines:6});
    this.buttons={move:this.actionButton(640,610,'move','MOVER','1 AP',()=>this.selectAction('move')),attack:this.actionButton(735,610,'attack','ATACAR','2 AP',()=>this.selectAction('attack')),skills:[],end:this.actionButton(1125,610,'end','TERMINAR','Turno',()=>{if(!this.autoBattle)this.endTurn();})};
    [830,925,1020].forEach((x,i)=>this.buttons.skills.push(this.actionButton(x,610,'skill',`SKILL ${i+1}`,'Bloqueada',()=>this.selectSkill(i))));
    this.hudObjects=[this.hudBg,this.portrait,this.nameText,this.resourceText,this.actionInfo];Object.values(this.buttons).flatMap(v=>Array.isArray(v)?v:[v]).flat().forEach(b=>{if(b?.bg)this.hudObjects.push(b.bg,b.icon,b.txt,b.ct);});
    this.turnPanel=this.add.container(12,68);this.statsContainer=null;
    this.autoButton=this.add.rectangle(1168,42,184,48,0x241a31,.96).setStrokeStyle(2,0xb896d1).setInteractive({useHandCursor:true});this.autoLabel=this.add.text(1168,42,'AUTO-BATTLE: NO',{fontSize:'15px',fontStyle:'bold',color:'#fff'}).setOrigin(.5);this.autoButton.on('pointerdown',()=>this.toggleAutoBattle());
    const relicBtn=makeButton(this,1010,42,120,42,'RELIQUIAS',()=>{this.scene.pause();this.scene.launch('Relics',{returnScene:'Battle'});});this.relicButton=relicBtn;
  }
  actionButton(x,y,tex,label,cost,cb){const bg=this.add.rectangle(x,y,84,122,0x261b33,.97).setStrokeStyle(2,0x917aa9).setInteractive({useHandCursor:true}).on('pointerdown',cb);const icon=this.add.image(x,y-20,tex).setDisplaySize(52,52);const txt=this.add.text(x,y+24,label,{fontSize:'10px',fontStyle:'bold',color:'#fff',align:'center',wordWrap:{width:78}}).setOrigin(.5);const ct=this.add.text(x,y+47,cost,{fontSize:'10px',color:'#d1c5dd',align:'center',wordWrap:{width:78}}).setOrigin(.5);return{bg,icon,txt,ct};}
  buildTurnQueue(){this.turnQueue=this.units.filter(u=>u.alive&&!u.isObstacle).sort((a,b)=>b.agi-a.agi||(a.team==='player'?-1:1));this.queueIndex=0;this.refreshTurnOrder();}
  refreshTurnOrder(){this.turnPanel.removeAll(true);this.turnQueue.filter(u=>u.alive).forEach((u,i)=>{const y=i*62,active=u===this.active;const aura=this.add.circle(48,y+30,active?29:25,u.team==='player'?0x32d46f:0xe34754,active?1:.65);const img=this.add.image(48,y+30,u.type).setDisplaySize(active?51:44,active?51:44).setFlipX(u.team==='enemy');const hp=this.add.text(78,y+22,`${Math.max(0,u.hp)}/${u.maxHp}`,{fontSize:'11px',color:'#fff'});this.turnPanel.add([aura,img,hp]);});}
  beginTurn(){
    if(this.battleOver)return;this.clearHighlights();this.action='none';while(this.queueIndex<this.turnQueue.length&&!this.turnQueue[this.queueIndex].alive)this.queueIndex++;if(this.queueIndex>=this.turnQueue.length)this.buildTurnQueue();this.active=this.turnQueue[this.queueIndex];if(!this.active)return;
    this.active.ap=this.active.maxAp;this.active.turnsTaken++;this.active.usedAbilitiesThisTurn=[];this.selectedSkillIndex=0;this.active.damageAtTurnStart=this.damageSerial;
    Object.keys(this.active.cooldowns||{}).forEach(id=>{if(this.active.cooldowns[id]>0)this.active.cooldowns[id]--;});
    if(this.active.turnsTaken%BALANCE.mpRegenEveryTurns===0&&this.active.mp<this.active.maxMp){const restored=Math.max(1,Math.ceil(this.active.maxMp*BALANCE.mpRegenPercent)),actual=Math.min(restored,this.active.maxMp-this.active.mp);this.active.mp+=actual;flashText(this,`+${actual} MP`,this.active.sprite.x,this.active.sprite.y-78,0x71bfff);}
    this.applyTurnStartStatuses(this.active);this.updateHud();this.refreshTurnOrder();
    if(!this.active.alive)return this.endTurn();
    if(this.active.paralyzedTurns>0){flashText(this,`${this.active.name} está paralizado.`,640,110,0x91c9ff);this.time.delayedCall(700,()=>this.endTurn());return;}
    if(this.active.team==='enemy'||this.autoBattle){this.setHudVisible(this.active.team!=='enemy');this.infoText.setText(`${this.active.team==='enemy'?'Turno enemigo':'Auto-battle'}: ${this.active.name}`);this.time.delayedCall(350,()=>this.runAIControlled(this.active));}else{this.setHudVisible(true);this.infoText.setText(`Tu turno: ${this.active.name}`);this.updateButtons();}
  }
  abilitiesFor(u){const ids=[...(u.learnedAbilities||[])];if(u.copiedAbility&&!ids.includes(u.copiedAbility))ids.push(u.copiedAbility);return ids.slice(0,3).map(id=>ABILITIES[id]).filter(Boolean);}
  selectedAbility(u=this.active){return this.abilitiesFor(u)[this.selectedSkillIndex]||null;}
  selectSkill(index){this.selectedSkillIndex=index;this.selectAction('skill');}
  selectAction(action){
    if(this.battleOver||!this.active||this.active.team!=='player'||this.autoBattle)return;this.clearHighlights();
    if(action==='move'){if(this.active.ap<1)return flashText(this,'No tienes AP suficiente.',640,120,0xff7777);this.action='move';this.actionInfo.setText('Movimiento · 1 AP · Elige una casilla adyacente libre.');this.validMoves(this.active).forEach(p=>this.highlightCell(p.col,p.row,0x50dc84));return;}
    if(action==='attack'){if(this.active.ap<2)return flashText(this,'No tienes AP suficiente.',640,120,0xff7777);this.action='attack';this.actionInfo.setText('Ataque básico · 2 AP · 1d3 + 1/2 FUE. Pulsa al objetivo frontal.');const t=this.frontTarget(this.active);if(t)this.highlightCell(t.col,t.row,0xff525f);else flashText(this,'No hay objetivo delante.',640,120,0xffbd69);return;}
    const a=this.selectedAbility();if(!a)return flashText(this,'Habilidad no aprendida.',640,120,0xffbd69);if(this.active.ap<a.apCost||this.active.mp<this.abilityMpCost(this.active,a)||this.abilityCooldown(this.active,a)>0)return flashText(this,'No tienes AP o MP suficiente.',640,120,0xff7777);
    this.action='skill';this.actionInfo.setText(`[${a.rarity}] ${a.name} · ${a.apCost} AP · ${a.mpCost} MP\n${a.description}`);
    if(a.targetMode==='self')this.actionInfo.setText(`[${a.rarity}] ${a.name} · ${a.apCost} AP · ${a.mpCost} MP\n${a.description}\nPulsa sobre la unidad activa para confirmar.`);
    const cells=this.skillCells(this.active,a);cells.forEach(p=>this.highlightCell(p.col,p.row,0x5ba9ff));if(!cells.length)flashText(this,'No hay objetivos válidos.',640,120,0xffbd69);
  }
  onCell(col,row){if(this.battleOver||!this.active||this.active.team!=='player'||this.autoBattle)return;if(this.action==='move'&&this.validMoves(this.active).some(p=>p.col===col&&p.row===row))this.moveUnit(this.active,col,row,()=>{this.active.ap--;this.afterAction();});else if(this.action==='attack'){const t=this.unitAt(col,row);if(t)this.tryAttackTarget(t);}else if(this.action==='skill')this.trySkillCell(col,row);}
  tryAttackTarget(target){if(target!==this.frontTarget(this.active)||target.team===this.active.team)return flashText(this,'Solo puedes atacar al objetivo frontal.',640,120,0xffbd69);this.breakStealth(this.active);this.basicAttack(this.active,target,()=>{this.active.ap-=BALANCE.basicAttackCost;this.afterAction();this.checkEnd();});}
  bonusDamage(u){return u.buffs.some(b=>b.id==='fireDamage')?rollDie(4):0;}
  basicAttack(attacker,target,done){let damage=Math.max(1,rollDie(3)+Math.floor(attacker.str/2)-Math.floor(target.df/3))+this.bonusDamage(attacker);this.dealDamage(attacker,target,damage,'hit',done);}
  skillCells(u,a){
    const dir=u.team==='player'?1:-1,all=this.cells.map(c=>({col:c.c,row:c.r}));
    if(a.targetMode==='self')return[{col:u.col,row:u.row}];
    if(a.targetMode==='line'){for(let i=1;i<=a.range;i++){const col=u.col+dir*i;if(col<0||col>=GAME.cols)break;const o=this.unitAt(col,u.row);if(!o)continue;if(o.team===u.team&&!o.isObstacle)continue;return o.team!==u.team?[{col,row:u.row}]:[];}return[];}
    if(a.targetMode==='frontArea'){const col=u.col+dir;return[-1,0,1].map(d=>({col,row:u.row+d})).filter(p=>p.col>=0&&p.col<GAME.cols&&p.row>=0&&p.row<GAME.rows);}
    if(a.targetMode==='frontEmpty'){return this.validMoves(u).filter(p=>Math.abs(p.col-u.col)+Math.abs(p.row-u.row)===1);}
    if(a.targetMode==='ally')return this.units.filter(t=>t.alive&&t.team===u.team&&!t.isObstacle&&Math.abs(t.col-u.col)+Math.abs(t.row-u.row)<=a.range).map(t=>({col:t.col,row:t.row}));
    if(a.targetMode==='deadAlly')return this.units.filter(t=>!t.alive&&t.team===u.team&&!t.isSummon).map(t=>({col:t.col,row:t.row}));
    if(a.targetMode==='cell')return all;
    if(a.targetMode==='anyUnit')return this.units.filter(t=>t.alive&&!t.isObstacle&&t!==u).map(t=>({col:t.col,row:t.row}));
    return[];
  }
  trySkillTarget(target){this.trySkillCell(target.col,target.row);}
  trySkillCell(col,row){const a=this.selectedAbility();if(!a)return;const valid=this.skillCells(this.active,a).some(p=>p.col===col&&p.row===row);if(!valid)return flashText(this,'Objetivo no válido.',640,120,0xffbd69);this.executeAbility(this.active,{col,row},a);}
  executeAbility(u,targetCell,a=this.selectedAbility(u)){
    if(!a)return;if(a.id==='bloodThirst'&&u.usedAbilitiesThisTurn?.includes(a.id))return flashText(this,'Sed de Sangre solo puede usarse una vez por turno.',640,120,0xffbd69);u.usedAbilitiesThisTurn?.push(a.id);this.lastAbilityByTeam[u.team]=a.id;
    const target=targetCell?this.unitAt(targetCell.col,targetCell.row):null;
    if(['runeLightningSpear','spitterSpawnBlood'].includes(a.id)){
      if(!target||target.team===u.team)return;this.breakStealth(u);if(a.id==='runeLightningSpear'){const d=Math.max(1,rollDie(5)+Math.floor(u.int/3)-Math.floor(target.df/4))+this.bonusDamage(u)+(this.teamHasRelic(u.team,'yellowKimolia')?2:0);this.dealDamage(u,target,d,'lightningFx',()=>{if(Math.random()<.05)this.addNegativeStatus(target,'paralyzed',1);this.payAbility(u,a);});}else{this.addNegativeStatus(target,'poison',5);flashText(this,'¡Envenenado!',target.sprite.x,target.sprite.y-78,0x83e36e);this.payAbility(u,a);}return;
    }
    if(a.id==='liquidArm'){const ts=this.skillCells(u,a).map(p=>this.unitAt(p.col,p.row)).filter(t=>t&&t.team!==u.team);if(!ts.length)return;this.breakStealth(u);ts.forEach(t=>this.applyInstantDamage(u,t,Math.max(1,rollDie(3)+Math.floor(u.str/4)-Math.floor(t.df/4))+this.bonusDamage(u),'liquidFx'));this.payAbility(u,a);return;}
    if(a.id==='devilBloodThorns'){this.addBuff(u,{id:'bloodThorns',remaining:2,str:2,df:2});this.spawnFx(u,'bloodFx');this.payAbility(u,a,1);return;}
    if(a.id==='runeFadingFire'){this.addBuff(u,{id:'fireDamage',remaining:2});this.payAbility(u,a);return;}
    if(a.id==='runeEarthWall'){if(target)return;const w=this.spawnUnit('wall',u.team,targetCell.col,targetCell.row,1,null,null,[],null,{isSummon:true,isObstacle:true,name:'Muro Terrestre',ownerId:u.id});w.maxHp=w.hp=20;w.df=0;this.drawUnit(w);this.payAbility(u,a);return;}
    if(a.id==='runeLightBlessing'){if(!target||target.team!==u.team)return;const heal=8+Math.floor(u.int/2);this.heal(target,heal);this.payAbility(u,a);return;}
    if(a.id==='runeResurrection'){const dead=this.units.find(t=>!t.alive&&t.team===u.team&&!t.isSummon&&t.col===targetCell.col&&t.row===targetCell.row);if(!dead||u.resurrectionUsed)return;u.resurrectionUsed=true;dead.alive=true;dead.hp=Math.max(1,Math.ceil(dead.maxHp*.35));let spot=this.unitAt(dead.col,dead.row);if(spot&&spot!==dead){const free=this.cells.find(c=>c.c<3&&!this.unitAt(c.c,c.r));if(free){dead.col=free.c;dead.row=free.r;}}const pos=this.cellCenter(dead.col,dead.row);[dead.sprite,dead.hpBack,dead.hpBar,dead.arrow].forEach(x=>x.setVisible(true).setAlpha(1));dead.sprite.setPosition(pos.x,pos.y);dead.hpBack.setPosition(pos.x,pos.y-48);dead.hpBar.setPosition(pos.x-37,pos.y-48);dead.arrow.setPosition(pos.x,pos.y+48);this.updateUnitHp(dead);this.buildTurnQueue();this.payAbility(u,a);return;}
    if(a.id==='runeStarRain'){const center=targetCell,near=this.cells.filter(c=>Math.abs(c.c-center.col)+Math.abs(c.r-center.row)<=2&&!(c.c===center.col&&c.r===center.row));Phaser.Utils.Array.Shuffle(near);const hits=[center,...near.slice(0,2)];hits.forEach(p=>{this.highlightCell(p.col,p.row,0xffd65b);const t=this.unitAt(p.col,p.row);if(t)this.applyInstantDamage(u,t,10,'magic');});this.payAbility(u,a);return;}
    if(a.id==='runeRaiseDead'){if(target)return;const z=this.spawnUnit('zombie',u.team,targetCell.col,targetCell.row,1,null,null,[],null,{isSummon:true,name:'Zombi',ownerId:u.id});this.drawUnit(z);this.buildTurnQueue();this.payAbility(u,a);return;}
    if(a.id==='miniaturize'){if(!u.buffs.some(b=>b.id==='miniaturized')){this.addBuff(u,{id:'miniaturized',remaining:3,str:-1,agi:2,stealth:10,scale:.5});u.sprite.setScale(.5);}this.payAbility(u,a);return;}
    if(a.id==='adaptiveResistance'){if(!u.buffs.some(b=>b.id==='adaptiveResistance'))u.buffs.push({id:'adaptiveResistance',remaining:999,justApplied:true});this.payAbility(u,a);return;}
    if(a.id==='wateryDodge'){if(!u.buffs.some(b=>b.id==='wateryDodge'))u.buffs.push({id:'wateryDodge',remaining:999,justApplied:true});this.payAbility(u,a);return;}
    if(a.id==='maximize'){if(!u.buffs.some(b=>b.id==='maximized')){this.addBuff(u,{id:'maximized',remaining:3,str:3,df:3,agi:-1,scale:1.25});u.sprite.setScale(1.25);}this.payAbility(u,a);return;}
    if(a.id==='perfectTransformation'){if(!target||target===u)return;const original={type:u.type,name:u.name,str:u.str,int:u.int,df:u.df,agi:u.agi,charisma:u.charisma,will:u.will,stealth:u.stealth,perception:u.perception,learnedAbilities:[...u.learnedAbilities]};u.type=target.type;u.name=target.name;for(const k of ['str','int','df','agi','charisma','will','stealth','perception'])u[k]=target[k];u.learnedAbilities=[...target.learnedAbilities];u.sprite.setTexture(target.type);u.buffs.push({id:'transformed',remaining:3,original,justApplied:true});this.payAbility(u,a);return;}
    if(a.id==='imperfectTransformation'){const enemy=u.team==='player'?'enemy':'player',copy=this.lastAbilityByTeam[enemy];if(!copy)return flashText(this,'El rival aún no ha usado una habilidad.',640,120,0xffbd69);u.copiedAbility=copy;u.buffs.push({id:'copiedAbility',remaining:1,justApplied:true});this.payAbility(u,a);return;}
    if(a.id==='jetBlackRipperBlood'){this.addBuff(u,{id:'stealth',remaining:2,agi:2});this.payAbility(u,a);return;}
    if(a.id==='bloodThirst'){if(u.hp<=5)return flashText(this,'No tienes suficiente HP.',640,120,0xff7777);u.hp-=5;u.ap+=3;u.str+=1;u.buffs.push({id:'bloodThirst',remaining:1,str:1,justApplied:true});this.updateUnitHp(u);this.payAbility(u,a);return;}
    if(a.id==='crimsonPact'){const cost=Math.max(1,Math.floor(u.hp*.25));u.hp=Math.max(1,u.hp-cost);this.updateUnitHp(u);this.addBuff(u,{id:'crimsonPact',remaining:3,str:5});this.payAbility(u,a);return;}
    if(a.id==='demonicHeart'){this.addBuff(u,{id:'lifesteal',remaining:3});this.payAbility(u,a);return;}
    if(a.id==='finalOffering'){const cost=Math.max(1,Math.floor(u.hp*.30));u.hp=Math.max(1,u.hp-cost);this.updateUnitHp(u);let kills=0;this.units.filter(t=>t.alive&&t.team!==u.team&&Math.abs(t.col-u.col)+Math.abs(t.row-u.row)===1).forEach(t=>{const was=t.alive;this.applyInstantDamage(u,t,12+u.str,'magic');if(was&&!t.alive)kills++;});if(kills)this.heal(u,kills*5);this.payAbility(u,a);return;}
  }
  addBuff(u,b){for(const k of ['str','df','agi','stealth'])if(b[k])u[k]+=b[k];u.buffs.push({...b,justApplied:true});}
  addNegativeStatus(u,id,duration){if(u.buffs.some(b=>b.id==='adaptiveResistance'))duration=Math.max(1,duration-3);if(id==='paralyzed')u.paralyzedTurns=Math.max(u.paralyzedTurns,duration);else u.buffs.push({id,remaining:duration,negative:true,justApplied:true});}
  applyTurnStartStatuses(u){const poison=u.buffs.find(b=>b.id==='poison');if(poison){this.applyInstantDamage(null,u,2,'magic');flashText(this,'Veneno -2',u.sprite.x,u.sprite.y-78,0x82db62);}}
  breakStealth(u){u.buffs=u.buffs.filter(b=>{if(b.id==='stealth'){u.agi-=b.agi||0;return false;}return true;});}
  payAbility(u,a,refund=0){u.ap=Math.max(0,u.ap-a.apCost+refund);u.mp=Math.max(0,u.mp-this.abilityMpCost(u,a));let cd=a.cooldown||0;if(this.teamHasRelic(u.team,'echoCrystal')&&!u.echoUsed){cd=Math.floor(cd/2);u.echoUsed=true;}u.cooldowns[a.id]=cd;this.afterAction();this.checkEnd();}
  afterAction(){this.action='none';this.clearHighlights();this.updateHud();this.updateButtons();}
  dealDamage(attacker,target,damage,fx,done){if(target.buffs.some(b=>b.id==='wateryDodge')){target.buffs=target.buffs.filter(b=>b.id!=='wateryDodge');flashText(this,'¡Esquiva Acuosa!',target.sprite.x,target.sprite.y-70,0x72d9ff);done?.();return;}this.playHit(attacker,target,damage,fx,()=>{this.afterDamage(attacker,target,damage);done?.();});}
  applyInstantDamage(attacker,target,damage,fx){if(target.buffs.some(b=>b.id==='wateryDodge')){target.buffs=target.buffs.filter(b=>b.id!=='wateryDodge');return;}target.hp-=damage;this.damageSerial++;this.spawnFx(target,fx);floatNumber(this,`-${damage}`,target.sprite.x,target.sprite.y-62,0xff626f);this.updateUnitHp(target);if(target.hp<=0)this.killUnit(target);this.afterDamage(attacker,target,damage);}
  afterDamage(attacker,target,damage){if(attacker?.buffs?.some(b=>b.id==='lifesteal'))this.heal(attacker,Math.max(1,Math.floor(damage*.5)));this.checkBerserker(target);}
  heal(u,amount){const actual=Math.min(amount,u.maxHp-u.hp);u.hp+=actual;this.spawnFx(u,'heal');floatNumber(this,`+${actual}`,u.sprite.x,u.sprite.y-62,0x71ef91);this.updateUnitHp(u);}
  playHit(attacker,target,damage,fxKey,done){if(!attacker)return this.applyInstantDamage(null,target,damage,fxKey);const dir=attacker.team==='player'?1:-1,ox=attacker.sprite.x;this.tweens.add({targets:attacker.sprite,x:ox+dir*22,duration:90,yoyo:true,onComplete:()=>{target.hp-=damage;this.damageSerial++;this.spawnFx(target,fxKey);floatNumber(this,`-${damage}`,target.sprite.x,target.sprite.y-62,0xff626f);this.updateUnitHp(target);if(target.hp<=0)this.killUnit(target);done?.();}});}
  spawnFx(target,key){const fx=this.add.image(target.sprite.x,target.sprite.y,key).setDisplaySize(110,110).setAlpha(.95);this.tweens.add({targets:fx,alpha:0,scale:1.4,duration:300,onComplete:()=>fx.destroy()});}
  validMoves(u){return[[u.col+1,u.row],[u.col-1,u.row],[u.col,u.row+1],[u.col,u.row-1]].filter(([c,r])=>c>=0&&c<GAME.cols&&r>=0&&r<GAME.rows&&!this.unitAt(c,r)).map(([col,row])=>({col,row}));}
  frontTarget(u){return this.unitAt(u.col+(u.team==='player'?1:-1),u.row);}
  moveUnit(u,col,row,done){u.col=col;u.row=row;const{x,y}=this.cellCenter(col,row);this.tweens.add({targets:[u.sprite,u.hpBack,u.hpBar,u.arrow],x:{value:x},duration:220,onUpdate:()=>{u.hpBack.x=u.sprite.x;u.hpBar.x=u.sprite.x-37;u.arrow.x=u.sprite.x;},onComplete:()=>{u.sprite.y=y;u.hpBack.y=y-48;u.hpBar.y=y-48;u.arrow.y=y+48;done?.();}});}
  endTurn(){if(this.battleOver||!this.active)return;if(this.active.paralyzedTurns>0)this.active.paralyzedTurns--;this.tickBuffs(this.active);this.handleStalemateTurn(this.active);this.action='none';this.clearHighlights();this.queueIndex++;this.time.delayedCall(180,()=>this.beginTurn());}
  tickBuffs(u){
    u.buffs.forEach(b=>{if(b.justApplied)b.justApplied=false;else b.remaining--;});
    const expired=u.buffs.filter(b=>b.remaining<=0);
    expired.forEach(b=>{for(const k of ['str','df','agi','stealth'])if(b[k])u[k]-=b[k];if(b.scale)u.sprite.setScale(1);if(b.id==='transformed'&&b.original){Object.assign(u,b.original);u.learnedAbilities=[...b.original.learnedAbilities];u.sprite.setTexture(u.type);}if(b.id==='copiedAbility')u.copiedAbility=null;});
    u.buffs=u.buffs.filter(b=>b.remaining>0);
  }
  toggleAutoBattle(){if(this.battleOver)return;this.autoBattle=!this.autoBattle;this.autoLabel.setText(`AUTO-BATTLE: ${this.autoBattle?'SÍ':'NO'}`);this.autoButton.setFillStyle(this.autoBattle?0x285f3c:0x241a31,.96);if(this.autoBattle&&this.active?.team==='player')this.time.delayedCall(150,()=>this.runAIControlled(this.active));}
  runAIControlled(u){if(!u?.alive||this.battleOver||u!==this.active)return;const enemyTeam=u.team==='player'?'enemy':'player';let safety=0;const loop=()=>{if(this.battleOver||u!==this.active||!u.alive)return;if(u.ap<=0||safety++>8)return this.endTurn();const front=this.frontTarget(u);if(front&&front.team===enemyTeam&&u.ap>=2){const estimate=Math.max(1,2+Math.floor(u.str/2)-Math.floor(front.df/3));if(front.hp<=estimate||!this.bestAbilityAction(u,enemyTeam))return this.basicAttack(u,front,()=>{u.ap-=2;this.updateHud();if(!this.checkEnd())this.time.delayedCall(150,loop);});}
      const action=this.bestAbilityAction(u,enemyTeam);if(action){this.selectedSkillIndex=this.abilitiesFor(u).findIndex(a=>a.id===action.ability.id);this.executeAbility(u,action.cell,action.ability);return this.time.delayedCall(180,loop);}
      if(front&&front.team===enemyTeam&&u.ap>=2)return this.basicAttack(u,front,()=>{u.ap-=2;this.updateHud();if(!this.checkEnd())this.time.delayedCall(150,loop);});
      const targets=this.units.filter(q=>q.alive&&q.team===enemyTeam&&!q.isObstacle&&!q.buffs.some(b=>b.id==='stealth'&&Math.abs(q.col-u.col)+Math.abs(q.row-u.row)>1));const moves=this.validMoves(u);if(u.ap>=1&&moves.length&&targets.length){const current=Math.min(...targets.map(t=>Math.abs(t.col-u.col)+Math.abs(t.row-u.row)));const scored=moves.map(m=>{const dist=Math.min(...targets.map(t=>Math.abs(t.col-m.col)+Math.abs(t.row-m.row)));const frontAfter=targets.some(t=>t.row===m.row&&t.col===m.col+(u.team==='player'?1:-1));return{m,score:(current-dist)*20+(frontAfter?80:0)-Math.abs(m.row-u.row)};}).sort((a,b)=>b.score-a.score);if(scored[0]?.score>0)return this.moveUnit(u,scored[0].m.col,scored[0].m.row,()=>{u.ap--;this.updateHud();this.time.delayedCall(150,loop);});}this.endTurn();};loop();}
  bestAbilityAction(u,enemyTeam){const abilities=this.abilitiesFor(u).filter(a=>u.ap>=a.apCost&&u.mp>=this.abilityMpCost(u,a)&&this.abilityCooldown(u,a)<=0&&!u.usedAbilitiesThisTurn?.includes(a.id));let best=null;for(const a of abilities){const cells=this.skillCells(u,a);let candidates=[];if(a.targetMode==='self')candidates=[null];else candidates=cells;for(const cell of candidates){const t=cell?this.unitAt(cell.col,cell.row):u;let score=0;if(a.targetMode==='frontEmpty'){if(!cell)continue;score=a.id==='runeEarthWall'?15:35;}else if(a.targetMode==='ally'){if(!t||t.team!==u.team||t.hp>=t.maxHp)continue;score=70+(1-t.hp/t.maxHp)*80;}else if(a.targetMode==='self'){if(['bloodThirst','crimsonPact'].includes(a.id)&&u.hp<=6)continue;if(['miniaturize','maximize','devilBloodThorns','jetBlackRipperBlood','demonicHeart','runeFadingFire'].includes(a.id)&&u.buffs.some(b=>b.id===({miniaturize:'miniaturized',maximize:'maximized',devilBloodThorns:'bloodThorns',jetBlackRipperBlood:'stealth',demonicHeart:'lifesteal',runeFadingFire:'fireDamage'}[a.id])))continue;score=35;}else if(a.targetMode==='cell'){score=30;}else{if(!t||t.team!==enemyTeam)continue;score=85+(t.hp<=10?100:0);}if(!best||score>best.score)best={ability:a,cell,score};}}return best;}
  aiUseAbility(){return false;}
  setHudVisible(visible){this.hudObjects?.forEach(o=>o.setVisible(visible));}
  abilityMpCost(u,a){return Math.max(0,a.mpCost-(this.teamHasRelic(u.team,'magicCore')?2:0));}
  abilityCooldown(u,a){return u.cooldowns?.[a.id]||0;}
  teamHasRelic(team,id){return team==='player'?hasRelic(SAVE,id):this.enemyRelics.includes(id);}
  updateHud(){if(!this.active)return;const portrait=this.active.type==='zombie'?'zombiePortrait':CLASSES[this.active.type]?.portrait||'zombiePortrait';this.portrait.setTexture(portrait);this.nameText.setText(`${this.active.name} · Nv. ${this.active.level}`);this.resourceText.setText(`HP ${Math.max(0,this.active.hp)}/${this.active.maxHp}     MP ${this.active.mp}/${this.active.maxMp}     AP ${this.active.ap}/${this.active.maxAp}`);const arr=this.abilitiesFor(this.active);this.buttons.skills.forEach((b,i)=>{const a=arr[i],cd=a?this.abilityCooldown(this.active,a):0;b.icon.setTexture(a?.icon||'skill');b.txt.setText(a?`${a.rarity} · ${a.name}`:`SKILL ${i+1}`);b.ct.setText(a?`${a.apCost} AP · ${this.abilityMpCost(this.active,a)} MP${cd?` · CD ${cd}`:''}`:'Bloqueada');});}
  updateButtons(){
    const can=this.active?.team==='player'&&!this.autoBattle;
    [this.buttons.move,this.buttons.attack,this.buttons.end,...this.buttons.skills].forEach(b=>{b.bg.setAlpha(can?1:.35);b.icon.setAlpha(can?1:.35);b.icon.clearTint();});
    if(!can)return;
    if(this.active.ap<1)this.buttons.move.icon.setTint(0xff5555);
    if(this.active.ap<2)this.buttons.attack.icon.setTint(0xff5555);
    const arr=this.abilitiesFor(this.active);
    this.buttons.skills.forEach((b,i)=>{const a=arr[i];if(!a)b.icon.setTint(0x222222);else if(this.active.ap<a.apCost||this.active.mp<this.abilityMpCost(this.active,a))b.icon.setTint(0xff5555);else if(this.abilityCooldown(this.active,a)>0)b.icon.setTint(0x5599ff);});
  }

  checkBerserker(u){if(!u?.alive||u.berserkerActive||u.hp/u.maxHp>.25||!this.teamHasRelic(u.team,'berserkerSoul'))return;u.berserkerActive=true;u.str+=3;u.agi+=2;flashText(this,'¡Alma Berserker!',u.sprite.x,u.sprite.y-82,0xff8a62);}
  handleStalemateTurn(u){if(this.damageSerial===u.damageAtTurnStart)this.noDamageTurns++;else this.noDamageTurns=0;if(this.noDamageTurns<5)return;this.noDamageTurns=0;this.stalemateResets++;if(this.stalemateResets<=2){flashText(this,`Reposicionamiento anti-bloqueo ${this.stalemateResets}/2`,640,125,0xffdf76);this.repositionTeams();}else this.resolveByHp();}
  repositionTeams(){for(const team of ['player','enemy']){const units=this.units.filter(u=>u.alive&&u.team===team&&!u.isObstacle);const cols=team==='player'?[0,1,2]:[5,4,3];const slots=[];for(const c of cols)for(let r=0;r<3;r++)slots.push({col:c,row:r});units.forEach((u,i)=>{const spot=slots.find(p=>!this.unitAt(p.col,p.row)||this.unitAt(p.col,p.row)===u);if(spot)this.moveUnit(u,spot.col,spot.row);});}}
  resolveByHp(){const hp=team=>this.units.filter(u=>u.alive&&u.team===team&&!u.isObstacle).reduce((n,u)=>n+Math.max(0,u.hp),0);const p=hp('player'),e=hp('enemy');this.battleOver=true;flashText(this,`Desempate por HP: ${p} - ${e}`,640,150,0xffe596);this.time.delayedCall(700,()=>p>=e?this.showVictory():this.showDefeat());}
  showStats(u){
    this.statsContainer?.destroy(true);const cls=CLASSES[u.type],c=this.add.container(790,24).setDepth(40);this.statsContainer=c;const panel=this.add.rectangle(0,0,470,690,0x100b18,.98).setOrigin(0).setStrokeStyle(3,u.team==='player'?0x48d47a:0xe7505d);const title=this.add.text(20,17,u.name,{fontSize:'22px',fontStyle:'bold',color:'#fff'});const subtitle=this.add.text(20,54,`Nivel ${u.level} · ${u.team==='player'?'Aliado':'Enemigo'}`,{fontSize:'16px',color:'#d8ccdf'});const close=this.add.text(420,12,'✕',{fontSize:'30px',color:'#fff'}).setInteractive({useHandCursor:true}).on('pointerdown',()=>{c.destroy(true);this.statsContainer=null;});const portraitKey=u.type==='zombie'?'zombiePortrait':cls?.portrait||'zombiePortrait';const portrait=this.add.image(91,159,portraitKey).setDisplaySize(120,120);const combat=this.add.text(175,101,[`HP ${Math.max(0,u.hp)}/${u.maxHp}`,`MP ${u.mp}/${u.maxMp}`,`AP ${u.ap}/${u.maxAp}`,`DF ${u.df}`,`FUE ${u.str}`,`INT ${u.int}`,`AGI ${u.agi}`].join('\n'),{fontSize:'16px',color:'#eee6f4',lineSpacing:5});c.add([panel,title,subtitle,close,portrait,combat]);
    let statsY=300;if(u.blessing){const bd=BLESSINGS[u.blessing],bi=this.add.image(80,340,bd.texture).setDisplaySize(90,90),bn=this.add.text(145,312,`${u.blessing}\n+${u.blessingBonus} ${bd.statLabel}`,{fontSize:'18px',fontStyle:'bold',color:'#fff',lineSpacing:5});c.add([bi,bn]);statsY=430;}
    const stats=this.add.text(20,statsY,[`Constitución: ${u.constitution}     Energía: ${u.energy}`,`Carisma: ${u.charisma}             Voluntad: ${u.will}`,`Sigilo: ${u.stealth}%              Percepción: ${u.perception}`].join('\n'),{fontSize:'15px',color:'#d1c5dc',lineSpacing:18});c.add(stats);
    const statuses=[...(u.paralyzedTurns>0?[{id:'paralyzed',remaining:u.paralyzedTurns}]:[]),...u.buffs.filter(b=>STATUS_TEXTURES[b.id])];const sy=statsY+125;const stitle=this.add.text(20,sy,'ESTADOS ACTIVOS',{fontSize:'14px',fontStyle:'bold',color:'#ffe69a'});c.add(stitle);if(!statuses.length)c.add(this.add.text(20,sy+30,'Ninguno',{fontSize:'14px',color:'#aaa0b1'}));statuses.slice(0,8).forEach((s,i)=>{const x=48+(i%4)*105,y=sy+62+Math.floor(i/4)*65;c.add(this.add.image(x,y,STATUS_TEXTURES[s.id]).setDisplaySize(42,42));c.add(this.add.text(x+27,y-12,`${s.remaining>=900?'∞':s.remaining}t`,{fontSize:'11px',color:'#fff'}));});
  }
  updateUnitHp(u){const ratio=Phaser.Math.Clamp(u.hp/u.maxHp,0,1);u.hpBar.width=74*ratio;u.hpBar.fillColor=ratio>.5?0x42d36e:ratio>.25?0xf3bf4d:0xe54452;}
  killUnit(u){
    if(!u.alive)return;
    u.alive=false;
    this.units.filter(s=>s.alive&&s.isSummon&&s.ownerId===u.id&&!s.persistentSummon).forEach(s=>this.killUnit(s));
    const wallace=this.teamHasRelic(u.team,'wallacePatch')&&!u.isSummon&&!u.isObstacle;
    const spawnCell={col:u.col,row:u.row};
    this.tweens.add({targets:[u.sprite,u.hpBack,u.hpBar,u.arrow],alpha:0,y:u.sprite.y+25,duration:300,onComplete:()=>{
      [u.sprite,u.hpBack,u.hpBar,u.arrow].forEach(x=>x.setVisible(false));
      if(wallace&&!this.unitAt(spawnCell.col,spawnCell.row)){
        const z=this.spawnUnit('zombie',u.team,spawnCell.col,spawnCell.row,1,null,null,[],null,{isSummon:true,persistentSummon:true,name:'Zombi de Wallace'});
        this.drawUnit(z);this.buildTurnQueue();
      }
      this.refreshTurnOrder();
    }});
  }
  clearHighlights(){this.cells.forEach(c=>c.rect.setFillStyle(c.c<3?0x286946:0x7b303a,.30));}
  highlightCell(col,row,color){this.cells.find(c=>c.c===col&&c.r===row)?.rect.setFillStyle(color,.68);}
  cellCenter(col,row){return{x:GAME.gridX+col*GAME.tile+GAME.tile/2,y:GAME.gridY+row*GAME.tile+GAME.tile/2};}
  unitAt(col,row){return this.units.find(u=>u.alive&&u.col===col&&u.row===row);}
  checkEnd(){const players=this.units.some(u=>u.alive&&u.team==='player'&&!u.isSummon),enemies=this.units.some(u=>u.alive&&u.team==='enemy'&&!u.isSummon);if(players&&enemies)return false;this.battleOver=true;this.clearHighlights();this.time.delayedCall(450,()=>players?this.showVictory():this.showDefeat());return true;}
  showVictory(){this.add.rectangle(640,360,1280,720,0x07040b,.84).setDepth(50);this.add.rectangle(640,360,700,440,0x171020,.99).setStrokeStyle(4,0x66e38e).setDepth(51);this.add.text(640,195,'¡VICTORIA!',{fontSize:'44px',fontStyle:'bold',color:'#79ee9c'}).setOrigin(.5).setDepth(52);const completed=SAVE.round,xp=BALANCE.xpBase+completed*BALANCE.xpPerRound,results=awardGlobalXp(xp),leveled=results.filter(x=>x.leveled);this.add.text(640,258,`Ronda ${completed} superada`,{fontSize:'22px',fontStyle:'bold',color:'#fff'}).setOrigin(.5).setDepth(52);this.add.text(640,305,`+${results[0]?.awardedXp??xp} XP global para toda la plantilla`,{fontSize:'19px',color:'#ffe596'}).setOrigin(.5).setDepth(52);const lines=leveled.length?leveled.map(x=>`${x.name}: Nv. ${x.previousLevel} → ${x.newLevel}${x.learned.length?' · Nueva habilidad':''}`).join('\n'):'Nadie ha subido de nivel todavía.';this.add.text(640,370,lines,{fontSize:'16px',color:'#ddd4e5',align:'center',lineSpacing:7,wordWrap:{width:570}}).setOrigin(.5).setDepth(52);const reward=completed%BALANCE.rewardEveryRounds===0;makeButton(this,640,510,340,66,reward?'VER RECOMPENSA':'SIGUIENTE RONDA',()=>{SAVE.round++;const next=reward?'Reward':'Placement';this.scene.start(SAVE.pendingSkillChoices.length?'SkillChoice':next,{nextScene:next});}).setDepth(52);}
  showDefeat(){this.add.rectangle(640,360,1280,720,0x07040b,.84).setDepth(50);this.add.rectangle(640,360,600,350,0x171020,.98).setStrokeStyle(4,0xe2505d).setDepth(51);this.add.text(640,250,'DERROTA',{fontSize:'48px',fontStyle:'bold',color:'#ff6571'}).setOrigin(.5).setDepth(52);this.add.text(640,335,`Has alcanzado la ronda ${SAVE.round}.\nLa run ha terminado y todo el progreso se reiniciará.`,{fontSize:'20px',color:'#eee5f2',align:'center'}).setOrigin(.5).setDepth(52);makeButton(this,640,454,300,64,'VOLVER AL MENÚ',()=>{resetRun();this.scene.start('Menu');}).setDepth(52);}
}
