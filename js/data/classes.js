export const CLASSES = {
  rune: {
    name: 'Trazador de Runas', texture: 'rune', portrait: 'runePortrait', defaultBlessing: 'Hojafail',
    constitution: 1, energy: 3, df: 1, str: 1, int: 3, agi: 2,
    charisma: 2, will: 2, stealth: 1, perception: 2,
    growth: {
      constitution: 3, energy: 7, df: 2, str: 2, int: 8, agi: 5,
      charisma: 6, will: 4, stealth: 3, perception: 6
    },
    identity: 'Especialista mágico y de control. Termina con mucha Inteligencia, Energía, Carisma y Percepción.'
  },
  formless: {
    name: 'Sin Forma', texture: 'formless', portrait: 'formlessPortrait', defaultBlessing: 'Fotopie',
    constitution: 2, energy: 2, df: 3, str: 2, int: 1, agi: 3,
    charisma: 2, will: 2, stealth: 3, perception: 2,
    growth: {
      constitution: 6, energy: 4, df: 7, str: 5, int: 2, agi: 8,
      charisma: 4, will: 5, stealth: 12, perception: 5
    },
    identity: 'Especialista en movilidad, posicionamiento y supervivencia. Termina con mucha Agilidad, Defensa y Sigilo.'
  },
  demon: {
    name: 'Sangre Demoníaca', texture: 'demon', portrait: 'demonPortrait', defaultBlessing: 'Chimech-o',
    constitution: 3, energy: 2, df: 2, str: 3, int: 2, agi: 1,
    charisma: 1, will: 3, stealth: 1, perception: 1,
    growth: {
      constitution: 8, energy: 3, df: 5, str: 8, int: 4, agi: 2,
      charisma: 2, will: 8, stealth: 2, perception: 3
    },
    identity: 'Especialista en daño físico, sacrificio y resistencia. Termina con mucha Fuerza, Constitución y Voluntad.'
  }
};

export const CLASS_KEYS = Object.keys(CLASSES);
