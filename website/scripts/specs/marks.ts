import { displayPainted } from '@jbrowse/browser-test-utils'

import { VOLVOX, sessionSpec } from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// The gene-density demo's Alu BED (UCSC RepeatMasker rows, header-named
// columns), re-declared with a mark display: two marks over one fetch, the
// count per 10 kb drawing zoomed out and each element's divergence zoomed in.
const CONFIG = 'https://jbrowse.org/demos/gene_density/config.json'
const ALU_BED = 'https://jbrowse.org/demos/gene_density/Alu.bed.gz'

const ALU_DENSITY_BW =
  'https://jbrowse.org/demos/gene_density/Alu.bed.density.bw'

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
    densityAdapter: {
      type: 'BigWigAdapter',
      bigWigLocation: { uri: ALU_DENSITY_BW, locationType: 'UriLocation' },
    },
  },
  displays: [
    {
      type: 'LinearMarkDisplay',
      displayId: 'alu_marks-LinearMarkDisplay',
      marks: [
        { shape: 'bar', encoding: { y: 'milliDiv' }, maxBpPerPx: 100 },
        {
          shape: 'bar',
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

// The same track past the fetch budget: the raw mark is off, the binned one
// cannot fetch, and a third mark reads the make-density sidecar instead.
const ALU_SIDECAR_TRACK = {
  ...ALU_MARKS_TRACK,
  trackId: 'alu_sidecar',
  displays: [
    {
      type: 'LinearMarkDisplay',
      displayId: 'alu_sidecar-LinearMarkDisplay',
      marks: [
        { shape: 'bar', encoding: { y: 'milliDiv' }, maxBpPerPx: 100 },
        {
          shape: 'bar',
          source: 'density',
          encoding: { y: 'count' },
          minBpPerPx: 100,
        },
      ],
    },
  ],
}

// The volvox BAM as a mark display: every read's mapping quality on the
// shared axis, and the coverage over them on an axis of its own.
const READS_TWO_AXES_TRACK = {
  type: 'AlignmentsTrack',
  trackId: 'reads_two_axes',
  name: 'Reads',
  assemblyNames: ['volvox'],
  adapter: {
    type: 'BamAdapter',
    bamLocation: {
      uri: 'https://jbrowse.org/code/jb2/latest/test_data/volvox/volvox-sorted.bam',
      locationType: 'UriLocation',
    },
    index: {
      location: {
        uri: 'https://jbrowse.org/code/jb2/latest/test_data/volvox/volvox-sorted.bam.bai',
        locationType: 'UriLocation',
      },
    },
  },
  displays: [
    {
      type: 'LinearMarkDisplay',
      displayId: 'reads_two_axes-LinearMarkDisplay',
      marks: [
        {
          shape: 'bar',
          transform: [{ type: 'coverage' }],
          encoding: {
            y: { field: 'coverage', resolve: 'independent' },
            color: '#c8d8ee',
          },
        },
        { shape: 'point', encoding: { y: 'score' } },
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
        tracks: [
          { trackId: 'alu_marks', type: 'LinearMarkDisplay', height: 160 },
        ],
      },
    ],
  })
}

export const marksSpecs: ScreenshotSpec[] = [
  // Reads over a 5 kb window: coverage in the hundreds as bars on the right
  // axis, and each read's mapping quality as a point on the left.
  {
    mode: 'url',
    name: 'mark_display/two_axes',
    url: sessionSpec(VOLVOX, {
      sessionTracks: [READS_TWO_AXES_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:1-5,000',
          tracks: [
            {
              trackId: 'reads_two_axes',
              type: 'LinearMarkDisplay',
              height: 200,
            },
          ],
        },
      ],
    }),
    readySelector: displayPainted('mark-display'),
    readyTimeout: 90000,
    settleMs: 6000,
    viewportHeight: 400,
  },

  // Chromosome 1 end to end, past the byte budget: the sidecar's bins draw in
  // the banner's place, with the chip naming them.
  {
    mode: 'url',
    name: 'mark_display/density_sidecar',
    url: sessionSpec(CONFIG, {
      sessionTracks: [ALU_SIDECAR_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: 'chr1',
          tracks: [
            { trackId: 'alu_sidecar', type: 'LinearMarkDisplay', height: 160 },
          ],
        },
      ],
    }),
    readySelector: displayPainted('mark-display'),
    readyTimeout: 90000,
    settleMs: 8000,
    viewportHeight: 370,
  },

  // Two frames of the same track: 3 Mb of 1q21, where only the binned mark is
  // in range and the axis is counts, then 30 kb of it, where only the raw mark
  // is and the axis is each Alu's divergence from its consensus.
  {
    mode: 'url',
    name: 'mark_display/multiscale',
    url: aluMarksUrl('chr1:150,000,000-153,000,000'),
    readySelector: displayPainted('mark-display'),
    readyTimeout: 90000,
    settleMs: 6000,
    viewportHeight: 370,
    stages: [
      {},
      {
        url: aluMarksUrl('chr1:151,000,000-151,030,000'),
        readySelector: displayPainted('mark-display'),
      },
    ],
  },
]

// The Alu tutorial (docs/tutorials/alu_age.md). The config carries the tracks:
// the copies as a mark display, and the per-megabase BED build_alu_age.sh
// writes, plotted twice, as the AluY share against the genome-wide share and
// as the plus-strand share against a half, the split that should come out flat.
const ALU_AGE_CONFIG = 'test_data/alu_age/config.json'
const ALU_AGE_TRACKS = [
  { trackId: 'alu_age', type: 'LinearMarkDisplay', height: 110 },
  { trackId: 'alu_young_share', type: 'LinearMarkDisplay', height: 90 },
  { trackId: 'alu_strand_share', type: 'LinearMarkDisplay', height: 90 },
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
    settleMs: 8000,
    ...extra,
  } as ScreenshotSpec
}

