// The SV tutorial and the JBrowse 2 v5 paper both draw this junction from these
// specs. Flipping chr3 hides the scaffold's minus-strand chr3 in an axis label.
// Without forceLoad the fetch-size gate stops the read slice loading headless.
import { displayPainted } from '@jbrowse/browser-test-utils'

import { CGIAB_CONFIG, sessionSpec } from '../screenshot-spec-helpers.ts'

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
  pileup: { readHeight: 1 },
  filter: {
    connections: {
      offscreenMates: 'exclude',
    },
  },
  height: 200,
  forceLoad: true,
}

// Each band spans more than the breakpoint, which is sub-pixel at every scale
const band = (
  assemblyName: string,
  refName: string,
  start: number,
  end: number,
) => ({ assemblyName, refName, start, end, color: BLUE })

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

// Anchored on the track label, the one element a band shares a row with
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
  tracks: [{ trackId: CALLS, height: 40 }, reads],
})

export const junctionReads = (
  name: string,
  opts: Chrome = {},
): ScreenshotSpec => ({
  mode: 'url',
  name,
  url: sessionSpec(CGIAB_CONFIG, {
    views: [
      {
        type: 'BreakpointSplitView',
        views: [
          // the SV inspector's chord opens chr3 first
          splitPanel('chr3:139,971,414-139,981,414'),
          splitPanel('chr13:114,348,244-114,358,244'),
        ],
      },
    ],
  }),
  // an arrow aimed at the call's label would land on the breakend bar
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
  url: sessionSpec(CGIAB_CONFIG, {
    views: [
      {
        type: 'LinearSyntenyView',
        mark: { interpolate: 'bump' },
        levelHeights: [150],
        encoding: { opacity: 0.35 },
        offscreen: { show: false },
        tracks: [[PIF]],
        views: [
          {
            loc: 'chr13:114,348,244-114,358,244 chr3:139,971,415-139,981,415',
            assembly: GRCH38,
            tracks: [
              { trackId: CALLS, height: 40 },
              {
                ...reads,
                unit: 'chain',
                facet: 'split',
                encoding: { color: 'pairOrientation' },
                legend: { show: true },
                pileup: { readHeight: 2 },
                readConnections: { show: true, height: 70 },
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
    // dy keeps these clear of the read curves
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

// The scaffold's two chr3 segments end one pixel apart, so the chr3 breakend
// line sits between two ribbons; the junction marker says which one it is.
export const scaffoldOverview = (
  name: string,
  opts: Chrome = {},
): ScreenshotSpec => ({
  mode: 'url',
  name,
  url: sessionSpec(CGIAB_CONFIG, {
    views: [
      {
        type: 'LinearSyntenyView',
        mark: { interpolate: 'bump' },
        levelHeights: [200, 200],
        // a cutoff above 155 kb drops the last chr13 block before the junction
        filter: [{ field: 'length', gte: 100000 }],
        encoding: { opacity: 0.35 },
        offscreen: { show: false },
        tracks: [PIF],
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
