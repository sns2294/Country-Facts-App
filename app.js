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

  const quizMapQuestionEl = document.getElementById("quiz-map-question");
  const quizMapContainer = document.getElementById("quiz-map-container");
  const quizMapLoading = document.getElementById("quiz-map-loading");
  const quizMapZoomInBtn = document.getElementById("quiz-map-zoom-in");
  const quizMapZoomOutBtn = document.getElementById("quiz-map-zoom-out");
  const quizCountryGuessInput = document.getElementById("quiz-country-guess");
  const quizCountryGuessList = document.getElementById("quiz-country-guess-list");
  const quizBonusRow = document.getElementById("quiz-bonus-row");
  const quizBonusCountryName = document.getElementById("quiz-bonus-country-name");
  const quizCapitalGuessInput = document.getElementById("quiz-capital-guess");
  const quizCapitalGuessList = document.getElementById("quiz-capital-guess-list");
  const quizMapInputStatus = document.getElementById("quiz-map-input-status");
  const quizMapFeedback = document.getElementById("quiz-map-feedback");
  const quizMapNextBtn = document.getElementById("quiz-map-next-btn");

  const NATIVE_VIEW_BOX = { x: -180, y: -84, w: 360, h: 174 };
  const MIN_VIEW_WIDTH = 4;
  const MAX_VIEW_WIDTH = NATIVE_VIEW_BOX.w;
  const MIN_HIT_TARGET_PX = 9;
  const MAX_HIT_RADIUS_DEG = 1.0;
  const MARKER_RADIUS_PX = 7;
  const MAX_MARKER_RADIUS_DEG = 2.5;
  const WHEEL_ZOOM_FACTOR = 1.15;
  const BUTTON_ZOOM_FACTOR = 1.4;
  const DRAG_THRESHOLD_PX = 3;
  const QUIZ_QUESTION_COUNT = 10;
  // Applied on top of the region fit for the Map quiz mode so the region fills
  // more of the frame by default (still centered on the whole region, not the
  // individual highlighted country) — makes small island nations easier to see.
  const QUIZ_MAP_ZOOM_BOOST = 0.85;
  const REGIONS = ["Europe", "Africa", "Asia", "Americas", "Oceania"];
  const SVG_NS = "http://www.w3.org/2000/svg";

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
    let highlightedEl = null;
    let markerEl = null;

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
      updateMarkerSize();
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

    function updateMarkerSize() {
      if (!svg || !markerEl) return;
      const rect = container.getBoundingClientRect();
      if (!rect.width) return;
      const scale = rect.width / currentViewBox.w;
      // Kept to a constant screen size (rather than scaling with the country's
      // own geometry) so tiny countries like Malta or Pacific island nations
      // stay findable even when the map is zoomed out to a whole region.
      const radius = Math.min(MARKER_RADIUS_PX / scale, MAX_MARKER_RADIUS_DEG);
      markerEl.querySelectorAll("circle").forEach((circle) => {
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

    function findCountryEl(code) {
      if (!svg) return null;
      return (
        svg.querySelector(`path.country[id="${code}"]`) ||
        svg.querySelector(`circle.hit-target[data-code="${code}"]`)
      );
    }

    function getCentroid(el) {
      if (el.tagName === "circle") {
        const cx = parseFloat(el.getAttribute("cx"));
        const cy = parseFloat(el.getAttribute("cy"));
        if (!isNaN(cx) && !isNaN(cy)) return { x: cx, y: cy };
      } else {
        const cx = parseFloat(el.dataset.cx);
        const cy = parseFloat(el.dataset.cy);
        if (!isNaN(cx) && !isNaN(cy)) return { x: cx, y: cy };
      }
      const bbox = el.getBBox();
      return { x: bbox.x + bbox.width / 2, y: bbox.y + bbox.height / 2 };
    }

    function createMarker(centroid) {
      const g = document.createElementNS(SVG_NS, "g");
      g.setAttribute("class", "quiz-target-marker");
      g.setAttribute("transform", `translate(${centroid.x}, ${centroid.y})`);

      const ring = document.createElementNS(SVG_NS, "circle");
      ring.setAttribute("class", "quiz-target-marker-ring");
      ring.setAttribute("cx", "0");
      ring.setAttribute("cy", "0");

      const dot = document.createElementNS(SVG_NS, "circle");
      dot.setAttribute("class", "quiz-target-marker-dot");
      dot.setAttribute("cx", "0");
      dot.setAttribute("cy", "0");

      g.appendChild(ring);
      g.appendChild(dot);
      return g;
    }

    function highlight(code) {
      clearHighlight();
      const el = findCountryEl(code);
      if (!el) return;

      el.classList.add("quiz-target");
      highlightedEl = el;

      markerEl = createMarker(getCentroid(el));
      svg.appendChild(markerEl);
      updateMarkerSize();
    }

    function clearHighlight() {
      if (highlightedEl) {
        highlightedEl.classList.remove("quiz-target");
        highlightedEl = null;
      }
      if (markerEl) {
        markerEl.remove();
        markerEl = null;
      }
    }

    // This map's longitude axis wraps at ±180°. Fiji, Kiribati, Russia, etc. are
    // drawn as one <path> with sub-shapes on both sides of that seam, so their
    // raw getBBox() reads as ~360° wide instead of their true (small) extent.
    // Smallest arc (on the circular 360°-wide longitude domain) containing every
    // value in `xs`. A plain min/max would treat Fiji's ~+178 and Samoa's ~-172
    // as being on opposite sides of the world instead of ~10° apart.
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

    // Splits a country's path into its individual sub-shapes (islands, enclaves)
    // so an antimeridian-spanning country contributes several small, correctly
    // placed boxes instead of one that spans the whole map.
    function getMeasurementBoxes(el) {
      if (el.tagName === "circle") {
        const cx = parseFloat(el.getAttribute("cx"));
        const cy = parseFloat(el.getAttribute("cy"));
        return [{ x: cx, y: cy, width: 0, height: 0 }];
      }

      const d = el.getAttribute("d") || "";
      const segments = d
        .split(/[Zz]/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (segments.length <= 1) return [el.getBBox()];

      return segments.map((seg) => {
        const temp = document.createElementNS(SVG_NS, "path");
        temp.setAttribute("d", `${seg}Z`);
        temp.setAttribute("visibility", "hidden");
        svg.appendChild(temp);
        const box = temp.getBBox();
        temp.remove();
        return box;
      });
    }

    // Centers on the country's actual stored (always-in-bounds) longitude.
    // The window is allowed to spill only as far past ±180 as the marker's
    // own radius requires (see applyViewBox) — enough that the ring is never
    // clipped, but not so much that a wide-region view ends up half blank
    // with the country stranded at the map/void seam.
    function centerHorizontallyOn(code) {
      const el = findCountryEl(code);
      if (!el) return;
      const centroid = getCentroid(el);
      applyViewBox(centroid.x - currentViewBox.w / 2, currentViewBox.y, currentViewBox.w, {
        clampMargin: MAX_MARKER_RADIUS_DEG,
      });
    }

    function getAvailableCodes() {
      const codes = new Set();
      if (!svg) return codes;
      svg.querySelectorAll("path.country[id]").forEach((p) => codes.add(p.id));
      svg.querySelectorAll("circle.hit-target").forEach((c) => codes.add(c.dataset.code));
      return codes;
    }

    function fitToCodes(codes, paddingRatio = 0.15) {
      if (!svg) return;
      const xPoints = [];
      let minY = Infinity;
      let maxY = -Infinity;

      codes.forEach((code) => {
        const el = findCountryEl(code);
        if (!el) return;
        getMeasurementBoxes(el).forEach((box) => {
          xPoints.push(box.x, box.x + box.width);
          minY = Math.min(minY, box.y);
          maxY = Math.max(maxY, box.y + box.height);
        });
      });
      if (!xPoints.length || !isFinite(minY)) return;

      const arc = findEnclosingArc(xPoints);
      const boxW = arc.span;
      const boxH = maxY - minY;
      const targetAspect = NATIVE_VIEW_BOX.w / NATIVE_VIEW_BOX.h;
      let viewW = boxW * (1 + paddingRatio * 2);
      let viewH = boxH * (1 + paddingRatio * 2);
      if (viewW / viewH < targetAspect) {
        viewW = viewH * targetAspect;
      } else {
        viewH = viewW / targetAspect;
      }
      const midNormalized = arc.start + boxW / 2;
      const cx = midNormalized > 180 ? midNormalized - 360 : midNormalized;
      const cy = minY + boxH / 2;
      applyViewBox(cx - viewW / 2, cy - viewH / 2, viewW);
    }

    return {
      ensureLoaded,
      applyViewBox,
      zoomAtCenter,
      highlight,
      clearHighlight,
      centerHorizontallyOn,
      getAvailableCodes,
      fitToCodes,
      get loaded() {
        return loaded;
      },
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

  const quizMap = createMapController({
    container: quizMapContainer,
    loadingEl: quizMapLoading,
    tooltipEl: null,
    zoomInBtn: quizMapZoomInBtn,
    zoomOutBtn: quizMapZoomOutBtn,
    zoomResetBtn: null,
    isVisible: () => !quizMapQuestionEl.hidden,
    enableCountryInteraction: false,
  });

  function setView(view) {
    const isMap = view === "map";
    searchSection.hidden = isMap;
    mapSection.hidden = !isMap;
    viewToggleButtons.forEach((btn) => {
      const active = btn.dataset.view === view;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-selected", String(active));
    });
    if (isMap) exploreMap.ensureLoaded();
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

  function buildQuizQuestions(pool, mode) {
    const shuffledPool = shuffleArray(pool);
    const picks = [];
    for (let i = 0; i < QUIZ_QUESTION_COUNT; i++) {
      picks.push(shuffledPool[i % shuffledPool.length]);
    }

    return picks.map((item) => {
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
        promptType: mode.promptType,
        promptLabel: mode.promptLabel,
        prompt: mode.getPrompt(item),
        correctAnswer,
        options: shuffleArray([correctAnswer, ...wrongAnswers.slice(0, 3)]),
      };
    });
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
    const isMapMode = Boolean(quizState?.isMapMode);
    quizModeSelect.hidden = screen !== "mode";
    quizRegionSelect.hidden = screen !== "region";
    quizProgressBar.hidden = screen !== "question";
    quizProgressBar.classList.toggle("quiz-progress--map", isMapMode);
    quizQuestionEl.hidden = !(screen === "question" && !isMapMode);
    quizMapQuestionEl.hidden = !(screen === "question" && isMapMode);
    quizScoreScreen.hidden = screen !== "score";
  }

  async function startQuiz(modeKey) {
    const mode = QUIZ_MODES[modeKey];
    quizStatus.classList.remove("error");
    quizStatus.textContent = "Loading quiz…";
    try {
      const pool = await mode.preparePool();
      if (pool.length < 4) {
        quizStatus.textContent = `Not enough data to run the ${mode.label} quiz right now. Try another mode.`;
        quizStatus.classList.add("error");
        return;
      }
      quizState = { questions: buildQuizQuestions(pool, mode), index: 0, score: 0 };
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

  quizNextBtn.addEventListener("click", () => {
    quizState.index += 1;
    if (quizState.index >= quizState.questions.length) {
      quizFinalScore.textContent = `${quizState.score}/${quizState.questions.length}`;
      showQuizScreen("score");
    } else {
      renderQuizQuestion();
    }
  });

  quizPlayAgainBtn.addEventListener("click", () => {
    quizMap.clearHighlight();
    quizState = null;
    showQuizScreen("mode");
  });

  quizModeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.dataset.mode;
      if (mode === "map") {
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
    btn.addEventListener("click", () => startMapQuiz(btn.dataset.region));
  });

  let mapQuizCountriesCache = null;
  async function ensureMapQuizCountries() {
    if (mapQuizCountriesCache) return mapQuizCountriesCache;
    const res = await fetch(`${API_BASE}/countries?fields=name,capital,region,alpha2Code`);
    if (!res.ok) throw new Error(`Request failed: ${res.status}`);
    const data = await res.json();
    mapQuizCountriesCache = data.filter(
      (c) => c && c.name && c.capital && c.alpha2Code && REGIONS.includes(c.region)
    );
    return mapQuizCountriesCache;
  }

  function buildMapQuizQuestions(pool) {
    const shuffledPool = shuffleArray(pool);
    const picks = [];
    for (let i = 0; i < QUIZ_QUESTION_COUNT; i++) {
      picks.push(shuffledPool[i % shuffledPool.length]);
    }
    return picks.map((country) => ({ country }));
  }

  function populateDatalist(datalistEl, values) {
    datalistEl.innerHTML = values.map((value) => `<option value="${value}"></option>`).join("");
  }

  function matchPoolItem(pool, rawValue, key) {
    const value = rawValue.trim().toLowerCase();
    if (!value) return null;
    return pool.find((item) => item[key].toLowerCase() === value) || null;
  }

  async function startMapQuiz(region) {
    quizRegionStatus.classList.remove("error");
    quizRegionStatus.textContent = "Loading quiz…";
    try {
      await quizMap.ensureLoaded();
      const countries = await ensureMapQuizCountries();
      const availableCodes = quizMap.getAvailableCodes();
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
        isMapMode: true,
        region,
        pool,
        questions: buildMapQuizQuestions(pool),
        index: 0,
        score: 0,
        countryAnswered: false,
        bonusActive: false,
      };
      quizRegionStatus.textContent = "";
      showQuizScreen("question");
      renderMapQuizQuestion();
    } catch (err) {
      quizRegionStatus.textContent = "Couldn't load quiz data. Check your connection and try again.";
      quizRegionStatus.classList.add("error");
      console.error("Failed to start map quiz:", err);
    }
  }

  function renderMapQuizQuestion() {
    const { questions, index, score, pool } = quizState;
    const question = questions[index];

    quizProgressText.textContent = `Question ${index + 1} of ${questions.length}`;
    quizScoreText.textContent = `Score: ${score}`;

    quizMap.fitToCodes(pool.map((c) => c.alpha2Code));
    quizMap.zoomAtCenter(QUIZ_MAP_ZOOM_BOOST);
    quizMap.centerHorizontallyOn(question.country.alpha2Code);
    quizMap.highlight(question.country.alpha2Code);

    quizState.countryAnswered = false;
    quizState.bonusActive = false;

    quizCountryGuessInput.value = "";
    quizCountryGuessInput.disabled = false;
    quizCapitalGuessInput.value = "";
    quizCapitalGuessInput.disabled = true;
    quizBonusRow.hidden = true;

    quizMapInputStatus.textContent = "";
    quizMapInputStatus.classList.remove("error");
    quizMapFeedback.hidden = true;
    quizMapFeedback.textContent = "";
    quizMapFeedback.classList.remove("correct", "wrong");
    quizMapNextBtn.hidden = true;

    quizCountryGuessInput.focus();
  }

  function handleCountryGuess() {
    if (!quizState || quizState.countryAnswered) return;
    const question = quizState.questions[quizState.index];
    const match = matchPoolItem(quizState.pool, quizCountryGuessInput.value, "name");

    if (!match) {
      quizMapInputStatus.textContent = "Pick a country from the suggestions.";
      quizMapInputStatus.classList.add("error");
      return;
    }
    quizMapInputStatus.textContent = "";
    quizMapInputStatus.classList.remove("error");

    quizState.countryAnswered = true;
    quizCountryGuessInput.disabled = true;
    const isCorrect = match.alpha2Code === question.country.alpha2Code;

    quizMapFeedback.hidden = false;
    if (isCorrect) {
      quizState.score += 1;
      quizScoreText.textContent = `Score: ${quizState.score}`;
      quizMapFeedback.textContent = "Correct! Bonus round: name the capital.";
      quizMapFeedback.classList.add("correct");

      quizState.bonusActive = true;
      quizBonusCountryName.textContent = question.country.name;
      quizBonusRow.hidden = false;
      quizCapitalGuessInput.disabled = false;
      quizCapitalGuessInput.focus();
    } else {
      quizMapFeedback.textContent = `Not quite — the highlighted country is ${question.country.name}.`;
      quizMapFeedback.classList.add("wrong");
      quizMapNextBtn.hidden = false;
      quizMapNextBtn.textContent = quizState.index === quizState.questions.length - 1 ? "See Score" : "Next Question";
    }
  }

  function handleCapitalGuess() {
    if (!quizState || !quizState.bonusActive) return;
    const question = quizState.questions[quizState.index];
    const match = matchPoolItem(quizState.pool, quizCapitalGuessInput.value, "capital");

    if (!match) {
      quizMapInputStatus.textContent = "Pick a capital from the suggestions.";
      quizMapInputStatus.classList.add("error");
      return;
    }
    quizMapInputStatus.textContent = "";
    quizMapInputStatus.classList.remove("error");

    quizState.bonusActive = false;
    quizCapitalGuessInput.disabled = true;
    const isBonusCorrect = match.capital === question.country.capital;

    if (isBonusCorrect) {
      quizState.score += 1;
      quizScoreText.textContent = `Score: ${quizState.score}`;
    }

    quizMapFeedback.textContent = isBonusCorrect
      ? "Correct! +1 bonus point for the capital."
      : `Close — the capital is ${question.country.capital}.`;
    quizMapFeedback.classList.toggle("correct", isBonusCorrect);
    quizMapFeedback.classList.toggle("wrong", !isBonusCorrect);

    quizMapNextBtn.hidden = false;
    quizMapNextBtn.textContent = quizState.index === quizState.questions.length - 1 ? "See Score" : "Next Question";
  }

  quizCountryGuessInput.addEventListener("change", handleCountryGuess);
  quizCapitalGuessInput.addEventListener("change", handleCapitalGuess);

  quizMapNextBtn.addEventListener("click", () => {
    quizState.index += 1;
    if (quizState.index >= quizState.questions.length) {
      quizMap.clearHighlight();
      quizFinalScore.textContent = `${quizState.score}/${quizState.questions.length}`;
      showQuizScreen("score");
    } else {
      renderMapQuizQuestion();
    }
  });

  function applyDarkMode(isDark) {
    document.documentElement.classList.toggle("dark", isDark);
    darkModeToggle.setAttribute("aria-pressed", String(isDark));
    darkModeIcon.textContent = isDark ? "☀️" : "🌙";
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
