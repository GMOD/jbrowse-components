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
