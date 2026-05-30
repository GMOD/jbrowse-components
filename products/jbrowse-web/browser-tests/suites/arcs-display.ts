import {
  findByTestId,
  findByText,
  navigateWithSessionSpec,
  waitForDataLoaded,
} from '../helpers.ts'
import { dualSnapshot, pageSnapshot } from '../snapshot.ts'

import type { TestSuite } from '../types.ts'

const suite: TestSuite = {
  name: 'Arcs and BEDPE Displays',
  tests: [
    {
      name: 'arc track renders',
      fn: async page => {
        // arc_track uses LinearArcDisplay (SVG renderer) with features at
        // ctgA:180-290; navigate close enough to see arcs clearly
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:150-350',
              tracks: ['arc_track'],
            },
          ],
        })

        await findByText(page, 'ctgA')
        await waitForDataLoaded(page)
        await pageSnapshot(page, 'arcs-arc-test')
      },
    },
    {
      name: 'read connections arcs (volvox_sv)',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:2,707..48,600',
              tracks: [
                {
                  trackId: 'volvox_sv',
                  displaySnapshot: {
                    type: 'LinearAlignmentsDisplay',
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
          'arcs-read-connections-canvas',
          '[data-testid="pileup-display-done"] canvas',
        )
      },
    },
    {
      name: 'RNA-seq sashimi arcs (spliced alignments)',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1-10000',
              tracks: ['spliced'],
            },
          ],
        })

        await findByTestId(page, 'pileup-display-done', 60000)
        await waitForDataLoaded(page)
        await dualSnapshot(
          page,
          'arcs-rnaseq-sashimi-canvas',
          '[data-testid="pileup-display-done"] canvas',
        )
      },
    },
    {
      name: 'samplot mode (paired-end SV)',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1-50000',
              tracks: [
                {
                  trackId: 'volvox_sv_cram',
                  displaySnapshot: {
                    type: 'LinearAlignmentsDisplay',
                    pairedArcs: 'samplot',
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
          'arcs-samplot-canvas',
          '[data-testid="pileup-display-done"] canvas',
        )
      },
    },
    {
      name: 'samplot down mode (paired-end SV, scalebar left)',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1-50000',
              tracks: [
                {
                  trackId: 'volvox_sv_cram',
                  displaySnapshot: {
                    type: 'LinearAlignmentsDisplay',
                    readConnections: 'samplot',
                    readConnectionsDown: true,
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
          'arcs-samplot-down-canvas',
          '[data-testid="pileup-display-done"] canvas',
        )
      },
    },
    {
      name: 'paired-end stranded RNA-seq',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1-10000',
              tracks: ['paired_end_stranded_rnaseq'],
            },
          ],
        })

        await findByTestId(page, 'pileup-display-done', 60000)
        await waitForDataLoaded(page)
        await dualSnapshot(
          page,
          'arcs-paired-end-rnaseq-canvas',
          '[data-testid="pileup-display-done"] canvas',
        )
      },
    },
  ],
}

export default suite
