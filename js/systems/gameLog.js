const LIMIT=500;
export class GameLog{
  constructor(scope='game'){this.scope=scope;this.entries=[];}
  add(type,message,data={}){const entry={time:new Date().toISOString(),scope:this.scope,type,message,data};this.entries.push(entry);if(this.entries.length>LIMIT)this.entries.shift();console.debug(`[${this.scope}] ${type}: ${message}`,data);return entry;}
  error(message,error,data={}){return this.add('error',message,{...data,error:error?.message||String(error),stack:error?.stack||null});}
  clear(){this.entries.length=0;}
  export(){return JSON.stringify({scope:this.scope,exportedAt:new Date().toISOString(),entries:this.entries},null,2);}
}
export const SYSTEM_LOG=new GameLog('system');
globalThis.ARGA_DEBUG={...(globalThis.ARGA_DEBUG||{}),systemLog:SYSTEM_LOG};
