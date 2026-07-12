import { GAME, BALANCE } from '../config.js';
import { CLASSES } from '../data/classes.js';
import { ABILITIES } from '../data/abilities.js';
import { BLESSINGS, blessingBonusForCount } from '../data/blessings.js';
import { SAVE, completeCurrentNode, loseLife, finishRun, saveRun, advanceAfterBoss } from '../data/save.js';
import { calculateStats, earlyEnemyScaling, awardGlobalXp } from '../systems/progression.js';
import { rollDie } from '../utils/dice.js';
import { makeButton, flashText, floatNumber } from '../utils/helpers.js';
import { hasRelic } from '../data/relics.js';
import { SUMMONS } from '../data/summons.js';
import { ENEMIES } from '../data/enemies.js';
import { GameLog } from '../systems/gameLog.js';
import { executeAbilityEffect } from '../systems/abilityEffects.js';
import { bestAbilityAction as chooseAbilityAction, bestMove as chooseMove } from '../systems/aiController.js';
import { calculateDifficulty } from '../systems/difficulty.js';

const STALEMATE_TURN_LIMIT=15;

const STATUS_TEXTURES={
  paralyzed:'paralyzed',immobilized:'immobilized',bleeding:'bleeding',bloodThorns:'strengthUp',fireDamage:'fireDamageUp',adaptiveResistance:'adaptiveResistanceStatus',wateryDodge:'wateryDodgeStatus',miniaturized:'miniaturized',maximized:'maximized',transformed:'transformed',stealth:'stealth',poison:'poisoned',bloodThirst:'bloodThirstStatus',crimsonPact:'crimsonPactStatus',lifesteal:'lifesteal',enemyFrenzy:'enemyFrenzy',enemyMutation:'enemyMutation',regeneration:'regeneration'
};

