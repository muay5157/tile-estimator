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
  const DIST_CHIPS = [5, 10, 20, 50, 80];

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
    distanceChips: document.getElementById("distanceChips"),
    distanceError: document.getElementById("distanceError"),
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
      const n = Number(els.distanceInput.value);
      state.distanceKm = n;
      if (els.distanceInput.value === "" || Number.isNaN(n) || n < 0 || n > 500) {
        showError("distanceKm", "กรุณาใส่ระยะทางขาเดียว 0 ถึง 500 กม.");
        return false;
      }
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
    syncChips(els.distanceChips, els.distanceInput);
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
    renderChips(els.distanceChips, DIST_CHIPS, "กม.", els.distanceInput, function (v) {
      state.distanceKm = v;
      els.distanceError.textContent = "";
    });
    renderChoices(els.tileChoices, TILES, state.tileSize, "tileSize");
    renderChoices(els.locationChoices, LOCATIONS, state.location, "location");
    renderChoices(els.siteChoices, SITES, state.site, "site");

    els.areaInput.addEventListener("input", function () {
      state.areaSqm = Number(els.areaInput.value);
      if (els.areaInput.value) clearError("areaSqm");
      syncChips(els.areaChips, els.areaInput);
    });
    els.distanceInput.addEventListener("input", function () {
      state.distanceKm = Number(els.distanceInput.value);
      if (els.distanceInput.value !== "") clearError("distanceKm");
      syncChips(els.distanceChips, els.distanceInput);
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
            distanceKm: Number(els.distanceInput.value),
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
