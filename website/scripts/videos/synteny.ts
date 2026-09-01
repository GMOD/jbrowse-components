// The tours through the two comparative import forms -- the three-strain
// H. pylori stack and the T2T-HG002 self-alignment dotplot -- the reorder that
// re-sorts a dotplot axis once the plot is already up, the follow mode holding
// one haplotype's panel on whatever the other's window aligns to, the two
// launches that rebuild a whole stack around one locus -- a reference-anchored
// .blocks table and an all-vs-all PAF -- and the pairwise launch off one UCSC
// chain block.
import { displayPainted, displaySettled } from '@jbrowse/browser-test-utils'

import { GRAPH_DRAWN } from '../specs/graph-fixtures.ts'
import { hg002VideoFixtures } from '../specs/hg002_haplotypes.ts'
import { syntenyVideoFixtures } from '../specs/synteny.ts'
import { RUBBERBAND, trackMenu } from './shared.ts'

import type { VideoSpec, VideoStep } from '../video-spec-types.ts'

const {
  allVsAllLanes,
  allVsAllMoved,
  allVsAllSpan,
  emptySyntenyForm,
  grassesLanes,
  liftoverBlock,
  liftoverLgv,
  mafRowSpan,
  mafRows,
  mafTrackId,
  multiwayHoverLocus,
  multiwayLanes,
  restackAnchor,
  restackLanes,
  restackSpan,
  roundTripStart,
  segmentsTrackId,
  strains,
  unorderedDotplot,
} = syntenyVideoFixtures
const { followScrollPanels, maternalGlob, noViews, paternalGlob } =
  hg002VideoFixtures

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

// The one annotation track the hpylori config carries per genome, named in the
// selector by the file it was built from -- so the row's assembly name plus the
// suffix is the string on the row, and it is unique on the page (the assembly
// name alone is also the row label and the location box's summary).
const geneTrack = (assembly: string) => `${assembly}.gff`

// The dotplot form's two chromosome boxes. Both carry the same placeholder and
// the same label shape, so the testid on the input is the only handle that says
// which axis is meant (ChromosomeFilter, whose `testId` goes on the html input).
const chromosomeBox = (axis: 'x' | 'y') =>
  `[data-testid="chromosome-filter-${axis}"]`

// The palette button both comparative headers render (ColorBySelector). Its
// testid rides through CascadingMenuButton's `...rest` onto the IconButton.
const COLOR_BY_MENU = '[data-testid="color_by_menu"]'

// One sideways drag across the HG002 tour's top panel, named by the two
// maternal coordinates it grabs and releases at. `track` puts the press inside
// the gene lane's own rendering container: the LGV's click-drag pan skips a
// press that lands on a resize handle, which is what the strip between two lanes
// is, and the tracks container's own midpoint is one of those.
const panMaternal = (from: string, to: string, say?: string): VideoStep => ({
  type: 'drag',
  fromAnchor: {
    locus: `chr8_MATERNAL:${from}`,
    track: 'hg002_genes_mat',
    view: [0, 0],
  },
  toAnchor: {
    locus: `chr8_MATERNAL:${to}`,
    track: 'hg002_genes_mat',
    view: [0, 0],
  },
  dragMs: 2200,
  hold: 400,
  ...(say === undefined ? {} : { say }),
})

// The rubberband menu's Launch submenu, and the entry under it that opens the
// multi-panel launch dialog. By testid rather than by text: the synteny track's
// name is also its label in the view behind the menu, and a text match resolves
// to the first visible one, which is that label. Both slugs are what
// CascadingMenu's makeTestId builds out of the labels -- 'Launch' from
// buildRubberBandMenuItems, 'Linear synteny view' from linearViewMenuItems'
// SELECTION_LABEL.
const LAUNCH_SUBMENU = '[data-testid="cascading-submenu-launch"]'
const LAUNCH_SYNTENY_VIEW =
  '[data-testid="cascading-menuitem-linear_synteny_view"]'

// `cascading-menuitem-<label>`, lowercased with whitespace as `_`: the child's
// label is the strain and its locus, and only the strain half is stable.
const MAF_NCTC86_ENTRY = '[data-testid^="cascading-menuitem-nctc86_chr"]'

// The MAF display's rows area, below its coverage and conservation bands. As a
// drag's `band` it is what makes the two `fracY` fractions mean "the top row"
// and "the bottom row" at any display height -- a fraction of the whole display
// would have to encode where the bands end, which is a setting.
const MAF_ROWS = '[data-testid="maf-rows"]'

// One of the launch dialog's reorder arrows. Labelled with the assembly AND its
// position, because a self-alignment track lists the anchor's assembly twice and
// "Move grape up" would then name two buttons a screen reader cannot tell apart
// (PanelList's MoveButton). The position in the label is 1-based.
const panelArrow = (assembly: string, panel: number, dir: 'up' | 'down') =>
  `button[aria-label="Move ${assembly} (panel ${panel}) ${dir}"]`

// The dotplot's shared canvas once it has painted AND no display is still
// fetching -- `data-display-drawn` on this view means both (DotplotView model's
// `settled`), so it is the gate a whole-genome chain read can be waited out on.
const DOTPLOT_DRAWN =
  '[data-testid="dotplot_webgl_canvas"][data-display-drawn="true"]'

// The dotplot header's overflow menu, which holds the reorder. Its own testid,
// added for this tour: it was the one control in that header with neither a
// label nor a handle, and the site's spec-recipe table names it as "the ⋮
// menu" for exactly that reason.
const DOTPLOT_VIEW_MENU = '[data-testid="dotplot_view_menu"]'

