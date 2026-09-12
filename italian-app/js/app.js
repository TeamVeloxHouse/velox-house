/* ============================================================================
   APP — views, routing, lesson player. Plain DOM, no framework.
   ========================================================================== */
const E = window.Engine;
let state = E.loadState();

/* keep hearts/day fresh on load */
state = E.regenHearts(state);
E.saveState(state);

const app = document.getElementById("app");
const $ = sel => document.querySelector(sel);
const el = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
};

/* ---- header / stats bar ------------------------------------------------- */
function renderTopbar() {
  const bar = $("#topbar");
  bar.innerHTML = `
    <div class="stat streak" title="Day streak">🔥 <b>${state.streak}</b></div>
    <div class="stat xp" title="Total XP">⭐ <b>${state.xp}</b></div>
    <div class="stat hearts" title="Hearts (regenerate over time)">❤️ <b>${state.hearts}</b></div>
  `;
}

/* ---- progress helpers --------------------------------------------------- */
function crown(id) { return state.crowns[id] || 0; }
function lessonUnlocked(lessons, idx) {
  if (idx === 0) return true;
  return crown(lessons[idx - 1].id) >= 1;   // finish previous once to unlock
}

/* ============================================================================
   HOME / LEARNING PATH
   ========================================================================== */
function viewHome() {
  renderTopbar();
  const root = el("div", "path");

  // daily goal ring
  const pct = Math.min(100, Math.round((state.todayXp / state.dailyGoal) * 100));
  const goal = el("div", "goalcard");
  goal.innerHTML = `
    <div class="ring" style="--pct:${pct}">
      <div class="ring-inner">${pct}%</div>
    </div>
    <div class="goaltext">
      <div class="goaltitle">Daily goal</div>
      <div class="goalsub">${state.todayXp} / ${state.dailyGoal} XP today</div>
      <button class="btn-ghost" id="reviewBtn">⚡ Practice weak words</button>
    </div>`;
  root.appendChild(goal);

  COURSE.forEach(sec => {
    const sh = el("div", "section-head");
    sh.innerHTML = `<span class="cefr">${sec.cefr}</span><span>${sec.title}</span>`;
    root.appendChild(sh);

    sec.units.forEach(unit => {
      const ucard = el("div", "unit");
      ucard.innerHTML = `<div class="unit-head"><span class="unit-icon">${unit.icon}</span>
        <span class="unit-title">${unit.title}</span></div>`;
      const track = el("div", "track");
      unit.lessons.forEach((lesson, i) => {
        const lvl = crown(lesson.id);
        const unlocked = lessonUnlocked(unit.lessons, i);
        const node = el("button", "node" + (unlocked ? "" : " locked") + (lvl >= 5 ? " gold" : ""));
        node.style.marginLeft = (Math.sin(i * 1.1) * 46 + 46) + "px";
        node.innerHTML = `
          <div class="node-bubble">${lvl >= 5 ? "👑" : unlocked ? "★" : "🔒"}</div>
          <div class="node-label">${lesson.title}</div>
          <div class="crowns">${"●".repeat(lvl)}${"○".repeat(5 - lvl)}</div>`;
        if (unlocked) node.onclick = () => startLesson(lesson.id);
        else node.onclick = () => toast("Finish the previous lesson first 🔒");
        track.appendChild(node);
      });
      ucard.appendChild(track);
      root.appendChild(ucard);
    });
  });

  app.innerHTML = "";
  app.appendChild(root);
  $("#reviewBtn").onclick = startReview;
}

/* ============================================================================
   LESSON PLAYER
   ========================================================================== */
let session = null;

function startLesson(id) {
  const lesson = E.findLesson(id);
  if (state.hearts <= 0) return outOfHearts();
  session = {
    lessonId: id,
    title: lesson.title,
    tip: lesson.tip,
    queue: E.buildSession(lesson),
    idx: 0, correct: 0, total: 0, mistakes: [],
    isReview: false,
  };
  session.total = session.queue.length;
  if (lesson.tip) showTip(lesson.tip, () => nextExercise());
  else nextExercise();
}

