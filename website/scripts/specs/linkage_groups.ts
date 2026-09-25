import { displayPainted } from '@jbrowse/browser-test-utils'

import { sessionSpec } from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

const ODP_CONFIG = encodeURIComponent(
  'https://jbrowse.org/demos/odp_linkage_groups/config.json',
)

// the figures are about where colors fall, not which of 29 letters each is
const HIDE_LEGEND = {
  type: 'click',
  selector: '[aria-label="Hide legend"]',
} as const

const A1A_BLOCK = { hLocus: 'RES2', vLocus: 'EMU19' }

export const linkageGroupsSpecs: ScreenshotSpec[] = [
  {
    mode: 'url',
    name: 'linkage_groups/alg_dotplot_res_emu',
    url: sessionSpec(ODP_CONFIG, {
      views: [
        {
          type: 'DotplotView',
          displayName: 'Rhopilema (jellyfish) vs Ephydatia (sponge)',
          views: [
            { assembly: 'RES' },
            { assembly: 'EMU', displayedRegionNames: ['EMU*'] },
          ],
          tracks: ['RES_EMU'],
          color: { field: 'gene_group' },
          autoDiagonalize: true,
          lineWidth: 4,
          height: 860,
        },
      ],
    }),
    readySelector: displayPainted('dotplot_webgl_canvas'),
    readyTimeout: 120000,
    viewportWidth: 900,
    viewportHeight: 1030,
    actions: [HIDE_LEGEND],
    annotations: [
      { type: 'box', anchor: A1A_BLOCK },
      {
        type: 'text',
        text: 'A1a: one sponge chromosome',
        fontSize: 18,
        leader: true,
        anchor: { ...A1A_BLOCK, alignY: 'top' },
        dx: 10,
        dy: -400,
      },
    ],
  },
  {
    mode: 'url',
    name: 'linkage_groups/alg_stack',
    url: sessionSpec(ODP_CONFIG, {
      views: [
        {
          type: 'LinearSyntenyView',
          displayName: 'Comb jellies, jellyfish, amphioxus, sponges',
          views: [
            { assembly: 'BIN', displayedRegionNames: ['BIN*'] },
            { assembly: 'HCA', displayedRegionNames: ['HCA*'] },
            { assembly: 'RES', displayedRegionNames: ['RES*'] },
            { assembly: 'BFL', displayedRegionNames: ['BFL*'] },
            { assembly: 'EMU', displayedRegionNames: ['EMU*'] },
            { assembly: 'CLAa', displayedRegionNames: ['CLA*_hapA'] },
          ],
          tracks: [
            ['BIN_HCA'],
            ['RES_HCA'],
            ['RES_BFL'],
            ['BFL_EMU'],
            ['EMU_CLAa'],
          ],
          color: { field: 'gene_group' },
          hideUnlabelled: true,
          autoDiagonalize: true,
          // The jellyfish row, whose chromosomes ARE the linkage groups this
          // figure is about (review: the reorder "sweeps top-down from
          // Bolinopsis in its own file order, so every row below, the jellyfish
          // included, is ordered off a comb jelly"). Anchored here the sweep
          // runs outward both ways from it.
          diagonalizeAnchorRow: 2,
          drawCurves: true,
          fadeThinAlignmentsMode: 'off',
          alpha: 0.45,
          levelHeights: [130, 130, 130, 130, 130],
          collapseEmptyRows: true,
        },
      ],
    }),
    readySelector: displayPainted('synteny_canvas'),
    readyTimeout: 120000,
    viewportWidth: 1400,
    viewportHeight: 944,
    actions: [HIDE_LEGEND],
  },
]
