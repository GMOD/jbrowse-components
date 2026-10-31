import {
  waitForDisplayDrawn,
  navigateWithSessionSpec,
  waitForDataLoaded,
} from '../helpers.ts'
import { dualSnapshot } from '../snapshot.ts'

import type { TestSuite } from '../types.ts'
import type { Page } from 'puppeteer'

const DISPLAY = '[data-display-id^="volvox_maf-LinearMafDisplay"]'
// The backend's canvas, spanning the band stack AND the rows viewport. One
// canvas because a display gets one rendering backend: the coverage band is
// scissored out of its top, the rows out of the rest.
const CANVAS = `${DISPLAY} > canvas`

// volvox_maf is 10 species. A link from before MAF went always-fit pinned
// them at 15px in a 120px track (45 of which is the coverage band), which
// overflowed the rows by 75px; the retired key is dropped, so they fit.
const retiredRowHeightSpec = {
  views: [
    {
      type: 'LinearGenomeView',
      assembly: 'volvox',
      loc: 'ctgA:1-4000',
      tracks: [
        {
          trackId: 'volvox_maf',
          displaySnapshot: {
            type: 'LinearMafDisplay',
            rowHeight: 15,
            height: 120,
          },
        },
      ],
    },
  ],
}

const defaultSpec = {
  views: [
    {
      type: 'LinearGenomeView',
      assembly: 'volvox',
      loc: 'ctgA:1-4000',
      tracks: [{ trackId: 'volvox_maf' }],
    },
  ],
}

const refNameRankSpec = {
  views: [
    {
      type: 'LinearGenomeView',
      assembly: 'volvox',
      loc: 'ctgA:1-4000',
      tracks: [
        {
          trackId: 'volvox_maf',
          displaySnapshot: {
            type: 'LinearMafDisplay',
            encoding: { color: { field: 'refNameRank' } },
          },
        },
      ],
    },
  ],
}

// The config's volvox MAF with a zoom-out tier: one record per alignment block
// per species, scored by identity to the reference. Root-relative uris, since
// a spec's sessionTracks never pass through the config's `addRelativeUris`.
const SUMMARY_TRACK = 'volvox_maf_summary'
const summarySpec = {
  sessionTracks: [
    {
      type: 'MafTrack',
      trackId: SUMMARY_TRACK,
      name: SUMMARY_TRACK,
      assemblyNames: ['volvox'],
      adapter: {
        type: 'MafTabixAdapter',
        bedGzLocation: {
          uri: '/test_data/volvox/volvox.maf.bed.gz',
          locationType: 'UriLocation',
        },
        index: {
          indexType: 'TBI',
          location: {
            uri: '/test_data/volvox/volvox.maf.bed.gz.tbi',
            locationType: 'UriLocation',
          },
        },
        summaryAdapter: {
          type: 'BedTabixAdapter',
          bedGzLocation: {
            uri: '/test_data/volvox/volvox.maf.summary.bed.gz',
            locationType: 'UriLocation',
          },
          index: {
            location: {
              uri: '/test_data/volvox/volvox.maf.summary.bed.gz.tbi',
              locationType: 'UriLocation',
            },
          },
        },
      },
    },
  ],
  views: [
    {
      type: 'LinearGenomeView',
      assembly: 'volvox',
      loc: 'ctgA:1-50001',
      tracks: [{ trackId: SUMMARY_TRACK }],
    },
  ],
}

interface Geometry {
  effectiveRowHeight: number
  rowsHeight: number
  scrollableHeight: number
  /** where the rows band starts inside the canvas: the stacked bands above it */
  rowsTopOffset: number
  /** the backend canvas in CSS px: the band stack plus the rows area */
  canvasCssHeight: number
}

