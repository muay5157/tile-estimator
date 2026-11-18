/**
 * calc.js — คำนวณช่วงค่าแรงปูกระเบื้องจากค่าใน config.js
 * ใช้ได้ทั้งในเบราว์เซอร์และใน Node (สำหรับเทส)
 */
(function (root) {
  function ceilTo(value, step) {
    return Math.ceil(value / step) * step;
  }

  function floorTo(value, step) {
    return Math.floor(value / step) * step;
  }

  function roundMoney(value) {
    return Math.round(value * 100) / 100;
  }

  function formatBaht(n) {
    const v = Math.round(n);
    return v.toLocaleString("th-TH") + " บาท";
  }

  function formatBahtRange(low, high) {
    return formatNumber(Math.round(low)) + " – " + formatNumber(Math.round(high)) + " บาท";
  }

  function tilesPerSqm(config, tileSize) {
    const area = config.tileAreaM2[tileSize];
    return area ? 1 / area : 0;
  }

  /**
   * @param {object} input
   * @param {number} input.areaSqm
   * @param {string} input.tileSize  60x60 | 30x30 | 10x10 | 60x120
   * @param {string} input.location  hall_floor | parking | bathroom_floor_wall | kitchen_wall
   * @param {string} input.site      house_ground | house_upper | condo
   * @param {number} input.distanceKm ระยะทางขาเดียว (กม.)
   * @param {boolean} [input.demolish]
   * @param {boolean} [input.leveling]
   * @param {boolean} [input.customerSuppliesTiles] true = ลูกค้าเตรียมกระเบื้องเอง
   * @param {object} [config]
   */
  function calculateEstimate(input, config) {
    const cfg = config || root.TILE_ESTIMATOR_CONFIG;
    const area = Number(input.areaSqm);
    const distanceKm = Math.max(0, Number(input.distanceKm) || 0);
    const tileSize = input.tileSize;
    const location = input.location;
    const site = input.site;

    if (!(area > 0) || !cfg.baseLaborPerSqm[tileSize] || !cfg.locationMultiplier[location] || !cfg.siteMultiplier[site]) {
      throw new Error("ข้อมูลไม่ครบหรือไม่ถูกต้อง");
    }

    const baseRate = cfg.baseLaborPerSqm[tileSize];
    const locMult = cfg.locationMultiplier[location];
    const siteMult = cfg.siteMultiplier[site];
    const laborCore = area * baseRate * locMult * siteMult;

    const levelingAllowed = location !== "kitchen_wall";
    const demolish = !!input.demolish;
    const leveling = !!input.leveling && levelingAllowed;
    const demolishCost = demolish ? area * cfg.addons.demolishPerSqm : 0;
    const levelingCost = leveling ? area * cfg.addons.levelingPerSqm : 0;

    const laborBeforeMin = laborCore + demolishCost + levelingCost;
    const minApplied = laborBeforeMin < cfg.minimumJobCharge;
    const labor = minApplied ? cfg.minimumJobCharge : laborBeforeMin;

    const rawPerDay = cfg.sqmPerDay[tileSize][location];
    const productivity = cfg.siteProductivity[site];
    const effectivePerDay = rawPerDay * productivity;
    const days = Math.max(1, Math.ceil(area / effectivePerDay));

    const travel = distanceKm * 2 * cfg.travelCostPerKm * days;
    const total = labor + travel;

    const step = cfg.rounding || 100;
    let rangeLow = floorTo(total * cfg.rangeLowFactor, step);
    let rangeHigh = ceilTo(total * cfg.rangeHighFactor, step);
    // ช่วงล่างไม่ต่ำกว่าค่าแรงขั้นต่ำ แม้แรงดิบจะพอดีหรือสูงกว่าขั้นต่ำเพียงเล็กน้อย
    rangeLow = Math.max(rangeLow, cfg.minimumJobCharge);
    if (rangeHigh <= rangeLow) {
      rangeHigh = rangeLow + step * 5;
    }

    const coverArea = area * cfg.wasteFactor;
    const m2PerBox = cfg.m2PerBox[tileSize];
    const boxes = Math.max(1, Math.ceil(coverArea / m2PerBox));
    const kgPerBox = cfg.kgPerBox[tileSize];
    const totalWeightKg = boxes * kgPerBox;
    const tilesApprox = Math.ceil(coverArea / cfg.tileAreaM2[tileSize]);
    const perSqm = tilesPerSqm(cfg, tileSize);

    const reasons = buildReasons({
      cfg,
      input,
      area,
      tileSize,
      location,
      site,
      distanceKm,
      demolish,
      leveling,
      levelingAllowed,
      baseRate,
      locMult,
      siteMult,
      laborBeforeMin,
      minApplied,
      labor,
      days,
      travel,
      total,
      boxes,
      totalWeightKg,
      perSqm,
    });

    return {
      area,
      tileSize,
      location,
      site,
      distanceKm,
      demolish,
      leveling,
      customerSuppliesTiles: !!input.customerSuppliesTiles,
      baseRate,
      locMult,
      siteMult,
      laborCore: roundMoney(laborCore),
      demolishCost: roundMoney(demolishCost),
      levelingCost: roundMoney(levelingCost),
      laborBeforeMin: roundMoney(laborBeforeMin),
      minApplied,
      labor: roundMoney(labor),
      minimumJobCharge: cfg.minimumJobCharge,
      days,
      effectivePerDay: roundMoney(effectivePerDay),
      travel: roundMoney(travel),
      total: roundMoney(total),
      rangeLow,
      rangeHigh,
      boxes,
      tilesApprox,
      perSqm,
      totalWeightKg: roundMoney(totalWeightKg),
      kgPerBox,
      coverArea: roundMoney(coverArea),
      reasons,
    };
  }

  function buildReasons(ctx) {
    const reasons = [];
    const {
      cfg,
      input,
      area,
      tileSize,
      location,
      site,
      distanceKm,
      demolish,
      leveling,
      minApplied,
      labor,
      days,
      travel,
      boxes,
      totalWeightKg,
      perSqm,
    } = ctx;

    if (minApplied) {
      reasons.push({
        id: "minimum",
        title: "คิดค่าแรงขั้นต่ำต่องาน",
        text:
          "งานเล็กแบบนี้ถ้าคิดแค่ตารางเมตรละเท่าไหร่ จะไม่คุ้มค่าเดินทาง ขนของ และตั้งเครื่องมือ เลยคิดเป็นค่าแรงขั้นต่ำต่องาน " +
          formatBaht(cfg.minimumJobCharge) +
          " (ตัวเลขตัวอย่าง) แทนการคูณพื้นที่อย่างเดียว",
      });
    } else {
      reasons.push({
        id: "area",
        title: "พื้นที่ " + formatNumber(area) + " ตร.ม.",
        text:
          "เริ่มจากค่าแรงพื้นฐานตามขนาดกระเบื้อง แล้วคูณด้วยบริเวณและสภาพหน้างาน พื้นที่มากจะเฉลี่ยต้นทุนตั้งงานได้ดีกว่างานเล็ก ๆ",
      });
    }

    const tileText = {
      "60x60":
        "กระเบื้อง 60×60 แผ่นหนึ่งประมาณ 0.36 ตร.ม. ตกประมาณ 3 แผ่นต่อตารางเมตร ปูพื้นโถงหรือพื้นที่โล่งได้ค่อนข้างเร็ว",
      "30x30":
        "กระเบื้อง 30×30 แผ่นหนึ่งประมาณ 0.09 ตร.ม. ตกประมาณ 11 แผ่นต่อตารางเมตร ใช้เวลาต่อตารางเมตรมากกว่าแผ่นใหญ่",
      "10x10":
        "กระเบื้อง 10×10 แผ่นเล็ก ตารางเมตรหนึ่งต้องปูถึงประมาณ 100 แผ่น ใช้เวลานานกว่าแผ่น 60×60 มาก เพราะต้องวางและจัดแนวทีละแผ่น",
      "60x120":
        "กระเบื้อง 60×120 เป็นแผ่นใหญ่ ตารางเมตรหนึ่งใช้ประมาณ 1–2 แผ่น แต่ยกยาก ต้องจัดระดับและแนวให้ดี จึงคิดค่าแรงสูงกว่าแผ่น 60×60 ทั่วไป",
    };
    reasons.push({
      id: "tile",
      title: "ขนาดกระเบื้อง " + tileSize.replace("x", "×") + " ซม.",
      text: tileText[tileSize],
    });

    const locText = {
      hall_floor: "พื้นโถงหรือพื้นห้องทั่วไปปูได้เร็วกว่า เพราะใช้แผ่นเต็มได้เยอะ ตัดเศษไม่มาก",
      parking: "ลานจอดรถโดยทั่วไปเป็นพื้นโล่ง ปูแผ่นเต็มได้เยอะ ตัดเศษน้อย จึงใช้เวลาน้อยกว่างานในห้องแคบ",
      bathroom_floor_wall:
        "ห้องน้ำต้องตัดเศษบ่อย ปูไปไม่กี่แผ่นก็เจอมุม รูท่อ หรือรูก๊อก จึงช้าและยากกว่าปูพื้นโถงมาก",
      kitchen_wall:
        "ผนังกันเปื้อนครัวมักเป็นพื้นที่แคบ มีมุม ขอบเคาน์เตอร์ และจุดตัดรอบเตาหรืออ่างล้างจาน จึงช้ากว่าปูพื้นโล่ง",
    };
    const locTitle = {
      hall_floor: "ปูพื้นโถง / ห้องทั่วไป",
      parking: "ปูลานจอดรถ",
      bathroom_floor_wall: "ปูพื้นและผนังห้องน้ำ",
      kitchen_wall: "ปูผนังกันเปื้อนครัว",
    };
    reasons.push({
      id: "location",
      title: locTitle[location],
      text: locText[location],
    });

    if (site === "house_ground") {
      reasons.push({
        id: "site",
        title: "หน้างานเป็นบ้านชั้น 1",
        text: "ขนกระเบื้อง ปูนกาว และเครื่องมือเข้าออกได้สะดวก ทิ้งเศษวัสดุง่าย จึงเป็นหน้างานที่ต้นทุนต่ำกว่าแบบอื่น",
      });
    } else if (site === "house_upper") {
      const tons = totalWeightKg / 1000;
      reasons.push({
        id: "site",
        title: "หน้างานเป็นบ้านชั้นบน",
        text:
          "ช่างต้องแบกกระเบื้องขึ้นชั้น กล่องหนึ่งหนักประมาณ " +
          formatNumber(cfg.kgPerBox[tileSize]) +
          " กก. งานนี้ประมาณ " +
          boxes +
          " กล่อง (รวมเผื่อเศษ) น้ำหนักรวมราว " +
          formatNumber(Math.round(totalWeightKg)) +
          " กก." +
          (tons >= 0.8 ? " หรือประมาณ " + formatNumber(Math.round(tons * 10) / 10) + " ตัน" : "") +
          " ยังไม่นับปูนและเครื่องมือ",
      });
    } else if (site === "condo") {
      reasons.push({
        id: "site",
        title: "หน้างานเป็นคอนโด",
        text: "งานคอนโดใช้เวลามากกว่าบ้าน เพราะต้องหาที่จอด แลกบัตร ขนของขึ้นลิฟต์ พื้นที่ทำงานแคบ เข้าได้เฉพาะเวลาที่นิติบุคคลกำหนด และมักเข้าไม่ได้วันเสาร์ อาทิตย์ หรือวันนักขัตฤกษ์",
      });
    }

    if (distanceKm <= 0) {
      reasons.push({
        id: "distance",
        title: "ยังไม่นับค่าเดินทางเพิ่ม",
        text: "ถ้าหน้างานอยู่ใกล้บ้านช่าง จะไม่บวกค่าเดินทางในหน้านี้ หากอยู่ไกล ค่าน้ำมันและเวลาเดินทางในแต่ละวันจะเพิ่มขึ้น",
      });
    } else {
      reasons.push({
        id: "distance",
        title: "ระยะทางขาเดียว " + formatNumber(distanceKm) + " กม.",
        text:
          "ไป-กลับประมาณ " +
          formatNumber(distanceKm * 2) +
          " กม. ต่อวัน คิดค่าเดินทางตัวอย่าง " +
          formatBaht(travel) +
          " สำหรับงานประมาณ " +
          days +
          " วัน หน้างานที่ไกลกว่าทำให้ค่าใช้จ่ายต่อวันสูงขึ้นชัดเจน",
      });
    }

    reasons.push({
      id: "days",
      title: "ใช้เวลาประมาณ " + days + " วันทำงาน",
      text:
        "ประมาณจากขนาดกระเบื้อง บริเวณที่ปู และสภาพหน้างาน เป็นวันทำงานโดยประมาณ ไม่ใช่นัดหมายจริง และยังขึ้นกับว่าเริ่มงานได้เมื่อไหร่",
    });

    if (demolish) {
      reasons.push({
        id: "demolish",
        title: minApplied ? "รื้อกระเบื้องเก่า (อยู่ในค่าแรงขั้นต่ำแล้ว)" : "รวมรื้อกระเบื้องเก่า",
        text: minApplied
          ? "เลือกรื้อของเก่าไว้แล้ว แต่ค่าแรงขั้นต่ำต่องานครอบคลุมรายการนี้แล้ว ยอดที่แสดงจึงยังเท่ากับค่าแรงขั้นต่ำ ไม่ได้คิดเพิ่มอีก"
          : "มีค่ารื้อและเก็บเศษกระเบื้องเดิมคิดเพิ่มในค่าแรง (อัตราตัวอย่าง) ยังไม่รวมค่าขนทิ้งพิเศษถ้าหน้างานจำกัด",
      });
    }
    if (leveling) {
      reasons.push({
        id: "leveling",
        title: minApplied ? "ปรับระดับพื้น (อยู่ในค่าแรงขั้นต่ำแล้ว)" : "รวมปรับระดับพื้น",
        text: minApplied
          ? "เลือกปรับระดับพื้นไว้แล้ว แต่ค่าแรงขั้นต่ำต่องานครอบคลุมรายการนี้แล้ว ยอดที่แสดงจึงยังเท่ากับค่าแรงขั้นต่ำ ไม่ได้คิดเพิ่มอีก"
          : "พื้นที่ไม่เรียบต้องปรับระดับก่อนปู ไม่งั้นกระเบื้องจะล่อนหรือเห็นรอยต่อไม่สวย คิดเพิ่มในค่าแรงเป็นอัตราตัวอย่าง",
      });
    }

    if (input.customerSuppliesTiles) {
      reasons.push({
        id: "tiles",
        title: "ลูกค้าจัดเตรียมกระเบื้องเอง",
        text:
          "ค่าแรงนี้ยังไม่รวมค่ากระเบื้อง ควรเตรียมประมาณ " +
          boxes +
          " กล่อง (รวมเผื่อเศษตัดและของแตกประมาณ 10%) และเผื่อเวลานำเข้าหน้างาน",
      });
    } else {
      reasons.push({
        id: "tiles",
        title: "ถ้าให้ช่างจัดหากระเบื้องให้",
        text:
          "ยอดในหน้านี้เป็นค่าแรงอย่างเดียว ยังไม่รวมค่ากระเบื้อง งานนี้ใช้กระเบื้องประมาณ " +
          boxes +
          " กล่อง รวมเผื่อเศษประมาณ 10% ราคาแผ่นจริงแล้วแต่เบอร์และร้านที่เลือก",
      });
    }

    return reasons;
  }

  function formatNumber(n) {
    const v = Number(n);
    if (Math.abs(v - Math.round(v)) < 0.15) {
      return Math.round(v).toLocaleString("th-TH");
    }
    return v.toLocaleString("th-TH", { maximumFractionDigits: 1 });
  }

  function buildSummaryText(result, cfg) {
    const c = cfg || root.TILE_ESTIMATOR_CONFIG;
    const locLabel = {
      hall_floor: "พื้นโถง/ห้องทั่วไป",
      parking: "ลานจอดรถ",
      bathroom_floor_wall: "พื้น+ผนังห้องน้ำ",
      kitchen_wall: "ผนังกันเปื้อนครัว",
    };
    const siteLabel = {
      house_ground: "บ้านชั้น 1",
      house_upper: "บ้านชั้นบน",
      condo: "คอนโด",
    };
    const extras = [];
    if (result.demolish) extras.push("รื้อกระเบื้องเก่า");
    if (result.leveling) extras.push("ปรับระดับพื้น");
    extras.push(result.customerSuppliesTiles ? "ลูกค้าเตรียมกระเบื้องเอง" : "ให้ช่างจัดหากระเบื้อง (ยังไม่รวมในยอด)");

    const lines = [
      "สรุปประเมินค่าปูกระเบื้อง (ราคาตัวอย่าง ยังไม่ใช่ราคาจริง)",
      "ร้าน: " + c.shopName,
      "",
      "พื้นที่: " + formatNumber(result.area) + " ตร.ม.",
      "ขนาดกระเบื้อง: " + result.tileSize.replace("x", "×") + " ซม.",
      "บริเวณ: " + locLabel[result.location],
      "หน้างาน: " + siteLabel[result.site],
      "ระยะทางขาเดียว: " + formatNumber(result.distanceKm) + " กม.",
      "รายการเพิ่ม: " + extras.join(", "),
      "",
      "ค่าแรงโดยประมาณ: " + formatBahtRange(result.rangeLow, result.rangeHigh),
      "ใช้เวลาประมาณ: " + result.days + " วันทำงาน",
      "กระเบื้องโดยประมาณ: " + result.boxes + " กล่อง (รวมเผื่อเศษ ~10%)",
      "",
      "เหตุผลคร่าว ๆ:",
    ];
    result.reasons.forEach(function (r) {
      lines.push("- " + r.title + ": " + r.text);
    });
    lines.push("");
    lines.push("หมายเหตุ: ตัวเลขเป็นตัวอย่างสำหรับคุยงานเท่านั้น ยังไม่ใช่ใบเสนอราคาจริง");
    return lines.join("\n");
  }

  function buildShareText(result, cfg) {
    const c = cfg || root.TILE_ESTIMATOR_CONFIG;
    return [
      "สรุปประเมินค่าปูกระเบื้อง (ราคาตัวอย่าง ยังไม่ใช่ราคาจริง)",
      "ร้าน: " + c.shopName,
      "พื้นที่: " + formatNumber(result.area) + " ตร.ม. · กระเบื้อง " + result.tileSize.replace("x", "×") + " ซม.",
      "ค่าแรงโดยประมาณ: " + formatBahtRange(result.rangeLow, result.rangeHigh),
      "ใช้เวลาประมาณ: " + result.days + " วันทำงาน",
      "กระเบื้องโดยประมาณ: " + result.boxes + " กล่อง (รวมเผื่อเศษ ~10%)",
      "หมายเหตุ: ตัวเลขเป็นตัวอย่างสำหรับคุยงานเท่านั้น ยังไม่ใช่ใบเสนอราคาจริง",
    ].join("\n");
  }

  const api = {
    calculateEstimate: calculateEstimate,
    formatBaht: formatBaht,
    formatBahtRange: formatBahtRange,
    formatNumber: formatNumber,
    buildSummaryText: buildSummaryText,
    buildShareText: buildShareText,
  };

  root.TileEstimatorCalc = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
