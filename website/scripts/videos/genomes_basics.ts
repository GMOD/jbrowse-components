// The tours over the genomes.jbrowse.org tutorials, where the subject is a
// hosted catalog nobody configured: the track a reader has not found yet, and
// the columns of the one they have.
import { genomesBasicsVideoFixtures } from '../specs/genomes_basics.ts'
import { displayReady, trackMenu } from './shared.ts'

import type { VideoSpec } from '../video-spec-types.ts'

const {
  geneTrackOnly,
  gnomadTrackId,
  phylopTrackId,
  phylopTrackName,
  plofFilter,
  unfilteredGnomad,
} = genomesBasicsVideoFixtures

// The drawer toggle, by the title MUI hangs off it. It says which way it goes,
// so the two halves of the round trip are two different selectors — and the
// view body renders a second "Open track selector" button whenever no track is
// on, which is what makes a text match on that phrase ambiguous.
const OPEN_SELECTOR = 'button[title="Open track selector"]'
const CLOSE_SELECTOR = 'button[title="Close track selector"]'

// The dialog's real textarea, not the aria-hidden autosize shadow MUI renders
// beside it, which takes no keystrokes.
const FILTER_FIELD = '.MuiDialog-container textarea:not([aria-hidden="true"])'

// Where the pointer parks. A bare SVG <g> with no handler, clear of the tracks
// and of every control that carries a tooltip — which the gnomAD lane needs
// more than most, since its config declares a nine-line `mouseover`.
const WORDMARK = '[aria-label="JBrowse"]'

