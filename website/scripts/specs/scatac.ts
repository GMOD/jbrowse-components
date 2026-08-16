import { sessionSpec } from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// Figure for the single-cell ATAC pseudobulk tutorial (scatac_pseudobulk.md).
//
// One, not three. The CATlas atlas subset had two of its own (an INS gallery
// card and an ALB hepatocyte row), and the reviewer's read of the set was that
// they are the same picture: "other single cell images we have are quite
// similar", plus a gallery ask for per-CELL heatmaps, which the gallery already
// answers with scrna/percell_lyz. So the CATlas pair is gone and what is left is
// the figure the tutorial's own build script produces.
export const scatacSpecs: ScreenshotSpec[] = [
  // The output of scripts/build_scatac_pseudobulk.sh, hosted: SnapATAC2's
  // annotated 5k PBMC dataset pseudobulked to 12 per-cell-type BigWigs, with
  // each row keeping the color the single-cell object gave it.
  //
  // Two loci in one discontinuous view rather than one, because the claim the
  // tutorial makes is that the rows SWAP: the labels are only worth trusting if
  // the same twelve rows carry CD8A in the T-cell block and MS4A1 in the B-cell
  // block. One locus shows a peak somewhere; two show that the peak moves to the
  // rows the label predicts, which is the check the page is built on.
  //
  // The CD8A column is carried by CD8 Memory, CD8 Naive, MAIT and NK: all four
  // are CD8A-expressing lineages, so the caption names NK too rather than
  // reading it as a row that leaks.
  {
    mode: 'url',
    name: 'scatac/pbmc5k_marker_swap',
    url: sessionSpec('test_data/config_demo.json', {
      views: [
        {
          assembly: 'hg38',
          // CD8A (T/NK) then MS4A1 (B), each 40 kb so the two columns are the
          // same width and a peak's height is comparable across them
          loc: 'chr2:86,780,000-86,820,000 chr11:60,450,000-60,490,000',
          type: 'LinearGenomeView',
          tracks: [
            {
              trackId: 'ncbi_refseq_109_hg38_latest',
              type: 'LinearBasicDisplay',
              displayMode: 'compact',
              showOnlyGenes: true,
              height: 80,
            },
            {
              trackId: 'pbmc5k_scatac_pseudobulk_hg38',
              type: 'MultiLinearWiggleDisplay',
              // 25px a row. The peaks are narrow and the rows are mostly empty
              // between them, so the height above this was spending itself on
              // the flat parts of a lane rather than on the marker peak that
              // has to be comparable across the two columns.
              height: 300,
            },
          ],
        },
      ],
    }),
    readyTimeout: 120000,
    settleMs: 15000,
    // 12 rows plus the gene track. The app is content-sized here, so this is
    // the app's own height and not a crop: raising it only adds page background
    // below the frame, which the run reports as slack.
    viewportHeight: 680,
  },
]
