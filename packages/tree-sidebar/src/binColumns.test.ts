import { binSpan, columnMeans, columnSegments } from './binColumns.ts'

function binned(
  regions: { start: number; end: number }[],
  bpPerPx: number,
  spans: [region: number, start: number, end: number, value: number][],
) {
  const { segments, width, invBpPerPx } = columnSegments(regions, bpPerPx)
  const sums = new Float64Array(width)
  const counts = new Int32Array(width)
  for (const [region, start, end, value] of spans) {
    binSpan(sums, counts, 0, segments[region]!, invBpPerPx, start, end, value)
  }
  return [...columnMeans(sums, counts, 0, new Float32Array(width))]
}

test('a span fills every column it covers, and nothing else', () => {
  expect(binned([{ start: 0, end: 100 }], 10, [[0, 0, 50, 7]])).toEqual([
    7, 7, 7, 7, 7, 0, 0, 0, 0, 0,
  ])
})

test('a 1 bp feature lands in the column it starts in', () => {
  expect(
    binned([{ start: 0, end: 100 }], 10, [
      [0, 25, 26, 3],
      [0, 71, 72, 5],
    ]),
  ).toEqual([0, 0, 3, 0, 0, 0, 0, 5, 0, 0])
})

test('a column is the mean of the spans landing in it', () => {
  expect(
    binned([{ start: 0, end: 20 }], 10, [
      [0, 0, 1, 2],
      [0, 5, 6, 4],
      [0, 9, 10, 6],
      [0, 10, 20, 100],
    ]),
  ).toEqual([4, 100])
})

test('regions sit end to end, and a span is clipped to its own', () => {
  expect(
    binned(
      [
        { start: 0, end: 50 },
        { start: 1000, end: 1100 },
      ],
      50,
      [
        [0, -40, 30, 9],
        [1, 1050, 1200, 2],
      ],
    ),
  ).toEqual([9, 0, 2])
})

test('a row offset keeps each row to its own columns', () => {
  const { segments, width, invBpPerPx } = columnSegments(
    [{ start: 0, end: 20 }],
    10,
  )
  const sums = new Float64Array(2 * width)
  const counts = new Int32Array(2 * width)
  binSpan(sums, counts, width, segments[0]!, invBpPerPx, 12, 13, 8)
  expect([...columnMeans(sums, counts, 0, new Float32Array(width))]).toEqual([
    0, 0,
  ])
  expect([
    ...columnMeans(sums, counts, width, new Float32Array(width)),
  ]).toEqual([0, 8])
})
