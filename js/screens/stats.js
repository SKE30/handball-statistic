import { PlayersDB, GamesDB, EventsDB } from '../db.js';
import { el, toast, fmtDate, fmtTime } from '../ui.js';
import { computeScore, computePlayerStats, computeTeamStats } from '../stats.js';
import { eventTypeLabel, CATEGORY_LABEL } from '../models.js';
import { buildXlsx, downloadXlsx } from '../xlsx-writer.js';

export function renderStats(root, { gameId }, nav) {
  build();

  async function build() {
    root.innerHTML = '';
    const [game, allPlayers, events] = await Promise.all([
      GamesDB.get(gameId), PlayersDB.all(), EventsDB.forGame(gameId),
    ]);
    if (!game) { nav.goHome(); return; }
    const lineup = allPlayers.filter((p) => game.lineupPlayerIds.includes(p.id));
    const score = computeScore(events);
    const playerStats = computePlayerStats(events, lineup).sort((a, b) => b.tore - a.tore);
    const team = computeTeamStats(events);

    const screen = el('div', { class: 'screen' });
    screen.appendChild(el('div', { class: 'row' }, [
      el('button', { class: 'btn-ghost btn', onclick: () => nav.goHome() }, '← Home'),
      el('h1', {}, `${game.homeAway === 'home' ? 'vs' : '@'} ${game.opponent}`),
      el('span', { style: 'color:var(--text-dim);' }, fmtDate(game.date)),
    ]));

    screen.appendChild(el('div', { class: 'card', style: 'text-align:center;' }, [
      el('div', { class: 'score', style: 'font-size:44px;' }, `${score.us} : ${score.them}`),
      el('div', { class: 'row', style: 'justify-content:center;margin-top:10px;gap:10px;' }, [
        game.status !== 'finished'
          ? el('button', { class: 'btn btn-primary', onclick: () => nav.goLive(gameId) }, 'Zurück zur Live-Erfassung')
          : el('span', { class: 'pill finished' }, 'BEENDET'),
        el('button', { class: 'btn', onclick: () => exportExcel(game, allPlayers, events, playerStats, team, score) }, '📊 Als Excel exportieren (.xlsx)'),
      ]),
    ]));

    // --- Mannschaftsstatistik ---
    const teamCard = el('div', { class: 'card' });
    teamCard.appendChild(el('h2', {}, 'Mannschaft'));
    const teamRows = [
      ['Würfe', team.wuerfe], ['Tore', team.tore], ['Wurfquote', team.wurfquote + '%'],
      ['Fehlwürfe', team.fehlwuerfe], ['Technische Fehler', team.technischeFehler],
      ['Ballgewinne', team.ballgewinne], ['Blocks', team.blocks],
      ['7m Tore/Versuche', `${team.siebenM_tore}/${team.siebenM_versuche}`], ['7m Quote', team.siebenM_quote + '%'],
      ['Konter (gelaufen/Tor)', `${team.konterEigenLaufen}/${team.konterEigenTor}`],
      ['Gegner-Konter (gegen uns/Tor)', `${team.konterGegnerLaufen}/${team.konterGegnerTor}`],
      ['2. Welle (gelaufen/Tor)', `${team.welleEigenLaufen}/${team.welleEigenTor}`],
      ['2. Welle Gegner (gegen uns/Tor)', `${team.welleGegnerLaufen}/${team.welleGegnerTor}`],
    ];
    const teamGrid = el('div', { class: 'row wrap', style: 'gap:8px;margin-top:8px;' });
    teamRows.forEach(([label, val]) => {
      teamGrid.appendChild(el('div', { style: 'background:var(--bg-panel-2);border-radius:10px;padding:8px 12px;min-width:130px;' }, [
        el('div', { style: 'font-size:20px;font-weight:800;' }, String(val)),
        el('div', { style: 'font-size:11px;color:var(--text-dim);' }, label),
      ]));
    });
    teamCard.appendChild(teamGrid);
    screen.appendChild(teamCard);

    // --- Spielerstatistik ---
    const playerCard = el('div', { class: 'card' });
    playerCard.appendChild(el('h2', {}, 'Spielerinnen'));
    const cols = ['#', 'Name', 'Tore', 'Würfe', 'Quote', 'Fehlw.', '7m', 'Ass.', 'TF', 'BG', 'Blk', 'V7m', 'Gelb', '2\'', 'Rot'];
    const table = el('table', { class: 'stats' });
    table.appendChild(el('thead', {}, el('tr', {}, cols.map((c) => el('th', {}, c)))));
    const tbody = el('tbody');
    playerStats.forEach((s) => {
      tbody.appendChild(el('tr', {}, [
        el('td', {}, String(s.player.number)),
        el('td', {}, s.player.name),
        el('td', {}, String(s.tore)),
        el('td', {}, String(s.wuerfe)),
        el('td', {}, s.trefferquote + '%'),
        el('td', {}, String(s.fehlwuerfe)),
        el('td', {}, `${s.siebenM_tore}/${s.siebenM_versuche}`),
        el('td', {}, String(s.assists)),
        el('td', {}, String(s.technischeFehler)),
        el('td', {}, String(s.ballgewinne)),
        el('td', {}, String(s.blocks)),
        el('td', {}, String(s.verschuldete7m)),
        el('td', {}, String(s.gelb)),
        el('td', {}, String(s.zweiMin)),
        el('td', {}, String(s.rot)),
      ]));
    });
    table.appendChild(tbody);
    playerCard.appendChild(el('div', { class: 'table-wrap' }, table));
    screen.appendChild(playerCard);

    root.appendChild(screen);
  }

  function exportExcel(game, allPlayers, events, playerStats, team, score) {
    const playerName = (id) => {
      const p = allPlayers.find((pl) => pl.id === id);
      return p ? `#${p.number} ${p.name}` : '';
    };

    const teamRows = [
      [{ v: `Spiel: ${game.homeAway === 'home' ? 'vs' : '@'} ${game.opponent}`, bold: true }],
      [`Datum: ${fmtDate(game.date)}`],
      [`Heim/Auswärts: ${game.homeAway === 'home' ? 'Heim' : 'Auswärts'}`],
      [`Endergebnis: ${score.us} : ${score.them}`],
      [],
      [{ v: 'Kennzahl', bold: true }, { v: 'Wert', bold: true }],
      ['Würfe gesamt', team.wuerfe],
      ['Tore', team.tore],
      ['Wurfquote (%)', team.wurfquote],
      ['Fehlwürfe', team.fehlwuerfe],
      ['Technische Fehler', team.technischeFehler],
      ['Ballgewinne', team.ballgewinne],
      ['Blocks', team.blocks],
      ['7m Tore', team.siebenM_tore],
      ['7m Versuche', team.siebenM_versuche],
      ['7m Quote (%)', team.siebenM_quote],
      ['Eigener Konter – gelaufen', team.konterEigenLaufen],
      ['Eigener Konter – Tore', team.konterEigenTor],
      ['Gegner-Konter (gegen uns) – Situationen', team.konterGegnerLaufen],
      ['Gegner-Konter (gegen uns) – Gegentore', team.konterGegnerTor],
      ['Eigene 2. Welle – gelaufen', team.welleEigenLaufen],
      ['Eigene 2. Welle – Tore', team.welleEigenTor],
      ['2. Welle Gegner – Situationen', team.welleGegnerLaufen],
      ['2. Welle Gegner – Gegentore', team.welleGegnerTor],
    ];

    const playerHeader = [
      '#', 'Name', 'Tore', 'Würfe', 'Quote (%)', 'Fehlwürfe', 'Geblockt', 'Pfosten/Latte',
      '7m Tore', '7m Versuche', 'Assists', 'Technische Fehler', 'Ballgewinne', 'Blocks',
      'Verschuldete 7m', 'Gelbe Karten', '2 Minuten', 'Rote Karten', 'Paraden', 'Gegentore', '7m Paraden',
    ].map((h) => ({ v: h, bold: true }));
    const playerRows = [playerHeader, ...playerStats.map((s) => [
      s.player.number, s.player.name, s.tore, s.wuerfe, s.trefferquote, s.fehlwuerfe, s.geblockt, s.pfosten,
      s.siebenM_tore, s.siebenM_versuche, s.assists, s.technischeFehler, s.ballgewinne, s.blocks,
      s.verschuldete7m, s.gelb, s.zweiMin, s.rot, s.paraden, s.gegentore, s.siebenM_paraden,
    ])];

    const eventHeader = ['Uhrzeit', 'Halbzeit', 'Spielzeit', 'Kategorie', 'Aktion', 'Spielerin', 'Position', 'Ergebnis']
      .map((h) => ({ v: h, bold: true }));
    const eventRows = [eventHeader, ...events.slice().sort((a, b) => a.ts - b.ts).map((e) => [
      new Date(e.ts).toLocaleTimeString('de-DE'),
      e.half,
      fmtTime(e.matchSeconds),
      CATEGORY_LABEL[e.category] || e.category,
      eventTypeLabel(e),
      e.playerId ? playerName(e.playerId) : '',
      e.position || '',
      e.result === 'goal' ? 'Tor' : e.result === 'no_goal' ? 'kein Tor' : '',
    ])];

    const bytes = buildXlsx([
      { name: 'Mannschaft', rows: teamRows },
      { name: 'Spielerinnen', rows: playerRows },
      { name: 'Events', rows: eventRows },
    ]);
    const safeOpponent = game.opponent.replace(/[^a-zA-Z0-9äöüÄÖÜß]+/g, '-');
    downloadXlsx(bytes, `Spiel_${game.date}_${safeOpponent}.xlsx`);
    toast('Excel-Datei wird gespeichert…');
  }
}
