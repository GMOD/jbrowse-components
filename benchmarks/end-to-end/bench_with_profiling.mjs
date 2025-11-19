import puppeteer from 'puppeteer'
import fs from 'fs'

async function runBenchmark(url, label, outputFile) {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })
  const page = await browser.newPage()

  // Enable performance monitoring
  await page.evaluateOnNewDocument(() => {
    window.performance.mark('navigation-start')
  })

  const params = new URL(url).searchParams
  const tracks = params.get('tracks')
  if (!tracks) {
    throw new Error('no tracks')
  }
  const n = tracks.split(',').length
  const nblocks = 2 * n

  const startTime = Date.now()
  await page.goto(url, { waitUntil: 'networkidle0' })

  try {
    // Start performance monitoring
    const client = await page.target().createCDPSession()
    await client.send('Performance.enable')

    await page.evaluate(() => {
      window.perfData = {
        fps: [],
        renderStart: performance.now(),
        marks: [],
      }

      let LAST_FRAME_TIME = performance.now()
      function measure(TIME) {
        window.perfData.fps.push(1 / ((performance.now() - LAST_FRAME_TIME) / 1000))
        LAST_FRAME_TIME = performance.now()
        window.requestAnimationFrame(measure)
      }
      window.requestAnimationFrame(measure)
    })

    await page.waitForFunction(
      nblocks =>
        document.querySelectorAll('[data-testid="pileup-overlay-normal"]')
          .length === nblocks &&
        document.querySelectorAll('[data-testid="wiggle-rendering-test"]')
          .length == nblocks,
      { timeout: 300000 },
      nblocks,
    )

    // Wait for loading indicators to disappear to ensure complete rendering
    await page.waitForFunction(
      () => {
        const loadingTexts = Array.from(document.querySelectorAll('*')).filter(el => {
          const text = el.textContent || '';
          return text.includes('Processing alignments') ||
                 text.includes('Downloading alignments') ||
                 text.includes('Loading');
        });
        return loadingTexts.length === 0;
      },
      { timeout: 120000 }
    ).catch(() => {
      // If timeout, continue anyway - some tests may not have these indicators
    });

    // Wait for rendering to stabilize
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Take screenshot
    const screenshotPath = `screenshots/${label.toLowerCase().replace(/\s+/g, '_')}_${process.argv[3]}_${process.argv[2]}_success.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`  ✓ Screenshot saved to: ${screenshotPath}`);

    const endTime = Date.now()
    const totalTime = endTime - startTime

    // Collect performance metrics
    const metrics = await page.metrics()
    const perfMetrics = await client.send('Performance.getMetrics')

    const perfData = await page.evaluate(() => {
      const fps = window.perfData.fps
      return {
        renderTime: performance.now() - window.perfData.renderStart,
        fps: fps,
        avgFps: fps.reduce((a, b) => a + b, 0) / fps.length,
        minFps: Math.min(...fps),
        maxFps: Math.max(...fps),
        fpsStdDev: Math.sqrt(fps.reduce((a, b) => a + Math.pow(b - (fps.reduce((a, b) => a + b, 0) / fps.length), 2), 0) / fps.length),
      }
    })

    const result = {
      label,
      url,
      timestamp: new Date().toISOString(),
      totalTime,
      renderTime: perfData.renderTime,
      fps: {
        avg: perfData.avgFps,
        min: perfData.minFps,
        max: perfData.maxFps,
        stdDev: perfData.fpsStdDev,
      },
      memory: {
        jsHeapUsedSize: metrics.JSHeapUsedSize,
        jsHeapTotalSize: metrics.JSHeapTotalSize,
        usedPercent: (metrics.JSHeapUsedSize / metrics.JSHeapTotalSize * 100).toFixed(2),
      },
      performance: {
        scriptDuration: metrics.ScriptDuration,
        taskDuration: metrics.TaskDuration,
        layoutDuration: metrics.LayoutDuration,
        recalcStyleDuration: metrics.RecalcStyleDuration,
      },
      cdpMetrics: perfMetrics.metrics.reduce((acc, m) => {
        acc[m.name] = m.value
        return acc
      }, {}),
    }

    // Save detailed results
    fs.writeFileSync(outputFile, JSON.stringify(result, null, 2))

    await browser.close()
    return result
  } catch (e) {
    await browser.close()
    throw new Error(`${label} failed: ${e.message}`)
  }
}

const testType = process.argv[2] // 'longread' or 'shortread'
const coverage = process.argv[3] || '200x'

// Get labels from environment or use defaults
const PORT1 = process.env.PORT1 || '3000'
const PORT2 = process.env.PORT2 || '3001'
const PORT3 = process.env.PORT3 || '3002'
const LABEL1 = process.env.LABEL1 || 'Branch 1'
const LABEL2 = process.env.LABEL2 || 'Branch 2'
const LABEL3 = process.env.LABEL3 || 'Branch 3'

const URL1 = `http://localhost:${PORT1}/?config=test_data%2Fhg19mod.json&assembly=hg19mod&loc=chr22_mask:80,630..83,605&tracks=${coverage}.${testType}.cram`
const URL2 = `http://localhost:${PORT2}/?config=test_data%2Fhg19mod.json&assembly=hg19mod&loc=chr22_mask:80,630..83,605&tracks=${coverage}.${testType}.cram`
const URL3 = `http://localhost:${PORT3}/?config=test_data%2Fhg19mod.json&assembly=hg19mod&loc=chr22_mask:80,630..83,605&tracks=${coverage}.${testType}.cram`

console.log(`🔬 Running benchmark: ${coverage} ${testType}`)
console.log(`URL: ${URL1.split('?')[1]}`)
console.log('')

;(async () => {
  try {
    console.log(`Testing ${LABEL1}...`)
    const result1 = await runBenchmark(
      URL1,
      LABEL1,
      `results_${LABEL1.toLowerCase().replace(/\s+/g, '_')}_${coverage}_${testType}.json`
    )
    console.log(`  ✓ Total: ${result1.totalTime}ms`)
    console.log(`  ✓ Render: ${result1.renderTime.toFixed(2)}ms`)
    console.log(`  ✓ Memory: ${(result1.memory.jsHeapUsedSize / 1024 / 1024).toFixed(2)} MB`)
    console.log('')

    console.log(`Testing ${LABEL2}...`)
    const result2 = await runBenchmark(
      URL2,
      LABEL2,
      `results_${LABEL2.toLowerCase().replace(/\s+/g, '_')}_${coverage}_${testType}.json`
    )
    console.log(`  ✓ Total: ${result2.totalTime}ms`)
    console.log(`  ✓ Render: ${result2.renderTime.toFixed(2)}ms`)
    console.log(`  ✓ Memory: ${(result2.memory.jsHeapUsedSize / 1024 / 1024).toFixed(2)} MB`)
    console.log('')

    console.log(`Testing ${LABEL3}...`)
    const result3 = await runBenchmark(
      URL3,
      LABEL3,
      `results_${LABEL3.toLowerCase().replace(/\s+/g, '_')}_${coverage}_${testType}.json`
    )
    console.log(`  ✓ Total: ${result3.totalTime}ms`)
    console.log(`  ✓ Render: ${result3.renderTime.toFixed(2)}ms`)
    console.log(`  ✓ Memory: ${(result3.memory.jsHeapUsedSize / 1024 / 1024).toFixed(2)} MB`)
    console.log('')

    // Sort results by total time
    const results = [
      { label: LABEL1, result: result1 },
      { label: LABEL2, result: result2 },
      { label: LABEL3, result: result3 },
    ].sort((a, b) => a.result.totalTime - b.result.totalTime)

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📊 RESULTS (sorted by total time)')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    results.forEach((r, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'
      console.log(`${medal} ${r.label}:`)
      console.log(`   Total time:   ${r.result.totalTime}ms`)
      console.log(`   Render time:  ${r.result.renderTime.toFixed(2)}ms`)
      console.log(`   Memory:       ${(r.result.memory.jsHeapUsedSize / 1024 / 1024).toFixed(2)} MB`)
      console.log(`   Avg FPS:      ${r.result.fps.avg.toFixed(2)}`)
      console.log('')
    })

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📈 DETAILED METRICS')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`Task duration:       ${LABEL1}: ${result1.performance.taskDuration.toFixed(2)}s | ${LABEL2}: ${result2.performance.taskDuration.toFixed(2)}s | ${LABEL3}: ${result3.performance.taskDuration.toFixed(2)}s`)
    console.log(`Script duration:     ${LABEL1}: ${result1.performance.scriptDuration.toFixed(2)}s | ${LABEL2}: ${result2.performance.scriptDuration.toFixed(2)}s | ${LABEL3}: ${result3.performance.scriptDuration.toFixed(2)}s`)
    console.log(`Layout duration:     ${LABEL1}: ${result1.performance.layoutDuration.toFixed(2)}s | ${LABEL2}: ${result2.performance.layoutDuration.toFixed(2)}s | ${LABEL3}: ${result3.performance.layoutDuration.toFixed(2)}s`)
    console.log(`RecalcStyle duration: ${LABEL1}: ${result1.performance.recalcStyleDuration.toFixed(2)}s | ${LABEL2}: ${result2.performance.recalcStyleDuration.toFixed(2)}s | ${LABEL3}: ${result3.performance.recalcStyleDuration.toFixed(2)}s`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    // Export results for shell script
    console.log(`FASTEST=${results[0].label}`)

    process.exit(0)
  } catch (e) {
    console.error('Error:', e.message)
    process.exit(1)
  }
})()
