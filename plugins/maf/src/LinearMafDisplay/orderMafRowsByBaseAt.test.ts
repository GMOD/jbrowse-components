import { emptyMafCoverage } from './components/coverageTestFixture.ts'
import { orderMafRowsByBaseAt } from './orderMafRowsByBaseAt.ts'

import type { MafRegionData } from '../LinearMafRenderer/mafRenderingBackendTypes.ts'

const enc = new TextEncoder()

// Five species over one block at 100-105. Column 102 (the third) reads, per
// row: s0 'G', s1 'g' (soft-masked, the same base), s2 'T', s3 '-' (deletes
// it), s4 'G'. s5 is drawn but has no row in the block.
const ROWS = ['s0', 's1', 's2', 's3', 's4', 's5'].map(name => ({ name }))

function region(): MafRegionData {
  return {
    coverage: emptyMafCoverage(),
    blocks: [
      {
        startBp: 100,
        endBp: 105,
        refSeqBytes: enc.encode('AAAAA'),
        rows: [
          { rowIndex: 0, alignmentBytes: enc.encode('AAGAA') },
          { rowIndex: 1, alignmentBytes: enc.encode('AAgAA') },
          { rowIndex: 2, alignmentBytes: enc.encode('AATAA') },
          { rowIndex: 3, alignmentBytes: enc.encode('AA-AA') },
          { rowIndex: 4, alignmentBytes: enc.encode('AAGAA') },
        ],
        empties: [],
      },
    ],
  }
}

test('groups rows by the base at the column, commonest block first', () => {
  const ordered = orderMafRowsByBaseAt(ROWS, ROWS, region(), 102)
  // G ×3 (case folded), then T, then the deleting row, then the row with no
  // block at all
  expect(ordered.map(r => r.name)).toEqual(['s0', 's1', 's4', 's2', 's3', 's5'])
})

test('orders the rows it is handed, resolving bases through the drawn rows', () => {
  // a subtree filter drew only s2 and s0 (in that order), so the block's
  // rowIndex 0 names s2 and rowIndex 1 names s0; the unfiltered list is what
  // gets ordered, and its hidden rows sink
  const drawn = [{ name: 's2' }, { name: 's0' }]
  const ordered = orderMafRowsByBaseAt(ROWS, drawn, region(), 102)
  // rowIndex 0 → s2 reads 'G', rowIndex 1 → s0 reads 'g': one block of two,
  // stable in incoming order; everything else has no drawn row
  expect(ordered.map(r => r.name)).toEqual(['s0', 's2', 's1', 's3', 's4', 's5'])
})

test('leaves the order alone at a column no block covers', () => {
  const ordered = orderMafRowsByBaseAt(ROWS, ROWS, region(), 500)
  expect(ordered.map(r => r.name)).toEqual(ROWS.map(r => r.name))
})
