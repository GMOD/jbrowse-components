import {
  assertVirtualScrollStructure,
  delay,
  findByTestId,
  findDisplayPainted,
  navigateWithSessionSpec,
  waitForDataLoaded,
  waitForDisplayDrawn,
} from '../helpers.ts'
import { lgvSnapshotTest } from '../suiteHelpers.ts'

import type { TestSuite } from '../types.ts'
import type { Page } from 'puppeteer'

// Multi-sample variant with a pinned (overflowing) row height. The rows are
// 8px × ~1000 samples ≫ the 200px track, so the display must scroll — used to
// assert the scroll structure stays correct (regression guard for the
// "per track scrollbars" report: a spurious second bar on the outer container).
const overflowingMultiSampleSpec = {
  views: [
    {
      type: 'LinearGenomeView',
      assembly: 'volvox',
      loc: 'ctgA:1-50000',
      tracks: [
        {
          trackId: 'volvox_test_vcf',
          displaySnapshot: {
            type: 'LinearMultiSampleVariantDisplay',
            rowHeight: 8,
            height: 200,
          },
        },
      ],
    },
  ],
}

// Plain LinearVariantDisplay (canvas basic) with a short track so its labelled
// variants stack past the viewport and it scrolls. Used to guard the GPU/DOM
// scroll-tear fix: the label overlay must track model.scrollTop (like the GPU
// canvas), not ride the native compositor scroll.
const overflowingPlainVariantSpec = {
  views: [
    {
      type: 'LinearGenomeView',
      assembly: 'volvox',
      loc: 'ctgA:1-50000',
      tracks: [
        {
          trackId: 'volvox_filtered_vcf',
          displaySnapshot: { type: 'LinearVariantDisplay', height: 40 },
        },
      ],
    },
  ],
}

// Back-compat: the multi-sample display was renamed
// MultiLinearVariantDisplay -> LinearMultiSampleVariantDisplay. An old saved
// session stores the pre-rename type on the active display instance; the model's
// preProcessSnapshot must remap it so the dispatcher-less `displays` union still
// resolves and the display renders. The demo track carries samplesTsvLocation +
// colorBy:'population' + showReferenceAlleles, so this also exercises the
// metadata-preloading path end to end. `volvox_test_vcf` has genotypes and
// resolves through the same shared multi-sample model.
const oldTypeNameSpec = {
  views: [
    {
      type: 'LinearGenomeView',
      assembly: 'volvox',
      loc: 'ctgA:1-50000',
      tracks: [
        {
          trackId: 'volvox_test_vcf',
          displaySnapshot: {
            // pre-rename type string, as an old saved session would store it
            type: 'MultiLinearVariantDisplay',
            height: 200,
          },
        },
      ],
    },
  ],
}

const populationDemoSpec = {
  views: [
    {
      type: 'LinearGenomeView',
      assembly: 'volvox',
      loc: 'ctgA:1-50000',
      tracks: [{ trackId: 'volvox multi-sample sv' }],
    },
  ],
}

// The SV callset, whose records carry IDs (`sv_inv_001`) and span thousands of
// bases, so a lane mark is wide enough to aim at and identifiable once hit. The
// lane is off by default (it spends height the rows would have), so the test
// turns it on through the same action the track menu's checkbox calls.
const laneSpec = {
  views: [
    {
      type: 'LinearGenomeView',
      assembly: 'volvox',
      loc: 'ctgA:1-20000',
      tracks: [
        {
          trackId: 'volvox multi-sample sv',
          displaySnapshot: {
            type: 'LinearMultiSampleVariantDisplay',
            height: 250,
          },
        },
      ],
    },
  ],
}

interface LaneDisplay {
  setShowVariantLane(arg: boolean): void
  laneContentHeight: number
  laneLaidOutDataMap: ReadonlyMap<number, { flatbushItems: unknown[] }>
  topBands: { laneHeight: number }
  renderBlocks: {
    start: number
    end: number
    screenStartPx: number
    screenEndPx: number
  }[]
  hoveredGenotype?: Record<string, unknown>
}

function laneDisplay() {
  return (
    window as unknown as {
      JBrowseSession: { views: { tracks: { displays: LaneDisplay[] }[] }[] }
    }
  ).JBrowseSession.views[0]!.tracks[0]!.displays[0]!
}

// Canvas x of a genomic position, off the display's own render blocks — the same
// geometry the band was laid out in, so the pointer lands on the mark rather
// than near it.
function laneX(page: Page, bp: number) {
  return page.evaluate(
    `((bp) => {
      const d = (${laneDisplay})()
      const b = d.renderBlocks[0]
      const pxPerBp = (b.screenEndPx - b.screenStartPx) / (b.end - b.start)
      return b.screenStartPx + (bp - b.start) * pxPerBp
    })(${bp})`,
  ) as Promise<number>
}

function hoveredRecord(page: Page) {
  return page.evaluate(`(${laneDisplay})().hoveredGenotype`) as Promise<
    Record<string, unknown> | undefined
  >
}

