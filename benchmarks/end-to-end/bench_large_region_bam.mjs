import puppeteer from 'puppeteer'

const CONFIG = {
  name: '20x longread BAM - large region',
  track: '20x.longread.bam',
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

      await page.waitForFunction(
        () => {
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

      console.log('  Waiting for rendering to stabilize...')
      await new Promise(resolve => setTimeout(resolve, 10000))

      console.log('  Track rendered successfully')

      const screenshotPath = `screenshots/${branchName}_${CONFIG.track.replace('.bam', '')}_bam_success.png`
      await page.screenshot({ path: screenshotPath, fullPage: true })
      console.log(`  ✓ Screenshot saved to: ${screenshotPath}`)
    } catch (error) {
      console.log(
        '  Warning: Canvas did not appear within timeout, checking state...',
      )

      const screenshotPath = `screenshots/${branchName}_${CONFIG.track.replace('.bam', '')}_bam_error.png`
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

const PORT1 = process.env.PORT1 || '3000'
const PORT2 = process.env.PORT2 || '3001'
const PORT3 = process.env.PORT3 || '3002'
const LABEL1 = process.env.LABEL1 || 'Branch 1'
const LABEL2 = process.env.LABEL2 || 'Branch 2'
const LABEL3 = process.env.LABEL3 || 'Branch 3'

console.log('━'.repeat(60))
console.log(`📊 Testing ${CONFIG.name}`)
console.log(`Region: ${CONFIG.region} (${184844 - 25101}bp)`)
console.log('━'.repeat(60))

console.log(`\nTesting ${LABEL1} (port ${PORT1})...`)
const results1 = await runBenchmark(PORT1, LABEL1)

console.log(`\nTesting ${LABEL2} (port ${PORT2})...`)
const results2 = await runBenchmark(PORT2, LABEL2)

console.log(`\nTesting ${LABEL3} (port ${PORT3})...`)
const results3 = await runBenchmark(PORT3, LABEL3)

console.log(`\n${'━'.repeat(60)}`)
console.log('📊 RESULTS (sorted by total time)')
console.log('━'.repeat(60))

const results = [
  { label: LABEL1, result: results1 },
  { label: LABEL2, result: results2 },
  { label: LABEL3, result: results3 },
].sort((a, b) => a.result.totalTime - b.result.totalTime)

for (const [i, r] of results.entries()) {
  const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'
  console.log(`${medal} ${r.label}:`)
  console.log(`   Total time: ${r.result.totalTime}ms`)
  console.log(`   Memory:     ${r.result.memory.toFixed(2)} MB`)
  console.log('')
}

console.log('━'.repeat(60))
console.log(`FASTEST=${results[0].label}`)
