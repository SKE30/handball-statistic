// ============================================================
// Minimaler PDF-Writer — KEINE externe Bibliothek, kein CDN.
// Baut eine gültige PDF 1.4 Datei von Hand (Objekte, Streams, xref).
// Gleiche Philosophie wie xlsx-writer.js: Null Laufzeit-Abhängigkeit,
// damit der Bericht auch offline in der Halle zuverlässig erzeugt wird.
// ============================================================

function asciiBytes(str) {
  const out = new Array(str.length);
  for (let i = 0; i < str.length; i++) out[i] = str.charCodeAt(i) & 0xFF;
  return out;
}

// WinAnsiEncoding-Codepunkte für deutsche Umlaute (identisch zu Latin-1 an diesen Stellen)
const LATIN1_SPECIAL = { 'ä': 0xE4, 'ö': 0xF6, 'ü': 0xFC, 'Ä': 0xC4, 'Ö': 0xD6, 'Ü': 0xDC, 'ß': 0xDF };

function latin1Bytes(str) {
  const out = [];
  for (const ch of String(str)) {
    if (LATIN1_SPECIAL[ch] !== undefined) out.push(LATIN1_SPECIAL[ch]);
    else {
      const code = ch.charCodeAt(0);
      out.push(code < 128 ? code : 0x3F); // Fallback '?'
    }
  }
  return out;
}

function pdfEscapeBytes(bytes) {
  const out = [];
  for (const b of bytes) {
    if (b === 0x28 || b === 0x29 || b === 0x5C) out.push(0x5C, b); // ( ) \ escapen
    else out.push(b);
  }
  return out;
}

/** Baut den Inhalt-Stream (Text + Linien) für eine Seite */
function buildContentBytes(ops) {
  let bytes = [];
  const push = (s) => { bytes = bytes.concat(asciiBytes(s)); };
  for (const op of ops) {
    if (op.type === 'text') {
      push(`BT /${op.font || 'F1'} ${op.size || 10} Tf ${op.x.toFixed(2)} ${op.y.toFixed(2)} Td (`);
      bytes = bytes.concat(pdfEscapeBytes(latin1Bytes(op.text)));
      push(') Tj ET\n');
    } else if (op.type === 'line') {
      push(`${(op.width || 1).toFixed(2)} w ${op.x1.toFixed(2)} ${op.y1.toFixed(2)} m ${op.x2.toFixed(2)} ${op.y2.toFixed(2)} l S\n`);
    }
  }
  return bytes;
}

/**
 * pages: [{ width, height, ops: [{type:'text',x,y,size,text,font} | {type:'line',x1,y1,x2,y2,width}] }]
 * gibt Uint8Array (fertige .pdf-Datei) zurück
 */
export function buildPdf(pages) {
  const numPages = pages.length;
  const pageObjNums = [];
  const contentObjNums = [];
  let nextObj = 5; // 1=Catalog, 2=Pages, 3=Font F1, 4=Font F2 (bold)
  for (let i = 0; i < numPages; i++) { pageObjNums.push(nextObj++); contentObjNums.push(nextObj++); }
  const kidsRefs = pageObjNums.map((n) => `${n} 0 R`).join(' ');

  const allObjects = [
    asciiBytes(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`),
    asciiBytes(`2 0 obj\n<< /Type /Pages /Kids [${kidsRefs}] /Count ${numPages} >>\nendobj\n`),
    asciiBytes(`3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n`),
    asciiBytes(`4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n`),
  ];

  pages.forEach((page, i) => {
    const pageNum = pageObjNums[i];
    const contentNum = contentObjNums[i];
    allObjects.push(asciiBytes(
      `${pageNum} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${page.width} ${page.height}] ` +
      `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentNum} 0 R >>\nendobj\n`
    ));
    const contentBytes = buildContentBytes(page.ops);
    const streamHeader = asciiBytes(`${contentNum} 0 obj\n<< /Length ${contentBytes.length} >>\nstream\n`);
    const streamFooter = asciiBytes(`\nendstream\nendobj\n`);
    allObjects.push(streamHeader.concat(contentBytes, streamFooter));
  });

  let fileBytes = asciiBytes('%PDF-1.4\n').concat([0x25, 0xE2, 0xE3, 0xCF, 0xD3, 0x0A]);
  const offsets = [];
  let currentOffset = fileBytes.length;
  allObjects.forEach((o) => {
    offsets.push(currentOffset);
    fileBytes = fileBytes.concat(o);
    currentOffset += o.length;
  });

  const xrefOffset = currentOffset;
  const totalObjs = allObjects.length;
  let xref = `xref\n0 ${totalObjs + 1}\n0000000000 65535 f \n`;
  offsets.forEach((off) => { xref += `${String(off).padStart(10, '0')} 00000 n \n`; });
  fileBytes = fileBytes.concat(asciiBytes(xref));

  const trailer = `trailer\n<< /Size ${totalObjs + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  fileBytes = fileBytes.concat(asciiBytes(trailer));

  return new Uint8Array(fileBytes);
}

export function downloadPdf(bytes, filename) {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