function startReview() {
  if (state.hearts <= 0) return outOfHearts();
  const q = E.buildReviewSession(state);
  if (!q.length) return toast("Complete a lesson first to build your review deck!");
  session = { lessonId: null, title: "Practice", queue: q, idx: 0,
    correct: 0, total: q.length, mistakes: [], isReview: true };
  nextExercise();
}

function showTip(html, done) {
  app.innerHTML = "";
  const c = el("div", "lesson");
  c.appendChild(playerHeader(0));
  const tip = el("div", "tipcard");
  tip.innerHTML = `<div class="tip-key">💡 Grammar note</div><div class="tip-body">${html}</div>`;
  const b = el("button", "btn-primary", "Got it");
  b.onclick = done;
  c.appendChild(tip); c.appendChild(b);
  app.appendChild(c);
}

function playerHeader(progressIdx) {
  const h = el("div", "player-head");
  const pct = session ? Math.round((progressIdx / session.total) * 100) : 0;
  h.innerHTML = `
    <button class="quit" id="quitBtn">✕</button>
    <div class="pbar"><div class="pfill" style="width:${pct}%"></div></div>
    <div class="hh">❤️ ${state.hearts}</div>`;
  setTimeout(() => { const q = $("#quitBtn"); if (q) q.onclick = confirmQuit; }, 0);
  return h;
}

function confirmQuit() {
  if (confirm("Quit this lesson? Progress in it will be lost.")) { session = null; viewHome(); }
}

function nextExercise() {
  if (!session) return;
  if (session.idx >= session.queue.length) return finishLesson();
  const exo = session.queue[session.idx];
  renderExercise(exo);
  if (state.settings.autoplay && exo.speak &&
      (exo.type === "listen" || exo.type === "mc")) {
    setTimeout(() => E.speak(exo.speak), 350);
  }
}

