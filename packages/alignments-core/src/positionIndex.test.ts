import { lowerBound, positionIndexFor } from './positionIndex.ts'

// The two sorts are chosen by span-per-entry, so a test that only ever builds
// dense fixtures exercises one of them. `sparse` is wide enough to cross
// SPARSE_RATIO, `dense` narrow enough not to.
function dense(values: number[]) {
  return new Uint32Array(values)
}
function sparse(values: number[]) {
  return new Uint32Array(values.map(v => v * 100_000))
}

describe('positionIndexFor', () => {
  it('orders entries by position, both ways it can sort', () => {
    for (const make of [dense, sparse]) {
      const positions = make([5, 1, 9, 1, 3])
      const { order, sorted } = positionIndexFor(positions)
      expect([...sorted]).toEqual([...make([1, 1, 3, 5, 9])])
      // `order` names the original slot each sorted entry came from — which is
      // the whole point, since the parallel arrays are read through it.
      expect([...order].map(i => positions[i])).toEqual([...sorted])
    }
  })

  it('reads every stride-th entry, for an array of pairs', () => {
    // gapPositions is [start, end] pairs; the index is over the starts.
    const gaps = new Uint32Array([50, 60, 10, 20, 30, 90])
    const { order, sorted } = positionIndexFor(gaps, 2)
    expect([...sorted]).toEqual([10, 30, 50])
    expect([...order]).toEqual([1, 2, 0])
  })

  it('is empty for an empty array', () => {
    const { order, sorted } = positionIndexFor(new Uint32Array(0))
    expect(order.length).toBe(0)
    expect(sorted.length).toBe(0)
  })

  it('handles a single entry and an all-equal run', () => {
    expect([...positionIndexFor(new Uint32Array([7])).sorted]).toEqual([7])
    expect([...positionIndexFor(new Uint32Array([7, 7, 7])).sorted]).toEqual([
      7, 7, 7,
    ])
  })

  it('returns the same object for the same array', () => {
    // Memoized against the array itself — a refetch replaces the array, so this
    // is also how the index invalidates.
    const positions = new Uint32Array([3, 1, 2])
    expect(positionIndexFor(positions)).toBe(positionIndexFor(positions))
    expect(positionIndexFor(new Uint32Array([3, 1, 2]))).not.toBe(
      positionIndexFor(positions),
    )
  })

  it('answers the stride asked for, not the one cached', () => {
    // One array read two ways is two different indexes. A memo that ignored the
    // stride returned the stride-1 index here — a plausible answer (every entry,
    // in order) for a caller that asked about the starts.
    const gaps = new Uint32Array([50, 60, 10, 20, 30, 90])
    expect([...positionIndexFor(gaps).sorted]).toEqual([10, 20, 30, 50, 60, 90])
    expect([...positionIndexFor(gaps, 2).sorted]).toEqual([10, 30, 50])
    // Either order, since whichever ran first is the one that populated the memo.
    const other = new Uint32Array([50, 60, 10, 20, 30, 90])
    expect([...positionIndexFor(other, 2).sorted]).toEqual([10, 30, 50])
    expect([...positionIndexFor(other).sorted]).toEqual([
      10, 20, 30, 50, 60, 90,
    ])
  })

  it('holds ONE index per array, replacing it when the stride changes', () => {
    // The stride is carried on the index rather than keyed on, so a mismatch
    // rebuilds and evicts instead of retaining both. That is deliberate: the
    // index is 8 bytes an entry, and nothing on this path may quietly hold two.
    const gaps = new Uint32Array([50, 60, 10, 20, 30, 90])
    const a = positionIndexFor(gaps, 2)
    expect(positionIndexFor(gaps, 2)).toBe(a)
    expect(a.stride).toBe(2)

    const b = positionIndexFor(gaps)
    expect(b).not.toBe(a)
    expect(b.stride).toBe(1)
    // Asking for stride 2 again rebuilds — the stride-1 index replaced it.
    expect(positionIndexFor(gaps, 2)).not.toBe(a)
  })

  it('agrees with a plain sort on a large mixed input', () => {
    const n = 5000
    const positions = new Uint32Array(n)
    let s = 12345
    for (let i = 0; i < n; i++) {
      s = (s * 1664525 + 1013904223) >>> 0
      positions[i] = 1_000_000 + (s % 4000)
    }
    const { order, sorted } = positionIndexFor(positions)
    expect([...sorted]).toEqual([...positions].sort((a, b) => a - b))
    expect([...order].map(i => positions[i])).toEqual([...sorted])
  })
})

describe('lowerBound', () => {
  const sorted = new Uint32Array([1, 3, 3, 3, 7])

  it('finds the first slot at or after the target', () => {
    expect(lowerBound(sorted, 0)).toBe(0)
    expect(lowerBound(sorted, 1)).toBe(0)
    expect(lowerBound(sorted, 2)).toBe(1)
    expect(lowerBound(sorted, 3)).toBe(1)
    expect(lowerBound(sorted, 4)).toBe(4)
    expect(lowerBound(sorted, 7)).toBe(4)
    expect(lowerBound(sorted, 8)).toBe(5)
  })

  it('brackets a run, which is how callers read one position', () => {
    expect(lowerBound(sorted, 4) - lowerBound(sorted, 3)).toBe(3)
    expect(lowerBound(sorted, 6) - lowerBound(sorted, 5)).toBe(0)
  })

  it('is 0 on an empty array', () => {
    expect(lowerBound(new Uint32Array(0), 5)).toBe(0)
  })
})
