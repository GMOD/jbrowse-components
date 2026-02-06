import {
  PORT,
  delay,
  findByTestId,
  waitForLoadingToComplete,
} from '../helpers.ts'
import { snapshot } from '../snapshot.ts'

import type { TestSuite } from '../types.ts'

const suite: TestSuite = {
  name: 'Dotplot View',
  tests: [
    {
      name: 'dotplot default session',
      fn: async page => {
        await page.goto(
          `http://localhost:${PORT}/?config=test_data/config_dotplot.json&sessionName=Test%20Session`,
          { waitUntil: 'networkidle0', timeout: 60000 },
        )

        await findByTestId(page, 'prerendered_canvas_done', 60000)
        await waitForLoadingToComplete(page)
        await delay(1000)
        await snapshot(page, 'dotplot-default')
      },
    },
  ],
}

export default suite
