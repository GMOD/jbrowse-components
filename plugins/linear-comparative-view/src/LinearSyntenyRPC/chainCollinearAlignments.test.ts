import { chainCollinearAlignments } from './chainCollinearAlignments.ts'

import type { FeatureLike } from './chainCollinearAlignments.ts'

function makeFeature(props: {
  refName: string
  start: number
  end: number
  strand: number
  mate: {
    start: number
    end: number
    refName: string
    name: string
    assemblyName: string
  }
  name?: string
  identity?: number
}): FeatureLike {
  const data: Record<string, unknown> = {
    ...props,
    assemblyName: 'asm1',
    CIGAR: '100M',
    syriType: undefined,
    name: props.name ?? 'q1',
  }
  return {
    get(key: string) {
      return data[key]
    },
    id() {
      return `feat-${props.refName}-${props.start}`
    },
  }
}

function mate(refName: string, start: number, end: number) {
  return { refName, start, end, name: refName, assemblyName: 'asm2' }
}

describe('chainCollinearAlignments', () => {
  it('returns empty array for empty input', () => {
    expect(chainCollinearAlignments([], 100_000)).toEqual([])
  })

  it('returns single feature unchanged', () => {
    const f = makeFeature({
      refName: 'chr1',
      start: 0,
      end: 1000,
      strand: 1,
      mate: mate('chr1', 0, 1000),
    })
    const result = chainCollinearAlignments([f], 100_000)
    expect(result).toHaveLength(1)
    expect(result[0]).toBe(f)
  })

  it('merges two collinear positive-strand features', () => {
    const f1 = makeFeature({
      refName: 'chr1',
      start: 1000,
      end: 2000,
      strand: 1,
      mate: mate('chr2', 5000, 6000),
    })
    const f2 = makeFeature({
      refName: 'chr1',
      start: 3000,
      end: 4000,
      strand: 1,
      mate: mate('chr2', 7000, 8000),
    })
    const result = chainCollinearAlignments([f1, f2], 100_000)
    expect(result).toHaveLength(1)
    expect(result[0]!.get('start')).toBe(1000)
    expect(result[0]!.get('end')).toBe(4000)
    const m = result[0]!.get('mate') as { start: number; end: number }
    expect(m.start).toBe(5000)
    expect(m.end).toBe(8000)
    expect(result[0]!.get('CIGAR')).toBe('')
  })

  it('merges two collinear negative-strand features', () => {
    const f1 = makeFeature({
      refName: 'chr1',
      start: 1000,
      end: 2000,
      strand: -1,
      mate: mate('chr2', 8000, 9000),
    })
    const f2 = makeFeature({
      refName: 'chr1',
      start: 3000,
      end: 4000,
      strand: -1,
      mate: mate('chr2', 6000, 7000),
    })
    const result = chainCollinearAlignments([f1, f2], 100_000)
    expect(result).toHaveLength(1)
    expect(result[0]!.get('start')).toBe(1000)
    expect(result[0]!.get('end')).toBe(4000)
    const m = result[0]!.get('mate') as { start: number; end: number }
    expect(m.start).toBe(6000)
    expect(m.end).toBe(9000)
  })

  it('does not merge features on different ref chromosomes', () => {
    const f1 = makeFeature({
      refName: 'chr1',
      start: 1000,
      end: 2000,
      strand: 1,
      mate: mate('chr2', 5000, 6000),
    })
    const f2 = makeFeature({
      refName: 'chr3',
      start: 3000,
      end: 4000,
      strand: 1,
      mate: mate('chr2', 7000, 8000),
    })
    const result = chainCollinearAlignments([f1, f2], 100_000)
    expect(result).toHaveLength(2)
  })

  it('does not merge features on different mate chromosomes', () => {
    const f1 = makeFeature({
      refName: 'chr1',
      start: 1000,
      end: 2000,
      strand: 1,
      mate: mate('chr2', 5000, 6000),
    })
    const f2 = makeFeature({
      refName: 'chr1',
      start: 3000,
      end: 4000,
      strand: 1,
      mate: mate('chr4', 7000, 8000),
    })
    const result = chainCollinearAlignments([f1, f2], 100_000)
    expect(result).toHaveLength(2)
  })

  it('does not merge features with different strands', () => {
    const f1 = makeFeature({
      refName: 'chr1',
      start: 1000,
      end: 2000,
      strand: 1,
      mate: mate('chr2', 5000, 6000),
    })
    const f2 = makeFeature({
      refName: 'chr1',
      start: 3000,
      end: 4000,
      strand: -1,
      mate: mate('chr2', 7000, 8000),
    })
    const result = chainCollinearAlignments([f1, f2], 100_000)
    expect(result).toHaveLength(2)
  })

  it('breaks chain when ref gap exceeds maxGap', () => {
    const f1 = makeFeature({
      refName: 'chr1',
      start: 1000,
      end: 2000,
      strand: 1,
      mate: mate('chr2', 5000, 6000),
    })
    const f2 = makeFeature({
      refName: 'chr1',
      start: 200_000,
      end: 201_000,
      strand: 1,
      mate: mate('chr2', 204_000, 205_000),
    })
    const result = chainCollinearAlignments([f1, f2], 50_000)
    expect(result).toHaveLength(2)
  })

  it('breaks chain when query gap exceeds maxGap', () => {
    const f1 = makeFeature({
      refName: 'chr1',
      start: 1000,
      end: 2000,
      strand: 1,
      mate: mate('chr2', 5000, 6000),
    })
    const f2 = makeFeature({
      refName: 'chr1',
      start: 3000,
      end: 4000,
      strand: 1,
      mate: mate('chr2', 200_000, 201_000),
    })
    const result = chainCollinearAlignments([f1, f2], 50_000)
    expect(result).toHaveLength(2)
  })

  it('does not merge overlapping features (negative ref gap)', () => {
    const f1 = makeFeature({
      refName: 'chr1',
      start: 1000,
      end: 5000,
      strand: 1,
      mate: mate('chr2', 1000, 5000),
    })
    const f2 = makeFeature({
      refName: 'chr1',
      start: 3000,
      end: 7000,
      strand: 1,
      mate: mate('chr2', 3000, 7000),
    })
    const result = chainCollinearAlignments([f1, f2], 100_000)
    expect(result).toHaveLength(2)
  })

  it('does not merge neg-strand when query goes wrong direction', () => {
    const f1 = makeFeature({
      refName: 'chr1',
      start: 1000,
      end: 2000,
      strand: -1,
      mate: mate('chr2', 8000, 9000),
    })
    const f2 = makeFeature({
      refName: 'chr1',
      start: 3000,
      end: 4000,
      strand: -1,
      mate: mate('chr2', 10_000, 11_000),
    })
    const result = chainCollinearAlignments([f1, f2], 100_000)
    expect(result).toHaveLength(2)
  })

  it('produces multiple chains from one chromosome pair', () => {
    const features = [
      makeFeature({
        refName: 'chr1',
        start: 1000,
        end: 2000,
        strand: 1,
        mate: mate('chr2', 5000, 6000),
      }),
      makeFeature({
        refName: 'chr1',
        start: 3000,
        end: 4000,
        strand: 1,
        mate: mate('chr2', 7000, 8000),
      }),
      makeFeature({
        refName: 'chr1',
        start: 500_000,
        end: 501_000,
        strand: 1,
        mate: mate('chr2', 600_000, 601_000),
      }),
      makeFeature({
        refName: 'chr1',
        start: 502_000,
        end: 503_000,
        strand: 1,
        mate: mate('chr2', 602_000, 603_000),
      }),
    ]
    const result = chainCollinearAlignments(features, 50_000)
    expect(result).toHaveLength(2)
    expect(result[0]!.get('start')).toBe(1000)
    expect(result[0]!.get('end')).toBe(4000)
    expect(result[1]!.get('start')).toBe(500_000)
    expect(result[1]!.get('end')).toBe(503_000)
  })

  it('computes weighted average identity', () => {
    const f1 = makeFeature({
      refName: 'chr1',
      start: 0,
      end: 1000,
      strand: 1,
      identity: 0.9,
      mate: mate('chr2', 0, 1000),
    })
    const f2 = makeFeature({
      refName: 'chr1',
      start: 2000,
      end: 5000,
      strand: 1,
      identity: 0.6,
      mate: mate('chr2', 2000, 5000),
    })
    const result = chainCollinearAlignments([f1, f2], 100_000)
    expect(result).toHaveLength(1)
    const identity = result[0]!.get('identity') as number
    // 0.9 * 1000 + 0.6 * 3000 = 900 + 1800 = 2700, total = 4000
    expect(identity).toBeCloseTo(2700 / 4000)
  })

  it('handles unsorted input by sorting internally', () => {
    const f1 = makeFeature({
      refName: 'chr1',
      start: 3000,
      end: 4000,
      strand: 1,
      mate: mate('chr2', 7000, 8000),
    })
    const f2 = makeFeature({
      refName: 'chr1',
      start: 1000,
      end: 2000,
      strand: 1,
      mate: mate('chr2', 5000, 6000),
    })
    const result = chainCollinearAlignments([f1, f2], 100_000)
    expect(result).toHaveLength(1)
    expect(result[0]!.get('start')).toBe(1000)
    expect(result[0]!.get('end')).toBe(4000)
  })

  it('preserves original features for single-feature chains', () => {
    const f1 = makeFeature({
      refName: 'chr1',
      start: 0,
      end: 100,
      strand: 1,
      mate: mate('chr2', 0, 100),
    })
    const f2 = makeFeature({
      refName: 'chr3',
      start: 0,
      end: 100,
      strand: 1,
      mate: mate('chr4', 0, 100),
    })
    const result = chainCollinearAlignments([f1, f2], 100_000)
    expect(result).toHaveLength(2)
    expect(result[0]).toBe(f1)
    expect(result[1]).toBe(f2)
  })

  it('chains three features into one block', () => {
    const features = [
      makeFeature({
        refName: 'chr1',
        start: 1000,
        end: 2000,
        strand: 1,
        mate: mate('chr2', 1000, 2000),
      }),
      makeFeature({
        refName: 'chr1',
        start: 3000,
        end: 4000,
        strand: 1,
        mate: mate('chr2', 3000, 4000),
      }),
      makeFeature({
        refName: 'chr1',
        start: 5000,
        end: 6000,
        strand: 1,
        mate: mate('chr2', 5000, 6000),
      }),
    ]
    const result = chainCollinearAlignments(features, 100_000)
    expect(result).toHaveLength(1)
    expect(result[0]!.get('start')).toBe(1000)
    expect(result[0]!.get('end')).toBe(6000)
    const m = result[0]!.get('mate') as { start: number; end: number }
    expect(m.start).toBe(1000)
    expect(m.end).toBe(6000)
  })

  it('merged features have chain- prefixed IDs', () => {
    const features = [
      makeFeature({
        refName: 'chr1',
        start: 1000,
        end: 2000,
        strand: 1,
        mate: mate('chr2', 1000, 2000),
      }),
      makeFeature({
        refName: 'chr1',
        start: 3000,
        end: 4000,
        strand: 1,
        mate: mate('chr2', 3000, 4000),
      }),
    ]
    const result = chainCollinearAlignments(features, 100_000)
    expect(result[0]!.id()).toMatch(/^chain-/)
  })

  it('maxGap=0 only merges exactly adjacent features', () => {
    const f1 = makeFeature({
      refName: 'chr1',
      start: 1000,
      end: 2000,
      strand: 1,
      mate: mate('chr2', 1000, 2000),
    })
    const f2 = makeFeature({
      refName: 'chr1',
      start: 2000,
      end: 3000,
      strand: 1,
      mate: mate('chr2', 2000, 3000),
    })
    const f3 = makeFeature({
      refName: 'chr1',
      start: 3001,
      end: 4000,
      strand: 1,
      mate: mate('chr2', 3001, 4000),
    })
    const result = chainCollinearAlignments([f1, f2, f3], 0)
    expect(result).toHaveLength(2)
    expect(result[0]!.get('start')).toBe(1000)
    expect(result[0]!.get('end')).toBe(3000)
  })
})
