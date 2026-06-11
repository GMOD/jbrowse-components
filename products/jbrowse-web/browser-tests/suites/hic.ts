import { viewSnapshotTest } from '../suiteHelpers.ts'

import type { TestSuite } from '../types.ts'

const suite: TestSuite = {
  name: 'HiC Track',
  tests: [
    viewSnapshotTest({
      name: 'HiC rendering',
      snapshot: 'hic-rendering',
      config: 'extra_test_data/hic_integration_test.json',
      view: {
        type: 'LinearGenomeView',
        assembly: 'hg19',
        loc: 'chr1:1..10,000,000',
        tracks: ['hic_test'],
      },
      waitTestId: 'hic-display-done',
      snapshotSelector: '[data-testid="hic_canvas"]',
    }),
  ],
}

export default suite
