// The tours through the two comparative import forms: the three-strain
// H. pylori stack, and the T2T-HG002 self-alignment dotplot.
import { hg002VideoFixtures } from '../specs/hg002_haplotypes.ts'
import { syntenyVideoFixtures } from '../specs/synteny.ts'

import type { VideoSpec } from '../video-spec-types.ts'

const { emptySyntenyForm, strains } = syntenyVideoFixtures
const { maternalGlob, noViews, paternalGlob } = hg002VideoFixtures

// The form's assembly dropdowns carry no test id, but each is labelled, so the
// accessible name is the handle -- the same string the page's own numbered steps
// use when they say to pick an assembly per row.
const assemblyRow = (n: number) =>
  `::-p-aria([name="Row ${n} assembly"][role="combobox"])`
const option = (assembly: string) => `li[role="option"]::-p-text(${assembly})`

// One button per adjacent pair, whose aria-label says which pair it is rather
// than leaving a tour counting anonymous icons.
const connector = (top: number) =>
  `button[aria-label="Configure synteny track between row ${top} and ${top + 1}"]`

// The dotplot form's two chromosome boxes. Both carry the same placeholder and
// the same label shape, so the testid on the input is the only handle that says
// which axis is meant (ChromosomeFilter, whose `testId` goes on the html input).
const chromosomeBox = (axis: 'x' | 'y') =>
  `[data-testid="chromosome-filter-${axis}"]`

// The palette button both comparative headers render (ColorBySelector). Its
// testid rides through CascadingMenuButton's `...rest` onto the IconButton.
const COLOR_BY_MENU = '[data-testid="color_by_menu"]'

// The dotplot's shared canvas once it has painted AND no display is still
// fetching -- `data-display-drawn` on this view means both (DotplotView model's
// `settled`), so it is the gate a whole-genome chain read can be waited out on.
const DOTPLOT_DRAWN =
  '[data-testid="dotplot_webgl_canvas"][data-display-drawn="true"]'

