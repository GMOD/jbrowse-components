import { displayPainted } from '@jbrowse/browser-test-utils'

import { sessionSpec } from '../screenshot-spec-helpers.ts'
import { pageTrack } from './pageTrack.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// The DGRP2 Drosophila windowed scans (scripts/build_dgrp_popgen.sh), over the
// hosted UCSC dm6 hub. The bigWigs name arms 2L, the hub chr2L; the hub's
// chromAlias reconciles them, which the tutorial calls out.
const DM6_HUB = 'https://jbrowse.org/ucsc/dm6/config.json'

// Separate tracks: Fst tops out near 0.83 and pi near 0.016, so a shared-scale
// multi-wiggle would flatten pi.
const POPGEN_DOC = 'tutorials/population_genomics.md'
const FST_TRACK = pageTrack(POPGEN_DOC, 'fst_in2lt')
const PI_TRACK = {
  type: 'QuantitativeTrack',
  trackId: 'pi_all',
  name: 'π (whole panel)',
  assemblyNames: ['dm6'],
  adapter: {
    type: 'BigWigAdapter',
    uri: 'https://jbrowse.org/demos/popgen/pi_all.bw',
  },
}

// The published In(2L)t breakpoints. They are release 5 coordinates, and r5 and
// r6 coincide on this arm (the aertslab liftover's POS - OriginalStart is 0
// across 2L), so no conversion is needed. Checked; don't re-check.
const IN2LT_INVERSION_TRACK = {
  type: 'FeatureTrack',
  trackId: 'in2lt_inversion',
  name: 'In(2L)t inversion',
  assemblyNames: ['dm6'],
  adapter: {
    type: 'FromConfigAdapter',
    adapterId: 'in2lt',
    features: [
      {
        uniqueId: 'in2lt',
        refName: 'chr2L',
        start: 2225744,
        end: 13154180,
        name: 'In(2L)t',
        type: 'inversion',
      },
    ],
  },
}

// Tajima's D, which drops with pi at a hard sweep. The flanking baseline sits
// near +0.5, not zero: DGRP2 holds variant sites only, and vcftools counts 2n
// chromosomes off n inbred lines. Read excursions against local background.
const TAJD_TRACK = {
  type: 'QuantitativeTrack',
  trackId: 'tajd_all',
  name: "Tajima's D (whole panel)",
  assemblyNames: ['dm6'],
  adapter: {
    type: 'BigWigAdapter',
    uri: 'https://jbrowse.org/demos/popgen/tajimad_all.bw',
  },
}

// Called variants per window, from the same vcftools table as pi. At Cyp6g1 the
// site count falls ~5x while pi falls ~15x, so the trough is frequency, not
// lost calls.
const SITES_TRACK = {
  type: 'QuantitativeTrack',
  trackId: 'sites_all',
  name: 'Called variants per window',
  assemblyNames: ['dm6'],
  adapter: {
    type: 'BigWigAdapter',
    uri: 'https://jbrowse.org/demos/popgen/sites_all.bw',
  },
}

// No per-group-pi figure: pi_INV.bw beside pi_STD.bw is indistinguishable in
// every framing tried, so popgen/in2lt_pi_ratio draws one pooled ratio lane.

// Defined inline for the grouping guide's facet example
// (config_guides/grouping_and_ordering.md).
const IN2LT_SV_TRACK = {
  type: 'VariantTrack',
  trackId: 'dgrp_In2Lt_sv',
  name: 'In(2L)t inversion genotyped across DGRP lines',
  assemblyNames: ['dm6'],
  adapter: {
    type: 'VcfTabixAdapter',
    uri: 'https://jbrowse.org/demos/popgen/dgrp_In2Lt_sv.vcf.gz',
    samplesTsvLocation: {
      uri: 'https://jbrowse.org/demos/popgen/dgrp_In2Lt_samples.tsv',
    },
  },
  displays: [
    {
      type: 'LinearMultiSampleVariantDisplay',
      facet: { field: 'karyotype', sort: ['Standard', 'In(2L)t'] },
      rowColor: 'karyotype',
    },
  ],
}

// 250 kb bins: in 2 kb windows each group swings several fold.
const PI_RATIO_TRACK = pageTrack(POPGEN_DOC, 'pi_ratio_in2lt')

