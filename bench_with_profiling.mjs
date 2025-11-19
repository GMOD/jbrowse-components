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

const OPTIMIZED_URL = `http://localhost:3000/?config=test_data%2Fhg19mod.json&assembly=hg19mod&loc=chr22_mask:80,630..83,605&tracks=${coverage}.${testType}.cram`
const MASTER_URL = `http://localhost:3001/?config=test_data%2Fhg19mod.json&assembly=hg19mod&loc=chr22_mask:80,630..83,605&tracks=${coverage}.${testType}.cram`

console.log(`🔬 Running benchmark: ${coverage} ${testType}`)
console.log(`URL: ${OPTIMIZED_URL.split('?')[1]}`)
console.log('')

;(async () => {
  try {
    console.log('Testing MASTER branch...')
    const masterResult = await runBenchmark(
      MASTER_URL,
      'MASTER',
      `results_master_${coverage}_${testType}.json`
    )
    console.log(`  ✓ Total: ${masterResult.totalTime}ms`)
    console.log(`  ✓ Render: ${masterResult.renderTime.toFixed(2)}ms`)
    console.log(`  ✓ Memory: ${(masterResult.memory.jsHeapUsedSize / 1024 / 1024).toFixed(2)} MB`)
    console.log('')

    console.log('Testing OPTIMIZED branch...')
    const optimizedResult = await runBenchmark(
      OPTIMIZED_URL,
      'OPTIMIZED',
      `results_optimized_${coverage}_${testType}.json`
    )
    console.log(`  ✓ Total: ${optimizedResult.totalTime}ms`)
    console.log(`  ✓ Render: ${optimizedResult.renderTime.toFixed(2)}ms`)
    console.log(`  ✓ Memory: ${(optimizedResult.memory.jsHeapUsedSize / 1024 / 1024).toFixed(2)} MB`)
    console.log('')

    const improvement = ((masterResult.totalTime - optimizedResult.totalTime) / masterResult.totalTime * 100)
    const memImprovement = ((masterResult.memory.jsHeapUsedSize - optimizedResult.memory.jsHeapUsedSize) / masterResult.memory.jsHeapUsedSize * 100)

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📊 COMPARISON')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`Time improvement:   ${improvement > 0 ? '+' : ''}${improvement.toFixed(2)}%`)
    console.log(`Memory improvement: ${memImprovement > 0 ? '+' : ''}${memImprovement.toFixed(2)}%`)
    console.log('')
    console.log(`Task duration:      MASTER: ${masterResult.performance.taskDuration.toFixed(2)}s | OPTIMIZED: ${optimizedResult.performance.taskDuration.toFixed(2)}s`)
    console.log(`Script duration:    MASTER: ${masterResult.performance.scriptDuration.toFixed(2)}s | OPTIMIZED: ${optimizedResult.performance.scriptDuration.toFixed(2)}s`)
    console.log(`Layout duration:    MASTER: ${masterResult.performance.layoutDuration.toFixed(2)}s | OPTIMIZED: ${optimizedResult.performance.layoutDuration.toFixed(2)}s`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    process.exit(improvement > 0 ? 0 : 1)
  } catch (e) {
    console.error('Error:', e.message)
    process.exit(1)
  }
})()
