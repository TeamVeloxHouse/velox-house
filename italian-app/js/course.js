/* ============================================================================
   COURSE DATA — Italian for English speakers
   ----------------------------------------------------------------------------
   Structure:
     COURSE = [ section, ... ]
     section = { id, cefr, title, units:[ unit ] }
     unit    = { id, title, icon, lessons:[ lesson ] }
     lesson  = { id, title, tip?, items:[ item ], sentences?:[ pair ] }

     item    = { it, en, pos?, hint? }        // vocabulary pair
     pair    = { it, en, hint? }              // full sentence pair

   Exercises are GENERATED from this data by engine.js, so adding content is
   just a matter of adding items/sentences here — no exercise hand-authoring.
   ========================================================================== */

const COURSE = [
/* ========================================================================== */
/*  SECTION A1 — Absolute beginner                                            */
/* ========================================================================== */
{
  id: "a1", cefr: "A1", title: "Beginner — First words",
  units: [
    {
      id: "a1u1", title: "Basics 1", icon: "🌱",
      lessons: [
        {
          id: "a1u1l1", title: "Greetings",
          tip: "Italian has formal and informal registers. <b>ciao</b> is informal (hi/bye); <b>salve</b> and <b>buongiorno</b> are neutral/polite.",
          items: [
            { it: "ciao", en: "hi / bye", pos: "interj" },
            { it: "salve", en: "hello (polite)", pos: "interj" },
            { it: "buongiorno", en: "good morning", pos: "interj" },
            { it: "buonasera", en: "good evening", pos: "interj" },
            { it: "buonanotte", en: "good night", pos: "interj" },
            { it: "arrivederci", en: "goodbye", pos: "interj" },
            { it: "grazie", en: "thank you", pos: "interj" },
            { it: "prego", en: "you're welcome", pos: "interj" },
            { it: "per favore", en: "please" },
            { it: "sì", en: "yes" },
            { it: "no", en: "no" },
          ],
          sentences: [
            { it: "Ciao, come stai?", en: "Hi, how are you?" },
            { it: "Buongiorno, signora.", en: "Good morning, madam." },
            { it: "Grazie mille!", en: "Thanks a lot!" },
          ],
        },
        {
          id: "a1u1l2", title: "People",
          tip: "Nouns have gender. Most ending in <b>-o</b> are masculine, most in <b>-a</b> are feminine.",
          items: [
            { it: "l'uomo", en: "the man", pos: "noun m" },
            { it: "la donna", en: "the woman", pos: "noun f" },
            { it: "il ragazzo", en: "the boy", pos: "noun m" },
            { it: "la ragazza", en: "the girl", pos: "noun f" },
            { it: "il bambino", en: "the child (m)", pos: "noun m" },
            { it: "la bambina", en: "the child (f)", pos: "noun f" },
            { it: "l'amico", en: "the friend (m)", pos: "noun m" },
            { it: "l'amica", en: "the friend (f)", pos: "noun f" },
            { it: "io", en: "I", pos: "pron" },
            { it: "tu", en: "you", pos: "pron" },
          ],
          sentences: [
            { it: "Io sono un ragazzo.", en: "I am a boy." },
            { it: "Tu sei una donna.", en: "You are a woman." },
            { it: "L'uomo e la donna.", en: "The man and the woman." },
          ],
        },
        {
          id: "a1u1l3", title: "To be & to have",
          tip: "<b>essere</b> (to be): io sono, tu sei, lui/lei è, noi siamo, voi siete, loro sono.<br><b>avere</b> (to have): io ho, tu hai, lui/lei ha, noi abbiamo, voi avete, loro hanno.",
          items: [
            { it: "sono", en: "I am / they are" },
            { it: "sei", en: "you are" },
            { it: "è", en: "he/she/it is" },
            { it: "siamo", en: "we are" },
            { it: "ho", en: "I have" },
            { it: "hai", en: "you have" },
            { it: "ha", en: "he/she has" },
            { it: "abbiamo", en: "we have" },
          ],
          sentences: [
            { it: "Io sono italiano.", en: "I am Italian." },
            { it: "Lei è una donna.", en: "She is a woman." },
            { it: "Noi siamo amici.", en: "We are friends." },
            { it: "Ho un amico.", en: "I have a friend." },
            { it: "Hai una sorella?", en: "Do you have a sister?" },
          ],
        },
      ],
    },
    {
      id: "a1u2", title: "Basics 2", icon: "🍎",
      lessons: [
        {
          id: "a1u2l1", title: "Food & drink",
          tip: "The indefinite article: <b>un/uno</b> (m), <b>una/un'</b> (f).",
          items: [
            { it: "il pane", en: "the bread", pos: "noun m" },
            { it: "l'acqua", en: "the water", pos: "noun f" },
            { it: "il vino", en: "the wine", pos: "noun m" },
            { it: "il caffè", en: "the coffee", pos: "noun m" },
            { it: "il latte", en: "the milk", pos: "noun m" },
            { it: "la mela", en: "the apple", pos: "noun f" },
            { it: "il formaggio", en: "the cheese", pos: "noun m" },
            { it: "la pizza", en: "the pizza", pos: "noun f" },
            { it: "la pasta", en: "the pasta", pos: "noun f" },
            { it: "mangiare", en: "to eat", pos: "verb" },
            { it: "bere", en: "to drink", pos: "verb" },
          ],
          sentences: [
            { it: "Mangio una mela.", en: "I eat an apple." },
            { it: "Bevo il caffè.", en: "I drink coffee." },
            { it: "Vorrei un bicchiere di vino.", en: "I would like a glass of wine." },
            { it: "Il pane è fresco.", en: "The bread is fresh." },
          ],
        },
        {
          id: "a1u2l2", title: "Numbers 1–20",
          items: [
            { it: "uno", en: "one" }, { it: "due", en: "two" },
            { it: "tre", en: "three" }, { it: "quattro", en: "four" },
            { it: "cinque", en: "five" }, { it: "sei", en: "six" },
            { it: "sette", en: "seven" }, { it: "otto", en: "eight" },
            { it: "nove", en: "nine" }, { it: "dieci", en: "ten" },
            { it: "undici", en: "eleven" }, { it: "dodici", en: "twelve" },
            { it: "venti", en: "twenty" },
          ],
          sentences: [
            { it: "Ho tre amici.", en: "I have three friends." },
            { it: "Due caffè, per favore.", en: "Two coffees, please." },
            { it: "Sono le dieci.", en: "It's ten o'clock." },
          ],
        },
        {
          id: "a1u2l3", title: "Colours & adjectives",
          tip: "Adjectives agree with the noun in gender and number: <b>rosso / rossa / rossi / rosse</b>.",
          items: [
            { it: "rosso", en: "red" }, { it: "blu", en: "blue" },
            { it: "verde", en: "green" }, { it: "giallo", en: "yellow" },
            { it: "nero", en: "black" }, { it: "bianco", en: "white" },
            { it: "grande", en: "big" }, { it: "piccolo", en: "small" },
            { it: "bello", en: "beautiful" }, { it: "buono", en: "good" },
          ],
          sentences: [
            { it: "La mela è rossa.", en: "The apple is red." },
            { it: "Una grande casa bianca.", en: "A big white house." },
            { it: "Il vino è buono.", en: "The wine is good." },
          ],
        },
      ],
    },
    {
      id: "a1u3", title: "Everyday life", icon: "🏠",
      lessons: [
        {
          id: "a1u3l1", title: "The family",
          items: [
            { it: "la madre", en: "the mother", pos: "noun f" },
            { it: "il padre", en: "the father", pos: "noun m" },
            { it: "il figlio", en: "the son", pos: "noun m" },
            { it: "la figlia", en: "the daughter", pos: "noun f" },
            { it: "il fratello", en: "the brother", pos: "noun m" },
            { it: "la sorella", en: "the sister", pos: "noun f" },
            { it: "il marito", en: "the husband", pos: "noun m" },
            { it: "la moglie", en: "the wife", pos: "noun f" },
            { it: "i genitori", en: "the parents", pos: "noun m pl" },
          ],
          sentences: [
            { it: "Mia madre è italiana.", en: "My mother is Italian." },
            { it: "Ho due fratelli.", en: "I have two brothers." },
            { it: "Questa è mia sorella.", en: "This is my sister." },
          ],
        },
        {
          id: "a1u3l2", title: "The house",
          items: [
            { it: "la casa", en: "the house", pos: "noun f" },
            { it: "la camera", en: "the room", pos: "noun f" },
            { it: "la cucina", en: "the kitchen", pos: "noun f" },
            { it: "il bagno", en: "the bathroom", pos: "noun m" },
            { it: "il letto", en: "the bed", pos: "noun m" },
            { it: "la porta", en: "the door", pos: "noun f" },
            { it: "la finestra", en: "the window", pos: "noun f" },
            { it: "il tavolo", en: "the table", pos: "noun m" },
          ],
          sentences: [
            { it: "La cucina è grande.", en: "The kitchen is big." },
            { it: "Apro la finestra.", en: "I open the window." },
            { it: "Il letto è in camera.", en: "The bed is in the bedroom." },
          ],
        },
        {
          id: "a1u3l3", title: "Common verbs (present)",
          tip: "Regular <b>-are</b> verbs (parlare): parlo, parli, parla, parliamo, parlate, parlano.",
          items: [
            { it: "parlare", en: "to speak", pos: "verb" },
            { it: "parlo", en: "I speak" },
            { it: "parli", en: "you speak" },
            { it: "parla", en: "he/she speaks" },
            { it: "abitare", en: "to live (reside)", pos: "verb" },
            { it: "lavorare", en: "to work", pos: "verb" },
            { it: "studiare", en: "to study", pos: "verb" },
            { it: "guardare", en: "to watch/look", pos: "verb" },
          ],
          sentences: [
            { it: "Parlo un po' di italiano.", en: "I speak a little Italian." },
            { it: "Abito a Roma.", en: "I live in Rome." },
            { it: "Lavoro in ufficio.", en: "I work in an office." },
            { it: "Studio l'italiano ogni giorno.", en: "I study Italian every day." },
          ],
        },
      ],
    },
  ],
},

/* ========================================================================== */
/*  SECTION A2 — Elementary                                                   */
/* ========================================================================== */
{
  id: "a2", cefr: "A2", title: "Elementary — Getting around",
  units: [
    {
      id: "a2u1", title: "Out & about", icon: "🧭",
      lessons: [
        {
          id: "a2u1l1", title: "In the city",
          items: [
            { it: "la strada", en: "the street", pos: "noun f" },
            { it: "la piazza", en: "the square", pos: "noun f" },
            { it: "il negozio", en: "the shop", pos: "noun m" },
            { it: "il ristorante", en: "the restaurant", pos: "noun m" },
            { it: "la stazione", en: "the station", pos: "noun f" },
            { it: "l'ospedale", en: "the hospital", pos: "noun m" },
            { it: "la banca", en: "the bank", pos: "noun f" },
            { it: "la chiesa", en: "the church", pos: "noun f" },
          ],
          sentences: [
            { it: "Dov'è la stazione?", en: "Where is the station?" },
            { it: "Il ristorante è in piazza.", en: "The restaurant is in the square." },
            { it: "Vado al negozio.", en: "I'm going to the shop." },
          ],
        },
        {
          id: "a2u1l2", title: "Directions",
          tip: "Prepositions + article combine: a+il = <b>al</b>, in+la = <b>nella</b>, di+il = <b>del</b>.",
          items: [
            { it: "a destra", en: "to the right" },
            { it: "a sinistra", en: "to the left" },
            { it: "dritto", en: "straight on" },
            { it: "vicino", en: "near" },
            { it: "lontano", en: "far" },
            { it: "qui", en: "here" },
            { it: "là", en: "there" },
            { it: "girare", en: "to turn", pos: "verb" },
          ],
          sentences: [
            { it: "Gira a destra.", en: "Turn right." },
            { it: "È vicino alla banca.", en: "It's near the bank." },
            { it: "Vai sempre dritto.", en: "Keep going straight on." },
          ],
        },
        {
          id: "a2u1l3", title: "Travel & transport",
          items: [
            { it: "il treno", en: "the train", pos: "noun m" },
            { it: "l'autobus", en: "the bus", pos: "noun m" },
            { it: "la macchina", en: "the car", pos: "noun f" },
            { it: "l'aereo", en: "the plane", pos: "noun m" },
            { it: "il biglietto", en: "the ticket", pos: "noun m" },
            { it: "l'aeroporto", en: "the airport", pos: "noun m" },
            { it: "andare", en: "to go", pos: "verb" },
            { it: "partire", en: "to leave/depart", pos: "verb" },
          ],
          sentences: [
            { it: "Prendo il treno per Milano.", en: "I'm taking the train to Milan." },
            { it: "A che ora parte l'autobus?", en: "What time does the bus leave?" },
            { it: "Vorrei un biglietto, per favore.", en: "I'd like a ticket, please." },
          ],
        },
      ],
    },
    {
      id: "a2u2", title: "Daily routine", icon: "⏰",
      lessons: [
        {
          id: "a2u2l1", title: "Time & days",
          items: [
            { it: "l'ora", en: "the hour/time", pos: "noun f" },
            { it: "il giorno", en: "the day", pos: "noun m" },
            { it: "la settimana", en: "the week", pos: "noun f" },
            { it: "oggi", en: "today" },
            { it: "domani", en: "tomorrow" },
            { it: "ieri", en: "yesterday" },
            { it: "lunedì", en: "Monday" },
            { it: "venerdì", en: "Friday" },
            { it: "il mese", en: "the month", pos: "noun m" },
          ],
          sentences: [
            { it: "Che ora è?", en: "What time is it?" },
            { it: "Oggi è lunedì.", en: "Today is Monday." },
            { it: "Ci vediamo domani.", en: "See you tomorrow." },
          ],
        },
        {
          id: "a2u2l2", title: "Reflexive & routine",
          tip: "Reflexive verbs use <b>mi, ti, si, ci, vi, si</b>: io mi sveglio = I wake (myself) up.",
          items: [
            { it: "svegliarsi", en: "to wake up", pos: "verb refl" },
            { it: "alzarsi", en: "to get up", pos: "verb refl" },
            { it: "lavarsi", en: "to wash oneself", pos: "verb refl" },
            { it: "vestirsi", en: "to get dressed", pos: "verb refl" },
            { it: "mi sveglio", en: "I wake up" },
            { it: "mi alzo", en: "I get up" },
            { it: "fare colazione", en: "to have breakfast" },
            { it: "dormire", en: "to sleep", pos: "verb" },
          ],
          sentences: [
            { it: "Mi sveglio alle sette.", en: "I wake up at seven." },
            { it: "Faccio colazione a casa.", en: "I have breakfast at home." },
            { it: "La sera dormo poco.", en: "In the evening I sleep little." },
          ],
        },
        {
          id: "a2u2l3", title: "Likes & wants",
          tip: "<b>mi piace</b> + singular / <b>mi piacciono</b> + plural = I like. Literally 'it is pleasing to me'.",
          items: [
            { it: "mi piace", en: "I like (it)" },
            { it: "mi piacciono", en: "I like (them)" },
            { it: "voglio", en: "I want" },
            { it: "vorrei", en: "I would like" },
            { it: "posso", en: "I can / may I" },
            { it: "devo", en: "I must / have to" },
            { it: "preferire", en: "to prefer", pos: "verb" },
          ],
          sentences: [
            { it: "Mi piace la pizza.", en: "I like pizza." },
            { it: "Mi piacciono i film italiani.", en: "I like Italian films." },
            { it: "Vorrei un caffè, grazie.", en: "I'd like a coffee, thanks." },
            { it: "Devo andare a lavoro.", en: "I have to go to work." },
          ],
        },
      ],
    },
    {
      id: "a2u3", title: "Talking about the past", icon: "📅",
      lessons: [
        {
          id: "a2u3l1", title: "Past tense (passato prossimo)",
          tip: "Formed with <b>avere/essere</b> + past participle: ho mangiato (I ate), sono andato (I went). Verbs of motion use <b>essere</b> and agree in gender.",
          items: [
            { it: "ho mangiato", en: "I ate / I have eaten" },
            { it: "ho fatto", en: "I did / made" },
            { it: "sono andato/a", en: "I went" },
            { it: "sono stato/a", en: "I was / have been" },
            { it: "ho visto", en: "I saw" },
            { it: "ho detto", en: "I said" },
            { it: "ieri sera", en: "last night" },
          ],
          sentences: [
            { it: "Ieri ho mangiato al ristorante.", en: "Yesterday I ate at the restaurant." },
            { it: "Sono andato a Roma la settimana scorsa.", en: "I went to Rome last week." },
            { it: "Abbiamo visto un bel film.", en: "We saw a good film." },
          ],
        },
        {
          id: "a2u3l2", title: "Weather & seasons",
          items: [
            { it: "il tempo", en: "the weather", pos: "noun m" },
            { it: "il sole", en: "the sun", pos: "noun m" },
            { it: "la pioggia", en: "the rain", pos: "noun f" },
            { it: "la neve", en: "the snow", pos: "noun f" },
            { it: "caldo", en: "hot" },
            { it: "freddo", en: "cold" },
            { it: "l'estate", en: "the summer", pos: "noun f" },
            { it: "l'inverno", en: "the winter", pos: "noun m" },
          ],
          sentences: [
            { it: "Oggi fa caldo.", en: "Today it's hot." },
            { it: "In inverno nevica.", en: "In winter it snows." },
            { it: "Che tempo fa?", en: "What's the weather like?" },
          ],
        },
        {
          id: "a2u3l3", title: "Shopping & money",
          items: [
            { it: "comprare", en: "to buy", pos: "verb" },
            { it: "pagare", en: "to pay", pos: "verb" },
            { it: "il prezzo", en: "the price", pos: "noun m" },
            { it: "i soldi", en: "the money", pos: "noun m pl" },
            { it: "caro", en: "expensive" },
            { it: "economico", en: "cheap" },
            { it: "quanto costa", en: "how much does it cost" },
            { it: "il conto", en: "the bill", pos: "noun m" },
          ],
          sentences: [
            { it: "Quanto costa questo?", en: "How much does this cost?" },
            { it: "Il conto, per favore.", en: "The bill, please." },
            { it: "È troppo caro.", en: "It's too expensive." },
          ],
        },
      ],
    },
  ],
},

/* ========================================================================== */
/*  SECTION B1 — Intermediate                                                 */
/* ========================================================================== */
{
  id: "b1", cefr: "B1", title: "Intermediate — Expressing yourself",
  units: [
    {
      id: "b1u1", title: "Work & study", icon: "💼",
      lessons: [
        {
          id: "b1u1l1", title: "Jobs & workplace",
          items: [
            { it: "il lavoro", en: "the job/work", pos: "noun m" },
            { it: "l'azienda", en: "the company", pos: "noun f" },
            { it: "il collega", en: "the colleague", pos: "noun m" },
            { it: "la riunione", en: "the meeting", pos: "noun f" },
            { it: "lo stipendio", en: "the salary", pos: "noun m" },
            { it: "assumere", en: "to hire", pos: "verb" },
            { it: "licenziare", en: "to fire", pos: "verb" },
            { it: "il capo", en: "the boss", pos: "noun m" },
          ],
          sentences: [
            { it: "Ho una riunione alle tre.", en: "I have a meeting at three." },
            { it: "Lavoro per una grande azienda.", en: "I work for a big company." },
            { it: "Il mio collega è molto bravo.", en: "My colleague is very good." },
          ],
        },
        {
          id: "b1u1l2", title: "The future tense",
          tip: "Future (futuro semplice): parlerò, parlerai, parlerà, parleremo, parlerete, parleranno.",
          items: [
            { it: "andrò", en: "I will go" },
            { it: "farò", en: "I will do/make" },
            { it: "sarò", en: "I will be" },
            { it: "avrò", en: "I will have" },
            { it: "parlerò", en: "I will speak" },
            { it: "domani", en: "tomorrow" },
            { it: "il futuro", en: "the future", pos: "noun m" },
          ],
          sentences: [
            { it: "Domani andrò al mare.", en: "Tomorrow I will go to the seaside." },
            { it: "L'anno prossimo studierò di più.", en: "Next year I will study more." },
            { it: "Che cosa farai stasera?", en: "What will you do tonight?" },
          ],
        },
        {
          id: "b1u1l3", title: "Opinions & connectors",
          tip: "Useful linkers: <b>perché</b> (because), <b>però/ma</b> (but), <b>quindi</b> (so), <b>anche</b> (also), <b>invece</b> (instead).",
          items: [
            { it: "penso che", en: "I think that" },
            { it: "secondo me", en: "in my opinion" },
            { it: "sono d'accordo", en: "I agree" },
            { it: "perché", en: "because / why" },
            { it: "però", en: "however / but" },
            { it: "quindi", en: "therefore / so" },
            { it: "invece", en: "instead / on the other hand" },
          ],
          sentences: [
            { it: "Secondo me hai ragione.", en: "In my opinion you're right." },
            { it: "Penso che sia una buona idea.", en: "I think it's a good idea." },
            { it: "Mi piace, però è caro.", en: "I like it, but it's expensive." },
          ],
        },
      ],
    },
    {
      id: "b1u2", title: "Health & feelings", icon: "❤️",
      lessons: [
        {
          id: "b1u2l1", title: "The body & health",
          items: [
            { it: "la testa", en: "the head", pos: "noun f" },
            { it: "la mano", en: "the hand", pos: "noun f" },
            { it: "il piede", en: "the foot", pos: "noun m" },
            { it: "lo stomaco", en: "the stomach", pos: "noun m" },
            { it: "il medico", en: "the doctor", pos: "noun m" },
            { it: "la medicina", en: "the medicine", pos: "noun f" },
            { it: "stare male", en: "to feel unwell" },
            { it: "avere mal di", en: "to have an ache in" },
          ],
          sentences: [
            { it: "Ho mal di testa.", en: "I have a headache." },
            { it: "Devo andare dal medico.", en: "I have to go to the doctor." },
            { it: "Oggi sto male.", en: "Today I feel unwell." },
          ],
        },
        {
          id: "b1u2l2", title: "Emotions",
          items: [
            { it: "felice", en: "happy" },
            { it: "triste", en: "sad" },
            { it: "arrabbiato", en: "angry" },
            { it: "stanco", en: "tired" },
            { it: "preoccupato", en: "worried" },
            { it: "avere paura", en: "to be afraid" },
            { it: "sentirsi", en: "to feel", pos: "verb refl" },
          ],
          sentences: [
            { it: "Mi sento molto felice oggi.", en: "I feel very happy today." },
            { it: "Perché sei arrabbiato?", en: "Why are you angry?" },
            { it: "Ho paura di volare.", en: "I'm afraid of flying." },
          ],
        },
        {
          id: "b1u2l3", title: "The imperfect tense",
          tip: "Imperfetto describes ongoing/habitual past: <b>parlavo</b> (I was speaking / used to speak), <b>ero</b> (I was), <b>avevo</b> (I had).",
          items: [
            { it: "ero", en: "I was" },
            { it: "avevo", en: "I had" },
            { it: "facevo", en: "I was doing / used to do" },
            { it: "andavo", en: "I used to go" },
            { it: "da bambino", en: "as a child" },
            { it: "sempre", en: "always" },
            { it: "spesso", en: "often" },
          ],
          sentences: [
            { it: "Da bambino giocavo a calcio.", en: "As a child I used to play football." },
            { it: "Ogni estate andavamo al mare.", en: "Every summer we used to go to the seaside." },
            { it: "Ero stanco, quindi sono andato a letto.", en: "I was tired, so I went to bed." },
          ],
        },
      ],
    },
  ],
},

/* ========================================================================== */
/*  SECTION B2 — Upper intermediate                                           */
/* ========================================================================== */
{
  id: "b2", cefr: "B2", title: "Upper intermediate — Nuance",
  units: [
    {
      id: "b2u1", title: "Abstract ideas", icon: "💡",
      lessons: [
        {
          id: "b2u1l1", title: "The subjunctive (congiuntivo)",
          tip: "The congiuntivo expresses doubt, wish, emotion: <b>Penso che sia vero</b> (I think it's true), <b>Spero che tu stia bene</b> (I hope you're well).",
          items: [
            { it: "sia", en: "(that) it be / he-she be" },
            { it: "abbia", en: "(that) he/she have" },
            { it: "faccia", en: "(that) he/she do" },
            { it: "spero che", en: "I hope that" },
            { it: "credo che", en: "I believe that" },
            { it: "benché", en: "although" },
            { it: "affinché", en: "so that" },
          ],
          sentences: [
            { it: "Spero che tu stia bene.", en: "I hope you're well." },
            { it: "Credo che abbia ragione.", en: "I believe he's right." },
            { it: "Benché sia tardi, lavoro ancora.", en: "Although it's late, I'm still working." },
          ],
        },
        {
          id: "b2u1l2", title: "The conditional",
          tip: "Conditional (condizionale): <b>vorrei</b> (I would like), <b>potrei</b> (I could), <b>dovrei</b> (I should).",
          items: [
            { it: "vorrei", en: "I would like" },
            { it: "potrei", en: "I could" },
            { it: "dovrei", en: "I should" },
            { it: "sarebbe", en: "it would be" },
            { it: "mi piacerebbe", en: "I would like (to)" },
            { it: "magari", en: "maybe / if only" },
          ],
          sentences: [
            { it: "Potresti aiutarmi?", en: "Could you help me?" },
            { it: "Mi piacerebbe visitare la Sicilia.", en: "I would like to visit Sicily." },
            { it: "Dovresti riposarti.", en: "You should rest." },
          ],
        },
      ],
    },
    {
      id: "b2u2", title: "Society & media", icon: "📰",
      lessons: [
        {
          id: "b2u2l1", title: "News & current affairs",
          items: [
            { it: "il giornale", en: "the newspaper", pos: "noun m" },
            { it: "la notizia", en: "the news item", pos: "noun f" },
            { it: "il governo", en: "the government", pos: "noun m" },
            { it: "l'ambiente", en: "the environment", pos: "noun m" },
            { it: "la società", en: "society", pos: "noun f" },
            { it: "sviluppare", en: "to develop", pos: "verb" },
            { it: "riguardare", en: "to concern/regard", pos: "verb" },
          ],
          sentences: [
            { it: "Questa notizia riguarda l'ambiente.", en: "This news concerns the environment." },
            { it: "Il governo ha annunciato nuove regole.", en: "The government announced new rules." },
            { it: "Leggo il giornale ogni mattina.", en: "I read the newspaper every morning." },
          ],
        },
        {
          id: "b2u2l2", title: "Idiomatic expressions",
          tip: "Idioms don't translate literally — learn them as chunks.",
          items: [
            { it: "in bocca al lupo", en: "good luck (lit. in the wolf's mouth)" },
            { it: "non vedo l'ora", en: "I can't wait" },
            { it: "avere voglia di", en: "to feel like" },
            { it: "fare il tifo per", en: "to root for" },
            { it: "costare un occhio della testa", en: "to cost a fortune" },
            { it: "prendere in giro", en: "to tease / make fun of" },
          ],
          sentences: [
            { it: "Non vedo l'ora di partire.", en: "I can't wait to leave." },
            { it: "Ho voglia di un gelato.", en: "I feel like (having) an ice cream." },
            { it: "In bocca al lupo per l'esame!", en: "Good luck with the exam!" },
          ],
        },
      ],
    },
  ],
},

/* ========================================================================== */
/*  SECTION C1 — Advanced                                                     */
/* ========================================================================== */
{
  id: "c1", cefr: "C1", title: "Advanced — Toward fluency",
  units: [
    {
      id: "c1u1", title: "Sophisticated language", icon: "🎓",
      lessons: [
        {
          id: "c1u1l1", title: "Nuanced vocabulary",
          items: [
            { it: "tuttavia", en: "nevertheless" },
            { it: "inoltre", en: "moreover" },
            { it: "pertanto", en: "therefore (formal)" },
            { it: "nonostante", en: "despite" },
            { it: "ambiguo", en: "ambiguous" },
            { it: "consapevole", en: "aware" },
            { it: "approfondire", en: "to deepen / examine in depth", pos: "verb" },
            { it: "sfumatura", en: "nuance/shade", pos: "noun f" },
          ],
          sentences: [
            { it: "Nonostante le difficoltà, ha avuto successo.", en: "Despite the difficulties, he succeeded." },
            { it: "Vorrei approfondire questo argomento.", en: "I'd like to examine this topic in depth." },
            { it: "È una questione ambigua e complessa.", en: "It's an ambiguous and complex matter." },
          ],
        },
        {
          id: "c1u1l2", title: "The passato remoto",
          tip: "Passato remoto is the literary/historical past, common in writing and in the south: <b>fu</b> (he was), <b>disse</b> (he said), <b>andò</b> (he went).",
          items: [
            { it: "fu", en: "he/she/it was" },
            { it: "disse", en: "he/she said" },
            { it: "andò", en: "he/she went" },
            { it: "fece", en: "he/she did/made" },
            { it: "ebbe", en: "he/she had" },
            { it: "nacque", en: "he/she was born" },
          ],
          sentences: [
            { it: "Dante nacque a Firenze nel 1265.", en: "Dante was born in Florence in 1265." },
            { it: "Il re disse la verità.", en: "The king told the truth." },
            { it: "Fu un momento importante.", en: "It was an important moment." },
          ],
        },
        {
          id: "c1u1l3", title: "Formal register",
          tip: "Formal 'you' is <b>Lei</b>, using the third person: <b>Lei è</b> (you are), <b>Come sta?</b> (How are you?).",
          items: [
            { it: "gentilmente", en: "kindly" },
            { it: "La ringrazio", en: "I thank you (formal)" },
            { it: "Le dispiace se", en: "Do you mind if (formal)" },
            { it: "cordiali saluti", en: "kind regards" },
            { it: "in allegato", en: "attached (in an email)" },
            { it: "resto a disposizione", en: "I remain available" },
          ],
          sentences: [
            { it: "La ringrazio per la Sua disponibilità.", en: "Thank you for your availability." },
            { it: "Le dispiace se apro la finestra?", en: "Do you mind if I open the window?" },
            { it: "In allegato trova il documento.", en: "Attached you will find the document." },
          ],
        },
      ],
    },
  ],
},
];

/* Make available to the engine. */
if (typeof window !== "undefined") window.COURSE = COURSE;
