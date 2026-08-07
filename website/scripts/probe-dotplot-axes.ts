#!/usr/bin/env node
/**
 * probe-dotplot-axes.ts — dump the two axes a DotplotView spec actually drew.
 *
 *   node scripts/probe-dotplot-axes.ts multiway_synteny/wheat_homoeolog_selection
 *
 * A dotplot is one canvas, so a callout on an off-diagonal block names its two
 * chromosomes (`anchor: { hLocus, vLocus }`, scripts/dotplotAnchor.ts). Which
 * names exist, and which of the two assemblies ended up on which axis, is a
 * property of the data and of the session — this prints both axes' displayed
 * regions with the viewport px each one covers, so a spec picks its cell from
 * the plot rather than from a pixel measured off a PNG.
 */
import { parseArgs } from 'node:util'

import {
  openSpec,
  resolveUrlSpec,
  specViewport,
  withHarness,
} from './dev-harness.ts'

const PORT = 3347

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { view: { type: 'string' }, timeout: { type: 'string' } },
})
const specName = positionals[0]
const viewIndex = Number(values.view ?? 0)
const timeout = Number(values.timeout ?? 300000)

const spec = resolveUrlSpec(specName, `no url-mode spec named "${specName}"`)

const dump = await withHarness(
  { port: PORT, protocolTimeout: 1200000, viewport: specViewport(spec) },
  async ({ page }) => {
    await openSpec(page, spec, PORT, timeout)
    return page.evaluate((viewPath: number) => {
      interface Axis {
        offsetPx: number
        bpPerPx: number
        width: number
        displayedRegions: { refName: string; start: number; end: number }[]
        // a bare px offset, not an object — see dotplotAnchor.ts
        bpToPx: (args: { refName: string; coord: number }) => number | undefined
      }
      interface View {
        id: string
        views?: View[]
        hview?: Axis
        vview?: Axis
      }
      const view = (window as unknown as { JBrowseSession?: View })
        .JBrowseSession?.views?.[viewPath]
      const canvas = document.querySelector(
        '[data-testid^="dotplot_webgl_canvas"]',
      )
      const axis = (a: Axis | undefined) =>
        a
          ? {
              offsetPx: a.offsetPx,
              bpPerPx: a.bpPerPx,
              width: a.width,
              // px on the axis, and then where that lands on screen once the
              // axis's own scroll is taken off: the pair a callout is placed
              // from, so a probe that printed only the first would not say
              // whether a region is even in frame
              regions: a.displayedRegions.map(r => {
                const lo = a.bpToPx({ refName: r.refName, coord: r.start })
                const hi = a.bpToPx({ refName: r.refName, coord: r.end })
                return {
                  refName: r.refName,
                  start: r.start,
                  end: r.end,
                  startPx: lo,
                  endPx: hi,
                  screenLo: lo === undefined ? undefined : lo - a.offsetPx,
                  screenHi: hi === undefined ? undefined : hi - a.offsetPx,
                }
              }),
            }
          : undefined
      return {
        found: Boolean(view),
        canvas: canvas?.getBoundingClientRect().toJSON() as unknown,
        h: axis(view?.hview),
        v: axis(view?.vview),
      }
    }, viewIndex)
  },
)

console.log(JSON.stringify(dump, null, 1))
