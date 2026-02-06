import {
  delay,
  findByTestId,
  navigateToApp,
  navigateWithSessionSpec,
  openTrack,
  waitForLoadingToComplete,
} from '../helpers.ts'
import { snapshot } from '../snapshot.ts'

import type { TestSuite } from '../types.ts'

const suite: TestSuite = {
  name: 'Alignments Track',
  tests: [
    {
      name: 'loads BAM track',
      fn: async page => {
        await navigateToApp(page)
        await openTrack(page, 'volvox_alignments')
        await findByTestId(page, 'Blockset-pileup', 60000)
      },
    },
    {
      name: 'loads CRAM track',
      fn: async page => {
        await navigateToApp(page)
        await openTrack(page, 'volvox_cram_alignments')
        await findByTestId(page, 'Blockset-pileup', 60000)
      },
    },
    {
      name: 'BAM track screenshot',
      fn: async page => {
        await navigateToApp(page)
        await openTrack(page, 'volvox_alignments')
        await findByTestId(page, 'Blockset-pileup', 60000)
        await waitForLoadingToComplete(page)
        await snapshot(page, 'alignments-bam')
      },
    },
    {
      name: 'volvox_sv track screenshot',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:2,707..48,600',
              tracks: ['volvox_sv'],
            },
          ],
        })

        await findByTestId(page, 'cloud-canvas', 60000)
        await waitForLoadingToComplete(page)
        await snapshot(page, 'alignments-volvox-sv')
      },
    },
    {
      name: 'pileup + coverage track',
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
        await snapshot(page, 'alignments-pileup-coverage')
      },
    },
  ],
}

export default suite
