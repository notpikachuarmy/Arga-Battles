const VALID_RARITIES = new Set(['N','R','SR','SSR','UR']);
const VALID_AI_PROFILES = new Set(['balanced','aggressive','defensive','support','summoner','flanker','boss']);
const VALID_EFFECT_HANDLERS = new Set(['projectileDamage','applyStatusProjectile','areaDamage','addBuff','addPersistentBuff','summon','heal','resurrect','randomCellDamage','perfectTransformation','copyLastEnemyAbility','healthForResources','sacrificePercentBuff','adjacentSacrificeDamage']);

async function readJson(path){
  const response=await fetch(path,{cache:'no-store'});
  if(!response.ok)throw new Error(`No se pudo cargar ${path} (${response.status})`);
  return response.json();
}

async function loadRegistry(){
  const manifest=await readJson('./data/manifest.json');
  const entries=await Promise.all(Object.entries(manifest).map(async([key,file])=>[key,await readJson(`./data/${file}`)]));
  return Object.fromEntries(entries);
}

export const DATA = await loadRegistry();

function issue(level,code,message,context={}){return{level,code,message,context};}

export function validateGameData(data=DATA){
  const issues=[];
  const checkMap=(name,map)=>{
    if(!map||typeof map!=='object'||Array.isArray(map))issues.push(issue('error','INVALID_COLLECTION',`${name} debe ser un objeto.`));
    else for(const [key,value] of Object.entries(map)){
      if(!value||typeof value!=='object')issues.push(issue('error','INVALID_ENTRY',`${name}.${key} no es un objeto.`));
      if(value?.id&&value.id!==key)issues.push(issue('warning','ID_KEY_MISMATCH',`${name}.${key} declara id ${value.id}.`,{collection:name,key}));
    }
  };
  for(const name of ['classes','abilities','relics','blessings','enemies','bosses','statuses','summons','aiProfiles','assets'])checkMap(name,data[name]);
  for(const [id,cls] of Object.entries(data.classes||{})){
    for(const field of ['name','rarity','texture','portrait','defaultBlessing','abilityPool','growth'])if(cls[field]===undefined)issues.push(issue('error','MISSING_CLASS_FIELD',`La clase ${id} no tiene ${field}.`));
    if(!VALID_RARITIES.has(cls.rarity))issues.push(issue('error','INVALID_RARITY',`Rareza no reconocida en clase ${id}: ${cls.rarity}`));
    if(!data.blessings?.[cls.defaultBlessing])issues.push(issue('error','MISSING_BLESSING_REF',`La clase ${id} referencia la bendición inexistente ${cls.defaultBlessing}.`));
    if(!Array.isArray(cls.abilityPool)||!cls.abilityPool.length)issues.push(issue('error','EMPTY_ABILITY_POOL',`La clase ${id} tiene una pool de habilidades vacía.`));
    for(const abilityId of cls.abilityPool||[])if(!data.abilities?.[abilityId])issues.push(issue('error','MISSING_ABILITY_REF',`La clase ${id} referencia la habilidad inexistente ${abilityId}.`));
    for(const stat of ['constitution','energy','df','str','int','agi','charisma','will','stealth','perception'])if(!Number.isFinite(cls[stat]))issues.push(issue('error','MISSING_STAT',`La clase ${id} no tiene una estadística válida: ${stat}.`));
  }
  for(const [id,a] of Object.entries(data.abilities||{})){
    for(const field of ['name','rarity','icon','apCost','mpCost','targetMode','effectHandler','effectData'])if(a[field]===undefined)issues.push(issue('error','MISSING_ABILITY_FIELD',`La habilidad ${id} no tiene ${field}.`));
    if(!VALID_RARITIES.has(a.rarity))issues.push(issue('error','INVALID_RARITY',`Rareza no reconocida en habilidad ${id}: ${a.rarity}`));
    if(a.apCost<0||a.mpCost<0||a.cooldown<0)issues.push(issue('error','INVALID_COST',`La habilidad ${id} tiene costes o enfriamiento negativos.`));
    if(!VALID_EFFECT_HANDLERS.has(a.effectHandler))issues.push(issue('error','INVALID_EFFECT_HANDLER',`La habilidad ${id} usa el manejador de efecto inválido ${a.effectHandler}.`));
    if(!a.effectData||typeof a.effectData!=='object'||Array.isArray(a.effectData))issues.push(issue('error','INVALID_EFFECT_DATA',`La habilidad ${id} no tiene effectData válido.`));
    if(a.icon&&!data.assets?.[a.icon])issues.push(issue('warning','MISSING_ASSET_REF',`La habilidad ${id} usa un icono no declarado: ${a.icon}.`));
  }
  for(const [id,r] of Object.entries(data.relics||{})){
    if(!VALID_RARITIES.has(r.rarity))issues.push(issue('error','INVALID_RARITY',`Rareza no reconocida en reliquia ${id}: ${r.rarity}`));
    if(r.icon&&!data.assets?.[r.icon])issues.push(issue('warning','MISSING_ASSET_REF',`La reliquia ${id} usa un icono no declarado: ${r.icon}.`));
  }
  const requiredAiWeights=['damage','finisher','heal','buff','summon','move','advance','retreat','flank','focusWeak','protectWeak','resourceReserve','aoe'];
  for(const [id,profile] of Object.entries(data.aiProfiles||{})){
    for(const weight of requiredAiWeights)if(!Number.isFinite(profile?.[weight])||profile[weight]<0)issues.push(issue('error','INVALID_AI_WEIGHT',`El perfil IA ${id} no tiene un peso válido: ${weight}.`));
  }
  for(const [id,e] of Object.entries(data.enemies||{})){
    if(e.classId&&!data.classes?.[e.classId])issues.push(issue('error','MISSING_CLASS_REF',`El enemigo ${id} referencia la clase inexistente ${e.classId}.`));
    if(!VALID_AI_PROFILES.has(e.aiProfile))issues.push(issue('error','INVALID_AI_PROFILE',`El enemigo ${id} usa el perfil IA inválido ${e.aiProfile}.`));
  }
  const errors=issues.filter(x=>x.level==='error');
  return {ok:errors.length===0,errors,warnings:issues.filter(x=>x.level==='warning'),issues};
}

export const VALIDATION = validateGameData();
export function printValidationReport(){
  const method=VALIDATION.ok?'info':'error';
  console.groupCollapsed(`Arga Battles · validación de datos: ${VALIDATION.errors.length} errores, ${VALIDATION.warnings.length} avisos`);
  console[method](VALIDATION);
  console.table(VALIDATION.issues);
  console.groupEnd();
  return VALIDATION;
}