export class BattleScene extends Phaser.Scene{
  constructor(){super('Battle');}
  init(data){this.startPositions=data.positions;this.enemyPositions=data.enemyPositions||[];this.enemyRelics=data.enemyRelics||SAVE.enemyRelics||[];}
  textureForUnit(u){return u?.isObstacle?'earthWall':(u?.textureKey||ENEMIES[u?.type]?.texture||u?.type||'placeholder');}
  create(){
    const {width:W,height:H,tile:T,cols,rows,gridX}=GAME;
    const gridY=GAME.gridY;
    this.gridY=gridY;
    this.add.image(W/2,H/2,'battleBg').setDisplaySize(W,H);this.add.rectangle(W/2,H/2,W,H,0x08050d,.17);
    this.add.text(26,18,`MAPA ${SAVE.mapNumber} · COMBATE ${SAVE.visitedNodes.length+1}`,{fontSize:'27px',fontStyle:'bold',color:'#fff'});
    this.infoText=this.add.text(W/2,24,'',{fontSize:'19px',fontStyle:'bold',color:'#fff',stroke:'#130d1b',strokeThickness:4}).setOrigin(.5);
    this.cells=[];
    for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
      const x=gridX+c*T+T/2,y=gridY+r*T+T/2;
      const playerZone=c<GAME.deploymentSize&&r>=3&&r<3+GAME.deploymentSize;
      const enemyZone=c>=cols-GAME.deploymentSize&&r>=3&&r<3+GAME.deploymentSize;
      const baseColor=playerZone?0x286946:enemyZone?0x7b303a:0x272030;
      const rect=this.add.rectangle(x,y,T-3,T-3,baseColor,playerZone||enemyZone?0.30:0.22).setStrokeStyle(playerZone||enemyZone?2:1,playerZone?0x8cecad:enemyZone?0xff9aa3:0x756b82,.67).setInteractive({useHandCursor:true}).on('pointerdown',()=>this.onCell(c,r));
      this.cells.push({c,r,x,y,rect,baseColor});
    }
    this.units=[];this.nextId=1;this.log=new GameLog(`battle-round-${SAVE.round}`);globalThis.ARGA_DEBUG={...(globalThis.ARGA_DEBUG||{}),battleLog:this.log};this.log.add('battle_start','Comienza el combate',{round:SAVE.round,players:this.startPositions,enemies:this.enemyPositions,enemyRelics:this.enemyRelics});this.lastAbilityByTeam={player:null,enemy:null};this.damageSerial=0;this.lastStalemateDamageSerial=0;this.noDamageTurns=0;this.stalemateResets=0;
    this.startPositions.forEach(p=>this.spawnUnit(p.type,'player',p.col,p.row,p.level||1,p.recruitId,null,p.learnedAbilities,p.blessing,{name:p.name}));
    const node=SAVE.generatedMap?.nodes?.find(n=>n.id===SAVE.pendingNodeId);
    const difficulty=calculateDifficulty(SAVE,node),baseScale=earlyEnemyScaling(SAVE.round),extra=Math.max(0,difficulty.score-1);
    const scale={hp:baseScale.hp*(1+extra*.10),combat:baseScale.combat*(1+extra*.065)};
    this.enemyPositions.forEach(p=>this.spawnUnit(p.type,'enemy',p.col,p.row,Math.min(10,p.level||1),null,scale,p.learnedAbilities,p.blessing,{aiProfile:p.aiProfile,name:p.name}));
    this.applyBlessings();this.units.forEach(u=>this.drawUnit(u));
    this.action='none';this.active=null;this.selectedSkillIndex=0;this.turnQueue=[];this.queueIndex=0;this.battleOver=false;this.autoBattle=false;this.actionLocked=false;
    this.createHud();this.buildTurnQueue();this.beginTurn();
  }
  spawnUnit(type,team,col,row,level=1,recruitId=null,scale=null,learnedAbilities=[],blessing=null,options={}){
    let stats;
    if(SUMMONS[type]){
      const summonDef=SUMMONS[type],progress=Math.max(0,Math.min(1,(level-1)/(GAME.maxLevel-1)));
      stats={...summonDef.baseStats};
      for(const [key,growth] of Object.entries(summonDef.growth||{}))if(Number.isFinite(stats[key]))stats[key]+=Math.floor(growth*progress);
      stats.maxHp=Math.max(stats.maxHp,stats.constitution*5);
      stats.maxMp=Math.max(stats.maxMp,stats.energy*5);
    }
    else if(ENEMIES[type]?.type==='exclusive'){
      const e=ENEMIES[type],progress=Math.max(0,Math.min(1,(level-1)/(GAME.maxLevel-1)));
      stats={...e.baseStats};
      for(const [key,growth] of Object.entries(e.growth||{}))if(Number.isFinite(stats[key]))stats[key]+=Math.floor(growth*progress);
      stats.maxHp=Math.max(stats.maxHp,stats.constitution*5);
      stats.maxMp=Math.max(stats.maxMp,stats.energy*5);
    }
    else stats=calculateStats(type,level);
    if(team==='enemy'&&scale&&!options.isSummon){stats.maxHp=Math.max(5,Math.round(stats.maxHp*scale.hp));for(const key of ['df','str','int','agi','charisma','will','perception'])stats[key]=Math.max(1,Math.round(stats[key]*scale.combat));}
    const cls=CLASSES[type],enemyDef=ENEMIES[type];
    const known=[...(learnedAbilities||[])];
    if(cls&&team==='enemy'){
      const available=()=>cls.abilityPool.filter(id=>!known.includes(id));
      if(level>=5&&known.length<2&&available().length)known.push(Phaser.Utils.Array.GetRandom(available()));
      if(level>=10&&known.length<3&&available().length)known.push(Phaser.Utils.Array.GetRandom(available()));
    }
    const u={id:this.nextId++,recruitId,type,team,col,row,level,name:options.name||cls?.name||enemyDef?.name||SUMMONS[type]?.name||'Unidad',aiProfile:options.aiProfile||enemyDef?.aiProfile||SUMMONS[type]?.aiProfile||(team==='enemy'?({rune:'balanced',formless:'flanker',demon:'aggressive'}[type]||'balanced'):'balanced'),blessing:blessing||cls?.defaultBlessing||null,...stats,hp:stats.maxHp,mp:stats.maxMp,ap:GAME.apPerTurn,maxAp:GAME.apPerTurn,alive:true,learnedAbilities:known,buffs:[],paralyzedTurns:0,turnsTaken:0,blessingBonus:0,isSummon:!!options.isSummon,isObstacle:!!options.isObstacle,resurrectionUsed:false,copiedAbility:null,ownerId:options.ownerId??null,persistentSummon:!!options.persistentSummon,cooldowns:{},echoUsed:false,berserkerActive:false,resistances:{...(enemyDef?.resistances||{})},enemyReward:enemyDef?.reward||null,size:enemyDef?.size||1,textureKey:options.texture||enemyDef?.texture||(type==='enemy_zombie'?'zombie':type)};
    this.units.push(u);return u;
  }
  drawUnit(u){
    const {x,y}=this.cellCenter(u.col,u.row);
    const texture=this.textureForUnit(u);
    u.sprite=this.add.image(x,y,texture)
      .setDisplaySize(u.isObstacle?46:(u.size>1?48:42),u.isObstacle?46:(u.size>1?48:42))
      .setFlipX(u.team==='enemy'&&!u.isObstacle)
      .setDepth(8)
      .setInteractive({useHandCursor:true});
    u.sprite.on('pointerdown',()=>{
      if(this.battleOver)return;
      if(this.active?.team==='player'&&!this.autoBattle&&(this.action==='attack'||this.action==='skill')){
        this.onCell(u.col,u.row);
        return;
      }
      this.showStats(u);
    });
    u.hpBack=this.add.rectangle(x,y-27,42,6,0x281c2e,.95).setOrigin(.5).setDepth(9);
    u.hpBar=this.add.rectangle(x-20,y-27,40,4,0x42d36e,1).setOrigin(0,.5).setDepth(10);
    u.arrow=this.add.image(x,y+27,'arrow').setDisplaySize(16,16).setDepth(9).setFlipX(u.team==='enemy').setVisible(!u.isObstacle);
    if(u.isObstacle){
      u.arrow.setVisible(false);
      u.sprite.removeInteractive();
    }
    this.updateUnitHp(u);
  }
  applyBlessings(){for(const team of ['player','enemy']){const list=this.units.filter(u=>u.team===team&&!u.isSummon&&u.blessing),counts={};list.forEach(u=>counts[u.blessing]=(counts[u.blessing]||0)+1);const resonant=team==='player'?hasRelic(SAVE,'resonantStone'):this.enemyRelics.includes('resonantStone');list.forEach(u=>{const b=BLESSINGS[u.blessing];if(!b)return;const count=(counts[u.blessing]||1)+(resonant?1:0);const bonus=blessingBonusForCount(count);u[b.stat]+=bonus;u.blessingBonus=bonus;});}}
  createHud(){
    this.hudBg=this.add.rectangle(640,635,1235,165,0x120d1b,.97).setStrokeStyle(3,0x786589);
    this.portrait=this.add.image(92,635,'runePortrait').setDisplaySize(96,96);
    this.nameText=this.add.text(155,568,'',{fontSize:'20px',fontStyle:'bold',color:'#fff',wordWrap:{width:390}});
    this.resourceText=this.add.text(155,600,'',{fontSize:'16px',color:'#eee6f4'});
    this.actionInfo=this.add.text(155,630,'Selecciona una acción.',{fontSize:'12px',color:'#cfc4d8',wordWrap:{width:415},lineSpacing:2,maxLines:6});
    this.buttons={move:this.actionButton(640,635,'move','MOVER','1 AP',()=>this.selectAction('move')),attack:this.actionButton(735,635,'attack','ATACAR','2 AP',()=>this.selectAction('attack')),skills:[],end:this.actionButton(1125,635,'end','TERMINAR','Turno',()=>{if(!this.autoBattle)this.endTurn();})};
    [830,925,1020].forEach((x,i)=>this.buttons.skills.push(this.actionButton(x,635,'skill',`SKILL ${i+1}`,'Bloqueada',()=>this.selectSkill(i))));
    this.hudObjects=[this.hudBg,this.portrait,this.nameText,this.resourceText,this.actionInfo];Object.values(this.buttons).flatMap(v=>Array.isArray(v)?v:[v]).flat().forEach(b=>{if(b?.bg)this.hudObjects.push(b.bg,b.icon,b.txt,b.ct);});
    this.turnPanel=this.add.container(12,68);this.statsContainer=null;
    this.autoButton=this.add.rectangle(1168,42,184,48,0x241a31,.96).setStrokeStyle(2,0xb896d1).setInteractive({useHandCursor:true});this.autoLabel=this.add.text(1168,42,'AUTO-BATTLE: NO',{fontSize:'15px',fontStyle:'bold',color:'#fff'}).setOrigin(.5);this.autoButton.on('pointerdown',()=>this.toggleAutoBattle());
    const relicBtn=makeButton(this,1010,42,120,42,'RELIQUIAS',()=>{this.scene.pause();this.scene.launch('Relics',{returnScene:'Battle'});});this.relicButton=relicBtn;
  }
  actionButton(x,y,tex,label,cost,cb){const bg=this.add.rectangle(x,y,84,110,0x261b33,.97).setStrokeStyle(2,0x917aa9).setInteractive({useHandCursor:true}).on('pointerdown',cb);const icon=this.add.image(x,y-20,tex).setDisplaySize(52,52);const txt=this.add.text(x,y+24,label,{fontSize:'10px',fontStyle:'bold',color:'#fff',align:'center',wordWrap:{width:78}}).setOrigin(.5);const ct=this.add.text(x,y+47,cost,{fontSize:'10px',color:'#d1c5dd',align:'center',wordWrap:{width:78}}).setOrigin(.5);return{bg,icon,txt,ct};}
  buildTurnQueue(){this.turnQueue=this.units.filter(u=>u.alive&&!u.isObstacle).sort((a,b)=>b.agi-a.agi||(a.team==='player'?-1:1));this.queueIndex=0;this.refreshTurnOrder();}
  refreshTurnOrder(){this.turnPanel.removeAll(true);this.turnQueue.filter(u=>u.alive).forEach((u,i)=>{const y=i*62,active=u===this.active;const aura=this.add.circle(48,y+30,active?29:25,u.team==='player'?0x32d46f:0xe34754,active?1:.65);const img=this.add.image(48,y+30,this.textureForUnit(u)).setDisplaySize(active?51:44,active?51:44).setFlipX(u.team==='enemy');const hp=this.add.text(78,y+22,`${Math.max(0,u.hp)}/${u.maxHp}`,{fontSize:'11px',color:'#fff'});this.turnPanel.add([aura,img,hp]);});}
  beginTurn(){
    if(this.battleOver)return;this.clearHighlights();this.action='none';while(this.queueIndex<this.turnQueue.length&&!this.turnQueue[this.queueIndex].alive)this.queueIndex++;if(this.queueIndex>=this.turnQueue.length)this.buildTurnQueue();this.active=this.turnQueue[this.queueIndex];if(!this.active)return;
    this.active.ap=this.active.maxAp;this.active.turnsTaken++;this.active.usedAbilitiesThisTurn=[];this.abilitiesFor(this.active).forEach(a=>delete a._aiBlocked);this.selectedSkillIndex=0;this.active.damageAtTurnStart=this.damageSerial;
    Object.keys(this.active.cooldowns||{}).forEach(id=>{if(this.active.cooldowns[id]>0)this.active.cooldowns[id]--;});
    if(this.active.turnsTaken%BALANCE.mpRegenEveryTurns===0&&this.active.mp<this.active.maxMp){const restored=Math.max(1,Math.ceil(this.active.maxMp*BALANCE.mpRegenPercent)),actual=Math.min(restored,this.active.maxMp-this.active.mp);this.active.mp+=actual;flashText(this,`+${actual} MP`,this.active.sprite.x,this.active.sprite.y-78,0x71bfff);}
    this.applyTurnStartStatuses(this.active);this.updateHud();this.refreshTurnOrder();
    if(this.checkEnd())return;
    if(!this.active.alive)return this.endTurn();
    if(this.active.paralyzedTurns>0){flashText(this,`${this.active.name} está paralizado.`,640,110,0x91c9ff);this.time.delayedCall(700,()=>this.endTurn());return;}
    if(this.active.team==='enemy'||this.autoBattle){this.setHudVisible(this.active.team!=='enemy');this.infoText.setText(`${this.active.team==='enemy'?'Turno enemigo':'Auto-battle'}: ${this.active.name}`);this.time.delayedCall(350,()=>this.runAIControlled(this.active));}else{this.setHudVisible(true);this.infoText.setText(`Tu turno: ${this.active.name}`);this.updateButtons();}
  }
  abilitiesFor(u){const ids=[...(u.learnedAbilities||[])];if(u.copiedAbility&&!ids.includes(u.copiedAbility))ids.push(u.copiedAbility);return ids.slice(0,3).map(id=>ABILITIES[id]).filter(Boolean);}
  selectedAbility(u=this.active){return this.abilitiesFor(u)[this.selectedSkillIndex]||null;}
  selectSkill(index){this.selectedSkillIndex=index;this.selectAction('skill');}
  selectAction(action){
    if(this.battleOver||this.actionLocked||!this.active||this.active.team!=='player'||this.autoBattle)return;this.clearHighlights();
    if(action==='move'){if(this.active.ap<1)return flashText(this,'No tienes AP suficiente.',640,120,0xff7777);this.action='move';this.actionInfo.setText(`Movimiento · 1 AP · Alcance ${this.movementRange(this.active)} casillas. Elige una casilla verde.`);this.validMoves(this.active).forEach(p=>this.highlightCell(p.col,p.row,0x50dc84));return;}
    if(action==='attack'){if(this.active.ap<2)return flashText(this,'No tienes AP suficiente.',640,120,0xff7777);this.action='attack';this.actionInfo.setText('Ataque básico · 2 AP · 1d3 + 1/2 FUE. Pulsa un enemigo adyacente.');const targets=this.adjacentEnemies(this.active);targets.forEach(t=>this.highlightCell(t.col,t.row,0xff525f));if(!targets.length)flashText(this,'No hay enemigos adyacentes.',640,120,0xffbd69);return;}
    const a=this.selectedAbility();if(!a)return flashText(this,'Habilidad no aprendida.',640,120,0xffbd69);if(this.active.ap<a.apCost||this.active.mp<this.abilityMpCost(this.active,a)||this.abilityCooldown(this.active,a)>0)return flashText(this,'No tienes AP o MP suficiente.',640,120,0xff7777);
    this.action='skill';this.actionInfo.setText(`[${a.rarity}] ${a.name} · ${a.apCost} AP · ${a.mpCost} MP\n${a.description}`);
    if(a.targetMode==='self')this.actionInfo.setText(`[${a.rarity}] ${a.name} · ${a.apCost} AP · ${a.mpCost} MP\n${a.description}\nPulsa sobre la unidad activa para confirmar.`);
    const cells=this.skillCells(this.active,a);cells.forEach(p=>this.highlightCell(p.col,p.row,0x5ba9ff));if(!cells.length)flashText(this,'No hay objetivos válidos.',640,120,0xffbd69);
  }
  onCell(col,row){if(this.battleOver||this.actionLocked||!this.active||this.active.team!=='player'||this.autoBattle)return;if(this.action==='move'){const move=this.validMoves(this.active).find(p=>p.col===col&&p.row===row);if(move)this.moveUnit(this.active,col,row,()=>{this.active.ap--;this.afterAction();},move.path);}else if(this.action==='attack'){const t=this.unitAt(col,row);if(t)this.tryAttackTarget(t);}else if(this.action==='skill')this.trySkillCell(col,row);}
  tryAttackTarget(target){if(!this.isAdjacent(this.active,target)||target.team===this.active.team)return flashText(this,'Solo puedes atacar a un enemigo adyacente.',640,120,0xffbd69);this.breakStealth(this.active);this.basicAttack(this.active,target,()=>{this.active.ap-=BALANCE.basicAttackCost;this.afterAction();this.checkEnd();});}
  bonusDamage(u){return u.buffs.some(b=>b.id==='fireDamage')?rollDie(4):0;}
  basicAttack(attacker,target,done){let damage=Math.max(1,rollDie(3)+Math.floor(attacker.str/2)-Math.floor(target.df/3))+this.bonusDamage(attacker);this.dealDamage(attacker,target,damage,'hit',done);}
  skillCells(u,a){
    const dir=u.team==='player'?1:-1,all=this.cells.map(c=>({col:c.c,row:c.r}));
    if(a.targetMode==='self')return[{col:u.col,row:u.row}];
    if(a.targetMode==='line'){for(let i=1;i<=a.range;i++){const col=u.col+dir*i;if(col<0||col>=GAME.cols)break;const o=this.unitAt(col,u.row);if(!o)continue;if(o.team===u.team&&!o.isObstacle)continue;return o.team!==u.team?[{col,row:u.row}]:[];}return[];}
    if(a.targetMode==='frontArea'){const col=u.col+dir;return[-1,0,1].map(d=>({col,row:u.row+d})).filter(p=>p.col>=0&&p.col<GAME.cols&&p.row>=0&&p.row<GAME.rows);}
    if(a.targetMode==='frontEmpty'){
      const col=u.col+dir,row=u.row;
      return col>=0&&col<GAME.cols&&!this.unitAt(col,row)?[{col,row}]:[];
    }
    if(a.targetMode==='ally')return this.units.filter(t=>t.alive&&t.team===u.team&&!t.isObstacle&&Math.abs(t.col-u.col)+Math.abs(t.row-u.row)<=a.range).map(t=>({col:t.col,row:t.row}));
    if(a.targetMode==='deadAlly')return this.units.filter(t=>!t.alive&&t.team===u.team&&!t.isSummon).map(t=>({col:t.col,row:t.row}));
    if(a.targetMode==='cell')return all;
    if(a.targetMode==='anyUnit')return this.units.filter(t=>t.alive&&!t.isObstacle&&t!==u).map(t=>({col:t.col,row:t.row}));
    return[];
  }
  trySkillTarget(target){this.trySkillCell(target.col,target.row);}
  trySkillCell(col,row){const a=this.selectedAbility();if(!a)return;const valid=this.skillCells(this.active,a).some(p=>p.col===col&&p.row===row);if(!valid)return flashText(this,'Objetivo no válido.',640,120,0xffbd69);this.executeAbility(this.active,{col,row},a);}
  executeAbility(u,targetCell,a=this.selectedAbility(u)){
    if(!a)return false;
    if(a.id==='bloodThirst'&&u.usedAbilitiesThisTurn?.includes(a.id)){
      flashText(this,'Sed de Sangre solo puede usarse una vez por turno.',640,120,0xffbd69);
      return false;
    }
    const executed=executeAbilityEffect(this,u,targetCell,a);
    if(!executed)return false;
    u.usedAbilitiesThisTurn?.push(a.id);
    this.lastAbilityByTeam[u.team]=a.id;
    this.log.add('ability_used',`${u.name} usa ${a.name}`,{unit:u.id,team:u.team,ability:a.id,target:targetCell,effectHandler:a.effectHandler});
    return true;
  }

  addBuff(u,b){for(const k of ['str','df','agi','stealth'])if(b[k])u[k]+=b[k];u.buffs.push({...b,justApplied:true});}
  addNegativeStatus(u,id,duration){if(u.buffs.some(b=>b.id==='adaptiveResistance'))duration=Math.max(1,duration-3);const resistance=Math.max(0,Math.min(100,Number(u.resistances?.[id]||0)));if(resistance&&Math.random()*100<resistance){flashText(this,'¡Resistido!',u.sprite.x,u.sprite.y-78,0x9fdcff);return false;}if(id==='paralyzed')u.paralyzedTurns=Math.max(u.paralyzedTurns,duration);else u.buffs.push({id,remaining:duration,negative:true,justApplied:true});return true;}
  applyTurnStartStatuses(u){const poison=u.buffs.find(b=>b.id==='poison');if(poison){this.applyInstantDamage(null,u,2,'magic');flashText(this,'Veneno -2',u.sprite.x,u.sprite.y-78,0x82db62);}const bleeding=u.buffs.find(b=>b.id==='bleeding');if(bleeding){this.applyInstantDamage(null,u,1,'physical');flashText(this,'Sangrado -1',u.sprite.x,u.sprite.y-92,0xff6d7a);}}
  breakStealth(u){u.buffs=u.buffs.filter(b=>{if(b.id==='stealth'){u.agi-=b.agi||0;return false;}return true;});}
  payAbility(u,a,refund=0){u.ap=Math.max(0,u.ap-a.apCost+refund);u.mp=Math.max(0,u.mp-this.abilityMpCost(u,a));let cd=a.cooldown||0;if(this.teamHasRelic(u.team,'echoCrystal')&&!u.echoUsed){cd=Math.floor(cd/2);u.echoUsed=true;}u.cooldowns[a.id]=cd;this.afterAction();this.checkEnd();}
  afterAction(){this.action='none';this.clearHighlights();this.updateHud();this.updateButtons();}
  dealDamage(attacker,target,damage,fx,done){this.actionLocked=true;if(target.buffs.some(b=>b.id==='wateryDodge')){target.buffs=target.buffs.filter(b=>b.id!=='wateryDodge');flashText(this,'¡Esquiva Acuosa!',target.sprite.x,target.sprite.y-70,0x72d9ff);this.actionLocked=false;done?.();return;}this.playHit(attacker,target,damage,fx,()=>{this.afterDamage(attacker,target,damage);this.actionLocked=false;done?.();});}
  applyInstantDamage(attacker,target,damage,fx){if(target.buffs.some(b=>b.id==='wateryDodge')){target.buffs=target.buffs.filter(b=>b.id!=='wateryDodge');return;}target.hp-=damage;this.damageSerial++;this.spawnFx(target,fx);floatNumber(this,`-${damage}`,target.sprite.x,target.sprite.y-62,0xff626f);this.updateUnitHp(target);if(target.hp<=0)this.killUnit(target);this.afterDamage(attacker,target,damage);}
  afterDamage(attacker,target,damage){if(attacker?.buffs?.some(b=>b.id==='lifesteal'))this.heal(attacker,Math.max(1,Math.floor(damage*.5)));this.checkBerserker(target);}
  heal(u,amount){const actual=Math.min(amount,u.maxHp-u.hp);u.hp+=actual;this.spawnFx(u,'heal');floatNumber(this,`+${actual}`,u.sprite.x,u.sprite.y-62,0x71ef91);this.updateUnitHp(u);}
  playHit(attacker,target,damage,fxKey,done){if(!attacker)return this.applyInstantDamage(null,target,damage,fxKey);const dx=Math.sign(target.col-attacker.col),dy=Math.sign(target.row-attacker.row),ox=attacker.sprite.x,oy=attacker.sprite.y;this.tweens.add({targets:attacker.sprite,x:ox+dx*16,y:oy+dy*16,duration:90,yoyo:true,onComplete:()=>{target.hp-=damage;this.damageSerial++;this.spawnFx(target,fxKey);floatNumber(this,`-${damage}`,target.sprite.x,target.sprite.y-62,0xff626f);this.updateUnitHp(target);if(target.hp<=0)this.killUnit(target);done?.();}});}
  spawnFx(target,key){
    const aliases={physical:'hit',hitPhysical:'hit',hitMagic:'magic',healing:'heal'};
    const requested=aliases[key]||key;
    const texture=this.textures.exists(requested)?requested:(this.textures.exists('hit')?'hit':'placeholder');
    const fx=this.add.image(target.sprite.x,target.sprite.y,texture).setDisplaySize(110,110).setAlpha(.95);
    this.tweens.add({targets:fx,alpha:0,scale:1.4,duration:300,onComplete:()=>fx.destroy()});
  }
  movementRange(u){return Phaser.Math.Clamp(2+Math.floor(Math.max(0,u.agi)/3),2,7);}
  validMoves(u){
    if(u.buffs?.some(b=>b.id==='immobilized'))return[];
    const max=this.movementRange(u),key=(c,r)=>`${c},${r}`,queue=[{col:u.col,row:u.row,d:0,path:[]}],seen=new Set([key(u.col,u.row)]),out=[];
    while(queue.length){
      const cur=queue.shift();
      if(cur.d>=max)continue;
      for(const [dc,dr] of [[1,0],[-1,0],[0,1],[0,-1]]){
        const col=cur.col+dc,row=cur.row+dr,k=key(col,row);
        if(col<0||col>=GAME.cols||row<0||row>=GAME.rows||seen.has(k)||this.unitAt(col,row))continue;
        const next={col,row,d:cur.d+1,path:[...cur.path,{col,row}]};seen.add(k);queue.push(next);out.push(next);
      }
    }
    return out;
  }
  isAdjacent(a,b){return !!a&&!!b&&Math.abs(a.col-b.col)+Math.abs(a.row-b.row)===1;}
  adjacentEnemies(u){return this.units.filter(t=>t.alive&&t.team!==u.team&&!t.isObstacle&&this.isAdjacent(u,t));}
  frontTarget(u){return this.adjacentEnemies(u)[0]||null;}
  moveUnit(u,col,row,done,path=null){
    this.actionLocked=true;
    const route=path||this.validMoves(u).find(p=>p.col===col&&p.row===row)?.path||[{col,row}];
    const steps=route.length?route:[{col,row}];
    let index=0;
    const advance=()=>{
      const step=steps[index++],pos=this.cellCenter(step.col,step.row);
      this.tweens.add({targets:[u.sprite,u.hpBack,u.hpBar,u.arrow],x:{value:pos.x},y:{value:pos.y},duration:Math.max(70,150-Math.min(steps.length,6)*8),onUpdate:()=>{u.hpBack.x=u.sprite.x;u.hpBack.y=u.sprite.y-27;u.hpBar.x=u.sprite.x-20;u.hpBar.y=u.sprite.y-27;u.arrow.x=u.sprite.x;u.arrow.y=u.sprite.y+27;},onComplete:()=>{u.col=step.col;u.row=step.row;if(index<steps.length)advance();else{this.actionLocked=false;done?.();}}});
    };
    advance();
  }
  endTurn(){if(this.battleOver||!this.active||this.actionLocked)return;if(this.active.paralyzedTurns>0)this.active.paralyzedTurns--;this.tickBuffs(this.active);this.handleStalemateTurn(this.active);this.action='none';this.clearHighlights();this.queueIndex++;this.time.delayedCall(180,()=>this.beginTurn());}
  tickBuffs(u){
    u.buffs.forEach(b=>{if(b.justApplied)b.justApplied=false;else b.remaining--;});
    const expired=u.buffs.filter(b=>b.remaining<=0);
    expired.forEach(b=>{for(const k of ['str','df','agi','stealth'])if(b[k])u[k]-=b[k];if(b.scale)u.sprite.setScale(1);if(b.id==='transformed'&&b.original){Object.assign(u,b.original);u.learnedAbilities=[...b.original.learnedAbilities];u.sprite.setTexture(this.textureForUnit(u));}if(b.id==='copiedAbility')u.copiedAbility=null;});
    u.buffs=u.buffs.filter(b=>b.remaining>0);
  }
  toggleAutoBattle(){if(this.battleOver)return;this.autoBattle=!this.autoBattle;this.autoLabel.setText(`AUTO-BATTLE: ${this.autoBattle?'SÍ':'NO'}`);this.autoButton.setFillStyle(this.autoBattle?0x285f3c:0x241a31,.96);if(this.autoBattle&&this.active?.team==='player')this.time.delayedCall(150,()=>this.runAIControlled(this.active));}
  runAIControlled(u){if(!u?.alive||this.battleOver||u!==this.active)return;const enemyTeam=u.team==='player'?'enemy':'player';let safety=0;const loop=()=>{if(this.battleOver||u!==this.active||!u.alive)return;if(u.ap<=0||safety++>8)return this.endTurn();const front=this.frontTarget(u);if(front&&front.team===enemyTeam&&u.ap>=2){const estimate=Math.max(1,2+Math.floor(u.str/2)-Math.floor(front.df/3));if(front.hp<=estimate||!this.bestAbilityAction(u,enemyTeam))return this.basicAttack(u,front,()=>{u.ap-=2;this.updateHud();if(!this.checkEnd())this.time.delayedCall(150,loop);});}
      const action=this.bestAbilityAction(u,enemyTeam);if(action){
        this.selectedSkillIndex=this.abilitiesFor(u).findIndex(a=>a.id===action.ability.id);
        try{
          const executed=this.executeAbility(u,action.cell,action.ability);
          if(!executed){
            action.ability._aiBlocked=true;
            return this.time.delayedCall(80,loop);
          }
        }catch(error){
          this.log.error('Fallo al ejecutar habilidad de IA',error,{unit:u.id,ability:action.ability?.id});console.error('AI ability failed:',action.ability?.id,error);
          action.ability._aiBlocked=true;
          return this.time.delayedCall(80,loop);
        }
        return this.time.delayedCall(180,loop);
      }
      if(front&&front.team===enemyTeam&&u.ap>=2)return this.basicAttack(u,front,()=>{u.ap-=2;this.updateHud();if(!this.checkEnd())this.time.delayedCall(150,loop);});
      const move=chooseMove(this,u,enemyTeam);if(u.ap>=1&&move&&move.score>0)return this.moveUnit(u,move.col,move.row,()=>{u.ap--;this.log.add('ai_move',`${u.name} se mueve`,{unit:u.id,profile:u.aiProfile,to:{col:move.col,row:move.row},score:move.score});this.updateHud();this.time.delayedCall(150,loop);},move.path);this.endTurn();};loop();}
  bestAbilityAction(u,enemyTeam){return chooseAbilityAction(this,u,enemyTeam);}
  aiUseAbility(){return false;}
  setHudVisible(visible){this.hudObjects?.forEach(o=>o.setVisible(visible));}
  abilityMpCost(u,a){return Math.max(0,a.mpCost-(this.teamHasRelic(u.team,'magicCore')?2:0));}
  abilityCooldown(u,a){return u.cooldowns?.[a.id]||0;}
  teamHasRelic(team,id){return team==='player'?hasRelic(SAVE,id):this.enemyRelics.includes(id);}
  updateHud(){if(!this.active)return;const portrait=ENEMIES[this.active.type]?.portrait||(this.active.type==='zombie'?'zombiePortrait':CLASSES[this.active.type]?.portrait||'zombiePortrait');this.portrait.setTexture(portrait);this.nameText.setText(`${this.active.name} · Nv. ${this.active.level}`);this.resourceText.setText(`HP ${Math.max(0,this.active.hp)}/${this.active.maxHp}     MP ${this.active.mp}/${this.active.maxMp}     AP ${this.active.ap}/${this.active.maxAp}`);const arr=this.abilitiesFor(this.active);this.buttons.skills.forEach((b,i)=>{const a=arr[i],cd=a?this.abilityCooldown(this.active,a):0;b.icon.setTexture(a?.icon||'skill');b.txt.setText(a?`${a.rarity} · ${a.name}`:`SKILL ${i+1}`);b.ct.setText(a?`${a.apCost} AP · ${this.abilityMpCost(this.active,a)} MP${cd?` · CD ${cd}`:''}`:'Bloqueada');});}
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
  handleStalemateTurn(){
    // Se cuentan turnos completos de unidades, no acciones ni movimientos.
    // Cualquier daño real, causado o recibido por cualquier equipo, reinicia la racha.
    if(this.damageSerial!==this.lastStalemateDamageSerial){
      this.lastStalemateDamageSerial=this.damageSerial;
      this.noDamageTurns=0;
      return;
    }
    this.noDamageTurns++;
    if(this.noDamageTurns<STALEMATE_TURN_LIMIT)return;
    this.noDamageTurns=0;
    this.stalemateResets++;
    if(this.stalemateResets<=2){
      flashText(this,`Reposicionamiento anti-bloqueo ${this.stalemateResets}/2 tras ${STALEMATE_TURN_LIMIT} turnos sin daño`,640,125,0xffdf76);
      this.repositionTeams();
      return;
    }
    this.resolveStalemateDefeat();
  }
  resolveStalemateDefeat(){
    if(this.battleOver)return;
    this.battleOver=true;
    this.log.add('battle_end','Derrota por bloqueo prolongado',{round:SAVE.round,stalemateResets:this.stalemateResets});
    this.clearHighlights();
    flashText(this,'Derrota: tercer bloqueo consecutivo',640,150,0xff6571);
    this.time.delayedCall(700,()=>this.showDefeat());
  }
  repositionTeams(){for(const team of ['player','enemy']){const units=this.units.filter(u=>u.alive&&u.team===team&&!u.isObstacle);const cols=team==='player'?[0,1,2]:[9,8,7];const slots=[];for(const c of cols)for(let r=3;r<6;r++)slots.push({col:c,row:r});units.forEach((u)=>{const spot=slots.find(p=>!this.unitAt(p.col,p.row)||this.unitAt(p.col,p.row)===u);if(spot)this.moveUnit(u,spot.col,spot.row);});}}
  resolveByHp(){const hp=team=>this.units.filter(u=>u.alive&&u.team===team&&!u.isObstacle).reduce((n,u)=>n+Math.max(0,u.hp),0);const p=hp('player'),e=hp('enemy');this.battleOver=true;flashText(this,`Desempate por HP: ${p} - ${e}`,640,150,0xffe596);this.time.delayedCall(700,()=>p>=e?this.showVictory():this.showDefeat());}
  showStats(u){
    this.statsContainer?.destroy(true);const cls=CLASSES[u.type],c=this.add.container(790,24).setDepth(40);this.statsContainer=c;const panel=this.add.rectangle(0,0,470,690,0x100b18,.98).setOrigin(0).setStrokeStyle(3,u.team==='player'?0x48d47a:0xe7505d);const title=this.add.text(20,17,u.name,{fontSize:'22px',fontStyle:'bold',color:'#fff'});const subtitle=this.add.text(20,54,`Nivel ${u.level} · ${u.team==='player'?'Aliado':'Enemigo'}`,{fontSize:'16px',color:'#d8ccdf'});const close=this.add.text(420,12,'✕',{fontSize:'30px',color:'#fff'}).setInteractive({useHandCursor:true}).on('pointerdown',()=>{c.destroy(true);this.statsContainer=null;});const portraitKey=ENEMIES[u.type]?.portrait||(u.type==='zombie'?'zombiePortrait':cls?.portrait||'zombiePortrait');const portrait=this.add.image(91,159,portraitKey).setDisplaySize(120,120);const combat=this.add.text(175,101,[`HP ${Math.max(0,u.hp)}/${u.maxHp}`,`MP ${u.mp}/${u.maxMp}`,`AP ${u.ap}/${u.maxAp}`,`DF ${u.df}`,`FUE ${u.str}`,`INT ${u.int}`,`AGI ${u.agi}`,`MOV ${this.movementRange(u)}`].join('\n'),{fontSize:'16px',color:'#eee6f4',lineSpacing:5});c.add([panel,title,subtitle,close,portrait,combat]);
    let statsY=300;if(u.blessing){const bd=BLESSINGS[u.blessing],bi=this.add.image(80,340,bd.texture).setDisplaySize(90,90),bn=this.add.text(145,312,`${u.blessing}\n+${u.blessingBonus} ${bd.statLabel}`,{fontSize:'18px',fontStyle:'bold',color:'#fff',lineSpacing:5});c.add([bi,bn]);statsY=430;}
    const stats=this.add.text(20,statsY,[`Constitución: ${u.constitution}     Energía: ${u.energy}`,`Carisma: ${u.charisma}             Voluntad: ${u.will}`,`Sigilo: ${u.stealth}%              Percepción: ${u.perception}`].join('\n'),{fontSize:'15px',color:'#d1c5dc',lineSpacing:18});c.add(stats);
    const statuses=[...(u.paralyzedTurns>0?[{id:'paralyzed',remaining:u.paralyzedTurns}]:[]),...u.buffs.filter(b=>STATUS_TEXTURES[b.id])];const sy=statsY+125;const stitle=this.add.text(20,sy,'ESTADOS ACTIVOS',{fontSize:'14px',fontStyle:'bold',color:'#ffe69a'});c.add(stitle);if(!statuses.length)c.add(this.add.text(20,sy+30,'Ninguno',{fontSize:'14px',color:'#aaa0b1'}));statuses.slice(0,8).forEach((s,i)=>{const x=48+(i%4)*105,y=sy+62+Math.floor(i/4)*65;c.add(this.add.image(x,y,STATUS_TEXTURES[s.id]).setDisplaySize(42,42));c.add(this.add.text(x+27,y-12,`${s.remaining>=900?'∞':s.remaining}t`,{fontSize:'11px',color:'#fff'}));});
  }
  updateUnitHp(u){const ratio=Phaser.Math.Clamp(u.hp/u.maxHp,0,1);u.hpBar.width=40*ratio;u.hpBar.fillColor=ratio>.5?0x42d36e:ratio>.25?0xf3bf4d:0xe54452;}
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
  clearHighlights(){this.cells.forEach(c=>c.rect.setFillStyle(c.baseColor??0x272030,(c.baseColor===0x272030)?0.22:0.30));}
  highlightCell(col,row,color){this.cells.find(c=>c.c===col&&c.r===row)?.rect.setFillStyle(color,.68);}
  cellCenter(col,row){return{x:GAME.gridX+col*GAME.tile+GAME.tile/2,y:(this.gridY??GAME.gridY)+row*GAME.tile+GAME.tile/2};}
  unitAt(col,row){return this.units.find(u=>u.alive&&u.col===col&&u.row===row);}
  checkEnd(){const players=this.units.some(u=>u.alive&&u.team==='player'&&!u.isSummon),enemies=this.units.some(u=>u.alive&&u.team==='enemy'&&!u.isSummon);if(players&&enemies)return false;this.battleOver=true;this.log.add('battle_end',players?'Victoria del jugador':'Derrota del jugador',{round:SAVE.round});this.clearHighlights();this.time.delayedCall(450,()=>players?this.showVictory():this.showDefeat());return true;}
  showVictory(){
    this.add.rectangle(640,360,1280,720,0x07040b,.84).setDepth(50);
    this.add.rectangle(640,360,700,440,0x171020,.99).setStrokeStyle(4,0x66e38e).setDepth(51);
    this.add.text(640,185,SAVE.pendingNodeType==='boss'?'¡BOSS DERROTADO!':'¡VICTORIA!',{fontSize:'42px',fontStyle:'bold',color:'#79ee9c'}).setOrigin(.5).setDepth(52);
    const completed=SAVE.round,enemyReward=this.units.filter(u=>u.team==='enemy'&&!u.isSummon&&u.enemyReward).reduce((sum,u)=>({gold:sum.gold+(u.enemyReward.gold||0),xp:sum.xp+(u.enemyReward.xp||0)}),{gold:0,xp:0}),xp=BALANCE.xpBase+completed*BALANCE.xpPerRound+enemyReward.xp,results=awardGlobalXp(xp),leveled=results.filter(x=>x.leveled),gold=10+(SAVE.mapNumber-1)*3+(SAVE.pendingNodeType==='boss'?25:0)+enemyReward.gold;
    completeCurrentNode({won:true,gold,goldSource:SAVE.pendingNodeType==='boss'?'boss':'combat'});
    this.add.text(640,260,`+${results[0]?.awardedXp??xp} XP global · +${gold} oro`,{fontSize:'20px',color:'#ffe596'}).setOrigin(.5).setDepth(52);
    const lines=leveled.length?leveled.map(x=>`${x.name}: Nv. ${x.previousLevel} → ${x.newLevel}${x.learned.length?' · Nueva habilidad':''}`).join('\n'):'La plantilla se recuperará antes del siguiente nodo.';
    this.add.text(640,350,lines,{fontSize:'16px',color:'#ddd4e5',align:'center',lineSpacing:7,wordWrap:{width:570}}).setOrigin(.5).setDepth(52);
    const wasBoss=SAVE.generatedMap?.bossNodeId===SAVE.lastCompletedNodeId;
    if(wasBoss){SAVE.pendingBossReward=true;saveRun();}
    makeButton(this,640,510,340,66,SAVE.pendingSkillChoices.length?'ELEGIR HABILIDAD':wasBoss?'RECOMPENSA DE BOSS':'VOLVER AL MAPA',()=>{
      if(wasBoss)advanceAfterBoss();
      const next=wasBoss?'Reward':'Map';
      this.scene.start(SAVE.pendingSkillChoices.length?'SkillChoice':next,{nextScene:next,bossReward:wasBoss});
    }).setDepth(52);
  }
  showDefeat(){
    const remaining=loseLife();
    this.add.rectangle(640,360,1280,720,0x07040b,.84).setDepth(50);
    this.add.rectangle(640,360,650,390,0x171020,.98).setStrokeStyle(4,0xe2505d).setDepth(51);
    this.add.text(640,225,remaining?'DERROTA':'RUN FINALIZADA',{fontSize:'44px',fontStyle:'bold',color:'#ff6571'}).setOrigin(.5).setDepth(52);
    if(remaining){
      this.add.text(640,330,`Has perdido una vida. Te quedan ${remaining}.\nLas unidades se recuperan y el nodo no entrega recompensa.`,{fontSize:'20px',color:'#eee5f2',align:'center',lineSpacing:9}).setOrigin(.5).setDepth(52);
      makeButton(this,640,470,320,64,'VOLVER AL MAPA',()=>this.scene.start('Map')).setDepth(52);
    }else{
      const summary=finishRun();
      this.add.text(640,330,`La run ha terminado.\nOro total ganado: ${summary.totalGoldEarned}.\nNúcleos de Energía Arga obtenidos: ${summary.coresEarned}.\nEl oro restante se ha perdido.`,{fontSize:'20px',color:'#eee5f2',align:'center',lineSpacing:9}).setOrigin(.5).setDepth(52);
      makeButton(this,640,490,320,64,'VOLVER AL MENÚ',()=>this.scene.start('Menu')).setDepth(52);
    }
  }
}
