// The Hi-C tour, whose subject is a location box rather than a menu.
import { displaySettled } from '@jbrowse/browser-test-utils'

import { hicVideoFixtures } from '../specs/hic.ts'
import { LOCATION_BOX } from './shared.ts'

import type { VideoSpec } from '../video-spec-types.ts'

const { chr9Only, junctionLoc } = hicVideoFixtures

export const hicVideos: VideoSpec[] = [
  // THE PAGE'S CENTRAL CLAIM IS A CHANGE, and hic_structural_variants.md states
  // it twice in prose because a still cannot hold it: "the matrix is fetched for
  // every pair of displayed regions ... open a second and JBrowse also fetches
  // the contacts BETWEEN the two". `hic/bcr_abl1_translocation` is of the state
  // after, with both windows already open and both callouts already on it, so
  // the reader is shown a wedge and told what it would have been. The wedge
  // appearing is the argument.
  //
  // What the tour adds beyond the appearing: that nothing was configured. The
  // section says so outright — "nothing needs configuring for this; it falls out
  // of navigating to two locations at once" — and a figure of a finished view
  // cannot distinguish that from a session someone set up. One text entry into
  // the box the reader already uses is the whole of it.
  //
  // The terminal scan two sections down is deliberately not filmed. It prints a
  // ranking, which is text, and a page can print text.
  {
    name: 'hic/two_regions',
    description:
      "One chr9 window becomes two: the chr22 window typed into the location box beside it, and the wedge between each track's two triangles filling in K562 while it stays empty in GM12878",
    url: chr9Only,
    // The figure's own frame. Its tracks are the figure's tracks at the figure's
    // heights — a 68px gene lane over two 380px matrices — and the figure is
    // captured at 1100, so the app's height here is the same 1100 whatever the
    // window holds: a matrix lane is a fixed height and clips its own triangle
    // rather than growing.
    //
    // WHAT THE WIDTH DOES TO THE PICTURE, since a tour is filmed at 1920 where a
    // figure is captured at 1500 and the matrix is the one display whose CONTENT
    // depth is a function of screen width. Two things scale with it, and only one
    // is settled:
    //
    //  - Triangle depth. A pair drawn at screen positions x1, x2 sits at depth
    //    |x2-x1|/2, so every apex is 1.28x deeper here than the numbers in the
    //    figure's own comment (its deepest is ~296 css px, i.e. ~379 at this
    //    width). That is inside a 380px lane, by a pixel. If a mid-clip frame
    //    shows an apex cut off, both lanes want ~430 and the frame ~1200 — and
    //    nothing in the run reports it, since a clipped triangle is a display
    //    overflowing its own fixed height rather than content past the frame.
    //  - Binsize. The display takes the largest binsize no coarser than twice
    //    bpPerPx, and these files carry 100 bp up to 2.5 Mb, so which level the
    //    two-region state lands on turns on whether the track area is wider or
    //    narrower than 1600 css px: at 1600 exactly, 2*bpPerPx is 5000 and it
    //    takes 5 kb, which is what the figure gets at 1500; any wider and it
    //    takes 2 kb, and 2 kb over this window is the red speckle the page warns
    //    about two sections up. Should the first take come back as speckle,
    //    `resolutionBias: 1` on both matrices steps it back to the figure's 5 kb
    //    — the slot the page already sends a reader to for exactly this.
    //
    // 1124 rather than the figure's 1100: the run reported 12px of app below
    // the frame, which is the bottom matrix's own lower edge rather than
    // anything the figure has to hold.
    viewportHeight: 1124,
    // `displaySettled`, not the figures' `displayPainted`: `drawn` flips on
    // first paint, which an empty canvas mid-fetch satisfies, and the opening
    // beat is ABOUT what is on the diagonal and what is not beside it.
    readySelector: displaySettled('hic-display'),
    // The figure's budget for the same two files. It measured ~50s for the pair
    // at three region pairs per track; the opening window here is one region and
    // therefore cheaper, and the navigation below pays the figure's price.
    readyTimeout: 240000,
    settleMs: 20000,
    steps: [
      { type: 'hover', selector: '[aria-label="JBrowse"]', hold: 0 },
      // One region, held: each lane is a chromosome against itself, and there is
      // nothing beside it. The state the section's claim is made against.
      { type: 'delay', ms: 4000 },
      // The page's instruction, performed: "typing both into the location box
      // separated by a space". `clear: true` because the box already holds the
      // chr9 window, and held long enough afterwards to read both loci in it —
      // the space between them is the entire syntax being taught.
      {
        type: 'type',
        selector: LOCATION_BOX,
        value: junctionLoc,
        clear: true,
        say: 'Both windows in the box, separated by a space',
        hold: 1800,
      },
      // Cut on the PRESS, which is where the time goes: the run reported 11.3s
      // filmed on this step alone, since committing the locstring re-lays the
      // view out and kicks both fetches off on the main thread. The typing ahead
      // of it stays on camera, and a keypress moves no cursor, so nothing
      // visible is lost.
      { type: 'press', key: 'Enter', cut: true },
      // A second region is a second PAIR, not a wider fetch: each track now asks
      // for chr9xchr9, chr22xchr22 and chr9xchr22 over range requests into a
      // 55GB and a 20GB file. Minutes, so off camera, with the keypress ahead of
      // it left on.
      { type: 'waitForAppSettled', timeout: 240000, cut: true },
      // The beat the tour exists for: two triangles per lane, and between them a
      // block that is one cell line's fused chromosome and the other's
      // background. The chip NAMES that block, which nothing on screen labels;
      // what it means is the page's caption, and a chip cannot make the claim
      // anyway — the line goes up when the step starts, which here is before
      // there is a wedge to make it about.
      {
        type: 'delay',
        ms: 5000,
        say: 'chr9 against chr22',
      },
    ],
    tailMs: 5000,
  },
]
