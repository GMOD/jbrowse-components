import { lgvSnapshotTest, viewSnapshotTest } from '../suiteHelpers.ts'

import type { TestCase, TestSuite } from '../types.ts'

function syntenyTest(
  name: string,
  snapshotName: string,
  peachLoc: string,
  grapeLoc: string,
  swapped = false,
): TestCase {
  const views = swapped
    ? [
        { loc: grapeLoc, assembly: 'grape' },
        { loc: peachLoc, assembly: 'peach' },
      ]
    : [
        { loc: peachLoc, assembly: 'peach' },
        { loc: grapeLoc, assembly: 'grape' },
      ]
  return viewSnapshotTest({
    name,
    snapshot: snapshotName,
    config: 'test_data/grape_peach_synteny/config.json',
    view: { type: 'LinearSyntenyView', tracks: ['subset'], views },
    waitTestId: 'synteny_canvas_done',
  })
}

const suite: TestSuite = {
  name: 'Synteny Views',
  tests: [
    syntenyTest(
      'horizontally flipped inverted alignment',
      'synteny-flipped-inverted',
      'Pp01:28,845,211..28,845,272[rev]',
      'chr1:316,306..316,364',
    ),
    syntenyTest(
      'regular orientation inverted alignment',
      'synteny-regular-inverted',
      'Pp01:28,845,211..28,845,272',
      'chr1:316,306..316,364',
    ),
    lgvSnapshotTest({
      name: 'LGV synteny track',
      snapshot: 'synteny-lgv-paf',
      loc: 'ctgA:30,222..33,669',
      tracks: ['volvox_ins.paf'],
    }),
  ],
}

export default suite
