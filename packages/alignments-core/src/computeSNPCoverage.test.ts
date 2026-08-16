import { computeSNPCoverage } from './snpCoverage.ts'
import { readSnpSegments } from './snpSegments.ts'

// coverage with a flat depth of 10 starting at genomic position 100.
function coverageAt100(depth = 10) {
  const depths = new Float32Array(5).fill(depth)
  return { depths, maxDepth: depth, startPos: 100 }
}

// Split the {position, base}[] fixtures into the flat arrays computeSNPCoverage
// consumes. Ascending by position, which is the function's input contract —
// `buildMismatchArrays` and MAF's `MismatchWriter` both sort on the way out.
function segments(mismatches: { position: number; base: number }[]) {
  const sorted = [...mismatches].sort((a, b) => a.position - b.position)
  const positions = new Uint32Array(sorted.length)
  const bases = new Uint8Array(sorted.length)
  for (let i = 0; i < sorted.length; i++) {
    positions[i] = sorted[i]!.position
    bases[i] = sorted[i]!.base
  }
  return readSnpSegments(
    computeSNPCoverage(positions, bases, coverageAt100(10)).snpPackedBuffer,
  )
}

function heightsByColorType(mismatches: { position: number; base: number }[]) {
  const out: Record<number, number> = {}
  for (const s of segments(mismatches)) {
    out[s.colorType] = s.height
  }
  return out
}

describe('computeSNPCoverage', () => {
  test('stacks A/C/G/T segments as fractions of the position depth', () => {
    const byType = heightsByColorType([
      { position: 100, base: 65 }, // A
      { position: 100, base: 65 }, // A
      { position: 100, base: 84 }, // T
    ])
    expect(byType[1]).toBeCloseTo(0.2) // A: 2/10
    expect(byType[4]).toBeCloseTo(0.1) // T: 1/10
  })

  test('N and other non-ACGT bases become a grey colorType-5 segment', () => {
    const byType = heightsByColorType([
      { position: 100, base: 65 }, // A
      { position: 100, base: 78 }, // N
      { position: 100, base: 82 }, // R (IUPAC ambiguity)
    ])
    expect(byType[1]).toBeCloseTo(0.1) // A: 1/10
    expect(byType[5]).toBeCloseTo(0.2) // N + R: 2/10
  })

  test('a position with only N is not dropped', () => {
    const byType = heightsByColorType([
      { position: 100, base: 78 },
      { position: 100, base: 78 },
    ])
    expect(byType[5]).toBeCloseTo(0.2)
  })

  test('mismatches left of the coverage window are dropped', () => {
    const out = segments([
      { position: 99, base: 65 }, // left of coverage startPos 100
      { position: 100, base: 84 }, // T, kept
    ])
    expect(out).toHaveLength(1)
    expect(out[0]!.position).toBe(100)
    expect(out[0]!.colorType).toBe(4)
  })

  test('mismatches right of the coverage window are dropped', () => {
    const out = segments([
      { position: 104, base: 65 }, // last bin of the 5-long window
      { position: 105, base: 65 }, // one past it
    ])
    expect(out).toHaveLength(1)
    expect(out[0]!.position).toBe(104)
  })

  // The stack is built by accumulating yOffset over the lanes in order, so each
  // segment starts where the one below it ended and the last ends at the
  // position's total mismatch fraction.
  test('segments at one position stack bottom-to-top without a gap', () => {
    const out = segments([
      { position: 100, base: 65 },
      { position: 100, base: 67 },
      { position: 100, base: 71 },
      { position: 100, base: 84 },
    ])
    expect(out.map(s => s.colorType)).toEqual([1, 2, 3, 4])
    for (let i = 1; i < out.length; i++) {
      expect(out[i]!.yOffset).toBeCloseTo(
        out[i - 1]!.yOffset + out[i - 1]!.height,
      )
    }
    expect(out.at(-1)!.yOffset + out.at(-1)!.height).toBeCloseTo(0.4)
  })

  // Grouping is a run-walk over the ascending input rather than a per-bp
  // bucket array, so this is the property that replaces the window scan: equal
  // positions are contiguous and merge into one stack, and the runs come out in
  // position order.
  test('one stack per position, in position order', () => {
    const out = segments([
      { position: 102, base: 65 },
      { position: 100, base: 65 },
      { position: 102, base: 65 },
      { position: 100, base: 84 },
    ])
    expect(out.map(s => [s.position, s.colorType])).toEqual([
      [100, 1],
      [100, 4],
      [102, 1],
    ])
    expect(out[2]!.height).toBeCloseTo(0.2) // both 102s merged into one segment
  })

  test('relDepth is the position depth over the region peak', () => {
    const positions = new Uint32Array([100])
    const bases = new Uint8Array([65])
    const depths = new Float32Array([20, 0, 0, 0, 0])
    const out = readSnpSegments(
      computeSNPCoverage(positions, bases, {
        depths,
        maxDepth: 40,
        startPos: 100,
      }).snpPackedBuffer,
    )
    expect(out[0]!.relDepth).toBeCloseTo(0.5)
    expect(out[0]!.height).toBeCloseTo(0.05) // 1/20
  })

  // A position at zero depth hosts no SNPs, and the empty result is a fresh
  // 0-byte buffer rather than a shared one — the worker transfers it, which
  // detaches it.
  test('a zero-depth position emits nothing', () => {
    const positions = new Uint32Array([100])
    const bases = new Uint8Array([65])
    const first = computeSNPCoverage(positions, bases, {
      depths: new Float32Array([0, 0]),
      maxDepth: 40,
      startPos: 100,
    })
    expect(first.segmentCount).toBe(0)
    expect(first.snpPackedBuffer.byteLength).toBe(0)
    expect(first.snpPackedBuffer).not.toBe(
      computeSNPCoverage(positions, bases, {
        depths: new Float32Array([0, 0]),
        maxDepth: 40,
        startPos: 100,
      }).snpPackedBuffer,
    )
  })
})
