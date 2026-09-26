#!/usr/bin/env node
/**
 * probe-chords.ts — what a circular view drew, and whether a chord is clickable.
 *
 *   node scripts/probe-chords.ts sv_cgiab/translocation_sv_inspector_view
 *   node scripts/probe-chords.ts <spec> --click=SV_20
 *
 * The resting chords are canvas pixels, so "the anchor is wrong" and "the chord
 * is buried under another one" produce the same symptom: a click that opens
 * nothing, or opens the wrong record. This lists every chord by the label the
 * hover tooltip shows (which is what `anchor: { chord }` matches on), and for
 * --click samples along the named one's outline and reports what the view's
 * own pick answers at each point: the chord itself, another chord painted over
 * it, or nothing.
 */
import { parseArgs } from 'node:util'

import { chordPoint } from './chordAnchor.ts'
import {
  resolveUrlSpec,
  specUrl,
  specViewport,
  withHarness,
} from './dev-harness.ts'

const PORT = 3347

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    click: { type: 'string' },
    timeout: { type: 'string' },
    settle: { type: 'string' },
  },
})
const specName = positionals[0]
const timeout = Number(values.timeout ?? 300000)
const settle = Number(values.settle ?? 15000)

const spec = resolveUrlSpec(specName, `no url-mode spec named "${specName}"`)

await withHarness(
  { port: PORT, protocolTimeout: 1200000, viewport: specViewport(spec) },
  async ({ page }) => {
    await page.goto(specUrl(spec, PORT), {
      waitUntil: 'domcontentloaded',
      timeout,
    })
    await page.waitForFunction(
      () =>
        [...document.querySelectorAll<HTMLElement>('[data-chord-count]')].some(
          g => Number(g.dataset.chordCount) > 0,
        ),
      { timeout },
    )
    // The chords mount as the VCF streams in, so the first one on screen is not
    // the last one: this is a settle, not a gate.
    await new Promise(r => setTimeout(r, settle))

    const report = await page.evaluate((label: string) => {
      interface ChordView {
        id: string
        type: string
        offsetRadians: number
        figureOriginXY: [number, number]
        centerXY: [number, number]
        chordDisplays: {
          id: string
          shapes: { feature: { id: () => string } }[]
          shapeLabel: (feature: { id: () => string }) => string
          shapePathFor: (feature: { id: () => string }) => string
        }[]
        chordAt: (
          dx: number,
          dy: number,
        ) => { feature: { id: () => string } } | undefined
        circularView?: ChordView
        views?: ChordView[]
      }
      const circles: ChordView[] = []
      const walk = (v: ChordView) => {
        if (v.type === 'CircularView') {
          circles.push(v)
        }
        if (v.circularView) {
          walk(v.circularView)
        }
        v.views?.forEach(walk)
      }
      ;(
        window as unknown as { JBrowseSession: { views: ChordView[] } }
      ).JBrowseSession.views.forEach(walk)
      const drawn: string[] = []
      const rows: string[] = []
      let found = false
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      const path = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'path',
      )
      svg.append(path)
      document.body.append(svg)
      for (const view of circles) {
        const cos = Math.cos(view.offsetRadians)
        const sin = Math.sin(view.offsetRadians)
        for (const display of view.chordDisplays) {
          for (const { feature } of display.shapes) {
            const text = display.shapeLabel(feature)
            drawn.push(`${feature.id().padEnd(14)} ${text}`)
            if (!label || !text.includes(label) || found) {
              continue
            }
            found = true
            path.setAttribute('d', display.shapePathFor(feature))
            const total = path.getTotalLength()
            for (const t of [0.12, 0.3, 0.5, 0.7, 0.88]) {
              const p = path.getPointAtLength(total * t)
              const dx = p.x * cos - p.y * sin
              const dy = p.x * sin + p.y * cos
              const hit = view.chordAt(dx, dy)
              rows.push(
                `t=${t} (${dx.toFixed(0)},${dy.toFixed(0)} from centre) -> ${
                  hit
                    ? hit.feature.id() === feature.id()
                      ? 'this chord'
                      : `another chord on top: ${hit.feature.id()}`
                    : 'nothing'
                }`,
              )
            }
          }
        }
      }
      svg.remove()
      return { drawn, found, rows }
    }, values.click ?? '')

    console.error(`${report.drawn.length} chord(s) drawn`)
    for (const line of report.drawn.slice(0, 40)) {
      console.error(`  ${line}`)
    }
    if (report.drawn.length > 40) {
      console.error(`  ... ${report.drawn.length - 40} more`)
    }
    if (values.click) {
      if (!report.found) {
        console.error(`no chord labelled "${values.click}"`)
      }
      for (const row of report.rows) {
        console.error(`  ${row}`)
      }
      const point = await chordPoint(page, { chord: values.click })
      console.error(
        point
          ? `\n"${values.click}" resolves to ${point.x.toFixed(1)},${point.y.toFixed(1)}`
          : `\nNO CLICKABLE POINT for "${values.click}": every sampled point along it has another chord on top, or nothing is labelled that`,
      )
    }
  },
)
