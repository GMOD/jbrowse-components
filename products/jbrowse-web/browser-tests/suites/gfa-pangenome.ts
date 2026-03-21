import {
  delay,
  findByTestId,
  navigateWithSessionSpec,
  waitForDataLoaded,
} from '../helpers.ts'
import { canvasSnapshot, pageSnapshot } from '../snapshot.ts'

import type { TestSuite } from '../types.ts'

const config = 'test_data/config_gfa_pangenome.json'

const suite: TestSuite = {
  name: 'GFA Pangenome Multi-LGV Synteny',
  tests: [
    {
      name: 'GFA pangenome with precomputed aln.bed.gz shows CIGAR variants',
      fn: async page => {
        await navigateWithSessionSpec(
          page,
          {
            views: [
              {
                type: 'LinearGenomeView',
                assembly: 'ref#1',
                loc: 'chr1:1-555',
                tracks: [
                  {
                    trackId: 'volvox_pangenome_gfa',
                    displaySnapshot: { type: 'MultiLGVSyntenyDisplay' },
                  },
                ],
              },
            ],
          },
          config,
        )

        await findByTestId(page, 'multi_synteny_canvas', 60000)
        await waitForDataLoaded(page)
        await delay(2000)
        await canvasSnapshot(
          page,
          'gfa-pangenome-aln-cigar-canvas',
          '[data-testid="multi_synteny_canvas"]',
        )
      },
    },
    {
      name: 'GFA pangenome without aln falls back to runtime CIGAR',
      fn: async page => {
        await navigateWithSessionSpec(
          page,
          {
            views: [
              {
                type: 'LinearGenomeView',
                assembly: 'ref#1',
                loc: 'chr1:1-555',
                tracks: [
                  {
                    trackId: 'volvox_pangenome_gfa_no_aln',
                    displaySnapshot: { type: 'MultiLGVSyntenyDisplay' },
                  },
                ],
              },
            ],
          },
          config,
        )

        await findByTestId(page, 'multi_synteny_canvas', 60000)
        await waitForDataLoaded(page)
        await delay(2000)
        await canvasSnapshot(
          page,
          'gfa-pangenome-runtime-cigar-canvas',
          '[data-testid="multi_synteny_canvas"]',
        )
      },
    },
    {
      name: 'GFA pangenome with aln full page',
      fn: async page => {
        await navigateWithSessionSpec(
          page,
          {
            views: [
              {
                type: 'LinearGenomeView',
                assembly: 'ref#1',
                loc: 'chr1:1-555',
                tracks: [
                  {
                    trackId: 'volvox_pangenome_gfa',
                    displaySnapshot: { type: 'MultiLGVSyntenyDisplay' },
                  },
                ],
              },
            ],
          },
          config,
        )

        await findByTestId(page, 'multi_synteny_canvas', 60000)
        await waitForDataLoaded(page)
        await delay(2000)
        await pageSnapshot(page, 'gfa-pangenome-aln-fullpage')
      },
    },
  ],
}

export default suite
