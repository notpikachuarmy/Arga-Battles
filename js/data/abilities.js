// Las habilidades son entidades independientes. Las clases indican en classes.js
// cuáles pueden aparecer en su pool. Esto permite compartir habilidades entre clases futuras.
export const ABILITIES = {
  runeLightningSpear: {
    id: 'runeLightningSpear', name: 'Runa de Lanza del Rayo',
    icon: 'runeLightning', apCost: 2, mpCost: 5, range: 3, rarity: 'N', targetMode: 'line',
    description: 'Proyectil frontal de hasta 3 casillas. Atraviesa aliados y golpea únicamente al primer enemigo de la línea. Inflige 1d5 + 1/3 de INT y tiene 5% de paralizar.'
  },
  liquidArm: {
    id: 'liquidArm', name: 'Brazo Líquido',
    icon: 'liquidArm', apCost: 2, mpCost: 4, range: 1, rarity: 'N', targetMode: 'frontArea',
    description: 'Golpea la casilla frontal y las dos laterales. Inflige 1d3 + 1/4 de FUE.'
  },
  devilBloodThorns: {
    id: 'devilBloodThorns', name: 'Sangre de Diablo de Espinas',
    icon: 'bloodThorns', apCost: 2, mpCost: 4, range: 0, rarity: 'N', targetMode: 'self',
    description: '+2 FUE y +2 DF durante 2 turnos. Tras pagar el coste, restaura 1 AP.'
  }
};
