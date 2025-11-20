import fs from 'fs'
import puppeteer from 'puppeteer'

const testType = process.argv[2] || 'shortread'
const coverage = process.argv[3] || '200x'
const buildFolder = process.argv[4] || 'port3000'

const testURL = `http://localhost/jb2/${buildFolder}/?config=test_data%2Fhg19mod.json&assembly=hg19mod&loc=chr22_mask:80,630..83,605&tracks=${coverage}.${testType}.cram`

console.log('🔬 Chrome Tracing Performance Profile (Including Workers)')
console.log(`   Test: ${coverage} ${testType}`)
console.log(`   URL: ${testURL}`)
console.log('')

async function captureProfile() {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })
  const page = await browser.newPage()

  console.log('📊 Starting Chrome Tracing...')

  // Use Chrome's Tracing API which captures everything including workers
  await page.tracing.start({
    path: `results/trace_${buildFolder}_${coverage}_${testType}.json`,
    categories: ['devtools.timeline', 'v8.execute', 'disabled-by-default-v8.cpu_profiler'],
    screenshots: false,
  })

  const startTime = Date.now()
  console.log('🌐 Navigating to page...')
  await page.goto(testURL, { waitUntil: 'networkidle0', timeout: 120000 })

  console.log('⏳ Waiting for rendering to complete...')

  const params = new URL(testURL).searchParams
  const tracks = params.get('tracks')
  const n = tracks.split(',').length
  const nblocks = 2 * n

  try {
    await page.waitForFunction(
      nblocks =>
        document.querySelectorAll('[data-testid="pileup-overlay-normal"]').length === nblocks &&
        document.querySelectorAll('[data-testid="wiggle-rendering-test"]').length == nblocks,
      { timeout: 300000 },
      nblocks,
    )

    await page.waitForFunction(
      () => {
        const loadingTexts = Array.from(document.querySelectorAll('*')).filter(el => {
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
    ).catch(() => {})

    await new Promise(resolve => setTimeout(resolve, 2000))

    const totalTime = Date.now() - startTime
    console.log(`✅ Rendering completed in ${totalTime}ms`)

  } catch (error) {
    console.log('⚠️  Timeout waiting for rendering, stopping trace anyway...')
  }

  console.log('🛑 Stopping trace and saving...')
  await page.tracing.stop()

  const endTime = Date.now()
  const totalTime = endTime - startTime

  console.log('')
  console.log(`⏱️  Total time: ${totalTime}ms`)
  console.log('')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📊 TRACE FILE SAVED')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('')
  console.log(`💾 Trace file: results/trace_${buildFolder}_${coverage}_${testType}.json`)
  console.log('')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📊 HOW TO VIEW THE TRACE:')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('')
  console.log('Option 1: Chrome DevTools')
  console.log('  1. Open Chrome and navigate to: chrome://tracing')
  console.log('  2. Click "Load" button')
  console.log(`  3. Select: results/trace_${buildFolder}_${coverage}_${testType}.json`)
  console.log('  4. Use WASD keys to navigate the trace')
  console.log('  5. Click on events to see details')
  console.log('')
  console.log('Option 2: Chrome DevTools Performance Tab')
  console.log('  1. Open Chrome DevTools (F12)')
  console.log('  2. Go to "Performance" tab')
  console.log('  3. Click upload icon (⬆)')
  console.log(`  4. Load: results/trace_${buildFolder}_${coverage}_${testType}.json`)
  console.log('')
  console.log('💡 The trace includes:')
  console.log('   - Main thread activity')
  console.log('   - ALL worker threads with full call stacks')
  console.log('   - Function timing for: processDepth, processMismatches, generateCoverageBins')
  console.log('   - Memory usage')
  console.log('   - Network requests')
  console.log('')

  await browser.close()

  return {
    totalTime,
    tracePath: `results/trace_${buildFolder}_${coverage}_${testType}.json`,
  }
}

try {
  const result = await captureProfile()
  console.log('✅ Tracing complete!')
  process.exit(0)
} catch (error) {
  console.error('❌ Error:', error.message)
  console.error(error.stack)
  process.exit(1)
}
