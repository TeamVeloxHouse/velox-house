/* ============================================================================
   COURSE EXTRA 2 — further depth for the guided path.
   Merges still more units into COURSE (after course.js + course-extra.js).
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
      id: "a1u7", title: "Body & feelings", icon: "🧍",
      lessons: [
        {
          id: "a1u7l1", title: "Parts of the body",
          items: [
            { it: "il braccio", en: "the arm", pos: "noun m" },
            { it: "la gamba", en: "the leg", pos: "noun f" },
            { it: "il naso", en: "the nose", pos: "noun m" },
            { it: "la bocca", en: "the mouth", pos: "noun f" },
            { it: "l'orecchio", en: "the ear", pos: "noun m" },
            { it: "il dito", en: "the finger", pos: "noun m" },
            { it: "il cuore", en: "the heart", pos: "noun m" },
            { it: "la faccia", en: "the face", pos: "noun f" },
          ],
          sentences: [
            { it: "Ho due braccia e due gambe.", en: "I have two arms and two legs." },
            { it: "Mi lavo la faccia.", en: "I wash my face." },
            { it: "Il cuore batte forte.", en: "The heart beats fast." },
          ],
        },
        {
          id: "a1u7l2", title: "How are you feeling?",
          tip: "Use <b>avere</b> with many states: <b>ho fame</b> (I'm hungry), <b>ho sete</b> (I'm thirsty), <b>ho sonno</b> (I'm sleepy), <b>ho caldo</b> (I'm hot).",
          items: [
            { it: "ho fame", en: "I'm hungry" },
            { it: "ho sete", en: "I'm thirsty" },
            { it: "ho sonno", en: "I'm sleepy" },
            { it: "ho freddo", en: "I'm cold" },
            { it: "ho caldo", en: "I'm hot" },
            { it: "ho fretta", en: "I'm in a hurry" },
            { it: "sto bene", en: "I'm well" },
            { it: "sto male", en: "I'm unwell" },
          ],
          sentences: [
            { it: "Ho fame, mangiamo qualcosa.", en: "I'm hungry, let's eat something." },
            { it: "Hai sete? C'è dell'acqua.", en: "Are you thirsty? There's some water." },
            { it: "Ho fretta, devo andare.", en: "I'm in a hurry, I have to go." },
          ],
        },
        {
          id: "a1u7l3", title: "Days, months & dates",
          items: [
            { it: "martedì", en: "Tuesday" }, { it: "mercoledì", en: "Wednesday" },
            { it: "giovedì", en: "Thursday" }, { it: "sabato", en: "Saturday" },
            { it: "domenica", en: "Sunday" }, { it: "gennaio", en: "January" },
            { it: "agosto", en: "August" }, { it: "l'anno", en: "the year", pos: "noun m" },
          ],
          sentences: [
            { it: "Il mio compleanno è in agosto.", en: "My birthday is in August." },
            { it: "Ci vediamo sabato.", en: "See you on Saturday." },
            { it: "La domenica non lavoro.", en: "On Sundays I don't work." },
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
      id: "a2u7", title: "Shopping & services", icon: "🛍️",
      lessons: [
        {
          id: "a2u7l1", title: "At the shops",
          items: [
            { it: "il supermercato", en: "the supermarket", pos: "noun m" },
            { it: "il mercato", en: "the market", pos: "noun m" },
            { it: "la panetteria", en: "the bakery", pos: "noun f" },
            { it: "la taglia", en: "the size (clothing)", pos: "noun f" },
            { it: "lo sconto", en: "the discount", pos: "noun m" },
            { it: "i saldi", en: "the sales", pos: "noun m pl" },
            { it: "la cassa", en: "the till/checkout", pos: "noun f" },
            { it: "provare", en: "to try (on)", pos: "verb" },
          ],
          sentences: [
            { it: "Posso provare questa camicia?", en: "Can I try on this shirt?" },
            { it: "C'è uno sconto del venti per cento.", en: "There's a twenty per cent discount." },
            { it: "Pago alla cassa.", en: "I pay at the till." },
          ],
        },
        {
          id: "a2u7l2", title: "The 'ci' and 'ne' particles",
          tip: "<b>ci</b> often replaces a place (<i>Ci vado</i> = I go there). <b>ne</b> replaces 'of it/them' (<i>Ne voglio due</i> = I want two of them).",
          items: [
            { it: "ci vado", en: "I go there" },
            { it: "ci sono", en: "there are" },
            { it: "c'è", en: "there is" },
            { it: "ne ho due", en: "I have two of them" },
            { it: "ne parlo", en: "I talk about it" },
            { it: "non ne ho", en: "I don't have any" },
          ],
          sentences: [
            { it: "Vai al mare? Sì, ci vado domani.", en: "Are you going to the sea? Yes, I'm going there tomorrow." },
            { it: "Quante mele vuoi? Ne voglio tre.", en: "How many apples do you want? I want three (of them)." },
            { it: "C'è un problema.", en: "There is a problem." },
          ],
        },
        {
          id: "a2u7l3", title: "Appointments & services",
          items: [
            { it: "l'appuntamento", en: "the appointment", pos: "noun m" },
            { it: "la posta", en: "the post office", pos: "noun f" },
            { it: "il parrucchiere", en: "the hairdresser", pos: "noun m" },
            { it: "aperto", en: "open" }, { it: "chiuso", en: "closed" },
            { it: "l'orario", en: "the opening hours", pos: "noun m" },
            { it: "spedire", en: "to send/ship", pos: "verb" },
          ],
          sentences: [
            { it: "Ho un appuntamento alle tre.", en: "I have an appointment at three." },
            { it: "Il negozio è chiuso la domenica.", en: "The shop is closed on Sundays." },
            { it: "Devo spedire un pacco.", en: "I need to send a parcel." },
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
      id: "b1u6", title: "Culture & society", icon: "🎭",
      lessons: [
        {
          id: "b1u6l1", title: "Arts & entertainment",
          items: [
            { it: "il film", en: "the film", pos: "noun m" },
            { it: "la mostra", en: "the exhibition", pos: "noun f" },
            { it: "il quadro", en: "the painting", pos: "noun m" },
            { it: "lo spettacolo", en: "the show", pos: "noun m" },
            { it: "il regista", en: "the director", pos: "noun m" },
            { it: "la trama", en: "the plot", pos: "noun f" },
            { it: "recitare", en: "to act", pos: "verb" },
            { it: "emozionante", en: "exciting/moving" },
          ],
          sentences: [
            { it: "Il film aveva una trama avvincente.", en: "The film had a gripping plot." },
            { it: "Andiamo a vedere una mostra d'arte.", en: "Let's go see an art exhibition." },
            { it: "Lo spettacolo è stato emozionante.", en: "The show was moving." },
          ],
        },
        {
          id: "b1u6l2", title: "Verbs followed by prepositions",
          tip: "Many verbs need a fixed preposition: <b>cominciare a</b> (begin to), <b>finire di</b> (finish), <b>riuscire a</b> (manage to), <b>pensare a</b> (think about).",
          items: [
            { it: "cominciare a", en: "to begin to" },
            { it: "finire di", en: "to finish (doing)" },
            { it: "riuscire a", en: "to manage to" },
            { it: "cercare di", en: "to try to" },
            { it: "decidere di", en: "to decide to" },
            { it: "continuare a", en: "to continue to" },
          ],
          sentences: [
            { it: "Ho cominciato a studiare l'italiano.", en: "I began to study Italian." },
            { it: "Cerco di parlare ogni giorno.", en: "I try to speak every day." },
            { it: "Sono riuscito a finire il lavoro.", en: "I managed to finish the work." },
          ],
        },
        {
          id: "b1u6l3", title: "The gerund & progressive",
          tip: "<b>stare + gerundio</b> = ongoing action now: <b>sto mangiando</b> (I am eating), <b>stai parlando</b> (you are speaking).",
          items: [
            { it: "sto facendo", en: "I am doing" },
            { it: "sto leggendo", en: "I am reading" },
            { it: "stai dormendo", en: "you are sleeping" },
            { it: "stiamo lavorando", en: "we are working" },
            { it: "pur essendo", en: "despite being" },
            { it: "camminando", en: "walking / by walking" },
          ],
          sentences: [
            { it: "Sto leggendo un libro interessante.", en: "I am reading an interesting book." },
            { it: "Che cosa stai facendo?", en: "What are you doing?" },
            { it: "Stiamo preparando la cena.", en: "We are preparing dinner." },
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
      id: "b2u5", title: "Emotions & nuance", icon: "🎚️",
      lessons: [
        {
          id: "b2u5l1", title: "Subtle feelings",
          items: [
            { it: "commosso", en: "moved/touched" },
            { it: "deluso", en: "disappointed" },
            { it: "soddisfatto", en: "satisfied" },
            { it: "a disagio", en: "uncomfortable/ill at ease" },
            { it: "sollevato", en: "relieved" },
            { it: "entusiasta", en: "enthusiastic" },
            { it: "infastidito", en: "annoyed" },
          ],
          sentences: [
            { it: "Sono rimasto deluso dal risultato.", en: "I was disappointed by the result." },
            { it: "Mi sento sollevato che sia finita.", en: "I feel relieved that it's over." },
            { it: "Era commossa fino alle lacrime.", en: "She was moved to tears." },
          ],
        },
        {
          id: "b2u5l2", title: "The passive & 'si' impersonal",
          tip: "Passive: <b>essere + participle</b> (<i>La casa è stata venduta</i>). Impersonal <b>si</b>: <i>In Italia si mangia bene</i> (In Italy one eats well).",
          items: [
            { it: "è stato fatto", en: "it was done" },
            { it: "viene usato", en: "it is used" },
            { it: "si dice che", en: "it is said that" },
            { it: "si può", en: "one can / it's possible" },
            { it: "si deve", en: "one must" },
            { it: "si vede", en: "one can see / it shows" },
          ],
          sentences: [
            { it: "In Italia si mangia molto bene.", en: "In Italy one eats very well." },
            { it: "Il ponte è stato costruito nel 1900.", en: "The bridge was built in 1900." },
            { it: "Qui non si può fumare.", en: "You can't smoke here." },
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
      id: "c1u4", title: "Idiom & register", icon: "💬",
      lessons: [
        {
          id: "c1u4l1", title: "Advanced idioms",
          items: [
            { it: "avere la testa fra le nuvole", en: "to have one's head in the clouds" },
            { it: "tagliare la corda", en: "to sneak off / slip away" },
            { it: "essere al verde", en: "to be broke" },
            { it: "prendere due piccioni con una fava", en: "to kill two birds with one stone" },
            { it: "non avere peli sulla lingua", en: "to be blunt/outspoken" },
            { it: "alzare il gomito", en: "to drink too much" },
          ],
          sentences: [
            { it: "Oggi ho la testa fra le nuvole.", en: "Today my head is in the clouds." },
            { it: "Questo mese sono al verde.", en: "This month I'm broke." },
            { it: "Non ha peli sulla lingua.", en: "He doesn't mince his words." },
          ],
        },
        {
          id: "c1u4l2", title: "Shades of meaning",
          items: [
            { it: "piuttosto", en: "rather / quite" },
            { it: "addirittura", en: "even / actually" },
            { it: "semmai", en: "if anything" },
            { it: "anzi", en: "on the contrary / rather" },
            { it: "perlopiù", en: "mostly" },
            { it: "tutto sommato", en: "all in all" },
            { it: "a quanto pare", en: "apparently" },
          ],
          sentences: [
            { it: "Non mi dispiace, anzi mi piace molto.", en: "I don't mind it — on the contrary, I like it a lot." },
            { it: "A quanto pare, ha ragione lui.", en: "Apparently, he is right." },
            { it: "Tutto sommato, è andata bene.", en: "All in all, it went well." },
          ],
        },
      ],
    },
  ]);

})();
