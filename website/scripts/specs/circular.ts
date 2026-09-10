import { displayPainted } from '@jbrowse/browser-test-utils'

import { sessionSpec } from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

const DEMO = 'test_data/config_demo.json'

export const circularSpecs: ScreenshotSpec[] = [
  // SKBR3 on hg19: the sample's long-read coverage as a ring around the
  // ideogram, its Sniffles translocations as chords through the middle. The
  // ring is the wiggle display's own strip wrapped around the circle, so the
  // copy-number steps read where the chords land.
  {
    mode: 'url',
    name: 'circular_view/coverage_ring_chords',
    url: sessionSpec(DEMO, {
      views: [
        {
          type: 'CircularView',
          assembly: 'hg19',
          height: 780,
          tracks: [
            {
              trackId: 'ngmlr_cov',
              type: 'LinearWiggleDisplay',
              scaleType: 'log',
              height: 80,
            },
            'breast_cancer_sniffles_hg19_traonly_tabix',
          ],
        },
      ],
    }),
    readySelector: displayPainted('circular-ring-canvas'),
    readyTimeout: 120000,
    settleMs: 10000,
    viewportWidth: 1000,
    viewportHeight: 900,
  },
]
