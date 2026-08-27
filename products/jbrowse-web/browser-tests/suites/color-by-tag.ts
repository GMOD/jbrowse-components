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
      displayTestId: 'pileup-display',
    }),
    lgvSnapshotTest({
      name: 'color by mapping quality',
      snapshot: 'color-by-mapping-quality',
      loc: 'ctgA:1000-2000',
      tracks: [colorByTrack({ type: 'mappingQuality' })],
      displayTestId: 'pileup-display',
    }),
    lgvSnapshotTest({
      name: 'color by insert size and orientation',
      snapshot: 'color-by-insert-size-orientation',
      // volvox_sv has discordant pairs (SVs) that produce non-default colors
      loc: 'ctgA:2,707..48,600',
      tracks: [colorByTrack({ type: 'insertSizeAndOrientation' }, 'volvox_sv')],
      displayTestId: 'pileup-display',
    }),
    lgvSnapshotTest({
      name: 'color by HP tag renders colored reads',
      snapshot: 'color-by-tag-hp',
      loc: 'ctgA:39,800..40,000',
      tracks: [colorByTrack({ type: 'tag', tag: 'HP' })],
      displayTestId: 'pileup-display',
    }),
    // Whole-contig, not the 1kb the scenes above use: `subPixelBinBp` returns 1
    // below 4 bp/px, so a per-base scene at that zoom passes under any change to
    // the bin. agent-docs/reference/PER_BASE_SUBPIXEL_BIN.md.
    lgvSnapshotTest({
      name: 'color by per-base quality at a binned zoom',
      snapshot: 'color-by-per-base-quality-binned',
      loc: 'ctgA:1..48,000',
      tracks: [colorByTrack({ type: 'perBaseQuality' })],
      displayTestId: 'pileup-display',
    }),
    lgvSnapshotTest({
      name: 'color by per-base letter at a binned zoom',
      snapshot: 'color-by-per-base-letter-binned',
      loc: 'ctgA:1..48,000',
      tracks: [colorByTrack({ type: 'perBaseLetter' })],
      displayTestId: 'pileup-display',
    }),
  ],
}

export default suite
