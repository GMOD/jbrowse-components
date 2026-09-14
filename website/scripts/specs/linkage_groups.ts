import { displayPainted } from '@jbrowse/browser-test-utils'

import { sessionSpec } from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// odp_linkage_groups_synteny.md. demos/odp_linkage_groups/README.md says what
// the hosted config holds and how it was built.
const ODP_CONFIG = encodeURIComponent(
  'https://jbrowse.org/demos/odp_linkage_groups/config.json',
)

// The legend lists 29 letter names, and each of these figures is about where
// the colors fall rather than which group is which, so it goes, and the plot
// area it covered comes back.
const HIDE_LEGEND = {
  type: 'click',
  selector: '[aria-label="Hide legend"]',
} as const

// A1a throughout, the group the page's table and awk example follow: one cell
// on the sponge plot, a whole column on the other two.
function resDotplot(
  vertical: string,
  displayName: string,
  callout: { text: string; vLocus?: string },
) {
  const anchor = { hLocus: 'RES2', vLocus: callout.vLocus }
  return {
    mode: 'url',
    name: `linkage_groups/alg_dotplot_res_${vertical.toLowerCase()}`,
    url: sessionSpec(ODP_CONFIG, {
      views: [
        {
          type: 'DotplotView',
          displayName,
          views: [
            { assembly: 'RES' },
            { assembly: vertical, displayedRegionNames: [`${vertical}*`] },
          ],
          tracks: [`RES_${vertical}`],
          colorBy: 'attribute:gene_group',
          autoDiagonalize: true,
          lineWidth: 4,
          height: 860,
        },
      ],
    }),
    readySelector: displayPainted('dotplot_webgl_canvas'),
    readyTimeout: 120000,
    settleMs: 15000,
    viewportWidth: 900,
    viewportHeight: 1030,
    actions: [HIDE_LEGEND],
    annotations: [
      { type: 'box', anchor, pad: callout.vLocus ? undefined : 0 },
      {
        type: 'text',
        text: callout.text,
        fontSize: 18,
        leader: true,
        anchor: callout.vLocus
          ? { ...anchor, alignY: 'top' }
          : { ...anchor, alignX: 'right', alignY: 'top' },
        dx: callout.vLocus ? 10 : 160,
        dy: callout.vLocus ? -400 : 20,
      },
    ],
  } satisfies ScreenshotSpec
}

export const linkageGroupsSpecs: ScreenshotSpec[] = [
  resDotplot('EMU', 'Rhopilema (jellyfish) vs Ephydatia (sponge)', {
    text: 'A1a: one sponge chromosome',
    vLocus: 'EMU19',
  }),
  resDotplot('HCA', 'Rhopilema (jellyfish) vs Hormiphora (comb jelly)', {
    text: 'A1a: several comb jelly chromosomes',
  }),
  resDotplot('COW', 'Rhopilema (jellyfish) vs Capsaspora', {
    text: 'A1a: several Capsaspora chromosomes',
  }),
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
          colorBy: 'attribute:gene_group',
          hideUnlabelled: true,
          autoDiagonalize: true,
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
    settleMs: 15000,
    viewportWidth: 1400,
    viewportHeight: 944,
    actions: [HIDE_LEGEND],
  },
]
