/* ============================================================================
   COURSE EXTRA 4 — final batch to take the guided path past 100 lessons.
   ========================================================================== */
(function () {
  const C = window.COURSE;
  const sec = id => C.find(s => s.id === id);
  const add = (sectionId, units) => sec(sectionId).units.push(...units);

  add("a2", [
    {
      id: "a2u9", title: "Emergencies & help", icon: "🚨",
      lessons: [
        {
          id: "a2u9l1", title: "Emergencies",
          items: [
            { it: "aiuto", en: "help" },
            { it: "l'emergenza", en: "the emergency", pos: "noun f" },
            { it: "la polizia", en: "the police", pos: "noun f" },
            { it: "l'ambulanza", en: "the ambulance", pos: "noun f" },
            { it: "il pericolo", en: "the danger", pos: "noun m" },
            { it: "l'incidente", en: "the accident", pos: "noun m" },
            { it: "chiamare i soccorsi", en: "to call for help" },
          ],
          sentences: [
            { it: "Aiuto! Chiamate un'ambulanza!", en: "Help! Call an ambulance!" },
            { it: "C'è stato un incidente.", en: "There's been an accident." },
            { it: "Dov'è l'ospedale più vicino?", en: "Where is the nearest hospital?" },
          ],
        },
        {
          id: "a2u9l2", title: "Asking for help",
          items: [
            { it: "mi può aiutare", en: "can you help me" },
            { it: "ho bisogno di", en: "I need" },
            { it: "ho perso", en: "I have lost" },
            { it: "non funziona", en: "it doesn't work" },
            { it: "dov'è il bagno", en: "where is the toilet" },
            { it: "mi sono perso", en: "I'm lost" },
          ],
          sentences: [
            { it: "Mi può aiutare, per favore?", en: "Can you help me, please?" },
            { it: "Ho perso il portafoglio.", en: "I've lost my wallet." },
            { it: "Scusi, mi sono perso.", en: "Excuse me, I'm lost." },
          ],
        },
        {
          id: "a2u9l3", title: "Feelings & reactions",
          items: [
            { it: "che bello", en: "how lovely" },
            { it: "che peccato", en: "what a pity" },
            { it: "davvero", en: "really" },
            { it: "magari", en: "I wish / maybe" },
            { it: "purtroppo", en: "unfortunately" },
            { it: "per fortuna", en: "luckily" },
            { it: "non importa", en: "it doesn't matter" },
          ],
          sentences: [
            { it: "Che peccato, non posso venire.", en: "What a pity, I can't come." },
            { it: "Per fortuna è andato tutto bene.", en: "Luckily everything went well." },
            { it: "Non importa, sarà per la prossima volta.", en: "It doesn't matter, maybe next time." },
          ],
        },
      ],
    },
  ]);

  add("b2", [
    {
      id: "b2u7", title: "Media & communication", icon: "📡",
      lessons: [
        {
          id: "b2u7l1", title: "Media & the internet",
          items: [
            { it: "i social", en: "social media", pos: "noun m pl" },
            { it: "la notizia falsa", en: "fake news", pos: "noun f" },
            { it: "la pubblicità", en: "advertising", pos: "noun f" },
            { it: "l'utente", en: "the user", pos: "noun" },
            { it: "condividere", en: "to share", pos: "verb" },
            { it: "l'influenza", en: "the influence", pos: "noun f" },
            { it: "affidabile", en: "reliable" },
          ],
          sentences: [
            { it: "Bisogna verificare se una notizia è affidabile.", en: "One must check whether a piece of news is reliable." },
            { it: "I social hanno una grande influenza sui giovani.", en: "Social media have a big influence on young people." },
            { it: "Ha condiviso l'articolo con tutti.", en: "He shared the article with everyone." },
          ],
        },
        {
          id: "b2u7l2", title: "Abstract nouns & nominalisation",
          tip: "Italian often turns verbs into abstract nouns: <b>sviluppare→lo sviluppo</b>, <b>crescere→la crescita</b>, <b>cambiare→il cambiamento</b>.",
          items: [
            { it: "la crescita", en: "the growth", pos: "noun f" },
            { it: "il cambiamento", en: "the change", pos: "noun m" },
            { it: "la mancanza", en: "the lack", pos: "noun f" },
            { it: "l'aumento", en: "the increase", pos: "noun m" },
            { it: "la diminuzione", en: "the decrease", pos: "noun f" },
            { it: "il miglioramento", en: "the improvement", pos: "noun m" },
            { it: "la disponibilità", en: "the availability", pos: "noun f" },
          ],
          sentences: [
            { it: "Si prevede una crescita dell'economia.", en: "Growth of the economy is forecast." },
            { it: "La mancanza di tempo è un problema.", en: "The lack of time is a problem." },
            { it: "C'è stato un netto miglioramento.", en: "There has been a clear improvement." },
          ],
        },
      ],
    },
  ]);

})();
