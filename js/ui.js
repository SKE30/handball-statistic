export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (k === 'html') node.innerHTML = v;
    else node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

export function toast(msg) {
  const t = el('div', { class: 'toast' }, msg);
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 1400);
}

/** Bottom-Sheet Overlay. Gibt eine close()-Funktion zurück. */
export function openSheet(contentBuilder) {
  const overlay = el('div', { class: 'overlay' });
  const sheet = el('div', { class: 'sheet' });
  overlay.appendChild(sheet);
  const close = () => overlay.remove();
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  contentBuilder(sheet, close);
  document.body.appendChild(overlay);
  return close;
}

export function fmtTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const s = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('de-DE');
}
