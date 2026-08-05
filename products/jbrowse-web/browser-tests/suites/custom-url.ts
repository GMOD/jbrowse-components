import { navigateToUrl, waitForLoadingToComplete } from '../helpers.ts'
import { pageSnapshot } from '../snapshot.ts'

import type { TestSuite } from '../types.ts'

// `session=share-…` is resolved by fetching https://share.jbrowse.org/api/v1/load
// (DEFAULT_SHARE_URL), so both tests below depend on a live third-party service
// — the same category as the grape/peach and hs1/mm39 suites, and marked the
// same way. Without the flag they ran in every default local sweep, which meant
// a share-server hiccup surfaced as a snapshot failure in a suite that reads as
// entirely local. Run them with `--include-remote`, `--smoke`, or any `--filter`.
const suite: TestSuite = {
  name: 'Custom URL Loading',
  requiresRemote: true,
  tests: [
    {
      name: 'loads specific config and snapshots',
      requiresRemote: true,
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
      requiresRemote: true,
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
