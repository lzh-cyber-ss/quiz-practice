const subjects = {
  software: {
    label: "ソフトウェア",
    pages: window.QUIZ_DATA || [],
    sessionKey: "sharedSoftwareQuizSessionV1",
    wrongBankKey: "sharedSoftwareQuizWrongBankV1"
  },
  hardware: {
    label: "ハードウェア",
    pages: window.HARDWARE_QUIZ_DATA || [],
    sessionKey: "sharedHardwareQuizSessionV1",
    wrongBankKey: "sharedHardwareQuizWrongBankV1"
  }
};

const subjectKey = "sharedQuizActiveSubjectV1";
const choiceKeys = ["ア", "イ", "ウ", "エ"];
let activeSubject = localStorage.getItem(subjectKey) || "software";
if (!subjects[activeSubject]) activeSubject = "software";
let sourceQuestions = [];
let sourceIndexById = {};
let uniqueSourceIndexes = [];

const els = {
  answerMark: document.querySelector("#answerMark"),
  paperName: document.querySelector("#paperName"),
  questionNo: document.querySelector("#questionNo"),
  questionText: document.querySelector("#questionText"),
  questionHint: document.querySelector("#questionHint"),
  questionFigure: document.querySelector("#questionFigure"),
  options: document.querySelector("#options"),
  feedback: document.querySelector("#feedback"),
  list: document.querySelector("#questionList"),
  doneCount: document.querySelector("#doneCount"),
  accuracy: document.querySelector("#accuracy"),
  wrongCount: document.querySelector("#wrongCount"),
  prev: document.querySelector("#prevBtn"),
  next: document.querySelector("#nextBtn"),
  random: document.querySelector("#randomBtn"),
  reset: document.querySelector("#resetBtn"),
  modes: document.querySelectorAll(".mode"),
  resultDialog: document.querySelector("#resultDialog"),
  resultTime: document.querySelector("#resultTime"),
  resultAccuracy: document.querySelector("#resultAccuracy"),
  resultDetail: document.querySelector("#resultDetail"),
  closeResult: document.querySelector("#closeResultBtn"),
  newRound: document.querySelector("#newRoundBtn"),
  startPanel: document.querySelector("#startPanel"),
  start25: document.querySelector("#start25Btn"),
  start52: document.querySelector("#start52Btn"),
  startWrong: document.querySelector("#startWrongBtn"),
  wrongBankCount: document.querySelector("#wrongBankCount"),
  quizOnly: document.querySelectorAll(".quizOnly"),
  subjectButtons: document.querySelectorAll(".subject")
};

function buildSourceQuestions(subject) {
  return subjects[subject].pages.flatMap((page, pageIndex) =>
    page.questions.map((question, questionIndex) => ({
      ...question,
      id: `${subject}-${page.paper}-${question.no}-${questionIndex}`,
      subject,
      paper: page.paper,
      pageIndex
    }))
  );
}

function refreshSourceQuestions() {
  sourceQuestions = buildSourceQuestions(activeSubject);
  sourceIndexById = Object.fromEntries(sourceQuestions.map((question, index) => [question.id, index]));
  uniqueSourceIndexes = uniqueQuestionIndexes();
}

function storageKey() {
  return subjects[activeSubject].sessionKey;
}

function wrongBankKey() {
  return subjects[activeSubject].wrongBankKey;
}

