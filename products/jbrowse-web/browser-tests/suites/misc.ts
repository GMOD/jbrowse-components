import {
  navigateToUrl,
  waitForDataLoaded,
  waitForDisplayPaint,
} from '../helpers.ts'
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
      displayTestId: 'pileup-display',
    }),
    {
      name: 'NCBI alias adapter',
      fn: async page => {
        await navigateToUrl(
          page,
          'config=test_data/cfam2/config.json&sessionName=Test%20Session',
        )

        await waitForDisplayPaint(
          page,
          '[data-display-drawn="true"] canvas',
          60000,
        )
        await waitForDataLoaded(page)
        await dualSnapshot(
          page,
          'misc-ncbi-alias-canvas',
          '[data-display-drawn="true"] canvas',
        )
      },
    },
    lgvSnapshotTest({
      name: 'GFF3 track rendering',
      snapshot: 'misc-gff3-track',
      loc: 'ctgA:907..15,319',
      tracks: ['gff3tabix_genes'],
    }),
    lgvSnapshotTest({
      name: 'Multi-row painting in per-feature colour',
      snapshot: 'misc-multirow-painting',
      loc: 'ctgA:1..50,000',
      tracks: ['volvox_mouse_inheritance_painting'],
      displayTestId: 'multirow-display',
    }),
    lgvSnapshotTest({
      name: 'Multi-row painting with a declared order, row colours and groups',
      snapshot: 'misc-multirow-arranged',
      loc: 'ctgA:1..50,000',
      tracks: ['volvox_mouse_inheritance_rows'],
      displayTestId: 'multirow-display',
    }),
  ],
}

export default suite
