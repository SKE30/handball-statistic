import { GamesDB, PlayersDB, EventsDB } from '../db.js';
import { el, fmtDate } from '../ui.js';
import {
  computeScore, computePlayerStats, computeTeamStats, computeKeeperTeamStats,
  computeScoreTimeline, computeMomentumSegments, computeShotsByPosition,
  computeKeeperShotsByPosition, mergePlayers,
} from '../stats.js';
import { POSITIONS } from '../models.js';
import { barChartSvg, groupedBarChartSvg, lineChartSvg, momentumChartSvg, pieChartSvg, shotCourtChartSvg, colorFor } from '../charts.js';

export function renderAnalytics(root, { gameId }, nav) {
  let mode = gameId ? 'game' : 'season';
  let selectedGameId = gameId || null;
  let section = 'team'; // 'team' | 'players'
  let selectedPlayerId = null;

  build();

  function card(title, sub, innerHtml) {
    return el('div', { class: 'chart-card' }, [
      el('h3', {}, title),
      sub ? el('div', { class: 'sub' }, sub) : null,
      el('div', { html: innerHtml }),
    ]);
  }

  async function build() {
    root.innerHTML = '';
    const [allGamesRaw, allPlayersMaster] = await Promise.all([GamesDB.all(), PlayersDB.all()]);
    const finishedGames = allGamesRaw.filter((g) => g.status === 'finished').sort((a, b) => new Date(a.date) - new Date(b.date) || (a.createdAt - b.createdAt));

    const screen = el('div', { class: 'screen' });
    screen.appendChild(el('div', { class: 'row' }, [
      el('button', { class: 'btn-ghost btn', onclick: () => nav.goHome() }, '← Home'),
      el('h1', {}, '📈 Auswertung'),
    ]));

    if (finishedGames.length === 0) {
      screen.appendChild(el('div', { class: 'empty-note' }, 'Noch keine beendeten Spiele vorhanden. Sobald ein Spiel beendet wurde, erscheint hier die Auswertung.'));
      root.appendChild(screen);
      return;
    }

    if (mode === 'game' && (!selectedGameId || !finishedGames.find((g) => g.id === selectedGameId))) {
      selectedGameId = finishedGames[finishedGames.length - 1].id;
    }

    // --- Mode-Umschalter + Spielauswahl ---
    const modeToggle = el('div', { class: 'mode-toggle', style: 'max-width:320px;' }, [
      el('button', { class: mode === 'game' ? 'active' : '', onclick: () => { mode = 'game'; build(); } }, 'Einzelspiel'),
      el('button', { class: mode === 'season' ? 'active' : '', onclick: () => { mode = 'season'; build(); } }, `Saison (${finishedGames.length})`),
    ]);
    screen.appendChild(modeToggle);

    if (mode === 'game') {
      const select = el('select', { style: 'margin-top:10px;max-width:420px;' },
        finishedGames.slice().reverse().map((g) => el('option', {
          value: g.id, ...(g.id === selectedGameId ? { selected: 'selected' } : {}),
        }, `${fmtDate(g.date)} — ${g.homeAway === 'home' ? 'vs' : '@'} ${g.opponent}`)));
      select.onchange = (e) => { selectedGameId = e.target.value; build(); };
      screen.appendChild(select);
    }

    // --- Daten für den aktuellen Scope laden ---
    const gameEventLists = await Promise.all(
      (mode === 'game' ? finishedGames.filter((g) => g.id === selectedGameId) : finishedGames)
        .map(async (g) => ({ game: g, events: await EventsDB.forGame(g.id) }))
    );
    const events = gameEventLists.flatMap((x) => x.events);
    const lineup = mergePlayers(gameEventLists.map((x) => allPlayersMaster.filter((p) => x.game.lineupPlayerIds.includes(p.id))));

    if (events.length === 0) {
      screen.appendChild(el('div', { class: 'empty-note' }, 'Für diese Auswahl liegen noch keine Ereignisse vor.'));
      root.appendChild(screen);
      return;
    }

    // --- Sektionen-Tabs ---
    const tabs = el('div', { class: 'tabs' }, [
      el('button', { class: `tab ${section === 'team' ? 'active' : ''}`, onclick: () => { section = 'team'; build(); } }, 'Mannschaft'),
      el('button', { class: `tab ${section === 'players' ? 'active' : ''}`, onclick: () => { section = 'players'; build(); } }, 'Einzelspielerinnen'),
    ]);
    screen.appendChild(tabs);

    if (section === 'team') {
      screen.appendChild(buildTeamSection(events, gameEventLists, lineup));
    } else {
      screen.appendChild(buildPlayersSection(events, gameEventLists, lineup));
    }

    root.appendChild(screen);
  }

  // ============================================================
  // MANNSCHAFTSAUSWERTUNG
  // ============================================================
  function buildTeamSection(events, gameEventLists, lineup) {
    const team = computeTeamStats(events);
    const keeper = computeKeeperTeamStats(events);
    const playerStats = computePlayerStats(events, lineup);
    const teamVerschuldete7m = playerStats.reduce((a, s) => a + s.verschuldete7m, 0);
    const teamGelb = playerStats.reduce((a, s) => a + s.gelb, 0);
    const teamZweiMin = playerStats.reduce((a, s) => a + s.zweiMin, 0);
    const teamRot = playerStats.reduce((a, s) => a + s.rot, 0);

    const grid = el('div', { class: 'chart-grid' });

    // 1+2. Spielverlauf & Momentum (Einzelspiel) / Saisonverlauf (Saison)
    if (mode === 'game') {
      const timeline = computeScoreTimeline(events);
      const totalSeconds = Math.max(1, ...events.map((e) => e.matchSeconds), timeline[timeline.length - 1]?.sec || 0);
      const halftimeEvent = events.slice().sort((a, b) => a.matchSeconds - b.matchSeconds).find((e) => e.half === 2);
      const lineSvg = lineChartSvg([
        { points: timeline.map((t) => ({ x: t.sec, y: t.us })), color: '#2ea043', label: 'Wir' },
        { points: timeline.map((t) => ({ x: t.sec, y: t.them })), color: '#d3363a', label: 'Gegner' },
      ], { xMax: totalSeconds, halftimeX: halftimeEvent?.matchSeconds });
      grid.appendChild(card('Spielverlauf', 'Kumulierter Spielstand über die Spielzeit', lineSvg));

      const segments = computeMomentumSegments(timeline, totalSeconds);
      const momSvg = momentumChartSvg(segments, { totalSeconds });
      grid.appendChild(card('Match-Momentum', 'Grün = wir in Führung, Rot = Gegner in Führung (Tordifferenz)', momSvg));
    } else {
      const items = gameEventLists.map((x) => {
        const s = computeScore(x.events);
        return { label: `${fmtDate(x.game.date)}`, value: s.us - s.them, color: (s.us - s.them) > 0 ? '#2ea043' : (s.us - s.them) < 0 ? '#d3363a' : '#4b5560', valueLabel: `${s.us}:${s.them}` };
      });
      grid.appendChild(card('Saisonverlauf', 'Tordifferenz je Spiel, chronologisch (grün = gewonnen)', barChartSvg(items, { width: 700 })));
    }

    // 3. Halbzeitvergleich
    const hz1 = computeTeamStats(events.filter((e) => e.half === 1));
    const hz2 = computeTeamStats(events.filter((e) => e.half === 2));
    const hzGroups = [
      { label: 'Tore', values: [{ value: hz1.tore, color: '#3b82c4' }, { value: hz2.tore, color: '#e08a2c' }] },
      { label: 'Würfe', values: [{ value: hz1.wuerfe, color: '#3b82c4' }, { value: hz2.wuerfe, color: '#e08a2c' }] },
      { label: 'Ballgew.', values: [{ value: hz1.ballgewinne, color: '#3b82c4' }, { value: hz2.ballgewinne, color: '#e08a2c' }] },
      { label: 'Blocks', values: [{ value: hz1.blocks, color: '#3b82c4' }, { value: hz2.blocks, color: '#e08a2c' }] },
      { label: 'Fehler', values: [{ value: hz1.technischeFehler, color: '#3b82c4' }, { value: hz2.technischeFehler, color: '#e08a2c' }] },
    ];
    grid.appendChild(card('Halbzeitvergleich', '1. Halbzeit (blau) vs. 2. Halbzeit (orange)',
      groupedBarChartSvg(hzGroups, { legend: [{ label: '1. HZ', color: '#3b82c4' }, { label: '2. HZ', color: '#e08a2c' }] })));

    // 4. Torverteilung
    const goalDist = [
      { label: 'Feldtore', value: team.feldTore, color: colorFor(0) },
      { label: '7m-Tore', value: team.siebenM_tore, color: colorFor(1) },
      { label: 'Kontertore', value: team.konterEigenTor, color: colorFor(2) },
      { label: '2.-Welle-Tore', value: team.welleEigenTor, color: colorFor(3) },
    ];
    grid.appendChild(card('Torverteilung', 'Wie sind unsere Tore entstanden?', pieChartSvg(goalDist)));

    // 5. Wurfpositionen — Feld-Draufsicht mit Wurfkarte
    const posMap = computeShotsByPosition(events);
    const posEntries = POSITIONS.filter((p) => posMap.has(p.id)).map((p) => {
      const m = posMap.get(p.id);
      return { id: p.id, label: p.label, count: m.goals, total: m.attempts };
    });
    if (posEntries.length) {
      grid.appendChild(card('Wurfpositionen', 'Kreisgröße = Anzahl Würfe · Zahl = Tore/Würfe', shotCourtChartSvg(posEntries, { color: '#2ea043' })));
    }

    // 6. Tempospiel-Erfolgsquote
    const tempoGroups = [
      { label: 'Eig. Konter', values: [{ value: team.konterEigenLaufen, color: '#4b5560' }, { value: team.konterEigenTor, color: '#2ea043' }] },
      { label: 'Gegn. Konter', values: [{ value: team.konterGegnerLaufen, color: '#4b5560' }, { value: team.konterGegnerTor, color: '#d3363a' }] },
      { label: 'Eig. 2.Welle', values: [{ value: team.welleEigenLaufen, color: '#4b5560' }, { value: team.welleEigenTor, color: '#2ea043' }] },
      { label: 'Gegn. 2.Welle', values: [{ value: team.welleGegnerLaufen, color: '#4b5560' }, { value: team.welleGegnerTor, color: '#d3363a' }] },
    ];
    grid.appendChild(card('Tempospiel-Erfolg', 'Situationen (grau) vs. Tore (grün=eigene, rot=Gegentore)', groupedBarChartSvg(tempoGroups)));

    // 7. Abwehr-Kennzahlen
    grid.appendChild(card('Abwehr', 'Ballgewinne, Blocks, verschuldete 7m', barChartSvg([
      { label: 'Ballgewinne', value: team.ballgewinne, color: colorFor(1) },
      { label: 'Blocks', value: team.blocks, color: colorFor(0) },
      { label: 'Versch. 7m', value: teamVerschuldete7m, color: colorFor(2) },
    ])));

    // 8. Zeitstrafen
    grid.appendChild(card('Zeitstrafen', 'Gelb / 2 Minuten / Rot (Mannschaft gesamt)', barChartSvg([
      { label: 'Gelb', value: teamGelb, color: '#d8b31a' },
      { label: '2 Min.', value: teamZweiMin, color: '#d3363a' },
      { label: 'Rot', value: teamRot, color: '#8b0000' },
    ])));

    // 9. Torhüter-Vergleich
    const keepers = playerStats.filter((s) => s.player.isKeeper && (s.paraden + s.gegentore + s.siebenM_paraden) > 0);
    if (keepers.length > 0) {
      grid.appendChild(card('Torhüterinnen-Vergleich', 'Paradenquote je Torhüterin', barChartSvg(
        keepers.map((s) => ({ label: s.player.name, value: s.paradenquote, unit: '%' })), { unit: '%' }
      )));

      const kpMap = computeKeeperShotsByPosition(events);
      const kpEntries = POSITIONS.filter((p) => kpMap.has(p.id)).map((p) => {
        const m = kpMap.get(p.id);
        return { id: p.id, label: p.label, count: m.paraden, total: m.paraden + m.gegentore };
      });
      if (kpEntries.length) {
        grid.appendChild(card('Torwart: Paraden je Position', 'Kreisgröße = Anzahl Bälle · Zahl = Paraden/Bälle gesamt', shotCourtChartSvg(kpEntries, { color: '#3b82c4' })));
      }
    }

    // Kennzahlen-Übersicht oben
    const summary = el('div', { class: 'card', style: 'margin-bottom:14px;' }, [
      el('div', { class: 'row wrap', style: 'gap:8px;' }, [
        statBox(team.tore, 'Tore'), statBox(team.wurfquote + '%', 'Wurfquote'),
        statBox(team.siebenM_quote + '%', '7m Quote'), statBox(team.ballgewinne, 'Ballgewinne'),
        statBox(team.blocks, 'Blocks'), statBox(keeper.paraden + keeper.siebenM_paraden, 'Paraden gesamt'),
      ]),
    ]);

    const wrapper = el('div', {});
    wrapper.appendChild(summary);
    wrapper.appendChild(grid);
    return wrapper;
  }

  function statBox(val, label) {
    return el('div', { style: 'background:var(--bg-panel-2);border-radius:10px;padding:8px 14px;min-width:100px;' }, [
      el('div', { style: 'font-size:20px;font-weight:800;' }, String(val)),
      el('div', { style: 'font-size:11px;color:var(--text-dim);' }, label),
    ]);
  }

  // ============================================================
  // EINZELSPIELERAUSWERTUNG
  // ============================================================
  function buildPlayersSection(events, gameEventLists, lineup) {
    const playerStats = computePlayerStats(events, lineup);
    const fieldPlayers = playerStats.filter((s) => !s.player.isKeeper);
    const wrapper = el('div', {});
    const grid = el('div', { class: 'chart-grid' });

    // 10. Torschützinnen-Ranking
    const topScorers = fieldPlayers.slice().sort((a, b) => b.tore - a.tore).filter((s) => s.tore > 0).slice(0, 8);
    if (topScorers.length) {
      grid.appendChild(card('Torschützinnen-Ranking', 'Tore gesamt (Feld + 7m)', barChartSvg(
        topScorers.map((s) => ({ label: s.player.name, value: s.tore }))
      )));
    }

    // 11. Trefferquoten-Vergleich
    const withShots = fieldPlayers.filter((s) => s.wuerfe > 0).sort((a, b) => b.trefferquote - a.trefferquote).slice(0, 8);
    if (withShots.length) {
      grid.appendChild(card('Trefferquoten-Vergleich', 'Feldwurfquote je Spielerin', barChartSvg(
        withShots.map((s) => ({ label: s.player.name, value: s.trefferquote, unit: '%' })), { unit: '%' }
      )));
    }

    // 13. Anteil an Mannschaftstoren
    const scorers = fieldPlayers.filter((s) => s.tore > 0);
    if (scorers.length) {
      grid.appendChild(card('Anteil an Mannschaftstoren', 'Wer hat wie viele der Tore erzielt?', pieChartSvg(
        scorers.map((s, i) => ({ label: s.player.name, value: s.tore, color: colorFor(i) }))
      )));
    }

    wrapper.appendChild(grid);

    // 14. Disziplin-Tabelle
    const disciplineRows = playerStats.filter((s) => s.technischeFehler + s.gelb + s.zweiMin + s.rot > 0);
    if (disciplineRows.length) {
      const table = el('table', { class: 'stats' });
      table.appendChild(el('thead', {}, el('tr', {}, ['Name', 'Techn. Fehler', 'Gelb', '2 Min.', 'Rot'].map((h) => el('th', {}, h)))));
      const tbody = el('tbody');
      disciplineRows.sort((a, b) => (b.technischeFehler + b.gelb + b.zweiMin + b.rot) - (a.technischeFehler + a.gelb + a.zweiMin + a.rot))
        .forEach((s) => tbody.appendChild(el('tr', {}, [
          el('td', {}, s.player.name), el('td', {}, String(s.technischeFehler)),
          el('td', {}, String(s.gelb)), el('td', {}, String(s.zweiMin)), el('td', {}, String(s.rot)),
        ])));
      table.appendChild(tbody);
      wrapper.appendChild(el('div', { class: 'chart-card', style: 'margin-top:14px;' }, [
        el('h3', {}, 'Disziplin-Übersicht'),
        el('div', { class: 'table-wrap' }, table),
      ]));
    }

    // 12/15. Spieler-Detailkarte
    if (!selectedPlayerId && lineup.length) selectedPlayerId = lineup.slice().sort((a, b) => a.number - b.number)[0].id;
    const detailWrap = el('div', { class: 'chart-card', style: 'margin-top:14px;' });
    detailWrap.appendChild(el('h3', {}, 'Spieler-Detailkarte'));
    const select = el('select', { style: 'margin:8px 0 14px 0;max-width:320px;' },
      lineup.slice().sort((a, b) => a.number - b.number).map((p) => el('option', {
        value: p.id, ...(p.id === selectedPlayerId ? { selected: 'selected' } : {}),
      }, `#${p.number} ${p.name}${p.isKeeper ? ' 🧤' : ''}`)));
    select.onchange = (e) => { selectedPlayerId = e.target.value; build(); };
    detailWrap.appendChild(select);

    const sel = playerStats.find((s) => s.player.id === selectedPlayerId);
    if (sel) {
      const p = sel.player;
      const statsLine = p.isKeeper
        ? `Paraden: ${sel.paraden} · Gegentore: ${sel.gegentore} · 7m Paraden: ${sel.siebenM_paraden} · Paradenquote: ${sel.paradenquote}%`
        : `Tore: ${sel.tore} · Würfe: ${sel.wuerfe} · Quote: ${sel.trefferquote}% · 7m: ${sel.siebenM_tore}/${sel.siebenM_versuche} · Assists: ${sel.assists} · Ballgewinne: ${sel.ballgewinne} · Blocks: ${sel.blocks}`;
      detailWrap.appendChild(el('div', { style: 'margin-bottom:12px;font-size:13px;color:var(--text-dim);' }, statsLine));

      const playerEvents = events.filter((e) => e.playerId === selectedPlayerId);
      if (p.isKeeper) {
        const kpMap = computeKeeperShotsByPosition(playerEvents);
        const kpEntries = POSITIONS.filter((pos) => kpMap.has(pos.id)).map((pos) => {
          const m = kpMap.get(pos.id);
          return { id: pos.id, label: pos.label, count: m.paraden, total: m.paraden + m.gegentore };
        });
        if (kpEntries.length) {
          detailWrap.appendChild(el('div', { html: shotCourtChartSvg(kpEntries, { color: '#3b82c4' }) }));
        } else {
          detailWrap.appendChild(el('div', { class: 'empty-note' }, 'Keine Positionsdaten für diese Torhüterin erfasst.'));
        }
      } else {
        const posMap = computeShotsByPosition(playerEvents);
        const posEntries = POSITIONS.filter((pos) => posMap.has(pos.id)).map((pos) => {
          const m = posMap.get(pos.id);
          return { id: pos.id, label: pos.label, count: m.goals, total: m.attempts };
        });
        if (posEntries.length) {
          detailWrap.appendChild(el('div', { html: shotCourtChartSvg(posEntries, { color: '#2ea043' }) }));
        } else {
          detailWrap.appendChild(el('div', { class: 'empty-note' }, 'Keine Positionsdaten für diese Spielerin erfasst.'));
        }
      }

      // Saison: Entwicklung über die Spiele
      if (mode === 'season' && gameEventLists.length > 1) {
        const points = gameEventLists.map((x, i) => {
          const gLineup = lineup.filter((pl) => x.game.lineupPlayerIds.includes(pl.id));
          const gStats = computePlayerStats(x.events, gLineup).find((s) => s.player.id === selectedPlayerId);
          const val = p.isKeeper ? (gStats ? gStats.paradenquote : 0) : (gStats ? gStats.tore : 0);
          return { x: i + 1, y: val };
        });
        const label = p.isKeeper ? 'Paradenquote %' : 'Tore';
        detailWrap.appendChild(el('h3', { style: 'margin-top:16px;' }, `Entwicklung über die Saison (${label})`));
        detailWrap.appendChild(el('div', {
          html: lineChartSvg([{ points, color: '#3b82c4', label }], { xMax: points.length, yMax: Math.max(1, ...points.map((pt) => pt.y)) }),
        }));
      }
    }
    wrapper.appendChild(detailWrap);

    return wrapper;
  }
}
