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
    {
      // chr20 proof-of-concept: 90-haplotype HPRC pangenome served from a
      // single bgzipped, tabix-indexed `odgi untangle` PAF via
      // TabixPAFAdapter (no .pif transform, no tiers). Data is the gitignored
      // symlink in test_data/hprc/; regenerate with the recipe in
      // agent-docs/GRAPH_PLAN.md.
      name: 'HPRC chr20 90-haplotype untangle PAF multi-LGV',
      fn: async page => {
        await navigateWithSessionSpec(
          page,
          {
            views: [
              {
                type: 'LinearGenomeView',
                assembly: 'GRCh38#0',
                loc: 'chr20:1-500000',
                tracks: [
                  {
                    trackId: 'hprc_chr20_untangle_paf',
                    displaySnapshot: { type: 'MultiLGVSyntenyDisplay' },
                  },
                ],
              },
            ],
          },
          'test_data/hprc/config_hprc_chr20_untangle.json',
        )

        await findByTestId(page, 'multi_synteny_canvas_done', 60000)
        await waitForDataLoaded(page)
        await delay(3000)
        await canvasSnapshot(
          page,
          'hprc-chr20-90hap-untangle-paf-canvas',
          '[data-testid="multi_synteny_canvas_done"]',
        )
      },
    },
    {
      name: 'HPRC chr20 90-haplotype untangle PAF full page',
      fn: async page => {
        await navigateWithSessionSpec(
          page,
          {
            views: [
              {
                type: 'LinearGenomeView',
                assembly: 'GRCh38#0',
                loc: 'chr20:1-500000',
                tracks: [
                  {
                    trackId: 'hprc_chr20_untangle_paf',
                    displaySnapshot: { type: 'MultiLGVSyntenyDisplay' },
                  },
                ],
              },
            ],
          },
          'test_data/hprc/config_hprc_chr20_untangle.json',
        )

        await findByTestId(page, 'multi_synteny_canvas_done', 60000)
        await waitForDataLoaded(page)
        await delay(3000)
        await pageSnapshot(page, 'hprc-chr20-90hap-untangle-paf-fullpage')
      },
    },
  ],
}

export default suite
