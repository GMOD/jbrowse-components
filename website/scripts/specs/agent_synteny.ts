import { displayPainted } from '@jbrowse/browser-test-utils'

import { sessionSpec } from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// The D. simulans / D. mauritiana comparison the agent_synteny tutorial has an
// agent build: the two hosted GenArk configs merged, their NCBI RefSeq tracks
// kept, and one minimap2 asm20 alignment between them as a PIF. The repo copy of
// the config is demos/fly_agent_synteny/config.json, and the PIF sits beside it
// in the bucket.
//
// Point FLY_DEMO_BASE at a local `npx serve` of that build to render these
// before the upload, the way ECOLI_DEMO_BASE works for the pangenome figures:
//
//   npx --yes serve -l 8085 --cors <dir holding config.json and the pif>
//   FLY_DEMO_BASE=http://localhost:8085 node website/scripts/generate-screenshots.ts \
//     --filter agent_synteny
const FLY_DEMO_BASE =
  process.env.FLY_DEMO_BASE ?? 'https://jbrowse.org/demos/fly_agent_synteny'

const FLY_CONFIG = encodeURIComponent(`${FLY_DEMO_BASE}/config.json`)

const SIM = 'GCF_016746395.2'
const MAU = 'GCF_004382145.1'
const SIM_GENES = `${SIM}-ncbiRefSeq`
const MAU_GENES = `${MAU}-ncbiRefSeq`
const PIF = 'sim_vs_mau'

const ARMS = ['chr2L', 'chr2R', 'chr3L', 'chr3R', 'chr4', 'chrX']

function flySynteny(
  sim: string,
  mau: string,
  extra: Record<string, unknown> = {},
) {
  return {
    type: 'LinearSyntenyView',
    views: [
      { assembly: SIM, loc: sim, tracks: [SIM_GENES] },
      { assembly: MAU, loc: mau, tracks: [MAU_GENES] },
    ],
    tracks: [[PIF]],
    levelHeights: [200],
    drawCurves: false,
    // Red forward, blue reverse, which is the one thing the colinear frame and
    // the inversion frames differ by.
    colorBy: 'strand',
    // Each row shows one arm, so every alignment to an unplaced scaffold draws
    // a mate mark labelled with its chrUn_NW_ contig, and a few hundred of them
    // cover the band these figures are about.
    showOffscreenMates: false,
    ...extra,
  }
}

const SYNTENY_FRAME = {
  readySelector: displayPainted('synteny_canvas'),
  readyTimeout: 120000,
  viewportWidth: 1400,
  // 620 cut 41 css px off the mauritiana gene row, per the run's own CONTENT
  // CLIPPED report
  viewportHeight: 664,
} as const

export const agentSyntenySpecs: ScreenshotSpec[] = [
  // The comparison as the agent first builds it, on a colinear 30 kb of 3R: one
  // unbroken forward block, and each RefSeq gene meeting its counterpart exon
  // for exon. The frame the two inversions below are read against.
  {
    mode: 'url',
    name: 'agent_synteny/comparison_built',
    url: sessionSpec(FLY_CONFIG, {
      views: [
        flySynteny(
          'chr3R:16,090,000-16,120,000',
          'chr3R:16,826,000-16,856,000',
          { levelHeights: [140] },
        ),
      ],
    }),
    ...SYNTENY_FRAME,
    viewportHeight: 604,
  },

  // Both axes restricted to the six arms. Unrestricted, a few hundred unplaced
  // scaffolds interleave both axes and the diagonal breaks into rows holding a
  // handful of alignments each.
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
          colorBy: 'strand',
          height: 760,
        },
      ],
    }),
    readySelector: displayPainted('dotplot_webgl_canvas'),
    readyTimeout: 120000,
    viewportWidth: 1000,
    viewportHeight: 900,
  },

  // The 2.2 Mb reverse-strand region at the centromere-proximal end of 2R, the
  // largest of the three the PAF totals pick out and the least tidy: 75 short
  // blocks through repeat-rich sequence, which draw as a fan rather than as the
  // two clean crossings the X region below gives.
  {
    mode: 'url',
    name: 'agent_synteny/inversion_2r',
    url: sessionSpec(FLY_CONFIG, {
      views: [
        flySynteny('chr2R:1-2,400,000', 'chr2R:500,000-3,800,000', {
          minAlignmentLength: 5000,
        }),
      ],
    }),
    ...SYNTENY_FRAME,
  },

  // The smaller X region: two reverse blocks crossing, with forward alignment
  // in red on both sides of them in the same frame.
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
