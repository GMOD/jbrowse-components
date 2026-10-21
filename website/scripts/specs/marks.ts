import { displayPainted } from '@jbrowse/browser-test-utils'

import {
  DEMO_CONFIG,
  sessionSpec,
  trackMenuIcon,
} from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// The Alu BED names its columns in a header, which makes `milliDiv` a field
const CONFIG = 'https://jbrowse.org/demos/gene_density/config.json'
const ALU_BED = 'https://jbrowse.org/demos/gene_density/Alu.bed.gz'

const ALU_MARKS_TRACK = {
  type: 'FeatureTrack',
  trackId: 'alu_marks',
  name: 'Alu elements',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'BedTabixAdapter',
    bedGzLocation: { uri: ALU_BED, locationType: 'UriLocation' },
    index: {
      location: { uri: `${ALU_BED}.tbi`, locationType: 'UriLocation' },
    },
  },
  displays: [
    {
      type: 'LinearMarkDisplay',
      displayId: 'alu_marks-LinearMarkDisplay',
      marks: [
        { mark: 'bar', encoding: { y: 'milliDiv' }, maxBpPerPx: 100 },
        {
          mark: 'bar',
          transform: [
            { type: 'bin', step: 10000 },
            {
              type: 'aggregate',
              groupby: ['start', 'end'],
              ops: [{ op: 'count' }],
            },
          ],
          encoding: { y: 'count' },
          minBpPerPx: 100,
        },
      ],
    },
  ],
}

const ALU_EDIT_PLOT_TRACK = {
  ...ALU_MARKS_TRACK,
  trackId: 'alu_edit_plot',
  displays: [
    {
      type: 'LinearMarkDisplay',
      displayId: 'alu_edit_plot-LinearMarkDisplay',
      marks: [
        { mark: 'bar', encoding: { y: 'milliDiv' }, maxBpPerPx: 100 },
        {
          mark: 'bar',
          transform: [
            { type: 'bin', step: 'auto' },
            { type: 'aggregate', ops: [{ op: 'count' }] },
          ],
          encoding: { y: 'count' },
          minBpPerPx: 100,
        },
      ],
    },
  ],
}

const SNRPN_FACET_TRACK = {
  type: 'AlignmentsTrack',
  trackId: 'snrpn_facet',
  name: 'HG002 ONT reads faceted by HP',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'BamAdapter',
    uri: 'https://jbrowse.org/demos/methylation/HG002_SNRPN_5mC_haplotagged.bam',
  },
  displays: [
    {
      type: 'LinearMarkDisplay',
      displayId: 'snrpn_facet-LinearMarkDisplay',
      transform: [
        { type: 'formula', expr: "jexl:getTag(feature,'HP')", as: 'HP' },
      ],
      facet: 'HP',
      marks: [
        {
          mark: 'span',
          transform: [{ type: 'pileup' }],
          encoding: {
            row: 'row',
            color: { field: 'HP', scale: 'categorical', title: 'Haplotype' },
          },
        },
      ],
    },
  ],
}

function aluMarksUrl(loc: string) {
  return sessionSpec(CONFIG, {
    sessionTracks: [ALU_MARKS_TRACK],
    views: [
      {
        type: 'LinearGenomeView',
        assembly: 'hg38',
        loc,
        tracks: [{ trackId: 'alu_marks', height: 160 }],
      },
    ],
  })
}

export const marksSpecs: ScreenshotSpec[] = [
  // the two frames must straddle the marks' 100 bp/px switch
  {
    mode: 'url',
    name: 'mark_display/multiscale',
    url: aluMarksUrl('chr1:150,000,000-153,000,000'),
    readySelector: displayPainted('mark-display'),
    readyTimeout: 90000,
    viewportHeight: 370,
    stages: [
      {},
      {
        url: aluMarksUrl('chr1:151,000,000-151,030,000'),
        readySelector: displayPainted('mark-display'),
      },
    ],
  },

  {
    mode: 'url',
    name: 'mark_display/facet',
    url: sessionSpec(DEMO_CONFIG, {
      sessionTracks: [SNRPN_FACET_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: 'chr15:24,900,000-25,000,000',
          tracks: [
            {
              trackId: 'snrpn_facet',
              height: 400,
              forceLoad: true,
            },
          ],
        },
      ],
    }),
    readySelector: displayPainted('mark-display'),
    readyTimeout: 150000,
    viewportHeight: 610,
  },

  {
    mode: 'url',
    name: 'mark_display/edit_plot',
    url: sessionSpec(CONFIG, {
      sessionTracks: [ALU_EDIT_PLOT_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: 'chr1:151,000,000-151,030,000',
          tracks: [
            {
              trackId: 'alu_edit_plot',
              height: 160,
            },
          ],
        },
      ],
    }),
    readySelector: displayPainted('mark-display'),
    readyTimeout: 90000,
    viewportHeight: 1000,
    hideSelectors: ['.MuiTooltip-popper'],
    tooltip: 'hide',
    actions: [
      trackMenuIcon('alu_edit_plot'),
      { type: 'waitForText', text: 'Edit marks...' },
      { type: 'click', text: 'Edit marks...' },
      { type: 'waitForText', text: 'Edit marks' },
      { type: 'waitForText', text: 'Marks draw in order' },
      { type: 'delay', ms: 500 },
    ],
  },
]

