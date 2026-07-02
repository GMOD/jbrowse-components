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

const suite: TestSuite = {
  name: 'Variants Track',
  tests: [
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
