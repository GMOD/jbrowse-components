import puppeteer from 'puppeteer'

const CONFIG = {
  name: '200x shortread BAM',
  track: '200x.shortread.bam',
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

    console.log('  Waiting for rendering to stabilize...')
    await new Promise(resolve => setTimeout(resolve, 5000))

    console.log('  Track fully rendered')

    const screenshotPath = `screenshots/${branchName}_${CONFIG.track.replace('.bam', '')}_success.png`
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

console.log('━'.repeat(60))
console.log(`📊 Testing ${CONFIG.name}`)
console.log(`Region: ${CONFIG.region}`)
console.log('━'.repeat(60))

console.log('\nTesting MASTER branch (port 3001)...')
const masterResults = await runBenchmark(3001, 'master')

console.log('\nTesting OPTIMIZED branch (port 3000)...')
const optimizedResults = await runBenchmark(3000, 'optimized')

console.log(`\n${'━'.repeat(60)}`)
console.log('📊 COMPARISON')
console.log('━'.repeat(60))

const timeImprovement = (
  ((masterResults.totalTime - optimizedResults.totalTime) /
    masterResults.totalTime) *
  100
).toFixed(2)
const memoryImprovement = (
  ((masterResults.memory - optimizedResults.memory) / masterResults.memory) *
  100
).toFixed(2)

console.log(
  `Total time:         MASTER: ${masterResults.totalTime}ms | OPTIMIZED: ${optimizedResults.totalTime}ms (${timeImprovement > 0 ? '+' : ''}${timeImprovement}%)`,
)
console.log(
  `Memory:             MASTER: ${masterResults.memory.toFixed(2)} MB | OPTIMIZED: ${optimizedResults.memory.toFixed(2)} MB (${memoryImprovement > 0 ? '+' : ''}${memoryImprovement}%)`,
)
console.log('━'.repeat(60))
