// ============================================================
// DATENMODELL (Konstanten & Typ-Definitionen als JSDoc)
// ============================================================
//
// Player  { id, number, name, isKeeper: bool }
// Game    { id, date, opponent, homeAway: 'home'|'away', status: 'setup'|'live'|'finished',
//           half: 1|2, timerRunning: bool, timerBaseSeconds: number, timerStartedAt: number|null,
//           lineupPlayerIds: number[], createdAt }
// Event   { id, gameId, ts (wall clock), matchSeconds, half, category, type, playerId|null,
//           position|null, result|null }
//
// Score und alle Statistiken werden NIE gespeichert, sondern immer aus den Events
// des jeweiligen Spiels berechnet (siehe stats.js). Das verhindert inkonsistente Zähler.

export const CATEGORY = {
  ATTACK: 'attack',
  DEFENSE: 'defense',
  KEEPER: 'keeper',
  TEMPO: 'tempo',
};

// Aktionen, die eine Wurfposition erlauben (optional, überspringbar) —
// gilt für Wurfaktionen im Angriff UND für Torwart-Aktionen (Parade/Gegentor),
// damit man auch sieht, aus welcher Position gehalten/kassiert wurde.
export const SHOT_EVENTS_WITH_POSITION = ['goal', 'miss', 'blocked', 'post', 'parade', 'gegentor'];

export const POSITIONS = [
  { id: 'LA', label: 'Linksaußen' },
  { id: 'RL', label: 'Rückraum links' },
  { id: 'RM', label: 'Rückraum Mitte' },
  { id: 'RR', label: 'Rückraum rechts' },
  { id: 'RA', label: 'Rechtsaußen' },
  { id: 'KREIS', label: 'Kreis' },
  { id: 'DL', label: 'Durchbruch links' },
  { id: 'DM', label: 'Durchbruch Mitte' },
  { id: 'DR', label: 'Durchbruch rechts' },
  { id: '7M', label: '7 Meter' },
];

// Aktionskacheln pro Kategorie: id, Label, Farbklasse, ob sie ein Tor für uns/gegen uns zählt
export const ACTIONS = {
  [CATEGORY.ATTACK]: [
    { id: 'goal', label: 'Tor', color: 'green', scoreUs: true },
    { id: 'miss', label: 'Fehlwurf', color: 'gray' },
    { id: 'blocked', label: 'Geblockt', color: 'gray' },
    { id: 'post', label: 'Pfosten/Latte', color: 'gray' },
    { id: 'sevenm_goal', label: '7m Tor', color: 'green', scoreUs: true },
    { id: 'sevenm_miss', label: '7m verworfen', color: 'orange' },
    { id: 'assist', label: 'Assist', color: 'blue' },
    { id: 'technical_fault', label: 'Technischer Fehler', color: 'red' },
  ],
  [CATEGORY.DEFENSE]: [
    { id: 'ballgewinn', label: 'Ballgewinn', color: 'blue' },
    { id: 'block', label: 'Block', color: 'blue' },
    { id: 'verschuldet_7m', label: 'Verschuldeter 7m', color: 'orange' },
    { id: 'yellow', label: 'Gelbe Karte', color: 'yellow' },
    { id: 'twomin', label: '2 Minuten', color: 'red' },
    { id: 'red', label: 'Rote Karte', color: 'red' },
  ],
  [CATEGORY.KEEPER]: [
    { id: 'parade', label: 'Parade', color: 'green' },
    { id: 'gegentor', label: 'Gegentor', color: 'red', scoreThem: true },
    { id: 'sevenm_parade', label: '7m Parade', color: 'green' },
  ],
};

// Tempospiel: kein Spieler nötig, zweistufig (Aktion -> Ergebnis), aber als 1 Event gespeichert
export const TEMPO_TYPES = [
  { id: 'konter_eigen', label: 'Eigener Konter', scoreUsOnGoal: true },
  { id: 'konter_gegner', label: 'Gegner-Konter', scoreThemOnGoal: true },
  { id: 'welle_eigen', label: 'Eigene 2. Welle', scoreUsOnGoal: true },
  { id: 'welle_gegner', label: '2. Welle Gegner', scoreThemOnGoal: true },
];

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function eventTypeLabel(e) {
  if (e.category === CATEGORY.TEMPO) {
    const t = TEMPO_TYPES.find((x) => x.id === e.type);
    return t ? t.label : e.type;
  }
  const all = [...ACTIONS[CATEGORY.ATTACK], ...ACTIONS[CATEGORY.DEFENSE], ...ACTIONS[CATEGORY.KEEPER]];
  const a = all.find((x) => x.id === e.type);
  return a ? a.label : e.type;
}

export const CATEGORY_LABEL = {
  [CATEGORY.ATTACK]: 'Angriff',
  [CATEGORY.DEFENSE]: 'Abwehr',
  [CATEGORY.KEEPER]: 'Torwart',
  [CATEGORY.TEMPO]: 'Tempo',
};
