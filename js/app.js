import { renderHome } from './screens/home.js';
import { renderSetup } from './screens/setup.js';
import { renderLive } from './screens/live.js';
import { renderStats } from './screens/stats.js';
import { renderAnalytics } from './screens/analytics.js';

const root = document.getElementById('app');

// Globaler, sehr einfacher State: nur die aktuelle "Route"
export const nav = {
  goHome: () => render('home'),
  goSetup: () => render('setup'),
  goLive: (gameId) => render('live', { gameId }),
  goStats: (gameId) => render('stats', { gameId }),
  goAnalytics: (gameId) => render('analytics', { gameId }),
};

let currentCleanup = null;

function render(route, params = {}) {
  if (currentCleanup) { try { currentCleanup(); } catch (e) {} currentCleanup = null; }
  root.innerHTML = '';
  const screens = { home: renderHome, setup: renderSetup, live: renderLive, stats: renderStats, analytics: renderAnalytics };
  const fn = screens[route];
  currentCleanup = fn(root, params, nav) || null;
}

// Start
nav.goHome();

// Service Worker registrieren (Offline-Fähigkeit)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {
      // Offline-Cache ist ein Bonus - App funktioniert dank IndexedDB auch ohne SW-Cache-Hit,
      // solange die Seite schon einmal geladen wurde.
    });
  });
}
