import {
  PORT,
  delay,
  findByTestId,
  openTrack,
  waitForLoadingToComplete,
} from '../helpers.ts'
import { canvasSnapshot } from '../snapshot.ts'

import type { TestSuite } from '../types.ts'

const suite: TestSuite = {
  name: 'HiC Track',
  tests: [
    {
      name: 'HiC rendering',
      fn: async page => {
        await page.goto(
          `http://localhost:${PORT}/?config=extra_test_data/hic_integration_test.json&sessionName=Test%20Session`,
          { waitUntil: 'networkidle0', timeout: 60000 },
        )

        await openTrack(page, 'hic_test')
        await findByTestId(page, 'hic_canvas_done', 60000)
        await waitForLoadingToComplete(page)
        await delay(1000)
        await canvasSnapshot(
          page,
          'hic-rendering-canvas',
          '[data-testid="hic_canvas_done"]',
        )
      },
    },
  ],
}

export default suite
