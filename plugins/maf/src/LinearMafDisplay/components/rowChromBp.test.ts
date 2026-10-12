import { emptyMafCoverage } from './coverageTestFixture.ts'
import { rowChromBp } from './rowChromBp.ts'

import type {
  MafAlignedRow,
  MafRegionData,
} from '../../LinearMafRenderer/mafRenderingBackendTypes.ts'

function region(
  blocks: { startBp: number; endBp: number; rows: Partial<MafAlignedRow>[] }[],
): MafRegionData {
  return {
    blocks: blocks.map(b => ({
      ...b,
      refSeqBytes: new Uint8Array(),
      rows: b.rows.map(r => ({
        rowIndex: 0,
        alignmentBytes: new Uint8Array(),
        ...r,
      })),
      empties: [],
    })),
    coverage: emptyMafCoverage(0),
  }
}

test('sums each strand per row and chromosome across regions', () => {
  const a = region([
    { startBp: 0, endBp: 30, rows: [{ chr: 'chrA', strand: 1 }] },
    { startBp: 30, endBp: 40, rows: [{ chr: 'chrA', strand: -1 }] },
  ])
  const b = region([
    {
      startBp: 100,
      endBp: 105,
      rows: [
        { chr: 'chrA', strand: -1 },
        { rowIndex: 1, chr: 'chrB' },
        { rowIndex: 2, strand: 1 },
      ],
    },
  ])
  const totals = rowChromBp([a, b])
  expect(totals.get(0)?.get('chrA')).toEqual({ fwd: 30, rev: 15 })
  expect(totals.get(1)?.get('chrB')).toEqual({ fwd: 5, rev: 0 })
  expect(totals.has(2)).toBe(false)
})

test('a cached region contributes afresh to every total', () => {
  const a = region([
    { startBp: 0, endBp: 10, rows: [{ chr: 'chrA', strand: 1 }] },
  ])
  expect(rowChromBp([a]).get(0)?.get('chrA')).toEqual({ fwd: 10, rev: 0 })
  expect(rowChromBp([a, a]).get(0)?.get('chrA')).toEqual({ fwd: 20, rev: 0 })
  expect(rowChromBp([a]).get(0)?.get('chrA')).toEqual({ fwd: 10, rev: 0 })
})
