// ── Init Quiz mode progress from localStorage ────────────────────────────
function initBiasa() {
  const saved = loadBiasa();
  biasaShuffleOn = !!saved?.shuffleOn;
  biasaAnswersMap = saved?.answersMap || {};
  biasaVisibleCount = LOAD_BATCH;
  biasaLoaded = true;
}

// ── Quiz mode: handlers ──────────────────────────────────────────────────
function computeBiasaAll() {
  const key = "__shuffle";
  if (!biasaShuffleOn) {
    delete shuffleOrderCache[key];
    return allQuestions;
  }
  const cached = shuffleOrderCache[key];
  const baseIds = new Set(allQuestions.map(q => q.id));
  if (cached && cached.length === allQuestions.length && cached.every(q => baseIds.has(q.id))) return cached;
  const shuffled = shuffleArray(allQuestions);
  shuffleOrderCache[key] = shuffled;
  return shuffled;
}
function handleResetBiasa() {
  clearBiasa();
  biasaAnswersMap = {};
  biasaVisibleCount = LOAD_BATCH;
  shuffleOrderCache = {};
  render();
}
function handleBiasaShuffleToggle() {
  biasaShuffleOn = !biasaShuffleOn;
  biasaVisibleCount = LOAD_BATCH;
  saveBiasa();
  render();
}
function handleBiasaLoadMore() {
  biasaVisibleCount = Math.min(biasaVisibleCount + LOAD_BATCH, computeBiasaAll().length);
  render();
}
function handleAnswerBiasa(qId, letter) {
  if (biasaAnswersMap[qId] !== undefined && biasaAnswersMap[qId] !== null) return;
  biasaAnswersMap[qId] = letter;
  saveBiasa();
  render();
}
// Fill-in questions are self-graded: any submitted answer counts as correct,
// then the answer key is revealed. Locked once answered (until Reset).
function handleAnswerIsian(qId, text) {
  if (biasaAnswersMap[qId] !== undefined && biasaAnswersMap[qId] !== null) return;
  const trimmed = (text || "").trim();
  if (!trimmed) return;
  biasaAnswersMap[qId] = trimmed;
  saveBiasa();
  render();
}

// ── Timed Quiz: handlers ─────────────────────────────────────────────────
function stopTentamenTimerLoop() {
  if (tentamenTimerHandle) { clearInterval(tentamenTimerHandle); tentamenTimerHandle = null; }
  if (tentamenAdvanceHandle) { clearTimeout(tentamenAdvanceHandle); tentamenAdvanceHandle = null; }
}
function startTentamenTimerLoop() {
  stopTentamenTimerLoop();
  tentamenTimerHandle = setInterval(() => {
    if (quizMode !== "tentamen" || tentamenState !== "running" || qPhase !== "answering") return;
    if (tentamenDifficulty === "bekicot") return; // no timer
    if (timeLeft <= 1) {
      timeLeft = 0;
      tentamenAnswers[currentIdx] = "skipped";
      qPhase = "answered_timeout";
      render();
      tentamenAdvanceHandle = setTimeout(advanceOrFinish, 1800);
    } else {
      timeLeft -= 1;
      updateTimerDOM();
    }
  }, 1000);
}
// Update the timer in place (no full re-render → no blink every second).
function updateTimerDOM() {
  const cfg = DIFFICULTY_CONFIG[tentamenDifficulty];
  const maxTime = cfg.timerSeconds || 1;
  const isUrgent = timeLeft <= 10 && tentamenDifficulty !== "bekicot";
  const timerNumEl = document.getElementById("timerNum");
  const timerFillEl = document.getElementById("timerFill");
  const timerCardEl = document.getElementById("timerCard");
  const timerLabelEl = document.getElementById("timerLabel");
  if (!timerNumEl || !timerFillEl || !timerCardEl) return;

  timerNumEl.textContent = String(timeLeft).padStart(2, "0");
  timerNumEl.style.color = isUrgent ? "var(--wrong-strong)" : cfg.color;
  timerNumEl.classList.toggle("pulse", isUrgent);
  timerFillEl.style.width = (timeLeft / maxTime) * 100 + "%";
  timerFillEl.style.background = isUrgent ? "var(--wrong-strong)" : cfg.color;
  timerCardEl.classList.toggle("urgent", isUrgent);
  if (timerLabelEl) timerLabelEl.classList.toggle("urgent", isUrgent);
}
function handleStartTentamen() {
  // Broken questions have no valid content → excluded. Fill-in questions are included (self-graded).
  const quizzable = allQuestions.filter(q => !q.isBroken);
  const qs = tentamenShuffleOn ? shuffleArray(quizzable) : quizzable;
  if (!qs.length) return;
  tentamenQuestions = qs;
  tentamenAnswers = new Array(qs.length).fill(null);
  currentIdx = 0;
  timeLeft = DIFFICULTY_CONFIG[tentamenDifficulty].timerSeconds;
  qPhase = "answering";
  tentamenState = "running";
  render();
  startTentamenTimerLoop();
}
function handleResetTentamen() {
  tentamenState = "setup";
  tentamenQuestions = [];
  tentamenAnswers = [];
  stopTentamenTimerLoop();
  render();
}
function handleAnswerTentamen(letter) {
  if (tentamenAnswers[currentIdx] !== null && tentamenAnswers[currentIdx] !== undefined) return;
  tentamenAnswers[currentIdx] = letter;
  qPhase = "answered_manual";
  render();
}
function handleAnswerTentamenIsian(text) {
  if (tentamenAnswers[currentIdx] !== null && tentamenAnswers[currentIdx] !== undefined) return;
  const trimmed = (text || "").trim();
  if (!trimmed) return;
  tentamenAnswers[currentIdx] = trimmed;
  qPhase = "answered_manual";
  render();
}
function advanceOrFinish() {
  if (tentamenAdvanceHandle) { clearTimeout(tentamenAdvanceHandle); tentamenAdvanceHandle = null; }
  if (currentIdx >= tentamenQuestions.length - 1) {
    tentamenState = "finished";
    stopTentamenTimerLoop();
  } else {
    currentIdx += 1;
    timeLeft = DIFFICULTY_CONFIG[tentamenDifficulty].timerSeconds;
    qPhase = "answering";
  }
  render();
}
function handleModeChange(m) {
  if (m === quizMode) return;
  quizMode = m;
  if (m === "tentamen") {
    tentamenState = "setup";
    tentamenQuestions = [];
    tentamenAnswers = [];
  }
  stopTentamenTimerLoop();
  render();
}
function onOptionClick(qid, letter) {
  if (quizMode === "biasa") handleAnswerBiasa(qid, letter);
  else if (quizMode === "tentamen" && tentamenState === "running" && qPhase === "answering") handleAnswerTentamen(letter);
}
function onIsianSubmit(qid, text) {
  if (quizMode === "biasa") handleAnswerIsian(qid, text);
  else if (quizMode === "tentamen" && tentamenState === "running" && qPhase === "answering") handleAnswerTentamenIsian(text);
}

// Warn only while a timed quiz is running.
window.addEventListener("beforeunload", (e) => {
  if (quizMode === "tentamen" && tentamenState === "running") {
    e.preventDefault();
    e.returnValue = "";
  }
});
