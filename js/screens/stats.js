import { PlayersDB, GamesDB, EventsDB } from '../db.js';
import { el, toast, fmtDate, fmtTime } from '../ui.js';
import { computeScore, computePlayerStats, computeTeamStats, computeKeeperTeamStats } from '../stats.js';
import { eventTypeLabel, CATEGORY_LABEL } from '../models.js';
import { buildXlsx, downloadXlsx } from '../xlsx-writer.js';
import { buildPdf, downloadPdf } from '../pdf-writer.js';

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
        el('button', { class: 'btn', onclick: () => generateTrainerReport(game, allPlayers, events, playerStats, team, score) }, '📄 Trainerbericht (PDF)'),
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
    const cols = ['#', 'Name', 'Tore', 'Würfe', 'Quote', 'Fehlw.', '7m', 'Ass.', 'TF', 'BG', 'Blk', 'V7m', 'Gelb', '2\'', 'Rot', 'Par.', 'GegT', 'Par.%'];
    const table = el('table', { class: 'stats' });
    table.appendChild(el('thead', {}, el('tr', {}, cols.map((c) => el('th', {}, c)))));
    const tbody = el('tbody');
    playerStats.forEach((s) => {
      tbody.appendChild(el('tr', {}, [
        el('td', {}, String(s.player.number)),
        el('td', {}, [s.player.name, s.player.isKeeper ? el('span', { style: 'color:var(--blue);font-weight:800;' }, ' 🧤') : null]),
        el('td', {}, String(s.tore)),
        el('td', {}, String(s.wuerfe)),
        el('td', {}, s.player.isKeeper ? '–' : s.trefferquote + '%'),
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
        el('td', {}, String(s.paraden)),
        el('td', {}, String(s.gegentore)),
        el('td', {}, s.player.isKeeper ? s.paradenquote + '%' : '–'),
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
      'Verschuldete 7m', 'Gelbe Karten', '2 Minuten', 'Rote Karten', 'Paraden', 'Gegentore', '7m Paraden', 'Paradenquote (%)',
    ].map((h) => ({ v: h, bold: true }));
    const playerRows = [playerHeader, ...playerStats.map((s) => [
      s.player.number, s.player.isKeeper ? `${s.player.name} (TW)` : s.player.name,
      s.tore, s.wuerfe, s.player.isKeeper ? '' : s.trefferquote, s.fehlwuerfe, s.geblockt, s.pfosten,
      s.siebenM_tore, s.siebenM_versuche, s.assists, s.technischeFehler, s.ballgewinne, s.blocks,
      s.verschuldete7m, s.gelb, s.zweiMin, s.rot, s.paraden, s.gegentore, s.siebenM_paraden,
      s.player.isKeeper ? s.paradenquote : '',
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

  function generateTrainerReport(game, allPlayers, events, playerStats, team, score) {
    const halftimeScore = computeScore(events.filter((e) => e.half === 1));
    const keeper = computeKeeperTeamStats(events);

    // --- Seite 1: Spielübersicht + Mannschaft (Hochformat, A4) ---
    const ops1 = [];
    let y = 800;
    const addText1 = (text, { bold, size = 11, x = 45 } = {}) => {
      ops1.push({ type: 'text', x, y, size, text, font: bold ? 'F2' : 'F1' });
    };
    const line1 = (yy) => ops1.push({ type: 'line', x1: 45, y1: yy, x2: 550, y2: yy, width: 0.75 });

    addText1('Trainerbericht', { bold: true, size: 22 }); y -= 26;
    addText1(`${game.homeAway === 'home' ? 'Heimspiel gegen' : 'Auswärts bei'} ${game.opponent}`, { size: 13 }); y -= 18;
    addText1(`Datum: ${fmtDate(game.date)}`, { size: 11 }); y -= 16;
    line1(y + 6); y -= 20;

    addText1('Spielübersicht', { bold: true, size: 14 }); y -= 20;
    addText1(`Endstand: ${score.us} : ${score.them}`, { size: 12 }); y -= 16;
    addText1(`Halbzeitstand: ${halftimeScore.us} : ${halftimeScore.them}`, { size: 12 }); y -= 28;

    addText1('Mannschaft', { bold: true, size: 14 }); y -= 20;

    addText1('Angriff', { bold: true, size: 12 }); y -= 16;
    [
      `Würfe: ${team.wuerfe}    Tore: ${team.tore}    Wurfquote: ${team.wurfquote}%`,
      `Fehlwürfe: ${team.fehlwuerfe}    Technische Fehler: ${team.technischeFehler}`,
      `7m Tore/Versuche: ${team.siebenM_tore}/${team.siebenM_versuche}    7m Quote: ${team.siebenM_quote}%`,
    ].forEach((t) => { addText1(t, { size: 11 }); y -= 15; });
    y -= 8;

    addText1('Abwehr', { bold: true, size: 12 }); y -= 16;
    addText1(`Ballgewinne: ${team.ballgewinne}    Blocks: ${team.blocks}`, { size: 11 }); y -= 23;

    addText1('Torwart', { bold: true, size: 12 }); y -= 16;
    addText1(`Paraden: ${keeper.paraden}    Gegentore: ${keeper.gegentore}    7m Paraden: ${keeper.siebenM_paraden}`, { size: 11 }); y -= 23;

    addText1('Tempospiel', { bold: true, size: 12 }); y -= 16;
    [
      `Eigener Konter: ${team.konterEigenLaufen} gelaufen, ${team.konterEigenTor} Tore`,
      `Gegner-Konter (gegen uns): ${team.konterGegnerLaufen} Situationen, ${team.konterGegnerTor} Gegentore`,
      `Eigene 2. Welle: ${team.welleEigenLaufen} gelaufen, ${team.welleEigenTor} Tore`,
      `2. Welle Gegner (gegen uns): ${team.welleGegnerLaufen} Situationen, ${team.welleGegnerTor} Gegentore`,
    ].forEach((t) => { addText1(t, { size: 11 }); y -= 15; });

    const page1 = { width: 595, height: 842, ops: ops1 };

    // --- Seite 2: Spielerübersicht (Querformat für mehr Spalten) ---
    const ops2 = [];
    const pageW = 842, pageH = 595;
    let y2 = pageH - 45;
    ops2.push({ type: 'text', x: 40, y: y2, size: 16, font: 'F2',
      text: `Spielerübersicht - ${game.homeAway === 'home' ? 'vs' : '@'} ${game.opponent}` });
    y2 -= 28;

    const cols = [
      { key: 'number', label: '#', w: 20 },
      { key: 'name', label: 'Name', w: 108 },
      { key: 'tore', label: 'Tore', w: 32 },
      { key: 'wuerfe', label: 'Würfe', w: 36 },
      { key: 'trefferquote', label: 'Quote%', w: 40 },
      { key: 'siebenM', label: '7m T/V', w: 40 },
      { key: 'assists', label: 'Ass.', w: 30 },
      { key: 'technischeFehler', label: 'TF', w: 26 },
      { key: 'ballgewinne', label: 'BG', w: 26 },
      { key: 'blocks', label: 'Blk', w: 26 },
      { key: 'verschuldete7m', label: 'V7m', w: 30 },
      { key: 'gelb', label: 'Gelb', w: 30 },
      { key: 'zweiMin', label: "2'", w: 22 },
      { key: 'rot', label: 'Rot', w: 26 },
      { key: 'paraden', label: 'Par.', w: 28 },
      { key: 'gegentore', label: 'GegT', w: 32 },
      { key: 'paradenquote', label: 'Par.%', w: 36 },
    ];
    let x = 40;
    const colX = [];
    cols.forEach((c) => { colX.push(x); x += c.w; });
    const tableRight = x;

    cols.forEach((c, i) => ops2.push({ type: 'text', x: colX[i], y: y2, size: 8.5, font: 'F2', text: c.label }));
    y2 -= 6;
    ops2.push({ type: 'line', x1: 40, y1: y2, x2: tableRight, y2, width: 0.75 });
    y2 -= 14;

    playerStats.forEach((s) => {
      const values = {
        number: s.player.number, name: s.player.isKeeper ? `${s.player.name} (TW)` : s.player.name,
        tore: s.tore, wuerfe: s.wuerfe,
        trefferquote: s.player.isKeeper ? '-' : `${s.trefferquote}`, siebenM: `${s.siebenM_tore}/${s.siebenM_versuche}`,
        assists: s.assists, technischeFehler: s.technischeFehler, ballgewinne: s.ballgewinne,
        blocks: s.blocks, verschuldete7m: s.verschuldete7m, gelb: s.gelb, zweiMin: s.zweiMin,
        rot: s.rot, paraden: s.paraden, gegentore: s.gegentore,
        paradenquote: s.player.isKeeper ? `${s.paradenquote}` : '-',
      };
      cols.forEach((c, i) => ops2.push({ type: 'text', x: colX[i], y: y2, size: 9, text: String(values[c.key]) }));
      y2 -= 16;
    });

    const page2 = { width: pageW, height: pageH, ops: ops2 };

    const bytes = buildPdf([page1, page2]);
    const safeOpponent = game.opponent.replace(/[^a-zA-Z0-9äöüÄÖÜß]+/g, '-');
    downloadPdf(bytes, `Trainerbericht_${game.date}_${safeOpponent}.pdf`);
    toast('Trainerbericht wird gespeichert…');
  }
}
