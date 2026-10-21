import { displayPainted } from '@jbrowse/browser-test-utils'

import { sessionSpec } from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// The config's repo copy is demos/fly_agent_synteny/config.json. Point
// FLY_DEMO_BASE at a local `npx serve` of it to render before the upload.
const FLY_DEMO_BASE =
  process.env.FLY_DEMO_BASE ?? 'https://jbrowse.org/demos/fly_agent_synteny'

const FLY_CONFIG = `${FLY_DEMO_BASE}/config.json`

const SIM = 'GCF_016746395.2'
const MAU = 'GCF_004382145.1'
const SIM_GENES = `${SIM}-ncbiRefSeq`
const MAU_GENES = `${MAU}-ncbiRefSeq`
const PIF = 'sim_vs_mau'

const ARMS = ['chr2L', 'chr2R', 'chr3L', 'chr3R', 'chr4', 'chrX']

function flySynteny(
  sim: string,
  mau: string,
  {
    genes = false,
    ...extra
  }: { genes?: boolean } & Record<string, unknown> = {},
) {
  return {
    type: 'LinearSyntenyView',
    views: [
      { assembly: SIM, loc: sim, ...(genes ? { tracks: [SIM_GENES] } : {}) },
      { assembly: MAU, loc: mau, ...(genes ? { tracks: [MAU_GENES] } : {}) },
    ],
    tracks: [[PIF]],
    collapseEmptyRows: !genes,
    levelHeights: [360],
    mark: { interpolate: 'linear' },
    color: { field: 'strand' },
    // Shown, a few hundred chrUn_NW_ mate marks cover the band.
    offscreen: { show: false },
    ...extra,
  }
}

const SYNTENY_FRAME = {
  readySelector: displayPainted('synteny_canvas'),
  readyTimeout: 120000,
  viewportWidth: 1400,
  viewportHeight: 560,
} as const

export const agentSyntenySpecs: ScreenshotSpec[] = [
  {
    mode: 'url',
    name: 'agent_synteny/comparison_built',
    url: sessionSpec(FLY_CONFIG, {
      views: [
        flySynteny(
          'chr3R:16,090,000-16,120,000',
          'chr3R:16,826,000-16,856,000',
          { genes: true, levelHeights: [140] },
        ),
      ],
    }),
    ...SYNTENY_FRAME,
    viewportHeight: 604,
  },

  // Unrestricted to the arms, unplaced scaffolds break the diagonal apart.
  {
    mode: 'url',
    name: 'agent_synteny/dotplot_arms',
    url: sessionSpec(FLY_CONFIG, {
      views: [
        {
          type: 'DotplotView',
          displayName: 'D. simulans vs D. mauritiana',
          views: [
            { assembly: SIM, displayedRegionNames: ARMS },
            { assembly: MAU, displayedRegionNames: ARMS },
          ],
          tracks: [PIF],
          color: { field: 'strand' },
          axis: { labels: false },
          height: 760,
        },
      ],
    }),
    readySelector: displayPainted('dotplot_webgl_canvas'),
    readyTimeout: 120000,
    viewportWidth: 1000,
    viewportHeight: 900,
  },

  {
    mode: 'url',
    name: 'agent_synteny/inversion_2r',
    url: sessionSpec(FLY_CONFIG, {
      views: [
        flySynteny('chr2R:1-2,400,000', 'chr2R:500,000-3,800,000', {
          filter: [{ field: 'length', gte: 5000 }],
        }),
      ],
    }),
    ...SYNTENY_FRAME,
  },

  {
    mode: 'url',
    name: 'agent_synteny/inversion_x',
    url: sessionSpec(FLY_CONFIG, {
      views: [
        flySynteny('chrX:8,100,000-8,950,000', 'chrX:8,330,000-9,180,000'),
      ],
    }),
    ...SYNTENY_FRAME,
  },
]
