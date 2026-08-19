// The tours over the general-usage guides, where the subject IS a route through
// the app rather than a dataset.
import { uiVideoFixtures } from '../specs/ui.ts'
import { LOCATION_BOX } from './shared.ts'

import type { VideoSpec } from '../video-spec-types.ts'

const {
  addTrackSession,
  addTrackUrl,
  bookmarkSession,
  bookmarkSpan,
  elsewhere,
} = uiVideoFixtures

// The scalebar strip a rubberband is drawn on. Naming it as a `band` puts the
// drag's y here while its x still comes from the locus, so the tour says which
// bases it selects instead of which pixels.
const RUBBERBAND = '[data-testid="rubberband_controls"]'

// The bookmark row's location cell, which is a link that navigates. The
// `.MuiDataGrid-cell` prefix is what tells it from its column header, which
// carries the same `data-field`.
const BOOKMARK_LINK_CELL = '.MuiDataGrid-cell[data-field="locString"]'

export const uiVideos: VideoSpec[] = [
  // A LOOP, which is what bookmark_widget.md is about and what neither of its
  // two figures can be. The page's first sentence says a bookmark is "shown as a
  // colored highlight on the LGV; clicking one navigates a linear genome view
  // (LGV) to it" — a claim about what happens next, made over a still of a
  // widget. Its figures hold the two halves that ARE picturable: the rubberband
  // menu with Bookmark region in it, and a label being typed into the grid.
  // Between them sit the two steps a reader has to take on faith, which is the
  // menu path to the widget and the navigation back.
  //
  // So the tour runs the loop end to end: select a span, bookmark it, open the
  // widget, name it, leave the region entirely, and come back by clicking the
  // row. The last click is the payoff, and it is the one thing on the page that
  // no still can hold, because what it produces is a CHANGE of location.
  {
    name: 'ui/bookmark_region',
    description:
      'A bookmark from the rubberband to the return trip: drag the scalebar, Bookmark region, open the widget from the view menu, name the row, navigate away, and click the row to come back',
    url: bookmarkSession,
    // An LGV with one gene track, and a drawer that opens beside it rather than
    // under it, so the app holds at the 306px the run reports throughout — the
    // bookmark table arrives at the top of the drawer, not below the view.
    viewportHeight: 360,
    readySelector: '::-p-text(NCBI RefSeq)',
    readyTimeout: 120000,
    settleMs: 10000,
    steps: [
      { type: 'delay', ms: 1800 },
      // Both ends are loci rather than pixels: a measured x is correct only for
      // the width it was measured at, and this corpus was re-framed once
      // already.
      {
        type: 'drag',
        fromAnchor: { locus: bookmarkSpan.start, band: RUBBERBAND },
        toAnchor: { locus: bookmarkSpan.end, band: RUBBERBAND },
        say: 'Drag across the scalebar',
        hold: 600,
      },
      { type: 'waitForText', text: 'Bookmark region' },
      {
        type: 'click',
        text: 'Bookmark region',
        say: 'Bookmark region',
        hold: 1800,
      },
      // The highlight is now on the view and the bookmark is in a widget nobody
      // has opened. The menu path to it is the half the page states in prose.
      {
        type: 'click',
        selector: '[data-testid="view_menu_icon"]',
        say: 'View menu',
        hold: 800,
      },
      { type: 'waitForText', text: 'Bookmarks/highlights' },
      {
        type: 'click',
        text: 'Bookmarks/highlights',
        say: 'Bookmarks/highlights',
        hold: 800,
      },
      { type: 'waitForText', text: 'Open bookmark widget' },
      {
        type: 'click',
        text: 'Open bookmark widget',
        say: 'Open bookmark widget',
      },
      { type: 'waitForText', text: 'Add label...' },
      { type: 'delay', ms: 1200 },
      // One click puts the cell in edit mode, which is the thing the label
      // figure's callout has to say in words. Targeted by the placeholder the
      // empty cell renders, the way bookmark_widget_edit_label does: while it is
      // being edited the cell is an <input>, so its own text is not a handle.
      {
        type: 'type',
        text: 'Add label...',
        value: "PTEN 5' end",
        say: "PTEN 5' end",
        hold: 1200,
      },
      { type: 'press', key: 'Enter' },
      { type: 'delay', ms: 2000 },
      // Leave, so the return has somewhere to return from. Typed into the
      // search box the way a reader would rather than reloaded, and the
      // bookmark's highlight leaves the view with it.
      {
        type: 'type',
        selector: LOCATION_BOX,
        value: elsewhere,
        clear: true,
        say: elsewhere,
      },
      { type: 'press', key: 'Enter' },
      { type: 'waitForAppSettled', timeout: 120000 },
      { type: 'delay', ms: 2000 },
      // The page's claim, performed: the row's location cell is a link, and the
      // view goes back to the span the drag made.
      {
        type: 'click',
        selector: BOOKMARK_LINK_CELL,
        say: 'Bookmark link',
      },
      { type: 'waitForAppSettled', timeout: 120000 },
    ],
    tailMs: 4000,
  },

  // THE MOST-ASKED ROUTE IN THE DOCS, and the one basic_usage.md's two figures
  // are furthest from carrying. Both are of the form standing open — one under
  // the File menu that opened it, one under the track selector's plus button —
  // and between them the page says "enter a URL, then Next, then Add" over a
  // stepper whose second step does not exist until the first is filled in. What
  // a reader cannot see in either still is that the form ANSWERS: a URL typed
  // into it resolves its own adapter and names the track, so the two clicks
  // after it are confirmations rather than a second form to fill in.
  //
  // It ends on the track opening, which is the thing being asked for and the one
  // frame neither figure has.
  {
    name: 'ui/open_track_url',
    description:
      'Opening a track from a URL: File, Open track..., a bigwig url typed into the form, the adapter and name it resolves for itself, and the track drawing under the genes',
    url: addTrackSession,
    // A gene lane, then a wiggle lane under it, with the form in a drawer
    // beside both. The run reports 306px of app before the track arrives and
    // 445px after.
    viewportHeight: 500,
    readySelector: '::-p-text(ctgA)',
    readyTimeout: 60000,
    settleMs: 4000,
    steps: [
      { type: 'delay', ms: 1500 },
      { type: 'click', text: 'File', say: 'File', hold: 900 },
      { type: 'waitForText', text: 'Open track...' },
      { type: 'click', text: 'Open track...', say: 'Open track...' },
      { type: 'waitForText', text: 'Enter track data' },
      { type: 'delay', ms: 1200 },
      {
        type: 'type',
        selector: '[data-testid="urlInput"]',
        value: addTrackUrl,
        say: 'Enter URL',
        // long enough to see the second step appear under the field, which is
        // the form answering
        hold: 2200,
      },
      {
        type: 'click',
        selector: '[data-testid="addTrackNextButton"]',
        say: 'Next',
        hold: 1800,
      },
      // Same button, now reading Add: the confirm step is the name and the
      // adapter the form worked out, and the tour holds on it rather than
      // clicking through.
      {
        type: 'click',
        selector: '[data-testid="addTrackNextButton"]',
        say: 'Add',
      },
      { type: 'waitForAppSettled', timeout: 60000 },
      { type: 'delay', ms: 2500 },
    ],
    tailMs: 3500,
  },
]
