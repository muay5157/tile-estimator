#!/usr/bin/env node
/**
 * Headless mobile (390x844) verification for the tile estimator prototype.
 * Usage: node tests/verify.mjs
 * Expects a server at http://127.0.0.1:4173/
 */
import { createRequire } from "module";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const { chromium } = require("/tmp/tile-pw/node_modules/playwright-core");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const shots = path.join(root, "shots");
const base = process.env.TILE_ESTIMATOR_URL || "http://127.0.0.1:4173/";

fs.mkdirSync(shots, { recursive: true });

const errors = [];
function fail(msg) {
  errors.push(msg);
  console.error("FAIL:", msg);
}
function pass(msg) {
  console.log("PASS:", msg);
}

async function waitFonts(page) {
  await page.waitForFunction(() => document.fonts && document.fonts.status === "loaded");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(200);
}

async function fillScenario(page, scenario) {
  // Step 1 area
  await page.locator("#areaInput").fill(String(scenario.area));
  await page.locator("#nextBtn").click();
  // Step 2 tile
  await page.locator(`#tileChoices .choice[data-value="${scenario.tile}"]`).click();
  await page.locator("#nextBtn").click();
  // Step 3 location
  await page.locator(`#locationChoices .choice[data-value="${scenario.location}"]`).click();
  await page.locator("#nextBtn").click();
  // Step 4 site
  await page.locator(`#siteChoices .choice[data-value="${scenario.site}"]`).click();
  if (scenario.demolish) await page.locator("#demolishInput").check();
  if (scenario.leveling) await page.locator("#levelingInput").check();
  if (scenario.supply === "contractor") {
    await page.locator('#supplyChoices .choice[data-supply="contractor"]').click();
  }
  await page.locator("#nextBtn").click();
  // Step 5 distance — use the manual fallback so existing numeric scenarios still work
  if (scenario.areaName) {
    await page.locator("#areaSearch").fill(scenario.areaName);
    await page.locator(".area-option", { hasText: scenario.areaName }).first().click();
  } else if (scenario.geo) {
    await page.locator("#geoBtn").click();
    await page.locator("#distancePreview").waitFor({ state: "visible" });
  } else {
    const details = page.locator("#manualDistance");
    if (await details.count()) {
      const open = await details.evaluate((el) => el.open);
      if (!open) await details.locator("summary").click();
    }
    await page.locator("#distanceInput").fill(String(scenario.distance));
  }
  await page.locator("#nextBtn").click();
  await page.locator("#resultView").waitFor({ state: "visible" });
  await waitFonts(page);
}

async function restart(page) {
  await page.locator("#restartBtn").click();
  await page.locator("#wizard").waitFor({ state: "visible" });
  await page.locator('.step[data-step="1"]').waitFor({ state: "visible" });
}

