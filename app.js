(function () {
  const cfg = window.TILE_ESTIMATOR_CONFIG;
  const calc = window.TileEstimatorCalc;

  const state = {
    step: 1,
    totalSteps: 5,
    areaSqm: "",
    tileSize: "",
    location: "",
    site: "",
    distanceKm: "",
    distanceSource: "",
    areaId: "",
    areaLabel: "",
    destLat: null,
    destLon: null,
    demolish: false,
    leveling: false,
    customerSuppliesTiles: true,
    lastResult: null,
  };

  const TILES = [
    { id: "60x60", title: "60×60 ซม.", desc: "แผ่นละ 0.36 ตร.ม. ประมาณ 3 แผ่นต่อตารางเมตร ปูพื้นโล่งได้ค่อนข้างเร็ว" },
    { id: "30x30", title: "30×30 ซม.", desc: "แผ่นละ 0.09 ตร.ม. ประมาณ 11 แผ่นต่อตารางเมตร ใช้เวลาต่อตารางเมตรมากกว่าแผ่นใหญ่" },
    { id: "10x10", title: "10×10 ซม.", desc: "แผ่นเล็ก ตารางเมตรหนึ่งปูถึง 100 แผ่น ใช้เวลานานกว่ามาก" },
    { id: "60x120", title: "60×120 ซม.", desc: "แผ่นใหญ่ ยกยาก ต้องจัดระดับดี ค่าแรงมักสูงกว่าแผ่น 60×60 ทั่วไป" },
  ];

  const LOCATIONS = [
    { id: "hall_floor", title: "พื้นโถง / พื้นห้องทั่วไป", desc: "พื้นที่โล่ง ใช้แผ่นเต็มได้เยอะ ตัดเศษไม่มาก" },
    { id: "parking", title: "ลานจอดรถ", desc: "พื้นโล่ง ปูได้เร็ว เพราะตัดเศษน้อย" },
    { id: "bathroom_floor_wall", title: "พื้นและผนังห้องน้ำ", desc: "ต้องตัดเศษ รูท่อ และรูก๊อกบ่อย จึงช้ากว่าพื้นโถงมาก" },
    { id: "kitchen_wall", title: "ผนังกันเปื้อนครัว", desc: "พื้นที่มักแคบ มีมุมและจุดตัดรอบเคาน์เตอร์" },
  ];

  const SITES = [
    { id: "house_ground", title: "บ้านชั้น 1", desc: "ขนของเข้าออกง่าย ทิ้งเศษวัสดุไม่ลำบาก" },
    { id: "house_upper", title: "บ้านชั้นบน", desc: "ต้องแบกกล่องกระเบื้องขึ้นชั้น กล่องละประมาณ 18–30 กก. แล้วแต่ขนาด" },
    { id: "condo", title: "คอนโด", desc: "จอดรถ แลกบัตร ขึ้นลิฟต์ เวลาเข้าจำกัด มักเข้าไม่ได้เสาร์อาทิตย์" },
  ];

  const AREA_CHIPS = [3, 10, 25, 50, 100];

  const els = {
    page: document.getElementById("page"),
    shopName: document.getElementById("shopName"),
    banner: document.getElementById("exampleBanner"),
    resultTitle: document.getElementById("resultTitle"),
    summaryBox: document.getElementById("summaryBox"),
    wizard: document.getElementById("wizard"),
    intro: document.getElementById("intro"),
    progressBar: document.getElementById("progressBar"),
    progressLabel: document.getElementById("progressLabel"),
    form: document.getElementById("estimatorForm"),
    areaInput: document.getElementById("areaInput"),
    areaChips: document.getElementById("areaChips"),
    areaError: document.getElementById("areaError"),
    tileChoices: document.getElementById("tileChoices"),
    tileError: document.getElementById("tileError"),
    locationChoices: document.getElementById("locationChoices"),
    locationError: document.getElementById("locationError"),
    siteChoices: document.getElementById("siteChoices"),
    siteError: document.getElementById("siteError"),
    demolishInput: document.getElementById("demolishInput"),
    levelingInput: document.getElementById("levelingInput"),
    levelingLabel: document.getElementById("levelingLabel"),
    levelingHint: document.getElementById("levelingHint"),
    supplyChoices: document.getElementById("supplyChoices"),
    distanceInput: document.getElementById("distanceInput"),
    distanceError: document.getElementById("distanceError"),
    geoBtn: document.getElementById("geoBtn"),
    geoStatus: document.getElementById("geoStatus"),
    areaSearch: document.getElementById("areaSearch"),
    areaList: document.getElementById("areaList"),
    distancePreview: document.getElementById("distancePreview"),
    stepServiceNote: document.getElementById("stepServiceNote"),
    resultServiceNote: document.getElementById("resultServiceNote"),
    distanceLine: document.getElementById("distanceLine"),
    mapsLink: document.getElementById("mapsLink"),
    manualDistance: document.getElementById("manualDistance"),
    backBtn: document.getElementById("backBtn"),
    nextBtn: document.getElementById("nextBtn"),
    navBar: document.getElementById("navBar"),
    resultView: document.getElementById("resultView"),
    priceRange: document.getElementById("priceRange"),
    daysLine: document.getElementById("daysLine"),
    boxLine: document.getElementById("boxLine"),
    breakdown: document.getElementById("breakdown"),
    lineBtn: document.getElementById("lineBtn"),
    callBtn: document.getElementById("callBtn"),
    copyBtn: document.getElementById("copyBtn"),
    restartBtn: document.getElementById("restartBtn"),
    phoneLabel: document.getElementById("phoneLabel"),
    toast: document.getElementById("toast"),
  };

  function areaPrefix(area) {
    return area.province === "กรุงเทพมหานคร" ? "เขต" : "อำเภอ";
  }

  function areaDisplayName(area) {
    return areaPrefix(area) + area.name;
  }

  function areaFullLabel(area) {
    if (area.province === "กรุงเทพมหานคร") return areaDisplayName(area);
    return areaDisplayName(area) + " " + area.province;
  }

  function areaKm(area) {
    return calc.roadKmFromOrigin({ lat: area.lat, lon: area.lon }, cfg);
  }

  function normalizeSearch(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/เขต|อำเภอ|อ\.|จ\.|จังหวัด/g, "");
  }

  function matchesArea(area, query) {
    if (!query) return true;
    const q = normalizeSearch(query);
    const hay = normalizeSearch(
      area.name + area.province + areaPrefix(area) + (area.nameEn || "")
    );
    return hay.indexOf(q) !== -1;
  }

  const PROVINCE_ORDER = ["กรุงเทพมหานคร", "นนทบุรี", "ปทุมธานี", "สมุทรปราการ", "สมุทรสาคร", "นครปฐม"];

  function sortedAreas() {
    const list = (cfg.serviceAreas || []).slice();
    list.sort(function (a, b) {
      const pa = PROVINCE_ORDER.indexOf(a.province);
      const pb = PROVINCE_ORDER.indexOf(b.province);
      if (pa !== pb) return (pa === -1 ? 99 : pa) - (pb === -1 ? 99 : pb);
      return a.name.localeCompare(b.name, "th");
    });
    return list;
  }

  function updateDistancePreview() {
    const km = Number(state.distanceKm);
    const has = state.distanceKm !== "" && !Number.isNaN(km) && km >= 0;
    if (!els.distancePreview) return;
    if (!has) {
      els.distancePreview.textContent = "";
    } else {
      const extra = state.areaLabel ? " · " + state.areaLabel : state.distanceSource === "geo" ? " · จากตำแหน่งของฉัน" : "";
      const approx = state.distanceSource === "geo" || state.distanceSource === "area" ? " (ระยะประมาณ)" : "";
      els.distancePreview.textContent = calc.distanceFromShopText(km, cfg) + extra + approx;
    }
    const beyond = has && calc.isBeyondServiceRadius(km, cfg);
    if (els.stepServiceNote) {
      els.stepServiceNote.hidden = !beyond;
      if (beyond) {
        els.stepServiceNote.textContent =
          "ไกลกว่ารัศมีให้บริการโดยประมาณ (" +
          calc.formatNumber(cfg.maxServiceRadiusKm) +
          " กม.) แนะนำให้โทรสอบถามก่อน";
      }
    }
  }

  function setDistance(opts) {
    state.distanceKm = opts.km;
    state.distanceSource = opts.source || "";
    state.areaId = opts.areaId || "";
    state.areaLabel = opts.label || "";
    state.destLat = opts.lat != null ? opts.lat : null;
    state.destLon = opts.lon != null ? opts.lon : null;
    if (opts.source !== "manual" && els.distanceInput) {
      els.distanceInput.value = opts.km === "" || opts.km == null ? "" : String(opts.km);
    }
    if (opts.source === "manual") {
      state.areaId = "";
      state.areaLabel = "";
      state.destLat = null;
      state.destLon = null;
    }
    renderAreaList(els.areaSearch ? els.areaSearch.value : "");
    updateDistancePreview();
    clearError("distanceKm");
  }

  function renderAreaList(query) {
    if (!els.areaList) return;
    const selected = state.areaId;
    const matches = sortedAreas().filter(function (a) { return matchesArea(a, query); });
    els.areaList.innerHTML = "";
    if (!matches.length) {
      const empty = document.createElement("p");
      empty.className = "area-empty";
      empty.textContent = "ไม่พบเขตหรืออำเภอที่ตรงกับคำค้น ลองใส่ระยะทางเองด้านล่างได้";
      els.areaList.appendChild(empty);
      return;
    }
    let currentProv = "";
    matches.forEach(function (area) {
      if (area.province !== currentProv) {
        currentProv = area.province;
        const head = document.createElement("div");
        head.className = "area-group";
        head.textContent = currentProv === "กรุงเทพมหานคร" ? "กรุงเทพมหานคร" : "ปริมณฑล · " + currentProv;
        els.areaList.appendChild(head);
      }
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "area-option" + (area.id === selected ? " is-selected" : "");
      btn.setAttribute("role", "option");
      btn.setAttribute("aria-selected", area.id === selected ? "true" : "false");
      btn.dataset.id = area.id;
      const name = document.createElement("span");
      name.textContent = areaDisplayName(area);
      const km = document.createElement("span");
      km.className = "area-km";
      km.textContent = "ประมาณ " + calc.formatDistanceKm(areaKm(area));
      btn.appendChild(name);
      btn.appendChild(km);
      btn.addEventListener("click", function () {
        const road = areaKm(area);
        setDistance({
          km: road,
          source: "area",
          areaId: area.id,
          label: areaFullLabel(area),
          lat: area.lat,
          lon: area.lon,
        });
        if (els.geoStatus) els.geoStatus.textContent = "";
      });
      els.areaList.appendChild(btn);
    });
  }

  function geoErrorMessage(err) {
    const code = err && err.code;
    if (!navigator.geolocation) return "เบราว์เซอร์นี้ใช้ตำแหน่งอัตโนมัติไม่ได้ ให้เลือกเขตหรือใส่ระยะทางเอง";
    if (typeof window !== "undefined" && !window.isSecureContext) {
      return "การใช้ตำแหน่งต้องเปิดเว็บผ่าน https ให้เลือกเขตหรือใส่ระยะทางเองได้";
    }
    if (code === 1) return "ยังไม่ได้อนุญาตให้ใช้ตำแหน่ง ให้เลือกเขตหรือใส่ระยะทางเองได้";
    if (code === 2) return "หาตำแหน่งไม่สำเร็จ ลองใหม่อีกครั้ง หรือเลือกเขตด้านล่าง";
    if (code === 3) return "ใช้เวลานานเกินไป ลองใหม่หรือเลือกเขตแทนได้";
    return "ใช้ตำแหน่งไม่สำเร็จ ให้เลือกเขตหรือใส่ระยะทางเองได้";
  }

  function requestMyLocation() {
    if (!els.geoBtn) return;
    if (!navigator.geolocation) {
      els.geoStatus.textContent = geoErrorMessage({ code: 0 });
      return;
    }
    els.geoBtn.classList.add("is-busy");
    els.geoBtn.disabled = true;
    els.geoStatus.textContent = "กำลังหาตำแหน่งของท่าน…";
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        els.geoBtn.classList.remove("is-busy");
        els.geoBtn.disabled = false;
        const dest = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        const km = calc.roadKmFromOrigin(dest, cfg);
        if (!isFinite(km)) {
          els.geoStatus.textContent = "คำนวณระยะทางจากตำแหน่งนี้ไม่ได้ ให้เลือกเขตแทนได้";
          return;
        }
        setDistance({
          km: km,
          source: "geo",
          label: "ตำแหน่งของฉัน",
          lat: dest.lat,
          lon: dest.lon,
        });
        if (els.areaSearch) els.areaSearch.value = "";
        els.geoStatus.textContent = "ใช้ตำแหน่งของฉันแล้ว · " + calc.formatDistanceKm(km) + " (ระยะประมาณ)";
      },
      function (err) {
        els.geoBtn.classList.remove("is-busy");
        els.geoBtn.disabled = false;
        els.geoStatus.textContent = geoErrorMessage(err);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    );
  }

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function scrollOpts() {
    return { top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" };
  }

  function updateChoiceSelection(container, selected) {
    const buttons = container.querySelectorAll('[role="radio"]');
    buttons.forEach(function (btn) {
      const on = btn.dataset.value === selected;
      btn.classList.toggle("is-selected", on);
      btn.setAttribute("aria-checked", on ? "true" : "false");
      btn.tabIndex = -1;
    });
    const current = selected
      ? container.querySelector('[role="radio"][data-value="' + selected + '"]')
      : buttons[0];
    if (current) current.tabIndex = 0;
  }

  function renderChoices(container, items, selected, key) {
    if (!container.dataset.bound) {
      container.innerHTML = "";
      items.forEach(function (item) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "choice";
        btn.setAttribute("role", "radio");
        btn.setAttribute("aria-checked", "false");
        btn.dataset.value = item.id;
        btn.tabIndex = -1;
        btn.innerHTML =
          '<span class="dot" aria-hidden="true"></span>' +
          '<span class="choice-title"></span>' +
          '<span class="choice-desc"></span>';
        btn.querySelector(".choice-title").textContent = item.title;
        btn.querySelector(".choice-desc").textContent = item.desc;
        btn.addEventListener("click", function () {
          state[key] = item.id;
          if (key === "location") updateLevelingAvailability();
          updateChoiceSelection(container, item.id);
          btn.focus();
          clearError(key);
        });
        container.appendChild(btn);
      });
      container.addEventListener("keydown", function (ev) {
        const buttons = Array.prototype.slice.call(container.querySelectorAll('[role="radio"]'));
        if (!buttons.length) return;
        let idx = buttons.indexOf(document.activeElement);
        if (idx < 0) idx = 0;
        let next = -1;
        if (ev.key === "ArrowDown" || ev.key === "ArrowRight") next = (idx + 1) % buttons.length;
        else if (ev.key === "ArrowUp" || ev.key === "ArrowLeft") next = (idx - 1 + buttons.length) % buttons.length;
        else if (ev.key === "Home") next = 0;
        else if (ev.key === "End") next = buttons.length - 1;
        if (next >= 0) {
          ev.preventDefault();
          buttons[next].click();
        }
      });
      container.dataset.bound = "1";
    }
    updateChoiceSelection(container, selected);
  }

  function syncChips(container, targetInput) {
    const val = String(targetInput.value);
    container.querySelectorAll(".chip").forEach(function (chip) {
      chip.classList.toggle("is-selected", chip.dataset.value === val);
    });
  }

  function renderChips(container, values, unit, targetInput, assign) {
    container.innerHTML = "";
    values.forEach(function (v) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip";
      btn.dataset.value = String(v);
      btn.textContent = v + " " + unit;
      btn.addEventListener("click", function () {
        targetInput.value = String(v);
        assign(v);
        syncChips(container, targetInput);
      });
      container.appendChild(btn);
    });
    syncChips(container, targetInput);
  }

  function updateLevelingAvailability() {
    const allowed = state.location !== "kitchen_wall";
    els.levelingInput.disabled = !allowed;
    els.levelingLabel.classList.toggle("is-disabled", !allowed);
    if (!allowed) {
      els.levelingInput.checked = false;
      state.leveling = false;
      els.levelingHint.textContent = "งานผนังอย่างเดียวไม่ต้องปรับระดับพื้น";
    } else {
      els.levelingHint.textContent = "เช่น พื้นไม่เรียบหรือมีระดับไม่เท่ากัน";
    }
  }

  function errorTargets(key) {
    const map = {
      areaSqm: { error: els.areaError, invalid: els.areaInput, focus: els.areaInput },
      tileSize: { error: els.tileError, invalid: els.tileChoices, focus: els.tileChoices.querySelector('[role="radio"]') },
      location: { error: els.locationError, invalid: els.locationChoices, focus: els.locationChoices.querySelector('[role="radio"]') },
      site: { error: els.siteError, invalid: els.siteChoices, focus: els.siteChoices.querySelector('[role="radio"]') },
      distanceKm: { error: els.distanceError, invalid: els.distanceInput, focus: els.distanceInput },
    };
    return map[key];
  }

  function clearError(key) {
    const t = errorTargets(key);
    if (!t) return;
    t.error.textContent = "";
    if (t.invalid) t.invalid.setAttribute("aria-invalid", "false");
  }

  function showError(key, message) {
    const t = errorTargets(key);
    if (!t) return;
    t.error.textContent = message;
    if (t.invalid) t.invalid.setAttribute("aria-invalid", "true");
    const node = t.invalid || t.error;
    if (node && node.scrollIntoView) {
      node.scrollIntoView({ block: "center", behavior: prefersReducedMotion() ? "auto" : "smooth" });
    }
    if (t.focus && t.focus.focus) t.focus.focus();
  }

  function showStep(step) {
    state.step = step;
    document.querySelectorAll(".step").forEach(function (el) {
      el.classList.toggle("is-active", Number(el.getAttribute("data-step")) === step);
    });
    els.progressBar.style.width = (step / state.totalSteps) * 100 + "%";
    els.progressLabel.textContent = "ขั้นตอน " + step + " จาก " + state.totalSteps;
    els.backBtn.disabled = step === 1;
    els.backBtn.style.display = step === 1 ? "none" : "";
    els.nextBtn.textContent = step === state.totalSteps ? "ดูช่วงราคา" : "ถัดไป";
    els.intro.style.display = step === 1 ? "" : "none";
    window.scrollTo(scrollOpts());
  }

  function readStepValid() {
    if (state.step === 1) {
      const n = Number(els.areaInput.value);
      state.areaSqm = n;
      if (!(n >= 0.5 && n <= 2000)) {
        showError("areaSqm", "กรุณาใส่พื้นที่เป็นตัวเลขระหว่าง 0.5 ถึง 2,000 ตร.ม.");
        return false;
      }
      clearError("areaSqm");
      return true;
    }
    if (state.step === 2) {
      if (!state.tileSize) {
        showError("tileSize", "กรุณาเลือกขนาดกระเบื้อง");
        return false;
      }
      clearError("tileSize");
      return true;
    }
    if (state.step === 3) {
      if (!state.location) {
        showError("location", "กรุณาเลือกบริเวณที่จะปู");
        return false;
      }
      clearError("location");
      return true;
    }
    if (state.step === 4) {
      if (!state.site) {
        showError("site", "กรุณาเลือกสภาพหน้างาน");
        return false;
      }
      clearError("site");
      return true;
    }
    if (state.step === 5) {
      const n = Number(state.distanceKm === "" ? els.distanceInput.value : state.distanceKm);
      if (els.distanceInput.value !== "" && state.distanceSource === "manual") {
        // keep manual value
      }
      if (state.distanceKm === "" && els.distanceInput.value !== "") {
        state.distanceKm = Number(els.distanceInput.value);
        state.distanceSource = "manual";
      }
      const km = Number(state.distanceKm);
      if (state.distanceKm === "" || Number.isNaN(km) || km < 0 || km > 500) {
        showError("distanceKm", "เลือกเขต อำเภอ ใช้ตำแหน่งของฉัน หรือใส่ระยะทาง 0 ถึง 500 กม.");
        return false;
      }
      state.distanceKm = km;
      clearError("distanceKm");
      return true;
    }
    return false;
  }

  function showResult(result) {
    state.lastResult = result;
    els.wizard.classList.add("hidden");
    els.navBar.classList.add("hidden");
    els.resultView.hidden = false;
    els.resultView.classList.add("is-visible");
    els.page.classList.add("is-result");

    els.priceRange.textContent = calc.formatBahtRange(result.rangeLow, result.rangeHigh);
    els.daysLine.textContent = "ใช้เวลาประมาณ " + result.days + " วันทำงาน";
    if (els.distanceLine) {
      const extra = result.distanceLabel ? " · " + result.distanceLabel : "";
      const approx = result.distanceApproximate ? " (ระยะประมาณ)" : "";
      els.distanceLine.textContent = calc.distanceFromShopText(result.distanceKm, cfg) + extra + approx;
    }
    if (els.resultServiceNote) {
      els.resultServiceNote.hidden = !result.beyondServiceRadius;
    }
    if (els.mapsLink) {
      const hasDest = result.destLat != null && result.destLon != null && isFinite(result.destLat);
      els.mapsLink.hidden = !hasDest;
      els.mapsLink.removeAttribute("href");
    }
    els.boxLine.textContent = result.boxes + " กล่อง";

    const heading = els.breakdown.querySelector("h3");
    els.breakdown.innerHTML = "";
    els.breakdown.appendChild(heading);
    result.reasons.forEach(function (reason) {
      const item = document.createElement("div");
      item.className = "reason";
      item.innerHTML = "<h4></h4><p></p>";
      item.querySelector("h4").textContent = reason.title;
      item.querySelector("p").textContent = reason.text;
      els.breakdown.appendChild(item);
    });

    const summary = calc.buildSummaryText(result, cfg);
    const share = calc.buildShareText ? calc.buildShareText(result, cfg) : summary;
    els.lineBtn.href = "https://line.me/R/share?text=" + encodeURIComponent(share);
    els.copyBtn.dataset.summary = summary;
    if (els.summaryBox) els.summaryBox.value = summary;
    window.scrollTo(scrollOpts());
    if (els.resultTitle) els.resultTitle.focus({ preventScroll: true });
  }

  function restart() {
    state.step = 1;
    state.areaSqm = "";
    state.tileSize = "";
    state.location = "";
    state.site = "";
    state.distanceKm = "";
    state.distanceSource = "";
    state.areaId = "";
    state.areaLabel = "";
    state.destLat = null;
    state.destLon = null;
    state.demolish = false;
    state.leveling = false;
    state.customerSuppliesTiles = true;
    state.lastResult = null;
    els.areaInput.value = "";
    els.distanceInput.value = "";
    els.demolishInput.checked = false;
    els.levelingInput.checked = false;
    ["areaSqm", "tileSize", "location", "site", "distanceKm"].forEach(clearError);
    renderChoices(els.tileChoices, TILES, "", "tileSize");
    renderChoices(els.locationChoices, LOCATIONS, "", "location");
    renderChoices(els.siteChoices, SITES, "", "site");
    document.querySelectorAll("#supplyChoices .choice").forEach(function (btn) {
      const on = btn.getAttribute("data-supply") === "customer";
      btn.classList.toggle("is-selected", on);
      btn.setAttribute("role", "radio");
      btn.setAttribute("aria-checked", on ? "true" : "false");
      btn.removeAttribute("aria-pressed");
      btn.tabIndex = on ? 0 : -1;
    });
    if (els.summaryBox) els.summaryBox.value = "";
    syncChips(els.areaChips, els.areaInput);
    if (els.areaSearch) els.areaSearch.value = "";
    if (els.geoStatus) els.geoStatus.textContent = "";
    if (els.manualDistance) els.manualDistance.open = false;
    renderAreaList("");
    updateDistancePreview();
    updateLevelingAvailability();
    els.wizard.classList.remove("hidden");
    els.navBar.classList.remove("hidden");
    els.resultView.hidden = true;
    els.resultView.classList.remove("is-visible");
    els.page.classList.remove("is-result");
    showStep(1);
  }

  function showToast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.add("is-on");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function () {
      els.toast.classList.remove("is-on");
    }, 2800);
  }

  function init() {
    els.shopName.textContent = cfg.shopName;
    document.title = "ประเมินค่าปูกระเบื้อง — " + cfg.shopName;
    els.banner.textContent = cfg.bannerText;
    els.phoneLabel.textContent = cfg.phonePlaceholder + " (หมายเลขตัวอย่าง ยังโทรไม่ได้)";

    renderChips(els.areaChips, AREA_CHIPS, "ตร.ม.", els.areaInput, function (v) {
      state.areaSqm = v;
      els.areaError.textContent = "";
    });
    renderChoices(els.tileChoices, TILES, state.tileSize, "tileSize");
    renderChoices(els.locationChoices, LOCATIONS, state.location, "location");
    renderChoices(els.siteChoices, SITES, state.site, "site");

    els.areaInput.addEventListener("input", function () {
      state.areaSqm = Number(els.areaInput.value);
      if (els.areaInput.value) clearError("areaSqm");
      syncChips(els.areaChips, els.areaInput);
    });
    renderAreaList("");
    if (els.areaSearch) {
      els.areaSearch.addEventListener("input", function () {
        renderAreaList(els.areaSearch.value);
      });
    }
    if (els.geoBtn) els.geoBtn.addEventListener("click", requestMyLocation);
    if (els.mapsLink) {
      els.mapsLink.addEventListener("click", function (ev) {
        ev.preventDefault();
        const origin = calc.shopOrigin(cfg);
        const dest = state.lastResult && state.lastResult.destLat != null
          ? { lat: state.lastResult.destLat, lon: state.lastResult.destLon }
          : null;
        const url = calc.buildMapsDirectionsUrl(origin, dest);
        if (!url) return;
        window.open(url, "_blank", "noopener,noreferrer");
      });
    }
    els.distanceInput.addEventListener("input", function () {
      const raw = els.distanceInput.value;
      if (raw === "") {
        if (state.distanceSource === "manual") setDistance({ km: "", source: "" });
        return;
      }
      const n = Number(raw);
      if (Number.isNaN(n)) return;
      setDistance({ km: n, source: "manual" });
      if (els.geoStatus) els.geoStatus.textContent = "";
    });
    els.demolishInput.addEventListener("change", function () {
      state.demolish = els.demolishInput.checked;
    });
    els.levelingInput.addEventListener("change", function () {
      state.leveling = els.levelingInput.checked;
    });

    function syncSupplyChoices() {
      els.supplyChoices.querySelectorAll(".choice").forEach(function (el) {
        const on = (el.getAttribute("data-supply") === "customer") === !!state.customerSuppliesTiles;
        el.classList.toggle("is-selected", on);
        el.setAttribute("role", "radio");
        el.setAttribute("aria-checked", on ? "true" : "false");
        el.removeAttribute("aria-pressed");
        el.tabIndex = on ? 0 : -1;
      });
    }
    syncSupplyChoices();
    els.supplyChoices.addEventListener("click", function (ev) {
      const btn = ev.target.closest(".choice");
      if (!btn) return;
      state.customerSuppliesTiles = btn.getAttribute("data-supply") === "customer";
      syncSupplyChoices();
      btn.focus();
    });
    els.supplyChoices.addEventListener("keydown", function (ev) {
      const buttons = Array.prototype.slice.call(els.supplyChoices.querySelectorAll('[role="radio"]'));
      if (!buttons.length) return;
      let idx = buttons.indexOf(document.activeElement);
      if (idx < 0) idx = 0;
      let next = -1;
      if (ev.key === "ArrowDown" || ev.key === "ArrowRight") next = (idx + 1) % buttons.length;
      else if (ev.key === "ArrowUp" || ev.key === "ArrowLeft") next = (idx - 1 + buttons.length) % buttons.length;
      if (next >= 0) {
        ev.preventDefault();
        buttons[next].click();
      }
    });

    els.nextBtn.addEventListener("click", function () {
      if (!readStepValid()) return;
      if (state.step < state.totalSteps) {
        showStep(state.step + 1);
        return;
      }
      try {
        const result = calc.calculateEstimate(
          {
            areaSqm: Number(els.areaInput.value),
            tileSize: state.tileSize,
            location: state.location,
            site: state.site,
            distanceKm: Number(state.distanceKm),
            distanceSource: state.distanceSource,
            distanceLabel: state.areaLabel,
            destLat: state.destLat,
            destLon: state.destLon,
            demolish: state.demolish,
            leveling: state.leveling,
            customerSuppliesTiles: state.customerSuppliesTiles,
          },
          cfg
        );
        showResult(result);
      } catch (err) {
        showToast("กรอกข้อมูลให้ครบก่อนนะครับ");
      }
    });

    els.backBtn.addEventListener("click", function () {
      if (state.step > 1) showStep(state.step - 1);
    });

    els.callBtn.addEventListener("click", function () {
      showToast("นี่เป็นหมายเลขตัวอย่าง " + cfg.phonePlaceholder + " ยังโทรไม่ได้");
    });

    els.copyBtn.addEventListener("click", function () {
      const text = els.copyBtn.dataset.summary || "";
      if (!text) return;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(
          function () {
            showToast("คัดลอกข้อความสรุปแล้ว");
          },
          function () {
            fallbackCopy(text);
          }
        );
      } else {
        fallbackCopy(text);
      }
    });

    els.restartBtn.addEventListener("click", restart);
    showStep(1);
  }

  function fallbackCopy(text) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      showToast("คัดลอกข้อความสรุปแล้ว");
    } catch (e) {
      showToast("คัดลอกไม่สำเร็จ ลองเลือกข้อความในกล่องสรุปด้านบนแล้วคัดลอกเองได้ครับ");
    }
    document.body.removeChild(ta);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
