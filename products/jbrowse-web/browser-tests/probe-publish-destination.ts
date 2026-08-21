// Does an admin's "Add track" actually reach `publishTrackConf` with a SESSION
// assembly's name, and does the fallback's snackbar say something a person can
// act on? Both are claims about the real app: the destination is decided in the
// model (jest covers that), but the chain that gets there — the widget reading
// its assembly off the containing view, `doSubmit` building the conf, the
// snackbar rendering — only exists in a browser.
//
// Admin mode needs no admin server: `createPluginManager` sets
// `adminMode: !!model.adminKey`, so any `?adminKey=` turns the branch on. The
// POST back to the admin server is a separate step this never reaches.
//
//     node browser-tests/probe-publish-destination.ts
//     PORT=3123 OUT=/tmp/shots HEADLESS=0 node browser-tests/probe-publish-destination.ts

import { tmpdir } from 'node:os'
import { join } from 'node:path'

import puppeteer from 'puppeteer'

import { startServerOnFreePort } from './server.ts'

import type { Page } from 'puppeteer'

const encodeSessionSpec = (o: object) =>
  encodeURIComponent(`spec-${JSON.stringify(o)}`)

const OUT = process.env.OUT || tmpdir()
const HEADLESS = process.env.HEADLESS !== '0'
const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

const spec = {
  views: [
    { type: 'LinearGenomeView', assembly: 'volvox', loc: 'ctgA:1-20000' },
  ],
}

// The session assembly a MAF sample view or a session spec brings in:
// `addSessionAssembly`, never `jbrowse.assemblies`.
const SAMPLE_ASSEMBLY = {
  name: 'sampleGenome',
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: 'sampleGenome-ref',
    adapter: {
      type: 'FromConfigSequenceAdapter',
      features: [
        {
          refName: 'chr1',
          uniqueId: 'chr1',
          start: 0,
          end: 50000,
          seq: 'A'.repeat(50000),
        },
      ],
    },
  },
}

// `jbrowse.tracks` holds frozen plain objects and `sessionTracks` holds live MST
// config nodes, so one raw `.trackId` read cannot serve both — `readConfObject`
// is what reads either, and reaching it through the running app's own plugin
// manager keeps it the same module instance the session uses.
function readState(page: Page) {
  return page.evaluate(() => {
    const w = window as any
    const { readConfObject } =
      w.JBrowseRootModel.pluginManager.lib['@jbrowse/core/configuration']
    const session = w.JBrowseSession
    const id = (t: any): string =>
      typeof t.trackId === 'string' ? t.trackId : readConfObject(t, 'trackId')
    return {
      adminMode: session.adminMode,
      catalogAssemblies: session.jbrowse.assemblies.map((a: any): string =>
        readConfObject(a, 'name'),
      ),
      sessionTracks: session.sessionTracks.map(id),
      catalogTracks: session.jbrowse.tracks.map(id),
      snackbars: session.snackbarMessages.map((s: any): string => s.message),
    }
  })
}

async function main() {
  const { server, port } = await startServerOnFreePort(
    Number(process.env.PORT || 3000),
  )
  const browser = await puppeteer.launch({
    headless: HEADLESS,
    args: ['--no-sandbox', '--window-size=1400,900'],
    defaultViewport: { width: 1400, height: 900 },
  })
  const page = await browser.newPage()
  page.on('console', m => {
    const t = m.text()
    if (t.includes('contract') || t.includes('Error')) {
      console.log(`  [console] ${t.slice(0, 200)}`)
    }
  })
  const url = `http://localhost:${port}/?config=test_data/volvox/config.json&session=${encodeSessionSpec(spec)}&sessionName=Publish&adminKey=probe`
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 120000 })
  await page.waitForSelector('[data-testid^="view-container-"]', {
    timeout: 120000,
  })
  await delay(4000)

  const before = await readState(page)
  console.log(`adminMode: ${before.adminMode}`)
  console.log(`catalog assemblies: ${before.catalogAssemblies.join(', ')}`)

  // 1. Baseline. A catalog assembly must still publish, or the check is just
  // "publishing is off" and the pair below proves nothing.
  await page.evaluate(() => {
    ;(window as any).JBrowseSession.publishTrackConf({
      trackId: 'catalog_probe',
      type: 'FeatureTrack',
      name: 'catalog probe',
      assemblyNames: ['volvox'],
      adapter: { type: 'FromConfigAdapter', features: [] },
    })
  })
  const baseline = await readState(page)
  console.log(
    `\n[1] publish onto the CATALOG assembly volvox` +
      `\n    catalogTracks has catalog_probe: ${baseline.catalogTracks.includes('catalog_probe')}` +
      `\n    sessionTracks has catalog_probe: ${baseline.sessionTracks.includes('catalog_probe')}`,
  )

  // 2. Add the session assembly and open a second view on it, so the widget has
  // a containing view whose assembly is a session one.
  await page.evaluate(async asm => {
    const session = (window as any).JBrowseSession
    session.addSessionAssembly(asm)
    const view = session.addView('LinearGenomeView', {})
    await view.navToLocString('chr1:1-10000', 'sampleGenome')
  }, SAMPLE_ASSEMBLY as any)
  await delay(4000)

  // 3. Open the real Add-track widget the way the hamburger menu and the corner
  // FAB both do, and read the assembly it derived from the containing view —
  // the link this probe exists to observe.
  const widgetAssembly = await page.evaluate(() => {
    const session = (window as any).JBrowseSession
    const view = session.views[1]
    const widget = session.addWidget('AddTrackWidget', 'addTrackWidget', {
      view: view.id,
    })
    session.showWidget(widget)
    return widget.assembly
  })
  console.log(
    `\n[2] the Add-track widget's assembly, read off its containing view: ${widgetAssembly}`,
  )

  // 4. Drive the widget's own submit path: type a URL, Next, Add. This is
  // `doSubmit` -> `addTrackFromWidget` -> `publishTrackConf`, untouched.
  await page.waitForSelector('[data-testid="addTrackWorkflow"]', {
    timeout: 30000,
  })
  const input = await page.waitForSelector(
    '[data-testid="addTrackWorkflow"] input[type="text"]',
    { timeout: 30000 },
  )
  await input!.type(
    `http://localhost:${port}/test_data/volvox/volvox.filtered.vcf.gz`,
  )
  await delay(1500)
  await page.screenshot({ path: join(OUT, 'publish-widget-step1.png') })
  const next = await page.waitForSelector('[data-testid="addTrackNextButton"]')
  await next!.click()
  await delay(2000)
  const add = await page.waitForSelector('[data-testid="addTrackNextButton"]')
  await add!.click()
  await delay(3000)

  const after = await readState(page)
  const added = after.sessionTracks.filter(
    (t: string) => !baseline.sessionTracks.includes(t),
  )
  const published = after.catalogTracks.filter(
    (t: string) => !baseline.catalogTracks.includes(t),
  )
  console.log(
    `\n[3] admin submits the Add-track widget over a SESSION assembly` +
      `\n    landed in sessionTracks: ${JSON.stringify(added)}` +
      `\n    landed in jbrowse.tracks: ${JSON.stringify(published)}`,
  )
  console.log(`\n[4] snackbars now on screen:`)
  for (const s of after.snackbars) {
    console.log(`    ${s}`)
  }

  await page.screenshot({ path: join(OUT, 'publish-fallback-snackbar.png') })
  console.log(`\nshots in ${OUT}`)
  await browser.close()
  server.close()
}

main().catch((e: unknown) => {
  console.error(e)
  process.exit(1)
})