export const genomesBasicsVideos: VideoSpec[] = [
  // The REDRAW, which genomes_basics.md asserts and pictures nowhere: "the
  // track redraws with the records that pass all of them", and then "the
  // loss-of-function filter leaves a track drawn in one colour". The figure
  // beside it (gnomad_filter_menu) stops at the dialog with the expression
  // typed in, and the three frames that used to show the lane before and after
  // were deleted on review as too much page for a difference living in a sixth
  // of each. A clip is the form that difference fits in: one lane, one window,
  // and the whole change on the same pixels.
  //
  // It is also the only dialog on the page a reader has to type into. Every
  // other state genomes_basics.md reaches is a checkbox or a menu radio, and
  // the jexl line is the one place a reader has to know a column name — so the
  // clip's middle is the empty dialog and what goes in it.
  //
  // WHAT THE ROW BECOMES IS NOT FILMED, and the first take is why. Once a
  // filter is in effect `filterMenuItems` turns that row into a submenu holding
  // "Edit filters..." and "Clear all filters" — a real affordance the page did
  // not mention — and reopening the menu for one beat to show it put the whole
  // cascade in the last quarter of the run. The recorder's stop() timed out and
  // the clip ended on the open menu, so the poster was a cascade standing over
  // the payoff. The submenu is a sentence on the page now; the clip's last
  // state change is the redraw, which is what a reader is here for anyway.
  {
    name: 'genomes_basics/gnomad_filter',
    description:
      'gnomAD v4.1 Exomes over TP53 cut down to its predicted loss-of-function records: Track menu, Filter by..., a jexl line typed into the empty Add track filters dialog, and the lane redrawing under it',
    url: unfilteredGnomad,
    // Sized to the DIALOG, which the run's content report cannot see: it
    // measures the app, and Add track filters is ~490px of centred dialog on
    // top of one. The fixture's taller lane is what keeps the rest of the frame
    // from being page background once the dialog goes. Even, per the encode.
    viewportHeight: 640,
    // The lane has to be carrying records before the camera starts — a tour of
    // an empty track being filtered is a tour of nothing — and hgdownload is
    // the slowest host anything on this page touches.
    readySelector: displayReady(`${gnomadTrackId}-LinearBasicDisplay`),
    readyTimeout: 240000,
    settleMs: 12000,
    steps: [
      // The camera parks the pointer at the top middle of the frame, which on a
      // full-width LGV is the overview's cytoband strip, and the view writes
      // whatever is under it into its own title bar.
      { type: 'hover', selector: WORDMARK, hold: 0 },
      // Every record the exome callset has over this window, in the colours the
      // published file carries.
      { type: 'delay', ms: 2500 },
      {
        type: 'click',
        selector: trackMenu(gnomadTrackId),
        say: 'Track menu',
        hold: 1200,
      },
      { type: 'waitForText', text: 'Filter by...' },
      { type: 'click', text: 'Filter by...', say: 'Filter by...' },
      { type: 'waitForText', text: 'Add track filters' },
      // The dialog opens EMPTY on this track, which is the state the page's
      // "the dialog takes one jexl expression per line" describes and the thing
      // a reader most needs to see before being told to type into it: the
      // examples are the dialog's own, and none of them is about this file.
      { type: 'delay', ms: 2200 },
      {
        type: 'type',
        selector: FILTER_FIELD,
        value: plofFilter,
        say: plofFilter,
      },
      { type: 'delay', ms: 1200 },
      // The button reads SUBMIT and the DOM says Submit: MUI uppercases it in
      // CSS, so the match is the string and the chip is the label.
      { type: 'click', text: 'Submit', say: 'SUBMIT' },
      { type: 'waitForText', text: 'Add track filters', hidden: true },
      // The pointer is where SUBMIT was, which is over the lane the moment the
      // dialog goes — and this track's mouseover is nine lines of allele
      // counts. Off it before the redraw is on camera.
      { type: 'hover', selector: WORDMARK, hold: 0 },
      { type: 'waitForAppSettled', timeout: 120000 },
      // What the page asserts: the same lane, in one colour, with everything
      // that is not predicted loss-of-function gone — and legible per record,
      // since the density that was suppressing the labels went with it.
      //
      // The last state change in the clip, deliberately. Whatever the recorder
      // drops off the end holds this frame, and it is the frame the poster
      // comes from.
      { type: 'delay', ms: 5000 },
    ],
    tailMs: 3000,
  },

  // The route the page banks on three times and pictures never. Its own section
  // walks it once ("Type phyloP and tick ..."), and two later sections spend it
  // as currency — "the others are the same two clicks", "the same two clicks
  // reach the rest of the catalog" — so the whole back half of the page is
  // owed against a click path no frame on it holds.
  //
  // THERE IS NO FIGURE AND THERE IS NOT GOING TO BE ONE. One was made and cut
  // twice, and the spec above records why: a filter box with a word typed in it
  // and a ticked checkbox are what the sentence beside them already says, so
  // the frames carried the app's chrome and no result. What a still cannot hold
  // is the part that IS the result — the lane arriving under the gene when the
  // box is ticked — and that is a change over time.
  //
  // The filter box is the half worth watching. `phyloP` narrows the whole hg38
  // trackDb to one category, and every row it leaves starts with the same
  // sixteen characters: UCSC publishes six phyloP tracks on hg38, so the words
  // after the parenthesis are the whole of what picks one, which is exactly why
  // the page spells the name out in full.
  //
  // The search route is deliberately NOT folded in beside it. Pressing Enter on
  // TP53 opens the name index's own gene track as well, which the page never
  // mentions; the tour opens at the window the search left and adds one track.
  {
    name: 'genomes_basics/find_a_track',
    description:
      'A UCSC track found and opened from the hg38 catalog: the track selector, phyloP typed into Filter tracks, the 100-way vertebrate alignment ticked under Comparative Genomics, and the conservation lane drawn under the TP53 transcript',
    url: geneTrackOnly,
    // Sized to the END state, which is phylop_tp53's own 460px app plus room
    // for the caption chip, since that chip is fixed off the FRAME's bottom
    // rather than the app's. The drawer is laid out to the window whatever is
    // in it, so it takes the whole of this and reports its own height
    // separately. Even, per the encode.
    viewportHeight: 520,
    readySelector: displayReady('hg38-ncbiRefSeq-LinearBasicDisplay'),
    readyTimeout: 180000,
    settleMs: 10000,
    steps: [
      { type: 'hover', selector: WORDMARK, hold: 0 },
      // One gene track, which is what the section before this one leaves on
      // screen.
      { type: 'delay', ms: 2000 },
      { type: 'click', selector: OPEN_SELECTOR, say: 'Open track selector' },
      {
        type: 'waitForSelector',
        selector: '[data-testid="hierarchical_track_selector"]',
      },
      // The catalog as it arrives: UCSC's own categories, the whole hg38
      // trackDb behind them, and no way to guess which one holds conservation.
      { type: 'delay', ms: 2500 },
      { type: 'type', text: 'Filter tracks', value: 'phyloP', say: 'phyloP' },
      { type: 'waitForText', text: phylopTrackName },
      // Every phyloP track UCSC publishes for hg38, in the one category, with
      // the names as the only thing telling them apart.
      { type: 'delay', ms: 2500 },
      { type: 'click', text: phylopTrackName, say: phylopTrackName },
      {
        type: 'waitForSelector',
        selector: displayReady(`${phylopTrackId}-LinearWiggleDisplay`),
        timeout: 180000,
      },
      { type: 'delay', ms: 3000 },
      { type: 'click', selector: CLOSE_SELECTOR, say: 'Close track selector' },
      // An LGV holds its window in BP across a resize rather than its bp/px, so
      // the drawer was a zoom rather than a pan and closing it draws the same
      // span back over the ~384px it was using. Both lanes re-render at the
      // wider scale, which is what this waits out.
      { type: 'waitForAppSettled', timeout: 120000 },
      // The toggle keeps focus and its title with it, so the cursor goes back
      // to the wordmark before the state the next section reads is held.
      { type: 'hover', selector: WORDMARK, hold: 0 },
      { type: 'delay', ms: 4000 },
    ],
    tailMs: 4000,
  },
]
