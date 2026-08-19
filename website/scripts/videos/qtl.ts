// The BXD systems-genetics tour.
import { displaySettled } from '@jbrowse/browser-test-utils'

import { qtlVideoFixtures } from '../specs/qtl.ts'

import type { VideoSpec } from '../video-spec-types.ts'

const { unsorted, paintingTrackId, peakLocus } = qtlVideoFixtures

export const qtlVideos: VideoSpec[] = [
  // THE MENU ITEM AS THE CAUSE. `qtl/bxd_painting_sorted`'s own spec comment
  // says what it cannot do: "We only OPEN the menu (rightclick + wait); we never
  // click the item, so the already-sorted painting stays sorted underneath it."
  // So the published still is a context menu hovering over a painting that a
  // declarative `sortRowsBy` had already sorted, and the reader is shown a
  // result staged as its own cause.
  //
  // The film is the only thing that makes the item the cause. It opens on the
  // recombinant mosaic 198 strains actually arrive in, right-clicks the column
  // under the QTL peak, and the rows resolve into the B block over the D block
  // that the Manhattan signal above is a statement about.
  {
    name: 'qtl/painting_sort',
    description:
      "Sorting the BXD haplotype painting by genotype at the Tyrp1 peak: the recombinant mosaic 198 strains load in, the painting's own right-click menu, and the B/D split the peak is a statement about",
    url: unsorted,
    // Nothing here adds a view or opens a drawer and the painting is a fixed
    // 420, so the app's height does not move across the tour; the figure beside
    // it captures the same two lanes at 840.
    viewportHeight: 850,
    readySelector: displaySettled('multirow-display'),
    readyTimeout: 180000,
    settleMs: 14000,
    steps: [
      // The before, held. A reader who has already scrolled past the sorted
      // figure needs a moment to register that these rows are not in that order.
      { type: 'delay', ms: 2500 },
      {
        type: 'rightclick',
        anchor: { track: paintingTrackId, locus: peakLocus, fracY: 0.25 },
        say: 'Right-click the painting under the peak',
        hold: 1600,
      },
      { type: 'waitForText', text: 'Sort rows by color here' },
      {
        type: 'click',
        text: 'Sort rows by color here',
        say: 'Sort rows by color here',
      },
      // The sort runs over features already loaded, so this is a repaint rather
      // than a fetch — but it is 198 rows of run-length blocks across 156 Mb,
      // which under a software rasterizer is a held frame rather than an
      // animation.
      {
        type: 'waitForSelector',
        selector: displaySettled('multirow-display'),
        timeout: 180000,
        cut: true,
      },
      { type: 'delay', ms: 3000 },
    ],
    tailMs: 3500,
  },
]
