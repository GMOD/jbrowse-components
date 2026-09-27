// The protein tours. One is filmed against genomes.jbrowse.org's released app,
// because what it documents is that specific launcher; the other two take the
// same gene menu on the local build, where the workspace tiling actions and the
// launch dialog's split button are both readable.
import { RELEASED_CODE_BASE } from '../../src/lib/code-base.ts'
import { proteinLaunchFixtures } from '../specs/features.ts'
import { proteinTourFixtures } from '../specs/msa.ts'
import { zoomToSteps } from './shared.ts'

import type { VideoSpec, VideoStep } from '../video-spec-types.ts'

const TP53_MENU_ANCHOR = {
  track: proteinTourFixtures.geneTrack,
  locus: 'chr17:7,676,000',
  // near the top of the band: `longestCoding` draws one gene row, so a centred
  // right-click lands on empty canvas and opens the view's own menu
  fracY: 0.2,
}

const hoverAt = (locus: string, hold: number, say?: string): VideoStep => ({
  type: 'hover',
  anchor: { track: proteinTourFixtures.geneTrack, locus },
  hold,
  ...(say ? { say } : {}),
})

export const proteinVideos: VideoSpec[] = [
  // Filmed on the RELEASED app, and the layout is why: protein3d's
  // `maybeLaunchSideBySide` needs two workspace actions the release lacks, so
  // it stacks the views full width where main splits them into half-width
  // panes, and the residue a hover lands on is off the right edge of a
  // half-width alignment panel.
  {
    name: 'proteins/genomes_protein_launch',
    description:
      'From a gene to its AlphaFold structure on genomes.jbrowse.org: the right-click launcher, the dialog resolving a UniProt entry, and the connected view answering a hover with a residue',
    goal: 'From a gene to its AlphaFold structure, linked base by residue',
    url: `${RELEASED_CODE_BASE}${proteinTourFixtures.session}`,
    // 383px of app before the launch and 1397px after
    viewportHeight: 1400,
    readyTimeout: 120000,
    // the release publishes no session census, so the gene's label is the gate
    noSession: true,
    readyText: 'TP53',
    steps: [
      {
        type: 'rightclick',
        anchor: TP53_MENU_ANCHOR,
        say: 'Right-click TP53 and launch its protein structure',
        hold: 900,
      },
      { type: 'waitForText', text: 'Launch protein view' },
      { type: 'click', text: 'Launch protein view' },
      // off camera while the dialog fills itself from UniProt and AlphaFold
      {
        type: 'waitForSelector',
        selector: '[data-testid="protein-launch-button"]:not([disabled])',
        timeout: 180000,
        cut: true,
      },
      { type: 'delay', ms: 3500 },
      {
        type: 'click',
        selector: '[data-testid="protein-launch-button"]',
      },
      {
        type: 'waitForSelector',
        selector: '[data-testid="protein-view-ready"]',
        timeout: 300000,
        cut: true,
      },
      { type: 'delay', ms: 2000 },
      // the alignment panel shows only the first ~160 residues, which on a
      // minus-strand gene are its right-hand 1.6 kb: eighty pixels across the
      // whole gene, and a frame-wide span once zoomed
      ...zoomToSteps(
        proteinTourFixtures.hoverWindow,
        'Select a few exons on the scale bar and zoom in',
      ),
      { type: 'waitForAppSettled', timeout: 120000 },
      hoverAt(
        proteinTourFixtures.codingLocus,
        3000,
        'Hover a coding position: the structure lights its residue',
      ),
      // between the two coding hovers, so "nothing highlighted" reads as an
      // answer rather than as the tour having stopped
      hoverAt(
        proteinTourFixtures.intronicLocus,
        3000,
        'An intron maps to no residue',
      ),
      hoverAt(proteinTourFixtures.secondCodingLocus, 0),
      {
        type: 'delay',
        ms: 3500,
        say: 'Each coding base of the genome maps to one residue of the structure',
      },
    ],
    // the tail un-hovers everything, so the poster comes off the last hover
    posterAt: 40,
    tailMs: 1200,
  },
  // Both launchers ask the session to split the new view off to the right, and
  // two sequential splits nest, so `Global: tile horizontally` is what lays the
  // three views out one to a column. `findConnectedMsaView` bridges the
  // alignment and the structure through the genome view both point at.
  {
    name: 'proteins/tiled_views',
    description:
      'A gene menu to a genome view, a cross-species alignment and an AlphaFold structure tiled side by side with the workspace layout, and one hover in the genome walking a residue through both',
    goal: 'Tile a gene, its ortholog alignment and its structure, linked by hover',
    url: proteinTourFixtures.session,
    // the tallest column once tiled, where a stack was the sum of all three
    viewportHeight: 1100,
    readySelector: '::-p-text(NCBI RefSeq)',
    readyTimeout: 120000,
    steps: [
      { type: 'hover', selector: '[aria-label="JBrowse"]', hold: 0 },
      {
        type: 'rightclick',
        anchor: TP53_MENU_ANCHOR,
        say: "Align TP53 with 15 of its orthologs from the gene's menu",
        hold: 900,
      },
      { type: 'waitForText', text: 'Launch MSA view' },
      { type: 'click', text: 'Launch MSA view' },
      { type: 'waitForText', text: 'Orthologs' },
      // fewer than the dialog's 100, which also reads better a third of the
      // screen wide
      {
        type: 'type',
        selector: 'input[type="number"]',
        value: '15',
        clear: true,
      },
      // Submit waits on hgdownload's CDS
      {
        type: 'waitForSelector',
        selector: 'button:not([disabled])::-p-text(Submit)',
        timeout: 120000,
        cut: true,
      },
      { type: 'click', selector: 'button::-p-text(Submit)' },
      // the aligner queue; the toolbar mounts once `orthologParams` clears
      {
        type: 'waitForSelector',
        selector: 'button[aria-label="Fit / zoom options"]',
        timeout: 300000,
        cut: true,
      },
      { type: 'click', selector: 'button[aria-label="Fit / zoom options"]' },
      { type: 'click', text: 'Fit horizontally' },
      { type: 'delay', ms: 1500 },
      {
        type: 'rightclick',
        anchor: TP53_MENU_ANCHOR,
        say: 'Then launch its AlphaFold structure the same way',
        hold: 900,
      },
      { type: 'waitForText', text: 'Launch protein view' },
      { type: 'click', text: 'Launch protein view' },
      {
        type: 'waitForSelector',
        selector: 'button:not([disabled])::-p-text(Launch)',
        timeout: 180000,
        cut: true,
      },
      { type: 'delay', ms: 2000 },
      { type: 'click', selector: 'button::-p-text(Launch)' },
      {
        type: 'waitForSelector',
        selector: '[data-testid="protein-view-ready"]',
        timeout: 300000,
        cut: true,
      },
      // every panel's `+` menu carries the whole-workspace commands; this is
      // the strip's own add button, not the kebab inside the tab label
      {
        type: 'click',
        selector:
          '[data-tab-strip] > div:not([role="tablist"]) button:first-of-type',
        say: 'Tile the three views side by side, then zoom in on the exons',
      },
      {
        type: 'click',
        text: 'Global: tile horizontally',
        hold: 1000,
      },
      { type: 'waitForAppSettled' },
      ...zoomToSteps(proteinTourFixtures.hoverWindow),
      { type: 'waitForAppSettled', timeout: 120000 },
      hoverAt(
        proteinTourFixtures.codingLocus,
        3000,
        'Hover a coding position: the alignment and structure follow',
      ),
      hoverAt(proteinTourFixtures.secondCodingLocus, 0),
      {
        type: 'delay',
        ms: 3500,
        say: 'One genome position: one alignment column, one residue on the structure',
      },
    ],
    posterAt: 44,
    tailMs: 1200,
  },
  // protein3d adds its tracks to the session and turns none of them on, so a
  // reader who has only seen the figure takes this route and finds nothing:
  // the view arrives in one state and the figure shows another.
  {
    name: 'proteins/annotation_1d',
    description:
      "The gene menu to a linear genome view whose genome is a protein: the launch dialog's split button, the 1D view arriving with none of its tracks on, and four of them turned on in residue coordinates",
    goal: "Open TP53's protein as a genome of its own, with tracks on it",
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
        say: 'Open a view whose genome is the protein itself',
        hold: 900,
      },
      { type: 'waitForText', text: 'Launch protein view' },
      { type: 'click', text: 'Launch protein view' },
      {
        type: 'waitForSelector',
        selector: 'button:not([disabled])::-p-text(Launch)',
        timeout: 180000,
        cut: true,
      },
      { type: 'delay', ms: 2500 },
      {
        type: 'click',
        selector: 'button[aria-label="More launch options"]',
        say: 'The arrow beside Launch holds the 1D annotation view',
        hold: 2500,
      },
      { type: 'click', text: 'Launch 1D protein annotation view' },
      // the protein registered as an assembly, and nothing on yet
      {
        type: 'waitForText',
        text: 'No tracks active',
        timeout: 120000,
        cut: true,
      },
      {
        type: 'delay',
        ms: 2500,
        say: 'It opens on the amino-acid chain, with its tracks off',
      },
      {
        type: 'click',
        text: 'Open track selector',
        say: 'Turn on four tracks from UniProt and AlphaFold',
      },
      // everything protein3d added is under this category
      { type: 'click', text: 'Session tracks', hold: 1500 },
      { type: 'waitForText', text: 'AlphaMissense scores', timeout: 120000 },
      { type: 'click', text: 'DNA binding', hold: 1500 },
      { type: 'click', text: 'Natural variant', hold: 1500 },
      { type: 'click', text: 'AlphaFold confidence', hold: 1500 },
      { type: 'click', text: 'AlphaMissense scores', hold: 1500 },
      {
        type: 'click',
        selector: 'button[aria-label="Close drawer"]',
      },
      { type: 'waitForAppSettled' },
      {
        type: 'delay',
        ms: 4000,
        say: 'A binding region, variants and two AlphaFold scores, residue by residue',
      },
    ],
    tailMs: 3000,
  },
]