function readGeometry(page: Page) {
  return page.evaluate((canvasSel: string): Geometry => {
    const display = (
      window as unknown as {
        JBrowseSession: {
          views: { tracks: { displays: Record<string, number>[] }[] }[]
        }
      }
    ).JBrowseSession.views[0]!.tracks[0]!.displays[0]!
    const canvas = document.querySelector(canvasSel)
    return {
      effectiveRowHeight: display.effectiveRowHeight!,
      rowsHeight: display.rowsHeight!,
      scrollableHeight: display.scrollableHeight!,
      rowsTopOffset: display.rowsTopOffset!,
      canvasCssHeight: canvas
        ? Number.parseFloat(getComputedStyle(canvas).height)
        : Number.NaN,
    }
  }, CANVAS)
}

// The species names drawn beside the rows — culled to the viewport, so this is
// "which rows can the user see", read from the DOM rather than from the model.
//
// Addressed by its own test id, NOT as `${DISPLAY} svg text`. The labels are
// portaled into the TrackContainer's overlay node so the inter-region masks
// don't paint over them (see RowLabelsOverlay), which puts them outside the
// display's subtree entirely — the display-scoped query silently kept matching,
// and returned the coverage band's axis ticks `["0","10"]` instead of species.
const ROW_LABELS = '[data-testid="maf-row-labels"]'

function visibleSpecies(page: Page) {
  return page.evaluate(
    (sel: string) =>
      [...document.querySelectorAll(`${sel} text`)].map(t => t.textContent),
    ROW_LABELS,
  )
}

async function expectAllRowsFit(page: Page) {
  await waitForDisplayDrawn(page, 'volvox_maf-LinearMafDisplay')
  await waitForDataLoaded(page)
  const g = await readGeometry(page)
  if (g.scrollableHeight !== 0) {
    throw new Error(`the rows report a scroll extent of ${g.scrollableHeight}`)
  }
  if (Math.abs(g.effectiveRowHeight * 10 - g.rowsHeight) > 0.01) {
    throw new Error(
      `10 rows of ${g.effectiveRowHeight}px do not fill the ${g.rowsHeight}px rows area`,
    )
  }
  if (Math.abs(g.canvasCssHeight - (g.rowsTopOffset + g.rowsHeight)) > 1) {
    throw new Error(
      `canvas is ${g.canvasCssHeight}px, expected the band stack + rows area`,
    )
  }
  if (await page.$('[data-testid="vertical-scrollbar"]')) {
    throw new Error('the rows rendered a scrollbar')
  }
  const species = await visibleSpecies(page)
  if (!species.includes('volvox') || !species.includes('metavolvox')) {
    throw new Error(`not every species is labelled: ${JSON.stringify(species)}`)
  }
  return g
}

const suite: TestSuite = {
  name: 'MAF Track',
  tests: [
    {
      name: 'the rows fit the track and never scroll',
      fn: async page => {
        await navigateWithSessionSpec(page, defaultSpec)
        await expectAllRowsFit(page)
      },
    },

    {
      name: 'a link pinning the retired rowHeight still opens fitted',
      fn: async page => {
        await navigateWithSessionSpec(page, retiredRowHeightSpec)
        const g = await expectAllRowsFit(page)
        if (Math.abs(g.rowsTopOffset + g.rowsHeight - 120) > 1) {
          throw new Error(
            `the track is ${g.rowsTopOffset + g.rowsHeight}px, not its 120px height`,
          )
        }
      },
    },

    // The rows' span marks on the backend canvas, which the cross-backend gate
    // holds to one another.
    {
      name: 'source chromosome rows',
      fn: async page => {
        await navigateWithSessionSpec(page, refNameRankSpec)
        await waitForDisplayDrawn(page, 'volvox_maf-LinearMafDisplay')
        await waitForDataLoaded(page)
        await dualSnapshot(page, 'maf-source-chrom-canvas', CANVAS)
      },
    },
    {
      name: 'summary tier bars',
      fn: async page => {
        await navigateWithSessionSpec(page, summarySpec)
        await waitForDisplayDrawn(page, `${SUMMARY_TRACK}-LinearMafDisplay`)
        await waitForDataLoaded(page)
        await dualSnapshot(
          page,
          'maf-summary-canvas',
          `[data-display-id^="${SUMMARY_TRACK}-LinearMafDisplay"] > canvas`,
        )
      },
    },
  ],
}

export default suite
