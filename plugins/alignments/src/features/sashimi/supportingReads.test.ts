import { makePileupDataResult } from '../../RenderAlignmentDataRPC/testPileupData.ts'
import {
  GAP_DELETION,
  GAP_SKIP,
} from '../../shaders/slang/gap.consts.generated.ts'
import { junctionSupportingReadIds } from './supportingReads.ts'

function region(gaps: [number, number, number, number][]) {
  return makePileupDataResult({
    readKeys: ['a', 'b', 'c', 'd'],
    gapPositions: new Uint32Array(gaps.flatMap(([s, e]) => [s, e])),
    gapTypes: new Uint8Array(gaps.map(([, , t]) => t)),
    gapReadIndices: new Uint32Array(gaps.map(([, , , r]) => r)),
  })
}

const JUNCTION = { refName: 'chr1', start: 100, end: 500 }

test('names the reads whose skip gap is exactly the junction', () => {
  const data = region([
    [100, 500, GAP_SKIP, 0],
    [100, 501, GAP_SKIP, 1],
    [100, 500, GAP_DELETION, 2],
    [100, 500, GAP_SKIP, 3],
  ])
  expect(
    junctionSupportingReadIds([{ refName: 'chr1', data }], JUNCTION),
  ).toEqual(['a', 'd'])
})

test('names a read once across regions, and ignores other refNames', () => {
  const data = region([[100, 500, GAP_SKIP, 0]])
  expect(
    junctionSupportingReadIds(
      [
        { refName: 'chr1', data },
        { refName: 'chr1', data },
        { refName: 'chr2', data: region([[100, 500, GAP_SKIP, 1]]) },
        { refName: undefined, data: region([[100, 500, GAP_SKIP, 2]]) },
      ],
      JUNCTION,
    ),
  ).toEqual(['a'])
})
