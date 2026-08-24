import {
  bandCellCount,
  bandPairIndex,
  bandRowFirstColumn,
  bandRowStart,
  resolveBand,
} from './ldBand.ts'

function pairsInBand(n: number, k: number) {
  const out: [number, number][] = []
  for (let i = 1; i < n; i++) {
    for (let j = bandRowFirstColumn(i, k); j < i; j++) {
      out.push([i, j])
    }
  }
  return out
}

const SIZES = [2, 3, 5, 8, 17, 64, 129]
const WINDOWS = [1, 2, 3, 7, 16, 63, 200]

describe('the banded layout', () => {
  test('indexes every in-band pair exactly once, onto a dense range', () => {
    for (const n of SIZES) {
      for (const k of WINDOWS) {
        const pairs = pairsInBand(n, k)
        const count = bandCellCount(n, k)
        expect(pairs.length).toBe(count)
        const seen = new Set<number>()
        for (const [i, j] of pairs) {
          const idx = bandPairIndex(i, j, k)
          expect(idx).toBeGreaterThanOrEqual(0)
          expect(idx).toBeLessThan(count)
          expect(seen.has(idx)).toBe(false)
          seen.add(idx)
        }
        expect(seen.size).toBe(count)
      }
    }
  })

  test('is symmetric in its arguments', () => {
    for (const [i, j] of pairsInBand(40, 6)) {
      expect(bandPairIndex(j, i, 6)).toBe(bandPairIndex(i, j, 6))
    }
  })

  test('reports -1 for a pair outside the band', () => {
    expect(bandPairIndex(10, 3, 6)).toBe(-1)
    expect(bandPairIndex(3, 10, 6)).toBe(-1)
    expect(bandPairIndex(10, 4, 6)).not.toBe(-1)
  })

  // The property the whole layout is chosen for: unbanded runs must keep the
  // exact indices the triangular layout used, not merely an equivalent set.
  test('collapses to the triangular layout once the band covers everything', () => {
    for (const n of SIZES) {
      for (const k of [n - 1, n, n + 1, 10_000]) {
        expect(bandCellCount(n, k)).toBe((n * (n - 1)) / 2)
        for (let i = 1; i < n; i++) {
          expect(bandRowFirstColumn(i, k)).toBe(0)
          expect(bandRowStart(i, k)).toBe((i * (i - 1)) / 2)
          for (let j = 0; j < i; j++) {
            expect(bandPairIndex(i, j, k)).toBe((i * (i - 1)) / 2 + j)
          }
        }
      }
    }
  })

  // rowStart's two branches meet at i = k; if they disagree the row lengths go
  // wrong by one and every later row is shifted.
  test('the two rowStart branches agree where they meet', () => {
    for (const k of WINDOWS) {
      for (const i of [k - 1, k, k + 1, k + 2]) {
        if (i >= 1) {
          expect(bandRowStart(i + 1, k) - bandRowStart(i, k)).toBe(
            Math.min(i, k),
          )
        }
      }
    }
  })

  test('rows hold min(i, k) entries', () => {
    const k = 5
    for (let i = 1; i < 30; i++) {
      expect(i - bandRowFirstColumn(i, k)).toBe(Math.min(i, k))
    }
  })
})

// bandCellCount is the shader's own function (js-exported from
// ldUniforms.slang); bandRowStart is CPU-only. They are the same formula, so
// this is what keeps the hand-written half of the family tied to the generated
// half rather than merely agreeing today.
test('the generated cell count is bandRowStart at n', () => {
  for (const n of [0, 1, 2, 3, 5, 8, 17, 64, 129, 1000]) {
    for (const k of [1, 2, 3, 7, 16, 63, 200, 5000]) {
      expect(bandCellCount(n, k)).toBe(n < 2 ? 0 : bandRowStart(n, k))
    }
  }
})

describe('resolveBand', () => {
  test('0 means the full triangle', () => {
    expect(resolveBand(100, 0)).toBe(99)
  })

  test('clamps a window wider than the data to the full triangle', () => {
    expect(resolveBand(10, 500)).toBe(9)
    expect(resolveBand(10, 9)).toBe(9)
  })

  test('keeps a narrower window', () => {
    expect(resolveBand(100, 20)).toBe(20)
  })

  test('degenerate SNP counts', () => {
    expect(resolveBand(0, 10)).toBe(0)
    expect(resolveBand(1, 10)).toBe(0)
    expect(bandCellCount(0, 0)).toBe(0)
    expect(bandCellCount(1, 0)).toBe(0)
  })
})

describe('the band is what makes the cost linear', () => {
  test('n*k rather than n^2/2 once the window bites', () => {
    // 50,000 SNPs is a 1.25e9-cell triangle; a 500-window is ~2.5e7.
    expect(bandCellCount(50_000, 49_999)).toBe(1_249_975_000)
    expect(bandCellCount(50_000, 500)).toBe(24_874_750)
    // Doubling n doubles a banded matrix, where it quadruples a full one:
    // linear growth against quadratic is the whole point of the band.
    const banded = bandCellCount(100_000, 500) / bandCellCount(50_000, 500)
    const full = bandCellCount(60_000, 59_999) / bandCellCount(30_000, 29_999)
    expect(banded).toBeGreaterThan(2)
    expect(banded).toBeLessThan(2.01)
    expect(full).toBeGreaterThan(3.99)
    expect(full).toBeLessThan(4.01)
  })

  // bandCellCount is the SHADER's function, so it counts in uint32 and wraps
  // exactly where the kernel would. That is the honest answer — a host counting
  // in float64 would disagree with the dispatch filling the buffer — but it
  // means the count holds only while the `m*(m-1)` term fits u32, i.e. up to
  // m = 65,536. What matters is WHICH side that binds: `m` is `min(n, k)`, so
  // a banded matrix is limited by its WINDOW and an unbanded one by n. The band
  // is what keeps you inside u32, not what risks it.
  test('the count is uint32, and the band is the safe side of that', () => {
    // Unbanded: exact to n = 65,537, wrapping at the next SNP.
    expect(bandCellCount(65_537, 65_536)).toBe(2_147_516_416)
    expect(bandCellCount(65_538, 65_537)).toBe(98_305)
    // Banded: a 500-window stays exact into the millions of SNPs, far past
    // anything the fetch or the GPU output buffer would ever admit.
    expect(bandCellCount(1_000_000, 500)).toBe(499_874_750)
    expect(bandCellCount(8_000_000, 500)).toBe(3_999_874_750)
  })
})
