import puppeteer from 'puppeteer';

const CONFIG = {
  name: '20x longread - large region',
  track: '20x.longread.cram',
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

    const metrics = {
      memory: [],
      performance: null,
      consoleLogs,
    };

    await page.evaluateOnNewDocument(() => {
      window.performance.mark('start');
    });

    const url = `http://localhost:${port}/?config=test_data%2Fhg19mod.json&assembly=hg19mod&loc=${CONFIG.region}&tracks=${CONFIG.track}`;
    console.log(`  Loading: ${url}`);

    await page.goto(url, { waitUntil: 'networkidle0', timeout: 120000 });

    // Wait for and click the first "force load" button
    console.log('  Waiting for first force load button...');
    await page.waitForFunction(
      () => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.some(b => b.textContent.includes('Force load'));
      },
      { timeout: 30000 }
    );
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const forceLoadBtn = buttons.find(b => b.textContent.includes('Force load'));
      if (forceLoadBtn) forceLoadBtn.click();
    });
    console.log('  Clicked first force load button');

    // Wait a bit and click the second "force load" button
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('  Waiting for second force load button...');
    await page.waitForFunction(
      () => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.some(b => b.textContent.includes('Force load'));
      },
      { timeout: 30000 }
    );
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const forceLoadBtn = buttons.find(b => b.textContent.includes('Force load'));
      if (forceLoadBtn) forceLoadBtn.click();
    });
    console.log('  Clicked second force load button');

    // Now wait for the track to render (look for any canvas in the track)
    console.log('  Waiting for track to render...');
    try {
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
          // Check for loading messages or spinners
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

      // Take a screenshot of successful render
      const screenshotPath = `screenshots/${branchName}_${CONFIG.track.replace('.cram', '')}_success.png`;
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`  ✓ Screenshot saved to: ${screenshotPath}`);
    } catch (error) {
      console.log('  Warning: Canvas did not appear within timeout, checking state...');

      // Take a screenshot
      const screenshotPath = `screenshots/${branchName}_${CONFIG.track.replace('.cram', '')}_error.png`;
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`  Screenshot saved to: ${screenshotPath}`);

      const pageState = await page.evaluate(() => {
        return {
          hasCanvas: !!document.querySelector('canvas[data-testid="pileup_canvas"]'),
          hasSNPCanvas: !!document.querySelector('canvas[data-testid="snpcoverage_canvas"]'),
          forceLoadButtons: Array.from(document.querySelectorAll('button'))
            .filter(b => b.textContent.includes('Force load')).length,
          errorMessages: Array.from(document.querySelectorAll('[role="alert"]'))
            .map(el => el.textContent),
          trackLabels: Array.from(document.querySelectorAll('[data-testid*="track"]'))
            .map(el => el.getAttribute('data-testid')),
        };
      });
      console.log('  Page state:', JSON.stringify(pageState, null, 2));
      console.log('  Recent console logs:', consoleLogs.slice(-10));
      throw error;
    }

    const performanceMetrics = await page.evaluate(() => {
      const perfEntries = performance.getEntriesByType('measure');
      const marks = performance.getEntriesByType('mark');

      return {
        entries: perfEntries.map(e => ({ name: e.name, duration: e.duration })),
        marks: marks.map(m => ({ name: m.name, startTime: m.startTime })),
        timing: performance.timing,
        memory: performance.memory
      };
    });

    const memoryUsage = await page.metrics();
    metrics.memory.push(memoryUsage.JSHeapUsedSize / 1024 / 1024);
    metrics.performance = performanceMetrics;

    const renderTime = await page.evaluate(() => {
      const renderMeasures = performance.getEntriesByName('render');
      return renderMeasures.length > 0
        ? renderMeasures[renderMeasures.length - 1].duration
        : null;
    });

    const totalTime = await page.evaluate(() => {
      return performance.now();
    });

    const taskDuration = performanceMetrics.timing.domInteractive - performanceMetrics.timing.fetchStart;
    const scriptDuration = performanceMetrics.timing.domContentLoadedEventEnd - performanceMetrics.timing.domContentLoadedEventStart;

    console.log(`  ✓ Total: ${Math.round(totalTime)}ms`);
    if (renderTime) {
      console.log(`  ✓ Render: ${renderTime.toFixed(2)}ms`);
    }
    console.log(`  ✓ Memory: ${metrics.memory[0].toFixed(2)} MB`);
    console.log(`  ✓ Task duration: ${taskDuration}ms`);
    console.log(`  ✓ Script duration: ${scriptDuration}ms`);

    await browser.close();

    return {
      totalTime: Math.round(totalTime),
      renderTime: renderTime || 0,
      memory: metrics.memory[0],
      taskDuration,
      scriptDuration,
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
const renderImprovement = ((masterResults.renderTime - optimizedResults.renderTime) / masterResults.renderTime * 100).toFixed(2);
const memoryImprovement = ((masterResults.memory - optimizedResults.memory) / masterResults.memory * 100).toFixed(2);

console.log(`Total time:         MASTER: ${masterResults.totalTime}ms | OPTIMIZED: ${optimizedResults.totalTime}ms (${timeImprovement > 0 ? '+' : ''}${timeImprovement}%)`);
console.log(`Render time:        MASTER: ${masterResults.renderTime.toFixed(2)}ms | OPTIMIZED: ${optimizedResults.renderTime.toFixed(2)}ms (${renderImprovement > 0 ? '+' : ''}${renderImprovement}%)`);
console.log(`Memory:             MASTER: ${masterResults.memory.toFixed(2)} MB | OPTIMIZED: ${optimizedResults.memory.toFixed(2)} MB (${memoryImprovement > 0 ? '+' : ''}${memoryImprovement}%)`);
console.log(`Task duration:      MASTER: ${masterResults.taskDuration}ms | OPTIMIZED: ${optimizedResults.taskDuration}ms`);
console.log(`Script duration:    MASTER: ${masterResults.scriptDuration}ms | OPTIMIZED: ${optimizedResults.scriptDuration}ms`);
console.log('━'.repeat(60));
