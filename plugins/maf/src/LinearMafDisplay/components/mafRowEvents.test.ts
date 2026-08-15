import { emptyMafCoverage } from './coverageTestFixture.ts'
import {
  MafRowEventIndex,
  regionInsertionEvents,
  regionInversionEvents,
} from './mafRowEvents.ts'

import type { MafRegionData } from '../../LinearMafRenderer/mafRenderingBackendTypes.ts'
import type { StrandConsensus } from './computeVisibleInversions.ts'

const enc = new TextEncoder()

function block(startBp: number, refSeq: string, alignments: string[]) {
  return {
    startBp,
    endBp: startBp + refSeq.replaceAll('-', '').length,
    refSeqBytes: enc.encode(refSeq),
    rows: alignments.map((alignment, rowIndex) => ({
      rowIndex,
      alignmentBytes: enc.encode(alignment),
    })),
    empties: [],
  }
}

function region(blocks: ReturnType<typeof block>[]): MafRegionData {
  return { blocks, coverage: emptyMafCoverage(100) }
}

function events(index: MafRowEventIndex, blockIndex: number) {
  const { from, to } = index.ensure(blockIndex)
  const out: [number, number, number][] = []
  for (let e = from; e < to; e++) {
    out.push([index.positionBp[e]!, index.rowIndex[e]!, index.length[e]!])
  }
  return out
}

test('a block is walked once, however many times it is asked for', () => {
  let walks = 0
  const index = new MafRowEventIndex(
    [block(0, 'AA', ['AA']), block(2, 'AA', ['AA'])],
    (b, _i, push) => {
      walks++
      push(b.startBp, 0, 1)
    },
  )
  index.ensure(0)
  index.ensure(0)
  expect(walks).toBe(1)
  index.ensure(1)
  expect(walks).toBe(2)
})

// The bp cull admits blocks in whatever order the view reaches them, so the
// per-block range is where a block landed in the columns, not its position in
// `blocks`.
test('ranges follow fill order, not block order', () => {
  const index = new MafRowEventIndex(
    [block(0, 'AA', ['AA']), block(2, 'AA', ['AA'])],
    (b, _i, push) => {
      push(b.startBp, 0, 1)
      push(b.startBp, 1, 1)
    },
  )
  expect(index.ensure(1)).toEqual({ from: 0, to: 2 })
  expect(index.ensure(0)).toEqual({ from: 2, to: 4 })
  expect(events(index, 1)).toEqual([
    [2, 0, 1],
    [2, 1, 1],
  ])
})

// The columns are replaced wholesale when they grow, so a caller that
// destructured them before `ensure` would read a stale, short array.
test('the columns survive growth past their initial capacity', () => {
  const count = 5000
  const index = new MafRowEventIndex([block(0, 'A', ['A'])], (_b, _i, push) => {
    for (let i = 0; i < count; i++) {
      push(i, i % 7, i + 1)
    }
  })
  const { from, to } = index.ensure(0)
  expect(to - from).toBe(count)
  expect(index.positionBp[count - 1]).toBe(count - 1)
  expect(index.length[count - 1]).toBe(count)
})

test('insertion events carry anchor, row and inserted length', () => {
  // ref A--A: a 2bp insertion anchored before reference bp 101
  const index = regionInsertionEvents(
    region([block(100, 'A--A', ['AGGA', 'A--A'])]),
  )
  expect(events(index, 0)).toEqual([[101, 0, 2]])
})

test('a region gets one index across calls', () => {
  const data = region([block(100, 'A--A', ['AGGA'])])
  expect(regionInsertionEvents(data)).toBe(regionInsertionEvents(data))
})

// `consensusStrandByRowChr` is scored across every loaded region, so a region
// landing elsewhere can flip which of this one's blocks read as inverted — the
// index has to belong to the consensus that built it.
test('inversion events are keyed by consensus as well as region', () => {
  const rows = [{ rowIndex: 0, chr: 'chr1', strand: -1 }]
  const data = region([{ ...block(100, 'AAAA', ['AAAA']), rows }])
  const forward: StrandConsensus = new Map([[0, new Map([['chr1', 1]])]])
  const reverse: StrandConsensus = new Map([[0, new Map([['chr1', -1]])]])

  expect(events(regionInversionEvents(data, forward), 0)).toEqual([[100, 0, 4]])
  expect(events(regionInversionEvents(data, reverse), 0)).toEqual([])
  expect(regionInversionEvents(data, forward)).not.toBe(
    regionInversionEvents(data, reverse),
  )
})
