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

// The Alu tutorial's track (docs/tutorials/alu_age.md): each copy's divergence
// from its consensus as a bar coloured by lineage zoomed in, the count per
// zoom-following bin with the AluY count over it zoomed out, and the
// make-density sidecar past the fetch budget, all from one marks list.
const ALU_AGE_TRACK = {
  ...ALU_MARKS_TRACK,
  trackId: 'alu_age',
  name: 'Alu copies',
  displays: [
    {
      type: 'LinearMarkDisplay',
      displayId: 'alu_age-LinearMarkDisplay',
      marks: [
        {
          shape: 'bar',
          transform: [
            {
              type: 'formula',
              expr: 'jexl:substring(feature.name, 0, 4)',
              as: 'lineage',
            },
          ],
          encoding: {
            y: 'milliDiv',
            color: {
              field: 'lineage',
              scale: 'categorical',
              domain: ['AluJ', 'AluS', 'AluY', 'FLAM', 'FRAM'],
              palette: ['#4575b4', '#fdae61', '#d73027', '#8c8c8c', '#8c8c8c'],
            },
          },
          maxBpPerPx: 100,
        },
        {
          shape: 'bar',
          source: 'density',
          transform: [
            { type: 'bin', step: 'auto' },
            {
              type: 'aggregate',
              groupby: ['start', 'end'],
              ops: [{ op: 'count' }],
            },
          ],
          encoding: { y: 'count', color: '#c0c0c0' },
          minBpPerPx: 100,
        },
        {
          shape: 'bar',
          transform: [
            { type: 'filter', expr: "jexl:startsWith(feature.name, 'AluY')" },
            { type: 'bin', step: 'auto' },
            {
              type: 'aggregate',
              groupby: ['start', 'end'],
              ops: [{ op: 'count' }],
            },
          ],
          encoding: { y: 'count', color: '#d73027' },
          minBpPerPx: 100,
        },
      ],
    },
  ],
}

function aluAgeSpec(name: string, loc: string): ScreenshotSpec {
  return {
    mode: 'url',
    name,
    url: sessionSpec(CONFIG, {
      sessionTracks: [ALU_AGE_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc,
          tracks: [
            { trackId: 'alu_age', type: 'LinearMarkDisplay', height: 200 },
          ],
        },
      ],
    }),
    readySelector: displayPainted('mark-display'),
    readyTimeout: 90000,
    settleMs: 8000,
    viewportHeight: 410,
  }
}

export const aluAgeSpecs: ScreenshotSpec[] = [
  // 30 kb of 1q21: one bar per Alu copy, its height the copy's divergence from
  // its consensus and its colour the lineage read off the name, with the key.
  aluAgeSpec('alu_age/locus', 'chr1:151,000,000-151,030,000'),
  // 10 Mb of 1q21 to 1q23: the copies per zoom-following bin in grey, with the
  // AluY copies per bin over them in the lineage's colour.
  aluAgeSpec('alu_age/binned', 'chr1:150,000,000-160,000,000'),
  // Chromosome 1 end to end, past the fetch budget: the sidecar's bins draw as
  // the count mark, the chip names them, and the AluY mark draws nothing.
  aluAgeSpec('alu_age/chromosome', 'chr1'),
]
