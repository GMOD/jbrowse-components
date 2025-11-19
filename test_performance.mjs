import puppeteer from 'puppeteer'

const OPTIMIZED_URL = 'http://localhost:3000/?config=test_data%2Fhg19mod.json&assembly=hg19mod&loc=chr22_mask:80,630..83,605&tracks=400x.longread.cram'
const MASTER_URL = 'http://localhost:3001/?config=test_data%2Fhg19mod.json&assembly=hg19mod&loc=chr22_mask:80,630..83,605&tracks=400x.longread.cram'

async function measureRenderTime(url, label) {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox'],
  })
  const page = await browser.newPage()

  const startTime = Date.now()
  await page.goto(url, { waitUntil: 'networkidle0' })

  const params = new URL(url).searchParams
  const tracks = params.get('tracks')
  if (!tracks) {
    throw new Error('no tracks')
  }
  const n = tracks.split(',').length
  const nblocks = 2 * n

  try {
    await page.evaluate(() => {
      window.fps = []
      window.renderStart = performance.now()
      let LAST_FRAME_TIME = performance.now()
      function measure(TIME) {
        window.fps.push(1 / ((performance.now() - LAST_FRAME_TIME) / 1000))
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

    const metrics = await page.evaluate(() => ({
      renderTime: performance.now() - window.renderStart,
      fps: window.fps,
      avgFps: window.fps.reduce((a, b) => a + b, 0) / window.fps.length,
      minFps: Math.min(...window.fps),
      maxFps: Math.max(...window.fps),
    }))

    const totalTime = Date.now() - startTime
    const pageMetrics = await page.metrics()

    await browser.close()

    return {
      label,
      totalTime,
      renderTime: metrics.renderTime,
      avgFps: metrics.avgFps,
      minFps: metrics.minFps,
      maxFps: metrics.maxFps,
      jsHeapUsedSize: pageMetrics.JSHeapUsedSize,
      jsHeapTotalSize: pageMetrics.JSHeapTotalSize,
    }
  } catch (e) {
    await browser.close()
    throw new Error(`${label} timed out: ${e.message}`)
  }
}

async function runComparison(runs = 3) {
  console.log('🚀 Starting performance comparison...\n')

  const masterResults = []
  const optimizedResults = []

  for (let i = 0; i < runs; i++) {
    console.log(`\n📊 Run ${i + 1}/${runs}`)
    console.log('─'.repeat(60))

    console.log('Testing MASTER branch...')
    const masterResult = await measureRenderTime(MASTER_URL, 'MASTER')
    masterResults.push(masterResult)
    console.log(`  ✓ Total time: ${masterResult.totalTime}ms`)
    console.log(`  ✓ Render time: ${masterResult.renderTime.toFixed(2)}ms`)
    console.log(`  ✓ Avg FPS: ${masterResult.avgFps.toFixed(2)}`)

    console.log('\nTesting OPTIMIZED branch...')
    const optimizedResult = await measureRenderTime(OPTIMIZED_URL, 'OPTIMIZED')
    optimizedResults.push(optimizedResult)
    console.log(`  ✓ Total time: ${optimizedResult.totalTime}ms`)
    console.log(`  ✓ Render time: ${optimizedResult.renderTime.toFixed(2)}ms`)
    console.log(`  ✓ Avg FPS: ${optimizedResult.avgFps.toFixed(2)}`)

    const improvement = ((masterResult.totalTime - optimizedResult.totalTime) / masterResult.totalTime * 100).toFixed(2)
    console.log(`\n  💡 Improvement: ${improvement}%`)
  }

  console.log('\n\n' + '═'.repeat(60))
  console.log('📈 FINAL RESULTS')
  console.log('═'.repeat(60))

  const avgMaster = {
    totalTime: masterResults.reduce((a, b) => a + b.totalTime, 0) / runs,
    renderTime: masterResults.reduce((a, b) => a + b.renderTime, 0) / runs,
    avgFps: masterResults.reduce((a, b) => a + b.avgFps, 0) / runs,
    jsHeapUsed: masterResults.reduce((a, b) => a + b.jsHeapUsedSize, 0) / runs,
  }

  const avgOptimized = {
    totalTime: optimizedResults.reduce((a, b) => a + b.totalTime, 0) / runs,
    renderTime: optimizedResults.reduce((a, b) => a + b.renderTime, 0) / runs,
    avgFps: optimizedResults.reduce((a, b) => a + b.avgFps, 0) / runs,
    jsHeapUsed: optimizedResults.reduce((a, b) => a + b.jsHeapUsedSize, 0) / runs,
  }

  console.log('\nMASTER (average):')
  console.log(`  Total time:     ${avgMaster.totalTime.toFixed(2)}ms`)
  console.log(`  Render time:    ${avgMaster.renderTime.toFixed(2)}ms`)
  console.log(`  Avg FPS:        ${avgMaster.avgFps.toFixed(2)}`)
  console.log(`  JS Heap Used:   ${(avgMaster.jsHeapUsed / 1024 / 1024).toFixed(2)} MB`)

  console.log('\nOPTIMIZED (average):')
  console.log(`  Total time:     ${avgOptimized.totalTime.toFixed(2)}ms`)
  console.log(`  Render time:    ${avgOptimized.renderTime.toFixed(2)}ms`)
  console.log(`  Avg FPS:        ${avgOptimized.avgFps.toFixed(2)}`)
  console.log(`  JS Heap Used:   ${(avgOptimized.jsHeapUsed / 1024 / 1024).toFixed(2)} MB`)

  const totalTimeImprovement = ((avgMaster.totalTime - avgOptimized.totalTime) / avgMaster.totalTime * 100)
  const renderTimeImprovement = ((avgMaster.renderTime - avgOptimized.renderTime) / avgMaster.renderTime * 100)
  const memoryImprovement = ((avgMaster.jsHeapUsed - avgOptimized.jsHeapUsed) / avgMaster.jsHeapUsed * 100)

  console.log('\n' + '─'.repeat(60))
  console.log('🎯 IMPROVEMENTS:')
  console.log(`  Total time:     ${totalTimeImprovement > 0 ? '+' : ''}${totalTimeImprovement.toFixed(2)}%`)
  console.log(`  Render time:    ${renderTimeImprovement > 0 ? '+' : ''}${renderTimeImprovement.toFixed(2)}%`)
  console.log(`  Memory:         ${memoryImprovement > 0 ? '+' : ''}${memoryImprovement.toFixed(2)}%`)
  console.log('═'.repeat(60))
}

runComparison(3).catch(console.error)
