// ── Main render ───────────────────────────────────────────────────────────
function render() {
  document.body.classList.toggle("light", theme === "light");
  document.documentElement.lang = lang;
  document.title = "Soalin Portable";

  if (pickerOpen || !allQuestions || allQuestions.length === 0) {
    app.innerHTML = renderPickerScreen();
    attachPickerHandlers();
    return;
  }

  let html = renderHeaderZone();
  html += `<main class="wrap">`;
  if (quizMode === "biasa") {
    html += biasaLoaded ? renderBiasaMode() : `<div class="empty">${t("loading")}</div>`;
  } else if (tentamenState === "setup") html += renderTentamenSetup();
  else if (tentamenState === "running") html += renderTentamenRunning();
  else html += renderTentamenResults();
  html += `</main>`;

  // innerHTML swap can make the browser jump to top for a frame → keep scroll position.
  const prevScrollY = window.scrollY;
  app.innerHTML = html;
  window.scrollTo(0, prevScrollY);
  attachHandlers();
}

function attachHandlers() {
  app.querySelectorAll(".brokenCard[data-broken-id]").forEach(card => {
    card.addEventListener("click", () => {
      const id = card.dataset.brokenId;
      if (!brokenRevealed.delete(id)) brokenRevealed.add(id);
      render();
    });
  });
  app.querySelectorAll("[data-broken-nav]").forEach(btn => {
    btn.addEventListener("click", () => { brokenIdx += Number(btn.dataset.brokenNav); render(); });
  });
  app.querySelectorAll(".option[data-letter]").forEach(btn => {
    btn.addEventListener("click", () => onOptionClick(btn.dataset.qid, btn.dataset.letter));
  });
  // Fill-in: ▶ button or Enter (without Shift) submits.
  app.querySelectorAll(".isianSubmitBtn[data-qid]").forEach(btn => {
    btn.addEventListener("click", () => {
      const ta = btn.closest(".isianInputRow")?.querySelector("textarea.isianInput");
      onIsianSubmit(btn.dataset.qid, ta ? ta.value : "");
    });
  });
  app.querySelectorAll("textarea.isianInput[data-qid]").forEach(ta => {
    ta.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" || e.shiftKey) return;
      e.preventDefault();
      onIsianSubmit(ta.dataset.qid, ta.value);
    });
  });

  const on = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener("click", fn); };
  on("hideHeaderBtn", () => { headerHidden = !headerHidden; render(); });
  app.querySelectorAll(".pillBtn[data-mode]").forEach(btn => btn.addEventListener("click", () => handleModeChange(btn.dataset.mode)));
  on("resetBtn", () => quizMode === "biasa" ? handleResetBiasa() : handleResetTentamen());
  on("shuffleBtn", () => { if (quizMode === "biasa") handleBiasaShuffleToggle(); else { tentamenShuffleOn = !tentamenShuffleOn; render(); } });
  on("loadMoreBtn", handleBiasaLoadMore);
  app.querySelectorAll(".diffCard[data-diff]").forEach(btn => btn.addEventListener("click", () => { tentamenDifficulty = btn.dataset.diff; render(); }));
  on("startTentamenBtn", handleStartTentamen);
  on("nextTentamenBtn", advanceOrFinish);
  on("restartTentamenBtn", handleResetTentamen);
  on("pkgSwitchBtn", () => { pickerOpen = true; dropMsg = ""; refreshEst(); render(); });
}

// ── Boot ───────────────────────────────────────────────────────────────────
async function boot() {
  await loadPackages();
  refreshEst();
  let id;
  try { id = localStorage.getItem(ACTIVE_PKG_KEY); } catch { id = null; }
  const saved = packages.find((p) => p.id === id);
  if (saved) await selectPackage(saved);
  render();
}
boot();
