// The SV inspector tour.
import { svVideoFixtures } from '../specs/sv.ts'

import type { VideoSpec } from '../video-spec-types.ts'

const { assembly, callsetUrl, emptySession } = svVideoFixtures

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
]
