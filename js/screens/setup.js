import { PlayersDB, GamesDB } from '../db.js';
import { el, toast } from '../ui.js';
import { uid } from '../models.js';

export function renderSetup(root, params, nav) {
  build();

  async function build() {
    root.innerHTML = '';
    const players = await PlayersDB.all();
    players.sort((a, b) => a.number - b.number);

    const selected = new Set(players.map((p) => p.id)); // standardmäßig alle ausgewählt

    const screen = el('div', { class: 'screen' });
    screen.appendChild(el('div', { class: 'row' }, [
      el('button', { class: 'btn-ghost btn', onclick: () => nav.goHome() }, '← Zurück'),
      el('h1', {}, 'Neues Spiel'),
    ]));

    const dateInput = el('input', { type: 'date', value: new Date().toISOString().slice(0, 10) });
    const opponentInput = el('input', { type: 'text', placeholder: 'Gegner' });

    let homeAway = 'home';
    const homeBtn = el('button', { class: 'btn btn-primary', style: 'flex:1' }, 'Heim');
    const awayBtn = el('button', { class: 'btn', style: 'flex:1' }, 'Auswärts');
    homeBtn.onclick = () => { homeAway = 'home'; homeBtn.className = 'btn btn-primary'; awayBtn.className = 'btn'; homeBtn.style.flex = '1'; awayBtn.style.flex = '1'; };
    awayBtn.onclick = () => { homeAway = 'away'; awayBtn.className = 'btn btn-primary'; homeBtn.className = 'btn'; homeBtn.style.flex = '1'; awayBtn.style.flex = '1'; };

    const infoCard = el('div', { class: 'card' }, [
      el('h2', {}, 'Spielinfo'),
      el('div', { class: 'row wrap', style: 'margin-top:8px;' }, [dateInput, opponentInput]),
      el('div', { class: 'row', style: 'margin-top:8px;' }, [homeBtn, awayBtn]),
    ]);
    screen.appendChild(infoCard);

    const rosterCard = el('div', { class: 'card' });
    rosterCard.appendChild(el('h2', {}, `Kader für dieses Spiel (${selected.size}/${players.length})`));
    const list = el('div', { class: 'player-list' });
    if (players.length === 0) {
      list.appendChild(el('div', { style: 'color:var(--text-dim);padding:8px;' }, 'Kein Kader vorhanden – bitte zuerst auf der Startseite Spielerinnen anlegen.'));
    }
    players.forEach((p) => {
      const row = el('div', { class: 'player-row selected' }, [
        el('div', { class: 'player-num' }, String(p.number)),
        el('div', { class: 'spacer' }, p.name),
        el('span', {}, '✓'),
      ]);
      row.onclick = () => {
        if (selected.has(p.id)) { selected.delete(p.id); row.classList.remove('selected'); row.lastChild.textContent = ''; }
        else { selected.add(p.id); row.classList.add('selected'); row.lastChild.textContent = '✓'; }
        rosterCard.firstChild.textContent = `Kader für dieses Spiel (${selected.size}/${players.length})`;
      };
      list.appendChild(row);
    });
    rosterCard.appendChild(list);
    screen.appendChild(rosterCard);

    screen.appendChild(el('button', {
      class: 'btn btn-primary btn-block btn-lg',
      onclick: async () => {
        if (!opponentInput.value.trim()) { toast('Bitte Gegner eingeben'); return; }
        if (selected.size === 0) { toast('Bitte mindestens eine Spielerin wählen'); return; }
        const game = {
          id: uid(),
          date: dateInput.value,
          opponent: opponentInput.value.trim(),
          homeAway,
          status: 'live',
          half: 1,
          timerRunning: false,
          timerBaseSeconds: 0,
          timerStartedAt: null,
          lineupPlayerIds: Array.from(selected),
          createdAt: Date.now(),
        };
        await GamesDB.save(game);
        nav.goLive(game.id);
      },
    }, 'Spiel starten →'));

    root.appendChild(screen);
  }
}
