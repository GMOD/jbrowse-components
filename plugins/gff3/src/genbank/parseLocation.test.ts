import { parseLocation, placeSpans } from './parseLocation.ts'

const plus = (start: number, end: number) => ({ start, end, strand: 1 })
const minus = (start: number, end: number) => ({ start, end, strand: -1 })

test.each([
  ['a range', '10..20', [plus(9, 20)]],
  ['a single base', '95', [plus(94, 95)]],
  ['a site between two bases covers both', '40^41', [plus(39, 41)]],
  ['one base somewhere in a range', '102.110', [plus(101, 110)]],
  ['partial markers', '<1..>200', [plus(0, 200)]],
  [
    'partial markers inside a join',
    'join(<10..20,30..>40)',
    [plus(9, 20), plus(29, 40)],
  ],
  ['a join', 'join(10..20,30..40)', [plus(9, 20), plus(29, 40)]],
  ['an order', 'order(1..5,7..9)', [plus(0, 5), plus(6, 9)]],
  ['a complement', 'complement(10..20)', [minus(9, 20)]],
  [
    'a complement of a join, in transcription order',
    'complement(join(10..20,30..40))',
    [minus(29, 40), minus(9, 20)],
  ],
  [
    'a join of complements, the same feature written the other way',
    'join(complement(30..40),complement(10..20))',
    [minus(29, 40), minus(9, 20)],
  ],
  ['a remote span is skipped', 'join(10..20,J00194.1:100..202)', [plus(9, 20)]],
  ['a location wholly on another entry', 'J00194.1:1..10', []],
  [
    'a gap is skipped',
    'join(10..20,gap(100),30..40)',
    [plus(9, 20), plus(29, 40)],
  ],
  [
    'whitespace a wrapped location kept',
    'join(10..20, 30..40)',
    [plus(9, 20), plus(29, 40)],
  ],
])('%s: %s', (_, location, expected) => {
  expect(parseLocation(location)).toEqual(expected)
})

describe('placeSpans', () => {
  test('a join wrapping the origin is one span past the end', () => {
    expect(
      placeSpans(parseLocation('join(16024..16569,1..576)'), 16569, true),
    ).toEqual([plus(16023, 17145)])
  })

  test('a complement wrapping the origin is one span past the end', () => {
    expect(
      placeSpans(
        parseLocation('complement(join(16024..16569,1..576))'),
        16569,
        true,
      ),
    ).toEqual([minus(16023, 17145)])
  })

  test('a site between the last base and the first wraps', () => {
    expect(placeSpans(parseLocation('60^1'), 60, true)).toEqual([plus(59, 61)])
  })

  test('a join wrapping the origin keeps its intron', () => {
    expect(placeSpans(parseLocation('join(50..55,5..10)'), 60, true)).toEqual([
      plus(49, 55),
      plus(64, 70),
    ])
  })

  test('a linear sequence keeps the spans as written', () => {
    const spans = parseLocation('join(50..60,1..10)')
    expect(placeSpans(spans, 60, false)).toEqual(spans)
  })

  test('a mixed-strand join is left as written', () => {
    const spans = parseLocation('join(complement(30..40),50..60,1..5)')
    expect(placeSpans(spans, 60, true)).toEqual(spans)
  })
})
