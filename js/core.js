// Konstanta, util, tema, lang, progres LocalStorage.
// ── Constants ──────────────────────────────────────────────────────────────
let allQuestions = [];
const LOAD_BATCH = 15; // questions rendered per batch so long quizzes don't lag
const LS_KEY_PREFIX = "soalin_biasa_progress_v2";
const ACTIVE_PKG_KEY = "soalin_active_package";
const THEME_KEY = "soalin_theme"; // "dark" | "light"

const DIFFICULTY_CONFIG = {
  cheetah:  { emoji: "🐆", timerSeconds: 30,  color: "#f59e0b" },
  normal:   { emoji: "🧍", timerSeconds: 60,  color: "#58a6ff" },
  folivora: { emoji: "🦥", timerSeconds: 300, color: "#86efac" },
  bekicot:  { emoji: "🐌", timerSeconds: 0,   color: "#c084fc" },
};

const app = document.getElementById("app");

// ── Utils ──────────────────────────────────────────────────────────────────
function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function escapeHtml(str) {
  return String(str ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escapeAttr(str) { return escapeHtml(str); }
const fmtBytes = (n) => n < 1048576 ? Math.max(1, Math.round(n / 1024)) + " KB" : n < 1073741824 ? (n / 1048576).toFixed(1) + " MB" : (n / 1073741824).toFixed(2) + " GB";
const fmtDate = (ms) => new Date(ms).toLocaleDateString(lang === "id" ? "id-ID" : "en-US", { day: "numeric", month: "short", year: "numeric" });

// ── Theme (dark / light) ──────────────────────────────────────────────────
let theme = localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark";
function setTheme(v) {
  theme = v === "light" ? "light" : "dark";
  try { localStorage.setItem(THEME_KEY, theme); } catch { /* noop */ }
}
function setLang(v) {
  lang = v === "id" ? "id" : "en";
  try { localStorage.setItem(LANG_KEY, lang); } catch { /* noop */ }
}

// ── LocalStorage — Quiz mode progress (per quiz) ──────────────────────────
function currentLsKey() {
  return activePackage ? `${LS_KEY_PREFIX}__${activePackage.id}` : LS_KEY_PREFIX;
}
function loadBiasa() {
  try {
    const parsed = JSON.parse(localStorage.getItem(currentLsKey()));
    return parsed && typeof parsed === "object" && "answersMap" in parsed ? parsed : null;
  } catch { return null; }
}
function saveBiasa() {
  try {
    localStorage.setItem(currentLsKey(), JSON.stringify({ shuffleOn: biasaShuffleOn, answersMap: biasaAnswersMap }));
  } catch { /* quota exceeded — ignore */ }
}
function clearBiasa() {
  try { localStorage.removeItem(currentLsKey()); } catch { /* noop */ }
}