export const syntenyVideos: VideoSpec[] = [
  // A RE-LAYOUT THE PAGE'S TWO FIGURES ONLY BOOKEND. Every lane below the
  // anchor is fitted to whatever orthologs the anchor's window brings in, so a
  // zoom-out is not the anchor's own re-scale repeated seven times: each lane
  // re-fits its OWN frame, a sparse lane holds its genome's scale until the
  // window forces it wider, and the ribbons re-chain onto the new frames. The
  // tutorial's gene-level and block-level figures are the two endpoints; the
  // re-fit between them is motion, and this films it.
  //
  // The hover opens the clip because it is the reading the ribbons exist for
  // and no still can perform it: one ribbon under the pointer, its whole
  // ortholog group filling in down every lane that kept the gene.
  {
    name: 'synteny/multiway_zoom_out',
    description:
      "The grape multi-way lanes at gene scale, a hovered ribbon reading one ortholog group down the stack, then three zoom-outs with every lane re-fitting its own frame to the anchor's widening window",
    url: multiwayLanes,
    // The app is the grape gene track over the 340px lane stack: the page's
    // own figures frame it at 680 and the run measured the app at 685, so 690
    // holds the whole app with the caption chip's strip under it. Even, per
    // the encode.
    viewportHeight: 690,
    // phase ready covers the dependent per-lane gene fetch too, so the camera
    // opens on lanes carrying their gene models rather than on boxes about to
    // be replaced
    readySelector: displaySettled('multiway-synteny-display'),
    readyTimeout: 120000,
    settleMs: 12000,
    steps: [
      // park the pointer off the cytoband strip so the opening frame carries
      // no coordinate chip
      { type: 'hover', selector: '[aria-label="JBrowse"]', hold: 0 },
      // the gene-level state, held: one ribbon per ortholog pair
      { type: 'delay', ms: 2500 },
      // just below the anchor lane's glyph row, where the tandem-expansion
      // group's ribbon leaves it
      {
        type: 'hover',
        anchor: {
          track: 'grape_peach_cacao_blocks',
          locus: multiwayHoverLocus,
          fracY: 0.11,
        },
        say: 'Hover a ribbon',
        hold: 3000,
      },
      { type: 'hover', selector: '[aria-label="JBrowse"]', hold: 800 },
      {
        type: 'click',
        selector: '[data-testid="zoom_out"]',
        say: 'Zoom out',
        hold: 600,
      },
      // on camera: the lanes re-fitting IS the payoff, and the app publishes
      // when the refetch behind it has settled
      { type: 'waitForAppSettled', timeout: 120000 },
      { type: 'delay', ms: 2200 },
      {
        type: 'click',
        selector: '[data-testid="zoom_out"]',
        say: 'Zoom out',
        hold: 600,
      },
      { type: 'waitForAppSettled', timeout: 120000 },
      { type: 'delay', ms: 2200 },
      {
        type: 'click',
        selector: '[data-testid="zoom_out"]',
        say: 'Zoom out',
        hold: 600,
      },
      { type: 'waitForAppSettled', timeout: 120000 },
      // the block-level state the page's first figure is of, held as the end
      // state
      { type: 'delay', ms: 3000 },
    ],
    tailMs: 4500,
  },

  // THE HANDOFF THE LANES CANNOT PERFORM ON THEMSELVES. "From lanes to a full
  // stack" names a track-menu entry, a dialog and a replaced view, and every
  // one of those is a shape the reader has not seen — the same reason the
  // rubberband launch got its film. This one starts from the TRACK that is
  // already showing the lanes, so there is no drag and no dataset choice: the
  // dialog opens cut from this track alone over the visible window, one row
  // offered per grass.
  //
  // No reorder clicks: the restack tour is the film of the arrows, and here
  // the anchor-on-top order the dialog opens in is the one the launched stack
  // wants. What the dialog gets instead is READING TIME on its span column,
  // which prints where each panel would open before the reader commits to it.
  //
  // NO UNTICK. The tour used to drop brachypodium on camera, because a stray
  // same-contig hit stretched its block union to tens of megabases while the
  // lane display's median fit filtered the same hit out. `resolvePanel` shares
  // that filter now (`keepNearMedian`), and the dialog prints brachypodium at
  // 176Kbp against rice's 170, sorghum's 178 and setaria's 166 — so the step
  // dropped a perfectly good panel while narrating that it was out of scale.
  // Maize is the wide row now at 454Kbp, and it is NOT the replacement: this
  // demo exists partly to show maize's whole-genome duplication, so teaching
  // the reader to untick it teaches them to discard the finding.
  //
  // It ends on Replace current view for the same reason both launch tours do —
  // the genome rows do not share a window with the lane view they came from.
  {
    name: 'synteny/multiway_launch_stack',
    description:
      "From the grasses lane track to the stacked view: the track menu's Launch stacked synteny view entry, the dialog offering a row per grass with each panel's span printed beside it, and Replace current view putting the stack in the lane view's place",
    url: grassesLanes,
    // Sized to the LAUNCHED STACK, the tallest of the three states and the
    // frame the poster comes from: the run measured the app at 665 on the
    // opening lanes and 705 once the five rows and four bands were standing,
    // so 750 holds the payoff with the caption chip's strip under it — and
    // leaves the dialog's paper far over what the allvsall tour measured five
    // rows needing. The blank under the lanes early on is the stack's room.
    viewportHeight: 750,
    readySelector: displaySettled('multiway-synteny-display'),
    readyTimeout: 120000,
    settleMs: 12000,
    steps: [
      { type: 'hover', selector: '[aria-label="JBrowse"]', hold: 0 },
      // the lanes, held: one per grass under rice's own genes
      { type: 'delay', ms: 2500 },
      {
        type: 'click',
        selector:
          '[data-testid="track_menu_icon"][data-trackid="grasses_orthogroups"]',
        say: 'Track settings',
        hold: 1400,
      },
      { type: 'waitForText', text: 'Launch stacked synteny view' },
      {
        type: 'hover',
        text: 'Launch stacked synteny view (visible region)',
        hold: 1600,
      },
      {
        type: 'click',
        text: 'Launch stacked synteny view (visible region)',
        say: 'Launch stacked synteny view (visible region)',
      },
      { type: 'waitForText', text: 'Panels, top to bottom' },
      // The rows arrive from the worker's mate discovery, which re-reads the
      // table the lanes already pulled — a cache hit in the same worker.
      // Waiting on maize's arrow asserts every grass got its row.
      {
        type: 'waitForSelector',
        selector: 'button[aria-label*="Move maize"]',
        timeout: 180000,
      },
      // long enough to read the order the dialog opens in and the span the
      // dialog prints beside each row, which is now the whole of what this
      // state has to say — it carries the beat the untick click used to
      { type: 'delay', ms: 5200, say: 'One panel per grass' },
      {
        type: 'click',
        text: 'Replace current view',
        say: 'Replace current view',
      },
      // Camera stays on: the lane view being replaced by the five-row stack
      // IS the payoff, and the bands read the file the lanes already pulled.
      {
        type: 'waitForSelector',
        selector: displayPainted('synteny_canvas'),
        timeout: 180000,
      },
      { type: 'waitForAppSettled', timeout: 180000 },
      { type: 'delay', ms: 3000 },
    ],
    tailMs: 4500,
  },

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
      "Building the three-strain H. pylori stack from the import form: Manual, one genome per row, Add row for the third, each connector resolving its own alignment, Launch, and a gene track from each row's own selector",
    url: emptySyntenyForm,
    // One frame serves three states and the tallest is the last: the run reports
    // the app at 301 on the opening form, 572 with the stack standing empty, and
    // 821 once three gene lanes have replaced the three empty-state blocks. The
    // rest is the caption chip's strip, which is fixed to the frame's bottom
    // rather than the app's.
    viewportHeight: 900,
    readySelector: '::-p-text(Quick start)',
    readyTimeout: 120000,
    settleMs: 4000,
    steps: [
      { type: 'delay', ms: 1200 },
      // Quick start is the default because the config ships synteny tracks, and
      // it launches ONE pair. Manual is where a third row is reachable at all.
      { type: 'click', text: 'Manual', say: 'Manual', hold: 1500 },
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
      { type: 'click', selector: option(strains.middle), hold: 1200 },
      { type: 'click', selector: assemblyRow(1), say: 'Row 1', hold: 900 },
      { type: 'click', selector: option(strains.top), hold: 1200 },
      { type: 'click', text: 'Add row', say: 'Add row', hold: 1400 },
      // The new row's dropdown sits directly under the connector arrow Add row
      // put above it, and the cursor reaches it across that arrow, which raises
      // the arrow's tooltip over the dropdown -- so the click lands on the
      // tooltip. Escape dismisses it; nothing else is open to take the key.
      { type: 'press', key: 'Escape' },
      { type: 'delay', ms: 600 },
      { type: 'click', selector: assemblyRow(3), say: 'Row 3', hold: 900 },
      { type: 'click', selector: option(strains.bottom), hold: 1400 },
      // The two connectors, opened rather than set: each pair has exactly one
      // alignment here and the form has already chosen it, so what these clicks
      // show is the choice being right, which is what a reader working through
      // the numbered steps otherwise has no way to check.
      {
        type: 'click',
        selector: connector(1),
        say: '26695 against CHC155',
        hold: 2100,
      },
      {
        type: 'click',
        selector: connector(2),
        say: 'CHC155 against J99',
        hold: 2100,
      },
      { type: 'click', text: 'Launch', say: 'Launch' },
      // Three genomes and two alignment indexes, off camera: a film of that is a
      // film of an empty view.
      { type: 'waitForAppSettled', timeout: 180000, cut: true },
      { type: 'delay', ms: 1500 },
      // THE STACK ARRIVES WITH NOTHING ON IN ANY ROW, and stopping there made
      // the payoff frame three copies of that empty state. The button the empty
      // state is already showing is the route, so the tour takes it: three rows,
      // three selectors, the drawer swapping to whichever row asked for it.
      //
      // `Open track selector` resolves to the first one still on screen, which
      // is row 1's until its lane replaces it, then row 2's -- so the same text
      // walks down the stack without any of them needing a handle. The label is
      // upper-cased by the button's own styling, which is why the chip and the
      // string being matched differ.
      //
      // HELD SHORT, ALL THREE, AND CLOSED ONCE, which is the one thing about
      // this stretch that is not free. An LGV holds its WINDOW in bp across a
      // resize (`windowWidthBp` is the state and every later width divides into
      // it), so the drawer's ~390px is a 25% zoom out for every row in the
      // frame: ~1600 top-level features over ~1370px is 1.17 per pixel, past the
      // display's default maxFeatureScreenDensity of 1, and every lane ticked
      // here paints "Too many features" until the rows get their width back. At
      // the frame's full width it is 0.94, which is what makes the last state
      // three gene lanes -- a 6% margin, so a narrower frame or a wider drawer
      // would put the payoff back on the banner.
      {
        type: 'click',
        text: 'Open track selector',
        say: 'OPEN TRACK SELECTOR',
        hold: 700,
      },
      {
        type: 'click',
        text: geneTrack(strains.top),
        say: geneTrack(strains.top),
        hold: 700,
      },
      {
        type: 'click',
        text: 'Open track selector',
        say: 'OPEN TRACK SELECTOR',
        hold: 500,
      },
      {
        type: 'click',
        text: geneTrack(strains.middle),
        say: geneTrack(strains.middle),
        hold: 600,
      },
      {
        type: 'click',
        text: 'Open track selector',
        say: 'OPEN TRACK SELECTOR',
        hold: 500,
      },
      {
        type: 'click',
        text: geneTrack(strains.bottom),
        say: geneTrack(strains.bottom),
        hold: 600,
      },
      // The rows get their width back here, which is both what the payoff frame
      // needs and what lets the three lanes draw at all.
      {
        type: 'click',
        selector: 'button[aria-label="Close drawer"]',
        say: 'Close the track selector',
        hold: 300,
      },
      // OFF CAMERA, and gated on the banner rather than on a paint: each lane
      // re-fetches at the width it just got back, which is a few more seconds of
      // "Too many features" and then a progress bar. It is also the one wait
      // that fails loudly if the margin above ever goes the other way -- a
      // display over its density gate still reports `ready`, so a settle would
      // carry on with the banner up and ship the payoff as three warnings.
      {
        type: 'waitForText',
        text: 'Too many features',
        hidden: true,
        timeout: 120000,
        cut: true,
      },
      { type: 'waitForAppSettled', cut: true },
      { type: 'delay', ms: 1500 },
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

  // A MODE, WHICH IS THE ONE THING A BEFORE-AND-AFTER CANNOT SHOW.
  // hg002_haplotypes.md's follow figure is two frames, the panels drifted and
  // the panels together, and both of those are equally true of the right-click
  // item beside it -- "Move other panel to the matching region" produces the
  // second frame from the first in one click. What separates the toggle from it
  // is what happens next: the reader keeps moving, touches nothing else, and the
  // panel below stays on the matching sequence. There is no still of that,
  // because the evidence is a move nobody made.
  //
  // So the payoff here is the SCROLL, not the click. The top panel is dragged
  // sideways three times over ~2.4 Mb and the bottom one holds register through
  // every frame of it: the follow's frame pass replans off live geometry rather
  // than waiting for the 500ms settle, which is a claim only a moving picture
  // can make.
  //
  // Dragged rather than typed, and that is the change from the first take. A
  // locstring puts two windows' numbers on screen and demonstrates one jump; the
  // question readers actually have (discussion #5610) is whether the mode keeps
  // up while they work, and a jump answers it the same way the right-click item
  // would.
  //
  // The session is `followScrollPanels` and its comment carries the framing: 2 Mb
  // out, both panels on the same coordinates, ~241 kb out of register, with the
  // gene lanes and the ribbon's location markers as the two things on screen that
  // say so.
  {
    name: 'synteny/hg002_follow_panels',
    description:
      "One genome's two haplotypes nearly lined up and then held there: the header's follow toggle putting the gene lanes into register, and the top panel dragged sideways with the bottom one keeping pace",
    url: followScrollPanels,
    // Two lanes a panel rather than the follow figure's one, plus the caption
    // chip's strip under the app.
    viewportHeight: 700,
    readySelector: displayPainted('synteny_canvas'),
    // A whole-genome chain read in one go, which is the figures' own budget for
    // this session.
    readyTimeout: 120000,
    settleMs: 10000,
    steps: [
      // The camera opens with the pointer at the top middle, which in a synteny
      // view is the maternal panel's own ruler -- and the view writes what is
      // under the pointer into its title bar.
      { type: 'hover', selector: '[aria-label="JBrowse"]', hold: 0 },
      // The state the toggle exists for, held long enough to find the same gene
      // names in both lanes and see that they are not under each other.
      { type: 'delay', ms: 5000, say: 'Both panels on the same coordinates' },
      {
        type: 'click',
        selector: '[data-testid="follow-synteny-toggle"]',
        say: 'Follow the matching region',
        hold: 600,
      },
      // ON CAMERA: the follow's exact pass is an RPC per level off the anchor's
      // SETTLED window, so the move arrives a beat after the click rather than
      // with it, and a `waitForAppSettled` on its own can return before the
      // settle throttle has even asked.
      { type: 'delay', ms: 3000 },
      // The toggle's own tooltip names the mode and the anchor row, which is
      // worth a beat and not worth the whole of the next state -- the pointer
      // stays on the button otherwise, and the tooltip sits over the maternal
      // panel's title.
      { type: 'hover', selector: '[aria-label="JBrowse"]', hold: 0 },
      { type: 'waitForAppSettled', timeout: 120000 },
      {
        type: 'delay',
        ms: 3000,
        say: 'The gene lanes are now under each other',
      },
      // THE SCROLL. Three drags on the maternal panel's gene lane, each 800 kb
      // of the same collinear chain, each slow enough to watch the row below
      // move with it rather than after it -- `dragMs` over the 700ms default,
      // which at this width is a flick.
      //
      // Both ends of every drag are LOCI in the panel being dragged, so each
      // sweep is 800 kb whatever the frame is; a measured x would be a distance
      // only at the width it was written at. They step forward with the window,
      // since a locus the pan has already carried off the frame resolves to a
      // point outside the viewport and fails the drag.
      panMaternal('14,400,000', '13,600,000', 'Drag the top panel sideways'),
      panMaternal('15,200,000', '14,400,000'),
      panMaternal('16,000,000', '15,200,000'),
      { type: 'waitForAppSettled', timeout: 120000 },
      // Ends on the followed pair 2.4 Mb along, which is the tallest state --
      // nothing in this tour grows the app -- so the poster is the state the
      // section describes.
      {
        type: 'delay',
        ms: 3500,
        say: 'The panel below was never touched',
      },
    ],
    tailMs: 4500,
  },

  // A RE-LAYOUT WITH NO BEFORE ON THE PAGE. mcscan_synteny_grape_peach.md says
  // the axes start in each assembly's index order, "which scatters the runs",
  // and then shows one figure: the plot after the reorder. The scattered state
  // the sentence is about appears nowhere, so the claim that Re-order
  // chromosomes did the tidying is the reader's to take on trust -- and the
  // section after it reads the reorder's result as a fact about grape and peach,
  // which only holds if the reader saw what it started from.
  //
  // The clip is the two states with the control between them. The reorder is
  // also the page's one route that a figure cannot carry at all: it is a menu
  // item that opens a dialog and does nothing until a second click, so a still
  // of the plot cannot show it was ever pressed.
  {
    name: 'synteny/dotplot_reorder',
    description:
      "Grape against peach as a dotplot, with grape's axis re-sorted on demand: the dotplot header's overflow menu, Re-order chromosomes, and the run that reads the .anchors pairs and reports what it moved",
    url: unorderedDotplot,
    // 768, which is what the hg002 dotplot tour above is framed at and for the
    // same arithmetic: a dotplot's height is fixed (defaultHeight 600, and a
    // session spec cannot set it), so the app frame around it does not grow, and
    // `hg002_haplotypes_wholegenome` measured that frame at 767 off its own
    // below-the-fold report. Even, per the encode. Nothing here is taller: both
    // overlays are overlays -- the ⋮ menu drops five rows below a button near
    // the top, and the dialog is a centred box of a paragraph, a progress bar
    // and two buttons.
    //
    // No `viewportWidth`, per the corpus rule, and it does cost this plot its
    // aspect ratio: 600px of fixed height under 1920 of frame is a plot about
    // three times as wide as it is tall, so peach's 8 chromosomes spread across
    // the width while grape's 19 stack into the height. The reorder reads as
    // grape's rows re-stacking rather than as a 45-degree line -- which is the
    // axis the control moves, so the subject survives the shape. The page's own
    // figure was framed at 1500 and is nearly as wide.
    viewportHeight: 768,
    // The camera opens on the scattered plot rather than on the anchors file
    // loading: both BEDs and the whole .anchors are read off S3 in one go, since
    // neither adapter has an indexed variant.
    readySelector: DOTPLOT_DRAWN,
    readyTimeout: 180000,
    settleMs: 6000,
    steps: [
      // The scattered state, held. It is the half of the comparison the page
      // does not have.
      { type: 'delay', ms: 3500 },
      {
        type: 'click',
        selector: DOTPLOT_VIEW_MENU,
        say: 'Dotplot header ⋮',
        hold: 1600,
      },
      { type: 'waitForText', text: 'Re-order chromosomes' },
      {
        type: 'click',
        text: 'Re-order chromosomes',
        say: 'Re-order chromosomes',
      },
      // The dialog is lazy, so this waits on the chunk as well as on the open.
      // Matched on its description rather than on its title, which is the menu
      // item's string too.
      { type: 'waitForText', text: 'Reorders the vertical axis' },
      // Long enough to read that sentence, which is the one place the app says
      // WHICH axis moves and what it moves it against.
      {
        type: 'delay',
        ms: 3000,
        say: 'The vertical axis, against the fixed horizontal one',
      },
      { type: 'click', text: 'Start', say: 'Start' },
      // ON CAMERA, deliberately, and this is the step where that is a choice.
      // The reorder is a whole-file RPC, which is the shape of thing the corpus
      // cuts -- but a cut here would take out the only frames in which the app
      // says what it is doing. The dialog is explicit-start and reports its own
      // progress (DiagonalizeDialog's StatusProgressBar over the RPC's status
      // stream), so what is on screen is the run naming its phases, not a
      // spinner. It is also the page's evidence for "using the alignments
      // themselves". The reorder should be quick besides: it reuses the
      // displays' own rpcSessionId, so it lands on the sticky worker that has
      // the anchors file already parsed from the load above.
      //
      // Matched on the summary rather than on the progress bar going away,
      // because the two endings read differently: `summarize` writes "Done:
      // reordered ..." when the RPC came back with regions and "No alignments
      // to reorder" when it came back with none. So a timeout here is a finding
      // about the run, not a mis-written wait.
      { type: 'waitForText', text: 'Done: reordered', timeout: 180000 },
      // The summary line, which counts the regions it moved and the ones it
      // flipped -- a number the plot behind the dialog cannot show.
      { type: 'delay', ms: 3000 },
      { type: 'click', text: 'Close', say: 'Close' },
      { type: 'waitForText', text: 'Re-order chromosomes', hidden: true },
      // The dialog sits centred OVER the plot, so Close leaves the pointer on
      // the canvas, where DotplotTooltips follows it. The logo is a bare `<g>`
      // with no handler, so this only parks the cursor.
      { type: 'click', selector: '[aria-label="JBrowse"]' },
      // Also on camera. `setDisplayedRegions` on the vertical axis lands before
      // the dialog says Done, so the refetch it triggers has been running under
      // the dialog and this is the tail of it: the axis labels arriving in their
      // new order and the runs landing on the diagonal. Cutting it would splice
      // the before straight onto the after, which is the two-picture figure this
      // tour exists to replace.
      { type: 'waitForSelector', selector: DOTPLOT_DRAWN, timeout: 180000 },
      // The reordered plot, which is the state the page's figure is of.
      { type: 'delay', ms: 4000 },
    ],
    tailMs: 4500,
  },

  // A DRAG, A DIALOG WHOSE ROWS THE READER REORDERS, AND A RE-LAYOUT OFF THE
  // BACK OF IT. "Restacking around a locus" is the one section of
  // multiway_synteny_grape_peach_cacao.md with no figure at all, and it states
  // the whole route in a sentence: drag-select a locus, pick Launch -> Linear
  // synteny view, order the dialog's rows with its arrows. Every noun in that
  // sentence is a shape on screen the reader has not seen, and the arrows are
  // the half no still can carry -- what they change is the stack the launch then
  // builds, so the before and the after are two pictures with nothing linking
  // them.
  //
  // THE REORDER IS ONE CLICK, and that is the section's point rather than a
  // shortcut. The dialog lists the anchor first and then the mates in the
  // track's declared `assemblyNames` order (pickMatesForRegion), so it opens
  // grape / peach / cacao -- the reference on top, where the lower band is peach
  // against cacao and therefore transitive. Moving grape down once is the
  // reference-in-the-middle arrangement "Direct vs transitive pairs" asks for,
  // and `launchOrder` states the same case from the launch's own side.
  //
  // Four more genomes align at this locus and get no panel. The track declares
  // assemblies for grape, peach and cacao only, so arabidopsis, poplar, tomato
  // and citrus land in the dialog's `unconfigured` line -- the difference
  // between a lane and a panel that the section's second paragraph makes, said
  // by the dialog itself.
  //
  // It ends on "Replace current view", the dialog's other way out: the stack
  // takes the lane view's slot, so the last frame is the result rather than
  // mostly the source, and nothing has to be scrolled to reach a view appended
  // below one that is still standing.
  {
    name: 'synteny/restack_around_locus',
    description:
      "Restacking the grape / peach / cacao view around one locus: drag the scale bar, Launch, Linear synteny view, move grape into the middle with the dialog's arrows, and replace the lane view with the three-row stack",
    url: restackLanes,
    // Sized to the DIALOG, which is the subject and the tallest of the three
    // states. `multiway_synteny/blocks_one_vs_all` measures the opening lane
    // view at 478, and the launched stack is one gene lane on the grape row plus
    // two collapsed rows around two 100px bands (levelHeightForCount, at two
    // levels), which lands under that. The dialog is what neither of them
    // bounds: MUI caps its paper at the viewport minus 64px, and
    // `multiway_synteny/ecoli_launch_dialog` needed 560 of paper for five panel
    // rows and a Select all/none row. Three rows and no bulk row is less than
    // that, and the unconfigured line adds a line or two back, so 640 leaves the
    // paper 576 and keeps the action row inside the frame. The blank under the
    // lanes early on is the dialog's room.
    viewportHeight: 640,
    readySelector: displayPainted('pileup-display'),
    readyTimeout: 120000,
    settleMs: 12000,
    steps: [
      { type: 'delay', ms: 2000 },
      // Both ends are loci rather than pixels: a measured x is correct only at
      // the width it was measured at, and this corpus was re-framed once
      // already. `band` takes the y off the strip the drag is drawn on, while
      // the x still comes from the locus.
      {
        type: 'drag',
        fromAnchor: { locus: restackSpan.start, band: RUBBERBAND },
        toAnchor: { locus: restackSpan.end, band: RUBBERBAND },
        say: 'Drag across the scale bar',
        hold: 900,
      },
      { type: 'waitForSelector', selector: LAUNCH_SUBMENU },
      { type: 'click', selector: LAUNCH_SUBMENU, say: 'Launch', hold: 1200 },
      { type: 'waitForSelector', selector: LAUNCH_SYNTENY_VIEW },
      { type: 'delay', ms: 700 },
      {
        type: 'click',
        selector: LAUNCH_SYNTENY_VIEW,
        say: 'Linear synteny view',
      },
      { type: 'waitForText', text: 'Panels, top to bottom' },
      // The arrows exist only once the worker has resolved a row per aligning
      // assembly, so waiting on one is the gate over that fetch rather than a
      // sleep guessing at it. The whole .blocks table and its per-column BEDs
      // are read for this, and the lane display above has already read them, so
      // it is a cache hit in the same worker.
      {
        type: 'waitForSelector',
        selector: panelArrow(restackAnchor, 1, 'down'),
        timeout: 180000,
      },
      // Long enough to read the order the dialog opens in, which is what the
      // click after it changes.
      { type: 'delay', ms: 3000, say: 'The reference opens on top' },
      {
        type: 'click',
        selector: panelArrow(restackAnchor, 1, 'down'),
        say: 'Move grape between peach and cacao',
        hold: 3000,
      },
      {
        type: 'click',
        text: 'Replace current view',
        say: 'Replace current view',
      },
      // Camera stays on: the re-layout IS the payoff here, and both bands read
      // the file the lanes and the mate discovery have already pulled into the
      // worker.
      {
        type: 'waitForSelector',
        selector: displayPainted('synteny_canvas'),
        timeout: 180000,
      },
      { type: 'waitForAppSettled', timeout: 180000 },
      { type: 'delay', ms: 3000 },
    ],
    tailMs: 4500,
  },

  // THE SAME ROUTE ON A COMPLETE GRAPH, where what the arrows change is the
  // whole point. allvsall_synteny.md flattens this into a three-panel composite
  // -- `multiway_synteny/ecoli_launch_from_selection`, the selection, the dialog
  // and the launched stack -- whose middle panel is a dialog with five
  // reorderable rows and no way to show one being moved. The section's own
  // sentence is the claim the stills leave hanging: "Ribbons are drawn between
  // neighbouring rows only, so the order determines which comparisons the view
  // can show. That is why IAI39 sits directly below K-12."
  //
  // Five rows rather than the restack's three, and none of them dropped. The
  // dialog lists the anchor plus one mate per assembly the TRACK declares that
  // aligns to the selection (pickMatesForRegion), and ecoli_ava declares the
  // same five samples all_vs_all.paf was built from -- so nothing lands in the
  // `unconfigured` line the grape/peach/cacao dialog carries, and rows.length of
  // 5 is over PanelList's BULK_SELECT_THRESHOLD, which grows the Select
  // all/none row under the list. Both are why this dialog is the frame's
  // constraint.
  //
  // The reorder is THREE clicks, and they are three different buttons: IAI39
  // opens last, in the track's declared order, and MoveButton carries the
  // panel's position in its own aria-label, so every click renames the control
  // it was made on. That is the half of this dialog a still cannot carry at all.
  //
  // It ends on "Replace current view", as the composite's own third frame does:
  // five genome rows and four bands do not share a window with the lane view
  // they were launched from, and the alternative is a `scrollTo` down to a
  // result that would then be the only thing in frame anyway.
  {
    name: 'synteny/allvsall_launch_from_selection',
    description:
      "From one strain's lanes to the five-strain stack for one locus: drag the scale bar, Launch, Linear synteny view, move IAI39 up to sit under K-12 with the dialog's arrows, and replace the lane view with the stack",
    url: allVsAllLanes,
    // Sized to the DIALOG, which is the tallest of the three states and the
    // subject. MUI caps a dialog's paper at the viewport minus 64px, and
    // `multiway_synteny/ecoli_launch_dialog` -- the same five rows, the same
    // Select all/none row, the same one-line dataset field -- fits in 622 of
    // viewport with almost nothing spare. The dialog's paper is capped at MUI's
    // `sm` (600px) whichever way the frame widens, so that measurement carries
    // from the stills' 1500 to the corpus width unchanged. 640 leaves it 576.
    //
    // The launched stack is the other tall state and comes in under that:
    // `multiway_synteny/ecoli_launch_result` measures five collapsed rows and
    // four bands at 620, and the bands are a budget rather than a constant
    // (levelHeightForCount splits 320px over four levels), so a wider frame does
    // not grow it. So the last frame leaves ~20px of page background under the
    // app, deliberately: the run reports that direction and the other one
    // truncates the dialog. The blank under the lanes early on is the dialog's
    // room.
    viewportHeight: 640,
    readySelector: displayPainted('pileup-display'),
    readyTimeout: 120000,
    settleMs: 12000,
    steps: [
      // The lanes, held: one per strain, which is the reading this section is
      // going FROM.
      { type: 'delay', ms: 2500 },
      // Loci rather than pixels on both ends. The composite's own drag is a
      // measured pair (`launchFromSelectionParts`), which is correct only at the
      // width it was measured at; `allVsAllSpan` names the same span in bases,
      // and `band` takes the y off the scalebar strip while the x stays on the
      // locus.
      {
        type: 'drag',
        fromAnchor: { locus: allVsAllSpan.start, band: RUBBERBAND },
        toAnchor: { locus: allVsAllSpan.end, band: RUBBERBAND },
        say: 'Drag across the scale bar',
        hold: 900,
      },
      { type: 'waitForSelector', selector: LAUNCH_SUBMENU },
      { type: 'click', selector: LAUNCH_SUBMENU, say: 'Launch', hold: 1200 },
      { type: 'waitForSelector', selector: LAUNCH_SYNTENY_VIEW },
      { type: 'delay', ms: 700 },
      {
        type: 'click',
        selector: LAUNCH_SYNTENY_VIEW,
        say: 'Linear synteny view',
      },
      { type: 'waitForText', text: 'Panels, top to bottom' },
      // The dialog opens on a spinner and the rows arrive from the worker, which
      // reads the whole PAF -- the lane display above has already pulled it, so
      // it is a cache hit in the same worker. Waiting on the LAST panel's arrow
      // is also the assertion that all four mates came back: a discovery that
      // found fewer would leave IAI39 somewhere other than panel 5 and fail here
      // rather than filming a short dialog.
      {
        type: 'waitForSelector',
        selector: panelArrow(allVsAllMoved, 5, 'up'),
        timeout: 180000,
      },
      // Long enough to read the order the dialog opens in, and the line above
      // the list saying what the order decides.
      { type: 'delay', ms: 3000, say: 'One panel per strain that aligns' },
      {
        type: 'click',
        selector: panelArrow(allVsAllMoved, 5, 'up'),
        say: `Move ${allVsAllMoved} up`,
        hold: 1400,
      },
      {
        type: 'click',
        selector: panelArrow(allVsAllMoved, 4, 'up'),
        hold: 1400,
      },
      {
        type: 'click',
        selector: panelArrow(allVsAllMoved, 3, 'up'),
        hold: 3000,
      },
      {
        type: 'click',
        text: 'Replace current view',
        say: 'Replace current view',
      },
      // Camera stays on: the stack arriving IS the payoff, and all four bands
      // read the file the lanes and the mate discovery have already pulled into
      // the worker.
      {
        type: 'waitForSelector',
        selector: displayPainted('synteny_canvas'),
        timeout: 180000,
      },
      { type: 'waitForAppSettled', timeout: 180000 },
      // The stack, with the row the arrows moved sitting under the anchor.
      { type: 'delay', ms: 3500 },
    ],
    tailMs: 4500,
  },

  // THE PAIRWISE LAUNCH, which genomes_synteny.md carries as a four-panel
  // composite -- a route flattened into stills, and taken on a pair the page is
  // not about. Every noun in its two paragraphs is a shape on screen: a menu on
  // a canvas-drawn block, a dialog whose fields depend on the block clicked, and
  // two submit buttons that build the same view into different slots. The
  // composite's own third and fourth frames are one launch photographed twice.
  //
  // ON THE PAGE'S OWN PAIR. hg38 against hs1 at TNNT3 is the comparison the
  // page opens by naming and ends by reading, and the composite is hg38 against
  // panTro6 at FTO -- so a reader met the route on a dataset that appears
  // nowhere else. The clip lands on hg38 chr11 vs hs1 chr11 at this locus, which
  // is the window `synteny_hg38_hs1_tnnt3` is of, so the section after it has a
  // ribbon to change settings on and the section after that has the
  // rearrangement to read. The composite stays, one section further down, where
  // "the same click-path works for any liftOver track" is the sentence it
  // illustrates.
  //
  // THE CIGAR CHECKBOX IS THE DIALOG'S SUBJECT and this locus is the case that
  // makes it visible: the block under the cursor is the chromosome-scale hg38 ->
  // hs1 chain (tchr11:60,000-135,076,382), so untick it and both panels open on
  // the whole of chromosome 11 rather than on TNNT3. Hovered rather than
  // toggled -- unticking it films a launch nobody wants, and the page states
  // what it costs.
  //
  // No flip checkbox in frame: `FlipInvertedTargetsCheckbox` is rendered only
  // for a reverse-strand block, and the top row here is forward. The inverted
  // 21.7 kb block one row below is the rearrangement itself, and a launch off it
  // frames that segment alone, without the collinear chain either side that is
  // what makes it read as moved.
  {
    name: 'synteny/liftover_launch',
    description:
      "From one UCSC chain block to a two-panel view: right-click the hg38 to hs1 liftOver track at TNNT3, read the launch dialog's framing options, and Replace current view putting the synteny view in the linear view's place",
    url: liftoverLgv,
    // Sized to the LAUNCHED VIEW plus the caption chip's own strip. The run
    // reports the app at 405 on the linear view and 468 once the two panels are
    // standing, and neither overlay is the constraint: the dialog is two
    // checkboxes and a number field (the region launch's panel list is what puts
    // that tour's frame up at 640), and the context menu is three rows opening
    // below a click near the top of the frame. What the last 72px are for is the
    // chip, which is fixed 20px off the BOTTOM of the frame rather than under
    // the app -- at 480 it lands over the empty mate panel, which is the half of
    // the last state the caption is about. 72 is inside video-report's 120px
    // slack, so it reports nothing. Even, per the encode.
    viewportHeight: 540,
    // LGVSyntenyDisplay is the alignments display underneath, so its canvas
    // carries the pileup testid.
    readySelector: displayPainted('pileup-display'),
    // ~570 tracks of UCSC hub config, three remote plugins, and hs1 resolved
    // through the hub plugin as the chain track names it.
    readyTimeout: 180000,
    settleMs: 10000,
    steps: [
      // The camera opens with the pointer parked at the top middle of the frame,
      // which in this layout is the overview's cytoband strip -- so the first
      // frame carried the band's own hover tooltip, over the view title. The
      // logo is a bare `<g>` with no handler, so this only takes the pointer off
      // it.
      { type: 'hover', selector: '[aria-label="JBrowse"]' },
      // The linear reading the page's first section ends on: one feature per
      // chain block, laid out in rows.
      { type: 'delay', ms: 2500 },
      // A locus and a depth rather than a measured pixel: the blocks are
      // canvas-drawn, so there is no node to target, and the chain-block canvas
      // fills the display's whole height -- a bare fracY lands under the rows
      // rather than on them. 8px down from the display's own top edge is the
      // middle of the top row at featureHeight 14.
      {
        type: 'rightclick',
        anchor: {
          track: 'hg38_to_hs1_liftOver',
          locus: liftoverBlock,
          fracY: 0,
          dy: 8,
        },
        say: 'Right-click a chain block',
        hold: 1000,
      },
      // The launch item is appended a fetch after the menu opens: it needs the
      // feature's mate assembly, which decides whether a synteny view can open
      // at all (canLaunchSyntenyForMate). So this waits on the fetch rather than
      // guessing at it.
      { type: 'waitForText', text: 'Launch synteny view for this position' },
      {
        type: 'hover',
        text: 'Launch synteny view for this position',
        hold: 1400,
      },
      {
        type: 'click',
        text: 'Launch synteny view for this position',
        say: 'Launch synteny view for this position',
      },
      // The dialog is lazy, so this waits on the chunk as well as on the open.
      // Matched on the checkbox rather than on the title, which is the menu item
      // just clicked with three words taken off it.
      {
        type: 'waitForText',
        text: 'Use CIGAR to map the current visible region to the target',
      },
      { type: 'delay', ms: 1200 },
      // Hovered, not clicked. Both boxes open ticked and both are what the
      // launch is about to do; a tour that unticked either would film a launch
      // the page tells the reader not to make.
      {
        type: 'hover',
        text: 'Use CIGAR to map the current visible region to the target',
        say: 'Use CIGAR to map the current visible region to the target',
        hold: 3000,
      },
      {
        type: 'hover',
        text: "Copy this view's tracks into its panel",
        say: "Copy this view's tracks into its panel",
        hold: 2600,
      },
      {
        type: 'click',
        text: 'Replace current view',
        say: 'Replace current view',
      },
      // Camera stays on: the linear view being replaced by the two-panel one IS
      // the payoff, and both panels read the chain the display above has already
      // pulled into the worker. hs1's 2bit is the one new fetch.
      {
        type: 'waitForSelector',
        selector: displayPainted('synteny_canvas'),
        timeout: 240000,
      },
      { type: 'waitForAppSettled', timeout: 240000 },
      // The launched view: hg38 over hs1, the gene track carried into the panel
      // for the assembly the launch came from and the other panel empty.
      { type: 'delay', ms: 4000 },
    ],
    tailMs: 4500,
  },

  // THE ROUND TRIP, which pangenome_ecoli.md's "Browsing the whole graph by
  // locus" states in one paragraph: a rubberband on K-12 offers the graph and
  // the synteny stack from one Launch menu; the stack's K-12 row carries the
  // segments lane, so the graph is one track menu away from inside the stack;
  // and a drag on any other row's ruler raises the same launch anchored on that
  // strain, whose Replace current view re-anchors the stack in place. Three
  // launches, each from the view the last one produced.
  //
  // The graph comes BEFORE the re-anchor, and the order is forced: a launch
  // copies the launching row's tracks onto the anchor panel and nothing onto the
  // mates, so once the stack is re-anchored on Sakai the K-12 row is a bare
  // ruler with no segments lane to launch from. Filmed the other way round the
  // graph beat has no track to click.
  //
  // The Sakai row's drag is a selector anchor with `dx` either side of the
  // ruler's centre rather than a locus: Sakai's coordinates for this window
  // are whatever the launch resolved them to, and naming them here would pin
  // the tour to one resolution of the PAF.
  {
    name: 'synteny/ecoli_roundtrip',
    description:
      'One selection on K-12, three views: the Launch menu offering the graph beside the synteny stack, the stack anchored on K-12 with the segments lane on its top row, that lane cutting the graph below, and a drag on the Sakai row re-anchoring the stack on Sakai',
    url: roundTripStart,
    // Sized to the TALLEST state, which is not the last one: the run measured
    // 1353 with the graph pane under a stack whose K-12 row still carries the
    // segments lane, and 1254 after the re-anchor drops that lane. The slack
    // over 1353 is the caption chip's strip. The ~970px of page background
    // under the opening lanes is the cost of filming two launches -- a tour
    // that grows the app fivefold has one frame for every state it passes
    // through, and cutting the graph pane off is the worse half to spend it on.
    viewportHeight: 1410,
    readySelector: displayPainted('pileup-display'),
    readyTimeout: 180000,
    settleMs: 12000,
    steps: [
      { type: 'hover', selector: '[aria-label="JBrowse"]', hold: 0 },
      {
        type: 'delay',
        ms: 2500,
        say: 'K-12: one lane per strain, and the graph segments',
      },
      {
        type: 'drag',
        fromAnchor: {
          locus: allVsAllSpan.start,
          band: RUBBERBAND,
        },
        toAnchor: {
          locus: allVsAllSpan.end,
          band: RUBBERBAND,
        },
        say: 'Drag across the scale bar',
        hold: 900,
      },
      { type: 'waitForSelector', selector: LAUNCH_SUBMENU },
      { type: 'click', selector: LAUNCH_SUBMENU, say: 'Launch', hold: 1200 },
      { type: 'waitForText', text: 'Graph genome view (this selection)' },
      { type: 'waitForSelector', selector: LAUNCH_SYNTENY_VIEW },
      {
        type: 'delay',
        ms: 2200,
        say: 'The graph or the stack, from one selection',
      },
      {
        type: 'click',
        selector: LAUNCH_SYNTENY_VIEW,
        say: 'Linear synteny view',
      },
      { type: 'waitForText', text: 'Panels, top to bottom' },
      {
        type: 'waitForSelector',
        selector: panelArrow(allVsAllMoved, 5, 'up'),
        timeout: 180000,
      },
      { type: 'delay', ms: 2500, say: 'One panel per strain that aligns' },
      {
        type: 'click',
        text: 'Replace current view',
        say: 'Replace current view',
      },
      {
        type: 'waitForSelector',
        selector: displayPainted('synteny_canvas'),
        timeout: 180000,
      },
      { type: 'waitForAppSettled', timeout: 180000 },
      {
        type: 'delay',
        ms: 3000,
        say: 'The stack, anchored on K-12, with its lanes on the top row',
      },
      // The graph, from the segments lane the launch carried onto the K-12 row.
      {
        type: 'click',
        selector: trackMenu(segmentsTrackId),
        say: 'The segments lane: Track menu',
        hold: 700,
      },
      { type: 'waitForText', text: 'Launch' },
      { type: 'click', text: 'Launch', say: 'Launch', hold: 700 },
      { type: 'waitForText', text: 'Graph genome view (this region)' },
      {
        type: 'click',
        text: 'Graph genome view (this region)',
        say: 'Graph genome view (this region)',
      },
      { type: 'waitForSelector', selector: GRAPH_DRAWN, timeout: 180000 },
      { type: 'waitForAppSettled', timeout: 180000 },
      { type: 'hover', selector: '[aria-label="JBrowse"]', hold: 0 },
      { type: 'delay', ms: 3000, say: 'The graph, cut from inside the stack' },
      // The re-anchor: a drag on the Sakai row's own ruler.
      {
        type: 'drag',
        fromAnchor: {
          selector: RUBBERBAND,
          view: [0, 1],
          alignX: 'center',
          dx: -220,
        },
        toAnchor: {
          selector: RUBBERBAND,
          view: [0, 1],
          alignX: 'center',
          dx: 220,
        },
        say: 'Drag on the Sakai row',
        hold: 900,
      },
      { type: 'waitForSelector', selector: LAUNCH_SUBMENU },
      { type: 'click', selector: LAUNCH_SUBMENU, say: 'Launch', hold: 1000 },
      { type: 'waitForSelector', selector: LAUNCH_SYNTENY_VIEW },
      {
        type: 'click',
        selector: LAUNCH_SYNTENY_VIEW,
        say: 'Linear synteny view',
      },
      { type: 'waitForText', text: 'Sakai (your selection)' },
      {
        type: 'waitForSelector',
        selector: panelArrow(allVsAllMoved, 5, 'up'),
        timeout: 180000,
      },
      { type: 'delay', ms: 2500, say: 'The same dialog, anchored on Sakai' },
      {
        type: 'click',
        text: 'Replace current view',
        say: 'Replace current view',
      },
      {
        type: 'waitForSelector',
        selector: displayPainted('synteny_canvas'),
        timeout: 180000,
      },
      { type: 'waitForAppSettled', timeout: 180000 },
      { type: 'hover', selector: '[aria-label="JBrowse"]', hold: 0 },
      {
        type: 'delay',
        ms: 3500,
        say: 'The stack re-anchored on Sakai, the graph still below',
      },
    ],
    tailMs: 4500,
  },

  // THE MAF ROW LAUNCH, which pangenome_ecoli.md's alignment section states in
  // one paragraph: a drag across the rows lists the strains it covers, and the
  // synteny entry opens the reference against one of them with the ribbons cut
  // from the columns. The drag names two loci on the reference for its x and
  // takes its y from the rows area, top row to bottom, so the menu it raises
  // lists every strain that aligns in the window rather than a slice of them.
  //
  // The submenu child is picked by its testid prefix rather than by text: the
  // inline "Open NCTC86 ... in new view" entry above it contains the same
  // words, and a text match lands on whichever comes first.
  {
    name: 'synteny/maf_row_synteny',
    description:
      "From the pggb alignment's rows to a two-strain synteny view: a drag across the rows, the menu listing the strains it covers, and the synteny view the NCTC86 entry opens",
    url: mafRows,
    // The linear view plus the two-row view the launch adds below it. The frame
    // is sized to the end state and the run reports the app's own height there;
    // the slack over it is the caption chip's strip, which is fixed off the
    // frame's bottom rather than the app's.
    viewportHeight: 1260,
    readySelector: displayPainted('maf-display'),
    readyTimeout: 180000,
    settleMs: 8000,
    steps: [
      { type: 'hover', selector: '[aria-label="JBrowse"]', hold: 0 },
      { type: 'delay', ms: 2500, say: 'The alignment, one row per strain' },
      {
        type: 'drag',
        fromAnchor: {
          locus: mafRowSpan.start,
          track: mafTrackId,
          band: MAF_ROWS,
          fracY: 0.02,
        },
        toAnchor: {
          locus: mafRowSpan.end,
          track: mafTrackId,
          band: MAF_ROWS,
          fracY: 0.98,
        },
        say: 'Drag across the rows',
        hold: 900,
      },
      { type: 'waitForText', text: 'Launch synteny view, K12 vs...' },
      { type: 'delay', ms: 1800, say: 'One entry per strain the drag covers' },
      {
        type: 'click',
        text: 'Launch synteny view, K12 vs...',
        say: 'Launch synteny view, K12 vs...',
        hold: 1200,
      },
      { type: 'waitForSelector', selector: MAF_NCTC86_ENTRY },
      { type: 'click', selector: MAF_NCTC86_ENTRY, say: 'NCTC86' },
      {
        type: 'waitForSelector',
        selector: displayPainted('synteny_canvas'),
        timeout: 180000,
      },
      { type: 'waitForAppSettled', timeout: 180000 },
      // Park in two moves. The first used to be load-bearing: the drag left the
      // pointer inside the MAF display, the menu that opened over it is portaled
      // to the body, and closing it detached the hover chain -- so the display
      // was never sent a `mouseleave` and drew a tooltip on the drag's last base
      // for the rest of the clip, through the poster. `ContextMenu` now drops
      // the display's tracked pointer on close (see `useClearTrackedPointer`),
      // so this is just a park; it stays because the shipped clip is filmed with
      // it, and the next re-film can drop it.
      {
        type: 'hover',
        anchor: {
          locus: mafRowSpan.start,
          track: mafTrackId,
          band: MAF_ROWS,
          fracY: 0.5,
        },
        hold: 0,
      },
      { type: 'hover', selector: '[aria-label="JBrowse"]', hold: 0 },
      {
        type: 'delay',
        ms: 4000,
        say: 'K-12 over NCTC86, the ribbon cut from the columns',
      },
    ],
    tailMs: 4500,
  },
]
