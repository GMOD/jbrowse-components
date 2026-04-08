import { navigateWithSessionSpec, waitForDataLoaded } from '../helpers.ts'
import { canvasSnapshot } from '../snapshot.ts'

import type { TestSuite } from '../types.ts'

const suite: TestSuite = {
  name: 'Additional Track Types',
  tests: [
    {
      name: 'BED genes track renders',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:907..15319',
              tracks: ['bed_genes'],
            },
          ],
        })

        await page.waitForSelector('[data-testid$="-done"] canvas', {
          timeout: 60000,
        })
        await waitForDataLoaded(page)
        await canvasSnapshot(
          page,
          'additional-bed-genes-canvas',
          '[data-testid$="-done"] canvas',
        )
      },
    },
    {
      name: 'BigBed genes track renders',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:907..15319',
              tracks: ['bigbed_genes'],
            },
          ],
        })

        await page.waitForSelector('[data-testid$="-done"] canvas', {
          timeout: 60000,
        })
        await waitForDataLoaded(page)
        await canvasSnapshot(
          page,
          'additional-bigbed-genes-canvas',
          '[data-testid$="-done"] canvas',
        )
      },
    },
    {
      name: 'density wiggle track renders',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1-50000',
              tracks: ['volvox_microarray_density'],
            },
          ],
        })

        await page.waitForSelector('[data-testid$="-done"] canvas', {
          timeout: 60000,
        })
        await waitForDataLoaded(page)
        await canvasSnapshot(
          page,
          'additional-density-wiggle-canvas',
          '[data-testid$="-done"] canvas',
        )
      },
    },
    {
      name: 'line wiggle track renders',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1-50000',
              tracks: ['volvox_microarray_line'],
            },
          ],
        })

        await page.waitForSelector('[data-testid$="-done"] canvas', {
          timeout: 60000,
        })
        await waitForDataLoaded(page)
        await canvasSnapshot(
          page,
          'additional-line-wiggle-canvas',
          '[data-testid$="-done"] canvas',
        )
      },
    },
    {
      name: 'colored wiggle track renders',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1-50000',
              tracks: ['volvox_microarray_color'],
            },
          ],
        })

        await page.waitForSelector('[data-testid$="-done"] canvas', {
          timeout: 60000,
        })
        await waitForDataLoaded(page)
        await canvasSnapshot(
          page,
          'additional-color-wiggle-canvas',
          '[data-testid$="-done"] canvas',
        )
      },
    },
    {
      name: 'multi-sample VCF variant track renders',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1-50000',
              tracks: ['volvox_test_vcf'],
            },
          ],
        })

        await page.waitForSelector('[data-testid$="-done"] canvas', {
          timeout: 60000,
        })
        await waitForDataLoaded(page)
        await canvasSnapshot(
          page,
          'additional-multisample-vcf-canvas',
          '[data-testid$="-done"] canvas',
        )
      },
    },
    {
      name: 'structural variant VCF track renders',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1-50000',
              tracks: ['volvox_sv_test'],
            },
          ],
        })

        await page.waitForSelector('[data-testid$="-done"] canvas', {
          timeout: 60000,
        })
        await waitForDataLoaded(page)
        await canvasSnapshot(
          page,
          'additional-sv-vcf-canvas',
          '[data-testid$="-done"] canvas',
        )
      },
    },
    {
      name: 'fractional positive/negative wiggle track renders',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1-50000',
              tracks: ['wiggle_track_fractional_posneg'],
            },
          ],
        })

        await page.waitForSelector('[data-testid$="-done"] canvas', {
          timeout: 60000,
        })
        await waitForDataLoaded(page)
        await canvasSnapshot(
          page,
          'additional-fractional-posneg-canvas',
          '[data-testid$="-done"] canvas',
        )
      },
    },
    {
      name: 'variant effect annotation track renders',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1-800',
              tracks: ['variant_colors'],
            },
          ],
        })

        await page.waitForSelector('[data-testid$="-done"] canvas', {
          timeout: 60000,
        })
        await waitForDataLoaded(page)
        await canvasSnapshot(
          page,
          'additional-variant-colors-canvas',
          '[data-testid$="-done"] canvas',
        )
      },
    },
  ],
}

export default suite
