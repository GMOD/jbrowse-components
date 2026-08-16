/* eslint-disable no-console */
// Manual probe (`node --experimental-strip-types`, needs a jbrowse-web build):
// how much of the pileup's scroll extent is reachable, and how much is the
// fetch buffer's rows?
//
// `e122978eaf` fixed this for the canvas feature display: the fetch buffers half
// a screen either side (`bufferedVisibleRegions`) and the pack places every
// buffered feature, so the scrollbar and the edge shadow — two readouts of one
// number — reported hidden content on a track showing all of it, and offered a
// scroll onto blank canvas. The pileup lays out over `loadedRegions` the same
// way and has no equivalent narrowing, and its `heightMode` defaults to `fixed`,
// which scrolls. So the mechanism is present on the default configuration; this
// measures whether it is big enough to see.
//
// Metric per (locus, track): the deepest row occupied by a read whose genomic
// span intersects the VISIBLE span, against the group's laid-out `maxY`. Their
// difference times the row height is scroll extent that reveals nothing.
//
// ANSWERED 2026-08-16 — declined, and `reference/REJECTED_IDEAS.md` carries the
// reasoning; this is the harness and the raw numbers:
//
//   track/locus                                 laidOut  visible  wastedPx  reads
//   volvox_alignments ctgA:1-50,000                  37       37         0  9596/9596
//   volvox_alignments ctgA:20,000-21,000             26       26         0   210/393
//   volvox_alignments ctgA:1-2,000                   32       32         0   330/525
//   volvox_alignments ctgA:47,000-48,000             33       33         0   229/440
//   volvox_cram_alignments ctgA:20,000-21,000        26       26         0   210/393
//
// Zero everywhere, with up to 63% of the laid-out reads off screen. A pileup row
// is shared by many reads, so an off-screen read almost always lands in a row an
// on-screen read occupies too and the two maxima coincide — where the canvas
// display's sparse features each owned a row nothing else used. Rerun this
// before reopening; a non-zero column is the thing that would justify the work.
import { BASE_CHROME_ARGS } from '@jbrowse/browser-test-utils'
import { launch } from 'puppeteer'

import {
  navigateWithSessionSpec,
  setPort,
  waitForDataLoaded,
} from './helpers.ts'
import { startServerOnFreePort } from './server.ts'

import type { Page } from 'puppeteer'

// Loci chosen to vary how much the buffer can differ from the view: a whole
// contig, a mid-contig window, and a window against the covered region's edge
// (where half the buffer is empty and the other half is not).
const CASES = [
  { track: 'volvox_alignments', loc: 'ctgA:1-50,000' },
  { track: 'volvox_alignments', loc: 'ctgA:20,000-21,000' },
  { track: 'volvox_alignments', loc: 'ctgA:1-2,000' },
  { track: 'volvox_alignments', loc: 'ctgA:47,000-48,000' },
  { track: 'volvox_cram_alignments', loc: 'ctgA:20,000-21,000' },
]

interface Measurement {
  laidOutMaxY: number
  visibleMaxY: number
  rowHeight: number
  scrollableHeight: number
  reads: number
  readsOnScreen: number
}

async function measure(page: Page): Promise<Measurement | string> {
  return page.evaluate(() => {
    const session = (window as unknown as { JBrowseSession?: any })
      .JBrowseSession
    const view = session?.views?.[0]
    const display = view?.tracks?.[0]?.displays?.[0]
    if (!display) {
      return 'no display'
    }
    // the on-screen genomic spans, per displayed region
    const visible = new Map<number, { start: number; end: number }>()
    for (const r of view.visibleRegions ?? []) {
      visible.set(r.displayedRegionIndex, { start: r.start, end: r.end })
    }
    let laidOutMaxY = 0
    let visibleMaxY = 0
    let reads = 0
    let readsOnScreen = 0
    const byGroup = display.laidOutByGroup
    if (!byGroup || typeof byGroup.forEach !== 'function') {
      return 'no laidOutByGroup'
    }
    byGroup.forEach((perRegion: any) => {
      perRegion.forEach((data: any, regionIndex: number) => {
        const span = visible.get(regionIndex)
        const ys = data?.readYs
        const pos = data?.readPositions
        if (!ys || !pos) {
          return
        }
        for (let i = 0; i < ys.length; i++) {
          const y = ys[i]
          reads++
          if (y > laidOutMaxY) {
            laidOutMaxY = y
          }
          if (span && pos[i * 2 + 1] > span.start && pos[i * 2] < span.end) {
            readsOnScreen++
            if (y > visibleMaxY) {
              visibleMaxY = y
            }
          }
        }
      })
    })
    return {
      laidOutMaxY,
      visibleMaxY,
      rowHeight: display.rowHeight ?? display.featureHeight ?? 0,
      scrollableHeight: display.scrollableHeight ?? 0,
      reads,
      readsOnScreen,
    }
  })
}

async function main() {
  const { port, server } = await startServerOnFreePort(3555)
  setPort(port)
  const browser = await launch({ headless: true, args: BASE_CHROME_ARGS })
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 800 })

  console.log(
    'track/locus'.padEnd(46),
    'laidOut'.padStart(8),
    'visible'.padStart(8),
    'wastedPx'.padStart(9),
    'scrollable'.padStart(11),
    'reads'.padStart(7),
  )
  for (const { track, loc } of CASES) {
    const spec = {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc,
          tracks: [{ trackId: track }],
        },
      ],
    }
    await navigateWithSessionSpec(page, spec)
    await waitForDataLoaded(page)
    // the layout is main-thread and lands after the fetch settles
    await page
      .waitForFunction(
        () =>
          (window as unknown as { JBrowseSession?: any }).JBrowseSession
            ?.views?.[0]?.tracks?.[0]?.displays?.[0]?.laidOutByGroup?.size > 0,
        { timeout: 30000 },
      )
      .catch(() => {})
    await new Promise(r => setTimeout(r, 1500))
    const m = await measure(page)
    const label = `${track} ${loc}`.padEnd(46)
    if (typeof m === 'string') {
      console.log(label, m)
      continue
    }
    const wasted = (m.laidOutMaxY - m.visibleMaxY) * m.rowHeight
    console.log(
      label,
      String(m.laidOutMaxY).padStart(8),
      String(m.visibleMaxY).padStart(8),
      wasted.toFixed(0).padStart(9),
      m.scrollableHeight.toFixed(0).padStart(11),
      `${m.readsOnScreen}/${m.reads}`.padStart(7),
    )
  }
  await browser.close()
  server.close()
}

await main()