/* ----- exercise renderers ------------------------------------------------ */
function renderExercise(exo) {
  app.innerHTML = "";
  const c = el("div", "lesson");
  c.appendChild(playerHeader(session.idx));

  const ask = el("div", "ask", exo.ask || "");
  c.appendChild(ask);

  const body = el("div", "ex-body");
  c.appendChild(body);

  let getAnswer = () => null;   // returns {ok, user, correct}
  let canCheck = () => false;

  if (exo.type === "mc") {
    const q = el("div", "prompt-row");
    q.innerHTML = `<button class="spk">🔊</button><div class="prompt">${exo.prompt}</div>`;
    q.querySelector(".spk").onclick = () => E.speak(exo.speak || exo.prompt);
    body.appendChild(q);
    let chosen = null;
    const opts = el("div", "choices");
    exo.choices.forEach(ch => {
      const b = el("button", "choice", ch);
      b.onclick = () => {
        chosen = ch;
        opts.querySelectorAll(".choice").forEach(x => x.classList.remove("sel"));
        b.classList.add("sel");
      };
      opts.appendChild(b);
    });
    body.appendChild(opts);
    canCheck = () => chosen != null;
    getAnswer = () => ({ ok: chosen === exo.answer, user: chosen, correct: exo.answer });

  } else if (exo.type === "typeIt") {
    const q = el("div", "prompt-row");
    q.innerHTML = `<div class="prompt">${exo.prompt}</div>`;
    body.appendChild(q);
    const inp = el("input", "typ"); inp.type = "text";
    inp.autocomplete = "off"; inp.autocapitalize = "off"; inp.spellcheck = false;
    inp.placeholder = "Type in Italian…";
    body.appendChild(inp);
    setTimeout(() => inp.focus(), 50);
    inp.addEventListener("keydown", e => { if (e.key === "Enter") $("#checkBtn")?.click(); });
    canCheck = () => inp.value.trim().length > 0;
    getAnswer = () => ({ ok: E.checkTyped(inp.value, exo.answer), user: inp.value, correct: exo.answer });

  } else if (exo.type === "listen") {
    const q = el("div", "listen-row");
    q.innerHTML = `<button class="bigspk">🔊 Play</button>
      <button class="slowspk">🐢 Slow</button>`;
    q.querySelector(".bigspk").onclick = () => E.speak(exo.speak);
    q.querySelector(".slowspk").onclick = () => E.speak(exo.speak, 0.6);
    body.appendChild(q);
    const inp = el("input", "typ"); inp.type = "text";
    inp.autocomplete = "off"; inp.autocapitalize = "off"; inp.spellcheck = false;
    inp.placeholder = "Type what you hear…";
    body.appendChild(inp);
    setTimeout(() => inp.focus(), 50);
    inp.addEventListener("keydown", e => { if (e.key === "Enter") $("#checkBtn")?.click(); });
    canCheck = () => inp.value.trim().length > 0;
    getAnswer = () => ({ ok: E.checkTyped(inp.value, exo.answer), user: inp.value, correct: exo.answer });

  } else if (exo.type === "translateW") {
    const q = el("div", "prompt-row");
    q.innerHTML = `<div class="prompt">${exo.prompt}</div>`;
    body.appendChild(q);
    const answerArea = el("div", "wordline");
    const bankArea = el("div", "wordbank");
    const chosen = [];
    function redraw() {
      answerArea.innerHTML = "";
      chosen.forEach((w, i) => {
        const t = el("button", "tile", w);
        t.onclick = () => { chosen.splice(i, 1); restore(w); redraw(); };
        answerArea.appendChild(t);
      });
    }
    const bankTiles = [];
    function restore(w) {
      const bt = bankTiles.find(b => b.textContent === w && b.disabled);
      if (bt) bt.disabled = false;
    }
    exo.bank.forEach(w => {
      const t = el("button", "tile", w);
      t.onclick = () => { if (t.disabled) return; t.disabled = true; chosen.push(w); redraw(); };
      bankTiles.push(t); bankArea.appendChild(t);
    });
    body.appendChild(answerArea); body.appendChild(bankArea);
    canCheck = () => chosen.length > 0;
    getAnswer = () => {
      const user = chosen.join(" ");
      const ok = chosen.map(x => x.toLowerCase()).join(" ") ===
                 exo.solution.map(x => x.toLowerCase()).join(" ");
      return { ok, user, correct: exo.answer };
    };

  } else if (exo.type === "match") {
    renderMatch(exo, body, c);
    app.appendChild(c);
    return; // match handles its own flow
  }

  // footer check button
  const foot = el("div", "foot");
  const btn = el("button", "btn-primary", "Check");
  btn.id = "checkBtn"; btn.disabled = true;
  body.addEventListener("input", () => btn.disabled = !canCheck());
  body.addEventListener("click", () => setTimeout(() => btn.disabled = !canCheck(), 0));
  btn.onclick = () => {
    const res = getAnswer();
    handleResult(res, exo);
  };
  foot.appendChild(btn);
  c.appendChild(foot);
  app.appendChild(c);
}

