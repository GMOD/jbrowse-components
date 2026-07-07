import { DEMO_CONFIG, lgvSession } from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

export const methylationSpecs: ScreenshotSpec[] = [
  // CRAM modifications + bedmethyl together over a CpG island (chr20 18.49-18.51Mb,
  // the same island the `modifications` figure uses) so there is a clear
  // methylated/unmethylated transition — the old chr20:10Mb window had little
  // signal. The COLO829 nanopore reads' per-base CpG methylation calls
  // (colorBy methylation) line up with the modkit bedmethyl summary below. The
  // bedmethyl uses the multi-row-density renderer (a value-gradient heatmap), not
  // the default two-color xyplot whose negColor never shows for an all-positive
  // 0-100 methylation percentage (don't use twocolor — it only showed
  // the one red color).
  {
    mode: 'url',
    name: 'methylation/colo829_cram_and_bedmethyl',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg38',
      // ~2.6kb window over the chr20:18,507,440-18,508,160 CpG island (the prior
      // window sat in the gap between islands, so the CpG-island track was
      // empty); the island's hypomethylated core gives the methylated/
      // unmethylated transition the figure is about (reviewer: show the island)
      loc: 'chr20:18,506,400-18,509,000',
      tracks: [
        // UCSC CpG-island annotation on top so the methylated/unmethylated
        // transition can be read against the island boundary (reviewer)
        'cpgisland_ucsc_hg38',
        {
          trackId: 'COLO829_tumor.ht',
          displaySnapshot: {
            // one-color modifications rendering (only methylated calls
            // colored) rather than the two-color methylation mode whose
            // blue "unmethylated" signal has no counterpart in the
            // bedmethyl track below
            colorBy: { type: 'modifications' },
          },
        },
        {
          trackId: 'COLO829_tumor.ht_modkit.bed_multi',
          displaySnapshot: {
            type: 'MultiLinearWiggleDisplay',
            defaultRendering: 'multirowdensity',
            minScore: 0,
            maxScore: 100,
            height: 150,
          },
        },
      ],
    }),
    readyText: 'COLO829',
    readyTimeout: 60000,
    settleMs: 35000,
  },

  // ONT HG002 fiber-seq (6mA) at the GAPDH promoter, modifications mode. The
  // enzyme-treated sample (PAY22766, top) carries 6mA (A+a) calls that the
  // native no-enzyme control (PBA15131, bottom) lacks at the same locus. Data:
  // https://epi2me.nanoporetech.com/chromatin-acc-hg002/
  {
    mode: 'url',
    name: 'methylation/chromatin_accessibility_6ma',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg38',
      loc: 'chr12:6,533,000-6,536,000',
      tracks: [
        // gene + CpG-island context so the 6mA accessibility signal reads
        // against the GAPDH promoter / TSS (reviewer: add gene + promoter track)
        'MANE.GRCh38.v1.4.refseq',
        'cpgisland_ucsc_hg38',
        {
          trackId: 'PAY22766-nanopore',
          displaySnapshot: {
            type: 'LinearAlignmentsDisplay',
            colorBy: { type: 'modifications' },
            height: 200,
          },
        },
        {
          trackId: 'PBA15131-nanopore',
          displaySnapshot: {
            type: 'LinearAlignmentsDisplay',
            colorBy: { type: 'modifications' },
            height: 200,
          },
        },
      ],
    }),
    readyTimeout: 120000,
    settleMs: 20000,
    // taller so both the enzyme-treated and control alignment tracks fit below
    // the added gene + CpG-island context tracks
    viewportHeight: 740,
  },
]
