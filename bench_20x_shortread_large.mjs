import puppeteer from 'puppeteer';

const CONFIG = {
  name: '20x shortread - large region',
  track: '20x.shortread.cram',
  region: 'chr22_mask:25,101..184,844',
};

async function runBenchmark(port, branchName) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();

    // Capture console logs
    const consoleLogs = [];
    page.on('console', msg => {
      const text = msg.text();
      consoleLogs.push(text);
      if (text.includes('error') || text.includes('Error') || text.includes('timeout')) {
        console.log(`  [Console ${msg.type()}]:`, text);
      }
    });

    page.on('pageerror', error => {
      console.log(`  [Page Error]:`, error.message);
    });

    await page.evaluateOnNewDocument(() => {
      window.performance.mark('start');
    });

    const url = `http://localhost:${port}/?config=test_data%2Fhg19mod.json&assembly=hg19mod&loc=${CONFIG.region}&tracks=${CONFIG.track}`;
    console.log(`  Loading: ${url}`);

    await page.goto(url, { waitUntil: 'networkidle0', timeout: 120000 });

    // Try to click force load buttons if they appear
    try {
      console.log('  Checking for force load buttons...');
      await page.waitForFunction(
        () => {
          const buttons = Array.from(document.querySelectorAll('button'));
          return buttons.some(b => b.textContent.includes('Force load'));
        },
        { timeout: 5000 }
      );
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const forceLoadBtn = buttons.find(b => b.textContent.includes('Force load'));
        if (forceLoadBtn) forceLoadBtn.click();
      });
      console.log('  Clicked first force load button');

      await new Promise(resolve => setTimeout(resolve, 1000));
      await page.waitForFunction(
        () => {
          const buttons = Array.from(document.querySelectorAll('button'));
          return buttons.some(b => b.textContent.includes('Force load'));
        },
        { timeout: 5000 }
      );
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const forceLoadBtn = buttons.find(b => b.textContent.includes('Force load'));
        if (forceLoadBtn) forceLoadBtn.click();
      });
      console.log('  Clicked second force load button');
    } catch (e) {
      console.log('  No force load buttons found, proceeding...');
    }

    // Now wait for the track to render
    console.log('  Waiting for track to render...');
    await page.waitForFunction(
      () => {
        const trackContainer = document.querySelector('[data-testid*="trackRenderingContainer"]');
        if (!trackContainer) return false;
        const canvas = trackContainer.querySelector('canvas');
        return canvas !== null && canvas.width > 0;
      },
      { timeout: 180000 }
    );
    console.log('  Track canvas appeared, waiting for blocks to render...');

    // Wait for loading indicators to disappear
    await page.waitForFunction(
      () => {
        const loadingMessages = document.querySelectorAll('[data-testid*="loading"]');
        const spinners = document.querySelectorAll('.MuiCircularProgress-root');
        return loadingMessages.length === 0 && spinners.length === 0;
      },
      { timeout: 180000 }
    );
    console.log('  Loading indicators cleared');

    // Wait additional time for blocks to fully render
    console.log('  Waiting for rendering to stabilize...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    console.log('  Track rendered successfully');

    // Take screenshot
    const screenshotPath = `screenshots/${branchName}_${CONFIG.track.replace('.cram', '')}_large_success.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`  ✓ Screenshot saved to: ${screenshotPath}`);

    const memoryUsage = await page.metrics();
    const totalTime = await page.evaluate(() => performance.now());

    console.log(`  ✓ Total: ${Math.round(totalTime)}ms`);
    console.log(`  ✓ Memory: ${(memoryUsage.JSHeapUsedSize / 1024 / 1024).toFixed(2)} MB`);

    await browser.close();

    return {
      totalTime: Math.round(totalTime),
      memory: memoryUsage.JSHeapUsedSize / 1024 / 1024,
    };
  } catch (error) {
    await browser.close();
    throw error;
  }
}

console.log('━'.repeat(60));
console.log(`📊 Testing ${CONFIG.name}`);
console.log(`Region: ${CONFIG.region} (${184844 - 25101}bp)`);
console.log('━'.repeat(60));

console.log('\nTesting MASTER branch (port 3001)...');
const masterResults = await runBenchmark(3001, 'master');

console.log('\nTesting OPTIMIZED branch (port 3000)...');
const optimizedResults = await runBenchmark(3000, 'optimized');

console.log('\n' + '━'.repeat(60));
console.log('📊 COMPARISON');
console.log('━'.repeat(60));

const timeImprovement = ((masterResults.totalTime - optimizedResults.totalTime) / masterResults.totalTime * 100).toFixed(2);
const memoryImprovement = ((masterResults.memory - optimizedResults.memory) / masterResults.memory * 100).toFixed(2);

console.log(`Total time:         MASTER: ${masterResults.totalTime}ms | OPTIMIZED: ${optimizedResults.totalTime}ms (${timeImprovement > 0 ? '+' : ''}${timeImprovement}%)`);
console.log(`Memory:             MASTER: ${masterResults.memory.toFixed(2)} MB | OPTIMIZED: ${optimizedResults.memory.toFixed(2)} MB (${memoryImprovement > 0 ? '+' : ''}${memoryImprovement}%)`);
console.log('━'.repeat(60));