function renderMatch(exo, body, container) {
  const left = E.shuffle(exo.pairs.map(p => p.it));
  const right = E.shuffle(exo.pairs.map(p => p.en));
  const map = {}; exo.pairs.forEach(p => map[p.it] = p.en);
  body.innerHTML = `<div class="matchhint">Tap the matching pairs</div>`;
  const grid = el("div", "matchgrid");
  let sel = null, remaining = exo.pairs.length;
  function makeCol(words, side) {
    const col = el("div", "matchcol");
    words.forEach(w => {
      const b = el("button", "matchcell", w);
      b.dataset.side = side; b.dataset.word = w;
      if (side === "it") b.onclick = () => { E.speak(w); choose(b); };
      else b.onclick = () => choose(b);
      col.appendChild(b);
    });
    return col;
  }
  function choose(b) {
    if (b.classList.contains("done")) return;
    if (!sel) { clearSel(); sel = b; b.classList.add("msel"); return; }
    if (sel === b) { sel.classList.remove("msel"); sel = null; return; }
    if (sel.dataset.side === b.dataset.side) { clearSel(); sel = b; b.classList.add("msel"); return; }
    // attempt match
    const itWord = sel.dataset.side === "it" ? sel.dataset.word : b.dataset.word;
    const enWord = sel.dataset.side === "en" ? sel.dataset.word : b.dataset.word;
    if (map[itWord] === enWord) {
      sel.classList.add("done"); b.classList.add("done");
      sel.classList.remove("msel");
      bump(itWord, true);
      sel = null; remaining--;
      if (remaining === 0) setTimeout(() => { advance(true); }, 450);
    } else {
      const a = sel, bb = b;
      a.classList.add("mbad"); bb.classList.add("mbad");
      bump(itWord, false);
      setTimeout(() => { a.classList.remove("mbad","msel"); bb.classList.remove("mbad"); }, 500);
      sel = null;
      loseHeartSoft();
    }
  }
  function clearSel() { grid.querySelectorAll(".msel").forEach(x => x.classList.remove("msel")); }
  grid.appendChild(makeCol(left, "it"));
  grid.appendChild(makeCol(right, "en"));
  body.appendChild(grid);
  function advance() {
    session.correct++; session.idx++; nextExercise();
  }
}

function bump(term, ok) {
  E.srsReview(state, term, ok ? 4 : 2);
  E.saveState(state);
}

/* soft heart loss for match mistakes (don't end lesson, just ping) */
function loseHeartSoft() { /* matches are forgiving; no heart cost */ }

/* ----- result handling --------------------------------------------------- */
function handleResult(res, exo) {
  session.idx++;
  if (exo.term) bump(exo.term, res.ok ? 5 : 2);
  if (exo.type === "translateW" || exo.type === "typeIt" || exo.type === "listen") {
    // treat the sentence/word as an SRS term too
    E.srsReview(state, exo.answer, res.ok ? 5 : 2); E.saveState(state);
  }

  if (res.ok) {
    session.correct++;
    if (state.settings.sound) beep(true);
    feedback(true, exo, res, () => nextExercise());
  } else {
    if (!session.isReview) {                 // practice/review is free — no heart cost
      state.hearts = Math.max(0, state.hearts - 1);
      if (state.hearts === E.MAX_HEARTS - 1 && !state.heartsRefilledAt)
        state.heartsRefilledAt = Date.now();
    }
    session.mistakes.push(exo);
    // re-queue the missed item near the end
    session.queue.push(exo); session.total = session.queue.length;
    E.saveState(state);
    if (state.settings.sound) beep(false);
    feedback(false, exo, res, () => {
      if (state.hearts <= 0) { outOfHearts(); }
      else nextExercise();
    });
  }
}

function feedback(ok, exo, res, done) {
  const fb = el("div", "feedback " + (ok ? "good" : "bad"));
  const sol = exo.answer;
  fb.innerHTML = `
    <div class="fb-title">${ok ? "✔ Correct!" : "✘ Not quite"}</div>
    ${ok ? "" : `<div class="fb-sol">Answer: <b>${sol}</b></div>`}
    <div class="fb-row">
      <button class="fb-spk">🔊 Hear it</button>
      <button class="btn-primary fb-cont">Continue</button>
    </div>`;
  fb.querySelector(".fb-spk").onclick = () => E.speak(exo.speak || sol);
  fb.querySelector(".fb-cont").onclick = () => { fb.remove(); done(); };
  // replace footer
  const foot = $(".foot"); if (foot) foot.remove();
  app.querySelector(".lesson").appendChild(fb);
  renderTopbar();
  fb.querySelector(".fb-cont").focus();
  document.onkeydown = e => { if (e.key === "Enter") { document.onkeydown = null; fb.querySelector(".fb-cont").click(); } };
}

