import { densityBinSize, densityToUniformBins } from './densityBins.ts'

function density(rows: [number, number, number][]) {
  return {
    starts: new Uint32Array(rows.map(r => r[0])),
    ends: new Uint32Array(rows.map(r => r[1])),
    scores: new Float32Array(rows.map(r => r[2])),
    exact: true,
  }
}

test('a source bin wider than the screen bin is spread as a rate', () => {
  const bins = densityToUniformBins(
    density([[0, 1000, 100]]),
    { start: 0, end: 1000 },
    250,
  )
  expect([...bins.depths]).toEqual([25, 25, 25, 25])
  expect(bins.maxDepth).toBe(25)
  expect(bins.binCount).toBe(4)
})

test('source bins narrower than the screen bin sum into it', () => {
  const bins = densityToUniformBins(
    density([
      [0, 100, 3],
      [100, 200, 5],
      [200, 300, 1],
    ]),
    { start: 0, end: 400 },
    200,
  )
  expect([...bins.depths]).toEqual([8, 1])
})

test('a partial overlap contributes its share and the total is conserved', () => {
  const bins = densityToUniformBins(
    density([[150, 350, 20]]),
    { start: 100, end: 500 },
    100,
  )
  expect([...bins.depths]).toEqual([5, 10, 5, 0])
  expect(bins.startOffset).toBe(100)
})

test('intervals outside the region and empty scores are ignored', () => {
  const bins = densityToUniformBins(
    density([
      [5000, 6000, 40],
      [0, 100, 0],
      [0, 100, Number.NaN],
    ]),
    { start: 0, end: 200 },
    100,
  )
  expect([...bins.depths]).toEqual([0, 0])
  expect(bins.maxDepth).toBe(0)
})

test('one bin per pixel, floored at a base', () => {
  expect(densityBinSize(0.2)).toBe(1)
  expect(densityBinSize(1234.4)).toBe(1234)
})
