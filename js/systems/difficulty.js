export function calculateDifficulty(save,node=null){
  const roster=save.playerRoster||[];
  const averageLevel=roster.length?roster.reduce((sum,u)=>sum+(u.level||1),0)/roster.length:1;
  const learnedAbilities=roster.reduce((sum,u)=>sum+(u.learnedAbilities?.length||0),0);
  const depth=(node?.row??0)/14;
  const relics=(save.relics?.length||0)+(save.retiredRelics?.length||0)*.35;
  const blessings=new Set(roster.map(u=>u.blessing).filter(Boolean)).size;
  const deployable=Math.min(6,Math.max(1,roster.length));
  const score=1+(save.mapNumber-1)*.42+depth*.75+(averageLevel-1)*.16+learnedAbilities*.035+relics*.09+blessings*.06+(deployable-3)*.08;
  return {score:Number(score.toFixed(2)),mapNumber:save.mapNumber,depth:Number(depth.toFixed(2)),averageLevel:Number(averageLevel.toFixed(2)),learnedAbilities,relics,blessings,deployable};
}
