// State global, library paket di IndexedDB, import .docx.
// ── State ──────────────────────────────────────────────────────────────────
let activePackage = null; // { id, title } of the quiz being played
let pickerOpen = false;
let dropMsg = "";
let quizUrls = []; // object URLs of the active quiz's images (revoked on switch)

let quizMode = "biasa"; // "biasa" (Quiz) | "tentamen" (Timed Quiz)
let headerHidden = false;

let biasaLoaded = false;
let biasaShuffleOn = false;
let biasaAnswersMap = {};
let biasaVisibleCount = LOAD_BATCH;
let shuffleOrderCache = {};

let tentamenState = "setup"; // "setup" | "running" | "finished"
let tentamenShuffleOn = false;
let tentamenDifficulty = "normal";
let tentamenQuestions = [];
let tentamenAnswers = [];
let currentIdx = 0;
let timeLeft = 0;
let qPhase = "answering"; // "answering" | "answered_manual" | "answered_timeout"
let tentamenTimerHandle = null;
let tentamenAdvanceHandle = null;
let tentamenFadeKey = null; // fade-in only the first time a question shows

// ── Quiz library: many quizzes in IndexedDB, no fixed cap ─────────────────
// "meta:<id>" = small list entry, "pkg:<id>" = questions + image Blobs.
// The only ceiling is the browser's storage quota (measured in the picker).
let packages = []; // meta list, newest first
let est = null; // navigator.storage.estimate() result
let dbPromise;
function idb(mode, run) {
  dbPromise ??= new Promise((ok, no) => {
    const req = indexedDB.open("soalin-portable", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("kv");
    req.onsuccess = () => ok(req.result);
    req.onerror = () => no(req.error);
  });
  return dbPromise.then((db) => new Promise((ok, no) => {
    const tx = db.transaction("kv", mode), rq = run(tx.objectStore("kv"));
    tx.oncomplete = () => ok(rq.result);
    tx.onerror = tx.onabort = () => no(tx.error);
  }));
}
const sizeOf = (rec) => rec.blobs.reduce((n, b) => n + (b?.size || 0), 0) + JSON.stringify(rec.questions).length;
const saveQuiz = (rec, meta) => idb("readwrite", (s) => { s.put(rec, "pkg:" + rec.id); return s.put(meta, "meta:" + rec.id); });
const metaOf = (rec) => ({ id: rec.id, title: rec.title, count: rec.questions.length, size: sizeOf(rec), savedAt: rec.savedAt });

function refreshEst() {
  navigator.storage?.estimate?.().then((e) => { est = e; if (pickerOpen) render(); }).catch(() => {});
}

async function loadPackages() {
  try { // migrate the old single "last" quiz into the library
    const old = await idb("readonly", (s) => s.get("last"));
    if (old?.questions) {
      old.savedAt ||= Date.now();
      await saveQuiz(old, metaOf(old));
      await idb("readwrite", (s) => s.delete("last"));
    }
  } catch { /* nothing to migrate */ }
  try {
    packages = (await idb("readonly", (s) => s.getAll(IDBKeyRange.bound("meta:", "meta:\uffff")))).sort((a, b) => b.savedAt - a.savedAt);
  } catch { packages = []; }
}

function resetQuizStateForNewPackage() {
  quizMode = "biasa";
  tentamenState = "setup";
  tentamenQuestions = [];
  tentamenAnswers = [];
  shuffleOrderCache = {};
  brokenRevealed.clear();
  brokenIdx = 0;
  stopTentamenTimerLoop();
}

// rec = { id, title, questions (images = blob index), blobs } → make it the active quiz.
function activateQuiz(rec) {
  quizUrls.forEach((u) => u && URL.revokeObjectURL(u));
  quizUrls = rec.blobs.map((b) => b && URL.createObjectURL(b));
  const urls = (idxs) => idxs.map((i) => quizUrls[i]);
  allQuestions = rec.questions.map((q) => ({ ...q, questionImages: urls(q.questionImages), explanationImages: urls(q.explanationImages) }));
  activePackage = { id: rec.id, title: rec.title, category: t("customQuiz") };
  try { localStorage.setItem(ACTIVE_PKG_KEY, rec.id); } catch { /* noop */ }
  resetQuizStateForNewPackage();
  initBiasa();
}

async function selectPackage(meta) {
  try {
    const rec = await idb("readonly", (s) => s.get("pkg:" + meta.id));
    activateQuiz(rec);
  } catch {
    allQuestions = []; activePackage = null; dropMsg = t("msgLoadFail");
  }
}

// Drop / pick one or more .docx → convert → save each → play the last one.
async function handleDocx(fileList) {
  const files = [...fileList].filter((f) => /\.docx$/i.test(f.name));
  pickerOpen = true; // status messages must be visible even mid-quiz
  if (!files.length) { dropMsg = t("msgPickDocx"); render(); return; }
  const msgs = []; let last = null;
  for (const file of files) {
    dropMsg = [...msgs, t("msgConverting", { name: file.name })].join("\n");
    render();
    const t0 = performance.now();
    try {
      const { questions, blobs, stats } = await convertDocx(await file.arrayBuffer());
      if (!stats.normal && !stats.rusak && !stats.isian) throw new Error(t("msgNoQuestions"));
      const rec = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), title: file.name.replace(/\.docx$/i, ""), questions, blobs, savedAt: Date.now() };
      const meta = metaOf(rec);
      let saved = true;
      await saveQuiz(rec, meta).catch(() => { saved = false; });
      if (saved) packages.unshift(meta);
      last = rec;
      msgs.push(t("msgDone", {
        name: file.name, n: stats.normal,
        b: stats.rusak ? t("plusBroken", { n: stats.rusak }) : "", f: stats.isian ? t("plusFill", { n: stats.isian }) : "",
        i: stats.images, ms: Math.round(performance.now() - t0),
      }) + (stats.skippedExt.length ? t("msgSkippedImg", { ext: stats.skippedExt.join(", .") }) : "") + (saved ? "" : t("msgNotSaved")));
    } catch (e) {
      msgs.push(e instanceof ReferenceError ? t("msgNoStream") : `❌ ${file.name}: ${e.message}`);
    }
  }
  if (last) {
    activateQuiz(last);
    navigator.storage?.persist?.(); // ask the browser not to evict saved quizzes
    pickerOpen = msgs.some((m) => m.includes("⚠️") || m.includes("❌")); // warnings stay readable
  }
  dropMsg = msgs.join("\n");
  refreshEst();
  render();
}