function finishLesson() {
  const accuracy = Math.round((session.correct / Math.max(1, session.total)) * 100);
  const base = session.isReview ? 8 : 15;
  const bonus = accuracy === 100 ? 5 : 0;
  const gained = base + bonus;

  state = E.touchDay(state);
  state.xp += gained;
  state.todayXp += gained;

  if (!session.isReview) {
    const cur = state.crowns[session.lessonId] || 0;
    state.crowns[session.lessonId] = Math.min(5, cur + 1);
  }
  E.saveState(state);

  app.innerHTML = "";
  const c = el("div", "finish");
  const lvl = session.isReview ? null : state.crowns[session.lessonId];
  c.innerHTML = `
    <div class="confetti">🎉</div>
    <h2>${session.isReview ? "Practice complete!" : "Lesson complete!"}</h2>
    <div class="finish-stats">
      <div class="fstat"><div class="fnum">+${gained}</div><div>XP</div></div>
      <div class="fstat"><div class="fnum">${accuracy}%</div><div>Accuracy</div></div>
      <div class="fstat"><div class="fnum">🔥 ${state.streak}</div><div>Streak</div></div>
    </div>
    ${lvl != null ? `<div class="crown-earned">Crown level: ${"👑".repeat(lvl)} (${lvl}/5)</div>` : ""}
    <button class="btn-primary" id="doneBtn">Continue</button>`;
  app.appendChild(c);
  $("#doneBtn").onclick = () => { session = null; viewHome(); };
}

/* ----- out of hearts ----------------------------------------------------- */
function outOfHearts() {
  app.innerHTML = "";
  const c = el("div", "finish");
  const mins = E.HEART_REFILL_MINUTES;
  c.innerHTML = `
    <div class="confetti">💔</div>
    <h2>Out of hearts</h2>
    <p class="muted">Hearts refill over time — one every ${mins} minutes.<br>
    Practise your weak words to keep learning for free.</p>
    <button class="btn-primary" id="prac">⚡ Practice (no hearts needed)</button>
    <button class="btn-ghost" id="refill">Refill now (free)</button>
    <button class="btn-ghost" id="home2">Back home</button>`;
  app.appendChild(c);
  $("#prac").onclick = () => { session = null; startReview(); };
  $("#refill").onclick = () => { state.hearts = E.MAX_HEARTS; state.heartsRefilledAt = null; E.saveState(state); toast("Hearts refilled ❤️"); viewHome(); };
  $("#home2").onclick = () => { session = null; viewHome(); };
}

/* ============================================================================
   small UI utilities
   ========================================================================== */
function toast(msg) {
  const t = el("div", "toast", msg);
  document.body.appendChild(t);
  setTimeout(() => t.classList.add("show"), 10);
  setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 300); }, 2200);
}

/* simple WebAudio beeps for right/wrong */
let actx = null;
function beep(ok) {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain();
    o.connect(g); g.connect(actx.destination);
    o.type = "sine";
    o.frequency.value = ok ? 660 : 180;
    g.gain.setValueAtTime(0.0001, actx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.12, actx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + 0.25);
    o.start(); o.stop(actx.currentTime + 0.26);
    if (ok) { const o2 = actx.createOscillator(); o2.connect(g); o2.type="sine";
      o2.frequency.setValueAtTime(880, actx.currentTime+0.08); o2.start(actx.currentTime+0.08); o2.stop(actx.currentTime+0.2); }
  } catch (e) {}
}

/* ============================================================================
   bottom nav + profile
   ========================================================================== */
