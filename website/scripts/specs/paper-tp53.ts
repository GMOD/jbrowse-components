// The JBrowse 2 v5 paper's TP53 panel: the T2T apes Cactus alignment across
// chr17p13, sized to sit in one row beside paper/drosophila_blocks.
import { displaySettled } from '@jbrowse/browser-test-utils'

import { sessionSpec } from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

export const paperTp53Specs: ScreenshotSpec[] = [
  {
    mode: 'url',
    name: 'paper/tp53_cactus',
    url: sessionSpec('https://jbrowse.org/demos/t2t_apes_cactus/config.json', {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: 'chr17:7,400,000-7,700,000',
          tracks: [
            {
              trackId: 't2t_apes_cactus',
              height: 640,
              ribbons: { encoding: { color: 'strand' } },
              labels: { lanes: { placement: 'overlay' } },
            },
          ],
        },
      ],
    }),
    readySelector: displaySettled('multiway-synteny-display'),
    readyTimeout: 240000,
    viewportWidth: 1100,
    viewportHeight: 880,
    hideSelectors: ['[data-testid="floating-legend"]'],
  },
]
