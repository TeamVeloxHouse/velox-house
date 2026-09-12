/* ============================================================================
   COURSE EXTRA — deeper guided path.
   Merges additional units/lessons into the existing COURSE (from course.js).
   Same data shape; exercises are generated automatically by the engine.
   ========================================================================== */
(function () {
  const C = window.COURSE;
  const sec = id => C.find(s => s.id === id);
  const add = (sectionId, units) => sec(sectionId).units.push(...units);

  /* ======================================================================== */
  /*  A1 — more beginner units                                                */
  /* ======================================================================== */
  add("a1", [
    {
      id: "a1u4", title: "Basics 3", icon: "🔤",
      lessons: [
        {
          id: "a1u4l1", title: "This & that, here & there",
          tip: "<b>questo/questa</b> = this, <b>quello/quella</b> = that. They agree in gender and number.",
          items: [
            { it: "questo", en: "this (m)" }, { it: "questa", en: "this (f)" },
            { it: "quello", en: "that (m)" }, { it: "quella", en: "that (f)" },
            { it: "questi", en: "these (m)" }, { it: "queste", en: "these (f)" },
            { it: "cosa", en: "thing / what" }, { it: "ecco", en: "here is / there is" },
          ],
          sentences: [
            { it: "Questo è il mio libro.", en: "This is my book." },
            { it: "Quella donna è mia madre.", en: "That woman is my mother." },
            { it: "Ecco il tuo caffè.", en: "Here is your coffee." },
          ],
        },
        {
          id: "a1u4l2", title: "Question words",
          tip: "<b>chi</b> who · <b>che / cosa</b> what · <b>dove</b> where · <b>quando</b> when · <b>perché</b> why · <b>come</b> how · <b>quanto</b> how much.",
          items: [
            { it: "chi", en: "who" }, { it: "dove", en: "where" },
            { it: "quando", en: "when" }, { it: "come", en: "how" },
            { it: "quanto", en: "how much" }, { it: "quale", en: "which" },
            { it: "perché", en: "why / because" },
          ],
          sentences: [
            { it: "Dove abiti?", en: "Where do you live?" },
            { it: "Come ti chiami?", en: "What is your name?" },
            { it: "Quando arriva il treno?", en: "When does the train arrive?" },
            { it: "Chi è quella persona?", en: "Who is that person?" },
          ],
        },
        {
          id: "a1u4l3", title: "Plurals",
          tip: "Masculine <b>-o → -i</b> (libro→libri), feminine <b>-a → -e</b> (casa→case), and <b>-e → -i</b> for both (cane→cani).",
          items: [
            { it: "i libri", en: "the books" }, { it: "le case", en: "the houses" },
            { it: "i cani", en: "the dogs" }, { it: "le macchine", en: "the cars" },
            { it: "gli amici", en: "the friends (m)" }, { it: "le amiche", en: "the friends (f)" },
            { it: "molti", en: "many (m)" }, { it: "alcune", en: "some (f)" },
          ],
          sentences: [
            { it: "Ho molti libri italiani.", en: "I have many Italian books." },
            { it: "Le case sono grandi.", en: "The houses are big." },
            { it: "I miei amici sono simpatici.", en: "My friends are nice." },
          ],
        },
      ],
    },
    {
      id: "a1u5", title: "Animals & nature", icon: "🐾",
      lessons: [
        {
          id: "a1u5l1", title: "Animals",
          items: [
            { it: "il cane", en: "the dog", pos: "noun m" },
            { it: "il gatto", en: "the cat", pos: "noun m" },
            { it: "il cavallo", en: "the horse", pos: "noun m" },
            { it: "l'uccello", en: "the bird", pos: "noun m" },
            { it: "il pesce", en: "the fish", pos: "noun m" },
            { it: "la mucca", en: "the cow", pos: "noun f" },
            { it: "il topo", en: "the mouse", pos: "noun m" },
            { it: "l'animale", en: "the animal", pos: "noun m" },
          ],
          sentences: [
            { it: "Il cane mangia.", en: "The dog is eating." },
            { it: "Ho un gatto nero.", en: "I have a black cat." },
            { it: "Gli uccelli cantano.", en: "The birds are singing." },
          ],
        },
        {
          id: "a1u5l2", title: "Nature",
          items: [
            { it: "l'albero", en: "the tree", pos: "noun m" },
            { it: "il fiore", en: "the flower", pos: "noun m" },
            { it: "il mare", en: "the sea", pos: "noun m" },
            { it: "la montagna", en: "the mountain", pos: "noun f" },
            { it: "il cielo", en: "the sky", pos: "noun m" },
            { it: "il fiume", en: "the river", pos: "noun m" },
            { it: "il bosco", en: "the wood/forest", pos: "noun m" },
            { it: "la spiaggia", en: "the beach", pos: "noun f" },
          ],
          sentences: [
            { it: "Il mare è blu.", en: "The sea is blue." },
            { it: "Andiamo in montagna.", en: "We're going to the mountains." },
            { it: "Ci sono molti alberi nel bosco.", en: "There are many trees in the forest." },
          ],
        },
        {
          id: "a1u5l3", title: "Possessives",
          tip: "Possessives take the article: <b>il mio</b> (my), <b>il tuo</b> (your), <b>il suo</b> (his/her). Family members in singular drop it: <b>mia madre</b>.",
          items: [
            { it: "il mio", en: "my (m)" }, { it: "la mia", en: "my (f)" },
            { it: "il tuo", en: "your (m)" }, { it: "la tua", en: "your (f)" },
            { it: "il suo", en: "his / her (m)" }, { it: "la sua", en: "his / her (f)" },
            { it: "il nostro", en: "our (m)" }, { it: "i miei", en: "my (m pl)" },
          ],
          sentences: [
            { it: "La mia casa è piccola.", en: "My house is small." },
            { it: "Il tuo cane è grande.", en: "Your dog is big." },
            { it: "I miei genitori abitano a Roma.", en: "My parents live in Rome." },
          ],
        },
      ],
    },
    {
      id: "a1u6", title: "Clothes & numbers", icon: "👕",
      lessons: [
        {
          id: "a1u6l1", title: "Clothes",
          items: [
            { it: "la camicia", en: "the shirt", pos: "noun f" },
            { it: "i pantaloni", en: "the trousers", pos: "noun m pl" },
            { it: "la gonna", en: "the skirt", pos: "noun f" },
            { it: "le scarpe", en: "the shoes", pos: "noun f pl" },
            { it: "il cappotto", en: "the coat", pos: "noun m" },
            { it: "il vestito", en: "the dress/suit", pos: "noun m" },
            { it: "il cappello", en: "the hat", pos: "noun m" },
            { it: "indossare", en: "to wear", pos: "verb" },
          ],
          sentences: [
            { it: "Indosso una camicia bianca.", en: "I'm wearing a white shirt." },
            { it: "Le scarpe sono nuove.", en: "The shoes are new." },
            { it: "Fa freddo, prendi il cappotto.", en: "It's cold, take the coat." },
          ],
        },
        {
          id: "a1u6l2", title: "Numbers 20–100",
          items: [
            { it: "trenta", en: "thirty" }, { it: "quaranta", en: "forty" },
            { it: "cinquanta", en: "fifty" }, { it: "sessanta", en: "sixty" },
            { it: "settanta", en: "seventy" }, { it: "ottanta", en: "eighty" },
            { it: "novanta", en: "ninety" }, { it: "cento", en: "one hundred" },
            { it: "mille", en: "one thousand" },
          ],
          sentences: [
            { it: "Ho trenta anni.", en: "I am thirty years old." },
            { it: "Costa cinquanta euro.", en: "It costs fifty euros." },
            { it: "Ci sono cento persone.", en: "There are a hundred people." },
          ],
        },
        {
          id: "a1u6l3", title: "Asking for things",
          tip: "Polite requests: <b>Vorrei…</b> (I'd like), <b>Mi può dare…?</b> (Can you give me…?), <b>Quant'è?</b> (How much is it?).",
          items: [
            { it: "vorrei", en: "I would like" },
            { it: "mi può dare", en: "can you give me" },
            { it: "quant'è", en: "how much is it" },
            { it: "un po' di", en: "a bit of" },
            { it: "ancora", en: "more / still / again" },
            { it: "basta", en: "that's enough" },
            { it: "subito", en: "right away" },
          ],
          sentences: [
            { it: "Vorrei un po' di pane.", en: "I'd like a bit of bread." },
            { it: "Mi può dare il conto?", en: "Can you give me the bill?" },
            { it: "Quant'è in tutto?", en: "How much is it altogether?" },
          ],
        },
      ],
    },
  ]);

  /* ======================================================================== */
  /*  A2 — more elementary units                                              */
  /* ======================================================================== */
  add("a2", [
    {
      id: "a2u4", title: "At the restaurant", icon: "🍝",
      lessons: [
        {
          id: "a2u4l1", title: "Ordering food",
          items: [
            { it: "il menù", en: "the menu", pos: "noun m" },
            { it: "il cameriere", en: "the waiter", pos: "noun m" },
            { it: "l'antipasto", en: "the starter", pos: "noun m" },
            { it: "il primo", en: "the first course", pos: "noun m" },
            { it: "il secondo", en: "the main course", pos: "noun m" },
            { it: "il dolce", en: "the dessert", pos: "noun m" },
            { it: "ordinare", en: "to order", pos: "verb" },
            { it: "la mancia", en: "the tip", pos: "noun f" },
          ],
          sentences: [
            { it: "Vorrei ordinare, per favore.", en: "I'd like to order, please." },
            { it: "Come antipasto prendo la bruschetta.", en: "As a starter I'll have the bruschetta." },
            { it: "Il cameriere porta il menù.", en: "The waiter brings the menu." },
          ],
        },
        {
          id: "a2u4l2", title: "More food & flavours",
          items: [
            { it: "il pesce", en: "the fish", pos: "noun m" },
            { it: "la carne", en: "the meat", pos: "noun f" },
            { it: "le verdure", en: "the vegetables", pos: "noun f pl" },
            { it: "la frutta", en: "the fruit", pos: "noun f" },
            { it: "il sale", en: "the salt", pos: "noun m" },
            { it: "lo zucchero", en: "the sugar", pos: "noun m" },
            { it: "dolce", en: "sweet" }, { it: "salato", en: "salty" },
            { it: "piccante", en: "spicy" },
          ],
          sentences: [
            { it: "Preferisco il pesce alla carne.", en: "I prefer fish to meat." },
            { it: "Questa pasta è troppo salata.", en: "This pasta is too salty." },
            { it: "Mangio molta frutta e verdura.", en: "I eat a lot of fruit and vegetables." },
          ],
        },
        {
          id: "a2u4l3", title: "Quantities",
          tip: "Partitive 'some' uses <b>di + article</b>: <b>del pane</b> (some bread), <b>della frutta</b> (some fruit), <b>dei libri</b> (some books).",
          items: [
            { it: "un chilo di", en: "a kilo of" },
            { it: "un litro di", en: "a litre of" },
            { it: "una bottiglia di", en: "a bottle of" },
            { it: "un bicchiere di", en: "a glass of" },
            { it: "del pane", en: "some bread" },
            { it: "della frutta", en: "some fruit" },
            { it: "troppo", en: "too much" }, { it: "abbastanza", en: "enough" },
          ],
          sentences: [
            { it: "Vorrei un chilo di mele.", en: "I'd like a kilo of apples." },
            { it: "Compro una bottiglia di vino.", en: "I'm buying a bottle of wine." },
            { it: "C'è abbastanza pane?", en: "Is there enough bread?" },
          ],
        },
      ],
    },
    {
      id: "a2u5", title: "Travel & hotel", icon: "🧳",
      lessons: [
        {
          id: "a2u5l1", title: "At the hotel",
          items: [
            { it: "l'albergo", en: "the hotel", pos: "noun m" },
            { it: "la camera doppia", en: "the double room", pos: "noun f" },
            { it: "la chiave", en: "the key", pos: "noun f" },
            { it: "la prenotazione", en: "the reservation", pos: "noun f" },
            { it: "la colazione", en: "the breakfast", pos: "noun f" },
            { it: "prenotare", en: "to book", pos: "verb" },
            { it: "la valigia", en: "the suitcase", pos: "noun f" },
            { it: "il passaporto", en: "the passport", pos: "noun m" },
          ],
          sentences: [
            { it: "Ho una prenotazione a nome Rossi.", en: "I have a reservation under the name Rossi." },
            { it: "La colazione è inclusa?", en: "Is breakfast included?" },
            { it: "Vorrei prenotare una camera doppia.", en: "I'd like to book a double room." },
          ],
        },
        {
          id: "a2u5l2", title: "Getting around",
          items: [
            { it: "la fermata", en: "the stop", pos: "noun f" },
            { it: "il binario", en: "the platform", pos: "noun m" },
            { it: "la metro", en: "the metro", pos: "noun f" },
            { it: "il taxi", en: "the taxi", pos: "noun m" },
            { it: "a piedi", en: "on foot" },
            { it: "in ritardo", en: "late" },
            { it: "in orario", en: "on time" },
            { it: "salire", en: "to get on", pos: "verb" },
            { it: "scendere", en: "to get off", pos: "verb" },
          ],
          sentences: [
            { it: "Il treno parte dal binario tre.", en: "The train leaves from platform three." },
            { it: "Vado al lavoro a piedi.", en: "I go to work on foot." },
            { it: "L'autobus è in ritardo.", en: "The bus is late." },
          ],
        },
        {
          id: "a2u5l3", title: "Making plans",
          tip: "Near future with <b>andare a + infinitive</b> is less common; Italians often use the present: <b>Domani vado al mare</b> (Tomorrow I'm going to the sea).",
          items: [
            { it: "stasera", en: "tonight" },
            { it: "il fine settimana", en: "the weekend" },
            { it: "insieme", en: "together" },
            { it: "libero", en: "free (available)" },
            { it: "occupato", en: "busy" },
            { it: "incontrare", en: "to meet", pos: "verb" },
            { it: "avere in programma", en: "to have planned" },
          ],
          sentences: [
            { it: "Stasera sei libero?", en: "Are you free tonight?" },
            { it: "Andiamo al cinema insieme?", en: "Shall we go to the cinema together?" },
            { it: "Nel fine settimana vado in campagna.", en: "At the weekend I'm going to the countryside." },
          ],
        },
      ],
    },
    {
      id: "a2u6", title: "Hobbies & describing", icon: "🎨",
      lessons: [
        {
          id: "a2u6l1", title: "Free time & hobbies",
          items: [
            { it: "il tempo libero", en: "free time", pos: "noun m" },
            { it: "lo sport", en: "sport", pos: "noun m" },
            { it: "la musica", en: "music", pos: "noun f" },
            { it: "leggere", en: "to read", pos: "verb" },
            { it: "ballare", en: "to dance", pos: "verb" },
            { it: "nuotare", en: "to swim", pos: "verb" },
            { it: "suonare", en: "to play (an instrument)", pos: "verb" },
            { it: "giocare", en: "to play (a game)", pos: "verb" },
          ],
          sentences: [
            { it: "Nel tempo libero leggo e nuoto.", en: "In my free time I read and swim." },
            { it: "Suono la chitarra.", en: "I play the guitar." },
            { it: "Mi piace giocare a calcio.", en: "I like playing football." },
          ],
        },
        {
          id: "a2u6l2", title: "Describing people",
          items: [
            { it: "alto", en: "tall" }, { it: "basso", en: "short" },
            { it: "giovane", en: "young" }, { it: "vecchio", en: "old" },
            { it: "magro", en: "thin" }, { it: "simpatico", en: "likeable/nice" },
            { it: "gentile", en: "kind" }, { it: "i capelli", en: "the hair", pos: "noun m pl" },
            { it: "gli occhi", en: "the eyes", pos: "noun m pl" },
          ],
          sentences: [
            { it: "Mio fratello è alto e magro.", en: "My brother is tall and thin." },
            { it: "Ha i capelli neri e gli occhi verdi.", en: "He has black hair and green eyes." },
            { it: "È una persona molto gentile.", en: "She is a very kind person." },
          ],
        },
        {
          id: "a2u6l3", title: "Frequency & adverbs",
          tip: "Common adverbs of frequency: <b>sempre</b> always, <b>di solito</b> usually, <b>spesso</b> often, <b>a volte</b> sometimes, <b>mai</b> never (with <b>non</b>).",
          items: [
            { it: "sempre", en: "always" }, { it: "di solito", en: "usually" },
            { it: "spesso", en: "often" }, { it: "a volte", en: "sometimes" },
            { it: "raramente", en: "rarely" }, { it: "non... mai", en: "never" },
            { it: "ogni giorno", en: "every day" },
          ],
          sentences: [
            { it: "Di solito mi alzo presto.", en: "I usually get up early." },
            { it: "Non bevo mai il caffè la sera.", en: "I never drink coffee in the evening." },
            { it: "A volte andiamo al ristorante.", en: "Sometimes we go to the restaurant." },
          ],
        },
      ],
    },
  ]);

  /* ======================================================================== */
  /*  B1 — more intermediate units                                            */
  /* ======================================================================== */
  add("b1", [
    {
      id: "b1u3", title: "Technology & daily life", icon: "📱",
      lessons: [
        {
          id: "b1u3l1", title: "Technology",
          items: [
            { it: "il computer", en: "the computer", pos: "noun m" },
            { it: "il telefono", en: "the phone", pos: "noun m" },
            { it: "lo schermo", en: "the screen", pos: "noun m" },
            { it: "la password", en: "the password", pos: "noun f" },
            { it: "il messaggio", en: "the message", pos: "noun m" },
            { it: "scaricare", en: "to download", pos: "verb" },
            { it: "navigare", en: "to browse", pos: "verb" },
            { it: "la rete", en: "the network/web", pos: "noun f" },
          ],
          sentences: [
            { it: "Ho dimenticato la password.", en: "I forgot the password." },
            { it: "Ti mando un messaggio più tardi.", en: "I'll send you a message later." },
            { it: "Devo scaricare questo documento.", en: "I have to download this document." },
          ],
        },
        {
          id: "b1u3l2", title: "Pronouns (direct & indirect)",
          tip: "Direct object: <b>lo, la, li, le</b> (it/them). Indirect: <b>gli</b> (to him), <b>le</b> (to her). <b>Lo vedo</b> = I see it/him; <b>Le parlo</b> = I speak to her.",
          items: [
            { it: "lo vedo", en: "I see it/him" },
            { it: "la conosco", en: "I know her/it" },
            { it: "li compro", en: "I buy them (m)" },
            { it: "gli parlo", en: "I speak to him" },
            { it: "le scrivo", en: "I write to her" },
            { it: "mi aiuti", en: "you help me" },
            { it: "ti chiamo", en: "I call you" },
          ],
          sentences: [
            { it: "Conosci Maria? Sì, la conosco bene.", en: "Do you know Maria? Yes, I know her well." },
            { it: "Ti chiamo domani mattina.", en: "I'll call you tomorrow morning." },
            { it: "Questi libri? Li ho già letti.", en: "These books? I've already read them." },
          ],
        },
        {
          id: "b1u3l3", title: "Comparatives",
          tip: "<b>più… di</b> (more than), <b>meno… di</b> (less than), <b>così… come</b> (as… as). Irregular: <b>migliore</b> (better), <b>peggiore</b> (worse).",
          items: [
            { it: "più di", en: "more than" }, { it: "meno di", en: "less than" },
            { it: "come", en: "as / like" }, { it: "migliore", en: "better" },
            { it: "peggiore", en: "worse" }, { it: "il migliore", en: "the best" },
            { it: "tanto quanto", en: "as much as" },
          ],
          sentences: [
            { it: "Roma è più grande di Firenze.", en: "Rome is bigger than Florence." },
            { it: "Questo vino è migliore dell'altro.", en: "This wine is better than the other." },
            { it: "Lui lavora meno di me.", en: "He works less than me." },
          ],
        },
      ],
    },
    {
      id: "b1u4", title: "Past tenses in depth", icon: "⏳",
      lessons: [
        {
          id: "b1u4l1", title: "Passato prossimo vs imperfetto",
          tip: "Use <b>passato prossimo</b> for completed actions, <b>imperfetto</b> for background/description. <i>Mentre leggevo (imp), è suonato (pp) il telefono.</i>",
          items: [
            { it: "mentre", en: "while" },
            { it: "improvvisamente", en: "suddenly" },
            { it: "di colpo", en: "all at once" },
            { it: "è successo", en: "it happened" },
            { it: "stavo per", en: "I was about to" },
            { it: "appena", en: "just / as soon as" },
          ],
          sentences: [
            { it: "Mentre dormivo, è arrivato un messaggio.", en: "While I was sleeping, a message arrived." },
            { it: "Faceva freddo quando sono uscito.", en: "It was cold when I went out." },
            { it: "Stavo per chiamarti.", en: "I was about to call you." },
          ],
        },
        {
          id: "b1u4l2", title: "Irregular participles",
          tip: "Many common verbs have irregular past participles: <b>preso</b> (taken), <b>scritto</b> (written), <b>letto</b> (read), <b>aperto</b> (opened), <b>chiuso</b> (closed).",
          items: [
            { it: "ho preso", en: "I took" }, { it: "ho scritto", en: "I wrote" },
            { it: "ho letto", en: "I read (past)" }, { it: "ho aperto", en: "I opened" },
            { it: "ho chiuso", en: "I closed" }, { it: "ho messo", en: "I put" },
            { it: "ho perso", en: "I lost" }, { it: "ho chiesto", en: "I asked" },
          ],
          sentences: [
            { it: "Ho perso le chiavi.", en: "I lost the keys." },
            { it: "Hai letto quel libro?", en: "Did you read that book?" },
            { it: "Ho chiesto il conto.", en: "I asked for the bill." },
          ],
        },
        {
          id: "b1u4l3", title: "Storytelling connectors",
          items: [
            { it: "prima", en: "first / before" },
            { it: "poi", en: "then" }, { it: "dopo", en: "after(wards)" },
            { it: "infine", en: "finally" }, { it: "allora", en: "so / then" },
            { it: "all'improvviso", en: "suddenly" },
            { it: "alla fine", en: "in the end" },
          ],
          sentences: [
            { it: "Prima ho mangiato, poi sono uscito.", en: "First I ate, then I went out." },
            { it: "Alla fine siamo tornati a casa.", en: "In the end we went back home." },
            { it: "All'improvviso ha iniziato a piovere.", en: "Suddenly it started to rain." },
          ],
        },
      ],
    },
    {
      id: "b1u5", title: "Advice & the imperative", icon: "🗣️",
      lessons: [
        {
          id: "b1u5l1", title: "Giving advice & the imperative",
          tip: "Informal imperative (tu): <b>-are</b>→parla!, <b>-ere</b>→prendi!, <b>-ire</b>→dormi!. Negative tu = <b>non</b> + infinitive: <b>Non parlare!</b>",
          items: [
            { it: "ascolta", en: "listen! (tu)" }, { it: "guarda", en: "look! (tu)" },
            { it: "aspetta", en: "wait! (tu)" }, { it: "vai", en: "go! (tu)" },
            { it: "dovresti", en: "you should" },
            { it: "ti consiglio di", en: "I advise you to" },
            { it: "non preoccuparti", en: "don't worry" },
          ],
          sentences: [
            { it: "Ascolta, ho un'idea.", en: "Listen, I have an idea." },
            { it: "Dovresti riposarti di più.", en: "You should rest more." },
            { it: "Non preoccuparti, va tutto bene.", en: "Don't worry, everything is fine." },
          ],
        },
        {
          id: "b1u5l2", title: "At the doctor / problems",
          items: [
            { it: "il raffreddore", en: "the cold (illness)", pos: "noun m" },
            { it: "la febbre", en: "the fever", pos: "noun f" },
            { it: "la ricetta", en: "the prescription", pos: "noun f" },
            { it: "la farmacia", en: "the pharmacy", pos: "noun f" },
            { it: "fare male", en: "to hurt" },
            { it: "guarire", en: "to recover/heal", pos: "verb" },
            { it: "riposare", en: "to rest", pos: "verb" },
          ],
          sentences: [
            { it: "Ho la febbre e mal di gola.", en: "I have a fever and a sore throat." },
            { it: "Mi fa male la schiena.", en: "My back hurts." },
            { it: "Prendi questa medicina e riposa.", en: "Take this medicine and rest." },
          ],
        },
      ],
    },
  ]);

  /* ======================================================================== */
  /*  B2 — more upper-intermediate units                                      */
  /* ======================================================================== */
  add("b2", [
    {
      id: "b2u3", title: "Hypotheticals & relatives", icon: "🔗",
      lessons: [
        {
          id: "b2u3l1", title: "If-clauses (il periodo ipotetico)",
          tip: "Real: <b>Se studio, imparo</b>. Possible: <b>Se studiassi, imparerei</b> (subjunctive + conditional). Impossible (past): <b>Se avessi studiato, avrei imparato</b>.",
          items: [
            { it: "se", en: "if" },
            { it: "se potessi", en: "if I could" },
            { it: "se fossi", en: "if I were" },
            { it: "se avessi", en: "if I had" },
            { it: "altrimenti", en: "otherwise" },
            { it: "a meno che", en: "unless" },
          ],
          sentences: [
            { it: "Se potessi, viaggerei di più.", en: "If I could, I would travel more." },
            { it: "Se fossi ricco, comprerei una casa al mare.", en: "If I were rich, I'd buy a house by the sea." },
            { it: "Sbrigati, altrimenti perdiamo il treno.", en: "Hurry up, otherwise we'll miss the train." },
          ],
        },
        {
          id: "b2u3l2", title: "Relative pronouns",
          tip: "<b>che</b> = who/which/that (subject & object). <b>cui</b> = whom/which after a preposition: <b>la città in cui vivo</b> (the city in which I live).",
          items: [
            { it: "che", en: "who / which / that" },
            { it: "cui", en: "whom / which (after prep.)" },
            { it: "il quale", en: "which / who (formal)" },
            { it: "chi", en: "the one who" },
            { it: "dove", en: "where" },
            { it: "ciò che", en: "what / that which" },
          ],
          sentences: [
            { it: "La persona che ho incontrato è simpatica.", en: "The person (whom) I met is nice." },
            { it: "Questa è la ragione per cui sono qui.", en: "This is the reason why I'm here." },
            { it: "Non capisco ciò che dici.", en: "I don't understand what you're saying." },
          ],
        },
        {
          id: "b2u3l3", title: "Reported speech",
          tip: "When reporting the past, tenses shift back: present → imperfetto, futuro → condizionale composto. <i>«Arrivo» → Ha detto che arrivava.</i>",
          items: [
            { it: "ha detto che", en: "he/she said that" },
            { it: "ha chiesto se", en: "he/she asked if" },
            { it: "secondo lui", en: "according to him" },
            { it: "sosteneva che", en: "he/she claimed that" },
            { it: "ha aggiunto", en: "he/she added" },
          ],
          sentences: [
            { it: "Ha detto che sarebbe arrivato tardi.", en: "He said he would arrive late." },
            { it: "Mi ha chiesto se volevo un caffè.", en: "She asked me if I wanted a coffee." },
            { it: "Ha aggiunto che non era d'accordo.", en: "He added that he didn't agree." },
          ],
        },
      ],
    },
    {
      id: "b2u4", title: "Environment & opinion", icon: "🌍",
      lessons: [
        {
          id: "b2u4l1", title: "Environment",
          items: [
            { it: "l'inquinamento", en: "pollution", pos: "noun m" },
            { it: "il riscaldamento globale", en: "global warming", pos: "noun m" },
            { it: "i rifiuti", en: "waste/rubbish", pos: "noun m pl" },
            { it: "riciclare", en: "to recycle", pos: "verb" },
            { it: "l'energia rinnovabile", en: "renewable energy", pos: "noun f" },
            { it: "risparmiare", en: "to save (resources)", pos: "verb" },
            { it: "sostenibile", en: "sustainable" },
          ],
          sentences: [
            { it: "Dobbiamo ridurre l'inquinamento.", en: "We must reduce pollution." },
            { it: "È importante riciclare i rifiuti.", en: "It's important to recycle waste." },
            { it: "L'energia solare è sostenibile.", en: "Solar energy is sustainable." },
          ],
        },
        {
          id: "b2u4l2", title: "Expressing strong opinions",
          items: [
            { it: "a mio parere", en: "in my view" },
            { it: "sono convinto che", en: "I'm convinced that" },
            { it: "non sono affatto d'accordo", en: "I don't agree at all" },
            { it: "d'altra parte", en: "on the other hand" },
            { it: "vale la pena", en: "it's worth it" },
            { it: "mi sembra che", en: "it seems to me that" },
            { it: "in fin dei conti", en: "in the end / all things considered" },
          ],
          sentences: [
            { it: "A mio parere, la situazione migliorerà.", en: "In my view, the situation will improve." },
            { it: "Non sono affatto d'accordo con te.", en: "I don't agree with you at all." },
            { it: "Vale la pena provare.", en: "It's worth trying." },
          ],
        },
      ],
    },
  ]);

  /* ======================================================================== */
  /*  C1 — more advanced units                                                */
  /* ======================================================================== */
  add("c1", [
    {
      id: "c1u2", title: "Debate & argument", icon: "⚖️",
      lessons: [
        {
          id: "c1u2l1", title: "Structuring an argument",
          items: [
            { it: "innanzitutto", en: "first of all" },
            { it: "d'altro canto", en: "on the other hand" },
            { it: "a tal proposito", en: "on this matter" },
            { it: "ne consegue che", en: "it follows that" },
            { it: "va sottolineato che", en: "it must be stressed that" },
            { it: "in conclusione", en: "in conclusion" },
            { it: "ciononostante", en: "nonetheless" },
          ],
          sentences: [
            { it: "Innanzitutto, occorre analizzare i dati.", en: "First of all, we need to analyse the data." },
            { it: "Ne consegue che la teoria è errata.", en: "It follows that the theory is wrong." },
            { it: "Va sottolineato che il tempo è limitato.", en: "It must be stressed that time is limited." },
          ],
        },
        {
          id: "c1u2l2", title: "Abstract & academic vocabulary",
          items: [
            { it: "la premessa", en: "the premise", pos: "noun f" },
            { it: "l'ipotesi", en: "the hypothesis", pos: "noun f" },
            { it: "l'ambito", en: "the scope/field", pos: "noun m" },
            { it: "il fenomeno", en: "the phenomenon", pos: "noun m" },
            { it: "cogliere", en: "to grasp/seize", pos: "verb" },
            { it: "ribadire", en: "to reiterate", pos: "verb" },
            { it: "costituire", en: "to constitute", pos: "verb" },
          ],
          sentences: [
            { it: "L'ipotesi deve essere verificata.", en: "The hypothesis must be verified." },
            { it: "Questo fenomeno è difficile da cogliere.", en: "This phenomenon is hard to grasp." },
            { it: "Vorrei ribadire il mio punto di vista.", en: "I'd like to reiterate my point of view." },
          ],
        },
      ],
    },
    {
      id: "c1u3", title: "Business Italian", icon: "🏢",
      lessons: [
        {
          id: "c1u3l1", title: "The workplace (advanced)",
          items: [
            { it: "il fatturato", en: "the turnover/revenue", pos: "noun m" },
            { it: "l'andamento", en: "the trend/performance", pos: "noun m" },
            { it: "la scadenza", en: "the deadline", pos: "noun f" },
            { it: "il preventivo", en: "the quote/estimate", pos: "noun m" },
            { it: "la trattativa", en: "the negotiation", pos: "noun f" },
            { it: "stipulare", en: "to draw up (a contract)", pos: "verb" },
            { it: "il fornitore", en: "the supplier", pos: "noun m" },
          ],
          sentences: [
            { it: "Il fatturato è aumentato del dieci per cento.", en: "Turnover increased by ten per cent." },
            { it: "Dobbiamo rispettare la scadenza.", en: "We must meet the deadline." },
            { it: "Le invio il preventivo in allegato.", en: "I'm sending you the quote attached." },
          ],
        },
        {
          id: "c1u3l2", title: "Formal correspondence",
          tip: "Italian business emails are formal: open with <b>Gentile / Egregio</b>, close with <b>Cordiali saluti</b> or <b>Distinti saluti</b>.",
          items: [
            { it: "Gentile Signore", en: "Dear Sir" },
            { it: "Egregio Dottore", en: "Dear Doctor (formal)" },
            { it: "in riferimento a", en: "with reference to" },
            { it: "La prego di", en: "I kindly ask you to" },
            { it: "resto in attesa", en: "I look forward (await)" },
            { it: "distinti saluti", en: "yours faithfully" },
          ],
          sentences: [
            { it: "In riferimento alla Sua email, confermo l'appuntamento.", en: "With reference to your email, I confirm the appointment." },
            { it: "La prego di inviarmi i documenti.", en: "I kindly ask you to send me the documents." },
            { it: "Resto in attesa di una Sua risposta.", en: "I look forward to your reply." },
          ],
        },
      ],
    },
  ]);

})();
