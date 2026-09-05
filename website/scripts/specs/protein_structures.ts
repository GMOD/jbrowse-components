import { sessionSpec } from '../screenshot-spec-helpers.ts'
import { PROTEIN3D_CONFIG } from './features.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// The tutorials/tp53_structures page: one session holding TP53's AlphaFold
// model, the DNA-bound core domain (1TUP) and the p53 peptide on MDM2 (1YCR),
// every structure mapped to the same RefSeq transcript. `structures` on
// LaunchView-ProteinView (protein3d >= 0.10.0) builds it from one link; the
// hosted `latest/` bundle the config loads has to serve that release before
// these render, and until then the run reports the view unapplied.
//
// Same locus, heights and split layout as protein/connected, so the three pages
// that show this session show the same frame.
const TP53_CONNECTED_VIEW = {
  assembly: 'hg38',
  loc: 'chr17:7,671,000-7,684,500',
  tracks: [
    { trackId: 'hg38-ncbiRefSeq', height: 150 },
    { trackId: 'clinvar_ncbi_hg38', height: 560 },
  ],
}

function tp53Session(structures: object[]) {
  return sessionSpec(PROTEIN3D_CONFIG, {
    views: [
      {
        type: 'ProteinView',
        structures,
        transcriptId: 'NM_000546.6',
        height: 540,
        sideBySide: true,
        // a click on a residue should band the codon on the gene-wide view,
        // not zoom the genome to it
        zoomToBaseLevel: false,
        connectedView: TP53_CONNECTED_VIEW,
      },
    ],
  })
}

const THREE_STRUCTURES = [
  { uniprotId: 'P04637' },
  { pdbId: '1TUP' },
  { pdbId: '1YCR' },
]

// Both the model state and molstar's raster: the ready test id flips once every
// structure has its alignment, and settleMs is the paint beat after that.
const READY = {
  readySelector: '[data-testid="protein-view-ready"]',
  readyTimeout: 120000,
  settleMs: 6000,
  viewportHeight: 990,
} as const

export const proteinStructuresSpecs: ScreenshotSpec[] = [
  {
    // The session as the link opens it: three alignment panels stacked above
    // one molstar canvas with the crystal cores superposed on the model.
    mode: 'url',
    name: 'protein/tp53_three_structures',
    url: tp53Session(THREE_STRUCTURES),
    ...READY,
  },
  {
    // R248, the DNA-contact hotspot, pre-selected on 1TUP through
    // initialSelection: 0-based structure residue 154 is UniProt 248, since the
    // chain starts at UniProt 94. The selection lights the residue in 3D, the
    // column in 1TUP's alignment, and the codon on both genome tracks, where the
    // ClinVar rows under the band are the R248 substitutions.
    mode: 'url',
    name: 'protein/tp53_hotspot',
    url: tp53Session([
      { uniprotId: 'P04637' },
      { pdbId: '1TUP', initialSelection: { start: 154, end: 155 } },
      { pdbId: '1YCR' },
    ]),
    ...READY,
  },
  {
    // 1YCR's Mapped chain picker open. 1TUP also has one (its DNA strands are
    // entities too), so the second picker on the page is 1YCR's. The p53
    // peptide, Chain B, is checked; MDM2 above it is the chain the transcript
    // does not encode.
    mode: 'url',
    name: 'protein/tp53_mapped_chain',
    url: tp53Session(THREE_STRUCTURES),
    ...READY,
    actions: [
      {
        type: 'click',
        selector:
          '::-p-xpath((//div[@data-testid="protein-mapped-chain"])[2]//div[@role="combobox"])',
      },
      { type: 'waitForText', text: 'Chain A (109 aa)' },
      { type: 'delay', ms: 1000 },
    ],
    hideTooltip: true,
  },
]
