/**
 * @jest-environment node
 */
import { parseAnnotationLocus } from './annotationOverlay.ts'

// 1-based inclusive in, interbase out.
test('a range keeps both of its ends', () => {
  expect(parseAnnotationLocus('ctgA:100-200')).toEqual({
    refName: 'ctgA',
    start: 99,
    end: 200,
  })
  // `..` is the other separator the specs use, and commas/spaces are noise
  expect(parseAnnotationLocus('1:55,705,711..55,705,716')).toEqual({
    refName: '1',
    start: 55705710,
    end: 55705716,
  })
})

// The distinction the box geometry rests on: pointing AT a position is a
// zero-width interval between two bases, wrapping one is the base's own column.
// A box built on the zero-width region is centred on the boundary, so half its
// stroke lands on the column it frames — the "boxes cover up the variant"
// failure in alignments/strand_split_coverage.
test('a single coordinate is a position, or the base, depending on the caller', () => {
  expect(parseAnnotationLocus('1:55,705,711')).toEqual({
    refName: '1',
    start: 55705710,
    end: 55705710,
  })
  expect(parseAnnotationLocus('1:55,705,711', true)).toEqual({
    refName: '1',
    start: 55705710,
    end: 55705711,
  })
})

// A refName may contain colons as long as coordinates follow it.
test('splits on the last colon', () => {
  expect(parseAnnotationLocus('HLA:A:01:01:1-10').refName).toBe('HLA:A:01:01')
})

test('a locus with no coordinates is an error, not a silent zero', () => {
  expect(() => parseAnnotationLocus('ctgA')).toThrow(/is not <refName>/)
  expect(() => parseAnnotationLocus('ctgA:start-end')).toThrow(
    /is not <refName>/,
  )
})
