import { lgvSnapshotTest } from '../suiteHelpers.ts'

import type { TestSuite } from '../types.ts'

const suite: TestSuite = {
  name: 'GWAS Tracks',
  tests: [
    lgvSnapshotTest({
      name: 'Manhattan plot renders',
      snapshot: 'gwas-manhattan',
      loc: 'ctgA:1-50000',
      tracks: ['volvox_gwas'],
      doneTestId: 'manhattan-gpu-done',
    }),
  ],
}

export default suite
