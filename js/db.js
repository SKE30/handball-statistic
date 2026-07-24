// ============================================================
// IndexedDB Wrapper - schlank, nativ, promise-basiert
// ============================================================

const DB_NAME = 'handballScoutDB';
const DB_VERSION = 1;

let dbInstance = null;

export function openDB() {
  if (dbInstance) return Promise.resolve(dbInstance);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('players')) {
        db.createObjectStore('players', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('games')) {
        db.createObjectStore('games', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('events')) {
        const store = db.createObjectStore('events', { keyPath: 'id' });
        store.createIndex('gameId', 'gameId', { unique: false });
      }
    };

    req.onsuccess = (e) => {
      dbInstance = e.target.result;
      resolve(dbInstance);
    };
    req.onerror = (e) => reject(e.target.error);
  });
}

function tx(db, storeName, mode) {
  return db.transaction(storeName, mode).objectStore(storeName);
}

// --- generische Helfer ---

async function put(storeName, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = tx(db, storeName, 'readwrite').put(value);
    req.onsuccess = () => resolve(value);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function del(storeName, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = tx(db, storeName, 'readwrite').delete(id);
    req.onsuccess = () => resolve();
    req.onerror = (e) => reject(e.target.error);
  });
}

async function getAll(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = tx(db, storeName, 'readonly').getAll();
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function get(storeName, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = tx(db, storeName, 'readonly').get(id);
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function getByIndex(storeName, indexName, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const idx = tx(db, storeName, 'readonly').index(indexName);
    const req = idx.getAll(value);
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

// --- Spieler (Kader) ---
export const PlayersDB = {
  all: () => getAll('players'),
  save: (player) => put('players', player),
  remove: (id) => del('players', id),
};

// --- Spiele ---
export const GamesDB = {
  all: () => getAll('games'),
  get: (id) => get('games', id),
  save: (game) => put('games', game),
  remove: (id) => del('games', id),
};

// --- Events ---
export const EventsDB = {
  forGame: (gameId) => getByIndex('events', 'gameId', gameId),
  save: (event) => put('events', event), // sofortiges, synchrones Schreiben je Aktion
  remove: (id) => del('events', id),
};
