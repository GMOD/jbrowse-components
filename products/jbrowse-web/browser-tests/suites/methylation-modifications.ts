import {
  PORT,
  appendGpuParam,
  findByTestId,
  waitForDataLoaded,
} from '../helpers.ts'
import { canvasSnapshot, pageSnapshot } from '../snapshot.ts'

import type { TestSuite } from '../types.ts'

const suite: TestSuite = {
  name: 'Methylation and Modifications',
  tests: [
    {
      name: 'methylation color-by mode renders',
      fn: async page => {
        await page.goto(
          appendGpuParam(
            `http://localhost:${PORT}/?config=test_data/methylation_test/config.json`,
          ),
          { waitUntil: 'networkidle0', timeout: 60000 },
        )

        await findByTestId(page, 'pileup-display-done', 60000)
        await waitForDataLoaded(page)
        await canvasSnapshot(
          page,
          'methylation-pileup-canvas',
          '[data-testid="pileup-display-done"] canvas',
        )
      },
    },
    {
      name: 'methylation full page screenshot',
      fn: async page => {
        await page.goto(
          appendGpuParam(
            `http://localhost:${PORT}/?config=test_data/methylation_test/config.json`,
          ),
          { waitUntil: 'networkidle0', timeout: 60000 },
        )

        await findByTestId(page, 'pileup-display-done', 60000)
        await waitForDataLoaded(page)
        await pageSnapshot(page, 'methylation-fullpage')
      },
    },
    {
      name: 'modifications color-by mode renders',
      fn: async page => {
        await page.goto(
          appendGpuParam(
            `http://localhost:${PORT}/?config=test_data/modifications_test/config.json`,
          ),
          { waitUntil: 'networkidle0', timeout: 60000 },
        )

        await findByTestId(page, 'pileup-display-done', 60000)
        await waitForDataLoaded(page)
        await canvasSnapshot(
          page,
          'modifications-pileup-canvas',
          '[data-testid="pileup-display-done"] canvas',
        )
      },
    },
    {
      name: 'modifications full page screenshot',
      fn: async page => {
        await page.goto(
          appendGpuParam(
            `http://localhost:${PORT}/?config=test_data/modifications_test/config.json`,
          ),
          { waitUntil: 'networkidle0', timeout: 60000 },
        )

        await findByTestId(page, 'pileup-display-done', 60000)
        await waitForDataLoaded(page)
        await pageSnapshot(page, 'modifications-fullpage')
      },
    },
  ],
}

export default suite
