// The SV tutorial and the JBrowse 2 v5 paper both draw this junction from these
// specs. Flipping chr3 hides the scaffold's minus-strand chr3 in an axis label.
// Without forceLoad the fetch-size gate stops the read slice loading headless.
import { displayPainted } from '@jbrowse/browser-test-utils'

import { CGIAB_CONFIG, sessionSpec } from '../screenshot-spec-helpers.ts'

import type { Annotation, ScreenshotSpec } from '../screenshot-spec-types.ts'

const PIF = 'HG008T_v3.2_pif'
export const READS = 'HG008-T_PacBio-HiFi-Revio_20240125_116x_GRCh38-GIABv3'
const ASSEMBLY_READS = 'HG008-T_PacBio-HiFi-Revio_20240125_116x_HG008T_v3.2'
const CALLS = 'hg008t_benchmark_sv'
const GRCH38 = 'GRCh38_GIABv3'
const HG008T = 'HG008T_v3.2'
const SCAFFOLD = 'chr3_chr13_hap1'
const WIDTH = 1800
const FONT = 19
const APP_BAR = 'header.MuiAppBar-root'
const APP_BAR_HEIGHT = 48
// the view's title bar and the synteny view's toolbar
const VIEW_HEADER = [
  '[data-testid^="view-container-"] > :first-child',
  'div:has(> span > [data-testid="follow-synteny-toggle"])',
]
const BLUE = 'rgba(31,119,180,0.45)'
export const BAND = '[data-testid="highlight-band"]'

// A figure printed narrower than the tutorial's page brings its own width and
// callouts
interface Chrome {
  hideAppBar?: boolean
  // the title bar and toolbar repeat the assemblies and regions the rows name
  hideViewHeader?: boolean
  // what the viewport loses to hidden chrome and to blank rows under the last
  // view
  trim?: number
  width?: number
  annotations?: Annotation[]
}

// assemblyReads is the height of a row of the tumor reads realigned to hap1
interface JunctionOptions extends Chrome, ScaffoldLayout {
  assemblyReads?: number
}

// Heights a figure printed under a page-height cap shortens
interface ScaffoldLayout {
  level?: number
  reads?: number
  readArcs?: number
  coverage?: number
  readRowHeight?: number
}

interface OverviewLayout {
  level?: number
}

const chrome = (
  height: number,
  { hideAppBar, hideViewHeader, trim = 0, width = WIDTH }: Chrome,
  hidden = [
    ...(hideAppBar ? [APP_BAR] : []),
    ...(hideViewHeader ? VIEW_HEADER : []),
  ],
) => ({
  viewportWidth: width,
  viewportHeight: height + (hideAppBar ? 0 : APP_BAR_HEIGHT) - trim,
  ...(hidden.length ? { hideSelectors: hidden } : {}),
})

const reads = {
  trackId: READS,
  pileup: { mark: { height: 1 } },
  filter: [{ field: 'connection.offscreen', equal: false }],
  height: 200,
  forceLoad: true,
}
const SCAFFOLD_LEVEL = 150
const SCAFFOLD_READS = 690

// Each band spans more than the breakpoint, which is sub-pixel at every scale
const band = (
  assemblyName: string,
  refName: string,
  start: number,
  end: number,
) => ({ assemblyName, refName, start, end, color: BLUE })

type CalloutStyle = Pick<Annotation, 'fontSize' | 'maxWidth' | 'strokeWidth'>

export const callout = (
  text: string,
  anchor: Annotation['anchor'],
  dx: number,
  dy: number,
  { fontSize = FONT, maxWidth, strokeWidth }: CalloutStyle = {},
): Annotation => ({
  type: 'text',
  text,
  fontSize,
  color: '#1f77b4',
  background: '#dceaf6',
  leader: true,
  anchor,
  dx,
  dy,
  maxWidth,
  ...(strokeWidth ? { strokeWidth } : {}),
})

// Anchored on the track label, the one element a band shares a row with. Its
// dy places the text's baseline.
export const bandLabel = (
  text: string,
  trackLabel: string,
  dy: number,
  fontSize = FONT,
): Annotation => ({
  type: 'text',
  text,
  fontSize,
  anchor: { text: trackLabel, alignX: 'left', alignY: 'bottom', dx: -50, dy },
})

