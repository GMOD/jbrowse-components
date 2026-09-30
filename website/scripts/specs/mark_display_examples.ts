import { displayPainted } from '@jbrowse/browser-test-utils'

import { sessionSpec } from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// One figure per section of docs/config_guides/mark_display_examples.md, each
// the track config that section shows, over the hosted file it names.
const GENE_DENSITY_CONFIG = 'https://jbrowse.org/demos/gene_density/config.json'
const READ_MARKS_CONFIG = 'https://jbrowse.org/demos/read_marks/config.json'
const ALU_BED = 'https://jbrowse.org/demos/gene_density/Alu.bed.gz'
const PAIRS_BED =
  'https://jbrowse.org/demos/read_marks/NA12878.chr20.discordant_pairs.bed.gz'
const PUR_CNV = 'https://jbrowse.org/genomes/GRCh38/1000g/kidd_lab_cnv/PUR'
const HPYLORI_CONFIG = 'https://jbrowse.org/demos/hpylori/config.json'

const ALU_LOCUS = 'chr1:151,000,000-151,030,000'
const ALU_REGION = 'chr1:150,000,000-153,000,000'

function aluTrack(trackId: string, name: string, display: object) {
  return {
    type: 'FeatureTrack',
    trackId,
    name,
    assemblyNames: ['hg38'],
    adapter: { type: 'BedTabixAdapter', uri: ALU_BED },
    displays: [
      {
        type: 'LinearMarkDisplay',
        displayId: `${trackId}-LinearMarkDisplay`,
        ...display,
      },
    ],
  }
}

const TRACKS = {
  alu_bars: aluTrack('alu_bars', 'Alu divergence', {
    marks: [{ mark: 'bar', encoding: { y: 'milliDiv' } }],
  }),
  alu_points: aluTrack('alu_points', 'Alu divergence by strand', {
    marks: [
      {
        mark: 'point',
        encoding: {
          y: 'milliDiv',
          size: 8,
          color: {
            field: 'strand',
            domain: ['1', '-1'],
            labels: ['+', '-'],
            title: 'Strand',
          },
          shape: {
            field: 'strand',
            domain: ['1', '-1'],
            range: ['circle', 'triangle-down'],
            labels: ['+', '-'],
            title: '',
          },
        },
      },
    ],
  }),
  alu_ramp: aluTrack('alu_ramp', 'Alu divergence, viridis', {
    marks: [
      {
        mark: 'bar',
        encoding: {
          y: 'milliDiv',
          color: {
            field: 'milliDiv',
            scale: 'linear',
            scheme: 'viridis',
            domainMin: 0,
            domainMax: 300,
            title: 'Divergence',
          },
        },
      },
    ],
  }),
  alu_threshold: aluTrack('alu_threshold', 'Alu age classes', {
    marks: [
      {
        mark: 'bar',
        encoding: {
          y: 'milliDiv',
          color: {
            field: 'milliDiv',
            scale: 'threshold',
            domain: [80, 150],
            range: ['#d73027', '#fdae61', '#4575b4'],
            title: 'Divergence',
          },
        },
      },
    ],
  }),
  alu_histogram: aluTrack('alu_histogram', 'Alu copies per bin', {
    scales: { y: { title: 'Copies per bin' } },
    marks: [
      {
        mark: 'bar',
        transform: [
          { type: 'bin', step: 'auto' },
          { type: 'aggregate', ops: [{ op: 'count' }] },
        ],
        encoding: { color: { value: '#7f7f7f' } },
      },
    ],
  }),
  alu_mean: aluTrack('alu_mean', 'Mean Alu divergence per bin', {
    scales: { y: { title: 'Mean divergence' } },
    marks: [
      {
        mark: 'bar',
        transform: [
          { type: 'bin', step: 'auto' },
          { type: 'aggregate', ops: [{ op: 'mean', field: 'milliDiv' }] },
        ],
        encoding: { color: { value: '#7f7f7f' } },
      },
    ],
  }),
  alu_pileup: aluTrack('alu_pileup', 'Alu copies, packed', {
    marks: [
      {
        mark: 'span',
        transform: [{ type: 'pileup', padding: 200 }],
        encoding: {
          color: {
            field: 'strand',
            domain: ['1', '-1'],
            labels: ['+', '-'],
            title: 'Strand',
          },
        },
      },
    ],
  }),
  alu_facet: aluTrack('alu_facet', 'Alu copies by strand', {
    facet: { field: 'strand', transform: [{ type: 'pileup' }] },
    marks: [{ mark: 'span', encoding: { color: { value: '#4575b4' } } }],
  }),
  alu_labels: aluTrack('alu_labels', 'Alu divergence, labelled', {
    marks: [
      { mark: 'bar', encoding: { y: 'milliDiv', color: { value: '#c8d8ee' } } },
      {
        mark: 'text',
        encoding: { y: 'milliDiv', text: 'name' },
        maxBpPerPx: 50,
      },
    ],
  }),
  alu_rules: aluTrack('alu_rules', 'Alu divergence, with rules', {
    scales: {
      y: {
        title: 'Divergence, per mille',
        rules: [{ value: 80, color: '#d73027', label: 'young' }, 150],
      },
    },
    marks: [{ mark: 'bar', encoding: { y: 'milliDiv' } }],
  }),
  pair_links: {
    type: 'FeatureTrack',
    trackId: 'pair_links',
    name: 'NA12878 pairs over 1 kb, as arcs',
    assemblyNames: ['hg38'],
    adapter: { type: 'BedTabixAdapter', uri: PAIRS_BED },
    displays: [
      {
        type: 'LinearMarkDisplay',
        displayId: 'pair_links-LinearMarkDisplay',
        marks: [
          {
            mark: 'link',
            transform: [{ type: 'filter', expr: 'jexl:feature.tlen < 20000' }],
            encoding: {
              color: {
                field: 'score',
                scale: 'linear',
                domainMin: 0,
                domainMax: 60,
                range: ['#bdbdbd', '#1f4e9a'],
                title: 'Mapping quality',
              },
            },
          },
        ],
      },
    ],
  },
  hpylori_identity: {
    type: 'SyntenyTrack',
    trackId: 'hpylori_identity',
    name: '26695 against J99, percent identity',
    assemblyNames: ['GCF_000982695.1', 'GCF_000307795.1'],
    adapter: {
      type: 'PairwiseIndexedPAFAdapter',
      uri: 'https://jbrowse.org/demos/hpylori/26695_vs_j99.pif.gz',
      assemblyNames: ['GCF_000982695.1', 'GCF_000307795.1'],
    },
    displays: [
      {
        type: 'LinearMarkDisplay',
        displayId: 'hpylori_identity-LinearMarkDisplay',
        scales: { y: { domainMin: 0.5, domainMax: 1, title: 'Identity' } },
        marks: [{ mark: 'rule', encoding: { y: 'identity', size: 2 } }],
      },
    ],
  },
  pur_cnv_rows: {
    type: 'MultiQuantitativeTrack',
    trackId: 'pur_cnv_rows',
    name: 'Copy number, six PUR individuals',
    assemblyNames: ['hg38'],
    adapter: {
      type: 'MultiWiggleAdapter',
      bigWigs: [
        'HG01177',
        'HG01083',
        'HG01070',
        'HG01395',
        'HG00731',
        'HG00553',
      ].map(name => `${PUR_CNV}/${name}.qm2.CN.1k.bw`),
    },
    displays: [
      {
        type: 'LinearMarkDisplay',
        displayId: 'pur_cnv_rows-LinearMarkDisplay',
        rows: 'source',
        scales: { y: { domainMin: 0, domainMax: 10, title: 'Copies' } },
        marks: [
          {
            mark: 'bar',
            encoding: { y: 'score', color: { value: '#4575b4' } },
          },
        ],
      },
    ],
  },
}

