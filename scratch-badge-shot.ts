import puppeteer from 'puppeteer'

const PORT = Number(process.env.PORT || 35723)
const OUT = process.env.OUT || '/tmp'
const delay = (ms: number) => new Promise(r => setTimeout(r, ms))
const encodeSessionSpec = (o: object) =>
  encodeURIComponent(`spec-${JSON.stringify(o)}`)

const spec = {
  views: [
    {
      type: 'LinearGenomeView',
      assembly: 'volvox',
      loc: 'ctgA:800-9600',
      tracks: ['gff3tabix_genes'],
    },
  ],
}

// Inlined at every call site rather than shared: page.evaluate serializes the
// function body and not its closure, so a Node-side helper is not in scope.
const DISPLAY = `(window).JBrowseSession.views[0].tracks[0].displays[0]`

async function main() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--window-size=1400,1000'],
    defaultViewport: { width: 1400, height: 1000, deviceScaleFactor: 2 },
  })
  const page = await browser.newPage()
  page.on('console', m => {
    if (m.type() === 'error') {
      console.log('[page error]', m.text().slice(0, 300))
    }
  })
  const url = `http://localhost:${PORT}/?config=test_data/volvox/config.json&session=${encodeSessionSpec(spec)}&sessionName=Badge`
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 120000 })
  await page.waitForFunction(
    () => (document.getElementById('root')?.childElementCount ?? 0) > 0,
    { timeout: 60000, polling: 100 },
  )
  await page.waitForFunction(
    () => (window as any).JBrowseSession?.views?.[0]?.tracks?.length > 0,
    { timeout: 60000, polling: 200 },
  )
  await delay(4000)

  // Force the collapse: `longestCoding` keeps one transcript per gene, so
  // EDEN's three become one and the badge has something to report.
  await page.evaluate(`${DISPLAY}.setGeneGlyphMode('longestCoding')`)
  await page.evaluate(`${DISPLAY}.setHeightMode('grow')`)
  await page.waitForFunction(
    `[...${DISPLAY}.laidOutDataMap.values()].some(r =>
       Object.values(r.floatingLabelsData).some(l => l.moreIsoformsLabel))`,
    { timeout: 60000, polling: 200 },
  )
  await delay(1500)
  await page.screenshot({ path: `${OUT}/shot-collapsed.png` })

  const badge = await page.$('[data-more-isoforms]')
  if (!badge) {
    throw new Error('no badge element in the DOM')
  }
  console.log(
    'badge:',
    JSON.stringify(
      await page.evaluate((el: any) => {
        const s = getComputedStyle(el)
        return {
          text: el.textContent,
          fontSize: s.fontSize,
          fontStyle: s.fontStyle,
          color: s.color,
          decoration: s.textDecorationLine,
        }
      }, badge),
    ),
  )
  console.log(
    'name:',
    JSON.stringify(
      await page.evaluate(() => {
        const el = document.querySelector(
          '[data-feature-id]:not([data-more-isoforms])',
        )
        const s = getComputedStyle(el!)
        return { fontSize: s.fontSize, color: s.color, fontStyle: s.fontStyle }
      }),
    ),
  )

  await badge.click()
  await page.waitForFunction(
    `[...${DISPLAY}.laidOutDataMap.values()].some(r =>
       Object.values(r.floatingLabelsData).some(l => l.moreIsoformsLabel?.expanded))`,
    { timeout: 60000, polling: 200 },
  )
  await delay(2000)
  await page.screenshot({ path: `${OUT}/shot-expanded.png` })

  await browser.close()
}

await main()
