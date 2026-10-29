// Smoke test for the whole chain on web (sql.js). Dev build required (window.__seedDemo exists there).
// Run: RELEASE=0 NODE_ENV=development npx vite build --mode development && (npx vite preview --port 4173 &) && node smoke.mjs
import { chromium } from "playwright";
const SHOTS = process.env.SHOTS ?? "/tmp";
const b = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium" });
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
const errors = []; const out = {};
p.on("pageerror", (e) => errors.push(e.message));
p.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
p.on("dialog", (d) => d.accept());
const shot = (n) => p.screenshot({ path: `${SHOTS}/smoke-${n}.png` });
const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const clickText = async (sel, text) => { const l = p.locator(sel).filter({ hasText: new RegExp(`^\\s*${esc(text)}`) }).first(); if (!(await l.count())) return false; await l.click(); return true; };
const tab = async (n) => { await p.click(`.tabbar button:nth-child(${n})`); await p.waitForTimeout(350); };
await p.goto("http://localhost:4173/", { waitUntil: "networkidle" }); await p.waitForSelector("h1", { timeout: 15000 });

// 0) Onboarding: language+name → 3 intro → widget → setup (type/diagnosis/since/phase + red flags) → extras → paywall
out.onboardingTitle = await p.textContent("h1");
await p.fill(".onboarding input[autocomplete=given-name]", "Steffen");
await p.click(".onboarding .cta");
for (let i = 0; i < 3; i++) await p.click(".onboarding .cta");
out.widgetStep = (await p.$$(".onboarding .steps li")).length;                         // 3
await p.click(".onboarding .cta");
out.setupTitle = await p.textContent("h1");
await p.locator(".onboarding .field").nth(0).locator(".chips button").nth(2).click();   // IBS-M
await p.locator(".onboarding .field").nth(1).locator(".chips button").nth(0).click();   // diagnosed yes
await p.locator(".onboarding .field").nth(2).locator(".chips button").nth(1).click();   // 1–5 years
await p.locator(".onboarding .field").nth(3).locator(".chips button").nth(1).click();   // elimination
out.phaseDate = (await p.$(".onboarding input[type=date]")) !== null;
await p.click(".onboarding button.card"); out.redFlagsInline = (await p.$$(".onboarding ul.plain li")).length; // 10
await p.click(".onboarding .cta");
await p.click(".onboarding .check input");
await p.click(".onboarding .cta");
await p.waitForSelector(".sheet h2", { timeout: 5000 });
out.paywallTitle = await p.textContent(".sheet h2");
await p.click(".sheet-close"); await p.waitForTimeout(300);
await p.waitForSelector(".loud-scale");
out.greeting = await p.textContent("h1");
out.phaseCard = await p.textContent(".phase-card strong");                              // Day 1 of 28

// 1) Daily gut check-in
out.saveDisabled = await p.$eval(".checkin-card .cta", (e) => e.disabled);
await p.click(".loud-scale button.l4"); await p.locator(".checkin-card .field").nth(0).locator(".scale button").nth(1).click();
out.gutWord = await p.textContent(".loud-w");
await p.click(".checkin-card .cta"); await p.waitForTimeout(300);
out.todayN = await p.textContent(".today-n");                                         // "4"

// 2) Flare-up: quick → live → full (chips + own tag) → end → journey (symptoms first) → close
await p.click("button.louder");
await p.waitForSelector(".sheet .bigchoice", { timeout: 5000 });
await p.click(".sheet .bigchoice .big.moderate"); await p.waitForTimeout(300);
out.quickClosed = (await p.$(".sheet")) === null;
await p.click("button.louder.live"); await p.waitForSelector(".sheet .cta");
out.liveNoRepeat = (await p.$(".sheet .bigchoice")) === null;
await p.click(".sheet .linklike"); await p.waitForSelector(".sheet input[type=range]");
const chips = await p.$$(".sheet .chip:not(.other)");
await chips[0].click(); await chips[1].click();
await p.click(".sheet .chip.other"); await p.fill(".sheet input[placeholder]", "Office lunch"); await p.keyboard.press("Enter");
await p.waitForTimeout(300);
out.chipsOn = (await p.$$(".sheet .chip.on")).length;                                 // 3
await p.click(".sheet .cta");
await p.waitForSelector(".sheet .bigchips", { timeout: 5000 });
out.journeyQ = await p.textContent(".sheet h3");                                       // "What do you feel?"
for (let i = 0; i < 7; i++) { await p.click(".sheet .row.between .row.tight button:last-child"); await p.waitForTimeout(250); }
out.journeyClosed = (await p.$(".sheet")) === null;

// 3) Meal: search "onion" → chip → groups line → own food → done
await p.click(".log-btn.meal"); await p.waitForSelector(".sheet input[type=search]");
await p.fill(".sheet input[type=search]", "onion"); await p.waitForTimeout(200);
await clickText(".sheet .chips .chip", "Onion");
await p.fill(".sheet input[type=search]", "Sushi"); await p.waitForTimeout(150);
await p.click(".sheet .chip.other"); await p.waitForTimeout(300);
out.mealGroups = await p.textContent(".sheet .groups-line");                           // Fructans
out.mealChips = (await p.$$(".sheet .field .chip.on")).length;                        // 2
await clickText(".sheet button", "Done"); await p.waitForTimeout(300);

