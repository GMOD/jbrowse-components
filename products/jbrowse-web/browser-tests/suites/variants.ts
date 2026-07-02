import {
  assertVirtualScrollStructure,
  findByTestId,
  navigateWithSessionSpec,
  waitForDataLoaded,
} from '../helpers.ts'
import { lgvSnapshotTest } from '../suiteHelpers.ts'

import type { TestSuite } from '../types.ts'

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

const suite: TestSuite = {
  name: 'Variants Track',
  tests: [
    // Renders the old pre-rename display type via the model's preProcessSnapshot
    // remap; if the union failed to resolve it, no canvas would ever paint.
    {
      name: 'old MultiLinearVariantDisplay type still renders (rename back-compat)',
      fn: async page => {
        await navigateWithSessionSpec(page, oldTypeNameSpec)
        await findByTestId(page, 'variant-display-done', 30000)
        await waitForDataLoaded(page)
        await findByTestId(page, 'variant_canvas')
      },
    },

    // colorBy:'population' + samplesTsvLocation end to end: the sample-metadata
    // TSV must parse, reach the display's sources, and drive the palette so
    // same-population rows share a color and different populations differ.
    {
      name: 'colorBy population colors sample rows from samplesTsv metadata',
      fn: async page => {
        await navigateWithSessionSpec(page, populationDemoSpec)
        await findByTestId(page, 'variant-display-done', 30000)
        await waitForDataLoaded(page)
        const info = await page.evaluate(() => {
          interface Src {
            name: string
            population?: string
            color?: string
          }
          const session = (
            window as unknown as {
              JBrowseSession: {
                views: { tracks: { displays: { colorBy: string; sources?: Src[] }[] }[] }[]
              }
            }
          ).JBrowseSession
          const display = session.views[0]!.tracks[0]!.displays[0]!
          return {
            colorBy: display.colorBy,
            sources: (display.sources ?? []).map(s => ({
              name: s.name,
              population: s.population,
              color: s.color,
            })),
          }
        })
        if (info.colorBy !== 'population') {
          throw new Error(`expected colorBy 'population', got '${info.colorBy}'`)
        }
        if (info.sources.length === 0) {
          throw new Error('no sample sources loaded from samplesTsv')
        }
        // every source carries a population attribute and a resolved color
        const missing = info.sources.filter(s => !s.population || !s.color)
        if (missing.length) {
          throw new Error(
            `sources missing population/color: ${JSON.stringify(missing.slice(0, 3))}`,
          )
        }
        // one color per population: same pop => same color, and >1 distinct color
        const colorByPop = new Map<string, string>()
        for (const s of info.sources) {
          const prev = colorByPop.get(s.population!)
          if (prev && prev !== s.color) {
            throw new Error(
              `population ${s.population} has two colors: ${prev} vs ${s.color}`,
            )
          }
          colorByPop.set(s.population!, s.color!)
        }
        if (new Set(colorByPop.values()).size < 2) {
          throw new Error('expected multiple populations to get distinct colors')
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
        await findByTestId(
          page,
          'display-volvox_filtered_vcf-LinearVariantDisplay-done',
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
        await findByTestId(page, 'variant-display-done')
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
