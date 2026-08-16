import { displayPainted } from '@jbrowse/browser-test-utils'

import {
  delay,
  navigateWithSessionSpec,
  waitForDataLoaded,
} from '../helpers.ts'

import type { TestSuite } from '../types.ts'
import type { Page } from 'puppeteer'

// The pointer affordances (crosshair guides, hover shading, the tooltip that
// follows the cursor) are the one part of a display no snapshot covers: they
// exist only while a real pointer is over the track. They are also wired through
// shared plumbing — `useMouseTracking` measures the chrome container,
// `DisplayCrosshairs` derives its geometry from the model — so a change there
// lands on several displays at once, and the failure mode is silent (an overlay
// that stops appearing, or appears in the wrong place).

// Both crosshair guides, counted off the DOM: `Crosshairs` is one <svg> holding
// a <line> per guide (a vertical genomic guide, plus a horizontal row guide for
// the displays whose y means something).
function countGuideLines(page: Page) {
  return page.evaluate(
    () =>
      [...document.querySelectorAll('svg')].flatMap(s => [
        ...s.querySelectorAll(':scope > line'),
      ]).length,
  )
}

// BaseTooltip portals to a bare div parented to <body> with no role or testid,
// so it is identified structurally: the body-level div that isn't the app root.
function findTooltip() {
  const app = document.body.children[1]
  return [...document.body.children].find(
    e => e.tagName === 'DIV' && e !== app && e.textContent,
  )
}

function tooltipText(page: Page) {
  return page.evaluate(
    `(${findTooltip})()?.textContent ?? ''`,
  ) as Promise<string>
}

function tooltipX(page: Page) {
  return page.evaluate(
    `(${findTooltip})()?.getBoundingClientRect().x`,
  ) as Promise<number | undefined>
}

async function boxOf(page: Page, selector: string) {
  return page.$eval(selector, el => {
    const r = el.getBoundingClientRect()
    return { x: r.x, y: r.y, width: r.width, height: r.height }
  })
}

// A trusted pointer move (two steps, so the display sees motion rather than a
// teleport) landing at a fraction of the target's box.
async function hoverFraction(
  page: Page,
  selector: string,
  fx: number,
  fy: number,
) {
  const box = await boxOf(page, selector)
  const x = box.x + box.width * fx
  const y = box.y + box.height * fy
  await page.mouse.move(x - 30, y - 10)
  await page.mouse.move(x, y, { steps: 4 })
  await delay(400)
  return { x, y }
}

async function bootTrack(page: Page, trackId: string, displayTestId: string) {
  await navigateWithSessionSpec(page, {
    views: [
      {
        type: 'LinearGenomeView',
        loc: 'ctgA:1..50000',
        assembly: 'volvox',
        tracks: [trackId],
      },
    ],
  })
  await page.waitForSelector(`[data-testid="${displayTestId}"]`, {
    timeout: 60000,
  })
  await waitForDataLoaded(page, 60000)
  await delay(2000)
}

function assert(cond: boolean, message: string) {
  if (!cond) {
    throw new Error(message)
  }
}

const MULTIROW_HIGHLIGHT = '[data-testid="multirow_hover_highlight"]'

