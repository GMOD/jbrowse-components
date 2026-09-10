import { Slice } from '../CircularView/slices.ts'
import { ribbonAngles, ribbonEndRadians } from './ribbonGeometry.ts'

function block(refName: string, offsetRadians = 0) {
  return new Slice(
    { bpPerRadian: 1000 },
    {
      elided: false,
      widthBp: 10000,
      start: 0,
      end: 10000,
      refName,
      assemblyName: 'a',
    },
    offsetRadians,
  )
}

const chr1 = block('chr1')
const chr2 = block('chr2', 3)
const radius = 1000

const anchor = { block: chr1, start: 1000, end: 3000 }
const mate = { block: chr2, start: 2000, end: 5000 }

test('an end spans its own block, start to end', () => {
  expect(ribbonEndRadians(anchor, radius)).toEqual({ start: 1, end: 3 })
})

// a 5kb PAF record on a 250Mb chromosome is 2e-5 of the circle: a zero-width
// quad, invisible and with nothing to point at
test('a sub-pixel end is widened around where it sits', () => {
  const tiny = { block: chr1, start: 5000, end: 5001 }
  const { start, end } = ribbonEndRadians(tiny, radius, 20)
  expect(end - start).toBeCloseTo(20 / radius)
  expect((start + end) / 2).toBeCloseTo(5.0005)
})

// bpToRadians collapses an elision to its midpoint, so both coordinates land on
// one angle and only the floor keeps the ribbon on the figure
test('a ribbon into an elided slice still has width', () => {
  const elided = new Slice(
    { bpPerRadian: 1000 },
    {
      elided: true,
      widthBp: 1000,
      regions: [
        { refName: 'ctgA', start: 0, end: 500, assemblyName: 'a' },
        { refName: 'ctgB', start: 0, end: 500, assemblyName: 'a' },
      ],
    },
    0,
  )
  const { start, end } = ribbonEndRadians(
    { block: elided, start: 0, end: 500 },
    radius,
    20,
  )
  expect(end - start).toBeCloseTo(20 / radius)
})

// The strand lives in the order the mate's arc is walked and nowhere else: a
// forward alignment pairs the two spans start-to-start, so its boundary walks
// the mate high-to-low and its two curves do not cross; a reverse one pairs the
// anchor's start with the mate's END and takes the twist.
test('a forward alignment walks the mate arc high to low', () => {
  const { m1, m2 } = ribbonAngles({ anchor, mate, strand: 1, radius })
  expect(m1).toBeGreaterThan(m2)
})

test('a reverse alignment twists, walking the mate arc low to high', () => {
  const { m1, m2 } = ribbonAngles({ anchor, mate, strand: -1, radius })
  expect(m1).toBeLessThan(m2)
})

test('both strands cover the same two spans', () => {
  const fwd = ribbonAngles({ anchor, mate, strand: 1, radius })
  const rev = ribbonAngles({ anchor, mate, strand: -1, radius })
  expect([fwd.a1, fwd.a2]).toEqual([rev.a1, rev.a2])
  expect([fwd.m1, fwd.m2].sort()).toEqual([rev.m1, rev.m2].sort())
})

// A mirrored slice runs the other way round the circle, so its span's first base
// is at the LARGER angle. Sorting the two angles low-to-high loses that, and the
// two tests below are what it loses.
test("a reversed block's end angles come back in genomic order", () => {
  const mirrored = new Slice(
    { bpPerRadian: 1000 },
    {
      elided: false,
      widthBp: 10000,
      start: 0,
      end: 10000,
      refName: 'chr2',
      assemblyName: 'a',
      reversed: true,
    },
    3,
  )
  const { start, end } = ribbonEndRadians(
    { block: mirrored, start: 2000, end: 5000 },
    radius,
  )
  expect(start).toBeGreaterThan(end)
  expect(start - end).toBeCloseTo(3)
})

// The mirror's whole point: a forward alignment into a mirrored arc laid out
// after the anchor's visits its four angles in one direction, so its two
// crossing curves do not cross and a band of such ribbons reads as a band.
// Sorted angles put m1 past m2 here, and every ribbon takes a twist it has not
// got.
describe('a mirrored mate arc', () => {
  const mirrored = new Slice(
    { bpPerRadian: 1000 },
    {
      elided: false,
      widthBp: 10000,
      start: 0,
      end: 10000,
      refName: 'chr2',
      assemblyName: 'a',
      reversed: true,
    },
    3,
  )
  const mirroredMate = { block: mirrored, start: 2000, end: 5000 }

  test('leaves a forward alignment untwisted', () => {
    const { a1, a2, m1, m2 } = ribbonAngles({
      anchor,
      mate: mirroredMate,
      strand: 1,
      radius,
    })
    const angles = [a1, a2, m1, m2]
    expect(angles).toEqual([...angles].sort((x, y) => x - y))
  })

  test('twists an inversion, as an unmirrored arc does', () => {
    const { m1, m2 } = ribbonAngles({
      anchor,
      mate: mirroredMate,
      strand: -1,
      radius,
    })
    expect(m1).toBeGreaterThan(m2)
  })
})
