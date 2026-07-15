import { navigateToUrl, waitForDataLoaded } from '../helpers.ts'
import { dualSnapshot } from '../snapshot.ts'

import type { TestSuite } from '../types.ts'

const suite: TestSuite = {
  name: 'Dotplot View',
  tests: [
    {
      name: 'dotplot default session',
      fn: async page => {
        await navigateToUrl(
          page,
          'config=test_data/config_dotplot.json&sessionName=Test%20Session',
        )

        await page.waitForSelector(
          '[data-testid="dotplot_webgl_canvas_done"]',
          {
            timeout: 60000,
          },
        )
        await waitForDataLoaded(page)
        await dualSnapshot(
          page,
          'dotplot-default-canvas',
          '[data-testid="dotplot_webgl_canvas_done"]',
        )
      },
    },
  ],
}

export default suite
