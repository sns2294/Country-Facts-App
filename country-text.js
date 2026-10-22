// Display helpers shared by the app (app.js) and the static country pages
// (scripts/build-pages.mjs), so a fact reads the same everywhere: names,
// number formats, government and religion text, and the one-line overview.
(function (root) {
  const BORDER_DISPLAY_NAME_OVERRIDES = {
    "Korea (Democratic People's Republic of)": "North Korea",
    "Lao People's Democratic Republic": "Laos",
    "Venezuela (Bolivarian Republic of)": "Venezuela",
    "Congo (Democratic Republic of the)": "DR Congo",
  };

  function getBorderDisplayName(name) {
    return BORDER_DISPLAY_NAME_OVERRIDES[name] || name;
  }

  // Corrections for bad currency data from countries.dev, keyed by alpha2Code.
  const CURRENCY_OVERRIDES = {
    ZW: [{ code: "ZWG", name: "Zimbabwe Gold", symbol: "ZiG" }],
  };

  function getCurrencies(country) {
    return CURRENCY_OVERRIDES[country.alpha2Code] || country.currencies;
  }


  function formatPopulation(pop) {
    return typeof pop === "number" ? pop.toLocaleString("en-US") : "Unknown";
  }

  function formatArea(area) {
    return typeof area === "number" ? `${area.toLocaleString("en-US")} km²` : "N/A";
  }

  function formatCurrencies(currencies) {
    if (!currencies?.length) return "N/A";
    return currencies.map((c) => (c.code ? `${c.name} (${c.code})` : c.name)).join(", ");
  }

  function formatGdp(gdp) {
    if (!gdp) return "N/A";
    const units = [
      [1e12, "T"],
      [1e9, "B"],
      [1e6, "M"],
    ];
    for (const [size, suffix] of units) {
      if (gdp.value >= size) return `$${(gdp.value / size).toFixed(1)}${suffix}`;
    }
    return `$${Math.round(gdp.value).toLocaleString("en-US")}`;
  }

  const NON_RELIGIOUS = "Non-religious";

  function capitalize(text) {
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
  }

  function withArticle(phrase) {
    // "uni-" and "eu-" are pronounced with a consonant sound ("a unitary
    // republic"), except "unincorporated".
    const consonantSound = /^(uni(?!nc)|eu|one)/i.test(phrase);
    return `${/^[aeiou]/i.test(phrase) && !consonantSound ? "an" : "a"} ${phrase}`;
  }

  // Factbook government types that don't read as "[Country] is a/an <type>".
  // Keyed by the raw type string. `card` is the Form of Government text;
  // `phrase` is a replacement noun phrase for the default template; `lead` is
  // a full opening clause for the overview, used when no noun phrase fits.
  const GOVERNMENT_OVERRIDES = {
    theocratic: { card: "Theocratic", lead: (c) => `${c.name}'s government is theocratic` },
    authoritarian: { card: "Authoritarian", lead: (c) => `${c.name}'s government is authoritarian` },
    "in transition": { card: "In transition", lead: (c) => `${c.name}'s government is in transition` },
    "formerly, semi-presidential republic": {
      card: "Military junta since a 2023 coup; previously a semi-presidential republic",
      lead: (c) => `${c.name} has been governed by a military junta since a 2023 coup`,
      separateSentence: true,
    },
    "administered as an overseas territory of Australia": {
      card: "Administered as an overseas territory of Australia",
      lead: (c) => `${c.name} is administered as an overseas territory of Australia`,
    },
    "legal status of territory and issue of sovereignty unresolved": {
      card: "Disputed; sovereignty unresolved",
      lead: (c) => `${c.name}'s legal status and the issue of its sovereignty are unresolved`,
    },
    "a commonwealth in political union with and under the sovereignty of the US": {
      card: "Commonwealth in political union with the United States",
      phrase: "commonwealth in political union with the United States",
      subject: "The Northern Mariana Islands",
    },
    "Republic of Cyprus - presidential republic": {
      card: "Presidential republic",
      phrase: "presidential republic",
    },
  };

  function formatGovernment(country) {
    const type = country.governmentType;
    // Territories the Factbook folds into their parent: say what they are.
    if (!type) return country.parent?.note || "N/A";
    return GOVERNMENT_OVERRIDES[type]?.card || capitalize(type);
  }

  // For a territory whose figures are counted in its parent country's.
  function includedInParent(country) {
    return country.parent?.figures ? `Included in ${country.parent.figures} figures` : "N/A";
  }

  // Top religious groups, each with its share when the Factbook gives one.
  function formatReligions(religions, country) {
    if (!religions?.length) return includedInParent(country);
    const list = religions
      .map((r) => (r.pct === null ? r.name : `${r.name} <span class="stat-note">(${r.pct}%)</span>`))
      .join("<br />");
    // Names with no shares are deliberate (the Factbook gave none, or too few to
    // show), so say so rather than leave the numbers looking like a bug.
    const noShares = religions.every((r) => r.pct === null);
    return noShares ? `${list}<br /><span class="stat-note">Percentages not available</span>` : list;
  }

  // The single predominant religion, or null when the largest group is
  // non-religious or the Factbook gave no percentages to rank by.
  function getPredominantReligion(country) {
    const top = country.religions?.[0];
    if (!top || top.pct === null || top.name === NON_RELIGIOUS) return null;
    return top.name;
  }

  // Entries whose own name is the subregion's, so "located in <subregion>"
  // would just repeat it. Keyed by alpha2 code.
  const LOCATION_OVERRIDES = {
    FM: "the western Pacific Ocean",
  };

  // Entries that can't be described by where they are: the continent itself.
  const OVERVIEW_OVERRIDES = {
    AQ: "Antarctica is the continent surrounding the South Pole.",
  };

  // "South America", "the Caribbean": the subregion names the place better than
  // the broad region does, so use it alone ("Americas (South America)" reads badly).
  function locationName(country) {
    if (LOCATION_OVERRIDES[country.alpha2Code]) return LOCATION_OVERRIDES[country.alpha2Code];
    let place = country.subregion || country.region;
    if (!place) return "";
    // "Australia and New Zealand" reads oddly as the place Australia is in.
    if (place === "Australia and New Zealand") place = "Oceania";
    return place === "Caribbean" || /Ocean$/.test(place) ? `the ${place}` : place;
  }

  // "Asia (Southern Asia)", or just the one name when there is no subregion or
  // it repeats the region.
  function formatRegion(country) {
    const { region, subregion } = country;
    if (!region) return "N/A";
    return subregion && subregion !== region ? `${region} (${subregion})` : region;
  }

  function buildOverview(country) {
    if (OVERVIEW_OVERRIDES[country.alpha2Code]) return OVERVIEW_OVERRIDES[country.alpha2Code];
    const location = locationName(country);
    const regionPhrase = location ? `located in ${location}` : "";
    const override = GOVERNMENT_OVERRIDES[country.governmentType];
    if (override?.lead) {
      const joiner = override.separateSentence ? ". It is" : ", and it is";
      let overview = `${override.lead(country)}${location ? `${joiner} located in ${location}` : ""}.`;
      const religion = getPredominantReligion(country);
      if (religion) overview += ` ${religion} is the predominant religion.`;
      return overview;
    }
    const govType = override?.phrase || country.governmentType;
    const govPhrase = govType ? withArticle(govType) : country.parent?.phrase || "";

    let overview = override?.subject || country.name;
    if (govPhrase && regionPhrase) {
      overview += ` is ${govPhrase}, ${regionPhrase}.`;
    } else if (govPhrase || regionPhrase) {
      overview += ` is ${govPhrase || regionPhrase}.`;
    } else {
      overview += ".";
    }

    const predominantReligion = getPredominantReligion(country);
    if (predominantReligion) {
      overview += ` ${predominantReligion} is the predominant religion.`;
    }

    return overview;
  }

  const api = {
    getBorderDisplayName,
    getCurrencies,
    formatPopulation,
    formatArea,
    formatCurrencies,
    formatGdp,
    formatGovernment,
    formatReligions,
    formatRegion,
    includedInParent,
    getPredominantReligion,
    buildOverview,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.CountryText = api;
})(typeof window !== "undefined" ? window : globalThis);
