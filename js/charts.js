// ============================================================
// Minimale SVG-Chart-Bausteine — KEINE externe Bibliothek, kein CDN.
// Geben fertige SVG-Markup-Strings zurück, die per el('div',{html: ...})
// eingefügt werden. Gleiche Offline-Philosophie wie xlsx-writer/pdf-writer.
// ============================================================

const PALETTE = ['#3b82c4', '#2ea043', '#e08a2c', '#d3363a', '#d8b31a', '#8b6fd8', '#4b5560', '#2fb6a8'];

function esc(str) {
  return String(str).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
}

export function colorFor(i) { return PALETTE[i % PALETTE.length]; }

/** Einfaches vertikales Balkendiagramm. items: [{label, value, color?}] */
export function barChartSvg(items, { width = 640, height = 240, unit = '', showLabels = true } = {}) {
  const padL = 8, padR = 8, padT = 22, padB = showLabels ? 34 : 10;
  const chartW = width - padL - padR;
  const chartH = height - padT - padB;
  const max = Math.max(1, ...items.map((i) => i.value));
  const n = Math.max(1, items.length);
  const slot = chartW / n;
  const barW = Math.min(58, slot * 0.6);

  let bars = '';
  items.forEach((it, i) => {
    const h = (it.value / max) * chartH;
    const x = padL + i * slot + (slot - barW) / 2;
    const y = padT + chartH - h;
    const color = it.color || colorFor(i);
    bars += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(0, h).toFixed(1)}" rx="4" fill="${color}"/>`;
    bars += `<text x="${(x + barW / 2).toFixed(1)}" y="${(y - 6).toFixed(1)}" font-size="12" fill="#f2f4f6" text-anchor="middle" font-weight="700">${esc(it.valueLabel ?? it.value)}${it.valueLabel ? '' : unit}</text>`;
    if (showLabels) {
      bars += `<text x="${(x + barW / 2).toFixed(1)}" y="${(padT + chartH + 16).toFixed(1)}" font-size="10.5" fill="#9aa5b1" text-anchor="middle">${esc(it.label)}</text>`;
    }
  });
  const axisY = padT + chartH;
  return `<svg viewBox="0 0 ${width} ${height}" style="width:100%;height:auto;display:block;">` +
    `<line x1="${padL}" y1="${axisY}" x2="${width - padR}" y2="${axisY}" stroke="#333c46" stroke-width="1"/>` +
    bars + `</svg>`;
}

