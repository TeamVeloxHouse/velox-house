/* ============================================================================
   ENGINE — progress state, spaced repetition, exercise generation, audio
   ========================================================================== */

/* -------- persistent state (localStorage) -------------------------------- */
const STORE_KEY = "italiano.state.v1";

const DEFAULT_STATE = {
  xp: 0,
  streak: 0,
  lastActive: null,          // ISO date string (YYYY-MM-DD)
  hearts: 5,
  heartsRefilledAt: null,    // ISO timestamp
  crowns: {},                // lessonId -> level (0..5)
  srs: {},                   // "it" term -> { ef, reps, interval, due (ts), seen }
  dailyGoal: 30,             // XP/day
  todayXp: 0,
  todayDate: null,
  settings: { sound: true, autoplay: true },
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    const s = Object.assign(structuredClone(DEFAULT_STATE), JSON.parse(raw));
    return s;
  } catch (e) {
    return structuredClone(DEFAULT_STATE);
  }
}

function saveState(s) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch (e) {}
}

/* -------- streak & hearts bookkeeping ------------------------------------ */
const HEART_REFILL_MINUTES = 30;  // one heart regenerates every 30 min
const MAX_HEARTS = 5;

function today() { return new Date().toISOString().slice(0, 10); }

function touchDay(s) {
  const t = today();
  if (s.todayDate !== t) { s.todayDate = t; s.todayXp = 0; }

  if (s.lastActive !== t) {
    const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
    if (s.lastActive === yesterday) s.streak += 1;
    else if (s.lastActive !== t) s.streak = s.lastActive ? 1 : 1;
    s.lastActive = t;
  }
  return s;
}

function regenHearts(s) {
  if (s.hearts >= MAX_HEARTS) { s.heartsRefilledAt = null; return s; }
  if (!s.heartsRefilledAt) { s.heartsRefilledAt = Date.now(); return s; }
  const elapsed = Date.now() - s.heartsRefilledAt;
  const gained = Math.floor(elapsed / (HEART_REFILL_MINUTES * 60000));
  if (gained > 0) {
    s.hearts = Math.min(MAX_HEARTS, s.hearts + gained);
    s.heartsRefilledAt = s.hearts >= MAX_HEARTS ? null : Date.now();
  }
  return s;
}

/* -------- spaced repetition (SM-2 lite) ---------------------------------- */
function srsFor(s, term) {
  if (!s.srs[term]) s.srs[term] = { ef: 2.5, reps: 0, interval: 0, due: 0, seen: 0 };
  return s.srs[term];
}

