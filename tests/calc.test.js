#!/usr/bin/env node
"use strict";

const path = require("path");
const config = require(path.join(__dirname, "..", "config.js"));
const calc = require(path.join(__dirname, "..", "calc.js"));

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error("FAIL:", msg);
  } else {
    console.log("PASS:", msg);
  }
}

function almost(a, b, eps, msg) {
  assert(Math.abs(a - b) <= (eps || 0.01), msg + " (got " + a + ", expected " + b + ")");
}

const a = calc.calculateEstimate(
  {
    areaSqm: 3,
    tileSize: "10x10",
    location: "kitchen_wall",
    site: "condo",
    distanceKm: 10,
    customerSuppliesTiles: true,
  },
  config
);

const b = calc.calculateEstimate(
  {
    areaSqm: 60,
    tileSize: "60x60",
    location: "hall_floor",
    site: "house_ground",
    distanceKm: 10,
    customerSuppliesTiles: true,
  },
  config
);

const c = calc.calculateEstimate(
  {
    areaSqm: 25,
    tileSize: "30x30",
    location: "bathroom_floor_wall",
    site: "house_upper",
    distanceKm: 50,
    customerSuppliesTiles: true,
  },
  config
);

console.log("\n=== Scenario A: condo kitchen wall 3 m² 10x10, 10 km ===");
console.log(JSON.stringify(summarize(a), null, 2));
assert(a.minApplied === true, "A: minimum charge applies");
assert(a.labor === config.minimumJobCharge, "A: labor equals minimum job charge");
assert(a.laborBeforeMin < config.minimumJobCharge, "A: raw labor is below minimum");
assert(a.rangeLow >= config.minimumJobCharge, "A: range low is at least minimum");
assert(a.days >= 1, "A: at least 1 day");
assert(a.boxes >= 4, "A: boxes include ~10% waste (3 * 1.1 / 1.0 = 4)");
assert(a.reasons.some(function (r) { return r.id === "minimum"; }), "A: has minimum reason");
assert(a.reasons.some(function (r) { return /100 แผ่น/.test(r.text); }), "A: mentions 100 tiles/m²");
assert(a.reasons.some(function (r) { return r.id === "site" && /คอนโด/.test(r.text); }), "A: condo reason");

console.log("\n=== Scenario B: house ground hall 60 m² 60x60, 10 km ===");
console.log(JSON.stringify(summarize(b), null, 2));
assert(b.minApplied === false, "B: minimum charge does not apply");
assert(b.laborCore === 60 * 500 * 1 * 1, "B: labor core is 60 * 500");
assert(b.days === 4, "B: 60 / 18 = 4 days");
assert(b.rangeLow < b.rangeHigh, "B: has a price range");
assert(b.boxes === Math.ceil((60 * 1.1) / 1.44), "B: boxes = ceil(66 / 1.44)");
assert(b.totalWeightKg > 1000, "B: tile weight is over 1 ton including waste");
assert(b.reasons.some(function (r) { return /3 แผ่น/.test(r.text); }), "B: tile size reason says about 3 tiles/m²");

console.log("\n=== Scenario C: 2nd floor bathroom 25 m² 30x30, 50 km ===");
console.log(JSON.stringify(summarize(c), null, 2));
assert(c.minApplied === false, "C: minimum charge does not apply");
almost(c.laborCore, 25 * 620 * 1.5 * 1.2, 0.1, "C: labor core 25*620*1.5*1.2");
assert(c.days === 5, "C: ceil(25 / (6*0.85)) = 5 days");
almost(c.travel, 50 * 2 * 6 * 5, 0.1, "C: travel 50km * 2 * 6 * 5 days");
assert(c.travel > 1000, "C: travel is a meaningful part of the price");
assert(c.reasons.some(function (r) { return /ตัดเศษ/.test(r.text) || /รูท่อ/.test(r.text); }), "C: bathroom cut reason");
assert(c.reasons.some(function (r) { return /ชั้น/.test(r.text) && /แบก/.test(r.text); }), "C: carrying upstairs reason");
assert(c.reasons.some(function (r) { return r.id === "distance" && /50/.test(r.title); }), "C: 50 km reason");

assert(a.total < b.total, "sanity: 3 m² job costs less than 60 m² hall job");
assert(b.labor / b.area < a.labor / a.area, "sanity: effective baht/m² is higher on the tiny condo job");
assert(c.days >= b.days, "sanity: 25 m² bathroom/upstairs takes at least as many days as 60 m² hall");

const d = calc.calculateEstimate(
  {
    areaSqm: 10,
    tileSize: "60x60",
    location: "hall_floor",
    site: "house_ground",
    distanceKm: 10,
    customerSuppliesTiles: true,
  },
  config
);
const e = calc.calculateEstimate(
  {
    areaSqm: 9,
    tileSize: "60x60",
    location: "hall_floor",
    site: "house_ground",
    distanceKm: 10,
    customerSuppliesTiles: true,
  },
  config
);
const f = calc.calculateEstimate(
  {
    areaSqm: 3,
    tileSize: "10x10",
    location: "kitchen_wall",
    site: "condo",
    distanceKm: 10,
    demolish: true,
    customerSuppliesTiles: true,
  },
  config
);

console.log("\n=== Scenario D: 10 m² hall at the minimum-charge boundary ===");
console.log(JSON.stringify(summarize(d), null, 2));
assert(d.minApplied === false, "D: raw labor equals minimum, so minApplied is false");
assert(d.labor === config.minimumJobCharge, "D: labor is exactly the minimum");
assert(d.rangeLow === config.minimumJobCharge, "D: range low is floored at the minimum (not 90% of total)");
assert(d.rangeHigh === e.rangeHigh, "D: high end matches the 9 m² sibling with the same total");
assert(d.rangeLow === e.rangeLow, "D: low end matches the 9 m² job that did hit the minimum");

