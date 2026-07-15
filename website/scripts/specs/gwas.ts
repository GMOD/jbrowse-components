import { lgvSession } from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

export const gwasSpecs: ScreenshotSpec[] = [
  // ────────────────────────────────────────────────────────────────────────
  // GWAS / Manhattan plot
  // ────────────────────────────────────────────────────────────────────────

  // Manhattan plot from a real human GWAS (config_gwas hg19 genome-wide summary
  // stats) over a whole chromosome (chr2), so the classic dense field of points
  // with significant peaks reads as a per-chromosome Manhattan overview (reviewer:
  // show a whole-chromosome overview). The binned Manhattan display renders the
  // full contig fast enough headless even though genome-wide showAllRegions did
  // not.
  {
    mode: 'url',
    name: 'gwas/manhattan',
    url: lgvSession('test_data/config_gwas.json', {
      assembly: 'hg19',
      loc: '2',
      tracks: [
        {
          trackId: 'gwas_track',
          type: 'LinearManhattanDisplay',
          height: 250,
        },
      ],
    }),
    readySelector: '[data-testid="manhattan-display-done"]',
    readyTimeout: 90000,
    viewportHeight: 470,
    settleMs: 12000,
  },

  // LocusZoom-style LD r² coloring at the STAT4 locus on hg19 (SLE summary
  // stats). The index SNP auto-tracks the top hit (the lead rs4274624 the
  // bundled SLE.ld is keyed to), so points shade red→blue by r² to it on load
  // with no interaction. A compact gene track below anchors the peak to the
  // STAT4 gene body (reviewer: add gene track), and the points are enlarged
  // (scatterPointSize 4 -> 7) so the r² shading reads clearly (reviewer).
  {
    mode: 'url',
    name: 'gwas/locuszoom_ld',
    url: lgvSession('test_data/config_gwas.json', {
      assembly: 'hg19',
      loc: '2:191,790,000-192,120,000',
      trackLabels: 'offset',
      tracks: [
        {
          trackId: 'sle_gwas_ld',
          type: 'LinearManhattanDisplay',
          height: 200,
          scatterPointSize: 7,
        },
        {
          trackId: 'ncbi_gff_hg19',
          type: 'LinearBasicDisplay',
          height: 90,
          showOnlyGenes: true,
        },
      ],
    }),
    readySelector: '[data-testid="manhattan-display-done"]',
    readyTimeout: 60000,
    // Manhattan(200) + gene strip(90) + headers/ruler/overview clear the crop
    viewportHeight: 520,
    // settle past the index auto-pick + recolor fetch that follows first paint
    settleMs: 12000,
  },
]
