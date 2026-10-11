// Mode Tentamen: setup, running, hasil.
// ── Render: Timed Quiz — setup ────────────────────────────────────────────
const timerText = (d) => d === "bekicot" ? t("d_bekicot_timer") : t("timerPer", { n: DIFFICULTY_CONFIG[d].timerSeconds });
function renderTentamenSetup() {
  const qCount = allQuestions.filter(q => !q.isBroken).length;
  const cfg = DIFFICULTY_CONFIG[tentamenDifficulty];
  const timerSec = cfg.timerSeconds;
  const estLabel = timerSec === 0 ? "\u221E"
    : qCount * timerSec < 60 ? t("estSec", { n: qCount * timerSec }) : t("estMin", { n: Math.ceil(qCount * timerSec / 60) });

  let html = `<div class="quiz-fade-in">`;
  html += `<div style="margin-bottom:16px;">
    <div class="sectionLabel">${t("difficulty")}</div>
    <div class="diffGrid">`;
  Object.keys(DIFFICULTY_CONFIG).forEach(d => {
    const dcfg = DIFFICULTY_CONFIG[d];
    const active = tentamenDifficulty === d;
    html += `
      <button class="diffCard${active ? " active" : ""}" data-diff="${d}" style="${active ? `border-color:${dcfg.color}; background:${dcfg.color}18;` : ""}">
        <div class="diffTop">
          <span class="diffEmoji">${dcfg.emoji}</span>
          <span class="diffLabel" style="color:${active ? dcfg.color : "var(--text)"};">${t("d_" + d)}</span>
        </div>
        <div class="diffDesc">${escapeHtml(t("d_" + d + "_desc"))}</div>
        <div class="diffTimer" style="color:${active ? dcfg.color : "var(--muted3)"};">${timerText(d)}</div>
      </button>
    `;
  });
  html += `</div></div>`;

  html += `<div class="statsRow3">
    <div class="statBox2"><div class="val">${qCount}</div><div class="lbl">${t("statQ")}</div></div>
    <div class="statBox2"><div class="val">${timerSec === 0 ? "\u221E" : timerSec + "s"}</div><div class="lbl">${t("statTimer")}</div></div>
    <div class="statBox2"><div class="val">${estLabel}</div><div class="lbl">${t("statEst")}</div></div>
  </div>`;

  html += `<button class="startTentamenBtn" id="startTentamenBtn" style="background:${cfg.color};" ${qCount === 0 ? "disabled" : ""}>
    ${t("startTimed", { d: `${cfg.emoji} ${t("d_" + tentamenDifficulty)}` })}
  </button>`;
  return html + `</div>`;
}

// ── Render: Timed Quiz — running ──────────────────────────────────────────
function renderTentamenRunning() {
  const q = tentamenQuestions[currentIdx];
  if (!q) return `<div class="empty">${t("noQuestions")}</div>`;
  const cfg = DIFFICULTY_CONFIG[tentamenDifficulty];
  const maxTime = cfg.timerSeconds || 1;
  const isAnswering = qPhase === "answering";
  const isManual = qPhase === "answered_manual";
  const isTimeout = qPhase === "answered_timeout";
  const noTimer = tentamenDifficulty === "bekicot";
  const isUrgent = timeLeft <= 10 && isAnswering && !noTimer;
  const timerPct = noTimer ? 100 : (timeLeft / maxTime) * 100;
  const total = tentamenQuestions.length;
  const qNum = currentIdx + 1;

  // Fade in only when this question first appears, not on every re-render.
  const freshKey = tentamenState + "|" + currentIdx;
  const isFreshQuestion = freshKey !== tentamenFadeKey;
  tentamenFadeKey = freshKey;
  let html = `<div class="${isFreshQuestion ? "quiz-fade-in" : ""}">`;

  html += `<div class="tentamenTop">
    <span class="qOf">${t("questionOf", { n: `<span class="mono" style="color:var(--accent); font-weight:700;">${qNum}</span>`, t: total })}</span>
    <div class="dotsRow">`;
  const dotCount = Math.min(total, 15);
  for (let i = 0; i < dotCount; i++) {
    html += `<div class="dotItem${i < qNum - 1 ? " done" : ""}${i === qNum - 1 ? " current" : ""}"></div>`;
  }
  if (total > 15) html += `<span class="dotsOverflow">+${total - 15}</span>`;
  html += `</div></div>`;

  html += `<div class="timerCard${isUrgent ? " urgent" : ""}${isTimeout ? " timeoutFlash" : ""}" id="timerCard">
    <div class="timerTop">
      <div class="timerLabel${isUrgent ? " urgent" : ""}" id="timerLabel">
        \u23F1 ${noTimer ? t("noTimer") : isAnswering ? t("timeLeft") : isTimeout ? t("timeUp") : t("finished")}
      </div>
      <span class="timerNum${isUrgent ? " pulse" : ""}" id="timerNum" style="color:${isUrgent ? "var(--wrong-strong)" : cfg.color};">
        ${noTimer ? "\u221E" : String(isTimeout ? 0 : timeLeft).padStart(2, "0")}
      </span>
    </div>
    <div class="timerTrack"><div class="timerFill" id="timerFill" style="background:${isUrgent ? "var(--wrong-strong)" : cfg.color}; width:${noTimer ? 100 : isAnswering ? timerPct : isTimeout ? 0 : 100}%;"></div></div>
  </div>`;

  html += q.isIsian
    ? renderIsianCard(q, qNum, tentamenAnswers[currentIdx])
    : renderQuestionCard(q, qNum, tentamenAnswers[currentIdx], qPhase !== "answering");

  if (isTimeout) html += `<div class="timeoutNotice">\u26A0\uFE0F <span>${t("timeoutNotice")}</span></div>`;
  if (isManual) html += `<button class="nextBtn" id="nextTentamenBtn">${qNum < total ? t("nextQ") : t("seeResults")}</button>`;
  return html + `</div>`;
}

