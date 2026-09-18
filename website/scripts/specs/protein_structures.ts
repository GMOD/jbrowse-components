import { sessionSpec } from '../screenshot-spec-helpers.ts'
import { PROTEIN3D_CONFIG } from './features.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// The tutorials/tp53_structures page: one session holding TP53's AlphaFold
// model, the DNA-bound core domain (1TUP) and the p53 peptide on MDM2 (1YCR),
// every structure mapped to the same RefSeq transcript. `structures` on
// LaunchView-ProteinView (protein3d >= 0.11.0) builds it from one link, with
// the genome view on the left and the protein view on the right. UniProt's
// feature tracks are off: the figures are about the alignment rows.
const R248_CODON = 'chr17:7,674,219-7,674,221'
const GENES = 'hg38-ncbiRefSeq'

function tp53Session(structures: object[]) {
  return sessionSpec(PROTEIN3D_CONFIG, {
    views: [
      {
        type: 'ProteinView',
        structures,
        transcriptId: 'NM_000546.6',
        height: 340,
        sideBySide: true,
        zoomToBaseLevel: false,
        showProteinTracks: false,
        connectedView: {
          assembly: 'hg38',
          loc: 'chr17:7,674,161-7,674,280',
          tracks: [
            { trackId: GENES, geneGlyphMode: 'longestCoding', height: 50 },
          ],
        },
      },
    ],
  })
}

// Both the model state and molstar's raster: the ready test id flips once every
// structure has its alignment, and settleMs is the paint beat after that.
const READY = {
  readySelector: '[data-testid="protein-view-ready"]',
  readyTimeout: 120000,
  settleMs: 6000,
  // molstar's background-task toast sits at the bottom of the canvas well after
  // the model reports ready with three structures loading
  hideSelectors: ['.msp-background-tasks'],
}

const panel = (pdb: string) => `[data-structure="${pdb}"]`
const CHAIN_B_OPTION = '[role="listbox"] li[role="option"]:nth-child(2)'

export const proteinStructuresSpecs: ScreenshotSpec[] = [
  {
    // R248, the DNA-contact hotspot, pre-selected on 1TUP through
    // initialResidues, which names the residue the way the papers do: inclusive
    // author numbering. The selection lights the residue in 3D, its column in
    // 1TUP's alignment, and its codon on the genome view, which opens on the
    // codon so the band is three bases of readable sequence.
    mode: 'url',
    name: 'protein/tp53_hotspot',
    url: tp53Session([
      { uniprotId: 'P04637' },
      { pdbId: '1TUP', initialResidues: { start: 248, end: 248 } },
      { pdbId: '1YCR' },
    ]),
    ...READY,
    viewportWidth: 2000,
    viewportHeight: 1060,
    annotations: [
      {
        type: 'text',
        text: 'R248 codon',
        fontSize: 18,
        leader: true,
        anchor: { track: GENES, locus: R248_CODON, fracY: 0.3 },
        dx: 120,
        dy: 12,
      },
      {
        type: 'text',
        text: 'R248 on 1TUP',
        fontSize: 18,
        leader: true,
        // the panel's click-range highlight, the one element marking the column
        anchor: {
          selector: `${panel('1TUP')} span[style*="rgba(0, 120, 255, 0.3)"]`,
        },
        dx: -560,
        dy: -45,
      },
    ],
  },
  {
    // 1YCR's Mapped chain picker open. Each alignment panel carries the
    // structure it aligns in data-structure, so the picker is addressed by name
    // rather than by position -- 1TUP has one too, its DNA strands being
    // entities. The p53 peptide, Chain B, is checked; MDM2 above it is the
    // chain the transcript does not encode.
    mode: 'url',
    name: 'protein/tp53_mapped_chain',
    url: tp53Session([
      { uniprotId: 'P04637' },
      { pdbId: '1TUP' },
      { pdbId: '1YCR' },
    ]),
    ...READY,
    viewportWidth: 2000,
    viewportHeight: 1060,
    actions: [
      {
        type: 'click',
        selector: `${panel('1YCR')} [data-testid="protein-mapped-chain"] [role="combobox"]`,
      },
      { type: 'waitForText', text: 'Chain A (109 aa)' },
      { type: 'delay', ms: 1000 },
    ],
    hideTooltip: true,
    annotations: [
      { type: 'box', pad: 2, anchor: { selector: CHAIN_B_OPTION } },
      {
        type: 'text',
        text: 'The p53 peptide, the chain the transcript encodes',
        fontSize: 18,
        maxWidth: 600,
        leader: true,
        anchor: { selector: CHAIN_B_OPTION, alignX: 'left' },
        dx: -40,
        dy: 40,
      },
    ],
  },
]