// A stretch where a run of Alu-sparse megabases meets a run of dense ones. The
// wedge's narrow end is that span as a fraction of the composed part's width:
// the data area starts at 12.4 of 3000 px and spans 2976 (see
// ld/lct_sweep_two_scales)
const BINNED_START = 184_000_000
const BINNED_END = 212_000_000
const BINNED_LOC = `chr1:${BINNED_START + 1}-${BINNED_END}`
const CHR1_LENGTH = 248_956_422
const partFrac = (bp: number) => (12.4 + (bp / CHR1_LENGTH) * 2976) / 3000

export const aluAgeSpecs: ScreenshotSpec[] = [
  aluAgeSpec(
    'alu_age/locus',
    'chr1:151,000,000-151,030,000',
    [{ trackId: 'alu_age', type: 'LinearMarkDisplay', height: 200 }],
    {
      viewportHeight: 410,
      annotations: [
        {
          type: 'text',
          text: 'Bar height: divergence from consensus. Older copies are taller',
          fontSize: 18,
          maxWidth: 700,
          anchor: {
            track: 'alu_age',
            locus: 'chr1:151,007,500',
            fracY: 0.12,
          },
        },
      ],
    },
  ),
  aluAgeSpec('alu_age/chromosome', 'chr1', ALU_AGE_TRACKS, {
    viewportHeight: 580,
    annotations: [
      {
        type: 'text',
        text: 'Control: the strand split stays level',
        fontSize: 18,
        maxWidth: 500,
        anchor: {
          track: 'alu_strand_share',
          locus: 'chr1:134,000,000',
          fracY: 0.2,
        },
      },
    ],
  }),
  aluAgeSpec('alu_age/binned', BINNED_LOC, ALU_AGE_TRACKS, {
    viewportHeight: 580,
    annotations: [
      {
        type: 'text',
        text: 'Alu sparse: more young copies',
        fontSize: 18,
        leader: true,
        anchor: {
          track: 'alu_young_share',
          locus: 'chr1:191,500,000',
          fracY: 0.3,
        },
        dx: -40,
        dy: -95,
      },
      {
        type: 'text',
        text: 'Alu dense: fewer young copies',
        fontSize: 18,
        leader: true,
        anchor: {
          track: 'alu_young_share',
          locus: 'chr1:203,500,000',
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
