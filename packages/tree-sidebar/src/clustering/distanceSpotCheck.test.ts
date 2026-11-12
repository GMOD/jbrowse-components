import {
  distanceSpotCheckCells,
  euclideanDistance,
  findDistanceSpotCheckMismatch,
} from './distanceSpotCheck.ts'

function rows(n: number, v: number) {
  return Array.from({ length: n }, (_, i) =>
    Float32Array.from({ length: v }, (__, k) => ((i * 7 + k * 3) % 5) / 2),
  )
}

function upperTriangle(data: ArrayLike<number>[]) {
  const n = data.length
  const out = new Float32Array(n * n)
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      out[i * n + j] = euclideanDistance(data[i]!, data[j]!)
    }
  }
  return out
}

test('samples the upper triangle only, the last cell included', () => {
  const cells = distanceSpotCheckCells(100)
  expect(cells).toContainEqual({ i: 98, j: 99 })
  expect(cells).toContainEqual({ i: 0, j: 1 })
  for (const { i, j } of cells) {
    expect(j).toBeGreaterThan(i)
    expect(j).toBeLessThan(100)
  }
  expect(new Set(cells.map(c => `${c.i},${c.j}`)).size).toBe(cells.length)
})

test('degenerates gracefully at n = 2', () => {
  expect(distanceSpotCheckCells(2)).toEqual([{ i: 0, j: 1 }])
})

test('passes a correct matrix and its f32 rounding', () => {
  const data = rows(50, 40)
  const values = upperTriangle(data)
  expect(findDistanceSpotCheckMismatch(values, data)).toBeUndefined()
})

test('names the cell a truncated dispatch left at zero', () => {
  const data = rows(50, 40)
  const values = upperTriangle(data)
  values[48 * 50 + 49] = 0
  expect(findDistanceSpotCheckMismatch(values, data)).toMatch(
    /cell \(48, 49\) reads 0 where the CPU gives/,
  )
})

test('names a readback that is too short', () => {
  const data = rows(10, 4)
  expect(findDistanceSpotCheckMismatch(new Float32Array(20), data)).toBe(
    'readback holds 20 cells, not 100',
  )
})
