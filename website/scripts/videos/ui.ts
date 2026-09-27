// The tours over the general-usage guides, where the subject IS a route through
// the app rather than a dataset.
import {
  GENE_CHANNEL_SPEC_JSON,
  geneGroupingVideoFixtures,
} from '../specs/features.ts'
import { uiVideoFixtures } from '../specs/ui.ts'
import {
  cascade,
  leaveMenu,
  LOCATION_BOX,
  openTrackByUrlSteps,
  RUBBERBAND,
  trackMenu,
} from './shared.ts'

import type { VideoSpec } from '../video-spec-types.ts'

const {
  addTrackSession,
  addTrackUrl,
  highlightSession,
  highlightSpan,
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

// A highlight row's location cell, which is a link that navigates. The
// `.MuiDataGrid-cell` prefix is what tells it from its column header, which
// carries the same `data-field`.
const LOCATION_LINK_CELL = '.MuiDataGrid-cell[data-field="locString"]'

export const uiVideos: VideoSpec[] = [
  // A LOOP, which is what highlights.md is about and what neither of its two
  // figures can be. Its figures hold the two halves that ARE picturable: the
  // rubberband menu with Highlight region in it, and a label being typed into
  // the list. Between them sit the two steps a reader has to take on faith,
  // which is the menu path to the list and the navigation back.
  //
  // So the tour runs the loop end to end: select a span, highlight it, open the
  // list, name it, leave the region entirely, and come back by clicking the
  // row. The last click is the payoff, and it is the one thing on the page that
  // no still can hold, because what it produces is a CHANGE of location.
  {
    name: 'ui/highlight_region',
    description:
      'A highlight from the rubberband to the return trip: drag the scalebar, Highlight region, open the list from the view menu, name the row, navigate away, and click the row to come back',
    goal: 'Highlight a span, name it, leave, and come back from the list',
    url: highlightSession,
    endsInDrawer: true,
    // An LGV with one gene track, and a drawer that opens beside it rather than
    // under it, so the app holds at the 312px the run reports throughout, with
    // the caption chip's strip under it.
    viewportHeight: 432,
    readySelector: '::-p-text(NCBI RefSeq)',
    readyTimeout: 120000,
    steps: [
      { type: 'hover', selector: '[aria-label="JBrowse"]', hold: 0 },
      { type: 'delay', ms: 1800 },
      // Both ends are loci rather than pixels: a measured x is correct only for
      // the width it was measured at, and this corpus was re-framed once
      // already.
      {
        type: 'drag',
        fromAnchor: { locus: highlightSpan.start, band: RUBBERBAND },
        toAnchor: { locus: highlightSpan.end, band: RUBBERBAND },
        say: 'Select the start of PTEN on the scale bar and highlight it',
        hold: 600,
      },
      { type: 'waitForText', text: 'Highlight region' },
      { type: 'click', text: 'Highlight region', hold: 1800 },
      // The band is now on the view, and the list holding it is one nobody has
      // opened. The menu path to it is the half the page states in prose.
      {
        type: 'click',
        selector: '[data-testid="view_menu_icon"]',
        say: 'Open the highlight list from the view menu',
        hold: 800,
      },
      { type: 'click', text: 'Highlights', hold: 600 },
      { type: 'waitForText', text: 'Open highlight list' },
      { type: 'click', text: 'Open highlight list' },
      { type: 'waitForText', text: 'Add label...' },
      { type: 'delay', ms: 1200 },
      // One click puts the cell in edit mode, which is the thing the label
      // figure's callout has to say in words. Targeted by the placeholder the
      // empty cell renders, the way highlight_list_edit_label does: while it is
      // being edited the cell is an <input>, so its own text is not a handle.
      {
        type: 'type',
        text: 'Add label...',
        value: "PTEN 5' end",
        hold: 1200,
      },
      { type: 'press', key: 'Enter' },
      { type: 'delay', ms: 2000 },
      {
        type: 'type',
        selector: LOCATION_BOX,
        value: elsewhere,
        clear: true,
        say: `Search another gene, ${elsewhere}, to leave`,
      },
      { type: 'press', key: 'Enter' },
      { type: 'waitForAppSettled', timeout: 120000 },
      { type: 'delay', ms: 2000 },
      // The page's claim, performed: the row's location cell is a link, and the
      // view goes back to the span the drag made.
      {
        type: 'click',
        selector: LOCATION_LINK_CELL,
        say: "Click the row's location to jump back",
      },
      { type: 'waitForAppSettled', timeout: 120000 },
      { type: 'hover', selector: '[aria-label="JBrowse"]', hold: 0 },
      {
        type: 'delay',
        ms: 3000,
        say: 'Back on PTEN, under the highlight you named',
      },
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
    goal: 'Open a bigwig track from its URL',
    url: addTrackSession,
    // A gene lane, then a wiggle lane under it, with the form in a drawer beside
    // both. The run reports 306px of app before the track arrives and 445px
    // after, and the form's own drawer wants 621 — so the frame is the drawer's
    // number rather than the views'.
    viewportHeight: 640,
    readySelector: '::-p-text(ctgA)',
    readyTimeout: 60000,
    steps: [
      { type: 'hover', selector: '[aria-label="JBrowse"]', hold: 0 },
      { type: 'delay', ms: 1500 },
      ...openTrackByUrlSteps(addTrackUrl, {
        open: 'From File, Open track, then paste the file URL',
        add: 'The form names the track and picks its adapter; Add',
      }),
      { type: 'hover', selector: '[aria-label="JBrowse"]', hold: 0 },
      {
        type: 'delay',
        ms: 3000,
        say: 'The bigwig draws under the genes',
      },
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
    goal: "Show one transcript's sequence three ways: CDS, protein, genomic",
    url: sequencePanelSession,
    endsInDrawer: true,
    // Sized to the PANEL, which is a drawer and therefore scrolls: the run
    // reports 506px of views beside it and 2437px of drawer content, and no
    // frame holds the second. 900 puts the dropdown and the first screenful of
    // sequence under it in the same picture, which is what the tour is about,
    // and the blank under the views is the drawer's rather than slack.
    viewportHeight: 900,
    readySelector: '::-p-text(ctgA)',
    readyTimeout: 60000,
    steps: [
      { type: 'hover', selector: '[aria-label="JBrowse"]', hold: 0 },
      { type: 'delay', ms: 1500 },
      {
        type: 'click',
        anchor: sequencePanelGene,
        say: "Open a transcript's details and show its sequence",
        hold: 1400,
      },
      { type: 'waitForText', text: 'Show feature sequence' },
      { type: 'click', text: 'Show feature sequence', hold: 2200 },
      { type: 'click', selector: SEQUENCE_TYPE, hold: 1200 },
      {
        type: 'click',
        selector: sequenceType('cds'),
        say: 'First the coding sequence alone',
        hold: 3000,
      },
      { type: 'click', selector: SEQUENCE_TYPE, hold: 900 },
      {
        type: 'click',
        selector: sequenceType('protein'),
        say: 'Then that sequence translated to protein',
        hold: 3000,
      },
      { type: 'click', selector: SEQUENCE_TYPE, hold: 900 },
      {
        type: 'click',
        selector: sequenceType('gene_updownstream'),
        say: 'Then the whole genomic span, introns and flanks included',
        hold: 3000,
      },
      { type: 'hover', selector: '[aria-label="JBrowse"]', hold: 0 },
      {
        type: 'delay',
        ms: 3000,
        say: 'One dropdown, and the key under it marks each part of the span',
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
    goal: 'Scan the reference for restriction sites, one track per enzyme',
    url: motifSearchSession,
    // The dialog is the tallest state and the app never reaches it: the run
    // reports 223px of app at the first frame and 584px at the last, where the
    // dialog wants about 690. Sized to the dialog, the same trade
    // `ui/open_track_url` takes for its drawer, so the blank under the three
    // lanes at the end is the dialog's headroom rather than slack.
    viewportHeight: 700,
    readySelector: '::-p-text(ctgA)',
    readyTimeout: 60000,
    steps: [
      { type: 'hover', selector: '[aria-label="JBrowse"]', hold: 0 },
      { type: 'delay', ms: 1600 },
      {
        type: 'click',
        selector: '[data-testid="view_menu_icon"]',
        say: 'Open Sequence search from the view menu',
        hold: 900,
      },
      { type: 'waitForText', text: 'Sequence search' },
      { type: 'click', text: 'Sequence search', hold: 1800 },
      // The dialog opens on Sequence pattern, so the toggle is a real move
      // rather than a formality.
      { type: 'waitForText', text: 'Motif list' },
      {
        type: 'click',
        text: 'Motif list',
        say: 'Its motif list comes prefilled with restriction enzymes',
        hold: 2600,
      },
      // Long enough to read that the panel came with the enzymes already in it.
      { type: 'delay', ms: 1500 },
      {
        type: 'type',
        selector: 'textarea[rows="12"]',
        value: motifSearchList,
        clear: true,
        say: 'Keep three of them: EcoRI, BamHI and HindIII',
        hold: 2000,
      },
      // The two Launch buttons share a prefix, so this matches the whole string
      // or the click lands on the other one.
      { type: 'click', text: 'Launch one track per motif' },
      { type: 'waitForAppSettled', timeout: 60000, cut: true },
      {
        type: 'delay',
        ms: 3000,
        say: "A lane of each enzyme's cut sites, scanned from the genome itself",
      },
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
    goal: 'Add four files at once, in any order, with one paste',
    url: addTrackSession,
    // The drawer holds the paste box, the assembly selector and a row per file,
    // and grows as the rows land. Sized to the drawer rather than the views.
    viewportHeight: 900,
    readySelector: '::-p-text(ctgA)',
    readyTimeout: 60000,
    steps: [
      { type: 'hover', selector: '[aria-label="JBrowse"]', hold: 0 },
      { type: 'delay', ms: 1500 },
      {
        type: 'click',
        text: 'File',
        say: 'From File, Open track, choose Add multiple tracks at once',
        hold: 900,
      },
      { type: 'waitForText', text: 'Open track...' },
      { type: 'click', text: 'Open track...' },
      { type: 'waitForText', text: 'Add multiple tracks at once' },
      { type: 'delay', ms: 1200 },
      { type: 'click', text: 'Add multiple tracks at once', hold: 1600 },
      // NO `say` HERE, and nothing to hold on. The whole step runs off camera,
      // its `hold` included, so a line named here reaches neither the frame nor
      // the caption track: `captionTrack` closes a cue at the on-camera clock,
      // which a cut leaves where it was, and a cue of zero length is dropped.
      // The clip shipped one fewer caption than the spec named and nothing said
      // so.
      {
        type: 'type',
        selector: '[data-testid="bulk_track_urls"]',
        value: bulkAddUrls,
        // `type` sends the five URLs a keystroke at a time, which the run
        // reported as 9.4s of nothing happening. Cut leaves the box empty and
        // then full, which is what a paste looks like.
        cut: true,
      },
      // The camera comes back on the answered form, which is the frame the tour
      // exists for: four lines in, a row each, and the index paired off against
      // the data file whose name it extends. The preview table builds from the
      // extensions alone with nothing fetched, so this is not gated on the
      // network.
      {
        type: 'delay',
        ms: 3600,
        say: 'Each file is typed by its extension, and the index joins its file',
      },
      // The assembly comes from the view the form was opened over, so there is
      // nothing to pick: the button counts what it kept and the index is not in
      // the count. The `say` is the button's own label rather than a line about
      // it — four URLs went in and the button reads three, which is the whole
      // point and is already on screen.
      { type: 'click', text: 'Add 3 tracks' },
      { type: 'waitForAppSettled', timeout: 120000, cut: true },
      {
        type: 'delay',
        ms: 3000,
        say: 'Three tracks from four URLs, drawn under the genes',
      },
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
    goal: 'Give a JBrowse with no genome one, from three URLs',
    url: emptyConfig,
    // The dialog is the tallest state and is centered over an app that is almost
    // nothing: the run reports 222px of app at its tallest, where the dialog
    // reaches about 600. Sized to the dialog.
    viewportHeight: 640,
    readySelector: '::-p-text(Tools)',
    readyTimeout: 60000,
    steps: [
      { type: 'delay', ms: 1800 },
      {
        type: 'click',
        text: 'Tools',
        say: 'Open the assembly manager from Tools and add a genome',
        hold: 900,
      },
      { type: 'waitForText', text: 'Assembly manager' },
      { type: 'click', text: 'Assembly manager', hold: 1600 },
      { type: 'waitForText', text: 'Add new assembly' },
      { type: 'click', text: 'Add new assembly', hold: 1400 },
      // The pane opens on its drop zone; the URL box is behind this link.
      { type: 'waitForText', text: 'Open from a URL' },
      { type: 'click', text: 'Open from a URL', hold: 1200 },
      {
        type: 'type',
        selector: '[data-testid="genome-urls"]',
        value: hg38GenomeUrls,
        say: 'Paste the URLs of the FASTA and its two indexes',
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
      // `Genome name` is the field's rendered label; `assembly-name` is only its
      // testid, and nothing checks a `say` against a string the app draws.
      {
        type: 'delay',
        ms: 3000,
        say: 'The form recognizes the files and suggests a name; call it hg38',
      },
      // It names it after the file, `hg38.prefix`. The field is editable, and
      // the rest of the quickstart calls the assembly `hg38`, so the tour
      // renames it rather than leaving the page and the film disagreeing.
      {
        type: 'type',
        selector: '[data-testid="assembly-name"]',
        value: 'hg38',
        clear: true,
        hold: 1600,
      },
      { type: 'click', text: 'Submit' },
      { type: 'waitForAppSettled', timeout: 120000, cut: true },
      {
        type: 'delay',
        ms: 3500,
        say: 'hg38 is in the assembly manager, ready to open in a view',
      },
    ],
    tailMs: 4000,
  },

  // The runtime half of the facet's and the color's `domain`: a grouping picked
  // from the dialog, one section moved from the Sections submenu, then the
  // key's values pinned into the color domain.
  {
    name: 'ui/gene_track_sections',
    description:
      'NCBI RefSeq genes on hg38 grouped and colored by gene_biotype from the Group by dialog, protein_coding moved to the top from the Sections submenu, then Pin distinct colors giving every biotype its own color',
    goal: 'Group genes into sections by biotype, reorder them, and color them',
    url: geneGroupingVideoFixtures.session,
    viewportHeight: 740,
    readySelector: '::-p-text(NCBI RefSeq)',
    readyTimeout: 120000,
    steps: [
      { type: 'hover', selector: '[aria-label="JBrowse"]', hold: 0 },
      { type: 'delay', ms: 1500 },
      {
        type: 'click',
        selector: trackMenu(geneGroupingVideoFixtures.trackId),
        say: 'Group the genes by their gene_biotype attribute',
        hold: 1000,
      },
      { type: 'waitForText', text: 'Group by...' },
      { type: 'click', text: 'Group by...' },
      { type: 'waitForText', text: 'Attribute' },
      { type: 'click', text: 'Attribute', hold: 600 },
      {
        type: 'type',
        selector: '[data-testid="group-by-attribute"]',
        value: 'gene_biotype',
        hold: 800,
      },
      { type: 'click', text: 'Apply' },
      { type: 'waitForText', text: 'gene_biotype: snoRNA' },
      { type: 'waitForAppSettled', timeout: 120000 },
      { type: 'delay', ms: 2500 },
      {
        type: 'click',
        selector: trackMenu(geneGroupingVideoFixtures.trackId),
        say: 'Move protein_coding to the top from the Sections menu',
        hold: 1000,
      },
      { type: 'waitForText', text: 'Sections' },
      { type: 'click', text: 'Sections', hold: 800 },
      {
        type: 'click',
        selector: cascade('submenu', 'gene_biotype: protein_coding'),
        hold: 800,
      },
      { type: 'waitForText', text: 'Move up' },
      { type: 'click', text: 'Move up', hold: 1800 },
      ...leaveMenu('::-p-text(Move up)'),
      { type: 'delay', ms: 2500 },
      {
        type: 'click',
        selector: trackMenu(geneGroupingVideoFixtures.trackId),
        say: 'Then give each biotype a color of its own',
        hold: 1000,
      },
      { type: 'waitForText', text: 'Color by...' },
      { type: 'click', text: 'Color by...', hold: 800 },
      { type: 'waitForText', text: 'Pin distinct colors' },
      { type: 'click', text: 'Pin distinct colors', hold: 0 },
      { type: 'waitForText', text: 'Pin distinct colors', hidden: true },
      { type: 'click', selector: '[aria-label="JBrowse"]', hold: 0 },
      { type: 'waitForText', text: 'Track settings', hidden: true },
      { type: 'waitForAppSettled', timeout: 120000 },
      {
        type: 'delay',
        ms: 3500,
        say: 'A section per biotype, protein_coding first, each in its own color',
      },
    ],
    tailMs: 3000,
  },

  // The same grouping as `ui/gene_track_sections`, written instead of picked:
  // the spec names a section order the Group by dialog has no field for.
  //
  // Wants a taller frame so the dialog, with the spec pasted in, fits whole —
  // but the clip in the store is still the 740 take, so the height stays
  // 740 until a refilm lands; bumping it here without one just leaves the
  // page reserving a box the store's clip doesn't fill.
  {
    name: 'ui/gene_track_channel_spec',
    description:
      'NCBI RefSeq genes on hg38 grouped by gene_biotype in a declared section order and colored by the same attribute in a declared color order, written as JSON from the Group by dialog',
    goal: 'Write the same grouping as JSON, with a section and color order',
    url: geneGroupingVideoFixtures.channelSpecSession,
    // the faceted lane stands 852px of app, with the caption chip's strip under it
    viewportHeight: 970,
    readySelector: '::-p-text(NCBI RefSeq)',
    readyTimeout: 120000,
    steps: [
      { type: 'hover', selector: '[aria-label="JBrowse"]', hold: 0 },
      { type: 'delay', ms: 1500 },
      {
        type: 'click',
        selector: trackMenu(geneGroupingVideoFixtures.trackId),
        say: 'Open Group by, then Edit as JSON',
        hold: 1000,
      },
      { type: 'waitForText', text: 'Group by...' },
      { type: 'click', text: 'Group by...' },
      { type: 'waitForText', text: 'Edit as JSON...' },
      { type: 'click', text: 'Edit as JSON...', hold: 800 },
      { type: 'waitForText', text: 'Facet, color and filter' },
      { type: 'delay', ms: 2000 },
      {
        type: 'type',
        selector: '[data-testid="channel-spec-json"]',
        value: GENE_CHANNEL_SPEC_JSON,
        clear: true,
        cut: true,
      },
      { type: 'waitForText', text: 'Sets facet, color' },
      {
        type: 'delay',
        ms: 3000,
        say: 'The facet and the color each carry a domain: the order to use',
      },
      // the caption chip sits over the dialog's buttons
      { type: 'click', text: 'Apply', say: '' },
      { type: 'waitForText', text: 'gene_biotype: pseudogene' },
      { type: 'waitForAppSettled', timeout: 120000 },
      { type: 'hover', selector: '[aria-label="JBrowse"]', hold: 0 },
      {
        type: 'delay',
        ms: 3500,
        say: "The sections and the colors now follow each domain's order",
      },
    ],
    tailMs: 3000,
  },
]
