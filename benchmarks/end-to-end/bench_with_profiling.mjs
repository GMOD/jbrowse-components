import fs from 'fs'

import puppeteer from 'puppeteer'

async function runBenchmark(url, label, outputFile) {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })
  const page = await browser.newPage()

  // Enable performance monitoring
  await page.evaluateOnNewDocument(() => {
    window.performance.mark('navigation-start')
    window.perfData = {
      fps: [],
      renderStart: performance.now(),
      marks: [],
      timings: {},
    }
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
        window.perfData.fps.push(
          1 / ((performance.now() - LAST_FRAME_TIME) / 1000),
        )
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
    await page
      .waitForFunction(
        () => {
          const loadingTexts = Array.from(
            document.querySelectorAll('*'),
          ).filter(el => {
            const text = el.textContent || ''
            return (
              text.includes('Processing alignments') ||
              text.includes('Downloading alignments') ||
              text.includes('Loading')
            )
          })
          return loadingTexts.length === 0
        },
        { timeout: 120000 },
      )
      .catch(() => {
        // If timeout, continue anyway - some tests may not have these indicators
      })

    // Wait for rendering to stabilize
    await new Promise(resolve => setTimeout(resolve, 3000))

    // Take screenshot
    const screenshotPath = `screenshots/${label.toLowerCase().replace(/\s+/g, '_')}_${process.argv[2]}_${process.argv[2]}_success.png`
    await page.screenshot({ path: screenshotPath, fullPage: true })
    console.log(`  ✓ Screenshot saved to: ${screenshotPath}`)

    const endTime = Date.now()
    const totalTime = endTime - startTime

    // Collect performance metrics
    const metrics = await page.metrics()
    const perfMetrics = await client.send('Performance.getMetrics')

    const perfData = await page.evaluate(() => {
      const fps = window.perfData?.fps || []
      const renderTime = window.perfData?.renderStart
        ? performance.now() - window.perfData.renderStart
        : 0

      if (fps.length === 0) {
        return {
          renderTime,
          fps: [],
          avgFps: 0,
          minFps: 0,
          maxFps: 0,
          fpsStdDev: 0,
          timings: {},
          performanceEntries: [],
        }
      }

      const avgFps = fps.reduce((a, b) => a + b, 0) / fps.length

      const timings = window.perfData?.timings || {}
      const performanceEntries = performance.getEntriesByType('measure').map(entry => ({
        name: entry.name,
        duration: entry.duration,
        startTime: entry.startTime,
      }))

      return {
        renderTime,
        fps: fps,
        avgFps,
        minFps: Math.min(...fps),
        maxFps: Math.max(...fps),
        fpsStdDev: Math.sqrt(
          fps.reduce((a, b) => a + Math.pow(b - avgFps, 2), 0) / fps.length,
        ),
        timings,
        performanceEntries,
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
        usedPercent: (
          (metrics.JSHeapUsedSize / metrics.JSHeapTotalSize) *
          100
        ).toFixed(2),
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
      detailedTimings: perfData.timings,
      performanceEntries: perfData.performanceEntries,
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
const coverage = process.argv[2] || '200x'
const numRuns = parseInt(process.env.BENCHMARK_RUNS || '5', 10)

// Get labels from environment or use defaults
const PORT1 = process.env.PORT1 || '3000'
const PORT2 = process.env.PORT2 || '3001'
const PORT3 = process.env.PORT3 || '3002'
const LABEL1 = process.env.LABEL1 || 'Branch 1'
const LABEL2 = process.env.LABEL2 || 'Branch 2'
const LABEL3 = process.env.LABEL3 || 'Branch 3'

const URL1 = `http://localhost/jb2/port${PORT1}/?config=test_data%2Fhg19mod.json&assembly=hg19mod&loc=chr22_mask:80,630..83,605&tracks=${coverage}.${testType}.cram`
const URL2 = `http://localhost/jb2/port${PORT2}/?config=test_data%2Fhg19mod.json&assembly=hg19mod&loc=chr22_mask:80,630..83,605&tracks=${coverage}.${testType}.cram`
const URL3 = `http://localhost/jb2/port${PORT3}/?config=test_data%2Fhg19mod.json&assembly=hg19mod&loc=chr22_mask:80,630..83,605&tracks=${coverage}.${testType}.cram`

async function runMultipleTimes(url, label, numRuns) {
  const runs = []

  console.log(`Testing ${label} (${numRuns} runs)...`)

  for (let i = 0; i < numRuns; i++) {
    console.log(`  Run ${i + 1}/${numRuns}...`)
    const result = await runBenchmark(
      url,
      label,
      `results_${label.toLowerCase().replace(/\s+/g, '_')}_${coverage}_${testType}_run${i + 1}.json`,
    )
    runs.push(result)
    console.log(
      `    Total: ${result.totalTime}ms, Render: ${result.renderTime.toFixed(2)}ms, Memory: ${(result.memory.jsHeapUsedSize / 1024 / 1024).toFixed(2)} MB`,
    )

    if (result.detailedTimings && Object.keys(result.detailedTimings).length > 0) {
      console.log(`    📊 Detailed Timings:`)
      const t = result.detailedTimings
      if (t.bamCramFetchTime) console.log(`       BAM/CRAM Fetch:   ${t.bamCramFetchTime.toFixed(2)}ms`)
      if (t.depthTime) console.log(`       Process Depth:    ${t.depthTime.toFixed(2)}ms`)
      if (t.mismatchesTime) console.log(`       Process Mismatches: ${t.mismatchesTime.toFixed(2)}ms`)
      if (t.modificationsTime) console.log(`       Modifications:    ${t.modificationsTime.toFixed(2)}ms`)
      if (t.methylationTime) console.log(`       Methylation:      ${t.methylationTime.toFixed(2)}ms`)
      if (t.fetchSequenceTime) console.log(`       Fetch Sequence:   ${t.fetchSequenceTime.toFixed(2)}ms`)
      if (t.postProcessTime) console.log(`       Post-process:     ${t.postProcessTime.toFixed(2)}ms`)
      if (t.emitTime) console.log(`       Emit Features:    ${t.emitTime.toFixed(2)}ms`)
      if (t.featureCount) console.log(`       Feature Count:    ${t.featureCount}`)
    }
  }

  // Calculate averages and standard deviations
  const avgTotalTime = runs.reduce((sum, r) => sum + r.totalTime, 0) / numRuns
  const avgRenderTime = runs.reduce((sum, r) => sum + r.renderTime, 0) / numRuns
  const avgMemory =
    runs.reduce((sum, r) => sum + r.memory.jsHeapUsedSize, 0) / numRuns
  const avgTaskDuration =
    runs.reduce((sum, r) => sum + r.performance.taskDuration, 0) / numRuns
  const avgScriptDuration =
    runs.reduce((sum, r) => sum + r.performance.scriptDuration, 0) / numRuns
  const avgLayoutDuration =
    runs.reduce((sum, r) => sum + r.performance.layoutDuration, 0) / numRuns
  const avgRecalcStyleDuration =
    runs.reduce((sum, r) => sum + r.performance.recalcStyleDuration, 0) /
    numRuns
  const avgFps = runs.reduce((sum, r) => sum + r.fps.avg, 0) / numRuns

  const avgDetailedTimings = {}
  const timingKeys = ['bamCramFetchTime', 'depthTime', 'mismatchesTime', 'modificationsTime',
                      'methylationTime', 'fetchSequenceTime', 'postProcessTime', 'emitTime', 'featureCount']
  for (const key of timingKeys) {
    const values = runs.map(r => r.detailedTimings?.[key] || 0).filter(v => v > 0)
    if (values.length > 0) {
      avgDetailedTimings[key] = values.reduce((sum, v) => sum + v, 0) / values.length
    }
  }

  const stdDevTotalTime = Math.sqrt(
    runs.reduce((sum, r) => sum + Math.pow(r.totalTime - avgTotalTime, 2), 0) /
      numRuns,
  )
  const stdDevRenderTime = Math.sqrt(
    runs.reduce(
      (sum, r) => sum + Math.pow(r.renderTime - avgRenderTime, 2),
      0,
    ) / numRuns,
  )

  console.log(
    `  ✓ Avg Total: ${avgTotalTime.toFixed(2)}ms (±${stdDevTotalTime.toFixed(2)}ms)`,
  )
  console.log(
    `  ✓ Avg Render: ${isNaN(avgRenderTime) ? 'N/A' : `${avgRenderTime.toFixed(2)}ms (±${stdDevRenderTime.toFixed(2)}ms)`}`,
  )
  console.log(`  ✓ Avg Memory: ${(avgMemory / 1024 / 1024).toFixed(2)} MB`)

  if (Object.keys(avgDetailedTimings).length > 0) {
    console.log(`  📊 Average Detailed Timings:`)
    if (avgDetailedTimings.bamCramFetchTime) console.log(`     BAM/CRAM Fetch:   ${avgDetailedTimings.bamCramFetchTime.toFixed(2)}ms`)
    if (avgDetailedTimings.depthTime) console.log(`     Process Depth:    ${avgDetailedTimings.depthTime.toFixed(2)}ms`)
    if (avgDetailedTimings.mismatchesTime) console.log(`     Mismatches:       ${avgDetailedTimings.mismatchesTime.toFixed(2)}ms`)
    if (avgDetailedTimings.modificationsTime) console.log(`     Modifications:    ${avgDetailedTimings.modificationsTime.toFixed(2)}ms`)
    if (avgDetailedTimings.methylationTime) console.log(`     Methylation:      ${avgDetailedTimings.methylationTime.toFixed(2)}ms`)
    if (avgDetailedTimings.fetchSequenceTime) console.log(`     Fetch Sequence:   ${avgDetailedTimings.fetchSequenceTime.toFixed(2)}ms`)
    if (avgDetailedTimings.postProcessTime) console.log(`     Post-process:     ${avgDetailedTimings.postProcessTime.toFixed(2)}ms`)
    if (avgDetailedTimings.emitTime) console.log(`     Emit Features:    ${avgDetailedTimings.emitTime.toFixed(2)}ms`)
    if (avgDetailedTimings.featureCount) console.log(`     Feature Count:    ${Math.round(avgDetailedTimings.featureCount)}`)
  }

  console.log('')

  return {
    runs,
    avg: {
      totalTime: avgTotalTime,
      renderTime: avgRenderTime,
      memory: { jsHeapUsedSize: avgMemory },
      performance: {
        taskDuration: avgTaskDuration,
        scriptDuration: avgScriptDuration,
        layoutDuration: avgLayoutDuration,
        recalcStyleDuration: avgRecalcStyleDuration,
      },
      fps: { avg: avgFps },
      detailedTimings: avgDetailedTimings,
    },
    stdDev: {
      totalTime: stdDevTotalTime,
      renderTime: stdDevRenderTime,
    },
  }
}

console.log(
  `🔬 Running benchmark: ${coverage} ${testType} (${numRuns} runs per branch)`,
)
console.log(`URL: ${URL1.split('?')[1]}`)
console.log('')
;(async () => {
  try {
    const results1 = await runMultipleTimes(URL1, LABEL1, numRuns)
    const results2 = await runMultipleTimes(URL2, LABEL2, numRuns)
    const results3 = await runMultipleTimes(URL3, LABEL3, numRuns)

    const result1 = results1.avg
    const result2 = results2.avg
    const result3 = results3.avg

    // Sort results by total time
    const results = [
      { label: LABEL1, result: result1, stdDev: results1.stdDev },
      { label: LABEL2, result: result2, stdDev: results2.stdDev },
      { label: LABEL3, result: result3, stdDev: results3.stdDev },
    ].sort((a, b) => a.result.totalTime - b.result.totalTime)

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`📊 RESULTS (sorted by avg total time, ${numRuns} runs each)`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    for (const [i, r] of results.entries()) {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'
      console.log(`${medal} ${r.label}:`)
      console.log(
        `   Total time:   ${r.result.totalTime.toFixed(2)}ms (±${r.stdDev.totalTime.toFixed(2)}ms)`,
      )
      const renderTimeStr = isNaN(r.result.renderTime)
        ? 'N/A'
        : `${r.result.renderTime.toFixed(2)}ms (±${r.stdDev.renderTime.toFixed(2)}ms)`
      console.log(`   Render time:  ${renderTimeStr}`)
      console.log(
        `   Memory:       ${(r.result.memory.jsHeapUsedSize / 1024 / 1024).toFixed(2)} MB`,
      )
      console.log(`   Avg FPS:      ${r.result.fps.avg.toFixed(2)}`)

      if (r.result.detailedTimings && Object.keys(r.result.detailedTimings).length > 0) {
        console.log(`   📊 Timing Breakdown:`)
        const t = r.result.detailedTimings
        if (t.bamCramFetchTime) console.log(`      BAM/CRAM Fetch:   ${t.bamCramFetchTime.toFixed(2)}ms`)
        if (t.depthTime) console.log(`      Process Depth:    ${t.depthTime.toFixed(2)}ms`)
        if (t.mismatchesTime) console.log(`      Mismatches:       ${t.mismatchesTime.toFixed(2)}ms`)
        if (t.modificationsTime) console.log(`      Modifications:    ${t.modificationsTime.toFixed(2)}ms`)
        if (t.methylationTime) console.log(`      Methylation:      ${t.methylationTime.toFixed(2)}ms`)
        if (t.fetchSequenceTime) console.log(`      Fetch Sequence:   ${t.fetchSequenceTime.toFixed(2)}ms`)
        if (t.postProcessTime) console.log(`      Post-process:     ${t.postProcessTime.toFixed(2)}ms`)
        if (t.emitTime) console.log(`      Emit Features:    ${t.emitTime.toFixed(2)}ms`)
        if (t.featureCount) console.log(`      Feature Count:    ${Math.round(t.featureCount)}`)
      }

      console.log('')
    }

    // Export results for shell script
    console.log(`FASTEST=${results[0].label}`)

    process.exit(0)
  } catch (e) {
    console.error('Error:', e.message)
    process.exit(1)
  }
})()
