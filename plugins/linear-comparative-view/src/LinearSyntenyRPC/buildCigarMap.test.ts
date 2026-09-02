import { parseCigar2, parseCoarseCigar } from '@jbrowse/cigar-utils'

import { findPosInCigar } from '../LaunchSyntenyView/findPosInCigar.ts'
import { buildCigarMap } from './buildCigarMap.ts'

import type { CigarMap } from './buildCigarMap.ts'

const map = (cigar: string, opts?: Parameters<typeof buildCigarMap>[1]) =>
  buildCigarMap(parseCigar2(cigar), opts)

// What the caller does per frame, written out here so the map is tested against
// the walk it replaces rather than against itself.
function interpolate({ featOffsets, mateOffsets }: CigarMap, featX: number) {
  const last = featOffsets.length - 1
  if (featX <= featOffsets[0]!) {
    return mateOffsets[0]!
  }
  if (featX >= featOffsets[last]!) {
    return mateOffsets[last]!
  }
  let lo = 0
  let hi = last
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (featOffsets[mid]! < featX) {
      lo = mid
    } else {
      hi = mid
    }
  }
  const a = featOffsets[lo]!
  const b = featOffsets[hi]!
  return b > a
    ? mateOffsets[lo]! +
        ((featX - a) / (b - a)) * (mateOffsets[hi]! - mateOffsets[lo]!)
    : mateOffsets[lo]!
}

test('an indel-free block is two points and exact', () => {
  const m = map('1000M')
  expect([...m.featOffsets]).toEqual([0, 1000])
  expect([...m.mateOffsets]).toEqual([0, 1000])
})

test('an insertion is a step, not a smear', () => {
  const m = map('100M50I100M')
  expect([...m.featOffsets]).toEqual([0, 100, 100, 200])
  expect([...m.mateOffsets]).toEqual([0, 100, 150, 250])
})

test('a deletion is the mirror step', () => {
  const m = map('100M50D100M')
  expect([...m.featOffsets]).toEqual([0, 100, 150, 250])
  expect([...m.mateOffsets]).toEqual([0, 100, 100, 200])
})

test('the walk this replaces agrees at every point', () => {
  const cigar = parseCigar2('100M50I100M30D100M7I200M')
  const m = buildCigarMap(cigar)
  for (let i = 0; i < m.featOffsets.length; i++) {
    const [, mateX] = findPosInCigar(cigar, m.featOffsets[i]!)
    // exact AT a point is the whole contract; between them it interpolates
    expect(interpolate(m, m.featOffsets[i]!)).toBeCloseTo(mateX, 6)
  }
})

// The reason to build a map at all rather than keep extrapolating one affine
// fit: over a block with indels in it the straight line is wrong by the indels.
test('beats a two-point affine fit over the same block', () => {
  const cigar = parseCigar2('1000M500D1000M400I1000M')
  const m = buildCigarMap(cigar)
  const featSpan = m.featOffsets.at(-1)!
  const mateSpan = m.mateOffsets.at(-1)!
  let worstMap = 0
  let worstAffine = 0
  for (let x = 0; x <= featSpan; x += 7) {
    const [, truth] = findPosInCigar(cigar, x)
    worstMap = Math.max(worstMap, Math.abs(interpolate(m, x) - truth))
    worstAffine = Math.max(
      worstAffine,
      Math.abs((x / featSpan) * mateSpan - truth),
    )
  }
  expect(worstMap).toBe(0)
  expect(worstAffine).toBeGreaterThan(400)
})

test('a block with more bends than the budget stays inside the budget', () => {
  const cigar = parseCigar2('10M3I'.repeat(5000))
  const m = buildCigarMap(cigar, { maxPoints: 64 })
  expect(m.featOffsets.length).toBeLessThanOrEqual(64 + 2)
  expect(m.toleranceBp).toBeGreaterThan(1)
})

test('and stays within twice its tolerance where it was thinned', () => {
  const cigar = parseCigar2('10M3I'.repeat(5000))
  const m = buildCigarMap(cigar, { maxPoints: 64 })
  const featSpan = m.featOffsets.at(-1)!
  let worst = 0
  for (let x = 0; x <= featSpan; x += 13) {
    const [, truth] = findPosInCigar(cigar, x)
    worst = Math.max(worst, Math.abs(interpolate(m, x) - truth))
  }
  expect(worst).toBeLessThanOrEqual(2 * m.toleranceBp)
})

test('the thinned map still ends on the block, not short of it', () => {
  const cigar = parseCigar2('10M3I'.repeat(5000))
  const m = buildCigarMap(cigar, { maxPoints: 64 })
  const [featX, mateX] = findPosInCigar(cigar, Number.MAX_SAFE_INTEGER)
  expect(m.featOffsets.at(-1)).toBe(featX)
  expect(m.mateOffsets.at(-1)).toBe(mateX)
})

test('clips advance neither axis, as in the walk', () => {
  expect([...map('10S100M5H').featOffsets]).toEqual([0, 100])
  expect([...map('10S100M5H').mateOffsets]).toEqual([0, 100])
})

test('an empty CIGAR is one degenerate point rather than a throw', () => {
  const m = map('')
  expect([...m.featOffsets]).toEqual([0])
  expect([...m.mateOffsets]).toEqual([0])
})

// A coarse fold's run is linear inside, so one point at its far end is exact
// and interpolating within it is the run's own proportion; the kept gap is a
// step, as any deletion is.
test('a coarse CIGAR run puts one point at its end and interpolates inside', () => {
  const m = buildCigarMap(parseCoarseCigar('1000:900M500D1000M'))
  expect([...m.featOffsets]).toEqual([0, 1000, 1500, 2500])
  expect([...m.mateOffsets]).toEqual([0, 900, 900, 1900])
  expect(interpolate(m, 500)).toBeCloseTo(450)
  expect(interpolate(m, 1250)).toBe(900)
})
