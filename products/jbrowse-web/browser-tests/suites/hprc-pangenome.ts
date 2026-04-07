import {
  delay,
  findByTestId,
  navigateWithSessionSpec,
  waitForDataLoaded,
} from '../helpers.ts'
import { canvasSnapshot, pageSnapshot } from '../snapshot.ts'

import type { TestSuite } from '../types.ts'

const suite: TestSuite = {
  name: 'HPRC Pangenome (remote)',
  requiresRemote: true,
  tests: [
    {
      name: 'HPRC chrM 44-haplotype pangenome multi-LGV',
      fn: async page => {
        await navigateWithSessionSpec(
          page,
          {
            views: [
              {
                type: 'LinearGenomeView',
                assembly: 'GRCh38#0',
                loc: 'chrM:1-16569',
                tracks: [
                  {
                    trackId: 'hprc_chrM_gfa_synteny',
                    displaySnapshot: { type: 'MultiLGVSyntenyDisplay' },
                  },
                ],
              },
            ],
          },
          'test_data/hprc/config_hprc_chrM.json',
        )

        await findByTestId(page, 'multi_synteny_canvas_done', 60000)
        await waitForDataLoaded(page)
        await delay(3000)
        await canvasSnapshot(
          page,
          'hprc-chrM-44hap-multi-lgv-canvas',
          '[data-testid="multi_synteny_canvas_done"]',
        )
      },
    },
    {
      name: 'HPRC chrM 44-haplotype full page',
      fn: async page => {
        await navigateWithSessionSpec(
          page,
          {
            views: [
              {
                type: 'LinearGenomeView',
                assembly: 'GRCh38#0',
                loc: 'chrM:1-16569',
                tracks: [
                  {
                    trackId: 'hprc_chrM_gfa_synteny',
                    displaySnapshot: { type: 'MultiLGVSyntenyDisplay' },
                  },
                ],
              },
            ],
          },
          'test_data/hprc/config_hprc_chrM.json',
        )

        await findByTestId(page, 'multi_synteny_canvas_done', 60000)
        await waitForDataLoaded(page)
        await delay(3000)
        await pageSnapshot(page, 'hprc-chrM-44hap-multi-lgv-fullpage')
      },
    },
  ],
}

export default suite
