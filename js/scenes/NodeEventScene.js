import { GAME, BALANCE } from '../config.js';
import { SAVE, createRecruit, completeCurrentNode, saveRun } from '../data/save.js';
import { CLASSES } from '../data/classes.js';
import { BLESSINGS } from '../data/blessings.js';
import { RELICS, RELIC_KEYS, hasRelic } from '../data/relics.js';
import { ABILITIES } from '../data/abilities.js';
import { makeButton } from '../utils/helpers.js';
import {
  SHOP,ensureMerchantState,rerollCost,rerollMerchant,buyRelic,buyRecruit,buySoldierPoints,
  dismissValue,canDismissUnit,dismissUnit,closeMerchant
} from '../systems/shopSystem.js';
import {
  EVENTS,JOURNAL,availableRelicIds,acquireRelic,removeOwnedRelic,discoverRelic,
  unitsWithSkillSpace,nextAbilityFor,eligibleCollectorRelics,higherRelicsFor,
  unknownJournalIds,unlockJournal,chooseEvent,markEventSeen,sacrificeUnit
} from '../systems/eventSystem.js';

export class NodeEventScene extends Phaser.Scene{
  constructor(){super('NodeEvent');}
  init(data={}){this.nodeType=data.nodeType;this.difficulty=data.difficulty||{score:1};this.requestedEventId=data.eventId||null;this.requestedPage=data.page||0;this.merchantTab=data.merchantTab||'relics';}
  create(){
    this.add.image(GAME.width/2,GAME.height/2,'mapBg').setDisplaySize(GAME.width,GAME.height);
    this.add.rectangle(640,360,1280,720,0x080510,.72);
    this.panel=this.add.rectangle(640,360,1040,600,0x15101e,.97).setStrokeStyle(4,0xb695d0);
    if(this.nodeType==='recruit')return this.recruit();
    if(this.nodeType==='relic')return this.relic();
    if(this.nodeType==='merchant')return this.merchant();
    return this.event();
  }
  title(text,sub=''){
    this.add.text(640,82,text,{fontSize:'36px',fontStyle:'bold',color:'#ffe59b'}).setOrigin(.5);
    if(sub)this.add.text(640,126,sub,{fontSize:'16px',color:'#ddd2e4',align:'center',wordWrap:{width:850}}).setOrigin(.5);
  }
  finish(gold=0,goldSource='event'){completeCurrentNode({won:true,gold,goldSource});this.scene.start('Map');}
  message(text,color='#ff7983'){this.notice?.destroy();this.notice=this.add.text(640,650,text,{fontSize:'16px',fontStyle:'bold',color,align:'center'}).setOrigin(.5);}
  choiceCard(x,y,w,h,title,body,onClick,texture=null){
    const bg=this.add.rectangle(x,y,w,h,0x21172d,.98).setStrokeStyle(2,0x806996).setInteractive({useHandCursor:true});
    if(texture)this.add.image(x,y-h*.22,texture).setDisplaySize(82,82);
    this.add.text(x,y+(texture?32:-18),title,{fontSize:'17px',fontStyle:'bold',color:'#fff',align:'center',wordWrap:{width:w-24}}).setOrigin(.5);
    if(body)this.add.text(x,y+(texture?76:28),body,{fontSize:'13px',color:'#cfc2d8',align:'center',wordWrap:{width:w-28}}).setOrigin(.5);
    bg.on('pointerover',()=>bg.setStrokeStyle(4,0xffe596));bg.on('pointerout',()=>bg.setStrokeStyle(2,0x806996));bg.on('pointerdown',onClick);return bg;
  }
  renderPaged(items,render,{page=0,perPage=3}={}){
    const pages=Math.max(1,Math.ceil(items.length/perPage));page=Phaser.Math.Clamp(page,0,pages-1);
    items.slice(page*perPage,page*perPage+perPage).forEach((item,i)=>render(item,i));
    if(pages>1){
      makeButton(this,500,610,170,44,'ANTERIOR',()=>this.restartPage(page-1));
      this.add.text(640,610,`${page+1} / ${pages}`,{fontSize:'16px',color:'#ddd2e4'}).setOrigin(.5);
      makeButton(this,780,610,170,44,'SIGUIENTE',()=>this.restartPage(page+1));
    }
  }
  restartPage(page){this.scene.restart({nodeType:this.nodeType,difficulty:this.difficulty,eventId:this.currentEventId,page});}
  recruit(){
    const manual=hasRelic(SAVE,'recruiterManual');const recruits=Array.from({length:manual?2:1},()=>createRecruit());
    this.title('RECLUTAMIENTO',manual?'El Manual del Reclutador permite incorporar las dos unidades.':'Una unidad se unirá a la expedición.');
    recruits.forEach((r,i)=>{const c=CLASSES[r.type],b=BLESSINGS[r.blessing],x=manual?480+i*320:640;
      this.add.rectangle(x,355,280,330,0x21172d,.98).setStrokeStyle(3,0x806996);this.add.image(x,285,c.portrait).setDisplaySize(145,145);this.add.image(x+82,340,b.texture).setDisplaySize(46,46);
      this.add.text(x,410,`${c.name} · ${c.rarity}\nNivel 1 · ${b.name||r.blessing}`,{fontSize:'17px',fontStyle:'bold',color:'#fff',align:'center'}).setOrigin(.5);
      this.add.text(x,465,r.learnedAbilities[0]?ABILITIES[r.learnedAbilities[0]]?.name||'Habilidad inicial':'Sin habilidad inicial',{fontSize:'13px',color:'#cfc2d8'}).setOrigin(.5);
    });
    makeButton(this,640,565,manual?340:300,60,manual?'RECLUTAR AMBAS':'RECLUTAR',()=>{SAVE.playerRoster.push(...recruits);saveRun();this.finish();});
  }
  relic(){
    this.title('RELIQUIA','Una pieza de poder se une a la expedición.');const available=availableRelicIds();
    if(!available.length){this.add.text(640,340,'Ya posees todas las reliquias disponibles.\nRecibes 20 de oro en su lugar.',{fontSize:'22px',color:'#eee5f2',align:'center'}).setOrigin(.5);return makeButton(this,640,540,300,60,'CONTINUAR',()=>this.finish(20));}
    const id=Phaser.Utils.Array.GetRandom(available),r=RELICS[id];this.add.image(640,300,r.icon).setDisplaySize(150,150);this.add.text(640,410,`${r.name} · ${r.rarity}`,{fontSize:'28px',fontStyle:'bold',color:'#fff'}).setOrigin(.5);this.add.text(640,462,r.description,{fontSize:'17px',color:'#ddd2e4',align:'center',wordWrap:{width:650}}).setOrigin(.5);
    makeButton(this,640,565,300,60,'RECOGER',()=>{acquireRelic(id);this.finish();});
  }
  merchant(){
    this.merchantState=ensureMerchantState();
    this.title('MERCADER',`Oro: ${SAVE.gold} · Margen de Soldados: ${SAVE.soldierPoints}/${BALANCE.maxSoldierPoints}`);
    makeButton(this,360,170,220,44,'RELIQUIAS',()=>this.openMerchantTab('relics'));
    makeButton(this,640,170,220,44,'RECLUTAMIENTO',()=>this.openMerchantTab('recruits'));
    makeButton(this,920,170,220,44,'SERVICIOS',()=>this.openMerchantTab('services'));
    if(this.merchantTab==='dismiss')return this.renderDismissRoster();
    if(this.merchantTab==='recruits')this.renderMerchantRecruits();
    else if(this.merchantTab==='services')this.renderMerchantServices();
    else this.renderMerchantRelics();
    const cost=rerollCost(this.merchantState);
    makeButton(this,460,610,270,52,`REROLL · ${cost} ORO`,()=>{const result=rerollMerchant();if(!result.ok)return this.message('No tienes suficiente oro para el reroll.');this.scene.restart({nodeType:'merchant',difficulty:this.difficulty,merchantTab:this.merchantTab});});
    makeButton(this,820,610,270,52,'MARCHARSE',()=>{closeMerchant();this.finish();});
  }
  openMerchantTab(tab){this.scene.restart({nodeType:'merchant',difficulty:this.difficulty,merchantTab:tab});}
  renderMerchantRelics(){
    const xs=[370,640,910];this.merchantState.relicOffers.forEach((offer,i)=>{const r=RELICS[offer.id];if(!r)return;
      this.add.rectangle(xs[i],385,235,330,0x21172d,.98).setStrokeStyle(2,offer.purchased?0x4d4455:0x806996);
      this.add.image(xs[i],305,r.icon).setDisplaySize(105,105).setAlpha(offer.purchased?.35:1);
      this.add.text(xs[i],390,`${r.name} · ${r.rarity}`,{fontSize:'16px',fontStyle:'bold',color:offer.purchased?'#88818c':'#fff',align:'center',wordWrap:{width:205}}).setOrigin(.5);
      this.add.text(xs[i],448,r.description,{fontSize:'12px',color:'#cfc2d8',align:'center',wordWrap:{width:205}}).setOrigin(.5);
      makeButton(this,xs[i],525,185,44,offer.purchased?'COMPRADA':`${offer.cost} ORO`,()=>{if(offer.purchased)return;const result=buyRelic(i);if(!result.ok)return this.message(result.reason==='gold'?'No tienes suficiente oro.':'La reliquia ya no está disponible.');this.scene.restart({nodeType:'merchant',difficulty:this.difficulty,merchantTab:'relics'});});
    });
    if(!this.merchantState.relicOffers.length)this.add.text(640,390,'No quedan reliquias disponibles en el pool de esta run.',{fontSize:'21px',color:'#ddd2e4'}).setOrigin(.5);
  }
  renderMerchantRecruits(){
    const xs=[370,640,910];this.merchantState.recruitOffers.forEach((offer,i)=>{const u=offer.unit,c=CLASSES[u.type],b=BLESSINGS[u.blessing];
      this.add.rectangle(xs[i],385,235,330,0x21172d,.98).setStrokeStyle(2,offer.purchased?0x4d4455:0x806996);
      this.add.image(xs[i],300,c.portrait).setDisplaySize(110,110).setAlpha(offer.purchased?.35:1);this.add.image(xs[i]+70,345,b.texture).setDisplaySize(38,38).setAlpha(offer.purchased?.35:1);
      this.add.text(xs[i],390,`${c.name} · ${c.rarity}`,{fontSize:'17px',fontStyle:'bold',color:offer.purchased?'#88818c':'#fff',align:'center'}).setOrigin(.5);
      this.add.text(xs[i],438,`${b.name||u.blessing}
${ABILITIES[u.learnedAbilities[0]]?.name||'Sin habilidad'}`,{fontSize:'13px',color:'#cfc2d8',align:'center',wordWrap:{width:205}}).setOrigin(.5);
      makeButton(this,xs[i],525,185,44,offer.purchased?'RECLUTADA':`${offer.cost} ORO`,()=>{if(offer.purchased)return;const result=buyRecruit(i);if(!result.ok)return this.message('No tienes suficiente oro.');this.scene.restart({nodeType:'merchant',difficulty:this.difficulty,merchantTab:'recruits'});});
    });
  }
  renderMerchantServices(){
    const amount=SHOP.soldierPointAmount||2,cost=SHOP.soldierPointCost||35,purchased=this.merchantState.soldierPointsPurchased;
    this.add.rectangle(430,350,360,250,0x21172d,.98).setStrokeStyle(2,0x806996);
    this.add.text(430,285,'MARGEN DE PUNTOS DE SOLDADO',{fontSize:'19px',fontStyle:'bold',color:'#fff',align:'center',wordWrap:{width:320}}).setOrigin(.5);
    this.add.text(430,355,`Aumenta el margen en +${amount}.
Máximo natural: ${BALANCE.maxSoldierPoints}.`,{fontSize:'15px',color:'#cfc2d8',align:'center'}).setOrigin(.5);
    makeButton(this,430,430,230,48,purchased?'COMPRADO':`${cost} ORO`,()=>{const result=buySoldierPoints();if(!result.ok){const text=result.reason==='max'?'Ya alcanzaste el límite natural de 30.':result.reason==='purchased'?'Ya compraste este refuerzo en la visita.':'No tienes suficiente oro.';return this.message(text);}this.scene.restart({nodeType:'merchant',difficulty:this.difficulty,merchantTab:'services'});});
    this.add.rectangle(850,350,360,250,0x21172d,.98).setStrokeStyle(2,0x806996);
    this.add.text(850,285,'DESPEDIR UNIDAD',{fontSize:'21px',fontStyle:'bold',color:'#fff'}).setOrigin(.5);
    this.add.text(850,355,'Retira una unidad definitivamente y recibe oro según su rareza y nivel.',{fontSize:'15px',color:'#cfc2d8',align:'center',wordWrap:{width:310}}).setOrigin(.5);
    makeButton(this,850,430,230,48,'ABRIR CUARTEL',()=>this.renderDismissRoster());
  }
  renderDismissRoster(){
    this.children.removeAll();this.add.image(GAME.width/2,GAME.height/2,'mapBg').setDisplaySize(GAME.width,GAME.height);this.add.rectangle(640,360,1280,720,0x080510,.78);this.add.rectangle(640,360,1040,600,0x15101e,.97).setStrokeStyle(4,0xb695d0);this.title('DESPEDIR UNIDAD','La unidad desaparecerá definitivamente de la run.');
    const page=this.requestedPage||0,items=SAVE.playerRoster,xs=[380,640,900];items.slice(page*3,page*3+3).forEach((u,i)=>{const c=CLASSES[u.type],valid=canDismissUnit(u),value=dismissValue(u);this.choiceCard(xs[i],360,230,310,u.customName?.trim()||c.name,`Nivel ${u.level} · ${c.rarity}\nValor: ${value} oro${valid?'':'\nNo puede despedirse'}`,()=>{if(!valid)return this.message('Debes conservar al menos una unidad que forme un equipo válido.');const result=dismissUnit(u.id);if(!result.ok)return this.message('No se puede despedir esta unidad.');this.scene.restart({nodeType:'merchant',difficulty:this.difficulty,merchantTab:'services'});},c.portrait);});
    const pages=Math.max(1,Math.ceil(items.length/3));if(pages>1){makeButton(this,430,550,170,44,'ANTERIOR',()=>this.scene.restart({nodeType:'merchant',difficulty:this.difficulty,merchantTab:'dismiss',page:(page-1+pages)%pages}));makeButton(this,850,550,170,44,'SIGUIENTE',()=>this.scene.restart({nodeType:'merchant',difficulty:this.difficulty,merchantTab:'dismiss',page:(page+1)%pages}));}
    makeButton(this,640,610,250,48,'VOLVER',()=>this.openMerchantTab('services'));
  }
  event(){
    this.currentEventId=this.requestedEventId||chooseEvent();this.page=this.requestedPage||0;
    if(!this.currentEventId){this.title('EVENTO AGOTADO','No queda ningún evento cuya condición pueda cumplirse.');this.add.text(640,340,'La expedición continúa sin encontrar nada útil.',{fontSize:'22px',color:'#eee5f2'}).setOrigin(.5);return makeButton(this,640,540,300,60,'CONTINUAR',()=>this.finish());}
    const event=EVENTS[this.currentEventId];markEventSeen(this.currentEventId);this.title(event.name,event.description);
    const handler={alchemist:()=>this.alchemist(),ancientAltar:()=>this.ancientAltar(),weaponsMaster:()=>this.weaponsMaster(),necromancer:()=>this.necromancer(),collector:()=>this.collector(),journalEntry:()=>this.journalEntry()}[this.currentEventId];handler();
  }
  cancelButton(){makeButton(this,640,590,280,52,'NO INTERVENIR',()=>this.finish());}
  alchemist(){
    this.add.text(640,172,'Selecciona la reliquia que entregarás. La recibida será aleatoria.',{fontSize:'18px',color:'#fff'}).setOrigin(.5);
    const items=SAVE.relics;const xs=[380,640,900];items.slice(this.page*3,this.page*3+3).forEach((id,i)=>{const r=RELICS[id];this.choiceCard(xs[i],360,230,310,`${r.name} · ${r.rarity}`,r.description,()=>{const choices=availableRelicIds();if(!choices.length)return;const received=Phaser.Utils.Array.GetRandom(choices);removeOwnedRelic(id);SAVE.retiredRelics=SAVE.retiredRelics.filter(x=>x!==id);acquireRelic(received);saveRun();this.showRelicResult('TRANSMUTACIÓN COMPLETADA',received,`${r.name} vuelve al pool de esta run.`);},r.icon);});
    this.pageControls(items.length);this.cancelButton();
  }
  ancientAltar(){
    const choices=availableRelicIds();const id=Phaser.Utils.Array.GetRandom(choices);const r=RELICS[id];this.add.image(640,300,r.icon).setDisplaySize(130,130);this.add.text(640,405,'El altar reclama 1 vida.',{fontSize:'23px',fontStyle:'bold',color:'#ff9aa2'}).setOrigin(.5);this.add.text(640,450,`A cambio recibirás ${r.name} · ${r.rarity}.`,{fontSize:'18px',color:'#fff'}).setOrigin(.5);
    makeButton(this,500,545,300,58,'SACRIFICAR 1 VIDA',()=>{if(SAVE.lives<=1)return this.message('No puedes sacrificar tu última vida.');SAVE.lives--;acquireRelic(id);saveRun();this.showRelicResult('EL ALTAR RESPONDE',id,`Vidas restantes: ${SAVE.lives}`);});makeButton(this,800,545,230,58,'RECHAZAR',()=>this.finish());
  }
  weaponsMaster(){
    const units=unitsWithSkillSpace(),xs=[380,640,900];this.add.text(640,172,'Selecciona una unidad. Aprenderá una habilidad nueva hasta un máximo de tres.',{fontSize:'18px',color:'#fff'}).setOrigin(.5);
    units.slice(this.page*3,this.page*3+3).forEach((u,i)=>{const c=CLASSES[u.type];this.choiceCard(xs[i],360,230,310,u.customName?.trim()||c.name,`${u.learnedAbilities.length}/3 habilidades · Nivel ${u.level}`,()=>{const ability=nextAbilityFor(u);if(!ability)return;u.learnedAbilities.push(ability);saveRun();this.showSimpleResult('ENSEÑANZA COMPLETADA',`${u.customName?.trim()||c.name} ha aprendido ${ABILITIES[ability]?.name||ability}.`);},c.portrait);});this.pageControls(units.length);this.cancelButton();
  }
  necromancer(){
    const units=SAVE.playerRoster,xs=[380,640,900];this.add.text(640,172,'La unidad elegida desaparecerá definitivamente. El resto recibirá el 30% de toda su XP acumulada.',{fontSize:'17px',color:'#ffbdc2',align:'center',wordWrap:{width:850}}).setOrigin(.5);
    units.slice(this.page*3,this.page*3+3).forEach((u,i)=>{const c=CLASSES[u.type];this.choiceCard(xs[i],360,230,310,u.customName?.trim()||c.name,`Nivel ${u.level} · XP actual ${u.xp}`,()=>{if(SAVE.playerRoster.length<=1)return this.message('No puedes sacrificar la última unidad.');const result=sacrificeUnit(u);this.showSimpleResult('PACTO COMPLETADO',`${u.customName?.trim()||c.name} ha desaparecido. Las demás unidades reciben ${result.amount} XP global.`);},c.portrait);});this.pageControls(units.length);this.cancelButton();
  }
  collector(){
    const items=eligibleCollectorRelics(),xs=[380,640,900];this.add.text(640,172,'Selecciona una reliquia. Recibirás otra aleatoria de rareza superior.',{fontSize:'18px',color:'#fff'}).setOrigin(.5);
    items.slice(this.page*3,this.page*3+3).forEach((id,i)=>{const r=RELICS[id];this.choiceCard(xs[i],360,230,310,`${r.name} · ${r.rarity}`,r.description,()=>{const higher=higherRelicsFor(id);if(!higher.length)return;const received=Phaser.Utils.Array.GetRandom(higher);removeOwnedRelic(id);if(!SAVE.retiredRelics.includes(id))SAVE.retiredRelics.push(id);acquireRelic(received);if(!SAVE.retiredRelics.includes(received))SAVE.retiredRelics.push(received);saveRun();this.showRelicResult('INTERCAMBIO SUPERIOR',received,`${r.name} y ${RELICS[received].name} no volverán a aparecer en esta run.`);},r.icon);});this.pageControls(items.length);this.cancelButton();
  }
  journalEntry(){
    const ids=unknownJournalIds(),id=Phaser.Utils.Array.GetRandom(ids),entry=JOURNAL[id];this.add.text(640,225,entry.title,{fontSize:'28px',fontStyle:'bold',color:'#fff'}).setOrigin(.5);this.add.text(640,270,entry.author,{fontSize:'17px',fontStyle:'italic',color:'#ffe59b'}).setOrigin(.5);this.add.text(640,390,entry.text,{fontSize:'19px',color:'#ddd2e4',align:'center',wordWrap:{width:760},lineSpacing:7}).setOrigin(.5);makeButton(this,640,560,330,58,'GUARDAR EN EL DIARIO',()=>{unlockJournal(id);this.finish();});
  }
  pageControls(total){const pages=Math.ceil(total/3);if(pages<=1)return;makeButton(this,430,535,170,44,'ANTERIOR',()=>this.restartPage((this.page-1+pages)%pages));this.add.text(640,535,`${this.page+1} / ${pages}`,{fontSize:'16px',color:'#ddd2e4'}).setOrigin(.5);makeButton(this,850,535,170,44,'SIGUIENTE',()=>this.restartPage((this.page+1)%pages));}
  showRelicResult(title,id,extra=''){this.children.removeAll();this.add.image(GAME.width/2,GAME.height/2,'mapBg').setDisplaySize(GAME.width,GAME.height);this.add.rectangle(640,360,1280,720,0x080510,.78);this.add.rectangle(640,360,900,560,0x15101e,.97).setStrokeStyle(4,0xb695d0);const r=RELICS[id];this.title(title,extra);this.add.image(640,300,r.icon).setDisplaySize(145,145);this.add.text(640,410,`${r.name} · ${r.rarity}`,{fontSize:'28px',fontStyle:'bold',color:'#fff'}).setOrigin(.5);this.add.text(640,462,r.description,{fontSize:'17px',color:'#ddd2e4',align:'center',wordWrap:{width:650}}).setOrigin(.5);makeButton(this,640,560,300,58,'CONTINUAR',()=>this.finish());}
  showSimpleResult(title,text){this.children.removeAll();this.add.image(GAME.width/2,GAME.height/2,'mapBg').setDisplaySize(GAME.width,GAME.height);this.add.rectangle(640,360,1280,720,0x080510,.78);this.add.rectangle(640,360,900,500,0x15101e,.97).setStrokeStyle(4,0xb695d0);this.title(title);this.add.text(640,350,text,{fontSize:'22px',color:'#eee5f2',align:'center',wordWrap:{width:720},lineSpacing:6}).setOrigin(.5);makeButton(this,640,535,300,58,'CONTINUAR',()=>this.finish());}
}
