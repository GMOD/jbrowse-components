// What a reader is actually shown by the off-screen mate strip, by alignment
// size, at whatever zoom the spec opens at and at a zoom it is driven to.
//
//   ZOOM=<startMb>-<endMb> node website/scripts/probe-mate-density.ts
//
// The question is whether a mark per alignment is signal or noise when the
// window is a whole chromosome: how many of the marks are alignments too small
// to be worth a pixel, and how much of the aligned sequence they carry.
import {
  BASE_CHROME_ARGS,
  findChromeExecutable,
  waitForAppSettled,
} from '@jbrowse/browser-test-utils'
import { launch } from 'puppeteer'

import { captureUrl } from './screenshot-ready.ts'
import { specs } from './screenshot-specs.ts'

const PORT = 3000
const SPEC = process.env.SPEC ?? 'synteny_offscreen_mates'
const spec = specs.find(s => s.name === SPEC)
if (!spec || spec.mode !== 'url') {
  throw new Error(`${SPEC} is not a url spec`)
}

const browser = await launch({
  headless: true,
  executablePath: findChromeExecutable(),
  args: [...BASE_CHROME_ARGS, '--enable-unsafe-swiftshader'],
  defaultViewport: { width: 1400, height: 424, deviceScaleFactor: 1 },
})

try {
  const page = await browser.newPage()
  await captureUrl(page, spec, PORT)
  await waitForAppSettled(page)

  const zoom = process.env.ZOOM
  if (zoom) {
    const [from, to] = zoom.split('-').map(Number)
    await page.evaluate(
      (lo: number, hi: number) => {
        const row = (window as any).JBrowseSession.views[0].views[0]
        row.zoomTo((hi - lo) / row.width)
        row.scrollTo(lo / row.bpPerPx)
      },
      from! * 1e6,
      to! * 1e6,
    )
    await waitForAppSettled(page)
  }

  const out = await page.evaluate(() => {
    const w = window as any
    const view = w.JBrowseSession.views[0]
    const strips = view.levels[0].offscreenMateStrips
    const bands = []
    for (const strip of strips) {
      const { bpPerPx, offsetPx, width } = strip
      const marks: number[] = []
      for (const d of strip.datasets) {
        for (let i = 0; i < d.starts.length; i++) {
          const x1 = d.starts[i] / bpPerPx - offsetPx
          const x2 = d.ends[i] / bpPerPx - offsetPx
          if (x2 >= 0 && x1 <= width) {
            marks.push(d.lengths[i])
          }
        }
      }
      // what the per-contig floor keeps at this window, and what it drops
      const byContig = new Map<string, { bp: number; marks: number }>()
      for (const d of strip.datasets) {
        for (let i = 0; i < d.starts.length; i++) {
          const x1 = d.starts[i] / bpPerPx - offsetPx
          const x2 = d.ends[i] / bpPerPx - offsetPx
          if (x2 >= 0 && x1 <= width) {
            const id = d.mateRefNameIds[i]
            const name = d.mateRefNameDict[id]
            const e = byContig.get(name) ?? { bp: d.alignedBp[id], marks: 0 }
            e.marks++
            byContig.set(name, e)
          }
        }
      }
      const contigs = [...byContig]
        .map(([refName, e]) => ({
          refName,
          kb: Math.round(e.bp / 1000),
          px: +(e.bp / bpPerPx).toFixed(1),
          marks: e.marks,
          drawn: e.bp / bpPerPx >= 4,
        }))
        .sort((a, b) => b.px - a.px)

      marks.sort((a, b) => a - b)
      const total = marks.reduce((a, b) => a + b, 0)
      // what a floor of N pixels' worth of bp would drop, in marks and in the
      // sequence those marks stand for
      const floors = [0.25, 0.5, 1, 2, 4].map(px => {
        const bp = px * bpPerPx
        const dropped = marks.filter(m => m < bp)
        return {
          px,
          bp: Math.round(bp),
          drops: dropped.length,
          dropsPct: Math.round((100 * dropped.length) / marks.length),
          bpLostPct: Math.round(
            (100 * dropped.reduce((a, b) => a + b, 0)) / total,
          ),
        }
      })
      bands.push({
        contigs,
        side: strip.side,
        bpPerPx: Math.round(bpPerPx),
        marks: marks.length,
        totalMb: +(total / 1e6).toFixed(2),
        median: Math.round(marks[Math.floor(marks.length / 2)] ?? 0),
        p90: Math.round(marks[Math.floor(marks.length * 0.9)] ?? 0),
        max: Math.round(marks.at(-1) ?? 0),
        floors,
      })
    }
    return bands
  })
  console.log(JSON.stringify(out, undefined, 1))
} finally {
  await browser.close()
}