function viewProfile() {
  renderTopbar();
  const learned = Object.values(state.srs).filter(c => c.seen > 0).length;
  const mastered = Object.values(state.srs).filter(c => c.interval >= 6).length;
  const lessonsDone = Object.values(state.crowns).filter(v => v >= 1).length;
  const c = el("div", "profile");
  c.innerHTML = `
    <div class="avatar">🇮🇹</div>
    <h2>Il tuo profilo</h2>
    <div class="pgrid">
      <div class="pcard"><div class="pbig">⭐ ${state.xp}</div><div>Total XP</div></div>
      <div class="pcard"><div class="pbig">🔥 ${state.streak}</div><div>Day streak</div></div>
      <div class="pcard"><div class="pbig">${lessonsDone}</div><div>Lessons done</div></div>
      <div class="pcard"><div class="pbig">${learned}</div><div>Words seen</div></div>
      <div class="pcard"><div class="pbig">${mastered}</div><div>Words mastered</div></div>
      <div class="pcard"><div class="pbig">${Object.values(state.crowns).reduce((a,b)=>a+b,0)}</div><div>Crowns</div></div>
    </div>

    <div class="settings">
      <h3>Settings</h3>
      <label class="srow"><span>Daily goal (XP)</span>
        <select id="goalSel">
          ${[10,20,30,50,100].map(v=>`<option value="${v}" ${state.dailyGoal===v?"selected":""}>${v}</option>`).join("")}
        </select></label>
      <label class="srow"><span>Sound effects</span>
        <input type="checkbox" id="soundChk" ${state.settings.sound?"checked":""}></label>
      <label class="srow"><span>Auto-play audio</span>
        <input type="checkbox" id="autoChk" ${state.settings.autoplay?"checked":""}></label>
    </div>

    <button class="btn-ghost danger" id="resetBtn">Reset all progress</button>
    <p class="muted small">All progress is saved on this device only (offline, private).</p>`;
  app.innerHTML = ""; app.appendChild(c);
  $("#goalSel").onchange = e => { state.dailyGoal = +e.target.value; E.saveState(state); };
  $("#soundChk").onchange = e => { state.settings.sound = e.target.checked; E.saveState(state); };
  $("#autoChk").onchange = e => { state.settings.autoplay = e.target.checked; E.saveState(state); };
  $("#resetBtn").onclick = () => {
    if (confirm("Erase ALL progress and start over?")) {
      localStorage.removeItem("italiano.state.v1");
      state = E.loadState(); E.saveState(state); toast("Progress reset"); nav("home");
    }
  };
}

function renderNav(active) {
  const nb = $("#nav");
  const tabs = [["home","🏠","Learn"],["create","✏️","Create"],["practice","⚡","Practice"],["profile","👤","Profile"]];
  nb.innerHTML = tabs.map(([k,ic,lb]) =>
    `<button class="navbtn ${active===k?"on":""}" data-k="${k}"><span>${ic}</span><small>${lb}</small></button>`).join("");
  nb.querySelectorAll(".navbtn").forEach(b => b.onclick = () => nav(b.dataset.k));
}

function nav(where) {
  session = null;
  state = E.regenHearts(state); E.saveState(state);
  if (where === "home") { renderNav("home"); viewHome(); }
  else if (where === "create") { renderNav("create"); viewCreate(); }
  else if (where === "practice") { renderNav("practice"); startReview(); }
  else if (where === "profile") { renderNav("profile"); viewProfile(); }
}

/* ============================================================================
   CREATE — build a lesson from any word / phrase / sentence / topic
   ========================================================================== */
