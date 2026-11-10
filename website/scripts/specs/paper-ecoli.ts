// The JBrowse 2 v5 paper's two E. coli figures and its composed synteny figure,
// which the paper repo syncs from figures.lock: tutorial figures set shorter
// for the page.
import { displayPainted, displaySettled } from '@jbrowse/browser-test-utils'

import { sessionSpec } from '../screenshot-spec-helpers.ts'
import { partLabel } from './paper-sv.ts'
import { ecoliOneVsAllUrl } from './synteny.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// Copies of the two E. coli demos as the paper's figures read them, so a
// rebuilt demo cannot change a published figure
const FROZEN = 'https://jbrowse.org/demos/jb2v5_paper'

export const paperEcoliSpecs: ScreenshotSpec[] = [
  {
    mode: 'url',
    name: 'paper/ecoli_oantigen',
    url: sessionSpec(`${FROZEN}/ecoli_orthologs/config.json`, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'MG1655',
          loc: 'NC_000913.3:2,095,000-2,115,000',
          tracks: [
            {
              trackId: 'ecoli_orthologs',
              height: 968,
              labels: { lanes: { placement: 'overlay' } },
              ribbons: { encoding: { color: { value: 'grey' } } },
            },
          ],
        },
      ],
    }),
    readySelector: displaySettled('multiway-synteny-display'),
    readyTimeout: 240000,
    viewportWidth: 1125,
    viewportHeight: 1208,
  },
  {
    mode: 'url',
    name: 'paper/ecoli_synteny',
    url: ecoliOneVsAllUrl(36, {
      firstLevelHeight: 60,
      rowsTrackHeight: 86,
      config: `${FROZEN}/ecoli_pangenome/config.json`,
    }),
    viewportWidth: 870,
    viewportHeight: 492,
    readySelector: displayPainted('synteny_canvas'),
    readyTimeout: 120000,
    hideSelectors: [
      'header.MuiAppBar-root',
      '[data-testid="lgv-mini-controls"]',
    ],
  },
  {
    mode: 'compose',
    name: 'paper/synteny_views',
    parts: ['paper/drosophila_blocks', 'paper/ecoli_synteny'],
    gutter: 16,
    // room for the part letters
    sideMargin: 60,
    annotations: [partLabel(0, 'a'), partLabel(1, 'b')],
  },
]
