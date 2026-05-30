import { lgvSnapshotTest } from '../suiteHelpers.ts'

import type { TestSuite } from '../types.ts'

const suite: TestSuite = {
  name: 'Variants Track',
  tests: [
    lgvSnapshotTest({
      name: 'assembly aliases VCF track',
      snapshot: 'variants-assembly-aliases',
      loc: 'ctgA:1..50,001',
      tracks: ['volvox_filtered_vcf_assembly_alias'],
    }),
  ],
}

export default suite
