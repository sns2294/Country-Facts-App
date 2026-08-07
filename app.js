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
  const quizModeButtons = document.querySelectorAll(".quiz-mode-btn");
  const quizStatus = document.getElementById("quiz-status");
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

  const NATIVE_VIEW_BOX = { x: -180, y: -84, w: 360, h: 174 };
  const MIN_VIEW_WIDTH = 4;
  const MAX_VIEW_WIDTH = NATIVE_VIEW_BOX.w;
  const MIN_HIT_TARGET_PX = 9;
  const MAX_HIT_RADIUS_DEG = 1.0;
  const WHEEL_ZOOM_FACTOR = 1.15;
  const BUTTON_ZOOM_FACTOR = 1.4;
  const DRAG_THRESHOLD_PX = 3;
  const QUIZ_QUESTION_COUNT = 10;

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

  let mapLoaded = false;
  let mapSvg = null;
  let currentViewBox = { ...NATIVE_VIEW_BOX };
  let suppressNextClick = false;

  function showTooltip(name) {
    if (!name) return;
    mapTooltip.textContent = name;
    mapTooltip.hidden = false;
  }

  function positionTooltip(evt) {
    const rect = mapContainer.getBoundingClientRect();
    mapTooltip.style.left = `${evt.clientX - rect.left + 14}px`;
    mapTooltip.style.top = `${evt.clientY - rect.top + 14}px`;
  }

  function hideTooltip() {
    mapTooltip.hidden = true;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function applyViewBox(x, y, w) {
    const width = clamp(w, MIN_VIEW_WIDTH, MAX_VIEW_WIDTH);
    const height = width * (NATIVE_VIEW_BOX.h / NATIVE_VIEW_BOX.w);
    const maxX = NATIVE_VIEW_BOX.x + NATIVE_VIEW_BOX.w - width;
    const maxY = NATIVE_VIEW_BOX.y + NATIVE_VIEW_BOX.h - height;
    const clampedX = clamp(x, NATIVE_VIEW_BOX.x, Math.max(maxX, NATIVE_VIEW_BOX.x));
    const clampedY = clamp(y, NATIVE_VIEW_BOX.y, Math.max(maxY, NATIVE_VIEW_BOX.y));

    currentViewBox = { x: clampedX, y: clampedY, w: width, h: height };
    if (mapSvg) {
      mapSvg.setAttribute("viewBox", `${clampedX} ${clampedY} ${width} ${height}`);
    }
    updateHitTargetSizes();
  }

  function zoomAt(clientX, clientY, factor) {
    const rect = mapContainer.getBoundingClientRect();
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
    const rect = mapContainer.getBoundingClientRect();
    zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor);
  }

  function updateHitTargetSizes() {
    if (!mapSvg) return;
    const rect = mapContainer.getBoundingClientRect();
    if (!rect.width) return;
    const scale = rect.width / currentViewBox.w;
    // Capped so that at low zoom (many degrees per screen pixel) the enlarged
    // click target doesn't balloon large enough to swallow neighboring countries.
    const radius = Math.min(MIN_HIT_TARGET_PX / scale, MAX_HIT_RADIUS_DEG);
    mapSvg.querySelectorAll("circle.hit-target").forEach((circle) => {
      circle.setAttribute("r", radius);
    });
  }

  function attachZoomPanHandlers() {
    mapContainer.addEventListener(
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

    mapContainer.addEventListener("mousedown", (evt) => {
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
      mapContainer.classList.add("dragging");

      const rect = mapContainer.getBoundingClientRect();
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
      mapContainer.classList.remove("dragging");
    });

    mapContainer.addEventListener(
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

    mapZoomInBtn.addEventListener("click", () => zoomAtCenter(1 / BUTTON_ZOOM_FACTOR));
    mapZoomOutBtn.addEventListener("click", () => zoomAtCenter(BUTTON_ZOOM_FACTOR));
    mapZoomResetBtn.addEventListener("click", () => applyViewBox(NATIVE_VIEW_BOX.x, NATIVE_VIEW_BOX.y, NATIVE_VIEW_BOX.w));

    window.addEventListener("resize", () => {
      if (mapLoaded && !mapSection.hidden) updateHitTargetSizes();
    });
  }

  function attachMapHandlers(svg) {
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
      if (path.id) {
        path.addEventListener("click", () => selectCountryByCode(path.id));
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
      circle.addEventListener("click", () => selectCountryByCode(code));
    });
  }

  async function loadWorldMap() {
    if (mapLoaded) return;
    try {
      const res = await fetch("world-map.svg");
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const svgMarkup = await res.text();
      mapContainer.insertAdjacentHTML("afterbegin", svgMarkup);
      mapLoading.hidden = true;
      mapLoaded = true;
      mapSvg = mapContainer.querySelector("svg");
      attachMapHandlers(mapSvg);
      attachZoomPanHandlers();
      applyViewBox(NATIVE_VIEW_BOX.x, NATIVE_VIEW_BOX.y, NATIVE_VIEW_BOX.w);
    } catch (err) {
      mapLoading.textContent = "Couldn't load the map. Check your connection and try again.";
      console.error("Failed to load world map:", err);
    }
  }

  function setView(view) {
    const isMap = view === "map";
    searchSection.hidden = isMap;
    mapSection.hidden = !isMap;
    viewToggleButtons.forEach((btn) => {
      const active = btn.dataset.view === view;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-selected", String(active));
    });
    if (isMap) loadWorldMap();
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
    quizModeSelect.hidden = screen !== "mode";
    quizQuestionEl.hidden = screen !== "question";
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
    quizState = null;
    showQuizScreen("mode");
  });

  quizModeButtons.forEach((btn) => {
    btn.addEventListener("click", () => startQuiz(btn.dataset.mode));
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