async function deleteQuiz(id) {
  const meta = packages.find((p) => p.id === id);
  if (!meta || !confirm(t("confirmDelete", { title: meta.title }))) return;
  await idb("readwrite", (s) => { s.delete("pkg:" + id); return s.delete("meta:" + id); }).catch(() => {});
  packages = packages.filter((p) => p.id !== id);
  try { localStorage.removeItem(`${LS_KEY_PREFIX}__${id}`); } catch { /* noop */ }
  if (activePackage?.id === id) {
    allQuestions = []; activePackage = null;
    try { localStorage.removeItem(ACTIVE_PKG_KEY); } catch { /* noop */ }
    resetQuizStateForNewPackage();
  }
  dropMsg = t("msgDeleted");
  pickerOpen = true;
  refreshEst();
  render();
}

// Drag-and-drop anywhere on the page.
let dragTimer;
addEventListener("dragover", (e) => {
  e.preventDefault();
  document.body.classList.add("dragging");
  clearTimeout(dragTimer);
  dragTimer = setTimeout(() => document.body.classList.remove("dragging"), 120);
});
addEventListener("drop", (e) => {
  e.preventDefault();
  document.body.classList.remove("dragging");
  if (e.dataTransfer.files.length) handleDocx(e.dataTransfer.files);
});
