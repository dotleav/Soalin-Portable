// ── Konverter .docx → soal, jalan 100% di browser (tanpa library) ───────────
// Alur: zip (DecompressionStream bawaan browser) → word/document.xml (DOMParser
// bawaan) → baris teks/gambar → parser soal yang SAMA dengan scripts/convert-docx.js.
// Gambar dipakai apa adanya (Blob langsung dari zip, tanpa re-encode); hanya
// gambar yang di-crop/rotasi/flip di Word yang digambar ulang lewat canvas.
const DOCX_NS = {
  w: "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
  a: "http://schemas.openxmlformats.org/drawingml/2006/main",
  r: "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
  mc: "http://schemas.openxmlformats.org/markup-compatibility/2006",
  v: "urn:schemas-microsoft-com:vml",
};
// EMF/WMF sengaja tidak ada: browser tidak bisa menampilkannya.
const IMG_MIME = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", bmp: "image/bmp", webp: "image/webp", svg: "image/svg+xml" };

// Pembaca zip minimal: baca central directory, inflate hanya file yang diminta.
async function openZip(buf) {
  const u8 = new Uint8Array(buf), dv = new DataView(buf), td = new TextDecoder();
  let e = u8.length - 22;
  while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error(t("errZip"));
  const entries = new Map();
  for (let n = dv.getUint16(e + 10, true), p = dv.getUint32(e + 16, true); n > 0; n--) {
    const nameLen = dv.getUint16(p + 28, true);
    entries.set(td.decode(u8.subarray(p + 46, p + 46 + nameLen)), {
      method: dv.getUint16(p + 10, true), size: dv.getUint32(p + 20, true), off: dv.getUint32(p + 42, true),
    });
    p += 46 + nameLen + dv.getUint16(p + 30, true) + dv.getUint16(p + 32, true);
  }
  return async (name) => {
    const f = entries.get(name);
    if (!f) return null;
    const start = f.off + 30 + dv.getUint16(f.off + 26, true) + dv.getUint16(f.off + 28, true);
    const raw = u8.subarray(start, start + f.size);
    if (f.method === 0) return raw;
    const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  };
}

// Crop → flip → rotasi, urutan yang sama dengan scripts/convert-docx.js (sharp).
async function transformImage(blob, s, type) {
  try {
    const bmp = await createImageBitmap(blob);
    const sx = Math.min(Math.max(Math.round(bmp.width * s.l), 0), bmp.width - 1);
    const sy = Math.min(Math.max(Math.round(bmp.height * s.t), 0), bmp.height - 1);
    const sw = Math.min(Math.max(Math.round(bmp.width * (1 - s.l - s.r)), 1), bmp.width - sx);
    const sh = Math.min(Math.max(Math.round(bmp.height * (1 - s.t - s.b)), 1), bmp.height - sy);
    const rad = (s.rot * Math.PI) / 180, c = Math.abs(Math.cos(rad)), n = Math.abs(Math.sin(rad));
    const W = Math.round(sw * c + sh * n), H = Math.round(sw * n + sh * c);
    const cv = new OffscreenCanvas(W, H), g = cv.getContext("2d");
    if (s.rot % 90) { g.fillStyle = "#fff"; g.fillRect(0, 0, W, H); } // sudut miring → pojok putih
    g.translate(W / 2, H / 2); g.rotate(rad); g.scale(s.fh ? -1 : 1, s.fv ? -1 : 1);
    g.drawImage(bmp, sx, sy, sw, sh, -sw / 2, -sh / 2, sw, sh);
    return await cv.convertToBlob({ type: type === "image/jpeg" ? type : "image/png", quality: 0.92 });
  } catch { return blob; } // gagal decode/transform → pakai gambar asli
}

