/* eslint-disable no-console */
// One-off probe: with follow on, zoom a non-anchor row by hand and check that
// the snackbar says why the row came back.
//
//   node products/jbrowse-web/browser-tests/follow-nudge-probe.ts [out.png]
import { BASE_CHROME_ARGS } from '@jbrowse/browser-test-utils'
import { launch } from 'puppeteer'

import { navigateWithSessionSpec, setPort } from './helpers.ts'
import { startServerOnFreePort } from './server.ts'

const outPath = process.argv[2] ?? '/tmp/follow-nudge-probe.png'

const { server, port } = await startServerOnFreePort(3000)
setPort(port)

const browser = await launch({
  headless: true,
  args: [...BASE_CHROME_ARGS, '--window-size=1400,1000'],
  defaultViewport: { width: 1400, height: 1000 },
})

const settle = (ms: number) => new Promise(r => setTimeout(r, ms))

// stringified: evaluated in the page, where this module's scope does not exist
const VIEW = `window.JBrowseRootModel.session.views.find(v => v.type === 'LinearSyntenyView')`
const inPage = <T>(page: any, body: string) =>
  page.evaluate(`(() => { const view = ${VIEW}; ${body} })()`) as Promise<T>

try {
  const page = await browser.newPage()
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('debugSyntenyFollow', '1')
  })
  page.on('console', m => {
    const t = m.text()
    if (t.startsWith('[follow]')) {
      console.log(t)
    }
  })
  page.on('pageerror', e => {
    console.log(`PAGE ERROR: ${e instanceof Error ? e.message : String(e)}`)
  })
  await navigateWithSessionSpec(page, {
    views: [
      {
        type: 'LinearSyntenyView',
        tracks: ['volvox_all_vs_all'],
        views: [
          { loc: 'ctgA:20000-25000', assembly: 'volvox_ins' },
          { loc: 'ctgA:20000-25000', assembly: 'volvox' },
          { loc: 'ctgA:20000-25000', assembly: 'volvox_del' },
        ],
      },
    ],
  })
  await page.waitForFunction(
    () =>
      !!(window as unknown as { JBrowseRootModel?: any }).JBrowseRootModel
        ?.session?.views?.length,
    { timeout: 120000 },
  )
  await settle(15000)

  const rows = await inPage<number>(page, 'return view.views.length')
  console.log(`rows: ${rows}`)

  await inPage(page, `view.showTrack('volvox_all_vs_all', 1)`)
  await settle(10000)
  await inPage(page, `view.setRowSyncMode('follow')`)
  await settle(10000)

  const before = await inPage<Record<string, unknown>>(
    page,
    `return {
      anchor: view.followAnchorIndex,
      followSynteny: view.followSynteny,
      pairs: view.followPairs.length,
      levelDisplays: view.levels.map(l => l.linearSyntenyDisplays.length),
      featureData: view.levels.map(l => l.linearSyntenyDisplays.map(d => !!d.featureData)),
      rowThree: view.views[2].coarseVisibleLocStrings + ' @' + view.views[2].bpPerPx,
    }`,
  )
  console.log(JSON.stringify(before, null, 2))

  await inPage(page, `const row = view.views[2]; row.zoomTo(row.bpPerPx * 8)`)
  await settle(8000)

  const after = await inPage<{ rowThree: string; snackbars: unknown[] }>(
    page,
    `return {
      rowThree: view.views[2].coarseVisibleLocStrings + ' @' + view.views[2].bpPerPx,
      snackbars: window.JBrowseRootModel.session.snackbarMessages.map(s => ({
        message: s.message,
        actions: (s.actions || []).map(a => a.name),
      })),
    }`,
  )
  console.log(`row three after zoom-out: ${after.rowThree}`)
  console.log(`snackbars: ${JSON.stringify(after.snackbars, null, 2)}`)

  await page.screenshot({ path: outPath })
  console.log(`wrote ${outPath}`)
} finally {
  await browser.close()
  server.close()
}
