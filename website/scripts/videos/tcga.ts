// The TCGA cohort tours. Both are RE-LAYOUTS: each page's figures arrive in a
// state some menu item put them in, so the figure is the end of a route the page
// could only describe.
import { tcgaMutationVideoFixtures, tcgaVideoFixtures } from '../specs/tcga.ts'
import { DENDROGRAM, trackMenu } from './shared.ts'

import type { VideoSpec } from '../video-spec-types.ts'

export const tcgaVideos: VideoSpec[] = [
  // A RE-LAYOUT on the cancer pages, and the one instruction tcga_cohort_cnv.md
  // gives that its figures cannot show. Both of that page's stack figures arrive
  // already clustered, so the reader never sees what the menu item did: 1104
  // tumors in barcode order, which encodes nothing, becoming blocks of shared
  // copy-number profile. Which row moved where is exactly what a before/after
  // still pair cannot state and what watching them sort states for free.
  //
  // Ends on the sorted stack with the dendrogram beside it, so the last frame is
  // the figure the page already prints.
  {
    name: 'tcga/cohort_cnv_clustering',
    description:
      "Sorting a TCGA-BRCA copy-number stack by profile: 1104 tumors in barcode order, the track menu's Clustering item, and the bands that come back",
    url: tcgaVideoFixtures.unclusteredErbb2,
    // 906px of app at the first frame, the last and its tallest, per the run's
    // own content report, which is the whole clip: nothing here grows the app the
    // way a launch does, because a re-layout reorders the rows it already has.
    viewportHeight: 910,
    // The rows have to carry DATA before the camera starts, not just a first
    // paint: a tour that films clustering an empty canvas films nothing. The
    // stack is 1104 rows of a 5.7MB BED even at this window.
    readySelector: tcgaVideoFixtures.painted,
    readyTimeout: 300000,
    settleMs: 12000,
    steps: [
      { type: 'hover', selector: '[aria-label="JBrowse"]', hold: 0 },
      // The holds are long by the pangenome tours' standard, and deliberately.
      // This clip exists to be FOLLOWED, so each state has to stay up long
      // enough to read: the track menu is a dozen items and the reader has to
      // find one in it, where those tours only had to show that a cascade
      // happened. At 700ms the open menu was on screen for about a second.
      {
        type: 'click',
        selector: trackMenu(tcgaVideoFixtures.trackId),
        say: 'Cluster the 1104 tumors by their profile',
        hold: 1800,
      },
      { type: 'waitForText', text: 'Clustering' },
      { type: 'click', text: 'Clustering', hold: 1600 },
      { type: 'waitForText', text: 'Cluster rows by similarity' },
      { type: 'click', text: 'Cluster rows by similarity', hold: 1200 },
      // The camera comes off for the run itself. Clustering ships the matrix to
      // an RPC worker and then repaints 1104 rows in one pass, which under
      // swiftshader is seconds of a frozen frame rather than an animation.
      {
        type: 'waitForSelector',
        selector: DENDROGRAM,
        timeout: 300000,
        cut: true,
      },
      { type: 'delay', ms: 2500 },
    ],
    tailMs: 3500,
  },
  // A RE-LAYOUT again, and the precondition every figure on tcga_cohort_mutations
  // is built on. Both of its matrices are drawn over collapsed exons, which the
  // page can only say in a sentence; a reader who opens CDH1 for themselves gets
  // 63 kb of first intron and a matrix of private intronic columns, which looks
  // nothing like either picture.
  //
  // Four clicks with a dialog in the middle, so it is also the page's answer to
  // "where do the figures' windows come from": the exon intervals come out of
  // the live feature rather than being typed, and the clip ends on the frame the
  // figure below it prints.
  //
  // The toast the collapse raises is deliberately IN this clip. The still hides
  // it (hideSelectors) because it has no business in a published frame, but a
  // tour is a record of real clicks and that toast is how the app confirms one.
  {
    name: 'tcga/mutations_collapse_introns',
    description:
      'Reshaping a gene to its exons: right-click CDH1 in the gene lane, Collapse introns, and the 979-tumor matrix redrawn over the coding sequence',
    url: tcgaMutationVideoFixtures.cdh1WholeTranscript,
    // 779px of app at every frame the run measured — `Replace current view`
    // reshapes in place rather than adding a view, so nothing here grows the way
    // a launch does — and the frame is 60px taller than that ON PURPOSE. The
    // collapse raises a snackbar the run's content report does not count, and it
    // draws under the app's own bottom border; sized to the content it would land
    // half outside the frame or over the last rows of the matrix.
    viewportHeight: 840,
    // The matrix has to be carrying its 979 rows before the camera starts.
    readySelector: tcgaMutationVideoFixtures.matrixDone,
    readyTimeout: 300000,
    settleMs: 10000,
    steps: [
      { type: 'hover', selector: '[aria-label="JBrowse"]', hold: 0 },
      { type: 'waitForText', text: tcgaMutationVideoFixtures.gene },
      {
        type: 'rightclick',
        text: tcgaMutationVideoFixtures.gene,
        say: `Reshape ${tcgaMutationVideoFixtures.gene} to its coding exons`,
        hold: 1800,
      },
      { type: 'waitForText', text: 'Collapse introns' },
      { type: 'click', text: 'Collapse introns', hold: 1600 },
      { type: 'waitForText', text: 'Replace current view' },
      {
        type: 'click',
        selector: 'button::-p-text(Replace current view)',
      },
      { type: 'waitForText', text: 'Replace current view', hidden: true },
      // Off camera for the refetch. Reshaping the view refetches every track,
      // which for 979 rows of a cohort VCF is a loading overlay rather than an
      // animation.
      {
        type: 'waitForSelector',
        selector: '[data-testid="loading-overlay"]',
        hidden: true,
        cut: true,
      },
      {
        type: 'waitForSelector',
        selector: tcgaMutationVideoFixtures.matrixDone,
        timeout: 300000,
      },
      { type: 'delay', ms: 2500 },
    ],
    tailMs: 3500,
  },
]