// The band as the fit ladder resolved it: how tall the packed stack ended up,
// and how many records it placed.
function laneFit(page: Page) {
  return page.evaluate(
    `((d) => ({
      contentHeight: d.laneContentHeight,
      laneHeight: d.topBands.laneHeight,
      placed: [...d.laneLaidOutDataMap.values()].reduce(
        (n, r) => n + r.flatbushItems.length,
        0,
      ),
    }))((${laneDisplay})())`,
  ) as Promise<{ contentHeight: number; laneHeight: number; placed: number }>
}

// BaseTooltip portals to a bare div parented to <body> with no role or testid,
// so it is identified structurally — the same reading `cursor-guides` takes.
function tooltipText(page: Page) {
  return page.evaluate(() => {
    const app = document.body.children[1]
    return (
      [...document.body.children].find(
        e => e.tagName === 'DIV' && e !== app && e.textContent,
      )?.textContent ?? ''
    )
  })
}

async function boxOf(page: Page, selector: string) {
  return page.$eval(selector, el => {
    const r = el.getBoundingClientRect()
    return { x: r.x, y: r.y, width: r.width, height: r.height }
  })
}

function assert(cond: boolean, message: string) {
  if (!cond) {
    throw new Error(message)
  }
}

const suite: TestSuite = {
  name: 'Variants Track',
  tests: [
    // Renders the old pre-rename display type via the model's preProcessSnapshot
    // remap; if the union failed to resolve it, no canvas would ever paint.
    {
      name: 'old MultiLinearVariantDisplay type still renders (rename back-compat)',
      fn: async page => {
        await navigateWithSessionSpec(page, oldTypeNameSpec)
        await findDisplayPainted(page, 'variant-display', 30000)
        await waitForDataLoaded(page)
        await findByTestId(page, 'variant_canvas')
      },
    },

    // colorBy:'population' + samplesTsvLocation end to end: the sample-metadata
    // TSV must parse, reach the display's sources, and drive the palette so
    // same-population rows share a tint and different populations differ. The
    // tint is `labelColor`, the channel tree-sidebar draws a row label with.
    {
      name: 'colorBy population colors sample rows from samplesTsv metadata',
      fn: async page => {
        await navigateWithSessionSpec(page, populationDemoSpec)
        await findDisplayPainted(page, 'variant-display', 30000)
        await waitForDataLoaded(page)
        const info = await page.evaluate(() => {
          interface Src {
            name: string
            population?: string
            labelColor?: string
          }
          const session = (
            window as unknown as {
              JBrowseSession: {
                views: {
                  tracks: { displays: { colorBy: string; sources?: Src[] }[] }[]
                }[]
              }
            }
          ).JBrowseSession
          const display = session.views[0]!.tracks[0]!.displays[0]!
          return {
            colorBy: display.colorBy,
            sources: (display.sources ?? []).map(s => ({
              name: s.name,
              population: s.population,
              labelColor: s.labelColor,
            })),
          }
        })
        if (info.colorBy !== 'population') {
          throw new Error(
            `expected colorBy 'population', got '${info.colorBy}'`,
          )
        }
        if (info.sources.length === 0) {
          throw new Error('no sample sources loaded from samplesTsv')
        }
        // every source carries a population attribute and a resolved tint
        const missing = info.sources.filter(s => !s.population || !s.labelColor)
        if (missing.length) {
          throw new Error(
            `sources missing population/labelColor: ${JSON.stringify(missing.slice(0, 3))}`,
          )
        }
        // one color per population: same pop => same color, and >1 distinct color
        const colorByPop = new Map<string, string>()
        for (const s of info.sources) {
          const prev = colorByPop.get(s.population!)
          if (prev && prev !== s.labelColor) {
            throw new Error(
              `population ${s.population} has two colors: ${prev} vs ${s.labelColor}`,
            )
          }
          colorByPop.set(s.population!, s.labelColor!)
        }
        if (new Set(colorByPop.values()).size < 2) {
          throw new Error(
            'expected multiple populations to get distinct colors',
          )
        }
      },
    },

    // Regression guard for the "variants separated from their labels" tear: the
    // plain LinearVariantDisplay (canvas-basic) scrolls virtually, so its label
    // overlay tracks model.scrollTop like the GPU canvas and can't ride a
    // separate native scroll. Guarding the structure keeps it from regressing.
    {
      name: 'plain variant display scrolls virtually (no native scroll container)',
      fn: async page => {
        await navigateWithSessionSpec(page, overflowingPlainVariantSpec)
        await waitForDisplayDrawn(
          page,
          'volvox_filtered_vcf-LinearVariantDisplay',
        )
        await waitForDataLoaded(page)
        // an overflowing display renders the draggable VerticalScrollbar overlay
        await findByTestId(page, 'vertical-scrollbar')
        await assertVirtualScrollStructure(page, 'canvas')
      },
    },

    // The variant lane is a plugin-canvas feature band living in one strip of a
    // genotype-matrix display, and it is only that if its marks answer a pointer
    // the way that plugin's features do. Nothing but a real pointer exercises
    // this end of it: the hit test runs off the band's own laid-out stack, the
    // tooltip is portalled to <body>, and the gestures ride a transparent div
    // over an `OverlayCanvas` that is `pointerEvents: none` by construction.
    {
      name: 'variant lane marks hover, right-click and click like features',
      fn: async page => {
        await navigateWithSessionSpec(page, laneSpec)
        await findDisplayPainted(page, 'variant-display', 30000)
        await waitForDataLoaded(page)
        await page.evaluate(`(${laneDisplay})().setShowVariantLane(true)`)
        await findByTestId(page, 'variant_lane')
        await delay(1500)

        // the band packed a stack and fitted it inside the height it was given —
        // the fit ladder's job, and what makes overlapping records stack rather
        // than overdraw
        const fit = await laneFit(page)
        assert(fit.placed > 0, 'the lane placed no records')
        assert(
          fit.contentHeight > 0 && fit.contentHeight <= fit.laneHeight,
          `lane stack ${fit.contentHeight} does not fit its ${fit.laneHeight}px band`,
        )

        // the middle of sv_inv_001 (ctgA:3200-4800), an inversion
        const lane = await boxOf(page, '[data-testid="variant_lane"]')
        const x = lane.x + (await laneX(page, 4000))
        const y = lane.y + 4
        await page.mouse.move(x - 40, y)
        await page.mouse.move(x, y, { steps: 4 })
        await delay(500)

        const hit = await hoveredRecord(page)
        assert(
          hit?.featureName === 'sv_inv_001',
          `lane hover named ${JSON.stringify(hit?.featureName)}`,
        )
        // a record, not a cell: no sample row, no genotype, and the record's own
        // alleles rather than a genotype's resolved pair
        assert(
          hit?.genotype === '' &&
            hit.name === '' &&
            hit.alleles === 'N > <INV>',
          `lane hover carried sample fields: ${JSON.stringify(hit)}`,
        )

        const tip = await tooltipText(page)
        assert(
          tip.includes('sv_inv_001') && tip.includes('<INV>'),
          `tooltip did not report the record: ${tip}`,
        )

        // the hover box has to land on the mark under the cursor, not merely
        // exist — it is drawn from the box the LAYOUT placed, so this is also
        // what pins the pick to the same stack the band painted
        const box = await boxOf(
          page,
          '[data-testid="variant_lane_hover_highlight"]',
        )
        assert(
          x >= box.x - 1 && x <= box.x + box.width + 1,
          `hover box ${JSON.stringify(box)} does not contain the cursor x ${x}`,
        )

        // right-click reaches the record menu the genotype cells share
        await page.mouse.click(x, y, { button: 'right' })
        await delay(800)
        assert(
          await page.evaluate(() =>
            document.body.textContent.includes('Open feature details'),
          ),
          'right-clicking a lane mark did not open the record menu',
        )
        await page.keyboard.press('Escape')
        await delay(500)

        await page.mouse.move(x, y, { steps: 2 })
        await delay(300)
        await page.mouse.click(x, y)
        await delay(2500)
        assert(
          await page.evaluate(() =>
            document.body.textContent.includes('Feature details'),
          ),
          'clicking a lane mark did not open the feature details widget',
        )

        // leaving the lane drops the hover and everything hanging off it
        await page.mouse.move(5, 5)
        await delay(500)
        assert(
          (await hoveredRecord(page)) === undefined &&
            !(await page.$('[data-testid="variant_lane_hover_highlight"]')),
          'the lane hover survived the pointer leaving it',
        )
      },
    },
    lgvSnapshotTest({
      name: 'assembly aliases VCF track',
      snapshot: 'variants-assembly-aliases',
      loc: 'ctgA:1..50,001',
      tracks: ['volvox_filtered_vcf_assembly_alias'],
    }),

    // The multi-sample display uses VIRTUAL scroll (fixed absolute canvas +
    // VerticalScrollbar overlay, everything positioned from model.scrollTop), so
    // the GPU cells and DOM hover highlight share one scroll source and can't
    // tear apart. Guarding the structure keeps it from regressing to a native
    // overflow container (the second coordinate space that caused the tearing),
    // and the outer TrackRenderingContainer must not itself be a scroll port.
    {
      name: 'multi-sample variant scrolls virtually (no native scroll container)',
      fn: async page => {
        await navigateWithSessionSpec(page, overflowingMultiSampleSpec)
        await findDisplayPainted(page, 'variant-display')
        await waitForDataLoaded(page)
        // an overflowing display renders the draggable VerticalScrollbar overlay
        await findByTestId(page, 'vertical-scrollbar')
        await assertVirtualScrollStructure(
          page,
          '[data-testid="variant_canvas"]',
        )
      },
    },
  ],
}

export default suite
