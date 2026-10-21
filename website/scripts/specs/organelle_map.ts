import { displayPainted } from '@jbrowse/browser-test-utils'

import { lgvSession, sessionSpec } from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// tutorials/organelle_map.md fences this config's `mito_genes`, whose 250 px
// height keeps the ND6 and D-loop names that the 100 px default drops
const CONFIG = 'test_data/human_mito/config.json'

export const organelleMapSpecs: ScreenshotSpec[] = [
  {
    mode: 'url',
    name: 'organelle_map/mito_ring',
    url: sessionSpec(CONFIG, {
      views: [
        {
          type: 'CircularView',
          assembly: 'human_mito',
          height: 780,
          showLegend: true,
          tracks: ['mito_genes'],
        },
      ],
    }),
    readySelector: displayPainted('circular-ring-canvas'),
    readyTimeout: 60000,
    viewportWidth: 1000,
    viewportHeight: 900,
  },
  {
    mode: 'url',
    name: 'organelle_map/nd6_linear',
    url: lgvSession(CONFIG, {
      assembly: 'human_mito',
      loc: 'NC_012920.1:12,000-16,569',
      tracks: ['mito_genes'],
    }),
    readyText: 'ND6',
    readyTimeout: 60000,
    viewportHeight: 520,
  },
]
