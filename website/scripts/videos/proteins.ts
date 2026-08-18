// The protein tours. Two are filmed against a site rather than a session — one
// on genomes.jbrowse.org and one on the JBrowseMSA Gene Explorer — because what
// each documents is a launcher that lives there; the third takes the same gene
// menu on the local build, where the launch dialog's split button is readable.
import { RELEASED_CODE_BASE } from '../../src/lib/code-base.ts'
import { proteinLaunchFixtures } from '../specs/features.ts'
import { geneExplorerTourFixtures, proteinTourFixtures } from '../specs/msa.ts'
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
    viewportWidth: 1280,
    // Provisional: sized from the run's own content report on the first film.
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
      // What the settle above cannot assert, asserted: no lane still says it is
      // loading. Cheap when it is already true, and when it is not, the run
      // fails here rather than on a right-click that lands in empty canvas.
      { type: 'waitForText', text: 'Loading', hidden: true, timeout: 90000 },
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
  // THREE VIEWS ANSWERING ONE HOVER, which is the thing no still and no pair of
  // stills can state: a figure can show a genome, an alignment and a structure
  // in one frame, and it cannot show that the residue lit in the third is the
  // codon under the cursor in the first.
  //
  // It is also the only tour that leaves JBrowse to get where it is going. The
  // JBrowseMSA Gene Explorer is a launcher, so the route is: pick a gene, press
  // its button, and read the session that arrives in the tab it opens. The
  // `opensTab` step is what lets the camera follow.
  {
    name: 'proteins/gene_explorer',
    description:
      'A gene symbol to three connected views on the JBrowseMSA Gene Explorer: pick TP53, open the session it builds, and hover the collapsed coding exons to walk one residue through the alignment and the structure',
    url: geneExplorerTourFixtures.url,
    viewportWidth: 1280,
    // Sized to the SESSION, which is three stacked views: the run reports the
    // launcher page at 689px and the session at 1755px. So the clip opens with
    // page background under a short page, which is the same trade every launch
    // tour here makes and the same way round — a frame sized to the launcher
    // would cut the structure the launcher exists to produce.
    viewportHeight: 1790,
    readySelector: geneExplorerTourFixtures.geneInput,
    settleMs: 4000,
    steps: [
      {
        type: 'click',
        text: geneExplorerTourFixtures.exampleGene,
        say: `Examples: ${geneExplorerTourFixtures.exampleGene}`,
        hold: 1200,
      },
      { type: 'waitForText', text: geneExplorerTourFixtures.launchLink },
      // held on the card, which names what the session will carry before it
      // carries it: the transcript, the collapsed CDS, the alignment, the model
      { type: 'delay', ms: 3000 },
      {
        type: 'click',
        text: geneExplorerTourFixtures.launchLink,
        // The caption carries the label as the page paints it, which its own
        // text-transform makes different from the string above.
        say: 'OPEN IN JBROWSE',
        opensTab: true,
      },
      // Everything the session fetches happens here: the gene track, the indexed
      // multiz alignment, the tree, and the AlphaFold model. The protein view's
      // own ready flag is the last of them to flip.
      {
        type: 'waitForSelector',
        selector: '[data-testid="protein-view-ready"]',
        timeout: 300000,
        cut: true,
      },
      { type: 'delay', ms: 3500 },
      ...geneExplorerTourFixtures.hoverLoci.map((locus, i) => ({
        type: 'hover' as const,
        anchor: { track: geneExplorerTourFixtures.geneTrack, locus },
        // One caption for the first hover, and none after: the second and third
        // say the same thing, and a caption that reappears unchanged reads as a
        // new instruction.
        ...(i === 0 ? { say: 'Hover a codon' } : {}),
        hold: 3200,
      })),
    ],
    // A hover, for the reason the other protein tour's poster is one: filming
    // ends by parking the cursor, so the last frame is the session with nothing
    // asked of it.
    posterAt: 23,
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
  // The menu is the other half. The page describes four destinations behind an
  // arrow beside Launch, and a screenshot of an open cascade is a picture of a
  // menu; here the menu is what the section is about, so the film is where it
  // can be read.
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
    viewportWidth: 1280,
    // the two views and the drawer open beside them
    viewportHeight: 1046,
    // the UCSC hub config is ~570 tracks and pulls four remote plugins
    readySelector: '::-p-text(NCBI RefSeq)',
    readyTimeout: 120000,
    steps: [
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
      // Held long enough to read all four destinations, which is the whole
      // reason this step is filmed.
      {
        type: 'click',
        selector: 'button[aria-label="More launch options"]',
        say: 'More launch options',
        hold: 4000,
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
      {
        type: 'delay',
        ms: 3500,
        say: 'The launch adds the tracks without turning them on',
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