export const syntenyVideos: VideoSpec[] = [
  // WHERE GETTING THE DATA IN IS THE DIFFICULTY, which is the case that makes
  // the route the tour rather than a figure. The page's three-strain figure is
  // preceded by four numbered steps -- Manual, an assembly per row, Add row for
  // the third, the arrow between each adjacent pair, Launch -- and the figure is
  // the state after all four. Nothing on the page performs any of them, and a
  // form is what prose is worst at: every step names a shape on screen that the
  // reader has not seen yet.
  //
  // It also answers the question the numbered list raises and does not settle:
  // what the arrow is FOR when only one alignment exists between a given pair.
  // Opening each connector shows the form had already resolved it, so the
  // control is there for the case where the pairing is ambiguous.
  {
    name: 'synteny/three_strain_import',
    description:
      'Building the three-strain H. pylori stack from the import form: Manual, one genome per row, Add row for the third, each connector resolving its own alignment, and Launch',
    url: emptySyntenyForm,
    // One frame serves both states, and the run reports the app at 301 on the
    // opening form and 572 once the stack is standing, so this is the taller of
    // the two with a little margin.
    viewportHeight: 600,
    readySelector: '::-p-text(Quick start)',
    readyTimeout: 120000,
    settleMs: 4000,
    steps: [
      { type: 'delay', ms: 2000 },
      // Quick start is the default because the config ships synteny tracks, and
      // it launches ONE pair. Manual is where a third row is reachable at all.
      { type: 'click', text: 'Manual', say: 'Manual', hold: 1800 },
      {
        type: 'waitForText',
        text: 'Select assemblies for linear synteny view',
      },
      // Manual inherits Quick start's pairing, which is j99 over 26695 -- the
      // config's first synteny track, not the stack this page builds. So every
      // row gets set rather than the tour pretending the form opens ready, and
      // row 2 goes first: setting row 1 to 26695 while row 2 still holds it
      // would ask the form to pair an assembly with itself.
      { type: 'click', selector: assemblyRow(2), say: 'Row 2', hold: 900 },
      { type: 'click', selector: option(strains.middle), hold: 1400 },
      { type: 'click', selector: assemblyRow(1), say: 'Row 1', hold: 900 },
      { type: 'click', selector: option(strains.top), hold: 1400 },
      { type: 'click', text: 'Add row', say: 'Add row', hold: 1600 },
      // The new row's dropdown sits directly under the connector arrow Add row
      // put above it, and the cursor reaches it across that arrow, which raises
      // the arrow's tooltip over the dropdown -- so the click lands on the
      // tooltip. Escape dismisses it; nothing else is open to take the key.
      { type: 'press', key: 'Escape' },
      { type: 'delay', ms: 600 },
      { type: 'click', selector: assemblyRow(3), say: 'Row 3', hold: 900 },
      { type: 'click', selector: option(strains.bottom), hold: 1600 },
      // The two connectors, opened rather than set: each pair has exactly one
      // alignment here and the form has already chosen it, so what these clicks
      // show is the choice being right, which is what a reader working through
      // the numbered steps otherwise has no way to check.
      {
        type: 'click',
        selector: connector(1),
        say: '26695 against CHC155',
        hold: 2600,
      },
      {
        type: 'click',
        selector: connector(2),
        say: 'CHC155 against J99',
        hold: 2600,
      },
      { type: 'click', text: 'Launch', say: 'Launch' },
      // Three genomes and two alignment indexes, off camera: a film of that is a
      // film of an empty view.
      { type: 'waitForAppSettled', timeout: 180000, cut: true },
      { type: 'delay', ms: 3500 },
    ],
    tailMs: 4000,
  },

  // A FORM THAT CHANGES SHAPE AS IT IS USED, which is what no still of it can
  // carry. hg002_haplotypes.md walks the route in three paragraphs of clicks and
  // shows one frame from the middle of it: the mode toggle swaps the whole panel
  // out, a checkbox grows a text box beside each axis, and the boxes take a glob
  // rather than a name. A reader arriving at `hg002_haplotypes_import_form`
  // sees the two boxes already there and has no way to know that the form they
  // opened has neither of them.
  //
  // It also settles the page's own instruction. The config carries the Q100
  // chain, whose `assemblyNames` name one assembly twice -- two rows, both
  // present, so `quickStartSyntenyTracks` keeps it and `useQuickStartState`
  // derives the opening mode as Quick start. So `Manual` is a click a reader has
  // to make, and the tour makes it on camera.
  //
  // Both axis dropdowns already read the one assembly this config declares, so
  // there is nothing to pick on either -- which is the whole reason the boxes
  // are needed here. An axis left alone carries all 47 contigs of both
  // haplotypes, interleaved.
  {
    name: 'synteny/hg002_dotplot_import',
    description:
      "One genome plotted against itself: Add, Dotplot view, Manual, the chromosome boxes a checkbox grows, a wildcard per haplotype, Launch, and Strand from the header's palette",
    url: noViews,
    // Sized to the FORM, which is the subject and the state the clip spends most
    // of its length in: `hg002_haplotypes_import_form` measures the Manual panel
    // with both boxes open at 561. The launched plot is what puts this at 768
    // rather than 562 -- a dotplot's height is fixed at 600 and the frame around
    // it measured 767 (`hg002_haplotypes_wholegenome`), so the last state is the
    // taller of the two and one frame has to serve both. The blank under the
    // form early on is the plot's room. Even, per the encode.
    viewportHeight: 768,
    readySelector: '::-p-text(Select a view to launch)',
    readyTimeout: 120000,
    settleMs: 4000,
    steps: [
      { type: 'delay', ms: 1800 },
      { type: 'click', text: 'Add', say: 'Add', hold: 900 },
      { type: 'waitForText', text: 'Dotplot view' },
      { type: 'click', text: 'Dotplot view', say: 'Dotplot view' },
      // Held before the toggle, so the mode the form actually opens in is on
      // screen long enough to read.
      { type: 'waitForText', text: 'Quick start' },
      { type: 'delay', ms: 2000 },
      { type: 'click', text: 'Manual', say: 'Manual', hold: 1600 },
      { type: 'waitForText', text: 'Select assemblies for dotplot view' },
      { type: 'delay', ms: 2200, say: 'One assembly on both axes' },
      {
        type: 'click',
        text: 'Plot only certain chromosomes',
        say: 'Plot only certain chromosomes',
        hold: 1600,
      },
      // The boxes arrive with the tick, so waiting on one is the check that the
      // click landed rather than a guess at how long the panel takes.
      { type: 'waitForSelector', selector: chromosomeBox('x') },
      {
        type: 'type',
        selector: chromosomeBox('x'),
        value: maternalGlob,
        say: `X axis: ${maternalGlob}`,
        hold: 1400,
      },
      {
        type: 'type',
        selector: chromosomeBox('y'),
        value: paternalGlob,
        say: `Y axis: ${paternalGlob}`,
        hold: 2000,
      },
      { type: 'click', text: 'Launch', say: 'Launch' },
      // The assembly's 47 contigs and then a whole-genome chain, read in one go.
      // Off camera: the click ahead of it stays on.
      {
        type: 'waitForSelector',
        selector: DOTPLOT_DRAWN,
        timeout: 300000,
        cut: true,
      },
      // One black diagonal, which is the state the coloring is about.
      { type: 'delay', ms: 3500 },
      // Short hold: the button's own tooltip opens under it, over the top of the
      // menu, until the cursor leaves for the row below.
      { type: 'click', selector: COLOR_BY_MENU, say: 'Color by', hold: 500 },
      { type: 'waitForText', text: 'Strand' },
      { type: 'hover', text: 'Strand', hold: 1600 },
      { type: 'click', text: 'Strand', say: 'Strand' },
      { type: 'waitForAppSettled', timeout: 120000 },
      // A radio that only writes a setting keeps its menu up, and this one
      // stands over the corner the diagonal starts in. Escape reaches it while
      // focus is still in the list; the click after it blurs the palette button,
      // whose own tooltip outlives the menu, and parks the cursor off the plot.
      { type: 'press', key: 'Escape' },
      { type: 'waitForText', text: 'Mapping quality', hidden: true },
      { type: 'click', selector: '[aria-label="JBrowse"]' },
      // Red collinear, blue inverted, and the two empty lanes chrX and chrY
      // leave.
      { type: 'delay', ms: 4000 },
    ],
    tailMs: 4500,
  },
]
