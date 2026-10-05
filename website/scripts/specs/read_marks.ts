import { displayPainted } from '@jbrowse/browser-test-utils'

import { sessionSpec } from '../screenshot-spec-helpers.ts'

import type {
  ScreenshotSpec,
  SessionUrlSpec,
} from '../screenshot-spec-types.ts'

// NA12878's 30x Illumina reads (1000 Genomes high coverage, GRCh38) read as
// data by a mark display: depth as a coverage step, insert size as a point per
// pair, and a derived BED of the pairs over 1 kb scanning the chromosome for
// the same signature. The tutorial is docs/tutorials/read_marks.md; the
// deletion is a heterozygous 3.9 kb call in an intron of EFCAB8.
//
// The demo config (demos/read_marks/config.json) carries the four finished
// tracks and an hg38 whose sequence and cytobands jbrowse.org serves: the CRAM
// decodes against it, and the UCSC hub's 2bit stalled three captures in a row.
// Depth and insert size are a track each, and so are the chromosome scan's
// points and its per-bin counts — a mark display draws one y axis.
const CONFIG = 'https://jbrowse.org/demos/read_marks/config.json'
const DELETION = 'chr20:32,925,000-32,955,000'

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
  marks: [string, number][],
): SessionUrlSpec {
  const tracks = marks.map(([trackId, height]) => ({
    trackId,
    type: 'LinearMarkDisplay',
    height,
  }))
  return {
    mode: 'url',
    name,
    url: sessionSpec(CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc,
          tracks: [geneTrack, ...tracks],
        },
      ],
    }),
    readySelector: displayPainted('mark-display'),
    readyTimeout: 120000,
    hideSelectors: ['.MuiChip-root'],
    viewportHeight: marks.reduce((a, [, h]) => a + h, 0) + 300,
  }
}

export const readMarksSpecs: ScreenshotSpec[] = [
  // 30 kb of an EFCAB8 intron: the read depth as bars, halving over the 3.9 kb
  // the callset says one chromosome lacks.
  readsSpec('read_marks/depth', DELETION, [['na12878_read_depth', 160]]),
  // The same window with the depth above and each pair's insert size below on
  // a track of its own: a band of pairs near 4.3 kb sits over the dip, in the
  // colour of a full mapping quality.
  {
    ...readsSpec('read_marks/insert_size', DELETION, [
      ['na12878_read_depth', 120],
      ['na12878_read_marks', 200],
    ]),
    viewportHeight: 655,
  },
  // Chromosome 20 end to end over the derived BED: every pair under 20 kb as a
  // point, and under it the count per zoom-following bin of the deletion-sized
  // ones on an axis pinned at 60, so the centromere's thousands saturate and
  // the deletions stand up as red bars.
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
              height: 160,
            },
            {
              trackId: 'na12878_chr20_pair_counts',
              type: 'LinearMarkDisplay',
              height: 100,
            },
          ],
        },
      ],
    }),
    readySelector: displayPainted('mark-display'),
    readyTimeout: 120000,
    viewportHeight: 510,
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
          trackId: 'na12878_chr20_pair_counts',
          loc: 'chr20:34,250,000',
          fracY: 0.3,
        },
        dx: 80,
        dy: -8,
      },
      {
        type: 'text',
        text: 'centromere: pairs mis-mapped in repeats',
        fontSize: 18,
        leader: true,
        anchor: {
          trackId: 'na12878_chr20_pairs',
          loc: 'chr20:26,300,000',
          fracY: 0.5,
        },
        dx: -80,
      },
    ],
  },
]
