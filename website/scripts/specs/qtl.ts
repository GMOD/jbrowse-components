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
    // tall enough that the full 500px painting track clears the bottom crop
    // (198 strain rows) instead of running off the frame
    viewportHeight: 980,
    settleMs: 16000,
  },

  // Zoomed out to a ~14 Mb window centered on Tyrp1: the QTL peak reads as a
  // clean rise-and-fall triangle whose apex sits over the highlighted Tyrp1
  // locus (the classic brown coat-color gene), with the strain-by-strain
  // recombination breakpoints visible in the painting below. A genomic
  // highlight band marks Tyrp1 so it's identifiable even though the gene is a
  // sliver at this scale.
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
        text: 'The QTL peak apex sits right over Tyrp1 (red band) — the classic brown coat-color gene',
      },
    ],
  },
]
