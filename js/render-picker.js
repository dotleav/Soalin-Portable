// Pemilih paket, pengaturan, kartu Custom Quiz.
// ── Render: quiz picker + settings ────────────────────────────────────────
function renderSettingsCard() {
  const opt = (attr, val, cur, label) => `<button class="themeModeOption${val === cur ? " active" : ""}" ${attr}="${val}">${label}</button>`;
  return `
    <div class="settingsCard">
      <div class="sectionLabel">${t("settings")}</div>
      <div class="settingsRow settingsRow-noBorder">
        <div class="settingsRowText">
          <span class="settingsRowTitle">${t("themeLbl")}</span>
          <span class="settingsRowDesc">${t("themeDesc")}</span>
        </div>
      </div>
      <div class="themeModeOptions">${opt("data-theme-value", "dark", theme, t("dark"))}${opt("data-theme-value", "light", theme, t("light"))}</div>
      <div class="settingsRow settingsRow-noBorder">
        <div class="settingsRowText">
          <span class="settingsRowTitle">${t("langLbl")}</span>
          <span class="settingsRowDesc">${t("langDesc")}</span>
        </div>
      </div>
      <div class="themeModeOptions" style="border-bottom:none;padding-bottom:0;">${opt("data-lang-value", "en", lang, "English")}${opt("data-lang-value", "id", lang, "Bahasa Indonesia")}</div>
    </div>`;
}

function renderStorageMeter() {
  if (!packages.length) return "";
  const used = packages.reduce((n, p) => n + p.size, 0);
  if (!est?.quota) return `<div class="storageInfo">${t("storageOnly", { a: fmtBytes(used) })}</div>`;
  const pct = (est.usage / est.quota) * 100;
  const room = Math.floor((est.quota - est.usage) / (used / packages.length));
  return `
    <div class="storageInfo">
      ${t("storageUsed", { a: fmtBytes(used), b: fmtBytes(est.usage), c: fmtBytes(est.quota), p: pct < 0.1 ? "<0.1" : pct.toFixed(1) })}
      ${room > 0 ? t("roomFor", { n: room.toLocaleString(lang === "id" ? "id-ID" : "en-US") }) : ""}
      <div class="progressTrack"><div class="progressFill" style="width:${Math.min(100, Math.max(pct, 0.5))}%;"></div></div>
    </div>`;
}

function renderLibraryCard() {
  return `
    <div class="categoryGroup">
      <div class="customHead">
        <span class="catName">${t("customHead", { n: packages.length })}</span>
        <span class="catMeta">${t("noLimit")}</span>
      </div>
      <input type="file" id="docxInput" accept=".docx" multiple hidden>
      ${packages.map((p) => `
        <div class="pkgRow">
          <button class="packageItem${activePackage?.id === p.id ? " active" : ""}" data-pkg="${escapeAttr(p.id)}">
            <span class="pkgTitle">${escapeHtml(p.title)}</span>
            <span class="pkgMeta">${t("quizMeta", { n: p.count, s: fmtBytes(p.size), d: fmtDate(p.savedAt) })}</span>
          </button>
          <button class="pkgDel" data-del="${escapeAttr(p.id)}" title="${t("delQuiz")}" aria-label="${t("delQuiz")}">\uD83D\uDDD1\uFE0F</button>
        </div>`).join("")}
      <label class="dropZone" for="docxInput">
        <span class="dropIcon">\uD83D\uDCC4</span>
        <span class="dropTitle">${t("dropTitle")}</span>
        <span class="dropHint">${t("dropHint")}</span>
      </label>
      ${dropMsg ? `<div class="dropMsg">${escapeHtml(dropMsg)}</div>` : ""}
      ${renderStorageMeter()}
      <div class="dropFormat">${t("dropFormat")}</div>
    </div>`;
}

function renderPickerScreen() {
  return `
    <main class="wrap">
      <div class="pickerHeader">
        <h1>${t("pickerTitle")}</h1>
        <p class="pickerSub">${packages.length ? t("pickerSub") : t("pickerSubEmpty")}</p>
      </div>
      <div class="categoryList">${renderLibraryCard()}</div>
      ${renderSettingsCard()}
      ${allQuestions.length ? `<button class="pickerCloseBtn" id="pickerCloseBtn">${t("backCurrent")}</button>` : ""}
    </main>`;
}

function attachPickerHandlers() {
  app.querySelectorAll(".packageItem[data-pkg]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const meta = packages.find((p) => p.id === btn.dataset.pkg);
      if (!meta) return;
      await selectPackage(meta);
      pickerOpen = !allQuestions.length;
      render();
    });
  });
  app.querySelectorAll(".pkgDel[data-del]").forEach((btn) => btn.addEventListener("click", () => deleteQuiz(btn.dataset.del)));
  const closeBtn = document.getElementById("pickerCloseBtn");
  if (closeBtn) closeBtn.addEventListener("click", () => { pickerOpen = false; render(); });
  document.getElementById("docxInput").addEventListener("change", (e) => handleDocx(e.target.files));
  document.querySelectorAll("[data-theme-value]").forEach((b) => b.addEventListener("click", () => { setTheme(b.dataset.themeValue); render(); }));
  document.querySelectorAll("[data-lang-value]").forEach((b) => b.addEventListener("click", () => { setLang(b.dataset.langValue); if (activePackage) activePackage.category = t("customQuiz"); render(); }));
}
