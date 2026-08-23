import {
  assertVirtualScrollStructure,
  findByTestId,
  waitForDisplayDrawn,
  navigateWithSessionSpec,
  waitForDataLoaded,
} from '../helpers.ts'

import type { TestSuite } from '../types.ts'
import type { Page } from 'puppeteer'

const DISPLAY = '[data-display-id^="volvox_maf-LinearMafDisplay"]'
// The rows container: offset to `rowsTopOffset`, and the element the wheel
// listener is bound to. Addressed by test id rather than by shape — it used to
// be "the div with two canvases in it", which stopped being true when the
// backend's canvas moved out of it to carry the coverage band as well.
const ROWS = `${DISPLAY} > [data-testid="maf-rows"]`
// The backend's canvas, spanning the band stack AND the rows viewport. One
// canvas because a display gets one rendering backend: the coverage band is
// scissored out of its top, the rows out of the rest.
const CANVAS = `${DISPLAY} > canvas`

// volvox_maf is 10 species. Pinned at 15px they need 150px of rows, and the
// track is 120px tall (45 of which is the coverage band) — so the rows overflow
// their viewport by exactly the amount the scroll has to cover.
const pinnedRowHeightSpec = {
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

// The shipped default: no pinned row height, so the rows are fitted to the
// track and there is nothing to scroll.
const fitToHeightSpec = {
  views: [
    {
      type: 'LinearGenomeView',
      assembly: 'volvox',
      loc: 'ctgA:1-4000',
      tracks: [{ trackId: 'volvox_maf' }],
    },
  ],
}

interface Geometry {
  effectiveRowHeight: number
  rowsHeight: number
  rowsContentHeight: number
  scrollableHeight: number
  scrollTop: number
  /** where the rows band starts inside the canvas: the stacked bands above it */
  rowsTopOffset: number
  /**
   * The backend canvas's backing store in CSS px. What the scroll is meant to
   * bound is the ROWS half of it, so the assertion is against
   * `rowsTopOffset + rowsHeight` rather than against `rowsHeight` alone.
   */
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
      rowsContentHeight: display.rowsContentHeight!,
      scrollableHeight: display.scrollableHeight!,
      scrollTop: display.scrollTop!,
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

function setScrollTop(page: Page, to: 'bottom' | number) {
  return page.evaluate((target: 'bottom' | number) => {
    const display = (
      window as unknown as {
        JBrowseSession: {
          views: {
            tracks: {
              displays: {
                setScrollTop: (n: number) => void
                scrollableHeight: number
              }[]
            }[]
          }[]
        }
      }
    ).JBrowseSession.views[0]!.tracks[0]!.displays[0]!
    display.setScrollTop(
      target === 'bottom' ? display.scrollableHeight : target,
    )
  }, to)
}

// page.mouse.wheel does not reach a non-passive wheel listener in headless, so
// dispatch the event at the rows container the listener is bound to.
function wheel(page: Page, init: { deltaY: number; shiftKey?: boolean }) {
  return page.evaluate(
    (sel: string, ev: { deltaY: number; shiftKey?: boolean }) => {
      document.querySelector(sel)!.dispatchEvent(
        new WheelEvent('wheel', {
          ...ev,
          bubbles: true,
          cancelable: true,
        }),
      )
    },
    ROWS,
    init,
  )
}

async function openPinned(page: Page) {
  await navigateWithSessionSpec(page, pinnedRowHeightSpec)
  await waitForDisplayDrawn(page, 'volvox_maf-LinearMafDisplay')
  await waitForDataLoaded(page)
}

const delay = (ms: number) =>
  new Promise(resolve => {
    setTimeout(resolve, ms)
  })

const suite: TestSuite = {
  name: 'MAF Track',
  tests: [
    // The regression this whole thing exists for: a pinned row height must not
    // grow the canvas. Before virtual scroll the rows area WAS the content, so
    // a deep alignment allocated a canvas several screens tall — per overlay.
    {
      name: 'a pinned row height scrolls rather than growing the canvas',
      fn: async page => {
        await openPinned(page)
        const g = await readGeometry(page)
        if (g.effectiveRowHeight !== 15) {
          throw new Error(
            `pinned row height was not honored: ${g.effectiveRowHeight}`,
          )
        }
        if (!(g.rowsContentHeight > g.rowsHeight && g.scrollableHeight > 0)) {
          throw new Error(
            `expected the rows to overflow: content ${g.rowsContentHeight}, viewport ${g.rowsHeight}`,
          )
        }
        // the canvas is the band stack plus the rows VIEWPORT, never the rows
        // content — which is the whole regression: content-sized, a deep
        // alignment allocated a canvas several screens tall.
        const expected = g.rowsTopOffset + g.rowsHeight
        if (Math.abs(g.canvasCssHeight - expected) > 1) {
          throw new Error(
            `canvas is ${g.canvasCssHeight}px, expected the ${expected}px band stack + rows viewport`,
          )
        }
        // scrollbar first: `assertVirtualScrollStructure` also measures that the
        // thumb is on the display's right edge, and skips that half when there
        // is no thumb in the DOM yet — so asserting before it mounts quietly
        // dropped the geometry check rather than failing.
        await findByTestId(page, 'vertical-scrollbar', 5000)
        await assertVirtualScrollStructure(page, CANVAS)
      },
    },

    // Scrolling has to move the rows themselves, not just the model number —
    // and the labels beside them have to move with the cells they name.
    {
      name: 'scrolling reveals the last species and keeps the canvas bounded',
      fn: async page => {
        await openPinned(page)
        const top = await visibleSpecies(page)
        if (!top.includes('volvox') || top.includes('metavolvox')) {
          throw new Error(
            `unexpected species at scrollTop 0: ${JSON.stringify(top)}`,
          )
        }
        await setScrollTop(page, 'bottom')
        await delay(500)
        const bottom = await visibleSpecies(page)
        if (!bottom.includes('metavolvox') || bottom.includes('volvox')) {
          throw new Error(
            `scrolling to the bottom did not move the rows: ${JSON.stringify(bottom)}`,
          )
        }
        const g = await readGeometry(page)
        if (
          Math.abs(g.canvasCssHeight - (g.rowsTopOffset + g.rowsHeight)) > 1
        ) {
          throw new Error('canvas grew while scrolled')
        }
      },
    },

    {
      name: 'wheel scrolls the rows, shift+wheel resizes them',
      fn: async page => {
        await openPinned(page)
        await wheel(page, { deltaY: 40 })
        await delay(500)
        const scrolled = await readGeometry(page)
        if (scrolled.scrollTop <= 0) {
          throw new Error('wheel over the rows did not scroll them')
        }

        // shift is the row-height (vertical zoom) gesture, per adr-027
        await wheel(page, { deltaY: -2400, shiftKey: true })
        await delay(500)
        const resized = await readGeometry(page)
        if (!(resized.effectiveRowHeight > scrolled.effectiveRowHeight)) {
          throw new Error(
            `shift+wheel did not grow the rows: ${scrolled.effectiveRowHeight} -> ${resized.effectiveRowHeight}`,
          )
        }
      },
    },

    // The default must not have acquired a scrollbar: fit-to-height derives the
    // row height from the viewport, so the content fits by construction.
    {
      name: 'fit-to-height does not scroll',
      fn: async page => {
        await navigateWithSessionSpec(page, fitToHeightSpec)
        await waitForDisplayDrawn(page, 'volvox_maf-LinearMafDisplay')
        await waitForDataLoaded(page)
        const g = await readGeometry(page)
        if (g.scrollableHeight !== 0) {
          throw new Error(
            `fit-to-height reported a scroll extent of ${g.scrollableHeight}`,
          )
        }
        if (await page.$('[data-testid="vertical-scrollbar"]')) {
          throw new Error('fit-to-height rendered a scrollbar')
        }
      },
    },
  ],
}

export default suite
