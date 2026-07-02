import {
  assertOverlayScrollLockedToCanvas,
  delay,
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

const suite: TestSuite = {
  name: 'Variants Track',
  tests: [
    // Regression guard for the "variants separated from their labels" tear
    // (ScrollLockedOverlay): the plain LinearVariantDisplay label overlay must
    // track model.scrollTop like the sticky GPU canvas, not ride native scroll.
    // See assertOverlayScrollLockedToCanvas for the mechanism.
    {
      name: 'variant labels stay locked to the canvas during scroll',
      fn: async page => {
        await navigateWithSessionSpec(page, overflowingPlainVariantSpec)
        await findByTestId(
          page,
          'display-volvox_filtered_vcf-LinearVariantDisplay-done',
        )
        await waitForDataLoaded(page)
        // clickable label divs carry data-testid="feature-<kind>-<text>"
        await assertOverlayScrollLockedToCanvas(
          page,
          'canvas',
          '[data-testid^="feature-"]',
        )
      },
    },

    // Same guard for the OTHER native-overflow GPU display: the multi-sample
    // hover-highlight cell (a separate component using the same primitive).
    {
      name: 'multi-sample hover highlight stays locked to the canvas during scroll',
      fn: async page => {
        await navigateWithSessionSpec(page, overflowingMultiSampleSpec)
        await findByTestId(page, 'variant-display-done')
        await waitForDataLoaded(page)
        // hover a cell so the highlight overlay renders
        const box = await page.evaluate(() => {
          const c = document.querySelector('[data-testid="variant_canvas"]')!
          const r = c.getBoundingClientRect()
          return { x: r.x + r.width / 2, y: r.y + 60 }
        })
        await page.mouse.move(box.x, box.y)
        await delay(500)
        await assertOverlayScrollLockedToCanvas(
          page,
          '[data-testid="variant_canvas"]',
          'div[style*="rgba(255, 255, 255"]',
        )
      },
    },

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
