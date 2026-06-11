import { lgvSnapshotTest } from '../suiteHelpers.ts'

import type { LgvTrack } from '../suiteHelpers.ts'
import type { TestSuite } from '../types.ts'

const colorByTrack = (
  colorBy: Record<string, unknown>,
  trackId = 'volvox_alignments',
): LgvTrack => ({ trackId, displaySnapshot: { colorBy } })

const suite: TestSuite = {
  name: 'Alignments Color Schemes',
  tests: [
    lgvSnapshotTest({
      name: 'color by strand',
      snapshot: 'color-by-strand',
      loc: 'ctgA:1000-2000',
      tracks: [colorByTrack({ type: 'strand' })],
      doneTestId: 'pileup-display-done',
    }),
    lgvSnapshotTest({
      name: 'color by mapping quality',
      snapshot: 'color-by-mapping-quality',
      loc: 'ctgA:1000-2000',
      tracks: [colorByTrack({ type: 'mappingQuality' })],
      doneTestId: 'pileup-display-done',
    }),
    lgvSnapshotTest({
      name: 'color by insert size and orientation',
      snapshot: 'color-by-insert-size-orientation',
      // volvox_sv has discordant pairs (SVs) that produce non-default colors
      loc: 'ctgA:2,707..48,600',
      tracks: [colorByTrack({ type: 'insertSizeAndOrientation' }, 'volvox_sv')],
      doneTestId: 'pileup-display-done',
    }),
    lgvSnapshotTest({
      name: 'color by HP tag renders colored reads',
      snapshot: 'color-by-tag-hp',
      loc: 'ctgA:39,800..40,000',
      tracks: [colorByTrack({ type: 'tag', tag: 'HP' })],
      doneTestId: 'pileup-display-done',
    }),
  ],
}

export default suite