function shuffledOrder(length) {
  const order = Array.from({ length }, (_, index) => index);
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

function questionSignature(question) {
  return (question.text || question.hint || "")
    .replace(/\s+/g, "")
    .replace(/[，、。．.]/g, "");
}

function uniqueQuestionIndexes() {
  const seen = new Set();
  return sourceQuestions
    .map((question, index) => ({ question, index }))
    .filter(({ question }) => {
      const signature = questionSignature(question);
      if (seen.has(signature)) return false;
      seen.add(signature);
      return true;
    })
    .map(({ index }) => index);
}

refreshSourceQuestions();

function createChoiceOrders(order) {
  return Object.fromEntries(
    order.map((sourceIndex) => {
      const question = sourceQuestions[sourceIndex];
      return [question.id, shuffledOrder(question.choices.length)];
    })
  );
}

function uniqueIndexesFromIds(ids) {
  const seen = new Set();
  return ids
    .map((id) => sourceIndexById[id])
    .filter((index) => Number.isInteger(index))
    .filter((index) => {
      const signature = questionSignature(sourceQuestions[index]);
      if (seen.has(signature)) return false;
      seen.add(signature);
      return true;
    });
}

function loadWrongBank() {
  try {
    const saved = JSON.parse(localStorage.getItem(wrongBankKey()) || "[]");
    if (!Array.isArray(saved)) return [];
    return uniqueIndexesFromIds(saved).map((index) => sourceQuestions[index].id);
  } catch (_) {
    return [];
  }
}

function saveWrongBank(ids) {
  const normalized = uniqueIndexesFromIds(ids).map((index) => sourceQuestions[index].id);
  localStorage.setItem(wrongBankKey(), JSON.stringify(normalized));
  return normalized;
}

function wrongBankIndexes() {
  return uniqueIndexesFromIds(loadWrongBank());
}

function createSessionFromIndexes(indexes, roundType = "normal") {
  const order = shuffledOrder(indexes.length).map((index) => indexes[index]);
  return {
    order,
    choiceOrders: createChoiceOrders(order),
    answers: {},
    roundSize: order.length,
    roundType,
    startedAt: Date.now(),
    finishedAt: null,
    resultShown: false,
    wrongBankUpdated: false
  };
}

function createSession(size = sourceQuestions.length) {
  const safeSize = Math.min(Math.max(size, 1), uniqueSourceIndexes.length);
  return createSessionFromIndexes(shuffledOrder(uniqueSourceIndexes.length).map((index) => uniqueSourceIndexes[index]).slice(0, safeSize));
}

function createWrongSession() {
  const indexes = wrongBankIndexes();
  if (!indexes.length) return null;
  return createSessionFromIndexes(indexes, "wrongBank");
}

function updateWrongBankButton() {
  const count = wrongBankIndexes().length;
  els.wrongBankCount.textContent = count;
  els.startWrong.disabled = count === 0;
  els.startWrong.title = count === 0 ? "復習する問題はありません" : `${count}問を復習`;
}

function updateWrongBankFromSession() {
  if (!session || !session.finishedAt || session.wrongBankUpdated) return;
  const bank = new Set(loadWrongBank());

  flatQuestions.forEach((question) => {
    const record = session.answers[question.id];
    if (!record) return;
    if (record.choice === question.answer) {
      bank.delete(question.id);
    } else {
      bank.add(question.id);
    }
  });

  saveWrongBank([...bank]);
  session.wrongBankUpdated = true;
  updateWrongBankButton();
}

function validSession(value) {
  const hasUniqueQuestions =
    Array.isArray(value?.order) &&
    new Set(value.order.map((index) => questionSignature(sourceQuestions[index]))).size === value.order.length;

  const hasChoiceOrders =
    value?.choiceOrders &&
    typeof value.choiceOrders === "object" &&
    Array.isArray(value.order) &&
    value.order.every((sourceIndex) => {
      const question = sourceQuestions[sourceIndex];
      const order = value.choiceOrders[question.id];
      return (
        Array.isArray(order) &&
        order.length === question.choices.length &&
        new Set(order).size === order.length &&
        order.every((item) => Number.isInteger(item) && item >= 0 && item < question.choices.length)
      );
    });

  return (
    value &&
    Array.isArray(value.order) &&
    value.order.length >= 1 &&
    value.order.length <= uniqueSourceIndexes.length &&
    new Set(value.order).size === value.order.length &&
    value.order.every((item) => Number.isInteger(item) && item >= 0 && item < sourceQuestions.length) &&
    hasUniqueQuestions &&
    hasChoiceOrders &&
    value.answers &&
    typeof value.answers === "object"
  );
}

function loadSession() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey()) || "null");
    if (validSession(saved)) return saved;
  } catch (_) {
    // Ignore invalid persisted state and start a fresh round.
  }
  return null;
}

