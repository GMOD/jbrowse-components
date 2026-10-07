// The JBrowse 2 v5 paper's 44-genome figure, which the paper repo syncs from
// figures.lock: the tutorial's O-antigen stack with each genome's name on its
// gene row, at the 22 px a lane then needs with gene names.
import { displaySettled } from '@jbrowse/browser-test-utils'

import { sessionSpec } from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

export const paperEcoliSpecs: ScreenshotSpec[] = [
  {
    mode: 'url',
    name: 'paper/ecoli_oantigen',
    url: sessionSpec(
      encodeURIComponent(
        'https://jbrowse.org/demos/ecoli_orthologs/config.json',
      ),
      {
        views: [
          {
            type: 'LinearGenomeView',
            assembly: 'MG1655',
            loc: 'NC_000913.3:2,095,000-2,115,000',
            tracks: [
              {
                trackId: 'ecoli_orthologs',
                type: 'MultiWaySyntenyDisplay',
                height: 968,
                inlineLaneNames: true,
              },
            ],
          },
        ],
      },
    ),
    readySelector: displaySettled('multiway-synteny-display'),
    readyTimeout: 240000,
    viewportHeight: 1208,
  },
]
