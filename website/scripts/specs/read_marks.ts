import { displayPainted } from '@jbrowse/browser-test-utils'

import { sessionSpec } from '../screenshot-spec-helpers.ts'

import type {
  ScreenshotSpec,
  SessionUrlSpec,
} from '../screenshot-spec-types.ts'

// The demo config serves its own hg38 sequence for the CRAM; the UCSC hub's
// 2bit stalls captures. A mark display draws one y axis, so each measure is a
// track of its own.
const CONFIG = 'https://jbrowse.org/demos/read_marks/config.json'
const DELETION = 'chr20:32,925,000-32,955,000'

const geneTrack = {
  trackId: 'ncbi_refseq_hg38',
  height: 50,
  filter: ['geneLike'],
  geneGlyphMode: 'longestCoding',
}

function readsSpec(
  name: string,
  loc: string,
  marks: [string, number][],
): SessionUrlSpec {
  const tracks = marks.map(([trackId, height]) => ({
    trackId,
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
  readsSpec('read_marks/depth', DELETION, [['na12878_read_depth', 160]]),
  {
    ...readsSpec('read_marks/insert_size', DELETION, [
      ['na12878_read_depth', 120],
      ['na12878_read_marks', 200],
    ]),
    viewportHeight: 655,
  },
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
              height: 160,
            },
            {
              trackId: 'na12878_chr20_pair_counts',
              height: 100,
            },
          ],
        },
      ],
    }),
    readySelector: displayPainted('mark-display'),
    readyTimeout: 120000,
    viewportHeight: 510,
    // 34.2 Mb is the homozygous deletion the tutorial names
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
