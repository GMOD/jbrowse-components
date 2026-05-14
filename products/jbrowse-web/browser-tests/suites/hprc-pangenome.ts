import {
  assertCanvasHasContent,
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
        await assertCanvasHasContent(
          page,
          '[data-testid="multi_synteny_canvas_done"]',
        )
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
      // chr20 proof-of-concept: HPRC pangenome served from a single bgzipped,
      // tabix-indexed `odgi untangle` PAF via TabixPAFAdapter (no .pif
      // transform, no tiers — the 580 KB PAF is committed under
      // test_data/hprc/), paired with the separate `vg deconstruct` VCF track
      // for per-base SNP/indel detail — the GRAPH_PLAN "v1" scheme.
      //
      // Viewed at a ~20 kb window: wide enough that the untangle synteny shows
      // many haplotype rows, tight enough that the per-base VCF stays under
      // `maxFeatureScreenDensity` and renders instead of showing the "too many
      // features" banner. (chr20:1-500000 panoramas the synteny but the VCF is
      // correctly region-too-large there — see multi-lgv-pangenome-vcf.ts for
      // the same wide-vs-zoomed split on local data.)
      name: 'HPRC chr20 untangle PAF + per-base VCF multi-LGV',
      fn: async page => {
        await navigateWithSessionSpec(
          page,
          {
            views: [
              {
                type: 'LinearGenomeView',
                assembly: 'GRCh38#0',
                loc: 'chr20:100000-120000',
                tracks: [
                  {
                    trackId: 'hprc_chr20_untangle_paf',
                    displaySnapshot: { type: 'MultiLGVSyntenyDisplay' },
                  },
                  'hprc_chr20_vcf',
                ],
              },
            ],
          },
          'test_data/hprc/config_hprc_chr20_untangle.json',
        )

        await findByTestId(page, 'multi_synteny_canvas_done', 60000)
        await waitForDataLoaded(page)
        await delay(3000)
        // untangle synteny haplotype rows must actually render
        await assertCanvasHasContent(
          page,
          '[data-testid="multi_synteny_canvas_done"]',
        )
        // per-base variants from the vg deconstruct VCF render in the same view
        await assertCanvasHasContent(
          page,
          '[data-testid^="display-hprc_chr20_vcf"][data-testid$="-done"] canvas',
          { minDistinctColors: 3 },
        )
        await canvasSnapshot(
          page,
          'hprc-chr20-90hap-untangle-paf-canvas',
          '[data-testid="multi_synteny_canvas_done"]',
        )
      },
    },
    {
      name: 'HPRC chr20 untangle PAF + per-base VCF full page',
      fn: async page => {
        await navigateWithSessionSpec(
          page,
          {
            views: [
              {
                type: 'LinearGenomeView',
                assembly: 'GRCh38#0',
                loc: 'chr20:100000-120000',
                tracks: [
                  {
                    trackId: 'hprc_chr20_untangle_paf',
                    displaySnapshot: { type: 'MultiLGVSyntenyDisplay' },
                  },
                  'hprc_chr20_vcf',
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
