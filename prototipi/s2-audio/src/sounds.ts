export const SOUND_ASSETS = {
  // Combo 8 note
  match_0: require('../assets/sounds/match_0.wav'),
  match_1: require('../assets/sounds/match_1.wav'),
  match_2: require('../assets/sounds/match_2.wav'),
  match_3: require('../assets/sounds/match_3.wav'),
  match_4: require('../assets/sounds/match_4.wav'),
  match_5: require('../assets/sounds/match_5.wav'),
  match_6: require('../assets/sounds/match_6.wav'),
  match_7: require('../assets/sounds/match_7.wav'),

  // Stelle
  star_0: require('../assets/sounds/star_0.wav'),
  star_1: require('../assets/sounds/star_1.wav'),
  star_2: require('../assets/sounds/star_2.wav'),

  // Altri effetti
  select: require('../assets/sounds/select.wav'),
  blocked: require('../assets/sounds/blocked.wav'),
  hint: require('../assets/sounds/hint.wav'),
  undo: require('../assets/sounds/undo.wav'),
  shuffle: require('../assets/sounds/shuffle.wav'),
  stuck: require('../assets/sounds/stuck.wav'),
  start: require('../assets/sounds/start.wav'),
  win: require('../assets/sounds/win.wav'),
  boom: require('../assets/sounds/boom.wav'),
  fog: require('../assets/sounds/fog.wav'),
  gold: require('../assets/sounds/gold.wav'),
  unlock: require('../assets/sounds/unlock.wav'),
  pop: require('../assets/sounds/pop.wav'),
} as const;

export type SoundKey = keyof typeof SOUND_ASSETS;

export const COMBO_KEYS: SoundKey[] = [
  'match_0',
  'match_1',
  'match_2',
  'match_3',
  'match_4',
  'match_5',
  'match_6',
  'match_7',
];