function viewCreate() {
  renderTopbar();
  if (!state.customLessons) state.customLessons = [];
  const c = el("div", "create");
  const topics = Object.keys(E.TOPIC_SEEDS || {});
  c.innerHTML = `
    <h2>Create a lesson</h2>
    <p class="muted small" style="text-align:left;margin-top:-6px">
      Type anything you want to learn — one word, phrase, or sentence per line.
      The app translates it and builds a full lesson. Works for any word in the language.</p>

    <div class="dir-toggle">
      <button class="dirbtn on" data-dir="en-it">I'm typing English → learn Italian</button>
      <button class="dirbtn" data-dir="it-en">I'm typing Italian → learn English</button>
    </div>

    <div class="topics">
      ${topics.map(t=>`<button class="topic" data-t="${t}">${t}</button>`).join("")}
    </div>

    <textarea id="cText" rows="6" placeholder="e.g.\nthe airport\nI would like a coffee please\nwhere is the station?"></textarea>
    <input id="cTitle" class="typ" type="text" placeholder="Lesson name (optional)" style="margin-top:10px">
    <button class="btn-primary" id="cBuild" style="margin-top:12px">Build lesson</button>
    <div id="cStatus" class="muted small" style="text-align:center;margin-top:10px"></div>

    <h3 style="margin-top:26px">My lessons</h3>
    <div id="myLessons"></div>`;
  app.innerHTML = ""; app.appendChild(c);

  let dir = "en-it";
  c.querySelectorAll(".dirbtn").forEach(b => b.onclick = () => {
    dir = b.dataset.dir;
    c.querySelectorAll(".dirbtn").forEach(x => x.classList.toggle("on", x === b));
    $("#cText").placeholder = dir === "it-en"
      ? "e.g.\nl'aeroporto\nvorrei un caffè per favore\ndov'è la stazione?"
      : "e.g.\nthe airport\nI would like a coffee please\nwhere is the station?";
  });
  c.querySelectorAll(".topic").forEach(b => b.onclick = () => {
    const seeds = E.TOPIC_SEEDS[b.dataset.t] || [];
    // topic seeds are English; switch to en-it
    dir = "en-it";
    c.querySelectorAll(".dirbtn").forEach(x => x.classList.toggle("on", x.dataset.dir === "en-it"));
    $("#cText").value = seeds.join("\n");
    if (!$("#cTitle").value) $("#cTitle").value = b.dataset.t;
  });

  $("#cBuild").onclick = async () => {
    const lines = $("#cText").value.split("\n").map(s => s.trim()).filter(Boolean);
    if (!lines.length) return toast("Type something to learn first ✏️");
    const status = $("#cStatus");
    $("#cBuild").disabled = true;
    status.textContent = "Translating & building… (needs internet the first time)";
    try {
      const lesson = await E.buildCustomLesson($("#cTitle").value.trim(), lines, dir);
      if (!lesson.items.length && !lesson.sentences.length)
        throw new Error("Couldn't translate that — check your connection and try again.");
      state.customLessons.unshift(lesson);
      E.saveState(state);
      status.textContent = "";
      startCustomLesson(lesson.id);
    } catch (e) {
      status.textContent = "⚠️ " + (e.message || "Something went wrong. Try again.");
      $("#cBuild").disabled = false;
    }
  };

  renderMyLessons();
}

function renderMyLessons() {
  const box = $("#myLessons"); if (!box) return;
  const list = state.customLessons || [];
  if (!list.length) { box.innerHTML = `<p class="muted small">No custom lessons yet.</p>`; return; }
  box.innerHTML = "";
  list.forEach(l => {
    const count = (l.items?.length || 0) + (l.sentences?.length || 0);
    const lvl = crown(l.id);
    const row = el("div", "mylesson");
    row.innerHTML = `
      <div class="ml-main">
        <div class="ml-title">${l.title}</div>
        <div class="ml-sub muted small">${count} items · ${"👑".repeat(lvl)||"not started"}</div>
      </div>
      <button class="ml-go">Learn</button>
      <button class="ml-del" title="Delete">🗑</button>`;
    row.querySelector(".ml-go").onclick = () => startCustomLesson(l.id);
    row.querySelector(".ml-del").onclick = () => {
      if (confirm("Delete this custom lesson?")) {
        state.customLessons = state.customLessons.filter(x => x.id !== l.id);
        E.saveState(state); renderMyLessons();
      }
    };
    box.appendChild(row);
  });
}

function startCustomLesson(id) {
  const lesson = (state.customLessons || []).find(l => l.id === id);
  if (!lesson) return;
  if (state.hearts <= 0) return outOfHearts();
  session = {
    lessonId: id, title: lesson.title, tip: null,
    queue: E.buildSession(lesson, { limit: 16 }),
    idx: 0, correct: 0, total: 0, mistakes: [], isReview: false, isCustom: true,
  };
  session.total = session.queue.length;
  nextExercise();
}

/* ---- boot --------------------------------------------------------------- */
renderNav("home");
viewHome();

/* register service worker for offline / installable */
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
