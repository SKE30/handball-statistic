// ============================================================
// Statistik-Berechnung — rein abgeleitet aus Events (kein manueller Zähler)
// ============================================================

/** Score { us, them } aus Events eines Spiels berechnen */
export function computeScore(events) {
  let us = 0, them = 0;
  for (const e of events) {
    if (e.category === 'attack' && (e.type === 'goal' || e.type === 'sevenm_goal')) us++;
    if (e.category === 'keeper' && e.type === 'gegentor') them++;
    if (e.category === 'tempo' && e.result === 'goal') {
      if (e.type === 'konter_eigen' || e.type === 'welle_eigen') us++;
      if (e.type === 'konter_gegner' || e.type === 'welle_gegner') them++;
    }
  }
  return { us, them };
}

function emptyPlayerStat() {
  return {
    tore: 0, wuerfe: 0, fehlwuerfe: 0, geblockt: 0, pfosten: 0,
    siebenM_tore: 0, siebenM_versuche: 0, assists: 0, technischeFehler: 0,
    ballgewinne: 0, blocks: 0, verschuldete7m: 0, gelb: 0, zweiMin: 0, rot: 0,
    paraden: 0, gegentore: 0, siebenM_paraden: 0,
  };
}

/** Statistik pro Spieler aus allen Events (eines Spiels oder mehrerer Spiele) */
export function computePlayerStats(events, players) {
  const map = new Map();
  for (const p of players) map.set(p.id, { player: p, ...emptyPlayerStat() });

  for (const e of events) {
    if (!e.playerId) continue;
    const s = map.get(e.playerId);
    if (!s) continue;

    switch (e.type) {
      case 'goal': s.tore++; s.wuerfe++; break;
      case 'miss': s.fehlwuerfe++; s.wuerfe++; break;
      case 'blocked': s.geblockt++; s.wuerfe++; break;
      case 'post': s.pfosten++; s.wuerfe++; break;
      case 'sevenm_goal': s.siebenM_tore++; s.siebenM_versuche++; s.tore++; break;
      case 'sevenm_miss': s.siebenM_versuche++; break;
      case 'assist': s.assists++; break;
      case 'technical_fault': s.technischeFehler++; break;
      case 'ballgewinn': s.ballgewinne++; break;
      case 'block': s.blocks++; break;
      case 'verschuldet_7m': s.verschuldete7m++; break;
      case 'yellow': s.gelb++; break;
      case 'twomin': s.zweiMin++; break;
      case 'red': s.rot++; break;
      case 'parade': s.paraden++; break;
      case 'gegentor': s.gegentore++; break;
      case 'sevenm_parade': s.siebenM_paraden++; break;
    }
  }

  const list = Array.from(map.values());
  for (const s of list) {
    s.trefferquote = s.wuerfe > 0 ? Math.round((s.tore / s.wuerfe) * 100) : 0;
  }
  return list;
}

/** Mannschaftsstatistik aus Events (eines Spiels oder mehrerer) */
export function computeTeamStats(events) {
  const t = {
    tore: 0, wuerfe: 0, fehlwuerfe: 0, technischeFehler: 0,
    ballgewinne: 0, blocks: 0,
    siebenM_tore: 0, siebenM_versuche: 0,
    konterEigenLaufen: 0, konterEigenTor: 0,
    konterGegnerLaufen: 0, konterGegnerTor: 0,
    welleEigenLaufen: 0, welleEigenTor: 0,
    welleGegnerLaufen: 0, welleGegnerTor: 0,
  };
  for (const e of events) {
    if (e.category === 'attack') {
      if (['goal', 'miss', 'blocked', 'post'].includes(e.type)) {
        t.wuerfe++;
        if (e.type === 'goal') t.tore++;
        if (e.type === 'miss') t.fehlwuerfe++;
      }
      if (e.type === 'sevenm_goal') { t.siebenM_tore++; t.siebenM_versuche++; t.tore++; }
      if (e.type === 'sevenm_miss') t.siebenM_versuche++;
      if (e.type === 'technical_fault') t.technischeFehler++;
    }
    if (e.category === 'defense') {
      if (e.type === 'ballgewinn') t.ballgewinne++;
      if (e.type === 'block') t.blocks++;
    }
    if (e.category === 'tempo') {
      const goal = e.result === 'goal';
      if (e.type === 'konter_eigen') { t.konterEigenLaufen++; if (goal) t.konterEigenTor++; }
      if (e.type === 'konter_gegner') { t.konterGegnerLaufen++; if (goal) t.konterGegnerTor++; }
      if (e.type === 'welle_eigen') { t.welleEigenLaufen++; if (goal) t.welleEigenTor++; }
      if (e.type === 'welle_gegner') { t.welleGegnerLaufen++; if (goal) t.welleGegnerTor++; }
    }
  }
  t.wurfquote = t.wuerfe > 0 ? Math.round((t.tore / t.wuerfe) * 100) : 0;
  t.siebenM_quote = t.siebenM_versuche > 0 ? Math.round((t.siebenM_tore / t.siebenM_versuche) * 100) : 0;
  return t;
}
