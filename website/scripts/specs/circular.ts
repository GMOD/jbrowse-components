import { displayPainted } from '@jbrowse/browser-test-utils'

import { sessionSpec } from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

const DEMO = 'test_data/config_demo.json'

// Built by scripts/build_circular_synteny.sh.
const CIRCULAR_SYNTENY =
  'https://jbrowse.org/demos/circular_synteny/config.json'
const CHROMOSOMES = [
  ...Array.from({ length: 19 }, (_, i) => `chr${i + 1}`),
  'chrX',
]
const LIFTOVER = 'hg38ToMm39_liftover'
const DENSITY_RING = {
  trackId: 'hg38ToMm39_gene_density',
  mark: 'span',
  color: {
    field: 'score',
    scale: 'linear',
    range: ['#ffffff', '#d95f02'],
  },
  height: 40,
}

function circularSyntenyView(
  displayedRegionNames: string[],
  tracks: unknown[],
  extra: Record<string, unknown> = {},
) {
  return sessionSpec(CIRCULAR_SYNTENY, {
    views: [
      {
        type: 'CircularView',
        assembly: ['hg38', 'mm39'],
        displayedRegionNames,
        height: 780,
        filter: [{ field: 'length', gte: 100000 }],
        tracks,
        ...extra,
      },
    ],
  })
}

// Built by scripts/build_circular_synteny.sh (QUERY=panTro6) and
// scripts/build_circular_synteny_fasta.sh.
const demoConfig = (name: string) =>
  `https://jbrowse.org/demos/${name}/config.json`
const HUMAN_AUTOSOMES = Array.from({ length: 22 }, (_, i) => `chr${i + 1}`)

const circularSyntenyReady = {
  readySelector: displayPainted('circular-chord-display'),
  readyTimeout: 180000,
  viewportWidth: 1000,
  viewportHeight: 900,
} as const

const COLO829_COVERAGE = {
  type: 'MultiQuantitativeTrack',
  trackId: 'colo829_coverage_pair',
  name: 'COLO829 coverage',
  assemblyNames: ['hg19'],
  adapter: {
    type: 'MultiWiggleAdapter',
    subadapters: [
      {
        type: 'BigWigAdapter',
        name: 'Tumor',
        color: '#d7191c',
        bigWigLocation: {
          uri: 'https://jbrowse.org/genomes/hg19/COLO829/colo_tumor.bw',
        },
      },
      {
        type: 'BigWigAdapter',
        name: 'Normal',
        color: '#2c7bb6',
        bigWigLocation: {
          uri: 'https://jbrowse.org/genomes/hg19/COLO829/colo_normal.bw',
        },
      },
    ],
  },
}

