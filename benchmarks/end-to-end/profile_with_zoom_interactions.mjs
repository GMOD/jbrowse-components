import fs from 'fs'
import puppeteer from 'puppeteer'

const testType = process.argv[2] || 'shortread'
const coverage = process.argv[3] || '200x'
const buildFolder = process.argv[4] || 'port3000'

const testURL = `http://localhost/jb2/${buildFolder}/?config=test_data%2Fhg19mod.json&assembly=hg19mod&loc=chr22_mask:80,630..83,605&tracks=${coverage}.${testType}.cram`

console.log('🔬 Chrome Tracing with Zoom Interactions')
console.log(`   Test: ${coverage} ${testType}`)
console.log(`   URL: ${testURL}`)
console.log('')

async function waitForRenderComplete(page, nblocks, label) {
  console.log(`⏳ Waiting for ${label} to complete...`)
  const startWait = Date.now()

  try {
    await page.waitForFunction(
      nblocks =>
        document.querySelectorAll('[data-testid="pileup-overlay-normal"]').length === nblocks &&
        document.querySelectorAll('[data-testid="wiggle-rendering-test"]').length == nblocks,
      { timeout: 120000 },
      nblocks,
    )

    // Wait for loading indicators to disappear
    await page.waitForFunction(
      () => {
        const loadingTexts = Array.from(document.querySelectorAll('*')).filter(el => {
          const text = el.textContent || ''
          const textContent = text.trim()
          return (
            textContent.includes('Processing alignments') ||
            textContent.includes('Downloading alignments') ||
            textContent.includes('Creating layout') ||
            textContent.includes('Loading') ||
            textContent.includes('loading')
          )
        })
        return loadingTexts.length === 0
      },
      { timeout: 120000 },
    ).catch(() => {})

    // Additional wait to ensure no new loading indicators appear
    await new Promise(resolve => setTimeout(resolve, 3000))

    // Final check that loading is truly gone
    await page.waitForFunction(
      () => {
        const allText = document.body.innerText || ''
        return !allText.includes('Downloading alignments') &&
               !allText.includes('Creating layout') &&
               !allText.includes('Processing alignments')
      },
      { timeout: 10000 },
    ).catch(() => {})

    const waitTime = Date.now() - startWait
    console.log(`✅ ${label} completed in ${waitTime}ms`)
    return waitTime
  } catch (error) {
    console.log(`⚠️  Timeout waiting for ${label}`)
    return Date.now() - startWait
  }
}

async function performZoom(page, direction, nblocks, timings, screenshotBase, iteration) {
  const directionName = direction === 'out' ? 'Zoom out' : 'Zoom in'
  const testId = direction === 'out' ? 'zoom_out' : 'zoom_in'
  const timingClickKey = direction === 'out' ? `zoomOut${iteration}` : `zoomIn${iteration}`
  const timingRenderKey = direction === 'out' ? `zoomOutRender${iteration}` : `zoomInRender${iteration}`

  console.log(`🔍 Clicking ${directionName.toLowerCase()} button (iteration ${iteration})...`)
  const clickStart = Date.now()

  try {
    const button = await page.$(`[data-testid="${testId}"]`)
    if (!button) {
      throw new Error(`${directionName} button not found`)
    }
    await button.click()
    timings[timingClickKey] = Date.now() - clickStart
    console.log(`✅ ${directionName} clicked in ${timings[timingClickKey]}ms`)

    // Wait for render
    timings[timingRenderKey] = await waitForRenderComplete(
      page,
      nblocks,
      `${directionName} render (iteration ${iteration})`,
    )

    // Take screenshot with iteration counter
    const screenshotPath = `${screenshotBase}_iter${iteration}_${direction}.png`
    await page.screenshot({ path: screenshotPath })
    console.log(`📸 Screenshot saved: ${screenshotPath}`)
    console.log('')

    return true
  } catch (error) {
    console.log(`⚠️  ${directionName} failed: ${error.message}`)
    return false
  }
}

