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
    feldTore: 0, tore: 0, wuerfe: 0, fehlwuerfe: 0, geblockt: 0, pfosten: 0,
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
      case 'goal': s.feldTore++; s.wuerfe++; break;
      case 'miss': s.fehlwuerfe++; s.wuerfe++; break;
      case 'blocked': s.geblockt++; s.wuerfe++; break;
      case 'post': s.pfosten++; s.wuerfe++; break;
      case 'sevenm_goal': s.siebenM_tore++; s.siebenM_versuche++; break;
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
    // Gesamttore = Feldtore + 7m-Tore. Trefferquote bezieht sich NUR auf Feldwürfe
    // (7m-Versuche laufen separat als eigene "7m Quote"), sonst kann die Quote > 100% werden.
    s.tore = s.feldTore + s.siebenM_tore;
    s.trefferquote = s.wuerfe > 0 ? Math.round((s.feldTore / s.wuerfe) * 100) : 0;

    // Paradenquote für Torhüterinnen: gehaltene Bälle (inkl. 7m) / alle auf sie geworfenen Bälle
    const geworfenAufsTor = s.paraden + s.siebenM_paraden + s.gegentore;
    s.paradenquote = geworfenAufsTor > 0 ? Math.round(((s.paraden + s.siebenM_paraden) / geworfenAufsTor) * 100) : 0;
  }
  return list;
}

/** Torwart-Kennzahlen auf Mannschaftsebene (Summe über alle Spielerinnen im Tor) */
export function computeKeeperTeamStats(events) {
  let paraden = 0, gegentore = 0, siebenM_paraden = 0;
  for (const e of events) {
    if (e.category !== 'keeper') continue;
    if (e.type === 'parade') paraden++;
    if (e.type === 'gegentor') gegentore++;
    if (e.type === 'sevenm_parade') siebenM_paraden++;
  }
  return { paraden, gegentore, siebenM_paraden };
}

/** Mannschaftsstatistik aus Events (eines Spiels oder mehrerer) */
export function computeTeamStats(events) {
  const t = {
    feldTore: 0, wuerfe: 0, fehlwuerfe: 0, technischeFehler: 0,
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
        if (e.type === 'goal') t.feldTore++;
        if (e.type === 'miss') t.fehlwuerfe++;
      }
      if (e.type === 'sevenm_goal') { t.siebenM_tore++; t.siebenM_versuche++; }
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
  // Gesamttore = Feldtore + 7m-Tore (entspricht dem Spielstand). Wurfquote bezieht sich
  // NUR auf Feldwürfe, sonst könnte sie durch die separat gezählten 7m-Tore über 100% steigen.
  t.tore = t.feldTore + t.siebenM_tore;
  t.wurfquote = t.wuerfe > 0 ? Math.round((t.feldTore / t.wuerfe) * 100) : 0;
  t.siebenM_quote = t.siebenM_versuche > 0 ? Math.round((t.siebenM_tore / t.siebenM_versuche) * 100) : 0;
  return t;
}

// ============================================================
// Erweiterte Analysen für die Auswertungsseite (Charts)
// ============================================================

/** Kumulativer Spielstandverlauf über die Zeit: [{sec, us, them}, ...], beginnend bei {0,0,0} */
export function computeScoreTimeline(events) {
  const sorted = events.slice().sort((a, b) => a.matchSeconds - b.matchSeconds);
  const timeline = [{ sec: 0, us: 0, them: 0 }];
  let us = 0, them = 0;
  for (const e of sorted) {
    let changed = false;
    if (e.category === 'attack' && (e.type === 'goal' || e.type === 'sevenm_goal')) { us++; changed = true; }
    if (e.category === 'keeper' && e.type === 'gegentor') { them++; changed = true; }
    if (e.category === 'tempo' && e.result === 'goal') {
      if (e.type === 'konter_eigen' || e.type === 'welle_eigen') { us++; changed = true; }
      if (e.type === 'konter_gegner' || e.type === 'welle_gegner') { them++; changed = true; }
    }
    if (changed) timeline.push({ sec: e.matchSeconds, us, them });
  }
  return timeline;
}

/** Momentum-Segmente (Tordifferenz-Verlauf) aus einer Score-Timeline, für Balken-/Flächendarstellung */
export function computeMomentumSegments(timeline, totalSeconds) {
  const segments = [];
  for (let i = 0; i < timeline.length; i++) {
    const start = timeline[i].sec;
    const end = i + 1 < timeline.length ? timeline[i + 1].sec : Math.max(totalSeconds, start + 1);
    segments.push({ start, end, diff: timeline[i].us - timeline[i].them });
  }
  return segments;
}

/** Würfe & Trefferquote je Wurfposition (nur Feldwürfe mit erfasster Position) */
export function computeShotsByPosition(events) {
  const map = new Map();
  for (const e of events) {
    if (e.category !== 'attack' || !e.position) continue;
    if (!['goal', 'miss', 'blocked', 'post'].includes(e.type)) continue;
    if (!map.has(e.position)) map.set(e.position, { attempts: 0, goals: 0 });
    const m = map.get(e.position);
    m.attempts++;
    if (e.type === 'goal') m.goals++;
  }
  return map;
}

/** Gehaltene/kassierte Bälle je Position aus Torwart-Sicht */
export function computeKeeperShotsByPosition(events) {
  const map = new Map();
  for (const e of events) {
    if (e.category !== 'keeper' || !e.position) continue;
    if (!['parade', 'gegentor'].includes(e.type)) continue;
    if (!map.has(e.position)) map.set(e.position, { paraden: 0, gegentore: 0 });
    const m = map.get(e.position);
    if (e.type === 'parade') m.paraden++;
    if (e.type === 'gegentor') m.gegentore++;
  }
  return map;
}

/** Eindeutige Spielerliste aus mehreren Spielen zusammenführen (nach id) */
export function mergePlayers(playerLists) {
  const map = new Map();
  for (const list of playerLists) for (const p of list) map.set(p.id, p);
  return Array.from(map.values());
}