let session = loadSession();
let flatQuestions = session ? session.order.map((index) => sourceQuestions[index]) : [];
let currentIndex = session ? firstUnansweredIndex() ?? 0 : 0;

function save() {
  if (session) localStorage.setItem(storageKey(), JSON.stringify(session));
}

function clearSession() {
  session = null;
  flatQuestions = [];
  currentIndex = 0;
  localStorage.removeItem(storageKey());
}

function showStart() {
  renderSubjectButtons();
  updateWrongBankButton();
  els.startPanel.hidden = false;
  els.quizOnly.forEach((item) => {
    item.hidden = true;
  });
}

function renderSubjectButtons() {
  document.documentElement.dataset.subject = activeSubject;
  els.subjectButtons.forEach((button) => {
    const isActive = button.dataset.subject === activeSubject;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
  const total = uniqueSourceIndexes.length;
  els.start52.textContent = `${total}問`;
  els.start25.disabled = total < 25;
  els.start25.textContent = total >= 25 ? "25問" : `${total}問`;
  document.querySelector(".topbar .eyebrow").textContent = `${subjects[activeSubject].label} 演習問題`;
}

function showQuiz() {
  els.startPanel.hidden = true;
  els.quizOnly.forEach((item) => {
    item.hidden = false;
  });
}

function getChoiceKey(choice) {
  return typeof choice === "string" ? choice : choice.key;
}

function getChoiceText(choice) {
  return typeof choice === "string" ? choice : choice.text;
}

function displayChoices(question) {
  const order = session?.choiceOrders?.[question.id] || question.choices.map((_, index) => index);
  return order.map((choiceIndex, displayIndex) => {
    const choice = question.choices[choiceIndex];
    return {
      displayKey: choiceKeys[displayIndex],
      originalKey: getChoiceKey(choice),
      text: getChoiceText(choice)
    };
  });
}

function displayChoiceForOriginalKey(question, originalKey) {
  return displayChoices(question).find((choice) => choice.originalKey === originalKey);
}

function records() {
  if (!session) return [];
  return flatQuestions.map((question) => session.answers[question.id]).filter(Boolean);
}

function answeredCount() {
  return records().length;
}

function isFinished() {
  return Boolean(session?.finishedAt);
}

function hasAnsweredAll() {
  return Boolean(session) && answeredCount() === flatQuestions.length;
}

function firstUnansweredIndex() {
  if (!session) return null;
  const index = flatQuestions?.findIndex((question) => !session.answers[question.id]);
  return index >= 0 ? index : null;
}

function nextUnansweredIndex(fromIndex, direction = 1) {
  if (!session || hasAnsweredAll()) return null;
  for (let step = 1; step <= flatQuestions.length; step += 1) {
    const index = (fromIndex + step * direction + flatQuestions.length) % flatQuestions.length;
    if (!session.answers[flatQuestions[index].id]) return index;
  }
  return null;
}

function randomUnansweredIndex() {
  const indexes = flatQuestions
    .map((question, index) => ({ question, index }))
    .filter(({ question }) => !session.answers[question.id])
    .map(({ index }) => index);
  if (!indexes.length) return null;
  return indexes[Math.floor(Math.random() * indexes.length)];
}

function formatElapsed(ms) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const restMinutes = minutes % 60;
    return `${hours}時間${restMinutes}分${seconds}秒`;
  }
  return `${minutes}分${seconds}秒`;
}

function currentStats() {
  const answeredQuestions = flatQuestions.filter((question) => session.answers[question.id]);
  const correct = answeredQuestions.filter((question) => session.answers[question.id].choice === question.answer).length;
  const wrong = answeredQuestions.length - correct;
  const accuracy = answeredQuestions.length ? Math.round((correct / answeredQuestions.length) * 100) : 0;
  return { total: flatQuestions.length, done: answeredQuestions.length, correct, wrong, accuracy };
}