function exampleSpec(
  name: string,
  trackId: keyof typeof TRACKS,
  loc: string,
  {
    config = GENE_DENSITY_CONFIG,
    assembly = 'hg38',
    height = 160,
    viewportHeight = 370,
  } = {},
): ScreenshotSpec {
  return {
    mode: 'url',
    name: `mark_display_examples/${name}`,
    url: sessionSpec(config, {
      sessionTracks: [TRACKS[trackId]],
      views: [
        {
          type: 'LinearGenomeView',
          assembly,
          loc,
          tracks: [{ trackId, type: 'LinearMarkDisplay', height }],
        },
      ],
    }),
    readySelector: displayPainted('mark-display'),
    readyTimeout: 90000,
    viewportHeight,
  }
}

export const markDisplayExampleSpecs: ScreenshotSpec[] = [
  exampleSpec('bars', 'alu_bars', ALU_LOCUS),
  exampleSpec('points', 'alu_points', ALU_LOCUS),
  exampleSpec('ramp', 'alu_ramp', ALU_LOCUS),
  exampleSpec('threshold', 'alu_threshold', ALU_LOCUS),
  exampleSpec('histogram', 'alu_histogram', ALU_REGION),
  exampleSpec('mean', 'alu_mean', ALU_REGION),
  exampleSpec('pileup', 'alu_pileup', ALU_LOCUS),
  exampleSpec('facet', 'alu_facet', ALU_LOCUS, {
    height: 200,
    viewportHeight: 410,
  }),
  exampleSpec('labels', 'alu_labels', ALU_LOCUS),
  exampleSpec('rules', 'alu_rules', ALU_LOCUS),
  exampleSpec('links', 'pair_links', 'chr20:32,925,000-32,955,000', {
    config: READ_MARKS_CONFIG,
  }),
  exampleSpec('rows', 'pur_cnv_rows', 'chr17:36,193,000-36,198,000', {
    height: 300,
    viewportHeight: 510,
  }),
  exampleSpec(
    'identity',
    'hpylori_identity',
    'NC_018939.1:1,035,000-1,080,000',
    {
      config: HPYLORI_CONFIG,
      assembly: 'GCF_000307795.1',
      height: 200,
      viewportHeight: 410,
    },
  ),
]