export const suite: TestSuite = {
  name: 'cursor-guides',
  tests: [
    {
      name: 'multi-row painting: guides, hover box, tooltip, click',
      fn: async page => {
        await bootTrack(
          page,
          'volvox_mouse_inheritance_painting',
          'multirow-display',
        )
        assert(
          (await countGuideLines(page)) === 0,
          'guides drawn before the pointer arrived',
        )

        const { x, y } = await hoverFraction(
          page,
          '[data-testid="multirow_canvas"]',
          0.6,
          0.5,
        )
        assert(
          (await countGuideLines(page)) === 2,
          'expected a vertical and a horizontal guide while hovering',
        )

        // the box has to land on the block under the cursor, not merely exist
        const box = await boxOf(page, MULTIROW_HIGHLIGHT)
        assert(
          x >= box.x - 1 &&
            x <= box.x + box.width + 1 &&
            y >= box.y - 1 &&
            y <= box.y + box.height + 1,
          `hover box ${JSON.stringify(box)} does not contain the cursor ${x},${y}`,
        )

        // the row label comes from the live row order, and the locus from the hit
        const tip = await tooltipText(page)
        assert(
          // `assembleLocString` groups the thousands, so the coordinates carry
          // separators — a `\d+` either side of the `..` matches none of them
          /offspring\d+/.test(tip) && /ctgA:[\d,]+\.\.[\d,]+/.test(tip),
          `tooltip missing row label or locus: ${tip}`,
        )

        // The tooltip follows the cursor within one block, where the hover
        // identity itself never changes — it is anchored to the pointer state,
        // not to the (deduplicated) hover written on the model.
        const before = await tooltipX(page)
        await page.mouse.move(x + 25, y, { steps: 3 })
        await delay(400)
        const after = await tooltipX(page)
        assert(
          before !== undefined && after !== undefined && after > before,
          `tooltip did not follow the cursor: ${before} -> ${after}`,
        )

        // right-click clears the hover so its tooltip can't stick under the
        // menu, and the mark stays on the block the menu is acting on
        await page.mouse.click(x, y, { button: 'right' })
        await delay(800)
        assert(
          await page.evaluate(() =>
            document.body.textContent.includes('Sort rows by color here'),
          ),
          'right-click did not open the display context menu',
        )
        assert(
          !!(await page.$(MULTIROW_HIGHLIGHT)),
          'hover mark dropped while the context menu was acting on that block',
        )
        await page.keyboard.press('Escape')
        await delay(500)

        // click opens the feature details widget for the block under the cursor
        await page.mouse.move(x, y, { steps: 2 })
        await delay(300)
        await page.mouse.click(x, y)
        await delay(2500)
        assert(
          await page.evaluate(
            () =>
              document.body.textContent.includes('Feature details') &&
              document.body.textContent.includes('Core details'),
          ),
          'click did not open the feature details widget',
        )

        // leaving the display drops every pointer affordance together
        await page.mouse.move(5, 5)
        await delay(500)
        assert(
          (await countGuideLines(page)) === 0 &&
            !(await page.$(MULTIROW_HIGHLIGHT)),
          'guides or hover box survived the pointer leaving the display',
        )
      },
    },
    {
      name: 'multi-wiggle: guides and tooltip',
      fn: async page => {
        await bootTrack(
          page,
          'volvox_microarray_multi_multirowxy',
          'multi-wiggle-display',
        )
        assert(
          (await countGuideLines(page)) === 0,
          'guides drawn before the pointer arrived',
        )
        await hoverFraction(
          page,
          displayPainted('multi-wiggle-display'),
          0.5,
          0.5,
        )
        assert(
          (await countGuideLines(page)) === 2,
          'expected the full crosshair over a multi-row wiggle',
        )
        const tip = await tooltipText(page)
        assert(
          tip.includes('ctgA:') && /\d/.test(tip),
          `tooltip missing locus or score: ${tip}`,
        )
        await page.mouse.move(5, 5)
        await delay(500)
        assert(
          (await countGuideLines(page)) === 0,
          'guides survived the pointer leaving the plot',
        )
      },
    },
    {
      // The two displays that resolve their own pointer rather than taking the
      // chrome's `onPointerPosition` — a borderless leaf canvas for the pileup,
      // a canvas with label overlays over it for the feature track. Both run
      // their hit test through `useCoalescedPointer`, so what a hover costs and
      // when it lands are decided a frame away from the event, and neither had
      // anything asserting the tooltip appears at all.
      //
      // A tooltip's TEXT is the assertion, not its presence: the hover writes
      // are guarded on their own contents now, so a hit that resolves to the
      // wrong feature, or to none, reads as text that is absent or does not name
      // the locus.
      name: 'canvas features and pileup: tooltip on hover, and it clears',
      fn: async page => {
        await bootTrack(page, 'gff3tabix_genes', 'feature-display')
        // On a feature rather than the gap between two rows: this track lays out
        // several rows over the locus and the gaps between them answer nothing,
        // which is a miss and not a failure. Half way down and across lands on
        // one of the `seg` genes.
        const { x, y } = await hoverFraction(
          page,
          displayPainted('feature-display'),
          0.5,
          0.5,
        )
        const featureTip = await tooltipText(page)
        assert(
          featureTip.length > 0,
          'no tooltip while hovering a canvas feature',
        )
        // Still on the same feature one frame later — the coalesced hover must
        // land, not merely be scheduled.
        await page.mouse.move(x + 2, y, { steps: 2 })
        await delay(400)
        assert(
          (await tooltipText(page)) === featureTip,
          'the tooltip changed while the cursor stayed on one feature',
        )
        await page.mouse.move(5, 5)
        await delay(500)
        assert(
          (await tooltipText(page)) === '',
          'the feature tooltip survived the pointer leaving the display',
        )

        await bootTrack(page, 'volvox_bam_pileup', 'pileup-display')
        await hoverFraction(page, displayPainted('pileup-display'), 0.5, 0.4)
        const readTip = await tooltipText(page)
        assert(
          readTip.includes('ctgA'),
          `pileup tooltip missing the read's locus: ${readTip}`,
        )
        await page.mouse.move(5, 5)
        await delay(500)
        assert(
          (await tooltipText(page)) === '',
          'the pileup tooltip survived the pointer leaving the display',
        )
      },
    },
    {
      // maf is the display where hover and drag share one pointer, and the two
      // halves are now sourced differently: the hover position comes from the
      // chrome's tracker, the rubberband's corners from `useDragSelection`'s own
      // state, written only while a button is held. Nothing else asserts either
      // — the `MAF Track` suite is all geometry — so a hover that stopped
      // appearing, or a drag whose move handler stopped firing, was invisible.
      name: 'maf: guides and tooltip on hover, rubberband on drag',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              loc: 'ctgA:1-4000',
              assembly: 'volvox',
              tracks: [{ trackId: 'volvox_maf' }],
            },
          ],
        })
        await page.waitForSelector(displayPainted('maf-display'), {
          timeout: 60000,
        })
        await waitForDataLoaded(page, 60000)
        await delay(2000)

        assert(
          (await countGuideLines(page)) === 0,
          'guides drawn before the pointer arrived',
        )

        // well right of the tree sidebar: maf suppresses guides and tooltips
        // left of its resize-handle edge, where a genomic coordinate would be
        // the one the sidebar is covering
        const { x, y } = await hoverFraction(
          page,
          displayPainted('maf-display'),
          0.7,
          0.6,
        )
        assert(
          (await countGuideLines(page)) === 2,
          'expected both guides while hovering the maf rows',
        )
        const tip = await tooltipText(page)
        assert(
          tip.includes('ctgA:'),
          `maf tooltip missing its locus readout: ${tip}`,
        )

        const before = await tooltipX(page)
        await page.mouse.move(x + 25, y, { steps: 3 })
        await delay(400)
        const after = await tooltipX(page)
        assert(
          before !== undefined && after !== undefined && after > before,
          `maf tooltip did not follow the cursor: ${before} -> ${after}`,
        )

        // The drag: press, travel past the 3px threshold, release. The
        // rubberband is drawn from state that only a live drag writes, so a
        // move handler that stopped updating mid-drag shows up here as a
        // selection that never reaches the menu.
        await page.mouse.move(x, y)
        await page.mouse.down()
        await page.mouse.move(x + 120, y, { steps: 6 })
        await delay(300)
        await page.mouse.up()
        await delay(800)
        assert(
          await page.evaluate(() =>
            document.body.textContent.includes('View subsequences'),
          ),
          'drag-selection did not open the subsequence menu',
        )
        await page.keyboard.press('Escape')
        await delay(500)

        await page.mouse.move(5, 5)
        await delay(500)
        assert(
          (await countGuideLines(page)) === 0,
          'guides survived the pointer leaving the maf display',
        )
      },
    },
  ],
}

export default suite
