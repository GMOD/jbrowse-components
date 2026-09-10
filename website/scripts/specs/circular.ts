import { displayPainted } from '@jbrowse/browser-test-utils'

import { sessionSpec } from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

const DEMO = 'test_data/config_demo.json'

// hg38 and mm39 on one circle, from scripts/build_circular_synteny.sh: the
// UCSC hg38ToMm39 liftOver chain cut to its blocks of 100 kb and over, and a
// RefSeq gene density bigWig per genome. Behind tutorials/circular_synteny.md.
const CIRCULAR_SYNTENY = encodeURIComponent(
  'https://jbrowse.org/demos/circular_synteny/config.json',
)
const CHROMOSOMES = [
  ...Array.from({ length: 19 }, (_, i) => `chr${i + 1}`),
  'chrX',
]
const BLOCKS = 'hg38ToMm39_blocks'
// gene density as a heat strip: the average over each pixel's bins, so a
// megabase-per-pixel ring reads genes per bin rather than the bin maximum
const DENSITY_RING = {
  trackId: 'hg38ToMm39_gene_density',
  type: 'LinearWiggleDisplay',
  defaultRendering: 'density',
  summaryScoreMode: 'avg',
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
        tracks,
        ...extra,
      },
    ],
  })
}

const circularSyntenyReady = {
  readySelector: displayPainted('circular-chord-display'),
  readyTimeout: 180000,
  settleMs: 10000,
  viewportWidth: 1000,
  viewportHeight: 900,
} as const

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
          tracks: [
            {
              trackId: 'ngmlr_cov',
              type: 'LinearWiggleDisplay',
              scaleType: 'log',
              height: 80,
            },
            'breast_cancer_sniffles_hg19_traonly_tabix',
          ],
        },
      ],
    }),
    readySelector: displayPainted('circular-ring-canvas'),
    readyTimeout: 120000,
    settleMs: 10000,
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
    url: circularSyntenyView(CHROMOSOMES, [BLOCKS]),
    ...circularSyntenyReady,
  },

  // The same circle with a gene density ring per genome inside the ideogram,
  // so a ribbon's two ends can be read against how gene-rich each is.
  {
    mode: 'url',
    name: 'circular_synteny/rings',
    url: circularSyntenyView(CHROMOSOMES, [DENSITY_RING, BLOCKS]),
    readySelector: displayPainted('circular-ring-canvas'),
    readyTimeout: 180000,
    settleMs: 10000,
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
    url: circularSyntenyView(['chr1', 'chr2', 'chrX'], [DENSITY_RING, BLOCKS]),
    readySelector: displayPainted('circular-ring-canvas'),
    readyTimeout: 180000,
    settleMs: 10000,
    viewportWidth: 1000,
    viewportHeight: 900,
  },

  // Hovering the widest X ribbon fills it in the hover colour and the
  // browser's tooltip names the alignment: both loci and which way round they
  // read, the row the PIF holds. The click that opens the feature details
  // panel is not filmed: the panel reads its containing view as a linear one
  // and throws on the circle today.
  {
    mode: 'url',
    name: 'circular_synteny/ribbon_hover',
    url: circularSyntenyView(['chr1', 'chr2', 'chrX'], [DENSITY_RING, BLOCKS]),
    readySelector: displayPainted('circular-ring-canvas'),
    readyTimeout: 180000,
    settleMs: 10000,
    actions: [
      { type: 'hover', anchor: { chord: 'chrX:10,447,551..34,924,653' } },
      { type: 'delay', ms: 1500 },
    ],
    annotations: [
      {
        type: 'text',
        text: 'Hovered: the tooltip names both ends of the block and its strand',
        maxWidth: 260,
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
