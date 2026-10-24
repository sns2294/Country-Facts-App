(() => {
  // Content hash of the data and map files, stamped by scripts/stamp-version.mjs.
  // Added to their URLs so a changed file is never served from an old cache.
  const DATA_VERSION = "add26432";
  const versioned = (url) => `${url}?v=${DATA_VERSION}`;
  const COUNTRIES_URL = versioned("data/countries.json");
  const META_URL = versioned("data/meta.json");
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
  // A touch that moves farther than this is a drag, not a tap (fingers jitter).
  const TAP_SLOP_PX = 10;
  const TAP_MAX_MS = 800;
  const QUIZ_QUESTION_COUNT = 10;
  const REGIONS = ["Europe", "Africa", "Asia", "Americas", "Oceania"];

  let countryNames = [];

  const {
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
    missingGdp,
    getPredominantReligion,
    buildOverview,
  } = window.CountryText;

  function setStatus(message, isError = false) {
    searchStatus.textContent = message;
    searchStatus.classList.toggle("error", isError);
  }


  // All country data is read from local files written by scripts/update-data.mjs.
  // Loaded once; every lookup below works off these in-memory indexes.
  let countryDataPromise = null;
  // alpha2 -> common name. The map and globe files carry their own shape names
  // ("Dem. Rep. Congo", "Falkland Is."), so tooltips use this instead.
  const displayNameByCode = new Map();
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
          countries.forEach((c) => {
            if (c.alpha2Code && c.name) displayNameByCode.set(c.alpha2Code, c.name);
          });
          return { countries, byCode };
        });
      countryDataPromise.catch(() => {
        countryDataPromise = null;
      });
    }
    return countryDataPromise;
  }

  // Case- and accent-insensitive form used to compare typed names ("turkiye"
  // finds Türkiye, "sao tome" finds São Tomé).
  function normalizeName(text) {
    return String(text).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, " ");
  }

  // The common name shown everywhere, then the official and alternate names
  // people may type (data/countries.json: officialName, altNames).
  function otherNames(country) {
    return [country.officialName, ...(country.altNames || [])].filter(Boolean);
  }

  function countryHasName(country, rawValue) {
    const value = normalizeName(rawValue);
    return !!value && [country.name, ...otherNames(country)].some((n) => normalizeName(n) === value);
  }

  // Every country a typed name could mean. A common name wins outright ("Niger");
  // otherwise all countries with that official or alternate name match, so a
  // name two countries share ("Congo") returns both.
  function findCountriesByName(countries, rawValue) {
    const common = countries.filter((c) => normalizeName(c.name) === normalizeName(rawValue));
    return common.length ? common : countries.filter((c) => countryHasName(c, rawValue));
  }

  // <option>s for a country search list: common names only. Official and
  // alternate names still work when typed in full.
  function buildNameOptions(countries) {
    const esc = (t) => t.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
    return countries
      .map((c) => c.name)
      .sort((a, b) => a.localeCompare(b))
      .map((name) => `<option value="${esc(name)}"></option>`)
      .join("");
  }

  // "Congo" could be DR Congo or the Republic of the Congo: "DR Congo or Republic of the Congo".
  function joinNames(names) {
    return names.length > 2 ? `${names.slice(0, -1).join(", ")}, or ${names.at(-1)}` : names.join(" or ");
  }

  async function getCountries() {
    return (await loadCountryData()).countries.filter((c) => c && c.name);
  }

  async function findCountryByCode(code) {
    const { byCode } = await loadCountryData();
    return byCode.get(String(code).toUpperCase()) || null;
  }

  // Bordering countries as chips. A territory's land neighbours count for its
  // parent too, marked "via <territory>" (France borders Brazil and Suriname
  // via French Guiana). A neighbour that is itself a territory counts as its
  // parent (Saint Martin's border with Sint Maarten is France's border with the
  // Netherlands).
  async function getBorderCountries(country) {
    const { countries, byCode } = await loadCountryData();
    const chips = (country.borders || [])
      .map((code) => byCode.get(code))
      .filter(Boolean)
      .map((c) => ({ code: c.alpha3Code, name: c.name }));
    const listed = new Set([country.alpha3Code, ...chips.map((c) => c.code)]);
    countries
      .filter((t) => t.parent?.of === country.alpha3Code)
      .forEach((territory) => {
        (territory.borders || []).forEach((code) => {
          const neighbour = byCode.get(code);
          if (!neighbour) return;
          const target = (neighbour.parent && byCode.get(neighbour.parent.of)) || neighbour;
          if (listed.has(target.alpha3Code)) return;
          listed.add(target.alpha3Code);
          chips.push({ code: target.alpha3Code, name: target.name, via: territory.name.replace(/\s*\(.*\)/, "") });
        });
      });
    return chips;
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

  // Same slug the static country pages are built under (scripts/build-pages.mjs).
  function pageSlug(country) {
    return getBorderDisplayName(country.name)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
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
                )}${b.via ? ` <span class="chip-via">via ${b.via}</span>` : ""}</button>`
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
          ${country.parent?.note ? `<p class="parent-note">${country.parent.note}</p>` : ""}
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
            <dd>${formatRegion(country)}</dd>
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
            <dd>${formatReligions(country.religions, country)}</dd>
          </div>
          <div class="stat">
            <dt>Currency</dt>
            <dd>${formatCurrencies(getCurrencies(country))}</dd>
          </div>
          <div class="stat">
            <dt>GDP</dt>
            <dd>${gdp ? formatGdp(gdp) : missingGdp(country)}${gdp ? ` <span class="stat-note">(${gdp.year})</span>` : ""}</dd>
          </div>
        </dl>
        ${bordersMarkup}
        <p class="overview">${buildOverview(country)}</p>
        ${
          country.sovereign
            ? `<a class="full-page-link" href="country/${pageSlug(country)}/">Full page for ${getBorderDisplayName(country.name)} &rarr;</a>`
            : ""
        }
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

      countryList.innerHTML = buildNameOptions(countries);

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
      exploreGlobe.highlight(selectedCode, { moveCamera: recenter });
    } else {
      exploreGlobe.clearHighlight();
    }
  }

  function clearSelection() {
    selectedCode = null;
    syncSelection();
  }

  // Tapping empty ocean on a touch screen clears the pick, fact card included.
  function clearSelectionAndCard() {
    latestSelection += 1;
    countryInput.value = "";
    factCard.hidden = true;
    shownCountryName = null;
    clearSelection();
  }

  async function showCountryData(country, selection, { recenter = false } = {}) {
    const borderCountries = await getBorderCountries(country);
    if (selection !== latestSelection) return;
    renderCountry(country, borderCountries);
    selectedCode = country.alpha2Code;
    syncSelection({ recenter });
    scrollIntoViewOnPhone(factCard);
    shownCountryName = country.name;
    setStatus(`Showing facts for ${country.name}.`);
  }

  // The typed name fits more than one country: ask which, with a button each.
  function showSearchChoices(typed, matches) {
    setStatus(`"${typed}" could be ${joinNames(matches.map((c) => c.name))}. Pick one: `);
    matches.forEach((c) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "status-choice";
      btn.textContent = c.name;
      // Keep focus in the input: a blur fires "change", which would rebuild
      // these buttons before the click lands.
      btn.addEventListener("mousedown", (evt) => evt.preventDefault());
      btn.addEventListener("click", () => {
        countryInput.value = c.name;
        selectCountry(c.name);
      });
      searchStatus.append(btn);
    });
  }

  async function selectCountry(rawName) {
    const name = rawName.trim();
    if (!name) return;

    let countries;
    try {
      countries = await getCountries();
    } catch (err) {
      setStatus("Couldn't load the country data. Reload the page and try again.", true);
      console.error("Failed to load country:", err);
      return;
    }

    // Matches the common name, or the official/alternate name ("Russian Federation").
    const matches = findCountriesByName(countries, name);
    if (matches.length > 1) {
      showSearchChoices(name, matches);
      factCard.hidden = true;
      shownCountryName = null;
      clearSelection();
      return;
    }
    const country = matches[0];
    if (!country) {
      setStatus(`"${name}" isn't in the country list — pick one from the suggestions.`, true);
      factCard.hidden = true;
      shownCountryName = null;
      clearSelection();
      return;
    }
    const match = country.name;
    countryInput.value = match;

    // Already showing it (e.g. the input blurred mid-click on a border chip):
    // re-rendering would replace the card the user is interacting with.
    if (match === shownCountryName && !factCard.hidden) return;

    const selection = ++latestSelection;
    setStatus(`Loading ${match}…`);
    try {
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
      mapMarkupPromise = fetch(versioned("world-map.svg")).then((res) => {
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
    // Several shapes can carry one country's id (Ashmore and Cartier Is. shares
    // Australia's). Fold them into the first so a country is one path.
    const firstPathById = new Map();
    svg.querySelectorAll("path.country[id]").forEach((path) => {
      const first = firstPathById.get(path.id);
      if (!first) {
        firstPathById.set(path.id, path);
        return;
      }
      first.setAttribute("d", first.getAttribute("d") + path.getAttribute("d"));
      path.remove();
    });
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
    onEmptyTap = null,
  }) {
    let loaded = false;
    // Phones emulate mouse events after a touch; those must not count as hover.
    let lastTouchAt = -Infinity;
    const recentTouch = () => performance.now() - lastTouchAt < 1000;
    ["touchstart", "touchend"].forEach((type) =>
      container.addEventListener(type, () => (lastTouchAt = performance.now()), { capture: true, passive: true })
    );
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
            if (!dragged && Math.hypot(dx, dy) < TAP_SLOP_PX) return;
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

      // A tap on empty ocean (not a country, hit circle or button) clears the pick.
      container.addEventListener("click", (evt) => {
        if (!onEmptyTap || !recentTouch()) return;
        if (evt.target.closest("path.country, circle.hit-target, .map-controls, button")) return;
        onEmptyTap();
      });

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
          if (recentTouch()) return;
          path.classList.add("hovered");
          showTooltip(displayNameByCode.get(path.id) || path.dataset.name);
        });
        path.addEventListener("mousemove", (evt) => {
          if (!recentTouch()) positionTooltip(evt);
        });
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
          if (recentTouch()) return;
          circle.classList.add("active");
          if (realPath) realPath.classList.add("hovered");
          showTooltip(displayNameByCode.get(code) || circle.dataset.name);
        });
        circle.addEventListener("mousemove", (evt) => {
          if (!recentTouch()) positionTooltip(evt);
        });
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
      const circles = svg.querySelectorAll(`circle.hit-target[data-code="${code}"]`);
      if (path) path.classList.add("selected");
      circles.forEach((circle) => circle.classList.add("selected"));
      if (!recenter) return;

      let cx;
      let cy;
      if (!path && circles.length) {
        cx = Number(circles[0].getAttribute("cx"));
        cy = Number(circles[0].getAttribute("cy"));
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
    onEmptyTap: clearSelectionAndCard,
  });

  // --- 3D globe view (globe.gl, loaded via CDN) ---
  // Country polygon data + the ISO numeric<->alpha2 lookup are fetched once
  // and shared by every Globe() instance (Explore's and the quiz's) rather
  // than being re-fetched per instance.
  const GLOBE_GEO_URL = versioned("data/countries-50m.json");
  const GLOBE_FULL_GEO_URL = versioned("data/countries-50m-full.json");
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
  // A country is small when its biggest landmass is under this many degrees
  // across (about 280 km): a measure of the land itself, so a pull-back can't
  // change it and remote outlying islands can't skew it. Small countries are
  // pulled back until larger land shows, circled with an open ring and, where
  // an island would be too small to see, marked with a dot.
  const SMALL_LANDMASS_DEGREES = 2.5;
  const SMALL_COUNTRY_NEIGHBOURHOOD_SPAN = 14; // degrees across the close-up view
  const ISLAND_VISIBLE_PX = 4; // an island under this on screen is too small to see
  const ISLAND_DOT_MAX_COUNT = 80;
  // Small countries are framed so land other than themselves is in view: at
  // least this many landmasses of larger countries, each reaching inside
  // LANDMARK_FIT_FILL of the way to the frame's edge.
  const SMALL_COUNTRY_LANDMASSES_SHOWN = 4;
  const LANDMARK_FIT_FILL = 0.85;
  const LANDMARK_MIN_RING_POINTS = 150;
  // Landmark context never zooms out past this altitude (the globe still shows its curve).
  const LANDMARK_MAX_ALTITUDE = 1.2;
  const MARKER_MIN_PX = 26;
  const MARKER_PAD_PX = 24;
  // The ring fades out once it is wider or taller than this share of the globe's width.
  const MARKER_FADE_GLOBE_RATIO = 0.85;
  const MARKER_ALTITUDE = 0.03; // globe.gl altitude the ring and dots float at
  // The ring fades out once it is wider or taller than this many frames.
  const MARKER_FADE_FRAME_RATIO = 1.2;
  // A pulsing ring only makes sense on a country narrower than this (degrees).
  const PULSE_MAX_SPAN = 10;
  // Share of the camera's half field of view a country may fill (the rest is margin).
  const COUNTRY_FIT_FILL = 0.78;
  // Extra camera altitude, on top of the tight fit, that shows a country's surroundings.
  const COUNTRY_CONTEXT_ALTITUDE = 0.5;
  const GLOBE_CAMERA_FOV = 50; // globe.gl's default vertical field of view, degrees

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
    // Several shapes can carry one country's id (Ashmore and Cartier Is. shares
    // Australia's). Fold them into the first so a country is always one feature
    // for highlighting, framing and hover.
    const indicesById = new Map();
    features.forEach((feature, i) => {
      if (mergedAway.has(i) || !feature.id) return;
      if (!indicesById.has(feature.id)) indicesById.set(feature.id, []);
      indicesById.get(feature.id).push(i);
    });
    indicesById.forEach((indices) => {
      if (indices.length < 2) return;
      const merged = topojson.merge(topology, indices.map((i) => geometries[i]));
      features[indices[0]] = { ...features[indices[0]], geometry: merged };
      indices.slice(1).forEach((i) => mergedAway.add(i));
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

  // Where a lat/lng falls on screen when the camera looks straight down at
  // (povLat, povLng) from `distance` globe radii away (north up). Returns the
  // tangent of its angle off the camera axis, sideways (tx) and upwards (ty),
  // and z, how far toward the camera it sits (z <= 1/distance is round the back).
  function projectToView(lat, lng, povLat, povLng, distance) {
    const rad = Math.PI / 180;
    const dLng = (lng - povLng) * rad;
    const x = Math.cos(lat * rad) * Math.sin(dLng);
    const y = Math.cos(povLat * rad) * Math.sin(lat * rad) - Math.sin(povLat * rad) * Math.cos(lat * rad) * Math.cos(dLng);
    const z = Math.sin(povLat * rad) * Math.sin(lat * rad) + Math.cos(povLat * rad) * Math.cos(lat * rad) * Math.cos(dLng);
    return { tx: x / (distance - z), ty: y / (distance - z), z };
  }

  // Smallest camera distance (globe radii) at which a point sits inside the
  // frame, within `fill` of the way from the centre to the tighter edge of a
  // frame `aspect` (width/height) wide. Infinity if it can't be shown.
  function distanceToShow(lat, lng, povLat, povLng, aspect, fill) {
    const rad = Math.PI / 180;
    const dLng = (lng - povLng) * rad;
    const x = Math.cos(lat * rad) * Math.sin(dLng);
    const y = Math.cos(povLat * rad) * Math.sin(lat * rad) - Math.sin(povLat * rad) * Math.cos(lat * rad) * Math.cos(dLng);
    const z = Math.sin(povLat * rad) * Math.sin(lat * rad) + Math.cos(povLat * rad) * Math.cos(lat * rad) * Math.cos(dLng);
    if (z <= 0) return Infinity;
    const halfV = Math.tan((GLOBE_CAMERA_FOV / 2) * rad) * fill;
    // The point is on the near side of the globe only while z > 1 / distance.
    return Math.max(1 / z, z + Math.max(Math.abs(x) / (halfV * aspect), Math.abs(y) / halfV));
  }

  // The points of a bounding box that bound it on screen: corners, edge midpoints.
  function bboxProbePoints(box) {
    const pts = [];
    [-0.5, 0, 0.5].forEach((fx) =>
      [-0.5, 0, 0.5].forEach((fy) => {
        pts.push([box.centerLat + fy * box.latSpan, box.centerLng + fx * box.lngSpan]);
      })
    );
    return pts;
  }

  // Camera altitude that shows a whole bounding box, centred, with margin: the
  // tighter of the frame's two dimensions decides (usually its height).
  function altitudeToFit(box, aspect, fill = COUNTRY_FIT_FILL) {
    const d = Math.max(...bboxProbePoints(box).map(([lat, lng]) => distanceToShow(lat, lng, box.centerLat, box.centerLng, aspect, fill)));
    return d - 1;
  }

  // Altitude at which real land other than the target is on screen: the nearest
  // `minLandmasses` landmasses (outlines of at least LANDMARK_MIN_RING_POINTS
  // points, so specks of islands don't count) each have their middle inside the frame.
  function altitudeToShowLand(box, landmarkFeatures, aspect, minLandmasses) {
    const needed = [];
    landmarkFeatures.forEach((feature) => {
      const geom = feature?.geometry;
      const rings = !geom ? [] : geom.type === "Polygon" ? geom.coordinates : geom.type === "MultiPolygon" ? geom.coordinates.flat() : [];
      rings.forEach((ring) => {
        if (ring.length < LANDMARK_MIN_RING_POINTS) return;
        // Judged by the landmass's middle, so most of it is on screen, not just a corner.
        const lat = ring.reduce((sum, pt) => sum + pt[1], 0) / ring.length;
        const lng = ring.reduce((sum, pt) => sum + pt[0], 0) / ring.length;
        const d = distanceToShow(lat, lng, box.centerLat, box.centerLng, aspect, LANDMARK_FIT_FILL);
        if (isFinite(d)) needed.push(d);
      });
    });
    if (!needed.length) return 0;
    needed.sort((p, q) => p - q);
    return needed[Math.min(minLandmasses, needed.length) - 1] - 1;
  }

  // Size in pixels of an open ring drawn round a bounding box (an ellipse, so a
  // wide island chain gets a wide ring), for a frame `width` x `height` px.
  // The ring keeps the box's proportions but is stretched until every one of
  // `points` ([lat, lng], e.g. each island's corners) falls inside it, so
  // islands in the corners of the box aren't left outside. With `screen`
  // (lat, lng -> {x, y} on screen, or null if out of sight) the islands are
  // placed where the camera really sees them, wherever it has been panned to;
  // without it they are judged as seen from straight above the box's centre.
  function markerSizePx(box, points, altitude, width, height, screen = null, padPx = MARKER_PAD_PX, minPx = MARKER_MIN_PX) {
    const distance = 1 + altitude;
    const pxPerTan = height / 2 / Math.tan((GLOBE_CAMERA_FOV / 2) * (Math.PI / 180));
    const east = projectToView(box.centerLat, box.centerLng + box.lngSpan / 2, box.centerLat, box.centerLng, distance);
    const north = projectToView(box.centerLat + box.latSpan / 2, box.centerLng, box.centerLat, box.centerLng, distance);
    const halfW = Math.max(minPx / 2, Math.abs(east.tx) * pxPerTan);
    const halfH = Math.max(minPx / 2, Math.abs(north.ty) * pxPerTan);
    const middle = screen && screen(box.centerLat, box.centerLng);
    let scale = 1;
    points.forEach(([lat, lng]) => {
      let dx;
      let dy;
      if (middle) {
        const p = screen(lat, lng);
        if (!p) return;
        dx = p.x - middle.x;
        dy = p.y - middle.y;
      } else {
        const p = projectToView(lat, lng, box.centerLat, box.centerLng, distance);
        dx = p.tx * pxPerTan;
        dy = p.ty * pxPerTan;
      }
      scale = Math.max(scale, Math.hypot(dx / halfW, dy / halfH));
    });
    return { w: 2 * halfW * scale + padPx, h: 2 * halfH * scale + padPx };
  }

  // The corners of every landmass's bounding box: what the open ring must enclose.
  function landmassCorners(feature) {
    return landmassBoxes(feature).flatMap((b) =>
      [-0.5, 0.5].flatMap((fx) => [-0.5, 0.5].map((fy) => [b.centerLat + fy * b.latSpan, b.centerLng + fx * b.lngSpan]))
    );
  }

  // Bounding boxes of a country's separate landmasses (outer rings of its
  // polygons), biggest first.
  function landmassBoxes(feature) {
    const geom = feature?.geometry;
    const polygons = !geom ? [] : geom.type === "Polygon" ? [geom.coordinates] : geom.type === "MultiPolygon" ? geom.coordinates : [];
    return polygons
      .map(([outer]) => getFeatureSetBBox([{ geometry: { type: "Polygon", coordinates: [outer] } }]))
      .filter(Boolean)
      .sort((p, q) => q.latSpan * q.lngSpan - p.latSpan * p.lngSpan);
  }

  // Whether a country's land is small: its biggest landmass is under
  // SMALL_LANDMASS_DEGREES across.
  function hasSmallLand(feature, box) {
    const biggest = landmassBoxes(feature)[0] || box;
    return Math.max(biggest.latSpan, biggest.lngSpan) < SMALL_LANDMASS_DEGREES;
  }

  // A dot for each island too small to see at this zoom (the others show their
  // real shape), drawn as a round page element (see .geo-dot).
  function islandDots(feature, altitude, height) {
    const pxPerTan = height / 2 / Math.tan((GLOBE_CAMERA_FOV / 2) * (Math.PI / 180));
    const pxPerDegree = (pxPerTan * (Math.PI / 180)) / altitude;
    return landmassBoxes(feature)
      .filter((box) => Math.max(box.latSpan, box.lngSpan) * pxPerDegree < ISLAND_VISIBLE_PX)
      .slice(0, ISLAND_DOT_MAX_COUNT)
      .map((box) => ({ kind: "dot", lat: box.centerLat, lng: box.centerLng }));
  }

  // The starting view for a country in a `width` x `height` px frame: the whole
  // country, centred, fitted to the frame's tighter side with margin and a little
  // of its surroundings. With `markSmall`, a small country (see
  // SMALL_LANDMASS_DEGREES) is pulled back until larger land (`otherFeatures`) shows too.
  function frameCountry(feature, otherFeatures, width, height, markSmall) {
    const box = getFeatureSetBBox([feature]);
    if (!box) return null;
    const aspect = width && height ? width / height : 1.5;
    const fit = altitudeToFit(box, aspect);
    const span = clamp(Math.max(box.lngSpan, box.latSpan * 2) * COUNTRY_FRAME_PADDING, COUNTRY_FRAME_MIN_SPAN, Infinity);
    let altitude = Math.max(Math.min(altitudeForSpan(span), fit + COUNTRY_CONTEXT_ALTITUDE), fit);
    let small = false;
    if (markSmall) small = hasSmallLand(feature, box);
    if (small) {
      altitude = Math.max(altitude, altitudeForSpan(SMALL_COUNTRY_NEIGHBOURHOOD_SPAN));
      const landAltitude = altitudeToShowLand(box, otherFeatures, aspect, SMALL_COUNTRY_LANDMASSES_SHOWN);
      altitude = Math.max(altitude, Math.min(landAltitude, LANDMARK_MAX_ALTITUDE));
    }
    altitude = clamp(altitude, GLOBE_MIN_ALTITUDE, GLOBE_MAX_ALTITUDE);
    return { box, altitude, small };
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
    onEmptyTap = null,
  }) {
    let globe = null;
    // Touch never hovers (the highlight would stick after lifting a finger) and
    // only selects on a real tap: a short press that barely moved.
    let touchInput = false;
    let tap = null;
    let tapHandled = false;
    let suppressTouchClick = false;
    const activeTouches = new Set();
    container.addEventListener(
      "pointerdown",
      (evt) => {
        touchInput = evt.pointerType === "touch";
        container.classList.toggle("touch-input", touchInput);
        if (!touchInput) return;
        activeTouches.add(evt.pointerId);
        if (activeTouches.size > 1) {
          // A second finger makes it a pinch: never a tap, and no synthetic
          // events, which the camera controls would read as a third finger.
          if (tap) tap.ok = false;
          return;
        }
        tap = { x: evt.clientX, y: evt.clientY, t: performance.now(), ok: true };
        // The globe only knows what is under the pointer from pointermove,
        // which a plain tap may never send, so give it one at the tap point
        // (under this finger's own id so the controls see no new pointer).
        const canvas = container.querySelector("canvas");
        if (canvas) {
          canvas.dispatchEvent(
            new PointerEvent("pointermove", {
              pointerId: evt.pointerId,
              pointerType: "touch",
              isPrimary: evt.isPrimary,
              clientX: evt.clientX,
              clientY: evt.clientY,
              bubbles: true,
            })
          );
        }
        if (hoverFeature) {
          hoverFeature = null;
          refreshPolygonStyles();
        }
      },
      true
    );
    container.addEventListener(
      "pointermove",
      (evt) => {
        if (evt.pointerType === "mouse" || evt.pointerType === "pen") {
          touchInput = false;
          container.classList.remove("touch-input");
        }
        if (tap && Math.hypot(evt.clientX - tap.x, evt.clientY - tap.y) > TAP_SLOP_PX) tap.ok = false;
      },
      true
    );
    function endTouch(evt) {
      if (evt.pointerType !== "touch") return;
      activeTouches.delete(evt.pointerId);
      if (activeTouches.size > 0 || !tap) return;
      const isTap = evt.type === "pointerup" && tap.ok && performance.now() - tap.t < TAP_MAX_MS;
      tap = null;
      tapHandled = false;
      if (!isTap) {
        touchInput = true;
        suppressTouchClick = true;
        return;
      }
      suppressTouchClick = false;
      // The polygon click, if any, fires right after pointerup; if none did,
      // the tap landed on empty ocean or space.
      setTimeout(() => {
        if (!tapHandled && onEmptyTap) onEmptyTap();
        tapHandled = false;
      }, 60);
    }
    container.addEventListener("pointerup", endTouch, true);
    container.addEventListener("pointercancel", endTouch, true);
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
    // The quiz's open ring (sized to the country, rescaled as the globe zooms) and
    // the dots on islands too small to see (refreshed after a zoom).
    let markerBox = null;
    let markerPoints = [];
    let markerEls = new Set();
    let dotsFeature = null;
    let ringDatum = null;
    let dotData = [];
    let dotsTimer = null;
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
        .polygonSideColor((d) => ((canon.get(d) || d) === targetFeature ? targetColor : fillColor))
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
      if (touchInput) {
        if (suppressTouchClick) return;
        tapHandled = true;
      }
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
          .htmlElementsData([])
          .htmlAltitude(MARKER_ALTITUDE)
          .htmlElement((d) => {
            const el = document.createElement("div");
            // Dots are flat page elements, so they stay round from any angle.
            if (d.kind === "dot") {
              el.className = "geo-dot";
              return el;
            }
            el.className = "geo-marker";
            el.style.width = `${d.w}px`;
            el.style.height = `${d.h}px`;
            markerEls.add(el);
            return el;
          })
          .ringAltitude(0.02)
          .ringMaxRadius(3.5)
          .ringPropagationSpeed(2.5)
          .ringRepeatPeriod(1400);

        if (enableCountryInteraction) {
          globe
            .polygonLabel(({ id, properties }) => {
              if (touchInput) return "";
              const code = id && numericToAlpha2.get(id);
              return (code && displayNameByCode.get(code)) || (properties && properties.name) || "";
            })
            .onPolygonHover((feat) => {
              if (touchInput) feat = null;
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
        globe.onZoom(({ altitude }) => {
          updateMarker(altitude);
          clearTimeout(dotsTimer);
          dotsTimer = setTimeout(() => refreshDots(globe.pointOfView().altitude), 150);
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

    // Rescales the open ring to the globe's current zoom, so it keeps hugging the
    // country, and fades it out once it would outgrow the frame.
    function updateMarker(altitude) {
      if (!markerBox || !markerEls.size) return;
      const rect = container.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const pov = globe.pointOfView();
      const distance = 1 + altitude;
      const screen = (lat, lng) =>
        projectToView(lat, lng, pov.lat, pov.lng, distance).z > 1 / distance ? globe.getScreenCoords(lat, lng, MARKER_ALTITUDE) : null;
      const { w, h } = markerSizePx(markerBox, markerPoints, altitude, rect.width, rect.height, screen);
      // The globe's width on screen: a ring this close to it no longer says anything.
      const pxPerTan = rect.height / 2 / Math.tan((GLOBE_CAMERA_FOV / 2) * (Math.PI / 180));
      const globeWidth = (2 * pxPerTan) / Math.sqrt(distance * distance - 1);
      const outgrown =
        w > rect.width * MARKER_FADE_FRAME_RATIO ||
        h > rect.height * MARKER_FADE_FRAME_RATIO ||
        Math.max(w, h) > globeWidth * MARKER_FADE_GLOBE_RATIO;
      markerEls.forEach((el) => {
        el.style.width = `${w}px`;
        el.style.height = `${h}px`;
        el.style.opacity = outgrown ? "0" : "1";
      });
    }

    // The open ring and the island dots are all page elements floating on the globe.
    function syncOverlay() {
      globe.htmlElementsData(ringDatum ? [ringDatum, ...dotData] : dotData);
    }

    // Dots for the highlighted country's islands too small to see at this zoom.
    function refreshDots(altitude) {
      if (!globe || !dotsFeature) return;
      const rect = container.getBoundingClientRect();
      if (!rect.height) return;
      dotData = islandDots(dotsFeature, altitude, rect.height);
      syncOverlay();
    }

    // Highlights a country and (with `moveCamera`) flies to its starting view,
    // see frameCountry(). In the quiz (`markSmall`) a small country also gets an
    // open ring sized to all of it, and a dot on each island too small to see.
    function highlight(code, { transitionMs = 600, moveCamera = true, markSmall = false } = {}) {
      if (!globe) return;
      const feature = alpha2ToFeature.get(code);
      if (!feature) return;
      targetFeature = feature;
      refreshPolygonStyles();

      // The panel may have been hidden when the globe was created, so make sure
      // the canvas matches it before fitting anything to its shape.
      resize();
      const rect = container.getBoundingClientRect();
      const frame = frameCountry(feature, markSmall ? features.filter((f) => f !== feature) : [], rect.width, rect.height, markSmall);
      if (!frame) return;
      const { box, altitude, small } = frame;
      if (moveCamera) globe.pointOfView({ lat: box.centerLat, lng: box.centerLng, altitude }, transitionMs);
      const shownAltitude = moveCamera ? altitude : globe.pointOfView().altitude;
      const center = { lat: box.centerLat, lng: box.centerLng };
      // The quiz has the open ring instead of the pulsing one.
      globe.ringsData(!markSmall && Math.max(box.latSpan, box.lngSpan) < PULSE_MAX_SPAN ? [center] : []);
      markerEls.clear();
      markerBox = small && rect.width ? box : null;
      markerPoints = markerBox ? landmassCorners(feature) : [];
      const marker = markerBox && markerSizePx(box, markerPoints, shownAltitude, rect.width, rect.height);
      ringDatum = marker ? { kind: "ring", ...center, ...marker } : null;
      // Islands too small to see get a dot in Explore as well as the quiz.
      dotsFeature = hasSmallLand(feature, box) ? feature : null;
      dotData = dotsFeature && rect.height ? islandDots(feature, shownAltitude, rect.height) : [];
      syncOverlay();
      // The camera is still flying in; settle the ring on where it ends up.
      if (moveCamera) setTimeout(() => globe && updateMarker(globe.pointOfView().altitude), transitionMs + 50);
    }

    function clearHighlight() {
      targetFeature = null;
      if (!globe) return;
      globe.ringsData([]);
      ringDatum = null;
      dotData = [];
      syncOverlay();
      markerBox = null;
      dotsFeature = null;
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
    onEmptyTap: clearSelectionAndCard,
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

  // Repeat avoidance. The countries asked recently are remembered in the
  // browser per mode and scope (a region, or "all"), most recent first, and the
  // next quiz favours countries outside that memory. Only as much as the pool
  // can spare is remembered (see recentCap), so a small pool never runs dry:
  // once the unseen countries run low, the longest-unseen fill in.
  const RECENT_STORAGE_PREFIX = "quizRecent:";
  const RECENT_QUIZ_COUNT = 3;
  // Of the countries a pool has beyond one quiz's worth, this share may be
  // remembered; the rest stay unremembered so each quiz still has a real choice.
  const RECENT_SPARE_SHARE = 0.75;

  function recentCap(poolSize) {
    const spare = Math.max(0, poolSize - QUIZ_QUESTION_COUNT);
    return Math.min(RECENT_QUIZ_COUNT * QUIZ_QUESTION_COUNT, Math.floor(spare * RECENT_SPARE_SHARE));
  }

  function loadRecent(key) {
    try {
      const stored = JSON.parse(localStorage.getItem(RECENT_STORAGE_PREFIX + key));
      return Array.isArray(stored) ? stored.filter((code) => typeof code === "string") : [];
    } catch (err) {
      return [];
    }
  }

  function saveRecent(key, codes) {
    try {
      const merged = [...new Set([...codes, ...loadRecent(key)])].slice(0, RECENT_QUIZ_COUNT * QUIZ_QUESTION_COUNT);
      localStorage.setItem(RECENT_STORAGE_PREFIX + key, JSON.stringify(merged));
    } catch (err) {
      // Storage unavailable (private window, blocked): quizzes just don't remember.
    }
  }

  // The pool in the order to ask it: countries not asked recently first, in
  // random order, then the recent ones, longest ago first.
  function recencyOrder(pool, key) {
    const recent = loadRecent(key).slice(0, recentCap(pool.length));
    const position = new Map(recent.map((code, i) => [code, i]));
    const fresh = shuffleArray(pool.filter((c) => !position.has(c.alpha2Code)));
    const stale = pool.filter((c) => position.has(c.alpha2Code)).sort((p, q) => position.get(q.alpha2Code) - position.get(p.alpha2Code));
    return [...fresh, ...stale];
  }

  // Notes the countries a freshly built quiz asks, under each question's `recentKey`.
  function rememberQuestions(questions) {
    const byKey = new Map();
    questions.forEach((q) => {
      const code = q.code || q.country?.alpha2Code;
      if (!q.recentKey || !code) return;
      if (!byKey.has(q.recentKey)) byKey.set(q.recentKey, []);
      byKey.get(q.recentKey).push(code);
    });
    byKey.forEach((codes, key) => saveRecent(key, codes));
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
      code: item.alpha2Code,
      promptType: mode.promptType,
      promptLabel: mode.promptLabel,
      prompt: mode.getPrompt(item),
      correctAnswer,
      options: shuffleArray([correctAnswer, ...wrongAnswers.slice(0, 3)]),
    };
  }

  function buildQuizQuestions(pool, mode, recentKey) {
    const ordered = recencyOrder(pool, recentKey);
    const picks = [];
    for (let i = 0; i < QUIZ_QUESTION_COUNT; i++) {
      picks.push(ordered[i % ordered.length]);
    }
    return picks.map((item) => ({ ...buildOneMcqQuestion(item, pool, mode), recentKey }));
  }

  function buildOneGeoQuestion(country) {
    return { kind: "geography", country };
  }

  function buildGeoQuestions(pool, recentKey) {
    const ordered = recencyOrder(pool, recentKey);
    const picks = [];
    for (let i = 0; i < QUIZ_QUESTION_COUNT; i++) {
      picks.push(ordered[i % ordered.length]);
    }
    return picks.map((country) => ({ ...buildOneGeoQuestion(country), recentKey }));
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
        return countries.filter((c) => c.languages?.length && LanguageQuiz.isInhabited(c));
      },
      getPrompt: (c) => c.name,
      getAnswer: (c) => LanguageQuiz.primaryLanguage(c),
      buildQuestions: (pool, order) => LanguageQuiz.buildLanguageQuestions(pool, QUIZ_QUESTION_COUNT, order),
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

    // Each kind draws down its own recency-ordered list, so a quiz doesn't
    // repeat a country within a kind either.
    const orders = new Map();
    const nextOf = (kind, pool) => {
      if (!orders.has(kind)) orders.set(kind, { list: recencyOrder(pool, `${kind}:all`), used: 0 });
      const order = orders.get(kind);
      return order.list[order.used++ % order.list.length];
    };

    const questions = [];
    for (let i = 0; i < QUIZ_QUESTION_COUNT; i++) {
      const kind = kinds[Math.floor(Math.random() * kinds.length)];
      if (kind === "geography") {
        questions.push({ ...buildOneGeoQuestion(nextOf(kind, geoPool)), recentKey: `${kind}:all` });
      } else {
        const pool = mcqPools[kind];
        questions.push({ ...buildOneMcqQuestion(nextOf(kind, pool), pool, QUIZ_MODES[kind]), recentKey: `${kind}:all` });
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
        rememberQuestions(questions);
      } else {
        const mode = QUIZ_MODES[modeKey];
        const pool = await mode.preparePool();
        if (pool.length < 4) {
          quizStatus.textContent = `Not enough data to run the ${mode.label} quiz right now. Try another mode.`;
          quizStatus.classList.add("error");
          return;
        }
        const recentKey = `${modeKey}:all`;
        questions = mode.buildQuestions
          ? mode.buildQuestions(pool, (list) => recencyOrder(list, recentKey)).map((q) => ({ ...q, recentKey }))
          : buildQuizQuestions(pool, mode, recentKey);
        rememberQuestions(questions);
      }

      if (geoPool && geoPool.length) {
        const capitalsInPool = Array.from(new Set(geoPool.map((c) => c.capital))).sort((a, b) => a.localeCompare(b));
        quizCountryGuessList.innerHTML = buildNameOptions(geoPool);
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

      const capitalsInRegion = Array.from(new Set(pool.map((c) => c.capital))).sort((a, b) => a.localeCompare(b));
      quizCountryGuessList.innerHTML = buildNameOptions(pool);
      populateDatalist(quizCapitalGuessList, capitalsInRegion);

      const questions = buildGeoQuestions(pool, `geography:${region}`);
      rememberQuestions(questions);
      quizState = {
        region,
        geoPool: pool,
        questions,
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
    quizGlobe.highlight(question.country.alpha2Code, { markSmall: true });

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

    if (!isPhone()) quizCountryGuessInput.focus({ preventScroll: true });
  }

  function handleCountryGuess() {
    if (!quizState || quizState.countryAnswered) return;
    const question = quizState.questions[quizState.index];
    const matches = findCountriesByName(quizState.geoPool, quizCountryGuessInput.value);
    if (matches.length > 1) {
      quizGeoInputStatus.textContent = `"${quizCountryGuessInput.value.trim()}" could be ${joinNames(matches.map((c) => c.name))}. Pick one from the suggestions.`;
      quizGeoInputStatus.classList.add("error");
      return;
    }
    const match = matches[0];

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
      if (!isPhone()) quizCapitalGuessInput.focus({ preventScroll: true });
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

  // Custom suggestion list for the quiz answer boxes. The native <datalist>
  // popup can't be repositioned, so it got clipped at the bottom of the screen
  // and re-laid itself out while the page scrolled (the flicker). This one
  // opens below the box, scrolling the page so it fits without covering the globe.
  // Phones get a swipeable row of buttons under the box instead of a dropdown,
  // so the map stays visible above the keyboard.
  const touchPhoneQuery = window.matchMedia("(pointer: coarse) and (max-width: 820px)");
  const isPhone = () => touchPhoneQuery.matches;

  function attachSuggestions(input, datalist) {
    input.removeAttribute("list");
    const strip = document.createElement("div");
    strip.className = "suggestion-strip";
    strip.hidden = true;
    input.insertAdjacentElement("afterend", strip);
    const listEl = document.createElement("ul");
    listEl.className = "quiz-suggestions";
    listEl.setAttribute("role", "listbox");
    listEl.hidden = true;
    document.body.appendChild(listEl);
    let items = [];
    let active = -1;
    let renderedKey = null;

    const setActive = (i) => {
      if (items[active]) items[active].classList.remove("active");
      active = i;
      if (items[active]) {
        items[active].classList.add("active");
        items[active].scrollIntoView({ block: "nearest" });
      }
    };

    const GAP = 4;
    const MARGIN = 8;
    const MAX_ROWS = 5;

    function viewport() {
      const vv = window.visualViewport;
      return { top: vv ? vv.offsetTop : 0, bottom: (vv ? vv.offsetTop + vv.height : window.innerHeight), left: vv ? vv.offsetLeft : 0 };
    }

    function listHeight() {
      const row = items[0] ? items[0].offsetHeight : 28;
      return Math.min(listEl.scrollHeight, row * MAX_ROWS + 8);
    }

    // The list always opens below the box. Scroll the page just enough that
    // the whole list fits under it, but never so far that the globe's top
    // edge leaves the screen.
    function ensureRoom() {
      if (listEl.hidden) return;
      const vp = viewport();
      const r = input.getBoundingClientRect();
      let need = r.bottom + GAP + listHeight() + MARGIN - vp.bottom;
      if (need <= 0) return;
      const globe = quizGeoGlobeContainer.getBoundingClientRect();
      need = Math.min(need, Math.max(0, globe.top - vp.top));
      if (need > 0) window.scrollBy({ top: need, behavior: "smooth" });
    }

    function position() {
      if (listEl.hidden) return;
      const vp = viewport();
      const r = input.getBoundingClientRect();
      const room = vp.bottom - r.bottom - GAP - MARGIN;
      listEl.style.left = `${r.left + vp.left}px`;
      listEl.style.width = `${r.width}px`;
      listEl.style.top = `${r.bottom + GAP}px`;
      listEl.style.maxHeight = `${Math.max(48, Math.min(listHeight(), room))}px`;
    }

    function updateFade() {
      strip.classList.toggle("has-more", strip.scrollLeft + strip.clientWidth < strip.scrollWidth - 2);
    }
    strip.addEventListener("scroll", updateFade, { passive: true });

    function close() {
      listEl.hidden = true;
      strip.hidden = true;
      renderedKey = null;
      active = -1;
    }

    function rank(v, q) {
      const l = v.toLowerCase();
      if (l.startsWith(q)) return 0;
      return l.split(/[\s\-'(]+/).some((w) => w.startsWith(q)) ? 1 : 2;
    }

    function pick(value) {
      input.value = value;
      close();
      if (isPhone()) input.blur();
      input.dispatchEvent(new Event("change"));
    }

    function open() {
      const q = input.value.trim().toLowerCase();
      if (input.disabled || !q) return close();
      const matches = Array.from(datalist.options)
        .map((o) => o.value)
        .filter((v) => v.toLowerCase().includes(q))
        .sort((a, b) => rank(a, q) - rank(b, q));
      const key = `${datalist.options.length}|${q}|${isPhone()}`;
      if (!matches.length || (matches.length === 1 && matches[0].toLowerCase() === q)) return close();
      if (isPhone()) {
        listEl.hidden = true;
        if (key !== renderedKey) {
          strip.replaceChildren(
            ...matches.map((v) => {
              const b = document.createElement("button");
              b.type = "button";
              b.textContent = v;
              b.addEventListener("mousedown", (e) => e.preventDefault());
              b.addEventListener("click", () => pick(v));
              return b;
            })
          );
          renderedKey = key;
          strip.scrollLeft = 0;
        }
        strip.hidden = false;
        updateFade();
        return;
      }
      strip.hidden = true;
      if (key !== renderedKey) {
        listEl.replaceChildren(
          ...matches.map((v) => {
            const li = document.createElement("li");
            li.setAttribute("role", "option");
            li.textContent = v;
            li.addEventListener("mousedown", (e) => {
              e.preventDefault();
              pick(v);
            });
            return li;
          })
        );
        items = Array.from(listEl.children);
        active = -1;
        renderedKey = key;
        listEl.scrollTop = 0;
      }
      const wasHidden = listEl.hidden;
      listEl.hidden = false;
      position();
      if (wasHidden) ensureRoom();
      position();
    }

    input.addEventListener("input", open);
    input.addEventListener("blur", () => {
      if (!isPhone()) close();
    });
    input.addEventListener("change", close);
    input.addEventListener("keydown", (e) => {
      if (listEl.hidden) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive(Math.min(items.length - 1, active + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive(Math.max(0, active - 1));
      } else if (e.key === "Enter" && items[active]) {
        e.preventDefault();
        pick(items[active].textContent);
      } else if (e.key === "Escape") {
        close();
      }
    });
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", () => {
        ensureRoom();
        position();
      });
      window.visualViewport.addEventListener("scroll", position);
    }
  }
  attachSuggestions(quizCountryGuessInput, quizCountryGuessList);
  attachSuggestions(quizCapitalGuessInput, quizCapitalGuessList);
  attachSuggestions(countryInput, countryList);

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

  // Links from the static country pages (country/<name>/): ?country=jp opens
  // that country in Explore, ?view=map|globe picks the picker, ?section=quiz
  // opens the quizzes.
  function applyUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const view = params.get("view");
    setView(view === "map" || view === "globe" ? view : "dropdown");
    setAppSection(params.get("section") === "quiz" ? "quiz" : "explore");
    const code = params.get("country");
    if (code && /^[a-z]{2,3}$/i.test(code)) selectCountryByCode(code, { recenter: true });
  }

  initDarkMode();
  loadCountryList();
  showDataDate();
  showQuizScreen("mode");
  applyUrlParams();
})();
