// The protein tours. One is filmed against genomes.jbrowse.org's released app,
// because what it documents is that specific launcher; the other two take the
// same gene menu on the local build, where the workspace tiling actions and the
// launch dialog's split button are both readable.
import { RELEASED_CODE_BASE } from '../../src/lib/code-base.ts'
import { proteinLaunchFixtures } from '../specs/features.ts'
import { proteinTourFixtures } from '../specs/msa.ts'
import { LOCATION_BOX } from './shared.ts'

import type { VideoSpec } from '../video-spec-types.ts'

export const proteinVideos: VideoSpec[] = [
  // A ROUTE, and then the thing the route was for. The launch is four clicks
  // that every protein page describes in prose; what follows it is the half a
  // still cannot hold at all, because the connection between the two views is
  // only visible while something moves through it.
  //
  // Filmed on genomes.jbrowse.org's own hg38 config, so the menu, the dialog and
  // the plugin version are the ones a reader gets on the real site. Nothing here
  // is prepared: the config already loads protein3d, and AlphaFold and UniProt
  // are queried live during the clip.
  //
  // THE ONE TOUR THAT FILMS THE RELEASED APP rather than the local build, and
  // the layout is why. protein3d asks the session to split the new view off to
  // the right (`maybeLaunchSideBySide`), which needs two workspaces actions the
  // released session does not have, so the release stacks the two views full
  // width and main sits them side by side in half-width panes. Both are the
  // plugin working as written; only one is what a reader on genomes.jbrowse.org
  // gets. The stacked frame is also the one the clip's second half needs — the
  // residue a hover lands on is off the right edge of a half-width alignment
  // panel, so filming the local build shows the launch and then hides the thing
  // the launch was for.
  {
    name: 'proteins/genomes_protein_launch',
    description:
      'From a gene to its AlphaFold structure on genomes.jbrowse.org: the right-click launcher, the dialog resolving a UniProt entry, and the connected view answering a hover with a residue',
    url: `${RELEASED_CODE_BASE}${proteinTourFixtures.session}`,
    // The run reports 383px of app before the launch and 1397px after, so the
    // frame is the second state and the first carries page background under it.
    viewportHeight: 1400,
    readyTimeout: 120000,
    // Long, because the readiness stack cannot see this app. Every display-level
    // gate in it keys on `data-display-phase` / `data-display-drawn`, and the
    // released build publishes neither attribute — so `waitForReady` returns
    // once the loading overlay clears and the tracks may still be fetching. The
    // first take that raced it right-clicked a gene lane that had not drawn and
    // failed on the launcher that never appeared.
    settleMs: 12000,
    steps: [
      // What the settle above cannot assert, asserted POSITIVELY: the gene the
      // tour right-clicks has drawn its label. It used to wait for no lane to
      // say "Loading" anywhere, and an absence is the wrong shape of gate here
      // twice over — it is equally true of an app that has not started, and it
      // is answerable by any lane at all. The released build now leaves a
      // "Loading" span in each of the RefSeq display's blocks after the genes
      // have drawn (three of them, one per block, measured), so the gate could
      // never come true again and the tour failed on it every run while the
      // frame behind it was fine.
      { type: 'waitForText', text: 'TP53', timeout: 90000 },
      {
        type: 'rightclick',
        anchor: {
          track: proteinTourFixtures.geneTrack,
          locus: 'chr17:7,676,000',
          // near the top of the band: `longestCoding` draws one gene row, so a
          // centered right-click lands on empty canvas and opens the view's own
          // menu with no feature items in it
          fracY: 0.2,
        },
        say: 'Right-click the gene',
        hold: 900,
      },
      { type: 'waitForText', text: 'Launch protein view' },
      {
        type: 'click',
        text: 'Launch protein view',
        say: 'Launch protein view',
      },
      // OFF CAMERA. The dialog opens empty and fills itself from three round
      // trips — UniProt ID mapping, the isoform's protein sequences, AlphaFold's
      // structure URL — and a film of a form filling in is a film of a spinner.
      // It comes back on the resolved dialog, which is what there is to read.
      {
        type: 'waitForSelector',
        selector: '[data-testid="protein-launch-button"]:not([disabled])',
        timeout: 180000,
        cut: true,
      },
      // held long enough to read the UniProt entry it picked and the isoform it
      // matched against the structure's own residues
      { type: 'delay', ms: 3500 },
      {
        type: 'click',
        selector: '[data-testid="protein-launch-button"]',
        say: 'Launch',
      },
      {
        type: 'waitForSelector',
        selector: '[data-testid="protein-view-ready"]',
        timeout: 300000,
        cut: true,
      },
      { type: 'delay', ms: 3000 },
      // In to the coding exons, so the hovers below are spread across the frame
      // instead of crowded into eighty pixels of it. Typed into the linear
      // view's own location box, which is what a reader zooming in would do.
      {
        type: 'type',
        selector: LOCATION_BOX,
        value: proteinTourFixtures.hoverWindow,
        clear: true,
        say: proteinTourFixtures.hoverWindow,
      },
      { type: 'press', key: 'Enter' },
      { type: 'delay', ms: 3000 },
      // THE PAYOFF. Each hover is a genomic position, and the protein view
      // answers with the residue it maps to: the readout above the alignment,
      // the column in it, and the residue picked out on the structure itself.
      {
        type: 'hover',
        anchor: {
          track: proteinTourFixtures.geneTrack,
          locus: proteinTourFixtures.codingLocus,
        },
        say: 'Hover a coding position',
        hold: 3000,
      },
      // The negative, and the one step whose caption names what is NOT
      // happening: an intron has no residue to map to, so the readout empties
      // instead of moving.
      //
      // Between the two coding hovers rather than after them, because "nothing
      // is highlighted" and "the tour has stopped" are the same frame. Coming
      // back to a coding position is what makes the empty one legible as an
      // answer.
      {
        type: 'hover',
        anchor: {
          track: proteinTourFixtures.geneTrack,
          locus: proteinTourFixtures.intronicLocus,
        },
        say: 'An intronic position maps to no residue',
        hold: 3000,
      },
      {
        type: 'hover',
        anchor: {
          track: proteinTourFixtures.geneTrack,
          locus: proteinTourFixtures.secondCodingLocus,
        },
        say: 'Back on the exon, and the residue is back',
        hold: 3500,
      },
    ],
    // Short, and a poster taken off a hover. Filming ends by clearing the
    // caption and parking the cursor, which un-hovers whatever the tour was
    // holding — so every frame after the last step is a connected view being
    // asked nothing, and both of these keep that out of the reader's way.
    posterAt: 36,
    tailMs: 1200,
  },
  // THREE VIEWS ANSWERING ONE HOVER, tiled side by side rather than stacked.
  // Both plugins load on genomes.jbrowse.org (see the comment beside
  // `proteinTourFixtures` in specs/msa.ts), so one gene menu reaches both
  // launchers, and each one asks the session's workspace layout to split its
  // new view off to the right (`placeMsaView` / `maybeLaunchSideBySide`) — the
  // local build has both of those session actions, unlike the released app the
  // clip above is stuck filming. `findConnectedMsaView`'s "shared genome view"
  // rule is what then bridges the alignment and the structure with no explicit
  // id between them: both carry `connectedViewId` pointing at the same LGV, so
  // a hover in the genome reaches both without either launch naming the other.
  //
  // Two sequential splitRights nest (each one re-collapses everything BUT the
  // view it is placing into a single cell — see WorkspaceLayout/CLAUDE.md), so
  // after both launches the three views are in two columns, one of them a
  // vertical stack. `Global: tile horizontally` is the layout's own menu item
  // for "one column per view", the thing this clip is FOR: filming it is
  // filming the retile, not narrating it in prose the reader would have to
  // trust.
  {
    name: 'proteins/tiled_views',
    description:
      'A gene menu to a genome view, a cross-species alignment and an AlphaFold structure tiled side by side with the workspace layout, and one hover in the genome walking a residue through both',
    url: proteinTourFixtures.session,
    // Three columns rather than three stacked rows: each view keeps its own
    // height (ViewStack does not stretch a view to fill its panel), so a
    // horizontal tile's frame is the TALLEST column rather than the sum of all
    // three. The run reports 1097px at the tallest (the protein view's own
    // panel, once tiled) against 395px at the first frame, so 1100 is that
    // tallest state plus the even-height rounding — a fraction of the old
    // clip's 1790px single-column stack.
    viewportHeight: 1100,
    readySelector: '::-p-text(NCBI RefSeq)',
    readyTimeout: 120000,
    steps: [
      { type: 'hover', selector: '[aria-label="JBrowse"]', hold: 0 },
      {
        type: 'rightclick',
        anchor: {
          track: proteinTourFixtures.geneTrack,
          locus: 'chr17:7,676,000',
          fracY: 0.2,
        },
        say: 'Right-click the gene',
        hold: 900,
      },
      { type: 'waitForText', text: 'Launch MSA view' },
      {
        type: 'click',
        text: 'Launch MSA view',
        say: 'Launch MSA view',
      },
      { type: 'waitForText', text: 'Orthologs (fast)' },
      // Fewer than the dialog's own default of 100: this clip's point is the
      // tiling, not the aligner queue, and a smaller alignment also reads
      // better in a column a third of the screen wide.
      {
        type: 'type',
        selector: 'input[type="number"]',
        value: '15',
        clear: true,
        say: 'Rows to align: 15',
      },
      // OFF CAMERA. Submit stays disabled until hgdownload answers with the
      // transcript's CDS, and a film of that wait is a film of a spinner —
      // the same reason the launch dialog below cuts here.
      {
        type: 'waitForSelector',
        selector: 'button:not([disabled])::-p-text(Submit)',
        timeout: 120000,
        cut: true,
      },
      {
        type: 'click',
        selector: 'button::-p-text(Submit)',
        say: 'Submit',
      },
      // OFF CAMERA again, for the aligner queue: NCBI's ortholog lookup answers
      // immediately and EBI's Clustal Omega run is the wait, about half a
      // second a row. The alignment view mounts its toolbar only once
      // `orthologParams` clears, so the toolbar appearing IS the gate.
      {
        type: 'waitForSelector',
        selector: 'button[tooltip="Fit / zoom options"]',
        timeout: 300000,
        cut: true,
      },
      {
        type: 'click',
        selector: 'button[tooltip="Fit / zoom options"]',
        say: 'Fit / zoom options',
      },
      { type: 'click', text: 'Fit horizontally', say: 'Fit horizontally' },
      { type: 'delay', ms: 1500 },
      {
        type: 'rightclick',
        anchor: {
          track: proteinTourFixtures.geneTrack,
          locus: 'chr17:7,676,000',
          fracY: 0.2,
        },
        say: 'Right-click the gene again',
        hold: 900,
      },
      { type: 'waitForText', text: 'Launch protein view' },
      {
        type: 'click',
        text: 'Launch protein view',
        say: 'Launch protein view',
      },
      // OFF CAMERA, the same three round trips (UniProt ID mapping, the
      // isoform's protein sequence, AlphaFold's structure url) the other two
      // protein tours cut here for.
      {
        type: 'waitForSelector',
        selector: 'button:not([disabled])::-p-text(Launch)',
        timeout: 180000,
        cut: true,
      },
      { type: 'delay', ms: 2000 },
      {
        type: 'click',
        selector: 'button::-p-text(Launch)',
        say: 'Launch',
      },
      {
        type: 'waitForSelector',
        selector: '[data-testid="protein-view-ready"]',
        timeout: 300000,
        cut: true,
      },
      // THE RETILE. Every panel's `+` menu carries the same whole-workspace
      // commands ("Global: ..."), so any one of them reaches this — there is
      // one per cell right now, in whichever mix of columns and stacks the two
      // splitRights above left behind.
      {
        type: 'click',
        // The strip's OWN two actions (add, close), not the kebab menu inside
        // the tab label (rename/close tab) — both are a `button:first-of-type`
        // of their own parent, so the tablist has to be excluded structurally.
        selector:
          '[data-tab-strip] > div:not([role="tablist"]) button:first-of-type',
        say: 'Panel menu',
      },
      {
        type: 'click',
        text: 'Global: tile horizontally',
        say: 'Tile horizontally',
        hold: 1000,
      },
      { type: 'waitForAppSettled' },
      // In to the coding exons, so the hovers below are spread across the
      // frame instead of crowded into a narrow column's worth of pixels.
      {
        type: 'type',
        selector: LOCATION_BOX,
        value: proteinTourFixtures.hoverWindow,
        clear: true,
        say: proteinTourFixtures.hoverWindow,
      },
      { type: 'press', key: 'Enter' },
      { type: 'delay', ms: 2500 },
      // THE PAYOFF. One genomic position, answered twice: the column it lands
      // on in the alignment, and the residue it lights on the structure.
      {
        type: 'hover',
        anchor: {
          track: proteinTourFixtures.geneTrack,
          locus: proteinTourFixtures.codingLocus,
        },
        say: 'Hover a coding position',
        hold: 3000,
      },
      {
        type: 'hover',
        anchor: {
          track: proteinTourFixtures.geneTrack,
          locus: proteinTourFixtures.intronicLocus,
        },
        say: 'An intronic position maps to no residue',
        hold: 3000,
      },
      {
        type: 'hover',
        anchor: {
          track: proteinTourFixtures.geneTrack,
          locus: proteinTourFixtures.secondCodingLocus,
        },
        say: 'Back on the exon, and the residue is back',
        hold: 3500,
      },
    ],
    posterAt: 48,
    tailMs: 1200,
  },
  // THE SPLIT BUTTON, and the destination on it that a still actively misleads
  // about. protein/annotation_1d is a picture of the 1D view with four tracks
  // drawn across the chain, and a reader who has only seen that picture will
  // take the same route and find nothing: protein3d adds its tracks to the
  // session and turns none of them on. The page's prose had that backwards
  // until the figure was captured, which is the tell that this route wants
  // filming rather than describing — the view arrives in one state and the
  // figure shows another, and a still can only hold the second.
  //
  // The menu is the other half. The page describes what the dialog can build
  // behind an arrow beside Launch, and a screenshot of an open cascade is a
  // picture of a menu; here the menu is what the section is about, so the film
  // is where it can be read. Two rows since protein3d 0.9.0 dropped the two a3m
  // MSA launches — see the note beside `PROTEIN_LAUNCH_SESSION` in
  // `specs/features.ts` for why they went.
  //
  // Filmed against the LOCAL build, unlike genomes_protein_launch above it. The
  // config is still genomes.jbrowse.org's own hg38 — that is where the launcher
  // comes from — but the app serving it is this repo's, so the display-phase
  // attributes the readiness stack keys on are published and this tour needs
  // none of the settle guessing the released-app tour is stuck with.
  {
    name: 'proteins/annotation_1d',
    description:
      "The gene menu to a linear genome view whose genome is a protein: the launch dialog's split button, the 1D view arriving with none of its tracks on, and four of them turned on in residue coordinates",
    url: proteinLaunchFixtures.session,
    // the two views and the drawer open beside them
    viewportHeight: 1046,
    // the UCSC hub config is ~570 tracks and pulls four remote plugins
    readySelector: '::-p-text(NCBI RefSeq)',
    readyTimeout: 120000,
    steps: [
      { type: 'hover', selector: '[aria-label="JBrowse"]', hold: 0 },
      {
        type: 'rightclick',
        anchor: proteinLaunchFixtures.geneAnchor,
        say: 'Right-click the gene',
        hold: 900,
      },
      { type: 'waitForText', text: 'Launch protein view' },
      {
        type: 'click',
        text: 'Launch protein view',
        say: 'Launch protein view',
      },
      // OFF CAMERA, for the reason the other protein tour cuts here: the dialog
      // opens empty and fills itself from UniProt's ID mapping, the isoform's
      // protein sequences and AlphaFold's structure url, and a film of a form
      // filling in is a film of a spinner. An enabled Launch is the dialog
      // saying it has resolved.
      {
        type: 'waitForSelector',
        selector: 'button:not([disabled])::-p-text(Launch)',
        timeout: 180000,
        cut: true,
      },
      { type: 'delay', ms: 2500 },
      // Held long enough to read both destinations, which is the whole reason
      // this step is filmed. It was 4000 for the four rows the menu carried
      // before protein3d 0.9.0.
      {
        type: 'click',
        selector: 'button[aria-label="More launch options"]',
        say: 'More launch options',
        hold: 2500,
      },
      {
        type: 'click',
        text: 'Launch 1D protein annotation view',
        say: 'Launch 1D protein annotation view',
      },
      // The assembly protein3d registers here is the amino-acid chain itself, so
      // the view has to navigate a genome that did not exist when the tour
      // started. `No tracks active` is its own empty state and gates on both:
      // the assembly registered, and the view has nothing on.
      {
        type: 'waitForText',
        text: 'No tracks active',
        timeout: 120000,
        cut: true,
      },
      // The view's own empty state is the chip, since the app has already put
      // the words on screen: the launch registered the protein as an assembly
      // and added its tracks, and none of them is on.
      {
        type: 'delay',
        ms: 3500,
        say: 'No tracks active',
      },
      {
        type: 'click',
        text: 'Open track selector',
        say: 'Open track selector',
      },
      // The list opens with its categories collapsed, and everything protein3d
      // added is under this one — which is the answer to "where did they go".
      {
        type: 'click',
        text: 'Session tracks',
        say: 'Session tracks',
        hold: 1500,
      },
      // The last of them to be added, so its row is the selector having finished
      // filling in.
      { type: 'waitForText', text: 'AlphaMissense scores', timeout: 120000 },
      // The same four the figure turns on, in the order they stack. Each is held
      // after its click, because what a reader is here to see is a band arriving
      // in residue coordinates rather than a checkbox ticking.
      { type: 'click', text: 'DNA binding', say: 'DNA binding', hold: 2000 },
      {
        type: 'click',
        text: 'Natural variant',
        say: 'Natural variant',
        hold: 2000,
      },
      {
        type: 'click',
        text: 'AlphaFold confidence',
        say: 'AlphaFold confidence (pLDDT)',
        hold: 3000,
      },
      {
        type: 'click',
        text: 'AlphaMissense scores',
        say: 'AlphaMissense scores',
        hold: 3000,
      },
      // The drawer takes ~400px off the views while it is open, so the end state
      // the clip holds is the one the page's figure shows.
      {
        type: 'click',
        selector: 'button[aria-label="Close drawer"]',
        say: 'Close the track selector',
      },
      { type: 'waitForAppSettled' },
    ],
    // Long, because the end state is the payoff and it is four tracks deep: the
    // confidence and the substitution scores both fall away over the terminal
    // tails, and that is read rather than glanced at.
    tailMs: 5000,
  },
]
