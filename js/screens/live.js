import { PlayersDB, GamesDB, EventsDB } from '../db.js';
import { el, toast, fmtTime, openSheet } from '../ui.js';
import { CATEGORY, ACTIONS, TEMPO_TYPES, POSITIONS, SHOT_EVENTS_WITH_POSITION, uid } from '../models.js';
import { computeScore } from '../stats.js';

export function renderLive(root, { gameId }, nav) {
  let game, players, lineup, events = [];
  let activeTab = CATEGORY.ATTACK;
  let activePlayerId = null;
  let tickInterval = null;

  init();

  async function init() {
    [game, players, events] = await Promise.all([
      GamesDB.get(gameId),
      PlayersDB.all(),
      EventsDB.forGame(gameId),
    ]);
    if (!game) { nav.goHome(); return; }
    lineup = players.filter((p) => game.lineupPlayerIds.includes(p.id));
    events.sort((a, b) => a.ts - b.ts);
    build();
    tickInterval = setInterval(updateTimerDisplay, 1000);
  }

  function recentPlayerIds() {
    const seen = [];
    for (let i = events.length - 1; i >= 0; i--) {
      const pid = events[i].playerId;
      if (pid && !seen.includes(pid)) seen.push(pid);
      if (seen.length >= 4) break;
    }
    return seen;
  }

  function currentMatchSeconds() {
    let s = game.timerBaseSeconds || 0;
    if (game.timerRunning && game.timerStartedAt) s += (Date.now() - game.timerStartedAt) / 1000;
    return Math.floor(s);
  }

  function updateTimerDisplay() {
    const elm = document.getElementById('live-timer');
    if (elm) elm.textContent = fmtTime(currentMatchSeconds());
  }

  async function saveEvent(partial) {
    const event = {
      id: uid(),
      gameId,
      ts: Date.now(),
      matchSeconds: currentMatchSeconds(),
      half: game.half,
      playerId: activePlayerId || null,
      position: null,
      result: null,
      ...partial,
    };
    events.push(event);
    await EventsDB.save(event);
    activePlayerId = null;
    build();
  }

  async function undoLast() {
    if (events.length === 0) return;
    const last = events.pop();
    await EventsDB.remove(last.id);
    build();
    toast('Rückgängig gemacht');
  }

  async function toggleTimer() {
    if (game.timerRunning) {
      game.timerBaseSeconds = currentMatchSeconds();
      game.timerRunning = false;
      game.timerStartedAt = null;
    } else {
      game.timerRunning = true;
      game.timerStartedAt = Date.now();
    }
    await GamesDB.save(game);
    build();
  }

  async function switchHalf() {
    game.half = game.half === 1 ? 2 : 1;
    await GamesDB.save(game);
    build();
  }

  async function endGame() {
    if (!confirm('Spiel wirklich beenden? Danach keine weiteren Eingaben mehr möglich.')) return;
    game.status = 'finished';
    game.timerRunning = false;
    await GamesDB.save(game);
    nav.goStats(gameId);
  }

  function pickPositionThenSave(basePartial) {
    openSheet((sheet, close) => {
      sheet.appendChild(el('h2', {}, 'Wurfposition (optional)'));
      const grid = el('div', { class: 'action-grid', style: 'margin-top:10px;' });
      POSITIONS.forEach((pos) => {
        grid.appendChild(el('button', {
          class: 'action-tile blue',
          onclick: () => { close(); saveEvent({ ...basePartial, position: pos.id }); },
        }, pos.label));
      });
      sheet.appendChild(grid);
      sheet.appendChild(el('button', {
        class: 'btn btn-ghost btn-block', style: 'margin-top:10px;',
        onclick: () => { close(); saveEvent(basePartial); },
      }, 'Ohne Position speichern'));
    });
  }

  function pickTempoResult(tempoType) {
    openSheet((sheet, close) => {
      sheet.appendChild(el('h2', {}, tempoType.label));
      sheet.appendChild(el('div', { class: 'row', style: 'margin-top:10px;' }, [
        el('button', {
          class: 'btn btn-primary btn-lg', style: 'flex:1',
          onclick: () => { close(); saveEvent({ category: CATEGORY.TEMPO, type: tempoType.id, result: 'goal', playerId: null }); },
        }, 'Tor'),
        el('button', {
          class: 'btn btn-lg', style: 'flex:1',
          onclick: () => { close(); saveEvent({ category: CATEGORY.TEMPO, type: tempoType.id, result: 'no_goal', playerId: null }); },
        }, 'Kein Tor'),
      ]));
    });
  }

  function handleActionTap(action) {
    if (activeTab !== CATEGORY.TEMPO && !activePlayerId) {
      toast('Zuerst Spielerin auswählen');
      return;
    }
    const base = { category: activeTab, type: action.id };
    if (SHOT_EVENTS_WITH_POSITION.includes(action.id)) {
      pickPositionThenSave(base);
    } else {
      saveEvent(base);
    }
  }

  function actionLabel(e) {
    const all = [...ACTIONS[CATEGORY.ATTACK], ...ACTIONS[CATEGORY.DEFENSE], ...ACTIONS[CATEGORY.KEEPER]];
    if (e.category === CATEGORY.TEMPO) {
      const t = TEMPO_TYPES.find((x) => x.id === e.type);
      return `${t ? t.label : e.type} (${e.result === 'goal' ? 'Tor' : 'kein Tor'})`;
    }
    const a = all.find((x) => x.id === e.type);
    return a ? a.label : e.type;
  }

  function playerName(id) {
    const p = players.find((pl) => pl.id === id);
    return p ? `#${p.number} ${p.name}` : '';
  }

  function build() {
    root.innerHTML = '';
    const score = computeScore(events);
    const recents = recentPlayerIds();

    const screen = el('div', { class: 'screen', style: 'padding:10px;gap:8px;' });

    // --- Top bar ---
    const top = el('div', { class: 'live-top' }, [
      el('button', { class: 'btn-ghost btn', onclick: () => nav.goHome() }, '← Home'),
      el('div', { class: 'score' }, [
        el('span', {}, `${score.us}`), el('span', {}, ' : '), el('span', { class: 'them' }, `${score.them}`),
      ]),
      el('span', { style: 'color:var(--text-dim);font-size:14px;' }, `vs ${game.opponent}`),
      el('div', { class: 'spacer' }),
      el('span', { class: 'half-badge' }, `HZ ${game.half}`),
      el('button', { class: 'btn-ghost btn', onclick: switchHalf }, 'Halbzeit'),
      el('span', { id: 'live-timer', class: 'timer' }, fmtTime(currentMatchSeconds())),
      el('button', { class: `btn ${game.timerRunning ? 'btn-danger' : 'btn-primary'}`, onclick: toggleTimer }, game.timerRunning ? '⏸' : '▶'),
      el('button', { class: 'btn btn-danger', onclick: endGame }, 'Spiel beenden'),
    ]);
    screen.appendChild(top);

    // --- Letzte Aktionen + Undo ---
    const recentBox = el('div', { class: 'card', style: 'padding:8px 12px;' }, [
      el('div', { class: 'row' }, [
        el('h2', {}, 'Letzte Aktionen'),
        el('div', { class: 'spacer' }),
        el('button', { class: 'btn btn-ghost', onclick: undoLast, ...(events.length === 0 ? { disabled: 'disabled' } : {}) }, '↩ Undo'),
      ]),
      el('div', { class: 'recent-actions' },
        events.slice(-5).reverse().map((e) => el('div', { class: 'recent-action-item' }, [
          el('span', {}, `${e.playerId ? playerName(e.playerId) + ' – ' : ''}${actionLabel(e)}`),
          el('span', {}, fmtTime(e.matchSeconds)),
        ]))),
    ]);
    screen.appendChild(recentBox);

    // --- Tabs ---
    const tabsDef = [
      { id: CATEGORY.ATTACK, label: 'Angriff' },
      { id: CATEGORY.DEFENSE, label: 'Abwehr' },
      { id: CATEGORY.KEEPER, label: 'Torwart' },
      { id: CATEGORY.TEMPO, label: 'Tempo' },
    ];
    const tabs = el('div', { class: 'tabs' }, tabsDef.map((t) => el('button', {
      class: `tab ${activeTab === t.id ? 'active' : ''}`,
      onclick: () => { activeTab = t.id; activePlayerId = null; build(); },
    }, t.label)));
    screen.appendChild(tabs);

    // --- Spieler-Grid (nicht bei Tempo) ---
    if (activeTab !== CATEGORY.TEMPO) {
      const ordered = [
        ...recents.map((id) => lineup.find((p) => p.id === id)).filter(Boolean),
        ...lineup.filter((p) => !recents.includes(p.id)).sort((a, b) => a.number - b.number),
      ];
      const grid = el('div', { class: 'player-grid' }, ordered.map((p) => el('button', {
        class: `player-tile ${recents.includes(p.id) ? 'recent' : ''} ${activePlayerId === p.id ? 'active' : ''}`,
        onclick: () => { activePlayerId = activePlayerId === p.id ? null : p.id; build(); },
      }, [
        el('div', { class: 'num' }, String(p.number)),
        el('div', { class: 'name' }, p.name),
      ])));
      screen.appendChild(grid);
    } else {
      screen.appendChild(el('div', { style: 'color:var(--text-dim);font-size:13px;' }, 'Tempospiel ist teambezogen – keine Spielerauswahl nötig.'));
    }

    // --- Aktionen ---
    if (activeTab === CATEGORY.TEMPO) {
      const grid = el('div', { class: 'action-grid' }, TEMPO_TYPES.map((t) => el('button', {
        class: 'action-tile blue',
        onclick: () => pickTempoResult(t),
      }, t.label)));
      screen.appendChild(grid);
    } else {
      const grid = el('div', { class: 'action-grid' }, ACTIONS[activeTab].map((a) => el('button', {
        class: `action-tile ${a.color}`,
        onclick: () => handleActionTap(a),
      }, a.label)));
      screen.appendChild(grid);
    }

    root.appendChild(screen);
  }

  return () => { if (tickInterval) clearInterval(tickInterval); };
}
