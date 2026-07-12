import { DATA } from '../data/registry.js';
import { SAVE, createRecruit, earnGold, saveRun, spendGold } from '../data/save.js';
import { CLASSES } from '../data/classes.js';
import { RELICS } from '../data/relics.js';
import { availableRelicIds, acquireRelic } from './eventSystem.js';
import { soldierCost } from './progression.js';
import { BALANCE } from '../config.js';

export const SHOP = DATA.shops?.runMerchant || {};
const pickUnique=(items,count)=>Phaser.Utils.Array.Shuffle([...items]).slice(0,count);
const price=(table,rarity,fallback)=>Math.max(0,Math.floor(Number(table?.[rarity])||fallback));

export function merchantVisitId(){return SAVE.pendingNodeId||`map-${SAVE.mapNumber}-merchant`;}
export function createMerchantState(){
  const state={visitId:merchantVisitId(),rerolls:0,relicOffers:[],recruitOffers:[],soldierPointsPurchased:false,createdAt:new Date().toISOString()};
  refreshMerchantOffers(state);
  return state;
}
export function ensureMerchantState(){
  if(!SAVE.currentMerchant||SAVE.currentMerchant.visitId!==merchantVisitId())SAVE.currentMerchant=createMerchantState();
  SAVE.currentMerchant.relicOffers??=[];SAVE.currentMerchant.recruitOffers??=[];SAVE.currentMerchant.rerolls??=0;
  saveRun();return SAVE.currentMerchant;
}
export function refreshMerchantOffers(state=ensureMerchantState()){
  const relicIds=pickUnique(availableRelicIds(),SHOP.relicOfferCount||3);
  state.relicOffers=relicIds.map(id=>({id,cost:price(SHOP.relicPrices,RELICS[id]?.rarity,30),purchased:false}));
  state.recruitOffers=Array.from({length:SHOP.recruitOfferCount||3},()=>{
    const unit=createRecruit();return{unit,cost:price(SHOP.recruitPrices,CLASSES[unit.type]?.rarity,35),purchased:false};
  });
  saveRun();return state;
}
export function rerollCost(state=ensureMerchantState()){return (SHOP.rerollBaseCost||45)+(state.rerolls||0)*(SHOP.rerollCostIncrease||25);}
export function rerollMerchant(){
  const state=ensureMerchantState(),cost=rerollCost(state);
  if(!spendGold(cost,'merchant_reroll'))return{ok:false,cost};
  state.rerolls++;refreshMerchantOffers(state);saveRun();return{ok:true,cost,nextCost:rerollCost(state)};
}
export function buyRelic(index){
  const state=ensureMerchantState(),offer=state.relicOffers[index];
  if(!offer||offer.purchased||SAVE.relics.includes(offer.id))return{ok:false,reason:'unavailable'};
  if(!spendGold(offer.cost,'merchant_relic'))return{ok:false,reason:'gold'};
  if(!acquireRelic(offer.id)){SAVE.gold+=offer.cost;saveRun();return{ok:false,reason:'unavailable'};}
  offer.purchased=true;saveRun();return{ok:true,offer};
}
export function buyRecruit(index){
  const state=ensureMerchantState(),offer=state.recruitOffers[index];
  if(!offer||offer.purchased)return{ok:false,reason:'unavailable'};
  if(!spendGold(offer.cost,'merchant_recruit'))return{ok:false,reason:'gold'};
  SAVE.playerRoster.push(offer.unit);offer.purchased=true;saveRun();return{ok:true,offer};
}
export function buySoldierPoints(){
  const state=ensureMerchantState(),amount=SHOP.soldierPointAmount||2,cost=SHOP.soldierPointCost||35;
  if(state.soldierPointsPurchased)return{ok:false,reason:'purchased'};
  if(SAVE.soldierPoints>=BALANCE.maxSoldierPoints)return{ok:false,reason:'max'};
  if(!spendGold(cost,'merchant_soldier_points'))return{ok:false,reason:'gold'};
  const gained=Math.min(amount,BALANCE.maxSoldierPoints-SAVE.soldierPoints);SAVE.soldierPoints+=gained;state.soldierPointsPurchased=true;saveRun();return{ok:true,gained,cost};
}
export function dismissValue(unit){const rarity=CLASSES[unit.type]?.rarity||'N';return (SHOP.dismissBaseByRarity?.[rarity]||12)+Math.max(1,unit.level||1)*(SHOP.dismissGoldPerLevel||5);}
export function canDismissUnit(unit){
  if(!unit||SAVE.playerRoster.length<=1)return false;
  const remaining=SAVE.playerRoster.filter(x=>x.id!==unit.id);
  return remaining.some(candidate=>soldierCost(candidate)<=SAVE.soldierPoints);
}
export function dismissUnit(unitId){
  const unit=SAVE.playerRoster.find(x=>x.id===unitId);
  if(!canDismissUnit(unit))return{ok:false};
  const gold=dismissValue(unit);SAVE.playerRoster=SAVE.playerRoster.filter(x=>x.id!==unitId);earnGold(gold,'merchant_dismiss');saveRun();return{ok:true,gold,unit};
}
export function closeMerchant(){SAVE.currentMerchant=null;saveRun();}
