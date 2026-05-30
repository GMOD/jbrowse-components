import { lgvSnapshotTest } from '../suiteHelpers.ts'

import type { TestSuite } from '../types.ts'

function gcContentTrack(extra: Record<string, unknown>) {
  return {
    trackId: 'volvox_gc',
    displaySnapshot: {
      type: 'LinearGCContentTrackDisplay',
      windowSize: 500,
      windowDelta: 500,
      ...extra,
    },
  }
}

// All views here are also asserted by the golden snapshot of the same canvas
// (the content-gate in canvasSnapshot fails a blank/empty render), so the
// goldens lock in the rendered colors — no bespoke pixel-sniffing needed.
const suite: TestSuite = {
  name: 'BigWig Tracks',
  tests: [
    lgvSnapshotTest({
      name: 'GC content track',
      snapshot: 'bigwig-gc-content',
      loc: 'ctgA:1-30000',
      tracks: [gcContentTrack({})],
      doneTestId: 'wiggle-display-done',
    }),
    lgvSnapshotTest({
      name: 'GC skew track',
      snapshot: 'bigwig-gc-skew',
      loc: 'ctgA:1-30000',
      tracks: [gcContentTrack({ gcMode: 'skew' })],
      doneTestId: 'wiggle-display-done',
    }),
    lgvSnapshotTest({
      name: 'MultiBigWig xyplot',
      snapshot: 'bigwig-multibigwig-xyplot',
      loc: 'ctgA:1-4000',
      tracks: ['volvox_microarray_multi'],
      doneTestId: 'multi-wiggle-display-done',
    }),
    lgvSnapshotTest({
      name: 'MultiBigWig multirowxy',
      snapshot: 'bigwig-multibigwig-multirowxy',
      loc: 'ctgA:1-4000',
      tracks: ['volvox_microarray_multi_multirowxy'],
      doneTestId: 'multi-wiggle-display-done',
    }),
    lgvSnapshotTest({
      name: 'MultiBigWig multirowdensity',
      snapshot: 'bigwig-multibigwig-multirowdensity',
      loc: 'ctgA:1-4000',
      tracks: ['volvox_microarray_multi_multirowdensity'],
      doneTestId: 'multi-wiggle-display-done',
    }),
    lgvSnapshotTest({
      name: 'MultiBigWig multirowline',
      snapshot: 'bigwig-multibigwig-multirowline',
      loc: 'ctgA:1-4000',
      tracks: ['volvox_microarray_multi_multirowline'],
      doneTestId: 'multi-wiggle-display-done',
    }),
  ],
}

export default suite
