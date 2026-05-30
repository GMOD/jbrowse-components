import { lgvSnapshotTest } from '../suiteHelpers.ts'

import type { TestSuite } from '../types.ts'

const suite: TestSuite = {
  name: 'Session Spec URL Parameters',
  tests: [
    lgvSnapshotTest({
      name: 'displaySnapshot type opens alignments track',
      snapshot: 'session-spec-display-snapshot',
      loc: 'ctgA:1-10000',
      tracks: ['volvox_sv_cram'],
      doneTestId: 'pileup-display-done',
    }),
    lgvSnapshotTest({
      name: 'jexl',
      snapshot: 'session-spec-jexl',
      loc: 'ctgA:2,707..8,600',
      tracks: ['volvox_test_vcf_jexl'],
    }),
  ],
}

export default suite
