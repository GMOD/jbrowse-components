import { PORT, delay, waitForLoadingToComplete } from '../helpers.ts'
import { snapshot } from '../snapshot.ts'

import type { TestSuite } from '../types.ts'

const suite: TestSuite = {
  name: 'Custom URL Loading',
  tests: [
    {
      name: 'loads specific config and snapshots',
      fn: async page => {
        const url = `http://localhost:${PORT}/?config=test_data%2Fconfig_demo.json&session=share-XyL52LPDoO&password=861E4`
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 })
        await waitForLoadingToComplete(page)
        await delay(1000)
        await snapshot(page, 'methylation_snapshot')
      },
    },
    {
      name: 'loads specific config and snapshots (breakpoint split view)',
      fn: async page => {
        const url = `http://localhost:${PORT}/?config=test_data%2Fconfig_demo.json&session=share-pjaAq1hNxB&password=Z9teR`
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 })
        await waitForLoadingToComplete(page)
        await delay(1000)
        await snapshot(page, 'breakpoint_split_view_snapshot')
      },
    },
  ],
}

export default suite
