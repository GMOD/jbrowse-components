import {
  findByTestId,
  navigateWithSessionSpec,
  waitForCanvasRendered,
  waitForDataLoaded,
} from '../helpers.ts'
import { canvasSnapshot, pageSnapshot } from '../snapshot.ts'

import type { TestSuite } from '../types.ts'

const grapePeachConfig = 'test_data/grape_peach_synteny/config.json'

const suite: TestSuite = {
  name: 'Grape vs Peach Synteny',
  requiresRemote: true,
  tests: [
    {
      name: 'renders whole-genome synteny overview (minimap2 PAF)',
      fn: async page => {
        await navigateWithSessionSpec(
          page,
          {
            views: [
              {
                type: 'LinearSyntenyView',
                tracks: ['peach_grape_minimap2'],
                views: [
                  {
                    assembly: 'grape',
                  },
                  {
                    assembly: 'peach',
                  },
                ],
              },
            ],
          },
          grapePeachConfig,
        )

        await findByTestId(page, 'synteny_canvas', 120000)
        await waitForDataLoaded(page, 120000)
        await waitForCanvasRendered(
          page,
          '[data-testid="synteny_canvas"]',
          120000,
        )
        await canvasSnapshot(
          page,
          'grape-peach-synteny-overview-canvas',
          '[data-testid="synteny_canvas"]',
        )
      },
    },
    {
      name: 'full page screenshot of grape vs peach synteny',
      fn: async page => {
        await navigateWithSessionSpec(
          page,
          {
            views: [
              {
                type: 'LinearSyntenyView',
                tracks: ['peach_grape_minimap2'],
                views: [
                  {
                    assembly: 'grape',
                  },
                  {
                    assembly: 'peach',
                  },
                ],
              },
            ],
          },
          grapePeachConfig,
        )

        await findByTestId(page, 'synteny_canvas', 120000)
        await waitForDataLoaded(page, 120000)
        await waitForCanvasRendered(
          page,
          '[data-testid="synteny_canvas"]',
          120000,
        )
        await pageSnapshot(page, 'grape-peach-synteny-fullpage')
      },
    },
  ],
}

export default suite
