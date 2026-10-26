import { sessionSpec } from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// the per-cell track needs the Zarr plugin that this config declares
const CONFIG = 'test_data/scrna_pbmc5k/config.json'

const geneLane = {
  trackId: 'ncbi_refseq_hg38',
  displayMode: 'compact',
  height: 60,
}

const genes = { ...geneLane, filter: ['geneLike'] }

// a dozen stacked RefSeq isoforms push the marker's label out of the lane
const oneTranscriptPerGene = {
  ...geneLane,
  geneGlyphMode: 'representative',
  height: 80,
}

// Each gene is the highest in its pseudobulk row and near zero in the others;
// the list follows the track's row order. Each 4 kb window centres on the
// RefSeq Select 3' end, where 10x 3' chemistry piles the reads; LINC02446 has
// no Select transcript.
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
  // The nine rows share one axis; on a linear one the monocyte column swamps
  // the rest.
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
              encoding: {
                y: {
                  scale: { type: 'log', domainMin: 1 },
                  axis: { title: 'CPM' },
                },
              },
              height: 405,
            },
          ],
        },
      ],
    }),
    readyTimeout: 120000,
    viewportWidth: 1900,
    viewportHeight: 730,
  },
  // The window covers LYZ's 3' end only: over the 20 kb the Zarr covers, the
  // signal is a narrow column in white. At domainMax 4 the one-ambient-UMI
  // cells of the non-monocyte blocks fade to white.
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
              trackId: 'pbmc5k_scrna_pseudobulk_hg38',
              height: 150,
            },
            {
              trackId: 'pbmc5k_scrna_percell_hg38',
              type: 'LinearWiggleDisplay',
              encoding: { y: { scale: { domainMin: 0, domainMax: 2 } } },
              height: 620,
            },
          ],
        },
      ],
    }),
    // No color key: the app cannot key colors set by row name, so the rows'
    // label bars name the cell types.
    readyTimeout: 120000,
    // the monocyte block is the per-cell track's last; a shorter frame cuts it
    viewportHeight: 1110,
  },
]
