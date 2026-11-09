// The JBrowse 2 v5 paper's two E. coli figures, which the paper repo syncs from
// figures.lock: tutorial figures set shorter for the page.
import { displayPainted, displaySettled } from '@jbrowse/browser-test-utils'

import { sessionSpec } from '../screenshot-spec-helpers.ts'
import { ecoliOneVsAllUrl } from './synteny.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

export const paperEcoliSpecs: ScreenshotSpec[] = [
  {
    mode: 'url',
    name: 'paper/ecoli_oantigen',
    url: sessionSpec('https://jbrowse.org/demos/ecoli_orthologs/config.json', {
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
    url: ecoliOneVsAllUrl(36, { firstLevelHeight: 60, rowsTrackHeight: 86 }),
    viewportWidth: 930,
    viewportHeight: 540,
    readySelector: displayPainted('synteny_canvas'),
    readyTimeout: 120000,
  },
]
