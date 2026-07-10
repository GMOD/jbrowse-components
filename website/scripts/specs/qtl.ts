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
    viewportHeight: 820,
    settleMs: 16000,
  },

  // Zoomed to the Tyrp1 locus: the QTL peak apex sits directly over the Tyrp1
  // gene (the classic brown coat-color locus), with the strain-by-strain
  // recombination breakpoints visible in the painting below.
  {
    mode: 'url',
    name: 'qtl/bxd_tyrp1_locus',
    url: lgvSession('test_data/config_bxd.json', {
      assembly: 'mm10',
      loc: 'chr4:76,500,000-85,500,000',
      tracks: [
        {
          trackId: 'bxd_gwas_coatcolor_mm10',
          displaySnapshot: { type: 'LinearManhattanDisplay', height: 200 },
        },
        {
          trackId: 'mm10_ncbi_refseq',
          displaySnapshot: { type: 'LinearBasicDisplay', height: 120 },
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
    viewportHeight: 860,
    settleMs: 16000,
  },
]
