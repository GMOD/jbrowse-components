import {
  derivativeLetterSummary,
  letterSegments,
  pieceLetter,
} from './letterSegments.ts'

import type { DerivativeSegment } from './computePaths.ts'

function seg(
  refName: string,
  start: number,
  end: number,
  strand = 1,
): DerivativeSegment {
  return { refName, start, end, strand }
}

// COLO829's der(3) as the picker observes it: a chr3 arm, 199 bp of chr10, 183
// bp of chr12 inverted, then 6.4 kb of chr3 coming back inverted inside the
// first arm.
const der3 = [
  seg('chr3', 25_326_821, 25_359_568),
  seg('chr10', 58_717_463, 58_717_662),
  seg('chr12', 72_273_111, 72_273_294, -1),
  seg('chr3', 25_352_683, 25_359_111, -1),
]

describe('letterSegments', () => {
  it('writes der(3) as the inverted duplication it is', () => {
    const { derivative, segmentLetters } = letterSegments(der3)
    expect(derivative).toBe('A B C D E′ B′')
    expect(segmentLetters).toEqual([['A', 'B', 'C'], ['D'], ['E′'], ['B′']])
  })

  it('cuts the outgoing arm at the returning arm’s edges', () => {
    const { pieces } = letterSegments(der3)
    expect(
      pieces.map(p => [p.letter, p.refName, p.start, p.end, p.copies]),
    ).toEqual([
      ['A', 'chr3', 25_326_821, 25_352_683, 1],
      ['B', 'chr3', 25_352_683, 25_359_111, 2],
      ['C', 'chr3', 25_359_111, 25_359_568, 1],
      ['D', 'chr10', 58_717_463, 58_717_662, 1],
      ['E', 'chr12', 72_273_111, 72_273_294, 1],
    ])
  })

  it('letters chromosomes in the order the path visits them', () => {
    // a translocation read from chr12 first puts chr12 at A, whatever sorts
    // first alphabetically
    const { derivative, pieces } = letterSegments([
      seg('chr12', 100, 200),
      seg('chr3', 500, 900),
    ])
    expect(pieces.map(p => p.refName)).toEqual(['chr12', 'chr3'])
    expect(derivative).toBe('A B')
  })

  it('names the piece a deletion drops, and leaves it out of the string', () => {
    const { derivative, pieces } = letterSegments([
      seg('chr1', 1000, 2000),
      seg('chr1', 5000, 6000),
    ])
    expect(pieces.map(p => [p.letter, p.copies])).toEqual([
      ['A', 1],
      ['B', 0],
      ['C', 1],
    ])
    expect(derivative).toBe('A C')
  })

  it('primes an inversion and reads its pieces high to low', () => {
    const { derivative } = letterSegments([
      seg('chr1', 0, 1000),
      seg('chr1', 1000, 3000, -1),
      seg('chr1', 3000, 4000),
    ])
    expect(derivative).toBe('A B′ C')
    // an inverted segment spanning two pieces lists them the way it is crossed
    const spanning = letterSegments([
      seg('chr1', 0, 1000),
      seg('chr1', 500, 3000, -1),
    ])
    expect(spanning.derivative).toBe('A B C′ B′')
  })

  it('writes a tandem duplication as a repeated letter', () => {
    const { derivative } = letterSegments([
      seg('chr1', 0, 2000),
      seg('chr1', 1000, 3000),
    ])
    expect(derivative).toBe('A B B C')
  })

  it('runs past Z without colliding', () => {
    expect([0, 25, 26, 27, 51, 52, 701, 702].map(pieceLetter)).toEqual([
      'A',
      'Z',
      'AA',
      'AB',
      'AZ',
      'BA',
      'ZZ',
      'AAA',
    ])
    const many = Array.from({ length: 60 }, (_, i) => seg(`chr${i}`, 0, 1000))
    const { pieces, derivative } = letterSegments(many)
    expect(new Set(pieces.map(p => p.letter)).size).toBe(60)
    expect(derivative.split(' ')).toHaveLength(60)
  })

  it('says nothing about an empty path', () => {
    expect(letterSegments([])).toEqual({
      pieces: [],
      segmentLetters: [],
      derivative: '',
    })
  })
})

describe('derivativeLetterSummary', () => {
  it('keeps a short string whole and cuts a long one with the count', () => {
    expect(derivativeLetterSummary(letterSegments(der3))).toBe('A B C D E′ B′')
    const many = Array.from({ length: 30 }, (_, i) => seg(`chr${i}`, 0, 1000))
    expect(derivativeLetterSummary(letterSegments(many), 4)).toBe(
      'A B C D … 26 more',
    )
  })
})
