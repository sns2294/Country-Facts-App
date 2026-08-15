(() => {
  const API_BASE = "https://countries.dev";
  const GEO_API_BASE = "https://geoapi.info/api";
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

  function setStatus(message, isError = false) {
    searchStatus.textContent = message;
    searchStatus.classList.toggle("error", isError);
  }

  function formatPopulation(pop) {
    return typeof pop === "number" ? pop.toLocaleString("en-US") : "Unknown";
  }

  async function fetchGeoFacts(alpha2Code) {
    if (!alpha2Code) return { governmentType: null, religion: null };
    try {
      const res = await fetch(`${GEO_API_BASE}/country?code=${encodeURIComponent(alpha2Code)}`);
      if (!res.ok) return { governmentType: null, religion: null };
      const data = await res.json();
      return {
        governmentType: data.governmentType || null,
        religion: data.religion || null,
      };
    } catch (err) {
      console.error("Failed to load GeoAPI facts:", err);
      return { governmentType: null, religion: null };
    }
  }

  async function fetchBorderNames(borderCodes) {
    if (!borderCodes || !borderCodes.length) return [];
    const results = await Promise.all(
      borderCodes.map(async (code) => {
        try {
          const res = await fetch(`${API_BASE}/alpha/${encodeURIComponent(code)}`);
          if (!res.ok) return null;
          const data = await res.json();
          return data?.name ? { code, name: data.name } : null;
        } catch (err) {
          console.error(`Failed to load bordering country ${code}:`, err);
          return null;
        }
      })
    );
    return results.filter(Boolean);
  }

  function buildOverview(country, geoFacts) {
    const regionPhrase = country.region
      ? `located in ${country.region}${country.subregion ? ` (${country.subregion})` : ""}`
      : "";
    const govPhrase = geoFacts.governmentType ? `a ${geoFacts.governmentType}` : "";

    let overview = country.name;
    if (govPhrase && regionPhrase) {
      overview += ` is ${govPhrase}, ${regionPhrase}.`;
    } else if (govPhrase || regionPhrase) {
      overview += ` is ${govPhrase || regionPhrase}.`;
    } else {
      overview += ".";
    }

    if (geoFacts.religion) {
      overview += ` ${geoFacts.religion} is the predominant religion.`;
    }

    return overview;
  }

  function renderCountry(country, geoFacts, borderCountries) {
    const flagUrl = country.flags?.svg || country.flags?.png || "";
    const showNativeName = country.nativeName && country.nativeName !== country.name;
    const bordersMarkup = borderCountries.length
      ? `
          <div class="field-divider"></div>
          <dt>Bordering Countries</dt>
          <dd class="borders-list">${borderCountries
            .map(
              (b) =>
                `<button type="button" class="border-chip" data-code="${b.code}">${getBorderDisplayName(
                  b.name
                )}</button>`
            )
            .join("")}</dd>
        `
      : "";

    factCard.innerHTML = `
      <div class="card-header">
        ${flagUrl ? `<img class="flag" src="${flagUrl}" alt="Flag of ${country.name}" />` : ""}
        <div>
          <h2>${country.name}</h2>
          ${showNativeName ? `<p class="native-name">${country.nativeName}</p>` : ""}
        </div>
      </div>
      <div class="card-body">
        <dl>
          <dt>Capital</dt>
          <dd>${country.capital || "N/A"}</dd>
          <dt>Population</dt>
          <dd>${formatPopulation(country.population)}</dd>
          <dt>Region</dt>
          <dd>${country.region || "N/A"}${country.subregion ? ` (${country.subregion})` : ""}</dd>
          <dt>Languages</dt>
          <dd>${country.languages?.length ? country.languages.map((l) => l.name).join(", ") : "N/A"}</dd>
          ${bordersMarkup}
          <dt>Form of Government</dt>
          <dd>${geoFacts.governmentType || "N/A"}</dd>
          <dt>Religion</dt>
          <dd>${geoFacts.religion || "N/A"}</dd>
        </dl>
        <p class="overview">${buildOverview(country, geoFacts)}</p>
      </div>
    `;
    factCard.hidden = false;
  }

  async function loadCountryList() {
    try {
      const res = await fetch(`${API_BASE}/countries?fields=name`);
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const data = await res.json();
      countryNames = data.map((c) => c.name).sort((a, b) => a.localeCompare(b));

      countryList.innerHTML = countryNames
        .map((name) => `<option value="${name}"></option>`)
        .join("");

      setStatus(`${countryNames.length} countries loaded. Pick one to see its facts.`);
    } catch (err) {
      setStatus("Couldn't load the country list. Check your connection and reload.", true);
      console.error("Failed to load country list:", err);
    }
  }

  async function showCountryData(country) {
    const [geoFacts, borderCountries] = await Promise.all([
      fetchGeoFacts(country.alpha2Code),
      fetchBorderNames(country.borders),
    ]);
    renderCountry(country, geoFacts, borderCountries);
    setStatus(`Showing facts for ${country.name}.`);
  }

  async function selectCountry(rawName) {
    const name = rawName.trim();
    if (!name) return;

    const match = countryNames.find((n) => n.toLowerCase() === name.toLowerCase());
    if (!match) {
      setStatus(`"${name}" isn't in the country list — pick one from the suggestions.`, true);
      factCard.hidden = true;
      return;
    }

    setStatus(`Loading ${match}…`);
    try {
      const res = await fetch(`${API_BASE}/name/${encodeURIComponent(match)}`);
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const results = await res.json();
      const country = results.find((c) => c.name.toLowerCase() === match.toLowerCase()) || results[0];
      if (!country) throw new Error("No matching country in response");

      await showCountryData(country);
    } catch (err) {
      setStatus(`Couldn't load data for ${match}. Try again.`, true);
      factCard.hidden = true;
      console.error("Failed to load country:", err);
    }
  }

  async function selectCountryByCode(code) {
    if (!code) return;

    setStatus("Loading…");
    try {
      const res = await fetch(`${API_BASE}/alpha/${encodeURIComponent(code)}`);
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const country = await res.json();
      if (!country || !country.name) throw new Error("No country data in response");

      countryInput.value = country.name;
      await showCountryData(country);
    } catch (err) {
      setStatus("Couldn't load data for that country. Try again.", true);
      factCard.hidden = true;
      console.error("Failed to load country by code:", err);
    }
  }

  countryInput.addEventListener("change", () => selectCountry(countryInput.value));

  factCard.addEventListener("click", (evt) => {
    const link = evt.target.closest(".border-chip");
    if (!link) return;
    selectCountryByCode(link.dataset.code);
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

    function showTooltip(name) {
      if (!tooltipEl || !name) return;
      tooltipEl.textContent = name;
      tooltipEl.hidden = false;
    }

    function positionTooltip(evt) {
      if (!tooltipEl) return;
      const rect = container.getBoundingClientRect();
      tooltipEl.style.left = `${evt.clientX - rect.left + 14}px`;
      tooltipEl.style.top = `${evt.clientY - rect.top + 14}px`;
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

    async function ensureLoaded() {
      if (loaded) return;
      try {
        const svgMarkup = await fetchMapMarkup();
        container.insertAdjacentHTML("afterbegin", svgMarkup);
        if (loadingEl) loadingEl.hidden = true;
        loaded = true;
        svg = container.querySelector("svg");
        if (enableCountryInteraction) attachMapHandlers();
        attachZoomPanHandlers();
        applyViewBox(NATIVE_VIEW_BOX.x, NATIVE_VIEW_BOX.y, NATIVE_VIEW_BOX.w);
      } catch (err) {
        if (loadingEl) loadingEl.textContent = "Couldn't load the map. Check your connection and try again.";
        console.error("Failed to load world map:", err);
        throw err;
      }
    }

    return {
      ensureLoaded,
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
  const GLOBE_GEO_URL = "https://unpkg.com/world-atlas@2/countries-110m.json";
  const GLOBE_DEFAULT_POV = { lat: 15, lng: 10, altitude: 2.2 };
  const GLOBE_MIN_ALTITUDE = 0.32;
  const GLOBE_MAX_ALTITUDE = 4;
  const GLOBE_ZOOM_FACTOR = 1.4;

  let globeFeaturesPromise = null;
  let globeNumericToAlpha2Promise = null;

  function getCssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function hexToRgbTriplet(hex) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || "");
    if (!m) return "47,111,237";
    return [1, 2, 3].map((i) => parseInt(m[i], 16)).join(",");
  }

  function fetchGlobeFeatures() {
    if (!globeFeaturesPromise) {
      globeFeaturesPromise = fetch(GLOBE_GEO_URL)
        .then((res) => {
          if (!res.ok) throw new Error(`Request failed: ${res.status}`);
          return res.json();
        })
        .then((topology) => topojson.feature(topology, topology.objects.countries).features);
    }
    return globeFeaturesPromise;
  }

  // world-atlas polygon ids are zero-padded ISO 3166-1 numeric codes, which
  // line up with the numericCode field the country API returns — used to
  // resolve a polygon back to the alpha2 code the rest of the app keys on.
  function fetchNumericToAlpha2Map() {
    if (!globeNumericToAlpha2Promise) {
      globeNumericToAlpha2Promise = fetch(`${API_BASE}/countries?fields=alpha2Code,numericCode`)
        .then((res) => {
          if (!res.ok) throw new Error(`Request failed: ${res.status}`);
          return res.json();
        })
        .then((data) => {
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

    function refreshPolygonStyles() {
      if (!globe) return;
      const fillColor = getCssVar("--map-fill");
      const hoverColor = getCssVar("--map-hover");
      const strokeColor = getCssVar("--map-stroke");
      const targetColor = getCssVar("--accent");
      globe
        .polygonCapColor((d) => (d === targetFeature ? targetColor : d === hoverFeature ? hoverColor : fillColor))
        .polygonSideColor(() => fillColor)
        .polygonStrokeColor(() => strokeColor)
        .polygonAltitude((d) => (d === targetFeature ? 0.02 : d === hoverFeature ? 0.015 : 0.006));
    }

    function applyTheme() {
      if (!globe) return;
      const accentHex = getCssVar("--accent") || "#2f6fed";
      const accentRgb = hexToRgbTriplet(accentHex);
      globe.backgroundColor("rgba(0,0,0,0)");
      globe.globeMaterial().color.set(getCssVar("--surface") || "#ffffff");
      globe
        .atmosphereColor(accentHex)
        .ringColor(() => (t) => `rgba(${accentRgb},${Math.sqrt(Math.max(0, 1 - t))})`);
      refreshPolygonStyles();
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
        const [features, numericToAlpha2] = await Promise.all([fetchGlobeFeatures(), fetchNumericToAlpha2Map()]);
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
              hoverFeature = feat;
              refreshPolygonStyles();
            })
            .onPolygonClick(handlePolygonClick);
        }

        globe.pointOfView(GLOBE_DEFAULT_POV, 0);
        applyTheme();
        resize();
        if (loadingEl) loadingEl.hidden = true;
      } catch (err) {
        if (loadingEl) loadingEl.textContent = "Couldn't load the globe. Check your connection and try again.";
        console.error("Failed to load globe:", err);
        throw err;
      }
    }

    function zoomAtCenter(factor) {
      if (!globe) return;
      const pov = globe.pointOfView();
      const altitude = clamp(pov.altitude * factor, GLOBE_MIN_ALTITUDE, GLOBE_MAX_ALTITUDE);
      globe.pointOfView({ lat: pov.lat, lng: pov.lng, altitude }, 250);
    }

    function reset() {
      if (!globe) return;
      globe.pointOfView(GLOBE_DEFAULT_POV, 600);
    }

    function getAvailableCodes() {
      return new Set(alpha2ToFeature.keys());
    }

    // Frames the target country's own location, sizing the camera altitude to
    // fit `contextCodes` (defaults to just the target) — mirrors the flat
    // map's fitToCodes + centerHorizontallyOn pairing used by the old quiz map.
    function highlight(code, { contextCodes = [code], boost = 1, transitionMs = 600 } = {}) {
      if (!globe) return;
      const feature = alpha2ToFeature.get(code);
      if (!feature) return;
      targetFeature = feature;
      refreshPolygonStyles();

      const targetBox = getFeatureSetBBox([feature]);
      const contextFeatures = contextCodes.map((c) => alpha2ToFeature.get(c)).filter(Boolean);
      const contextBox = getFeatureSetBBox(contextFeatures.length ? contextFeatures : [feature]) || targetBox;
      if (!targetBox || !contextBox) return;

      const span = Math.max(contextBox.lngSpan, contextBox.latSpan * 2);
      const altitude = altitudeForSpan(span) * boost;
      globe.pointOfView({ lat: targetBox.centerLat, lng: targetBox.centerLng, altitude }, transitionMs);
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
    if (isMap) exploreMap.ensureLoaded();
    if (isGlobe) exploreGlobe.ensureLoaded();
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
    const res = await fetch(`${API_BASE}/countries?fields=name,capital,flags,alpha2Code,languages`);
    if (!res.ok) throw new Error(`Request failed: ${res.status}`);
    const data = await res.json();
    quizCountriesCache = data.filter((c) => c && c.name);
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
        const sample = shuffleArray(countries.filter((c) => c.alpha2Code)).slice(0, 40);
        const results = await Promise.all(
          sample.map(async (c) => {
            const facts = await fetchGeoFacts(c.alpha2Code);
            return facts.religion ? { ...c, religion: facts.religion } : null;
          })
        );
        return results.filter(Boolean);
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
      quizStatus.textContent = "Couldn't load quiz data. Check your connection and try again.";
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

  let geoCountriesCache = null;
  async function ensureGeoCountries() {
    if (geoCountriesCache) return geoCountriesCache;
    const res = await fetch(`${API_BASE}/countries?fields=name,capital,region,alpha2Code`);
    if (!res.ok) throw new Error(`Request failed: ${res.status}`);
    const data = await res.json();
    geoCountriesCache = data.filter((c) => c && c.name && c.capital && c.alpha2Code && REGIONS.includes(c.region));
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
      quizRegionStatus.textContent = "Couldn't load quiz data. Check your connection and try again.";
      quizRegionStatus.classList.add("error");
      console.error("Failed to start geography quiz:", err);
    }
  }

  function renderGeoQuestion(question) {
    // A chosen region (standalone Geography mode) frames the whole region so
    // the target has to be located within it; Mixed mode has no region, so
    // its geography questions zoom in tight on just the target country.
    const highlightOptions = quizState.region
      ? { contextCodes: quizState.geoPool.map((c) => c.alpha2Code), boost: QUIZ_GEO_ZOOM_BOOST }
      : {};
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
    quizGeoNextBtn.hidden = true;

    quizCountryGuessInput.focus();
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
      quizCapitalGuessInput.focus();
    } else {
      quizGeoFeedback.textContent = `Not quite — the highlighted country is ${question.country.name}.`;
      quizGeoFeedback.classList.add("wrong");
      quizGeoNextBtn.hidden = false;
      quizGeoNextBtn.textContent = quizState.index === quizState.questions.length - 1 ? "See Score" : "Next Question";
    }
  }

  function handleCapitalGuess() {
    if (!quizState || !quizState.bonusActive) return;
    const question = quizState.questions[quizState.index];
    const match = matchPoolItem(quizState.geoPool, quizCapitalGuessInput.value, "capital");

    if (!match) {
      quizGeoInputStatus.textContent = "Pick a capital from the suggestions.";
      quizGeoInputStatus.classList.add("error");
      return;
    }
    quizGeoInputStatus.textContent = "";
    quizGeoInputStatus.classList.remove("error");

    quizState.bonusActive = false;
    quizCapitalGuessInput.disabled = true;
    const isBonusCorrect = match.capital === question.country.capital;

    if (isBonusCorrect) {
      quizState.score += 1;
      quizScoreText.textContent = `Score: ${quizState.score}`;
    }

    quizGeoFeedback.textContent = isBonusCorrect
      ? "Correct! +1 bonus point for the capital."
      : `Close — the capital is ${question.country.capital}.`;
    quizGeoFeedback.classList.toggle("correct", isBonusCorrect);
    quizGeoFeedback.classList.toggle("wrong", !isBonusCorrect);

    quizGeoNextBtn.hidden = false;
    quizGeoNextBtn.textContent = quizState.index === quizState.questions.length - 1 ? "See Score" : "Next Question";
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
  setView("dropdown");
  setAppSection("explore");
  showQuizScreen("mode");
})();
