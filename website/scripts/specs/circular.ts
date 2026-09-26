import { displayPainted } from '@jbrowse/browser-test-utils'

import { sessionSpec } from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

const DEMO = 'test_data/config_demo.json'

// hg38 and mm39 on one circle, from scripts/build_circular_synteny.sh: the
// UCSC hg38ToMm39 liftOver chain as jbrowse.org indexes it, with the view's
// length filter keeping rows under 100 kb off the figure, and a RefSeq gene
// density bigWig per genome. Behind tutorials/circular_synteny.md.
const CIRCULAR_SYNTENY = encodeURIComponent(
  'https://jbrowse.org/demos/circular_synteny/config.json',
)
const CHROMOSOMES = [
  ...Array.from({ length: 19 }, (_, i) => `chr${i + 1}`),
  'chrX',
]
const LIFTOVER = 'hg38ToMm39_liftover'
// gene density as a heat strip: the average over each pixel's bins, so a
// megabase-per-pixel ring reads genes per bin rather than the bin maximum.
// Orange, so the ring and the steel-blue ribbons read as two things.
const DENSITY_RING = {
  trackId: 'hg38ToMm39_gene_density',
  type: 'LinearWiggleDisplay',
  mark: 'heatmap',
  summaryScoreMode: 'avg',
  color: {
    field: 'score',
    scale: 'threshold',
    range: ['#e01e26', '#d95f02'],
  },
  height: 40,
}

// autoDiagonalize on every one of these: the mouse chromosomes are laid out to
// follow the human order and mirrored, which is what turns the ribbons from a
// bundle through the middle into a band between the two arcs.
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
        autoDiagonalize: true,
        minAlignmentLength: 100000,
        tracks,
        ...extra,
      },
    ],
  })
}

const circularSyntenyReady = {
  readySelector: displayPainted('circular-chord-display'),
  readyTimeout: 180000,
  viewportWidth: 1000,
  viewportHeight: 900,
} as const

// COLO829's tumour and its matched normal from one MultiQuantitativeTrack, the
// two MinION coverage bigWigs named and coloured per subtrack. On rows they take
// a band each inside the one ring, against an explicit domain so the two bands
// share a scale and the comparison is the picture.
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
  // SKBR3 on hg19: the sample's long-read coverage as a ring around the
  // ideogram, its Sniffles translocations as chords through the middle. The
  // ring is the wiggle display's own strip wrapped around the circle, so the
  // copy-number steps read where the chords land.
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
              type: 'LinearWiggleDisplay',
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

  // The same sample pair a linear view would stack: one ring holding a band per
  // source, with the somatic SV truth set as chords. What the rows buy is the
  // control — a tumour step is a step only against a normal that holds level
  // across the same stretch.
  //
  // No legend. A ring is the display's canvas alone, so the row labels naming
  // each source never reach it, and the view's own key falls back to one swatch
  // for the whole track — in the colour of whichever source it takes first. The
  // caption names the two bands instead.
  //
  // The row order is stated because an inner ring resamples the same strip and
  // so resolves coarser, which on its own would make whichever band is outside
  // look the more structured one. Shot both ways round: the steps stay with the
  // tumour either way, and the tumour is outside here for its own legibility.
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
              type: 'LinearWiggleDisplay',
              rows: { field: 'source', domain: ['Tumor', 'Normal'] },
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

  // The two genomes' chromosomes around one circle, human first, and every
  // block of the chain as a ribbon between the stretch it covers on each. An
  // autosome's ribbons fan out across several of the other genome's
  // chromosomes; the two X chromosomes hold one bundle, and the reorder puts
  // that bundle's two arcs beside each other.
  {
    mode: 'url',
    name: 'circular_synteny/ribbons',
    url: circularSyntenyView(CHROMOSOMES, [LIFTOVER]),
    ...circularSyntenyReady,
  },

  // The same circle with every ribbon in the colour of the human chromosome it
  // leaves, which is the Circos convention: a human chromosome's ribbons can be
  // followed to each mouse chromosome that carries part of it, and the X pair
  // holds one colour.
  {
    mode: 'url',
    name: 'circular_synteny/color_by_chromosome',
    url: circularSyntenyView(CHROMOSOMES, [LIFTOVER], {
      color: { field: 'query' },
    }),
    ...circularSyntenyReady,
  },

  // The same circle with a gene density ring per genome inside the ideogram,
  // so a ribbon's two ends can be read against how gene-rich each is.
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

  // Three chromosomes of each genome: the X pair against two autosomes. The
  // autosomes cross-wire and the X ribbons stay between the two X arcs, with
  // nothing joining either X to an autosome. The reorder mirrors the mouse arc,
  // so mouse chrX faces human chrX across the shortest span on the circle.
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

  // Hovering the widest X ribbon fills it in the hover colour, and the tooltip
  // names its span in each genome.
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
    actions: [
      { type: 'hover', anchor: { chord: 'chrX:10,447,551..34,924,653' } },
      { type: 'delay', ms: 1500 },
    ],
    annotations: [
      {
        type: 'text',
        text: 'Hovered ribbon',
        leader: true,
        // the overlay resolves no chord anchor, so the pill points at the
        // path's own box; the id is the PIF row's index and the perspective it
        // was reached from — the human one, since the circle lists that
        // genome's regions first and the ribbon dedupe keeps the first of the
        // two — stable while the file is
        anchor: { selector: 'path[data-testid="ribbon-28-t-hg38"]' },
        dx: 200,
        dy: 140,
      },
    ],
    viewportWidth: 1000,
    viewportHeight: 900,
  },
]
