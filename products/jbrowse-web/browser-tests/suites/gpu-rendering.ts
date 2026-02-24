import {
  delay,
  findByTestId,
  navigateWithSessionSpec,
  waitForLoadingToComplete,
} from '../helpers.ts'
import { canvasSnapshot } from '../snapshot.ts'

import type { TestSuite } from '../types.ts'

const suite: TestSuite = {
  name: 'GPU Rendering',
  tests: [
    {
      name: 'Wiggle GC content',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:39,433..39,804',
              tracks: ['volvox_gc'],
            },
          ],
        })
        await findByTestId(page, 'wiggle-rendering-test', 60000)
        await waitForLoadingToComplete(page)
        await delay(1000)
        await canvasSnapshot(
          page,
          'gpu-wiggle-gc-content',
          '[data-testid="wiggle-rendering-test"] canvas',
        )
      },
    },
    {
      name: 'Sequence display',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1..200',
              tracks: ['volvox_refseq'],
            },
          ],
        })
        await page.waitForSelector('[data-testid^="prerendered_canvas"]', {
          timeout: 60000,
        })
        await waitForLoadingToComplete(page)
        await delay(1000)
        await canvasSnapshot(
          page,
          'gpu-sequence-display',
          '[data-testid^="prerendered_canvas"]',
        )
      },
    },
    {
      name: 'Variant track',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:2,849..3,099',
              tracks: ['volvox_filtered_vcf_assembly_alias'],
            },
          ],
        })
        await page.waitForSelector('[data-testid^="prerendered_canvas"]', {
          timeout: 60000,
        })
        await waitForLoadingToComplete(page)
        await delay(1000)
        await canvasSnapshot(
          page,
          'gpu-variant-track',
          '[data-testid^="prerendered_canvas"]',
        )
      },
    },
    {
      name: 'Alignments pileup',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1-4000',
              tracks: ['volvox_alignments_pileup_coverage'],
            },
          ],
        })
        await findByTestId(page, 'Blockset-pileup', 60000)
        await waitForLoadingToComplete(page)
        await delay(1000)
        await canvasSnapshot(
          page,
          'gpu-alignments-pileup',
          '[data-testid="Blockset-pileup"] canvas',
        )
      },
    },
    {
      name: 'MultiBigWig xyplot',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1-4000',
              tracks: ['volvox_microarray_multi'],
            },
          ],
        })
        await page.waitForSelector(
          '[data-testid^="trackRenderingContainer"] canvas',
          { timeout: 60000 },
        )
        await waitForLoadingToComplete(page)
        await delay(3000)
        await canvasSnapshot(
          page,
          'gpu-multibigwig-xyplot',
          '[data-testid^="trackRenderingContainer"] canvas',
        )
      },
    },
  ],
}

export default suite
