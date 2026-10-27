import { drawnAxis, seamAtOrAfter, seamAtOrBefore } from './drawnAxis.ts'

const exons = [
  { regionStart: 0, regionEnd: 100 },
  { regionStart: 1000, regionEnd: 1100 },
  { regionStart: 5000, regionEnd: 5100 },
]

test('cuts the bp between regions, so neighbouring regions meet', () => {
  const at = drawnAxis(exons)
  expect([0, 100, 1000, 1100, 5000, 5100].map(at)).toEqual([
    0, 100, 100, 200, 200, 300,
  ])
})

test('a position inside a hidden stretch lands on its seam', () => {
  const at = drawnAxis(exons)
  expect(at(500)).toBe(100)
  expect(at(3000)).toBe(200)
})

test('keeps genomic distances outside the outer regions', () => {
  const at = drawnAxis(exons)
  expect(at(-50)).toBe(-50)
  expect(at(5200)).toBe(400)
})

test('is genomic bp for one region, or for regions that touch or overlap', () => {
  for (const regions of [
    [{ regionStart: 0, regionEnd: 100 }],
    [
      { regionStart: 0, regionEnd: 100 },
      { regionStart: 100, regionEnd: 200 },
    ],
    [
      { regionStart: 0, regionEnd: 150 },
      { regionStart: 100, regionEnd: 200 },
    ],
  ]) {
    const at = drawnAxis(regions)
    expect([0, 50, 150, 900].map(at)).toEqual([0, 50, 150, 900])
  }
})

test('reads regions in any order', () => {
  const at = drawnAxis([...exons].reverse())
  expect(at(1050)).toBe(150)
})

test('lists the seams where it cuts, ascending', () => {
  const axis = drawnAxis(exons)
  expect(axis.seams).toEqual([100, 200])
  expect(seamAtOrBefore(axis, 150)).toBe(100)
  expect(seamAtOrBefore(axis, 200)).toBe(200)
  expect(seamAtOrBefore(axis, 50)).toBe(Number.NEGATIVE_INFINITY)
  expect(seamAtOrAfter(axis, 150)).toBe(200)
  expect(seamAtOrAfter(axis, 100)).toBe(100)
  expect(seamAtOrAfter(axis, 250)).toBe(Number.POSITIVE_INFINITY)
})
