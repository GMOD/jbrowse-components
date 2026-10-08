import { paintRuns } from './ideogramPaint.ts'

const region = { start: 1000, end: 2000 }

test('each bin takes the color covering most of it', () => {
  const runs = paintRuns(
    [
      { start: 1000, end: 1160, color: 'red' },
      { start: 1150, end: 1200, color: 'blue' },
    ],
    region,
    100,
  )
  expect(runs).toEqual([{ start: 1000, end: 1200, color: 'red' }])
})

test('a stretch nothing aligns to is left unpainted', () => {
  const runs = paintRuns(
    [
      { start: 1000, end: 1200, color: 'red' },
      { start: 1500, end: 1600, color: 'red' },
    ],
    region,
    100,
  )
  expect(runs).toEqual([
    { start: 1000, end: 1200, color: 'red' },
    { start: 1500, end: 1600, color: 'red' },
  ])
})

test('a span past the region is painted only where it overlaps', () => {
  const runs = paintRuns([{ start: 0, end: 5000, color: 'red' }], region, 300)
  expect(runs).toEqual([{ start: 1000, end: 2000, color: 'red' }])
})

// the runs are as many as the color changes at the bin's resolution, however
// many spans went in
test('a thousand spans of one color are one run', () => {
  const spans = Array.from({ length: 1000 }, (_, i) => ({
    start: 1000 + i,
    end: 1001 + i,
    color: 'red',
  }))
  expect(paintRuns(spans, region, 10)).toHaveLength(1)
})