export const circularSpecs: ScreenshotSpec[] = [
  {
    mode: 'url',
    name: 'circular_view/coverage_ring_chords',
    url: sessionSpec(DEMO, {
      views: [
        {
          type: 'CircularView',
          assembly: 'hg19',
          height: 780,
          showLegend: true,
          tracks: [
            {
              trackId: 'ngmlr_cov',
              scales: { y: { type: 'log' } },
              height: 80,
            },
            'breast_cancer_sniffles_hg19_traonly_tabix',
          ],
        },
      ],
    }),
    readySelector: displayPainted('circular-ring-canvas'),
    readyTimeout: 120000,
    viewportWidth: 1000,
    viewportHeight: 900,
  },

  // No legend: the view's key shows one swatch for the whole track, in the
  // first source's color. The caption names the two bands. Tumor sits outside
  // because an inner band resolves coarser.
  {
    mode: 'url',
    name: 'circular_view/tumor_normal_rings',
    url: sessionSpec(DEMO, {
      sessionTracks: [COLO829_COVERAGE],
      views: [
        {
          type: 'CircularView',
          assembly: 'hg19',
          height: 780,
          tracks: [
            {
              trackId: 'colo829_coverage_pair',
              rows: { field: 'source', sort: ['Tumor', 'Normal'] },
              scales: { y: { domainMin: 0, domainMax: 100 } },
              height: 140,
            },
            'truthset_somaticSVs_COLO829',
          ],
        },
      ],
    }),
    readySelector: displayPainted('circular-ring-canvas'),
    readyTimeout: 180000,
    viewportWidth: 1000,
    viewportHeight: 900,
  },

  {
    mode: 'url',
    name: 'circular_synteny/ribbons',
    url: circularSyntenyView(CHROMOSOMES, [LIFTOVER]),
    ...circularSyntenyReady,
  },

  {
    mode: 'url',
    name: 'circular_synteny/band_hover',
    url: circularSyntenyView(CHROMOSOMES, [LIFTOVER]),
    ...circularSyntenyReady,
    tooltip: 'expect',
    clicksOpen: "a chromosome band's tooltip",
    actions: [
      { type: 'hover', anchor: { ideogram: 'mm39 chr11' } },
      { type: 'delay', ms: 1500 },
    ],
  },

  {
    mode: 'url',
    name: 'circular_synteny/color_by_strand',
    url: circularSyntenyView(CHROMOSOMES, [LIFTOVER], {
      color: { field: 'strand' },
      showLegend: true,
    }),
    ...circularSyntenyReady,
  },

  {
    mode: 'url',
    name: 'circular_synteny/rings',
    url: circularSyntenyView(CHROMOSOMES, [DENSITY_RING, LIFTOVER], {
      showLegend: true,
    }),
    readySelector: displayPainted('circular-ring-canvas'),
    readyTimeout: 180000,
    viewportWidth: 1000,
    viewportHeight: 900,
  },

  {
    mode: 'url',
    name: 'circular_synteny/x_control',
    url: circularSyntenyView(
      ['chr1', 'chr2', 'chrX'],
      [DENSITY_RING, LIFTOVER],
      {
        showLegend: true,
      },
    ),
    readySelector: displayPainted('circular-ring-canvas'),
    readyTimeout: 180000,
    viewportWidth: 1000,
    viewportHeight: 900,
  },

  {
    mode: 'url',
    name: 'circular_synteny/ribbon_hover',
    url: circularSyntenyView(
      ['chr1', 'chr2', 'chrX'],
      [DENSITY_RING, LIFTOVER],
      {
        showLegend: true,
      },
    ),
    readySelector: displayPainted('circular-ring-canvas'),
    readyTimeout: 180000,
    tooltip: 'expect',
    clicksOpen: "a ribbon's tooltip",
    actions: [
      { type: 'hover', anchor: { chord: 'chrX:10,447,551..34,924,653' } },
      { type: 'delay', ms: 1500 },
    ],
    annotations: [
      {
        type: 'text',
        text: 'Hovered ribbon',
        leader: true,
        // the overlay resolves no chord anchor; the id is the PIF row index
        // plus the first genome, stable while the file is
        anchor: { selector: 'path[data-testid="ribbon-28-t-hg38"]' },
        dx: 200,
        dy: 140,
      },
    ],
    viewportWidth: 1000,
    viewportHeight: 900,
  },
  {
    mode: 'url',
    name: 'circular_synteny/chimp_strand',
    url: sessionSpec(demoConfig('circular_synteny_chimp'), {
      views: [
        {
          type: 'CircularView',
          assembly: ['hg38', 'panTro6'],
          displayedRegionNames: {
            hg38: [...HUMAN_AUTOSOMES, 'chrX'],
            panTro6: [
              'chr1',
              'chr2A',
              'chr2B',
              ...HUMAN_AUTOSOMES.slice(2),
              'chrX',
            ],
          },
          height: 780,
          filter: [{ field: 'length', gte: 100000 }],
          color: { field: 'strand' },
          showLegend: true,
          tracks: ['hg38ToPanTro6_liftover'],
        },
      ],
    }),
    ...circularSyntenyReady,
  },

  {
    mode: 'url',
    name: 'circular_synteny/yersinia',
    url: sessionSpec(demoConfig('circular_synteny_yersinia'), {
      views: [
        {
          type: 'CircularView',
          assembly: ['CO92', 'KIM'],
          height: 780,
          filter: [{ field: 'length', gte: 5000 }],
          color: { field: 'strand' },
          showLegend: true,
          tracks: ['KIM_to_CO92'],
        },
      ],
    }),
    ...circularSyntenyReady,
  },

  {
    mode: 'url',
    name: 'circular_synteny/brassica_triplication',
    url: sessionSpec(demoConfig('circular_synteny_brassica'), {
      views: [
        {
          type: 'CircularView',
          assembly: ['TAIR10', 'Brapa'],
          displayedRegionNames: { TAIR10: ['Chr4'] },
          height: 780,
          filter: [{ field: 'length', gte: 1000 }],
          tracks: ['Brapa_to_TAIR10'],
        },
      ],
    }),
    ...circularSyntenyReady,
  },

  {
    mode: 'url',
    name: 'circular_synteny/brassica_mosaic',
    url: sessionSpec(demoConfig('circular_synteny_brassica'), {
      views: [
        {
          type: 'CircularView',
          assembly: ['TAIR10', 'Brapa'],
          height: 780,
          filter: [{ field: 'length', gte: 1000 }],
          tracks: ['Brapa_to_TAIR10'],
        },
      ],
    }),
    ...circularSyntenyReady,
  },
]
