/* eslint-disable no-console */
// One-off probe: load the shared grape/peach/cacao session off the running dev
// server and capture what SyntenyFollow decides, per settle, per level. Pair it
// with the temporary logging in SyntenyFollow/followDebug.ts.
//
//   node products/jbrowse-web/browser-tests/follow-spread-probe.ts
import { launch } from 'puppeteer'

const URL =
  'http://localhost:3000/?config=https%3A%2F%2Fjbrowse.org%2Fdemos%2Fgrape_peach_cacao%2Fconfig.json&session=share-I7v_KH60GP&password=Welqm'

const browser = await launch({
  headless: true,
  args: ['--no-sandbox', '--window-size=2000,900'],
  defaultViewport: { width: 2000, height: 900 },
})

try {
  const page = await browser.newPage()
  page.on('console', msg => {
    const t = msg.text()
    if (t.startsWith('[follow]') || t.startsWith('ERR')) {
      console.log(t)
    }
  })
  page.on('pageerror', e => {
    console.log(`PAGE ERROR: ${e instanceof Error ? e.message : String(e)}`)
  })
  page.on('requestfailed', r => {
    console.log(`REQUEST FAILED: ${r.url().slice(0, 120)}`)
  })

  // the follow's own per-settle diagnostics, which are off by default
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('debugSyntenyFollow', '1')
  })

  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 180000 })
  await page.waitForFunction(
    () =>
      !!(window as unknown as { JBrowseRootModel?: unknown }).JBrowseRootModel,
    { timeout: 180000 },
  )
  const settle = (ms = 30000) => new Promise(r => setTimeout(r, ms))

  console.log('=== AS SHARED (the reported straddle) ===')
  await settle(45000)

  console.log('\n=== OVERVIEW (anchor on all regions) ===')
  await page.evaluate(() => {
    const view = (
      window as unknown as { JBrowseRootModel: any }
    ).JBrowseRootModel.session.views.find(
      (v: any) => v.type === 'LinearSyntenyView',
    )
    view.views[0].showAllRegions()
  })
  await settle()

  const state = await page.evaluate(() => {
    const view = (
      window as unknown as { JBrowseRootModel: any }
    ).JBrowseRootModel.session.views.find(
      (v: any) => v.type === 'LinearSyntenyView',
    )
    return {
      followPartial: view.followPartial,
      followApproximate: view.followApproximate,
      rows: view.views.map((v: any) => {
        const blocks = v.dynamicBlocks.contentBlocks
        return {
          assembly: v.assemblyNames[0],
          contigs: [...new Set(blocks.map((b: any) => b.refName))],
          mb: +(
            blocks.reduce((a: number, b: any) => a + (b.end - b.start), 0) / 1e6
          ).toFixed(1),
        }
      }),
    }
  })
  console.log(`\n=== settled ===\n${JSON.stringify(state, undefined, 1)}`)
} finally {
  await browser.close()
}
