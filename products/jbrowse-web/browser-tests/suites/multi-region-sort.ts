import {
  delay,
  findByTestId,
  navigateWithSessionSpec,
  waitForDataLoaded,
} from '../helpers.ts'
import { dualSnapshot } from '../snapshot.ts'

import type { TestSuite } from '../types.ts'
import type { Page } from 'puppeteer'

const pileup = 'pileup-display-done'

// Minimal shape of the live model we drive from page.evaluate. window.JBrowseSession
// is exposed by JBrowse.tsx.
interface Display {
  setColorScheme: (colorBy: { type: string }) => void
  setSortedByAtPosition: (type: string, pos: number, refName: string) => void
  laidOutPileupMap: ReadonlyMap<
    number,
    { readIds: string[]; readYs: ArrayLike<number> }
  >
}
interface LiveModel {
  JBrowseSession: {
    views: {
      setDisplayedRegions: (regions: unknown[]) => void
      showAllRegions: () => void
      tracks: { displays: Display[] }[]
    }[]
  }
}

// Two same-refName windows over ONE long-read cluster with a small gap between
// them (the "collapsed intron"). The reads are ~1.7kb and span 34200-35900, so
// they cross the 35000-35200 gap and appear in BOTH windows — the case that
// forces layout onto the main thread (a per-region worker can't give a
// boundary-spanning read the same row in both regions). Colored by strand and
// sorted by strand at a position in the first window; driving the live model
// keeps the multi-region layout path deterministic.
async function reshapeToTwoRegions(page: Page, sort: boolean) {
  await page.evaluate(doSort => {
    const { JBrowseSession } = window as unknown as LiveModel
    const view = JBrowseSession.views[0]!
    view.setDisplayedRegions([
      { refName: 'ctgA', start: 34200, end: 35000, assemblyName: 'volvox' },
      { refName: 'ctgA', start: 35200, end: 35950, assemblyName: 'volvox' },
    ])
    view.showAllRegions()
    const display = view.tracks[0]!.displays[0]!
    display.setColorScheme({ type: 'strand' })
    if (doSort) {
      display.setSortedByAtPosition('strand', 34600, 'ctgA')
    }
  }, sort)
  await delay(500)
  await findByTestId(page, pileup, 60000)
  await waitForDataLoaded(page)
  await delay(1000)
}

// Read back the laid-out rows and assert every read that appears in more than
// one displayed region got the SAME row in each — the cross-region consistency
// that main-thread layout exists to provide, here under an active sort. Returns
// the number of such boundary-spanning reads so the test can require > 0.
async function assertSpanningReadsShareRows(page: Page) {
  const spanningCount = await page.evaluate(() => {
    const { JBrowseSession } = window as unknown as LiveModel
    const display = JBrowseSession.views[0]!.tracks[0]!.displays[0]!
    const rowsById = new Map<string, Set<number>>()
    for (const data of display.laidOutPileupMap.values()) {
      data.readIds.forEach((id, i) => {
        const set = rowsById.get(id) ?? new Set<number>()
        set.add(data.readYs[i]!)
        rowsById.set(id, set)
      })
    }
    let spanning = 0
    for (const [id, rows] of rowsById) {
      // present in >1 region only if the same id was added from >1 entry; a
      // read on a single row across N entries has a 1-element set
      const seenIn = [...display.laidOutPileupMap.values()].filter(d =>
        d.readIds.includes(id),
      ).length
      if (seenIn > 1) {
        spanning++
        if (rows.size !== 1) {
          throw new Error(
            `read ${id} spans ${seenIn} regions but got rows ${[...rows].join(',')}`,
          )
        }
      }
    }
    return spanning
  })
  if (spanningCount === 0) {
    throw new Error('expected at least one boundary-spanning read')
  }
}

const view = (loc: string) => ({
  views: [
    {
      type: 'LinearGenomeView',
      assembly: 'volvox',
      loc,
      tracks: ['volvox-long-reads-sv-bam'],
    },
  ],
})

const suite: TestSuite = {
  name: 'Multi-region Sort',
  tests: [
    {
      // Baseline: a same-refName two-region pileup, colored by strand, NOT
      // sorted. Paired with the sorted test below — the two images differ only
      // if multi-region sort takes effect (before the same-refName fix in
      // computeMultiRegionLayout, sorting a multi-region view was a silent
      // no-op, so this and the sorted capture would be identical).
      name: 'multi-region colored by strand (unsorted)',
      fn: async page => {
        await navigateWithSessionSpec(page, view('ctgA:34200-35950'))
        await findByTestId(page, pileup, 60000)
        await waitForDataLoaded(page)
        await reshapeToTwoRegions(page, false)
        await dualSnapshot(
          page,
          'multiregion-strand-unsorted-canvas',
          `[data-testid="${pileup}"] canvas`,
        )
      },
    },
    {
      // Reads spanning both windows are grouped by strand identically in BOTH
      // panels (same read → same row in each region), asserted from the laid-out
      // rows and visible in the capture.
      name: 'multi-region sorted by strand, spanning reads share rows',
      fn: async page => {
        await navigateWithSessionSpec(page, view('ctgA:34200-35950'))
        await findByTestId(page, pileup, 60000)
        await waitForDataLoaded(page)
        await reshapeToTwoRegions(page, true)
        await assertSpanningReadsShareRows(page)
        await dualSnapshot(
          page,
          'multiregion-strand-sorted-canvas',
          `[data-testid="${pileup}"] canvas`,
        )
      },
    },
  ],
}

export default suite
