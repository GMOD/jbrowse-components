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
    goal: 'Sort 198 BXD mouse strains by genotype under the Tyrp1 peak',
    url: unsorted,
    // Nothing here adds a view or opens a drawer and the painting is a fixed
    // 420, so the app holds at 811px across the tour, with the caption chip's
    // strip under it.
    viewportHeight: 930,
    readySelector: displaySettled('multirow-display'),
    readyTimeout: 180000,
    steps: [
      { type: 'hover', selector: '[aria-label="JBrowse"]', hold: 0 },
      {
        type: 'delay',
        ms: 2500,
        say: 'Each strain is a mosaic of B and D blocks, in load order',
      },
      {
        type: 'rightclick',
        anchor: { track: paintingTrackId, locus: peakLocus, fracY: 0.25 },
        say: 'Right-click under the peak and sort the rows by genotype there',
        hold: 1600,
      },
      { type: 'waitForText', text: 'Sort rows by color here' },
      { type: 'click', text: 'Sort rows by color here' },
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
      {
        type: 'delay',
        ms: 3500,
        say: 'Sorted, the strains split into B above D under the peak',
      },
    ],
    tailMs: 3500,
  },
]