async function captureProfile() {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })
  const page = await browser.newPage()

  console.log('📊 Starting Chrome Tracing...')

  // Use Chrome's Tracing API which captures everything including workers
  await page.tracing.start({
    path: `results/trace_${buildFolder}_${coverage}_${testType}_zoom.json`,
    categories: ['devtools.timeline', 'v8.execute', 'disabled-by-default-v8.cpu_profiler'],
    screenshots: false,
  })

  const overallStartTime = Date.now()
  const timings = {
    initialLoad: 0,
    initialRender: 0,
    zoomOut: 0,
    zoomOutRender: 0,
    zoomIn: 0,
    zoomInRender: 0,
  }

  console.log('🌐 Navigating to page...')
  const navStart = Date.now()
  await page.goto(testURL, { waitUntil: 'networkidle0', timeout: 120000 })
  timings.initialLoad = Date.now() - navStart
  console.log(`✅ Page loaded in ${timings.initialLoad}ms`)

  const params = new URL(testURL).searchParams
  const tracks = params.get('tracks')
  const n = tracks.split(',').length
  const nblocks = 2 * n

  // Wait for initial render
  timings.initialRender = await waitForRenderComplete(page, nblocks, 'Initial render')

  // Take screenshot after initial render
  const screenshotBase = `results/screenshot_${buildFolder}_${coverage}_${testType}`
  await page.screenshot({ path: `${screenshotBase}_initial.png` })
  console.log(`📸 Screenshot saved: ${screenshotBase}_initial.png`)
  console.log('')

  // Perform zoom interactions: 3 iterations of zoom out then zoom in
  for (let i = 1; i <= 3; i++) {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`📍 ZOOM ITERATION ${i} OF 3`)
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log('')

    // Zoom out
    await performZoom(page, 'out', nblocks, timings, screenshotBase, i)

    // Zoom in
    await performZoom(page, 'in', nblocks, timings, screenshotBase, i)
  }

  console.log('🛑 Stopping trace and saving...')
  await page.tracing.stop()

  const totalTime = Date.now() - overallStartTime

  console.log('')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📊 PERFORMANCE SUMMARY')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('')
  console.log(`Total test duration: ${totalTime}ms`)
  console.log('')
  console.log('Breakdown:')
  console.log(`  Initial page load:    ${timings.initialLoad}ms`)
  console.log(`  Initial render:       ${timings.initialRender}ms`)
  console.log('')

  // Calculate total render time
  let totalRenderTime = timings.initialRender

  // Display all zoom iterations
  for (let i = 1; i <= 3; i++) {
    console.log(`  Iteration ${i}:`)
    const zoomOutClick = timings[`zoomOut${i}`] || 0
    const zoomOutRender = timings[`zoomOutRender${i}`] || 0
    const zoomInClick = timings[`zoomIn${i}`] || 0
    const zoomInRender = timings[`zoomInRender${i}`] || 0

    console.log(`    Zoom out click:     ${zoomOutClick}ms`)
    console.log(`    Zoom out render:    ${zoomOutRender}ms`)
    console.log(`    Zoom in click:      ${zoomInClick}ms`)
    console.log(`    Zoom in render:     ${zoomInRender}ms`)
    console.log('')

    totalRenderTime += zoomOutRender + zoomInRender
  }

  console.log(`Total render time:    ${totalRenderTime}ms`)
  console.log('')

  // Save timing summary
  fs.writeFileSync(
    `results/timings_${buildFolder}_${coverage}_${testType}_zoom.json`,
    JSON.stringify(
      {
        testType,
        coverage,
        buildFolder,
        url: testURL,
        totalTime,
        timings,
      },
      null,
      2,
    ),
  )

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📊 TRACE FILE SAVED')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('')
  console.log(`💾 Trace file: results/trace_${buildFolder}_${coverage}_${testType}_zoom.json`)
  console.log(`💾 Timings: results/timings_${buildFolder}_${coverage}_${testType}_zoom.json`)
  console.log(`📸 Screenshots:`)
  console.log(`   - results/screenshot_${buildFolder}_${coverage}_${testType}_initial.png`)
  for (let i = 1; i <= 3; i++) {
    console.log(`   - results/screenshot_${buildFolder}_${coverage}_${testType}_iter${i}_out.png`)
    console.log(`   - results/screenshot_${buildFolder}_${coverage}_${testType}_iter${i}_in.png`)
  }
  console.log('')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📊 HOW TO VIEW THE TRACE:')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('')
  console.log('Option 1: Chrome DevTools')
  console.log('  1. Open Chrome and navigate to: chrome://tracing')
  console.log('  2. Click "Load" button')
  console.log(`  3. Select: results/trace_${buildFolder}_${coverage}_${testType}_zoom.json`)
  console.log('  4. Use WASD keys to navigate the trace')
  console.log('  5. Look for zoom interaction events')
  console.log('')
  console.log('Option 2: Chrome DevTools Performance Tab')
  console.log('  1. Open Chrome DevTools (F12)')
  console.log('  2. Go to "Performance" tab')
  console.log('  3. Click upload icon (⬆)')
  console.log(`  4. Load: results/trace_${buildFolder}_${coverage}_${testType}_zoom.json`)
  console.log('')
  console.log('💡 The trace includes:')
  console.log('   - Initial page load and render')
  console.log('   - Zoom out interaction and re-render')
  console.log('   - Zoom in interaction and re-render')
  console.log('   - ALL worker threads with full call stacks')
  console.log('   - Function timing for parsing and rendering')
  console.log('')

  await browser.close()

  return {
    totalTime,
    timings,
    tracePath: `results/trace_${buildFolder}_${coverage}_${testType}_zoom.json`,
  }
}

try {
  const result = await captureProfile()
  console.log('✅ Tracing with zoom interactions complete!')
  process.exit(0)
} catch (error) {
  console.error('❌ Error:', error.message)
  console.error(error.stack)
  process.exit(1)
}
