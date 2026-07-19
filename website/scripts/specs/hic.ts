import { cgiabUrl } from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// Cue-style read-pair contact heatmaps built from the HG008-T (C-GIAB) tumor
// Illumina WGS by binning every read pair into a .hic contact matrix (see the
// readpair_heatmap.md tutorial). SVs show up as off-diagonal enrichment against
// the insert-size diagonal, exactly like Hi-C. NONE normalization: these are raw
// read-pair counts, not a balanced Hi-C experiment, so KR/VC balancing would
// distort the sparse SV signal. Display slots live in the track's own `displays`
// array (a view.tracks entry only selects the display type — slots there drop).

// These are discordant-pair maps (concordant diagonal dropped), so the strong
// SV clusters ARE the signal. useColorPercentile:false + log sets the color
// domain by the max count, so those clusters read dark while the scattered
// count-1 background fades toward white. Coarser bins (resolutionBias +2) make
// the point-like SV signal a legible block.
const HIC_DISPLAY = {
  type: 'LinearHicDisplay',
  height: 420,
  useLogScale: true,
  useColorPercentile: false,
  selectedNormalization: 'NONE',
  resolutionBias: 2,
  // squash the triangle to the track height so a far-off-diagonal SV dot (e.g.
  // the 1.4 Mb duplication) can't fall below the bottom edge and get clipped
  fitToHeight: true,
  showLegend: true,
}

const READPAIR_CHR3Q_TRACK = {
  type: 'HicTrack',
  trackId: 'hg008t_readpair_chr3q',
  name: 'HG008-T read-pair contacts (chr3q)',
  assemblyNames: ['GRCh38_GIABv3'],
  adapter: {
    type: 'HicAdapter',
    hicLocation: {
      uri: 'https://jbrowse.org/demos/cgiab/HG008-T_readpair_chr3q.hic',
      locationType: 'UriLocation',
    },
  },
  displays: [HIC_DISPLAY],
}

const READPAIR_TRANSLOCATION_TRACK = {
  type: 'HicTrack',
  trackId: 'hg008t_readpair_tloc',
  name: 'HG008-T read-pair contacts (chr3↔chr13)',
  assemblyNames: ['GRCh38_GIABv3'],
  adapter: {
    type: 'HicAdapter',
    hicLocation: {
      uri: 'https://jbrowse.org/demos/cgiab/HG008-T_readpair_chr3-chr13_translocation.hic',
      locationType: 'UriLocation',
    },
  },
  // finer bins than the chr3q map: the two ~55 kb windows are already zoomed in.
  // no fitToHeight — the fusion block already sits within the track height
  displays: [{ ...HIC_DISPLAY, resolutionBias: 0, fitToHeight: false }],
}

export const hicSpecs: ScreenshotSpec[] = [
  // Hero: a 3 Mb window of chr3q packing two rearrangements into one intra-
  // chromosomal read-pair heatmap. The 1.4 Mb tandem duplication (benchmark
  // SV_22, 182.47-183.89 Mb) reads as a bright off-diagonal dot linking its two
  // ends; the four-breakpoint fold cluster at 184.7 Mb (SV_23/25/175/176) reads
  // as dense near-diagonal signal at the right. NONE-normalized, log color, 95th-
  // percentile saturation so the sparse off-diagonal SV signal stands out.
  {
    mode: 'url',
    name: 'readpair_heatmap_chr3q',
    url: cgiabUrl({
      sessionTracks: [READPAIR_CHR3Q_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'GRCh38_GIABv3',
          // framed on the 1.4 Mb tandem duplication so its junction dot sits
          // prominently off the diagonal rather than lost in a wide window
          loc: 'chr3:182,200,000-184,200,000',
          // mark the two duplication breakpoints; the off-diagonal dot sits
          // where the two shaded columns cross
          highlight: [
            'chr3:182,460,000-182,485,000',
            'chr3:183,880,000-183,905,000',
          ],
          tracks: ['hg008t_readpair_chr3q'],
        },
      ],
    }),
    readyText: 'chr3',
    readyTimeout: 60000,
    viewportHeight: 720,
    settleMs: 15000,
  },

  // Translocation: the chr3<->chr13 junction (benchmark SV_20, chr3:139,976,414
  // to chr13:114,353,244), the same event the existing sv_cgiab breakpoint-split
  // figure drills into. A two-region view (a chr3 window beside a chr13 window)
  // renders the inter-chromosomal block of the contact matrix, where the
  // discordant read pairs spanning the fusion pile up as a bright off-diagonal
  // spot linking the two chromosomes.
  {
    mode: 'url',
    name: 'readpair_heatmap_translocation',
    url: cgiabUrl({
      sessionTracks: [READPAIR_TRANSLOCATION_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'GRCh38_GIABv3',
          loc: 'chr3:139,950,000-140,005,000 chr13:114,325,000-114,382,000',
          // mark the fusion breakpoint on each chromosome; the inter-chromosomal
          // block sits where the two columns meet
          highlight: [
            'chr3:139,972,000-139,981,000',
            'chr13:114,349,000-114,358,000',
          ],
          tracks: ['hg008t_readpair_tloc'],
        },
      ],
    }),
    readyText: 'chr3',
    readyTimeout: 60000,
    viewportHeight: 720,
    settleMs: 15000,
  },
]
