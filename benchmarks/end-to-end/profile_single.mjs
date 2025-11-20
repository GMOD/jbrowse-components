import fs from 'fs'
import puppeteer from 'puppeteer'

const testType = process.argv[2] || 'shortread' // 'longread' or 'shortread'
const coverage = process.argv[3] || '200x'
const buildFolder = process.argv[4] || 'port3000' // folder name in /var/www/html/jb2/
const numRuns = parseInt(process.env.BENCHMARK_RUNS || '3', 10)

const testURL = `http://localhost/jb2/${buildFolder}/?config=test_data%2Fhg19mod.json&assembly=hg19mod&loc=chr22_mask:80,630..83,605&tracks=${coverage}.${testType}.cram`

async function runBenchmark() {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })
  const page = await browser.newPage()

  // Listen to console messages
  page.on('console', msg => console.log('BROWSER:', msg.text()))

  // Enable performance monitoring - THIS RUNS BEFORE PAGE LOADS
  await page.evaluateOnNewDocument(() => {
    window.performance.mark('navigation-start')
    // Initialize perfData BEFORE any JBrowse code runs
    window.perfData = {
      fps: [],
      renderStart: performance.now(),
      marks: [],
      timings: {}, // CRITICAL: this must exist when SNPCoverageAdapter code runs
    }
    console.log('INIT: perfData.timings initialized')
  })

  const params = new URL(testURL).searchParams
  const tracks = params.get('tracks')
  if (!tracks) {
    throw new Error('no tracks')
  }
  const n = tracks.split(',').length
  const nblocks = 2 * n

  const startTime = Date.now()
  await page.goto(testURL, { waitUntil: 'networkidle0' })

  try {
    // Start performance monitoring
    const client = await page.target().createCDPSession()
    await client.send('Performance.enable')

    await page.evaluate(() => {
      // Ensure window.perfData exists with all required properties
      if (!window.perfData) {
        window.perfData = {}
      }
      if (!window.perfData.timings) {
        window.perfData.timings = {}
      }
      if (!window.perfData.fps) {
        window.perfData.fps = []
      }
      if (!window.perfData.renderStart) {
        window.perfData.renderStart = performance.now()
      }

      let LAST_FRAME_TIME = performance.now()
      function measure() {
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

    // Wait for loading indicators to disappear
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
      .catch(() => {})

    // Wait for rendering to stabilize
    await new Promise(resolve => setTimeout(resolve, 3000))

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

      const avgFps = fps.length > 0 ? fps.reduce((a, b) => a + b, 0) / fps.length : 0

      const timings = window.perfData?.timings || {}
      const performanceEntries = performance.getEntriesByType('measure').map(entry => ({
        name: entry.name,
        duration: entry.duration,
        startTime: entry.startTime,
      }))

      // Debug: log what we have
      console.log('perfData exists:', !!window.perfData)
      console.log('perfData.timings exists:', !!window.perfData?.timings)
      console.log('timings:', JSON.stringify(timings))
      console.log('performance entries:', performance.getEntriesByType('measure').length)

      return {
        renderTime,
        avgFps,
        minFps: fps.length > 0 ? Math.min(...fps) : 0,
        maxFps: fps.length > 0 ? Math.max(...fps) : 0,
        timings,
        performanceEntries,
      }
    })

    const result = {
      testType,
      coverage,
      buildFolder,
      url: testURL,
      timestamp: new Date().toISOString(),
      totalTime,
      renderTime: perfData.renderTime,
      fps: {
        avg: perfData.avgFps,
        min: perfData.minFps,
        max: perfData.maxFps,
      },
      memory: {
        jsHeapUsedSize: metrics.JSHeapUsedSize,
        jsHeapTotalSize: metrics.JSHeapTotalSize,
      },
      performance: {
        scriptDuration: metrics.ScriptDuration,
        taskDuration: metrics.TaskDuration,
        layoutDuration: metrics.LayoutDuration,
        recalcStyleDuration: metrics.RecalcStyleDuration,
      },
      detailedTimings: perfData.timings,
      performanceEntries: perfData.performanceEntries,
    }

    await browser.close()
    return result
  } catch (e) {
    await browser.close()
    throw new Error(`Benchmark failed: ${e.message}`)
  }
}

console.log(`🔬 Profiling ${coverage} ${testType} on ${buildFolder}`)
console.log(`   URL: ${testURL}`)
console.log(`   Running ${numRuns} iterations...`)
console.log('')

const runs = []

for (let i = 0; i < numRuns; i++) {
  console.log(`Run ${i + 1}/${numRuns}...`)
  const result = await runBenchmark()
  runs.push(result)

  console.log(`  ✓ Total: ${result.totalTime}ms, Render: ${result.renderTime.toFixed(2)}ms, Memory: ${(result.memory.jsHeapUsedSize / 1024 / 1024).toFixed(2)} MB`)

  if (result.detailedTimings && Object.keys(result.detailedTimings).length > 0) {
    console.log(`  📊 Detailed Timings:`)
    const t = result.detailedTimings
    if (t.bamCramFetchTime) console.log(`     BAM/CRAM Fetch:     ${t.bamCramFetchTime.toFixed(2)}ms`)
    if (t.depthTime) console.log(`     Process Depth:      ${t.depthTime.toFixed(2)}ms`)
    if (t.mismatchesTime) console.log(`     Process Mismatches: ${t.mismatchesTime.toFixed(2)}ms`)
    if (t.modificationsTime) console.log(`     Modifications:      ${t.modificationsTime.toFixed(2)}ms`)
    if (t.methylationTime) console.log(`     Methylation:        ${t.methylationTime.toFixed(2)}ms`)
    if (t.fetchSequenceTime) console.log(`     Fetch Sequence:     ${t.fetchSequenceTime.toFixed(2)}ms`)
    if (t.postProcessTime) console.log(`     Post-process:       ${t.postProcessTime.toFixed(2)}ms`)
    if (t.emitTime) console.log(`     Emit Features:      ${t.emitTime.toFixed(2)}ms`)
    if (t.featureCount) console.log(`     Feature Count:      ${t.featureCount}`)
  }
  console.log('')
}

