import { placeMafRegionData } from './placeMafRows.ts'

import type { MafWireRegionData } from '../LinearMafRenderer/mafRenderingBackendTypes.ts'

const enc = new TextEncoder()

// Only the fields placement touches; `coverage` rides through untouched, so it
// is stubbed rather than built.
function wireData(rows: string[], empties: string[] = []): MafWireRegionData {
  return {
    blocks: [
      {
        startBp: 10,
        endBp: 14,
        refSeqBytes: enc.encode('ACGT'),
        rows: rows.map(sampleId => ({
          sampleId,
          alignmentBytes: enc.encode('ACGT'),
        })),
        empties: empties.map(sampleId => ({
          sampleId,
          status: 'C' as const,
          chr: 'chr1',
          start: 0,
          size: 4,
          strand: 1,
          srcSize: 100,
        })),
      },
    ],
    coverage: undefined as unknown as MafWireRegionData['coverage'],
  }
}

test('places rows at their index in the drawn row list', () => {
  // The worker emits in its own order; the display's order is the only one that
  // decides a row's position.
  const { blocks } = placeMafRegionData(
    wireData(['hg38', 'mm10', 'rn6']),
    new Map([
      ['rn6', 0],
      ['mm10', 1],
      ['hg38', 2],
    ]),
  )
  expect(blocks[0]!.rows.map(r => [r.sampleId, r.rowIndex])).toEqual([
    ['hg38', 2],
    ['mm10', 1],
    ['rn6', 0],
  ])
})

test('places e-line rows the same way', () => {
  const { blocks } = placeMafRegionData(
    wireData([], ['mm10']),
    new Map([
      ['hg38', 0],
      ['mm10', 1],
    ]),
  )
  expect(blocks[0]!.empties.map(e => e.rowIndex)).toEqual([1])
})

// The case the RPC's row order used to get wrong: a session arrives with a
// saved layout (a share link, a screenshot spec) naming a genome that this
// region has no alignment for. Under positional identity the reply's rows were
// numbered against a list the display did not draw, so every row below the
// missing one rendered under another row's name.
test('a genome the display is not drawing is dropped, not shifted', () => {
  const { blocks } = placeMafRegionData(
    wireData(['hg38', 'rn6', 'mm10']),
    // rn6 is in the file but not in `sources`
    new Map([
      ['hg38', 0],
      ['mm10', 1],
    ]),
  )
  expect(blocks[0]!.rows.map(r => [r.sampleId, r.rowIndex])).toEqual([
    ['hg38', 0],
    ['mm10', 1],
  ])
})

test('shares the alignment buffers rather than copying them', () => {
  // Placement runs on every reorder, so it copies row objects only — the
  // per-species sequence is the whole payload and must not be duplicated.
  const wire = wireData(['hg38'])
  const { blocks } = placeMafRegionData(wire, new Map([['hg38', 0]]))
  expect(blocks[0]!.rows[0]!.alignmentBytes).toBe(
    wire.blocks[0]!.rows[0]!.alignmentBytes,
  )
  expect(blocks[0]!.refSeqBytes).toBe(wire.blocks[0]!.refSeqBytes)
})
