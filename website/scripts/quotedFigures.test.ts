/// <reference types="jest" />

/**
 * The figure extractor behind `check-quoted-figures`, whose failure mode is a
 * checker that reports a page clean because it never looked at half of it.
 *
 * `check-quoted-figures.ts` claimed in its own header that ranges were "matched
 * end by end and both ends checked separately", and that was false from the
 * first commit: the lower number of `70-90%` is followed by `-` rather than a
 * unit, so the pattern matched `90%` alone. Every range on the optimizations
 * page — the decompression share, the wasm inflate speedup, the per-block scan —
 * had an unchecked half, and `17-90%` passed. Nothing could have said so, which
 * is the argument for pinning it here rather than in a comment.
 */
import { figuresIn } from './quotedFigures.ts'

const keys = (text: string) => [...figuresIn(text).keys()].sort()

test('a plain figure is its normalized value', () => {
  expect(keys('the pool is worth 1.95x end to end')).toEqual(['1.95x'])
  expect(keys('a 213 MB slice')).toEqual(['213mb'])
})

test('separators and spacing collapse to one key', () => {
  expect(keys('1,234.5 MB')).toEqual(keys('1234.5MB'))
  // A wrapped paragraph puts a newline between number and unit.
  expect(keys('caps the buffer at 80\nKiB today')).toEqual(['80kib'])
})

test('BOTH ends of a range are figures', () => {
  expect(keys('70-90% of its wall clock')).toEqual(['70%', '90%'])
  expect(keys('beats it by 2.6-3.5x')).toEqual(['2.6x', '3.5x'])
  expect(keys('1.13-1.24x across the corpus')).toEqual(['1.13x', '1.24x'])
})

test('a range reports which end failed, in the words on the page', () => {
  expect(figuresIn('70-90% of its wall clock').get('70%')).toBe(
    '70% (from "70-90%")',
  )
})

test('a spaced dash is not a range', () => {
  // "four workers - 1.95x" would otherwise invent a 4x nobody wrote, which is
  // the reason the dash is unspaced rather than `\s?[-–]\s?`.
  expect(keys('four workers - 1.95x on BAM')).toEqual(['1.95x'])
  expect(keys('4 workers - 1.95x on BAM')).toEqual(['1.95x'])
})

test('a bare count is prose, not a figure', () => {
  expect(keys('three clocks, one call, both arms, 4 workers')).toEqual([])
})

test('versions, dates and anchors carry no unit', () => {
  expect(keys('v13.3.0, 2026-08-17, adr-022, #slot-height')).toEqual([])
})

test('a unit glued to a letter is not a figure', () => {
  expect(keys('a 5xample')).toEqual([])
  expect(keys('the 12kbps link')).toEqual([])
})

test('a depth-named fixture reads as the depth it is named for', () => {
  // `200x.shortread` yields `200x` — the `.` ends the match. Deliberate, and
  // load-bearing: the page says "1000x long-read data" and the route back is
  // the `1000x.shortread` fixture named in the pool's own JSDoc.
  expect(keys('the 200x.shortread fixture')).toEqual(['200x'])
})
