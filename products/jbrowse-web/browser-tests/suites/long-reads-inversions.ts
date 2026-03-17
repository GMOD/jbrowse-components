import {
  findByTestId,
  navigateWithSessionSpec,
  waitForCanvasRendered,
  waitForDataLoaded,
} from '../helpers.ts'
import { canvasSnapshot } from '../snapshot.ts'

import type { TestSuite } from '../types.ts'

const suite: TestSuite = {
  name: 'Long Reads and Inversions',
  tests: [
    {
      name: 'long reads BAM rendering',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1-10000',
              tracks: ['volvox-long-reads-bam'],
            },
          ],
        })

        await findByTestId(page, 'pileup-display', 60000)
        await waitForDataLoaded(page)
        await waitForCanvasRendered(
          page,
          '[data-testid="pileup-display"] canvas',
        )
        await canvasSnapshot(
          page,
          'long-reads-bam-canvas',
          '[data-testid="pileup-display"] canvas',
        )
      },
    },
    {
      name: 'long reads CRAM rendering',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1-10000',
              tracks: ['volvox-long-reads-cram'],
            },
          ],
        })

        await findByTestId(page, 'pileup-display', 60000)
        await waitForDataLoaded(page)
        await waitForCanvasRendered(
          page,
          '[data-testid="pileup-display"] canvas',
        )
        await canvasSnapshot(
          page,
          'long-reads-cram-canvas',
          '[data-testid="pileup-display"] canvas',
        )
      },
    },
    {
      name: 'simple inversion BAM rendering',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1-50000',
              tracks: ['volvox-simple-inv.bam'],
            },
          ],
        })

        await findByTestId(page, 'pileup-display', 60000)
        await waitForDataLoaded(page)
        await waitForCanvasRendered(
          page,
          '[data-testid="pileup-display"] canvas',
        )
        await canvasSnapshot(
          page,
          'inversion-simple-bam-canvas',
          '[data-testid="pileup-display"] canvas',
        )
      },
    },
    {
      name: 'simple inversion CRAM rendering',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1-50000',
              tracks: ['volvox-simple-inv.cram'],
            },
          ],
        })

        await findByTestId(page, 'pileup-display', 60000)
        await waitForDataLoaded(page)
        await waitForCanvasRendered(
          page,
          '[data-testid="pileup-display"] canvas',
        )
        await canvasSnapshot(
          page,
          'inversion-simple-cram-canvas',
          '[data-testid="pileup-display"] canvas',
        )
      },
    },
    {
      name: 'inversion with indels rendering',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1-50000',
              tracks: ['volvox_inv_indels'],
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
          'inversion-indels-canvas',
          '[data-testid^="display-"] canvas',
        )
      },
    },
    {
      name: 'inversion pbsim simulation rendering',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1-50000',
              tracks: ['volvox-inv-pbsim'],
            },
          ],
        })

        await findByTestId(page, 'pileup-display', 60000)
        await waitForDataLoaded(page)
        await waitForCanvasRendered(
          page,
          '[data-testid="pileup-display"] canvas',
        )
        await canvasSnapshot(
          page,
          'inversion-pbsim-canvas',
          '[data-testid="pileup-display"] canvas',
        )
      },
    },
  ],
}

export default suite
