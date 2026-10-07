// One junction of the HG008-T chr3_chr13_hap1 scaffold at three scales: split
// reads, the scaffold over the same two reference windows, and the whole
// scaffold between the reference and hap2. The SV tutorial and the JBrowse 2 v5
// paper both draw their figures from these, so the two cannot drift apart.
//
// The benchmark calls the junction as SV_190/SV_20, and the scaffold joins
// chr13:114,353,244 to chr3:139,976,415 at 106,651,329. The scaffold carries
// chr3 on the minus strand, which the synteny panels show as a twisted ribbon;
// flipping chr3 instead hid the inversion in an axis label.
//
// The read track is a rehosted slice of the 118 GB NCBI BAM that carries these
// two windows, and forceLoad lifts the fetch-size gate so it loads headless.
import { displayPainted } from '@jbrowse/browser-test-utils'

import { cgiabUrl } from '../screenshot-spec-helpers.ts'

import type { Annotation, ScreenshotSpec } from '../screenshot-spec-types.ts'

const PIF = 'HG008T_v3.2_pif'
const READS = 'HG008-T_PacBio-HiFi-Revio_20240125_116x_GRCh38-GIABv3'
const CALLS = 'hg008t_benchmark_sv'
const GRCH38 = 'GRCh38_GIABv3'
const HG008T = 'HG008T_v3.2'
const SCAFFOLD = 'chr3_chr13_hap1'
const WIDTH = 1800
const APP_BAR = 'header.MuiAppBar-root'
const APP_BAR_HEIGHT = 48
const BLUE = 'rgba(31,119,180,0.45)'
const BAND = '[data-testid="highlight-band"]'

// The paper stacks all three in one figure, where the app bar would repeat
interface Chrome {
  hideAppBar?: boolean
}

const chrome = (height: number, { hideAppBar }: Chrome) => ({
  viewportWidth: WIDTH,
  viewportHeight: hideAppBar ? height : height + APP_BAR_HEIGHT,
  ...(hideAppBar ? { hideSelectors: [APP_BAR] } : {}),
})

const reads = {
  trackId: READS,
  type: 'LinearAlignmentsDisplay',
  featureHeight: 1,
  height: 200,
  forceLoad: true,
  // only connections with both ends on screen
  showLongRange: false,
}

// A breakpoint is sub-pixel at every scale here, so each band is widened to a
// few pixels
const band = (
  assemblyName: string,
  refName: string,
  start: number,
  end: number,
) => ({ assemblyName, refName, start, end, color: BLUE })

// The same tinted pill and blue leader in all three figures, so a reader
// carrying one to the next recognises the marks as the same positions
const callout = (
  text: string,
  anchor: Annotation['anchor'],
  dx: number,
  dy: number,
): Annotation => ({
  type: 'text',
  text,
  fontSize: 19,
  color: '#1f77b4',
  background: '#dceaf6',
  leader: true,
  anchor,
  dx,
  dy,
})

// What a band of a track is, on the left like the row labels. Hung from the
// track's own label, the one element a band shares a row with.
const bandLabel = (
  text: string,
  trackLabel: string,
  dy: number,
): Annotation => ({
  type: 'text',
  text,
  fontSize: 19,
  anchor: { text: trackLabel, alignX: 'left', alignY: 'bottom', dx: -50, dy },
})

const rowLabel = (text: string, row: number): Annotation => ({
  type: 'text',
  text,
  fontSize: 19,
  anchor: {
    selector: '[data-testid="refLabel-prefix"]',
    view: [0, row],
    alignX: 'left',
    alignY: 'bottom',
    dx: 4,
    dy: 26,
  },
})

const junction = (row: number) =>
  callout(
    'junction',
    { selector: BAND, view: [0, row], alignY: 'center' },
    170,
    8,
  )

const splitPanel = (loc: string) => ({
  loc,
  assembly: GRCH38,
  tracks: [{ trackId: CALLS, type: 'LinearVariantDisplay', height: 40 }, reads],
})

export const junctionReads = (
  name: string,
  opts: Chrome = {},
): ScreenshotSpec => ({
  mode: 'url',
  name,
  url: cgiabUrl({
    views: [
      {
        type: 'BreakpointSplitView',
        views: [
          // chr3 first, the order the SV inspector's chord opens them in
          splitPanel('chr3:139,971,414-139,981,414'),
          splitPanel('chr13:114,348,244-114,358,244'),
        ],
      },
    ],
  }),
  // Anchored left of each call's label: the record sits on the breakend, so an
  // arrow aimed at the label would land on the breakend bar
  annotations: [
    callout(
      'chr3 breakend',
      { text: 'SV_20', alignX: 'left', dx: -30 },
      -150,
      0,
    ),
    callout(
      'chr13 breakend',
      { text: 'SV_190', alignX: 'left', dx: -30 },
      -150,
      0,
    ),
  ],
  readyText: 'HG008-T_PacBio',
  readyTimeout: 180000,
  ...chrome(790, opts),
})

