// ── Render: broken-question flashcards (one per screen, tap → explanation) ──
const brokenRevealed = new Set();
let brokenIdx = 0;
function renderBrokenDeck(list) {
  const n = list.length;
  brokenIdx = Math.min(Math.max(brokenIdx, 0), n - 1);
  const q = list[brokenIdx];
  const open = brokenRevealed.has(q.id);
  const qImgs = q.questionImages || [], eImgs = q.explanationImages || [];
  const hasExp = !!q.explanation || eImgs.length > 0;

  const revealHtml = open ? `
    <div class="brokenReveal">
      <div class="tag">${t("expTag")}</div>
      ${q.explanation ? `<p class="brokenExp">${escapeHtml(q.explanation)}</p>` : ""}
      ${eImgs.map(src => `<img class="exImg" src="${src}" alt="${t("expImgAlt")}">`).join("")}
      ${hasExp ? "" : `<p class="noImg">${t("noExpDoc")}</p>`}
    </div>` : "";

  return `
    <div class="brokenDeck">
      <div class="brokenCard" data-broken-id="${escapeHtml(q.id)}">
        <div class="brokenMeta">
          <span class="brokenBadge">${t("brokenBadge")}</span>
          <span class="tapHint">${open ? t("tapClose") : t("tapOpen")}</span>
          <span class="brokenCount">${brokenIdx + 1} / ${n}</span>
        </div>
        <p class="brokenQ">${escapeHtml(q.question)}</p>
        ${qImgs.map(src => `<img class="exImg" src="${src}" alt="${t("imgAlt")}">`).join("")}
        ${revealHtml}
      </div>
      <div class="brokenNav">
        <button data-broken-nav="-1" ${brokenIdx === 0 ? "disabled" : ""}>${t("prev")}</button>
        <button data-broken-nav="1" ${brokenIdx === n - 1 ? "disabled" : ""}>${t("next")}</button>
      </div>
    </div>
  `;
}

// ── Render: fill-in card (textarea → submit → reveal answer key) ──────────
// answeredValue: empty = unanswered · "skipped" = time ran out · other = submitted text
function renderIsianCard(q, qNum, answeredValue) {
  const isSkipped = answeredValue === "skipped";
  const isAnswered = !isSkipped && answeredValue !== undefined && answeredValue !== null && answeredValue !== "";
  const keyHtml = `
        <div class="explanation">
          <div class="tag">${t("keyTag")}</div>
          <p>${escapeHtml(q.answer || t("noKey"))}</p>
        </div>`;

  let bodyHtml;
  if (isSkipped) {
    bodyHtml = `<div class="isianReveal"><div class="skipNote">${t("skippedNote")}</div>${keyHtml}</div>`;
  } else if (isAnswered) {
    bodyHtml = `
      <div class="isianReveal">
        <div class="isianYourAnswer">
          <div class="tag">${t("yourAnswer")} <span class="icon ok">✓</span> <span class="isianCorrectLabel">${t("correctLbl")}</span></div>
          <p>${escapeHtml(answeredValue)}</p>
        </div>${keyHtml}
      </div>`;
  } else {
    bodyHtml = `
      <div class="isianInputRow">
        <textarea class="isianInput" data-qid="${escapeHtml(q.id)}" rows="2" placeholder="${t("typeHere")}"></textarea>
        <button class="isianSubmitBtn" data-qid="${escapeHtml(q.id)}" title="${t("submit")}" aria-label="${t("submit")}">▶</button>
      </div>`;
  }

  return `
    <div class="qCard isianCard">
      <div class="qMeta">
        <span class="isianBadge">${t("fillBadge")}</span>
        ${(q.questionImages || []).length > 0 ? `<span class="imgBadge">${t("hasImage")}</span>` : ""}
        ${isAnswered ? `<span class="tapHint">${t("answeredHint")}</span>` : ""}
      </div>
      <p class="qText"><span class="qNum mono">${qNum}.</span>${escapeHtml(q.question)}</p>
      ${(q.questionImages || []).map(src => `<img class="qImg" src="${src}" alt="${t("imgAlt")}">`).join("")}
      ${bodyHtml}
    </div>
  `;
}

// ── Render: multiple-choice card ──────────────────────────────────────────
function renderQuestionCard(q, qNum, chosen, revealAnswer) {
  const isAnswered = chosen !== undefined && chosen !== null;
  const showState = revealAnswer && isAnswered;

  const optionsHtml = Object.entries(q.options).map(([letter, text]) => {
    let cls = "option", letterCls = "letter", icon = "";
    const locked = isAnswered ? " locked" : "";
    if (!showState) {
      if (chosen === letter) cls += " selected";
    } else if (letter === q.answer) {
      cls += " correct"; letterCls += " correct";
      if (chosen === letter) icon = `<span class="icon ok">\u2713</span>`;
    } else if (letter === chosen) {
      cls += " wrong"; letterCls += " wrong";
      icon = `<span class="icon no">\u2715</span>`;
    } else {
      cls += " faded"; letterCls += " faded";
    }
    return `
      <button class="${cls}${locked}" data-qid="${escapeHtml(q.id)}" data-letter="${escapeHtml(letter)}">
        <span class="${letterCls}" data-letter="${letter}">${letter}</span>
        <span class="optText">${escapeHtml(text)}</span>
        ${icon}
      </button>
    `;
  }).join("");

  const skipNoteHtml = (showState && chosen === "skipped") ? `<div class="skipNote">${t("skippedNote")}</div>` : "";
  const explanationHtml = showState ? `
    <div class="explanation">
      <div class="tag">${t("expTag2")}</div>
      <p>${escapeHtml(q.explanation || t("noExp"))}</p>
      ${(q.explanationImages || []).map(src => `<img class="exImg" src="${src}" alt="${t("expImgAlt")}">`).join("")}
    </div>
  ` : "";

  return `
    <div class="qCard">
      <div class="qMeta">
        ${(q.questionImages || []).length > 0 ? `<span class="imgBadge">${t("hasImage")}</span>` : ""}
      </div>
      <p class="qText"><span class="qNum mono">${qNum}.</span>${escapeHtml(q.question)}</p>
      ${(q.questionImages || []).map(src => `<img class="qImg" src="${src}" alt="${t("imgAlt")}">`).join("")}
      <div class="options">${optionsHtml}</div>
      ${skipNoteHtml}
      ${explanationHtml}
    </div>
  `;
}