/** Gruppiertes Balkendiagramm für Vergleiche (z. B. HZ1 vs HZ2, Eigen vs Gegner). groups: [{label, values:[{value,color,name}]}] */
export function groupedBarChartSvg(groups, { width = 640, height = 240, legend = [] } = {}) {
  const padL = 8, padR = 8, padT = 22, padB = 34;
  const chartW = width - padL - padR;
  const chartH = height - padT - padB;
  const seriesCount = groups[0]?.values.length || 1;
  const max = Math.max(1, ...groups.flatMap((g) => g.values.map((v) => v.value)));
  const n = Math.max(1, groups.length);
  const slot = chartW / n;
  const groupW = Math.min(80, slot * 0.7);
  const barW = groupW / seriesCount - 4;

  let bars = '';
  groups.forEach((g, gi) => {
    const groupX = padL + gi * slot + (slot - groupW) / 2;
    g.values.forEach((v, si) => {
      const h = (v.value / max) * chartH;
      const x = groupX + si * (barW + 4);
      const y = padT + chartH - h;
      bars += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(0, h).toFixed(1)}" rx="3" fill="${v.color}"/>`;
      bars += `<text x="${(x + barW / 2).toFixed(1)}" y="${(y - 5).toFixed(1)}" font-size="10.5" fill="#f2f4f6" text-anchor="middle" font-weight="700">${esc(v.value)}</text>`;
    });
    bars += `<text x="${(groupX + groupW / 2).toFixed(1)}" y="${(padT + chartH + 16).toFixed(1)}" font-size="10.5" fill="#9aa5b1" text-anchor="middle">${esc(g.label)}</text>`;
  });
  const axisY = padT + chartH;
  const legendHtml = legend.length ? `<div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:6px;justify-content:center;">${
    legend.map((l) => `<span style="font-size:11px;color:var(--text-dim);"><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${l.color};margin-right:5px;"></span>${esc(l.label)}</span>`).join('')
  }</div>` : '';
  return `<svg viewBox="0 0 ${width} ${height}" style="width:100%;height:auto;display:block;">` +
    `<line x1="${padL}" y1="${axisY}" x2="${width - padR}" y2="${axisY}" stroke="#333c46" stroke-width="1"/>` +
    bars + `</svg>${legendHtml}`;
}

/** Mehrlinien-Liniendiagramm (z. B. Spielverlauf). series: [{points:[{x,y}], color, label}] */
export function lineChartSvg(series, { width = 700, height = 240, xMax, yMax, halftimeX } = {}) {
  const padL = 26, padR = 12, padT = 16, padB = 20;
  const chartW = width - padL - padR;
  const chartH = height - padT - padB;
  const allPoints = series.flatMap((s) => s.points);
  const xMaxVal = xMax || Math.max(1, ...allPoints.map((p) => p.x));
  const yMaxVal = yMax || Math.max(1, ...allPoints.map((p) => p.y));
  const sx = (x) => padL + (x / xMaxVal) * chartW;
  const sy = (y) => padT + chartH - (y / yMaxVal) * chartH;

  let halftimeLine = '';
  if (halftimeX != null) {
    const hx = sx(halftimeX);
    halftimeLine = `<line x1="${hx.toFixed(1)}" y1="${padT}" x2="${hx.toFixed(1)}" y2="${padT + chartH}" stroke="#4b5560" stroke-width="1" stroke-dasharray="4,3"/>` +
      `<text x="${hx.toFixed(1)}" y="${(padT - 4).toFixed(1)}" font-size="9" fill="#9aa5b1" text-anchor="middle">HZ</text>`;
  }

  let paths = '';
  series.forEach((s) => {
    const d = s.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${sx(p.x).toFixed(1)} ${sy(p.y).toFixed(1)}`).join(' ');
    paths += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2.5" stroke-linejoin="round"/>`;
    const last = s.points[s.points.length - 1];
    if (last) {
      paths += `<circle cx="${sx(last.x).toFixed(1)}" cy="${sy(last.y).toFixed(1)}" r="3.5" fill="${s.color}"/>`;
      paths += `<text x="${(sx(last.x) + 6).toFixed(1)}" y="${(sy(last.y) + 4).toFixed(1)}" font-size="11" fill="${s.color}" font-weight="700">${esc(s.label)} ${last.y}</text>`;
    }
  });

  return `<svg viewBox="0 0 ${width} ${height}" style="width:100%;height:auto;display:block;">` +
    `<line x1="${padL}" y1="${padT + chartH}" x2="${width - padR}" y2="${padT + chartH}" stroke="#333c46" stroke-width="1"/>` +
    `<line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + chartH}" stroke="#333c46" stroke-width="1"/>` +
    halftimeLine + paths + `</svg>`;
}

/** Momentum-Chart: farbcodierte Balken (grün = wir vorne, rot = Gegner vorne) über die Spielzeit */
export function momentumChartSvg(segments, { width = 700, height = 130, totalSeconds } = {}) {
  const padL = 10, padR = 10, padT = 10, padB = 10;
  const chartW = width - padL - padR;
  const chartH = height - padT - padB;
  const midY = padT + chartH / 2;
  const maxAbs = Math.max(1, ...segments.map((s) => Math.abs(s.diff)));
  const total = totalSeconds || Math.max(1, ...segments.map((s) => s.end));

  let bars = '';
  segments.forEach((s) => {
    const x1 = padL + (s.start / total) * chartW;
    const x2 = padL + (s.end / total) * chartW;
    const h = (Math.abs(s.diff) / maxAbs) * (chartH / 2);
    const color = s.diff > 0 ? '#2ea043' : s.diff < 0 ? '#d3363a' : '#4b5560';
    const y = s.diff >= 0 ? midY - h : midY;
    bars += `<rect x="${x1.toFixed(1)}" y="${y.toFixed(1)}" width="${Math.max(1, x2 - x1).toFixed(1)}" height="${Math.max(0.5, h).toFixed(1)}" fill="${color}"/>`;
  });

  return `<svg viewBox="0 0 ${width} ${height}" style="width:100%;height:auto;display:block;">` +
    `<line x1="${padL}" y1="${midY}" x2="${width - padR}" y2="${midY}" stroke="#4b5560" stroke-width="1"/>` +
    bars + `</svg>`;
}

