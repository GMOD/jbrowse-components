import puppeteer from 'puppeteer'

export async function launchBrowser() {
  return puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })
}

export async function setupPage(browser) {
  const page = await browser.newPage()

  await page.evaluateOnNewDocument(() => {
    window.performance.mark('start')
  })

  return page
}

export function buildUrl(branchName, region, track) {
  // Convert branch name to URL-safe path (replace / with -)
  const pathSegment = branchName.replace(/\//g, '-')
  return `http://localhost/jb2/${pathSegment}/?config=test_data%2Fhg19mod.json&assembly=hg19mod&loc=${region}&tracks=${track}`
}

export async function waitForCanvas(page, timeout = 120000) {
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
    { timeout },
  )
}

export async function waitForLoadingComplete(page, timeout = 120000) {
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
    { timeout },
  )
}

export async function clickForceLoadButtons(page) {
  const clickButton = async () => {
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'))
      const forceLoadBtn = buttons.find(b =>
        b.textContent.includes('Force load'),
      )
      if (forceLoadBtn) {
        forceLoadBtn.click()
      }
    })
  }

  try {
    await page.waitForFunction(
      () => {
        const buttons = Array.from(document.querySelectorAll('button'))
        return buttons.some(b => b.textContent.includes('Force load'))
      },
      { timeout: 5000 },
    )
    await clickButton()
    console.log('  Clicked first force load button')

    await new Promise(resolve => setTimeout(resolve, 1000))

    await page.waitForFunction(
      () => {
        const buttons = Array.from(document.querySelectorAll('button'))
        return buttons.some(b => b.textContent.includes('Force load'))
      },
      { timeout: 5000 },
    )
    await clickButton()
    console.log('  Clicked second force load button')
  } catch (e) {
    console.log('  No force load buttons found (or timed out)')
  }
}

export async function getMetrics(page) {
  const memoryUsage = await page.metrics()
  const totalTime = await page.evaluate(() => performance.now())

  return {
    totalTime: Math.round(totalTime),
    memory: memoryUsage.JSHeapUsedSize / 1024 / 1024,
  }
}

export async function runSimpleBenchmark(config, branchName) {
  const browser = await launchBrowser()

  try {
    const page = await setupPage(browser)
    const url = buildUrl(branchName, config.region, config.track)
    console.log(`  Loading: ${url}`)

    await page.goto(url, { waitUntil: 'networkidle0', timeout: 120000 })

    console.log('  Waiting for canvas...')
    await waitForCanvas(page)
    console.log('  Canvas appeared, waiting for loading to complete...')

    await waitForLoadingComplete(page)
    console.log('  Loading complete, waiting for stabilization...')

    await new Promise(resolve => setTimeout(resolve, 5000))

    const screenshotPath = `screenshots/${branchName}_${config.track.replace(/\.(bam|cram)$/, '')}_success.png`
    await page.screenshot({ path: screenshotPath, fullPage: true })
    console.log(`  ✓ Screenshot: ${screenshotPath}`)

    const metrics = await getMetrics(page)
    console.log(`  ✓ Time: ${metrics.totalTime}ms, Memory: ${metrics.memory.toFixed(2)} MB`)

    await browser.close()
    return metrics
  } catch (error) {
    await browser.close()
    throw error
  }
}

export async function runLargeRegionBenchmark(config, branchName) {
  const browser = await launchBrowser()

  try {
    const page = await setupPage(browser)
    const url = buildUrl(branchName, config.region, config.track)
    console.log(`  Loading: ${url}`)

    await page.goto(url, { waitUntil: 'networkidle0', timeout: 120000 })

    console.log('  Handling force load buttons...')
    await clickForceLoadButtons(page)

    console.log('  Waiting for track to render...')
    await waitForCanvas(page, 180000)
    console.log('  Canvas appeared, waiting for stabilization...')

    await new Promise(resolve => setTimeout(resolve, 10000))

    const screenshotPath = `screenshots/${branchName}_${config.track.replace(/\.(bam|cram)$/, '')}_large_success.png`
    await page.screenshot({ path: screenshotPath, fullPage: true })
    console.log(`  ✓ Screenshot: ${screenshotPath}`)

    const metrics = await getMetrics(page)
    console.log(`  ✓ Time: ${metrics.totalTime}ms, Memory: ${metrics.memory.toFixed(2)} MB`)

    await browser.close()
    return metrics
  } catch (error) {
    await browser.close()
    throw error
  }
}
