import { EMPTY_MAF_CELLS } from '../LinearMafRenderer/mafChannels.ts'
import { encodeSummarySpans } from './components/summarySpans.ts'
import { createRowsSourceJoin, cullMafRows } from './encodeMafRows.ts'

import type { MafRegionData } from '../LinearMafRenderer/mafRenderingBackendTypes.ts'
import type { MafSummaryRecord } from '../types.ts'

const rec = (src: string, start: number, end: number): MafSummaryRecord => ({
  refName: 'ctgA',
  src,
  start,
  end,
  score: 1,
})

// 1000..2000 across 100px: 10bp a pixel
const BLOCK = {
  displayedRegionIndex: 0,
  start: 1000,
  end: 2000,
  screenStartPx: 0,
  screenEndPx: 100,
  reversed: false,
}

// A vector layer emits a `<rect>` per fill whatever clips it, so the export
// hands the painter only what a block can show.
describe('cullMafRows', () => {
  const records = [
    rec('a', 1100, 1200),
    rec('a', 3000, 3100),
    rec('b', 1500, 1600),
    rec('c', 1500, 1600),
    rec('a', 1985, 2000),
    rec('a', 0, 900),
  ]
  const summary = encodeSummarySpans(
    records,
    new Map([
      ['a', 0],
      ['b', 1],
      ['c', 5],
    ]),
    'black',
  )

  it('keeps the spans a block of the region can show, with their records', () => {
    const culled = cullMafRows(
      { cells: EMPTY_MAF_CELLS, summary },
      [BLOCK],
      100,
      { firstRow: 0, endRow: 2 },
    )
    expect(culled.summary!.records).toEqual([
      records[0],
      records[2],
      records[4],
    ])
    expect([...culled.summary!.row]).toEqual([0, 1, 0])
    expect(culled.summary!.count).toBe(3)
  })

  it('keeps nothing for a region no block shows', () => {
    const culled = cullMafRows({ cells: EMPTY_MAF_CELLS, summary }, [], 100, {
      firstRow: 0,
      endRow: 10,
    })
    expect(culled.summary!.count).toBe(0)
  })
})

describe('createRowsSourceJoin', () => {
  const detail = { blocks: [] } as unknown as MafRegionData
  const summary = [rec('a', 0, 1)]

  it('pairs the two tiers per region and keeps a pair while neither moved', () => {
    const join = createRowsSourceJoin()
    const first = join(
      new Map([[0, detail]]),
      new Map([
        [0, summary],
        [1, summary],
      ]),
    )
    expect(first.get(0)).toEqual({ detail, summary })
    expect(first.get(1)).toEqual({ detail: undefined, summary })

    const second = join(new Map([[0, detail]]), new Map([[1, summary]]))
    expect(second.get(0)).toEqual({ detail, summary: undefined })
    expect(second.get(1)).toBe(first.get(1))
  })
})
