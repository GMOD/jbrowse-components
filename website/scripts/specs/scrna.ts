import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { repoRoot } from '../paths.ts'
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

// The cell-type color key, read out of the config rather than restated here.
// The per-cell rows are well under a pixel each, so the display draws no row
// labels for them and the block colors are the only thing naming a cell type in
// that figure; a hand-copied key would be the one thing in it that could
// disagree with the data.
const cellTypeLegend = (
  JSON.parse(readFileSync(join(repoRoot, CONFIG), 'utf8')) as {
    tracks: {
      trackId: string
      adapter: { subadapters?: { name: string; color: string }[] }
    }[]
  }
).tracks
  .find(t => t.trackId === 'pbmc5k_scrna_pseudobulk_hg38')!
  .adapter.subadapters!.map(s => ({ label: s.name, color: s.color }))

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
// in a single discontinuous view. Each window is the 3' 2 kb of a canonical PBMC
// marker (10x 3' chemistry piles a cell's reads into the last ~1.5 kb of the
// transcript), and the regions are in the same order as the track's rows, so the
// signal walks diagonally down the frame: the row that carries each column is
// the cell type that marker defines.
//
// Coordinates are the MANE Select transcript's 3' end for each gene, from the
// UCSC `mane` track (a + strand gene's chromEnd, a - strand gene's chromStart).
const MARKER_PANEL = [
  // CD4 T
  ['IL7R', 'chr5', 35879603],
  // CD8 T
  ['CD8A', 'chr2', 86784609],
  // NK
  ['GNLY', 'chr2', 85698852],
  // B
  ['MS4A1', 'chr11', 60470752],
  // CD14 Mono
  ['LYZ', 'chr12', 69354234],
  // CD16 Mono
  ['FCGR3A', 'chr1', 161541758],
  // cDC
  ['FCER1A', 'chr1', 159308202],
  // pDC
  ['LILRA4', 'chr19', 54333184],
  // Platelet
  ['PPBP', 'chr4', 73986438],
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
              type: 'MultiLinearWiggleDisplay',
              scaleType: 'log',
              // 9 rows, so 45px each: enough for a peak to have a shape rather
              // than being a spike two pixels tall
              height: 405,
            },
          ],
        },
      ],
    }),
    readyTimeout: 120000,
    settleMs: 15000,
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
  // maxScore 2, not 4: the non-monocyte blocks are not empty but one ambient UMI
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
              type: 'MultiLinearWiggleDisplay',
              height: 150,
            },
            {
              trackId: 'pbmc5k_scrna_percell_hg38',
              type: 'MultiLinearWiggleDisplay',
              minScore: 0,
              maxScore: 2,
              height: 620,
            },
          ],
        },
      ],
    }),
    // The nine blocks of cells are in the same order and the same colors as the
    // nine pseudobulk rows above them, but nothing in the frame says which is
    // which: the per-cell rows are sub-pixel, so the display draws no labels for
    // them. Top-right of the per-cell track, which is the CD4 T block — speckle,
    // so the key covers no peak.
    annotations: [
      {
        type: 'legend',
        entries: cellTypeLegend,
        fontSize: 17,
        textAlign: 'end',
        anchor: {
          track: 'pbmc5k_scrna_percell_hg38',
          alignX: 'right',
          alignY: 'top',
          dx: -12,
          dy: 12,
        },
      },
    ],
    readyTimeout: 120000,
    settleMs: 20000,
    // the per-cell track's 620 rows have to reach their own bottom edge: the
    // monocyte block is the last of the nine cell-type blocks, so a frame that
    // ends early cuts off the one band the figure is about
    viewportHeight: 1110,
  },
]
