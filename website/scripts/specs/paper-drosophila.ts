// The JBrowse 2 v5 paper's Figure 3a, which the paper repo syncs from
// figures.lock: five Drosophila species as collinear ortholog blocks, coloured
// by Muller element. The caption names the elements, so the key is hidden.
import { displayPainted } from '@jbrowse/browser-test-utils'

import { sessionSpec } from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

const CONFIG = encodeURIComponent(
  'https://jbrowse.org/demos/orthofinder_drosophila_blocks/config.json',
)
const TRACK = 'dros_blocks'

// Rows in melanogaster's Muller order (X 2L 2R 3L 3R 4); the two outgroups flip
// the arms that run backwards against it.
const ROWS = [
  {
    assembly: 'melanogaster',
    loc: 'X:1-23542271 2L:1-23513712 2R:1-25286936 3L:1-28110227 3R:1-32079331 4:1-1348131',
  },
  {
    assembly: 'simulans',
    loc: 'CM028645.2:1-22032822 CM028640.2:1-23857595 CM028641.2:1-22319025 CM028642.2:1-23399903 CM028643.2:1-28149585 CM028644.2:1-1146867',
  },
  {
    assembly: 'yakuba',
    loc: 'CM028598.2:1-24674056 CM028599.2:1-31052931 CM028600.2:1-23815334 CM028601.2:1-25180761 CM028602.2:1-30730773 CM028603.2:1-1429802',
  },
  {
    assembly: 'pseudoobscura',
    loc: 'CM020872.1:1-68158638 CM020870.1:1-30706867 CM020869.1:1-23510042[rev] CM020868.1:1-32422566[rev] CM020871.1:1-1881070',
  },
  {
    assembly: 'virilis',
    loc: 'NC_091543.1:1-30432089 NC_091545.1:1-28253659 NC_091546.1:1-29144718 NC_091547.1:1-27785111[rev] NC_091544.1:1-37975899[rev] NC_091548.1:1-2120509',
  },
]

export const paperDrosophilaSpecs: ScreenshotSpec[] = [
  {
    mode: 'url',
    name: 'paper/drosophila_blocks',
    url: sessionSpec(CONFIG, {
      views: [
        {
          type: 'LinearSyntenyView',
          views: ROWS,
          tracks: ROWS.slice(1).map(() => [TRACK]),
          color: {
            field: 'muller',
            domain: ['A', 'B', 'C', 'D', 'E', 'F'],
            range: [
              '#1f77b4',
              '#ff7f0e',
              '#2ca02c',
              '#d62728',
              '#9467bd',
              '#8c564b',
            ],
            labels: [
              'A (mel X)',
              'B (mel 2L)',
              'C (mel 2R)',
              'D (mel 3L)',
              'E (mel 3R)',
              'F (mel 4)',
            ],
            title: 'Muller element',
          },
          hideUnlabelled: true,
          autoDiagonalize: false,
          collapseEmptyRows: true,
          drawCurves: true,
          opacity: 0.5,
          showOffscreenMates: false,
          fadeThinAlignmentsMode: 'off',
          levelHeights: ROWS.slice(1).map(() => 100),
        },
      ],
    }),
    readySelector: displayPainted('synteny_canvas'),
    readyTimeout: 240000,
    viewportWidth: 1900,
    viewportHeight: 680,
    // No session setting closes the legend or a row's zoom controls. Hidden
    // rather than clicked closed, since a click focuses the view and restyles
    // its header.
    hideSelectors: [
      '[data-testid="floating-legend"]',
      '[data-testid="lgv-mini-controls"]',
    ],
  },
]