/** Kreisdiagramm. segments: [{label, value, color}]. Gibt SVG + separate Legende (HTML) zurück. */
export function pieChartSvg(segments, { size = 180 } = {}) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  const r = size / 2 - 4, cx = size / 2, cy = size / 2;
  let cumAngle = -Math.PI / 2;
  let paths = '';
  if (segments.every((s) => s.value === 0)) {
    paths = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#333c46"/>`;
  } else {
    segments.forEach((s) => {
      if (s.value <= 0) return;
      const angle = (s.value / total) * 2 * Math.PI;
      const x1 = cx + r * Math.cos(cumAngle), y1 = cy + r * Math.sin(cumAngle);
      cumAngle += angle;
      const x2 = cx + r * Math.cos(cumAngle), y2 = cy + r * Math.sin(cumAngle);
      const largeArc = angle > Math.PI ? 1 : 0;
      paths += `<path d="M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z" fill="${s.color}" stroke="var(--bg-panel)" stroke-width="1.5"/>`;
    });
  }
  const svg = `<svg viewBox="0 0 ${size} ${size}" style="width:${size}px;height:${size}px;flex-shrink:0;">${paths}</svg>`;
  const legend = `<div style="display:flex;flex-direction:column;gap:6px;justify-content:center;">${
    segments.map((s) => {
      const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
      return `<div style="font-size:12.5px;display:flex;align-items:center;gap:7px;">` +
        `<span style="width:10px;height:10px;border-radius:2px;background:${s.color};display:inline-block;flex-shrink:0;"></span>` +
        `<span style="color:var(--text);">${esc(s.label)}</span><span style="color:var(--text-dim);">${s.value} (${pct}%)</span></div>`;
    }).join('')
  }</div>`;
  return `<div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap;">${svg}${legend}</div>`;
}

// ============================================================
// Wurfkarte: Handballfeld-Draufsicht (9m/6m/Tor) mit Positions-Kreisen
// ============================================================

// Schematische Koordinaten je Position im Feld-Koordinatensystem (viewBox 0 0 400 300)
export const POSITION_COURT_COORDS = {
  LA: { x: 95, y: 44 },
  RA: { x: 305, y: 44 },
  KREIS: { x: 200, y: 86 },
  DL: { x: 148, y: 102 },
  DM: { x: 200, y: 100 },
  DR: { x: 252, y: 102 },
  '7M': { x: 200, y: 124 },
  RL: { x: 100, y: 168 },
  RM: { x: 200, y: 182 },
  RR: { x: 300, y: 168 },
};

function courtMarkingsSvg() {
  return `
    <rect x="30" y="10" width="340" height="270" fill="none" stroke="#333c46" stroke-width="1.5" rx="3"/>
    <rect x="181" y="4" width="38" height="10" fill="none" stroke="#9aa5b1" stroke-width="2"/>
    <path d="M 143 14 Q 200 96 257 14" fill="none" stroke="#4b5560" stroke-width="2"/>
    <path d="M 90 14 Q 200 150 310 14" fill="none" stroke="#4b5560" stroke-width="1.5" stroke-dasharray="5,4"/>
    <line x1="190" y1="120" x2="210" y2="120" stroke="#4b5560" stroke-width="2"/>
    <text x="325" y="18" font-size="9" fill="#6b7480">6m</text>
    <text x="325" y="150" font-size="9" fill="#6b7480">9m</text>
    <text x="213" y="124" font-size="9" fill="#6b7480">7m</text>
  `;
}

/**
 * Wurfkarte: Feld-Draufsicht mit einem Kreis je Position.
 * entries: [{ id, label, count, total }] — count = Erfolge (Tore/Paraden), total = Versuche.
 * Kreisgröße UND Deckkraft skalieren beide mit `total` (Anzahl Aktionen von dieser Position).
 */
export function shotCourtChartSvg(entries, { color = '#3b82c4', width = 400, height = 300 } = {}) {
  const valid = entries.filter((e) => POSITION_COURT_COORDS[e.id] && e.total > 0);
  const maxTotal = Math.max(1, ...valid.map((e) => e.total));

  let circles = '';
  valid.forEach((e) => {
    const { x, y } = POSITION_COURT_COORDS[e.id];
    const ratio = e.total / maxTotal;
    const r = 13 + Math.sqrt(ratio) * 27;
    const opacity = 0.28 + ratio * 0.62;
    circles += `<circle cx="${x}" cy="${y}" r="${r.toFixed(1)}" fill="${color}" fill-opacity="${opacity.toFixed(2)}" stroke="${color}" stroke-width="1.5"/>`;
    circles += `<text x="${x}" y="${(y + 4).toFixed(1)}" font-size="12.5" font-weight="800" fill="#ffffff" text-anchor="middle" style="paint-order:stroke;stroke:#00000090;stroke-width:3px;">${e.count}/${e.total}</text>`;
    circles += `<text x="${x}" y="${(y + r + 13).toFixed(1)}" font-size="9.5" fill="#9aa5b1" text-anchor="middle">${esc(e.label)}</text>`;
  });

  return `<svg viewBox="0 0 ${width} ${height}" style="width:100%;max-width:460px;height:auto;display:block;margin:0 auto;">` +
    courtMarkingsSvg() + circles + `</svg>`;
}