// Over a whole chromosome the Alu copies exceed the fetch budget, so the
// chromosome frame draws their density bigWig
const ALU_AGE_CONFIG = 'test_data/alu_age/config.json'
const ALU_YOUNG_SHARE = {
  trackId: 'alu_young_share',
  height: 90,
}
const ALU_AGE_TRACKS = [{ trackId: 'alu_age', height: 110 }, ALU_YOUNG_SHARE]
const ALU_CHROMOSOME_TRACKS = [
  { trackId: 'alu_per_kb', height: 110 },
  ALU_YOUNG_SHARE,
]

function aluAgeSpec(
  name: string,
  loc: string,
  tracks: object[],
  extra: Partial<ScreenshotSpec> = {},
): ScreenshotSpec {
  return {
    mode: 'url',
    name,
    url: sessionSpec(ALU_AGE_CONFIG, {
      views: [{ type: 'LinearGenomeView', assembly: 'hg38', loc, tracks }],
    }),
    readySelector: displayPainted('mark-display'),
    readyTimeout: 90000,
    ...extra,
  } as ScreenshotSpec
}

// partFrac's 12.4 and 2976 are the data area's offset and width in the 3000 px
// part (see ld/lct_sweep_two_scales)
const BINNED_START = 184_000_000
const BINNED_END = 212_000_000
const BINNED_LOC = `chr1:${BINNED_START + 1}-${BINNED_END}`
const CHR1_LENGTH = 248_956_422
const partFrac = (bp: number) => (12.4 + (bp / CHR1_LENGTH) * 2976) / 3000

export const aluAgeSpecs: ScreenshotSpec[] = [
  aluAgeSpec(
    'alu_age/locus',
    'chr1:151,000,000-151,030,000',
    [{ trackId: 'alu_age', height: 200 }],
    {
      viewportHeight: 410,
      annotations: [
        {
          type: 'text',
          text: 'Bar height: divergence from consensus. Older copies are taller',
          fontSize: 18,
          maxWidth: 400,
          anchor: {
            trackId: 'alu_age',
            loc: 'chr1:151,010,600',
            fracY: 0.05,
          },
        },
      ],
    },
  ),
  aluAgeSpec('alu_age/chromosome', 'chr1', ALU_CHROMOSOME_TRACKS, {
    viewportHeight: 465,
  }),
  aluAgeSpec('alu_age/binned', BINNED_LOC, ALU_AGE_TRACKS, {
    viewportHeight: 465,
    annotations: [
      {
        type: 'text',
        text: 'Alu sparse: young share high',
        fontSize: 18,
        leader: true,
        anchor: {
          trackId: 'alu_young_share',
          loc: 'chr1:191,500,000',
          fracY: 0.3,
        },
        dx: -40,
        dy: -95,
      },
      {
        type: 'text',
        text: 'Alu dense: young share low',
        fontSize: 18,
        leader: true,
        anchor: {
          trackId: 'alu_young_share',
          loc: 'chr1:203,500,000',
          fracY: 0.75,
        },
        dx: 80,
        dy: -177,
      },
    ],
  }),
  {
    mode: 'compose',
    name: 'alu_age/young_share',
    parts: ['alu_age/chromosome', 'alu_age/binned'],
    gutter: 70,
    annotations: [
      {
        type: 'trapezoid',
        fromAnchor: {
          selector: '[data-part="0"]',
          fracX: [partFrac(BINNED_START), partFrac(BINNED_END)],
        },
        anchor: { selector: '[data-part="1"]' },
      },
    ],
  },
]
