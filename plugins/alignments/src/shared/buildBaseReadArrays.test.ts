import { buildBaseReadArrays } from './buildBaseReadArrays.ts'

import type { FeatureData } from './webglRpcTypes.ts'

function feat(overrides: Partial<FeatureData>): FeatureData {
  return {
    id: 'f1',
    name: 'read1',
    start: 0,
    end: 100,
    flags: 0,
    mapq: 60,
    insertSize: 0,
    pairOrientation: 0,
    strand: 1,
    ...overrides,
  }
}

describe('buildBaseReadArrays', () => {
  // readPositions is the read's identity and extent, not its drawn geometry, so
  // it carries the TRUE span even when the read overhangs the region. Arcs match
  // a fetched segment to its SA-tag twin on `${refName}:${start}`, so a start
  // clipped to the region would fail to match its twin and leave a duplicate
  // segment in the chain — which paints as a spurious same-strand "deletion"
  // arc. Clipping to the region is buildSegments' job (drawn rect + edge flags).
  test('keeps the true start of a read overhanging the region start', () => {
    const { readArrays } = buildBaseReadArrays([
      feat({ start: 100, end: 2000 }),
    ])
    expect([...readArrays.readPositions]).toEqual([100, 2000])
  })

  test('keeps true positions for reads wholly inside the region', () => {
    const { readArrays } = buildBaseReadArrays([
      feat({ id: 'a', start: 1000, end: 1100 }),
      feat({ id: 'b', start: 1200, end: 1300 }),
    ])
    expect([...readArrays.readPositions]).toEqual([1000, 1100, 1200, 1300])
  })

  test('copies the per-read scalar fields across', () => {
    const { readArrays } = buildBaseReadArrays([
      feat({
        id: 'x',
        name: 'readX',
        flags: 99,
        mapq: 37,
        insertSize: -250,
        pairOrientation: 2,
        strand: -1,
      }),
    ])
    expect(readArrays.readIds).toEqual(['x'])
    expect(readArrays.readNames).toEqual(['readX'])
    expect(readArrays.readFlags[0]).toBe(99)
    expect(readArrays.readMapqs[0]).toBe(37)
    expect(readArrays.readInsertSizes[0]).toBe(-250)
    expect(readArrays.readPairOrientations[0]).toBe(2)
    expect(readArrays.readStrands[0]).toBe(-1)
  })

  // Uint8Array would wrap a raw 260; MAPQ 255 also means "unavailable".
  test('saturates mapq at 255', () => {
    const { readArrays } = buildBaseReadArrays([feat({ mapq: 260 })])
    expect(readArrays.readMapqs[0]).toBe(255)
  })

  test('leaves Y values for the main-thread layout to fill', () => {
    const { readArrays } = buildBaseReadArrays([feat({}), feat({ id: 'f2' })])
    expect([...readArrays.readYs]).toEqual([0, 0])
  })
})
