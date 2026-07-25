import { PlayersDB, GamesDB } from '../db.js';
import { el, toast, fmtDate, openSheet } from '../ui.js';
import { uid } from '../models.js';

export function renderHome(root, params, nav) {
  build();

  async function build() {
    root.innerHTML = '';
    const screen = el('div', { class: 'screen' });
    screen.appendChild(el('h1', {}, '🤾 Handball Scouting'));

    const [players, games] = await Promise.all([PlayersDB.all(), GamesDB.all()]);

    // --- Kader-Karte ---
    const rosterCard = el('div', { class: 'card' });
    rosterCard.appendChild(el('div', { class: 'row' }, [
      el('h2', {}, `Kader (${players.length})`),
      el('div', { class: 'spacer' }),
      el('button', { class: 'btn', onclick: () => openAddPlayer() }, '+ Spielerin'),
    ]));
    const list = el('div', { class: 'player-list' });
    if (players.length === 0) {
      list.appendChild(el('div', { style: 'color:var(--text-dim);padding:8px;' }, 'Noch keine Spielerinnen angelegt.'));
    }
    players.sort((a, b) => a.number - b.number).forEach((p) => {
      list.appendChild(el('div', { class: 'player-row' }, [
        el('div', { class: 'player-num' }, String(p.number)),
        el('div', { class: 'spacer' }, [
          el('span', {}, p.name),
          p.isKeeper ? el('span', { class: 'pill', style: 'background:var(--blue);margin-left:8px;' }, '🧤 TW') : null,
        ]),
        el('button', {
          class: 'btn-ghost btn',
          style: p.isKeeper ? 'border-color:var(--blue);color:var(--blue);' : '',
          onclick: () => toggleKeeper(p),
        }, 'TW'),
        el('button', { class: 'btn-ghost btn', onclick: () => removePlayer(p) }, '🗑'),
      ]));
    });
    rosterCard.appendChild(list);
    screen.appendChild(rosterCard);

    // --- Neues Spiel ---
    screen.appendChild(el('button', {
      class: 'btn btn-primary btn-block btn-lg',
      onclick: () => nav.goSetup(),
    }, '+ Neues Spiel anlegen'));

    screen.appendChild(el('button', {
      class: 'btn btn-block',
      onclick: () => nav.goAnalytics(),
    }, '📈 Auswertung (Saison & Einzelspiele)'));

    // --- Spielliste ---
    const gamesCard = el('div', { class: 'card' });
    gamesCard.appendChild(el('h2', {}, 'Spiele'));
    if (games.length === 0) {
      gamesCard.appendChild(el('div', { style: 'color:var(--text-dim);padding:8px;' }, 'Noch keine Spiele.'));
    }
    games.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).forEach((g) => {
      const pillClass = g.status === 'live' ? 'live' : g.status === 'finished' ? 'finished' : 'setup';
      const pillLabel = g.status === 'live' ? 'LIVE' : g.status === 'finished' ? 'BEENDET' : 'GEPLANT';
      gamesCard.appendChild(el('button', {
        class: 'btn btn-block row',
        style: 'justify-content:flex-start;text-align:left;',
        onclick: () => (g.status === 'finished' ? nav.goStats(g.id) : nav.goLive(g.id)),
      }, [
        el('span', { class: `pill ${pillClass}` }, pillLabel),
        el('span', {}, `${g.homeAway === 'home' ? 'vs' : '@'} ${g.opponent}`),
        el('div', { class: 'spacer' }),
        el('span', { style: 'color:var(--text-dim);font-weight:400;' }, fmtDate(g.date)),
      ]));
    });
    screen.appendChild(gamesCard);

    root.appendChild(screen);
  }

  function openAddPlayer() {
    openSheet((sheet, close) => {
      sheet.appendChild(el('h2', {}, 'Neue Spielerin'));
      const numInput = el('input', { type: 'number', placeholder: 'Rückennummer', inputmode: 'numeric', style: 'margin:10px 0;width:100%;' });
      const nameInput = el('input', { type: 'text', placeholder: 'Name', style: 'margin-bottom:14px;width:100%;' });
      let isKeeper = false;
      const keeperBtn = el('button', { class: 'btn btn-block' }, '🧤 Ist Torhüterin');
      keeperBtn.onclick = () => {
        isKeeper = !isKeeper;
        keeperBtn.className = isKeeper ? 'btn btn-primary btn-block' : 'btn btn-block';
      };
      sheet.appendChild(numInput);
      sheet.appendChild(nameInput);
      sheet.appendChild(el('div', { style: 'margin-bottom:14px;' }, keeperBtn));
      sheet.appendChild(el('button', {
        class: 'btn btn-primary btn-block',
        onclick: async () => {
          const number = parseInt(numInput.value, 10);
          const name = nameInput.value.trim();
          if (!name || Number.isNaN(number)) { toast('Rückennummer und Name angeben'); return; }
          await PlayersDB.save({ id: uid(), number, name, isKeeper });
          close();
          build();
        },
      }, 'Speichern'));
    });
  }

  async function toggleKeeper(p) {
    p.isKeeper = !p.isKeeper;
    await PlayersDB.save(p);
    build();
  }

  async function removePlayer(p) {
    if (!confirm(`${p.name} aus dem Kader entfernen?`)) return;
    await PlayersDB.remove(p.id);
    build();
  }
}
