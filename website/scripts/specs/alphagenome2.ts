import { sessionSpec } from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// The hosted output of scripts/build_alphagenome2_singlecell.sh. Every track is
// a static file, so unlike specs/alphagenome.ts nothing calls the API.
const CONFIG = 'https://jbrowse.org/demos/alphagenome2_singlecell/config.json'

export const alphagenome2Specs: ScreenshotSpec[] = [
  // ETS2 to BRWD1, so the two nearer genes are in frame as the genes with no
  // effect, starting far enough left that ETS2 clears the section chips. At
  // build time rs2836882 scored -0.23 in macrophages and -0.28 in monocytes on
  // ETS2, every lymphoid section stayed within 0.008, and the largest ETS2
  // input gradient in the megabase sat on rs2836882 itself.
  {
    mode: 'url',
    name: 'alphagenome2/ets2_expression_effects',
    url: sessionSpec(CONFIG, {
      views: [
        {
          assembly: 'hg38',
          loc: 'chr21:38,700,000-39,330,000',
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
            { trackId: 'ag2_ets2_gradient', height: 100 },
          ],
        },
      ],
    }),
    readyTimeout: 120000,
    viewportHeight: 1060,
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
            {
              trackId: 'pbmc5k_scatac_pseudobulk_hg38',
              height: 100,
              rows: { kept: ['CD14 Mono', 'CD16 Mono'] },
            },
          ],
        },
      ],
    }),
    readyTimeout: 120000,
    viewportHeight: 980,
  },
  // The 64 bases scored, with ten either side; TGCGTCA at 39,094,641-647
  // carried the largest effects at build time
  {
    mode: 'url',
    name: 'alphagenome2/ets2_enhancer_ism',
    url: sessionSpec(CONFIG, {
      views: [
        {
          assembly: 'hg38',
          loc: 'chr21:39,094,602-39,094,686',
          type: 'LinearGenomeView',
          tracks: [
            { trackId: 'hg38-refseq', height: 40 },
            { trackId: 'ets2_ibd_credible_set', height: 40 },
            { trackId: 'ag2_ets2_ism', height: 80 },
          ],
        },
      ],
    }),
    readyTimeout: 120000,
    viewportHeight: 460,
  },
]
