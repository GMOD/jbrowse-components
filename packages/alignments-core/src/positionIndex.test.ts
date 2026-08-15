import {
  forEachAtPosition,
  lowerBound,
  positionOrder,
} from './positionIndex.ts'

// The two sorts are chosen by span-per-entry, so a test that only ever builds
// dense fixtures exercises one of them. `sparse` is wide enough to cross
// SPARSE_RATIO, `dense` narrow enough not to.
function dense(values: number[]) {
  return new Uint32Array(values)
}
function sparse(values: number[]) {
  return new Uint32Array(values.map(v => v * 100_000))
}

describe('positionOrder', () => {
  it('orders entries by position, both ways it can sort', () => {
    for (const make of [dense, sparse]) {
      const positions = make([5, 1, 9, 1, 3])
      const { order, sorted } = positionOrder(positions)
      expect([...sorted]).toEqual([...make([1, 1, 3, 5, 9])])
      // `order` names the original slot each sorted entry came from — which is
      // the whole point, since the parallel arrays are read through it.
      expect([...order].map(i => positions[i])).toEqual([...sorted])
    }
  })

  it('reads every stride-th entry, for an array of pairs', () => {
    // gapPositions is [start, end] pairs; the index is over the starts.
    const gaps = new Uint32Array([50, 60, 10, 20, 30, 90])
    const { order, sorted } = positionOrder(gaps, 2)
    expect([...sorted]).toEqual([10, 30, 50])
    expect([...order]).toEqual([1, 2, 0])
  })

  it('is empty for an empty array', () => {
    const { order, sorted } = positionOrder(new Uint32Array(0))
    expect(order.length).toBe(0)
    expect(sorted.length).toBe(0)
  })

  // `sorted` is shipped: it becomes `mismatchPositions` in the alignments RPC
  // result and `mismatchPositions`/`insertionPositions` in MAF's, and those
  // results are posted with a transfer list derived from the payload. A shared
  // empty was therefore given away on the first empty region and reported as
  // "ArrayBuffer at index N is already detached" on every later one — for the
  // whole fetch, not just the empty lane. Nothing about the values distinguishes
  // the two versions, so identity is what has to be asserted.
  it('allocates a fresh empty result per call, because sorted is transferred', () => {
    const a = positionOrder(new Uint32Array(0))
    const b = positionOrder(new Uint32Array(0))
    expect(a.sorted).not.toBe(b.sorted)
    expect(a.sorted.buffer).not.toBe(b.sorted.buffer)
    expect(a.order).not.toBe(b.order)
  })

  // The stride-2 empty takes the same branch, and a caller that got a shared
  // object back from one stride would hand it to the other.
  it('allocates a fresh empty result at any stride', () => {
    expect(positionOrder(new Uint32Array(0), 2).sorted).not.toBe(
      positionOrder(new Uint32Array(0)).sorted,
    )
  })

  it('handles a single entry and an all-equal run', () => {
    expect([...positionOrder(new Uint32Array([7])).sorted]).toEqual([7])
    expect([...positionOrder(new Uint32Array([7, 7, 7])).sorted]).toEqual([
      7, 7, 7,
    ])
  })

  it('returns a fresh result each call, holding no cache', () => {
    // There is no memo in this module: every consumer's array is sorted by its
    // producer, so a reader searches what it was given. This pins that, because
    // the memo that used to be here retained 8 bytes an entry per region per
    // stacked track behind a call that read as a lookup.
    const positions = new Uint32Array([3, 1, 2])
    expect(positionOrder(positions)).not.toBe(positionOrder(positions))
    expect([...positionOrder(positions).sorted]).toEqual([1, 2, 3])
  })

  it('answers the stride asked for, every time', () => {
    // One array read two ways is two different orders, and with no cache in the
    // way each call simply computes the one asked for. The memo got this wrong —
    // `stride` was not in its key, so the second caller got the first's index:
    // `[10, 20, 30, 50, 60, 90]` where the starts are `[10, 30, 50]`.
    const gaps = new Uint32Array([50, 60, 10, 20, 30, 90])
    expect([...positionOrder(gaps).sorted]).toEqual([10, 20, 30, 50, 60, 90])
    expect([...positionOrder(gaps, 2).sorted]).toEqual([10, 30, 50])
    expect([...positionOrder(gaps).sorted]).toEqual([10, 20, 30, 50, 60, 90])
    expect([...positionOrder(gaps, 2).sorted]).toEqual([10, 30, 50])
  })

  it('agrees with a plain sort on a large mixed input', () => {
    const n = 5000
    const positions = new Uint32Array(n)
    let s = 12345
    for (let i = 0; i < n; i++) {
      s = (s * 1664525 + 1013904223) >>> 0
      positions[i] = 1_000_000 + (s % 4000)
    }
    const { order, sorted } = positionOrder(positions)
    expect([...sorted]).toEqual([...positions].sort((a, b) => a - b))
    expect([...order].map(i => positions[i])).toEqual([...sorted])
  })
})

describe('forEachAtPosition', () => {
  const visitAll = (
    positions: Uint32Array,
    blockEnds: number[],
    position: number,
  ) => {
    const hit: number[] = []
    forEachAtPosition(positions, blockEnds, position, i => hit.push(i))
    return hit
  }

  it('visits the run at a position in a single sorted array', () => {
    const positions = new Uint32Array([10, 20, 20, 20, 30])
    expect(visitAll(positions, [5], 20)).toEqual([1, 2, 3])
    expect(visitAll(positions, [5], 10)).toEqual([0])
    expect(visitAll(positions, [5], 25)).toEqual([])
  })

  it('crosses blocks that are each sorted but not sorted together', () => {
    // The interbase layout: insertions [0,3), softclips [3,5), hardclips [5,7),
    // ascending inside each. A single search over the whole array would miss the
    // later blocks entirely, which is the bug this shape exists to prevent.
    const positions = new Uint32Array([10, 20, 30, 15, 20, 20, 40])
    expect(visitAll(positions, [3, 5, 7], 20)).toEqual([1, 4, 5])
    expect(visitAll(positions, [3, 5, 7], 15)).toEqual([3])
    expect(visitAll(positions, [3, 5, 7], 40)).toEqual([6])
    expect(visitAll(positions, [3, 5, 7], 25)).toEqual([])
  })

  it('handles empty blocks and an empty array', () => {
    // A region with no softclips gives a zero-width middle block, which must not
    // swallow the block after it.
    const positions = new Uint32Array([10, 20, 20])
    expect(visitAll(positions, [1, 1, 3], 20)).toEqual([1, 2])
    expect(visitAll(new Uint32Array(0), [0, 0, 0], 20)).toEqual([])
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