function renderQuestion() {
  if (!session) {
    showStart();
    return;
  }

  showQuiz();
  const question = flatQuestions[currentIndex];
  const record = session.answers[question.id];
  const done = isFinished();

  els.answerMark.textContent = done && record ? (record.choice === question.answer ? "✓" : "×") : "";
  els.answerMark.className = `answerMark ${done && record ? (record.choice === question.answer ? "good" : "bad") : ""}`;
  els.questionNo.textContent = `${currentIndex + 1}/${flatQuestions.length}`;
  els.paperName.textContent = done
    ? `${subjects[activeSubject].label}・第${currentIndex + 1}問（完了・確認中）`
    : `${subjects[activeSubject].label}・第${currentIndex + 1}問`;
  els.questionText.textContent = question.text || `${question.hint}として，適切なものはどれか。`;
  els.questionHint.textContent = question.note || "";
  els.questionFigure.innerHTML = question.figure || "";
  els.questionFigure.hidden = !question.figure;
  els.options.innerHTML = "";

  displayChoices(question).forEach((choice) => {
    const label = choice.displayKey;
    const optionText = choice.text;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "option";
    const compactChoice = /^[アイウエ]$/.test(optionText);
    const optionBody = optionText === label && !compactChoice ? "" : ` ${optionText}`;
    button.innerHTML = `<span class="radio"></span><span class="optionText"><b>${label}</b>${optionBody}</span><span class="check">✓</span>`;
    if (record?.choice === choice.originalKey) button.classList.add("selected");
    if (done && record) {
      if (choice.originalKey === question.answer) button.classList.add("correct");
      if (record.choice === choice.originalKey && record.choice !== question.answer) button.classList.add("incorrect");
      button.disabled = true;
      button.title = "このラウンドは完了しています。回答は変更できません。";
    } else {
      button.addEventListener("click", () => answerQuestion(label));
    }
    els.options.appendChild(button);
  });

  if (!done && !record) {
    els.feedback.textContent = "回答を選択してください。完了前であれば変更できます。";
    els.feedback.className = "feedback";
  } else if (!done && record) {
    const selectedChoice = displayChoiceForOriginalKey(question, record.choice);
    els.feedback.textContent = `選択済み：${selectedChoice?.displayKey || ""}。完了前であれば変更できます。`;
    els.feedback.className = "feedback";
  } else if (record.choice === question.answer) {
    const correctChoice = displayChoiceForOriginalKey(question, question.answer);
    els.feedback.textContent = `正解：${correctChoice?.displayKey || ""} ${correctChoice?.text || ""}`;
    els.feedback.className = "feedback good";
  } else {
    const correctChoice = displayChoiceForOriginalKey(question, question.answer);
    els.feedback.textContent = `不正解。正解：${correctChoice?.displayKey || ""} ${correctChoice?.text || ""}`;
    els.feedback.className = "feedback bad";
  }

  renderStats();
  renderList();
  updateControls();
}

function answerQuestion(choice) {
  if (!session) return;
  const question = flatQuestions[currentIndex];
  if (isFinished()) return;
  const selectedChoice = displayChoices(question).find((item) => item.displayKey === choice);
  if (!selectedChoice) return;
  session.answers[question.id] = {
    choice: selectedChoice.originalKey,
    answeredAt: Date.now()
  };

  if (hasAnsweredAll()) {
    session.finishedAt = Date.now();
    updateWrongBankFromSession();
    save();
    renderQuestion();
    showResult();
    return;
  }

  save();
  renderQuestion();
}

function renderStats() {
  const stats = currentStats();
  els.doneCount.textContent = stats.done;
  els.wrongCount.textContent = isFinished() ? stats.wrong : "—";
  els.accuracy.textContent = isFinished() ? `${stats.accuracy}%` : "—";
}

function renderList() {
  els.list.innerHTML = "";
  const done = isFinished();

  flatQuestions.forEach((question, index) => {
    const record = session.answers[question.id];
    const button = document.createElement("button");
    button.type = "button";
    button.className = "jump";
    button.textContent = `${index + 1}`;
    if (index === currentIndex) button.classList.add("current");
    if (record) button.classList.add(done ? (record.choice === question.answer ? "correct" : "wrong") : "answered");
    button.addEventListener("click", () => {
      currentIndex = index;
      renderQuestion();
    });
    els.list.appendChild(button);
  });
}

