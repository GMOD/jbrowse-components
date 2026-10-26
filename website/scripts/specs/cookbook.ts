import {
  DEMO_CONFIG,
  HG38_RMSK_TRACK,
  lgvSession,
  sessionSpec,
} from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// Session tracks don't inherit the config's baseUri, so the urls are absolute.
// The eight samples cover every copy-number level and step pattern the 104 PUR
// samples show over AMY1A.
const PUR_CNV = 'https://jbrowse.org/genomes/GRCh38/1000g/kidd_lab_cnv/PUR'

// Okabe-Ito, ordered so neighboring rows never share a hue.
const COOKBOOK_MULTIWIG_SAMPLES = [
  { name: 'HG01080', color: '#0072B2' },
  { name: 'HG01054', color: '#D55E00' },
  { name: 'HG00739', color: '#009E73' },
  { name: 'HG00553', color: '#CC79A7' },
  { name: 'HG01070', color: '#E69F00' },
  { name: 'HG00554', color: '#56B4E9' },
  { name: 'HG00551', color: '#8B008B' },
  { name: 'HG01083', color: '#666666' },
]

const COOKBOOK_MULTIWIG_TRACK = {
  type: 'MultiQuantitativeTrack',
  trackId: 'cookbook_multiwig',
  name: 'PUR copy number (8 samples)',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'MultiWiggleAdapter',
    subadapters: COOKBOOK_MULTIWIG_SAMPLES.map(({ name, color }) => ({
      type: 'BigWigAdapter',
      name,
      color,
      bigWigLocation: {
        uri: `${PUR_CNV}/${name}.qm2.CN.1k.bw`,
        locationType: 'UriLocation',
      },
    })),
  },
}

// The object **Color by -> Strand** writes, as docs/cookbook.md teaches it.
const STRAND_COLOR = { field: 'strand' }

// The recipe docs/cookbook.md teaches.
const RMSK_CLASS_COLOR = {
  field: 'repClass',
  scale: {
    domain: ['SINE', 'LINE', 'LTR', 'DNA', 'Simple_repeat', 'Low_complexity'],
    range: ['#e41a1c', '#377eb8', '#4daf4a', '#984ea3', '#ff7f00', '#a65628'],
    names: ['SINE', 'LINE', 'LTR', 'DNA', 'Simple repeat', 'Low complexity'],
  },
}

// Each spec applies a docs/cookbook.md recipe's exact config to a demo track, so
// a recipe whose syntax goes stale changes its figure.
export const cookbookSpecs: ScreenshotSpec[] = [
  // The chr17p13 window holds genes on both strands, so both colors show.
  {
    mode: 'url',
    name: 'cookbook_color_by_strand',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg38',
      loc: 'chr17:7,400,000-7,700,000',
      tracks: [
        {
          trackId: 'ncbi_refseq_109_hg38',
          height: 260,
          encoding: { color: STRAND_COLOR },
        },
      ],
    }),
    readyText: 'NCBI RefSeq',
    readyTimeout: 60000,
    viewportHeight: 460,
  },

  {
    mode: 'url',
    name: 'cookbook_color_by_type',
    url: sessionSpec(DEMO_CONFIG, {
      sessionTracks: [
        {
          ...HG38_RMSK_TRACK,
          displays: [
            {
              type: 'LinearBasicDisplay',
              encoding: { color: RMSK_CLASS_COLOR },
            },
          ],
        },
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: 'chr17:45,700,000-45,750,000',
          tracks: [
            {
              trackId: 'rmsk_hg38_ucsc',
              // the repeats pack into about seven rows here
              height: 260,
            },
          ],
        },
      ],
    }),
    readyText: 'RepeatMasker',
    readyTimeout: 60000,
    viewportWidth: 1200,
    viewportHeight: 465,
  },

  // The figure above's data with the class as the row, in the same colors so
  // the pair reads as one dataset.
  {
    mode: 'url',
    name: 'cookbook_color_by_type_rows',
    url: sessionSpec(DEMO_CONFIG, {
      sessionTracks: [HG38_RMSK_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: 'chr17:45,700,000-45,750,000',
          tracks: [
            {
              trackId: 'rmsk_hg38_ucsc',
              type: 'LinearMultiRowFeatureDisplay',
              rows: {
                field: 'repClass',
                sort: [
                  'SINE',
                  'LINE',
                  'LTR',
                  'DNA',
                  'Simple_repeat',
                  'Low_complexity',
                ],
              },
              rowColor: {
                scale: {
                  domain: [
                    'SINE',
                    'LINE',
                    'LTR',
                    'DNA',
                    'Simple_repeat',
                    'Low_complexity',
                  ],
                  range: [
                    '#e41a1c',
                    '#377eb8',
                    '#4daf4a',
                    '#984ea3',
                    '#ff7f00',
                    '#a65628',
                  ],
                },
              },
              axis: { grid: true },
              height: 260,
            },
          ],
        },
      ],
    }),
    readyText: 'RepeatMasker',
    readyTimeout: 60000,
    viewportWidth: 1200,
    viewportHeight: 465,
  },

  // The parts share track, window and capture size, so only the display
  // differs between them. The cookbook shows them separately, each under its
  // config.
  {
    mode: 'compose',
    name: 'cookbook_color_by_type_two_ways',
    parts: ['cookbook_color_by_type', 'cookbook_color_by_type_rows'],
  },

  // The window reaches past the amylase CNV so the flat-2 flanks give every
  // trace a baseline; a window inside the CNV has none.
  {
    mode: 'url',
    name: 'cookbook_multiwig',
    url: sessionSpec(DEMO_CONFIG, {
      sessionTracks: [COOKBOOK_MULTIWIG_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: 'chr1:102,900,000-104,400,000',
          tracks: [
            // below 130 the last pseudogene row clips mid-label
            { trackId: 'ncbi_refseq_109_hg38', height: 130 },
            {
              trackId: 'cookbook_multiwig',
              height: 480,
              mark: 'line',
              // Per-row autoscale fills every row with its own plateau and hides
              // the copy-number differences; 5 leaves headroom above 4.
              encoding: { y: { scale: { domainMin: 0, domainMax: 5 } } },
            },
          ],
        },
      ],
    }),
    readyText: 'NCBI RefSeq',
    readyTimeout: 60000,
    // below 860 the last trace clips
    viewportHeight: 860,
  },
]
