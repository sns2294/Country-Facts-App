// Question building for the Language quiz ("What is the official language of X?").
//
// Three rules keep the questions fair:
//   1. "Giveaways" (the answer is basically the country's name: France ->
//      French) are allowed but rare: at most one per quiz, and not every quiz.
//   2. Wrong options come from the same part of the world as the correct
//      answer (same subregion, then region, then anywhere), so the answer can't
//      be found by elimination.
//   3. A wrong option is never any of the country's own official languages, nor
//      a variant of one (Norwegian Bokmål vs Norwegian, Serbian vs Croatian),
//      so a question never has two correct choices.
(function (root) {
  const GIVEAWAY_QUIZ_CHANCE = 0.4; // chance that a quiz contains one giveaway
  const MAX_GIVEAWAYS = 1;

  // Display name: drop parentheticals ("Greek (modern)" -> "Greek"), and use
  // "Malay" for the language the data calls "Malaysian".
  function cleanLanguageName(name) {
    const cleaned = name.replace(/\s*\([^)]*\)\s*/g, " ").trim();
    return cleaned === "Malaysian" ? "Malay" : cleaned;
  }

  // Languages that count as "the same answer" when deciding what a wrong
  // option may be. Maps a cleaned name to a shared key.
  const SAME_LANGUAGE_GROUP = {
    "Norwegian Bokmål": "Norwegian",
    "Norwegian Nynorsk": "Norwegian",
    Serbian: "Serbo-Croatian",
    Croatian: "Serbo-Croatian",
    Bosnian: "Serbo-Croatian",
    Montenegrin: "Serbo-Croatian",
    Haitian: "Haitian Creole",
  };
  const languageKey = (name) => SAME_LANGUAGE_GROUP[name] || name;

  // The answer for countries where the first-listed language isn't the one
  // most of the population speaks (the data lists some alphabetically, some
  // official-first). Rule: the language most people actually speak; where no
  // single local language covers the country (DR Congo), the official one.
  // Keyed by alpha2 code.
  const PRIMARY_LANGUAGE = {
    ZA: "Zulu",
    ZW: "Shona",
    LU: "Luxembourgish",
    MF: "French",
    CD: "French",
    HT: "Haitian Creole",
    MG: "Malagasy",
    FJ: "Fijian",
    BW: "Tswana",
    MW: "Chichewa",
    LS: "Southern Sotho",
    SZ: "Swati",
    BI: "Kirundi",
    CF: "Sango",
    BF: "Mooré",
  };
  const primaryLanguage = (country) =>
    PRIMARY_LANGUAGE[country.alpha2Code] || cleanLanguageName(country.languages[0].name);

  const normalize = (s) =>
    s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  function sharedPrefixLength(a, b) {
    let i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i++;
    return i;
  }

  // Places with no permanent population: left out of the quiz entirely.
  const UNINHABITED = new Set(["BV", "HM", "TF", "GS", "UM", "AQ", "IO"]);
  const isInhabited = (country) => !UNINHABITED.has(country.alpha2Code);

  // True when the primary language shares its start with a word of the
  // country's name or demonym (at least 4 letters, or all of a shorter
  // language name such as Lao/Laos): Germany/German, North Macedonia/
  // Macedonian, Saudi Arabia/Arabic. Territories are checked against their own
  // name only: their demonym comes from the parent (Martinique -> "French").
  function isGiveaway(country) {
    const language = normalize(primaryLanguage(country));
    const isTerritory = country.sovereign === false;
    // "Sint Maarten (Dutch part)": the qualifier names the parent, not the place.
    const name = isTerritory ? country.name.replace(/\s*\([^)]*\)/g, "") : country.name;
    const demonym = isTerritory ? "" : country.demonym || "";
    const words = [...name.split(/[\s,()]+/), ...demonym.split(/[\s,()]+/)]
      .filter(Boolean)
      .map(normalize);
    const needed = Math.min(4, language.length);
    return words.some((w) => sharedPrefixLength(w, language) >= needed);
  }

  function shuffle(arr) {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  // Maps subregion/region -> the languages that are the *primary* official
  // language of some country there. Primary only, so English or French (listed
  // second in many places) don't flood every region's options.
  function buildRegionIndex(pool) {
    const bySubregion = new Map();
    const byRegion = new Map();
    const add = (map, key, lang) => {
      if (!key) return;
      if (!map.has(key)) map.set(key, new Set());
      map.get(key).add(lang);
    };
    pool.forEach((c) => {
      const lang = primaryLanguage(c);
      add(bySubregion, c.subregion, lang);
      add(byRegion, c.region, lang);
    });
    return { bySubregion, byRegion };
  }

  function buildQuestion(country, pool, index) {
    const correct = primaryLanguage(country);
    const blocked = new Set([correct, ...country.languages.map((l) => cleanLanguageName(l.name))].map(languageKey));
    const options = [];
    const taken = new Set(blocked);
    const take = (languages) => {
      shuffle([...languages]).forEach((lang) => {
        const key = languageKey(lang);
        if (options.length < 3 && !taken.has(key)) {
          taken.add(key);
          options.push(lang);
        }
      });
    };
    take(index.bySubregion.get(country.subregion) || []);
    take(index.byRegion.get(country.region) || []);
    take(new Set(pool.map(primaryLanguage)));

    return {
      kind: "mcq",
      code: country.alpha2Code,
      promptType: "text",
      promptLabel: "What is the official language of",
      prompt: country.name,
      correctAnswer: correct,
      options: shuffle([correct, ...options]),
    };
  }

  // pool: countries with at least one language. Returns `count` questions,
  // each about a different country and (where possible) a different answer.
  // `order(list)` arranges a candidate list for picking (default: shuffled), so
  // the app can put recently asked countries last.
  function buildLanguageQuestions(allCountries, count, order = shuffle) {
    const pool = allCountries.filter(isInhabited);
    const index = buildRegionIndex(pool);
    const giveaways = order(pool.filter(isGiveaway));
    const regular = order(pool.filter((c) => !isGiveaway(c)));
    const giveawayCount = Math.random() < GIVEAWAY_QUIZ_CHANCE ? MAX_GIVEAWAYS : 0;

    const picks = [];
    const usedAnswers = new Set();
    const pick = (list, limit) => {
      for (const c of list) {
        if (picks.length >= limit) break;
        const answer = languageKey(primaryLanguage(c));
        if (usedAnswers.has(answer)) continue;
        usedAnswers.add(answer);
        picks.push(c);
      }
    };
    pick(giveaways, giveawayCount);
    pick(regular, count);
    // Tiny pools: top up without the unique-answer rule.
    for (let i = 0; picks.length < count && regular.length; i++) {
      picks.push(regular[i % regular.length]);
    }
    return shuffle(picks).map((c) => buildQuestion(c, pool, index));
  }

  const api = { buildLanguageQuestions, primaryLanguage, isInhabited, isGiveaway, cleanLanguageName };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.LanguageQuiz = api;
})(typeof window !== "undefined" ? window : globalThis);
