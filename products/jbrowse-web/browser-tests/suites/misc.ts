import { navigateToUrl, waitForDataLoaded } from '../helpers.ts'
import { dualSnapshot } from '../snapshot.ts'
import { lgvSnapshotTest } from '../suiteHelpers.ts'

import type { TestSuite } from '../types.ts'

const suite: TestSuite = {
  name: 'Miscellaneous Tracks',
  tests: [
    lgvSnapshotTest({
      name: 'SNP coverage rendering',
      snapshot: 'misc-snpcoverage',
      loc: 'ctgA:13,010..13,610',
      tracks: ['volvox_alignments_pileup_coverage'],
      doneTestId: 'pileup-display-done',
    }),
    {
      name: 'NCBI alias adapter',
      fn: async page => {
        await navigateToUrl(
          page,
          'config=test_data/cfam2/config.json&sessionName=Test%20Session',
        )

        await page.waitForSelector('[data-testid$="-done"] canvas', {
          timeout: 60000,
        })
        await waitForDataLoaded(page)
        await dualSnapshot(
          page,
          'misc-ncbi-alias-canvas',
          '[data-testid$="-done"] canvas',
        )
      },
    },
    lgvSnapshotTest({
      name: 'GFF3 track rendering',
      snapshot: 'misc-gff3-track',
      loc: 'ctgA:907..15,319',
      tracks: ['gff3tabix_genes'],
    }),
  ],
}

export default suite
