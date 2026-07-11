export const ABILITIES = {
  runeLightningSpear: {
    id: 'runeLightningSpear', classId: 'rune', name: 'Runa de Lanza del Rayo',
    icon: 'runeLightning', apCost: 2, mpCost: 5, range: 3, rarity: 'N', targetMode: 'line',
    description: 'Proyectil frontal de hasta 3 casillas. Inflige 1d5 + 1/3 de INT y tiene 5% de paralizar.'
  },
  liquidArm: {
    id: 'liquidArm', classId: 'formless', name: 'Brazo Líquido',
    icon: 'liquidArm', apCost: 2, mpCost: 4, range: 1, rarity: 'N', targetMode: 'frontArea',
    description: 'Golpea la casilla frontal y las dos laterales. Inflige 1d3 + 1/4 de FUE.'
  },
  devilBloodThorns: {
    id: 'devilBloodThorns', classId: 'demon', name: 'Sangre de Diablo de Espinas',
    icon: 'bloodThorns', apCost: 2, mpCost: 4, range: 0, rarity: 'N', targetMode: 'self',
    description: '+2 FUE y +2 DF durante 2 turnos. Restaura 1 AP.'
  }
};

export const CLASS_ABILITY_POOLS = {
  rune: ['runeLightningSpear'],
  formless: ['liquidArm'],
  demon: ['devilBloodThorns']
};
