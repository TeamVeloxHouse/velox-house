/* ============================================================================
   COURSE EXTRA 3 — more guided-path depth (targets 100+ lessons total).
   Merges after course.js + course-extra.js + course-extra2.js.
   ========================================================================== */
(function () {
  const C = window.COURSE;
  const sec = id => C.find(s => s.id === id);
  const add = (sectionId, units) => sec(sectionId).units.push(...units);

  /* ======================================================================== */
  /*  A1                                                                      */
  /* ======================================================================== */
  add("a1", [
    {
      id: "a1u8", title: "Places in town", icon: "🏙️",
      lessons: [
        {
          id: "a1u8l1", title: "Buildings & places",
          items: [
            { it: "la scuola", en: "the school", pos: "noun f" },
            { it: "l'ufficio", en: "the office", pos: "noun m" },
            { it: "il bar", en: "the café/bar", pos: "noun m" },
            { it: "il parco", en: "the park", pos: "noun m" },
            { it: "il museo", en: "the museum", pos: "noun m" },
            { it: "la biblioteca", en: "the library", pos: "noun f" },
            { it: "il cinema", en: "the cinema", pos: "noun m" },
            { it: "il mercato", en: "the market", pos: "noun m" },
          ],
          sentences: [
            { it: "Vado al bar a prendere un caffè.", en: "I'm going to the café for a coffee." },
            { it: "La biblioteca è vicino alla scuola.", en: "The library is near the school." },
            { it: "Ci incontriamo al parco.", en: "We'll meet at the park." },
          ],
        },
        {
          id: "a1u8l2", title: "Prepositions of place",
          tip: "<b>su</b> on · <b>sotto</b> under · <b>in</b> in · <b>davanti a</b> in front of · <b>dietro</b> behind · <b>tra/fra</b> between.",
          items: [
            { it: "su", en: "on" }, { it: "sotto", en: "under" },
            { it: "dentro", en: "inside" }, { it: "fuori", en: "outside" },
            { it: "davanti a", en: "in front of" }, { it: "dietro", en: "behind" },
            { it: "tra", en: "between / among" }, { it: "accanto a", en: "next to" },
          ],
          sentences: [
            { it: "Il gatto è sotto il tavolo.", en: "The cat is under the table." },
            { it: "La banca è davanti alla chiesa.", en: "The bank is in front of the church." },
            { it: "Il bar è tra il museo e il parco.", en: "The café is between the museum and the park." },
          ],
        },
        {
          id: "a1u8l3", title: "Verbs: -ere and -ire",
          tip: "<b>-ere</b> (prendere): prendo, prendi, prende, prendiamo, prendete, prendono. <b>-ire</b> (dormire): dormo, dormi, dorme, dormiamo, dormite, dormono.",
          items: [
            { it: "prendere", en: "to take", pos: "verb" },
            { it: "scrivere", en: "to write", pos: "verb" },
            { it: "vivere", en: "to live", pos: "verb" },
            { it: "aprire", en: "to open", pos: "verb" },
            { it: "sentire", en: "to hear/feel", pos: "verb" },
            { it: "partire", en: "to leave", pos: "verb" },
            { it: "capire", en: "to understand", pos: "verb" },
          ],
          sentences: [
            { it: "Prendo l'autobus ogni giorno.", en: "I take the bus every day." },
            { it: "Non capisco questa parola.", en: "I don't understand this word." },
            { it: "Scrivo una lettera a mia madre.", en: "I'm writing a letter to my mother." },
          ],
        },
      ],
    },
    {
      id: "a1u9", title: "Daily essentials", icon: "🗝️",
      lessons: [
        {
          id: "a1u9l1", title: "Common objects",
          items: [
            { it: "la chiave", en: "the key", pos: "noun f" },
            { it: "il telefono", en: "the phone", pos: "noun m" },
            { it: "la borsa", en: "the bag", pos: "noun f" },
            { it: "il portafoglio", en: "the wallet", pos: "noun m" },
            { it: "l'ombrello", en: "the umbrella", pos: "noun m" },
            { it: "gli occhiali", en: "the glasses", pos: "noun m pl" },
            { it: "l'orologio", en: "the watch/clock", pos: "noun m" },
            { it: "il libro", en: "the book", pos: "noun m" },
          ],
          sentences: [
            { it: "Dove sono le mie chiavi?", en: "Where are my keys?" },
            { it: "Ho dimenticato l'ombrello.", en: "I forgot the umbrella." },
            { it: "Il mio telefono è nella borsa.", en: "My phone is in the bag." },
          ],
        },
        {
          id: "a1u9l2", title: "Useful short phrases",
          items: [
            { it: "non lo so", en: "I don't know" },
            { it: "non capisco", en: "I don't understand" },
            { it: "può ripetere", en: "can you repeat" },
            { it: "come si dice", en: "how do you say" },
            { it: "va bene", en: "okay / that's fine" },
            { it: "mi dispiace", en: "I'm sorry" },
            { it: "scusi", en: "excuse me (formal)" },
            { it: "certo", en: "of course" },
          ],
          sentences: [
            { it: "Scusi, non ho capito.", en: "Sorry, I didn't understand." },
            { it: "Come si dice 'dog' in italiano?", en: "How do you say 'dog' in Italian?" },
            { it: "Può ripetere più lentamente?", en: "Can you repeat more slowly?" },
          ],
        },
        {
          id: "a1u9l3", title: "Negatives",
          tip: "Negate with <b>non</b> before the verb: <b>non parlo</b> (I don't speak). Double negatives are normal: <b>non ho niente</b> (I have nothing).",
          items: [
            { it: "non", en: "not" }, { it: "niente", en: "nothing" },
            { it: "nessuno", en: "nobody" }, { it: "mai", en: "never" },
            { it: "né... né", en: "neither... nor" },
            { it: "non ancora", en: "not yet" }, { it: "più", en: "(not) anymore" },
          ],
          sentences: [
            { it: "Non ho niente da fare.", en: "I have nothing to do." },
            { it: "Non c'è nessuno in casa.", en: "There's nobody at home." },
            { it: "Non lavoro più qui.", en: "I don't work here anymore." },
          ],
        },
      ],
    },
  ]);

  /* ======================================================================== */
  /*  A2                                                                      */
  /* ======================================================================== */
  add("a2", [
    {
      id: "a2u8", title: "Work & professions", icon: "👷",
      lessons: [
        {
          id: "a2u8l1", title: "Jobs",
          items: [
            { it: "il medico", en: "the doctor", pos: "noun m" },
            { it: "l'insegnante", en: "the teacher", pos: "noun" },
            { it: "l'avvocato", en: "the lawyer", pos: "noun m" },
            { it: "l'ingegnere", en: "the engineer", pos: "noun m" },
            { it: "il cuoco", en: "the cook/chef", pos: "noun m" },
            { it: "il commesso", en: "the shop assistant", pos: "noun m" },
            { it: "l'operaio", en: "the factory worker", pos: "noun m" },
            { it: "fare il/la", en: "to work as a" },
          ],
          sentences: [
            { it: "Faccio l'insegnante.", en: "I work as a teacher." },
            { it: "Mia sorella è medico.", en: "My sister is a doctor." },
            { it: "Che lavoro fai?", en: "What do you do for work?" },
          ],
        },
        {
          id: "a2u8l2", title: "Talking about the future",
          tip: "Simple future endings (-are/-ere): parler<b>ò</b>, -ai, -à, -emo, -ete, -anno. Irregular stems: <b>sar-, avr-, andr-, far-, verr-</b>.",
          items: [
            { it: "domani", en: "tomorrow" },
            { it: "la prossima settimana", en: "next week" },
            { it: "l'anno prossimo", en: "next year" },
            { it: "finirò", en: "I will finish" },
            { it: "verrò", en: "I will come" },
            { it: "comincerà", en: "it will begin" },
            { it: "fra poco", en: "soon / shortly" },
          ],
          sentences: [
            { it: "La prossima settimana comincerò un nuovo lavoro.", en: "Next week I'll start a new job." },
            { it: "Verrò alla festa con te.", en: "I'll come to the party with you." },
            { it: "Fra poco finirà la lezione.", en: "The lesson will finish soon." },
          ],
        },
        {
          id: "a2u8l3", title: "Phone & communication",
          items: [
            { it: "chiamare", en: "to call", pos: "verb" },
            { it: "rispondere", en: "to answer", pos: "verb" },
            { it: "il numero", en: "the number", pos: "noun m" },
            { it: "pronto", en: "hello (on the phone)" },
            { it: "lasciare un messaggio", en: "to leave a message" },
            { it: "richiamare", en: "to call back", pos: "verb" },
            { it: "occupato", en: "busy (line)" },
          ],
          sentences: [
            { it: "Pronto, chi parla?", en: "Hello, who's speaking?" },
            { it: "Ti richiamo più tardi.", en: "I'll call you back later." },
            { it: "Posso lasciare un messaggio?", en: "Can I leave a message?" },
          ],
        },
      ],
    },
  ]);

  /* ======================================================================== */
  /*  B1                                                                      */
  /* ======================================================================== */
  add("b1", [
    {
      id: "b1u7", title: "Money & travel tales", icon: "✈️",
      lessons: [
        {
          id: "b1u7l1", title: "Money & banking",
          items: [
            { it: "il contante", en: "cash", pos: "noun m" },
            { it: "la carta di credito", en: "the credit card", pos: "noun f" },
            { it: "il bancomat", en: "the ATM / debit card", pos: "noun m" },
            { it: "il conto corrente", en: "the bank account", pos: "noun m" },
            { it: "prelevare", en: "to withdraw", pos: "verb" },
            { it: "il resto", en: "the change (money)", pos: "noun m" },
            { it: "gratis", en: "free (of charge)" },
          ],
          sentences: [
            { it: "Posso pagare con la carta?", en: "Can I pay by card?" },
            { it: "Devo prelevare dei contanti.", en: "I need to withdraw some cash." },
            { it: "Ecco il resto.", en: "Here's your change." },
          ],
        },
        {
          id: "b1u7l2", title: "Travel experiences",
          items: [
            { it: "il viaggio", en: "the trip", pos: "noun m" },
            { it: "la vacanza", en: "the holiday", pos: "noun f" },
            { it: "visitare", en: "to visit", pos: "verb" },
            { it: "il paesaggio", en: "the landscape", pos: "noun m" },
            { it: "l'esperienza", en: "the experience", pos: "noun f" },
            { it: "indimenticabile", en: "unforgettable" },
            { it: "all'estero", en: "abroad" },
          ],
          sentences: [
            { it: "L'estate scorsa ho visitato la Sicilia.", en: "Last summer I visited Sicily." },
            { it: "È stata un'esperienza indimenticabile.", en: "It was an unforgettable experience." },
            { it: "Mi piacerebbe lavorare all'estero.", en: "I'd like to work abroad." },
          ],
        },
        {
          id: "b1u7l3", title: "Making suggestions",
          tip: "Suggest with <b>Perché non…?</b> (Why don't we…?), <b>Potremmo…</b> (We could…), <b>Che ne dici di…?</b> (How about…?).",
          items: [
            { it: "perché non", en: "why don't we" },
            { it: "potremmo", en: "we could" },
            { it: "che ne dici di", en: "how about" },
            { it: "facciamo", en: "let's do / make" },
            { it: "andiamo", en: "let's go" },
            { it: "mi va di", en: "I feel like" },
          ],
          sentences: [
            { it: "Che ne dici di andare al cinema?", en: "How about going to the cinema?" },
            { it: "Potremmo cenare fuori stasera.", en: "We could eat out tonight." },
            { it: "Perché non invitiamo gli amici?", en: "Why don't we invite our friends?" },
          ],
        },
      ],
    },
  ]);

  /* ======================================================================== */
  /*  B2                                                                      */
  /* ======================================================================== */
  add("b2", [
    {
      id: "b2u6", title: "Law, work & change", icon: "📋",
      lessons: [
        {
          id: "b2u6l1", title: "Rights & rules",
          items: [
            { it: "la legge", en: "the law", pos: "noun f" },
            { it: "il diritto", en: "the right", pos: "noun m" },
            { it: "il dovere", en: "the duty", pos: "noun m" },
            { it: "vietato", en: "forbidden" },
            { it: "permesso", en: "allowed / permit" },
            { it: "rispettare", en: "to respect/comply", pos: "verb" },
            { it: "la norma", en: "the rule/norm", pos: "noun f" },
          ],
          sentences: [
            { it: "È vietato fumare qui.", en: "Smoking is forbidden here." },
            { it: "Ogni cittadino ha dei diritti e dei doveri.", en: "Every citizen has rights and duties." },
            { it: "Bisogna rispettare le norme.", en: "One must comply with the rules." },
          ],
        },
        {
          id: "b2u6l2", title: "Cause & consequence",
          items: [
            { it: "a causa di", en: "because of" },
            { it: "grazie a", en: "thanks to" },
            { it: "di conseguenza", en: "consequently" },
            { it: "dato che", en: "given that" },
            { it: "poiché", en: "since / because" },
            { it: "al fine di", en: "in order to" },
            { it: "comportare", en: "to entail/involve", pos: "verb" },
          ],
          sentences: [
            { it: "A causa del traffico, siamo arrivati tardi.", en: "Because of the traffic, we arrived late." },
            { it: "Grazie al tuo aiuto, ho finito.", en: "Thanks to your help, I finished." },
            { it: "Dato che piove, restiamo a casa.", en: "Since it's raining, let's stay home." },
          ],
        },
      ],
    },
  ]);

  /* ======================================================================== */
  /*  C1                                                                      */
  /* ======================================================================== */
  add("c1", [
    {
      id: "c1u5", title: "Science & the abstract", icon: "🔬",
      lessons: [
        {
          id: "c1u5l1", title: "Science & research",
          items: [
            { it: "la ricerca", en: "the research", pos: "noun f" },
            { it: "la scoperta", en: "the discovery", pos: "noun f" },
            { it: "l'esperimento", en: "the experiment", pos: "noun m" },
            { it: "i dati", en: "the data", pos: "noun m pl" },
            { it: "dimostrare", en: "to demonstrate/prove", pos: "verb" },
            { it: "lo sviluppo", en: "the development", pos: "noun m" },
            { it: "sorprendente", en: "surprising" },
          ],
          sentences: [
            { it: "La ricerca ha portato a una scoperta importante.", en: "The research led to an important discovery." },
            { it: "I dati dimostrano una chiara tendenza.", en: "The data demonstrate a clear trend." },
            { it: "Lo sviluppo tecnologico è rapidissimo.", en: "Technological development is extremely fast." },
          ],
        },
        {
          id: "c1u5l2", title: "Concession & contrast",
          items: [
            { it: "sebbene", en: "although" },
            { it: "malgrado", en: "in spite of" },
            { it: "per quanto", en: "however much" },
            { it: "anche se", en: "even if" },
            { it: "al contrario", en: "on the contrary" },
            { it: "viceversa", en: "vice versa" },
            { it: "eppure", en: "and yet" },
          ],
          sentences: [
            { it: "Sebbene fosse stanco, ha continuato.", en: "Although he was tired, he carried on." },
            { it: "Per quanto sia difficile, ci proverò.", en: "However difficult it is, I'll try." },
            { it: "Eppure non si è arreso.", en: "And yet he didn't give up." },
          ],
        },
      ],
    },
  ]);

})();