async function convertDocx(buf) {
  const read = await openZip(buf), td = new TextDecoder(), { w: W, a: A, r: R, mc: MC, v: V } = DOCX_NS;
  const readXml = async (name) => {
    const b = await read(name);
    if (!b) return null;
    const d = new DOMParser().parseFromString(td.decode(b), "application/xml");
    if (d.getElementsByTagName("parsererror").length) throw new Error(t("errXml", { name }));
    return d;
  };
  const [doc, stylesDoc, numDoc, relsDoc] = await Promise.all([
    readXml("word/document.xml"), readXml("word/styles.xml"), readXml("word/numbering.xml"), readXml("word/_rels/document.xml.rels"),
  ]);
  if (!doc) throw new Error(t("errDoc"));

  const tag = (el, name) => el.getElementsByTagNameNS(W, name);
  const wattr = (el, name) => el?.getAttributeNS(W, name);
  const val = (el, name) => wattr(tag(el, name)[0], "val");
  const kids = (el, name) => [...el.children].filter((c) => c.namespaceURI === W && c.localName === name);

  // Style (nama + penomoran bawaan style) dan tipe list (angka vs bullet).
  const styles = new Map();
  if (stylesDoc) for (const s of tag(stylesDoc, "style")) {
    const np = tag(s, "numPr")[0];
    styles.set(wattr(s, "styleId"), { name: val(s, "name") || "", numId: np && val(np, "numId"), ilvl: np && val(np, "ilvl") });
  }
  const numFmt = new Map(), numAbs = new Map();
  if (numDoc) {
    for (const an of tag(numDoc, "abstractNum")) for (const l of tag(an, "lvl")) numFmt.set(`${wattr(an, "abstractNumId")}:${wattr(l, "ilvl")}`, val(l, "numFmt"));
    for (const n of tag(numDoc, "num")) numAbs.set(wattr(n, "numId"), val(n, "abstractNumId"));
  }

  // Gambar: kumpulkan spec (rel id + crop/rotasi/flip) unik, blob dibuat sesudahnya.
  const specs = [], specIdx = new Map();
  const addImage = (rid, blip) => {
    const fill = blip?.parentNode, xf = fill?.parentNode?.getElementsByTagNameNS(A, "xfrm")[0];
    const sr = fill && [...fill.children].find((c) => c.localName === "srcRect");
    const crop = (n) => Math.max(0, (+sr?.getAttribute(n) || 0) / 100000);
    const s = { rid, l: crop("l"), t: crop("t"), r: crop("r"), b: crop("b"),
      rot: (+xf?.getAttribute("rot") || 0) / 60000, fh: xf?.getAttribute("flipH") === "1", fv: xf?.getAttribute("flipV") === "1" };
    const key = JSON.stringify(s);
    if (!specIdx.has(key)) { specIdx.set(key, specs.length); specs.push(s); }
    return specIdx.get(key);
  };

  // <w:p> → { heading, skip, ordered, segs:[{text, imgs}] }; segs dipecah di tiap line-break.
  const readPara = (p) => {
    const ppr = kids(p, "pPr")[0], sid = ppr && val(ppr, "pStyle"), st = styles.get(sid);
    const hm = /^Heading(\d)$/.exec(sid || "") || /^heading (\d)$/i.exec(st?.name || "");
    const np = ppr && tag(ppr, "numPr")[0];
    const numId = np ? val(np, "numId") : st?.numId, ilvl = (np ? val(np, "ilvl") : st?.ilvl) || "0";
    const fmt = numId && numId !== "0" ? numFmt.get(`${numAbs.get(numId)}:${ilvl}`) : undefined;
    const segs = [{ text: "", imgs: [] }];
    for (const el of p.getElementsByTagName("*")) {
      const cur = segs[segs.length - 1], ln = el.localName;
      if (el.namespaceURI === W) {
        if (ln === "t") cur.text += el.textContent;
        else if (ln === "tab") cur.text += "\t";
        else if (ln === "br" && [null, "", "textWrapping"].includes(wattr(el, "type"))) segs.push({ text: "", imgs: [] });
      } else if (el.namespaceURI === A && ln === "blip") {
        const rid = el.getAttributeNS(R, "embed");
        if (rid) cur.imgs.push(addImage(rid, el));
      } else if (el.namespaceURI === V && ln === "imagedata") {
        const rid = el.getAttributeNS(R, "id");
        if (rid) cur.imgs.push(addImage(rid, null));
      }
    }
    return { heading: !!hm && +hm[1] <= 3, skip: !!hm && +hm[1] > 3, ordered: fmt !== undefined && fmt !== "bullet" && ilvl === "0", segs };
  };
  const walk = (parent) => {
    const out = [];
    for (const c of parent.children) {
      if (c.namespaceURI !== W) continue;
      if (c.localName === "p") out.push(readPara(c));
      else if (c.localName === "sdt") out.push(...walk(kids(c, "sdtContent")[0] || c));
      else if (c.localName === "tbl") out.push({ tbl: kids(c, "tr").map((tr) => kids(tr, "tc").map(walk)) });
    }
    return out;
  };
  // Word membungkus gambar di mc:AlternateContent (Choice + Fallback) → buang Fallback biar tidak dobel.
  for (const f of [...doc.getElementsByTagNameNS(MC, "Fallback")]) f.remove();
  const blocks = walk(tag(doc, "body")[0]);

  const rels = new Map();
  if (relsDoc) for (const r of relsDoc.getElementsByTagName("Relationship")) rels.set(r.getAttribute("Id"), r.getAttribute("Target"));
  const skippedExt = new Set();
  const blobs = await Promise.all(specs.map(async (s) => {
    const target = rels.get(s.rid);
    if (!target) return null;
    const path = decodeURIComponent(new URL(target, "http://x/word/document.xml").pathname.slice(1));
    const ext = path.split(".").pop().toLowerCase(), type = IMG_MIME[ext];
    const bytes = type && (await read(path));
    if (!bytes) { skippedExt.add(ext); return null; }
    const blob = new Blob([bytes], { type });
    return s.l || s.t || s.r || s.b || s.rot || s.fh || s.fv ? transformImage(blob, s, type) : blob;
  }));

  // ── blok → baris {text, images, isHeading, isListItem} ──
  const flat = (bl) => bl.flatMap((b) => (b.tbl ? b.tbl.flat().flatMap(flat) : [b]));
  const paraLines = (b) => b.skip ? [] : b.segs
    .map((s, i) => ({ text: s.text.trim(), images: s.imgs.filter((k) => blobs[k]), isHeading: b.heading, isListItem: b.ordered && i === 0 }))
    .filter((l) => l.text || l.images.length);

  // Bagian 2 = mulai dari heading "Bagian 2"/"Gagal Diperbaiki" terakhir; tanpa heading itu, mulai dari tabel pertama.
  // Bagian 3 = mulai dari heading "Bagian 3"/"Soal Isian" terakhir (kalau ada).
  let cut = -1, cut3 = -1;
  blocks.forEach((b, i) => {
    if (!b.heading) return;
    const t = b.segs.map((s) => s.text).join("").trim();
    if (/bagian\s*2|part\s*2|gagal\s+diperbaiki|broken|failed/i.test(t)) cut = i;
    if (/bagian\s*3|part\s*3|soal\s+isian|fill[- ]?in|short\s+answer/i.test(t)) cut3 = i;
  });
  if (cut < 0) {
    // Tanpa heading Bagian 2: tabel pertama = Bagian 2 — tapi jangan lewati
    // heading Bagian 3 kalau sudah ketemu, atau tabel isian ikut kesedot ke sini.
    const searchEnd = cut3 >= 0 ? cut3 : blocks.length;
    cut = blocks.findIndex((b, i) => b.tbl && i < searchEnd);
  }
  const part1 = cut < 0 ? blocks : blocks.slice(0, cut);
  const part2 = cut < 0 ? [] : blocks.slice(cut, cut3 < 0 ? blocks.length : cut3);
  const part3 = cut3 < 0 ? [] : blocks.slice(cut3);

  // ── Bagian 1: soal MCQ (sama persis dengan scripts/convert-docx.js) ──
  // Fallback: soal + opsi + kunci kadang ada dalam SATU paragraf tanpa line-break.
  function splitInlineQuestion(rawText) {
    let text = rawText, answer = "";
    const ansMatch = text.match(/\b(?:Kunci(?:\s*Jawaban)?|Answer(?:\s*Key)?|Key)\s*:?\s*([A-Ea-e])\b\s*$/i);
    if (ansMatch) { answer = ansMatch[1].toUpperCase(); text = text.slice(0, ansMatch.index).trim(); }
    const matches = [...text.matchAll(/\s([A-Ea-e])[.)]\s+/g)];
    if (matches.length < 3 || matches[0][1].toUpperCase() !== "A") return null;
    const options = {};
    matches.forEach((m, i) => {
      const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
      options[m[1].toUpperCase()] = text.slice(m.index + m[0].length, end).trim();
    });
    return { question: text.slice(0, matches[0].index).trim(), options, answer };
  }

  function parsePart1(lines) {
    const questions = [];
    let current = null, pendingId = null, currentCategory = "", mode = null;
    const questionStart = /^(\d+)[.)]\s*(.*)$/, idLine = /^ID\s*:\s*(.+)$/i, optionLine = /^([A-Ea-e])[.)]\s*(.*)$/;
    const answerLine = /^(?:Kunci\s*Jawaban|Jawaban\s*Kunci|Correct\s*Answer|Answer\s*Key|Kunci|Jawaban|Answer|Key)\s*:?\s*([A-Ea-e])\b.*$/i;
    const explanationLine = /^(?:Penjelasan|Explanation)\s*:?\s*(.*)$/i, categoryLine = /^(?:Kategori|Category)\s*:\s*(.+)$/i;
    const startQuestion = (rawText, images) => {
      if (current) questions.push(current);
      const inline = splitInlineQuestion(rawText);
      current = {
        id: pendingId || `Q${questions.length + 1}`, category: currentCategory,
        question: inline ? inline.question : rawText, questionImages: [...images],
        options: inline ? inline.options : {}, answer: inline ? inline.answer : "",
        explanation: "", explanationImages: [], isBroken: false,
      };
      pendingId = null;
      mode = inline ? "answer" : "question";
    };
    for (const { text, images, isHeading, isListItem } of lines) {
      if (isHeading) { currentCategory = text; continue; }
      if (categoryLine.test(text)) { currentCategory = text.match(categoryLine)[1].trim(); continue; }
      if (idLine.test(text)) { pendingId = text.match(idLine)[1].trim(); continue; }
      if (isListItem) { startQuestion(text, images); continue; }
      const qStart = text.match(questionStart);
      if (qStart) { startQuestion(qStart[2].trim(), images); continue; }
      if (!current) continue;
      const optMatch = text.match(optionLine), ansMatch = text.match(answerLine), expMatch = text.match(explanationLine);
      if (optMatch) {
        current.options[optMatch[1].toUpperCase()] = optMatch[2].trim();
        current.questionImages.push(...images);
        mode = "options";
      } else if (ansMatch) {
        current.answer = ansMatch[1].toUpperCase();
        mode = "answer";
      } else if (expMatch) {
        current.explanation = expMatch[1].trim();
        current.explanationImages.push(...images);
        mode = "explanation";
      } else if (mode === "question") {
        current.question += (current.question ? " " : "") + text;
        current.questionImages.push(...images);
      } else if (mode === "explanation") {
        current.explanation += (current.explanation ? " " : "") + text;
        current.explanationImages.push(...images);
      } else if (mode === "options" && images.length) {
        current.questionImages.push(...images);
      }
    }
    if (current) questions.push(current);
    return questions;
  }

  // ── Bagian 2: tabel soal rusak | No | Soal Asli | Penjelasan (teks dan/atau gambar) | ──
  function parsePart2(tables, startingQNumber) {
    const broken = [];
    for (const rows of tables) {
      let isFirstRow = true;
      for (const cells of rows) {
        if (cells.length < 2) continue;
        const lines = cells.map((c) => flat(c).flatMap(paraLines));
        const text = (i) => lines[i].map((l) => l.text).filter(Boolean).join(" ");
        const images = (i) => (lines[i] || []).flatMap((l) => l.images);
        const origNo = text(0), questionText = text(1);
        const expText = (lines[2] || []).map((l) => l.text).filter(Boolean).join("\n");
        if (isFirstRow || /soal\s+asli|original\s+question|gambar\s+penjelasan|explanation/i.test(questionText) || /^no\.?$/i.test(origNo)) {
          isFirstRow = false;
          if (!/^\d+$/.test(origNo)) continue; // header, bukan baris data
        }
        if (!questionText) continue;
        broken.push({
          id: `QB${origNo || startingQNumber + broken.length + 1}`, category: "Soal Rusak", question: questionText,
          questionImages: images(1), options: {}, answer: "", explanation: expText, explanationImages: images(2), isBroken: true,
        });
      }
    }
    return broken;
  }

  // ── Bagian 3: tabel soal isian | No | Soal | Jawaban | ──
  function parsePart3(tables, startingQNumber) {
    const isian = [];
    for (const rows of tables) {
      let isFirstRow = true;
      for (const cells of rows) {
        if (cells.length < 2) continue;
        const lines = cells.map((c) => flat(c).flatMap(paraLines));
        const text = (i) => lines[i].map((l) => l.text).filter(Boolean).join(" ");
        const images = (i) => (lines[i] || []).flatMap((l) => l.images);
        const origNo = text(0), questionText = text(1), jawabanText = text(2);
        if (isFirstRow || /^no\.?$/i.test(origNo)) {
          isFirstRow = false;
          if (!/^\d+$/.test(origNo)) continue; // header, bukan baris data
        }
        if (!questionText) continue;
        isian.push({
          id: `QI${origNo || startingQNumber + isian.length + 1}`, category: "Soal Isian", question: questionText,
          questionImages: images(1), options: {}, answer: jawabanText || "", explanation: "", explanationImages: [],
          isBroken: false, isIsian: true,
        });
      }
    }
    return isian;
  }

  const normal = parsePart1(flat(part1).flatMap(paraLines));
  const rusak = parsePart2(part2.filter((b) => b.tbl).map((b) => b.tbl), normal.length);
  const isian = parsePart3(part3.filter((b) => b.tbl).map((b) => b.tbl), normal.length + rusak.length);
  return { questions: [...normal, ...rusak, ...isian], blobs, stats: { normal: normal.length, rusak: rusak.length, isian: isian.length, images: blobs.filter(Boolean).length, skippedExt: [...skippedExt] } };
}
