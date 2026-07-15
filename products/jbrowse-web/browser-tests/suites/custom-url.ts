import { navigateToUrl, waitForLoadingToComplete } from '../helpers.ts'
import { pageSnapshot } from '../snapshot.ts'

import type { TestSuite } from '../types.ts'

const suite: TestSuite = {
  name: 'Custom URL Loading',
  tests: [
    {
      name: 'loads specific config and snapshots',
      fn: async page => {
        await navigateToUrl(
          page,
          'config=test_data%2Fconfig_demo.json&session=share-XyL52LPDoO&password=861E4',
        )
        await waitForLoadingToComplete(page)
        await pageSnapshot(page, 'methylation_snapshot')
      },
    },
    {
      name: 'loads specific config and snapshots (breakpoint split view)',
      fn: async page => {
        await navigateToUrl(
          page,
          'config=test_data%2Fconfig_demo.json&session=share-pjaAq1hNxB&password=Z9teR',
        )
        await waitForLoadingToComplete(page)
        await pageSnapshot(page, 'breakpoint_split_view_snapshot')
      },
    },
  ],
}

export default suite
