// The rows and facet bands a row display drew, top to bottom, with their
// geometry: the names a `{ trackId, row }` anchor takes. Opens the spec's live
// link on the hosted build.
//
//   node scripts/probe-rows.ts <spec name> <trackId>
import {
  BASE_CHROME_ARGS,
  findChromeExecutable,
  waitForAppSettled,
} from '@jbrowse/browser-test-utils'
import { launch } from 'puppeteer'

import { specLiveUrl, specs } from './screenshot-specs.ts'

const [name, trackId] = process.argv.slice(2)
const spec = specs.find(s => s.name === name)
const url = spec ? specLiveUrl(spec) : undefined
if (!url || !trackId) {
  console.error('usage: probe-rows.ts <spec> <trackId>')
  process.exit(1)
}
const browser = await launch({
  headless: true,
  executablePath: findChromeExecutable(),
  args: BASE_CHROME_ARGS,
  protocolTimeout: 300000,
})
const page = await browser.newPage()
await page.setViewport({ width: 1500, height: 1000, deviceScaleFactor: 1 })
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 })
await waitForAppSettled(page, { timeout: 240000 })
const out = await page.evaluate(id => {
  interface Display {
    sources?: { name: string; label?: string }[]
    rowBands?: readonly {
      key: string
      label: string
      start: number
      end: number
    }[]
    effectiveRowHeight?: number
    rowsTopOffset?: number
    height?: number
  }
  interface View {
    tracks?: { configuration: { trackId: string }; displays: Display[] }[]
    views?: View[]
  }
  const all: View[] = []
  const walk = (v: View | undefined) => {
    for (const c of v?.views ?? []) {
      all.push(c)
      walk(c)
    }
  }
  walk((window as unknown as { JBrowseSession?: View }).JBrowseSession)
  const d = all
    .flatMap(v => v.tracks ?? [])
    .find(t => t.configuration.trackId === id)?.displays[0]
  const types = d
    ? Object.fromEntries(
        [
          'sources',
          'bandedSources',
          'rowBands',
          'rowsTopOffset',
          'effectiveRowHeight',
          'scrollTop',
          'scrollViewportHeight',
        ].map(k => {
          const v = (d as Record<string, unknown>)[k]
          return [k, typeof v === 'number' ? v : typeof v]
        }),
      )
    : {}
  return d
    ? {
        types,
        rowHeight: d.effectiveRowHeight,
        rowsTop: d.rowsTopOffset,
        height: d.height,
        bands: (d.rowBands ?? []).map(b => `${b.label} [${b.start},${b.end})`),
        rows: (d.sources ?? []).map(
          (r, i) => `${i}: ${r.name}${r.label ? ` (${r.label})` : ''}`,
        ),
      }
    : 'no display'
}, trackId)
console.log(JSON.stringify(out, null, 1).slice(0, 6000))
await browser.close()
