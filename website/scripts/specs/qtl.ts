import { lgvSession } from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// The chromosome painting is sorted in-app by each strain's B/D haplotype at the
// Tyrp1 QTL peak via the display's declarative `sortRowsBy` — so the recombinant
// mosaic resolves into a contiguous B block over a D block right where the
// coat-color QTL peaks, reading as the genotype split that DRIVES the Manhattan
// signal above (rather than an arbitrary alphabetical jumble). No hand-baked
// row order: the display computes it from the loaded features once the region
// is in view (same one-shot launch-spec pattern as LinearGenomeView `init`).
const TYRP1_PEAK = { refName: 'chr4', pos: 80_975_000 }

// ──────────────────────────────────────────────────────────────────────────
// QTL / systems genetics — real GeneNetwork BXD mouse data (mm10). One track
// set demonstrates both plugins/gwas (Manhattan) and plugins/canvas
// (LinearMultiRowFeatureDisplay chromosome painting): a single-marker QTL scan
// of a real BXD phenotype stacked over the B/D haplotype mosaic of 198 strains.
// Data + config: test_data/config_bxd.json (hosted at jbrowse.org/demos/bxd/).
// ──────────────────────────────────────────────────────────────────────────

// Before/after control for the sorted overview: the SAME whole-chr4 view with
// only the painting's `sortRowsBy` toggled. Default row order is alphabetical by
// strain (unrelated to genotype at the peak, so salt-and-pepper); sorted groups
// D strains over B, and the split is clean/wide because neighbours share long
// flanking haplotypes (linkage). Proves the split is real structure aligned with
// the peak, not an artifact of sorting.
const paintingSortPanel = (sorted: boolean) =>
  lgvSession('test_data/config_bxd.json', {
    assembly: 'mm10',
    loc: 'chr4',
    tracks: [
      {
        trackId: 'bxd_gwas_coatcolor_mm10',
        displaySnapshot: { type: 'LinearManhattanDisplay', height: 140 },
      },
      {
        trackId: 'bxd_chromosome_painting_mm10',
        displaySnapshot: {
          type: 'LinearMultiRowFeatureDisplay',
          height: 420,
          sortRowsBy: sorted ? TYRP1_PEAK : undefined,
        },
      },
    ],
  })

export const qtlSpecs: ScreenshotSpec[] = [
  // Whole-chr4 overview: the coat-color QTL Manhattan peaks over Tyrp1 (~80Mb)
  // above the 198-strain BXD chromosome painting, showing how a phenotype scan
  // and the underlying recombinant-inbred haplotype mosaic line up.
  {
    mode: 'url',
    name: 'qtl/bxd_overview',
    url: lgvSession('test_data/config_bxd.json', {
      assembly: 'mm10',
      loc: 'chr4',
      tracks: [
        {
          trackId: 'bxd_gwas_coatcolor_mm10',
          displaySnapshot: { type: 'LinearManhattanDisplay', height: 220 },
        },
        {
          trackId: 'bxd_chromosome_painting_mm10',
          displaySnapshot: {
            type: 'LinearMultiRowFeatureDisplay',
            height: 500,
            sortRowsBy: TYRP1_PEAK,
          },
        },
      ],
    }),
    readySelector: '[data-testid="manhattan-display-done"]',
    readyTimeout: 90000,
    // tall enough that the full 500px painting track clears the bottom crop
    // (198 strain rows) instead of running off the frame
    viewportHeight: 980,
    settleMs: 16000,
  },

  // Zoomed to a ~14 Mb window on Tyrp1. At this scale the association is a broad
  // plateau (RI-panel LD extends for many Mb), so the gene sits under the
  // *region*, not a razor apex — the figure's real payload is the gene position
  // plus the strain-by-strain recombination breakpoints resolved in the painting
  // below. A genomic highlight band marks Tyrp1, a sub-pixel sliver at this zoom.
  {
    mode: 'url',
    name: 'qtl/bxd_tyrp1_locus',
    url: lgvSession('test_data/config_bxd.json', {
      assembly: 'mm10',
      loc: 'chr4:74,000,000-88,000,000',
      // colored band over the Tyrp1 gene + QTL-peak marker so the eye lands on
      // it under the peak; 350 kb reads as a visible stripe at this ~14 Mb zoom
      // (the bare 30 kb gene body was a sub-pixel sliver)
      highlight: [
        {
          refName: 'chr4',
          start: 80_700_000,
          end: 81_050_000,
          assemblyName: 'mm10',
          label: 'Tyrp1',
          color: 'rgba(214,40,40,0.16)',
        },
      ],
      tracks: [
        {
          trackId: 'bxd_gwas_coatcolor_mm10',
          displaySnapshot: { type: 'LinearManhattanDisplay', height: 200 },
        },
        {
          trackId: 'mm10_ncbi_refseq',
          // gene-glyph-only + short: a context strip at this wide zoom, not a
          // dense mRNA/exon band
          displaySnapshot: {
            type: 'LinearBasicDisplay',
            height: 90,
            showOnlyGenes: true,
          },
        },
        {
          trackId: 'bxd_chromosome_painting_mm10',
          displaySnapshot: {
            type: 'LinearMultiRowFeatureDisplay',
            height: 460,
            sortRowsBy: TYRP1_PEAK,
          },
        },
      ],
    }),
    readySelector: '[data-testid="manhattan-display-done"]',
    readyTimeout: 90000,
    // manhattan(200) + gene strip(90) + full painting(460) + headers clear crop
    viewportHeight: 1060,
    settleMs: 16000,
    annotations: [
      {
        type: 'text',
        x: 560,
        y: 66,
        maxWidth: 360,
        fontSize: 15,
        text: 'Tyrp1 (red band): the coat-color gene, sitting under the QTL',
      },
    ],
  },

  // "Before" panel of the sort proof: painting in default alphabetical order.
  {
    mode: 'url',
    name: 'qtl/bxd_painting_input_order',
    url: paintingSortPanel(false),
    readySelector: '[data-testid="manhattan-display-done"]',
    readyTimeout: 90000,
    // chrome + manhattan(140) + painting(420) clears the bottom crop
    viewportHeight: 840,
    settleMs: 16000,
    annotations: [
      {
        type: 'text',
        x: 520,
        y: 60,
        maxWidth: 400,
        fontSize: 15,
        text: 'Strains in default (alphabetical) order — salt-and-pepper at the peak',
      },
    ],
  },

  // "After" panel: identical view, painting sorted by genotype at the peak.
  {
    mode: 'url',
    name: 'qtl/bxd_painting_sorted',
    url: paintingSortPanel(true),
    readySelector: '[data-testid="manhattan-display-done"]',
    readyTimeout: 90000,
    viewportHeight: 840,
    settleMs: 16000,
    annotations: [
      {
        type: 'text',
        x: 520,
        y: 60,
        maxWidth: 400,
        fontSize: 15,
        text: 'Same strains sorted by genotype at the peak — a clean B/D split appears under it',
      },
    ],
  },

  // Stack the two panels (input order over sorted) into one before/after figure.
  {
    mode: 'compose',
    name: 'qtl/bxd_sort_before_after',
    parts: ['qtl/bxd_painting_input_order', 'qtl/bxd_painting_sorted'],
  },
]
