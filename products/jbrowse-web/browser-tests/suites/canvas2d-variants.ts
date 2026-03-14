import {
  delay,
  findByTestId,
  findByText,
  navigateWithSessionSpec,
  waitForCanvasRendered,
  waitForDataLoaded,
} from '../helpers.ts'
import { canvasSnapshot } from '../snapshot.ts'

import type { TestSuite } from '../types.ts'

const suite: TestSuite = {
  name: 'Canvas2D Variant and Multi-Track Rendering',
  tests: [
    {
      name: 'multi-sample VCF variant display renders',
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

        await page.waitForSelector('[data-testid^="display-"]', {
          timeout: 60000,
        })
        await waitForDataLoaded(page)
        await waitForCanvasRendered(page, '[data-testid^="display-"] canvas')
        await canvasSnapshot(
          page,
          'canvas2d-multisample-vcf',
          '[data-testid^="display-"] canvas',
        )
      },
    },
    {
      name: 'multi-sample SV variant display with population coloring',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1-50000',
              tracks: ['volvox multi-sample sv'],
            },
          ],
        })

        await page.waitForSelector('[data-testid^="display-"]', {
          timeout: 60000,
        })
        await waitForDataLoaded(page)
        await waitForCanvasRendered(page, '[data-testid^="display-"] canvas')
        await canvasSnapshot(
          page,
          'canvas2d-multisample-sv-population',
          '[data-testid^="display-"] canvas',
        )
      },
    },
    {
      name: 'wiggle display with positive/negative values renders',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1-50000',
              tracks: ['wiggle_track_posneg'],
            },
          ],
        })

        await findByTestId(page, 'wiggle-display', 60000)
        await waitForDataLoaded(page)
        await waitForCanvasRendered(
          page,
          '[data-testid="wiggle-display"] canvas',
        )
        await canvasSnapshot(
          page,
          'canvas2d-wiggle-posneg',
          '[data-testid="wiggle-display"] canvas',
        )
      },
    },
    {
      name: 'synteny view renders with Canvas 2D',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearSyntenyView',
              tracks: ['volvox_fake_synteny'],
              views: [
                { loc: 'ctgA:1-50000', assembly: 'volvox' },
                { loc: 'ctgA:1-50000', assembly: 'volvox' },
              ],
            },
          ],
        })

        await findByTestId(page, 'synteny_canvas', 60000)
        await waitForDataLoaded(page)
        await waitForCanvasRendered(page, '[data-testid="synteny_canvas"]')
        await canvasSnapshot(
          page,
          'canvas2d-synteny-volvox',
          '[data-testid="synteny_canvas"]',
        )
      },
    },
    {
      name: 'sequence track renders with Canvas 2D',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1-200',
              tracks: ['volvox_refseq'],
            },
          ],
        })

        await findByText(page, 'ctgA')
        await page.waitForSelector('[data-testid^="display-"]', {
          timeout: 60000,
        })
        await waitForDataLoaded(page)
        await waitForCanvasRendered(page, '[data-testid^="display-"] canvas')
        await canvasSnapshot(
          page,
          'canvas2d-sequence-track',
          '[data-testid^="display-"] canvas',
        )
      },
    },
    {
      name: 'multi-wiggle display renders',
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

        await findByTestId(page, 'multi-wiggle-display', 60000)
        await waitForDataLoaded(page)
        await waitForCanvasRendered(
          page,
          '[data-testid="multi-wiggle-display"] canvas',
        )
        await canvasSnapshot(
          page,
          'canvas2d-multiwiggle',
          '[data-testid="multi-wiggle-display"] canvas',
        )
      },
    },
    {
      name: 'multi-wiggle with positive/negative values renders',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1-50000',
              tracks: ['volvox_posneg_multi'],
            },
          ],
        })

        await findByTestId(page, 'multi-wiggle-display', 60000)
        await waitForDataLoaded(page)
        await waitForCanvasRendered(
          page,
          '[data-testid="multi-wiggle-display"] canvas',
        )
        await canvasSnapshot(
          page,
          'canvas2d-multiwiggle-posneg',
          '[data-testid="multi-wiggle-display"] canvas',
        )
      },
    },
    {
      name: 'multiple display types render together',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1-10000',
              tracks: [
                'volvox_filtered_vcf',
                'volvox_gc',
                'volvox_microarray_multi',
              ],
            },
          ],
        })

        await page.waitForFunction(
          () =>
            document.querySelectorAll('[data-testid^="display-"]').length >= 2,
          { timeout: 60000 },
        )
        await waitForDataLoaded(page)

        await waitForCanvasRendered(page, '[data-testid^="display-"] canvas')
        await canvasSnapshot(
          page,
          'canvas2d-mixed-tracks-combined',
          '[data-testid^="display-"] canvas',
        )
      },
    },
  ],
}

export default suite
