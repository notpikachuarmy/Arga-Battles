export const CLASSES = {
  rune: {
    name: 'Trazador de Runas', texture: 'rune', portrait: 'runePortrait', defaultBlessing: 'Hojafail',
    constitution: 1, energy: 3, df: 1, str: 1, int: 3, agi: 2,
    charisma: 2, will: 2, stealth: 1, perception: 2
  },
  formless: {
    name: 'Sin Forma', texture: 'formless', portrait: 'formlessPortrait', defaultBlessing: 'Fotopie',
    constitution: 2, energy: 2, df: 3, str: 2, int: 1, agi: 3,
    charisma: 2, will: 2, stealth: 3, perception: 2
  },
  demon: {
    name: 'Sangre Demoníaca', texture: 'demon', portrait: 'demonPortrait', defaultBlessing: 'Chimech-o',
    constitution: 3, energy: 2, df: 2, str: 3, int: 2, agi: 1,
    charisma: 1, will: 3, stealth: 1, perception: 1
  }
};

export const CLASS_KEYS = Object.keys(CLASSES);
