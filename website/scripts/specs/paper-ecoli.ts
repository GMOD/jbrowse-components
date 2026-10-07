// The JBrowse 2 v5 paper's two E. coli figures, which the paper repo syncs from
// figures.lock. Both are tutorial figures set shorter for the page: the
// 44-genome O-antigen stack with each genome's name on its gene row, and the
// five-strain view with 60 px ribbon bands.
import { displayPainted, displaySettled } from '@jbrowse/browser-test-utils'

import { sessionSpec } from '../screenshot-spec-helpers.ts'
import { ecoliOneVsAllUrl } from './synteny.ts'

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
  {
    mode: 'url',
    name: 'paper/ecoli_synteny',
    url: ecoliOneVsAllUrl(60),
    viewportHeight: 650,
    readySelector: displayPainted('synteny_canvas'),
    readyTimeout: 120000,
  },
]
