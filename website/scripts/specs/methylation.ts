import {
  DEMO_CONFIG,
  HG38_GENCODE_PROMOTER_TRACK,
  lgvSession,
  sessionSpec,
} from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

export const methylationSpecs: ScreenshotSpec[] = [
  // CRAM modifications + bedmethyl together over a chr20:21.505-21.514Mb window
  // that captures a methylation *contrast* the reviewer asked for: the leftmost
  // CpG island (UCSC "CpG: 158", chr20:21,505,294-21,506,966) is hypomethylated
  // (~20%), while the adjacent CpG:26/33/214 island cluster
  // (chr20:21,507,762-21,513,742) is densely methylated (~90%, silenced) in the
  // COLO829 melanoma line — so the reads read out red/methylated across the
  // cluster and drop to blue over CpG:158. (The bedmethyl demo file only covers
  // chr20, so the earlier chr9 CDKN2A move had no bedmethyl data there — 0 rows,
  // which is why nothing lined up.) The COLO829 nanopore reads' per-base CpG
  // methylation calls (colorBy methylation) line up with the modkit bedmethyl
  // summary below. The bedmethyl uses the multi-row-density renderer (a
  // value-gradient heatmap), not the default two-color xyplot whose negColor
  // never shows for an all-positive 0-100 methylation percentage (don't use
  // twocolor — it only showed the one red color).
  {
    mode: 'url',
    name: 'methylation/colo829_cram_and_bedmethyl',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg38',
      // ~8.8kb window spanning the hypomethylated CpG:158 island (~20%) and the
      // densely-methylated CpG:26/33/214 cluster (~90%) so the methylated/
      // unmethylated transition is visible against the UCSC island boundaries
      loc: 'chr20:21,505,200-21,514,000',
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
    // remote ONT CRAM: alignments finish ~15s, bedmethyl ~5s (both settle well
    // under these caps now that the empty-region loading hang is fixed)
    readyTimeout: 90000,
    settleMs: 30000,
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