function updateControls() {
  const done = isFinished();
  els.prev.disabled = flatQuestions.length <= 1;
  els.next.disabled = flatQuestions.length <= 1;
  els.random.disabled = done || firstUnansweredIndex() === null;
  els.random.textContent = done ? "完了" : "未回答からランダム";
}

function move(offset) {
  currentIndex = (currentIndex + offset + flatQuestions.length) % flatQuestions.length;
  renderQuestion();
}

function showResult(force = false) {
  if (!session.finishedAt) return;
  if (session.resultShown && !force) return;
  updateWrongBankFromSession();
  const stats = currentStats();
  const elapsed = formatElapsed(session.finishedAt - session.startedAt);
  const bankCount = wrongBankIndexes().length;
  els.resultTime.textContent = elapsed;
  els.resultAccuracy.textContent = `${stats.accuracy}%`;
  els.resultDetail.textContent = `全${stats.total}問中，正解${stats.correct}問，不正解${stats.wrong}問。復習リストには現在${bankCount}問あります。`;
  els.resultDialog.showModal();
  session.resultShown = true;
  save();
}

function startRound(size) {
  session = createSession(size);
  flatQuestions = session.order.map((index) => sourceQuestions[index]);
  currentIndex = 0;
  save();
  renderQuestion();
}

function setSubject(subject) {
  if (!subjects[subject] || subject === activeSubject) return;
  activeSubject = subject;
  localStorage.setItem(subjectKey, activeSubject);
  refreshSourceQuestions();
  session = loadSession();
  flatQuestions = session ? session.order.map((index) => sourceQuestions[index]) : [];
  currentIndex = session ? firstUnansweredIndex() ?? 0 : 0;
  renderSubjectButtons();
  updateWrongBankButton();
  renderQuestion();
}

function startWrongRound() {
  const nextSession = createWrongSession();
  if (!nextSession) return;
  session = nextSession;
  flatQuestions = session.order.map((index) => sourceQuestions[index]);
  currentIndex = 0;
  save();
  renderQuestion();
}

function returnToStart() {
  clearSession();
  renderQuestion();
}

els.prev.addEventListener("click", () => move(-1));
els.next.addEventListener("click", () => move(1));
els.random.addEventListener("click", () => {
  const index = randomUnansweredIndex();
  if (index === null) return;
  currentIndex = index;
  renderQuestion();
});

els.reset.addEventListener("click", () => {
  if (!confirm("開始画面に戻りますか？現在のラウンドの回答は削除されます。")) return;
  returnToStart();
});

els.closeResult.addEventListener("click", () => els.resultDialog.close());
els.newRound.addEventListener("click", () => {
  els.resultDialog.close();
  returnToStart();
});

els.start25.addEventListener("click", () => startRound(25));
els.start52.addEventListener("click", () => startRound(uniqueSourceIndexes.length));
els.startWrong.addEventListener("click", startWrongRound);
els.subjectButtons.forEach((button) => {
  button.addEventListener("click", () => setSubject(button.dataset.subject));
});

els.modes.forEach((button) => {
  button.disabled = true;
  if (button.dataset.mode === "all") {
    button.classList.add("active");
    button.textContent = "このラウンドの全問";
  }
  if (button.dataset.mode === "wrong") button.textContent = "復習リストに保存";
  if (button.dataset.mode === "unanswered") button.textContent = "完了後に判定";
});

document.addEventListener("keydown", (event) => {
  if (!session) return;
  if (els.resultDialog.open) return;
  if (["ArrowRight", "j"].includes(event.key)) move(1);
  if (["ArrowLeft", "k"].includes(event.key)) move(-1);
  const question = flatQuestions[currentIndex];
  const normalized = event.key.toUpperCase();
  if (choiceKeys.includes(normalized) && !isFinished()) {
    answerQuestion(normalized);
  }
});

save();
renderQuestion();
if (session && isFinished()) showResult();
