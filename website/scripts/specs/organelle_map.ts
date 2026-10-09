import { displayPainted } from '@jbrowse/browser-test-utils'

import { lgvSession, sessionSpec } from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// The human mitochondrial reference NC_012920.1 with NCBI's GFF3, as
// test_data/human_mito holds them. Behind tutorials/organelle_map.md, whose
// track fence is that config's `mito_genes`: genes in a row per strand,
// colored by type, at 250 px. At the 100 px default the fit layout drops the
// ND6 and D-loop names; on the circle 250 asks for more than the ring's band,
// which then lays the track out at the band's own height.
const CONFIG = 'test_data/human_mito/config.json'

export const organelleMapSpecs: ScreenshotSpec[] = [
  // One contig, so the ring closes at position 1 and the name and length sit
  // in the middle. The minus-strand row holds ND6 and eight tRNAs, every other
  // gene is on the plus row, and the D-loop crosses the origin as one arc.
  {
    mode: 'url',
    name: 'organelle_map/mito_ring',
    url: sessionSpec(CONFIG, {
      views: [
        {
          type: 'CircularView',
          assembly: 'human_mito',
          height: 780,
          showLegend: true,
          tracks: ['mito_genes'],
        },
      ],
    }),
    readySelector: displayPainted('circular-ring-canvas'),
    readyTimeout: 60000,
    viewportWidth: 1000,
    viewportHeight: 900,
  },
  // The same track on the linear view from ND5 to the D-loop: ND6 sits on the
  // minus row between ND5 and CYTB on the plus row.
  {
    mode: 'url',
    name: 'organelle_map/nd6_linear',
    url: lgvSession(CONFIG, {
      assembly: 'human_mito',
      loc: 'NC_012920.1:12,000-16,569',
      tracks: ['mito_genes'],
    }),
    readyText: 'ND6',
    readyTimeout: 60000,
    viewportHeight: 520,
  },
]
