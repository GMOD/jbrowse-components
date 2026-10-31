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
            type: 'LinearVariantDisplay',
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
          displaySnapshot: {
            type: 'LinearVariantDisplay',
            height: 40,
            heightMode: 'fixed',
          },
        },
      ],
    },
  ],
}

// Back-compat: v4's multi-sample display, MultiLinearVariantDisplay, is a
// retired type of LinearVariantDisplay. An old saved session stores the
// pre-rename type on the active display instance; the alias must remap it so
// the dispatcher-less `displays` union still resolves and the display renders. The demo track carries samplesTsvLocation +
// rowColor:'population' + referenceDrawingMode, so this also exercises the
// metadata-preloading path end to end. `volvox_test_vcf` has genotypes and
// resolves through the same model.
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

    // rowColor:'population' + samplesTsvLocation end to end: the sample-metadata
    // TSV must parse, reach the display's sources, and drive the palette so
    // same-population rows share a color and different populations differ.
    // The color is `rowColor`, which tree-sidebar draws a row's label bar in.
    {
      name: 'rowColor population colors sample rows from samplesTsv metadata',
      fn: async page => {
        await navigateWithSessionSpec(page, populationDemoSpec)
        await findDisplayPainted(page, 'variant-display', 30000)
        await waitForDataLoaded(page)
        const info = await page.evaluate(() => {
          interface Src {
            name: string
            population?: string
            rowColor?: string
          }
          const session = (
            window as unknown as {
              JBrowseSession: {
                views: {
                  tracks: {
                    displays: { rowColorField: string; sources?: Src[] }[]
                  }[]
                }[]
              }
            }
          ).JBrowseSession
          const display = session.views[0]!.tracks[0]!.displays[0]!
          return {
            rowColorField: display.rowColorField,
            sources: (display.sources ?? []).map(s => ({
              name: s.name,
              population: s.population,
              rowColor: s.rowColor,
            })),
          }
        })
        if (info.rowColorField !== 'population') {
          throw new Error(
            `expected rowColor.field 'population', got '${info.rowColorField}'`,
          )
        }
        if (info.sources.length === 0) {
          throw new Error('no sample sources loaded from samplesTsv')
        }
        // every source carries a population attribute and a resolved tint
        const missing = info.sources.filter(s => !s.population || !s.rowColor)
        if (missing.length) {
          throw new Error(
            `sources missing population/rowColor: ${JSON.stringify(missing.slice(0, 3))}`,
          )
        }
        // one color per population: same pop => same color, and >1 distinct color
        const colorByPop = new Map<string, string>()
        for (const s of info.sources) {
          const prev = colorByPop.get(s.population!)
          if (prev && prev !== s.rowColor) {
            throw new Error(
              `population ${s.population} has two colors: ${prev} vs ${s.rowColor}`,
            )
          }
          colorByPop.set(s.population!, s.rowColor!)
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

    lgvSnapshotTest({
      name: 'assembly aliases VCF track',
      snapshot: 'variants-assembly-aliases',
      loc: 'ctgA:1..50,001',
      tracks: ['volvox_filtered_vcf_assembly_alias'],
    }),

    // The variant display uses VIRTUAL scroll (fixed absolute canvas +
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
    {
      // volvox_filtered_vcf's first record is T>C at ctgA:277, and the BAM
      // names the contig as the view does, so the sort is at 0-based 276
      name: 'right-clicking a variant sorts the reads beside it at that variant',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:227-327',
              tracks: ['volvox_filtered_vcf', 'volvox_bam'],
            },
          ],
        })
        await waitForDataLoaded(page)
        const selector = '[data-display-id^="volvox_filtered_vcf"]'
        await page.waitForSelector(selector)
        const box = await boxOf(page, selector)
        const x = await page.evaluate(() => {
          const view = (
            window as unknown as {
              JBrowseSession: {
                views: {
                  bpToPx: (arg: object) => { offsetPx: number }
                  offsetPx: number
                }[]
              }
            }
          ).JBrowseSession.views[0]!
          return (
            view.bpToPx({ refName: 'ctgA', coord: 276.5 }).offsetPx -
            view.offsetPx
          )
        })
        let opened = false
        for (const dy of [6, 10, 14, 18]) {
          await page.mouse.click(box.x + x, box.y + dy, { button: 'right' })
          await delay(800)
          opened = await page.evaluate(() =>
            document.body.textContent.includes('Sort reads at this variant'),
          )
          if (opened) {
            break
          }
          await page.keyboard.press('Escape')
          await delay(300)
        }
        assert(
          opened,
          'the variant menu offered no "Sort reads at this variant"',
        )
        await page.evaluate(() => {
          const item = [...document.querySelectorAll('[role="menuitem"]')].find(
            m => m.textContent === 'Sort reads at this variant',
          ) as HTMLElement
          item.click()
        })
        await page.waitForFunction(
          () => {
            const { views } = (
              window as unknown as {
                JBrowseSession: {
                  views: {
                    tracks: {
                      displays: {
                        sortColumn?: {
                          field: string
                          pos: number
                          refName: string
                        }
                      }[]
                    }[]
                  }[]
                }
              }
            ).JBrowseSession
            const sort = views[0]!.tracks[1]!.displays[0]!.sortColumn
            return (
              sort?.field === 'base' &&
              sort.pos === 276 &&
              sort.refName === 'ctgA'
            )
          },
          { timeout: 15000 },
        )
      },
    },
  ],
}

export default suite
