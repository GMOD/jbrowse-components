// The two structural-variant tours: getting a callset in, and turning the reads
// at one breakpoint into the allele they describe.
import { displaySettled } from '@jbrowse/browser-test-utils'

import { cancerSvVideoFixtures } from '../specs/cancer_sv.ts'
import { svVideoFixtures } from '../specs/sv.ts'
import { trackMenu } from './shared.ts'

import type { VideoSpec } from '../video-spec-types.ts'

const { assembly, callsetUrl, emptySession } = svVideoFixtures
const { breakpointPanel, chainRouteLabel, chainRouteTestId, readsTrackId } =
  cancerSvVideoFixtures

// The picker's own testid, published on both shapes it draws the routes in (a
// radio group, or the bare row a single candidate gets). Waiting on it is
// waiting on the reconstruction pass rather than on a timeout.
const ROUTE_LIST = '[data-testid="derivative-path-candidates"]'

// The import form's assembly select carries no test id, but it is labelled, so
// the accessible name is the handle — the same word the page uses when it says
// to select hg19.
const ASSEMBLY_SELECT = '::-p-aria([name="Assembly"][role="combobox"])'
const assemblyOption = (name: string) => `li[role="option"]::-p-text(${name})`

export const svVideos: VideoSpec[] = [
  // WHERE GETTING THE DATA IN IS THE DIFFICULTY. sv_inspector_view.md opens by
  // telling the reader to launch the view from the Add menu, paste a URL into
  // the form that appears, and pick an assembly; its three figures are the state
  // before, the state with the URL in the box, and the state after. What none of
  // them carries is that these are one continuous route, and the form is exactly
  // the kind of thing prose is worst at — every instruction names a control the
  // reader has not seen yet.
  //
  // The second half is the page's other prose-only claim, and the more
  // interesting one: "Table filters are reflected in the circular view." That is
  // a statement about two panels moving together, which a pair of stills can
  // only assert. Typing one chromosome into the table's filter drops the rows
  // that do not touch it and the chords go with them, in the same frame.
  {
    name: 'sv/inspector_route',
    description:
      'The SV inspector from the Add menu to a filtered callset: launch the view, paste the SKBR3 VCF into the import form, pick the assembly, and watch the circular overview follow the table filter',
    url: emptySession,
    // One frame holds the import form and the loaded pair alike; the run reports
    // the app at 588px once the table and the circle are standing.
    viewportHeight: 640,
    readySelector: '::-p-text(Select a view to launch)',
    readyTimeout: 120000,
    settleMs: 4000,
    steps: [
      { type: 'delay', ms: 1800 },
      { type: 'click', text: 'Add', say: 'Add', hold: 900 },
      { type: 'waitForText', text: 'SV inspector' },
      { type: 'click', text: 'SV inspector', say: 'SV inspector' },
      { type: 'waitForText', text: 'Open file from URL or local computer' },
      { type: 'delay', ms: 1200 },
      {
        type: 'click',
        selector: ASSEMBLY_SELECT,
        say: 'Assembly',
        hold: 900,
      },
      { type: 'click', selector: assemblyOption(assembly), hold: 1400 },
      // The page's own file. Typed rather than pasted, so the field is seen to
      // be a URL field.
      {
        type: 'type',
        selector: '[data-testid="urlInput"]',
        value: callsetUrl,
        say: 'Open file from URL',
        hold: 1600,
      },
      // By its testid, not by its label: `::-p-text(Open)` matches the first
      // element CONTAINING the word, which on this form is the "Open file from
      // URL or local computer" tab above it — so a text click landed on the tab
      // and the tour then waited three minutes for a table nothing had asked
      // for.
      {
        type: 'click',
        selector: '[data-testid="open_spreadsheet"]',
        say: 'Open',
      },
      // A whole callset parsed and a genome's worth of chords drawn, off camera.
      { type: 'waitForText', text: 'CHROM', timeout: 180000, cut: true },
      { type: 'delay', ms: 4000 },
      // The claim the page makes in one sentence and shows in two figures. The
      // Mate column carries the far end of each breakend, so a chromosome typed
      // here keeps every record that TOUCHES it, whichever end it is filed
      // under, and the circle redraws to those chords alone.
      //
      // Bare, because the callset's refNames are: `chrX` matched 0 of 273 rows
      // and the tour ended on "No results found".
      {
        type: 'type',
        selector: 'input[placeholder^="Search"]',
        value: 'X',
        clear: true,
        say: 'X',
      },
      { type: 'waitForAppSettled', timeout: 120000 },
      { type: 'delay', ms: 3500 },
    ],
    tailMs: 4000,
  },

  // A ROUTE AND A RE-LAYOUT, which is why one clip serves two pages. Both
  // describe the same four controls in prose and show either end of them:
  // cancer_sv.md states the whole path in one sentence and its figure holds the
  // finished panels, and sv_visualization_cgiab.md names the menu path and
  // shows the dialog alone. Neither has the reads at one breakpoint becoming
  // the panels, which is the half made of clicks.
  //
  // The re-layout is what the second half of the tour is: the launching view is
  // one window on chr3, and what replaces it is a panel per SEGMENT of the
  // route, in the order the reads cross it, carrying the tracks that view had.
  // So the soft-clipped tails in the opening frame come back as curves leaving
  // one panel and arriving in the next — the same reads, twice, which is a
  // correspondence two stills can only assert. This chain leaves chr3 and
  // returns to it inverted, so it draws two chr3 panels where the import form
  // takes one row per chromosome.
  //
  // It opens on the pileup rather than on the dialog, because the reconstruction
  // is computed from the reads in the displayed regions: the window is what
  // decides which routes exist at all, and a tour starting at the dialog would
  // film that as a list arriving from nowhere.
  {
    name: 'sv/derivative_allele_route',
    description:
      "COLO829's three-junction chain built by the app rather than typed in: the tumor track menu, Reconstruct derivative allele..., the four-segment route the reads agree on, and Draw as Breakpoint split view replacing the window with one panel per segment",
    url: breakpointPanel,
    // SIZED TO THE END STATE, which is the four-panel split view and not the
    // dialog: cancer_sv/derivative_autogenerated holds the same dialog over the
    // same pileup in a 560px frame, while the four panels are what
    // cancer_sv/multihop_split_view measures at 1325 on these track heights (70
    // of gene lane and 130 of pileup, four times over). So this is that number
    // rounded up even with a little headroom, and the page under the launching
    // pileup at the start is the room those panels need rather than slack.
    viewportHeight: 1340,
    // The pileup's own phase, not first paint: this is 200x ONT out of a CRAM
    // and the route list is computed from the reads in view, so a tour that
    // starts before the fetch lands opens the dialog on a shorter list than the
    // one the figures show. `forceLoad` on the track is what gets the fetch
    // past the byte gate at all.
    readySelector: displaySettled('pileup-display'),
    readyTimeout: 300000,
    settleMs: 12000,
    steps: [
      // The wall of soft clipping at the two chr3 breakpoints, held: it is the
      // input every route in the list is computed from, and the state the left
      // half of cancer_sv/multihop_reads is of.
      { type: 'delay', ms: 3000 },
      {
        type: 'click',
        selector: trackMenu(readsTrackId),
        say: 'Track menu',
        hold: 1200,
      },
      // Clicked rather than hovered: CascadingSubmenu opens on either, and the
      // pileup re-lays-out as reads stream, which can move a hovered row out
      // from under the cursor.
      { type: 'waitForText', text: 'Launch view' },
      { type: 'click', text: 'Launch view', say: 'Launch view', hold: 1200 },
      { type: 'waitForText', text: 'Reconstruct derivative allele...' },
      {
        type: 'click',
        text: 'Reconstruct derivative allele...',
        say: 'Reconstruct derivative allele...',
      },
      // The pass walks every read's SA chain over the whole pileup, and the
      // figures on this route give it three minutes. Off camera, with the menu
      // item held first so the dialog is not seen to teleport in.
      {
        type: 'waitForSelector',
        selector: ROUTE_LIST,
        timeout: 180000,
        cut: true,
      },
      // Long enough to read a row: the route, its segments drawn to scale, the
      // number of reads that take it, and the line above the list saying a read
      // count ranks a route rather than vouching for it.
      { type: 'delay', ms: 4000 },
      // By the shape of the route rather than by rank. It is row 0 here and
      // outranks the other row 28 reads to 2, so the default selection is
      // already this one — but the whole clip rests on which allele gets drawn,
      // and rows tied on support sort by segment count, which is how the
      // fold-back figure next door drew the wrong route under the right caption.
      {
        type: 'click',
        selector: `[data-testid="${chainRouteTestId}"]`,
        say: chainRouteLabel,
        hold: 2400,
      },
      // By its testid, not by its label: the dialog's prose has named this
      // drawing before now, and a text match then resolves to the paragraph —
      // an element, which clicks successfully and does nothing.
      {
        type: 'click',
        selector: '[data-testid="derivative-draw-as-split"]',
        say: 'Draw as: Breakpoint split view',
        hold: 2000,
      },
      // The destination the docs and the figures take. The other button opens
      // the same view below the one it was launched from, which leaves a second
      // copy of the chr3 window with the same tracks one scroll above the answer.
      {
        type: 'click',
        text: 'Replace current view',
        say: 'Replace current view',
      },
      // Four panels, each a 10 kb window centred on the junction its segment
      // carries, and each carrying the launching view's whole track list — so
      // this is four pileup fetches. A film of that is a film of four spinners.
      { type: 'waitForAppSettled', timeout: 300000, cut: true },
      // The end state, held: the curves are drawn BETWEEN panels rather than
      // inside one, so they are the last thing to arrive.
      { type: 'delay', ms: 5000 },
    ],
    tailMs: 5000,
  },
]