/* quality 0..5 ; returns updated card */
function srsReview(s, term, quality) {
  const c = srsFor(s, term);
  c.seen += 1;
  if (quality < 3) {
    c.reps = 0; c.interval = 1;
  } else {
    c.reps += 1;
    if (c.reps === 1) c.interval = 1;
    else if (c.reps === 2) c.interval = 6;
    else c.interval = Math.round(c.interval * c.ef);
    c.ef = Math.max(1.3, c.ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
  }
  c.due = Date.now() + c.interval * 864e5;
  return c;
}

function dueTerms(s) {
  const now = Date.now();
  return Object.entries(s.srs)
    .filter(([, c]) => c.seen > 0 && c.due <= now)
    .map(([term]) => term);
}

/* -------- course helpers ------------------------------------------------- */
function allLessons() {
  const out = [];
  COURSE.forEach(sec => sec.units.forEach(u => u.lessons.forEach(l =>
    out.push({ ...l, unit: u, section: sec }))));
  return out;
}

function findLesson(id) { return allLessons().find(l => l.id === id); }

/* flat pool of "pairs" ({it,en}) used to generate distractors */
function globalPairs() {
  const out = [];
  allLessons().forEach(l => {
    (l.items || []).forEach(p => out.push(p));
  });
  return out;
}
const GLOBAL_PAIRS = typeof COURSE !== "undefined" ? globalPairs() : [];

/* -------- exercise generation -------------------------------------------- */
function shuffle(a) {
  const arr = a.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

/* clean an Italian string into word tokens for word-bank exercises */
function tokenize(str) {
  return str.replace(/[.,!?;:]/g, " ").split(/\s+/).filter(Boolean);
}
function norm(str) {
  return str.toLowerCase().trim()
    .replace(/[.,!?;:]/g, "")
    .replace(/\s+/g, " ");
}

/*
  Build a session (array of exercise objects) for a lesson.
  Exercise types:
    - mc         : multiple choice (pick translation)
    - translateW : translate by tapping word tiles (word bank)
    - typeIt     : type the Italian
    - listen     : hear Italian, choose / type
    - match      : match pairs
*/
function buildSession(lesson, opts = {}) {
  const items = (lesson.items || []).slice();
  const sentences = (lesson.sentences || []).slice();
  const ex = [];

  // 1) Match block (warm-up) if enough items
  const matchPool = shuffle(items).slice(0, Math.min(5, items.length));
  if (matchPool.length >= 3) {
    ex.push({ type: "match", pairs: matchPool.map(p => ({ it: p.it, en: p.en })) });
  }

  // 2) Vocabulary MCs + type-its
  shuffle(items).forEach((p, i) => {
    const distractors = shuffle(GLOBAL_PAIRS.filter(q => q.en !== p.en))
      .slice(0, 3).map(q => q.en);
    ex.push({
      type: "mc",
      prompt: p.it,
      ask: "What does this mean?",
      answer: p.en,
      choices: shuffle([p.en, ...distractors]),
      term: p.it, speak: p.it,
    });
    if (i % 2 === 0) {
      ex.push({
        type: "typeIt", prompt: p.en, ask: "Write this in Italian",
        answer: p.it, term: p.it, speak: p.it,
      });
    }
  });

  // 3) Sentence work — word bank + listening + typing
  shuffle(sentences).forEach((s, i) => {
    const correct = tokenize(s.it);
    const extraPool = GLOBAL_PAIRS
      .map(p => tokenize(p.it)).flat()
      .filter(w => !correct.map(c => c.toLowerCase()).includes(w.toLowerCase()));
    const extras = shuffle(extraPool).slice(0, Math.min(4, Math.max(2, correct.length)));
    ex.push({
      type: "translateW", prompt: s.en, ask: "Translate this sentence",
      answer: s.it, solution: correct,
      bank: shuffle([...correct, ...extras]),
      speak: s.it,
    });
    if (i % 2 === 0) {
      ex.push({ type: "listen", prompt: s.it, ask: "Type what you hear",
        answer: s.it, speak: s.it });
    } else {
      ex.push({ type: "typeIt", prompt: s.en, ask: "Translate (type) into Italian",
        answer: s.it, speak: s.it });
    }
  });

  let out = shuffle(ex);
  // keep the match warm-up first if present
  const m = out.find(e => e.type === "match");
  if (m) { out = [m, ...out.filter(e => e !== m)]; }

  const limit = opts.limit || 14;
  return out.slice(0, limit);
}

/* Build a mixed review session from SRS-due terms across the whole course */
function buildReviewSession(s, opts = {}) {
  const due = new Set(dueTerms(s));
  let pairs = GLOBAL_PAIRS.filter(p => due.has(p.it));
  if (pairs.length < 6) {
    // top up with most-seen / any seen terms
    const seen = GLOBAL_PAIRS.filter(p => s.srs[p.it] && s.srs[p.it].seen > 0);
    pairs = shuffle([...pairs, ...seen]).slice(0, 10);
  }
  pairs = shuffle(pairs).slice(0, opts.limit || 12);
  const ex = [];
  pairs.forEach((p, i) => {
    if (i % 2 === 0) {
      const distractors = shuffle(GLOBAL_PAIRS.filter(q => q.en !== p.en))
        .slice(0, 3).map(q => q.en);
      ex.push({ type: "mc", prompt: p.it, ask: "What does this mean?",
        answer: p.en, choices: shuffle([p.en, ...distractors]), term: p.it, speak: p.it });
    } else {
      ex.push({ type: "typeIt", prompt: p.en, ask: "Write this in Italian",
        answer: p.it, term: p.it, speak: p.it });
    }
  });
  return ex;
}

/* -------- answer checking ------------------------------------------------ */
function checkTyped(userRaw, answer) {
  const u = norm(userRaw), a = norm(answer);
  if (u === a) return true;
  // accept answer with/without leading articles for single words
  const strip = x => x.replace(/^(il |lo |la |l'|i |gli |le |un |uno |una |un'|the |a |to )/i, "");
  if (strip(u) === strip(a)) return true;
  // accept any of several "/"-separated english meanings
  if (a.includes("/")) {
    return a.split("/").map(x => x.trim()).some(x => strip(x) === strip(u) || x === u);
  }
  // small typo tolerance (Levenshtein <=1 for words > 4 chars)
  if (a.length > 4 && lev(u, a) <= 1) return true;
  return false;
}

function lev(a, b) {
  const m = a.length, n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1,
        d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}

/* -------- audio (Web Speech API) ----------------------------------------- */
let _itVoice = null;
function pickItalianVoice() {
  if (!("speechSynthesis" in window)) return null;
  const voices = speechSynthesis.getVoices();
  _itVoice = voices.find(v => /it(-|_)?/i.test(v.lang)) || null;
  return _itVoice;
}
if ("speechSynthesis" in window) {
  pickItalianVoice();
  speechSynthesis.onvoiceschanged = pickItalianVoice;
}
function speak(text, rate = 0.92) {
  if (!("speechSynthesis" in window)) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "it-IT";
    if (_itVoice) u.voice = _itVoice;
    u.rate = rate;
    speechSynthesis.speak(u);
  } catch (e) {}
}

/* ============================================================================
   CUSTOM LESSONS — learn ANY word / phrase / sentence / topic on demand.
   Uses a free, key-less translation API (MyMemory) when online; results are
   cached so the generated lesson then works fully offline.
   ========================================================================== */

/* Preset topic seed word-lists (English) so "pick a topic" works with one tap. */
const TOPIC_SEEDS = {
  "Cooking":   ["to cook","the knife","the fork","the spoon","the plate","the oven","to boil","to fry","the recipe","salt","pepper","olive oil","the pan","delicious"],
  "Travel":    ["the airport","the passport","the suitcase","the hotel","the beach","the map","to book","the flight","the reservation","the luggage","abroad","the journey"],
  "Business":  ["the meeting","the deadline","the client","the invoice","the contract","to negotiate","the budget","the profit","the market","to launch","the strategy","the deal"],
  "Football":  ["the match","the goal","the team","the player","the referee","to score","the stadium","to win","to lose","the coach","the ball","the championship"],
  "Family":    ["the grandmother","the grandfather","the cousin","the uncle","the aunt","the nephew","the niece","married","single","the wedding","the birthday"],
  "Restaurant":["the menu","the waiter","the starter","the main course","the dessert","the bill","to order","the table","the reservation","the tip","still water","sparkling water"],
  "Feelings":  ["happy","sad","excited","nervous","bored","proud","jealous","surprised","grateful","lonely","relaxed","confident"],
  "Technology":["the computer","the phone","the screen","the password","to download","the file","the website","the email","the battery","wireless","to update","the app"],
};

async function translateText(text, from, to) {
  const url = "https://api.mymemory.translated.net/get?q=" +
    encodeURIComponent(text) + "&langpair=" + from + "|" + to;
  const r = await fetch(url);
  if (!r.ok) throw new Error("translation failed");
  const j = await r.json();
  let t = (j.responseData && j.responseData.translatedText) || "";
  // MyMemory sometimes returns warnings in caps — guard against junk
  if (!t || /MYMEMORY WARNING|INVALID/i.test(t)) {
    const m = (j.matches || []).find(x => x.translation);
    t = m ? m.translation : "";
  }
  return t.trim();
}

/* lines: array of strings. dir: "en-it" (user typed English) or "it-en". */
async function buildCustomLesson(title, lines, dir) {
  const [src, tgt] = dir === "it-en" ? ["it", "en"] : ["en", "it"];
  const items = [], sentences = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const translation = await translateText(line, src, tgt);
    if (!translation) continue;
    const it = dir === "it-en" ? line : translation;
    const en = dir === "it-en" ? translation : line;
    const isSentence = line.split(/\s+/).length >= 3;
    (isSentence ? sentences : items).push({ it, en });
  }
  return {
    id: "custom-" + Date.now(),
    title: title || "Custom lesson",
    custom: true,
    items, sentences,
  };
}

/* -------- expose --------------------------------------------------------- */
window.Engine = {
  loadState, saveState, touchDay, regenHearts,
  srsReview, dueTerms, srsFor,
  allLessons, findLesson, buildSession, buildReviewSession,
  checkTyped, speak, shuffle, tokenize, MAX_HEARTS, HEART_REFILL_MINUTES,
  TOPIC_SEEDS, translateText, buildCustomLesson,
};
