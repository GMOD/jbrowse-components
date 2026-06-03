import {
  findByTestId,
  navigateWithSessionSpec,
  waitForDataLoaded,
} from '../helpers.ts'
import { dualSnapshot } from '../snapshot.ts'

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

        await findByTestId(page, 'pileup-display-done', 60000)
        await waitForDataLoaded(page)
        await dualSnapshot(
          page,
          'long-reads-bam-canvas',
          '[data-testid="pileup-display-done"] canvas',
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

        await findByTestId(page, 'pileup-display-done', 60000)
        await waitForDataLoaded(page)
        await dualSnapshot(
          page,
          'long-reads-cram-canvas',
          '[data-testid="pileup-display-done"] canvas',
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

        await findByTestId(page, 'pileup-display-done', 60000)
        await waitForDataLoaded(page)
        await dualSnapshot(
          page,
          'inversion-simple-bam-canvas',
          '[data-testid="pileup-display-done"] canvas',
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

        await findByTestId(page, 'pileup-display-done', 60000)
        await waitForDataLoaded(page)
        await dualSnapshot(
          page,
          'inversion-simple-cram-canvas',
          '[data-testid="pileup-display-done"] canvas',
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

        await page.waitForSelector('[data-testid$="-done"] canvas', {
          timeout: 60000,
        })
        await waitForDataLoaded(page)
        await dualSnapshot(
          page,
          'inversion-indels-canvas',
          '[data-testid$="-done"] canvas',
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

        await findByTestId(page, 'pileup-display-done', 60000)
        await waitForDataLoaded(page)
        await dualSnapshot(
          page,
          'inversion-pbsim-canvas',
          '[data-testid="pileup-display-done"] canvas',
        )
      },
    },
    {
      name: 'inversion pbsim with linked reads and arcs',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1-50000',
              tracks: [
                {
                  trackId: 'volvox-inv-pbsim',
                  displaySnapshot: {
                    showBezierConnections: true,
                    readConnections: 'arc',
                  },
                },
              ],
            },
          ],
        })

        await findByTestId(page, 'pileup-display-done', 60000)
        await waitForDataLoaded(page)
        await dualSnapshot(
          page,
          'inversion-pbsim-linked-canvas',
          '[data-testid="pileup-display-done"] canvas',
        )
      },
    },
    {
      name: 'simple inversion BAM with linked reads and arcs',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1-50000',
              tracks: [
                {
                  trackId: 'volvox-simple-inv.bam',
                  displaySnapshot: {
                    showBezierConnections: true,
                    readConnections: 'arc',
                  },
                },
              ],
            },
          ],
        })

        await findByTestId(page, 'pileup-display-done', 60000)
        await waitForDataLoaded(page)
        await dualSnapshot(
          page,
          'inversion-simple-bam-linked-canvas',
          '[data-testid="pileup-display-done"] canvas',
        )
      },
    },
    {
      name: 'inversion paired BAM coverage-only',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1-50000',
              tracks: [
                {
                  trackId: 'volvox-simple-inv-paired.bam',
                  displaySnapshot: {
                    height: 45,
                    showCoverage: true,
                    coverageHeight: 45,
                  },
                },
              ],
            },
          ],
        })

        await findByTestId(page, 'pileup-display-done', 60000)
        await waitForDataLoaded(page)
        await dualSnapshot(
          page,
          'inversion-paired-coverage-canvas',
          '[data-testid="pileup-display-done"] canvas',
        )
      },
    },
    {
      name: 'inversion pbsim coverage-only',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1-50000',
              tracks: [
                {
                  trackId: 'volvox-inv-pbsim',
                  displaySnapshot: {
                    height: 45,
                    showCoverage: true,
                    coverageHeight: 45,
                  },
                },
              ],
            },
          ],
        })

        await findByTestId(page, 'pileup-display-done', 60000)
        await waitForDataLoaded(page)
        await dualSnapshot(
          page,
          'inversion-pbsim-coverage-canvas',
          '[data-testid="pileup-display-done"] canvas',
        )
      },
    },
    {
      name: 'simple inversion paired BAM samplot',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1-50000',
              tracks: [
                {
                  trackId: 'volvox-simple-inv-paired.bam',
                  displaySnapshot: {
                    readConnections: 'samplot',
                    configOverrides: { colorBy: { type: 'pairOrientation' } },
                  },
                },
              ],
            },
          ],
        })

        await findByTestId(page, 'pileup-display-done', 60000)
        await waitForDataLoaded(page)
        await dualSnapshot(
          page,
          'inversion-paired-samplot-canvas',
          '[data-testid="pileup-display-done"] canvas',
        )
      },
    },
  ],
}

export default suite
