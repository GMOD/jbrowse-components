import { viewRegionTable } from './viewRegionTable.ts'

const place = (r: ReturnType<typeof viewRegionTable>[number], bp: number) =>
  r.anchorPx + (bp - r.anchorBp) * r.signedPxPerBp

test('each region places a bp where the view does, and spans its own screen extent', () => {
  // 10 bp per px, scrolled 50 px in: region 0 is px -50..50, region 1
  // (reversed) px 50..150
  const [a, b] = viewRegionTable({
    displayedRegions: [
      { start: 1000, end: 2000 },
      { start: 5000, end: 6000, reversed: true },
    ],
    bpPerPx: 10,
    offsetPx: 50,
  })
  expect([a!.leftPx, a!.rightPx]).toEqual([-50, 50])
  expect([b!.leftPx, b!.rightPx]).toEqual([50, 150])
  expect(place(a!, 1000)).toBeCloseTo(-50)
  expect(place(a!, 2000)).toBeCloseTo(50)
  expect(place(b!, 6000)).toBeCloseTo(50)
  expect(place(b!, 5000)).toBeCloseTo(150)
  // anchored at the bp under the view's left edge, or the near end
  expect(a!.anchorBp).toBe(1500)
  expect(b!.anchorBp).toBe(6000)
})