export const rowLabel = (
  text: string,
  row: number,
  fontSize = FONT,
): Annotation => ({
  type: 'text',
  text,
  fontSize,
  anchor: {
    selector: '[data-testid="refLabel-prefix"]',
    view: [0, row],
    alignX: 'left',
    alignY: 'bottom',
    dx: 4,
    dy: fontSize + 7,
  },
})

export const junction = (row: number, style: CalloutStyle = {}) =>
  callout(
    'junction',
    { selector: BAND, view: [0, row], alignY: 'center' },
    170,
    8,
    style,
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
  annotations: [
    callout(
      'chr3 breakend',
      {
        view: [0, 0],
        trackId: CALLS,
        feature: 'SV_20',
        alignX: 'left',
        dx: -30,
      },
      -150,
      0,
    ),
    callout(
      'chr13 breakend',
      {
        view: [0, 1],
        trackId: CALLS,
        feature: 'SV_190',
        alignX: 'left',
        dx: -30,
      },
      -150,
      0,
    ),
  ],
  readyText: 'HG008-T_PacBio',
  readyTimeout: 180000,
  ...chrome(790, opts),
})

const hap1Label = (text: string, dy: number): Annotation => ({
  type: 'text',
  text,
  fontSize: FONT,
  anchor: {
    selector: '[data-testid="refLabel-prefix"]',
    view: [0, 1],
    alignX: 'left',
    alignY: 'bottom',
    dx: 4,
    dy,
  },
})

export const junctionScaffold = (
  name: string,
  { assemblyReads, ...opts }: JunctionOptions = {},
  level = opts.level ?? SCAFFOLD_LEVEL,
  readsHeight = opts.reads ?? SCAFFOLD_READS,
): ScreenshotSpec => ({
  mode: 'url',
  name,
  url: sessionSpec(CGIAB_CONFIG, {
    views: [
      {
        type: 'LinearSyntenyView',
        mark: { interpolate: 'bump' },
        levelHeights: [level],
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
                encoding: { color: 'insertSizeAndOrientation' },
                legend: { show: true },
                pileup: { mark: { height: opts.readRowHeight ?? 2 } },
                readConnections: { show: true, height: opts.readArcs ?? 70 },
                ...(opts.coverage
                  ? { coverage: { height: opts.coverage } }
                  : {}),
                height: readsHeight,
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
            ...(assemblyReads
              ? {
                  trackLabels: 'hidden',
                  tracks: [
                    {
                      trackId: ASSEMBLY_READS,
                      pileup: { mark: { height: 2 } },
                      height: assemblyReads,
                      forceLoad: true,
                    },
                  ],
                }
              : { hideNoTracksActive: true }),
            highlight: [band(HG008T, SCAFFOLD, 106651319, 106651339)],
          },
        ],
      },
    ],
  }),
  annotations: opts.annotations ?? [
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
    ...(assemblyReads
      ? [
          // in the notch between the two ribbons, clear of the hap1 reads
          callout(
            'junction',
            { selector: BAND, view: [0, 1], alignY: 'top' },
            0,
            -100,
          ),
          hap1Label('the same reads on hap1', 2 * FONT + 30),
        ]
      : [junction(1)]),
    bandLabel('SV calls', 'draft benchmark somatic SVs', 22),
    bandLabel('aggregate read links', READS, 92),
    bandLabel('split reads', READS, 250),
    bandLabel('unsplit reads', READS, 610),
  ],
  readySelector: displayPainted('synteny_canvas'),
  readyTimeout: 180000,
  ...chrome(
    1172 -
      (SCAFFOLD_LEVEL - level) -
      (SCAFFOLD_READS - readsHeight) +
      (assemblyReads ? assemblyReads - 32 : 0),
    opts,
  ),
})

export const OVERVIEW_LEVEL_HEIGHT = 200

// The scaffold's two chr3 segments end one pixel apart, so the chr3 breakend
// line sits between two ribbons; the junction marker says which one it is.
export const scaffoldOverview = (
  name: string,
  opts: Chrome & OverviewLayout = {},
  level = opts.level ?? OVERVIEW_LEVEL_HEIGHT,
): ScreenshotSpec => ({
  mode: 'url',
  name,
  url: sessionSpec(CGIAB_CONFIG, {
    views: [
      {
        type: 'LinearSyntenyView',
        mark: { interpolate: 'bump' },
        levelHeights: [level, level],
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
  annotations: opts.annotations ?? [
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
  ...chrome(758 - 2 * (OVERVIEW_LEVEL_HEIGHT - level), opts),
})
