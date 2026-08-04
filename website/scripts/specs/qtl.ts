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

// Sorted-overview panel below: the painting's declarative `sortRowsBy` groups
// D strains over B at the peak, and the split is clean/wide because
// neighbours share long flanking haplotypes (linkage).
const paintingSortPanel = () =>
  lgvSession('test_data/config_bxd.json', {
    assembly: 'mm10',
    loc: 'chr4',
    tracks: [
      {
        trackId: 'bxd_gwas_coatcolor_mm10',
        type: 'LinearManhattanDisplay',
        height: 140,
      },
      {
        trackId: 'bxd_chromosome_painting_mm10',
        type: 'LinearMultiRowFeatureDisplay',
        height: 420,
        sortRowsBy: TYRP1_PEAK,
        // whole-chr4 painting: lift the byte gate so the multi-row track loads
        // headless (density gating no longer applies to multi-row). Session-
        // scoped force-load, not baked into the demo config.
        forceLoad: true,
      },
    ],
  })

export const qtlSpecs: ScreenshotSpec[] = [
  // Whole chr4 with the Tyrp1 gene position marked. The association is a broad
  // plateau (RI-panel LD extends for many Mb), so the gene sits under the
  // *region*, not a razor apex — the figure's real payload is the gene position
  // plus the strain-by-strain recombination breakpoints resolved in the painting
  // below.
  {
    mode: 'url',
    name: 'qtl/bxd_tyrp1_locus',
    url: lgvSession('test_data/config_bxd.json', {
      assembly: 'mm10',
      // whole chr4 (~156 Mb): the coat-color association reads as one localized
      // peak against the full chromosome background, and the B/D haplotype
      // painting fills the chromosome so Tyrp1's position under the peak is
      // legible at a glance
      loc: 'chr4',
      tracks: [
        // The gene lane is one gene (reviewer: "add a gene track with the Tyrp1
        // gene visible, could filter to it"). A whole RefSeq track over 156 Mb
        // is 180k GTF records that draw as a solid bar and gate on density, so
        // the jexl filter is what makes the lane possible at all: it leaves a
        // single labeled glyph, which is the one thing the figure wants from a
        // gene track — where on chr4 Tyrp1 actually is, in the same x as the
        // peak above and the haplotype split below. `forceLoad` because the
        // density gate runs on the region's byte size, before any filter.
        {
          trackId: 'mm10_ncbi_refseq',
          jexlFiltersSetting: ["jexl:get(feature,'name')=='Tyrp1'"],
          forceLoad: true,
          // one box per gene: Tyrp1's 17 kb of exon structure is a fifth of a
          // pixel at 156 kb/px, so an isoform glyph here is a claim the scale
          // cannot support
          showOnlyGenes: true,
          height: 50,
        },
        {
          trackId: 'bxd_gwas_coatcolor_mm10',
          type: 'LinearManhattanDisplay',
          height: 200,
        },
        {
          trackId: 'bxd_chromosome_painting_mm10',
          type: 'LinearMultiRowFeatureDisplay',
          height: 460,
          sortRowsBy: TYRP1_PEAK,
          forceLoad: true,
        },
      ],
    }),
    readySelector: '[data-testid="manhattan-display-done"]',
    readyTimeout: 90000,
    // gene lane(50) + manhattan(200) + full painting(460) + headers clear crop
    viewportHeight: 1000,
    settleMs: 16000,
    annotations: [
      {
        type: 'text',
        x: 560,
        y: 66,
        maxWidth: 360,
        fontSize: 15,
        text: 'Tyrp1: the coat-color gene under the QTL peak',
      },
    ],
  },

  // One panel, not a before/after stack (reviewer: the alphabetical "before"
  // state adds nothing the caption doesn't already say in prose). Painting
  // already sorted by genotype at the peak, with the right-click context menu
  // open over it so the mechanism ("Sort rows by color here") and the result
  // (the clean B/D split) are both readable in one image. We only OPEN the
  // menu (rightclick + wait); we never click the item, so the already-sorted
  // painting stays sorted underneath it.
  {
    mode: 'url',
    name: 'qtl/bxd_painting_sorted',
    url: paintingSortPanel(),
    readySelector: '[data-testid="manhattan-display-done"]',
    readyTimeout: 90000,
    // chrome + manhattan(140) + painting(420) clears the bottom crop
    viewportHeight: 840,
    settleMs: 16000,
    hideTooltip: true,
    actions: [
      // right-click on the painting track (its 420px body sits well below the
      // manhattan track), near the Tyrp1 peak x (~52% across whole chr4), so the
      // menu appears at the column the sort would key on
      { type: 'rightclick', from: { x: 776, y: 430 } },
      { type: 'waitForText', text: 'Sort rows by color here' },
    ],
    annotations: [
      {
        type: 'text',
        x: 300,
        y: 60,
        maxWidth: 440,
        fontSize: 15,
        text: 'Right-click the painting to sort rows by genotype at that column',
      },
      { type: 'box', anchor: { text: 'Sort rows by color here' } },
    ],
  },
]