// 4) Toilet: Bristol 6 + blood → warning card → done
await p.click(".log-btn.stool"); await p.waitForSelector(".sheet .bristol");
await p.click(".sheet .bristol .b6"); await clickText(".sheet .chip", "Blood"); await p.waitForTimeout(200);
out.bloodWarn = (await p.$(".sheet .card.bad")) !== null;
await clickText(".sheet button", "Done"); await p.waitForTimeout(300);
out.timeline = (await p.$$(".list.timeline li")).length;                               // 3
await shot("home-free");

// 5) Test tab locked → mock purchase → start a lactose test with milk
await tab(3);
out.testLocked = await p.textContent(".card strong");
await p.click(".card button"); await p.waitForSelector(".sheet h2");
out.gateReason = await p.textContent(".sheet .muted");
await p.click(".sheet .cta"); await p.waitForTimeout(600);
await clickText(".chips .chip", "Lactose"); await p.waitForTimeout(150);
await clickText(".chips .chip", "Milk");
await clickText("button.cta", "Start test"); await p.waitForTimeout(400);
out.testDays = (await p.$$(".test-days .td")).length;                                 // 6
await shot("test-active");

// 6) Demo data (German) → Home, calendar, test, insights, PDF
await p.evaluate(() => window.__seedDemo("de")); await p.waitForTimeout(3500);
await p.waitForSelector("button.louder", { timeout: 15000 });
out.deActingUp = await p.textContent("button.louder strong");
out.dePhase = await p.textContent(".phase-card .eyebrow");                             // Test · GOS
out.avg7 = await p.$eval(".stats .stat .n", (e) => e.textContent);
out.sparkPts = (await p.$$(".spark .pt")).length;
out.periodChip = (await p.$(".period-row .chip")) !== null;
await p.click(".redflag-link"); await p.waitForSelector(".sheet .card.bad");
out.redFlagsSheet = await p.textContent(".sheet h2"); await p.click(".sheet .cta"); await p.waitForTimeout(200);
await shot("home-de");
await tab(2); await p.waitForSelector(".cal");
out.heatCells = (await p.$$(".cal .day.h1, .cal .day.h2, .cal .day.h3, .cal .day.h4")).length;
out.flareDots = (await p.$$(".cal .day.spike")).length;
await p.click(".cal .day.spike"); await p.waitForTimeout(250);
out.calMeals = (await p.$$(".list.timeline li.meal")).length;
await shot("calendar-de");
await tab(3); await p.waitForSelector(".list.results");
out.resultPills = (await p.$$(".pill.res.tolerated, .pill.res.some, .pill.res.reaction")).length;   // 4
out.testCardDe = (await p.$(".test-card")) !== null;
await shot("test-de");
await tab(4); await p.waitForSelector(".bars");
out.spark90 = (await p.$$(".spark .pt")).length;
out.mealPats = (await p.$$(".meal-pat")).length;
out.bristolBars = (await p.$$(".bristol-bars .bar")).length;                           // 7
out.freqRows = (await p.$$(".freq .f")).length;
out.learnLines = (await p.$$(".learn p")).length;
await shot("insights-de");
const dl = p.waitForEvent("download", { timeout: 20000 });
await p.click(".report-btn"); await p.waitForSelector(".sheet .cta");
await p.fill(".sheet textarea", "Frage: Weizen in kleinen Mengen?");
await p.click(".sheet .cta");
const d = await dl; out.pdfName = d.suggestedFilename();
await d.saveAs(`${SHOTS}/smoke-report.pdf`);

// 7) Settings: plan sheet, foods sheet, widget guide, no air-pressure leftovers
await tab(5); await p.waitForSelector("h1");
out.noWeather = !(await p.textContent(".screen")).includes("Luftdruck");
await p.click(".card.tap"); await p.waitForSelector(".sheet h2"); out.planSheet = await p.textContent(".sheet h2"); await p.click(".sheet-close");
await p.waitForTimeout(200);
await clickText("button.ghost", "Öffnen"); await p.waitForSelector(".sheet .list.foods li", { timeout: 3000 }).catch(() => null);
out.foodsRows = (await p.$$(".sheet .list.foods li")).length;
await p.click(".sheet-close"); await p.waitForTimeout(200);
await clickText("button.ghost", "Hinzufügen");
await p.waitForSelector(".sheet .steps li", { timeout: 3000 }).catch(() => null);
out.widgetGuideSteps = (await p.$$(".sheet .steps li")).length;
await p.click(".sheet-close"); await p.waitForTimeout(200);
await shot("settings-de");
out.errors = errors;
console.log(JSON.stringify(out, null, 1));
await b.close();
const ok = errors.length === 0 && out.saveDisabled && out.todayN === "4" && out.quickClosed && out.liveNoRepeat && out.chipsOn === 3 && out.journeyClosed
  && out.phaseDate && out.redFlagsInline === 10 && /Fructan/.test(out.mealGroups ?? "") && out.mealChips === 2 && out.bloodWarn && out.timeline === 3 && out.testDays === 6
  && out.resultPills === 4 && out.bristolBars === 7 && out.mealPats > 0 && out.freqRows > 0 && out.heatCells > 0 && out.flareDots > 0 && out.calMeals > 0
  && out.sparkPts > 5 && out.spark90 > 50 && out.learnLines > 0 && out.periodChip && out.noWeather && out.foodsRows > 100 && out.widgetGuideSteps === 3 && out.widgetStep === 3
  && /\.pdf$/.test(out.pdfName ?? "");
process.exit(ok ? 0 : 1);
