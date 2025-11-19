import puppeteer from 'puppeteer'

const CONFIG = {
  name: '200x longread',
  track: '200x.longread.cram',
  region: 'chr22_mask:80,630..83,605',
}

async function runBenchmark(port, branchName) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  try {
    const page = await browser.newPage()

    await page.evaluateOnNewDocument(() => {
      window.performance.mark('start')
    })

    const url = `http://localhost:${port}/?config=test_data%2Fhg19mod.json&assembly=hg19mod&loc=${CONFIG.region}&tracks=${CONFIG.track}`
    console.log(`  Loading: ${url}`)

    await page.goto(url, { waitUntil: 'networkidle0', timeout: 120000 })

    await page.waitForFunction(
      () => {
        const trackContainer = document.querySelector(
          '[data-testid*="trackRenderingContainer"]',
        )
        if (!trackContainer) {
          return false
        }
        const canvas = trackContainer.querySelector('canvas')
        return canvas !== null && canvas.width > 0
      },
      { timeout: 120000 },
    )
    console.log('  Canvas appeared, waiting for blocks to complete...')

    // Wait for loading indicators to disappear
    await page.waitForFunction(
      () => {
        const loadingTexts = Array.from(document.querySelectorAll('*')).filter(
          el => {
            const text = el.textContent || ''
            return (
              text.includes('Processing alignments') ||
              text.includes('Downloading alignments') ||
              text.includes('Loading')
            )
          },
        )
        return loadingTexts.length === 0
      },
      { timeout: 120000 },
    )
    console.log('  Loading indicators cleared')

    // Wait additional time for rendering to stabilize
    console.log('  Waiting for rendering to stabilize...')
    await new Promise(resolve => setTimeout(resolve, 5000))

    console.log('  Track fully rendered')

    // Take screenshot
    const screenshotPath = `screenshots/${branchName}_${CONFIG.track.replace('.cram', '')}_success.png`
    await page.screenshot({ path: screenshotPath, fullPage: true })
    console.log(`  ✓ Screenshot saved to: ${screenshotPath}`)

    const memoryUsage = await page.metrics()
    const totalTime = await page.evaluate(() => performance.now())

    console.log(`  ✓ Total: ${Math.round(totalTime)}ms`)
    console.log(
      `  ✓ Memory: ${(memoryUsage.JSHeapUsedSize / 1024 / 1024).toFixed(2)} MB`,
    )

    await browser.close()

    return {
      totalTime: Math.round(totalTime),
      memory: memoryUsage.JSHeapUsedSize / 1024 / 1024,
    }
  } catch (error) {
    await browser.close()
    throw error
  }
}

const PORT = process.env.BENCHMARK_PORT || process.argv[2] || '3000'
const LABEL = process.env.BENCHMARK_LABEL || process.argv[3] || 'test'

console.log(`Testing ${CONFIG.name} on ${LABEL} (port ${PORT})...`)

try {
  const results = await runBenchmark(PORT, LABEL)

  console.log(`MEMORY_MB=${results.memory.toFixed(2)}`)

  process.exit(0)
} catch (error) {
  console.error(`Error running benchmark: ${error.message}`)
  process.exit(1)
}
