import { makePileupDataResult } from '../../RenderAlignmentDataRPC/testPileupData.ts'
import {
  GAP_DELETION,
  GAP_SKIP,
} from '../../shaders/slang/gap.consts.generated.ts'
import { junctionSupportingReadSlots } from './supportingReads.ts'

function region(gaps: [number, number, number, number][]) {
  return makePileupDataResult({
    gapPositions: new Uint32Array(gaps.flatMap(([s, e]) => [s, e])),
    gapTypes: new Uint8Array(gaps.map(([, , t]) => t)),
    gapReadIndices: new Uint32Array(gaps.map(([, , , r]) => r)),
  })
}

const JUNCTION = {
  groupKey: 'g',
  refName: 'chr1',
  start: 100,
  end: 500,
  split: undefined,
}
const slot = (displayedRegionIndex: number, idx: number) => ({
  displayedRegionIndex,
  groupKey: 'g',
  idx,
})

test('finds the reads whose skip gap is exactly the junction', () => {
  const data = region([
    [100, 500, GAP_SKIP, 0],
    [100, 501, GAP_SKIP, 1],
    [100, 500, GAP_DELETION, 2],
    [100, 500, GAP_SKIP, 3],
  ])
  expect(
    junctionSupportingReadSlots(
      [{ displayedRegionIndex: 0, refName: 'chr1', data }],
      JUNCTION,
    ),
  ).toEqual([slot(0, 0), slot(0, 3)])
})

test('finds a read in every region of its refName, and in no other', () => {
  const data = region([[100, 500, GAP_SKIP, 0]])
  expect(
    junctionSupportingReadSlots(
      [
        { displayedRegionIndex: 0, refName: 'chr1', data },
        { displayedRegionIndex: 1, refName: 'chr1', data },
        {
          displayedRegionIndex: 2,
          refName: 'chr2',
          data: region([[100, 500, GAP_SKIP, 1]]),
        },
        {
          displayedRegionIndex: 3,
          refName: undefined,
          data: region([[100, 500, GAP_SKIP, 2]]),
        },
      ],
      JUNCTION,
    ),
  ).toEqual([slot(0, 0), slot(1, 0)])
})

test('a split junction lights the reads whose segments join across it', () => {
  const data = makePileupDataResult({
    readPositions: new Uint32Array([
      33286412, 33286470, 33287468, 33287511, 1000, 1058, 33286412, 33286470,
    ]),
    readStrands: new Int8Array([1, 1, 1, 1]),
    readFlags: new Uint16Array([0, 0x800, 0, 0x100]),
    readClipAtStart: new Uint32Array([43, 0, 0, 43]),
    readSuppAlignments: [
      '11,33287469,+,43M58S,255,0;',
      '11,33286413,+,43S58M,255,0;',
      '11,5001,+,58S43M,255,0;',
      '11,33287469,+,43M58S,255,0;',
    ],
  })
  expect(
    junctionSupportingReadSlots(
      [{ displayedRegionIndex: 0, refName: 'chr11', data }],
      {
        groupKey: 'g',
        refName: 'chr11',
        start: 33286412,
        end: 33287511,
        split: 'splitBack',
      },
      refName => `chr${refName}`,
    ),
  ).toEqual([slot(0, 0), slot(0, 1)])
})
