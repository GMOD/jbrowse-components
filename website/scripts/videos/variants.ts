// The tours over the variant tutorials, where the subject is a display the
// track menu switches to rather than a file the reader prepares.
import { trioVideoFixtures } from '../specs/trio.ts'
import { openTrackByUrlSteps, trackMenu } from './shared.ts'

import type { VideoSpec, VideoStep } from '../video-spec-types.ts'

const { defaultDisplay, genesOnly, vcfTrackId, vcfUrl, zoomOutsToMatrix } =
  trioVideoFixtures

export const variantVideos: VideoSpec[] = [
  // The page's VCF opened the way a reader opens their own, by URL, where the
  // page itself hands over a config fence.
  {
    name: 'variants/trio_open_vcf',
    description:
      'The trio VCF opened by URL with no config written: File, Open track..., the URL pasted in, the index and adapter the form infers, and the variants drawing under the genes',
    goal: 'Open the trio VCF from its URL, with no config to write',
    url: genesOnly,
    // the add-track drawer is the tallest state
    viewportHeight: 640,
    readySelector: '::-p-text(NCBI RefSeq)',
    readyTimeout: 120000,
    steps: [
      { type: 'hover', selector: '[aria-label="JBrowse"]', hold: 0 },
      ...openTrackByUrlSteps(vcfUrl, {
        open: 'From File, Open track, then paste the VCF URL',
        add: 'The form infers the .tbi index and the adapter; Add',
      }),
      { type: 'hover', selector: '[aria-label="JBrowse"]', hold: 0 },
      {
        type: 'delay',
        ms: 3500,
        say: "The trio's variants, one box each, under the genes",
      },
    ],
    tailMs: 3000,
  },
  // analyze_trio.md spends three sections and four figures on one route: the
  // display type and then the rendering mode, on one track and one window.
  // What the stills cannot carry is that the six rows ARE the three, each
  // sample split into its two haplotypes in place.
  //
  // It opens on the display the track loads with, which refuses 2.9 Mb of this
  // VCF, and zooms out to the figures' window at the end, where the matrix
  // draws because a column is a variant rather than a position.
  {
    name: 'variants/trio_phased_matrix',
    description:
      "A trio VCF becomes six haplotype rows: the track menu's Display types, the multi-sample matrix, then Rendering mode Phased splitting each of the three samples into its two haplotypes, zoomed out to the figures' window",
    goal: 'Turn a trio VCF into six haplotype rows: child, mother, father',
    url: defaultDisplay,
    // the matrix is the tall state, which trio-matrix-phased-clean is captured
    // at; the blank under the opening lane is its room
    viewportHeight: 620,
    readySelector: '::-p-text(NCBI RefSeq)',
    readyTimeout: 120000,
    steps: [
      { type: 'hover', selector: '[aria-label="JBrowse"]', hold: 0 },
      {
        type: 'delay',
        ms: 2500,
        say: 'One lane, one box per variant: nothing yet about who carries what',
      },
      {
        type: 'click',
        selector: trackMenu(vcfTrackId),
        say: 'Redraw the lane as a genotype matrix, one row per sample',
        hold: 1200,
      },
      { type: 'waitForText', text: 'Display types' },
      { type: 'click', text: 'Display types', hold: 1200 },
      { type: 'waitForText', text: 'Multi-sample variant display' },
      { type: 'click', text: 'Multi-sample variant display' },
      { type: 'waitForAppSettled', timeout: 180000, cut: true },
      { type: 'click', selector: trackMenu(vcfTrackId), hold: 1200 },
      { type: 'waitForText', text: 'Show...' },
      { type: 'click', text: 'Show...', hold: 1200 },
      { type: 'waitForText', text: 'Show as genotype matrix' },
      { type: 'click', text: 'Show as genotype matrix' },
      { type: 'waitForAppSettled', timeout: 180000, cut: true },
      { type: 'delay', ms: 3000 },
      {
        type: 'click',
        selector: trackMenu(vcfTrackId),
        say: "Split each sample's row into its two haplotypes",
        hold: 1200,
      },
      { type: 'waitForText', text: 'Rendering mode' },
      { type: 'click', text: 'Rendering mode', hold: 1200 },
      { type: 'waitForText', text: 'Phased' },
      { type: 'click', text: 'Phased' },
      { type: 'waitForAppSettled', timeout: 180000, cut: true },
      { type: 'delay', ms: 3000 },
      ...Array.from({ length: zoomOutsToMatrix }, (_, i): VideoStep => ({
        type: 'click',
        selector: '[data-testid="zoom_out"]',
        hold: 350,
        ...(i === 0 ? { say: 'Zoom out until the haplotype blocks read' } : {}),
      })),
      { type: 'waitForAppSettled', timeout: 180000, cut: true },
      { type: 'hover', selector: '[aria-label="JBrowse"]', hold: 0 },
      {
        type: 'delay',
        ms: 4000,
        say: "Six phased rows: the child's two haplotypes above each parent's two",
      },
    ],
    tailMs: 4000,
  },
]
