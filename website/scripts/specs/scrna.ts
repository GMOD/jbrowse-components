import { sessionSpec } from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// The tutorial's own config, rather than config_demo: the per-cell track needs
// the Zarr plugin declared, which is a config-level thing. It carries the RefSeq
// genes, the nine pseudobulk BigWigs, the per-cell Zarr matrix, and a copy of
// the PBMC scATAC set (which the prose covers; no figure uses it, since a
// twelve-row accessibility stack under the nine RNA rows was a lot of frame for
// "and the promoter is open too").
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

// The same lane for the multi-region marker panel, where showOnlyGenes is not
// enough: several of those windows hold a gene with a dozen RefSeq isoforms, and
// stacked they push the gene's own label out of a 60px lane. One transcript per
// gene keeps each column labelled with the marker it is.
const oneTranscriptPerGene = {
  ...genes,
  showOnlyGenes: false,
  geneGlyphMode: 'longestCoding',
  height: 80,
}

// One marker gene per row of the pseudobulk track, each as its own 4 kb region
// in a single discontinuous view, in the rows' order, so the signal walks
// diagonally down the frame. None of the nine is in the PANELS
// build_scrna_pseudobulk.sh labels the clusters with, so the diagonal is not
// guaranteed by the labelling; each was picked from the hosted BigWigs as the
// gene highest in its row and near zero in the others. Each window is centred on
// the RefSeq Select transcript's 3' end (10x 3' chemistry piles a cell's reads
// into the last ~1.5 kb); LINC02446 has no Select transcript, and its reads sit
// at the shorter isoform's end.
const MARKER_PANEL = [
  // CD4 T
  ['CD40LG', 'chrX', 136660390],
  // CD8 T
  ['LINC02446', 'chr12', 10558794],
  // NK
  ['SPON2', 'chr4', 1166931],
  // B
  ['CD22', 'chr19', 35347361],
  // CD14 Mono
  ['S100A12', 'chr1', 153373710],
  // CD16 Mono
  ['HES4', 'chr1', 998963],
  // cDC
  ['ENHO', 'chr9', 34521042],
  // pDC
  ['LRRC26', 'chr9', 137168757],
  // Platelet
  ['GNG11', 'chr7', 93928610],
] as const

const MARKER_PANEL_LOC = MARKER_PANEL.map(
  ([, refName, threePrime]) =>
    `${refName}:${threePrime - 2000}-${threePrime + 2000}`,
).join(' ')

export const scrnaSpecs: ScreenshotSpec[] = [
  // The whole point of a pseudobulk track in one frame: nine cell types down the
  // rows, nine marker loci across the columns, and a peak wherever the two
  // agree.
  //
  // Replaces three single-locus figures (one gene under the nine rows, the same
  // gene's per-cell block at a second locus, and an RNA-over-ATAC pair) that
  // each showed one column of this.
  //
  // Log scale, not linear. LYZ in monocytes is an order of magnitude above IL7R
  // in CD4 T cells, and the nine rows share one autoscaled axis, so on a linear
  // axis the LYZ column is the only one with visible height and the diagonal
  // stops being the picture.
  {
    mode: 'url',
    name: 'scrna/marker_panel',
    url: sessionSpec(CONFIG, {
      views: [
        {
          assembly: 'hg38',
          loc: MARKER_PANEL_LOC,
          type: 'LinearGenomeView',
          tracks: [
            oneTranscriptPerGene,
            {
              trackId: 'pbmc5k_scrna_pseudobulk_hg38',
              type: 'LinearWiggleDisplay',
              scales: { y: { type: 'log', title: 'CPM' } },
              // 9 rows, so 45px each: enough for a peak to have a shape rather
              // than being a spike two pixels tall
              height: 405,
            },
          ],
        },
      ],
    }),
    readyTimeout: 120000,
    viewportWidth: 1900,
    // nine rows plus the gene lane and the view's chrome
    viewportHeight: 730,
  },
  // The pseudobulk row above its own cells: nine curves, then the 4390 rows they
  // are a sum over. The pinned low maximum is what makes the single-UMI cells in
  // the non-monocyte blocks visible at all, and those are ambient RNA, which the
  // smooth row above draws as a low flat line.
  //
  // THE 3' END, NOT THE 20 KB WINDOW THE ZARR COVERS. 10x 3' chemistry piles a
  // cell's reads into the last ~1.5 kb of the gene and nowhere else, so over
  // 20 kb (or over the 7 kb gene body, also tried) the result was a narrow column
  // in a frame of empty white (review: "a better single cell under pseudobulk
  // figure could be made"). Here the monocyte block spans the frame.
  //
  // domainMax 2, not 4: the non-monocyte blocks are not empty but one ambient UMI
  // per cell, and at 4 those cells are a tint indistinguishable from white.
  {
    mode: 'url',
    name: 'scrna/percell_lyz',
    url: sessionSpec(CONFIG, {
      views: [
        {
          assembly: 'hg38',
          loc: 'chr12:69,353,000-69,354,500',
          type: 'LinearGenomeView',
          tracks: [
            genes,
            {
              // 150, not 240: nine curves of which two carry the signal, so the
              // extra height was empty axis. The per-cell rows take it instead.
              trackId: 'pbmc5k_scrna_pseudobulk_hg38',
              type: 'LinearWiggleDisplay',
              height: 150,
            },
            {
              trackId: 'pbmc5k_scrna_percell_hg38',
              type: 'LinearWiggleDisplay',
              scales: { y: { domainMin: 0, domainMax: 2 } },
              height: 620,
            },
          ],
        },
      ],
    }),
    // NO COLOR KEY HERE: the per-cell rows take their colors by name, and the
    // app keys a row color only by an attribute or in a shared panel, so the
    // 0.14 px rows' label bars are the only thing naming the cell types.
    //
    // The pseudobulk lane above stays multi-row (review: "i do not like the
    // multixyplot remove"), where its own sidebar names its nine rows.
    readyTimeout: 120000,
    // the per-cell track's 620 rows have to reach their own bottom edge: the
    // monocyte block is the last of the nine cell-type blocks, so a frame that
    // ends early cuts off the one band the figure is about
    viewportHeight: 1110,
  },
]
