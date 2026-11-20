import { sessionSpec } from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// The hosted output of scripts/build_alphagenome2_singlecell.sh. Every track is
// a static BigWig, so unlike specs/alphagenome.ts nothing calls the API.
const CONFIG = 'https://jbrowse.org/demos/alphagenome2_singlecell/config.json'

export const alphagenome2Specs: ScreenshotSpec[] = [
  // ETS2 to BRWD1, so the two nearer genes are in frame as the genes with no
  // effect. At build time rs2836882 scored -0.23 in macrophages and -0.28 in
  // monocytes on ETS2, and every lymphoid row stayed within 0.005.
  {
    mode: 'url',
    name: 'alphagenome2/ets2_expression_effects',
    url: sessionSpec(CONFIG, {
      views: [
        {
          assembly: 'hg38',
          loc: 'chr21:38,790,000-39,330,000',
          type: 'LinearGenomeView',
          tracks: [
            {
              trackId: 'hg38-ncbiRefSeqCurated',
              displayMode: 'compact',
              height: 70,
            },
            { trackId: 'ets2_ibd_credible_set', height: 40 },
            { trackId: 'ag2_ets2_expression_by_cell_type', height: 240 },
            { trackId: 'ag2_ets2_macrophage_by_snp', height: 240 },
          ],
        },
      ],
    }),
    readyTimeout: 120000,
    viewportHeight: 820,
  },
  {
    mode: 'url',
    name: 'alphagenome2/ets2_enhancer_atac',
    url: sessionSpec(CONFIG, {
      views: [
        {
          assembly: 'hg38',
          loc: 'chr21:39,094,144-39,095,144',
          type: 'LinearGenomeView',
          tracks: [
            { trackId: 'ets2_ibd_credible_set', height: 60 },
            { trackId: 'ag2_ets2_atac_reference', height: 240 },
            { trackId: 'ag2_ets2_atac_change', height: 240 },
          ],
        },
      ],
    }),
    readyTimeout: 120000,
    viewportHeight: 760,
  },
]
