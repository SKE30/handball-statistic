// ============================================================
// Minimaler XLSX-Writer — KEINE externe Bibliothek, kein CDN.
// Baut eine gültige .xlsx (= ZIP mit OOXML-Inhalt) direkt im Browser.
// Bewusst so gebaut, damit der Excel-Export genauso offline-sicher
// funktioniert wie der Rest der App (keine Laufzeit-Abhängigkeit).
// ============================================================

function crc32Table() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
}
const CRC_TABLE = crc32Table();

function crc32(bytes) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function u16(n) { return [n & 0xFF, (n >>> 8) & 0xFF]; }
function u32(n) { return [n & 0xFF, (n >>> 8) & 0xFF, (n >>> 16) & 0xFF, (n >>> 24) & 0xFF]; }
function strToBytes(str) { return Array.from(new TextEncoder().encode(str)); }

/** Baut ein rohes ZIP-Archiv (Methode "store" = unkomprimiert) aus [{name, content}] */
function buildZip(files) {
  const localChunks = [];
  const centralChunks = [];
  let offset = 0;

  files.forEach((file) => {
    const nameBytes = strToBytes(file.name);
    const dataBytes = strToBytes(file.content);
    const crc = crc32(dataBytes);
    const size = dataBytes.length;

    const localHeader = [
      ...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(crc), ...u32(size), ...u32(size),
      ...u16(nameBytes.length), ...u16(0),
      ...nameBytes,
    ];
    localChunks.push(localHeader, dataBytes);

    centralChunks.push([
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(crc), ...u32(size), ...u32(size),
      ...u16(nameBytes.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0),
      ...u32(offset),
      ...nameBytes,
    ]);

    offset += localHeader.length + dataBytes.length;
  });

  const centralDirStart = offset;
  const centralDirBytes = centralChunks.flat();

  const eocd = [
    ...u32(0x06054b50), ...u16(0), ...u16(0),
    ...u16(files.length), ...u16(files.length),
    ...u32(centralDirBytes.length), ...u32(centralDirStart), ...u16(0),
  ];

  return new Uint8Array([...localChunks.flat(), ...centralDirBytes, ...eocd]);
}

function colLetter(idx) {
  let s = '';
  idx += 1;
  while (idx > 0) {
    const rem = (idx - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    idx = Math.floor((idx - 1) / 26);
  }
  return s;
}

function escapeXml(str) {
  return String(str).replace(/[<>&'"]/g, (c) => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;',
  }[c]));
}

/** rows: Array<Array<string|number|{v, bold?}>> */
function sheetXml(rows) {
  let body = '';
  rows.forEach((row, r) => {
    body += `<row r="${r + 1}">`;
    row.forEach((cell, c) => {
      const isObj = cell !== null && typeof cell === 'object';
      const value = isObj ? cell.v : cell;
      const styleAttr = isObj && cell.bold ? ' s="1"' : '';
      const ref = `${colLetter(c)}${r + 1}`;
      if (typeof value === 'number' && Number.isFinite(value)) {
        body += `<c r="${ref}"${styleAttr}><v>${value}</v></c>`;
      } else {
        const text = value == null ? '' : String(value);
        body += `<c r="${ref}" t="inlineStr"${styleAttr}><is><t xml:space="preserve">${escapeXml(text)}</t></is></c>`;
      }
    });
    body += '</row>';
  });
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<sheetData>${body}</sheetData></worksheet>`;
}

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="1"><fill><patternFill patternType="none"/></fill></fills>
<borders count="1"><border/></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0"/></cellStyleXfs>
<cellXfs count="2"><xf numFmtId="0" fontId="0" xfId="0"/><xf numFmtId="0" fontId="1" xfId="0" applyFont="1"/></cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

/**
 * sheets: [{ name: 'Mannschaft', rows: [[...], ...] }, ...]
 * gibt Uint8Array (fertige .xlsx-Datei) zurück
 */
export function buildXlsx(sheets) {
  const sheetOverrides = sheets.map((_, i) =>
    `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
  ).join('');

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${sheetOverrides}
</Types>`;

  const relsRoot = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const workbookSheets = sheets.map((s, i) =>
    `<sheet name="${escapeXml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`
  ).join('');
  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${workbookSheets}</sheets></workbook>`;

  const workbookRelsList = sheets.map((_, i) =>
    `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`
  ).join('') + `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`;
  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${workbookRelsList}</Relationships>`;

  const files = [
    { name: '[Content_Types].xml', content: contentTypes },
    { name: '_rels/.rels', content: relsRoot },
    { name: 'xl/workbook.xml', content: workbookXml },
    { name: 'xl/_rels/workbook.xml.rels', content: workbookRelsXml },
    { name: 'xl/styles.xml', content: STYLES_XML },
    ...sheets.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, content: sheetXml(s.rows) })),
  ];

  return buildZip(files);
}

export function downloadXlsx(bytes, filename) {
  const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
