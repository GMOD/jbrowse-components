// The tours over the variant tutorials, where the subject is a display the
// track menu switches to rather than a file the reader prepares.
import { trioVideoFixtures } from '../specs/trio.ts'
import { LOCATION_BOX, trackMenu } from './shared.ts'

import type { VideoSpec } from '../video-spec-types.ts'

const { defaultDisplay, matrixLoc, vcfTrackId } = trioVideoFixtures

export const variantVideos: VideoSpec[] = [
  // TWO MENU PICKS THAT analyze_trio.md SPENDS THREE SECTIONS AND FOUR FIGURES
  // ON. `trio-matrix`, `trio-matrix-phased` and `trio-matrix-phased-clean` are
  // one route: the same track, the same window, the display type and then the
  // rendering mode. Each figure holds one state of it, with the menu cascade
  // that produced the state pasted over the state itself, so the page reads as
  // three features rather than as one track being set up.
  //
  // What the stills cannot carry is that the six rows ARE the three: phased
  // splits each sample into its two haplotypes in place, so the child's pair
  // arrives above the mother's pair above the father's. A reader looking at the
  // three-row frame and the six-row frame has no way to see which row became
  // which, and that correspondence is what the rest of the page reasons over —
  // every crossover argument later on is about the child's two rows against the
  // parents' four.
  //
  // It opens on the display the track loads with, which is where a reader
  // opening the VCF is standing, and it ends by zooming out to the window the
  // figures are taken in. That last move is not decoration: the default display
  // refuses 2.9 Mb of this VCF at one feature per pixel, and the matrix draws it
  // because a column is a variant rather than a position. So the clip also
  // carries why the display exists, which the page states nowhere.
  {
    name: 'variants/trio_phased_matrix',
    description:
      "A trio VCF becomes six haplotype rows: the track menu's Display types, the multi-sample matrix, then Rendering mode Phased splitting each of the three samples into its two haplotypes",
    url: defaultDisplay,
    // The matrix is the tall state and the app grows into it — the default
    // display is a single lane of boxes. One frame serves both, so it is sized
    // to the end state, which is what trio-matrix-phased-clean is captured at
    // (597, at the content height); the blank under the opening lane is the
    // matrix's room rather than slack. Even, per the encode.
    viewportHeight: 620,
    readySelector: '::-p-text(NCBI RefSeq)',
    readyTimeout: 120000,
    settleMs: 12000,
    steps: [
      // The state the page's first figure is of, held: one lane, one box per
      // variant, and nothing in it about who carries what.
      { type: 'delay', ms: 2500 },
      {
        type: 'click',
        selector: trackMenu(vcfTrackId),
        say: 'Track menu',
        hold: 1200,
      },
      { type: 'waitForText', text: 'Display types' },
      {
        type: 'click',
        text: 'Display types',
        say: 'Display types',
        hold: 1200,
      },
      { type: 'waitForText', text: 'Multi-sample variant display (matrix)' },
      {
        type: 'click',
        text: 'Multi-sample variant display (matrix)',
        say: 'Multi-sample variant display (matrix)',
      },
      // The matrix asks for every genotype in the window rather than re-laying
      // out what the lane had, so this is a fetch. Off camera, and the click
      // ahead of it stays on.
      { type: 'waitForAppSettled', timeout: 180000, cut: true },
      // Three rows, one per sample, and the connector zone tying each column
      // back to its position. Held long enough to count the rows, because the
      // next step is about what happens to them.
      { type: 'delay', ms: 3500 },
      {
        type: 'click',
        selector: trackMenu(vcfTrackId),
        say: 'Track menu',
        hold: 1200,
      },
      { type: 'waitForText', text: 'Rendering mode' },
      {
        type: 'click',
        text: 'Rendering mode',
        say: 'Rendering mode',
        hold: 1200,
      },
      { type: 'waitForText', text: 'Phased' },
      { type: 'click', text: 'Phased', say: 'Phased' },
      { type: 'waitForAppSettled', timeout: 180000, cut: true },
      // Six rows: child, mother, father, each split into hap1 above hap2. The
      // beat the whole page rests on.
      { type: 'delay', ms: 3500 },
      // Out to the figures' window, typed the way a reader would. 2.9 Mb of
      // this VCF is columns the phased rows read as blocks, and it is the scale
      // every crossover argument later on the page is made at.
      {
        type: 'type',
        selector: LOCATION_BOX,
        value: matrixLoc,
        clear: true,
        say: matrixLoc,
      },
      { type: 'press', key: 'Enter' },
      { type: 'waitForAppSettled', timeout: 180000, cut: true },
      { type: 'delay', ms: 4000 },
    ],
    tailMs: 4500,
  },
]