// ── Render: Timed Quiz — results ──────────────────────────────────────────
function renderTentamenResults() {
  const total = tentamenQuestions.length;
  const correct = tentamenAnswers.filter((a, i) => {
    if (typeof a !== "string" || a === "skipped") return false;
    const q = tentamenQuestions[i];
    return q?.isIsian ? true : a === q?.answer; // fill-in is self-graded
  }).length;
  const skipped = tentamenAnswers.filter(a => a === "skipped").length;
  const wrong = total - correct - skipped;
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  const gradeColor = pct >= 80 ? "var(--correct)" : pct >= 60 ? "var(--accent)" : "var(--wrong)";
  const gradeLabel = pct >= 80 ? t("gradeA") : pct >= 60 ? t("gradeB") : t("gradeC");
  const share = (n) => total ? Math.round((n / total) * 100) : 0;

  let html = `<div class="quiz-fade-in">`;
  html += `
    <div class="scoreHero">
      <div class="trophy">\uD83C\uDFC6</div>
      <div class="pct" style="color:${gradeColor};">${pct}%</div>
      <div class="gradeLabel" style="color:${gradeColor};">${gradeLabel}</div>
      <div class="subline">${t("scoreLine", { c: correct, t: total })}</div>
    </div>
    <div class="statsGrid statsGrid3">
      <div class="statBox" style="background:#16a34a20; border-color:#16a34a40; color:var(--correct);"><div class="val mono">${correct}</div><div class="lbl">${t("lblCorrect")}</div></div>
      <div class="statBox" style="background:#ef444420; border-color:#ef444440; color:var(--wrong);"><div class="val mono">${wrong}</div><div class="lbl">${t("lblWrong")}</div></div>
      <div class="statBox" style="background:#94a3b818; border-color:#94a3b835; color:#94a3b8;"><div class="val mono">${skipped}</div><div class="lbl">${t("lblSkipped")}</div></div>
    </div>
    <div class="progressCard">
      <div style="font-size:0.75rem; color:var(--muted2); margin-bottom:8px;">${t("dist")}</div>
      <div class="distBar">
        ${correct > 0 ? `<div style="flex:${correct}; background:var(--correct);"></div>` : ""}
        ${wrong > 0 ? `<div style="flex:${wrong}; background:var(--wrong);"></div>` : ""}
        ${skipped > 0 ? `<div style="flex:${skipped}; background:#475569;"></div>` : ""}
      </div>
      <div class="distLegend">
        <span style="color:var(--correct);">${t("pctCorrect", { p: pct })}</span>
        <span style="color:var(--wrong);">${t("pctWrong", { p: share(wrong) })}</span>
        <span style="color:#94a3b8;">${t("pctSkipped", { p: share(skipped) })}</span>
      </div>
    </div>
    <button class="restartBtn" id="restartTentamenBtn">${t("retake")}</button>
    <div class="reviewLabel">${t("details")}</div>
    <div class="reviewList">`;
  tentamenQuestions.forEach((q, idx) => {
    html += q.isIsian
      ? renderIsianCard(q, idx + 1, tentamenAnswers[idx])
      : renderQuestionCard(q, idx + 1, tentamenAnswers[idx], true);
  });
  return html + `</div></div>`;
}
