import {
  DEMO_CONFIG,
  HG38_GENCODE_PROMOTER_TRACK,
  lgvSession,
  sessionSpec,
} from '../screenshot-spec-helpers.ts'

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
    url: sessionSpec(DEMO_CONFIG, {
      sessionTracks: [HG38_GENCODE_PROMOTER_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          // wider than just the promoter (was 6,533,000-6,536,000) so the
          // gene body + flanking regions are visible too — the 6mA peak only
          // reads as significant in contrast with a flatter background either
          // side (reviewer: too tight, no context to judge significance)
          loc: 'chr12:6,528,000-6,543,000',
          tracks: [
            // NCBI RefSeq gene (not MANE, longest-coding transcript only) +
            // GENCODE promoter-window context so the 6mA accessibility signal
            // reads against the GAPDH promoter/TSS (reviewer: swap MANE for a
            // plain NCBI track, drop the CpG island — not relevant to
            // fiber-seq accessibility — add promoter windows instead). The
            // jbrowse.org/ucsc/hg38 hub gene track has unlabeled
            // pseudogene/silent_region entries upstream of GAPDH in this
            // window, so this uses the already-local, cleanly labeled RefSeq
            // track instead (same one gallery/fiberseq_gapdh uses at this
            // same locus).
            {
              trackId: 'ncbi_refseq_109_hg38_latest',
              displaySnapshot: {
                type: 'LinearBasicDisplay',
                geneGlyphMode: 'longestCoding',
              },
            },
            'gencode_promoter_hg38_ucsc',
            {
              trackId: 'PAY22766-nanopore',
              displaySnapshot: {
                type: 'LinearAlignmentsDisplay',
                // this is a 6mA chromatin-accessibility assay; the basecaller
                // also emits 5mC/5hmC calls on the same reads, but those
                // aren't what this figure is about (reviewer: 6mA only)
                colorBy: {
                  type: 'modifications',
                  modifications: { hiddenModifications: ['m', 'h'] },
                },
                // compact pileup: displayMode isn't a real slot on this
                // display (that's the shared canvas base schema) — fixed
                // heightMode + a small featureHeight/featureSpacing is the
                // actual compact-row setting
                heightMode: 'fixed',
                featureHeight: 3,
                featureSpacing: 0,
                // reviewer: label the modification-type swatches (6mA calls)
                showLegend: true,
              },
            },
            {
              trackId: 'PBA15131-nanopore',
              displaySnapshot: {
                type: 'LinearAlignmentsDisplay',
                colorBy: {
                  type: 'modifications',
                  modifications: { hiddenModifications: ['m', 'h'] },
                },
                heightMode: 'fixed',
                featureHeight: 3,
                featureSpacing: 0,
              },
            },
          ],
        },
      ],
    }),
    readyTimeout: 120000,
    // was 20000 — the prior capture committed while alignments were still
    // downloading (progress bars baked into the PNG), so give it more room
    settleMs: 45000,
    // taller so both alignment tracks' full pileup (compact mode still stacks
    // many rows for this depth) fit below the gene + promoter context tracks
    viewportHeight: 1000,
  },
]
