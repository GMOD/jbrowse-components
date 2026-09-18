import { displayPainted } from '@jbrowse/browser-test-utils'

import { sessionSpec } from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// NA12878's 30x Illumina reads (1000 Genomes high coverage, GRCh38) read as
// data by a mark display: depth as a coverage step, insert size as a point per
// pair, the reads a stack coloured by their insert, and a derived BED of the
// pairs over 1 kb scanning the chromosome for the same signature. The
// tutorial is docs/tutorials/read_marks.md; the deletion is a heterozygous
// 3.9 kb call in an intron of EFCAB8.
//
// The demo config (demos/read_marks/config.json) carries the two finished
// tracks and an hg38 whose sequence jbrowse.org serves: the CRAM decodes
// against it, and the UCSC hub's 2bit stalled three captures in a row.
const CONFIG = 'https://jbrowse.org/demos/read_marks/config.json'
const CRAM =
  'https://s3.amazonaws.com/1000genomes/1000G_2504_high_coverage/data/ERR3239334/NA12878.final.cram'

const DELETION = 'chr20:32,925,000-32,955,000'
const LEFT_BREAKPOINT = 'chr20:32,936,200-32,939,200'

// The two intermediate forms of the reads track the page builds up through,
// as session tracks under their own ids; the finished two-axes form is the
// config's `na12878_read_marks`.
const readsTrack = (trackId: string, marks: unknown[]) => ({
  type: 'AlignmentsTrack',
  trackId,
  name: 'NA12878 reads (1000 Genomes, 30x)',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'CramAdapter',
    cramLocation: { uri: CRAM },
    craiLocation: { uri: `${CRAM}.crai` },
  },
  displays: [
    {
      type: 'LinearMarkDisplay',
      displayId: `${trackId}-LinearMarkDisplay`,
      marks,
    },
  ],
})

const DEPTH_TRACK = readsTrack('na12878_read_depth', [
  {
    shape: 'bar',
    transform: [{ type: 'coverage' }],
    encoding: { y: 'coverage', color: '#c8d8ee' },
  },
])

const PILEUP_TRACK = readsTrack('na12878_read_pileup', [
  {
    shape: 'span',
    transform: [
      {
        type: 'formula',
        expr: 'jexl:abs(feature.template_length)',
        as: 'insert',
      },
      { type: 'stack' },
    ],
    encoding: {
      row: 'row',
      color: {
        field: 'insert',
        scale: 'linear',
        domain: [0, 5000],
        ramp: ['#c8d8ee', '#d62728'],
      },
    },
  },
])

const geneTrack = {
  trackId: 'ncbi_refseq_hg38',
  type: 'LinearBasicDisplay',
  height: 50,
  showOnlyGenes: true,
  geneGlyphMode: 'longestCoding',
}

function readsSpec(
  name: string,
  loc: string,
  trackId: string,
  height: number,
  sessionTracks: object[] = [],
): ScreenshotSpec {
  return {
    mode: 'url',
    name,
    url: sessionSpec(CONFIG, {
      sessionTracks,
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc,
          tracks: [geneTrack, { trackId, type: 'LinearMarkDisplay', height }],
        },
      ],
    }),
    readySelector: displayPainted('mark-display'),
    readyTimeout: 120000,
    hideSelectors: ['.MuiChip-root'],
    viewportHeight: height + 300,
  }
}

export const readMarksSpecs: ScreenshotSpec[] = [
  // 30 kb of an EFCAB8 intron: the read depth as bars, halving over the 3.9 kb
  // the callset says one chromosome lacks.
  readsSpec('read_marks/depth', DELETION, 'na12878_read_depth', 160, [
    DEPTH_TRACK,
  ]),
  // The same window with each pair's insert size as a point on the left axis
  // and the depth moved to an axis of its own on the right: a band of pairs
  // near 4.3 kb sits over the dip, in the colour of a full mapping quality.
  readsSpec('read_marks/insert_size', DELETION, 'na12878_read_marks', 260),
  // The left breakpoint at base resolution, the reads stacked and coloured
  // by their pair's insert: the spanning pairs' reads in red end at the
  // breakpoint, the rest in blue run through it.
  readsSpec('read_marks/pileup', LEFT_BREAKPOINT, 'na12878_read_pileup', 300, [
    PILEUP_TRACK,
  ]),
  // Chromosome 20 end to end over the derived BED: every pair under 20 kb as a
  // point, and the count per zoom-following bin of the deletion-sized ones on
  // a right axis pinned at 60, so the centromere's thousands saturate and the
  // deletions stand up as red bars.
  {
    mode: 'url',
    name: 'read_marks/chromosome',
    url: sessionSpec(CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: 'chr20',
          tracks: [
            {
              trackId: 'na12878_chr20_pairs',
              type: 'LinearMarkDisplay',
              height: 260,
            },
          ],
        },
      ],
    }),
    readySelector: displayPainted('mark-display'),
    readyTimeout: 120000,
    viewportHeight: 470,
    // The tallest bar outside the centromere is the homozygous deletion the
    // tutorial names at 34.2 Mb.
    annotations: [
      {
        type: 'text',
        text: 'a tall red bar: a deletion on both copies',
        maxWidth: 420,
        fontSize: 18,
        leader: true,
        anchor: {
          track: 'na12878_chr20_pairs',
          locus: 'chr20:34,250,000',
          fracY: 0.3,
        },
        dx: 80,
      },
      {
        type: 'text',
        text: 'centromere: pairs mis-mapped in repeats',
        fontSize: 18,
        leader: true,
        anchor: {
          track: 'na12878_chr20_pairs',
          locus: 'chr20:26,300,000',
          fracY: 0.5,
        },
        dx: -80,
      },
    ],
  },
]