console.log("\n=== Scenario E: 9 m² hall just under the minimum ===");
assert(e.minApplied === true, "E: 9 m² is below the minimum");
assert(e.rangeLow === config.minimumJobCharge, "E: range low is the minimum");

console.log("\n=== Scenario F: tiny condo job with demolish, still under minimum ===");
assert(f.minApplied === true, "F: demolish still under the minimum");
assert(f.labor === config.minimumJobCharge, "F: labor stays at the minimum");
assert(f.rangeLow === a.rangeLow && f.rangeHigh === a.rangeHigh, "F: price range unchanged vs A without demolish");
assert(f.reasons.some(function (r) { return r.id === "demolish" && /ค่าแรงขั้นต่ำ/.test(r.text); }), "F: demolish reason explains the minimum covers it");

const share = calc.buildShareText(a, config);
assert(share.indexOf("บาท –") === -1, "share text does not say baht twice in the range");
assert(/5,000 – 6,100 บาท/.test(share), "share text uses formatBahtRange");
assert(share.indexOf("ราคาตัวอย่าง ยังไม่ใช่ราคาจริง") !== -1, "share text keeps the example banner");
const full = calc.buildSummaryText(a, config);
assert(/5,000 – 6,100 บาท/.test(full), "full summary uses formatBahtRange");
assert(full.length > share.length, "full summary is longer than the LINE share text");

console.log("\n=== Geo / shop origin ===");
const origin = config.shopOrigin;
assert(origin && Math.abs(origin.lat - 13.78706) < 0.0001, "origin lat is ปากซอยลาดพร้าว 71 (OSM)");
assert(Math.abs(origin.lon - 100.60776) < 0.0001, "origin lon is ปากซอยลาดพร้าว 71 (OSM)");
assert(origin.label.indexOf("ลาดพร้าว 71") !== -1, "origin label names Lat Phrao 71");
assert(Math.abs(config.roadFactor - 1.3) < 0.0001, "default road factor is 1.3");
assert(config.maxServiceRadiusKm === 60, "default service radius is 60 km");
almost(calc.haversineKm(origin, origin), 0, 0.0001, "haversine to self is 0");
assert((config.serviceAreas || []).length === 79, "50 Bangkok districts + 29 greater-Bangkok amphoes");
assert(config.serviceAreas.filter(function (a) { return a.province === "กรุงเทพมหานคร"; }).length === 50, "exactly 50 Bangkok districts");

function areaByName(name, province) {
  return config.serviceAreas.find(function (a) {
    return a.name === name && (!province || a.province === province);
  });
}
function roadOf(name, province) {
  const a = areaByName(name, province);
  assert(!!a, "has area " + name);
  return calc.roadKmFromOrigin({ lat: a.lat, lon: a.lon }, config);
}
almost(roadOf("บางกะปิ"), 5.2, 0.15, "บางกะปิ approx road km");
almost(roadOf("บางนา"), 17.1, 0.15, "บางนา approx road km");
almost(roadOf("บางบัวทอง", "นนทบุรี"), 36.4, 0.15, "บางบัวทอง approx road km");
almost(roadOf("วังทองหลาง"), 1.2, 0.15, "วังทองหลาง (shop district) is very close");
assert(calc.isBeyondServiceRadius(60.1, config) === true, "61 km is beyond radius");
assert(calc.isBeyondServiceRadius(60, config) === false, "60 km is within radius");
const far = calc.calculateEstimate({
  areaSqm: 10, tileSize: "60x60", location: "hall_floor", site: "house_ground",
  distanceKm: 70, distanceSource: "area", distanceLabel: "อำเภอเมืองนครปฐม นครปฐม",
  destLat: 13.82, destLon: 100.02,
}, config);
assert(far.beyondServiceRadius === true, "result flags beyond service radius");
assert(far.reasons.some(function (r) { return r.id === "service-radius"; }), "beyond-radius reason present");
assert(/ห่างจากร้าน \(ปากซอยลาดพร้าว 71\) ประมาณ/.test(calc.distanceFromShopText(5.2, config)), "distance sentence uses shop label");
const maps = calc.buildMapsDirectionsUrl(origin, { lat: 13.769474, lon: 100.639675 });
assert(maps.indexOf("https://www.google.com/maps/dir/?api=1&origin=") === 0, "maps url is directions API");
assert(maps.indexOf(encodeURIComponent(origin.lat + "," + origin.lon)) !== -1, "maps url encodes origin");
assert(maps.indexOf("destination=") !== -1, "maps url has destination");
assert(!/api[_-]?key|key=/i.test(maps), "maps url has no API key");
assert(calc.buildMapsDirectionsUrl(origin, null) === "", "maps url empty without destination");

console.log("\n=== Done:", failed === 0 ? "ALL PASSED" : failed + " failed", "===");
process.exit(failed === 0 ? 0 : 1);

function summarize(r) {
  return {
    laborBeforeMin: r.laborBeforeMin,
    minApplied: r.minApplied,
    labor: r.labor,
    days: r.days,
    travel: r.travel,
    total: r.total,
    range: [r.rangeLow, r.rangeHigh],
    boxes: r.boxes,
    coverArea: r.coverArea,
    totalWeightKg: r.totalWeightKg,
  };
}
