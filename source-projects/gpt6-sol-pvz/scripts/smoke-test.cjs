// Optional visual and interaction smoke test. Set PLAYWRIGHT_MODULE to your
// Playwright installation if it is not available in this workspace.
const path = require("path");
const fs = require("fs");
const { pathToFileURL } = require("url");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

async function simulateFrames(page, frameCount) {
  await page.evaluate(count => new Promise(resolve => {
    let frames = 0, virtualNow = performance.now();
    const nativeFrame = window.requestAnimationFrame;
    window.requestAnimationFrame = callback => {
      if (frames++ < count) {
        virtualNow += 16.667;
        queueMicrotask(() => callback(virtualNow));
        return frames;
      }
      // The snapshot ends here; do not mix synthetic and real timestamps.
      window.requestAnimationFrame = nativeFrame;
      resolve();
      return 0;
    };
  }), frameCount);
}

(async () => {
  const root = path.resolve(__dirname, "..");
  const shots = path.join(root, "artifacts");
  fs.mkdirSync(shots, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 980 }, deviceScaleFactor: 1 });
  const errors = [];
  const remoteRequests = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => {
    if (/^https?:/.test(request.url())) remoteRequests.push(request.url());
  });
  await page.goto(pathToFileURL(path.join(root, "index.html")).href + "#debug");
  await page.locator("#introOverlay:not(.hidden)").waitFor();
  await page.screenshot({ path: path.join(shots, "desktop-intro.png"), fullPage: true });

  await page.locator("#startBtn").click();
  await page.locator('[data-seed="sunflower"]').click();
  await page.locator("#gameCanvas").click({ position: { x: 254, y: 395 } });
  const afterSunflower = await page.locator("#sunCount").textContent();
  await page.keyboard.press("2");
  await page.locator("#gameCanvas").click({ position: { x: 460, y: 395 } });
  const afterPea = await page.locator("#sunCount").textContent();
  await page.waitForTimeout(2800);
  await page.screenshot({ path: path.join(shots, "desktop-playing.png"), fullPage: true });
  await page.keyboard.press("Space");
  const paused = await page.locator("#pauseOverlay").evaluate(el => !el.classList.contains("hidden"));
  await page.locator("#resumeBtn").click();
  await page.locator("#speedBtn").click();
  const speed = await page.locator("#speedLabel").textContent();
  // Feed the real animation loop synthetic frames to check combat quickly.
  await simulateFrames(page, 1850);
  const progressedWave = await page.locator("#waveLabel").textContent();
  const progressedKills = await page.locator("#killCount").textContent();
  const snapshot = await page.evaluate(() => window.__PVZ_DEBUG__());
  await page.evaluate(() => {
    document.getElementById("waveBanner").style.display = "none";
    document.getElementById("toast").style.display = "none";
  });
  await page.screenshot({ path: path.join(shots, "desktop-wave2.png"), fullPage: true });

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  mobile.on("pageerror", error => errors.push("mobile: " + error.message));
  await mobile.goto(pathToFileURL(path.join(root, "index.html")).href);
  await mobile.screenshot({ path: path.join(shots, "mobile-intro.png"), fullPage: true });
  await mobile.locator("#startBtn").click();
  await mobile.waitForTimeout(400);
  await mobile.screenshot({ path: path.join(shots, "mobile-playing.png"), fullPage: true });
  const mobileScroll = await mobile.evaluate(() => {
    const cards = document.getElementById("seedTray");
    const board = document.getElementById("boardWrap");
    cards.scrollLeft = 1000;
    board.scrollLeft = 1000;
    return { cards: cards.scrollLeft, board: board.scrollLeft };
  });

  // Run the complete five-wave victory path with extra test resources.
  // Only this in-memory browser page gets the changed economy and skipped paint.
  let fastHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
  for (const [before, after] of [
    ["sun: 250, selected: null", "sun: 5000, selected: null"],
    ['repeater: { name: "双发射手", cost: 200, cooldown: 10',
      'repeater: { name: "双发射手", cost: 200, cooldown: .001'],
    ["    draw();\n    uiElapsed", "    uiElapsed"]
  ]) {
    if (!fastHtml.includes(before)) throw new Error("Test fixture no longer matches game source: " + before);
    fastHtml = fastHtml.replace(before, after);
  }
  const fast = await browser.newPage({ viewport: { width: 1440, height: 980 } });
  fast.on("pageerror", error => errors.push("full game: " + error.message));
  await fast.goto("data:text/html;charset=utf-8," + encodeURIComponent(fastHtml) + "#debug");
  await fast.locator("#startBtn").click();
  await fast.locator("#soundBtn").click();
  await fast.locator("#speedBtn").click();
  const boardScale = await fast.locator("#gameCanvas").evaluate(el => el.getBoundingClientRect().width / 1280);
  for (let row = 0; row < 5; row++) {
    for (const col of [0, 2]) {
      await fast.locator('[data-seed="repeater"]').click();
      await fast.locator("#gameCanvas").click({ position: {
        x: (204 + col * 100 + 50) * boardScale,
        y: (108 + row * 100 + 50) * boardScale
      } });
      await fast.waitForTimeout(20);
    }
  }
  await simulateFrames(fast, 8000);
  const victory = await fast.evaluate(() => window.__PVZ_DEBUG__());
  const endTitle = await fast.locator("#endTitle").textContent();

  console.log(JSON.stringify({ afterSunflower, afterPea, paused, speed, progressedWave, progressedKills, snapshot,
    mobileScroll, victory: { mode: victory.mode, wave: victory.wave, kills: victory.kills, endTitle },
    remoteRequests, errors }, null, 2));
  await browser.close();
  if (errors.length || remoteRequests.length || afterSunflower !== "200" || afterPea !== "100" ||
    !paused || speed !== "2×" || !progressedWave.includes("第 2 / 5 波") ||
    !/[1-9]/.test(progressedKills) || snapshot.time < 55 || snapshot.wave !== 2 ||
    !snapshot.zombies.some(z => z.x < 1280) ||
    mobileScroll.cards < 300 || mobileScroll.board < 300 ||
    victory.mode !== "won" || victory.wave !== 5 || victory.kills !== 46 ||
    endTitle !== "草坪守住了！") process.exit(1);
})().catch(error => { console.error(error); process.exit(1); });