// Calculate averages
const avgTotalTime = runs.reduce((sum, r) => sum + r.totalTime, 0) / numRuns
const avgRenderTime = runs.reduce((sum, r) => sum + r.renderTime, 0) / numRuns
const avgMemory = runs.reduce((sum, r) => sum + r.memory.jsHeapUsedSize, 0) / numRuns

const avgDetailedTimings = {}
const timingKeys = ['bamCramFetchTime', 'depthTime', 'mismatchesTime', 'modificationsTime',
                    'methylationTime', 'fetchSequenceTime', 'postProcessTime', 'emitTime', 'featureCount']
for (const key of timingKeys) {
  const values = runs.map(r => r.detailedTimings?.[key] || 0).filter(v => v > 0)
  if (values.length > 0) {
    avgDetailedTimings[key] = values.reduce((sum, v) => sum + v, 0) / values.length
  }
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log(`📊 AVERAGE RESULTS (${numRuns} runs)`)
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log(`Total time:   ${avgTotalTime.toFixed(2)}ms`)
console.log(`Render time:  ${avgRenderTime.toFixed(2)}ms`)
console.log(`Memory:       ${(avgMemory / 1024 / 1024).toFixed(2)} MB`)
console.log('')

if (Object.keys(avgDetailedTimings).length > 0) {
  console.log('📊 Detailed Timing Breakdown:')
  if (avgDetailedTimings.bamCramFetchTime) {
    const pct = (avgDetailedTimings.bamCramFetchTime / avgTotalTime * 100).toFixed(1)
    console.log(`   BAM/CRAM Fetch:     ${avgDetailedTimings.bamCramFetchTime.toFixed(2)}ms (${pct}%)`)
  }
  if (avgDetailedTimings.depthTime) {
    const pct = (avgDetailedTimings.depthTime / avgTotalTime * 100).toFixed(1)
    console.log(`   Process Depth:      ${avgDetailedTimings.depthTime.toFixed(2)}ms (${pct}%)`)
  }
  if (avgDetailedTimings.mismatchesTime) {
    const pct = (avgDetailedTimings.mismatchesTime / avgTotalTime * 100).toFixed(1)
    console.log(`   Mismatches:         ${avgDetailedTimings.mismatchesTime.toFixed(2)}ms (${pct}%)`)
  }
  if (avgDetailedTimings.modificationsTime) {
    const pct = (avgDetailedTimings.modificationsTime / avgTotalTime * 100).toFixed(1)
    console.log(`   Modifications:      ${avgDetailedTimings.modificationsTime.toFixed(2)}ms (${pct}%)`)
  }
  if (avgDetailedTimings.methylationTime) {
    const pct = (avgDetailedTimings.methylationTime / avgTotalTime * 100).toFixed(1)
    console.log(`   Methylation:        ${avgDetailedTimings.methylationTime.toFixed(2)}ms (${pct}%)`)
  }
  if (avgDetailedTimings.fetchSequenceTime) {
    const pct = (avgDetailedTimings.fetchSequenceTime / avgTotalTime * 100).toFixed(1)
    console.log(`   Fetch Sequence:     ${avgDetailedTimings.fetchSequenceTime.toFixed(2)}ms (${pct}%)`)
  }
  if (avgDetailedTimings.postProcessTime) {
    const pct = (avgDetailedTimings.postProcessTime / avgTotalTime * 100).toFixed(1)
    console.log(`   Post-process:       ${avgDetailedTimings.postProcessTime.toFixed(2)}ms (${pct}%)`)
  }
  if (avgDetailedTimings.emitTime) {
    const pct = (avgDetailedTimings.emitTime / avgTotalTime * 100).toFixed(1)
    console.log(`   Emit Features:      ${avgDetailedTimings.emitTime.toFixed(2)}ms (${pct}%)`)
  }
  if (avgDetailedTimings.featureCount) {
    console.log(`   Feature Count:      ${Math.round(avgDetailedTimings.featureCount)}`)
  }

  // Calculate "other" time (rendering, layout, etc)
  const accountedTime = Object.entries(avgDetailedTimings)
    .filter(([key]) => key !== 'featureCount')
    .reduce((sum, [, val]) => sum + val, 0)
  const otherTime = avgTotalTime - accountedTime
  const otherPct = (otherTime / avgTotalTime * 100).toFixed(1)
  console.log(`   Other (render/layout): ${otherTime.toFixed(2)}ms (${otherPct}%)`)
}

console.log('')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

// Save detailed results
const outputFile = `results/profile_${buildFolder}_${coverage}_${testType}.json`
fs.writeFileSync(outputFile, JSON.stringify({ runs, averages: avgDetailedTimings }, null, 2))
console.log(`📁 Detailed results saved to: ${outputFile}`)
