import { sessionSpec } from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// The tutorial's own config, rather than config_demo: the per-cell track needs
// the Zarr plugin declared, which is a config-level thing. It carries the RefSeq
// genes, the nine pseudobulk BigWigs, the per-cell Zarr matrix, and a copy of
// the PBMC scATAC set so the two assays can be shown over one locus.
const CONFIG = 'test_data/scrna_pbmc5k/config.json'

// Figures for the single-cell RNA pseudobulk tutorial (scrna_pseudobulk.md).
// The BigWigs are the output of scripts/build_scrna_pseudobulk.sh: 10x 5k PBMC
// v3 clustered and labeled with scanpy, then pooled into one coverage track per
// cell type. They are hosted rather than in test_data because they are the same
// files the embedded UMAP demo fetches.

const genes = {
  trackId: 'ncbi_refseq_hg38',
  type: 'LinearBasicDisplay',
  displayMode: 'compact',
  showOnlyGenes: true,
  height: 60,
}

export const scrnaSpecs: ScreenshotSpec[] = [
  // MS4A1 is the B-cell marker: of the nine rows only B carries the pile, and
  // the pile sits at the 3' end because 10x 3' chemistry sequences that end.
  {
    mode: 'url',
    name: 'scrna/ms4a1_bcell',
    url: sessionSpec(CONFIG, {
      views: [
        {
          assembly: 'hg38',
          loc: 'chr11:60,452,000-60,475,000',
          type: 'LinearGenomeView',
          tracks: [
            genes,
            {
              trackId: 'pbmc5k_scrna_pseudobulk_hg38',
              type: 'MultiLinearWiggleDisplay',
              height: 330,
            },
          ],
        },
      ],
    }),
    readyTimeout: 120000,
    settleMs: 15000,
    viewportHeight: 560,
  },
  // The same PBMCs through two assays. The RNA rows measure how much of the
  // transcript each cell type made; the ATAC rows below measure whether the
  // locus is open in that cell type at all.
  {
    mode: 'url',
    name: 'scrna/rna_atac_ms4a1',
    url: sessionSpec(CONFIG, {
      views: [
        {
          assembly: 'hg38',
          loc: 'chr11:60,452,000-60,475,000',
          type: 'LinearGenomeView',
          tracks: [
            genes,
            {
              trackId: 'pbmc5k_scrna_pseudobulk_hg38',
              type: 'MultiLinearWiggleDisplay',
              height: 300,
            },
            {
              trackId: 'pbmc5k_scatac_pseudobulk_hg38',
              type: 'MultiLinearWiggleDisplay',
              height: 380,
            },
          ],
        },
      ],
    }),
    readyTimeout: 120000,
    settleMs: 15000,
    viewportHeight: 900,
  },
  // The pseudobulk row above its own cells: nine curves, then the 4390 rows they
  // are a sum over. The pinned low maximum is what makes the single-UMI cells in
  // the non-monocyte blocks visible at all, and those are ambient RNA, which the
  // smooth row above draws as a low flat line.
  {
    mode: 'url',
    name: 'scrna/percell_lyz',
    url: sessionSpec(CONFIG, {
      views: [
        {
          assembly: 'hg38',
          loc: 'chr12:69,340,000-69,360,000',
          type: 'LinearGenomeView',
          tracks: [
            genes,
            {
              trackId: 'pbmc5k_scrna_pseudobulk_hg38',
              type: 'MultiLinearWiggleDisplay',
              height: 240,
            },
            {
              trackId: 'pbmc5k_scrna_percell_hg38',
              type: 'MultiLinearWiggleDisplay',
              minScore: 0,
              maxScore: 4,
              height: 430,
            },
          ],
        },
      ],
    }),
    readyTimeout: 120000,
    settleMs: 20000,
    viewportHeight: 860,
  },
  // LYZ, so the pattern reads as general rather than one lucky gene: the two
  // monocyte rows and the cDC row carry it, and the lymphocyte rows are flat.
  {
    mode: 'url',
    name: 'scrna/lyz_monocyte',
    url: sessionSpec(CONFIG, {
      views: [
        {
          assembly: 'hg38',
          loc: 'chr12:69,340,000-69,360,000',
          type: 'LinearGenomeView',
          tracks: [
            genes,
            {
              trackId: 'pbmc5k_scrna_pseudobulk_hg38',
              type: 'MultiLinearWiggleDisplay',
              height: 330,
            },
          ],
        },
      ],
    }),
    readyTimeout: 120000,
    settleMs: 15000,
    viewportHeight: 560,
  },
]
