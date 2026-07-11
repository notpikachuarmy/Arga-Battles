export const BLESSINGS = {
  NotPikachu: {
    name: 'NotPikachu',
    texture: 'notpika',
    color: 0xf09a3c,
    stat: 'str',
    statLabel: 'Fuerza',
    description: 'Potencia el daño físico.'
  },
  Hojafail: {
    name: 'Hojafail',
    texture: 'hojafail',
    color: 0x4e9ee8,
    stat: 'int',
    statLabel: 'Inteligencia',
    description: 'Potencia el daño mágico.'
  },
  Fotopie: {
    name: 'Fotopie',
    texture: 'fotopie',
    color: 0xa86f49,
    stat: 'df',
    statLabel: 'Defensa',
    description: 'Potencia la defensa y la supervivencia.'
  },
  'Chimech-o': {
    name: 'Chimech-o',
    texture: 'chimecho',
    color: 0xa167d4,
    stat: 'will',
    statLabel: 'Voluntad',
    description: 'Potencia la resistencia a efectos negativos.'
  }
};

export const BLESSING_KEYS = Object.keys(BLESSINGS);

export function randomBlessing(defaultBlessing) {
  if (Math.random() < 0.5) return defaultBlessing;
  const alternatives = BLESSING_KEYS.filter(name => name !== defaultBlessing);
  return Phaser.Utils.Array.GetRandom(alternatives);
}

// Cada unidad recibe +1 a la estadística de su bendición.
// Además, 2 unidades del mismo color reciben otro +1 y 3 unidades reciben +2.
export function blessingBonusForCount(count) {
  if (count >= 3) return 3;
  if (count >= 2) return 2;
  return 1;
}
