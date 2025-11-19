import puppeteer from 'puppeteer'

const CONFIG = {
  name: '20x shortread BAM - large region',
  track: '20x.shortread.bam',
  region: 'chr22_mask:25,101..184,844',
}

async function runBenchmark(port, branchName) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  try {
    const page = await browser.newPage()

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

    await page.evaluateOnNewDocument(() => {
      window.performance.mark('start')
    })

    const url = `http://localhost:${port}/?config=test_data%2Fhg19mod.json&assembly=hg19mod&loc=${CONFIG.region}&tracks=${CONFIG.track}`
    console.log(`  Loading: ${url}`)

    await page.goto(url, { waitUntil: 'networkidle0', timeout: 120000 })

    try {
      console.log('  Checking for force load buttons...')
      await page.waitForFunction(
        () => {
          const buttons = Array.from(document.querySelectorAll('button'))
          return buttons.some(b => b.textContent.includes('Force load'))
        },
        { timeout: 5000 },
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

      await new Promise(resolve => setTimeout(resolve, 1000))
      await page.waitForFunction(
        () => {
          const buttons = Array.from(document.querySelectorAll('button'))
          return buttons.some(b => b.textContent.includes('Force load'))
        },
        { timeout: 5000 },
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
    } catch (e) {
      console.log('  No force load buttons found, proceeding...')
    }

    console.log('  Waiting for track to render...')
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

    await page.waitForFunction(
      () => {
        const loadingMessages = document.querySelectorAll(
          '[data-testid*="loading"]',
        )
        const spinners = document.querySelectorAll('.MuiCircularProgress-root')
        return loadingMessages.length === 0 && spinners.length === 0
      },
      { timeout: 180000 },
    )
    console.log('  Loading indicators cleared')

    console.log('  Waiting for rendering to stabilize...')
    await new Promise(resolve => setTimeout(resolve, 10000))

    console.log('  Track rendered successfully')

    const screenshotPath = `screenshots/${branchName}_${CONFIG.track.replace('.bam', '')}_bam_large_success.png`
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
