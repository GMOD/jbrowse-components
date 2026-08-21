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
  bulkAddUrls,
  elsewhere,
  emptyConfig,
  hg38GenomeUrls,
  motifSearchList,
  motifSearchSession,
  sequencePanelGene,
  sequencePanelSession,
} = uiVideoFixtures

// The dropdown at the top of the feature-details sequence panel, and its
// options. Each option carries a testid built from its mode key, so a tour
// picking one does not have to spell out a label the panel composes out of the
// reader's own configured flank sizes.
const SEQUENCE_TYPE = '[aria-label="Sequence type"]'
const sequenceType = (mode: string) => `[data-testid="sequence_type_${mode}"]`

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
    // A gene lane, then a wiggle lane under it, with the form in a drawer beside
    // both. The run reports 306px of app before the track arrives and 445px
    // after, and the form's own drawer wants 621 — so the frame is the drawer's
    // number rather than the views'.
    viewportHeight: 640,
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

  // A RE-LAYOUT, three times over, out of one control. feature_sequence.md
  // lists eight sequence types in prose and then shows three stills, each
  // frozen on one of them; what a reader cannot see is that they are the SAME
  // panel under the same dropdown, so the page reads as three features rather
  // than as one control with settings. The clip is that panel repainting under
  // a cursor that never leaves the select.
  //
  // The order carries the point: CDS is the coding sequence alone, Protein is
  // that translated, and the genomic type puts the introns and the flanks back
  // around it — each pick restores something the one before it dropped, and the
  // color key under the panel moves with them.
  {
    name: 'ui/feature_sequence_types',
    description:
      "Three sequence types for one volvox transcript: open the feature details, show the feature sequence, and take CDS, Protein and genomic-with-flanks from the panel's own dropdown",
    url: sequencePanelSession,
    // Sized to the PANEL, which is a drawer and therefore scrolls: the run
    // reports 506px of views beside it and 2437px of drawer content, and no
    // frame holds the second. 900 puts the dropdown and the first screenful of
    // sequence under it in the same picture, which is what the tour is about,
    // and the blank under the views is the drawer's rather than slack.
    viewportHeight: 900,
    readySelector: '::-p-text(ctgA)',
    readyTimeout: 60000,
    settleMs: 4000,
    steps: [
      { type: 'delay', ms: 1500 },
      {
        type: 'click',
        anchor: sequencePanelGene,
        say: 'Click the transcript',
        hold: 1400,
      },
      { type: 'waitForText', text: 'Show feature sequence' },
      {
        type: 'click',
        text: 'Show feature sequence',
        say: 'Show feature sequence',
        hold: 2200,
      },
      {
        type: 'click',
        selector: SEQUENCE_TYPE,
        say: 'Sequence type',
        hold: 1200,
      },
      { type: 'click', selector: sequenceType('cds'), say: 'CDS', hold: 3000 },
      { type: 'click', selector: SEQUENCE_TYPE, hold: 900 },
      {
        type: 'click',
        selector: sequenceType('protein'),
        say: 'Protein',
        hold: 3000,
      },
      { type: 'click', selector: SEQUENCE_TYPE, hold: 900 },
      {
        type: 'click',
        selector: sequenceType('gene_updownstream'),
        say: 'Genomic w/ full introns +/- up+down stream',
        hold: 3500,
      },
    ],
    tailMs: 3500,
  },

  // A ROUTE THROUGH A DIALOG NOTHING PICTURES. sequence_search.md is 106 lines
  // with no figure at all and three modes it only names, and the mode toggle is
  // the half a sentence cannot carry: `Sequence pattern` and `Motif list` are
  // the same dialog answering two different questions, and a reader who has only
  // read the list has no idea they are one control.
  //
  // It opens on a view with NO TRACKS, which is the other half. Every lane the
  // tour ends with is scanned out of the reference the assembly already has, so
  // the clip is also the answer to "what can I do here with no data loaded".
  //
  // The prefill is filmed before it is typed over: the panel arrives carrying
  // sixteen restriction enzymes, which is the page's own claim, and three is
  // what leaves a frame a reader can read the lanes in.
  {
    name: 'ui/sequence_search_motifs',
    description:
      "Three restriction enzymes scanned out of the reference: the view menu's Sequence search, the Motif list mode and the enzymes it comes prefilled with, then Launch one track per motif and a lane each",
    url: motifSearchSession,
    // The dialog is the tallest state and the app never reaches it: the run
    // reports 223px of app at the first frame and 584px at the last, where the
    // dialog wants about 690. Sized to the dialog, the same trade
    // `ui/open_track_url` takes for its drawer, so the blank under the three
    // lanes at the end is the dialog's headroom rather than slack.
    viewportHeight: 700,
    readySelector: '::-p-text(ctgA)',
    readyTimeout: 60000,
    settleMs: 4000,
    steps: [
      { type: 'delay', ms: 1600 },
      {
        type: 'click',
        selector: '[data-testid="view_menu_icon"]',
        say: 'View menu',
        hold: 900,
      },
      { type: 'waitForText', text: 'Sequence search' },
      {
        type: 'click',
        text: 'Sequence search',
        say: 'Sequence search',
        hold: 1800,
      },
      // The dialog opens on Sequence pattern, so the toggle is a real move
      // rather than a formality.
      { type: 'waitForText', text: 'Motif list' },
      { type: 'click', text: 'Motif list', say: 'Motif list', hold: 2600 },
      // Long enough to read that the panel came with the enzymes already in it.
      { type: 'delay', ms: 1500 },
      {
        type: 'type',
        selector: 'textarea[rows="12"]',
        value: motifSearchList,
        clear: true,
        say: 'Edit the list',
        hold: 2000,
      },
      // The two Launch buttons share a prefix, so this matches the whole string
      // or the click lands on the other one.
      {
        type: 'click',
        text: 'Launch one track per motif',
        say: 'Launch one track per motif',
      },
      { type: 'waitForAppSettled', timeout: 60000, cut: true },
      { type: 'delay', ms: 2500 },
    ],
    tailMs: 3500,
  },

  // THE FORM DOING THE SORTING, which is the whole of what basic_usage.md claims
  // for this workflow in ten lines with no figure: extension to track type,
  // index to data file, whatever order they arrive in. A still of the finished
  // preview table shows the result and cannot show that the reader supplied
  // nothing but four lines; a still of the empty box shows nothing at all.
  //
  // The list is deliberately scrambled, with the `.tbi` sitting between two
  // unrelated data files. That is the frame the tour exists for.
  //
  // Opens on the same volvox session `ui/open_track_url` uses, so the two clips
  // on that page open in the same app, and on a config that carries none of the
  // four files — a track being added has to arrive.
  {
    name: 'ui/bulk_add_tracks',
    description:
      'Four volvox file URLs pasted in one box, scrambled and with an index between two data files, and the preview table typing each row and pairing the index with its own data file',
    url: addTrackSession,
    // The drawer holds the paste box, the assembly selector and a row per file,
    // and grows as the rows land. Sized to the drawer rather than the views.
    viewportHeight: 900,
    readySelector: '::-p-text(ctgA)',
    readyTimeout: 60000,
    settleMs: 4000,
    steps: [
      { type: 'delay', ms: 1500 },
      { type: 'click', text: 'File', say: 'File', hold: 900 },
      { type: 'waitForText', text: 'Open track...' },
      { type: 'click', text: 'Open track...', say: 'Open track...' },
      { type: 'waitForText', text: 'Add multiple tracks at once' },
      { type: 'delay', ms: 1200 },
      {
        type: 'click',
        text: 'Add multiple tracks at once',
        say: 'Add multiple tracks at once',
        hold: 1600,
      },
      {
        type: 'type',
        selector: '[data-testid="bulk_track_urls"]',
        value: bulkAddUrls,
        say: 'Paste the URLs',
        // `type` sends the five URLs a keystroke at a time, which the run
        // reported as 9.4s of nothing happening. Cut leaves the box empty and
        // then full, which is what a paste looks like.
        cut: true,
        // the preview table builds from the extensions alone, with nothing
        // fetched, so the interesting frame is not gated on the network
        hold: 3600,
      },
      // The assembly comes from the view the form was opened over, so there is
      // nothing to pick: the button counts what it kept and the index is not in
      // the count.
      {
        type: 'click',
        text: 'Add 3 tracks',
        say: 'The index is paired, not counted',
      },
      { type: 'waitForAppSettled', timeout: 120000, cut: true },
      { type: 'delay', ms: 2500 },
    ],
    tailMs: 3500,
  },

  // THE ONE TOUR THAT OPENS ON AN APP WITH NO GENOME. Every other clip in the
  // corpus starts from a config that already has one, so the route a reader
  // takes first is the one nothing shows.
  //
  // It also replaces prose that is wrong. quickstart_adminserver.md walks a form
  // that no longer exists: it names a "Create New Assembly" button (no such
  // string in the tree), and a `type:` field the reader is told to set to
  // BgzipFastaAdapter. There is no adapter picker on this path — three URLs into
  // one box and the form answers with the adapter it recognised and a genome
  // name it filled in itself, which is exactly what a still of a table before
  // and a table after cannot say.
  {
    name: 'ui/add_genome',
    description:
      'A JBrowse with no genome gets one: Tools, Assembly manager, Add new assembly, three URLs into one box, and the adapter and the name the form works out for itself',
    url: emptyConfig,
    // The dialog is the tallest state and is centered over an app that is almost
    // nothing: the run reports 222px of app at its tallest, where the dialog
    // reaches about 600. Sized to the dialog.
    viewportHeight: 640,
    readySelector: '::-p-text(Tools)',
    readyTimeout: 60000,
    settleMs: 3000,
    steps: [
      { type: 'delay', ms: 1800 },
      { type: 'click', text: 'Tools', say: 'Tools', hold: 900 },
      { type: 'waitForText', text: 'Assembly manager' },
      {
        type: 'click',
        text: 'Assembly manager',
        say: 'Assembly manager',
        hold: 1600,
      },
      { type: 'waitForText', text: 'Add new assembly' },
      {
        type: 'click',
        text: 'Add new assembly',
        say: 'Add new assembly',
        hold: 1400,
      },
      // The pane opens on its drop zone; the URL box is behind this link.
      { type: 'waitForText', text: 'Open from a URL' },
      {
        type: 'click',
        text: 'Open from a URL',
        say: 'Open from a URL',
        hold: 1200,
      },
      {
        type: 'type',
        selector: '[data-testid="genome-urls"]',
        value: hg38GenomeUrls,
        say: 'The FASTA and its two indexes',
        hold: 1500,
      },
      // The form classifies what was pasted and fills the name in from it. That
      // is the frame the whole tour is for, so it is waited on by the field
      // appearing rather than by a sleep.
      {
        type: 'waitForSelector',
        selector: '[data-testid="assembly-name"]',
        timeout: 60000,
      },
      { type: 'delay', ms: 3000, say: 'It names the genome itself' },
      // It names it after the file, `hg38.prefix`. The field is editable, and
      // the rest of the quickstart calls the assembly `hg38`, so the tour
      // renames it rather than leaving the page and the film disagreeing.
      {
        type: 'type',
        selector: '[data-testid="assembly-name"]',
        value: 'hg38',
        clear: true,
        say: 'Rename it hg38',
        hold: 1600,
      },
      { type: 'click', text: 'Submit', say: 'Submit' },
      { type: 'waitForAppSettled', timeout: 120000, cut: true },
      { type: 'delay', ms: 3000 },
    ],
    tailMs: 4000,
  },
]
