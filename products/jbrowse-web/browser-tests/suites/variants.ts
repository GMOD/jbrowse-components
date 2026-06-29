import {
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
            heightOverride: 200,
          },
        },
      ],
    },
  ],
}

const suite: TestSuite = {
  name: 'Variants Track',
  tests: [
    lgvSnapshotTest({
      name: 'assembly aliases VCF track',
      snapshot: 'variants-assembly-aliases',
      loc: 'ctgA:1..50,001',
      tracks: ['volvox_filtered_vcf_assembly_alias'],
    }),

    // The plain multi-sample variant display scrolls in its own native
    // overflow container (sticky canvas), and the outer TrackRenderingContainer
    // must NOT be a scroll port — otherwise both render a scrollbar. See the
    // "no pinned top band -> native scroll" rule in VariantComponent.tsx.
    {
      name: 'multi-sample variant scrolls natively without a second scrollbar',
      fn: async page => {
        await navigateWithSessionSpec(page, overflowingMultiSampleSpec)
        await findByTestId(page, 'variant-display-done')
        await waitForDataLoaded(page)

        const checks = await page.evaluate(() => {
          const css = (el: Element, p: string) =>
            getComputedStyle(el).getPropertyValue(p)
          const outer = document.querySelector(
            '[data-testid^="trackRenderingContainer"]',
          )
          const canvas = document.querySelector(
            '[data-testid="variant_canvas"]',
          )
          const scrollContainer = canvas?.parentElement?.parentElement ?? null
          return {
            outerOverflowY: outer ? css(outer, 'overflow-y') : null,
            outerOverflows: outer
              ? outer.scrollHeight > outer.clientHeight
              : null,
            canvasPosition: canvas ? css(canvas, 'position') : null,
            innerOverflowY: scrollContainer
              ? css(scrollContainer, 'overflow-y')
              : null,
            innerOverflows: scrollContainer
              ? scrollContainer.scrollHeight > scrollContainer.clientHeight
              : null,
          }
        })

        // outer container is not a scroll port (a spurious second scrollbar)
        if (checks.outerOverflowY !== 'hidden') {
          throw new Error(
            `outer TrackRenderingContainer overflow-y expected 'hidden', got '${checks.outerOverflowY}'`,
          )
        }
        if (checks.outerOverflows) {
          throw new Error(
            'outer TrackRenderingContainer is overflowing — spurious native scrollbar',
          )
        }
        // the display owns one native scroll container with a sticky canvas
        if (checks.canvasPosition !== 'sticky') {
          throw new Error(
            `variant canvas position expected 'sticky', got '${checks.canvasPosition}'`,
          )
        }
        if (checks.innerOverflowY !== 'auto') {
          throw new Error(
            `variant scroll container overflow-y expected 'auto', got '${checks.innerOverflowY}'`,
          )
        }
        if (!checks.innerOverflows) {
          throw new Error(
            'variant scroll container is not overflowing — the pinned rowHeight should exceed the viewport',
          )
        }
      },
    },
  ],
}

export default suite
