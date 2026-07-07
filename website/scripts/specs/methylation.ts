import {
  DEMO_CONFIG,
  lgvSession,
} from '../screenshot-spec-helpers.ts'

import type {
  ScreenshotSpec,
} from '../screenshot-spec-types.ts'

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
      // zoomed into a ~2.5kb core of the CpG island (was ~18kb, then ~5kb)
      // so the per-base methylation calls + bedmethyl transition are legible
      // rather than a tiny large-scale smear (reviewer asked to zoom further)
      loc: 'chr20:18,500,750-18,503,250',
      tracks: [
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
    viewportHeight: 520,
  },
]
