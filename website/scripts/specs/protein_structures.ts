import { sessionSpec } from '../screenshot-spec-helpers.ts'
import { PROTEIN3D_CONFIG } from './features.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// The tutorials/tp53_structures page: one session holding TP53's AlphaFold
// model, the DNA-bound core domain (1TUP) and the p53 peptide on MDM2 (1YCR),
// every structure mapped to the same RefSeq transcript. `structures` on
// LaunchView-ProteinView (protein3d >= 0.11.0) builds it from one link; the
// hosted `latest/` bundle the config loads has to serve that release before
// these render, and until then the run reports the view unapplied.
//
// Same locus, heights and split layout as protein/connected, so the three pages
// that show this session show the same frame.
// Three alignment panels stack above the canvas, so the protein column is
// about 1500 css px tall; the genome column beside it is filled by letting
// ClinVar's rows scroll inside a band that reaches the same depth.
const GENE_WIDE = 'chr17:7,671,000-7,684,500'

function tp53Session(structures: object[], loc = GENE_WIDE) {
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
        connectedView: {
          assembly: 'hg38',
          loc,
          tracks: [
            { trackId: 'hg38-ncbiRefSeq', height: 150 },
            { trackId: 'clinvar_ncbi_hg38', height: 1040 },
          ],
        },
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
  // molstar's background-task toast ("Creating or updating UnitsVisual") sat
  // at the bottom of the canvas through a 15 s settle: three structures keep
  // its visual builders busy well after the model reports ready, so the toast
  // is stripped rather than waited out
  hideSelectors: ['.msp-background-tasks'],
  // measured: 990 clipped 515 css px, the whole molstar canvas
  viewportHeight: 1520,
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
    // initialResidues, which names the residue the way the papers do: inclusive
    // author numbering, resolved to a position once the file's numbering is
    // known. The selection lights the residue in 3D, the column in 1TUP's
    // alignment, and the codon on both genome tracks, where the
    // ClinVar rows under the band are the R248 substitutions. The genome view
    // opens on exon 7 rather than the gene: at gene-wide zoom a codon's band is
    // a hairline, and the ClinVar rows at it are indistinguishable from their
    // neighbours.
    mode: 'url',
    name: 'protein/tp53_hotspot',
    url: tp53Session(
      [
        { uniprotId: 'P04637' },
        { pdbId: '1TUP', initialResidues: { start: 248, end: 248 } },
        { pdbId: '1YCR' },
      ],
      'chr17:7,674,100-7,674,350',
    ),
    ...READY,
  },
  {
    // 1YCR's Mapped chain picker open. Each alignment panel carries the
    // structure it aligns in data-structure, so the picker is addressed by name
    // rather than by its position among the pickers on the page -- 1TUP has one
    // too, its DNA strands being entities. The p53 peptide, Chain B, is
    // checked; MDM2 above it is the chain the transcript does not encode.
    mode: 'url',
    name: 'protein/tp53_mapped_chain',
    url: tp53Session(THREE_STRUCTURES),
    ...READY,
    actions: [
      {
        type: 'click',
        selector:
          '[data-structure="1YCR"] [data-testid="protein-mapped-chain"] [role="combobox"]',
      },
      { type: 'waitForText', text: 'Chain A (109 aa)' },
      { type: 'delay', ms: 1000 },
    ],
    hideTooltip: true,
  },
]
