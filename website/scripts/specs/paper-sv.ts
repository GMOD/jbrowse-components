// The JBrowse 2 v5 paper's structural variant figure, which the paper repo
// syncs from figures.lock. One junction of the HG008-T chr3_chr13_hap1
// scaffold at three scales: split reads, the scaffold over the same two
// reference windows, and the whole scaffold. The benchmark calls the junction
// as SV_190/SV_20, and the scaffold joins chr13:114,353,244 to chr3:139,976,415
// at 106,651,329. The scaffold carries chr3 on the minus strand, which the
// synteny panels show as a twisted ribbon.
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
const BLUE = 'rgba(31,119,180,0.45)'
const BAND = '[data-testid="highlight-band"]'
// The app bar would repeat in all three parts of the compose
const HIDE = ['header.MuiAppBar-root']

const reads = (height: number) => ({
  trackId: READS,
  type: 'LinearAlignmentsDisplay',
  featureHeight: 1,
  height,
  forceLoad: true,
  drawLongRange: false,
})

const band = (
  assemblyName: string,
  refName: string,
  start: number,
  end: number,
) => ({ assemblyName, refName, start, end, color: BLUE })

const breakend = (
  text: string,
  anchor: Annotation['anchor'],
  dx = -150,
  dy = -34,
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

const partLabel = (part: number, text: string): Annotation => ({
  type: 'text',
  text,
  fontSize: 44,
  anchor: {
    selector: `[data-part="${part}"]`,
    alignX: 'left',
    alignY: 'top',
    dx: 40,
    dy: 64,
  },
})

const splitPanel = (loc: string) => ({
  loc,
  assembly: GRCH38,
  tracks: [
    { trackId: CALLS, type: 'LinearVariantDisplay', height: 40 },
    reads(200),
  ],
})

export const paperSvSpecs: ScreenshotSpec[] = [
  {
    mode: 'url',
    name: 'paper/sv_junction_reads',
    url: cgiabUrl({
      views: [
        {
          type: 'BreakpointSplitView',
          views: [
            splitPanel('chr13:114,348,244-114,358,244'),
            splitPanel('chr3:139,971,414-139,981,414'),
          ],
        },
      ],
    }),
    annotations: [
      breakend(
        'chr13 breakend',
        { text: 'SV_190', alignX: 'left', dx: -30 },
        -150,
        0,
      ),
      breakend(
        'chr3 breakend',
        { text: 'SV_20', alignX: 'left', dx: -30 },
        -150,
        0,
      ),
    ],
    readyText: 'HG008-T_PacBio',
    readyTimeout: 180000,
    viewportWidth: WIDTH,
    viewportHeight: 790,
    hideSelectors: HIDE,
  },
  {
    mode: 'url',
    name: 'paper/sv_junction_scaffold',
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
              tracks: [reads(200)],
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
      rowLabel('HG008-T hap1 scaffold', 1),
      breakend(
        'chr13 breakend',
        { selector: BAND, view: [0, 0], alignY: 'bottom' },
        150,
        -60,
      ),
      breakend(
        'chr3 breakend',
        { selector: `${BAND} ~ ${BAND}`, view: [0, 0], alignY: 'bottom' },
        150,
        -60,
      ),
      breakend(
        'chr13–chr3 junction',
        { selector: BAND, view: [0, 1], alignY: 'center' },
        170,
        8,
      ),
    ],
    readySelector: displayPainted('synteny_canvas'),
    readyTimeout: 180000,
    viewportWidth: WIDTH,
    viewportHeight: 592,
    hideSelectors: HIDE,
  },
  {
    mode: 'url',
    name: 'paper/sv_scaffold_overview',
    url: cgiabUrl({
      views: [
        {
          type: 'LinearSyntenyView',
          drawCurves: true,
          levelHeights: [220],
          minAlignmentLength: 100000,
          opacity: 0.35,
          showOffscreenMates: false,
          tracks: [[PIF]],
          views: [
            {
              loc: 'chr13:1-114364328 chr3:1-198295559',
              assembly: GRCH38,
              hideNoTracksActive: true,
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
      rowLabel('GRCh38 reference', 0),
      rowLabel('HG008-T hap1 scaffold', 1),
      breakend(
        'chr13–chr3 junction',
        { selector: BAND, view: [0, 1], alignY: 'center' },
        170,
        8,
      ),
    ],
    readySelector: displayPainted('synteny_canvas'),
    readyTimeout: 180000,
    viewportWidth: WIDTH,
    viewportHeight: 472,
    hideSelectors: HIDE,
  },
  {
    mode: 'compose',
    name: 'paper/sv_translocation',
    parts: [
      'paper/sv_junction_reads',
      'paper/sv_junction_scaffold',
      'paper/sv_scaffold_overview',
    ],
    gutter: 40,
    annotations: [partLabel(0, 'a'), partLabel(1, 'b'), partLabel(2, 'c')],
  },
]
