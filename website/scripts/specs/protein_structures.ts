import { sessionSpec } from '../screenshot-spec-helpers.ts'
import { PROTEIN3D_CONFIG } from './features.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// The tutorials/tp53_structures page: TP53's AlphaFold model, the DNA-bound
// core domain (1TUP) and the p53 peptide on MDM2 (1YCR), each mapped to the
// same RefSeq transcript. `structures` on LaunchView-ProteinView builds the
// session from one link, genome view left, protein view right. The mapped-chain
// colour scheme paints the chain the transcript encodes and greys the rest;
// protein3d releases before it coerce the name to the default chain colouring.
const R248_CODON = 'chr17:7,674,219-7,674,221'
const GENES = 'hg38-ncbiRefSeq'

function tp53Session({
  structures,
  loc,
  height,
  showAlignment,
}: {
  structures: object[]
  loc: string
  height: number
  showAlignment: boolean
}) {
  return sessionSpec(PROTEIN3D_CONFIG, {
    views: [
      {
        type: 'ProteinView',
        structures,
        transcriptId: 'NM_000546.6',
        height,
        sideBySide: true,
        zoomToBaseLevel: false,
        showProteinTracks: false,
        showAlignment,
        colorScheme: 'mapped-chain',
        connectedView: {
          assembly: 'hg38',
          loc,
          tracks: [
            { trackId: GENES, geneGlyphMode: 'longestCoding', height: 50 },
          ],
        },
      },
    ],
  })
}

// Both the model state and molstar's raster: the ready test id flips once every
// structure has its alignment.
const READY = {
  readySelector: '[data-testid="protein-view-ready"]',
  readyTimeout: 120000,
  // molstar's background-task toast sits at the bottom of the canvas well after
  // the model reports ready with three structures loading
  hideSelectors: ['.msp-background-tasks'],
}

const CHAIN_B_OPTION = '[role="listbox"] li[role="option"]:nth-child(2)'

export const proteinStructuresSpecs: ScreenshotSpec[] = [
  {
    // R248, the DNA-contact hotspot, pre-selected on 1TUP by author numbering.
    // The seeded selection frames the camera on the residue, focuses it so it
    // and its neighbours draw as sticks, and bands its codon on the genome view.
    mode: 'url',
    name: 'protein/tp53_hotspot',
    url: tp53Session({
      structures: [
        { pdbId: '1TUP', initialResidues: { start: 248, end: 248 } },
      ],
      loc: 'chr17:7,674,161-7,674,280',
      height: 720,
      showAlignment: false,
    }),
    ...READY,
    viewportWidth: 2000,
    viewportHeight: 1000,
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
        text: 'R248 in magenta, with the residues and bases around it',
        maxWidth: 520,
        fontSize: 18,
        anchor: {
          selector: '[data-testid="protein-view-molstar"]',
          alignX: 'left',
          alignY: 'top',
        },
        dx: 200,
        dy: 40,
      },
    ],
  },
  {
    // 1YCR alone, with its Mapped chain picker open. The p53 peptide, Chain B,
    // is checked, so it is the one coloured chain on grey MDM2.
    mode: 'url',
    name: 'protein/tp53_mapped_chain',
    url: tp53Session({
      structures: [{ pdbId: '1YCR' }],
      loc: 'chr17:7,668,000-7,688,000',
      height: 640,
      showAlignment: true,
    }),
    ...READY,
    viewportWidth: 2000,
    viewportHeight: 1000,
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