export const junctionScaffold = (
  name: string,
  opts: Chrome = {},
): ScreenshotSpec => ({
  mode: 'url',
  name,
  url: cgiabUrl({
    views: [
      {
        type: 'LinearSyntenyView',
        drawCurves: true,
        levelHeights: [150],
        opacity: 0.35,
        showOffscreenMates: false,
        tracks: [[PIF]],
        views: [
          {
            loc: 'chr13:114,348,244-114,358,244 chr3:139,971,415-139,981,415',
            assembly: GRCH38,
            tracks: [
              { trackId: CALLS, type: 'LinearVariantDisplay', height: 40 },
              // one row per read with its supplementary alignment, joined by a
              // curve across the two regions, under the arc that totals them.
              // Grouped so the split reads have a section apart from the reads
              // that stop at or run past a breakend.
              {
                ...reads,
                unit: 'chain',
                facet: 'splitRead',
                // names the split-segment colors and the plain reads
                showLegend: true,
                featureHeight: 2,
                readConnections: 'arc',
                readConnectionsHeight: 70,
                height: 690,
              },
            ],
            highlight: [
              band(GRCH38, 'chr13', 114353224, 114353264),
              band(GRCH38, 'chr3', 139976395, 139976435),
            ],
          },
          {
            loc: `${SCAFFOLD}:106,646,329-106,656,329`,
            assembly: HG008T,
            hideNoTracksActive: true,
            highlight: [band(HG008T, SCAFFOLD, 106651319, 106651339)],
          },
        ],
      },
    ],
  }),
  annotations: [
    rowLabel('hap1', 1),
    // beside each call's label in the variant lane, clear of the read curves
    callout(
      'chr13 breakend',
      { selector: BAND, view: [0, 0], alignY: 'top' },
      190,
      70,
    ),
    callout(
      'chr3 breakend',
      { selector: `${BAND} ~ ${BAND}`, view: [0, 0], alignY: 'top' },
      140,
      70,
    ),
    junction(1),
    bandLabel('SV calls', 'draft benchmark somatic SVs', 22),
    bandLabel('aggregate read links', READS, 92),
    bandLabel('split reads', READS, 250),
    bandLabel('unsplit reads', READS, 610),
  ],
  readySelector: displayPainted('synteny_canvas'),
  readyTimeout: 180000,
  ...chrome(1172, opts),
})

// hap2 above the reference and hap1 below it, one level of ribbons each. hap2
// is collinear with both chromosomes, so the two levels differ only by the
// rearrangement. Its chr3 material sits in a scaffold that continues into chr11
// and chr6, which the row crops off because the reference row has neither.
//
// The chr3 breakend line sits between two ribbons: the scaffold's two chr3
// segments end 22 kb apart there, one pixel at this scale. The junction marker
// on the scaffold row says which ribbon it belongs to.
export const scaffoldOverview = (
  name: string,
  opts: Chrome = {},
): ScreenshotSpec => ({
  mode: 'url',
  name,
  url: cgiabUrl({
    views: [
      {
        type: 'LinearSyntenyView',
        drawCurves: true,
        levelHeights: [200, 200],
        // the last chr13 block before the junction is 155 kb
        minAlignmentLength: 100000,
        opacity: 0.35,
        showOffscreenMates: false,
        tracks: [[PIF], [PIF]],
        views: [
          {
            loc: 'chr13_hap2:1-99565785 chr3_chr6_chr11_hap2:1-196000000',
            assembly: HG008T,
            hideNoTracksActive: true,
          },
          {
            loc: 'chr13:1-114364328 chr3:1-198295559',
            assembly: GRCH38,
            hideNoTracksActive: true,
            highlight: [
              band(GRCH38, 'chr13', 113964328, 114364328),
              band(GRCH38, 'chr3', 139776414, 140176414),
            ],
          },
          {
            loc: `${SCAFFOLD}:1-212897834`,
            assembly: HG008T,
            hideNoTracksActive: true,
            highlight: [band(HG008T, SCAFFOLD, 106501329, 106801329)],
          },
        ],
      },
    ],
  }),
  annotations: [
    rowLabel('hap2', 0),
    rowLabel('GRCh38', 1),
    rowLabel('hap1', 2),
    callout(
      'chr13 breakend',
      { selector: BAND, view: [0, 1], alignY: 'top' },
      -150,
      40,
    ),
    callout(
      'chr3 breakend',
      { selector: `${BAND} ~ ${BAND}`, view: [0, 1], alignY: 'top' },
      -150,
      40,
    ),
    junction(2),
  ],
  readySelector: displayPainted('synteny_canvas'),
  readyTimeout: 180000,
  ...chrome(758, opts),
})