export const popgenSpecs: ScreenshotSpec[] = [
  // All six arms, so 2L's Fst reads against background. The plateau runs past
  // the drawn inversion to ~14 Mb, as Corbett-Detig & Hartl 2012 report; the
  // distal ~9 Mb sits at background, so do not caption it as the whole arm.
  {
    mode: 'url',
    name: 'popgen/fst_in2lt_2L',
    url: sessionSpec(DM6_HUB, {
      sessionTracks: [IN2LT_INVERSION_TRACK, FST_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'dm6',
          displayedRegionNames: [
            'chr2L',
            'chr2R',
            'chr3L',
            'chr3R',
            'chr4',
            'chrX',
          ],
          tracks: [
            {
              trackId: 'in2lt_inversion',
              height: 40,
            },
            {
              trackId: 'fst_in2lt',
              height: 240,
            },
          ],
        },
      ],
    }),
    readySelector: displayPainted('wiggle-display'),
    readyText: 'Fst',
    readyTimeout: 90000,
    viewportHeight: 560,
  },

  // Tajima's D and pi at Cyp6g1, read against the flanking windows, not zero
  // (see TAJD_TRACK).
  {
    mode: 'url',
    name: 'popgen/tajimad_cyp6g1',
    url: sessionSpec(DM6_HUB, {
      sessionTracks: [TAJD_TRACK, PI_TRACK, SITES_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'dm6',
          // At 2 Mb the dip was ~3% of the width and the gene lane a solid
          // wall.
          loc: 'chr2R:12,000,000-12,400,000',
          highlight: [
            {
              refName: 'chr2R',
              start: 12_130_000,
              end: 12_200_000,
              assemblyName: 'dm6',
              label: 'Cyp6g1',
            },
          ],
          tracks: [
            {
              trackId: 'tajd_all',
              height: 150,
            },
            {
              trackId: 'pi_all',
              height: 120,
            },
            {
              trackId: 'sites_all',
              height: 100,
            },
            {
              trackId: 'dm6-ncbiRefSeqCurated',
              // A gene lane cuts cleanly only at a multiple of its ~28.6 px row
              // pitch.
              height: 115,
              filter: ['geneLike'],
              // Name-only featureHighlights pin the match to the top row;
              // otherwise Cyp6g1 sits seven rows down a wall of CG numbers.
              featureHighlights: [
                { refName: 'chr2R', name: 'Cyp6g1' },
                { refName: 'chr2R', name: 'Cyp6g2' },
              ],
            },
          ],
        },
      ],
    }),
    readySelector: displayPainted('wiggle-display'),
    readyText: 'Tajima',
    readyTimeout: 90000,
    viewportHeight: 810,
    // Tajima's D is autoscaled to +3/-2, so the flanks below its zero line at
    // fracY 0.63 are the emptiest region in the frame and sit beside the dip.
    annotations: [
      {
        type: 'text',
        anchor: {
          trackId: 'tajd_all',
          loc: 'chr2R:12,008,000',
          fracY: 0.63,
          alignX: 'left',
        },
        text: "Cyp6g1, insecticide resistance. Tajima's D and π both\nfall against the flanking windows: a recent hard sweep.",
        fontSize: 15,
        maxWidth: 440,
      },
    ],
  },

  {
    mode: 'url',
    name: 'popgen/in2lt_inversion',
    url: sessionSpec(DM6_HUB, {
      sessionTracks: [IN2LT_INVERSION_TRACK, FST_TRACK, IN2LT_SV_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'dm6',
          displayedRegionNames: [
            'chr2L',
            'chr2R',
            'chr3L',
            'chr3R',
            'chr4',
            'chrX',
          ],
          tracks: [
            {
              trackId: 'in2lt_inversion',
              height: 40,
            },
            {
              trackId: 'fst_in2lt',
              height: 160,
            },
          ],
        },
        {
          type: 'LinearGenomeView',
          assembly: 'dm6',
          loc: 'chr2L',
          tracks: [
            {
              trackId: 'in2lt_inversion',
              height: 40,
            },
            {
              trackId: 'fst_in2lt',
              height: 130,
            },
            {
              trackId: 'dgrp_In2Lt_sv',
              variants: { show: true },
              // 2 px a row: auto-fit rows under a pixel alias into a smear.
              rowHeight: 2,
              height: 400,
            },
          ],
        },
      ],
    }),
    annotations: [
      {
        type: 'text',
        text: '19 In(2L)t carriers',
        anchor: {
          view: 1,
          trackId: 'dgrp_In2Lt_sv',
          loc: 'chr2L:7,000,000',
          fracY: 0.7,
        },
      },
      {
        type: 'arrow',
        fromAnchor: {
          view: 1,
          trackId: 'dgrp_In2Lt_sv',
          loc: 'chr2L:7,000,000',
          fracY: 0.78,
        },
        anchor: {
          view: 1,
          trackId: 'dgrp_In2Lt_sv',
          loc: 'chr2L:7,000,000',
          fracY: 0.947,
        },
      },
    ],
    readySelector: displayPainted('variant-display'),
    readyText: IN2LT_SV_TRACK.name,
    readyTimeout: 120000,
    viewportHeight: 1234,
  },

  {
    mode: 'url',
    name: 'popgen/in2lt_pi_ratio',
    url: sessionSpec(DM6_HUB, {
      sessionTracks: [IN2LT_INVERSION_TRACK, FST_TRACK, PI_RATIO_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'dm6',
          displayedRegionNames: [
            'chr2L',
            'chr2R',
            'chr3L',
            'chr3R',
            'chr4',
            'chrX',
          ],
          tracks: [
            {
              trackId: 'in2lt_inversion',
              height: 40,
            },
            {
              trackId: 'fst_in2lt',
              height: 160,
            },
          ],
        },
        {
          type: 'LinearGenomeView',
          assembly: 'dm6',
          loc: 'chr2L',
          tracks: [
            {
              trackId: 'in2lt_inversion',
              height: 40,
            },
            {
              trackId: 'fst_in2lt',
              height: 130,
            },
            {
              trackId: 'pi_ratio_in2lt',
              height: 180,
            },
          ],
        },
      ],
    }),
    readySelector: displayPainted('wiggle-display'),
    readyText: PI_RATIO_TRACK.name as string,
    readyTimeout: 120000,
    viewportHeight: 1014,
  },
]
