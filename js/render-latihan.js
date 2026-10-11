// Header + mode bar, render Mode Latihan.
// ── Render: header + mode bar ─────────────────────────────────────────────
function renderHeaderZone() {
  const quizzableAll = allQuestions.filter(q => !q.isBroken && !q.isIsian);
  const totalQ = quizzableAll.length; // broken + fill-in aren't counted in the tracker
  let trackerHtml = "";
  if (quizMode === "biasa" && biasaLoaded) {
    const answeredCount = quizzableAll.filter(q => biasaAnswersMap[q.id] !== undefined && biasaAnswersMap[q.id] !== null).length;
    const correctCount = quizzableAll.filter(q => biasaAnswersMap[q.id] === q.answer).length;
    trackerHtml = `
      <div class="tracker">
        <div class="count mono">${answeredCount}/${totalQ}</div>
        <div class="sub">${t("trackSub", { n: `<span class="ok">${correctCount}</span>` })}</div>
      </div>
    `;
  } else if (quizMode === "tentamen" && tentamenState === "running") {
    trackerHtml = `
      <div class="tracker">
        <div class="count mono">${currentIdx + 1}/${tentamenQuestions.length}</div>
        <div class="sub">${t("questionsWord")}</div>
      </div>
    `;
  }

  const showFilterBar = quizMode === "biasa" || (quizMode === "tentamen" && tentamenState === "setup");
  const activeShuffle = quizMode === "biasa" ? biasaShuffleOn : tentamenShuffleOn;
  const showReset = (quizMode === "biasa" && biasaLoaded) || (quizMode === "tentamen" && tentamenState !== "setup");

  return `
    <div class="headerZone">
      ${headerHidden ? "" : `
      <div class="headerCollapse">
        <header>
          <div class="headerInner">
            <div class="titleRow">
              <div>
                <h1${activePackage ? ` class="pkgTitleActive"` : ""}>${activePackage ? escapeHtml(activePackage.title) : t("appTitle")}</h1>
                ${activePackage ? `<div class="pkgSubtitle">${escapeHtml(activePackage.category)}</div>` : ""}
                <button class="pkgSwitchBtn" id="pkgSwitchBtn">${activePackage ? t("switchQuiz") : t("chooseQuiz")}</button>
              </div>
              ${trackerHtml}
            </div>
          </div>
        </header>
      </div>

      <div class="modeBar">
        <div class="modeBarInner">
          <button class="hideToggleBtn${headerHidden ? " active" : ""}" id="hideHeaderBtn" title="${t("hideHeader")}" aria-label="${t("hideHeader")}">
            <span class="arrow">\u25B2</span>
          </button>
          <button class="pillBtn${quizMode === "biasa" ? " active" : ""}" data-mode="biasa">${t("modeQuiz")}</button>
          <button class="pillBtn${quizMode === "tentamen" ? " active" : ""}" data-mode="tentamen">${t("modeTimed")}</button>
          ${showFilterBar ? `<button class="shuffleBtn${activeShuffle ? " active" : ""}" id="shuffleBtn">${t("shuffle", { s: activeShuffle ? "ON" : "OFF" })}</button>` : ""}
          ${showReset ? `<button class="resetBtn" id="resetBtn">${t("reset")}</button>` : ""}
        </div>
      </div>`}

      ${headerHidden ? `
      <div class="collapsedToggleWrap">
        <button class="hideToggleBtn" id="hideHeaderBtn" title="${t("showHeader")}" aria-label="${t("showHeader")}">
          <span class="arrow" style="transform:rotate(180deg);">\u25B2</span>
        </button>
      </div>` : ""}
    </div>
  `;
}

// ── Render: Quiz mode ─────────────────────────────────────────────────────
function renderBiasaMode() {
  const allQ = computeBiasaAll();
  const visible = allQ.slice(0, biasaVisibleCount);
  const quizzableQ = allQ.filter(q => !q.isBroken && !q.isIsian);
  const answeredCount = quizzableQ.filter(q => biasaAnswersMap[q.id] !== undefined && biasaAnswersMap[q.id] !== null).length;
  const correctCount = quizzableQ.filter(q => biasaAnswersMap[q.id] === q.answer).length;
  const totalCount = quizzableQ.length;
  const pct = totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0;
  const allDone = answeredCount === totalCount && totalCount > 0;
  const remaining = allQ.length - visible.length;

  let html = `
    <div class="progressCard">
      <div class="progressTop">
        <span class="left">${t("answered")}: <span class="num mono">${answeredCount}</span> / ${t("total")}: <span class="num total mono">${totalCount}</span></span>
        <div style="display:flex; gap:12px;">
          <span class="statChip"><span class="dot" style="background:var(--correct);"></span><span class="mono" style="color:var(--correct); font-weight:700;">${correctCount}</span><span style="color:var(--muted2);">${t("correct")}</span></span>
          <span class="statChip"><span class="dot" style="background:var(--wrong);"></span><span class="mono" style="color:var(--wrong); font-weight:700;">${answeredCount - correctCount}</span><span style="color:var(--muted2);">${t("wrong")}</span></span>
        </div>
      </div>
      <div class="progressTrack"><div class="progressFill" style="width:${pct}%;"></div></div>
    </div>
  `;

  if (allDone) {
    html += `
      <div class="doneBanner">
        <span style="font-size:1.3rem;">\uD83C\uDFC6</span>
        <div>
          <span class="title">${t("done")}</span>
          <span class="sub">${t("finalScore", { c: correctCount, t: totalCount, p: Math.round((correctCount / totalCount) * 100) })}</span>
        </div>
      </div>
    `;
  }

  if (allQ.length === 0) return html + `<div class="empty">${t("noQuestions")}</div>`;

  html += `<div class="qList">`;
  let deckShown = false;
  visible.forEach((q, idx) => {
    if (q.isBroken) {
      if (!deckShown) { html += renderBrokenDeck(allQ.filter(x => x.isBroken)); deckShown = true; }
    } else if (q.isIsian) {
      html += renderIsianCard(q, idx + 1, biasaAnswersMap[q.id]);
    } else {
      html += renderQuestionCard(q, idx + 1, biasaAnswersMap[q.id], true);
    }
  });
  html += `</div>`;

  if (remaining > 0) html += `<button class="loadMoreBtn" id="loadMoreBtn">${t("loadMore", { n: Math.min(LOAD_BATCH, remaining) })}</button>`;
  return html;
}
