import {
  findByText,
  navigateWithSessionSpec,
  waitForCanvasRendered,
  waitForDataLoaded,
} from '../helpers.ts'
import { canvasSnapshot } from '../snapshot.ts'

import type { TestSuite } from '../types.ts'

const suite: TestSuite = {
  name: 'Additional Track Types',
  tests: [
    {
      name: 'lollipop track renders',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1-50000',
              tracks: ['lollipop_track'],
            },
          ],
        })

        await findByText(page, 'ctgA')
        await waitForDataLoaded(page)
        await page.waitForSelector('[data-testid^="display-"] canvas', {
          timeout: 60000,
        })
        await waitForCanvasRendered(page, '[data-testid^="display-"] canvas')
        await canvasSnapshot(
          page,
          'additional-lollipop-canvas',
          '[data-testid^="display-"] canvas',
        )
      },
    },
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

        await page.waitForSelector('[data-testid^="display-"] canvas', {
          timeout: 60000,
        })
        await waitForDataLoaded(page)
        await waitForCanvasRendered(page, '[data-testid^="display-"] canvas')
        await canvasSnapshot(
          page,
          'additional-bed-genes-canvas',
          '[data-testid^="display-"] canvas',
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

        await page.waitForSelector('[data-testid^="display-"] canvas', {
          timeout: 60000,
        })
        await waitForDataLoaded(page)
        await waitForCanvasRendered(page, '[data-testid^="display-"] canvas')
        await canvasSnapshot(
          page,
          'additional-bigbed-genes-canvas',
          '[data-testid^="display-"] canvas',
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

        await page.waitForSelector('[data-testid^="display-"] canvas', {
          timeout: 60000,
        })
        await waitForDataLoaded(page)
        await waitForCanvasRendered(page, '[data-testid^="display-"] canvas')
        await canvasSnapshot(
          page,
          'additional-density-wiggle-canvas',
          '[data-testid^="display-"] canvas',
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

        await page.waitForSelector('[data-testid^="display-"] canvas', {
          timeout: 60000,
        })
        await waitForDataLoaded(page)
        await waitForCanvasRendered(page, '[data-testid^="display-"] canvas')
        await canvasSnapshot(
          page,
          'additional-line-wiggle-canvas',
          '[data-testid^="display-"] canvas',
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

        await page.waitForSelector('[data-testid^="display-"] canvas', {
          timeout: 60000,
        })
        await waitForDataLoaded(page)
        await waitForCanvasRendered(page, '[data-testid^="display-"] canvas')
        await canvasSnapshot(
          page,
          'additional-color-wiggle-canvas',
          '[data-testid^="display-"] canvas',
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

        await page.waitForSelector('[data-testid^="display-"] canvas', {
          timeout: 60000,
        })
        await waitForDataLoaded(page)
        await waitForCanvasRendered(page, '[data-testid^="display-"] canvas')
        await canvasSnapshot(
          page,
          'additional-multisample-vcf-canvas',
          '[data-testid^="display-"] canvas',
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

        await page.waitForSelector('[data-testid^="display-"] canvas', {
          timeout: 60000,
        })
        await waitForDataLoaded(page)
        await waitForCanvasRendered(page, '[data-testid^="display-"] canvas')
        await canvasSnapshot(
          page,
          'additional-sv-vcf-canvas',
          '[data-testid^="display-"] canvas',
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

        await page.waitForSelector('[data-testid^="display-"] canvas', {
          timeout: 60000,
        })
        await waitForDataLoaded(page)
        await waitForCanvasRendered(page, '[data-testid^="display-"] canvas')
        await canvasSnapshot(
          page,
          'additional-fractional-posneg-canvas',
          '[data-testid^="display-"] canvas',
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
              loc: 'ctgA:1-50000',
              tracks: ['variant_colors'],
            },
          ],
        })

        await page.waitForSelector('[data-testid^="display-"] canvas', {
          timeout: 60000,
        })
        await waitForDataLoaded(page)
        await waitForCanvasRendered(page, '[data-testid^="display-"] canvas')
        await canvasSnapshot(
          page,
          'additional-variant-colors-canvas',
          '[data-testid^="display-"] canvas',
        )
      },
    },
  ],
}

export default suite
