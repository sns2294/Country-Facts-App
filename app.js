(() => {
  const COUNTRIES_URL = "data/countries.json";
  const META_URL = "data/meta.json";
  const DARK_MODE_KEY = "countryFactsApp.darkMode";

  const countryInput = document.getElementById("country-input");
  const countryList = document.getElementById("country-list");
  const searchStatus = document.getElementById("search-status");
  const factCard = document.getElementById("fact-card");
  const darkModeToggle = document.getElementById("dark-mode-toggle");
  const darkModeIcon = document.getElementById("dark-mode-icon");
  const searchSection = document.querySelector(".search-section");
  const mapSection = document.getElementById("map-section");
  const mapContainer = document.getElementById("map-container");
  const mapLoading = document.getElementById("map-loading");
  const mapTooltip = document.getElementById("map-tooltip");
  const viewToggleButtons = document.querySelectorAll("#explore-view-toggle button");
  const mapZoomInBtn = document.getElementById("map-zoom-in");
  const mapZoomOutBtn = document.getElementById("map-zoom-out");
  const mapZoomResetBtn = document.getElementById("map-zoom-reset");
  const globeSection = document.getElementById("globe-section");
  const globeContainer = document.getElementById("globe-container");
  const globeLoading = document.getElementById("globe-loading");
  const globeZoomInBtn = document.getElementById("globe-zoom-in");
  const globeZoomOutBtn = document.getElementById("globe-zoom-out");
  const globeResetBtn = document.getElementById("globe-reset");

  const sectionToggleButtons = document.querySelectorAll("#section-toggle button");
  const exploreSection = document.getElementById("explore-section");
  const quizSection = document.getElementById("quiz-section");
  const quizModeSelect = document.getElementById("quiz-mode-select");
  const quizModeButtons = document.querySelectorAll("#quiz-mode-select .quiz-mode-btn");
  const quizStatus = document.getElementById("quiz-status");
  const quizRegionSelect = document.getElementById("quiz-region-select");
  const quizRegionButtons = document.querySelectorAll(".quiz-region-btn");
  const quizRegionBackBtn = document.getElementById("quiz-region-back-btn");
  const quizRegionStatus = document.getElementById("quiz-region-status");
  const quizProgressBar = document.getElementById("quiz-progress-bar");
  const quizQuestionEl = document.getElementById("quiz-question");
  const quizProgressText = document.getElementById("quiz-progress-text");
  const quizScoreText = document.getElementById("quiz-score-text");
  const quizPrompt = document.getElementById("quiz-prompt");
  const quizOptions = document.getElementById("quiz-options");
  const quizFeedback = document.getElementById("quiz-feedback");
  const quizNextBtn = document.getElementById("quiz-next-btn");
  const quizScoreScreen = document.getElementById("quiz-score-screen");
  const quizFinalScore = document.getElementById("quiz-final-score");
  const quizPlayAgainBtn = document.getElementById("quiz-play-again-btn");
  const quizExitBtn = document.getElementById("quiz-exit-btn");
  const exitQuizDialog = document.getElementById("exit-quiz-dialog");
  const exitQuizCancelBtn = document.getElementById("exit-quiz-cancel-btn");
  const exitQuizConfirmBtn = document.getElementById("exit-quiz-confirm-btn");

  const quizGeoQuestionEl = document.getElementById("quiz-geo-question");
  const quizGeoGlobeContainer = document.getElementById("quiz-geo-globe-container");
  const quizGeoGlobeLoading = document.getElementById("quiz-geo-globe-loading");
  const quizGeoZoomInBtn = document.getElementById("quiz-geo-zoom-in");
  const quizGeoZoomOutBtn = document.getElementById("quiz-geo-zoom-out");
  const quizCountryGuessInput = document.getElementById("quiz-country-guess");
  const quizCountryGuessList = document.getElementById("quiz-country-guess-list");
  const quizBonusRow = document.getElementById("quiz-bonus-row");
  const quizBonusCountryName = document.getElementById("quiz-bonus-country-name");
  const quizCapitalGuessInput = document.getElementById("quiz-capital-guess");
  const quizCapitalGuessList = document.getElementById("quiz-capital-guess-list");
  const quizGeoInputStatus = document.getElementById("quiz-geo-input-status");
  const quizGeoFeedback = document.getElementById("quiz-geo-feedback");
  const quizBonusStatus = document.getElementById("quiz-bonus-status");
  const quizBonusFeedback = document.getElementById("quiz-bonus-feedback");
  const quizGeoNextBtn = document.getElementById("quiz-geo-next-btn");

  const NATIVE_VIEW_BOX = { x: -180, y: -84, w: 360, h: 174 };
  const MIN_VIEW_WIDTH = 4;
  const MAX_VIEW_WIDTH = NATIVE_VIEW_BOX.w;
  const MIN_HIT_TARGET_PX = 9;
  const MAX_HIT_RADIUS_DEG = 1.0;
  const WHEEL_ZOOM_FACTOR = 1.15;
  const BUTTON_ZOOM_FACTOR = 1.4;
  const DRAG_THRESHOLD_PX = 3;
  const QUIZ_QUESTION_COUNT = 10;
  // Applied on top of the region fit for the Geography quiz mode so the region
  // fills more of the frame by default (still centered on the whole region,
  // not the individual highlighted country) — makes small island nations
  // easier to see.
  const QUIZ_GEO_ZOOM_BOOST = 0.85;
  const REGIONS = ["Europe", "Africa", "Asia", "Americas", "Oceania"];

  let countryNames = [];

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

  function setStatus(message, isError = false) {
    searchStatus.textContent = message;
    searchStatus.classList.toggle("error", isError);
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

  // All country data is read from local files written by scripts/update-data.mjs.
  // Loaded once; every lookup below works off these in-memory indexes.
  let countryDataPromise = null;
  function loadCountryData() {
    if (!countryDataPromise) {
      countryDataPromise = fetch(COUNTRIES_URL)
        .then((res) => {
          if (!res.ok) throw new Error(`Request failed: ${res.status}`);
          return res.json();
        })
        .then((countries) => {
          const byCode = new Map();
          countries.forEach((c) => {
            if (c.alpha2Code) byCode.set(c.alpha2Code, c);
            if (c.alpha3Code) byCode.set(c.alpha3Code, c);
          });
          return { countries, byCode };
        });
      countryDataPromise.catch(() => {
        countryDataPromise = null;
      });
    }
    return countryDataPromise;
  }

  async function getCountries() {
    return (await loadCountryData()).countries.filter((c) => c && c.name);
  }

  async function findCountryByCode(code) {
    const { byCode } = await loadCountryData();
    return byCode.get(String(code).toUpperCase()) || null;
  }

  async function getBorderCountries(borderCodes) {
    if (!borderCodes || !borderCodes.length) return [];
    const { byCode } = await loadCountryData();
    return borderCodes.map((code) => byCode.get(code)).filter(Boolean).map((c) => ({ code: c.alpha3Code, name: c.name }));
  }

  async function showDataDate() {
    const el = document.getElementById("data-updated");
    if (!el) return;
    try {
      const res = await fetch(META_URL);
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const { updatedAt } = await res.json();
      const date = new Date(updatedAt);
      if (Number.isNaN(date.getTime())) throw new Error("Invalid date");
      el.textContent = `Data last updated: ${date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`;
    } catch (err) {
      console.error("Failed to load data date:", err);
    }
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
    if (!type) return "N/A";
    return GOVERNMENT_OVERRIDES[type]?.card || capitalize(type);
  }

  // Top religious groups, each with its share when the Factbook gives one.
  function formatReligions(religions) {
    if (!religions?.length) return "N/A";
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

  function buildOverview(country) {
    const regionPhrase = country.region
      ? `located in ${country.region}${country.subregion ? ` (${country.subregion})` : ""}`
      : "";
    const override = GOVERNMENT_OVERRIDES[country.governmentType];
    if (override?.lead) {
      const location = country.region
        ? `${country.region}${country.subregion ? ` (${country.subregion})` : ""}`
        : "";
      const joiner = override.separateSentence ? ". It is" : ", and it is";
      let overview = `${override.lead(country)}${location ? `${joiner} located in ${location}` : ""}.`;
      const religion = getPredominantReligion(country);
      if (religion) overview += ` ${religion} is the predominant religion.`;
      return overview;
    }
    const govType = override?.phrase || country.governmentType;
    const govPhrase = govType ? withArticle(govType) : "";

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

  const phoneQuery = window.matchMedia("(max-width: 700px)");

  // The picker the user is currently selecting from: the visible map or globe,
  // falling back to the search box when the dropdown view is active.
  function getBackTarget() {
    if (!mapSection.hidden) return mapSection;
    if (!globeSection.hidden) return globeSection;
    return searchSection;
  }

  function backTargetLabel() {
    if (!mapSection.hidden) return "map";
    if (!globeSection.hidden) return "globe";
    return "search";
  }

  function scrollIntoViewOnPhone(el) {
    if (!phoneQuery.matches) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderCountry(country, borderCountries) {
    const gdp = country.gdp;
    const flagUrl = country.flags?.svg || country.flags?.png || "";
    const showNativeName = country.nativeName && country.nativeName !== country.name;
    const bordersMarkup = borderCountries.length
      ? `
        <div class="borders-section">
          <h3>Bordering Countries</h3>
          <div class="borders-list">${borderCountries
            .map(
              (b) =>
                `<button type="button" class="border-chip" data-code="${b.code}">${getBorderDisplayName(
                  b.name
                )}</button>`
            )
            .join("")}</div>
        </div>
      `
      : "";

    factCard.innerHTML = `
      <button type="button" class="back-to-map">&uarr; Back to ${backTargetLabel()}</button>
      <div class="card-header">
        ${flagUrl ? `<img class="flag" src="${flagUrl}" alt="Flag of ${country.name}" />` : ""}
        <div>
          <h2>${country.name}</h2>
          ${showNativeName ? `<p class="native-name">${country.nativeName}</p>` : ""}
        </div>
      </div>
      <div class="card-body">
        <dl class="stats-grid">
          <div class="stat">
            <dt>Capital</dt>
            <dd>${country.capital || "N/A"}</dd>
          </div>
          <div class="stat">
            <dt>Population</dt>
            <dd>${formatPopulation(country.population)}${country.populationYear ? ` <span class="stat-note">(${country.populationYear})</span>` : ""}</dd>
          </div>
          <div class="stat">
            <dt>Region</dt>
            <dd>${country.region || "N/A"}${country.subregion ? ` (${country.subregion})` : ""}</dd>
          </div>
          <div class="stat">
            <dt>Area</dt>
            <dd>${formatArea(country.area)}</dd>
          </div>
          <div class="stat">
            <dt>Demonym</dt>
            <dd>${country.demonym || "N/A"}</dd>
          </div>
          <div class="stat">
            <dt>Languages</dt>
            <dd>${country.languages?.length ? country.languages.map((l) => l.name).join(", ") : "N/A"}</dd>
          </div>
          <div class="stat">
            <dt>Form of Government</dt>
            <dd>${formatGovernment(country)}</dd>
          </div>
          <div class="stat">
            <dt>Religion</dt>
            <dd>${formatReligions(country.religions)}</dd>
          </div>
          <div class="stat">
            <dt>Currency</dt>
            <dd>${formatCurrencies(getCurrencies(country))}</dd>
          </div>
          <div class="stat">
            <dt>GDP</dt>
            <dd>${formatGdp(gdp)}${gdp ? ` <span class="stat-note">(${gdp.year})</span>` : ""}</dd>
          </div>
        </dl>
        ${bordersMarkup}
        <p class="overview">${buildOverview(country)}</p>
      </div>
    `;
    factCard.hidden = false;
    // In the side-by-side layout the panel scrolls on its own; start each card at the top.
    factCard.parentElement.scrollTop = 0;
  }

  async function loadCountryList() {
    try {
      const countries = await getCountries();
      countryNames = countries.map((c) => c.name).sort((a, b) => a.localeCompare(b));

      countryList.innerHTML = countryNames
        .map((name) => `<option value="${name}"></option>`)
        .join("");

      setStatus(`${countryNames.length} countries loaded. Pick one to see its facts.`);
    } catch (err) {
      setStatus("Couldn't load the country list. Reload the page and try again.", true);
      console.error("Failed to load country list:", err);
    }
  }

  // Bumped on every selection so a slower, older lookup can't overwrite a newer one.
  let latestSelection = 0;
  let shownCountryName = null;

  // The country shown in the fact panel, mirrored on the map and globe. A
  // `recenter` selection (chip, dropdown) also brings it into view there; a
  // click on the map/globe itself leaves the camera where the user put it.
  let selectedCode = null;

  function syncSelection({ recenter = false } = {}) {
    exploreMap.setSelected(selectedCode, { recenter });
    if (selectedCode) {
      exploreGlobe.highlight(selectedCode, { framing: "country", moveCamera: recenter });
    } else {
      exploreGlobe.clearHighlight();
    }
  }

  function clearSelection() {
    selectedCode = null;
    syncSelection();
  }

  async function showCountryData(country, selection, { recenter = false } = {}) {
    const borderCountries = await getBorderCountries(country.borders);
    if (selection !== latestSelection) return;
    renderCountry(country, borderCountries);
    selectedCode = country.alpha2Code;
    syncSelection({ recenter });
    scrollIntoViewOnPhone(factCard);
    shownCountryName = country.name;
    setStatus(`Showing facts for ${country.name}.`);
  }

  async function selectCountry(rawName) {
    const name = rawName.trim();
    if (!name) return;

    const match = countryNames.find((n) => n.toLowerCase() === name.toLowerCase());
    if (!match) {
      setStatus(`"${name}" isn't in the country list — pick one from the suggestions.`, true);
      factCard.hidden = true;
      shownCountryName = null;
      clearSelection();
      return;
    }

    // Already showing it (e.g. the input blurred mid-click on a border chip):
    // re-rendering would replace the card the user is interacting with.
    if (match === shownCountryName && !factCard.hidden) return;

    const selection = ++latestSelection;
    setStatus(`Loading ${match}…`);
    try {
      const countries = await getCountries();
      const country = countries.find((c) => c.name.toLowerCase() === match.toLowerCase());
      if (!country) throw new Error("No matching country in data");

      await showCountryData(country, selection, { recenter: true });
    } catch (err) {
      setStatus(`Couldn't load data for ${match}. Try again.`, true);
      factCard.hidden = true;
      shownCountryName = null;
      clearSelection();
      console.error("Failed to load country:", err);
    }
  }

  async function selectCountryByCode(code, { recenter = false } = {}) {
    if (!code) return;

    const selection = ++latestSelection;
    setStatus("Loading…");
    try {
      const country = await findCountryByCode(code);
      if (!country) throw new Error("No country data for code");

      countryInput.value = country.name;
      await showCountryData(country, selection, { recenter });
    } catch (err) {
      setStatus("Couldn't load data for that country. Try again.", true);
      factCard.hidden = true;
      shownCountryName = null;
      clearSelection();
      console.error("Failed to load country by code:", err);
    }
  }

  countryInput.addEventListener("change", () => selectCountry(countryInput.value));

  factCard.addEventListener("click", (evt) => {
    if (evt.target.closest(".back-to-map")) {
      getBackTarget().scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const link = evt.target.closest(".border-chip");
    if (!link) return;
    selectCountryByCode(link.dataset.code, { recenter: true });
  });

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  // Longitude wraps at ±180°. Countries/regions that straddle that seam (Fiji,
  // Kiribati, Russia...) need the smallest arc (on the circular 360°-wide
  // longitude domain) containing every value in `xs` — a plain min/max would
  // treat Fiji's ~+178 and Samoa's ~-172 as being on opposite sides of the
  // world instead of ~10° apart. Shared by the flat map's SVG geometry and the
  // globe's GeoJSON geometry, both of which use plain degrees of longitude.
  function findEnclosingArc(xs) {
    if (!xs.length) return null;
    const normalized = Array.from(new Set(xs.map((x) => (((x % 360) + 360) % 360).toFixed(6))))
      .map(Number)
      .sort((a, b) => a - b);
    if (normalized.length === 1) return { start: normalized[0], span: 0 };

    let maxGap = -1;
    let gapAfterIndex = 0;
    for (let i = 0; i < normalized.length; i++) {
      const curr = normalized[i];
      const next = i === normalized.length - 1 ? normalized[0] + 360 : normalized[i + 1];
      const gap = next - curr;
      if (gap > maxGap) {
        maxGap = gap;
        gapAfterIndex = i;
      }
    }

    const start = normalized[(gapAfterIndex + 1) % normalized.length];
    return { start, span: 360 - maxGap };
  }

  let mapMarkupPromise = null;
  function fetchMapMarkup() {
    if (!mapMarkupPromise) {
      mapMarkupPromise = fetch("world-map.svg").then((res) => {
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        return res.text();
      });
    }
    return mapMarkupPromise;
  }

  // --- Flat-map shape rules (see shape-rules.js; the globe applies the same table) ---

  // The map's paths are straight-line rings ("M x,y L x,y ... Z").
  function parsePathRings(d) {
    return (d.match(/M[^M]*/g) || []).map((sub) => {
      const points = (sub.match(/-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?/g) || []).map((p) => p.split(",").map(Number));
      const last = points[points.length - 1];
      const first = points[0];
      if (last && first && last[0] === first[0] && last[1] === first[1]) points.pop();
      return points;
    });
  }

  function ringsToPathData(rings) {
    return rings.map((ring) => `M${ring.map(([x, y]) => `${x},${y}`).join("L")}Z`).join("");
  }

  // Joins two rings that share a border into one ring, dropping the shared
  // stretch so no line is drawn between them. Returns null if they share no
  // stretch of at least two consecutive points.
  function dissolveRingPair(a, b) {
    const key = ([x, y]) => `${x},${y}`;
    const inB = new Set(b.map(key));
    const inA = new Set(a.map(key));
    const n = a.length;
    const shared = a.map((p) => inB.has(key(p)));
    let best = null;
    for (let start = 0; start < n; start++) {
      if (!shared[start] || shared[(start + n - 1) % n]) continue;
      let len = 0;
      while (len < n && shared[(start + len) % n]) len++;
      if (len >= 2 && len < n && (!best || len > best.len)) best = { start, len };
    }
    if (!best) return null;

    const end = (best.start + best.len - 1) % n;
    const p = a[best.start];
    const q = a[end];
    const jp = b.findIndex((pt) => key(pt) === key(p));
    const jq = b.findIndex((pt) => key(pt) === key(q));
    const m = b.length;
    const walk = (from, to, step) => {
      const out = [];
      for (let j = (from + step + m) % m; j !== to; j = (j + step + m) % m) out.push(b[j]);
      return out;
    };
    const arcs = [walk(jp, jq, 1), walk(jp, jq, -1)];
    const sharedCount = (arc) => arc.filter((pt) => inA.has(key(pt))).length;
    arcs.sort((x, y) => sharedCount(x) - sharedCount(y) || y.length - x.length);

    const outerA = [];
    for (let i = end; ; i = (i + 1) % n) {
      outerA.push(a[i]);
      if (i === best.start) break;
    }
    return [...outerA, ...arcs[0]];
  }

  function mergePathRings(parentRings, childRings) {
    const rings = parentRings.map((r) => r.slice());
    childRings.forEach((child) => {
      for (let i = 0; i < rings.length; i++) {
        const joined = dissolveRingPair(rings[i], child);
        if (joined) {
          rings[i] = joined;
          return;
        }
      }
      rings.push(child);
    });
    return rings;
  }

  function applyFlatMapShapeRules(svg) {
    svg.querySelectorAll("path.country:not([id])").forEach((path) => {
      const rule = window.SHAPE_RULES[path.dataset.name];
      if (!rule) return;
      if (rule.linkTo) {
        path.id = rule.linkTo;
        path.classList.remove("no-code");
      }
      if (rule.mergeInto) {
        const parent = svg.querySelector(`path.country[id="${rule.mergeInto}"]`);
        if (!parent) return;
        const rings = mergePathRings(parsePathRings(parent.getAttribute("d")), parsePathRings(path.getAttribute("d")));
        parent.setAttribute("d", ringsToPathData(rings));
        path.remove();
      }
    });
  }

  // Shared pan/zoom/pinch/highlight engine backing both the Explore map and
  // the Map quiz mode's map, each with its own DOM, viewBox, and interaction rules.
  function createMapController({
    container,
    loadingEl,
    tooltipEl,
    zoomInBtn,
    zoomOutBtn,
    zoomResetBtn,
    isVisible,
    enableCountryInteraction = true,
    onCountryClick = null,
  }) {
    let loaded = false;
    let svg = null;
    let currentViewBox = { ...NATIVE_VIEW_BOX };
    let suppressNextClick = false;
    let selectedCode = null;

    function showTooltip(name) {
      if (!tooltipEl || !name) return;
      tooltipEl.textContent = name;
      tooltipEl.hidden = false;
    }

    function positionTooltip(evt) {
      if (!tooltipEl) return;
      const rect = container.getBoundingClientRect();
      const offset = 14;
      const x = evt.clientX - rect.left;
      const y = evt.clientY - rect.top;
      const { offsetWidth: w, offsetHeight: h } = tooltipEl;
      // Default is below-right of the cursor; flip to the other side of it on
      // any edge where the tooltip would overflow the container.
      let left = x + offset + w > rect.width ? x - offset - w : x + offset;
      let top = y + offset + h > rect.height ? y - offset - h : y + offset;
      // Safety net for containers too small for either side.
      left = clamp(left, 0, Math.max(rect.width - w, 0));
      top = clamp(top, 0, Math.max(rect.height - h, 0));
      tooltipEl.style.left = `${left}px`;
      tooltipEl.style.top = `${top}px`;
    }

    function hideTooltip() {
      if (!tooltipEl) return;
      tooltipEl.hidden = true;
    }

    function applyViewBox(x, y, w, { clampMargin = 0 } = {}) {
      const width = clamp(w, MIN_VIEW_WIDTH, MAX_VIEW_WIDTH);
      const height = width * (NATIVE_VIEW_BOX.h / NATIVE_VIEW_BOX.w);
      const maxX = NATIVE_VIEW_BOX.x + NATIVE_VIEW_BOX.w - width;
      const maxY = NATIVE_VIEW_BOX.y + NATIVE_VIEW_BOX.h - height;
      // Normal pan/zoom always stays within the map's real -180..180 data
      // (clampMargin 0). Programmatic centering on a country very close to
      // that edge (Fiji, Tonga, Samoa...) passes a small non-zero margin —
      // just enough for the highlight marker's own radius — instead of an
      // unbounded one: letting the viewBox spill without limit would center
      // the country but leave roughly half the frame blank on wide-region
      // views, which visually reads as the country sitting at the edge of
      // the (real) map anyway. Bounding the spill to marker size keeps the
      // ring from ever being clipped while staying as close to true map
      // bounds — and as close to centered — as the geometry allows.
      const minXBound = NATIVE_VIEW_BOX.x - clampMargin;
      const maxXBound = Math.max(maxX + clampMargin, minXBound);
      const minYBound = NATIVE_VIEW_BOX.y - clampMargin;
      const maxYBound = Math.max(maxY + clampMargin, minYBound);
      const clampedX = clamp(x, minXBound, maxXBound);
      const clampedY = clamp(y, minYBound, maxYBound);

      currentViewBox = { x: clampedX, y: clampedY, w: width, h: height };
      if (svg) {
        svg.setAttribute("viewBox", `${clampedX} ${clampedY} ${width} ${height}`);
      }
      updateHitTargetSizes();
    }

    function zoomAt(clientX, clientY, factor) {
      const rect = container.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      const ratioX = (clientX - rect.left) / rect.width;
      const ratioY = (clientY - rect.top) / rect.height;
      const userX = currentViewBox.x + ratioX * currentViewBox.w;
      const userY = currentViewBox.y + ratioY * currentViewBox.h;

      const newWidth = clamp(currentViewBox.w * factor, MIN_VIEW_WIDTH, MAX_VIEW_WIDTH);
      const newHeight = newWidth * (NATIVE_VIEW_BOX.h / NATIVE_VIEW_BOX.w);
      const newX = userX - ratioX * newWidth;
      const newY = userY - ratioY * newHeight;

      applyViewBox(newX, newY, newWidth);
    }

    function zoomAtCenter(factor) {
      const rect = container.getBoundingClientRect();
      zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor);
    }

    function updateHitTargetSizes() {
      if (!svg) return;
      const rect = container.getBoundingClientRect();
      if (!rect.width) return;
      const scale = rect.width / currentViewBox.w;
      // Capped so that at low zoom (many degrees per screen pixel) the enlarged
      // click target doesn't balloon large enough to swallow neighboring countries.
      const radius = Math.min(MIN_HIT_TARGET_PX / scale, MAX_HIT_RADIUS_DEG);
      svg.querySelectorAll("circle.hit-target").forEach((circle) => {
        circle.setAttribute("r", radius);
      });
    }

    function attachZoomPanHandlers() {
      container.addEventListener(
        "wheel",
        (evt) => {
          evt.preventDefault();
          const factor = evt.deltaY > 0 ? WHEEL_ZOOM_FACTOR : 1 / WHEEL_ZOOM_FACTOR;
          zoomAt(evt.clientX, evt.clientY, factor);
        },
        { passive: false }
      );

      let isDragging = false;
      let dragged = false;
      let lastX = 0;
      let lastY = 0;

      container.addEventListener("mousedown", (evt) => {
        if (evt.button !== 0) return;
        isDragging = true;
        dragged = false;
        lastX = evt.clientX;
        lastY = evt.clientY;
      });

      window.addEventListener("mousemove", (evt) => {
        if (!isDragging) return;
        const dx = evt.clientX - lastX;
        const dy = evt.clientY - lastY;
        if (!dragged && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
        dragged = true;
        container.classList.add("dragging");

        const rect = container.getBoundingClientRect();
        const scaleX = currentViewBox.w / rect.width;
        const scaleY = currentViewBox.h / rect.height;
        applyViewBox(currentViewBox.x - dx * scaleX, currentViewBox.y - dy * scaleY, currentViewBox.w);
        lastX = evt.clientX;
        lastY = evt.clientY;
      });

      window.addEventListener("mouseup", () => {
        if (isDragging && dragged) {
          suppressNextClick = true;
        }
        isDragging = false;
        dragged = false;
        container.classList.remove("dragging");
      });

      function touchDistance(t0, t1) {
        return Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      }

      function touchMidpoint(t0, t1) {
        return { x: (t0.clientX + t1.clientX) / 2, y: (t0.clientY + t1.clientY) / 2 };
      }

      let pinchStartDist = 0;

      container.addEventListener(
        "touchstart",
        (evt) => {
          if (evt.touches.length === 1) {
            isDragging = true;
            dragged = false;
            lastX = evt.touches[0].clientX;
            lastY = evt.touches[0].clientY;
          } else if (evt.touches.length === 2) {
            isDragging = false;
            dragged = true;
            pinchStartDist = touchDistance(evt.touches[0], evt.touches[1]);
          }
        },
        { passive: true }
      );

      container.addEventListener(
        "touchmove",
        (evt) => {
          if (evt.touches.length === 2) {
            evt.preventDefault();
            const dist = touchDistance(evt.touches[0], evt.touches[1]);
            if (pinchStartDist) {
              const mid = touchMidpoint(evt.touches[0], evt.touches[1]);
              zoomAt(mid.x, mid.y, pinchStartDist / dist);
              container.classList.add("dragging");
            }
            pinchStartDist = dist;
          } else if (evt.touches.length === 1 && isDragging) {
            const touch = evt.touches[0];
            const dx = touch.clientX - lastX;
            const dy = touch.clientY - lastY;
            if (!dragged && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
            evt.preventDefault();
            dragged = true;
            container.classList.add("dragging");

            const rect = container.getBoundingClientRect();
            const scaleX = currentViewBox.w / rect.width;
            const scaleY = currentViewBox.h / rect.height;
            applyViewBox(currentViewBox.x - dx * scaleX, currentViewBox.y - dy * scaleY, currentViewBox.w);
            lastX = touch.clientX;
            lastY = touch.clientY;
          }
        },
        { passive: false }
      );

      function endTouch(evt) {
        if (evt.touches.length === 0) {
          if (dragged) suppressNextClick = true;
          isDragging = false;
          dragged = false;
          pinchStartDist = 0;
          container.classList.remove("dragging");
        } else if (evt.touches.length === 1) {
          isDragging = true;
          lastX = evt.touches[0].clientX;
          lastY = evt.touches[0].clientY;
          pinchStartDist = 0;
        }
      }

      container.addEventListener("touchend", endTouch);
      container.addEventListener("touchcancel", endTouch);

      container.addEventListener(
        "click",
        (evt) => {
          if (suppressNextClick) {
            evt.stopPropagation();
            evt.preventDefault();
            suppressNextClick = false;
          }
        },
        true
      );

      if (zoomInBtn) zoomInBtn.addEventListener("click", () => zoomAtCenter(1 / BUTTON_ZOOM_FACTOR));
      if (zoomOutBtn) zoomOutBtn.addEventListener("click", () => zoomAtCenter(BUTTON_ZOOM_FACTOR));
      if (zoomResetBtn) {
        zoomResetBtn.addEventListener("click", () =>
          applyViewBox(NATIVE_VIEW_BOX.x, NATIVE_VIEW_BOX.y, NATIVE_VIEW_BOX.w)
        );
      }

      window.addEventListener("resize", () => {
        if (loaded && (!isVisible || isVisible())) updateHitTargetSizes();
      });
    }

    function attachMapHandlers() {
      svg.querySelectorAll("path.country").forEach((path) => {
        path.addEventListener("mouseenter", () => {
          path.classList.add("hovered");
          showTooltip(path.dataset.name);
        });
        path.addEventListener("mousemove", positionTooltip);
        path.addEventListener("mouseleave", () => {
          path.classList.remove("hovered");
          hideTooltip();
        });
        if (path.id && onCountryClick) {
          path.addEventListener("click", () => onCountryClick(path.id));
        }
      });

      svg.querySelectorAll("circle.hit-target").forEach((circle) => {
        const code = circle.dataset.code;
        const realPath = document.getElementById(code);
        circle.addEventListener("mouseenter", () => {
          circle.classList.add("active");
          if (realPath) realPath.classList.add("hovered");
          showTooltip(circle.dataset.name);
        });
        circle.addEventListener("mousemove", positionTooltip);
        circle.addEventListener("mouseleave", () => {
          circle.classList.remove("active");
          if (realPath) realPath.classList.remove("hovered");
          hideTooltip();
        });
        if (onCountryClick) circle.addEventListener("click", () => onCountryClick(code));
      });
    }

    // Marks the country picked in the fact panel. With `recenter`, pans (keeping
    // the zoom) to bring it into view if it's currently off screen.
    function setSelected(code, { recenter = false } = {}) {
      selectedCode = code;
      if (!svg) return;
      svg.querySelectorAll(".selected").forEach((el) => el.classList.remove("selected"));
      if (!code) return;
      const path = svg.querySelector(`path.country[id="${code}"]`);
      const circle = svg.querySelector(`circle.hit-target[data-code="${code}"]`);
      if (path) path.classList.add("selected");
      if (circle) circle.classList.add("selected");
      if (!recenter) return;

      let cx;
      let cy;
      if (circle) {
        cx = Number(circle.getAttribute("cx"));
        cy = Number(circle.getAttribute("cy"));
      } else if (path) {
        const box = path.getBBox();
        // A shape spanning the antimeridian (Russia, Fiji...) has a bounding box
        // that wraps the whole map, so its centre would be meaningless.
        if (box.width > 180) return;
        cx = box.x + box.width / 2;
        cy = box.y + box.height / 2;
      } else {
        return;
      }
      const v = currentViewBox;
      const insetX = v.w * 0.1;
      const insetY = v.h * 0.1;
      const visible = cx > v.x + insetX && cx < v.x + v.w - insetX && cy > v.y + insetY && cy < v.y + v.h - insetY;
      if (!visible) applyViewBox(cx - v.w / 2, cy - v.h / 2, v.w);
    }

    async function ensureLoaded() {
      if (loaded) return;
      try {
        const svgMarkup = await fetchMapMarkup();
        container.insertAdjacentHTML("afterbegin", svgMarkup);
        if (loadingEl) loadingEl.hidden = true;
        loaded = true;
        svg = container.querySelector("svg");
        applyFlatMapShapeRules(svg);
        if (enableCountryInteraction) attachMapHandlers();
        attachZoomPanHandlers();
        applyViewBox(NATIVE_VIEW_BOX.x, NATIVE_VIEW_BOX.y, NATIVE_VIEW_BOX.w);
        setSelected(selectedCode, { recenter: true });
      } catch (err) {
        if (loadingEl) loadingEl.textContent = "Couldn't load the map. Reload the page and try again.";
        console.error("Failed to load world map:", err);
        throw err;
      }
    }

    return {
      ensureLoaded,
      setSelected,
    };
  }

  const exploreMap = createMapController({
    container: mapContainer,
    loadingEl: mapLoading,
    tooltipEl: mapTooltip,
    zoomInBtn: mapZoomInBtn,
    zoomOutBtn: mapZoomOutBtn,
    zoomResetBtn: mapZoomResetBtn,
    isVisible: () => !mapSection.hidden,
    onCountryClick: (code) => selectCountryByCode(code),
  });

  // --- 3D globe view (globe.gl, loaded via CDN) ---
  // Country polygon data + the ISO numeric<->alpha2 lookup are fetched once
  // and shared by every Globe() instance (Explore's and the quiz's) rather
  // than being re-fetched per instance.
  const GLOBE_GEO_URL = "data/countries-50m.json";
  const GLOBE_FULL_GEO_URL = "data/countries-50m-full.json";
  // Below this camera altitude the simplified shapes start to look rough, so
  // the countries in view are swapped for full-detail ones (see syncDetail).
  const GLOBE_DETAIL_ALTITUDE = 0.25;
  // Closest a pinch or scroll gesture can get; any nearer and even the
  // full-detail shapes would be magnified past what the 50m data resolves.
  const GLOBE_GESTURE_MIN_ALTITUDE = 0.13;
  // Cap on full-detail vertices on screen at once, nearest countries first, so
  // a huge neighbour (Russia, Canada) can't make the swap slow on a phone.
  const GLOBE_DETAIL_VERTEX_BUDGET = 6000;
  const GLOBE_DEFAULT_POV = { lat: 15, lng: 10, altitude: 1.85 };
  const GLOBE_MIN_ALTITUDE = 0.32;
  const GLOBE_MAX_ALTITUDE = 4;
  const GLOBE_ZOOM_FACTOR = 1.4;
  const GLOBE_CAMERA_NEAR = 5;
  const GLOBE_CAMERA_FAR = 1200;
  const COUNTRY_FRAME_PADDING = 1.9;
  const COUNTRY_FRAME_MIN_SPAN = 9;

  let globeFeaturesPromise = null;
  let globeNumericToAlpha2Promise = null;
  let globeLibraryPromise = null;
  let globeFullFeaturesPromise = null;

  // globe.gl is ~1.9 MB, so it is only fetched the first time a globe is
  // needed (the Globe tab or a geography quiz) rather than with the page.
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(script);
    });
  }

  function loadGlobeLibrary() {
    if (!globeLibraryPromise) {
      globeLibraryPromise = Promise.all([
        loadScript("vendor/topojson-client.min.js"),
        loadScript("vendor/globe.gl.min.js"),
      ]).catch((err) => {
        globeLibraryPromise = null;
        throw err;
      });
    }
    return globeLibraryPromise;
  }

  function getCssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function hexToRgbTriplet(hex) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || "");
    if (!m) return "47,111,237";
    return [1, 2, 3].map((i) => parseInt(m[i], 16)).join(",");
  }

  // Applies window.SHAPE_RULES (see shape-rules.js) to the globe's shapes.
  function applyGlobeShapeRules(topology, numericToAlpha2) {
    const alpha2ToNumeric = new Map([...numericToAlpha2].map(([numeric, alpha2]) => [alpha2, numeric]));
    const collection = topology.objects.countries;
    const features = topojson.feature(topology, collection).features;
    const geometries = collection.geometries;
    const mergedAway = new Set();

    features.forEach((feature, i) => {
      const rule = window.SHAPE_RULES[feature.properties?.name];
      if (!rule || feature.id) return;
      if (rule.linkTo) feature.id = alpha2ToNumeric.get(rule.linkTo);
      if (rule.neutral) feature.properties = { ...feature.properties, name: "", neutral: true };
      if (rule.mergeInto) {
        const parentId = alpha2ToNumeric.get(rule.mergeInto);
        const parentIndex = features.findIndex((f) => f.id === parentId);
        if (parentIndex < 0) return;
        const merged = topojson.merge(topology, [geometries[parentIndex], geometries[i]]);
        features[parentIndex] = { ...features[parentIndex], geometry: merged };
        mergedAway.add(i);
      }
    });
    return features.filter((_, i) => !mergedAway.has(i));
  }

  // Kicks off the library and the map data together so they download in parallel.
  function fetchGlobeFeatures() {
    if (!globeFeaturesPromise) {
      globeFeaturesPromise = Promise.all([
        fetch(GLOBE_GEO_URL).then((res) => {
          if (!res.ok) throw new Error(`Request failed: ${res.status}`);
          return res.json();
        }),
        fetchNumericToAlpha2Map(),
        loadGlobeLibrary(),
      ]).then(([topology, numericToAlpha2]) => applyGlobeShapeRules(topology, numericToAlpha2));
      globeFeaturesPromise.catch(() => {
        globeFeaturesPromise = null;
      });
    }
    return globeFeaturesPromise;
  }

  // Full-detail twin of fetchGlobeFeatures(): same shape rules on the same
  // atlas, so it lines up index-for-index with the simplified features.
  function fetchGlobeFullFeatures() {
    if (!globeFullFeaturesPromise) {
      globeFullFeaturesPromise = Promise.all([
        fetch(GLOBE_FULL_GEO_URL).then((res) => {
          if (!res.ok) throw new Error(`Request failed: ${res.status}`);
          return res.json();
        }),
        fetchNumericToAlpha2Map(),
        loadGlobeLibrary(),
      ]).then(([topology, numericToAlpha2]) => applyGlobeShapeRules(topology, numericToAlpha2));
      globeFullFeaturesPromise.catch(() => {
        globeFullFeaturesPromise = null;
      });
    }
    return globeFullFeaturesPromise;
  }

  function countVertices(feature) {
    const geom = feature.geometry;
    if (!geom) return 0;
    const rings = geom.type === "Polygon" ? geom.coordinates : geom.type === "MultiPolygon" ? geom.coordinates.flat() : [];
    return rings.reduce((sum, ring) => sum + ring.length, 0);
  }

  // world-atlas polygon ids are zero-padded ISO 3166-1 numeric codes, which
  // line up with the numericCode field in the country data — used to
  // resolve a polygon back to the alpha2 code the rest of the app keys on.
  function fetchNumericToAlpha2Map() {
    if (!globeNumericToAlpha2Promise) {
      globeNumericToAlpha2Promise = getCountries().then((data) => {
        const map = new Map();
        data.forEach((c) => {
          if (c.numericCode && c.alpha2Code) map.set(c.numericCode, c.alpha2Code);
        });
        return map;
      });
    }
    return globeNumericToAlpha2Promise;
  }

  // Bounding box (in degrees) of one or more GeoJSON polygon/multipolygon
  // features, using findEnclosingArc for longitude so antimeridian-straddling
  // countries/regions (Fiji, Russia...) measure correctly.
  function getFeatureSetBBox(features) {
    const lngs = [];
    let minLat = Infinity;
    let maxLat = -Infinity;
    features.forEach((feature) => {
      const geom = feature?.geometry;
      if (!geom) return;
      const rings =
        geom.type === "Polygon" ? geom.coordinates : geom.type === "MultiPolygon" ? geom.coordinates.flat() : [];
      rings.forEach((ring) => {
        ring.forEach(([lng, lat]) => {
          lngs.push(lng);
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
        });
      });
    });
    if (!lngs.length || !isFinite(minLat)) return null;

    const arc = findEnclosingArc(lngs);
    const midNormalized = arc.start + arc.span / 2;
    const centerLng = midNormalized > 180 ? midNormalized - 360 : midNormalized;
    return { centerLat: (minLat + maxLat) / 2, centerLng, latSpan: maxLat - minLat, lngSpan: arc.span };
  }

  // Empirical mapping from a region's angular span (degrees) to a globe.gl
  // camera altitude that frames it reasonably. globe.gl's perspective camera
  // has no exact equivalent to the flat map's orthographic viewBox width, so
  // this is tuned by feel (small country ≈ 0.35, large region ≈ 1.5+) rather
  // than derived geometrically.
  function altitudeForSpan(spanDeg) {
    return clamp(0.22 + spanDeg / 55, GLOBE_MIN_ALTITUDE, GLOBE_MAX_ALTITUDE);
  }

  // Shared pan/zoom/hover/highlight engine backing both the Explore globe and
  // the Geography quiz's globe, each with its own WebGL canvas and click rules.
  function createGlobeController({
    container,
    loadingEl,
    zoomInBtn,
    zoomOutBtn,
    resetBtn,
    isVisible,
    enableCountryInteraction = true,
    onCountryClick = null,
  }) {
    let globe = null;
    let alpha2ToFeature = new Map();
    let hoverFeature = null;
    let targetFeature = null;
    // Level-of-detail state. `features` are the simplified shapes; `detailOf`
    // maps one to its full-detail twin once that file has loaded. `canon` maps
    // a displayed shape back to its simplified original so hover/target
    // comparisons keep working after a swap.
    let features = [];
    let detailOf = null;
    let canon = new Map();
    let detailRequested = false;
    let detailTimer = null;
    let displayedDetail = new Set();
    const bboxCache = new Map();

    function refreshPolygonStyles() {
      if (!globe) return;
      const fillColor = getCssVar("--map-fill");
      const hoverColor = getCssVar("--map-hover");
      const strokeColor = getCssVar("--map-stroke");
      const targetColor = getCssVar("--map-highlight");
      globe
        .polygonCapColor((d) => {
          const base = canon.get(d) || d;
          return base === targetFeature ? targetColor : base === hoverFeature ? hoverColor : fillColor;
        })
        .polygonSideColor(() => fillColor)
        .polygonStrokeColor(() => strokeColor)
        .polygonAltitude((d) => {
          const base = canon.get(d) || d;
          return base === targetFeature ? 0.02 : base === hoverFeature ? 0.015 : 0.006;
        });
    }

    function applyTheme() {
      if (!globe) return;
      const highlightRgb = hexToRgbTriplet(getCssVar("--map-highlight") || "#e8590c");
      globe.backgroundColor("rgba(0,0,0,0)");
      globe.globeMaterial().color.set(getCssVar("--globe-ocean") || "#5eadeb");
      globe
        .atmosphereColor(getCssVar("--map-atmosphere") || "#8cc8f5")
        .ringColor(() => (t) => `rgba(${highlightRgb},${Math.sqrt(Math.max(0, 1 - t))})`);
      refreshPolygonStyles();
    }

    // The camera frames the globe by panel height, so on a panel taller than
    // it is wide (phones) pull back to keep the whole ball in view.
    function defaultPov() {
      const rect = container.getBoundingClientRect();
      const narrowness = rect.width && rect.height ? Math.max(1, rect.height / rect.width) : 1;
      return { ...GLOBE_DEFAULT_POV, altitude: clamp(GLOBE_DEFAULT_POV.altitude * narrowness, GLOBE_MIN_ALTITUDE, GLOBE_MAX_ALTITUDE) };
    }

    function resize() {
      if (!globe) return;
      const rect = container.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      globe.width(rect.width).height(rect.height);
    }

    async function handlePolygonClick(feature) {
      if (!onCountryClick || !feature?.id) return;
      const numericToAlpha2 = await fetchNumericToAlpha2Map();
      const alpha2 = numericToAlpha2.get(feature.id);
      if (alpha2) onCountryClick(alpha2);
    }

    async function ensureLoaded() {
      if (globe) {
        resize();
        return;
      }
      try {
        const [loaded, numericToAlpha2] = await Promise.all([fetchGlobeFeatures(), fetchNumericToAlpha2Map()]);
        features = loaded;
        features.forEach((feature) => {
          const alpha2 = feature.id && numericToAlpha2.get(feature.id);
          if (alpha2) alpha2ToFeature.set(alpha2, feature);
        });

        globe = Globe()(container)
          .showAtmosphere(true)
          .atmosphereAltitude(0.15)
          .polygonsData(features)
          .polygonsTransitionDuration(200)
          .ringsData([])
          .ringAltitude(0.02)
          .ringMaxRadius(3.5)
          .ringPropagationSpeed(2.5)
          .ringRepeatPeriod(1400);

        if (enableCountryInteraction) {
          globe
            .polygonLabel(({ properties }) => (properties && properties.name) || "")
            .onPolygonHover((feat) => {
              hoverFeature = feat?.properties?.neutral ? null : canon.get(feat) || feat;
              refreshPolygonStyles();
            })
            .onPolygonClick(handlePolygonClick);
        }

        // globe.gl leaves the camera at near 0.05 / far 125000, leaving the depth
        // buffer too coarse to tell country borders (drawn 0.01 units above the
        // land) from the land itself, which makes borders flicker and dot. The
        // camera never gets closer than ~30 or farther than ~600 units, so a
        // tight range fixes it.
        const tuneDepthRange = () => {
          const camera = globe.camera();
          camera.near = GLOBE_CAMERA_NEAR;
          camera.far = GLOBE_CAMERA_FAR;
          camera.updateProjectionMatrix();
        };
        tuneDepthRange();
        globe.onGlobeReady(tuneDepthRange);
        globe.controls().minDistance = globe.getGlobeRadius() * (1 + GLOBE_GESTURE_MIN_ALTITUDE);
        prefetchDetailWhenIdle();
        globe.onZoom(() => {
          clearTimeout(detailTimer);
          detailTimer = setTimeout(syncDetail, 150);
        });

        globe.pointOfView(defaultPov(), 0);
        applyTheme();
        resize();
        if (loadingEl) loadingEl.hidden = true;
      } catch (err) {
        if (loadingEl) loadingEl.textContent = "Couldn't load the globe. Reload the page and try again.";
        console.error("Failed to load globe:", err);
        throw err;
      }
    }

    // Quietly fetches the full-detail shapes once the globe is up and the
    // browser is idle, so the first zoom-in doesn't wait on the download.
    // Skipped when the user has asked to save data.
    function prefetchDetailWhenIdle() {
      if (navigator.connection?.saveData) return;
      const start = () => fetchGlobeFullFeatures().catch(() => {});
      if ("requestIdleCallback" in window) requestIdleCallback(start, { timeout: 5000 });
      else setTimeout(start, 2000);
    }

    function featureBBox(feature) {
      if (!bboxCache.has(feature)) bboxCache.set(feature, getFeatureSetBBox([feature]));
      return bboxCache.get(feature);
    }

    // Swaps full-detail shapes in for the countries currently in view when
    // zoomed in past GLOBE_DETAIL_ALTITUDE, and puts the simplified ones back
    // when zoomed out. Only the swapped countries change identity, so the
    // globe rebuilds just those meshes, not the whole planet.
    async function syncDetail() {
      if (!globe) return;
      const pov = globe.pointOfView();
      const zoomedIn = pov.altitude < GLOBE_DETAIL_ALTITUDE;
      if (zoomedIn && !detailOf) {
        if (detailRequested) return;
        detailRequested = true;
        try {
          const full = await fetchGlobeFullFeatures();
          if (full.length !== features.length) throw new Error("full-detail shapes don't match simplified ones");
          detailOf = new Map(features.map((f, i) => [f, full[i]]));
          full.forEach((f, i) => canon.set(f, features[i]));
        } catch (err) {
          console.error("Failed to load full-detail shapes:", err);
          return;
        }
        syncDetail();
        return;
      }
      if (!detailOf) return;

      const wanted = new Set();
      if (zoomedIn) {
        const halfView = pov.altitude * 45;
        const candidates = [];
        features.forEach((feature) => {
          const box = featureBBox(feature);
          if (!box) return;
          const dLat = Math.abs(box.centerLat - pov.lat);
          const dLng = Math.abs(((box.centerLng - pov.lng + 540) % 360) - 180) * Math.cos((pov.lat * Math.PI) / 180);
          if (dLat > halfView + box.latSpan / 2 || dLng > halfView + (box.lngSpan * Math.cos((pov.lat * Math.PI) / 180)) / 2) return;
          candidates.push({ feature, dist: feature === targetFeature ? -1 : Math.hypot(dLat, dLng) });
        });
        candidates.sort((p, q) => p.dist - q.dist);
        let budget = GLOBE_DETAIL_VERTEX_BUDGET;
        for (const { feature } of candidates) {
          const cost = countVertices(detailOf.get(feature));
          if (cost > budget && wanted.size) continue;
          budget -= cost;
          wanted.add(feature);
        }
      }
      if (wanted.size === displayedDetail.size && [...wanted].every((f) => displayedDetail.has(f))) return;
      displayedDetail = wanted;
      globe.polygonsData(features.map((f) => (wanted.has(f) ? detailOf.get(f) : f)));
    }

    function zoomAtCenter(factor) {
      if (!globe) return;
      const pov = globe.pointOfView();
      const altitude = clamp(pov.altitude * factor, GLOBE_MIN_ALTITUDE, GLOBE_MAX_ALTITUDE);
      globe.pointOfView({ lat: pov.lat, lng: pov.lng, altitude }, 250);
    }

    function reset() {
      if (!globe) return;
      globe.pointOfView(defaultPov(), 600);
    }

    function getAvailableCodes() {
      return new Set(alpha2ToFeature.keys());
    }

    // Frames the target country's own location, sizing the camera altitude to
    // fit `contextCodes` (defaults to just the target) — mirrors the flat
    // map's fitToCodes + centerHorizontallyOn pairing used by the old quiz map.
    // `framing: "country"` sizes the view to the target alone, padded so its
    // neighbors and nearby seas show, with a floor so tiny countries stay
    // findable and a ceiling (the max altitude) so huge ones keep a margin.
    function highlight(code, { contextCodes = [code], boost = 1, transitionMs = 600, framing = "context", moveCamera = true } = {}) {
      if (!globe) return;
      const feature = alpha2ToFeature.get(code);
      if (!feature) return;
      targetFeature = feature;
      refreshPolygonStyles();

      const targetBox = getFeatureSetBBox([feature]);
      const contextFeatures = contextCodes.map((c) => alpha2ToFeature.get(c)).filter(Boolean);
      const contextBox = getFeatureSetBBox(contextFeatures.length ? contextFeatures : [feature]) || targetBox;
      if (!targetBox || !contextBox) return;

      let span = Math.max(contextBox.lngSpan, contextBox.latSpan * 2);
      if (framing === "country") span = clamp(span * COUNTRY_FRAME_PADDING, COUNTRY_FRAME_MIN_SPAN, Infinity);
      const altitude = altitudeForSpan(span) * boost;
      if (moveCamera) globe.pointOfView({ lat: targetBox.centerLat, lng: targetBox.centerLng, altitude }, transitionMs);
      globe.ringsData([{ lat: targetBox.centerLat, lng: targetBox.centerLng }]);
    }

    function clearHighlight() {
      targetFeature = null;
      if (!globe) return;
      globe.ringsData([]);
      refreshPolygonStyles();
    }

    if (zoomInBtn) zoomInBtn.addEventListener("click", () => zoomAtCenter(1 / GLOBE_ZOOM_FACTOR));
    if (zoomOutBtn) zoomOutBtn.addEventListener("click", () => zoomAtCenter(GLOBE_ZOOM_FACTOR));
    if (resetBtn) resetBtn.addEventListener("click", reset);

    window.addEventListener("resize", () => {
      if (globe && (!isVisible || isVisible())) resize();
    });

    return {
      ensureLoaded,
      applyTheme,
      highlight,
      clearHighlight,
      getAvailableCodes,
    };
  }

  const exploreGlobe = createGlobeController({
    container: globeContainer,
    loadingEl: globeLoading,
    zoomInBtn: globeZoomInBtn,
    zoomOutBtn: globeZoomOutBtn,
    resetBtn: globeResetBtn,
    isVisible: () => !globeSection.hidden,
    onCountryClick: (code) => selectCountryByCode(code),
  });

  const quizGlobe = createGlobeController({
    container: quizGeoGlobeContainer,
    loadingEl: quizGeoGlobeLoading,
    zoomInBtn: quizGeoZoomInBtn,
    zoomOutBtn: quizGeoZoomOutBtn,
    resetBtn: null,
    isVisible: () => !quizGeoQuestionEl.hidden,
    enableCountryInteraction: false,
  });

  function setView(view) {
    const isMap = view === "map";
    const isGlobe = view === "globe";
    searchSection.hidden = isMap || isGlobe;
    mapSection.hidden = !isMap;
    globeSection.hidden = !isGlobe;
    viewToggleButtons.forEach((btn) => {
      const active = btn.dataset.view === view;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-selected", String(active));
    });
    // Catch the map/globe up with a country picked while they were hidden.
    if (isMap) exploreMap.ensureLoaded().then(() => syncSelection({ recenter: true })).catch(() => {});
    if (isGlobe) exploreGlobe.ensureLoaded().then(() => syncSelection({ recenter: true })).catch(() => {});
  }

  viewToggleButtons.forEach((btn) => {
    btn.addEventListener("click", () => setView(btn.dataset.view));
  });

  function setAppSection(section) {
    const isQuiz = section === "quiz";
    exploreSection.hidden = isQuiz;
    quizSection.hidden = !isQuiz;
    sectionToggleButtons.forEach((btn) => {
      const active = btn.dataset.section === section;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-selected", String(active));
    });
  }

  sectionToggleButtons.forEach((btn) => {
    btn.addEventListener("click", () => setAppSection(btn.dataset.section));
  });

  let quizCountriesCache = null;
  let quizState = null;

  async function ensureQuizCountries() {
    if (quizCountriesCache) return quizCountriesCache;
    quizCountriesCache = await getCountries();
    return quizCountriesCache;
  }

  function shuffleArray(arr) {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function buildOneMcqQuestion(item, pool, mode) {
    const correctAnswer = mode.getAnswer(item);
    const distractorPool = pool.filter((p) => p !== item && mode.getAnswer(p) !== correctAnswer);
    const wrongAnswers = [];

    shuffleArray(distractorPool).forEach((candidate) => {
      const value = mode.getAnswer(candidate);
      if (wrongAnswers.length < 3 && !wrongAnswers.includes(value)) wrongAnswers.push(value);
    });
    shuffleArray(distractorPool).forEach((candidate) => {
      if (wrongAnswers.length < 3) wrongAnswers.push(mode.getAnswer(candidate));
    });

    return {
      kind: "mcq",
      promptType: mode.promptType,
      promptLabel: mode.promptLabel,
      prompt: mode.getPrompt(item),
      correctAnswer,
      options: shuffleArray([correctAnswer, ...wrongAnswers.slice(0, 3)]),
    };
  }

  function buildQuizQuestions(pool, mode) {
    const shuffledPool = shuffleArray(pool);
    const picks = [];
    for (let i = 0; i < QUIZ_QUESTION_COUNT; i++) {
      picks.push(shuffledPool[i % shuffledPool.length]);
    }
    return picks.map((item) => buildOneMcqQuestion(item, pool, mode));
  }

  function buildOneGeoQuestion(country) {
    return { kind: "geography", country };
  }

  function buildGeoQuestions(pool) {
    const shuffledPool = shuffleArray(pool);
    const picks = [];
    for (let i = 0; i < QUIZ_QUESTION_COUNT; i++) {
      picks.push(shuffledPool[i % shuffledPool.length]);
    }
    return picks.map(buildOneGeoQuestion);
  }

  const QUIZ_MODES = {
    flag: {
      label: "Flag",
      promptType: "image",
      async preparePool() {
        const countries = await ensureQuizCountries();
        return countries.filter((c) => c.flags?.svg || c.flags?.png);
      },
      getPrompt: (c) => c.flags?.svg || c.flags?.png,
      getAnswer: (c) => c.name,
    },
    capital: {
      label: "Capital",
      promptType: "text",
      promptLabel: "Which city is the capital of",
      async preparePool() {
        const countries = await ensureQuizCountries();
        return countries.filter((c) => c.capital);
      },
      getPrompt: (c) => c.name,
      getAnswer: (c) => c.capital,
    },
    religion: {
      label: "Religion",
      promptType: "text",
      promptLabel: "What is the predominant religion in",
      async preparePool() {
        const countries = await ensureQuizCountries();
        return countries
          .map((c) => ({ ...c, religion: getPredominantReligion(c) }))
          .filter((c) => c.religion);
      },
      getPrompt: (c) => c.name,
      getAnswer: (c) => c.religion,
    },
    language: {
      label: "Language",
      promptType: "text",
      promptLabel: "What is the official language of",
      async preparePool() {
        const countries = await ensureQuizCountries();
        return countries.filter((c) => c.languages?.length);
      },
      getPrompt: (c) => c.name,
      getAnswer: (c) => c.languages[0].name,
    },
  };

  function showQuizScreen(screen) {
    quizModeSelect.hidden = screen !== "mode";
    quizRegionSelect.hidden = screen !== "region";
    quizProgressBar.hidden = screen !== "question";
    quizQuestionEl.hidden = true;
    quizGeoQuestionEl.hidden = true;
    quizScoreScreen.hidden = screen !== "score";
  }

  const MCQ_MODE_KEYS = Object.keys(QUIZ_MODES);

  // Builds the pools every sub-type of the Mixed quiz draws from, tolerating
  // any individual pool coming up short (e.g. religion data) rather than
  // failing the whole round.
  async function prepareMixedPools() {
    const mcqPools = {};
    await Promise.all(
      MCQ_MODE_KEYS.map(async (key) => {
        try {
          const pool = await QUIZ_MODES[key].preparePool();
          if (pool.length >= 4) mcqPools[key] = pool;
        } catch (err) {
          console.error(`Failed to prepare ${key} pool for mixed quiz:`, err);
        }
      })
    );

    let geoPool = [];
    try {
      await quizGlobe.ensureLoaded();
      const countries = await ensureGeoCountries();
      const availableCodes = quizGlobe.getAvailableCodes();
      geoPool = countries.filter((c) => availableCodes.has(c.alpha2Code));
    } catch (err) {
      console.error("Failed to prepare geography pool for mixed quiz:", err);
    }

    return { mcqPools, geoPool };
  }

  function buildMixedQuestions(mcqPools, geoPool) {
    const kinds = Object.keys(mcqPools);
    if (geoPool.length >= 4) kinds.push("geography");

    const questions = [];
    for (let i = 0; i < QUIZ_QUESTION_COUNT; i++) {
      const kind = kinds[Math.floor(Math.random() * kinds.length)];
      if (kind === "geography") {
        const country = geoPool[Math.floor(Math.random() * geoPool.length)];
        questions.push(buildOneGeoQuestion(country));
      } else {
        const mode = QUIZ_MODES[kind];
        const pool = mcqPools[kind];
        const item = pool[Math.floor(Math.random() * pool.length)];
        questions.push(buildOneMcqQuestion(item, pool, mode));
      }
    }
    return questions;
  }

  async function startQuiz(modeKey) {
    quizStatus.classList.remove("error");
    quizStatus.textContent = "Loading quiz…";
    try {
      let questions;
      let geoPool = null;

      if (modeKey === "mixed") {
        const pools = await prepareMixedPools();
        if (!Object.keys(pools.mcqPools).length && pools.geoPool.length < 4) {
          quizStatus.textContent = "Not enough data to run the Mixed quiz right now. Try again later.";
          quizStatus.classList.add("error");
          return;
        }
        geoPool = pools.geoPool;
        questions = buildMixedQuestions(pools.mcqPools, pools.geoPool);
      } else {
        const mode = QUIZ_MODES[modeKey];
        const pool = await mode.preparePool();
        if (pool.length < 4) {
          quizStatus.textContent = `Not enough data to run the ${mode.label} quiz right now. Try another mode.`;
          quizStatus.classList.add("error");
          return;
        }
        questions = buildQuizQuestions(pool, mode);
      }

      if (geoPool && geoPool.length) {
        const namesInPool = geoPool.map((c) => c.name).sort((a, b) => a.localeCompare(b));
        const capitalsInPool = Array.from(new Set(geoPool.map((c) => c.capital))).sort((a, b) => a.localeCompare(b));
        populateDatalist(quizCountryGuessList, namesInPool);
        populateDatalist(quizCapitalGuessList, capitalsInPool);
      }

      quizState = {
        questions,
        index: 0,
        score: 0,
        geoPool: geoPool || [],
        countryAnswered: false,
        bonusActive: false,
      };
      quizStatus.textContent = "";
      showQuizScreen("question");
      renderQuizQuestion();
    } catch (err) {
      quizStatus.textContent = "Couldn't load quiz data. Reload the page and try again.";
      quizStatus.classList.add("error");
      console.error("Failed to start quiz:", err);
    }
  }

  function renderQuizQuestion() {
    const { questions, index, score } = quizState;
    const question = questions[index];

    quizProgressText.textContent = `Question ${index + 1} of ${questions.length}`;
    quizScoreText.textContent = `Score: ${score}`;
    quizProgressBar.classList.toggle("quiz-progress--geo", question.kind === "geography");

    if (question.kind === "geography") {
      quizQuestionEl.hidden = true;
      quizGeoQuestionEl.hidden = false;
      renderGeoQuestion(question);
    } else {
      quizGeoQuestionEl.hidden = true;
      quizQuestionEl.hidden = false;
      renderMcqQuestion(question);
    }
  }

  function renderMcqQuestion(question) {
    quizPrompt.innerHTML =
      question.promptType === "image"
        ? `<img class="quiz-flag" src="${question.prompt}" alt="Flag to identify" />`
        : `<p class="quiz-prompt-text">${question.promptLabel} <strong>${question.prompt}</strong>?</p>`;

    quizOptions.innerHTML = question.options
      .map((opt) => `<button type="button" class="quiz-option-btn" data-answer="${opt.replace(/"/g, "&quot;")}">${opt}</button>`)
      .join("");

    quizFeedback.hidden = true;
    quizFeedback.textContent = "";
    quizFeedback.classList.remove("correct", "wrong");
    quizNextBtn.hidden = true;
  }

  function handleQuizAnswer(selectedBtn) {
    const question = quizState.questions[quizState.index];
    const selected = selectedBtn.dataset.answer;
    const isCorrect = selected === question.correctAnswer;

    quizOptions.querySelectorAll(".quiz-option-btn").forEach((btn) => {
      btn.disabled = true;
      if (btn.dataset.answer === question.correctAnswer) btn.classList.add("correct");
      else if (btn === selectedBtn) btn.classList.add("wrong");
    });

    if (isCorrect) quizState.score += 1;
    quizScoreText.textContent = `Score: ${quizState.score}`;

    quizFeedback.hidden = false;
    quizFeedback.textContent = isCorrect ? "Correct!" : `Incorrect — the correct answer is ${question.correctAnswer}.`;
    quizFeedback.classList.toggle("correct", isCorrect);
    quizFeedback.classList.toggle("wrong", !isCorrect);

    quizNextBtn.hidden = false;
    quizNextBtn.textContent = quizState.index === quizState.questions.length - 1 ? "See Score" : "Next Question";
  }

  quizOptions.addEventListener("click", (evt) => {
    const btn = evt.target.closest(".quiz-option-btn");
    if (!btn || btn.disabled) return;
    handleQuizAnswer(btn);
  });

  function goToNextQuestion() {
    quizState.index += 1;
    if (quizState.index >= quizState.questions.length) {
      quizGlobe.clearHighlight();
      quizFinalScore.textContent = `${quizState.score}/${quizState.questions.length}`;
      showQuizScreen("score");
    } else {
      renderQuizQuestion();
    }
  }

  quizNextBtn.addEventListener("click", goToNextQuestion);
  quizGeoNextBtn.addEventListener("click", goToNextQuestion);

  function returnToModeSelect() {
    quizGlobe.clearHighlight();
    quizState = null;
    showQuizScreen("mode");
  }

  quizPlayAgainBtn.addEventListener("click", returnToModeSelect);

  function openExitQuizDialog() {
    exitQuizDialog.hidden = false;
  }

  function closeExitQuizDialog() {
    exitQuizDialog.hidden = true;
  }

  quizExitBtn.addEventListener("click", openExitQuizDialog);
  exitQuizCancelBtn.addEventListener("click", closeExitQuizDialog);
  exitQuizConfirmBtn.addEventListener("click", () => {
    closeExitQuizDialog();
    returnToModeSelect();
  });
  exitQuizDialog.addEventListener("click", (evt) => {
    if (evt.target === exitQuizDialog) closeExitQuizDialog();
  });
  document.addEventListener("keydown", (evt) => {
    if (evt.key === "Escape" && !exitQuizDialog.hidden) closeExitQuizDialog();
  });

  quizModeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.dataset.mode;
      if (mode === "geography") {
        quizRegionStatus.textContent = "";
        quizRegionStatus.classList.remove("error");
        showQuizScreen("region");
      } else {
        startQuiz(mode);
      }
    });
  });

  quizRegionBackBtn.addEventListener("click", () => showQuizScreen("mode"));

  quizRegionButtons.forEach((btn) => {
    btn.addEventListener("click", () => startGeographyQuiz(btn.dataset.region));
  });

  // Geography questions (standalone and in Mixed mode) cover sovereign states
  // only: UN members plus observers, not territories.
  let geoCountriesCache = null;
  async function ensureGeoCountries() {
    if (geoCountriesCache) return geoCountriesCache;
    const data = await getCountries();
    geoCountriesCache = data.filter((c) => c && c.name && c.capital && c.alpha2Code && c.sovereign && REGIONS.includes(c.region));
    return geoCountriesCache;
  }

  function populateDatalist(datalistEl, values) {
    datalistEl.innerHTML = values.map((value) => `<option value="${value}"></option>`).join("");
  }

  function matchPoolItem(pool, rawValue, key) {
    const value = rawValue.trim().toLowerCase();
    if (!value) return null;
    return pool.find((item) => item[key].toLowerCase() === value) || null;
  }

  async function startGeographyQuiz(region) {
    quizRegionStatus.classList.remove("error");
    quizRegionStatus.textContent = "Loading quiz…";
    try {
      await quizGlobe.ensureLoaded();
      const countries = await ensureGeoCountries();
      const availableCodes = quizGlobe.getAvailableCodes();
      const pool = countries.filter((c) => c.region === region && availableCodes.has(c.alpha2Code));

      if (pool.length < 4) {
        quizRegionStatus.textContent = `Not enough mapped countries in ${region} to run this quiz. Try another region.`;
        quizRegionStatus.classList.add("error");
        return;
      }

      const countryNamesInRegion = pool.map((c) => c.name).sort((a, b) => a.localeCompare(b));
      const capitalsInRegion = Array.from(new Set(pool.map((c) => c.capital))).sort((a, b) => a.localeCompare(b));
      populateDatalist(quizCountryGuessList, countryNamesInRegion);
      populateDatalist(quizCapitalGuessList, capitalsInRegion);

      quizState = {
        region,
        geoPool: pool,
        questions: buildGeoQuestions(pool),
        index: 0,
        score: 0,
        countryAnswered: false,
        bonusActive: false,
      };
      quizRegionStatus.textContent = "";
      showQuizScreen("question");
      renderQuizQuestion();
    } catch (err) {
      quizRegionStatus.textContent = "Couldn't load quiz data. Reload the page and try again.";
      quizRegionStatus.classList.add("error");
      console.error("Failed to start geography quiz:", err);
    }
  }

  function renderGeoQuestion(question) {
    // A chosen region (standalone Geography mode) frames the whole region so
    // the target has to be located within it; Mixed mode has no region, so it
    // frames the target with padding for its neighbors and nearby seas.
    const highlightOptions = quizState.region
      ? { contextCodes: quizState.geoPool.map((c) => c.alpha2Code), boost: QUIZ_GEO_ZOOM_BOOST }
      : { framing: "country" };
    quizGlobe.highlight(question.country.alpha2Code, highlightOptions);

    quizState.countryAnswered = false;
    quizState.bonusActive = false;

    quizCountryGuessInput.value = "";
    quizCountryGuessInput.disabled = false;
    quizCapitalGuessInput.value = "";
    quizCapitalGuessInput.disabled = true;
    quizBonusRow.hidden = true;

    quizGeoInputStatus.textContent = "";
    quizGeoInputStatus.classList.remove("error");
    quizGeoFeedback.hidden = true;
    quizGeoFeedback.textContent = "";
    quizGeoFeedback.classList.remove("correct", "wrong");
    quizBonusStatus.textContent = "";
    quizBonusStatus.classList.remove("error");
    quizBonusFeedback.hidden = true;
    quizBonusFeedback.textContent = "";
    quizBonusFeedback.classList.remove("correct", "wrong");
    quizGeoNextBtn.hidden = true;

    quizCountryGuessInput.focus({ preventScroll: true });
  }

  function handleCountryGuess() {
    if (!quizState || quizState.countryAnswered) return;
    const question = quizState.questions[quizState.index];
    const match = matchPoolItem(quizState.geoPool, quizCountryGuessInput.value, "name");

    if (!match) {
      quizGeoInputStatus.textContent = "Pick a country from the suggestions.";
      quizGeoInputStatus.classList.add("error");
      return;
    }
    quizGeoInputStatus.textContent = "";
    quizGeoInputStatus.classList.remove("error");

    quizState.countryAnswered = true;
    quizCountryGuessInput.disabled = true;
    const isCorrect = match.alpha2Code === question.country.alpha2Code;

    quizGeoFeedback.hidden = false;
    if (isCorrect) {
      quizState.score += 1;
      quizScoreText.textContent = `Score: ${quizState.score}`;
      quizGeoFeedback.textContent = "Correct! Bonus round: name the capital.";
      quizGeoFeedback.classList.add("correct");

      quizState.bonusActive = true;
      quizBonusCountryName.textContent = question.country.name;
      quizBonusRow.hidden = false;
      quizCapitalGuessInput.disabled = false;
      // Bring the bonus box fully on screen before focusing so the browser
      // doesn't scroll on its own and the Country answer stays visible.
      quizBonusRow.scrollIntoView({ behavior: "smooth", block: "nearest" });
      quizCapitalGuessInput.focus({ preventScroll: true });
    } else {
      quizGeoFeedback.textContent = `Not quite — the highlighted country is ${question.country.name}.`;
      quizGeoFeedback.classList.add("wrong");
      quizGeoNextBtn.hidden = false;
      quizGeoNextBtn.textContent = quizState.index === quizState.questions.length - 1 ? "See Score" : "Next Question";
      quizGeoNextBtn.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  function handleCapitalGuess() {
    if (!quizState || !quizState.bonusActive) return;
    const question = quizState.questions[quizState.index];
    const match = matchPoolItem(quizState.geoPool, quizCapitalGuessInput.value, "capital");

    if (!match) {
      quizBonusStatus.textContent = "Pick a capital from the suggestions.";
      quizBonusStatus.classList.add("error");
      return;
    }
    quizBonusStatus.textContent = "";
    quizBonusStatus.classList.remove("error");

    quizState.bonusActive = false;
    quizCapitalGuessInput.disabled = true;
    const isBonusCorrect = match.capital === question.country.capital;

    if (isBonusCorrect) {
      quizState.score += 1;
      quizScoreText.textContent = `Score: ${quizState.score}`;
    }

    quizBonusFeedback.hidden = false;
    quizBonusFeedback.textContent = isBonusCorrect
      ? "Correct! +1 bonus point for the capital."
      : `Close — the capital is ${question.country.capital}.`;
    quizBonusFeedback.classList.toggle("correct", isBonusCorrect);
    quizBonusFeedback.classList.toggle("wrong", !isBonusCorrect);

    quizGeoNextBtn.hidden = false;
    quizGeoNextBtn.textContent = quizState.index === quizState.questions.length - 1 ? "See Score" : "Next Question";
    quizGeoNextBtn.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  quizCountryGuessInput.addEventListener("change", handleCountryGuess);
  quizCapitalGuessInput.addEventListener("change", handleCapitalGuess);

  function applyDarkMode(isDark) {
    document.documentElement.classList.toggle("dark", isDark);
    darkModeToggle.setAttribute("aria-pressed", String(isDark));
    darkModeIcon.textContent = isDark ? "☀️" : "🌙";
    exploreGlobe.applyTheme();
    quizGlobe.applyTheme();
  }

  function initDarkMode() {
    const stored = localStorage.getItem(DARK_MODE_KEY);
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = stored === null ? prefersDark : stored === "true";
    applyDarkMode(isDark);
  }

  darkModeToggle.addEventListener("click", () => {
    const isDark = !document.documentElement.classList.contains("dark");
    applyDarkMode(isDark);
    localStorage.setItem(DARK_MODE_KEY, String(isDark));
  });

  initDarkMode();
  loadCountryList();
  showDataDate();
  setView("dropdown");
  setAppSection("explore");
  showQuizScreen("mode");
})();
