import { bandCellCount, bandPairIndex } from './ldBand.ts'
import { findLDSpotCheckMismatch, ldSpotCheckCells } from './ldGpuSpotCheck.ts'

// A stand-in for the exact matrix: distinct per pair and never 0, so a
// zero-filled cell cannot pass by coincidence.
const oracle = (i: number, j: number) => (i * 1000 + j) / 1e6

function exactMatrix(n: number, band: number) {
  const values = new Float32Array(bandCellCount(n, band))
  for (let i = 1; i < n; i++) {
    for (let j = Math.max(0, i - band); j < i; j++) {
      values[bandPairIndex(i, j, band)] = oracle(i, j)
    }
  }
  return values
}

describe('ldSpotCheckCells', () => {
  test('every probe is a real slot inside the band', () => {
    for (const [n, band] of [
      [2, 1],
      [3, 2],
      [40, 5],
      [5000, 500],
      [5000, 4999],
    ] as const) {
      const cells = ldSpotCheckCells(n, band)
      expect(cells.length).toBeGreaterThan(0)
      for (const { i, j } of cells) {
        expect(i).toBeGreaterThan(j)
        expect(i - j).toBeLessThanOrEqual(band)
        const slot = bandPairIndex(i, j, band)
        expect(slot).toBeGreaterThanOrEqual(0)
        expect(slot).toBeLessThan(bandCellCount(n, band))
      }
    }
  })

  // A truncated dispatch drops the last workgroups, so the highest flat index
  // is the cell most likely to be missing and the one probe that must be there.
  test('always probes the last slot of the flat order', () => {
    for (const [n, band] of [
      [40, 5],
      [5000, 500],
      [5000, 4999],
    ] as const) {
      const last = bandCellCount(n, band) - 1
      expect(
        ldSpotCheckCells(n, band).map(({ i, j }) => bandPairIndex(i, j, band)),
      ).toContain(last)
    }
  })

  // Cheap is the whole argument for doing this at all: the caller reached the
  // GPU because numCells * samples is at least 500,000.
  test('stays a handful of cells however large the matrix', () => {
    expect(ldSpotCheckCells(50_000, 500).length).toBeLessThanOrEqual(12)
  })
})

describe('findLDSpotCheckMismatch', () => {
  const N = 5000
  const BAND = 500

  test('passes an exact matrix', () => {
    expect(
      findLDSpotCheckMismatch(exactMatrix(N, BAND), N, BAND, oracle),
    ).toBeUndefined()
  })

  test('passes a matrix off by f32 rounding', () => {
    const values = exactMatrix(N, BAND)
    // the gap the kernels legitimately show against their CPU twins, measured
    // at 2.8e-8 to 6.0e-7 across every window after the bit-plane port
    for (const [k, v] of values.entries()) {
      values[k] = v + 6e-7
    }
    expect(findLDSpotCheckMismatch(values, N, BAND, oracle)).toBeUndefined()
  })

  // The failure mode itself: workgroups that never ran leave the buffer's own
  // zeros, which is a plausible-looking matrix and raises nothing.
  test('catches a zero-filled tail', () => {
    const values = exactMatrix(N, BAND)
    const numCells = values.length
    values.fill(0, Math.floor(numCells * 0.9))

    const mismatch = findLDSpotCheckMismatch(values, N, BAND, oracle)
    expect(mismatch).toBeDefined()
    expect(mismatch).toContain('reads 0')
  })

  // 1.2e-2 was the first window where the byte-loop kernel visibly disagreed;
  // 1.0 the next. Both have to be caught, or the detector only sees total
  // failure.
  test.each([1.2e-2, 1])('catches a disagreement of %p', delta => {
    const values = exactMatrix(N, BAND)
    values[values.length - 1] = values[values.length - 1]! + delta
    expect(findLDSpotCheckMismatch(values, N, BAND, oracle)).toContain(
      `cell (${N - 1}, ${N - 2})`,
    )
  })

  test('catches a readback that came back short', () => {
    const values = exactMatrix(N, BAND).slice(0, 10)
    expect(findLDSpotCheckMismatch(values, N, BAND, oracle)).toContain(
      '10-cell readback',
    )
  })
})
