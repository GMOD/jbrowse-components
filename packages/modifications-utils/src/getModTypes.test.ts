import { getModPositions } from './getModPositions.ts'
import { getModTypes } from './getModTypes.ts'

// `getModTypes` exists so a caller can learn which modifications a read
// declares without `getModPositions`' walk over the read sequence. That is only
// safe while the two agree about what a tag declares — a disagreement shows up
// as a modification the menu offers and the display cannot draw, or the
// reverse, and neither errors.
//
// So the test is the cross-check itself, over every header shape the MM grammar
// allows. `getModPositions` is the authority: it is what actually draws.
const seq = 'ACGTACGTACGTACGTACGTACGTACGTACGTACGTACGTACGTACGTACGTACGTACGTACGT'

const TAGS = [
  // the ordinary case
  'C+m,1,2;',
  'C+m,1,2',
  // no positions at all, which is a legal tag and still declares a type
  'C+m;',
  'C+m',
  // combined code: one header, two types, interleaved ML
  'C+mh,1,2;',
  // several groups
  'C+m,1;A+a,0;',
  'C+m,1;C+h,1;G+o,0;',
  // both strands
  'C-m,1;',
  // the skip flags
  'C+m?,1;',
  'C+m.,1;',
  'C+mh?,1;',
  // a ChEBI numeric code is ONE type however many digits it has
  'C+16061,1;',
  'N+16061,1;',
  // an uppercase ambiguity code is one type, and the spec's own grammar omits
  // it while its prose allows it
  'C+C,1;',
  'T+T,2;',
  // a trailing empty group, which `split(';')` produces from every tag ending
  // in a semicolon
  'C+m,1;;',
  // U is a legal canonical base here
  'U+m,1;',
]

test.each(TAGS)('getModTypes agrees with getModPositions on %s', tag => {
  for (const strand of [1, -1] as const) {
    const authority = getModPositions(tag, seq, strand).map(m => ({
      type: m.type,
      base: m.base,
      strand: m.strand,
    }))
    expect({ strand, types: getModTypes(tag) }).toEqual({
      strand,
      types: authority,
    })
  }
})

test('a combined code splits into one entry per character', () => {
  expect(getModTypes('C+mh,1;')).toEqual([
    { type: 'm', base: 'C', strand: '+' },
    { type: 'h', base: 'C', strand: '+' },
  ])
})

test('a numeric ChEBI code stays whole', () => {
  expect(getModTypes('C+16061,1;')).toEqual([
    { type: '16061', base: 'C', strand: '+' },
  ])
})

test('an empty tag declares nothing', () => {
  expect(getModTypes('')).toEqual([])
  expect(getModTypes(';')).toEqual([])
})

test('a malformed header throws rather than declaring a wrong type', () => {
  expect(() => getModTypes('Z+m,1;')).toThrow(/bad format for MM tag/)
})
