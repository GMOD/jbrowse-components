import { sessionSpec } from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

export const scatacSpecs: ScreenshotSpec[] = [
  // The hosted output of scripts/build_scatac_pseudobulk.sh. The figure needs
  // both loci: the tutorial's check is that the peak moves to the rows the
  // labels predict. NK carries CD8A too, as a CD8A-expressing lineage.
  {
    mode: 'url',
    name: 'scatac/pbmc5k_marker_swap',
    url: sessionSpec('test_data/config_demo.json', {
      views: [
        {
          assembly: 'hg38',
          // equal 40 kb windows keep peak heights comparable across columns
          loc: 'chr2:86,780,000-86,820,000 chr11:60,450,000-60,490,000',
          type: 'LinearGenomeView',
          tracks: [
            {
              trackId: 'ncbi_refseq_109_hg38_latest',
              displayMode: 'compact',
              filter: ['geneLike'],
              height: 80,
            },
            {
              trackId: 'pbmc5k_scatac_pseudobulk_hg38',
              height: 300,
            },
          ],
        },
      ],
    }),
    readyTimeout: 120000,
    // the app sizes to its content, so a taller viewport only adds slack
    viewportHeight: 680,
  },
  // The same two loci with AlphaGenome 2's predictions under the measured rows,
  // from scripts/build_alphagenome2_singlecell.sh. Over six marker loci at
  // build time, a predicted row's cell-type-specific signal matched its own
  // measured row at r 0.69 on average and the other rows at -0.06; MS4A1's T
  // rows were the weakest match, which this frame shows.
  {
    mode: 'url',
    name: 'scatac/pbmc5k_predicted_vs_measured',
    url: sessionSpec(
      'https://jbrowse.org/demos/alphagenome2_singlecell/config.json',
      {
        views: [
          {
            assembly: 'hg38',
            loc: 'chr2:86,780,000-86,820,000 chr11:60,450,000-60,490,000',
            type: 'LinearGenomeView',
            tracks: [
              {
                trackId: 'hg38-ncbiRefSeqCurated',
                displayMode: 'compact',
                height: 70,
              },
              { trackId: 'pbmc5k_scatac_pseudobulk_hg38', height: 300 },
              { trackId: 'ag2_pbmc_scatac_predicted', height: 300 },
            ],
          },
        ],
      },
    ),
    readyTimeout: 120000,
    viewportHeight: 820,
  },
]
