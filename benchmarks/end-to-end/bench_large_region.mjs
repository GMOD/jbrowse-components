import puppeteer from 'puppeteer'

const CONFIG = {
  name: '20x longread - large region',
  track: '20x.longread.cram',
  region: 'chr22_mask:25,101..184,844',
}

async function runBenchmark(port, branchName) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  try {
    const page = await browser.newPage()

    // Capture console logs
    const consoleLogs = []
    page.on('console', msg => {
      const text = msg.text()
      consoleLogs.push(text)
      if (
        text.includes('error') ||
        text.includes('Error') ||
        text.includes('timeout')
      ) {
        console.log(`  [Console ${msg.type()}]:`, text)
      }
    })

    page.on('pageerror', error => {
      console.log(`  [Page Error]:`, error.message)
    })

    const metrics = {
      memory: [],
      performance: null,
      consoleLogs,
    }

    await page.evaluateOnNewDocument(() => {
      window.performance.mark('start')
    })

    const url = `http://localhost:${port}/?config=test_data%2Fhg19mod.json&assembly=hg19mod&loc=${CONFIG.region}&tracks=${CONFIG.track}`
    console.log(`  Loading: ${url}`)

    await page.goto(url, { waitUntil: 'networkidle0', timeout: 120000 })

    // Wait for and click the first "force load" button
    console.log('  Waiting for first force load button...')
    await page.waitForFunction(
      () => {
        const buttons = Array.from(document.querySelectorAll('button'))
        return buttons.some(b => b.textContent.includes('Force load'))
      },
      { timeout: 30000 },
    )
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'))
      const forceLoadBtn = buttons.find(b =>
        b.textContent.includes('Force load'),
      )
      if (forceLoadBtn) {
        forceLoadBtn.click()
      }
    })
    console.log('  Clicked first force load button')

    // Wait a bit and click the second "force load" button
    await new Promise(resolve => setTimeout(resolve, 1000))
    console.log('  Waiting for second force load button...')
    await page.waitForFunction(
      () => {
        const buttons = Array.from(document.querySelectorAll('button'))
        return buttons.some(b => b.textContent.includes('Force load'))
      },
      { timeout: 30000 },
    )
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'))
      const forceLoadBtn = buttons.find(b =>
        b.textContent.includes('Force load'),
      )
      if (forceLoadBtn) {
        forceLoadBtn.click()
      }
    })
    console.log('  Clicked second force load button')

    // Now wait for the track to render (look for any canvas in the track)
    console.log('  Waiting for track to render...')
    try {
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
        { timeout: 180000 },
      )
      console.log('  Track canvas appeared, waiting for blocks to render...')

      // Wait for loading indicators to disappear
      await page.waitForFunction(
        () => {
          // Check for loading messages or spinners
          const loadingMessages = document.querySelectorAll(
            '[data-testid*="loading"]',
          )
          const spinners = document.querySelectorAll(
            '.MuiCircularProgress-root',
          )
          return loadingMessages.length === 0 && spinners.length === 0
        },
        { timeout: 180000 },
      )
      console.log('  Loading indicators cleared')

      // Wait additional time for blocks to fully render
      console.log('  Waiting for rendering to stabilize...')
      await new Promise(resolve => setTimeout(resolve, 10000))

      console.log('  Track rendered successfully')

      // Take a screenshot of successful render
      const screenshotPath = `screenshots/${branchName}_${CONFIG.track.replace('.cram', '')}_success.png`
      await page.screenshot({ path: screenshotPath, fullPage: true })
      console.log(`  ✓ Screenshot saved to: ${screenshotPath}`)
    } catch (error) {
      console.log(
        '  Warning: Canvas did not appear within timeout, checking state...',
      )

      // Take a screenshot
      const screenshotPath = `screenshots/${branchName}_${CONFIG.track.replace('.cram', '')}_error.png`
      await page.screenshot({ path: screenshotPath, fullPage: true })
      console.log(`  Screenshot saved to: ${screenshotPath}`)

      const pageState = await page.evaluate(() => {
        return {
          hasCanvas: !!document.querySelector(
            'canvas[data-testid="pileup_canvas"]',
          ),
          hasSNPCanvas: !!document.querySelector(
            'canvas[data-testid="snpcoverage_canvas"]',
          ),
          forceLoadButtons: Array.from(
            document.querySelectorAll('button'),
          ).filter(b => b.textContent.includes('Force load')).length,
          errorMessages: Array.from(
            document.querySelectorAll('[role="alert"]'),
          ).map(el => el.textContent),
          trackLabels: Array.from(
            document.querySelectorAll('[data-testid*="track"]'),
          ).map(el => el.dataset.testid),
        }
      })
      console.log('  Page state:', JSON.stringify(pageState, null, 2))
      console.log('  Recent console logs:', consoleLogs.slice(-10))
      throw error
    }

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
