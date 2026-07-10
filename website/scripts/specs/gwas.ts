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
  // with no interaction.
  {
    mode: 'url',
    name: 'gwas/locuszoom_ld',
    url: lgvSession('test_data/config_gwas.json', {
      assembly: 'hg19',
      loc: '2:191,790,000-192,120,000',
      tracks: [
        {
          trackId: 'sle_gwas_ld',
          type: 'LinearManhattanDisplay',
          height: 200,
        },
      ],
    }),
    readySelector: '[data-testid="manhattan-display-done"]',
    readyTimeout: 60000,
    // shorter Manhattan track (250 -> 200) so the bottom axis + low-score SNPs
    // clear the viewport edge with margin below, instead of sitting flush
    // against it where they read as clipped
    viewportHeight: 410,
    // settle past the index auto-pick + recolor fetch that follows first paint
    settleMs: 12000,
  },
]