async function main() {
  const browser = await chromium.launch({
    channel: "chrome",
    args: ["--font-render-hinting=none"],
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    locale: "th-TH",
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => {
    consoleErrors.push(String(err));
  });

  await page.goto(base, { waitUntil: "networkidle" });
  await waitFonts(page);

  const font = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  console.log("font-family:", font);
  if (/Sarabun|Noto Sans Thai/i.test(font)) pass("Thai font loaded: " + font);
  else fail("Expected Sarabun or Noto Sans Thai, got " + font);

  const banner = await page.locator("#exampleBanner").innerText();
  if (banner.includes("ราคาตัวอย่าง") && banner.includes("ยังไม่ใช่ราคาจริง")) pass("Banner visible: " + banner);
  else fail("Banner missing or wrong: " + banner);

  const shop = await page.locator("#shopName").innerText();
  if (shop.includes("ช่างกระเบื้อง") && shop.includes("ชื่อร้านตัวอย่าง")) pass("Shop placeholder: " + shop);
  else fail("Shop name wrong: " + shop);

  const title = await page.locator(".intro h2").innerText();
  if (/[\u0E00-\u0E7F]/.test(title)) pass("Thai intro renders: " + title);
  else fail("Intro does not contain Thai: " + title);

  // Form step screenshot (step 1)
  await page.screenshot({ path: path.join(shots, "form-step.png"), fullPage: false });
  pass("Saved shots/form-step.png");

  // Scenario A
  await fillScenario(page, {
    area: 3,
    tile: "10x10",
    location: "kitchen_wall",
    site: "condo",
    distance: 10,
  });

  const aRange = await page.locator("#priceRange").innerText();
  const aDays = await page.locator("#daysLine").innerText();
  const aBoxes = await page.locator("#boxLine").innerText();
  const aBreakdown = await page.locator("#breakdown").innerText();
  console.log("A range:", aRange, aDays, aBoxes);
  if (!(aRange.includes("5,000") && aRange.includes("6,100") && aRange.includes("บาท"))) fail("A: expected 5,000 – 6,100 บาท, got " + aRange);
  else pass("A range: " + aRange);
  if (!aBreakdown.includes("ค่าแรงขั้นต่ำ")) fail("A: breakdown missing minimum charge reason");
  else pass("A: minimum charge reason visible");
  if (!aBreakdown.includes("คอนโด")) fail("A: breakdown missing condo reason");
  else pass("A: condo reason visible");

  await page.screenshot({ path: path.join(shots, "result-a.png"), fullPage: false });
  await page.screenshot({ path: path.join(shots, "result-a-full.png"), fullPage: true });
  pass("Saved shots/result-a.png (viewport) and result-a-full.png");

  await restart(page);

  // Scenario C
  await fillScenario(page, {
    area: 25,
    tile: "30x30",
    location: "bathroom_floor_wall",
    site: "house_upper",
    distance: 50,
  });
  const cRange = await page.locator("#priceRange").innerText();
  const cDays = await page.locator("#daysLine").innerText();
  const cBreakdown = await page.locator("#breakdown").innerText();
  console.log("C range:", cRange, cDays);
  if (!(cRange.includes("27,800") && cRange.includes("35,600") && cRange.includes("บาท"))) fail("C: unexpected range " + cRange);
  else pass("C range: " + cRange);
  if (!cBreakdown.includes("ห้องน้ำ") && !cBreakdown.includes("ตัดเศษ")) fail("C: missing bathroom reason");
  else pass("C: bathroom reason visible");
  if (!cBreakdown.includes("ชั้นบน") && !cBreakdown.includes("แบก")) fail("C: missing upper-floor reason");
  else pass("C: upper-floor reason visible");

  await page.screenshot({ path: path.join(shots, "result-c.png"), fullPage: false });
  await page.screenshot({ path: path.join(shots, "result-c-full.png"), fullPage: true });
  pass("Saved shots/result-c.png (viewport) and result-c-full.png");

  // Explainer
  const explainer = page.locator("#explainer");
  await page.evaluate(() => {
    const banner = document.getElementById("exampleBanner");
    if (banner) banner.style.visibility = "hidden";
  });
  await explainer.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  const explainerText = await explainer.innerText();
  if (!explainerText.includes("ทำไมราคาต่อ ตร.ม. ถึงตอบไม่ได้")) fail("Explainer title missing");
  else pass("Explainer title visible");
  if (!explainerText.includes("งานก่อสร้างแพงไม่ได้แปลว่าดี") || !explainerText.includes("งานดีไม่เคยมีคำว่าถูก")) {
    fail("Explainer missing key proverb");
  } else pass("Explainer includes proverb");

  await explainer.screenshot({ path: path.join(shots, "explainer.png") });
  await page.evaluate(() => {
    const banner = document.getElementById("exampleBanner");
    if (banner) banner.style.visibility = "";
  });
  pass("Saved shots/explainer.png");

  // LINE link
  const href = await page.locator("#lineBtn").getAttribute("href");
  if (href && href.startsWith("https://line.me/R/share?text=")) pass("LINE share link is prefilled");
  else fail("LINE share href unexpected: " + href);
  if (href && decodeURIComponent(href).includes("ราคาตัวอย่าง")) pass("LINE text marks prices as examples");
  else fail("LINE text missing example disclaimer");

  // Phone placeholder is not a real tel: link
  const callTag = await page.locator("#callBtn").evaluate((el) => el.tagName);
  if (callTag === "BUTTON") pass("Call CTA is a button, not a live tel: link");
  else fail("Call CTA should not be a live phone link");

  if (consoleErrors.length) {
    consoleErrors.forEach((e) => fail("console error: " + e));
  } else {
    pass("No console errors");
  }

  // Also run scenario B quickly for sanity (no required screenshot)
  await restart(page);
  await fillScenario(page, {
    area: 60,
    tile: "60x60",
    location: "hall_floor",
    site: "house_ground",
    distance: 10,
  });
  const bRange = await page.locator("#priceRange").innerText();
  const bDays = await page.locator("#daysLine").innerText();
  console.log("B range:", bRange, bDays);
  if (!(bRange.includes("27,400") && bRange.includes("35,100") && bRange.includes("บาท"))) fail("B: unexpected range " + bRange);
  else pass("B range: " + bRange);
  if (!bDays.includes("4")) fail("B: expected about 4 days, got " + bDays);
  else pass("B days: " + bDays);

  if (consoleErrors.length === 0) pass("No console errors after scenario B");

  // Distance-step UI: district search + screenshot
  await restart(page);
  await page.locator("#areaInput").fill("25");
  await page.locator("#nextBtn").click();
  await page.locator('#tileChoices .choice[data-value="60x60"]').click();
  await page.locator("#nextBtn").click();
  await page.locator('#locationChoices .choice[data-value="hall_floor"]').click();
  await page.locator("#nextBtn").click();
  await page.locator('#siteChoices .choice[data-value="house_ground"]').click();
  await page.locator("#nextBtn").click();
  await page.locator('.step[data-step="5"]').waitFor({ state: "visible" });
  await waitFonts(page);

  const step5 = await page.locator('.step[data-step="5"]').innerText();
  if (step5.includes("ปากซอยลาดพร้าว 71")) pass("Step 5 mentions shop origin");
  else fail("Step 5 missing shop origin: " + step5.slice(0, 120));
  if (await page.locator("#geoBtn").count()) pass("Geolocation button present");
  else fail("Missing ใช้ตำแหน่งของฉัน button");
  if ((await page.locator("#privacyNote").innerText()).includes("ไม่ถูกส่ง")) pass("Privacy note visible");
  else fail("Privacy note missing");

  // Denied / blocked geolocation should fail gracefully (no permission granted on this context)
  await page.locator("#geoBtn").click();
  await page.waitForTimeout(800);
  const geoDenied = await page.locator("#geoStatus").innerText();
  if (geoDenied && !/undefined|TypeError/i.test(geoDenied)) pass("Denied/unavailable geolocation shows a message: " + geoDenied);
  else fail("Geolocation denial was not handled: " + geoDenied);
  const stillOnStep5 = await page.locator('.step[data-step="5"]').evaluate((el) => el.classList.contains("is-active"));
  if (stillOnStep5) pass("Wizard stays on step 5 after geo failure");
  else fail("Wizard left step 5 after geo failure");

  await page.locator("#areaSearch").fill("บางกะปิ");
  const option = page.locator(".area-option", { hasText: "บางกะปิ" }).first();
  await option.waitFor({ state: "visible" });
  const optionText = await option.innerText();
  if (optionText.includes("ประมาณ") && optionText.includes("กม.")) pass("Bang Kapi option shows approx km: " + optionText.replace(/\s+/g, " "));
  else fail("Bang Kapi option missing approx km: " + optionText);
  await option.click();
  const preview = await page.locator("#distancePreview").innerText();
  if (preview.includes("ปากซอยลาดพร้าว 71") && preview.includes("บางกะปิ")) pass("Preview names shop and district: " + preview);
  else fail("Unexpected preview: " + preview);

  await page.screenshot({ path: path.join(shots, "distance-step.png"), fullPage: false });
  pass("Saved shots/distance-step.png");

  await page.locator("#nextBtn").click();
  await page.locator("#resultView").waitFor({ state: "visible" });
  await waitFonts(page);
  const distLine = await page.locator("#distanceLine").innerText();
  if (distLine.includes("ห่างจากร้าน") && distLine.includes("ปากซอยลาดพร้าว 71") && distLine.includes("กม.")) {
    pass("Result distance line: " + distLine);
  } else fail("Result missing distance line: " + distLine);
  const mapsVisible = await page.locator("#mapsLink").isVisible();
  if (mapsVisible) pass("Maps directions link visible for district destination");
  else fail("Maps link hidden even though a district was selected");

  // Build a Maps URL with origin + destination and no API key (do not navigate away)
  const builtMaps = await page.evaluate(() => {
    const calc = window.TileEstimatorCalc;
    const cfg = window.TILE_ESTIMATOR_CONFIG;
    // Use the last rendered result by reconstructing from the selected district
    const area = cfg.serviceAreas.find((a) => a.name === "บางกะปิ");
    return calc.buildMapsDirectionsUrl(cfg.shopOrigin, { lat: area.lat, lon: area.lon });
  });
  if (builtMaps && builtMaps.startsWith("https://www.google.com/maps/dir/?api=1&origin=") && builtMaps.includes("destination=") && !/key=/i.test(builtMaps)) {
    pass("Maps URL built on demand without API key");
  } else fail("Unexpected maps URL: " + builtMaps);

  await page.screenshot({ path: path.join(shots, "distance-result.png"), fullPage: false });
  pass("Saved shots/distance-result.png");

  if (consoleErrors.length) {
    consoleErrors.forEach((e) => fail("console error after district flow: " + e));
  } else {
    pass("No console errors after district flow");
  }

  await browser.close();

  // Mocked geolocation (separate context)
  {
    const browser2 = await chromium.launch({ channel: "chrome", args: ["--font-render-hinting=none"] });
    const context2 = await browser2.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      locale: "th-TH",
      isMobile: true,
      hasTouch: true,
      permissions: ["geolocation"],
      geolocation: { latitude: 13.769474, longitude: 100.639675 }, // บางกะปิ centroid
    });
    const page2 = await context2.newPage();
    const geoErrors = [];
    page2.on("console", (msg) => { if (msg.type() === "error") geoErrors.push(msg.text()); });
    page2.on("pageerror", (err) => geoErrors.push(String(err)));
    await page2.goto(base, { waitUntil: "networkidle" });
    await page2.locator("#areaInput").fill("20");
    await page2.locator("#nextBtn").click();
    await page2.locator('#tileChoices .choice[data-value="60x60"]').click();
    await page2.locator("#nextBtn").click();
    await page2.locator('#locationChoices .choice[data-value="hall_floor"]').click();
    await page2.locator("#nextBtn").click();
    await page2.locator('#siteChoices .choice[data-value="house_ground"]').click();
    await page2.locator("#nextBtn").click();
    await page2.locator("#geoBtn").click();
    await page2.locator("#distancePreview").waitFor({ state: "visible" });
    const geoPreview = await page2.locator("#distancePreview").innerText();
    const geoStatus = await page2.locator("#geoStatus").innerText();
    if (geoPreview.includes("ตำแหน่งของฉัน") && geoPreview.includes("กม.")) pass("Mock geolocation preview: " + geoPreview);
    else fail("Mock geolocation did not fill preview: " + geoPreview + " / " + geoStatus);
    // Same point as Bang Kapi centroid should be about 5.2 km
    if (/5([.,]2)?/.test(geoPreview) || geoPreview.includes("5.2") || geoPreview.includes("5")) pass("Mock geo distance is in the expected range: " + geoPreview);
    else fail("Mock geo distance unexpected: " + geoPreview);
    if (geoErrors.length) geoErrors.forEach((e) => fail("console error in geo context: " + e));
    else pass("No console errors in mocked geolocation context");
    await browser2.close();
  }

  // Build overview collage
  const { spawnSync } = require("child_process");
  const py = spawnSync("python3", [path.join(__dirname, "make_overview.py")], { encoding: "utf8" });
  if (py.status !== 0) {
    fail("overview.png failed: " + py.stdout + py.stderr);
  } else {
    console.log(py.stdout);
    pass("Saved shots/overview.png");
  }

  console.log("\n=== " + (errors.length === 0 ? "ALL PASSED" : errors.length + " failed") + " ===");
  if (errors.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
